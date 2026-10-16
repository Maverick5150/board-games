/* SNAKES AND LADDERS — the computer players' brain. Loaded by engine.js in the browser (or require()d in tests after engine.js).
   Honest scope (RULES.md section 6): Snakes and Ladders has NO decisions. In both Versions and every House rule the only move is "roll"
   (or spin) and the die decides everything ("a simple race based on sheer luck" [WIK]; "no skill to it, only luck and turn-taking" [JAQ];
   "a zero-choice board game" [BIG]). So the brain cannot change who wins, and it never touches the game's dice (G.rs): a game played by
   brains and the same game played by the baseline are identical, roll for roll (the tournament proves it).
   What the brain does instead, per AI-TASK.md, is make each computer a character worth watching:
     - One brain per computer seat, plain data in G.ai.b[seat] (saved with the game): its own temperament (balanced / bold / reserved).
     - It reads the situation every turn: its expected rolls to 100 against the best opponent's (the exact Markov table of the board in
       play, E.expectTable), so behind = bold, ahead = reserved, close = balanced (the temperament only nudges the thresholds).
     - In-game opponent model from the public results: each opponent's ladders, snakes and luck (squares climbed minus squares slid), and
       who the threat is (the fewest expected rolls left).
     - It shows that: think(G, s) = a pause factor before a roll (a reserved computer near 100 or a snake head takes a breath; a bold one
       hardly waits), react(G, ev) = at most one short line per move from a computer (a happy climb, a groan on a snake, "needs exactly 3").
     - Learning across games (light, per device): localStorage 'bg_ai_snakes' (versioned, bounded, inside try/catch) keeps fun records
       (the longest slide and climb seen on this device, games, ladders, snakes) and wins per temperament. Nothing in it can change play.
     - Sanity filter: the move is always a legal roll (anything else falls back to the engine's legal move).
     - Easy / Normal / Hard: kept on the setup page for consistency, and they say plainly that skill makes no difference here (NOTE).
   Every decision is far under 50 ms (the Markov table is solved once per board and rules, about 1 ms, then cached). */
(function(g){
"use strict";
var SN=g.Snakes, E=SN&&SN.Engine, KEY="bg_ai_snakes", VER=1;
if(!E||SN.Brain) return;
var NOTE="Skill makes no difference in Snakes and Ladders: it is pure luck, and every player just rolls.";
var SKILL={easy:{label:"Easy"},normal:{label:"Normal"},hard:{label:"Hard"}};   // identical play: there is nothing to decide
var TEMPER=["balanced","bold","reserved"];
var stats={calls:0,maxMs:0,totalMs:0,over10:0,errors:0,lastError:""};
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function now(){ try{ return (g.performance&&g.performance.now)?g.performance.now():Date.now(); }catch(e){ return Date.now(); } }

/* ---------- the per-device table (fun records + wins per temperament; never changes play) ---------- */
function freshTable(){ return {v:VER,games:0,wins:[0,0,0],plays:[0,0,0],rec:{slide:0,climb:0,ladders:0,snakes:0}}; }
function num(x,max){ x=+x; return isFinite(x)&&x>0?Math.min(max,Math.floor(x)):0; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER) return t;
    t.games=num(d.games,1e7);
    for(var i=0;i<3;i++){ t.wins[i]=num(d.wins&&d.wins[i],1e7); t.plays[i]=num(d.plays&&d.plays[i],1e7); if(t.wins[i]>t.plays[i]) t.wins[i]=t.plays[i]; }
    if(d.rec){ t.rec.slide=num(d.rec.slide,99); t.rec.climb=num(d.rec.climb,99); t.rec.ladders=num(d.rec.ladders,1e9); t.rec.snakes=num(d.rec.snakes,1e9); }
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- helpers ---------- */
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.r=(Math.imul(b.r,1664525)+1013904223)>>>0; return b.r/4294967296; }   // the brain's own RNG: never the game's dice
function pick(b,a){ return a[Math.floor(rnd(b)*a.length)]; }
function isCpu(G,s){ var p=G.players[s]; return !!p&&!p.human; }
function brainOf(G,s){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b) ai=G.ai={v:1,b:{}};
  var b=ai.b[s]; if(b&&b.om&&typeof b.t==="number") return b;
  var p=G.players[s], h=hash(G.players.map(function(q){ return q.name; }).join("|")+"|"+G.n+"|"+(G.fp?G.fp.winner:0));
  b=ai.b[s]={id:s,t:(h+s)%3,r:(hash(p.name)^(s*2654435761)^h)>>>0,om:{},pos:-1,mood:"balanced",B:0,gap:0,threat:-1,said:-1};
  return b;
}
/* expected rolls to the goal (100 on the race boards) from a square (0 when home); any board of the catalogue (E.geo) */
function eta(G,s){ var p=G.players[s]; if(p.done) return 0; var gm=E.geo?E.geo(G):null, T=E.expectTable(G.L,G.o,gm||undefined); return T?((p.back&&T.back&&T.back[p.pos]!=null)?T.back[p.pos]:T[p.pos]):(gm?gm.goal:100)-p.pos; }

/* the in-game opponent model: read once per move from the public result (G.last) */
function observe(G,b){
  var L=G.last; if(!L||L.step<=b.pos) return; b.pos=L.step;
  if(L.s===b.id) return;
  var m=b.om[L.s]||(b.om[L.s]={rolls:0,lad:0,sn:0,luck:0});
  m.rolls++;
  if(L.jump==="ladder"){ m.lad++; m.luck+=L.to-L.land; }
  else if(L.jump==="snake"){ m.sn++; m.luck-=L.land-L.to; }
  else if(L.kind==="restart") m.luck-=L.from-L.to;
}
/* the situation: balanced / bold / reserved */
function readMood(G,b){
  var me=eta(G,b.id), best=Infinity, threat=-1;
  for(var s=0;s<G.n;s++){ if(s===b.id||G.players[s].done) continue; var e=eta(G,s); if(e<best){ best=e; threat=s; } }
  if(!isFinite(best)) best=me;
  var gap=me-best, sit=clamp(gap/8,-1.5,1.5);               // 8 rolls behind = fully bold; 8 ahead = fully reserved
  var base=b.t===1?.6:b.t===2?-.6:0, B=base+sit;
  b.B=B; b.gap=+gap.toFixed(1); b.threat=threat; b.mood=B>=.8?"bold":B<=-.8?"reserved":"balanced";
  return B;
}

/* ---------- the decision (the only legal move is the roll) ---------- */
function legalMove(G,s,m,L){ return !!m&&m.t==="roll"&&m.s===s&&Object.keys(m).length===2&&L.length>0; }
function decide(G,s){
  var t0=now(), mv=null, L;
  try{
    L=E.legal(G,s); if(!L.length) return null;
    var b=brainOf(G,s); observe(G,b); readMood(G,b);
    mv={t:"roll",s:s};
    if(!legalMove(G,s,mv,L)) mv=L[0];                      // sanity filter
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); try{ mv=E.legal(G,s)[0]||null; }catch(e2){ mv=null; } }
  var dt=now()-t0; stats.calls++; stats.totalMs+=dt; if(dt>stats.maxMs) stats.maxMs=dt; if(dt>10) stats.over10++;
  return mv;
}
/* the baseline for the tournament: just roll (no brain, no model) */
function baseline(G,s){ var L=E.legal(G,s); return L.length?L[0]:null; }

/* ---------- presentation: the pause before a roll, and one line per move ---------- */
/* a factor for the page's pre-roll pause (x Game speed): tension near 100 or with a snake head in reach */
function think(G,s){
  try{
    if(!isCpu(G,s)) return 1;
    var b=brainOf(G,s); observe(G,b); readMood(G,b);
    var h=E.hint(G,s), risky=h&&(h.near||h.ahead.some(function(a){ return a.kind==="snake"&&a.to<a.at-15; }));
    if(!risky) return 1;
    return b.mood==="reserved"?1.6:b.mood==="bold"?1.12:1.35;
  }catch(e){ return 1; }
}
var LINES={
  bigLadder:[["What a climb!","Up we go - nicely done, dice.","That's the ladder I wanted."],["Whoosh! All the way up!","Ha! Top of the world!","Nothing can stop me now!"],["Oh. Oh my. That helps.","A long ladder. I'll take it quietly.","Well, that was lucky."]],
  ladder:[["A ladder, thank you.","Up a little.","Every rung counts."],["Up! Up! Up!","Ladder time!","Climbing!"],["A small ladder. Fine.","Steady progress.","That will do."]],
  bigSnake:[["Down the long snake... oh well.","That's a long way down.","Back to the bottom rows."],["Argh! I'll be back!","That snake owes me!","Fine. I'll climb it all again."],["I knew that snake was waiting.","Oh dear. All the way down.","That is most unfortunate."]],
  snake:[["A little slip.","Snake. Not too bad.","Down a few."],["Pfft, a small snake.","Barely a scratch!","Is that all?"],["Careful... too late.","I should have rolled softer.","Hm. A snake."]],
  stay:[["Needs exactly {n}.","Not this time. {n} to go.","Close, but I need a {n}."],["Come on, a {n}!","So close! Just a {n}!","Next roll is a {n}, I can feel it."],["Patience. A {n} will come.","I'll wait for my {n}.","Exactly {n}. No rush."]],
  again:[["A 6! Again.","Another roll, please.","Six! Once more."],["Six! Keep it coming!","Roll again! Yes!","Another six, watch this!"],["A 6. Calmly again.","Another roll. Good.","Six. Let's not get greedy."]],
  win:[["{n}! Good game, everyone.","Made it to the top!","That was fun - good game."],["{n}! Told you!","Champion of the board!","Nobody catches me!"],["Oh! I won. How nice.","Home at last. Good game.","A quiet win. Thank you."]],
  restart:[["Back to the start. Oh dear.","Three sixes... too much luck.","From the beginning, then."],["Three sixes and I'm punished? Rude!","Back to start! I'll race back!","Too hot to handle!"],["I was afraid of that.","Back to the beginning. Calmly.","Three sixes is too many."]],
  near:[["Almost there.","Nearly home.","Just a few squares."],["Home stretch! Here I come!","Watch me finish!","Nearly there!"],["Careful now...","Don't look at the snakes.","Slowly, slowly..."]],
  otherBigSnake:[["Ouch, that's a long one.","Oh, bad luck!","That one hurt."],["Ha! Down you go!","See you at the bottom!","Bye bye!"],["Oh, poor thing.","That looked painful.","Careful out there."]],
  otherBigLadder:[["Nice climb.","Well played, dice.","Up they go."],["Hey! I wanted that ladder!","Lucky! My turn next.","No fair!"],["Hm. They're ahead now.","That's a worry.","A big ladder for them."]]
};
function line(b,kind,n){ var set=LINES[kind]; if(!set) return null; return pick(b,set[b.t]).replace("{n}",n==null?"":String(n)); }
/* react(G, ev) -> {s, text, mood} or null: at most one line per move, from a computer, never more than one move in two for the same seat */
function react(G,ev){
  try{
    if(!G||!ev||!ev.length) return null;
    var mover=-1, kind=null, n=null, len=0, i, e;
    for(i=0;i<ev.length;i++){
      e=ev[i];
      if(e.e==="roll") mover=e.s;
      else if(e.e==="ladder"){ kind=e.len>=20?"bigLadder":"ladder"; len=e.len; }
      else if(e.e==="snake"){ kind=e.len>=20?"bigSnake":"snake"; len=e.len; }
      else if(e.e==="stay"&&!e.cap){ kind="stay"; n=e.need; }   // (Leela's "past 72 is lost" is not an exact-number wait)
      else if(e.e==="restart") kind="restart";
      else if(e.e==="finish"&&e.place===1){ kind="win"; n=E.geo?E.geo(G).goal:100; }
    }
    if(mover<0) return null;
    if(!kind&&ev.some(function(x){ return x.e==="again"; })) kind="again";
    var gl=E.geo?E.geo(G).goal:100;
    if(!kind&&!G.players[mover].done&&G.players[mover].pos>=gl-10&&G.players[mover].pos<gl) kind="near";
    var speaker=-1;
    if(isCpu(G,mover)&&kind){
      var bm=brainOf(G,mover), chance={bigLadder:1,bigSnake:1,win:1,restart:1,stay:.45,ladder:.5,snake:.5,again:.4,near:.25}[kind];
      if(G.step-bm.said>=2||kind==="win"||kind==="bigLadder"||kind==="bigSnake") if(rnd(bm)<chance) speaker=mover;
    } else if((kind==="bigSnake"||kind==="bigLadder")&&len>=30){
      var cpus=[]; for(i=0;i<G.n;i++) if(i!==mover&&isCpu(G,i)&&!G.players[i].done) cpus.push(i);
      if(cpus.length){ var who=cpus[(G.step+mover)%cpus.length], bw=brainOf(G,who); if(rnd(bw)<.5){ speaker=who; kind=kind==="bigSnake"?"otherBigSnake":"otherBigLadder"; } }
    }
    if(speaker<0) return null;
    var b=brainOf(G,speaker); readMood(G,b); b.said=G.step;
    var t=line(b,kind,n); return t?{s:speaker,text:t,kind:kind,mood:b.mood,temper:TEMPER[b.t]}:null;
  }catch(e){ return null; }
}

/* ---------- learning across games (fun records; wins per temperament) ---------- */
function finish(G){
  try{
    if(!G||G.aiDone||!G.over) return;
    G.aiDone=true;
    var t=readTable(), any=false;
    for(var s=0;s<G.n;s++){
      if(!isCpu(G,s)) continue; any=true;
      var b=brainOf(G,s); t.plays[b.t]++; if(G.winner===s) t.wins[b.t]++;
    }
    if(G.stats.longestSlide&&G.stats.longestSlide.len>t.rec.slide) t.rec.slide=G.stats.longestSlide.len;
    if(G.stats.longestClimb&&G.stats.longestClimb.len>t.rec.climb) t.rec.climb=G.stats.longestClimb.len;
    t.rec.ladders+=G.stats.ladders; t.rec.snakes+=G.stats.snakes;
    t.games++; void any; writeTable(t);
  }catch(e){}
}
/* device records for the Victory screen: {games, slide, climb, ladders, snakes} */
function records(){ var t=readTable(); return {games:t.games,slide:t.rec.slide,climb:t.rec.climb,ladders:t.rec.ladders,snakes:t.rec.snakes}; }
function hasDecisions(){ return false; }

SN.Brain={NOTE:NOTE,SKILL:SKILL,TEMPER:TEMPER,KEY:KEY,LINES:LINES,stats:stats,decide:decide,baseline:baseline,think:think,react:react,finish:finish,records:records,
  setStore:setStore,readTable:readTable,brainOf:brainOf,observe:observe,readMood:readMood,eta:eta,hasDecisions:hasDecisions};
if(typeof module!=="undefined"&&module.exports) module.exports=SN.Brain;
})(typeof window!=="undefined"?window:globalThis);
