/* MOTOCROSS WAR — one round (one city / one track): the era's race program. Pure, no DOM. Node: module.exports = MXWar.Round.
   A format (mxwar/data/index.js, normalized by BG_audit/sprint/mxbuild/pack.js from the research) is a list of qualifying STAGES and the
   FINALS:
     stage  {kind: heat|semi|lcq, label, races, size (riders a race), toMain (per race), toNext (per race: a number or "rest")}
     finals {kind: main|moto, label, races (1 Main; 2 motos; 3 Triple Crown mains; 2 mains in 1985; 3 motos in 1974-76), size, lenF}
   Supercross: Heat 1 + Heat 2 (the night's entry split odd / even by the seed order, as qualifying splits them), the top N of each heat to the
   Main, the next riders to the semis or straight to the LCQ, the LCQ's top N to the Main, then the Main Event. Older eras: four heats,
   semis, a Last Chance; 1974-76 three motos. Motocross: two motos with the full gate, the round overall by combined points (a tie goes to
   the better finish in the second moto), or by the moto places (Olympic) in the early years.
   Riders who move on to the next stage or the Main are taken in finishing order; the next stage's riders are interleaved by finishing
   place across its feeder races (1st of Heat 1, 1st of Heat 2, 2nd of Heat 1 ...) and split over its races the same way. A short program
   (fewer riders than the Main needs) fills the Main from the best non-qualifiers of the last stage.
   The round classification gives every rider of the night their own place 1..N: the finals' overall first, then the riders knocked out in
   the last stage, then the stage before (by finishing place, then race), as a results sheet lists them.
   Championship points: pointsOn "race" = every final race pays the era's table (a Main; each moto); "overall" = the round overall pays it
   (1972-75 MX, 1974-76 / 1985 SX, Triple Crown). A non-title round (titleRound false in the research) pays no points.
   RG (the round state) is plain JSON and lives in the season's G. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Round) return;
/* race lengths in battles = LAPS (one battle is one lap). The CEO, v2 (2026-10-16 ~18:30): "The rounds are way too short. The races are way
   too short. They need to be extended." Standard = Heat 30 / Semi 25 / LCQ 25 / Main 80 / Moto 60 (each), Short = Heat 15 / Semi 12 / LCQ 12 /
   Main 40 / Moto 30, Long = Heat 50 / Semi 40 / LCQ 40 / Main 150 / Moto 100 (a semi as long as the LCQ); wars play out in full and do not count
   extra. (v1, ~16:55: Short 10/8/8/25/20, Standard 15/12/12/40/30, Long 20/15/15/60/40.) A season saved with v1 lengths races its next race
   at the new lengths; a race already under way keeps its own. */
var LEN={short:{heat:15,semi:12,lcq:12,main:40,moto:30},standard:{heat:30,semi:25,lcq:25,main:80,moto:60},long:{heat:50,semi:40,lcq:40,main:150,moto:100}};
/* mxlaps (the CEO, 2026-10-16 ~21:10, with a search answer: "An average lap takes roughly 1 to 2 minutes in an outdoor motocross race and
   about 50 seconds to 1 minute in a stadium Supercross race." "Fix it"): REAL LAP TIMES and REAL RACE LENGTHS replace the battle counts above
   (LEN stays only as the record of the v1 / v2 lengths that old saves were made with).
   - MODES: "real" (the default: the year's real race length) and "half" (half the race time, or half the laps; still real lap speed).
     Old saves: short -> half, standard / long -> real (MODE_OF).
   - A race is either timed (min minutes + plus laps: the clock runs out, the leader finishes the lap he is on, then the extra laps) or a lap
     count (laps). Laps of a timed race = floor(minutes x 60 / the track's lap time) + plus (a 20 min + 1 lap Main on a 55 s track = 22
     laps; a heat of 6 min + 1 lap = 7; a moto of 30 min + 2 laps on a 2:05 track = 16).
   - REAL: by format id (BG_audit/games/mxwar/data/formats*.json); "inf" = not documented for that era, so the nearest documented era's
     length. Supercross: 2016 heats 6 laps / semis 5 / LCQ about 4 / Main 20 laps; 2017 timed for the first time (heats 5 min + 1, semis
     4 + 1, LCQ 3 + 1, Main 20 + 1); 2018-2026 heats 6 + 1, LCQ 5 + 1, Main 20 + 1, Triple Crown mains 2018 8 / 12 / 15 + 1, 2019
     8 / 12 / 12 + 1, 2020 on 12 + 1 each; 2001-2006 heats 8 laps, semis 6, Main 20 laps (the 2003 heat sheet); the 20-lap Main back to
     1977 (1983 / 1984 sources; the 1977 Last Chance 15 laps; 1983 semis 10 laps; 1985 two 10-lap mains). Motocross: two motos of 30 min
     + 2 laps (Racer X 2008; the same rule assumed for the years before it: the research found no older length); SMX playoff motos
     20 min + 1 lap. */
var MODE_OF={real:"real",half:"half",short:"half",standard:"real",long:"real"};
function T(min,plus,st){ return {min:min,plus:plus,st:st||"doc"}; }
function N(laps,st){ return {laps:laps,st:st||"doc"}; }
var OLD_SX={heat:N(8,"inf"),semi:N(6,"inf"),lcq:N(6,"inf"),main:N(20)};
var REAL={
  "sx-1974":{moto:N(10,"inf")},"sx-1975":{moto:N(10,"inf")},"sx-1976":{moto:N(10,"inf")},
  "sx-1977":{heat:N(8,"inf"),semi:N(6,"inf"),lcq:N(15),main:N(20)},
  "sx-1983":{heat:N(8,"inf"),semi:N(10),lcq:N(6,"inf"),main:N(20)},
  "sx-1984":OLD_SX,"sx-1985":{heat:N(8,"inf"),semi:N(6,"inf"),lcq:N(6,"inf"),main:N(10)},
  "sx-1986-2000":OLD_SX,
  "sx-2001-2006":{heat:N(8),semi:N(6),lcq:N(6,"inf"),main:N(20)},
  "sx-2007-2013":{heat:N(8,"inf"),lcq:N(6,"inf"),main:N(20)},
  "sx-2014-2015":OLD_SX,
  "sx-2016":{heat:N(6),semi:N(5),lcq:N(4),main:N(20)},
  "sx-2017":{heat:T(5,1),semi:T(4,1),lcq:T(3,1),main:T(20,1)},
  "sx-2018-2023":{heat:T(6,1),lcq:T(5,1),main:T(20,1),qual:T(6,1,"inf")},
  "sx-2024-2026":{heat:T(6,1),lcq:T(5,1),main:T(20,1),qual:T(6,1,"inf")},
  "daytona-40":{main:N(20,"inf")},
  "smx-2023-2026":{lcq:T(5,1,"inf"),moto:T(20,1)}
};
var DEF={heat:T(6,1,"inf"),semi:T(5,1,"inf"),lcq:T(5,1,"inf"),qual:T(6,1,"inf"),main:T(20,1,"inf"),moto:T(30,2)};
/* the Triple Crown mains by year (formats.json lengths450) */
function tcMain(year,i){ var m=year&&year<=2018?[8,12,15]:year===2019?[8,12,12]:[12,12,12];   /* no year given: today's 12 + 1 each */ return T(m[Math.min(i,2)]||12,1); }
function realSpec(F,kind,i,year){
  if(F&&F.isTC&&kind==="main") return tcMain(year|0,i|0);
  var R=F&&REAL[F.id];
  if(!R&&F&&/^mx-/.test(F.id)) return DEF.moto;
  return (R&&R[kind])||DEF[kind]||DEF.heat;
}
/* a track's lap time in seconds. Supercross (and the stadium SMX nights): 53-59 s (60 at most), every venue its own (a stable hash of the venue
   and city; the 1970s-80s tracks a little longer); outdoor nationals 1:45-2:15 by track; a track with a traced length (track-layouts.json:
   RedBud 1898 m) from that length at an outdoor pace of 15.2 m/s (55 km/h): 2:05. Each round keeps its lap time (RG.lapS). */
var TRACED={redbud:1898};
function hash(s){ var h=2166136261>>>0; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
function lapTime(series,year,cal){
  var key=((cal&&cal.venue)||"")+"|"+((cal&&cal.city)||""), u=(hash(key)%1000)/1000;
  if(series==="mx"){
    var low=key.toLowerCase().replace(/[^a-z]/g,"");
    for(var k in TRACED) if(low.indexOf(k)>=0) return Math.round(TRACED[k]/15.2);
    return Math.round(105+u*30);
  }
  var era=(year|0)&&year<1990?1.5:0;
  return Math.round(Math.min(60,53+u*6+era));
}
/* laps of one race: spec x mode at a lap time of lapS seconds */
function lapsFor(spec,mode,lapS){
  var half=MODE_OF[mode]==="half";
  if(spec.laps) return Math.max(2,half?Math.ceil(spec.laps/2):spec.laps);
  var sec=spec.min*60*(half?0.5:1);
  return Math.max(2,Math.floor(sec/Math.max(20,lapS||55))+spec.plus);
}
function raceLen(F,kind,i,o,lapS,year){
  var L=lapsFor(realSpec(F,kind,i,year),o&&o.length,lapS);
  if(o&&o.len&&+o.len[kind]>=1) L=Math.min(2000,Math.floor(+o.len[kind]));   /* a per-kind override (tests, Party) */
  return L;
}

function clone(x){ return JSON.parse(JSON.stringify(x)); }
/* the format for one round: the round's own override (1976 Anaheim, Daytona 1979-85), the Triple Crown night (formats.json: a 40-rider
   Qualifying race in place of timed qualifying, top 18 to the mains, the LCQ's top 4, three mains, Olympic overall, points once on the
   overall) and a round that ran fewer motos (SMX 2025 Playoff 1: one moto) */
function formatFor(index,fmtId,cal){
  var F=index.formats[(cal&&cal.format)||fmtId]; if(!F) throw new Error("Unknown race format "+((cal&&cal.format)||fmtId));
  F=clone(F);
  if(cal&&cal.tc&&F.tcProg){ F.qual=F.tcProg.qual; F.finals=F.tcProg.finals; F.overall=F.tcProg.overall; F.pointsOn=F.tcProg.pointsOn; F.direct=0; F.isTC=true; }
  if(cal&&cal.motos>=1&&cal.motos<F.finals.races){ F.finals.races=cal.motos; if(cal.motos===1) F.overall=null; }
  return F;
}
/* how many riders the night needs: the direct places (SMX seeds) + the first stage's races x size, or the finals' gate */
function fieldSize(F){ return (F.direct|0)+(F.qual.length?F.qual[0].races*F.qual[0].size:F.finals.size-(F.direct|0)); }
/* the laps of every race kind for a format at a lap time (the first race of each kind; a Triple Crown's mains differ: raceLen) */
function lengths(o,F,lapS,year){ var out={}, kinds=["heat","semi","lcq","qual","main","moto"]; lapS=lapS||(F&&/^mx-/.test(F.id)?120:55); kinds.forEach(function(k){ out[k]=raceLen(F||null,k,0,o,lapS,year); }); return out; }

/* ---------------- a new round ----------------
   entry: rider ids in SEED order (the season's standings / form); n = the night's field (fill === "roster" may make it smaller than the
   format's full program: the first stage's races keep their count and get smaller). */
function newRound(F,ri,entry,o,team,meta){
  meta=meta||{};
  var lapS=meta.lapS>0?Math.round(meta.lapS):lapTime(meta.series||(/^mx-/.test(F.id)?"mx":"sx"),meta.year,meta.cal);
  var RG={ri:ri,fmt:F.id,tc:!!F.isTC,F:F,entry:entry.slice(),races:[],cur:0,send:[],main:[],elim:[],fin:null,done:false,res:null,lapS:lapS,mode:MODE_OF[o&&o.length]||"real",year:meta.year|0};
  /* the CEO (~18:25): "at the start of the heat races, there has to be an equal amount of teams": team = {riderId: make} balances the
     first stage's races by team (season.js passes it; without it the plain odd / even seed split, as qualifying splits them) */
  if(team&&typeof team==="object"){ RG.team={}; entry.forEach(function(id){ RG.team[id]=String(team[id]||"Privateer"); }); }
  var st=F.qual.map(function(s){ return clone(s); }), dir=Math.min(F.direct|0,entry.length), rest=entry.slice(dir);
  /* SMX: the seeds ride straight into the finals (in seed order) */
  entry.slice(0,dir).forEach(function(id,k){ RG.main.push({id:id,pos:k+1,r:0,s:-1}); });
  if(st.length&&rest.length<st[0].races*st[0].size) st[0].size=Math.max(2,Math.ceil(rest.length/st[0].races));
  RG.st=st;
  st.forEach(function(s,si){
    for(var i=0;i<s.races;i++) RG.races.push({key:s.kind+(si+1)+"-"+(i+1),label:s.label+(s.races>1?" "+(i+1):""),kind:s.kind,st:si,i:i,len:raceLen(F,s.kind,i,o,lapS,RG.year),ent:null,res:null,hs:null,why:null});
    RG.send.push([]); RG.elim.push([]);
  });
  var f=F.finals;
  for(var i=0;i<f.races;i++){
    var lbl=f.races===1&&f.kind!=="moto"?f.label:(F.isTC?"Main "+(i+1):f.label+" "+(i+1));
    RG.races.push({key:"final-"+(i+1),label:lbl,kind:f.kind,st:-1,i:i,len:raceLen(F,f.kind,i,o,lapS,RG.year),ent:null,res:null,hs:null,why:null});
  }
  if(!st.length) RG.fin=entry.slice(0,f.size);
  else assign(RG,0,rest.slice(0,st[0].races*st[0].size));
  return RG;
}
/* split a pool over a stage's races: rider k of the pool goes to race k % races (the seed order alternates, as qualifying does) */
function assign(RG,si,pool){
  var s=RG.st[si], per=[], i;
  for(i=0;i<s.races;i++) per.push([]);
  if(si===0&&RG.team&&s.races>1){
    per=balanced(RG,pool,s.races);
    var at={}; pool.forEach(function(id,k){ at[id]=k; }); per.forEach(function(a){ a.sort(function(x,y){ return at[x]-at[y]; }); });   /* each race's gate order stays the seed order */
  }
  else pool.forEach(function(id,k){ per[k%s.races].push(id); });
  RG.races.forEach(function(r){ if(r.st===si) r.ent=per[r.i]; });
}
/* balanced by team (the CEO ~18:25): the teams in turn (the biggest first, then the team of the better seed), each team's riders in seed
   order; every rider goes to the race (with room left) that has the fewest of their team, then the fewest riders, then the weaker field
   so far (the higher sum of seed places): every team split as evenly as it can be (at most one apart), every race the same size (at most
   one apart); then (review fix) the riders are dealt in seed order within those team quotas, so the top seeds alternate over the races */
function balanced(RG,pool,races){
  var g={}, order=[], first={}, cap=Math.ceil(pool.length/races), per=[], tc=[], sum=[], i;
  for(i=0;i<races;i++){ per.push([]); tc.push({}); sum.push(0); }
  pool.forEach(function(id,k){ var t=RG.team[id]||"Privateer"; if(!g[t]){ g[t]=[]; order.push(t); first[t]=k; } g[t].push({id:id,k:k}); });
  order.sort(function(a,b){ return g[b].length-g[a].length||first[a]-first[b]; });
  order.forEach(function(t){ g[t].forEach(function(x){
    var best=-1;
    for(var r=0;r<races;r++){ if(per[r].length>=cap) continue;
      if(best<0) { best=r; continue; }
      var a=(tc[r][t]||0)-(tc[best][t]||0); if(a<0){ best=r; continue; } if(a>0) continue;
      var c=per[r].length-per[best].length; if(c<0){ best=r; continue; } if(c>0) continue;
      if(sum[r]>sum[best]) best=r; }
    per[best].push(x.id); tc[best][t]=(tc[best][t]||0)+1; sum[best]+=x.k+1;
  }); });
  /* review fix: the counts above are the team QUOTAS of each race; the riders are then dealt in seed order, each to the race (with quota
     left for their team) that has had the fewest riders dealt so far, then the weaker field (the higher sum of seed places): the top
     seeds alternate between the heats as qualifying would, and every team keeps its even split */
  var out=[], n2=[], s2=[];
  for(i=0;i<races;i++){ out.push([]); n2.push(0); s2.push(0); }
  pool.forEach(function(id,k){ var t=RG.team[id]||"Privateer", best=-1;
    for(var r=0;r<races;r++){ if(!(tc[r][t]>0)) continue;
      if(best<0||n2[r]<n2[best]||(n2[r]===n2[best]&&s2[r]>s2[best])) best=r; }
    out[best].push(id); tc[best][t]--; n2[best]++; s2[best]+=k+1; });
  return out;
}
/* how a stage's races share the teams: [{race label, n, teams:{make: count}}] (the heat line-up screen) */
function teamSplit(RG,si){
  var out=[]; RG.races.forEach(function(r){ if(r.st!==si||!r.ent) return; var t={}; r.ent.forEach(function(id){ var m=(RG.team&&RG.team[id])||"?"; t[m]=(t[m]||0)+1; }); out.push({key:r.key,label:r.label,n:r.ent.length,teams:t}); });
  return out;
}
/* interleave {id,pos,r} by finishing place, then race */
function interleave(list){ return list.slice().sort(function(a,b){ return a.pos-b.pos||a.r-b.r; }).map(function(x){ return x.id; }); }

function current(RG){ return RG.done?null:RG.races[RG.cur]; }
function entrants(RG,k){
  var r=RG.races[k==null?RG.cur:k]; if(!r) return null;
  if(r.st<0) return RG.fin?RG.fin.slice():null;
  return r.ent?r.ent.slice():null;
}
/* the result of the current race: order = rider ids, place 1 first. Returns what happened (transfers) for the page. */
function record(RG,order,hs,why,dnf){
  var r=RG.races[RG.cur], out={race:r.key,toMain:[],toNext:[],out:[]};
  if(!r||RG.done) throw new Error("No race to record.");
  var ent=entrants(RG,RG.cur), u={};
  if(order.length!==ent.length) throw new Error("Result size "+order.length+" != "+ent.length);
  order.forEach(function(id){ if(ent.indexOf(id)<0||u[id]) throw new Error("Bad result "+id); u[id]=1; });
  r.res=order.slice(); r.hs=hs==null?null:hs; r.why=why||null;
  /* crashes (CRASH-CONTRACT.md): the riders who did not finish {id: {lap, why: "crash" | "cards"}}, already classified behind the finishers
     by race.js; they score the points of their place (the series' tables pay by place) */
  if(dnf&&typeof dnf==="object"&&Object.keys(dnf).length) r.dnf=JSON.parse(JSON.stringify(dnf));
  if(r.st>=0){
    var s=RG.st[r.st], nm=s.toMain, nn=s.toNext==="rest"?1e9:(+s.toNext||0), last=r.st===RG.st.length-1;
    if(last) nn=0;
    order.forEach(function(id,p){
      if(p<nm){ RG.main.push({id:id,pos:p+1,r:r.i,s:r.st}); out.toMain.push(id); }
      else if(p<nm+nn){ RG.send[r.st].push({id:id,pos:p+1,r:r.i}); out.toNext.push(id); }
      else { RG.elim[r.st].push({id:id,pos:p+1,r:r.i}); out.out.push(id); }
    });
    var stageDone=RG.races.every(function(x){ return x.st!==r.st||x.res; });
    if(stageDone){
      if(!last){
        var nx=RG.st[r.st+1], pool=interleave(RG.send[r.st]), cap=nx.races*nx.size;
        if(pool.length>cap){ pool.slice(cap).forEach(function(id){ var e=RG.send[r.st].filter(function(x){ return x.id===id; })[0]; RG.elim[r.st].push(e); }); pool=pool.slice(0,cap); }
        assign(RG,r.st+1,pool);
      } else finalsEntry(RG);
    }
  } else {
    var fdone=RG.races.every(function(x){ return x.st!==-1||x.res; });
    if(fdone){ RG.done=true; }
  }
  RG.cur++;
  if(RG.cur>=RG.races.length) RG.done=true;
  /* a race with fewer than 2 riders can't run (a short program): its riders go on in their seed order, a walkover */
  var nx2=!RG.done&&entrants(RG,RG.cur); if(nx2&&nx2.length<2){ var w=record(RG,nx2,null,"walkover"); out.walkover=(out.walkover||[]).concat([RG.races[RG.cur-1].key]); }
  return out;
}
/* the Main's gate: the qualifiers interleaved by place (heat winners first), then the semi and LCQ qualifiers; topped up from the best
   non-qualifiers of the last stage when the program was too short to fill it */
function finalsEntry(RG){
  var size=RG.F.finals.size, q=RG.main.filter(function(x){ return x.s===-1; }).map(function(x){ return x.id; }), si;
  for(si=0;si<RG.st.length;si++) q=q.concat(interleave(RG.main.filter(function(x){ return x.s===si; })));
  if(q.length<size){
    for(si=RG.st.length-1;si>=0&&q.length<size;si--){
      var el=interleave(RG.elim[si]);
      while(el.length&&q.length<size){ var id=el.shift(); q.push(id); RG.elim[si]=RG.elim[si].filter(function(x){ return x.id!==id; }); RG.main.push({id:id,pos:99,r:0,s:si,fill:true}); }
    }
  }
  if(q.length>size){ q.slice(size).forEach(function(id){ RG.elim[RG.st.length-1].push({id:id,pos:99,r:0}); }); q=q.slice(0,size); }
  RG.fin=q;
}

/* ---------------- scoring the round ---------------- */
function finalsOf(RG){ return RG.races.filter(function(r){ return r.st<0; }); }
function overall(RG){
  var F=RG.F, fin=finalsOf(RG), T=F.table, ids=RG.fin.slice();
  if(fin.length===1) return fin[0].res.slice();
  var sc={}, pl={};
  var sum={};
  ids.forEach(function(id){ sc[id]=0; pl[id]=[]; sum[id]=0; });
  fin.forEach(function(r){ r.res.forEach(function(id,p){ pl[id].push(p+1); sum[id]+=p+1; sc[id]+=F.overall==="olympic"?(p+1):(T[p]||0); }); });
  return ids.sort(function(a,b){
    var d=F.overall==="olympic"?sc[a]-sc[b]:sc[b]-sc[a]; if(d) return d;
    if(F.overall!=="olympic"&&sc[a]===0&&sum[a]!==sum[b]) return sum[a]-sum[b];   // riders without points: Olympic (the 2021 rule book)
    for(var k=fin.length-1;k>=0;k--){ if(pl[a][k]!==pl[b][k]) return pl[a][k]-pl[b][k]; }   // the better finish in the last race
    return 0;
  });
}
/* the round's result: cls = every rider of the night, place 1..N; pts = championship points; wins / places for the season tie-break */
function score(RG,title){
  if(!RG.done) throw new Error("The round isn't finished.");
  var F=RG.F, T=F.table, fin=finalsOf(RG), ov=overall(RG), cls=ov.slice(), si;
  for(si=RG.st.length-1;si>=0;si--) cls=cls.concat(interleave(RG.elim[si].filter(function(x){ return cls.indexOf(x.id)<0; })));
  RG.entry.forEach(function(id){ if(cls.indexOf(id)<0) cls.push(id); });   // (never: everyone in the entry raced)
  var pts={}, wins={}, places={}, mot={};
  cls.forEach(function(id){ pts[id]=0; });
  if(F.pointsOn==="race"){
    fin.forEach(function(r){ r.res.forEach(function(id,p){ if(title) pts[id]+=T[p]||0; (places[id]=places[id]||[]).push(p+1); if(p===0) wins[id]=(wins[id]||0)+1; }); });
  } else {
    ov.forEach(function(id,p){ if(title) pts[id]+=T[p]||0; places[id]=[p+1]; if(p===0) wins[id]=1; });
  }
  fin.forEach(function(r){ r.res.forEach(function(id,p){ (mot[id]=mot[id]||[]).push(p+1); }); });
  var hs={}; RG.races.forEach(function(r){ if(r.hs!=null&&r.st<0) hs[r.hs]=(hs[r.hs]||0)+1; });
  return {cls:cls,pts:pts,wins:wins,places:places,finals:mot,hs:hs,winner:ov[0],title:!!title,main:RG.fin.slice()};
}

/* an old save (v1 / v2 battle lengths, no lap time): the races still to run get their real length; returns the round's lap time */
function upgrade(RG,o,meta){
  if(!RG) return 0;
  if(RG.lapS>0) return RG.lapS;
  meta=meta||{}; var F=RG.F;
  RG.lapS=meta.lapS>0?Math.round(meta.lapS):lapTime(meta.series||(/^mx-/.test(F.id)?"mx":"sx"),meta.year,meta.cal); RG.mode=MODE_OF[o&&o.length]||"real"; RG.year=meta.year|0;
  RG.races.forEach(function(r){ if(!r.res) r.len=raceLen(F,r.kind,r.i,o,RG.lapS,RG.year); });
  return RG.lapS;
}
MX.Round={LEN:LEN,MODE_OF:MODE_OF,REAL:REAL,realSpec:realSpec,lapTime:lapTime,lapsFor:lapsFor,raceLen:raceLen,upgrade:upgrade,teamSplit:teamSplit,formatFor:formatFor,fieldSize:fieldSize,lengths:lengths,newRound:newRound,current:current,entrants:entrants,record:record,score:score,overall:overall};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Round;
})(typeof window!=="undefined"?window:globalThis);
