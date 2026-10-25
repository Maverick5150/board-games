/* 500 Rummy house rules: starting hand size, lay-off scoring, 5-10-15, stock-out, jokers, aces. Plain node, no browser. */
const assert = require("assert"), path = require("path"), root = path.join(__dirname, "..", "..", "rummy500");
const R = require(path.join(root, "engine.js")); const GM = require(path.join(root, "game.js"));
let n = 0; const ok = (c, m) => { assert(c, m); n++; };
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function game(np, opts, ver) { return GM.newGame({ names: Array.from({ length: np }, (_, i) => "P" + i), humans: Array(np).fill(false), opts: R.versionOpts(ver || "standard", opts || {}), rnd: rng(7 + np), dealer: 0 }); }
let id = 5000; const C = (r, s) => ({ id: id++, r, s });
const std0 = R.versionOpts("standard", {});

// 1. starting hand size
for (const np of [2, 3, 4, 5, 6, 7, 8]) {
  const std = np === 2 ? 13 : 7;
  ok(R.handSizeFor(std0, np) === std, "standard deal " + np);
  const ch = R.handSizeChoices(np, std0); ok(ch[0][0] === 0 && /Standard/.test(ch[0][1]), "first choice is the standard deal");
  ok(ch.every(c => c[0] === 0 || (c[0] >= 7 && c[0] <= 15 && c[0] !== std)), "choices 7..15 " + np);
  const mx = R.maxHandSize(std0, np); ok(mx >= 7 && mx <= 15, "max " + np + "=" + mx);
  ok(ch.length === 1 + (mx - 7 + 1) - (std >= 7 && std <= mx ? 1 : 0), "choice count " + np);
  for (const c of ch) {
    const g = game(np, { handSize: c[0] }); GM.startRound(g);
    const per = c[0] || std; ok(g.players.every(p => p.hand.length === per), "dealt " + per + " to " + np);
    ok(g.discard.length === 1 && g.stock.length >= 8, "deck supplies " + per + " for " + np + " (stock " + g.stock.length + ")");
    const all = [].concat(...g.players.map(p => p.hand), g.stock, g.discard);
    ok(new Set(all.map(x => x.id)).size === R.makeDeck(g.o).length && all.length === R.makeDeck(g.o).length, "every card dealt once");
  }
}
ok(R.handSizeChoices(8, std0).length < R.handSizeChoices(2, std0).length, "fewer choices for a big table");
ok(R.maxHandSize(std0, 4) === 11, "4 players, one deck: 11");
ok(R.maxHandSize(R.versionOpts("standard", { jokers: 0 }), 4) === 10, "no jokers shrinks the limit");
{ const g = game(4, { handSize: 15 }); GM.startRound(g); ok(g.players[0].hand.length === 11, "a too-big size is clamped to the deck"); }
{ const g = game(4, { handSize: 9 }, "five"); GM.startRound(g); ok(g.players[0].hand.length === 9, "5-10-15 takes a hand size"); }
{
  R.setSeats(3, std0); const hs = R.HOUSE.filter(h => h[0] === "handSize")[0]; ok(hs[3].length >= 2 && hs[3][0][0] === 0, "HOUSE row follows the seats");
  R.setSeats(8, std0); ok(R.HOUSE.filter(h => h[0] === "handSize")[0][3].every(c => c[0] <= R.maxHandSize(std0, 8)), "8 seats: only dealable sizes");
}
ok(R.defaultOpts().handSize === 0, "default = standard deal");

// 2. lay-off scoring
function layoffGame(rule, ver) {
  const g = game(3, { layoffScoring: rule }, ver); GM.startRound(g); g.turn = 1; g.phase = "play";
  const run = R.buildRun([C(4, "H"), C(5, "H"), C(6, "H")], g.o); run.id = 1; run.owner = 0; run.cards.forEach(e => { e.by = 0; e.lay = 0; }); g.melds = [run]; g.nextMeldId = 2;
  g.players[0].hand = [C(2, "C"), C(3, "C")]; g.players[2].hand = [C(2, "D")];
  const k = C(7, "H"); g.players[1].hand = [k, C(9, "S"), C(10, "D")]; return { g, k };
}
for (const ver of ["standard", "five"]) {
  let { g, k } = layoffGame(true, ver); let r = GM.layOffCard(g, 1, k.id); ok(r.ok, "layoff ok " + ver);
  let e = g.melds[0].cards.filter(x => x.c.id === k.id)[0]; ok(e.by === 1 && e.lay === 1, "rule on: credit to the layer " + ver);
  let rows = GM.endRound(g, "stock", null).roundOver.rows; const v = R.meldCardValue(g.o, e, "run");
  ok(v === (ver === "five" ? 5 : 7), "value of a 7");
  ok(rows[1].melded === v, "layer scores the card " + ver); ok(rows[0].melded === R.meldPoints({ cards: g.melds[0].cards.filter(x => x.c.id !== k.id), kind: "run" }, g.o), "owner keeps only own cards");
  ({ g, k } = layoffGame(false, ver)); GM.layOffCard(g, 1, k.id); e = g.melds[0].cards.filter(x => x.c.id === k.id)[0];
  ok(e.by === 0 && e.lay === 1, "rule off: credit to the owner, laid by P1 " + ver);
  rows = GM.endRound(g, "stock", null).roundOver.rows; ok(rows[1].melded === 0, "layer gets nothing " + ver); ok(rows[0].melded === R.meldPoints(g.melds[0], g.o), "owner gets the whole meld " + ver);
}
ok(R.versionOpts("five").layoffScoring === true, "5-10-15 mode: ON");
ok(R.versionOpts("standard").layoffScoring === true && R.versionOpts("classic").layoffScoring === true, "on in other modes too (the standard rule), switchable");
{
  let { g, k } = layoffGame(true); GM.layOffCard(g, 1, k.id); let rw = GM.endRound(g, "stock", null).roundOver.rows;
  ok(rw[0].melded === 15 && rw[1].melded === 7, "on: owner 15, layer 7");
  ({ g, k } = layoffGame(false)); GM.layOffCard(g, 1, k.id); rw = GM.endRound(g, "stock", null).roundOver.rows;
  ok(rw[0].melded === 22 && rw[1].melded === 0, "off: owner 22, layer 0");
}
{ // two lay-offs: both tagged with the layer, both credited to the owner when the rule is off
  const { g, k } = layoffGame(false); const h8 = C(8, "H"); g.players[1].hand.push(h8);
  GM.layOffCard(g, 1, k.id); GM.layOffCard(g, 1, h8.id); const es = g.melds[0].cards;
  ok(es.every(e => e.by === 0) && es.filter(e => e.lay === 1).length === 2, "both laid cards credited to the owner, tagged P1");
}
{ // undo keeps the credit fields
  const { g, k } = layoffGame(true); g.snap = { hand: g.players[1].hand.slice(), melds: g.melds.map(m => Object.assign({}, m, { cards: m.cards.map(e => Object.assign({}, e)) })), mustUse: null, mustNew: false, noDiscard: null, nextMeldId: 2 };
  GM.layOffCard(g, 1, k.id); GM.undo(g); ok(g.melds[0].cards.length === 3 && g.melds[0].cards.every(e => e.by === 0 && e.lay === 0), "undo restores the meld");
}
{ // teams: a partner lays on a team mate's meld; points go to the layer's team (rule on) or the owner's team (off) - same team here
  const g = GM.newGame({ names: ["A", "B", "C", "D"], humans: [0, 0, 0, 0], opts: R.versionOpts("partner", {}), rnd: rng(3), dealer: 0 }); GM.startRound(g); g.turn = 2; g.phase = "play";
  const run = R.buildRun([C(4, "H"), C(5, "H"), C(6, "H")], g.o); run.id = 1; run.owner = 0; run.cards.forEach(e => { e.by = 0; e.lay = 0; }); g.melds = [run];
  const k = C(7, "H"); g.players[2].hand = [k, C(9, "S")]; GM.layOffCard(g, 1, k.id); ok(g.melds[0].cards.slice(-1)[0].by === 2 && g.melds[0].cards.slice(-1)[0].lay === 2, "partner layoff scores for the team");
}

// 3. the other rules in the list: each really changes play
{ const o = R.versionOpts("standard", { aceHigh: false }); ok(!R.buildRun([C(12, "S"), C(13, "S"), C(1, "S")], o), "aceHigh off: no Q-K-A"); ok(!!R.buildRun([C(1, "S"), C(2, "S"), C(3, "S")], o), "...but A-2-3 stays"); }
{ const o = R.versionOpts("standard", { aceLow: false }); ok(!R.buildRun([C(1, "S"), C(2, "S"), C(3, "S")], o), "aceLow off: no A-2-3"); ok(!!R.buildRun([C(12, "S"), C(13, "S"), C(1, "S")], o), "...but Q-K-A stays"); }
{ const o = R.versionOpts("standard", { jokerMode: "group" }); ok(!R.buildSet([C(5, "S"), C(5, "H"), { id: 1, r: 0, s: "J", joker: true }], o), "jokerMode group: not wild"); ok(!!R.buildSet([C(5, "S"), C(5, "H"), { id: 1, r: 0, s: "J", joker: true }], std0), "wild by default"); }
{ const g = game(2, { emptyStock: "reshuffle" }); GM.startRound(g); g.discard = g.discard.concat(g.stock.splice(0, g.stock.length)); const total = g.discard.length; const r = GM.drawStock(g);
  ok(r.ok && !g.roundOver && g.stock.length === total - 2, "empty stock + reshuffle: the pile is reshuffled"); }
{ const g = game(2, { emptyStock: "end" }); GM.startRound(g); g.stock = []; GM.drawStock(g); ok(g.roundOver && g.roundOver.reason === "stock", "empty stock + end: round ends"); }
for (const key of ["handSize", "layoffScoring", "emptyStock", "jokerMode", "aceLow", "aceHigh"]) ok(R.HOUSE.some(h => h[0] === key) && R.HOUSE_HELP[key], "house row + one-line help: " + key);
ok(R.HOUSE.every(h => R.HOUSE_HELP[h[0]]), "every house rule has its one-liner");
ok(new Set(R.HOUSE.map(h => h[0])).size === R.HOUSE.length, "no duplicate house rows");

// 4. a whole AI game with odd sizes still finishes
for (const [np, hs, ver] of [[2, 9, "standard"], [4, 10, "five"], [6, 12, "standard"]]) {
  const g = game(np, { handSize: hs, layoffScoring: ver !== "five" }, ver); GM.startRound(g); let guard = 0;
  while (!g.over && guard++ < 30000) { if (g.roundOver) GM.startRound(g); else GM.applyAction(g, GM.aiAction(g)); }
  ok(g.over, "AI game finishes " + np + "p hand " + hs);
}
console.log("rummy house-rule tests passed:", n);
