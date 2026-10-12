/* Shared saving for every game: saved settings, saved game (manual slot), autosave (last game). All in this device's localStorage. */
(function(g){
"use strict";
var P="bg_";
function k(game,kind){ return P+kind+"_"+game; }
function put(game,kind,data){ try{ localStorage.setItem(k(game,kind),JSON.stringify({ts:Date.now(),data:data})); return true; }catch(e){ return false; } }
function get(game,kind){ try{ var s=localStorage.getItem(k(game,kind)); if(!s) return null; var o=JSON.parse(s); return (o&&o.data)?o:null; }catch(e){ return null; } }
function del(game,kind){ try{ localStorage.removeItem(k(game,kind)); }catch(e){} }
function when(ts){ try{ return new Date(ts).toLocaleString([], {month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }catch(e){ return ""; } }
function toast(msg){
  var t=document.getElementById("svtoast");
  if(!t){ t=document.createElement("div"); t.id="svtoast"; t.style.cssText="position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);transform:translateX(-50%);background:#000d;color:#fff;border-radius:12px;padding:10px 16px;font:700 14px system-ui,sans-serif;z-index:100000;opacity:0;pointer-events:none;transition:opacity .2s;max-width:90vw;text-align:center"; document.body.appendChild(t); }
  t.textContent=msg; t.style.opacity="1"; clearTimeout(t._h); t._h=setTimeout(function(){ t.style.opacity="0"; },2200);
}
function injectCSS(){
  if(document.getElementById("svcss")) return;
  var s=document.createElement("style"); s.id="svcss";
  s.textContent=".svbar{margin:12px 0 4px;padding:10px;border:1px solid #ffffff2a;border-radius:14px;background:#00000030}.svbar h4{margin:0 0 6px;font:800 12px system-ui,sans-serif;letter-spacing:.8px;text-transform:uppercase;opacity:.8;text-align:left}.svbar .r{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px}.svbar button{flex:1 1 30%;min-width:96px;background:#ffffff18;color:inherit;border:1px solid #ffffff3a;border-radius:10px;padding:9px 8px;font:700 13px system-ui,sans-serif;cursor:pointer}.svbar button:active{background:#ffffff33}.svbar button[disabled]{opacity:.35;cursor:default}.svbar small{display:block;font-weight:500;font-size:10.5px;opacity:.75;margin-top:2px}";
  document.head.appendChild(s);
}
/* opts: game, el, getSettings(), applySettings(obj), standard(), getSnapshot(), loadSnapshot(obj) */
function bar(o){
  injectCSS();
  var el=o.el; if(!el) return {refresh:function(){}};
  function draw(){
    var st=get(o.game,"settings"), sv=get(o.game,"save"), au=get(o.game,"auto"), snap=o.getSnapshot?o.getSnapshot():null;
    el.className="svbar";
    el.innerHTML='<h4>Save &amp; load</h4>'+
      (o.noSettings?'':'<div class="r"><button data-a="ss">💾 Save settings</button><button data-a="ls"'+(st?"":" disabled")+'>📂 Load settings'+(st?'<small>'+when(st.ts)+'</small>':'')+'</button>'+(o.standard?'<button data-a="std">↺ Standard rules</button>':'')+'</div>')+
      (o.getSnapshot?'<div class="r"><button data-a="sg"'+(snap?"":" disabled")+'>💾 Save game'+(snap?'<small>start of this turn</small>':'')+'</button><button data-a="lg"'+(sv?"":" disabled")+'>📂 Load saved game'+(sv?'<small>'+when(sv.ts)+'</small>':'')+'</button><button data-a="au"'+(au?"":" disabled")+'>↻ Continue last game'+(au?'<small>'+when(au.ts)+'</small>':'')+'</button></div>':'');
  }
  el.onclick=function(e){
    var b=e.target.closest&&e.target.closest("button[data-a]"); if(!b||b.disabled) return;
    var a=b.getAttribute("data-a"), ok;
    if(a==="ss"){ ok=put(o.game,"settings",o.getSettings()); toast(ok?"Settings saved on this device":"Couldn't save (storage blocked?)"); }
    else if(a==="ls"){ var s=get(o.game,"settings"); if(s){ o.applySettings(s.data); toast("Saved settings loaded"); } }
    else if(a==="std"){ o.standard(); toast("Standard rules restored"); }
    else if(a==="sg"){ var sn=o.getSnapshot(); if(sn){ ok=put(o.game,"save",sn); toast(ok?"Game saved (restores to the start of the current turn)":"Couldn't save (storage blocked?)"); } }
    else if(a==="lg"){ var sv=get(o.game,"save"); if(sv){ o.loadSnapshot(sv.data); toast("Saved game loaded"); } }
    else if(a==="au"){ var au=get(o.game,"auto"); if(au){ o.loadSnapshot(au.data); toast("Last game continued"); } }
    draw();
  };
  draw();
  return {refresh:draw};
}
g.Saves={put:put,get:get,del:del,when:when,toast:toast,bar:bar,auto:function(game,snap){ if(snap) put(game,"auto",snap); }};
})(typeof window!=="undefined"?window:globalThis);
