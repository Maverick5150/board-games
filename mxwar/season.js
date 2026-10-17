/* MOTOCROSS WAR — the season: every round of the chosen year in calendar order, every race a game of War. Pure, no DOM.
   Node: module.exports = MXWar.Season (requires race.js and round.js); browser: window.MXWar.Season (load race.js, round.js first).
   newSeason(season, index, opts, humans, seed): season = one packed season (mxwar/data/<series>-<year>.js), index = mxwar/data/index.js
   (the formats). The formats this season needs are COPIED into G, and every round's entry list too, so a save is self-contained.
   Riders: the season's real premier-class riders (their real number when the research has it; otherwise a GENERATED plate, flagged
   plateGen, never shown as the real one), the human rider(s) (their own name, number and bike; hot seat on one device, later every Party
   phone), and, only when a race needs more riders than the season's documented roster, clearly labelled privateers (kind "privateer",
   generated names; never presented as real people).
   A round's night: the riders listed in that round's real results first, then the rest of the roster (most starts first), then privateers;
   the human riders always ride and take the place of the last real rider. The seed order (standings points, then the real final position)
   splits the heats, as qualifying does.
   Championship standings: points (the era's table), then wins, then the most 2nds, 3rds ... (the AMA's tie-break), then the better finish
   at the most recent round, then the real final position, then the id: every rider their own place 1..N (the CEO's rule).
   Flow: next(G) says what is next; startRace(G) builds the race (phase "gate"); apply(G, {t:"drop"} | {t:"flip", s}) for a human; step(G)
   for the next phase (computers / auto); simRace(G) runs a whole race (a race the page doesn't show). A finished race is recorded at once;
   a finished round is scored at once; the page saves G after every race (G is plain JSON: Save + Continue resume it exactly, mid-race too).
   snapshot(G, seat): seat = the human rider index (-1 = the TV). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Season) return;
var Race=MX.Race||(typeof require==="function"?require("./race.js"):null);
var Round=MX.Round||(typeof require==="function"?require("./round.js"):null);
var VER=1, MAXH=8;

function rnd(G){ var t=(G.rs=(G.rs+0x6D2B79F5)>>>0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function rint(G,n){ return Math.floor(rnd(G)*n); }
function clone(x){ return JSON.parse(JSON.stringify(x)); }

function defaultOpts(){
  return {
    length:"standard",   // short | standard | long (round.js LEN, v2: heat 15/30/50, semi + LCQ 12/25/40, Main 40/80/150, moto 30/60/100 laps)
    len:{},              // per race kind overrides {heat, semi, lcq, main, moto}
    war:{},              // race.js options (Version, House rows, cards per rider, Real form)
    fill:"full",         // full: the era's full program (privateers fill a short roster) | roster: smaller races, real riders only
    nonTitle:true,       // play the rounds that paid no points (1974 Coliseum, 1976 Anaheim) as exhibition rounds
    skill:"normal"       // the brains' skill (War has no decisions: it shapes their pace and talk, not the cards; brain.js)
  };
}
function normalize(o){
  var d=defaultOpts(), k; o=o||{};
  for(k in d) if(o[k]!==undefined) d[k]=o[k];
  if(!Round.LEN[d.length]) d.length="standard";
  d.len=(d.len&&typeof d.len==="object")?clone(d.len):{};
  d.war=Race.mergeOpts(d.war||{}); delete d.war.len;
  d.fill=d.fill==="roster"?"roster":"full";
  d.nonTitle=d.nonTitle!==false;
  d.skill=["easy","normal","hard"].indexOf(d.skill)>=0?d.skill:"normal";
  return d;
}

/* privateers: generated, labelled. Plain first names + common surnames (no real rider is chosen on purpose; a clash with the season's
   roster is skipped) */
var PF="Alex|Ben|Brody|Caleb|Carter|Cody|Colton|Dalton|Derek|Dylan|Evan|Garrett|Hayden|Jace|Jared|Jesse|Josh|Kade|Kyle|Landon|Logan|Luke|Mason|Nate|Owen|Parker|Reid|Ryder|Seth|Shane|Travis|Tyler|Wade|Wyatt|Zane".split("|");
var PL="Abbott|Barnes|Bennett|Brooks|Carver|Dawson|Ellis|Fowler|Grant|Hale|Hayes|Holt|Keller|Lane|Mercer|Monroe|Nolan|Parsons|Pierce|Quinn|Rhodes|Sawyer|Shaw|Sutton|Talbot|Vance|Walsh|Warren|Wells|Yates".split("|");
var MAKES=["Honda","Yamaha","Kawasaki","Suzuki","KTM","Husqvarna","GasGas"];

/* ---------------- a new season ---------------- */
function newSeason(season,index,opts,humans,seed){
  if(!season||!season.rounds||!season.riders) throw new Error("No season data.");
  humans=(humans||[]).slice(0,MAXH);
  var o=normalize(opts);
  var G={v:VER,id:"mxwar",sid:season.id,series:season.series,seriesName:season.seriesName,year:season.year,cls:season.cls,name:season.name,
    fmt:season.format,status:season.status,o:o,rs:(seed==null?Math.floor(Math.random()*4294967296):seed)>>>0,
    riders:{},roster:[],humans:[],priv:[],formats:{},cal:[],ri:0,round:null,race:null,rmap:null,rkey:null,
    results:[],pts:{},st:{},last:null,over:false,log:[],ai:{}};
  var used={}, i, holder={};
  /* v2 (the CEO ~18:25): every rider of the season has their OWN number. The packer gives every rider a number (the real one where a
     source has it; a free one marked ns "a" = assigned, never shown as historical, where none does); a clash left in the data keeps the
     first rider's number and gives the next a free one (plateGen). */
  season.riders.forEach(function(r,k){ if(r.num!=null&&r.ns!=="a"&&!used[r.num]){ used[r.num]=1; holder[r.num]=k; } });
  /* review fix: an ASSIGNED number (ns "a": no source gives that rider one) is not history, so a person may take it; its rider gets
     another free number below. The assigned numbers are held after the people's picks. */
  var hnum={}; humans.forEach(function(h){ var n=Math.floor(+(h&&h.num)); if(n>=0&&n<=999) hnum[n]=1; });
  season.riders.forEach(function(r,k){ if(r.num!=null&&r.ns==="a"&&!used[r.num]&&!hnum[r.num]){ used[r.num]=1; holder[r.num]=k; } });
  /* the human riders */
  var hn={};
  humans.forEach(function(h,k){
    var name=String((h&&h.name)||("Rider "+(k+1))).trim().slice(0,24)||("Rider "+(k+1)), base=name, j=2;
    while(hn[name.toLowerCase()]) name=base+" "+(j++);
    hn[name.toLowerCase()]=1;
    var num=Math.floor(+(h&&h.num)); if(!(num>=0&&num<=999)) num=null;
    var id="h"+k;
    G.riders[id]={id:id,name:name,kind:"human",seat:k,plate:num,plateGen:num==null,bike:(h&&h.bike)?String(h.bike).slice(0,20):null,country:null,pos:null};
    G.humans.push(id);
  });
  /* a person's number must be free that season (the setup refuses a taken one, with who holds it); a clash that still gets here (an old
     setting, two people typing the same number) rides a free number instead */
  humans.forEach(function(h,k){ var r=G.riders["h"+k]; if(r.plate!=null&&used[r.plate]){ r.wanted=r.plate; r.plate=null; } if(r.plate==null){ r.plate=plate(G,used); r.plateGen=true; } used[r.plate]=1; });
  /* the real riders */
  season.riders.forEach(function(r,k){
    var id="r"+k, form=r.pos!=null&&r.pos<=5?2:r.pos!=null&&r.pos<=10?1:0;
    var own=r.num!=null&&holder[r.num]===k;
    G.riders[id]={id:id,name:r.name,kind:"pro",plate:own?r.num:null,plateGen:!own||r.ns==="a",ns:own?(r.ns||"s"):"a",bike:r.bike||"Privateer",country:r.country,pos:r.pos,realPts:r.pts,realWins:r.wins,starts:r.starts,edge:form,seed:r.seed||null};
    if(r.num!=null&&!own&&r.ns!=="a") G.riders[id].realNum=r.num;
    G.roster.push(id);
  });
  G.roster.forEach(function(id){ var r=G.riders[id]; if(r.plate==null){ r.plate=plate(G,used); used[r.plate]=1; } });
  /* the calendar (and its formats) */
  var fm=index&&index.formats||{};
  function need(id){ if(!fm[id]) throw new Error("Unknown format "+id); G.formats[id]=clone(fm[id]); }
  need(season.format);
  season.rounds.forEach(function(r){
    if(!r.title&&!o.nonTitle) return;
    if(r.format) need(r.format);
    G.cal.push({n:r.n,date:r.date,city:r.city,state:r.state,country:r.country,venue:r.venue,name:r.name,stage:r.stage||null,title:!!r.title,tc:!!r.tc,mult:r.mult||1,motos:r.motos||null,format:r.format||null,winner:r.winner||null,
      entry:(r.entry||[]).map(function(k){ return "r"+k; })});
  });
  if(!G.cal.length) throw new Error("No rounds to race.");
  /* SMX: the 20 seeds start from the seed points (seed 1 = 25 ... seed 20 = 1); the human riders take the last seeds (20, 19 ...) and the
     real riders they displace race the LCQ */
  var F0=G.formats[G.fmt]; G.base={};
  if(F0.direct&&F0.seedPoints){
    var seeds=G.roster.filter(function(id){ return G.riders[id].seed; }).sort(function(a,b){ return G.riders[a].seed-G.riders[b].seed; }).slice(0,F0.direct);
    var keep=Math.max(0,F0.direct-G.humans.length);
    seeds.slice(keep).forEach(function(id){ G.riders[id].seed=null; });
    seeds=seeds.slice(0,keep).concat(G.humans.slice(0,F0.direct-keep));
    seeds.forEach(function(id,k){ G.riders[id].seed=k+1; var p=F0.seedPoints[k]|0; if(p){ G.base[id]=p; G.pts[id]=p; } });
  }
  log(G,G.year+" "+G.seriesName+" ("+G.cls+"): "+G.cal.length+" rounds, "+G.roster.length+" riders.","season");
  return G;
}
function plate(G,used){ for(var k=0;k<500;k++){ var n=2+rint(G,998); if(!used[n]) return n; } for(n=2;n<1000;n++) if(!used[n]) return n; return 999; }
function log(G,t,k){ G.log.push({t:t,k:k||""}); if(G.log.length>60) G.log.splice(0,G.log.length-60); }
function rider(G,id){ return G.riders[id]; }
var NOST={races:0,finals:0,wins:0,hs:0,hsAll:0,pod:0,best:0,rounds:0,pl:{}};
function stRead(G,id){ return G.st[id]||NOST; }   // read-only: a standings read never changes G
function stOf(G,id){ return G.st[id]||(G.st[id]={races:0,finals:0,wins:0,hs:0,hsAll:0,pod:0,best:0,rounds:0,pl:{}}); }
function privateer(G){
  var taken={}, id, k;
  for(id in G.riders) taken[G.riders[id].name.toLowerCase()]=1;
  for(k=0;k<400;k++){ var nm=PF[rint(G,PF.length)]+" "+PL[rint(G,PL.length)]; if(!taken[nm.toLowerCase()]) break; }
  if(taken[nm.toLowerCase()]) nm="Privateer "+(G.priv.length+1);
  var used={}; for(id in G.riders) used[G.riders[id].plate]=1;
  id="p"+G.priv.length;
  G.riders[id]={id:id,name:nm,kind:"privateer",plate:plate(G,used),plateGen:true,bike:MAKES[rint(G,MAKES.length)],country:null,pos:null};
  G.priv.push(id); return id;
}

/* ---------------- a round ---------------- */
function calFormat(G,cal){ return Round.formatFor({formats:G.formats},G.fmt,cal); }
function startRound(G){
  var cal=G.cal[G.ri], F=calFormat(G,cal), full=Round.fieldSize(F), H=G.humans.length;
  /* candidates: this round's real riders, then the roster (most starts, then the real final position), then privateers */
  var seen={}, cand=[];
  cal.entry.forEach(function(id){ if(!seen[id]){ seen[id]=1; cand.push(id); } });
  var rest=G.roster.filter(function(id){ return !seen[id]; });
  rest.sort(function(a,b){ var A=G.riders[a], B=G.riders[b]; return (B.starts|0)-(A.starts|0)||posKey(A)-posKey(B)||G.roster.indexOf(a)-G.roster.indexOf(b); });
  cand=cand.concat(rest);
  var field=full;
  if(G.o.fill==="roster") field=Math.max(Math.min(full,cand.length+H),Math.min(full,Math.max(2,H+2)));
  field=Math.max(field,2);
  var entry, pk=0;
  if(F.direct){
    /* SMX: the seeds first (seed order: they ride straight into the motos), then the LCQ riders */
    var sd=G.humans.concat(G.roster).filter(function(id){ return G.riders[id].seed; }).sort(function(a,b){ return G.riders[a].seed-G.riders[b].seed; });
    entry=sd.concat(cand.filter(function(id){ return !G.riders[id].seed; }).slice(0,Math.max(0,field-sd.length)));
    while(entry.length<field){ entry.push(G.priv[pk]||privateer(G)); pk++; }
  } else {
    var nReal=Math.max(0,field-H); entry=G.humans.concat(cand.slice(0,nReal));
    while(entry.length<field){ entry.push(G.priv[pk]||privateer(G)); pk++; }
    /* the seed order: championship points, then the real final position (a human seeds as 20th), then the list order */
    var idx={}; entry.forEach(function(id,k){ idx[id]=k; });
    entry.sort(function(a,b){ return (G.pts[b]||0)-(G.pts[a]||0)||seedPos(G,a)-seedPos(G,b)||idx[a]-idx[b]; });
  }
  var team={}; entry.forEach(function(id){ team[id]=G.riders[id].bike||"Privateer"; });
  G.round=Round.newRound(F,G.ri,entry,G.o,team);
  log(G,"Round "+(G.ri+1)+": "+(cal.city||cal.venue)+(cal.title?"":" (no points)")+".","round");
  return G.round;
}
function posKey(r){ return r.pos!=null?r.pos:500; }
function seedPos(G,id){ var r=G.riders[id]; return r.kind==="human"?20:r.kind==="privateer"?600:posKey(r); }

/* what comes next: {t:"race", ...} | {t:"over"} */
function next(G){
  if(G.over) return {t:"over"};
  var cal=G.cal[G.ri], RG=G.round, r, ent;
  if(G.race) return {t:"race",live:true,ri:G.ri,round:cal,key:G.rkey,label:raceLabel(G),kind:G.race.kind,len:G.race.o.len,n:G.race.n,humanIn:G.rmap.some(isHuman.bind(null,G))};
  if(!RG){ var F=calFormat(G,cal), L=Round.lengths(G.o); r=F.qual.length?{label:F.qual[0].label+(F.qual[0].races>1?" 1":""),kind:F.qual[0].kind,len:L[F.qual[0].kind]}:{label:F.finals.races>1?F.finals.label+" 1":F.finals.label,kind:F.finals.kind,len:Math.round(L[F.finals.kind]*(F.finals.lenF||1))}; return {t:"race",live:false,ri:G.ri,round:cal,key:null,label:r.label,kind:r.kind,len:r.len,n:null,humanIn:true,newRound:true}; }
  r=Round.current(RG); ent=Round.entrants(RG)||[];
  return {t:"race",live:false,ri:G.ri,round:cal,key:r.key,label:r.label,kind:r.kind,len:r.len,n:ent.length,humanIn:ent.some(isHuman.bind(null,G))};
}
function isHuman(G,id){ return G.riders[id]&&G.riders[id].kind==="human"; }
function raceLabel(G){ var RG=G.round; if(!RG) return ""; var r=RG.races.filter(function(x){ return x.key===G.rkey; })[0]; return r?r.label:""; }

/* ---------------- a race ---------------- */
function startRace(G){
  if(G.over) return [];
  if(G.race) return [];
  if(!G.round) startRound(G);
  var RG=G.round, r=Round.current(RG), ent=Round.entrants(RG);
  var o=clone(G.o.war); o.len=r.len;
  var list=ent.map(function(id){ var R=G.riders[id]; return {id:id,name:R.name,human:R.kind==="human",edge:R.edge|0}; });
  G.race=Race.newRace(o,list,Math.floor(rnd(G)*4294967296));
  G.race.kind=r.kind; G.rmap=ent.slice(); G.rkey=r.key;
  var cal=G.cal[G.ri];
  log(G,(cal.city||cal.venue)+" "+r.label+": "+ent.length+" riders, "+r.len+" laps.","race");
  return [{e:"race",ri:G.ri,key:r.key,label:r.label,kind:r.kind,n:ent.length,len:r.len,riders:ent.slice()}];
}
function fail(msg){ return {ok:false,msg:msg,ev:[]}; }
function apply(G,m){
  if(!G||G.over) return fail("The season is over.");
  if(!G.race) return fail("No race is running.");
  var res=Race.apply(G.race,m);
  if(res.ok&&G.race.over) res.ev=res.ev.concat(endRace(G));
  return res;
}
function step(G){
  if(!G||G.over) return [];
  if(!G.race) return startRace(G);
  var ev=Race.step(G.race);
  if(G.race.over) ev=ev.concat(endRace(G));
  return ev;
}
/* run the current (or next) race to the flag at once (a race the page skips, sims, tests) */
function simRace(G){
  var ev=[]; if(!G||G.over) return ev;
  if(!G.race) ev=ev.concat(startRace(G));
  Race.run(G.race);
  return ev.concat(endRace(G));
}
function endRace(G){
  var R=G.race, RG=G.round, r=Round.current(RG), ev=[];
  var order=R.res.slice(), hs=R.hs>=0?R.r[R.hs].id:null, fin=r.st<0;
  /* crashes (CRASH-CONTRACT.md): who went down (remounts and outs) and who did not finish; a save from before crashes has none */
  var dnf={}, cr={};
  R.r.forEach(function(p){ if(p.dnf) dnf[p.id]={lap:p.dnf.lap,why:p.dnf.why}; if(p.crashes) cr[p.id]=p.crashes; });
  var tr=Round.record(RG,order,hs,R.why,dnf);
  order.forEach(function(id,p){ var s=stOf(G,id); s.races++; if(fin){ s.finals++; } if(cr[id]) s.crashes=(s.crashes|0)+cr[id]; if(dnf[id]&&dnf[id].why==="crash") s.dnfs=(s.dnfs|0)+1; });
  if(hs!=null){ var sh=stOf(G,hs); sh.hsAll++; if(fin) sh.hs++; }
  G.last={ri:G.ri,key:r.key,label:r.label,kind:r.kind,order:order,hs:hs,why:R.why,battles:R.battle,len:R.o.len,wars:R.wars,toMain:tr.toMain,toNext:tr.toNext,out:tr.out,dnf:dnf,crashes:cr};
  var cal=G.cal[G.ri];
  log(G,(cal.city||cal.venue)+" "+r.label+": "+G.riders[order[0]].name+" wins"+(hs!=null?" (holeshot "+G.riders[hs].name+")":"")+".","race");
  ev.push({e:"raceDone",ri:G.ri,key:r.key,label:r.label,kind:r.kind,order:order,hs:hs,why:R.why,toMain:tr.toMain,toNext:tr.toNext,out:tr.out,walkover:tr.walkover||null,dnf:dnf,crashes:cr});
  G.race=null; G.rmap=null; G.rkey=null;
  if(RG.done) ev=ev.concat(endRound(G));
  return ev;
}
function endRound(G){
  var RG=G.round, cal=G.cal[G.ri], sc=Round.score(RG,cal.title), ev=[], id;
  if(cal.mult>1) for(id in sc.pts) sc.pts[id]*=cal.mult;   // SMX: Playoff 2 pays double, the Final triple
  sc.cls.forEach(function(id,p){
    var s=stOf(G,id); s.rounds++;
    if(sc.pts[id]) G.pts[id]=(G.pts[id]||0)+sc.pts[id];
    if(sc.wins[id]) s.wins+=sc.wins[id];
    (sc.places[id]||[]).forEach(function(pl){ s.pl[pl]=(s.pl[pl]||0)+1; });
    if(p<3&&sc.main.indexOf(id)>=0) s.pod++;
    if(sc.main.indexOf(id)>=0&&(!s.best||p+1<s.best)) s.best=p+1;
  });
  var pts={}; for(id in sc.pts) if(sc.pts[id]) pts[id]=sc.pts[id];
  G.results.push({ri:G.ri,n:cal.n,city:cal.city,venue:cal.venue,date:cal.date,title:cal.title,tc:RG.tc,fmt:RG.fmt,winner:sc.winner,cls:sc.cls,pts:pts,wins:sc.wins,hs:sc.hs,main:sc.main,
    races:RG.races.map(function(r){ return {key:r.key,label:r.label,kind:r.kind,res:r.res,hs:r.hs,why:r.why,len:r.len}; })});
  log(G,"Round "+(G.ri+1)+" "+(cal.city||cal.venue)+": "+G.riders[sc.winner].name+" wins the night.","round");
  ev.push({e:"roundDone",ri:G.ri,winner:sc.winner,cls:sc.cls,pts:pts});
  G.round=null; G.ri++;
  if(G.ri>=G.cal.length){
    G.over=true; var L=standings(G);
    log(G,G.riders[L[0].id].name+" is the "+G.year+" champion.","champion");
    ev.push({e:"seasonOver",champion:L[0].id,standings:L.map(function(x){ return x.id; })});
  }
  return ev;
}

/* ---------------- championship standings: every rider their own place ---------------- */
function lastCmp(G,a,b){
  for(var k=G.results.length-1;k>=0;k--){
    var c=G.results[k].cls, ia=c.indexOf(a), ib=c.indexOf(b);
    if(ia<0&&ib<0) continue;
    if(ia<0) return 1; if(ib<0) return -1;
    return ia-ib;
  }
  return 0;
}
function standings(G){
  var ids=[], id;
  for(id in G.st) if(G.st[id].rounds>0||G.st[id].races>0) ids.push(id);
  for(id in G.pts) if(ids.indexOf(id)<0) ids.push(id);
  G.humans.forEach(function(h){ if(ids.indexOf(h)<0) ids.push(h); });
  ids.sort(function(a,b){
    var d=(G.pts[b]||0)-(G.pts[a]||0); if(d) return d;
    var A=stRead(G,a), B=stRead(G,b);
    if(A.wins!==B.wins) return B.wins-A.wins;
    for(var p=1;p<=40;p++){ var x=(A.pl[p]||0)-(B.pl[p]||0); if(x) return -x; }
    d=lastCmp(G,a,b); if(d) return d;
    d=posKey(G.riders[a])-posKey(G.riders[b]); if(d) return d;
    return a<b?-1:a>b?1:0;
  });
  var top=ids.length?(G.pts[ids[0]]||0):0;
  return ids.map(function(id,i){ var R=G.riders[id], s=stRead(G,id); return {place:i+1,id:id,name:R.name,plate:R.plate,plateGen:R.plateGen,bike:R.bike,kind:R.kind,human:R.kind==="human",pts:G.pts[id]||0,gap:top-(G.pts[id]||0),wins:s.wins,hs:s.hs,pod:s.pod,rounds:s.rounds,best:s.best||null}; });
}

/* ---------------- the red plate (the CEO v2: "The points leader should have the red plate"): the championship points leader, by the
   standings' own tie-break (points, wins, 2nds ...); nobody before the first points are scored. It moves after every round (the Main, or
   the round's motos). ---------------- */
function redPlate(G){ if(!G) return null; var L=standings(G); return L.length&&L[0].pts>0?L[0].id:null; }

/* ---------------- seats: human rider index <-> race seat ---------------- */
function raceSeat(G,id){ return G.rmap?G.rmap.indexOf(id):-1; }
function humanSeats(G){ return G.humans.map(function(id){ return raceSeat(G,id); }); }

/* ---------------- snapshot (Party phones; -1 = the TV) ---------------- */
function snapshot(G,seat){
  var me=seat>=0?G.humans[seat]:null, rs=me?raceSeat(G,me):-1, L=standings(G);
  var riders={}; function add(id){ if(id&&!riders[id]){ var R=G.riders[id]; riders[id]={id:id,name:R.name,plate:R.plate,plateGen:R.plateGen,ns:R.ns||null,bike:R.bike,country:R.country,kind:R.kind}; } }
  if(G.rmap) G.rmap.forEach(add); L.forEach(function(r){ add(r.id); });
  var RG=G.round;
  return {v:G.v,id:"mxwar",sid:G.sid,name:G.name,series:G.series,seriesName:G.seriesName,year:G.year,cls:G.cls,status:G.status,o:G.o,me:seat,meId:me,
    cal:G.cal.map(function(c,i){ return {n:c.n,date:c.date,city:c.city,state:c.state,country:c.country,venue:c.venue,name:c.name,stage:c.stage,mult:c.mult,title:c.title,tc:c.tc,done:i<G.ri,next:i===G.ri,winner:G.results[i]?G.results[i].winner:null}; }),
    ri:G.ri,next:next(G),base:G.base||{},
    round:RG?{fmt:RG.fmt,tc:RG.tc,cur:RG.cur,races:RG.races.map(function(r){ return {key:r.key,label:r.label,kind:r.kind,len:r.len,done:!!r.res,res:r.res,hs:r.hs,n:(r.st<0?RG.fin:r.ent)?(r.st<0?RG.fin:r.ent).length:null}; })}:null,
    race:G.race?Race.snapshot(G.race,rs):null,rmap:G.rmap?G.rmap.slice():null,raceSeat:rs,
    standings:L,red:L.length&&L[0].pts>0?L[0].id:null,riders:riders,last:G.last,over:G.over,log:G.log.slice(-8).map(function(e){ return e.t; })};
}

/* ---------------- invariants: [] = fine ---------------- */
function check(G){
  var err=[], id, k;
  if(G.race){ Race.check(G.race).forEach(function(e){ err.push("race: "+e); }); if(!G.rmap||G.rmap.length!==G.race.n) err.push("rmap"); }
  var sum={}; for(id in (G.base||{})) sum[id]=G.base[id];
  G.results.forEach(function(r,i){
    var u={}; r.cls.forEach(function(x){ if(u[x]) err.push("round "+i+": "+x+" twice"); u[x]=1; if(!G.riders[x]) err.push("round "+i+": unknown "+x); });
    for(var x in r.pts) sum[x]=(sum[x]||0)+r.pts[x];
    if(!r.title&&Object.keys(r.pts).length) err.push("round "+i+": points in a non-title round");
  });
  for(id in G.pts) if((sum[id]||0)!==G.pts[id]) err.push("points of "+id+" "+G.pts[id]+" != "+(sum[id]||0));
  var L=standings(G), seen={};
  L.forEach(function(r,i){ if(r.place!==i+1) err.push("place"); if(seen[r.id]) err.push("standings twice "+r.id); seen[r.id]=1; if(i&&r.pts>L[i-1].pts) err.push("standings not sorted"); });
  if(G.ri>G.cal.length) err.push("ri");
  if(G.over&&(G.round||G.race)) err.push("over with a round");
  if(G.round){ var RG=G.round, ent=RG.entry, u2={}; ent.forEach(function(x){ if(u2[x]) err.push("entry twice "+x); u2[x]=1; }); G.humans.forEach(function(h){ if(!u2[h]) err.push("human not in the round "+h); }); }
  for(k=0;k<G.humans.length;k++) if(!G.riders[G.humans[k]]||G.riders[G.humans[k]].kind!=="human") err.push("human "+k);
  return err;
}

MX.Season={VER:VER,MAXH:MAXH,defaultOpts:defaultOpts,normalize:normalize,newSeason:newSeason,next:next,startRound:startRound,startRace:startRace,apply:apply,step:step,simRace:simRace,
  standings:standings,redPlate:redPlate,snapshot:snapshot,check:check,raceSeat:raceSeat,humanSeats:humanSeats,rider:rider,calFormat:calFormat};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Season;
})(typeof window!=="undefined"?window:globalThis);
