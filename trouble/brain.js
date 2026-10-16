/* Trouble - the computer players' brain (step 10, second version). Loaded by index.html (browser) or run inside the headless
   tournament (sandbox). Called from pickComputerMove(color, moves) at the same call point as the old scorer: choose() returns one of
   the legal moves it was given, or null, and the old scorer (oldPickMove, unchanged) is the fallback on null or any error.

   How it thinks: a small expectimax over the die. For every legal move it plays the move on a copy of the board, then lets each
   opponent pop every die value (1-6, a 6 pops again) and answer the way a greedy player does (bump first, then finish, then bring a
   peg out, then run the furthest peg), and averages the boards that result. When our own roll was a 6 that earns another pop, it
   also tries every second pop (1-6) and our best answer to it before the opponents reply (two plies of our own).
   A board is valued as a race: pips travelled (a peg at home = 0, on its start = 6, one pip more per space), minus the rolls a player
   cannot use (no legal move for that die value: everything at home, or the finish needs an exact roll), plus the chance that our next
   pop bumps an opponent peg (times what that peg has travelled), minus the chance that their next pop bumps ours.
   The rules are read from the game: Hasbro 2022 (a 1 never moves and brings every other player's peg out, bumping whatever sits on
   their start; only one extra pop per turn) is played out inside the search, so the brain keeps off other players' start spaces and
   fills the finish from the far end so the last peg never needs a 1.
   Measured (seat-balanced tournament vs the old scorer, BG_audit/trouble/FIXES.md): 2 players Normal 57.7 % over 4000 games, Hard the
   same within noise (57.0 %; 60.7 % under Hasbro 2022), 3 players 38.1 % (fair 33.3), 4 players 26.4 % (fair 25). With 4 players under
   Hasbro 2022 the search measured no better than the old scorer, so there it hands the move to the old scorer (P.hm).
   One brain per computer (ctx.brains[color]): its temperament (balanced, bold or reserved) and memory of who has bumped it; the race
   sets the mood each turn (ahead = protect the lead, behind = take chances), a small tilt of the offence and defence weights.
   Learning across games: a small table in localStorage 'bg_ai_trouble' (versioned, bounded, safe to delete) nudges those two weights
   toward the style that won on this device. Skill: "easy" (one ply, noisy) | "normal" | "hard" (missing = normal). */
(function(g){
"use strict";
var KEY="bg_ai_trouble", VER=2, TRACK=28, MAXD=31, LO=.85, HI=1.15, BASES=["balanced","bold","reserved"], WIN=1000;
// tuning constants (the tournament sweeps them): kT / kR = weight of our next-pop threat / their next-pop risk; kW = cost of a roll
// we cannot use; fin = a peg safe in the finish; dead = a player whose last pegs can never move again (Hasbro 2022: they need a 1).
// Two players: an attacking style measured best (sprint/opus-b/trouble-brain); 3-4 players (...m): our next pop comes after two or
// three others have moved, so threats count less and risk more. lead = how much the leading opponent counts; mood = mood tilt;
// kT2 = the threat weight after our own extra pop (Hard, 2 players); ms = time guard per decision
var T={ P:{kT:2.5, kR:0, kW:25, fin:0, kTm:1, kRm:.35, kWm:12, finm:2, dead:60, lead:.5, mood:.1, tilt:.05, ret:.05,
  oppSix:1, six2:1, kT2:1, ms:35, hm:1},
  stats:{calls:0, declined:0, errors:0, lastError:"", evals:0, cut:0} };
// easy: one ply (no opponent replies), a risk weight (it cannot see the replies) and noise, no learning; normal: the search;
// hard: the search plus, with 2 players, our own next pop after the opponent's reply (myNext)
var SKILL={ easy:{noise:9, ply:1, learn:false, kR:.35}, normal:{noise:0, ply:2, learn:true}, hard:{noise:0, ply:2, learn:true, myNext:true} };
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function popc(m){ var n=0; while(m){ m&=m-1; n++; } return n; }

/* ---------- the per-device table ---------- */
function freshTable(){ return {v:VER,games:0,w:{bump:1,threat:1}}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w) return t;   // a table of the first brain (v1) is ignored
    ["bump","threat"].forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    t.games=Math.max(0,Math.min(1e6,+d.games||0));
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- the board as numbers: pos[i*4+k] = peg k of player i (-1 home, 0-27 track, 28-31 finish) ----------
   The same rules as the page's legalMovesFor / applyMove / resolveOne (the tournament checks them against the page's own). */
function G(ctx){   // the search's view of the game
  var pl=ctx.players, n=pl.length, S=[], pos=[], me=pl.indexOf(ctx.color), r=ctx.rules||{};
  for(var i=0;i<n;i++){ S.push(ctx.START[pl[i]]); for(var k=0;k<4;k++){ var d=ctx.pegs[pl[i]][k]; pos.push(d===null||d===undefined?-1:d); } }
  return {n:n, S:S, pos:pos, me:me, roll1:!!r.roll1, oneExtra:!!r.oneExtra, evals:0, memo:{}};
}
function ownAt(pos,i,d){ var b=i*4; return pos[b]===d||pos[b+1]===d||pos[b+2]===d||pos[b+3]===d; }
function victim(st,pos,i,to){   // index of the opponent peg on the square player i lands on (to 0-27), or -1
  if(to>27) return -1;
  var a=(st.S[i]+to)%TRACK;
  for(var j=0;j<st.n;j++){ if(j===i) continue; var s=st.S[j], b=j*4;
    for(var k=0;k<4;k++){ var p=pos[b+k]; if(p>=0&&p<=27&&(s+p)%TRACK===a) return b+k; } }
  return -1;
}
function legal(st,pos,i,r){   // [[k,to],...] in peg order, like legalMovesFor
  var out=[], b=i*4;
  for(var k=0;k<4;k++){ var d=pos[b+k];
    if(d<0){ if(r===6&&!ownAt(pos,i,0)) out.push([k,0]); continue; }
    var nd=d+r; if(nd>MAXD||ownAt(pos,i,nd)) continue; out.push([k,nd]); }
  return out;
}
function play(st,pos,i,k,to){ var q=pos.slice(), v=victim(st,pos,i,to); if(v>=0) q[v]=-1; q[i*4+k]=to; return q; }
function resolveOne(st,pos,i){   // Hasbro 2022: a 1 brings every other player's peg out (bumping whatever sits on their start)
  var q=pos.slice();
  for(var j=0;j<st.n;j++){ if(j===i) continue; var b=j*4, k=-1;
    for(var x=0;x<4;x++) if(q[b+x]<0){ k=x; break; }
    if(k<0||ownAt(q,j,0)) continue;
    var v=victim(st,q,j,0); if(v>=0) q[v]=-1; q[b+k]=0; }
  return q;
}
function won(pos,i){ var b=i*4; return pos[b]>=28&&pos[b+1]>=28&&pos[b+2]>=28&&pos[b+3]>=28; }
// a greedy opponent (the page's old scorer, which is also how most people play): bump, finish, come out, run the furthest peg
function greedy(st,pos,i,mvs){
  var best=null, bs=-1e9;
  for(var m=0;m<mvs.length;m++){ var k=mvs[m][0], to=mvs[m][1], from=pos[i*4+k], sc=0;
    var v=victim(st,pos,i,to); if(v>=0) sc+=100+pos[v];
    if(to>=28) sc+=40+to; if(from<0) sc+=30; sc+=to*.5;
    if(sc>bs){ bs=sc; best=mvs[m]; } }
  return best;
}

/* ---------- valuing a board (from player `me`'s side) ---------- */
// chance that attacker j bumps a peg on track square sq with its next pop (a 6 that pops again counts for 6 + x)
function hitP(st,pos,j,sq){
  var s=st.S[j], dq=(sq-s+TRACK)%TRACK, b=j*4, home=false, m1=0, m2=0;
  for(var k=0;k<4;k++){ var od=pos[b+k];
    if(od<0){ home=true; continue; }
    if(od>27) continue;
    var dist=dq-od; if(dist>=1&&dist<=6) m1|=1<<dist; else if(dist>=7&&dist<=12) m2|=1<<(dist-6); }
  if(home){ if(dq===0) m1|=64; else if(dq<=6) m2|=1<<dq; }
  if(st.roll1){ m1&=~2; m2&=~2; }   // Hasbro 2022: a 1 never moves
  var p=popc(m1)/6; if(!(m1&64)) p+=popc(m2)/36;
  if(st.roll1&&home&&dq===0) p+=1/6;  // somebody else's 1 brings j's peg out onto that square
  return p>1?1:p;
}
function wasteOf(st,pos,i){   // share of die values with no legal move (a 1 under Hasbro 2022 is the same for everyone: skipped)
  var b=i*4, n=0;
  for(var r=st.roll1?2:1;r<=6;r++){ var ok=false;
    for(var k=0;k<4&&!ok;k++){ var d=pos[b+k];
      if(d<0){ if(r===6&&!ownAt(pos,i,0)) ok=true; }
      else if(d+r<=MAXD&&!ownAt(pos,i,d+r)) ok=true; }
    if(!ok) n++; }
  return n;
}
function evalPos(st,pos,me,W){
  st.evals++;
  var P=T.P, n=st.n, mine=0, oSum=0, oMax=-1e9, o=0;
  if(won(pos,me)) return WIN;
  for(var i=0;i<n;i++){
    var b=i*4, pip=0, fin=0;
    for(var k=0;k<4;k++){ var d=pos[b+k]; if(d>=0) pip+=d+6; if(d>=28) fin++; }
    var wn=wasteOf(st,pos,i), v=pip-W.kW*wn/6+W.fin*fin;
    if(st.roll1&&wn===5&&fin<4) v-=P.dead;   // Hasbro 2022: no roll 2-6 can ever move it (until someone bumps a peg)
    if(i!==me&&won(pos,i)) v+=WIN;
    if(i===me) mine=v; else { oSum+=v; if(v>oMax) oMax=v; o++; }
  }
  var sc=mine-(o?(1-P.lead)*oSum/o+P.lead*oMax:0);
  // risk: their next pop on our track pegs; threat: our next pop on theirs
  var mb=me*4, risk=0, threat=0;
  for(var k2=0;k2<4;k2++){ var d2=pos[mb+k2]; if(d2<0||d2>27) continue;
    var sq=(st.S[me]+d2)%TRACK, safe=1;
    for(var j=0;j<n;j++) if(j!==me) safe*=1-hitP(st,pos,j,sq);
    risk+=(1-safe)*(d2+6); }
  for(var j2=0;j2<n;j2++){ if(j2===me) continue; var bb=j2*4, wj=W.ret[j2]||1;
    for(var k3=0;k3<4;k3++){ var d3=pos[bb+k3]; if(d3<0||d3>27) continue;
      threat+=wj*hitP(st,pos,me,(st.S[j2]+d3)%TRACK)*(d3+6); } }
  return sc+W.kT*threat-W.kR*risk;
}

/* ---------- the search ---------- */
// a board after the opponents' reply: with myNext (2 players) we also pop once more (every die value, our best answer)
function leaf(st,pos,me,W){
  if(!st.myNext||st.n!==2||!st.deep3) return evalPos(st,pos,me,W);
  if(won(pos,1-me)) return evalPos(st,pos,me,W);
  var W2=W.w2, sum=0;
  for(var r=1;r<=6;r++){ var v;
    if(st.roll1&&r===1) v=evalPos(st,resolveOne(st,pos,me),me,W2);
    else { var mv=legal(st,pos,me,r);
      if(!mv.length) v=evalPos(st,pos,me,W2);
      else { v=-1e9; for(var m=0;m<mv.length;m++){ var x=evalPos(st,play(st,pos,me,mv[m][0],mv[m][1]),me,W2); if(x>v) v=x; } } }
    sum+=v; }
  return sum/6;
}
// one opponent's pop from board pos: every die value, its greedy answer, and (6 = pops again) one more pop
function oppTurn(st,pos,j,me,W,deep){
  var sum=0;
  for(var r=1;r<=6;r++){
    var q;
    if(st.roll1&&r===1) q=resolveOne(st,pos,j);
    else { var mv=legal(st,pos,j,r); q=mv.length?(function(m){ return play(st,pos,j,m[0],m[1]); })(greedy(st,pos,j,mv)):pos; }
    if(r===6&&deep&&!won(q,j)){
      var s2=0;
      for(var r2=1;r2<=6;r2++){ var q2;
        if(st.roll1&&r2===1) q2=resolveOne(st,q,j);
        else { var mv2=legal(st,q,j,r2); q2=mv2.length?(function(m){ return play(st,q,j,m[0],m[1]); })(greedy(st,q,j,mv2)):q; }
        s2+=leaf(st,q2,me,W); }
      sum+=s2/6;
    } else sum+=leaf(st,q,me,W);
  }
  return sum/6;
}
// the board after our turn ends: our value plus each opponent's expected change (each one replies to this board)
function afterTurn(st,pos,me,W,ply,deep){
  if(won(pos,me)) return WIN*2;
  var key=pos.join(",")+(deep?"d":""); if(key in st.memo) return st.memo[key];
  st.deep3=deep;
  var base=evalPos(st,pos,me,W), v=base;
  if(ply>=2) for(var j=0;j<st.n;j++){ if(j===me) continue; v+=oppTurn(st,pos,j,me,W,deep)-base; }
  st.memo[key]=v; return v;
}
// our move to `pos`; `again` = this turn pops once more after it
function valueOf(st,pos,me,W,ply,again,streak){
  if(!again||won(pos,me)||ply<2||!T.P.six2) return afterTurn(st,pos,me,W,ply,!!T.P.oppSix);
  var sum=0;
  for(var r=1;r<=6;r++){
    var v;
    if(st.roll1&&r===1) v=afterTurn(st,resolveOne(st,pos,me),me,W,ply,false);
    else { var mv=legal(st,pos,me,r);
      if(!mv.length) v=afterTurn(st,pos,me,W,ply,false);
      else { v=-1e9; for(var m=0;m<mv.length;m++){ var x=afterTurn(st,play(st,pos,me,mv[m][0],mv[m][1]),me,W,ply,false); if(x>v) v=x; } } }
    sum+=v;
  }
  return sum/6;
}

/* ---------- one brain per computer ---------- */
function brainOf(ctx,c){
  if(!ctx.brains) ctx.brains={};
  var b=ctx.brains[c];
  if(!b){ b=ctx.brains[c]={ base:BASES[hash(c+"|"+(ctx.name||""))%3], bumps:0, bumpedBy:{}, last:null, games:0 }; }
  return b;
}
function absOf(ctx,c,d){ return (ctx.START[c]+d)%TRACK; }
function whoIsAt(ctx,me,sq){
  for(var i=0;i<ctx.players.length;i++){ var q=ctx.players[i]; if(q===me) continue;
    for(var k=0;k<4;k++){ var d=ctx.pegs[q][k]; if(d!==null&&d<=27&&absOf(ctx,q,d)===sq) return q; } }
  return null;
}
// observe: our pegs sent home since the last call were bumped by whoever now sits on that square
function observe(ctx,b,me){
  var now=ctx.pegs[me];
  if(b.last){ b.last.forEach(function(d,k){
    if(d===null||d>27||now[k]!==null) return;
    var q=whoIsAt(ctx,me,absOf(ctx,me,d)); if(q) b.bumpedBy[q]=(b.bumpedBy[q]||0)+1; }); }
  b.last=now.slice();
}
function progOf(ctx,c){ var s=0; (ctx.pegs[c]||[]).forEach(function(d){ if(d!==null) s+=d+6; }); return s; }
function leaderOf(ctx){ var best=null, bv=-1; ctx.players.forEach(function(q){ var v=progOf(ctx,q); if(v>bv){ bv=v; best=q; } }); return best; }
// the mood reads the race: ahead = reserved, behind = bold, close = balanced
function moodOf(ctx,me){
  var mine=progOf(ctx,me), top=-1e9;
  ctx.players.forEach(function(q){ if(q!==me) top=Math.max(top,progOf(ctx,q)); });
  var gap=mine-top; return gap>20?"reserved":gap<-20?"bold":"balanced";
}
function weights(ctx,b,me,S){
  var P=T.P, tbl=S.learn?readTable():freshTable(), mood=moodOf(ctx,me), m=P.mood, t=P.tilt, two=ctx.players.length<=2;
  var kT0=two?P.kT:P.kTm, kR0=S.kR!=null?S.kR:two?P.kR:P.kRm, kW=two?P.kW:P.kWm, fin=two?P.fin:P.finm;
  var kT=kT0*tbl.w.bump, kR=kR0*tbl.w.threat;
  if(mood==="bold"){ kT*=1+m; kR*=1-m; } else if(mood==="reserved"){ kT*=1-m; kR*=1+m; }
  if(b.base==="bold"){ kT*=1+t; kR*=1-t; } else if(b.base==="reserved"){ kT*=1-t; kR*=1+t; }
  var ret=[]; ctx.players.forEach(function(q,i){ ret[i]=1+P.ret*Math.min(3,b.bumpedBy[q]||0); });
  return {kT:kT, kR:kR, kW:kW, fin:fin, ret:ret, mood:mood, w2:{kT:P.kT2*kT/(kT0||1), kR:kR, kW:kW, fin:fin, ret:ret}};
}

/* ---------- the move choice ---------- */
function choose(ctx,opts){
  opts=opts||{};
  var moves=ctx.moves||[], me=ctx.color, dry=!!opts.dry;
  if(!moves.length) return null;
  var S=SKILL[ctx.skill]||SKILL.normal, b=brainOf(ctx,me);
  if(!dry) observe(ctx,b,me);
  if(moves.length===1) return moves[0];
  var st=G(ctx), W=weights(ctx,b,me,S), mi=st.me; if(mi<0) return null;
  // hm: 4 players under Hasbro 2022 keep the old scorer (the search measured no better than it there: BG_audit/trouble/FIXES.md)
  if(T.P.hm&&st.roll1&&st.n>3&&S.ply>=2) return null;
  var m0=moves[0], die=ctx.die||(m0.from===null?6:m0.to-m0.from), streak=ctx.sixStreak||(die===6?1:0);
  var again=die===6&&!(st.oneExtra&&streak>1);
  var ply=S.ply, best=null, bv=-1e18, t0=Date.now();
  st.myNext=!!S.myNext;
  for(var i=0;i<moves.length;i++){
    // time guard: a slow device keeps the best move found so far (the search takes ~1 ms on a laptop; 50 ms is the ceiling)
    if(i>0&&Date.now()-t0>T.P.ms){ T.stats.cut++; break; }
    var mv=moves[i], q=play(st,st.pos,mi,mv.peg,mv.to);
    var v=valueOf(st,q,mi,W,ply,again,streak);
    if(S.noise&&!dry) v+=(ctx.rnd()-0.5)*S.noise;
    if(v>bv){ bv=v; best=mv; }
  }
  T.stats.evals+=st.evals;
  if(best&&!dry){ var vv=victim(st,st.pos,mi,best.to); if(vv>=0) b.bumps++; }
  return best;
}

/* after a game: the two weights drift toward the style that won on this device (bounded 0.85-1.15) */
function finish(ctx){
  try{
    if(!ctx||!ctx.brains||!ctx.winner) return;
    var S=SKILL[ctx.skill]||SKILL.normal; if(!S.learn) return;
    var t=readTable(), touched=false;
    Object.keys(ctx.brains).forEach(function(c){
      var b=ctx.brains[c], won=c===ctx.winner, bold=b.bumps>=2;
      if(bold) t.w.bump=clamp(t.w.bump+(won?.004:-.002),LO,HI); else t.w.threat=clamp(t.w.threat+(won?.004:-.002),LO,HI);
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

// which skills the brain plays (the rest keep the old scorer): see BG_audit/trouble/FIXES.md (step 10, second brain) for the proof
var API={ useFor:{easy:true, normal:true, hard:true}, P:T.P, SKILL:SKILL, stats:T.stats, KEY:KEY, VER:VER,
  choose:pick, finish:finish, observe:function(ctx,c){ var b=brainOf(ctx,c); observe(ctx,b,c); return b; },
  brainOf:brainOf, readTable:readTable, writeTable:writeTable, setStore:setStore, freshTable:freshTable,
  moodOf:moodOf, leaderOf:leaderOf, _rules:{G:G, legal:legal, play:play, resolveOne:resolveOne, victim:victim, greedy:greedy, evalPos:evalPos} };
if(typeof module!=="undefined"&&module.exports) module.exports=API; else g.TroubleBrain=API;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:this));
