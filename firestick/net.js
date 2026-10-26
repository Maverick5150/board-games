/* Shared realtime layer for the TV-host + phone-controller party mode.
   Connects to SEVERAL free public MQTT relays at once and publishes to all of them, so the TV and a phone
   always share at least one working relay. Duplicate deliveries are dropped via a per-message id.
   mqtt.js may still be loading (the pages load it async so the screen never waits for the CDN): the relays open as soon as it is in. */
(function(global){
  "use strict";
  // Verified 2026-10-26 (BG_audit/party-relay-measure.md). test.mosquitto.org:8081 dropped (websocket upgrade refused), mqtt.eclipseprojects.io (no CONNACK).
  var BROKERS = [
    { url:"wss://broker.emqx.io:8084/mqtt" },
    { url:"wss://broker.hivemq.com:8884/mqtt" },
    { url:"wss://public.cloud.shiftr.io", username:"public", password:"public" }
  ];
  var MQTT_FALLBACK = "https://unpkg.com/mqtt@5.10.1/dist/mqtt.min.js";   // same pinned version, only used if jsdelivr gave nothing after 5 s
  // run fn once window.mqtt exists (the async <script> that loads it may still be on its way)
  function whenMqtt(fn){
    if(global.mqtt){ fn(); return; }
    var done=false, go=function(){ if(!done && global.mqtt){ done=true; fn(); } };
    var s=document.querySelector('script[src*="mqtt"]'); if(s) s.addEventListener("load", go);
    var n=0, t=setInterval(function(){
      go();
      if(!done && n===50 && !global.mqtt){ var f=document.createElement("script"); f.src=MQTT_FALLBACK; f.async=true; f.onload=go; document.head.appendChild(f); }
      if(done || ++n>600) clearInterval(t);
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
  // role: "host" | "ctrl". handlers: {ready, msg(obj), status(str)}
  function connect(room, role, handlers){
    var subT = topic(room, role==="host" ? "c" : "h");
    var pubT = topic(room, role==="host" ? "h" : "c");
    var entries = [], closed = false, readyFired = false;
    var seen = {}, seenQ = [], lastRetained = null, early = [];

    function remember(id){ seen[id]=1; seenQ.push(id); if(seenQ.length>500){ delete seen[seenQ.shift()]; } }
    function report(){
      var up = entries.filter(function(e){ return e.up; }).length;
      try{ var h=document.getElementById("relayhint"); if(h) h.textContent = "relays: "+up+" of "+BROKERS.length+" up"; }catch(x){}
      handlers.status && handlers.status(up>0 ? "online" : (closed ? "offline" : "connecting"));
    }
    function open(b){
      var e = { up:false, c:null };
      entries.push(e);
      var o = {
        clientId: "bg_" + role + "_" + rnd(1e9).toString(36) + rnd(1e9).toString(36),
        keepalive: 30, reconnectPeriod: 1500, connectTimeout: 8000, clean: true
      };
      if(b.username){ o.username=b.username; o.password=b.password; }
      e.c = global.mqtt.connect(b.url, o);
      e.c.on("connect", function(){
        e.c.subscribe(subT, {qos:0}, function(){
          e.up = true; report(); handlers.up && handlers.up();
          if(lastRetained){ try{ e.c.publish(pubT, lastRetained, {qos:0, retain:true}); }catch(x){} }   // bring a late relay up to date
          if(early.length){ var q=early; early=[]; q.forEach(function(p){ try{ e.c.publish(pubT, p, {qos:0, retain:false}); }catch(x){} }); }
          if(!readyFired){ readyFired = true; handlers.ready && handlers.ready(); }
        });
      });
      e.c.on("message", function(t, payload){
        var o; try{ o = JSON.parse(payload.toString()); }catch(x){ return; }
        if(o && o._m){ if(seen[o._m]) return; remember(o._m); }
        handlers.msg && handlers.msg(o);
      });
      e.c.on("error", function(){ /* keeps retrying on its own */ });
      e.c.on("close", function(){ e.up = false; if(!closed) report(); });
    }
    handlers.status && handlers.status("connecting");
    whenMqtt(function(){ if(!closed) BROKERS.forEach(function(b){ try{ open(b); }catch(x){} }); report(); });

    return {
      send: function(obj, retain){
        var o = {}; for(var k in obj) o[k]=obj[k]; o._m = mkId();
        var payload = JSON.stringify(o);
        if(retain) lastRetained = payload;
        var targets=entries.filter(function(e){ return e.up; });
        if(!targets.length) targets=entries;   // none up right now: let the client queue it and deliver on reconnect
        if(!targets.length){ if(!retain) early.push(payload); return; }   // mqtt.js not in yet: sent when the first relay opens
        targets.forEach(function(e){ try{ e.c.publish(pubT, payload, {qos:0, retain: !!retain}); }catch(x){} });
      },
      close: function(clear){
        closed = true;
        entries.forEach(function(e){
          try{ if(clear && e.up) e.c.publish(pubT, "", {qos:0, retain:true}); }catch(x){}   // wipe the retained lobby so the dead room leaves no trace
          setTimeout(function(){ try{ e.c.end(true); }catch(x){} }, 300);
        });
      }
    };
  }
  global.BGNet = { connect: connect, roomCode: roomCode, pid: pid, BROKERS: BROKERS };
})(window);
