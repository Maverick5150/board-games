/* 500 Rummy Party TV table: seat-based layout, measured in real headless Edge (browser kit; run through .dev/run-one.ps1).
   For 2..8 players at 1080p and 720p: every meld sits in its owner's zone, zones sit on the right sides, nothing overlaps or is clipped,
   lay-off tags show the layer's name and colour, and the credit ("Ann > Bob") when the house rule sends the points to the meld's owner. */
const B = require("C:/Users/Maverick/AppData/Local/Temp/jsdomtest/kit/browser.js"); const path = require("path");
const ROOT = path.join(__dirname, "..", "..").replace(/\\/g, "/"); const SHOTS = process.env.RV_SHOTS || "";
let n = 0; const fails = []; const ok = (c, m) => { n++; if (!c) fails.push(m); };
const MEASURE = `(function(){
  function R(e){ var r=e.getBoundingClientRect(); return [r.left,r.top,r.right,r.bottom]; }
  var out={zones:[],clip:[],tags:[]};
  document.querySelectorAll(".rvz").forEach(function(z){ var ms=z.querySelectorAll(".meld"); out.zones.push({seat:+z.dataset.seat,side:z.dataset.side,r:R(z),melds:[].map.call(ms,function(m){ return {id:+m.dataset.m,r:R(m)}; })});
    var box=z.querySelector(".rvmelds"); if(box.scrollHeight>box.clientHeight+1||box.scrollWidth>box.clientWidth+1) out.clip.push(+z.dataset.seat); });
  out.mid=R(document.querySelector(".rvmid")); out.table=R(document.getElementById("rtable"));
  document.querySelectorAll(".lopill").forEach(function(p){ out.tags.push({t:p.textContent,lay:+p.dataset.lay,credit:+p.dataset.credit,bg:getComputedStyle(p).backgroundColor,fs:parseFloat(getComputedStyle(p).fontSize)}); });
  out.rings=document.querySelectorAll(".pc.lay").length;
  out.minCard=Math.min.apply(null,[].map.call(document.querySelectorAll(".rvz .meld .pc"),function(c){ return c.getBoundingClientRect().width; }).concat([999]));
  out.docW=document.documentElement.scrollWidth; out.docH=document.documentElement.scrollHeight; return JSON.stringify(out); })()`;
const hit = (a, b) => a[0] < b[2] - .5 && b[0] < a[2] - .5 && a[1] < b[3] - .5 && b[1] < a[3] - .5;
const inside = (a, b) => a[0] >= b[0] - .5 && a[1] >= b[1] - .5 && a[2] <= b[2] + .5 && a[3] <= b[3] + .5;
const WANT = { 2: "bt", 3: "blr", 4: "blrt", 5: "blrtt", 6: "bblrtt", 7: "bblrttt", 8: "bbllttrr" };
const run = async (b, expr) => { const r = await b.eval(expr); return typeof r === "string" ? r : JSON.stringify(r); };
(async () => {
  for (const [w, h] of [[1920, 1080], [1280, 720]]) {
    const b = await B.open({ width: w, height: h, scale: 1, root: ROOT });
    try {
      await b.go("firestick/test/rummy-table.html");
      for (const np of [2, 3, 4, 5, 6, 7, 8]) for (const total of [0, 10, 18]) {
        const info = JSON.parse(await run(b, `JSON.stringify(build(${np},${total},{}))`));
        const m = JSON.parse(await b.eval(MEASURE)); const tag = `${w}x${h} n${np} melds${info.melds}`;
        ok(m.zones.length === np, tag + " one zone per player");
        ok(m.zones.map(z => z.side).sort().join("") === WANT[np].split("").sort().join(""), tag + " sides " + m.zones.map(z => z.side).join(""));
        m.zones.forEach(z => { ok(inside(z.r, m.table), tag + " zone " + z.seat + " inside the table"); z.melds.forEach(me => ok(inside(me.r, z.r), tag + " meld " + me.id + " inside zone " + z.seat)); });
        for (let i = 0; i < m.zones.length; i++) {
          for (let j = i + 1; j < m.zones.length; j++) ok(!hit(m.zones[i].r, m.zones[j].r), tag + " zones " + i + "/" + j + " overlap");
          ok(!hit(m.zones[i].r, m.mid), tag + " zone " + i + " overlaps the piles");
          const ms = m.zones[i].melds; for (let p = 0; p < ms.length; p++) for (let q = p + 1; q < ms.length; q++) ok(!hit(ms[p].r, ms[q].r), tag + " melds overlap in zone " + i);
        }
        ok(m.clip.length === 0, tag + " nothing clipped (zones " + m.clip + ")");
        ok(m.docW <= w + 1 && m.docH <= h + 2, tag + " fits the screen " + m.docW + "x" + m.docH);
        ok(info.lays === 0 || (m.tags.length >= 1 && m.rings >= 1), tag + " lay-off tags and rings shown");
        m.tags.forEach(t => ok(t.fs >= 19 * h / 1080 - .5, tag + " tag text readable " + t.fs));
        if (total) ok(m.minCard >= (h / 1080) * 3.2 * 10.8 * 0.95, tag + " smallest card " + m.minCard.toFixed(1) + "px");
        if (SHOTS && total === 18 && (np === 2 || np === 4 || np === 8)) await b.shot(`${SHOTS}/rv-${w}-n${np}.png`);
      }
      await b.eval("build(4,12,{})"); let m = JSON.parse(await b.eval(MEASURE));
      m.zones.forEach(z => z.melds.forEach(me => ok((me.id - 1) % 4 === z.seat, "meld " + me.id + " is in its owner's zone " + z.seat)));
      await b.eval("build(3,6,{layoffScoring:true})"); let t = JSON.parse(await b.eval(MEASURE)).tags;
      ok(t.length > 0 && t.every(x => x.credit === x.lay && !/>/.test(x.t)), "rule on: tag shows the layer only: " + JSON.stringify(t.map(x => x.t)));
      await b.eval("build(3,6,{layoffScoring:false})"); t = JSON.parse(await b.eval(MEASURE)).tags;
      ok(t.length > 0 && t.every(x => x.credit !== x.lay && / > /.test(x.t)), "rule off: tag shows layer > owner: " + JSON.stringify(t.map(x => x.t)));
      ok(t.every(x => /^rgb/.test(x.bg)), "tags carry the layer's colour");
    } finally { await b.close(); }
  }
  console.log(fails.length ? "FAILS:\n" + fails.slice(0, 40).join("\n") + "\n(" + fails.length + " of " + n + ")" : "rummy table layout tests passed: " + n);
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
