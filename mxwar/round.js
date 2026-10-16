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
/* race lengths in battles ("laps"): the CEO (2026-10-16 ~16:55): "I don't want each race to be hours... get through the full circuit":
   Short = Heat 10 / LCQ 8 / Main 25 / Moto 20, Standard = Heat 15 / Semi 12 / LCQ 12 / Main 40 / Moto 30, Long = Heat 20 / LCQ 15 / Main 60 / Moto 40
   (a semi as long as the LCQ); wars play out in full and do not count extra */
var LEN={short:{heat:10,semi:8,lcq:8,main:25,moto:20},standard:{heat:15,semi:12,lcq:12,main:40,moto:30},long:{heat:20,semi:15,lcq:15,main:60,moto:40}};

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
function lengths(o){ var base=LEN[o&&o.length]||LEN.standard, out={}, k; for(k in base) out[k]=base[k]; if(o&&o.len) for(k in o.len) if(out[k]!=null&&+o.len[k]>=1) out[k]=Math.min(2000,Math.floor(+o.len[k])); return out; }

/* ---------------- a new round ----------------
   entry: rider ids in SEED order (the season's standings / form); n = the night's field (fill === "roster" may make it smaller than the
   format's full program: the first stage's races keep their count and get smaller). */
function newRound(F,ri,entry,o){
  var L=lengths(o), RG={ri:ri,fmt:F.id,tc:!!F.isTC,F:F,entry:entry.slice(),races:[],cur:0,send:[],main:[],elim:[],fin:null,done:false,res:null};
  var st=F.qual.map(function(s){ return clone(s); }), dir=Math.min(F.direct|0,entry.length), rest=entry.slice(dir);
  /* SMX: the seeds ride straight into the finals (in seed order) */
  entry.slice(0,dir).forEach(function(id,k){ RG.main.push({id:id,pos:k+1,r:0,s:-1}); });
  if(st.length&&rest.length<st[0].races*st[0].size) st[0].size=Math.max(2,Math.ceil(rest.length/st[0].races));
  RG.st=st;
  st.forEach(function(s,si){
    for(var i=0;i<s.races;i++) RG.races.push({key:s.kind+(si+1)+"-"+(i+1),label:s.label+(s.races>1?" "+(i+1):""),kind:s.kind,st:si,i:i,len:L[s.kind]||L.heat,ent:null,res:null,hs:null,why:null});
    RG.send.push([]); RG.elim.push([]);
  });
  var f=F.finals;
  for(var i=0;i<f.races;i++){
    var lbl=f.races===1&&f.kind!=="moto"?f.label:(F.isTC?"Main "+(i+1):f.label+" "+(i+1));
    RG.races.push({key:"final-"+(i+1),label:lbl,kind:f.kind,st:-1,i:i,len:Math.max(5,Math.round((L[f.kind]||L.main)*(f.lenF||1))),ent:null,res:null,hs:null,why:null});
  }
  if(!st.length) RG.fin=entry.slice(0,f.size);
  else assign(RG,0,rest.slice(0,st[0].races*st[0].size));
  return RG;
}
/* split a pool over a stage's races: rider k of the pool goes to race k % races (the seed order alternates, as qualifying does) */
function assign(RG,si,pool){
  var s=RG.st[si], per=[], i;
  for(i=0;i<s.races;i++) per.push([]);
  pool.forEach(function(id,k){ per[k%s.races].push(id); });
  RG.races.forEach(function(r){ if(r.st===si) r.ent=per[r.i]; });
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
function record(RG,order,hs,why){
  var r=RG.races[RG.cur], out={race:r.key,toMain:[],toNext:[],out:[]};
  if(!r||RG.done) throw new Error("No race to record.");
  var ent=entrants(RG,RG.cur), u={};
  if(order.length!==ent.length) throw new Error("Result size "+order.length+" != "+ent.length);
  order.forEach(function(id){ if(ent.indexOf(id)<0||u[id]) throw new Error("Bad result "+id); u[id]=1; });
  r.res=order.slice(); r.hs=hs==null?null:hs; r.why=why||null;
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

MX.Round={LEN:LEN,formatFor:formatFor,fieldSize:fieldSize,lengths:lengths,newRound:newRound,current:current,entrants:entrants,record:record,score:score,overall:overall};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Round;
})(typeof window!=="undefined"?window:globalThis);
