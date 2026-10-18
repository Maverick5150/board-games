/* MOTOCROSS WAR — one race = one game of War (pure, no DOM). Node: module.exports = MXWar.Race; browser: window.MXWar.Race.
   The CEO (2026-10-16): "each game of war should represent each race"; a heat / semi / LCQ is a set number of battles, the Main Event a long
   race (first about 200 battles; the CEO's ~16:55 update: Main 40; v2 (~18:30): Main 80 by default, round.js LEN; one battle = one LAP), then
   whoever has the most cards; the holeshot = the winner of the first battle; a starting gate. v2: every lap's cards are kept for the battle
   board (G.lastLap: the card each rider turned, the war cards [down, up] per war, the winner and the pot) and a short lap log (G.laps, 12).
   War's rules are PORTED from war/engine.js (read-only; the War builder's commit "war: three down, the fourth decides; aces wild (the CEO's
   rules)"), the parts that make sense in a race: Three-card War by default (3 face down, the 4th up decides; Classic = 1 down), only the
   riders tied for the top card go to war (the CEO's rule; House row off = everyone joins, Pagat), a tie on the deciding card is a double war
   between the tied riders, Rule A (your last card plays for the war; House Rule B = too few cards and you are out), a deadlock when every
   tied rider is out of cards (their cards are set aside), the cards that don't divide evenly go to the winner of the first war (Dummies),
   won cards go to the bottom in a random order, deuces / aces / jokers wild (House; "wild counts as" top or an Ace). Not in a race: Peace,
   Hand War, Tod und Leben, Drunkard, Război and the 2-player-only rows (prisoners, joker steal, colour deal...): a race is everyone at once.
   Cards: ids as in war/engine.js: 0..51 = suit*13 + (rank-2), 52/53 = jokers (rank 15), deck k = k*54 + id. Decks are SCALED to the gate:
   o.cards cards per rider (26 = half a deck each, as in a 2-player game; 13 / 52 for a shorter / longer race), decks = ceil(riders*cards/52).
   2..40 riders. A race ends at the flag (o.len battles; a battle in progress, wars included, finishes first) or when one rider holds every card.
   Finishing order (standings): riders still in by cards held (most first); equal cards: the higher card in the last battle (a photo
   finish; "who got there first" can't separate them: every rider still in plays every battle, so every count changes every battle),
   then the gate order. Riders who ran out are behind, the last one out ahead of
   the earlier ones (same battle: more cards going into that battle, then the higher last card, then the gate). Every rider has their own
   place 1..N (the CEO's rule: never a shared place).
   Play is simultaneous: every human rider in G.need turns a card ({t:"flip",s}); the computer riders never block. step(G) resolves the next
   phase for everyone still pending (auto play, sims, a quiet Party phone). A race starts in phase "gate": {t:"drop"} drops the gate.
   State G is plain JSON (G.rs = the seedable RNG), so a race saves and continues exactly. snapshot(G, seat) = the public view (no packet
   contents: in War nobody sees a face-down card, not even its owner).
   mxcrash (the CEO, 2026-10-16 20:06; BG_audit/games/mxwar/CRASH-CONTRACT.md): a lost DOUBLE war = a crash and a remount, a lost TRIPLE war
   (or deeper) = a crash OUT (DNF, classified behind the finishers; the remaining cards go to the war's winner); every crash raises a yellow
   flag for the next lap (G.yellow): see crash().
   mxtime (the CEO, 2026-10-17: "the cards decide REAL lap times"): when a race is built with a time-model info (newRace's 4th argument) G.tm
   (mxwar/time.js, MXWar.Time) turns every battle into a lap: endBattle calls MX.Time.lap(G) right after the battle, standings(G) is then the
   order of RACE TIMES (the same rows as before plus laps, t, gap, gs, int; the old cards order stays as chest(G)), and finish(G) takes the
   classification from the model. War itself (the pot, the wars, G.rs, the House rules) is untouched; a race without G.tm (an old save) runs
   exactly as before. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Race) return;
var VER=1, MINR=2, MAXR=40;
var SUITS=["S","H","D","C"], SYM={S:"♠",H:"♥",D:"♦",C:"♣",J:""};
var RNAME={11:"Jack",12:"Queen",13:"King",14:"Ace",15:"Joker"}, SNAME={S:"Spades",H:"Hearts",D:"Diamonds",C:"Clubs"};

/* ---------------- cards (as war/engine.js) ---------------- */
function base(id){ return id%54; }
function copyOf(id){ return (id/54)|0; }
function isJoker(id){ return id%54>=52; }
function rank(id){ id%=54; return id>=52?15:2+id%13; }
function suit(id){ id%=54; return id>=52?"J":SUITS[(id/13)|0]; }
function isRed(id){ id%=54; if(id>=52) return id===52; var s=(id/13)|0; return s===1||s===2; }
function rankLabel(r){ return r===15?"Joker":r===14?"A":r===13?"K":r===12?"Q":r===11?"J":String(r); }
function shortName(id){ return isJoker(id)?"Joker":rankLabel(rank(id))+SYM[suit(id)]; }
function cardName(id){ if(isJoker(id)) return isRed(id)?"Red Joker":"Black Joker"; var r=rank(id); return (RNAME[r]||String(r))+" of "+SNAME[suit(id)]; }
function plural(r){ return r===15?"Jokers":r===6?"6s":(RNAME[r]?RNAME[r]+"s":r+"s"); }

/* ---------------- RNG (mulberry32 in G.rs, as war/engine.js) ---------------- */
function rnd(G){ var t=(G.rs=(G.rs+0x6D2B79F5)>>>0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function rint(G,n){ return Math.floor(rnd(G)*n); }
function shuffle(G,a){ for(var i=a.length-1;i>0;i--){ var j=rint(G,i+1), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

/* ---------------- options ---------------- */
function defaultOpts(){
  return {
    version:"three",   // the CEO's War: Three-card War, 3 down and the 4th up decides
    down:3,            // face-down cards in a war (set by the Version; noDown = 0)
    onlyTied:true,     // the CEO's rule: only the riders tied for the top card fight the war (off = everyone joins, Pagat)
    outLoses:false,    // House (Rule B): too few cards to complete a war = you are out. Off = Rule A: your last card plays for the war
    noDown:false,      // House: no face-down card in a war (19th-century Bataille)
    deucesWild:false,  // House: every 2 is wild
    acesWild:false,    // House (the CEO): every Ace is wild
    jokersWild:false,  // House: 2 jokers join every deck and they are wild
    wildAs:"top",      // a wild card is: top (beats every card that isn't wild) | ace (counts as an Ace)
    cards:26,          // cards per rider (13 | 26 | 52): the decks scale with the gate. A season passes "auto" (the House row's default) and season.js
                       // turns it into 52 for a stadium race of more than 16 laps, else 26 (time.js cardsFor); here "auto" is read as 26
    len:30,            // battles ("laps") to the flag
    form:false         // House "Real form" (TASK.md, default OFF): riders with an edge (entrant.edge 1..2, the season gives it to the real
                       // top 10 of that year) swap their lowest card for a better one from a rider with no edge, once per edge point
                       // after the deal. Small on purpose: War stays a game of luck.
  };
}
var VERSIONS=[
  {id:"three",name:"Three-card War",tag:"3 down, the 4th decides",opts:{down:3}},
  {id:"classic",name:"Classic War",tag:"1 down, 1 up",opts:{down:1}}
];
/* [key, label, type, choices, house (1 = tag "House")] */
var HOUSE=[
  ["onlyTied","Only the tied riders go to war","bool",null,0],
  ["outLoses","Out of cards in a war = you're out","bool",null,1],
  ["noDown","No face-down cards in a war","bool",null,1],
  ["deucesWild","Deuces are wild","bool",null,1],
  ["acesWild","Aces are wild","bool",null,1],
  ["jokersWild","Jokers are wild","bool",null,1],
  ["wildAs","Wild cards count as","choice",[["top","Higher than every card"],["ace","An Ace"]],1],
  ["form","Real form: the year's top riders get a small edge","bool",null,1],
  ["cards","Cards per rider","choice",[["auto","Auto (52 in a long stadium race, else 26)"],[13,"13 (a quick race)"],[26,"26 (half a deck each)"],[52,"52 (a full deck each)"]],0]
];
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) if(o[k]!==undefined&&d.hasOwnProperty(k)) d[k]=o[k]; return d; }
function versionOf(id){ for(var i=0;i<VERSIONS.length;i++) if(VERSIONS[i].id===id) return VERSIONS[i]; return null; }
function normalize(o,n){
  var v=versionOf(o.version); if(!v){ o.version="three"; v=VERSIONS[0]; }
  o.down=v.opts.down;
  ["onlyTied","outLoses","noDown","deucesWild","acesWild","jokersWild","form"].forEach(function(k){ o[k]=!!o[k]; });
  if(o.noDown) o.down=0;
  o.wildAs=(o.wildAs==="ace"&&!o.acesWild)?"ace":"top";   // as war/engine.js: with Aces wild, "counts as an Ace" means nothing
  o.cards=+o.cards; if(o.cards!==13&&o.cards!==52) o.cards=26;
  o.len=Math.max(1,Math.min(2000,Math.floor(+o.len||30)));
  if(n<3) o.onlyTied=false;
  o.nd=Math.max(1,Math.ceil((n||2)*o.cards/52));
  return o;
}
function buildDeck(o){
  var d=[], k, i;
  for(k=0;k<o.nd;k++){ for(i=0;i<52;i++) d.push(k*54+i); if(o.jokersWild){ d.push(k*54+52); d.push(k*54+53); } }
  return d;
}

/* ---------------- comparing cards (war/engine.js winnersOf, without the Versions a race doesn't use) ---------------- */
function anyWild(o){ return !!(o.deucesWild||o.jokersWild||o.acesWild); }
function isWild(G,id){ var o=G.o||G; if(!anyWild(o)) return false; var b=id%54; return b>=52?!!o.jokersWild:((!!o.deucesWild&&b%13===0)||(!!o.acesWild&&b%13===12)); }
function val(G,id){ if(isWild(G,id)) return G.o.wildAs==="ace"?14:100; return rank(id); }
function winnersOf(G,ids){
  var i, w=[], best=-1;
  for(i=0;i<ids.length;i++){ var v=val(G,ids[i]); if(v>best){ best=v; w=[i]; } else if(v===best) w.push(i); }
  return w;
}
/* can any card in this game beat card c? (a deadlock test: the tied riders who are out of cards can never break their tie) */
function canBeat(G,c){
  var v=val(G,c), o=G.o, b;
  for(b=0;b<54;b++){ if(b>=52&&!o.jokersWild) continue; if(val(G,b)>v) return true; }
  return false;
}

/* ---------------- holdings ---------------- */
function total(G,s){ return G.r[s].pk.length; }
function canPlay(G,s){ var p=G.r[s]; return !p.out&&p.pk.length>0; }
function log(G,t,k){ G.log.push({t:t,k:k||"",b:G.battle}); if(G.log.length>40) G.log.splice(0,G.log.length-40); }
function nm(G,s){ return G.r[s].name; }
function names(G,arr){ var a=arr.map(function(s){ return nm(G,s); }); if(a.length>4) return a.slice(0,3).join(", ")+" and "+(a.length-3)+" more"; return a.length<=2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }

/* mxtime: the time model (mxwar/time.js), read lazily so the two files may load in either order */
function TM(){ return MX.Time||(typeof require==="function"?require("./time.js"):null); }

/* ---------------- a new race ----------------
   entrants: [{id, name, human}] in GATE order (the gate pick: index 0 picks first). seed: 32-bit int (the season draws it). */
function newRace(opts,entrants,seed,tminfo){
  var n=(entrants||[]).length; if(n<MINR||n>MAXR) throw new Error("A race is for 2 to 40 riders.");
  var o=normalize(mergeOpts(opts),n);
  var G={v:VER,id:"mxrace",o:o,n:n,rs:(seed==null?Math.floor(Math.random()*4294967296):seed)>>>0,
    r:entrants.map(function(e,i){ return {id:e&&e.id!=null?e.id:i,name:String((e&&e.name)||("Rider "+(i+1))),human:!!(e&&e.human),edge:o.form?Math.max(0,Math.min(2,(e&&e.edge)|0)):0,pk:[],out:false,outAt:-1,outN:0,bn:0,lc:0,crashes:0,dnf:null}; }),
    kitty:[],aside:[],tb:[],cur:{},part:[],bpart:[],warN:0,down:0,wars:0,phase:"gate",battle:0,need:[],pick:{},
    hs:-1,over:false,why:"",res:null,last:null,yellow:null,
    st:{won:[],led:[],wars:0,chain:0,pot:0,leader:-1,changes:0,crashes:0},log:[]};
  for(var i=0;i<n;i++){ G.st.won.push(0); G.st.led.push(0); }
  var deck=shuffle(G,buildDeck(o)), per=Math.floor(deck.length/n);
  for(i=0;i<per*n;i++) G.r[i%n].pk.push(deck[i]);
  for(;i<deck.length;i++) G.kitty.push(deck[i]);
  if(o.form) formEdge(G);
  if(tminfo){ var TM0=TM(); if(TM0) TM0.init(G,tminfo); }   /* mxtime: the lap times of this race (info: series, year, kind, L, p, fl, b), right after the deal */
  log(G,n+" riders behind the gate: "+deck.length+" cards ("+o.nd+(o.nd>1?" decks":" deck")+"), "+per+" each.","gate");
  if(G.kitty.length) log(G,G.kitty.length+" left-over card"+(G.kitty.length>1?"s go":" goes")+" to the winner of the first war.","gate");
  return G;
}

/* House "Real form": each edge point swaps the rider's lowest card with a random higher card of a random rider who has no edge */
function formEdge(G){
  var pool=[], s, k;
  for(s=0;s<G.n;s++) if(!G.r[s].edge) pool.push(s);
  if(!pool.length) return;
  for(s=0;s<G.n;s++) for(k=0;k<G.r[s].edge;k++){
    var me=G.r[s].pk, lo=0, i; for(i=1;i<me.length;i++) if(val(G,me[i])<val(G,me[lo])) lo=i;
    var them=G.r[pool[rint(G,pool.length)]].pk, j=rint(G,them.length);
    if(val(G,them[j])>val(G,me[lo])){ var t=me[lo]; me[lo]=them[j]; them[j]=t; }
  }
}

/* ---------------- moves ---------------- */
function fail(msg){ return {ok:false,msg:msg,ev:[]}; }
function onlyKeys(m,keys){ for(var k in m) if(keys.indexOf(k)<0) return false; return true; }
function needList(G){ return G.over?[]:G.need.filter(function(s){ return !G.pick[s]; }); }
function legal(G,s){
  if(G.over) return [];
  if(G.phase==="gate") return [{t:"drop"}];
  return G.need.indexOf(s)>=0&&!G.pick[s]?[{t:"flip",s:s}]:[];
}
function apply(G,m){
  if(!G||G.over) return fail("The race is over.");
  if(!m||typeof m!=="object") return fail("No move.");
  var ev=[];
  if(G.phase==="gate"){
    if(m.t!=="drop"||!onlyKeys(m,["t","s"])) return fail("The gate hasn't dropped yet.");
    dropGate(G,ev); return {ok:true,ev:ev};
  }
  if(m.t!=="flip"||!onlyKeys(m,["t","s"])) return fail("Turn up your card.");
  var s=+m.s; if(!G.r[s]) return fail("No such rider.");
  if(G.need.indexOf(s)<0||G.pick[s]) return fail(nm(G,s)+" has nothing to do now.");
  G.pick[s]=1; ev.push({e:"acted",s:s});
  if(allActed(G)) resolve(G,ev);
  return {ok:true,ev:ev};
}
function allActed(G){ for(var i=0;i<G.need.length;i++) if(!G.pick[G.need[i]]) return false; return true; }
/* everyone still pending acts (computers never wait; a human on Auto or a quiet Party phone) and the phase resolves */
function step(G){
  var ev=[]; if(!G||G.over) return ev;
  if(G.phase==="gate"){ dropGate(G,ev); return ev; }
  G.need.forEach(function(s){ if(!G.pick[s]){ G.pick[s]=1; ev.push({e:"acted",s:s,auto:true}); } });
  resolve(G,ev); return ev;
}
/* a whole battle (wars included) */
function battle(G){ var ev=[], b=G.battle, k=0; if(G.phase==="gate") dropGate(G,ev); while(!G.over&&G.battle===b&&k++<10000) ev=ev.concat(step(G)); return ev; }
function run(G){ var k=0; while(!G.over&&k++<1e6) step(G); return G; }
function defaultMove(G,s){ var L=legal(G,s); return L.length?L[0]:null; }

function dropGate(G,ev){
  ev.push({e:"gate",n:G.n,order:G.r.map(function(p,i){ return i; })});
  log(G,"The gate drops!","gate");
  startBattle(G);
}
function startBattle(G){
  G.phase="flip"; G.pick={}; G.warN=0; G.down=0; G.tb=[]; G.cur={}; G.part=[]; G.bpart=[];
  if(G.yellow&&G.yellow.lap<G.battle+1) G.yellow=null;   /* the yellow flag flies for the lap after the crash, then it's gone */
  G.need=[]; for(var s=0;s<G.n;s++) if(G.r[s].human&&canPlay(G,s)) G.need.push(s);
}
function resolve(G,ev){ if(G.phase==="flip") reveal(G,ev); else if(G.phase==="war") warFlip(G,ev); }

/* every card turns at once */
function reveal(G,ev){
  var cards=[]; G.part=[]; G.tb=[]; G.cur={}; G.warN=0;
  G.lap={b:G.battle+1,c:{},w:{}};   /* v2 battle board: the card every rider turned this lap, and the war cards */
  for(var s=0;s<G.n;s++){ var p=G.r[s]; if(!canPlay(G,s)) continue; p.bn=p.pk.length; var c=p.pk.shift(); G.part.push(s); G.tb.push({s:s,c:c,up:true,w:0}); G.cur[s]=c; G.lap.c[s]=c; cards.push({s:s,c:c}); }
  G.bpart=G.part.slice(); G.pick={}; G.need=[];
  ev.push({e:"reveal",w:0,b:G.battle+1,cards:cards});
  settle(G,ev);
}
function settle(G,ev){
  var o=G.o, part=G.part, ids=part.map(function(s){ return G.cur[s]; }), best=winnersOf(G,ids).map(function(i){ return part[i]; });
  if(best.length===1) return win(G,best[0],ev,true);
  var fighters=o.onlyTied?best:part.slice();
  /* war/engine.js: every tied rider out of cards = their last cards stay up and can never break the tie: a deadlock when no other fighter can
     lay a card or no card beats theirs (the cards are set aside, the battle ends; riders with no cards are out) */
  if(best.every(function(s){ return total(G,s)===0; })){
    var rest=fighters.filter(function(s){ return best.indexOf(s)<0&&total(G,s)>0; });
    if(!rest.length||!canBeat(G,G.cur[best[0]])) return deadlock(G,best,ev);
  }
  if(!fighters.some(function(s){ return total(G,s)>0; })) return deadlock(G,best,ev);
  startWar(G,fighters,best,ev);
}
function tieWord(G,best){
  var nat=best.filter(function(s){ return !isWild(G,G.cur[s]); }), wl=best.length-nat.length;
  if(!nat.length) return "wild cards";
  return plural(rank(G.cur[nat[0]]))+(wl?" and "+(wl>1?wl+" wild cards":"a wild card"):"");
}
function warWord(n){ return n<=1?"War!":n<=5?["Double","Triple","Quadruple","Quintuple"][n-2]+" war!":"War number "+n+"!"; }
function startWar(G,fighters,best,ev){
  var o=G.o, k=o.down; G.warN++; G.wars++; G.st.wars++;
  if(o.outLoses){
    var shortS=fighters.filter(function(s){ return total(G,s)<k+1; });
    if(shortS.length){
      shortS.forEach(function(s){ var p=G.r[s]; p.pk.forEach(function(c){ G.tb.push({s:s,c:c,up:false,w:G.warN}); }); p.pk=[]; });
      ev.push({e:"short",seats:shortS});
      log(G,names(G,shortS)+(shortS.length>1?" don't":" doesn't")+" have enough cards for the war: out.","out");
      var rest=fighters.filter(function(s){ return shortS.indexOf(s)<0; });
      if(!rest.length){ potAside(G,"short"); return endBattle(G,-1,ev); }
      if(rest.length===1) return win(G,rest[0],ev);
      fighters=rest;
    }
  }
  G.part=fighters; G.down=k; G.phase="war"; G.pick={};
  G.need=fighters.filter(function(s){ return G.r[s].human&&total(G,s)>0; });
  ev.push({e:"war",n:G.warN,seats:fighters.slice(),tied:best.slice(),down:k});
  log(G,warWord(G.warN)+" "+names(G,best)+" tie with "+tieWord(G,best)+".","war");
}
function warFlip(G,ev){
  var k=G.down, laid=[];
  G.part.forEach(function(s){
    var p=G.r[s], a=p.pk.length, nd=0, up=G.cur[s], held=true;
    if(a>0){
      nd=Math.min(k,a-1);
      for(var i=0;i<nd;i++){ G.tb.push({s:s,c:p.pk.shift(),up:false,w:G.warN}); }
      up=p.pk.shift(); G.tb.push({s:s,c:up,up:true,w:G.warN}); G.cur[s]=up; held=false;
    }
    laid.push({s:s,down:nd,c:up,held:held});
    if(G.lap){ (G.lap.w[s]=G.lap.w[s]||[]).push([nd,held?null:up]); }
  });
  G.pick={}; G.need=[];
  ev.push({e:"reveal",w:G.warN,cards:laid});
  settle(G,ev);
}
function potAside(G,how){
  var pot=G.tb.map(function(e){ return e.c; });
  pot.forEach(function(c){ G.aside.push(c); });
  G.last={b:G.battle+1,w:-1,n:pot.length,war:G.warN,how:how};
  G.tb=[]; return pot.length;
}
function deadlock(G,tied,ev){
  var n=potAside(G,"deadlock");
  ev.push({e:"deadlock",seats:tied.slice(),n:n});
  log(G,names(G,tied)+" tie with their last cards: "+n+" cards are set aside.","tie");
  return endBattle(G,-1,ev);
}
function win(G,w,ev,fought){
  var war=G.warN>0, pot=G.tb.map(function(e){ return e.c; }), kit=0;
  if(war&&G.kitty.length){ kit=G.kitty.length; G.kitty.forEach(function(c){ pot.push(c); }); G.kitty=[]; ev.push({e:"kitty",s:w,n:kit}); }
  shuffle(G,pot);
  var p=G.r[w]; pot.forEach(function(c){ p.pk.push(c); });
  G.st.won[w]++; if(G.warN>G.st.chain) G.st.chain=G.warN; if(pot.length>G.st.pot) G.st.pot=pot.length;
  G.last={b:G.battle+1,w:w,n:pot.length,war:G.warN,how:"win",c:G.cur[w]};
  ev.push({e:"win",s:w,n:pot.length,war:G.warN,c:G.cur[w]});
  if(G.hs<0){ G.hs=w; ev.push({e:"holeshot",s:w,b:G.battle+1}); log(G,"Holeshot: "+nm(G,w)+"!","holeshot"); }
  else log(G,nm(G,w)+(war?" wins the war":" wins")+" with "+shortName(G.cur[w])+(isWild(G,G.cur[w])?" (wild)":"")+" and takes "+pot.length+" cards.",war?"war":"win");
  G.tb=[];
  if(fought&&G.warN>=2) crash(G,w,ev);
  endBattle(G,w,ev);
}
/* CRASHES (the CEO, 2026-10-16 20:06; BG_audit/games/mxwar/CRASH-CONTRACT.md): when a war of depth 2 (a double war) is decided, every
   rider who fought in it and did not win it crashes and REMOUNTS (they race on; their cards follow War's normal outcome); depth 3 or more
   (a triple war ...): every rider who fought in it and did not win it crashes OUT (DNF for the rest of the race; their remaining cards go
   to the war's winner). Every crash raises a YELLOW FLAG for the next lap at the crash's place on the lap (sector 0..1, drawn here so
   every renderer agrees): no passing in that section for that lap (the renderer holds the order there; the engine records it in
   G.yellow). A war that ends without its deciding cards (House Rule B: the others were short) or a deadlock is not a crash. */
function crash(G,w,ev){
  var depth=G.warN, kind=depth>=3?"out":"remount", lap=G.battle+1, losers=G.part.filter(function(s){ return s!==w; });
  if(!losers.length) return;
  var sector=Math.round((0.12+0.76*rnd(G))*1000)/1000, gain=[];
  if(G.lap) G.lap.cr=(G.lap.cr||[]);
  losers.forEach(function(s){
    var p=G.r[s]; p.crashes=(p.crashes|0)+1; G.st.crashes=(G.st.crashes|0)+1;
    ev.push({e:"crash",s:s,lap:lap,kind:kind,depth:depth,by:w});
    if(G.lap) G.lap.cr.push({s:s,kind:kind});
    if(kind==="out"){
      p.outN=p.pk.length; p.pk.forEach(function(c){ gain.push(c); }); p.pk=[];
      p.out=true; p.outAt=lap; p.dnf={lap:lap,why:"crash",sector:sector};
    }
  });
  log(G,(kind==="out"?"Crash! "+names(G,losers)+(losers.length>1?" lose the ":" loses the ")+warWord(depth).replace("!","").toLowerCase()+" and crash"+(losers.length>1?"":"es")+" out":"Crash! "+names(G,losers)+(losers.length>1?" lose the double war and go down: they remount":" loses the double war and goes down: remounts"))+".","crash");
  if(gain.length){ shuffle(G,gain); gain.forEach(function(c){ G.r[w].pk.push(c); }); ev.push({e:"crashCards",s:w,n:gain.length}); }
  G.yellow={lap:lap+1,sector:sector,s:losers.slice()};
  losers.forEach(function(s){ ev.push({e:"yellow",lap:lap+1,s:s,sector:sector}); });
  log(G,"Yellow flag: no passing there next lap.","yellow");
  if(kind==="out") losers.forEach(function(s){ ev.push({e:"dnf",s:s,lap:lap,why:"crash"}); });
}
function endBattle(G,w,ev){
  var P=G.r, s;
  G.battle++;
  /* the lap just run, for the battle board and the lap log (plain JSON; a save from before v2 simply has none yet) */
  var L0=G.last||{}, lap=G.lap||{b:G.battle,c:{},w:{}};
  lap.b=G.battle; lap.win=w; lap.n=w>=0?(L0.n|0):0; lap.war=G.warN|0; lap.how=w>=0?"win":(L0.how||"deadlock"); lap.wc=w>=0&&G.cur[w]!=null?G.cur[w]:null; lap.aside=w<0?(L0.n|0):0;
  G.lastLap=lap; G.lap=null;
  if(!G.laps) G.laps=[];
  G.laps.push({b:lap.b,win:w,n:lap.n,war:lap.war,c:lap.wc,aside:lap.aside,cr:lap.cr?lap.cr.length:0}); if(G.laps.length>12) G.laps.splice(0,G.laps.length-12);
  G.bpart.forEach(function(x){ var c=G.cur[x]; if(c!=null) P[x].lc=val(G,c); });
  G.tb=[]; G.cur={}; G.part=[]; G.pick={}; G.need=[]; G.warN=0; G.down=0;
  var outs=[];
  for(s=0;s<G.n;s++){ var p=P[s]; if(p.out) continue; if(p.pk.length===0){ p.out=true; p.outAt=G.battle; p.outN=p.bn; p.dnf={lap:G.battle,why:"cards"}; outs.push(s); } }
  if(outs.length){ ev.push({e:"out",seats:outs,b:G.battle}); log(G,names(G,outs)+(outs.length>1?" are":" is")+" out of cards.","out");
    outs.forEach(function(x){ ev.push({e:"dnf",s:x,lap:G.battle,why:"cards"}); }); }
  G.bpart=[];
  if(G.tm){ var TM1=TM(); if(TM1) TM1.lap(G); }   /* mxtime: this battle is one lap: every rider's lap time, before the running order is read */
  var L=standings(G), lead=L[0].s; G.st.led[lead]++;
  if(lead!==G.st.leader){ if(G.st.leader>=0){ G.st.changes++; ev.push({e:"lead",s:lead,from:G.st.leader}); } G.st.leader=lead; }
  var alive=0; for(s=0;s<G.n;s++) if(!P[s].out) alive++;
  if(alive<=1) return finish(G,alive?"all":"deadlock",ev);
  if(G.battle>=G.o.len) return finish(G,"flag",ev);
  startBattle(G); ev.push({e:"next",b:G.battle+1});
}
function finish(G,why,ev){
  G.over=true; G.phase="over"; G.why=why; G.need=[]; G.pick={};
  var TM2=G.tm?TM():null;
  if(TM2) TM2.complete(G);   /* mxtime: a War that ended before the flag (every other rider out): the survivors ride the laps that are left */
  var L=standings(G); G.res=TM2?TM2.result(G).order:L.map(function(r){ return r.id; });
  ev.push({e:"flag",why:why,b:G.battle,order:L.map(function(r){ return r.s; })});
  log(G,why==="all"?nm(G,L[0].s)+" has every card: the race is over.":"Checkered flag! "+nm(G,L[0].s)+" wins"+(TM2?"":" with "+L[0].count+" cards")+".","flag");
}

/* ---------------- the running order: every rider their own place 1..N ---------------- */
/* the WAR CHEST order (the old running order, before the time model): riders still in by cards held; equal cards: the higher card in the last
   battle, then the gate order. A race with G.tm is ranked by time (standings below); the chest stays for the "cards" readouts and old saves. */
function cmp(G,a,b){
  var A=G.r[a], B=G.r[b];
  if(A.out!==B.out) return A.out?1:-1;
  if(!A.out){
    var d=B.pk.length-A.pk.length; if(d) return d;
  } else {
    if(A.outAt!==B.outAt) return B.outAt-A.outAt;   // the later out is ahead
    if(A.outN!==B.outN) return B.outN-A.outN;       // more cards going into that battle (a crash: cards held at the crash)
    var cA=!!(A.dnf&&A.dnf.why==="crash"), cB=!!(B.dnf&&B.dnf.why==="crash");
    if(cA&&cB) return a-b;                          // two crashes out in the same lap with the same cards: the gate order (the contract)
  }
  if(A.lc!==B.lc) return B.lc-A.lc;                 // photo finish: the higher card in the last battle
  return a-b;                                       // the gate order
}
function chest(G){
  var idx=[]; for(var s=0;s<G.n;s++) idx.push(s);
  idx.sort(function(a,b){ return cmp(G,a,b); });
  var top=G.r[idx[0]].pk.length;
  return idx.map(function(s,i){ var p=G.r[s]; return {s:s,id:p.id,name:p.name,human:p.human,count:p.pk.length,out:p.out,outAt:p.outAt,place:i+1,gap:p.out?null:top-p.pk.length,dnf:p.dnf||null,crashes:p.crashes|0}; });
}
/* the running order. With G.tm (mxtime) it is the order of RACE TIMES at the line: the old row (s, id, name, human, count = cards held, out, outAt,
   place, dnf, crashes) plus laps (laps ridden), t (race time at the line, ms), gap ("Leader" | "+3.412" | "+1 Lap" | "DNF"), gs (seconds behind the
   leader), int (seconds behind the rider ahead on the same lap, null if none), cgap (the old number: cards behind the card leader, null when out),
   cr (the model's crash record or null) and lastLap / bestLap (seconds). Every rider has their own place 1..N. */
function standings(G){
  var TM3=G.tm?TM():null;
  if(!TM3) return chest(G);
  var rows=TM3.standings(G), top=0, i, s;
  for(s=0;s<G.n;s++) if(G.r[s].pk.length>top) top=G.r[s].pk.length;
  return rows.map(function(r){ var p=G.r[r.s], R=G.tm.r[r.s], T=R.T, lt=T.length>1?(T[T.length-1]-T[T.length-2])/1000:(T.length?T[0]/1000:0);
    return {s:r.s,id:p.id,name:p.name,human:p.human,count:p.pk.length,out:p.out,outAt:p.outAt,place:r.place,gap:r.gap,dnf:p.dnf||null,crashes:p.crashes|0,
      laps:r.laps,t:r.t,gs:r.gs==null?null:r.gs,int:r.int==null?null:r.int,cgap:p.out?null:top-p.pk.length,cr:R.dnf||null,lastLap:lt}; });
}

/* who goes first: nobody (War is simultaneous); the opening show is the starting gate */
function firstPlayer(G){ return {rule:"none",simultaneous:true,show:"gate",why:"War has no first player: every rider turns a card at the same time. The opening show is the starting gate."}; }

/* ---------------- snapshot (Party phones; seat -1 = the TV): nothing is private in a race ---------------- */
function snapshot(G,seat){
  return {v:G.v,id:"mxrace",o:G.o,n:G.n,me:seat,phase:G.phase,battle:G.battle,len:G.o.len,need:needList(G),acted:Object.keys(G.pick).map(Number),
    riders:G.r.map(function(p,i){ return {s:i,id:p.id,name:p.name,human:p.human,out:p.out,count:p.pk.length,cur:G.cur[i]!=null?G.cur[i]:null,dnf:p.dnf||null,crashes:p.crashes|0}; }),
    yellow:G.yellow||null,
    table:G.tb.map(function(e){ return {s:e.s,w:e.w,up:e.up,c:e.up?e.c:null}; }),
    warN:G.warN,down:G.down,wars:G.wars,kitty:G.kitty.length,aside:G.aside.length,holeshot:G.hs,last:G.last,
    standings:standings(G),over:G.over,why:G.why,log:G.log.slice(-8).map(function(e){ return e.t; }),lastLap:G.lastLap||null,laps:(G.laps||[]).slice(),
    legal:seat>=0?legal(G,seat):[],
    tm:G.tm&&TM()?{k:G.tm.k,flag:G.tm.flag,start:G.tm.start,packet:TM().packet(G,G.tm.k),yz:G.tm.yz}:null};   /* mxtime: the lap just decided (T, holds, crash-outs, events), the yellow sections */
}

/* ---------------- invariants (tests, fuzz): [] = fine ---------------- */
function check(G){
  var err=[], seen={}, deck=buildDeck(G.o), s, i;
  function see(c,where){ if(seen[c]) err.push("card "+c+" twice ("+where+")"); seen[c]=1; }
  for(s=0;s<G.n;s++){ var p=G.r[s]; p.pk.forEach(function(c){ see(c,"pk"+s); }); if(p.out&&p.pk.length) err.push("out rider "+s+" holds cards"); if(!p.out&&!p.pk.length&&G.phase==="flip") err.push("rider "+s+" in with no cards"); }
  G.tb.forEach(function(e){ see(e.c,"table"); }); G.kitty.forEach(function(c){ see(c,"kitty"); }); G.aside.forEach(function(c){ see(c,"aside"); });
  var cnt=Object.keys(seen).length; if(cnt!==deck.length) err.push("cards "+cnt+" != "+deck.length);
  for(i=0;i<deck.length;i++) if(!seen[deck[i]]) { err.push("missing card "+deck[i]); break; }
  if(["gate","flip","war","over"].indexOf(G.phase)<0) err.push("phase "+G.phase);
  G.need.forEach(function(x){ if(!G.r[x]||!G.r[x].human) err.push("need "+x+" is not a human rider"); });
  if(G.over){ if(!G.res||G.res.length!==G.n) err.push("no result"); else { var u={}; G.res.forEach(function(id){ if(u[id]) err.push("result twice "+id); u[id]=1; }); } }
  if(G.battle>G.o.len) err.push("past the flag");
  if(G.tm&&G.tm.k>G.battle&&!(G.over&&G.why!=="flag")) err.push("the time model is ahead of the war ("+G.tm.k+" > "+G.battle+")");   /* (a War that ended early: complete() rides the laps that are left) */
  if(G.tm&&G.tm.k>G.tm.L) err.push("the time model rode past the flag");
  for(s=0;s<G.n;s++){ var q=G.r[s]; if(q.dnf&&!q.out) err.push("dnf rider "+s+" not out"); if(q.out&&q.dnf&&q.dnf.why!=="crash"&&q.dnf.why!=="cards") err.push("dnf why "+s); }
  return err;
}

MX.Race={VER:VER,MINR:MINR,MAXR:MAXR,defaultOpts:defaultOpts,VERSIONS:VERSIONS,HOUSE:HOUSE,normalize:normalize,mergeOpts:mergeOpts,buildDeck:buildDeck,
  newRace:newRace,legal:legal,apply:apply,step:step,battle:battle,run:run,defaultMove:defaultMove,need:needList,
  standings:standings,chest:chest,snapshot:snapshot,check:check,firstPlayer:firstPlayer,winnersOf:winnersOf,isWild:isWild,val:val,
  rank:rank,suit:suit,isRed:isRed,isJoker:isJoker,base:base,copyOf:copyOf,shortName:shortName,cardName:cardName,rankLabel:rankLabel,total:total};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Race;
})(typeof window!=="undefined"?window:globalThis);
