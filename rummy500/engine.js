/* 500 Rummy — pure game engine (no DOM). Used by the phone game and the Party Mode TV host.
   Cards: {id, r (1=A..13=K, 0=joker), s ('S','H','D','C','J'), joker?}. Melds hold {c:card, r:effective rank 1..14, s:effective suit}. */
(function(g){
"use strict";
var SUITS=["S","H","D","C"], SYM={S:"♠",H:"♥",D:"♦",C:"♣",J:"🃏"}, RED={H:1,D:1};
function rankLabel(r){ return r===1||r===14?"A":r===11?"J":r===12?"Q":r===13?"K":String(r); }
function cardLabel(c){ return c.joker?"Joker":rankLabel(c.r)+SYM[c.s]; }
function isNat(c){ return !c.joker; }

/* ---------------- options (defaults = the standard Pagat game) ---------------- */
function defaultOpts(){
  return {
    decksAuto:true, decks:1, jokers:2,   // jokers PER DECK; wild unless jokerMode:"group". Two decks are used automatically for 5+ players
    jokerMode:"wild",                    // "wild" | "group" (Persian: jokers only meld with other jokers)
    minNat:1,                            // natural cards required in a meld that contains a wild joker
    aceLow:true, aceHigh:true,           // A-2-3 and/or Q-K-A runs (never wrap-around)
    cardValues:"pips",                   // "pips": 2-9 face value | "five": 2-9 = 5 each
    aceValue:15, aceLowValue:1,          // ace in a set / high run / in hand; ace used low in A-2-3
    jokerValue:15,
    pickup:"buried",                     // "buried": only a card taken from UNDER the top must be used | "always": any pile card must be used at once
    deepestNewMeld:false,                // the deepest pile card must go into a NEW meld (not a lay-off)
    layOffOpp:true,                      // may lay off on opponents' melds
    layOffNeedsOwnMeld:false,            // must have your own meld on the table before laying off
    goOutNeedsDiscard:false,             // must discard your last card to go out
    goOutBonus:0,
    addOppHands:false,                   // out-player also scores the cards left in opponents' hands
    handPenalty:true,
    stockEndPenalty:true,                // false: when the stock runs out nobody loses their hand
    emptyStock:"end",                    // "end": hand ends when the player to draw can't take from the pile | "reshuffle"
    doubleFour:false,                    // Persian: a 4-card meld laid down at once counts double
    teams:false,                         // 4 players, partners sit opposite
    target:500,
    deals:0,                             // 0: play to the target | N: the game ends after N deals (Persian: 2), a tie plays one more deal
    dealsBonus:50,                       // after the last deal the side with the best score gets this bonus and wins
    winnerRule:"highest",                // "highest" | "outPlayer" (if several pass the target in one hand)
    mustGoOut:false                      // you must also have gone out to win
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) d[k]=o[k]; return d; }

/* ---------------- named versions (presets) ---------------- */
var VERSIONS=[
  {id:"standard",name:"Standard 500 Rum",tag:"Pagat",desc:"The classic game: 2 jokers (wild), take any card from the pile (only buried cards must be used), cards 2–9 at face value, ace 15 (1 in A-2-3).",opts:{}},
  {id:"classic",name:"Classic 500 Rum",tag:"Bicycle",desc:"No jokers. Any card you take from the pile must be used right away in a meld or lay-off.",opts:{jokers:0,pickup:"always"}},
  {id:"five",name:"5-10-15 Scoring",tag:"Wikipedia",desc:"Cards 2–9 are worth 5 each, 10–K are 10, ace is 15 (5 low). If several players pass 500, the player who went out wins. Nobody loses their hand when the stock runs out.",opts:{cardValues:"five",aceLowValue:5,winnerRule:"outPlayer",stockEndPenalty:false}},
  {id:"strict",name:"Strict 500",tag:"Tournament style",desc:"No jokers. You must discard to go out, pile pickups must be used, and the deepest card must go into a brand-new meld.",opts:{jokers:0,pickup:"always",deepestNewMeld:true,goOutNeedsDiscard:true}},
  {id:"partner",name:"Partnership 500",tag:"4 players, teams",desc:"Four players in two teams (partners sit opposite). Team scores are joint; partners can lay off on each other's melds.",opts:{teams:true}},
  {id:"persian",name:"Persian Rummy",tag:"4 players, teams",desc:"Partnership game with 4 jokers worth 20 that are NOT wild — they only meld with other jokers. A meld of exactly four laid at once counts double. Going out earns 25. The game is two deals; the side ahead then gets 50.",opts:{teams:true,jokers:4,decks:1,decksAuto:false,jokerMode:"group",jokerValue:20,doubleFour:true,goOutBonus:25,deals:2}}
];
/* house-rule toggles shown in the "Custom" setup: [key, label, kind, choices] */
var HOUSE=[
  ["jokers","Jokers","choice",[[0,"None"],[2,"2 per deck (wild)"],[4,"4 per deck"]]],
  ["deals","Game length","choice",[[0,"Play to the target score"],[2,"Two deals (+50 to the leader)"]]],
  ["cardValues","Card values","choice",[["pips","2–9 face value"],["five","2–9 = 5 each"]]],
  ["pickup","Taking from the pile","choice",[["buried","Only buried cards must be used"],["always","Any card must be used"]]],
  ["deepestNewMeld","Deepest pile card needs a NEW meld","bool"],
  ["layOffOpp","Lay off on opponents' melds","bool"],
  ["layOffNeedsOwnMeld","Need your own meld before laying off","bool"],
  ["goOutNeedsDiscard","Must discard to go out","bool"],
  ["goOutBonus","Going-out bonus","choice",[[0,"None"],[25,"25"],[50,"50"],[100,"100"]]],
  ["addOppHands","Out-player also scores opponents' hands","bool"],
  ["stockEndPenalty","Lose your hand when the stock runs out","bool"],
  ["target","Target score","choice",[[100,"100"],[300,"300"],[500,"500"],[750,"750"],[1000,"1000"]]],
  ["winnerRule","If several pass the target","choice",[["highest","Highest total wins"],["outPlayer","Player who went out wins"]]],
  ["mustGoOut","Must go out to win","bool"],
  ["minNat","Wild joker needs 2 natural cards in a meld","choice",[[1,"No"],[2,"Yes"]]]
];
function versionOpts(id,extra){ var v=VERSIONS.filter(function(x){ return x.id===id; })[0]||VERSIONS[0]; var o={}; for(var k in v.opts) o[k]=v.opts[k]; for(var k2 in (extra||{})) o[k2]=extra[k2]; return mergeOpts(o); }

/* ---------------- deck ---------------- */
function makeDeck(o){
  var cards=[], id=0;
  for(var d=0; d<o.decks; d++){
    SUITS.forEach(function(s){ for(var r=1;r<=13;r++) cards.push({id:id++,r:r,s:s,d:d}); });
    for(var j=0;j<o.jokers;j++) cards.push({id:id++,r:0,s:"J",d:d,joker:true});
  }
  return cards;
}
function shuffle(a,rnd){ rnd=rnd||Math.random; for(var i=a.length-1;i>0;i--){ var j=Math.floor(rnd()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

/* ---------------- card values ---------------- */
function pipValue(o,r){ if(r>=10&&r<=13) return 10; if(r===1||r===14) return o.aceValue; return o.cardValues==="five"?5:r; }
/* a melded card (kind = its meld's "set" | "run"): a joker always scores its flat value, never the card it stands for;
   an ace scores its low value only when used low in a run (A-2-3) — aces in a set score aceValue (Pagat) */
function meldCardValue(o,e,kind){
  if(e.c.joker) return o.jokerValue;
  return (e.r===1&&kind==="run")?o.aceLowValue:pipValue(o,e.r);
}
function handCardValue(o,c){ return c.joker?o.jokerValue:(c.r===1?o.aceValue:pipValue(o,c.r)); }

/* ---------------- building melds ---------------- */
function buildSet(cards,o){
  var n=cards.length; if(n<3||n>4) return null;
  var nat=cards.filter(isNat), jk=n-nat.length, i;
  if(o.jokerMode==="group"){
    if(jk===n) return {kind:"set",rank:0,cards:cards.map(function(c){ return {c:c,r:0,s:"J"}; })};
    if(jk>0) return null;
  }
  if(!nat.length) return null;
  if(jk>0&&nat.length<o.minNat) return null;
  var rank=nat[0].r;
  for(i=0;i<nat.length;i++) if(nat[i].r!==rank) return null;
  var seen={}; for(i=0;i<nat.length;i++){ if(seen[nat[i].s]) return null; seen[nat[i].s]=1; }
  var free=SUITS.filter(function(s){ return !seen[s]; });
  var out=[];
  nat.forEach(function(c){ out.push({c:c,r:rank,s:c.s}); });
  cards.filter(function(c){ return c.joker; }).forEach(function(c){ out.push({c:c,r:rank,s:free.shift()||"J"}); });
  return {kind:"set",rank:rank,cards:out};
}
/* runs: try ace-low and ace-high readings of the natural cards; jokers fill gaps then extend the ends */
function buildRun(cards,o){
  var n=cards.length; if(n<3||n>14) return null;
  var nat=cards.filter(isNat), jk=n-nat.length;
  if(o.jokerMode==="group"&&jk>0) return null;
  if(nat.length<(jk?Math.max(1,o.minNat):1)) return null;
  var suit=nat[0].s, i;
  for(i=0;i<nat.length;i++) if(nat[i].s!==suit) return null;
  var tries=[];
  var hasAce=nat.some(function(c){ return c.r===1; });
  if(!hasAce) tries.push(0); else { if(o.aceLow) tries.push(1); if(o.aceHigh) tries.push(14); }
  for(var t=0;t<tries.length;t++){
    var aceAs=tries[t];
    var ranks=nat.map(function(c){ return (c.r===1&&aceAs===14)?14:c.r; }).sort(function(a,b){ return a-b; });
    var dup=false; for(i=1;i<ranks.length;i++) if(ranks[i]===ranks[i-1]) dup=true;
    if(dup) continue;
    var lo=ranks[0], hi=ranks[ranks.length-1], span=hi-lo+1, gaps=span-ranks.length;
    if(gaps>jk) continue;
    var extra=jk-gaps; if(span+extra!==n) continue;
    var newLo=lo, newHi=hi, ex=extra;
    while(ex>0&&newHi<(o.aceHigh?14:13)){ newHi++; ex--; }
    while(ex>0&&newLo>1){ newLo--; ex--; }
    if(ex>0) continue;
    var entries=[], pool=nat.slice(), jokers=cards.filter(function(c){ return c.joker; }), ok=true;
    for(var r=newLo;r<=newHi;r++){
      var idx=-1; for(i=0;i<pool.length;i++){ var cr=(pool[i].r===1&&aceAs===14)?14:pool[i].r; if(cr===r){ idx=i; break; } }
      if(idx>=0){ entries.push({c:pool[idx],r:r,s:suit}); pool.splice(idx,1); }
      else if(jokers.length){ entries.push({c:jokers.shift(),r:r,s:suit}); }
      else { ok=false; break; }
    }
    if(!ok||pool.length) continue;
    if(entries[0].r<1||entries[entries.length-1].r>14) continue;
    if(entries[0].r===1&&!o.aceLow) continue;
    if(entries[entries.length-1].r===14&&!o.aceHigh) continue;
    return {kind:"run",suit:suit,lo:newLo,hi:newHi,cards:entries};
  }
  return null;
}
function buildMeld(cards,o){ return buildSet(cards,o)||buildRun(cards,o); }

/* lay a single card off on an existing meld; returns the new meld (a copy) or null */
function layOff(meld,card,o){
  var m;
  if(meld.kind==="set"){
    m=buildSet(meld.cards.map(function(e){ return e.c; }).concat([card]),o);   // a set joker's suit may stay unstated (Pagat)
    if(!m||m.rank!==meld.rank) return null;
  } else {
    m=extendRun(meld,card,o);
    if(!m) return null;
  }
  m.id=meld.id; m.owner=meld.owner; if(meld.double) m.double=meld.double;
  return m;
}
/* runs only grow at their ends and every card keeps its place: a melded joker's rank can never change (Pagat) */
function extendRun(meld,card,o){
  var es=meld.cards, lo=es[0].r, hi=es[es.length-1].r, min=o.aceLow?1:2, max=o.aceHigh?14:13, at=null;
  if(card.joker){
    if(o.jokerMode==="group") return null;
    at=hi<max?hi+1:(lo>min?lo-1:null);
  } else {
    if(card.s!==meld.suit) return null;
    if(card.r===1){
      if(es.some(function(e){ return !e.c.joker&&e.c.r===1; })) return null;   // one natural ace per run, as buildRun
      at=(lo===2&&o.aceLow)?1:(hi===13&&o.aceHigh)?14:null;
    } else if(card.r===lo-1||card.r===hi+1) at=card.r;
  }
  if(at==null) return null;
  var cards=es.map(function(e){ return {c:e.c,r:e.r,s:e.s}; }), add={c:card,r:at,s:meld.suit};
  if(at<lo) cards.unshift(add); else cards.push(add);
  return {kind:"run",suit:meld.suit,lo:Math.min(lo,at),hi:Math.max(hi,at),cards:cards};
}
function meldPoints(meld,o){ var s=0; meld.cards.forEach(function(e){ s+=meldCardValue(o,e,meld.kind)*(e.dbl?2:1); }); return s; }
function canLayOffAny(melds,card,o){ for(var i=0;i<melds.length;i++){ if(layOff(melds[i],card,o)) return melds[i].id; } return null; }

/* ---------------- candidate melds from a hand (for AI + hints) ---------------- */
function combos(arr,k){ var out=[]; (function rec(start,cur){ if(cur.length===k){ out.push(cur.slice()); return; } for(var i=start;i<arr.length;i++){ cur.push(arr[i]); rec(i+1,cur); cur.pop(); } })(0,[]); return out; }
function candidateMelds(hand,o){
  var out=[], seen={};
  function add(cs){ var m=buildMeld(cs,o); if(!m) return; var key=cs.map(function(c){ return c.id; }).sort(function(a,b){ return a-b; }).join(","); if(seen[key]) return; seen[key]=1; m.ids=cs.map(function(c){ return c.id; }); out.push(m); }
  var nat=hand.filter(isNat), allJ=hand.filter(function(c){ return c.joker; });
  var wild=o.jokerMode==="group"?[]:allJ;
  if(o.jokerMode==="group"&&allJ.length>=3){ for(var k0=3;k0<=Math.min(4,allJ.length);k0++) combos(allJ,k0).forEach(add); }
  var byRank={}; nat.forEach(function(c){ (byRank[c.r]=byRank[c.r]||[]).push(c); });
  Object.keys(byRank).forEach(function(r){
    var g2=byRank[r];
    for(var k=3;k<=Math.min(g2.length+wild.length,4);k++){
      for(var nn=Math.max(1,k-wild.length);nn<=Math.min(k,g2.length);nn++){
        combos(g2,nn).forEach(function(cs){ add(cs.concat(wild.slice(0,k-nn))); });
      }
    }
  });
  SUITS.forEach(function(s){
    var cs=nat.filter(function(c){ return c.s===s; });
    if(!cs.length) return;
    var maxLen=Math.min(cs.length+wild.length,14);
    for(var len=3;len<=maxLen;len++){
      for(var nn=Math.max(1,len-wild.length);nn<=Math.min(len,cs.length);nn++){
        combos(cs,nn).forEach(function(sub){
          var span=sub.map(function(c){ return c.r; });
          var mn=Math.min.apply(null,span), mx=Math.max.apply(null,span);
          if(mx-mn>len+1&&span.indexOf(1)<0) return;
          add(sub.concat(wild.slice(0,len-nn)));
        });
      }
    }
  });
  return out;
}
/* best set of disjoint melds from a hand = max total meld points (DFS over candidates) */
function bestMelds(hand,o){
  var cands=candidateMelds(hand,o);
  cands.sort(function(a,b){ return meldPoints(b,o)-meldPoints(a,o); });
  var best={pts:0,list:[]};
  (function dfs(i,used,pts,list){
    if(pts>best.pts) best={pts:pts,list:list.slice()};
    for(var k=i;k<cands.length;k++){
      var m=cands[k], clash=false;
      for(var j=0;j<m.ids.length;j++) if(used[m.ids[j]]){ clash=true; break; }
      if(clash) continue;
      m.ids.forEach(function(id){ used[id]=1; }); list.push(m);
      dfs(k+1,used,pts+meldPoints(m,o),list);
      list.pop(); m.ids.forEach(function(id){ delete used[id]; });
    }
  })(0,{},0,[]);
  return best;
}

g.Rummy={ SUITS:SUITS,SYM:SYM,RED:RED,VERSIONS:VERSIONS,HOUSE:HOUSE,rankLabel:rankLabel,cardLabel:cardLabel,defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOpts:versionOpts,
  makeDeck:makeDeck,shuffle:shuffle,pipValue:pipValue,meldCardValue:meldCardValue,handCardValue:handCardValue,
  buildSet:buildSet,buildRun:buildRun,buildMeld:buildMeld,layOff:layOff,meldPoints:meldPoints,canLayOffAny:canLayOffAny,
  candidateMelds:candidateMelds,bestMelds:bestMelds,isNat:isNat };
if(typeof module!=="undefined"&&module.exports) module.exports=g.Rummy;
})(typeof window!=="undefined"?window:globalThis);
