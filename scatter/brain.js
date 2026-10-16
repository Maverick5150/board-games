/* Scattergories — the computer players' brain (step 10). Loaded after engine.js (index.html; tests: require()).
   Called from Sc.Engine.cpuFillAll at the same call point as the old code: the answers come from the bank (bank.js, the answers per letter).

   One brain per computer player: plain data in G.ai.b[playerId] (saved with the game; old saves get fresh brains). Each has its own
   temperament (balanced / bold / reserved), its own memory of what the others wrote in earlier rounds (classic rounds reuse the same
   list) and its own jitter on the weights. Every turn it reads the standings and moves between the three moods; the mood moves only the
   fill bar (behind = fill more categories, ahead = play safe). Every candidate answer is worth the points it can still score:
   (1 - chance another player writes the same answer) x the points the house rule gives it (2 for a repeated letter under the 2023 rule).
   Then a sanity filter checks every answer (starts with the letter, never twice on one sheet, never one the vote threw out on this device);
   a rejected answer is left blank, and if the brain throws the old code answers for that player.
   Learning across games: a small table in localStorage 'bg_ai_scatter' (versioned, bounded, safe to delete): two weights, and the answers
   the vote threw out on this device (a computer then votes no and challenges them). Easy does not learn.
   Skill: G.o.cpuSkill = easy | normal | hard (missing = normal). p.skill lets a test seat its own skill; p.oldAI = true makes a seat play the old code. */
(function(g){
"use strict";
var Sc=g.Scatter=g.Scatter||{}, E=Sc.Engine;
if(!E||Sc.Brain) return;
var KEY="bg_ai_scatter", VER=1, MAXBAD=300, MAXMEM=160, LO=.7, HI=1.4, KEYS=["thr","rep"];

var SKILL={
  easy:  {name:"easy",   thr:1.35, obv:.45, fill:.85, mem:0,   bad:false, learn:false, dthr:1.25, coord:false},   // leaves blanks, grabs the obvious answers now and then, no memory, no spreading
  normal:{name:"normal", thr:1,    obv:0,   fill:1,   mem:1,   bad:true,  learn:true,  dthr:1.1,  coord:true},
  hard:  {name:"hard",   thr:.9,   obv:0,   fill:1,   mem:1.5, bad:true,  learn:true,  dthr:1,    coord:true}
};
/* the habit the brain assumes for every other writer: the old computer code's numbers (the head of the list, or a random answer) */
var OPP={rate:.85,deep:.5};
var P={base:.35,bw:.12,lo:.12,hi:.6,last:1.5,scale:4,kscale:5};   // tuning constants (the tournament sweeps them)
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.s=(Math.imul(b.s,1664525)+1013904223)>>>0; return b.s/4294967296; }
function skillOf(G,p){ return SKILL[(p&&p.skill)||(G&&G.o&&G.o.cpuSkill)]||SKILL.normal; }
function catKey(s,si){ return (s.bank&&s.bank.id)||s.label||("s"+si); }

/* ---------- the per-device table ---------- */
function freshTable(){ return {v:VER,games:0,w:{thr:1,rep:1},t:{wins:[0,0,0],games:[0,0,0]},bad:[]}; }
function readTable(){
  var t=freshTable();
  try{
    var s=getStore(), raw=s&&s.getItem(KEY); if(!raw) return t;
    var d=JSON.parse(raw); if(!d||d.v!==VER||!d.w) return t;
    KEYS.forEach(function(k){ var x=+d.w[k]; if(isFinite(x)) t.w[k]=clamp(x,LO,HI); });
    t.games=Math.max(0,Math.min(1e6,+d.games||0));
    if(d.t&&d.t.wins&&d.t.games) for(var i=0;i<3;i++){ t.t.wins[i]=Math.max(0,+d.t.wins[i]||0); t.t.games[i]=Math.max(0,+d.t.games[i]||0); }
    if(Array.isArray(d.bad)) t.bad=d.bad.filter(function(x){ return typeof x==="string"&&x.length<120; }).slice(-MAXBAD);
  }catch(e){}
  return t;
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }
function badSet(t){ var m={}; t.bad.forEach(function(x){ m[x]=1; }); return m; }
function remember(t,x){ if(t.bad.indexOf(x)<0){ t.bad.push(x); if(t.bad.length>MAXBAD) t.bad.splice(0,t.bad.length-MAXBAD); } }

/* ---------- the brain object (plain data) ---------- */
function brainOf(G,p){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b) ai=G.ai={v:1,b:{}};
  var b=ai.b[p.id];
  if(b&&b.k&&b.mem) return b;
  var h=hash(G.players[0].name+"|"+G.players.length), sk=skillOf(G,p), tab=sk.learn?readTable():freshTable();
  b=ai.b[p.id]={ id:p.id, t:(h+p.id)%3, s:(hash(p.name)^(p.id*2654435761))>>>0, k:{}, mem:{}, mood:"balanced", B:0 };
  KEYS.forEach(function(k){ b.k[k]=clamp(tab.w[k]*(1+(rnd(b)*2-1)*.1),LO,HI); });
  return b;
}

/* ---------- the situation: balanced / bold / reserved ---------- */
function readMood(G,p,b){
  var my=G.players[p.id].score, best=null;
  G.players.forEach(function(q){ if(q.id!==p.id&&(best==null||q.score>best)) best=q.score; });
  var lead=best==null?0:my-best, kw=G.o.mode==="keyword";
  var left=kw?9:(G.o.rounds-(G.roundsDone||0)), last=(!kw&&left<=1)?P.last:1;   // the last round counts more
  var sit=clamp(lead/(kw?P.kscale:P.scale),-1.5,1.5)*last;                       // +1 = ahead (play safe), -1 = behind (fill more)
  var base=b.t===1?.6:b.t===2?-.6:0;
  var B=base-sit;
  b.B=B; b.mood=B>=.8?"bold":B<=-.8?"reserved":"balanced";
  return B;
}
function bar(B,sk,k,mul){ return clamp(P.base-P.bw*B,P.lo,P.hi)*sk.thr*k.thr*mul; }

/* ---------- value of one answer ---------- */
/* points the house rule gives (mirrors Sc.Engine.evaluate: junior 2/1, the 2023 double, the 1988 extra word) */
function ptsOf(o,raw,L){
  var w=E.words(raw), l=L.toLowerCase(), n=0, sw=w.length>0&&w[0][0]===l;
  w.forEach(function(x){ if(x[0]===l) n++; });
  var pts=1;
  if(o.startRule==="bonus") pts=sw?2:1;
  if(sw&&o.bonus!=="none"){ if(o.bonus==="double"&&n>=2) pts=2; else if(o.bonus==="extra"&&n>=2) pts=n; }
  return pts;
}
/* chance that some other writer also writes this answer: the head of the list is what most people write; a repeat from an earlier round is likelier */
function clash(b,sk,k,catK,L,key,i,n,nOpp){
  var q=OPP.rate*((1-OPP.deep)*(i<2?1/Math.min(2,n):0)+OPP.deep/n);
  var m=(b.mem[catK+"|"+L]||{})[key]||0;
  if(m&&sk.mem) q=q*(1+sk.mem*k.rep);
  return 1-Math.pow(1-Math.min(.95,q),Math.max(1,nOpp));
}

/* ---------- one decision: the whole sheet ---------- */
var stats={calls:0,declined:0,errors:0,cells:0,filled:0};
function decide(G,p){
  stats.calls++;
  try{
    if(p.oldAI) return null;                       // a test seat that plays the old code
    var o=G.o, sk=skillOf(G,p), b=brainOf(G,p), k=b.k, B=readMood(G,p,b);
    var bad=sk.bad?badSet(readTable()):{}, nOpp=0, used=[], out=[];
    G.players.forEach(function(q){ if(q.id!==p.id&&E.inPlay(G,q.id)) nOpp++; });
    // spreading: the computers take the best answers in turn by their place among the computers, so two computers do not write the same one
    var comp=G.players.filter(function(q){ return !q.human&&!q.oldAI&&E.inPlay(G,q.id); }).map(function(q){ return q.id; });
    var rank=Math.max(0,comp.indexOf(p.id));
    G.slots.forEach(function(s,si){
      var catK=catKey(s,si), L=s.letter, list=((s.bank&&s.bank.answers)||{})[L]||[], row=[];
      for(var j=0;j<o.answersPer;j++){
        var thr=bar(B,sk,k,j?sk.dthr:1), cands=[];
        for(var i=0;i<list.length;i++){
          var raw=list[i], key=E.keyOf(raw);
          if(!key||!E.startsWith(raw,L)) continue;
          if(used.some(function(u){ return E.pluralSame(u,key); })) continue;
          if(bad[catK+"|"+key]) continue;
          var v=(1-clash(b,sk,k,catK,L,key,i,list.length,nOpp))*ptsOf(o,raw,L);
          cands.push({raw:raw,key:key,i:i,v:v});
        }
        if(!cands.length){ row.push(""); continue; }
        var ranked=cands.slice().sort(function(x,y){ return y.v-x.v||x.i-y.i; }), best=ranked[sk.coord?Math.min(rank,ranked.length-1):0];
        if(sk.obv&&rnd(b)<sk.obv){ var head=cands.slice().sort(function(x,y){ return x.i-y.i; }).slice(0,2); best=head[Math.floor(rnd(b)*head.length)]; }
        if(best.v<thr||(sk.fill<1&&rnd(b)>sk.fill)){ row.push(""); continue; }
        used.push(best.key); row.push(best.raw);
      }
      out.push(row);
    });
    // sanity filter: a bad cell is left blank (never a wrong letter, never twice on one sheet, never a voted-out answer)
    var seen=[];
    out.forEach(function(row,si){
      var s=G.slots[si], catK=catKey(s,si);
      row.forEach(function(raw,j){
        if(!raw) return; stats.cells++;
        var key=E.keyOf(raw);
        if((o.startRule==="must"&&!E.startsWith(raw,s.letter))||seen.some(function(u){ return E.pluralSame(u,key); })||bad[catK+"|"+key]){ row[j]=""; stats.declined++; return; }
        seen.push(key); stats.filled++;
      });
    });
    return out;
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); return null; }   // the caller falls back to the old code
}

/* ---------- memory and learning ---------- */
/* after a round: what every other writer put down (each brain's memory), and the answers the vote threw out (kept on this device) */
function learnRound(G){
  try{
    if(!G||!G.result||!G.ai||!G.ai.b) return;
    var ent=G.result.entries||[];
    Object.keys(G.ai.b).forEach(function(id){
      var b=G.ai.b[id]; if(!b) return;
      ent.forEach(function(e){
        if(e.p===+id||!e.raw||!G.slots[e.slot]) return;
        var s=G.slots[e.slot], mk=catKey(s,e.slot)+"|"+s.letter, m=b.mem[mk];
        if(!m){ if(Object.keys(b.mem).length>=MAXMEM) b.mem={}; m=b.mem[mk]={}; }
        m[e.key]=(m[e.key]||0)+1;
      });
    });
    if((G.o.cpuSkill||"normal")==="easy") return;
    var out=[];
    Object.keys(G.challenges||{}).forEach(function(si){ Object.keys(G.challenges[si]).forEach(function(kk){
      var c=G.challenges[si][kk], s=G.slots[c&&c.slot];
      if(c&&c.state==="rejected"&&s){ var raw=((G.answers[c.p]||[])[c.slot]||[])[c.k]; if(raw) out.push(catKey(s,c.slot)+"|"+E.keyOf(raw)); }
    }); });
    if(out.length){ var t=readTable(); out.forEach(function(x){ remember(t,x); }); writeTable(t); }
  }catch(e){}
}
/* the vote: a computer votes no on an answer the vote threw out on this device (undefined = the old judge decides) */
function vote(G,si,raw){
  var s=G.slots[si]; if(!s||!skillOf(G,null).bad) return undefined;
  return readTable().bad.indexOf(catKey(s,si)+"|"+E.keyOf(raw))>=0?false:undefined;
}
/* a computer challenges a human answer the vote threw out on this device */
function wantsChallenge(G,e){
  if(!skillOf(G,null).bad||!e||!e.key) return false;
  var s=G.slots[e.slot]; if(!s) return false;
  return readTable().bad.indexOf(catKey(s,e.slot)+"|"+e.key)>=0;
}
/* a finished game: each brain nudges the table toward its own weights if it won, slightly away if it lost */
function finish(G){
  try{
    if(!G||G.aiDone||!G.ai||!G.ai.b||!G.over) return;
    G.aiDone=true;
    if((G.o.cpuSkill||"normal")==="easy") return;
    var t=readTable(), any=false, win=G.winners||[];
    Object.keys(G.ai.b).forEach(function(id){
      var b=G.ai.b[id]; if(!b||!b.k) return; any=true;
      var won=win.indexOf(+id)>=0;
      KEYS.forEach(function(kk){ var d=b.k[kk]-t.w[kk], step=won?.25*d:-.06*d; t.w[kk]=clamp(t.w[kk]+clamp(step,-.05,.05),LO,HI); });
      t.t.games[b.t]++; if(won) t.t.wins[b.t]++;
    });
    if(any){ t.games++; writeTable(t); }
  }catch(e){}
}

Sc.Brain={ decide:decide, learnRound:learnRound, finish:finish, vote:vote, wantsChallenge:wantsChallenge, brainOf:brainOf, readMood:readMood,
  SKILL:SKILL, P:P, OPP:OPP, KEY:KEY, VER:VER, stats:stats, setStore:setStore, readTable:readTable, catKey:catKey, clash:clash, ptsOf:ptsOf };
if(typeof module!=="undefined"&&module.exports) module.exports=Sc.Brain;
})(typeof window!=="undefined"?window:globalThis);
