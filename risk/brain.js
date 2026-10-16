/* RISK — the computer players' brain (step 10). Loaded by engine.js right after it (the page, the Party TV host and the Party phones all load
   engine.js, so all get it) or loaded after engine.js by the tests. Called from Risk.Engine.aiAction(G) at the same call point as the old code:
   if the brain is missing, declines a move or throws, the old code plays that move (engine.js aiActionLegacy).

   One brain per computer player: a small plain-data object in G.ai.b[playerId] (saved with the game; old saves get fresh brains). Each has its own
   base temperament (balanced / bold / reserved), its own tactic weights (jittered from the per-device table) and its own memory, read from the
   PUBLIC attack events in G.log: who attacks whom and which continents are fought over. It never looks into another hand, only at card counts.
   Every turn it reads the race (armies plus expected income of every live player): behind with little to lose = bold, ahead = reserved (protect
   the lead), a close race = balanced. The mood and the temperament only nudge the thresholds.
   How it plays. Every candidate is scored in armies; win chances come from the engine's fast table (Risk.Engine.winProb), expected losses from a
   small table built once from the same dice odds.
   - Attacks: value = win chance x (the territory, a card for the first conquest of the turn, a continent completed or broken, the threat the
     conquest removes from its neighbours, an elimination: the win in a 2-player game, the loser's cards otherwise, and the follow-up attack it
     opens) minus the armies it expects to lose and the risk it leaves behind (the chance the new front or the emptied base is taken back).
     It attacks while the best attack is worth it, so it takes a card every turn when one is cheap and never throws armies at a wall.
   - Reinforcements: a greedy split of the reserve between the turn's best attack bases and the borders under threat (where each army raises
     the attack value or lowers the chance of losing something valuable the most), so armies are stacked, not sprinkled.
   - Cards: trades when it must or holds a set (keeps wilds, takes the territory bonus where it helps most); a weak player is taken out for cards.
   - Occupy and fortify: armies go where the next attack or the biggest threat is; interior stacks walk to the front.
   - Setup: claims and placements build toward a continent; in a 2-player game the neutral armies block the rival's continent, not its own.
   - Secret missions and Capital Risk: mission continents, targets and headquarters are valued.
   A sanity filter checks every move against the rules and rejects hopeless attacks; a rejected move is played by the old code.
   Learning across games: a small weight table in localStorage 'bg_ai_risk' (versioned, bounded, safe to delete).
   Skill: G.skill = "easy" | "normal" | "hard" (missing = normal); p.skill overrides per player (tests); p.skill === "legacy" = the old code.
   Human seats are never played by the brain (a random setup or a Party auto-play for a human stays with the old code, as before). */
(function(g){
"use strict";
var R=g.Risk, E=R&&R.Engine, KEY="bg_ai_risk", VER=1;
if(!E||R.Brain) return;

var SKILL={
  easy:  {casual:1, depth:1, chunks:2,  noise:2.5, th:1.2, kex:.45, learn:false, mem:0,   jit:.2},
  normal:{depth:2, chunks:6,  noise:0,   th:0,   kex:1,   learn:true,  mem:1,   jit:.06},
  hard:  {depth:2, chunks:6,  noise:0,   th:0,   kex:1,   learn:true,  mem:1.3, jit:.03, P:{ex:0.7, wk2:1.1, cp:1.5, oc:0.1}}   // tuned against Normal (sprint/ai-opus-a pipeline: 66 % head to head)
};
/*P*/var P={tv:0.9, oc:0.3, ch:2.5, cb:1.8, cp:1.0, deny:0.6, card:1.0, wme:1.0, wk2:0.85, wkN:0.55, wn:0.12, lo:0.6, ex:1.0, gam:0.8, th:0.25, pmin:0.12, apw:0.9, rf:0.8, win:300, elimB:4, ecard:0.9, pull:0.12, mob:0.12, fmin:0.15, occAp:0.9, mInc:2.5, mLo:0.72, mHi:1.45, mTh:0.5, tTh:0.25, mis:2.5, hqDef:14, hqTake:12, selfb:0.8, kth:1.5, hold:0, chooseA:0.8, st0:25, st1:15, stTh:0.6};   // tuning constants (the tournament sweeps them)
var KEYS=["atk","def","cont","card"], LO=.75, HI=1.35, MOODS=["balanced","bold","reserved"];
var store=null, storeSet=false;
var stats={calls:0,decided:0,declined:0,errors:0,lastError:null,moods:{balanced:0,bold:0,reserved:0}};
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }

/* ---------- the per-device weight table ---------- */
function freshTable(){ return {v:VER,games:0,w:{atk:1,def:1,cont:1,card:1},t:{wins:[0,0,0],games:[0,0,0]}}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w) return t;
    KEYS.forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    t.games=Math.max(0,Math.min(1e6,+d.games||0));
    if(d.t&&d.t.wins&&d.t.games) for(var i=0;i<3;i++){ t.t.wins[i]=Math.max(0,Math.min(1e6,+d.t.wins[i]||0)); t.t.games[i]=Math.max(0,Math.min(1e6,+d.t.games[i]||0)); }
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- small helpers ---------- */
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.s=(Math.imul(b.s,1664525)+1013904223)>>>0; return b.s/4294967296; }
function skillOf(G,p){ return SKILL[p&&p.skill]||SKILL[G.skill]||SKILL.normal; }
function wp(a,d){ return E.winProb(a,d); }
function pl(d,arm){ return (d>=2&&arm>=1)?E.winProb(d,arm):0; }   // chance a stack of d (territory armies) takes a territory holding arm

/* ---------- the map, once ---------- */
var MD=null;
function md(){
  if(MD) return MD;
  var m=R.MAP, n=m.n, cs=m.continents, i, j, D=new Int8Array(n*n);
  for(i=0;i<n;i++){
    for(j=0;j<n;j++) D[i*n+j]=99; D[i*n+i]=0;
    var q=[i], h=0; while(h<q.length){ var x=q[h++]; for(j=0;j<m.adj[x].length;j++){ var y=m.adj[x][j]; if(D[i*n+y]===99){ D[i*n+y]=D[i*n+x]+1; q.push(y); } } }
  }
  MD={n:n,adj:m.adj,cont:m.cont,nc:cs.length,size:cs.map(function(c){ return c.terrs.length; }),bonus:cs.map(function(c){ return c.bonus; }),terrs:cs.map(function(c){ return c.terrs; }),D:D};
  return MD;
}

/* ---------- battle expectations: built once from the dice odds (the same single-roll table as the engine) ---------- */
var ROLL=[null,
  [null,[[1,0,21/36],[0,1,15/36]],[[1,0,161/216],[0,1,55/216]]],
  [null,[[1,0,91/216],[0,1,125/216]],[[2,0,581/1296],[1,1,420/1296],[0,2,295/1296]]],
  [null,[[1,0,441/1296],[0,1,855/1296]],[[2,0,2275/7776],[1,1,2611/7776],[0,2,2890/7776]]]];
var BN=64, BW=BN+1, TW=null, TS=null, TA=null, TD=null;
function bprep(){
  if(TW) return;
  var Wt=new Float64Array(BW*BW), S=new Float64Array(BW*BW), A=new Float64Array(BW*BW), D=new Float64Array(BW*BW), a, d, i, k;
  for(a=0;a<=BN;a++) for(d=0;d<=BN;d++){
    i=a*BW+d;
    if(d===0){ Wt[i]=1; S[i]=a; A[i]=a; continue; }
    if(a<=1){ A[i]=a; D[i]=d; continue; }
    var o=ROLL[Math.min(3,a-1)][Math.min(2,d)];
    for(k=0;k<o.length;k++){ var j=(a-o[k][0])*BW+d-o[k][1], pr=o[k][2]; Wt[i]+=pr*Wt[j]; S[i]+=pr*S[j]; A[i]+=pr*A[j]; D[i]+=pr*D[j]; }
  }
  TW=Wt; TS=S; TA=A; TD=D;
}
/* an all-out attack of a (territory armies) on d: bP win chance, bR armies left in the attacking territory after a win, bLA / bLD expected losses */
var bP=0, bR=0, bLA=0, bLD=0;
function battle(a,d){
  a=Math.floor(a); d=Math.floor(d);
  if(d<=0){ bP=1; bR=a; bLA=0; bLD=0; return; }
  if(a<=1){ bP=0; bR=0; bLA=0; bLD=0; return; }
  bprep(); bP=wp(a,d);
  var k=1, a2=a, d2=d;
  if(a>BN||d>BN){ k=Math.max(a,d)/BN; a2=Math.max(2,Math.round(a/k)); d2=Math.max(1,Math.round(d/k)); }
  var i=a2*BW+d2, w=TW[i];
  bR=w>1e-9?TS[i]/w*k:1; bLA=(a2-TA[i])*k; bLD=(d2-TD[i])*k;
  if(bR<1) bR=1;
}

/* ---------- the brain object (plain data) ---------- */
function brainOf(G,p){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b||typeof ai.b!=="object") ai=G.ai={v:1,b:{}};
  var b=ai.b[p.id];
  if(b&&b.k&&b.mem&&b.mem.at&&b.mem.cf) return b;
  var sk=skillOf(G,p), tab=sk.learn?readTable():freshTable();
  b=ai.b[p.id]={id:p.id, t:(hash(p.name)+p.id)%3, s:(hash(p.name+"|"+G.players.length)^Math.imul(p.id+1,2654435761))>>>0, k:{}, mem:{at:{},cf:[0,0,0,0,0,0]}, pos:-1, mood:"balanced"};
  KEYS.forEach(function(k){ b.k[k]=clamp(tab.w[k]*(1+(rnd(b)*2-1)*sk.jit),LO,HI); });
  return b;
}
/* memory: the PUBLIC attack events since the last look (who attacked whom, in which continent); it fades a little every turn of its own */
function observe(G,b){
  var log=G.log||[], m=md(), at=b.mem.at, cf=b.mem.cf;
  if(!(b.pos>=0)||b.pos>log.length) b.pos=log.length;   // a new or loaded game: start reading from here
  for(var i=b.pos;i<log.length;i++){
    var e=log[i]; if(!e) continue;
    if(e.type==="attack"&&typeof e.p==="number"&&typeof e.def==="number"){
      var k=e.p+">"+e.def; at[k]=Math.min(99,(at[k]||0)+1);
      if(e.to>=0&&e.to<m.n){ var ci=m.cont[e.to]; cf[ci]=Math.min(99,(+cf[ci]||0)+1); }
    } else if(e.type==="turn"&&e.p===b.id){
      b.turns=(b.turns|0)+1;
      for(var key in at){ at[key]=Math.round(at[key]*85)/100; if(at[key]<0.05) delete at[key]; }
      for(var c=0;c<cf.length;c++) cf[c]=Math.round((+cf[c]||0)*85)/100;
    }
  }
  b.pos=log.length;
}

/* ---------- the situation, read once per decision ---------- */
var EMPTY=[];
function mkCtx(G,p,b){
  var m=md(), n=m.n, nc=m.nc, np=G.players.length, me=p.id, sk=skillOf(G,p), t, i, q, u;
  var c={G:G,m:m,me:me,b:b,sk:sk,np:np,evn:0,evMax:24000,cc:{}};
  var o=new Int8Array(n), a=new Int32Array(n), T=new Int32Array(np), A=new Int32Array(np), cnt=new Int32Array(np*nc);
  for(t=0;t<n;t++){ var x=G.terr[t]; o[t]=x.o; a[t]=x.a; if(x.o>=0&&x.o<np){ T[x.o]++; A[x.o]+=x.a; cnt[x.o*nc+m.cont[t]]++; } }
  c.o=o; c.a=a; c.T=T; c.A=A; c.cnt=cnt;
  var real=[], opp=[], isOpp=new Int8Array(np);
  G.players.forEach(function(pp){ if(!pp.neutral&&pp.alive!==false){ real.push(pp.id); if(pp.id!==me){ opp.push(pp.id); isOpp[pp.id]=1; } } });
  c.real=real; c.opp=opp; c.isOpp=isOpp; c.neu=G.two?2:-9;
  var setup=(G.phase==="setup2p"||G.phase==="claim"||G.phase==="deploy"||G.phase==="hq");
  c.setup=setup;
  /* income and the next card set */
  var inc=new Float64Array(np);
  real.forEach(function(q2){ var s=Math.max(3,Math.floor(T[q2]/3)); for(var ci=0;ci<nc;ci++) if(cnt[q2*nc+ci]===m.size[ci]) s+=m.bonus[ci]; inc[q2]=s; });
  c.inc=inc;
  var nv=E.nextSetValue(G); c.nextVal=(nv==null)?7.5:nv;
  c.cardVal=Math.max(2,c.nextVal/3+0.5);
  /* the opponents' expected reinforcement next turn (income + a likely trade), and how much of it may land on one border */
  var Rq=new Float64Array(np), two=real.length<=2, nOpp=opp.length;
  var at=b.mem.at, mw=sk.mem;
  c.lamq=new Float64Array(np); c.wkq=new Float64Array(np);
  opp.forEach(function(q2){
    var k=G.players[q2].cards.length, ps=k>=5?1:k===4?.8:k===3?.4:0;
    var r=inc[q2]+ps*c.nextVal; if(setup) r=inc[q2]+0.5*(G.initLeft&&G.initLeft[q2]||0);
    var ag=1, lam=two?1:P.lo, wk=two?P.wk2:P.wkN;
    if(!two&&mw>0){   // memory: an opponent that keeps attacking me is watched (and hit back) harder
      var mine2=at[q2+">"+me]||0, tot=0; for(var key in at) if(key.indexOf(q2+">")===0) tot+=at[key];
      var share=(mine2+1)/(tot+nOpp), fair=1/Math.max(1,real.length-1), rel=share/fair;
      ag=clamp(1+(rel-1)*0.25*mw,0.75,1.35); lam*=clamp(1+(rel-1)*0.2*mw,0.8,1.3); wk*=clamp(1+(rel-1)*0.2*mw,0.8,1.3);
    }
    Rq[q2]=r*P.rf*ag; c.lamq[q2]=lam; c.wkq[q2]=wk;
  });
  c.Rq=Rq;
  /* contested continents (memory) hold less well */
  c.hold=new Float64Array(nc); for(i=0;i<nc;i++) c.hold[i]=1/(1+0.03*mw*(+b.mem.cf[i]||0));
  /* danger: the biggest stack an opponent can bring against each of my territories next turn (and the second biggest, from elsewhere) */
  var d1=new Float64Array(n), d2=new Float64Array(n), d1s=new Int16Array(n);
  for(t=0;t<n;t++){
    d1s[t]=-1; if(o[t]!==me) continue;
    var adj=m.adj[t];
    for(i=0;i<adj.length;i++){ u=adj[i]; q=o[u]; if(q<0||!isOpp[q]) continue; var s2=a[u]+Rq[q]; if(s2>d1[t]){ d2[t]=d1[t]; d1[t]=s2; d1s[t]=u; } else if(s2>d2[t]) d2[t]=s2; }
  }
  c.d1=d1; c.d2=d2; c.d1s=d1s;
  /* mission and headquarters */
  var pl0=G.players[me];
  c.mis=(G.o.mode==="mission"&&pl0.mission)?pl0.mission:null;
  c.mc=new Float64Array(nc); for(i=0;i<nc;i++) c.mc[i]=1;
  if(c.mis&&c.mis.k==="cont") c.mis.c.forEach(function(ci){ if(ci>=0&&ci<nc) c.mc[ci]=P.mis; });
  c.cap=G.o.mode==="capital"&&G.phase!=="hq"; c.hqOf=new Int8Array(n); for(t=0;t<n;t++) c.hqOf[t]=-1;
  if(c.cap) G.players.forEach(function(pp){ if(pp.hq!=null&&pp.hq>=0&&pp.hq<n) c.hqOf[pp.hq]=pp.id; });
  /* elimination: the win in a 2-player game (or a kill mission), else the loser's cards */
  c.elim=new Float64Array(np); c.pull=new Float64Array(np);
  var res=(G.phase==="reinforce"?G.reserve:0);
  opp.forEach(function(q2){
    var v;
    if(real.length===2||(c.mis&&c.mis.k==="kill"&&c.mis.c===q2)) v=P.win;   // the last rival standing (every game type), or my kill mission
    else v=P.elimB+(G.o.cardOnElim?G.players[q2].cards.length*c.cardVal*P.ecard:0);
    c.elim[q2]=v;
    var pow=res, cost=0;
    for(var t2=0;t2<n;t2++){
      if(o[t2]===q2) cost+=1.15*a[t2]+1;
      else if(o[t2]===me&&a[t2]>1){ var ad=m.adj[t2]; for(var j=0;j<ad.length;j++) if(o[ad[j]]===q2){ pow+=a[t2]-1; break; } }
    }
    var feas=clamp(pow/Math.max(1,cost)-0.6,0,1);
    c.pull[q2]=feas*Math.min(v,P.win)*P.pull;
  });
  /* a neutral that is the last piece of a continent an opponent nearly owns */
  c.nearOpp=new Int8Array(nc); opp.forEach(function(q2){ for(var ci=0;ci<nc;ci++) if(cnt[q2*nc+ci]===m.size[ci]-1) c.nearOpp[ci]=1; });
  /* the mood: the race of armies + expected income; the temperament shifts where "behind" and "ahead" start */
  var pw=0, nr=0, myp=0;
  real.forEach(function(q2){ var k2=G.players[q2].cards.length, ps2=k2>=5?1:k2===4?.8:k2===3?.4:0, v2=A[q2]+P.mInc*(inc[q2]+ps2*c.nextVal); pw+=v2; nr++; if(q2===me) myp=v2; });
  var ratio=nr?myp/(pw/nr):1, tb=b.t===1?0.08:b.t===2?-0.08:0;
  var mood=ratio<P.mLo+tb?"bold":ratio>P.mHi+tb?"reserved":"balanced";
  if(b.mood!==mood) b.mood=mood;
  c.mood=mood;
  var kx=mood==="bold"?0.85:mood==="reserved"?1.15:1;
  c.kex=P.ex*kx*sk.kex;
  c.th=P.th+(mood==="bold"?-P.mTh:mood==="reserved"?P.mTh:0)+(b.t===1?-P.tTh:b.t===2?P.tTh:0)-(b.k.atk-1)*P.kth+sk.th;
  c.kdef=b.k.def; c.kc=b.k.cont; c.cardV=c.cardVal*P.card*b.k.card;
  /* impatience: after a long game (its own turns) it presses harder, so careful computers never sit in an endless stand-off */
  var imp=clamp(((b.turns|0)-P.st0)/P.st1,0,3); c.imp=imp;
  if(imp>0){ c.th-=imp*P.stTh; opp.forEach(function(q2){ c.wkq[q2]*=1+imp; c.lamq[q2]*=1+0.5*imp; c.pull[q2]*=1+imp; }); }
  c.lam2=two;
  c.depth=sk.depth; c.noise=sk.noise;
  /* holding values and the chance of losing each of my territories now */
  c.hv=new Float64Array(n); c.pl=new Float64Array(n);
  for(t=0;t<n;t++){ if(o[t]!==me) continue; c.hv[t]=hvAt(c,t,EMPTY); c.pl[t]=pl(d1[t],a[t]); }
  return c;
}
/* steps from each territory to the nearest one that is not mine (1 = on the front); fortify only */
function frontDist(c){
  if(c.df) return c.df;
  var m=c.m, n=m.n, df=new Int8Array(n), t, u;
  for(t=0;t<n;t++){ if(c.o[t]!==c.me) continue; var best=99; for(u=0;u<n;u++) if(c.o[u]!==c.me){ var dd=m.D[t*n+u]; if(dd<best) best=dd; } df[t]=best; }
  return (c.df=df);
}
function inH(H,x){ for(var i=0;i<H.length;i++) if(H[i]===x) return true; return false; }
function cntH(c,H,ci,q){ var k=0; for(var i=0;i<H.length;i++){ var h=H[i]; if((ci<0||c.m.cont[h]===ci)&&(q===-2||c.o[h]===q)) k++; } return k; }
function mineH(c,x,H){ return c.o[x]===c.me||inH(H,x); }
/* danger to x (mine, or mine in the plan H): the biggest opponent stack next to it, excluding excl */
function dangerAt(c,x,H,excl){
  var adj=c.m.adj[x], best=0;
  for(var i=0;i<adj.length;i++){ var u=adj[i]; if(u===excl||inH(H,u)) continue; var q=c.o[u]; if(q<0||!c.isOpp[q]) continue; var s=c.a[u]+c.Rq[q]; if(s>best) best=s; }
  return best;
}
/* what holding x (mine in plan H) is worth: the territory swing, the card the taker gets, my continent there (whole: its bonus; else progress) */
function hvAt(c,x,H){
  var m=c.m, ci=m.cont[x], sz=m.size[ci], bo=m.bonus[ci];
  var mine=c.cnt[c.me*m.nc+ci]+cntH(c,H,ci,-2);
  if(c.o[x]!==c.me&&!inH(H,x)) mine++;
  var v=P.tv*(c.lam2?2:1+P.lo)+P.oc*c.cardVal;
  if(mine>=sz) v+=bo*P.ch*c.hold[ci]*c.kc*c.mc[ci]; else v+=bo*P.cp*c.kc*c.mc[ci]*(2*mine-1)/(sz*sz);
  if(c.cap){ var hq=c.hqOf[x]; if(hq===c.me) v+=P.hqDef; else if(hq>=0) v+=P.hqTake*0.6; }
  return v;
}
/* the mission is complete once x is taken too? (continents / territory count) */
function missionWin(c,x,H,ci,whole){
  var mi=c.mis; if(!mi) return false;
  var m=c.m;
  if(mi.k==="cont"){
    if(!whole) return false;
    var full=function(cc){ if(cc===ci) return true; return c.cnt[c.me*m.nc+cc]+cntH(c,H,cc,-2)>=m.size[cc]; };
    if(!mi.c.every(full)) return false;
    if(!mi.plus) return true;
    var extra=0; for(var cc=0;cc<m.nc;cc++) if(mi.c.indexOf(cc)<0&&full(cc)) extra++;
    return extra>=mi.plus;
  }
  if(mi.k==="terr"){
    if(mi.min>1){ var k=0; for(var t=0;t<m.n;t++) if(c.o[t]===c.me&&c.a[t]>=mi.min) k++; return k+H.length+1>=mi.n; }
    return c.T[c.me]+H.length+1>=mi.n;
  }
  return false;
}
/* what taking t is worth (t's owner loses it, I gain it), given the plan H of earlier conquests this turn */
function gain(c,t,H,first){
  var m=c.m, me=c.me, q=c.o[t], ci=m.cont[t], sz=m.size[ci], bo=m.bonus[ci], nc=m.nc;
  var mine=c.cnt[me*nc+ci]+cntH(c,H,ci,-2), v=P.tv;
  if(mine+1>=sz){ v+=bo*P.ch*c.hold[ci]*c.kc*c.mc[ci]; if(missionWin(c,t,H,ci,true)) v+=P.win; }
  else { v+=bo*P.cp*c.kc*c.mc[ci]*(2*mine+1)/(sz*sz); if(c.mis&&c.mis.k==="terr"&&missionWin(c,t,H,ci,false)) v+=P.win; }
  if(c.mis&&c.mis.k==="terr") v+=P.tv;
  if(q>=0&&c.isOpp[q]){
    var lam=c.lamq[q];
    v+=P.tv*lam;
    var th=c.cnt[q*nc+ci]-cntH(c,H,ci,q);
    if(th>=sz) v+=bo*P.cb*lam; else if(th>0) v+=bo*P.cp*lam*(2*th-1)/(sz*sz);
    var tl=c.T[q]-cntH(c,H,-1,q);
    if(tl<=1) v+=c.elim[q]; else v+=c.pull[q]/tl;
  } else if(q===c.neu&&c.nearOpp[ci]) v+=bo*P.deny;
  if(c.cap){ var hq=c.hqOf[t]; if(hq>=0&&hq!==me){ v+=P.hqTake; if(capWin(c,t,H)) v+=P.win; } }
  if(first) v+=c.cardV;
  return v;
}
function capWin(c,t,H){
  var G=c.G, me=c.me, pme=G.players[me]; if(pme.hq==null||(c.o[pme.hq]!==me&&!inH(H,pme.hq))) return false;
  var np=E.realPlayers(G).length, need=np<=3?np-1:(np===4?2:3), k=0;
  G.players.forEach(function(q){ if(q.id===me||q.hq==null) return; if(q.hq===t||c.o[q.hq]===me||inH(H,q.hq)) k++; });
  return k>=Math.min(need,np-1);
}
/* the threat a conquest of t removes from my other territories next to it */
function threatGone(c,t,f){
  var q=c.o[t]; if(q<0||!c.isOpp[q]) return 0;
  var adj=c.m.adj[t], s=0;
  for(var i=0;i<adj.length;i++){ var v=adj[i]; if(v===f||c.o[v]!==c.me||c.d1s[v]!==t) continue; s+=(c.pl[v]-pl(c.d2[v],c.a[v]))*c.hv[v]; }
  return s;
}
/* expected value (armies) of an all-out attack from f (A armies there) on t, against stopping now; H = earlier conquests of the plan;
   depth > 1 adds the best follow-up attack from t */
function ev(c,f,A,t,H,first,depth){
  c.evn++;
  var D=c.a[t], q=c.o[t];
  battle(A,D); var p=bP, rem=bR, la=bLA, ld=bLD;
  var wk=(q>=0&&c.isOpp[q])?c.wkq[q]:(q===c.neu?P.wn:0);
  var val=-la*P.wme+ld*wk, kex=c.kex;
  var top=H.length===0;
  var hvF=top?c.hv[f]:hvAt(c,f,H);
  var dFull=top?c.d1[f]:dangerAt(c,f,H,-1);
  var pf0=pl(dFull,A)*hvF, expoFail=pl(dFull,1)*hvF;
  if(p<1e-3) return val+(pf0-expoFail)*kex;
  var dF=top?(c.d1s[f]===t?c.d2[f]:c.d1[f]):dangerAt(c,f,H,t);
  var H2=H.concat([t]);
  var gn=gain(c,t,H,first);
  var hvT=hvAt(c,t,H2), dT=dangerAt(c,t,H2,-1);
  var S=Math.max(2,rem), mx=S-1, mn=Math.min(3,mx), half=Math.max(mn,Math.round(mx/2));
  var e1=pl(dT,mx)*hvT+pl(dF,1)*hvF, e2=pl(dT,mn)*hvT+pl(dF,S-mn)*hvF, e3=pl(dT,half)*hvT+pl(dF,S-half)*hvF;
  var ew=Math.min(e1,e2,e3);
  var tr=top?threatGone(c,t,f):0, cont=0;
  if(depth>1&&mx>=2&&c.evn<c.evMax){
    /* the follow-up from t depends only on (t, whole armies moved in, depth) when this is the first step: cached for the decision */
    var ck=top?(t*4096+Math.floor(mx))*4+depth:-1, cv=ck>=0?c.cc[ck]:undefined;
    if(cv===undefined){
      var adj=c.m.adj[t], best=0;
      for(var i=0;i<adj.length;i++){ var u=adj[i]; if(c.o[u]<0||mineH(c,u,H2)) continue; var e=ev(c,t,mx,u,H2,false,depth-1); if(e>best) best=e; }
      cv=best; if(ck>=0) c.cc[ck]=cv;
    }
    cont=cv*P.gam;
  }
  return val+p*(gn-ew*kex+tr+cont)-(1-p)*expoFail*kex+pf0*kex;
}
/* the best attack from f with A armies (0 = none worth it) */
function bestFrom(c,f,A,first,depth){
  if(A<2) return 0;
  var adj=c.m.adj[f], best=0;
  for(var i=0;i<adj.length;i++){ var t=adj[i]; if(c.o[t]===c.me||c.o[t]<0) continue; var e=ev(c,f,A,t,EMPTY,first,depth); if(e>best) best=e; }
  return best;
}
/* worth of a stack of A armies on my territory f: its best attack, minus what I stand to lose there */
function U(c,f,A,first,depth){ return bestFrom(c,f,A,first,depth)*P.apw-pl(c.d1[f],A)*c.hv[f]*c.kdef; }
function frontier(c){ var r=[], m=c.m; for(var t=0;t<m.n;t++){ if(c.o[t]!==c.me) continue; var adj=m.adj[t]; for(var i=0;i<adj.length;i++) if(c.o[adj[i]]!==c.me){ r.push(t); break; } } return r; }
function room(c,t){ var cap=c.G.o.capArmies; return cap?Math.max(0,cap-c.a[t]):1e9; }
/* split R armies between my front territories: greedy, a chunk at a time, by the best average gain per army over 1, 2, 4... chunks.
   Returns [[territory, armies], ...] in the order they were chosen (the first is the most urgent). */
function allocate(c,Rr,first){
  var cands=frontier(c).filter(function(f){ return room(c,f)>0; });
  if(!cands.length){ var any=[]; for(var t=0;t<c.m.n;t++) if(c.o[t]===c.me&&room(c,t)>0) any.push(t); return any.length?[[any[0],Math.min(Rr,room(c,any[0]))]]:[]; }
  var depth=Math.min(c.depth,2), cache={}, x={}, order=[], left=Rr, ch=Math.max(1,Math.ceil(Rr/c.sk.chunks));
  var Uc=function(f,A){ var k=f*100000+A; var v=cache[k]; if(v===undefined){ v=U(c,f,A,first,depth); if(c.noise) v+=(rnd(c.b)-.5)*c.noise; cache[k]=v; } return v; };
  if(cands.length>12){   // keep the cost bounded: the 12 places where the whole reserve would matter most
    cands=cands.map(function(f){ return [f,Uc(f,c.a[f]+Math.min(Rr,room(c,f)))-Uc(f,c.a[f])]; }).sort(function(p1,p2){ return p2[1]-p1[1]; }).slice(0,12).map(function(z){ return z[0]; });
  }
  var guard=0;
  while(left>0&&guard++<64){
    var bf=-1, bn=0, bv=-1e18;
    for(var i=0;i<cands.length;i++){
      var f=cands[i], x0=x[f]||0, A0=c.a[f]+x0, rm=room(c,f)-x0; if(rm<=0) continue;
      var u0=Uc(f,A0), last=0;
      for(var k=1;k<=8;k*=2){ var nn=Math.min(k===8?left:left,k===8?left:k*ch,rm); if(nn<=last) break; last=nn; var gv=(Uc(f,A0+nn)-u0)/nn; if(gv>bv){ bv=gv; bf=f; bn=nn; } }
    }
    if(bf<0) break;
    x[bf]=(x[bf]||0)+bn; order.push([bf,bn]); left-=bn;
  }
  return order;
}

/* ---------- decisions ---------- */
function tradeOpen(G){ return !(G.mustDown&&E.cur(G).cards.length<=4); }
function tradePlan(c){
  var G=c.G, pl0=G.players[c.me]; if(!pl0.cards||pl0.cards.length<3||!tradeOpen(G)) return null;
  var sets=E.findSets(pl0.cards); if(!sets.length) return null;
  var must=E.forcedNow(G)||(G.mustDown&&pl0.cards.length>4);
  if(!must&&P.hold>0&&c.nextVal<P.hold&&pl0.cards.length<4) return null;   // (off by default) keep a small set for later
  var tb=G.o.terrBonus, best=null, bv=-1e9;
  var anyNoWild=sets.some(function(s){ return s.every(function(cd){ return cd.sym!=="W"; }); });
  sets.forEach(function(s){
    var v=E.setValue(G,s), own=s.filter(function(cd){ return cd.t>=0&&c.o[cd.t]===c.me; }).length, w=s.filter(function(cd){ return cd.sym==="W"; }).length;
    var bonus=tb==="perCard"?2*own:(tb==="cap2"||(tb==="cap2turn"&&!G.terrBonusTurn))?(own?2:0):0;
    var sc=v+bonus-(anyNoWild?w*1.5:0);
    if(sc>bv){ bv=sc; best=s; }
  });
  var mine=best.filter(function(cd){ return cd.t>=0&&c.o[cd.t]===c.me; }), bt=null, bg=-1e9;
  mine.forEach(function(cd){ var t=cd.t, gv=U(c,t,c.a[t]+2,true,1)-U(c,t,c.a[t],true,1); if(gv>bg){ bg=gv; bt=t; } });
  return {t:"trade",ids:best.map(function(cd){ return cd.id; }),bonusTerr:bt};
}
function attackPick(c){
  var G=c.G, m=c.m, first=!G.conquered, best=null, bv=c.th;
  for(var f=0;f<m.n;f++){
    if(c.o[f]!==c.me||c.a[f]<2) continue;
    var adj=m.adj[f];
    for(var i=0;i<adj.length;i++){
      var t=adj[i]; if(c.o[t]===c.me||c.o[t]<0) continue;
      if(wp(c.a[f],c.a[t])<P.pmin&&!(c.isOpp[c.o[t]]&&c.T[c.o[t]]===1&&c.real.length===2)) continue;
      var e=ev(c,f,c.a[f],t,EMPTY,first,c.depth);
      if(c.noise) e+=(rnd(c.b)-.5)*c.noise;
      if(e>bv){ bv=e; best={t:"attack",from:f,to:t,dice:Math.min(3,c.a[f]-1)}; }
    }
  }
  return best;
}
function occupyPick(c){
  var oc=c.G.occ, f=oc.from, t=oc.to, A=c.a[f], mn=oc.min, mx=Math.min(oc.max,A-1);
  if(mx<=mn) return {t:"occupy",n:mn};
  var depth=Math.max(1,c.depth-1), cand=[mn,mx,Math.round((mn+mx)/2),Math.round(mn+(mx-mn)/4),Math.round(mn+3*(mx-mn)/4)];
  if(c.mis&&c.mis.k==="terr"&&c.mis.min>1){ cand.push(Math.max(mn,Math.min(mx,A-c.mis.min))); }
  var best=mx, bv=-1e18, hvT=c.hv[t], hvF=c.hv[f];
  cand.forEach(function(n){
    if(n<mn||n>mx) return;
    var v=bestFrom(c,t,n,false,depth)*P.occAp+bestFrom(c,f,A-n,false,depth)*P.occAp-(pl(c.d1[t],n)*hvT+pl(c.d1[f],A-n)*hvF)*c.kdef*c.kex;
    if(c.mis&&c.mis.k==="terr"&&c.mis.min>1&&n>=c.mis.min&&A-n>=c.mis.min) v+=1;
    if(v>bv+1e-9||(Math.abs(v-bv)<=1e-9&&n>best)){ bv=v; best=n; }
  });
  return {t:"occupy",n:best};
}
function fortifyPick(c){
  var G=c.G, m=c.m, best=null, bv=P.fmin, cache={}, depth=1, df=frontDist(c);
  var Uf=function(x,A){ var k=x*100000+A, v=cache[k]; if(v===undefined){ v=(df[x]<=1?bestFrom(c,x,A,false,depth)*0.5:0)-pl(c.d1[x],A)*c.hv[x]*c.kdef; cache[k]=v; } return v; };
  var srcs=[];
  for(var f=0;f<m.n;f++) if(c.o[f]===c.me&&c.a[f]>=2) srcs.push(f);
  if(srcs.length>16) srcs=srcs.sort(function(x,y){ return (c.a[y]-c.d1[y]*0.5)-(c.a[x]-c.d1[x]*0.5); }).slice(0,16);
  var cap=G.o.capArmies, lim=G.o.fortify==="steps7"?G.fortLeft:1e9;
  srcs.forEach(function(f){
    var tg=E.fortifyTargets(G,f); if(!tg.length) return;
    if(tg.length>14) tg=tg.filter(function(t){ return df[t]<=1; }).slice(0,14);
    var ns=[c.a[f]-1,Math.ceil((c.a[f]-1)/2)];
    ns.forEach(function(n0){
      var n=Math.min(n0,lim); if(n<1) return;
      tg.forEach(function(t){
        var nn=n; if(cap) nn=Math.min(nn,cap-c.a[t]); if(nn<1) return;
        var v=Uf(t,c.a[t]+nn)-Uf(t,c.a[t])+Uf(f,c.a[f]-nn)-Uf(f,c.a[f])+nn*P.mob*(df[f]-df[t]);
        if(v>bv){ bv=v; best={t:"fortify",from:f,to:t,n:nn}; }
      });
    });
  });
  return best;
}
function placePlan(c){
  var G=c.G, order=allocate(c,G.reserve,!G.conquered);
  if(!order.length) return null;
  var f=order[0][0], n=0; order.forEach(function(z){ if(z[0]===f) n+=z[1]; });
  n=Math.max(1,Math.min(n,G.reserve)); if(G.o.capArmies) n=Math.min(n,Math.max(1,G.o.capArmies-c.a[f]));
  return {t:"place",terr:f,n:n};
}
function setupPlace(c,k){
  var G=c.G, left=Math.max(k,G.initLeft[c.me]||0), order=allocate(c,left,true), out=[];
  for(var i=0;i<order.length&&out.length<k;i++) for(var j=0;j<order[i][1]&&out.length<k;j++) out.push(order[i][0]);
  if(!out.length){ for(var t=0;t<c.m.n&&out.length<k;t++) if(c.o[t]===c.me) out.push(t); }
  while(out.length<k) out.push(out[0]);
  return out;
}
/* a 2-player game's neutral army: where it blocks the rival's best move the most, and mine the least */
function neutralPick(c){
  var m=c.m, me=c.me, best=null, bv=-1e18, q=c.opp[0];
  for(var t=0;t<m.n;t++){
    if(c.o[t]!==2) continue;
    var aq=0, am=0, adj=m.adj[t];
    for(var i=0;i<adj.length;i++){ var u=adj[i]; if(c.o[u]===q) aq=Math.max(aq,c.a[u]); else if(c.o[u]===me) am=Math.max(am,c.a[u]); }
    var s=0, D=c.a[t];
    if(aq>0){ var Aq=aq+c.Rq[q]; s+=(wp(Aq,D)-wp(Aq,D+1))*worthTo(c,q,t); }
    if(am>0){ var Am=am+c.inc[me]; s-=P.selfb*(wp(Am,D)-wp(Am,D+1))*worthTo(c,me,t); }
    s+=rnd(c.b)*1e-3;
    if(s>bv){ bv=s; best=t; }
  }
  return best;
}
function worthTo(c,q,t){ var m=c.m, ci=m.cont[t], sz=m.size[ci], bo=m.bonus[ci], k=c.cnt[q*m.nc+ci]; return P.tv+(k+1>=sz?bo*P.ch:bo*P.cp*(2*k+1)/(sz*sz)); }
function claimPick(c){
  var m=c.m, me=c.me, best=-1, bv=-1e18;
  for(var t=0;t<m.n;t++){
    if(c.o[t]!==-1) continue;
    var ci=m.cont[t], sz=m.size[ci], bo=m.bonus[ci], mine=c.cnt[me*m.nc+ci], others=0, maxo=0;
    c.opp.forEach(function(q){ var k=c.cnt[q*m.nc+ci]; others+=k; if(k>maxo) maxo=k; });
    var free=sz-mine-others, adjOwn=0, adjOpp=0, adj=m.adj[t];
    for(var i=0;i<adj.length;i++){ var o=c.o[adj[i]]; if(o===me) adjOwn++; else if(o>=0) adjOpp++; }
    var s=3*(mine+1)/sz*(1+bo/4)-2*maxo/sz+1.6*adjOwn-0.4*adjOpp+(sz<=4?1.2:0)-0.12*adj.length+bo/sz*2*c.mc[ci];
    if(free===1&&maxo===sz-1) s+=6;
    if(free===1&&mine===sz-1) s+=8;
    s+=rnd(c.b)*(c.noise?3:0.8);
    if(s>bv){ bv=s; best=t; }
  }
  return best;
}
function hqPick(c){
  var m=c.m, best=-1, bv=-1e18;
  for(var t=0;t<m.n;t++){
    if(c.o[t]!==c.me) continue;
    var adj=m.adj[t], own=0, opp=0; for(var i=0;i<adj.length;i++){ if(c.o[adj[i]]===c.me) own++; else if(c.o[adj[i]]>=0) opp++; }
    var ci=m.cont[t], s=-pl(c.d1[t],c.a[t])*4-opp*0.6+own*0.4+2*c.cnt[c.me*m.nc+ci]/m.size[ci]+(opp===0?1.5:0)+c.a[t]*0.1+rnd(c.b)*0.3;
    if(s>bv){ bv=s; best=t; }
  }
  return best;
}
/* Easy: a casual player. It reads the same board but plays like a beginner: it sprinkles its armies over its borders, attacks only with a
   clear edge and not for long, moves in the fewest armies, seldom fortifies and keeps its cards until it must trade. Meant to be beaten. */
function casual(c){
  var G=c.G, me=c.me, m=c.m, b=c.b, ph=G.phase, r=function(){ return rnd(b); }, t, i;
  var pick=function(arr){ return arr.length?arr[Math.floor(r()*arr.length)]:null; };
  var mood=c.mood, bold=(mood==="bold"||b.t===1), shy=(mood==="reserved"||b.t===2);
  var front=frontier(c), mineAll=[]; for(t=0;t<m.n;t++) if(c.o[t]===me) mineAll.push(t);
  var faceOpp=front.filter(function(f){ return m.adj[f].some(function(u){ return c.o[u]>=0&&c.isOpp[c.o[u]]; }); });
  switch(ph){
    case "claim": {
      var free=[], near=[]; for(t=0;t<m.n;t++) if(c.o[t]===-1){ free.push(t); if(m.adj[t].some(function(u){ return c.o[u]===me; })) near.push(t); }
      var cl=near.length&&r()<0.6?pick(near):pick(free); return cl==null?null:{t:"claim",terr:cl};
    }
    case "deploy": { var dp=pick(faceOpp.length?faceOpp:front.length?front:mineAll); return dp==null?null:{t:"deployOne",terr:dp}; }
    case "setup2p": {
      var k=Math.min(2,G.initLeft[me]||0), pool=front.length?front:mineAll, mine=[]; for(i=0;i<k;i++) mine.push(pick(pool));
      var neus=[]; for(t=0;t<m.n;t++) if(c.o[t]===2) neus.push(t);
      return {t:"setup2p",mine:mine,neutral:G.initLeft[2]>0?pick(neus):null};
    }
    case "hq": { var h=hqPick(c); return h>=0?{t:"hq",terr:h}:null; }
    case "choose": {
      var edge=bold?2:3, any=false;
      for(i=0;i<mineAll.length&&!any;i++){ var f0=mineAll[i]; m.adj[f0].forEach(function(u){ if(c.o[u]!==me&&c.o[u]>=0&&c.a[f0]>=c.a[u]+edge) any=true; }); }
      return {t:"mode",m:any?"attack":"reinforce"};
    }
    case "reinforce": {
      var pl0=G.players[me], must=E.forcedNow(G)||(G.mustDown&&pl0.cards.length>4);
      if(must&&tradeOpen(G)){ var sets=E.findSets(pl0.cards); if(sets.length) return {t:"trade",ids:sets[0].map(function(cd){ return cd.id; }),bonusTerr:null}; }
      if(G.reserve<=0) return {t:"endReinforce"};
      var pool2=faceOpp.length?faceOpp:front.length?front:mineAll;
      if(G.o.capArmies) pool2=pool2.filter(function(x){ return c.a[x]<G.o.capArmies; });
      var tp=pick(pool2); if(tp==null) return null;
      return {t:"place",terr:tp,n:Math.max(1,Math.min(G.reserve,1+Math.floor(r()*(bold?3:2))))};
    }
    case "attack": {
      if(G.noAttack) return {t:"endAttack"};
      var need=bold?1:shy?3:2, la=G.lastAttack;
      // keep fighting the battle it started while it still has the edge
      if(la&&la.p===me&&!la.conquered&&c.o[la.from]===me&&c.o[la.to]!==me&&c.o[la.to]>=0&&c.a[la.from]>=2&&c.a[la.from]>=c.a[la.to]+1) return {t:"attack",from:la.from,to:la.to,dice:Math.min(3,c.a[la.from]-1)};
      if(G.conquered&&r()<(bold?0.3:shy?0.65:0.45)) return {t:"endAttack"};
      var cands=[];
      mineAll.forEach(function(f){ if(c.a[f]<3) return; m.adj[f].forEach(function(u){ if(c.o[u]!==me&&c.o[u]>=0&&c.a[f]>=c.a[u]+need) cands.push([f,u]); }); });
      var ch=pick(cands); if(!ch) return {t:"endAttack"};
      return {t:"attack",from:ch[0],to:ch[1],dice:Math.min(3,c.a[ch[0]]-1)};
    }
    case "occupy": return {t:"occupy",n:G.occ.min};
    case "fortify": {
      if(r()<0.5) return {t:"endTurn"};
      var df=frontDist(c), src=null, sa=1;
      mineAll.forEach(function(f){ if(df[f]>1&&c.a[f]>sa){ sa=c.a[f]; src=f; } });
      if(src==null) return {t:"endTurn"};
      var tg=E.fortifyTargets(G,src).filter(function(x){ return df[x]<df[src]; }); var to=pick(tg);
      if(to==null) return {t:"endTurn"};
      var nn=c.a[src]-1; if(G.o.fortify==="steps7") nn=Math.min(nn,G.fortLeft); if(G.o.capArmies) nn=Math.min(nn,G.o.capArmies-c.a[to]);
      return nn>=1?{t:"fortify",from:src,to:to,n:nn}:{t:"endTurn"};
    }
  }
  return null;
}
function act(c){
  var G=c.G, me=c.me, ph=G.phase;
  if(c.sk.casual&&c.imp<1) return casual(c);   // Easy plays casually; in a very long game it gets serious so the table always ends
  switch(ph){
    case "claim": { var t=claimPick(c); return t>=0?{t:"claim",terr:t}:null; }
    case "deploy": { var d=setupPlace(c,1); return d.length?{t:"deployOne",terr:d[0]}:null; }
    case "setup2p": {
      var k=Math.min(2,G.initLeft[me]||0); if(k<1) return null;
      var mine=setupPlace(c,k), nt=null;
      if(G.initLeft[2]>0){ nt=neutralPick(c); if(nt==null) return null; }
      return {t:"setup2p",mine:mine,neutral:nt};
    }
    case "hq": { var h=hqPick(c); return h>=0?{t:"hq",terr:h}:null; }
    case "choose": {
      var best=0; for(var f=0;f<c.m.n;f++) if(c.o[f]===me&&c.a[f]>=2){ var e=bestFrom(c,f,c.a[f],true,c.depth); if(e>best) best=e; }
      return {t:"mode",m:best-c.th+P.th>E.terrArmies(G,me)*P.chooseA/(1+c.imp)?"attack":"reinforce"};
    }
    case "reinforce": {
      var tr=tradePlan(c); if(tr) return tr;
      if(G.reserve<=0) return {t:"endReinforce"};
      return placePlan(c);
    }
    case "attack": {
      if(G.noAttack) return {t:"endAttack"};
      return attackPick(c)||{t:"endAttack"};
    }
    case "occupy": return occupyPick(c);
    case "fortify": return fortifyPick(c)||{t:"endTurn"};
  }
  return null;
}

/* ---------- the sanity filter: every move must be legal, and no hopeless attack ---------- */
function own(G,t,me){ return t!=null&&t>=0&&t<G.terr.length&&G.terr[t].o===me; }
function sane(G,me,a){
  if(!a||typeof a!=="object") return false;
  var ph=G.phase, T=G.terr, pl0=G.players[me], i;
  switch(a.t){
    case "claim": return ph==="claim"&&a.terr>=0&&a.terr<T.length&&T[a.terr].o===-1;
    case "deployOne": return ph==="deploy"&&own(G,a.terr,me);
    case "setup2p":
      if(ph!=="setup2p"||!Array.isArray(a.mine)||a.mine.length!==Math.min(2,G.initLeft[me])) return false;
      for(i=0;i<a.mine.length;i++) if(!own(G,a.mine[i],me)) return false;
      return G.initLeft[2]>0?own(G,a.neutral,2):true;
    case "hq": return ph==="hq"&&own(G,a.terr,me);
    case "mode": return ph==="choose"&&(a.m==="attack"||a.m==="reinforce");
    case "trade": {
      if(ph!=="reinforce"||!tradeOpen(G)||!Array.isArray(a.ids)||a.ids.length!==3) return false;
      var cs=a.ids.map(function(id){ return pl0.cards.filter(function(cd){ return cd.id===id; })[0]; });
      return cs.every(Boolean)&&(new Set(a.ids)).size===3&&E.validSet(cs);
    }
    case "place": return ph==="reinforce"&&own(G,a.terr,me)&&a.n>=1&&a.n<=G.reserve&&!(E.forcedNow(G)&&E.findSets(pl0.cards).length);
    case "endReinforce": return ph==="reinforce"&&G.reserve===0&&!(E.forcedNow(G)&&E.findSets(pl0.cards).length);
    case "attack": {
      if(ph!=="attack"||G.noAttack||!own(G,a.from,me)||T[a.from].a<2) return false;
      if(!(a.to>=0&&a.to<T.length)||T[a.to].o===me||T[a.to].o<0||R.MAP.adj[a.from].indexOf(a.to)<0) return false;
      if(wp(T[a.from].a,T[a.to].a)>=P.pmin) return true;
      // a long shot only when that territory wins the game
      var q=T[a.to].o, last=G.players[q]&&!G.players[q].neutral&&E.owned(G,q).length===1&&E.realPlayers(G).filter(function(x){ return x.alive; }).length===2;
      return !!last;
    }
    case "endAttack": return ph==="attack";
    case "occupy": return ph==="occupy"&&!!G.occ&&a.n>=G.occ.min&&a.n<=G.occ.max;
    case "fortify": return ph==="fortify"&&G.fortLeft>0&&a.n>=1&&own(G,a.from,me)&&a.n<=T[a.from].a-1&&E.fortifyTargets(G,a.from).indexOf(a.to)>=0;
    case "endTurn": return ph==="fortify"||ph==="attack";
  }
  return false;
}

/* a skill may carry its own tuning constants (SKILL[x].P): swapped in for the decision, then put back */
function withP(over,fn){
  if(!over) return fn();
  var saved={}, k;
  for(k in over) if(Object.prototype.hasOwnProperty.call(P,k)){ saved[k]=P[k]; P[k]=over[k]; }
  try{ return fn(); } finally { for(k in saved) P[k]=saved[k]; }
}
function decide(G){
  stats.calls++;
  try{
    if(!G||G.over) return null;
    var p=G.players[G.turn];
    if(!p||p.human||p.neutral||p.skill==="legacy") return null;
    var b=brainOf(G,p);
    observe(G,b);
    var sk=skillOf(G,p), c=null;
    var a=withP(sk.P,function(){ c=mkCtx(G,p,b); stats.moods[c.mood]++; return act(c); });
    stats.evn=(stats.evn||0)+c.evn; stats.lastEvn=c.evn;
    if(a&&sane(G,p.id,a)){ stats.decided++; return a; }
    stats.declined++; stats.lastDeclined={ph:G.phase,a:a}; return null;
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e).slice(0,600); return null; }   // the caller falls back to the old code
}

/* ---------- learning across games (per device) ---------- */
function finish(G){
  try{
    if(!G||G.aiDone||!G.ai||!G.ai.b||G.winner==null) return;
    G.aiDone=true;
    var ids=Object.keys(G.ai.b);
    if(!ids.some(function(id){ var q=G.players[+id]; return q&&!q.human&&skillOf(G,q).learn; })) return;
    var t=readTable(), any=false;
    ids.forEach(function(id){
      var b=G.ai.b[id], q=G.players[+id]; if(!b||!b.k||!q||q.human||!skillOf(G,q).learn) return; any=true;
      var won=(+id)===G.winner;
      KEYS.forEach(function(k){
        var x=+b.k[k]; if(!isFinite(x)) return;
        var d=x-t.w[k], step=won?.25*d:-.06*d;
        t.w[k]=clamp(t.w[k]+clamp(step,-.05,.05),LO,HI);
      });
      var tt=(b.t|0)%3; t.t.games[tt]++; if(won) t.t.wins[tt]++;
    });
    if(any){ t.games++; writeTable(t); }
  }catch(e){}
}
/* a loaded game: the saved log holds only its last events and the memory was saved with the brain, so the log is read from here on */
function afterLoad(G){ try{ if(G&&G.ai&&G.ai.b) Object.keys(G.ai.b).forEach(function(id){ var b=G.ai.b[id]; if(b&&typeof b==="object") b.pos=(G.log||[]).length; }); }catch(e){} }

R.Brain={P:P,SKILL:SKILL,KEY:KEY,stats:stats,decide:decide,finish:finish,afterLoad:afterLoad,setStore:setStore,readTable:readTable,brainOf:brainOf,observe:observe,mkCtx:mkCtx,ev:ev,battle:function(a,d){ battle(a,d); return {p:bP,rem:bR,la:bLA,ld:bLD}; }};
if(typeof module!=="undefined"&&module.exports) module.exports=R.Brain;
})(typeof window!=="undefined"?window:globalThis);
