/* MOTOCROSS WAR — THE BEAT (MXWar.Beat; the time model v4: "a battle every 10 seconds"). Pure, no DOM. Node: module.exports = MXWar.Beat;
   browser: window.MXWar.Beat (load race.js first; time.js dispatches to this file for a race whose G.tm.v is 4).
   The CEO (2026-10-19): "Every 10 seconds, there needs to be a card flip ... I don't want one card flip per lap. That's too slow." Every 10 s of race
   clock every rider still racing turns a card; his battle (a table of the riders right around him, or a chase of the rider just ahead) sets his pace for
   the next 10 s (the momentum); laps, lap times, gaps, lapped riders and the finish come out of the beats (BG_audit/sprint/mxact/ACTION-PLAN-v3.md,
   v3.1, sections 2-5). This file is the reference v3/beat.js + v3/adopt4.js (v3.1) written in the engine's ES5 style: the arithmetic and the order of
   operations are the reference's, line for line, so a Fire TV, a phone and a laptop give the same bits (Party sync); the class values are the tuned
   ones of the plan's section 9.2 (v3/out/tuned4-<class>.json). No random number, no hash, never touches G.rs; + - * / sqrt only (round / floor /
   min / max). State G.tm (v:4) is plain JSON: per rider the advance in every beat window (integer 1e-5 laps), the interior knots (turn 1, a crash
   hold, a crash-out stop, his finish line), the line times T (integer ms), the holds; the yellow sections.
   THE CLOCK GRID: beat b (b = 1, 2, ...) rides the clock window [(b-1)*D, b*D), D = 10000 ms; its cards turn 1 s before the window (the LOCK; beat 1 =
   the gate drop at 0). War calls beat(G) once per battle (race.js endBattle) and it writes window b.
   The CEO's addendum (2026-10-19 ~13:20): the gate-drop battle's riders holding the lowest card of the deck go down in the bunch (race.js marks them:
   a crash with pile = 1) and get back up: here a remount at the first-turn funnel (just before turn 1, by 9 s at the latest) with the lightest hold
   of a lost double war.
   API: init tables chases beat complete standings result tower progressAt timeAt stateAt walker leaderLine clockLimit winAt packet adopt4 knotsOf
        holdWindow yellowWindows lapStats you facts eventLine */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Beat) return;
function RC(){ return MX.Race||(typeof require==="function"?require("./race.js"):null); }
function TM(){ return MX.Time||(typeof require==="function"?require("./time.js"):null); }
var D=10000, U=100000;   /* beat ms; position unit = 1e-5 lap */

var BASE={
  W1:0.40, WW:0.30, WL:0.35, LB:0.40,             /* z of a battle: table won (pot) / per war level won / war lost / a lost table battle (shared by the losers) */
  YP:0.30, YW:0.50, YL:0.30, YB:0.30,             /* the same results as they enter the form */
  N0:6,                                           /* form prior in LAPS (x beats per lap) */
  KQ:0.06, KS:0.05, SCAP:2.5,
  FIRE:0.30, FIREL:3,                             /* after a remount: FIRE z for FIREL laps' worth of beats, fading */
  ZL:-1.6, ZH:2.6,
  ZETA:0.05, YLF:0.02, YLAPS:1.0,                 /* yellow section half width (lap), time everyone loses crossing it (x p), how long it flies (typical laps) */
  CS:0.045, CR:0.30, CRS:0.35, CSS:0.55,
  CG0:0.55, CG1:1.10,
  P1:0.50, T1:0.12,
  BL:0.006,
  PT:0.30,                                        /* seconds gained on the rider ahead in one beat that free a pass without winning the card duel */
  PC:3, PCL:1,                                    /* the card duel: he passes the one ahead at his table if he won the table or his card is PC ranks higher (+PCL in the top 3) */
  REACH:1.0,                                      /* seconds: riders within REACH of each other on the tower fight one table */
  CRD:1500,                                       /* ms into the window per war level: the loser of a double / triple war goes down then (the board shows the war first) */
  LLL:1,                                          /* the last LLL laps count the card more (LLW) */
  WC:0.20, YC:0.15,                               /* THE CHASE: a rider with nobody within REACH plays his card against the rider directly ahead of him (z +-WC, form +-YC; a tie: even) */
  TMAX:4                                          /* at most 4 riders at a table (a longer chain within REACH is cut at its widest gaps) */
};
/* per class: the plan's section 9.2 (v3/out/tuned4-<class>.json over the reference's starting values; tune4.js on the tuning seeds) */
var CLS={
  sxMain:{ WS:0.93, F1:0.32976, s:0.069, a:0.041, kap:1.489, rmax:1.251, Z0:0.45, A:0.32, Rl:0.912, G:2.5600000000000005, HS:0.0512, LLW:1, S1:0.0075, C:0.29, CB:0.12, GC:2.01, GAP:0.24880000000000002, CS:0.04256, CR:0.216, P1:0.506, WC:0.2, YC:0.15, REACH:1.3, PT:0.6, W1:0.3, LB:0.15, PC:3.5999999999999996, PCL:3.5999999999999996, BL:0.006, YLF:0.02 },
  sxHeat:{ WS:1.05, F1:0.31967999999999996, s:0.126, a:0.082, kap:0.4752, rmax:1.12, Z0:0.536, A:0.48, Rl:0.908, G:4.41, HS:0.098496, LLW:1.3932, S1:0.008, C:0.3456, CB:0.08, GC:1.5296000000000003, GAP:0.42839999999999995, CS:0.0472032, CR:0.289872, P1:0.554, WC:0.2, YC:0.14850000000000002, REACH:1.3, PT:0.864, W1:0.36, LB:0.096, PC:3, PCL:3, BL:0.004608, YLF:0.02 },
  sxLcq:{ WS:0.98, F1:0.3168, s:0.095, a:0.051, kap:0.4704, rmax:1.12, Z0:0.54, A:0.336, Rl:0.9215, G:3.04, HS:0.04012800000000001, LLW:1.1550000000000002, S1:0.0078, C:0.35519999999999996, CB:0.054, GC:1.87, GAP:0.2724, CS:0.03075264, CR:0.5984999999999999, P1:0.5, WC:0.2, YC:0.14850000000000002, REACH:1.3, PT:0.9072, W1:0.3, LB:0.189, PC:3, PCL:3, BL:0.003900441600000001, YLF:0.02 },
  smxMoto:{ WS:0.8, F1:0.11359999999999999, s:0.059, a:0.049, kap:1.156, rmax:1.12, Z0:0.588, A:0.32000000000000006, Rl:0.97, G:6.48, HS:0.08063999999999999, LLW:2, S1:0.0065, C:0.29491199999999995, CB:0.03648, GC:1.536, GAP:0.44000000000000006, CS:0.029160000000000005, CR:0.23232000000000005, P1:0.468, WC:0.2, YC:0.15, REACH:1, PT:0.8, W1:0.3, LB:0.25, PC:3, PCL:3.5999999999999996, BL:0.004320000000000001, YLF:0.018000000000000002 },
  mxMoto:{ WS:0.48, F1:0.096, s:0.112, a:0.048, kap:0.905, rmax:1.344, Z0:0.392, A:0.17600000000000002, Rl:0.93, G:7.6000000000000005, HS:0.2, LLW:1.2, S1:0.006, C:0.3312, CB:0.02, GC:4.572, GAP:0.96, CS:0.062208, CR:0.288, P1:0.517, WC:0.24, YC:0.15, REACH:0.7200000000000001, PT:0.96, W1:0.2, LB:0.25, PC:2.88, PCL:3.5999999999999996, BL:0.0045, YLF:0.012 }
};
function assign(t){ for(var i=1;i<arguments.length;i++){ var s=arguments[i]; if(s) for(var k in s) if(Object.prototype.hasOwnProperty.call(s,k)) t[k]=s[k]; } return t; }
function classOf(series,kind){
  if(series==="mx") return "mxMoto";
  if(series==="smx") return kind==="lcq"?"sxLcq":kind==="heat"||kind==="semi"||kind==="qual"?"sxHeat":"smxMoto";
  return kind==="heat"||kind==="semi"||kind==="qual"?"sxHeat":kind==="lcq"?"sxLcq":"sxMain";
}
function era(series,year){ year=year|0||2026; if(series==="mx") return year>=2021?0.95:year>=2010?1.10:year>=2003?1.40:1.10; return year>=2017?1.0:year>=2010?1.15:year>=2003?1.45:year>=1990?1.10:1.30; }
function ratio(P,u){ if(u>=0){ var r=1+P.s*u*(1+P.kap*u*0.5); return r>P.rmax?P.rmax:r; } var v=P.s*u; return 1+v/(1-v/P.a); }
function cval(G,c){ if(c==null) return 8; var v=RC().val(G,c); return v>=100?15:v; }
function xOf(G,c){ if(c==null) return 0; var v=cval(G,c); return v>=15?1.25:(v-8)/6; }
function handQ(G,s){ var pk=G.r[s].pk; if(!pk.length) return 0; var sum=0; for(var i=0;i<pk.length;i++) sum+=cval(G,pk[i]); var q=(sum/pk.length-8)/(3.74/Math.sqrt(pk.length)); return Math.round((q>2.5?2.5:q<-2.5?-2.5:q)*1000)/1000; }
function r3(x){ return Math.round(x*1000)/1000; }
function r1(x){ return Math.round(x*10)/10; }
function r2(x){ return Math.round(x*100)/100; }
function lastUp(L0,s){ var w=L0.w&&L0.w[s]; if(w) for(var i=w.length-1;i>=0;i--) if(w[i][1]!=null) return w[i][1]; return L0.c?L0.c[s]:null; }
function maxOf(a){ var m=-Infinity; for(var i=0;i<a.length;i++) if(a[i]>m) m=a[i]; return m; }

/* cards per rider for a beat race (plan section 4): 52 in every beat race, whatever the House "Cards per rider" row says */
function cardsFor(){ return 52; }
/* the race's format: "M min + K laps" = a timed race (the clock runs M minutes, then the leader's next crossing starts the last K laps; Half length:
   M x 0.5); "N laps" (or no rule) = N laps. info.fmt = {min, plus} (season.js: the race's own researched rule, else the era's) or info.u = the rule string
   (the research's "20 min + 1 lap"; the reference's input); info.fmt === "laps" = a lap count */
function fmtOf(info){
  if(info.fmt==="laps") return null;
  if(info.fmt&&typeof info.fmt==="object"){ var mn=+info.fmt.min, pl=info.fmt.plus|0; return mn>0?{ min:mn, plus:pl }:null; }
  var mm=/^(\d+(?:\.\d+)?)\s*min\s*\+\s*(\d+)\s*lap/i.exec(String(info.u||""));
  return mm?{ min:+mm[1]*(info.half?0.5:1), plus:+mm[2] }:null;
}

function init(G,info){
  var ser=info.series==="mx"||info.series==="smx"?info.series:"sx", kind=info.kind||"main", cls=classOf(ser,kind);
  var E=era(ser,info.year), P=assign({},BASE,CLS[cls]);
  P.s*=E; P.a*=Math.sqrt(E);
  var p=+info.p||55;
  if(+info.b>0&&info.b<p) P.a=Math.max(0.03,Math.min(0.09,(1-info.b/p)*1.12));
  var fl=+info.fl>0?+info.fl:p;
  var fmt=fmtOf(info);
  G.tm={ v:4, D:D, ser:ser, yr:info.year|0, kind:kind, cls:cls, E:r3(E), L:Math.max(1,G.o.len|0||info.L|0), Lr:Math.max(1,G.o.len|0||info.L|0), fmt:fmt, Lf:null, p:p, fl:fl, b:+info.b>0?+info.b:0, t1:P.T1, P:P,
    k:0, flag:null, done:false, win:-1, hs:-1, lead:-1, best:null, bt:{}, lapped:{}, start:null, yz:[], ev:[], white:null, two:null,
    r:G.r.map(function(p2,s){ return { x:[0], ik:[], T:[], f:0, n:0, q:handQ(G,s), h:p2.pk.length, fire:0, cr:0, held:0, hold:[], fin:null, dnf:null, pend:null, xs:0, t1:0, g:[] }; }) };
  return G.tm;
}

/* ---------------- positions: a rider's knots = the beat lines (b*D, sum of x[0..b]) merged with his interior knots ----------------
   The knot cache lives on the rider record as a NON-enumerable property (never in a save, no WeakMap on an old Fire TV browser); finishAt drops it
   (it edits the knots with their counts unchanged) */
function setCache(R,c){ try{ Object.defineProperty(R,"__kc",{ value:c, writable:true, configurable:true, enumerable:false }); }catch(e){} return c; }
function knotsOf(R){
  var c=R.__kc;
  if(c&&c.n===R.x.length&&c.ni===R.ik.length) return c;
  var t=[], x=[], g0=R.g0|0, acc=0, j=0, b;
  for(b=0;b<R.x.length;b++){
    var tb=g0+b*D; acc+=R.x[b];
    while(j<R.ik.length&&R.ik[j][0]<tb){ t.push(R.ik[j][0]); x.push(R.ik[j][1]); j++; }
    t.push(tb); x.push(acc);
  }
  while(j<R.ik.length){ t.push(R.ik[j][0]); x.push(R.ik[j][1]); j++; }
  if(t[0]>0){ t.unshift(0); x.unshift(0); }   /* (a race carried over from the per-lap model: its knots start at the gate) */
  return setCache(R,{ n:R.x.length, ni:R.ik.length, t:t, x:x, X:acc });
}
function xAbs(R){ return knotsOf(R).X; }   /* position (units) at the last beat line written */
/* progress (laps) of rider s at clock t (ms): monotone; a crashed-out rider stays where he fell; out of cards: at the line he pulled off */
function progressAt(G,s,t){
  var R=G.tm.r[s];
  if(t<=0) return 0;
  if(R.dnf&&t>=R.dnf.t) return R.dnf.x/U;
  var K=knotsOf(R), kt=K.t, kx=K.x, m=kt.length;
  if(t>=kt[m-1]) return kx[m-1]/U;
  var lo=0, hi=m-1; while(hi-lo>1){ var mid=(lo+hi)>>1; if(kt[mid]<=t) lo=mid; else hi=mid; }
  var t0=kt[lo], t1=kt[hi]; if(t1<=t0) return kx[hi]/U;
  return (kx[lo]+(kx[hi]-kx[lo])*(t-t0)/(t1-t0))/U;
}
/* the clock time (ms) rider s reached progress pr (laps); null when he has not (in what is decided) */
function timeAt(G,s,pr){
  var R=G.tm.r[s], K=knotsOf(R), kt=K.t, kx=K.x, m=kt.length, X=pr*U;
  if(pr<=0) return 0;
  if(X>kx[m-1]+1e-6) return null;
  if(kx[0]>=X) return kt[0];
  var lo=0, hi=m-1; while(hi-lo>1){ var mid=(lo+hi)>>1; if(kx[mid]<X) lo=mid; else hi=mid; }
  var x0=kx[lo], x1=kx[hi]; if(x1<=x0) return kt[hi];
  return kt[lo]+(kt[hi]-kt[lo])*(X-x0)/(x1-x0);
}
function holdAt(R,t){ for(var i=R.hold.length-1;i>=0;i--){ var h=R.hold[i]; if(t>=h[0]&&t<h[1]) return h; } return null; }
function stateAt(G,s,t){   /* run | down | out | pits | fin */
  var R=G.tm.r[s];
  if(R.dnf&&t>=R.dnf.t) return R.dnf.why==="crash"?"out":"pits";
  if(R.fin&&t>=R.fin.t) return "fin";
  return holdAt(R,t)?"down":"run";
}
/* the tower's interval: how long ago the rider ahead (a) was where f is now (ms); Infinity a lap or more apart */
function intervalAt(G,a,f,t){
  var pa=progressAt(G,a,t), pf=progressAt(G,f,t); if(pa-pf>=1||pa<pf) return Infinity;
  var ta=timeAt(G,a,pf); return ta==null?Infinity:t-ta;
}
function finT(R,t){ return R.fin&&t>=R.fin.t?R.fin.t:Infinity; }   /* a finished rider's line time (riders in at the same lap: the earlier first) */
function orderAt(G,t,seats){
  var tm=G.tm, pr={}; seats.forEach(function(s){ pr[s]=progressAt(G,s,t); });
  var oi={}; if(tm.start) tm.start.ord.forEach(function(s,i){ oi[s]=i; });
  return seats.slice().sort(function(a,b){ return (pr[b]-pr[a])||((finT(tm.r[a],t)-finT(tm.r[b],t))||0)||((oi[a]!=null?oi[a]:99)-(oi[b]!=null?oi[b]:99))||(a-b); });
}
/* ---------------- the tables of the next battle: the packs on the tower at the start of its window ---------------- */
function tables(G,live){
  var tm=G.tm, t=winAt(tm,tm.k+1), R=tm.P.REACH*1000, ord=orderAt(G,t,live), out=[], TMAX=tm.P.TMAX||4;
  var cur=[], gaps=[];
  /* a table is at most TMAX riders (the riders right around you): a longer chain within REACH (a bunched field, the first laps) is cut at its widest
     gaps until every piece fits; a piece of one rider is a lone rider (he chases) */
  function cut(seg,gp){ if(seg.length<=TMAX){ out.push(seg); return; } var k=0; for(var i=1;i<gp.length;i++) if(gp[i]>gp[k]) k=i; cut(seg.slice(0,k+1),gp.slice(0,k)); cut(seg.slice(k+1),gp.slice(k+1)); }
  for(var i=0;i<ord.length;i++){
    var s=ord[i];
    if(!cur.length){ cur=[s]; gaps=[]; continue; }
    var a=cur[cur.length-1];
    var iv=stateAt(G,s,t)==="run"&&stateAt(G,a,t)==="run"?intervalAt(G,a,s,t):Infinity;
    if(iv<=R){ cur.push(s); gaps.push(iv); } else { cut(cur,gaps); cur=[s]; gaps=[]; }
  }
  if(cur.length) cut(cur,gaps);
  return out;
}
/* THE CHASE: every rider alone at his table (nobody within REACH) and riding (not down) plays his card against the rider directly ahead of him on the
   tower at the window's start (the nearest one riding): {chaser: target}. The race leader alone has nobody to chase (the rider behind chases him). A
   chase moves no cards (the target's card is in his own table's pot; the chaser's goes back under his own pile): it moves TIME. */
function chases(G,live,tabs){
  var tm=G.tm, t=winAt(tm,tm.k+1), ord=orderAt(G,t,live), out={}, lone={}, run={};
  tabs.forEach(function(tb){ if(tb.length===1) lone[tb[0]]=1; });
  ord.forEach(function(s){ run[s]=stateAt(G,s,t)==="run"; });
  for(var i=1;i<ord.length;i++){ var s=ord[i]; if(!lone[s]||!run[s]) continue; for(var j=i-1;j>=0;j--) if(run[ord[j]]){ out[s]=ord[j]; break; } }
  return out;
}

/* ---------------- the motion inside a window ---------------- */
/* advance by riding time tau (ms) from x (units) at pace rho (rho1 on lap 1 after turn 1): lap 1 = the first lap's time F, then the typical lap p */
function advance(tm,x,tau,rho,rho1){
  if(tau<=0) return x;
  var pM=tm.p*1000;
  if(x<U){
    var F=tm.fl*1000, TF=F*tm.t1, v1=(1-tm.t1)*U/((F-TF)*rho1), need=(U-x)/v1;
    if(tau<=need) return x+v1*tau;
    return U+U/(pM*rho)*(tau-need);
  }
  return x+U/(pM*rho)*tau;
}
function speed(tm,x,rho,rho1){ return (advance(tm,x,1000,rho,rho1)-x)/1000; }   /* units per ms */
/* the plan of rider s over [S, E): the start funnel, the riding pieces (minus holds and a crash), the free end */
function planOf(G,tm,s,S,E,rho,rho1,cr){
  var R=tm.r[s], x0=xAbs(R), t1u=Math.round(tm.t1*U);
  var pl={ s:s, S:S, E:E, x0:x0, rho:rho, rho1:rho1, cr:cr, slow:0, funnel:null, rideStart:S, xRide0:x0, pieces:null, riding:0, xFree:x0, xEnd:x0, v:0 };
  /* the start funnel: from the gate (0, 0) to turn 1 (R.t1, t1u) in a straight line; the beat pace rides from turn 1 */
  if(R.t1>S&&x0<t1u){
    /* a crash while he is still in his turn-1 funnel ends the funnel there: he goes down on his funnel line, and after the hold he rides at his normal
       pace (the funnel line never moved a rider who was down); writeWindow then sets R.t1 = the crash moment */
    var fe=cr&&cr.tc>=S&&cr.tc<R.t1&&cr.tc<E?cr.tc:R.t1;
    var lineAt=function(t){ return S===0?Math.round(t1u*t/R.t1):Math.round(x0+(t1u-x0)*(t-S)/(R.t1-S)); };   /* (from where he is; the gate's line when never held) */
    if(fe>=E){ pl.funnel={ end:R.t1, xe:lineAt(E) }; pl.rideStart=E; pl.xRide0=pl.funnel.xe; }
    else { var xe=fe===R.t1?t1u:lineAt(fe); pl.funnel={ end:fe, xe:xe }; pl.rideStart=fe; pl.xRide0=xe; }
  }
  var pieces=pl.rideStart<E?[[pl.rideStart,E]]:[];
  var cut=function(a,b){ var out=[]; pieces.forEach(function(q){ var p0=q[0], p1=q[1]; if(b<=p0||a>=p1){ out.push([p0,p1]); return; } if(a>p0) out.push([p0,a]); if(b<p1) out.push([b,p1]); }); pieces=out; };
  R.hold.forEach(function(h){ if(h[1]>S&&h[0]<E) cut(h[0],h[1]); });
  if(cr){ if(cr.kind==="out") cut(cr.tc,E); else cut(cr.tc,cr.tc+cr.H); }
  pl.pieces=pieces; pl.riding=pieces.reduce(function(a,q){ return a+(q[1]-q[0]); },0);
  pl.v=speed(tm,Math.max(pl.xRide0,U),rho,rho1); if(pl.xRide0<U) pl.v=speed(tm,pl.xRide0,rho,rho1);
  pl.fw=!!(pl.funnel&&pl.rideStart>=E); if(pl.fw) pl.v=Math.max(1e-9,(pl.xRide0-x0)/(E-S));   /* the whole window on his turn-1 funnel line (his speed is the funnel's) */
  pl.shape={ fw:pl.fw, rideStart:pl.rideStart, pieces:pieces, riding:pl.riding, v:pl.v };
  pl.xFree=advance(tm,pl.xRide0,pl.riding,rho,rho1); pl.xEnd=pl.xFree;
  return pl;
}
function freeEnd(tm,pl){ var eff=Math.max(pl.riding*0.5,pl.riding-pl.slow); pl.xFree=advance(tm,pl.xRide0,eff,pl.rho,pl.rho1); pl.xEnd=pl.xFree; }
/* his path as decided: the turn-1 funnel line (a whole window on it: to the end decided), then linear in riding time to the end decided */
function planX(pl,t){
  if(t<=pl.S) return pl.x0;
  if(pl.funnel&&t<=pl.rideStart){ var f=(t-pl.S)/Math.max(1,pl.rideStart-pl.S); return pl.x0+((pl.fw?pl.xEnd:pl.xRide0)-pl.x0)*f; }
  var done=0; for(var i=0;i<pl.pieces.length;i++){ var p0=pl.pieces[i][0], p1=pl.pieces[i][1]; if(t<=p0) break; done+=Math.min(t,p1)-p0; }
  return pl.riding>0?pl.xRide0+(pl.xEnd-pl.xRide0)*done/pl.riding:pl.xRide0;
}
function doneFrac(pl,t){
  if(pl.fw) return t<=pl.S?0:Math.min(1,(t-pl.S)/(pl.E-pl.S));
  if(pl.riding<=0||t<=pl.rideStart) return 0;
  var done=0; for(var i=0;i<pl.pieces.length;i++){ var p0=pl.pieces[i][0], p1=pl.pieces[i][1]; if(t<=p0) break; done+=Math.min(t,p1)-p0; }
  return done/pl.riding;
}   /* planX(t) = start + (xEnd - start) * doneFrac(t) after the funnel (start: xRide0; a whole-window funnel: x0) */
function inSection(xu,y){ var ph=xu/U-Math.floor(xu/U); return Math.abs(ph-y.c)<=y.z||Math.abs(ph-y.c-1)<=y.z||Math.abs(ph-y.c+1)<=y.z; }
function crossesSection(x0,x1,y){ if(x1<=x0) return false; for(var L=Math.floor(x0/U);L<=Math.floor(x1/U);L++){ var cx=(L+y.c)*U; if(cx>=x0&&cx<=x1) return true; } return false; }

/* ---------------- one beat ---------------- */
function racingAt(R,S){ return !R.gone&&!(R.dnf&&R.dnf.t<=S)&&!(R.fin&&R.fin.t<=S); }   /* (gone: out of the race in a save carried over from the per-lap model) */
function beat(G){
  var tm=G.tm; if(!tm||tm.done) return [];
  var L0=G.lastLap; if(!L0||L0.b!==tm.k+1) return [];
  var P=tm.P, n=G.n, b=tm.k+1, S=winAt(tm,b), E=S+D, p=tm.p, pM=p*1000, sE=Math.sqrt(tm.E), ev=[];
  var TF=tm.fl*1000*tm.t1, mB=p/(D/1000);
  var lastLap=function(k){ return tm.fmt?(tm.Lf!=null&&k>tm.Lf-tm.fmt.plus):k>=tm.L-P.LLL+1; };   /* the last lap(s): LLW (a timed race: its K laps after the clock) */
  /* ---- each rider's battle: his table, won / lost / a war ---- */
  var res={};
  (L0.tabs||[]).forEach(function(tab,ti){
    var g2=tab.s.length;
    tab.s.forEach(function(s){
      var fought=!!(L0.w&&L0.w[s]);
      var r={ ti:ti, g:g2, alone:!!tab.alone, win:tab.win===s&&!tab.alone, war:tab.war|0, fought:fought, lostWar:fought&&tab.win!==s, lost:!tab.alone&&tab.win!==s&&!tab.dead };
      var up=lastUp(L0,s); r.cv=(L0.c[s]!=null?cval(G,L0.c[s]):0)+(fought&&up!=null?cval(G,up)/100:0);
      res[s]=r;
    });
  });
  /* the chases: a lone rider's card against the card of the rider directly ahead of him (cd: +1 won, -1 lost, 0 even; cdv: the ranks) */
  var CH=L0.ch||{};
  Object.keys(CH).forEach(function(k){ var s=+k, d=CH[k], r=res[s]; if(!r||L0.c[s]==null||L0.c[d]==null) return; var dv=cval(G,L0.c[s])-cval(G,L0.c[d]); r.ct=d; r.cd=dv>0?1:dv<0?-1:0; r.cdv=dv; });
  var crashed={}; (L0.cr||[]).forEach(function(c){ crashed[c.s]=c; });
  var act=[], s0; for(s0=0;s0<n;s0++) if(racingAt(tm.r[s0],S)) act.push(s0);
  var X0={}; act.forEach(function(s){ X0[s]=xAbs(tm.r[s]); });
  /* ---- the start (battle 1): the holeshot first into turn 1, then the higher first card, war fighters first, the stronger hand, the gate ---- */
  if(b===1){
    var hs=L0.tabs&&L0.tabs[0]?L0.tabs[0].win:-1, cv=function(s){ return L0.c[s]!=null?cval(G,L0.c[s]):0; }, fw=function(s){ return L0.w&&L0.w[s]?1:0; };
    var so=act.slice().sort(function(a,c){ return (c===hs)-(a===hs)||(cv(c)-cv(a))||(fw(c)-fw(a))||(tm.r[c].q-tm.r[a].q)||(a-c); });
    tm.start={ ph:tm.t1, ord:so.slice(), t:[] }; tm.hs=hs; if(hs>=0) ev.push({ e:"holeshot", s:hs, t:0 });
    so.forEach(function(s,j){ var sp=P.S1*p*sE*(j+0.02*j*j); tm.r[s].t1=Math.round(TF+sp*1000); tm.r[s].t10=tm.r[s].t1; tm.start.t.push(tm.r[s].t1); });
  }
  var ord=orderAt(G,S,act);
  var gapAhead={}, i; for(i=1;i<ord.length;i++) gapAhead[ord[i]]=intervalAt(G,ord[i-1],ord[i],S)/1000;
  var hmean=act.reduce(function(a,s){ return a+G.r[s].pk.length; },0)/Math.max(1,act.length), nin=Math.max(1,act.length);
  /* ---- the pace of every rider for this window ---- */
  var z={}, rho={}, rho1={}, xv={};
  act.forEach(function(s){
    var R=tm.r[s], c=L0.c?L0.c[s]:null, x=xOf(G,c), r=res[s]||{ alone:true };
    var wl=lastLap(Math.floor(X0[s]/U)+1)?P.LLW:1;
    var zb=0, y=x; xv[s]=x;
    if(c!=null){
      if(r.win){ if(r.war>0){ zb+=P.WS*P.WW*r.war; y+=P.WS*P.YW*r.war; } else { zb+=P.W1; y+=P.YP; } }
      else if(r.lostWar&&!crashed[s]){ zb-=P.WS*P.WL; y-=P.WS*P.YL; }
      else if(r.lost){ zb-=P.LB/Math.max(1,r.g-1); y-=P.YB/Math.max(1,r.g-1); }
      else if(r.ct!=null){ zb+=P.WC*r.cd; y+=P.YC*r.cd; }   /* the chase */
      R.n++; R.xs+=x;
      if(b===1) R.f=P.F1*x+(s===tm.hs?P.HS:0);
      else R.f+=(y-R.f)*Math.max(1/(R.n+P.N0*mB),(1-P.Rl)/mB);
    }
    var su=(G.r[s].pk.length-hmean)/nin, stack=su/(1+(su<0?-su:su)/P.SCAP);
    var zz=P.A*wl*x+P.G*R.f+zb*wl+P.KQ*R.q+P.KS*stack;
    if(R.fire>0){ zz+=P.FIRE*R.fire/Math.max(1,P.FIREL*mB); R.fire--; }
    var ga=gapAhead[s]; if(b>1&&ga!=null&&isFinite(ga)&&ga<P.GC) zz+=P.CB*(1-ga/P.GC);
    zz=zz<P.ZL?P.ZL:zz>P.ZH?P.ZH:zz; z[s]=zz;
    rho[s]=ratio(P,P.Z0-zz); rho1[s]=1+P.P1*(rho[s]-1);
  });
  /* ---- crashes of this battle: when (the board shows the war first), how long (the card gap: a worse card falls harder) ----
     the gate-drop pile-up (the CEO's addendum; race.js marks it pile = 1): down in the bunch on his turn-1 funnel (just before turn 1, between 3 s and
     9 s from the drop), the lightest hold of a lost double war (no card gap) */
  var crash={};
  act.forEach(function(s){
    var c=crashed[s]; if(!c) return;
    var tc=c.pile?Math.max(S+P.CRD*2,Math.min(tm.r[s].t1-400,S+9000)):S+P.CRD*Math.min(3,c.depth);
    if(c.kind==="remount"){ var wc=L0.tabs[c.tab]?L0.tabs[c.tab].wc:null, dv=c.pile?0:Math.max(0,Math.min(12,cval(G,wc)-cval(G,lastUp(L0,s)))); var H=P.C*p*sE*(P.CG0+P.CG1*dv/12); crash[s]={ kind:"remount", tc:tc, H:Math.round(H*1000), dv:dv }; if(c.pile) crash[s].pile=1; }
    else crash[s]={ kind:"out", tc:tc };
  });
  /* ---- the plans; the cruise, the yellow flag and the blue flag take time off the riding ---- */
  var PL={}; act.forEach(function(s){ PL[s]=planOf(G,tm,s,S,E,rho[s],rho1[s],crash[s]); });
  if(b>1&&ord.length>1){
    var l1=ord[0], gp=gapAhead[ord[1]], small=n>=22?0:1-n/22, cs=P.CS*(1-P.CSS*small)*p;
    if(gp!=null&&isFinite(gp)&&gp>cs&&!crash[l1]&&!lastLap(Math.floor(X0[l1]/U)+1)){ var cutT=(P.CR+P.CRS*small)*(gp-cs)*(D/1000)/p; PL[l1].slow+=cutT*1000; ev.push({ e:"cruise", s:l1, t:S, gap:r1(gp), eased:r2(cutT) }); }
  }
  var ys=tm.yz.filter(function(y){ return y.t0<E&&y.t1>S; });
  if(ys.length) act.forEach(function(s){ var pl=PL[s]; ys.forEach(function(y){ if(crossesSection(pl.x0,pl.xFree,y)) pl.slow+=P.YLF*pM; }); });
  act.forEach(function(a){ var cnt=0; act.forEach(function(c){ if(c===a) return; var d0=X0[a]-X0[c], d1=PL[a].xFree-PL[c].xFree; if(d1>=U&&Math.floor(d1/U)>Math.floor(d0/U)) cnt++; }); if(cnt){ PL[a].slow+=P.BL*pM*cnt; ev.push({ e:"lapping", s:a, t:S, n:cnt, cost:r2(P.BL*p*cnt) }); } });
  act.forEach(function(s){ freeEnd(tm,PL[s]); });
  /* the sections this battle's crashes will raise fly from the crash on: no passing in them from that moment (exactly the section that will be stored:
     the crash spot on the rounded path, its phase rounded as the stored one). A rider going down attacks like anyone until his crash (he can be held
     too), so his crash spot is where his RESOLVED path is at tc: the sections and the get-up spots are rebuilt from the previous sweep's paths. */
  var ys2=ys.slice();
  var crashers=act.filter(function(s){ return crash[s]; });
  var spotOf=function(s,xEnd){ var pl=PL[s], keep=pl.xEnd; pl.xEnd=xEnd; var xc=Math.round(planX(pl,crash[s].tc)); pl.xEnd=keep; return xc; };
  /* ---- passing = War on track. From the front: a rider who would come within GAP of the rider ahead gets by only if that rider is down, or he beat
     that rider's card in this battle (the same table) or in his chase, or he gained more than PT s on him in this beat; else he is HELD at the
     following gap (every rider ahead at the window's start is checked: riders ahead can end the window in another order; he ends behind every one he
     may not pass). A rider who gets up from a crash inside this window rejoins BEHIND the riders who passed him while he was down (he attacks them from
     the next battle): sweeps until no new such constraint appears. ---- */
  var heldBy={}, extra={}, prevEnd={}, holdEnd={};
  act.forEach(function(s){ var R=tm.r[s]; var h=R.hold.filter(function(q){ return q[1]>S&&q[1]<E; })[0]; if(h) holdEnd[s]=h; });
  /* the sections of this battle's crashes are centred on the crash spots of the FREE paths, once (a rider going down can be held a little, and
     re-centring the section on his held spot made the sweeps oscillate); the stored section is that one (crash.xs); his hold sits where his resolved
     path is at the crash moment, and the get-up spots of the rejoin rule follow the resolved paths sweep by sweep */
  var spotsFree={}; crashers.forEach(function(s){ var c=crash[s], xc=spotOf(s,Math.round(PL[s].xFree)); spotsFree[s]=xc; c.xs=xc; ys2.push({ c:r3(xc/U-Math.floor(xc/U)), z:P.ZETA, t0:c.tc, t1:c.tc+Math.max((c.H||0)+2000,Math.round(P.YLAPS*pM)) }); });
  function getUps(endOf){ var spots={}; crashers.forEach(function(s){ var c=crash[s], xc=spotOf(s,endOf(s)); spots[s]=xc; if(c.kind==="remount"&&c.tc+c.H<E) holdEnd[s]=[c.tc,c.tc+c.H,xc]; }); return spots; }
  function resolve(){
    ord.forEach(function(s){ var p2=PL[s]; if(p2.shape){ p2.fw=p2.shape.fw; p2.rideStart=p2.shape.rideStart; p2.pieces=p2.shape.pieces; p2.riding=p2.shape.riding; p2.v=p2.shape.v; } p2.xEnd=Math.round(p2.xFree); heldBy[s]=null; });   /* (decided on the stored, rounded positions: the crossing checked is the one written) */
    for(var ii=1;ii<ord.length;ii++){
      var a=ord[ii], pa=PL[a]; if(!pa.fw&&pa.riding<=0) continue;   /* (a rider on his turn-1 funnel line attacks too: a rider back on his bike ahead of him can be slower) */
      var vA=Math.max(1e-9,pa.v), gapU=P.GAP*1000*vA, xF=pa.xFree, st0=pa.fw?pa.x0:pa.xRide0;
      var xe=Math.round(xF), by=-1;
      for(var it=0;it<8;it++){            /* a hold behind one rider moves his crossing with another (a yellow section): until it is stable */
        var lim=Infinity; pa.xEnd=xe;
        for(var j=ii-1;j>=0;j--){
          var d=ord[j], pd=PL[d]; if(X0[d]-X0[a]>=U/2) break;
          if(pa.fw&&pd.fw&&tm.r[a].t1===tm.r[a].t10&&tm.r[d].t1===tm.r[d].t10&&pd.xEnd>=Math.round(pd.xFree)) continue;   /* (two turn-1 funnel lines from the gate never cross; a line that was ever held or paused can) */
          var ca=crash[a], atEnd=xe>=pd.xEnd-gapU, beforeDown=!!ca&&planX(pa,ca.tc)>=planX(pd,ca.tc)-gapU;
          var kd=pd.funnel&&pd.rideStart>S&&pd.rideStart<E?pd.rideStart:null, beforeKink=kd!=null&&planX(pa,kd)>=planX(pd,kd)-gapU;   /* d's turn-1 funnel ends in this window: his path bends there (slow, then his pace) */
          if(!atEnd&&!beforeDown&&!beforeKink) continue;         /* he does not catch d (nor before his own crash, nor before d's bend) */
          var hd=holdEnd[d], dc=crash[d], downD=(!!dc&&planX(pa,dc.tc)<=planX(pd,dc.tc))||stateAt(G,d,E-1)!=="run"||(!!hd&&planX(pa,hd[1])>=hd[2]);   /* down when he reaches the spot: passed freely (a rider who goes down in this window only from his crash moment on) */
          var ra=res[a], rd=res[d], duel=!!(ra&&rd&&ra.ti===rd.ti&&!ra.alone&&(ra.win||ra.cv-rd.cv>=P.PC)&&(j>=3||ra.cv-rd.cv>=P.PC+P.PCL));   /* he won the table or his card beat the card ahead by PC ranks; a top-3 rider only to a card PC + PCL ranks higher */
          var chaseWin=!!(ra&&ra.ct===d&&ra.cd>0&&(j>=3||ra.cdv>=P.PC+P.PCL));   /* he beat the card of the rider he chased */
          var edge=((xF-X0[a])-(pd.xEnd-X0[d]))/vA/1000;
          var ok=downD||duel||chaseWin||edge>P.PT;
          var tX=xe>pd.xEnd?E:beforeDown&&planX(pa,ca.tc)>planX(pd,ca.tc)?ca.tc:kd!=null&&planX(pa,kd)>planX(pd,kd)?kd:-1;   /* (a pass that is undone later in the window: before his own crash, or before d's bend) */
          if(ok&&!downD&&ys2.length&&tX>0){ /* no passing inside a flying yellow section (this battle's new ones too): where do the paths cross? */
            var lo=S, hi=tX; for(var q=0;q<22;q++){ var mid=(lo+hi)/2; if(planX(pa,mid)>planX(pd,mid)) hi=mid; else lo=mid; }
            var xc=planX(pa,hi), hiT=hi; if(ys2.some(function(y){ return hiT>=y.t0&&hiT<y.t1&&inSection(xc,y); })) ok=false; }
          if(!ok){
            var sep=(pd.xEnd-xF)/vA/1000, pr=Math.max(0,Math.min(1,(P.GAP-sep)/(2*P.GAP))), hg=P.GAP*(1.25-0.65*pr)*1000*vA;
            var cap=Infinity, f;
            if(atEnd){ cap=pd.xEnd-hg; if(dc){ f=doneFrac(pa,dc.tc); if(f>0) cap=Math.max(cap,st0+(planX(pd,dc.tc)-hg-st0)/f); } }   /* d goes down at tc: held behind him only until then */
            if(beforeDown){ f=doneFrac(pa,ca.tc); if(f>0) cap=Math.min(cap,st0+(planX(pd,ca.tc)-hg-st0)/f); }   /* he goes down at his tc: behind d until then */
            if(beforeKink){ f=doneFrac(pa,kd); if(f>0) cap=Math.min(cap,st0+(planX(pd,kd)-hg-st0)/f); }   /* behind d at d's bend too */
            if(cap<lim){ lim=cap; by=d; }
          }
        }
        if(extra[a]) Object.keys(extra[a]).forEach(function(k){ var d2=+k, pd2=PL[d2], xd=prevEnd[d2]!=null?Math.min(prevEnd[d2],pd2.xEnd):pd2.xEnd; var cap2=xd-P.GAP*1000*vA;
          var kd2=pd2.funnel&&pd2.rideStart>S&&pd2.rideStart<E?pd2.rideStart:null; if(kd2!=null){ var f2=doneFrac(pa,kd2); if(f2>0) cap2=Math.min(cap2,st0+(planX(pd2,kd2)-P.GAP*1000*vA-st0)/f2); }   /* behind him at his funnel bend too */
          if(cap2<lim){ lim=cap2; by=d2; } });
        if(lim<xe-0.5){
          if(pa.funnel&&!pa.fw&&!crash[a]&&lim<pa.xRide0){ pa.fw=true; pa.rideStart=E; pa.pieces=[]; pa.riding=0; pa.v=Math.max(1e-9,(pa.xRide0-pa.x0)/Math.max(1,pa.funnel.end-S)); st0=pa.x0; continue; }   /* held on the start straight itself: the whole window becomes his funnel line (re-evaluated) */
          xe=Math.max(st0,Math.floor(lim)); } else break;
      }
      pa.xEnd=xe; heldBy[a]=xe<xF?by:null;
    }
  }
  for(var sweep=0;sweep<6;sweep++){
    var spots0=getUps(function(s){ return sweep===0?Math.round(PL[s].xFree):prevEnd[s]; });
    resolve();
    var added=false;
    act.forEach(function(a){ var h=holdEnd[a]; if(!h) return;
      act.forEach(function(d){ if(d===a||X0[d]>=X0[a]||(extra[a]&&extra[a][d])) return; if(planX(PL[d],h[1])>=h[2]){ (extra[a]=extra[a]||{})[d]=1; added=true; } }); });
    ord.forEach(function(s){ prevEnd[s]=PL[s].xEnd; });
    var moved=crashers.some(function(s){ return spotOf(s,PL[s].xEnd)!==spots0[s]; });
    if(!added&&!moved) break;
  }
  ord.forEach(function(a){ var pa=PL[a]; if(pa.xEnd<pa.xFree-0.5){ tm.r[a].held++; var lost=(pa.xFree-pa.xEnd)/Math.max(1e-9,pa.v)/1000; if(lost>0.05) ev.push({ e:"held", s:a, by:heldBy[a], t:E, lost:r2(lost) }); } });
  /* ---- write the window ---- */
  var prevFlag=tm.flag;
  act.forEach(function(s){ writeWindow(G,tm,s,PL[s],ev); });
  /* a timed race: the clock ran out at tEnd; the rider leading the race then (by distance) starts the last K laps at his next crossing (the board: white flag / 2 to go) */
  if(tm.fmt&&tm.Lf==null&&E>=tm.fmt.min*60000){ var tEnd=tm.fmt.min*60000;
    if(tm.tl==null||tm.r[tm.tl].dnf){ var best=-1, s1; for(s1=0;s1<n;s1++){ var R1=tm.r[s1]; if(R1.dnf&&R1.dnf.t<=tEnd) continue; if(R1.dnf) continue; var pr1=progressAt(G,s1,tEnd); if(tm.tl==null||pr1>best){ best=pr1; tm.tl=s1; } } }
    var lr=tm.r[tm.tl], k2=0; while(k2<lr.T.length&&lr.T[k2]<tEnd) k2++;
    if(k2<lr.T.length){ tm.Lf=k2+1+tm.fmt.plus; tm.L=tm.Lf; ev.push({ e:"timeup", t:tEnd, board:lr.T[k2], s:tm.tl, lap:k2+1, plus:tm.fmt.plus, L:tm.Lf }); } }
  if(tm.flag==null&&(!tm.fmt||tm.Lf!=null)){ var fl=null, w=-1; act.forEach(function(s){ var T=tm.r[s].T; if(T.length>=tm.L&&(fl==null||T[tm.L-1]<fl)){ fl=T[tm.L-1]; w=s; } }); if(fl!=null){ tm.flag=fl; tm.win=w; } }
  /* the finish: every rider still in takes the flag at his first line after it and STOPS THERE in the model (progress = his laps from that moment: the
     views roll him on at cool-down pace, as with the per-lap model); a crash of this window after his line is void (he had finished) */
  if(tm.flag!=null) act.forEach(function(s){ var R=tm.r[s]; if(R.fin||(R.dnf&&(R.dnf.why!=="crash"||R.dnf.t<S))) return;
    var k3=0; while(k3<R.T.length&&R.T[k3]<tm.flag) k3++;
    if(k3<R.T.length) finishAt(G,tm,s,k3,X0[s],S,E,ev,crash); });
  /* out of cards: he rides on to his next line and pulls off there (DNF "cards", no yellow) */
  act.forEach(function(s){ var R=tm.r[s], p2=G.r[s]; if(p2.out&&p2.dnf&&p2.dnf.why==="cards"&&!R.dnf&&!R.pend&&!R.fin) R.pend={ why:"cards", from:Math.floor(PL[s].x0/U) }; });
  act.forEach(function(s){ var R=tm.r[s]; if(!R.pend||R.dnf||R.fin) return; var k4=R.pend.from+1; if(R.T.length>=k4){ var tl=R.T[k4-1]; R.T=R.T.slice(0,k4); R.dnf={ why:"cards", lap:k4, at:1, t:tl, x:k4*U }; ev.push({ e:"dnf", s:s, why:"cards", t:tl }); } });
  for(var s2=0;s2<n;s2++) tm.r[s2].h=G.r[s2].pk.length;
  /* the yellow flags this battle raised: a section around the crash, from the crash for a typical lap (at least the hold + 2 s) */
  act.forEach(function(s){ var c=crash[s]; if(!c) return; var xs=c.xs!=null?c.xs:c.x, ph=xs/U-Math.floor(xs/U), t1=c.tc+Math.max((c.H||0)+2000,Math.round(P.YLAPS*pM));
    var same=tm.yz.filter(function(q){ return q.t0===c.tc&&Math.abs(q.c-ph)<0.02; })[0];
    if(same){ if(same.by.indexOf(s)<0) same.by.push(s); } else { tm.yz.push({ c:r3(ph), z:P.ZETA, t0:c.tc, t1:t1, by:[s], lap:Math.floor(xs/U)+1 }); ev.push({ e:"yellow", t:c.tc, c:r3(ph), until:t1, by:[s] }); } });
  (L0.tabs||[]).forEach(function(tab,ti){ if(tab.war>0){ var losers=tab.s.filter(function(s){ return L0.w&&L0.w[s]&&s!==tab.win; }); ev.push({ e:"war", k:b, t:S, depth:tab.war, win:tab.win, losers:losers, tab:ti, flash:tab.war<2 }); } });
  /* the YOU readout per beat: what this battle was worth.
     R.g = the last 12 beats: [beat, s gained on the rider directly ahead at the window's start (+ = closed in), s gained on the leader (+ = closed in), that rider ahead (seat | -1), kind, chase target] */
  { var runAt=function(t){ return act.filter(function(s){ return !(tm.r[s].dnf&&tm.r[s].dnf.t<=t); }); }, ord1=orderAt(G,E,runAt(E)), ld0=ord[0], ld1=ord1[0];
    var gapTo=function(a,f,t){ var iv=intervalAt(G,a,f,t); return isFinite(iv)?iv/1000:null; };
    act.forEach(function(s){ var R=tm.r[s], i0=ord.indexOf(s), ah=i0>0?ord[i0-1]:-1;
      var a0=ah>=0?gapTo(ah,s,S):null, a1=ah>=0?gapTo(ah,s,E):null, l0=s!==ld0?gapTo(ld0,s,S):0, l1=s!==ld1?(ld1!=null?gapTo(ld1,s,E):null):0;   /* (ld1 == null: every rider out by the window's end, the reference's crash) */
      var r=res[s]||{ alone:true }, kind=!r.alone?(r.war>0&&r.fought?(r.win?"W":"w"):r.win?"T":"t"):r.ct!=null?(r.cd>0?"C":r.cd<0?"c":"e"):stateAt(G,s,S)==="down"?"D":"A";   /* his battle: war won/lost, table won/lost, chase won/lost/even, alone, down */
      R.g.push([b,a0!=null&&a1!=null?r2(a0-a1):null,l0!=null&&l1!=null&&b>1?r2(l0-l1):null,ah,kind,r.ct!=null?r.ct:-1]); if(R.g.length>12) R.g.shift(); }); }
  tm.k=b;
  stories(G,b,S,E,ev,act,X0,prevFlag,ord);
  tm.ev.push({ k:b, ev:ev }); if(tm.ev.length>8) tm.ev.shift();
  var left=0; for(var s3=0;s3<n;s3++){ var R3=tm.r[s3]; if(!R3.fin&&!R3.dnf) left++; }
  if(left===0) tm.done=true;
  return ev;
}
/* write rider s's window: the funnel knot, the hold / stop knots, the end position, the line crossings */
function writeWindow(G,tm,s,pl,ev){
  var R=tm.r[s], S=pl.S, E=pl.E;
  pl.xEnd=Math.round(Math.max(pl.fw?pl.x0:pl.xRide0,pl.xEnd));
  var kn=[];
  if(pl.funnel&&!pl.fw&&pl.funnel.end<E) kn.push([pl.funnel.end,pl.xRide0]);
  if(pl.funnel&&pl.cr&&pl.cr.tc===pl.funnel.end) R.t1=pl.cr.tc;   /* his funnel ended at his crash */
  else if(pl.fw&&pl.funnel){ var t1u=Math.round(tm.t1*U); if(pl.xEnd<t1u&&R.t10>0){ var t1n=Math.round(E+(t1u-pl.xEnd)*R.t10/t1u); if(t1n>R.t1) R.t1=t1n; } }   /* held on the start straight: turn 1 later, at his funnel speed */
  pl.pieces.forEach(function(q){ var p0=q[0], p1=q[1]; if(p0>S) kn.push([p0,Math.round(planX(pl,p0))]); if(p1<E) kn.push([p1,Math.round(planX(pl,p1))]); });
  kn.sort(function(a,c){ return a[0]-c[0]; });
  var last=-1; kn.forEach(function(k){ var t=k[0], x=k[1]; if(t>S&&t<E&&t!==last){ R.ik.push([Math.round(t),x]); last=t; } });
  R.ik.sort(function(a,c){ return a[0]-c[0]; });
  R.x.push(pl.xEnd-xAbs(R));
  if(pl.cr&&pl.cr.kind==="remount"){ var xc=Math.round(planX(pl,pl.cr.tc)); pl.cr.x=xc; R.hold.push([pl.cr.tc,pl.cr.tc+pl.cr.H,xc]); R.cr++; R.fire=Math.round(tm.P.FIREL*tm.p/(D/1000));
    var ce={ e:"crash", s:s, kind:"remount", t:pl.cr.tc, up:pl.cr.tc+pl.cr.H, at:r3(xc/U-Math.floor(xc/U)), lap:Math.floor(xc/U)+1, loss:r1(pl.cr.H/1000), dv:pl.cr.dv }; if(pl.cr.pile) ce.pile=1; ev.push(ce); }
  if(pl.cr&&pl.cr.kind==="out"){ var xc2=pl.xEnd; pl.cr.x=xc2; R.dnf={ why:"crash", lap:Math.floor(xc2/U)+1, at:r3(xc2/U-Math.floor(xc2/U)), t:pl.cr.tc, x:xc2 }; ev.push({ e:"crash", s:s, kind:"out", t:pl.cr.tc, at:R.dnf.at, lap:R.dnf.lap }); }
  var L0=Math.floor(pl.x0/U), L1=Math.floor(pl.xEnd/U);
  for(var L=L0+1;L<=L1;L++){ var t=timeAt(G,s,L); if(t!=null&&(!R.dnf||t<=R.dnf.t)) R.T.push(Math.round(t)); }
}
/* rider s took the flag at his line i+1 (time T[i], in window [S, E)): he is in, and his knots stop at the line (no riding past it in the model);
   a crash of this window after that moment never happened (no hold, no crash-out, no yellow) */
function finishAt(G,tm,s,i,x0,S,E,ev,crash){
  var R=tm.r[s], laps=i+1, tf=R.T[i], xl=laps*U;
  R.fin={ laps:laps, t:tf }; R.T=R.T.slice(0,laps); G.r[s].fin=true;
  var voided=[];
  if(R.dnf&&R.dnf.why==="crash"&&R.dnf.t>tf){ voided.push(R.dnf.t); R.dnf=null; G.r[s].dnf=null; }
  R.hold=R.hold.filter(function(h){ if(h[0]>=tf){ R.cr--; voided.push(h[0]); return false; } return true; });
  if(voided.length){ for(var q=ev.length-1;q>=0;q--) if(ev[q].e==="crash"&&ev[q].s===s&&ev[q].t>=tf) ev.splice(q,1); if(crash) crash[s]=null; R.fire=0; }
  R.ik=R.ik.filter(function(k){ return k[0]<tf; });
  if(tf>S&&tf<E) R.ik.push([tf,xl]);
  R.x[R.x.length-1]=xl-x0;
  setCache(R,null);   /* (the knots changed with their counts unchanged: the cache must go; never an enumerable field in a save) */
}
/* ---------------- stories: passes (the exact crossing), lead changes, lapped, fastest, white flag, finish, battles ---------------- */
function stories(G,b,S,E,ev,act,X0,prevFlag,ord0){
  var tm=G.tm;
  var xe={}; act.forEach(function(s){ xe[s]=tm.r[s].dnf&&tm.r[s].dnf.t<E?tm.r[s].dnf.x:xAbs(tm.r[s]); });
  var o0=ord0, pos0={}; o0.forEach(function(s,i){ pos0[s]=i; });
  var o1=act.slice().sort(function(a,c){ return (xe[c]-xe[a])||((finT(tm.r[a],E)-finT(tm.r[c],E))||0)||(a-c); }), pos1={}; o1.forEach(function(s,i){ pos1[s]=i; });
  for(var i=0;i<o1.length;i++){ var a=o1[i]; for(var j=i+1;j<o1.length;j++){ var d=o1[j]; if(!(pos0[d]<pos0[a])) continue; if(X0[d]-X0[a]>=U/2) continue;
    var lo=S, hi=E; for(var q=0;q<16;q++){ var mid=(lo+hi)/2; if(progressAt(G,a,mid)>progressAt(G,d,mid)) hi=mid; else lo=mid; }
    var pr=progressAt(G,a,hi), downD=stateAt(G,d,hi)!=="run";
    ev.push({ e:"pass", k:b, a:a, d:d, t:Math.round(hi), at:r3(pr-Math.floor(pr)), lap:Math.floor(pr)+1, pos:pos1[a]+1, crash:downD?1:0 }); } }
  var running=o1.filter(function(s){ return !(tm.r[s].dnf&&tm.r[s].dnf.t<E); }), lead=running.length?running[0]:-1;
  if(lead>=0&&tm.lead>=0&&lead!==tm.lead) ev.push({ e:"lead", s:lead, from:tm.lead, t:E });
  if(lead>=0) tm.lead=lead;
  act.forEach(function(s){ var R=tm.r[s], n0=Math.floor(X0[s]/U); for(var k=Math.max(2,n0+1);k<=R.T.length;k++){ var lt=(R.T[k-1]-R.T[k-2])/1000;
    if(!R.hold.some(function(h){ return h[0]>=R.T[k-2]&&h[0]<R.T[k-1]; })&&(!tm.best||lt<tm.best.t-0.05)){ tm.best={ s:s, k:k, t:r3(lt) }; if(k>=3) ev.push({ e:"fastest", s:s, k:k, t:R.T[k-1], time:r3(lt) }); } } });
  var ldr=lead>=0?tm.r[lead]:null;
  var lapsKnown=!tm.fmt||tm.Lf!=null;   /* a timed race knows its laps only once the clock has run out */
  if(ldr&&lapsKnown&&tm.white==null&&ldr.T.length>=tm.L-1&&tm.L>1){ tm.white=ldr.T[tm.L-2]; ev.push({ e:"lastlap", t:tm.white, p1:running[0], p2:running[1], gap:running.length>1?r2(intervalAt(G,running[0],running[1],E)/1000):null }); }
  if(ldr&&lapsKnown&&tm.two==null&&tm.L>2&&(tm.fmt?tm.fmt.plus>=2:tm.ser!=="sx")&&ldr.T.length>=tm.L-2){ tm.two=ldr.T[tm.L-3]; ev.push({ e:"twotogo", t:tm.two }); }
  if(lead>=0) act.forEach(function(s){ if(s===lead||tm.lapped[s]||tm.r[s].dnf) return; if(xe[lead]-xe[s]>=U){ tm.lapped[s]=b; ev.push({ e:"lapped", s:s, by:lead, t:E }); } });
  if(prevFlag==null&&tm.flag!=null) ev.push({ e:"flagfall", s:tm.win, t:tm.flag });
  if(tm.flag!=null&&!tm.fin2){ var st=standings(G); if(st.length>1&&st[1].dnf) tm.fin2=1; else if(st.length>1&&tm.r[st[1].s].fin){ tm.fin2=1; if(st[1].laps===st[0].laps){ var m=(st[1].t-st[0].t)/1000; ev.push({ e:"finish", win:st[0].s, second:st[1].s, margin:r3(m), photo:m<0.3, t:tm.r[st[1].s].fin.t }); } } }
  var seen={};
  for(var i2=1;i2<running.length&&i2<12;i2++){ var a2=running[i2], d2=running[i2-1], iv=intervalAt(G,d2,a2,E)/1000; if(iv<1.0){ var key=a2+">"+d2, c=(tm.bt[key]||0)+1; seen[key]=c; if(c===3||c%6===0) ev.push({ e:"battle", a:a2, d:d2, pos:i2, gap:r2(iv), beats:c, t:E }); } }
  tm.bt=seen;
}
/* War ended before the flag (every other rider out): the survivors ride on alone to the flag */
function complete(G){
  var tm=G.tm, guard=0;
  while(tm&&!tm.done&&guard++<3000){ var tabs=[]; G.r.forEach(function(p,s){ if(!p.out&&!p.fin) tabs.push({ s:[s], win:s, alone:1, war:0 }); }); G.lastLap={ b:tm.k+1, c:{}, w:{}, tabs:tabs, cr:[] }; beat(G); }
}
/* ---------------- the classification, the tower ---------------- */
function standings(G){
  var tm=G.tm, n=G.n, rows=[];
  for(var s=0;s<n;s++){ var R=tm.r[s], T=R.T; rows.push({ s:s, laps:R.fin?R.fin.laps:T.length, t:R.fin?R.fin.t:(T.length?T[T.length-1]:0), dnf:R.dnf, crashes:R.cr, outN:G.r[s].outN|0, lc:G.r[s].lc|0 }); }
  rows.sort(function(a,b){ return (!!a.dnf-!!b.dnf)||(a.dnf&&b.dnf?((b.dnf.x-a.dnf.x)||(b.dnf.t-a.dnf.t)||(b.outN-a.outN)||(a.s-b.s)):(b.laps-a.laps)||(a.t-b.t)||(b.lc-a.lc)||(a.s-b.s)); });
  var top=rows[0];
  rows.forEach(function(r,i){ r.place=i+1; if(r.dnf){ r.gap="DNF"; return; } var dl=top.laps-r.laps; r.gs=Math.round(r.t-top.t)/1000; r.gap=i===0?"Leader":dl>0?"+"+dl+(dl>1?" Laps":" Lap"):"+"+r.gs.toFixed(3);
    r.int=i===0||rows[i-1].dnf||rows[i-1].laps!==r.laps?null:Math.round(r.t-rows[i-1].t)/1000; });   /* (int: the readouts' interval, never used by the order) */
  return rows;
}
/* what Round.record needs: order = rider ids (place 1 first), dnf = {id: {lap, why}}, hs = the holeshot rider's id; margin (the readouts) */
function result(G){
  var st=standings(G), dnf={}; st.forEach(function(r){ if(r.dnf) dnf[G.r[r.s].id]={ lap:r.dnf.lap, why:r.dnf.why }; });
  return { order:st.map(function(r){ return G.r[r.s].id; }), dnf:dnf, hs:G.tm.hs>=0?G.r[G.tm.hs].id:null, margin:st.length>1&&!st[1].dnf&&st[1].laps===st[0].laps&&G.tm.r[st[1].s].fin?(st[1].t-st[0].t)/1000:null };
}
/* the live tower at clock t (finish-aware). By distance; a rider who has taken the flag stands on his line (progress = his laps), and riders in at the
   same lap are in the order they crossed it (earlier first), ahead of anyone still riding to that line; DNFs last, as in standings(). After the last rider
   is in, the tower IS the classification (a test checks it). A finished rider's gap is the classification's (line to line). */
function tower(G,t){
  var tm=G.tm, rows=[];
  for(var s=0;s<G.n;s++){ var R=tm.r[s]; rows.push({ s:s, pr:progressAt(G,s,t), dnf:R.dnf&&t>=R.dnf.t?R.dnf:null, ft:R.fin&&t>=R.fin.t?R.fin.t:null }); }
  var lc=function(x){ return G.r[x].lc|0; }, on=function(x){ return G.r[x].outN|0; };
  rows.sort(function(a,b){ return (!!a.dnf-!!b.dnf)||(b.pr-a.pr)
    ||(a.dnf&&b.dnf?(b.dnf.t-a.dnf.t)||(on(b.s)-on(a.s)):0)
    ||((a.ft==null)-(b.ft==null))||(a.ft!=null&&b.ft!=null?(a.ft-b.ft)||(lc(b.s)-lc(a.s)):0)
    ||(a.s-b.s); });
  var ld=rows[0];
  rows.forEach(function(r,i){ r.place=i+1; r.lap=r.ft!=null?tm.r[r.s].fin.laps:Math.floor(r.pr)+1; if(r.dnf){ r.gap="DNF"; return; } if(i===0){ r.gap="Leader"; r.gs=0; return; }
    var ah=rows[i-1];
    if(r.ft!=null&&ld.ft!=null){   /* both in: the classification's gap (line to line); a lapped finisher: laps down */
      var dl=tm.r[ld.s].fin.laps-tm.r[r.s].fin.laps; r.gs=dl>0?null:Math.round(r.ft-ld.ft)/1000; r.gap=dl>0?"+"+dl+(dl>1?" Laps":" Lap"):"+"+r.gs.toFixed(3);
      r.int=ah.ft!=null&&tm.r[ah.s].fin.laps===tm.r[r.s].fin.laps?Math.round(r.ft-ah.ft)/1000:null; return; }
    var tl=timeAt(G,ld.s,r.pr); r.gs=tl==null?null:Math.round(t-tl)/1000; var ta=ah.dnf?null:timeAt(G,ah.s,r.pr); r.int=ta==null?null:Math.round(t-ta)/1000;
    var dl2=Math.floor(ld.pr)-Math.floor(r.pr)-(ld.pr-Math.floor(ld.pr)<r.pr-Math.floor(r.pr)?1:0); if(dl2>0){ r.gap="+"+dl2+(dl2>1?" Laps":" Lap"); r.int=null; } });   /* (the readouts: a rider a lap or more down shows the laps, as the per-lap tower) */
  return rows;
}
function leaderLine(G,k){ if(k<1) return 0; var best=null; for(var i=0;i<G.n;i++){ var T=G.tm.r[i].T; if(T.length>=k&&(best==null||T[k-1]<best)) best=T[k-1]; } return best; }
function winAt(tm,b){ return (tm.g0|0)+(b-1-(tm.k0|0))*D; }   /* the start of beat b's window */
function clockLimit(G){ var tm=G.tm; return tm.done?Infinity:winAt(tm,tm.k+1); }   /* the safety net: the end of the last window decided */
/* the next lock (ms of race clock): the moment beat k+1's cards turn (1 s before its window); Infinity when the race is decided */
function nextLock(G){ var tm=G.tm; return tm.done?Infinity:winAt(tm,tm.k+1)-1000; }
/* the clock window [t0, t1] (ms) in which rider s lies at his crash site in lap k (a remount's hold); null when he does not; a crash-out: [crash time, Infinity] */
function holdWindow(G,s,k){
  var R=G.tm.r[s], d=R.dnf;
  if(d&&d.why==="crash"&&d.lap===k) return [d.t,Infinity];
  for(var i=0;i<R.hold.length;i++){ var h=R.hold[i]; if(Math.floor(h[2]/U)+1===k) return [h[0],h[1]]; }
  return null;
}
/* the phase of lap k where rider s goes down (a hold, or a crash-out): [phase, kind] or null (the 3D view plans its crash script on it) */
function crashOn(G,s,k){
  var R=G.tm.r[s], d=R.dnf;
  if(d&&d.why==="crash"&&d.lap===k) return [d.at,"out"];
  for(var i=0;i<R.hold.length;i++){ var h=R.hold[i]; if(Math.floor(h[2]/U)+1===k) return [h[2]/U-(k-1),"remount"]; }
  return null;
}
/* the yellow flags of the race in the per-lap model's shape: [{lap, c, z, t0, from, to, by}] (from the crash, flying until t1) */
function yellowWindows(G){ return G.tm.yz.map(function(y){ return { lap:y.lap, c:y.c, z:y.z, t0:y.t0, from:y.t0, to:y.t1, by:(y.by||[]).slice() }; }); }
/* the last completed lap (at clock t in ms; null = all) and the best clean lap of rider s (not lap 1, not a lap with a crash hold) */
function lapStats(G,s,t){
  var R=G.tm.r[s], T=R.T, last=null, lastK=0, best=null, bestK=0, i;
  for(i=0;i<T.length;i++){
    if(t!=null&&T[i]>t) break;
    var v=(T[i]-(i?T[i-1]:0))/1000; last=v; lastK=i+1;
    if(i>0&&!hasHold(R,T[i-1],T[i])&&(best==null||v<best)){ best=v; bestK=i+1; }
  }
  return { last:last, lastK:lastK, best:best, bestK:bestK };
}
function hasHold(R,a,b){ for(var i=0;i<R.hold.length;i++) if(R.hold[i][0]>=a&&R.hold[i][0]<b) return true; return false; }
/* where is everyone on the clock: w.at(s, t) = progressAt and w.state (run | down (w.h0, w.h1 = the hold's clock window) | out | pits | fin); w.rows(t) = the
   finish-aware tower at every t (never standings(): in a beat race the race is done only when the last rider is in) with the walker's cells (status,
   last / best lap; r.fl = the race's fastest lap so far is his) */
function walker(G){
  var w={ state:"run", h0:0, h1:0, G:G };
  w.at=function(s,t){ w.state=stateAt(G,s,t); if(w.state==="down"){ var h=holdAt(G.tm.r[s],t); w.h0=h[0]; w.h1=h[1]; } return progressAt(G,s,t); };
  w.rows=function(t){
    var rows=tower(G,t), fast=null, tm=G.tm;
    rows.forEach(function(r){
      var st=lapStats(G,r.s,t); r.last=st.last; r.best=st.best; r.bestK=st.bestK; r.lastK=st.lastK;
      if(st.best!=null&&(fast==null||st.best<fast.t)) fast={ s:r.s, t:st.best, k:st.bestK };
      w.at(r.s,t); r.status=w.state; if(w.state==="out"||w.state==="pits") r.dnf=r.dnf||tm.r[r.s].dnf;
    });
    rows.forEach(function(r){ r.fl=!!(fast&&fast.s===r.s); });
    return rows;
  };
  return w;
}
/* the per-beat packet (Party, the view): what window b added */
function packet(G,b){
  var tm=G.tm, lo=winAt(tm,b), hi=lo+D, e=tm.ev.filter(function(x){ return x.k===b; })[0];
  return { k:b, x:tm.r.map(function(R){ return R.x[b]!=null?R.x[b]:null; }), ik:tm.r.map(function(R){ return R.ik.filter(function(q){ return q[0]>lo&&q[0]<hi; }); }), T:tm.r.map(function(R){ return R.T.filter(function(t){ return t>=lo&&t<hi; }); }), hold:tm.r.map(function(R){ return R.hold.filter(function(h){ return h[0]>=lo&&h[0]<hi; }); }),
    dnf:tm.r.map(function(R){ return R.dnf&&R.dnf.t>=lo&&R.dnf.t<hi+60000?R.dnf:null; }), fin:tm.r.map(function(R){ return R.fin&&R.fin.t>=lo&&R.fin.t<hi?R.fin:null; }), yz:tm.yz.filter(function(y){ return y.t0>=lo&&y.t0<hi; }), flag:tm.flag, ev:e?e.ev:[] };
}
/* the events of beat b (the model's: passes, holds, crashes, yellows, the flags ...), or [] when they are gone (tm.ev keeps the last 8 beats) */
function events(G,b){ var e=G.tm.ev.filter(function(x){ return x.k===b; })[0]; return e?e.ev:[]; }

/* ================= OLD SAVES: a race saved under the per-lap model (time.js v3: one battle a lap) goes on under the beats =================
   adopt4(G, info) -> the same race as a beat race, from the per-lap model's clock limit g0 (the leader's line of the last lap decided): everything before
   g0 is kept EXACTLY (every rider's knots, line times, crash holds, crash-outs, out of cards, the holeshot, the start), the beat grid starts at g0, and every
   lap after that is ridden in beats. A war the save was in the middle of is finished first by the per-lap engine (War has no decisions). The War state
   (piles, kitty, aside, crashes, the holeshot) carries over as it is (its own deck: an old 26-card save keeps 26). A carried-over race keeps its saved
   lap count (no timed format: the clock of a race saved late can have run out long before). The race object G is changed IN PLACE (a save's G.race). */
function adopt4(G,info){
  var Race=RC(), Time=TM();
  var guard=0; while(!G.over&&G.phase==="war"&&guard++<64) Race.step(G);
  if(G.over) return G;
  var told=G.tm, cl=Time.clockLimit(G), g0=cl===Infinity?told.flag:cl, n=G.n;
  /* the War state, as a beat race keeps it */
  G.o.beat=10000; G.o.house=G.o.house!=null?G.o.house:G.o.cards;
  G.r.forEach(function(p){ p.fin=false; });
  G.cur={}; G.tb=[]; G.part=[]; G.bpart=[]; G.warN=0; G.down=0; G.need=[]; G.pick={}; G.phase="flip";
  var info2=assign({},info,{ fmt:"laps" });
  init(G,info2);
  var tm=G.tm, mB=tm.p/(D/1000);
  tm.fmt=null; tm.L=tm.Lr=Math.max(1,told.L|0||G.o.len|0);
  tm.g0=g0; tm.k0=G.battle; tm.k=G.battle; tm.hs=told.hs; tm.start=told.start; tm.lead=told.lead; tm.best=told.best; tm.from={ v:3, k:told.k, g0:g0 };
  for(var s=0;s<n;s++){
    var Ro=told.r[s], R=tm.r[s];
    R.g0=g0; R.f=Ro.f; R.n=Math.round(Ro.n*mB); R.q=Ro.q; R.cr=Ro.cr; R.fire=Math.round((Ro.fire||0)*mB); R.t1=Ro.t1||0; R.xs=Ro.xs*mB; R.held=Ro.held|0;
    /* the knots before g0 (and, for a rider already out of the race, up to where he stopped) */
    var gone=!!Ro.dnf, until=gone?Ro.dnf.t:g0, ik=[];
    var kmax=Ro.T.length+(Ro.dnf&&Ro.dnf.why==="crash"&&Ro.dnf.lap===Ro.T.length+1?1:0);
    for(var k=1;k<=kmax;k++){ var kn=Time.knots({ tm:told, n:n, r:G.r },s,k); if(!kn) break; (function(kk){ kn.forEach(function(q){ var ph=q[0], ms=q[1]; if(ms<until||(gone&&ms<=until)) ik.push([Math.round(ms),Math.round((kk-1+ph)*U)]); }); })(k); }
    /* keep strictly increasing times (a vertical step = two knots at the same phase: times differ; equal times only at a lap seam) */
    var ik2=[]; ik.forEach(function(q){ if(q[0]<=0) return; if(ik2.length&&q[0]<=ik2[ik2.length-1][0]){ ik2[ik2.length-1]=q; return; } ik2.push(q); });
    var x0=Math.round(Time.progressAt({ tm:told, n:n, r:G.r },s,Math.min(g0,until))*U);
    R.ik=ik2.filter(function(q){ return q[0]<g0||(gone&&q[0]>g0); });   /* (a knot AT g0 would double the beat grid's first knot: a rider out of cards at the line exactly at g0) */
    R.x=[x0];
    R.T=Ro.T.filter(function(t){ return t<=(gone?until:g0); });
    /* crash holds before g0 (a hold that runs past g0: the beats respect it) */
    Object.keys(Ro.hold||{}).forEach(function(kk){ var w=Time.holdWindow({ tm:told, n:n, r:G.r },s,+kk); if(w&&w[0]<g0&&isFinite(w[1])) R.hold.push([Math.round(w[0]),Math.round(w[1]),Math.round(Time.progressAt({ tm:told, n:n, r:G.r },s,w[0])*U)]); });
    if(gone){ var d=Ro.dnf; R.dnf={ why:d.why, lap:d.lap, at:d.at, t:d.t, x:Math.round((d.why==="crash"?d.lap-1+d.at:d.lap)*U) }; R.gone=true; }
  }
  /* the yellow flags still flying at g0 (or raised by the last lap's crashes) */
  Time.yellowWindows({ tm:told, n:n, r:G.r }).forEach(function(y){ var to=y.to!=null?y.to:(y.from!=null?y.from+tm.p*1000:null); if(y.from!=null&&to!=null&&to>g0) tm.yz.push({ c:y.c, z:y.z, t0:Math.round(y.from), t1:Math.round(to), by:y.by.slice(), lap:y.lap }); });
  return G;
}

/* ================= READOUTS (nothing below writes to G.tm) ================= */
var RWORD={ 11:"Jack", 12:"Queen", 13:"King", 14:"Ace", 15:"Joker" };
function cardWord(G,c){ if(c==null) return ""; var Rc=RC(); return Rc.isWild(G,c)?"wild "+Rc.shortName(c):Rc.shortName(c); }
function sx(x){ x=Math.abs(+x||0); return (x>=10?x.toFixed(1):x.toFixed(1))+" s"; }
/* the beat line of the YOU card (plan 6.3): what his last battle was and what it was worth. nameOf(seat) = "#12 Name". null before the first beat */
function beatLine(G,s,nameOf){
  var tm=G.tm, R=tm.r[s], nm=nameOf||function(x){ return "#"+(x+1); }, Rc=RC(); if(!R) return null;
  var t=null;
  if(R.fin) return { kind:"F", text:"Finished: "+(R.fin.laps===tm.L?"":"a lap down · ")+"the line at "+fmtRace(R.fin.t), sec:null };
  if(R.dnf) return { kind:"X", text:R.dnf.why==="crash"?"Crashed out on lap "+R.dnf.lap:"Out of cards: pulled off on lap "+R.dnf.lap, sec:null };
  var gg=R.g[R.g.length-1]; if(!gg) return null;
  var b=gg[0], kind=gg[4], ahead=gg[3], dA=gg[1], tgt=gg[5], L0=G.lastLap&&G.lastLap.b===b?G.lastLap:null, my=L0&&L0.c?L0.c[s]:null;
  var pile=!!(G.pile&&G.pile.indexOf(s)>=0&&b===1);
  if(pile) return { kind:"P", text:"Lowest card off the gate: down in the pack", sec:null };
  if(kind==="D") return { kind:"D", text:"Down: back on the bike soon", sec:null };
  var mine=my!=null?cardWord(G,my):"", sec=dA;
  if(kind==="T"||kind==="t"){
    var tab=null; if(L0) L0.tabs.forEach(function(x){ if(x.s.indexOf(s)>=0) tab=x; });
    var others=tab?tab.s.filter(function(x){ return x!==s; }):[];
    if(kind==="T") t=(mine?mine+" beats ":"Table won: beats ")+others.slice(0,2).map(function(x){ return nm(x)+(L0&&L0.c[x]!=null?"'s "+cardWord(G,L0.c[x]):""); }).join(" and ")+(others.length>2?" and "+(others.length-2)+" more":"");
    else t=(tab&&tab.win>=0?nm(tab.win)+(L0&&L0.c[tab.win]!=null?"'s "+cardWord(G,L0.c[tab.win]):"")+" takes it":"A dead heat at the table")+(mine?" (your "+mine+")":"");
  }
  else if(kind==="W") t="War won"+(mine?" with "+mine:"");
  else if(kind==="w") t="War lost";
  else if(kind==="C") t="Chasing "+nm(tgt)+": your "+(mine||"card")+" beats his"+(L0&&L0.c[tgt]!=null?" "+cardWord(G,L0.c[tgt]):"");
  else if(kind==="c") t="Chasing "+nm(tgt)+": his"+(L0&&L0.c[tgt]!=null?" "+cardWord(G,L0.c[tgt]):" card")+" beats your "+(mine||"card");
  else if(kind==="e") t="Chasing "+nm(tgt)+": "+(mine||"cards")+" even";
  else if(kind==="A") t=ahead<0?"Leading"+(mine?": your "+mine:""):"Riding alone"+(mine?": "+mine:"");
  if(t==null) return null;
  return { kind:kind, text:t+(sec!=null&&Math.abs(sec)>=0.05?" · "+(sec>0?"+":"-")+sx(sec)+(ahead>=0?" on "+nm(ahead):""):""), sec:sec, ahead:ahead, b:b };
}
function fmtRace(msv){ var T=TM(); return T&&T.fmtRace?T.fmtRace(msv):String(msv); }
/* the race clock head of the tower (plan 6.2): "12:40 + 1 lap" counting down a timed race, "TIME'S UP · last lap", "2 LAPS TO GO", "LAST LAP", "Lap 7 of 20" */
function clockHead(G,t){
  var tm=G.tm; if(!tm) return "";
  if(tm.flag!=null&&t>=tm.flag) return "Checkered flag";
  var lead=-1, best=-1; for(var s=0;s<G.n;s++){ var R=tm.r[s]; if(R.dnf&&t>=R.dnf.t) continue; var pr=progressAt(G,s,t); if(pr>best){ best=pr; lead=s; } }
  var lap=Math.max(1,Math.floor(best)+1);
  if(tm.white!=null&&t>=tm.white) return "Last lap";
  if(tm.two!=null&&t>=tm.two) return "2 laps to go";
  if(tm.fmt){
    var left=tm.fmt.min*60000-t;
    if(left>0){ var sec=Math.ceil(left/1000), m=Math.floor(sec/60), ss=sec-m*60; return m+":"+(ss<10?"0":"")+ss+" + "+tm.fmt.plus+(tm.fmt.plus>1?" laps":" lap"); }
    return "Time's up · "+(tm.Lf!=null?Math.max(0,tm.Lf-lap+1)+(tm.Lf-lap+1===1?" lap":" laps")+" to go":"the leader's next line");
  }
  return "Lap "+Math.min(lap,tm.L)+" of "+tm.L;
}
/* a model event as a log line (the page's track events): null = nothing worth a line */
function eventLine(G,e,nameOf,me){
  var nm=nameOf||function(x){ return "#"+(x+1); }, human=me||function(){ return false; };
  switch(e.e){
    case "timeup": return "Time's up! "+(e.plus>1?e.plus+" more laps":"One more lap")+" after the leader's next line.";
    case "twotogo": return "Two laps to go.";
    case "lastlap": return "White flag: last lap!";
    case "flagfall": return e.s>=0?"Checkered flag! "+nm(e.s)+" wins.":"Checkered flag!";
    case "chase": return human(e.s)?nm(e.s)+" is reeling in "+nm(e.d)+".":null;
  }
  return null;
}

/* ================= THE ANNOUNCERS' BRIDGE (part 1 of the plan's push order: the booth is taught about beats in part 2) =================
   The commentator (announce.js) was written for one battle a lap: a lap starts with its cards ("reveal" w 0), its story is planned when the lap's result
   is in ("win" / "next" / "flag"), and it reads the per-lap record G.tm.laps. Until it learns the beats, a beat race is fed to it LAP-SHAPED, so it keeps
   talking and never says a wrong thing: the lap starts at the leader's own line on the race clock (bridge.lap), a crash is fed as the bike goes down
   (bridge.down), a pass for the lead as it happens (bridge.lead), the checkered flag at the winner's line (bridge.flag); each beat's war calls, outs and
   the start come with the beat (bridge.beat). The lap numbers it hears end exactly at its own count of laps (a timed race finds its laps on the clock:
   until it knows them, the lap it hears stops 2 short of its count, so the white flag and "2 to go" are never early). G.tm.laps is kept for it as a
   NON-enumerable record (never saved; rebuilt from the last beats after a reload): the passes of each lap. */
function lapsRec(G){
  var tm=G.tm; if(!tm) return [];
  if(!tm.laps){ try{ Object.defineProperty(tm,"laps",{ value:[], writable:true, configurable:true, enumerable:false }); Object.defineProperty(tm,"lapsK",{ value:0, writable:true, configurable:true, enumerable:false }); }catch(e){ return []; } }
  tm.ev.forEach(function(b){ if(b.k<=tm.lapsK) return; tm.lapsK=b.k;
    b.ev.forEach(function(e){ if(e.e!=="pass") return; var L=null; for(var i=0;i<tm.laps.length;i++) if(tm.laps[i].k===e.lap){ L=tm.laps[i]; break; }
      if(!L){ L={ k:e.lap, ev:[] }; tm.laps.push(L); tm.laps.sort(function(a,c){ return a.k-c.k; }); if(tm.laps.length>4) tm.laps.shift(); }
      L.ev.push({ e:"pass", k:e.lap, a:e.a, d:e.d, at:e.at, pos:e.pos, crash:e.crash||0 }); }); });
  return tm.laps;
}
function bridge(){
  var st={ b:0, held:{}, flagged:false };
  function synth(G,k){   /* the lap number the booth hears for the leader's lap k (its own count of laps = the race's o.len) */
    var tm=G.tm, len=Math.max(1,G.o.len|0), known=!tm.fmt||tm.Lf!=null;
    return known?k+(len-tm.L):Math.min(k,Math.max(1,len-2));
  }
  function cardsNow(G){ var L0=G.lastLap, out=[]; if(L0&&L0.c) Object.keys(L0.c).forEach(function(x){ out.push({ s:+x, c:L0.c[x] }); }); return out; }
  var KEEP={ race:1, gate:1, holeshot:1, war:1, kitty:1, out:1, short:1, deadlock:1, raceDone:1, roundDone:1, seasonOver:1, pileup:1 };
  return {
    /* a beat's events (the drop's included): what the booth hears now. The drop: lap 1 starts with the gate's cards and its story (the holeshot) is planned */
    beat:function(G,ev){
      var out=[], gate=false, R=G.race||G; if(!R||!R.tm) return ev;
      lapsRec(R);
      (ev||[]).forEach(function(e){
        if(e.e==="gate") gate=true;
        if(e.e==="reveal"&&e.w===0){ if(e.b===1){ out.push(e); st.b=1; } else out.push({ e:"reveal", w:1, cards:e.cards.map(function(x){ return { s:x.s, c:x.c, held:false }; }), beat:e.b }); return; }
        if(e.e==="reveal"&&e.w>0){ out.push(e); return; }
        if(e.e==="crash"){ (st.held[e.s]=st.held[e.s]||[]).push(e); return; }   /* (fed as the bike goes down: bridge.down) */
        if(e.e==="crashCards"){ st.gain=(st.gain|0)+e.n; return; }
        if(KEEP[e.e]) out.push(e);
      });
      if(gate) out.push({ e:"next", b:2 });   /* the start's story (the holeshot, the first order) */
      return out;
    },
    /* the leader starts lap k on the race clock */
    lap:function(G,k){ var R=G.race||G; if(!R||!R.tm||k<2||st.flagged) return []; lapsRec(R); var b=synth(R,k); if(b<=st.b) return []; st.b=b; return [{ e:"reveal", w:0, b:b, cards:cardsNow(R) },{ e:"next", b:b+1 }]; },
    /* rider s goes down (a remount or out) on the race clock: the crash call lands with the picture */
    down:function(G,s){ var R=G.race||G, q=st.held[s]; if(!R||!R.tm||!q||!q.length) return []; st.held[s]=[]; var out=q.slice(); if(st.gain){ out.push({ e:"crashCards", s:-1, n:st.gain }); st.gain=0; } out.push({ e:"next", b:st.b+1 }); return out; },
    /* a pass for the lead on the race clock */
    lead:function(G,a,d){ var R=G.race||G; if(!R||!R.tm||st.flagged) return []; lapsRec(R); return [{ e:"lead", s:a, from:d },{ e:"next", b:st.b+1 }]; },
    /* the checkered flag at the winner's line: the order on the tower now (the riders in, then the rest by distance) */
    flag:function(G,t){ var R=G.race||G; if(!R||!R.tm||st.flagged) return []; st.flagged=true; var rows=tower(R,t); return [{ e:"flag", why:"flag", b:R.tm.L, order:rows.map(function(r){ return r.s; }) }]; },
    /* the race's last batch (the last rider in): the result, never a second flag */
    end:function(G,ev){ return (ev||[]).filter(function(e){ return e.e!=="flag"&&e.e!=="win"&&e.e!=="reveal"&&e.e!=="acted"&&e.e!=="crash"&&e.e!=="crashCards"; }); },
    state:function(){ return st; }
  };
}

var MX_Beat={ D:D, U:U, BASE:BASE, CLS:CLS, bridge:bridge, lapsRec:lapsRec, classOf:classOf, era:era, ratio:ratio, cardsFor:cardsFor, fmtOf:fmtOf, handQ:handQ, init:init, tables:tables, chases:chases, beat:beat, complete:complete,
  standings:standings, result:result, tower:tower, progressAt:progressAt, timeAt:timeAt, stateAt:stateAt, intervalAt:intervalAt, walker:walker, leaderLine:leaderLine, clockLimit:clockLimit,
  nextLock:nextLock, winAt:winAt, packet:packet, events:events, knotsOf:knotsOf, advance:advance, adopt4:adopt4, holdWindow:holdWindow, crashOn:crashOn, yellowWindows:yellowWindows,
  lapStats:lapStats, beatLine:beatLine, clockHead:clockHead, eventLine:eventLine };
MX.Beat=MX_Beat;
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Beat;
})(typeof window!=="undefined"?window:globalThis);
