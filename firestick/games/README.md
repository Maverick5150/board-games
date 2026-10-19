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
{id:"snakes", title:"Snakes and Ladders", n:"2-6", min:2, max:6, meta:"Climb and slide", colors:["red","blue","green","yellow","purple","teal"],
 files:{tv:["../snakes/boards.js","../snakes/engine.js","../snakes/brain.js","../snakes/board.js","../ui/picker.js","games/snakes.js"], phone:["games/snakes-phone.js"]}}
```
- `files` paths are relative to `firestick/`, loaded in order, each once. Put the game's own engine first: Party uses the SAME engine as the
  phone game (pure, no DOM, plain-JSON state, `snapshot(G, seat)`), so a rule fixed on the phone side is fixed in Party too.
- Optional: `colors` (seat keys in seat order; default the 10 Party colours red, blue, green, yellow, orange, purple, teal, pink, black,
  brown), `palette` (`{key: ["#hex", "Name", luxeSeat1to10]}` for seats beyond those 10, e.g. War's 16), `thumb` (tile art; default
  `../ui/art/thumb-<id>.svg`), `felt` (the phones use the felt background), `pickColors` (phones pick one of the 4 classic colours in
  the lobby, as in Trouble and Sorry!).
- A plugin that SPEAKS (Motocross War's announcers) lists the shared voice among its TV files: `../mxwar/announce-lines.js`, `../mxwar/announce.js`,
  `../ui/voice.js` (it loads `ui/voice.css` itself when the captions are mounted) and `../mxwar/booth.js`. Only the TV loads them: the phones' files never
  do, so the phones are silent. The TV speaks through the Fire TV app's text-to-speech bridge (`window.AndroidTV`), else the browser's voices, else captions. The announcers are men: only a voice known to be a man's is ever used (`ui/voice.js`, and `MenVoices.kt` in the app); a TV with no man's voice shows captions.
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
| `H.sleep(ms)` | a pause scaled by Game speed: it waits `ms x H.pace()`, and the pace is 1.8 at Medium (0.9 Fast, 3.15 Slow), so `H.sleep(ms / 1.8)` waits `ms` at Medium like the phone game's `dl(ms)`; animation lengths: `ms * H.pace() / 1.8` (`H.speed()` "slow"/"medium"/"fast"). After a quit it never resolves, so the game loop just stops |
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
| `H.onRejoin(fn(c))` | optional: a phone took seat `c` back by invite (section 8); `H.name(c)` is that player's name again. Without it the host calls your `onLeave(c)`, then your `onTakeOver(c)` |
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

## 5. Notes from the first plugin (Snakes and Ladders, games/snakes.js)
- The whole plugin is three files: the registry line, `games/snakes.js` (lobby + TV game) and `games/snakes-phone.js`. The phone gets a slim
  view built from `snapshot(G, seat)` (no board layout over the relays); the roll happens on the TV.
- Lobby extras go into the box after `api.rules(...)`: insert your section after the Version section (`el.querySelectorAll('.ps-sec')[0]`).
  The big-preview picker is `BGUI.picker` (add `../ui/picker.js` to your `files.tv`); its `refocus` puts the ring back on your row.
  Re-focus your own rows after a redraw (renderRuleBox restores only `data-k` / `data-v` buttons).
- The lobby api has the seat COUNT (`api.players()`, `api.seated()`), not the seated names: snakes.js reads the host's seat cards
  (`#players .bg-seatcard:not(.bg-seatcard--empty)`, `data-seat` + `.bg-seatcard__name`) for its "Youngest player" row, and a
  MutationObserver on `#players` redraws its box when the count or the phones change (the host redraws only its own rows then).
- Engine rule rows with a "house" flag must be flipped for `api.rules` (its row[4] means OFFICIAL). Rows whose choices depend on other
  rules: pass the rows computed for the current rules on every redraw (the lobby box is redrawn after each change).
- The host puts "Players: use your phones" back in the hint bar when an ask ends: set `H.hint(...)` again when your next step starts.
- After `H.over` the host adds New Game UNDER the hint bar: leave room for it (snakes.js shrinks the board and the log by a class on
  game over), or the TV page scrolls and the board's top is cut.
- A game save of your own works (the host saves only lobby settings): snakes.js autosaves `G` after every roll in localStorage
  ("party-snakes-live") and offers "Continue the saved game" in its lobby box when the table has the same number of seats.
- Expose test hooks on `window.__<id>` (the order of what played, counters, a resync), never test-only behaviour: the tests
  (BG_audit/sprint/party2/sn_party.js) rig dice through the engine's own `G.rig` queue.


## 6. Notes from the second plugin (Candy Land, games/candy.js)
- Registry: `{id:"candy", ..., colors:["red","blue","green","yellow"], pickColors:true, files:{tv:["../candy/engine.js","../candy/brain.js",
  "../candy/board.js","../ui/picker.js","games/candy.js"], phone:["../candy/board.js","games/candy-phone.js"]}}`. A phone may load the
  game's art file too (the cards on the phone are candy/board.js's own `cardSVG`; the phone side falls back to a swatch without it).
- A game with a real choice inside a turn ("draw two, choose one"): two `H.turn` asks in a row (`st.ask` "draw", then "pick" with the two
  cards, their exact outcomes and the best one marked). The phone shows an ask only when `api.ask.st.step` AND `.phase` match the snapshot.
- Picture of each Version in the lobby: build the board once into a detached element and cache its HTML (`preview()` in candy.js); take
  out any text that would fall under the TV floor at thumbnail size. The picker then works as for Snakes (Back closes, OK picks).
- The who-goes-first show in `layout:"peek"` hides its title: use the full layout when the title carries the rule ("The youngest player
  goes first").
- The phone keeps the line of the move BEFORE while the TV still animates the next one (the new log line would spoil it).
- While a choice plays out, keep each card's outcome text from the moment of the choice (after `apply` the engine's state has moved on).

## 7. Notes from the third plugin (War, games/war.js: 2 to 16 seats, everyone acts at once)
- Registry: `{id:"war", n:"2-16", min:2, max:16, colors:[the 10 Party colours + "lime","sky","magenta","cream","mint","coral"],
  palette:{lime:["#b6e04e","Lime",3], ...}}` (war/index.html's seats 11-16). `max` sets the room size and the lobby's computer row
  (0-14 with 2 phones); nothing in index.html / play.html changes for 16. `thumb` may point at a hero poster (`object-fit: cover` crops it).
- A simultaneous game: start one `H.turn` per person AT ONCE (each phone gets its own ask; the host keeps them apart by request id) and let
  the computers act on timers; apply each answer the moment it arrives, and play the table's events once the engine resolves. Several
  open asks are fine; `H.interrupt(c)` ends one (the Auto switch uses it).
- An "Auto" switch on the phone: `api.view({auto:true})` -> `H.onView` keeps it per seat; the TV then plays that seat like a computer
  (but the player stays a person, not "away"). Put such a switch ABOVE the main button: a Flip that appears under a finger on the way to
  the switch gets tapped instead (seen in the test). The phone re-sends the switch until the TV's snapshot confirms it, and answers an
  ask that crossed the switch by itself.
- Many phones: debounce the snapshots (`pushSoon`, 450 ms) while seats act one by one; push at once at the turn boundaries.
- A layout for 2 to 16 seats: try every column count, keep the one that gives the largest card, place the first half of the seats above a
  centre band and the rest below; the side rail's row height comes from the room left (`--rh`) and is a fixed `height`, never `min-height`
  (16 rows of 1.5rem fit 1080p with the hint bar clear). A 16-row Victory uses the host's two-column card by itself.
- A game with no first player (everyone acts at once) plays its deal as the opening show instead of `H.first` (OK skips it).
- Tests: `window.__warp` (counters, the seats' Auto map, `sync()`); rig a war by swapping cards between packets (the engine's check stays
  clean). A live game guards the TV page: quit it with Back before loading another page in a test, or the navigation waits on the prompt.

## 8. Getting back in (every Party game; the CEO, 2026-10-16: "a way to get back in ... maybe an invite from the host")
- The host does it for every game, built-in and plugin. During a game the TV's top bar has **Menu** (also the remote's Menu key):
  Resume, New game and **Invite a player back**, the seats a computer plays (the phone left, is away, or has been quiet for 25 s; or a
  computer from the start), each with **Invite**. The TV then shows the room code, a 4-digit seat code and a QR
  (`play.html?room=ABCDE&seat=1234`); the code works once, for 5 minutes. A code that was used (two phones racing: the slower hears "taken"), cancelled or ran out says so on the phone; seated, the phone drops `seat=` from its address so a reload goes straight back.
- A phone that joins a started game gets `{t:"nojoin", why:"started", rejoin:1}` and shows "The game has started. Ask the host to invite
  you back" with a seat-code field. A valid code takes the seat: a person's seat keeps its name and colour, a computer's seat takes the
  phone's name; the phone that held it (away or quiet) gets `{t:"bumped"}` ("Another phone has your seat now": never two phones on one
  seat); the TV toasts "<name> is back". A phone whose name (or stored pid) matches a seat that is open again also asks the host: a TV
  sheet "Let them back in / Not now" (Back = Not now; nobody answers in 60 s = Not now).
- What a plugin does: nothing, when its `onLeave(c)` re-reads `H.name(c)` / `H.isPhone(c)` and its `onTakeOver(c)` sets the seat's human
  flag and pushes the phone's view (Snakes, Candy Land and War do): for a seat taken back the host calls `onLeave(c)` and then
  `onTakeOver(c)`. A plugin with more to hand back registers `H.onRejoin(fn(c))` instead. Read seats live (`H.isPhone`, `H.isHuman`,
  `H.name`) rather than keeping copies.
- A reloaded phone goes straight back to its seat (it keeps the room in `bgfs_seat`, forgotten on Leave, and its name in the shared
  `bg_player_name`), and the host's `{t:"you", started:1}` keeps it off the lobby screen. Escape / Backspace / GoBack on the TV host take the
  same step as the remote's Back.
- Test hooks: `window.__fs.rejoin` (read-only: `gone`, `invites`, `asks`, `open()` = the colours the Menu lists). Tests:
  BG_audit/sprint/partyrejoin/.

## 9. Notes from the Motocross War plugin (games/mxwar.js: real lap times, the cards decide the seconds)
- The TV loads the phone game's own time model: `../mxwar/time.js` goes right after `../mxwar/race.js` in the registry line (the same ES5 file as the
  phone page, plain arithmetic, so every device gets the same bits). The War is unchanged; after each battle `Race` turns that lap's public result
  into every rider's lap time (`G.tm`, plain JSON in the race snapshot, so a saved Party race and a reloaded TV keep it).
- The TV host is authoritative: it runs the race, the clock (`MXWar.Track.setModel`, the 2D view rides the race clock) and the announcers. A phone
  never runs a model. `phoneSt` (the compact state each phone gets) carries `race.tw` (the tower rows: place, number, name, gap as text, DNF mark,
  fastest-lap mark) and `race.you` (this seat's YOU readout: place, seconds to the leader and to the rider ahead, last and best lap, why the lap
  was fast or slow, the crash rule that applies), so the phones show the same standings, gaps and YOU lines as the TV with no model of their own.
  The live rows are computed once per clock instant (one computation serves every phone's push); the host pushes on every event and on a 5 s tick while a
  race runs, never on every frame, because the relays are public MQTT.
- The TV tower lists every rider (up to 40) without scrolling: one column up to 22 riders, two columns beyond (`is-cols2`), the row height follows the room left.
- Test hooks: `window.__mxp.phoneSt(color)` returns the snapshot that phone would get; `window.__mxpLap` (ms) sets the lap length of the race clock. Tests:
  BG_audit/sprint/mxtimebuild/ (s4-party.js is the TV + 3 phones round trip).
- THE 3D RACE on the TV (mxlive, 2026-10-18): the race view adapter (`raceView`) also loads the phone game's 3D view (`../mxwar/race3d.js`, an ES
  module imported at run time; the classic scripts it rides on, `../mxwar/course.js`, `../mxwar/layouts.js`, `../mxwar/data/tracks.js`, are in the registry
  line) and draws the race over the lane wherever WebGL2 works. The 2D track stays: it keeps THE race clock (model mode: the clock, the events) and the
  3D view rides it (`V3.setModel(rc, {clock})`: every rider where the time model says, in the tower's order); it is also the fallback (no WebGL2, `?gl=0`,
  the device's Graphics = Classic 2D in the phone game's Menu, a lost GPU, a device too slow for 3D). The TV starts at the FIRE TV quality (`html[data-quality]`)
  unless the device picked one in the phone game's Menu. Over the picture the corner window moves to the top right (the hero camera keeps the person's
  rider low in the right third); a war flashes across the top; C or Play/Pause on the remote cycles the cameras. The phones stay controllers (no 3D).
  The announcers hear the 3D picture's moments (`hooks.shown`: the holeshot into turn 1, crashes, passes, lapped riders, the checkered flag). Hooks:
  `window.__mxp.rv.is3D()`, `rv.kind` ("3d" | "2d"), `window.__mxpv3` (the view). Tests: BG_audit/sprint/mxlive/tools/p5-party.js.
- A NEW 3D RACE NEVER BLOCKS THE TV LONG (mxlive review fix, 2026-10-19): the adapter builds the race's world over short tasks (`V3.prepareWorld`; the next
  race's world is built while a panel shows: `rv.prepare`), then its riders; the view compiles and first-uses its shaders while nothing draws. Meanwhile the
  race HOLDS (`rv.holding()`): the race clock does not run, the gate does not drop and no lap's cards turn; a card over the picture says "The riders roll up to
  the gate". Tests: BG_audit/sprint/mxlive/fix/.
