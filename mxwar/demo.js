/* MOTOCROSS WAR: the in-engine DEMO (demo.html). A live race with the game's own engine and the 3D view: the 2026 AMA Supercross season's Anaheim 1
   Main Event field (22 real riders; the human "You" takes the last gate, as in the game), the real traced Anaheim 1 layout, the cards (race.js)
   deciding every lap through the same events the game sends to the view (the lap's order, the cards held, the crashes), and the camera presets.
   DEMO.step(dt, draw) advances everything by a FIXED time step (draw=false fast-forwards the same simulation without rendering): with the
   seeded engine, the view's seeded random source and its virtual clock, a run is exactly repeatable, so it can be recorded frame by frame
   (BG_demos/tools/record.js). In a normal browser the page just runs live (the view's own loop). */
(function(){
"use strict";
var MX=window.MXWar, S=MX.Season, RC=MX.Race, RD=MX.Round, A=MX.Art, IDX=window.MXWarIndex, DATA=window.MXWarData;
var q=new URLSearchParams(location.search);
function $(id){ return document.getElementById(id); }
var cfg={
  demo:q.get("demo")||"chase", quality:q.get("q")||"quality", seed:+(q.get("seed")||2026), you:q.get("you")!=="0", live:q.get("live")==="1"||!q.has("record"),
  record:q.has("record"), you_num:+(q.get("num")||99), you_bike:q.get("bike")||"Honda", pre:+(q.get("pre")||2.2)
};
var DEMO=window.DEMO={ready:false,cfg:cfg,log:[]};
function say(){ try{ console.log.apply(console,arguments); }catch(e){} }

/* the lap time of a round from its layout, as the game's page sets it (the season sizes the race lengths with it) */
var lapCache={};
MX.lapTime=function(series,year,cal){
  try{ var pick=MX.Tracks.forRound(series,year,cal||{}), k=pick.key; if(lapCache[k]==null) lapCache[k]=MX.Tracks.course(series,year,cal||{},{gate:series==="mx"?40:22}).C.Tlap; return lapCache[k]; }catch(e){ return 0; }
};

/* ---------- the season, the round, the Main Event field ---------- */
var D=DATA["sx-2026"], G, rc, ent, V=null, cal, seatIds=[];
function buildRace(){
  G=S.newSeason(D,IDX,{},cfg.you?[{name:"You",num:cfg.you_num,bike:cfg.you_bike}]:[],cfg.seed);
  cal=G.cal[0];
  S.startRound(G);
  var RGm=G.round, main=RGm.races.filter(function(r){ return r.st<0; })[0];
  var len=main?main.len:18;
  /* the real Anaheim 1 entry (22 riders): the people ride, the rest of the field is the real entry list in the order of the season's real final standings */
  ent=G.humans.concat(cal.entry.slice(0,22-G.humans.length));
  var pos=function(id){ var r=G.riders[id]; return r.kind==="human"?20:(r.pos!=null?r.pos:500); };
  ent.sort(function(a,b){ return pos(a)-pos(b); });
  var o=JSON.parse(JSON.stringify(G.o.war)); o.len=len;
  rc=RC.newRace(o,ent.map(function(id){ var R=G.riders[id]; return {id:id,name:R.name,human:R.kind==="human",edge:R.edge|0}; }),(cfg.seed*7919+13)>>>0);
  rc.kind="main"; seatIds=ent.slice();
  DEMO.len=len;
}
function rider(s){ return G.riders[seatIds[s]]; }
function accentOf(make){ var m=A.mk(make); return m[0]==="#f2f4f8"?"#183a8c":m[1]==="#0b0a12"?"#1b1b20":"#f2f2f6"; }
/* the red plate: the championship leader (round 1 has none: the demo gives it to the real 2026 champion so the plate is on show) */
function redSeat(){ var best=-1, bp=1e9; seatIds.forEach(function(id,s){ var r=G.riders[id]; if(r.kind!=="human"&&r.pos!=null&&r.pos<bp){ bp=r.pos; best=s; } }); return best; }

/* ---------- the engine -> the view, as the game's send3d does ---------- */
var evBatch=[], lastLap=null, warFlashUntil=0, bannerQ=[];
function runBattle(){
  if(!rc||rc.over||!V) return;
  var ev=[];
  if(rc.phase==="gate") ev=ev.concat(RC.step(rc));   /* the gate drops: the first battle begins */
  ev=ev.concat(RC.battle(rc));
  evBatch=ev;
  var crashes=[], sector=0.5, win=-1, war=0;
  ev.forEach(function(e){ if(e.e==="yellow"&&e.sector!=null) sector=e.sector; if(e.e==="win"){ win=e.s; war=e.war; } });
  ev.forEach(function(e){ if(e.e==="crash") crashes.push({s:e.s,kind:e.kind,depth:e.depth,by:e.by,sector:sector}); });
  var L=RC.standings(rc), outs={}; rc.r.forEach(function(p,s){ if(p.out) outs[s]=1; });
  V.result({lap:rc.battle,order:L.map(function(x){ return x.s; }),counts:rc.r.map(function(p){ return p.pk.length; }),outs:outs,crashes:crashes,winner:win,war:war|0,last:rc.over||rc.battle>=rc.o.len,len:rc.o.len});
  lastLap={b:rc.battle,win:win,war:war|0,crashes:crashes,lap:rc.lastLap,cards:(rc.lastLap&&rc.lastLap.c)||{}};
  DEMO.log.push({lap:rc.battle,win:win,war:war|0,crashes:crashes.map(function(c){ return c.s+":"+c.kind; })});
  hudLap();
}

/* ---------- the view ---------- */
function setup(){
  buildRace();
  var host=$("host");
  V=MX.Race3D.create(host,{onBanner:onBanner,onNeed:function(lap){ if(V.resLap<lap) runBattle(); }});
  if(!V){ $("fatal").style.display="grid"; DEMO.error="no webgl"; return; }
  window.V=V;
  V.seed(cfg.seed); if(cfg.record) V.virtual(true);
  if(V.setQuality) V.setQuality(cfg.quality);
  var pick=V.setTrack(G.series,G.year,cal,rc.n);
  DEMO.track=pick&&pick.layout?{id:pick.layout.id,name:pick.layout.name,status:pick.layout.status,lengthM:pick.layout.lengthM}:null;
  var red=redSeat();
  V.setRiders(rc.r.map(function(p,s){ var R=G.riders[seatIds[s]]; return {s:s,color:A.mk(R.bike)[0],accent:accentOf(R.bike),plate:R.plate,red:s===red,me:R.kind==="human",name:R.name,make:R.bike}; }));
  V.atGate(rc.o.len); DEMO.you=seatIds.reduce(function(a,id,i){ return G.riders[id].kind==="human"?i:a; },-1); DEMO.seats=seatIds.length;
  $("cardName").textContent=(cal.city||"")+" "+(G.cal[0].n===1?"1":""); $("cardSub").textContent=(cal.venue||"")+" · "+G.year;
  buildTower(); drawMini(true);
  if(V.setCamera) V.setCamera(cfg.demo==="broadcast"?"broadcast":cfg.demo==="grandstand"?"grandstand":cfg.demo==="onboard"?"onboard":cfg.demo==="replay"?"replay":"chase");
  camChip();
  DEMO.ready=true;
  DEMO.t=0; DEMO.dropped=false;
  hudLap(); hudUpdate();
  if(cfg.live) live();
}
function onBanner(b){
  if(b.kind==="holeshot"){ var s=lastLap?lastLap.win:-1; /* the holeshot banner names the rider the engine's first battle gave it to */ var hs=rc.hs>=0?rc.hs:s; if(hs>=0){ var R=rider(hs); banner("Holeshot","#"+R.plate+" "+R.name+" · "+R.bike,1800,""); } }
  else if(b.kind==="crash"&&b.seat>=0){ var R2=rider(b.seat); banner(b.out?"Crash: out of the race":"Crash!","#"+R2.plate+" "+R2.name+" · yellow flag"+(b.out?"":" · back up and riding"),2600,"yellow"); }
}
function banner(t,sub,ms,cls){ var b=$("banner"); b.className=cls||""; b.querySelector("b").textContent=t; b.querySelector("span").textContent=sub||""; b.classList.add("on"); clearTimeout(banner.t); DEMO.bannerUntil=(DEMO.vclock||0)+ms/1000; if(!cfg.record) banner.t=setTimeout(function(){ b.classList.remove("on"); },ms); }

/* ---------- the overlay ---------- */
var rowEls=[];
function buildTower(){
  var ol=$("rows"); ol.innerHTML=""; rowEls=[];
  var H=(window.innerHeight||720), rowh=Math.max(15,Math.min(34,Math.floor(H*0.82*0.84/(rc.n+1.2))));
  ol.style.setProperty("--rowh",rowh+"px"); $("tower").style.fontSize=Math.max(11,Math.round(rowh*0.66))+"px";
  for(var i=0;i<rc.n;i++){ var li=document.createElement("li"); li.innerHTML='<span class="p"></span><span class="n"></span><span class="m"></span><span class="g"></span>'; ol.appendChild(li); rowEls.push(li); }
}
function hudLap(){ var lap=Math.min(Math.max(1,V&&V.lap||1),rc.o.len); $("lapTxt").textContent="Lap "+lap+" / "+rc.o.len; }
var lastBoardKey="";
function hudUpdate(){
  if(!V||!V.board) return;
  var B=V.board(), me=-1, k="";
  for(var i=0;i<B.length;i++){ var b=B[i], li=rowEls[i], R=rider(b.s); if(!li) continue;
    li.className=(R.kind==="human"?"me ":"")+(b.out?"out ":"")+(b.s===redSeat()?"red":"");
    li.children[0].textContent=i+1; var n=li.children[1]; n.textContent=R.plate; n.style.setProperty("--mk",A.mk(R.bike)[0]);
    li.children[2].textContent=(R.name.split(" ").slice(-1)[0]); li.children[3].textContent=b.out?"OUT":(i===0?"leader":"+"+b.gap.toFixed(1));
    if(R.kind==="human"){ me=i; } }
  if(me>=0){ var m=B[me]; $("youPos").innerHTML=(me+1)+"<small>"+ord(me+1)+"</small>"; $("youLbl").textContent="You · lap "+Math.min(Math.max(1,V.lap),rc.o.len)+" of "+rc.o.len;
    $("youGap").textContent=me===0?"Leading":(B[me-1]?"+"+(m.gap-B[me-1].gap).toFixed(1)+" s to the rider ahead":""); }
  else { $("youLbl").textContent="Leader"; $("youPos").textContent=rider(B[0].s).name.split(" ").slice(-1)[0].toUpperCase(); $("youGap").textContent=""; }
  var sp=V.speedOf?V.speedOf(V.focusSeat?V.focusSeat():-1):0; $("spdN").textContent=Math.round(sp*2.23694);
  hudWar();
  if(DEMO.cardsT!=null){}
  drawMini(false);
}
function ord(n){ var s=["th","st","nd","rd"], v=n%100; return s[(v-20)%10]||s[v]||s[0]; }
function cardEl(id,cls){ var el=document.createElement("div"); el.className="cd"+(RC.isRed(id)?" r":"")+(cls?" "+cls:""); el.textContent=RC.shortName(id); return el; }
function hudWar(){
  var w=$("war"), c=$("warC"), t=$("warT"), b=$("warB");
  var lap=Math.min(Math.max(1,V.lap),rc.o.len);
  t.textContent="Lap "+lap+" · cards";
  if(!lastLap){ c.innerHTML='<div class="vs">The cards turn as the gate drops.</div>'; b.textContent=""; w.classList.remove("flash"); return; }
  var key=lastLap.b+"|"+(V.resLap|0); if(w._k===key) return; w._k=key;
  c.innerHTML="";
  var lc=lastLap.cards, win=lastLap.win, me=seatIds.reduce(function(a,id,s){ return G.riders[id].kind==="human"?s:a; },-1), focus=me>=0?me:win;
  if(focus>=0&&lc[focus]!=null) c.appendChild(cardEl(lc[focus]));
  if(win>=0&&win!==focus&&lc[win]!=null) c.appendChild(cardEl(lc[win],"w"));
  var d=document.createElement("div"); d.className="vs";
  var wr=win>=0?rider(win).name.split(" ").slice(-1)[0]:"nobody";
  d.innerHTML=(lastLap.war>=2?"<b>"+(lastLap.war>2?"Triple":"Double")+" war</b><br>":lastLap.war===1?"<b>War</b><br>":"")+"<b>"+wr+"</b> takes lap "+lastLap.b;
  c.appendChild(d); b.textContent=lastLap.war>=1?"WAR":"";
  w.classList.toggle("flash",lastLap.war>=1);
}
var miniPts=null;
function drawMini(first){
  var cv=$("mini"), x=cv.getContext("2d"), C=V&&V.C; if(!C) return;
  if(first||!miniPts){ var minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9; for(var i=0;i<C.N;i+=2){ minx=Math.min(minx,C.x[i]); maxx=Math.max(maxx,C.x[i]); minz=Math.min(minz,C.z[i]); maxz=Math.max(maxz,C.z[i]); }
    var W=cv.width, H=cv.height, pad=14, k=Math.min((W-pad*2)/(maxx-minx),(H-pad*2)/(maxz-minz)), ox=(W-(maxx-minx)*k)/2-minx*k, oz=(H-(maxz-minz)*k)/2-minz*k;
    miniPts={k:k,ox:ox,oz:oz,path:[]}; for(i=0;i<C.N;i+=3) miniPts.path.push([C.x[i]*k+ox,C.z[i]*k+oz]); }
  x.clearRect(0,0,cv.width,cv.height);
  x.lineJoin="round"; x.lineCap="round"; x.beginPath(); miniPts.path.forEach(function(p,i){ if(i) x.lineTo(p[0],p[1]); else x.moveTo(p[0],p[1]); }); x.closePath();
  x.strokeStyle="rgba(0,0,0,.6)"; x.lineWidth=9; x.stroke(); x.strokeStyle="#7b4a2b"; x.lineWidth=6; x.stroke(); x.strokeStyle="#b6824c"; x.lineWidth=2; x.stroke();
  if(V.poseList){ V.poseList().forEach(function(p){ var R=rider(p.s); x.beginPath(); x.arc(p.x*miniPts.k+miniPts.ox,p.z*miniPts.k+miniPts.oz,R.kind==="human"?5.2:3.4,0,6.3); x.fillStyle=A.mk(R.bike)[0]; x.fill(); x.lineWidth=1.4; x.strokeStyle=R.kind==="human"?"#ecb967":"rgba(0,0,0,.75)"; x.stroke(); }); }
}
var CAMNAME={chase:"Cover chase",broadcast:"Broadcast trackside",grandstand:"Grandstand · full track",onboard:"Onboard",replay:"Replay"};
function camChip(){ var c=$("cam"); c.textContent=CAMNAME[(V&&V.camera&&V.camera())||cfg.demo]||""; c.classList.remove("fade"); clearTimeout(camChip.t); if(!cfg.record) camChip.t=setTimeout(function(){ c.classList.add("fade"); },3500); }

/* ---------- the clock: the gate shot, then the engine drives the race ---------- */
var preT=0;
function advance(dt){
  DEMO.t+=dt; DEMO.vclock=(DEMO.vclock||0)+dt;
  if(!DEMO.dropped){ preT+=dt; if(preT>=cfg.pre){ DEMO.dropped=true; runBattle(); } }
}
DEMO.step=function(dt,draw){
  if(!V) return; advance(dt); V.step(dt,draw!==false);
  if(draw!==false) hudUpdate();
  if(DEMO.bannerUntil!=null&&DEMO.vclock>DEMO.bannerUntil&&cfg.record){ $("banner").classList.remove("on"); DEMO.bannerUntil=null; }
};
/* n seconds of the same simulation without drawing (a fast-forward between the recorded windows) */
DEMO.skip=function(sec,dt){ dt=dt||1/30; var n=Math.round(sec/dt); for(var i=0;i<n;i++) DEMO.step(dt,false); hudUpdate(); };
/* a free camera round a rider, for stills of the models: back / up / side in metres from the bike's position (in its heading), aim = height of the look-at point */
DEMO.rig=function(seat,back,up,side,aim,fov,ahead){
  var p=V.poseList().filter(function(q){ return q.s===seat; })[0]; if(!p) return null;
  var tx=p.tx, tz=p.tz, rx=-tz, rz=tx, g=p.gl!=null?p.gl:p.y;
  var cam={eye:[p.x-tx*back+rx*side,g+up,p.z-tz*back+rz*side],tgt:[p.x+tx*(ahead||0),g+aim,p.z+tz*(ahead||0)],fov:fov||0.9,sRad:10,dof:0.5,focus:[p.x,g+0.8,p.z]};
  V.freeCam(cam); return cam;
};
DEMO.camera=function(name){ if(V.setCamera) V.setCamera(name); camChip(); };
DEMO.state=function(){ return V?V.state():null; };
DEMO.shot=function(){ return V?V.debugCam():null; };
/* live: the view's own loop with the real clock */
function live(){ V.show(true); (function loop(){ if(!document.hidden) hudUpdate(); setTimeout(loop,250); })();
  setTimeout(function(){ if(!DEMO.dropped){ DEMO.dropped=true; runBattle(); } },cfg.pre*1000); }

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",setup); else setup();
})();
