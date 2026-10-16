/* CANDY LAND — the computer players' brain. Loaded by engine.js in the browser (or require()d in tests after engine.js).
   Honest scope (RULES.md section 6): the classic game has NO decisions. "No strategy is involved as players are never required to make
   choices; only following directions is required." [WIK]. In both Versions, with every House rule but one, a turn is "draw the top card and
   do what it says", so the brain cannot change who wins and never touches the game's cards (G.rs, G.deck): a game played by brains and the
   same game played by the baseline are identical, card for card (the tournament proves it).
   The one real decision: "Draw two, choose one" (the 2004 "Older players" option [HAS04]; House on the 1984 board). Then the brain:
     - values each card by where it really leads (the engine's own outcome(): shortcut, sticky / licorice square, a taken square with No
       sharing squares) against an exact expected-turns table for the rules in play (E.table / E.finishDist: Markov, about 5-15 ms once,
       cached). Not just "the furthest square": a licorice square costs a turn, a 1984 sticky square several, a shortcut start is worth
       10-54 squares, and standing just behind a picture square keeps that picture card a jump forward.
     - Easy: half the time a random card (after the sanity filter), otherwise the furthest square. No table.
       Normal: the fewest expected turns, nudged by its mood: bold takes the riskier card (higher spread of finishing times) when far behind,
       reserved the steadier card when ahead (RULES.md 6).
       Hard: the highest chance to WIN: its own finishing-time distribution against every opponent's (their squares, a pending lost turn,
       the turn order), and it counts the cards (the draw pile's make-up is public: all cards minus the discards, the set-aside cards and the
       hand) when a choice means drawing again.
   Per AI-TASK.md, every computer seat has its own brain, plain data in G.ai.b[seat] (saved with the game): a temperament (balanced / bold /
   reserved), a mood from the standings (behind = bold, ahead = reserved, close = balanced; the temperament nudges the thresholds), an
   in-game opponent model from public results (each opponent's picture trips, sticky squares, lost turns and, with draw two, how often their
   pick matched the best card), a sanity filter (never a card that goes back, stays put or lands on a sticky / licorice square when the
   other card moves at least as far without any of that), light learning across games in localStorage 'bg_ai_candy' (versioned, bounded,
   try/catch: wins per temperament and per mood strength, leaned toward a little; fun records), think() (a pause factor) and react() (one
   short line per move). Every decision is far under 50 ms (the first draw-two decision builds the tables; warm(G) does it earlier). */
(function(g){
"use strict";
var CY=g.Candy, E=CY&&CY.Engine, KEY="bg_ai_candy", VER=1;
if(!E||CY.Brain) return;
var NOTE="In Candy Land the cards decide everything: there is nothing to choose, so skill makes no difference. With \"Draw two, choose one\" there is a real choice, and Normal and Hard choose well.";
var NOTE_CHOICE="Draw two, choose one: Easy often grabs any card, Normal plays the card that gets home fastest, Hard plays the card most likely to win the race.";
var SKILL={easy:{label:"Easy"},normal:{label:"Normal"},hard:{label:"Hard"}};
var TEMPER=["balanced","bold","reserved"];
var SCALES=[0.5,1,1.5];                     // how strongly the mood leans (learned per device)
var stats={calls:0,maxMs:0,totalMs:0,over10:0,over50:0,errors:0,lastError:"",filtered:0,choices:0};
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function now(){ try{ return (g.performance&&g.performance.now)?g.performance.now():Date.now(); }catch(e){ return Date.now(); } }

/* ---------- the per-device table ---------- */
function freshTable(){ return {v:VER,games:0,wins:[0,0,0],plays:[0,0,0],sw:[0,0,0],sp:[0,0,0],rec:{trip:0,shortcuts:0,pics:0,stuck:0}}; }
function num(x,max){ x=+x; return isFinite(x)&&x>0?Math.min(max,Math.floor(x)):0; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER) return t;
    t.games=num(d.games,1e7);
    for(var i=0;i<3;i++){
      t.wins[i]=num(d.wins&&d.wins[i],1e7); t.plays[i]=num(d.plays&&d.plays[i],1e7); if(t.wins[i]>t.plays[i]) t.wins[i]=t.plays[i];
      t.sw[i]=num(d.sw&&d.sw[i],1e7); t.sp[i]=num(d.sp&&d.sp[i],1e7); if(t.sw[i]>t.sp[i]) t.sw[i]=t.sp[i];
    }
    if(d.rec){ t.rec.trip=num(d.rec.trip,134); t.rec.shortcuts=num(d.rec.shortcuts,1e9); t.rec.pics=num(d.rec.pics,1e9); t.rec.stuck=num(d.rec.stuck,1e9); }
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- helpers ---------- */
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.r=(Math.imul(b.r,1664525)+1013904223)>>>0; return b.r/4294967296; }   // the brain's own RNG: never the game's cards
function pick(b,a){ return a[Math.floor(rnd(b)*a.length)]; }
function isCpu(G,s){ var p=G.players[s]; return !!p&&!p.human; }
function skillOf(G,s){ var k=G.players[s]&&G.players[s].skill; return k==="easy"||k==="hard"?k:"normal"; }
function brainOf(G,s){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b) ai=G.ai={v:1,b:{}};
  var b=ai.b[s]; if(b&&b.om&&typeof b.t==="number") return b;
  var p=G.players[s], h=hash(G.players.map(function(q){ return q.name; }).join("|")+"|"+G.n+"|"+(G.fp?G.fp.winner:0));
  b=ai.b[s]={id:s,t:(h+s)%3,r:(hash(p.name)^(s*2654435761)^h)>>>0,om:{},pos:-1,mood:"balanced",B:0,gap:0,threat:-1,said:-1,sc:1};
  /* lean a little toward the mood strength that won most on this device (only draw-two games have choices to lean with) */
  if(G.o&&G.o.older){
    var t=readTable(), best=1, bv=-1;
    for(var i=0;i<3;i++){ var v=(t.sw[i]+1)/(t.sp[i]+2); if(v>bv){ bv=v; best=i; } }
    b.sc=rnd(b)<.6?best:Math.floor(rnd(b)*3);
  }
  return b;
}
function tables(G){ return G.o.older?E.finishDist(G.o):E.table(G.o,1e-7); }
/* expected own turns to the goal (0 when home; a pending lost turn adds one) */
function eta(G,s){ var p=G.players[s]; if(p.done) return 0; var T=tables(G); return T.E[p.pos]+(p.skip?1:0); }
/* where a card leads seat s from where it stands (no sharing ignored): for judging an opponent's pick afterwards */
function soloAt(G,pos,id){ var B=E.BOARDS[G.bd], st=B.stickyKind==="until"&&B.sticky[pos]?B.sticky[pos]:null; return E.walk(B,G.o,pos,st,E.cardOf(G,id),null); }

/* the in-game opponent model: read once per move from the public result (G.last) */
function observe(G,b){
  var L=G.last; if(!L||L.step<=b.pos) return; b.pos=L.step;
  if(L.s===b.id) return;
  var m=b.om[L.s]||(b.om[L.s]={moves:0,pics:0,back:0,sticky:0,picks:0,good:0});
  m.moves++;
  if(L.kind==="picture"&&!L.stay){ m.pics++; if(L.to<L.from) m.back++; }
  if(L.sticky||L.lose) m.sticky++;
  if(L.pick&&L.other!=null){
    try{
      var T=tables(G), v=function(r){ return r.win?0:T.E[r.to]+(r.lose?1:0); };
      m.picks++; if(v(soloAt(G,L.from,L.id))<=v(soloAt(G,L.from,L.other))+1e-9) m.good++;
    }catch(e){}
  }
}
/* the situation: balanced / bold / reserved */
function readMood(G,b){
  var me=eta(G,b.id), best=Infinity, threat=-1;
  for(var s=0;s<G.n;s++){ if(s===b.id||G.players[s].done) continue; var e=eta(G,s); if(e<best){ best=e; threat=s; } }
  if(!isFinite(best)) best=me;
  var unit=Math.max(1,tables(G).E[0]/8);                 // an eighth of a whole game behind = fully bold
  var gap=me-best, sit=clamp(gap/unit,-1.5,1.5);
  var base=b.t===1?.6:b.t===2?-.6:0, B=base+sit;
  b.B=B; b.gap=+gap.toFixed(2); b.threat=threat; b.mood=B>=.8?"bold":B<=-.8?"reserved":"balanced";
  return B;
}

/* ---------- the draw-two choice ---------- */
function optionOf(G,s,i){
  var p=G.players[s], id=G.hand[i], r=E.outcome(G,s,id);
  return {i:i,id:id,r:r,win:r.win,redraw:!!r.redraw,stay:!!r.stay,pen:!!(r.sticky||r.lose),back:r.kind==="picture"&&!r.stay&&!r.redraw&&r.to<p.pos,
    to:r.redraw||r.stay?p.pos:r.to,lose:r.lose?1:0};
}
/* furthest square first (win = past everything); the baseline and Easy's habit */
function far(o){ return o.win?1e6:o.to; }
/* the sanity filter: a is obviously bad next to b */
function dominated(a,b,pos){
  if(a.win||b.redraw||b.stay||b.pen||b.back) return false;
  if(!b.win&&b.to<=pos) return false;
  if(!(a.pen||a.back||a.stay)) return false;
  return b.win||b.to>=a.to;
}
/* Normal: expected own turns still needed after this turn (lower is better), nudged by the mood's taste for spread */
function scoreNormal(G,s,o,b){
  if(o.win) return -1e9;
  var T=tables(G), p=G.players[s];
  if(o.redraw) return T.E[p.pos]-1;                         // the turn starts over: no turn is used
  var e=T.E[o.to]+o.lose, sd=T.sd?T.sd[o.to]:0;
  var lam=(b.mood==="bold"?-.3:b.mood==="reserved"?.3:0)*SCALES[b.sc==null?1:b.sc];
  return e+lam*sd;
}
/* Hard: the chance to win the race from each option */
function winCtx(G,s){
  var T=E.finishDist(G.o), H=T.H+3, surv=new Float64Array(H+3), t, j;
  for(t=0;t<=H+2;t++) surv[t]=1;
  for(j=0;j<G.n;j++){
    if(j===s) continue; var q=G.players[j]; if(q.done){ for(t=0;t<=H+2;t++) surv[t]=0; continue; }
    var Fq=T.F[q.pos];
    for(t=1;t<=H+2;t++){ var tt=t-(q.skip?1:0), f=tt<=0?0:Fq[Math.min(tt,T.H)]; surv[t]*=1-f; }
  }
  return {T:T,H:H,surv:surv};
}
/* P(win) when my next turn starts on square "to" (lose = a lost turn first) and the opponents have had "shift" more turns than now */
function winProb(ctx,to,lose,shift){
  var T=ctx.T; shift=shift||0; if(to>=E.END) return ctx.surv[shift];
  var Fm=T.F[to], w=0, prev=0;
  for(var t=1;t<=ctx.H;t++){ var tt=t-lose, f=tt<=0?0:Fm[Math.min(tt,T.H)]; w+=(f-prev)*ctx.surv[Math.min(t+shift,ctx.H+2)]; prev=f; }
  return w;
}
/* the make-up of the draw pile from public information (card counting), as [{id, c}] per card type; younger: backward pictures from
   square pos are replaced at once, so they are left out */
function pileTypes(G,s,pos){
  var ids=E.unseen(G), cnt={}, ty=[], B=E.BOARDS[G.bd], stuck=B.stickyKind==="until"&&B.sticky[pos]?B.sticky[pos]:null;
  ids.forEach(function(id){
    var cd=E.cardOf(G,id);
    if(G.o.younger&&!stuck&&cd.pic!=null&&B.pics[cd.pic]<pos) return;
    if(!cnt[cd.ty]){ cnt[cd.ty]={id:id,cd:cd,c:0}; ty.push(cnt[cd.ty]); } cnt[cd.ty].c++;
  });
  return ty;
}
/* Hard looks one turn ahead from square q: the opponents draw before me, but every card order is equally likely, so my next two cards
   are two random cards of the pile as counted now (unless a reshuffle comes first: then the plain table is used) */
function lookAhead(G,s,ctx,q){
  var opp=0; for(var j=0;j<G.n;j++) if(j!==s&&!G.players[j].done&&!G.players[j].skip) opp++;
  if(G.deck.length<2*opp+2) return winProb(ctx,q,0,0);
  var ty=pileTypes(G,s,q), N=0, i, j2, B=E.BOARDS[G.bd], stuck=B.stickyKind==="until"&&B.sticky[q]?B.sticky[q]:null, others=[];
  for(j=0;j<G.n;j++) if(j!==s) others.push(G.players[j].pos);
  var occ=G.o.noShare?function(n){ return n>0&&others.indexOf(n)>=0; }:null;
  ty.forEach(function(x){ N+=x.c; });
  if(N<2) return winProb(ctx,q,0,0);
  var V=ty.map(function(x){
    var r=E.walk(B,G.o,q,stuck,x.cd,occ);
    if(r.win) return ctx.surv[1];
    if(r.redraw||r.stay) return winProb(ctx,q,0,1);
    return winProb(ctx,r.to,r.lose?1:0,1);
  });
  var acc=0;
  for(i=0;i<ty.length;i++) for(j2=0;j2<ty.length;j2++){
    var pr=ty[i].c/N*((ty[j2].c-(i===j2?1:0))/(N-1)); if(pr<=0) continue;
    acc+=pr*(V[i]>V[j2]?V[i]:V[j2]);
  }
  return acc;
}
function winOf(G,s,ctx,o){
  if(o.win) return 1;
  if(!o.redraw) return o.lose?winProb(ctx,o.to,1,0):lookAhead(G,s,ctx,o.to);
  /* drawing two again: the draw pile's make-up is public (card counting); younger players' backward pictures are replaced at once */
  var ids=E.unseen(G), p=G.players[s], cnt={}, ty=[], i, j;
  ids.forEach(function(id){ if(G.o.younger&&E.backPic(G,s,id)) return; var k=E.cardOf(G,id).ty; if(!cnt[k]){ cnt[k]={id:id,c:0}; ty.push(k); } cnt[k].c++; });
  var N=0; ty.forEach(function(k){ N+=cnt[k].c; });
  if(N<2) return winProb(ctx,p.pos,0);
  var W=ty.map(function(k){ var r=E.outcome(G,s,cnt[k].id); return r.win?1:(r.redraw||r.stay)?winProb(ctx,p.pos,0):winProb(ctx,r.to,r.lose?1:0); });
  var acc=0;
  for(i=0;i<ty.length;i++) for(j=0;j<ty.length;j++){
    var pr=cnt[ty[i]].c/N*((cnt[ty[j]].c-(i===j?1:0))/(N-1)); if(pr<=0) continue;
    acc+=pr*(W[i]>W[j]?W[i]:W[j]);
  }
  return acc;
}
function choose(G,s){
  var b=brainOf(G,s), sk=skillOf(G,s), p=G.players[s];
  var opts=[optionOf(G,s,0),optionOf(G,s,1)], ch;
  stats.choices++;
  var ok=opts.filter(function(o,k){ return !dominated(o,opts[1-k],p.pos); });
  if(!ok.length) ok=opts.slice();
  if(sk==="easy"){
    if(rnd(b)<.5) ch=pick(b,ok);
    else ch=far(opts[1])>far(opts[0])?opts[1]:opts[0];
  } else if(sk==="normal"){
    var s0=scoreNormal(G,s,opts[0],b), s1=scoreNormal(G,s,opts[1],b);
    ch=s1<s0-1e-9?opts[1]:opts[0];
  } else {
    var ctx=winCtx(G,s), w0=winOf(G,s,ctx,opts[0]), w1=winOf(G,s,ctx,opts[1]);
    if(Math.abs(w0-w1)<1e-9){ var n0=scoreNormal(G,s,opts[0],b), n1=scoreNormal(G,s,opts[1],b); ch=n1<n0-1e-9?opts[1]:opts[0]; }
    else ch=w1>w0?opts[1]:opts[0];
  }
  if(dominated(ch,opts[1-ch.i],p.pos)){ stats.filtered++; ch=opts[1-ch.i]; }      // sanity filter (the last word)
  b.lastPick={i:ch.i,step:G.step};
  return {t:"pick",s:s,i:ch.i};
}

/* ---------- the decision ---------- */
function legalMove(m,L){ for(var i=0;i<L.length;i++) if(L[i].t===m.t&&L[i].s===m.s&&L[i].i===m.i) return true; return false; }
function decide(G,s){
  var t0=now(), mv=null, L;
  try{
    L=E.legal(G,s); if(!L.length) return null;
    var b=brainOf(G,s); observe(G,b); readMood(G,b);
    mv=G.phase==="choose"?choose(G,s):{t:"draw",s:s};
    if(!mv||!legalMove(mv,L)) mv=L[0];
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); try{ mv=E.legal(G,s)[0]||null; }catch(e2){ mv=null; } }
  var dt=now()-t0; stats.calls++; stats.totalMs+=dt; if(dt>stats.maxMs) stats.maxMs=dt; if(dt>10) stats.over10++; if(dt>50) stats.over50++;
  return mv;
}
/* the baseline for the tournament: draw; with draw two, the card that ends furthest along (after any shortcut) */
function baseline(G,s){
  var L=E.legal(G,s); if(!L.length) return null;
  if(G.phase!=="choose") return L[0];
  var a=optionOf(G,s,0), c=optionOf(G,s,1);
  return {t:"pick",s:s,i:far(c)>far(a)?1:0};
}
/* a second baseline: a random card */
function randomMove(G,s,r){ var L=E.legal(G,s); if(!L.length) return null; return L[Math.floor((r||Math.random)()*L.length)]; }
/* build the tables before the first decision (the page calls this during the who-goes-first show) */
function warm(G){ try{ tables(G); }catch(e){} }
function hasDecisions(G){ return !!(G&&G.o&&G.o.older); }

/* ---------- presentation: the pause before a draw, and one line per move ---------- */
function think(G,s){
  try{
    if(!isCpu(G,s)) return 1;
    var b=brainOf(G,s); observe(G,b); readMood(G,b);
    var p=G.players[s], f=1;
    if(G.phase==="choose") f=sk2(G,s)==="hard"?1.35:1.2;                  // looking at two cards takes a moment
    if(E.END-p.pos<=12) f*=b.mood==="reserved"?1.5:b.mood==="bold"?1.1:1.3;   // the home stretch
    else if(p.stuck) f*=1.25;
    return f;
  }catch(e){ return 1; }
}
function sk2(G,s){ return skillOf(G,s); }
var LINES={
  picFwd:[["A picture card! Off I go.","That's a long way forward.","Oh, I like this card."],["Whoosh! Hold on tight!","Look at me go!","Best card in the deck!"],["How lovely. Forward we go.","A nice jump. Thank you.","I'll take that quietly."]],
  picBack:[["Back I go... oh well.","All the way back there?","Hm. A long walk back."],["Nooo! Back again?","Fine. I'll catch up.","That card is rude."],["I was afraid of that.","Back we go. Calmly.","Oh dear. Patience."]],
  shortcut:[["A shortcut! Lovely.","Over the top, thank you.","That saves a lot of squares."],["Shortcut! See you later!","Wheee!","Nobody catches me now!"],["A shortcut. Very good.","That helps. Quietly.","I'll take the easy way."]],
  sticky:[["Stuck! I need {c}.","Oh no, it's sticky here.","Waiting for a {c} card."],["Stuck? Me? Come on, {c}!","Give me a {c} card!","Ugh, sticky!"],["Stuck. I'll wait for {c}.","Patience. {c} will come.","Sticky... how unfortunate."]],
  licorice:[["Licorice! I lose a turn.","Tangled up. Next turn's gone.","Oh, licorice."],["Licorice? Seriously?","One turn, that's all!","I'll be back faster!"],["Licorice. I'll sit this one out.","A short rest, then.","Oh dear, tangled."]],
  stuck:[["Still stuck.","Not {c} yet.","Waiting..."],["Come ON, {c}!","Still no {c}!","This is taking forever!"],["Still waiting. That's fine.","No {c} yet.","Patience..."]],
  freed:[["Free at last!","There's my {c}!","Out of the sticky bit."],["FREE! Watch out!","Finally! Here I come!","Ha! Out!"],["Free. Thank you, {c}.","Out, finally.","That's better."]],
  win:[["Home! Good game, everyone.","Made it! That was fun.","Good game!"],["I win! Told you!","Sugarspire, here I am!","Champion!"],["Oh! I made it. How nice.","Home at last. Good game.","A quiet win. Thank you."]],
  near:[["Almost there.","Nearly home.","Just a few squares."],["Home stretch! Here I come!","Nearly there!","Watch me finish!"],["Careful now...","Slowly, slowly...","Nearly..."]],
  picked:[["I'll take this one.","This card is better.","Good choice, I think."],["This one! Obviously!","The big move!","Easy choice!"],["The safer card.","This one, carefully.","Hm... this one."]],
  otherBack:[["Oh, bad luck!","That's a long way back.","Poor thing."],["Ha! Back you go!","Bye bye!","See you later!"],["Oh, that hurt.","Careful out there.","Unlucky."]],
  otherFwd:[["Nice card!","Lucky you.","Off they go."],["Hey! I wanted that card!","No fair!","Lucky!"],["Hm. They're ahead now.","That's a worry.","A big jump for them."]]
};
function line(b,kind,c){ var set=LINES[kind]; if(!set) return null; return pick(b,set[b.t]).replace(/\{c\}/g,c?E.CNAME[c]:""); }
/* react(G, ev) -> {s, text, kind, mood, temper} or null: at most one line per move, from a computer, rarely twice in a row */
function react(G,ev){
  try{
    if(!G||!ev||!ev.length) return null;
    var mover=-1, kind=null, c=null, len=0, i, e, picked=false;
    for(i=0;i<ev.length;i++){
      e=ev[i];
      if(e.e==="draw"||e.e==="pick"){ mover=e.s; if(e.e==="pick") picked=true; }
      else if(e.e==="move"&&e.kind==="picture"){ len=e.path.length; kind=e.dir<0?"picBack":(len>=15?"picFwd":kind); }
      else if(e.e==="shortcut") kind="shortcut";
      else if(e.e==="sticky"){ kind="sticky"; c=e.need; }
      else if(e.e==="licorice") kind="licorice";
      else if(e.e==="stuck"){ kind="stuck"; c=e.need; }
      else if(e.e==="freed"){ kind="freed"; c=e.c; }
      else if(e.e==="finish"&&e.place===1) kind="win";
    }
    if(mover<0||!G.players[mover]) return null;
    if(!kind&&picked) kind="picked";
    if(!kind&&!G.players[mover].done&&E.END-G.players[mover].pos<=12) kind="near";
    var speaker=-1;
    if(isCpu(G,mover)&&kind){
      var bm=brainOf(G,mover), chance={picFwd:1,picBack:1,win:1,shortcut:.8,sticky:1,licorice:1,freed:.8,stuck:.3,picked:.25,near:.25}[kind];
      if(G.step-bm.said>=2||kind==="win"||kind==="picBack"||kind==="sticky"||kind==="licorice") if(rnd(bm)<chance) speaker=mover;
    } else if((kind==="picBack"||kind==="picFwd")&&len>=30){
      var cpus=[]; for(i=0;i<G.n;i++) if(i!==mover&&isCpu(G,i)&&!G.players[i].done) cpus.push(i);
      if(cpus.length){ var who=cpus[(G.step+mover)%cpus.length], bw=brainOf(G,who); if(rnd(bw)<.5){ speaker=who; kind=kind==="picBack"?"otherBack":"otherFwd"; } }
    }
    if(speaker<0) return null;
    var b=brainOf(G,speaker); readMood(G,b); b.said=G.step;
    var t=line(b,kind,c); return t?{s:speaker,text:t,kind:kind,mood:b.mood,temper:TEMPER[b.t]}:null;
  }catch(err){ return null; }
}

/* ---------- learning across games ---------- */
function finish(G){
  try{
    if(!G||G.aiDone||!G.over) return;
    G.aiDone=true;
    var t=readTable();
    for(var s=0;s<G.n;s++){
      if(!isCpu(G,s)) continue;
      var b=brainOf(G,s); t.plays[b.t]++; if(G.winner===s) t.wins[b.t]++;
      if(G.o.older&&b.sc!=null){ t.sp[b.sc]++; if(G.winner===s) t.sw[b.sc]++; }
    }
    if(G.stats.longestTrip&&G.stats.longestTrip.len>t.rec.trip) t.rec.trip=G.stats.longestTrip.len;
    t.rec.shortcuts+=G.stats.shortcuts; t.rec.pics+=G.stats.pics; t.rec.stuck+=G.stats.stuck+G.stats.lost;
    t.games++;
    /* keep the table small and fresh: halve old counts past 1000 plays */
    for(var i=0;i<3;i++){ if(t.plays[i]>1000){ t.plays[i]>>=1; t.wins[i]>>=1; } if(t.sp[i]>1000){ t.sp[i]>>=1; t.sw[i]>>=1; } }
    writeTable(t);
  }catch(e){}
}
/* device records for the Victory screen: {games, trip, shortcuts, pics, stuck} */
function records(){ var t=readTable(); return {games:t.games,trip:t.rec.trip,shortcuts:t.rec.shortcuts,pics:t.rec.pics,stuck:t.rec.stuck}; }

CY.Brain={NOTE:NOTE,NOTE_CHOICE:NOTE_CHOICE,SKILL:SKILL,TEMPER:TEMPER,SCALES:SCALES,KEY:KEY,LINES:LINES,stats:stats,decide:decide,baseline:baseline,randomMove:randomMove,
  think:think,react:react,finish:finish,records:records,warm:warm,hasDecisions:hasDecisions,
  setStore:setStore,readTable:readTable,brainOf:brainOf,observe:observe,readMood:readMood,eta:eta,
  _optionOf:optionOf,_dominated:dominated,_scoreNormal:scoreNormal,_winCtx:winCtx,_winOf:winOf};
if(typeof module!=="undefined"&&module.exports) module.exports=CY.Brain;
})(typeof window!=="undefined"?window:globalThis);
