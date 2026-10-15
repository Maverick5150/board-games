/* UNO — the computer players' brain (step 10). Loaded by engine.js (browser: the page, the Party TV and the Party phones all load engine.js) or require()d (tests).
   Called from Uno.Engine.aiAction(G,p) at the same call point as the old code, so Party Uno gets it through the shared engine; if the brain is missing
   or declines a move, the old code plays it.

   One brain per computer player: a small plain-data object kept in G.ai.b[playerId] (a saved game keeps it, old saves have none and get fresh ones).
   Each has its own base temperament (balanced / bold / reserved), its own tactic weights and its own memory of the opponents, read from the PUBLIC
   events in G.log (what a player played, which colour they chose, the colours they had to draw on): it never looks into another hand, only at how
   many cards it holds. Every turn it reads the situation (score race, hand race, who is close to going out) and moves between balanced, bold and
   reserved; the mood only nudges the weights. Every legal card is scored (hand flexibility, the colour the next player cannot answer, points,
   wild/draw cards saved for the right moment, Draw Two / Four / Skip on the player about to win, Seven-O swaps worth taking); a sanity filter
   rejects senseless moves (a Wild Draw Four it holds a colour against, a hand swap that costs cards, a draw aimed at itself).
   It also decides catch (a player who forgot UNO) and jump-in for the page (Brain.catchPlan / Brain.jumpPlan).
   Learning across games: a small weight table in localStorage 'bg_ai_uno' (versioned, bounded, safe to delete).
   Skill: G.skill = "easy" | "normal" | "hard" (missing = normal); p.skill overrides per player (tests); p.skill === "legacy" = the old code's forgetfulness. */
(function(g){
"use strict";
var U=g.Uno, E=U&&U.Engine, KEY="bg_ai_uno", VER=1;
if(!E||U.Brain) return;
var DRAWN=E.DRAWN, EST={wdc:3.5,roul:3.5};

var SKILL={
  easy:  {mem:0,    noise:.35, catchH:.35, catchC:0,   jump:.08, fg:2,   learn:false, stuck:0,   jit:.2},
  normal:{mem:1,    noise:0,   catchH:.7,  catchC:.6,  jump:.30, fg:1,   learn:true,  stuck:0,   jit:.10},
  hard:  {mem:1.25, noise:0,   catchH:.93, catchC:.9,  jump:.55, fg:.4,  learn:true,  stuck:0, jit:.04}
};
/*P*/var P={cv:0.5, pts:0.3, atk0:0.5, atkU:1.1, tempo2:1.2, tempoN:0.6, save:1, lack:1, swap:0.9, stay2:0.45, stayN:0.28, keep:1, bonus:1.2, chalMin:0, dig:1};   // tuning constants (the tournament sweeps them)
var KEYS=["atk","save","lack","cv"], LO=.7, HI=1.4;
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }   // tests: pass a {getItem,setItem,removeItem} stand-in, or null for "no learning table"
function clamp(x,a,b){ return x<a?a:x>b?b:x; }

/* ---------- the per-device weight table ---------- */
function freshTable(){ return {v:VER,games:0,w:{atk:1,save:1,lack:1,cv:1},t:{wins:[0,0,0],games:[0,0,0]}}; }
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
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.s=(Math.imul(b.s,1664525)+1013904223)>>>0; return b.s/4294967296; }
function fc(G,c){ return c.f[G.side]; }
function teamOf(G,p){ return G.o.teams?p%2:p; }
function skillOf(G,p){ return SKILL[p&&p.skill]||SKILL[G.skill]||SKILL.normal; }
function usz(n){ return n<=1?3:n===2?2:n===3?1:n===4?.35:0; }      // how close to going out a hand of n cards is
function dn(v){ return DRAWN[v]||EST[v]||0; }
function nAlive(G){ return E.alive(G).length; }
function dcache(){ return dcache.m||(dcache.m={}); }
function deckCounts(o,side){
  var k=o.edition+"/"+side, m=dcache(); if(m[k]) return m[k];
  var cnt={}; E.buildDeck(o,function(){ return .5; }).forEach(function(c){ var f=c.f[side]; cnt[f.c]=(cnt[f.c]||0)+1; });
  return (m[k]=cnt);
}
/* a Wild Draw card is legal only when no card of the colour in play (and, with the 2022 wording, no other Wild) is held */
function legalWild(G,p,card){
  var hand=G.players[p].hand;
  for(var i=0;i<hand.length;i++){ var c=hand[i]; if(c.id===card.id) continue; var f=fc(G,c); if(f.c===G.color&&f.c!=="W") return false; if(G.o.wildsCount&&f.c==="W") return false; }
  return true;
}

/* ---------- the brain object (plain data) ---------- */
function brainOf(G,p){
  var ai=G.ai; if(!ai||typeof ai!=="object"||!ai.b) ai=G.ai={v:1,b:{}};
  var b=ai.b[p.id];
  if(b&&b.k&&b.mem) return b;
  var h=hash(G.players[0].name+"|"+G.players.length), sk=skillOf(G,p), tab=sk.learn?readTable():freshTable();
  b=ai.b[p.id]={ id:p.id, t:(h+p.id)%3, s:(hash(p.name)^(p.id*2654435761))>>>0, k:{}, pos:0, mem:{}, ill:{}, lastPlay:-1, mood:"balanced", B:0 };
  KEYS.forEach(function(k){ b.k[k]=clamp(tab.w[k]*(1+(rnd(b)*2-1)*sk.jit),LO,HI); });
  return b;
}
/* ---------- memory: read the public events since the last look ---------- */
function om(b,q){ var m=b.mem[q]; if(!m) m=b.mem[q]={lk:{},has:{}}; return m; }
function observe(G,b){
  var log=G.log||[]; if(b.pos>log.length) b.pos=0;
  for(var i=b.pos;i<log.length;i++){
    var e=log[i], q=e.p, m, k, mine=(q===b.id);
    switch(e.type){
      case "deal": case "flip": case "swap": b.mem={}; b.lastPlay=-1; break;
      case "pass": if(q==null) b.mem={}; break;
      case "play":
        if(!mine&&q!=null){ m=om(b,q); var pc=e.c==="W"?e.col:e.c; if(pc){ delete m.lk[pc]; m.has[pc]=1; } }
        b.lastPlay=q; break;
      case "draw":
        if(!mine&&q!=null&&e.n>0){
          m=om(b,q);
          for(k in m.lk) m.lk[k]+=e.n;                       // every card drawn since could be that colour
          if(e.vol&&e.col){ m.lk[e.col]=0; delete m.has[e.col]; }   // had to draw on this colour: none of it in the hand
        }
        break;
      case "challenge":
        if(b.lastPlay>=0){ var ip=b.ill[b.lastPlay]||(b.ill[b.lastPlay]={y:0,n:0}); ip.n++; if(/WAS holding/.test(e.text||"")) ip.y++; }
        break;
    }
  }
  b.pos=log.length;
}

/* ---------- the situation: balanced / bold / reserved ---------- */
function readMood(G,p,b){
  var o=G.o, T=o.target>0?o.target:0, u=teamOf(G,p.id), my=G.uscore?G.uscore[u]:0, sit=0, i, others=[];
  if(G.uscore) for(i=0;i<G.uscore.length;i++) if(i!==u) others.push(G.uscore[i]);
  if(T&&others.length){
    var best=o.scoring==="tally"?Math.min.apply(null,others):Math.max.apply(null,others);
    var lead=o.scoring==="tally"?best-my:my-best;
    if(lead>=.15*T) sit=1; else if(lead<=-.15*T) sit=-1;
    if(o.scoring!=="tally"){ if(best>=.7*T&&lead<0) sit=-1.4; else if(my>=.7*T&&lead>0) sit=1.3; }
  }
  var oppMin=99, hand=p.hand.length;
  G.players.forEach(function(q){ if(q.alive&&teamOf(G,q.id)!==u&&q.hand.length<oppMin) oppMin=q.hand.length; });
  if(oppMin<=2&&hand>=5) sit-=.5;               // the round is slipping: little to lose
  else if(hand+3<=oppMin) sit+=.4;              // clearly ahead in this round: protect it
  var base=b.t===1?.6:b.t===2?-.6:0, B=base-sit;
  b.B=B; b.mood=B>=.8?"bold":B<=-.8?"reserved":"balanced";
  return {B:B,oppMin:oppMin};
}

/* ---------- the context of one decision ---------- */
function mkCtx(G,p,b){
  var sk=skillOf(G,p), mo=readMood(G,p,b), me=p.id, u=teamOf(G,me), o=G.o;
  var ctx={G:G,p:p,b:b,o:o,sk:sk,B:mo.B,me:me,opps:[],W:null,seen:null,two:nAlive(G)===2};
  G.players.forEach(function(q){ if(q.alive&&q.id!==me&&teamOf(G,q.id)!==u) ctx.opps.push(q.id); });
  ctx.nx=E.nextIdx(G,me,1); ctx.pv=E.nextIdx(G,me,1,-G.dir);
  ctx.nxSz=G.players[ctx.nx].hand.length; ctx.pvSz=G.players[ctx.pv].hand.length;
  var dmin=99; ctx.opps.forEach(function(q){ var s=G.players[q].hand.length; if(s<dmin) dmin=s; }); ctx.dmin=dmin;
  var k=b.k, B=mo.B;
  ctx.W={ cv:P.cv*k.cv, pts:P.pts*(1-.1*B), atk0:P.atk0*k.atk*(1+.22*B), atkU:P.atkU*k.atk, save:P.save*k.save*(1-.2*B), lack:P.lack*k.lack*sk.mem, swap:P.swap, keep:P.keep };
  return ctx;
}
function lackOf(ctx,q,x){ var m=ctx.b.mem[q]; if(!m||m.lk[x]==null||!ctx.sk.mem) return 0; return Math.pow(.77,m.lk[x])*Math.min(1,ctx.sk.mem); }
function hasOf(ctx,q,x){ var m=ctx.b.mem[q]; return (m&&m.has[x]&&ctx.sk.mem)?1:0; }
/* how likely it is that the colour I name is still in play on my next turn: the next player has to be unable to answer it to leave it alone */
function stayOf(ctx,x){
  var base=ctx.two?P.stay2:P.stayN, l=0;
  if(ctx.opps.indexOf(ctx.nx)>=0) l=lackOf(ctx,ctx.nx,x);
  return base+(1-base)*l*.85;
}
function seenOf(ctx){
  if(ctx.seen) return ctx.seen;
  var G=ctx.G, s={}, tot=deckCounts(ctx.o,G.side), x;
  for(x in tot) s[x]=tot[x];
  G.discard.forEach(function(c){ var f=fc(G,c); if(s[f.c]!=null) s[f.c]--; });
  ctx.p.hand.forEach(function(c){ var f=fc(G,c); if(s[f.c]!=null) s[f.c]--; });
  for(x in s) if(s[x]<0) s[x]=0;
  return (ctx.seen=s);
}
/* card counting (Hard): the chance the next player holds nothing that answers colour x / value v, from the cards not yet seen and the colours they could not play */
function cvOf(ctx){
  if(ctx.cv) return ctx.cv;
  var G=ctx.G, o=ctx.o, k=o.edition+"/"+G.side+"/cv", c=dcache(), base=c[k];
  if(!base){ base={}; E.buildDeck(o,function(){ return .5; }).forEach(function(cd){ var f=cd.f[G.side], kk=f.c+"|"+f.v; base[kk]=(base[kk]||0)+1; }); c[k]=base; }
  var m={}, kk;
  for(kk in base) m[kk]=base[kk];
  function sub(cd){ var f=fc(G,cd), key=f.c+"|"+f.v; if(m[key]>0) m[key]--; }
  G.discard.forEach(sub); ctx.p.hand.forEach(sub);
  return (ctx.cv=m);
}
function stuckP(ctx,x,v){
  var m=cvOf(ctx), opp=ctx.nx, h=ctx.nxSz, N=0, M=0, key;
  for(key in m){
    var u=m[key]; if(u<=0) continue;
    var col=key.charAt(0), val=key.slice(2), w=u;
    if(col!=="W") w=u*(1-lackOf(ctx,opp,col));
    N+=w; if(col==="W"||col===x||(v!=null&&val===v)) M+=w;
  }
  if(N<=1) return 0;
  var pr=1; for(var i=0;i<h&&pr>0;i++){ pr*=Math.max(0,N-M-i)/Math.max(1e-6,N-i); }
  return pr;
}
function victimOf(G,p,f,tg){
  var v=f.v;
  if(v==="wrd4") return nAlive(G)===2?p:E.nextIdx(G,p,1,-G.dir);
  if(v==="wtd2") return tg;
  return E.nextIdx(G,p,1);
}

/* ---------- colour, target ---------- */
function chainVal(ctx,rest,col,side){
  if(!col) return 0;
  var n=0; for(var i=0;i<rest.length;i++) if(rest[i].f[side].c===col) n++;
  return stayOf(ctx,col)*Math.min(n,3)*ctx.W.cv*(n>0?1:0);
}
function pickColor(ctx,rest,except,roul){
  var G=ctx.G, cols=E.colorsNow(G), best=null, bs=-1e9, pool=Math.max(8,G.draw.length), sn=seenOf(ctx);
  cols.forEach(function(x){
    var n=0; for(var i=0;i<rest.length;i++){ var cc=rest[i]; if(except&&cc.id===except.id) continue; if(cc.f[G.side].c===x) n++; }
    var s=0, lk=ctx.opps.indexOf(ctx.nx)>=0?lackOf(ctx,ctx.nx,x):0;
    if(roul){ s=-pool/Math.max(1,sn[x]||0)+.5*n+2*lk*ctx.W.lack; }
    else {
      s=stayOf(ctx,x)*Math.min(n,3)*ctx.W.cv+n*.12;
      s+=lk*ctx.W.lack*(1+usz(ctx.nxSz))*(ctx.two?1:.8)*Math.min(n,2)/2;           // only a colour I hold myself: otherwise I am stuck on it too
      if(ctx.sk.stuck&&ctx.opps.indexOf(ctx.nx)>=0&&ctx.o.edition!=="allwild") s+=ctx.sk.stuck*stuckP(ctx,x,null)*(1+1.2*usz(ctx.nxSz));
      if(ctx.opps.indexOf(ctx.nx)>=0&&hasOf(ctx,ctx.nx,x)) s-=.5*ctx.W.lack;
      if(!n) s-=.03*(sn[x]||0);                      // nothing of it in my hand: prefer the colour with the fewest cards left unseen
    }
    s+=rnd(ctx.b)*.01;
    if(s>bs){ bs=s; best=x; }
  });
  return best;
}
function pickTarget(ctx,f){
  var G=ctx.G, best=null, bs=-1e9;
  G.players.forEach(function(q,i){
    if(i===ctx.me||!q.alive) return;
    var s=-q.hand.length+(teamOf(G,i)!==teamOf(G,ctx.me)?.5:-3)+(i===ctx.nx?.2:0)+rnd(ctx.b)*.05;
    if(s>bs){ bs=s; best=i; }
  });
  return best;
}

/* ---------- the value of one card ---------- */
function keepVal(ctx,h){
  if(ctx.o.edition==="allwild") return 0;
  var v=h<=2?5:h<=3?3.4:h<=5?2.2:1.4;
  return v*ctx.W.save;
}
function evalCard(ctx,c){
  var G=ctx.G, p=ctx.p, o=ctx.o, W=ctx.W, f=fc(G,c), v=f.v, isW=f.c==="W", hand=p.hand;
  var rest=hand.filter(function(x){ return x.id!==c.id; }), r=rest.length;
  var res={c:c,s:0,col:null,tg:null};
  if(o.noWildFinish&&r===0&&DRAWN[v]&&isW) return null;
  var names=E.namesColor(G,f), needT=E.needsTarget(G,f);
  if(names) res.col=pickColor(ctx,rest,c);
  if(needT) res.tg=pickTarget(ctx,f);
  if(r===0){ res.s=1e4; return res; }
  var s=0, side=G.side, newCol=isW?(names?res.col:(o.edition==="allwild"?null:G.color)):f.c, wd=(v==="wd4"||v==="wd2"||v==="wdc");
  if(wd&&!legalWild(G,p.id,c)) s-=60;                       // sanity: never bluff a Wild Draw card
  if(v==="flip"){
    side=1-G.side; var nt=G.discard[0], nf=nt?nt.f[side]:null; newCol=nf&&nf.c!=="W"?nf.c:null;
    var wl=0; rest.forEach(function(x){ if(x.f[side].c==="W") wl++; }); s+=Math.min(wl,2)*.5;
  }
  s+=chainVal(ctx,rest,newCol,side);
  if(ctx.sk.stuck&&o.edition!=="allwild"&&(E.isNum(f)||v==="wild")&&ctx.opps.indexOf(ctx.nx)>=0) s+=ctx.sk.stuck*stuckP(ctx,newCol,isW?null:v)*(1+1.2*usz(ctx.nxSz));
  var pts=E.cardPoints(G,f); s+=W.pts*pts/10;
  if(isW) s-=keepVal(ctx,r+1);
  var nxSz=ctx.nxSz, tempo=ctx.two?P.tempo2:P.tempoN, n=dn(v), stk=o.stack!=="none"?.85:1, ob;
  if(n){                                                       // a draw card
    var vic=victimOf(G,p.id,f,res.tg);
    if(vic===p.id||teamOf(G,vic)===teamOf(G,p.id)) s-=25;
    else {
      var sz=G.players[vic].hand.length, val=(n+tempo)*(W.atk0+usz(sz)*W.atkU)*stk;
      if(o.mercy&&sz+n>=o.mercy) val+=12;
      else if(o.mercy&&sz+n>=o.mercy-4) val+=2;
      s+=val;
      if(wd&&o.challenge&&o.edition!=="nomercy") s+=P.bonus*W.atk0;        // a legal one: a challenge backfires on the challenger
    }
  } else if(v==="skip"||v==="wskip"||v==="wskip2"||v==="skipall"||((v==="rev"||v==="wrev")&&ctx.two)){
    var szs=v==="skipall"?ctx.dmin:nxSz;
    var t=(v==="wskip2"?1.6:1)*tempo; s+=t*(W.atk0+usz(szs)*W.atkU)*(v==="skipall"?1.2:1);
  } else if(v==="rev"||v==="wrev"){
    s+=(usz(nxSz)-usz(ctx.pvSz))*.9+.2;
  } else if(v==="discardall"){
    var m=0; rest.forEach(function(x){ if(fc(G,x).c===f.c) m++; });
    if(m===r) { res.s=1e4; return res; }
    s+=m*1.2+.6;
  } else if(v==="wswap"&&res.tg!=null){
    s+=clamp(r-G.players[res.tg].hand.length,-6,8)*W.swap;
  } else if(o.sevenZero&&E.isNum(f)){
    if(v==="7"&&res.tg!=null) s+=clamp(r-G.players[res.tg].hand.length,-6,8)*W.swap;
    else if(v==="0"){
      var live=E.alive(G).map(function(q){ return q.id; }), i=live.indexOf(p.id), k=G.dir>0?1:-1, src=live[(i-k+live.length*2)%live.length];
      s+=clamp(r-G.players[src].hand.length,-6,6)*W.swap*.8;
    }
  }
  if(v==="wtd2"&&res.tg!=null){ var tz=G.players[res.tg].hand.length; s+=2*(W.atk0+usz(tz)*W.atkU); }
  void ob;
  res.s=s; return res;
}

/* a stacked penalty (Progressive / Cross / No Mercy): stack when possible; the card that knocks the victim out or aims at the weakest first */
function pickStack(ctx,cards){
  var G=ctx.G, p=ctx.p, o=ctx.o, best=null, bs=-1e9;
  cards.forEach(function(c){
    var f=fc(G,c), vic=victimOf(G,p.id,f,null), s=-dn(f.v)*.3-(f.c==="W"?.8:0);
    if(vic===p.id) s-=30;
    else { var sz=G.players[vic].hand.length, tot=(G.pen?G.pen.n:0)+dn(f.v); if(o.mercy&&sz+tot>=o.mercy) s+=20; s+=usz(sz)*.6; }
    if(p.hand.length===1) s+=100;
    if(s>bs){ bs=s; best=c; }
  });
  if(bs<-20&&!(p.hand.length===1)) return {t:"draw"};               // every stackable card would land on me: take the penalty
  var a={t:"play",card:best.id}, f2=fc(G,best);
  if(E.namesColor(G,f2)) a.color=pickColor(ctx,p.hand,best);
  if(E.needsTarget(G,f2)) a.target=pickTarget(ctx,f2);
  return a;
}

/* ---------- the challenge ---------- */
function wantChallenge(ctx){
  var G=ctx.G, c=G.chal, o=G.o; if(!o.challenge) return false;
  if(!ctx.sk.mem) return G.rnd()<.5&&G.players[c.by].hand.length>=3;           // easy: a coin flip
  var by=c.by, hs=G.players[by].hand.length, ip=ctx.b.ill[by], rate=((ip?ip.y:0)+1)/((ip?ip.n:0)+5);
  var p=rate*(.55+.1*Math.min(hs,6)), x=c.colorBefore;
  if(x){ var lp=lackOf(ctx,by,x); p*=(1-.85*lp); if(hasOf(ctx,by,x)) p*=1.6; }
  var n=c.n||3.5, thr=2/(n+2)-.04*ctx.B+P.chalMin;
  return p>thr;
}

/* ---------- the decision ---------- */
function act(ctx){
  var G=ctx.G, p=ctx.p, pi=p.id;
  if(G.needColor&&pi===G.turn) return {t:"startColor",color:pickColor(ctx,p.hand,null)};
  if(G.phase==="challenge"&&G.chal&&pi===G.chal.victim) return {t:"challenge",yes:wantChallenge(ctx)};
  if(G.phase==="roulette"&&G.roul&&pi===G.roul.victim) return {t:"roulette",color:pickColor(ctx,p.hand,null,true)};
  if(G.phase==="drawn"){
    var c2=p.hand.filter(function(x){ return x.id===G.drawnId; })[0];
    if(!c2||!E.canPlay(G,pi,c2)) return {t:"pass"};
    var e=evalCard(ctx,c2); if(!e) return {t:"pass"};
    var canPass=!G.o.forcePlay&&G.o.drawRule!=="untilPlay";
    if(canPass&&e.s<-20) return {t:"pass"};                                              // sanity: a draw that would land on myself stays in the hand
    if(canPass&&e.s<-1.4&&p.hand.length>=4&&fc(G,c2).c==="W"&&ctx.dmin>=4) return {t:"pass"};         // a spare Wild kept for later
    return mkPlay(e);
  }
  if(G.phase==="play"){
    var ids=E.playableIds(G,pi);
    if(!ids.length) return {t:"draw"};
    var cards=ids.map(function(id){ return p.hand.filter(function(c){ return c.id===id; })[0]; });
    if(G.pen) return pickStack(ctx,cards);
    var cands=[]; cards.forEach(function(c){ var e=evalCard(ctx,c); if(e) cands.push(e); });
    if(!cands.length) return null;
    cands.sort(function(a,b){ return b.s-a.s; });
    var pick=cands[0];
    if(ctx.sk.noise&&cands.length>1&&rnd(ctx.b)<ctx.sk.noise&&pick.s<1e3) pick=cands[1+Math.floor(rnd(ctx.b)*(cands.length-1))];
    return mkPlay(pick);
  }
  return null;
}
function mkPlay(e){ var a={t:"play",card:e.c.id}; if(e.col) a.color=e.col; if(e.tg!=null) a.target=e.tg; return a; }

/* ---------- the sanity filter: a senseless move is rejected (the caller then falls back to the old code) ---------- */
function sane(G,p,a){
  if(!a) return false;
  var cols=E.colorsNow(G);
  if(a.t==="draw") return G.phase==="play";
  if(a.t==="pass") return G.phase==="drawn";
  if(a.t==="challenge") return G.phase==="challenge";
  if(a.t==="startColor"||a.t==="roulette") return cols.indexOf(a.color)>=0;
  if(a.t!=="play") return false;
  if(E.playableIds(G,p.id).indexOf(a.card)<0) return false;
  var c=p.hand.filter(function(x){ return x.id===a.card; })[0], f=fc(G,c), r=p.hand.length-1;
  if(E.namesColor(G,f)&&cols.indexOf(a.color)<0) return false;
  if(E.needsTarget(G,f)&&!(r===0&&f.v==="7")){ var t=a.target; if(t==null||t===p.id||!G.players[t]||!G.players[t].alive) return false; }
  if(G.o.noWildFinish&&r===0&&DRAWN[f.v]&&f.c==="W") return false;
  return true;
}

var stats={calls:0,declined:0,errors:0};
function decide(G,pi){
  stats.calls++;
  try{
    var p=G.players[pi]; if(!p||!p.alive) return null;
    var b=brainOf(G,p);
    observe(G,b);
    var ctx=mkCtx(G,p,b);
    var a=act(ctx);
    if(sane(G,p,a)) return a;
    stats.declined++; return null;
  }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); return null; }   // the caller falls back to the old code
}

/* ---------- UNO call / catch / jump-in (the page asks; the Party engine keeps its own) ---------- */
function forget(G,p){
  if(!p||p.skill==="legacy") return G.o.aiForget;
  return G.o.aiForget*skillOf(G,p).fg;
}
function humans(G){ var n=0; G.players.forEach(function(q){ if(q.human) n++; }); return n; }
/* a computer that sees a player left on one card without UNO may catch them; returns {by,target} or null. Computers only catch a computer when one human plays (hot seat: no catching AIs). */
function catchPlan(G,seats){
  var t=G.unoVuln; if(t==null) return null;
  var tp=G.players[t]; if(!tp||!tp.alive||tp.hand.length!==1) return null;
  if(!tp.human&&humans(G)>1) return null;
  for(var q=0;q<G.players.length;q++){
    var cp=G.players[q];
    if(q===t||!cp.alive||cp.human||teamOf(G,q)===teamOf(G,t)) continue;
    if(seats&&seats.indexOf(q)<0) continue;
    var sk=skillOf(G,cp), ch=tp.human?sk.catchH:sk.catchC;
    if(cp.skill==="legacy") continue;
    if(ch>0&&G.rnd()<ch) return {by:q,target:t};
  }
  return null;
}
/* a computer holding the identical card may jump in; returns {q,a} or null */
function jumpPlan(G,seats){
  if(!G.o.jumpIn||G.phase!=="play"||G.pen) return null;
  for(var q=0;q<G.players.length;q++){
    var cp=G.players[q];
    if(!cp.alive||cp.human||q===G.turn||cp.skill==="legacy") continue;
    if(seats&&seats.indexOf(q)<0) continue;
    var ids=E.jumpIds(G,q); if(!ids.length) continue;
    var sk=skillOf(G,cp); if(!(G.rnd()<sk.jump)) continue;
    try{
      var b=brainOf(G,cp); observe(G,b); var ctx=mkCtx(G,cp,b), best=null;
      ids.forEach(function(id){ var c=cp.hand.filter(function(x){ return x.id===id; })[0], e=evalCard(ctx,c); if(e&&(!best||e.s>best.s)) best=e; });
      if(!best||(best.s<=0&&cp.hand.length>1)) continue;
      var a=mkPlay(best); a.t="jump";
      var f=fc(G,best.c);
      if(dn(f.v)&&victimOf(G,q,f,a.target)===q) continue;
      return {q:q,a:a};
    }catch(e){ stats.errors++; stats.lastError=String(e&&e.stack||e); }
  }
  return null;
}

/* ---------- learning across games ---------- */
function finish(G){
  try{
    if(!G||G.aiDone||!G.ai||!G.ai.b||G.winner==null) return;
    G.aiDone=true;
    var ids=Object.keys(G.ai.b);
    if(!ids.some(function(id){ var q=G.players[+id]; return q&&skillOf(G,q).learn; })) return;
    var t=readTable(), any=false;
    ids.forEach(function(id){
      var b=G.ai.b[id], q=G.players[+id]; if(!b||!b.k||!q||!skillOf(G,q).learn) return; any=true;
      var won=teamOf(G,+id)===G.winner;
      KEYS.forEach(function(k){
        var d=b.k[k]-t.w[k], step=won?.25*d:-.06*d;
        t.w[k]=clamp(t.w[k]+clamp(step,-.05,.05),LO,HI);
      });
      t.t.games[b.t]++; if(won) t.t.wins[b.t]++;
    });
    if(any){ t.games++; writeTable(t); }
  }catch(e){}
}
/* a loaded game: the log holds only its last events, and the memory was saved with the brain, so they are not read twice */
function afterLoad(G){ try{ if(G&&G.ai&&G.ai.b) Object.keys(G.ai.b).forEach(function(id){ if(G.ai.b[id]) G.ai.b[id].pos=(G.log||[]).length; }); }catch(e){} }

U.Brain={ P:P, stats:stats, decide:decide, finish:finish, afterLoad:afterLoad, setStore:setStore, readTable:readTable, SKILL:SKILL, KEY:KEY, forget:forget, catchPlan:catchPlan, jumpPlan:jumpPlan, brainOf:brainOf, observe:observe, evalCard:evalCard, mkCtx:mkCtx };
if(typeof module!=="undefined"&&module.exports) module.exports=U.Brain;
})(typeof window!=="undefined"?window:globalThis);
