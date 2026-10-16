/* MOTOCROSS WAR — the page controller: setup (series, the YEAR picker with a big preview, riders with name, number and team, race length,
   War's rules, Game speed, Continue), the SEASON screen (calendar done / next, championship and team standings 1..N, Save), the RACE screen
   (the starting gate, the holeshot, every battle a War flip, the live timing tower, the lap counter, the checkered flag), results with who
   advances and the points, the round podium, the season champion (Victory). The rules live in race.js / round.js / season.js (pure, no
   DOM), the riders' character in brain.js, the art in art.js; this file only drives and shows them.
   - War has no first player (everyone turns a card at once): the opening show of every race is the starting gate (race.js firstPlayer:
     rule "none", show "gate"). There is no track of spaces either: the bikes on the start straight stand where their card count puts them.
   - Every batch of engine events is played in order (the gate, the reveal, a war's 3 down + the 4th, the win, the holeshot, the flag), then
     the race is drawn again from G. The person's Flip is queued while a battle plays, so a tap is never lost; Auto-flip turns for them.
   - Saves after every action (Saves.auto "mxwar"); the season is plain JSON, so Continue resumes it exactly, mid-race too. */
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
  checkflag:'<path d="M5 21V4"/><path d="M5 4h13l-2.5 4L18 12H5"/><path d="M9 4v8M13 4v8M5 8h11"/>'
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
var cfg={series:"sx",sid:null,humans:1,length:"standard",speed:"medium",skill:"normal",auto:false,others:"ask",fill:"full",nonTitle:true,war:{}};
var G=null, gen=0, timer=null, busy=false, intent=0;
var ui={view:"season",rc:null,finished:-1,winShown:-1,result:false,rulesOpen:false,cont:false,order:[],lap:0,lastCards:{},bikes:{},sayN:0,
  pendRound:null,pendSeason:null,lastDone:null,showAll:false,shown:false,sheetGo:null,log:[],flipBusy:false,newOk:false};
var disp=null;   // the counts on show while a battle plays (they follow the cards, not the engine)
var LONG={sx:"AMA Supercross",mx:"AMA Pro Motocross",smx:"SuperMotocross Playoffs"};
var SHORTS={sx:"Supercross",mx:"Motocross",smx:"SMX Playoffs"};
var LEN_NAME={short:"Short",standard:"Standard",long:"Long"};

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
    extra:function(i){ var r=rx(i); return '<div class="mx-rx"><label>Number<input class="bg-input" type="text" inputmode="numeric" maxlength="3" autocomplete="off" data-rx="num" data-i="'+i+'" value="'+esc(r.num)+'" placeholder="Any"></label>'+
      '<label>Team<select class="bg-select" data-rx="bike" data-i="'+i+'">'+bikeOptions(r.bike)+"</select></label></div>"; }});
  var nc=$("nameCard");
  nc.addEventListener("input",function(e){ var t=e.target; if(!t.getAttribute||t.getAttribute("data-rx")!=="num") return; var v=cleanNum(t.value); if(v!==t.value) t.value=v; rx(+t.getAttribute("data-i")).num=v; writeRiders(); });
  nc.addEventListener("change",function(e){ var t=e.target, k=t.getAttribute&&t.getAttribute("data-rx"); if(!k) return; var r=rx(+t.getAttribute("data-i")); if(k==="bike") r.bike=t.value; else r.num=cleanNum(t.value); writeRiders(); });
}
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
    top.map(function(r){ return '<li><span class="mx-pv__rk">'+r.pos+'</span><span class="mx-pl" style="'+A.mkStyle(r.bike)+'">'+(r.num!=null?r.num:"-")+'</span><span class="mx-pv__nm">'+esc(r.name)+'</span>'+(r.bike?'<span class="mx-mk" style="'+A.mkStyle(r.bike)+'">'+esc(r.bike)+"</span>":"")+"</li>"; }).join("")+"</ol></div>";
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
    box.innerHTML=segHTML([["short","Short"],["standard","Standard"],["long","Long"]],cfg.length,"data-l");
    box.querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.length=b.dataset.l; drawSetup(); }); });
  });
  var L=RD.LEN[cfg.length]||RD.LEN.standard, si=seasonInfo(cfg.sid), mx=si&&si.series==="mx";
  var mins={short:mx?"about 4":"about 5",standard:mx?"about 6":"about 8",long:mx?"about 8":"about 11"}[cfg.length];
  $("lengthDesc").innerHTML=(mx?"<b>Moto "+L.moto+" battles</b> each, two motos a round.":"<b>Heat "+L.heat+" · LCQ "+L.lcq+" · Main "+L.main+" battles</b> (semis "+L.semi+" where the year had them).")+
    " Every battle is a lap; wars play out in full and don't count extra. At the flag the most cards wins. A round takes "+mins+" minutes at Medium when you watch your own races and sim the rest.";
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
$("speedSeg").querySelectorAll("button").forEach(function(b){ b.addEventListener("click",function(){ cfg.speed=b.dataset.s; setSpeedSeg(); save(); }); });
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
    armBack();
    if(!busy) drive();
  }
  barTitle();
  var B=BG(); if(luxe()&&B.toast&&B.toast.place) B.toast.place();
}
function setView(v,keepBody){
  ui.view=v; var b=document.body;
  b.classList.toggle("mx-v-season",v==="season"); b.classList.toggle("mx-v-race",v==="race");
  var setup=setupShown();
  b.classList.toggle("bg-app--scene",setup||v==="season"); b.classList.toggle("bg-app--felt",!setup&&v==="race");
  if(keepBody) return;
  if(v==="season") renderSeason(); else { layoutArena(); renderRace(); }
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
  gen++; clearTimeout(timer); busy=false; intent=0;
  G=d.G; var c=d.cfg||{}; for(var k in c) if(Object.prototype.hasOwnProperty.call(cfg,k)) cfg[k]=c[k];
  cfg.speed=normSpeed(cfg.speed); setSpeedSeg(); cfg.skill=normSkill((G.o&&G.o.skill)||cfg.skill); setSkillSeg(); setAuto(cfg.auto);
  resetUI();
  ui.view=G.race?"race":"season"; ui.rc=G.race; ui.lap=0; ui.rmap=G.rmap?G.rmap.slice():null; ui.label=G.race?raceLabel():"";
  closeSheets(); closeWin();
  Sound.music(GAME);
  showSetup(false); drawSetup(); armBack();
  if(G.over){ ui.finished=gen; setView("season"); setTimeout(function(){ if(G&&G.over&&!setupShown()) openWin(); },300); }
}
function resetUI(){ ui.winShown=-1; ui.result=false; ui.finished=-1; ui.order=[]; ui.lastCards={}; ui.bikes={}; ui.pendRound=null; ui.pendSeason=null; ui.log=[]; ui.rc=null; ui.rmap=null; ui.hs=null; disp=null; $("lane").innerHTML=""; renderLog(); }
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
  s=s||{}; cfg.series=LONG[s.series]?s.series:"sx"; cfg.sid=s.sid||null; cfg.humans=s.humans!=null?clamp(+s.humans|0,0,8):1; cfg.length=RD.LEN[s.length]?s.length:"standard";
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
  var id=cfg.sid, my=++gen; clearTimeout(timer); busy=false; intent=0;
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
function plateHTML(R){ return '<span class="mx-pl'+(R.plateGen?" is-gen":"")+'" style="'+A.mkStyle(R.bike)+'" title="'+(R.plateGen?"Number made up for the game":"")+'">'+(R.plate!=null?R.plate:"-")+"</span>"; }
function nameHTML(R){ return esc(R.name)+(R.kind==="privateer"?' <span class="mx-priv">(privateer)</span>':""); }
function stRow(r,meIds,top){
  var R=rider(r.id), me=meIds.indexOf(r.id)>=0;
  return '<li class="'+(me?"is-me":"")+'"><span class="mx-st__p">'+r.place+"</span>"+plateHTML(R)+'<span class="mx-st__n">'+nameHTML(R)+"</span>"+(me?'<span class="mx-you">'+(G.humans.length>1?"P"+(R.seat+1):"You")+"</span>":"")+
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
    res.cls.forEach(function(id,p){ var R=G.riders[id], b=R&&R.bike; if(!b||seen[b]) return; seen[b]=1;
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
  if(ui.goSim){ simNow(); return; }
  enterRace();
});
$("simBtn").addEventListener("click",function(){ if(!G||busy||G.over) return; simNow(); });
$("saveBtn").addEventListener("click",function(){ if(!G||G.over) return; var ok=Saves.put(GAME,"save",pack()); toast(ok?"Season saved: Load saved game brings it back":"Couldn't save (storage blocked?)",{icon:"save"}); saveBar.refresh(); });
$("fullBtn").addEventListener("click",function(){
  var L=S.standings(G), top=L.length?L[0].pts:0;
  $("fullSheet").innerHTML='<div class="bg-sheet__grip" aria-hidden="true"></div><div class="mx-shd"><span class="bg-eyebrow">'+esc(G.year+" "+LONG[G.series])+'</span><h2 class="bg-sheet__title" id="fullTitle">All riders</h2></div>'+
    '<ol class="mx-res">'+L.map(function(r){ var R=rider(r.id), me=G.humans.indexOf(r.id)>=0; return '<li class="'+(me?"is-me":"")+(onTV()?" bg-focus":"")+'"'+(onTV()?' data-focus tabindex="-1"':"")+'><span class="mx-res__p">'+r.place+"</span>"+plateHTML(R)+'<span class="mx-res__n">'+nameHTML(R)+'</span><span class="mx-res__x">'+r.pts+" pts"+(r.place>1?" · -"+(top-r.pts):"")+"</span></li>"; }).join("")+"</ol>"+
    '<div class="mx-sacts"><button class="bg-btn bg-btn--primary bg-btn--lg" id="fullClose" type="button">Close</button></div>';
  sheetOpen($("fullBox"),{focus:"#fullClose"});
  $("fullClose").addEventListener("click",function(){ sheetClose($("fullBox")); });
});

/* ================= the race: build, lay out, draw ================= */
function raceLabel(){ if(!G||!G.round) return ""; var k=G.rkey; var r=G.round.races.filter(function(x){ return x.key===k; })[0]; return r?r.label:""; }
function enterRace(){
  if(!G||G.over) return;
  if(!G.race){ S.startRace(G); }
  ui.rc=G.race; ui.rmap=G.rmap.slice(); ui.label=raceLabel(); ui.hs=null; ui.lap=0; ui.lastWin=null; disp=null; ui.lastCards={}; ui.bikes={}; ui.order=[]; ui.flagged=false;
  $("lane").innerHTML="";
  save();
  setView("race");
  logLine((G.cal[G.ri].city||G.cal[G.ri].venue)+" "+ui.label+": "+ui.rc.n+" riders behind the gate.");
  drive();
}
function raceHumans(){ var rc=ui.rc; if(!rc) return []; var a=[]; rc.r.forEach(function(p,s){ if(p.human) a.push(s); }); return a; }
function humansAlive(){ var rc=ui.rc; return raceHumans().filter(function(s){ return !rc.r[s].out&&rc.r[s].pk.length>0; }); }
var GEO=null;
function layoutArena(){
  var ar=$("arena"), W=ar.clientWidth, H=ar.clientHeight; if(!W||!H) return false;
  var rem=remPx(), tv=onTV(), laneH=Math.round(H*(H<rem*16?0.36:0.38));
  ar.style.setProperty("--lane-h",laneH+"px");
  var th=H-laneH, cw=Math.round(Math.min((th-rem*(tv?3.4:3.3))/1.4,W*0.2,rem*(tv?7.5:7)));
  cw=Math.max(cw,tv?Math.round(2.6*rem):36);
  $("table").style.setProperty("--cw",cw+"px");
  var you=$("youSlot"), top=$("topSlot"), mid=$("midNote");
  you.style.left="24%"; top.style.left="76%"; you.style.top=top.style.top=Math.round(rem*.35)+"px";
  you.style.width=top.style.width=Math.round(W*.4)+"px";
  mid.style.top=Math.round(th*.48)+"px";
  var mw=Math.round(rem*(tv?4.4:3.5)), mh=Math.round(rem*(tv?1.9:1.55));
  GEO={W:W,H:H,laneH:laneH,cw:cw,mw:mw,mh:mh,lanes:Math.max(2,Math.min(5,Math.floor((laneH-rem*.5)/mh))),gateX:0};
  var cols=Math.ceil(Math.min(shownIds().length||11,15)/GEO.lanes);
  GEO.gateX=Math.round(Math.min(W*.5,cols*(mw*.82)+rem*.6));
  var gt=$("gate"); gt.style.left=GEO.gateX+"px";
  if(!gt.firstChild) gt.innerHTML=A.gate();
  return true;
}
/* the bikes on the start straight: the top 10 and the people, placed by their share of the leader's cards (the gaps in cards) */
function shownIds(){
  var rc=ui.rc; if(!rc) return [];
  var ord=ui.order.length?ui.order:rc.r.map(function(p,s){ return s; }), out=[], hs=raceHumans();
  var cap=10;
  if(GEO){ var per=Math.max(2,Math.floor((GEO.W-GEO.mw-remPx())/(GEO.mw*1.05))); cap=Math.max(3,Math.min(10,GEO.lanes*per-hs.length)); }
  ord.forEach(function(s){ if((out.length<cap&&hs.indexOf(s)<0)||hs.indexOf(s)>=0) out.push(s); });
  hs.forEach(function(s){ if(out.indexOf(s)<0) out.push(s); });
  return out;
}
function bikeEl(s){
  var b=ui.bikes[s]; if(b&&b.isConnected) return b;
  var id=seatId(s), R=G.riders[id], c=A.mk(R.bike);
  b=document.createElement("div"); b.className="mx-bike"+(R.kind==="human"?" is-me":"");
  b.innerHTML=A.bike(c[0],c[0]==="#f2f4f8"?"#183a8c":"#f2f2f6")+'<span class="mx-pl" style="'+A.mkStyle(R.bike)+'">'+(R.plate!=null?R.plate:"-")+"</span>";
  $("lane").appendChild(b); ui.bikes[s]=b; return b;
}
function placeBikes(atGate){
  var rc=ui.rc; if(!rc||!GEO) return;
  var ids=shownIds(), keep={}, rem=remPx();
  var counts=disp?disp.cnt:rc.r.map(function(p){ return p.pk.length; });
  var max=1; counts.forEach(function(c,s){ if(!rc.r[s].out&&c>max) max=c; });
  var back=atGate?GEO.gateX+rem*.8:rem*.4, front=GEO.W-GEO.mw-rem*.4;
  ids.forEach(function(s,k){
    keep[s]=1; var b=bikeEl(s), x, y;
    if(atGate){ var col=Math.floor(k/GEO.lanes), ln=k%GEO.lanes; x=GEO.gateX-(col+1)*GEO.mw*.82-rem*.15; y=rem*.25+ln*GEO.mh; }
    else { var ord2=ui.order.indexOf(s), rk=ord2<0?k:ord2, ln2=rk%GEO.lanes, spread=1-Math.min(rk,ids.length-1)/Math.max(1,ids.length-1), share=clamp(counts[s]/max,0,1);
      x=rc.r[s].out?back:back+(front-back)*(.85*spread+.15*share); y=rem*.25+ln2*GEO.mh; }
    b.style.transform="translate("+Math.round(x)+"px,"+Math.round(y)+"px)";
    b.classList.toggle("is-out",!!rc.r[s].out);
    b.style.zIndex=String(100-k);
  });
  Object.keys(ui.bikes).forEach(function(s){ if(!keep[s]){ ui.bikes[s].remove(); delete ui.bikes[s]; } });
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
function whoHTML(s){ var id=seatId(s), R=G.riders[id]; return plateHTML(R)+'<span class="mx-sn">'+esc(R.name)+"</span>"+(R.kind==="human"&&G.humans.length===1?' <span class="mx-you">You</span>':""); }
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
  layoutArena(); placeBikes(gate);
  /* the cards on the table now (a war in progress is drawn as a war; else the last battle) */
  if(rc.phase==="war"&&rc.part&&rc.part.length) drawWar(rc.part,rc.tb,false);
  else { $("warRow").innerHTML=""; drawDuel(); }
  renderTower(null);
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
  $("lapChip").textContent=rc.phase==="gate"?"On the gate":"Lap "+Math.min(ui.lap,rc.o.len)+" / "+rc.o.len;
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
  var two=tv&&rows.length>20; tw.classList.toggle("is-two",two); if(two) tw.style.setProperty("--tw-rows",String(Math.ceil(rows.length/2))); else tw.style.removeProperty("--tw-rows");
  $("towerSub").textContent=tv||n<=10?n+" riders · cards held":"top 10"+(miss.length?" + you":"")+" of "+n+" · cards held";
}
function logLine(t){ if(!t) return; ui.log.push(t); if(ui.log.length>12) ui.log.shift(); renderLog(); }
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
  skip.hidden=rc.over||(hs.length&&alive.length>0);
  var lbl="Flip", sub="";
  if(gate){ lbl="Drop the gate"; sub=hs.length>1?"then every rider turns a card":""; }
  else if(rc.phase==="war"&&need.length){ lbl="War: 3 down, flip the 4th"; }
  if(need.length&&(G.humans.length>1)){ var R=G.riders[seatId(need[0])]; sub=R.name+" · #"+R.plate; }
  $("flipLabel").textContent=lbl; $("flipSub").textContent=sub; $("flipSub").hidden=!sub;
  f.disabled=false;
  var t="";
  if(rc.over) t="Checkered flag.";
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
$("skipBtn").addEventListener("click",function(){ if(!G||!ui.rc||ui.rc.over||busy) return; simNow(); });
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
    if(intent){ intent=0; act({t:"flip",s:need[0]}); return; }
    if(cfg.auto){ later(my,function(){ act({t:"flipAll"}); },dl(rc.phase==="war"?380:520)); return; }
    focusTV($("flipBtn"));
    return;
  }
  var wait=rc.phase==="war"?dl(420):Math.max(200,Math.round(BR.pace(G,cfg.speed)*(hs.length?0.6:1)));
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
      if(!reduced()&&gt.animate){
        try{ gt.animate([{transform:"rotate(0deg)"},{transform:"rotate(-84deg)"}],{duration:sp(320),easing:"cubic-bezier(.55,0,.85,.35)",fill:"forwards"}); }catch(x){}
        try{ du.animate([{opacity:0,transform:"translateX(0)"},{opacity:.95,offset:.3},{opacity:0,transform:"translateX(30%)"}],{duration:sp(900),easing:"ease-out"}); }catch(x){}
        await sleep(sp(340));
      }
      gt.style.display="none";
      ui.lap=1; chips(); placeBikes(false);
      await sleep(dl(250));
      return;
    }
    case "acted": { if(!e.auto&&isHumanId(seatId(e.s))){ Sound.sfx("click"); } return; }
    case "reveal": {
      if(e.w===0){
        ui.lastWin=null; $("warRow").innerHTML=""; $("youSlot").hidden=false; $("topSlot").hidden=false; $("midNote").hidden=false;
        e.cards.forEach(function(x){ ui.lastCards[x.s]=x.c; disp.cnt[x.s]=Math.max(0,disp.cnt[x.s]-1); });
        Sound.sfx("card");
        var h=focusHuman(), left=h>=0&&ui.lastCards[h]!=null?h:null;
        $("midBig").textContent="Lap "+Math.min(ui.lap,rc.o.len); $("midSmall").textContent="of "+rc.o.len;
        var best=bestOf(e.cards), ps=[];
        if(left!=null){ $("youWho").innerHTML=whoHTML(left); $("youLab").textContent=G.humans.length>1?"Card of":"Your card"; ps.push(flipCard($("youCard"),ui.lastCards[left],sp(360))); }
        else { var L0=ui.order.length?ui.order[0]:e.cards[0].s; $("youLab").textContent="Race leader"; $("youWho").innerHTML=whoHTML(L0); ps.push(flipCard($("youCard"),ui.lastCards[L0]!=null?ui.lastCards[L0]:null,sp(360))); }
        $("topCard").classList.remove("is-win");
        renderTower(null);
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
      Sound.sfx("cannon"); flash();
      var tiedR=rc.cur&&e.tied.length?A.info(ui.lastCards[e.tied[0]]).r:0;
      logLine((e.n>1?"War again! ":"War! ")+whoList(e.tied)+" tie"+(tiedR?" with "+rankPlural(tiedR):"")+".");
      drawWar(e.seats,null,true);
      renderTower({fight:e.seats});
      await banner(e.n>1?(e.n===2?"Double war!":"War again!"):"War!",whoList(e.tied)+(tiedR?" · "+rankPlural(tiedR):""),dl(e.n>1?700:850));
      return;
    }
    case "kitty": { logLine(nm(e.s)+" also takes "+plural(e.n,"left-over card")+"."); return; }
    case "short": { e.seats.forEach(function(s){ disp.cnt[s]=0; }); logLine(whoList(e.seats)+(e.seats.length>1?" don't":" doesn't")+" have enough cards for the war."); return; }
    case "deadlock": { logLine(whoList(e.seats)+" tie with their last cards: "+plural(e.n,"card")+" set aside."); await banner("Dead heat",plural(e.n,"card")+" set aside",dl(800),"is-calm"); return; }
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
      renderTower({win:e.s}); placeBikes(false);
      await sleep(dl(e.war?520:300));
      return;
    }
    case "holeshot": {
      ui.hs=e.s; chips(); Sound.sfx("bell");
      var hl=null; try{ hl=BR.react(G,e); }catch(x){} logLine(hl||"Holeshot: "+nm(e.s)+"!");
      var R=G.riders[seatId(e.s)];
      await banner("Holeshot!","#"+R.plate+" "+R.name+(R.bike?" · "+R.bike:""),dl(1100),"is-calm");
      return;
    }
    case "out": { e.seats.forEach(function(s){ disp.cnt[s]=0; }); logLine(whoList(e.seats)+(e.seats.length>1?" are":" is")+" out of cards."); if(e.seats.length===1) say(e); renderTower(null); placeBikes(false); return; }
    case "lead": { say(e); return; }
    case "next": { ui.lap=e.b; chips(); return; }
    case "flag": {
      ui.lap=Math.min(e.b,rc.o.len); chips();
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
  var vis=hs.concat(rest).slice(0,onTV()?5:4), more=seats.length-vis.length;
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
function banner(t,s,ms,cls,flagIcon){
  var b=$("banner");
  $("bannerT").innerHTML=(flagIcon?A.flag()+"<br>":"")+esc(t); $("bannerS").textContent=s||"";
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
function resultTags(e,id,p){
  var t="";
  if(e.toMain&&e.toMain.indexOf(id)>=0) t='<span class="mx-tag mx-tag--main">'+(e.kind==="lcq"||e.kind==="heat"||e.kind==="semi"||e.kind==="qual"?"to the "+(G.formats[G.fmt].finals.kind==="moto"?"motos":"Main"):"Main")+"</span>";
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
  sheetOpen($("resBox"),{focus:"#resNext, #resSim",onClose:function(reason){ if(reason!=="go"){ ui.rc=null; ui.pendRound=null; if(!setupShown()){ setView("season"); drive(); } } }});
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

/* ================= sheets ================= */
function sheetOpen(el,o){ var B=BG(); el.classList.add("show"); if(luxe()&&!B.sheet.isOpen(el)) B.sheet.open(el,o); else if(!luxe()){ var f=el.querySelector((o&&o.focus)||"button"); if(f) try{ f.focus(); }catch(e){} } }
function sheetClose(el,reason){ var B=BG(); el.classList.remove("show"); if(B&&B.sheet&&B.sheet.isOpen(el)) B.sheet.close(el,reason); }
function closeSheets(){ ["resBox","podBox","fullBox","newBox"].forEach(function(id){ var el=$(id); if(el.classList.contains("show")||(BG()&&BG().sheet&&BG().sheet.isOpen(el))) sheetClose(el,"go"); }); }
function hintSync(){
  var B=BG();
  if(luxe()) ["resBox","podBox","fullBox","newBox"].forEach(function(id){ var el=$(id); if(el&&el.classList.contains("show")&&!B.sheet.isOpen(el)) el.classList.remove("show"); });
}
document.addEventListener("bgui:sheet",hintSync);

/* ================= keys, the remote's Back ================= */
function backStep(){
  if(!setupShown()&&G){ $("menuBtn").click(); return "menu"; }
  if(G&&$("resumeBtn").style.display!=="none"&&!ui.cont){ $("resumeBtn").click(); return "resume"; }
  return false;
}
document.addEventListener("visibilitychange",function(){ if(!document.hidden&&G&&!busy) drive(); });
var rsz=0;
window.addEventListener("resize",function(){ clearTimeout(rsz); rsz=setTimeout(function(){ if(!G||setupShown()) return; if(ui.view==="race"&&ui.rc){ layoutArena(); if(!busy) renderRace(); else placeBikes(ui.rc.phase==="gate"); } else if(ui.view==="season") renderSeason(); },140); });

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
  state:function(){ return {busy:busy,gen:gen,view:ui.view,intent:intent,phase:ui.rc?ui.rc.phase:null,battle:ui.rc?ui.rc.battle:null,over:G?G.over:null,finished:ui.finished,winShown:ui.winShown}; }};
})();
