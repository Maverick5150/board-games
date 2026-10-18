/* MOTOCROSS WAR — the TIME MODEL: the cards decide REAL lap times (mxtime, TIME-MODEL.md in BG_audit/games/mxwar). Pure, no DOM.
   Node: module.exports = MXWar.Time; browser: window.MXWar.Time (load race.js first).
   The CEO (2026-10-17): "Cards -> seconds": each War battle is one lap and the cards decide REAL lap times, so the race shows real gaps in
   seconds, real lap times and lengths, all riders in the standings with unique places 1..N, and the crash rules exactly: a lost double war =
   the rider crashes and remounts, a lost triple war = the rider crashes out (DNF), and a yellow flag after a crash.
   War is played exactly as before (race.js, the pot, the wars, G.rs, the House rules). The model draws NO random number, has no hash and never
   touches G.rs; it uses only + - * / and sqrt (plus round / floor / min / max), so a Fire TV, a phone and a laptop give the same bits (Party
   sync). State = G.tm, plain JSON, integer milliseconds. After each battle (= one lap) lap(G) turns that lap's public card results (G.lastLap,
   G.yellow, the pile sizes) into EVERY rider's LAP TIME; the running order is the order of RACE TIMES.
   This file is the reference implementation final/model.js (BG_audit/sprint/mxtime/final) written in the engine's ES5 style (var / function:
   the Fire TV browser may be old): the arithmetic and the order of operations are the reference's, line for line. The last section ("READOUTS")
   is new in the integration: texts and numbers for the tower and the YOU readout, read from G.tm, never written to it.
   API: init(G,info) lap(G) complete(G) finish(G) standings(G) result(G) tower(G,t) progressAt(G,s,t) timeAt(G,s,p) knots(G,s,k)
        splits(G,s,k,M) packet(G,k) run(G,info,hum) infoOf(raceInfo,series,year,kind) adopt(G,info) trim(G,keep) cardsFor(series,laps)
   info = { series:"sx"|"mx"|"smx", year, kind:heat|semi|lcq|qual|main|moto, L (laps; the model always uses G.o.len, the engine's flag), p (typical
            lap = the winner's median lap, s), fl (first lap gate->line, s; 0 = none), b (best lap, s; 0 = none), t1 (turn-1 phase on the start path,
            default 0.12) } */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Time) return;
/* race.js is read lazily (only Race.val, and the old order in adopt): the two files may load in either order */
function RC(){ return MX.Race||(typeof require==="function"?require("./race.js"):null); }

/* ---------------- parameters ----------------
   z = the rider's pace index this lap (higher = faster); u = Z0 - z (u > 0: slower than the typical winner lap)
     slow side  ratio = 1 + s*u*(1 + kap*u/2)   capped at rmax          (convex: a bad run costs a lot)
     fast side  ratio = 1 + v/(1 - v/a), v = s*u (< 0)                  (saturates at 1 - a: nobody beats the limit lap)
   z = A*wl*x + G*(1-A)*f + zb*wl + KQ*q + KS*stack + FIRE*fire/3 + CB*chase        (clamped to [ZL, ZH])
   s, a, kap, rmax are per class (series x race kind); E (era) widens s and sqrt-widens a. */
var BASE={
  W1:0.25, WW:0.30, WL:0.35, WS:1,       /* z bonus: pot won / per war level won / war lost (not crashed); WS scales the war terms per class (40-rider fields have a war almost every lap) */
  YP:0.30, YW:0.50, YL:0.30,             /* the same results as they enter the form: y = x + YP | x + YW*depth | x - YL */
  N0:6,                                  /* form prior: w = max(1/(n+N0), 1-R): a running average first, then an EWMA */
  KQ:0.06, KS:0.05, SCAP:2.5,            /* dealt-hand strength weight, stack weight, stack saturation (pot units) */
  FIRE:0.30, FIREN:3,                    /* after a remount: 3 attacking laps */
  ZL:-1.1, ZH:2.0,
  ZETA:0.05, YLF:0.02,                   /* yellow section half width (laps), extra time everybody loses in it (fraction of p) */
  CS:0.045, CR:0.30,                     /* leader cruise: clear by more than CS*p -> eases CR of the excess */
  CRS:0.35, CSS:0.55,                    /* small fields (< 22 riders) cruise harder: CR + CRS*small, CS*(1 - CSS*small), small = 1 - riders/22: a room of 2-16 stays a race */
  CG0:0.55, CG1:1.10,                    /* remount hold = C*p*sqrt(E)*(CG0 + CG1*dv/12), dv = winner's deciding card - his */
  P1:0.50, T1:0.12, MS1:0.15, Q1:0.010,  /* lap 1: weight of the pace on the first lap, turn-1 phase, minimum spacing at the line, seconds (x p sqrt(E)) one SD of dealt hand is worth on lap 1 */
  BL:0.006,                              /* blue flag: the lapping rider loses BL*p per rider he laps */
  PTL:1.0
};
var CLS={
  sxMain:{ WS:0.9292, F1:0.5757, s:0.069, a:0.0409, kap:1.4888, rmax:1.2512, Z0:0.4509, A:0.1288, R:0.9122, G:1.7802, HS:0.1608, LLW:1.8, S1:0.0075, C:0.3423, CB:0.0377, GC:2.0127, GAP:0.3111, PC:2.8278, PCL:1, PT:0.0173, CS:0.0532, CR:0.2161, P1:0.5058, Q1:0.0114 },
  sxHeat:{ WS:1.0461, F1:0.569, s:0.1259, a:0.0818, kap:0.5942, rmax:1.12, Z0:0.6726, A:0.1557, R:0.9076, G:2.2676, HS:0.2437, LLW:1.2905, S1:0.008, C:0.4319, CB:0.0319, GC:2.3893, GAP:0.3567, PC:2.6925, PCL:3, PT:0.0297, CS:0.0447, CR:0.3045, P1:0.554, Q1:0.0135 },
  sxLcq:{ WS:0.9789, F1:0.5723, s:0.0951, a:0.0505, kap:0.5882, rmax:1.12, Z0:0.5406, A:0.1633, R:0.93, G:1.7427, HS:0.1308, LLW:1.3019, S1:0.0078, C:0.43, CB:0.0192, GC:1.8701, GAP:0.2266, PC:4.7811, PCL:4, PT:0.0146, CS:0.0562, CR:0.3657, P1:0.5, Q1:0.011 },
  smxMoto:{ WS:0.8, F1:0.4947, s:0.0588, a:0.0485, kap:1.1557, rmax:1.12, Z0:0.486, A:0.1672, R:0.9341, G:2.7969, HS:0.1958, LLW:1.1045, S1:0.0065, C:0.3197, CB:0.038, GC:1.9188, GAP:0.5256, PC:2.5601, PCL:2, PT:0.0159, CS:0.0405, CR:0.2635, P1:0.4678, Q1:0.01 },
  mxMoto:{ WS:0.4843, F1:0.361, s:0.1121, a:0.048, kap:0.905, rmax:1.12, Z0:0.4921, A:0.1073, R:0.93, G:2.5222, HS:0.4599, LLW:1, S1:0.006, C:0.414, CB:0.039, GC:3.8105, GAP:0.6135, PC:2.2363, PCL:1, PT:0.0108, P1:0.5172, Q1:0.0111 }
};
function assign(t){ for(var i=1;i<arguments.length;i++){ var s=arguments[i]; if(s) for(var k in s) if(Object.prototype.hasOwnProperty.call(s,k)) t[k]=s[k]; } return t; }
function classOf(series,kind){
  if(series==="mx") return "mxMoto";
  if(series==="smx") return kind==="lcq"?"sxLcq":kind==="heat"||kind==="semi"||kind==="qual"?"sxHeat":"smxMoto";
  return kind==="heat"||kind==="semi"||kind==="qual"?"sxHeat":kind==="lcq"?"sxLcq":"sxMain";
}
/* era E: how much more spread out the field was than today's (a table, see TIME-MODEL.md section 4) */
function era(series,year){
  year=year|0||2026;
  if(series==="mx") return year>=2021?0.95:year>=2010?1.10:year>=2003?1.40:1.10;
  return year>=2017?1.0:year>=2010?1.15:year>=2003?1.45:year>=1990?1.10:1.30;
}
/* cards per rider (TIME-MODEL.md 2.3): 52 for a stadium race (SX, SMX) of more than 16 laps, else 26. The season's House "Cards per rider: Auto" uses it. */
function cardsFor(series,laps){ return (series!=="mx"&&(laps|0)>16)?52:26; }

function ms(x){ return Math.round(x*1000); }
function r1(x){ return Math.round(x*10)/10; }
function r2(x){ return Math.round(x*100)/100; }
function r3(x){ return Math.round(x*1000)/1000; }
var EMPTY={ c:{}, w:{}, win:-1, war:0 };
function ratio(P,u){
  if(u>=0){ var r=1+P.s*u*(1+P.kap*u*0.5); return r>P.rmax?P.rmax:r; }
  var v=P.s*u; return 1+v/(1-v/P.a);
}
/* the value of a card for pace (wild = 1.25) and for duels (wild = 15) */
function cval(G,c){ if(c==null) return 8; var v=RC().val(G,c); return v>=100?15:v; }
/* the last face-up card a rider laid in the lap's battle (his deciding card), else the card he turned */
function lastUp(L0,s){ var w=L0.w&&L0.w[s]; if(w) for(var i=w.length-1;i>=0;i--) if(w[i][1]!=null) return w[i][1]; return L0.c?L0.c[s]:null; }
/* tonight's strength: the quality of the hand dealt at the gate, in SDs of a dealt hand (clamped); stored once, never changes */
function handQ(G,s){
  var pk=G.r[s].pk; if(!pk.length) return 0;
  var sum=0; for(var i=0;i<pk.length;i++) sum+=cval(G,pk[i]);
  var q=(sum/pk.length-8)/(3.74/Math.sqrt(pk.length));
  return r3(q>2.5?2.5:q<-2.5?-2.5:q);
}

/* ---------------- init: right after Race.newRace (before the gate drops) ---------------- */
function init(G,info){
  var ser=info.series==="mx"||info.series==="smx"?info.series:"sx", kind=info.kind||"main", cls=classOf(ser,kind);
  var E=era(ser,info.year), P=assign({},BASE,CLS[cls]);
  P.s*=E; P.a*=Math.sqrt(E);
  /* the round's researched best lap bounds the fast side (the fastest lap of the night is never beaten): a = 1.12*(1 - b/p), within 0.03..0.09 */
  var p=+info.p||55;
  if(+info.b>0&&info.b<p) P.a=Math.max(0.03,Math.min(0.09,(1-info.b/p)*1.12));
  G.tm={ v:3, ser:ser, yr:info.year|0, kind:kind, cls:cls, E:r3(E), L:Math.max(1,G.o.len|0||info.L|0), p:p, fl:+info.fl>0?+info.fl:0, b:+info.b>0?+info.b:0,
    t1:+info.t1>0&&info.t1<0.5?+info.t1:BASE.T1, P:P, lite:!!info.lite, k:0, flag:null, done:false, hs:-1, lead:-1, best:null, bt:{}, yz:{}, laps:[], lapped:{}, start:null,
    r:G.r.map(function(p2,s){ return { T:[], f:0, n:0, q:G.battle===0?handQ(G,s):0, h:p2.pk.length, fire:0, cr:0, held:0, hold:{}, fin:null, dnf:null, xs:0 }; }) };
  return G.tm;
}

/* OLD SAVES: a race under way that has no G.tm (saved before the time model).  The model starts at the lap the race is on: the field at the line in
   the order of cards held (Race.chest = the old order), 0.6 s apart, every lap before that exactly p; riders already out are marked.  The holeshot stays G.hs. */
function adopt(G,info){
  var Rc=RC(), tm=init(G,info), k=G.battle, p=tm.p, st=(Rc.chest||Rc.standings)(G);
  tm.k=k; tm.hs=G.hs; tm.start={ ph:tm.t1, ord:[], t:[] };
  st.forEach(function(r){
    var R=tm.r[r.s], rank=r.place-1, P=G.r[r.s]; R.q=0; R.h=P.pk.length; R.n=k; R.f=0;
    if(!P.out){ for(var i=1;i<=k;i++) R.T.push(ms(i*p+(i===k?0.6*rank:0))); return; }
    var d=P.dnf||{ lap:k, why:"cards" }, done=d.why==="crash"?d.lap-1:d.lap;
    for(var j=1;j<=done;j++) R.T.push(ms(j*p));
    var at=d.why==="crash"?(d.sector!=null?d.sector:0.5):1;
    R.dnf={ lap:d.lap, why:d.why, at:at, t:ms((d.lap-1)*p+at*p) };
  });
  if(G.over) finish(G);
  return tm;
}

/* progress (laps, fractional) of rider b at clock t (s): his history T (ms) and, past it, lap k at its natural end Tnb (s) */
function progNat(R,t,Tnb){
  var T=R.T, m=T.length; if(t<=0) return 0;
  var lo=0, hi=m; while(lo<hi){ var mid=(lo+hi)>>1; if(T[mid]/1000>t) hi=mid; else lo=mid+1; }
  if(lo<m){ var t0=lo>0?T[lo-1]/1000:0, t1=T[lo]/1000; return lo+(t-t0)/Math.max(1e-6,t1-t0); }
  var t00=m>0?T[m-1]/1000:0; return m+(t-t00)/Math.max(1e-6,Tnb-t00);
}

/* ---------------- one lap ---------------- */
function lap(G){
  var tm=G.tm; if(!tm||tm.done) return [];
  var P=tm.P, n=G.n, k=tm.k+1, p=tm.p, L0=G.lastLap||EMPTY, ev=[], L=tm.L;
  if(L0.b!=null&&tm.lb===L0.b) return [];       // this battle was already turned into a lap (a second call changes nothing)
  tm.lb=L0.b!=null?L0.b:null;
  var lastLap=k>=L, wl=lastLap?P.LLW:1, sE=Math.sqrt(tm.E);
  var crashed={}; (L0.cr||[]).forEach(function(c){ crashed[c.s]=c.kind; });
  function T0(s){ return tm.r[s].T.length?tm.r[s].T[tm.r[s].T.length-1]/1000:0; }
  var run=[], lt={}, cardV={}, zz={};
  /* who rides this lap: riders still racing that turned a card (after an early end of War: the survivors) */
  var act=[], s, i, j, a, d;
  for(s=0;s<n;s++){ var R0=tm.r[s]; if(R0.dnf||R0.fin) continue; var c0=L0.c?L0.c[s]:null; if(c0==null&&!(G.over&&G.why!=="flag")) continue; act.push(s); }
  /* the order at the last line: who is ahead of whom (the chase boost looks at the gap to the rider ahead) */
  var prev=act.slice().sort(function(a,b){ return T0(a)-T0(b)||a-b; });
  var gapAhead={}; for(i=1;i<prev.length;i++) gapAhead[prev[i]]=T0(prev[i])-T0(prev[i-1]);
  /* the stack: cards held going into this lap against the field's mean, in pot units (one pot = the riders still in) */
  var hsum=0; for(i=0;i<act.length;i++) hsum+=tm.r[act[i]].h; var hmean=hsum/Math.max(1,act.length), nin=Math.max(1,act.length);
  for(var ai=0;ai<act.length;ai++){
    s=act[ai];
    var R=tm.r[s], c=L0.c?L0.c[s]:null;
    var v=cval(G,c), x=c==null?0:(v>=15?1.25:(v-8)/6); cardV[s]=c==null?0:v;
    var y=x, zb=0;
    var fought=L0.w&&L0.w[s]?L0.w[s].length:0;
    if(s===L0.win){ if(L0.war>0){ zb+=P.WS*P.WW*L0.war; y+=P.WS*P.YW*L0.war; } else { zb+=P.W1; y+=P.YP; } }
    else if(fought&&!crashed[s]){ zb-=P.WS*P.WL; y-=P.WS*P.YL; }
    R.n++;
    if(k===1) R.f=P.F1*x+(s===L0.win?P.HS:0);                                                          // the start sets the first form (the launch; the holeshot gets a bonus)
    else R.f+=(y-R.f)*Math.max(1/(R.n+P.N0),1-P.R);                                                   // then a running average that settles into an EWMA
    R.xs+=x;
    var su=(R.h-hmean)/nin, stack=su/(1+(su<0?-su:su)/P.SCAP);
    var z=P.A*wl*x+P.G*R.f*(1-P.A)+zb*wl+P.KQ*R.q+P.KS*stack;
    if(R.fire>0){ z+=P.FIRE*R.fire/P.FIREN; R.fire--; }                                                // after a crash: attacking to get the places back
    var ga=gapAhead[s]; if(k>1&&ga!=null&&ga<P.GC) z+=P.CB*(1-ga/P.GC);                                // on the rear wheel of the rider ahead: rides harder
    z=z<P.ZL?P.ZL:z>P.ZH?P.ZH:z; zz[s]=z;
    lt[s]=k===1?0:p*ratio(P,P.Z0-z);
    if(crashed[s]==="remount"){
      var dv=Math.max(0,Math.min(12,cval(G,L0.wc!=null?L0.wc:L0.c[L0.win])-cval(G,lastUp(L0,s))));
      var H=P.C*p*sE*(P.CG0+P.CG1*dv/12), at=crashAt(G,k,tm);
      R.hold[k]=[at,ms(H)]; lt[s]+=H; R.cr++; R.fire=P.FIREN;
      ev.push({ e:"crash", s:s, k:k, kind:"remount", loss:r1(H), at:at, dv:dv });
    }
    if(tm.yz[k]) lt[s]+=P.YLF*p;                                                                       // the yellow lap: everyone loses a little in the flagged section
    run.push(s);
  }
  /* lap 1 (the start): the holeshot (the first battle's winner) leads into turn 1, then the higher first card (war fighters first), then the stronger
     hand, then the gate pick.  The field funnels into turn 1 in that order (each place back costs S1*p*sqrt(E)), then rides the rest of the lap at a
     pace that counts P1 of a normal lap's pace: the hand and the war results let a few riders swap places on lap 1; the holeshot rider keeps the lead. */
  if(k===1){
    var F=tm.fl>0?tm.fl:p, hs=L0.win, T1=tm.t1, TF=F*T1;
    var fw=function(s2){ return L0.w&&L0.w[s2]?1:0; };
    var ord=run.slice().sort(function(a,b){ return (b===hs)-(a===hs)||(cardV[b]-cardV[a])||(fw(b)-fw(a))||(tm.r[b].q-tm.r[a].q)||(zz[b]-zz[a])||(a-b); });
    tm.start={ ph:T1, ord:ord.slice(), t:[] };
    ord.forEach(function(s2,j2){
      var sp=P.S1*p*sE*(j2+0.02*j2*j2), rat=ratio(P,P.Z0-zz[s2]);
      tm.r[s2].t1=ms(TF+sp);
      lt[s2]+=TF+sp+(F-TF)*(1+P.P1*(rat-1))-P.Q1*p*sE*tm.r[s2].q;
      tm.start.t.push(tm.r[s2].t1);
    });
    tm.hs=hs; if(hs>=0) ev.push({ e:"holeshot", s:hs });
  }
  var Tn={}; run.forEach(function(s2){ Tn[s2]=T0(s2)+lt[s2]; });
  if(k===1){      /* the holeshot rider leads lap 1; nobody finishes the lap on top of another (a minimum spacing at the line) */
    var hs1=L0.win; if(hs1>=0&&Tn[hs1]!=null) run.forEach(function(s2){ if(s2!==hs1&&Tn[s2]<Tn[hs1]+P.MS1) Tn[s2]=Tn[hs1]+P.MS1; });
    var o1=run.slice().sort(function(a,b){ return Tn[a]-Tn[b]||a-b; }); for(i=1;i<o1.length;i++) if(Tn[o1[i]]<Tn[o1[i-1]]+P.MS1) Tn[o1[i]]=Tn[o1[i-1]]+P.MS1;
  }
  /* THE LEADER RIDES TO THE GAP: a leader more than CS*p clear of second backs it down by CR of the excess (real leaders cruise).  Not on the last lap. */
  if(k>1&&!lastLap&&prev.length>1){ var l1=prev[0], l2=prev[1], gp=T0(l2)-T0(l1), small=n>=22?0:1-n/22, cs=P.CS*(1-P.CSS*small)*p;
    if(gp>cs&&!crashed[l1]){ var cut=(P.CR+P.CRS*small)*(gp-cs); Tn[l1]+=cut; if(!tm.lite) ev.push({ e:"cruise", s:l1, k:k, gap:r1(gp), eased:r2(cut) }); } }
  /* BLUE FLAG: a rider who laps a back-marker this lap loses BL*p per rider lapped (the back-marker moves over, the leader still has to find the gap).
     A rider can only be lapped by a whose lap ends before b's last line crossing (T0(b) > Tn[a]); prev is sorted by T0, so those are the tail. */
  if(k>1) for(var pi=0;pi<prev.length;pi++){
    a=prev[pi];
    var cnt=0, ta0=T0(a), ta1=Tn[a];
    for(j=prev.length-1;j>=0&&T0(prev[j])>ta1;j--){ var b=prev[j]; if(b===a) continue; var Rb=tm.r[b];
      var d0=(k-1)-progNat(Rb,ta0,Tn[b]), d1=k-progNat(Rb,ta1,Tn[b]);
      if(d0>=0&&Math.floor(d1+1e-9)>Math.floor(d0+1e-9)&&d1>=1) cnt++; }
    if(cnt){ Tn[a]+=P.BL*p*cnt; if(!tm.lite) ev.push({ e:"lapping", s:a, k:k, n:cnt, cost:r2(P.BL*p*cnt) }); }
  }
  /* PASSING (War on track): a rider catches the rider ahead of him if his new line time is within GAP of that rider's.  He gets by only if
     the rider ahead crashed, or his card this lap is PC ranks higher (PCL more when the rider ahead is in the top 3), or he gained more than PT*p
     seconds on him this lap.  Otherwise he is HELD behind him: his line time becomes the rider's plus a following gap (0.6..1.25 GAP: the more
     time he would have had on him, the closer he sits).  Riders a lap down are never within GAP of a leader (blue flag). */
  if(k>1) for(i=0;i<prev.length;i++){
    a=prev[i];
    for(j=i-1;j>=0;j--){
      d=prev[j];
      if(Tn[a]>=Tn[d]+P.GAP) break;
      var edge=(T0(a)-T0(d))-(Tn[a]-Tn[d]);
      var pcn=P.PC+(j<3?P.PCL:0), ok=crashed[d]||(cardV[a]>=cardV[d]+pcn)||edge>P.PT*p*(j<3?P.PTL:1);
      if(!ok){
        var sep=Tn[a]-Tn[d], pr=Math.max(0,Math.min(1,(P.GAP-sep)/(2*P.GAP)));
        var was=Tn[a]; Tn[a]=Tn[d]+P.GAP*(1.25-0.65*pr); tm.r[a].held++;
        if(Tn[a]-was>0.05) ev.push({ e:"held", s:a, by:d, k:k, lost:r2(Tn[a]-was) });
        break;
      }
    }
  }
  /* write the lap: integer ms.  A lost triple war (crash OUT): the rider stops where he crashed; out of cards: he finishes the lap and pulls off */
  run.forEach(function(s2){
    var R2=tm.r[s2];
    if(crashed[s2]==="out"){ var at2=crashAt(G,k,tm), tc=k===1?Math.round(R2.t1+(at2-tm.t1)/(1-tm.t1)*(ms(Tn[s2])-R2.t1)):ms(T0(s2)+at2*(Tn[s2]-T0(s2)));
      R2.dnf={ lap:k, why:"crash", at:at2, t:tc }; ev.push({ e:"crash", s:s2, k:k, kind:"out", at:at2 }); return; }
    R2.T.push(ms(Tn[s2]));
    var p2=G.r[s2]; if(p2.out&&p2.dnf&&p2.dnf.why==="cards"){ R2.dnf={ lap:k, why:"cards", at:1, t:R2.T[R2.T.length-1] }; ev.push({ e:"dnf", s:s2, k:k, why:"cards" }); }
  });
  for(s=0;s<n;s++) tm.r[s].h=G.r[s].pk.length;                                                         // the stacks they take into the next lap
  /* the yellow flag this lap's crash raised: next lap, in that section (half width ZETA, everybody crosses it in the same time: no passing there) */
  if(G.yellow&&G.yellow.lap===k+1){ tm.yz[k+1]={ c:G.yellow.sector, z:P.ZETA, d:ms(2*P.ZETA*p+P.YLF*p), by:G.yellow.s?G.yellow.s.slice():[] }; ev.push({ e:"yellow", k:k+1, at:G.yellow.sector }); }
  tm.k=k;
  /* wars: depth 1 = a flash for the TV, depth 2+ = the headline (crash); who won, who lost */
  if(L0.war>0&&!tm.lite){ var losers=Object.keys(L0.w||{}).map(Number).filter(function(s2){ return s2!==L0.win; }); ev.push({ e:"war", k:k, depth:L0.war, win:L0.win, losers:losers, flash:L0.war<2 }); }
  /* the running order at this line, lead changes, fastest lap, battles, lapping (the stories for the TV director and the announcers) */
  if(!tm.lite){
    var st=standings(G); var lead=st.length&&!st[0].dnf?st[0].s:-1;
    if(tm.lead>=0&&lead!==tm.lead&&lead>=0) ev.push({ e:"lead", s:lead, from:tm.lead, k:k });
    if(lead>=0) tm.lead=lead;
    if(k>1) run.forEach(function(s2){ var R3=tm.r[s2]; if(R3.dnf&&R3.dnf.why==="crash"||R3.T.length<k) return; var t=(R3.T[k-1]-R3.T[k-2])/1000;
      if(!crashed[s2]&&!tm.yz[k]&&(!tm.best||t<tm.best.t-0.05)){ tm.best={ s:s2, k:k, t:r3(t) }; if(k>=3) ev.push({ e:"fastest", s:s2, k:k, t:tm.best.t }); } });
    detectPasses(G,k).forEach(function(x2){ ev.push(x2); }); stories(G,k,st,ev,crashed);
  }
  tm.laps.push({ k:k, ev:ev });
  if(k>=L) finish(G);
  return ev;
}
/* where on the lap a crash of this battle happens: the engine's G.yellow.sector (every renderer agrees); lap 1 crashes happen after turn 1 */
function crashAt(G,k,tm){ var at=G.yellow&&G.yellow.sector!=null?G.yellow.sector:0.5; if(k===1&&at<tm.t1+0.03) at=tm.t1+0.03; return at; }
/* the engine ended before the flag (every other rider out, a deadlock): the survivors ride the remaining laps on form alone */
function complete(G){
  var tm=G.tm, guard=0;
  while(tm&&!tm.done&&tm.k<tm.L&&guard++<10000){ G.lastLap={ c:{}, w:{}, win:-1, war:0 }; lap(G); }
  if(tm&&!tm.done) finish(G);
}

/* PASSES on the track: sample the order at 12 timing loops + the yellow section's edges + the crash point (+ turn 1 on lap 1); between two samples every
   rider's knots are a straight line, so a change of order is one crossing (the point by interpolation).  The yellow section can never hold one. */
function detectPasses(G,k){
  var tm=G.tm, M=12, ids=[]; for(var s=0;s<G.n;s++) if(tm.r[s].T.length>=k) ids.push(s);
  if(ids.length<2) return [];
  var ph0=k===1?tm.t1:0;
  var pts=[ph0]; for(var j=1;j<=M;j++) if(j/M>ph0+1e-9) pts.push(j/M);
  var yz=tm.yz[k]; if(yz){ pts.push(yz.c-yz.z,yz.c+yz.z); }
  var cc=-1; ids.forEach(function(s2){ var h=tm.r[s2].hold[k]; if(h) cc=h[0]; }); if(cc>=0){ pts.push(cc,cc+1e-6); }
  pts.sort(function(a,b){ return a-b; });
  function order(ph){ var t={}; ids.forEach(function(s2){ t[s2]=ph===0?(k>1?tm.r[s2].T[k-2]:0):timeAt(G,s2,k-1+ph); }); return { t:t, o:ids.slice().sort(function(a,b){ return t[a]-t[b]||a-b; }) }; }
  var A=order(ph0), pa=ph0, out=[];
  for(j=1;j<pts.length;j++){
    if(pts[j]<=pa) continue;
    var B=order(pts[j]), ra={}, rb={}, pj=pts[j]; A.o.forEach(function(s2,i2){ ra[s2]=i2; }); B.o.forEach(function(s2,i2){ rb[s2]=i2; });
    B.o.forEach(function(a){ if(rb[a]<ra[a]) A.o.forEach(function(d){ if(ra[d]<ra[a]&&rb[d]>rb[a]){
      var da=A.t[a]-A.t[d], db=B.t[a]-B.t[d]; var f=da-db>1e-9?da/(da-db):0.5; f=f<0?0:f>1?1:f;
      var at=pa+f*(pj-pa), slope=Math.abs(db-da)/Math.max(1e-9,pj-pa);      // ms per unit phase
      var w=slope>0?Math.min(0.5,350/slope):0.5;                                                // side by side (within 0.35 s) for +-w of a lap
      var o={ e:"pass", k:k, a:a, d:d, at:r3(at), pos:rb[a]+1, w:[r3(Math.max(0,at-w)),r3(Math.min(1,at+w))] }; if(tm.r[d].hold[k]) o.crash=1; out.push(o); } }); });
    A=B; pa=pts[j];
  }
  return out;
}

/* ---------------- stories ---------------- */
function stories(G,k,st,ev,crashed){
  var tm=G.tm, rows=st.filter(function(r){ return !r.dnf&&r.laps===k; }), seen={};
  /* battles: two riders on the same lap within 1 s at the line, for 2 laps running (top 12 only) */
  for(var i=1;i<rows.length&&i<12;i++){ var a=rows[i], d=rows[i-1], gp=(a.t-d.t)/1000, key=a.s+">"+d.s;
    if(gp<1.0){ var c=(tm.bt[key]||0)+1; seen[key]=c; if(c>=2) ev.push({ e:"battle", a:a.s, d:d.s, pos:i, gap:r2(gp), laps:c, k:k }); } }
  tm.bt=seen;
  /* the leader laps a back-marker (first time the leader has a full lap on him) */
  if(rows.length){ var ld=rows[0].s, t=tm.r[ld].T[k-1];
    st.forEach(function(r){ if(r.dnf||r.s===ld||tm.lapped[r.s]) return; var pr=progress(tm.r[r.s],t); if(pr<=k-1){ tm.lapped[r.s]=k; ev.push({ e:"lapped", s:r.s, by:ld, k:k }); } }); }
  if(k===tm.L-1&&rows.length>1) ev.push({ e:"lastlap", p1:rows[0].s, p2:rows[1].s, gap:r2((rows[1].t-rows[0].t)/1000) });
}
/* the checkered flag: the leader's L-th crossing; everyone else finishes at his next crossing after it (a rider a lap down finishes a lap short) */
function finish(G){
  var tm=G.tm; if(tm.done) return;
  var flag=Infinity, w=-1;
  tm.r.forEach(function(R,s){ if(!R.dnf&&R.T.length>=tm.L&&R.T[tm.L-1]<flag){ flag=R.T[tm.L-1]; w=s; } });
  if(w<0){ tm.r.forEach(function(R,s){ if(!R.dnf&&R.T.length&&R.T[R.T.length-1]<flag){ flag=R.T[R.T.length-1]; w=s; } }); }   // nobody finished the laps: the first home
  if(flag===Infinity){ flag=1; tm.r.forEach(function(R){ var e=R.dnf?R.dnf.t:(R.T.length?R.T[R.T.length-1]:0); if(e>flag) flag=e; }); }   // (added in the integration) every rider is out (a dead heat on the last cards): the flag falls when the last one stops; the reference left Infinity, which a save writes as null
  tm.flag=flag; tm.done=true; tm.win=w;
  tm.r.forEach(function(R,s){
    if(R.dnf) return;
    var j=-1; for(var i=0;i<R.T.length;i++) if(R.T[i]>=flag){ j=i; break; } if(j<0) j=R.T.length-1;
    R.fin={ laps:j+1, t:R.T[j] }; R.T=R.T.slice(0,j+1);
  });
  var st=standings(G), la=tm.laps[tm.laps.length-1];
  if(la&&st.length>1&&!st[1].dnf&&st[1].laps===st[0].laps){ var m=(st[1].t-st[0].t)/1000; la.ev.push({ e:"finish", win:st[0].s, second:st[1].s, margin:r3(m), photo:m<0.3 }); }
}
/* the classification / timing tower at the lines: finishers (or riders still racing) by laps then time; DNFs behind (a later DNF ahead of an
   earlier one, then more cards held at the crash, then the gate: CRASH-CONTRACT.md).  Ties on the line: the higher last card, then the gate. */
function standings(G){
  var tm=G.tm, n=G.n, rows=[];
  for(var s=0;s<n;s++){ var R=tm.r[s], T=R.T;
    var laps=R.fin?R.fin.laps:T.length, t=R.fin?R.fin.t:(T.length?T[T.length-1]:0);
    rows.push({ s:s, laps:laps, t:t, dnf:R.dnf, crashes:R.cr, outN:G.r[s].outN|0, lc:G.r[s].lc|0 }); }
  rows.sort(function(a,b){ return (!!a.dnf-!!b.dnf)||(a.dnf&&b.dnf?((b.dnf.lap+b.dnf.at)-(a.dnf.lap+a.dnf.at))||(b.outN-a.outN)||(a.s-b.s):(b.laps-a.laps)||(a.t-b.t)||(b.lc-a.lc)||(a.s-b.s)); });
  var top=rows[0];
  rows.forEach(function(r,i){ r.place=i+1; if(r.dnf){ r.gap="DNF"; return; }
    var dl=top.laps-r.laps; r.gs=Math.round(r.t-top.t)/1000;
    r.gap=i===0?"Leader":dl>0?"+"+dl+(dl>1?" Laps":" Lap"):"+"+(r.gs).toFixed(3);
    r.int=i===0||rows[i-1].dnf||rows[i-1].laps!==r.laps?null:Math.round(r.t-rows[i-1].t)/1000; });
  return rows;
}
/* what Round.record needs: order = rider ids (place 1 first), dnf = {id: {lap, why}}, hs = the holeshot rider's id */
function result(G){
  var st=standings(G), dnf={}; st.forEach(function(r){ if(r.dnf) dnf[G.r[r.s].id]={ lap:r.dnf.lap, why:r.dnf.why }; });
  return { order:st.map(function(r){ return G.r[r.s].id; }), dnf:dnf, hs:G.tm.hs>=0?G.r[G.tm.hs].id:null, margin:st.length>1&&!st[1].dnf&&st[1].laps===st[0].laps?(st[1].t-st[0].t)/1000:null };
}

/* ---------------- where is everyone at any moment (the 3D view and the live tower) ----------------
   A lap is traveled in PHASE 0..1 (0 = the line; lap 1: 0 = the gate); the phase is the share of a typical lap's TIME, the view maps it to metres with its
   own speed profile).  A rider's lap k is a list of KNOTS [phase, ms]: the line to the line, plus the turn-1 funnel (lap 1), a crash hold (a vertical
   step: the rider is down at that phase for that long) and the yellow section (everybody crosses it in the same time, so nobody can pass in it). */
function knots(G,s,k){
  var tm=G.tm, R=tm.r[s], T=R.T; if(T[k-1]==null&&!(R.dnf&&R.dnf.lap===k)) return null;
  var t0=k>1?T[k-2]:0, dn=R.dnf&&R.dnf.lap===k&&R.dnf.why==="crash";
  var hold=R.hold[k], yz=tm.yz[k], f1=k===1;
  var t1=dn?R.dnf.t:T[k-1];
  if(dn&&!f1) return [[0,t0],[R.dnf.at,R.dnf.t]];
  if(dn&&f1) return [[0,0],[tm.t1,R.t1],[R.dnf.at,R.dnf.t]];
  var free=t1-t0, ph=0, t=t0, out=[[0,t0]];
  if(f1){ free-=R.t1; ph=tm.t1; t=R.t1; out.push([ph,t]); }
  if(hold) free-=hold[1]; if(yz) free-=yz.d;
  var pts=[]; if(yz){ pts.push([yz.c-yz.z,"zs"],[yz.c+yz.z,"ze"]); } if(hold) pts.push([hold[0],"h"]);
  pts.sort(function(a,b){ return a[0]-b[0]; });
  var span=1-ph-(yz?2*yz.z:0), rate=free/span;        // ms per unit phase outside the section
  var inZ=false;
  for(var i=0;i<pts.length;i++){
    var q=pts[i][0], kind=pts[i][1];
    var dph=q-ph; t+=dph*(inZ?yz.d/(2*yz.z):rate); ph=q;
    if(kind==="zs"){ out.push([q,Math.round(t)]); inZ=true; } else if(kind==="ze"){ out.push([q,Math.round(t)]); inZ=false; }
    else { out.push([q,Math.round(t)]); t+=hold[1]; out.push([q,Math.round(t)]); }
  }
  out.push([1,t1]); return out;
}
/* the rider's progress in laps (fractional) at clock t (ms): lap index + phase.  A crashed-out rider stays where he fell. */
function progress(R,t){
  var T=R.T; if(!T.length) return 0;
  if(t>=T[T.length-1]) return T.length;
  var lo=0, hi=T.length-1; while(lo<hi){ var m=(lo+hi)>>1; if(T[m]>t) hi=m; else lo=m+1; }
  var t0=lo>0?T[lo-1]:0; return lo+(t-t0)/Math.max(1,T[lo]-t0);
}
function progressAt(G,s,t){
  var tm=G.tm, R=tm.r[s], T=R.T, i;
  if(R.dnf&&R.dnf.why==="crash"&&t>=R.dnf.t) return R.dnf.lap-1+R.dnf.at;
  if(!T.length||t>=T[T.length-1]){
    if(R.dnf&&R.dnf.why==="crash"&&R.dnf.lap===T.length+1){      // on the lap he falls: walk his knots
      var kn0=knots(G,s,R.dnf.lap), base=T.length;
      for(i=1;i<kn0.length;i++) if(t<=kn0[i][1]){ var a0=kn0[i-1], b0=kn0[i]; return base+a0[0]+(b0[0]-a0[0])*Math.max(0,Math.min(1,(t-a0[1])/Math.max(1,b0[1]-a0[1]))); }
      return base+R.dnf.at; }
    return T.length; }
  var lo=0, hi=T.length-1; while(lo<hi){ var m=(lo+hi)>>1; if(T[m]>t) hi=m; else lo=m+1; }
  var k=lo+1, kn=knots(G,s,k);
  for(i=1;i<kn.length;i++){ if(t<=kn[i][1]||i===kn.length-1){ var a=kn[i-1], b=kn[i]; if(b[1]<=a[1]) return k-1+b[0]; return k-1+a[0]+(b[0]-a[0])*Math.max(0,Math.min(1,(t-a[1])/(b[1]-a[1]))); } }
  return k-1;
}
/* the clock time (ms) at which the rider reaches progress pr (laps, fractional): the loop time of a real timing system */
function timeAt(G,s,pr){
  var tm=G.tm, R=tm.r[s], k=Math.min(Math.floor(pr)+1,R.T.length); if(pr<=0) return 0; if(k<1) return null;
  if(pr>=R.T.length) return pr>R.T.length&&!R.fin?null:R.T[R.T.length-1];
  var kn=knots(G,s,k), ph=pr-(k-1);
  for(var i=1;i<kn.length;i++){ if(ph<=kn[i][0]+1e-12){ var a=kn[i-1], b=kn[i]; if(b[0]<=a[0]) return a[1]; return a[1]+(b[1]-a[1])*(ph-a[0])/(b[0]-a[0]); } }
  return R.T[k-1];
}
/* sector splits of lap k: the clock time at M equal phases (M = 8 SX / 6 MX for the timing tower's loops; any M for the view) */
function splits(G,s,k,M){
  M=M||3; var out=[]; for(var j=1;j<=M;j++) out.push(Math.round(timeAt(G,s,k-1+j/M))); return out;
}
/* the live timing tower at clock t (ms): every rider by distance covered; gap = how long ago the leader was where he is now; int = the same to the rider ahead */
function tower(G,t){
  var tm=G.tm, rows=[];
  for(var s=0;s<G.n;s++){ var R=tm.r[s], pr=progressAt(G,s,t); rows.push({ s:s, pr:pr, dnf:R.dnf&&t>=R.dnf.t?R.dnf:null }); }
  rows.sort(function(a,b){ return (!!a.dnf-!!b.dnf)||(b.pr-a.pr)||(a.s-b.s); });
  var ld=rows[0];
  rows.forEach(function(r,i){ r.place=i+1; r.lap=Math.floor(r.pr)+1;
    if(r.dnf){ r.gap="DNF"; return; }
    if(i===0){ r.gap="Leader"; r.gs=0; return; }
    var dl=Math.floor(ld.pr)-Math.floor(r.pr)-(ld.pr-Math.floor(ld.pr)<r.pr-Math.floor(r.pr)?1:0);
    var tl=timeAt(G,ld.s,r.pr); r.gs=tl==null?null:Math.round(t-tl)/1000;
    r.gap=dl>0?"+"+dl+(dl>1?" Laps":" Lap"):r.gs==null?"":"+"+r.gs.toFixed(3);
    var ah=rows[i-1]; if(!ah.dnf&&dl<=0){ var ta=timeAt(G,ah.s,r.pr); r.int=ta==null?null:Math.round(t-ta)/1000; } else r.int=null; });
  return rows;
}
/* the per-lap packet: all the 3D view (and a Party phone) needs to ride lap k: T[k-1], T[k] per rider in ms, holds, the yellow section, crash-outs, events */
function packet(G,k){
  var tm=G.tm, la=tm.laps[k-1]; if(!la||la.k!==k){ la=null; for(var i=0;i<tm.laps.length;i++) if(tm.laps[i].k===k){ la=tm.laps[i]; break; } }   // (trim keeps the last laps only: found by number)
  if(!la) return null;
  return { k:k, yellow:tm.yz[k]||null, next:tm.yz[k+1]||null, flag:tm.flag, start:k===1?tm.start:null,
    r:tm.r.map(function(R,s){ return R.T.length>=k||(R.dnf&&R.dnf.lap===k)?[k>1&&R.T[k-2]!=null?R.T[k-2]:0,R.T[k-1]!=null?R.T[k-1]:null,R.hold[k]||null,R.dnf&&R.dnf.lap===k?[R.dnf.why,R.dnf.at,R.dnf.t]:null]:null; }),
    ev:la.ev };
}

/* keep G.tm small: drop the events of all but the last `keep` laps (the lap packets the view has already played).  T, holds and the yellow sections stay, so
   every position, tower and replay can still be recomputed; a finished race can be trimmed to 0. */
function trim(G,keep){ var tm=G.tm; if(tm&&tm.laps.length>keep) tm.laps.splice(0,tm.laps.length-keep); return tm; }

/* the info the model needs from Round.raceInfo (race: the entry of RG.races; or the object raceInfo returns) */
function infoOf(inf,series,year,kind){
  return { series:series, year:year, kind:kind, L:inf.len, p:inf.lap, fl:inf.fl>0?inf.fl:0, b:inf.R&&inf.R.b>0?inf.R.b:0 };
}
/* run a whole race: gate, battles (the humans turn their cards through apply() when hum = true), the model after each battle */
function run(G,info,hum){
  var Rc=RC();
  init(G,info);
  if(G.phase==="gate") Rc.apply(G,{ t:"drop" });
  var guard=0;
  while(!G.over&&guard++<100000){
    var b=G.battle;
    while(!G.over&&G.battle===b){ if(hum&&G.need.length){ Rc.need(G).forEach(function(s){ Rc.apply(G,{ t:"flip", s:s }); }); } else Rc.step(G); }
    lap(G);
  }
  complete(G);
  return G;
}

/* ================= READOUTS (new in the integration; nothing below writes to G.tm) =================
   The numbers and the words the screens show: a time, a gap, a row of the tower, the YOU readout. Pure functions of G.tm (and G for names), so the phone
   page, the Party TV and a Party phone print the same thing. */
var MX_Time={ BASE:BASE, CLS:CLS, classOf:classOf, era:era, cardsFor:cardsFor, init:init, adopt:adopt, trim:trim, lap:lap, complete:complete, finish:finish, standings:standings, result:result,
  knots:knots, progress:progress, progressAt:progressAt, timeAt:timeAt, splits:splits, tower:tower, packet:packet, infoOf:infoOf, run:run, ratio:ratio, handQ:handQ };

MX.Time=MX_Time;
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Time;
})(typeof window!=="undefined"?window:globalThis);
