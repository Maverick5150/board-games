/* Trouble - the computer players' brain (step 10). Loaded by index.html (browser) or run inside the headless tournament (sandbox).
   Called from pickComputerMove(color, moves) at the same call point as the old scorer: choose() returns one of the legal moves
   it was given, or null, and the old scorer (oldPickMove, unchanged) is the fallback on null or any error.

   One brain per computer player: a plain object kept per game in ctx.brains[color] (its base temperament, its memory of who has
   bumped it, and what it has seen). Each turn the situation sets the mood: ahead on the track = reserved (protect the lead),
   behind = bold (bump the leader), close = balanced. The base temperament only tilts the weights a little.
   Every legal move is scored from the real board: a bump (more for the leader's and the most advanced peg), entering the finish lane,
   getting a peg out on a 6, progress, and the change in risk (a peg 1-6 spaces ahead of an opponent's peg, or of an opponent's start
   with a 6, is hit with chance = distinct distances / 6; the loss is the peg's progress plus a re-entry cost).
   A sanity filter then drops moves that land a peg where three or more distances threaten it without a bump or a finish.
   Learning across games: a small table in localStorage 'bg_ai_trouble' (versioned, bounded, safe to delete): the bump and threat
   weights drift toward the style that won on this device. Skill: "easy" | "normal" | "hard" (missing = normal). */
(function(g){
"use strict";
var KEY="bg_ai_trouble", VER=1, TRACK=28, LO=.7, HI=1.4, BASES=["balanced","bold","reserved"];
var SKILL={ easy:{noise:26, tw:.45, learn:false}, normal:{noise:0, tw:1, learn:true}, hard:{noise:0, tw:1, learn:true} };
// tuning constants (the tournament sweeps them): bw / tw = the bump and threat weight of each mood; riskK scales the risk term
var T={ P:{leadBump:20, advBump:10, ret:4, out:30, fin:45, finStep:4, prog:.6, reentry:15, sane:3, bumpBase:60, gap:15, riskK:1,
  advTo:0, bwBalanced:1, twBalanced:1, bwBold:1.3, twBold:.6, bwReserved:.9, twReserved:1.5, tiltB:.1, tiltR:.1}, stats:{calls:0, declined:0, errors:0, lastError:""} };
function moodW(mood){ var P=T.P; return mood==="bold"?{bw:P.bwBold,tw:P.twBold}:mood==="reserved"?{bw:P.bwReserved,tw:P.twReserved}:{bw:P.bwBalanced,tw:P.twBalanced}; }
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }

/* ---------- the per-device table ---------- */
function freshTable(){ return {v:VER,games:0,w:{bump:1,threat:1}}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w) return t;
    ["bump","threat"].forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    t.games=Math.max(0,Math.min(1e6,+d.games||0));
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- the board, read from the page's own state ---------- */
function absOf(ctx,c,d){ return (ctx.START[c]+d)%TRACK; }
function progOf(ctx,c){ var s=0; (ctx.pegs[c]||[]).forEach(function(d){ if(d!==null) s+=d+1; }); return s; }
function leaderOf(ctx){ var best=null, bv=-1; ctx.players.forEach(function(q){ var v=progOf(ctx,q); if(v>bv){ bv=v; best=q; } }); return best; }
// distinct roll distances (1..6) from which some opponent peg can hit a square; a peg at its own start counts as a 6 (it enters on a 6)
// skip = {q,k} of a peg that has been sent home by the move under test
function hitChance(ctx,me,sq,skip){
  var D={}, n=0;
  ctx.players.forEach(function(q){
    if(q===me) return;
    var st=ctx.START[q], dq=(sq-st+TRACK)%TRACK;
    (ctx.pegs[q]||[]).forEach(function(od,k){
      if(skip&&skip.q===q&&skip.k===k) return;
      if(od===null){ if(dq===0) D[6]=1; return; }
      if(od>27) return;
      var dist=dq-od; if(dist>=1&&dist<=6) D[dist]=1;
    });
  });
  for(var x in D) n++;
  return n/6;
}
// expected loss of our track pegs: each peg costs its progress plus a re-entry; a bumped peg's victim is skipped
function riskOf(ctx,me,pegsMine,skip){
  var r=0;
  pegsMine.forEach(function(d){ if(d===null||d>27) return; r+=hitChance(ctx,me,absOf(ctx,me,d),skip)*(d+T.P.reentry); });
  return r;
}
// the page's occupant of a track square, other than me (or null)
function victimAt(ctx,me,sq){
  for(var i=0;i<ctx.players.length;i++){ var q=ctx.players[i]; if(q===me) continue;
    for(var k=0;k<4;k++){ var d=ctx.pegs[q][k]; if(d!==null&&d<=27&&absOf(ctx,q,d)===sq) return {q:q,k:k,d:d}; } }
  return null;
}

/* ---------- one brain per computer ---------- */
function brainOf(ctx,c){
  if(!ctx.brains) ctx.brains={};
  var b=ctx.brains[c];
  if(!b){ b=ctx.brains[c]={ base:BASES[hash(c+"|"+(ctx.name||""))%3], bumps:0, bumpedBy:{}, last:null, games:0 }; }
  return b;
}
// observe: our pegs sent home since the last call were bumped by whoever now sits on that square
function observe(ctx,b,me){
  var now=ctx.pegs[me];
  if(b.last){
    b.last.forEach(function(d,k){
      if(d===null||d>27||now[k]!==null) return;
      var v=victimAt(ctx,me,absOf(ctx,me,d));   // the bumper now stands on that square
      if(v) b.bumpedBy[v.q]=(b.bumpedBy[v.q]||0)+1;
    });
  }
  b.last=now.slice();
}
// the mood reads the race: ahead = reserved, behind = bold, close = balanced
function moodOf(ctx,me){
  var mine=progOf(ctx,me), top=-1e9;
  ctx.players.forEach(function(q){ if(q!==me) top=Math.max(top,progOf(ctx,q)); });
  var gap=mine-top;
  return gap>T.P.gap?"reserved":gap<-T.P.gap?"bold":"balanced";
}

/* ---------- the move choice ---------- */
function scoreMove(ctx,b,me,mv,S,w,lead,risk0,noisy){
  var sc=0, bumped=null, fin=mv.to>=28;
  var mw=moodW(w.mood); var bw=mw.bw*w.bump*w.tilt.bw, tw=mw.tw*w.threat*S.tw*w.tilt.tw*T.P.riskK;
  if(mv.to<=27){
    var v=victimAt(ctx,me,absOf(ctx,me,mv.to));
    if(v){
      bumped=v;
      var val=T.P.bumpBase+v.d+(v.q===lead?T.P.leadBump:0)+(v.d>=20?T.P.advBump:0)+T.P.ret*Math.min(3,b.bumpedBy[v.q]||0);
      sc+=bw*val;
    }
  }
  if(fin) sc+=T.P.fin+(mv.to-28)*T.P.finStep;
  if(mv.from===null) sc+=T.P.out;
  var gain=mv.to-(mv.from===null?0:mv.from);
  sc+=T.P.prog*gain+T.P.advTo*mv.to;   // advTo: the old scorer's "run the furthest peg" term, kept as a tunable
  // risk after the move: the moved peg on its new square, and a bumped victim gone
  var mine=ctx.pegs[me].slice(); mine[mv.peg]=mv.to;
  var r1=riskOf(ctx,me,mine,bumped?{q:bumped.q,k:bumped.k}:null);
  sc-=tw*(r1-risk0);
  if(noisy&&S.noise) sc+=(ctx.rnd()-0.5)*S.noise;
  return {mv:mv, sc:sc, bump:!!bumped, fin:fin, exposure:mv.to<=27?distinctHits(ctx,me,absOf(ctx,me,mv.to),bumped):0};
}
function distinctHits(ctx,me,sq,victim){ return Math.round(hitChance(ctx,me,sq,victim?{q:victim.q,k:victim.k}:null)*6); }

function choose(ctx,opts){
  opts=opts||{};
  var moves=ctx.moves||[], me=ctx.color, dry=!!opts.dry;
  if(!moves.length) return null;
  var S=SKILL[ctx.skill]||SKILL.normal;
  var tbl=readTable(), b=brainOf(ctx,me);
  if(!dry) observe(ctx,b,me);
  var lead=leaderOf(ctx), mood=moodOf(ctx,me);
  var w={ mood:mood, bump:tbl.w.bump, threat:tbl.w.threat,
    tilt:{ bw: b.base==="bold"?1+T.P.tiltB:b.base==="reserved"?1-T.P.tiltR/2:1, tw: b.base==="reserved"?1+T.P.tiltR:b.base==="bold"?1-T.P.tiltB:1 } };
  var risk0=riskOf(ctx,me,ctx.pegs[me],null);
  var cands=moves.map(function(mv){ return scoreMove(ctx,b,me,mv,S,w,lead,risk0,!dry); });
  cands.sort(function(x,y){ return y.sc-x.sc; });
  for(var i=0;i<cands.length;i++){
    var c=cands[i];
    // sanity: a landing that three or more distinct rolls can hit, with no bump and no finish, is not a move that makes sense
    if(!c.bump && !c.fin && c.exposure>=T.P.sane) { T.stats.declined++; continue; }
    if(!dry){ if(c.bump) b.bumps++; }
    return c.mv;
  }
  return null;
}

/* after a game: the weights drift toward the style that won on this device; the seat's record is kept too */
function finish(ctx){
  try{
    if(!ctx||!ctx.brains||!ctx.winner) return;
    var t=readTable(), touched=false;
    Object.keys(ctx.brains).forEach(function(c){
      var b=ctx.brains[c], S=SKILL[ctx.skill]||SKILL.normal; if(!S.learn) return;
      var won=c===ctx.winner, bold=b.bumps>=2;
      if(bold) t.w.bump=clamp(t.w.bump+(won?.01:-.005),LO,HI); else t.w.threat=clamp(t.w.threat+(won?.01:-.005)*(b.bumps===0?1:.5),LO,HI);
      touched=true;
    });
    if(touched){ t.games++; writeTable(t); }
  }catch(e){ T.stats.errors++; T.stats.lastError=String(e&&e.stack||e); }
}

function pick(ctx,opts){
  T.stats.calls++;
  try{ return choose(ctx,opts); }
  catch(e){ T.stats.errors++; T.stats.lastError=String(e&&e.stack||e); return null; }
}

// which skills the brain plays (the rest keep the old scorer): see FIXES.md (step 10) for the 2-player proof
var API={ useFor:{easy:true, normal:false, hard:true}, P:T.P, SKILL:SKILL, moodW:moodW, stats:T.stats, KEY:KEY, VER:VER,
  choose:pick, finish:finish, observe:function(ctx,c){ var b=brainOf(ctx,c); observe(ctx,b,c); return b; },
  brainOf:brainOf, readTable:readTable, writeTable:writeTable, setStore:setStore, freshTable:freshTable,
  moodOf:moodOf, riskOf:riskOf, hitChance:hitChance, leaderOf:leaderOf, scoreMove:scoreMove };
if(typeof module!=="undefined"&&module.exports) module.exports=API; else g.TroubleBrain=API;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:this));
