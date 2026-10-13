/* RISK — pure rules engine + computer player (no DOM). Needs map.js first (Risk.MAP).
   State G: terr[i]={o:ownerIdx|-1,a:armies}; players[]; phase; reserve; cards; etc. Every action returns {ok,msg?,events?...}. */
(function(g){
"use strict";
var Risk=g.Risk=g.Risk||{}, M=null;
function map(){ return M||(M=Risk.MAP); }

/* ---------------- options / versions ---------------- */
function defaultOpts(){
  return {
    mode:"classic",          // classic (conquer the world) | mission (Secret Mission Risk) | capital (Capital / Headquarters Risk)
    setup:"deal1",           // deal1 (1959: deal all cards, 1 army each) | claim (1963+: take turns claiming, then deploy) | dealPlace (deal, then deploy the rest)
    startArmies:"auto",      // "auto" = 3p 35, 4p 30, 5p 25, 6p 20 (not used by deal1)
    terrBonus:"none",        // none | perCard (+2 per traded card whose territory you own) | cap2turn (at most +2 a turn, 1980/1993 booklets) | cap2 (+2 on every trade-in)
    cardValues:"escalate",   // escalate 4,6,8,10,12,15,+5 | escalate1 (4,5,6,...) | fixed (Artillery 4, Infantry 6, Cavalry 8, mixed 10)
    wilds:true,
    forcedTrade:5,           // must trade a set when starting a turn holding this many cards
    elimTradeDown:true,      // after capturing an eliminated player's cards: trade immediately down to 4 if you hold 6+
    fortify:"adjacent",      // adjacent (one territory -> one neighbour) | connected (any path through your own territories) | steps7 (up to 7 single-army moves, old UK)
    reinforceOrAttack:false, // old UK rule: reinforce OR attack each turn
    cardOnElim:true,         // take an eliminated player's cards (old UK: no)
    capArmies:0,             // 12 = "experts" cap on armies per territory (0 = none)
    randomSetup:false,       // convenience: finish the starting placement automatically
    occupyMin1:false,        // house rule: after a conquest you may move in as few as 1 army (published rules: at least as many as the dice you rolled)
    occupyFree:true,         // house rule (on by default): after a conquest, shift armies back and forth between the two territories for the rest of the attack phase
    missionRules:"us",       // us | uk (old UK Secret Mission: kill the target yourself, else your mission becomes 24 territories; 14-card mission deck)
    maxPlayers:6
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) d[k]=o[k]; return d; }
var VERSIONS=[
  {id:"1959",name:"1959 Original",tag:"1960s Parker Brothers",desc:"The 1960s original: all 42 cards dealt, ONE army on each territory, no extra starting armies, no territory bonus on card trades, free move = one territory to one neighbour.",opts:{}},
  {id:"1963",name:"1963 Classic",tag:"Parker Brothers, 1963–75",desc:"Players take turns claiming territories, then place the rest of their starting armies (35/30/25/20). Trading in a card gives +2 armies for each card showing a territory you own.",opts:{setup:"claim",terrBonus:"perCard"}},
  {id:"1980",name:"1980 Classic",tag:"Parker Brothers, 1980",desc:"As 1963, but the territory bonus is capped at +2 armies a turn.",opts:{setup:"claim",terrBonus:"cap2turn"}},
  {id:"1993",name:"1993 Modern Classic",tag:"Hasbro / Parker Brothers",desc:"The 1993–2003 booklet: claim setup, +2 territory bonus (at most 2 a turn), forced trade at 5+ cards, trade down to 4 after eliminating a player.",opts:{setup:"claim",terrBonus:"cap2turn"}},
  {id:"modern",name:"Current Hasbro",tag:"2015–16 edition",desc:"Like 1993, but you may fortify along any connected path of your territories, and the +2 territory bonus comes with every trade-in.",opts:{setup:"claim",terrBonus:"cap2",fortify:"connected"}},
  {id:"uk",name:"Old UK Rules",tag:"European / UK rulebook",desc:"Reinforce OR attack each turn, fixed card values by type, redeploy up to 7 single armies, and you don't take an eliminated player's cards.",opts:{setup:"dealPlace",reinforceOrAttack:true,cardValues:"fixed",fortify:"steps7",cardOnElim:false,terrBonus:"none",missionRules:"uk"}}
];
var GAMEMODES=[["classic","Conquer the World"],["mission","Secret Mission Risk"],["capital","Capital Risk"]];
var HOUSE=[
  ["mode","Game type","choice",[["classic","Conquer the World"],["mission","Secret Mission"],["capital","Capital (HQ) Risk"]]],
  ["setup","Starting setup","choice",[["deal1","Deal cards, 1 army each (1959)"],["claim","Take turns claiming (1963+)"],["dealPlace","Deal, then place the rest"]]],
  ["terrBonus","+2 for territory on a traded card","choice",[["none","None"],["perCard","+2 per card (1963)"],["cap2turn","Max +2 a turn (1980, 1993)"],["cap2","+2 per trade-in (2015+)"]]],
  ["cardValues","Card set values","choice",[["escalate","4,6,8,10,12,15,+5"],["escalate1","4,5,6,7,… (+1 each)"],["fixed","Fixed by type (UK)"]]],
  ["wilds","Wild cards (jokers)","bool"],
  ["fortify","Free move","choice",[["adjacent","One territory → one neighbour"],["connected","Any connected path"],["steps7","Up to 7 single steps"]]],
  ["reinforceOrAttack","Reinforce OR attack (old UK)","bool"],
  ["cardOnElim","Take cards of an eliminated player","bool"],
  ["capArmies","Army cap per territory","choice",[[0,"None"],[12,"12 (experts)"]]],
  ["randomSetup","Place starting armies automatically","bool"],
  ["occupyMin1","Move in from 1 army after a conquest","bool"],
  ["occupyFree","Shift armies back and forth after a conquest","bool"]
];
/* 1 = published rule, 0 = house rule. occupyFree used to also lower the move-in minimum to 1; that part is now occupyMin1 (off), so old saved settings keep their meaning for the shift */
var HOUSE_OFFICIAL={mode:1,setup:1,terrBonus:1,cardValues:1,wilds:1,fortify:1,reinforceOrAttack:1,cardOnElim:1,capArmies:1,randomSetup:0,occupyMin1:0,occupyFree:0};
function versionOpts(id,extra){ var v=VERSIONS.filter(function(x){ return x.id===id; })[0]||VERSIONS[0]; var o={}; for(var k in v.opts) o[k]=v.opts[k]; for(var k2 in (extra||{})) o[k2]=extra[k2]; return mergeOpts(o); }

/* ---------------- helpers ---------------- */
function rollDie(G){ return 1+Math.floor(G.rnd()*6); }
function shuffle(a,rnd){ rnd=rnd||Math.random; for(var i=a.length-1;i>0;i--){ var j=Math.floor(rnd()*(i+1)); var t=a[i]; a[i]=a[j]; a[j]=t; } return a; }
function ev(G,type,data){ var e={type:type}; for(var k in (data||{})) e[k]=data[k]; G.log.push(e); return e; }
function pn(G,p){ return G.players[p]?G.players[p].name:"?"; }
function tname(i){ return map().names[i]; }
function cur(G){ return G.players[G.turn]; }
function owned(G,p){ var r=[]; for(var i=0;i<G.terr.length;i++) if(G.terr[i].o===p) r.push(i); return r; }
function startArmiesFor(n){ return {3:35,4:30,5:25,6:20}[n]||35; }

/* ---------------- new game ---------------- */
/* cfg: {names:[], humans:[bool], opts, rnd} ; 2 players adds a neutral army ("Neutral") as an extra seat */
function newGame(cfg){
  var o=mergeOpts(cfg.opts), rnd=cfg.rnd||Math.random, n=cfg.names.length, MP=map();
  var G={o:o,rnd:rnd,log:[],n:n,two:(n===2),over:false,winner:null,
    players:cfg.names.map(function(nm,i){ return {id:i,name:nm,human:!!(cfg.humans&&cfg.humans[i]),ci:(cfg.colors&&cfg.colors[i]!=null)?cfg.colors[i]:i,alive:true,cards:[],neutral:false,mission:null,hq:null,hqKept:null}; }),
    terr:MP.names.map(function(){ return {o:-1,a:0}; }),
    deck:[],discard:[],setsTraded:0,turn:0,phase:"setup",reserve:0,conquered:false,returnTo:"attack",
    fortLeft:0,occ:null,noAttack:false,pending:null,sub:null,initLeft:[],claimIdx:0,hqPicked:[],seq:0};
  if(G.two){ G.players.push({id:2,name:"Neutral",human:false,ci:-1,alive:true,cards:[],neutral:true,mission:null,hq:null}); }
  buildDeck(G); setup(G);
  return G;
}
function buildDeck(G){
  var MP=map(), d=[]; for(var i=0;i<MP.n;i++) d.push({id:i,t:i,sym:MP.sym[i]});
  if(G.o.wilds){ d.push({id:100,t:-1,sym:"W"}); d.push({id:101,t:-1,sym:"W"}); }
  G.deck=shuffle(d,G.rnd); G.discard=[];
}
function realPlayers(G){ return G.players.filter(function(p){ return !p.neutral; }); }

function setup(G){
  var o=G.o, MP=map(), np=realPlayers(G).length, i;
  var terrCards=[]; for(i=0;i<MP.n;i++) terrCards.push(i);
  G.setupFirst=0;
  if(G.two){
    // 2-player rules: three piles of 14 (you, your opponent, neutral), 40 armies each
    shuffle(terrCards,G.rnd);
    for(i=0;i<MP.n;i++){ G.terr[terrCards[i]]={o:Math.floor(i/14),a:1}; }
    G.initLeft=[26,26,26]; G.phase="setup2p"; G.turn=Math.floor(G.rnd()*2); G.sub={n:0,neutral:0};
    ev(G,"setup",{text:"Two-player game: cards dealt into three piles of 14 (you, your opponent and a neutral army of 14)."});
    afterSetupPrep(G); return;
  }
  if(o.setup==="deal1"){
    shuffle(terrCards,G.rnd); var d=Math.floor(G.rnd()*np);
    for(i=0;i<MP.n;i++){ G.terr[terrCards[i]]={o:(d+1+i)%np,a:1}; }
    ev(G,"setup",{text:"All 42 territory cards are dealt; every player puts one army on each of their territories."});
    G.initLeft=G.players.map(function(){ return 0; });
    G.turn=(d+1)%np; beginSetupDone(G);
  } else if(o.setup==="dealPlace"){
    shuffle(terrCards,G.rnd); var d2=Math.floor(G.rnd()*np);
    for(i=0;i<MP.n;i++){ G.terr[terrCards[i]]={o:(d2+i)%np,a:1}; }
    var sa=startArmiesOf(G); G.initLeft=G.players.map(function(p,pi){ return sa-owned(G,pi).length; });
    G.phase="deploy"; G.turn=(d2)%np; if(G.turn<0) G.turn=0; G.deployStart=G.turn;   // whoever places the first army takes the first turn
    ev(G,"setup",{text:"Territories are dealt; players now place the rest of their starting armies one at a time."});
  } else {
    G.initLeft=G.players.map(function(){ return startArmiesOf(G); });
    G.phase="claim"; G.turn=Math.floor(G.rnd()*np); G.deployStart=G.turn;   // whoever places the first army takes the first turn
    ev(G,"setup",{text:pn(G,G.turn)+" rolls highest and claims first. Take turns claiming an empty territory."});
  }
  afterSetupPrep(G);
}
function startArmiesOf(G){ var o=G.o; return typeof o.startArmies==="number"?o.startArmies:startArmiesFor(realPlayers(G).length); }
function afterSetupPrep(G){
  if(G.o.randomSetup&&G.phase!=="play") autoFinishSetup(G);
}
function beginSetupDone(G){
  // setup is complete -> maybe HQ pick, mission deal, then play
  var o=G.o;
  if(o.mode==="mission"&&!G.missionsDealt) dealMissions(G);
  if(o.mode==="capital"&&G.hqPicked.length<realPlayers(G).length){ G.phase="hq"; G.hqOrder=realPlayers(G).map(function(p){ return p.id; }); G.hqIdx=0; G.turnAfterHq=G.turn; G.turn=G.hqOrder[0]; return; }
  startPlay(G);
}
function startPlay(G){
  buildDeck(G);
  if(G.o.mode==="capital"){ // HQ cards are set aside
    G.deck=G.deck.filter(function(c){ return G.players.every(function(p){ return p.hq!==c.t; }); });
  }
  G.phase="play"; if(G.turnAfterHq!=null){ G.turn=G.turnAfterHq; G.turnAfterHq=null; }
  ev(G,"start",{text:"Setup complete — "+pn(G,G.turn)+" takes the first turn."});
  beginTurn(G);
}

/* ---------------- missions ---------------- */
function missionDeck(G){
  var MP=map(), cs=MP.continents, d=[], np=realPlayers(G).length, i;
  for(i=0;i<6;i++) d.push({k:"kill",c:i});
  d.push({k:"cont",c:[3,2]},{k:"cont",c:[3,1]},{k:"cont",c:[0,1]},{k:"cont",c:[0,5]});
  d.push({k:"terr",n:18,min:2},{k:"terr",n:24,min:1});
  return d;
}
function missionText(G,m){
  var cn=map().continents;
  if(m.k==="kill") return "Destroy all "+(G.players[m.c]?G.players[m.c].name:"?")+"'s armies.";
  if(m.k==="cont") return "Conquer "+m.c.map(function(c){ return cn[c].name; }).join(" and ")+(m.plus?", plus a third continent of your choice":"")+".";
  return "Occupy "+m.n+" territories"+(m.min>1?" with at least "+m.min+" armies in each":"")+".";
}
/* continent order in map.js must be: 0 North America, 1 South America, 2 Europe, 3 Africa, 4 Asia, 5 Australia — mission continents are by NAME for safety */
function contIdx(name){ var cs=map().continents; for(var i=0;i<cs.length;i++) if(cs[i].name===name) return i; return -1; }
function dealMissions(G){
  var np=realPlayers(G).length, d=[], I=contIdx;
  var NA=I("North America"),SA=I("South America"),EU=I("Europe"),AF=I("Africa"),AS=I("Asia"),AU=I("Australia");
  for(var c=0;c<np;c++) d.push({k:"kill",c:c});
  d.push({k:"cont",c:[AS,SA]},{k:"cont",c:[AS,AF]},{k:"cont",c:[NA,AF]},{k:"cont",c:[NA,AU]},{k:"terr",n:18,min:2},{k:"terr",n:24,min:1});
  if(G.o.missionRules==="uk") d.push({k:"cont",c:[EU,SA],plus:1},{k:"cont",c:[EU,AU],plus:1});   // the UK/European deck has two more: Europe + South America / Australia + a third continent
  shuffle(d,G.rnd);
  realPlayers(G).forEach(function(p){ var m=d.pop(); if(m.k==="kill"&&m.c===p.id) m={k:"terr",n:24,min:1}; p.mission=m; });
  G.missionsDealt=true;
  ev(G,"setup",{text:"Each player is dealt a secret mission."});
}
function missionDone(G,p){
  var m=G.players[p].mission; if(!m) return false;
  if(m.k==="kill"){ return !G.players[m.c].alive||owned(G,m.c).length===0; }
  if(m.k==="cont"){
    var full=function(c){ return map().continents[c].terrs.every(function(t){ return G.terr[t].o===p; }); };
    if(!m.c.every(full)) return false;
    var extra=0; map().continents.forEach(function(c,ci){ if(m.c.indexOf(ci)<0&&full(ci)) extra++; });
    return extra>=(m.plus||0);
  }
  var n=0; G.terr.forEach(function(t){ if(t.o===p&&t.a>=m.min) n++; }); return n>=m.n;
}

/* ---------------- setup actions ---------------- */
function nextAlive(G,from){ var n=G.players.length, i=from; for(var k=0;k<n;k++){ i=(i+1)%n; if(G.players[i].alive&&!G.players[i].neutral) return i; } return from; }
function claimTerr(G,t){
  if(G.phase!=="claim") return {ok:false,msg:"Not claiming right now."};
  if(G.terr[t].o!==-1) return {ok:false,msg:"That territory is already taken."};
  var p=G.turn; G.terr[t]={o:p,a:1}; G.initLeft[p]--;
  var events=[ev(G,"claim",{p:p,t:t,text:pn(G,p)+" claims "+tname(t)})];
  if(G.terr.every(function(x){ return x.o!==-1; })){ G.phase="deploy"; events.push(ev(G,"setup",{text:"All territories are claimed. Now place your remaining starting armies, one at a time."})); }
  G.turn=nextAlive(G,G.turn); skipDone(G);
  return {ok:true,events:events};
}
function skipDone(G){
  if(G.phase!=="deploy") return;
  var np=G.players.length, safety=0;
  while(G.initLeft[G.turn]<=0&&safety++<np+1&&!G.players[G.turn].neutral) G.turn=nextAlive(G,G.turn);
  if(G.initLeft.every(function(x,i){ return x<=0||G.players[i].neutral; })) finishDeploy(G);
}
function finishDeploy(G){ ev(G,"setup",{text:"All starting armies are placed."}); G.turn=G.deployStart!=null?G.deployStart:0; beginSetupDone(G); }
function deployOne(G,t){
  if(G.phase!=="deploy") return {ok:false,msg:"Not deploying right now."};
  if(G.terr[t].o!==G.turn) return {ok:false,msg:"Place on one of your own territories."};
  G.terr[t].a++; G.initLeft[G.turn]--;
  var events=[ev(G,"place",{p:G.turn,t:t,n:1,text:pn(G,G.turn)+" places an army on "+tname(t)})];
  G.turn=nextAlive(G,G.turn); skipDone(G);
  return {ok:true,events:events};
}
/* two-player setup: each turn place 2 own armies (on 1 or 2 territories) and 1 neutral army */
function setup2p(G,mine,neutral){
  if(G.phase!=="setup2p") return {ok:false,msg:"Not in setup."};
  var p=G.turn, ok=true;
  if(mine.length!==Math.min(2,G.initLeft[p])) return {ok:false,msg:"Place "+Math.min(2,G.initLeft[p])+" of your armies."};
  var okOwn=mine.every(function(t){ return G.terr[t].o===p; }); if(!okOwn) return {ok:false,msg:"Place your armies on your own territories."};
  if(G.initLeft[2]>0){ if(neutral==null||G.terr[neutral].o!==2) return {ok:false,msg:"Place a neutral army on a neutral territory."}; }
  mine.forEach(function(t){ G.terr[t].a++; }); G.initLeft[p]-=mine.length;
  if(G.initLeft[2]>0&&neutral!=null){ G.terr[neutral].a++; G.initLeft[2]--; }
  var events=[ev(G,"place",{p:p,text:pn(G,p)+" places "+mine.length+" armies and 1 neutral army"})];
  G.turn=G.turn===0?1:0;
  if(G.initLeft[0]<=0&&G.initLeft[1]<=0){ ev(G,"setup",{text:"All armies are placed."}); G.turn=Math.floor(G.rnd()*2); beginSetupDone(G); }
  return {ok:true,events:events};
}
function pickHq(G,t){
  if(G.phase!=="hq") return {ok:false,msg:"Not choosing a headquarters."};
  var p=G.turn; if(G.terr[t].o!==p) return {ok:false,msg:"Your headquarters must be one of your own territories."};
  G.players[p].hq=t; G.hqPicked.push(p); G.hqIdx++;
  var events=[ev(G,"hq",{p:p,text:pn(G,p)+" has chosen a secret headquarters."})];
  if(G.hqIdx>=G.hqOrder.length){ events.push(ev(G,"setup",{text:"Headquarters revealed: "+realPlayers(G).map(function(q){ return pn(G,q.id)+" — "+tname(q.hq); }).join(", ")})); startPlay(G); }
  else G.turn=G.hqOrder[G.hqIdx];
  return {ok:true,events:events};
}

/* ---------------- turn flow ---------------- */
function terrArmies(G,p){ return Math.max(3,Math.floor(owned(G,p).length/3)); }
function contBonus(G,p){ var s=0; map().continents.forEach(function(c){ if(c.terrs.every(function(t){ return G.terr[t].o===p; })) s+=c.bonus; }); return s; }
function beginTurn(G){
  var p=G.turn, pl=G.players[p];
  G.conquered=false; G.occ=null; G.noAttack=false; G.fortLeft=0; G.tradedThisTurn=false; G.terrBonusTurn=false;
  if(G.o.reinforceOrAttack){ G.phase="choose"; G.reserve=contBonus(G,p); ev(G,"turn",{p:p,text:pn(G,p)+"'s turn — reinforce or attack"}); return; }
  G.reserve=terrArmies(G,p)+contBonus(G,p); G.phase="reinforce"; G.returnTo="attack";
  ev(G,"turn",{p:p,text:pn(G,p)+" receives "+G.reserve+" armies ("+terrArmies(G,p)+" for territories"+(contBonus(G,p)?", "+contBonus(G,p)+" for continents":"")+")"});
}
function chooseMode(G,m){
  if(G.phase!=="choose") return {ok:false,msg:"Nothing to choose."};
  if(m==="reinforce"){ G.reserve+=terrArmies(G,G.turn); G.noAttack=true; } else G.noAttack=false;
  G.phase="reinforce"; G.returnTo=G.noAttack?"fortify":"attack";
  return {ok:true,events:[ev(G,"mode",{text:pn(G,G.turn)+" chooses to "+(m==="reinforce"?"reinforce":"attack")})]};
}
function mustTrade(G){ var p=cur(G); return G.phase==="reinforce"&&(p.cards.length>=G.o.forcedTrade&&!G.tradedThisTurnForced||G.mustDown&&p.cards.length>4); }
function setValue(G,cards){
  var o=G.o;
  if(o.cardValues==="fixed"){
    var s=cards.map(function(c){ return c.sym; }), nw=s.filter(function(x){ return x!=="W"; });
    if(nw.length===2&&nw[0]===nw[1]) return {A:4,I:6,C:8}[nw[0]]||10;   // a joker with a pair can only complete three alike
    if(nw.length<3||(new Set(s)).size===3) return 10;
    return {A:4,I:6,C:8}[s[0]]||10;
  }
  var k=G.setsTraded, v;
  if(o.cardValues==="escalate1") return 4+k;
  var tab=[4,6,8,10,12,15]; if(k<tab.length) v=tab[k]; else v=15+5*(k-5);
  return v;
}
function validSet(cards){
  if(cards.length!==3) return false;
  var w=cards.filter(function(c){ return c.sym==="W"; }).length;
  var syms=cards.filter(function(c){ return c.sym!=="W"; }).map(function(c){ return c.sym; });
  if(w>=1){ if(w>=2) return true; return true; } // wild + any two = a set
  var u={}; syms.forEach(function(s){ u[s]=1; }); var n=Object.keys(u).length;
  return n===1||n===3;
}
function findSets(cards){
  var out=[], i,j,k;
  for(i=0;i<cards.length;i++) for(j=i+1;j<cards.length;j++) for(k=j+1;k<cards.length;k++){ var s=[cards[i],cards[j],cards[k]]; if(validSet(s)) out.push(s); }
  return out;
}
function tradeCards(G,ids,bonusTerr){
  if(G.phase!=="reinforce") return {ok:false,msg:"You can only trade in cards when you reinforce."};
  if(!tradeOpen(G)) return {ok:false,msg:"You're down to 4 cards or fewer, so you must stop trading now."};
  var p=cur(G), cards=ids.map(function(id){ return p.cards.filter(function(c){ return c.id===id; })[0]; });
  if(cards.some(function(c){ return !c; })||cards.length!==3||(new Set(ids)).size!==3) return {ok:false,msg:"Pick three of your cards."};
  if(!validSet(cards)) return {ok:false,msg:"Those three cards aren't a set (three alike, one of each, or any two plus a wild card)."};
  var val=setValue(G,cards), bonus=0, msg=[];
  p.cards=p.cards.filter(function(c){ return ids.indexOf(c.id)<0; });
  cards.forEach(function(c){ G.discard.push(c); });
  G.setsTraded++; G.reserve+=val;
  var events=[];
  if(G.o.terrBonus!=="none"){
    var mine=cards.filter(function(c){ return c.t>=0&&G.terr[c.t].o===G.turn; });
    if(G.o.terrBonus==="perCard"){ mine.forEach(function(c){ G.terr[c.t].a+=2; bonus+=2; }); }
    else if(mine.length&&!(G.o.terrBonus==="cap2turn"&&G.terrBonusTurn)){ var bt=(bonusTerr!=null&&mine.some(function(c){ return c.t===bonusTerr; }))?bonusTerr:mine[0].t; G.terr[bt].a+=2; bonus=2; G.terrBonusTurn=true; }   // 1980/1993: "On a single turn, you may receive no more than 2 extra armies"
  }
  events.push(ev(G,"trade",{p:G.turn,val:val,bonus:bonus,text:pn(G,G.turn)+" trades in a set for "+val+" armies"+(bonus?" (+"+bonus+" bonus on owned territories)":"")}));
  if(p.cards.length<G.o.forcedTrade) G.tradedThisTurnForced=false;
  return {ok:true,events:events,value:val,bonus:bonus};
}
/* after taking an eliminated player's cards you trade only until your hand is down to 4 or fewer, then you must stop */
function tradeOpen(G){ return !(G.mustDown&&cur(G).cards.length<=4); }
function forcedNow(G){ var p=cur(G); if(G.mustDown) return p.cards.length>4; return p.cards.length>=G.o.forcedTrade; }
function place(G,t,n){
  if(G.phase!=="reinforce") return {ok:false,msg:"Not reinforcing."};
  n=n||1; if(n<1||n>G.reserve) return {ok:false,msg:"You only have "+G.reserve+" armies to place."};
  if(G.terr[t].o!==G.turn) return {ok:false,msg:"Place armies on your own territories."};
  if(forcedNow(G)&&findSets(cur(G).cards).length) return {ok:false,msg:"You hold "+cur(G).cards.length+" cards — trade in a set first."};
  if(G.o.capArmies&&G.terr[t].a+n>G.o.capArmies) n=Math.max(0,G.o.capArmies-G.terr[t].a);
  if(n<1){
    if(!hasRoom(G,G.turn)){ var lost=G.reserve; G.reserve=0; var ev0=[ev(G,"place",{p:G.turn,text:pn(G,G.turn)+" has no room left — "+lost+" armies are lost"})]; return {ok:true,events:ev0.concat(afterReserve(G))}; }
    return {ok:false,msg:"That territory is full ("+G.o.capArmies+" armies)."};
  }
  G.terr[t].a+=n; G.reserve-=n;
  var events=[ev(G,"place",{p:G.turn,t:t,n:n,text:pn(G,G.turn)+" places "+n+" "+(n===1?"army":"armies")+" on "+tname(t)})];
  if(G.reserve===0) events=events.concat(afterReserve(G));
  return {ok:true,events:events};
}
function hasRoom(G,p){ if(!G.o.capArmies) return true; for(var i=0;i<G.terr.length;i++) if(G.terr[i].o===p&&G.terr[i].a<G.o.capArmies) return true; return false; }
function endReinforce(G){
  if(G.phase!=="reinforce") return {ok:false,msg:"Not reinforcing."};
  if(G.reserve>0) return {ok:false,msg:"Place all your armies first ("+G.reserve+" left)."};
  if(forcedNow(G)&&findSets(cur(G).cards).length) return {ok:false,msg:"You must trade in a set first."};
  return {ok:true,events:afterReserve(G)};
}
function afterReserve(G){
  if(G.mustDown&&cur(G).cards.length>4) return [];
  G.mustDown=false;
  var rt=G.returnTo;
  if(rt==="attack"){ G.phase="attack"; if(!anyAttack(G,G.turn)) return endAttack(G).events||[]; }
  else if(rt==="fortify"){ return enterFortify(G); }
  return [];
}
function anyAttack(G,p){ var MP=map(); for(var i=0;i<G.terr.length;i++){ if(G.terr[i].o===p&&G.terr[i].a>1){ var ad=MP.adj[i]; for(var k=0;k<ad.length;k++) if(G.terr[ad[k]].o!==p) return true; } } return false; }
function targetsFrom(G,t){ var p=G.terr[t].o, r=[]; map().adj[t].forEach(function(u){ if(G.terr[u].o!==p) r.push(u); }); return r; }

/* ---------------- combat ---------------- */
function attack(G,from,to,dice){
  if(G.phase!=="attack") return {ok:false,msg:"You can't attack right now."};
  var p=G.turn, A=G.terr[from], D=G.terr[to];
  if(A.o!==p) return {ok:false,msg:"Attack from one of your own territories."};
  if(D.o===p||D.o<0) return {ok:false,msg:"Attack an enemy territory."};
  if(map().adj[from].indexOf(to)<0) return {ok:false,msg:tname(from)+" doesn't border "+tname(to)+"."};
  if(A.a<2) return {ok:false,msg:"You need at least 2 armies to attack."};
  dice=Math.max(1,Math.min(dice||3,3,A.a-1));
  var dd=Math.min(2,D.a), ar=[],dr=[],i;
  for(i=0;i<dice;i++) ar.push(rollDie(G)); for(i=0;i<dd;i++) dr.push(rollDie(G));
  var as=ar.slice().sort(function(a,b){ return b-a; }), ds=dr.slice().sort(function(a,b){ return b-a; });
  var al=0,dl=0; for(i=0;i<Math.min(as.length,ds.length);i++){ if(as[i]>ds[i]) dl++; else al++; }
  A.a-=al; D.a-=dl; G.shiftPair=null;
  var defOwner=D.o, events=[];
  events.push(ev(G,"attack",{p:p,from:from,to:to,ar:as,dr:ds,al:al,dl:dl,def:defOwner,text:pn(G,p)+" attacks "+tname(to)+" from "+tname(from)+" — "+pn(G,p)+" rolls "+as.join(",")+" vs "+ds.join(",")+": attacker loses "+al+", defender loses "+dl}));
  var res={ok:true,events:events,ar:as,dr:ds,al:al,dl:dl,conquered:false,eliminated:false};
  G.lastAttack={seq:++G.seq,p:p,from:from,to:to,def:defOwner,ar:as,dr:ds,al:al,dl:dl,conquered:false,fromA:A.a,toA:D.a};
  if(D.a<=0){
    D.o=p; D.a=0; res.conquered=true; G.conquered=true; G.lastAttack.conquered=true;
    var min=G.o.occupyMin1?1:dice; if(min>A.a-1) min=A.a-1; if(min<1) min=1;   // published rule: move in at least as many armies as dice rolled
    G.occ={from:from,to:to,min:min,max:A.a-1}; G.phase="occupy";
    events.push(ev(G,"conquer",{p:p,t:to,from:defOwner,text:pn(G,p)+" conquers "+tname(to)}));
    if(G.players[defOwner]&&owned(G,defOwner).length===0){
      res.eliminated=true; eliminate(G,defOwner,p,events);
    }
    if(G.o.mode==="capital"){ var hq=null; G.players.forEach(function(q){ if(q.hq===to&&q.id!==p) hq=q; }); if(hq){ G.players[p].hqTaken=(G.players[p].hqTaken||[]); if(G.players[p].hqTaken.indexOf(hq.id)<0) G.players[p].hqTaken.push(hq.id); events.push(ev(G,"hqtaken",{p:p,from:hq.id,text:pn(G,p)+" captures "+pn(G,hq.id)+"'s headquarters!"})); } }
    checkWin(G,events);
    if(G.occ&&(G.over||G.occ.min>=G.occ.max)){ var oc=G.occ, nn=G.over?oc.min:oc.max; G.phase="occupy"; var wasOver=G.over; occupy(G,nn,true); if(wasOver){ G.phase="over"; } res.autoOccupied=true; }
  }
  return res;
}
function eliminate(G,victim,by,events){
  var v=G.players[victim], b=G.players[by];
  v.alive=false;
  events.push(ev(G,"eliminate",{p:by,victim:victim,text:pn(G,by)+" eliminates "+pn(G,victim)+"!"}));
  // old UK Secret Mission: you must destroy your target yourself; if someone else does it, your mission becomes "occupy 24 territories"
  if(G.o.mode==="mission"&&G.o.missionRules==="uk") G.players.forEach(function(q){ if(q.id!==by&&q.mission&&q.mission.k==="kill"&&q.mission.c===victim) q.mission={k:"terr",n:24,min:1}; });
  if(v.neutral) return;
  if(G.o.cardOnElim){ var cs=v.cards; v.cards=[]; b.cards=b.cards.concat(cs); if(cs.length) events.push(ev(G,"cards",{p:by,text:pn(G,by)+" takes "+cs.length+" card"+(cs.length>1?"s":"")+" from "+pn(G,victim)})); }
  else { v.cards.forEach(function(c){ G.discard.push(c); }); v.cards=[]; }
  if(G.o.elimTradeDown&&b.cards.length>=6){ G.pendingTradeDown=true; }
}
function occupy(G,n,auto){
  if(G.phase!=="occupy") return {ok:false,msg:"Nothing to occupy."};
  var oc=G.occ, A=G.terr[oc.from], D=G.terr[oc.to];
  n=Math.max(oc.min,Math.min(n==null?oc.min:n,A.a-1));
  if(G.o.capArmies&&n>G.o.capArmies) n=G.o.capArmies;
  A.a-=n; D.a+=n; G.occ=null; G.phase="attack";
  G.shiftPair=G.o.occupyFree?{a:oc.from,b:oc.to,min:oc.min}:null;   // shifting back must leave at least the move-in minimum in the conquered territory
  var events=[ev(G,"occupy",{p:G.turn,from:oc.from,to:oc.to,n:n,text:pn(G,G.turn)+" moves "+n+" "+(n===1?"army":"armies")+" into "+tname(oc.to)})];
  if(G.pendingTradeDown){
    G.pendingTradeDown=false;
    if(findSets(cur(G).cards).length){ G.phase="reinforce"; G.reserve=0; G.returnTo="attack"; G.mustDown=true; events.push(ev(G,"cards",{p:G.turn,text:pn(G,G.turn)+" holds "+cur(G).cards.length+" cards and must trade in sets down to 4 or fewer"})); }
  }
  if(G.phase==="attack"&&!anyAttack(G,G.turn)) events=events.concat(endAttack(G).events||[]);
  return {ok:true,events:events};
}
function shift(G,from,to,n){
  if(G.phase!=="attack"||!G.shiftPair) return {ok:false,msg:"You can only shift armies between the two territories right after a conquest."};
  var sp=G.shiftPair; if(!((from===sp.a&&to===sp.b)||(from===sp.b&&to===sp.a))) return {ok:false,msg:"Shift armies between the two territories you just fought over."};
  var A=G.terr[from], B=G.terr[to]; if(A.o!==G.turn||B.o!==G.turn) return {ok:false,msg:"Both territories must be yours."};
  var keep=(from===sp.b&&sp.min>1)?sp.min:1;   // saves from before the minimum was kept have no min: 1
  if(A.a-keep<1) return {ok:false,msg:keep>1?"At least "+keep+" armies must stay in "+tname(from)+" (one for each die you rolled).":"Leave at least one army behind."};
  n=Math.max(1,Math.min(n||1,A.a-keep));
  if(G.o.capArmies&&B.a+n>G.o.capArmies) n=Math.max(0,G.o.capArmies-B.a); if(n<1) return {ok:false,msg:"That territory is full."};
  A.a-=n; B.a+=n;
  return {ok:true,events:[ev(G,"shift",{p:G.turn,from:from,to:to,n:n,text:pn(G,G.turn)+" shifts "+n+" "+(n===1?"army":"armies")+" from "+tname(from)+" to "+tname(to)})]};
}
function endAttack(G){
  if(G.phase!=="attack") return {ok:false,msg:"You aren't attacking."};
  return {ok:true,events:enterFortify(G)};
}
function enterFortify(G){
  G.phase="fortify"; G.shiftPair=null; G.fortLeft=G.o.fortify==="steps7"?7:1;
  if(!canFortifyAny(G)){ return finishTurnEvents(G); }
  return [];
}
function reachable(G,from){
  var p=G.terr[from].o, seen={}, q=[from]; seen[from]=1;
  while(q.length){ var t=q.shift(); map().adj[t].forEach(function(u){ if(!seen[u]&&G.terr[u].o===p){ seen[u]=1; q.push(u); } }); }
  return seen;
}
function fortifyTargets(G,from){
  if(G.terr[from].o!==G.turn||G.terr[from].a<2) return [];
  if(G.o.fortify==="connected"){ var r=reachable(G,from); return Object.keys(r).map(Number).filter(function(t){ return t!==from; }); }
  return map().adj[from].filter(function(u){ return G.terr[u].o===G.turn; });
}
function canFortifyAny(G){ for(var i=0;i<G.terr.length;i++){ if(G.terr[i].o===G.turn&&G.terr[i].a>1&&fortifyTargets(G,i).length) return true; } return false; }
function fortify(G,from,to,n){
  if(G.phase!=="fortify") return {ok:false,msg:"Not in the free-move phase."};
  if(G.fortLeft<=0) return {ok:false,msg:"You've already made your free move."};
  if(fortifyTargets(G,from).indexOf(to)<0) return {ok:false,msg:"You can't move from "+tname(from)+" to "+tname(to)+"."};
  var max=G.terr[from].a-1; if(G.o.fortify==="steps7") max=Math.min(max,G.fortLeft);
  n=Math.max(1,Math.min(n||1,max));
  if(G.o.capArmies&&G.terr[to].a+n>G.o.capArmies) n=Math.max(0,G.o.capArmies-G.terr[to].a);
  if(n<1) return {ok:false,msg:"That territory is full."};
  G.terr[from].a-=n; G.terr[to].a+=n;
  G.fortLeft=G.o.fortify==="steps7"?G.fortLeft-n:0;
  var events=[ev(G,"fortify",{p:G.turn,from:from,to:to,n:n,text:pn(G,G.turn)+" moves "+n+" "+(n===1?"army":"armies")+" from "+tname(from)+" to "+tname(to)})];
  if(G.fortLeft<=0||!canFortifyAny(G)) events=events.concat(finishTurnEvents(G));
  return {ok:true,events:events};
}
function endTurn(G){
  if(G.phase!=="fortify"&&G.phase!=="attack") return {ok:false,msg:"You can't end your turn yet."};
  return {ok:true,events:finishTurnEvents(G)};
}
function drawCard(G){
  if(!G.deck.length){ if(!G.discard.length) return null; G.deck=shuffle(G.discard.splice(0),G.rnd); }
  return G.deck.pop();
}
function finishTurnEvents(G){
  var events=[], p=G.turn;
  if(G.conquered){ var c=drawCard(G); if(c){ cur(G).cards.push(c); events.push(ev(G,"draw",{p:p,text:pn(G,p)+" draws a territory card"})); } }
  checkWin(G,events);
  if(G.over) return events;
  // next player
  var n=G.players.length, i=G.turn;
  for(var k=0;k<n;k++){ i=(i+1)%n; if(G.players[i].alive&&!G.players[i].neutral) break; }
  G.turn=i; G.mustDown=false;
  beginTurn(G);
  return events;
}

/* ---------------- win ---------------- */
function checkWin(G,events){
  if(G.over) return;
  var live=realPlayers(G).filter(function(p){ return p.alive; });
  var win=null;
  if(G.o.mode==="classic"||G.o.mode==="mission"||G.o.mode==="capital"){
    if(live.length===1) win=live[0].id;
  }
  if(win==null&&G.o.mode==="mission"){
    var order=[G.turn].concat(realPlayers(G).map(function(p){ return p.id; }));
    for(var i=0;i<order.length&&win==null;i++) if(G.players[order[i]].alive&&missionDone(G,order[i])) win=order[i];
  }
  if(win==null&&G.o.mode==="capital"){
    var np=realPlayers(G).length, need=np<=3?np-1:(np===4?2:3);
    live.forEach(function(p){ if(win!=null) return; if(G.terr[p.hq].o!==p.id) return; var t=(p.hqTaken||[]).filter(function(v){ return G.terr[G.players[v].hq].o===p.id; }).length; if(t>=Math.min(need,np-1)) win=p.id; });
  }
  if(win!=null){ G.over=true; G.winner=win; G.phase="over"; events.push(ev(G,"win",{p:win,text:pn(G,win)+" wins the game!"})); }
}

/* ======================= computer player ======================= */
/* Chance that a attackers beat d defenders in an all-out attack (the attacker always rolls the most dice it can).
   Up to WP_EXACT armies a side it is exact: one table filled once, row by row, from the single-roll odds below (under a
   millisecond), then every call is a lookup. Bigger stacks use a normal approximation of the 3-vs-2 dice race (off by
   well under 1%), so no call ever blocks the page, the CPU or a Fire TV Stick. */
var ROLL=[null,   // ROLL[attacker dice][defender dice] = [[attacker loses, defender loses, probability], ...]
  [null,[[1,0,21/36],[0,1,15/36]],[[1,0,161/216],[0,1,55/216]]],
  [null,[[1,0,91/216],[0,1,125/216]],[[2,0,581/1296],[1,1,420/1296],[0,2,295/1296]]],
  [null,[[1,0,441/1296],[0,1,855/1296]],[[2,0,2275/7776],[1,1,2611/7776],[0,2,2890/7776]]]];
var WP_EXACT=200, WP_N=0, WP=null;
var WP_MU=7161/7776, WP_SD=Math.sqrt(11711/7776-WP_MU*WP_MU), WP_C=1.8;   // 3-vs-2 roll: mean and spread of the attacker's loss; C = end-game offset
function wpFill(n){
  var W=n+1, P=new Float64Array(W*W), a, d, o, r, i;
  for(a=0;a<=n;a++) for(d=0;d<=n;d++){
    if(d===0){ P[a*W]=1; continue; }
    if(a<=1) continue;
    o=ROLL[Math.min(3,a-1)][Math.min(2,d)]; r=0;
    for(i=0;i<o.length;i++) r+=o[i][2]*P[(a-o[i][0])*W+d-o[i][1]];
    P[a*W+d]=r;
  }
  WP=P; WP_N=n;
}
function normCdf(z){ var t=1/(1+0.2316419*Math.abs(z)), y=t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429)))), p=1-Math.exp(-z*z/2)*0.3989422804014327*y; return z<0?1-p:p; }
function winProb(a,d){
  a=Math.floor(a); d=Math.floor(d);
  if(d<=0) return 1; if(a<=1) return 0;
  if(a<=WP_EXACT&&d<=WP_EXACT){
    if(a>WP_N||d>WP_N){ var n=64; while(n<a||n<d) n*=2; wpFill(Math.min(n,WP_EXACT)); }
    return WP[a*(WP_N+1)+d];
  }
  var k=(a+d-2)/2;   // rolls until a-1 attackers + d defenders are gone, two armies per roll
  return normCdf((a-WP_C-WP_MU*k)/(WP_SD*Math.sqrt(k)));
}
function contOf(t){ return map().cont[t]; }
function enemyAdj(G,t){ var p=G.terr[t].o, s=0; map().adj[t].forEach(function(u){ if(G.terr[u].o!==p&&G.terr[u].o>=0) s+=G.terr[u].a; }); return s; }
function borderTerrs(G,p){ return owned(G,p).filter(function(t){ return map().adj[t].some(function(u){ return G.terr[u].o!==p; }); }); }
function contProgress(G,p,ci){ var c=map().continents[ci], own=0; c.terrs.forEach(function(t){ if(G.terr[t].o===p) own++; }); return own/c.terrs.length; }
function terrValue(G,p,t){
  var ci=contOf(t), c=map().continents[ci], own=0, enemy=0;
  c.terrs.forEach(function(u){ if(G.terr[u].o===p) own++; else enemy++; });
  var v=c.bonus/c.terrs.length*2 + (own/c.terrs.length)*4;
  if(enemy===1&&G.terr[t].o!==p) v+=6+c.bonus;           // completes a continent
  // does the target sit in a continent an enemy is about to own?
  var owners={}; c.terrs.forEach(function(u){ var o=G.terr[u].o; owners[o]=(owners[o]||0)+1; });
  Object.keys(owners).forEach(function(o){ if(+o!==p&&owners[o]>=c.terrs.length-1&&G.terr[t].o===+o) v+=c.bonus*0.8; });
  return v;
}
function aiClaim(G){
  var p=G.turn, best=-1e9,bt=-1;
  for(var t=0;t<G.terr.length;t++){ if(G.terr[t].o!==-1) continue;
    var ci=contOf(t), c=map().continents[ci], own=0, other=0;
    c.terrs.forEach(function(u){ if(G.terr[u].o===p) own++; else if(G.terr[u].o>=0) other++; });
    var adjOwn=map().adj[t].filter(function(u){ return G.terr[u].o===p; }).length;
    var sc=own*3+adjOwn*2-other*1.5+c.bonus/c.terrs.length*3-map().adj[t].length*0.2+G.rnd()*1.5;
    if(c.terrs.length<=4) sc+=1.5;
    if(sc>best){ best=sc; bt=t; } }
  return {t:"claim",terr:bt};
}
function bsr(G,t){ var a=G.terr[t].a; return enemyAdj(G,t)/Math.max(1,a); }
function aiPlaceTarget(G,p){
  var mine=owned(G,p), best=null,bs=-1e9;
  // prefer a continent we're closest to finishing, then high border-security ratio
  if(G.o.capArmies) mine=mine.filter(function(t){ return G.terr[t].a<G.o.capArmies; });
  mine.forEach(function(t){
    var e=enemyAdj(G,t); if(e===0) return;
    var sc=bsr(G,t)*3 + terrValueAdj(G,p,t) + G.rnd()*0.5;
    if(sc>bs){ bs=sc; best=t; }
  });
  if(best==null){ mine.forEach(function(t){ var sc=G.terr[t].a*-1+G.rnd(); if(best==null||sc>bs){ bs=sc; best=t; } }); }
  return best;
}
function terrValueAdj(G,p,t){ var v=0; map().adj[t].forEach(function(u){ if(G.terr[u].o!==p) v+=terrValue(G,p,u); }); return v/Math.max(1,map().adj[t].length)*0.6+contProgress(G,p,contOf(t))*3; }
function aiDeploy(G){ return {t:"deployOne",terr:aiPlaceTarget(G,G.turn)||owned(G,G.turn)[0]}; }
function aiTrade(G){
  var p=cur(G), sets=findSets(p.cards); if(!sets.length||!tradeOpen(G)) return null;
  // prefer sets without wilds, and sets that use cards of owned territories
  sets.sort(function(a,b){ var sa=score(a),sb=score(b); return sb-sa; });
  function score(s){ var sc=0; s.forEach(function(c){ if(c.sym==="W") sc-=3; else if(G.terr[c.t].o===G.turn) sc+=1; }); return sc; }
  var must=forcedNow(G);
  if(!must){
    // trade when the value is useful: always trade when we hold 4+ cards, or when it enables something
    if(p.cards.length<4&&G.setsTraded<2&&!G.pendingTradeDown) { /* keep early cards a bit */ }
  }
  var s=sets[0], mine=s.filter(function(c){ return c.t>=0&&G.terr[c.t].o===G.turn; });
  return {t:"trade",ids:s.map(function(c){ return c.id; }),bonusTerr:mine.length?mine[0].t:null};
}
function aiAttackPlan(G){
  var p=G.turn, best=null, bs=0;
  var mineAll=owned(G,p), total=mineAll.length;
  for(var i=0;i<mineAll.length;i++){ var f=mineAll[i], A=G.terr[f].a; if(A<2) continue;
    var tg=targetsFrom(G,f);
    for(var k=0;k<tg.length;k++){
      var t=tg[k], D=G.terr[t].a, d=G.terr[t].o;
      if(d<0) continue;
      var pw=winProb(A,D);
      var thr=0.58; if(D===1) thr=0.5;
      var val=terrValue(G,p,t)+ (D===1?1.5:0) + (G.players[d]&&owned(G,d).length<=3?3:0) + (G.players[d]&&G.players[d].cards.length>=3?1.5:0);
      if(!G.conquered) val+=2.5;
      if(pw<thr&&!(val>8&&pw>0.45)) continue;
      // don't strip a border stack to nothing when enemies loom
      var leaves=A-1; var risk=enemyAdj(G,f)-G.terr[t].a;
      var sc=pw*8+val+(A-D)*0.25-(risk>A?2:0);
      if(sc>bs){ bs=sc; best={t:"attack",from:f,to:t,dice:Math.min(3,A-1),pw:pw}; }
    }
  }
  return best;
}
function aiAction(G){
  if(G.over) return null;
  var p=G.turn, pl=G.players[p];
  switch(G.phase){
    case "claim": return aiClaim(G);
    case "deploy": return aiDeploy(G);
    case "setup2p": {
      var mine=owned(G,p), t1=aiPlaceTarget(G,p)||mine[0], t2=aiPlaceTarget(G,p)||mine[0];
      var nb=owned(G,2), nt=nb.length?nb[Math.floor(G.rnd()*nb.length)]:null;
      // neutral armies go where they hurt the rival most: next to the rival's weakest border
      var best=null,bs=-1; nb.forEach(function(t){ var s=0; map().adj[t].forEach(function(u){ if(G.terr[u].o===p) s+=2; }); s+=G.rnd(); if(s>bs){ bs=s; best=t; } });
      return {t:"setup2p",mine:G.initLeft[p]>=2?[t1,t2]:[t1],neutral:G.initLeft[2]>0?best:null};
    }
    case "hq": { var b=owned(G,p).map(function(t){ return {t:t,s:-bsr(G,t)+map().adj[t].length*-0.1+contProgress(G,p,contOf(t))+G.rnd()}; }).sort(function(a,b2){ return b2.s-a.s; })[0]; return {t:"hq",terr:b.t}; }
    case "choose": {
      // reinforcing is worth it only with a decent stack of armies
      var plan=aiAttackPlan(G);
      return {t:"mode",m:(plan&&plan.pw>=0.6)?"attack":"reinforce"};
    }
    case "reinforce": {
      var tr=aiTrade(G);
      if(tr&&(forcedNow(G)||cur(G).cards.length>=3||G.setsTraded>=3||G.pendingTradeDown||G.mustDown)) return tr;
      if(G.reserve<=0){ return {t:"endReinforce"}; }
      var tt=aiPlaceTarget(G,p); if(tt==null) tt=owned(G,p)[0];
      var n=G.reserve>=6?Math.max(2,Math.floor(G.reserve/2)):G.reserve;
      return {t:"place",terr:tt,n:n};
    }
    case "attack": {
      if(G.noAttack) return {t:"endAttack"};
      var pl2=aiAttackPlan(G); if(pl2) return pl2;
      return {t:"endAttack"};
    }
    case "occupy": {
      var oc=G.occ, A=G.terr[oc.from], D=G.terr[oc.to];
      var enemyHere=enemyAdj(G,oc.to), enemyThere=enemyAdj(G,oc.from);
      var avail=A.a-1, n;
      if(enemyHere>=enemyThere) n=avail; else if(enemyThere===0) n=avail; else n=Math.max(oc.min,Math.ceil(avail*enemyHere/Math.max(1,enemyHere+enemyThere)));
      return {t:"occupy",n:Math.max(oc.min,Math.min(avail,n))};
    }
    case "fortify": {
      var mv=aiFortifyPlan(G); if(mv) return mv; return {t:"endTurn"};
    }
  }
  return null;
}
function aiFortifyPlan(G){
  var p=G.turn, best=null, bs=0;
  for(var f=0;f<G.terr.length;f++){
    if(G.terr[f].o!==p||G.terr[f].a<2) continue;
    if(enemyAdj(G,f)>0&&G.o.fortify!=="connected") { /* interior preference but allow */ }
    var tg=fortifyTargets(G,f);
    tg.forEach(function(t){
      var gain=enemyAdj(G,t)*1.0-enemyAdj(G,f)*0.9;
      if(enemyAdj(G,t)===0) return;
      if(gain>bs){ bs=gain; var n=enemyAdj(G,f)===0?G.terr[f].a-1:Math.max(1,Math.floor((G.terr[f].a-1)/2)); best={t:"fortify",from:f,to:t,n:n}; }
    });
  }
  if(best&&bs>1) return best;
  return null;
}
function applyAction(G,a){
  switch(a.t){
    case "claim": return claimTerr(G,a.terr);
    case "deployOne": return deployOne(G,a.terr);
    case "setup2p": return setup2p(G,a.mine,a.neutral);
    case "hq": return pickHq(G,a.terr);
    case "mode": return chooseMode(G,a.m);
    case "trade": return tradeCards(G,a.ids,a.bonusTerr);
    case "place": return place(G,a.terr,a.n);
    case "attack": return attack(G,a.from,a.to,a.dice);
    case "occupy": return occupy(G,a.n);
    case "endAttack": return endAttack(G);
    case "fortify": return fortify(G,a.from,a.to,a.n);
    case "endTurn": return endTurn(G);
    case "shift": return shift(G,a.from,a.to,a.n);
    case "endReinforce": return endReinforce(G);
    case "autoSetup": autoFinishSetup(G); return {ok:true,events:[]};
    case "noop": return {ok:true,events:[]};
  }
  return {ok:false,msg:"Unknown action."};
}
/* finish all remaining starting placement automatically (random-setup option) */
function autoFinishSetup(G){
  var guard=0;
  while((G.phase==="claim"||G.phase==="deploy"||G.phase==="setup2p")&&guard++<2000){ var a=aiAction(G); if(!a||!applyAction(G,a).ok) break; }
}
/* public + (optionally) private state for one viewer; works on phones (JSON-safe) */
function nextSetValue(G){ if(G.o.cardValues==="fixed") return null; return setValue(G,[{sym:"I"},{sym:"I"},{sym:"I"}]); }
function snapshot(G,me){
  var MPm=map(), pl=G.players.map(function(p){
    var st=playerStats(G,p.id);
    return {id:p.id,name:p.name,human:p.human,ci:p.ci,alive:p.alive,neutral:p.neutral,cards:p.cards.length,terrs:st.terrs,armies:st.armies,hq:(G.phase!=="hq"&&G.phase!=="setup"&&p.hq!=null)?p.hq:null,hqTaken:p.hqTaken||[]};
  });
  var mp=me>=0&&G.players[me]?G.players[me]:null;
  var cur0=G.players[G.turn];
  return {o:G.o,n:G.n,two:G.two,phase:G.phase,turn:G.turn,me:me,players:pl,terr:G.terr.map(function(t){ return {o:t.o,a:t.a}; }),
    reserve:G.reserve,occ:G.occ,shiftPair:G.shiftPair||null,fortLeft:G.fortLeft,setsTraded:G.setsTraded,nextSet:nextSetValue(G),conquered:G.conquered,noAttack:G.noAttack,mustDown:!!G.mustDown,bonusUsed:!!G.terrBonusTurn,
    initLeft:G.initLeft,returnTo:G.returnTo,deck:G.deck.length,
    myCards:mp?mp.cards.map(function(c){ return {id:c.id,t:c.t,sym:c.sym}; }):[],mission:(mp&&mp.mission)?G.o.mode==="mission"&&missionText(G,mp.mission):null,myHq:mp?mp.hq:null,
    cards:me===G.turn?null:undefined,lastAttack:G.lastAttack||null,over:G.over,winner:G.winner,round:G.round||0,
    log:G.log.slice(-6).map(function(e){ return e.text; }).filter(Boolean)};
}
function playerStats(G,p){ var t=owned(G,p), a=0; t.forEach(function(i){ a+=G.terr[i].a; }); return {terrs:t.length,armies:a,cards:G.players[p].cards.length}; }

Risk.Engine={snapshot:snapshot,nextSetValue:nextSetValue,VERSIONS:VERSIONS,GAMEMODES:GAMEMODES,HOUSE:HOUSE,HOUSE_OFFICIAL:HOUSE_OFFICIAL,defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOpts:versionOpts,
  newGame:newGame,cur:cur,owned:owned,realPlayers:realPlayers,claimTerr:claimTerr,deployOne:deployOne,setup2p:setup2p,pickHq:pickHq,chooseMode:chooseMode,
  tradeCards:tradeCards,place:place,attack:attack,occupy:occupy,endAttack:endAttack,fortify:fortify,endTurn:endTurn,applyAction:applyAction,aiAction:aiAction,
  findSets:findSets,validSet:validSet,setValue:setValue,forcedNow:forcedNow,fortifyTargets:fortifyTargets,targetsFrom:targetsFrom,anyAttack:anyAttack,canFortifyAny:canFortifyAny,
  terrArmies:terrArmies,contBonus:contBonus,missionText:missionText,missionDone:missionDone,winProb:winProb,autoFinishSetup:autoFinishSetup,playerStats:playerStats,
  endReinforce:endReinforce,hasRoom:hasRoom,startArmiesOf:startArmiesOf,startArmiesFor:startArmiesFor,enemyAdj:enemyAdj,shuffle:shuffle};
if(typeof module!=="undefined"&&module.exports) module.exports=Risk.Engine;
})(typeof window!=="undefined"?window:globalThis);
