/* MOTOCROSS WAR — the page controller: setup (series, the YEAR picker with a big preview, riders with name, number and team, race length,
   War's rules, Game speed, Continue), the SEASON screen (calendar done / next, championship and team standings 1..N, Save), the RACE screen
   (the starting gate, the holeshot, every battle a War flip, the live timing tower, the lap counter, the checkered flag), results with who
   advances and the points, the round podium, the season champion (Victory). The rules live in race.js / round.js / season.js (pure, no
   DOM), the riders' character in brain.js, the art in art.js; this file only drives and shows them.
   - War has no first player (everyone turns a card at once): the opening show of every race is the starting gate (race.js firstPlayer:
     rule "none", show "gate"). There is no track of spaces either (so no hops): v2 draws the round's real-looking loop (track.js) and every
     rider rides it continuously at a gap from the standings; a pass is a smooth ride-up. One battle = one lap ("Lap 7 of 30", the white
     flag on the last lap, the checkered flag). v2 also: the red plate (the points leader), the battle board, the heat line-up (balanced
     by team), free numbers only (a taken one is refused with who holds it).
   - Every batch of engine events is played in order (the gate, the reveal, a war's 3 down + the 4th, the win, the holeshot, the flag), then
     the race is drawn again from G. The person's Flip is queued while a battle plays, so a tap is never lost; Auto-flip turns for them.
   - Saves after every action (Saves.auto "mxwar"); the season is plain JSON, so Continue resumes it exactly, mid-race too.
   - MOTOCROSS WAR 3D (the CEO 2026-10-16 20:06 and ~21:10): the race is shown by race3d.js (our own WebGL renderer) filling the arena; the
     card flip and every war play in a small corner window (tap / OK = big); a lap takes a REAL lap time (the track's, about 50-60 s in a
     stadium, about 2 minutes outdoors); the cards of a lap turn as the leader starts it and the field rides the result over the lap; a
     pending card turns by itself 5 s before the line (real time never stops); crashes and the yellow flag per CRASH-CONTRACT.md; "Skip to the
     finish" any time; Real length / Half length races. Without WebGL (or ?gl=0) the 2D track (track.js) runs at the same real lap times. */
(function(){
"use strict";
var MX=window.MXWar, S=MX.Season, RC=MX.Race, RD=MX.Round, BR=MX.Brain, A=MX.Art, IDX=window.MXWarIndex;
var DATA=window.MXWarData=window.MXWarData||{};
var $=function(id){ return document.getElementById(id); };
var GAME="mxwar";
/* Game speed (SPEED-TASK.md): every computer delay and every animation x speedFactor(); animations never under 120 ms */
function speedFactor(){ return ({slow:1.75, fast:0.5})[window.bgGameSpeed] || 1 }
function sp(ms){ return Math.max(120,Math.round(ms*speedFactor())); }
function dl(ms){ return Math.round(ms*speedFactor()); }
function sleep(ms){ return new Promise(function(r){ setTimeout(r,Math.max(0,ms)); }); }
function normSpeed(v){ return v==="slow"||v==="fast"?v:"medium"; }
function normSkill(v){ return v==="easy"||v==="hard"?v:"normal"; }
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function BG(){ return window.BGUI||null; }
function luxe(){ var B=BG(); return !!(B&&B.sheet&&B.effects&&document.documentElement.classList.contains("mx-luxe")); }
function onTV(){ return document.documentElement.hasAttribute("data-tv"); }
function icon(n){ var B=BG(); return B&&B.icon?B.icon(n):""; }
function reduced(){ var B=BG(); return document.documentElement.getAttribute("data-motion")==="reduce"||document.documentElement.getAttribute("data-effects")==="reduced"||!!(B&&B.reducedMotion&&B.reducedMotion()); }
function remPx(){ return parseFloat(getComputedStyle(document.documentElement).fontSize)||16; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function plural(n,w){ return n+" "+w+(n===1?"":"s"); }
function ord(n){ var t=n%100; return n+((t>=11&&t<=13)?"th":(["th","st","nd","rd"][n%10]||"th")); }
function listNames(a){ return a.length<=2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }
function subParts(parts){ return parts.map(function(s,i){ return '<span class="mx-nw">'+esc(s)+(i<parts.length-1?" ·":"")+"</span>"; }).join(" "); }
var RNAME={11:"Jack",12:"Queen",13:"King",14:"Ace",15:"Joker"};
function rankWord(r){ return RNAME[r]||String(r); }
function rankPlural(r){ return r===15?"Jokers":r===6?"6s":RNAME[r]?RNAME[r]+"s":r+"s"; }
function fmtDate(s){ try{ var d=new Date(s+"T12:00:00"); if(isNaN(d)) return s||""; return d.toLocaleDateString([], {month:"short",day:"numeric"}); }catch(e){ return s||""; } }

/* ================= registration: the new-game hooks (commit ae99bbe) ================= */
var GLYPHS={
  helmet:'<path d="M4 14a8 8 0 0 1 16-1.5V15h-6.5L12 18H6.5A2.5 2.5 0 0 1 4 15.5z"/><path d="M13.5 12.5H20"/><path d="M8 8.5l3 1"/>',
  wheel:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 4v5.8M12 14.2V20M4 12h5.8M14.2 12H20"/>',
  checkflag:'<path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/><path d="M9 4v8M13 4v8M5 8h11"/>',
  board:'<path d="M4.5 6h2.5M10 6h9.5M4.5 12h2.5M10 12h9.5M4.5 18h2.5M10 18h9.5"/>'
};
var registered=false;
function register(){
  var B=BG(); if(!B||registered) return; registered=true;
  if(B.icon&&B.icon.add){ Object.keys(GLYPHS).forEach(function(k){ B.icon.add(k,GLYPHS[k]); }); if(B.icon.seal&&B.icon.seal.set) B.icon.seal.set(GAME,"helmet"); }
  if(B.stage&&B.stage.register) B.stage.register(GAME,{motifs:["helmet","wheel","checkflag","cards"]});
}
/* the music: a driving rock style with its own 10 original song titles (Sound.addStyle, sound.js) */
if(window.Sound&&Sound.addStyle&&!(Sound.hasStyle&&Sound.hasStyle(GAME))){
  Sound.addStyle(GAME,{ scales:["mixo","minor","dorian"], bpm:[132,156], swing:0, sev:true, leadVol:0.08, waves:["sawtooth","square","square"], bassKind:"pulse",
    progs:[[0,6,3,4],[0,3,4,4],[0,5,6,4],[0,4,6,5],[0,3,6,4],[0,6,4,3],[0,4,3,0],[0,5,3,4]],
    bridge:[[3,4,5,5],[6,5,4,4],[3,6,4,4],[5,4,3,4]],
    rhythms:[[1,1,0,1,1,0,1,1],[1,0,1,1,0,1,1,0],[1,1,1,0,1,1,0,1],[1,0,1,0,1,1,1,1]],
    chordSteps:[0,4,7],
    drums:[{kick:[1,0,0,1,1,0,0,0],snare:[0,0,1,0,0,0,1,0],sv:0.09,hat:[1,1,1,1,1,1,1,1],hv:0.035},{kick:[1,0,1,0,1,0,1,0],snare:[0,0,1,0,0,1,1,0],sv:0.08,hat:[1,0,1,0,1,0,1,0],hv:0.04},{kick:[1,1,0,0,1,0,1,0],snare:[0,0,1,1,0,0,1,1],sv:0.07,hat:[0,1,0,1,0,1,0,1],hv:0.04}],
    titles:["Gate Drop","Holeshot Highway","Whoop Section","Last Chance Qualifier","Main Event Lights","Berm Burner","Thirty Seconds to Gate","Checkered at Midnight","Two-Stroke Thunder","Podium Spray"] },
    {wave:"sawtooth",reg:-1});
}

/* ================= state ================= */
var DEF_WAR={version:"three",onlyTied:true,outLoses:false,noDown:false,deucesWild:false,acesWild:false,jokersWild:false,wildAs:"top",form:false,cards:26};
var cfg={series:"sx",sid:null,humans:1,length:"real",speed:"medium",skill:"normal",auto:false,others:"ask",fill:"full",nonTitle:true,war:{}};
var G=null, gen=0, timer=null, busy=false, intent=0, skipQ=false;   /* skipQ: "Sim to the flag" tapped while a battle plays (never lost) */
var ui={view:"season",rc:null,finished:-1,winShown:-1,result:false,rulesOpen:false,cont:false,order:[],lap:0,lastCards:{},bikes:{},sayN:0,
  pendRound:null,pendSeason:null,lastDone:null,showAll:false,shown:false,sheetGo:null,log:[],flipBusy:false,newOk:false};
var disp=null;   // the counts on show while a battle plays (they follow the cards, not the engine)
var LONG={sx:"AMA Supercross",mx:"AMA Pro Motocross",smx:"SuperMotocross Playoffs"};
var SHORTS={sx:"Supercross",mx:"Motocross",smx:"SMX Playoffs"};
var LEN_NAME={real:"Real length",half:"Half length",short:"Half length",standard:"Real length",long:"Real length"};

function seasonsOf(series){ return IDX.seasons.filter(function(s){ return s.series===series; }).sort(function(a,b){ return b.year-a.year; }); }
function seasonInfo(id){ return IDX.seasons.filter(function(s){ return s.id===id; })[0]||null; }
function fixSeason(){
  if(!LONG[cfg.series]) cfg.series="sx";
  var si=seasonInfo(cfg.sid);
  if(!si||si.series!==cfg.series){ var list=seasonsOf(cfg.series); cfg.sid=list.length?list[0].id:null; }
}
function warOpts(){ var o={}, k; for(k in DEF_WAR) o[k]=DEF_WAR[k]; for(k in (cfg.war||{})) if(DEF_WAR.hasOwnProperty(k)) o[k]=cfg.war[k]; return o; }
function seasonOpts(){ return {length:cfg.length,war:warOpts(),fill:cfg.fill,nonTitle:cfg.nonTitle,skill:cfg.skill}; }
function liveGame(){ return !!(G&&!G.over); }
function setupShown(){ return $("setup").style.display!=="none"; }
function paused(){ return !!G&&setupShown(); }
function rider(id){ return G.riders[id]; }
function isHumanId(id){ var r=G&&G.riders[id]; return !!(r&&r.kind==="human"); }
function seatId(s){ return ui.rmap?ui.rmap[s]:(G&&G.rmap?G.rmap[s]:null); }

function toast(m,o){
  var t=$("toast"); t.textContent=m; var B=BG();
  if(luxe()&&B.toast){ B.toast(m,Object.assign({icon:"info",ms:2600},o||{})); return; }
  t.classList.add("show"); clearTimeout(toast._t); toast._t=setTimeout(function(){ t.classList.remove("show"); },2200);
}
function focusIn(el){ var B=BG(); if(!el) return; if(B&&B.focus&&B.focus.enabled) B.focus.set(el); else { try{ el.focus({preventScroll:true}); }catch(e){ el.focus(); } } }
function focusTV(el){ var B=BG(); if(el&&B&&B.focus&&B.focus.enabled&&onTV()&&el.isConnected&&!el.hidden&&el.getClientRects().length&&!el.disabled) B.focus.set(el); }
function armBack(){ var B=BG(); if(B&&B.back&&B.back.arm) B.back.arm(); }
function hubHref(){ var B=BG(); return B&&B.back&&B.back.hub?B.back.hub():"../index.html"; }

/* ================= the season files (one per year, loaded on demand; sw.js caches each on first use) ================= */
var loading={};
function loadSeason(id){
  if(DATA[id]) return Promise.resolve(DATA[id]);
  if(loading[id]) return loading[id];
  loading[id]=new Promise(function(res,rej){
    var s=document.createElement("script"); s.src="data/"+id+".js"; s.async=true;
    s.onload=function(){ if(DATA[id]) res(DATA[id]); else { delete loading[id]; rej(new Error("no data")); } };
    s.onerror=function(){ delete loading[id]; s.remove(); rej(new Error("load")); };
    document.head.appendChild(s);
  });
  return loading[id];
}

/* ================= the riders on this device: name (BGUI.names), number and team (make), remembered here ================= */
var RKEY="bg_mxwar_riders", rxs=[];
function readRiders(){ try{ var a=JSON.parse(localStorage.getItem(RKEY)||"[]"); rxs=Array.isArray(a)?a:[]; }catch(e){ rxs=[]; } }
function writeRiders(){ try{ localStorage.setItem(RKEY,JSON.stringify(rxs.slice(0,8))); }catch(e){} }
var DEF_BIKES=["Honda","Yamaha","Kawasaki","Suzuki","KTM","Husqvarna","GasGas","Honda"];
function rx(i){ var r=rxs[i]; if(!r||typeof r!=="object") r=rxs[i]={}; if(!r.bike) r.bike=DEF_BIKES[i%8]; if(r.num==null) r.num=""; return r; }
function cleanNum(v){ return String(v==null?"":v).replace(/\D/g,"").slice(0,3); }
var nameUI=null;
function humanNames(n){ var B=BG(); if(!n) return []; if(nameUI&&B&&B.names) return B.names.list(n,nameUI.values()); var a=[]; for(var i=0;i<n;i++) a.push(n===1?"You":"Player "+(i+1)); return a; }
function bikeOptions(cur){
  var list=A.MODERN.slice(), si=seasonInfo(cfg.sid), D=si&&DATA[si.id];
  if(D) D.riders.forEach(function(r){ if(r.bike&&list.indexOf(r.bike)<0) list.push(r.bike); });
  if(cur&&list.indexOf(cur)<0) list.push(cur);
  return list.map(function(b){ return '<option value="'+esc(b)+'"'+(b===cur?" selected":"")+">"+esc(b)+"</option>"; }).join("");
}
function mountNames(){
  var B=BG(); if(!B||!B.names||nameUI) return;
  nameUI=B.names.mount("#nameCard",{count:Math.max(1,cfg.humans),seat:function(i){ return i+1; },onChange:function(){ syncStart(); },
    label:function(i,n){ return n>1?"Rider "+(i+1)+" name":"Your name"; },
    extra:function(i){ var r=rx(i); return '<div class="mx-rx"><label>Team<select class="bg-select" data-rx="bike" data-i="'+i+'">'+bikeOptions(r.bike)+"</select></label>"+
      '<label>Number<input class="bg-input" type="text" inputmode="numeric" maxlength="3" autocomplete="off" data-rx="num" data-i="'+i+'" value="'+esc(r.num)+'" placeholder="Any"></label></div>'+
      '<p class="mx-numst" data-rx="st" data-i="'+i+'" aria-live="polite"></p><div class="mx-free" data-rx="free" data-i="'+i+'"></div>'; }});
  var nc=$("nameCard");
  nc.addEventListener("input",function(e){ var t=e.target; if(!t.getAttribute||t.getAttribute("data-rx")!=="num") return; var v=cleanNum(t.value); if(v!==t.value) t.value=v; rx(+t.getAttribute("data-i")).num=v; writeRiders(); syncNums(); });
  nc.addEventListener("change",function(e){ var t=e.target, k=t.getAttribute&&t.getAttribute("data-rx"); if(!k||k==="st"||k==="free") return; var r=rx(+t.getAttribute("data-i")); if(k==="bike") r.bike=t.value; else r.num=cleanNum(t.value); writeRiders(); syncNums(); });
  nc.addEventListener("click",function(e){ var b=e.target.closest&&e.target.closest("button[data-free]"); if(!b) return; var i=+b.getAttribute("data-i"), n=b.getAttribute("data-free"); rx(i).num=n; writeRiders();
    var inp=nc.querySelector('input[data-rx="num"][data-i="'+i+'"]'); if(inp) inp.value=n; syncNums(); focusIn(inp); });
}
/* v2 numbers (the CEO ~18:25): "you should be able to choose your own number or a number available for the season ... you can't have the same
   number as another rider for that year". Every rider of the season holds their own number (real, or assigned where no source gives one);
   a taken number is refused with who holds it, and the nearest free numbers are offered. */
function numState(i){
  var r=rx(i), v=r.num, si=seasonInfo(cfg.sid), D=si&&DATA[si.id];
  if(v===""||v==null) return {ok:true,t:"Any free number: one is picked for you."};
  var n=+v;
  for(var j=0;j<i;j++){ var o=rx(j); if(o.num!==""&&+o.num===n) return {ok:false,t:"#"+n+" is already "+(cfg.humans>1?"Rider "+(j+1)+"'s":"taken")+" number.",n:n}; }
  if(!D) return {ok:true,t:"Checking the "+(si?si.year:"")+" numbers...",wait:true};
  var h=D.riders.filter(function(x){ return x.num===n&&x.ns!=="a"; })[0];   /* an assigned number (no source gives it) is yours to take */
  if(h) return {ok:false,t:"#"+n+" is taken in "+D.year+": "+h.name+(h.bike?" ("+h.bike+")":"")+" rides it"+(h.ns==="a"?" (a number assigned for the game)":"")+".",n:n};
  return {ok:true,t:"#"+n+" is free in "+D.year+"."};
}
function freeNear(n,k){
  var si=seasonInfo(cfg.sid), D=si&&DATA[si.id], used={}, out=[];
  if(D) D.riders.forEach(function(x){ if(x.num!=null&&x.ns!=="a") used[x.num]=1; });
  for(var j=0;j<cfg.humans;j++){ var o=rx(j); if(o.num!=="") used[+o.num]=1; }
  for(var d=1;d<1000&&out.length<k;d++){ if(n-d>=1&&!used[n-d]) out.push(n-d); if(out.length<k&&n+d<=999&&!used[n+d]) out.push(n+d); }
  return out.sort(function(a,b){ return a-b; });
}
function syncNums(){
  var nc=$("nameCard"); if(!nc) return;
  for(var i=0;i<cfg.humans;i++){
    var st=nc.querySelector('[data-rx="st"][data-i="'+i+'"]'), fr=nc.querySelector('[data-rx="free"][data-i="'+i+'"]'), inp=nc.querySelector('input[data-rx="num"][data-i="'+i+'"]'); if(!st) continue;
    var x=numState(i); st.textContent=x.t; st.classList.toggle("is-bad",!x.ok); st.classList.toggle("is-ok",x.ok&&!x.wait&&rx(i).num!==""); if(inp) inp.setAttribute("aria-invalid",String(!x.ok));
    var want=!x.ok?freeNear(x.n,onTV()?5:4):[], have=fr?[].map.call(fr.querySelectorAll("button"),function(b){ return +b.getAttribute("data-free"); }):[];
    if(fr&&want.join()!==have.join()) fr.innerHTML=want.length?'<span class="mx-free__l">Free:</span>'+want.map(function(n){ return '<button type="button" class="bg-btn bg-btn--secondary mx-free__b" data-free="'+n+'" data-i="'+i+'" aria-label="Take number '+n+'">'+n+"</button>"; }).join(""):"";
  }
}
function numsBad(){ for(var i=0;i<cfg.humans;i++){ if(!numState(i).ok) return i; } return -1; }
function refreshBikeSelects(){ document.querySelectorAll('#nameCard select[data-rx="bike"]').forEach(function(s){ var i=+s.getAttribute("data-i"); s.innerHTML=bikeOptions(rx(i).bike); }); }
function humanList(){ var n=cfg.humans, nm=humanNames(n), out=[]; for(var i=0;i<n;i++){ var r=rx(i); out.push({name:nm[i],num:r.num===""?undefined:+r.num,bike:r.bike}); } return out; }

/* ================= setup page (also the in-game Menu) ================= */
function keepFocus(box,attr,fn){
  var a=document.activeElement, k=(a&&a!==document.body&&box.contains(a))?a.getAttribute(attr):null;
  fn();
  if(k===null) return;
  focusIn(box.querySelector("["+attr+'="'+k+'"]:not([disabled])')||box.querySelector("button.on:not([disabled])")||box.querySelector("button:not([disabled]), select, input"));
}
function segHTML(items,cur,attr){ return items.map(function(it){ var on=String(it[0])===String(cur); return '<button type="button" '+attr+'="'+esc(it[0])+'" class="'+(on?"on":"")+'" aria-pressed="'+on+'"'+(it[2]?" disabled":"")+'>'+esc(it[1])+'</button>'; }).join(""); }
function drawSeries(){
  var box=$("seriesSeg");
  keepFocus(box,"data-sr",function(){
    box.innerHTML=segHTML([["sx","Supercross"],["mx","Motocross"],["smx","SMX Playoffs"]],cfg.series,"data-sr");
    box.querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ if(cfg.series===b.dataset.sr) return; var y=(seasonInfo(cfg.sid)||{}).year; cfg.series=b.dataset.sr;
      var same=seasonsOf(cfg.series).filter(function(s){ return s.year===y; })[0]; cfg.sid=same?same.id:null; drawSetup(); }); });
  });
}
/* the program of a format in words ("2 heats of 20, the top 9 of each to the Main; LCQ of 22, the top 4; a 22-rider Main Event") */
function progWords(F){
  if(!F) return "";
  var parts=[];
  if(F.direct) parts.push("the top "+F.direct+" seeds straight to the motos");
  F.qual.forEach(function(s){
    var t=(s.races>1?s.races+" "+s.label.toLowerCase()+(/s$/.test(s.label)?"":"s")+" of "+s.size:(s.label==="LCQ"?"an LCQ of "+s.size:"a "+s.label.toLowerCase()+" of "+s.size));
    if(s.toMain) t+=", the top "+s.toMain+(s.races>1?" of each":"")+" to the "+(F.finals.kind==="moto"?"motos":F.finals.label);
    parts.push(t);
  });
  var f=F.finals;
  parts.push(f.kind==="moto"?(f.races>1?f.races+" motos with a "+f.size+"-rider gate":"one moto with a "+f.size+"-rider gate"):(f.races>1?f.races+" "+f.label.toLowerCase()+"s of "+f.size:"a "+f.size+"-rider "+f.label));
  return parts.join("; ");
}
function drawSeasonCard(){
  fixSeason();
  var si=seasonInfo(cfg.sid), c=$("seasonCard");
  if(!si){ c.innerHTML='<span class="mx-scard__n">No season for this series</span>'; $("seasonDesc").textContent=""; return; }
  var F=IDX.formats[si.format];
  c.innerHTML='<span class="mx-scard__y">'+si.year+'</span><span class="mx-scard__n">'+esc(LONG[si.series])+" · "+esc(si.cls)+'</span>'+
    '<span class="mx-scard__go">'+icon("chevron")+"Change year</span>"+
    '<span class="mx-scard__m">'+esc(plural(si.rounds,"round")+" · "+si.riders+" real riders · champion "+si.champion)+"</span>"+
    '<span class="mx-scard__t"><span class="bg-tag '+(si.status==="VERIFIED"?"bg-tag--official":"bg-tag--paper")+'">'+(si.status==="VERIFIED"?"verified":"partly inferred")+"</span></span>";
  c.setAttribute("aria-label","Season "+si.year+" "+LONG[si.series]+". Change the year");
  $("seasonDesc").innerHTML="<b>A night"+(si.series==="mx"?" outdoors":" in the stadium")+":</b> "+esc(progWords(F))+". "+esc(pointsWords(F));
  loadSeason(si.id).then(function(){ if(cfg.sid===si.id){ refreshBikeSelects(); drawRiders(); } },function(){});
}
function pointsWords(F){
  if(!F||!F.table) return "";
  var t=F.table, n=t.filter(function(x){ return x>0; }).length;
  return "Points "+t.slice(0,3).join("-")+"... down to the "+ord(n)+(F.pointsOn==="overall"?" (paid on the night's overall)":F.finals.kind==="moto"?" (in every moto)":"")+".";
}
function openYearPicker(){
  var B=BG(); fixSeason();
  if(!B||!B.picker){ toast("The year list needs the page to finish loading."); return; }
  var list=seasonsOf(cfg.series), groups=[], byDec={};
  list.forEach(function(s){ var d=Math.floor(s.year/10)*10; if(!byDec[d]){ byDec[d]={head:d+"s",items:[]}; groups.push(byDec[d]); }
    byDec[d].items.push({id:s.id,name:String(s.year),meta:s.cls+" · "+plural(s.rounds,"round"),desc:"Champion "+s.champion,detail:s.riders+" riders",
      tags:[s.status==="VERIFIED"?{text:"verified",kind:"official"}:{text:"partly inferred",kind:"paper"}]}); });
  B.picker.open({eyebrow:"Choose the year",title:LONG[cfg.series],sub:"Every season from "+list[list.length-1].year+" to "+list[0].year+": the real calendar and the real "+(list[0].cls||"premier")+" riders of that year.",
    groups:groups,chosen:cfg.sid,aspect:4/3,render:function(id){ return preview(id); },fit:function(pic,id,o){ pic._fit=o; fitPreview(pic,o); },
    pickLabel:"Race this season",keepLabel:"Keep this season",refocus:"#seasonCard",
    onPick:function(id){ cfg.sid=id; drawSetup(); }});
}
var pvSeq=0;
function preview(id){
  var si=seasonInfo(id), el=document.createElement("div"); el.className="mx-pv";
  if(!si) return el;
  var F=IDX.formats[si.format];
  el.innerHTML='<div class="mx-pv__band"><div class="mx-pv__art">'+A.track(si.series==="mx"?"outdoor":"stadium","pv"+(++pvSeq))+'</div><span class="mx-pv__y">'+si.year+'</span>'+
    '<span class="mx-pv__h"><span class="mx-pv__s">'+esc(LONG[si.series]+" · "+si.cls)+'</span><span class="mx-pv__c">'+esc(plural(si.rounds,"round")+" · "+(F&&F.finals.kind==="moto"?"motos and overall":F&&F.qual.length?F.qual.map(function(q){ return q.label; }).join(", ")+", "+F.finals.label:"Main"))+'</span></span></div>'+
    '<div class="mx-pv__body"><span class="mx-pv__load">Loading the season...</span></div>';
  loadSeason(id).then(function(D){ fillPreview(el,D); },function(){ var l=el.querySelector(".mx-pv__load"); if(l) l.textContent="Offline: this season loads when you are online."; });
  return el;
}
function fillPreview(el,D){
  var body=el.querySelector(".mx-pv__body"); if(!body) return;
  var top=D.riders.filter(function(r){ return r.pos!=null; }).sort(function(a,b){ return a.pos-b.pos; }).slice(0,8);
  body.innerHTML='<div class="mx-pv__col"><span class="mx-pv__lab">'+(D.series==="mx"?"Tracks":"Cities")+'</span><div class="mx-pv__cities">'+
    D.rounds.map(function(r){ return '<span class="mx-pv__city"><b>'+r.n+"</b> "+esc(r.city||r.venue)+"</span>"; }).join("")+'</div></div>'+
    '<div class="mx-pv__col"><span class="mx-pv__lab">Top riders</span><ol class="mx-pv__riders">'+
    top.map(function(r){ return '<li><span class="mx-pv__rk">'+r.pos+'</span><span class="mx-pl'+(r.ns==="a"?" is-gen":"")+'" style="'+A.mkStyle(r.bike)+'">'+(r.num!=null?r.num:"-")+'</span><span class="mx-pv__nm">'+esc(r.name)+'</span>'+(r.bike?'<span class="mx-mk" style="'+A.mkStyle(r.bike)+'">'+esc(r.bike)+"</span>":"")+"</li>"; }).join("")+"</ol></div>";
  if(el._fit) fitPreview(el,el._fit); else { var p=el.closest&&el.parentNode; if(p&&p._fit) fitPreview(el,p._fit); }
}
function fitPreview(pic,o){
  var el=pic.classList&&pic.classList.contains("mx-pv")?pic:pic.querySelector(".mx-pv"); if(!el||!o) return;
  el._fit=o;
  el.classList.toggle("is-narrow",o.width<520);
  var fs=Math.max(o.floor||12,Math.min(o.width/26,onTV()?o.floor*1.1:16));
  el.style.setProperty("--pv-fs",fs.toFixed(1)+"px");
  /* the cities and riders that don't fit are counted, not squeezed under the floor */
  var box=el.querySelector(".mx-pv__cities");
  if(box){
    var chips=[].slice.call(box.querySelectorAll(".mx-pv__city")), more=box.querySelector(".mx-pv__more");
    chips.forEach(function(c){ c.hidden=false; }); if(more) more.remove();
    var n=chips.length;
    while(n>1&&box.scrollHeight>box.clientHeight+1){ n--; chips[n].hidden=true; if(!more){ more=document.createElement("span"); more.className="mx-pv__more"; box.appendChild(more); } more.textContent="+"+(chips.length-n)+" more"; }
    while(n>1&&more&&box.scrollHeight>box.clientHeight+1){ n--; chips[n].hidden=true; more.textContent="+"+(chips.length-n)+" more"; }
  }
  var ol=el.querySelector(".mx-pv__riders");
  if(ol){ var li=[].slice.call(ol.children); li.forEach(function(x){ x.hidden=false; }); var m=li.length; while(m>1&&ol.scrollHeight>ol.clientHeight+1){ m--; li[m].hidden=true; } }
}
/* riders: people on this device (0..8; 0 = watch the season) */
function stepper(box,label,get,set,lo,hi){
  if(!box.querySelector(".bg-stepper__btn")){
    box.innerHTML='<button type="button" class="bg-stepper__btn" data-step="-1" aria-label="Fewer '+esc(label)+'">'+(icon("minus")||"&minus;")+'</button><output class="bg-stepper__val" aria-live="polite"></output><button type="button" class="bg-stepper__btn" data-step="1" aria-label="More '+esc(label)+'">'+(icon("plus")||"+")+"</button>";
    box.querySelectorAll(".bg-stepper__btn").forEach(function(b){ b.addEventListener("click",function(){ if(b.disabled) return; set(get()+(+b.dataset.step)); drawSetup(); }); });
  }
  var v=get(), bs=box.querySelectorAll(".bg-stepper__btn"), a=document.activeElement;
  if(!bs[0].querySelector("svg")&&icon("minus")){ bs[0].innerHTML=icon("minus"); bs[1].innerHTML=icon("plus"); }
  box.querySelector("output").textContent=String(v);
  bs[0].disabled=v<=lo; bs[1].disabled=v>=hi;
  bs[0].setAttribute("aria-label","Fewer "+label+" ("+v+")"); bs[1].setAttribute("aria-label","More "+label+" ("+v+")");
  if(a&&a.disabled&&box.contains(a)) focusIn(a===bs[0]?bs[1]:bs[0]);
}
function drawRiders(){
  cfg.humans=clamp(cfg.humans|0,0,S.MAXH||8);
  stepper($("humanSeg"),onTV()?"riders on this TV":"riders on this phone",function(){ return cfg.humans; },function(v){ cfg.humans=clamp(v,0,S.MAXH||8); },0,S.MAXH||8);
  if(nameUI) nameUI.count(Math.max(1,cfg.humans));
  syncNums();
  $("nameCard").closest("section").hidden=cfg.humans===0;
  var si=seasonInfo(cfg.sid), F=si&&IDX.formats[si.format], field=F?RD.fieldSize(F):0;
  $("fieldDesc").textContent=si?(cfg.humans?(cfg.humans===1?"You race":"Your "+cfg.humans+" riders race")+" every round of "+si.year+" against the real riders of that season ("+si.riders+" in the research); a night needs "+field+" riders"+(si.riders+cfg.humans<field?", so labelled privateers fill the gate.":"."):
    "Watch mode: the "+si.riders+" real riders of "+si.year+" race the season; you can watch or sim each race."):"";
  $("autoRow").setAttribute("aria-checked",String(!!cfg.auto)); $("autoRow").hidden=cfg.humans===0;
  syncStart();
}
function drawLength(){
  var box=$("lengthSeg");
  keepFocus(box,"data-l",function(){
    box.innerHTML=segHTML([["real","Real length"],["half","Half length"]],cfg.length,"data-l");
    box.querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.length=b.dataset.l; drawSetup(); }); });
  });
  var si=seasonInfo(cfg.sid), mx=si&&si.series==="mx", F=si&&IDX.formats[si.format], lapS=mx?120:si&&si.series==="smx"?70:56;
  var L=F?RD.lengths({length:cfg.length,lapS:lapS},F):{heat:8,lcq:7,main:23,moto:17,semi:6}, E=estimate(L,mx,si,lapS,F);
  $("lengthDesc").innerHTML=(mx?"<b>Motos of "+(cfg.length==="half"?"half the real length":"30 minutes + 2 laps")+"</b>: about "+L.moto+" laps each, two motos a round.":
      "<b>"+(cfg.length==="half"?"Half the real length":"The year's real lengths")+"</b>: heats about "+L.heat+" laps, the LCQ "+L.lcq+", the Main "+L.main+" (on this track).")+
    " Every battle is a lap and a lap takes a real lap time (a stadium lap about a minute, an outdoor lap about 2): the riders ride at real speed, never faster. Races you're not in can be simmed, and any race has Skip to the finish.<br><b>Time:</b> "+
    (mx?"a moto about "+E.race+" min, a round about "+E.round+" min":"the Main about "+E.race+" min; a round about "+E.round+" min if you watch every race (about "+E.short+" with the other races simmed)")+
    (si?"; the "+si.rounds+"-round "+si.year+" season about "+E.season+", over several sittings (it saves after every race)":"")+".";
}
/* v2 time estimates, MEASURED in the browser (BG_audit/sprint/mxv2 run1 + run5: 20-22-rider Supercross races with the person on Auto, the
   time from one lap's cards to the next, wars included; Medium 4.0-5.0 s, Slow 5.8-6.9 s, Fast 2.0-2.8 s; watching a race without you is
   slower, about 6.9 s at Medium): seconds a lap at each Game speed, plus the gate, the results and the podium of a race */
/* the honest time at real lap times: every race of a round watched, or only yours (the other heat and the LCQ simmed); plus the gate, the
   results and the podium of each race */
var LAP_S={slow:56,medium:56,fast:56}, RACE_EXTRA_S=40;
function estimate(L,mx,si,lapS,F){
  lapS=lapS||56;
  var all=mx?[L.moto,L.moto]:[], mine=mx?[L.moto,L.moto]:[];
  if(!mx){ var q=F&&F.qual||[]; q.forEach(function(st){ for(var i=0;i<st.races;i++) all.push(L[st.kind]||L.heat); }); all.push(L.main); if(!all.length) all=[L.heat,L.heat,L.lcq,L.main]; mine=[L.heat,L.main]; }
  function sec(list){ var t=0; list.forEach(function(n){ t+=n*lapS+RACE_EXTRA_S; }); return t; }
  var min=function(x){ return String(Math.max(1,Math.round(x))); }, rs=sec(all)/60, ss=si?rs*si.rounds:0;
  return {lap:String(lapS),heat:min(L.heat*lapS/60),race:min((mx?L.moto:L.main)*lapS/60),round:min(rs),short:min(sec(mine)/60),season:ss>=90?(Math.round(ss/30)/2)+" hours":Math.round(ss)+" min"};
}
/* War's rules for every race (race.js VERSIONS + HOUSE), the year's program, and the races you're not in */
var HDESC={
  onlyTied:"On (the usual way): only the riders tied for the top card go to war, and the winner takes every card on the table. Off: everyone joins the war (Pagat).",
  outLoses:"Official (off): your last card plays for the whole war. On: too few cards for a war and you are out of the race.",
  noDown:"A tie is decided at once by the next face-up cards.",
  deucesWild:"Every 2 is wild.", acesWild:"Every Ace is wild (the CEO's house rule).", jokersWild:"Two jokers join every deck and they are wild.",
  wildAs:"A wild card beats every card that isn't wild, or counts as an Ace.",
  form:"The year's real top 10 swap their lowest card for a better one after the deal (once; twice for the top 5). Small on purpose: War stays luck.",
  cards:"26 = half a deck each, as in a two-player game. The decks scale with the gate (a 40-rider moto deals 20 decks)."
};
function ruleRow(key,label,type,choices,house,val,desc,onCh){
  var tag=house===null?"":house?'<span class="bg-tag bg-tag--house">house</span>':'<span class="bg-tag bg-tag--official">official</span>', row;
  if(type==="bool"){
    row=document.createElement("label"); row.className="bg-row";
    row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(label)+" "+tag+'</span>'+(desc?'<span class="bg-row__desc">'+esc(desc)+"</span>":"")+'</span><input type="checkbox" class="bg-toggle" data-k="'+key+'"'+(val?" checked":"")+">";
    row.querySelector("input").addEventListener("change",function(e){ onCh(e.target.checked); });
  } else {
    row=document.createElement("div"); row.className="bg-row bg-row--static";
    row.innerHTML='<span class="bg-row__main"><span class="bg-row__title">'+esc(label)+" "+tag+'</span>'+(desc?'<span class="bg-row__desc">'+esc(desc)+"</span>":"")+'</span><select class="bg-select" data-k="'+key+'" aria-label="'+esc(label)+'">'+
      choices.map(function(c){ return '<option value="'+esc(c[0])+'"'+(String(val)===String(c[0])?" selected":"")+">"+esc(c[1])+"</option>"; }).join("")+"</select>";
    row.querySelector("select").addEventListener("change",function(e){ var m=choices.filter(function(c){ return String(c[0])===e.target.value; })[0]; onCh(m?m[0]:e.target.value); });
  }
  return row;
}
function drawRules(){
  var box=$("houseRules"), o=warOpts();
  keepFocus(box,"data-k",function(){
    box.innerHTML="";
    box.appendChild(ruleRow("version","War version","choice",RC.VERSIONS.map(function(v){ return [v.id,v.name+" ("+v.tag+")"]; }),0,o.version,"Three-card War is the CEO's War: 3 face down, the 4th decides.",function(v){ cfg.war.version=v; drawSetup(); }));
    RC.HOUSE.forEach(function(h){
      var key=h[0]; if(key==="wildAs"&&!(o.deucesWild||o.acesWild||o.jokersWild)) return;
      box.appendChild(ruleRow(key,h[1],h[2],h[3],!!h[4],o[key],HDESC[key]||"",function(v){ cfg.war[key]=v; drawSetup(); }));
    });
    box.appendChild(ruleRow("fill","Fill the gate","choice",[["full","The year's full program"],["roster","Real riders only (smaller races)"]],0,cfg.fill,"When the research lists fewer riders than the night needs, labelled privateers (made-up names) fill the gate; or race with the real riders only.",function(v){ cfg.fill=v; drawSetup(); }));
    box.appendChild(ruleRow("nonTitle","Rounds that paid no points","bool",null,0,cfg.nonTitle,"A few early nights were exhibitions (no championship points). On: race them too.",function(v){ cfg.nonTitle=!!v; drawSetup(); }));
    box.appendChild(ruleRow("others","Races without you","choice",[["ask","Ask: watch or sim"],["sim","Always sim to results"]],null,cfg.others,"The other heat, or the LCQ when you went straight to the Main. The Main is always shown.",function(v){ cfg.others=v; drawSetup(); }));
  });
  syncRules();
}
function changedRules(){ var o=warOpts(), n=0, k; for(k in DEF_WAR) if(String(o[k])!==String(DEF_WAR[k])) n++; if(cfg.fill!=="full") n++; if(!cfg.nonTitle) n++; return n; }
function syncRules(){
  var n=changedRules(), open=ui.rulesOpen;
  $("rulesDesc").textContent=n?n+(n===1?" rule":" rules")+" changed from the standard":"Three-card War, the year's real program. Open it to change any rule.";
  $("rulesToggle").setAttribute("aria-expanded",String(open)); $("houseRules").hidden=!open; $("rulesLegend").hidden=!open;
}
$("rulesToggle").addEventListener("click",function(){ ui.rulesOpen=!ui.rulesOpen; syncRules(); });
function drawSetup(){ fixSeason(); drawSeries(); drawSeasonCard(); drawRiders(); drawLength(); drawRules(); $("skillNote").textContent=BR.skillNote; syncStart(); }
function setSpeedSeg(){ cfg.speed=normSpeed(cfg.speed); window.bgGameSpeed=cfg.speed; $("speedSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.s===cfg.speed; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("speedSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.speed=b.dataset.s; setSpeedSeg(); save(); drawLength(); }); });
function setSkillSeg(){ cfg.skill=normSkill(cfg.skill); if(G&&G.o) G.o.skill=cfg.skill; $("skillSeg").querySelectorAll("button").forEach(function(x){ var on=x.dataset.k===cfg.skill; x.classList.toggle("on",on); x.setAttribute("aria-pressed",String(on)); }); }
$("skillSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.skill=b.dataset.k; setSkillSeg(); save(); }); });
function setAuto(on){ cfg.auto=!!on; $("autoRow").setAttribute("aria-checked",String(cfg.auto)); $("autoBtn").setAttribute("aria-checked",String(cfg.auto)); }
$("autoRow").addEventListener("click",function(){ setAuto(!cfg.auto); save(); });
$("autoBtn").addEventListener("click",function(){ setAuto(!cfg.auto); save(); syncControls(); drive(); });
$("seasonCard").addEventListener("click",openYearPicker);
setSpeedSeg();
function deviceCopy(){
  var tv=onTV(), t=tv?"Riders on this TV":"Riders on this phone";
  $("humansTitle").textContent=t; $("humanSeg").setAttribute("aria-label",t);
  $("humansDesc").textContent="0 = watch the pros race the season. Two or more share the "+(tv?"remote":"phone")+": each rider turns their own card.";
  if($("humanSeg").querySelector(".bg-stepper__btn")) drawRiders();
  syncControls();
}
function syncStart(){
  var rb=$("resumeBtn"), sb=$("startBtn"), resumable=rb.style.display!=="none", si=seasonInfo(cfg.sid);
  $("startLabel").textContent=resumable?"New season":"Start the season";
  var parts=[]; if(si){ parts.push(si.year+" "+SHORTS[si.series]); parts.push(plural(si.rounds,"round")); }
  if(!resumable){ parts.push(LEN_NAME[cfg.length]); if(changedRules()) parts.push("custom rules"); }
  $("startSub").innerHTML=subParts(parts);
  $("startDock").classList.toggle("has-resume",resumable);
  sb.classList.toggle("bg-btn--primary",!resumable); sb.classList.toggle("bg-btn--secondary",resumable);
  rb.classList.toggle("bg-btn--primary",resumable); rb.classList.toggle("bg-btn--secondary",!resumable);
}
function seasonWords(g){ return g.year+" "+SHORTS[g.series]; }
function resumeText(){
  if(ui.result) return;
  var s="Back to the season";
  if(G&&!G.over){ var c=G.cal[G.ri]; s=seasonWords(G)+" · round "+(G.ri+1)+" of "+G.cal.length+(G.race?" · "+(c.city||c.venue):""); }
  $("resumeLabel").textContent="Resume"; $("resumeSub").innerHTML=subParts(s.split(" · "));
}
function resultDue(){ var B=BG(); return !!(G&&G.over&&ui.winShown!==gen&&ui.finished===gen&&B&&B.win&&luxe()); }
function menuResult(){
  if(!resultDue()) return;
  ui.result=true; $("resumeBtn").style.display="block";
  var L=S.standings(G);
  $("resumeLabel").textContent="See the result"; $("resumeSub").textContent=L[0].name+" is the champion";
  saveBar.refresh(); syncStart(); barTitle();
}
function showSetup(on,resume){
  var s=$("setup"), b=document.body, se=document.scrollingElement||document.documentElement;
  s.style.display=on?"":"none";
  b.classList.toggle("mx-in-setup",on);
  $("menuBtn").hidden=on;
  if(on){ closeSheets(); closeWin(); syncStart(); se.scrollTop=0; setView(ui.view,true); }
  if(!on&&G){
    if(!G.race&&ui.view==="race") ui.view="season";
    setView(ui.view);
    if(resume&&ui.result){ ui.result=false; setTimeout(function(){ if(G&&G.over&&!setupShown()) openWin(); },250); }
    else if(ui.pendRound){ setTimeout(function(){ if(G&&ui.pendRound&&!busy&&!ui.lastDone&&!setupShown()&&!sheetUp()) openPodium(); },250); }   /* the Menu shut the results sheet: the podium is still due */
    armBack();
    if(!busy) drive();
  }
  barTitle(); trackShow();
  var B=BG(); if(luxe()&&B.toast&&B.toast.place) B.toast.place();
}
function setView(v,keepBody){
  ui.view=v; var b=document.body;
  b.classList.toggle("mx-v-season",v==="season"); b.classList.toggle("mx-v-race",v==="race");
  var setup=setupShown();
  b.classList.toggle("bg-app--scene",setup||v==="season"); b.classList.toggle("bg-app--felt",!setup&&v==="race");
  if(keepBody) return;
  if(v==="season") renderSeason(); else { layoutArena(); renderRace(); }
  trackShow();
  barTitle();
}
function barTitle(){
  var e=$("barEyebrow"); if(!e) return;
  var t;
  if(setupShown()) t=liveGame()?"Paused":ui.result?"Season over":"New season";
  else if(!G) t="New season";
  else if(G.over&&ui.finished===gen) t="Season over";
  else if(ui.view==="race"&&ui.rc){ var c=G.cal[Math.min(G.ri,G.cal.length-1)]; t=(c.city||c.venue)+" · "+(ui.label||""); }
  else t=G.year+" · round "+Math.min(G.ri+1,G.cal.length)+" of "+G.cal.length;
  if(e.textContent!==t) e.textContent=t;
}

/* ================= saving ================= */
function pack(){ if(!G) return null; return {G:JSON.parse(JSON.stringify(G)),cfg:JSON.parse(JSON.stringify(cfg)),view:ui.view}; }
function save(){ if(!G) return; if(G.over&&ui.finished===gen){ Saves.del(GAME,"auto"); return; } var pk=pack(); if(pk) Saves.auto(GAME,pk); }
function loadSaved(d){
  if(!d||!d.G||d.G.id!=="mxwar"||d.G.v!==S.VER) throw new Error("not a Motocross War save");
  var bad=S.check(d.G); if(bad.length) throw new Error("save fails its check: "+bad[0]);
  gen++; clearTimeout(timer); busy=false; intent=0; skipQ=false;
  G=d.G; var c=d.cfg||{}; for(var k in c) if(Object.prototype.hasOwnProperty.call(cfg,k)) cfg[k]=c[k];
  cfg.speed=normSpeed(cfg.speed); setSpeedSeg(); cfg.skill=normSkill((G.o&&G.o.skill)||cfg.skill); setSkillSeg(); setAuto(cfg.auto);
  resetUI();
  ui.view=G.race?"race":"season"; ui.rc=G.race; ui.lap=0; ui.rmap=G.rmap?G.rmap.slice():null; ui.label=G.race?raceLabel():"";
  ui.use3d=!!(G.race&&view3d()); document.body.classList.toggle("mx-3d",ui.use3d); ui.lapT0=Date.now();
  if(ui.use3d){ var tb=$("table"); tb.setAttribute("role","button"); tb.setAttribute("tabindex","0"); tb.setAttribute("data-focus",""); tb.setAttribute("aria-label","The cards: make them bigger"); }
  closeSheets(); closeWin();
  Sound.music(GAME);
  showSetup(false); drawSetup(); armBack();
  if(G.over){ ui.finished=gen; setView("season"); setTimeout(function(){ if(G&&G.over&&!setupShown()) openWin(); },300); }
}
function resetUI(){ ui.winShown=-1; ui.result=false; ui.finished=-1; ui.order=[]; ui.lastCards={}; ui.bikes={}; ui.pendRound=null; ui.pendSeason=null; ui.log=[]; ui.rc=null; ui.rmap=null; ui.hs=null; ui.trkKey=null; ui.v3key=null; disp=null; trackShow(); renderLog(); }
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
  s=s||{}; cfg.series=LONG[s.series]?s.series:"sx"; cfg.sid=s.sid||null; cfg.humans=s.humans!=null?clamp(+s.humans|0,0,8):1; cfg.length=s.length==="half"||s.length==="short"?"half":"real";
  cfg.speed=normSpeed(s.speed); cfg.skill=normSkill(s.skill); cfg.auto=!!s.auto; cfg.others=s.others==="sim"?"sim":"ask"; cfg.fill=s.fill==="roster"?"roster":"full";
  cfg.nonTitle=s.nonTitle!==false; cfg.war=(s.war&&typeof s.war==="object")?JSON.parse(JSON.stringify(s.war)):{};
  setSpeedSeg(); setSkillSeg(); setAuto(cfg.auto); drawSetup();
}
var saveBar=Saves.bar({game:GAME,el:$("svbar"),version:1,snapNote:"exactly as it is now",saveToast:"Season saved",
  getSettings:function(){ return JSON.parse(JSON.stringify(cfg)); },
  applySettings:applySettings,
  standard:function(){ applySettings({series:cfg.series,sid:cfg.sid,humans:cfg.humans}); },
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
  if(!G&&ui.cont){
    var au=document.querySelector("#svbar button[data-a=au]"); if(au&&!au.disabled) au.click();
    if(!G){ ui.cont=false; $("resumeBtn").style.display="none"; syncStart(); }
    return;
  }
  showSetup(false,true);
});
function contOffer(){
  ui.cont=false; if(G) return false;
  var a=null; try{ a=Saves.get?Saves.get(GAME,"auto"):null; }catch(e){ a=null; }
  var d=a&&a.data; if(!d||!d.G||d.G.over||d.G.id!=="mxwar") return false;
  ui.cont=true; $("resumeBtn").style.display="block"; $("resumeLabel").textContent="Continue";
  $("resumeSub").innerHTML=subParts([d.G.year+" "+(SHORTS[d.G.series]||""),"round "+(d.G.ri+1)+" of "+d.G.cal.length].concat(Saves.when&&a.ts?[Saves.when(a.ts)]:[]));
  syncStart(); return true;
}
$("startBtn").addEventListener("click",function(){
  var bad=numsBad();
  if(bad>=0){ syncNums(); toast(numState(bad).t+" Pick a free number."); var inp=$("nameCard").querySelector('input[data-rx="num"][data-i="'+bad+'"]'); if(inp){ try{ inp.scrollIntoView({block:"center"}); }catch(e){} focusIn(inp); } return; }
  if(liveGame()&&!ui.newOk){ confirmNew(); return; }
  ui.newOk=false; Sound.skip(); closeSheets(); closeWin(); armBack(); startSeason();
});
function confirmNew(){
  var c=G.cal[Math.min(G.ri,G.cal.length-1)];
  $("newSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">New season</span><h2 class="bg-sheet__title" id="newTitle">Start a new season?</h2>'+
    '<p class="bg-sheet__sub">Your '+esc(seasonWords(G))+" season (round "+(G.ri+1)+" of "+G.cal.length+", "+esc(c.city||c.venue)+") ends. Save it first with Save game if you want to come back to it.</p></div>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--secondary bg-btn--lg" id="newYes" type="button">Start the new season</button><button class="bg-btn bg-btn--primary bg-btn--lg" id="newNo" type="button" data-autofocus>Keep racing</button></div>';
  sheetOpen($("newBox"),{focus:"#newNo"});
  $("newYes").addEventListener("click",function(){ sheetClose($("newBox")); ui.newOk=true; $("startBtn").click(); });
  $("newNo").addEventListener("click",function(){ sheetClose($("newBox")); $("resumeBtn").click(); });
}
function startSeason(){
  fixSeason();
  var id=cfg.sid, my=++gen; clearTimeout(timer); busy=false; intent=0; skipQ=false;
  if(!id){ toast("Pick a season first."); return; }
  var d=DATA[id];
  if(!d) toast("Loading the "+seasonInfo(id).year+" season...",{ms:1600});
  loadSeason(id).then(function(D){
    if(my!==gen) return;
    var B=BG(); if(B&&B.toast&&B.toast.hide) B.toast.hide();
    try{ G=S.newSeason(D,IDX,seasonOpts(),humanList()); }catch(e){ toast("This season can't be raced: "+e.message); return; }
    resetUI(); ui.view="season";
    Sound.music(GAME);
    save(); showSetup(false); setView("season"); armBack();
    focusTV($("goBtn"));
  },function(){ if(my===gen) toast("Couldn't load that season (offline?). Try another year or go online once."); });
}

/* ================= the season screen ================= */
function myId(){ return G&&G.humans.length?G.humans[0]:null; }
/* a plate: white with the team colour down its edge; the championship points leader's is RED (the CEO v2); an assigned number (no source
   gives the rider's real one) is set in italics and says so */
function plateHTML(R){ var red=R.id===redId(), gen=R.plateGen&&R.kind!=="human"; /* review fix: a person's number is theirs (picked, or picked for them), never "assigned" */
  return '<span class="mx-pl'+(gen?" is-gen":"")+(red?" is-red":"")+'" style="'+A.mkStyle(R.bike)+'" title="'+(red?"Red plate: the points leader. ":"")+(gen?"Number assigned for the game (no source gives it)":"")+'">'+(R.plate!=null?R.plate:"-")+"</span>"; }
function nameHTML(R){ return esc(R.name)+(R.kind==="privateer"?' <span class="mx-priv">(privateer)</span>':""); }
function stRow(r,meIds,top){
  var R=rider(r.id), me=meIds.indexOf(r.id)>=0;
  return '<li class="'+(me?"is-me":"")+'"><span class="mx-st__p">'+r.place+"</span>"+plateHTML(R)+'<span class="mx-st__n">'+nameHTML(R)+"</span>"+(me&&!(G.humans.length===1&&/^you$/i.test(R.name))?'<span class="mx-you">'+(G.humans.length>1?"P"+(R.seat+1):"You")+"</span>":"")+
    '<span class="mx-st__v">'+r.pts+'</span><span class="mx-st__g">'+(r.place===1?(r.wins?plural(r.wins,"win"):"leader"):"-"+(top-r.pts))+"</span></li>";
}
function standRows(L,max){
  var meIds=G.humans, out=[], top=L.length?L[0].pts:0, shown={};
  L.slice(0,max).forEach(function(r){ out.push(stRow(r,meIds,top)); shown[r.id]=1; });
  var rest=L.filter(function(r){ return meIds.indexOf(r.id)>=0&&!shown[r.id]; });
  if(rest.length){ out.push('<li class="is-gap" aria-hidden="true">...</li>'); rest.forEach(function(r){ out.push(stRow(r,meIds,top)); }); }
  return out.join("");
}
function teamTable(){
  var t={}, rows=[];
  G.results.forEach(function(res){
    var seen={};
    res.cls.forEach(function(id,p){ var R=G.riders[id], b=R&&R.bike; if(!b||b==="Privateer"||seen[b]) return; seen[b]=1;
      var e=t[b]||(t[b]={make:b,pts:0,wins:0,best:99}); e.pts+=res.pts[id]||0; if(p===0) e.wins++; if(p<e.best) e.best=p; });
  });
  for(var k in t) rows.push(t[k]);
  rows.sort(function(a,b){ return b.pts-a.pts||b.wins-a.wins||a.best-b.best||(a.make<b.make?-1:1); });
  rows.forEach(function(r,i){ r.place=i+1; });
  return rows;
}
function renderSeason(){
  if(!G) return;
  var si=seasonInfo(G.sid), n=G.cal.length, L=S.standings(G), me=myId(), mine=me?L.filter(function(r){ return r.id===me; })[0]:null;
  $("seEyebrow").textContent=LONG[G.series]+" · "+G.cls+(G.status&&G.status!=="VERIFIED"?" · partly inferred":"");
  $("seTitle").textContent=G.year+" season";
  $("seSub").textContent=G.over?"Season over · "+L[0].name+" is the champion"+(mine?" · you finished "+ord(mine.place)+" with "+plural(mine.pts,"point"):""):
    "Round "+(G.ri+1)+" of "+n+(mine&&G.results.length?" · "+(G.humans.length>1?mine.name+" is ":"you are ")+ord(mine.place)+" with "+plural(mine.pts,"point"):" · "+G.roster.length+" real riders"+(G.humans.length?" and "+(G.humans.length>1?G.humans.length+" of you":"you"):""));
  $("seProg").style.transform="scaleX("+(n?G.ri/n:0).toFixed(3)+")";
  /* the next race */
  var go=$("goBtn"), sim=$("simBtn");
  if(G.over){
    $("nextEyebrow").textContent="Season over"; $("nextTitle").textContent=L[0].name+" is the "+G.year+" champion";
    $("nextSub").innerHTML=esc(plural(G.cal.length,"round")+" raced.");
    setBtn(go,"The champion","trophy"); sim.hidden=true;
  } else {
    var nx=S.next(G), c=nx.round, F=S.calFormat(G,c);
    $("nextEyebrow").textContent="Round "+(G.ri+1)+" of "+n+(c.title?"":" · no points (exhibition)")+(c.mult>1?" · points x"+c.mult:"");
    $("nextTitle").textContent=(c.city||c.venue)+" · "+nx.label;
    var bits=[];
    if(c.venue&&c.city) bits.push(esc(c.venue)); if(c.date) bits.push(esc(fmtDate(c.date)));
    bits.push(esc(plural(nx.len,"lap")));
    if(nx.n) bits.push(nx.n+" riders");
    $("nextSub").innerHTML=bits.join(" · ")+(nx.newRound?"<br><b>Tonight:</b> "+esc(progWords(F))+".":"")+(!nx.humanIn&&G.humans.length?"<br><b>You're not in this race.</b>":"");
    var final=nx.kind==="main"||nx.kind==="moto";
    ui.goSim=!nx.humanIn&&!final&&cfg.others==="sim"&&G.humans.length>0;
    setBtn(go,ui.goSim?"Sim to results":nx.humanIn||final?"To the gate":"Watch",ui.goSim?"":"play");
    sim.hidden=nx.humanIn||final||ui.goSim;
  }
  /* the calendar */
  $("calList").innerHTML=G.cal.map(function(c,i){
    var done=i<G.ri, nxt=i===G.ri&&!G.over, res=G.results.filter(function(r){ return r.ri===i; })[0], w=res?G.riders[res.winner]:null;
    return '<li class="'+(done?"is-done":"")+(nxt?" is-next":"")+'"><span class="mx-cal__n">'+(i+1)+'</span><span class="mx-cal__c"><b>'+esc(c.city||c.venue)+"</b><span>"+esc([c.venue&&c.city?c.venue:"",fmtDate(c.date)].filter(Boolean).join(" · "))+"</span></span>"+
      '<span class="mx-cal__w">'+(w?esc(w.name):nxt?"Next":c.title?"":"exhibition")+"</span></li>";
  }).join("");
  var none=!G.results.length;
  $("standList").innerHTML=none?'<li class="is-gap">The points start after round 1. The real top riders of '+G.year+': '+esc(realTop(4))+'.</li>':standRows(L,onTV()?20:10);
  $("fullBtn").hidden=none||L.length<=(onTV()?20:10);
  var T=teamTable();
  $("teamList").innerHTML=T.length?T.slice(0,onTV()?10:8).map(function(r){ return '<li><span class="mx-st__p">'+r.place+'</span><span class="mx-mk" style="'+A.mkStyle(r.make)+'">'+esc(r.make)+'</span><span class="mx-st__n"></span><span class="mx-st__v">'+r.pts+'</span><span class="mx-st__g">'+(r.wins?plural(r.wins,"win"):"")+"</span></li>"; }).join(""):
    '<li class="is-gap">After the first round</li>';
  barTitle();
}
function realTop(k){ return G.roster.map(function(id){ return G.riders[id]; }).filter(function(R){ return R.pos!=null; }).sort(function(a,b){ return a.pos-b.pos; }).slice(0,k).map(function(R){ return R.name; }).join(", "); }
function setBtn(b,text,ic){ b.innerHTML=(ic?icon(ic):"")+esc(text); }
$("goBtn").addEventListener("click",function(){
  if(!G||busy) return;
  if(G.over){ openWin(); return; }
  if(lineupDue()){ var t=$("goBtn").textContent.trim(); openLineup(ui.goSim?simNow:enterRace,t||"To the gate"); return; }
  if(ui.goSim){ simNow(); return; }
  enterRace();
});
$("simBtn").addEventListener("click",function(){ if(!G||busy||G.over) return; if(lineupDue()){ openLineup(simNow,"Sim to results"); return; } simNow(); });
$("saveBtn").addEventListener("click",function(){ if(!G||G.over) return; var ok=Saves.put(GAME,"save",pack()); toast(ok?"Season saved: Load saved game brings it back":"Couldn't save (storage blocked?)",{icon:"save"}); saveBar.refresh(); });
$("fullBtn").addEventListener("click",function(){
  var L=S.standings(G), top=L.length?L[0].pts:0;
  $("fullSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">'+esc(G.year+" "+LONG[G.series])+'</span><h2 class="bg-sheet__title" id="fullTitle">All riders</h2></div>'+
    '<ol class="mx-res">'+L.map(function(r){ var R=rider(r.id), me=G.humans.indexOf(r.id)>=0; return '<li class="'+(me?"is-me":"")+(onTV()?" bg-focus":"")+'"'+(onTV()?' data-focus tabindex="-1"':"")+'><span class="mx-res__p">'+r.place+"</span>"+plateHTML(R)+'<span class="mx-res__n">'+nameHTML(R)+(R.plateGen&&R.kind!=="human"?' <span class="mx-asg">assigned no.</span>':"")+'</span><span class="mx-res__x">'+r.pts+" pts"+(r.place>1?" · -"+(top-r.pts):"")+"</span></li>"; }).join("")+"</ol>"+
    '<p class="mx-note">The <span class="mx-pl is-red" style="'+A.mkStyle("")+'">red</span> plate is the points leader. Numbers in <i>italics</i> marked "assigned no." are given by the game: no source for '+G.year+' gives that rider&rsquo;s number.</p>'+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="fullClose" type="button">Close</button></div>';
  sheetOpen($("fullBox"),{focus:"#fullClose"});
  $("fullClose").addEventListener("click",function(){ sheetClose($("fullBox")); });
});

/* ================= the race: build, lay out, draw ================= */
function raceLabel(){ if(!G||!G.round) return ""; var k=G.rkey; var r=G.round.races.filter(function(x){ return x.key===k; })[0]; return r?r.label:""; }
function enterRace(){
  if(!G||G.over) return;
  if(!G.race){ S.startRace(G); }
  skipQ=false; ui.rc=G.race; ui.rmap=G.rmap.slice(); ui.label=raceLabel(); ui.hs=null; ui.lap=0; ui.lastWin=null; disp=null; ui.lastCards={}; ui.bikes={}; ui.order=[]; ui.flagged=false; ui.trkKey=null; ui.v3key=null; ui.lapT0=Date.now();
  ui.use3d=!!view3d(); document.body.classList.toggle("mx-3d",ui.use3d); pipBig(false);
  if(ui.use3d){ var tb=$("table"); tb.setAttribute("role","button"); tb.setAttribute("tabindex","0"); tb.setAttribute("data-focus",""); tb.setAttribute("aria-label","The cards: make them bigger"); }
  save();
  setView("race");
  logLine((G.cal[G.ri].city||G.cal[G.ri].venue)+" "+ui.label+": "+ui.rc.n+" riders behind the gate.");
  drive();
}
function raceHumans(){ var rc=ui.rc; if(!rc) return []; var a=[]; rc.r.forEach(function(p,s){ if(p.human) a.push(s); }); return a; }
function humansAlive(){ var rc=ui.rc; return raceHumans().filter(function(s){ return !rc.r[s].out&&rc.r[s].pk.length>0; }); }
var GEO=null;
/* v2: the arena's top part is the TRACK (track.js: the round's loop, every rider riding it in team colours, passes as ride-ups); the cards of
   the battle under it */
var TRK=null;
function track(){ if(is3d()) return null; if(!TRK&&MX.Track){ try{ TRK=MX.Track.create($("lane")); window.__mxtrk=TRK; }catch(e){ TRK=null; } } return TRK; }
/* ---- MOTOCROSS WAR 3D ---- */
var V3=null, V3tried=false;
function view3d(){
  if(V3||V3tried) return V3; V3tried=true;
  if(/[?&]gl=0(&|$)/.test(location.search)||!MX.Race3D) return null;
  try{ V3=MX.Race3D.create($("view3d"),{onBanner:onBanner3d,onNeed:onNeed3d}); }catch(e){ V3=null; try{ console.warn("mxwar 3d:",e); }catch(x){} }
  if(V3) window.__mx3d=V3;
  return V3;
}
function is3d(){ return !!(V3&&ui.use3d); }
/* the round's lap time (seconds) from its track layout (tracks3d.js): the season sizes the real race lengths with it */
var lapCache={};
MX.lapTime=function(series,year,cal){
  if(!MX.Tracks) return 0;
  try{ var pick=MX.Tracks.forRound(series,year,cal||{}), k=pick.key; if(lapCache[k]==null){ var C=MX.Tracks.build(pick.layout,{variant:pick.variant,gate:series==="mx"?40:22}); lapCache[k]={lap:C.Tlap,open:MX.Tracks.timeAt(C,MX.Tracks.lapEnd(C,1))}; } return lapCache[k].lap; }catch(e){ return 0; }
};
function lapTimes(){ var c=G.cal[Math.min(G.ri,G.cal.length-1)], t=MX.lapTime(G.series,G.year,c)||(G.series==="mx"?120:55), pick=MX.Tracks?MX.Tracks.forRound(G.series,G.year,c):null, e=pick&&lapCache[pick.key]; return {lap:t,open:e?e.open:t*0.75}; }
function accentOf(make){ var m=A.mk(make); return m[0]==="#f2f4f8"?"#183a8c":m[1]==="#0b0a12"?"#1b1b20":"#f2f2f6"; }
/* the race on the 3D view: the track of this round, the riders in their team colours, the gate or the laps already run (a reload) */
function ensure3d(){
  var V=V3, rc=ui.rc; if(!V||!rc) return;
  var key=gen+"|"+G.ri+"|"+G.rkey; if(ui.v3key===key) return; ui.v3key=key;
  var c=G.cal[Math.min(G.ri,G.cal.length-1)], red=redId();
  V.setTrack(G.series,G.year,c,rc.n);
  V.setRiders(rc.r.map(function(p,s){ var R=G.riders[seatId(s)]; return {s:s,color:A.mk(R.bike)[0],accent:accentOf(R.bike),plate:R.plate,red:R.id===red,me:R.kind==="human",name:R.name}; }));
  if(rc.phase==="gate") V.atGate(rc.o.len);
  else { var L=RC.standings(rc), outs={}; rc.r.forEach(function(p,s){ if(p.out) outs[s]=1; });
    V.resume({lap:rc.battle,order:L.map(function(x){ return x.s; }),counts:rc.r.map(function(p){ return p.pk.length; }),outs:outs,len:rc.o.len,flag:rc.battle+1===rc.o.len?"white":null}); }
}
/* the lap's result to the 3D view: the standings, the riders out, the crashes of this battle (CRASH-CONTRACT.md events) */
function send3d(w,war){
  var V=V3, rc=ui.rc; if(!V||!rc) return;
  var L=RC.standings(rc), outs={}, crashes=[], sector=0.5;
  rc.r.forEach(function(p,s){ if(p.out) outs[s]=1; });
  (ui.batch||[]).forEach(function(e){ if(e.e==="yellow"&&e.sector!=null) sector=e.sector; });
  (ui.batch||[]).forEach(function(e){ if(e.e==="crash") crashes.push({s:e.s,kind:e.kind,depth:e.depth,by:e.by,sector:sector}); });
  V.result({lap:rc.battle,order:L.map(function(x){ return x.s; }),counts:rc.r.map(function(p){ return p.pk.length; }),outs:outs,crashes:crashes,winner:w,war:war|0,last:rc.over||rc.battle>=rc.o.len,len:rc.o.len});
}
/* the view's moments: the holeshot as the leader exits turn 1, a crash as it happens (with the yellow flag) */
function onBanner3d(b){
  if(!G||!ui.rc) return;
  if(b.kind==="holeshot"&&ui.hs!=null){ var R=G.riders[seatId(ui.hs)]; Sound.sfx("bell"); banner("Holeshot!","#"+R.plate+" "+R.name+(R.bike?" · "+R.bike:""),dl(1500),"is-calm"); }
  else if(b.kind==="crash"&&b.seat>=0){ var R2=G.riders[seatId(b.seat)]; Sound.sfx("cannon");
    banner(b.out?"Crash: out of the race":"Crash!","#"+R2.plate+" "+R2.name+" · yellow flag"+(b.out?"":" · back up and riding"),dl(2200),"is-yellow"); }
}
/* real time never stops: a person's card still face down 5 s before the line turns by itself */
function onNeed3d(lap){
  var rc=ui.rc; if(!G||!rc||rc.over||busy||paused()) return;
  if(RC.need(rc).length){ toast("Time's up: "+(G.humans.length>1?"the cards":"your card")+" turned for lap "+Math.min(lap,rc.o.len)+".",{ms:2200}); act({t:"flipAll"}); }
}
/* the 2D fallback at real lap times too: a lap lasts the track's lap time from the moment the leader starts it */
function lapWait2d(){ var t=lapTimes(), ms=(ui.lap<=1?t.open:t.lap)*1000, left=(ui.lapT0||0)+ms-Date.now(); return left>0?sleep(left):Promise.resolve(); }
/* the corner window: its header (the lap, whose card), big on a tap / OK */
function pipHead(t,war){ var h=$("pipHead"); if(!h) return; h.innerHTML=t; h.classList.toggle("is-war",!!war); }
function pipBig(on){ var t=$("table"); if(on==null) on=!t.classList.contains("is-big"); t.classList.toggle("is-big",on); t.setAttribute("aria-expanded",String(on)); if(is3d()) layoutArena(); if(ui.rc){ if(ui.rc.phase==="war"&&ui.rc.part&&ui.rc.part.length) drawWar(ui.rc.part,ui.rc.tb,false); } }
function pipCw(){ var big=$("table").classList.contains("is-big"), rem=remPx(), tv=onTV(), side=!tv&&innerWidth>innerHeight&&innerHeight<520; return Math.round(big?(tv?4.6*rem:Math.min(76,rem*4.6)):(tv?2.3*rem:side?30:Math.max(34,rem*2.2))); }
function layoutArena(){
  var ar=$("arena"), W=ar.clientWidth, H=ar.clientHeight; if(!W||!H) return false;
  if(is3d()){
    ["youSlot","topSlot","midNote"].forEach(function(id){ var e=$(id); e.style.left=e.style.top=e.style.width=""; });
    var cw3=pipCw(); $("table").style.setProperty("--cw",cw3+"px"); ar.style.removeProperty("--lane-h");
    GEO={W:Math.min(W,$("table").clientWidth||W*0.5),H:600,laneH:0,cw:cw3};
    V3.resize(); return true;
  }
  var rem=remPx(), tv=onTV(), laneH=Math.round(H*(tv?0.56:0.54));
  ar.style.setProperty("--lane-h",laneH+"px");
  var th=H-laneH, cw=Math.round(Math.min((th-rem*(tv?3.4:3.3))/1.4,W*0.2,rem*(tv?7.5:7)));
  cw=Math.max(cw,tv?Math.round(2.6*rem):34);
  $("table").style.setProperty("--cw",cw+"px");
  var you=$("youSlot"), top=$("topSlot"), mid=$("midNote");
  you.style.left="24%"; top.style.left="76%"; you.style.top=top.style.top=Math.round(rem*.35)+"px";
  you.style.width=top.style.width=Math.round(W*.4)+"px";
  mid.style.top=Math.round(th*.48)+"px";
  GEO={W:W,H:H,laneH:laneH,cw:cw};
  var T=track(); if(T){ T.resize(); placeGate(); }
  return true;
}
/* the steel gate (#gate, its drop animation and the dust) stands across the track's start straight */
function placeGate(){
  var T=track(), gt=$("gate"), du=$("dust"); if(!gt.firstChild) gt.innerHTML=A.gate();
  var r=T&&T.gateRect(); if(!r) return;
  gt.style.left=Math.round(r.x-r.w/2)+"px"; gt.style.top=Math.round(r.y)+"px"; gt.style.height=Math.round(r.h)+"px"; gt.style.width=Math.round(r.w)+"px";
  du.style.left=Math.round(r.x-r.h*0.2)+"px"; du.style.top=Math.round(r.y-r.h*0.2)+"px"; du.style.height=Math.round(r.h*1.4)+"px"; du.style.width=Math.round(r.h*3)+"px";
}
function redId(){ if(!G) return null; var k=gen+"|"+G.results.length+"|"+G.ri; if(ui.redK!==k){ ui.redK=k; ui.red=S.redPlate(G); } return ui.red; }
/* the track's riders for this race (team colours, plates, the red plate, the people) */
function trackRiders(){
  var T=track(), rc=ui.rc; if(!T||!rc) return;
  var key=gen+"|"+G.ri+"|"+G.rkey; if(ui.trkKey===key) return;
  ui.trkKey=key;
  var c=G.cal[Math.min(G.ri,G.cal.length-1)], red=redId();
  T.setLayout(G.series==="mx"?"outdoor":"stadium",(c.venue||"")+"|"+(c.city||"")+"|"+G.year);
  T.setRiders(rc.r.map(function(p,s){ var R=G.riders[seatId(s)], m=A.mk(R.bike); return {s:s,color:m[0],accent:m[0]==="#f2f4f8"?"#183a8c":"#f2f2f6",plate:R.plate,red:R.id===red,me:R.kind==="human"}; }));
  T.setPace(lapGuess());
  if(rc.phase==="gate") T.gate(true);
  else { T.gate(false); trackSync(false); T.setLaps(rc.battle,rc.o.len); }
  T.setFlag(rc.over?"checkered":(rc.phase!=="gate"&&rc.battle+1===rc.o.len?"white":null));
}
/* a first guess at a lap's length on screen (the track learns the real one from the laps it sees) */
/* review fix: the first guess is the MEASURED lap time at this Game speed (LAP_S, the setup's estimate; a race without you is watched
   about 1.5 times slower), so the field doesn't reach the line early and wait there on the first laps */
function lapGuess(){ return Math.round(lapTimes().lap*1000); }
/* the standings on the track: every rider at their gap behind the leader (the cards on show while a battle plays) */
function trackSync(atGate){
  var T=track(), rc=ui.rc; if(!T||!rc) return;
  if(atGate){ T.gate(true); return; }
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; }), outs={};
  rc.r.forEach(function(p,s){ if(p.out&&(!disp||disp.cnt[s]===0)) outs[s]=1; });   /* parked once the show has reached their last card */
  var order=ui.order.length?ui.order:rc.r.map(function(p,s){ return s; });
  T.update(order,counts,outs);
}
function trackShow(){ var on=!!(G&&ui.rc&&ui.view==="race"&&!setupShown()&&!boardOpen()); if(is3d()){ V3.show(on); return; } if(V3) V3.show(false); var T=track(); if(T) T.show(on); }
function setCard(el,id,up){
  var top=el.classList.contains("is-top");
  el.className="mx-card"+(up&&id!=null?" is-up":"")+(id==null&&!up?" is-empty":"")+(top?" is-top":"");
  el.innerHTML=A.cardInner(id);
  if(up&&id!=null&&ui.rc&&RC.isWild(ui.rc,id)) el.classList.add("is-wild");
}
function flipCard(el,id,ms,zoom){
  setCard(el,id,true);
  if(reduced()||!el.animate) return Promise.resolve();
  var inn=el.firstElementChild, ps=[];
  try{ ps.push(inn.animate([{transform:"rotateY(180deg)"},{transform:"rotateY(0deg)"}],{duration:ms,easing:"cubic-bezier(.3,.6,.25,1)"}).finished); }catch(e){}
  if(zoom){ try{ ps.push(el.animate([{transform:"scale(1)"},{transform:"scale(1.18)",offset:.5},{transform:"scale(1)"}],{duration:Math.round(ms*1.4),easing:"ease-in-out"}).finished); }catch(e){} }
  return Promise.all(ps).then(function(){},function(){});
}
function whoHTML(s){ var id=seatId(s), R=G.riders[id]; return plateHTML(R)+'<span class="mx-sn">'+esc(R.name)+"</span>"+(R.kind==="human"&&G.humans.length===1&&!/^you$/i.test(R.name)?' <span class="mx-you">You</span>':""); }
function focusHuman(){ var hs=raceHumans(); if(!hs.length) return -1; var rc=ui.rc, need=RC.need(rc); if(need.length) return need[0]; var al=hs.filter(function(s){ return !rc.r[s].out; }); return al.length?al[0]:hs[0]; }
function renderRace(){
  var rc=ui.rc; if(!rc||!G) return;
  var c=G.cal[Math.min(G.ri,G.cal.length-1)], series=G.series;
  if(!$("trackArt").firstChild||$("trackArt").getAttribute("data-k")!==series){ $("trackArt").innerHTML=A.track(series==="mx"?"outdoor":"stadium","r"); $("trackArt").setAttribute("data-k",series); }
  $("raceTitle").textContent=(c.city||c.venue)+" · "+ui.label;
  if(!disp) disp={cnt:rc.r.map(function(p){ return p.pk.length; })};
  ui.order=RC.standings(rc).map(function(r){ return r.s; });
  if(!ui.lap) ui.lap=rc.battle+1;
  chips();
  var gate=rc.phase==="gate";
  var gt=$("gate"); if(gt.getAnimations) gt.getAnimations().forEach(function(a){ a.cancel(); }); gt.style.display=gate?"":"none"; gt.style.transform="";
  layoutArena(); if(is3d()) ensure3d(); else { trackRiders(); trackSync(gate); }
  /* the cards on the table now (a war in progress is drawn as a war; else the last battle) */
  if(rc.phase==="war"&&rc.part&&rc.part.length) drawWar(rc.part,rc.tb,false);
  else { $("warRow").innerHTML=""; drawDuel(); }
  renderTower(null);
  if(is3d()) pipHead(gate?"<span>The gate</span><b>"+esc(rc.n+" riders")+"</b>":"<span>Lap "+Math.min(ui.lap,rc.o.len)+" · cards</span><b>"+(onTV()?"OK: bigger":"Tap: bigger")+"</b>");
  syncControls();
  barTitle();
}
function drawDuel(winS){
  $("youSlot").hidden=false; $("topSlot").hidden=false; $("midNote").hidden=false;
  var rc=ui.rc, h=focusHuman(), lc=ui.lastCards;
  var left=h>=0?h:(ui.order.length?ui.order[0]:0);
  $("youLab").textContent=h>=0?(G.humans.length>1?"Card of":"Your card"):"Race leader";
  var lcId=lc[left]; setCard($("youCard"),lcId!=null?lcId:null,lcId!=null);
  $("youWho").innerHTML=whoHTML(left);
  var w=winS!=null?winS:ui.lastWin;
  if(w!=null&&lc[w]!=null){ setCard($("topCard"),lc[w],true); $("topWho").innerHTML=whoHTML(w); $("topLab").textContent=w===left&&G.humans.length===1&&h>=0?"Top card: yours":"Top card"; $("topCard").classList.add("is-win"); }
  else { setCard($("topCard"),null,false); $("topWho").innerHTML=""; $("topLab").textContent="Top card"; }
  var rcp=rc.phase==="gate";
  $("midBig").textContent=rcp?"Gate":rc.over?"Flag":"Lap "+Math.min(ui.lap,rc.o.len);
  $("midSmall").textContent=rcp?"30 seconds":rc.over?"":"of "+rc.o.len;
}
function chips(){
  var rc=ui.rc; if(!rc) return;
  var lp=Math.min(ui.lap,rc.o.len), last=rc.phase!=="gate"&&!rc.over&&lp===rc.o.len&&rc.o.len>1;
  $("lapChip").innerHTML=rc.phase==="gate"?"On the gate":rc.over?A.flag()+"Checkered flag":(last?A.wflag():"")+"Lap "+lp+" of "+rc.o.len+(last?" · last lap":"");
  $("lapChip").classList.toggle("is-white",last);
  var l3=$("lap3d"); if(l3){ var yel=!!(rc.yellow&&rc.yellow.lap===ui.lap&&!rc.over); l3.innerHTML=rc.phase==="gate"?"On the gate":rc.over?A.flag()+"Finish":(last?A.wflag():"")+"Lap "+lp+" / "+rc.o.len+(yel?" · yellow":""); l3.classList.toggle("is-white",last); l3.classList.toggle("is-yellow",yel); }
  $("hsChip").innerHTML=ui.hs!=null?"Holeshot: "+esc(G.riders[seatId(ui.hs)].name):"";
  $("fieldChip").textContent=fieldWords();
}
function fieldWords(){
  var rc=ui.rc; if(!rc||!G.round) return rc?plural(rc.n,"rider"):"";
  var RG=G.round, r=RG.races.filter(function(x){ return x.key===G.rkey; })[0]||RD.current(RG), st=r&&r.st>=0?RG.st[r.st]:null, t=rc.n+" riders";
  if(st){ if(st.toMain) t+=" · top "+st.toMain+" to the "+(RG.F.finals.kind==="moto"?"motos":RG.F.finals.label); else if(st.toNext&&st.toNext!=="rest") t+=" · top "+st.toNext+" move on"; }
  else if(r&&r.st<0){ var tb=RG.F.table||[]; t+=" · points to the top "+tb.filter(function(x){ return x>0; }).length; }
  return t;
}
/* the timing tower: positions 1..N, the plate in the team colour, the name, the card turned this battle, the cards held, the gap */
function renderTower(mark){
  var rc=ui.rc; if(!rc) return;
  var tv=onTV(), order=ui.order.length?ui.order:rc.r.map(function(p,s){ return s; }), n=order.length, hs=raceHumans();
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; }), lead=counts[order[0]]||0;
  var rows=[], shown={};
  var max=tv?40:10;
  function row(s,i){
    var id=seatId(s), R=G.riders[id], me=R.kind==="human", out=rc.r[s].out, c=ui.lastCards[s], cls=(me?" is-me":"")+(out?" is-out":"")+(mark&&mark.win===s?" is-win":"")+(mark&&mark.fight&&mark.fight.indexOf(s)>=0?" is-fight":"");
    shown[s]=1;
    return '<li class="'+cls.trim()+'"><span class="mx-tw__p">'+(i+1)+"</span>"+plateHTML(R)+'<span class="mx-tw__n">'+esc(R.name)+"</span>"+
      '<span class="mx-tw__c'+(A.chipRed(c)?" is-red":"")+'">'+(c!=null&&!out?A.chip(c):"")+'</span><span class="mx-tw__k">'+(out?"out":counts[s])+'</span><span class="mx-tw__g">'+(i===0||out||lead===counts[s]?"":"-"+(lead-counts[s]))+"</span></li>";
  }
  order.slice(0,max).forEach(function(s,i){ rows.push(row(s,i)); });
  var miss=hs.filter(function(s){ return !shown[s]; });
  if(miss.length){ rows.push('<li class="is-sep" aria-hidden="true"></li>'); miss.forEach(function(s){ rows.push(row(s,order.indexOf(s))); }); }
  var tw=$("tower"); tw.innerHTML=rows.join("");
  if(is3d()) tower3d(order,counts);
  var two=tv&&rows.length>20; tw.classList.toggle("is-two",two); if(two) tw.style.setProperty("--tw-rows",String(Math.ceil(rows.length/2))); else tw.style.removeProperty("--tw-rows");
  $("towerSub").textContent=tv||n<=10?n+" riders · cards held":"top 10"+(miss.length?" + you":"")+" of "+n+" · cards held";
}
/* the broadcast tower over the 3D view: the top 5 (TV: 10), then you; the red plate, team colours, OUT for a rider out of the race */
function tower3d(order,counts){
  var rc=ui.rc, el=$("tower3d"); if(!el||!rc) return;
  var max=onTV()?10:5, hs=raceHumans(), rows=[], shown={};
  function row(s,i){ var R=G.riders[seatId(s)], p=rc.r[s], me=R.kind==="human", nm=String(R.name).split(" ").slice(-1)[0];
    shown[s]=1; return '<li class="'+(me?"is-me":"")+(p.out?" is-out":"")+'"><span class="mx-tw3__p">'+(i+1)+"</span>"+plateHTML(R)+'<span class="mx-tw3__n">'+esc(nm)+"</span>"+(p.out?'<span class="mx-tw3__x">'+(p.dnf&&p.dnf.why==="crash"?"OUT":"out")+"</span>":"<span></span>")+"</li>"; }
  order.slice(0,max).forEach(function(s,i){ rows.push(row(s,i)); });
  hs.forEach(function(s){ if(!shown[s]){ rows.push('<li class="is-gap"></li>'); rows.push(row(s,order.indexOf(s))); } });
  el.innerHTML=rows.join("");
}
/* "You" is the person when they raced without a name: "You win", never "You wins" */
function youVerb(t){ return String(t).replace(/\bYou (wins|takes|moves|gets|grabs|turns|leads|holds|keeps|pulls|snaps|runs|flips)\b/g,function(m,v){ return "You "+v.slice(0,-1); }).replace(/\bYou has\b/g,"You have").replace(/\bYou is\b/g,"You are").replace(/\bYou's\b/g,"Your"); }
function logLine(t){ if(!t) return; t=youVerb(t); ui.log.push(t); if(ui.log.length>12) ui.log.shift(); renderLog(); }
function renderLog(){ $("log").innerHTML=ui.log.slice(-6).map(function(t){ return "<li>"+esc(t)+"</li>"; }).join(""); }
function say(e){ try{ var t=BR.react(G,e); if(t) logLine(t); }catch(x){} }

/* ================= controls ================= */
function mainControl(){
  if(!G) return null;
  if(ui.view==="season") return $("goBtn");
  var f=$("flipBtn"); if(!f.hidden&&!f.disabled) return f;
  var k=$("skipBtn"); if(!k.hidden) return k;
  return f;
}
function syncControls(){
  var rc=ui.rc, f=$("flipBtn"), auto=$("autoBtn"), skip=$("skipBtn"), stat=$("stat");
  if(!G||ui.view!=="race"||!rc){ return; }
  var hs=raceHumans(), alive=humansAlive(), need=rc.over?[]:RC.need(rc);
  var gate=rc.phase==="gate";
  f.hidden=!hs.length||rc.over||(!gate&&!alive.length);
  auto.hidden=!hs.length||rc.over;
  skip.hidden=rc.over||(!is3d()&&hs.length&&alive.length>0);
  if(is3d()) skip.textContent=hs.length&&alive.length?"Skip to the finish":"Sim to the flag";
  var lbl="Flip", sub="";
  if(gate){ lbl="Drop the gate"; sub=hs.length>1?"then every rider turns a card":""; }
  else if(rc.phase==="war"&&need.length){ lbl="War: 3 down, flip the 4th"; }
  if(need.length&&(G.humans.length>1)){ var R=G.riders[seatId(need[0])]; sub=R.name+" · #"+R.plate; }
  $("flipLabel").textContent=lbl; $("flipSub").textContent=sub; $("flipSub").hidden=!sub;
  f.disabled=false;
  var t="";
  if(skipQ&&!rc.over) t="Simming to the flag...";
  else if(rc.over) t="Checkered flag.";
  else if(!hs.length) t=G.humans.length?"You're not in this race: watch it, or sim to the flag.":"Watching the pros.";
  else if(gate) t=cfg.auto?"The gate drops by itself (Auto).":"Riders ready: drop the gate.";
  else if(!alive.length) t="Out of cards: the race runs on without you. Sim to the flag?";
  else if(busy) t=need.length?"Next: "+(G.humans.length>1?G.riders[seatId(need[0])].name+" flips":"your flip"):"";
  else if(!need.length&&rc.phase==="war") t="War between "+whoList(rc.part||[])+": their cards turn"+(intent?" (your flip is queued)":"")+".";
  else if(!need.length) t=intent?"Your flip is queued for the next lap.":"";
  else if(need.length) t=cfg.auto?"Auto: your card turns by itself.":(rc.phase==="war"?"War! Lay 3 down and turn the 4th.":(G.humans.length>1?G.riders[seatId(need[0])].name+": turn your card.":"Turn your card."));
  stat.textContent=t;
  $("hintOk").textContent=gate&&hs.length?"Drop the gate":need.length?"Flip":!skip.hidden?"Sim to the flag":"Flip";
  if(onTV()&&!busy){ var mc=mainControl(), a=document.activeElement; if(mc&&!mc.hidden&&(a===document.body||!a||(a.disabled)||a.hidden||!$("race").contains(a))&&!sheetUp()) focusTV(mc); }
}
function sheetUp(){ var B=BG(); return !!(B&&B.sheet&&B.sheet.top&&B.sheet.top())||!!(B&&B.win&&B.win.isOpen&&B.win.isOpen()); }
$("flipBtn").addEventListener("click",function(){
  if(!G||!ui.rc||ui.rc.over||ui.view!=="race") return;
  intent=1;
  if(!busy) drive(); else syncControls();
});
$("skipBtn").addEventListener("click",function(){ if(!G||!ui.rc||ui.rc.over) return; if(is3d()&&humansAlive().length){ confirmSkip(); return; } if(busy){ skipQ=true; syncControls(); return; } simNow(); });
/* "Skip to the finish" (the CEO ~21:10: confirms, then shows the result): the rest of the race is decided by the cards at once */
function confirmSkip(){
  var rc=ui.rc; if(!rc) return;
  $("skipSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">'+esc(ui.label||"The race")+'</span><h2 class="bg-sheet__title" id="skipTitle">Skip to the finish?</h2></div>'+
    '<p class="mx-skipq">The cards decide the last '+plural(Math.max(1,rc.o.len-rc.battle),"lap")+" at once and you see the result. The race on the track stops here.</p>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--secondary bg-btn--lg" id="skipYes" type="button">Skip to the finish</button><button class="bg-btn bg-btn--primary bg-btn--lg" id="skipNo" type="button" data-autofocus>Keep watching</button></div>';
  sheetOpen($("skipBox"),{focus:"#skipNo"});
  $("skipYes").addEventListener("click",function(){ sheetClose($("skipBox"),"go"); if(busy){ skipQ=true; syncControls(); return; } simNow(); });
  $("skipNo").addEventListener("click",function(){ sheetClose($("skipBox")); });
}
$("table").addEventListener("click",function(e){ if(!is3d()) return; e.stopPropagation(); pipBig(); });
$("table").addEventListener("keydown",function(e){ if(!is3d()) return; if(e.key==="Enter"||e.key===" "||e.keyCode===13){ e.preventDefault(); e.stopPropagation(); pipBig(); } });
$("arena").addEventListener("click",function(){ if(ui.rc&&!ui.rc.over&&raceHumans().length&&!busy&&(ui.rc.phase==="gate"||RC.need(ui.rc).length)){ intent=1; drive(); } });

/* ================= the turn: queue the person's flip, pace the field ================= */
function later(my,fn,ms){
  clearTimeout(timer);
  timer=setTimeout(function tick(){
    if(my!==gen||!G) return;
    if(paused()){ timer=setTimeout(tick,250); return; }
    if(busy){ timer=setTimeout(tick,60); return; }
    fn();
  },Math.max(0,ms));
}
function drive(){
  clearTimeout(timer);
  if(!G||busy) return;
  if(paused()){ return; }
  if(G.over&&ui.finished!==gen&&!G.race){ if(ui.view==="season") renderSeason(); return; }
  if(ui.view!=="race"){ var mc=mainControl(); if(onTV()&&mc&&!sheetUp()&&(!document.activeElement||document.activeElement===document.body)) focusTV(mc); return; }
  var rc=ui.rc; if(!rc||rc.over){ syncControls(); return; }
  var my=gen, hs=raceHumans();
  syncControls();
  if(rc.phase==="gate"){
    if(hs.length&&!cfg.auto){ if(intent){ intent=0; act({t:"drop"}); } else focusTV($("flipBtn")); return; }
    later(my,function(){ act({t:"drop"}); },dl(hs.length?900:1300)); return;
  }
  var need=RC.need(rc);
  if(need.length){
    /* the gate drop turns everyone's first card: the holeshot is decided on the run to turn 1 (the CEO: "The whole shot would be who wins
       the first round of each race") */
    if(is3d()&&rc.battle===0){ intent=0; later(my,function(){ act({t:"flipAll"}); },dl(rc.phase==="war"?420:260)); return; }
    if(intent){ intent=0; act({t:"flip",s:need[0]}); return; }
    if(cfg.auto){ later(my,function(){ act({t:"flipAll"}); },dl(rc.phase==="war"?380:520)); return; }
    focusTV($("flipBtn"));
    return;
  }
  var wait=rc.phase==="war"?dl(420):is3d()?dl(rc.battle===0?260:520):Math.max(200,Math.round(BR.pace(G,cfg.speed)*(hs.length?0.6:1)));
  later(my,function(){ act({t:"step"}); },wait);
}
/* one move (or the field's step): apply it, save, then play its events in order; the next move waits for the table */
function act(m){
  if(!G||busy||!ui.rc||ui.rc.over) return false;
  var rc=ui.rc, ev=[], pre=rc.r.map(function(p){ return p.pk.length; });
  ui.lap=rc.battle+1;
  if(m.t==="step"){ ev=S.step(G); }
  else if(m.t==="flipAll"){ RC.need(rc).slice().forEach(function(s){ var r=S.apply(G,{t:"flip",s:s}); if(r.ok) ev=ev.concat(r.ev); }); }
  else { var r=S.apply(G,m); if(!r.ok){ syncControls(); setTimeout(drive,0); return false; } ev=r.ev; }
  try{ BR.observe(G,ev); }catch(e){}
  save();
  var my=gen; busy=true; disp={cnt:pre}; syncControls();
  playBatch(my,ev).then(null,function(e){ try{ console.warn("mxwar: animation",e); }catch(x){} }).then(function(){
    if(my!==gen) return;
    busy=false;
    if(skipQ){ skipQ=false; if(ui.rc&&!ui.rc.over&&!G.over){ disp=null; simNow(); return; } }
    if(ui.rc&&!ui.rc.over){ disp=null; renderRace(); }
    afterBatch();
    drive();
  });
  return true;
}
/* while the Menu is open the show holds (between events and inside a war) */
async function hold(my){ while(my===gen&&setupShown()) await sleep(200); }
async function playBatch(my,evs){
  ui.batch=evs;
  for(var i=0;i<evs.length;i++){ if(my!==gen) return; await hold(my); await animEvent(my,evs[i]); }
}
function nm(s){ return G.riders[seatId(s)].name; }
function whoList(seats){ return seats.length<=3?listNames(seats.map(nm)):seats.length+" riders"; }
async function animEvent(my,e){
  var rc=ui.rc;
  if(!rc) return;   /* the race was simmed under the show: nothing left to draw */
  switch(e.e){
    case "gate": {
      ui.lapT0=Date.now();
      if(is3d()){ Sound.sfx("jail"); logLine("The 30-second card is up: the cards turn for the holeshot, then the gate drops."); ui.lap=1; chips(); return; }
      Sound.sfx("jail"); logLine("The gate drops!");
      var gt=$("gate"), du=$("dust");
      if(!reduced()&&gt.animate){
        try{ gt.animate([{transform:"rotate(0deg)"},{transform:"rotate(-84deg)"}],{duration:sp(320),easing:"cubic-bezier(.55,0,.85,.35)",fill:"forwards"}); }catch(x){}
        try{ du.animate([{opacity:0,transform:"translateX(0)"},{opacity:.95,offset:.3},{opacity:0,transform:"translateX(30%)"}],{duration:sp(900),easing:"ease-out"}); }catch(x){}
        await sleep(sp(340));
      }
      gt.style.display="none";
      ui.lap=1; chips(); var T0=track(); if(T0){ T0.gate(false); T0.lap(0,rc.o.len); }
      await sleep(dl(250));
      return;
    }
    case "acted": { if(!e.auto&&isHumanId(seatId(e.s))){ Sound.sfx("click"); } return; }
    case "reveal": {
      if(e.w===0){
        ui.lapPre=disp.cnt.slice(); ui.lastWin=null; $("warRow").innerHTML=""; $("youSlot").hidden=false; $("topSlot").hidden=false; $("midNote").hidden=false;
        e.cards.forEach(function(x){ ui.lastCards[x.s]=x.c; disp.cnt[x.s]=Math.max(0,disp.cnt[x.s]-1); });
        Sound.sfx("card");
        var h=focusHuman(), left=h>=0&&ui.lastCards[h]!=null?h:null;
        $("midBig").textContent="Lap "+Math.min(ui.lap,rc.o.len); $("midSmall").textContent="of "+rc.o.len;
        var best=bestOf(e.cards), ps=[];
        if(left!=null){ $("youWho").innerHTML=whoHTML(left); $("youLab").textContent=G.humans.length>1?"Card of":"Your card"; ps.push(flipCard($("youCard"),ui.lastCards[left],sp(360))); }
        else { var L0=ui.order.length?ui.order[0]:e.cards[0].s; $("youLab").textContent="Race leader"; $("youWho").innerHTML=whoHTML(L0); ps.push(flipCard($("youCard"),ui.lastCards[L0]!=null?ui.lastCards[L0]:null,sp(360))); }
        $("topCard").classList.remove("is-win");
        renderTower(null);
        if(is3d()) pipHead("<span>Lap "+Math.min(ui.lap,rc.o.len)+" · cards</span><b>"+(onTV()?"OK: bigger":"Tap: bigger")+"</b>");
        await Promise.all(ps);
        if(best.length===1){ $("topLab").textContent=best[0]===left&&G.humans.length===1?"Top card: yours":"Top card"; $("topWho").innerHTML=whoHTML(best[0]); await flipCard($("topCard"),ui.lastCards[best[0]],sp(300)); }
        else { $("topLab").textContent="Tie for the top"; $("topWho").innerHTML='<span class="mx-sn">'+esc(whoList(best))+"</span>"; await flipCard($("topCard"),ui.lastCards[best[0]],sp(300)); }
        await sleep(dl(best.length>1?260:200));
      } else {
        /* a war: each fighter lays its face-down cards, then the 4th turns (the CEO's war: 3 down, the 4th decides) */
        e.cards.forEach(function(x){ disp.cnt[x.s]=Math.max(0,disp.cnt[x.s]-(x.down+(x.held?0:1))); ui.lastCards[x.s]=x.c; });
        var cols=$("warRow").querySelectorAll(".mx-fight"), steps=[];
        for(var d=0;d<3;d++){
          var any=false;
          e.cards.forEach(function(x){ var col=colOf(cols,x.s); if(col&&d<x.down){ addBack(col,d); any=true; } });
          if(any){ Sound.sfx("discard"); await sleep(sp(150)); }
        }
        renderTower({fight:e.cards.map(function(x){ return x.s; })});
        await sleep(dl(220)); await hold(my);
        e.cards.forEach(function(x){ var col=colOf(cols,x.s); if(col&&!x.held) steps.push(flipTop(col,x.c,sp(420))); });
        Sound.sfx("card");
        await Promise.all(steps);
        await sleep(dl(260));
      }
      return;
    }
    case "war": {
      var tiedR=rc.cur&&e.tied.length?A.info(ui.lastCards[e.tied[0]]).r:0;
      logLine((e.n>1?"War again! ":"War! ")+whoList(e.tied)+" tie"+(tiedR?" with "+rankPlural(tiedR):"")+".");
      if(is3d()){
        /* the war plays in the corner window only: the race stays the show (the CEO: "wars will be in a tiny box window") */
        Sound.sfx(e.n>1?"cannon":"discard");
        var sur=e.tied.map(function(s){ return String(nm(s)).split(" ").slice(-1)[0]; }), who=sur.length>3?sur.length+" riders":sur.join(" · ");
        pipHead("<span>"+esc(e.n>2?"Triple war!":e.n===2?"Double war!":"War!")+"</span><b>"+esc(who)+"</b>",true);
        if(e.n>=2) logLine(e.n>2?"A triple war: whoever loses it crashes out of the race.":"A double war: whoever loses it crashes.");
        drawWar(e.seats,null,true); renderTower({fight:e.seats}); await sleep(dl(e.n>1?650:420)); return;
      }
      Sound.sfx("cannon"); flash();
      drawWar(e.seats,null,true);
      renderTower({fight:e.seats});
      await banner(e.n>1?(e.n===2?"Double war!":"War again!"):"War!",whoList(e.tied)+(tiedR?" · "+rankPlural(tiedR):""),dl(e.n>1?700:850));
      return;
    }
    case "kitty": { logLine(nm(e.s)+" also takes "+plural(e.n,"left-over card")+"."); return; }
    case "short": { e.seats.forEach(function(s){ disp.cnt[s]=0; }); logLine(whoList(e.seats)+(e.seats.length>1?" don't":" doesn't")+" have enough cards for the war."); return; }
    case "deadlock": { if(is3d()) send3d(-1,0); var T2=track(); if(T2) T2.lap(ui.lap,rc.o.len); refreshBoard(); logLine(whoList(e.seats)+" tie with their last cards: "+plural(e.n,"card")+" set aside."); await banner("Dead heat",plural(e.n,"card")+" set aside",dl(800),"is-calm"); return; }
    case "win": {
      disp.cnt[e.s]+=e.n; ui.lastWin=e.s;
      var me=isHumanId(seatId(e.s));
      if(e.war){
        var col=colOf($("warRow").querySelectorAll(".mx-fight"),e.s); if(col) col.classList.add("is-win");
        var bl=null; try{ bl=BR.react(G,e); }catch(x){} logLine(bl||nm(e.s)+" wins the war and "+plural(e.n,"card")+".");
      } else {
        $("topCard").classList.add("is-win");
        if(me&&!e.war) logLine((G.humans.length>1?nm(e.s):"You")+" win"+(G.humans.length>1?"s":"")+" lap "+Math.min(ui.lap,rc.o.len)+" with "+rankWord(A.info(e.c).r)+" (+"+(e.n-1)+").");
      }
      Sound.sfx(me?"coin":e.war?"slide":"tick");
      ui.order=RC.standings(rc).map(function(r){ return r.s; });
      renderTower({win:e.s});
      if(is3d()){ send3d(e.s,e.war); pipHead("<span>Lap "+Math.min(ui.lap,rc.o.len)+": "+esc(nm(e.s))+"</span><b>+"+(e.n-1)+"</b>",e.war>1); }
      else { trackSync(false); var T1=track(); if(T1) T1.lap(ui.lap,rc.o.len); }
      refreshBoard();
      await sleep(dl(e.war?520:300));
      return;
    }
    /* the CEO's crash rules (CRASH-CONTRACT.md): the 3D view shows the crash and raises the banner when it happens on the track */
    case "crash": { var Rc=G.riders[seatId(e.s)]; logLine("#"+Rc.plate+" "+Rc.name+(e.kind==="out"?" crashes out of the race (lost a "+warWordP(e.depth).toLowerCase()+")":" crashes (lost a double war) and remounts")+".");
      if(!is3d()){ Sound.sfx("cannon"); await banner(e.kind==="out"?"Crash: out of the race":"Crash!","#"+Rc.plate+" "+Rc.name+" · yellow flag",dl(1600),"is-yellow"); } return; }
    case "yellow": { if(!is3d()) logLine("Yellow flag on lap "+e.lap+": no passing in that section."); return; }
    case "dnf": { return; }
    case "holeshot": {
      ui.hs=e.s; chips();
      var hl=null; try{ hl=BR.react(G,e); }catch(x){} logLine(hl||"Holeshot: "+nm(e.s)+"!");
      if(is3d()) return;   /* the banner comes as the leader exits turn 1 on the track */
      Sound.sfx("bell");
      var R=G.riders[seatId(e.s)];
      await banner("Holeshot!","#"+R.plate+" "+R.name+(R.bike?" · "+R.bike:""),dl(1100),"is-calm");
      return;
    }
    case "out": { e.seats.forEach(function(s){ disp.cnt[s]=0; }); logLine(whoList(e.seats)+(e.seats.length>1?" are":" is")+" out of cards."); if(e.seats.length===1) say(e); renderTower(null); if(!is3d()) trackSync(false); return; }
    case "lead": { say(e); return; }
    case "next": {
      /* real time: the lap's result rides out to the line before the next lap's cards turn */
      if(is3d()) await V3.lapDone(e.b-1); else await lapWait2d();
      if(my!==gen||!ui.rc) return;
      ui.lap=e.b; ui.lapT0=Date.now(); chips();
      if(is3d()) pipHead("<span>Lap "+Math.min(e.b,rc.o.len)+" · "+(RC.need(rc).length?(G.humans.length>1?"flip":"your flip"):"cards")+"</span><b>"+(onTV()?"OK: bigger":"Tap: bigger")+"</b>");
      /* the white flag: the last lap (the CEO v2: "Lap 7 of 30", the white flag on the last lap, the checkered flag at the end) */
      if(e.b===rc.o.len&&rc.o.len>1){ if(is3d()) V3.setFlag("white"); var T3=track(); if(T3) T3.setFlag("white"); Sound.sfx("bell"); logLine("White flag: last lap!"); await banner("White flag","Last lap · "+e.b+" of "+rc.o.len,dl(1300),"is-calm is-white",false,true); }
      return;
    }
    case "flag": {
      if(is3d()){ V3.setFlag("checkered"); await V3.lapDone(e.b); } else await lapWait2d();
      if(my!==gen) return;
      ui.lap=Math.min(e.b,rc.o.len); chips();
      var T4=track(); if(T4){ T4.lap(e.b,rc.o.len); T4.setFlag("checkered"); }
      var w=e.order[0], hw=isHumanId(seatId(w));
      ui.order=e.order.slice(); renderTower({win:w});
      Sound.sfx(hw?"win":"conquer");
      $("midBig").textContent="Flag"; $("midSmall").textContent="";
      await banner("Checkered flag",nm(w)+" wins"+(e.why==="all"?": every card":e.why==="deadlock"?"":""),dl(1500),"is-flag",true);
      return;
    }
    case "raceDone": { ui.lastDone=e; var rl=null; try{ rl=BR.react(G,e); }catch(x){} logLine(rl?rl+" ("+e.label+")":nm0(e.order[0])+" wins "+e.label+"."); return; }
    case "roundDone": { ui.pendRound=e; return; }
    case "seasonOver": { ui.pendSeason=e; return; }
  }
}
function nm0(id){ return G.riders[id]?G.riders[id].name:""; }
function bestOf(cards){
  var rc=ui.rc, best=-1, out=[];
  cards.forEach(function(x){ var v=RC.val(rc,x.c); if(v>best){ best=v; out=[x.s]; } else if(v===best) out.push(x.s); });
  return out;
}
function colOf(cols,s){ for(var i=0;i<cols.length;i++) if(+cols[i].getAttribute("data-s")===s) return cols[i]; return null; }
/* the war on the table: one column per fighter (the people first, up to 4; "+n more" beyond), the tied card, then 3 down + the 4th */
function drawWar(seats,tb,fresh){
  $("youSlot").hidden=true; $("topSlot").hidden=true; $("midNote").hidden=true;
  var hs=seats.filter(function(s){ return isHumanId(seatId(s)); }), rest=seats.filter(function(s){ return hs.indexOf(s)<0; });
  var big=$("table").classList.contains("is-big"), vis=hs.concat(rest).slice(0,is3d()&&!big?(onTV()?4:3):(onTV()?5:4)), more=seats.length-vis.length;
  var row=$("warRow"), rem=remPx(), W=GEO?GEO.W:300, H=GEO?GEO.H-GEO.laneH:160;
  var colW=(W-rem)/(vis.length+(more?0.7:0))-rem*.5, cw=Math.round(Math.max(onTV()?2.4*rem:30,Math.min(colW*.62,(H-rem*3.3)/1.55,GEO?GEO.cw:70)));
  row.style.setProperty("--cw",cw+"px");
  row.innerHTML=vis.map(function(s){ var c=ui.lastCards[s]; return '<div class="mx-fight" data-s="'+s+'"><span class="mx-fight__who">'+whoHTML(s)+'</span><div class="mx-fight__pile"><div class="mx-card is-up is-top">'+A.cardInner(c)+'</div></div><span class="mx-fight__tie">tied with '+(c!=null?'<span class="mx-tw__c'+(A.chipRed(c)?" is-red":"")+'">'+A.chip(c)+"</span>":"")+"</span></div>"; }).join("")+
    (more?'<span class="mx-fight__more">+'+more+" more</span>":"");
  if(tb&&!fresh){ /* a reload in a war: show the face-down cards already laid */
    row.querySelectorAll(".mx-fight").forEach(function(col){ var s=+col.getAttribute("data-s"), n=tb.filter(function(t){ return t.s===s&&!t.up; }).length; for(var d=0;d<Math.min(3,n);d++) addBack(col,d); });
  }
}
function addBack(col,d){
  var pile=col.querySelector(".mx-fight__pile"), top=pile.querySelector(".is-top"), b=document.createElement("div");
  b.className="mx-card"; b.innerHTML=A.cardInner(null);
  var cw=parseFloat(getComputedStyle(pile).width)||40;
  b.style.transform="translate("+Math.round(-cw*.16*(3-d))+"px,"+Math.round(cw*.03*(3-d))+"px) rotate("+(d%2?3:-3)+"deg)";
  pile.insertBefore(b,top);
  if(!reduced()&&b.animate) try{ b.animate([{opacity:0,transform:"translate(0,-40%) rotate(0deg)"},{opacity:1,transform:b.style.transform}],{duration:sp(220),easing:"ease-out"}); }catch(e){}
}
function flipTop(col,c,ms){ var top=col.querySelector(".mx-fight__pile .is-top"); if(!top) return Promise.resolve(); return flipCard(top,c,ms,true); }
function flash(){ var f=$("flash"); if(reduced()||!f.animate) return; try{ f.animate([{opacity:0},{opacity:1,offset:.25},{opacity:0}],{duration:sp(700),easing:"ease-out"}); }catch(e){} }
var bannerQ=Promise.resolve();
function banner(t,s,ms,cls,flagIcon,white){ var p=bannerQ.then(function(){ return showBanner(t,s,ms,cls,flagIcon,white); }); bannerQ=p.then(null,function(){}); return p; }
function showBanner(t,s,ms,cls,flagIcon,white){
  var b=$("banner");
  $("bannerT").innerHTML=(flagIcon?A.flag()+"<br>":white?A.wflag()+"<br>":"")+esc(t); $("bannerS").textContent=s||"";
  b.className="mx-banner is-on"+(cls?" "+cls:"");
  var p=Promise.resolve();
  if(!reduced()&&b.animate){ try{ p=b.animate([{opacity:0,transform:"translate(-50%,-50%) scale(.85)"},{opacity:1,transform:"translate(-50%,-50%) scale(1)"}],{duration:sp(220),easing:"cubic-bezier(.2,.8,.3,1.2)"}).finished.then(function(){},function(){}); }catch(e){} }
  return p.then(function(){ return sleep(ms); }).then(function(){ b.className="mx-banner"; });
}

/* ================= after a race: results with who advances and the points; after a round: the podium; the season's champion ================= */
function afterBatch(){
  var e=ui.lastDone; if(!e) return;
  ui.lastDone=null; save();
  openResults(e,false);
}
function simNow(){
  if(!G||G.over||busy) return;
  var wasLive=!!G.race, ev=S.simRace(G);
  try{ BR.observe(G,ev); }catch(x){}
  var done=null; ev.forEach(function(e){ if(e.e==="raceDone") done=e; if(e.e==="roundDone") ui.pendRound=e; if(e.e==="seasonOver") ui.pendSeason=e; });
  save();
  if(ui.view==="race"&&ui.rc){ ui.rc=null; }
  if(done) openResults(done,true);
  if(!wasLive&&ui.view==="season") renderSeason();
}
/* the finals of the round this race belonged to (1976 Anaheim ran heats and a Main in a season of three motos) */
function roundFinals(e){ try{ return S.calFormat(G,G.cal[e.ri]).finals.kind; }catch(x){ return G.formats[G.fmt].finals.kind; } }
function resultTags(e,id,p){
  var t="";
  if(e.toMain&&e.toMain.indexOf(id)>=0) t='<span class="mx-tag mx-tag--main">'+(e.kind==="lcq"||e.kind==="heat"||e.kind==="semi"||e.kind==="qual"?"to the "+(roundFinals(e)==="moto"?"motos":"Main"):"Main")+"</span>";
  else if(e.toNext&&e.toNext.indexOf(id)>=0) t='<span class="mx-tag mx-tag--next">to the '+esc(nextStageName(e))+"</span>";
  else if(e.out&&e.out.indexOf(id)>=0) t='<span class="mx-tag mx-tag--out">out</span>';
  var pts=racePoints(e,p); if(pts) t+='<span class="mx-tag mx-tag--pts">+'+pts+"</span>";
  return t;
}
function nextStageName(e){
  var res=G.results[G.results.length-1], RG=G.round;
  var F=RG?RG.F:(res?S.calFormat(G,G.cal[res.ri]):G.formats[G.fmt]), qi=-1;
  F.qual.forEach(function(s,i){ if(s.kind===e.kind) qi=i; });
  var nx=F.qual[qi+1]; return nx?nx.label:"next race";
}
function racePoints(e,p){
  if(e.kind!=="main"&&e.kind!=="moto") return 0;
  var c=G.cal[e.ri]; if(!c||!c.title) return 0;
  var F=S.calFormat(G,c); if(F.pointsOn!=="race") return 0;
  return ((F.table||[])[p]||0)*(c.mult||1);
}
function openResults(e,simmed){
  var T=track(); if(T) T.show(false); if(V3) V3.show(false);
  if(boardOpen()) sheetClose($("boardBox"),"go");
  var c=G.cal[e.ri], me=G.humans, order=e.order, rcStats=G.last||{};
  var myP=-1; order.forEach(function(id,i){ if(me.indexOf(id)>=0&&myP<0) myP=i; });
  var head='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">Round '+(e.ri+1)+" · "+esc(c.city||c.venue)+(simmed?" · simmed":"")+'</span>'+
    '<h2 class="bg-sheet__title" id="resTitle">'+esc(e.label)+" results</h2>"+
    '<p class="bg-sheet__sub">'+esc(G.riders[order[0]].name)+" wins"+(myP>=0?(me.length>1?" · "+G.riders[order[myP]].name+" "+ord(myP+1):" · you finished "+ord(myP+1)):"")+"</p></div>";
  var sum='<div class="mx-sum"><span class="mx-chip is-hot">Holeshot: '+esc(e.hs!=null?G.riders[e.hs].name:"none")+'</span><span class="mx-chip">'+plural(rcStats.wars||0,"war")+'</span><span class="mx-chip">'+plural(rcStats.battles||0,"lap")+"</span></div>";
  var list='<ol class="mx-res">'+order.map(function(id,i){ var R=G.riders[id]; return '<li class="'+(me.indexOf(id)>=0?"is-me":"")+'"><span class="mx-res__p">'+(i+1)+"</span>"+plateHTML(R)+'<span class="mx-res__n">'+nameHTML(R)+"</span>"+resultTags(e,id,i)+"</li>"; }).join("")+"</ol>";
  var acts='<div class="mx-sacts" id="resActs"></div>';
  $("resSheet").innerHTML=head+sum+list+acts;
  var box=$("resActs");
  if(ui.pendRound){ box.innerHTML='<button class="bg-btn bg-btn--primary bg-btn--lg" id="resNext" type="button" data-icon="trophy">The podium</button>'; }
  else if(!G.over){
    var nx=S.next(G), final=nx.kind==="main"||nx.kind==="moto";
    if(nx.humanIn||final||cfg.others!=="sim") box.innerHTML='<button class="bg-btn bg-btn--primary bg-btn--lg" id="resNext" type="button">'+esc((nx.humanIn||final?"Next: ":"Watch ")+nx.label)+"</button>"+(!nx.humanIn&&!final?'<button class="bg-btn bg-btn--secondary bg-btn--lg" id="resSim" type="button">Sim '+esc(nx.label)+"</button>":"");
    else box.innerHTML='<button class="bg-btn bg-btn--primary bg-btn--lg" id="resSim" type="button">Sim '+esc(nx.label)+'</button>';
    box.insertAdjacentHTML("beforeend",'<button class="bg-btn bg-btn--ghost bg-btn--lg" id="resSeason" type="button">Season</button>');
  }
  var B=BG(); if(B&&B.icon) box.querySelectorAll("[data-icon]").forEach(function(el){ el.insertAdjacentHTML("afterbegin",B.icon(el.getAttribute("data-icon"))); });
  sheetOpen($("resBox"),{focus:"#resNext, #resSim",onClose:function(reason){ if(reason!=="go"){ ui.rc=null;
    /* closed with Back (or the scrim) after the round's last race: the podium still comes (the CEO's podium after every Main / overall) */
    if(ui.pendRound&&!setupShown()){ setView("season"); setTimeout(function(){ if(ui.pendRound&&!setupShown()&&!sheetUp()) openPodium(); },60); return; }
    ui.pendRound=null; if(!setupShown()){ setView("season"); drive(); } } }});
  if(simmed&&!reduced()) $("resSheet").querySelectorAll(".mx-res li").forEach(function(li,i){ if(i<14&&li.animate) try{ li.animate([{opacity:0,transform:"translateX(1.5rem)"},{opacity:1,transform:"none"}],{duration:sp(260),delay:dl(i*55),easing:"ease-out",fill:"backwards"}); }catch(x){} });
  function go(fn){ return function(){ sheetClose($("resBox"),"go"); fn(); }; }
  var n1=$("resNext"), s1=$("resSim"), se=$("resSeason");
  if(n1) n1.addEventListener("click",go(function(){ if(ui.pendRound) openPodium(); else enterRace(); }));
  if(s1) s1.addEventListener("click",go(function(){ ui.rc=null; simNow(); }));
  if(se) se.addEventListener("click",go(function(){ ui.rc=null; setView("season"); drive(); }));
}
function bikeBox(R){ var c=A.mk(R.bike); return '<span class="mx-pod__bike">'+A.bike(c[0],c[0]==="#f2f4f8"?"#183a8c":"#f2f2f6")+"</span>"; }
function podiumHTML(ids,sub){
  var order=[1,0,2];
  return order.map(function(k){ var id=ids[k]; if(!id) return '<div class="mx-pod__c"></div>'; var R=G.riders[id];
    return '<div class="mx-pod__c'+(R.kind==="human"?" is-me":"")+'" data-p="'+(k+1)+'" style="'+A.mkStyle(R.bike)+'">'+bikeBox(R)+plateHTML(R)+'<span class="mx-pod__nm">'+esc(R.name)+'</span><span class="mx-pod__x">'+esc(sub(id,k))+'</span><span class="mx-pod__step">'+(k+1)+"</span></div>"; }).join("");
}
function openPodium(){
  var e=ui.pendRound; ui.pendRound=null;
  var res=G.results[G.results.length-1]; if(!res){ setView("season"); return; }
  var c=G.cal[res.ri], L=S.standings(G), me=G.humans, top=L.length?L[0].pts:0;
  var mine=me.map(function(h){ var p=res.cls.indexOf(h); return p>=0?(me.length>1?G.riders[h].name+" ":"you finished ")+ord(p+1)+(res.pts[h]?", +"+plural(res.pts[h],"point"):""):null; }).filter(Boolean);
  $("podSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">Round '+(res.ri+1)+" of "+G.cal.length+" · "+esc(c.venue||c.city)+'</span><h2 class="bg-sheet__title" id="podTitle">'+esc((c.city||c.venue)+" podium")+"</h2></div>"+
    '<div class="mx-pod">'+podiumHTML(res.cls,function(id){ return res.pts[id]?"+"+res.pts[id]+" pts":(c.title?"":"exhibition"); })+"</div>"+
    (mine.length?'<p class="mx-line"><b>'+(me.length>1?"Your riders":"Your night")+":</b> "+esc(mine.join(" · "))+"</p>":"")+
    '<ol class="mx-tops">'+L.slice(0,5).map(function(r){ var R=G.riders[r.id]; return '<li class="'+(me.indexOf(r.id)>=0?"is-me":"")+'"><span class="mx-st__p">'+r.place+"</span>"+plateHTML(R)+'<span class="mx-st__n">'+esc(R.name)+'</span><span class="mx-st__v">'+r.pts+'</span><span class="mx-st__g">'+(r.place>1?"-"+(top-r.pts):"")+"</span></li>"; }).join("")+"</ol>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="podGo" type="button">'+(G.over?"The champion":"Season standings")+"</button></div>";
  if(!reduced()) Sound.sfx("win");
  sheetOpen($("podBox"),{focus:"#podGo",onClose:function(reason){ if(reason!=="go"){ setView("season"); if(G.over) finishSeason(); else drive(); } }});
  $("podGo").addEventListener("click",function(){ sheetClose($("podBox"),"go"); setView("season"); if(G.over) finishSeason(); else drive(); });
}
function finishSeason(){
  if(ui.finished===gen){ openWin(); return; }
  ui.finished=gen; ui.pendSeason=null;
  try{ BR.learn(G); }catch(e){}
  Saves.del(GAME,"auto");
  renderSeason();
  openWin();
}
function openWin(){
  var B=BG(); if(!B||!B.win||!G||!G.over||!luxe()) return;
  if(ui.finished!==gen){ finishSeason(); return; }
  ui.winShown=gen; ui.result=false;
  var L=S.standings(G), ch=L[0], R=G.riders[ch.id], me=G.humans, single=me.length===1, T=teamTable();
  $("winEyebrow").textContent=G.year+" "+LONG[G.series]+" · "+G.cls;
  $("winTitle").textContent=me.indexOf(ch.id)>=0?"Champion!":G.year+" champion";
  var mine=me.map(function(h){ var r=L.filter(function(x){ return x.id===h; })[0]; return r?(me.length>1?r.name+" ":"You: ")+ord(r.place)+", "+plural(r.pts,"point"):""; }).filter(Boolean);
  $("winSub").textContent=R.name+" (#"+R.plate+(R.bike?", "+R.bike:"")+") wins the title with "+plural(ch.pts,"point")+" and "+plural(ch.wins,"win")+"."+(mine.length?" "+mine.join(" · ")+".":"")+(T.length?" Team title (ours): "+T[0].make+".":"");
  $("winPod").innerHTML=podiumHTML(L.slice(0,3).map(function(r){ return r.id; }),function(id){ var r=L.filter(function(x){ return x.id===id; })[0]; return plural(r.pts,"pt"); });
  $("winList").innerHTML=L.map(function(r){ var Rr=G.riders[r.id]; return '<li class="'+(me.indexOf(r.id)>=0?"is-me":"")+'"><span class="mx-res__p">'+r.place+"</span>"+plateHTML(Rr)+'<span class="mx-res__n">'+nameHTML(Rr)+'</span><span class="mx-res__x">'+r.pts+"</span></li>"; }).join("");
  var my=me.length?L.filter(function(x){ return x.id===me[0]; })[0]:null, st=my?G.st[my.id]||{}:{};
  $("winStats").innerHTML='<li class="bg-stat"><b>'+G.cal.length+'</b><span>rounds</span></li>'+(my?'<li class="bg-stat"><b>'+ord(my.place)+'</b><span>'+(single?"your place":esc(my.name))+'</span></li><li class="bg-stat"><b>'+(my.wins||0)+'</b><span>wins</span></li><li class="bg-stat"><b>'+(st.hsAll||0)+"</b><span>holeshots</span></li>":
    '<li class="bg-stat"><b>'+ch.wins+'</b><span>champion\'s wins</span></li>');
  closeSheets();
  B.win.open($("winBox"),{focus:"#winAgain"});
  if(B.celebrate) B.celebrate();
  Sound.sfx("win");
  barTitle();
}
function closeWin(){ var B=BG(); if(B&&B.win&&B.win.isOpen()) B.win.close($("winBox")); }
$("winAgain").addEventListener("click",function(){ closeWin(); ui.newOk=true; $("startBtn").click(); });
$("winMenu").addEventListener("click",function(){ closeWin(); $("menuBtn").click(); });
document.addEventListener("keydown",function(e){
  var B=BG(); if(!B||!B.win||!B.win.isOpen()) return;
  if(e.key==="Escape"||e.key==="GoBack"||e.key==="BrowserBack"||e.keyCode===27||e.keyCode===4){ e.preventDefault(); closeWin(); }
});

/* ================= v2: the battle board (the CEO: "show everybody's place and what cards were dealt that round") ================= */
function boardOpen(){ var B=BG(), el=$("boardBox"); return el.classList.contains("show")||!!(B&&B.sheet&&B.sheet.isOpen&&B.sheet.isOpen(el)); }
function refreshBoard(){ if(boardOpen()) renderBoard(true); }
function cardChip(c){ return c==null?"":'<span class="mx-tw__c'+(A.chipRed(c)?" is-red":"")+'">'+A.chip(c)+"</span>"; }
function warWordP(n){ return n===2?"Double war":n===3?"Triple war":"War x"+n; }
function lapLine(L){
  var rc=ui.rc; if(!L) return "";
  var head="Lap "+L.b+(rc?" of "+rc.o.len:"")+" · ";
  if(L.win<0) return head+(L.aside?"dead heat: "+plural(L.aside,"card")+" set aside":"no winner");
  var R=G.riders[seatId(L.win)]; if(!R) return head;
  return head+(L.war?(L.war>1?warWordP(L.war)+": ":"War: "):"")+"#"+R.plate+" "+R.name+" wins with "+(typeof L.c==="number"?A.short(L.c):typeof L.wc==="number"?A.short(L.wc):"the top card")+" (+"+Math.max(0,(L.n|0)-1)+")";
}
function renderBoard(keep){
  var rc=ui.rc, box=$("boardSheet"); if(!rc||!G) return;
  var lap=rc.lastLap||null, order=ui.order.length?ui.order:RC.standings(rc).map(function(r){ return r.s; });
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; }), pre=ui.lapPre||null, c=G.cal[Math.min(G.ri,G.cal.length-1)];
  var rows=order.map(function(s,i){
    var R=G.riders[seatId(s)], p=rc.r[s], card=lap&&lap.c?lap.c[s]:null, war=lap&&lap.w?lap.w[s]:null, d=pre&&!p.out?counts[s]-pre[s]:null;
    var warH=war?war.map(function(w){ return '<span class="mx-bd__war">'+(w[0]?w[0]+" down ":"")+(w[1]!=null?cardChip(w[1]):"")+"</span>"; }).join(""):"";
    var win=lap&&lap.win===s;
    return '<li class="'+(R.kind==="human"?"is-me ":"")+(win?"is-win ":"")+(p.out?"is-out":"")+'"><span class="mx-bd__p">'+(i+1)+"</span>"+plateHTML(R)+'<span class="mx-bd__n">'+esc(R.name)+'</span><span class="mx-mk mx-bd__mk" style="'+A.mkStyle(R.bike)+'">'+esc(R.bike||"")+"</span>"+
      '<span class="mx-bd__c">'+(card!=null?cardChip(card):p.out?'<span class="mx-bd__x">out</span>':"")+warH+'</span><span class="mx-bd__k">'+(p.out?"0":counts[s])+'</span><span class="mx-bd__d'+(d>0?" is-up":d<0?" is-dn":"")+'">'+(d==null||d===0?"":(d>0?"+":"")+d)+"</span></li>";
  }).join("");
  var laps=(rc.laps||[]).slice(-8).reverse().map(function(L){ return "<li>"+esc(lapLine(L))+"</li>"; }).join("")||"<li>The first lap is still to come.</li>";
  var eye=(c.city||c.venue)+" · "+ui.label+" · "+(rc.phase==="gate"?"on the gate":"lap "+Math.min(lap?lap.b:0,rc.o.len)+" of "+rc.o.len), sub=lap?lapLine(lap):"The gate hasn't dropped yet: the cards turn on lap 1.";
  /* a refresh while it is open changes the contents only: the button (and the remote's ring on it) stays */
  var list=box.querySelector(".mx-bd");
  if(!keep||!list){
    box.innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow" id="boardEye"></span>'+
      '<h2 class="bg-sheet__title" id="boardTitle">Battle board</h2><p class="bg-sheet__sub" id="boardSub"></p></div>'+
      '<div class="mx-bdw"><div class="mx-bdw__main"><p class="mx-bd__h">Place · rider · the card turned this lap (and the war cards) · cards held · won or lost this lap</p>'+
      '<ol class="mx-bd"></ol></div><div class="mx-bdw__log"><h3 class="bg-eyebrow mx-bd__lh">Lap log</h3><ol class="mx-lapl"></ol></div></div>'+
      '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="boardClose" type="button">Back to the race</button></div>';
    $("boardClose").addEventListener("click",function(){ sheetClose($("boardBox"),"go"); });
    list=box.querySelector(".mx-bd");
  }
  var st=list.scrollTop;
  $("boardEye").textContent=eye; $("boardSub").textContent=sub;
  list.innerHTML=rows; list.style.setProperty("--bd-rows",String(Math.max(1,Math.ceil(order.length/2)))); list.scrollTop=st;
  box.querySelector(".mx-lapl").innerHTML=laps;
}
/* the board covers the track (a sheet on the phone, big on TV): the track rests while it is open and rides on when it closes */
$("boardBtn").addEventListener("click",function(){ if(!G||!ui.rc) return; renderBoard(false); sheetOpen($("boardBox"),{focus:"#boardClose",onClose:function(){ $("boardBox").classList.remove("show"); setTimeout(function(){ trackShow(); if(onTV()&&!sheetUp()) focusTV($("boardBtn")); },60); }}); trackShow(); });

/* ================= v2: the heat line-up before the gate (the CEO ~18:25: "at the start of the heat races, there has to be an equal amount
   of teams"): tonight's heats, balanced by team, each with its riders and its team counts; outdoors the gate of the first moto ================= */
function lineupDue(){ if(!G||G.over||G.race) return false; var RG=G.round; if(RG&&(RG.cur>0||RG.races.some(function(r){ return r.res; }))) return false; return ui.lineSeen!==gen+"|"+G.ri; }
function openLineup(go,label){
  if(!G.round){ S.startRound(G); save(); }
  ui.lineSeen=gen+"|"+G.ri;
  var RG=G.round, c=G.cal[G.ri], F=RG.F, heats=RG.races.filter(function(r){ return r.st===0&&r.ent; }), cols=[];
  if(heats.length){ var sp=RD.teamSplit(RG,0); heats.forEach(function(r,i){ cols.push({label:r.label,ids:r.ent,teams:(sp[i]||{}).teams||{},rule:RG.st[0].toMain?"top "+RG.st[0].toMain+" to the "+(F.finals.kind==="moto"?"motos":F.finals.label):RG.st[0].toNext&&RG.st[0].toNext!=="rest"?"top "+RG.st[0].toNext+" move on":""}); }); }
  else { var t={}; (RG.fin||[]).forEach(function(id){ var m=G.riders[id].bike||"Privateer"; t[m]=(t[m]||0)+1; }); cols.push({label:(RG.races[0]||{}).label||"The gate",ids:RG.fin||[],teams:t,rule:F.finals.kind==="moto"?"the motos, the overall by points":""}); }
  var me=G.humans;
  var html=cols.map(function(col){
    var tm=Object.keys(col.teams).sort(function(a,b){ return col.teams[b]-col.teams[a]||(a<b?-1:1); });
    return '<section class="mx-lu__col"><h3 class="mx-lu__h">'+esc(col.label)+' <span>'+plural(col.ids.length,"rider")+(col.rule?" · "+esc(col.rule):"")+"</span></h3>"+
      '<p class="mx-lu__tm">'+tm.map(function(m){ return '<span class="mx-mk" style="'+A.mkStyle(m)+'">'+esc(m)+" "+col.teams[m]+"</span>"; }).join("")+"</p>"+
      '<ol class="mx-lu__l'+(col.ids.length>20?" is-wide":"")+'" style="--lu-rows:'+Math.ceil(col.ids.length/2)+'">'+col.ids.map(function(id,k){ var R=G.riders[id]; return '<li class="'+(me.indexOf(id)>=0?"is-me":"")+'"><span class="mx-lu__g">'+(k+1)+"</span>"+plateHTML(R)+'<span class="mx-lu__n">'+nameHTML(R)+'</span><span class="mx-mk mx-lu__mk" style="'+A.mkStyle(R.bike)+'">'+esc(R.bike||"")+"</span></li>"; }).join("")+"</ol></section>";
  }).join("");
  var mine=me.map(function(h){ var col=cols.filter(function(x){ return x.ids.indexOf(h)>=0; })[0]; return col?(me.length>1?G.riders[h].name+": ":"You ride ")+col.label:null; }).filter(Boolean);
  $("lineSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">Round '+(G.ri+1)+" of "+G.cal.length+" · "+esc(c.city||c.venue)+'</span>'+
    '<h2 class="bg-sheet__title" id="lineTitle">'+(heats.length>1?"Tonight's heats":heats.length?"Tonight's "+esc(heats[0].label):"The gate")+"</h2>"+
    '<p class="bg-sheet__sub">'+(heats.length>1?"Balanced by team: every team's riders are split as evenly as they can be over the heats, and the top seeds alternate between them as in qualifying.":"Every rider on the gate, in gate-pick order.")+(mine.length?" <b>"+esc(mine.join(" · "))+".</b>":"")+"</p></div>"+
    '<div class="mx-lu'+(cols.length>1?" is-multi":"")+'" style="--lu-cols:'+cols.length+'">'+html+"</div>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="lineGo" type="button" data-icon="play">'+esc(label)+'</button><button class="bg-btn bg-btn--ghost bg-btn--lg" id="lineSeason" type="button">Season</button></div>';
  var B=BG(); if(B&&B.icon) $("lineSheet").querySelectorAll("[data-icon]").forEach(function(el){ el.insertAdjacentHTML("afterbegin",B.icon(el.getAttribute("data-icon"))); });
  sheetOpen($("lineBox"),{focus:"#lineGo",onClose:function(reason){ if(reason!=="go"){ renderSeason(); setTimeout(function(){ if(onTV()&&!sheetUp()) focusTV($("goBtn")); },60); } }});
  $("lineGo").addEventListener("click",function(){ sheetClose($("lineBox"),"go"); go(); });
  $("lineSeason").addEventListener("click",function(){ sheetClose($("lineBox")); renderSeason(); });
}

/* ================= sheets ================= */
function sheetOpen(el,o){ var B=BG(); el.classList.add("show"); if(luxe()&&!B.sheet.isOpen(el)) B.sheet.open(el,o); else if(!luxe()){ var f=el.querySelector((o&&o.focus)||"button"); if(f) try{ f.focus(); }catch(e){} } }
function sheetClose(el,reason){ var B=BG(); el.classList.remove("show"); if(B&&B.sheet&&B.sheet.isOpen(el)) B.sheet.close(el,reason); }
function closeSheets(){ ["resBox","podBox","fullBox","newBox","boardBox","lineBox","skipBox"].forEach(function(id){ var el=$(id); if(el.classList.contains("show")||(BG()&&BG().sheet&&BG().sheet.isOpen(el))) sheetClose(el,"go"); }); }
function hintSync(){
  var B=BG();
  if(luxe()) ["resBox","podBox","fullBox","newBox","boardBox","lineBox","skipBox"].forEach(function(id){ var el=$(id); if(el&&el.classList.contains("show")&&!B.sheet.isOpen(el)) el.classList.remove("show"); });
  /* a sheet closed by Back on the TV (the podium, All riders): the ring goes back to the main action, never left on the page body */
  if(!onTV()) return;
  var tries=0;
  (function again(){
    if(tries++>6) return;
    setTimeout(function(){
      if(!G||setupShown()) return;
      if(sheetUp()||busy) return again();   /* a sheet still closing, or the next one opening: look again */
      var a=document.activeElement, shut=a&&a.closest&&a.closest("#resBox,#podBox,#fullBox,#newBox,#winBox,#boardBox,#lineBox");
      var fine=a&&a!==document.body&&a.isConnected&&!a.hidden&&!shut&&a.getClientRects().length&&(!a.checkVisibility||a.checkVisibility({visibilityProperty:true}));
      if(!fine) focusTV(mainControl());
    },tries===1?260:180);
  })();
}
document.addEventListener("bgui:sheet",hintSync); document.addEventListener("bgui:win",function(e){ if(e.detail&&!e.detail.open) hintSync(); });

/* ================= keys, the remote's Back ================= */
function backStep(){
  if(is3d()&&$("table").classList.contains("is-big")&&!setupShown()){ pipBig(false); focusTV($("table")); return "cards"; }
  if(!setupShown()&&G){ $("menuBtn").click(); return "menu"; }
  if(G&&$("resumeBtn").style.display!=="none"&&!ui.cont){ $("resumeBtn").click(); return "resume"; }
  return false;
}
document.addEventListener("visibilitychange",function(){ if(!document.hidden&&G&&!busy) drive(); });
var rsz=0;
window.addEventListener("resize",function(){ clearTimeout(rsz); rsz=setTimeout(function(){ if(!G||setupShown()) return; if(ui.view==="race"&&ui.rc){ layoutArena(); if(!busy) renderRace(); else trackSync(ui.rc.phase==="gate"); } else if(ui.view==="season") renderSeason(); },140); });

document.addEventListener("DOMContentLoaded",function(){
  register();
  mountNames(); drawRiders();
  var B=BG();
  if(B&&B.stage) B.stage(GAME,{frames:"#arena"}); else Skins.apply(GAME);
  if(B&&B.back) B.back.on(backStep);
  else window.__tvBack=function(){
    if(window.Sound&&Sound.panelOpen&&Sound.panelOpen()){ Sound.closePanel(); return "panel"; }
    var r=backStep(); if(r) return r;
    location.href=$("homeBtn").getAttribute("href"); return "hub";
  };
  if(!B||!B.effects) return;
  document.documentElement.classList.add("mx-luxe");
  if(B.icon) document.querySelectorAll("[data-icon]").forEach(function(el){ if(!el.querySelector("svg")) el.insertAdjacentHTML("afterbegin",B.icon(el.getAttribute("data-icon"))); });
  var hub=hubHref(); ["homeBtn","backHub","winHome"].forEach(function(id){ var a=$(id); if(a) a.setAttribute("href",hub); });
  saveBar.refresh(); deviceCopy(); drawSetup();
  if(ui.cont&&!G) focusTV($("resumeBtn"));
  document.addEventListener("bgui:tv",function(){ deviceCopy(); syncStart(); if(G&&!setupShown()&&!busy) setView(ui.view); });
});

readRiders();
(function(){ var st=null; try{ st=Saves.get?Saves.get(GAME,"settings"):null; }catch(e){} if(st&&st.data) try{ applySettings(st.data); }catch(e){} })();
Sound.mountButton(); Sound.music(GAME);
deviceCopy(); drawSetup(); saveBar.refresh(); showSetup(true); contOffer();
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(function(){}); }
window.__mxwar={get G(){ return G; },toSeason:function(){ ui.rc=null; setView("season"); drive(); },cfg:cfg,ui:ui,drive:drive,act:act,simNow:simNow,enterRace:enterRace,startSeason:startSeason,loadSeason:loadSeason,
  state:function(){ return {busy:busy,gen:gen,view:ui.view,intent:intent,phase:ui.rc?ui.rc.phase:null,battle:ui.rc?ui.rc.battle:null,over:G?G.over:null,finished:ui.finished,winShown:ui.winShown,use3d:is3d()}; },
  get v3(){ return V3; },pipBig:pipBig};
})();
