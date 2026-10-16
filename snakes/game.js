/* SNAKES AND LADDERS — the page controller (setup, the board, the pacing of every roll and move, saves, the Menu, TV, the Victory screen).
   The rules live in engine.js (pure, no DOM; Party-ready: snapshot(G, seat)), the computers' characters in brain.js and the board art in
   board.js; this file only drives and shows them.
   - Who goes first (RULES.md 2.2): Classic, everyone rolls the die and the highest starts (ties roll again); American 1978, the same
     with the spinner; American 2021, the youngest player starts (no draw, so no show: a banner names them). The engine decides it in
     newGame(); BGUI.firstPlayer plays that result (skippable, at Game speed) before the first turn.
   - The CEO's rule: a token hops through EVERY square it passes, one hop per square at the Game speed pace (a bounce hops up to 100 and
     back); THEN the ladder or snake plays as its own move: the token climbs rung by rung, or slithers down along the snake's own body,
     while the ladder or snake lights up. Moves are one-shot Web Animations on transform only; reduced motion still steps square by square.
   - Snakes and Ladders has no decisions (RULES.md 6): the only move is the roll. Each computer still has a character (brain.js: a pause
     before a tense roll, a line after a big climb or slide); Computer skill is kept and says plainly that it changes nothing.
   - The person's Roll is queued at once and played the moment the board is free, so a tap is never lost. The engine's events
     (apply().ev) play in order; after each batch the board is drawn again from G, so a reload or Continue shows the same board.
     Saves after every roll (Saves.auto "snakes"). */
(function(){
"use strict";
var S=window.Snakes, E=S.Engine, BD=S.Board;
var $=function(id){ return document.getElementById(id); };
var GAME="snakes";
/* Game speed (SPEED-TASK.md): every computer delay and every move animation x speedFactor(); animations never under 120 ms */
function speedFactor(){ return ({slow:1.75, fast:0.5})[window.bgGameSpeed] || 1 }
function sp(ms){ return Math.max(120,Math.round(ms*speedFactor())); }
function dl(ms){ return Math.round(ms*speedFactor()); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,Math.max(0,ms)); }); }
function normSpeed(v){ return v==="slow"||v==="fast"?v:"medium"; }
function normSkill(v){ return v==="easy"||v==="hard"?v:"normal"; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function BG(){ return window.BGUI||null; }
function luxe(){ var B=BG(); return !!(B&&B.sheet&&B.effects&&document.documentElement.classList.contains("sn-luxe")); }
function onTV(){ return document.documentElement.hasAttribute("data-tv"); }
function icon(n){ var B=BG(); return B&&B.icon?B.icon(n):""; }
function reduced(){ var B=BG(); return document.documentElement.getAttribute("data-motion")==="reduce"||!!(B&&B.reducedMotion&&B.reducedMotion()); }
function calm(){ var B=BG(); return reduced()||!!(B&&B.effects&&B.effects.get&&B.effects.get()==="reduced")||document.hidden; }   // Reduce effects: no lift, no glow
function remPx(){ return parseFloat(getComputedStyle(document.documentElement).fontSize)||16; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function initials(name){ var m=/^(You|Player|CPU)\s*(\d*)$/.exec(String(name)); return m?(m[1]==="You"?"Y":m[1].charAt(0)+m[2]):String(name).charAt(0).toUpperCase(); }
function plural(n,w){ return n+" "+w+(n===1?"":"s"); }
var COLN=["Red","Blue","Green","Yellow","Purple","Teal"];

/* ================= registration: the new-game hooks (commit ae99bbe) ================= */
var GLYPHS={
  snake:'<path d="M17.5 5.5c2 0 3 1.2 3 2.6 0 1.6-1.4 2.6-3.2 2.6H8.4c-2 0-3.4 1.3-3.4 3s1.4 3 3.4 3h7.2c1.4 0 2.4.8 2.4 2s-1 2-2.4 2H6"/><path d="M17.5 5.5c-1.6 0-2.8 1-2.8 2.4"/><circle cx="18.3" cy="7.4" r=".7" fill="currentColor"/><path d="M20.5 8.1l1.6-.6M20.5 8.1l1.4 1"/>',
  ladder:'<path d="M8 3v18M16 3v18M8 6.5h8M8 10.5h8M8 14.5h8M8 18.5h8"/>',
  die:'<rect x="4.5" y="4.5" width="15" height="15" rx="3.2"/><circle cx="9" cy="9" r="1.1" fill="currentColor"/><circle cx="15" cy="15" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
  crest:'<path d="M12 3.5l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.9l-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"/>'
};
var registered=false;
function register(){
  var B=BG(); if(!B||registered) return; registered=true;
  if(B.icon&&B.icon.add){ Object.keys(GLYPHS).forEach(function(k){ B.icon.add(k,GLYPHS[k]); }); if(B.icon.seal&&B.icon.seal.set) B.icon.seal.set(GAME,"snake"); }
  if(B.stage&&B.stage.register) B.stage.register(GAME,{motifs:["snake","ladder","die","crest"]});
}
/* the music: a bright, bouncy major style with its own 10 original song titles (Sound.addStyle, sound.js) */
if(window.Sound&&Sound.addStyle&&!(Sound.hasStyle&&Sound.hasStyle(GAME))){
  Sound.addStyle(GAME,{ scales:["major","mixo","major","dorian"], bpm:[108,136], swing:0.12, sev:false, leadVol:0.08, waves:["triangle","square","triangle"], bassKind:"bounce",
    progs:[[0,4,5,3],[0,3,4,4],[0,5,3,4],[0,2,3,4],[0,4,3,4],[0,5,1,4],[0,3,5,4],[0,1,3,4]],
    bridge:[[3,4,0,5],[5,3,4,4],[1,4,0,0],[3,5,4,4]],
    rhythms:[[1,0,1,0,1,1,0,1],[1,1,0,1,0,1,1,0],[1,0,0,1,1,0,1,0],[1,0,1,1,0,1,0,1]],
    chordSteps:[0,2,4],
    drums:[{kick:[1,0,0,0,1,0,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.07,hat:[1,1,1,1,1,1,1,1],hv:0.03},{kick:[1,0,0,1,0,0,1,0],snare:[0,0,1,0,0,1,0,0],sv:0.08,hat:[1,0,1,0,1,0,1,0],hv:0.04},{kick:[1,0,1,0,1,0,0,1],snare:[0,0,1,0,0,0,1,1],sv:0.06,hat:[0,1,0,1,0,1,0,1],hv:0.035}],
    titles:["Up the Golden Ladder","Hundred Square Hustle","Slither Down Slow","Roll Me a Six","Viper Lime Boogie","The Long Way Home","Rung by Rung","Back to Square One","Penitence and Kindness","Exactly Three to Go"] },
    {wave:"triangle",reg:0});
}

/* ================= state ================= */
var cfg={version:"classic",over:{},humans:1,cpus:1,speed:"medium",skill:"normal",colors:[1,2,3,4,5,6],youngest:0};
var G=null, gen=0, timer=null, busy=false, intent=false, disp=[], tokEls=[], standEls=[];
var ui={fpShow:false,winShown:-1,result:false,rulesOpen:false,finished:-1,needSync:false,lastTurn:-1,warnTurn:-1,cont:false,say:null,beat:-1};
var stats={ms:0}, clock0=0;

function maxP(){ return cfg.over.big?E.MAXBIG:E.MAXP; }
function nPlayers(){ return cfg.humans+cfg.cpus; }
function rawOpts(){ var x={}; for(var k in cfg.over) x[k]=cfg.over[k]; if(x.first==="youngest") x.youngest=cfg.youngest; return E.versionOpts(cfg.version,x); }
function curOpts(){ return E.normalize(rawOpts(),nPlayers()); }
function versionOf(id){ return E.versionOf(id)||E.VERSIONS[0]; }
function isHuman(s){ return !!(G&&G.players[s]&&G.players[s].human); }
function nHumans(){ return G?G.players.filter(function(p){ return p.human; }).length:0; }
function liveGame(){ return !!(G&&!G.over); }
function setupShown(){ return $("setup").style.display!=="none"; }
function paused(){ return liveGame()&&setupShown(); }
function nm(s){ return G.players[s].name; }
function seatNo(s){ return G&&G.players[s]&&+G.players[s].color?+G.players[s].color:s+1; }
function spinWord(){ return G&&G.o.spinner?"spin":"roll"; }
function isYou(s){ return nm(s)==="You"; }
function verbS(s,v){ return isYou(s)?v:v+"s"; }   // "You climb" / "Ava climbs"

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
function colSegHTML(i){ return '<div class="bg-seg sn-colseg" role="group" data-who="'+i+'" aria-label="Colour">'+COLN.map(function(c,k){ return '<button type="button" data-col="'+(k+1)+'" aria-pressed="false"><span class="sn-cdot" data-seat="'+(k+1)+'" aria-hidden="true"></span><small>'+c+"</small></button>"; }).join("")+"</div>"; }
function mountNames(){
  var B=BG(); if(!B||!B.names||nameUI) return;
  nameUI=B.names.mount("#nameCard",{count:Math.max(1,cfg.humans),seat:function(i){ return cfg.colors[i]||i+1; },extra:function(i){ return colSegHTML(i); },onChange:function(){ drawSeats(); }});
  $("nameCard").addEventListener("click",function(e){
    var b=e.target.closest(".sn-colseg button"); if(!b) return;
    var i=+b.closest(".sn-colseg").getAttribute("data-who"), c=+b.dataset.col, j=cfg.colors.indexOf(c);
    if(j>=0&&j!==i&&j<cfg.humans){ cfg.colors[j]=cfg.colors[i]; }   // a colour another person holds: swap
    else if(j>=0&&j!==i){ cfg.colors[j]=cfg.colors[i]; }
    cfg.colors[i]=c; drawSeats(); saveCfg();
  });
}
function paintColours(){
  document.querySelectorAll("#nameCard .sn-colseg").forEach(function(seg){
    var i=+seg.getAttribute("data-who"), one=cfg.humans===1;
    seg.setAttribute("aria-label",one?"Your colour":"Player "+(i+1)+" colour");
    seg.querySelectorAll("button").forEach(function(b){ var on=+b.dataset.col===cfg.colors[i]; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); });
  });
}
function fixColours(){   // a permutation of 1..6 (old settings, bad data)
  var seen={}, out=[];
  (cfg.colors||[]).forEach(function(c){ c=+c; if(c>=1&&c<=6&&!seen[c]){ seen[c]=1; out.push(c); } });
  for(var c=1;c<=6;c++) if(!seen[c]) out.push(c);
  cfg.colors=out.slice(0,6);
}
/* seat colours for a game: the humans' picks, then the computers take the rest in order */
function seatColours(h,n){ fixColours(); var a=cfg.colors.slice(0,h), rest=cfg.colors.slice(h); return a.concat(rest.slice(0,n-h)); }
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
    vs.querySelectorAll(".bg-version").forEach(function(d){ d.addEventListener("click",function(){ if(cfg.version!==d.dataset.v){ cfg.version=d.dataset.v; var big=cfg.over.big; cfg.over={}; if(big) cfg.over.big=true; } drawSetup(); saveCfg(); }); });
  }
  vs.querySelectorAll(".bg-version").forEach(function(d){ var on=cfg.version===d.dataset.v; d.classList.toggle("on",on); d.setAttribute("aria-checked",String(on)); });
  var v=versionOf(cfg.version);
  $("versionDesc").innerHTML="<b>"+esc(v.name)+".</b> "+esc(v.desc);
}
function clampSeats(){
  var mx=maxP(), mn=E.MINP;
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
function drawSeats(){
  clampSeats(); fixColours();
  var mx=maxP(), mn=E.MINP;
  stepper($("humanSeg"),onTV()?"players on this TV":"players on this phone",function(){ return cfg.humans; },function(v){ cfg.humans=v; },0,mx);
  stepper($("cpuSeg"),"computer players",function(){ return cfg.cpus; },function(v){ cfg.cpus=v; },Math.max(0,mn-cfg.humans),mx-cfg.humans);
  if(nameUI){ nameUI.count(Math.max(1,cfg.humans)); nameUI.refresh(); }
  paintColours();
  $("nameCard").closest("section").hidden=cfg.humans===0;
  var n=nPlayers(), names=seatNames(), cols=seatColours(cfg.humans,n);
  $("seatTokens").innerHTML=names.map(function(x,i){ return '<span class="bg-token" data-seat="'+cols[i]+'" aria-hidden="true">'+esc(initials(x))+"</span>"; }).join("");
  $("seatHead").textContent=n+" players"+(cfg.humans===0?" · watch mode":"");
  $("seatNote").textContent=(cfg.humans>1?"Two or more share the "+(onTV()?"remote":"phone")+". ":"")+"Play passes to the left, in this order.";
  $("cpuDesc").textContent=cfg.over.big?"2 to 6 players in all (House: Big table).":"2 to 4 players in all (the official count). 5 or 6: the Big table house rule.";
  syncStart();
}
function hdesc(key){ return (E.HDESC&&E.HDESC[key])||""; }
function drawHouse(){
  var o=curOpts(), n=nPlayers(), box=$("houseRules");
  keepFocus(box,"data-k",function(){
    box.innerHTML="";
    E.houseRows(o.version,n,o).forEach(function(h){
      var key=h[0], tag=h[4]?'<span class="bg-tag bg-tag--house">house</span>':'<span class="bg-tag bg-tag--official">official</span>', row, ds=hdesc(key);
      if(h[2]==="bool"){
        row=document.createElement("label"); row.className="bg-row";
        row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(h[1])+" "+tag+'</span>'+(ds?'<span class="bg-row__desc">'+esc(ds)+"</span>":"")+'</span><input type="checkbox" class="bg-toggle" data-k="'+key+'"'+(o[key]?" checked":"")+">";
        row.querySelector("input").addEventListener("change",function(e){ cfg.over[key]=e.target.checked; if(key==="big"&&!e.target.checked) clampSeats(); drawSetup(); saveCfg(); });
      } else {
        row=document.createElement("div"); row.className="bg-row bg-row--static";
        var val=key==="first"&&o.first!=="youngest"&&cfg.over.first==="youngest"?"youngest":o[key];   // "youngest" with nobody to pick stays shown
        row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(h[1])+" "+tag+'</span>'+(ds?'<span class="bg-row__desc">'+esc(ds)+"</span>":"")+'</span><select class="bg-select" data-k="'+key+'" aria-label="'+esc(h[1])+'">'+h[3].map(function(c){ return '<option value="'+esc(c[0])+'"'+(String(val)===String(c[0])?" selected":"")+">"+esc(c[1])+"</option>"; }).join("")+"</select>";
        row.querySelector("select").addEventListener("change",function(e){ cfg.over[key]=e.target.value; drawSetup(); saveCfg(); });
      }
      box.appendChild(row);
      if(key==="first"&&cfg.over.first==="youngest"){   // American 2021: who is youngest (a person; computers have no age)
        var yr=document.createElement("div"); yr.className="bg-row bg-row--static";
        var hn=seatNames().slice(0,cfg.humans);
        if(!hn.length) yr.innerHTML='<span class="bg-row__main"><span class="bg-row__title">Who is youngest?</span><span class="bg-row__desc">Computers have no age: with no player here, everyone spins and the highest starts.</span></span>';
        else {
          cfg.youngest=clamp(cfg.youngest|0,0,hn.length-1);
          yr.innerHTML='<span class="bg-row__main"><span class="bg-row__title">Who is youngest?</span><span class="bg-row__desc">The youngest player goes first; play passes to the left.</span></span><select class="bg-select" data-k="youngest" aria-label="Who is youngest?">'+
            hn.map(function(x,i){ return '<option value="'+i+'"'+(i===cfg.youngest?" selected":"")+">"+esc(x)+"</option>"; }).join("")+"</select>";
          yr.querySelector("select").addEventListener("change",function(e){ cfg.youngest=+e.target.value; drawSetup(); saveCfg(); });
        }
        box.appendChild(yr);
      }
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
/* the board in play and how long a game runs (the exact solo length of the board under these rules: RULES.md 5) */
function boardLine(){
  var o=curOpts(), b=E.boardOf(o), B0=E.BOARDS[b], nl=0, ns=0, k;
  for(k in B0.L){ if(+B0.L[k]>+k) nl++; else ns++; }
  var e=E.expected(B0.L,o), shuffle=o.board==="shuffle";
  var t=(shuffle?"A shuffled board, new each game: "+nl+" ladders and "+ns+" snakes like the "+B0.name+", and about as long.":B0.name+": "+nl+" ladders and "+ns+" snakes.")+
    (isFinite(e)?" One player alone needs about "+Math.round(e)+" rolls to reach 100.":"");
  // against the same board under the Version's own rules: say whether these house rules make the game shorter or longer
  var base=E.expected(B0.L,E.normalize(E.versionOpts(cfg.version,{board:o.board}),nPlayers()));
  if(isFinite(e)&&isFinite(base)&&e<base*.95) t+=" Shorter than the official rules (about "+Math.round(base)+").";
  else if(isFinite(e)&&isFinite(base)&&e>base*1.05) t+=" Longer than the official rules (about "+Math.round(base)+").";
  else if(o.finish!=="over") t+=" For a shorter game, try the house rule Any roll to 100 wins.";
  $("boardLine").textContent=t;
}
function skillNote(){ $("skillNote").textContent=(S.Brain&&S.Brain.NOTE)||"Skill makes no difference in Snakes and Ladders: it is pure luck, and every player just rolls."; }
function drawSetup(){ clampSeats(); drawVersions(); drawSeats(); drawHouse(); skillNote(); syncStart(); }
$("rulesToggle").addEventListener("click",function(){ ui.rulesOpen=!ui.rulesOpen; syncRules(); });
function setSpeedSeg(){ cfg.speed=normSpeed(cfg.speed); window.bgGameSpeed=cfg.speed; $("speedSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.s===cfg.speed; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("speedSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.speed=b.dataset.s; setSpeedSeg(); save(); saveCfg(); }); });
function setSkillSeg(){ cfg.skill=normSkill(cfg.skill); if(G) G.skill=cfg.skill; $("skillSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.k===cfg.skill; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("skillSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.skill=b.dataset.k; setSkillSeg(); save(); saveCfg(); }); });
setSpeedSeg();
function deviceCopy(){
  var tv=onTV(), t=tv?"Players on this TV":"Players on this phone";
  $("humansTitle").textContent=t; $("humanSeg").setAttribute("aria-label",t);
  $("humansDesc").textContent="0 = watch the computers play. Two or more share the "+(tv?"remote":"phone")+".";
  if($("humanSeg").querySelector(".bg-stepper__btn")) drawSeats();
  syncControls();
}
function subParts(parts){ return parts.map(function(s,i){ return '<span class="sn-nw">'+esc(s)+(i<parts.length-1?" ·":"")+"</span>"; }).join(" "); }
function syncStart(){
  var rb=$("resumeBtn"), sb=$("startBtn"), resumable=rb.style.display!=="none";
  $("startLabel").textContent=resumable?"New game":"Start the game";
  var o=curOpts(), parts=[nPlayers()+" players",versionOf(cfg.version).name];
  if(!resumable){ var b=E.boardOf(o); if(o.board!=="auto") parts.push(o.board==="shuffle"?"shuffled board":E.BOARDS[b].name.replace(/ \(.*\)/,"")); if(changedRules()) parts.push("custom rules"); }
  $("startSub").innerHTML=subParts(parts);
  $("startDock").classList.toggle("has-resume",resumable);
  sb.classList.toggle("bg-btn--primary",!resumable); sb.classList.toggle("bg-btn--secondary",resumable);
  rb.classList.toggle("bg-btn--primary",resumable); rb.classList.toggle("bg-btn--secondary",!resumable);
}
function resultDue(){ var B=BG(); return !!(G&&G.over&&ui.finished===gen&&ui.winShown!==gen&&B&&B.win&&luxe()); }   // only once the winning move has played: no spoiler mid-move
function resumeText(){
  if(ui.result) return;
  var s="Back to the game";
  if(G&&!G.over) s="Turn "+G.turn+" · "+nm(G.cur)+(isYou(G.cur)?" are":" is")+" on "+(G.players[G.cur].pos?"square "+G.players[G.cur].pos:"the start");
  $("resumeLabel").textContent="Resume"; $("resumeSub").textContent=s;
}
function menuResult(){
  if(!resultDue()) return;
  ui.result=true; $("resumeBtn").style.display="block";
  $("resumeLabel").textContent="See the result"; $("resumeSub").textContent=nm(G.winner)+(isYou(G.winner)?" win":" wins");
  saveBar.refresh(); syncStart(); barTitle();
}
function showSetup(on,resume){
  var s=$("setup"), b=document.body, se=document.scrollingElement||document.documentElement, y=se.scrollTop;
  if(on) clockOff();
  s.style.display=on?"":"none";
  b.classList.toggle("sn-in-setup",on); b.classList.toggle("bg-app--scene",on); b.classList.toggle("bg-app--felt",!on);
  $("menuBtn").hidden=on;
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
  var t=paused()?"Paused":setupShown()?(liveGame()?"Game in progress":(ui.result?"Game over":"New game")):(!G?"New game":G.over?"Game over":ui.fpShow?"Who goes first?":"Turn "+G.turn);
  if(e.textContent!==t) e.textContent=t;
}

/* ================= saving ================= */
function pack(){ if(!G) return null; return {G:JSON.parse(JSON.stringify(G)),cfg:JSON.parse(JSON.stringify(cfg)),stats:{ms:Math.round(playMs())}}; }
function save(){ if(!G) return; if(G.over){ Saves.del(GAME,"auto"); return; } var pk=pack(); if(pk) Saves.auto(GAME,pk); }
function saveCfg(){ try{ localStorage.setItem("snakes_cfg",JSON.stringify({version:cfg.version,over:cfg.over,humans:cfg.humans,cpus:cfg.cpus,speed:cfg.speed,skill:cfg.skill,colors:cfg.colors,youngest:cfg.youngest})); }catch(e){} }
function loadCfg(){ try{ var c=JSON.parse(localStorage.getItem("snakes_cfg")||"null"); if(c&&typeof c==="object") applySettings(c,true); }catch(e){} }
function loadSaved(d){
  if(!d||!d.G||d.G.id!=="snakes"||d.G.v!==E.VER) throw new Error("not a Snakes and Ladders save");
  var bad=E.check(d.G); if(bad.length) throw new Error("save fails its check: "+bad[0]);
  gen++; clearTimeout(timer); busy=false; intent=false;
  G=d.G; var c=d.cfg||{}; for(var k in c) if(Object.prototype.hasOwnProperty.call(cfg,k)) cfg[k]=c[k];
  cfg.speed=normSpeed(cfg.speed); setSpeedSeg(); cfg.skill=normSkill(c.skill||G.skill); G.skill=cfg.skill; setSkillSeg(); fixColours();
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
  cfg.speed=normSpeed(s.speed); cfg.skill=normSkill(s.skill); cfg.colors=Array.isArray(s.colors)?s.colors.slice():[1,2,3,4,5,6]; cfg.youngest=+s.youngest||0;
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
  var d=a&&a.data; if(!d||!d.G||d.G.over||d.G.id!=="snakes") return false;
  ui.cont=true; $("resumeBtn").style.display="block"; $("resumeLabel").textContent="Continue";
  var p=d.G.players&&d.G.players[0];
  $("resumeSub").textContent="Turn "+((+d.G.turn)||1)+" · "+d.G.n+" players"+(Saves.when&&a.ts?" · "+Saves.when(a.ts):"");
  syncStart(); return true;
}
// the new game is set up before the board shows, so the old game never flashes back
$("startBtn").addEventListener("click",function(){ Sound.skip(); closeWin(); startGame(); showSetup(false); armBack(); firstShow(gen); });

/* ================= a new game ================= */
function startGame(){
  gen++; clearTimeout(timer); clampSeats(); busy=false; intent=false;
  var n=nPlayers(), hn=humanNames(cfg.humans)||[], i;
  for(i=hn.length;i<cfg.humans;i++) hn.push(cfg.humans===1?"You":"Player "+(i+1));
  var cn=cpuNames(cfg.cpus,hn), cols=seatColours(cfg.humans,n), players=[];
  for(i=0;i<n;i++){ var h=i<cfg.humans; players.push({name:h?hn[i]:cn[i-cfg.humans],human:h,color:String(cols[i])}); }
  G=E.newGame(rawOpts(),players); G.skill=normSkill(cfg.skill);
  stats={ms:0}; clock0=0; ui.winShown=-1; ui.result=false; ui.finished=-1; ui.lastTurn=-1; ui.warnTurn=-1; ui.say=null;
  say(null);
  ui.fpShow=true;   // set before the board and the strip are first drawn: no turn ring names the first player while the show still rolls
  startUI(); save(); saveCfg();
}
function startUI(){
  Sound.music(GAME);
  buildBoard();
}

/* ================= the board ================= */
var R=31;   // a token's radius in board units (a square is 100)
function unit(){ var a=$("sart"); return a?a.clientWidth/BD.W:0; }
function buildBoard(){
  BD.build($("ssvg"),G.L,G.bd);
  var box=$("stoks"); box.innerHTML=""; tokEls=[];
  disp=G.players.map(function(p){ return p.pos; });
  G.players.forEach(function(p,s){
    var el=document.createElement("div"); el.className="sn-tok"; el.setAttribute("data-seat",seatNo(s)); el.setAttribute("data-s",s);
    el.innerHTML='<div class="sn-hopw"><span class="bg-token" data-seat="'+seatNo(s)+'">'+esc(initials(p.name))+"</span></div>";
    box.appendChild(el); tokEls.push(el);
  });
  $("game").classList.toggle("is-multi",G.n>4);
  $("sart").setAttribute("aria-label",(G.bd==="shuffle"?"A shuffled board":E.BOARDS[G.bd].name)+": "+Object.keys(G.L).filter(function(k){ return +G.L[k]>+k; }).length+" ladders and "+Object.keys(G.L).filter(function(k){ return +G.L[k]<+k; }).length+" snakes");
  dice();
  buildStand();
  layoutBoard();
}
function layoutBoard(){
  var u=unit(); if(!u) return false;
  BD.numbers(u,onTV()?remPx()*.875:12);
  $("stoks").style.setProperty("--tw",Math.round(2*R*u)+"px");
  return true;
}
/* where each token rests: the start rail (by seat), else its square; tokens sharing a square fan out */
var FAN={1:[[0,0]],2:[[-19,-6],[19,6]],3:[[-20,-12],[20,-12],[0,16]],4:[[-21,-19],[21,-19],[-21,19],[21,19]],5:[[-27,-22],[27,-22],[0,0],[-27,22],[27,22]],6:[[-28,-21],[0,-21],[28,-21],[-28,21],[0,21],[28,21]]};
function restPose(s,pos,all){
  if(!pos) return {x:BD.startSlot(s,G.n).x,y:BD.startSlot(s,G.n).y,k:G.n>4?.9:1};
  var c=BD.centre(pos), here=all.filter(function(q){ return disp[q]===pos; });
  if(here.length<2) return {x:c.x,y:c.y,k:1};
  var i=here.indexOf(s), f=FAN[Math.min(6,here.length)][i]||[0,0];
  return {x:c.x+f[0],y:c.y+f[1],k:here.length>3?.68:.74};
}
function setPose(el,p){
  el._p=p; var r=R*(p.k||1);
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
/* one glide from the token's last pose to p (FLIP: the token is placed at p, then slides from where it was) */
function glide(el,p,ms,ease){
  var from=el._p||p, u=unit(); setPose(el,p);
  if(calm()||!el.animate||!ms||!u) return Promise.resolve();
  var k0=(from.k||1)/(p.k||1), dx=(from.x-p.x)*u, dy=(from.y-p.y)*u;
  try{ return el.animate([{transform:"translate("+dx.toFixed(1)+"px,"+dy.toFixed(1)+"px) scale("+k0.toFixed(3)+")"},{transform:"none"}],{duration:ms,easing:ease||"cubic-bezier(.3,.7,.3,1)"}).finished.then(function(){},function(){}); }catch(e){ return Promise.resolve(); }
}
function hop(el){ var B=BG(), w=el.querySelector(".sn-hopw"); if(B&&B.hop&&w&&!calm()) B.hop(w,{ms:sp(170),lift:Math.max(5,Math.round(unit()*18))}); }

/* the die (Classic, two dice with the house rule) or the American spinner beside the Roll button */
function dice(){
  var box=$("sdice"); if(!G){ box.innerHTML=""; return; }
  var key=G.o.spinner?"spin":G.o.two?"two":"one"; if(box._k===key) return; box._k=key;
  if(G.o.spinner){ box.innerHTML=BD.spinnerSVG(); box._a=0; }
  else { box.innerHTML='<span class="bg-die"></span>'+(G.o.two?'<span class="bg-die"></span>':""); var B=BG(); box.querySelectorAll(".bg-die").forEach(function(d,i){ if(B&&B.dice) B.dice.render(d,i?6:5); }); }
}
function showRoll(d,anim){
  var box=$("sdice"), B=BG();
  if(G.o.spinner){
    var ar=box.querySelector(".sn-arrow"); if(!ar) return Promise.resolve();
    var to=(d[0]-1)*60+(Math.random()*24-12), a0=box._a||0, a1=to+360*Math.ceil((a0+720-to)/360);
    box._a=a1%360;
    if(!anim||calm()||!ar.animate){ ar.style.transform="rotate("+box._a.toFixed(1)+"deg)"; return sleep(anim?dl(300):0); }
    ar.style.transform="rotate("+box._a.toFixed(1)+"deg)";
    Sound.sfx("tick");
    try{ return ar.animate([{transform:"rotate("+a0.toFixed(1)+"deg)"},{transform:"rotate("+a1.toFixed(1)+"deg)"}],{duration:sp(900),easing:"cubic-bezier(.15,.6,.2,1)"}).finished.then(function(){},function(){}); }catch(e){ return Promise.resolve(); }
  }
  var dd=box.querySelectorAll(".bg-die"), ps=[];
  dd.forEach(function(el,i){ if(B&&B.dice){ if(anim&&!calm()) ps.push(B.dice.roll(el,d[i],{ms:sp(600)})); else B.dice.render(el,d[i]); } });
  Sound.sfx("dice");
  return ps.length?Promise.all(ps):sleep(anim?dl(250):0);
}

/* ---------- the standings: always sorted, leader first ---------- */
function buildStand(){
  var ul=$("sstand"); ul.innerHTML=""; standEls=[];
  G.players.forEach(function(p,s){
    var li=document.createElement("li"); li.className="bg-player"; li.setAttribute("data-seat",seatNo(s)); li.setAttribute("data-s",s);
    li.innerHTML='<span class="sn-rk"></span><span class="bg-token" aria-hidden="true">'+esc(initials(p.name))+"</span>"+(p.human?"":'<span class="bg-player__cpu" title="Computer">'+icon("cpu")+"</span>")+
      '<span class="bg-player__txt"><span class="bg-player__name">'+esc(p.name)+'</span><span class="bg-player__meta"></span></span><span class="sn-bar" aria-hidden="true"><i></i></span>';
    ul.appendChild(li); standEls.push(li);
  });
}
function standRows(){
  if(!busy) return E.standings(G);
  // mid-animation the order follows the tokens on the board (disp), not the state the roll has already reached
  var rows=G.players.map(function(p,s){ var done=disp[s]===100; return {s:s,name:p.name,pos:disp[s],done:done,fin:done?(G.fin.indexOf(s)<0?99:G.fin.indexOf(s)):-1,at:p.at,table:!done}; });
  rows.sort(function(a,b){ if(a.done!==b.done) return a.done?-1:1; if(a.done) return a.fin-b.fin; if(b.pos!==a.pos) return b.pos-a.pos; return a.s-b.s; });
  rows.forEach(function(r,i){ var pv=rows[i-1]; r.place=pv&&!pv.done&&!r.done&&pv.pos===r.pos?pv.place:i+1; });
  return rows;
}
function renderStand(){
  if(!G||!standEls.length) return;
  var rows=standRows(), ul=$("sstand"), B=BG(), before=standEls.map(function(li){ return li.getBoundingClientRect(); }), moved=false;
  rows.forEach(function(r,i){
    var li=standEls[r.s], pos=busy?disp[r.s]:G.players[r.s].pos, done=busy?pos===100:G.players[r.s].done;
    li.querySelector(".sn-rk").textContent=String(r.place);
    var tight=G.n>4&&!onTV();   // 5-6 players on a phone: three chips a row, so the meta is just the square
    li.querySelector(".bg-player__meta").textContent=done?(tight?"Home":"Home · "+E.ord(G.players[r.s].place||r.place)):pos?(tight?"Sq "+pos:"Square "+pos):"Start";
    li.querySelector(".sn-bar > i").style.transform="scaleX("+(pos/100).toFixed(3)+")";
    if(ul.children[i]!==li){ ul.insertBefore(li,ul.children[i]||null); moved=true; }
  });
  if(moved&&B&&B.flip&&!reduced()) standEls.forEach(function(li,s){ B.flip(li,before[s],{ms:sp(320)}); });
  var turn=(G.over||ui.fpShow)?-1:G.cur;
  if(B&&B.setTurn&&turn>=0){ B.setTurn(standEls[turn],{pulse:turn!==ui.lastTurn&&!setupShown()&&!document.hidden}); ui.lastTurn=turn; }
  else standEls.forEach(function(li){ li.classList.remove("is-turn"); });
}

/* ---------- the log ---------- */
function youFix(t){
  return String(t).replace(/\bYou (reaches|wins|rolls|spins|is|goes|climbs|slides|stays|needs|has)\b/g,function(m,v){ return "You "+({reaches:"reach",wins:"win",rolls:"roll",spins:"spin",is:"are",goes:"go",climbs:"climb",slides:"slide",stays:"stay",needs:"need",has:"have"})[v]; })
    .replace(/(You [^.!]*?) and (wins|goes)\b/g,function(m,a,v){ return a+" and "+(v==="wins"?"win":"go"); })
    .replace(/: needs/g,": need").replace(/\. Stays\./g,". Stay.");
}
function logFix(t){ return youFix(String(t).replace(/ → /g," to ")); }   // the font subsets have no arrows: write "to"
function renderLog(){
  var ul=$("slog"); if(!G){ ul.innerHTML=""; return; }
  var L=G.log.slice(-6); ul.innerHTML=L.map(function(e){ return "<li>"+esc(logFix(e.t))+"</li>"; }).join("");
}

/* ---------- the status line, the Roll button, the chips ---------- */
function mainControl(){ var rb=$("rollBtn"); if(!rb.hidden&&!rb.disabled) return rb; return $("menuBtn"); }
function syncControls(){
  if(!G) return;
  var tv=onTV(), nh=nHumans(), cur=G.cur, hum=!G.over&&isHuman(cur), rb=$("rollBtn"), st="", w=spinWord();
  var allDone=nh>0&&G.players.every(function(p){ return !p.human||p.done; });
  rb.hidden=!nh||G.over||allDone;
  rb.disabled=!hum||ui.fpShow||intent||(busy&&ui.mover!==cur);
  $("rollLabel").textContent=(G.sixes>0&&hum&&!busy?(w==="spin"?"Spin again":"Roll again"):(w==="spin"?"Spin":"Roll"));
  var pc=G.players[cur];
  $("rollSub").textContent=G.over?"":busy?"Next: "+nm(cur):hum?(nh>1?nm(cur)+"'s turn":(pc.pos?"On square "+pc.pos:"From the start")):nm(cur)+"'s turn";
  if(ui.fpShow) st=G.o.spinner?"Everyone spins: the highest goes first":"Everyone rolls: the highest goes first";
  else if(G.over) st=nm(G.winner)+(isYou(G.winner)?" win":" wins")+"!";
  else if(busy) st=ui.status||"";
  else if(hum&&!intent){
    var lead=nh>1?nm(cur)+"'s turn":"Your turn";
    st=lead+": "+(tv?"press OK to "+w:"tap "+(w==="spin"?"Spin":"Roll"))+(G.sixes>0?" again":"");
  }
  else if(hum) st=nm(cur)+(isYou(cur)?" are ":" is ")+(w==="spin"?"spinning":"rolling");
  else if(!nh) st="Watching "+G.n+" computers · "+nm(cur)+" "+(w==="spin"?"spins":"rolls")+" next";
  else st="Waiting for "+nm(cur)+" to "+w;
  if(allDone&&!G.over) st=(nh>1?"Everyone here is home":"You are home")+": the computers play on for places. The Menu starts a new game.";
  $("sstat").textContent=st;
  $("hintOk").textContent=(!nh||G.over||allDone)?"Open the Menu":(w==="spin"?"Spin":"Roll");
  chips(); barTitle();
}
function chips(){
  if(!G) return;
  var c=$("sneed"), r=$("sround"), t="", s=G.cur, p=G.players[s];
  if(!G.over&&!ui.fpShow&&p&&!p.done&&disp[s]===p.pos&&p.pos>=88){ var left=100-p.pos;
    t=G.o.finish==="stay"&&left<=6&&!G.o.two?(isYou(s)?"You need":nm(s)+" needs")+" exactly "+left:nm(s)+": "+left+" to go"; }
  c.textContent=t; c.classList.toggle("is-hot",!!t);
  var rt=ui.fpShow?"":"Turn "+G.turn+(G.bd==="shuffle"?" · shuffled board":"");
  if(r.textContent!==rt) r.textContent=rt;
}
function sync(){
  if(!G) return;
  disp=G.players.map(function(p){ return p.pos; });
  layoutBoard(); renderTokens(); renderStand(); renderLog(); syncControls(); dice();
}
function say(r){
  var el=$("ssay");
  if(!r||!G||!G.players[r.s]){ el.innerHTML=""; ui.say=null; return; }
  ui.say=r; ui.sayStep=G.step; el.innerHTML='<span class="bg-token" data-seat="'+seatNo(r.s)+'" aria-hidden="true">'+esc(initials(nm(r.s)))+"</span><span>"+esc(nm(r.s))+": “"+esc(r.text)+"”</span>";
}

/* ================= the turn: queue the person's roll, pace the computers ================= */
$("rollBtn").addEventListener("click",function(){ tapRoll(); });
$("sdice").addEventListener("click",function(){ tapRoll(); });
function tapRoll(){
  if(!G||G.over||ui.fpShow||setupShown()) return;
  if(!isHuman(G.cur)||intent) return;
  if(busy&&ui.mover!==G.cur) return;   // hot-seat: a double tap during this move must not roll for the next person
  intent=true; syncControls();
  if(!busy) drive();
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
function cpuMove(s){ var m=null; try{ if(S.Brain) m=S.Brain.decide(G,s); }catch(e){ m=null; } return m||E.defaultMove(G,s); }
function turnStart(){
  // once per turn: the tension cues near 100 (a heartbeat, the remaining distance) and the snake heads within one roll pulse
  if(!G||G.over||ui.warnTurn===G.step) return; ui.warnTurn=G.step;
  var h=E.hint(G,G.cur); if(!h) return;
  if(h.near){ Sound.sfx("bump"); setTimeout(function(){ Sound.sfx("bump"); },dl(260)); }
  if(!calm()){ var heads=h.ahead.filter(function(a){ return a.kind==="snake"; }).map(function(a){ return a.at; }); if(heads.length) BD.warn(heads); }
}
function drive(){
  clearTimeout(timer);
  if(!G||busy||ui.fpShow){ if(G) syncControls(); return; }
  if(G.over){ syncControls(); finishGame(); return; }
  var my=gen;
  if(paused()){ timer=setTimeout(function(){ if(my===gen) drive(); },300); return; }
  var s=G.cur;
  if(intent&&isHuman(s)){ intent=false; act({t:"roll",s:s}); return; }
  intent=false;
  syncControls(); turnStart();
  if(!isHuman(s)){
    var f=1; try{ if(S.Brain&&S.Brain.think) f=S.Brain.think(G,s)||1; }catch(e){ f=1; }
    later(my,function(){ act(cpuMove(s)); },dl(G.sixes>0?480:620)*f); return;
  }
  var mc=mainControl(); if(onTV()&&mc&&document.activeElement!==mc) focusTV(mc);
}
/* one roll: apply it, save, then play its events in order; the next roll waits for the board */
function act(m){
  if(!G||G.over||busy||!m) return false;
  var mv={t:m.t,s:m.s}, before=G.players.map(function(p){ return p.pos; });
  var r=E.apply(G,mv);
  if(!r.ok){
    if(!isHuman(mv.s)&&!m._fb){ var d=E.defaultMove(G,mv.s); if(d){ d._fb=1; return act(d); } }
    if(isHuman(mv.s)) toast(logFix(r.msg));
    syncControls(); setTimeout(drive,0); return false;
  }
  save();
  var my=gen; busy=true; ui.mover=mv.s; disp=before; syncControls();
  var line=null; try{ if(S.Brain&&S.Brain.react) line=S.Brain.react(G,r.ev); }catch(e){ line=null; }
  playBatch(my,r.ev,line).then(null,function(e){ try{ console.warn("snakes: animation",e); }catch(x){} }).then(function(){
    if(my!==gen) return;
    busy=false; ui.needSync=false; sync(); drive();
  });
  return true;
}

/* ================= the show: every event, paced ================= */
/* the Menu pauses the move: nothing plays (or sounds) behind it; Resume picks it up where it stopped */
async function hold(my){ while(my===gen&&setupShown()) await sleep(150); }
async function playBatch(my,evs,line){
  for(var i=0;i<evs.length;i++){ await hold(my); if(my!==gen) return; await animEvent(my,evs[i]); }
  await hold(my);
  if(line&&my===gen) say(line);
}
function status(t){ ui.status=t; $("sstat").textContent=t; }
async function banner(title,sub,ms,kind){
  var b=$("sbanner"); $("sbannerT").textContent=title; $("sbannerS").textContent=sub||"";
  b.className="sn-banner"+(kind?" is-"+kind:""); b.classList.add("is-on");
  if(!calm()&&b.animate){
    try{ await b.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.6)"},{opacity:1,transform:"translate(-50%,-50%) scale(1.06)",offset:.18},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.3},{opacity:1,transform:"translate(-50%,-50%) scale(1)",offset:.85},{opacity:0,transform:"translate(-50%,-50%) scale(.97)"}],{duration:ms,easing:"ease-out"}).finished; }catch(e){ await sleep(ms); }
  } else await sleep(ms);
  b.classList.remove("is-on");
}
function label(at){ var w=G.labels&&G.labels[at]; return w?w:""; }
async function hops(my,s,path){
  var el=tokEls[s]; if(!el) return;
  el.classList.add("is-moving");
  for(var i=0;i<path.length;i++){
    await hold(my); if(my!==gen) return;
    disp[s]=path[i];
    glide(el,{x:BD.centre(path[i]).x,y:BD.centre(path[i]).y,k:1},sp(150));
    hop(el); Sound.sfx("tick");
    await sleep(sp(235));
  }
}
async function climb(my,s,foot,to){
  var el=tokEls[s], mids=BD.rungs(foot), u=unit(); if(!el) return;
  var end=BD.centre(to), n=mids?mids.length:0, per=clamp(Math.round(1700/Math.max(1,n)),70,140), ms=Math.max(120,Math.round(per*n*speedFactor()));
  BD.glow(foot,ms+sp(500));
  disp[s]=to; setPose(el,{x:end.x,y:end.y,k:1});
  if(calm()||!el.animate||!n||!u){ await sleep(dl(Math.min(900,per*n))); el._p={x:end.x,y:end.y,k:1}; return; }
  var kf=mids.map(function(p,i){ return {transform:"translate("+((p.x-end.x)*u).toFixed(1)+"px,"+((p.y-end.y)*u).toFixed(1)+"px)",offset:i/n,easing:"cubic-bezier(.3,.8,.35,1)"}; });
  kf.push({transform:"none",offset:1});
  for(var t=0;t<n;t+=2){ (function(t){ setTimeout(function(){ if(my===gen) Sound.sfx("click"); },Math.round(ms*t/n)); })(t); }
  try{ await el.animate(kf,{duration:ms}).finished; }catch(e){}
}
async function slither(my,s,head,to){
  var el=tokEls[s], pts=BD.snakePts(head), u=unit(); if(!el) return;
  var end=BD.centre(to), len=0, i;
  if(pts) for(i=1;i<pts.length;i++) len+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].y-pts[i-1].y);
  var ms=Math.max(120,Math.round(Math.min(2600,500+len*1.25)*speedFactor()));
  BD.glow(head,ms+sp(500));
  disp[s]=to; setPose(el,{x:end.x,y:end.y,k:1});
  if(calm()||!el.animate||!pts||!u){ await sleep(dl(Math.min(1000,ms))); el._p={x:end.x,y:end.y,k:1}; return; }
  var kf=[], stepN=Math.max(1,Math.floor(pts.length/40));
  for(i=0;i<pts.length;i+=stepN) kf.push({transform:"translate("+((pts[i].x-end.x)*u).toFixed(1)+"px,"+((pts[i].y-end.y)*u).toFixed(1)+"px)"});
  kf.push({transform:"none"});
  try{ await el.animate(kf,{duration:ms,easing:"cubic-bezier(.45,.05,.6,.95)"}).finished; }catch(e){}
}
function shake(el){ if(calm()||!el||!el.animate) return; try{ el.querySelector(".sn-hopw").animate([{transform:"none"},{transform:"translateX(-12%)"},{transform:"translateX(10%)"},{transform:"translateX(-6%)"},{transform:"none"}],{duration:sp(420)}); }catch(e){} }
async function animEvent(my,e){
  var s=e.s, el=tokEls[s], who=s!=null&&G.players[s]?nm(s):"";
  switch(e.e){
    case "roll":{
      if(ui.say&&G.step-(ui.sayStep||0)>=2) say(null);   // a computer's line stays for one more move, then goes
      tokEls.forEach(function(t,q){ t.classList.toggle("is-turn",q===s); });
      status(who+" "+(e.spin?(isYou(s)?"spin":"spins"):(isYou(s)?"roll":"rolls"))+"…");
      await showRoll(e.d,true);
      status(who+" "+(e.spin?"spun":"rolled")+" "+(e.d.length>1?e.d[0]+" + "+e.d[1]+" = "+e.tot:e.tot)+(e.six?"!":""));
      await sleep(dl(220));
      return;
    }
    case "move":{
      await hops(my,s,e.path);
      if(e.bounce) status(who+" "+verbS(s,"bounce")+" back from 100 to "+e.to);
      renderStand();
      await sleep(dl(140));
      return;
    }
    case "ladder":{
      await sleep(dl(180));
      var lw=label(e.from);
      Sound.sfx("meld");
      banner("Ladder!",(lw?lw+": ":"")+e.from+" to "+e.to,dl(1500),"ladder");
      status(who+" "+verbS(s,"climb")+" from "+e.from+" to "+e.to);
      await climb(my,s,e.from,e.to);
      Sound.sfx("coin");
      renderStand();
      await sleep(dl(320));
      return;
    }
    case "snake":{
      await sleep(dl(180));
      var sw=label(e.from);
      Sound.sfx("slide");
      banner("Snake!",(sw?sw+": ":"")+e.from+" down to "+e.to,dl(1500),"snake");
      status(who+" "+verbS(s,"slide")+" down from "+e.from+" to "+e.to);
      await slither(my,s,e.from,e.to);
      Sound.sfx("bump");
      renderStand();
      await sleep(dl(320));
      return;
    }
    case "stay": shake(el); Sound.sfx("discard"); await banner("Stay put",(isYou(s)?"You need":who+" needs")+" exactly "+e.need+" to reach 100",dl(1300)); return;
    case "wait": shake(el); Sound.sfx("discard"); await banner("Needs a 6",who+" "+(isYou(s)?"need":"needs")+" a 6 to start",dl(1200)); return;
    case "void": Sound.sfx("bell"); await banner("Third 6",(isYou(s)?"Your":who+"'s")+" third 6 in a row doesn't count",dl(1400)); return;
    case "restart":{
      Sound.sfx("jail");
      banner("Back to the start","Three 6s in a row",dl(1500),"snake");
      disp[s]=e.to; el.classList.add("is-moving");
      await glide(el,restPose(s,e.to,[s]),sp(900),"cubic-bezier(.5,0,.5,1)");
      renderStand(); return;
    }
    case "again": Sound.sfx("turn"); await banner("A 6!",who+" "+(e.spin||G.o.spinner?(isYou(s)?"spin":"spins"):(isYou(s)?"roll":"rolls"))+" again",dl(950)); return;
    case "finish":{
      BD.crest(sp(1400)); renderStand();
      if(e.place===1){ Sound.sfx("win"); await banner("100!",who+" "+(isYou(s)?"reach":"reaches")+" the top and "+(isYou(s)?"win":"wins"),dl(1800),"win"); }
      else { Sound.sfx("conquer"); await banner(E.ord(e.place)+" place",who+" "+(isYou(s)?"reach":"reaches")+" 100",dl(1300),"win"); }
      return;
    }
    default: return;
  }
}

/* ================= who goes first (RULES.md 2.2; the engine already decided it) ================= */
function spinFace(v){
  var svg=BD.spinnerSVG().replace(/<g class="sn-spin__nums">[\s\S]*?<\/g>/,"").replace('<g class="sn-arrow">','<g class="sn-arrow" transform="rotate('+((v-1)*60)+' 50 50)">');
  return '<span class="sn-fpspin">'+svg+"<b>"+v+"</b></span>";
}
var fpObs=null;
/* the OK (or tap) that closes the show must not also press the control that gets the focus under it (it opened the Menu on TV) */
document.addEventListener("bgui:firstplayer",function(e){ if(e.detail&&e.detail.open===false) ui.fpClosedAt=Date.now(); });
document.addEventListener("click",function(e){
  if(!ui.fpClosedAt||Date.now()-ui.fpClosedAt>450) return;
  var t=e.target&&e.target.closest?e.target.closest("#menuBtn, #rollBtn, #sdice, #homeBtn"):null;
  if(t){ e.preventDefault(); e.stopPropagation(); }
},true);
function firstShow(my){
  if(!G) return;
  var B=BG(), fp=B&&B.firstPlayer, f=E.firstPlayer(G);
  ui.fpShow=true; sync();
  try{ var ae=document.activeElement; if(ae&&ae!==document.body&&ae.blur) ae.blur(); }catch(e){}
  if(f.rule==="youngest"||!fp){
    ui.fpShow=false; sync();
    if(f.rule==="youngest") banner(nm(f.winner)+(isYou(f.winner)?" go first":" goes first"),(isYou(f.winner)?"You are":nm(f.winner)+" is")+" the youngest (2021 rules)",dl(1800)).then(function(){ if(my===gen) drive(); });
    else drive();
    return;
  }
  var rounds=f.rounds.map(function(r){ var vals={}; r.who.forEach(function(x,i){ vals[x]=r.vals[i]; }); return {who:r.who.slice(),vals:vals,top:r.who.filter(function(x,i){ return r.vals[i]===r.top; })}; });
  if(f.spinner&&window.MutationObserver){   // the shared show says "Draw again" for a card-style tie: here it is a spin
    document.addEventListener("bgui:firstplayer",function once(ev){ if(!ev.detail||!ev.detail.open) return; document.removeEventListener("bgui:firstplayer",once);
      var rt=document.querySelector(".bg-fp .bg-fp__rt"); if(!rt) return;
      if(fpObs) fpObs.disconnect(); fpObs=new MutationObserver(function(){ if(/Draw again/.test(rt.textContent)) rt.textContent=rt.textContent.replace("Draw again","Spin again"); }); fpObs.observe(rt,{childList:true,characterData:true,subtree:true}); });
  }
  var pin=function(i){   // each player's die on the second row of the board, spread across it (never on top of each other)
    var a=$("sart").getBoundingClientRect(), n=G.n, c=BD.centre(12+i*Math.max(1,Math.floor(8/Math.max(1,n-1))));
    if(i>=9) return null; return {x:a.left+c.x/BD.W*a.width,y:a.top+c.y/BD.H*a.height}; };
  setTimeout(function(){ if(my!==gen) return;
    fp({mode:f.spinner?"card":"die",layout:"peek",eyebrow:"Who goes first?",title:f.spinner?"Everyone spins the spinner":"Everyone rolls the die",
      players:G.players.map(function(p,s){ return {name:p.name,seat:seatNo(s),token:initials(p.name)}; }),rounds:rounds,winner:f.winner,
      pins:f.spinner?null:pin,
      face:f.spinner?function(v){ return spinFace(v); }:undefined,
      back:f.spinner?'<span class="sn-fpspin sn-fpspin--back">'+BD.spinnerSVG().replace(/<g class="sn-spin__nums">[\s\S]*?<\/g>/,"").replace(/<g class="sn-arrow">[\s\S]*?<\/g>/,"")+"</span>":undefined,
      label:f.spinner?function(v){ return "Spun "+v; }:undefined,
      result:function(w){ return {title:nm(w)+(isYou(w)?" go first":" goes first"),sub:f.why}; },
      onWinner:function(){ if(my!==gen) return; ui.fpShow=false; sync(); },
      focus:function(){ return onTV()&&isHuman(G.cur)?$("rollBtn"):null; }
    }).then(function(){ if(fpObs){ fpObs.disconnect(); fpObs=null; } if(my!==gen||!G) return; ui.fpShow=false; sync(); drive(); });
  },0);
}

/* ================= the end: Victory with real numbers and the sorted standings ================= */
function finishGame(){
  if(ui.finished===gen) return; ui.finished=gen;
  try{ if(S.Brain&&S.Brain.finish) S.Brain.finish(G); }catch(e){}
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
  var w=G.winner, ms=playMs(), min=Math.round(ms/60000), single=nHumans()===1, pw=G.players[w];
  $("winEyebrow").textContent="Game over · "+(min<1?"under a minute":min===1?"1 minute":min+" minutes");
  $("winTitle").textContent=(isHuman(w)&&single)?"Victory":nm(w)+(isYou(w)?" win":" wins");
  var sub=nm(w)+" "+(isYou(w)?"reach":"reached")+" 100 in "+plural(pw.st.rolls,G.o.spinner?"spin":"roll")+".", L=G.stats.longestSlide, C=G.stats.longestClimb;
  if(isYou(w)) sub="You reached 100 in "+plural(pw.st.rolls,G.o.spinner?"spin":"roll")+".";
  if(L) sub+=" The longest slide: "+nm(L.s)+", "+L.from+" down to "+L.to+(label(L.from)?" ("+label(L.from)+")":"")+".";
  if(C) sub+=" The longest climb: "+nm(C.s)+", "+C.from+" to "+C.to+".";
  var rows0=E.standings(G), rec=null; try{ rec=S.Brain&&S.Brain.records?S.Brain.records():null; }catch(e){ rec=null; }
  if(rows0.some(function(r){ return r.table; })) sub+=" Players still on the board are ranked by their square.";
  if(rec&&rec.games>1&&rec.slide) sub+=" Longest slide on this device: "+rec.slide+" squares.";
  $("winSub").textContent=sub;
  var rows=E.standings(G);
  $("winList").innerHTML=rows.map(function(r){ var p=G.players[r.s];
    return '<li class="'+(r.place===1?"is-lead":"")+'"><span class="sn-fr">'+r.place+'</span><span class="bg-token" data-seat="'+seatNo(r.s)+'" aria-hidden="true">'+esc(initials(r.name))+'</span><span class="sn-fn">'+esc(r.name)+'</span><span class="sn-fc">'+(p.done?"Home · "+E.ord(p.place):"Square "+p.pos)+"</span></li>"; }).join("");
  $("winList").classList.toggle("is-grid",rows.length>3);
  $("winStats").innerHTML='<li class="bg-stat"><b>'+G.stats.rolls+"</b><span>"+(G.o.spinner?"spins":"rolls")+'</span></li><li class="bg-stat"><b>'+G.stats.ladders+"</b><span>"+(G.stats.ladders===1?"ladder":"ladders")+"</span></li>"+
    '<li class="bg-stat"><b>'+G.stats.snakes+"</b><span>"+(G.stats.snakes===1?"snake":"snakes")+'</span></li><li class="bg-stat"><b>'+fmtTime(ms)+"</b><span>time</span></li>";
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
  mountNames(); drawSeats();
  var B=BG();
  if(B&&B.stage) B.stage(GAME,{frames:"#sboard"}); else Skins.apply(GAME);
  if(B&&B.back) B.back.on(backStep);
  else window.__tvBack=function(){
    if(window.Sound&&Sound.panelOpen&&Sound.panelOpen()){ Sound.closePanel(); return "panel"; }
    var r=backStep(); if(r) return r;
    location.href=$("homeBtn").getAttribute("href"); return "hub";
  };
  if(!B||!B.effects) return;
  document.documentElement.classList.add("sn-luxe");
  // the steppers were built at parse time, before icons.js: give their - and + buttons the icons now (the text fallback was 13 px on TV)
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
window.__snakes={get G(){ return G; },cfg:cfg,act:act,drive:drive,startGame:startGame,tapRoll:tapRoll,sync:function(){ if(!busy) sync(); },
  rig:function(vals){ if(G) G.rig=(vals||[]).slice(); },   // tests: the next rolls (engine G.rig, test-only)
  state:function(){ return {busy:busy,intent:intent,fpShow:ui.fpShow,gen:gen,ms:playMs(),winShown:ui.winShown,finished:ui.finished,disp:disp.slice()}; }};
})();
