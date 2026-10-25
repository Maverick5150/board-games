/* Party Mode save (TV host): one shared, versioned record in the TV's localStorage so a TV that reloads, sleeps or loses power can put the
   same room back, seat the same phones, and (where the game can) carry on from its last turn.
   Record: {v, ts, kind:"lobby"|"game", game, room, cfg, seats:[{pid,color,name}], cpun:{color:name}, cpu, st}
     cfg  = the lobby settings (house rules, speed, skill, computers)      st = the game's own plain-JSON state, or null when the game keeps
     its own save (Snakes, Candy Land, War, Motocross War) or cannot be saved mid-turn.
   Never stored: anything that looks like a secret (keys, tokens, passwords), DOM nodes, functions. A save that is old, too big, from another
   version or damaged is discarded with a message and never throws. */
(function (g) {
  "use strict";
  var KEY = "bgfs_party_save", VERSION = 1, MAX_BYTES = 700000, MAX_AGE_MS = 24 * 3600 * 1000;
  var SECRET = /secret|token|passw|apikey|api_key|authorization|credential/i;

  function store() { try { return g.localStorage || null; } catch (e) { return null; } }

  /* a deep copy with no functions, no DOM, no cycles, nothing secret-looking, and never deeper than 40 levels */
  function clean(x, depth, seen) {
    if (x == null) return x;
    var t = typeof x;
    if (t === "function" || t === "symbol") return undefined;
    if (t !== "object") return (t === "number" && !isFinite(x)) ? null : x;
    if (depth > 40) return undefined;
    if (x.nodeType || x === g) return undefined;
    seen = seen || [];
    if (seen.indexOf(x) >= 0) return undefined;
    seen.push(x);
    var out;
    if (Array.isArray(x)) { out = x.map(function (v) { var c = clean(v, depth + 1, seen); return c === undefined ? null : c; }); }
    else {
      out = {};
      Object.keys(x).forEach(function (k) { if (SECRET.test(k)) return; var c = clean(x[k], depth + 1, seen); if (c !== undefined) out[k] = c; });
    }
    seen.pop();
    return out;
  }

  /* null when the record is usable, else the reason (a short phrase for the TV's message) */
  function problem(rec, now) {
    if (!rec || typeof rec !== "object") return "damaged";
    if (rec.v !== VERSION) return "from a different version";
    if (rec.kind !== "lobby" && rec.kind !== "game") return "damaged";
    if (typeof rec.game !== "string" || !rec.game) return "damaged";
    if (typeof rec.room !== "string" || !/^[A-Z0-9]{5}$/.test(rec.room)) return "damaged";
    if (typeof rec.ts !== "number" || !isFinite(rec.ts)) return "damaged";
    if ((now || Date.now()) - rec.ts > MAX_AGE_MS) return "too old";
    if (!Array.isArray(rec.seats)) return "damaged";
    for (var i = 0; i < rec.seats.length; i++) {
      var s = rec.seats[i];
      if (!s || typeof s.pid !== "string" || typeof s.color !== "string" || typeof s.name !== "string") return "damaged";
    }
    if (rec.cfg != null && typeof rec.cfg !== "object") return "damaged";
    if (rec.st != null && typeof rec.st !== "object") return "damaged";
    return null;
  }

  /* writes the record; returns true when saved. A state that makes the record too big is dropped (the room and seats still save). */
  function save(rec) {
    var s = store(); if (!s) return false;
    try {
      var r = clean(rec, 0); if (!r) return false;
      r.v = VERSION; r.ts = Date.now();
      var txt = JSON.stringify(r);
      if (txt.length > MAX_BYTES) { r.st = null; r.big = true; txt = JSON.stringify(r); }
      if (txt.length > MAX_BYTES) return false;
      s.setItem(KEY, txt);
      return true;
    } catch (e) { return false; }
  }

  /* {rec} usable | {none:true} nothing saved | {bad:"reason"} found and discarded (already removed) */
  function load(now) {
    var s = store(); if (!s) return { none: true };
    var raw; try { raw = s.getItem(KEY); } catch (e) { return { none: true }; }
    if (!raw) return { none: true };
    var rec = null;
    try { rec = JSON.parse(raw); } catch (e) { rec = null; }
    var why = problem(rec, now);
    if (why) { clear(); return { bad: why }; }
    return { rec: rec };
  }

  function clear() { var s = store(); try { s && s.removeItem(KEY); } catch (e) { } }

  function ago(ts, now) {
    var m = Math.max(0, Math.round(((now || Date.now()) - ts) / 60000));
    return m < 1 ? "just now" : m < 60 ? m + " min ago" : Math.round(m / 60) + " h ago";
  }
  /* what the Resume card says */
  function describe(rec, titleOf, now) {
    var n = rec.seats.length, cpu = rec.cpu | 0;
    var who = n + (n === 1 ? " phone" : " phones") + (cpu ? " + " + cpu + (cpu === 1 ? " computer" : " computers") : "");
    var what = rec.kind === "lobby" ? "lobby" : (rec.st || rec.own ? "game" : "game (restarts from the first turn)");
    return { title: (titleOf ? titleOf(rec.game) : rec.game), line: what + " · " + who + " · saved " + ago(rec.ts, now) };
  }

  var api = { KEY: KEY, VERSION: VERSION, MAX_BYTES: MAX_BYTES, MAX_AGE_MS: MAX_AGE_MS, save: save, load: load, clear: clear, problem: problem, clean: clean, describe: describe };
  g.PartySave = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
