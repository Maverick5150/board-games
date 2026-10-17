/* MOTOCROSS WAR 3D — the race screen's overlay (the CEO 2026-10-17 07:40: "People are going to be watching the standings ... all 40 riders ...
   everything has to fit on the screen. There can't be no scrolling down"; the visual pack's 06 gameplay HUD + 07 full 40-rider standings):
   window.MXWar.Hud.create({root, rider, tv}) -> H. The race is the show and the cards run behind it:
   - a SMALL timing tower in the top-left corner (the lap, the top riders and you; the red plate, team colours, gaps in seconds), never over
     the bikes' road;
   - the FULL standings: EVERY rider at once in two columns (places 1..N, number plate in the team colour, name, gap, cards held), the rows
     sized to fit the screen (no scrolling at 40 riders): on a button / the remote's Menu key, and by itself for a few seconds each time the
     leader crosses the line and at the flag;
   - the event pill (bottom centre): the tiny flash when a war happens and the lap's news ("Lap 6: you move up to 4th").
   Pure DOM over the 3D canvas; the data comes from the view's live running order (race3d.js rows()), so the tower shows what the camera shows.
   opt.rider(seat) -> {plate: html, name, short, me, red, make} ; opt.tv() -> true on the TV. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Hud) return;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function ord(n){ var t=n%100; return n+((t>=11&&t<=13)?"th":(["th","st","nd","rd"][n%10]||"th")); }
/* a gap in seconds as a timing tower writes it: +3.2 / +1:05 / +1 lap */
function gapText(r){
  if(r.out) return r.dnf?"DNF":"OUT";
  if(r.crash) return "DOWN";
  if(r.lap>0) return "+"+r.lap+(r.lap>1?" laps":" lap");
  var g=r.gap; if(!(g>0.049)) return "";
  if(g>=100){ var m=Math.floor(g/60), s=Math.round(g-m*60); if(s>=60){ m++; s=0; } return "+"+m+":"+(s<10?"0":"")+s; }
  return "+"+(Math.round(g*10)/10).toFixed(1);
}
function create(opt){
  var root=opt.root; if(!root) return null;
  var H={on:false,rows:[],st:{},meta:{},pinned:false,popT:0,evtT:0,full:false,box:null};
  function el(tag,cls,html){ var e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; }
  /* the pieces (built once, inside the arena over the 3D view) */
  var wrap=el("div","mx-h"); wrap.setAttribute("aria-hidden","true");
  var tl=el("div","mx-h-tl"), lapEl=el("div","mx-h-lap"), twEl=el("ol","mx-h-tw"); tl.appendChild(lapEl); tl.appendChild(twEl);
  var tr=el("div","mx-h-tr"), trk=el("div","mx-h-trk"); tr.appendChild(trk);
  var evt=el("div","mx-h-evt"); evt.setAttribute("role","status"); evt.setAttribute("aria-live","polite");
  var full=el("div","mx-h-full"), fh=el("div","mx-h-full__h"), fcols=el("div","mx-h-full__cols"); full.appendChild(fh); full.appendChild(fcols); full.hidden=true;
  wrap.appendChild(tl); wrap.appendChild(tr); wrap.appendChild(evt); wrap.appendChild(full);
  root.appendChild(wrap);
  H.el={wrap:wrap,tl:tl,tr:tr,trk:trk,evt:evt,full:full};
  function tv(){ return opt.tv?opt.tv():document.documentElement.hasAttribute("data-tv"); }
  function rem(){ return parseFloat(getComputedStyle(document.documentElement).fontSize)||16; }

  /* ---- the race (names, the lap count) ---- */
  H.race=function(meta){ H.meta=meta||{}; H.rows=[]; H.st={}; H.hideFull(); lastTw=""; lastFull=""; trk.innerHTML=H.meta.track?'<b>'+esc(H.meta.track)+'</b><span>'+esc(H.meta.label||"")+'</span>':""; };

  /* ---- the small tower ---- */
  var lastTw="", lastFull="";
  function rowHTML(r,i,full){
    var w=opt.rider(r.s)||{}, cls=(w.me?" is-me":"")+(r.out?" is-out":"")+(r.crash?" is-cr":"")+(w.red?" is-red":"");
    var nm=full&&tv()?w.name:(w.short||w.name);
    return '<li class="mx-h-row'+cls+'"><span class="p">'+(i+1)+'</span>'+w.plate+'<span class="n">'+esc(nm)+'</span>'+(full&&r.cards!=null?'<span class="k">'+(r.out?"":r.cards)+'</span>':"")+'<span class="g">'+(i===0&&!r.out&&!r.crash?"":gapText(r))+'</span></li>';
  }
  function lapHTML(){
    var st=H.st||{}, n=H.meta.len||0, lap=clamp(st.lap||0,0,n||999);
    if(st.over) return '<b>Finish</b>';
    if(st.gate) return '<b>The gate</b><span>'+esc((H.meta.n||H.rows.length)+" riders")+'</span>';
    var last=n>1&&lap>=n;
    return '<b class="'+(last?"is-white":"")+'">Lap '+lap+(n?'<i>/'+n+'</i>':"")+'</b>'+(st.yellow?'<span class="is-yellow">Yellow flag</span>':last?'<span class="is-white">Last lap</span>':"");
  }
  function tower(){
    var rows=H.rows, hs=[], shown=0, out=[], tvm=tv(), ph=H.root_h||root.clientHeight||300;
    var rowPx=rem()*(tvm?1.62:1.32), max=clamp(Math.floor((ph*(tvm?0.5:0.34)-rem()*2)/rowPx),3,tvm?10:5);
    var meSeats=rows.map(function(r,i){ var w=opt.rider(r.s); return w&&w.me?i:-1; }).filter(function(i){ return i>=0; });
    var idx=[]; for(var i=0;i<Math.min(max,rows.length);i++) idx.push(i);
    meSeats.forEach(function(i){ if(idx.indexOf(i)<0){ if(idx.length>=max+1&&meSeats.length>1&&idx.length>max+2) return; idx.push(i); } });
    idx.sort(function(a,b){ return a-b; });
    var htm=""; idx.forEach(function(i,k){ if(k&&idx[k]-idx[k-1]>1) htm+='<li class="mx-h-gap" aria-hidden="true"></li>'; htm+=rowHTML(rows[i],i,false); });
    var lh=lapHTML(), sig=lh+"|"+htm;
    if(sig!==lastTw){ lastTw=sig; lapEl.innerHTML=lh; twEl.innerHTML=htm; }
    lapEl.classList.toggle("is-yellow",!!H.st.yellow);
  }
  /* ---- the full standings: every rider, two columns, rows sized to fit (no scrolling) ---- */
  function fullHTML(){
    var rows=H.rows, n=rows.length, per=n>12?Math.ceil(n/2):n, cols=n>12?2:1, htm="";
    for(var c=0;c<cols;c++){ var part=""; for(var i=c*per;i<Math.min(n,(c+1)*per);i++) part+=rowHTML(rows[i],i,true); htm+='<ol class="mx-h-col" style="--rows:'+per+'">'+part+'</ol>'; }
    return {htm:htm,per:per,cols:cols};
  }
  function renderFull(){
    if(full.hidden) return;
    var f=fullHTML(), st=H.st||{}, n=H.meta.len||0;
    var head='<b>'+(st.over?"Final order":st.gate?"On the gate":"Live standings")+'</b><span>'+esc((H.meta.label||"")+(H.meta.track?" · "+H.meta.track:""))+'</span><span class="is-gold">'+(st.over?"Flag":st.gate?"":"Lap "+clamp(st.lap||0,0,n||999)+(n?" / "+n:""))+'</span>';
    var sig=head+"|"+f.htm; if(sig===lastFull) return; lastFull=sig;
    fh.innerHTML=head; fcols.innerHTML=f.htm; fcols.setAttribute("data-cols",f.cols);
    /* the rows share the height the panel has, no scrolling: the font stays at the floor, the row's padding gives */
    var avail=root.clientHeight-rem()*(tv()?2.6:1.9)-fh.offsetHeight-rem()*1.2, rh=Math.floor(avail/f.per);
    full.style.setProperty("--rh",clamp(rh,Math.round(rem()*(tv()?1.1:.95)),Math.round(rem()*(tv()?2.4:2)))+"px");
  }
  H.update=function(rows,st){
    H.rows=rows||[]; H.st=st||{};
    if(!H.on) return;
    tower(); renderFull();
  };
  H.show=function(on){ H.on=!!on; wrap.style.display=on?"":"none"; if(!on){ H.hideFull(); evt.className="mx-h-evt"; } };

  /* ---- the full standings: a button / the Menu key (pinned open until closed), and by itself for a few seconds ---- */
  function setFull(on){
    if(on===!full.hidden) return; full.hidden=!on; H.full=!!on; wrap.classList.toggle("has-full",!!on);
    if(on){ lastFull=""; renderFull(); } if(opt.onFull) try{ opt.onFull(!!on); }catch(e){}
  }
  H.isFull=function(){ return !full.hidden; };
  H.toggle=function(){ clearTimeout(H.popT); H.pinned=full.hidden; setFull(full.hidden); return !full.hidden; };
  H.hideFull=function(){ clearTimeout(H.popT); H.pinned=false; setFull(false); };
  H.pop=function(ms){ if(!H.on||H.pinned||H.noAuto) return; clearTimeout(H.popT); setFull(true); H.popT=setTimeout(function(){ if(!H.pinned) setFull(false); },ms||4500); };
  H.refit=function(){ lastFull=""; lastTw=""; renderFull(); tower(); };

  /* ---- the event pill: the war's tiny flash, the lap's news ---- */
  H.say=function(html,cls,ms){
    clearTimeout(H.evtT); evt.innerHTML=html; evt.className="mx-h-evt is-on"+(cls?" "+cls:"");
    H.evtT=setTimeout(function(){ evt.className="mx-h-evt"; },ms||2600);
  };
  H.destroy=function(){ try{ wrap.remove(); }catch(e){} clearTimeout(H.popT); clearTimeout(H.evtT); };
  H.show(false);
  return H;
}
MX.Hud={create:create,gapText:gapText,ord:ord};
})(typeof window!=="undefined"?window:globalThis);
