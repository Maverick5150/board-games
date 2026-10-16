/* CANDY LAND — pure rules engine (no DOM). Node: module.exports = Candy.Engine; browser: window.Candy.Engine.
   Rules: BG_audit/games/candy/RULES.md (researched 2026-10-16; the source keys in brackets are listed there). "Candy Land" is the game's
   name only: every picture, landmark and name on our board is original (RULES.md 7.2). The squares' colours and the positions of the
   picture squares, sticky squares and shortcuts are rules, not art, so they are kept exactly per edition.
   Versions (the two editions whose board AND deck are documented, RULES.md 3):
     v2004 Classic 2004 (default) - the 2004 Hasbro board [HAS04; DG; TAS]: 134 squares, the last one a rainbow square that matches every
                 colour; 64 cards (6 singles of each colour, doubles 4/4/4/4/3/3, 6 picture cards); 3 licorice squares = lose your next turn;
                 official options "Younger players" (picture cards only send you forward) and "Older players" (draw two, choose one).
     v1984 Classic 1984 - the 1984 Milton Bradley board [MB84; SCH; COMAP]: 134 squares, the last one purple; 64 cards (singles 8/8/8/8/7/7,
                 2 doubles of each colour, 6 picture cards); 3 sticky squares = stuck until you draw that square's colour; a colour card
                 that would pass the last square wins.
   Both: START is square 0 (off the path); a single card = the next square of its colour, a double = the second (pink squares are never
   counted); a picture card = straight to that pink square, forward or back; a shortcut start reached by exact count by a colour move =
   glide to its end [MB84 3C; HAS04 3]; tokens share squares; youngest player first, then to the left; one card a turn; the first to
   reach the goal wins at once; the draw pile empty = shuffle the discards into a new pile [WM 10; R67 9]. House rules default off.
   State G is plain JSON (saves + Party); G.v is the save-shape version; the RNG state is G.rs (mulberry32, seedable: tests replay exactly).
   Cards are ids 0..63 into CARDS[G.dk]; the draw pile G.deck (top = last), the discard pile G.disc (top = last), G.aside (picture cards
   set aside by "Treats only once"), G.hand (the two cards of "draw two" while the player chooses).
   Moves: {t:"draw", s}; with draw two then {t:"pick", s, i:0|1}. The cards are drawn here, never on a phone. apply() returns events for
   the page to animate in order: reshuffle, draw (one per card), choose, then move (EVERY square hopped in path; kind colour / picture),
   bump, shortcut (its own glide), sticky / licorice (its own banner), stay / stuck, redraw, discard, finish / over, skip (a lost turn), turn.
   snapshot(G, seat) = the public table (nothing is private in this game; the order of the draw pile and the RNG stay out). */
(function(g){
"use strict";
var CY=g.Candy=g.Candy||{};
var VER=1, MINP=2, MAXP=4, END=134;
var COLS=["R","P","Y","B","O","G"];
var CNAME={R:"red",P:"purple",Y:"yellow",B:"blue",O:"orange",G:"green",W:"rainbow"};

/* ---------------- the boards (RULES.md 1.2 and 1.3) ----------------
   Colours follow the strict cycle R P Y B O G from square 1, skipping the pink picture squares (and, in 2004, the rainbow square 134). */
function buildTrack(pinks,rainbow){
  var sq=["S"], k=0;
  for(var n=1;n<=END;n++){
    if(pinks.indexOf(n)>=0) sq.push("*");
    else if(n===END&&rainbow) sq.push("W");
    else { sq.push(COLS[k%6]); k++; }
  }
  return sq.join("");
}
/* our original names (RULES.md 7.2; none of the official characters or places) */
var PIC_NAMES=["Marshmallow Meadow","Jellybean Grove","Toffee Tower","Cotton-Cloud Fair","Sherbet Springs","Meringue Peaks"];
var GOAL_NAME="the Sugarspire";
var BOARDS={
  /* 1984 [SCH cl.cpp; photo; COMAP; MB84]: pink 9 18 43 75 96 104; shortcuts orange 5 -> purple 59, purple 34 -> purple 47;
     sticky yellow 48, blue 86, red 121 (stuck until that colour); last square purple 134 */
  b84:{id:"b84",name:"1984 board",track:buildTrack([9,18,43,75,96,104],false),pics:[9,18,43,75,96,104],
    short:{5:59,34:47},shortName:{5:"Ribbon Glide",34:"Wafer Bridge"},
    sticky:{48:"Y",86:"B",121:"R"},stickyKind:"until",stickyName:{48:"Caramel Bog",86:"Taffy Tangle",121:"Fudge Mire"}},
  /* 2004 [DG map; TAS; HAS04]: pink 9 20 42 69 92 102; shortcuts orange 5 -> purple 59, yellow 35 -> green 45;
     licorice purple 47, blue 86, yellow 117 (lose the next turn); last square 134 = rainbow (any colour lands there) */
  b04:{id:"b04",name:"2004 board",track:buildTrack([9,20,42,69,92,102],true),pics:[9,20,42,69,92,102],
    short:{5:59,35:45},shortName:{5:"Ribbon Glide",35:"Wafer Bridge"},
    sticky:{47:1,86:1,117:1},stickyKind:"lose",stickyName:{47:"Licorice Knot",86:"Licorice Loop",117:"Licorice Twist"}}
};

/* ---------------- the decks (RULES.md 1.2 and 1.3) ----------------
   Ids: colour by colour (R P Y B O G) its singles, then its doubles; then the picture cards 0..5 (picture k = the k-th pink square). */
var DECKS={
  d84:{single:[8,8,8,8,7,7],dbl:[2,2,2,2,2,2],pics:6},   // [MB84 "64 cards"; COMAP; GH]
  d04:{single:[6,6,6,6,6,6],dbl:[4,4,4,4,3,3],pics:6}    // [HAS04 "64 Cards"; DG; TAS; GH]
};
var CARDS={};
function cardsOf(dk){
  if(CARDS[dk]) return CARDS[dk];
  var d=DECKS[dk], out=[], i, k;
  COLS.forEach(function(c,ci){
    for(i=0;i<d.single[ci];i++) out.push({id:out.length,c:c,n:1,ty:c+"1"});
    for(i=0;i<d.dbl[ci];i++) out.push({id:out.length,c:c,n:2,ty:c+"2"});
  });
  for(k=0;k<d.pics;k++) out.push({id:out.length,pic:k,ty:"*"+k});
  return (CARDS[dk]=out);
}

/* ---------------- RNG (mulberry32, state in G.rs) ---------------- */
function rnd(G){ var t=(G.rs=(G.rs+0x6D2B79F5)>>>0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
function shuffle(G,a){ for(var i=a.length-1;i>0;i--){ var j=Math.floor(rnd(G)*(i+1)), x=a[i]; a[i]=a[j]; a[j]=x; } return a; }

/* ---------------- options / versions ---------------- */
function defaultOpts(){
  return {
    version:"v2004",
    older:false,      // "Older players": draw two, choose one (2004 official option [HAS04]; House on the 1984 board)
    younger:false,    // "Younger players": a picture card that would send you back is discarded and you draw again (2004 official option)
    exact:true,       // the CEO's rule (2026-10-16), on by default: you need the last square's colour to win. A card must land exactly on
                      // the last square; a card that would take you past it does not move you [WIK; SCH]. Off = the printed 1984 rule
                      // [MB84 4]: any colour card that would pass the last purple square wins. Moot on the 2004 rainbow square (normalize)
    noShare:false,    // House (2013+ rule): an occupied colour square sends you on to the next free square of that colour; an occupied
                      // picture square: draw again [HAS13; HASW; HASDP; HASGG; HAS25]
    treatsOnce:false, // House (2025 rule): a picture card is used once a game, then set aside [HAS25]
    youngest:-1       // the seat of the youngest human (computers have no age); -1 = nobody picked: seat 1 starts (RULES.md 2.2)
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) if(o[k]!==undefined&&d.hasOwnProperty(k)) d[k]=o[k]; return d; }
var VERSIONS=[
  {id:"v2004",name:"Classic 2004",tag:"Rainbow finish · licorice = lose a turn",board:"b04",deck:"d04",
    desc:"The 2004 board: 134 squares to a rainbow square that any colour reaches. 64 cards. Land on one of the 3 licorice squares and you lose your next turn. Two shortcuts, taken only on an exact landing. Official options for younger and older players.",
    opts:{},lock:[]},
  {id:"v1984",name:"Classic 1984",tag:"Sticky squares · land on the last purple to win",board:"b84",deck:"d84",
    desc:"The 1984 board: 134 squares, the last one purple. 64 cards. Land on one of the 3 sticky squares and you are stuck there until you draw a card of that square's colour. To win you need purple: a card must land exactly on the last purple square (the rule at this table; the printed rule, any card past the end wins, is a switch).",
    opts:{},lock:[]}
];
/* [key, label, type, choices, house (0 = official option, 1 = House), versions it applies to (null = all), minimum players, needs, tag] */
var HOUSE=[
  ["younger","Younger players: no going back","bool",null,0,["v2004"],0,null,"Official option"],
  ["older","Older players: draw two, choose one","bool",null,0,["v2004"],0,null,"Official option"],
  ["younger","No going back","bool",null,1,["v1984"],0,null,"House"],
  ["older","Draw two, choose one","bool",null,1,["v1984"],0,null,"House"],
  ["exact","You need the last colour to win","bool",null,1,["v1984"],0,null,"House"],
  ["noShare","No sharing squares","bool",null,1,null,0,null,"House"],
  ["treatsOnce","Picture cards only once","bool",null,1,null,0,null,"House"]
];
var HDESC={
  younger:"A picture card that would send you backward is put on the discard pile and you draw a new card instead. (Printed in the 2004 rules for younger players.)",
  older:"Draw two cards, choose the one you want to play, then discard both. (Printed in the 2004 rules for older players: it helps children learn to make decisions and speeds the game up.)",
  exact:"On (the usual way at this table): you need a card of the last square's colour that lands exactly on it, so on this board only purple wins; a card that would take you past the end does not move you. Off: the printed 1984 rule: any colour card that would take you past the last purple square wins.",
  noShare:"From the 2013 rules on: if you land on a square someone is already on, go on to the next square of the same colour. If the picture square is taken, draw again.",
  treatsOnce:"From the 2025 rules: each picture card can be used only once a game. After it is drawn it is set aside and never shuffled back in."
};
function houseFor(h,version,n,o){
  if(h[5]&&h[5].indexOf(version)<0) return false;
  if(h[6]&&n&&n<h[6]) return false;
  if(h[7]&&o&&!o[h[7]]) return false;
  return true;
}
function houseRows(version,n,o){ return HOUSE.filter(function(h){ return houseFor(h,version,n,o); }); }
function versionOf(id){ for(var i=0;i<VERSIONS.length;i++) if(VERSIONS[i].id===id) return VERSIONS[i]; return null; }
function versionOpts(id,extra){
  var v=versionOf(id)||VERSIONS[0], o={version:v.id}, k;
  for(k in v.opts) o[k]=v.opts[k];
  for(k in (extra||{})) if(k!=="version") o[k]=extra[k];
  return mergeOpts(o);
}
function maxPlayers(){ return MAXP; }
function normalize(o,n){
  var v=versionOf(o.version); if(!v){ o.version=VERSIONS[0].id; v=VERSIONS[0]; }
  (v.lock||[]).forEach(function(k){ o[k]=v.opts[k]; });
  ["older","younger","exact","noShare","treatsOnce"].forEach(function(k){ o[k]=!!o[k]; });
  if(o.version!=="v1984") o.exact=false;          // moot on the rainbow square: any colour reaches it [WIK]
  var y=Math.floor(+o.youngest); o.youngest=(y>=0&&(!n||y<n))?y:-1;
  return o;
}
function boardOf(o){ var v=versionOf(o.version)||VERSIONS[0]; return BOARDS[v.board]; }
function deckOf(o){ var v=versionOf(o.version)||VERSIONS[0]; return v.deck; }

/* ---------------- squares ---------------- */
function sqKind(B,n){
  if(n<=0) return "start";
  var c=B.track.charAt(n);
  return c==="*"?"picture":c==="W"?"rainbow":"colour";
}
/* everything the page needs to draw square n */
function square(B,n){
  var c=B.track.charAt(n), r={n:n,c:c,kind:sqKind(B,n),name:null};
  if(n===0){ r.name="Start"; return r; }
  if(c==="*"){ r.pic=B.pics.indexOf(n); r.name=PIC_NAMES[r.pic]; }
  if(B.short[n]!=null){ r.short=B.short[n]; r.name=B.shortName[n]; }
  for(var a in B.short) if(B.short[a]===n) r.shortEnd=+a;
  if(B.sticky[n]!=null){ r.sticky=B.stickyKind; if(B.stickyKind==="until") r.free=B.sticky[n]; r.name=B.stickyName[n]; }
  if(n===END){ r.goal=true; r.name=GOAL_NAME; }
  return r;
}
function track(G){ var B=BOARDS[G.bd], out=[]; for(var n=0;n<=END;n++) out.push(square(B,n)); return out; }
function range(a,b){ var p=[], i; if(b>a) for(i=a+1;i<=b;i++) p.push(i); else for(i=a-1;i>=b;i--) p.push(i); return p; }
/* the squares of colour c after square from (the rainbow square matches every colour), at most n of them */
function matches(B,from,c,n){
  var m=[];
  for(var i=from+1;i<=END&&m.length<n;i++){ var x=B.track.charAt(i); if(x===c||x==="W") m.push(i); }
  return m;
}

/* ---------------- what one card does (pure; the brain and the expected-length tables use it too) ----------------
   walk(B, o, pos, stuck, cd, occ) -> {kind, from, path (every square hopped), land, marks (the squares counted), seq ([bump | shortcut]
   steps after the hops, in order), to, win, over (passed the end), stay ("stuck" | "same" | "exact"), redraw ("taken"), sticky (1984:
   the freeing colour), lose (2004: lose the next turn)}. occ(n) = another token is on n (only with No sharing squares; null = ignore). */
function walk(B,o,pos,stuck,cd,occ){
  var r={kind:cd.pic!=null?"picture":"colour",from:pos,path:[],land:pos,marks:[],seq:[],to:pos,win:false,over:false,stay:null,redraw:null,sticky:null,lose:false};
  if(stuck&&(cd.pic!=null||cd.c!==stuck)){ r.stay="stuck"; return r; }         // [MB84 3D]: any other card, a picture card too, leaves you there
  if(cd.pic!=null){
    var t=B.pics[cd.pic];
    if(t===pos){ r.stay="same"; return r; }                                     // neither forward nor back: you stay (RULES.md 2.7)
    if(occ&&occ(t)){ r.redraw="taken"; return r; }                              // an occupied picture square: draw again [HAS13]
    r.path=range(pos,t); r.land=r.to=t; r.dir=t>pos?1:-1; return r;
  }
  var m=matches(B,pos,cd.c,cd.n);
  r.marks=m;
  if(m.length<cd.n){
    if(B.track.charAt(END)==="W"){ r.path=range(pos,END); r.land=r.to=END; r.win=true; return r; }   // the path ends first: you reach the rainbow
    if(o.exact){ r.stay="exact"; r.marks=[]; return r; }                       // House: a card that would pass the end does not move you
    r.path=range(pos,END); r.land=r.to=END; r.win=r.over=true; return r;       // [MB84 4]: a card past the last purple square wins
  }
  var q=m[cd.n-1]; r.path=range(pos,q); r.land=q;
  for(var guard=0;guard<200;guard++){
    if(q===END) break;
    if(occ&&occ(q)){                                                             // No sharing squares: on to the next square of that colour
      var c=B.track.charAt(q), nx=matches(B,q,c,1);
      if(!nx.length){
        if(B.track.charAt(END)==="W"){ r.seq.push({e:"bump",from:q,to:END,path:range(q,END)}); q=END; break; }
        if(o.exact){ return {kind:"colour",from:pos,path:[],land:pos,marks:[],seq:[],to:pos,win:false,over:false,stay:"exact",redraw:null,sticky:null,lose:false}; }
        r.seq.push({e:"bump",from:q,to:END,path:range(q,END),over:true}); q=END; r.over=true; break;
      }
      r.seq.push({e:"bump",from:q,to:nx[0],path:range(q,nx[0])}); q=nx[0]; continue;
    }
    if(B.short[q]!=null){ r.seq.push({e:"shortcut",from:q,to:B.short[q],name:B.shortName[q]}); q=B.short[q]; continue; }
    break;
  }
  r.to=q;
  if(q===END){ r.win=true; return r; }
  if(B.sticky[q]!=null){ if(B.stickyKind==="until") r.sticky=B.sticky[q]; else r.lose=true; }
  return r;
}
function cardOf(G,id){ return cardsOf(G.dk)[id]; }
function occFn(G,s){
  if(!G.o.noShare) return null;
  return function(n){ if(n<=0) return false; for(var j=0;j<G.n;j++) if(j!==s&&G.players[j].pos===n) return true; return false; };
}
/* what card id would do for seat s right now */
function outcome(G,s,id){ var p=G.players[s]; return walk(BOARDS[G.bd],G.o,p.pos,p.stuck,cardOf(G,id),occFn(G,s)); }
/* a picture card that would send seat s backward (replaced at once with "Younger players"; never while stuck: it moves nobody then) */
function backPic(G,s,id){ var cd=cardOf(G,id), p=G.players[s]; return cd.pic!=null&&!p.stuck&&BOARDS[G.bd].pics[cd.pic]<p.pos; }

/* ---------------- helpers ---------------- */
function log(G,t,k,s){ G.log.push({t:t,k:k||"",s:s==null?-1:s,n:G.turn}); if(G.log.length>60) G.log.splice(0,G.log.length-60); }
function nm(G,s){ return G.players[s].name; }
function fail(msg){ return {ok:false,msg:msg,ev:[]}; }
function ord(n){ var s=["th","st","nd","rd"], v=n%100; return n+(s[(v-20)%10]||s[v]||s[0]); }
function cardText(G,id){ var cd=cardOf(G,id); if(cd.pic!=null) return "the "+PIC_NAMES[cd.pic]+" card"; return (cd.n===2?"double ":"")+CNAME[cd.c]; }
function newStats(){ return {cards:0,turns:0,pics:0,back:0,shortcuts:0,stuck:0,lost:0,bumps:0,redraws:0,best:0,squares:0}; }

/* ---------------- who goes first (RULES.md 2.2 and 7.4) ----------------
   Every edition: "The youngest player goes first. Play proceeds to the left." [MB84; HAS04; HAS13; WM; R67]. No roll, spin or draw.
   The page asks which human is the youngest (computers have no age). Nobody picked: the table decides [HASPB], so seat 1 starts, and the
   log says so. Returns the BGUI.firstPlayer.resolve shape (mode "none": a spotlight, nothing is rolled). */
function firstPlayer(G){
  var f=G.fp||{rule:"table",winner:0};
  return {rule:f.rule,mode:"none",winner:f.winner,rounds:[],youngest:f.rule==="youngest",
    title:f.rule==="youngest"?"The youngest player goes first":"No youngest picked",
    why:f.rule==="youngest"?"The rules say the youngest player goes first. Then play passes to the left."
      :"The rules say the youngest player goes first. Nobody was picked as the youngest, so the first seat starts. Then play passes to the left."};
}

/* ---------------- a new game ---------------- */
function newGame(opts,players,seed){
  var n=(players||[]).length; if(n<MINP||n>MAXP) throw new Error("Candy Land is for 2 to 4 players.");
  var o=normalize(mergeOpts(opts),n), B=boardOf(o), dk=deckOf(o);
  var G={v:VER,id:"candy",o:o,n:n,rs:(seed==null?Math.floor(Math.random()*4294967296):seed)>>>0,bd:B.id,dk:dk,
    players:players.map(function(p,i){ return {name:String((p&&p.name)||("Player "+(i+1))),human:!!(p&&p.human),skill:(p&&p.skill)||null,color:(p&&p.color!=null)?String(p.color):null,
      pos:0,at:0,stuck:null,skip:0,done:false,place:0,st:newStats()}; }),
    deck:[],disc:[],aside:[],hand:[],turnRedraws:0,fp:null,cur:0,turn:1,step:0,phase:"draw",over:false,winner:-1,fin:[],last:null,
    stats:{cards:0,reshuffles:0,pics:0,back:0,shortcuts:0,stuck:0,lost:0,bumps:0,redraws:0,longestTrip:null},log:[]};
  G.deck=cardsOf(dk).map(function(c){ return c.id; }); shuffle(G,G.deck);       // [MB84; HAS04] shuffle, face down
  if(o.youngest>=0&&G.players[o.youngest]&&G.players[o.youngest].human){
    G.fp={rule:"youngest",winner:o.youngest}; log(G,nm(G,o.youngest)+" is the youngest and goes first.","first",o.youngest);
  } else {
    o.youngest=-1; G.fp={rule:"table",winner:0}; log(G,"No youngest picked: "+nm(G,0)+" starts.","first",0);
  }
  G.cur=G.fp.winner;
  return G;
}

/* ---------------- the cards ---------------- */
/* the discard pile shuffled into a new face-down draw pile [WM 10; R67 9] (the 1984 and 2004 sheets say nothing; RULES.md 2.7) */
function refill(G,ev){
  if(!G.disc.length) return false;
  G.deck=G.disc; G.disc=[]; shuffle(G,G.deck); G.stats.reshuffles++;
  ev.push({e:"reshuffle",n:G.deck.length});
  log(G,"The cards ran out: the discard pile is shuffled into a new pile.","reshuffle");
  return true;
}
function drawOne(G,s,ev){
  if(!G.deck.length&&!refill(G,ev)) return -1;
  var id=G.deck.pop(), p=G.players[s];
  p.st.cards++; G.stats.cards++;
  ev.push({e:"draw",s:s,id:id,card:cardPublic(G,id),left:G.deck.length});
  return id;
}
function discard(G,id,ev){
  var cd=cardOf(G,id);
  if(cd.pic!=null&&G.o.treatsOnce){ G.aside.push(id); ev.push({e:"discard",id:id,aside:true}); }   // [HAS25] once a game (any drawn picture card)
  else { G.disc.push(id); ev.push({e:"discard",id:id,aside:false}); }
}
/* draw one card; with "Younger players" a picture card that would send you back is discarded and replaced at once [HAS04] */
function drawCard(G,s,ev){
  for(var guard=0;guard<80;guard++){
    var id=drawOne(G,s,ev); if(id<0) return -1;
    if(G.o.younger&&backPic(G,s,id)){
      G.players[s].st.redraws++; G.stats.redraws++;
      ev.push({e:"redraw",s:s,id:id,why:"back"}); discard(G,id,ev);
      log(G,nm(G,s)+" drew "+cardText(G,id)+": no going back, so a new card.","redraw",s);
      continue;
    }
    return id;
  }
  return -1;
}
function cardPublic(G,id){ var cd=cardOf(G,id); return cd.pic!=null?{id:id,pic:cd.pic,sq:BOARDS[G.bd].pics[cd.pic],name:PIC_NAMES[cd.pic]}:{id:id,c:cd.c,n:cd.n}; }

/* ---------------- the move API ---------------- */
function needList(G){ return G.over?[]:[G.cur]; }
function legal(G,s){
  if(!G||G.over||s!==G.cur||!G.players[s]||G.players[s].done) return [];
  if(G.phase==="choose") return [{t:"pick",s:s,i:0},{t:"pick",s:s,i:1}];
  return [{t:"draw",s:s}];
}
function defaultMove(G,s){ var L=legal(G,s==null?G.cur:s); return L[0]||null; }
function apply(G,m){
  if(!G||G.over) return fail("The game is over.");
  if(!m||typeof m!=="object"||Array.isArray(m)) return fail("No move.");
  for(var key in m) if(key!=="t"&&key!=="s"&&key!=="i") return fail("Unexpected '"+key+"' in the move.");   // the cards are drawn here
  var s=m.s; if(typeof s!=="number"||!G.players[s]) return fail("No such player.");
  if(s!==G.cur) return fail("It's "+nm(G,G.cur)+"'s turn.");
  var ev=[];
  if(m.t==="draw"){
    if(G.phase!=="draw") return fail("Choose one of your two cards.");
    if(m.i!==undefined) return fail("Unexpected 'i' in the move.");
    G.step++; G.players[s].st.turns++; G.turnRedraws=0;
    startDraw(G,s,ev);
    return {ok:true,ev:ev};
  }
  if(m.t==="pick"){
    if(G.phase!=="choose") return fail("Draw a card.");
    if(m.i!==0&&m.i!==1) return fail("Pick card 0 or 1.");
    G.step++;
    var id=G.hand[m.i], other=G.hand[1-m.i], r=outcome(G,s,id);
    ev.push({e:"pick",s:s,i:m.i,id:id,card:cardPublic(G,id)});
    if(r.redraw&&G.turnRedraws<40){
      G.turnRedraws++; G.players[s].st.redraws++; G.stats.redraws++;
      ev.push({e:"redraw",s:s,id:id,why:"taken",sq:r.from});
      log(G,nm(G,s)+" picked "+cardText(G,id)+", but that square is taken: draw again.","redraw",s);
      G.hand=[]; discard(G,id,ev); discard(G,other,ev);
      startDraw(G,s,ev);
      return {ok:true,ev:ev};
    }
    G.hand=[];
    play(G,s,id,r,ev);
    G.last.pick=true; G.last.other=other;                                       // public: both cards were on the table
    discard(G,id,ev); discard(G,other,ev);                                      // [HAS04] "then discard both cards"
    endTurn(G,s,ev);
    return {ok:true,ev:ev};
  }
  return fail(G.phase==="choose"?"Choose one of your two cards.":"Draw a card.");
}
/* draw for seat s: one card played at once, or two to choose from */
function startDraw(G,s,ev){
  if(G.o.older){
    var a=drawCard(G,s,ev), b=drawCard(G,s,ev);
    if(a<0||b<0){ if(a>=0) discard(G,a,ev); if(b>=0) discard(G,b,ev); endTurn(G,s,ev); return; }   // never happens with 64 cards
    G.hand=[a,b]; G.phase="choose";
    ev.push({e:"choose",s:s,hand:[cardPublic(G,a),cardPublic(G,b)]});
    log(G,nm(G,s)+" draws "+cardText(G,a)+" and "+cardText(G,b)+".","choose",s);
    return;
  }
  for(var guard=0;guard<60;guard++){
    var id=drawCard(G,s,ev); if(id<0){ endTurn(G,s,ev); return; }
    var r=outcome(G,s,id);
    if(r.redraw&&G.turnRedraws<40){
      G.turnRedraws++; G.players[s].st.redraws++; G.stats.redraws++;
      ev.push({e:"redraw",s:s,id:id,why:"taken",sq:r.from});
      log(G,nm(G,s)+" drew "+cardText(G,id)+", but that square is taken: draw again.","redraw",s);
      discard(G,id,ev); continue;
    }
    play(G,s,id,r,ev); discard(G,id,ev); endTurn(G,s,ev); return;
  }
}
/* carry out a card's outcome r for seat s */
function play(G,s,id,r,ev){
  var p=G.players[s], B=BOARDS[G.bd], ct=cardText(G,id), who=nm(G,s);
  if(r.redraw){ r.stay="taken"; r.redraw=null; }                               // the redraw safety limit was reached (never in practice): stay
  G.last={s:s,id:id,card:cardPublic(G,id),from:r.from,to:r.to,land:r.land,path:r.path.slice(),kind:r.kind,seq:JSON.parse(JSON.stringify(r.seq)),
    stay:r.stay,sticky:r.sticky,lose:r.lose,win:r.win,step:G.step,turn:G.turn};
  if(r.stay==="stuck"){
    p.st.stuck++; G.stats.stuck++;
    ev.push({e:"stuck",s:s,at:p.pos,need:p.stuck,id:id});
    log(G,who+" drew "+ct+": still stuck in the "+B.stickyName[p.pos]+" (needs "+CNAME[p.stuck]+").","stuck",s);
    return;
  }
  if(r.stay){
    ev.push({e:"stay",s:s,at:p.pos,why:r.stay,id:id});
    log(G,who+" drew "+ct+(r.stay==="same"?": already on that square.":r.stay==="taken"?": that square is taken, so no move.":": it would pass the end, so no move."),"stay",s);
    return;
  }
  var freed=p.stuck;
  if(freed){ ev.push({e:"freed",s:s,at:p.pos,c:freed}); p.stuck=null; }
  ev.push({e:"move",s:s,kind:r.kind,from:r.from,path:r.path.slice(),to:r.land,marks:r.marks.slice(),id:id,card:cardPublic(G,id),over:r.over&&!r.seq.length,dir:r.kind==="picture"?r.dir:1});
  var len=r.path.length;
  if(r.kind==="picture"){
    p.st.pics++; G.stats.pics++;
    if(r.dir<0){ p.st.back++; G.stats.back++; }
    if(!G.stats.longestTrip||len>G.stats.longestTrip.len) G.stats.longestTrip={s:s,from:r.from,to:r.land,len:len,dir:r.dir,turn:G.turn};
  }
  var line=who+" drew "+ct+": "+(r.from||"start")+" → "+(r.land===END&&r.win&&!r.seq.length?(r.over?"past the end":"the rainbow"):r.land);
  r.seq.forEach(function(x){
    ev.push({e:x.e,s:s,from:x.from,to:x.to,path:x.path?x.path.slice():undefined,name:x.name,over:!!x.over});
    if(x.e==="shortcut"){ p.st.shortcuts++; G.stats.shortcuts++; line+=", the "+x.name+" to "+x.to; }
    else { p.st.bumps++; G.stats.bumps++; line+=", taken: on to "+x.to; }
  });
  p.pos=r.to; p.at=G.step;
  var fwd=r.to-r.from; if(fwd>0){ p.st.squares+=fwd; if(fwd>p.st.best) p.st.best=fwd; }
  if(r.win){ log(G,line+".","move",s); finish(G,s,ev); return; }
  if(r.sticky){
    p.stuck=r.sticky;
    ev.push({e:"sticky",s:s,at:r.to,need:r.sticky,name:B.stickyName[r.to]});
    line+=": stuck in the "+B.stickyName[r.to]+" until a "+CNAME[r.sticky]+" card!";
  } else if(r.lose){
    p.skip=1;
    ev.push({e:"licorice",s:s,at:r.to,name:B.stickyName[r.to]});
    line+=": the "+B.stickyName[r.to]+"! Loses the next turn.";
  } else if(r.kind==="picture") line+=", "+PIC_NAMES[B.pics.indexOf(r.land)]+"!";
  else line+=".";
  log(G,line,r.kind==="picture"?"picture":"move",s);
}
function endTurn(G,s,ev){ if(!G.over){ G.phase="draw"; G.hand=[]; nextTurn(G,ev); } }
/* to the left = seat order; a player owing a lost turn (licorice) is passed over once, and it is shown [HAS04 4] */
function nextTurn(G,ev){
  var c=G.cur;
  for(var guard=0;guard<4*G.n+4;guard++){
    c=(c+1)%G.n; G.turn++;
    var q=G.players[c];
    if(q.skip>0){ q.skip=0; q.st.lost++; G.stats.lost++; ev.push({e:"skip",s:c,at:q.pos}); log(G,nm(G,c)+" loses this turn (licorice).","skip",c); continue; }
    break;
  }
  G.cur=c; ev.push({e:"turn",s:c});
}
function finish(G,s,ev){
  var p=G.players[s]; p.done=true; p.place=1; G.fin=[s];
  G.over=true; G.phase="over"; G.winner=s; G.hand=[];
  ev.push({e:"finish",s:s,place:1});
  ev.push({e:"over",winner:s});
  log(G,nm(G,s)+" reaches "+GOAL_NAME+" and wins!","win",s);
}

/* ---------------- the cards not yet drawn (public by counting: all minus the discards, the set-aside cards and the hand) ---------------- */
function unseen(G){
  var gone={}, out=[]; G.disc.concat(G.aside,G.hand).forEach(function(id){ gone[id]=1; });
  cardsOf(G.dk).forEach(function(c){ if(!gone[c.id]) out.push(c.id); });
  return out;
}

/* ---------------- tension and hints for the page (RULES.md 7.3) ----------------
   pWin = the chance the next card wins (from the cards not yet drawn; with draw two, either card); ahead = shortcut starts, sticky
   squares and picture squares one card away. */
function hint(G,s){
  var p=G.players[s]; if(!p) return null;
  var B=BOARDS[G.bd], ids=unseen(G), wins=0, tot=ids.length, ahead={};
  if(!tot){ ids=G.disc.slice(); tot=ids.length; }
  ids.forEach(function(id){
    var r=outcome(G,s,id); if(r.win) wins++;
    r.seq.forEach(function(x){ if(x.e==="shortcut") ahead[x.from]="shortcut"; });
    if(r.sticky||r.lose) ahead[r.to]="sticky";
  });
  var pw=tot?wins/tot:0;
  if(G.o.older&&tot>1) pw=1-((tot-wins)*(tot-wins-1))/(tot*(tot-1));     // either of two cards (drawn without replacement)
  return {s:s,pos:p.pos,left:END-p.pos,pWin:pw,near:END-p.pos<=12,stuck:p.stuck,skip:p.skip,ahead:Object.keys(ahead).map(function(k){ return {at:+k,kind:ahead[k]}; })};
}

/* ---------------- expected length (one player alone; RULES.md 5 [CALC]) ----------------
   table(o) -> {E: expected turns from each square 0..133 (stuck state implied by the square), dest: per square, the outcome
   distribution of one turn under the best choice ([{to, lose, win, p}]), F: F[q][t] = P(home within t turns from q)}.
   The deck is drawn with replacement (the model of the published analyses); "draw two" keeps the card with the lower expected value;
   "younger" drops picture cards behind you; No sharing squares and Treats only once are ignored (they depend on the table). Cached. */
var TC={};
/* two cards drawn (with replacement), the lower value kept: the chance that card type i is the one kept (sorted form, O(T log T)) */
function bestOfTwo(vals,w){
  var idx=[], out=[], i, tail=1;
  for(i=0;i<vals.length;i++){ out.push(0); if(w[i]) idx.push(i); }
  idx.sort(function(a,b){ return vals[a]-vals[b]||a-b; });
  for(i=0;i<idx.length;i++){ var k=idx[i]; tail-=w[k]; if(tail<0) tail=0; out[k]=w[k]*(w[k]+2*tail); }
  return out;
}
function cardTypes(dk){
  var m={}, out=[];
  cardsOf(dk).forEach(function(c){ if(!m[c.ty]){ m[c.ty]={cd:c,w:0}; out.push(m[c.ty]); } m[c.ty].w++; });
  return out;
}
function table(o,tol){
  o=normalize(mergeOpts(o));
  var key=o.version+"|"+o.older+"|"+o.younger+"|"+o.exact+"|"+(tol||1e-9);
  if(TC[key]) return TC[key];
  var B=boardOf(o), T=cardTypes(deckOf(o)), N=END, p, i, j;
  var outs=[], wts=[];
  for(p=0;p<N;p++){
    var stuck=B.stickyKind==="until"&&B.sticky[p]?B.sticky[p]:null, row=[], w=[], tw=0;
    for(i=0;i<T.length;i++){
      var r=walk(B,o,p,stuck,T[i].cd,null);
      var back=o.younger&&!stuck&&r.kind==="picture"&&r.dir<0;
      row.push({to:r.win?N:r.to,lose:r.lose?1:0,win:r.win}); w.push(back?0:T[i].w); tw+=back?0:T[i].w;
    }
    for(i=0;i<w.length;i++) w[i]/=tw;
    outs.push(row); wts.push(w);
  }
  var E=new Float64Array(N+1), val=function(x){ return x.win?0:E[x.to]+x.lose; };
  tol=tol||1e-9;
  for(var it=0;it<20000;it++){
    var delta=0;
    for(p=N-1;p>=0;p--){
      var row2=outs[p], w2=wts[p], e=1, selfW=0;
      if(!o.older){
        for(i=0;i<row2.length;i++){ if(!w2[i]) continue; if(row2[i].to===p&&!row2[i].win&&!row2[i].lose) selfW+=w2[i]; else e+=w2[i]*val(row2[i]); }
        e=e/(1-selfW);
      } else {
        var vs=row2.map(val), bw=bestOfTwo(vs,w2);
        for(i=0;i<row2.length;i++){ if(!bw[i]) continue; if(row2[i].to===p&&!row2[i].win&&!row2[i].lose) selfW+=bw[i]; else e+=bw[i]*vs[i]; }
        e=e/(1-selfW);                                                          // a stuck square: solve its own term at once
      }
      var d=Math.abs(e-E[p]); if(d>delta) delta=d; E[p]=e;
    }
    if(delta<tol) break;
  }
  /* the one-turn distribution under that choice */
  var dest=[];
  for(p=0;p<N;p++){
    var row3=outs[p], w3=wts[p], acc={};
    var add=function(x,pr){ var k=(x.win?N:x.to)+"|"+x.lose; if(!acc[k]) acc[k]={to:x.win?N:x.to,lose:x.lose,win:x.win,p:0}; acc[k].p+=pr; };
    if(!o.older){ for(i=0;i<row3.length;i++) if(w3[i]) add(row3[i],w3[i]); }
    else { var bw3=bestOfTwo(row3.map(val),w3); for(i=0;i<row3.length;i++) if(bw3[i]) add(row3[i],bw3[i]); }
    dest.push(Object.keys(acc).map(function(k){ return acc[k]; }));
  }
  var res={key:key,E:Array.prototype.slice.call(E,0,N),dest:dest,F:null,H:0};
  var ks=Object.keys(TC); if(ks.length>24) delete TC[ks[0]];
  return (TC[key]=res);
}
/* F[q][t] = P(home within t of your own turns, starting a turn on q); also mean and SD per square. Built on first use (about 5-20 ms). */
function finishDist(o){
  var t0=table(o,1e-7); if(t0.F) return t0;
  var N=END, H=0, F=[], q, t, k, MAXH=600;
  for(q=0;q<=N;q++){ F.push([q===N?1:0]); }
  for(t=1;t<=MAXH;t++){
    var minF=1;
    for(q=0;q<N;q++){
      var d=t0.dest[q], f=0;
      for(k=0;k<d.length;k++){ var x=d[k]; if(x.win) f+=x.p; else { var tt=t-1-x.lose; if(tt>=0) f+=x.p*F[x.to][tt]; } }
      F[q].push(f); if(f<minF) minF=f;
    }
    F[N].push(1); H=t;
    if(minF>0.999999) break;
  }
  var mean=[], sd=[];
  for(q=0;q<=N;q++){ var m1=0, m2=0; for(t=1;t<=H;t++){ var pt=F[q][t]-F[q][t-1]; m1+=pt*t; m2+=pt*t*t; } mean.push(m1); sd.push(Math.sqrt(Math.max(0,m2-m1*m1))); }
  t0.F=F; t0.H=H; t0.mean=mean; t0.sd=sd;
  return t0;
}
/* expected cards (turns) for one player from START */
function expected(o){ return table(o).E[0]; }

/* ---------------- standings: leader first ----------------
   The winner first (official). The rest by how far along the path they are (higher square first; a tie goes to whoever got there first):
   a table position, not an official placing (no source ranks them), so those rows carry table:true (RULES.md 2.7). */
function standings(G){
  var rows=G.players.map(function(p,s){ return {s:s,name:p.name,human:p.human,color:p.color,pos:p.pos,left:END-p.pos,done:p.done,at:p.at,stuck:p.stuck,skip:p.skip,table:!p.done,place:0}; });
  rows.sort(function(a,b){
    if(a.done!==b.done) return a.done?-1:1;
    if(b.pos!==a.pos) return b.pos-a.pos;
    if(a.at!==b.at) return a.at-b.at;
    return a.s-b.s;
  });
  rows.forEach(function(r,i){ var prev=rows[i-1]; r.place=(prev&&!prev.done&&!r.done&&prev.pos===r.pos&&prev.at===r.at)?prev.place:i+1; });
  return rows;
}

/* ---------------- snapshot (Party phones; seat -1 = the TV): everything is public except the order of the draw pile and the RNG ---------------- */
function snapshot(G,seat){
  var me=seat>=0&&G.players[seat]?seat:-1, B=BOARDS[G.bd];
  return {v:G.v,id:"candy",o:JSON.parse(JSON.stringify(G.o)),n:G.n,me:me,bd:G.bd,boardName:B.name,dk:G.dk,end:END,
    players:G.players.map(function(p,i){ return {s:i,name:p.name,human:p.human,color:p.color,pos:p.pos,stuck:p.stuck,skip:p.skip,done:p.done,place:p.place,st:JSON.parse(JSON.stringify(p.st))}; }),
    cur:G.cur,turn:G.turn,step:G.step,phase:G.phase,need:needList(G),first:firstPlayer(G),
    deckCount:G.deck.length,discCount:G.disc.length,discTop:G.disc.length?cardPublic(G,G.disc[G.disc.length-1]):null,
    aside:G.aside.map(function(id){ return cardPublic(G,id); }),hand:G.hand.map(function(id){ return cardPublic(G,id); }),
    last:G.last?JSON.parse(JSON.stringify(G.last)):null,stats:JSON.parse(JSON.stringify(G.stats)),standings:standings(G),
    over:G.over,winner:G.winner,log:G.log.slice(-8).map(function(e){ return e.t; }),
    legal:me>=0?legal(G,me):[],hint:me>=0?hint(G,me):null,yourTurn:me>=0&&!G.over&&G.cur===me};
}

/* ---------------- invariants (tests, fuzz): [] = fine ---------------- */
function check(G){
  var err=[], o=G.o, B=BOARDS[G.bd], s;
  if(G.v!==VER) err.push("save version");
  if(!B) { err.push("no board "+G.bd); return err; }
  if(B!==boardOf(o)||G.dk!==deckOf(o)) err.push("board or deck does not match the version");
  if(G.n!==G.players.length||G.n<MINP||G.n>MAXP) err.push("player count "+G.n);
  var all=G.deck.concat(G.disc,G.aside,G.hand), seen={}, total=cardsOf(G.dk).length;
  if(all.length!==total) err.push("card count "+all.length+" of "+total);
  all.forEach(function(id){ if(!(id>=0&&id<total&&id===Math.floor(id))) err.push("bad card "+id); else if(seen[id]) err.push("card twice "+id); seen[id]=1; });
  G.aside.forEach(function(id){ if(!o.treatsOnce||cardOf(G,id).pic==null) err.push("set aside "+id); });
  if(G.phase==="choose"){ if(G.hand.length!==2||!o.older) err.push("choose with hand "+G.hand.length); }
  else if(G.hand.length) err.push("hand outside choose");
  var done=0, occ={};
  G.players.forEach(function(p,i){
    if(!(p.pos>=0&&p.pos<=END&&p.pos===Math.floor(p.pos))) err.push("seat "+i+" off the track: "+p.pos);
    if(B.short[p.pos]!=null) err.push("seat "+i+" resting on a shortcut start "+p.pos);
    var stickyHere=B.sticky[p.pos]!=null&&!p.done;
    if(B.stickyKind==="until"){ if(p.stuck!==(stickyHere?B.sticky[p.pos]:null)) err.push("seat "+i+" stuck="+p.stuck+" at "+p.pos); if(p.skip) err.push("skip on 1984"); }
    else { if(p.stuck) err.push("stuck on 2004"); if(p.skip&&!stickyHere) err.push("seat "+i+" skip off licorice at "+p.pos); }
    if(p.skip!==0&&p.skip!==1) err.push("skip value "+p.skip);
    if(p.done!==(p.pos===END)) err.push("seat "+i+" done="+p.done+" at "+p.pos);
    if(p.done){ done++; if(G.winner!==i) err.push("finished seat "+i+" is not the winner"); }
    if(o.noShare&&p.pos>0&&!p.done){ if(occ[p.pos]) err.push("shared square "+p.pos+" with No sharing"); occ[p.pos]=1; }
  });
  if(G.over){
    if(G.phase!=="over") err.push("over but phase "+G.phase);
    if(done!==1||G.winner<0||!G.players[G.winner].done) err.push("over without one winner");
    if(G.hand.length) err.push("hand after the end");
  } else {
    if(G.phase!=="draw"&&G.phase!=="choose") err.push("bad phase "+G.phase);
    if(done) err.push("someone finished but the game goes on");
    if(!G.players[G.cur]) err.push("the turn is with a missing seat "+G.cur);
    else if(G.players[G.cur].skip) err.push("the turn is with a seat that owes a lost turn");
  }
  for(s=0;s<G.n;s++){ var st=G.players[s].st; if(st.pics>st.cards||st.shortcuts>st.cards) err.push("stats of "+s); }
  return err;
}

/* ---------------- tests only: put these cards on top of the draw pile, ids[0] drawn first (keeps every card exactly once) ---------------- */
function stack(G,ids){
  ids.forEach(function(id){
    var k=G.deck.indexOf(id); if(k>=0){ G.deck.splice(k,1); return; }
    k=G.disc.indexOf(id); if(k>=0){ G.disc.splice(k,1); return; }
    throw new Error("card "+id+" is not in the draw or discard pile");
  });
  for(var i=ids.length-1;i>=0;i--) G.deck.push(ids[i]);
}
/* tests only: the id of a card of type ty ("R1", "G2", "*3") still in the draw or discard pile, avoiding the ids in not */
function findCard(G,ty,not){
  var c=cardsOf(G.dk), ok={}; G.deck.concat(G.disc).forEach(function(id){ ok[id]=1; });
  for(var i=0;i<c.length;i++) if(c[i].ty===ty&&ok[c[i].id]&&!(not&&not.indexOf(c[i].id)>=0)) return c[i].id;
  return -1;
}

CY.Engine={VER:VER,MINP:MINP,MAXP:MAXP,END:END,COLS:COLS,CNAME:CNAME,BOARDS:BOARDS,DECKS:DECKS,PIC_NAMES:PIC_NAMES,GOAL_NAME:GOAL_NAME,
  VERSIONS:VERSIONS,HOUSE:HOUSE,HDESC:HDESC,houseFor:houseFor,houseRows:houseRows,
  defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOf:versionOf,versionOpts:versionOpts,normalize:normalize,maxPlayers:maxPlayers,boardOf:boardOf,deckOf:deckOf,
  cardsOf:cardsOf,cardOf:cardOf,cardPublic:cardPublic,cardText:cardText,square:square,track:track,matches:matches,walk:walk,outcome:outcome,backPic:backPic,unseen:unseen,
  newGame:newGame,legal:legal,apply:apply,need:needList,defaultMove:defaultMove,firstPlayer:firstPlayer,hint:hint,standings:standings,snapshot:snapshot,check:check,
  table:table,finishDist:finishDist,expected:expected,cardTypes:cardTypes,ord:ord,_stack:stack,_find:findCard,_rnd:rnd};
if(typeof module!=="undefined"&&module.exports) module.exports=CY.Engine;
/* browsers: bring in the brain right after this file (the page and the Party pages all load engine.js); a failed load = computers just draw */
if(typeof document!=="undefined"&&document.currentScript&&document.currentScript.src&&document.readyState==="loading"&&!CY.Brain){
  try{ document.write('<script src="'+document.currentScript.src.replace(/engine\.js(\?.*)?$/,"brain.js")+'"><\/script>'); }catch(e){}
}
})(typeof window!=="undefined"?window:globalThis);
