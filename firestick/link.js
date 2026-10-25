/* The phone's view of its link to the TV: one small state machine the phone page drives and the status chip / Rejoin button show.
   States: "connecting" (first knock) | "online" (the TV answered lately) | "reconnecting" (a relay dropped, or the TV has been quiet) | "lost"
   (nothing for a long while: show the reason and a Rejoin button). The TV answers every join / keep-alive (every 8 s while seated), so
   "the TV answered in the last 20 s" is the heartbeat. No DOM here: the page passes in its clock, its sender and its reconnect.
   Events in:  netStatus(s)  the relay layer (BGNet status)      heard()  any message from the TV      wake()  phone woke / came online
               rejoin()      the Rejoin button                   stop()   Leave
   Options:    now(), send() (a join), reconnect() (drop and reopen the relays), onChange(state, info) */
(function (g) {
  "use strict";
  var QUIET_KICK = 20000, QUIET_LOST = 45000, JOIN_LOST = 25000;
  function create(o) {
    var st = "connecting", net = "connecting", joined = false, lastRx = 0, since = o.now(), kicked = false, stopped = false, info = {};
    function set(s, i) { i = i || {}; if (s === st && (i.why || "") === (info.why || "")) return; st = s; info = i; try { o.onChange && o.onChange(st, info); } catch (e) { } }
    function why() { return net === "online" ? "tv" : "net"; }
    var lastTick = o.now();
    function tick() {
      if (stopped) return;
      var t = o.now();
      if (t - lastTick > 6000) { lastTick = t; if (joined) { api.wake(); return; } since = t; return; }   // the timer was frozen (phone asleep / tab in the background): that is a wake-up, not a silent TV
      lastTick = t;
      if (!joined) {
        if (t - since > JOIN_LOST) set("lost", { why: why() });
        return;
      }
      var quiet = t - lastRx;
      if (quiet > QUIET_KICK && !kicked) { kicked = true; try { o.reconnect(); o.send(); } catch (e) { } set("reconnecting"); }
      if (quiet > QUIET_LOST) set("lost", { why: why() });
    }
    var api = {
      state: function () { return st; }, info: function () { return info; }, joined: function () { return joined; },
      tick: tick,
      netStatus: function (s) {
        net = s; if (stopped) return;
        if (s === "reconnecting" || s === "offline") { if (joined || st === "online") set("reconnecting"); }
        else if (s === "online" && joined) { o.send(); }   // a relay came back: say hello right away, do not wait for the next keep-alive
      },
      /* the TV said something. joinedNow = it seated us (a "you" message) */
      heard: function (joinedNow) {
        if (stopped) return;
        lastRx = o.now(); kicked = false;
        if (joinedNow) joined = true;
        if (joined) set("online");
      },
      wake: function () { if (stopped) return; kicked = true; o.reconnect(); o.send(); if (joined) { lastRx = o.now() - QUIET_KICK + 8000; set("reconnecting"); } else set("connecting"); },
      rejoin: function () { if (stopped) return; since = o.now(); kicked = true; lastRx = o.now() - QUIET_KICK + 8000; o.reconnect(); o.send(); set(joined ? "reconnecting" : "connecting"); },
      reset: function () { joined = false; since = o.now(); kicked = false; set("connecting"); },
      stop: function () { stopped = true; }
    };
    return api;
  }
  var api = { create: create, QUIET_KICK: QUIET_KICK, QUIET_LOST: QUIET_LOST, JOIN_LOST: JOIN_LOST };
  g.BGLink = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
