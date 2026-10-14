/* UNO — pure rules engine + computer player (no DOM). Editions: Classic, Flip, Show 'Em No Mercy, All Wild.
   A card is {id,f:[face0,face1]} with face {c:colour,v:value}. Colours: R Y G B (light) | P T O V (dark: pink teal orange violet) | W (wild). Non-flip decks have f[1]===f[0]. */
(function(g){
"use strict";
var Uno=g.Uno=g.Uno||{};
var LIGHT=["R","Y","G","B"], DARK=["P","T","O","V"];
var CNAME={R:"Red",Y:"Yellow",G:"Green",B:"Blue",P:"Pink",T:"Teal",O:"Orange",V:"Purple",W:"Wild"};
var VNAME={skip:"Skip",rev:"Reverse",d2:"Draw Two",d1:"Draw One",d4:"Draw Four",d5:"Draw Five",skipall:"Skip Everyone",discardall:"Discard All",flip:"Flip",wild:"Wild",wd4:"Wild Draw Four",wd2:"Wild Draw Two",wdc:"Wild Draw Color",wrd4:"Wild Reverse Draw 4",roul:"Wild Color Roulette",wd6:"Wild Draw 6",wd10:"Wild Draw 10",wrev:"Wild Reverse",wskip:"Wild Skip",wskip2:"Wild Skip Two",wtd2:"Wild Targeted Draw Two",wswap:"Wild Forced Swap"};
/* how many cards a draw-type card makes the victim draw (0 = not a draw card) */
var DRAWN={d2:2,d1:1,d5:5,d4:4,wd4:4,wd2:2,wd6:6,wd10:10,wrd4:4,wtd2:2};

/* ---------------- options / versions ---------------- */
function defaultOpts(){
  return {
    edition:"classic",        // classic | flip | nomercy | allwild
    startRule:"2008",         // 2008 (apply the starting card's effect) | 2022 (ignore a non-number starting card)
    drawRule:"one",           // one (official: draw one card, may play it) | untilPlay (draw until you can play it)
    forcePlay:false,          // a drawn playable card MUST be played
    challenge:true,           // Wild Draw Four / Two / Color can be challenged
    wildsCount:false,         // 2022 wording: holding a Wild also makes a Wild Draw illegal
    stack:"none",             // none | same (+2 on +2, +4 on +4) | cross (any draw on any draw) | mercy (equal or higher)
    sevenZero:false,          // 0 passes every hand along, 7 swaps hands with a player you choose
    jumpIn:false,             // identical card may be played out of turn
    unoPenalty:2,             // cards drawn when caught not saying UNO (2001 rules: 4)
    noWildFinish:false,       // house: you cannot go out on a Wild Draw card
    mercy:0,                  // players holding this many cards are knocked out (No Mercy: 25)
    target:500,               // points to win the game (0 = a single round)
    scoring:"winner",         // winner (winner scores everyone's cards) | tally (cards left count against you; lowest total wins at the target)
    teams:false,              // 4 players: partners opposite, either partner going out ends the hand
    aiForget:0.07             // chance an AI forgets to call UNO (so you can catch it)
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) d[k]=o[k]; return d; }
var VERSIONS=[
  {id:"classic",name:"Classic Uno",tag:"Mattel, 108 cards",desc:"The standard game: 7 cards each, match colour, number or symbol, Skip / Reverse / Draw Two / Wild / Wild Draw Four, challenge a Wild Draw Four, call UNO, first to 500.",opts:{edition:"classic"}},
  {id:"flip",name:"Uno Flip!",tag:"Two-sided deck, 112 cards",desc:"Light side (Draw One, Wild Draw Two) and a harsher Dark side (Draw Five, Skip Everyone, Wild Draw Color). A Flip card turns the whole game over.",opts:{edition:"flip",startRule:"2008"}},
  {id:"nomercy",name:"Uno Show 'Em No Mercy",tag:"168 cards, stacking",desc:"Draw until you can play, stack bigger draw cards, 0s pass hands, 7s swap hands, Draw 6 / Draw 10, and you're out at 25 cards. First to 1000.",opts:{edition:"nomercy",startRule:"2022",drawRule:"untilPlay",forcePlay:true,stack:"mercy",sevenZero:true,challenge:false,mercy:25,target:1000}},
  {id:"allwild",name:"Uno All Wild",tag:"112 cards, nothing has to match",desc:"Every card is a Wild: play anything any time. Skips, Reverses, Draw Two / Four, targeted draws and forced hand swaps.",opts:{edition:"allwild",startRule:"2022",challenge:false}}
];
/* [key, label, type, choices, published(1)/house(0), editions it applies to (omitted = every edition)] */
var HOUSE=[
  ["startRule","Starting card","choice",[["2008","Apply its effect (classic)"],["2022","Ignore non-number starters (2022)"]],1,["classic","flip"]],
  ["drawRule","When you can't play","choice",[["one","Draw one card (official)"],["untilPlay","Draw until you can play"]],1],
  ["forcePlay","A drawn playable card must be played","bool",null,0],
  ["challenge","Challenge Wild Draw cards","bool",null,1],
  ["wildsCount","Holding a Wild makes Wild Draw illegal (2022 wording)","bool",null,1],
  ["stack","Stacking draw cards","choice",[["none","Not allowed (official)"],["same","Same type (Progressive)"],["cross","Any draw on any draw"],["mercy","Equal or higher (No Mercy)"]],1],
  ["sevenZero","Seven-O: 0 passes hands, 7 swaps","bool",null,1],
  ["jumpIn","Jump-in: identical card out of turn","bool",null,1],
  ["unoPenalty","Penalty for not saying UNO","choice",[[2,"2 cards"],[4,"4 cards (2001 rules)"]],1],
  ["noWildFinish","Can't go out on a Wild Draw card","bool",null,0],
  ["mercy","Mercy rule (knocked out at this many cards)","choice",[[0,"Off"],[15,"15"],[25,"25 (No Mercy)"]],1],
  ["target","Points to win","choice",[[0,"Single round"],[200,"200"],[500,"500"],[1000,"1000"]],1],
  ["scoring","Scoring","choice",[["winner","Winner scores all hands"],["tally","Cards left count against you (lowest wins)"]],1],
  ["teams","Partners (4 players, opposite seats)","bool",null,1]
];
function houseFor(h,edition){ return !h[5]||h[5].indexOf(edition)>=0; }   // is this rule row offered for that edition?
function startFx(o){ return o.edition==="classic"||o.edition==="flip"; }   // editions whose sheet gives a starting action card an effect
function versionOpts(id,extra){ var v=VERSIONS.filter(function(x){ return x.id===id; })[0]||VERSIONS[0]; var o={}; for(var k in v.opts) o[k]=v.opts[k]; for(var k2 in (extra||{})) o[k2]=extra[k2]; return mergeOpts(o); }

/* ---------------- decks ---------------- */
function F(c,v){ return {c:c,v:v}; }
function buildDeck(o,rnd){
  var cards=[], id=0, i, c, k;
  function add(f0,f1,n){ for(var q=0;q<(n||1);q++) cards.push({id:id++,f:[f0,f1||f0]}); }
  if(o.edition==="classic"){
    LIGHT.forEach(function(c){ add(F(c,"0")); for(i=1;i<=9;i++) add(F(c,String(i)),null,2); ["skip","rev","d2"].forEach(function(v){ add(F(c,v),null,2); }); });
    add(F("W","wild"),null,4); add(F("W","wd4"),null,4);
  } else if(o.edition==="flip"){
    var lf=[], df=[];
    LIGHT.forEach(function(c){ for(i=1;i<=9;i++){ lf.push(F(c,String(i))); lf.push(F(c,String(i))); } ["d1","rev","skip","flip"].forEach(function(v){ lf.push(F(c,v)); lf.push(F(c,v)); }); });
    for(k=0;k<4;k++){ lf.push(F("W","wild")); lf.push(F("W","wd2")); }
    DARK.forEach(function(c){ for(i=1;i<=9;i++){ df.push(F(c,String(i))); df.push(F(c,String(i))); } ["d5","rev","skipall","flip"].forEach(function(v){ df.push(F(c,v)); df.push(F(c,v)); }); });
    for(k=0;k<4;k++){ df.push(F("W","wild")); df.push(F("W","wdc")); }
    shuffle(df,rnd);
    for(i=0;i<lf.length;i++) add(lf[i],df[i]);
  } else if(o.edition==="nomercy"){
    LIGHT.forEach(function(c){ for(i=0;i<=9;i++) add(F(c,String(i)),null,2); ["discardall","skip","rev","d2"].forEach(function(v){ add(F(c,v),null,3); }); ["d4","skipall"].forEach(function(v){ add(F(c,v),null,2); }); });
    add(F("W","roul"),null,8); add(F("W","wrd4"),null,8); add(F("W","wd6"),null,4); add(F("W","wd10"),null,4);
  } else { // allwild
    add(F("W","wild"),null,54); add(F("W","wrev"),null,14); add(F("W","wskip"),null,14); add(F("W","wskip2"),null,6); add(F("W","wd2"),null,10); add(F("W","wd4"),null,6); add(F("W","wtd2"),null,4); add(F("W","wswap"),null,4);
  }
  return cards;
}
function shuffle(a,rnd){ rnd=rnd||Math.random; for(var i=a.length-1;i>0;i--){ var j=Math.floor(rnd()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }

/* ---------------- helpers ---------------- */
function fc(G,card){ return card.f[G.side]; }
function isWild(f){ return f.c==="W"; }
function isNum(f){ return f.v.length===1&&f.v>="0"&&f.v<="9"; }
function colorsNow(G){ return G.side?DARK:LIGHT; }
function cardName(G,card,side){ var f=card.f[side==null?G.side:side]; return f.c==="W"?VNAME[f.v]:CNAME[f.c]+" "+(isNum(f)?f.v:VNAME[f.v]); }
function ev(G,type,data){ var e={type:type}; for(var k in (data||{})) e[k]=data[k]; G.log.push(e); G.evq.push(e); return e; }
function nm(G,p){ return G.players[p].name; }
function alive(G){ return G.players.filter(function(p){ return p.alive; }); }
function nextIdx(G,from,steps,dir){
  var n=G.players.length, i=from, d=dir==null?G.dir:dir; steps=steps==null?1:steps;
  for(var s=0;s<steps;s++){ var guard=0; do{ i=(i+d+n)%n; guard++; }while(!G.players[i].alive&&guard<=n); }
  return i;
}
function teamOf(G,p){ return G.o.teams?p%2:p; }

/* ---------------- new game / round ---------------- */
function newGame(cfg){
  var o=mergeOpts(cfg.opts), n=cfg.names.length, rnd=cfg.rnd||Math.random;
  if(o.teams&&n!==4) o.teams=false;
  var G={o:o,n:n,rnd:rnd,log:[],evq:[],round:0,over:false,winner:null,
    players:cfg.names.map(function(nm,i){ return {id:i,name:nm,human:!!(cfg.humans&&cfg.humans[i]),hand:[],alive:true,score:0,called:false,out:false}; }),
    dealer:cfg.dealer!=null?cfg.dealer:Math.floor(rnd()*n)};
  G.units=o.teams?[[0,2],[1,3]]:G.players.map(function(p){ return [p.id]; });
  G.uscore=G.units.map(function(){ return 0; });
  return G;
}
function startRound(G){
  var o=G.o; G.round++; G.roundOver=null; G.evq=[];
  G.players.forEach(function(p){ p.hand=[]; p.alive=true; p.called=false; p.out=false; });
  G.side=0; G.dir=1; G.pen=null; G.phase="play"; G.drawnId=null; G.chal=null; G.roul=null; G.unoVuln=null; G.setAside=[];
  G.draw=shuffle(buildDeck(o,G.rnd),G.rnd); G.discard=[];
  G.deckSize=G.draw.length;
  var per=7;
  for(var k=0;k<per;k++) G.players.forEach(function(p){ p.hand.push(G.draw.pop()); });
  G.dealer=(G.dealer+1)%G.n; G.turn=nextIdx(G,G.dealer,1,1); G.dir=1;
  // starting card
  var guard=0, top=null;
  while(guard++<200){
    top=G.draw.pop(); var f=top.f[0];
    if(o.edition==="allwild"){ if(f.v==="wild"||guard>50) break; G.draw.unshift(top); continue; }   // ignore wild actions
    if(isNum(f)) break;
    if(o.startRule==="2022"||!startFx(o)){ G.draw.unshift(top); continue; }   // No Mercy sheet: "If this card is an Action Card, ignore it"
    if(f.v==="wd4"||f.v==="wd2"){ G.draw.unshift(top); continue; }     // Classic / Flip sheets: a Wild Draw card goes back, pick another
    break;
  }
  G.discard.push(top); var tf=top.f[0];
  G.color=tf.c==="W"?null:tf.c;
  ev(G,"deal",{text:nm(G,G.dealer)+" deals — round "+G.round+". Starting card: "+cardName(G,top)});
  if(startFx(o)&&o.startRule==="2008"&&!isNum(tf)){   // a Flip card turned up has no starting effect in the Flip sheet
    if(tf.v==="skip"){ var sk=G.turn; G.turn=nextIdx(G,G.turn,1); ev(G,"start",{text:nm(G,sk)+" is skipped"}); }
    else if(tf.v==="rev"){ G.dir=-1; G.turn=G.dealer; ev(G,"start",{text:"Reverse — "+nm(G,G.dealer)+" plays first, then play goes the other way"}); }
    else if(tf.v==="d2"||tf.v==="d1"){ drawCards(G,G.turn,DRAWN[tf.v],VNAME[tf.v]+" as the starting card"); G.turn=nextIdx(G,G.turn,1); }
    else if(tf.v==="wild"){ G.color=null; G.needColor=true; ev(G,"start",{text:nm(G,G.turn)+" chooses the starting colour"}); }
  }
  return G;
}

/* ---------------- drawing ---------------- */
function reshuffle(G){
  // Mercy rule: knocked-out hands stay set aside "until the deck runs out and needs to be reshuffled" (No Mercy sheet), then rejoin it
  var back=(G.setAside&&G.setAside.length)?G.setAside.splice(0):[];
  if(G.discard.length<=1&&!back.length) return false;
  var top=G.discard.pop(); var rest=G.discard.splice(0).concat(back);
  // a played Flip changes sides; cards go back face-down so nothing to reset
  G.draw=shuffle(rest,G.rnd); G.discard=top?[top]:[];
  ev(G,"shuffle",{text:"The discard pile is reshuffled"+(back.length?" with the knocked-out hands":"")});
  return true;
}
function drawOne(G){
  if(!G.draw.length) reshuffle(G);
  return G.draw.length?G.draw.pop():null;
}
function drawCards(G,p,n,why){
  var got=[], pl=G.players[p];
  for(var i=0;i<n;i++){ var c=drawOne(G); if(!c) break; pl.hand.push(c); got.push(c); }
  ev(G,"draw",{p:p,n:got.length,text:nm(G,p)+" draws "+got.length+" card"+(got.length===1?"":"s")+(why?" ("+why+")":"")});
  checkMercy(G,p);
  if(pl.hand.length>1) pl.called=false;
  unoGone(G,p);
  return got;
}
/* a player who no longer holds exactly one card can't be caught for not saying UNO */
function unoGone(G,p){ if(G.unoVuln===p&&G.players[p].hand.length!==1) G.unoVuln=null; }
function drawUntilColor(G,p,color,extra){
  var pl=G.players[p], c, n=0, guard=0;
  while(guard++<400){ c=drawOne(G); if(!c) break; pl.hand.push(c); n++; if(c.f[G.side].c===color) break; }
  var x=0; while(extra&&x<extra){ c=drawOne(G); if(!c) break; pl.hand.push(c); n++; x++; }
  ev(G,"draw",{p:p,n:n,text:nm(G,p)+" draws "+n+" card"+(n===1?"":"s")+" (until "+CNAME[color]+(extra?" +"+extra:"")+")"});
  checkMercy(G,p); if(pl.hand.length>1) pl.called=false; unoGone(G,p);
  return n;
}
function checkMercy(G,p){
  var o=G.o, pl=G.players[p]; if(!o.mercy||!pl.alive) return;
  if(pl.hand.length>=o.mercy){
    pl.alive=false; pl.out=true; G.mercyOut=(G.mercyOut||0)+1;
    G.setAside=(G.setAside||[]).concat(pl.hand); pl.hand=[];
    ev(G,"mercy",{p:p,text:nm(G,p)+" has "+o.mercy+" cards — knocked out by the Mercy rule!"});
  }
}

/* ---------------- legality ---------------- */
function stackable(G,card){
  var f=fc(G,card), n=DRAWN[f.v]||0, pen=G.pen, st=G.o.stack; if(!pen||!n) return false;
  if(st==="same") return f.v===pen.v;
  if(st==="cross") return true;
  if(st==="mercy") return n>=pen.last;
  return false;
}
function holdsColor(G,p,color,exceptId){
  return G.players[p].hand.some(function(c){ if(c.id===exceptId) return false; var f=fc(G,c); if(f.c===color&&f.c!=="W") return true; if(G.o.wildsCount&&f.c==="W"&&c.id!==exceptId) return true; return false; });
}
function wildDrawLegal(G,p,card){ return !holdsColor(G,p,G.color,card.id); }
function canPlay(G,p,card){
  var f=fc(G,card), top=G.discard[G.discard.length-1], tf=fc(G,top);
  if(G.pen) return stackable(G,card);
  if(G.o.edition==="allwild") return true;
  if(f.c==="W"){
    if((f.v==="wd4"||f.v==="wd2"||f.v==="wdc")&&!G.o.challenge&&G.o.edition!=="nomercy") return wildDrawLegal(G,p,card)||G.color==null;
    return true;
  }
  if(G.color==null) return true;
  if(f.c===G.color) return true;
  if(f.v===tf.v&&tf.c!=="W") return true;
  if(f.v===tf.v&&tf.c==="W"&&isNum(f)) return false;
  return false;
}
function playableIds(G,p){
  if(G.phase==="drawn"){ var c=G.players[p].hand.filter(function(x){ return x.id===G.drawnId; })[0]; return c&&canPlay(G,p,c)?[c.id]:[]; }
  if(G.phase!=="play") return [];
  return G.players[p].hand.filter(function(c){ return canPlay(G,p,c); }).map(function(c){ return c.id; });
}
function actor(G){ if(G.phase==="challenge") return G.chal.victim; if(G.phase==="roulette") return G.roul.victim; return G.turn; }

/* ---------------- playing a card ---------------- */
function needsTarget(G,f){ return (G.o.sevenZero&&f.v==="7")||f.v==="wswap"||f.v==="wtd2"; }
function play(G,p,cardId,params,out){
  params=params||{};
  if(G.over||G.roundOver) return {ok:false,msg:"The round is over."};
  var pl=G.players[p]; if(!pl||!pl.alive) return {ok:false,msg:"You're out of this round."};
  if(G.phase!=="play"&&G.phase!=="drawn") return {ok:false,msg:"Not your turn to play."};
  if(G.needColor) return {ok:false,msg:"Choose the starting colour first."};
  if(!out&&p!==G.turn) return {ok:false,msg:"It isn't your turn."};
  var idx=-1; pl.hand.forEach(function(c,i){ if(c.id===cardId) idx=i; });
  if(idx<0) return {ok:false,msg:"That card isn't in your hand."};
  if(G.phase==="drawn"&&cardId!==G.drawnId) return {ok:false,msg:"You can only play the card you just drew."};
  var card=pl.hand[idx], f=fc(G,card);
  if(!canPlay(G,p,card)) return {ok:false,msg:G.pen?"You must stack a draw card or take the penalty.":"That card doesn't match."};
  var color=null;
  if(namesColor(G,f)){ color=params.color; if(colorsNow(G).indexOf(color)<0) return {ok:false,msg:"Choose a colour for the Wild card."}; }
  var target=params.target;
  if(needsTarget(G,f)){
    var last=pl.hand.length===1&&f.v==="7";
    if(!last){ if(target==null||target===p||!G.players[target]||!G.players[target].alive) return {ok:false,msg:"Choose another player."}; }
  }
  if(G.o.noWildFinish&&pl.hand.length===1&&DRAWN[f.v]&&f.c==="W") return {ok:false,msg:"You can't go out on a Wild Draw card in this game."};
  // legal to play -> commit
  G.evq=[]; var wasIllegalWild=false;
  var colorBefore=G.color;
  if((f.v==="wd4"||f.v==="wd2"||f.v==="wdc")) wasIllegalWild=!wildDrawLegal(G,p,card);
  pl.hand.splice(idx,1); G.discard.push(card); G.drawnId=null; G.phase="play"; G.needColor=false;
  if(G.unoVuln!=null&&G.unoVuln!==p) G.unoVuln=null;
  G.color=f.c==="W"?(G.o.edition==="allwild"?null:color):f.c;
  ev(G,"play",{p:p,card:card.id,text:nm(G,p)+" plays "+cardName(G,card)+(f.c==="W"&&color?" — chooses "+CNAME[color]:"")});
  // UNO bookkeeping
  unoCheck(G,p);
  pl.armed=false;
  var win=pl.hand.length===0;
  // effects
  var res=applyEffect(G,p,card,f,{color:color,target:target,colorBefore:colorBefore,illegal:wasIllegalWild,win:win});
  if(G.roundOver) return {ok:true,events:G.evq.slice(),roundOver:G.roundOver};
  if(win||pl.hand.length===0){ return finish(G,p); }
  if(G.o.mercy&&alive(G).length===1) return finish(G,alive(G)[0].id);
  return {ok:true,events:G.evq.slice(),res:res};
}
/* down to one card: say UNO (called / armed / a computer that remembers) or stay catchable until the next player begins a turn */
function unoCheck(G,p){
  var pl=G.players[p]; if(pl.hand.length!==1) return;
  if(pl.called||pl.armed){ ev(G,"uno",{p:p,text:nm(G,p)+" says UNO!"}); pl.called=true; } else if(!pl.human&&G.rnd()>=G.o.aiForget){ ev(G,"uno",{p:p,text:nm(G,p)+" says UNO!"}); pl.called=true; } else G.unoVuln=p;
}
/* does playing this Wild face need a colour from the player? (All Wild: never; No Mercy Color Roulette: the NEXT player names it) */
function namesColor(G,f){ return f.c==="W"&&G.o.edition!=="allwild"&&f.v!=="roul"; }
function afterTurn(G,p,skip){
  // move to the next player (skipping `skip` extra players)
  G.turn=nextIdx(G,p,1+(skip||0));
}
function applyEffect(G,p,card,f,x){
  var v=f.v, o=G.o, np=alive(G).length, two=np===2, n;
  var victim=nextIdx(G,p,1);
  function pen(count,kind,viaVictim){
    // a draw card was played: either start a stack, ask for a challenge, or just make the victim draw
    // going out on a draw card: the next player still takes the whole stacked penalty (a winner never draws, e.g. 2p Wild Reverse Draw 4)
    if(x.win){ var tot=(G.pen?G.pen.n:0)+count; G.pen=null; if(viaVictim!==p) drawCards(G,viaVictim,tot,"last card"); afterTurn(G,p,0); return; }
    if(o.stack!=="none"){ G.pen={n:(G.pen?G.pen.n:0)+count,v:v,last:count}; G.turn=viaVictim; return; }
    if(o.challenge&&(v==="wd4"||v==="wd2"||v==="wdc")&&o.edition!=="nomercy"){ G.phase="challenge"; G.chal={by:p,victim:viaVictim,n:count,illegal:x.illegal,v:v,color:x.color,colorBefore:x.colorBefore,card:card.id}; return; }
    drawCards(G,viaVictim,count,VNAME[v]); G.turn=nextIdx(G,viaVictim,1);
  }
  if(isNum(f)){
    if(o.sevenZero&&v==="0"&&!x.win){ passHands(G); afterTurn(G,p,0); }   // a final 0 just wins: no hands are passed
    else if(o.sevenZero&&v==="7"&&!x.win){ swapHands(G,p,x.target); afterTurn(G,p,0); }
    else afterTurn(G,p,0);
    return;
  }
  switch(v){
    case "skip": ev(G,"skip",{p:victim,text:nm(G,victim)+" is skipped"}); afterTurn(G,p,two?1:1); if(two) G.turn=p; break;
    case "wskip": ev(G,"skip",{p:victim,text:nm(G,victim)+" is skipped"}); G.turn=two?p:nextIdx(G,p,2); break;
    case "wskip2": { var t2=p; for(var s=0;s<3;s++) t2=nextIdx(G,t2,1); ev(G,"skip",{p:victim,text:"The next two players are skipped"}); G.turn=two?p:t2; break; }
    case "skipall": ev(G,"skip",{p:p,text:"Everyone else is skipped — "+nm(G,p)+" plays again"}); G.turn=p; break;
    case "rev": case "wrev":
      G.dir=-G.dir; ev(G,"reverse",{text:"Direction reversed"}); if(two) G.turn=p; else G.turn=nextIdx(G,p,1); break;
    case "flip": doFlip(G); afterTurn(G,p,0); break;
    case "wild": case "wswap": case "wtd2": case "wd2": case "wd4": case "wdc": case "wd6": case "wd10": case "wrd4": case "roul": case "d2": case "d1": case "d5": case "d4": case "discardall": break;
  }
  if(v==="wswap"){ if(!x.win) swapHands(G,p,x.target); afterTurn(G,p,0); return; }
  if(v==="wtd2"){ drawCards(G,x.target,2,"Targeted Draw Two"); afterTurn(G,p,0); return; }
  if(v==="wild"){ afterTurn(G,p,0); return; }
  if(v==="discardall"){
    var col=f.c, mine=G.players[p].hand.filter(function(c){ return fc(G,c).c===col; });
    if(mine.length){ G.players[p].hand=G.players[p].hand.filter(function(c){ return fc(G,c).c!==col; }); // extra cards go UNDER the played card
      var top=G.discard.pop(); mine.forEach(function(c){ G.discard.push(c); }); G.discard.push(top); ev(G,"discardall",{p:p,text:nm(G,p)+" discards "+mine.length+" more "+CNAME[col]+" card"+(mine.length===1?"":"s")}); }
    if(G.players[p].hand.length===0) x.win=true;
    else if(mine.length) unoCheck(G,p);   // discarded down to one card: say UNO or be catchable
    afterTurn(G,p,0); return;
  }
  if(v==="d2"||v==="d1"||v==="d5"||v==="d4"){ pen(DRAWN[v],v,victim); return; }
  if(v==="wd2"||v==="wd4"||v==="wd6"||v==="wd10"){ pen(DRAWN[v],v,victim); return; }
  if(v==="wrd4"){ G.dir=-G.dir; ev(G,"reverse",{text:"Direction reversed"}); var vv=two?p:nextIdx(G,p,1); pen(4,v,vv); return; }
  if(v==="wdc"){
    if(x.win){ drawUntilColor(G,victim,x.color,0); afterTurn(G,p,0); return; }
    if(o.challenge){ G.phase="challenge"; G.chal={by:p,victim:victim,n:0,illegal:x.illegal,v:v,color:x.color,colorBefore:x.colorBefore,card:card.id}; return; }
    drawUntilColor(G,victim,x.color,0); G.turn=nextIdx(G,victim,1); return;
  }
  if(v==="roul"){ if(x.win){ afterTurn(G,p,0); return; } G.phase="roulette"; G.roul={victim:victim,by:p}; return; }
}
function doFlip(G){
  G.side=G.side?0:1; G.discard.reverse(); G.draw.reverse();
  var top=G.discard[G.discard.length-1], f=fc(G,top);
  G.color=f.c==="W"?null:f.c;
  ev(G,"flip",{text:"FLIP! The game is now on the "+(G.side?"Dark":"Light")+" side"});
}
function passHands(G){
  var live=alive(G).map(function(p){ return p.id; }), hands=live.map(function(i){ return G.players[i].hand; });
  var k=G.dir>0?1:-1;
  live.forEach(function(pid,i){ G.players[live[(i+k+live.length)%live.length]].hand=hands[i]; });
  live.forEach(function(pid){ G.players[pid].called=false; if(G.players[pid].hand.length>1) G.players[pid].called=false; unoGone(G,pid); });
  ev(G,"pass",{text:"Everyone passes their hand"+(k>0?" forward":" backward")});
}
function swapHands(G,a,b){
  if(b==null||a===b) return;
  var t=G.players[a].hand; G.players[a].hand=G.players[b].hand; G.players[b].hand=t;
  G.players[a].called=false; G.players[b].called=false; unoGone(G,a); unoGone(G,b);
  ev(G,"swap",{text:nm(G,a)+" swaps hands with "+nm(G,b)});
}

/* ---------------- challenge / roulette / drawing actions ---------------- */
function respondChallenge(G,p,challenge){
  if(G.phase!=="challenge"||p!==G.chal.victim) return {ok:false,msg:"Nothing to challenge."};
  G.evq=[]; var c=G.chal, by=c.by, vic=c.victim; G.chal=null; G.phase="play";
  if(G.unoVuln!=null&&G.unoVuln!==vic) G.unoVuln=null;   // answering the Wild Draw begins the next player's turn: the UNO-catch window closes
  var cnt=c.n, vname=VNAME[c.v];
  if(!challenge){ if(c.v==="wdc") drawUntilColor(G,vic,c.color,0); else drawCards(G,vic,cnt,vname); G.turn=nextIdx(G,vic,1); return finishAction(G); }
  var guilty=c.illegal;
  ev(G,"challenge",{p:vic,text:nm(G,vic)+" challenges "+nm(G,by)+"'s "+vname+" — "+(guilty?nm(G,by)+" WAS holding a matching "+CNAME[c.colorBefore]+" card!":nm(G,by)+" played it legally")});
  if(guilty){ if(c.v==="wdc") drawUntilColor(G,by,c.color,0); else drawCards(G,by,cnt,"caught"); G.turn=vic; }
  else { if(c.v==="wdc") drawUntilColor(G,vic,c.color,2); else drawCards(G,vic,cnt+2,"failed challenge"); G.turn=nextIdx(G,vic,1); }
  return finishAction(G);
}
function respondRoulette(G,p,color){
  if(G.phase!=="roulette"||p!==G.roul.victim) return {ok:false,msg:"Nothing to choose."};
  if(colorsNow(G).indexOf(color)<0) return {ok:false,msg:"Pick a colour."};
  G.evq=[]; var vic=G.roul.victim; G.roul=null; G.phase="play"; G.color=color;
  if(G.unoVuln!=null&&G.unoVuln!==vic) G.unoVuln=null;   // the next player's turn has begun: the UNO-catch window closes
  ev(G,"roulette",{p:vic,text:nm(G,vic)+" picks "+CNAME[color]+" for Color Roulette"});
  drawUntilColor(G,vic,color,0); G.turn=nextIdx(G,vic,1);
  return finishAction(G);
}
function finishAction(G){ if(G.roundOver) return {ok:true,events:G.evq.slice(),roundOver:G.roundOver}; var live=alive(G); if(live.length===1&&G.o.mercy) return finish(G,live[0].id); return {ok:true,events:G.evq.slice()}; }
function drawAction(G,p){
  if(G.over||G.roundOver) return {ok:false,msg:"The round is over."};
  if(G.phase!=="play"||p!==G.turn) return {ok:false,msg:"It isn't your turn."};
  if(G.needColor) return {ok:false,msg:"Choose the starting colour first."};
  G.evq=[]; var pl=G.players[p];
  if(G.unoVuln!=null&&G.unoVuln!==p) G.unoVuln=null;
  if(G.pen){ // take the stacked penalty
    var n=G.pen.n; G.pen=null; drawCards(G,p,n,"stacked penalty"); G.turn=nextIdx(G,p,1); return finishAction(G);
  }
  if(G.o.drawRule==="untilPlay"){
    var got=0, last=null, guard=0;
    while(guard++<300){ var c=drawOne(G); if(!c) break; pl.hand.push(c); got++; last=c; if(canPlay(G,p,c)) break; }
    ev(G,"draw",{p:p,n:got,text:nm(G,p)+" draws "+got+" card"+(got===1?"":"s")+" until one can be played"});
    checkMercy(G,p); unoGone(G,p); if(!pl.alive){ G.turn=nextIdx(G,p,1); return finishAction(G); }
    if(pl.hand.length>1) pl.called=false;
    if(last&&canPlay(G,p,last)){ G.phase="drawn"; G.drawnId=last.id; return {ok:true,events:G.evq.slice(),drawn:last.id}; }
    G.turn=nextIdx(G,p,1); return finishAction(G);
  }
  var c1=drawOne(G);
  if(!c1){ ev(G,"draw",{p:p,n:0,text:"No cards left to draw"}); G.turn=nextIdx(G,p,1); return finishAction(G); }
  pl.hand.push(c1); if(pl.hand.length>1) pl.called=false; unoGone(G,p);
  ev(G,"draw",{p:p,n:1,text:nm(G,p)+" draws a card"});
  if(canPlay(G,p,c1)){ G.phase="drawn"; G.drawnId=c1.id; return {ok:true,events:G.evq.slice(),drawn:c1.id}; }
  G.turn=nextIdx(G,p,1); return finishAction(G);
}
function passAction(G,p){
  if(G.phase!=="drawn"||p!==G.turn) return {ok:false,msg:"Nothing to pass."};
  if(G.o.forcePlay||G.o.drawRule==="untilPlay") return {ok:false,msg:"You must play the card you drew."};
  G.evq=[]; G.phase="play"; G.drawnId=null; ev(G,"pass",{p:p,text:nm(G,p)+" keeps the card and passes"}); G.turn=nextIdx(G,p,1); return finishAction(G);
}
function chooseStartColor(G,p,color){
  if(!G.needColor||p!==G.turn) return {ok:false,msg:"Not now."}; if(colorsNow(G).indexOf(color)<0) return {ok:false,msg:"Pick a colour."};
  G.color=color; G.needColor=false; ev(G,"color",{text:nm(G,p)+" starts with "+CNAME[color]}); return {ok:true,events:[]};
}

/* ---------------- UNO call / catch / jump-in ---------------- */
function callUno(G,p){
  var pl=G.players[p]; if(!pl||!pl.alive) return {ok:false,msg:"Not now."};
  G.evq=[];
  if(G.unoVuln===p){ G.unoVuln=null; pl.called=true; ev(G,"uno",{p:p,text:nm(G,p)+" says UNO!"}); return {ok:true,events:G.evq.slice()}; }
  if(pl.hand.length<=2){ pl.armed=true; if(pl.hand.length===1){ pl.called=true; ev(G,"uno",{p:p,text:nm(G,p)+" says UNO!"}); } return {ok:true,events:G.evq.slice()}; }
  return {ok:false,msg:"You can only call UNO with two cards or fewer."};
}
function catchUno(G,by,target){
  if(G.unoVuln==null||G.unoVuln!==target||by===target||!G.players[target]||G.players[target].hand.length!==1) return {ok:false,msg:"Too late — nobody to catch."};
  G.evq=[]; var pen=G.o.unoPenalty; G.unoVuln=null; G.players[target].called=true;
  ev(G,"catch",{p:target,by:by,text:nm(G,by)+" catches "+nm(G,target)+" — didn't say UNO!"});
  drawCards(G,target,pen,"forgot UNO"); return {ok:true,events:G.evq.slice()};
}
function identical(G,card){ var top=G.discard[G.discard.length-1], f=fc(G,card), tf=fc(G,top); return tf.c!=="W"&&f.c===tf.c&&f.v===tf.v&&G.color===tf.c; }
function jumpIds(G,p){
  if(!G.o.jumpIn||G.phase!=="play"||G.pen||p===G.turn||!G.players[p]||!G.players[p].alive||G.players[p].hand.length<2&&false) return [];
  return G.players[p].hand.filter(function(c){ return identical(G,c); }).map(function(c){ return c.id; });
}
function jumpIn(G,p,cardId,params){
  if(jumpIds(G,p).indexOf(cardId)<0) return {ok:false,msg:"You can't jump in with that card."};
  var prev=G.turn; return play(G,p,cardId,params,true);
}

/* ---------------- ending a round ---------------- */
function cardPoints(G,f){
  var o=G.o, v=f.v;
  if(isNum(f)) return +v;
  if(o.edition==="flip"){ return {d1:10,rev:20,skip:20,flip:20,d5:20,skipall:30,wild:40,wd2:50,wdc:60}[v]||20; }
  if(o.edition==="allwild"){ return v==="wild"?20:50; }
  if(f.c==="W") return 50;
  return 20;
}
function handPoints(G,p){ var s=0; G.players[p].hand.forEach(function(c){ s+=cardPoints(G,fc(G,c)); }); return s; }
function finish(G,winner){
  // row.left = points of the cards still held, row.cards = how many cards, row.out = knocked out by the Mercy rule
  var o=G.o, rows=G.units.map(function(u,ui){ return {id:ui,players:u.slice(),name:u.map(function(i){ return nm(G,i); }).join(" & "),points:0,left:0,cards:0,out:u.every(function(i){ return !!G.players[i].out; })}; });
  var wu=teamOf(G,winner), total=0;
  G.players.forEach(function(p,i){ var r=rows[teamOf(G,i)]; r.left+=handPoints(G,i); r.cards+=p.hand.length; });
  if(o.scoring==="tally"){
    rows.forEach(function(r){ r.points=r.left; G.uscore[r.id]+=r.points; });
  } else {
    rows.forEach(function(r){ if(r.id!==wu) total+=r.left; });
    var bonus=(o.mercy&&G.mercyOut)?250*G.mercyOut:0;
    rows[wu].points=total+bonus; rows[wu].bonus=bonus; G.uscore[wu]+=total+bonus;
  }
  G.players.forEach(function(p,i){ p.score=G.uscore[teamOf(G,i)]; });
  G.mercyOut=0;
  var over=false, win=null;
  if(o.target===0){ over=true; win=wu; }
  else if(o.scoring==="tally"){ var mx=Math.max.apply(null,G.uscore); if(mx>=o.target){ over=true; var mn=Math.min.apply(null,G.uscore); win=G.uscore.indexOf(mn); } }
  else { var best=Math.max.apply(null,G.uscore); if(best>=o.target){ var tops=G.uscore.map(function(s,i){ return s===best?i:-1; }).filter(function(i){ return i>=0; }); over=true; win=tops.indexOf(wu)>=0?wu:tops[0]; } }
  if(over){ G.over=true; G.winner=win; }
  G.roundOver={winner:winner,winUnit:wu,rows:rows,over:over,gameWinner:win,gameWinnerName:win!=null?G.units[win].map(function(i){ return nm(G,i); }).join(" & "):null};
  G.phase="roundover";
  ev(G,"roundOver",{p:winner,text:nm(G,winner)+" goes out and wins the round!"});
  return {ok:true,events:G.evq.slice(),roundOver:G.roundOver};
}

/* ======================= computer player ======================= */
function colorCounts(G,p,exceptId){
  var cnt={}; colorsNow(G).forEach(function(c){ cnt[c]=0; });
  G.players[p].hand.forEach(function(c){ if(c.id===exceptId) return; var f=fc(G,c); if(f.c!=="W") cnt[f.c]=(cnt[f.c]||0)+1; });
  return cnt;
}
function bestColor(G,p,exceptId){
  var cnt=colorCounts(G,p,exceptId), best=null, bs=-1;
  colorsNow(G).forEach(function(c){ var s=cnt[c]*10+G.rnd(); if(G.seenLack&&G.seenLack[nextIdx(G,p,1)]&&G.seenLack[nextIdx(G,p,1)][c]) s+=4; if(s>bs){ bs=s; best=c; } });
  return best;
}
function threat(G,p){ // is the next player close to winning?
  var nx=nextIdx(G,p,1); return G.players[nx].hand.length<=2;
}
function cardScore(G,p,card){
  var f=fc(G,card), v=f.v, hand=G.players[p].hand, sc=0, nx=nextIdx(G,p,1), nh=G.players[nx].hand.length;
  var cnt=colorCounts(G,p,card.id);
  if(f.c==="W"){ sc-=6; if(hand.length<=3) sc+=8; if(nh<=2) sc+=5; if(DRAWN[v]) { sc+=(nh<=3?7:-1); } return sc; }
  sc+= (cnt[f.c]||0)*1.2;                       // dump the colour we hold most of
  sc+= isNum(f)?(+f.v)*0.3:2;                   // dump expensive cards early
  if(v==="skip"||v==="rev"||v==="skipall"||v==="d2"||v==="d1"||v==="d5"||v==="d4"){ if(nh<=2) sc+=7; else sc-=1.5; }
  if(v==="discardall") sc+=3+(cnt[f.c]||0);
  if(v==="flip") sc+=(hand.length>6?1:-1);
  return sc;
}
function aiAction(G,p){
  if(G.over||G.roundOver) return null;
  var pl=G.players[p];
  if(G.needColor&&p===G.turn) return {t:"startColor",color:bestColor(G,p)};
  if(G.phase==="challenge"&&p===G.chal.victim){
    var c=G.chal, by=G.players[c.by], hs=by.hand.length;
    // estimate the chance the player really held a matching colour
    var seenLack=G.seenLack&&G.seenLack[c.by]&&G.seenLack[c.by][c.colorBefore];
    var pr=seenLack?0.08:Math.min(0.75,0.22+hs*0.07);
    return {t:"challenge",yes:(G.o.challenge&&pr>=0.36&&G.rnd()<0.9)};
  }
  if(G.phase==="roulette"&&p===G.roul.victim) return {t:"roulette",color:bestColor(G,p)};
  if(G.phase==="drawn"){ var c2=pl.hand.filter(function(x){ return x.id===G.drawnId; })[0]; if(c2&&canPlay(G,p,c2)){ return playParams(G,p,c2); } return {t:"pass"}; }
  if(G.phase==="play"){
    var ids=playableIds(G,p);
    if(!ids.length) return {t:"draw"};
    var cards=ids.map(function(id){ return pl.hand.filter(function(c){ return c.id===id; })[0]; });
    if(G.pen){ cards.sort(function(a,b){ return (DRAWN[fc(G,a).v]||0)-(DRAWN[fc(G,b).v]||0); }); return playParams(G,p,cards[0]); }
    // go out if possible
    if(pl.hand.length===1) return playParams(G,p,cards[0]);
    // 2 cards: prefer the play that leaves a flexible last card
    var best=null,bs=-1e9;
    cards.forEach(function(c){ var s=cardScore(G,p,c); if(pl.hand.length===2){ var other=pl.hand.filter(function(x){ return x.id!==c.id; })[0], of=fc(G,other); if(of.c==="W"||of.c===fc(G,c).c||of.v===fc(G,c).v) s+=4; } if(s>bs){ bs=s; best=c; } });
    // keep wild cards for later unless needed
    if(G.o.edition!=="allwild"){ var nonWild=cards.filter(function(c){ return fc(G,c).c!=="W"; }); if(nonWild.length&&threat(G,p)===false&&fc(G,best).c==="W"&&pl.hand.length>3) { var b2=null,s2=-1e9; nonWild.forEach(function(c){ var s=cardScore(G,p,c); if(s>s2){ s2=s; b2=c; } }); best=b2; } }
    return playParams(G,p,best);
  }
  return null;
}
function playParams(G,p,card){
  var f=fc(G,card), a={t:"play",card:card.id};
  if(namesColor(G,f)) a.color=bestColor(G,p,card.id);
  if(needsTarget(G,f)){
    var best=null,bs=-1e9;
    G.players.forEach(function(q,i){ if(i===p||!q.alive) return; var s;
      if(f.v==="wtd2") s=-q.hand.length+(q.hand.length<=2?20:0)+(i===nextIdx(G,p,1)?3:0);
      else s=-q.hand.length;   // 7 / Forced Swap: take the smallest hand
      s+=G.rnd(); if(s>bs){ bs=s; best=i; } });
    a.target=best;
  }
  return a;
}
function applyAction(G,p,a){
  if(a.t==="play") return play(G,p,a.card,{color:a.color,target:a.target});
  if(a.t==="draw") return drawAction(G,p);
  if(a.t==="pass") return passAction(G,p);
  if(a.t==="challenge") return respondChallenge(G,p,!!a.yes);
  if(a.t==="roulette") return respondRoulette(G,p,a.color);
  if(a.t==="startColor") return chooseStartColor(G,p,a.color);
  if(a.t==="uno") return callUno(G,p);
  if(a.t==="catch") return catchUno(G,p,a.target);
  if(a.t==="jump") return jumpIn(G,p,a.card,{color:a.color,target:a.target});
  return {ok:false,msg:"Unknown action."};
}
/* Computers who see a player left holding one card un-called may catch them */
function aiCatchTarget(G){ var v=G.unoVuln; return v!=null&&G.players[v]&&G.players[v].alive&&G.players[v].hand.length===1?v:null; }
function noteLack(G){ /* remember colours a player had to draw on */ }

/* ---------------- snapshot for a viewer ---------------- */
function snapshot(G,me){
  var mp=me>=0?G.players[me]:null, act=G.over||G.roundOver?-1:actor(G);
  var top=G.discard[G.discard.length-1];
  var s={o:G.o,n:G.n,round:G.round,side:G.side,dir:G.dir,color:G.color,turn:G.turn,actor:act,me:me,phase:G.phase,needColor:!!G.needColor,
    top:top?{id:top.id,f:top.f}:null,topName:top?cardName(G,top):"",drawCount:G.draw.length,discardCount:G.discard.length,
    pen:G.pen?{n:G.pen.n,v:G.pen.v}:null,
    chal:(G.phase==="challenge")?{by:G.chal.by,victim:G.chal.victim,v:G.chal.v,n:G.chal.n}:null,
    roul:(G.phase==="roulette")?{victim:G.roul.victim}:null,
    players:G.players.map(function(p,i){ return {id:i,name:p.name,human:p.human,cards:p.hand.length,alive:p.alive,out:p.out,score:G.uscore?G.uscore[teamOf(G,i)]:0,team:G.o.teams?i%2:-1,called:p.called,vuln:G.unoVuln===i&&p.hand.length===1}; }),
    units:G.units,uscore:G.uscore,
    hand:mp?mp.hand.map(function(c){ return {id:c.id,f:c.f}; }):[],
    playable:(mp&&act===me)?playableIds(G,me):[],
    drawnId:(mp&&G.phase==="drawn"&&G.turn===me)?G.drawnId:null,
    canPass:!!(mp&&G.phase==="drawn"&&G.turn===me&&!G.o.forcePlay&&G.o.drawRule!=="untilPlay"),
    jump:mp?jumpIds(G,me):[],
    over:G.over,winner:G.winner,roundOver:G.roundOver,
    log:G.log.slice(-7).map(function(e){ return e.text; }).filter(Boolean)};
  return s;
}

Uno.Engine={VERSIONS:VERSIONS,HOUSE:HOUSE,houseFor:houseFor,namesColor:namesColor,defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOpts:versionOpts,buildDeck:buildDeck,newGame:newGame,startRound:startRound,
  canPlay:canPlay,playableIds:playableIds,actor:actor,play:play,drawAction:drawAction,passAction:passAction,respondChallenge:respondChallenge,respondRoulette:respondRoulette,
  chooseStartColor:chooseStartColor,callUno:callUno,catchUno:catchUno,jumpIn:jumpIn,jumpIds:jumpIds,aiAction:aiAction,applyAction:applyAction,aiCatchTarget:aiCatchTarget,
  snapshot:snapshot,cardName:cardName,cardPoints:cardPoints,handPoints:handPoints,colorsNow:colorsNow,CNAME:CNAME,VNAME:VNAME,DRAWN:DRAWN,LIGHT:LIGHT,DARK:DARK,isNum:isNum,needsTarget:needsTarget,alive:alive,nextIdx:nextIdx,bestColor:bestColor};
if(typeof module!=="undefined"&&module.exports) module.exports=Uno.Engine;
})(typeof window!=="undefined"?window:globalThis);
