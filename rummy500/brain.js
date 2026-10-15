/* 500 Rummy — the computer players' brain (step 10). Loaded by game.js (browser) or require()d (tests); needs engine.js + game.js.
   Called from Rummy.Game.aiAction(G) at the same call points as the old code, so Party Rummy gets it through the shared code.

   One brain per computer player: a small plain-data object kept in G.ai.b[playerId] (so a saved game keeps it, old saves have none and get
   fresh ones). Each has its own base temperament (balanced / bold / reserved), its own tactic weights and its own memory of the opponents,
   read from G.log (public events only: it never looks at another hand, only at how many cards it holds).
   Every turn it reads the situation (score race, cards left, round stage) and moves between balanced, bold and reserved; the mood only
   nudges thresholds. Every candidate is scored; a sanity filter then rejects senseless moves and the old code is the fallback.
   Learning across games: a small weight table in localStorage 'bg_ai_rummy500' (versioned, bounded, safe to delete).
   Skill: G.skill = "easy" | "normal" | "hard" (missing = normal). */
(function(g){
"use strict";
var R=g.Rummy, KEY="bg_ai_rummy500", VER=1;
if(!R||R.Brain) return;

var SKILL={
  easy:  {mem:0,    noise:.30, depth:3, thr:4,  jit:.25, skipLay:.15, H:2, deny:0,   learn:false},
  normal:{mem:1,    noise:0,   depth:12, thr:0,  jit:.10, skipLay:0,   H:3, deny:.30, learn:true},
  hard:  {mem:1.25, noise:0,   depth:20, thr:-.5, jit:.04, skipLay:0,  H:4, deny:.45, learn:true}
};
var P={gain:4.5,thr:1,dw0:.30,dw1:.55,late:.2,joker:18,passCut:.5,heldSet:.4,heldRun:.28,tbl:1.2,lay:4,out:10,pair:1,exp:.8,tieOut:3,potMul:1,H:0,deny:0,depth:0,budget:25};   // tuning constants (the tournament sweeps them)
var KEYS=["dng","take","dw","pot"], LO=.7, HI=1.4;
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: pass a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }

/* ---------- the per-device weight table ---------- */
function freshTable(){ return {v:VER,games:0,w:{dng:1,take:1,dw:1,pot:1},t:{wins:[0,0,0],games:[0,0,0]}}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w) return t;
    KEYS.forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    t.games=Math.max(0,Math.min(1e6,+d.games||0));
    if(d.t&&d.t.wins&&d.t.games) for(var i=0;i<3;i++){ t.t.wins[i]=Math.max(0,+d.t.wins[i]||0); t.t.games[i]=Math.max(0,+d.t.games[i]||0); }
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- small helpers ---------- */
function GMm(){ return R.Game; }
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.s=(Math.imul(b.s,1664525)+1013904223)>>>0; return b.s/4294967296; }
var deckCache={key:"",map:null};
function cardMap(o){
  var key=o.decks+"/"+o.jokers; if(deckCache.key===key) return deckCache.map;
  var m={}; R.makeDeck(o).forEach(function(c){ m[c.id]=c; }); deckCache={key:key,map:m}; return m;
}
function skillOf(G,p){ return SKILL[p&&p.skill]||SKILL[G.skill]||SKILL.normal; }   // p.skill: tests seat different skills at one table
function unitOf(G,i){ return GMm().unitOf(G,i); }
function val(o,c){ return R.handCardValue(o,c); }
function key(c){ return c.r+c.s; }

/* ---------- the brain object (plain data) ---------- */
function brainOf(G,p){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b) ai=G.ai={v:1,b:{}};
  var b=ai.b[p.id];
  if(b&&b.k&&b.mem) return b;
  var h=hash(G.players[0].name+"|"+G.players.length), skill=skillOf(G,p), tab=skill.learn?readTable():freshTable();
  b=ai.b[p.id]={ id:p.id, t:(h+p.id)%3, s:(hash(p.name)^(p.id*2654435761))>>>0, k:{}, pos:0, mem:{}, top:-1, rd:-1, mood:"balanced", B:0 };
  KEYS.forEach(function(k){ b.k[k]=clamp(tab.w[k]*(1+(rnd(b)*2-1)*skill.jit),LO,HI); });
  return b;
}
/* ---------- memory: read the public events since the last look ---------- */
function oppMem(b,q){ var m=b.mem[q]; if(!m) m=b.mem[q]={held:[],pass:[]}; return m; }
function drop(arr,id){ var i=arr.indexOf(id); if(i>=0) arr.splice(i,1); }
function observe(G,b){
  var log=G.log||[]; if(b.pos>log.length) b.pos=0;
  for(var i=b.pos;i<log.length;i++){
    var e=log[i], q=e.p, m, mine=(q===b.id);
    if(e.type==="deal"){ b.mem={}; b.top=-1; b.rd=G.round; b.run=0; }
    else if(e.type==="discard"){ b.top=e.card; if(!mine){ m=oppMem(b,q); drop(m.held,e.card); m.pass.push(e.card); if(m.pass.length>12) m.pass.shift(); } }
    else if(e.type==="drawStock"){ b.run=0; if(!mine&&b.top>=0){ m=oppMem(b,q); m.pass.push(b.top); if(m.pass.length>12) m.pass.shift(); } }
    else if(e.type==="takeDiscard"){ b.top=-1; b.run=(b.run||0)+1; if(!mine){ m=oppMem(b,q); e.cards.forEach(function(id){ if(m.held.indexOf(id)<0) m.held.push(id); }); } }
    else if(e.type==="meld"){ if(!mine){ m=oppMem(b,q); e.cards.forEach(function(id){ drop(m.held,id); }); } }
    else if(e.type==="layOff"){ if(!mine) drop(oppMem(b,q).held,e.card); }
  }
  b.pos=log.length;
}

/* ---------- the situation: balanced / bold / reserved ---------- */
function readMood(G,p,b){
  var o=G.o, T=o.deals>0?o.target||500:o.target, u=unitOf(G,p.id), my=G.scores[u], best=-1e9, i;
  for(i=0;i<G.scores.length;i++) if(i!==u&&G.scores[i]>best) best=G.scores[i];
  var lead=my-best, sit=0;                       // sit +1 = ahead (protect), -1 = behind (little to lose)
  if(lead>=.12*T) sit=1; else if(lead<=-.12*T) sit=-1;
  if(best>=.7*T&&lead<0) sit=-1.4;               // they are about to win: nothing to protect
  else if(my>=.7*T&&lead>0) sit=1.3;
  var oppMin=99; G.players.forEach(function(q){ if(unitOf(G,q.id)!==u&&q.hand.length<oppMin) oppMin=q.hand.length; });
  var base=b.t===1?.6:b.t===2?-.6:0;
  var B=base-sit;                                // boldness, about -2 .. 2
  b.B=B; b.mood=B>=.8?"bold":B<=-.8?"reserved":"balanced";
  return {B:B,oppMin:oppMin};
}

/* ---------- the context of one decision ---------- */
function mkCtx(G,p,b){
  var o=G.o, sk=skillOf(G,p), mo=readMood(G,p,b), u=unitOf(G,p.id), me=p.id, n=G.n;
  var ctx={G:G,p:p,b:b,o:o,sk:sk,B:mo.B,me:me,u:u,opps:[],seen:{},nUnknown:0,table:[],H:P.H||sk.H};
  G.players.forEach(function(q){ if(unitOf(G,q.id)!==u) ctx.opps.push(q.id); });
  var cm=cardMap(o), i;
  G.melds.forEach(function(m){ m.cards.forEach(function(e){ var k=key(e.c); ctx.seen[k]=(ctx.seen[k]||0)+1; }); if(GMm().mayLayOn(G,m,me)) ctx.table.push(m); });
  G.discard.forEach(function(c){ var k=key(c); ctx.seen[k]=(ctx.seen[k]||0)+.7; });
  var known=0;
  ctx.opps.forEach(function(q){ var m=b.mem[q]; if(!m) return; m.held.forEach(function(id){ var c=cm[id]; if(c){ var k=key(c); ctx.seen[k]=(ctx.seen[k]||0)+1; known++; } }); });
  var unk=G.stock.length; ctx.opps.forEach(function(q){ unk+=G.players[q].hand.length; });
  ctx.N=Math.max(8,unk-known);
  var minOpp=mo.oppMin;
  var hz=1-Math.min(minOpp,8)/8;
  var dwF=P.dw0+P.dw1*hz; if(G.stock.length<=n*2) dwF+=P.late;
  if(!o.handPenalty) dwF=0;
  ctx.dwF=dwF*b.k.dw*(1-.15*mo.B);
  ctx.potW=b.k.pot*P.potMul*(1+.15*mo.B);
  ctx.dngW=b.k.dng*(1-.2*mo.B)*(sk.mem||0);
  ctx.takeThr=(P.thr+sk.thr-1.5*mo.B)/b.k.take;
  ctx.drawGain=P.gain;
  ctx.depth=P.depth||sk.depth;
  var oh=0; ctx.opps.forEach(function(q){ oh+=G.players[q].hand.length; });
  ctx.outBonus=o.goOutBonus+P.out+(o.handPenalty?2*oh:0);
  void i;
  return ctx;
}

/* ---------- value of a hand ---------- */
function avail(ctx,hs,r,s){ var k=r+s; return Math.max(0,ctx.o.decks-(ctx.seen[k]||0)-(hs[k]||0)); }
function pOut(ctx,u){ return u<=0?0:1-Math.pow(1-Math.min(u,ctx.N)/ctx.N,ctx.H); }
function rv(o,r,low){ return low&&r===1?o.aceLowValue:R.pipValue(o,r); }
/* chance and size of the meld two cards could become, with the cards that complete it */
function pairPot(ctx,hs,a,b){
  var o=ctx.o, u=0, gain=0, S=R.SUITS, i;
  if(a.r===b.r){
    if(a.s===b.s) return null;
    for(i=0;i<S.length;i++) if(S[i]!==a.s&&S[i]!==b.s) u+=avail(ctx,hs,a.r,S[i]);
    gain=3*R.pipValue(o,a.r);
  } else if(a.s===b.s){
    var best=null;
    [0,1].forEach(function(hi){
      var ra=a.r===1?(hi?14:1):a.r, rb=b.r===1?(hi?14:1):b.r;
      if((a.r===1||b.r===1)&&((hi&&!o.aceHigh)||(!hi&&!o.aceLow))) return;
      var lo=Math.min(ra,rb), up=Math.max(ra,rb), d=up-lo, uu=0, minR=o.aceLow?1:2, maxR=o.aceHigh?14:13;
      var outs=[]; if(d===1){ if(lo-1>=minR) outs.push(lo-1); if(up+1<=maxR) outs.push(up+1); } else if(d===2) outs.push(lo+1);
      if(!outs.length) return;
      outs.forEach(function(rr){ uu+=avail(ctx,hs,rr===14?1:rr,a.s); });
      var gg=rv(o,ra,!hi)+rv(o,rb,!hi)+rv(o,outs[0],!hi&&outs[0]===1);
      var pp=pOut(ctx,uu);
      if(!best||pp*gg>best.p*best.g) best={p:pp,g:gg};
    });
    if(!best) return null;
    return best;
  } else return null;
  return {p:pOut(ctx,u),g:gain};
}
/* what the leftover cards are worth: the chance they become melds, less the points they cost if they stay */
function keep(ctx,hand,rest){
  var o=ctx.o, hs={}, i, j, c;
  for(i=0;i<hand.length;i++){ c=hand[i]; if(!c.joker){ var k=key(c); hs[k]=(hs[k]||0)+1; } }
  var pairs=[], pc=[], uses=[];
  for(i=0;i<rest.length;i++){ pc[i]=0; uses[i]=0; }
  for(i=0;i<rest.length;i++){ if(rest[i].joker) continue;
    for(j=i+1;j<rest.length;j++){ if(rest[j].joker) continue;
      var pp=pairPot(ctx,hs,rest[i],rest[j]); if(pp&&pp.p>0) pairs.push({i:i,j:j,p:pp.p,v:pp.p*pp.g}); } }
  pairs.sort(function(x,y){ return y.v-x.v; });
  var kv=0;
  for(i=0;i<pairs.length;i++){ var q=pairs[i];
    if(uses[q.i]>=2||uses[q.j]>=2) continue;
    kv+=q.v*ctx.potW*((uses[q.i]||uses[q.j])?.5:1); uses[q.i]++; uses[q.j]++;
    if(q.p>pc[q.i]) pc[q.i]=q.p; if(q.p>pc[q.j]) pc[q.j]=q.p; }
  var dead=0;
  for(i=0;i<rest.length;i++){ c=rest[i];
    if(c.joker){ kv+=P.joker*ctx.potW; continue; }
    dead+=val(o,c)*ctx.dwF*(1-P.exp*pc[i]); }
  return kv-dead;
}
/* the whole hand: meld what can be melded, lay off what can be laid off, then value the leftovers */
function V(ctx,hand){
  var o=ctx.o, plan=R.bestMelds(hand,o), used={}, pts=plan.pts, rest;
  plan.list.forEach(function(m){ m.ids.forEach(function(id){ used[id]=1; }); });
  rest=hand.filter(function(c){ return !used[c.id]; });
  var tm=ctx.table.slice(), again=true;
  while(again&&rest.length){
    again=false;
    rest.sort(function(a,b){ return val(o,b)-val(o,a); });
    for(var i=0;i<rest.length&&!again;i++) for(var j=0;j<tm.length;j++){
      var nm=R.layOff(tm[j],rest[i],o);
      if(nm){ tm[j]=nm; pts+=val(o,rest[i]); rest.splice(i,1); again=true; break; } }
  }
  if(!rest.length) return pts+ctx.outBonus;
  return pts+keep(ctx,hand,rest)+(rest.length===1?P.tieOut:0);
}

/* ---------- danger: what an opponent could do with a card I let go ---------- */
function danger(ctx,c){
  var G=ctx.G, o=ctx.o, b=ctx.b, cm=cardMap(o), total=0, base=3*R.pipValue(o,c.joker?10:c.r);
  if(c.joker) return 40;
  var n=G.n;
  ctx.opps.forEach(function(q){
    var qp=G.players[q], d=0, m=b.mem[q]||{held:[],pass:[]}, near=qp.hand.length;
    for(var i=0;i<G.melds.length;i++){
      var mm=G.melds[i]; if(!(o.layOffOpp||unitOf(G,mm.owner)===unitOf(G,q))) continue;
      if(o.layOffNeedsOwnMeld&&!GMm().mayLayOn(G,mm,q)) continue;
      if(R.layOff(mm,c,o)){ d+=R.pipValue(o,c.r)*P.tbl+P.lay; if(near<=2) d+=30; else if(near<=4) d+=8; break; }
    }
    var held=[]; m.held.forEach(function(id){ if(cm[id]) held.push(cm[id]); });
    var done=false, passedRank=0, passedSuit=0;
    m.pass.forEach(function(id){ var pc=cm[id]; if(!pc||pc.joker) return; if(pc.r===c.r) passedRank++; if(pc.s===c.s&&Math.abs(pc.r-c.r)<=2) passedSuit++; });
    for(var a=0;a<held.length&&!done;a++){
      for(var bb=a+1;bb<held.length;bb++){ if(R.buildMeld([held[a],held[bb],c],o)){ d+=base*1.1; done=true; break; } }
    }
    if(!done) held.forEach(function(h){
      if(h.joker) return;
      if(h.r===c.r&&h.s!==c.s) d+=base*P.heldSet*(passedRank?P.passCut:1);
      else if(h.s===c.s&&Math.abs(h.r-c.r)<=2&&h.r!==c.r) d+=base*P.heldRun*(passedSuit?P.passCut:1);
    });
    if(near<=3) d*=1.25;
    var dist=(q-ctx.me+n)%n;    // 1 = plays next
    total+=d*(dist===1?1:.6);
  });
  return total;
}

/* ---------- the draw ---------- */
function planTake(ctx,idx,taken,pool){
  var G=ctx.G, o=ctx.o, GM=GMm();
  if(!GM.mustUseRule(G,idx)) return V(ctx,pool);
  var d=taken[0], best=null, i;
  if(!o.deepestNewMeld&&GM.layTarget(G,d,G.turn)){
    best=val(o,d)+V(ctx,pool.filter(function(c){ return c.id!==d.id; })); }
  var cands=R.candidateMelds(pool,o).filter(function(m){ return m.ids.indexOf(d.id)>=0&&!(o.goOutNeedsDiscard&&m.ids.length>=pool.length); });
  cands.sort(function(a,b){ return R.meldPoints(b,o)-R.meldPoints(a,o); });
  for(i=0;i<cands.length&&i<5;i++){
    var m=cands[i], v=R.meldPoints(m,o)+V(ctx,pool.filter(function(c){ return m.ids.indexOf(c.id)<0; }));
    if(best==null||v>best) best=v; }
  return best;
}
function pickDraw(ctx){
  var G=ctx.G, p=ctx.p, GM=GMm(), hand=p.hand, base=null, best=-1e9, bi=-1, idx, t0=Date.now();
  for(idx=G.discard.length-1;idx>=0&&G.discard.length-idx<=ctx.depth;idx--){
    if(Date.now()-t0>P.budget) break;   // a slow phone: use what has been weighed so far (shallow takes first)
    if(!GM.takeFeasible(G,idx)) continue;
    if(base==null) base=V(ctx,hand)+ctx.drawGain;
    var taken=G.discard.slice(idx), pool=hand.concat(taken), v=planTake(ctx,idx,taken,pool);
    if(v==null) continue;
    var deny=0; if(ctx.sk.deny&&ctx.sk.mem) taken.forEach(function(c){ deny+=danger(ctx,c); });
    var net=v+(P.deny||ctx.sk.deny)*deny-base;
    if(net>best){ best=net; bi=idx; }
  }
  var empty=G.stock.length===0;
  if((ctx.b.run||0)>=6&&!empty) return {t:"stock"};   // sanity: six pile-takes in a row at the table and nobody draws: break the swapping, draw from the stock
  if(bi>=0&&(best>=ctx.takeThr||(empty&&best>0))) return {t:"take",idx:bi};
  return {t:"stock"};
}

/* ---------- the turn: use the pile card, meld, lay off, discard ---------- */
function pickPlay(ctx){
  var G=ctx.G, p=ctx.p, o=ctx.o, GM=GMm(), hand=p.hand, i;
  if(G.mustUse!=null){
    var d=null; hand.forEach(function(c){ if(c.id===G.mustUse) d=c; });
    if(d){
      var bestA=null, bv=-1e9;
      if(!G.mustNew){ var t=GM.layTarget(G,d,G.turn); if(t){ bestA={t:"layoff",meld:t.id,card:d.id}; bv=val(o,d)+V(ctx,hand.filter(function(c){ return c.id!==d.id; })); } }
      var cs=R.candidateMelds(hand,o).filter(function(m){ return m.ids.indexOf(d.id)>=0&&!(o.goOutNeedsDiscard&&m.ids.length>=hand.length); });
      cs.sort(function(a,b){ return R.meldPoints(b,o)-R.meldPoints(a,o); });
      for(i=0;i<cs.length&&i<5;i++){ var m=cs[i], v=R.meldPoints(m,o)+V(ctx,hand.filter(function(c){ return m.ids.indexOf(c.id)<0; })); if(v>bv){ bv=v; bestA={t:"meld",ids:m.ids}; } }
      if(bestA) return bestA;
    }
  }
  var plan=R.bestMelds(hand,o).list;
  for(i=0;i<plan.length;i++){ if(!(o.goOutNeedsDiscard&&plan[i].ids.length>=hand.length)) return {t:"meld",ids:plan[i].ids}; }
  var order=hand.slice().sort(function(a,b){ return val(o,b)-val(o,a); });
  for(i=0;i<order.length;i++){
    if(o.goOutNeedsDiscard&&hand.length<=1) break;
    if(G.mustNew&&G.mustUse===order[i].id) continue;
    var tm=GM.layTarget(G,order[i],G.turn);
    if(tm){ if(ctx.sk.skipLay&&rnd(ctx.b)<ctx.sk.skipLay&&hand.length>2) continue; return {t:"layoff",meld:tm.id,card:order[i].id}; }
  }
  return pickDiscard(ctx);
}
function pickDiscard(ctx){
  var G=ctx.G, p=ctx.p, o=ctx.o, hand=p.hand, cands=[], i;
  hand.forEach(function(c){ if(G.noDiscard===c.id&&hand.length>1) return; cands.push(c); });
  if(!cands.length) cands=hand.slice();
  var nonJ=cands.filter(function(c){ return !c.joker; }); if(nonJ.length) cands=nonJ;     // sanity: a joker is never thrown away while something else can go
  var scored=cands.map(function(c){
    var rest=hand.filter(function(x){ return x.id!==c.id; });
    var kv=o.goOutNeedsDiscard?V(ctx,rest):keep(ctx,hand,rest);
    return {c:c,s:kv-ctx.dngW*danger(ctx,c)*(c.joker?0:1)};
  });
  scored.sort(function(a,b){ return b.s-a.s||val(o,b.c)-val(o,a.c); });
  var pick=scored[0];
  if(ctx.sk.noise&&rnd(ctx.b)<ctx.sk.noise&&scored.length>1) pick=scored[1+Math.floor(rnd(ctx.b)*Math.min(2,scored.length-1))];
  void i;
  return {t:"discard",card:pick.c.id};
}

/* ---------- the sanity filter: a senseless move is rejected (the caller then falls back to the old code) ---------- */
function sane(G,p,a){
  var o=G.o, GM=GMm();
  if(!a) return false;
  var ids=function(){ return p.hand.map(function(c){ return c.id; }); };
  if(a.t==="stock") return G.phase==="draw";
  if(a.t==="take") return G.phase==="draw"&&GM.takeFeasible(G,a.idx);
  if(G.phase!=="play") return false;
  if(a.t==="meld"){ var cs=p.hand.filter(function(c){ return a.ids.indexOf(c.id)>=0; }); return cs.length===a.ids.length&&!!R.buildMeld(cs,o)&&!(o.goOutNeedsDiscard&&cs.length>=p.hand.length); }
  if(a.t==="layoff"){ return ids().indexOf(a.card)>=0&&!(G.mustNew&&G.mustUse===a.card)&&!(o.goOutNeedsDiscard&&p.hand.length<=1); }
  if(a.t==="discard"){
    if(ids().indexOf(a.card)<0||G.mustUse!=null) return false;
    if(G.noDiscard===a.card&&p.hand.length>1) return false;
    var c=p.hand.filter(function(x){ return x.id===a.card; })[0];
    if(c.joker&&p.hand.some(function(x){ return !x.joker&&G.noDiscard!==x.id; })) return false;
    return true;
  }
  return false;
}

var stats={calls:0,declined:0,errors:0};
function decide(G,p){
  stats.calls++;
  try{
    var b=brainOf(G,p);
    observe(G,b);
    var ctx=mkCtx(G,p,b);
    var a=G.phase==="draw"?pickDraw(ctx):pickPlay(ctx);
    if(sane(G,p,a)) return a;
    stats.declined++; return null;
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); return null; }   // the caller falls back to the old code
}

/* ---------- learning across games ---------- */
function finish(G){
  try{
    if(!G||G.aiDone||!G.ai||!G.ai.b||G.winner==null) return;
    G.aiDone=true;
    if(!skillOf(G).learn&&!Object.keys(G.ai.b).some(function(id){ var q=G.players[+id]; return q&&skillOf(G,q).learn; })) return;
    var t=readTable(), any=false;
    Object.keys(G.ai.b).forEach(function(id){
      var b=G.ai.b[id]; if(!b||!b.k) return; any=true;
      var won=unitOf(G,+id)===G.winner;
      KEYS.forEach(function(k){
        var d=b.k[k]-t.w[k], step=won?.25*d:-.06*d;
        t.w[k]=clamp(t.w[k]+clamp(step,-.05,.05),LO,HI);
      });
      t.t.games[b.t]++; if(won) t.t.wins[b.t]++;
    });
    if(any){ t.games++; writeTable(t); }
  }catch(e){}
}
/* a loaded game: the log is empty again, so the brains read from its start */
function afterLoad(G){ try{ if(G&&G.ai&&G.ai.b) Object.keys(G.ai.b).forEach(function(id){ if(G.ai.b[id]) G.ai.b[id].pos=0; }); }catch(e){} }

R.Brain={ P:P, stats:stats, decide:decide, finish:finish, afterLoad:afterLoad, setStore:setStore, readTable:readTable, SKILL:SKILL, KEY:KEY, danger:danger, mkCtx:mkCtx, brainOf:brainOf, observe:observe, V:V, keep:keep };
if(typeof module!=="undefined"&&module.exports) module.exports=R.Brain;
})(typeof window!=="undefined"?window:globalThis);
