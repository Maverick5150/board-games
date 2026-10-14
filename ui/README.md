# Board Games UI: the shared "Midnight Luxe" design system

This folder is the shared look for all seven games, the hub and Party Mode. It's a prestige streaming-app look made for game night: deep blue-violet ink surfaces, hairline panels lit from the top, a champagne-gold signature (gold-gradient primary buttons, gold eyebrows, the gold "diamond die" logomark), DM Serif Display with Manrope, one jewel tone per game, and spot-lit art that fades into each game's deep colour.

- Plain CSS and JS, with no build step, no CDN and no runtime dependency.
- Every class starts with `bg-`, and the only global is `window.BGUI`, so it sits next to each game's own CSS without clashes.
- Open `ui/styleguide.html` to see every token, component, surface and effect. Add `?tv=1` for the TV layout, `?effects=reduced` for "Reduce effects" and `?motion=reduce` for reduced motion.
- The Tabletop system this replaced is kept in git under the tag `design-tabletop`. The class names and the `BGUI` API are the same, so nothing that adopted Tabletop has to change.

| File | What it is |
|---|---|
| `theme.css` | All tokens (custom properties), `@font-face`, the 8 per-game `[data-game]` themes, the 10 seats, TV scale (`html[data-tv]`), effects levels, reduced motion and every `bg-` component |
| `ui.js` | `window.BGUI`: toast, sheet, win, celebrate, effects, hero, flip, tweenNumber, countdown, ambient, setTurn, focus (D-pad), dice, setTV, haptic, mark, trophy, mount.* |
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

## 2. Class reference

| Class | Use |
|---|---|
| `.bg-app`, `.bg-app--scene`, `.bg-app--felt` | Body: the ink stage (static light pools + vignette on a fixed layer), the per-game scene tint for setup pages, or the game's spot-lit felt as the whole table |
| `.bg-surface--stage` (alias `--wood`), `--felt`, `--paper`, `--parchment`, `--board`, `--rail` (alias `--oak`) | The tactile homes, all spot-lit on the dark stage: deep felt under a pool of light (Rummy, Uno), a lit paper pad (Scattergories), parchment (Risk), a gold-framed board plane (Sorry!, Trouble, Monopoly), a rail for trays and frames. Grain is a pre-rendered tile, light is a static gradient. Text colour is set for you; on felt and board `--text-faint` steps up to text-2, on paper the muted tokens switch to dark ink |
| `.bg-spot` | A static pool of light from above on any positioned card |
| `.bg-display`, `.bg-h1/h2/h3`, `.bg-italic`, `.bg-eyebrow` (`--accent`), `.bg-gold`, `.bg-muted`, `.bg-faint`, `.bg-num`, `.bg-section`, `.bg-rule`, `.bg-sr` | Type helpers. Display type is DM Serif Display; UI is Manrope 500+. `.bg-eyebrow` is gold 800 caps (12px phone, 21px TV); `.bg-gold` is gold-gradient text; `.bg-section` is an eyebrow followed by a gold hairline; `.bg-sr` is screen-reader-only text |
| `.bg-btn` with `--primary` (gold), `--secondary` (lit ink), `--ghost` (gold hairline), `--accent` (the game's colour), `--danger`, `--icon` (round), `--paper` (with `--icon`, on paper), `--sm`, `--lg`, `--block` | Buttons. Press feedback is a transform plus a shade pseudo-element that fades by opacity; fills swap instantly. `--sm` shrinks the label, never the 44px target |
| `.bg-btn--cta` with `.bg-btn__label` and `.bg-btn__sub` | Start button with a confirming sub-label ("Start Uno / 5 players · Classic") |
| `.bg-topbar` with `__start`, `__title` (`.bg-eyebrow` + `.bg-topbar__name`), `__end` | Sticky opaque ink bar. For the D-pad it is its own zone, and focused page controls are scrolled clear of it |
| `.bg-card`, `.bg-inlay`, `.bg-plaque` | Lit panel (hairline + top light), sunken well, gold nameplate |
| `.bg-versions` > `.bg-version[data-value][aria-checked]` with `__art`, `__title`, `__meta`, `__desc` | Version / option cards. Selected: gold hairline, the accent's glow and a gold check seal. Wire with `BGUI.mount.versions` |
| `.bg-seg` (`--text`, `--grid5`) > `button[aria-pressed]` (or `.is-on` / `.on`) with an optional `<small>` | Segmented picker in a sunken well; the selected cell is gold. `--grid5` is the 0-9 keypad. Wire with `BGUI.mount.seg` |
| `.bg-stepper` with `__btn`, `__val`, and `.bg-pips > i.is-on` | CPU stepper (- [3] +) with a diamond pip row: the narrow-phone alternative to the keypad. Use `BGUI.mount.stepper` |
| `.bg-rows` > `.bg-row` (`label` with `input.bg-toggle`, or `button[role=switch][aria-checked]` with `span.bg-toggle`), `__main`, `__title`, `__desc`, `.bg-row--static` | Whole-row rule toggles (60px). The row is the target, not the switch. The switch's gold fill fades by opacity and the knob slides by transform |
| `.bg-select` | Native select, 44px, gold hairline. On TV the D-pad never gets stuck on it: arrows move on, OK opens the picker |
| `.bg-tag--official / --house / --accent / --paper / --new / --ok` | Tags. Fills are opaque, so they stay legible on artwork |
| `.bg-status--host / --ready / --joining / --cpu` | Lobby status pills (Party Mode) |
| `.bg-seatcard[data-seat]` (`--empty`) with `.bg-token`, `__name`, `.bg-status` | TV lobby seat card (step 6) |
| `.bg-chip` (+ `.bg-chip__dot`, `[data-seat]`), `.bg-badge` | Info chips and gold count badges. They are labels, not controls (no focus ring): use a `.bg-btn` for anything tappable |
| `.bg-stats` > `.bg-stat` (`<b>38</b><span>turns</span>`) | Stat pills for win screens and summaries (serif gold numbers) |
| `.bg-players` (`--scroll` for 5-10 players) > `.bg-player[data-seat]` with `.bg-token`, `__txt`, `__name`, `__meta`, `__cpu`, `.is-turn`, `.is-out` | Player strip. The default is a wrapping grid (2-up on a phone). Names and meta get an ellipsis. The turn chip gets the seat tint, a static turn ring and a TURN tag (12px phone, 21px TV); its meta is ivory with a seat dot, so colour never carries the text. `BGUI.mount.players` and `BGUI.setTurn` drive it |
| `.bg-token[data-seat]` | Lit seat-colour piece with a dark label |
| `.bg-scorepad` > `table.bg-score` with `tr.is-lead`, `.bg-score__who[data-seat]`, `.bg-score__total` | Scoreboard on a lit panel; the leader's row is washed in gold |
| `.bg-sheet` with `__grip`, `__head`, `__title`, `__sub`, `__options` > `button.bg-sheet__option` (`.bg-token`, `.bg-sheet__text` > `__label` + `__desc` + `__detail`, then a chevron), `.is-best` | Bottom sheet. Each choice has a plain-English line and a concrete detail line ("space 22 to 28"). Write "to", not an arrow: the font subsets have no U+2190-2192, so an arrow would fall back to a system font. Open and close it with `BGUI.sheet` |
| `.bg-toast` | Created by `BGUI.toast()`. Don't place it by hand |
| `.bg-win.is-open` > `.bg-win__scrim`, `.bg-win__rays`, `.bg-win__card` > `.bg-win__medal`, `.bg-eyebrow`, `.bg-win__title`, `.bg-win__sub`, `.bg-stats.bg-win__stats`, `.bg-win__actions` | Win screen: opaque scrim with gold light, a 20-ray gold wheel that turns for as long as it is open, drifting confetti, the laurel trophy and a gold "Victory". `BGUI.win.open(el)` builds the wheel, the confetti layer and the trophy, and makes it modal (Tab and the D-pad stay inside; `BGUI.win.close()` gives focus back). Call `BGUI.celebrate()` for the opening burst |
| `.bg-tiles` > `.bg-tile[data-game]` with `__art` (+ `.bg-tile__badge` player count), `__label`, `__name`, `__meta`, `__seal`, `.bg-tile--party` | Hub / TV game tile: spot-lit art fading into the game's deep colour, serif name, player-count badge, seal. 2 across on a phone, 4 on TV. Party Mode is a full tile. On focus the ring and the game's glow fade in on the tile's own `::after` layer |
| `.bg-hero` > `.bg-hero__layer` x2, `.bg-hero__shade`, `.bg-hero__body` (`.bg-eyebrow`, `.bg-hero__title`, `.bg-hero__pitch`) | TV hub poster / lobby hero: two stacked backdrop layers crossfaded by `BGUI.hero.show` |
| `.bg-orbs` > `i` x2-3 | Hub / lobby light orbs (pre-rendered glow images). `BGUI.mount.orbs(host)` adds them; the effects ticker drifts them |
| `.bg-emblem` (`--lg`, `.is-glint`) | The gold "diamond die" logomark with its glint. `BGUI.mount.emblem(el)` fills it and registers the glint with `BGUI.ambient` |
| `.bg-die` (`--seat`, `--gold`) | Ivory die: `BGUI.dice.render/roll` |
| `.bg-countdown` | Ring timer: `BGUI.countdown(el, s)` |
| `.bg-hintbar` with `.bg-key` | TV remote legend |
| `.bg-focus`, `.bg-focus-room` | Gives any element the shared focus ring and TV lift. `.bg-focus-room` pads a container so rings are never clipped |

Focus ring: every `bg-` control gets the same ring on `:focus-visible`, and also on `.is-focus`, which `BGUI.focus` sets for the D-pad and for old WebViews. The ring is a dark gap, then an ivory `#fff3d1` ring, then a soft gold glow: shape and light, never colour only. On TV, buttons, tiles, version cards and `.bg-focus` also lift (scale 1.05). The ring swaps instantly and never transitions; tiles carry it on a pre-promoted `::after` that only changes opacity.

## 3. `window.BGUI`

Every call is safe if its element is missing: it returns `null`, `false` or a resolved promise.

| Call | Does |
|---|---|
| `BGUI.haptic("tap"\|"select"\|"turn"\|"success"\|"warn"\|"error"\|"roll"\|ms\|[pattern])` | Guarded `navigator.vibrate` that returns a boolean. Turn it off with `BGUI.haptic.enabled = false` |
| `BGUI.toast(msg, {ms, seat, token, icon, html, place: "auto"\|"top"\|"bottom", haptic})` | One shared toast. Its position is computed from the layout: clear of an open sheet, the top bar, every `.bg-players` strip and `[data-toast-avoid]` elements, so it never covers the player strip. `BGUI.toast.hide()` |
| `BGUI.sheet.open(el, {onClose, dismissible, focus})`, `.close(el?)`, `.isOpen(el?)`, `.top()` | Bottom sheet with a scrim. It traps focus (Tab and D-pad), closes on Back/Escape/scrim and restores focus to the opener. Nested sheets stack |
| `BGUI.win.open(el, {focus})`, `.close(el?)`, `.isOpen()` | Opens or closes a `.bg-win`: builds the ray wheel, the confetti layer and the trophy once, adds `.is-open`, aims the rays at the trophy, moves focus inside and restores it to the opener on close. While it is open the orbs rest and the effects ticker turns the rays |
| `BGUI.celebrate({ms, colors, count, origin, rays, into})` | One-shot canvas burst of gold confetti (diamonds and strips, a few jewels) plus a gold ray bloom, about 2.8 s (2 s and half the pieces under "Reduce effects"). The canvas is removed afterwards; returns a promise. Nothing under reduced motion or when the tab is hidden. Inside an open `.bg-win` it draws behind the card |
| `BGUI.effects.get()`, `.set("full"\|"reduced")`, `.motion()`, `.state()`, `.key` | The one effects setting. `set` writes `html[data-effects]` and `localStorage["bgui.effects"]` (try/catch) and fires `bgui:effects`. `motion()` is what really runs: `"full"`, `"reduced"` or `"off"` under reduced motion. `state()` is `{level, motion, hz}` where `hz` is the effects ticker's rate (4 orbs, 24 win screen, 0 still). `rate` = `{orbs: 4, win: 24, beat: 30}` (updates a second; `beat` steps the hero crossfade) |
| `BGUI.hero.show(el, {src, game})`, `.layers(el)` | Crossfades the two `.bg-hero__layer` backdrops by opacity. With `src` the next image is decoded first; a newer call (fast D-pad) wins. `game` themes the layer and the hero |
| `BGUI.mark()`, `BGUI.trophy()` | The gold logomark and the laurel trophy as inline SVG strings (gradients only: no filters, masks or `<text>`) |
| `BGUI.flip(el, fromRectOrEl, {ms, spring})` | FLIP move: read the rect, move the DOM, then call `flip`. Uses transform only |
| `BGUI.tweenNumber(el, from, to, ms, {format})` | Counts cash, scores and similar values |
| `BGUI.countdown(el, seconds, {low, onTick, onDone})` | Ring timer that updates 4 times a second, not as a continuous animation. Returns `{stop, pause, resume, remaining(), done}` |
| `BGUI.ambient.add(el, {cls, ms, delay})`, `.remove(el)`, `.trigger(el, {cls, ms})`, `.pause()`, `.resume()`, `.state()`, `.every` | The ONE scheduler for decorative beats (logomark glint, turn pulse). One beat at a time, a periodic beat every 12 s (24 s under "Reduce effects"), paused while hidden or under reduced motion. With nothing registered no timer runs |
| `BGUI.setTurn(playerEl, {pulse, haptic})` | Moves the static turn ring and asks `ambient` for 3 pulses. Call it every turn |
| `BGUI.focus.enable({root, autofocus})`, `.disable()`, `.move(dir)`, `.set(el)`, `.first(scope)`, `.candidates()`, `.enabled` | D-pad spatial navigation over `[data-focus]` and focusable elements. The first arrow lands on the first page control (not the bar), same-row/column moves win, Enter/OK clicks, focus is scrolled into view below the sticky top bar, and it never leaves an open sheet or win screen. A `<select>` never keeps the arrows (OK opens its picker), a text field keeps Left/Right only while typing, radios and sliders keep Left/Right but let Up/Down move on. It is on automatically in TV mode |
| `BGUI.dice.svg(n)`, `.render(el, n)`, `.roll(el, final?, {ms, flips})` | Pip faces, plus a roll made of a transform tumble and a few face swaps. Returns a promise of the final value |
| `BGUI.setTV(on)`, `BGUI.isTV()` | Toggles `html[data-tv]` and D-pad navigation, and fires a `bgui:tv` event |
| `BGUI.reducedMotion()`, `BGUI.setReducedMotion(true\|false\|null)` | Reads or forces reduced motion |
| `BGUI.mount.seg(el, {options, value, onChange})`, `.stepper(el, {min, max, value, label, onChange})`, `.toggle(row, {checked, onChange})`, `.versions(el, {value, onChange})`, `.players(el, list, {turn, scroll})`, `.emblem(el, opts)`, `.orbs(host, {count})`, `.auto(scope)` | Builders and wiring. `data-bg-mount="seg\|stepper\|toggle\|versions\|emblem"` wires markup on load |
| `BGUI.icon(name, {cls, label})`, `BGUI.icon.names`, `BGUI.icon.seal(game)` | Inline SVG icons from `icons.js` |

Events on `document`: `bgui:sheet` (`{open, el, reason}`), `bgui:win` (`{open, el}`), `bgui:tv` (`{on}`), `bgui:effects` (`{level, motion}`).

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
| `skins.js` animated backgrounds (`#bgskin`, infinite `steps()` loops at 20 fps) | The static `body.bg-app` / `--scene` / `--felt`, plus `.bg-orbs` on hub and lobby pages. Step 4 retires the looping skins: continuous motion only through the BGUI effects ticker, beats only through `BGUI.ambient` |
| `sound.js` `#bgSndBtn` / `#bgSoundPanel` | Unchanged; sound.js owns them. Their ids have no hyphen, so they don't clash. Align the button with the top bar via `Sound.mountButton({top, right})`. BGUI's focus trap leaves that panel alone |

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

% of ONE core: OS CPU time of every Edge process, headless Edge with `--disable-gpu` (software compositing, so these are pessimistic upper bounds), 6 s windows with everything else held still, measured 2026-10-14 in a REAL window of each size (TV 1920x1080 @1x, phone 390x844 @2x) by `BG_audit/design/luxe-build/repair/perf2.js` through `.dev/run-one.ps1`. The core step's earlier TV figures were taken with 1920x1080 emulated inside a 390x844 window and read far too low; the review caught it. \* the review's real-window run of the same CSS glint (`luxe-review/run3.js`). \*\* core run, phone window. \*\*\* the same pulse stepped by a timer (A/B); the shipped CSS pulse was not re-measured in a TV window.

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

**Still over ~15 % on TV in software compositing** (open for the CEO): the win screen (38 %), the hero crossfade (26 % while crossfading every 1.5 s), tile focus moves (27 % at one move a second), the orbs (about 15 %) and the glint fired back to back (17 %, but it ships 1 s in 12 s). Per-process numbers show the cost sits in the compositor (GPU process), not in page script: at 1920x1080 every composited frame redraws its damaged area in software (the whole screen for falling confetti, the ray wheel's rotated 1000 px square), so the cost follows area x frames. The cheaper options left all change the look - a smaller turning wheel means shorter rays, fewer than about 16 updates a second shows steps - so they are not taken. A Fire TV composites on its GPU, where this work largely leaves the CPU, and "Reduce effects" is the switch for a slow device.

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
- **Step 4 (games adopt ui/):**
  - Swap each game's patterns using the table in section 5; setup pages on `.bg-app--scene`.
  - Wire `setTurn`, `ambient`, the toast placement and `BGUI.win` + `celebrate` with stat pills (turns, bumps, time).
  - Write contextual CTA labels ("Start Uno · 5 players") and move-sheet detail lines with real data.
  - Add a "Reduce effects" row to each game's settings (`BGUI.effects.set`).
  - Retire the looping `skins.js` backgrounds.
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
