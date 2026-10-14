# Board Games UI: the shared "Tabletop" design system

This folder is the shared look for all seven games, the hub and Party Mode. It's a deluxe wooden box set: a walnut table, cream card stock, baize felt, brass fittings and enamel colour.

- Plain CSS and JS, with no build step and no CDN.
- Every class starts with `bg-`, and the only global is `window.BGUI`, so it sits next to each game's own CSS without clashes.
- Open `ui/styleguide.html` to see every token and component. Add `?tv=1` for the TV layout and `?motion=reduce` for reduced motion.

| File | What it is |
|---|---|
| `theme.css` | All tokens (custom properties), `@font-face`, the per-game `[data-game]` themes, TV scale (`html[data-tv]`), reduced motion and every `bg-` component |
| `ui.js` | `window.BGUI` helpers: toast, sheet, celebrate, flip, tweenNumber, countdown, ambient, setTurn, focus (D-pad), dice, setTV, haptic, mount.* |
| `icons.js` | `BGUI.icon(name)`: 39 original line icons as inline SVG (no `<text>`, no filters). Optional, but load it before `ui.js` if you want icons in helpers (stepper +/-, toast icons, CPU badge) |
| `fonts/` | Fraunces (display, 62.4 KB) and Figtree (UI, 20.2 KB), both variable WOFF2, Latin subset, SIL OFL 1.1 (`OFL-*.txt`). Total 82.5 KB |
| `tex/` | Grain tiles pre-rendered once from the Tabletop feTurbulence textures: walnut, oak, felt and paper WebP, 114 KB total. No SVG filter ever runs at runtime |
| `styleguide.html` | The living style guide: phone, TV, all 8 accents and all 10 seats, plus a button for every helper |

## 1. Adopting it in a game (step 4)

Put these in `<head>`. The paths assume a game folder such as `trouble/index.html`. The hub uses `ui/...`.

```html
<script>/* TV before first paint: ?tv=1 or the Fire TV bridge */
if (/[?&]tv=1(&|$)/.test(location.search) || window.AndroidTV) document.documentElement.setAttribute("data-tv", "");</script>
<link rel="stylesheet" href="../ui/theme.css">
<script src="../ui/icons.js" defer></script>
<script src="../ui/ui.js" defer></script>
```

Then set three attributes:

```html
<html lang="en" data-game="trouble">
<body class="bg-app">
<body class="bg-app bg-app--felt">
```

- `data-game` on `<html>` themes the whole page with that game's accent and felt.
- `class="bg-app"` on `<body>` is opt-in. It paints the walnut table once, on a fixed layer, and sets the fonts.
- `bg-app--felt` uses the game's felt as the table instead of walnut.

**Attributes**

- **`data-game`**: `trouble | sorry | monopoly | rummy500 | risk | uno | scatter | party`.
  - It works on any element, not just `<html>`. A hub tile with `data-game="uno"` is themed as Uno.
  - It sets `--accent`, `--accent-deep`, `--accent-bright`, `--accent-ink` (text on the accent), `--accent-text` (the accent as readable text on dark wood or felt), `--accent-glow`, `--felt`, `--felt-deep` and `--felt-lite`.
  - With no `data-game` you get the house accent: brass.
- **`data-tv`** on `<html>` turns on the 10-foot TV layout.
  - Sizing: 1rem = min(1/80 of the width, 1/45 of the height). That is 24px at 1920x1080, 16px at 1280x720 and 12px in a 960x540 Fire TV WebView, so the layout is identical at every size.
  - The type scale is lifted so nothing renders under 21px at 1080p, and targets are 3rem (72px at 1080p).
  - `ui.js` sets `data-tv` by itself for `?tv=1` and for `window.AndroidTV`, and turns on D-pad navigation. The inline head script above only avoids a first-paint flash.
  - There is deliberately no media-query fallback, because any rule that catches a 960x540 WebView also catches landscape phones.
- **`data-seat="1".."10"`** on any element sets `--seat`, `--seat-hi`, `--seat-lo`, `--seat-ink` (text on the piece) and `--seat-text` (the seat colour as readable text on wood).
  - Seats: 1 red, 2 blue, 3 green, 4 yellow, 5 purple, 6 teal, 7 orange, 8 pink, 9 pewter, 10 walnut.
- **`data-motion="reduce"`** on `<html>` forces reduced motion, for example from an in-game setting. The OS setting is always honoured as well.
- **`data-focus`** marks a non-button element as a D-pad stop. Use `data-focus="off"` to skip an element and `data-focus-first` to choose where D-pad focus starts.
- **`data-toast-avoid`** tells toasts to stay clear of an element, such as a sticky action bar or a player strip.

## 2. Class reference

| Class | Use |
|---|---|
| `.bg-app`, `.bg-app--felt` | Body: walnut or felt table on a fixed layer, plus fonts and colour |
| `.bg-surface--wood / --felt / --paper / --parchment / --oak` | Element backgrounds made of a grain tile plus a gradient. Text colour is set for you. Oak is for rails and frames: use walnut-950 text only |
| `.bg-display`, `.bg-h1/h2/h3`, `.bg-eyebrow`, `.bg-muted`, `.bg-faint`, `.bg-num`, `.bg-section`, `.bg-rule`, `.bg-sr` | Type helpers. `.bg-section` is a brass eyebrow followed by a hairline. `.bg-sr` is screen-reader-only text |
| `.bg-btn` with `--primary`, `--secondary`, `--ghost`, `--danger`, `--icon` (round knob), `--paper` (with `--icon`, on paper), `--sm`, `--lg`, `--block` | Buttons. Primary is enamel in `--accent` with a brass bezel. Press feedback is transform only. `--sm` shrinks the label, never the 44px target |
| `.bg-btn--cta` with `.bg-btn__label` and `.bg-btn__sub` | Start button with a confirming sub-label ("Start game / 5 players · Classic") |
| `.bg-topbar` with `__start`, `__title` (`.bg-eyebrow` + `.bg-topbar__name`), `__end` | Sticky walnut bar |
| `.bg-card`, `.bg-inlay`, `.bg-plaque` | Card-stock panel, a recessed panel routed into the wood, and a brass nameplate |
| `.bg-versions` > `.bg-version[data-value][aria-checked]` with `__art`, `__title`, `__meta`, `__desc` | Version / option cards. Selected cards get an accent ring and an enamel check seal. Wire with `BGUI.mount.versions` |
| `.bg-seg` (`--text`, `--grid5`) > `button[aria-pressed]` (or `.is-on` / `.on`) with an optional `<small>` | Segmented picker. Selected shows ivory card stock with a dot in the game colour. Wire with `BGUI.mount.seg` |
| `.bg-stepper` with `__btn`, `__val`, and `.bg-pips > i.is-on` | CPU stepper (- [3] +) with a pip row. Use `BGUI.mount.stepper` to build it |
| `.bg-rows` > `.bg-row` (`label` with `input.bg-toggle`, or `button[role=switch][aria-checked]` with `span.bg-toggle`), `__main`, `__title`, `__desc`, `.bg-row--static` | Whole-row rule toggles (60px). The row is the target, not the switch |
| `.bg-select` | Native select, 44px |
| `.bg-tag--official / --house / --accent / --paper / --new / --ok` | Tags. Fills are opaque, so they stay legible on artwork |
| `.bg-chip` (+ `.bg-chip__dot`, `[data-seat]`), `.bg-badge` | Info chips and count badges |
| `.bg-stats` > `.bg-stat` (`<b>38</b><span>turns</span>`) | Stat pills for win screens and summaries |
| `.bg-players` (`--scroll` for 5-10 players) > `.bg-player[data-seat]` with `.bg-token`, `__txt`, `__name`, `__meta`, `__cpu`, `.is-turn`, `.is-out` | Player strip. The default is a wrapping grid (2-up on a phone). Names and meta get an ellipsis. On the turn chip the meta text is cream with a seat-colour dot, so colour never carries the text. `BGUI.mount.players` and `BGUI.setTurn` drive it |
| `.bg-token[data-seat]` | Top-down game piece. Its label sits on a flat cap in `--seat-ink` |
| `.bg-scorepad` > `table.bg-score` with `tr.is-lead`, `.bg-score__who[data-seat]`, `.bg-score__total` | Scoreboard on a ruled score-pad page |
| `.bg-sheet` with `__grip`, `__head`, `__title`, `__sub`, `__options` > `button.bg-sheet__option` (`.bg-token`, `.bg-sheet__text` > `__label` + `__desc` + `__detail`, then a chevron), `.is-best` | Bottom sheet. Each choice has a plain-English line and a concrete detail line ("space 22 → 28"). Open and close it with `BGUI.sheet` |
| `.bg-toast` | Created by `BGUI.toast()`. Don't place it by hand |
| `.bg-win.is-open` > `.bg-win__scrim`, `.bg-win__rays`, `.bg-win__card` > `.bg-win__medal`, `.bg-eyebrow`, `.bg-win__title`, `.bg-win__sub`, `.bg-stats.bg-win__stats`, `.bg-win__actions` | Win overlay. The card is centred vertically, the rays bloom once and the medal is pure CSS. Call `BGUI.celebrate()` after adding `.is-open` |
| `.bg-tiles` > `.bg-tile[data-game]` with `__art` (+ `.bg-tile__badge` player count), `__label`, `__name`, `__meta`, `__seal`, `.bg-tile--party` | Hub / TV game tile. Tiles are 2 across on a phone and 4 across on TV |
| `.bg-emblem` (`.is-glint`) | Brass emblem with a one-shot glint. Register it with `BGUI.ambient.add(el)` |
| `.bg-die` (`--seat`) | Ivory die: `BGUI.dice.render/roll` |
| `.bg-countdown` | Ring timer: `BGUI.countdown(el, s)` |
| `.bg-hintbar` with `.bg-key` | TV remote legend |
| `.bg-focus`, `.bg-focus-room` | Gives any element the shared focus ring and TV lift. `.bg-focus-room` pads a container so rings are never clipped |

Focus ring: every `bg-` control gets the same ring on `:focus-visible`, and also on `.is-focus`, which `BGUI.focus` sets for the D-pad and for old WebViews. The ring is a dark gap, then an ivory `#fff3d1` ring, then a soft glow. On TV, buttons, tiles and version cards also scale to 1.045. The ring swaps instantly and never transitions.

## 3. `window.BGUI`

Every call is safe if its element is missing: it returns `null`, `false` or a resolved promise.

| Call | Does |
|---|---|
| `BGUI.haptic("tap"\|"select"\|"turn"\|"success"\|"warn"\|"error"\|"roll"\|ms\|[pattern])` | Guarded `navigator.vibrate` that returns a boolean. Turn it off with `BGUI.haptic.enabled = false` |
| `BGUI.toast(msg, {ms, seat, token, icon, html, place: "auto"\|"top"\|"bottom", haptic})` | One shared toast. Its position is computed from the layout: above an open sheet or `[data-toast-avoid]` elements, below the top bar. `BGUI.toast.hide()` |
| `BGUI.sheet.open(el, {onClose, dismissible, focus})`, `.close(el?)`, `.isOpen(el?)`, `.top()` | Bottom sheet with a scrim. It traps focus (Tab and D-pad), closes on Back/Escape/scrim and restores focus to the opener. Nested sheets stack |
| `BGUI.celebrate({ms, colors, count, origin, rays, into})` | One-shot canvas confetti plus a ray bloom, about 2.8 s. The canvas is removed afterwards and the call returns a promise. It does nothing under reduced motion or when the tab is hidden. Inside an open `.bg-win` it draws behind the card |
| `BGUI.flip(el, fromRectOrEl, {ms, spring})` | FLIP move: read the rect, move the DOM, then call `flip`. Uses transform only |
| `BGUI.tweenNumber(el, from, to, ms, {format})` | Counts cash, scores and similar values |
| `BGUI.countdown(el, seconds, {low, onTick, onDone})` | Ring timer that updates 4 times a second, not as a continuous animation. Returns `{stop, pause, resume, remaining(), done}` |
| `BGUI.ambient.add(el, {cls, ms, delay})`, `.remove(el)`, `.trigger(el, {cls, ms})`, `.pause()`, `.resume()`, `.state()`, `.every` | The ONE scheduler for decorative beats. One beat at a time, a periodic beat every 14 s, paused while hidden or under reduced motion. With nothing registered no timer runs |
| `BGUI.setTurn(playerEl, {pulse, haptic})` | Moves the static turn ring and asks `ambient` for 3 pulses. Call it every turn |
| `BGUI.focus.enable({root, autofocus})`, `.disable()`, `.move(dir)`, `.set(el)`, `.first(scope)`, `.candidates()`, `.enabled` | D-pad spatial navigation over `[data-focus]` and focusable elements. Same-row/column moves win, Enter/OK clicks, focus is scrolled into view, and it never leaves an open sheet or win overlay. It is on automatically in TV mode |
| `BGUI.dice.svg(n)`, `.render(el, n)`, `.roll(el, final?, {ms, flips})` | Pip faces, plus a roll made of a transform tumble and a few face swaps. Returns a promise of the final value |
| `BGUI.setTV(on)`, `BGUI.isTV()` | Toggles `html[data-tv]` and D-pad navigation, and fires a `bgui:tv` event |
| `BGUI.reducedMotion()`, `BGUI.setReducedMotion(true\|false\|null)` | Reads or forces reduced motion |
| `BGUI.mount.seg(el, {options, value, onChange})`, `.stepper(el, {min, max, value, label, onChange})`, `.toggle(row, {checked, onChange})`, `.versions(el, {value, onChange})`, `.players(el, list, {turn, scroll})`, `.auto(scope)` | Builders and wiring. Each returns `{el, value/checked, set(v, silent)}`. `data-bg-mount="seg\|stepper\|toggle\|versions"` wires markup on load |
| `BGUI.icon(name, {cls, label})`, `BGUI.icon.names`, `BGUI.icon.seal(game)` | Inline SVG icons from `icons.js` |

Events: `bgui:sheet` (`{open, el, reason}`) and `bgui:tv` (`{on}`), both dispatched on `document`.

## 4. Old pattern in the games -> new `bg-` class

| Old pattern (where) | New |
|---|---|
| `.btn` (all 7) | `.bg-btn.bg-btn--secondary` on wood, `.bg-btn--ghost` for low-emphasis actions |
| `.btn.primary`, Monopoly `.btn.go` | `.bg-btn.bg-btn--primary`. The main Start becomes `.bg-btn--cta` with a sub-label |
| Monopoly `.btn.warn` | `.bg-btn--danger` |
| `.btn[disabled]` | Same attribute; the styling is built in |
| `.homebtn` fixed top-left Home link (Trouble, Sorry!, Monopoly), `.menuRow` + `#menuBtn` "☰ Menu" (Rummy, Risk, Uno, Scatter) | A `.bg-topbar` with `a.bg-btn.bg-btn--icon` (`BGUI.icon("back")` or `"home"`) in `__start` and the menu knob (`"menu"`) in `__end` |
| Setup `.overlay#setup > .card` (Trouble, Sorry!), `.overlay > .modal` (Monopoly), `.overlay.show > .sheet` (Rummy, Risk, Uno, Scatter) | Setup becomes a page on `body.bg-app`, using `.bg-section` headings, `.bg-card` / `.bg-rows` blocks and a `.bg-btn--cta` dock. Mid-game dialogs become `.bg-sheet` through `BGUI.sheet.open()` instead of toggling `.show` |
| `.sheet h3`, `.modal h3`, `.card h2` | `.bg-section > .bg-eyebrow` (section label), `.bg-h2` / `.bg-sheet__title` |
| `.vers > .ver(.on)` with `b` / `i` / `p` (Rummy, Risk, Uno, Scatter) | `.bg-versions > .bg-version[aria-checked]` with `__title`, `__meta`, `__desc` (`BGUI.mount.versions`) |
| `.seg > button.on` (all 7) | `.bg-seg > button[aria-pressed]`. `.on` still works during the move. Use `BGUI.mount.seg` |
| Computer-player `.seg` of 0-9 buttons | `.bg-stepper` (`BGUI.mount.stepper`) |
| Monopoly token picker `.tokgrid > .tokbtn` | `.bg-seg.bg-seg--grid5 > button[aria-pressed]` with a `.bg-token` inside |
| `.row` with a `<span>` label and `input[type=checkbox]` (Uno, Rummy, Risk, Scatter), Monopoly `.sw(.on)` switch div | `label.bg-row` + `input.bg-toggle`, or `button.bg-row[role=switch]` + `span.bg-toggle`. The whole row is the 60px target |
| `.row select` | `.bg-row.bg-row--static` + `select.bg-select` |
| `.tag.off` (Official, blue), `.tag.house` (purple) | `.bg-tag--official`, `.bg-tag--house` |
| Monopoly `.badge.on` / `.badge.off` | The toggle shows on/off. Use `.bg-tag--official` / `.bg-tag--house` for where a rule comes from |
| `.toast` / `#toast` with `.show`, hand-placed `bottom: ...px` | `BGUI.toast(msg, {seat, icon})`. Mark sticky bars `data-toast-avoid` |
| Player status: Trouble/Sorry! `.status` + `.dot` + `.legend`, Monopoly `.status .pill .dot`, Rummy/Scatter `.chip`, Risk `.cchips > .cchip`, Uno/Rummy `.sc` rows | `.bg-players > .bg-player[data-seat]` (`BGUI.mount.players`), plus `BGUI.setTurn(chip)` every turn |
| Round and score tables (Uno `#roundSheet`, Rummy `.sc` / `.pc`) | `.bg-scorepad > table.bg-score` (`tr.is-lead`, `.bg-score__who[data-seat]`, `.bg-score__total`) |
| Win / game over (Uno "🏆 Game over" in `#roundBox`, and the others' `.overlay` cards) | `.bg-win.is-open` with medal, title, sub, `.bg-stats` (turns · bumps · time) and actions, then `BGUI.celebrate()`. Drop the emoji |
| Pass-the-phone `#handoff .sheet` | `.bg-sheet` with `dismissible: false`, or a full-screen `.bg-card` |
| Monopoly `.dice .die`, Trouble/Sorry! roll results | `.bg-die` + `BGUI.dice.roll(el, value)`. Board-specific art such as the pop dome stays in the game |
| Monopoly `.stickyact` | A sheet footer row of `.bg-btn--block` buttons, marked `data-toast-avoid` |
| `.sub`, `.hint`, `.legend` text | `.bg-muted` / `.bg-faint`. On TV the remote legend is a `.bg-hintbar` |
| `skins.js` animated backgrounds (`#bgskin`, infinite `steps()` loops at 20 fps) | The static `body.bg-app` / `.bg-app--felt`. Step 4 must retire or freeze the looping skins: ambient motion only through `BGUI.ambient` |
| `sound.js` `#bgSndBtn` / `#bgSoundPanel` | Unchanged; sound.js owns them. Their ids have no hyphen, so they don't clash. Align the button with the top bar via `Sound.mountButton({top, right})`. BGUI's focus trap leaves that panel alone |

## 5. Do and don't

**Do**
- Theme with `data-game`. Use `--accent-text` for accent-coloured text on wood or felt, and `--accent-deep` for accent text or icons on paper. Use `--seat-ink` on a seat colour and `--seat-text` for seat-coloured text on wood.
- Keep text tokens: `--fs-micro` through `--fs-5xl`. Never hard-code a px or rem font size below `--fs-micro`, or the 21px TV floor breaks.
- Keep every target at least `var(--tap)`, and make whole rows the target.
- Put the concrete outcome under each move choice (`.bg-sheet__detail`) and the confirmed setup under the Start button (`.bg-btn__sub`).
- Call `BGUI.setTurn()` each turn and `BGUI.ambient.add()` for any emblem. Leave the scheduling to BGUI.
- Give containers of focusables room for the ring (`.bg-focus-room` or `padding: var(--focus-room)`), and never `overflow: hidden` right around them.
- Re-run `BG_audit/design/build/contrast.js` after changing any colour token.

**Don't**
- No `color-mix()`, `backdrop-filter`, CSS `filter`, or SVG filters (feGaussianBlur, feTurbulence) in shipped CSS or art. Fake glows and shadows with gradients.
- Don't transition `box-shadow`, `filter`, `background` or layout properties. Only `transform` and `opacity` move.
- Don't loop animations (`infinite`), and don't spin large layers. One-shot beats only, through `BGUI.ambient`.
- Don't put the seat colour on text over wood. Use cream text with a seat dot (`.bg-player.is-turn` already does this).
- Don't put `url()` inside custom properties. The texture URLs live in theme.css so they resolve next to it.
- Don't add globals. Extend `BGUI` here instead of copying helpers into games.

## 6. Performance rules (measured)

`BG_audit/design/build/verify.js` measures the idle style guide in headless Edge with `--disable-gpu` (software compositing, so these are pessimistic upper bounds). The figure is the CPU of every Edge process, as % of ONE core, at 390x844 over ~13 s windows:

| Case | % of one core |
|---|---|
| Ambient on, while the turn pulse and the glint fire | 1.4 |
| Ambient on, next window (steady, one glint) | 3.8 |
| Stress: a beat every 3 s | 4.7 |
| Reduced-motion control (no beats) | 0.5 |

So the beats cost about 3 % of a core at worst, against the 10 % budget, with 0 ms layout and at most a few ms of script.

The rules behind those numbers:
- Nothing animates between beats.
- The table is painted once, on a fixed layer.
- `celebrate()` runs a 1x canvas for about 2.8 s, then removes it.
- `countdown()` repaints a small SVG 4 times a second.
- `prefers-reduced-motion` (or `data-motion="reduce"`) sets every duration to 0 and stops beats and confetti.

## 7. Service-worker caching (publish step)

Each game's `sw.js` must list the ui files in `ASSETS` and bump `VERSION`:

```js
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.png", "../sound.js", "../skins.js", "../saves.js",
  "../ui/theme.css", "../ui/ui.js", "../ui/icons.js",
  "../ui/fonts/fraunces-var-latin.woff2", "../ui/fonts/figtree-var-latin.woff2",
  "../ui/tex/walnut.webp", "../ui/tex/felt.webp", "../ui/tex/paper.webp", "../ui/tex/oak.webp"];
```

The hub's `sw.js` needs the same files with `ui/...` paths. Every game shares one origin and the caches are per game, so each game must cache its own copy for offline play. `styleguide.html`, `README.md` and the OFL texts don't need caching.

## 8. What belongs to later steps

- **Step 4 (games adopt ui/):**
  - Swap each game's patterns using the table above.
  - Wire `setTurn`, `ambient` and the toast placement.
  - Write contextual CTA labels ("Start Uno · 5 players") and move-sheet detail lines with real data.
  - Retire the looping `skins.js` backgrounds.
  - Add the ui files to every `sw.js`.
- **Step 5 (play surfaces):**
  - The six missing in-game boards and tables: Sorry! track, Monopoly board with money and deeds, Rummy felt with meld rows, Uno table, Scattergories pad with letter die and timer.
  - The Risk world map.
  - All of them filter-free, as static rasters with pieces on transform-animated layers.
  - Move-sheet detail lines for every game's choices.
- **Step 6 (Party Mode):** lobby seat status pills (HOST / READY / JOINING / CPU), a real runtime QR code placed next to the letter-tile room code, and the lobby copy ("Jules can take a seat next game").
- **Step 7 (hub):**
  - The TV hub poster hero: focused game art as a masked backdrop with title, pitch, chips and Host / Resume / Rules, cross-faded on opacity.
  - The real tile art, player-count badges on every tile (`.bg-tile__badge` is ready) and the continue card.
- **Step 8 (Android / Fire TV):** icon and banner placement: launcher PNGs, the 320x180 banner, the five missing game icons, and SVG text outlined to paths.
