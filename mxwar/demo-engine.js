/* MOTOCROSS WAR — the capture harness, part 1: the REAL game engine driving the 3D race view the way game.js drives it, without the page
   (no menus, no DOM). Classic script (the browser: window.MXWar.DemoEngine; node: module.exports, for the seed search and the tests).
   Needs MXWar.Season / Race / Round / Art loaded (and MXWarData[season], MXWarIndex). What it copies from game.js (kept in step by hand):
   - the season and the round: S.newSeason(season, index, options, humans, seed), S.startRound, the qualifying races simmed (S.simRace) up to
     the race asked for (the Main), then S.startRace: 22 riders in the 2026 Anaheim 1 Main, the person ("YOU") among them;
   - view.setRace({...}) from the riders (trackRiders): team colours from Art.mk, plates, the red plate, "me";
   - the gate (act drop: the drop and the first lap's cards in one batch), then every lap: the view tells onLap(n) when the leader starts
     lap n, the human on Auto flips (220 ms), wars step on (900 ms a round), and at the batch's "win" (or a deadlock) the lap's plan goes to
     view.lap(plan) (lapPlan: order, counts, the winner, crashes, the yellow flag's sector, dnf, over, last) after the animation time the
     real game spends on the cards (reveal 1.0 s, a war 0.45 s or a 1.0 s banner, each war card round 1.4 s, the drop 0.65 s);
   - onLap3D: the yellow flag's marshal (yellowAt / yellowOff) and the white flag on the last lap.
   Timing goes through opts.later(fn, seconds): the demo page passes its virtual clock's setTimeout, so the same plan gives the same frames. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.DemoEngine) return;
var DEF_WAR={version:"three",onlyTied:true,outLoses:false,noDown:false,deucesWild:false,acesWild:false,jokersWild:false,wildAs:"top",form:false,cards:26};
function clone(x){ return JSON.parse(JSON.stringify(x)); }
function seasonOpts(){ return {length:"real",war:clone(DEF_WAR),fill:"full",nonTitle:true,skill:"normal"}; }

/* the season up to the race: opts {season:"sx-2026", round:1, kind:"main", seed:N, you:"YOU", bike:"Honda"} -> {G, rc, human, inMain} */
function setup(o){
  o=o||{};
  var S=MX.Season, RD=MX.Round, id=o.season||"sx-2026", seed=(o.seed==null?20261017:o.seed)>>>0, kind=o.kind||"main", ri=Math.max(0,(o.round||1)-1);
  var D=g.MXWarData&&g.MXWarData[id]; if(!D) throw new Error("demo-engine: no season data "+id+" (load data/"+id+".js)");
  var G=S.newSeason(D,g.MXWarIndex,seasonOpts(),[{name:o.you||"YOU",bike:o.bike||"Honda"}],seed);
  var guard=0;
  while(G.ri<ri&&!G.over&&guard++<400) S.simRace(G);          /* the rounds before it, simmed at once */
  S.startRound(G);
  guard=0; while(!G.over&&RD.current(G.round).kind!==kind&&guard++<20) S.simRace(G);   /* the heats, the semis, the LCQ */
  var human=G.humans[0], ent=RD.entrants(G.round)||[], inMain=ent.indexOf(human)>=0;
  S.startRace(G);
  return {G:G,rc:G.race,human:human,inMain:inMain,seed:seed};
}

/* what trackRiders() gives the view: the race, the calendar row, the riders (seat order = the gate order) */
function viewRace(G,o){
  o=o||{};
  var rc=G.race, c3=G.cal[Math.min(G.ri,G.cal.length-1)], A=MX.Art, red=o.red;   /* red: a seat, or null (round 1 has no points leader) */
  return {series:G.series,year:G.year,round:c3.n||(G.ri+1),cal:c3,len:rc.o.len,lapT:(G.round&&G.round.lapT)||0,
    riders:rc.r.map(function(p,s){ var R=G.riders[G.rmap[s]], m=A.mk(R.bike);
      return {s:s,color:m[0],accent:m[0]==="#f2f4f8"?"#183a8c":(m[1]==="#0b0a12"?"#16161c":"#f2f2f6"),num:R.plate,name:R.name,red:red===s,me:R.kind==="human"}; })};
}

/* the driver: opts {later(fn, seconds), log(line)} */
function drive(V,G,opts){
  opts=opts||{};
  var S=MX.Season, RC=MX.Race, rc=G.race, later=opts.later||function(fn,s){ return setTimeout(fn,Math.max(0,s)*1000); };
  var D={rc:rc,busy:false,lapReady:0,yellowNext:null,started:false,plans:[],events:[],batches:0,lastWin:null};
  function log(t){ D.events.push(t); if(opts.log) opts.log(t); }
  function lapPlan(evs,i,win){
    var crashes=[], dnf=[], sector=null, over=false, last=false, nextB=null;
    for(var k=i;k<evs.length;k++){ var e=evs[k];
      if(e.e==="crash") crashes.push({s:e.s,kind:e.kind,depth:e.depth});
      else if(e.e==="yellow"&&sector==null) sector=e.sector;
      else if(e.e==="dnf") dnf.push(e.s);
      else if(e.e==="flag") over=true;
      else if(e.e==="next") nextB=e.b; }
    if(nextB!=null&&nextB===rc.o.len&&rc.o.len>1) last=true;
    var order1=RC.standings(rc).map(function(r){ return r.s; }), cnt1=rc.r.map(function(p){ return p.pk.length; });
    var lap=rc.battle, y=D.yellowNext&&D.yellowNext.lap===lap?{sector:D.yellowNext.sector}:null;
    return {lap:lap,order0:(D.order0||order1).slice(),order1:order1,cnt0:(D.cnt0||cnt1).slice(),cnt1:cnt1,win:win,crashes:crashes,sector:sector,dnf:dnf,yellow:y,over:over,last:last};
  }
  function startShow(P){
    if(P.sector!=null) D.yellowNext={lap:P.lap+1,sector:P.sector};
    D.plans.push(P); D.lastWin=P.win; log("lap "+P.lap+" plan: win seat "+P.win+(P.crashes.length?", crashes "+P.crashes.map(function(c){ return c.s+":"+c.kind; }).join(","):"")+(P.sector!=null?", yellow @"+P.sector:"")+(P.over?", OVER":""));
    return V.lap(P);
  }
  function at(t0,fn){ if(t0<=0) fn(); else later(fn,t0); }
  /* one batch of engine events, played in order like anim3D (a clock t of the animation time), then the next move */
  function play(evs){
    var t=0, wars=0;
    D.busy=true; D.batches++;
    for(var i=0;i<evs.length;i++){ (function(e,i,t0){
      switch(e.e){
        case "gate": at(t0,function(){ V.drop(); }); t+=0.65; break;
        case "reveal": if(e.w===0){ at(t0,function(){ V.hold(null); }); t+=1.0; } else t+=1.4; break;
        case "war": wars++; at(t0,function(){ V.hold({war:e.seats}); }); t+=e.n>1?1.0:0.45; break;
        case "win": { var P=lapPlan(evs,i,e.s); at(t0,function(){ startShow(P); }); t+=0.25; break; }
        case "deadlock": { var P2=lapPlan(evs,i,-1); at(t0,function(){ startShow(P2); }); break; }
        case "flag": log("flag: race over (order "+e.order.slice(0,3).join(",")+"...)"); break;
        default: break;
      } })(evs[i],i,t);
    }
    later(function(){ D.busy=false; next(); },t+0.01);
  }
  function act(kind){
    if(rc.over) return;
    var ev=[], pre=rc.r.map(function(p){ return p.pk.length; });
    if(rc.phase==="gate"||(rc.phase==="flip"&&!Object.keys(rc.pick||{}).length)){ D.order0=RC.standings(rc).map(function(r){ return r.s; }); D.cnt0=pre; }   /* the lap's cards, before and after */
    if(kind==="drop"){
      var r=S.apply(G,{t:"drop"}); if(!r.ok) return; ev=r.ev;
      RC.need(rc).slice().forEach(function(s){ var r2=S.apply(G,{t:"flip",s:s}); if(r2.ok) ev=ev.concat(r2.ev); });   /* 3D: the drop is the first lap's cards too */
      if(!rc.over&&!RC.need(rc).length&&rc.phase==="flip") ev=ev.concat(S.step(G));
    } else if(kind==="flipAll"){ RC.need(rc).slice().forEach(function(s){ var r3=S.apply(G,{t:"flip",s:s}); if(r3.ok) ev=ev.concat(r3.ev); }); }
    else ev=S.step(G);
    play(ev);
  }
  function next(){
    if(D.busy||rc.over) return;
    if(rc.phase==="gate"){ return; }                                 /* the harness drops the gate itself (D.start) */
    var nb=rc.battle+1, under=rc.phase==="war"||Object.keys(rc.pick||{}).length>0;
    if(!under&&D.lapReady<nb) return;                                 /* real time: a lap's cards turn when the leader starts that lap (onLap) */
    var need=RC.need(rc);
    if(need.length){ later(function(){ act("flipAll"); },0.22); D.busy=true; return; }   /* the person is on Auto */
    D.busy=true; later(function(){ D.busy=false; act("step"); },rc.phase==="war"?0.9:0);
  }
  D.start=function(){ if(D.started) return; D.started=true; D.busy=false; act("drop"); };
  /* the view's hooks.onLap(n): the leader starts lap n */
  D.onLap=function(n){
    if(rc.over) return;
    D.lapReady=n;
    if(D.yellowNext&&D.yellowNext.lap===n) V.yellowAt(D.yellowNext.sector); else V.yellowOff();
    if(n===rc.o.len&&n>1) V.setFlag("white");
    next();
  };
  D.onFinish=function(){ log("view: finished"); };
  return D;
}

MX.DemoEngine={setup:setup,viewRace:viewRace,drive:drive,DEF_WAR:DEF_WAR};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.DemoEngine;
})(typeof window!=="undefined"?window:globalThis);
