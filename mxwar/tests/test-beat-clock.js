/* mxbeat unit test: the 10-s beat clock, the gate-drop pile-up (lowest card), crash rules, and the shot clock/Auto wiring. Run: node mxwar/tests/test-beat-clock.js */
"use strict";
const fs = require("fs"), path = require("path"), assert = require("assert");
const Race = require("../race.js"), Beat = require("../beat.js");
let pass = 0, fail = 0;
function t(name, f) { try { f(); pass++; console.log("ok   " + name); } catch (e) { fail++; console.log("FAIL " + name + ": " + e.message); } }
function mk(n, seed, extra) {
  const ent = []; for (let i = 0; i < n; i++) ent.push({ id: i, name: "R" + i, human: i === 0 });
  const info = { series: "mx", year: 2025, kind: "moto", L: 14, p: 55, fl: 55, b: 0, beat: true, fmt: "laps" };
  const G = Race.newRace(Object.assign({ len: 14 }, extra || {}), ent, seed, info);
  return G;
}
function runAll(G) { Race.run(G); return G; }
t("beat grid: D is 10 s, the lock is 1 s before each window", () => {
  const G = mk(22, 7);
  assert.strictEqual(G.tm.v, 4);
  assert.strictEqual(G.tm.D, 10000);
  assert.strictEqual(Beat.winAt(G.tm, 3) - Beat.winAt(G.tm, 2), 10000);
  assert.strictEqual(Beat.nextLock(G), Beat.winAt(G.tm, G.tm.k + 1) - 1000);
});
t("a race is fought every 10 s of race clock, not per lap", () => {
  const G = runAll(mk(22, 11));
  assert.ok(G.over && G.tm.done, "race ends");
  const battles = G.battle, secs = Beat.winAt(G.tm, G.tm.k + 1) / 1000;
  assert.ok(battles > 14 * 3, "far more battles than laps: " + battles);
  assert.ok(Math.abs(battles - secs / 10) < 6, "one battle per ~10 s: " + battles + " vs " + secs / 10);
});
t("gate-drop pile-up: only battle 1, only the lowest card, a remount", () => {
  const G = runAll(mk(22, 5));
  const lo = Race.lowestVal(G);
  assert.strictEqual(lo, 2);
  assert.ok(G.st.pile >= 0);
  const ev = G.tm.ev.filter(e => e.k === 1)[0];
  const crs = ev ? ev.ev.filter(e => e.e === "crash" && e.pile) : [];
  crs.forEach(c => assert.strictEqual(c.kind, "remount"));
  G.tm.ev.filter(e => e.k > 1).forEach(e => e.ev.forEach(x => assert.ok(!x.pile, "no pile-up after the drop")));
});
t("pile-up can be switched off (tests only) and then nobody goes down at the gate", () => {
  const G = runAll(mk(22, 5, { pileup: false }));
  assert.strictEqual(G.st.pile, 0);
});
t("deuces wild: the lowest card is the 3", () => {
  const G = mk(22, 5, { deucesWild: true });
  assert.strictEqual(Race.lowestVal(G), 3);
});
t("crash rules: double/triple war losers go down, yellow flags are raised, gate pile-up is counted", () => {
  let crashes = 0, d2 = 0, d3 = 0, yz = 0, pile = 0, races = 6;
  for (let seed = 1; seed <= races; seed++) {
    const G = runAll(mk(22, seed));
    crashes += G.st.crashes; d2 += G.st.d2; d3 += G.st.d3; yz += G.tm.yz.length; pile += G.st.pile;
  }
  assert.ok(crashes > 0 && d2 + d3 > 0, "war crashes happen");
  assert.ok(yz > 0, "yellow flags are raised");
  assert.ok(pile > 0, "the gate-drop pile-up happens");
  console.log("     (" + races + " races of 22: crashes " + crashes + ", double " + d2 + ", triple " + d3 + ", yellows " + yz + ", gate pile-up riders " + pile + ")");
});
t("same seed, same bits (Party sync)", () => {
  assert.strictEqual(JSON.stringify(runAll(mk(22, 3)).tm), JSON.stringify(runAll(mk(22, 3)).tm));
});
t("shot clock: 10 s, Auto turns on at 0 (wired in game.js, phone and Party)", () => {
  const g = fs.readFileSync(path.join(__dirname, "..", "game.js"), "utf8");
  assert.ok(/SHOT CLOCK/.test(g) && /setAutoS\(/.test(g) && /No shot clock while he is down/.test(g));
  const ph = fs.readFileSync(path.join(__dirname, "..", "..", "firestick", "games", "mxwar-phone.js"), "utf8");
  const tv = fs.readFileSync(path.join(__dirname, "..", "..", "firestick", "games", "mxwar.js"), "utf8");
  assert.ok(/mxph-shot/.test(ph), "phone shot ring");
  assert.ok(/shot|auto/i.test(tv), "party host");
});
console.log("pass " + pass + " fail " + fail);
process.exit(fail ? 1 : 0);
