/* Shared realtime layer for the TV-host + phone-controller party mode.
   Uses a free public MQTT broker over WebSockets (no account). mqtt.js must be loaded first. */
(function(global){
  "use strict";
  var BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
  ];
  function topic(room, which){ return "bgfs/" + room + "/" + which; }
  function rnd(n){ return Math.floor(Math.random()*n); }
  function roomCode(){
    var A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s=""; // no confusing chars
    for(var i=0;i<4;i++) s+=A[rnd(A.length)];
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
    var bi = 0, client = null, closed = false;
    function open(){
      var url = BROKERS[bi % BROKERS.length];
      handlers.status && handlers.status("connecting");
      client = global.mqtt.connect(url, {
        clientId: "bg_" + role + "_" + rnd(1e9).toString(36),
        keepalive: 30, reconnectPeriod: 2500, connectTimeout: 8000, clean: true
      });
      client.on("connect", function(){
        client.subscribe(subT, {qos:0}, function(){ handlers.status && handlers.status("online"); handlers.ready && handlers.ready(); });
      });
      client.on("message", function(t, payload){
        var o; try{ o = JSON.parse(payload.toString()); }catch(e){ return; }
        handlers.msg && handlers.msg(o);
      });
      client.on("error", function(){ /* will reconnect; if persistent, try other broker */ });
      client.on("close", function(){ if(!closed){ handlers.status && handlers.status("offline"); } });
      // if first broker never connects, flip to the other after a while
      setTimeout(function(){ if(client && !client.connected && !closed){ bi++; try{client.end(true);}catch(e){} open(); } }, 9000);
    }
    open();
    return {
      send: function(obj, retain){ if(client){ try{ client.publish(pubT, JSON.stringify(obj), {qos:0, retain: !!retain}); }catch(e){} } },
      close: function(){ closed=true; try{ client.end(true); }catch(e){} }
    };
  }
  global.BGNet = { connect: connect, roomCode: roomCode, pid: pid };
})(window);
