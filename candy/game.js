/* CANDY LAND — the page controller (setup, the board, the cards, the pacing of every draw and move, saves, the Menu, TV, Victory).
   The rules live in engine.js (pure, no DOM; Party-ready: snapshot(G, seat)), the computers' characters in brain.js and the board and
   card art in board.js; this file only drives and shows them. Rules and sources: BG_audit/games/candy/RULES.md.
   - Who goes first (RULES.md 2.2): every edition says "the youngest player goes first; play passes to the left". There is no roll or
     draw, so nothing is invented: setup asks which person is the youngest (computers have no age), the engine starts that seat, and
     BGUI.firstPlayer shows the playing order it gives (one card per player, the youngest's card says 1st). Nobody picked: the table
     decides [HASPB], so the first seat starts, and the show and the log say so.
   - A real shuffled 64-card deck (the engine's): each card turns over big in front of the board, then flies to the discard pile (or,
     with "draw two", into the hand of two); a reshuffle sends the discards back to the draw pile when it runs out.
   - The CEO's rule: a mover hops through EVERY square it passes, one hop per square at the Game speed pace (a long picture-card trip
     ramps the pace up, but every square is still stepped, never under 120 ms); THEN a shortcut plays as its own glide along the ribbon
     or across the bridge, and a sticky / licorice square gets its own banner. Moves are one-shot Web Animations on transform only;
     reduced motion still steps square by square.
   - Candy Land has no decisions (RULES.md 6): with every rule set but "draw two" the brain only draws. With "draw two" a person picks
     one of two cards (each shows where it leads; the best is marked) and the computers use brain.js.
   - The person's Draw is queued at once and played the moment the board is free, so a tap is never lost. The engine's events
     (apply().ev) play in order; after each batch the board and piles are drawn again from G, so a reload or Continue shows the same
     table. Saves after every action (Saves.auto "candy"). */
(function(){
"use strict";
var CY=window.Candy, E=CY.Engine, BD=CY.Board;
var $=function(id){ return document.getElementById(id); };
var GAME="candy";
/* Game speed (SPEED-TASK.md): every computer delay and every move animation x speedFactor(); animations never under 120 ms */
function speedFactor(){ return ({slow:1.75, fast:0.5})[window.bgGameSpeed] || 1 }
function sp(ms){ return Math.max(120,Math.round(ms*speedFactor())); }
function dl(ms){ return Math.round(ms*speedFactor()); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,Math.max(0,ms)); }); }
function normSpeed(v){ return v==="slow"||v==="fast"?v:"medium"; }
function normSkill(v){ return v==="easy"||v==="hard"?v:"normal"; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function BG(){ return window.BGUI||null; }
function luxe(){ var B=BG(); return !!(B&&B.sheet&&B.effects&&document.documentElement.classList.contains("cd-luxe")); }
function onTV(){ return document.documentElement.hasAttribute("data-tv"); }
function icon(n){ var B=BG(); return B&&B.icon?B.icon(n):""; }
function reduced(){ var B=BG(); return document.documentElement.getAttribute("data-motion")==="reduce"||!!(B&&B.reducedMotion&&B.reducedMotion()); }
function calm(){ var B=BG(); return reduced()||!!(B&&B.effects&&B.effects.get&&B.effects.get()==="reduced")||document.hidden; }   // Reduce effects: no lift, no glide, no flight
function remPx(){ return parseFloat(getComputedStyle(document.documentElement).fontSize)||16; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function initials(name){ var m=/^(You|Player|CPU)\s*(\d*)$/.exec(String(name)); return m?(m[1]==="You"?"Y":m[1].charAt(0)+m[2]):String(name).charAt(0).toUpperCase(); }
function plural(n,w){ return n+" "+w+(n===1?"":"s"); }
var COLN=["Red","Blue","Green","Yellow"];
var CN=E.CNAME;

/* ================= registration: the new-game hooks (commit ae99bbe) ================= */
var GLYPHS={
  gumdrop:'<path d="M5 19c0-8 3.2-13 7-13s7 5 7 13z"/><path d="M8.5 11.5c.6-1.6 1.6-2.6 2.6-3"/><path d="M4 19h16"/>',
  lolly:'<circle cx="12" cy="9" r="6"/><path d="M12 15v7"/><path d="M12 9a1.4 1.4 0 1 1 1.4 1.4A3 3 0 1 1 9 8.6a4.4 4.4 0 1 1 6.6 3.4"/>',
  wrapped:'<path d="M8 8.5h8a3.5 3.5 0 0 1 0 7H8a3.5 3.5 0 0 1 0-7z"/><path d="M8 9.5L3 6v12l5-3.5M16 9.5L21 6v12l-5-3.5"/>',
  spire:'<path d="M12 2.5l1.2 2.6 2.8.4-2 2 .5 2.8-2.5-1.3-2.5 1.3.5-2.8-2-2 2.8-.4z"/><path d="M9 12h6l2 9H7z"/><path d="M8.2 16h7.6"/>',
  gingerbread:'<circle cx="12" cy="5.5" r="3"/><path d="M9 9.5h6l4 2.5-1 2-3-1.2V16l2 5h-2.6L12 17.5 10.6 21H8l2-5v-3.2L7 14l-1-2z"/>'
};
var registered=false;
function register(){
  var B=BG(); if(!B||registered) return; registered=true;
  if(B.icon&&B.icon.add){ Object.keys(GLYPHS).forEach(function(k){ B.icon.add(k,GLYPHS[k]); }); if(B.icon.seal&&B.icon.seal.set) B.icon.seal.set(GAME,"lolly"); }
  if(B.stage&&B.stage.register) B.stage.register(GAME,{motifs:["lolly","gumdrop","wrapped","spire","gingerbread"]});
}
/* the music: a sweet, swinging major style with its own 10 original song titles (Sound.addStyle, sound.js) */
if(window.Sound&&Sound.addStyle&&!(Sound.hasStyle&&Sound.hasStyle(GAME))){
  Sound.addStyle(GAME,{ scales:["major","major","mixo","major"], bpm:[100,128], swing:0.18, sev:true, leadVol:0.085, waves:["triangle","sine","triangle"], bassKind:"walk",
    progs:[[0,5,3,4],[0,3,4,0],[0,2,3,4],[0,5,1,4],[0,3,1,4],[0,4,5,3],[0,1,3,4],[0,5,3,3]],
    bridge:[[3,4,2,5],[5,3,4,4],[3,0,4,4],[1,4,0,5]],
    rhythms:[[1,0,1,1,0,1,0,1],[1,1,0,1,1,0,1,0],[1,0,0,1,0,1,1,0],[1,0,1,0,1,1,0,1]],
    chordSteps:[0,2,4],
    drums:[{kick:[1,0,0,0,1,0,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.05,hat:[1,0,1,0,1,0,1,1],hv:0.03},{kick:[1,0,0,1,0,0,1,0],snare:[0,0,1,0,0,1,0,0],sv:0.06,hat:[1,1,1,1,1,1,1,1],hv:0.025},{kick:[1,0,1,0,0,1,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.05,hat:[0,1,0,1,0,1,0,1],hv:0.03}],
    titles:["Gumdrop Gallop","The Sugarspire Waltz","Ribbon Candy Rag","Licorice Shuffle","Marshmallow Moonrise","Draw Me a Double","Caramel Bog Blues","Over the Wafer Bridge","Sprinkles After Midnight","Six Colours Home"] },
    {wave:"triangle",reg:1});
}

/* ================= state ================= */
var cfg={version:"v2004",over:{},humans:1,cpus:1,speed:"medium",skill:"normal",colors:[1,2,3,4],youngest:0};
var G=null, gen=0, timer=null, busy=false, intent=false, disp=[], tokEls=[], standEls=[];
var dk={n:64,top:null,dn:0,hand:[],aside:0,landed:{}};
var ui={fpShow:false,winShown:-1,result:false,rulesOpen:false,finished:-1,needSync:false,lastTurn:-1,warnTurn:-1,cont:false,say:null,mover:-1,status:"",pickBusy:false};
var stats={ms:0}, clock0=0;

function nPlayers(){ return cfg.humans+cfg.cpus; }
function youngestSeat(){ return cfg.humans>0&&cfg.youngest>=0&&cfg.youngest<cfg.humans?cfg.youngest:-1; }
function rawOpts(){ var x={}; for(var k in cfg.over) x[k]=cfg.over[k]; x.youngest=youngestSeat(); return E.versionOpts(cfg.version,x); }
function curOpts(){ return E.normalize(rawOpts(),nPlayers()); }
function versionOf(id){ return E.versionOf(id)||E.VERSIONS[0]; }
function isHuman(s){ return !!(G&&G.players[s]&&G.players[s].human); }
function nHumans(){ return G?G.players.filter(function(p){ return p.human; }).length:0; }
function liveGame(){ return !!(G&&!G.over); }
function setupShown(){ return $("setup").style.display!=="none"; }
function paused(){ return liveGame()&&setupShown(); }
function nm(s){ return G.players[s].name; }
function seatNo(s){ return G&&G.players[s]&&+G.players[s].color?+G.players[s].color:s+1; }
function isYou(s){ return nm(s)==="You"; }
function vb(s,v){ if(!isYou(s)) return v; return ({draws:"draw",is:"are",has:"have",needs:"need",loses:"lose",reaches:"reach",wins:"win",takes:"take",plays:"play",goes:"go",glides:"glide",crosses:"cross",hops:"hop",stays:"stay",looks:"look"})[v]||v; }
function board(){ return G?E.BOARDS[G.bd]:null; }

/* the play clock (the Victory's time): it runs while the board is on screen */
function clockOn(){ clock0=(liveGame()&&!document.hidden&&!setupShown())?Date.now():0; }
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

/* ================= names and colours ================= */
var nameUI=null;
function humanNames(n){ var B=BG(); if(!n) return []; return nameUI&&B&&B.names?B.names.list(n,nameUI.values()):null; }
function colSegHTML(i){ return '<div class="bg-seg cd-colseg" role="group" data-who="'+i+'" aria-label="Colour">'+COLN.map(function(c,k){ return '<button type="button" data-col="'+(k+1)+'" aria-pressed="false"><span class="cd-cdot" data-seat="'+(k+1)+'" aria-hidden="true"></span><small>'+c+"</small></button>"; }).join("")+"</div>"; }
function mountNames(){
  var B=BG(); if(!B||!B.names||nameUI) return;
  nameUI=B.names.mount("#nameCard",{count:Math.max(1,cfg.humans),seat:function(i){ return cfg.colors[i]||i+1; },extra:function(i){ return colSegHTML(i); },onChange:function(){ drawSeats(); }});
  $("nameCard").addEventListener("click",function(e){
    var b=e.target.closest(".cd-colseg button"); if(!b) return;
    var i=+b.closest(".cd-colseg").getAttribute("data-who"), c=+b.dataset.col, j=cfg.colors.indexOf(c);
    if(j>=0&&j!==i) cfg.colors[j]=cfg.colors[i];   // a colour someone else holds: swap
    cfg.colors[i]=c; drawSeats(); saveCfg();
  });
}
function paintColours(){
  document.querySelectorAll("#nameCard .cd-colseg").forEach(function(seg){
    var i=+seg.getAttribute("data-who"), one=cfg.humans===1;
    seg.setAttribute("aria-label",one?"Your colour":"Player "+(i+1)+" colour");
    seg.querySelectorAll("button").forEach(function(b){ var on=+b.dataset.col===cfg.colors[i]; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); });
  });
}
function fixColours(){   // a permutation of 1..4 (old settings, bad data)
  var seen={}, out=[];
  (cfg.colors||[]).forEach(function(c){ c=+c; if(c>=1&&c<=4&&!seen[c]){ seen[c]=1; out.push(c); } });
  for(var c=1;c<=4;c++) if(!seen[c]) out.push(c);
  cfg.colors=out.slice(0,4);
}
/* seat colours for a game: the people's picks, then the computers take the rest in order */
function seatColours(h,n){ fixColours(); return cfg.colors.slice(0,n); }
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
function drawVersions(){
  var vs=$("versions");
  if(!vs.querySelector(".bg-version")){
    vs.innerHTML=E.VERSIONS.map(function(v){ return '<button type="button" class="bg-version" role="radio" data-value="'+v.id+'" data-v="'+v.id+'" aria-checked="false"><span class="bg-version__title">'+esc(v.name)+'</span><span class="bg-version__meta">'+esc(v.tag)+'</span></button>'; }).join("");
    vs.querySelectorAll(".bg-version").forEach(function(d){ d.addEventListener("click",function(){ if(cfg.version!==d.dataset.v){ cfg.version=d.dataset.v; cfg.over={}; } drawSetup(); saveCfg(); }); });
  }
  vs.querySelectorAll(".bg-version").forEach(function(d){ var on=cfg.version===d.dataset.v; d.classList.toggle("on",on); d.setAttribute("aria-checked",String(on)); });
  var v=versionOf(cfg.version);
  $("versionDesc").innerHTML="<b>"+esc(v.name)+".</b> "+esc(v.desc);
}
function clampSeats(){
  var mx=E.MAXP, mn=E.MINP;
  cfg.humans=clamp(cfg.humans|0,0,mx); cfg.cpus=clamp(cfg.cpus|0,0,mx);
  if(cfg.humans+cfg.cpus<mn) cfg.cpus=mn-cfg.humans;
  if(cfg.humans+cfg.cpus>mx) cfg.cpus=Math.max(0,mx-cfg.humans);
  if(cfg.humans+cfg.cpus<mn) cfg.humans=mn;
}
function stepper(box,label,get,set,lo,hi){
  if(!box.querySelector(".bg-stepper__btn")){
    box.innerHTML='<button type="button" class="bg-stepper__btn" data-step="-1" aria-label="Fewer '+esc(label)+'">'+(icon("minus")||"&minus;")+'</button><output class="bg-stepper__val" aria-live="polite"></output><button type="button" class="bg-stepper__btn" data-step="1" aria-label="More '+esc(label)+'">'+(icon("plus")||"+")+"</button>";
    box.querySelectorAll(".bg-stepper__btn").forEach(function(b){ b.addEventListener("click",function(){ if(b.disabled) return; set(get()+(+b.dataset.step)); clampSeats(); drawSetup(); saveCfg(); }); });
  }
  var v=get(), bs=box.querySelectorAll(".bg-stepper__btn"), a=document.activeElement;
  box.querySelector("output").textContent=String(v);
  bs[0].disabled=v<=lo; bs[1].disabled=v>=hi;
  bs[0].setAttribute("aria-label","Fewer "+label+" ("+v+")"); bs[1].setAttribute("aria-label","More "+label+" ("+v+")");
  if(a&&a.disabled&&box.contains(a)) focusIn(a===bs[0]?bs[1]:bs[0]);
}
/* "Who is the youngest?": the people only (computers have no age); "Nobody" = the table decides, the first seat starts */
function drawYoungest(){
  var sel=$("youngSel"), row=$("youngRow"), hn=seatNames().slice(0,cfg.humans);
  row.hidden=cfg.humans===0;
  if(cfg.youngest>=cfg.humans) cfg.youngest=cfg.humans?0:-1;
  var opts=hn.map(function(x,i){ return '<option value="'+i+'"'+(i===cfg.youngest?" selected":"")+">"+esc(x)+"</option>"; }).join("")+'<option value="-1"'+(cfg.youngest<0?" selected":"")+">Nobody: the first seat starts</option>";
  if(sel._h!==opts){ sel.innerHTML=opts; sel._h=opts; }
  sel.value=String(cfg.youngest<0?-1:cfg.youngest);
  $("youngDesc").textContent=cfg.humans===1?"The youngest player goes first. Computers have no age, so with one person it is you or the first seat.":"The youngest player goes first; play passes to the left.";
}
$("youngSel").addEventListener("change",function(e){ cfg.youngest=+e.target.value; drawSeats(); saveCfg(); });
function drawSeats(){
  clampSeats(); fixColours();
  var mx=E.MAXP, mn=E.MINP;
  stepper($("humanSeg"),onTV()?"players on this TV":"players on this phone",function(){ return cfg.humans; },function(v){ cfg.humans=v; },0,mx);
  stepper($("cpuSeg"),"computer players",function(){ return cfg.cpus; },function(v){ cfg.cpus=v; },Math.max(0,mn-cfg.humans),mx-cfg.humans);
  if(nameUI){ nameUI.count(Math.max(1,cfg.humans)); nameUI.refresh(); }
  paintColours();
  $("nameCard").closest("section").hidden=cfg.humans===0;
  drawYoungest();
  var n=nPlayers(), names=seatNames(), cols=seatColours(cfg.humans,n), ys=youngestSeat();
  $("seatTokens").innerHTML=names.map(function(x,i){ return '<span class="bg-token" data-seat="'+cols[i]+'" aria-hidden="true">'+esc(initials(x))+"</span>"; }).join("");
  $("seatHead").textContent=n+" players"+(cfg.humans===0?" · watch mode":"");
  $("seatNote").textContent=(cfg.humans>1?"Two or more share the "+(onTV()?"remote":"phone")+". ":"")+(ys>=0?names[ys]+" "+(names[ys]==="You"?"go":"goes")+" first (the youngest), then to the left.":names[0]+" "+(names[0]==="You"?"go":"goes")+" first (the first seat), then to the left.");
  syncStart();
}
function hdesc(key){ return (E.HDESC&&E.HDESC[key])||""; }
function drawHouse(){
  var o=curOpts(), n=nPlayers(), box=$("houseRules");
  keepFocus(box,"data-k",function(){
    box.innerHTML="";
    E.houseRows(o.version,n,o).forEach(function(h){
      var key=h[0], tag=h[4]?'<span class="bg-tag bg-tag--house">house</span>':'<span class="bg-tag bg-tag--official">official option</span>', ds=hdesc(key);
      var row=document.createElement("label"); row.className="bg-row";
      row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(h[1])+" "+tag+'</span>'+(ds?'<span class="bg-row__desc">'+esc(ds)+"</span>":"")+'</span><input type="checkbox" class="bg-toggle" data-k="'+key+'"'+(o[key]?" checked":"")+">";
      row.querySelector("input").addEventListener("change",function(e){ cfg.over[key]=e.target.checked; drawSetup(); saveCfg(); });
      box.appendChild(row);
    });
  });
  syncRules(); boardLine();
}
function changedRules(){ var n=nPlayers(), base=E.normalize(E.versionOpts(cfg.version,{}),n), o=curOpts(); return E.houseRows(o.version,n,o).filter(function(h){ return String(o[h[0]])!==String(base[h[0]]); }).length; }
function syncRules(){
  var n=changedRules(), v=versionOf(cfg.version), open=ui.rulesOpen;
  $("rulesDesc").textContent=n?n+(n===1?" rule":" rules")+" changed from "+v.name:"As in "+v.name+". Open it to change any rule.";
  $("rulesToggle").setAttribute("aria-expanded",String(open)); $("houseRules").hidden=!open; $("rulesLegend").hidden=!open;
}
/* the board in play and how long a game runs (the exact solo length under these rules: RULES.md 5), and the researched shorter option */
function boardLine(){
  var o=curOpts(), B=E.boardOf(o), e=NaN, base=NaN, short=NaN;
  try{ e=E.expected(o); base=E.expected(E.normalize(E.versionOpts(cfg.version,{}),nPlayers())); short=E.expected(E.normalize(E.versionOpts(cfg.version,{older:true}),nPlayers())); }catch(x){}
  var nS=Object.keys(B.sticky).length;
  var t=B.name.charAt(0).toUpperCase()+B.name.slice(1)+": 134 squares, 6 picture squares, 2 shortcuts and "+nS+" "+(B.stickyKind==="until"?"sticky":"licorice")+" squares.";
  if(isFinite(e)) t+=" One player alone needs about "+Math.round(e)+" cards to finish.";
  if(isFinite(e)&&isFinite(base)&&e<base*.95) t+=" Shorter than the plain rules (about "+Math.round(base)+").";
  else if(isFinite(e)&&isFinite(base)&&e>base*1.05) t+=" Longer than the plain rules (about "+Math.round(base)+").";
  else if(!o.older&&isFinite(short)) t+=" For a shorter game, try "+(cfg.version==="v2004"?"the official option":"the house rule")+" Draw two, choose one (about "+Math.round(short)+").";
  $("boardLine").textContent=t;
}
function skillNote(){ var Br=CY.Brain, o=curOpts(); $("skillNote").textContent=Br?(o.older?Br.NOTE_CHOICE:Br.NOTE):"In Candy Land the cards decide everything: skill makes no difference."; }
function drawSetup(){ clampSeats(); drawVersions(); drawSeats(); drawHouse(); skillNote(); syncStart(); }
$("rulesToggle").addEventListener("click",function(){ ui.rulesOpen=!ui.rulesOpen; syncRules(); });
function setSpeedSeg(){ cfg.speed=normSpeed(cfg.speed); window.bgGameSpeed=cfg.speed; $("speedSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.s===cfg.speed; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("speedSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.speed=b.dataset.s; setSpeedSeg(); save(); saveCfg(); }); });
function setSkillSeg(){
  cfg.skill=normSkill(cfg.skill);
  if(G) G.players.forEach(function(p){ if(!p.human) p.skill=cfg.skill; });
  $("skillSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.k===cfg.skill; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); });
}
$("skillSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.skill=b.dataset.k; setSkillSeg(); save(); saveCfg(); }); });
setSpeedSeg();
function deviceCopy(){
  var tv=onTV(), t=tv?"Players on this TV":"Players on this phone";
  $("humansTitle").textContent=t; $("humanSeg").setAttribute("aria-label",t);
  $("humansDesc").textContent="0 = watch the computers play. Two or more share the "+(tv?"remote":"phone")+".";
  if($("humanSeg").querySelector(".bg-stepper__btn")) drawSeats();
  syncControls();
}
function subParts(parts){ return parts.map(function(s,i){ return '<span class="cd-nw">'+esc(s)+(i<parts.length-1?" ·":"")+"</span>"; }).join(" "); }
function syncStart(){
  var rb=$("resumeBtn"), sb=$("startBtn"), resumable=rb.style.display!=="none";
  $("startLabel").textContent=resumable?"New game":"Start the game";
  var parts=[nPlayers()+" players",versionOf(cfg.version).name];
  if(!resumable&&changedRules()) parts.push("custom rules");
  $("startSub").innerHTML=subParts(parts);
  $("startDock").classList.toggle("has-resume",resumable);
  sb.classList.toggle("bg-btn--primary",!resumable); sb.classList.toggle("bg-btn--secondary",resumable);
  rb.classList.toggle("bg-btn--primary",resumable); rb.classList.toggle("bg-btn--secondary",!resumable);
}
function resultDue(){ var B=BG(); return !!(G&&G.over&&ui.finished===gen&&ui.winShown!==gen&&B&&B.win&&luxe()); }   // only once the winning move has played: no spoiler mid-move
function resumeText(){
  if(ui.result) return;
  // the sub breaks only at its " · " (cd-nw parts) and stays short on a phone, so it never runs past the half-width button
  var parts=["Back to the game"];
  if(G&&!G.over) parts=["Turn "+G.turn,isYou(G.cur)?"your turn":nm(G.cur)+"'s turn"];
  $("resumeLabel").textContent="Resume"; $("resumeSub").innerHTML=subParts(parts);
}
function menuResult(){
  if(!resultDue()) return;
  ui.result=true; $("resumeBtn").style.display="block";
  $("resumeLabel").textContent="See the result"; $("resumeSub").textContent=nm(G.winner)+" "+vb(G.winner,"wins");
  saveBar.refresh(); syncStart(); barTitle();
}
function showSetup(on,resume){
  var s=$("setup"), b=document.body, se=document.scrollingElement||document.documentElement, y=se.scrollTop;
  if(on) clockOff();
  s.style.display=on?"":"none";
  b.classList.toggle("cd-in-setup",on); b.classList.toggle("bg-app--scene",on); b.classList.toggle("bg-app--felt",!on);
  $("menuBtn").hidden=on;
  $("cfly").hidden=on;
  if(on){ closeWin(); syncStart(); }
  if(y) se.scrollTop=0;
  if(!on&&G){
    if(!busy) sync(); else ui.needSync=true;
    clockOn();
    if(resume){
      if(ui.result){ ui.result=false; setTimeout(function(){ if(G&&G.over&&!setupShown()) openWin(); },250); }
      else drive();
    }
    armBack();
    if(!ui.fpShow) focusTV(mainControl());
  }
  barTitle();
  var B=BG(); if(luxe()&&B.toast&&B.toast.place) B.toast.place();
}
function barTitle(){
  var e=$("barEyebrow"); if(!e) return;
  var t=paused()?"Paused":setupShown()?(liveGame()?"Game in progress":(ui.result?"Game over":"New game")):(!G?"New game":(G.over&&ui.finished===gen)?"Game over":G.over?"Turn "+G.turn:ui.fpShow?"Who goes first?":"Turn "+G.turn);
  if(e.textContent!==t) e.textContent=t;
}

/* ================= saving ================= */
function pack(){ if(!G) return null; return {G:JSON.parse(JSON.stringify(G)),cfg:JSON.parse(JSON.stringify(cfg)),stats:{ms:Math.round(playMs())}}; }
function save(){ if(!G) return; if(G.over){ Saves.del(GAME,"auto"); return; } var pk=pack(); if(pk) Saves.auto(GAME,pk); }
function saveCfg(){ try{ localStorage.setItem("candy_cfg",JSON.stringify({version:cfg.version,over:cfg.over,humans:cfg.humans,cpus:cfg.cpus,speed:cfg.speed,skill:cfg.skill,colors:cfg.colors,youngest:cfg.youngest})); }catch(e){} }
function loadCfg(){ try{ var c=JSON.parse(localStorage.getItem("candy_cfg")||"null"); if(c&&typeof c==="object") applySettings(c,true); }catch(e){} }
function loadSaved(d){
  if(!d||!d.G||d.G.id!=="candy"||d.G.v!==E.VER) throw new Error("not a Candy Land save");
  var bad=E.check(d.G); if(bad.length) throw new Error("save fails its check: "+bad[0]);
  gen++; clearTimeout(timer); busy=false; intent=false; clearFly();
  G=d.G; var c=d.cfg||{}; for(var k in c) if(Object.prototype.hasOwnProperty.call(cfg,k)) cfg[k]=c[k];
  cfg.speed=normSpeed(cfg.speed); setSpeedSeg(); cfg.skill=normSkill(cfg.skill); setSkillSeg(); fixColours();
  stats={ms:Math.max(0,+((d.stats||{}).ms)||0)}; clock0=0;
  ui.winShown=-1; ui.result=false; ui.finished=-1; ui.fpShow=false; ui.say=null; ui.lastTurn=-1; ui.warnTurn=-1; say(null);
  closeWin();
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
function applySettings(s,quiet){
  s=s||{}; cfg.version=versionOf(s.version).id; cfg.over=(s.over&&typeof s.over==="object")?s.over:{}; cfg.humans=s.humans!=null?+s.humans:1; cfg.cpus=s.cpus!=null?+s.cpus:1;
  cfg.speed=normSpeed(s.speed); cfg.skill=normSkill(s.skill); cfg.colors=Array.isArray(s.colors)?s.colors.slice():[1,2,3,4]; cfg.youngest=s.youngest!=null&&isFinite(+s.youngest)?+s.youngest:0;
  fixColours(); setSpeedSeg(); setSkillSeg(); if(!quiet) drawSetup();
}
var saveBar=Saves.bar({game:GAME,el:$("svbar"),version:1,snapNote:"exactly as it is now",saveToast:"Game saved",
  getSettings:function(){ return JSON.parse(JSON.stringify(cfg)); },
  applySettings:function(s){ applySettings(s); saveCfg(); },
  standard:function(){ applySettings({}); saveCfg(); },
  getSnapshot:function(){ return (G&&!G.over)?pack():null; },loadSnapshot:loadSaved});

/* ================= Menu, Resume, Start ================= */
$("menuBtn").addEventListener("click",function(){
  var result=resultDue();
  saveBar.refresh(); $("resumeBtn").style.display=((G&&!G.over)||result||(G&&G.over&&ui.finished!==gen))?"block":"none";   // the winning move still playing: Resume finishes it
  ui.result=false; ui.cont=false; resumeText();
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
  var d=a&&a.data; if(!d||!d.G||d.G.over||d.G.id!=="candy") return false;
  ui.cont=true; $("resumeBtn").style.display="block"; $("resumeLabel").textContent="Continue";
  var parts=["Turn "+((+d.G.turn)||1),d.G.n+" players"];   // one short line: the dock stays at two lines (the save's time is under Save and load)
  $("resumeSub").innerHTML=subParts(parts);
  syncStart(); return true;
}
// the new game is set up before the board shows, so the old game never flashes back
$("startBtn").addEventListener("click",function(){ Sound.skip(); closeWin(); startGame(); showSetup(false); armBack(); firstShow(gen); });

/* ================= a new game ================= */
function startGame(){
  gen++; clearTimeout(timer); clampSeats(); busy=false; intent=false; clearFly();
  var n=nPlayers(), hn=humanNames(cfg.humans)||[], i;
  for(i=hn.length;i<cfg.humans;i++) hn.push(cfg.humans===1?"You":"Player "+(i+1));
  var cn=cpuNames(cfg.cpus,hn), cols=seatColours(cfg.humans,n), players=[];
  for(i=0;i<n;i++){ var h=i<cfg.humans; players.push({name:h?hn[i]:cn[i-cfg.humans],human:h,color:String(cols[i]),skill:h?null:normSkill(cfg.skill)}); }
  G=E.newGame(rawOpts(),players);
  stats={ms:0}; clock0=0; ui.winShown=-1; ui.result=false; ui.finished=-1; ui.lastTurn=-1; ui.warnTurn=-1; ui.say=null;
  say(null);
  ui.fpShow=true;   // set before the board and the strip are first drawn: no turn ring names the first player while the show still plays
  startUI(); save(); saveCfg();
}
function startUI(){
  Sound.music(GAME);
  buildBoard();
}

/* ================= the board ================= */
var TR=36;   // a mover's half size in board units (a square is about 54 x 64)
function unit(){ var a=$("cart"); return a?a.clientWidth/BD.W:0; }
var GB='<svg class="cd-gb" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><ellipse class="cd-gring" cx="50" cy="56" rx="46" ry="44"/>'+
  '<path class="cd-gbody" d="M50 6a17 17 0 0 1 9.5 31.1C66 39 72 40.5 82 41.5c8 .8 9 13.2 0 14.2l-12 1.1V66l12 22.5c4 7.6-6.4 12.4-11 6L57 78.4h-14L29 94.5c-4.6 6.4-15-1.6-11-6L30 66v-9.2l-12-1.1c-9-1-8-13.4 0-14.2 10-1 16-2.5 22.5-4.4A17 17 0 0 1 50 6z"/>'+
  '<path class="cd-gice" d="M16 46.5q4 3 8 0t8 0M68 46.5q4 3 8 0t8 0M26 87q3-4 6-1M68 86q3-3 6 1M42 19a2 2 0 1 0 0 .1M58 19a2 2 0 1 0 0 .1M43 27q7 5 14 0"/></svg>';
function buildBoard(){
  BD.build($("csvg"),G.bd);
  var box=$("ctoks"); box.innerHTML=""; tokEls=[];
  disp=G.players.map(function(p){ return p.pos; });
  G.players.forEach(function(p,s){
    var el=document.createElement("div"); el.className="cd-tok"; el.setAttribute("data-seat",seatNo(s)); el.setAttribute("data-s",s);
    el.innerHTML='<div class="cd-hopw">'+GB+'<span class="cd-ini">'+esc(initials(p.name))+"</span></div>";
    box.appendChild(el); tokEls.push(el);
  });
  var B=board();
  $("cart").setAttribute("aria-label",versionOf(G.o.version).name+" board: 134 squares from the start to the Sugarspire, 6 picture squares, 2 shortcuts and 3 "+(B.stickyKind==="until"?"sticky":"licorice")+" squares");
  syncDeck(); buildStand(); layoutBoard();
}
function layoutBoard(){
  var u=unit(); if(!u) return false;
  BD.label(u,onTV()?remPx()*.875:12);
  $("ctoks").style.setProperty("--tw",Math.round(2*TR*u)+"px");
  return true;
}
/* where each mover rests: the start plate (by seat), else its square; movers sharing a square fan out */
var FAN={1:[[0,0]],2:[[-16,-8],[16,8]],3:[[-18,-12],[18,-12],[0,14]],4:[[-18,-15],[18,-15],[-18,15],[18,15]]};
function restPose(s,pos,all){
  if(!pos){ var ss=BD.startSlot(s,G.n); return {x:ss.x,y:ss.y,k:.82}; }
  var c=BD.centre(pos), here=all.filter(function(q){ return disp[q]===pos; });
  if(here.length<2) return {x:c.x,y:c.y-6,k:1};
  var i=here.indexOf(s), f=FAN[Math.min(4,here.length)][i]||[0,0];
  return {x:c.x+f[0],y:c.y+f[1]-6,k:here.length>2?.7:.78};
}
function setPose(el,p){
  el._p=p; var r=TR*(p.k||1);
  el.style.left=((p.x-r)/BD.W*100)+"%"; el.style.top=((p.y-r)/BD.H*100)+"%"; el.style.width=(2*r/BD.W*100)+"%";
}
function renderTokens(){
  if(!G||!tokEls.length) return;
  var all=G.players.map(function(p,s){ return s; });
  tokEls.forEach(function(el,s){
    setPose(el,restPose(s,disp[s],all)); el.classList.remove("is-moving");
    el.classList.toggle("is-turn",!G.over&&!ui.fpShow&&s===G.cur);
    el.classList.toggle("is-done",!!G.players[s].done);
  });
}
/* one glide from the mover's last pose to p (FLIP: the mover is placed at p, then slides from where it was) */
function glide(el,p,ms,ease){
  var from=el._p||p, u=unit(); setPose(el,p);
  if(calm()||!el.animate||!ms||!u) return Promise.resolve();
  var k0=(from.k||1)/(p.k||1), dx=(from.x-p.x)*u, dy=(from.y-p.y)*u;
  try{ return el.animate([{transform:"translate("+dx.toFixed(1)+"px,"+dy.toFixed(1)+"px) scale("+k0.toFixed(3)+")"},{transform:"none"}],{duration:ms,easing:ease||"cubic-bezier(.3,.7,.3,1)"}).finished.then(function(){},function(){}); }catch(e){ return Promise.resolve(); }
}
function hop(el,ms){ var B=BG(), w=el.querySelector(".cd-hopw"); if(B&&B.hop&&w&&!calm()) B.hop(w,{ms:ms,lift:Math.max(5,Math.round(unit()*20))}); }

/* ---------- the cards on the table: the draw pile, the discard pile, the two cards of "draw two" ---------- */
function syncDeck(){
  if(!G) return;
  dk.n=G.deck.length; dk.dn=G.disc.length; dk.top=G.disc.length?G.disc[G.disc.length-1]:null; dk.hand=G.hand.slice(); dk.aside=G.aside.length; dk.landed={};
  renderPiles(); renderPick();
}
function pub(id){ return E.cardPublic(G,id); }
function renderPiles(){
  var deck=$("cdeck"), disc=$("cdisc");
  var backs=dk.n>0?(dk.n>2?BD.backSVG("cd-cardsvg is-under2"):"")+(dk.n>1?BD.backSVG("cd-cardsvg is-under1"):"")+BD.backSVG():"";
  if(deck._k!==Math.min(3,dk.n)){ deck._k=Math.min(3,dk.n); deck.querySelectorAll(".cd-cardsvg").forEach(function(x){ x.remove(); }); deck.insertAdjacentHTML("afterbegin",backs); }
  deck.classList.toggle("is-empty",dk.n===0);
  $("cdeckN").textContent=String(dk.n); deck.setAttribute("aria-label","Draw pile: "+plural(dk.n,"card"));
  var key=dk.top==null?"none":String(dk.top);
  if(disc._k!==key){ disc._k=key; disc.querySelectorAll(".cd-cardsvg").forEach(function(x){ x.remove(); }); if(dk.top!=null) disc.insertAdjacentHTML("afterbegin",BD.cardSVG(pub(dk.top))); }
  disc.classList.toggle("is-empty",dk.top==null);
  $("cdiscN").textContent=String(dk.dn); disc.setAttribute("aria-label","Discard pile: "+plural(dk.dn,"card")+(dk.top!=null?", top: "+BD.cardWords(pub(dk.top)):""));
  var a=$("caside"), at=dk.aside?plural(dk.aside,"picture card")+" used up":"";
  if(a.textContent!==at) a.textContent=at;
}
/* what card id would do for the player whose turn it is: the detail line of a pick button */
/* the colour of the last square (the CEO's rule: you need it to win; 1984: purple) */
function lastColour(){ var b=board(), t=b&&b.track; return (t&&CN[t.charAt(t.length-1)])||"the last colour"; }
function outcomeText(s,id){
  var r=E.outcome(G,s,id), cd=pub(id), B=board();
  if(r.stay==="stuck") return "Still stuck (needs "+CN[G.players[s].stuck]+")";
  if(r.stay==="same") return "Already on that square";
  if(r.stay==="exact") return "Needs "+lastColour()+" to finish: no move";
  if(r.redraw) return "That square is taken: draw again";
  var t=(r.kind==="picture"?(r.dir<0?"Back to ":"To ")+"square "+r.land:"To "+(r.win&&!r.seq.length?(r.over?"past the end":"the rainbow"):"square "+r.land));
  r.seq.forEach(function(x){ t+=x.e==="shortcut"?", "+x.name+" to "+x.to:", taken: on to "+x.to; });
  if(r.win) t+=": wins!";
  else if(r.sticky) t+=": stuck until "+CN[r.sticky];
  else if(r.lose) t+=": loses a turn";
  return t;
}
/* the "best" mark on a person's two cards: the fewest expected turns home from where each card leads (the engine's exact table for these
   rules, RULES.md 5; the same measure as the Normal computers). Read only: it never touches the game or a brain. */
function bestPick(s){
  if(!G||G.hand.length!==2) return -1;
  try{
    var T=E.table(G.o,1e-7), pos=G.players[s].pos;
    var v=G.hand.map(function(id){ var r=E.outcome(G,s,id); if(r.win) return -1; if(r.redraw||r.stay) return T.E[pos]+(r.redraw?0:.001); return T.E[r.to]+(r.lose?1:0); });
    return v[0]<=v[1]?0:1;
  }catch(e){ return -1; }
}
function renderPick(){
  var box=$("cpick"), show=dk.hand.length>0&&!!G&&!G.over;
  box.hidden=!show;
  if(!show){ if(box._k!=="") { box._k=""; box.innerHTML=""; } return; }
  var s=G.cur, hum=isHuman(s)&&G.phase==="choose"&&!busy&&!ui.fpShow&&!setupShown(), ready=G.phase==="choose"&&!busy, best=ready&&dk.hand.length===2?bestPick(s):-1;
  var key=dk.hand.join(",")+"|"+(ready?1:0)+"|"+best+"|"+(hum?1:0);
  if(box._k===key) return; box._k=key;
  var a=document.activeElement, had=a&&box.contains(a);
  box.innerHTML=dk.hand.map(function(id,i){ var cd=pub(id);
    return '<button type="button" class="bg-btn bg-btn--secondary cd-pickbtn'+(i===best?" is-best":"")+'" data-i="'+i+'"'+(hum?"":" disabled")+">"+BD.cardSVG(cd)+
      "<span><b>"+esc(hum?"Play "+(cd.pic!=null?BD.cardWords(cd):BD.cardWords(cd).toLowerCase()):BD.cardWords(cd))+"</b><small>"+esc(ready?outcomeText(s,id)+(i===best&&hum?" · fewest turns home":""):"Drawing...")+"</small>"+(i===best&&hum?'<span class="bg-tag bg-tag--accent">best</span>':"")+"</span></button>"; }).join("");
  box.querySelectorAll(".cd-pickbtn").forEach(function(b){ b.addEventListener("click",function(){ tapPick(+b.dataset.i); }); });
  if(hum&&(had||onTV())){ var f=box.querySelector(".is-best")||box.querySelector(".cd-pickbtn"); if(f) focusIn(f); }
}

/* ---------- the standings: always sorted, leader first ---------- */
function buildStand(){
  var ul=$("cstand"); ul.innerHTML=""; standEls=[];
  G.players.forEach(function(p,s){
    var li=document.createElement("li"); li.className="bg-player"; li.setAttribute("data-seat",seatNo(s)); li.setAttribute("data-s",s);
    li.innerHTML='<span class="cd-rk"></span><span class="bg-token" aria-hidden="true">'+esc(initials(p.name))+"</span>"+(p.human?"":'<span class="bg-player__cpu" title="Computer">'+icon("cpu")+"</span>")+
      '<span class="bg-player__txt"><span class="bg-player__name">'+esc(p.name)+'</span><span class="bg-player__meta"></span></span><span class="cd-bar" aria-hidden="true"><i></i></span>';
    ul.appendChild(li); standEls.push(li);
  });
}
function standRows(){
  if(!busy) return E.standings(G);
  // mid-animation the order follows the movers on the board (disp), not the state the card has already reached
  var rows=G.players.map(function(p,s){ var done=disp[s]===E.END; return {s:s,name:p.name,pos:disp[s],done:done,at:p.at,table:!done}; });
  rows.sort(function(a,b){ if(a.done!==b.done) return a.done?-1:1; if(b.pos!==a.pos) return b.pos-a.pos; return a.s-b.s; });
  rows.forEach(function(r,i){ var pv=rows[i-1]; r.place=pv&&!pv.done&&!r.done&&pv.pos===r.pos?pv.place:i+1; });
  return rows;
}
function standMeta(s,pos,done){
  var p=G.players[s];
  if(done) return "Home";
  var t=pos?"Square "+pos:"Start";
  if(!busy&&p.stuck) t+=" · needs "+CN[p.stuck];
  else if(!busy&&p.skip) t+=" · loses a turn";
  return t;
}
function renderStand(){
  if(!G||!standEls.length) return;
  var rows=standRows(), ul=$("cstand"), B=BG(), before=standEls.map(function(li){ return li.getBoundingClientRect(); }), moved=false;
  rows.forEach(function(r,i){
    var li=standEls[r.s], pos=busy?disp[r.s]:G.players[r.s].pos, done=busy?pos===E.END:G.players[r.s].done;
    li.querySelector(".cd-rk").textContent=String(r.place);
    li.querySelector(".bg-player__meta").textContent=standMeta(r.s,pos,done);
    li.querySelector(".cd-bar > i").style.transform="scaleX("+(pos/E.END).toFixed(3)+")";
    if(ul.children[i]!==li){ ul.insertBefore(li,ul.children[i]||null); moved=true; }
  });
  if(moved&&B&&B.flip&&!reduced()) standEls.forEach(function(li,s){ B.flip(li,before[s],{ms:sp(320)}); });
  var turn=(G.over||ui.fpShow)?-1:G.cur;
  if(B&&B.setTurn&&turn>=0){ B.setTurn(standEls[turn],{pulse:turn!==ui.lastTurn&&!setupShown()&&!document.hidden}); ui.lastTurn=turn; }
  else standEls.forEach(function(li){ li.classList.remove("is-turn"); });
}

/* ---------- the log ---------- */
function youFix(t){
  return String(t).replace(/\bYou (reaches|wins|draws|is|goes|loses|needs|has|picked|takes|starts)\b/g,function(m,v){ return "You "+({reaches:"reach",wins:"win",draws:"draw",is:"are",goes:"go",loses:"lose",needs:"need",has:"have",picked:"picked",takes:"take",starts:"start"})[v]; })
    .replace(/(You [^.!]*?) and (goes|wins)\b/g,function(m,a,v){ return a+" and "+(v==="wins"?"win":"go"); })
    .replace(/(You [^.!]*?)! Loses the next turn/g,"$1! You lose the next turn");
}
function logFix(t){ return youFix(String(t).replace(/ → /g," to ")); }   // the font subsets have no arrows: write "to"
function renderLog(){
  var ul=$("clog"); if(!G||ui.fpShow){ ul.innerHTML=""; return; }   // the log names the first player: not while the show still plays
  var L=G.log.slice(-6); ul.innerHTML=L.map(function(e){ return "<li>"+esc(logFix(e.t))+"</li>"; }).join("");
}

/* ---------- the status line, the Draw button, the chips ---------- */
function mainControl(){
  var db=$("drawBtn"); if(!db.hidden&&!db.disabled) return db;
  var pk=$("cpick"); if(!pk.hidden){ var b=pk.querySelector(".cd-pickbtn.is-best:not([disabled])")||pk.querySelector(".cd-pickbtn:not([disabled])"); if(b) return b; }
  return $("menuBtn");
}
function syncControls(){
  if(!G) return;
  var tv=onTV(), nh=nHumans(), cur=G.cur, hum=!G.over&&isHuman(cur), db=$("drawBtn"), st="", choose=G.phase==="choose";
  db.hidden=!nh||G.over||(choose&&!busy&&hum);
  db.disabled=!hum||ui.fpShow||intent||(busy&&ui.mover!==cur)||choose;
  $("drawLabel").textContent=choose&&hum?"Choose a card":"Draw";
  var pc=G.players[cur];
  $("drawSub").textContent=G.over?"":busy?"Next: "+nm(cur):hum?(nh>1?nm(cur)+"'s turn":(pc.stuck?"Stuck: needs "+CN[pc.stuck]:pc.pos?"On square "+pc.pos:"From the start")):nm(cur)+"'s turn";
  if(ui.fpShow) st="Who goes first? The youngest player";
  else if(G.over) st=nm(G.winner)+" "+vb(G.winner,"wins")+"!";
  else if(busy) st=ui.status||"";
  else if(hum&&choose) st=(nh>1?nm(cur)+": c":"C")+"hoose one of the two cards"+(tv?" (press OK)":"");
  else if(hum&&!intent){
    var lead=nh>1?nm(cur)+"'s turn":"Your turn";
    st=lead+": "+(tv?"press OK to draw a card":"tap Draw")+(pc.stuck?" (you need "+CN[pc.stuck]+" to get out)":"");
  }
  else if(hum) st=nm(cur)+" "+vb(cur,"draws")+" a card";
  else if(!nh) st="Watching "+G.n+" computers · "+nm(cur)+" "+vb(cur,"draws")+" next";
  else st="Waiting for "+nm(cur)+" to "+(choose?"choose a card":"draw");
  $("cstat").textContent=st;
  $("hintOk").textContent=(!nh||G.over)?"Open the Menu":choose&&hum?"Play the card":"Draw";
  renderPick(); chips(); barTitle();
}
function chips(){
  if(!G) return;
  var c=$("cneed"), r=$("cround"), t="", s=G.cur, p=G.players[s];
  if(!G.over&&!ui.fpShow&&p&&!p.done&&disp[s]===p.pos&&E.END-p.pos<=12){ var left=E.END-p.pos; t=nm(s)+": "+plural(left,"square")+" to the Sugarspire"; }
  c.textContent=t; c.classList.toggle("is-hot",!!t);
  var rt=ui.fpShow?"":"Turn "+G.turn;
  if(r.textContent!==rt) r.textContent=rt;
}
function sync(){
  if(!G) return;
  disp=G.players.map(function(p){ return p.pos; });
  layoutBoard(); renderTokens(); syncDeck(); renderStand(); renderLog(); syncControls();
}
function say(r){
  var el=$("csay");
  if(!r||!G||!G.players[r.s]){ el.innerHTML=""; ui.say=null; return; }
  ui.say=r; ui.sayStep=G.step; el.innerHTML='<span class="bg-token" data-seat="'+seatNo(r.s)+'" aria-hidden="true">'+esc(initials(nm(r.s)))+"</span><span>"+esc(nm(r.s))+": “"+esc(r.text)+"”</span>";
}

/* ================= the turn: queue the person's draw, pace the computers ================= */
$("drawBtn").addEventListener("click",function(){ tapDraw(); });
$("cdeck").addEventListener("click",function(){ tapDraw(); });
function tapDraw(){
  if(!G||G.over||ui.fpShow||setupShown()) return;
  if(!isHuman(G.cur)||intent||G.phase!=="draw") return;
  if(busy&&ui.mover!==G.cur) return;   // hot seat: a double tap during this move must not draw for the next person
  intent=true; syncControls();
  if(!busy) drive();
}
function tapPick(i){
  if(!G||G.over||busy||ui.fpShow||setupShown()) return;
  if(!isHuman(G.cur)||G.phase!=="choose"||(i!==0&&i!==1)) return;
  act({t:"pick",s:G.cur,i:i});
}
function later(my,fn,ms){
  clearTimeout(timer);
  timer=setTimeout(function tick(){
    if(my!==gen||!G||G.over) return;
    if(paused()||ui.fpShow){ barTitle(); timer=setTimeout(tick,250); return; }
    if(busy){ timer=setTimeout(tick,60); return; }
    fn();
  },Math.max(0,ms));
}
function cpuMove(s){ var m=null; try{ if(CY.Brain) m=CY.Brain.decide(G,s); }catch(e){ m=null; } return m||E.defaultMove(G,s); }
function turnStart(){
  // once per turn: the tension cues near the Sugarspire (a heartbeat, the spire glows) and the sticky squares one card away pulse
  if(!G||G.over||ui.warnTurn===G.step) return; ui.warnTurn=G.step;
  var h=null; try{ h=E.hint(G,G.cur); }catch(e){ h=null; } if(!h) return;
  if(h.near){ Sound.sfx("bump"); setTimeout(function(){ Sound.sfx("bump"); },dl(260)); if(!calm()) BD.spire(dl(900),2); }
  if(!calm()){ var sticky=h.ahead.filter(function(a){ return a.kind==="sticky"; }).map(function(a){ return a.at; }); if(sticky.length) BD.warn(sticky); }
}
function drive(){
  clearTimeout(timer);
  if(!G||busy||ui.fpShow){ if(G) syncControls(); return; }
  if(G.over){ syncControls(); finishGame(); return; }
  var my=gen;
  if(paused()){ timer=setTimeout(function(){ if(my===gen) drive(); },300); return; }
  var s=G.cur;
  if(intent&&isHuman(s)&&G.phase==="draw"){ intent=false; act({t:"draw",s:s}); return; }
  intent=false;
  syncControls(); turnStart();
  if(!isHuman(s)){
    var f=1; try{ if(CY.Brain&&CY.Brain.think) f=CY.Brain.think(G,s)||1; }catch(e){ f=1; }
    later(my,function(){ act(cpuMove(s)); },dl(G.phase==="choose"?900:640)*f); return;
  }
  // a hand-off (hot seat) or my turn again: the focus is on the main action at once (not a tick later), so the next OK always lands
  var mc=mainControl(), B=BG(); if(onTV()&&mc&&document.activeElement!==mc){ if(B&&B.focus&&B.focus.enabled&&!mc.disabled&&!mc.hidden) B.focus.set(mc); else focusTV(mc); }
}
/* one action: apply it, save, then play its events in order; the next action waits for the board */
function act(m){
  if(!G||G.over||busy||!m) return false;
  var mv={t:m.t,s:m.s}; if(m.t==="pick") mv.i=m.i;
  var before=G.players.map(function(p){ return p.pos; }), deck0={n:G.deck.length,dn:G.disc.length,top:G.disc.length?G.disc[G.disc.length-1]:null,hand:G.hand.slice(),aside:G.aside.length};
  var r=E.apply(G,mv);
  if(!r.ok){
    if(!isHuman(mv.s)&&!m._fb){ var d=E.defaultMove(G,mv.s); if(d){ d._fb=1; return act(d); } }
    if(isHuman(mv.s)) toast(logFix(r.msg));
    syncControls(); setTimeout(drive,0); return false;
  }
  save();
  var my=gen; busy=true; ui.mover=mv.s; disp=before; dk.n=deck0.n; dk.dn=deck0.dn; dk.top=deck0.top; dk.hand=deck0.hand; dk.aside=deck0.aside; dk.landed={};
  syncControls();
  var line=null; try{ if(CY.Brain&&CY.Brain.react) line=CY.Brain.react(G,r.ev); }catch(e){ line=null; }
  playBatch(my,r.ev,line).then(null,function(e){ try{ console.warn("candy: animation",e); }catch(x){} }).then(function(){
    if(my!==gen) return;
    clearFly(); busy=false; ui.needSync=false; sync(); drive();
  });
  return true;
}

/* ================= the show: every event, paced ================= */
/* the Menu pauses the move: nothing plays (or sounds) behind it; Resume picks it up where it stopped */
async function hold(my){ while(my===gen&&setupShown()) await sleep(150); }
async function playBatch(my,evs,line){
  for(var i=0;i<evs.length;i++){ await hold(my); if(my!==gen) return; await animEvent(my,evs[i],evs[i+1]); }
  await hold(my);
  if(line&&my===gen) say(line);
}
function status(t){ ui.status=t; $("cstat").textContent=t; }
async function banner(title,sub,ms,kind){
  var b=$("cbanner"); $("cbannerT").textContent=title; $("cbannerS").textContent=sub||"";
  b.className="cd-banner"+(kind?" is-"+kind:""); b.classList.add("is-on");
  if(!calm()&&b.animate){
    try{ await b.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.6)"},{opacity:1,transform:"translate(-50%,-50%) scale(1.06)",offset:.18},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.3},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.85},{opacity:0,transform:"translate(-50%,-50%) scale(.97)"}],{duration:ms,easing:"ease-out"}).finished; }catch(e){ await sleep(ms); }
  } else await sleep(ms);
  b.classList.remove("is-on");
}
/* the hop pace: one hop per square at the Game speed; a long trip (a picture card) ramps up after the first squares, never under 120 ms */
function stepMs(i,n){ var base=235*speedFactor(); if(n<=14) return Math.max(120,Math.round(base)); return Math.max(120,Math.round(base*Math.max(.5,1-i/14))); }
async function hops(my,s,path){
  var el=tokEls[s]; if(!el) return;
  el.classList.add("is-moving");
  for(var i=0;i<path.length;i++){
    await hold(my); if(my!==gen) return;
    var ms=stepMs(i,path.length), c=BD.centre(path[i]);
    disp[s]=path[i];
    glide(el,{x:c.x,y:c.y-6,k:1},Math.max(100,Math.round(ms*.64)));
    hop(el,Math.max(100,Math.round(ms*.72))); Sound.sfx("tick");
    await sleep(ms);
    if(i%6===5) renderStand();
  }
}
/* the shortcut: one glide along the ribbon or across the bridge (a keyframe per point of its own curve), while it lights up */
async function shortcutGlide(my,s,from,to){
  var el=tokEls[s], pts=BD.shortcutPts(from), u=unit(); if(!el) return;
  var end=BD.centre(to), len=0, i;
  if(pts) for(i=1;i<pts.length;i++) len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  var ms=Math.max(120,Math.round(Math.min(2400,600+len*1.6)*speedFactor()));
  BD.glow(from,ms+sp(500));
  disp[s]=to; setPose(el,{x:end.x,y:end.y-6,k:1});
  if(calm()||!el.animate||!pts||!u){ await sleep(dl(Math.min(900,ms))); el._p={x:end.x,y:end.y-6,k:1}; return; }
  var kf=[]; for(i=0;i<pts.length;i+=2) kf.push({transform:"translate("+((pts[i].x-end.x)*u).toFixed(1)+"px,"+((pts[i].y-6-(end.y-6))*u).toFixed(1)+"px)"+(i>0&&i<pts.length-2?" scale(1.18)":"")});
  kf.push({transform:"none"});
  try{ await el.animate(kf,{duration:ms,easing:"cubic-bezier(.45,.05,.55,.95)"}).finished; }catch(e){}
}
function shake(el){ if(calm()||!el||!el.animate) return; try{ el.querySelector(".cd-hopw").animate([{transform:"none"},{transform:"translateX(-12%) rotate(-8deg)"},{transform:"translateX(10%) rotate(6deg)"},{transform:"translateX(-6%) rotate(-3deg)"},{transform:"none"}],{duration:sp(460)}); }catch(e){} }

/* ---------- the flying cards ---------- */
var flyEls=[];
function clearFly(){ flyEls.forEach(function(x){ if(x.parentNode) x.parentNode.removeChild(x); }); flyEls=[]; var f=$("cfly"); if(f) f.innerHTML=""; }
function rectOf(el){ var r=el.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height}; }
/* the big spot in front of the board: slot 0 / 1 sit side by side for "draw two" */
function bigRect(slot,two){
  var a=rectOf($("cart")), w=Math.min(a.w*(two?.36:.46),a.h*.42*100/140*1.25), h=w*1.4;
  var cx=a.x+a.w/2+(two?(slot?1:-1)*(w*.56):0), cy=a.y+a.h*.44;
  return {x:cx-w/2,y:cy-h/2,w:w,h:h};
}
function pickRect(i){ var b=$("cpick").querySelectorAll(".cd-pickbtn .cd-cardsvg")[i]; return b&&b.getClientRects().length?rectOf(b):null; }
function pileRect(id){ return rectOf($(id)); }
/* where a set-aside picture card goes ("Picture cards only once"): the "used up" chip (shown by renderPiles before the flight) */
function asideRect(){ var a=$("caside"); if(a&&a.textContent&&a.getClientRects().length){ var r=rectOf(a), w=Math.max(24,r.h*.9); return {x:r.x+r.w/2-w/2,y:r.y+r.h/2-w*.7,w:w,h:w*1.4}; } return null; }
function makeBig(cd,r,caption){
  var el=document.createElement("div"); el.className="cd-big";
  el.style.left=r.x+"px"; el.style.top=r.y+"px"; el.style.width=r.w+"px";
  el.innerHTML='<div class="cd-fl"><i><span class="cd-face">'+BD.cardSVG(cd)+'</span><span class="cd-back">'+BD.backSVG()+"</span></i></div>"+(caption?'<span class="cd-cap">'+esc(caption)+"</span>":"");
  $("cfly").appendChild(el); flyEls.push(el); return el;
}
function fromTo(a,b){ var k=a.w/b.w; return "translate("+(a.x-b.x).toFixed(1)+"px,"+(a.y-b.y).toFixed(1)+"px) scale("+k.toFixed(3)+")"; }
/* the drawn card: from the draw pile, turning over, to the big spot */
async function flipIn(el,from,to){
  if(calm()||!el.animate){ await sleep(dl(120)); return; }
  el.style.transformOrigin="0 0";
  var inner=el.querySelector(".cd-fl > i"), ms=sp(560);
  try{ inner.animate([{transform:"rotateY(180deg)"},{transform:"rotateY(180deg)",offset:.25},{transform:"rotateY(0deg)"}],{duration:ms,easing:"cubic-bezier(.3,.6,.25,1)"}); }catch(e){}
  try{ var cap=el.querySelector(".cd-cap"); if(cap) cap.animate([{opacity:0},{opacity:0,offset:.6},{opacity:1}],{duration:ms}); }catch(e){}
  try{ await el.animate([{transform:fromTo(from,to)},{transform:"none"}],{duration:ms,easing:"cubic-bezier(.22,.7,.2,1)"}).finished; }catch(e){}
}
/* a card flies from where it is (rect a) to rect b, then is gone (the pile or the pick button below it shows it) */
async function flyCard(el,a,b,ms){
  if(!el) return;
  if(calm()||!el.animate||!b){ el.remove(); return; }
  el.classList.add("is-small"); el.style.transformOrigin="0 0";
  try{ await el.animate([{transform:"none"},{transform:fromTo(b,a),opacity:1}],{duration:ms,easing:"cubic-bezier(.4,.1,.3,1)",fill:"forwards"}).finished; }catch(e){}
  el.remove();
}
function cardFly(cd,a,b,ms){ var el=makeBig(cd,a,""); el.classList.add("is-small"); return flyCard(el,a,b,ms); }
var held=[];   // the big cards on show: [{el, id, slot}]
async function landOnDiscard(id,el,from){
  await flyCard(el,from||rectOf(el),pileRect("cdisc"),sp(380));
  dk.top=id; dk.dn++; dk.landed[id]=1; renderPiles(); Sound.sfx("discard");
}
async function animEvent(my,e,next){
  var s=e.s, el=s!=null?tokEls[s]:null, who=s!=null&&G.players[s]?nm(s):"", B=board();
  switch(e.e){
    case "reshuffle":{
      Sound.sfx("deal");
      banner("Reshuffle","The played cards become a new draw pile",dl(1300),"good");
      if(!calm()&&dk.dn){ var a=pileRect("cdisc"), b=pileRect("cdeck"), ps=[];
        for(var k=0;k<Math.min(5,dk.dn);k++){ (function(k){ ps.push(sleep(dl(90)*k).then(function(){ return cardFly(null,a,b,sp(360)); })); })(k); }
        await Promise.all(ps); }
      dk.n=e.n; dk.dn=0; dk.top=null; renderPiles();
      await sleep(dl(500)); return;
    }
    case "draw":{
      if(ui.say&&G.step-(ui.sayStep||0)>=2) say(null);   // a computer's line stays for one more move, then goes
      tokEls.forEach(function(t,q){ t.classList.toggle("is-turn",q===s); });
      var two=G.o.older, slot=two?dk.hand.length:0, cd=e.card;
      status(who+" "+vb(s,"draws")+" "+(slot?"a second card":"a card")+"…");
      dk.n=e.left; renderPiles(); Sound.sfx("draw");
      var to=bigRect(slot,two), big=makeBig(cd,to,BD.cardWords(cd));
      await flipIn(big,pileRect("cdeck"),to);
      if(cd.pic!=null){ Sound.sfx("meld"); }
      status(who+" drew "+(cd.pic!=null?"a picture card: "+BD.cardWords(cd):(cd.n===2?"a double "+CN[cd.c]:CN[cd.c])));
      await sleep(dl(two?520:700));
      await hold(my); if(my!==gen) return;
      var aside=cd.pic!=null&&G.o.treatsOnce&&!two;
      if(two){ dk.hand.push(e.id); renderPick(); var pr=pickRect(dk.hand.length-1); await flyCard(big,to,pr,sp(380)); }
      else if(aside){ dk.aside++; renderPiles(); await flyCard(big,to,asideRect(),sp(380)); dk.landed[e.id]=1; }   // set aside for good: to the "used up" chip, never back into the draw pile
      else await landOnDiscard(e.id,big,to);
      return;
    }
    case "redraw":{
      Sound.sfx("discard");
      if(e.why==="back") await banner("No going back",(isYou(s)?"You draw":who+" draws")+" a new card (picture cards only send you forward)",dl(1500),"good");
      else await banner("Square taken",(isYou(s)?"You draw":who+" draws")+" again",dl(1300),"good");
      return;
    }
    case "choose":{
      renderPick();
      status(isHuman(s)?(nHumans()>1?who+": choose":"Choose")+" one of the two cards":who+" "+vb(s,"looks")+" at both cards…");
      return;
    }
    case "pick":{
      var bs=$("cpick").querySelectorAll(".cd-pickbtn"); if(bs[e.i]) bs[e.i].classList.add("is-picked");
      Sound.sfx("click");
      status(who+" "+(isYou(s)?"play":"plays")+" "+(e.card.pic!=null?"the "+BD.cardWords(e.card)+" card":BD.cardWords(e.card).toLowerCase()));
      await sleep(dl(650));
      return;
    }
    case "stuck":{
      shake(el); Sound.sfx("discard");
      await banner("Still stuck",(isYou(s)?"You need":who+" needs")+" a "+CN[e.need]+" card to get out",dl(1300),"bad");
      return;
    }
    case "stay":{
      shake(el); Sound.sfx("discard");
      await banner("Stay put",e.why==="same"?(isYou(s)?"You are":who+" is")+" already on that square":e.why==="exact"?(isYou(s)?"You need ":who+" needs ")+lastColour()+" to finish":"That square is taken",dl(1300));
      return;
    }
    case "freed":{
      Sound.sfx("coin");
      await banner("Free!","A "+CN[e.c]+" card: out of the "+(B.stickyName[e.at]||"sticky square"),dl(1200),"good");
      return;
    }
    case "move":{
      if(e.kind==="picture"){
        var nmP=E.PIC_NAMES[e.card.pic], back=e.dir<0;
        Sound.sfx("slide");
        status(who+" "+vb(s,"goes")+" "+(back?"back":"ahead")+" to "+nmP+" ("+plural(e.path.length,"square")+")");
        await banner(nmP+"!",(back?"Back ":"Forward ")+plural(e.path.length,"square")+" to square "+e.to,dl(1200),back?"bad":"good");
      } else {
        // count the squares of that colour: the first match glows, then the second (a double)
        for(var m=0;m<e.marks.length;m++){ await hold(my); if(my!==gen) return; BD.mark(e.marks[m],calm()?0:dl(900)); Sound.sfx("click"); await sleep(dl(300)); }
        status(who+" "+vb(s,"hops")+" to "+(e.over?"the end":e.to===E.END&&B.track.charAt(E.END)==="W"?"the rainbow":"square "+e.to));
      }
      await hops(my,s,e.path);
      renderStand();
      await sleep(dl(160));
      return;
    }
    case "bump":{
      status("Taken: "+who+" "+vb(s,"hops")+" on to square "+e.to);
      await banner("Square taken","On to the next square of that colour",dl(1000));
      await hops(my,s,e.path||[]);
      renderStand(); return;
    }
    case "shortcut":{
      await sleep(dl(200));
      Sound.sfx("slide");
      var bridge=B.short[e.from]!=null&&e.from!==5;
      banner(e.name+"!",(bridge?"Across the bridge: ":"Down the ribbon: ")+"square "+e.from+" to "+e.to,dl(1500),"good");
      status(who+" "+vb(s,bridge?"crosses":"glides")+" from "+e.from+" to "+e.to);
      await shortcutGlide(my,s,e.from,e.to);
      Sound.sfx("coin"); renderStand();
      await sleep(dl(320)); return;
    }
    case "sticky":{
      shake(el); Sound.sfx("jail");
      await banner("Stuck!",(B.stickyName[e.at]||"A sticky square")+": "+(isYou(s)?"you are":who+" is")+" stuck until a "+CN[e.need]+" card",dl(1700),"bad");
      renderStand(); return;
    }
    case "licorice":{
      shake(el); Sound.sfx("jail");
      await banner("Licorice!",(B.stickyName[e.at]||"Licorice")+": "+(isYou(s)?"you lose":who+" loses")+" the next turn",dl(1700),"bad");
      renderStand(); return;
    }
    case "discard":{
      if(dk.landed[e.id]){ delete dk.landed[e.id]; return; }
      var hi=dk.hand.indexOf(e.id), from=hi>=0?pickRect(hi):null, cdd=pub(e.id);
      if(hi>=0){ dk.hand.splice(hi,1); }
      if(e.aside){ dk.aside++; renderPiles(); renderPick(); if(from) await cardFly(cdd,from,asideRect(),sp(340)); return; }
      var fl=from?makeBig(cdd,from,""):null; renderPick();
      if(fl){ fl.classList.add("is-small"); await landOnDiscard(e.id,fl,from); }
      else { dk.top=e.id; dk.dn++; renderPiles(); }
      return;
    }
    case "finish":{
      BD.spire(sp(1400),1); renderStand();
      Sound.sfx("win");
      await banner("The Sugarspire!",who+" "+vb(s,"reaches")+" it and "+vb(s,"wins"),dl(2000),"win");
      return;
    }
    case "skip":{
      var se=tokEls[s]; shake(se); Sound.sfx("bump");
      await banner("Lost turn",(isYou(s)?"You lose":nm(s)+" loses")+" this turn (licorice)",dl(1400),"bad");
      return;
    }
    default: return;
  }
}

/* ================= who goes first (RULES.md 2.2; the engine already decided it) ================= */
/* the OK (or tap) that closes the show must not also press the control that gets the focus under it (snakes review: it opened the Menu on TV) */
document.addEventListener("bgui:firstplayer",function(e){ if(e.detail&&e.detail.open===false) ui.fpClosedAt=Date.now(); });
document.addEventListener("click",function(e){
  if(!ui.fpClosedAt||Date.now()-ui.fpClosedAt>450) return;
  var t=e.target&&e.target.closest?e.target.closest("#menuBtn, #drawBtn, #cdeck, #homeBtn, .cd-pickbtn"):null;
  if(t){ e.preventDefault(); e.stopPropagation(); }
},true);
function firstShow(my){
  if(!G) return;
  var B=BG(), fp=B&&B.firstPlayer, f=E.firstPlayer(G), n=G.n, w=f.winner;
  ui.fpShow=true; sync();
  try{ if(CY.Brain&&CY.Brain.warm) CY.Brain.warm(G); }catch(e){}
  try{ var ae=document.activeElement; if(ae&&ae!==document.body&&ae.blur) ae.blur(); }catch(e){}
  if(!fp){ ui.fpShow=false; sync(); drive(); return; }
  // the order the rule gives: the starter, then to the left (seat order); one card per player shows it
  var vals={}, who=[]; for(var s=0;s<n;s++){ who.push(s); vals[s]=((s-w+n)%n)+1; }
  var face=function(v){ return '<span class="cd-fpface"><b>'+v+"<small>"+(["","st","nd","rd","th"][v]||"th")+"</small></b></span>"; };
  setTimeout(function(){ if(my!==gen) return;
    fp({mode:"card",eyebrow:"Who goes first?",title:f.youngest?"The youngest player goes first":"No youngest picked: the first seat starts",
      players:G.players.map(function(p,s){ return {name:p.name,seat:seatNo(s),token:initials(p.name)}; }),rounds:[{who:who,vals:vals,top:[w]}],winner:w,
      face:face,back:'<span class="cd-fpback">'+BD.backSVG()+"</span>",
      label:function(v){ return v===1?(f.youngest?"Youngest":"Seat 1"):"Then "+E.ord(v); },
      result:function(x){ return {title:nm(x)+" "+vb(x,"goes")+" first",sub:f.why}; },
      onWinner:function(){ if(my!==gen) return; ui.fpShow=false; sync(); },
      focus:function(){ return onTV()&&isHuman(G.cur)?$("drawBtn"):null; }
    }).then(function(){ if(my!==gen||!G) return; ui.fpShow=false; sync(); drive(); });
  },0);
}

/* ================= the end: Victory with real numbers and the sorted standings ================= */
function finishGame(){
  if(ui.finished===gen) return; ui.finished=gen;
  try{ if(CY.Brain&&CY.Brain.finish) CY.Brain.finish(G); }catch(e){}
  Saves.del(GAME,"auto"); clockOff();
  var hw=isHuman(G.winner);
  if(!hw&&nHumans()) Sound.sfx("lose");
  syncControls(); renderStand(); renderTokens();
  var my=gen;
  setTimeout(function(){ if(my!==gen) return; if(setupShown()){ menuResult(); return; } openWin(); },dl(700));
}
function openWin(){
  var B=BG(); if(!B||!B.win||!G||!G.over||!luxe()) return;
  ui.winShown=gen; ui.result=false; clockOff();
  var w=G.winner, ms=playMs(), min=Math.floor(ms/60000), single=nHumans()===1, pw=G.players[w];
  $("winEyebrow").textContent="Game over · "+(min<1?"under a minute":min===1?"1 minute":min+" minutes");
  $("winTitle").textContent=(isHuman(w)&&single)?"Victory":nm(w)+" "+vb(w,"wins");
  var sub=(isYou(w)?"You reached":nm(w)+" reached")+" the Sugarspire with "+plural(pw.st.cards,"card")+".", T=G.stats.longestTrip;
  if(T) sub+=" The longest picture trip: "+nm(T.s)+", "+(T.from?"square "+T.from:"the start")+(T.dir<0?" back":"")+" to "+T.to+" ("+plural(T.len,"square")+").";
  if(G.stats.reshuffles) sub+=" The cards ran out "+(G.stats.reshuffles===1?"once":G.stats.reshuffles+" times")+".";
  var rows=E.standings(G), rec=null; try{ rec=CY.Brain&&CY.Brain.records?CY.Brain.records():null; }catch(e){ rec=null; }
  if(rows.some(function(r){ return r.table; })) sub+=" The others are ranked by their square.";
  if(rec&&rec.games>1&&rec.trip) sub+=" Longest trip on this device: "+rec.trip+" squares.";
  $("winSub").textContent=sub;
  $("winList").innerHTML=rows.map(function(r){ var p=G.players[r.s];
    return '<li class="'+(r.place===1?"is-lead":"")+'"><span class="cd-fr">'+r.place+'</span><span class="bg-token" data-seat="'+seatNo(r.s)+'" aria-hidden="true">'+esc(initials(r.name))+'</span><span class="cd-fn">'+esc(r.name)+'</span><span class="cd-fc">'+(p.done?"Home":p.pos?"Square "+p.pos:"Start")+"</span></li>"; }).join("");
  $("winList").classList.toggle("is-grid",rows.length>3);
  var stk=G.stats.stuck+G.stats.lost;
  $("winStats").innerHTML='<li class="bg-stat"><b>'+G.stats.cards+'</b><span>cards</span></li><li class="bg-stat"><b>'+G.stats.pics+"</b><span>"+(G.stats.pics===1?"picture trip":"picture trips")+"</span></li>"+
    '<li class="bg-stat"><b>'+G.stats.shortcuts+"</b><span>"+(G.stats.shortcuts===1?"shortcut":"shortcuts")+'</span></li><li class="bg-stat"><b>'+fmtTime(ms)+"</b><span>time</span></li>";
  $("winStats").title=stk?plural(stk,"turn")+" stuck or lost":"";
  B.win.open($("winBox"),{focus:"#winAgain"});
  if(B.celebrate&&(isHuman(w)||!nHumans()||nHumans()>1)) B.celebrate();
  barTitle();
}
function closeWin(){ var B=BG(); if(B&&B.win&&B.win.isOpen()) B.win.close($("winBox")); }
$("winAgain").addEventListener("click",function(){ closeWin(); $("startBtn").click(); });
$("winMenu").addEventListener("click",function(){ closeWin(); $("menuBtn").click(); });

/* ================= keys, the remote's Back, resize ================= */
function backStep(){
  if(!setupShown()){ $("menuBtn").click(); return "menu"; }
  if(G&&$("resumeBtn").style.display!=="none"&&!ui.cont){ $("resumeBtn").click(); return "resume"; }
  return false;
}
document.addEventListener("visibilitychange",function(){ if(document.hidden) clockOff(); else clockOn(); });
var rsz=0;
window.addEventListener("resize",function(){ clearTimeout(rsz); rsz=setTimeout(function(){ if(!G||setupShown()) return; layoutBoard(); if(!busy) renderTokens(); },120); });

document.addEventListener("DOMContentLoaded",function(){
  register();
  BD.defs();
  mountNames(); drawSeats();
  var B=BG();
  if(B&&B.stage) B.stage(GAME,{frames:"#cboard"}); else Skins.apply(GAME);
  if(B&&B.back) B.back.on(backStep);
  else window.__tvBack=function(){
    if(window.Sound&&Sound.panelOpen&&Sound.panelOpen()){ Sound.closePanel(); return "panel"; }
    var r=backStep(); if(r) return r;
    location.href=$("homeBtn").getAttribute("href"); return "hub";
  };
  if(!B||!B.effects) return;
  document.documentElement.classList.add("cd-luxe");
  // the steppers were built at parse time, before icons.js: give their - and + buttons the icons now
  if(B.icon) document.querySelectorAll(".bg-stepper__btn").forEach(function(b){ if(!b.querySelector("svg")){ var ic=B.icon(+b.dataset.step<0?"minus":"plus"); if(ic) b.innerHTML=ic; } });
  if(B.icon) document.querySelectorAll("[data-icon]").forEach(function(el){ if(!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin",B.icon(el.getAttribute("data-icon"))); });
  var hub=hubHref(); ["homeBtn","backHub","winHome"].forEach(function(id){ var a=$(id); if(a) a.setAttribute("href",hub); });
  saveBar.refresh(); deviceCopy();
  if(ui.cont&&!G) focusTV($("resumeBtn"));   // TV: a saved game waits on Continue
  document.addEventListener("bgui:tv",function(){ deviceCopy(); syncStart(); if(G&&!setupShown()&&!busy) sync(); });
});

Sound.mountButton(); Sound.music(GAME);
loadCfg(); deviceCopy(); drawSetup(); saveBar.refresh(); showSetup(true); contOffer();
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(function(){}); }
/* test hooks: the harnesses read the state and rig cards (E._stack puts these card types on top of the draw pile; test only) */
window.__candy={get G(){ return G; },cfg:cfg,act:act,drive:drive,startGame:startGame,tapDraw:tapDraw,tapPick:tapPick,sync:function(){ if(!busy) sync(); },
  stack:function(types){ if(!G) return false; var used=[], ids=types.map(function(t){ var id=E._find(G,t,used); used.push(id); return id; }); if(ids.indexOf(-1)>=0) return false; E._stack(G,ids); return ids; },
  cpuNames:function(){ return G?G.players.filter(function(p){ return !p.human; }).map(function(p){ return p.name; }):[]; },
  state:function(){ return {busy:busy,intent:intent,fpShow:ui.fpShow,gen:gen,ms:playMs(),winShown:ui.winShown,finished:ui.finished,disp:disp.slice(),dk:JSON.parse(JSON.stringify(dk)),fly:document.querySelectorAll("#cfly .cd-big").length}; }};
})();
