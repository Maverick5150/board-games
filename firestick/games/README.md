# Party Mode game plugins

A Party game in its own files, so a game builder never edits `firestick/index.html` (the TV host) or `firestick/play.html` (the phones).
The seven built-in games (Trouble, Sorry!, Monopoly, 500 Rummy, Risk, Uno, Scattergories) stay inside those two pages, unchanged.

```
firestick/games/registry.js     one line per plugin game (both pages load it)
firestick/games/<id>.js         the TV side       PartyGames.define(id, {...})
firestick/games/<id>-phone.js   the phone side    PartyGames.definePhone(id, {...})   (optional)
```

## 1. The registry line

```js
{id:"snakes", title:"Snakes and Ladders", n:"2-6", min:2, max:6, meta:"Climb and slide",
 files:{tv:["../snakes/engine.js","../snakes/board.js","games/snakes.js"], phone:["../snakes/engine.js","games/snakes-phone.js"]}}
```
- `files` paths are relative to `firestick/`, loaded in order, each once. Put the game's own engine first: Party uses the SAME engine as the
  phone game (pure, no DOM, plain-JSON state, `snapshot(G, seat)`), so a rule fixed on the phone side is fixed in Party too.
- Optional: `colors` (seat keys in seat order; default the 10 Party colours red, blue, green, yellow, orange, purple, teal, pink, black,
  brown), `palette` (`{key: ["#hex", "Name", luxeSeat1to10]}` for seats beyond those 10, e.g. War's 16), `thumb` (tile art; default
  `../ui/art/thumb-<id>.svg`), `felt` (the phones use the felt background), `pickColors` (phones pick one of the 4 classic colours in
  the lobby, as in Trouble and Sorry!).
- The tile appears after the seven built-in games. Picking it loads the TV files, then opens the lobby (QR, room code, phones join).
  A phone loads the phone files when it joins the room (its messages wait, in order, until they are in).
- Add the files to the hub's `sw.js` cache list only if the hub caches Party files (it does not today); `firestick/` has no service worker.

## 2. The TV side: `PartyGames.define(id, def)`

| `def` | |
|---|---|
| `defaults()` | the lobby settings object a new lobby starts with (official rules), e.g. `{version:"classic", over:{}}` |
| `lobby(api, cfg, el)` | draws the game's lobby box (Version, house rules, board pick...) into `el`; called again after every change |
| `versionName(cfg)` | the short name on the Start button ("Start Snakes and Ladders · 4 players · Milton Bradley 1943") |
| `restore(saved)` | optional: check a saved lobby setting (Save / Load in the lobby) before it is used |
| `start(H, cfg)` | runs the game (an `async` function is fine); an error thrown here goes back to the game picker with a toast |
| `skin` | optional `Skins.apply` / stage name (default the id) |
| `noWait` | `true`: a phone that reconnects gets only its open ask / your `onReconnect` snapshot, not "Waiting for your turn…" |

**The lobby api** (`lobby(api, cfg, el)`): `api.rules({versions, house, opts(cfg), show(houseRow, opts)})` draws the same Version cards and
rule rows as 500 Rummy / Risk / Uno (cfg = `{version, over}`; `house` rows `[key, label, "bool"|"choice", [[value,label]...], official]`,
row 4 truthy = tagged official, else "house"; `opts(cfg)` = the effective rules). Append your own rows after it (a board picker with the
big preview, "Who is the youngest?"). `api.redraw()` after a change, `api.set(cfg)` to replace the settings, `api.seated()` phones,
`api.players()` seats in play, `api.esc/attr/BG/toast/paintIcons`. Players, Computer players, Game speed, Computer skill and Save/Load
are the host's own rows: nothing to do. Style the lobby with CSS scoped by `html[data-pgame="<id>"]`.

**The host `H`** (`start(H, cfg)`), taken from what the built-in games use:

| Seats | |
|---|---|
| `H.seats` | `[{i, color, hex, seat, name, phone, cpu}]` in seat order: the phones' seats and the computers (fresh random names from names.js, robot badge via `chipHTML({cpu:true})`) |
| `H.colors`, `H.name(c)`, `H.hex(c)`, `H.seatNo(c)` | seat keys; the live name (a computer that took over a left phone gets its own name) |
| `H.isPhone(c)` / `H.isHuman(c)` / `H.isAway(c)` | a phone holds the seat now / and its player is not away (a phone that leaves mid-game: the computer plays that seat from then on) |
| `H.skill()` | "easy" / "normal" / "hard" (the lobby's Computer skill) for your AI brain |

| Time | |
|---|---|
| `H.sleep(ms)` | a pause scaled by Game speed (`H.pace()` multiplier, `H.speed()` "slow"/"medium"/"fast"). After a quit it never resolves, so the game loop just stops |
| `H.live()` | false once the game was quit (Back twice, New game) |

| Phones | |
|---|---|
| `await H.turn(c, st, {title, sub, timeoutMs})` | this seat's turn on its phone: sends `{t:"ask", kind:id, st}`; resolves `{id, data}` (what the phone's `api.act(id, data)` sent) or `null` = the computer plays this one (the phone timed out after 2 min: it is marked away and gets "Take over"; or it left) |
| `await H.ask(c, title, sub, options, extra)` | a plain choice: the phone shows the option buttons, no phone code needed (`options [{id,label,color}]`, `extra.dflt` = the safe default id) |
| `H.push(c, st)` / `H.pushAll(fn(c), skipColor)` | a snapshot to one phone / every phone (`{t:"pgs", st}`; `st.afk` is set for an away seat) |
| `H.wait(c, msg, turnC)`, `H.waitAll(exceptC, turnC, msg)`, `H.info(c, msg)` | "Waiting..." screens and a toast on a phone. An away seat gets no "Waiting..." (it keeps your last `H.push` snapshot with `st.afk` and its Take over). A game with its own phone view usually just `H.push`es snapshots instead |
| `H.interrupt(c)` | ends that seat's open ask now (resolves `null`) |
| `H.onReconnect(fn)` | a phone came back: re-send snapshots (its open ask is re-sent by the host) |
| `H.onView(fn(c, data))` | the phone's `api.view(data)` (taps that are not an answer: previews, "UNO!") |
| `H.onTakeOver(fn(c))`, `H.onLeave(fn(c))`, `H.onEnd(fn)` | Take over pressed / a phone left mid-game / the game is left (clean up timers) |
| `H.send(o)`, `H.sendTo(c, o)` | raw messages (every message carries `game: id`) |

| The TV | |
|---|---|
| `H.frame(html, hint)` | the game screen (top bar with the game and room, the TV hint bar). Mark the board `data-stage-solid` (or `.bg-frame`), text on the stage `data-stage-text` |
| `H.status(html)`, `H.hint(text)`, `H.toast(text)` | the bar's status line, the hint bar, a toast |
| `H.chipHTML(p)`, `H.markTurn(host, key)`, `H.seatStyle(hex)` | the Luxe player strip (`{color, name, meta, cpu, out, turn, badge}`) and its whose-turn ring |
| `H.css(text)` | a style sheet removed when the game ends |
| `H.back(fn(src))` | a TV Back step of your own (return a step name, or false to pass). Sheets opened with `BGUI.sheet` and the Victory screen close first by themselves; the host's own step is "press Back again to quit" |
| `H.sfx(name)`, `H.say(text)`, `H.music(style)` | `Sound.sfx`, `Sound.fromText`, `Sound.music` (register your style with `Sound.addStyle` in the game's own files) |
| `H.BG()`, `H.esc`, `H.attr`, `H.paintIcons`, `H.$` | helpers |

| Who goes first | |
|---|---|
| `H.firstResolve(n, draw, opts)` | the rule's result BEFORE the show (`BGUI.firstPlayer.resolve`; `null` without ui.js: pick it yourself) |
| `await H.first(o, firstC, dealC)` | the show, big on the TV; the phones get "You go first!" / "X goes first" (`o` = the BGUI.firstPlayer options: `mode, title, rounds, winner, players: H.fpPlayers(), result(w)`). Never draw a status, log line or ring that names the first player before it lands |

| Standings and the end | |
|---|---|
| `H.standings(fn)` | `fn()` returns rows `{name, color: hex, v: "12 pts", s: [score, tie-breakers...] (bigger first), win, at, k}`. The Victory screen (TV and phones) lists them in UNIQUE places 1 to N (up to 16): the winner, then `s`, then `at` (who got there first: a time or sequence number, smaller first), then `k` (seat order). Never two players on one place |
| `H.rank(rows)` | the same order for a live standings panel: a sorted copy, each row with `place` 1..N |
| `H.over(winnerName)` | the end: the phones' "X wins!" + Victory, the TV's Victory a moment later (New game / See the board) |

The Party save: the lobby's Save / Load keep the settings (`cfg` rides along as `pg`, per game: `party-<id>`). Party games are not
saved mid-game (the same as the built-in seven); a phone that drops reconnects to its seat and gets its view back.

## 3. The phone side: `PartyGames.definePhone(id, def)` (optional)

| `def` | |
|---|---|
| `show(st, ask, api)` | draw this phone's view of `st` (a `pgs` snapshot, `ask` null) or its turn (`ask` = the TV's ask, `st` = `ask.st`). Wrap it in an element with class `pgph` (the who-goes-first banner then leaves it on screen) |
| `reset(api)` | the game ended or the room closed |

`api`: `api.main` (the page's main box), `api.act(id, data)` answers the open turn (false if none), `api.asking()`, `api.view(data)`,
`api.take()` (Take over), `api.color()`, `api.name()`, `api.seat(c)`, `api.hex(c)`, `api.put(html)`, `api.toast(text)`, `api.optHTML(label,
attrs, color)` (a seat-coloured button), `api.afkHTML(id)` (the "computer is playing for you / Take over" line), `api.focusFirst()`,
`api.waiting(msg)`, `api.esc`, `api.BG`. Phone text >= 12 px, targets >= 44 px. Show `st.afk` with `api.afkHTML` + `api.take()`.

## 4. Checklist for a new Party game
1. The engine is the phone game's own (no copy). `snapshot(G, seat)` hides other players' private cards.
2. The registry line; `games/<id>.js` (lobby with Version + house rules, start); `games/<id>-phone.js` if the phone needs more than buttons.
3. Computers: the game's AI brain with `H.skill()`; every computer action visible and paced with `H.sleep`; hops one space at a time.
4. Who goes first with `H.firstResolve` + `H.first`; standings with `H.standings`; the end with `H.over`.
5. Test: TV 1920x1080 `?tv=1` + 2 phones (real keys on the TV, taps on the phones): lobby, start, turns, a phone reloaded mid-game,
   a phone that leaves, Back twice, Victory with places 1..N. Tests live under BG_audit; never in this folder.
6. Trying a plugin before it is listed: `PartyGames.add(line)` at run time. BG_audit/sprint/party2/pgtest-plugin.js (a tiny "Race Test"
   game injected by the test before the page's scripts) and pg_plugin.js (TV + 2 phones over the real relays) show the whole path.
   A phone's taps reach the TV a moment later: wait for the TV's state, never read it in the same instant you tapped.
