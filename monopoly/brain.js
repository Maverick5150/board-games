/* Monopoly - the computer players' brain (step 10). Loaded by monopoly/index.html before the game script; it exposes window.MonoBrain
   and the page calls MonoBrain.init({BOARD,GROUPS,RR_IDX,UTIL_IDX}) once its board data exists. The page asks it at the old code's own
   call points (buy, auction bid, build, jail, trades, raising cash) and keeps the old code as the fallback: MonoBrain.on(G,p,what) is
   false for a human, for a tournament's "legacy" seat and before init, and a throw or an answer that fails the page's checks falls back too.

   One brain per computer player: plain data in G.ai.b[id] (saved with the game; an old save has none and gets fresh ones). Each brain has
   its own temperament (balanced, bold or reserved, from its name and seat), its own small tactic weights and its own memory.
   - It reads the situation on every decision: the race of net worths moves it between balanced, bold (behind: thinner reserves, keener
     bids and trades) and reserved (ahead: more cash kept, careful trades, staying in Jail while the board is dangerous). The temperament
     only nudges the thresholds.
   - It values a deed by what it earns: the long-run chance of a roll ending on each square times its rent. Three houses is the sweet
     spot (the jump in rent per dollar is biggest there, and it builds by rent per dollar); orange, red and the light blues (cheap and
     quick to build) are rated highest.
   - Cash reserve by stage: it keeps enough for the rents it could land on (the rivals' rent per roll and the squares just ahead), counts
     its lone deeds as a cushion, and mortgages a lone deed before it ever sells a house.
   - It blocks: a deed a rival needs for a set is worth more to it, and it bids for it. In a duel it lets a plain deed that is worth less
     than its price to it go to auction and bids tight there (the rival overpays or it comes cheap); at a bigger table it buys its share.
   - Trades: it offers the other computers fair deals (never under the printed price) that complete its own set, raising its offer a few
     steps, and judges every offer by how much it helps itself against how much it helps the other side: it never hands a rival a set
     without getting more back. It remembers refused offers and who has been collecting which colour group.
   - Jail: it gets out early while deeds are still for sale and stays in late, when the rivals' rents are high.
   - Sanity filter: it never buys or bids what it cannot pay, never builds below its reserve, and the page checks every step it takes.
   Skill: G.skill = "easy" | "normal" | "hard" (missing = normal; p.skill can seat different skills in tests). Easy is a gentle player
   (timid buys and bids, two houses at most, no offers of its own, the old way out of Jail and out of debt); Hard adds auction timing,
   the housing shortage, more haggling, tighter bids in a duel and keener bids at a bigger table.
   Proof (BG_audit/sprint/ai-opus-a/mono, seat-balanced tournaments against the old code): see monopoly/FIXES.md, step 10 opus.
   Learning across games: a small weight table in localStorage 'bg_ai_monopoly' (versioned, bounded, safe to delete): Normal and Hard lean
   a little toward the tactic weights that won on this device. */
(function(g){
"use strict";
if(g.MonoBrain) return;
var KEY="bg_ai_monopoly", VER=1, C=null, PREM={H:-1}, PREMG={}, COST3={};

/* the long-run chance (per cent) that a roll ends on each square of the standard board; 10 = Jail (in it or visiting), 30 = never */
var PL=[3.10,2.13,1.88,2.16,2.33,2.96,2.26,0.87,2.32,2.30, 6.22,2.70,2.60,2.37,2.46,2.92,2.79,2.59,2.94,3.09,
        2.88,2.84,1.05,2.74,3.19,3.06,2.71,2.68,2.81,2.59, 0,2.68,2.63,2.37,2.50,2.43,0.86,2.19,2.19,2.63].map(function(x){ return x/100; });
var DP=[0,0,1/36,2/36,3/36,4/36,5/36,6/36,5/36,4/36,3/36,2/36,1/36];   // two dice

var SKILL={
  easy:  {learn:false, trade:false, tries:0, res:1.8, cap:2, bid2:.7, bidN:.9, noise:.35,jail:false, mortBuild:false, smartSell:false, auc:false, short:false, margin:-50},
  normal:{learn:true,  trade:true,  tries:3, res:1,   cap:5, bid2:1,  bidN:1,  noise:0,  jail:true,  mortBuild:true,  smartSell:true,  auc:false, short:false, margin:40},
  hard:  {learn:true,  trade:true,  tries:5, res:1,   cap:5, bid2:.89,bidN:1.05,noise:0, jail:true,  mortBuild:true,  smartSell:true,  auc:true,  short:true,  margin:30}
};
/* bid2 / bidN: its auction bids (and its sense of a plain deed's worth) in a duel / at a table of three or more. In a duel a lower bid wins:
   the rival overpays or the deed comes cheap; at a bigger table the others share what it lets go (tournament runs 4-5) */
/* tuning constants (the tournament sweeps them; see BG_audit/sprint/ai-opus-a/mono) */
var P={
  H:25,          // opponent rolls a developed set has to pay off (the set premium)
  setK:.5,       // share of a set's premium counted as worth now
  partFree:.25,  // progress toward a set whose other deeds are still for sale
  partOpp:.12,   // progress toward a set a rival holds part of (a trade later)
  Hnow:25,       // rolls of the rent a deed earns as it stands
  assetK:1,      // a deed's mortgage value counts as cash
  base:60,       // cash floor
  kRate:5,       // + this many rolls of the rivals' rent per roll
  kNear:.6,      // + this share of the rent expected on the next roll
  liq:.8,        // share of the lone deeds' mortgage value that counts as a cushion
  bidBase:.9,    // auction: the printed price times this ...
  bidInc:.6,     // ... plus this share of the rent it earns ...
  deny:.7,       // ... plus this share of what it would stop a rival from completing
  bfloor:.7,     // build reserve, times the cash floor
  mbRatio:.012,  // mortgage a lone deed to build when the houses earn at least this per dollar per roll
  uCush:150,     // lift a lone deed's mortgage only with this much spare cash
  Hraise:30,     // rolls of rent lost, when it picks what to mortgage or sell in debt
  jailRate:22,   // stay in Jail when the rivals' rent per roll is above this
  buyK:2,        // reserve multiplier for a plain deed (no set progress, no block) ...
  utilK:3,       // ... and for a utility
  buyV:1,        // in a duel, a plain deed worth less than this share of its price to it goes to auction instead (it still bids up to its worth)
  jailPay:250,   // early in the game it pays its way out of Jail only with this much cash (else it rolls for doubles first)
  w2:1, w3:.6, w4:.45,   // weight of the partner's gain in a trade judgement (2, 3, 4+ players)
  hand2:.8, handN:.25,   // extra it asks (times the long-game set premium) to hand a rival a set without getting one: 2 players, more
  Hguard:40,     // the long game a set it would hand over is valued on (a person cannot buy one cheaply)
  shortLeft:10,  // hard: below this many houses in the bank it holds four houses instead of a hotel while a rival waits to build
  pref:{orange:1.15,red:1.1,light_blue:1.3}   // the sets good players rate highest (orange and red earn most, light blue builds fastest)
};
var WK=["res","bid","trd","bld"], LO=.8, HI=1.25;

/* ---------- small helpers ---------- */
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function hash(s){ var h=2166136261; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.s=(Math.imul(b.s,1664525)+1013904223)>>>0; return b.s/4294967296; }
function turnsOf(G){ return (G.stats&&G.stats.turns)||0; }
function skillOf(G,p){ return SKILL[p&&p.skill]||SKILL[G&&G.skill]||SKILL.normal; }
function rivals(G,id){ var a=[]; G.players.forEach(function(q){ if(q.id!==id&&!q.bankrupt) a.push(q); }); return a; }
function arr(x){ return Array.isArray(x)?x.slice():(x&&typeof x.forEach==="function"?Array.from(x):[]); }
// editions (2026-10-16): the page calls init again with each edition's board; RR_RENT / UTIL_MULT / JAIL are that edition's numbers (the classic ones when absent)
function init(c){ C={BOARD:c.BOARD,GROUPS:c.GROUPS,RR_IDX:c.RR_IDX,UTIL_IDX:c.UTIL_IDX,RR:c.RR_RENT||[25,50,100,200],UT:c.UTIL_MULT||[4,10],JAIL:c.JAIL||50}; PREM={H:-1}; TAB=null; }
function tune(o){ for(var k in o) P[k]=o[k]; PREM={H:-1}; }   // tests: change tuning constants (the set premiums are worked out again)
function on(G,p){ return !!C&&!!G&&!!p&&!p.human&&!p.bankrupt&&p.skill!=="legacy"; }

/* the set premium: what a whole colour group earns over P.H rival rolls at its best level (3 houses up to a hotel), less the houses */
function calcPrem(){
  PREM={H:P.H}; PREMG={}; COST3={};
  for(var gn in C.GROUPS){
    var L=C.GROUPS[gn], hp=C.BOARD[L[0]].house, base=0, best=0;
    L.forEach(function(i){ base+=PL[i]*C.BOARD[i].rent[0]; });
    var bestG=0;
    for(var lv=3;lv<=5;lv++){ var r=0; L.forEach(function(i){ r+=PL[i]*C.BOARD[i].rent[lv]; }); var v=P.H*r-lv*L.length*hp, vg=P.Hguard*r-lv*L.length*hp; if(v>best) best=v; if(vg>bestG) bestG=vg; }
    var pf=(P.pref&&P.pref[gn])||1;
    PREM[gn]=Math.max(60,best-P.H*base)*pf; PREMG[gn]=Math.max(60,bestG-P.Hguard*base)*pf; COST3[gn]=3*L.length*hp;
  }
}
var MUL=1, NLIVE=2;   // the set premium grows with the number of rivals (more rolls pay the rent); both set by brain() for each decision
function prem(G,gn){ if(PREM.H!==P.H) calcPrem(); return PREM[gn]*MUL; }

/* ---------- the board, read fresh each time (own = an owner array, so a trade can be judged before it happens) ---------- */
function cnt(own,id,L){ var n=0; for(var k=0;k<L.length;k++) if(own[L[k]]===id) n++; return n; }
function full(own,id,gn){ var L=C.GROUPS[gn]; for(var k=0;k<L.length;k++) if(own[L[k]]!==id) return false; return true; }
function bare(G,gn){ var L=C.GROUPS[gn]; for(var k=0;k<L.length;k++) if(G.houses[L[k]]>0) return false; return true; }
function rentAt(G,own,i,h,anyway){   // the rent deed i takes for its owner in own (h houses; anyway = as if not mortgaged)
  var s=C.BOARD[i], o=own[i]; if(o<0||(G.mort[i]&&!anyway)) return 0;
  if(h==null) h=G.houses[i];
  if(s.t==="prop") return h>0?s.rent[h]:(full(own,o,s.g)?2*s.rent[0]:s.rent[0]);
  if(s.t==="rr") return C.RR[cnt(own,o,C.RR_IDX)-1]||0;
  if(s.t==="util") return 7*(cnt(own,o,C.UTIL_IDX)===2?C.UT[1]:C.UT[0]);
  return 0;
}
function rateOf(G,own,id){ var r=0; for(var i=0;i<40;i++) if(own[i]===id) r+=PL[i]*rentAt(G,own,i); return r; }
function rivalRate(G,own,id){   // the rent it can expect to pay per roll of its own
  var r=0; for(var i=0;i<40;i++){ var o=own[i]; if(o>=0&&o!==id&&G.players[o]&&!G.players[o].bankrupt) r+=PL[i]*rentAt(G,own,i); } return r;
}
function nearRisk(G,own,id,pos){   // the rent expected (and the worst) on the next roll from pos
  var e=0, w=0; for(var d=2;d<=12;d++){ var i=(pos+d)%40, o=own[i]; if(o>=0&&o!==id){ var r=rentAt(G,own,i); e+=DP[d]*r; if(r>w) w=r; } } return {e:e,w:w};
}
function loneMort(G,own,id,skip){   // what its lone deeds (not in a whole set, no houses) would raise as mortgages
  var v=0; for(var i=0;i<40;i++) if(own[i]===id&&!G.mort[i]&&i!==skip){ var s=C.BOARD[i]; if(s.t==="prop"&&(full(own,id,s.g)||G.houses[i]>0)) continue; v+=s.mort; } return v;
}
function worth(G,q){ var w=q.cash; for(var i=0;i<40;i++) if(G.owner[i]===q.id){ var s=C.BOARD[i]; w+=G.mort[i]?Math.floor((s.price||0)/2):(s.price||0); if(s.t==="prop") w+=G.houses[i]*s.house; } return w; }
function freeDeeds(G){ var n=0; for(var i=0;i<40;i++) if(C.BOARD[i].price&&G.owner[i]<0) n++; return n; }

/* ---------- the per-device table (learning across games) ---------- */
var store=null, storeSet=false, TAB=null;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; TAB=null; }   // tests: a stand-in store, or null = no learning table at all
function freshTable(){ return {v:VER,games:0,w:{res:1,bid:1,trd:1,bld:1},t:{wins:[0,0,0],games:[0,0,0]}}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w||!d.t) return t;
    WK.forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    for(var i=0;i<3;i++){ var n=clamp(+d.t.games[i]||0,0,1e6); t.t.games[i]=n; t.t.wins[i]=clamp(+d.t.wins[i]||0,0,n); }
    t.games=clamp(+d.games||0,0,1e6);
  }catch(e){}
  return t;
}
function table(){ return TAB||(TAB=readTable()); }
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- the brain object (plain data), its memory and its mood ---------- */
function brain(G,p){
  var ai=G.ai; if(!ai||typeof ai!=="object"||ai.v!==VER||!ai.b||typeof ai.b!=="object") ai=G.ai={v:VER,b:{}};
  var b=ai.b[p.id];
  if(!b||typeof b.s!=="number"||!b.w||!b.m||typeof b.m!=="object"){
    var h=hash(p.name+"|"+G.players.length+"|"+p.id), t=table(), sk=skillOf(G,p);
    b=ai.b[p.id]={id:p.id,t:h%3,s:((h^Math.imul(p.id+1,2654435761))>>>0)||1,B:0,mood:"balanced",w:{},
      m:{rej:{},want:{},seen:"",last:-99,sig:"",tt:-1,deals:0}};
    WK.forEach(function(k){ var j=sk.learn?(rnd(b)-.5)*.1:0; b.w[k]=Math.round(clamp((sk.learn?t.w[k]:1)*(1+j),LO,HI)*1000)/1000; });
  }
  if(!b.m.rej||typeof b.m.rej!=="object") b.m.rej={}; if(!b.m.want||typeof b.m.want!=="object") b.m.want={};   // memory from an odd save: start it again
  var n=0; G.players.forEach(function(q){ if(!q.bankrupt) n++; }); MUL=1+.35*Math.max(0,n-2); NLIVE=n;
  observe(G,p,b); setMood(G,p,b);
  return b;
}
/* memory: who has been collecting which colour group (every deed a rival gained since its last look) */
function observe(G,p,b){
  var s=G.owner.join(","); if(s===b.m.seen) return;
  var old=b.m.seen?b.m.seen.split(","):null; b.m.seen=s; if(!old) return;
  for(var i=0;i<40;i++){
    var o=G.owner[i]; if(o<0||o===p.id||String(o)===old[i]||C.BOARD[i].t!=="prop") continue;
    var w=b.m.want[o]||(b.m.want[o]={}), gn=C.BOARD[i].g; w[gn]=Math.min(9,(w[gn]||0)+1);
  }
}
function wantOf(b,gn){ var m=0; for(var k in b.m.want){ var x=b.m.want[k]&&b.m.want[k][gn]||0; if(x>m) m=x; } return m; }
/* the race: ahead of the richest rival leans reserved (B > 0), behind leans bold (B < 0); the temperament nudges it */
function setMood(G,p,b){
  var me=worth(G,p), best=0; rivals(G,p.id).forEach(function(q){ var w=worth(G,q); if(w>best) best=w; });
  var sit=best>0?clamp((me-best)/Math.max(400,(me+best)/2)*1.5,-1,1):0, base=b.t===1?-.35:b.t===2?.35:0;
  var B=clamp(base+sit,-1,1); b.B=Math.round(B*100)/100; b.mood=B<=-.4?"bold":B>=.4?"reserved":"balanced";
}
function resMul(G,p,b){ return clamp(1+.4*b.B,.6,1.4)*skillOf(G,p).res*(b.w.res||1); }
function bidMul(G,p,b){ var sk=skillOf(G,p); return clamp(1-.12*b.B,.85,1.15)*(NLIVE<=2?sk.bid2:sk.bidN)*(b.w.bid||1); }
function margin(G,p,b){ var m=skillOf(G,p).margin; return m>0?m*clamp(1+.6*b.B,.4,1.6)*(b.w.trd||1):m; }

/* ---------- what things are worth ---------- */
function floorCash(G,p,b){   // the cash it keeps: the stage of the game is in the rivals' rents (none early, a lot once they build)
  var own=G.owner; return Math.round((P.base+P.kRate*rivalRate(G,own,p.id)+P.kNear*nearRisk(G,own,p.id,p.pos).e)*resMul(G,p,b));
}
function setGain(G,own,id,i){   // what deed i adds toward id's colour set: the set itself, or progress toward it
  var s=C.BOARD[i]; if(s.t!=="prop") return 0;
  var L=C.GROUPS[s.g], mine=0, riv=0, n=L.length, pm=prem(G,s.g);
  L.forEach(function(x){ if(x===i) return; var o=own[x]; if(o===id) mine++; else if(o>=0) riv++; });
  if(mine===n-1) return pm*P.setK;
  return pm*(riv?P.partOpp:P.partFree)*((mine+1)*(mine+1)-mine*mine)/(n*n);
}
function blockGain(G,own,id,i,b){   // what deed i is worth to id because a rival would complete (or near) a set with it
  var s=C.BOARD[i]; if(s.t!=="prop") return 0;
  var best=0; rivals(G,id).forEach(function(q){ var v=setGain(G,own,q.id,i); if(v>best) best=v; });
  return best*(b?1+.05*wantOf(b,s.g):1);
}
function incomeGain(G,own,id,i){ var o2=own.slice(); o2[i]=id; return P.Hnow*(rateOf(G,o2,id)-rateOf(G,own,id)); }
function completes(own,id,i){ var s=C.BOARD[i]; return s.t==="prop"&&cnt(own,id,C.GROUPS[s.g])===C.GROUPS[s.g].length-1&&own[i]!==id; }
/* a player's position (cash, deeds, the rent it earns, the sets it can build), to judge a trade before and after */
function feas(gn,cash,lone){ return clamp(.35+.65*(Math.max(0,cash)+lone)/COST3[gn],.35,1); }
function posVal(G,own,cash,id){
  var v=cash, r=0, i, s, gn;
  for(i=0;i<40;i++) if(own[i]===id){ s=C.BOARD[i]; if(!G.mort[i]) v+=s.mort*P.assetK; if(s.t==="prop") v+=G.houses[i]*s.house*.5; r+=PL[i]*rentAt(G,own,i); }
  v+=r*P.Hnow;
  var lone=-1;
  for(gn in C.GROUPS){
    var L=C.GROUPS[gn], k=cnt(own,id,L); if(!k) continue;
    if(k===L.length){ if(lone<0) lone=loneMort(G,own,id,-1); v+=prem(G,gn)*P.setK*feas(gn,cash,lone); }
    else { var free=0; L.forEach(function(x){ if(own[x]<0) free++; }); v+=prem(G,gn)*(free===L.length-k?P.partFree:P.partOpp)*k*k/(L.length*L.length); }
  }
  return v;
}
function fee(G,list){ var f=0; list.forEach(function(x){ if(G.mort[x]) f+=Math.ceil(C.BOARD[x].mort*.1); }); return f; }
function evalTrade(G,a,q,give,get,cg,cr,a0,q0){   // a gives deeds `give` and cash cg to q, and gets `get` and cash cr (a0, q0: their values now, if known)
  var own=G.owner, own2=own.slice(), hands=false, gets=false;
  give.forEach(function(x){ own2[x]=q.id; }); get.forEach(function(x){ own2[x]=a.id; });
  var ca=a.cash-cg+cr-fee(G,get), cq=q.cash+cg-cr-fee(G,give);
  give.forEach(function(x){ var s=C.BOARD[x]; if(s.t==="prop"&&full(own2,q.id,s.g)&&!full(own,q.id,s.g)) hands=true; });
  get.forEach(function(x){ var s=C.BOARD[x]; if(s.t==="prop"&&full(own2,a.id,s.g)&&!full(own,a.id,s.g)) gets=true; });
  if(a0==null) a0=posVal(G,own,a.cash,a.id); if(q0==null) q0=posVal(G,own,q.cash,q.id);
  return {me:posVal(G,own2,ca,a.id)-a0, them:posVal(G,own2,cq,q.id)-q0, hands:hands, gets:gets, ca:ca, cq:cq};
}
function wOf(G,a,q){   // how much the partner's gain counts against its own: all of it with two players, less at a bigger table
  var n=rivals(G,-1).length, w=n<=2?P.w2:n===3?P.w3:P.w4, top=true, wq=worth(G,q);
  rivals(G,q.id).forEach(function(x){ if(x.id!==a.id&&worth(G,x)>wq) top=false; });
  return n>2&&top?w*1.3:w;   // never help the leader cheaply
}

/* ---------- decisions ---------- */
/* buy the unowned deed it is standing on? */
function buy(G,p,i){
  var b=brain(G,p), sk=skillOf(G,p), s=C.BOARD[i], own=G.owner;
  if(!s||!s.price||own[i]!==-1||p.cash<s.price) return false;    // sanity: never buys what it cannot pay
  var after=p.cash-s.price, done=completes(own,p.id,i), sg=setGain(G,own,p.id,i), bl=blockGain(G,own,p.id,i,b);
  if(sk.noise&&!done&&rnd(b)<sk.noise) return false;             // easy: now and then passes on a fair buy
  if(sk.auc&&!done&&auctionCheap(G,p,i,b)) return false;         // hard: no rival can bid much, so it takes it at auction for less
  if(P.buyV>0&&NLIVE<=2&&!done&&bl<=s.price*.5&&sg<=s.price*.3&&lotValue(G,p,i,b)<s.price*P.buyV) return false;   // a duel: worth less than its price to it, so the auction decides (it still bids up to its worth)
  var need=floorCash(G,p,b);
  if(done) need=Math.min(need,P.base)*.5;                        // a whole set is worth the cash
  else if(bl>s.price*.5) need*=.6;                               // blocks a rival's set
  else if(sg>s.price*.3) need*=.8;                               // brings its own set closer
  else need*=s.t==="util"?P.utilK:P.buyK;                        // a plain deed: only with cash to spare
  return after+P.liq*(loneMort(G,own,p.id,-1)+(done?0:s.mort))>=need;
}
function auctionCheap(G,p,i,b){   // every rival's cash is far under the price and its own bid limit covers them all
  var s=C.BOARD[i], top=0; rivals(G,p.id).forEach(function(q){ if(q.cash>top) top=q.cash; });
  return top<s.price*.6&&bidMax(G,p,i,null)>=top+10;
}
function lotValue(G,p,i,b){   // what a deed is worth to it: a share of its price, the set it completes or brings closer (or blocks), its rent
  var own=G.owner, s=C.BOARD[i];
  return (s.price*P.bidBase+Math.max(setGain(G,own,p.id,i),blockGain(G,own,p.id,i,b)*P.deny)+P.bidInc*incomeGain(G,own,p.id,i))*bidMul(G,p,b);
}
/* the most it bids at an auction (the page adds the bid step and checks the cash) */
function bidMax(G,p,i,auc){
  var b=brain(G,p), sk=skillOf(G,p), s=C.BOARD[i], own=G.owner;
  if(!s||!s.price) return 0;
  var done=completes(own,p.id,i), bl=blockGain(G,own,p.id,i,b);
  var v=lotValue(G,p,i,b);
  var fl=floorCash(G,p,b)*(done?.3:bl>s.price*.5?.6:1);
  var m=Math.min(v,p.cash-fl+P.liq*.5*loneMort(G,own,p.id,-1),p.cash);
  if(sk.noise) m*=1-.2*rnd(b);
  return Math.max(0,Math.floor(m));
}
/* while it is broke: the cheapest way to raise cash (rent lost, plus the half a sold house loses or the 10 % to lift a mortgage).
   canSell(i) is the page's even-selling check. Returns {t:"sell"|"mort", i} or null (null on Easy: the page's old order). */
function nextRaise(G,p,canSell){
  var b=brain(G,p), sk=skillOf(G,p), own=G.owner, best=null, bs=1e18, i, s, sc;
  if(!sk.smartSell) return null;
  for(i=0;i<40;i++){
    if(own[i]!==p.id) continue; s=C.BOARD[i];
    if(!G.mort[i]&&(s.t!=="prop"||bare(G,s.g))){
      var inSet=s.t==="prop"&&full(own,p.id,s.g);
      sc=(PL[i]*rentAt(G,own,i)*P.Hraise+s.mort*.1+(inSet?prem(G,s.g)*.15/C.GROUPS[s.g].length:0))/s.mort;
      if(sc<bs){ bs=sc; best={t:"mort",i:i}; }
    }
    if(s.t==="prop"&&G.houses[i]>0&&(!canSell||canSell(i))){
      var h=G.houses[i], lower=h>1?s.rent[h-1]:2*s.rent[0];
      sc=(PL[i]*(s.rent[h]-lower)*P.Hraise+s.house/2)/(s.house/2);
      if(sc<bs){ bs=sc; best={t:"sell",i:i}; }
    }
  }
  return best;
}
/* its own turn, before the roll: one step at a time (the page applies it with its own rules and asks again):
   lift a mortgage on a whole set, build toward the best rent per dollar (three houses first), mortgage a lone deed to fund that,
   or lift a lone deed's mortgage with spare cash. api.canBuild(i) is the page's check. Returns {t:"build"|"unmort"|"mort", i} or null. */
function nextManage(G,p,api){
  var b=brain(G,p), sk=skillOf(G,p), own=G.owner, i, k, x;
  var avail=p.cash-Math.round(floorCash(G,p,b)*P.bfloor*(b.w.bld||1));
  var gs=[], hold=sk.short&&holdAt4(G,p);
  for(var gn in C.GROUPS){
    if(!full(own,p.id,gn)) continue;
    var L=C.GROUPS[gn], hp=C.BOARD[L[0]].house, lv=9, mort=[];
    L.forEach(function(y){ if(G.houses[y]<lv) lv=G.houses[y]; if(G.mort[y]) mort.push(y); });
    var cap=hold?Math.min(sk.cap,4):sk.cap, tgt=lv<3?Math.min(3,cap):Math.min(lv+1,cap);
    if(tgt<=lv) continue;
    var cost=0, gain=0, lift=0;
    L.forEach(function(y){ var s=C.BOARD[y], h=G.houses[y]; cost+=Math.max(0,tgt-h)*hp; gain+=PL[y]*(s.rent[tgt]-(h>0?s.rent[h]:2*s.rent[0])); if(G.mort[y]) lift+=Math.ceil(s.mort*1.1); });
    gs.push({L:L,hp:hp,lv:lv,mort:mort,r:gain/(cost+lift)});
  }
  gs.sort(function(a,c){ return c.r-a.r; });
  for(k=0;k<gs.length;k++){
    x=gs[k];
    if(x.mort.length){ var m=x.mort[0], c=Math.ceil(C.BOARD[m].mort*1.1); if(c<=avail) return {t:"unmort",i:m}; continue; }
    var lot=-1; x.L.forEach(function(y){ if(lot<0&&G.houses[y]===x.lv&&api.canBuild(y)) lot=y; });
    if(lot<0) continue;
    if(x.hp<=avail) return {t:"build",i:lot};
    if(sk.mortBuild&&x.r>=P.mbRatio&&p.cash>=0){
      var lm=loneToMortgage(G,own,p.id); if(lm>=0&&avail+C.BOARD[lm].mort>=x.hp) return {t:"mort",i:lm};
    }
  }
  var best=-1, br=0;
  for(i=0;i<40;i++) if(own[i]===p.id&&G.mort[i]){
    var cost2=Math.ceil(C.BOARD[i].mort*1.1); if(cost2>avail-P.uCush) continue;
    var r2=PL[i]*rentAt(G,own,i,null,true)/cost2; if(r2>br){ br=r2; best=i; }
  }
  return best>=0?{t:"unmort",i:best}:null;
}
function loneToMortgage(G,own,id){   // the lone deed that earns least per dollar it raises
  var best=-1, bs=1e18;
  for(var i=0;i<40;i++){ if(own[i]!==id||G.mort[i]) continue; var s=C.BOARD[i];
    if(s.t==="prop"&&(full(own,id,s.g)||!bare(G,s.g))) continue;
    var sc=PL[i]*rentAt(G,own,i)/s.mort+(s.t==="prop"?setGain(G,own,id,i)/s.mort*.002:0); if(sc<bs){ bs=sc; best=i; } }
  return best;
}
function holdAt4(G,p){   // the housing shortage: few houses left in the bank and a rival with a whole set still to build
  if(G.housesLeft>P.shortLeft) return false;
  return rivals(G,p.id).some(function(q){ for(var gn in C.GROUPS) if(full(G.owner,q.id,gn)&&C.GROUPS[gn].some(function(y){ return G.houses[y]<3; })) return true; return false; });
}
/* in Jail at the start of its turn: "card" (use a Get Out of Jail Free), "pay" ($50 now) or "roll" (try for doubles; the third miss
   pays by the rule). Early, while deeds are for sale, it gets out; late, when the rivals' rents are high, it stays in and collects. */
function jail(G,p){
  var b=brain(G,p), sk=skillOf(G,p), own=G.owner;
  if(!sk.jail) return p.jokers>0?"card":(p.jailTurns<2&&p.cash<300)?"roll":p.cash>=C.JAIL?"pay":"roll";   // easy: the old way
  var rr=rivalRate(G,own,p.id), free=freeDeeds(G);
  var stay=rr*(1+.5*Math.max(0,b.B))>P.jailRate||(free===0&&rr>P.jailRate*.4);
  if(stay) return "roll";
  if(p.jokers>0) return "card";
  return p.cash-C.JAIL>=Math.max(P.jailPay*resMul(G,p,b),floorCash(G,p,b))&&p.jailTurns<2?"pay":"roll";   // on its last try a roll is never worse: a miss pays the same $50
}
/* the value of a trade to pl (partner = the other side's player id). The page accepts at >= -10, so this is the gain less its margin,
   minus 10; -1e9 = never (it would be left owing, or hand over a set for too little). */
function tradeValue(G,pl,partner,inIdx,inCash,inJk,outIdx,outCash,outJk){
  var b=brain(G,pl), q=G.players[partner];
  inIdx=arr(inIdx); outIdx=arr(outIdx); inCash=Math.max(0,+inCash||0); outCash=Math.max(0,+outCash||0); inJk=+inJk||0; outJk=+outJk||0;
  if(!q||q.id===pl.id){   // no known partner: the plain sum of what changes hands
    var v=inCash-outCash+(inJk-outJk)*50; inIdx.forEach(function(x){ v+=C.BOARD[x].price; }); outIdx.forEach(function(x){ v-=C.BOARD[x].price; });
    return Math.round(v-Math.max(0,margin(G,pl,b)))-10;
  }
  var e=evalTrade(G,pl,q,outIdx,inIdx,outCash,inCash), jk=(inJk-outJk)*50;
  if(e.ca<0) return -1e9;
  if(q.human) outIdx.forEach(function(x){ var s=C.BOARD[x]; if(s.t!=="prop") return; var w=b.m.want[q.id]||(b.m.want[q.id]={}); w[s.g]=Math.min(9,(w[s.g]||0)+1); });   // memory: what this player asks for
  var val=e.me+jk-wOf(G,pl,q)*(e.them-jk)-margin(G,pl,b);
  if(e.hands&&!e.gets) val-=handPen(G,outIdx);
  return Math.round(val)-10;
}
function handPen(G,give){   // handing a rival a set for cash: valued over a long game (P.Hguard), and with two players that set is often the game
  if(PREM.H!==P.H) calcPrem();
  var m=0, k=NLIVE<=2?P.hand2:P.handN; give.forEach(function(x){ var s=C.BOARD[x]; if(s.t==="prop") m=Math.max(m,PREMG[s.g]*MUL*k); }); return m;
}
/* offers it makes on its own turn, best first (the page asks the partner about each in turn and stops at the first yes): deeds that
   complete one of its sets, for cash (from the printed price up a few steps), for a deed that completes the partner's set, or for a lone
   deed and cash. Only to computers (a human partner has no offer dialog). null = nothing this turn. */
function propose(G,p){
  var b=brain(G,p), sk=skillOf(G,p), t=turnsOf(G);
  if(!sk.trade||!sk.tries||b.m.tt===t) return null;
  b.m.tt=t;
  var own=G.owner, sig=own.join(",")+"|"+G.houses.join("")+"|"+G.mort.map(Number).join("");
  if(b.m.sig===sig&&p.cash<(b.m.cash||0)+200&&t-b.m.last<15) return null;   // nothing has changed since its last offers were refused
  var out=[], mar=margin(G,p,b), a0=posVal(G,own,p.cash,p.id), work=0, WORK=360;
  rivals(G,p.id).forEach(function(q){
    if(q.human) return;
    var w=wOf(G,p,q), q0=posVal(G,own,q.cash,q.id);
    for(var gn in C.GROUPS){
      var L=C.GROUPS[gn], need=[], mine=0, ok=true;
      L.forEach(function(x){ var o=own[x]; if(o===p.id) mine++; else if(o===q.id) need.push(x); else ok=false; });
      if(!ok||!mine||!need.length||!bare(G,gn)) continue;
      var face=0; need.forEach(function(x){ face+=G.mort[x]?C.BOARD[x].price/2:C.BOARD[x].price; });
      var gives=[[]];
      for(var hn in C.GROUPS){   // a swap: its deeds that complete one of the partner's sets
        if(hn===gn||!bare(G,hn)) continue;
        var H=C.GROUPS[hn], mineH=[], ok2=true, theirs=0;
        H.forEach(function(x){ var o=own[x]; if(o===p.id) mineH.push(x); else if(o===q.id) theirs++; else ok2=false; });
        if(ok2&&mineH.length&&theirs) gives.push(mineH);
      }
      var lone=loneDeed(G,own,p.id,q.id,gn); if(lone>=0) gives.push([lone]);
      gives.forEach(function(give){
        var gface=0; give.forEach(function(x){ gface+=G.mort[x]?C.BOARD[x].price/2:C.BOARD[x].price; });
        [0,.25,.6,1.2,2,3].forEach(function(up){
          if(++work>WORK) return;
          var cash=Math.max(0,Math.round((face*(1+up)-gface)/10)*10);
          if(cash>p.cash) return;
          if(up>0&&cash===0) return;
          var e=evalTrade(G,p,q,give,need,cash,0,a0,q0);
          if(e.ca<fee(G,need)||e.ca<0) return;
          var val=e.me-w*e.them-mar; if(e.hands&&!e.gets) return;
          if(val<=0) return;
          var key=q.id+":"+need.join(".")+":"+give.join("."), r=b.m.rej[key];
          if(r&&t-r.t<12&&cash<=r.c) return;                   // refused at this price lately: only a better offer
          out.push({to:q.id,give:give.slice(),get:need.slice(),cashGive:cash,cashGet:0,v:Math.round(val),key:key});
        });
      });
    }
  });
  b.m.last=t;
  if(out.length<=sk.tries){ b.m.sig=sig; b.m.cash=p.cash; }
  if(!out.length) return null;
  out.sort(function(a,c){ return c.v-a.v; });
  return out.slice(0,sk.tries);
}
function loneDeed(G,own,id,qid,skipG){   // a deed it can spare as a sweetener: no set of its own near, no set for the partner
  var best=-1, bs=1e18;
  for(var i=0;i<40;i++){ if(own[i]!==id) continue; var s=C.BOARD[i]; if(s.t==="prop"&&(s.g===skipG||!bare(G,s.g)||full(own,id,s.g))) continue;
    if(s.t==="prop"&&(cnt(own,id,C.GROUPS[s.g])>1||completes(own,qid,i))) continue;
    if(s.t==="rr"&&cnt(own,id,C.RR_IDX)>1) continue;
    var sc=s.price; if(sc<bs){ bs=sc; best=i; } }
  return best;
}
/* the page tells it how an offer went: a refusal is remembered (the same offer at the same price is not made again for a while) */
function heard(G,p,offer,yes){
  if(!offer||!G||!G.ai||!G.ai.b||!G.ai.b[p.id]) return;
  var b=G.ai.b[p.id], key=offer.key||(offer.to+":"+arr(offer.get).join(".")+":"+arr(offer.give).join("."));
  if(yes){ b.m.deals++; delete b.m.rej[key]; b.m.sig=""; return; }
  b.m.rej[key]={t:turnsOf(G),c:+offer.cashGive||0};
  var ks=Object.keys(b.m.rej); if(ks.length>24){ ks.sort(function(a,c){ return b.m.rej[a].t-b.m.rej[c].t; }); delete b.m.rej[ks[0]]; }
}
/* after a game: the table leans toward the tactic weights of a computer that won (only where the store exists; Normal and Hard) */
function gameOver(G){
  if(!G||!G.players||!G.ai||!G.ai.b||!getStore()) return;
  var w=null, t=readTable(), any=false;
  G.players.forEach(function(q){ if(!q.bankrupt&&!w) w=q; });
  G.players.forEach(function(q){
    var b=G.ai.b[q.id]; if(!b||!b.w||q.human||q.skill==="legacy"||!skillOf(G,q).learn) return;
    any=true; var k=clamp(b.t|0,0,2); t.t.games[k]++;
    if(w&&w.id===q.id){ t.t.wins[k]++; WK.forEach(function(x){ var v=+b.w[x]; if(isFinite(v)) t.w[x]=Math.round(clamp(t.w[x]+.2*(v-t.w[x]),LO,HI)*1000)/1000; }); }
  });
  if(any){ t.games++; writeTable(t); TAB=t; }
}

/* editions: "Pay a $10 fine or take a Chance" (1935 US, UK 1936-2007). deck = the Chance cards ({fx, a}). Easy: a coin flip. Normal: pays
   when the cash stays above half its floor. Hard: also weighs the deck's money (the mean of its gain / pay / pay-each / repairs cards for
   its own buildings, and a trip to Jail): it draws only when the deck is worth more than the fine. Well under a millisecond. */
function fineOrChance(G,p,amt,deck){
  var b=brain(G,p), sk=skillOf(G,p);
  if(sk===SKILL.easy) return rnd(b)<.5?"pay":"chance";
  if(p.cash-amt<floorCash(G,p,b)*.5) return "chance";
  if(sk!==SKILL.hard||!deck||!deck.length) return "pay";
  var h=0,ht=0,n=rivals(G,p.id).length,ev=0; for(var i=0;i<40;i++) if(G.owner[i]===p.id&&C.BOARD[i].t==="prop"){ if(G.houses[i]===5) ht++; else h+=G.houses[i]; }
  deck.forEach(function(c){ var a=c.a;
    if(c.fx==="gain") ev+=a; else if(c.fx==="pay") ev-=a; else if(c.fx==="payeach") ev-=a*n; else if(c.fx==="collecteach") ev+=a*n;
    else if(c.fx==="repairs"&&a) ev-=h*a[0]+ht*a[1]; else if(c.fx==="jail") ev-=C.JAIL; else if(c.fx==="joker") ev+=C.JAIL*.5; });
  return ev/deck.length>-amt?"chance":"pay";
}
g.MonoBrain={ init:init, fineOrChance:fineOrChance, on:on, buy:buy, bidMax:bidMax, nextManage:nextManage, nextRaise:nextRaise, jail:jail, tradeValue:tradeValue,
  propose:propose, heard:heard, gameOver:gameOver, setStore:setStore, table:table, tune:tune, SKILL:SKILL, P:P, KEY:KEY, VER:VER,
  mood:function(G,p){ return brain(G,p).mood; }, get ready(){ return !!C; },
  _floor:function(G,p){ return floorCash(G,p,brain(G,p)); }, _posVal:posVal, _prem:function(G,gn){ return prem(G,gn); } };
})(typeof window!=="undefined"?window:globalThis);
