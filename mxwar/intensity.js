/* MOTOCROSS WAR — intensity.js: how excited should a line sound? (pure, no DOM; browser: MXWar.Intensity, node: module.exports)
   The design: BG_audit/sprint/mxvoice/intensity/INTENSITY.md (the CEO, 2026-10-18: the announcers must be "really into it" but know WHEN).
   It answers one question at the moment the commentator (mxwar/announce.js) makes a line: LEVEL 0 calm, 1 lively, 2 BIG, 3 HUGE.
   The rules are DATA (MXWar.IntensityData, mxwar/intensity-data.js, built from the phrase bank by BG_audit/sprint/mxann3/tools/intensity/
   build-intensity.js): every kind of moment has a base level, a range and rules (the place involved, the person's own rider, the gap, the lap,
   the size of the race); every line has a kind (Wes's live call, his read-out, Hutch's reaction, his analysis ...) that sets it against the
   moment. HUGE stays rare: an earned HUGE comes 25 s after the last one at least, three in a Main at most (one kept for the last lap), one in a
   heat (the last lap) or in a race whose laps are shown short; forced peaks (the gate, the checkered flag of a Main, a photo finish, a crash
   of the leader or a top-3 rider, a triple war ...) can never be turned down. For 9 s after a HUGE line no line is quieter than lively.
     MXWar.Intensity.decide({ev, tpl, role, follow, A, it, ctx, lapMs})  -> {lv, E, forced, why[], flags}  or null (an unknown line: the old tier)
     MXWar.Intensity.flagsOf(A, it, ctx)     the situation as flags (p1 p3 p5 p10 pback you youIn tight close endgame lastlap early final ...)
     MXWar.Intensity.evalEvent(evd, flags, trace)   a moment's level for a set of flags (the build uses it too)
   The only state is A.race.lvs (per race: when the last HUGE was, how many were earned, the level of each call for its follow-up). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Intensity) return;

function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function parseCond(c){ return String(c||"").split("&").map(function(s){ s=s.trim(); if(!s) return null; var neg=s.charAt(0)==="!"; return {n:neg?s.slice(1).trim():s,neg:neg}; }).filter(Boolean); }
function holds(cs,fl){ for(var i=0;i<cs.length;i++){ var v=!!fl[cs[i].n]; if(cs[i].neg?v:!v) return false; } return true; }

/* a moment's level for a set of flags: the base, then each rule that holds, in order; clamped to lo..hi. forced = a forcing rule held (or the
   moment is forced) and the level is HUGE */
function evalEvent(evd,fl,trace){
  var v=evd.base, forced=!!evd.forced, rs=evd.rules||[];
  for(var i=0;i<rs.length;i++){
    var r=rs[i]; if(!r._c) r._c=parseCond(r["if"]);
    if(!holds(r._c,fl)) continue;
    var before=v;
    if(r.add!=null) v+=r.add; else if(r.min!=null) v=Math.max(v,r.min); else if(r.max!=null) v=Math.min(v,r.max); else if(r.set!=null) v=r.set;
    if(r.force) forced=true;
    if(trace&&(v!==before||r.force)) trace.push(r["if"]+" -> "+(r.add!=null?(r.add>0?"+":"")+r.add:r.min!=null?"at least "+r.min:r.max!=null?"at most "+r.max:"="+r.set)+(r.why?" ("+r.why+")":""));
  }
  v=clamp(v,evd.lo,evd.hi);
  return {E:v,forced:forced&&v>=3};
}

/* ---------------- the situation ---------------- */
function placeIn(L,s){ if(!L) return 0; for(var i=0;i<L.length;i++) if(L[i].s===s) return i+1; return 0; }
function crashEv(ev){ return ev==="crash_remount"||ev==="crash_out"||ev==="multi_crash"; }
function flagsOf(A,it,ctx){
  var r=A.race||{}, t=ctx.tags||{}, f=ctx.facts||{}, fl={}, k;
  for(k in t) if(t[k]) fl[k]=true;
  var len=r.len|0, lap=r.lap|0, left=len-lap+1;
  if(len>0&&lap>0){ var lateN=clamp(Math.round(len*0.15),1,3); fl.endgame=left<=lateN; fl.lastlap=fl.lastlap||left<=1; fl.early=lap<=2; }
  if(r.isFinal) fl.final=true; else delete fl.final;
  /* the home rider: in the moment (any side of it), and in the race at all */
  fl.you=!!(t.you||ctx.human||f.you);
  var G=A.G, rm=A.rmap||[];
  fl.youIn=rm.some(function(id){ var R=G&&G.riders?G.riders[id]:null; return !!(R&&R.kind==="human"); });
  /* the best place among the riders the line is about: a talk line or a pass on the track tells its live place (from the race clock); a crash
     is judged by where the rider WAS riding (the order before the lap), a lead change by the order after it */
  var best=1e9;
  if(f.livePlace>0) best=f.livePlace|0;
  else {
    var ids=(f.named||[]).slice(), L=(crashEv(it.ev)&&lap>1&&r.prev&&r.prev.length)?r.prev:r.cur;
    if(L&&ids.length) ids.forEach(function(id){ var s=rm.indexOf(id); if(s<0) return; var p=placeIn(L,s); if(p>0&&p<best) best=p; });
    if(best===1e9&&f.place!=null) best=f.place|0||1e9;
  }
  if(it.ev==="holeshot"||it.ev==="lead_change"||(it.ev==="last_lap_battle"&&t.lead)) best=1;
  if(best<1e9){ fl.p1=best<=1; fl.p3=best<=3; fl.p5=best<=5; fl.p10=best<=10; fl.pback=best>10; }
  if(fl.lead||fl.podium){ fl.p3=true; fl.p5=true; fl.p10=true; if(fl.lead) fl.p1=true; }
  /* the gap between the top two: seconds when the race keeps times (tight = within 1 s, close = within 2 s), else cards (tight = within a card,
     close = the engine's own max(2, riders / 4)) */
  var cur=(r.cur||[]).filter(function(x){ return !x.out; });
  if(cur.length>=2){
    if(typeof cur[1].gs==="number"&&cur[1].gs>=0){ fl.tight=cur[1].gs<=1; if(cur[1].gs<=2) fl.close=true; }
    else if(typeof cur[1].gap==="number"){ var gp=cur[1].gap, cl=Math.max(2,Math.round(cur.length/4)); fl.tight=gp<=1; if(gp<=cl) fl.close=true; }
  }
  if(f.pot!=null&&f.pot>=35) fl.pot=true;
  return fl;
}

/* ---------------- the decision ---------------- */
function over(a,b){ var r={},k; for(k in a) r[k]=a[k]; for(k in b) r[k]=b[k]; return r; }   /* the budget with a special case laid over it */
function stateOf(A){ var r=A.race; if(!r) return {last3At:-1e9,n3:0,earned:0,lastLv:0,lastAt:-1e9,hugeLineAt:-1e9,callE:{}}; return r.lvs||(r.lvs={last3At:-1e9,n3:0,earned:0,lastLv:0,lastAt:-1e9,hugeLineAt:-1e9,callE:{}}); }
function decide(o){
  var D=MX.IntensityData; if(!D||!D.events) return null;
  var evd=D.events[o.ev]; if(!evd) return null;
  var ix=String(o.tpl||"").split("#")[1], ln=evd.lines[+ix]; if(!ln) return null;
  var A=o.A, st=stateOf(A), now=A.now, why=[], fl=null, E, forced=false, B=D.global.budget, C=D.global.continuity.afterHuge;
  var B0=B;
  if(B0.compressed&&o.lapMs>0&&o.lapMs<B0.compressed.lapMsBelow) B=over(B0,B0.compressed);   /* laps shown short (6 to 14 s): a tighter budget */
  else if(B0.nonFinal&&A.race&&!A.race.isFinal&&!(o.ctx&&(o.ctx.human||(o.ctx.tags&&o.ctx.tags.you)))) B=over(B0,B0.nonFinal);   /* a heat, a semi, a last chance race, a qualifier: a smaller budget unless the home rider is in the moment */
  if(o.follow&&st.callE[o.ev]!=null){ E=st.callE[o.ev]; why.push("follows the call: same moment, same level"); }
  else{
    fl=flagsOf(A,o.it,o.ctx);
    var res=evalEvent(evd,fl,why); E=res.E; forced=res.forced;
    if(E>=3&&!forced){
      if(!fl.lastlap&&now-st.last3At<B.minGapMs){ E=2; why.push("budget: a HUGE was said "+Math.round((now-st.last3At)/1000)+" s ago, so this one is BIG"); }
      else if(st.earned>=B.maxEarned-(fl.lastlap?0:(B.reserveLastLap|0))){ E=2; why.push("budget: "+st.earned+" earned HUGE calls already in this race"+(fl.lastlap?"":" (the last "+(B.reserveLastLap|0)+" is kept for the last lap)")+", so this one is BIG"); }
    }
    if(E>=3){ st.last3At=now; st.n3++; if(!forced) st.earned++; }
    st.callE[o.ev]=E;
  }
  var lv=clamp(E+ln.d,0,ln.max);
  if(now-st.hugeLineAt<C.floorMs&&lv<C.floor&&ln.kind!=="t"){ var fl2=Math.min(ln.max,C.floor); if(fl2>lv){ lv=fl2; why.push("continuity: right after a HUGE line, not below lively"); } }   /* never above the line's own range: a calm-only line has no lively take */
  if(lv>=3) st.hugeLineAt=now;
  st.lastLv=lv; st.lastAt=now;
  return {lv:lv,E:E,forced:forced,why:why,flags:fl};
}

MX.Intensity={decide:decide,flagsOf:flagsOf,evalEvent:evalEvent,parseCond:parseCond,tier:function(lv){ return "T"+clamp(lv|0,0,3); }};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Intensity;
})(typeof window!=="undefined"?window:globalThis);
