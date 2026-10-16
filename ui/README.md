# Board Games UI: the shared "Midnight Luxe" design system

This folder is the shared look for all seven games, the hub and Party Mode. It's a prestige streaming-app look made for game night: deep blue-violet ink surfaces, hairline panels lit from the top, a champagne-gold signature (gold-gradient primary buttons, gold eyebrows, the gold "diamond die" logomark), DM Serif Display with Manrope, one jewel tone per game, and spot-lit art that fades into each game's deep colour.

- Plain CSS and JS, with no build step, no CDN and no runtime dependency.
- Every class starts with `bg-`, and the only global is `window.BGUI`, so it sits next to each game's own CSS without clashes.
- Open `ui/styleguide.html` to see every token, component, surface and effect. Add `?tv=1` for the TV layout, `?effects=reduced` for "Reduce effects" and `?motion=reduce` for reduced motion.
- The Tabletop system this replaced is kept in git under the tag `design-tabletop`. The class names and the `BGUI` API are the same, so nothing that adopted Tabletop has to change.

| File | What it is |
|---|---|
| `theme.css` | All tokens (custom properties), `@font-face`, the 8 per-game `[data-game]` themes, the 10 seats, TV scale (`html[data-tv]`), effects levels, reduced motion and every `bg-` component |
| `ui.js` | `window.BGUI`: toast, sheet, win, celebrate, effects, hero, flip, tweenNumber, countdown, ambient, setTurn, stage (the game-page stage), back (the remote's Back on TV), focus (D-pad), dice, setTV, haptic, mark, trophy, mount.* |
| `icons.js` | `BGUI.icon(name)`: 39 original line icons as inline SVG (no `<text>`, no filters). Optional, but load it before `ui.js` if you want icons in helpers (stepper +/-, toast icons, CPU badge) |
| `fonts/` | DM Serif Display regular (24.2 KB) and italic (24.0 KB), Manrope variable (24.3 KB): Latin WOFF2, SIL OFL 1.1 (`OFL-*.txt`). **Total 72.4 KB** (budget 150 KB) |
| `tex/` | Pre-rendered images, so nothing is blurred or generated at runtime: `felt.webp` and `paper.webp` grain tiles (neutral alpha, they tint to any colour), `orb-gold.webp` and `orb-violet.webp` light orbs, `rays-core.webp` (one quadrant of the 20-ray win wheel). **Total 101 KB** (budget 150 KB) |
| `styleguide.html` | The living style guide: phone and TV, all 8 accents, 10 seats, every component, the surfaces, every effect with a full/reduced switch, and a button for every helper |
| `art/` | Original Midnight Luxe art: tile thumbnails (+ simplified `-sm` variants), TV hero backdrops (WebP, 1920 and 960), app icons (SVG + PNG exports, maskable), the Fire TV banner and the Android launcher icons. See section 10 |

## 1. Adopting it in a game (step 4)

Put these in `<head>`. The paths assume a game folder such as `trouble/index.html`. The hub uses `ui/...`.

```html
<script>/* before first paint: TV for ?tv=1 or the Fire TV bridge, and the stored effects level */
(function (h) {
  if (/[?&]tv=1(&|$)/.test(location.search) || window.AndroidTV) h.setAttribute("data-tv", "");
  try { if (localStorage.getItem("bgui.effects") === "reduced") h.setAttribute("data-effects", "reduced"); } catch (e) { }
})(document.documentElement);</script>
<link rel="stylesheet" href="../ui/theme.css">
<script src="../ui/icons.js" defer></script>
<script src="../ui/ui.js" defer></script>
```

Then set the page up:

```html
<html lang="en" data-game="trouble">
<body class="bg-app">                    <!-- the dark stage, painted once on a fixed layer -->
<body class="bg-app bg-app--scene">      <!-- setup pages: the game's deep colour washes the whole page -->
<body class="bg-app bg-app--felt">       <!-- Rummy / Uno in play: the spot-lit felt is the whole table -->
```

**"This page is game X": keep calling `Skins.apply(game)`.** Every game and both Party pages already call it. On a page that loads `ui.js`, `skins.js` hands over to `BGUI.stage(game)`, which gives the page:

- **the theme:** `html[data-game]` is set.
- **the Luxe ambient layer:** `.bg-ambient` is the first child of `<body>`, fixed behind everything. It holds three light orbs (the house gold, the game's accent and violet), three soft light beams (the same three colours) that sweep slowly across the stage, and gold-line game motifs (12 on a phone, 16 on TV) that rise slowly, sway and turn. They run on the one effects ticker (section 6) and stop for "Reduce effects", reduced motion and a hidden page.
  - A board and its panels cover most of a game page, so the stage works where the page leaves it visible (step 4 review: the motifs alone left a game page almost still). A motif never climbs behind a framed board: one the board hides moves to a free column and fades in again there. When the board leaves a free column at least a quarter of the screen wide (TV: beside the board), the beams sweep that column. A phone has no such column, so there everything crosses the whole width.
  - The boards the stage keeps clear of are `.bg-frame`, `[data-stage-solid]` and the board elements `skins.js` frames (`#boardWrap`, `#rkframe`, `#rtable`, `.mboard`).
  - **Text that sits right on the stage stays clear:** a motif fades out while it passes over the TV hint bar (`.bg-hintbar`) or any element marked `data-stage-text`, as it does behind a card, and fades back in past it (`BGUI.stage.hush`). Cards, chips and sheets are opaque, so text on them needs nothing. Mark text that has no card behind it (Sorry!'s deck rule beside the deck is `data-stage-text`).
  - **The halo (2.4):** on the setup scene (`.bg-app--scene`) and the felt (`.bg-app--felt`) marked text also carries a soft dark halo, a static three-layer `text-shadow` painted once with the text (no filter, nothing animates), so it keeps 4.5:1 while a light beam passes behind it at its brightest. Gold gradient text (`.bg-gold`) keeps none: a text-shadow would be painted over its glyphs. Small text on a bright scene that still falls short takes `data-stage-text="strong"`: a denser halo, and the text one step brighter (other text ivory, a gold eyebrow `--gold-100`). Trouble's khaki scene needs it for its section eyebrows and hero pitch: with a beam at its brightest behind them they measured 3.86-4.02:1 on a phone with the halo (the eyebrows 4.24-4.29:1 with the denser halo alone) and 5.29-6.41:1 strong. Measure every marked text that way (section 7).
  - **Trouble's halo:** a slow-turning ring of 32 gold rays, a beaded gold bezel and four seat-colour jewels round its round board, the Luxe heir of the old skin's turning rainbow ring. One pre-rendered layer (inline SVG, gradients only) centred on the board, turned 2 degrees a second by the same ticker; hidden while the board is (the setup page); it rests with the stage. `--bg-halo-k` (the halo's diameter over the board's) is 1.85 on a phone and 1.7 on TV, where its rays fade out under the cards of the column beside the board. Another round board can have one with `BGUI.stage(game, {halo: "#myBoard"})`.
- **Luxe board frames:** the board elements the old skins framed get a gold hairline, a dark moat and a soft static shadow (`--frame-shadow`, no filter). These are `#boardWrap` (Trouble gets a round frame under the plate; Sorry! a rounded square), `#rkframe`, `#rtable`, and `#board` / `.mboard`.
- **the logomark glint** on every `.bg-emblem`.

How it behaves:

- **Switching games:** call it again. The Party TV host does this on every game switch. The orbs stay and re-tint; the motifs are rebuilt.
- **Load order:** `ui.js` loads with `defer`, so it runs after the page's own scripts. A `Skins.apply()` made while the page is still parsing is finished on DOMContentLoaded. If `ui.js` never arrives, the old skin is used.
- **Pages without `ui.js`** keep the old animated skins, unchanged. `Skins.mode()` says which one is running: `"luxe"` or `"classic"`.
- **New pages** can call `BGUI.stage(game, {frames: "#myBoard"})`, or put `data-bg-stage="uno"` on `<body>`. Give a board that is not framed `data-stage-solid`, so the motifs and beams keep to the free columns beside it.

**The remote's Back on TV (automatic: `BGUI.back`).** In the Fire TV app, `MainActivity.onBackPressed` calls `window.__tvBack()` and **closes the app when a page has none**. `BGUI.stage(game)` (so `Skins.apply(game)`) gives each of the seven game pages one default, and each Back takes ONE step:

1. the top layer closes: the sound panel, else the top sheet (a sheet opened with `dismissible: false` stays: the step ends there), else the Victory screen;
2. else the page's own step: hooks added with `BGUI.back.on(fn)`, newest first. A hook returns the name of the step it took, or `false` to pass;
3. else the page goes to the hub (`../index.html`, keeping `?tv=1`).

The page adds its step and arms the TV-browser path:

```js
document.addEventListener("DOMContentLoaded", () => {   // ui.js is deferred
  BGUI.back.on(() => {
    if (!setupShown()) { menuBtn.click(); return "menu"; }                        // board -> Menu
    if (resumeBtn.style.display !== "none") { resumeBtn.click(); return "resume"; } // Menu -> the game
    return false;                                                                 // New game page -> the hub
  });
});
// once a game is on (Start, Continue, Load: call it inside the tap, so the browser keeps the history entry)
BGUI.back.arm();
```

- **TV browsers** (Silk: Back = `history.back()`, sometimes also a Back key): once armed, one guard entry stays in the history, so Back lands on the page; `popstate` takes the same step and puts the guard back. A Back key (Escape, GoBack, BrowserBack, keyCode 4, Backspace outside a text field) that nothing on top took takes the step too, and a key plus `history.back()` from the same press (within 0.7 s) counts once. Before `arm()` Back leaves the page as it always did.
- **Phones** get no guard entry: their Back works as before.
- **Not installed:** on a page that defines its own `window.__tvBack` (the Party TV host keeps its own), on the hub (it calls no `BGUI.stage(game)`, so Back there still exits the app), on pages without `ui.js`, and with `BGUI.stage(game, {back: false})` (the style guide's stage preview).
- Trouble and Sorry! use it (step 4 shared pass). Verified in headless Edge on TV for both: `window.__tvBack()` as the app calls it (the sound panel, the move sheet, board to Menu, Menu to game, the Victory screen, then the Menu, then the hub with `?tv=1`), `history.back()` twice (the guard put back each time), the Back key twice, a key plus `history.back()` = one step; on a phone no history entry.

**The sound button and panel (automatic).** When theme.css is on the page, `sound.js` builds both in the Luxe style. The ids, keys, focus trap and behaviour don't change.

- `Sound.mountButton()` docks the button (a `.bg-btn--icon`) as the first item of `.bg-topbar__end`, before the menu knob. So put the top bar in the markup before the script that calls it.
- With no top bar, the button floats where the bar's end slot would be. `{top, right}` still move it, `{into: el}` docks it somewhere else, and `{dock: false}` always floats it.

**"Reduce effects" lives in the sound panel (automatic).** Every page that loads both `sound.js` and `ui.js` gets a "Reduce effects" switch in the panel, which is then titled "Sound and effects". That covers all 7 games and the Party TV host.

- It is bound to `BGUI.effects`. Default off = full effects.
- It is saved per device under one key, `localStorage["bgui.effects"]`, and shared by every game on the origin. Verified: switched on in Sorry!, it was still on after a reload and in Trouble, and switching it off from Trouble's panel worked.
- Pages without `sound.js` (the phones' `firestick/play.html`), or a game's own settings page, can add the same row with `BGUI.mount.effectsRow(container)`. Don't add a second switch to a page that has the sound panel.

**Attributes**

- **`data-game`**: `trouble | sorry | monopoly | rummy500 | risk | uno | scatter | party`.
  - It works on any element, not just `<html>`. A hub tile with `data-game="uno"` is themed as Uno.
  - It sets `--accent` (UI tint), `--accent-bright`, `--accent-deep` (tile, hero and scene backdrop), `--accent-ink` (text ON the accent), `--accent-text` (the accent as text on ink, >= 4.9:1 on a lit panel), `--accent-paper` (the accent as text on paper, >= 5:1), `--accent-glow`, `--felt`, `--felt-deep`, `--felt-lite`, `--board` and `--board-lite`.
  - With no `data-game` you get the house accent: champagne gold.
- **`data-tv`** on `<html>` turns on the 10-foot layout. Pages set it explicitly (the head script above, `BGUI.setTV`, `?tv=1`, `window.AndroidTV`). There is deliberately **no width-based switch**: desktops keep the phone/desktop layout, and any rule that catches a 960x540 Fire TV WebView also catches landscape phones.
  - Sizing: `font-size: clamp(12px, min(1.25vw, 2.2223vh), 48px)`, so 1rem is 24px at 1920x1080, 16px at 1280x720 and 12px in a 960x540 WebView. The layout is identical at every size.
  - The type scale is lifted so nothing renders under 21px at 1080p (`--fs-micro` = .875rem), captions step up to `#bdb7d0`, and targets are 3rem (72px at 1080p).
  - `ui.js` sets `data-tv` by itself for `?tv=1` and for `window.AndroidTV`, and turns on D-pad navigation. The inline head script only avoids a first-paint flash.
- **`data-effects="full" | "reduced"`** on `<html>`: written by `BGUI.effects.set()` (see section 6). Default `full`: every effect on.
- **`data-motion="reduce"`** on `<html>` forces reduced motion, for example from an in-game setting. The OS setting is always honoured as well. Reduced motion wins over the effects level: nothing moves.
- **`data-seat="1".."10"`** on any element sets `--seat`, `--seat-hi`, `--seat-lo`, `--seat-ink` (text on the piece), `--seat-text` (the seat colour as text on ink), `--seat-tint` (opaque 20 % over a panel: the turn-chip fill) and `--seat-ring` (opaque 50 % over the page: rings and dots).
  - Seats: 1 red, 2 blue, 3 green, 4 yellow, 5 purple, 6 teal, 7 orange, 8 pink, 9 silver, 10 bronze. The closest pair is orange / bronze (CIEDE2000 11.9), and bronze only appears in 10-player games; every token also carries a letter or name, so colour never identifies a player alone.
- **`data-focus`** marks a non-button element as a D-pad stop. Use `data-focus="off"` to skip an element and `data-focus-first` to choose where D-pad focus starts. `data-focus-zone` makes a container its own D-pad zone, like the top bar: Up/Down only cross into or out of it when nothing is left in that direction.
- **`data-toast-avoid`** tells toasts to stay clear of an element, such as a sticky action bar. `.bg-players` strips and the top bar are avoided automatically.
- **`data-stage-solid`** marks a board the stage's motifs and beams keep clear of (section 1); **`data-stage-text`** marks text that sits right on the stage: the motifs fade out over it and, on the scene and the felt, it carries the halo (`="strong"`: the denser halo and a brighter colour; section 1).
- **`data-back-held`** is set on `<html>` by `BGUI.sheet` while the top sheet must be answered (opened with `dismissible: false`): Back does nothing there, so the TV hint bar (`.bg-hintbar`) steps aside (2.4).

## 2. Class reference

| Class | Use |
|---|---|
| `.bg-app`, `.bg-app--scene`, `.bg-app--felt` | Body: the ink stage (static light pools + vignette on a fixed layer), the per-game scene tint for setup pages, or the game's spot-lit felt as the whole table |
| `.bg-surface--stage` (alias `--wood`), `--felt`, `--paper`, `--parchment`, `--board`, `--rail` (alias `--oak`) | The tactile homes, all spot-lit on the dark stage: deep felt under a pool of light (Rummy, Uno), a lit paper pad (Scattergories), parchment (Risk), a gold-framed board plane (Sorry!, Trouble, Monopoly), a rail for trays and frames. Grain is a pre-rendered tile, light is a static gradient. Text colour is set for you; on felt and board `--text-faint` steps up to text-2, on paper the muted tokens switch to dark ink |
| `.bg-spot` | A static pool of light from above on any positioned card |
| `.bg-display`, `.bg-h1/h2/h3`, `.bg-italic`, `.bg-eyebrow` (`--accent`), `.bg-gold`, `.bg-muted`, `.bg-faint`, `.bg-num`, `.bg-section`, `.bg-rule`, `.bg-sr` | Type helpers. Display type is DM Serif Display; UI is Manrope 500+. `.bg-eyebrow` is gold 800 caps (12px phone, 21px TV); `.bg-gold` is gold-gradient text; `.bg-section` is an eyebrow followed by a gold hairline; `.bg-sr` is screen-reader-only text |
| `.bg-btn` with `--primary` (gold), `--secondary` (lit ink), `--ghost` (gold hairline), `--accent` (the game's colour), `--danger`, `--icon` (round), `--paper` (with `--icon`, on paper), `--sm`, `--lg`, `--block` | Buttons. Press feedback is a transform plus a shade pseudo-element that fades by opacity; fills swap instantly. `--sm` shrinks the label, never the 44px target |
| `.bg-btn--cta` with `.bg-btn__label` and `.bg-btn__sub` | Start button with a confirming sub-label ("Start Uno / 5 players · Classic") |
| `.bg-topbar` with `__start`, `__title` (`.bg-eyebrow` + `.bg-topbar__name`), `__end` | Sticky opaque ink bar. For the D-pad it is its own zone, and focused page controls are scrolled clear of it. On TV the buttons of `__start` and `__end` stand 1.5rem apart (2.4) |
| `.bg-card`, `.bg-inlay`, `.bg-plaque` | Lit panel (hairline + top light), sunken well, gold nameplate |
| `.bg-versions` > `.bg-version[data-value][aria-checked]` with `__art`, `__title`, `__meta`, `__desc` | Version / option cards. Selected: gold hairline, the accent's glow and a gold check seal. Wire with `BGUI.mount.versions`. On TV the cards stand 1.5rem apart (2.4), so a focused card's lift and ring stay clear of the next |
| `.bg-seg` (`--text`, `--grid5`) > `button[aria-pressed]` (or `.is-on` / `.on`) with an optional `<small>` | Segmented picker in a sunken well; the selected cell is gold. `--grid5` is the 0-9 keypad. Wire with `BGUI.mount.seg`. On TV the cells stand 1.5rem apart, rows and columns (2.4: the ring, 10.5 px at 1080p, never touches the next cell), so a `--text` picker needs room for its labels there (a long name gets an ellipsis) |
| `.bg-stepper` with `__btn`, `__val`, and `.bg-pips > i.is-on` | CPU stepper (- [3] +) with a diamond pip row: the narrow-phone alternative to the keypad. Use `BGUI.mount.stepper` |
| `.bg-rows` > `.bg-row` (`label` with `input.bg-toggle`, or `button[role=switch][aria-checked]` with `span.bg-toggle`), `__main`, `__title`, `__desc`, `.bg-row--static` | Whole-row rule toggles (60px). The row is the target, not the switch. The switch's gold fill fades by opacity and the knob slides by transform |
| `.bg-select` | Native select, 44px, gold hairline. On TV the D-pad never gets stuck on it: arrows move on, OK opens the picker |
| `.bg-tag--official / --house / --accent / --paper / --new / --ok` | Tags. Fills are opaque, so they stay legible on artwork |
| `.bg-status--host / --ready / --joining / --cpu` | Lobby status pills (Party Mode) |
| `.bg-seatcard[data-seat]` (`--empty`) with `.bg-token`, `__name`, `.bg-status` | TV lobby seat card (step 6) |
| `.bg-chip` (+ `.bg-chip__dot`, `[data-seat]`), `.bg-badge` | Info chips and gold count badges. They are labels, not controls (no focus ring): use a `.bg-btn` for anything tappable |
| `.bg-stats` > `.bg-stat` (`<b>38</b><span>turns</span>`) | Stat pills for win screens and summaries (serif gold numbers) |
| `.bg-players` (`--scroll` for 5-10 players) > `.bg-player[data-seat]` with `.bg-token`, `__txt`, `__name`, `__meta`, `__cpu`, `.is-turn`, `.is-out` | Player strip. The default is a wrapping grid (2-up on a phone). Names and meta get an ellipsis. The turn chip gets the seat tint, a static turn ring and a TURN tag (12px phone, 21px TV); its meta is ivory with a seat dot, so colour never carries the text. `.is-out` (an out player: bankrupt, knocked out) is a dark chip whose piece and CPU badge fade to .45; the name and meta keep full contrast (2.4; the whole chip at .5 had put the meta at 2.65:1). `BGUI.mount.players` and `BGUI.setTurn` drive it |
| `.bg-token[data-seat]` | Lit seat-colour piece with a dark label |
| `.bg-scorepad` > `table.bg-score` with `tr.is-lead`, `.bg-score__who[data-seat]`, `.bg-score__total` | Scoreboard on a lit panel; the leader's row is washed in gold |
| `.bg-sheet` with `__grip`, `__head`, `__title`, `__sub`, `__options` > `button.bg-sheet__option` (`.bg-token`, `.bg-sheet__text` > `__label` + `__desc` + `__detail`, then a chevron), `.is-best` | Bottom sheet. Each choice has a plain-English line and a concrete detail line ("space 22 to 28"). Write "to", not an arrow: the font subsets have no U+2190-2192, so an arrow would fall back to a system font. Open and close it with `BGUI.sheet` |
| `.bg-toast` | Created by `BGUI.toast()`. Don't place it by hand |
| `.bg-win.is-open` > `.bg-win__scrim`, `.bg-win__rays`, `.bg-win__card` > `.bg-win__medal`, `.bg-eyebrow`, `.bg-win__title`, `.bg-win__sub`, `.bg-stats.bg-win__stats`, `.bg-win__actions` | Win screen: opaque scrim with gold light, a 20-ray gold wheel that turns for as long as it is open, drifting confetti, the laurel trophy and a gold "Victory". The small eyebrow sits on a static dark plate, so the bright rays behind it never take its contrast below 4.5:1 (measured 10.6:1 at worst on the phone). `BGUI.win.open(el)` builds the wheel, the confetti layer and the trophy, and makes it modal (Tab and the D-pad stay inside; `BGUI.win.close()` gives focus back). While it is open the page does not scroll and shows no scrollbar (`html[data-win]`). Call `BGUI.celebrate()` for the opening burst: it draws under the card, like the steady confetti |
| `.bg-tiles` > `.bg-tile[data-game]` with `__art` (+ `.bg-tile__badge` player count), `__label`, `__name`, `__meta`, `__seal`, `.bg-tile--party` | Hub / TV game tile: spot-lit art fading into the game's deep colour, serif name, player-count badge, seal. 2 across on a phone, 4 on TV. Party Mode is a full tile. On focus the ring and the game's glow fade in on the tile's own `::after` layer |
| `.bg-hero` > `.bg-hero__layer` x2, `.bg-hero__shade`, `.bg-hero__body` (`.bg-eyebrow`, `.bg-hero__title`, `.bg-hero__pitch`) | TV hub poster / lobby hero: two stacked backdrop layers crossfaded by `BGUI.hero.show` |
| `.bg-orbs` > `i` x2-3 | Hub / lobby light orbs (pre-rendered glow images). `BGUI.mount.orbs(host)` adds them; the effects ticker drifts them |
| `.bg-ambient` > `.bg-orbs.bg-orbs--stage` (`i.is-accent`) + `.bg-beams` > `i` (`.is-accent`, `.is-violet`) + `.bg-halo` > `i` (Trouble) + `.bg-motifs` > `b` (`.is-hush`) | The game stage built by `BGUI.stage(game)` (section 1). Don't write it by hand. The accent orb is a static gradient in `--accent-glow`; each beam is a static gradient (`--bg-beam-w`: 9.5rem phone, 9rem TV; peak opacity .17); the halo is one inline-SVG layer at opacity .5 (`--bg-halo-k`: 1.85 phone, 1.7 TV); a motif over text on the stage gets `.is-hush` (opacity 0, a .6 s fade) |
| `.bg-frame` (`--round`) | Board frame: gold hairline, dark moat and a soft static shadow (`--frame-shadow`). No filter |
| `.bg-sound` (`__card`, `__head`, `__title`, `__now`, `__vol`, `__label`, `__val`, `__slide`, `__row`, `__fx`, `__done`), `.bg-range`, `.bg-sndbtn--float` | The Luxe sound panel, its volume slider (gold fill up to `--v`) and the floating sound button. `sound.js` builds them. On TV the button row stands 1.5rem apart (2.4) |
| `.bg-emblem` (`--lg`, `.is-glint`) | The gold "diamond die" logomark with its glint. `BGUI.mount.emblem(el)` fills it and registers the glint with `BGUI.ambient` |
| `.bg-die` (`--seat`, `--gold`) | Ivory die: `BGUI.dice.render/roll` |
| `.bg-countdown` | Ring timer: `BGUI.countdown(el, s)` |
| `.bg-hintbar` with `.bg-key` | TV remote legend. Use the same words in every game ("Back  Close a list, or the Menu"). Toasts keep clear of it, and it steps aside (`visibility: hidden`) while a sheet that holds Back is up (`html[data-back-held]`; 2.4) |
| `.bg-focus`, `.bg-focus-room` | Gives any element the shared focus ring and TV lift. `.bg-focus-room` pads a container so rings are never clipped |

Focus ring: every `bg-` control gets the same ring on `:focus-visible`, and also on `.is-focus`, which `BGUI.focus` sets for the D-pad and for old WebViews. The ring is a dark gap, then an ivory `#fff3d1` ring, then a soft gold glow: shape and light, never colour only. On TV, buttons, tiles, version cards and `.bg-focus` also lift (scale 1.05). The ring swaps instantly and never transitions; tiles carry it on a pre-promoted `::after` that only changes opacity.

## 3. `window.BGUI`

This is BGUI 2.5.2 (`BGUI.version`; 2.5.2: a sheet opened by a finger tap ignores the click that same tap sends to the new scrim during its first 450 ms, so a tap that opens a sheet no longer closes it again on touch screens; 2.5.1: OK on a text field on TV re-focuses and clicks it so an Android WebView opens its on-screen keyboard, the name fields carry `inputmode="text"`, and the who-goes-first show takes no taps while it fades out). Every call is safe if its element is missing: it returns `null`, `false` or a resolved promise.

| Call | Does |
|---|---|
| `BGUI.haptic("tap"\|"select"\|"turn"\|"success"\|"warn"\|"error"\|"roll"\|ms\|[pattern])` | Guarded `navigator.vibrate` that returns a boolean. Turn it off with `BGUI.haptic.enabled = false` |
| `BGUI.toast(msg, {ms, seat, token, icon, html, place: "auto"\|"top"\|"bottom", haptic})` | One shared toast. Its position is computed from the layout: clear of an open sheet, the top bar, every `.bg-players` strip, the TV hint bar (`.bg-hintbar`, 2.4) and `[data-toast-avoid]` elements, so it never covers the player strip. The bands are full width: on a TV layout with a side column, centre the toast over the column with page CSS (`html[data-tv] body:not(.<game>-in-setup) .bg-toast{left: ...}`, as all four adopted games do), and it takes the free band there. When an open sheet leaves no free band (a tall sheet over the strip), the toast is held out of sight and shown when the sheet closes, for what is left of its time (`place` is then `"held"`). `BGUI.toast.hide()`, `BGUI.toast.held()` |
| `BGUI.sheet.open(el, {onClose, dismissible, focus})`, `.close(el?)`, `.isOpen(el?)`, `.top()` | Bottom sheet with a scrim. It traps focus (Tab and D-pad), closes on Back/Escape/scrim and restores focus to the opener. Nested sheets stack. While the top sheet was opened with `dismissible: false`, `html[data-back-held]` is set (the TV hint bar steps aside, 2.4) |
| `BGUI.win.open(el, {focus})`, `.close(el?)`, `.isOpen()` | Opens or closes a `.bg-win`: builds the ray wheel, the confetti layer and the trophy once, adds `.is-open`, aims the rays at the trophy, moves focus inside and restores it to the opener on close. While it is open the orbs rest, the effects ticker turns the rays and the page scroll is locked (`html[data-win]`: no scrollbar beside it on TV) |
| `BGUI.celebrate({ms, colors, count, origin, rays, into})` | One-shot canvas burst of gold confetti (diamonds and strips, a few jewels) plus a gold ray bloom, about 2.8 s (2 s and half the pieces under "Reduce effects"). The canvas is removed afterwards; returns a promise. Nothing under reduced motion or when the tab is hidden. Inside an open `.bg-win` it draws behind the card (its canvas sits in the win layer before the card, z 0 under the card's z 1: a solid test canvas in that layer left the stat pills clean and the title's glyphs on top, phone and TV). Open the win first, then call it |
| `BGUI.effects.get()`, `.set("full"\|"reduced")`, `.motion()`, `.state()`, `.key` | The one effects setting. `set` writes `html[data-effects]` and `localStorage["bgui.effects"]` (try/catch) and fires `bgui:effects`. A change made in another tab applies too (`storage` event). `motion()` is what really runs: `"full"`, `"reduced"` or `"off"` under reduced motion. `state()` is `{level, motion, hz}` where `hz` is the effects ticker's rate (4 orbs, 8 game stage, 24 win screen, 0 still). `rate` = `{orbs: 4, win: 24, beat: 30, stage: 8}` (updates a second; `beat` steps the hero crossfade; on the stage the orbs still move 4 times a second) |
| `BGUI.stage(game, {theme, orbs, beams, motifs, frames, halo, back})`, `.current()`, `.clear()`, `.beam`, `.hush`, `.halo` | "This page is game X" (section 1): sets `html[data-game]` (`theme: false` leaves it), builds `.bg-ambient` (orbs unless `orbs: false` or the page has its own `body > .bg-orbs`; 3 light beams unless `beams: false` (or `beams: n`); motifs unless `motifs: false`; Trouble's halo round `#boardWrap` unless `halo: false`, or a halo round another board with `halo: "#sel"`), adds `.bg-frame` to `frames` (a selector), the glint to every `.bg-emblem`, and the TV Back default (`BGUI.back`) for the seven games unless `back: false`. Call it again to switch game. `Skins.apply(game)` calls it on pages that load `ui.js`. `.beam = {deg, remS, gap}`: the beams' tilt (-20), sweep speed (0.6 rem a second) and the share of their range they wait off screen (0). `.hush = {on, sel}`: the motifs fade out over text on the stage (`.bg-hintbar, [data-stage-text]`). `.halo = {degS}`: the halo's turn (2 degrees a second) |
| `BGUI.back.on(fn)`, `.arm()`, `.step(src)`, `.install({hub})`, `.installed()`, `.hub()`, `.armed` | The remote's Back on a game page (section 1): `window.__tvBack` for the Fire TV app, a history guard for TV browsers and the Back key, one step per press: the top layer, then the page's hooks (`on(fn)` returns an off function; `fn(src)` returns a step name or `false`), then the hub. `arm()` once a game is on. `step()` is what `__tvBack` runs; it returns `"panel"`, `"sheet"`, `"held"`, `"win"`, the hook's name or `"hub"` |
| `BGUI.hero.show(el, {src, game})`, `.layers(el)` | Crossfades the two `.bg-hero__layer` backdrops by opacity. With `src` the next image is decoded first; a newer call (fast D-pad) wins. `game` themes the layer and the hero |
| `BGUI.mark()`, `BGUI.trophy()` | The gold logomark and the laurel trophy as inline SVG strings (gradients only: no filters, masks or `<text>`) |
| `BGUI.flip(el, fromRectOrEl, {ms, spring})` | FLIP move: read the rect, move the DOM, then call `flip`. Uses transform only |
| `BGUI.tweenNumber(el, from, to, ms, {format})` | Counts cash, scores and similar values |
| `BGUI.countdown(el, seconds, {low, onTick, onDone})` | Ring timer that updates 4 times a second, not as a continuous animation. Returns `{stop, pause, resume, remaining(), done}` |
| `BGUI.ambient.add(el, {cls, ms, delay})`, `.remove(el)`, `.trigger(el, {cls, ms})`, `.pause()`, `.resume()`, `.state()`, `.every` | The ONE scheduler for decorative beats (logomark glint, turn pulse). One beat at a time, a periodic beat every 12 s (24 s under "Reduce effects"), paused while hidden or under reduced motion. With nothing registered no timer runs. A beat whose element has left the page (a rebuilt strip or board) never starts and never holds up the next one (2.4) |
| `BGUI.setTurn(playerEl, {pulse, haptic})` | Moves the static turn ring and asks `ambient` for 3 pulses. Call it every turn: the new turn's pulse replaces the previous player's on the same strip (running or queued), so it starts at once even when turns are shorter than the 4.9 s pulse. Since 2.4 it also ends a pulse on a chip that is no longer in the page: a page that rebuilds its strip (`innerHTML`, `mount.players`) needs no `ambient.remove` of the old chips (New game from the mid-game Menu twice in a row: the new strip pulsed within 6-55 ms in all four games in the final runs, 309 ms at most in any run, and the old strip's pulse ended with it). `pulse: false` moves the ring only (a hidden strip, a preview game) |
| `BGUI.focus.enable({root, autofocus})`, `.disable()`, `.move(dir)`, `.set(el)`, `.first(scope)`, `.candidates()`, `.enabled` | D-pad spatial navigation over `[data-focus]` and focusable elements. The first arrow lands on the first page control (not the bar), same-row/column moves win, Enter/OK clicks, focus is scrolled into view below the sticky top bar, and it never leaves an open sheet or win screen. What is scrolled into view is the element that carries the ring: a switch's whole `.bg-row` with its scroll-margin, not just the switch, so a tall row's ring is never cut by the bar, the screen edge or a sheet's edge (2.3.1, step 4 Monopoly review). A `<select>` never keeps the arrows (OK opens its picker), a text field keeps Left/Right only while typing, radios and sliders keep Left/Right but let Up/Down move on. It is on automatically in TV mode |
| `BGUI.dice.svg(n)`, `.render(el, n)`, `.roll(el, final?, {ms, flips})` | Pip faces, plus a roll made of a transform tumble and a few face swaps. Returns a promise of the final value |
| `BGUI.names.mount(host, {count, seat, token, label, extra, onChange})`, `.list(humans, raw)`, `.cpu(n, humanNames)`, `.get(i)`, `.set(i, v)`, `.clean(v)` | Player names (step 10): one device-wide name for the first human (`localStorage["bg_player_name"]`, every game) and hot-seat names (`"bg_player_names"`); the name fields (`.bg-names` > `.bg-name` with `input.bg-input`); the names a game uses (empty = "You" / "Player n"); computer names that never repeat a human. Guide: `BG_audit/SHARED-UX.md` |
| `BGUI.firstPlayer(opts)`, `.resolve(n, draw, {rank})`, `.skip()`, `.close()`, `.isOpen()` | The who-goes-first show (step 10): modes `dice` (2 gold dice), `die` (pins on a board, `layout: "peek"`), `card`, `cut`, `flip`, `spin`; ties draw again; the winner gets a spotlight, a gold ray burst and "Ava goes first". Paced by Game speed; a tap / OK / Back skips; Reduce effects = the short version. The game decides the result with `.resolve` first and starts its first turn when the promise resolves |
| `BGUI.hop(el, {ms, lift, unit})` | One visible hop per space (step 10, the CEO rule): lifts a plain wrapper (Web Animations, transform only, one shot); nothing under Reduce effects / reduced motion |
| `BGUI.setTV(on)`, `BGUI.isTV()` | Toggles `html[data-tv]` and D-pad navigation, and fires a `bgui:tv` event |
| `BGUI.reducedMotion()`, `BGUI.setReducedMotion(true\|false\|null)` | Reads or forces reduced motion |
| `BGUI.mount.seg(el, {options, value, onChange})`, `.stepper(el, {min, max, value, label, onChange})`, `.toggle(row, {checked, onChange})`, `.versions(el, {value, onChange})`, `.players(el, list, {turn, scroll})`, `.emblem(el, opts)`, `.orbs(host, {count})`, `.effectsRow(el, {title, desc, id})`, `.auto(scope)` | Builders and wiring. `data-bg-mount="seg\|stepper\|toggle\|versions\|emblem\|effectsRow"` wires markup on load. `effectsRow` appends the "Reduce effects" switch row to a container (or wires a given `.bg-row`), bound to `BGUI.effects` and kept in sync with changes made elsewhere. `orbs` returns the stage's orbs when a stage is up, so a page never gets two sets |
| `BGUI.icon(name, {cls, label})`, `BGUI.icon.names`, `BGUI.icon.seal(game)` | Inline SVG icons from `icons.js` |

Events on `document`: `bgui:firstplayer` (`{open, mode | winner, skipped}`), `bgui:sheet` (`{open, el, reason}`), `bgui:win` (`{open, el}`), `bgui:tv` (`{on}`), `bgui:effects` (`{level, motion}`), `bgui:stage` (`{game, el}`).

## 4. Per-game accents and seats (final mapping)

Jewel tones mapped to how people picture each game, and checked for separation by `BG_audit/design/luxe-build/accents.js` (reads this theme.css; CIEDE2000, hue gap, lightness gap and contrast; all pass).

| `data-game` | Accent (UI tint) | Deep (tile / scene) | Felt-lite (pool of light) | Why |
|---|---|---|---|---|
| `trouble` | `#f5e52e` sunflower | `#463808` | `#5f5017` | the yellow pop-dome box |
| `sorry` | `#5c9cff` sapphire | `#0a2459` | `#1a3c7a` | the blue slide track |
| `monopoly` | `#3fc477` money green | `#06391f` | `#115531` | banknote and board green |
| `rummy500` | `#4fd8d2` card-table teal | `#04343a` | `#125b5c` | the felt card table |
| `risk` | `#ea9a4a` campaign amber | `#3a1e08` | `#5d3715` | parchment map and brass |
| `uno` | `#ff5e4e` fire red | `#540d10` | `#771d1e` | the red card back |
| `scatter` | `#c9a5ff` amethyst | `#36125f` | `#53307f` | the purple pad |
| `party` | `#f26ab6` orchid (+ gold) | `#56093c` | `#751c54` | the party night |

- Every accent pair: CIEDE2000 >= 20.4 and a hue gap >= 26 degrees. Every deep (tile backdrop) pair: CIEDE2000 >= 11.5 and a hue gap >= 21 degrees.
- The judges' problem pairs: Monopoly / Rummy accents dE 20.5 with a 40-degree hue gap (deeps 59 degrees apart); Trouble / Party dE 62.9 (107 degrees apart).
- Contrast: accent-text >= 4.9:1 on a lit panel, accent-ink on the accent >= 6.5:1, accent-paper >= 5:1 on the darkest paper, ivory on every deep >= 10:1.
- Seats (`data-seat`): `#ff5d73` red, `#5f95ff` blue, `#3fd391` green, `#ffcb4f` yellow, `#b383ff` purple, `#38cbd2` teal, `#ff8c45` orange, `#ff7fcb` pink, `#c4c8d8` silver, `#c9915a` bronze. Each has opaque `-tint` and `-ring` variants (no `color-mix()`).

## 5. Old pattern in the games -> new `bg-` class

| Old pattern (where) | New |
|---|---|
| `.btn` (all 7) | `.bg-btn.bg-btn--secondary`, `.bg-btn--ghost` for low-emphasis actions |
| `.btn.primary`, Monopoly `.btn.go` | `.bg-btn.bg-btn--primary` (gold). The main Start becomes `.bg-btn--cta` with a sub-label |
| Monopoly `.btn.warn` | `.bg-btn--danger` |
| `.btn[disabled]` | Same attribute; the styling is built in |
| `.homebtn` fixed top-left Home link (Trouble, Sorry!, Monopoly), `.menuRow` + `#menuBtn` "☰ Menu" (Rummy, Risk, Uno, Scatter) | A `.bg-topbar` with `a.bg-btn.bg-btn--icon` (`BGUI.icon("back")` or `"home"`) in `__start` and the menu knob (`"menu"`) in `__end` |
| Setup `.overlay#setup > .card` (Trouble, Sorry!), `.overlay > .modal` (Monopoly), `.overlay.show > .sheet` (Rummy, Risk, Uno, Scatter) | Setup becomes a page on `body.bg-app.bg-app--scene`, using `.bg-section` headings, `.bg-card` / `.bg-rows` blocks and a `.bg-btn--cta` dock. Mid-game dialogs become `.bg-sheet` through `BGUI.sheet.open()` instead of toggling `.show` |
| `.sheet h3`, `.modal h3`, `.card h2` | `.bg-section > .bg-eyebrow` (section label), `.bg-h2` / `.bg-sheet__title` |
| `.vers > .ver(.on)` with `b` / `i` / `p` (Rummy, Risk, Uno, Scatter) | `.bg-versions > .bg-version[aria-checked]` with `__title`, `__meta`, `__desc` (`BGUI.mount.versions`) |
| `.seg > button.on` (all 7) | `.bg-seg > button[aria-pressed]`. `.on` still works during the move. Use `BGUI.mount.seg` |
| Computer-player `.seg` of 0-9 buttons | `.bg-seg--grid5` keypad, or `.bg-stepper` (`BGUI.mount.stepper`) on narrow phones |
| Monopoly token picker `.tokgrid > .tokbtn` | `.bg-seg.bg-seg--grid5 > button[aria-pressed]` with a `.bg-token` inside |
| `.row` with a `<span>` label and `input[type=checkbox]` (Uno, Rummy, Risk, Scatter), Monopoly `.sw(.on)` switch div | `label.bg-row` + `input.bg-toggle`, or `button.bg-row[role=switch]` + `span.bg-toggle`. The whole row is the 60px target |
| `.row select` | `.bg-row.bg-row--static` + `select.bg-select` |
| `.tag.off` (Official, blue), `.tag.house` (purple) | `.bg-tag--official`, `.bg-tag--house` |
| Monopoly `.badge.on` / `.badge.off` | The toggle shows on/off. Use `.bg-tag--official` / `.bg-tag--house` for where a rule comes from |
| `.toast` / `#toast` with `.show`, hand-placed `bottom: ...px` | `BGUI.toast(msg, {seat, icon})`. Mark sticky bars `data-toast-avoid` |
| Player status: Trouble/Sorry! `.status` + `.dot` + `.legend`, Monopoly `.status .pill .dot`, Rummy/Scatter `.chip`, Risk `.cchips > .cchip`, Uno/Rummy `.sc` rows | `.bg-players > .bg-player[data-seat]` (`BGUI.mount.players`), plus `BGUI.setTurn(chip)` every turn |
| Round and score tables (Uno `#roundSheet`, Rummy `.sc` / `.pc`) | `.bg-scorepad > table.bg-score` (`tr.is-lead`, `.bg-score__who[data-seat]`, `.bg-score__total`) |
| Win / game over (Uno "🏆 Game over" in `#roundBox`, and the others' `.overlay` cards) | `.bg-win` with medal, eyebrow, title, sub, `.bg-stats` (turns · bumps · time) and actions: `BGUI.win.open(el)` then `BGUI.celebrate()`. Drop the emoji |
| Pass-the-phone `#handoff .sheet` | `.bg-sheet` with `dismissible: false`, or a full-screen `.bg-card` |
| Monopoly `.dice .die`, Trouble/Sorry! roll results | `.bg-die` + `BGUI.dice.roll(el, value)`. Board-specific art such as the pop dome stays in the game |
| Monopoly `.stickyact` | A sheet footer row of `.bg-btn--block` buttons, marked `data-toast-avoid` |
| `.sub`, `.hint`, `.legend` text | `.bg-muted` / `.bg-faint`. On TV the remote legend is a `.bg-hintbar` |
| `skins.js` animated backgrounds (`#bgskin`, infinite `steps()` loops at 20 fps) and board frames (filter drop-shadows, colour rings) | Keep the `Skins.apply(game)` calls. Once the page loads `ui.js`, they give the Luxe stage and Luxe frames (section 1) instead: the static `body.bg-app` / `--scene` / `--felt` underneath, continuous motion only through the BGUI effects ticker, beats only through `BGUI.ambient`. Nothing else to remove |
| A page's own `window.__tvBack`, TV history guard and Back-key handler (Sorry! before the step 4 shared pass) | `BGUI.back`: the page keeps only its own step, `BGUI.back.on(fn)`, and calls `BGUI.back.arm()` when a game starts (section 1) |
| `sound.js` `#bgSndBtn` / `#bgSoundPanel` | sound.js still owns them (same ids, keys and focus trap; the ids have no hyphen, so they don't clash). With theme.css on the page they are built Luxe: the button docks in `.bg-topbar__end`, and the panel carries "Reduce effects" (section 1). BGUI's focus trap leaves that panel alone |

## 6. Effects: all on, all cheap (measured)

The CEO's rule is **keep the fancy effects**: every Luxe effect is ON by default and none is removed for performance. Each one is built so it costs little: only `transform` and `opacity` change, on layers that are already promoted; glows and rays are pre-rendered images or static gradients (no live blur, no box-shadow animation, no masked SVG); and everything stops while the page is hidden.

**One setting.** `BGUI.effects.set("reduced")` ("Reduce effects", default off, saved per device) turns the endless motion down for slow devices: the orbs rest after lighting up, the win rays and the confetti hold still (the confetti stays on screen), the opening burst is shorter, and glints come half as often. Glows, light pools, the trophy, focus and crossfades stay. The OS `prefers-reduced-motion` (or `html[data-motion=reduce]`) still wins: nothing moves and there is no confetti.

**One ticker.** The endless effects (the orbs' drift and the win screen's turning rays + falling confetti) are moved by ONE `BGUI` timer, not by CSS animations: 4 updates a second for the orbs (a few px a second, so it reads as continuous) and 24 for the win screen (film rate): the rays turn 6 degrees a second (the mockup's 60 s a turn, 0.25 degrees a step) and each of the 36 confetti pieces falls about one screen per 20 s (far ones slower), sways and spins (steps of about 2.3 px on TV and 1.8 px on the phone). It writes only `transform` on promoted layers, so a tick never lays out or repaints, and it is off while hidden, under "Reduce effects" and under reduced motion. The hero crossfade is stepped by a timer at `BGUI.effects.rate.beat` (30 a second). The glint, the turn pulse and everything else are one-shot CSS transitions or animations (compositor-driven).

**Why the win screen is cheaper now, with the same look** (review step 3c):
- The page under the opaque scrim is not drawn while a win is open (`body:has(.bg-win.is-open){visibility:hidden}`; browsers without `:has()` simply draw it). TV 66.7 % -> 38.0 %, phone 31.0 % -> 17.9 %.
- Only the bright inner 64 % of the ray wheel turns (`tex/rays-core.webp`, 23 KB, the same ray shapes and falloff with a soft edge); the faint outer rays (at most ~12 % alpha) are replaced by their angle-averaged light as a static halo gradient in the scrim.
- No animation stays applied after it ends (`animation-fill-mode: backwards` on the rays bloom, the card entrance and the orbs' light-up) and the wheel carries its own .6 opacity, so the rays box needs no offscreen surface: TV 50.6 % -> 37.6 % on a game-like page.
- Each confetti piece is its own tiny layer: no full-screen confetti sheet is blended on every tick.

| Effect | How it stays cheap | Phone 390x844 @2x | TV 1920x1080 |
|---|---|---|---|
| Idle page, everything still (control) | static stage on a fixed layer | 2.7 | 1.5 |
| Light orbs drifting forever (hub, lobby) | 3 pre-rendered glow WebPs (`tex/orb-*.webp`) on promoted layers, ticker 4 Hz | 5.9 | 13.5-16.7 |
| Logomark glint, fired back to back | own 16px layer, CSS opacity + transform through `BGUI.ambient`; ships 1 s in every 12 s, so about 1/12 of this on average | 11.7 * | 16.7 * |
| Turn-ring pulse (3 pulses, 4.8 s) | CSS opacity + transform on the ring pseudo-element through `BGUI.ambient` | 0.5-1.7 ** | 7.5 *** |
| Win screen held open: rays turning + confetti falling, 24 Hz | inner wheel from `tex/rays-core.webp` + static halo, 36 piece layers, opaque scrim, page under it not drawn | 17.9 | 38.0 |
| Win screen under "Reduce effects" | ticker off, confetti still | 0.0 | 0.2 |
| Win opening beat: celebrate burst + rays bloom + card entrance (3 s) | 1x canvas for 2.8 s, removed after | 17.6 | 31.0 |
| Hero crossfade every 1.5 s | the incoming pre-rendered backdrop fades in over the old one (one blended layer), stepped at 30 Hz; no rounded clip on the layers | 6.5 | 25.9 |
| Tile focus move every 1 s (D-pad on the shelf) | ring + game glow painted once on the tile's `::after`, opacity swapped instantly | 2.0 | 26.7 (about 0.27 CPU-second per move) |
| Game stage on a game page (`BGUI.stage`): 3 orbs + 12 (phone) / 16 (TV) rising gold-line motifs **** | every piece its own small promoted layer, transform only, ONE ticker: motifs 8 Hz (about 1 px a step on the phone, 1.3-1.8 px on TV), orbs 4 Hz | 8.3 | 26.5 |
| **Game stage in play since the step 4 review** (Sorry! in game, Red to draw): 3 orbs + 3 light beams + the motifs (2.1-5.4rem, opacity .11-.26, kept beside the board on TV) ***** | the same model: every beam a static gradient on its own promoted layer, moved by the same 8 Hz ticker (1.2 px a step on the phone, 1.8 on TV) | 8.7 | 25.9 |
| The same page without the beams (same run) | | 7.7 | 22.9 |
| Game stage under "Reduce effects" | ticker off, everything rests where it is | 0.3 | 1.6 |
| Game stage under reduced motion | ticker off, no light-up | 0.5 | 0.5 |
| The old `skins.js` background it replaces (same page, same run) | infinite CSS `steps()` loops, 20 frames a second | 23.5 | 49.5 |
| **Trouble in play with its halo** (step 4 shared pass; the whole page: stage + halo + the dome ring's glide + the board) ****** | the halo is ONE inline-SVG layer drawn once, turned 0.25 degrees a tick by the same 8 Hz ticker (transform only) | 29.6 (26.0 without the halo) | 46.9-53.5 (40.2 without) |
| Trouble in play with its halo, "Reduce effects" | ticker off, the halo rests | 1.2-2.2 | 1.4-1.6 |
| Trouble's pre-step-4 page in play (the old skin + the old endless dome ring), same window | | 51.1 | 56.9 |

% of ONE core: OS CPU time of every Edge process, headless Edge with `--disable-gpu` (software compositing, so these are pessimistic upper bounds), 6 s windows with everything else held still, measured 2026-10-14 in a REAL window of each size (TV 1920x1080 @1x, phone 390x844 @2x) by `BG_audit/design/luxe-build/repair/perf2.js` through `.dev/run-one.ps1`. The core step's earlier TV figures were taken with 1920x1080 emulated inside a 390x844 window and read far too low; the review caught it. \* the review's real-window run of the same CSS glint (`luxe-review/run3.js`). \*\* core run, phone window. \*\*\* the same pulse stepped by a timer (A/B); the shipped CSS pulse was not re-measured in a TV window.

\*\*\*\*\* Step 4 review follow-up (Sorry!): the review measured how much of the screen really moves in play - the share of screen pixels that change in 1.5 s (any channel by more than 5), in real windows - and found the stage of the row above at 0.7 % on the phone and 0.2-0.5 % on TV, against 17.8 % and 11.2-14.5 % for the old skin on the same page: the motifs were thin, faint and mostly behind the board and panels. With the beams, the bigger motifs and the free-column placement it is **17.7-20.5 % on the phone and 13.9-15.1 % on TV** (6 windows each; `BG_audit/step4/sorry/repair/rp-final.js`, `final2-*.json`). In play the page measured 8.7 % (phone) and 25.9 % (TV) with the stage, 7.7 % and 22.9 % without the beams, 1.8 % and 2.2 % under "Reduce effects". Text that sits right on the stage keeps at least 4.5:1 with a beam forced at its brightest behind it (worst 10 % of the pixels; the deck's eyebrow 5.2:1 on the phone).

\*\*\*\*\*\* Step 4 shared pass (Trouble's review problem 11: its in-game ambient looked sparser than its old skin). Measured with the same pixel method in play, Red to pop, 4 players: the stage as Trouble shipped it moved **26.6 % of the phone screen but only 18.8 % on TV**, where its old skin (a 150vmin rainbow ring turning round the screen centre, 8 colour glows, 4 dice, the old dome ring) moved **29.3 %** (median of 14 windows over 4 runs; phone 22.2 %). The halo closes it: **phone 32.5 %, TV 31.7 %** (k 1.7; the old page 29.5 % in the same run). The halo's reach is what counts: on TV k 1.36 / 1.5 / 1.6 gave 24.2 / 25.5 / 26.7 %, and turning it 2.5 instead of 2 degrees a second added nothing. The TV CPU range is k 1.36-1.6 (runs 4-5); the final run's CPU was taken under a 10 % CPU cap (other apps had the PC at 52 %) and is not comparable. The hint bar beside the board keeps 6.1:1 at worst (8.7:1 for the worst 10 % of its pixels) with a long ray aimed right at it. **The motif hush** (section 1) costs no visible motion (Sorry! in play: phone 19.3 % without, 19.8-20.5 % with; TV 14.8 % without, 14.6-14.7 % with) and clears the text: motifs over text in 8 frames went from 24 visible (Sorry!'s deck rule, phone) and 33 (Trouble's TV hint bar) to 0. Every adopter's motion target is in `BG_audit/step4/baseline/baseline.json` (`motion`) and `BG_audit/step4/README.md`.

\*\*\*\* Step 4 prep: the Sorry! setup screen loaded with the section 1 head snippet (an adoption preview in a full-window same-origin frame, so `ui.js` really runs deferred after the game's scripts), measured by `BG_audit/step4/check.js` with `step4/prep/actions-stage.js`, same method and real windows, the old skin measured on the same page in the same run. The step-4 BEFORE baseline of all 9 pages is in `BG_audit/step4/baseline/baseline.json`: the old skins cost 12.6-20.8 % on the phone and 24.7-44.7 % on TV. Trouble's setup screen costs 66 % / 53 % on its own, with motion off too: its board's `domeRing` CSS pulse runs forever (game CSS, not the skin; the Trouble agent fixes it).

What the A/B runs showed (same look, real windows):

| Same look, implementation | Phone | TV |
|---|---|---|
| Win, core build: ticker 8 Hz, rays 3 deg/s (half the mockup speed), one confetti sheet (review run) | 13.0 | 39.5 |
| Win, core build moved at 24 Hz (review run) | 28.5 | 68.2 |
| Win, this build, 24 Hz, page under the scrim still drawn | 31.0 | 66.7 |
| Win, this build, 24 Hz, rays only / confetti only | 18.6 / 13.9 | 34.3 / 25.8 |
| Win, this build at 16 Hz (3.4 px confetti steps on TV) | 15.2 | 31.6 |
| **Win, this build at 24 Hz (shipped)** | **17.9** | **38.0** |
| Glint stepped by a timer at 30 Hz instead of the CSS animation | 19.9 | 15.3-17.5 |
| Hero crossfade stepped at 60 Hz instead of 30 Hz | 10.0 | 25.5 |
| Game stage with the motifs at 4 Hz (`BGUI.effects.rate.stage = 4`: 2.6-3.6 px steps on TV) | 6.6 | 13.0 |
| Game stage, orbs only (no motifs) | 1.0 | 14.1 |
| Game stage, motifs at 8 Hz (step 4 prep) | 8.3 | 26.5 |
| Visible motion in play, % of the screen's pixels that change in 1.5 s (Sorry!, step 4 repair): the motifs alone; beams across the whole width (3 x 8rem on TV); beams waiting off screen 0.4 of their range between sweeps; **the shipped beams (no wait, 0.6 rem/s; phone 9.5rem, TV 9rem in the free column)** | 0.8; -; 13.1-15.4; **17.7-20.5** | 0.7; 6.2-7.3; 10.7-11.4; **13.9-15.1** |
| **Game stage in play with the beams (shipped)** | **8.7** | **25.9** |
| Visible motion in play, Trouble (step 4 shared pass): the stage as Trouble shipped it; the old skin (pre-step-4 page); the halo at k 1.36 / 1.5 / 1.6; **the shipped halo (phone k 1.85, TV k 1.7)** | 26.6; 22.2; -; **32.5** | 18.8; 29.3; 24.2 / 25.5 / 26.7; **31.7** |

**Still over ~15 % on TV in software compositing** (open for the CEO): the win screen (38 %), the hero crossfade (26 % while crossfading every 1.5 s), tile focus moves (27 % at one move a second), the game stage (26.5 %, and 25.9 % in play with the step-4 light beams; the old skin it replaces cost 49.5 % on the same page; at 4 Hz it is 13 %, but the motifs then visibly step by 3 px), Trouble's halo (about 7-13 % on top of its stage: Trouble in play 47-54 %, its old page 57 %), the orbs (about 15 %) and the glint fired back to back (17 %, but it ships 1 s in 12 s). Per-process numbers show the cost sits in the compositor (GPU process), not in page script: at 1920x1080 every composited frame redraws its damaged area in software (the whole screen for falling confetti, the ray wheel's rotated 1000 px square), so the cost follows area x frames. The cheaper options left all change the look - a smaller turning wheel means shorter rays, fewer than about 16 updates a second shows steps - so they are not taken. A Fire TV composites on its GPU, where this work largely leaves the CPU, and "Reduce effects" is the switch for a slow device.

The lesson: in software compositing a running CSS animation keeps the compositor producing frames at 60 Hz even when `steps()` changes the value only 10 times a second, and every full-screen layer costs a full-screen composite per frame. So endless motion goes through the low-rate ticker, and the win screen has one wheel layer, one confetti layer and an opaque scrim.

**Rules for anything new:**
- Animate or transition only `transform` and `opacity`. Backgrounds, box-shadows and colours swap instantly (press, select, focus).
- No `filter`, `backdrop-filter`, SVG filters (`feGaussianBlur`, `feTurbulence`), `mask` on anything that moves, or `color-mix()`.
- Glows are static gradients or pre-rendered images in `tex/`. Big moving layers are images moved by `transform`.
- No endless CSS animation (`infinite`). Endless motion goes through the effects ticker; one-shot beats through `BGUI.ambient`.
- Respect `document.hidden`, `html[data-effects=reduced]` and reduced motion.
- Measure: copy `BG_audit/design/luxe-build/perf.js`, run it through `.dev/run-one.ps1`, and keep each effect under about 15 % of one core in software compositing. Over that, build a cheaper version of the same look; never remove the effect.

## 7. Do and don't

**Do**
- Theme with `data-game`. Use `--accent-text` for accent-coloured text on ink, `--accent-ink` on an accent fill and `--accent-paper` on paper. Use `--seat-ink` on a seat colour and `--seat-text` for seat-coloured text on ink.
- Keep text on tokens: `--fs-micro` (12px phone, 21px TV) through `--fs-5xl`. Never hard-code a px or rem font size below `--fs-micro`, or the TV floor breaks. Secondary text is Manrope 500 or heavier (`.bg-muted`, `.bg-faint`, `--fw-body`).
- Keep every target at least `var(--tap)` (44px phone, 72px at 1080p TV), and make whole rows the target.
- Put the concrete outcome under each move choice (`.bg-sheet__detail`) and the confirmed setup under the Start button (`.bg-btn__sub`).
- Call `BGUI.setTurn()` each turn, `BGUI.mount.emblem()` for the logomark and `BGUI.mount.orbs()` on hub and lobby pages. Leave the scheduling to BGUI.
- Give containers of focusables room for the ring (`.bg-focus-room` or `padding: var(--focus-room)`), and never `overflow: hidden` right around them.
- On TV keep focusable neighbours 1.5rem apart, so a focused control's ring and lift never touch the next. theme.css does it for the segs and keypads, the version cards, the top bar, the sound panel and the win actions; a page's own rows (a save bar, a controls row, chips) need the same.
- Mark text that sits right on the stage `data-stage-text` and measure it with each light beam forced at its brightest behind it, phone and TV (the worst 10 % of its pixels: 4.5:1, large text 3:1; `BG_audit/step4/shared-c/actions-4c.js` has the method). Use `="strong"` where a bright scene needs it.
- On a TV layout with a side column, centre the in-game toast over the column (page CSS, section 3) and keep the hint bar in it: toasts avoid the bar.
- Re-run `BG_audit/design/luxe-build/contrast.js` and `accents.js` after changing any colour token.

**Don't**
- Don't break the effects rules in section 6.
- Don't put the seat colour on text over a busy surface. Use ivory text with a seat dot (`.bg-player.is-turn` already does this).
- Don't put `url()` inside custom properties. The image URLs live in theme.css so they resolve next to it.
- Don't use arrows (U+2190-2192) in UI text: the font subsets don't have them. Write "to".
- Don't add globals. Extend `BGUI` here instead of copying helpers into games.

## 8. Service-worker caching (publish step)

Each game's `sw.js` must list the ui files in `ASSETS` and bump `VERSION`:

```js
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.png", "../sound.js", "../skins.js", "../saves.js",
  "../ui/theme.css", "../ui/ui.js", "../ui/icons.js",
  "../ui/fonts/dmserifdisplay-latin.woff2", "../ui/fonts/dmserifdisplay-italic-latin.woff2", "../ui/fonts/manrope-var-latin.woff2",
  "../ui/tex/felt.webp", "../ui/tex/paper.webp", "../ui/tex/orb-gold.webp", "../ui/tex/orb-violet.webp", "../ui/tex/rays-core.webp"];
```

The hub's `sw.js` needs the same files with `ui/...` paths, plus the hub art it shows: `ui/art/thumb-<game>.svg` and `thumb-<game>-sm.svg`, the hero backdrops it uses (`ui/art/hero-<game>-960.webp`, and `-1920.webp` on a 1080p TV: 409 KB for all 16) and the icon PNGs its manifest names. Each game caches its own icon PNGs. Every game shares one origin and the caches are per game, so each game must cache its own copy for offline play. `styleguide.html`, `README.md` and the OFL texts don't need caching. The old Tabletop files (`fraunces-var-latin.woff2`, `figtree-var-latin.woff2`, `tex/walnut.webp`, `tex/oak.webp`) are gone: drop them from any `ASSETS` list.

## 9. What belongs to later steps

- **Art step: done** (section 10). Thumbnails with simplified `-sm` variants, icons, the Fire TV banner, the TV hero backdrops and every PNG export are in `art/`; the original Uno wild, the Monopoly DEED and the Trouble pegs are in place.
- **Step 4 prep: done.**
  - The game stage: `BGUI.stage`, plus the `Skins.apply` hand-over in `skins.js`.
  - Luxe board frames (`--frame-shadow`, `.bg-frame`).
  - The Luxe sound button and panel, with "Reduce effects" in the panel. Also available as `BGUI.mount.effectsRow`.
  - The check harness `BG_audit/step4/check.js`, with example actions in `step4/actions/styleguide.js` and the adoption-preview technique in `step4/prep/actions-stage.js`.
  - The BEFORE baseline of all 9 pages, `step4/baseline/` (`baseline.json` and setup screenshots). `check.js` compares against it by itself.
- **Step 4 shared pass (batch 4b): done.**
  - The TV Back default `BGUI.back` (section 1): every adopted game page gets `window.__tvBack`, the history guard and the Back key; Trouble and Sorry! use it (Sorry!'s own copy is gone, same behaviour).
  - The motif hush over text on the stage (`data-stage-text`) and Trouble's halo (section 1, measured in section 6).
  - The win screen locks the page scroll (`html[data-win]`); the opening burst was checked to draw under the card (no change needed).
  - `BG_audit/step4/check.js`: `--motion` / `ctx.motion` (the visible-motion measure), `ctx.toastCheck(label, {sheet})` and `--toast-sheet` (a toast with a tall sheet open), and CPU windows that put the effects level back. See `BG_audit/step4/README.md`.
  - The motion baseline of every page that has not adopted `ui/` yet (setup, in play, the Party lobby and a Party game), phone and TV, in `baseline.json` (`motion`): each adopter's target.
- **Step 4 shared pass (batch 4c): done** (BGUI 2.4.0; what Monopoly and 500 Rummy fixed on their own pages, made shared):
  - TV ring gaps: `.bg-seg` / `.bg-seg--grid5`, the top bar's ends, `.bg-versions` and the sound panel's button row stand 1.5rem apart on TV; Trouble's and Sorry!'s save bars too (page CSS). Monopoly's identical page overrides are gone.
  - The stage-text halo (scene and felt) and `data-stage-text="strong"`; Trouble's and Sorry!'s setup texts marked and measured with a beam at its brightest behind them.
  - `.bg-player.is-out`: a dark chip, the piece and CPU badge faded, the text at full contrast (Monopoly's override folded in).
  - Toasts keep clear of the TV hint bar; the bar steps aside while a sheet that holds Back is up (`html[data-back-held]`: Rummy's behaviour, shared); Trouble's TV toasts sit in its right-hand column.
  - `BGUI.setTurn` ends a pulse on a chip a rebuilt strip left behind; `BGUI.ambient` never starts or waits on a beat whose element left the page.
  - `BG_audit/step4/check.js`: the D-pad walk keys a switch by its row's title. Scripts and results: `BG_audit/step4/shared-c/`.
- **Step 4 (games adopt ui/):**
  - Add the section 1 head snippet. Keep `Skins.apply(game)` and `Sound.mountButton()`: the Luxe stage, the frames, the Luxe sound button and the "Reduce effects" switch then come by themselves. Nothing of the old skins needs removing.
  - Register the page's Back step with `BGUI.back.on(fn)` and call `BGUI.back.arm()` when a game starts (section 1). Mark text that sits right on the stage `data-stage-text` (the halo comes with it; measure it with a beam at its brightest behind it and use `="strong"` where it falls short), and a board the stage does not know `data-stage-solid`.
  - Put the `.bg-topbar` markup before the script that calls `Sound.mountButton()`, so the button docks in it.
  - Swap each game's patterns using the table in section 5; setup pages on `.bg-app--scene`.
  - Wire `setTurn`, `ambient`, the toast placement and `BGUI.win` + `celebrate` with stat pills (turns, bumps, time).
  - TV: keep a page's own rows of buttons 1.5rem apart, centre the in-game toast over a side column, and use the hint bar's shared words ("Back  Close a list, or the Menu").
  - Write contextual CTA labels ("Start Uno · 5 players") and move-sheet detail lines with real data.
  - `firestick/play.html` has no sound panel: add `BGUI.mount.effectsRow()` to its settings, if it gets a settings sheet.
  - Run `BG_audit/step4/check.js` on the page, phone and TV, with an actions module for the game's flow (start, sheet, win). Compare with the baseline, including the visible motion in play (`ctx.motion`) against the old skin's (`vsBaseline.motionBefore`).
  - Add the ui files to every `sw.js` (section 8).
- **Step 5 (play surfaces):** the in-game boards and tables on the Luxe surfaces (`.bg-surface--felt / --paper / --parchment / --board`): Sorry! track, Monopoly board with money and deeds, Rummy felt with meld rows, Uno table, Scattergories pad with letter die and timer, the Risk world map. All filter-free, static rasters with pieces on transform-animated layers.
- **Step 6 (Party Mode):** TV lobby with `.bg-seatcard` + `.bg-status` (HOST / READY / JOINING / CPU), `.bg-orbs`, a real runtime QR code next to the letter-tile room code, and the lobby copy.
- **Step 7 (hub):** all 7 game tiles plus a full Party Mode tile, always present, with player-count badges (`.bg-tile__badge`); the Continue card separate from the grid; the TV poster hero on `.bg-hero` with pre-rendered backdrops (measure one D-pad move); `.bg-orbs` and the logomark glint.
- **Step 8 (Android / Fire TV):** placement of the exported launcher icons and banner; the bridge sets `window.AndroidTV` so pages get `html[data-tv]`.

## 10. Art (`ui/art/`)

Original Midnight Luxe art: spot-lit vector scenes on each game's deep colour, jewel lacquer and champagne-gold trim, every edge fading into the game's `--accent-deep` so the art works sliced, letterboxed or scaled on that colour with no seam.

- **Filter-free and font-free.** Glows and shadows are gradients (no SVG filters), every glyph is outlined to a path from DM Serif Display / Manrope (no `<text>`), and nothing references a URL. A plain `<img>`, a launcher and the Fire TV banner look identical with no font loaded.
- **Original, no trade dress.** No official logos or names on the art.
  - Monopoly shows a "DEED" for "Grand Avenue", gold houses and a sapphire hotel (never "TITLE DEED", never green houses with a red hotel).
  - Uno shows lacquer number cards (serif numerals, no oval) and an original gold-lacquer card with a four-colour star on a midnight diamond inlay (no black "WILD" card, no quadrant disc, no disc or oval anywhere).
  - Trouble shows pegs (the Tabletop peg shape, re-lit with a gold collar) round the pop-dome, not balls.

| File | Size | Use |
|---|---|---|
| `thumb-<game>.svg` (trouble, sorry, monopoly, rummy500, risk, uno, scatter, party) | 320 x 240 (4:3), 5-18 KB | Hub and TV tile art, and any art box wider than about 220 CSS px |
| `thumb-<game>-sm.svg` (same 8) | 320 x 240, 5-12 KB | Simplified variant (fewer, bigger things; the top-left corner kept clear for `.bg-tile__badge`) for art boxes of about 220 CSS px and below: the phone's 2-up shelf (160-175 px) and the TV lobby cards |
| `hero-<game>-1920.webp`, `hero-<game>-960.webp` (7 games + party) | 1920 x 1080 (27-42 KB) and 960 x 540 (12-17 KB); 409 KB for all 16 | `.bg-hero` backdrops for `BGUI.hero.show`: TV hub poster, Party lobby, setup header. The fade into the deep colour is baked in |
| `icon-<name>.svg` (collection + 7 games + party) | 512, rounded square (the art is clipped to it) | `purpose: "any"` source |
| `icon-<name>-192.png`, `-512.png` | 192 / 512 | Manifest `purpose: "any"` |
| `icon-<name>-maskable-512.png` | 512, full bleed | Manifest `purpose: "maskable"`: the key art sits inside the central 80 % circle, with a gold ring at r 198 for circle masks |
| `apple-touch-icon-180.png` | 180, full bleed | `<link rel="apple-touch-icon" href="ui/art/apple-touch-icon-180.png">` |
| `banner-tv.svg`, `banner-tv-320x180.png`, `banner-tv-640x360.png` | 320 x 180 | Fire TV / Android TV launcher banner (`android:banner`): the gold "Board" + ivory italic "Games" wordmark, the logomark, fanned jewel cards and the gold die |
| `android/ic_launcher-<density>-<px>.png` | 48 / 72 / 96 / 144 / 192 | Collection launcher icon for mdpi / hdpi / xhdpi / xxhdpi / xxxhdpi |

**Small variants.** Let the browser pick by width. The style guide's shelf does this:

```html
<span class="bg-tile__art"><picture>
  <source media="(max-width: 30em)" srcset="ui/art/thumb-uno-sm.svg">
  <img src="ui/art/thumb-uno.svg" alt="" width="320" height="240" decoding="async">
</picture></span>
```

TV lobby cards (about 150 px at 1080p) use `thumb-<game>-sm.svg` directly.

**Hero backdrops.** They are composed for a wide poster: the art fills the right ~55 % and the left is a clean deep-colour field for the title. The bottom and left edges are already faded into `--accent-deep`, which is also the layer's background colour.

- Pick the size: 1920 on a 1080p TV, 960 everywhere else (phone, desktop, a 960x540 TV WebView).

```js
var src = "ui/art/hero-" + game + "-" + (document.documentElement.hasAttribute("data-tv") && innerWidth * (devicePixelRatio || 1) > 1280 ? 1920 : 960) + ".webp";
BGUI.hero.show(".bg-hero", { game: game, src: src });
```

- **TV:** a full-width `.bg-hero` (16:9 or wider) with the text on the left. The default `background-size: cover; background-position: 100% 50%` is right.
- **Narrow heroes** (phone, or any box narrower than about 16:10): give the art its own band above the text so nothing sits on it. Put `padding-top: 46%` on the `.bg-hero` and `background-size: 100% auto; background-position: 100% 0` on its layers, as the style guide does.
- **Cost** (`luxe-build/art-check.js`, same method as section 6, % of one core):
  - a crossfade every 1.5 s with the WebPs: 8.2-10.6 % on the phone, 12.1-13.3 % on TV;
  - ONE D-pad move: about 0.1 CPU-second on the phone and 0.25 on TV, whether the image is new or already decoded;
  - the 8-tile shelf with the art: idle 0-1 %; a focus move every second: 2.0-3.2 % on the phone, 9.8-10.1 % on TV.

The art step added no new effect images: the core's `tex/orb-gold.webp`, `tex/orb-violet.webp` and `tex/rays-core.webp` are the shipped glow and ray set.

**Checks and generators (dev-time only, outside the repo).** `BG_audit/design/luxe-build/` holds:

- `gen-art.js`: writes every SVG above, plus the maskable and hero sources.
- `render.js`: the PNG and WebP exports through headless Edge, and the contact sheet `shot-art-contact.png`.
- `art_lint.js`: no filters, no `<text>`, no URLs, 25 KB or less, no "WILD" or "TITLE DEED" in labels or outlined words, and no solid disc or oval in the Uno art.
- `png_check.js`: the pixel size of every PNG and WebP, read from its header, and the 1.5 MB hero budget.
- `art-check.js`: the art in the style guide, the variant choice and the CPU figures.
- `inst-fonts-luxe.py`: TTF copies of the shipped fonts for outlining.

The core's checks are there too: `verify.js` (style guide at 390x844, 1366x768, 1920x1080 TV and 960x540 TV), `perf.js` (per-effect CPU), `contrast.js`, `accents.js`, `palette.js`, `seats.js` and `make-fx.js` (renders `tex/orb-*.webp` and `tex/rays-core.webp`).
