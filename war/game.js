/* WAR — the page controller (setup, the table, the pacing of every flip, sheets, saves, the Menu, TV, the Victory screen).
   The rules live in engine.js (pure, no DOM) and the computers' choices in brain.js; this file only drives and shows them.
   - Simultaneous play (Bicycle, Pagat): nobody goes first. Each player pushes their top card face down into the battle, then every card
     turns at once. The opening show is the deal, one card at a time round the table (engine firstPlayer(): rule "none", show "deal").
   - Every computer move is paced by Game speed (speedFactor); the person's Flip, a hand card or a prisoner is queued at once and played the
     moment the table is free, so a tap is never lost. Auto-play flips for the people too.
   - A war: the "I declare war" banner and a red-gold flash, the face-down cards slide out one by one, a drum-roll pause, then the deciding
     flip in slow motion with a zoom; the pot flies to the winner card by card and the count ticks up. Moves are one-shot Web Animations on
     transform only (the flip is one rotateY of a face/back pair); reduced motion places them at once and keeps the pace.
   - The engine's events (apply().ev) are played in order; after each batch the table is drawn again from G, so a reload or a Continue shows
     exactly the same table. Saves after every action (Saves.auto "war"). */
(function(){
"use strict";
var W=window.War, E=W.Engine, C=W.Cards;
var $=function(id){ return document.getElementById(id); };
var GAME="war";
/* Game speed (SPEED-TASK.md): every computer delay and every move animation x speedFactor(); animations never under 120 ms. The time limit
   is a rule clock and is never scaled. */
function speedFactor(){ return ({slow:1.75, fast:0.5})[window.bgGameSpeed] || 1 }
function sp(ms){ return Math.max(120,Math.round(ms*speedFactor())); }
function dl(ms){ return Math.round(ms*speedFactor()); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,Math.max(0,ms)); }); }
function normSpeed(v){ return v==="slow"||v==="fast"?v:"medium"; }
function normSkill(v){ return v==="easy"||v==="hard"?v:"normal"; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function BG(){ return window.BGUI||null; }
function luxe(){ var B=BG(); return !!(B&&B.sheet&&B.effects&&document.documentElement.classList.contains("wr-luxe")); }
function onTV(){ return document.documentElement.hasAttribute("data-tv"); }
function icon(n){ var B=BG(); return B&&B.icon?B.icon(n):""; }
function reduced(){ var B=BG(); return document.documentElement.getAttribute("data-motion")==="reduce"||!!(B&&B.reducedMotion&&B.reducedMotion()); }
function remPx(){ return parseFloat(getComputedStyle(document.documentElement).fontSize)||16; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function initials(name){ var m=/^(You|Player|CPU)\s*(\d*)$/.exec(String(name)); return m?(m[1]==="You"?"Y":m[1].charAt(0)+m[2]):String(name).charAt(0).toUpperCase(); }
function listNames(a){ return a.length<=2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }
function plural(n,w){ return n+" "+w+(n===1?"":"s"); }
function nb(t){ return String(t).replace(/ /g,"\u00a0"); }   // no-break spaces: a label breaks only at the natural separator left as a plain space
function ord(n){ var t=n%100; return n+((t>=11&&t<=13)?"th":(["th","st","nd","rd"][n%10]||"th")); }
function warWord(n){ return E.warWord?E.warWord(n):n>1?(n===2?"Double war!":n===3?"Triple war!":"War again!"):"I declare war!"; }
/* 2-16 players: every seat has its own colour (data-seat 1..16; 11-16 are War's own, in index.html). From 5 players the table is the
   "big table": a grid of compact seat tiles (colour, name, count, the flipped card) around a centre band with the pot */
var BIG=5;
function seatNo(s){ return s+1; }
function tr(k){ var t=window.__warTrace; if(t&&t.push&&t.length<4000) t.push([k,Math.round(performance.now())]); }   // tests: timing marks
function big(){ return !!(G&&G.n>=BIG); }
/* names in a line of text: up to 3 names, else a count ("5 players"), so a 16-player war never floods the banner or the status line */
function whoList(seats,word){ return seats.length<=3?listNames(seats.map(nm)):seats.length+" "+(word||"players"); }

/* ================= registration: the new-game hooks (commit ae99bbe) ================= */
var GLYPHS={
  swords:'<path d="M4.5 4.5L15 15M13 17l4-4M15 15l3.2 3.2M19.5 4.5L9 15M11 17l-4-4M9 15l-3.2 3.2"/><circle cx="19.2" cy="19.2" r="1" fill="currentColor"/><circle cx="4.8" cy="19.2" r="1" fill="currentColor"/>',
  shield:'<path d="M12 3.5l7 2.5v5.5c0 4.3-3 7.6-7 9-4-1.4-7-4.7-7-9V6z"/><path d="M12 7.5v9M8.5 11h7"/>',
  spade:'<path d="M12 4c2.5 3 7 5.8 7 9.3a3.4 3.4 0 0 1-5.8 2.4c.2 1.8.8 3 1.8 4.3H9c1-1.3 1.6-2.5 1.8-4.3A3.4 3.4 0 0 1 5 13.3C5 9.8 9.5 7 12 4z"/>'
};
var registered=false;
function register(){
  var B=BG(); if(!B||registered) return; registered=true;
  if(B.icon&&B.icon.add){ Object.keys(GLYPHS).forEach(function(k){ B.icon.add(k,GLYPHS[k]); }); if(B.icon.seal&&B.icon.seal.set) B.icon.seal.set(GAME,"swords"); }
  if(B.stage&&B.stage.register) B.stage.register(GAME,{motifs:["swords","spade","shield","cards"]});
}
/* the music: a marching minor style with its own 10 original song titles (Sound.addStyle, sound.js) */
if(window.Sound&&Sound.addStyle&&!(Sound.hasStyle&&Sound.hasStyle(GAME))){
  Sound.addStyle(GAME,{ scales:["minor","dorian","minor"], bpm:[100,128], swing:0, sev:false, leadVol:0.08, waves:["square","triangle","sawtooth"], bassKind:"pulse",
    progs:[[0,5,6,4],[0,3,4,0],[0,6,5,4],[0,4,5,3],[0,2,6,4],[0,5,3,4],[0,6,3,4],[0,3,6,4]],
    bridge:[[5,6,4,4],[3,4,0,0],[2,3,4,4],[6,5,4,0]],
    rhythms:[[1,0,1,1,1,0,1,1],[1,1,0,1,1,0,1,0],[1,0,0,1,1,0,1,1],[1,0,1,0,1,1,0,1]],
    chordSteps:[0,3,6],
    drums:[{kick:[1,0,0,0,1,0,0,0],snare:[0,0,1,0,0,1,1,1],sv:0.09,hat:[1,0,1,0,1,0,1,0],hv:0.04},{kick:[1,0,0,1,1,0,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.08,hat:[1,1,1,1,1,1,1,1],hv:0.03},{kick:[1,0,1,0,1,0,1,0],snare:[0,1,0,1,0,1,1,1],sv:0.07,hat:[0,1,0,1,0,1,0,1],hv:0.04}],
    titles:["I Declare War","Three Cards Down","The Deciding Flip","Aces in Reserve","Double War March","Peace Treaty Waltz","Battle of the Kings","Sweep the Table","Fifty-Two Strong","Drum Roll, Please"] },
    {wave:"square",reg:-1});
}

/* ================= state ================= */
var cfg={version:E.DEFAULT_VERSION||"three",cv:E.SETUP_V||2,over:{},humans:1,cpus:1,speed:"medium",skill:"normal",auto:false,length:"end",limit:0,shortTie:"sudden"};
var G=null, gen=0, timer=null, busy=false, intent=[], hurry=false, viewer=-1;
var ui={dealing:false,dealSkip:false,winShown:-1,result:false,rulesOpen:false,finished:-1,claimPr:undefined,claimKey:"",hoKey:"",needSync:false,lastTurn:-1,handKey:""};
var stats={ms:0}, clock0=0;
var seatEls=[], standEls=[], disp=[], GEO=null, tab={}, extra=[], carryEls=[], kittyEls=[];
var SHORT={classic:"Classic",three:"Three-card",peace:"Peace",hand:"Hand War",razboi:"Război",tod:"Tod und Leben",drunkard:"Drunkard"};
var LEN_SHORT={end:"To the end",time:"Time limit",battles:"Battle limit",onepass:"One pass"};

function nPlayers(){ return cfg.humans+cfg.cpus; }
function rawOpts(){ var x={}; for(var k in cfg.over) x[k]=cfg.over[k]; x.length=cfg.length; x.limit=cfg.limit; x.shortTie=cfg.shortTie; return E.versionOpts(cfg.version,x); }
function curOpts(){ return E.normalize(rawOpts(),nPlayers()); }
function versionOf(id){ return E.VERSIONS.filter(function(v){ return v.id===id; })[0]||E.VERSIONS[0]; }
function locked(key){ var v=versionOf(cfg.version); return (v.lock||[]).indexOf(key)>=0; }
function isHuman(s){ return !!(G&&G.players[s]&&G.players[s].human); }
function nHumans(){ return G?G.players.filter(function(p){ return p.human; }).length:0; }
function liveGame(){ return !!(G&&!G.over); }
function setupShown(){ return $("setup").style.display!=="none"; }
function paused(){ return liveGame()&&setupShown(); }
function deckN(){ return G?E.buildDeck(G.o).length:52; }
function nm(s){ return G.players[s].name; }

/* the play clock (the Victory's time, and the rule clock of a time limit): it runs while the table is on screen */
function clockOn(){ clock0=(liveGame()&&!document.hidden&&!setupShown()&&!ui.dealing)?Date.now():0; }
function clockOff(){ if(clock0){ stats.ms+=Math.max(0,Date.now()-clock0); clock0=0; } }
function playMs(){ return stats.ms+(clock0?Math.max(0,Date.now()-clock0):0); }
function fmtTime(ms){ var s=Math.max(0,Math.round(ms/1000)), h=Math.floor(s/3600), m=Math.floor(s/60)%60, x=s%60; return (h?h+":"+String(m).padStart(2,"0"):String(m))+":"+String(x).padStart(2,"0"); }

function toast(m,o){
  var t=$("toast"); t.textContent=m; var B=BG();
  if(luxe()&&B.toast){ B.toast(m,Object.assign({icon:"info",ms:2600},o||{})); return; }
  t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove("show"); },2200);
}
function focusIn(el){ var B=BG(); if(!el) return; if(B&&B.focus&&B.focus.enabled) B.focus.set(el); else { try{ el.focus({preventScroll:true}); }catch(e){ el.focus(); } } }
function focusTV(el){ var B=BG(); if(el&&B&&B.focus&&B.focus.enabled&&onTV()) setTimeout(function(){ if(el.isConnected&&!el.hidden&&el.getClientRects().length&&!el.disabled) B.focus.set(el); },0); }
function armBack(){ var B=BG(); if(B&&B.back&&B.back.arm) B.back.arm(); }
function hubHref(){ var B=BG(); return B&&B.back&&B.back.hub?B.back.hub():"../index.html"; }

/* ================= names ================= */
var nameUI=null;
function humanNames(n){ var B=BG(); if(!n) return []; return nameUI&&B&&B.names?B.names.list(n,nameUI.values()):null; }
function mountNames(){ var B=BG(); if(!B||!B.names||nameUI) return; nameUI=B.names.mount("#nameCard",{count:Math.max(1,cfg.humans),seat:function(i){ return seatNo(i); },onChange:function(){ drawSeats(); }}); }
function cpuNames(n,human){ var a=[]; try{ if(window.Names&&n>0) a=window.Names.pick(n,(human||[]).concat(["You"]))||[]; }catch(e){} while(a.length<n) a.push("CPU "+(a.length+1)); return a; }
function seatNames(){
  var hn=humanNames(cfg.humans), out=[], i;
  for(i=0;i<cfg.humans;i++) out.push(hn?hn[i]:cfg.humans===1?"You":"Player "+(i+1));
  for(i=0;i<cfg.cpus;i++) out.push("Computer "+(i+1));
  return out;
}

/* ================= setup page (also the in-game Menu) ================= */
function keepFocus(box,attr,fn){
  var a=document.activeElement, k=(a&&a!==document.body&&box.contains(a))?a.getAttribute(attr):null;
  fn();
  if(k===null) return;
  focusIn(box.querySelector("["+attr+'="'+k+'"]:not([disabled])')||box.querySelector("button.on:not([disabled])")||box.querySelector("button:not([disabled]), select, input"));
}
function segHTML(items,cur,attr){ return items.map(function(it){ var on=String(it[0])===String(cur); return '<button type="button" '+attr+'="'+esc(it[0])+'" class="'+(on?"on":"")+'" aria-pressed="'+on+'"'+(it[2]?" disabled":"")+'>'+esc(it[1])+'</button>'; }).join(""); }
function drawVersions(){
  var vs=$("versions");
  if(!vs.querySelector(".bg-version")){
    vs.innerHTML=E.VERSIONS.map(function(v){ return '<button type="button" class="bg-version" role="radio" data-value="'+v.id+'" data-v="'+v.id+'" aria-checked="false"><span class="bg-version__title">'+esc(v.name)+'</span><span class="bg-version__meta">'+esc(v.tag)+'</span></button>'; }).join("");
    vs.querySelectorAll(".bg-version").forEach(function(d){ d.addEventListener("click",function(){ if(cfg.version!==d.dataset.v){ cfg.version=d.dataset.v; cfg.over={}; } drawSetup(); }); });
    /* Motocross War (its own game, mxwar/): the last entry of the list opens it (a link, not a Version of this table) */
    var mxl=document.createElement("a"); mxl.className="bg-version"; mxl.id="mxwarLink"; mxl.href="../mxwar/index.html"+(document.documentElement.hasAttribute("data-tv")?"?tv=1":"");
    mxl.innerHTML='<span class="bg-version__title">Motocross War</span><span class="bg-version__meta">Race a real Supercross or Motocross season</span>'; vs.appendChild(mxl);
  }
  vs.querySelectorAll(".bg-version[data-v]").forEach(function(d){ var on=cfg.version===d.dataset.v; d.classList.toggle("on",on); d.setAttribute("aria-checked",String(on)); });
  var v=versionOf(cfg.version);
  $("versionDesc").innerHTML="<b>"+esc(v.name)+".</b> "+esc(v.desc)+(v.id==="peace"?" (Peace has a one-line source; its wars are played as in Classic.)":"");
}
/* 2 to 16 players (E.MINP..E.MAXP): people and computers are counted apart, each on its own stepper (- value +) */
function clampSeats(){
  var mx=E.MAXP||16, mn=E.MINP||2;
  cfg.humans=clamp(cfg.humans|0,0,mx); cfg.cpus=clamp(cfg.cpus|0,0,mx);
  if(cfg.humans+cfg.cpus<mn) cfg.cpus=mn-cfg.humans;
  if(cfg.humans+cfg.cpus>mx) cfg.cpus=mx-cfg.humans;
}
function stepper(box,label,get,set,lo,hi){
  if(!box.querySelector(".bg-stepper__btn")){
    box.innerHTML='<button type="button" class="bg-stepper__btn" data-step="-1" aria-label="Fewer '+esc(label)+'">'+(icon("minus")||"&minus;")+'</button><output class="bg-stepper__val" aria-live="polite"></output><button type="button" class="bg-stepper__btn" data-step="1" aria-label="More '+esc(label)+'">'+(icon("plus")||"+")+"</button>";
    box.querySelectorAll(".bg-stepper__btn").forEach(function(b){ b.addEventListener("click",function(){ if(b.disabled) return; set(get()+(+b.dataset.step)); clampSeats(); drawSetup(); }); });
  }
  var v=get(), bs=box.querySelectorAll(".bg-stepper__btn"), a=document.activeElement;
  if(!bs[0].querySelector("svg")&&icon("minus")){ bs[0].innerHTML=icon("minus"); bs[1].innerHTML=icon("plus"); }   // the icons arrive with ui.js (deferred)
  box.querySelector("output").textContent=String(v);
  bs[0].disabled=v<=lo; bs[1].disabled=v>=hi;
  bs[0].setAttribute("aria-label","Fewer "+label+" ("+v+")"); bs[1].setAttribute("aria-label","More "+label+" ("+v+")");
  if(a&&a.disabled&&box.contains(a)) focusIn(a===bs[0]?bs[1]:bs[0]);   // never leave the focus on a disabled button
}
function drawSeats(){
  clampSeats();
  var mx=E.MAXP||16, mn=E.MINP||2;
  stepper($("humanSeg"),onTV()?"players on this TV":"players on this phone",function(){ return cfg.humans; },function(v){ cfg.humans=v; },0,mx);
  stepper($("cpuSeg"),"computer players",function(){ return cfg.cpus; },function(v){ cfg.cpus=v; },Math.max(0,mn-cfg.humans),mx-cfg.humans);
  if(nameUI) nameUI.count(Math.max(0,cfg.humans));
  $("nameCard").closest("section").hidden=cfg.humans===0;
  var o=curOpts(), n=nPlayers(), names=seatNames(), di=E.deckInfo?E.deckInfo(o,n):null, dn=di?di.cards:E.buildDeck(o).length, per, left;
  if(di){ per=di.per; left=di.left; } else { per=Math.floor(dn/n); left=dn-per*n; if(o.jokers==="each"){ per=Math.floor((dn-2)/n); left=dn-2-per*n; } }
  $("seatTokens").innerHTML=names.map(function(nmx,i){ return '<span class="bg-token" data-seat="'+seatNo(i)+'" aria-hidden="true">'+esc(initials(nmx))+"</span>"; }).join("");
  $("seatPreview").classList.toggle("is-many",n>8);
  $("seatHead").textContent=n+" at the table"+(cfg.humans===0?" · watch mode":"");
  $("deckLine").textContent=di?di.text:dn+" cards";   // "2 decks · 104 cards"
  $("seatNote").textContent=per+" each"+(o.jokers==="each"?" plus a joker each":"")+(left?", "+left+" left over"+(o.leftover==="remove"?" (set aside)":" (to the first war's winner)"):"")+(o.colourDeal?" · dealt by colour":"")+
    (cfg.humans>12?" · names 13 to "+cfg.humans+" play as Player 13 to Player "+cfg.humans:"");
  $("autoRow").setAttribute("aria-checked",String(!!cfg.auto)); $("autoRow").hidden=cfg.humans===0;
  syncStart();
}
function drawLength(){
  var o=curOpts(), lk=locked("length");
  var ls=$("lengthSeg");
  keepFocus(ls,"data-l",function(){
    ls.innerHTML=segHTML(E.LENGTHS.map(function(L){ return [L.id,LEN_SHORT[L.id],lk&&L.id!==o.length]; }),o.length,"data-l");
    ls.querySelectorAll("button:not([disabled])").forEach(function(b){ b.addEventListener("click",function(){ cfg.length=b.dataset.l; var L=E.LENGTHS.filter(function(x){ return x.id===cfg.length; })[0]; cfg.limit=L&&L.limits?(L.limits.indexOf(cfg.limit)>=0?cfg.limit:L.limits[1]):0; drawSetup(); }); });
  });
  var L=E.LENGTHS.filter(function(x){ return x.id===o.length; })[0]||E.LENGTHS[0], lim=$("limitSeg");
  lim.hidden=!L.limits;
  if(L.limits) keepFocus(lim,"data-m",function(){
    lim.innerHTML=segHTML(L.limits.map(function(m){ return [m,m+" "+(L.unit==="min"?"min":"battles")]; }),o.limit,"data-m");
    lim.setAttribute("aria-label",L.unit==="min"?"Minutes":"Battles");
    lim.querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.limit=+b.dataset.m; drawSetup(); }); });
  });
  var tie=$("tieSeg");
  if(!tie){ tie=document.createElement("div"); tie.className="bg-seg bg-seg--text"; tie.id="tieSeg"; tie.setAttribute("role","group"); tie.setAttribute("aria-label","Tied at the limit"); lim.parentNode.insertBefore(tie,lim.nextSibling); }
  tie.hidden=!L.limits;
  if(L.limits) keepFocus(tie,"data-t",function(){
    tie.innerHTML=segHTML([["sudden","Tie: sudden death"],["draw","Tie: a draw"]],o.shortTie,"data-t");
    tie.querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.shortTie=b.dataset.t; drawSetup(); }); });
  });
  var d=L.desc;
  if(o.length==="time") d="At the bell the battle in play (and its wars) finishes; then the most cards wins. The clock stops while the Menu is open.";
  if(o.length==="battles") d="After "+o.limit+" battles the most cards wins.";
  if(lk) d+=" "+versionOf(cfg.version).name+" is always played once through.";
  if(o.length==="end") d+=" War can run long (often 300 battles or more): a time limit, a battle limit or one pass keeps it short."+(o.hand?" Hand War played to the end between careful players can take thousands of battles.":"");
  if(L.limits) d+=" Equal leaders at the limit: "+(o.shortTie==="draw"?"the game is a draw.":"sudden death, the next battle that breaks the tie wins.");
  $("lengthDesc").textContent=d;
}
/* one line under each house rule: what it does in play */
var HDESC={
  outLoses:"Official (off): your last card plays for the whole war. On: too few cards for a war and you are out.",
  jokers:"Two jokers rank above the Aces.",
  jokerSteal:"One joker is buried in each stack; win a war that captures the other joker and you win the game.",
  noDown:"A tie is decided at once by the next face-up cards.",
  twos:"Any 2 turned up starts a war.",
  underdog:"Lose a war with a Jack among your face-down cards and you take it anyway.",
  prisoners:"Win a battle and keep one beaten card face up (after a war, a face-down one too). Play it later instead of your top card; if it loses, you also pay the card you would have played.",
  paid:"The loser of each battle also pays one card from their stack.",
  colourDeal:"Every player gets a whole colour or suit: an even share of Aces, Kings and every rank.",
  onlyTied:"On (the usual way at this table): only the players tied for the highest card go to war, and the winner takes every card on the table (Card Games For Dummies). Off: everyone joins the war (Pagat).",
  arrange:"Choose the order your won cards go under your stack (otherwise they are shuffled).",
  progressive:"The first war lays 5 cards down, each later war one more.",
  guerilla:"A joker turned up always starts a war (the jokers are added).",
  twoBeatsAce:"A 2 beats an Ace, and only an Ace. Few sources."
};
/* the rows on show: the engine's houseRows (HOUSE + the 2-16 player rows: Decks, Deuces are wild, Jokers are wild, Wild cards count as),
   already filtered for the version, the player count and the deck count. Decks leads (it sets the size of the game). Old engine: HOUSE */
function houseList(o,n){
  var rows;
  if(E.houseRows) rows=E.houseRows(o.version,n,o);
  else rows=E.HOUSE.filter(function(h){ return E.houseFor(h,o.version,n)&&!(h[0]==="deck"&&locked("deck"))&&!((h[0]==="jokerSteal"&&n!==2)||(h[0]==="colourDeal"&&n===3)); });
  var d=rows.filter(function(h){ return h[0]==="decks"; });
  return d.concat(rows.filter(function(h){ return h[0]!=="decks"; }));
}
function hdesc(key){ return HDESC[key]||(E.HDESC_MORE&&E.HDESC_MORE[key])||""; }
function drawHouse(){
  var o=curOpts(), n=nPlayers(), box=$("houseRules");
  keepFocus(box,"data-k",function(){
    box.innerHTML="";
    houseList(o,n).forEach(function(h){
      var key=h[0], tag=h[4]?'<span class="bg-tag bg-tag--house">house</span>':'<span class="bg-tag bg-tag--official">official</span>', row, ds=hdesc(key);
      if(h[2]==="bool"){
        row=document.createElement("label"); row.className="bg-row";
        row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(h[1])+" "+tag+'</span>'+(ds?'<span class="bg-row__desc">'+esc(ds)+"</span>":"")+'</span><input type="checkbox" class="bg-toggle" data-k="'+key+'"'+(o[key]?" checked":"")+">";
        row.querySelector("input").addEventListener("change",function(e){ cfg.over[key]=e.target.checked; drawSetup(); });
      } else {
        var lbl=function(c){ if(key==="decks"&&+c[0]===0&&E.autoDecks){ var a=E.autoDecks(n); return c[1]+" ("+a+(a===1?" deck)":" decks)"); } return c[1]; };
        row=document.createElement("div"); row.className="bg-row bg-row--static";
        row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(h[1])+" "+tag+'</span>'+(ds?'<span class="bg-row__desc">'+esc(ds)+"</span>":"")+'</span><select class="bg-select" data-k="'+key+'" aria-label="'+esc(h[1])+'">'+h[3].map(function(c){ return '<option value="'+esc(c[0])+'"'+(String(o[key])===String(c[0])?" selected":"")+">"+esc(lbl(c))+"</option>"; }).join("")+"</select>";
        row.querySelector("select").addEventListener("change",function(e){ var m=h[3].filter(function(c){ return String(c[0])===e.target.value; })[0]; cfg.over[key]=m?m[0]:e.target.value; drawSetup(); });
      }
      box.appendChild(row);
    });
  });
  syncRules();
}
function changedRules(){ var n=nPlayers(), base=E.normalize(E.versionOpts(cfg.version,{}),n), o=curOpts(); return houseList(o,n).filter(function(h){ return String(o[h[0]])!==String(base[h[0]]); }).length; }
function syncRules(){
  var n=changedRules(), v=versionOf(cfg.version), open=ui.rulesOpen;
  $("rulesDesc").textContent=n?n+(n===1?" rule":" rules")+" changed from "+v.name:"As in "+v.name+". Open it to change any rule.";
  $("rulesToggle").setAttribute("aria-expanded",String(open)); $("houseRules").hidden=!open; $("rulesLegend").hidden=!open;
}
function skillNote(){
  var o=curOpts(), dec=W.Brain&&W.Brain.hasDecisions?W.Brain.hasDecisions(o):!!(o.hand||o.prisoners||o.arrange);
  $("skillNote").textContent=dec?"Skill changes how the computers choose"+(o.hand?" which card to play (they count the cards that have been played)":"")+(o.prisoners?(o.hand?" and":"")+" which prisoner to take and when to play it":"")+(o.arrange?" and how they arrange the cards they win":"")+".":
    "In "+versionOf(cfg.version).name+" the shuffle decides every battle: nobody has a choice to make, so skill changes nothing here. It matters in Hand War and with prisoners.";
}
function drawSetup(){ clampSeats(); drawVersions(); drawSeats(); drawLength(); drawHouse(); skillNote(); syncStart(); }
$("rulesToggle").addEventListener("click",function(){ ui.rulesOpen=!ui.rulesOpen; syncRules(); });
function setSpeedSeg(){ cfg.speed=normSpeed(cfg.speed); window.bgGameSpeed=cfg.speed; $("speedSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.s===cfg.speed; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("speedSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.speed=b.dataset.s; setSpeedSeg(); save(); }); });
function setSkillSeg(){ cfg.skill=normSkill(cfg.skill); if(G) G.skill=cfg.skill; $("skillSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.k===cfg.skill; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("skillSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.skill=b.dataset.k; setSkillSeg(); save(); }); });
function setAuto(on){ cfg.auto=!!on; $("autoRow").setAttribute("aria-checked",String(cfg.auto)); $("autoBtn").setAttribute("aria-checked",String(cfg.auto)); }
$("autoRow").addEventListener("click",function(){ setAuto(!cfg.auto); save(); });
$("autoBtn").addEventListener("click",function(){ setAuto(!cfg.auto); save(); syncControls(); drive(); });   // the switch and the status line show it (a toast would cover the table)
setSpeedSeg();
function deviceCopy(){
  var tv=onTV(), t=tv?"Players on this TV":"Players on this phone";
  $("humansTitle").textContent=t; $("humanSeg").setAttribute("aria-label",t);
  $("humansDesc").textContent="0 = watch the computers play. Two or more share the "+(tv?"remote":"phone")+".";
  var hb=$("humanSeg").querySelectorAll(".bg-stepper__btn"); if(hb.length) drawSeats();   // the stepper's labels name the device too
  syncControls();
}
function subParts(parts){ return parts.map(function(s,i){ return '<span class="wr-nw">'+esc(s)+(i<parts.length-1?" ·":"")+"</span>"; }).join(" "); }
function lengthWords(o){ return o.length==="time"?o.limit+" min":o.length==="battles"?o.limit+" battles":o.length==="onepass"?"one pass":"to the end"; }
function syncStart(){
  var o=curOpts(), rb=$("resumeBtn"), sb=$("startBtn"), resumable=rb.style.display!=="none";
  $("startLabel").textContent=resumable?"New game":"Start War";
  var parts=[nPlayers()+" players",SHORT[cfg.version]||"War"];
  if(!resumable){ parts.push(lengthWords(o)); if(changedRules()) parts.push("custom rules"); }
  $("startSub").innerHTML=subParts(parts);
  $("startDock").classList.toggle("has-resume",resumable);
  sb.classList.toggle("bg-btn--primary",!resumable); sb.classList.toggle("bg-btn--secondary",resumable);
  rb.classList.toggle("bg-btn--primary",resumable); rb.classList.toggle("bg-btn--secondary",!resumable);
}
function resultDue(){ var B=BG(); return !!(G&&G.over&&ui.winShown!==gen&&B&&B.win&&luxe()); }
function resumeText(){
  if(ui.result) return;
  var s="Back to the game";
  if(G&&!G.over) s="Battle "+(G.battle+1)+(G.phase==="war"?" · war":"")+" · "+(G.n)+" players";
  $("resumeLabel").textContent="Resume"; $("resumeSub").textContent=s;
}
function menuResult(){
  if(!resultDue()) return;
  ui.result=true; $("resumeBtn").style.display="block";
  $("resumeLabel").textContent="See the result"; $("resumeSub").textContent=G.winner>=0?nm(G.winner)+(nm(G.winner)==="You"?" win":" wins"):"A draw";
  saveBar.refresh(); syncStart(); barTitle();
}
function showSetup(on,resume){
  var s=$("setup"), b=document.body, se=document.scrollingElement||document.documentElement, y=se.scrollTop;
  if(on) clockOff();
  s.style.display=on?"":"none";
  b.classList.toggle("wr-in-setup",on); b.classList.toggle("bg-app--scene",on); b.classList.toggle("bg-app--felt",!on);
  $("menuBtn").hidden=on;
  if(on){ closeSheets(); closeWin(); syncStart(); }
  if(y) se.scrollTop=0;
  if(!on&&G){
    if(!busy&&!ui.dealing) sync(); else ui.needSync=true;
    clockOn();
    if(resume){
      if(ui.result){ ui.result=false; setTimeout(function(){ if(G&&G.over&&!setupShown()) openWin(); },250); }
      else drive();
    }
    armBack();
    focusTV(mainControl());
  }
  barTitle();
  var B=BG(); if(luxe()&&B.toast&&B.toast.place) B.toast.place();
}
function barTitle(){
  var e=$("barEyebrow"); if(!e) return;
  var t=paused()?"Paused":setupShown()?(liveGame()?"Game in progress":(ui.result?"Game over":"New game")):(!G?"New game":G.over?"Game over":ui.dealing?"The deal":"Battle "+(((busy&&ui.shown)?ui.shown.b:G.battle)+1));   // while a move plays, the battle on the table (as the chips)
  if(e.textContent!==t) e.textContent=t;
}

/* ================= saving ================= */
function pack(){ if(!G) return null; return {G:JSON.parse(JSON.stringify(G)),cfg:JSON.parse(JSON.stringify(cfg)),stats:{ms:Math.round(playMs())}}; }
function save(){ if(!G) return; if(G.over){ Saves.del(GAME,"auto"); return; } var pk=pack(); if(pk) Saves.auto(GAME,pk); }
function loadSaved(d){
  if(!d||!d.G||d.G.id!=="war"||d.G.v!==E.VER) throw new Error("not a War save");
  var bad=E.check(d.G); if(bad.length) throw new Error("save fails its check: "+bad[0]);
  gen++; clearTimeout(timer); busy=false; intent=[]; hurry=false; viewer=-1;
  G=d.G; var c=d.cfg||{}; if(E.migrateSetup) E.migrateSetup(c); for(var k in c) if(Object.prototype.hasOwnProperty.call(cfg,k)) cfg[k]=c[k];
  cfg.speed=normSpeed(cfg.speed); setSpeedSeg(); cfg.skill=normSkill(c.skill||G.skill); G.skill=cfg.skill; setSkillSeg(); setAuto(cfg.auto);
  stats={ms:Math.max(0,+((d.stats||{}).ms)||0)}; clock0=0;
  ui.winShown=-1; ui.result=false; ui.finished=-1; ui.dealing=false; ui.claimPr=undefined; ui.handKey="";
  closeSheets(); closeWin();
  startUI(); showSetup(false); drawSetup(); clockOn(); armBack(); drive();
}
function dressSaveBar(){
  var B=BG(), IC={ss:"save",ls:"load",std:"reset",sg:"save",lg:"load",au:"resume"};
  document.querySelectorAll("#svbar button[data-a]").forEach(function(b){
    if(b.getAttribute("data-lux")) return; b.setAttribute("data-lux","1");
    var t=b.firstChild; if(t&&t.nodeType===3) t.nodeValue=t.nodeValue.replace(/^[^A-Za-z]+/,"");
    b.classList.add("bg-btn","bg-btn--secondary");
    if(B&&B.icon) b.insertAdjacentHTML("afterbegin",B.icon(IC[b.getAttribute("data-a")]||"save"));
  });
}
if(window.MutationObserver){
  new MutationObserver(dressSaveBar).observe($("svbar"),{childList:true});
  new MutationObserver(function(){ var B=BG(), m=$("svtoast").textContent; if(luxe()&&B.toast&&m) B.toast(m,{icon:"save",ms:2400}); }).observe($("svtoast"),{childList:true,characterData:true,subtree:true});
}
function applySettings(s){
  s=s||{}; if(E.migrateSetup) E.migrateSetup(s); cfg.version=versionOf(s.version).id; cfg.over=s.over||{}; cfg.humans=s.humans!=null?s.humans:1; cfg.cpus=s.cpus!=null?s.cpus:1;
  cfg.speed=normSpeed(s.speed); cfg.skill=normSkill(s.skill); cfg.auto=!!s.auto; cfg.length=s.length||"end"; cfg.limit=+s.limit||0; cfg.shortTie=s.shortTie==="draw"?"draw":"sudden";
  setSpeedSeg(); setSkillSeg(); setAuto(cfg.auto); drawSetup();
}
/* the CEO's rule (2026-10-16): Three-card War (3 down, the 4th decides) is the default. A setup remembered on this device from before
   (saved settings, the setup inside the autosave and the saved game) said "classic" only because Classic was the default: it moves to
   Three-card War ONCE (E.migrateSetup marks it cv:2, written back with its own time stamp). A game in progress keeps its rules (G.o). */
(function migrateStores(){
  if(!E.migrateSetup) return;
  ["settings","auto","save"].forEach(function(kind){
    try{
      var key="bg_"+kind+"_"+GAME, raw=localStorage.getItem(key); if(!raw) return;
      var o=JSON.parse(raw), c=o&&o.data&&(kind==="settings"?o.data:o.data.cfg); if(!c||typeof c!=="object"||c.cv>=E.SETUP_V) return;
      E.migrateSetup(c); localStorage.setItem(key,JSON.stringify(o));
    }catch(e){}
  });
})();
var saveBar=Saves.bar({game:GAME,el:$("svbar"),version:1,snapNote:"exactly as it is now",saveToast:"Game saved",
  getSettings:function(){ return JSON.parse(JSON.stringify(cfg)); },
  applySettings:applySettings,
  standard:function(){ applySettings({}); },
  getSnapshot:function(){ return (G&&!G.over)?pack():null; },loadSnapshot:loadSaved});

/* ================= Menu, Resume, Start ================= */
$("menuBtn").addEventListener("click",function(){
  var result=resultDue();
  saveBar.refresh(); $("resumeBtn").style.display=((G&&!G.over)||result)?"block":"none";
  ui.result=false; resumeText();
  drawSetup(); showSetup(true);
  if(result) menuResult();
  focusTV($("resumeBtn").style.display!=="none"?$("resumeBtn"):$("startBtn"));
});
$("resumeBtn").addEventListener("click",function(){
  if(!G&&ui.cont){   // a fresh page: Continue the last game (the same path as "Continue last game" under Save and load)
    var au=document.querySelector("#svbar button[data-a=au]"); if(au&&!au.disabled) au.click();
    if(!G){ ui.cont=false; $("resumeBtn").style.display="none"; syncStart(); }
    return;
  }
  showSetup(false,true);
});
/* a fresh page with an unfinished game saved: the dock offers Continue (gold) next to New game, so it is on screen without scrolling */
function contOffer(){
  ui.cont=false; if(G) return false;
  var a=null; try{ a=Saves.get?Saves.get(GAME,"auto"):null; }catch(e){ a=null; }
  var d=a&&a.data; if(!d||!d.G||d.G.over||d.G.id!=="war") return false;
  ui.cont=true; $("resumeBtn").style.display="block"; $("resumeLabel").textContent="Continue";
  $("resumeSub").textContent="Battle "+((+d.G.battle||0)+1)+" · "+d.G.n+" players"+(Saves.when&&a.ts?" · "+Saves.when(a.ts):"");
  syncStart(); return true;
}
// the new game is dealt before the table shows, so the old game never flashes back
$("startBtn").addEventListener("click",function(){ Sound.skip(); closeSheets(); closeWin(); startGame(); showSetup(false); armBack(); dealShow(gen); });

/* ================= a new game ================= */
function startGame(){
  gen++; clearTimeout(timer); clampSeats(); busy=false; intent=[]; hurry=false; viewer=-1;
  var n=nPlayers(), hn=humanNames(cfg.humans)||[], i;
  for(i=hn.length;i<cfg.humans;i++) hn.push(cfg.humans===1?"You":"Player "+(i+1));
  var cn=cpuNames(cfg.cpus,hn), players=[];
  for(i=0;i<n;i++){ var h=i<cfg.humans; players.push({name:h?hn[i]:cn[i-cfg.humans],human:h}); }
  G=E.newGame(rawOpts(),players); G.skill=normSkill(cfg.skill);
  stats={ms:0}; clock0=0; ui.winShown=-1; ui.result=false; ui.finished=-1; ui.claimPr=undefined; ui.handKey=""; ui.lastTurn=-1;
  ui.dealing=true; ui.dealSkip=false;
  startUI(); save();
}
function startUI(){
  Sound.music(GAME);
  C.injectCSS();
  buildTable();
}

/* ================= the table: seats, geometry, cards ================= */
var POS={2:["bottom","top"],3:["bottom","topleft","topright"],4:["bottom","left","top","right"]};
function buildTable(){
  var t=$("wtable"), cards=$("wtCards");
  seatEls.forEach(function(el){ el.remove(); }); seatEls=[]; cards.innerHTML=""; tab={}; extra=[]; carryEls=[]; kittyEls=[];
  disp=G.players.map(function(p,s){ return ui.dealing?0:E.total(G,s); });
  G.players.forEach(function(p,s){
    var el=document.createElement("div"); el.className="wr-seat"+(G.n>=BIG?" is-mini":""); el.setAttribute("data-s",s); el.setAttribute("data-seat",seatNo(s)); el.setAttribute("data-pos",G.n>=BIG?"grid":POS[G.n][s]);
    el.innerHTML='<div class="wr-pk" aria-hidden="true"></div><div class="wr-plate"><span class="wr-tk"><span class="bg-token" data-seat="'+seatNo(s)+'" aria-hidden="true">'+esc(initials(p.name))+"</span>"+
      (p.human?"":'<span class="bg-player__cpu" title="Computer">'+icon("cpu")+"</span>")+"</span>"+
      '<span class="wr-name">'+esc(p.name)+'</span><span class="wr-cnt"><b class="wr-n">0</b><span class="wr-nl">cards</span></span><span class="wr-sub"></span><span class="wr-tag"></span></div>';
    if(G.n>=BIG) el.addEventListener("click",function(){ tapSeat(s); });   // a compact tile: the whole tile is the stack to tap
    else el.querySelector(".wr-pk").addEventListener("click",function(){ tapSeat(s); });
    t.insertBefore(el,cards); seatEls.push(el);
  });
  $("game").classList.toggle("has-hand",!!G.o.hand); $("game").classList.toggle("is-multi",G.n>2); $("game").classList.toggle("is-big",G.n>=BIG);
  ui.fight=null;
  buildStand();
}
/* the big table (5-16 players): a grid of compact tiles, the lower half of the seats (seat 1 first, in the row nearest the controls) below
   a centre band with the pot, the rest above it. The grid shape (columns x rows) is the one that gives the largest cards for this table
   size, so the same code lays out a phone upright or sideways and the TV. A tile: the token and the name on top; below, the stack with
   its count, and the battle slot where the flipped card (and a war's face-down cards, fanned) lie */
function bigLayout(Wd,H){
  var n=G.n, tv=onTV(), rem=remPx(), pad=Math.round(rem*(tv?.75:.4)), gap=Math.round(rem*(tv?.7:.35));
  var ip=Math.round(rem*(tv?.45:.25)), ig=Math.round(rem*(tv?.45:.2)), minCol=rem*(tv?2.6:1.7), cap=rem*(tv?5.5:4.4), minW=rem*(tv?7:4.3);
  var short=H<rem*(tv?20:22), lh=Math.round(rem*(tv?1.75:short?1.35:1.5)), band=Math.round(rem*(tv?4:short?2.6:3.4)), best=null, C, R;
  /* the lower block (seat 1 first) takes about half the seats, at least what the upper rows can't hold */
  function blocks(c,r){ var rb=Math.ceil(r/2), rt=r-rb, nb=Math.max(n-rt*c,Math.min(Math.ceil(n/2),rb*c)); return {nb:nb,nt:n-nb}; }
  for(C=2;C<=n;C++){
    R=Math.ceil(n/C); if(C>2&&Math.ceil(n/(C-1))===R) continue;   // more columns for the same rows only make the tiles narrower
    var tw=(Wd-2*pad-(C-1)*gap)/C, th=(H-2*pad-band-R*gap)/R;
    if(tw<minW&&best) continue;
    var cw=Math.min(cap,(th-2*ip-lh)/1.42), col=Math.max(cw*.55,minCol);
    cw=Math.min(cw,(tw-2*ip-ig-col)/1.05);                         // the slot: the card and a little room for a war's fan
    var score=cw+Math.min(tw,rem*(tv?12:8))*.06;                  // bigger cards first; wider tiles (longer names) break near-ties
    if(!best||score>best.score) best={C:C,R:R,tw:tw,cw:cw,score:score};
  }
  C=best.C; R=best.R;
  var cw2=Math.max(Math.floor(best.cw),tv?Math.round(2.2*rem):22), ch=Math.round(cw2*1.42), pw=Math.round(cw2*.55), ph=Math.round(pw*1.42), col=Math.round(Math.max(pw,minCol));
  var tw2=Math.floor(Math.min(best.tw,2*ip+col+ig+cw2*2.6)), th2=2*ip+lh+ch, cntH=Math.round(rem*(tv?1.35:1.15)), py=Math.max(0,Math.round((ch-ph-cntH)/2));
  var bl=blocks(C,R), nb=bl.nb, nt=bl.nt, rb=Math.ceil(nb/C), rt=Math.ceil(nt/C);
  function rowsOf(m,r){ var a=[], i; for(i=0;i<r;i++) a.push(Math.floor(m/r)+(i<m%r?1:0)); return a; }
  var rowsB=rowsOf(nb,rb), rowsT=rowsOf(nt,rt), seats=[], s=0;
  function rowAt(k,y){ var rw=k*tw2+(k-1)*gap, x0=(Wd-rw)/2; for(var i=0;i<k;i++){ seats[s]={x:x0+i*(tw2+gap),y:y}; s++; } }
  rowsB.forEach(function(k,j){ rowAt(k,H-pad-(j+1)*th2-j*gap); });          // the lower block, from the bottom row up
  rowsT.forEach(function(k,j){ rowAt(k,pad+(rt-1-j)*(th2+gap)); });          // the upper block, from the band up
  var topEnd=rt?pad+rt*th2+(rt-1)*gap:pad, botStart=H-pad-rb*th2-(rb-1)*gap, mid={x:Wd/2,y:(topEnd+botStart)/2};
  seatEls.forEach(function(el,q){
    var p=seats[q];
    el.style.left=Math.round(p.x)+"px"; el.style.top=Math.round(p.y)+"px"; el.style.width=tw2+"px"; el.style.height=th2+"px";
    el.style.setProperty("--ip",ip+"px"); el.style.setProperty("--lh",lh+"px"); el.style.setProperty("--pw",pw+"px"); el.style.setProperty("--ph",ph+"px");
    el.style.setProperty("--col",col+"px"); el.style.setProperty("--py",py+"px");
    var pk=el.querySelector(".wr-pk"); pk.style.width=pw+"px"; pk.style.height=ph+"px"; pk.style.setProperty("--cw",pw+"px");
    var x0=p.x+ip+col+ig, x1=p.x+tw2-ip;
    p.w=tw2; p.h=th2; p.pos="grid"; p.slot={x:x0+Math.min(x1-x0,cw2*1.6)/2,y:p.y+ip+lh+ch/2,axis:"x",room:Math.max(cw2,x1-x0)};
  });
  var t=$("wtable"); t.style.setProperty("--cw",cw2+"px"); t.classList.toggle("is-tight",tw2<rem*(tv?9:5.75));
  var stack={x:pad+cw2*.45,y:mid.y}, sr=stack.x+pw/2+cw2*.8;   // the left-over / tied-card stacks at the left of the band
  GEO={W:Wd,H:H,cw:cw2,ch:ch,pw:pw,ph:ph,pad:pad,gap:gap,seats:seats,mid:mid,big:true,topEnd:topEnd,botStart:botStart,band:Math.max(rem*2,botStart-topEnd-2*gap),C:C,R:R,stack:stack,sr:sr};
  var m=$("wtMid"); m.style.top=Math.round(mid.y)+"px"; m.style.transform="translate(-50%,-50%)"; m.style.justifyItems="center";
  midPlace();
  return true;
}
function layoutSeats(){
  var t=$("wtable"), Wd=t.clientWidth, H=t.clientHeight; if(!G||!Wd||!H) return false;
  if(G.n>=BIG) return bigLayout(Wd,H);
  var n=G.n, tv=onTV(), rem=remPx(), pad=Math.round(rem*(tv?.9:.6)), gap=Math.round(rem*(tv?.8:.5));
  var ch=H*(n===2?.255:n===3?.23:.19), cw=Math.min(ch/1.42,Wd*(n===2?.24:n===3?.18:.14));
  cw=Math.round(Math.max(cw,tv?3.6*rem:44)); ch=Math.round(cw*1.42);
  var pw=Math.round(cw*.74), ph=Math.round(pw*1.42);
  t.style.setProperty("--cw",cw+"px");
  var seats=[];
  seatEls.forEach(function(el,s){
    var pos=POS[n][s], side=pos==="left"||pos==="right", pk=el.querySelector(".wr-pk"), pl=el.querySelector(".wr-plate");
    pk.style.width=pw+"px"; pk.style.height=ph+"px"; pk.style.setProperty("--cw",pw+"px");
    var sg=parseFloat(getComputedStyle(el).columnGap)||rem*.6;   // the gap between the packet and the plate
    pl.style.maxWidth=(side?rem*(tv?9:5):n===3?Math.max(rem*4.5,Wd/2-pad-gap/2-pw-sg):Math.min(rem*(tv?16:10),Wd-2*pad-pw-gap))+"px";
    el.style.left="0px"; el.style.top="0px";
    var sw=el.offsetWidth, sh=el.offsetHeight, x, y, slot;
    if(!side){
      var cx=pos==="topleft"?Wd*.27:pos==="topright"?Wd*.73:Wd/2;
      x=pos==="topleft"?clamp(cx-sw/2,pad,Math.max(pad,Wd/2-gap/2-sw)):pos==="topright"?clamp(cx-sw/2,Math.min(Wd-pad-sw,Wd/2+gap/2),Wd-pad-sw):clamp(cx-sw/2,pad,Wd-pad-sw);
      y=pos==="bottom"?H-pad-sh:pad;
      slot={x:cx,y:pos==="bottom"?y-gap-ch/2:y+sh+gap+ch/2,axis:"x",room:Wd-2*pad};
    } else {
      x=pos==="left"?pad:Wd-pad-sw; y=(H-sh)/2;
      slot={x:pos==="left"?x+sw+gap+cw/2:x-gap-cw/2,y:H/2,axis:"y",room:H/2};
    }
    el.style.left=Math.round(x)+"px"; el.style.top=Math.round(y)+"px";
    seats.push({pos:pos,x:x,y:y,w:sw,h:sh,slot:slot});
  });
  var mid={x:Wd/2,y:H/2};
  if(n===2) seats.forEach(function(q){   // the battle cards meet near the middle of the table, never over a seat
    if(q.slot.axis!=="x") return;
    var c0=Math.max(gap*1.3,rem*.9);   // half the gap between the two battle rows (room for the war cards' tilt)
    if(q.pos==="bottom") q.slot.y=Math.min(q.y-gap-ch/2,H/2+ch/2+c0);
    else q.slot.y=Math.max(q.y+q.h+gap+ch/2,H/2-ch/2-c0);
  });
  if(n===2){ var r2=Wd-2*(pad+pw+gap); seats.forEach(function(q){ q.slot.room=r2; }); mid={x:pad+pw/2+4,y:H/2}; }
  if(n===3){ seats[1].slot.room=seats[2].slot.room=Wd/2-pad*1.5; mid={x:Wd/2,y:(seats[1].slot.y+ch/2+seats[0].slot.y-ch/2)/2}; }
  if(n===4){ var tb=seats[2].slot.y+ch/2+gap, bb=seats[0].slot.y-ch/2-gap; seats[1].slot.room=seats[3].slot.room=Math.max(ch,bb-tb); }
  GEO={W:Wd,H:H,cw:cw,ch:ch,pw:pw,ph:ph,pad:pad,gap:gap,seats:seats,mid:mid};
  var m=$("wtMid"); m.style.left=Math.round(mid.x)+"px"; m.style.top=Math.round(mid.y+ph/2+rem*.9)+"px"; m.style.maxWidth=""; m.style.width=""; m.classList.remove("is-tight");   // (a big table before may have set them)
  m.style.transform=n===2?"translate(-"+Math.round(pw/2+4)+"px,-50%)":"translate(-50%,-50%)"; m.style.justifyItems=n===2?"start":"center";
  return true;
}
function T(p){ return "translate("+p.x.toFixed(1)+"px,"+p.y.toFixed(1)+"px) rotate("+(p.r||0)+"deg) scale("+(p.k==null?1:p.k)+")"; }
function place(el,p){ el._p=p; el.style.transform=T(p); }
var zTop=10;
function move(el,p,ms,o){
  o=o||{}; var from=el._p||p; place(el,p);
  if(o.front) el.style.zIndex=++zTop;
  if(reduced()||!el.animate||!ms) return Promise.resolve();
  var kf=[{transform:T(from)},{transform:T(p)}];
  if(o.lift){ var m={x:(from.x+p.x)/2,y:(from.y+p.y)/2-(GEO?GEO.ch*.12:10),r:p.r,k:(p.k==null?1:p.k)*1.06}; kf=[{transform:T(from)},{transform:T(m),offset:.5},{transform:T(p)}]; }
  try{ var a=el.animate(kf,{duration:ms,delay:o.delay||0,easing:o.ease||"cubic-bezier(.22,.7,.2,1)",fill:"backwards"}); return a.finished.then(function(){},function(){}); }catch(e){ return Promise.resolve(); }
}
/* a wild card (House: Deuces / Jokers are wild) carries a "Wild" badge and an accent ring while it is face up */
function markWild(el,id){ if(el) el.classList.toggle("is-wild",id!=null&&!!(G&&E.isWild&&E.isWild(G,id))); }
function flipUp(el,id,ms,zoom){
  if(id!=null){ C.setFace(el,id); markWild(el,id); }
  el.classList.add("is-up"); el._pend=false;
  if(reduced()||!el.animate) return Promise.resolve();
  var inn=el.firstElementChild, ps=[];
  try{ ps.push(inn.animate([{transform:"rotateY(180deg)"},{transform:"rotateY(0deg)"}],{duration:ms,easing:"cubic-bezier(.3,.6,.25,1)"}).finished); }catch(e){}
  if(zoom&&el._p){ var p=el._p, z={x:p.x,y:p.y,r:0,k:(p.k==null?1:p.k)*1.28}; try{ ps.push(el.animate([{transform:T(p)},{transform:T(z),offset:.45},{transform:T(z),offset:.7},{transform:T(p)}],{duration:Math.round(ms*1.5),easing:"ease-in-out"}).finished); }catch(e){} }
  return Promise.all(ps).then(function(){},function(){});
}
function newCard(id,up,pose){ var el=C.tableCard(id,up); if(up) markWild(el,id); el.style.zIndex=++zTop; $("wtCards").appendChild(el); place(el,pose); return el; }
function slotPose(s,i,m,up){
  var g=GEO.seats[s].slot, cw=GEO.cw, ch=GEO.ch, step=m>1?Math.min(cw*.42,Math.max(cw*.12,(g.room-cw)/(m-1))):0, off=(i-(m-1)/2)*step;
  var x=(g.axis==="x"?g.x+off:g.x)-cw/2, y=(g.axis==="y"?g.y+off:g.y)-ch/2;
  return {x:x,y:y,r:up?0:(i%2?3:-3),k:1};
}
function rectPose(r){   // a viewport rect (a packet, a hand card) as a card pose in table space
  var tr=$("wtable").getBoundingClientRect(), k=r.width/GEO.cw;
  return {x:r.left-tr.left+r.width/2-GEO.cw/2,y:r.top-tr.top+r.height/2-GEO.ch/2,r:0,k:k};
}
function packetPose(s){ var pk=seatEls[s]&&seatEls[s].querySelector(".wr-pk"); return pk?rectPose(pk.getBoundingClientRect()):midPose(0); }
function platePose(s){ var pl=seatEls[s].querySelector(".wr-plate").getBoundingClientRect(), tr=$("wtable").getBoundingClientRect(); return {x:pl.left-tr.left+pl.width/2-GEO.cw/2,y:pl.top-tr.top+pl.height/2-GEO.ch/2,r:0,k:.5}; }
function midPose(i){ var k=GEO.pw/GEO.cw; return {x:GEO.mid.x-GEO.cw/2+(i||0)*GEO.cw*.1,y:GEO.mid.y-GEO.ch/2-(i||0)*1.5,r:0,k:k}; }
/* the left-over and tied-card stacks: the centre (2-4 players); the left of the band on the big table, so the pot line stays readable */
function stackPose(i){ if(!GEO.big) return midPose(i); var k=GEO.pw/GEO.cw; return {x:GEO.stack.x-GEO.cw/2+(i||0)*GEO.cw*.1,y:GEO.stack.y-GEO.ch/2-(i||0)*1.5,r:0,k:k}; }
/* the big table's pot in the centre band: a war's cards gather here before they fly to the winner */
function potPose(i){ var k=Math.min(1,GEO.band*.95/GEO.ch); return {x:GEO.mid.x-GEO.cw/2+((i%7)-3)*1.6,y:GEO.mid.y-GEO.ch/2-(i%5)*1.2,r:((i%5)-2)*3,k:k}; }
function layoutSeat(s,ms){ var a=tab[s]||[], m=a.length; a.forEach(function(el,i){ var p=slotPose(s,i,m,el.classList.contains("is-up")); if(ms) move(el,p,ms); else place(el,p); }); upTop(s); }
/* the big table's slot is narrow: a war's face-down cards slide UNDER the last face-up card (they peek out at its side), so the tied card
   that started the war stays readable; the deciding card is raised as it turns (animEvent "reveal") */
function upTop(s){ if(!GEO||!GEO.big) return; var u=lastUp(s); if(u&&(tab[s]||[]).indexOf(u)<(tab[s]||[]).length-1) u.style.zIndex=++zTop; }
function addToSeat(s,el,ms){ (tab[s]=tab[s]||[]).push(el); potLine(); var a=tab[s], m=a.length, last=null;
  a.forEach(function(x,i){ var p=slotPose(s,i,m,x.classList.contains("is-up")); if(x===el) last=move(x,p,ms,{lift:true}); else move(x,p,sp(200)); });
  upTop(s);
  return last||Promise.resolve(); }

/* the whole table drawn from G (after every batch of moves, a load, a resize) */
function renderCards(){
  var box=$("wtCards"); box.innerHTML=""; tab={}; extra=[]; carryEls=[]; kittyEls=[]; zTop=10;
  if(!G||!GEO) return;
  var s, i;
  if(G.phase==="war"||G.phase==="claim") G.tb.forEach(function(e){ var el=newCard(e.up?e.c:null,e.up,{x:0,y:0}); (tab[e.s]=tab[e.s]||[]).push(el); });
  if(!G.over&&(G.phase==="flip"||G.phase==="war")) Object.keys(G.pick).forEach(function(k){
    s=+k; var add=[];
    if(G.phase==="flip") add.push(newCard(null,false,{x:0,y:0}));
    else { var a=E.avail(G,s); if(a>0){ var nd=Math.min(G.down,a-1), num=nd<=5&&!GEO.big, el;   // the war cards laid so far keep their numbers (animPlan)
      for(i=0;i<nd;i++){ el=newCard(null,false,{x:0,y:0}); if(num) el.setAttribute("data-wn",String(i+1)); add.push(el); }
      el=newCard(null,false,{x:0,y:0}); if(num&&nd) el.setAttribute("data-wn",ord(nd+1)); add.push(el); } }
    if(add.length) add[add.length-1]._pend=true;
    tab[s]=(tab[s]||[]).concat(add);
  });
  for(s=0;s<G.n;s++) layoutSeat(s,0);
  if(G.phase==="claim"&&G.pend){ var w=G.pend.w, lw=(tab[w]||[]).filter(function(el){ return el.classList.contains("is-up"); }).pop(); if(lw) lw.classList.add("is-win"); }
  G.carry.forEach(function(c,j){ var el=newCard(c,true,carryPose(j)); carryEls.push(el); });
  for(i=0;i<G.kitty.length;i++) kittyEls.push(newCard(null,false,stackPose(i)));
  midNote();
}
function carryPose(j){ var p=stackPose(0); return {x:p.x+j*GEO.cw*.16,y:p.y,r:(j%2?4:-4),k:p.k}; }
function midNote(){
  var t="";
  if(G&&ui.dealing) t=onTV()?"Press OK to skip the deal":"Tap the table to skip the deal";
  else if(G&&G.kitty.length) t=(big()?G.kitty.length:plural(G.kitty.length,"card"))+" left over: to the first war's winner";   // the big table: the short form fits its band on one line
  else if(G&&G.carry.length) t=G.carry.length+(big()?" tied":" tied cards")+": to the next battle's winner";
  else if(G&&G.aside.length) t=G.aside.length+" set aside";
  $("wtMidNote").textContent=t;
  midPlace(); potLine();
}
/* the big table: the pot line sits in the middle of the band, or right of the left-over / tied-card stack while there is one */
function midPlace(){
  if(!GEO||!GEO.big) return;
  var m=$("wtMid"), side=kittyEls.length>0||carryEls.length>0, rem=remPx();
  m.style.left=Math.round(side?(GEO.sr+GEO.W)/2:GEO.mid.x)+"px";
  m.style.maxWidth=Math.round(side?GEO.W-GEO.sr-GEO.pad-rem*.5:GEO.W-2*GEO.pad)+"px";
  m.style.width="max-content";   // an absolute box centred by translate(-50%) would otherwise shrink to the room right of its left edge and wrap early
  /* the clear room between the rows: the lower tiles' tags reach .6rem above them. The pot line and a note (left over / tied cards) need
     about 2.8rem; a tighter band (Hand War upright, 16 seats) sets the pot number smaller and the lines closer (is-tight: about 2.1rem) */
  var room=GEO.botStart-GEO.topEnd-rem*.6, note=!!$("wtMidNote").textContent;
  m.style.top=Math.round((GEO.topEnd+GEO.botStart-rem*.6)/2)+"px";
  m.classList.toggle("is-tight",note&&room<rem*2.8);
}
/* the big table's centre band: the battle pot (every card on the table) or, in a war, the war pot */
function potLine(){
  var el=$("wtPot"); if(!el) return;
  var on=big()&&!!GEO&&!ui.dealing&&!G.over, n=0, s;
  if(on){ for(s in tab) n+=tab[s].length; n+=carryEls.length; }
  var war=!!ui.fight||(!busy&&!!G&&(G.phase==="war"||(G.phase==="claim"&&!!G.pend&&G.pend.war>0)));
  var h=on&&n?'<span class="wr-pot__l">'+(war?"War pot":"Battle pot")+'</span><b class="wr-pot__n">'+n+'</b><span class="wr-pot__u">'+(n===1?"card":"cards")+"</span>":"";
  if(el._h!==h){ el._h=h; el.innerHTML=h; }
  el.classList.toggle("is-war",war);
  var pc=$("wpot"), pt="";
  if(pc){
    if(!big()&&GEO&&G&&!ui.dealing&&!G.over&&war){ var k=carryEls.length; for(s in tab) k+=tab[s].length; if(k) pt="War pot · "+plural(k,"card"); }
    if(pc.textContent!==pt) pc.textContent=pt;
  }
}
function paintPacket(s,count){
  var pk=seatEls[s]&&seatEls[s].querySelector(".wr-pk"); if(!pk) return;
  var L=count>0?Math.min(6,Math.ceil(count/7)):0;
  if(pk._L===L) return; pk._L=L;
  var h=""; for(var i=0;i<L;i++) h+=C.backHTML({attrs:'style="transform:translate('+(-i*1.6)+"px,"+(-i*1.6)+'px)"'});
  pk.innerHTML=h; pk.classList.toggle("is-empty",L===0);
}
/* a seat count on screen. A won pot counts up (tweenNumber); a plain write while that runs must not flash the end value over the count-up
   (task2: 18, 36, 23, 27 ... 36), and a new value stops a count-up that is no longer right (the count would land on a stale number) */
function putCount(el,v){
  if(el._tw){ if(el._tw.to===v&&el._tw.end>Date.now()) return; el._tw=null; var B=BG(); if(B&&B.tweenNumber){ B.tweenNumber(el,v,v,0); return; } }
  if(el.textContent!==String(v)) el.textContent=String(v);
}
function setCount(s,v,tween){
  var el=seatEls[s]&&seatEls[s].querySelector(".wr-n"); if(!el) return;
  var from=disp[s]; disp[s]=v;
  var B=BG();
  if(tween&&B&&B.tweenNumber&&!reduced()&&from!==v){ var ms=sp(420); el._tw={to:v,end:Date.now()+ms+120}; B.tweenNumber(el,from,v,ms); } else putCount(el,v);
  seatEls[s].querySelector(".wr-nl").textContent=v===1?"card":"cards";
  var p=G.players[s]; paintPacket(s,G.o.length==="onepass"?Math.max(0,v-p.won.length):Math.max(0,v-p.pr.length-p.hand.length));
}
/* who is in the war (big table): from G when the table is still, from the "war" event while it animates */
function fightOf(){
  if(!G||G.over||G.phase!=="war") return null;
  var f=G.need.slice(), ids=f.map(function(s){ return G.cur[s]; });
  if(ids.some(function(c){ return c==null; })) return {f:f,t:[]};
  return {f:f,t:E.winnersOf(G,ids).map(function(i){ return f[i]; })};
}
/* the cards a seat has already laid for a move the engine still holds (G.pick: the others have not acted yet). They left the stack on the
   table, so the seat count leaves them out, as it does while they fly (task2: a person who laid 3 down + the 4th read "25 cards" beside the
   computer's 21, after the count had dropped and bounced back). Mirrors renderCards: one card for a flip, the war cards (down + 1) in a war */
function laidN(s){ if(!G||G.over||!G.pick||!G.pick[s]) return 0; if(G.phase==="flip") return 1; if(G.phase!=="war") return 0; var a=E.avail(G,s); return a>0?Math.min(G.down,a-1)+1:0; }
function updateSeats(){
  if(!G) return;
  if(!busy&&!ui.dealing) ui.fight=fightOf();
  var todo=needTodo();
  G.players.forEach(function(p,s){
    var el=seatEls[s]; if(!el) return;
    if(!ui.dealing&&!busy) disp[s]=E.total(G,s)-laidN(s);   // mid-animation the counts follow the cards on the table
    putCount(el.querySelector(".wr-n"),disp[s]); el.querySelector(".wr-nl").textContent=disp[s]===1?"card":"cards";
    if(!busy) paintPacket(s,ui.dealing?disp[s]:p.pk.length);
    var sub=[];
    if(G.o.hand&&!p.out) sub.push("Hand "+p.hand.length);
    if(G.o.length==="onepass") sub.push("Won "+p.won.length+" · "+(p.pk.length+p.hand.length)+" to play");
    if(p.pr.length) sub.push((p.pr.length>1?"Prisoners ":"Prisoner ")+p.pr.map(E.shortName).join(" "));
    el.querySelector(".wr-sub").innerHTML=C.pipText(esc(sub.join(" · ")));
    var fx=ui.fight, fi=!!fx&&fx.f.indexOf(s)>=0, ti=!!fx&&fx.t.indexOf(s)>=0;
    /* the big table in a war: "War" / "Tied" stay on the fighters after they lay their cards (the cards in the slot already say "ready"), so
       who is in the war and who tied stay readable until the deciding flip */
    var tag=p.out?"Out":(ui.dealing&&s===G.dealer)?"Dealer":(big()&&fi)?(ti?"Tied":"War"):(!G.over&&G.pick[s]&&!busy)?"Ready":"";
    el.classList.toggle("is-fight",big()&&fi); el.classList.toggle("is-tied",big()&&ti);
    el.querySelector(".wr-tag").textContent=tag;
    el.classList.toggle("is-out",!!p.out);
    el.classList.toggle("is-need",!ui.dealing&&!G.over&&todo.indexOf(s)>=0&&(!big()||p.human));   // big table: only the people's tiles light up
    el.classList.toggle("is-win",!!(G.over&&G.winner===s));
    el.querySelector(".wr-pk").style.cursor=(p.human&&!G.o.hand)?"pointer":"default";
  });
}

/* ---------- the standings rail: always sorted, leader first ---------- */
function buildStand(){
  var ul=$("wstand"); ul.innerHTML=""; standEls=[];
  G.players.forEach(function(p,s){
    var li=document.createElement("li"); li.className="bg-player"; li.setAttribute("data-seat",seatNo(s)); li.setAttribute("data-s",s);
    li.innerHTML='<span class="wr-rk"></span><span class="bg-token" aria-hidden="true">'+esc(initials(p.name))+"</span>"+(p.human?"":'<span class="bg-player__cpu" title="Computer">'+icon("cpu")+"</span>")+
      '<span class="bg-player__txt"><span class="bg-player__name">'+esc(p.name)+'</span><span class="bg-player__meta"></span></span><span class="wr-bar" aria-hidden="true"><i></i></span>';
    ul.appendChild(li); standEls.push(li);
  });
}
function renderStand(){
  if(!G||!standEls.length) return;
  var rows, all=deckN();
  if(!busy&&!ui.dealing) rows=E.standings(G);
  else {   // mid-animation: the counts on screen, the same order as E.standings (out players by when they went out), places 1..N, never shared
    rows=G.players.map(function(p,s){ return {s:s,count:disp[s],out:p.out,outAt:p.outAt}; });
    rows.sort(function(a,b){ return (a.out!==b.out?(a.out?1:-1):0)||((a.out&&b.out)?(b.outAt||0)-(a.outAt||0):0)||(b.count-a.count)||(a.s-b.s); });
    rows.forEach(function(r,i){ r.place=i+1; });
  }
  var ul=$("wstand"), B=BG(), before=standEls.map(function(li){ return li.getBoundingClientRect(); }), moved=false;
  rows.forEach(function(r,i){
    var li=standEls[r.s], c=r.count;
    li.querySelector(".wr-rk").textContent=String(r.place);
    li.querySelector(".bg-player__meta").textContent=G.players[r.s].out?"Out":(!onTV()&&G.n>2)?String(c):c+(c===1?" card":" cards")+(onTV()&&G.n<BIG?" · "+Math.round(100*c/all)+"%":"");
    if(onTV()&&G.n>=BIG&&!G.players[r.s].out) li.querySelector(".bg-player__meta").textContent=String(c);
    li.querySelector(".wr-bar > i").style.transform="scaleX("+(all?Math.min(1,c/all):0).toFixed(3)+")";
    li.classList.toggle("is-out",!!G.players[r.s].out);
    if(ul.children[i]!==li){ ul.insertBefore(li,ul.children[i]||null); moved=true; }
  });
  if(moved&&B&&B.flip&&!reduced()) standEls.forEach(function(li,s){ B.flip(li,before[s],{ms:sp(320)}); });
  var turn=focusSeat();
  if(B&&B.setTurn&&turn>=0){ B.setTurn(standEls[turn],{pulse:turn!==ui.lastTurn&&!setupShown()&&!document.hidden}); ui.lastTurn=turn; }
  else if(turn<0) standEls.forEach(function(li){ li.classList.remove("is-turn"); });
}
function needTodo(){ if(!G||G.over) return []; if(G.phase==="claim") return G.pend?[G.pend.w]:[]; return E.need(G).filter(function(s){ return !G.pick[s]; }); }
function focusSeat(){ var t=needTodo(); var h=t.filter(isHuman); return h.length?h[0]:t.length?t[0]:-1; }

/* ---------- the log (suit symbols drawn as the cards' own pips) ---------- */
function youFix(t){
  return String(t).replace(/(^|[.!?:] )You's/g,"$1Your").replace(/You's/g,"your").replace(/ from You\b/g," from you").replace(/(\bYou\b[^.]*?) and (takes|steals)\b/g,function(m,a,v){ return a+" and "+(v==="takes"?"take":"steal"); })
    .replace(/\bYou (wins|takes|deals|has|is|captures|doesn't|loses|steals)\b/g,function(m,v){ return "You "+({wins:"win",takes:"take",deals:"deal",has:"have",is:"are",captures:"capture","doesn't":"don't",loses:"lose",steals:"steal"})[v]; });
}
function renderLog(){
  var ul=$("wlog"); if(!G){ ul.innerHTML=""; return; }
  var L=G.log.slice(-6); ul.innerHTML=L.map(function(e){ return "<li>"+C.pipText(esc(youFix(e.t)))+"</li>"; }).join("");
}

/* ---------- Hand War: the hand of the person at the screen ---------- */
function handSeat(){ if(!G||!G.o.hand) return -1; var hs=G.players.map(function(p,s){ return p.human?s:-1; }).filter(function(s){ return s>=0; }); if(hs.length===1) return hs[0]; return viewer; }
function renderHand(){
  var box=$("whand");
  if(!G||!G.o.hand||!nHumans()){ box.hidden=true; box.innerHTML=""; ui.handKey=""; return; }
  box.hidden=false;
  var s=handSeat(), tv=onTV();
  if(s<0){ var k0="hidden"; if(ui.handKey!==k0){ box.innerHTML='<span class="wr-hand__lbl">Hands stay hidden until the next player takes the '+(tv?"remote":"phone")+"</span>"; ui.handKey=k0; } return; }
  var p=G.players[s], can=!ui.dealing&&!G.over&&G.phase==="flip"&&E.need(G).indexOf(s)>=0&&!G.pick[s]&&!cfg.auto&&!intent.some(function(m){ return m.s===s; });   // live while the table animates too: a pick is queued
  var many=p.pr.length>PR_MAX, cards=p.hand.map(function(c){ return {c:c,pr:false}; }).concat(many?[]:p.pr.map(function(c){ return {c:c,pr:true}; }));
  var key=s+"|"+cards.map(function(x){ return x.c; }).join(",")+"|"+(many?p.pr.length:0)+"|"+can+"|"+G.battle+"|"+G.phase;
  if(!can) closePrisoners();
  if(ui.handKey===key) return;
  var best=can&&cfg.skill!=="hard"?suggest(s):null;   // the brain's pick is marked "suggested" (not on Hard: no help there)
  var a=document.activeElement, fc=(a&&box.contains(a))?a.getAttribute("data-c"):null;
  ui.handKey=key;
  box.innerHTML='<span class="wr-hand__lbl">'+esc(G.players.filter(function(q){ return q.human; }).length>1?p.name+"'s hand":"Your hand")+"</span>"+cards.map(function(x){
    var cn=E.cardName(x.c), wl=!!(E.isWild&&E.isWild(G,x.c));
    return '<button type="button" class="bg-focus wr-hcard'+(x.pr?" is-pr":"")+(wl?" is-wild":"")+(best&&best.c===x.c?" is-best":"")+'" data-c="'+x.c+'"'+(can?"":" disabled")+' aria-label="Play the '+esc(cn)+(wl?", wild":"")+(x.pr?" (prisoner)":"")+(best&&best.c===x.c?", suggested":"")+'">'+C.faceHTML(x.c)+"</button>";
  }).join("")+(many?'<button type="button" class="bg-btn bg-btn--secondary wr-hprs" data-open="1"'+(can?"":" disabled")+'>Prisoners<br>'+p.pr.length+"</button>":"");
  box.querySelectorAll(".wr-hcard").forEach(function(b){ b.addEventListener("click",function(){ if(b.disabled) return; queue({t:"pick",s:s,c:+b.dataset.c},b); }); });
  var hp=box.querySelector(".wr-hprs"); if(hp) hp.addEventListener("click",function(){ if(!hp.disabled) openPrisoners(s); });
  if(fc!=null){ var again=box.querySelector('[data-c="'+fc+'"]:not([disabled])'); if(again) focusIn(again); }
}
/* the brain's pick for the person (Auto-play, and the "suggested" mark): on a copy of G, so the computers' own brains and the device's
   learning table never see the person's seat */
function suggest(s){
  try{ if(!W.Brain) return null; var tmp=JSON.parse(JSON.stringify(G)); var m=W.Brain.decide(tmp,s); return m&&m.t==="pick"?m:null; }catch(e){ return null; }
}

/* ---------- status line, the action buttons, chips ---------- */
function mainControl(){
  var fb=$("flipBtn");
  if(!fb.hidden&&!fb.disabled) return fb;
  var hc=$("whand").querySelector(".wr-hcard:not([disabled])"); if(hc) return hc;
  if(!$("autoBtn").hidden) return $("autoBtn");
  return $("menuBtn");
}
function syncControls(){
  if(!G){ return; }
  /* task2: while a move plays, the button and the status line follow the table as the chips do: a war the engine has declared but the table
     has not shown yet (the tied cards still turning; the drum roll before a double war) stays off the button ("War! Lay 3 down...") and
     the status until its banner, which calls this again (Flip comes back then, and the TV focus with it) */
  var unseen=busy&&G.phase==="war"&&!!ui.shown&&ui.shown.w<G.stats.wars;
  var todo=unseen?[]:needTodo(), hs=todo.filter(isHuman), cs=todo.filter(function(s){ return !isHuman(s); }), tv=onTV(), nh=nHumans();
  var fb=$("flipBtn"), lbl=$("flipLabel"), st="", hint="Flip";
  var handPhase=G.o.hand&&G.phase==="flip";
  fb.hidden=!nh||G.over||(handPhase&&!ui.dealing);
  fb.disabled=ui.dealing||!hs.length||G.phase==="claim";
  if(G.phase==="war"&&hs.length){ var s0=hs[0], a=E.avail(G,s0), nd=a>0?Math.min(G.down,a-1):0; lbl.textContent=a>0?(nd?nb("War! Lay "+nd+" down,")+" "+nb("flip the "+ord(nd+1)):"War! Flip"):"War!"; hint="Lay your war cards"; }   // a narrow phone dock breaks the label after the comma only (2 lines)
  else lbl.textContent=ui.dealing?"Dealing":(hs.length>1?"Flip all":"Flip");
  if(handPhase) hint="Play a card";
  $("autoBtn").hidden=!nh||G.over;
  // the prisoners a person may play instead of the top card
  var pb=$("wprs"), h="";
  if(!G.o.hand&&G.phase==="flip"&&hs.length&&!ui.dealing) hs.forEach(function(s){ var pr=G.players[s].pr;
    if(pr.length>PR_MAX){ h+='<button type="button" class="bg-btn bg-btn--secondary bg-btn--lg wr-prbtn" data-s="'+s+'" data-open="1">'+(hs.length>1?esc(nm(s))+": ":"")+"Play a prisoner ("+pr.length+")</button>"; return; }
    pr.forEach(function(c){ h+='<button type="button" class="bg-btn bg-btn--secondary bg-btn--lg wr-prbtn" data-s="'+s+'" data-c="'+c+'">'+(hs.length>1?esc(nm(s))+": ":"")+"Play prisoner "+C.pipText(esc(E.shortName(c)))+"</button>"; }); });
  if(pb._h!==h){ pb._h=h; pb.innerHTML=h; pb.querySelectorAll(".wr-prbtn").forEach(function(b){ b.addEventListener("click",function(){ if(b.dataset.open) openPrisoners(+b.dataset.s); else queue({t:"flip",s:+b.dataset.s,pr:+b.dataset.c},b); }); }); }
  if(!G.o.hand&&(!hs.length||G.phase!=="flip"||cfg.auto)) closePrisoners();
  // the status line: what the table waits for
  var bn="Battle "+(G.battle+1);
  if(ui.dealing) st=nm(G.dealer)+" deals "+deckN()+" cards, one at a time. Everyone flips at once: nobody goes first.";
  else if(G.over) st=G.winner>=0?nm(G.winner)+(nm(G.winner)==="You"?" win":" wins")+"!":"The game is a draw.";
  else if(G.phase==="claim"){ var w=G.pend?G.pend.w:-1; st=w>=0&&isHuman(w)&&!cfg.auto?(nm(w)==="You"?"You win":nm(w)+" wins")+" the battle: choose what to take":w>=0?nm(w)+" is collecting the cards":""; }
  else if(busy&&!hs.length) st=G.phase==="war"&&!unseen?"War!":bn;
  else if(hs.length&&!cfg.auto){
    if(G.phase==="war") st="War! "+(nh>1?whoList(hs)+": lay your war cards":"Lay your war cards")+(cs.length?" · "+whoList(cs,"computers")+(cs.length>1?" are":" is")+" laying theirs":"");
    else if(handPhase) st=bn+" · "+(nh>1?nm(hs[0])+", choose a card":"Choose a card to play")+(cs.length?" · waiting for "+whoList(cs,"computers"):"");
    else if(nh>1&&hs.length<nh&&G.need.filter(isHuman).length>hs.length) st=bn+" · "+whoList(hs)+": "+(tv?"press OK to flip":"tap Flip, or your own stack");
    else st=bn+" · "+(tv?"Press OK to flip":nh>1?"Tap Flip, or tap your own stack":"Tap Flip, or tap your stack")+(cs.length?" · "+whoList(cs,"computers")+(cs.length>1?" are":" is")+" ready":"");
  }
  else if(cs.length) st=bn+" · Waiting for "+whoList(cs,"computers");
  else if(hs.length&&cfg.auto) st=bn+" · Auto-play is on";
  else st=bn;
  if(!nh&&!G.over&&!ui.dealing) st=bn+" · Watching "+G.n+" computers";
  var allOut=nh>0&&G.players.every(function(p){ return !p.human||p.out; });
  if(allOut&&!G.over&&!ui.dealing){ st=bn+" · "+(nh>1?"Every player here is out":"You are out")+": the computers play on. The Menu starts a new game."; fb.hidden=true; $("autoBtn").hidden=true; }
  if(ui.dealing) hint="Skip the deal";
  else if(!nh||G.over||allOut) hint="Open the Menu";
  $("wstat").textContent=st; $("hintOk").textContent=hint;
  /* TV: the person's own move disables Flip for a moment, so the focus falls back to the page; when Flip is theirs again (a war to lay
     while the banner and the computers' war cards still play) it comes back at once, so the OK pressed now lays the war cards */
  if(tv&&!fb.hidden&&!fb.disabled&&!setupShown()){ var ae=document.activeElement; if(!ae||ae===document.body||(ae.classList&&ae.classList.contains("bg-app"))) focusTV(fb); }
  chips(); updateSeats(); renderHand(); barTitle();
}
function chips(){
  if(!G) return;
  var c=$("wclock"), b=$("wbattle"), o=G.o, t="";
  if(G.sudden) t="Sudden death";
  else if(o.length==="time"){ var left=Math.max(0,o.limit*60000-playMs()); t=G.bell?"Time is up":"Time left "+fmtTime(left); c.classList.toggle("is-hot",!G.bell&&left<60000); }
  else if(o.length==="battles") t="Battle "+Math.min(G.battle+1,o.limit)+" of "+o.limit;
  else if(o.length==="onepass"){ var pl=0; G.players.forEach(function(p){ pl+=p.pk.length+p.hand.length; }); t="One pass · "+pl+" to play"; }
  if(c.textContent!==t) c.textContent=t;
  /* the counts follow the table, not the engine (which has already settled the battle): while a move plays they hold the shown
     values, and each war banner adds its war, so "2 wars" never gives away a double war before the 4th cards turn */
  if(!busy||ui.shown==null) ui.shown={w:G.stats.wars,b:G.battle};
  var nw=ui.shown.w, nbt=ui.shown.b;
  var wars=nw+(nw===1?" war":" wars"), bt=o.length==="battles"?wars:nbt+(nbt===1?" battle":" battles")+" · "+wars;
  if(b.textContent!==bt) b.textContent=bt;
}
function sync(){
  if(!G) return;
  tr("sync");
  if(!layoutSeats()) return;
  renderCards(); updateSeats(); renderStand(); renderLog(); syncControls();
  tr("sync-done");
}

/* ================= the turn: queue the person's move, pace the computers ================= */
function queue(m,srcEl){
  if(!G||G.over||ui.dealing) return;
  if(intent.some(function(x){ return x.s===m.s; })) return;
  m._src=srcEl&&srcEl.getBoundingClientRect?srcEl.getBoundingClientRect():null;
  intent.push(m);
  if(G.o.hand&&nHumans()>1&&m.t==="pick") viewer=-1;   // hot seat: the hand hides once chosen
  if(needTodo().some(function(s){ return !isHuman(s); })) hurry=true;
  if(!busy) drive();
  else syncControls();
}
$("flipBtn").addEventListener("click",function(){
  if(!G||G.over||ui.dealing) return;
  needTodo().filter(isHuman).forEach(function(s){ queue({t:"flip",s:s}); });
});
function tapSeat(s){
  if(ui.dealing){ skipDeal(); return; }
  if(!G||G.over||!isHuman(s)||G.o.hand) return;
  if(needTodo().indexOf(s)>=0&&(G.phase==="flip"||G.phase==="war")) queue({t:"flip",s:s});
}
function later(my,fn,ms){
  clearTimeout(timer);
  timer=setTimeout(function tick(){
    if(my!==gen||!G||G.over) return;
    if(paused()){ barTitle(); timer=setTimeout(tick,250); return; }
    if(busy){ timer=setTimeout(tick,60); return; }
    fn();
  },Math.max(0,ms));
}
function cpuMove(s){ var m=null; try{ if(W.Brain) m=W.Brain.decide(G,s); }catch(e){ m=null; } return m||E.defaultMove(G,s); }
function autoMove(s){
  if(G.phase==="flip"&&G.o.hand){ var m=suggest(s); if(m&&E.legal(G,s).some(function(x){ return x.t===m.t&&x.c===m.c; })) return m; }
  return E.defaultMove(G,s);
}
function drive(){
  clearTimeout(timer);
  if(!G||busy||ui.dealing){ if(G) syncControls(); return; }
  if(G.over){ syncControls(); finishGame(); return; }
  var my=gen;
  if(paused()){ timer=setTimeout(function(){ if(my===gen) drive(); },300); return; }
  syncControls();
  if(G.phase==="claim"&&G.pend){
    var w=G.pend.w;
    if(isHuman(w)&&!cfg.auto){ openClaim(w); return; }
    later(my,function(){ act(isHuman(w)?E.defaultMove(G,w):cpuMove(w)); },dl(isHuman(w)?420:700)); return;
  }
  var todo=needTodo();
  if(G.n>=BIG&&intent.length>1){   // the big table: "Flip all" for several people plays as one move of the table
    var many=[]; while(intent.length){ var mm=intent.shift(); if(todo.indexOf(mm.s)>=0&&!many.some(function(x){ return x.s===mm.s; })) many.push(mm); }
    if(many.length>1){ actMany(many); return; } if(many.length){ act(many[0]); return; }
  }
  while(intent.length){ var m=intent.shift(); if(todo.indexOf(m.s)>=0){ act(m); return; } }
  var hs=todo.filter(isHuman), cs=todo.filter(function(s){ return !isHuman(s); });
  if(cs.length){
    var first=Object.keys(G.pick).length===0, wait=hurry?dl(110):first?dl(G.phase==="war"?260:420):dl(250);
    if(G.n>=BIG&&cs.length>1&&G.phase!=="claim"){ later(my,function(){ actMany(cs.map(function(s){ return {s:s,cpu:true}; })); },wait); return; }   // the computers flip together
    later(my,function(){ act(cpuMove(cs[0])); },wait); return;
  }
  hurry=false;
  if(!hs.length) return;
  if(cfg.auto){
    if(G.n>=BIG&&hs.length>1&&G.phase!=="claim"){ later(my,function(){ actMany(hs.map(function(s){ return {s:s,auto:true}; })); },dl(G.phase==="war"?360:480)); return; }
    later(my,function(){ act(autoMove(hs[0])); },dl(G.phase==="war"?360:480)); return;
  }
  if(G.o.hand&&G.phase==="flip"&&nHumans()>1&&viewer!==hs[0]){ showHandoff(hs[0]); return; }
  if(G.o.hand&&G.phase==="flip") { viewer=hs[0]; renderHand(); }
  var mc=mainControl(); if(onTV()&&mc&&document.activeElement!==mc&&!(document.activeElement&&$("game").contains(document.activeElement)&&!document.activeElement.disabled)) focusTV(mc);
}
/* one move: apply it, save, then play its events in order; the next move waits for the table */
function planOf(m){
  if(m.t==="flip"&&G.phase==="flip") return {kind:"flip",s:m.s,from:m.pr!=null?"plate":"packet",src:m._src};
  if(m.t==="pick") return {kind:"flip",s:m.s,from:G.players[m.s].pr.indexOf(m.c)>=0?"plate":"hand",src:m._src};
  if(m.t==="flip"&&G.phase==="war"){ var a=E.avail(G,m.s); return {kind:"war",s:m.s,nd:a>0?Math.min(G.down,a-1):0,up:a>0}; }
  return null;
}
function act(m){
  if(!G||G.over||busy||!m) return false;
  var plan=planOf(m), mv={}; for(var k in m) if(k!=="_src"&&k!=="_fb") mv[k]=m[k];
  var r=E.apply(G,mv);
  if(!r.ok){
    // a refused computer move falls back to the engine's own default, so a computer never strands the table
    if(!isHuman(mv.s)&&!m._fb){ var d=E.defaultMove(G,mv.s); if(d){ d._fb=1; return act(d); } }
    if(isHuman(mv.s)) toast(youFix(r.msg));
    syncControls(); setTimeout(drive,0); return false;
  }
  tr("act:"+mv.s); save();
  var my=gen; busy=true; syncControls();
  playBatch(my,plan,r.ev).then(null,function(e){ try{ console.warn("war: animation",e); }catch(x){} }).then(function(){
    if(my!==gen) return;
    busy=false; ui.needSync=false; sync(); drive();
  });
  return true;
}

/* the big table (5-16 players): several seats act as ONE move of the table (the computers flip together, "Flip all", Auto-play), so a
   16-player battle stays quick: each move is applied in turn (the same engine calls as one by one), then the cards fly out together,
   a few ms apart, and the events play once. items: {s, cpu:true} | {s, auto:true} | a person's queued move */
function actMany(items){
  if(!G||G.over||busy||!items||!items.length) return false;
  var plans=[], evs=[], did=0;
  for(var i=0;i<items.length;i++){
    var it=items[i], s=it.s;
    if(G.over||G.phase==="claim"||needTodo().indexOf(s)<0) continue;
    var m=it.cpu?cpuMove(s):it.auto?autoMove(s):it; if(!m) continue;
    var plan=planOf(m), mv={}; for(var k in m) if(k!=="_src"&&k!=="_fb"&&k!=="cpu"&&k!=="auto") mv[k]=m[k];
    var r=E.apply(G,mv);
    if(!r.ok&&!isHuman(s)){ var d=E.defaultMove(G,s); if(d){ plan=planOf(d); r=E.apply(G,d); } }
    if(!r.ok){ if(isHuman(s)) toast(youFix(r.msg)); continue; }
    did++; if(plan) plans.push(plan); evs=evs.concat(r.ev);
    if(r.ev.some(function(x){ return x.e!=="acted"; })) break;   // the table resolved (the last card is in): its events play next
  }
  if(!did){ syncControls(); setTimeout(drive,0); return false; }
  tr("many:"+did); save();
  var my=gen; busy=true; syncControls();
  playMany(my,plans,evs).then(null,function(e){ try{ console.warn("war: animation",e); }catch(x){} }).then(function(){
    if(my!==gen) return;
    busy=false; ui.needSync=false; sync(); drive();
  });
  return true;
}
/* several players knocked out by the same battle (a big table can lose a dozen at once): one "Out of cards" banner for all of them, so the
   show doesn't stop for a banner per player (16 players at Fast: 13 banners took about 8.5 s) */
function mergeOuts(evs){
  var out=[], i, e;
  for(i=0;i<evs.length;i++){ e=evs[i];
    if(e.e==="out"){ var last=out[out.length-1]; if(last&&last.e==="outs"){ last.seats.push(e.s); continue; } out.push({e:"outs",seats:[e.s]}); continue; }
    out.push(e); }
  return out.map(function(x){ return x.e==="outs"&&x.seats.length===1?{e:"out",s:x.seats[0]}:x; });
}
async function playMany(my,plans,evs){
  if(!GEO) layoutSeats(); evs=mergeOuts(evs);
  var st=dl(plans.length>8?22:40);
  await Promise.all(plans.map(function(p,i){ return sleep(i*st).then(function(){ if(my===gen) return animPlan(my,p,i%4!==0); }); }));
  tr("plans"); for(var i=0;i<evs.length;i++){ if(my!==gen) return; tr("ev:"+evs[i].e); await animEvent(my,evs[i]); }
  tr("evs-done");
}

/* ================= the show: every event, paced ================= */
async function playBatch(my,plan,evs){
  if(!GEO) layoutSeats();
  if(plan) await animPlan(my,plan);
  evs=mergeOuts(evs);
  for(var i=0;i<evs.length;i++){ if(my!==gen) return; await animEvent(my,evs[i]); }
}
function source(plan){
  if(plan.src&&GEO) return Object.assign(rectPose(plan.src),{k:plan.src.width/GEO.cw});
  if(plan.from==="plate") return platePose(plan.s);
  return packetPose(plan.s);
}
async function animPlan(my,plan,quiet){
  var s=plan.s;
  if(plan.kind==="flip"){
    var el=newCard(null,false,source(plan)); el._pend=true;
    if(!quiet) Sound.sfx("draw");
    setCount(s,Math.max(0,disp[s]-1));
    await addToSeat(s,el,sp(300));
    return;
  }
  if(plan.kind==="war"){
    /* the CEO's war (2026-10-16): the face-down cards land one at a time at the Game speed, each numbered (1, 2, 3; up to 5 are numbered:
       Război lays up to 11), then the deciding card lands face down marked "4th" and waits for the drum roll (animEvent "reveal") */
    var num=plan.nd<=5&&!(GEO&&GEO.big), gap=dl(plan.nd>5?110:plan.nd>1?300:190);
    for(var i=0;i<plan.nd;i++){
      if(my!==gen) return;
      var b=newCard(null,false,packetPose(s)); setCount(s,Math.max(0,disp[s]-1));
      if(num) b.setAttribute("data-wn",String(i+1));
      addToSeat(s,b,sp(260)); if(!quiet) Sound.sfx("click");
      await sleep(gap);
    }
    if(plan.up){ var u=newCard(null,false,packetPose(s)); u._pend=true; if(num&&plan.nd) u.setAttribute("data-wn",ord(plan.nd+1)); setCount(s,Math.max(0,disp[s]-1)); await addToSeat(s,u,sp(300)); }
    else await sleep(dl(200));
  }
}
function pendingOf(s){ var a=tab[s]||[]; for(var i=a.length-1;i>=0;i--) if(a[i]._pend) return a[i]; return null; }
function lastUp(s){ var a=tab[s]||[]; for(var i=a.length-1;i>=0;i--) if(a[i].classList.contains("is-up")) return a[i]; return null; }
async function banner(title,sub,ms,calm){
  var b=$("wtBanner"); $("wtBannerT").textContent=title; $("wtBannerS").textContent=sub||""; b.classList.toggle("is-calm",!!calm);
  b.classList.add("is-on");
  if(!reduced()&&b.animate){
    try{ await b.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.55)"},{opacity:1,transform:"translate(-50%,-50%) scale(1.07)",offset:.18},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.3},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.85},{opacity:0,transform:"translate(-50%,-50%) scale(.96)"}],{duration:ms,easing:"ease-out"}).finished; }catch(e){ await sleep(ms); }
  } else await sleep(ms);
  b.classList.remove("is-on");
}
function flash(){ var f=$("wtFlash"); if(reduced()||!f.animate) return; try{ f.animate([{opacity:0},{opacity:1,offset:.25},{opacity:0}],{duration:sp(750),easing:"ease-out"}); }catch(e){} }
async function sweep(to,dest,cards,war){
  var els=[]; for(var s in tab) els=els.concat(tab[s]); els=els.concat(carryEls,kittyEls,extra);
  tab={}; carryEls=[]; kittyEls=[]; extra=[];
  var bigT=!!(GEO&&GEO.big);
  if(bigT&&war&&els.length>1&&!reduced()){   // the big table: a war's cards gather into the pot in the centre, then the pot flies to the winner
    $("wtable").classList.add("is-gather"); potLine();
    var g0=Math.max(4,Math.round(dl(300)/els.length));
    await Promise.all(els.map(function(el,i){ el.classList.remove("is-win","is-lose"); el.style.zIndex=++zTop; return move(el,potPose(i),sp(300),{delay:i*g0}); }));
    Sound.sfx("cannon"); await sleep(dl(220));
  }
  Sound.sfx("slide");
  var pose=dest==="won"?wonPose(to):packetPose(to), ps=[], st=dl(els.length>12?28:45);
  if(bigT) st=Math.min(st,Math.max(4,Math.round(dl(480)/els.length)));   // a 16-player pot still lands in about half a second
  els.forEach(function(el,i){ el.style.zIndex=++zTop; ps.push(move(el,{x:pose.x,y:pose.y,r:0,k:pose.k},sp(400),{delay:i*st}).then(function(){ el.remove(); })); });
  await Promise.all(ps);
  $("wtable").classList.remove("is-gather");
  setCount(to,disp[to]+cards,true);
}
function wonPose(s){ var p=packetPose(s); return {x:p.x+GEO.pw*.35,y:p.y-GEO.ph*.1,r:8,k:p.k}; }
async function animEvent(my,e){
  var s, el, i;
  switch(e.e){
    case "reveal":{
      var flips=[], war=e.w>0;
      if(war){   // the drum roll before the deciding flip: the waiting cards beat twice (a finite transform pulse), then all turn at once
        if(!reduced()) e.cards.forEach(function(x){ var pe=pendingOf(x.s); if(!pe||!pe._p||!pe.animate) return; var p0=pe._p, z={x:p0.x,y:p0.y-(GEO?GEO.ch*.04:3),r:0,k:(p0.k==null?1:p0.k)*1.08};
          try{ pe.animate([{transform:T(p0)},{transform:T(z),offset:.5},{transform:T(p0)}],{duration:dl(280),iterations:2,easing:"ease-in-out"}); }catch(er){} });
        await sleep(dl(600));
      }
      e.cards.forEach(function(x){
        if(war&&x.held){ var hu=lastUp(x.s); if(hu) hu.classList.remove("is-lose"); return; }
        el=pendingOf(x.s);
        if(!el){ el=newCard(null,false,packetPose(x.s)); addToSeat(x.s,el,0); }
        if(GEO&&GEO.big) el.style.zIndex=++zTop;
        flips.push(flipUp(el,x.c,war?sp(820):sp(430),war));
      });
      Sound.sfx(war?"dice":"card");
      await Promise.all(flips);
      e.cards.forEach(function(x){ layoutSeat(x.s,sp(160)); });
      await sleep(dl(war?260:120));
      return;
    }
    case "war":{
      var sub;
      e.tied.forEach(function(x){ var u=lastUp(x); if(u) u.classList.add("is-win"); });
      ui.fight={f:e.seats.slice(),t:e.tied.slice()}; updateSeats(); potLine();   // big table: who is in the war (tag "War"; the tied "Tied")
      sub=e.forced?(G.o.twos?"A 2 declares war":"A joker declares war"):whoList(e.tied)+" tie"+(e.n>1?" again":"")+(e.seats.length>e.tied.length&&big()?" · "+whoList(e.seats)+" fight":"");
      sub+=e.down?": "+e.down+" face down, then the "+ord(e.down+1)+" card decides":": the next cards decide";
      if(e.n>1) for(s in tab) tab[s].forEach(function(x){ x.removeAttribute("data-wn"); });   // a new war: only its own cards are numbered
      if(ui.shown) ui.shown.w++; syncControls();   // the war is on the table now: the button and the status may say so (syncControls ends with chips)
      Sound.sfx("cannon"); flash();
      await banner(warWord(e.n),sub,dl(1500));
      for(s in tab) tab[s].forEach(function(x){ x.classList.remove("is-win"); });
      return;
    }
    case "short": await banner("Out of cards",whoList(e.seats)+(e.seats.length>1?" can't finish the war and lose":" can't finish the war and loses"),dl(1500)); return;
    case "underdog": Sound.sfx("bump"); await banner("Underdog!",nm(e.s)+" has a Jack face down and steals the war from "+nm(e.from),dl(1600)); return;
    case "carry":{
      var all=[]; for(s in tab) all=all.concat(tab[s]); tab={}; ui.fight=null;
      var base=carryEls.length, ps=[];
      all.forEach(function(x,j){ x.classList.remove("is-win","is-lose"); carryEls.push(x); ps.push(move(x,carryPose(base+j),sp(380),{delay:j*dl(40),front:true})); });
      await Promise.all(ps); await banner("A tie","The "+e.n+" cards go to the next battle's winner",dl(1100),true); return;
    }
    case "deadlock":{
      var dd=[]; for(s in tab) dd=dd.concat(tab[s]); tab={};
      ui.fight=null;
      await banner("Deadlock",whoList(e.seats)+" tie with their last cards",dl(1500),true);
      await Promise.all(dd.map(function(x,j){ return move(x,midPose(j%3),sp(380),{delay:j*dl(30)}).then(function(){ x.remove(); }); }));
      return;
    }
    case "kitty": kittyEls.forEach(function(x){ x.style.zIndex=++zTop; }); return;
    case "pay":{
      el=newCard(null,false,packetPose(e.s)); extra.push(el); setCount(e.s,Math.max(0,disp[e.s]-1));
      var tp=slotPose(e.to,0,1,true); await move(el,{x:tp.x+GEO.cw*.25,y:tp.y,r:6,k:1},sp(320),{lift:true}); return;
    }
    case "win":{
      for(s in tab){ var u=lastUp(+s); if(u) u.classList.toggle("is-win",+s===e.s), u.classList.toggle("is-lose",+s!==e.s); }
      seatEls.forEach(function(se,q){ se.classList.toggle("is-win",q===e.s); });
      ui.winWar=!!e.war;
      if(e.war) Sound.sfx("conquer");
      await sleep(dl(e.war?950:600));
      return;
    }
    case "claim": return;
    case "prisoner":{
      var src=null, own=-1, li=G.last&&G.last.cards?G.last.cards.indexOf(e.c):-1; if(li>=0) own=G.last.from[li];
      for(s in tab){ if(+s===e.s) continue; var a=tab[s]; for(i=0;i<a.length;i++) if(a[i].getAttribute("data-id")===String(e.c)){ src=a[i]; a.splice(i,1); break; } if(src) break; }
      if(!src) for(s in tab){ if(+s===e.s||(own>=0&&+s!==own)) continue; var a2=tab[s]; for(i=0;i<a2.length;i++) if(!a2[i].classList.contains("is-up")){ src=a2[i]; a2.splice(i,1); break; } if(src) break; }
      if(!src){ seatEls[e.s].classList.add("is-win"); return; }
      src.classList.remove("is-win","is-lose"); if(!src.classList.contains("is-up")) await flipUp(src,e.c,sp(360),false);
      await move(src,platePose(e.s),sp(420),{lift:true,front:true}); src.remove();
      return;
    }
    case "collect":{
      await sweep(e.s,e.to,e.cards.length,!!ui.winWar); ui.winWar=false;
      ui.fight=null; updateSeats(); potLine();
      seatEls.forEach(function(se){ se.classList.remove("is-win"); });
      await sleep(dl(170));
      return;
    }
    case "out": Sound.sfx("lose"); seatEls[e.s].classList.add("is-out"); setCount(e.s,0); renderStand(); await banner("Out of cards",nm(e.s)+(nm(e.s)==="You"?" are":" is")+" out of the game",dl(1300),true); return;
    case "outs": Sound.sfx("lose"); e.seats.forEach(function(q){ seatEls[q].classList.add("is-out"); setCount(q,0); }); renderStand(); await banner("Out of cards",whoList(e.seats)+" are out of the game",dl(1300),true); return;
    case "sudden": Sound.sfx("bell"); await banner("Sudden death",whoList(e.seats)+" are tied: the next battle that breaks the tie wins",dl(1700),true); return;
    case "over": return;
    default: return;
  }
}

/* ================= the deal: the opening show (War has no first player) ================= */
function skipDeal(){ if(ui.dealing) ui.dealSkip=true; }
async function dealShow(my){
  if(!G) return;
  await sleep(30);   // the table is laid out on screen first
  if(my!==gen) return;
  ui.dealing=true; ui.dealSkip=false;
  layoutSeats(); renderCards(); disp=G.players.map(function(){ return 0; }); G.players.forEach(function(p,s){ setCount(s,0); }); renderStand(); syncControls();
  var deck=newCard(null,false,midPose(0)), seq=G.dealSeq.slice(), flights=[], left=seq.length;
  var deckLbl=$("wtMidNote");
  if(!reduced()){
    for(var i=0;i<seq.length;i++){
      if(my!==gen) return;
      if(ui.dealSkip) break;
      var s=seq[i], el=newCard(null,false,midPose(0));
      (function(el,s){ flights.push(move(el,s>=0?packetPose(s):midPose(1),sp(300)).then(function(){ el.remove(); if(s>=0&&!ui.dealSkip&&my===gen) setCount(s,disp[s]+1); })); })(el,s);
      left--; if(left===0) deck.remove();
      if(i%(seq.length>60?8:4)===0) Sound.sfx("deal");
      await sleep(dl(seq.length>60?Math.max(10,Math.round(2400/seq.length)):seq.length>40?40:60));   // more decks: the whole deal still takes about 2.5 s
    }
    await Promise.all(flights);
  } else await sleep(dl(700));
  if(my!==gen) return;
  if(deck.parentNode) deck.remove();
  $("wtCards").querySelectorAll(".wcard").forEach(function(x){ x.remove(); });
  ui.dealing=false; ui.dealSkip=false; deckLbl.textContent="";
  sync(); clockOn(); save();
  focusTV(mainControl());
  drive();
}

/* ================= sheets: the spoils (prisoners, arranging) and the hot-seat hand-off ================= */
function sheetOpen(el,o){ var B=BG(); el.classList.add("show"); if(luxe()&&!B.sheet.isOpen(el)) B.sheet.open(el,o); }
function sheetClose(el){ var B=BG(); el.classList.remove("show"); if(B&&B.sheet&&B.sheet.isOpen(el)) B.sheet.close(el); }
function closeSheets(){ sheetClose($("claimBox")); sheetClose($("handoff")); closePrisoners(); }
/* Prisoners of War: with more than PR_MAX prisoners a person picks one from a sheet (strongest first) instead of a row of buttons */
var PR_MAX=2;
function closePrisoners(){ var el=$("prBox"); if(el&&el.classList.contains("show")) sheetClose(el); }
function openPrisoners(s){
  if(!G||G.over||!G.players[s]) return;
  var p=G.players[s], hand=!!G.o.hand, list=p.pr.slice().sort(function(a,b){ return E.strength(G,b)-E.strength(G,a); }); if(!list.length) return;
  $("prSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="wr-shead"><span class="bg-eyebrow bg-eyebrow--accent">Prisoners of War · house rule</span><h2 class="bg-sheet__title" id="prTitle">'+(nHumans()>1?esc(nm(s))+": play":"Play")+' a prisoner?</h2><p class="bg-sheet__sub">It plays instead of your '+(hand?"hand card":"top card")+'. If it loses, you also pay the card you would have played.</p></div><div class="bg-sheet__options">'+
    list.map(function(c,i){ return optHTML("p"+c,"Play the "+C.pipText(esc(E.cardName(c))),"","Beats about "+pct(c)+"% of the deck",i===0); }).join("")+
    optHTML("none",hand?"Back to my hand":"Not now","",hand?"Choose a card from your hand":"Flip your top card as usual",false)+"</div>";
  sheetOpen($("prBox"),{focus:".bg-sheet__option"});
  $("prBox").querySelectorAll(".bg-sheet__option").forEach(function(b){ b.addEventListener("click",function(){
    var o=b.getAttribute("data-o"); closePrisoners();
    if(o==="none"){ focusTV(mainControl()); return; }
    var c=+o.slice(1); queue(hand?{t:"pick",s:s,c:c}:{t:"flip",s:s,pr:c},null);
  }); });
}
function optHTML(id,label,desc,detail,best){ return '<button type="button" class="bg-sheet__option'+(best?" is-best":"")+'" data-o="'+esc(id)+'"><span class="bg-sheet__text"><span class="bg-sheet__label">'+label+(best?' <span class="bg-tag bg-tag--ok">best</span>':"")+'</span>'+(desc?'<span class="bg-sheet__desc">'+desc+"</span>":"")+(detail?'<span class="bg-sheet__detail">'+detail+"</span>":"")+'</span>'+icon("chevron")+"</button>"; }
function pct(c){ return Math.round(100*E.strength(G,c)); }
function orderOf(kind,rest){
  var a=rest.slice().sort(function(x,y){ return E.strength(G,y)-E.strength(G,x); });
  if(kind==="weak") return a.reverse();
  if(kind==="spread"){ var o=[], i=0, j=a.length-1; while(i<=j){ o.push(a[i++]); if(i<=j) o.push(a[j--]); } return o; }
  return a;
}
function openClaim(w,step){
  var pd=G.pend; if(!pd) return;
  var key=gen+":"+G.battle+":"+w;
  if(!step&&ui.claimKey===key&&$("claimBox").classList.contains("show")) return;   // already asking
  if(ui.claimKey!==key){ ui.claimKey=key; ui.claimPr=undefined; }
  var el=$("claimBox"), h, who=nm(w)==="You"?"You":nm(w);
  if(pd.prOk.length&&ui.claimPr===undefined){
    var bestC=pd.prOk.slice().sort(function(a,b){ return E.strength(G,b)-E.strength(G,a); })[0];
    h='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="wr-shead"><span class="bg-eyebrow bg-eyebrow--accent">Prisoners of War · house rule</span><h2 class="bg-sheet__title" id="claimTitle">'+esc(who)+(who==="You"?" win":" wins")+(pd.war?" the war":" the battle")+': take a prisoner?</h2><p class="bg-sheet__sub">Take one of the other '+(G.n>2?"players'":"player's")+' cards. A prisoner stays face up beside your stack: play it in a later battle instead of your top card; if it loses, you also pay the card you would have played.</p></div><div class="bg-sheet__options">'+
      pd.prOk.map(function(c){ return optHTML("p"+c,"Take the "+C.pipText(esc(E.cardName(c))),"","Beats about "+pct(c)+"% of the deck",c===bestC); }).join("")+
      optHTML("none","No prisoner","All "+pd.pot.length+" cards go under your stack","",false)+"</div>";
  } else {
    var rest=pd.pot.slice(); if(ui.claimPr!=null) rest.splice(rest.indexOf(ui.claimPr),1);
    if(!G.o.arrange||rest.length<2){ finishClaim(w,null); return; }
    var lst=function(k){ return C.pipText(esc(orderOf(k,rest).map(E.shortName).join(", "))); };
    h='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="wr-shead"><span class="bg-eyebrow bg-eyebrow--accent">Winner arranges · house rule</span><h2 class="bg-sheet__title" id="claimTitle">Arrange the '+rest.length+' cards you won</h2><p class="bg-sheet__sub">They go under your stack in this order: the first comes back to you first.</p></div><div class="bg-sheet__options">'+
      optHTML("spread","Spread them out","Strong, weak, strong: a steady supply of strong cards",lst("spread"),true)+
      optHTML("strong","Strongest first","Your best cards come back soonest",lst("strong"),false)+
      optHTML("weak","Weakest first","Save the strong cards for later",lst("weak"),false)+
      optHTML("shuffle","Shuffle them","A random order, as in the official game","",false)+"</div>";
  }
  $("claimSheet").innerHTML=h;
  var B=BG(); if(luxe()&&B.sheet.isOpen(el)) sheetClose(el);
  sheetOpen(el,{dismissible:false,focus:".bg-sheet__option"});
  el.querySelectorAll(".bg-sheet__option").forEach(function(b){ b.addEventListener("click",function(){
    var o=b.getAttribute("data-o");
    if(o==="none"){ ui.claimPr=null; openClaim(w,true); return; }
    if(o.charAt(0)==="p"){ ui.claimPr=+o.slice(1); openClaim(w,true); return; }
    var rest2=pd.pot.slice(); if(ui.claimPr!=null) rest2.splice(rest2.indexOf(ui.claimPr),1);
    finishClaim(w,o==="shuffle"?null:orderOf(o,rest2));
  }); });
  hintSync();
}
function finishClaim(w,order){
  sheetClose($("claimBox"));
  var m={t:"claim",s:w,pr:ui.claimPr==null?null:ui.claimPr}; if(order) m.order=order;
  ui.claimPr=undefined; ui.claimKey="";
  act(m); hintSync();
}
function showHandoff(s){
  var key=gen+":"+G.battle+":"+s;
  if(ui.hoKey===key&&$("handoff").classList.contains("show")) return;
  ui.hoKey=key;
  var tv=onTV(), p=G.players[s];
  $("handoffSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="wr-ho"><span class="bg-eyebrow bg-eyebrow--accent">Battle '+(G.battle+1)+' · hot seat</span>'+
    '<h2 class="bg-sheet__title" id="hoTitle">Pass the '+(tv?"remote":"phone")+"</h2>"+
    '<p class="wr-ho__to"><span class="bg-token" data-seat="'+seatNo(s)+'" aria-hidden="true">'+esc(initials(p.name))+"</span><span>to <b>"+esc(p.name)+"</b></span></p>"+
    '<button class="bg-btn bg-btn--primary bg-btn--lg bg-btn--block" id="hoBtn" type="button" data-autofocus>I\'m '+esc(p.name)+": show my hand</button></div>";
  sheetOpen($("handoff"),{dismissible:false,focus:"#hoBtn"});
  $("hoBtn").addEventListener("click",function(){ viewer=s; ui.handKey=""; sheetClose($("handoff")); renderHand(); syncControls(); var hc=$("whand").querySelector(".wr-hcard:not([disabled])"); if(hc) focusIn(hc); hintSync(); });
  hintSync();
}
function hintSync(){
  var B=BG(), t=B&&B.sheet&&B.sheet.top?B.sheet.top():null, h=document.querySelector(".wr-hints");
  // a sheet BGUI closed itself (Back on the prisoner sheet) loses the page's "show" mark too
  if(luxe()) ["claimBox","handoff","prBox"].forEach(function(id){ var el=$(id); if(el&&el.classList.contains("show")&&!B.sheet.isOpen(el)) el.classList.remove("show"); });
  if(h) h.classList.toggle("is-held",!!t&&(t.id==="handoff"||t.id==="claimBox"));
}
document.addEventListener("bgui:sheet",hintSync);

/* ================= the end: Victory with real numbers and the sorted standings ================= */
function finishGame(){
  if(ui.finished===gen) return; ui.finished=gen;
  try{ if(W.Brain&&W.Brain.finish) W.Brain.finish(G); }catch(e){}
  Saves.del(GAME,"auto"); clockOff();
  var hw=G.winner>=0&&isHuman(G.winner);
  Sound.sfx(hw||!nHumans()?"win":G.winner<0?"bell":"lose");
  syncControls(); renderStand();
  var my=gen;
  setTimeout(function(){ if(my!==gen) return; if(setupShown()){ menuResult(); return; } openWin(); },dl(900));
}
function whyText(){
  var w=G.winner, c=w>=0?E.total(G,w):0;
  if(w<0){ var d=(G.draw||[]).map(nm); return G.why==="deadlock"?listNames(d)+" tied with their last cards: a draw.":listNames(d)+" finish level"+(d.length&&G.draw[0]!=null?" with "+E.total(G,G.draw[0])+" cards each":"")+": a draw."; }
  var who=nm(w), v=who==="You"?"":"s", mid=who==="You"?"you":who;
  if(G.why==="all") return who+" win"+v+" every card ("+c+").";
  if(G.why==="joker") return who+" capture"+v+" the other joker and win"+v+".";
  if(G.why==="sudden") return who+" win"+v+" the sudden-death battle with "+c+" cards.";
  if(G.why==="onepass") return "One pass through the deck: "+mid+" won the most cards ("+c+").";
  if(G.why==="battles") return "After "+plural(G.battle,"battle")+", "+mid+" "+(who==="You"?"have":"has")+" the most cards ("+c+").";
  if(G.why==="time") return "At the bell, "+mid+" "+(who==="You"?"have":"has")+" the most cards ("+c+").";
  return who+" "+(who==="You"?"have":"has")+" the most cards ("+c+").";
}
function openWin(){
  var B=BG(); if(!B||!B.win||!G||!G.over||!luxe()) return;
  ui.winShown=gen; ui.result=false; clockOff();
  var w=G.winner, ms=playMs(), min=Math.round(ms/60000), single=nHumans()===1;
  $("winEyebrow").textContent="Game over · "+(min<1?"under a minute":min===1?"1 minute":min+" minutes");
  $("winTitle").textContent=w<0?"A draw":(isHuman(w)&&single)?"Victory":nm(w)+(nm(w)==="You"?" win":" wins");
  var ac=w>=0?G.stats.aces[w]:0;
  var chain=G.stats.chain, cw2=chain>=4?chain+" wars in a row":chain===3?"a triple war":chain===2?"a double war":"";
  $("winSub").innerHTML=esc(whyText())+(w>=0&&ac?" "+esc(nm(w)==="You"?"You":nm(w))+" captured "+plural(ac,"Ace")+".":"")+(cw2?" The longest war was "+cw2+".":"")+(G.stats.lead?" The lead changed "+(G.stats.lead===1?"once":G.stats.lead+" times")+".":"");
  var rows=E.standings(G);
  $("winList").innerHTML=rows.map(function(r){ return '<li class="'+(r.place===1&&w>=0?"is-lead":"")+'"><span class="wr-fr">'+r.place+'</span><span class="bg-token" data-seat="'+seatNo(r.s)+'" aria-hidden="true">'+esc(initials(r.name))+'</span><span class="wr-fn">'+esc(r.name)+(r.out?" · out":"")+'</span><span class="wr-fc">'+r.count+'<span class="wr-fcu"> '+(r.count===1?"card":"cards")+"</span></span></li>"; }).join("");
  $("winStats").innerHTML='<li class="bg-stat"><b>'+G.battle+"</b><span>"+(G.battle===1?"battle":"battles")+'</span></li><li class="bg-stat"><b>'+G.stats.wars+"</b><span>"+(G.stats.wars===1?"war":"wars")+"</span></li>"+
    '<li class="bg-stat"><b>'+G.stats.pot+"</b><span>biggest pot</span></li>"+'<li class="bg-stat"><b>'+fmtTime(ms)+"</b><span>time</span></li>";
  $("winList").classList.toggle("is-grid",rows.length>2); $("winList").classList.toggle("is-many",rows.length>8); $("winBox").classList.toggle("wr-many",rows.length>8);
  closeSheets();
  B.win.open($("winBox"),{focus:"#winAgain"});
  if(B.celebrate&&(w<0||isHuman(w)||!nHumans())) B.celebrate();
  barTitle();
}
function closeWin(){ var B=BG(); if(B&&B.win&&B.win.isOpen()) B.win.close($("winBox")); }
$("winAgain").addEventListener("click",function(){ closeWin(); $("startBtn").click(); });
$("winMenu").addEventListener("click",function(){ closeWin(); $("menuBtn").click(); });
document.addEventListener("keydown",function(e){
  var B=BG(); if(!B||!B.win||!B.win.isOpen()) return;
  if(e.key==="Escape"||e.key==="GoBack"||e.key==="BrowserBack"||e.keyCode===27||e.keyCode===4){ e.preventDefault(); closeWin(); }
});

/* ================= keys, the remote's Back, the clock ================= */
// the deal show takes OK / Enter / Space / Back (one press skips it); a tap on the table does the same
window.addEventListener("keydown",function(e){
  if(!ui.dealing||setupShown()) return;
  var k=e.key;
  if(k==="Enter"||k===" "||k==="Escape"||k==="GoBack"||k==="BrowserBack"||e.keyCode===13||e.keyCode===32||e.keyCode===27||e.keyCode===4||e.keyCode===23){ e.preventDefault(); e.stopPropagation(); skipDeal(); }
},true);
$("wtable").addEventListener("click",function(){ if(ui.dealing) skipDeal(); });
function backStep(){
  if(ui.dealing&&!setupShown()){ skipDeal(); return "deal"; }
  if(!setupShown()){ $("menuBtn").click(); return "menu"; }
  if(G&&$("resumeBtn").style.display!=="none"){ $("resumeBtn").click(); return "resume"; }
  return false;
}
function tick(){
  if(!G||G.over||setupShown()||ui.dealing) return;
  chips();
  if(G.o.length==="time"&&!G.bell&&playMs()>=G.o.limit*60000){
    var ev=E.ringBell(G); save(); Sound.sfx("bell");
    bellBanner(gen);
    renderLog(); chips();
    if(ev.length&&G.over&&!busy) drive();
  }
}
setInterval(tick,1000);
/* the bell: a calm banner on the table once the table is free (a toast would cover the table) */
async function bellBanner(my){ for(var k=0;k<80&&busy&&my===gen;k++) await sleep(100); if(my!==gen||!G) return; await banner("Time!",G.over?"The most cards wins":"The battle in play finishes, then the most cards wins",dl(1500),true); }
document.addEventListener("visibilitychange",function(){ if(document.hidden) clockOff(); else clockOn(); });
var rsz=0;
window.addEventListener("resize",function(){ clearTimeout(rsz); rsz=setTimeout(function(){ if(!G||setupShown()) return; if(busy||ui.dealing) ui.needSync=true; else sync(); },120); });

document.addEventListener("DOMContentLoaded",function(){
  register();
  mountNames(); drawSeats();
  var B=BG();
  if(B&&B.stage) B.stage(GAME,{frames:"#wtable"}); else Skins.apply(GAME);
  if(B&&B.back) B.back.on(backStep);
  else window.__tvBack=function(){
    if(window.Sound&&Sound.panelOpen&&Sound.panelOpen()){ Sound.closePanel(); return "panel"; }
    var r=backStep(); if(r) return r;
    location.href=$("homeBtn").getAttribute("href"); return "hub";
  };
  if(!B||!B.effects) return;
  document.documentElement.classList.add("wr-luxe");
  if(B.icon) document.querySelectorAll("[data-icon]").forEach(function(el){ if(!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin",B.icon(el.getAttribute("data-icon"))); });
  var hub=hubHref(); ["homeBtn","backHub","winHome"].forEach(function(id){ var a=$(id); if(a) a.setAttribute("href",hub); });
  saveBar.refresh(); deviceCopy();
  if(ui.cont&&!G) focusTV($("resumeBtn"));   // TV: a saved game waits on Continue
  document.addEventListener("bgui:tv",function(){ deviceCopy(); syncStart(); if(G&&!setupShown()&&!busy&&!ui.dealing) sync(); });
});

C.injectCSS();
Sound.mountButton(); Sound.music(GAME);
deviceCopy(); drawSetup(); saveBar.refresh(); showSetup(true); contOffer();
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(function(){}); }
window.__war={get G(){ return G; },cfg:cfg,act:act,drive:drive,startGame:startGame,skipDeal:skipDeal,queue:queue,sync:function(){ if(!busy&&!ui.dealing) sync(); },
  addMs:function(ms){ stats.ms+=+ms||0; },   // tests: move the play clock on (the time-limit bell)
  state:function(){ return {busy:busy,dealing:ui.dealing,intent:intent.length,viewer:viewer,gen:gen,ms:playMs(),winShown:ui.winShown,finished:ui.finished}; }};
})();
