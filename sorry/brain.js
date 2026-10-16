/* Sorry! - the computer players' brain (step 10). Loaded by index.html (browser) or run inside the headless tournament (sandbox).
   Called from pickComputerMove(color, acts) at the same call point as the old scorer: choose(ctx) returns one of the legal actions
   it was given, or null, and the old scorer (scoreAction, unchanged) is the fallback on null or any error.

   ctx (built by the page's brainCtx): color, skill ("easy" | "normal" | "hard"; missing = normal), name, brains (one brain per computer
   per game, kept in ctx.brains[color]), rnd, players (colours in the game), pawns (every pawn {color,id,loc}), moves ([{a, after}] where
   a is the page's legal action and after is a Map pawn -> loc: the board after it, the page's own dry run), geo {START_EXIT, SAFE_ENTRY, SLIDES}.

   One brain per computer: base temperament (balanced, bold or reserved) and its memory (who has sent its pegs home). Each turn the race sets
   the mood: ahead = reserved (protect the lead, avoid risk), behind = bold (bump, take chances), close = balanced.
   Every legal action is scored from the real board after it: progress, leaving Start, home, safety-zone entry, slides, bumps (more for
   the leader's most advanced pawn and for retaliation against whoever bumped us), the change in risk (a pawn is hit with chance =
   the cards that can land on it / 45, times its progress plus a re-entry cost), and the cost of moves that send an opponent's pawn
   forward. Sanity filter (evalMove): never send our own pawn home; an 11 swap only when it gains; no landing that 3+ card values can hit,
   unless the move bumps a pawn or reaches Home. Learning across games: a small table in localStorage 'bg_ai_sorry'
   (versioned, bounded, safe to delete): two weights drift toward the style that won on this device. */
(function(g){
"use strict";
var KEY="bg_ai_sorry", VER=1, LO=.7, HI=1.4, BASES=["balanced","bold","reserved"], HOME=65, DECK=45;
var FWD=[1,2,3,5,7,8,10,11,12];                       // cards that move a pawn forward (a 7 counts as a whole 7 here)
var CNT={1:5,2:4,3:4,4:4,5:4,7:4,8:4,10:4,11:4,12:4};   // the deck (45): Sorry! has 4 more
var BIT={1:1,2:2,3:4,4:8,5:16,7:32,8:64,10:128,11:256,12:512}, SORRY=1024;
// tuning constants (the tournament sweeps them): bw / tw = the bump and risk weight of each mood
var T={ P:{prog:.6, out:30, fin:50, safe:10, slide:14, own:260, vb:40, vprog:.5, lead:30, ret:4, opp:.4, reentry:10, sane:3,
  gap:15, riskK:1, tiltB:.1, tiltR:.1,
  bwBalanced:1, twBalanced:1, bwBold:1.3, twBold:.6, bwReserved:.9, twReserved:1.5},
  stats:{calls:0, declined:0, errors:0, lastError:""} };
// easy: noise and a lighter risk weight, no learning (beatable); normal: the brain as measured; hard: a heavier risk weight, learning
var SKILL={ easy:{noise:100, tw:.6, learn:false}, normal:{noise:0, tw:1, learn:true}, hard:{noise:0, tw:1.3, learn:true} };
var geo=null, memo=null;
function moodW(mood){ var P=T.P; return mood==="bold"?{bw:P.bwBold,tw:P.twBold}:mood==="reserved"?{bw:P.bwReserved,tw:P.twReserved}:{bw:P.bwBalanced,tw:P.twBalanced}; }
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function popc(m){ var n=0; while(m){ m&=m-1; n++; } return n; }

/* ---------- the per-device table ---------- */
function freshTable(){ return {v:VER,games:0,w:{bump:1,risk:1}}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w) return t;
    ["bump","risk"].forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    t.games=Math.max(0,Math.min(1e6,+d.games||0));
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }

/* ---------- the board (plain walks, the page's own rules: stepFwd / stepBack) ---------- */
function stepL(c,L,dir){
  if(L.t==='ring'){
    if(dir>0){ if(L.i===geo.SAFE_ENTRY[c]) return {t:'safe',j:0}; return {t:'ring',i:(L.i+1)%60}; }
    return {t:'ring',i:(L.i+59)%60};
  }
  if(L.t==='safe'){
    if(dir>0) return L.j<4 ? {t:'safe',j:L.j+1} : {t:'home'};
    return L.j>0 ? {t:'safe',j:L.j-1} : {t:'ring',i:geo.SAFE_ENTRY[c]};
  }
  return null;
}
function walk(c,L,n,dir){ var cur=L; for(var s=0;s<n;s++){ cur=stepL(c,cur,dir); if(!cur) return null; } return cur; }
function sameL(a,b){ if(a.t!==b.t) return false; if(a.t==='ring') return a.i===b.i; if(a.t==='safe') return a.j===b.j; return true; }
// progress: start -1, the squares travelled from the Start exit (0) to the safety entrance (58), safety 60-64, home 65
function pr(c,L){
  if(L.t==='start') return -1;
  if(L.t==='home') return HOME;
  if(L.t==='safe') return 60+L.j;
  return 58-((geo.SAFE_ENTRY[c]-L.i+60)%60);
}
function slideAt(i){ var S=geo.SLIDES; for(var k=0;k<S.length;k++) if(S[k].cells[0]===i) return S[k]; return null; }
function slideEnd(i,c){ var S=geo.SLIDES; for(var k=0;k<S.length;k++) if(S[k].color!==c && S[k].cells[S[k].cells.length-1]===i) return S[k]; return null; }
// the ring squares a pawn of colour c takes when it ends on ring square D (a slide of another colour takes every cell of its triangle)
function cellsOf(D,c){ if(D.t!=='ring') return null; var sl=slideAt(D.i); if(sl&&sl.color!==c) return sl.cells; return [D.i]; }
// everything an opponent pawn on L can land on with one card (memoised per decision: the same pawn is asked about by every move)
function landsOf(c,L){
  var key=c+L.t+(L.t==='ring'?L.i:L.j), hit=memo.get(key); if(hit) return hit;
  var out=[], k, D;
  for(k=0;k<FWD.length;k++){ D=walk(c,L,FWD[k],1); if(D&&D.t==='ring') out.push({card:FWD[k], cells:cellsOf(D,c)}); }
  D=walk(c,L,4,-1); if(D&&D.t==='ring') out.push({card:4, cells:cellsOf(D,c)});
  D=walk(c,L,1,-1); if(D&&D.t==='ring') out.push({card:10, cells:cellsOf(D,c)});   // a 10 moves back 1
  memo.set(key,out); return out;
}
// the cards (bit mask; SORRY = some opponent has a pawn in Start and can bring it out on any track pawn) that can land on ring square m
function threatMask(after,me,pawns,m){
  var mask=0;
  for(var k=0;k<pawns.length;k++){
    var o=pawns[k]; if(o.color===me) continue;
    var L=after?(after.get(o)||o.loc):o.loc;
    if(L.t==='start'){ mask|=SORRY; if(m===geo.START_EXIT[o.color]) mask|=BIT[1]|BIT[2]; continue; }
    if(L.t!=='ring'&&L.t!=='safe') continue;
    var lst=landsOf(o.color,L);
    for(var e=0;e<lst.length;e++){ if(lst[e].cells.indexOf(m)>=0) mask|=BIT[lst[e].card]; }
  }
  return mask;
}
function chanceOf(mask){ var s=0; for(var v in BIT) if(mask&BIT[v]) s+=CNT[v]; if(mask&SORRY) s+=4; return s/DECK; }
// expected loss of our track pawns: each one costs its progress plus a re-entry, times the chance an opponent's card lands on it
function riskOf(after,me,pawns){
  var r=0;
  for(var k=0;k<pawns.length;k++){ var p=pawns[k]; if(p.color!==me) continue;
    var L=after?(after.get(p)||p.loc):p.loc; if(L.t!=='ring') continue;
    r+=chanceOf(threatMask(after,me,pawns,L.i))*(pr(me,L)+T.P.reentry); }
  return r;
}
function totals(pawns){ var t={}; pawns.forEach(function(p){ var v=Math.max(0,pr(p.color,p.loc)); t[p.color]=(t[p.color]||0)+v; }); return t; }
// the mood reads the race: ahead = reserved, behind = bold, close = balanced
function moodOf(me,pawns,players){
  var t=totals(pawns), top=-1e9;
  players.forEach(function(q){ if(q!==me) top=Math.max(top,t[q]||0); });
  var gap=(t[me]||0)-top;
  return gap>T.P.gap?"reserved":gap<-T.P.gap?"bold":"balanced";
}
// the key of the most advanced pawn of the leading colour (a bump on it is worth more)
function topKeyOf(pawns,players){
  var t=totals(pawns), lead=null, lv=-1;
  players.forEach(function(q){ if((t[q]||0)>lv){ lv=t[q]||0; lead=q; } });
  var best=null, bp=-1e9;
  pawns.forEach(function(p){ if(p.color!==lead||p.loc.t==='start'||p.loc.t==='home') return; var v=pr(p.color,p.loc); if(v>bp){ bp=v; best=p.color+p.id; } });
  return best;
}

/* ---------- one brain per computer ---------- */
function brainOf(ctx,c){
  if(!ctx.brains) ctx.brains={};
  var b=ctx.brains[c];
  if(!b){ b=ctx.brains[c]={ base:BASES[hash(c+"|"+(ctx.name||""))%3], bumps:0, retal:{}, last:null, games:0 }; }
  return b;
}
// observe: our pawns sent home since the last call were bumped by whoever now sits on that square
function observe(ctx,b,me){
  var now={};
  ctx.pawns.forEach(function(p){ if(p.color===me) now[p.color+p.id]=p.loc; });
  if(b.last){
    ctx.pawns.forEach(function(p){
      if(p.color!==me) return;
      var was=b.last[p.color+p.id], isNow=now[p.color+p.id];
      if(!was||was.t!=='ring'||!isNow||isNow.t!=='start') return;
      var o=null; ctx.pawns.forEach(function(q){ if(q.color!==me&&q.loc.t==='ring'&&q.loc.i===was.i) o=q; });
      if(o) b.retal[o.color]=(b.retal[o.color]||0)+1;
    });
  }
  b.last=now;
}

/* ---------- the move choice ---------- */
function evalMove(mv,me,pawns,risk0,w,S,topKey,b){
  var after=mv.after, sc=0, kills=0, own=false, fin=false, mineGain=0, maxExp=0, oppChange=0;
  var P=T.P, mw=moodW(w.mood), bw=mw.bw*w.bump*w.tilt.bw, tw=mw.tw*w.risk*S.tw*w.tilt.tw*P.riskK;
  for(var k=0;k<pawns.length;k++){
    var p=pawns[k], a=after.get(p)||p.loc, bl=p.loc;
    if(sameL(a,bl)) continue;
    if(p.color===me){
      if(a.t==='start'){ own=true; sc-=P.own; continue; }
      var gain=pr(me,a)-pr(me,bl);
      sc+=P.prog*gain; mineGain+=gain;
      if(bl.t==='start') sc+=P.out;
      if(a.t==='home'){ fin=true; sc+=P.fin; }
      if(a.t==='safe'&&bl.t!=='safe') sc+=P.safe;
      if(a.t==='ring'){
        if(slideEnd(a.i,me)) sc+=P.slide;
        var ex=popc(threatMask(after,me,pawns,a.i)&~SORRY); if(ex>maxExp) maxExp=ex;
      }
    } else if(a.t==='start'&&bl.t!=='start'){
      kills++;
      var v=P.vb+Math.max(0,pr(p.color,bl))*P.vprog+((p.color+p.id)===topKey?P.lead:0)+P.ret*Math.min(3,b.retal[p.color]||0);
      sc+=bw*v;
    } else {
      oppChange+=pr(p.color,a)-pr(p.color,bl);   // an opponent's pawn moved (a swap): its gain is our loss
    }
  }
  sc-=P.opp*oppChange;
  var rk=riskOf(after,me,pawns);
  sc-=tw*(rk-risk0);
  // sanity: never send our own pawn home; an 11 swap only when it gains; a landing 3+ card values can hit, with no bump, no Home, is declined
  var decline= own || (mv.a.k==='swap'&&mineGain<=0) || (!kills&&!fin&&maxExp>=P.sane);
  return {mv:mv, sc:sc, decline:decline, kills:kills, fin:fin, exposure:maxExp};
}

function choose(ctx,opts){
  opts=opts||{};
  var moves=ctx.moves||[], me=ctx.color, dry=!!opts.dry;
  if(!moves.length) return null;
  geo=ctx.geo; memo=new Map();
  var S=SKILL[ctx.skill]||SKILL.normal, pawns=ctx.pawns, players=ctx.players;
  var tbl=readTable(), b=brainOf(ctx,me);
  if(!dry) observe(ctx,b,me);
  var mood=moodOf(me,pawns,players), topKey=topKeyOf(pawns,players);
  var w={ mood:mood, bump:tbl.w.bump, risk:tbl.w.risk,
    tilt:{ bw: b.base==="bold"?1+T.P.tiltB:b.base==="reserved"?1-T.P.tiltR/2:1, tw: b.base==="reserved"?1+T.P.tiltR:b.base==="bold"?1-T.P.tiltB:1 } };
  var risk0=riskOf(null,me,pawns);
  var cands=moves.map(function(mv){ return evalMove(mv,me,pawns,risk0,w,S,topKey,b); });
  if(!dry&&S.noise) cands.forEach(function(c){ c.sc+=(ctx.rnd()-0.5)*S.noise; });
  var best=null;
  cands.forEach(function(c){
    if(c.decline){ if(!dry) T.stats.declined++; return; }
    if(!best||c.sc>best.sc) best=c;
  });
  if(!best) return null;
  if(!dry&&best.kills) b.bumps++;
  return best.mv.a;
}

/* after a game: the weights drift toward the style that won on this device; a computer's record is kept too */
function finish(ctx){
  try{
    if(!ctx||!ctx.brains||!ctx.winner) return;
    var t=readTable(), touched=false;
    Object.keys(ctx.brains).forEach(function(c){
      var b=ctx.brains[c], S=SKILL[ctx.skill]||SKILL.normal; if(!S.learn) return;
      var won=c===ctx.winner, bold=b.bumps>=2;
      if(bold) t.w.bump=clamp(t.w.bump+(won?.01:-.005),LO,HI); else t.w.risk=clamp(t.w.risk+(won?.01:-.005)*(b.bumps===0?1:.5),LO,HI);
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

// which skills the brain plays (the rest keep the old scorer): all three, after the 2-player proof (sorry/FIXES.md, step 10)
var API={ useFor:{easy:true, normal:true, hard:true}, P:T.P, SKILL:SKILL, moodW:moodW, stats:T.stats, KEY:KEY, VER:VER,
  choose:pick, finish:finish, brainOf:brainOf, readTable:readTable, writeTable:writeTable, setStore:setStore, freshTable:freshTable,
  moodOf:moodOf, riskOf:riskOf, threatMask:threatMask, topKeyOf:topKeyOf, chanceOf:chanceOf };
if(typeof module!=="undefined"&&module.exports) module.exports=API; else g.SorryBrain=API;
})(typeof window!=="undefined"?window:(typeof globalThis!=="undefined"?globalThis:this));
