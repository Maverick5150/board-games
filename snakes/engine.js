/* SNAKES AND LADDERS — pure rules engine (no DOM). Node: module.exports = Snakes.Engine; browser: window.Snakes.Engine.
   Rules: BG_audit/games/snakes/RULES.md (researched 2026-10-16). Snakes and Ladders is a public-domain folk game; "Chutes and Ladders" is a
   Hasbro trademark, so ours is Snakes and Ladders with original art. The numbered positions of the ladders and snakes are rules, not art.
   Versions:
     Classic   - the British traditional game on the Victorian board (c.1900, Berrington Hall, transcribed from a photo): one die, the highest
                 roll starts (ties roll again), a 6 rolls again, the third 6 in a row is void and the turn passes [JAQ; BIG; WIK].
     American  - the 1943 layout (Milton Bradley; unchanged in 1952, 1978 and 2021): a 1-6 spinner, the highest spin starts (1978) or the
                 youngest player (2021 printing), one move a turn, no extra spins [HAS78; HAS21].
   Both: players start OFF the board next to square 1; a move ends on a ladder's foot = climb, on a snake's head = slide (only where a move
   ENDS counts; no chains exist); tokens share squares (no capture); 100 must be reached exactly, else the token stays put (the only finish
   printed on an official sheet); the first to 100 wins. Every other rule is a House switch, default off.
   Squares: 1..100, 0 = off the board. Grid: row r = floor((n-1)/10) from the bottom; col = (n-1)%10 on even rows, 9 - that on odd rows,
   so 100 is top left (cell()).
   State G is plain JSON (saves + Party); G.v is the save-shape version; the RNG state is G.rs (mulberry32, seedable, so tests replay exactly).
   The board in play is G.L ({"foot or head": end}), so a shuffled board is saved with the game.
   No decisions exist in any Version or House rule (RULES.md section 6): the only move is {t:"roll", s}. The roll happens in the engine,
   never on a phone. apply() returns events for the page to animate in order: roll, then move (one hop per square in path, a bounce hops
   forward to 100 and back), then ladder / snake as its own move, then finish / again / turn.
   snapshot(G, seat) = the public table (nothing is private in this game) + that seat's legal moves; the RNG state never leaves the engine.
   Every classic board (2026-10-16, RULES.md "Boards"): boards.js (Snakes.Catalogue) lists every documented board; o.board picks one (auto =
   the Version's own). A board's geometry comes from geo(G): end = its last square, goal = the winning square, play = its documented start /
   finish ("va72": start on 1, win by ending a move on 68, a count past 68 runs on to 72 whose snake (72 -> 51) takes it down and the count
   goes on [SM19]; "leela": Johari's need-a-6 entry, exact 68, nothing past 72 [JOH]) or our six-sided-die version of the Jaina rules
   ("jaina": a footprint lifts the token one row when a move ends on it, the top squares (85-90) are reached by the footprint on 80 or a
   ladder, a count past 84 turns back and 76's snake takes it down mid-count, as the Jaina manual says [JBRR]). Everything else = the Version.
   The Victorian and 1943 boards (and a shuffled board) take exactly the code path they always did: same events, same state, same saves. */
(function(g){
"use strict";
var S=g.Snakes=g.Snakes||{};
var VER=1, MINP=2, MAXP=4, MAXBIG=6, END=100;
var GEO100={id:"",end:100,goal:100,play:"",start:-1,need6:false,steps:null,turn:0,turnSnake:0};   // the 10 x 10 race (Victorian, 1943, shuffled)

/* ---------------- the boards (RULES.md 1.2 and 1.3) ---------------- */
var BOARDS={
  /* Layout B: the Victorian board: Globe Series "Kismet", c.1895 (V&A MISC.423-1981; the same design at Berrington Hall [VIC]): 8 ladders,
     13 snakes. The V&A copy shows the two ladder tops hidden under the dice cup at Berrington (54->93, 66->87), as transcribed (BOARDS.md).
     The virtue and vice words are printed on the squares; plain English, free to reuse. */
  vic:{id:"vic",name:"Victorian board (c.1895)",
    L:{8:26,21:82,43:77,50:91,54:93,62:96,66:87,80:100, 98:28,95:24,92:51,83:19,73:1,69:33,64:36,59:17,55:7,52:11,48:9,46:5,44:22},
    labels:{8:"Penitence",21:"Kindness",43:"Pity",50:"Obedience",54:"Forgiveness",62:"Faith",66:"Truthfulness",80:"Self-denial",
      98:"Avarice",95:"Pride",92:"Selfishness",83:"Anger",73:"Slander",69:"Cruelty",64:"Depravity",59:"Quarrelsomeness",55:"Dishonesty",
      52:"Frivolity",48:"Unpunctuality",46:"Covetousness",44:"Vanity"}},
  /* Layout A: the 1943 American layout: 9 ladders, 10 snakes (chutes). 47->26, not 48 (settled by the c.1952 photo and by reproducing
     Althoen et al.'s 35.8 / 39.2 expected spins exactly). */
  mb:{id:"mb",name:"American board (1943)",
    L:{1:38,4:14,9:31,21:42,28:84,36:44,51:67,71:91,80:100, 16:6,47:26,49:11,56:53,62:19,64:60,87:24,93:73,95:75,98:78},labels:{}}
};

/* ---------------- the catalogue (boards.js): every documented board, merged in when it is loaded ----------------
   The two built-in boards keep their own L and labels (saves and tests rely on them); the catalogue adds its facts as .info. */
if(typeof module!=="undefined"&&module.exports&&!S.Catalogue){ try{ S.Catalogue=require("./boards.js"); }catch(e){} }
var merged=false;
function ensure(){
  if(merged) return BOARDS; var C=S.Catalogue; if(!C||!C.list) return BOARDS; merged=true;
  C.list.forEach(function(b){ var e=BOARDS[b.id]; if(e) e.info=b; else BOARDS[b.id]={id:b.id,name:b.name,L:b.L,labels:b.labels||{},info:b}; });
  return BOARDS;
}
ensure();
/* the catalogue in its own order (grouped by era, oldest first); [] if boards.js did not load */
function catalogue(){ ensure(); var C=S.Catalogue; return C&&C.list?C.list.slice():[]; }
function infoOf(bd){ ensure(); var b=BOARDS[bd]; return b&&b.info?b.info:null; }
/* a board's geometry and its own documented rules (cached on the catalogue entry) */
function geoOf(bd){
  var i=infoOf(bd); if(!i||!i.play) return GEO100;
  if(i._geo) return i._geo;
  var gm={id:i.id,end:i.grid&&i.grid.kind==="cells"?90:i.squares,goal:i.goal,play:i.play,start:-1,need6:false,steps:null,turn:0,turnSnake:0};
  if(i.play==="va72") gm.start=1;
  if(i.play==="leela") gm.need6=true;
  if(i.play==="jaina"){ gm.steps=i.steps||{}; gm.turn=84; gm.turnSnake=76; gm.top=85; }
  return (i._geo=gm);
}
function geo(G){ return G&&G.bd&&G.bd!=="shuffle"?geoOf(G.bd):GEO100; }
function boardIds(){ ensure(); return Object.keys(BOARDS); }

/* ---------------- RNG (mulberry32, state in G.rs) ---------------- */
function rnd(G){ var t=(G.rs=(G.rs+0x6D2B79F5)>>>0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function rint(G,n){ return Math.floor(rnd(G)*n); }
/* one die (or a spin): tests may queue values in G.rig (never present in a real game) */
function die(G){ if(G.rig&&G.rig.length){ var v=+G.rig.shift(); if(!G.rig.length) delete G.rig; if(v>=1&&v<=6) return v|0; } return 1+rint(G,6); }

/* ---------------- options / versions ---------------- */
function defaultOpts(){
  return {
    version:"classic",
    board:"auto",       // auto = the Version's own board | any catalogue board id (boards.js) | shuffle (House: a random fair board)
    spinner:false,      // American: a 1-6 spinner (the same odds as a die; the page draws a spinner)
    first:"high",       // high (highest roll / spin starts, ties roll again) | youngest (American 2021 printing)
    youngest:-1,        // the seat of the youngest human when first = "youngest" (computers have no age; none = fall back to the spin)
    six:true,           // a 6 rolls again (Classic official [WIK; BIG]; American: House)
    threeStart:false,   // House: the third 6 in a row sends you back to the start (default [BIG]: the third 6 is void and the turn passes)
    finish:"stay",      // stay (official: exact roll to 100, else stay put) | bounce (House) | over (House: any roll reaching 100 wins)
    two:false,          // House: two dice, move the total
    start1:false,       // House: tokens begin on square 1 instead of off the board
    needSix:false,      // House: a token off the board enters only on a 6
    places:false,       // House: play on for places after the winner
    big:false           // House: 5-6 players (the official sheets stop at 4)
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) if(o[k]!==undefined&&d.hasOwnProperty(k)) d[k]=o[k]; return d; }
var VERSIONS=[
  {id:"classic",name:"Classic",tag:"Victorian board · one die · 6 rolls again",board:"vic",
    desc:"The traditional British game on a Victorian board (c.1895): 8 ladders and 13 snakes, virtues at the ladders and vices at the snakes. Highest roll starts. A 6 rolls again, but a third 6 in a row doesn't count. Reach 100 exactly.",
    opts:{spinner:false,first:"high",six:true},lock:["spinner","first","six"]},
  {id:"american",name:"American 1943",tag:"1943 layout · spinner · one move a turn",board:"mb",
    desc:"The American layout of 1943, still on the board today: 9 ladders and 10 snakes, a 1-6 spinner and one move a turn. Highest spin starts (1978 rules) or the youngest player (2021 rules). Reach 100 exactly.",
    opts:{spinner:true,first:"high",six:false},lock:["spinner"]}
];
/* [key, label, type, choices, house (1 = tag "House"), versions it applies to (null = all), minimum players, needs (a key that must be on)] */
var HOUSE=[
  ["first","Who starts","choice",[["high","Highest spin (1978)"],["youngest","Youngest player (2021)"]],0,["american"]],
  ["finish","Going past 100","choice",[["stay","Exact roll, else stay (official)"],["bounce","Bounce back by the extra"],["over","Any roll to 100 wins"]],1],
  ["six","6 rolls again","bool",null,1,["american"]],
  ["threeStart","Three 6s in a row: back to the start","bool",null,1,null,0,"six"],
  ["two","Two dice (a shorter game)","bool",null,1],
  ["start1","Start on square 1","bool",null,1],
  ["needSix","Need a 6 to start","bool",null,1],
  ["places","Play on for places","bool",null,1,null,3],
  ["board","Board","choice",[["auto","The Version's own board"],["vic","Victorian (c.1895)"],["mb","American (1943)"],["shuffle","Shuffled fair board"]],1],
  ["big","Big table: 5-6 players","bool",null,1]
];
var HDESC={
  first:"1978 rules: everyone spins and the highest starts. 2021 rules: the youngest player starts (pick who is youngest; computers have no age).",
  finish:"Official: you must reach 100 exactly; a roll that goes past it means you stay put. Bounce back: count the extra squares back down from 100 (snakes and ladders still count). Any roll to 100 wins: a faster finish.",
  six:"Bring the British rule to the American game: a 6 earns another roll.",
  threeStart:"Official Classic: a third 6 in a row doesn't count and the turn passes. This folk rule sends you back to the start instead.",
  two:"Roll two dice and move the total, for a shorter game. Rules about a 6 then mean a double 6. No two dice make 1, so an exact finish could strand a token on 99: with two dice, going past 100 bounces back or wins.",
  start1:"Every token begins on square 1 instead of off the board. On the American board this skips the ladder from 1.",
  needSix:"A token waiting off the board needs a 6 to enter. The 6 then moves it as usual.",
  places:"Keep playing after the winner until second, third and the rest are decided.",
  board:"Play the Version's rules on another real board (every documented board, with its year: Choose your board), or on a shuffled board with the same number of ladders and snakes, accepted only when its average length is within 10% of the real board's.",
  big:"The official rules are for 2 to 4 players. This lets 5 or 6 play."
};
function houseFor(h,version,n,o){
  if(h[5]&&h[5].indexOf(version)<0) return false;
  if(h[6]&&n&&n<h[6]) return false;
  if(h[7]&&o&&!o[h[7]]) return false;
  return true;
}
/* the rows the setup page should show for this version, player count and options (choices that can't apply are dropped) */
function houseRows(version,n,o){
  var out=[], gm=o?geoOf(boardOf(o)):GEO100;
  HOUSE.forEach(function(h){
    if(!houseFor(h,version,n,o)) return;
    var k=h[0];
    if(gm.play==="va72"||gm.play==="leela"){ if(k==="finish"||k==="start1"||k==="needSix") return; }   // the board's own documented start and finish
    if(gm.play==="leela"&&k==="two") return;                                                           // two dice could never land exactly past 68
    if(k==="needSix"&&o&&(o.two||o.start1)) return;
    if(k==="finish"&&o&&o.two) h=h.slice(0,3).concat([h[3].filter(function(c){ return c[0]!=="stay"; })],h.slice(4));
    out.push(h);
  });
  return out;
}
function versionOf(id){ for(var i=0;i<VERSIONS.length;i++) if(VERSIONS[i].id===id) return VERSIONS[i]; return null; }
function versionOpts(id,extra){
  var v=versionOf(id)||VERSIONS[0], o={version:v.id}, k;
  for(k in v.opts) o[k]=v.opts[k];
  for(k in (extra||{})) if(k!=="version") o[k]=extra[k];
  return mergeOpts(o);
}
function maxPlayers(o){ return o&&o.big?MAXBIG:MAXP; }
function normalize(o,n){
  var v=versionOf(o.version); if(!v){ o.version="classic"; v=VERSIONS[0]; }
  (v.lock||[]).forEach(function(k){ o[k]=v.opts[k]; });
  if(o.board!=="auto"&&o.board!=="shuffle"&&!(ensure()[o.board])) o.board="auto";   // an unknown board (or boards.js not loaded): the Version's own
  ["six","threeStart","two","start1","needSix","places","big","spinner"].forEach(function(k){ o[k]=!!o[k]; });
  if(o.first!=="youngest"||o.version!=="american") o.first="high";
  var y=Math.floor(+o.youngest); o.youngest=(o.first==="youngest"&&y>=0&&(!n||y<n))?y:-1;
  if(o.first==="youngest"&&o.youngest<0) o.first="high";               // nobody picked: fall back to the spin (RULES 7.4)
  if(["stay","bounce","over"].indexOf(o.finish)<0) o.finish="stay";
  if(o.two&&o.finish==="stay") o.finish="over";                         // two dice can't make 1: an exact finish could strand a token on 99
  if(o.two) o.spinner=false;                                            // two dice replace the spinner
  if(!o.six) o.threeStart=false;
  if(o.two||o.start1) o.needSix=false;                                  // nobody waits off the board with start1; two dice: see HDESC
  if(n&&n<3) o.places=false;                                            // 2 players: the game is decided by the first to 100
  if(n>MAXP) o.big=true;
  var gm=geoOf(boardOf(o));
  if(gm.play==="leela"){ o.two=false; o.needSix=false; o.start1=false; }   // Johari: one die, a 6 to enter (the board's own entry, not the House switch)
  if(gm.play==="va72"){ o.needSix=false; o.start1=false; }                 // everyone starts on square 1 (the board's own start)
  return o;
}
function boardOf(o){ var v=versionOf(o.version)||VERSIONS[0]; return (o.board&&o.board!=="auto"&&o.board!=="shuffle"&&ensure()[o.board])?o.board:v.board; }

/* ---------------- grid and movement ---------------- */
function cell(n){ if(!(n>=1&&n<=END)) return {row:0,col:-1}; var r=Math.floor((n-1)/10), c=(n-1)%10; return {row:r,col:r%2?9-c:c}; }
function startSq(o,gm){ gm=gm||GEO100; return gm.start>=0?gm.start:(o.start1?1:0); }
function dist(o){   // the roll distribution: [[total, probability]]
  if(!o.two) return [[1,1/6],[2,1/6],[3,1/6],[4,1/6],[5,1/6],[6,1/6]];
  var d=[]; for(var t=2;t<=12;t++) d.push([t,(6-Math.abs(t-7))/36]); return d;
}
/* where a roll of tot from pos ends: {path (every square hopped, in order), land, to (after a ladder / snake), jump, stay, bounce, over}.
   gm (geoOf) = the board's geometry; none = the 10 x 10 race. Boards with a mid-count jump add mid = {from, to, path (the squares hopped
   after it)}: the token hops path, takes that snake as its own move, then hops mid.path. A Jaina footprint is a ladder jump with step:true. */
function land(L,o,pos,tot,gm,back){
  gm=gm||GEO100;
  if(gm.play==="va72") return land72(L,o,pos,tot,gm);
  if(gm.play==="jaina") return landJaina(L,o,pos,tot,gm,back);
  var EN=gm.end, fin=gm.play==="leela"?"stay":o.finish;   // Leela: nothing past 72 [JOH]
  var path=[], t=pos+tot, i, r={path:path,land:pos,to:pos,jump:null,stay:false,bounce:false,over:false};
  if(t>EN){
    if(fin==="stay"){ r.stay=true; return r; }
    for(i=pos+1;i<=EN;i++) path.push(i);
    if(fin==="over"){ r.over=true; r.land=r.to=EN; return r; }
    var back=t-EN; for(i=1;i<=back;i++) path.push(EN-i);
    t=EN-back; r.bounce=true;
  } else for(i=pos+1;i<=t;i++) path.push(i);
  r.land=t; var j=L[t];
  if(j!=null){ r.to=+j; r.jump=+j>t?"ladder":"snake"; } else r.to=t;
  return r;
}
function jumpAt(r,L,gm,q){
  r.land=q; var j=L[q];
  if(j!=null){ r.to=+j; r.jump=+j>q?"ladder":"snake"; }
  else if(gm.steps&&gm.steps[q]!=null){ r.to=+gm.steps[q]; r.jump="ladder"; r.step=true; }   // a Jaina footprint: one row straight up
  else r.to=q;
  return r;
}
/* the 72-square Vaishnava chart [SM19]: the count runs on past the goal (68) to 72, whose snake (72 -> 51) takes the token down at once;
   the rest of the count goes on from the tail. Only a move that ENDS on 68 wins. */
function land72(L,o,pos,tot,gm){
  var r={path:[],land:pos,to:pos,jump:null,stay:false,bounce:false,over:false}, EN=gm.end, q=pos, cur=r.path, i;
  for(i=0;i<tot;i++){
    q=Math.min(q+1,EN); cur.push(q);
    if(q===EN&&L[EN]!=null&&+L[EN]<EN&&i<tot-1){ r.mid={from:q,to:+L[q],path:[]}; q=+L[q]; cur=r.mid.path; }
  }
  return jumpAt(r,L,gm,q);
}
/* the Jaina chart with a six-sided die (our version; RULES.md "Boards"): 1-84 is the track; a count that reaches 84 turns and walks back,
   and on the way back 76's snake takes the token down at once, the count going on forward from its tail [JBRR, SM19]; a token that stops
   on the way back keeps walking back next turn (back = true; players[s].back) until 76 takes it; the top squares 85-90 (reached by the
   footprint on 80 or a ladder) count on to liberation (90) under the Version's finish rule. r.back = still walking back after this move. */
function landJaina(L,o,pos,tot,gm,back){
  var r={path:[],land:pos,to:pos,jump:null,stay:false,bounce:false,over:false}, top=gm.top, GL=gm.goal, i, q, t;
  if(pos>=top){
    t=pos+tot;
    if(t>GL){
      if(o.finish==="stay"){ r.stay=true; return r; }
      for(i=pos+1;i<=GL;i++) r.path.push(i);
      if(o.finish==="over"){ r.over=true; r.land=r.to=GL; return r; }
      q=GL; for(i=t-GL;i>0;i--){ q=q===top?80:q-1; r.path.push(q); }   // below the first top square lies 80
      r.bounce=true; t=q;
    } else for(i=pos+1;i<=t;i++) r.path.push(i);
    return jumpAt(r,L,gm,t);
  }
  var dir=back&&pos>gm.turnSnake&&pos<gm.turn?-1:1, cur=r.path; q=pos;
  if(dir===-1) r.walkBack=true;
  for(i=0;i<tot;i++){
    if(dir===1){ if(q===gm.turn){ dir=-1; q--; r.bounce=true; r.turnAt=gm.turn; } else q++; }
    else q--;
    cur.push(q);
    if(dir===-1&&q===gm.turnSnake&&L[q]!=null&&+L[q]<q&&i<tot-1){ r.mid={from:q,to:+L[q],path:[]}; q=+L[q]; dir=1; cur=r.mid.path; }
  }
  jumpAt(r,L,gm,q);
  if(dir===-1&&!r.jump&&q>gm.turnSnake&&q<gm.turn) r.back=true;
  return r;
}

/* ---------------- exact expected length (absorbing Markov chain, RULES.md 5) ----------------
   E[p] = expected rolls from square p to the goal (100 on the race boards) for one token playing alone (extra rolls on a 6 are not
   modelled: each roll counts once, as in Althoen et al.). Solved as a linear system over every square but the goal (Gaussian elimination,
   about 1 ms). null = the goal can't be reached from somewhere. The table is indexed by square (the goal = 0). */
var ETC={};
/* the chain of a catalogue board: the states a token can reach from the start ([square, walking back]), each with its roll outcomes */
function chain(L,o,gm){
  var D=dist(o), need6=(o.needSix||gm.need6)&&!o.two, st=startSq(o,gm), S=[], ix={}, tr=[], i, k;
  function key(p,b){ return p+(b?"b":""); }
  function add(p,b){ var kk=key(p,b); if(ix[kk]==null){ ix[kk]=S.length; S.push([p,!!b]); } return ix[kk]; }
  add(st,false);
  for(i=0;i<S.length;i++){
    var p=S[i][0], b=S[i][1], out=[];
    if(p!==gm.goal){
      if(p===0&&need6){ out.push([add(0,false),5/6]); var r6=land(L,o,0,6,gm); out.push([r6.to===gm.goal?-1:add(r6.to,r6.back),1/6]); }
      else for(k=0;k<D.length;k++){ var r=land(L,o,p,D[k][0],gm,b), q=r.stay?p:r.to, qb=r.stay?b:!!r.back; out.push([q===gm.goal?-1:add(q,qb),D[k][1]]); }
    }
    tr.push(out);
  }
  return {S:S,ix:ix,tr:tr};
}
function expectTable(L,o,gm){
  gm=gm||GEO100;
  if(gm!==GEO100) return expectChain(L,o,gm);
  var key=JSON.stringify(L)+"|"+o.finish+"|"+!!o.two+"|"+!!o.needSix+"|"+!!o.start1+(gm===GEO100?"":"|"+gm.id);
  if(ETC[key]) return ETC[key];
  var EN=gm.end, GL=gm.goal, N=EN, D=dist(o), A=[], i, j, k, p, need6=(o.needSix||gm.need6)&&!o.two;
  function ix(q){ return q<GL?q:q-1; }   // every square but the goal (on a race board: 0..99, as before)
  for(i=0;i<N;i++){ A.push(new Float64Array(N+1)); }
  for(p=0;p<=EN;p++){
    if(p===GL) continue;
    var row=A[ix(p)]; row[ix(p)]+=1; row[N]=1;
    if(p===0&&need6){   // off the board: only a 6 enters (and moves 6)
      row[0]-=5/6; var q6=land(L,o,0,6,gm).to; if(q6!==GL) row[ix(q6)]-=1/6; continue;
    }
    for(k=0;k<D.length;k++){ var q=land(L,o,p,D[k][0],gm).to; if(q!==GL) row[ix(q)]-=D[k][1]; }
  }
  for(i=0;i<N;i++){
    var piv=i, best=Math.abs(A[i][i]);
    for(j=i+1;j<N;j++) if(Math.abs(A[j][i])>best){ best=Math.abs(A[j][i]); piv=j; }
    if(best<1e-12) return (ETC[key]=null);
    if(piv!==i){ var tmp=A[i]; A[i]=A[piv]; A[piv]=tmp; }
    var ri=A[i], inv=1/ri[i];
    for(j=i+1;j<N;j++){ var rj=A[j], f=rj[i]*inv; if(!f) continue; for(k=i;k<=N;k++) rj[k]-=f*ri[k]; }
  }
  var x=new Array(N+1); x[N]=0;
  for(i=N-1;i>=0;i--){ var s=A[i][N]; for(k=i+1;k<N;k++) s-=A[i][k]*x[k]; x[i]=s/A[i][i]; if(!isFinite(x[i])||x[i]<0) return (ETC[key]=null); }
  if(GL!==EN){ var out=new Array(EN+1); for(p=0;p<=EN;p++) out[p]=p===GL?0:x[ix(p)]; x=out; }
  var keys=Object.keys(ETC); if(keys.length>40) delete ETC[keys[0]];
  return (ETC[key]=x);
}
/* a catalogue board: solved over its reachable states; the table is indexed by square (forward), .back[square] = walking back (Jaina) */
function expectChain(L,o,gm){
  var key=JSON.stringify(L)+"|"+o.finish+"|"+!!o.two+"|"+!!o.needSix+"|"+!!o.start1+"|"+gm.id;
  if(ETC[key]!==undefined) return ETC[key];
  var C=chain(L,o,gm), N=C.S.length, A=[], i, j, k;
  for(i=0;i<N;i++){ var row=new Float64Array(N+1); row[i]+=1; row[N]=1; C.tr[i].forEach(function(t){ if(t[0]>=0) row[t[0]]-=t[1]; }); A.push(row); }
  for(i=0;i<N;i++){
    var piv=i, best=Math.abs(A[i][i]);
    for(j=i+1;j<N;j++) if(Math.abs(A[j][i])>best){ best=Math.abs(A[j][i]); piv=j; }
    if(best<1e-12) return (ETC[key]=null);
    if(piv!==i){ var tmp=A[i]; A[i]=A[piv]; A[piv]=tmp; }
    var ri=A[i], inv=1/ri[i];
    for(j=i+1;j<N;j++){ var rj=A[j], f=rj[i]*inv; if(!f) continue; for(k=i;k<=N;k++) rj[k]-=f*ri[k]; }
  }
  var x=new Array(N);
  for(i=N-1;i>=0;i--){ var s=A[i][N]; for(k=i+1;k<N;k++) s-=A[i][k]*x[k]; x[i]=s/A[i][i]; if(!isFinite(x[i])||x[i]<0) return (ETC[key]=null); }
  var out=new Array(gm.end+1); out.back={};
  for(i=0;i<=gm.end;i++) out[i]=i===gm.goal?0:Math.max(0,(gm.goal-i)/3.5);   // squares no token can rest on: a rough figure
  C.S.forEach(function(sv,n){ if(sv[1]) out.back[sv[0]]=x[n]; else out[sv[0]]=x[n]; });
  var keys=Object.keys(ETC); if(keys.length>40) delete ETC[keys[0]];
  return (ETC[key]=out);
}
function expected(L,o,gm){ var t=expectTable(L,o,gm); return t?t[startSq(o,gm)]:Infinity; }
/* how long a game on board bd runs under options o (the picker's "how long"): solo = expected rolls alone (exact), four = expected rounds
   until the first of 4 players finishes (sum of P(T > t)^4 from the survival curve), median = the median rolls alone. Cached. */
var LEN={};
function lengthOf(bd,o){
  ensure(); var b=BOARDS[bd]; if(!b) return null;
  o=o||defaultOpts(); var gm=geoOf(bd), key=bd+"|"+o.finish+"|"+!!o.two+"|"+!!o.needSix+"|"+!!o.start1;
  if(LEN[key]) return LEN[key];
  var C=chain(b.L,o,gm), N=C.S.length, cur=new Float64Array(N), alive=1, four=0, t=0, median=null, p, k; cur[0]=1;
  while(alive>1e-7&&t<5000){
    four+=Math.pow(alive,4); var nd=new Float64Array(N), won=0;
    for(p=0;p<N;p++){ var m=cur[p]; if(!m) continue; var a=C.tr[p]; for(k=0;k<a.length;k++){ if(a[k][0]<0) won+=m*a[k][1]; else nd[a[k][0]]+=m*a[k][1]; } }
    t++; alive-=won; cur=nd; if(median===null&&alive<=.5) median=t;
  }
  return (LEN[key]={solo:expected(b.L,o,gm),four:four,median:median});
}

/* ---------------- a shuffled fair board (House; RULES.md 5) ----------------
   The Version's counts of ladders and snakes; a ladder to 100 if the real board has one; no other end on 100; no chains or shared ends;
   no snake head on 1-6; every ladder and snake at least 5 squares long. Accepted only when the exact expected solo length (under the
   game's own rules) is within 10% of the real board's. Our own fairness test, so it stays House. */
function boardCheck(L){
  var err=[], ends={}, k, a, b;
  for(k in L){ a=+k; b=+L[k];
    if(!(a>=1&&a<END&&b>=1&&b<=END&&a===Math.floor(a)&&b===Math.floor(b)&&a!==b)) { err.push("bad jump "+k+"->"+L[k]); continue; }
    if(ends[a]||ends[b]) err.push("shared end at "+(ends[a]?a:b)); ends[a]=1; ends[b]=1;
  }
  for(k in L){ if(L[L[k]]!=null) err.push("chain "+k+"->"+L[k]+"->"+L[L[k]]); }
  return err;
}
function shuffleBoard(G){
  var base=BOARDS[boardOf(G.o)].L, o=G.o, nl=0, ns=0, top=false, k;
  for(k in base){ if(+base[k]>+k){ nl++; if(+base[k]===END) top=true; } else ns++; }
  var target=expected(base,o), bestL=null;
  var L, used;
  function free(x){ return x>=1&&x<END&&!used[x]; }
  function put(a,b){ L[a]=b; used[a]=1; used[b]=1; }
  for(var tries=0;tries<400;tries++){
    var ok=true, i, guard; L={}; used={};
    if(top){ guard=0; do{ var f0=60+rint(G,36); guard++; }while(!free(f0)&&guard<50); if(!free(f0)){ ok=false; } else { put(f0,END); used[END]=1; } }
    for(i=top?1:0;ok&&i<nl;i++){
      guard=0; var f, t;
      do{ f=1+rint(G,90); t=f+5+rint(G,58); guard++; }while((!free(f)||!free(t)||t>=END)&&guard<200);
      if(guard>=200){ ok=false; break; } put(f,t);
    }
    for(i=0;ok&&i<ns;i++){
      guard=0; var h, tl;
      do{ h=7+rint(G,93); tl=h-5-rint(G,68); guard++; }while((!free(h)||!free(tl)||tl<1)&&guard<200);
      if(guard>=200){ ok=false; break; } put(h,tl);
    }
    if(!ok||boardCheck(L).length) continue;
    var e=expected(L,o);
    if(isFinite(e)&&Math.abs(e-target)<=.1*target){ bestL=L; G.fair={e:+e.toFixed(2),target:+target.toFixed(2),tries:tries+1}; break; }
  }
  return bestL;
}

/* ---------------- helpers ---------------- */
function log(G,t,k,s){ G.log.push({t:t,k:k||"",s:s==null?-1:s,n:G.turn}); if(G.log.length>60) G.log.splice(0,G.log.length-60); }
function nm(G,s){ return G.players[s].name; }
function verb(G){ return G.o.spinner?"spun":"rolled"; }
function fail(msg){ return {ok:false,msg:msg,ev:[]}; }
function ord(n){ var s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function isSixRoll(G,d){ return G.o.two?(d[0]===6&&d[1]===6):d[0]===6; }
function unfinished(G){ var a=[]; for(var s=0;s<G.n;s++) if(!G.players[s].done) a.push(s); return a; }
function newStats(){ return {rolls:0,turns:0,sixes:0,ladders:0,snakes:0,climb:0,slide:0,maxClimb:0,maxSlide:0,misses:0,bounces:0,waits:0,restarts:0}; }

/* ---------------- who goes first (RULES.md 2.2 and 7.4) ----------------
   Classic: everyone rolls the die, highest starts, the tied players roll again [JAQ; BIG; DTG]. American 1978: the same with the spinner
   [HAS78]. American 2021: the youngest player starts [HAS21] (a human the page names; if nobody, the spin). One die / one spin even with the
   Two dice House rule (the official roll-off). Play then passes to the left: seat order. Returns the BGUI.firstPlayer.resolve shape. */
function rollOff(G){
  var who=[], rounds=[]; for(var s=0;s<G.n;s++) who.push(s);
  for(var guard=0;guard<60;guard++){
    var vals=who.map(function(){ return die(G); }), top=Math.max.apply(null,vals);
    rounds.push({who:who.slice(),vals:vals,top:top});
    var w=who.filter(function(x,i){ return vals[i]===top; });
    if(w.length===1) return {winner:w[0],rounds:rounds};
    who=w;
  }
  return {winner:who[0],rounds:rounds};
}
function firstPlayer(G){
  var f=G.fp||{};
  return {rule:f.rule,mode:f.rule==="youngest"?"none":(G.o.spinner?"spinner":"die"),spinner:!!G.o.spinner,winner:f.winner,rounds:(f.rounds||[]).map(function(r){ return {who:r.who.slice(),vals:r.vals.slice(),top:r.top}; }),
    why:f.rule==="youngest"?"American 2021 rules: the youngest player goes first, then play passes to the left."
      :G.o.spinner?"American 1978 rules: everyone spins and the highest spin starts; a tie spins again. Then play passes to the left."
      :"Classic rules: everyone rolls the die and the highest roll starts; a tie rolls again. Then play passes to the left."};
}

/* ---------------- a new game ---------------- */
function newGame(opts,players,seed){
  var n=(players||[]).length; if(n<MINP||n>MAXBIG) throw new Error("Snakes and Ladders is for 2 to 6 players.");
  var o=normalize(mergeOpts(opts),n), st=startSq(o,geoOf(boardOf(o)));
  var G={v:VER,id:"snakes",o:o,n:n,rs:(seed==null?Math.floor(Math.random()*4294967296):seed)>>>0,
    players:players.map(function(p,i){ return {name:String((p&&p.name)||("Player "+(i+1))),human:!!(p&&p.human),skill:(p&&p.skill)||null,color:(p&&p.color!=null)?String(p.color):null,
      pos:st,at:0,done:false,place:0,st:newStats()}; }),
    bd:"",L:{},labels:{},fair:null,fp:null,cur:0,sixes:0,turn:1,step:0,phase:"roll",over:false,winner:-1,fin:[],last:null,
    stats:{rolls:0,ladders:0,snakes:0,longestSlide:null,longestClimb:null,bounces:0,misses:0},log:[]};
  var b=boardOf(o), L=null;
  if(o.board==="shuffle"){ L=shuffleBoard(G); if(L){ G.bd="shuffle"; G.L=L; } }
  if(!L){ G.bd=b; G.L=JSON.parse(JSON.stringify(BOARDS[b].L)); G.labels=JSON.parse(JSON.stringify(BOARDS[b].labels));
    if(o.board==="shuffle") log(G,"No fair shuffled board turned up, so the "+BOARDS[b].name+" is used.","board"); }
  else log(G,"A shuffled board: "+Object.keys(L).length+" ladders and snakes, about "+Math.round(G.fair.e)+" rolls long alone (the real board: "+Math.round(G.fair.target)+").","board");
  if(o.first==="youngest"&&(!G.players[o.youngest]||!G.players[o.youngest].human)){ o.first="high"; o.youngest=-1; }
  if(o.first==="youngest"){ G.fp={rule:"youngest",winner:o.youngest,rounds:[]}; log(G,nm(G,o.youngest)+" is the youngest and goes first.","first",o.youngest); }
  else { var r=rollOff(G); G.fp={rule:o.spinner?"spin":"roll",winner:r.winner,rounds:r.rounds}; log(G,nm(G,r.winner)+" "+verb(G)+" highest and goes first.","first",r.winner); }
  G.cur=G.fp.winner;
  return G;
}

/* ---------------- the move API: the only move is {t:"roll", s} ---------------- */
function needList(G){ return G.over?[]:[G.cur]; }
function legal(G,s){ return (G&&!G.over&&s===G.cur&&G.players[s]&&!G.players[s].done)?[{t:"roll",s:s}]:[]; }
function defaultMove(G,s){ var L=legal(G,s==null?G.cur:s); return L[0]||null; }
function apply(G,m){
  if(!G||G.over) return fail("The game is over.");
  if(!m||typeof m!=="object"||Array.isArray(m)) return fail("No move.");
  for(var key in m) if(key!=="t"&&key!=="s") return fail("Unexpected '"+key+"' in the move.");   // the roll happens here, never on a phone
  if(m.t!=="roll") return fail("Roll the die.");
  var s=m.s; if(typeof s!=="number"||!G.players[s]) return fail("No such player.");
  if(s!==G.cur) return fail("It's "+nm(G,G.cur)+"'s turn.");
  var o=G.o, gm=geo(G), p=G.players[s], ev=[], d=o.two?[die(G),die(G)]:[die(G)], tot=d[0]+(d[1]||0), six=isSixRoll(G,d), from=p.pos, again=false, line;
  G.step++; p.st.rolls++; G.stats.rolls++; if(G.sixes===0) p.st.turns++;
  if(six) p.st.sixes++;
  var dtxt=o.two?d[0]+" + "+d[1]:String(tot);
  ev.push({e:"roll",s:s,d:d.slice(),tot:tot,spin:o.spinner,six:six});
  G.last={s:s,d:d.slice(),tot:tot,from:from,to:from,land:from,path:[],kind:"move",jump:null,step:G.step,turn:G.turn,six:six};
  if(o.six&&six) G.sixes++;
  if(o.six&&six&&G.sixes>=3){
    if(o.threeStart&&from!==startSq(o,gm)){
      var st=startSq(o,gm); p.pos=st; p.at=G.step; p.st.restarts++; delete p.back;
      ev.push({e:"restart",s:s,from:from,to:st});
      G.last.kind="restart"; G.last.to=st;
      log(G,nm(G,s)+" "+verb(G)+" a third 6 in a row: back to the start!","restart",s);
    } else {
      G.last.kind="void";
      ev.push({e:"void",s:s});
      log(G,nm(G,s)+" "+verb(G)+" a third 6 in a row: it doesn't count.","void",s);
    }
  } else if(from===0&&(o.needSix||gm.need6)&&!six){
    G.last.kind="wait"; p.st.waits++;
    ev.push({e:"wait",s:s,tot:tot});
    log(G,nm(G,s)+" "+verb(G)+" "+dtxt+": needs a 6 to start.","wait",s);
  } else {
    var r=land(G.L,o,from,tot,gm,p.back);
    if(r.stay){
      G.last.kind="stay"; p.st.misses++; G.stats.misses++;
      var sv={e:"stay",s:s,at:from,need:gm.end-from}; if(gm.goal!==gm.end) sv.cap=gm.end; ev.push(sv);
      log(G,nm(G,s)+" "+verb(G)+" "+dtxt+" on "+from+": "+(gm.goal!==gm.end?"past "+gm.end+" a throw is lost":"needs exactly "+(gm.end-from))+". Stays.","stay",s);
    } else {
      var full=r.path.slice(), mv={e:"move",s:s,from:from,path:r.path.slice(),to:r.path.length?r.path[r.path.length-1]:r.land,bounce:r.bounce};
      if(r.turnAt) mv.turnAt=r.turnAt;
      if(!r.mid) mv.to=r.land;
      ev.push(mv);
      line=nm(G,s)+" "+verb(G)+" "+dtxt+": "+(from||"start")+" → "+(r.bounce?(r.turnAt||gm.end)+", bounces back to "+(r.mid?r.mid.from:r.land):(r.mid?r.mid.from:r.land));
      if(r.bounce){ p.st.bounces++; G.stats.bounces++; }
      if(r.mid){   // a snake in the middle of the count (72 on the Indian charts, 76 on the way back on a Jaina chart): its own move, then the count goes on
        var ml=r.mid.from-r.mid.to;
        ev.push({e:"snake",s:s,from:r.mid.from,to:r.mid.to,len:ml,mid:true});
        p.st.snakes++; p.st.slide+=ml; if(ml>p.st.maxSlide) p.st.maxSlide=ml; G.stats.snakes++; if(!G.stats.longestSlide||ml>G.stats.longestSlide.len) G.stats.longestSlide={s:s,from:r.mid.from,to:r.mid.to,len:ml,turn:G.turn};
        line+=", snake down to "+r.mid.to+(r.mid.path.length?", on to "+r.land:"");
        if(r.mid.path.length) ev.push({e:"move",s:s,from:r.mid.to,path:r.mid.path.slice(),to:r.land,bounce:false,after:true});
        full=full.concat(r.mid.path); G.last.mid={from:r.mid.from,to:r.mid.to};
      }
      G.last.path=full; G.last.land=r.land; G.last.to=r.to; G.last.kind=r.bounce?"bounce":"move";
      if(r.jump){
        var len=Math.abs(r.to-r.land), rec={s:s,from:r.land,to:r.to,len:len,turn:G.turn}, je={e:r.jump,s:s,from:r.land,to:r.to,len:len};
        if(r.step) je.step=true;
        ev.push(je);
        G.last.jump=r.jump;
        if(r.jump==="ladder"){ p.st.ladders++; p.st.climb+=len; if(len>p.st.maxClimb) p.st.maxClimb=len; G.stats.ladders++; if(!G.stats.longestClimb||len>G.stats.longestClimb.len) G.stats.longestClimb=rec; line+=(r.step?", a footprint up to ":", ladder to ")+r.to+"!"; }
        else { p.st.snakes++; p.st.slide+=len; if(len>p.st.maxSlide) p.st.maxSlide=len; G.stats.snakes++; if(!G.stats.longestSlide||len>G.stats.longestSlide.len) G.stats.longestSlide=rec; line+=", snake down to "+r.to+"."; }
      } else line+=".";
      p.pos=r.to; p.at=G.step;
      if(gm.play==="jaina"){ if(r.back) p.back=true; else delete p.back; }   // a Jaina token stopped on the way back keeps walking back
      log(G,line,r.jump||"move",s);
      if(p.pos===gm.goal) finishSeat(G,s,ev);
    }
    again=o.six&&six&&!p.done;
  }
  if(!G.over){
    if(again){ ev.push({e:"again",s:s,sixes:G.sixes}); log(G,"6! "+nm(G,s)+" "+(o.spinner?"spins":"rolls")+" again.","again",s); }
    else nextTurn(G,ev);
  }
  return {ok:true,ev:ev};
}
function nextTurn(G,ev){
  G.sixes=0;
  for(var i=1;i<=G.n;i++){ var s=(G.cur+i)%G.n; if(!G.players[s].done){ G.cur=s; break; } }
  G.turn++; ev.push({e:"turn",s:G.cur});
}
function finishSeat(G,s,ev){
  var p=G.players[s]; p.done=true; G.fin.push(s); p.place=G.fin.length;
  var left=unfinished(G);
  ev.push({e:"finish",s:s,place:p.place});
  var gl=geo(G).goal;
  if(p.place===1) log(G,nm(G,s)+" reaches "+gl+" and wins!","win",s);
  else log(G,nm(G,s)+" reaches "+gl+": "+ord(p.place)+" place.","finish",s);
  if(!G.o.places||left.length<=1){
    if(G.o.places&&left.length===1){ var q=G.players[left[0]]; q.place=G.n; }
    G.over=true; G.phase="over"; G.winner=G.fin[0];
    ev.push({e:"over",winner:G.winner});
  }
}

/* ---------------- tension and hints for the page (RULES.md 7.2) ----------------
   left = squares to 100; outs = the totals that finish now; ahead = ladder feet and snake heads within one roll (the page pulses them). */
function hint(G,s){
  var p=G.players[s]; if(!p) return null;
  var o=G.o, gm=geo(G), D=dist(o), left=gm.goal-p.pos, outs=[], ahead=[], pFin=0;
  D.forEach(function(x){
    var r=land(G.L,o,p.pos,x[0],gm,p.back);
    if(p.pos===0&&(o.needSix||gm.need6)&&x[0]!==6) return;
    if(!r.stay&&r.to===gm.goal){ outs.push(x[0]); pFin+=x[1]; }
    if(!r.stay&&r.mid) ahead.push({at:r.mid.from,to:r.mid.to,kind:"snake",roll:x[0],mid:true});
    if(!r.stay&&r.jump) ahead.push({at:r.land,to:r.to,kind:r.jump,roll:x[0]});
  });
  var near=gm===GEO100?p.pos>=90:(p.pos>=gm.goal-10&&p.pos<gm.goal);
  return {s:s,pos:p.pos,left:left,outs:outs,pFinish:pFin,ahead:ahead,near:near,exact:gm.play==="va72"||gm.play==="leela"||o.finish==="stay",goal:gm.goal};
}

/* ---------------- standings: leader first ----------------
   Finished players by finishing order (official). The rest by their square (higher first; a tie goes to whoever reached it first): that
   is a table position, not an official placing (no source ranks them), so those rows carry table:true. With "Play on for places" the last
   player left is officially last. */
function standings(G){
  var rows=G.players.map(function(p,s){ return {s:s,name:p.name,human:p.human,color:p.color,pos:p.pos,done:p.done,at:p.at,fin:p.done?G.fin.indexOf(s):-1,table:!p.done,place:0}; });
  rows.sort(function(a,b){
    if(a.done!==b.done) return a.done?-1:1;
    if(a.done) return a.fin-b.fin;
    if(b.pos!==a.pos) return b.pos-a.pos;
    if(a.at!==b.at) return a.at-b.at;
    return a.s-b.s;
  });
  rows.forEach(function(r,i){
    var prev=rows[i-1];
    r.place=(prev&&!prev.done&&!r.done&&prev.pos===r.pos&&prev.at===r.at)?prev.place:i+1;
  });
  if(G.over&&G.o.places) rows.forEach(function(r){ r.table=false; });
  return rows;
}

/* ---------------- snapshot (Party phones; seat -1 = the TV): everything is public; the RNG state stays out ---------------- */
function snapshot(G,seat){
  var me=seat>=0&&G.players[seat]?seat:-1;
  var gm=geo(G), inf=infoOf(G.bd);
  return {v:G.v,id:"snakes",o:JSON.parse(JSON.stringify(G.o)),n:G.n,me:me,bd:G.bd,boardName:G.bd==="shuffle"?"Shuffled board":BOARDS[G.bd].name,
    board:{id:G.bd,cap:G.bd==="shuffle"?"Shuffled board":inf?inf.cap:BOARDS[G.bd].name,year:inf?inf.year:"",end:gm.end,goal:gm.goal,play:gm.play||"race",grid:inf&&G.bd!=="shuffle"?inf.grid:{kind:"rows",cols:10,rows:10},steps:gm.steps||null},
    L:JSON.parse(JSON.stringify(G.L)),labels:JSON.parse(JSON.stringify(G.labels)),fair:G.fair?JSON.parse(JSON.stringify(G.fair)):null,
    players:G.players.map(function(p,i){ var q={s:i,name:p.name,human:p.human,color:p.color,pos:p.pos,done:p.done,place:p.place,st:JSON.parse(JSON.stringify(p.st))}; if(p.back) q.back=true; return q; }),
    cur:G.cur,sixes:G.sixes,turn:G.turn,step:G.step,phase:G.phase,need:needList(G),first:firstPlayer(G),
    last:G.last?JSON.parse(JSON.stringify(G.last)):null,stats:JSON.parse(JSON.stringify(G.stats)),standings:standings(G),
    over:G.over,winner:G.winner,fin:G.fin.slice(),log:G.log.slice(-8).map(function(e){ return e.t; }),
    legal:me>=0?legal(G,me):[],hint:me>=0?hint(G,me):null,yourTurn:me>=0&&!G.over&&G.cur===me};
}

/* ---------------- invariants (tests, fuzz): [] = fine ---------------- */
function check(G){
  var err=[], o=G.o, s;
  if(G.v!==VER) err.push("save version");
  if(G.n!==G.players.length||G.n<MINP||G.n>maxPlayers(o)) err.push("player count "+G.n);
  var gm=geo(G), k, tgt={};
  if(G.bd==="shuffle"||G.bd==="vic"||G.bd==="mb"||!BOARDS[G.bd]){
    boardCheck(G.L).forEach(function(e){ err.push("board: "+e); });
    if(G.bd!=="shuffle"&&JSON.stringify(G.L)!==JSON.stringify(BOARDS[G.bd]?BOARDS[G.bd].L:null)) err.push("board changed");
  } else for(k in G.L){   // a catalogue board: real boards may share ends and chain (BOARDS.md); every end on the board, none from the goal
    var a=+k, b=+G.L[k]; tgt[b]=1;
    if(!(a>=1&&a<=gm.end&&b>=1&&b<=gm.end&&a!==b&&a!==gm.goal)) err.push("board: bad jump "+k+"->"+G.L[k]);
  }
  if(gm.steps) for(k in gm.steps) tgt[gm.steps[k]]=1;
  var finCount=0;
  G.players.forEach(function(p,i){
    if(!(p.pos>=0&&p.pos<=gm.end&&p.pos===Math.floor(p.pos))) err.push("seat "+i+" off the track: "+p.pos);
    if(p.pos===0&&(o.start1||gm.start>0)) err.push("seat "+i+" off the board with Start on 1");
    if((G.L[p.pos]!=null||(gm.steps&&gm.steps[p.pos]!=null))&&!(o.start1&&p.pos===1)&&!tgt[p.pos]) err.push("seat "+i+" resting on a ladder foot or snake head "+p.pos);
    if(p.done!==(p.pos===gm.goal)) err.push("seat "+i+" done="+p.done+" at "+p.pos);
    if(p.back!==undefined&&!(gm.play==="jaina"&&p.back===true&&p.pos>gm.turnSnake&&p.pos<gm.turn)) err.push("seat "+i+" walking back at "+p.pos);
    if(p.done){ finCount++; if(G.fin.indexOf(i)<0) err.push("finished seat "+i+" not in the order"); else if(p.place!==G.fin.indexOf(i)+1) err.push("place of "+i); }
  });
  if(finCount!==G.fin.length) err.push("finish order "+G.fin.length+" vs "+finCount);
  var left=unfinished(G).length;
  if(G.over){
    if(G.phase!=="over") err.push("over but phase "+G.phase);
    if(G.winner!==G.fin[0]) err.push("winner "+G.winner+" vs first home "+G.fin[0]);
    if(!G.fin.length) err.push("over with nobody home");
    if(o.places&&left>1) err.push("over with "+left+" still playing (places)");
  } else {
    if(G.phase!=="roll") err.push("bad phase "+G.phase);
    if(G.fin.length&&!o.places) err.push("someone finished but the game goes on");
    if(left<(o.places?2:G.n)) err.push("too few players left "+left);
    if(!G.players[G.cur]||G.players[G.cur].done) err.push("the turn is with a finished or missing seat "+G.cur);
    if(G.sixes<0||G.sixes>2||(!o.six&&G.sixes)) err.push("six count "+G.sixes);
  }
  var per=gm.play==="va72"||gm.play==="jaina"?2:1;   // a mid-count snake and the landing's own jump: two in one roll
  for(s=0;s<G.n;s++){ var st=G.players[s].st; if(st.ladders*1+st.snakes>st.rolls*per) err.push("stats of "+s); }
  return err;
}

S.Engine={VER:VER,MINP:MINP,MAXP:MAXP,MAXBIG:MAXBIG,END:END,BOARDS:BOARDS,VERSIONS:VERSIONS,HOUSE:HOUSE,HDESC:HDESC,houseFor:houseFor,houseRows:houseRows,
  defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOf:versionOf,versionOpts:versionOpts,normalize:normalize,maxPlayers:maxPlayers,boardOf:boardOf,
  cell:cell,startSq:startSq,dist:dist,land:land,expectTable:expectTable,expected:expected,boardCheck:boardCheck,
  catalogue:catalogue,infoOf:infoOf,geoOf:geoOf,geo:geo,lengthOf:lengthOf,boardIds:boardIds,GEO100:GEO100,
  newGame:newGame,legal:legal,apply:apply,need:needList,defaultMove:defaultMove,firstPlayer:firstPlayer,hint:hint,standings:standings,snapshot:snapshot,check:check,
  ord:ord,_rnd:rnd,_rollOff:rollOff};
if(typeof module!=="undefined"&&module.exports) module.exports=S.Engine;
/* browsers: bring in the brain right after this file (the page and the Party pages all load engine.js); a failed load = computers just roll */
if(typeof document!=="undefined"&&document.currentScript&&document.currentScript.src&&document.readyState==="loading"&&!S.Brain){
  try{ document.write('<script src="'+document.currentScript.src.replace(/engine\.js(\?.*)?$/,"brain.js")+'"><\/script>'); }catch(e){}
}
})(typeof window!=="undefined"?window:globalThis);
