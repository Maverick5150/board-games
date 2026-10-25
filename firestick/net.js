/* Shared realtime layer for the TV-host + phone-controller party mode.
   Connects to SEVERAL free public MQTT relays at once and publishes to all of them, so the TV and a phone
   always share at least one working relay. Duplicate deliveries are dropped via a per-message id.
   mqtt.js may still be loading (the pages load it async so the screen never waits for the CDN): the relays open as soon as it is in. */
(function(global){
  "use strict";
  var BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081/mqtt"
  ];
  // run fn once window.mqtt exists (the async <script> that loads it may still be on its way)
  function whenMqtt(fn, onFail){
    if(global.mqtt){ fn(); return; }
    var done=false, go=function(){ if(!done && global.mqtt){ done=true; fn(); } };
    var s=document.querySelector('script[src*="mqtt"]'); if(s) s.addEventListener("load", go);
    var n=0, retried=0, t=setInterval(function(){
      go();
      if(done){ clearInterval(t); return; }
      n++;
      // the CDN did not deliver (slow or blocked): ask the same CDN again after 12 s and 30 s, and say so after 60 s instead of hanging for ever
      if((n===120 || n===300) && s && s.src && retried<2){ retried++; var r=document.createElement("script"); r.src=s.src+(s.src.indexOf("?")<0?"?":"&")+"r="+retried; r.async=true; r.addEventListener("load", go); (document.head||document.documentElement).appendChild(r); }
      if(n>600){ clearInterval(t); try{ onFail && onFail(); }catch(x){} }
    }, 100);   // also polls (a cached script may have run already)
  }
  function topic(room, which){ return "bgfs/" + room + "/" + which; }
  function rnd(n){ return Math.floor(Math.random()*n); }
  function mkId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,9); }
  function roomCode(){
    var A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s=""; // no confusing chars
    for(var i=0;i<5;i++) s+=A[rnd(A.length)];   // 30^5 = 24 million codes
    return s;
  }
  function pid(){
    try{
      var k=localStorage.getItem("bgfs_pid");
      if(!k){ k="p"+Date.now().toString(36)+rnd(1e6).toString(36); localStorage.setItem("bgfs_pid",k); }
      return k;
    }catch(e){ return "p"+rnd(1e9).toString(36); }
  }
  /* reconnect delay for the n-th failed try in a row: 1 s, 2 s, 4 s ... capped at 15 s, with +-25 % jitter so a room full of phones
     that lost Wi-Fi together does not knock on a relay in the same instant. rnd() in [0,1). */
  function backoff(n, rnd){
    var base = Math.min(15000, 1000 * Math.pow(2, Math.max(0, n)));
    var j = 0.75 + 0.5 * (rnd ? rnd() : Math.random());
    return Math.round(base * j);
  }
  // role: "host" | "ctrl". handlers: {ready, up, msg(obj), status(str)}
  // status: "connecting" (never been online yet) | "online" | "reconnecting" (was online, every relay is down now) | "offline" (closed)
  // The returned object also has reconnect() (drop and reopen every relay at once: the Rejoin button, wake-up from sleep) and state().
  function connect(room, role, handlers){
    var subT = topic(room, role==="host" ? "c" : "h");
    var pubT = topic(room, role==="host" ? "h" : "c");
    var entries = [], closed = false, readyFired = false, everUp = false, lastState = "";
    var seen = {}, seenQ = [], lastRetained = null, early = [], hiddenAt = 0;

    function remember(id){ seen[id]=1; seenQ.push(id); if(seenQ.length>500){ delete seen[seenQ.shift()]; } }
    function state(){
      var up = entries.filter(function(e){ return e.up; }).length;
      return up>0 ? "online" : (closed ? "offline" : (everUp ? "reconnecting" : "connecting"));
    }
    function report(force){
      var s = state();
      if(s==="online") everUp = true;
      if(s===lastState && !force) return;
      lastState = s;
      handlers.status && handlers.status(s);
    }
    function kill(e){ if(e.timer){ clearTimeout(e.timer); e.timer=null; } var c=e.c; e.c=null; e.up=false; if(c){ try{ c.removeAllListeners && c.removeAllListeners(); }catch(x){} try{ c.on && c.on("error", function(){}); }catch(x){} try{ c.end(true); }catch(x){} } }
    function schedule(e){
      if(closed || e.timer) return;
      var d = backoff(e.tries++);
      e.timer = setTimeout(function(){ e.timer=null; if(!closed) open(e); }, d);
    }
    function open(e){
      kill(e);
      var c;
      try{
        c = global.mqtt.connect(e.url, {
          clientId: "bg_" + role + "_" + rnd(1e9).toString(36) + rnd(1e9).toString(36),
          keepalive: 20, reconnectPeriod: 0, connectTimeout: 8000, clean: true   // reconnecting is ours (backoff + wake-up), not mqtt.js's fixed 2.5 s
        });
      }catch(x){ schedule(e); return; }
      e.c = c;
      c.on("connect", function(){
        if(e.c!==c) return;
        c.subscribe(subT, {qos:0}, function(){
          if(e.c!==c || closed) return;
          e.up = true; e.tries = 0; report(); handlers.up && handlers.up();
          if(lastRetained){ try{ c.publish(pubT, lastRetained, {qos:0, retain:true}); }catch(x){} }   // bring a late relay up to date
          if(early.length){ var q=early; early=[]; q.forEach(function(p){ try{ c.publish(pubT, p, {qos:0, retain:false}); }catch(x){} }); }
          if(!readyFired){ readyFired = true; handlers.ready && handlers.ready(); }
        });
      });
      c.on("message", function(t, payload){
        if(e.c!==c) return;
        var o; try{ o = JSON.parse(payload.toString()); }catch(x){ return; }
        if(o && o._m){ if(seen[o._m]) return; remember(o._m); }
        handlers.msg && handlers.msg(o);
      });
      c.on("error", function(){ /* the close that follows schedules the retry */ });
      var down = function(){ if(e.c!==c) return; e.up = false; e.c = null; try{ c.end(true); }catch(x){} if(!closed){ report(); schedule(e); } };
      c.on("close", down); c.on("offline", down);
    }
    // wake-up: a phone that slept, lost Wi-Fi or came back from another app has dead sockets that still look alive. Reopen everything now.
    function reconnect(){
      if(closed) return;
      entries.forEach(function(e){ e.tries = 0; kill(e); });
      report();
      entries.forEach(function(e){ open(e); });
    }
    function onVis(){
      if(typeof document==="undefined") return;
      if(document.hidden){ hiddenAt = Date.now(); return; }
      var away = hiddenAt ? Date.now()-hiddenAt : 0; hiddenAt = 0;
      if(away > 3000 || state()!=="online") reconnect();
    }
    function onNet(){ reconnect(); }
    var doc = typeof document!=="undefined" ? document : null;
    if(doc && doc.addEventListener) doc.addEventListener("visibilitychange", onVis);
    if(global.addEventListener){ global.addEventListener("online", onNet); global.addEventListener("pageshow", onVis); }
    handlers.status && handlers.status("connecting");
    whenMqtt(function(){ if(!closed) BROKERS.forEach(function(u){ var e={url:u, up:false, c:null, tries:0, timer:null}; entries.push(e); open(e); }); },
      function(){ handlers.libFail && handlers.libFail(); });

    return {
      send: function(obj, retain){
        var o = {}; for(var k in obj) o[k]=obj[k]; o._m = mkId();
        var payload = JSON.stringify(o);
        if(retain) lastRetained = payload;
        var targets=entries.filter(function(e){ return e.up; });
        if(!targets.length){ if(!retain) early.push(payload); if(early.length>50) early.shift(); return; }   // no relay up right now: sent when the first one comes back (a retained message is re-published by every relay that comes up)
        targets.forEach(function(e){ try{ e.c.publish(pubT, payload, {qos:0, retain: !!retain}); }catch(x){} });
      },
      reconnect: reconnect,
      state: state,
      close: function(clear){
        closed = true;
        if(doc && doc.removeEventListener) doc.removeEventListener("visibilitychange", onVis);
        if(global.removeEventListener){ global.removeEventListener("online", onNet); global.removeEventListener("pageshow", onVis); }
        entries.forEach(function(e){
          if(e.timer){ clearTimeout(e.timer); e.timer=null; }
          var c=e.c;
          try{ if(clear && e.up && c) c.publish(pubT, "", {qos:0, retain:true}); }catch(x){}   // wipe the retained lobby so the dead room leaves no trace
          setTimeout(function(){ try{ c && c.end(true); }catch(x){} }, 300);
          e.up=false;
        });
        report();
      }
    };
  }
  global.BGNet = { connect: connect, roomCode: roomCode, pid: pid, backoff: backoff };
})(typeof window!=="undefined" ? window : globalThis);
