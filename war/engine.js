/* WAR — pure rules engine (no DOM). Node: module.exports = War.Engine; browser: window.War.Engine.
   Rules: BG_audit/games/war/RULES.md (Bicycle + Pagat decide; Wikipedia, Card Games For Dummies and French Wikipedia give the versions and
   house rules). Every Version and house rule is an option; the defaults are the official rules.
   Cards are integers: 0..51 = suit*13 + (rank-2), suits S H D C, ranks 2..14 (Ace = 14, as in rummy500/cards.js); 52 = red joker, 53 = black
   joker (rank 15, above the Aces). With more than one deck (2 to 16 players: 1 deck for 2-4, 2 for 5-8, 3 for 9-12, 4 for 13-16) the card of
   deck k is k*54 + that id, so base(id) = id % 54 gives the face and deck 1 keeps the ids 0..53 (one-deck games and old saves are unchanged).
   A packet's index 0 is its TOP card; won cards go to the end (the bottom), in a random order (no rule fixes
   the order, and a random order is what keeps the game finite: Lakshtanov & Roshchina) unless the "winner arranges" house rule is on.
   State G is plain JSON (saves + Party); G.v is the save-shape version; the RNG state is G.rs (seedable, so tests replay exactly).
   Play is simultaneous (no first player: Bicycle "at the same time"): every seat in G.need acts (flip / pick / claim); when the last one has
   acted, the engine resolves and apply() returns the events for the page to animate. snapshot(G, seat) = the public table + that seat's hand. */
(function(g){
"use strict";
var W=g.War=g.War||{};
var VER=1, SUITS=["S","H","D","C"], SYM={S:"♠",H:"♥",D:"♦",C:"♣",J:""};
var SNAME={S:"Spades",H:"Hearts",D:"Diamonds",C:"Clubs"}, RNAME={11:"Jack",12:"Queen",13:"King",14:"Ace"};
/* kn[] (who publicly holds a card): -1 never seen since the deal, -2 on the table, -3 in a one-pass won pile, -4 a prisoner, >=0 the seat
   whose packet it went into face down (everyone saw it collected). kt[] = the public collection stamp of that card (0 = the deal): a packet is a
   queue, so a player's hand and the top of their packet are always their OLDEST cards. The brain counts cards from these; nothing private is in them. */
var K_UNKNOWN=-1, K_TABLE=-2, K_WON=-3, K_PRISON=-4;

/* ---------------- cards ---------------- */
var MINP=2, MAXP=16, MAXD=4;
function base(id){ return id%54; }
function copyOf(id){ return (id/54)|0; }
function isJoker(id){ return id%54>=52; }
function rank(id){ id%=54; return id>=52?15:2+id%13; }
function suit(id){ id%=54; return id>=52?"J":SUITS[(id/13)|0]; }
function isRed(id){ id%=54; if(id>=52) return id===52; var s=(id/13)|0; return s===1||s===2; }
function rankLabel(r){ return r===15?"Joker":r===14?"A":r===13?"K":r===12?"Q":r===11?"J":String(r); }
function cardName(id){ if(isJoker(id)) return isRed(id)?"Red Joker":"Black Joker"; var r=rank(id); return (RNAME[r]||String(r))+" of "+SNAME[suit(id)]; }
function shortName(id){ return isJoker(id)?"Joker":rankLabel(rank(id))+SYM[suit(id)]; }
function card(id,G){ return {id:id,base:base(id),deck:copyOf(id),r:rank(id),s:suit(id),red:isRed(id),joker:isJoker(id),label:rankLabel(rank(id)),name:cardName(id),wild:G?isWild(G,id):false}; }
function plural(r){ return r===15?"Jokers":r===6?"6s":(RNAME[r]?RNAME[r]+"s":r+"s"); }

/* ---------------- RNG (mulberry32, state in G.rs) ---------------- */
function rnd(G){ var t=(G.rs=(G.rs+0x6D2B79F5)>>>0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function rint(G,n){ return Math.floor(rnd(G)*n); }
function shuffle(G,a){ for(var i=a.length-1;i>0;i--){ var j=rint(G,i+1), t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

/* ---------------- options / versions ---------------- */
function defaultOpts(){
  return {
    version:"classic",
    deck:52,            // 52 | 36 (6 to A, P'yanitsa) | 32 (7 to A: Tod und Leben, Bataille; also a shorter game)
    down:1,             // face-down cards in a war (0..5) or "rank" (Război: the tied rank sets the count)
    low:false,          // Peace: the lowest card wins
    special:0,          // a rank that beats an Ace (P'yanitsa: 6; house "2 beats Ace": 2)
    hand:0,             // Hand War: cards held in the hand (3 or 5); 0 = play the top card of the packet
    tie:"war",          // war | carry (Tod und Leben: tied cards go to the next battle's winner)
    length:"end",       // end (official) | time | battles | onepass
    limit:0,            // minutes ("time": the page rings the bell) or battles ("battles")
    shortTie:"sudden",  // equal leaders at a limit: sudden (play on until one leads) | draw
    outLoses:false,     // House (Rule B): too few cards to complete a war = you lose. Off = Rule A: your last card plays for the war
    jokers:"off",       // House: off | in (shuffled in) | each (2 players: one buried in each stack)
    jokerSteal:false,   // House (2 players): capturing the other player's joker in a war wins the game
    noDown:false,       // House: 19th-century Bataille, no face-down card in a war
    twos:false,         // House: Automatic War, a 2 declares war
    underdog:false,     // House: the loser of a war steals it if one of their face-down cards is a Jack
    prisoners:false,    // House: Prisoners of War
    paid:false,         // House: Paid battle, the loser also pays one card
    colourDeal:false,   // House: red vs black (4 players: a suit each)
    onlyTied:false,     // House (3-4 players): only the tied players fight a war (Pagat: everyone does)
    arrange:false,      // House: the winner arranges the won cards (War of Kingdoms)
    progressive:false,  // House: Progressive War, 5 down in the first war, one more in each later war
    guerilla:false,     // House: a joker always starts a war
    twoBeatsAce:false,  // House (low-documented): a 2 beats an Ace
    leftover:"war",     // cards that don't divide evenly: war (Dummies: they go to the first war's winner) | remove
    decks:0,            // House: 0 = by the player count (1 deck for 2-4, 2 for 5-8, 3 for 9-12, 4 for 13-16) | 1..4 set by hand
    nd:1,               // the deck count in play (normalize() works it out from decks and the player count)
    deucesWild:false,   // House: every 2 is wild (only decks that have 2s)
    jokersWild:false,   // House: the jokers are wild (2 jokers are added to every deck in play)
    wildAs:"top",       // what a wild card is: top (it beats every card that isn't wild; two wilds tie = a war) | ace (it counts as an Ace)
    cap:5000            // safety cap on battles (then the most cards wins)
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) if(o[k]!==undefined) d[k]=o[k]; return d; }
var VERSIONS=[
  {id:"classic",name:"Classic War",tag:"52 cards · 1 down, 1 up",desc:"Everyone turns up the top card at once; the highest takes them all to the bottom of their stack. A tie is a War: one card face down, one face up, the higher takes everything. Win every card.",opts:{}},
  {id:"three",name:"Three-card War",tag:"\"I declare war\": 3 down",desc:"The most common way to play a War: three cards face down, then one face up. The pot is ten cards, so the game moves faster.",opts:{down:3}},
  {id:"peace",name:"Peace",tag:"The lowest card wins",desc:"The opposite of War: the lowest card takes the battle. Ties still go to war, and the lowest new card wins it.",opts:{low:true}},
  {id:"hand",name:"Hand War",tag:"Hold 3, choose your card",desc:"Based on Trunks and Bataille ouverte: hold a hand of 3 from your stack, everyone chooses a card in secret, then all reveal. Refill after every battle. A tie is a War with cards from your stack.",opts:{hand:3}},
  {id:"razboi",name:"Război",tag:"Romania: the tied rank sets the war",desc:"In a war you lay down as many cards as the tied rank: 2 for a 2 up to 10 for a 10, J, Q or K, and 11 for an Ace. If someone is short, everyone uses the shortest count.",opts:{down:"rank"}},
  {id:"tod",name:"Tod und Leben",tag:"Germany: 32 cards, one pass",desc:"\"Life and Death\": 32 cards (7 to Ace), played once through with no recycling. A tie adds the cards to the next battle. Whoever has won the most cards wins.",opts:{deck:32,length:"onepass",tie:"carry"},lock:["deck","length","tie"]},
  {id:"drunkard",name:"Drunkard (P'yanitsa)",tag:"Russia: 36 cards, a 6 beats an Ace",desc:"36 cards, 6 to Ace. The Ace is high, but a 6 beats an Ace. Ties go to war as usual.",opts:{deck:36,special:6},lock:["deck","special"]}
];
var WARV=["classic","three","peace","hand","razboi","drunkard"];   // versions that fight wars (Tod und Leben carries ties instead)
/* [key, label, type, choices, house (1 = tag "House"), versions it applies to (null = all), minimum players] */
var HOUSE=[
  ["hand","Cards in your hand","choice",[[3,"3 (Trunks)"],[5,"5"]],0,["hand"]],
  ["deck","Deck","choice",[[52,"52 cards"],[32,"32 cards, 7 to Ace (a shorter game)"]],0,["classic","three","peace","hand","razboi"]],
  ["leftover","Cards that don't divide evenly","choice",[["war","Go to the first war's winner (Dummies)"],["remove","Set aside"]],0,["classic","three","peace","hand","razboi","drunkard"],3],
  ["outLoses","Out of cards in a war = you lose","bool",null,1,WARV],
  ["jokers","Jokers (above the Aces)","choice",[["off","Off"],["in","Shuffled in"],["each","One buried in each stack (2 players)"]],1],
  ["jokerSteal","Capture the other joker in a war to win (2 players)","bool",null,1,WARV,2],
  ["noDown","No face-down card (19th-century Bataille)","bool",null,1,WARV],
  ["twos","Automatic War: a 2 declares war","bool",null,1,WARV],
  ["underdog","Underdog: a Jack face down steals the war","bool",null,1,WARV],
  ["prisoners","Prisoners of War","bool",null,1,WARV],
  ["paid","Paid battle: the loser pays one more card","bool",null,1],
  ["colourDeal","Deal by colour (red vs black; 4 players: a suit each)","bool",null,1],
  ["onlyTied","Only the tied players fight a war","bool",null,1,WARV,3],
  ["arrange","Winner arranges the won cards","bool",null,1],
  ["progressive","Progressive War: 5 down, one more each war","bool",null,1,WARV],
  ["guerilla","Guerilla Joker: a joker always starts a war","bool",null,1,WARV],
  ["twoBeatsAce","2 beats Ace (low-documented)","bool",null,1,["classic","three","hand","razboi"]]
];
/* rows added with 2-16 players (same shape; [7] = "wild": show only while a wild rule is on). houseRows(version, n, o) = HOUSE + these,
   filtered for the version, the player count and the deck count (it also drops the choices that can't apply). HDESC_MORE = their one-liners. */
var HOUSE_MORE=[
  ["decks","Decks","choice",[[0,"By the player count"],[1,"1 deck"],[2,"2 decks"],[3,"3 decks"],[4,"4 decks"]],1],
  ["deucesWild","Deuces are wild","bool",null,1,["classic","three","peace","hand","razboi"]],
  ["jokersWild","Jokers are wild","bool",null,1],
  ["wildAs","Wild cards count as","choice",[["top","Higher than every card"],["ace","An Ace"]],1,null,0,"wild"]
];
var HDESC_MORE={
  decks:"Official: one deck for 2-4 players, two for 5-8, three for 9-12, four for 13-16. Pick 1 to 4 decks for a longer or shorter game.",
  deucesWild:"Every 2 is wild: it beats any card that isn't wild. Two wild cards tie, and that is a war.",
  jokersWild:"Two jokers join every deck, and they are wild: a joker beats any card that isn't wild. Two wild cards tie, and that is a war.",
  wildAs:"Higher than every card: only another wild card ties it. An Ace: a wild card counts as an Ace, so it ties an Ace and a war follows."
};
function houseRows(version,n,o){
  var nd=o?ndOf(o):autoDecks(n), wild=!!(o&&(o.deucesWild||o.jokersWild)), out=[];
  HOUSE.concat(HOUSE_MORE).forEach(function(h){
    if(!houseFor(h,version,n)) return;
    var k=h[0];
    if(k==="deck"&&versionOf(version)&&(versionOf(version).lock||[]).indexOf("deck")>=0) return;
    if(k==="jokerSteal"&&(n!==2||nd!==1)) return;
    if(k==="colourDeal"&&!colourOk(n,nd)) return;
    if(k==="deucesWild"&&o&&+o.deck===32) return;
    if(h[7]==="wild"&&!wild) return;
    if(k==="jokers"&&(n!==2||nd!==1)) h=h.slice(0,3).concat([h[3].filter(function(c){ return c[0]!=="each"; })],h.slice(4));
    out.push(h);
  });
  return out;
}
var LENGTHS=[
  {id:"end",name:"Play to the end",desc:"Official: until one player has every card."},
  {id:"time",name:"Time limit",limits:[5,10,15],unit:"min",desc:"At the bell the current battle finishes; the most cards wins."},
  {id:"battles",name:"Battle limit",limits:[50,100,200],unit:"battles",desc:"After that many battles the most cards wins."},
  {id:"onepass",name:"One pass through the deck",desc:"No recycling (as in Tod und Leben): when the stacks run out, the most cards won wins."}
];
function houseFor(h,version,n){ return (!h[5]||h[5].indexOf(version)>=0)&&(!h[6]||!n||n>=h[6]); }
function versionOf(id){ for(var i=0;i<VERSIONS.length;i++) if(VERSIONS[i].id===id) return VERSIONS[i]; return null; }
function versionOpts(id,extra){
  var v=versionOf(id)||VERSIONS[0], o={version:v.id}, k;
  for(k in v.opts) o[k]=v.opts[k];
  for(k in (extra||{})) if(k!=="version") o[k]=extra[k];
  return mergeOpts(o);
}
function normalize(o,n){
  var v=versionOf(o.version); if(!v){ o.version="classic"; v=VERSIONS[0]; }
  (v.lock||[]).forEach(function(k){ o[k]=v.opts[k]; });
  o.deck=+o.deck; if(o.deck!==36&&o.deck!==32) o.deck=52;
  var nd=Math.floor(+o.decks); if(nd>=1&&nd<=MAXD) o.decks=nd; else { o.decks=0; nd=autoDecks(n); } o.nd=nd;
  if(o.version==="drunkard") o.deck=36;
  if(o.version!=="drunkard"&&o.deck===36) o.deck=52;
  o.hand=o.version==="hand"?(+o.hand>=5?5:3):0;
  if(o.down!=="rank"){ o.down=Math.floor(+o.down); if(!(o.down>=0&&o.down<=5)) o.down=1; }
  if(o.tie!=="carry") o.tie="war";
  if(["end","time","battles","onepass"].indexOf(o.length)<0) o.length="end";
  o.limit=Math.max(0,Math.floor(+o.limit||0));
  if(o.length==="battles"&&o.limit<1) o.limit=100;
  if(o.length==="time"&&o.limit<1) o.limit=10;
  o.shortTie=o.shortTie==="draw"?"draw":"sudden";
  ["outLoses","jokerSteal","noDown","twos","underdog","prisoners","paid","colourDeal","onlyTied","arrange","progressive","guerilla","twoBeatsAce","low","deucesWild","jokersWild"].forEach(function(k){ o[k]=!!o[k]; });
  if(o.jokers!=="in"&&o.jokers!=="each") o.jokers="off";
  /* wild cards (House): the short decks have no 2s; wild jokers bring the jokers in and replace Guerilla Joker; a wild 2 replaces the two 2 rules */
  if(o.deck!==52) o.deucesWild=false;
  if(o.jokersWild){ if(o.jokers==="off") o.jokers="in"; o.guerilla=false; }
  if(o.deucesWild){ o.twos=false; o.twoBeatsAce=false; }
  o.wildAs=o.wildAs==="ace"?"ace":"top";
  if(o.tie==="carry"){ ["outLoses","jokerSteal","noDown","twos","underdog","prisoners","onlyTied","progressive","guerilla"].forEach(function(k){ o[k]=false; }); }
  if(o.jokerSteal){ if(n===2&&nd===1) o.jokers="each"; else o.jokerSteal=false; }   // one joker each: 2 players and one deck
  if(o.jokers==="each"&&(n!==2||nd!==1)) o.jokers="in";
  if(o.guerilla&&o.jokers==="off") o.jokers="in";
  if(n<3) o.onlyTied=false;
  if(n&&!colourOk(n,nd)) o.colourDeal=false;   // red vs black (2), a suit each (4), or whole suits (the 4 x decks suits shared evenly); 3 players with one deck have no fair split
  if(o.low) o.twoBeatsAce=false;
  o.special=o.version==="drunkard"?6:(o.twoBeatsAce&&o.deck===52?2:0);
  o.leftover=(o.leftover==="remove"||o.tie==="carry")?"remove":"war";   // no wars in Tod und Leben: a left-over card is set aside
  o.cap=Math.max(50,Math.min(100000,Math.floor(+o.cap||5000)));
  return o;
}

/* ---------------- the deck and comparing cards ---------------- */
function ndOf(o){ var k=o&&+o.nd; return k>=1&&k<=MAXD?k|0:1; }   // old saves have no nd: one deck
function autoDecks(n){ return n>=2?Math.min(MAXD,Math.max(1,Math.ceil(n/4))):1; }
function colourOk(n,nd){ return n===2||n===4||(4*nd)%n===0; }
function buildDeck(o){
  var lo=o.deck===32?7:o.deck===36?6:2, d=[], s, r, k, nd=ndOf(o);
  for(k=0;k<nd;k++){
    for(s=0;s<4;s++) for(r=lo;r<=14;r++) d.push(k*54+s*13+r-2);
    if(o.jokers&&o.jokers!=="off"){ d.push(k*54+52); d.push(k*54+53); }   // jokers: 2 for every deck in play
  }
  return d;
}
/* the deck line for setup: "2 decks · 104 cards", the share each and the cards left over */
function deckInfo(o,n){
  var nd=ndOf(o), d=buildDeck(o), cards=d.length, jk=d.filter(isJoker).length, each=o.jokers==="each"&&n===2, deal=each?cards-jk:cards;
  var per=n>=2?Math.floor(deal/n):deal, left=n>=2?deal-per*n:0;
  return {nd:nd,auto:!(+o.decks>=1),cards:cards,jokers:jk,per:per,left:left,jokerEach:each,
    text:nd+(nd===1?" deck":" decks")+" · "+cards+" cards"+(jk?" ("+jk+" jokers)":"")};
}
/* wild cards (House rules "Deuces are wild", "Jokers are wild") */
function isWild(G,id){ var o=G.o||G; if(!o.deucesWild&&!o.jokersWild) return false; var b=id%54; return b>=52?!!o.jokersWild:(!!o.deucesWild&&b%13===0); }
function lowRank(o){ return o.deck===32?7:o.deck===36?6:2; }
/* the rank a card plays at: a wild read "as an Ace" counts as the best natural card (an Ace; in Peace the lowest card) */
function playRank(G,id){ var o=G.o; if(o.wildAs==="ace"&&isWild(G,id)) return o.low?lowRank(o):14; return rank(id); }
function val(G,id){ var r=playRank(G,id); return G.o.low?-r:r; }
/* indices of the winning cards (more than one = a tie). Suits never break a tie. A "special" rank (P'yanitsa 6, house 2) beats an Ace only. */
function winnersOf(G,ids){
  var o=G.o, i, w=[], best=-1e9;
  if((o.deucesWild||o.jokersWild)&&o.wildAs!=="ace"){   // "top": a wild beats every card that isn't wild; wilds tie with each other
    for(i=0;i<ids.length;i++) if(isWild(G,ids[i])) w.push(i);
    if(w.length) return w;
  }
  if(o.special&&!o.low){
    var top=0; for(i=0;i<ids.length;i++) if(playRank(G,ids[i])>top) top=playRank(G,ids[i]);
    if(top===14){ for(i=0;i<ids.length;i++) if(rank(ids[i])===o.special&&!isWild(G,ids[i])) w.push(i); if(w.length) return w; }
  }
  for(i=0;i<ids.length;i++){ var v=val(G,ids[i]); if(v>best){ best=v; w=[i]; } else if(v===best) w.push(i); }
  return w;
}
function beats(G,a,b){ var w=winnersOf(G,[a,b]); return w.length===2?0:w[0]===0?1:-1; }
/* how strong a card is: the share of the other cards in this game's deck it beats (ties count half) */
function strength(G,c){ var t=strengthTable(G); return t[c]!=null?t[c]:.5; }
/* the whole table for this game's rules (cached per rule set): the brain fetches it once per decision */
function strengthTable(G){
  var o=G.o, key=o.deck+"|"+o.jokers+"|"+o.low+"|"+o.special+"|"+ndOf(o)+"|"+(o.deucesWild?1:0)+(o.jokersWild?1:0)+o.wildAs, m=strength.m||(strength.m={}), t=m[key];
  if(!t){   // the copies of a card (more decks) are identical: score each face once against the count of every face (a copy ties)
    t=m[key]={}; var d=buildDeck(o), cnt={}, faces=[];
    d.forEach(function(x){ var b=base(x); if(!cnt[b]){ cnt[b]=0; faces.push(b); } cnt[b]++; });
    var sb={}; faces.forEach(function(a){ var s=0; faces.forEach(function(b){ var k=a===b?cnt[b]-1:cnt[b]; if(k){ var x=beats(G,a,b); s+=k*(x>0?1:x===0?.5:0); } }); sb[a]=s/(d.length-1); });
    d.forEach(function(x){ t[x]=sb[base(x)]; });
  }
  return t;
}

/* ---------------- holdings ---------------- */
function total(G,s){ var p=G.players[s]; return p.pk.length+p.hand.length+p.won.length+p.pr.length; }
function avail(G,s){ var p=G.players[s]; return p.pk.length+p.hand.length; }          // cards that can go into a war
function canPlay(G,s){ var p=G.players[s]; return !p.out&&(p.pk.length+p.hand.length+p.pr.length)>0; }
function takeBlind(G,s){ var p=G.players[s]; if(p.pk.length) return p.pk.shift(); if(p.hand.length) return p.hand.splice(rint(G,p.hand.length),1)[0]; return -1; }
function refill(G){ if(!G.o.hand) return; G.players.forEach(function(p){ if(p.out) return; while(p.hand.length<G.o.hand&&p.pk.length) p.hand.push(p.pk.shift()); }); }
function log(G,t,k){ G.log.push({t:t,k:k||"",b:G.battle}); if(G.log.length>60) G.log.splice(0,G.log.length-60); }
function nm(G,s){ return G.players[s].name; }
function names(G,arr){ var a=arr.map(function(s){ return nm(G,s); }); return a.length<=2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }

/* ---------------- a new game ---------------- */
function newGame(opts,players,seed){
  var n=(players||[]).length; if(n<MINP||n>MAXP) throw new Error("War is for 2 to 16 players.");
  var o=normalize(mergeOpts(opts),n);
  var G={v:VER,id:"war",o:o,n:n,rs:(seed==null?Math.floor(Math.random()*4294967296):seed)>>>0,
    players:players.map(function(p,i){ return {name:String((p&&p.name)||("Player "+(i+1))),human:!!(p&&p.human),skill:(p&&p.skill)||null,pk:[],hand:[],won:[],pr:[],out:false,outAt:-1}; }),
    dealer:0,dealSeq:[],kitty:[],aside:[],carry:[],tb:[],cur:{},part:[],bpart:[],first:[],pick:{},need:[],usedPr:[],warN:0,down:0,pend:null,jok:null,
    kn:[],kt:[],kc:0,battle:0,wars:0,bell:false,sudden:false,suddenAt:0,phase:"flip",over:false,winner:-1,draw:null,why:"",last:null,
    stats:{wars:0,chain:0,pot:0,aces:[],won:[],lead:0,leader:-1,peak:[]},log:[]};
  for(var i=0;i<n;i++){ G.stats.aces.push(0); G.stats.won.push(0); G.stats.peak.push(0); }
  for(i=0;i<54*o.nd;i++){ G.kn.push(K_UNKNOWN); G.kt.push(0); }
  G.dealer=rint(G,n);
  deal(G); refill(G); trackLead(G);
  log(G,nm(G,G.dealer)+" deals "+buildDeck(o).length+" cards"+(o.nd>1?" ("+o.nd+" decks shuffled together)":"")+", one at a time.","deal");
  if(G.kitty.length) log(G,G.kitty.length===1?"One card is left over: it goes to the winner of the first war.":G.kitty.length+" cards are left over: they go to the winner of the first war.","deal");
  if(G.aside.length) log(G,G.aside.length+" left-over card"+(G.aside.length>1?"s are":" is")+" set aside.","deal");
  startBattle(G);
  strengthTable(G);   // build the card-strength table now (a few ms for 4 decks), not in the first computer decision
  return G;
}
function deal(G){
  var o=G.o, n=G.n, P=G.players, deck=buildDeck(o), seq=G.dealSeq=[], jk=[], i, s;
  if(o.jokers==="each"){ jk=deck.filter(isJoker); deck=deck.filter(function(id){ return !isJoker(id); }); }
  if(o.colourDeal&&colourOk(n,ndOf(o))){
    var piles=[], perm=[], nd=ndOf(o), units=[], per=0;
    if(n===2||n===4){ for(i=0;i<n;i++){ piles.push([]); perm.push(i); } shuffle(G,perm); }
    else { for(i=0;i<n;i++) piles.push([]); for(i=0;i<4*nd;i++) units.push(i); shuffle(G,units); per=4*nd/n; }   // whole suits: each player gets 4*decks/n of them
    deck.forEach(function(id){
      var b=base(id), su=b>=52?(b===52?1:0):((b/13)|0);   // a joker joins its deck's Hearts (red) or Spades (black)
      if(n===2||n===4) piles[perm[n===2?(isRed(id)?0:1):su]].push(id);   // 2: red vs black; 4: a suit each
      else piles[Math.floor(units.indexOf(copyOf(id)*4+su)/per)].push(id);
    });
    piles.forEach(function(p){ shuffle(G,p); });
    for(var k=0,more=true;more;k++){ more=false; for(var j=1;j<=n;j++){ s=(G.dealer+j)%n; if(piles[s].length>k){ P[s].pk.push(piles[s][k]); seq.push(s); more=true; } } }
  } else {
    shuffle(G,deck);
    var per=Math.floor(deck.length/n);
    for(i=0;i<per*n;i++){ s=(G.dealer+1+i)%n; P[s].pk.push(deck[i]); seq.push(s); }
    for(;i<deck.length;i++){ if(o.leftover==="remove") G.aside.push(deck[i]); else G.kitty.push(deck[i]); seq.push(-1); }
  }
  if(jk.length){ G.jok={}; for(i=0;i<jk.length&&i<n;i++){ var pk=P[i].pk; pk.splice(rint(G,pk.length+1),0,jk[i]); G.jok[jk[i]]=i; seq.push(i); } }
}

/* ---------------- the turn ---------------- */
function startBattle(G){
  G.phase="flip"; G.pick={}; G.usedPr=[]; G.warN=0; G.down=0; G.tb=[]; G.cur={}; G.part=[]; G.bpart=[]; G.first=[];
  G.need=[]; for(var s=0;s<G.n;s++) if(canPlay(G,s)) G.need.push(s);
}
function allActed(G){ for(var i=0;i<G.need.length;i++) if(!G.pick[G.need[i]]) return false; return true; }
function fail(msg){ return {ok:false,msg:msg,ev:[]}; }

/* the move API: {t:"flip",s[,pr]} | {t:"pick",s,c} (Hand War) | {t:"claim",s,pr,order} */
function legal(G,s){
  var p=G.players[s], out=[]; if(!p||G.over) return out;
  if(G.phase==="claim"){ if(G.pend&&G.pend.w===s){ out.push({t:"claim",s:s,pr:null}); G.pend.prOk.forEach(function(c){ out.push({t:"claim",s:s,pr:c}); }); } return out; }
  if(G.need.indexOf(s)<0) return out;
  if(G.phase==="flip"){
    if(G.o.hand) p.hand.concat(p.pr).forEach(function(c){ out.push({t:"pick",s:s,c:c}); });
    else { if(p.pk.length) out.push({t:"flip",s:s}); p.pr.forEach(function(c){ out.push({t:"flip",s:s,pr:c}); }); }
  } else if(G.phase==="war") out.push({t:"flip",s:s});
  return out;
}
function needList(G){ return G.over?[]:G.need.slice(); }
function apply(G,m){
  if(!G||G.over) return fail("The game is over.");
  if(!m||typeof m!=="object") return fail("No move.");
  var s=+m.s, p=G.players[s], ev=[]; if(!p) return fail("No such player.");
  if(G.phase==="claim"){
    if(m.t!=="claim"||!G.pend||s!==G.pend.w) return fail("Waiting for "+(G.pend?nm(G,G.pend.w):"the winner")+" to collect.");
    var pr=m.pr==null?null:+m.pr;
    if(pr!=null&&G.pend.prOk.indexOf(pr)<0) return fail("That card can't be taken prisoner.");
    var order=null;
    if(m.order!=null){
      var rest=G.pend.pot.slice(); if(pr!=null) rest.splice(rest.indexOf(pr),1);
      if(!Array.isArray(m.order)||m.order.length!==rest.length) return fail("Arrange every won card.");
      var a=m.order.map(Number).slice().sort(function(x,y){ return x-y; }), b=rest.slice().sort(function(x,y){ return x-y; });
      for(var i=0;i<a.length;i++) if(a[i]!==b[i]) return fail("Arrange the cards you won.");
      if(G.o.arrange) order=m.order.map(Number);
    }
    collect(G,pr,order,ev); return {ok:true,ev:ev};
  }
  if(G.need.indexOf(s)<0) return fail(p.name+" has nothing to do now.");
  if(G.phase==="flip"){
    if(G.o.hand){
      if(m.t!=="pick") return fail("Choose a card from your hand.");
      var c=+m.c; if(p.hand.indexOf(c)<0&&p.pr.indexOf(c)<0) return fail("That card isn't in your hand.");
      G.pick[s]={c:c};
    } else {
      if(m.t!=="flip") return fail("Turn up your card.");
      if(m.pr!=null){ if(p.pr.indexOf(+m.pr)<0) return fail("That prisoner isn't yours."); G.pick[s]={pr:+m.pr}; }
      else if(!p.pk.length){ if(!p.pr.length) return fail("No cards."); G.pick[s]={pr:p.pr[0]}; }
      else G.pick[s]={f:1};
    }
    ev.push({e:"acted",s:s});
    if(allActed(G)) reveal(G,ev);
  } else if(G.phase==="war"){
    if(m.t!=="flip"||m.pr!=null) return fail("Lay down your war cards.");
    G.pick[s]={f:1}; ev.push({e:"acted",s:s});
    if(allActed(G)) warFlip(G,ev);
  } else return fail("Nothing to do.");
  return {ok:true,ev:ev};
}
/* every card turns at once */
function reveal(G,ev){
  var cards=[]; G.part=G.need.slice(); G.bpart=G.part.slice(); G.usedPr=[]; G.tb=[]; G.cur={}; G.warN=0;
  G.part.forEach(function(s){
    var p=G.players[s], k=G.pick[s], c, i;
    if(k.pr!=null){ c=k.pr; p.pr.splice(p.pr.indexOf(c),1); G.usedPr.push(s); }
    else if(k.c!=null){ c=k.c; i=p.hand.indexOf(c); if(i>=0) p.hand.splice(i,1); else { p.pr.splice(p.pr.indexOf(c),1); G.usedPr.push(s); } }
    else c=p.pk.shift();
    G.tb.push({s:s,c:c,up:true,w:0}); G.cur[s]=c; G.kn[c]=K_TABLE; cards.push({s:s,c:c});
  });
  G.first=cards.slice(); G.pick={}; G.need=[];
  ev.push({e:"reveal",w:0,cards:cards});
  settle(G,ev);
}
function settle(G,ev){
  var o=G.o, part=G.part, ids=part.map(function(s){ return G.cur[s]; }), best=winnersOf(G,ids).map(function(i){ return part[i]; });
  var forced=o.tie==="war"&&ids.some(function(c){ return (o.twos&&rank(c)===2)||(o.guerilla&&isJoker(c)); });
  if(best.length===1&&!forced) return win(G,best[0],ev);
  if(o.tie==="carry"){
    G.tb.forEach(function(e){ G.carry.push(e.c); });
    ev.push({e:"carry",seats:best,n:G.carry.length});
    log(G,names(G,best)+" tie with "+tieWord(G,best)+": the "+G.carry.length+" cards go to the next battle's winner.","tie");
    G.last={b:G.battle+1,w:-1,cards:[],from:[],first:G.first.slice(),war:0,how:"carry",pr:null};
    G.tb=[]; return endBattle(G,-1,ev);
  }
  var fighters=(o.onlyTied&&!forced)?best:part.slice();
  if(!fighters.some(function(s){ return avail(G,s)>0; })){
    if(best.length===1) return win(G,best[0],ev);
    return deadlock(G,best,ev);
  }
  startWar(G,fighters,best,forced&&best.length===1,ev);
}
/* what the tied cards were, for the log: "Kings", "wild cards", "Aces and a wild card" */
function tieWord(G,best){
  var nat=best.filter(function(s){ return !isWild(G,G.cur[s]); }), wl=best.length-nat.length;
  if(!nat.length) return "wild cards";
  return plural(rank(G.cur[nat[0]]))+(wl?" and "+(wl>1?wl+" wild cards":"a wild card"):"");
}
function sn(G,id){ return shortName(id)+(isWild(G,id)?" (wild)":""); }
function downCount(G,fighters,tiedRank){
  var o=G.o;
  if(o.progressive) return 4+G.wars;                     // Pagat: 5 in the first war of the game, one more in every later war
  if(o.noDown) return 0;
  if(o.down==="rank"){
    var k=tiedRank>=14?11:tiedRank>=11?10:tiedRank, m=99;  // Război: 2..10, J/Q/K = 10, A (and a joker) = 11
    fighters.forEach(function(s){ m=Math.min(m,Math.max(0,avail(G,s)-1)); });   // short? everyone uses the shortest count
    return Math.min(k,m);
  }
  return o.down;
}
function startWar(G,fighters,best,forced,ev){
  var o=G.o; G.warN++; G.wars++; G.stats.wars++;
  var c0=G.cur[best[0]], k=downCount(G,fighters,isWild(G,c0)?14:rank(c0));   // Război: a wild tie lays as many as an Ace
  if(o.outLoses){
    var shortS=fighters.filter(function(s){ return avail(G,s)<k+1; });
    if(shortS.length){
      shortS.forEach(function(s){
        var p=G.players[s], all=p.pk.concat(p.hand,p.pr); p.pk=[]; p.hand=[]; p.pr=[];
        all.forEach(function(c){ G.tb.push({s:s,c:c,up:false,w:G.warN}); G.kn[c]=K_TABLE; });
        p.out=true; p.outAt=G.battle+1;
      });
      ev.push({e:"short",seats:shortS});
      log(G,names(G,shortS)+(shortS.length>1?" don't":" doesn't")+" have enough cards for the war and "+(shortS.length>1?"lose.":"loses."),"out");
      var rest=fighters.filter(function(s){ return shortS.indexOf(s)<0; });
      if(!rest.length){
        var others=[]; for(var s=0;s<G.n;s++) if(!G.players[s].out&&total(G,s)>0) others.push(s);
        if(!others.length){ potAside(G,"short"); return finishDraw(G,shortS,"short",ev); }
        potAside(G,"short"); return endBattle(G,-1,ev);
      }
      if(rest.length===1) return win(G,rest[0],ev);
      fighters=rest;
    }
  }
  G.part=fighters; G.down=k; G.phase="war"; G.pick={};
  G.need=fighters.filter(function(s){ return avail(G,s)>0; });
  ev.push({e:"war",n:G.warN,seats:fighters,tied:best,down:k,forced:!!forced});
  var twoUp=o.twos&&fighters.some(function(s){ return rank(G.cur[s])===2; });
  var why=forced?(twoUp?"A 2 declares war":"A joker declares war"):names(G,best)+" tie with "+tieWord(G,best);
  log(G,(G.warN>1?"Double war! ":"I declare war! ")+why+": "+(k?k+" face down, then one up.":"the next cards decide."),"war");
}
function warFlip(G,ev){
  var k=G.down, laid=[];
  G.part.forEach(function(s){
    var a=avail(G,s), nd=0, up=G.cur[s], held=true;
    if(a>0){
      nd=Math.min(k,a-1);
      for(var i=0;i<nd;i++){ var c=takeBlind(G,s); G.tb.push({s:s,c:c,up:false,w:G.warN}); G.kn[c]=K_TABLE; }
      up=takeBlind(G,s); G.tb.push({s:s,c:up,up:true,w:G.warN}); G.kn[up]=K_TABLE; G.cur[s]=up; held=false;
    }
    laid.push({s:s,down:nd,c:up,held:held});
  });
  G.pick={}; G.need=[];
  ev.push({e:"reveal",w:G.warN,cards:laid});
  settle(G,ev);
}
function potAside(G,how){
  var pot=G.tb.map(function(e){ return e.c; }).concat(G.carry); G.carry=[];
  pot.forEach(function(c){ G.aside.push(c); G.kn[c]=K_UNKNOWN; });
  G.last={b:G.battle+1,w:-1,cards:pot,from:G.tb.map(function(e){ return e.s; }),first:G.first.slice(),war:G.warN,how:how,pr:null};
  G.tb=[]; return pot.length;
}
/* every fighter is out of cards and the top cards still tie (Pagat: "the game is a draw") */
function deadlock(G,tied,ev){
  var others=[]; for(var s=0;s<G.n;s++) if(G.part.indexOf(s)<0&&!G.players[s].out&&total(G,s)>0) others.push(s);
  var n=potAside(G,"deadlock");
  ev.push({e:"deadlock",seats:tied,n:n});
  log(G,names(G,tied)+" tie with their last cards.","tie");
  if(G.o.length!=="onepass"&&!others.length) return finishDraw(G,tied,"deadlock",ev);
  return endBattle(G,-1,ev);
}
function win(G,w,ev){
  var o=G.o, war=G.warN>0, how="win", i;
  if(o.underdog&&war){
    var losers=G.part.filter(function(s){ return s!==w&&!G.players[s].out; })   /* a player knocked out by Rule B can't steal */.sort(function(a,b){ return (a-w+G.n)%G.n-(b-w+G.n)%G.n; });
    for(i=0;i<losers.length;i++){
      var l=losers[i];
      if(G.tb.some(function(e){ return e.s===l&&!e.up&&e.w===G.warN&&rank(e.c)===11; })){
        ev.push({e:"underdog",s:l,from:w}); log(G,"Underdog! "+nm(G,l)+" has a Jack face down and steals the war from "+nm(G,w)+".","war");
        w=l; how="underdog"; break;
      }
    }
  }
  var pot=G.tb.map(function(e){ return e.c; }), from=G.tb.map(function(e){ return e.s; });
  G.carry.forEach(function(c){ pot.push(c); from.push(-1); }); G.carry=[];
  if(war&&G.kitty.length){ ev.push({e:"kitty",s:w,n:G.kitty.length}); G.kitty.forEach(function(c){ pot.push(c); from.push(-1); }); G.kitty=[]; }
  var paid=0;
  G.bpart.forEach(function(s){
    if(s===w) return;
    var owe=(o.paid?1:0)+(G.usedPr.indexOf(s)>=0?1:0);
    for(var j=0;j<owe;j++){ var c=takeBlind(G,s); if(c<0) break; pot.push(c); from.push(s); G.kn[c]=K_TABLE; paid++; ev.push({e:"pay",s:s,to:w}); }
  });
  /* Prisoners of War (Wikipedia): the winner of a battle may take one of the other players' cards as a prisoner (never their own); after a war
     the face-down cards may be captured too */
  var prOk=o.prisoners?G.tb.filter(function(e){ return e.s!==w&&(e.up||war); }).map(function(e){ return e.c; }):[];
  var steal=false;
  if(o.jokerSteal&&war&&G.jok) pot.forEach(function(c){ if(isJoker(c)&&G.jok[c]!=null&&G.jok[c]!==w) steal=true; });
  G.pend={w:w,pot:pot,from:from,war:G.warN,prOk:prOk,how:how,steal:steal,paid:paid};
  ev.push({e:"win",s:w,n:pot.length,war:G.warN,how:how});
  var wc=G.cur[w];
  if(!war&&G.bpart.length===2){ var lo=G.bpart[0]===w?G.bpart[1]:G.bpart[0]; log(G,nm(G,w)+"'s "+sn(G,wc)+" beats "+nm(G,lo)+"'s "+sn(G,G.cur[lo])+".","win"); }
  else log(G,nm(G,w)+(war?" wins the war":" wins")+(wc!=null&&how!=="underdog"?" with "+sn(G,wc):"")+" and takes "+pot.length+" cards"+(paid?" ("+paid+" paid)":"")+".","win");
  if((o.arrange&&pot.length>1)||prOk.length){ G.phase="claim"; G.need=[w]; ev.push({e:"claim",s:w,prOk:prOk.slice(),arrange:o.arrange}); return; }
  collect(G,null,null,ev);
}
function collect(G,pr,order,ev){
  var pd=G.pend, w=pd.w, p=G.players[w], pot=pd.pot.slice(), i;
  if(pr!=null){ pot.splice(pot.indexOf(pr),1); p.pr.push(pr); G.kn[pr]=K_PRISON; ev.push({e:"prisoner",s:w,c:pr}); log(G,nm(G,w)+" takes the "+shortName(pr)+" prisoner.","win"); }
  if(order) pot=order.slice(); else shuffle(G,pot);
  var one=G.o.length==="onepass", dest=one?p.won:p.pk;
  G.kc++; pot.forEach(function(c){ dest.push(c); G.kn[c]=one?K_WON:w; G.kt[c]=G.kc; });
  for(i=0;i<pd.pot.length;i++) if(pd.from[i]!==w&&pd.from[i]>=0&&rank(pd.pot[i])===14) G.stats.aces[w]++;
  G.stats.won[w]++; if(pd.war>G.stats.chain) G.stats.chain=pd.war; if(pd.pot.length>G.stats.pot) G.stats.pot=pd.pot.length;
  G.last={b:G.battle+1,w:w,cards:pd.pot.slice(),from:pd.from.slice(),first:G.first.slice(),war:pd.war,how:pd.how,pr:pr};
  ev.push({e:"collect",s:w,cards:pot.slice(),to:one?"won":"packet"});
  var steal=pd.steal; G.pend=null;
  endBattle(G,w,ev,steal);
}
function trackLead(G){
  var best=-1, L=-1, tie=false;
  for(var s=0;s<G.n;s++){ var t=total(G,s); if(t>G.stats.peak[s]) G.stats.peak[s]=t; if(G.players[s].out) continue; if(t>best){ best=t; L=s; tie=false; } else if(t===best) tie=true; }
  if(!tie&&L>=0&&L!==G.stats.leader){ if(G.stats.leader>=0) G.stats.lead++; G.stats.leader=L; }
}
function leaders(G){
  var best=-1, L=[];
  for(var s=0;s<G.n;s++){ if(G.players[s].out) continue; var t=total(G,s); if(t>best){ best=t; L=[s]; } else if(t===best) L.push(s); }
  return L;
}
function endBattle(G,w,ev,steal){
  var o=G.o, P=G.players, s;
  G.battle++; G.tb=[]; G.cur={}; G.part=[]; G.bpart=[]; G.pick={}; G.need=[]; G.usedPr=[]; G.warN=0; G.down=0; G.pend=null;
  if(o.length!=="onepass") for(s=0;s<G.n;s++) if(!P[s].out&&total(G,s)===0){ P[s].out=true; P[s].outAt=G.battle; ev.push({e:"out",s:s}); log(G,nm(G,s)+" is out of cards.","out"); }
  refill(G); trackLead(G);
  if(steal) return finish(G,w,"joker",ev);
  if(o.length!=="onepass"){
    var alive=[]; for(s=0;s<G.n;s++) if(!P[s].out) alive.push(s);
    if(alive.length===1) return finish(G,alive[0],"all",ev);
    if(!alive.length){ var lastOut=[]; for(s=0;s<G.n;s++) if(P[s].outAt===G.battle) lastOut.push(s); return finishDraw(G,lastOut,"all",ev); }
  } else {
    var pl=0; for(s=0;s<G.n;s++) if(canPlay(G,s)) pl++;
    if(pl<2) return finishByCount(G,"onepass",ev);
  }
  if(G.sudden){
    var L=leaders(G); if(L.length===1) return finish(G,L[0],"sudden",ev);
    if(G.battle-G.suddenAt>=100||G.battle>=o.cap) return finishDraw(G,L,"sudden",ev);
  } else if((o.length==="battles"&&G.battle>=o.limit)||G.bell) return finishByCount(G,o.length==="battles"?"battles":"time",ev);
  else if(G.battle>=o.cap) return finishByCount(G,"cap",ev);
  startBattle(G); ev.push({e:"next",b:G.battle+1});
}
function finishByCount(G,why,ev){
  var L=leaders(G);
  if(L.length===1) return finish(G,L[0],why,ev);
  if(why!=="onepass"&&why!=="cap"&&G.o.shortTie==="sudden"&&!G.sudden&&L.length>1){
    G.sudden=true; G.suddenAt=G.battle; ev.push({e:"sudden",seats:L});
    log(G,names(G,L)+" are tied: sudden death, the next battle that breaks the tie wins.","sudden");
    startBattle(G); return;
  }
  return finishDraw(G,L,why,ev);
}
function finish(G,w,why,ev){
  G.over=true; G.phase="over"; G.winner=w; G.draw=null; G.why=why; G.need=[]; G.pick={};
  if(w>=0&&G.kitty.length){ G.kc++; G.kitty.forEach(function(c){ G.players[w].pk.push(c); G.kn[c]=w; G.kt[c]=G.kc; }); G.kitty=[]; }
  ev.push({e:"over",winner:w,why:why});
  log(G,why==="joker"?nm(G,w)+" captures the other joker and wins!":why==="all"?nm(G,w)+" has every card and wins!":nm(G,w)+" has the most cards and wins!","over");
}
function finishDraw(G,seats,why,ev){
  G.over=true; G.phase="over"; G.winner=-1; G.draw=seats.slice(); G.why=why; G.need=[]; G.pick={};
  if(G.tb.length) potAside(G,why);
  ev.push({e:"over",winner:-1,draw:seats.slice(),why:why});
  log(G,"The game is a draw between "+names(G,seats)+".","over");
}
/* time limit: the page rings the bell; the current battle (and its wars) finishes first */
function ringBell(G){
  var ev=[]; if(!G||G.over||G.o.length==="onepass"||G.bell) return ev;
  G.bell=true; log(G,"Time! The battle in play finishes, then the most cards wins.","bell");
  if(G.phase==="flip"&&!Object.keys(G.pick).length&&!G.sudden) finishByCount(G,"time",ev);
  return ev;
}

/* a move for a seat that is out of time, on Auto, or a Party phone that went quiet */
function defaultMove(G,s){
  if(G.phase==="claim"&&G.pend&&G.pend.w===s){
    var best=null; G.pend.prOk.forEach(function(c){ if(best==null||strength(G,c)>strength(G,best)) best=c; });
    return {t:"claim",s:s,pr:best};
  }
  var L=legal(G,s); if(!L.length) return null;
  if(G.o.hand&&G.phase==="flip") return L[rint(G,L.length)];
  return L[0];
}

/* ---------------- who goes first: nobody (simultaneous); the opening show is the deal ---------------- */
function firstPlayer(G){
  return {rule:"none",simultaneous:true,show:"deal",dealer:G.dealer,seq:G.dealSeq.slice(),
    why:"War has no first player: everyone turns a card at the same time (Bicycle, Pagat). The opening show is the deal, one card at a time."};
}

/* ---------------- standings: leader first ---------------- */
function standings(G){
  var rows=G.players.map(function(p,s){ return {s:s,name:p.name,human:p.human,count:total(G,s),out:p.out,outAt:p.outAt}; });
  rows.sort(function(a,b){
    if(G.over&&G.winner>=0){ if(a.s===G.winner) return -1; if(b.s===G.winner) return 1; }
    if(a.out!==b.out) return a.out?1:-1;
    if(a.out&&b.out&&a.outAt!==b.outAt) return b.outAt-a.outAt;
    if(b.count!==a.count) return b.count-a.count;
    return a.s-b.s;
  });
  rows.forEach(function(r,i){
    var prev=rows[i-1];
    r.place=(prev&&!(G.over&&G.winner===prev.s)&&prev.out===r.out&&prev.count===r.count&&(!r.out||prev.outAt===r.outAt))?prev.place:i+1;
    r.share=0;
  });
  var all=buildDeck(G.o).length; rows.forEach(function(r){ r.share=all?r.count/all:0; });
  return rows;
}

/* ---------------- snapshot for one seat (Party phones; -1 = the public TV view) ---------------- */
function snapshot(G,seat){
  var me=seat>=0?G.players[seat]:null;
  var s={v:G.v,id:"war",o:G.o,n:G.n,nd:ndOf(G.o),me:seat,phase:G.phase,battle:G.battle,wars:G.wars,dealer:G.dealer,
    need:needList(G),acted:Object.keys(G.pick).map(Number),
    players:G.players.map(function(p,i){ return {s:i,name:p.name,human:p.human,out:p.out,count:total(G,i),packet:p.pk.length,hand:p.hand.length,won:p.won.length,pr:p.pr.slice(),cur:G.cur[i]!=null?G.cur[i]:null,wild:G.cur[i]!=null&&isWild(G,G.cur[i])}; }),
    table:G.tb.map(function(e){ return {s:e.s,w:e.w,up:e.up,c:e.up?e.c:null,wild:e.up&&isWild(G,e.c)}; }),
    warN:G.warN,down:G.down,kitty:G.kitty.length,aside:G.aside.length,carry:G.carry.slice(),
    pend:G.pend?{w:G.pend.w,n:G.pend.pot.length,war:G.pend.war,how:G.pend.how}:null,
    last:G.last,stats:G.stats,standings:standings(G),over:G.over,winner:G.winner,draw:G.draw,why:G.why,bell:G.bell,sudden:G.sudden,
    log:G.log.slice(-8).map(function(e){ return e.t; }),
    hand:me?me.hand.slice():[],pick:(me&&G.pick[seat])?G.pick[seat]:null,legal:me?legal(G,seat):[]};
  if(me&&G.pend&&G.pend.w===seat){ s.pend.pot=G.pend.pot.slice(); s.pend.prOk=G.pend.prOk.slice(); }
  return s;
}

/* ---------------- invariants (tests, fuzz): [] = fine ---------------- */
function check(G){
  var err=[], seen={}, deck=buildDeck(G.o), s, top=54*ndOf(G.o);
  function put(c,where){ if(typeof c!=="number"||!(c>=0&&c<top)) err.push("bad card "+c+" in "+where); else if(seen[c]) err.push("card "+c+" twice ("+seen[c]+", "+where+")"); else seen[c]=where; }
  G.players.forEach(function(p,i){ p.pk.forEach(function(c){ put(c,"pk"+i); }); p.hand.forEach(function(c){ put(c,"hand"+i); }); p.won.forEach(function(c){ put(c,"won"+i); }); p.pr.forEach(function(c){ put(c,"pr"+i); });
    if(p.out&&G.o.length!=="onepass"&&total(G,i)>0) err.push("player "+i+" is out but holds cards");
    if(G.o.hand&&!p.out&&p.hand.length>G.o.hand) err.push("hand too big "+i);
    if(!G.o.hand&&p.hand.length) err.push("hand outside Hand War "+i); });
  G.kitty.forEach(function(c){ put(c,"kitty"); }); G.aside.forEach(function(c){ put(c,"aside"); });
  if(G.phase==="claim"){ if(!G.pend) err.push("claim without pend"); else G.pend.pot.forEach(function(c){ put(c,"pend"); }); }
  else { G.tb.forEach(function(e){ put(e.c,"table"); }); G.carry.forEach(function(c){ put(c,"carry"); }); }
  deck.forEach(function(c){ if(!seen[c]) err.push("card "+c+" missing"); });
  if(Object.keys(seen).length!==deck.length) err.push("card count "+Object.keys(seen).length+" != "+deck.length);
  if(["flip","war","claim","over"].indexOf(G.phase)<0) err.push("bad phase "+G.phase);
  if(G.over&&G.winner<0&&!(G.draw&&G.draw.length)) err.push("over with no winner or draw");
  if(!G.over){
    if(!G.need.length) err.push("nobody to act");
    G.need.forEach(function(x){ if(!G.players[x]||G.players[x].out) err.push("an out player must act "+x); });
    if(G.phase==="flip"&&G.need.length<2) err.push("a battle with fewer than 2 players");
    if(G.phase!=="claim"&&G.tb.length&&G.phase==="flip") err.push("table not cleared");
    for(s=0;s<G.n;s++) if(G.phase==="flip"&&canPlay(G,s)&&G.need.indexOf(s)<0) err.push("seat "+s+" left out");
  }
  if(G.kn.length!==top||G.kt.length!==top) err.push("card tables sized "+G.kn.length+" for "+top);
  if(G.v!==VER) err.push("save version");
  return err;
}

W.Engine={VER:VER,MINP:MINP,MAXP:MAXP,MAXD:MAXD,HOUSE_MORE:HOUSE_MORE,HDESC_MORE:HDESC_MORE,houseRows:houseRows,autoDecks:autoDecks,ndOf:ndOf,deckInfo:deckInfo,colourOk:colourOk,
  isWild:isWild,isJoker:isJoker,base:base,copyOf:copyOf,playRank:playRank,VERSIONS:VERSIONS,HOUSE:HOUSE,LENGTHS:LENGTHS,WARV:WARV,houseFor:houseFor,defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOpts:versionOpts,normalize:normalize,
  buildDeck:buildDeck,newGame:newGame,legal:legal,apply:apply,need:needList,defaultMove:defaultMove,ringBell:ringBell,firstPlayer:firstPlayer,standings:standings,snapshot:snapshot,check:check,
  total:total,avail:avail,canPlay:canPlay,winnersOf:winnersOf,beats:beats,strength:strength,strengthTable:strengthTable,rank:rank,suit:suit,isRed:isRed,card:card,cardName:cardName,shortName:shortName,rankLabel:rankLabel,
  K_UNKNOWN:K_UNKNOWN,K_TABLE:K_TABLE,K_WON:K_WON,K_PRISON:K_PRISON,_rnd:rnd};
if(typeof module!=="undefined"&&module.exports) module.exports=W.Engine;
/* browsers: bring in the brain right after this file (the page and the Party pages all load engine.js); a failed load = computers just flip */
if(typeof document!=="undefined"&&document.currentScript&&document.currentScript.src&&document.readyState==="loading"&&!W.Brain){
  try{ document.write('<script src="'+document.currentScript.src.replace(/engine\.js(\?.*)?$/,"brain.js")+'"><\/script>'); }catch(e){}
}
})(typeof window!=="undefined"?window:globalThis);
