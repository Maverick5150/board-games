/* WAR — the computer players' brain. Loaded by engine.js in the browser (or require()d in tests after engine.js).
   Honest scope (RULES.md section 6): Classic, Three-card, Peace, Război, Tod und Leben and Drunkard have NO decisions: the shuffle decides
   everything, so a computer just turns its top card. The brain covers the decisions that do exist:
     1. Hand War: which card to play (a simultaneous choice like Goofspiel). It counts cards from PUBLIC information only (G.kn: whose stack each
        collected card went into, and the cards on the table), estimates what each opponent can hold and is likely to play, scores every card
        (win cheaply, dump a low card when the battle is lost anyway, keep Aces back, a tie means a war), and mixes among near-equal choices.
     2. Prisoners of War (House): which of the beaten cards to take prisoner (the strongest), and when to play a prisoner instead of the top card.
     3. Winner arranges the won cards (House): spread the strong cards out (the effect is tiny and unproven, and we say so).
   One brain per computer seat, plain data in G.ai.b[seat] (saved with the game): its own temperament (balanced / bold / reserved) and weights,
   a mood read from the standings every decision (behind = bold, ahead = reserved, close = balanced), and an in-game model of every opponent
   (how high they tend to play). Learning across games: a small weight table in localStorage 'bg_ai_war' (versioned, bounded, guarded).
   Skill: G.skill or p.skill = "easy" | "normal" | "hard" (missing = normal).
     Easy: mostly random, no counting. Normal: counts what every player holds, plays the expected value, keeps a reserve of strong cards
     when the game is played to the end. Hard: also reads the queue (an opponent's hand is their oldest cards), learns each opponent's habit
     (always strong / always weak), mixes near-equal choices so it can't be read, and drops the reserve in the last battles of a limit.
   A game played to the end vs a limited game (time, battles, one pass): the reserve keeps you alive to the end; in a limited game the count wins.
   Any table from 2 to 16 seats and 1 to 4 decks (the card tables grow with the decks; copies of a card are counted as copies), and the wild-card
   House rules (the engine's winnersOf / strength know what is wild, so counting and the sanity filter follow them). A big table (4+
   opponents) where everyone joins a war (Pagat) plays differently: any tie at the top is a lottery for the whole pot, and long war chains
   empty the stacks so the war cards come from the hand, so the brain keeps its strong cards as war insurance (tournament: 16 seats).
   Every decision is well under 50 ms (mean about 0.1 ms in node; a few hundred samples at most; fewer against more than 3 opponents). */
(function(g){
"use strict";
var W=g.War, E=W&&W.Engine, KEY="bg_ai_war", VER=1;
if(!E||W.Brain) return;
var SKILL={
  easy:  {count:false, queue:0,     model:false, keepLim:0,  rand:.6, samples:40,  learn:false, jit:.25, mix:0,   kill:0},
  normal:{count:true,  queue:.5,    model:false, keepLim:1,  rand:0,  samples:140, learn:true,  jit:.10, mix:0,   kill:2},
  hard:  {count:true,  queue:1,     model:true,  keepLim:1,  rand:0,  samples:220, learn:true,  jit:.05, mix:.02, kill:3, horizon:25}
};
/*P*/var P={lam:.8, keep:10, keepLim:2, tie:.4, save:.5, prUse:.12};   // tuning constants (the tournament checks them)
var KEYS=["keep","tie","save"], LO=.7, HI=1.4;
var stats={calls:0,maxMs:0,totalMs:0,over10:0,errors:0,lastError:""};
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
/* card strength from the engine's table, fetched once per decision (a 16-seat decision looks it up thousands of times) */
var ST=null, STo=null;
function str(G,c){ if(G.o!==STo||!ST){ STo=G.o; ST=E.strengthTable(G); } var v=ST[c]; return v!=null?v:.5; }
function now(){ try{ return (g.performance&&g.performance.now)?g.performance.now():Date.now(); }catch(e){ return Date.now(); } }

/* ---------- the per-device weight table ---------- */
function freshTable(){ return {v:VER,games:0,w:{keep:1,tie:1,save:1},t:{wins:[0,0,0],games:[0,0,0]}}; }
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

/* ---------- helpers ---------- */
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.r=(Math.imul(b.r,1664525)+1013904223)>>>0; return b.r/4294967296; }
function skillOf(G,p){ return SKILL[p&&p.skill]||SKILL[G.skill]||SKILL.normal; }
function brainOf(G,s){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b) ai=G.ai={v:1,b:{}};
  var b=ai.b[s]; if(b&&b.k&&b.om) return b;
  var p=G.players[s], sk=skillOf(G,p), tab=sk.learn?readTable():freshTable();
  var h=hash(G.players.map(function(q){ return q.name; }).join("|")+"|"+G.rs);
  b=ai.b[s]={id:s, t:(h+s)%3, r:(hash(p.name)^(s*2654435761)^h)>>>0, k:{}, om:{}, pos:-1, mood:"balanced", B:0};
  KEYS.forEach(function(k){ b.k[k]=clamp(tab.w[k]*(1+(rnd(b)*2-1)*sk.jit),LO,HI); });
  return b;
}
/* the in-game opponent model: how strong the cards each opponent chooses are (Hand War), read once per battle from the public result */
function observe(G,b){
  var L=G.last; if(!L||L.b<=b.pos) return; b.pos=L.b;
  if(!G.o.hand||!L.first) return;
  L.first.forEach(function(x){
    if(x.s===b.id) return; var m=b.om[x.s]||(b.om[x.s]={n:0,sum:0,pn:0,ps:0}), st=str(G,x.c);
    m.n++; m.sum+=st;
    /* where the played card sat among the cards we were sure they held (Hard): 0 = they played their weakest, 1 = their strongest */
    var sure=(b.sure&&b.sure[x.s])||[];
    if(sure.length>=2&&sure.indexOf(x.c)>=0){ var lo=0; sure.forEach(function(c){ if(c!==x.c&&str(G,c)<st) lo++; }); m.pn=(m.pn||0)+1; m.ps=(m.ps||0)+lo/(sure.length-1); }
  });
  b.sure={};
}
function tendency(b,q){
  var m=b.om[q]; if(!m||!m.n) return 0;
  if(m.pn>=3) return clamp((m.ps/m.pn-.5)*2.2,-1,1)*(m.pn/(m.pn+3));
  return clamp((m.sum/m.n-.5)/.2,-1,1)*(m.n/(m.n+6));
}
/* the situation: balanced / bold / reserved */
function readMood(G,b){
  var all=E.buildDeck(G.o).length, my=E.total(G,b.id), best=0;
  for(var s=0;s<G.n;s++) if(s!==b.id&&!G.players[s].out) best=Math.max(best,E.total(G,s));
  var lead=(my-best)/all, sit=clamp(lead*7,-1.5,1.5);
  var base=b.t===1?.6:b.t===2?-.6:0, B=base-sit;
  b.B=B; b.mood=B>=.8?"bold":B<=-.8?"reserved":"balanced";
  return B;
}

/* ---------- Hand War: what an opponent can play ----------
   Counting (Normal, Hard): every collected pot is public (G.kn: whose stack, G.kt: when). A stack is a queue and the hand is drawn from its top,
   so an opponent's hand is always the OLDEST cards they hold: the never-seen cards from the deal first, then the oldest collected pots.
   Normal counts WHAT each player holds; Hard also reads the queue (which of those cards are in the hand now).
   Easy does not count: it assumes any card could be anywhere. */
function oppModel(G,me,q,b,sk){
  var p=G.players[q], mine=G.players[me], hn=G.o.hand?p.hand.length:(p.pk.length?1:0), excl={}, c;
  if(q!==me){ mine.hand.forEach(function(x){ excl[x]=1; }); mine.pr.forEach(function(x){ excl[x]=1; }); }
  var m={q:q,hn:hn,pr:p.pr.slice(),h:sk.model?tendency(b,q):0,fixed:[],edge:[],edgeN:0,fromU:hn,unk:[]};
  if(!sk.count){ E.buildDeck(G.o).forEach(function(x){ if(!excl[x]) m.unk.push(x); }); return m; }
  var known=[];
  for(c=0;c<G.kn.length;c++){ if(excl[c]) continue; var k=G.kn[c]; if(k===q) known.push(c); else if(k===E.K_UNKNOWN&&inDeck(G,c)) m.unk.push(c); }
  var u=Math.max(0,E.avail(G,q)-known.length);
  if(!(sk.queue>=1||(sk.queue>0&&rnd(b)<sk.queue))){   // knows WHAT each player holds, not in which order (Normal reads the queue only some of the time)
    var tot=known.length+u; m.edge=known; m.edgeN=tot?Math.round(hn*known.length/tot):0; m.fromU=hn-m.edgeN;
  } else if(u<hn&&known.length){
    known.sort(function(x,y){ return G.kt[x]-G.kt[y]; });
    var need=Math.min(hn-u,known.length), cut=G.kt[known[need-1]];
    m.fixed=known.filter(function(x){ return G.kt[x]<cut; });
    m.edge=known.filter(function(x){ return G.kt[x]===cut; });
    m.edgeN=need-m.fixed.length; m.fromU=u;
  }
  if(q===me) m.pr=[];   // my own top card: what the deal and the public pots say it is
  if(sk.model&&q!==me){ b.sure=b.sure||{}; b.sure[q]=(!m.fromU&&m.edgeN===m.edge.length)?m.fixed.concat(m.edge,m.pr):[]; }
  return m;
}
function inDeck(G,c){ var d=inDeck.d||(inDeck.d={}), key=G.o.deck+"|"+G.o.jokers+"|"+E.ndOf(G.o); if(!d[key]){ d[key]={}; E.buildDeck(G.o).forEach(function(x){ d[key][x]=1; }); } return !!d[key][c]; }
function sampleCard(G,m,b){
  var opts=m.pr.concat(m.fixed), i, q, j, L=m.edge.length, ch=[];
  /* edgeN cards drawn without replacement from m.edge (same draws as splicing a copy, without copying a long list every sample) */
  for(i=0;i<m.edgeN&&ch.length<L;i++){
    j=Math.floor(rnd(b)*(L-ch.length));
    for(q=0;q<ch.length&&ch[q]<=j;q++) j++;
    ch.splice(q,0,j); opts.push(m.edge[j]);
  }
  for(i=0;i<m.fromU&&m.unk.length;i++) opts.push(m.unk[Math.floor(rnd(b)*m.unk.length)]);
  if(!opts.length) return -1;
  var h=m.h, a=Math.abs(h);
  if(a>0&&rnd(b)<a){ var bi=0; for(i=1;i<opts.length;i++){ var x=str(G,opts[i]), y=str(G,opts[bi]); if(h>0?x>y:x<y) bi=i; } return opts[bi]; }
  return opts[Math.floor(rnd(b)*opts.length)];
}
function cardV(G,c){ return 1+P.lam*(str(G,c)-.5); }
/* samples per decision: the full count against up to 3 opponents; with more (up to 15 at a 16-seat table) fewer samples keep every
   decision well under 50 ms (each sample already draws a card for every opponent, so the picture stays as sharp) */
function samples(sk,k){ return k<=3?sk.samples:Math.max(Math.min(sk.samples,40),Math.round(sk.samples*3/k)); }
/* score every card in the hand */
function rateHand(G,s,b,sk,opts){
  var p=G.players[s], B=b.B, opps=G.need.filter(function(q){ return q!==s; }), o=G.o;
  var models=opps.map(function(q){ return oppModel(G,s,q,b,sk); });
  var R=opts.map(function(c){ return {c:c,w:0,t:0,l:0,g:0,pr:p.pr.indexOf(c)>=0}; });
  var self=opts.indexOf(-1)>=0?oppModel(G,s,s,b,sk):null;
  var N=samples(sk,opps.length), carryV=0; G.carry.forEach(function(c){ carryV+=cardV(G,c); });
  var tieV=P.tie*b.k.tie*B*.6;
  /* a big table (4+ opponents) where everyone joins a war (Pagat): any tie at the top, with or without me, starts a war that every seat
     fights with blind cards from the stack, so it is a lottery for the whole pot (my card goes in, and I have a 1-in-F chance at all of it).
     The two-to-four player model (a tie I'm not in = my card is lost) undervalues a cheap card there; the tournament showed it (16 seats). */
  var big=opps.length>3&&o.tie==="war"&&!o.onlyTied, F=opps.length+1;
  /* a big table where only the tied players fight (the CEO's rule, the default since 2026-10-16): a tie at the top that I'm in is a war
     between the k tied players for the whole table, so it is worth about 1/k of it, less the card I risk (k-1 times in k); a tie I'm not
     in loses my card as usual. The fixed tie value alone undervalued a strong card that ties with a big pot on the table. */
  var bigTied=opps.length>3&&o.tie==="war"&&o.onlyTied;
  for(var n=0;n<N;n++){
    var oc=[], ov=0;
    for(var i=0;i<models.length;i++){ var x=sampleCard(G,models[i],b); if(x>=0){ oc.push(x); ov+=cardV(G,x); } }
    var top=self?sampleCard(G,self,b):-1, ids=[0].concat(oc);
    R.forEach(function(r){
      var mc=r.c<0?top:r.c; if(mc<0) return;
      ids[0]=mc; var wi=E.winnersOf(G,ids);
      if(wi.length===1&&wi[0]===0){ r.w++; r.g+=ov+carryV+(o.paid?oc.length:0); }
      else if(big&&wi.length>1){ var mine=wi.indexOf(0)>=0; if(mine) r.t++; r.g+=(ov+carryV-cardV(G,mc)*(F-1))/F+(mine?tieV:0); }
      else if(wi.indexOf(0)>=0){ r.t++; r.g+=bigTied?(ov+carryV-cardV(G,mc)*(wi.length-1))/wi.length+tieV:tieV; }
      else { r.l++; r.g-=cardV(G,mc)*(1+b.k.save*P.save*Math.max(0,-B)*str(G,mc))+(o.paid?1:0)+(r.pr?1:0); }
    });
  }
  var keep=((limited(G)&&!big)?P.keepLim*sk.keepLim*horizon(G,sk):P.keep*(big?1:killFactor(G,s,opps,sk)))*b.k.keep*(1-.15*B);
  R.forEach(function(r){ r.w/=N; r.t/=N; r.l/=N; var st=r.c<0?0:str(G,r.c); r.score=r.g/N-keep*st*st; });
  return R;
}
/* a reserve of strong cards in the hand keeps you alive in a game played to the end; in a limited game (time, battles, one pass, sudden
   death) only the card count at the end matters, so the brain plays for battles instead */
function limited(G){ return G.o.length!=="end"||G.sudden; }
/* Hard: in the last battles before a battle limit a reserve is worth nothing, every card counts the same at the end */
function horizon(G,sk){ if(!sk.horizon||G.o.length!=="battles"||G.sudden) return 1; var left=G.o.limit-G.battle; return clamp(left/sk.horizon,0,1); }
/* the reserve matters less when an opponent is nearly out of cards: then winning the battle can end their game */
function killFactor(G,s,opps,sk){
  if(!sk.kill) return 1;
  var f=1; opps.forEach(function(q){ f=Math.min(f,clamp((E.total(G,q)-1)/(sk.kill*(G.o.hand+1)),.05,1)); });
  return f;
}
/* sanity: never spend a stronger card when a weaker one does the same job; a hopeless battle costs the weakest card */
function sane(G,R){
  var ok=R.filter(function(r){
    return !R.some(function(q){ return q!==r&&str(G,q.c)<str(G,r.c)&&q.w>=r.w-.02&&q.l<=r.l+.02&&!q.pr; });
  });
  if(R.every(function(r){ return r.w<.04&&r.t<.04; })){ var lo=R.slice().sort(function(a,b){ return str(G,a.c)-str(G,b.c); })[0]; return [lo]; }
  return ok.length?ok:R;
}
function pickMove(G,s,b,L){
  var sk=skillOf(G,G.players[s]);
  if(L.length===1) return L[0];
  if(sk.rand&&rnd(b)<sk.rand) return L[Math.floor(rnd(b)*L.length)];
  var R=sane(G,rateHand(G,s,b,sk,L.map(function(m){ return m.c; })));
  R.sort(function(a,b2){ return b2.score-a.score; });
  var pick=R[0];
  if(sk.mix){ var near=R.filter(function(r){ return r.score>=R[0].score-sk.mix; }); pick=near[Math.floor(rnd(b)*near.length)]; }
  return {t:"pick",s:s,c:pick.c};
}
/* Prisoners of War: play a prisoner instead of the top card only when it is likely to win (a loss costs it plus one more card) */
function prisonerFlip(G,s,b,L){
  var p=G.players[s], sk=skillOf(G,p), plain=L.filter(function(m){ return m.pr==null; })[0];
  if(sk.rand&&rnd(b)<sk.rand) return L[Math.floor(rnd(b)*L.length)];
  var opts=(plain?[-1]:[]).concat(p.pr), R=rateHand(G,s,b,sk,opts), best=null;
  R.forEach(function(r){ var sc=r.score-(r.pr?P.prUse:0); if(!best||sc>best.sc){ best=r; best.sc=sc; } });
  if(best&&best.c>=0) return {t:"flip",s:s,pr:best.c};
  return plain||L[0];
}
/* collect: take the strongest prisoner; arrange the won cards strong / weak / strong ... */
function claimMove(G,s,b){
  var pd=G.pend, sk=skillOf(G,G.players[s]), pr=null;
  if(pd.prOk.length){
    if(sk.rand&&rnd(b)<sk.rand) pr=pd.prOk[Math.floor(rnd(b)*pd.prOk.length)];
    else pd.prOk.forEach(function(c){ if(pr==null||str(G,c)>str(G,pr)) pr=c; });
  }
  var m={t:"claim",s:s,pr:pr};
  if(G.o.arrange){
    var rest=pd.pot.slice(); if(pr!=null) rest.splice(rest.indexOf(pr),1);
    rest.sort(function(a,c){ return str(G,c)-str(G,a); });
    var order=[], i=0, j=rest.length-1; while(i<=j){ order.push(rest[i++]); if(i<=j) order.push(rest[j--]); }
    m.order=order;
  }
  return m;
}

/* ---------- the decision ---------- */
function decide(G,s){
  var t0=now(), mv=null, L;
  try{
    L=E.legal(G,s); if(!L.length) return null; STo=null;
    var p=G.players[s], b=brainOf(G,s); observe(G,b); readMood(G,b);
    if(G.phase==="claim") mv=claimMove(G,s,b);
    else if(G.phase==="flip"&&G.o.hand) mv=pickMove(G,s,b,L);
    else if(G.phase==="flip"&&p.pr.length) mv=prisonerFlip(G,s,b,L);
    else mv=L[0];                                    // no decision exists: turn the top card
    if(!legalMove(G,s,mv,L)) mv=L[0];
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); try{ mv=E.legal(G,s)[0]||null; }catch(e2){ mv=null; } }
  var dt=now()-t0; stats.calls++; stats.totalMs+=dt; if(dt>stats.maxMs) stats.maxMs=dt; if(dt>10) stats.over10++;
  return mv;
}
function legalMove(G,s,m,L){
  if(!m) return false;
  if(m.t==="claim") return !!G.pend&&G.pend.w===s&&(m.pr==null||G.pend.prOk.indexOf(m.pr)>=0);
  return L.some(function(x){ return x.t===m.t&&x.c===m.c&&(x.pr==null?m.pr==null:x.pr===m.pr); });
}
/* a simple baseline player for the tournament: any legal move at random (no counting, no plan) */
function baseline(G,s){
  var L=E.legal(G,s); if(!L.length) return null;
  var r=(hash(s+"|"+G.battle+"|"+G.rs)%1000)/1000;
  var m=L[Math.floor(r*L.length)];
  if(m.t==="claim") return {t:"claim",s:s,pr:m.pr};
  return m;
}

/* ---------- learning across games ---------- */
function finish(G){
  try{
    if(!G||G.aiDone||!G.ai||!G.ai.b||!G.over) return;
    G.aiDone=true;
    var ids=Object.keys(G.ai.b); if(!ids.length) return;
    var t=readTable(), any=false;
    ids.forEach(function(id){
      var b=G.ai.b[id], q=G.players[+id]; if(!b||!b.k||!q||!skillOf(G,q).learn) return; any=true;
      var won=G.winner===+id;
      KEYS.forEach(function(k){ var d=b.k[k]-t.w[k], step=won?.25*d:-.06*d; t.w[k]=clamp(t.w[k]+clamp(step,-.05,.05),LO,HI); });
      t.t.games[b.t]++; if(won) t.t.wins[b.t]++;
    });
    if(any){ t.games++; writeTable(t); }
  }catch(e){}
}
function hasDecisions(o){ return !!(o.hand||o.prisoners||o.arrange); }

W.Brain={P:P,SKILL:SKILL,KEY:KEY,stats:stats,decide:decide,baseline:baseline,finish:finish,setStore:setStore,readTable:readTable,brainOf:brainOf,observe:observe,readMood:readMood,rateHand:rateHand,hasDecisions:hasDecisions};
if(typeof module!=="undefined"&&module.exports) module.exports=W.Brain;
})(typeof window!=="undefined"?window:globalThis);
