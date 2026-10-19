/* Party Mode game plugins: the registry (firestick/games/README.md is the guide).
   One line per plugin game. index.html (the TV host) and play.html (the phones) both load this file; a plugin's own files load only when
   its game is picked (TV) or its room is joined (phone). The seven built-in Party games (Trouble, Sorry!, Monopoly, 500 Rummy, Risk, Uno,
   Scattergories) live in index.html / play.html and are not listed here.
   A line: {id, title, n:"2-6" (the badge), min, max, meta (the tile's one-liner), files:{tv:[...], phone:[...]} (paths from firestick/,
   loaded in order: the game's own engine first, then games/<id>.js or games/<id>-phone.js), and optional: colors (seat keys in seat
   order, default the 10 Party colours), palette ({key:["#hex","Name",luxeSeat]} for seats beyond the 10), thumb (tile art), felt (the
   phone's felt table background instead of the scene), pickColors (phones pick a colour in the lobby, 4 classic colours only)}. */
(function (g) {
  "use strict";
  var LIST = [
    {id:"snakes", title:"Snakes and Ladders", n:"2-6", min:2, max:6, meta:"Climb and slide", colors:["red","blue","green","yellow","purple","teal"],
     files:{tv:["../snakes/boards.js","../snakes/engine.js","../snakes/brain.js","../snakes/board.js","../ui/picker.js","games/snakes.js"], phone:["games/snakes-phone.js"]}},
    {id:"candy", title:"Candy Land", n:"2-4", min:2, max:4, meta:"Draw a colour, hop the road", colors:["red","blue","green","yellow"], pickColors:true,
     files:{tv:["../candy/engine.js","../candy/brain.js","../candy/board.js","../ui/picker.js","games/candy.js"], phone:["../candy/board.js","games/candy-phone.js"]}},
    {id:"war", title:"War", n:"2-16", min:2, max:16, meta:"Flip, tie, declare war", thumb:"../ui/art/hero-war.svg", felt:true,
     colors:["red","blue","green","yellow","orange","purple","teal","pink","black","brown","lime","sky","magenta","cream","mint","coral"],
     palette:{lime:["#b6e04e","Lime",3], sky:["#7cc8ff","Sky",2], magenta:["#ea6fe0","Magenta",8], cream:["#eadcb4","Cream",4], mint:["#86ecc4","Mint",6], coral:["#ff8f80","Coral",1]},   /* war/index.html's seats 11-16 */
     files:{tv:["../war/engine.js","../war/brain.js","../war/cards.js","games/war.js"], phone:["../war/cards.js","games/war-phone.js"]}},
    {id:"mxwar", title:"Motocross War", n:"1-16", min:1, max:16, meta:"A real season, every lap a War flip",
     colors:["red","blue","green","yellow","orange","purple","teal","pink","black","brown","lime","sky","magenta","cream","mint","coral"],
     palette:{lime:["#b6e04e","Lime",3], sky:["#7cc8ff","Sky",2], magenta:["#ea6fe0","Magenta",8], cream:["#eadcb4","Cream",4], mint:["#86ecc4","Mint",6], coral:["#ff8f80","Coral",1]},   /* seats 11-16 as War */
     files:{tv:["../mxwar/data/index.js","../mxwar/race.js","../mxwar/time.js","../mxwar/round.js","../mxwar/season.js","../mxwar/data/history.js","../mxwar/announce-lines.js","../mxwar/intensity-data.js","../mxwar/intensity.js","../mxwar/announce.js","../mxwar/brain.js","../mxwar/art.js","../mxwar/track.js","../mxwar/course.js","../mxwar/layouts.js","../mxwar/data/tracks.js","../ui/voice.js","../mxwar/booth.js","../ui/picker.js",/* [bcast] the broadcast's sound and the music director: the TV plays the music, the phones load none of it */"../mxwar/mxsound.js","../mxwar/mxmusic.js",/* [/bcast] */"games/mxwar.js"], phone:["../mxwar/art.js","games/mxwar-phone.js"]}}   /* the race view: the 3D race (mxwar/race3d.js, imported by games/mxwar.js; course.js, layouts.js and data/tracks.js are the classic scripts it rides on) over track.js (the race clock and the 2D fallback); the announcers (announce*.js, ui/voice.js, booth.js) speak on the TV only: the phones never load them (ui/voice.css comes with voice.js) */
  ];
  var tvDefs = {}, phoneDefs = {}, loaded = {}, loading = {};
  function get(id) { for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i]; return null; }
  function loadOne(src) {
    if (loaded[src]) return Promise.resolve();
    if (loading[src]) return loading[src];
    loading[src] = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = src; s.async = false;
      s.onload = function () { loaded[src] = true; delete loading[src]; res(); };
      s.onerror = function () { delete loading[src]; rej(new Error("could not load " + src)); };
      (document.head || document.documentElement).appendChild(s);
    });
    return loading[src];
  }
  g.PartyGames = {
    list: function () { return LIST.slice(); },
    get: get,
    has: function (id) { return !!get(id); },
    /* add a line at run time (a test, or a game page that wants to try its plugin before it is listed); a known id is replaced */
    add: function (e) { if (!e || !e.id) return; for (var i = 0; i < LIST.length; i++) if (LIST[i].id === e.id) { LIST[i] = e; return; } LIST.push(e); },
    /* the plugin files call these */
    define: function (id, def) { tvDefs[id] = def; },
    definePhone: function (id, def) { phoneDefs[id] = def; },
    tv: function (id) { return tvDefs[id] || null; },
    phone: function (id) { return phoneDefs[id] || null; },
    /* side "tv" | "phone": loads that side's files in order (each file once), resolves with the side's definition (phone: may be null =
       the phone uses the generic option buttons) */
    load: function (id, side) {
      var e = get(id); if (!e) return Promise.reject(new Error("unknown Party game " + id));
      var have = side === "phone" ? phoneDefs[id] : tvDefs[id];
      var files = (e.files && e.files[side]) || [];
      if (have && files.every(function (f) { return loaded[f]; })) return Promise.resolve(have);
      if (have && !files.length) return Promise.resolve(have);
      return files.reduce(function (p, f) { return p.then(function () { return loadOne(f); }); }, Promise.resolve()).then(function () {
        var d = side === "phone" ? phoneDefs[id] : tvDefs[id];
        if (side === "tv" && !d) throw new Error(id + ": games/" + id + ".js did not call PartyGames.define");
        return d || null;
      });
    },
    /* a plugin's seat colours added to a page's colour tables (never replaces a colour the page has) */
    palette: function (id, COL, NAME, SEATNO) {
      var e = get(id), p = e && e.palette; if (!p) return;
      Object.keys(p).forEach(function (k) { var v = p[k]; if (COL && !COL[k]) COL[k] = v[0]; if (NAME && !NAME[k]) NAME[k] = v[1]; if (SEATNO && !SEATNO[k]) SEATNO[k] = v[2] || 1; });
    }
  };
})(window);
