/* MOTOCROSS WAR — updates reach an OPEN game (the CEO's phone kept running the old 2D code at 05:15: "Lap 6 of 100": a page left open in a
   phone's app never reloads, and mxwar/sw.js takes over by itself (skipWaiting + claim) but never reloads the page). window.MXWar.Update:
   - on the way back to the foreground (visibilitychange) and every few minutes it asks the service worker registration to update(), and
     compares what the server serves now (sw.js, game.js, index.html: the service worker's VERSION, the ETag / Last-Modified / length) with
     what this page started with;
   - a newer service worker taking over (controllerchange) counts too;
   - a newer version found: at a SAFE moment (opt.safe(): the setup or season screen, nothing open) it reloads by itself (opt.beforeReload()
     saves the season first; the page then goes straight back into it); during a race opt.onNew() shows a button ("New version ready: tap to
     update", reachable with the D-pad) and nothing reloads under the player's hands.
   The page calls Update.poke() whenever the moment may have become safe (the season screen, a sheet closed). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Update) return;
var KEY="mxwar.updated", EVERY=4*60*1000, files=["sw.js","game.js","index.html"];
var U={pending:false,checks:0,boot:null,found:"",opt:null,timer:0,hadCtl:false,reloading:false,last:0};
function sig(res){ var h=res.headers; return (h.get("etag")||"")+"|"+(h.get("last-modified")||"")+"|"+(h.get("content-length")||""); }
function look(){
  /* what the server serves now: sw.js's text (its VERSION line), the other two files' headers; each fetched past every cache */
  return Promise.all(files.map(function(f){
    return fetch(f,{cache:"no-store"}).then(function(r){ if(!r.ok) throw new Error(f); return f==="sw.js"?r.text().then(function(t){ return t.replace(/\s+/g," ").length+":"+hash(t); }):sig(r); });
  })).then(function(a){ return a.join("#"); });
}
function hash(s){ var h=2166136261>>>0; for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h; }
/* the version this page runs: read once when it starts (the page's own scripts are what was served a moment before) */
U.init=function(opt){
  U.opt=opt||{};
  look().then(function(v){ if(U.boot==null) U.boot=v; },function(){});
  var sw=navigator.serviceWorker;
  if(sw){
    U.hadCtl=!!sw.controller;
    sw.addEventListener("controllerchange",function(){ if(U.hadCtl) found("controller"); U.hadCtl=true; });
  }
  document.addEventListener("visibilitychange",function(){ if(!document.hidden){ setTimeout(U.check,800); } });
  g.addEventListener("online",function(){ setTimeout(U.check,800); });
  U.timer=setInterval(U.check,EVERY);
};
function found(why){ if(U.pending&&U.found) return; U.pending=true; U.found=why; if(U.opt.onNew) try{ U.opt.onNew(why); }catch(e){} U.poke(); }
U.check=function(){
  if(U.reloading||document.hidden||(navigator.onLine===false)) return Promise.resolve(false);
  U.checks++; U.last=Date.now();
  var sw=navigator.serviceWorker, upd=Promise.resolve();
  if(sw&&sw.getRegistration) upd=sw.getRegistration().then(function(r){ return r&&r.update?r.update():null; }).then(null,function(){});
  return upd.then(look).then(function(v){
    if(U.boot==null){ U.boot=v; return false; }
    if(v!==U.boot){ found("version"); return true; }
    return U.pending;
  },function(){ return false; });
};
/* the moment may be safe now: reload (the season saved first) when a newer version is waiting */
U.poke=function(){
  if(!U.pending||U.reloading) return false;
  var ok=false; try{ ok=!!(U.opt.safe&&U.opt.safe()); }catch(e){ ok=false; }
  if(!ok) return false;
  return U.apply();
};
U.apply=function(){
  if(U.reloading) return true; U.reloading=true;
  try{ if(U.opt.beforeReload) U.opt.beforeReload(); }catch(e){}
  try{ sessionStorage.setItem(KEY,String(Date.now())); }catch(e){}
  setTimeout(function(){ try{ g.location.reload(); }catch(e){ U.reloading=false; } },60);
  return true;
};
/* the page just came back from an update reload: pick the season up again by itself (once) */
U.justUpdated=function(){ var v=null; try{ v=sessionStorage.getItem(KEY); if(v) sessionStorage.removeItem(KEY); }catch(e){} return !!v&&Date.now()-(+v||0)<120000; };
MX.Update=U;
})(typeof window!=="undefined"?window:globalThis);
