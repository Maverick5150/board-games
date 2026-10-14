/* Board Games UI icons: original 24px line glyphs (2px stroke, round joins), no <text>, no filters.
   BGUI.icon(name, opts) returns an inline <svg class="bg-ico"> string that inherits currentColor.
   opts: {cls: "extra classes", label: "accessible name"} (without a label the icon is aria-hidden).
   BGUI.icon.names = every name; BGUI.icon.seal(game) = the seal glyph name of a game. Only window.BGUI is touched. */
(function (w) {
  "use strict";
  if (!w) return;
  var BGUI = w.BGUI || (w.BGUI = {});
  var I = {
    "menu": "<path d=\"M4 7h16M4 12h16M4 17h16\"/>",
    "back": "<path d=\"M15 5l-7 7 7 7\"/>",
    "close": "<path d=\"M6 6l12 12M18 6L6 18\"/>",
    "check": "<path d=\"M5 12.5l4.5 4.5L19 7.5\"/>",
    "play": "<path d=\"M8 5.5v13l10.5-6.5z\" fill=\"currentColor\" stroke=\"none\"/>",
    "sound": "<path d=\"M4 9.5h3.5L12 5.5v13l-4.5-4H4z\" fill=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M15.5 9a4.2 4.2 0 0 1 0 6M18.2 6.5a8 8 0 0 1 0 11\"/>",
    "mute": "<path d=\"M4 9.5h3.5L12 5.5v13l-4.5-4H4z\" fill=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M16 9.5l5 5M21 9.5l-5 5\"/>",
    "help": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M9.6 9.4a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.7\"/><circle cx=\"12\" cy=\"17.2\" r=\".6\" fill=\"currentColor\"/>",
    "save": "<path d=\"M12 4v10M8 10.5l4 4 4-4\"/><path d=\"M4.5 15v3.5a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5V15\"/>",
    "load": "<path d=\"M3.5 7.5A1.5 1.5 0 0 1 5 6h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z\"/>",
    "reset": "<path d=\"M4.5 12a7.5 7.5 0 1 0 2.4-5.5\"/><path d=\"M4.5 4.5v4h4\"/>",
    "resume": "<path d=\"M12 7.5V12l3 2\"/><path d=\"M4.6 13.5A7.5 7.5 0 1 0 6.2 7\"/><path d=\"M4.5 3.8V8h4.2\"/>",
    "tv": "<rect x=\"3\" y=\"5\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8.5 20.5h7M12 17v3.5\"/>",
    "phone": "<rect x=\"7\" y=\"3\" width=\"10\" height=\"18\" rx=\"2.2\"/><path d=\"M11 18h2\"/>",
    "user": "<circle cx=\"12\" cy=\"8.5\" r=\"3.6\"/><path d=\"M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6\"/>",
    "cpu": "<rect x=\"5\" y=\"7.5\" width=\"14\" height=\"11\" rx=\"3\"/><path d=\"M12 7.5V4.5\"/><circle cx=\"12\" cy=\"3.8\" r=\"1\" fill=\"currentColor\"/><circle cx=\"9.3\" cy=\"12.6\" r=\"1.2\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"14.7\" cy=\"12.6\" r=\"1.2\" fill=\"currentColor\" stroke=\"none\"/><path d=\"M9.5 15.8h5\"/>",
    "gear": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7\"/>",
    "home": "<path d=\"M4 11.5L12 4.5l8 7\"/><path d=\"M6.5 10v9.5h11V10\"/><path d=\"M10 19.5v-5h4v5\"/>",
    "star": "<path d=\"M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z\"/>",
    "crown": "<path d=\"M4 17.5L3 8l5 4 4-6.5 4 6.5 5-4-1 9.5z\"/><path d=\"M4.5 20.5h15\"/>",
    "dice": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"16\" rx=\"3.5\"/><circle cx=\"8.5\" cy=\"8.5\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"15.5\" cy=\"15.5\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"12\" cy=\"12\" r=\"1.3\" fill=\"currentColor\" stroke=\"none\"/>",
    "cards": "<rect x=\"8\" y=\"3.5\" width=\"11\" height=\"15\" rx=\"2\" transform=\"rotate(10 13.5 11)\"/><rect x=\"4.5\" y=\"5.5\" width=\"11\" height=\"15\" rx=\"2\"/>",
    "music": "<path d=\"M9 18V6l11-2v12\"/><circle cx=\"6.5\" cy=\"18\" r=\"2.5\"/><circle cx=\"17.5\" cy=\"16\" r=\"2.5\"/>",
    "qr": "<rect x=\"4\" y=\"4\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"14\" y=\"4\" width=\"6\" height=\"6\" rx=\"1\"/><rect x=\"4\" y=\"14\" width=\"6\" height=\"6\" rx=\"1\"/><path d=\"M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM17.5 14H20M14 20h1.5\"/>",
    "arrow": "<path d=\"M5 12h14M13 6l6 6-6 6\"/>",
    "swap": "<path d=\"M7 7h11l-3-3M17 17H6l3 3\"/>",
    "trophy": "<path d=\"M8 4.5h8v5a4 4 0 0 1-8 0z\"/><path d=\"M8 6.5H5a3 3 0 0 0 3 4M16 6.5h3a3 3 0 0 1-3 4M12 13.5v3.5M8.5 20.5h7M9.5 17h5\"/>",
    "info": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5.5\"/><circle cx=\"12\" cy=\"7.8\" r=\".6\" fill=\"currentColor\"/>",
    "pawn": "<circle cx=\"12\" cy=\"6.5\" r=\"2.8\"/><path d=\"M9.3 10.6h5.4M10.4 10.6c0 3.1-1.9 5.6-3.4 7.9h10c-1.5-2.3-3.4-4.8-3.4-7.9M6 20.5h12\"/>",
    "flag": "<path d=\"M6 21V3.8\"/><path d=\"M6 4.5h11.5l-2.4 4 2.4 4H6\"/>",
    "pencil": "<path d=\"M4.5 19.5l1.1-4.3L15.9 4.9a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.8 18.4z\"/><path d=\"M14 6.8l3.2 3.2\"/>",
    "dome": "<path d=\"M4.5 16.5a7.5 7.5 0 0 1 15 0\"/><path d=\"M3 16.5h18v3H3z\"/><rect x=\"9.7\" y=\"10.2\" width=\"4.6\" height=\"4.6\" rx=\"1\"/>",
    "slide": "<path d=\"M3.5 12h12.5\"/><path d=\"M12.5 7.5L17 12l-4.5 4.5\"/><circle cx=\"19.6\" cy=\"12\" r=\"1.7\" fill=\"currentColor\"/>",
    "deed": "<rect x=\"5\" y=\"3.5\" width=\"14\" height=\"17\" rx=\"1.5\"/><path d=\"M5 8h14M8.5 11.5h7M8.5 14.5h7M8.5 17.5h4\"/>",
    "letter": "<rect x=\"3.5\" y=\"3.5\" width=\"17\" height=\"17\" rx=\"3.5\"/><path d=\"M14.5 8.6c-.6-.8-1.6-1.2-2.7-1.2-1.6 0-2.8.9-2.8 2.2 0 3 5.8 1.8 5.8 4.9 0 1.4-1.3 2.3-3 2.3-1.3 0-2.4-.5-3-1.4\"/>",
    "plus": "<path d=\"M12 5v14M5 12h14\"/>",
    "minus": "<path d=\"M5 12h14\"/>",
    "hourglass": "<path d=\"M7 3.5h10M7 20.5h10\"/><path d=\"M8 3.5c0 4.5 4 5.5 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 5.5-4 8.5s4 4 4 8.5\"/><path d=\"M10 18.5h4\" stroke-width=\"2.6\"/>",
    "chevron": "<path d=\"M9.5 5.5l6.5 6.5-6.5 6.5\"/>"
  };
  var SEAL = { trouble: "dome", sorry: "slide", monopoly: "deed", rummy500: "cards", risk: "flag", uno: "cards", scatter: "pencil", party: "tv" };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
  function icon(name, opts) {
    var p = I[name];
    if (!p) return "";
    opts = opts || {};
    var a = opts.label ? " role=\"img\" aria-label=\"" + esc(opts.label) + "\"" : " aria-hidden=\"true\"";
    return "<svg class=\"bg-ico" + (opts.cls ? " " + esc(opts.cls) : "") + "\" viewBox=\"0 0 24 24\" focusable=\"false\"" + a + ">" + p + "</svg>";
  }
  icon.names = Object.keys(I);
  icon.seal = function (game) { return SEAL[game] || "dice"; };
  BGUI.icon = icon;
})(typeof window !== "undefined" ? window : null);
