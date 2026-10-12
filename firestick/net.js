/* Shared realtime layer for the TV-host + phone-controller party mode.
   Connects to SEVERAL free public MQTT relays at once and publishes to all of them, so the TV and a phone
   always share at least one working relay. Duplicate deliveries are dropped via a per-message id.
   mqtt.js must be loaded first. */
(function(global){
  "use strict";
  var BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt",
    "wss://test.mosquitto.org:8081/mqtt"
  ];
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
    var seen = {}, seenQ = [], lastRetained = null;

    function remember(id){ seen[id]=1; seenQ.push(id); if(seenQ.length>500){ delete seen[seenQ.shift()]; } }
    function report(){
      var up = entries.filter(function(e){ return e.up; }).length;
      handlers.status && handlers.status(up>0 ? "online" : (closed ? "offline" : "connecting"));
    }
    function open(url){
      var e = { up:false, c:null };
      entries.push(e);
      e.c = global.mqtt.connect(url, {
        clientId: "bg_" + role + "_" + rnd(1e9).toString(36) + rnd(1e9).toString(36),
        keepalive: 30, reconnectPeriod: 2500, connectTimeout: 8000, clean: true
      });
      e.c.on("connect", function(){
        e.c.subscribe(subT, {qos:0}, function(){
          e.up = true; report(); handlers.up && handlers.up();
          if(lastRetained){ try{ e.c.publish(pubT, lastRetained, {qos:0, retain:true}); }catch(x){} }   // bring a late relay up to date
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
    BROKERS.forEach(function(u){ try{ open(u); }catch(x){} });

    return {
      send: function(obj, retain){
        var o = {}; for(var k in obj) o[k]=obj[k]; o._m = mkId();
        var payload = JSON.stringify(o);
        if(retain) lastRetained = payload;
        var targets=entries.filter(function(e){ return e.up; });
        if(!targets.length) targets=entries;   // none up right now: let the client queue it and deliver on reconnect
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
  global.BGNet = { connect: connect, roomCode: roomCode, pid: pid };
})(window);
