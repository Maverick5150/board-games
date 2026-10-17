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
   - MOTOCROSS WAR 3D (the CEO 2026-10-16 20:06, 2026-10-17 05:15 and 07:40): the race is shown by race3d.js (our own WebGL renderer, the track of
     the round from data/trk-<season>.js) filling the arena; the 2D track (track.js) is only the fallback (no WebGL, ?gl=0, context lost, a device
     too slow). The 3D view has the 2D track's own API, so the riding clock (T.ready / untilLine: a lap's cards turn as the leader starts it),
     the standings (T.update + T.lap), the crashes and the yellow flag (T.crash + T.setYellow) and a race picked up again (T.setLaps) work the same;
     what the person watches is the race and the timing overlay (hud.js: a small tower, EVERY rider on a button / the Menu key / after each
     lap); the cards run behind it ("Cards" brings the corner window back). A lap takes the round's real lap time (S.lapOf / S.firstLapOf). */
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
var G=null, gen=0, timer=null, busy=false, intent=0, skipQ=false;   /* skipQ: "Skip to the finish" confirmed while a battle plays (never lost) */
var ui={view:"season",rc:null,finished:-1,winShown:-1,result:false,rulesOpen:false,cont:false,order:[],lap:0,lastCards:{},bikes:{},sayN:0,
  pendRound:null,pendSeason:null,lastDone:null,showAll:false,shown:false,sheetGo:null,log:[],flipBusy:false,newOk:false};
var disp=null;   // the counts on show while a battle plays (they follow the cards, not the engine)
var LONG={sx:"AMA Supercross",mx:"AMA Pro Motocross",smx:"SuperMotocross Playoffs"};
var SHORTS={sx:"Supercross",mx:"Motocross",smx:"SMX Playoffs"};
var LEN_NAME={real:"Real length",half:"Half length"};

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
var loading={}, trkLoading={};
/* the season's real track layouts (data/trk-<id>.js, packed by BG_audit/sprint/mxbuild/layouts-pack.js) load with it; offline or missing, the
   built-in tracks stand in */
function tracksIn(id){ var T=window.MXWarTracks; return !T||!T.files||!T.files[id]||!!(T.loaded&&T.loaded[id]); }
function loadTracks(id){
  if(tracksIn(id)) return Promise.resolve();
  if(trkLoading[id]) return trkLoading[id];
  return (trkLoading[id]=new Promise(function(res){
    var s=document.createElement("script"); s.src="data/trk-"+id+".js"; s.async=true;
    s.onload=function(){ res(); }; s.onerror=function(){ delete trkLoading[id]; s.remove(); res(); };
    document.head.appendChild(s);
  }));
}
function loadSeason(id){
  if(DATA[id]&&tracksIn(id)) return Promise.resolve(DATA[id]);
  if(loading[id]) return loading[id];
  if(DATA[id]) return (loading[id]=loadTracks(id).then(function(){ delete loading[id]; return DATA[id]; }));
  loadTracks(id);
  loading[id]=new Promise(function(res,rej){
    var s=document.createElement("script"); s.src="data/"+id+".js"; s.async=true;
    s.onload=function(){ if(DATA[id]) loadTracks(id).then(function(){ res(DATA[id]); }); else { delete loading[id]; rej(new Error("no data")); } };
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
  loadSeason(si.id).then(function(){ if(cfg.sid===si.id){ refreshBikeSelects(); drawRiders(); drawLength(); } },function(){});
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
  cfg.length=RD.MODE_OF[cfg.length]||"real";
  keepFocus(box,"data-l",function(){
    box.innerHTML=segHTML([["real","Real length"],["half","Half length"]],cfg.length,"data-l");
    box.querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.length=b.dataset.l; drawSetup(); }); });
  });
  var si=seasonInfo(cfg.sid), E=estimate(si);
  if(!E){ $("lengthDesc").textContent="Every race runs in real time: a lap takes as long as a real lap."; return; }
  if(E.real) $("lengthDesc").innerHTML="<b>Real time:</b> every race takes its real lap time ("+esc(E.range)+" in "+esc(String(si.year))+"). "+
    (cfg.length==="half"?"<b>Half length:</b> half of each race's real laps, still at real lap speed. ":"<b>Real length:</b> every round races the laps its real races ran. ")+
    esc("Researched for "+E.withT+" of "+E.n+" rounds"+(E.withT<E.n?" (the rest: the "+si.year+" rules)":"")+".")+(E.first&&E.races.length?" <b>"+esc((E.first.city||E.first.venue)+": "+E.races.join(" · "))+".</b>":"")+" Every lap is one battle of War; the most cards at the flag wins.<br>"+
    "<b>Time:</b> a round about "+E.all+" min if you watch every race"+(E.mine<E.all-2?" (about "+E.mine+" min when you sim the races you're not in)":"")+"; the "+si.rounds+"-round "+si.year+" season about "+E.season+", over several sittings: it saves after every race.";
  else $("lengthDesc").innerHTML="<b>Real time:</b> a lap takes as long as a real "+(E.mx?"outdoor":"stadium")+" lap, about "+E.lapW+" ("+E.range+" by track). "+
    (cfg.length==="half"?"<b>Half length:</b> half the race time, still at real lap speed. ":"<b>Real length:</b> the "+esc(String(si.year))+" format. ")+
    "<b>"+E.races.map(esc).join(" · ")+".</b> Every lap is one battle of War; the most cards at the flag wins.<br>"+
    "<b>Time:</b> a round about "+E.all+" min if you watch every race"+(E.mine<E.all-2?" (about "+E.mine+" min when you sim the races you're not in)":"")+"; the "+si.rounds+"-round "+si.year+" season about "+E.season+", over several sittings: it saves after every race.";
}
/* mxlaps (the CEO, 2026-10-16 ~21:10, "Fix it", with a search answer: "An average lap takes roughly 1 to 2 minutes in an outdoor motocross
   race and about 50 seconds to 1 minute in a stadium Supercross race"; at 20:06: "riders are moving so fucking fast"): a lap on the track
   takes the round's REAL lap time (round.js lapTime: Supercross 53-59 s by venue, outdoor 1:45-2:15 by track; season.js lapOf), whatever
   the Game speed (which now paces only the cards, banners and results). A lap's cards turn as the leader starts it, the field rides the
   result round the lap, the passes spread over it (track.js). Reduced motion (no riding): the same real lap on a plain clock. The races
   have their real length (round.js REAL: "Real length", or "Half length"); to save time a race you are not in can be simmed, and any race
   skipped to the finish (with a confirm). */
var RACE_EXTRA_S=75;   /* a race's line-up, gate, banners and results sheet: about a minute and a quarter */
function lapSec(){ if(G){ try{ return S.lapOf(G); }catch(e){} } return 55; }
function lapMs(){ return lapSec()*1000; }
/* mxtimewire: the race's real first lap (ms; 0 = none researched) and a lap time in words (a stadium lap "54.8 s", an outdoor "2:26.5") */
function firstMs(){ if(G){ try{ var f=S.firstLapOf(G); return f>0?Math.round(f*1000):0; }catch(e){} } return 0; }
function lapWords(sec){ sec=+sec||0; if(sec<60) return (Math.round(sec*10)/10).toFixed(1)+" s"; var m=Math.floor(sec/60), r=Math.round((sec-m*60)*10)/10; if(r>=60){ m++; r=0; } return m+":"+(r<10?"0":"")+r.toFixed(1); }
function raceTime(t){ return String(t||"").replace(/\.\d+$/,""); }
function mmss(sec){ sec=Math.round(sec); var m=Math.floor(sec/60), r=sec%60; return m?m+":"+(r<10?"0":"")+r:sec+" s"; }
function specWords(sp){ return sp.laps?plural(sp.laps,"lap"):sp.min+" min + "+plural(sp.plus,"lap"); }
/* mxtimewire: one race of the night, the game's length next to the real race ("Main Event in real life: 22 laps, 54.8 s a lap, won in
   20:41 by ..."); a race with no research says so (the era's rule, and where its lap time comes from) */
/* where a lap time comes from, in words (plain text): the night's real lap, the era's typical lap (the years of lap charts it came from), or
   the track estimate */
function lapFrom(src,sec,c){
  var tm=c&&c.tm;
  if(src==="night") return "the night's real lap, "+lapWords(sec);
  if(src==="era") return "the era's typical lap, "+lapWords(sec)+(tm&&tm.epy?" (the "+tm.epy+" lap charts)":"");
  if(src==="venue") return "a lap about "+lapWords(sec)+" (estimated)";
  return lapWords(sec)+" a lap";
}
/* mxtimewire review (2026-10-17): what happened to a race (pack.js ev / us / rf / ts): "shortened from 20 min + 1 lap", "stopped early",
   "red-flagged and restarted"; a printed race time that runs through a stoppage says so; a race whose average lap was set aside
   (round.js lapOff: px) says what it rides instead */
function evWords(R){ if(!R||!R.ev) return ""; return R.ev==="e"?"stopped early":R.ev==="s"?(R.us?"shortened from "+R.us:"shortened"):R.ev==="r"?"red-flagged and restarted"+(R.rf>1?" "+R.rf+" times":""):""; }
function wonIn(R){ return R&&R.t?"won in "+raceTime(R.t)+(R.ts?" (the clock ran through the stoppage)":""):""; }
function pxWords(x,c){ return x&&x.px>0?"its laps average "+lapWords(x.px)+", far off the night's other races (a stoppage or a timing fault): it rides "+lapFrom(x.lsrc,x.lapS>0?x.lapS:x.lap,c):""; }
function realLine(x){
  var R=x.real, lab=esc(x.label), half=G&&G.o?G.o.length==="half":cfg.length==="half", c=x.round||(G&&G.cal[G.ri]);
  var lapNote=esc(lapFrom(x.lsrc,x.lapS,c));
  if(x.src==="time"&&R){
    var how=x.b>0?" at "+lapFrom(x.bs,x.b,c):"";
    return "<b>"+lab+" in real life:</b> "+esc("won in "+raceTime(R.t)+(R.w?" by "+R.w:"")+(R.u?" ("+R.u+")":""))+"; no lap chart survives. "+
      esc((half?"Half length: ":"")+plural(x.len,"lap")+", "+lapWords(x.lapS)+" a lap: the laps worked out from that time"+how+".");
  }
  if(x.src==="min"&&R&&R.mr) return "<b>"+lab+" in real life:</b> "+esc((R.u||R.m+" min")+(R.w?", won by "+R.w:""))+" (no lap count or times survive): "+esc(plural(x.len,"lap"))+" at "+lapNote+".";
  if(x.src==="real"&&R){
    var ev=evWords(R), t=[plural(R.l,"lap")+(ev?" ("+ev+")":"")];
    if(R.p&&!(x.px>0)) t.push(lapWords(R.p)+" a lap"+(R.pk==="m"?"":" (average)"));
    if(R.w) t.push((R.t?wonIn(R)+" by ":"won by ")+R.w);
    return "<b>"+lab+" in real life:</b> "+esc(t.join(", "))+"."+(half?" Half length: "+esc(plural(x.len,"lap"))+".":"")+(x.px>0?" "+esc(pxWords(x,c).replace(/^i/,"I"))+".":R.p?"":" No lap times survive: "+lapNote+".")+(R.f&&!half?" First lap "+esc(lapWords(R.f))+".":"");
  }
  if(x.src==="min"&&R) return "<b>"+lab+" in real life:</b> "+esc(R.m+" minutes"+(R.pl?" + "+plural(R.pl,"lap"):""))+" (no lap count survives): "+esc(plural(x.len,"lap"))+" at "+lapNote+".";
  var sp=RD.realSpec(S.calFormat(G,x.round||G.cal[G.ri]),x.kind,x.i|0,G.year);
  return "<b>Race info:</b> no researched times for this race: "+esc(specWords(sp))+" by the "+esc(String(G.year))+" rules, "+lapNote+".";
}
function progMins(pm){ var h=Math.floor(pm/60), m=Math.round(pm-h*60); return h?h+" h"+(m?" "+m+" min":""):m+" min"; }
/* the Race times sheet: every race of the round on now, the game's laps and lap time, and that night's research */
function openTimes(){
  if(!G||G.over) return;
  var c=G.cal[G.ri], list=S.roundRaces(G), tm=c.tm||null, half=G.o.length==="half";
  var rows=list.map(function(x){
    var R=x.real, top="<b>"+esc(x.label)+"</b> · "+esc(plural(x.len,"lap"))+" · "+esc(lapWords(x.lap))+" a lap"+(x.fl?" · first lap "+esc(lapWords(x.fl)):"")+(x.done?" · raced":x.live?" · on now":"");
    var sub;
    if(x.src==="real"&&R) sub="Real: "+(R.u?R.u+(evWords(R)?" ("+evWords(R)+")":"")+", ":evWords(R)?evWords(R)+", ":"")+plural(R.l,"lap")+" run"+(R.w?", "+(R.t?wonIn(R)+" ":"won ")+"by "+R.w:"")+(R.b?"; best lap "+lapWords(R.b)+(R.bb?" by "+R.bb:""):"")+(x.px>0?"; "+pxWords(x,c):R.p?"":"; no lap times survive ("+lapFrom(x.lsrc,x.lap,c)+")")+(half?"; half length":"")+".";
    else if(x.src==="time"&&R) sub="Real: won in "+raceTime(R.t)+(R.w?" by "+R.w:"")+(R.u?" ("+R.u+")":"")+"; no lap chart survives: the laps worked out from that time"+(x.b>0?" at "+lapFrom(x.bs,x.b,c):"")+(half?"; half length":"")+".";
    else if(x.src==="min"&&R) sub="Real: "+(R.u||R.m+" minutes")+(R.w?", won by "+R.w:"")+"; no lap count"+(R.mr?" or times survive":" survives")+": laps at "+lapFrom(x.lsrc,x.lap,c)+".";
    else sub="No researched times for this race: "+specWords(x.rule)+" by the "+G.year+" rules"+(x.lsrc==="night"?", at the night's real lap":x.lsrc==="era"?", at the era's typical lap":x.lsrc==="venue"?", a lap estimated":"")+".";
    return '<li class="mx-tt'+(x.live?" is-me":"")+(onTV()?" bg-focus":"")+'"'+(onTV()?' data-focus tabindex="-1"':"")+'><span class="mx-tt__t">'+top+'</span><span class="mx-tt__s">'+esc(sub)+"</span></li>";
  }).join("");
  var cnt=function(k){ return list.filter(function(x){ return x.src===k; }).length; }, real=cnt("real"), byT=cnt("time"), byM=cnt("min");
  var subTop=(real?"Each race runs the laps it ran that night"+(half?" (Half length: half of them)":"")+", a lap as long as its real lap.":
    byT?"No lap charts survive for this round: each race runs the laps its winning time makes"+(half?" (Half length: half of them)":"")+", so a lap takes its real share of that time.":
    byM?"No lap counts or times survive for this round: each race runs its real timed rule at "+lapFrom(list[0].lsrc,list[0].lap,c)+".":
    "No race of this round has researched times: the "+G.year+" rules, at an estimated lap.")+
    (tm&&tm.pm?" The real program: about "+progMins(tm.pm)+(tm.pe?" (estimated)":"")+".":"");
  $("timesSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">'+esc("Round "+(G.ri+1)+" · "+(c.city||c.venue)+(c.date?" · "+fmtDate(c.date):""))+'</span><h2 class="bg-sheet__title" id="timesTitle">Race times</h2><p class="bg-sheet__sub">'+esc(subTop)+"</p></div>"+
    '<ol class="mx-res mx-ttl">'+rows+"</ol>"+
    '<p class="mx-note">'+esc(real+" of "+list.length+" races with their laps researched"+(byT?", "+byT+" from the winning time":"")+(byM?", "+byM+" from the timed rule":"")+(tm&&tm.s?" ("+tm.s.toLowerCase()+")":"")+". Lap time = "+(real?"the winner's median lap (else the average)"+(byT?"; from a winning time: that time / the laps":""):byT?"the winning time / the laps":"as said for each race")+(list.some(function(x){ return x.px>0; })?"; an average far off the night's other races (a stoppage or a timing fault) rides the night's real lap":"")+"; a race takes about its laps x its lap time.")+"</p>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="timesClose" type="button">Close</button></div>';
  sheetOpen($("timesBox"),{focus:"#timesClose",onClose:function(){ setTimeout(function(){ if(onTV()&&!sheetUp()) focusTV($("timesBtn")); },60); }});
  $("timesClose").addEventListener("click",function(){ sheetClose($("timesBox")); });
}
$("timesBtn").addEventListener("click",openTimes);
/* the honest time of the selected season's usual round (its format, a typical lap of 56 s / 2:00) */
function estimate(si){
  var F=si&&IDX.formats[si.format]; if(!F) return null;
  var D=DATA[si.id]; if(D&&D.rounds&&D.rounds.some(function(r){ return r.tm; })){ try{ var E=estimateReal(si,D); if(E) return E; }catch(e){} }
  var mx=si.series==="mx", lap=mx?120:56, o={length:cfg.length}, all=0, mine=0, names=[];
  F.qual.forEach(function(st,k){ var n=RD.raceLen(F,st.kind,0,o,lap,si.year), sec=n*lap+RACE_EXTRA_S;
    names.push(st.label+(st.races>1?"s":"")+" "+n+" laps"+(cfg.length==="half"?"":" ("+specWords(RD.realSpec(F,st.kind,0,si.year))+")"));
    all+=st.races*sec; mine+=k===0?sec:sec*0.5; });
  var fl=F.finals, fin=0; for(var i=0;i<fl.races;i++){ var n=RD.raceLen(F,fl.kind,i,o,lap,si.year); fin+=n*lap+RACE_EXTRA_S; if(i===0) names.push((fl.races>1?fl.races+" "+fl.label+(fl.kind==="moto"?"s":"s")+" of ":fl.label+" ")+n+" laps"+(cfg.length==="half"?"":" ("+specWords(RD.realSpec(F,fl.kind,0,si.year))+")")); }
  all+=fin; mine+=fin;
  var ss=all*si.rounds/3600;
  return {mx:mx,lapW:mx?"2 min":"55 s",range:mx?"1:45-2:15":"53-59 s",races:names,all:Math.round(all/60),mine:Math.round(mine/60),season:ss<1.6?Math.round(ss*60)+" min":Math.round(ss)+" hours"};
}
/* mxtimewire: the season's own rounds (the season file loaded): every round's races at their real laps and lap times */
function estimateReal(si,D){
  var mx=si.series==="mx", o={length:cfg.length}, all=0, mine=0, n=0, lo=1e9, hi=0, withT=0, names=null, first=null;
  D.rounds.forEach(function(r){
    if(!r.title&&!cfg.nonTitle) return;
    var F=RD.formatFor(IDX,D.format,r), lapS=RD.nightLap(r)||RD.lapTime(si.series,si.year,r), a=0, m=0, nm=[];
    n++; if(r.tm) withT++;
    function one(label,kind,i){ var inf=RD.raceInfo(F,kind,i,o,lapS,si.year,r); if(inf.lsrc!=="night"&&inf.lsrc!=="venue"&&inf.lsrc!=="era"){ lo=Math.min(lo,inf.lap); hi=Math.max(hi,inf.lap); } nm.push(label+" "+inf.len+" laps"); return inf.len*inf.lap+RACE_EXTRA_S; }
    F.qual.forEach(function(st,k){ for(var i=0;i<st.races;i++){ var sec=one(st.label+(st.races>1?" "+(i+1):""),st.kind,i); a+=sec; if(i===0) m+=k===0?sec:sec*0.5; } });
    var f=F.finals; for(var i=0;i<f.races;i++){ var sec=one(f.races===1&&f.kind!=="moto"?f.label:(F.isTC?"Main "+(i+1):f.label+" "+(i+1)),f.kind,i); a+=sec; m+=sec; }
    all+=a; mine+=m; if(!names&&r.tm){ names=nm; first=r; }
  });
  if(!n) return null;
  if(!names){ names=[]; }
  var ss=all/3600, rng=hi>0?(lo===hi?lapWords(lo):lapWords(lo)+" to "+lapWords(hi)):(mx?"1:45-2:15":"53-59 s");
  return {mx:mx,real:true,withT:withT,n:n,first:first,lapW:rng,range:rng,races:names,all:Math.round(all/n/60),mine:Math.round(mine/n/60),season:ss<1.6?Math.round(ss*60)+" min":Math.round(ss)+" hours"};
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
    box.appendChild(ruleRow("version","War version","choice",RC.VERSIONS.map(function(v){ return [v.id,v.name+" ("+v.tag+")"]; }),0,o.version,"Three-card War is the CEO's War: 3 face down, the 4th decides. Crashes (the CEO's rule): lose a double war and you go down and remount; lose a triple war (or deeper) and you crash out of the race (classified behind the finishers, your cards go to the winner). Every crash brings out the yellow flag.",function(v){ cfg.war.version=v; drawSetup(); }));
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
  if(!resumable){ parts.push(LEN_NAME[RD.MODE_OF[cfg.length]||"real"]); if(changedRules()) parts.push("custom rules"); }
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
  S.upgrade(d.G);   /* mxlaps: a save made with the battle lengths races on at the real lengths (short -> Half length) */
  var bad=S.check(d.G); if(bad.length) throw new Error("save fails its check: "+bad[0]);
  gen++; clearTimeout(timer); busy=false; intent=0; skipQ=false;
  G=d.G; var c=d.cfg||{}; for(var k in c) if(Object.prototype.hasOwnProperty.call(cfg,k)) cfg[k]=c[k];
  cfg.length=RD.MODE_OF[cfg.length]||"real";
  cfg.speed=normSpeed(cfg.speed); setSpeedSeg(); cfg.skill=normSkill((G.o&&G.o.skill)||cfg.skill); setSkillSeg(); setAuto(cfg.auto);
  resetUI();
  ui.view=G.race?"race":"season"; ui.rc=G.race; ui.lap=0; ui.rmap=G.rmap?G.rmap.slice():null; ui.label=G.race?raceLabel():""; ui.prevPlace=null;
  pickView();
  /* the season's track layouts (a saved season carries its data, not its tracks): when they arrive, the 3D race takes the round's real track */
  var tid=G.series+"-"+G.year, g0=G; if(!tracksIn(tid)) loadTracks(tid).then(function(){ if(G===g0&&is3d()&&ui.rc){ ui.trkKey=null; renderRace(); } });
  closeSheets(); closeWin();
  Sound.music(GAME);
  showSetup(false); drawSetup(); armBack();
  if(G.over){ ui.finished=gen; setView("season"); setTimeout(function(){ if(G&&G.over&&!setupShown()) openWin(); },300); }
  /* mxtimewire: a save from before the per-round timing: attach it from the season file (mxsave: the race under way then takes its researched length) */
  if(!(G.tmv>=2)){ var g0=G, my=gen; loadSeason(G.sid).then(function(Dd){ if(G!==g0||my!==gen) return; var r0=G.race, l0=r0?r0.o.len+"|"+r0.lapS:""; var n=S.attachTiming(G,Dd); save(); if(n&&ui.view==="season"&&!setupShown()) renderSeason(); if(r0&&r0===G.race&&l0!==r0.o.len+"|"+r0.lapS) lenSync(); lenNotice(my); },function(){ lenNotice(my); }); }
  else lenNotice(gen);
}
/* mxsave: an old save's race under way now runs its real length (season.js realLive): say so ONCE (G.lenNote is cleared and saved at
   once, so a later load of this save says nothing), after the "loaded" toast */
function lenWords(n){
  var len=n.half?"half its real length":"its real length";
  if(n.done>=n.real) return "This race now runs "+len+": "+plural(n.real,"lap")+". "+n.done+" are done, so the checkered flag falls this lap.";
  return "This race now runs "+len+": "+plural(n.len,"lap")+(n.done>0?" ("+n.done+" done)":"")+".";
}
/* the season file's research came after the race was drawn (a save from before the per-round timing): the race on screen takes its
   researched laps and lap time (the lap chip, the track's lap count, pace and flag) */
function lenSync(){
  var rc=ui.rc, T=track(); if(!rc||!G||rc!==G.race) return;
  if(T){ T.setPace(lapGuess()); if(T.setFirst) T.setFirst(firstMs()); if(rc.phase!=="gate") T.setLaps(rc.battle,rc.o.len); T.setFlag(rc.over?"checkered":(rc.phase!=="gate"&&rc.battle+1===rc.o.len?"white":null)); }
  ui.white=rc.phase!=="gate"&&rc.battle+1>=rc.o.len?gen+"|"+G.rkey:null;
  if(rc.phase!=="gate"&&!rc.over){ $("midBig").textContent="Lap "+Math.min(ui.lap,rc.o.len); $("midSmall").textContent="of "+rc.o.len; }   /* as drawDuel */
  chips();
}
/* mxsave review: the MANUAL "Save game" slot keeps the old save until it is saved over, so loading it again would say it again: the
   notices said are remembered per race (season, round, race, the season's dice, the lengths; the last 12, guarded) and said once */
var LENK="bg_mxwar_lensaid";
function lenNotice(my){
  if(my!==gen||!G||!G.lenNote) return;
  var n=G.lenNote, id=[G.sid,G.ri,G.rkey,G.rs,n.was,n.len,n.done].join("|"); delete G.lenNote; save();
  var said=[]; try{ said=JSON.parse(localStorage.getItem(LENK)||"[]"); if(!Array.isArray(said)) said=[]; }catch(e){ said=[]; }
  if(said.indexOf(id)>=0) return;
  setTimeout(function(){ if(my!==gen) return; toast(lenWords(n),{ms:5200}); said.unshift(id); try{ localStorage.setItem(LENK,JSON.stringify(said.slice(0,12))); }catch(e){} },2600);
}
function resetUI(){ ui.winShown=-1; ui.result=false; ui.finished=-1; ui.order=[]; ui.lastCards={}; ui.bikes={}; ui.pendRound=null; ui.pendSeason=null; ui.log=[]; ui.rc=null; ui.rmap=null; ui.hs=null; ui.trkKey=null; disp=null; trackShow(); renderLog(); }
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
  s=s||{}; cfg.series=LONG[s.series]?s.series:"sx"; cfg.sid=s.sid||null; cfg.humans=s.humans!=null?clamp(+s.humans|0,0,8):1; cfg.length=RD.MODE_OF[s.length]||"real";
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
  { var a0=null; try{ a0=Saves.get?Saves.get(GAME,"auto"):null; }catch(e){ a0=null; } if(a0&&a0.data&&a0.data.G&&a0.data.G.series) loadTracks(a0.data.G.series+"-"+a0.data.G.year); }   /* warm: Continue finds the round's track ready */
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
    setBtn(go,"The champion","trophy"); sim.hidden=true; $("timesBtn").hidden=true;
  } else {
    var nx=S.next(G), c=nx.round, F=S.calFormat(G,c);
    $("nextEyebrow").textContent="Round "+(G.ri+1)+" of "+n+(c.title?"":" · no points (exhibition)")+(c.mult>1?" · points x"+c.mult:"");
    $("nextTitle").textContent=(c.city||c.venue)+" · "+nx.label;
    var bits=[];
    if(c.venue&&c.city) bits.push(esc(c.venue)); if(c.date) bits.push(esc(fmtDate(c.date)));
    bits.push(esc(plural(nx.len,"lap"))+(nx.lapS?" · about "+Math.max(1,Math.round(nx.len*nx.lapS/60))+" min ("+esc(lapWords(nx.lapS))+" a lap)":""));
    if(nx.n) bits.push(nx.n+" riders");
    $("nextSub").innerHTML=bits.join(" · ")+"<br>"+realLine(nx)+(nx.newRound?"<br><b>Tonight:</b> "+esc(progWords(F))+".":"")+(!nx.humanIn&&G.humans.length?"<br><b>You're not in this race.</b>":"");
    $("timesBtn").hidden=false;
    var final=nx.kind==="main"||nx.kind==="moto";
    ui.goSim=!nx.humanIn&&!final&&cfg.others==="sim"&&G.humans.length>0;
    setBtn(go,ui.goSim?"Sim to results":nx.humanIn||final?"To the gate":"Watch",ui.goSim?"":"play");
    sim.hidden=nx.humanIn||ui.goSim;   /* mxlaps: any race you are not in (the Main too) can be simmed */
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
  skipQ=false; ui.rc=G.race; ui.rmap=G.rmap.slice(); ui.label=raceLabel(); ui.hs=null; ui.lap=0; ui.lastWin=null; disp=null; ui.lastCards={}; ui.bikes={}; ui.order=[]; ui.flagged=false; ui.trkKey=null; ui.lapAt=0; ui.prevPlace=null; ui.trkB=null;
  pickView();
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
var TRK=null, V3=null, V3tried=false;
/* ---- MOTOCROSS WAR 3D: the view, or null (no WebGL, ?gl=0, an earlier failure): then the 2D track below runs the same race ---- */
function view3d(){
  if(window.__mx3dOff) return null;
  if(V3||V3tried) return V3; V3tried=true;
  if(/[?&]gl=0(&|$)/.test(location.search)||!MX.Race3D||!MX.Race3D.supported()) return null;
  try{ V3=MX.Race3D.create($("view3d"),{onBanner:onBanner3d,onNeed:onNeed3d}); }catch(e){ V3=null; try{ console.warn("mxwar 3d:",e); }catch(x){} }
  if(V3){ window.__mx3d=V3; V3.onLap=leaderLap; V3.onYellow=function(){ chips(); }; V3.setPace(lapMs()); }
  return V3;
}
function is3d(){ return !!(V3&&ui.use3d); }
/* this race is shown in 3D (when the view exists) or in 2D; the page's body says which */
function pickView(){ ui.use3d=!!view3d(); document.body.classList.toggle("mx-3d",ui.use3d); if(!ui.use3d) document.body.classList.remove("mx-cards"); else syncCards(); }
function track(){
  if(is3d()) return V3;
  if(!TRK&&MX.Track){ try{ TRK=MX.Track.create($("lane")); window.__mxtrk=TRK; TRK.setPace(lapMs()); TRK.onLap=leaderLap; TRK.onYellow=function(){ chips(); }; }catch(e){ TRK=null; } }
  return TRK;
}
/* the track with a riding clock (null: reduced motion, no track, not on the race): its laps set the pace of the cards */
function timedT(){ var T=track(); return T&&ui.rc&&ui.view==="race"&&T.ready()>=0?T:null; }
/* the leader starts lap k: the lap counter, and the white flag as the last lap begins */
function leaderLap(k){
  var rc=ui.rc; if(!rc||!G) return;
  var lp=Math.min(k,rc.o.len); if(lp>ui.lap||rc.over) ui.lap=lp;
  chips();
  if(is3d()&&k>1&&!rc.over) hudPop(4800);   /* the whole field's standings, for a few seconds (the CEO: all 40 on screen) */
  if(!rc.over&&k===rc.o.len&&rc.o.len>1&&ui.white!==gen+"|"+G.rkey){ ui.white=gen+"|"+G.rkey; var T=track(); if(T) T.setFlag("white"); Sound.sfx("bell"); logLine("White flag: last lap!"); banner("White flag","Last lap · "+k+" of "+rc.o.len,dl(1100),"is-calm is-white",false,true); }
}
/* mxcrash (the CEO, 20:06): "wars will be in a tiny box window, no one will wanna see it. Put it in a corner." The track fills the arena;
   the card flip and the wars play in a small window in the bottom-right corner (#table.is-pip), a tap / OK makes it bigger (.is-big) and
   smaller again. The course keeps clear of the small window (track.js setHole). */
function pipBig(){ return $("table").classList.contains("is-big"); }
function pipSize(W,H){
  var rem=remPx(), tv=onTV(), land=!tv&&W>H*1.25;
  var w=tv?Math.round(rem*14):land?clamp(Math.round(W*0.3),Math.round(rem*8.5),Math.round(rem*12)):clamp(Math.round(W*0.4),Math.round(rem*9.5),Math.round(rem*13));
  var h=tv?Math.round(rem*8.4):Math.round(Math.max(rem*7.4,Math.min(w*0.78,H*0.36)));
  return {w:w,h:h};
}
function layoutArena(){
  var ar=$("arena"), W=ar.clientWidth, H=ar.clientHeight; if(!W||!H) return false;
  var rem=remPx(), tv=onTV(), big=pipBig(), tb=$("table");
  ar.style.setProperty("--lane-h",H+"px");
  var small=pipSize(W,H), edge=Math.round(rem*(tv?1:.75));
  var bw=big?Math.round(Math.min(W-edge*2,tv?rem*44:W)):small.w, bh=big?Math.round(Math.min(H-edge*2-rem*(tv?3.2:2.6),Math.max(H*0.62,rem*13))):small.h;
  tb.style.setProperty("--pip-w",bw+"px"); tb.style.setProperty("--pip-h",bh+"px"); tb.style.setProperty("--pip-e",edge+"px");
  var lab=big?rem*(tv?1.05:1):rem*(tv?0.95:0.85), who=big?rem*(tv?1.3:1.35):rem*(tv?1.15:1.1);
  var cw=Math.round(Math.min((bh-lab-who-rem*.8)/1.4,bw*(big?0.2:0.27),rem*(tv?7.5:7)));
  cw=Math.max(cw,tv?Math.round(2.6*rem):big?34:26);
  tb.style.setProperty("--cw",cw+"px");
  var you=$("youSlot"), top=$("topSlot"), mid=$("midNote");
  you.style.top=top.style.top=Math.round(rem*(big?.35:.25))+"px";
  if(big){ you.style.left="24%"; top.style.left="76%"; you.style.width=top.style.width=Math.round(bw*.4)+"px"; }
  mid.style.top=Math.round(bh*.48)+"px"; mid.hidden=!big;
  GEO={W:W,H:H,laneH:H,cw:cw,tw:bw,th:bh};
  relabel();
  var T=track(); if(T){ T.setHole({w:small.w+edge,h:small.h+edge}); T.resize(); placeGate(); }
  if(is3d()&&HUD) HUD.refit();
  return true;
}
/* the slot labels: full words in the big window, short ones in the small corner window */
function lab(el,long,short){ el.setAttribute("data-l",long); el.setAttribute("data-s",short||long); el.textContent=pipBig()?long:(short||long); placeSlots(); }
function relabel(){ ["youLab","topLab"].forEach(function(id){ var el=$(id); if(el.hasAttribute("data-l")) el.textContent=pipBig()?el.getAttribute("data-l"):el.getAttribute("data-s"); }); placeSlots(); }
/* review fix (task2): in the small window the two slots sit from their labels' real widths: the top slot's label and card stay left of the
   expand icon in the top-right corner (.mx-pipbtn__ic: phone right .25rem + 1.3rem, TV .4rem + 2.4rem; "TOP" ran under it and read "TO"),
   the left slot as far right as 26% but never into the top slot ("LEADER" next to "TOP"); the cards keep their size */
function placeSlots(){
  if(!GEO||pipBig()) return;
  var rem=remPx(), tv=onTV(), bw=GEO.tw, cw=GEO.cw, you=$("youSlot"), top=$("topSlot");
  var wl=Math.max(cw,$("youLab").offsetWidth||0), wr=Math.max(cw,$("topLab").offsetWidth||0), iz=rem*(tv?2.9:1.65), pad=rem*.35, gap=rem*.3;
  var tx=Math.round(Math.min(bw*.74,bw-iz-wr/2-rem*.1)), yx=Math.round(Math.max(pad+wl/2,Math.min(bw*.26,tx-wr/2-gap-wl/2)));
  you.style.left=yx+"px"; top.style.left=tx+"px";
  you.style.width=Math.round(Math.max(wl,rem*3.2))+"px"; top.style.width=Math.round(Math.max(wr,rem*3.2))+"px";
}
function setPip(big,focus){
  var tb=$("table"), was=pipBig(); if(!!big===was) return;
  var r0=tb.getBoundingClientRect();
  tb.classList.toggle("is-big",!!big); tb.classList.toggle("is-pip",!big);
  var b=$("pipBtn"); b.setAttribute("aria-expanded",String(!!big)); b.setAttribute("aria-label",big?"Make the cards small again":"Show the cards bigger");
  $("pipIc").innerHTML=big?A.pipIcon(false):A.pipIcon(true);
  layoutArena();
  var row=$("warRow"); if(row.firstChild) row.style.setProperty("--cw",warCw(row.querySelectorAll(".mx-fight").length,!!row.querySelector(".mx-fight__more"))+"px");
  /* a one-shot grow / shrink from the corner (transform only) */
  var r1=tb.getBoundingClientRect();
  if(!reduced()&&tb.animate&&r1.width&&r0.width){ try{ tb.animate([{transform:"scale("+(r0.width/r1.width).toFixed(3)+","+(r0.height/r1.height).toFixed(3)+")"},{transform:"none"}],{duration:sp(220),easing:"cubic-bezier(.2,.8,.3,1)"}); }catch(e){} }
  if(focus&&onTV()) focusTV(b);
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
  var pick=null;
  if(T===V3) pick=T.setTrack(G.series,G.year,c,rc.n,lapSec());   /* the round's real track (or its flagged fallback), in the race's real lap time */
  else T.setLayout(G.series==="mx"?"outdoor":"stadium",(c.venue||"")+"|"+(c.city||"")+"|"+G.year);
  T.setRiders(rc.r.map(function(p,s){ var R=G.riders[seatId(s)], m=A.mk(R.bike); return {s:s,color:m[0],accent:m[0]==="#f2f4f8"?"#183a8c":"#f2f2f6",plate:R.plate,red:R.id===red,me:R.kind==="human",name:R.name}; }));
  T.setPace(lapGuess()); if(T.setFirst) T.setFirst(firstMs());
  if(T===V3){ hudRace(pick); applyCam(false); if(rc.phase==="gate") trackBanner(pick); }
  if(rc.phase==="gate") T.gate(true);
  else { T.gate(false); trackSync(false); T.setLaps(rc.battle,rc.o.len);
    /* crashes (CRASH-CONTRACT.md) picked up again: a rider out by a crash stays off the track where it happened; the yellow flies on */
    rc.r.forEach(function(p,s){ if(p.dnf&&p.dnf.why==="crash") T.park(s,p.dnf.sector); });
    if(rc.yellow&&rc.yellow.lap>=rc.battle+1){ T.setYellow(rc.yellow.lap,rc.yellow.s&&rc.yellow.s.length?rc.yellow.s[0]:null,rc.yellow.sector); } }
  ui.white=rc.phase!=="gate"&&rc.battle+1>=rc.o.len?gen+"|"+G.rkey:null;
  T.setFlag(rc.over?"checkered":(rc.phase!=="gate"&&rc.battle+1===rc.o.len?"white":null));
}
/* a first guess at a lap's length on screen (the track learns the real one from the laps it sees) */
/* review fix: the first guess is the MEASURED lap time at this Game speed (LAP_S, the setup's estimate; a race without you is watched
   about 1.5 times slower), so the field doesn't reach the line early and wait there on the first laps */
function lapGuess(){ return lapMs(); }
/* reduced motion / no track: ms until the next lap's cards (the last lap's cards turned at ui.lapAt) */
function clockWait(){ var rc=ui.rc; if(!rc||rc.phase!=="flip"||!ui.lapAt||timedT()) return 0; var f=rc.battle<=1?firstMs():0; return Math.max(0,Math.round(ui.lapAt+(f>0?f:lapMs())-Date.now())); }
function lapWait(T){ return T?T.ready():clockWait(); }
/* the standings on the track: every rider at their gap behind the leader (the cards on show while a battle plays) */
function trackSync(atGate){
  var T=track(), rc=ui.rc; if(!T||!rc) return;
  if(atGate){ T.gate(true); return; }
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; }), outs={};
  if(T===V3){   /* the lap's result as the engine has it (THE ONE PLACE the engine's lap result becomes the riders' places on the track: the race model reads here) */
    counts=rc.r.map(function(p){ return p.pk.length; });
    rc.r.forEach(function(p,s){ if(p.out&&!(p.dnf&&p.dnf.why==="crash")) outs[s]=1; });   /* out of cards: pulls off; a crash is the view's own (crash / park) */
  } else rc.r.forEach(function(p,s){ if(p.out&&(!disp||disp.cnt[s]===0)) outs[s]=1; });   /* parked once the show has reached their last card */
  var order=ui.order.length?ui.order:rc.r.map(function(p,s){ return s; });
  T.update(order,counts,outs);
}
function trackShow(){
  var on=!!(G&&ui.rc&&ui.view==="race"&&!setupShown());
  updSync();
  if(V3){ var on3=on&&is3d(); V3.setLive(on3); V3.show(on3&&!boardOpen()); hudShow(on3); }
  if(is3d()) return;
  if(!on&&!TRK) return;   /* (the 2D track is only made when a race needs it) */
  var T=track(); if(!T) return; T.setLive(on); T.show(on&&!boardOpen());
}
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
  layoutArena(); trackRiders(); trackSync(gate);
  /* the cards on the table now (a war in progress is drawn as a war; else the last battle) */
  if(rc.phase==="war"&&rc.part&&rc.part.length) drawWar(rc.part,rc.tb,false);
  else { $("warRow").innerHTML=""; pipNote(null); drawDuel(); }
  renderTower(null);
  syncControls();
  barTitle();
}
function drawDuel(winS){
  $("youSlot").hidden=false; $("topSlot").hidden=false; $("midNote").hidden=false;
  var rc=ui.rc, h=focusHuman(), lc=ui.lastCards;
  var left=h>=0?h:(ui.order.length?ui.order[0]:0);
  if(h>=0) lab($("youLab"),G.humans.length>1?"Card of":"Your card",G.humans.length>1?"Card":"You"); else lab($("youLab"),"Race leader","Leader");
  var lcId=lc[left]; setCard($("youCard"),lcId!=null?lcId:null,lcId!=null);
  $("youWho").innerHTML=whoHTML(left);
  var w=winS!=null?winS:ui.lastWin;
  if(w!=null&&lc[w]!=null){ setCard($("topCard"),lc[w],true); $("topWho").innerHTML=whoHTML(w); if(w===left&&G.humans.length===1&&h>=0) lab($("topLab"),"Top card: yours","Top"); else lab($("topLab"),"Top card","Top"); $("topCard").classList.add("is-win"); }
  else { setCard($("topCard"),null,false); $("topWho").innerHTML=""; lab($("topLab"),"Top card","Top"); }
  var rcp=rc.phase==="gate";
  $("midBig").textContent=rcp?"Gate":rc.over?"Flag":"Lap "+Math.min(ui.lap,rc.o.len);
  $("midSmall").textContent=rcp?"30 seconds":rc.over?"":"of "+rc.o.len;
}
function chips(){
  var rc=ui.rc; if(!rc) return;
  var lp=Math.min(ui.lap,rc.o.len), last=rc.phase!=="gate"&&!rc.over&&lp===rc.o.len&&rc.o.len>1;
  $("lapChip").innerHTML=rc.phase==="gate"?"On the gate":rc.over?A.flag()+"Checkered flag":(last?A.wflag():"")+"Lap "+lp+" of "+rc.o.len+(last?" · last lap":"");
  $("lapChip").classList.toggle("is-white",last);
  $("hsChip").innerHTML=ui.hs!=null?"Holeshot: "+esc(G.riders[seatId(ui.hs)].name):"";
  var T=track(), yon=!rc.over&&rc.phase!=="gate"&&(T&&T.live&&T.ready()>=0?T.yellowOn():!!rc.yellow);   /* review fix: never on the gate (a stale chip from a race skipped under a yellow) */
  $("yelChip").innerHTML=yon?A.yflag()+"Yellow flag":""; $("yelChip").classList.toggle("is-yellow",!!yon);
  $("fieldChip").textContent=fieldWords();
  if(is3d()) hudTick();
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
  if(is3d()){ hudTick(); return; }
  var tv=onTV(), order=ui.order.length?ui.order:rc.r.map(function(p,s){ return s; }), n=order.length, hs=raceHumans();
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; }), lead=counts[order[0]]||0;
  var rows=[], shown={};
  var max=tv?40:10;
  function row(s,i){
    var id=seatId(s), R=G.riders[id], me=R.kind==="human", out=rc.r[s].out, c=ui.lastCards[s], cls=(me?" is-me":"")+(out?" is-out":"")+(mark&&mark.win===s?" is-win":"")+(mark&&mark.fight&&mark.fight.indexOf(s)>=0?" is-fight":"");
    shown[s]=1;
    return '<li class="'+cls.trim()+'"><span class="mx-tw__p">'+(i+1)+"</span>"+plateHTML(R)+'<span class="mx-tw__n">'+esc(R.name)+"</span>"+
      '<span class="mx-tw__c'+(A.chipRed(c)?" is-red":"")+'">'+(c!=null&&!out?A.chip(c):"")+'</span><span class="mx-tw__k">'+(out?(rc.r[s].dnf&&rc.r[s].dnf.why==="crash"?"DNF":"out"):counts[s])+'</span><span class="mx-tw__g">'+(i===0||out||lead===counts[s]?"":"-"+(lead-counts[s]))+"</span></li>";
  }
  order.slice(0,max).forEach(function(s,i){ rows.push(row(s,i)); });
  var miss=hs.filter(function(s){ return !shown[s]; });
  if(miss.length){ rows.push('<li class="is-sep" aria-hidden="true"></li>'); miss.forEach(function(s){ rows.push(row(s,order.indexOf(s))); }); }
  var tw=$("tower"); tw.innerHTML=rows.join("");
  var two=tv&&rows.length>20; tw.classList.toggle("is-two",two); $("race").style.setProperty("--tw-col",two?"42rem":"30rem"); if(two) tw.style.setProperty("--tw-rows",String(Math.ceil(rows.length/2))); else tw.style.removeProperty("--tw-rows");
  $("towerSub").textContent=tv||n<=10?n+" riders · cards held":"top 10"+(miss.length?" + you":"")+" of "+n+" · cards held";
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
  skip.hidden=!!rc.over;   /* mxlaps: Skip to the finish on every race (it asks first) */
  var lbl="Flip", sub="";
  if(gate){ lbl="Drop the gate"; sub=hs.length>1?"then every rider turns a card":""; }
  else if(rc.phase==="war"&&need.length){ lbl="War: 3 down, flip the 4th"; }
  if(need.length&&(G.humans.length>1)){ var R=G.riders[seatId(need[0])]; sub=R.name+" · #"+R.plate; }
  $("flipLabel").textContent=lbl; $("flipSub").textContent=sub; $("flipSub").hidden=!sub;
  f.disabled=false;
  var t="";
  if(skipQ&&!rc.over) t="Skipping to the finish...";
  else if(rc.over) t="Checkered flag.";
  else if(!hs.length) t=G.humans.length?"You're not in this race: watch it, or skip to the finish.":"Watching the pros.";
  else if(gate) t=cfg.auto?"The gate drops by itself (Auto).":"Riders ready: drop the gate.";
  else if(!alive.length) t=hs.some(function(s){ return rc.r[s].dnf&&rc.r[s].dnf.why==="crash"; })?"Crashed out: the race runs on without you. Skip to the finish?":"Out of cards: the race runs on without you. Skip to the finish?";
  else if(need.length&&intent&&ui.queued) t=(G.humans.length>1?G.riders[seatId(need[0])].name+"'s card is in":"Your card is in")+": it turns as the leader starts lap "+Math.min(rc.battle+1,rc.o.len)+".";
  else if(busy) t=need.length?"Next: "+(G.humans.length>1?G.riders[seatId(need[0])].name+" flips":"your flip"):"";
  else if(!need.length&&rc.phase==="war") t="War between "+whoList(rc.part||[])+": their cards turn"+(intent?" (your flip is queued)":"")+".";
  else if(!need.length) t=intent?"Your flip is queued for the next lap.":"";
  else if(need.length) t=cfg.auto?"Auto: your card turns by itself.":(rc.phase==="war"?"War! Lay 3 down and turn the 4th.":(G.humans.length>1?G.riders[seatId(need[0])].name+": turn your card.":"Turn your card."));
  stat.textContent=t;
  $("hintOk").textContent=gate&&hs.length?"Drop the gate":need.length?"Flip":f.hidden&&!skip.hidden?"Skip to the finish":"Flip";
  if(onTV()&&!busy){ var mc=mainControl(), a=document.activeElement; if(mc&&!mc.hidden&&(a===document.body||!a||(a.disabled)||a.hidden||!$("race").contains(a))&&!sheetUp()) focusTV(mc); }
}
function sheetUp(){ var B=BG(); return !!(B&&B.sheet&&B.sheet.top&&B.sheet.top())||!!(B&&B.win&&B.win.isOpen&&B.win.isOpen()); }
$("flipBtn").addEventListener("click",function(){
  if(!G||!ui.rc||ui.rc.over||ui.view!=="race") return;
  intent=1;
  if(!busy) drive(); else syncControls();
});
$("skipBtn").addEventListener("click",function(){ if(!G||!ui.rc||ui.rc.over) return; confirmSkip(); });
/* mxlaps: "Skip to the finish" asks first (a real-length race is long; one tap shouldn't throw it away) */
function confirmSkip(){
  var rc=ui.rc, c=G.cal[Math.min(G.ri,G.cal.length-1)], left=Math.max(0,rc.o.len-rc.battle), mine=raceHumans().length>0;
  $("skipSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">'+esc((c.city||c.venue)+" · "+ui.label)+'</span><h2 class="bg-sheet__title" id="skipTitle">Skip to the finish?</h2>'+
    '<p class="bg-sheet__sub">'+(rc.phase==="gate"?"The whole race":plural(left,"lap")+" to go")+" (about "+Math.max(1,Math.round(left*lapSec()/60))+" min). The cards decide the rest at once, as War always does"+(mine?", your cards too":"")+", and you see the result.</p></div>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--secondary bg-btn--lg" id="skipYes" type="button">Skip to the finish</button><button class="bg-btn bg-btn--primary bg-btn--lg" id="skipNo" type="button" data-autofocus>Keep watching</button></div>';
  sheetOpen($("skipBox"),{focus:"#skipNo"});
  $("skipYes").addEventListener("click",function(){ sheetClose($("skipBox")); if(!G||!ui.rc||ui.rc.over) return; if(busy){ skipQ=true; syncControls(); return; } simNow(); });
  $("skipNo").addEventListener("click",function(){ sheetClose($("skipBox")); setTimeout(function(){ focusTV(mainControl()); },60); });
}
$("pipIc").innerHTML=A.pipIcon(true);
$("pipBtn").addEventListener("click",function(ev){ ev.stopPropagation(); setPip(!pipBig(),true); });
$("arena").addEventListener("click",function(ev){ if(ev.target&&ev.target.closest&&ev.target.closest("#table")) return;
  if(ev.target&&ev.target.closest&&ev.target.closest(".mx-h-full, .mx-hbtns")) return;
  if(ev.target&&ev.target.closest&&ev.target.closest(".mx-h-tl")&&HUD){ HUD.toggle(); hudTick(); return; } if(ui.rc&&!ui.rc.over&&raceHumans().length&&!busy&&(ui.rc.phase==="gate"||RC.need(ui.rc).length)){ intent=1; drive(); } });

/* ================= MOTOCROSS WAR 3D: the overlay (hud.js), the cards behind the race, the view's moments ================= */
var HUD=null, hudT=0;
function hudRider(s){
  var id=seatId(s), R=id&&G?G.riders[id]:null; if(!R) return {plate:"",name:"",short:""};
  var nm=String(R.name||""), parts=nm.split(" "), sur=parts[parts.length-1], init=parts.length>1&&parts[0]?parts[0].charAt(0)+". ":"";
  return {plate:plateHTML(R),name:nm,short:init+sur,me:R.kind==="human",red:R.id===redId()};
}
function hud(){
  if(!HUD&&MX.Hud) HUD=MX.Hud.create({root:$("arena"),rider:hudRider,tv:onTV,onFull:function(on){ $("standBtn").setAttribute("aria-pressed",String(!!on)); }});
  return HUD;
}
function hudRace(pick){
  var h=hud(); if(!h||!ui.rc) return; var c=G.cal[Math.min(G.ri,G.cal.length-1)];
  h.race({n:ui.rc.n,len:ui.rc.o.len,track:c.city||c.venue,label:ui.label+(c.venue&&c.city&&c.venue!==c.city?" · "+c.venue:"")});
}
function hudRows(){
  var rc=ui.rc, rows=V3&&rc?V3.rows():[];
  rows.forEach(function(r){ var p=rc.r[r.s]; r.cards=p?(disp?disp.cnt[r.s]:p.pk.length):0; });
  return rows;
}
function hudTick(){
  var h=HUD; if(!h||!h.on||!is3d()||!ui.rc||!V3) return;
  var rc=ui.rc; h.update(hudRows(),{lap:Math.min(Math.max(ui.lap||V3.leaderLap(),1),rc.o.len),gate:rc.phase==="gate",over:!!rc.over,yellow:V3.yellowOn()});
}
function hudShow(on){
  var h=on?hud():HUD; if(!h) return;
  h.show(on); clearInterval(hudT); hudT=0;
  if(on){ hudTick(); hudT=setInterval(function(){ if(!document.hidden) hudTick(); },250); }
}
function hudPop(ms){ if(HUD&&is3d()) HUD.pop(ms); }
var CARDS_KEY="bg_mxwar_cards";
function bgCards(){ return is3d()&&!ui.showCards; }
function syncCards(){
  if(ui.showCards==null){ try{ ui.showCards=localStorage.getItem(CARDS_KEY)==="1"; }catch(e){ ui.showCards=false; } }
  var on=!!ui.showCards&&is3d(); document.body.classList.toggle("mx-cards",on);
  var b=$("cardsBtn"); b.setAttribute("aria-pressed",String(!!ui.showCards)); b.setAttribute("aria-label",ui.showCards?"Hide the cards":"Show the cards");
}
function setCards(on){
  ui.showCards=!!on; try{ localStorage.setItem(CARDS_KEY,on?"1":"0"); }catch(e){}
  syncCards();
  if(on&&ui.rc){ if(pipBig()) setPip(false,false); layoutArena(); if(ui.rc.phase==="war"&&ui.rc.part&&ui.rc.part.length) drawWar(ui.rc.part,ui.rc.tb,false); else drawDuel(); }
}
/* the two buttons' glyphs (original line art, drawn here: the icon set may not have them yet) */
(function(){ var o='<svg class="bg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
  $("standIc").innerHTML=o+'<path d="M4 6h3M10 6h10M4 12h3M10 12h10M4 18h3M10 18h10"/></svg>';
  $("cardsIc").innerHTML=o+'<rect x="6.5" y="3.5" width="11" height="17" rx="2"/><path d="M12 9l2.2 3-2.2 3-2.2-3z"/></svg>'; })();
/* the camera the person picks (the CEO's visual pack: cover chase, broadcast trackside, grandstand full-track, onboard; "TV" = the director's own mix) */
var CAMS=[["auto","TV director"],["chase","Chase cam"],["stands","Grandstand"],["side","Trackside"],["onboard","Onboard"]], CAM_KEY="bg_mxwar_cam";
function camName(){ if(ui.cam==null){ try{ ui.cam=localStorage.getItem(CAM_KEY)||"auto"; }catch(e){ ui.cam="auto"; } } return ui.cam; }
function applyCam(say){
  var k=camName(), lab=(CAMS.filter(function(c){ return c[0]===k; })[0]||CAMS[0])[1], b=$("camBtn");
  if(V3&&V3.director) V3.director.preset(k);
  b.setAttribute("aria-label","Camera: "+lab+". Change it"); $("camTx").textContent=lab; b.setAttribute("aria-pressed",String(k!=="auto"));
  if(say&&HUD) HUD.say("<b>Camera:</b> "+esc(lab),"",1800);
}
$("camIc").innerHTML='<svg class="bg-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="7" width="13" height="10" rx="2"/><path d="M16 10.5l5-2.5v8l-5-2.5"/></svg>';
$("camBtn").addEventListener("click",function(ev){ ev.stopPropagation(); var k=camName(), i=0; CAMS.forEach(function(c,j){ if(c[0]===k) i=j; }); ui.cam=CAMS[(i+1)%CAMS.length][0]; try{ localStorage.setItem(CAM_KEY,ui.cam); }catch(e){} applyCam(true); });
$("standBtn").addEventListener("click",function(ev){ ev.stopPropagation(); if(HUD){ HUD.toggle(); hudTick(); } });
$("cardsBtn").addEventListener("click",function(ev){ ev.stopPropagation(); setCards(!ui.showCards); });
/* the Menu key of the remote (and S on a keyboard): the full standings */
document.addEventListener("keydown",function(e){
  if(!is3d()||setupShown()||ui.view!=="race"||sheetUp()||e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey) return;
  var k=e.key, c=e.keyCode;
  if(k==="ContextMenu"||k==="Menu"||c===82||c===93||k==="s"||k==="S"){ e.preventDefault(); if(HUD){ HUD.toggle(); hudTick(); } }
});
/* a war with the cards behind the race: a tiny flash (the tied riders' plates), a double war says what it costs */
function warFlash(e){
  var h=hud(); if(!h) return;
  var names=e.tied.map(function(s){ return "#"+G.riders[seatId(s)].plate; }), who=names.length>3?names.length+" riders":names.join(" · ");
  h.say("<b>"+(e.n>2?"Triple war":e.n===2?"Double war":"War")+"!</b> "+esc(who)+(e.n>2?" · the loser crashes out":e.n===2?" · the loser crashes":""),"is-war"+(e.n>1?" is-hot":""),e.n>1?2800:1900);
}
/* the lap's news for a person: the card, the places gained or lost (the cards decide; the track shows it over the lap) */
function lapNews(e){
  var rc=ui.rc; if(!is3d()||!rc||!HUD) return;
  var hs=raceHumans(); if(hs.length!==1) return;
  var s=hs[0], np=ui.order.indexOf(s)+1, pp=ui.prevPlace!=null?ui.prevPlace:np; ui.prevPlace=np;
  if(rc.r[s].out||np<1||(ui.lap||1)<=1) return;
  var c=ui.lastCards[s], cw=c!=null?rankWord(A.info(c).r):"", lap=Math.min(ui.lap,rc.o.len), pre="<b>Lap "+lap+":</b> ";
  var card=cw?(/^(Ace|8)$/.test(cw)?"an ":"a ")+esc(cw)+" · ":"";
  if(e.s===s) HUD.say(pre+"you win it"+(e.war?" (a war!)":"")+" · <span class=\"up\">"+(np<pp?"up to "+ord(np):"in "+ord(np))+"</span>","",3400);
  else if(np<pp) HUD.say(pre+card+"<span class=\"up\">up to "+ord(np)+"</span>","",3200);
  else if(np>pp) HUD.say(pre+card+"<span class=\"dn\">down to "+ord(np)+"</span>","",3200);
  else HUD.say(pre+card+"holding "+ord(np),"",2600);
}
/* the view's moments: the holeshot as the leader exits turn 1, a crash as it happens (with the yellow flag) */
function onBanner3d(b){
  if(!G||!ui.rc) return;
  if(b.kind==="holeshot"&&ui.hs!=null){ var R=G.riders[seatId(ui.hs)]; Sound.sfx("bell"); banner("Holeshot!","#"+R.plate+" "+R.name+(R.bike?" · "+R.bike:""),dl(1700),"is-calm"); }
  else if(b.kind==="crash"&&b.seat>=0){ var R2=G.riders[seatId(b.seat)]; Sound.sfx(b.out?"lose":"bump");
    banner(b.out?"Crash: out of the race":"Crash!","#"+R2.plate+" "+R2.name+" · yellow flag"+(b.out?"":" · back up and riding"),dl(2400),"is-yellow"); }
}
/* real time never stops: a person's card still face down 5 s before the line turns by itself */
function onNeed3d(lap){
  var rc=ui.rc; if(!G||!rc||rc.over) return;
  if(busy||paused()){ setTimeout(function(){ if(V3&&V3.resLap<lap&&ui.rc===rc) onNeed3d(lap); },500); return; }
  if(RC.need(rc).length){ toast("Time's up: "+(G.humans.length>1?"the cards":"your card")+" turned for lap "+Math.min(lap,rc.o.len)+".",{ms:2200}); act({t:"flipAll"}); }
}
/* at the gate of a round's first race: which track this is and how its layout is known */
function trackBanner(pick){
  if(!pick||!pick.layout||!G) return; var k=gen+"|"+G.ri; if(ui.trkB===k) return; ui.trkB=k;
  var L=pick.layout, own=/^(sx-stadium|daytona-hybrid|national-hills)$/.test(L.id||""), how, dec=Math.floor(G.year/10)*10+"s";
  if(own||pick.how==="era") how="A track of our own design, in the "+dec+" style";
  else if(pick.how==="venue") how="This venue's "+(pick.fbYear||"earlier")+" layout";
  else how=L.status==="TRACED"?"From the official track map":L.status==="SKETCHED"?"From the race reports":"In the style of the "+dec;
  var c=G.cal[Math.min(G.ri,G.cal.length-1)];
  banner(own||pick.how==="era"?(c.city||c.venue):(L.name||c.city||"The track"),(L.venue&&!own?L.venue+" · ":"")+how,dl(2800),"is-calm");
}
/* the 3D view gives way to the 2D track when it cannot go on: the graphics lost for good, or a device far too slow (its own measurement) */
function to2d(why){
  if(!is3d()) return;
  window.__mx3dOff=true; try{ V3.setLive(false); V3.show(false); }catch(e){}
  ui.use3d=false; document.body.classList.remove("mx-3d","mx-cards"); hudShow(false);
  if(G&&ui.rc){ ui.trkKey=null; renderRace(); trackShow(); }
  toast("The 3D race stopped ("+why+"): the simple track is on.",{ms:4200});
}
var lostN=0, slowN=0;
setInterval(function(){
  if(!is3d()||document.hidden||!ui.rc||ui.view!=="race") return;
  if(V3.lost){ if(++lostN>=3) to2d("the graphics were lost"); } else lostN=0;
  var st=V3.stats(); if(st.half&&st.frames>180&&st.jsMs>80&&!/[?&]gl=force(&|$)/.test(location.search)){ if(++slowN>=4) to2d("this device is too slow"); } else slowN=0;
},2500);

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
  /* mxcrash: riding, a lap's cards turn as the leader STARTS that lap (T.ready), and the field rides the result round it; a person's flip
     pressed early waits for the line ("your card is in"); a war plays on in the same lap. Reduced motion: v2's pace. */
  var need=RC.need(rc), T=rc.phase==="flip"?timedT():null, rdy=lapWait(T), clk=!T&&rdy>0, lead=T?Math.round(Math.min(lapMs()*0.03,1500)):0;
  if(need.length){
    /* the gate drop turns everyone's first card: the holeshot is decided on the run to turn 1 (the CEO: "The whole shot would be who wins the first round of each race") */
    if(is3d()&&rc.battle===0){ intent=0; ui.queued=false; later(my,function(){ act({t:"flipAll"}); },dl(rc.phase==="war"?420:260)); return; }
    if(intent){
      if((T||clk)&&need.length===1&&rdy>0){ ui.queued=true; syncControls(); later(my,drive,rdy+lead); return; }
      ui.queued=false; intent=0; act({t:"flip",s:need[0]}); return;
    }
    if(cfg.auto){ later(my,function(){ var r=lapWait(T); if(r>0){ drive(); return; } act({t:"flipAll"}); },(T||clk)?Math.max(rdy+lead,dl(200)):dl(rc.phase==="war"?380:520)); return; }
    focusTV($("flipBtn"));
    return;
  }
  var wait=rc.phase==="war"?dl(420):Math.max(200,Math.round(BR.pace(G,cfg.speed)*(hs.length?0.6:1)));
  if(T||clk) wait=Math.max(rdy+lead,dl(200));
  later(my,function(){ var r=lapWait(T); if(r>0){ drive(); return; } act({t:"step"}); },wait);
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
  for(var i=0;i<evs.length;i++){ if(my!==gen) return; await hold(my); await animEvent(my,evs[i]); }
}
function nm(s){ return G.riders[seatId(s)].name; }
function whoList(seats){ return seats.length<=3?listNames(seats.map(nm)):seats.length+" riders"; }
async function animEvent(my,e){
  var rc=ui.rc;
  if(!rc) return;   /* the race was simmed under the show: nothing left to draw */
  switch(e.e){
    case "gate": {
      Sound.sfx("jail"); logLine("The gate drops!");
      var gt=$("gate"), du=$("dust");
      if(!reduced()&&gt.animate&&!is3d()){
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
        ui.lapAt=Date.now();   /* mxlaps: this lap's cards turn as it starts (the plain clock under reduced motion counts from here) */
        ui.lapPre=disp.cnt.slice(); ui.lastWin=null; $("warRow").innerHTML=""; pipNote(null); $("youSlot").hidden=false; $("topSlot").hidden=false; $("midNote").hidden=false;
        e.cards.forEach(function(x){ ui.lastCards[x.s]=x.c; disp.cnt[x.s]=Math.max(0,disp.cnt[x.s]-1); });
        Sound.sfx("card");
        if(bgCards()){ hudTick(); await sleep(dl(120)); return; }   /* the cards run behind the race ("Cards" brings the corner window back) */
        var h=focusHuman(), left=h>=0&&ui.lastCards[h]!=null?h:null;
        $("midBig").textContent="Lap "+Math.min(ui.lap,rc.o.len); $("midSmall").textContent="of "+rc.o.len;
        var best=bestOf(e.cards), ps=[];
        if(left!=null){ $("youWho").innerHTML=whoHTML(left); lab($("youLab"),G.humans.length>1?"Card of":"Your card",G.humans.length>1?"Card":"You"); ps.push(flipCard($("youCard"),ui.lastCards[left],sp(360))); }
        else { var L0=ui.order.length?ui.order[0]:e.cards[0].s; lab($("youLab"),"Race leader","Leader"); $("youWho").innerHTML=whoHTML(L0); ps.push(flipCard($("youCard"),ui.lastCards[L0]!=null?ui.lastCards[L0]:null,sp(360))); }
        $("topCard").classList.remove("is-win");
        renderTower(null);
        await Promise.all(ps);
        if(best.length===1){ if(best[0]===left&&G.humans.length===1) lab($("topLab"),"Top card: yours","Top"); else lab($("topLab"),"Top card","Top"); $("topWho").innerHTML=whoHTML(best[0]); await flipCard($("topCard"),ui.lastCards[best[0]],sp(300)); }
        else { lab($("topLab"),"Tie for the top","Tie"); $("topWho").innerHTML='<span class="mx-sn">'+esc(whoList(best))+"</span>"; await flipCard($("topCard"),ui.lastCards[best[0]],sp(300)); }
        await sleep(dl(best.length>1?260:200));
      } else {
        /* a war: each fighter lays its face-down cards, then the 4th turns (the CEO's war: 3 down, the 4th decides) */
        e.cards.forEach(function(x){ disp.cnt[x.s]=Math.max(0,disp.cnt[x.s]-(x.down+(x.held?0:1))); ui.lastCards[x.s]=x.c; });
        if(bgCards()){ await sleep(dl(160)); return; }
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
      Sound.sfx("cannon"); if(!is3d()) flash();
      var tiedR=rc.cur&&e.tied.length?A.info(ui.lastCards[e.tied[0]]).r:0;
      logLine((e.n>1?"War again! ":"War! ")+whoList(e.tied)+" tie"+(tiedR?" with "+rankPlural(tiedR):"")+".");
      if(bgCards()){ warFlash(e); await sleep(dl(e.n>1?900:500)); return; }   /* a tiny flash: the cards are behind the race */
      drawWar(e.seats,null,true);
      renderTower({fight:e.seats});
      /* the CEO (20:06): the wars stay in the corner window: its name there (a double war loses = a crash, a triple war = out) */
      await pipNote(e.n===1?"War!":e.n===2?"Double war!|the loser crashes":e.n===3?"Triple war!|the loser is out":warWordP(e.n)+"!|the loser is out",dl(e.n>1?900:850),e.n>1);
      return;
    }
    case "kitty": { logLine(nm(e.s)+" also takes "+plural(e.n,"left-over card")+"."); return; }
    /* CRASH-CONTRACT.md: a lost double war = down and remount, a lost triple war (or deeper) = out; the yellow flag comes out */
    case "crash": {
      var Rc=G.riders[seatId(e.s)], T5=track();
      if(e.kind==="out") disp.cnt[e.s]=0;
      ui.crashQ=(ui.crashQ||[]).concat([{s:e.s,kind:e.kind,depth:e.depth}]);
      if(T5) T5.crash(e.s,e.kind);
      if(!is3d()) Sound.sfx(e.kind==="out"?"lose":"bump");   /* 3D: the sound comes as it happens on the track (onBanner3d) */
      var you=Rc.kind==="human"&&/^you$/i.test(Rc.name);
      logLine("Crash! #"+Rc.plate+" "+Rc.name+(e.kind==="out"?(you?" lose the ":" loses the ")+warWordP(e.depth).toLowerCase()+(you?" and are out of the race.":" and is out of the race."):(you?" lose the double war, go down and remount.":" loses the double war, goes down and remounts.")));
      renderTower({fight:[e.s]}); trackSync(false);
      return;
    }
    case "crashCards": { disp.cnt[e.s]+=e.n; logLine(nm(e.s)+" takes the "+plural(e.n,"card")+" the crashed rider"+(ui.crashQ&&ui.crashQ.length>1?"s":"")+" held."); renderTower(null); trackSync(false); return; }
    case "yellow": {
      var q=ui.crashQ||[]; ui.crashQ=[];
      var T6=track(); if(T6) T6.setYellow(e.lap,e.s,e.sector);
      chips();
      if(!q.length) return;   /* one banner for every rider who went down in that war */
      var outN=q.filter(function(x){ return x.kind==="out"; }).length, who=q.map(function(x){ var R=G.riders[seatId(x.s)]; return "#"+R.plate+" "+R.name; });
      var plur=who.length>1||(q.length===1&&/^you$/i.test(G.riders[seatId(q[0].s)].name));
      var sub=(who.length>2?who.length+" riders":listNames(who))+(outN?(plur?" are":" is")+" out of the race":(plur?" go down and remount":" goes down and remounts"))+" · no passing there";
      logLine("Yellow flag: no passing there until the end of lap "+e.lap+".");
      if(is3d()) return;   /* 3D: the banner comes when the crash happens on the track (onBanner3d) */
      await banner("Yellow flag",sub,dl(1500),"is-yellow");
      return;
    }
    case "dnf": { if(e.why==="crash") renderTower(null); return; }
    case "short": { e.seats.forEach(function(s){ disp.cnt[s]=0; }); logLine(whoList(e.seats)+(e.seats.length>1?" don't":" doesn't")+" have enough cards for the war."); return; }
    case "deadlock": { if(is3d()) trackSync(false); var T2=track(); if(T2) T2.lap(ui.lap,rc.o.len); refreshBoard(); logLine(whoList(e.seats)+" tie with their last cards: "+plural(e.n,"card")+" set aside."); await banner("Dead heat",plural(e.n,"card")+" set aside",dl(800),"is-calm"); return; }
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
      renderTower({win:e.s}); trackSync(false); var T1=track(); if(T1) T1.lap(ui.lap,rc.o.len,{winner:e.s,war:e.war}); lapNews(e); refreshBoard();
      await sleep(dl(e.war?520:300));
      return;
    }
    case "holeshot": {
      ui.hs=e.s; chips(); if(!is3d()) Sound.sfx("bell");
      var hl=null; try{ hl=BR.react(G,e); }catch(x){} logLine(hl||"Holeshot: "+nm(e.s)+"!");
      var R=G.riders[seatId(e.s)];
      if(is3d()) return;   /* 3D: the banner comes as the leader exits turn 1 on the track (onBanner3d) */
      await banner("Holeshot!","#"+R.plate+" "+R.name+(R.bike?" · "+R.bike:""),dl(1100),"is-calm");
      return;
    }
    case "out": { e.seats.forEach(function(s){ disp.cnt[s]=0; }); logLine(whoList(e.seats)+(e.seats.length>1?" are":" is")+" out of cards."); if(e.seats.length===1) say(e); renderTower(null); trackSync(false); return; }
    case "lead": { say(e); return; }
    case "next": {
      if(timedT()) return;   /* riding: the leader's own lap moves the counter and brings the white flag (leaderLap) */
      ui.lap=e.b; chips();
      /* the white flag: the last lap (the CEO v2: "Lap 7 of 30", the white flag on the last lap, the checkered flag at the end) */
      if(e.b===rc.o.len&&rc.o.len>1){ var T3=track(); if(T3) T3.setFlag("white"); Sound.sfx("bell"); logLine("White flag: last lap!"); await banner("White flag","Last lap · "+e.b+" of "+rc.o.len,dl(900),"is-calm is-white",false,true); }
      return;
    }
    case "flag": {
      /* the last lap's cards are turned as it starts: the field rides it out and the flag falls as the leader crosses the line */
      var Tf=timedT();
      if(Tf){ $("stat").textContent="Last lap: the riders ride to the flag."; for(var gi=0;gi<2400;gi++){ await hold(my); if(my!==gen) return; if(skipQ) break; var ms=Tf.untilLine(e.b); if(ms<=0) break; await sleep(Math.min(ms,250)); } }
      else if(ui.lapAt&&!skipQ){ $("stat").textContent="Last lap: the riders ride to the flag."; for(var gj=0;gj<2400;gj++){ await hold(my); if(my!==gen) return; if(skipQ) break; var mc=ui.lapAt+lapMs()-Date.now(); if(mc<=0) break; await sleep(Math.min(mc,250)); } }
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
/* the war's cards in the card window: up to 3 fighters in the small window on a phone (4 on TV), 4 / 5 in the big one; "+n more" */
function warCw(cols,more){
  var rem=remPx(), W=GEO?GEO.tw:300, H=GEO?GEO.th:160, big=pipBig(), tv=onTV();
  var colW=(W-rem*.6)/(cols+(more?0.7:0))-rem*.4;
  /* review fix (task2): a column fits the window's height: the war's insets (index.html .mx-war: small .3rem / TV .5rem at the bottom, below
     the expand icon at the top; big 2rem + .5rem / TV 3rem + .75rem), the plate row (+ the "tied with" row in the big window) and the pile
     (1.4 cw, the face-down cards lean a little lower): the cards hung out of the window's bottom on TV */
  var ins=big?(tv?3.75:2.5):(tv?3.3:2.3), rows=big?2.7:1.4, hcw=(H-rem*(ins+rows))/1.49;
  return Math.round(Math.max(tv?2.4*rem:big?30:22,Math.min(colW*(big?.62:.6),hcw,GEO?GEO.cw:70)));
}
function drawWar(seats,tb,fresh){
  $("youSlot").hidden=true; $("topSlot").hidden=true; $("midNote").hidden=true;
  var hs=seats.filter(function(s){ return isHumanId(seatId(s)); }), rest=seats.filter(function(s){ return hs.indexOf(s)<0; });
  var big=pipBig(), vis=hs.concat(rest).slice(0,onTV()?(big?5:4):(big?4:3)), more=seats.length-vis.length;
  var row=$("warRow");
  ui.warSeats=seats.slice();
  row.style.setProperty("--cw",warCw(vis.length,more>0)+"px");
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
/* never two banners at once: they queue (the leader's white flag can come while a lap's show plays) */
var bannerQ=Promise.resolve();
function banner(t,s,ms,cls,flagIcon,white){ var p=bannerQ.then(function(){ return banner1(t,s,ms,cls,flagIcon,white); }); bannerQ=p.then(null,function(){}); return p; }
/* the war's name in the card window (the CEO: wars in the corner); hot = a double war or more (crash ahead) */
function pipNote(t,ms,hot){
  var el=$("pipNote"); if(!t){ el.className="mx-pipnote"; el.textContent=""; return Promise.resolve(); }
  var parts=String(t).split("|"); el.innerHTML="<b>"+esc(parts[0])+"</b>"+(parts[1]?"<span> · "+esc(parts[1])+"</span>":""); el.className="mx-pipnote is-on"+(hot?" is-hot":"");
  if(!reduced()&&el.animate) try{ el.animate([{transform:"translateX(-50%) scale(.8)",opacity:0},{transform:"translateX(-50%) scale(1)",opacity:1}],{duration:sp(200),easing:"cubic-bezier(.2,.8,.3,1.2)"}); }catch(e){}
  return sleep(ms||0);
}
function banner1(t,s,ms,cls,flagIcon,white){
  var b=$("banner");
  $("bannerT").innerHTML=(flagIcon?A.flag()+"<br>":white?A.wflag()+"<br>":/is-yellow/.test(cls||"")?A.yflag()+"<br>":"")+esc(t); $("bannerS").textContent=s||"";
  b.className="mx-banner is-on"+(cls?" "+cls:"");
  var p=Promise.resolve();
  if(!reduced()&&b.animate){ try{ p=b.animate([{opacity:0,transform:"translate(-50%,0) scale(.85)"},{opacity:1,transform:"translate(-50%,0) scale(1)"}],{duration:sp(220),easing:"cubic-bezier(.2,.8,.3,1.2)"}).finished.then(function(){},function(){}); }catch(e){} }
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
  if(e.dnf&&e.dnf[id]&&e.dnf[id].why==="crash") t+='<span class="mx-tag mx-tag--dnf">DNF: crash, lap '+e.dnf[id].lap+"</span>";
  else if(e.crashes&&e.crashes[id]) t+='<span class="mx-tag mx-tag--cr">'+(e.crashes[id]>1?e.crashes[id]+" crashes":"crashed")+"</span>";
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
  var T=track(); if(T) T.show(false);
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
    if(nx.humanIn||final||cfg.others!=="sim") box.innerHTML='<button class="bg-btn bg-btn--primary bg-btn--lg" id="resNext" type="button">'+esc((nx.humanIn||(final&&!G.humans.length)?"Next: ":"Watch ")+nx.label)+"</button>"+(!nx.humanIn?'<button class="bg-btn bg-btn--secondary bg-btn--lg" id="resSim" type="button">Sim '+esc(nx.label)+"</button>":"");
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
  var nc=Array.isArray(L.cr)?L.cr.length:(L.cr|0);
  return head+(L.war?(L.war>1?warWordP(L.war)+": ":"War: "):"")+"#"+R.plate+" "+R.name+" wins with "+(typeof L.c==="number"?A.short(L.c):typeof L.wc==="number"?A.short(L.wc):"the top card")+" (+"+Math.max(0,(L.n|0)-1)+")"+(nc?" · "+plural(nc,"crash").replace("crashs","crashes")+", yellow flag":"");
}
function renderBoard(keep){
  var rc=ui.rc, box=$("boardSheet"); if(!rc||!G) return;
  var lap=rc.lastLap||null, order=ui.order.length?ui.order:RC.standings(rc).map(function(r){ return r.s; });
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; }), pre=ui.lapPre||null, c=G.cal[Math.min(G.ri,G.cal.length-1)];
  var rows=order.map(function(s,i){
    var R=G.riders[seatId(s)], p=rc.r[s], card=lap&&lap.c?lap.c[s]:null, war=lap&&lap.w?lap.w[s]:null, d=pre&&!p.out?counts[s]-pre[s]:null;
    var warH=war?war.map(function(w){ return '<span class="mx-bd__war">'+(w[0]?w[0]+" down ":"")+(w[1]!=null?cardChip(w[1]):"")+"</span>"; }).join(""):"";
    var win=lap&&lap.win===s, crk=lap&&lap.cr?lap.cr.filter(function(x){ return x.s===s; })[0]:null;
    return '<li class="'+(R.kind==="human"?"is-me ":"")+(win?"is-win ":"")+(p.out?"is-out":"")+'"><span class="mx-bd__p">'+(i+1)+"</span>"+plateHTML(R)+'<span class="mx-bd__n">'+esc(R.name)+'</span><span class="mx-mk mx-bd__mk" style="'+A.mkStyle(R.bike)+'">'+esc(R.bike||"")+"</span>"+
      '<span class="mx-bd__c">'+(card!=null?cardChip(card):p.out?'<span class="mx-bd__x">'+(p.dnf&&p.dnf.why==="crash"?"DNF":"out")+'</span>':"")+warH+(crk?'<span class="mx-bd__x mx-bd__cr">'+(crk.kind==="out"?"crash: out":"crash")+"</span>":"")+'</span><span class="mx-bd__k">'+(p.out?"0":counts[s])+'</span><span class="mx-bd__d'+(d>0?" is-up":d<0?" is-dn":"")+'">'+(d==null||d===0?"":(d>0?"+":"")+d)+"</span></li>";
  }).join("");
  var laps=(rc.laps||[]).slice(-8).reverse().map(function(L){ return "<li>"+esc(lapLine(L))+"</li>"; }).join("")||"<li>The first lap is still to come.</li>";
  var eye=(c.city||c.venue)+" · "+ui.label+" · "+(rc.phase==="gate"?"on the gate":"lap "+Math.min(lap?lap.b:0,rc.o.len)+" of "+rc.o.len), sub=lap?lapLine(lap):"The gate hasn't dropped yet: the cards turn on lap 1.";
  /* a refresh while it is open changes the contents only: the button (and the remote's ring on it) stays */
  var list=box.querySelector(".mx-bd");
  if(!keep||!list){
    box.innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow" id="boardEye"></span>'+
      '<h2 class="bg-sheet__title" id="boardTitle">Battle board</h2><p class="bg-sheet__sub" id="boardSub"></p></div>'+
      '<div class="mx-bdw"><div class="mx-bdw__main"><p class="mx-bd__h">Place · rider · the card turned this lap (and the war cards) · cards held · won or lost this lap</p>'+
      '<ol class="mx-bd"></ol></div><div class="mx-bdw__log"><h3 class="bg-eyebrow mx-bd__lh">Lap log</h3><ol class="mx-lapl"></ol><p class="mx-note mx-bdreal"></p></div></div>'+
      '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="boardClose" type="button">Back to the race</button></div>';
    $("boardClose").addEventListener("click",function(){ sheetClose($("boardBox"),"go"); });
    list=box.querySelector(".mx-bd");
  }
  var st=list.scrollTop;
  $("boardEye").textContent=eye; $("boardSub").textContent=sub;
  list.innerHTML=rows; list.style.setProperty("--bd-rows",String(Math.max(1,Math.ceil(order.length/2)))); list.scrollTop=st;
  box.querySelector(".mx-lapl").innerHTML=laps;
  var rl=box.querySelector(".mx-bdreal"); if(rl){ var nx=S.next(G); rl.innerHTML=nx&&nx.t==="race"?realLine(nx):""; }
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
function closeSheets(){ ["resBox","podBox","fullBox","newBox","boardBox","lineBox","skipBox","timesBox"].forEach(function(id){ var el=$(id); if(el.classList.contains("show")||(BG()&&BG().sheet&&BG().sheet.isOpen(el))) sheetClose(el,"go"); }); }
function hintSync(){
  var B=BG();
  if(luxe()) ["resBox","podBox","fullBox","newBox","boardBox","lineBox","skipBox","timesBox"].forEach(function(id){ var el=$(id); if(el&&el.classList.contains("show")&&!B.sheet.isOpen(el)) el.classList.remove("show"); });
  /* a sheet closed by Back on the TV (the podium, All riders): the ring goes back to the main action, never left on the page body */
  if(!onTV()) return;
  var tries=0;
  (function again(){
    if(tries++>6) return;
    setTimeout(function(){
      if(!G||setupShown()) return;
      if(sheetUp()||busy) return again();   /* a sheet still closing, or the next one opening: look again */
      var a=document.activeElement, shut=a&&a.closest&&a.closest("#resBox,#podBox,#fullBox,#newBox,#winBox,#boardBox,#lineBox,#skipBox,#timesBox");
      var fine=a&&a!==document.body&&a.isConnected&&!a.hidden&&!shut&&a.getClientRects().length&&(!a.checkVisibility||a.checkVisibility({visibilityProperty:true}));
      if(!fine) focusTV(mainControl());
    },tries===1?260:180);
  })();
}
document.addEventListener("bgui:sheet",function(){ setTimeout(updSync,120); });
document.addEventListener("bgui:sheet",hintSync); document.addEventListener("bgui:win",function(e){ if(e.detail&&!e.detail.open) hintSync(); });

/* ================= updates reach an open game (update.js: the CEO's phone ran the old 2D code for hours) ================= */
function updRacing(){ return !!(G&&ui.rc&&ui.view==="race"&&!ui.rc.over&&!setupShown()); }
/* the moments a reload loses nothing: the setup screen with no game, or the season screen with nothing open (the season is saved first) */
function updSafe(){
  if(busy||sheetUp()||updRacing()) return false;
  if(!G){ var a=document.activeElement; return !(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }
  return ui.view==="season"&&!setupShown();
}
function updSync(){
  var b=$("updBtn"), U=MX.Update; if(!b) return;
  var show=!!(U&&U.pending&&updRacing()); if(b.hidden===show){ b.hidden=!show; if(show) toast("A new version is ready: tap Update when you like.",{ms:3200}); }
  if(U) U.poke();
}
$("updBtn").addEventListener("click",function(){ if(MX.Update) MX.Update.apply(); });
if(MX.Update) MX.Update.init({safe:updSafe,onNew:updSync,beforeReload:function(){ try{ save(); }catch(e){} }});

/* ================= keys, the remote's Back ================= */
function backStep(){
  if(is3d()&&HUD&&HUD.isFull()&&!setupShown()){ HUD.hideFull(); focusTV(mainControl()); return "standings"; }
  if(!setupShown()&&G&&ui.view==="race"&&pipBig()){ setPip(false,true); return "cards"; }
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
if(MX.Update&&MX.Update.justUpdated()&&ui.cont) setTimeout(function(){ if(!G&&$("resumeBtn").style.display!=="none") $("resumeBtn").click(); },80);   /* an update reload: straight back into the season */
if("serviceWorker" in navigator){ navigator.serviceWorker.register("sw.js").catch(function(){}); }
window.__mxwar={get v3(){ return V3; },get hud(){ return HUD; },hudTick:hudTick,setCards:setCards,is3d:is3d,to2d:to2d,get G(){ return G; },toSeason:function(){ ui.rc=null; setView("season"); drive(); },cfg:cfg,ui:ui,drive:drive,act:act,simNow:simNow,enterRace:enterRace,startSeason:startSeason,loadSeason:loadSeason,
  state:function(){ return {busy:busy,gen:gen,view:ui.view,intent:intent,phase:ui.rc?ui.rc.phase:null,battle:ui.rc?ui.rc.battle:null,over:G?G.over:null,finished:ui.finished,winShown:ui.winShown}; }};
})();
