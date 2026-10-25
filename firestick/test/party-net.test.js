// node firestick/test/party-net.test.js : unit tests for Party Mode connecting, reconnecting and saving
//   net.js (relay layer: backoff, drop, sleep, wake)   link.js (the phone's link state machine)   partysave.js (the TV's versioned save)
let pass = 0, fail = 0; const ok = (c, n) => { if (c) pass++; else { fail++; console.log("FAIL:", n); } };

// ---- a fake clock + fake mqtt, installed before net.js loads --------------------------------------------------------------------------------
let now = 1000000, timers = [], tid = 0;
global.setTimeout = (fn, ms) => { const t = { id: ++tid, at: now + (ms || 0), fn }; timers.push(t); return t.id; };
global.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
global.setInterval = () => 0; global.clearInterval = () => { };
const realNow = Date.now; Date.now = () => now;
function advance(ms) { const end = now + ms; for (;;) { timers.sort((a, b) => a.at - b.at); const t = timers[0]; if (!t || t.at > end) break; timers.shift(); now = Math.max(now, t.at); t.fn(); } now = end; }

const listeners = {}; global.window = global; global.addEventListener = (e, f) => { (listeners[e] = listeners[e] || []).push(f); }; global.removeEventListener = (e, f) => { listeners[e] = (listeners[e] || []).filter(x => x !== f); };
const docL = {}; global.document = { hidden: false, addEventListener: (e, f) => { (docL[e] = docL[e] || []).push(f); }, removeEventListener: (e, f) => { docL[e] = (docL[e] || []).filter(x => x !== f); }, querySelector: () => null, createElement: () => ({ addEventListener() { } }) };
const fire = (e, ...a) => (listeners[e] || []).slice().forEach(f => f(...a));
const fireDoc = e => (docL[e] || []).slice().forEach(f => f());

// the relays: url -> {accepting:bool}; every created client is recorded
const relay = {}; const clients = [];
global.mqtt = {
  connect(url) {
    const h = {}, c = { url, ended: false, pubs: [], on(ev, f) { (h[ev] = h[ev] || []).push(f); return c; }, removeAllListeners() { for (const k in h) h[k] = []; }, end() { c.ended = true; }, publish(t, p, o) { c.pubs.push([t, p, o]); }, subscribe(t, o, cb) { cb && cb(); }, emit(ev, ...a) { (h[ev] || []).slice().forEach(f => f(...a)); } };
    clients.push(c);
    global.setTimeout(() => { if (c.ended) return; if (relay[url] && relay[url].accepting === false) { c.emit("error", new Error("refused")); c.emit("close"); } else c.emit("connect"); }, 0);
    return c;
  }
};
require("../net.js"); const N = global.BGNet;
const L = require("../link.js");
const S = require("../partysave.js");
const live = () => clients.filter(c => !c.ended);

// ---- backoff -------------------------------------------------------------------------------------------------------------------------------
{
  const mid = () => 0.5; // jitter factor 1.0
  ok(N.backoff(0, mid) === 1000 && N.backoff(1, mid) === 2000 && N.backoff(2, mid) === 4000 && N.backoff(3, mid) === 8000, "backoff doubles");
  ok(N.backoff(4, mid) === 15000 && N.backoff(30, mid) === 15000, "backoff caps at 15 s");
  ok(N.backoff(2, () => 0) === 3000 && N.backoff(2, () => 0.999) < 5001, "backoff jitter stays within +-25%");
}

// ---- relay layer: connect, drop, backoff, wake -----------------------------------------------------------------------------------------------
{
  const st = []; let ups = 0, got = [];
  const net = N.connect("ABCDE", "ctrl", { status: s => st.push(s), up: () => ups++, msg: o => got.push(o) });
  advance(10);
  ok(st[0] === "connecting" && st.includes("online"), "connects: connecting then online");
  ok(live().length === 3, "three relays opened");
  // a message arriving on two relays is delivered once
  live()[0].emit("message", "t", Buffer.from(JSON.stringify({ t: "x", _m: "m1" }))); live()[1].emit("message", "t", Buffer.from(JSON.stringify({ t: "x", _m: "m1" })));
  ok(got.length === 1, "duplicate delivery dropped");
  // all relays drop (Wi-Fi switch)
  const before = clients.length; live().forEach(c => { c.emit("close"); });
  ok(st[st.length - 1] === "reconnecting", "all relays down -> reconnecting (not connecting)");
  advance(500); ok(clients.length === before, "no reopen before the first backoff (~1 s)");
  advance(1500); ok(clients.length > before, "reopens after backoff");
  advance(100); ok(st[st.length - 1] === "online", "back online after the drop");
  // relays refuse for a while: attempts spread out (exponential), then recover
  Object.keys(relay).forEach(k => delete relay[k]);
  ["wss://broker.emqx.io:8084/mqtt", "wss://broker.hivemq.com:8884/mqtt", "wss://test.mosquitto.org:8081/mqtt"].forEach(u => relay[u] = { accepting: false });
  live().forEach(c => c.emit("close"));
  const c0 = clients.length; advance(60000);
  const attempts = clients.length - c0;
  ok(attempts > 6 && attempts < 45, "refused relays are retried with backoff, not hammered (" + attempts + " tries in 60 s)");
  ok(st[st.length - 1] === "reconnecting", "still reconnecting while refused");
  relay["wss://broker.emqx.io:8084/mqtt"].accepting = true; advance(20000);
  ok(st[st.length - 1] === "online", "recovers as soon as one relay accepts");
  // sleep: the phone was hidden 60 s, sockets look alive but are dead -> everything is reopened on wake
  Object.keys(relay).forEach(k => delete relay[k]);
  advance(100); const liveBefore = live().slice();
  global.document.hidden = true; fireDoc("visibilitychange"); advance(60000); global.document.hidden = false; fireDoc("visibilitychange"); advance(50);
  ok(liveBefore.every(c => c.ended), "wake after sleep: old sockets dropped");
  ok(live().length >= 3, "wake after sleep: fresh sockets opened"); ok(st[st.length - 1] === "online", "wake after sleep: online again");
  // the 'online' event (Wi-Fi came back) also reopens
  const lb = live().slice(); fire("online"); advance(50); ok(lb.every(c => c.ended) && live().length >= 3, "online event reopens the relays");
  // manual rejoin
  const lb2 = live().slice(); net.reconnect(); advance(50); ok(lb2.every(c => c.ended) && net.state() === "online", "reconnect() (Rejoin button) reopens and goes online");
  // send while all down is queued and delivered on return; a retained one is re-published by the relay that comes up
  live().forEach(c => c.emit("close")); net.send({ t: "join" }); const cs = clients.length; advance(3000);
  const delivered = clients.slice(cs).some(c => c.pubs.some(p => /"join"/.test(p[1])));
  ok(delivered, "a join sent while offline is delivered when a relay returns");
  // close stops everything
  net.close(); const cc = clients.length; advance(60000); ok(clients.length === cc && net.state() === "offline", "close stops retries");
}

// ---- host side: retained lobby is re-published to a relay that comes up late -----------------------------------------------------------------
{
  const net = N.connect("HOSTR", "host", { status() { }, msg() { } }); advance(10);
  net.send({ t: "lobby", players: [] }, true); live().forEach(c => c.emit("close")); const cs = clients.length; advance(3000);
  ok(clients.slice(cs).some(c => c.pubs.some(p => p[2] && p[2].retain && /lobby/.test(p[1]))), "host re-publishes the retained lobby after a drop");
  net.close();
}

// ---- BGLink: the phone's state machine ------------------------------------------------------------------------------------------------------
function mkLink() { let t = 5000; const log = [], calls = { send: 0, reconnect: 0 }; const l = L.create({ now: () => t, send: () => calls.send++, reconnect: () => calls.reconnect++, onChange: (s, i) => log.push(s + (i && i.why ? ":" + i.why : "")) }); return { l, log, calls, adv: ms => { for (let i = 0; i < ms / 1000; i++) { t += 1000; l.tick(); } }, jump: ms => { t += ms; l.tick(); }, t: () => t }; }
{
  const k = mkLink();
  ok(k.l.state() === "connecting", "link starts connecting");
  k.l.heard(true); ok(k.l.state() === "online", "seated -> online");
  k.l.netStatus("reconnecting"); ok(k.l.state() === "reconnecting", "relay drop -> reconnecting (seat kept)");
  k.l.netStatus("online"); ok(k.calls.send === 1, "relay back -> says hello at once");
  k.l.heard(false); ok(k.l.state() === "online", "the TV answers -> online");
  // TV goes quiet
  k.adv(21000); ok(k.calls.reconnect === 1 && k.l.state() === "reconnecting", "20 s of silence -> one forced reconnect");
  k.adv(10000); ok(k.calls.reconnect === 1, "no reconnect storm");
  k.adv(20000); ok(k.l.state() === "lost" && k.l.info().why === "tv", "45 s of silence with relays up -> lost: the TV is not answering");
  k.l.rejoin(); ok(k.l.state() === "reconnecting" && k.calls.reconnect === 2, "Rejoin button reconnects and tries again");
  k.l.heard(false); ok(k.l.state() === "online", "TV answers after Rejoin -> online");
}
{
  const k = mkLink(); // stale room code: never joined
  k.l.netStatus("online"); k.adv(10000); ok(k.l.state() === "connecting", "joining: patient for 25 s"); k.adv(16000);
  ok(k.l.state() === "lost" && k.l.info().why === "tv", "stale code / TV off: clear message after 25 s, not a silent hang");
  const k2 = mkLink(); k2.l.netStatus("offline"); k2.adv(26000); ok(k2.l.state() === "lost" && k2.l.info().why === "net", "no relay at all -> says it is the network");
}
{
  const k = mkLink(); k.l.heard(true); k.jump(300000); // phone slept 5 min: the first tick after it is a wake-up
  ok(k.l.state() === "reconnecting" && k.calls.reconnect === 1 && k.calls.send === 1, "wake after a long sleep: reconnect + hello, not an instant 'lost'");
  k.adv(1000); ok(k.l.state() === "reconnecting", "still gives the TV time to answer");
  k.l.heard(false); ok(k.l.state() === "online", "answered -> online");
  k.l.stop(); k.l.netStatus("offline"); k.adv(100000); ok(k.l.state() === "online", "after Leave the link is inert");
}

// ---- PartySave --------------------------------------------------------------------------------------------------------------------------------
function mem() { const d = {}; return { getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: k => { delete d[k]; }, d }; }
const rec = (x) => Object.assign({ kind: "game", game: "uno", room: "AB2CD", cfg: { cpu: 1 }, seats: [{ pid: "p1", color: "red", name: "Ann" }], cpun: {}, cpu: 1, st: { G: { turn: 2 } } }, x || {});
{
  global.localStorage = mem();
  ok(S.load().none === true, "nothing saved -> none");
  ok(S.save(rec()) === true, "save ok");
  let r = S.load(); ok(r.rec && r.rec.room === "AB2CD" && r.rec.st.G.turn === 2 && r.rec.v === S.VERSION, "round trip keeps room, seats, state, version");
  // simulate a TV reload: same storage, nothing else
  ok(S.load().rec.seats[0].pid === "p1", "seats survive a reload");
  // corrupt text
  localStorage.setItem(S.KEY, "{not json"); r = S.load(); ok(r.bad === "damaged" && localStorage.getItem(S.KEY) === null, "corrupt JSON is discarded, never throws");
  localStorage.setItem(S.KEY, JSON.stringify({ v: 99, ts: Date.now(), kind: "game", game: "uno", room: "AB2CD", seats: [] })); r = S.load(); ok(/version/.test(r.bad) && localStorage.getItem(S.KEY) === null, "other version is discarded");
  localStorage.setItem(S.KEY, JSON.stringify(Object.assign(rec(), { v: 1, ts: Date.now() - 2 * S.MAX_AGE_MS }))); r = S.load(); ok(r.bad === "too old", "stale save (2 days) is discarded");
  localStorage.setItem(S.KEY, JSON.stringify(Object.assign(rec(), { v: 1, ts: Date.now(), room: "x" }))); ok(S.load().bad === "damaged", "bad room code is discarded");
  localStorage.setItem(S.KEY, JSON.stringify(Object.assign(rec(), { v: 1, ts: Date.now(), seats: [{ pid: 5 }] }))); ok(S.load().bad === "damaged", "bad seat is discarded");
  localStorage.setItem(S.KEY, "null"); ok(S.load().bad === "damaged", "null record is discarded");
  // secrets and junk never stored
  S.save(rec({ cfg: { cpu: 1, apiToken: "SECRET", nested: { password: "x", ok: 1 } }, st: { fn() { }, el: { nodeType: 1 }, n: NaN } }));
  const txt = localStorage.getItem(S.KEY); ok(!/SECRET|password|apiToken/.test(txt) && /"ok":1/.test(txt), "secret-looking fields are not saved");
  ok(S.load().rec.st.n === null, "NaN becomes null, functions and DOM dropped");
  // cycle
  const cyc = { a: 1 }; cyc.me = cyc; ok(S.save(rec({ st: cyc })) === true && S.load().rec.st.a === 1, "a cyclic state does not crash the save");
  // size cap keeps the room and seats
  S.save(rec({ st: { big: "x".repeat(S.MAX_BYTES + 10) } })); r = S.load(); ok(r.rec && r.rec.st === null && r.rec.big === true && r.rec.seats.length === 1, "too-big state is dropped, room and seats still saved");
  // storage that throws
  global.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("x"); } };
  ok(S.save(rec()) === false && S.load().none === true, "blocked / full storage never throws");
  delete global.localStorage; ok(S.save(rec()) === false && S.load().none === true, "no storage at all never throws");
  global.localStorage = mem(); S.save(rec()); S.clear(); ok(S.load().none === true, "clear removes the save");
  const d = S.describe(rec({ ts: Date.now() - 5 * 60000 }), g => g.toUpperCase()); ok(d.title === "UNO" && /1 phone \+ 1 computer/.test(d.line) && /5 min ago/.test(d.line), "describe: title, players, age");
  ok(/restarts/.test(S.describe(rec({ st: null }), null).line) && !/restarts/.test(S.describe(rec({ st: null, own: true }), null).line), "describe: a game with no board says it restarts; a game with its own save does not");
}
Date.now = realNow;
console.log("party-net: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
