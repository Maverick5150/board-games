# Motocross War 3D — CONTRACT

Who owns which file, what every module exposes, where each specialist plugs into `race3d.js`, what data the view hands every frame, and how to capture, prove and measure a change (section 9).
Written by the file-split step (branch `mxvis-split`) and finished by the BASE step (2026-10-17, about 14:30), which joined the split and the capture harness into the branch `mxvis` with a linear history:
`7dec470` (build B as the judges saw it) -> the split -> the harness (two commits) -> the base commit on top (`git log --oneline mxvis`). Neither step changed a pixel: the six bookmark frames at 1280x720 and 1920x1080
drawn on the laptop's GPU are identical to the BEFORE set (0 differing pixels, 12 of 12), and the split's 84 software-GL frames over 10 scenarios are identical before the split, after it, and on the joined branch (section 9.8).

THE INTEGRATION STEP (2026-10-17, from 18:18, label `integrate:merge`) put the eight specialists' branches (perf, lead, dirt, stadium, bike, rider, fx, cams) onto `mxvis` in that order, as 49 cherry-picked commits (LINEAR history, no merge commit), and made them work together: section 12 says what merged, the one conflict, the requests applied or skipped, the tests and what is still broken. The module blocks of section 3 below describe the INTEGRATED build.

MILESTONE 2 (2026-10-18, label `integrate:m2-merge`): the specialists built milestone 2 on nine branches `mxvis2-<role>` from `42bb9f4` (milestone 1), with a new role, **motion** (the race's movement, in its own `race3d.js` zones). Eight of them (perf, lead, motion, dirt, stadium, rider, fx, cams: 69 commits) were cherry-picked onto `mxvis` in that order (LINEAR, no merge commit, no conflict); **bike was still building and is NOT in this build**. The integration commit then applied the reports' requests that the pieces need to work together. Section 15 is the lead's milestone 2 chain, section 16 the merge (what merged, the requests applied or skipped and why, the tests, what is still broken); every module block of section 3 carries a **Milestone 2** note.

The race renderer is three.js r160 (`ui/vendor/three-0.160.0.module.min.js`, ES modules, WebGL2). The race view is only these files:
`race3d.js` and `r3d-*.js` in this folder. `game.js` creates it (`create(host, hooks)`) and talks to it through `V.*` (header of `race3d.js`).
Nothing in this contract changes how `game.js`, the engine (`race.js`, `round.js`, `season.js`), `course.js` or `layouts.js` work.

## 1. Rules for every specialist

- OWN WORKTREE: `git -C "C:/Users/Maverick/Documents/BG_mxV" worktree add "C:/Users/Maverick/Documents/BG_mxV-<role>" -b mxvis-<role> mxvis` (or reuse it). `mxvis` already holds the split, the harness and the
  base: never start from another branch. Work and commit only there. Never push, never touch tags, never edit the main repo or the other `BG_*` folders.
- EDIT ONLY YOUR FILES (section 2). In `race3d.js` edit only between the lines `// [hook:<your role>]` and `// [/hook:<your role>]`. Nothing
  else in `race3d.js`, and no other module. New files: `r3d-<role>-*.js` or `mxwar/assets/<role>/...`; list a new `.js`, a new asset or an import from `ui/vendor/three-addons/` in `sw.js` ASSETS only
  through a REQUEST (`sw.js` belongs to the lead, applied by the integrator step).
- NEED SOMETHING IN A FILE YOU DO NOT OWN? Work around it, and write it under REQUESTS in your report (file, what, why). The integrator applies it.
- HOOK ZONES ARE YOURS ALONE: two specialists never edit the same lines, so the branches merge without conflicts. A zone may be empty (only
  comments): add your lines between its markers. The `harness` zones are frozen: nobody edits them.
- ART: original art and code only. CC0 textures from ambientCG / Poly Haven are allowed (1K, converted to JPG / WebP, small); record each in
  `mxwar/assets/LICENSES.md` under your role (name, URL, CC0). Never: photos of people, crowds, brands or real venues, logos, sponsor marks,
  real liveries, third-party models, rider names or numbers as anything but plain text, makes as anything but team colours. Everything vendored,
  nothing loaded from a CDN at run time.
- VENDORED ADD-ONS: `ui/vendor/three-addons/` holds 56 three.js add-ons (section 3). Need another one? REQUEST it: do not download or vendor it yourself (two branches adding to that folder collide in its README.txt).
- CPU: the 4-core laptop is shared (at most 90% sustained). Every browser run or long script goes through the runner (section 9.3 has `run()`):
  `powershell -NoProfile -ExecutionPolicy Bypass -File "C:/Users/Maverick/Documents/Board Games/.dev/run-one.ps1" -Cmd 'node "C:/full/path/script.js"' -TimeoutSec 300`
  One browser per script, at most 3 pages, `await b.close()` in `finally`, never in the background, never a sub-agent.
- EVIDENCE: judge your work only by captures from the running view (section 9: the same race, riders, seed, clock and cameras, so a
  before / after pair differs only by your change). Look at every capture next to the cover. Never call something finished that you have not
  seen working. Report failures and limits with numbers.
- DONE MEANS: lint clean; `shots.js` + `pixeldiff.js` + the pictures LOOKED AT next to the cover; `finish.js` passes (the whole race, no console error); numbers from `perf.js` against the base's rows; the report says what is still short of the cover.
- PRESERVE THE GAME (section 8). Reduce effects, reduced motion, the no-WebGL fallback, paused while hidden: all keep working.
- TIME: about 2 hours. Commit working steps early; a tested, committed improvement beats an unfinished big one.

## 2. Ownership

| Role | The CEO's title | Files | Hook zones in `race3d.js` | What it is |
|---|---|---|---|---|
| lead | Lead Graphics Engineer (the integrator step after the builders applies every REQUEST in these files) | `race3d.js` (everything outside the zones), `r3d-util.js`, `r3d-look.js`, `r3d-lead-post.js`, `r3d-lead-env.js`, `CONTRACT.md`, `sw.js` | none (it is the rest of the file) | the view: `create()`, the race state machine, rider motion and the cards sync, the crash scripts, the frame loop; shared helpers; renderer settings, light rig, fog, the post-processing slot and the frame's counters |
| dirt | Environment Artist (the ground) | `r3d-track.js`, `r3d-dirt-relief.js`, `r3d-dirt-png.js`, `mxwar/assets/dirt/` | `dirt` | the track SURFACE: soil, dirt maps, the track ribbon (berms, jump faces, whoops, sand, the start path), its material, the lane-edge blocks |
| stadium | Environment Artist (the stadium) | `r3d-world.js`, `r3d-stadium-bowl.js`, `r3d-stadium-art.js`, `mxwar/assets/stadium/` | `stadium` | everything round the track: stands, crowd, suites, walls, light rigs and glow, the big screen, sky, start gate, finish line, flaggers and flags, outdoor terrain, trees, paddock, speedway infield; `buildWorld()` |
| bike | Vehicle / Rider Specialist (the machine) | `r3d-bike.js`, `r3d-bike-model.js`, `mxwar/assets/bike/` | `bike` | the motorcycle: `BIKE` constants, part geometries, materials, instanced meshes, plates, the bike's pose |
| rider | Vehicle / Rider Specialist (the rider) | `r3d-riders.js`, `r3d-rider-model.js`, `r3d-rider-pose.js`, `mxwar/assets/rider/` | `rider` | the rider: geometry, two-bone IK, poses (seated, standing, dab, crash body), the number atlas, blob shadows, number tags, the instancing glue |
| fx | Effects Specialist | `r3d-fx.js`, `mxwar/assets/fx/` | `fx` | roost, dust, impacts: the particle system and when / how much to emit |
| cams | Cinematic Camera Specialist | `r3d-cams.js` | `cams` | the TV director, every camera rig, the sight tests, the camera itself |
| motion | Motion Specialist (milestone 2) | none of its own: its zones in `race3d.js` | `motion` (15 zones: `setRace`'s rider records and `gridBuild()`; the helpers `gridBuild` / `gridLat` / `gridBack` / `rightOf` / `passLine` / `SEP` (`sideOf` is unused); `V.gate`'s reset; the line in `V.lap` that stores the cards' order `r.cr`; `step()`'s positions / setbacks / lateral lines; `rider()`'s speed lines (`r.rem`, `r.vi`), the `jumpArc()` calls, `r.rem = false`, the heading / lean block, `st.th`, the blob shadow's heading and `r.th`; `ride()`, `JLIM` / `arcY` / `jumpArc`; `axle()`'s spring; `crashPose`'s lift settle and `tmpCW`) | how the race MOVES: the start grid, pack spacing (setbacks), the passing solver, the lateral line, the bike's heading along its path, each rider's own jump arc, the shock, the remount from where the bike lies (the order, the lap times and the standings stay the engine's) |
| perf | Performance Engineer | `r3d-quality.js`, `r3d-perf-bench.js`, `r3d-perf-warm.js` (milestone 2), `mxwar/assets/perf/` | `perf` | the quality tiers and their flags, the adaptive-resolution ladder, GPU classification and probe, reduce-effects and TV flags, the options every builder receives, `V.qualityNames()` / `V.setQuality()`, the riders' level-of-detail and texture-budget helpers, the in-game benchmark (`?bench=1`) |
| qa | Quality Director | no code | none | runs section 9.3 steps 2-5 on each specialist's branch, compares the real captures with the cover, rejects what the pictures do not support |
| base | the studio (done; frozen) | `mxwar/demo.html`, `demo.js`, `demo-engine.js`, `demo-bookmarks.json`, `ui/vendor/three-addons/`, `mxwar/assets/LICENSES.md` ("base" section), the tools in `BG_audit/sprint/mxvis/tools/` | `harness` (two frozen zones) | the capture harness, the vendored add-ons; the integrator adds an add-on or a tool option on REQUEST |

Not part of the view, nobody edits them in this phase (the integrator does, at the game-integration step): `game.js`, `index.html`, `course.js`,
`layouts.js`, `race.js`, `round.js`, `season.js`, `brain.js`, `art.js`, `track.js` (the 2D track), `data/`.

### Dependencies (no cycles)

```
r3d-util.js        <- everything (three.js only)
r3d-quality.js     <- util, perf-bench, perf-warm   (r3d-perf-bench.js and r3d-perf-warm.js import nothing of ours: the quality object, the view and the renderer are passed in)
r3d-look.js        <- util, lead-env, lead-post (+ three-addons SMAAPass / Pass / SMAAShader)
r3d-lead-env.js    <- util
r3d-lead-post.js   <- (three.js only)
r3d-dirt-png.js    <- (nothing)
r3d-dirt-relief.js <- (nothing: pure maths)
r3d-track.js       <- util, dirt-png, dirt-relief, assets/dirt/dirt-tiles(-lo).js
r3d-stadium-art.js <- util
r3d-stadium-bowl.js<- util, track, stadium-art
r3d-world.js       <- util, track, stadium-bowl
r3d-bike-model.js  <- util
r3d-bike.js        <- util, bike-model
r3d-rider-model.js <- util
r3d-rider-pose.js  <- rider-model, bike  (BIKE.GRIP / PEG / SEAT / KNEE, steerOf, steerXYZ)
r3d-fx.js          <- util, quality (isTV / motionMode)
r3d-riders.js      <- util, bike, rider-model, rider-pose  (re-exports BIKE; emit / stepParticles from fx)
r3d-cams.js        <- util, quality (motionMode only)
race3d.js          <- all of the above
```

Course data: modules read the built course `C` (`course.js`: `C.x/z/y/hw/k/bank/F/sand/rough` per sample, `C.ds`, `C.N`, `C.L`, `C.S` the
start path, `C.kind` = "stadium" | "outdoor" | "hybrid", `C.feats`, `C.layout.floor`) and the layout `look` (`look.soil`, `look.around`, `look.bales`,
`look.night`) through `window.MXWar.Course` (a classic script loaded before the module).

## 3. Module APIs

Every name below is exported. Arguments in order; `->` is the return value.

### r3d-util.js (lead)

- `now()` -> ms clock. `clamp(x, a, b)`, `sstep(a, b, x)` smoothstep, `lin(hex)` -> linear `[r, g, b]`, `mixc(a, b, t)`.
- Seeded noise: `hash2(x, z)`, `vnoise(x, z)`, `fbm(x, z, octaves = 4)`; tiling `hashp`, `pnoise(x, z, period)`, `pfbm(x, z, period, octaves)`; `rngf(seed)` -> a function returning 0..1.
- Textures: `canvas(w, h)`, `tex(canvas, repeat)` -> sRGB CanvasTexture (anisotropy set), `normalTex(heights, W, strength)` -> tangent normal map from a W x W height array,
  `setAniso(n)` / `getAniso()` (1..16; `r3d-quality.js` sets it from the tier: 1 / 4 / 8 / 16).
- Geometry: `merge(list)` -> one non-indexed BufferGeometry (position, normal, color, uv); `paint(g, [r, g, b])` vertex colours; `xf(g, x, y, z, rx, ry, rz, sx, sy, sz)` transform;
  `bone(mesh, i, a, b, thick, fw)` places instance `i` of an instanced unit-length +Y limb mesh between points `a` and `b` (the limb never spins about its axis: local +X toward `fw`).
- Course queries (pure): `clear(C, x, z, margin)` -> true if (x, z) is off every part of the track; `clearDist(C, x, z)` -> distance to the nearest track edge (negative on it).
- **Milestone 2 merge: THE NEAR-LENS KEEP.** `MX_KEEP` = `{value: Vector4}` (the chase subject's hip x, y, z and a radius; w = 0: nobody) and three GLSL strings: `KEEP_VS_DECL`, `KEEP_VS_SET` (after `<project_vertex>`: the world position as the varying `vMxW`, instanced or not) and `KEEP_FS_DECL` (`uniform vec4 uMxKeep`, `bool mxKept()`). The riders' and bikes' near-lens dither tests `z < 1.7 && !mxKept()`: the chased rider's own wheel, fender, body and plates are never dissolved (the cams' request). `race3d.js` copies `CAMS.keep` into it every frame after the camera, and w = 0 when the capture harness moved the camera.

### r3d-look.js (lead)

`createLook(renderer, {shadows}) -> L`: sets sRGB output, ACES filmic tone mapping, the PCF shadow map, the clear colour; makes the scene and the light rig.
`L.scene`, `L.hemi`, `L.sun`, `L.fill`, `L.amb`, `L.SUN` (the sun direction, a Vector3 updated per venue), `L.shadows` (are real shadows on), `L.shHalf`,
`L.setShadows(on)`, `L.apply(C, look, world)` (a new race: the venue's lights, exposure, sun disc, then the fog from `world.ctx.fogC`),
`L.fitShadow(cam, target)` (every frame while shadows are on: the shadow box follows the action, snapped to texels), `L.blobOp(x, y, z)` (0.42..1: how much blob
shadow to keep where the real shadows fall), `L.render(scene, cam)` (the frame), `L.resize(W, H, pr)`.
**Since the lead's rewrite (section 11 has everything): `createLook(renderer, {shadows, lo, tv, weak, host}) -> L`; the light rig is key / rim / kick / bounce / hemisphere / fill (`L.rim`, `L.kick`, `L.bounce`); `L.apply(C, look, world, {lo, tv})` also builds the environment map and picks the tier; `L.frame(cam, target, dt, tw, subjectDist)` (every frame, after the camera: the camera-relative lights, the depth of field's focus, the motion-blur matrices); `L.upgrade(root)` (physically based stand-ins for plain Phong parts), `L.receive(root)` (instanced body parts receive the key's shadow), `L.tier`, `L.setTier(name)`, `L.flags`, `L.setFlags({...})`, `L.tiers`, `L.info()`, `L.dispose()`; the stadium's glow gain `uHdr` follows the bloom flag.** **`L.post = null` is the post-processing slot**: set it to `{render(scene, cam), resize(W, H, pr)}` and every frame is drawn through it (bloom, depth of field, SMAA; the add-ons are in `ui/vendor/three-addons/`;
`tools/post-slot-check.js` builds an EffectComposer with RenderPass + UnrealBloomPass + OutputPass in the real view as a working template, and proves a resize reaches `post.resize`). With a chain on, tone mapping and the sRGB
conversion belong to the chain's OutputPass (three.js applies `renderer.toneMapping` only when it draws to the screen). **`L.render` owns the frame's counters**: it sets `renderer.info.autoReset = false` and resets once per frame, so
`renderer.info.render.calls / triangles` (= `V.stats().calls / tris`, the harness' `DEMO.stats()`) are the WHOLE frame: the shadow map pass + the scene + every pass of a chain. (three.js alone resets the counters inside every `renderer.render()`
right AFTER it drew the shadow map, so it never counts the shadow pass, and a chain would show only its last pass.) A chain must not touch `renderer.info`.
**Milestone 2 (lead, section 15):** the tier table also carries `half` (the depth of field, the camera motion blur and the contact shadows at half resolution), `ao` (contact shadows, only while the shot's subject is within 30 m: `P.setAo`), `fmt` (`"r11"`: an R11F_G11F_B10F scene target on BALANCED, where there is no motion blur), `envCap` (the environment map is the REAL stadium, captured once per world: `L.envRecapture()` for tests), `bikeCC` (a clear-coat stand-in made at run time from the bike's own material `mxbike-std`), `tvaa` / `tvGlow` (the TV tier's FXAA and glow in an 8-bit `ldr` chain: OFF on every tier, the perf engineer's 4x MSAA canvas is the TV's anti-aliasing; they can switch on only where the canvas has no MSAA, never with Reduce effects). The crumb mask: a scene pixel whose alpha is under 0.5 (the fx crumbs) is left out of the camera motion blur.

### r3d-quality.js (perf) and r3d-perf-bench.js (perf)

The quality system: one place that says how much any module may spend (tiers), how the frame rate is held (the ladder), how a device is classified (GPU string + probe) and how anybody measures (the benchmark). The flag table, the rules for builders and the measurements are in section 9.4.

- `TIERS` = `{firetv, balanced, high, ultra}` (labels FIRE TV, BALANCED, HIGH, ULTRA), `tierNames()`, `resolveTier(name)` (also the old harness names: `stick` and `low` = firetv, `medium` = balanced), `STEPS` = the render-scale ladder `[1, .9, .8, .75, .67, .6, .5]`.
- `isTV()`, `motionMode()` -> `"off"` | `"lo"` | `"full"`, `classifyGpu(str)` -> `{cls (-1 software, 0 weak, 1 mid, 2 strong, 3 big), family, string}`, `detectWeakGPU(renderer)`, `probeGpu(renderer)` -> `{ms}`.
- `createQuality({host, lo, setShadows(on), shadowsOn(), W(), H(), resized(W, H, pr), redraw()}) -> Q`. Makes the WebGLRenderer (`Q.renderer`; MSAA only when the tier says so), picks the tier (`?quality=` / `?tier=` (and `?q=` on the capture page) > a stored choice for this GPU > GPU class + probe),
  sets the anisotropy. Fields: `Q.tier` (the tier definition), `Q.tierName`, `Q.source` (`url` | `stored` | `gpu` | `probe` | `gpu+probe` | `manual` | `auto-demote`), `Q.gpu`, `Q.probe`, `Q.dev {tv, mobile, dpr, cores, mem}`, `Q.targetFps`,
  `Q.pr` / `Q.prCap` / `Q.fixed` / `Q.stats {prDrops, prRaises, sheds, reverts, shadowDrop, probeMs}` (as before), `Q.rung`, `Q.ladder`, `Q.events` (the ladder's log), `Q.lod`, `Q.bench`.
  - **`Q.options(LO) -> q`: what `buildWorld(C, look, q)`, `createRiders(list, q)` and `createFx({C, look, ...q})` receive.** `q.lo` (the simple world: true for FIRE TV or Reduce effects), `q.tier`, `q.rank`, `q.shadow`, `q.post`, `q.fog`, `q.fx`, `q.crowd`, `q.scenery`, `q.riders`, `q.tex`, `q.res`, `q.budget` (the tier's blocks, section 9.4),
    shortcuts `q.particles`, `q.texMax`, `q.aniso`, `q.crowdDetail`, `q.crowdAnim`, `q.trees`, `q.terrainDetail`, `q.riderLod`, `q.key`, and **`q.live`** (a reference to `Q.live`, below: read it every frame for anything that moves at run time). A field that changes what is BUILT is part of `Q.buildKey(LO)`, which is in the world's cache key (`setRace` zone): a tier switch rebuilds the world on the next `setRace`.
  - **`Q.live`**: the flags the ladder moves at run time, always current: `shadows` (real shadows wanted now), `shadowSize`, `particleScale` (0..1: multiply the emission by it), `crowdAnim`, `scale` (the render scale step), `pr`, `post {on, bloom, bloomScale, aa, dof, shafts}`. A post chain reads `QUAL.live.post` every frame; `Q.onChange(fn(what, info, live))` fires on `"rung"` and `"tier"`.
  - `Q.set(name, src)` (also `"auto"`), `Q.demote(why)`, `Q.summary()`, `Q.memory(scene)`, `Q.fitTextures(root)`, `Q.budgetCheck(calls, tris)`, `Q.resize(w, h, W, H, LO) -> pr`, `Q.adapt(dt, ms)` (every frame), `Q.fix(p, W, H)` (tests), `Q.save()`, `Q.bindLook(LOOK)`, `Q.attach(view)`.
- Helpers anyone may use: `createLadder(cfg)` / `buildRungs(tier)` / `rungCost(rung, tier)` (the controller, pure), `createLod() -> L` (`L.update(cam, list, n, H, tier)`, then `L.level[i]` 0 full / 1 mid / 2 low / 3 not in view, `L.dist[i]`, `L.px[i]`, `L.inView(x, y, z, r)`; the view also writes `RST[i].lod` every frame),
  `texBudget(root, tier) -> {count, MB, budgetMB, over, biggest}`, `fitTextures(root, max)` (shrinks static canvas textures; the view calls it on the new world), `summarize(ms[], fps)` (r3d-perf-bench.js: avg / 1% low / 0.1% low / percentiles).
- `r3d-perf-bench.js`: `createBench(Q, view)`; `?bench=1` (or `__mxv3.bench({seconds})`) measures 20 s of the real race and shows the numbers on the screen (9.4). `?fps=1` is a one-line live counter.
**Milestone 2 (perf, the full text in 9.4):** `r3d-perf-warm.js` (`createWarm(renderer)`): every program the tier's ladder can reach is compiled while the gate shows (real shadows on / off x the frame into the chain or to the screen x the crowd's animation on / off), every texture uploaded, one shadow draw, and a KEEPER of every post-chain pass (a twin material that holds its program) so a chain rebuilt for a new size or flag compiles nothing: `V.warm()` (async slices: the game calls it after `setRace`), `V.warmSync()` (the capture page warms inside `setRace`; `?warm=async` skips that); the merge made the warm draw the lead's half-resolution prepass, gather and contact-shadow passes too. The ladder cuts only for OUR slow frames (JS median over 70% of the target, the GPU still busy at over 35% of frame starts by a WebGL2 fence, or two sampled costs over 85%; other late frames go to `ladder.external`), `gl.finish` only when an UP move is near, a try is watched or a slow window is undecided, a resolution step waits for the next camera cut (at most 2 s down, 6 s up), and there is NO post-chain cut mid-race (a device still too slow at the floor is demoted for the next race). MSAA per tier: FIRE TV 4x (no chain: drawn straight to the screen), the chain tiers none (`?msaa=0|1` overrides). FIRE TV: crowd detail 0.7 (the lit crowd cards; Reduce effects keeps 0.35), triangle budget 150k, `res.maxPRtv` 2. A TV stick (`data-tv`, at most 4 cores, at most 2 GB or unknown memory) is FIRE TV before the renderer is made and is never probed. Tools: `Q.stepTo`, `Q.rungTable`, `Q.liveOf`, `Q.warmPlan`, `Q.warm`, `Q.warmer` (`.last` = the warm's report), `ladder.hold / restart / wantSample / own / external / why`; `Q.summary()` adds `ladderMean`, `ladderMed`, `external`, `why`, `gpuLate`, `finishes`, `deferred`, `atCut`, `frames`. `r3d-perf-bench.js` keeps a PASSIVE RECORD of every real race (a 0.5 ms frame-time histogram, tier, render size, ladder steps, external slow frames, JS ms, GPU-late share; localStorage `mxwar.perf.races`, the last 6): `V.perfRaces()`. The merge put the stadium's flags in the tier table (`stadium: {nearPeople, cardRows, twinkle, roofBanks, heroSigns, shaftI}`, returned flat by `Q.options`; Reduce effects / reduced motion: no flashes, no cut-out rows, no 3D front rows). `q.fx.particles` is NOT read by `r3d-fx.js` (it sizes its own pools per tier and scales its emission by `q.live.particleScale`): informational only.

### r3d-track.js, r3d-dirt-relief.js, r3d-dirt-png.js, `assets/dirt/` (dirt)

The dirt is REAL TERRAIN. One relief field in track space (`r3d-dirt-relief.js`, pure maths: ruts on the racing line 10-15 cm deep with pushed-up lips, braided wings, the berms' high lines, windrows of loose dirt, whoop erosion, braking bumps and roost ripples from the speed profile, three wandering tyre tracks, landing scoops, clods)
feeds four things so they cannot disagree: the MESH, the GROUND THE WHEELS FOLLOW, a 4096x128 RGBA track-space texture (slopes of the detail the mesh cannot carry, cavity ambient occlusion, a loose-dirt mask) and the moisture that darkens the dirt and makes it shine at a grazing angle.

- `SOIL` -> `{soil: [base, light, dark]}` (sRGB hex) for "stadium-dirt", loam, clay, hardpack, sand. `soilTiles(lo)` -> the two CC0 Poly Haven scan tiles (512 px; 256 px with `lo`), decoded SYNCHRONOUSLY by `r3d-dirt-png.js` `decodePNG(base64)` (83 lines, bit-exact against zlib) so the scans are on the GPU when the world is built: no async load, captures stay deterministic.
  `assets/dirt/dirt-tiles.js` / `dirt-tiles-lo.js` hold them as base64 PNG (luma detail + height packed in one RGBA image; sources and licences in `assets/LICENSES.md`).
- `dirtMaps(soil, lo, floor) -> {map, normal}` / `padMaps(soil)`: the stadium floor's and the starting pad's maps (mosaics of the same scans).
- `trackMaterial(look, q) -> {mat, dirt}`; `addTrack(C, look, q, root, mat) -> {track, frame: null, relief, info, tier}`. `track` is a Group of THREE.LOD chunks (48 m long, three levels: 0.25 m rows / 0.5 / 1, switching at 44 m and 100 m, skirts hide the cracks) or, for the `lo` tier, ONE adaptive mesh (21 columns, 0.5 m rows only on jumps / whoops / sand, 1 m elsewhere).
  `relief` has `delta(s, lat)`, `lineAt(s)` (the racing line the ruts lie on: `-sign(k(s+9)) * hw * 0.36 (+ the rider's bias)`, the same formula `race3d.js` uses for the corner line: change both together), `buildStartFine()` (the start strip's launch grooves). `world.dirt = {track, frame: null, relief, info, tier}`.
- **`q.dirtTier` = `"hi"` | `"lo"`** (else `q.lo` decides). `hi` = MeshStandardMaterial with the scan tiles at two scales each, LOD chunks (+8..11 draw calls and up to +81k triangles near the lens over the base); `lo` = Lambert, 256 px tiles, one mesh (+1 call, about +21k triangles over the base). `Q.options` sets it per tier (firetv `lo`, balanced / high / ultra `hi`).
- **`installGround`: `MXWar.Course.ground` is wrapped ONCE** (a no-op for a course with no registered relief): it returns the dirt AS DRAWN (ground + `relief.delta`), so wheels, shadows, cameras and fallen riders all stand on the dirt the mesh shows (a wheel sits IN a rut). The wrapper is global: anything that calls `Course.ground` after a world is built sees the relief.
- The lane-edge blocks are chamfered, tapered slabs (28 triangles, small yaw and sink jitter, dust at the foot); their albedo must stay at 0.6 or lower (near-white blocks reach 1.4-1.7 under the key and glow neon: section 12.4).
- Known: the generated Anaheim layout (`sx-modern`, v832) overlaps itself at its left end: the connector (s 166-188, x -57.5) runs under the outer berm of the 180 hairpin (s 426-448); a rider on the connector rides about 1 m under a berm. It is a `layouts.js` / `course.js` matter (section 12.4).
**Milestone 2 (dirt):** the corner ruts are 20-28 cm deep on the racing line (were 12-16) with an ASYMMETRIC section: a steep outside wall with a lip of pushed dirt, a gentle inside slope 2.3x the half width (a dabbed boot sits 7 / 13 cm inside the dirt, p50 / max; milestone 1: 17 / 20); braided wings 13-14 cm, a 16 cm high line up the berm, a lumpy lip of loose dirt on each corner's outside edge. Per-cell grids of TRAFFIC (where the wheels go) and LOOSE dirt; reworked MOISTURE (wet rut bottoms and racing line, dry crests and lips, watered patches 15-30 m across); chopped ruts (braking chatter); `wearMap()` (11 tyre grooves, 3-5 cm). The palette is four soils by moisture (dry golden tan `#a2723f`, mid brown `#6a4322`, wet dark brown `#3f2715`, a rut bottom's deep wet `#28180c`), the colour computed after the vertex colour, luma capped at 1.7; dry dirt barely mirrors the environment, wet dirt glints soft and warm (direct highlight 0.12 dry to 0.5 wet, roughness 0.97 to 0.62). `clumpTile()`: a seeded tileable texture of clods and crumbs on loose dirt near the lens. WEAR OVER THE RACE: `world.dirt.frame(dt, RST)` is set (`uWear = 1 - exp(-leaderLaps / 5.5)`: a pure function of the race, uniforms only; on HIGH and up a 4096x256 wear map of grooves, about +5.6 MB GPU; vertex attribute `aTraf`). The near level has 61 columns (0.125 m); levels of detail: 0-24 m the fine mesh + the CLODS (instanced lit icosahedra, 4784 on the lap, rank 2+ only: HIGH / ULTRA), 24-36 m the same mesh without clods, 36-100 m half, beyond a quarter; 37 bytes a vertex (Int8 normals, byte `aWet` / `aTraf`). FIRE TV: one 21-column mesh, ruts at 65% depth (`o.rut`), the clump tile, the scan sample and the wear darkening, the same calls and triangles as milestone 1. Tuff blocks: raced-in dirt and scuffs on every tier. New export `floorMaterial(look, lo, rgb, W, D)` (the stadium floor: the merge applied it in `r3d-stadium-bowl.js`).

### r3d-world.js, r3d-stadium-bowl.js, r3d-stadium-art.js (stadium)

- `buildWorld(C, look, q) -> {root, ctx, track, fin, info, matTrack, dirt, frame}`; `q` = `Q.options`. `root` is a Group (everything is added to it; `race3d.js` adds the gate, the flaggers, the marshal to it).
  - `ctx`: `dirt` (colour map), `glowTex`, `glow(list, color)` (the outdoor night lights, the speedway: the same sprite shader as the towers), `glowMesh` (the instanced glow sprites; **`glowMesh.material.uniforms.uHdr`** is the gain `r3d-look.js` sets: 2.5 with the bloom chain on, 1 on the plain frame), `sky(top, mid, hor, withSun)` (-> `ctx.skyMesh`, `ctx.sunMesh`), `fog(color, near, far)` (stores `ctx.fogC`, applied by `L.apply`),
    `clouds(C, q)`, `screen(lap, len, num)` (the big video boards: redraw them), `hf(x, z)` (terrain height; outdoor and speedway only), **`bowlY(x, z) -> {y, d}`** (stadium venues: the height of the seats / structure at a place, 0 on the floor, and `d` = metres out from the floor footprint, negative on it; the cameras keep every eye at least 2.5 m above it).
  - `fin`: `{grp, flagAt (Vector3, where the flagger stands), th, side, lat}`. `info`: `{cx, cz}`.
  - `frame`: `null` or `function(dt, tw, cam, T, lap, len, leaderNum)`; `race3d.js` calls it every frame (zone `stadium`): the crowd's wave and flashes, the swinging haze cones, the scrolling ribbons, the video boards (lap, leader's number, race clock: redrawn when they change). `tw` = wall-clock seconds, `T` = the race clock (null before the drop).
- `r3d-stadium-bowl.js` `stadium(C, look, q, root, ctx) -> {cx, cz, frame, board, bowlY}`: a three-tier lit bowl lofted round the floor (a superellipse footprint, e = 6: lower seats, a cross aisle, a second lower tier, the concourse with an LED ribbon, a band of suite windows, the cantilever, the upper deck, the rim, a roof lip; a dome venue gets a roof that covers the bowl with the lights under it),
  a crowd drawn by a seat-by-seat shader from a 64-person atlas (cheering groups, a wave, sway, camera flashes: `q.crowdAnim`; `q.live.crowdAnim` switches the animation off at run time and the shader is rebuilt) plus upright cut-out crowd cards on the first lower tier (13-15k instanced people; ultra: both lower tiers), ad boards, 14 tall banners, 10 light towers with 24-bulb floodlight banks (emissive bulbs at 4.2, a glow each, a halo and a starburst per bank: HDR units), haze cones (`q.post.shafts`), three big video boards, the start gate (a truss, a MOTOCROSS WAR START banner) and the finish arch (a checkered FINISH banner).
  Tier fields read from `Q.options`: `q.crowdDetail` (0.35 firetv: 72 ring segments, 6 towers, no cards, no banners; 0.7 balanced: 96 / 8 / cards / banners; 1 high: 128 / 10 / cards / banners), `q.crowdAnim`, `q.post.shafts`, `q.tier === "ultra"` (cards on both lower tiers); overrides `q.cards` 0/1/2, `q.segs`, `q.towers`, `q.banners`, `q.fancy`, `q.haze`. Cost over the base stadium (the stadium specialist's numbers): high +4 draw calls, +41k triangles (25.7k of them the crowd cards), +5 MB of textures; firetv +3 calls, +7.5k triangles, about +1 MB.
- `r3d-stadium-art.js`: every texture drawn in code (original art: the crowd atlases, ad boards, ribbon, suites, video board, starburst and glow sheet, one shared props texture; half size on firetv). Nothing third-party.
- `gateBuild(C, look, n) -> {grp, pads, slots, pad, gw, th, x, z, y, drop, dropT, slotLat(k), set(a)}`: `set(a)` lowers the pads (0 up .. 1 down); `slotLat(k)` = the lateral offset of slot k.
- `flaggerBuild(flagTex, {marshal}) -> {grp, arm, flag, wave(t, amp), setTex(tex)}`; `flagTex(kind)` ("checkered" | "white" | "yellow" | "green" | anything else = red).
- `fixMat()` (a Lambert material where vertices marked `aFix` keep their own colour), `glowTex()`.
- Re-exports for the old import path: `setAniso, merge, paint, xf, clear, clearDist, lin, mixc, fbm, vnoise, canvas, tex, rngf` (they live in `r3d-util.js`).
**Milestone 2 (stadium):** the crowd atlas draws every shirt in a neutral grey with a shirt mask in alpha (each seat recoloured from a restrained night palette), round shading, lit heads, four arms-up poses; far seats in three regimes by their size on screen (the person sprite, the seat's colour in rows, the block's average with 30% of the contrast: no crawl, no flat grey; crowd fog `uFogK` 0.55; brightness per tier). A `TWINK` mode: phone flashes on tiers without crowd animation (never with Reduce effects or reduced motion). Floodlight spill baked per vertex and per person from the tower positions (the ad-board wall, its cap, the aisles and rails too). `nearPeople()`: the first rows are real 3D people on HIGH (2 rows) and ULTRA (3): about 1,300 instanced 47-triangle bodies in ONE draw call. `crowdCards()`: cut-out rows (3) on a tier that draws no crowd cards. A ring of floodlight banks under the roof lip (18 HIGH / 12 BALANCED / 8 FIRE TV); static LIGHT SHAFTS from every tower bank through the haze (built only where `q.post.shafts` is on, hidden when `q.live.post.shafts` goes off); 22 hero sign panels on legs at the floor's edge (`world.ctx.signs = [{x, z, hw, tx, tz, h}]`, published by `buildWorld`); a catch net over the wall (not on FIRE TV). `flaggerBuild(flagTex, {marshal, lo})`: real figures and CLOTH flags (a 14 x 8 grid with a travelling wave, flutter, sag; `lo` = coarser figures, 9 x 5 cloth). Optional `Q.options` fields read by `stadium()` (in the perf tier table since the merge, 9.4): `q.nearPeople`, `q.cardRows`, `q.twinkle`, `q.roofBanks`, `q.heroSigns`, `q.shaftI` (0.065). Costs over milestone 1 (the stadium's numbers): HIGH +2 calls / +65-68k triangles / +2 programs / +0.1 MB textures; FIRE TV +1 call / +4.4-5.6k triangles / +1 program / +0.4 MB (measured at crowd 0.35: the merged FIRE TV tier draws the crowd cards, crowd 0.7). The floor is the dirt's `floorMaterial` (the merge).

### r3d-bike.js and r3d-bike-model.js (bike)

A 450 cc Supercross bike built in code: `r3d-bike-model.js` is pure geometry (an original design: twin-spar frame, engine, shrouds, gold fork, exhaust, shock with a coil spring, spoked wheels with knobby tyres, three levels of detail), `r3d-bike.js` has the constants, the shader, the instanced level-of-detail sets, colours, plates and the pose.
Bike local axes: +X forward, +Y up, +Z right. Heading `th`: `rotation.y = -th`; roll + = lean right; pitch + = nose up; Euler order YZX. `assets/bike/README.md` has the bike's own notes and `assets/bike/viewer.html` its test page (not part of the game, not in `sw.js`).

- `BIKE`: `WB` 1.48 m wheelbase, `WR` 0.34 m wheel radius, `FA` / `RA` axles, `HEAD`, `PIVOT` (x -0.17: a real swingarm length), `GRIP` (0.40, 1.12, 0.37), `PEG` (-0.07, 0.43, 0.21), `TRAVEL` 0.30, `SAG` 0.10; new: `RAKE` (27 degrees), `UP` (the fork axis), `FWD`, `STEER_PT`, `ARM`,
  **`SEAT` (-0.20, 0.958, 0: where the hips rest), `KNEE` (0.14, 0.84, 0.15: a shroud contact point)**, `SHOCK_TOP` / `SHOCK_BOT` / `SHOCK_STROKE`, `STEER_MAX` 0.34, `CHAIN_SPROCKET`, **`steerGain` (1: the bars show the whole steering; the rider's hands follow them)**.
  `race3d.js` uses `WB`, `WR`, `TRAVEL`, `SAG` for the suspension physics; **`r3d-rider-pose.js` reads `GRIP`, `PEG`, `SEAT`, `KNEE` LIVE every frame** (a new bike with other contact points needs no rider change): change them together or not at all.
- `createBike(n, lo, mk, q?) -> M`: `mk(geo, count, material)` is the instancing glue of `r3d-riders.js`. `M` holds every InstancedMesh as `M["bk<lod>_<part>"]` (parts `body`, `steer`, `fork`, `swing`, `shock`, `wheelF`, `wheelR`; LOD 0 close, 1 mid, 2 far = one static mesh) and the state as `M.bk`; `M.plate` (3 plates a bike) is made by `createRiders`.
  **`q.bikeLod`** = `[d0, d1]` metres at which a bike leaves one level for the next (`Q.options` per tier, polish step 2026-10-17: firetv `[8]` = LOD 1 under 8 m and LOD 2 beyond, a Lambert shader; balanced `[6, 17]`; high `[8, 22]`; ultra `[12, 34]`; hysteresis 8%). **`q.bikeHi`** = how many bikes may use LOD 0 at all (the N nearest of the last frame, `capHi` in r3d-bike.js; firetv 0, balanced 2, high 4, ultra 8; no cap on a frame after a camera cut, so a cut never depends on the shot before it). Triangles a bike: LOD 0 21.8k (130 real knobs on the rear tyre), LOD 1 5.6k, LOD 2 0.8k.
  One patched MeshStandardMaterial for the whole bike: team colour and accent from instance attributes, a livery mask (4 styles by rider index), baked per-vertex metalness / roughness / AO, MUD that builds up on the lower parts from `st.mud`, spokes that fade by screen-door dither when a wheel turns faster than a spoke's spacing a frame. It carries its own procedural environment map (`T.env`, high tiers), which overrides `scene.environment` (the lead's map).
- `colorBike(M, i, R)` (R = `{color, accent}`), `poseBike(M, i, B, st)` (B = the bike's world Matrix4; reads `st.compF`, `st.compR`, `st.spinF`, `st.spinR`, `st.lodD`, `st.lodCut`, `st.mud` and `st.steer` or else the track curvature `st.k`), `hideBike(M, i)`, `lodCounts(M)`.
  **Every rider must be posed or hidden once per frame, in index order** (a lower index than the last call starts a new frame: the sets are packed per frame, so the draw counters are honest).
- Steering: the front end (bars, clamps, upper fork tubes, lower legs, front fender, front wheel, front plate) turns about the real steering axis by `steerOf(st)` = `steerAngle(st) * BIKE.steerGain`. `steerMatrix(delta, out)` and `steerPoint(p, delta, out)` (THREE objects) and **`steerXYZ(x, y, z, delta, o, k)`** (plain numbers, no allocation: the rider's pose turns the grips with it) do the same turn; `steerAngle(st)` (+ right, clamped to `STEER_MAX`, a quarter of it in the air).
- Kept from the base: `drawPlate(x, rr, fit, px, py, cell, R, t)`, `PLATE_L`, `plateGeo()`, `chassisGeo`, `wheelGeo`, `plasticsGeo`, `trimGeo`, `forkGeo`, `swingGeo`, `V3`, `tube`, `triCount`.
**Milestone 2:** the bike specialist's milestone 2 branch (`mxvis2-bike`: livery v2, numbers on the side panels, mud splatter, a native clear coat, blur discs, a front plate that is part of the bike) was still building at the merge and is NOT in this build (section 16). The merge added only the near-lens keep to `bikeMaterial` (`uMxKeep`, `mxKept()`, r3d-util.js): the bike branch must keep that test when it is merged (it rewrote the same lines).

### r3d-riders.js, r3d-rider-model.js, r3d-rider-pose.js (rider)

The rider is ONE SKINNED MESH generated in code (original art, no logos): 17 bones (pelvis, lumbar, chest, neck, head, shoulders / elbows / wrists, hips / knees / ankles), two bones and weights a vertex, a baggy jersey with a chest protector, sleeves, gloves, pants with knee braces, tall boots, a neck brace, a helmet with a peak, chin bar and goggles, a number patch curved over the back (`r3d-rider-model.js buildRider(detail)`).
The skinning is done on the GPU for ALL riders in one draw call a part: every rider's bone matrices live in a float DATA TEXTURE (`R.boneTex`, `NB * 3` x n RGBA32F, one row a rider, backed by the Float32Array `R.bones`) and the vertex shader (patched into three.js' own Phong / Lambert / depth materials) blends two bones with `texelFetch`: **WebGL2 is required** (`supported()` checks it).

- `createRiders(list, q) -> R`: `list[k] = {s (seat), color, accent, num, name, red, me}`. `R = {grp, M, A (the number atlas), n, list, S (the skinned meshes: hiBody, hiHelmet, hiBack, loBody), bones, boneTex, hiInst, loInst, stats {hi, lo}, ...}`. `R.M` holds the bike's InstancedMeshes (r3d-bike.js), `plate` (3n), `shadow` (blob quads, 2n), `tag` (n number tags).
  **`q.riderHi`** = how many of the nearest IN-VIEW riders get the full model (3,910 triangles, a glossy helmet, the number patch); the rest get the 823-triangle version of the same skeleton (`Q.options` per tier, polish step: firetv 3, balanced 4, high 6, ultra 10). The outfit is PAINTED in the fragment shader (r3d-rider-apparel.js, section 13): every vertex carries its outfit PART (`PART.*`, `aFx.w`), level 2 on the near riders of the physically based tiers, level 1 on the thin pack and the FIRE TV tier. `q.lo` = Lambert materials, no rim light or wrinkle shading. The rider draws 4 calls (+3 in the shadow pass, through `customDepthMaterial`).
- `poseRider(R, i, B, st)`: poses the bike (`poseBike`), then the rider: `poseRide` for normal riding, `poseBody` for a crash (`st.body` = a Matrix4, origin the hip, +Y up the spine, +X the chest's front, +Z right; `st.limbs = {spread, walk, phase, stand, reach}`; the crash script is in `race3d.js`). `st.hide` hides both. `hideRider(R, i)`, `shadowAt(R, k, ...)`, `tagAt(R, i, pos, size)`, `setRed(R, list)`.
  **`commit(R, cam, dt)`** (once a frame after posing): chooses who gets the full model (by depth in view, the person's rider favoured; a rider behind the lens or off screen comes last), writes every per-instance attribute, flags every buffer and the bone texture for upload; `dt` feeds the springs.
- The pose (`r3d-rider-pose.js`, plain arrays: 5 microseconds a rider): damped springs in the bike's frame (pelvis on three axes, torso pitch and roll, head pitch and yaw) chase the stance (seated, standing, crouch under load, extended in the air, forward on the tank in a flat turn) and FEEL the bike's own acceleration (a landing pushes the pelvis down through the legs, braking throws the shoulders forward, free fall unloads the legs);
  two-bone IK: **hands on the grips AS THE BARS ARE TURNED (`BIKE.GRIP`, z mirrored for the left hand, turned by `steerOf(st)` with `steerXYZ`), feet on the pegs (`BIKE.PEG`), hips over `BIKE.SEAT`, the leg IK's pole turned toward `BIKE.KNEE`** (0.75 weight seated, 0.25 standing); a reach constraint keeps the hands on the bars and the feet on the pegs; the head keeps looking ahead and into the turn; the inside foot comes out in a flat turn.
  A crash: hands and feet are under-damped springs in WORLD space, so the limbs trail the tumbling body. Output: one 3 x 4 skinning matrix per bone.
- `st.mud` (0..1) browns the boots, shins, gloves, chest front and helmet front (the `bike` zone of `race3d.js` raises it with the distance ridden, `r3d-fx.js` in another rider's roost). The riders' rim light (Fresnel, 0.34 cloth / 0.22 helmet) and the number atlas are in `r3d-riders.js`.
- Old import path: `BIKE`, `emit`, `stepParticles` are re-exported. These are NOT SkinnedMesh / Skeleton objects: anything that copies the riders' meshes must copy the bone texture too (the replay does, section 3 cams).
**Milestone 2 (rider):** a real motocross HELMET (a long shell, the face recessed, a chin bar with a beak and a narrow vent, goggles in a wrapped frame with a dark lens and a 4 cm strap, a visor: 1,746 triangles, lite 1,006, the pack about 300), GLOVES that wrap the grip (the grip is a bar along z through (0, -0.145) in the hand bone), BOOTS that fit (shin plate, four straps), the knee brace under the pants, square shoulders over chest-protector cups, an elbow guard under the sleeve, a dark neck brace, a 30 x 30 cm back patch with the NAME (plain text) over a big number. `buildRider(detail, lite)`: the near rider 5,496 triangles on the physically based tiers (was 3,910), 4,080 `lite` (used when `q.lo`: FIRE TV, Reduce effects), the pack 840. New outfit parts `PART.STRAP` 8, `LENS` 9, `CHIN` 10, `FRAME` 11; `HC` (the helmet centre) exported. The near riders' cloth is `MAT.fabric` (sheen 0.32) on the high kit tier; the plates fade near the lens with the bike and the rider (never the chase subject's: the merge). The pose: THE ATTACK POSITION (standing: hips back and low, chest 1.12 rad, head over the bars; seated 0.90), elbows out and back with a bend (84-92 degrees standing, 73-81 seated), `rig.sty` per-rider style (from the index: elbow flare 0.78-1.22, elbow height, crouch, lean, hip, knee grip, head turn, a 0.05-0.22 s lag standing up), in the air the torso resists 78% of the pitch and 62% of the roll; `blendStart` / `blendStep` (exported) blend a change of pose type per bone in `poseRider` (0.16 s into a fall, 0.55 s at the remount: no one-frame pop), and a bike jump faster than 32 m/s in one frame is not felt as acceleration. Apparel: the helmet painted (iridium lens, strap blocks with no seam at the back, a muted team goggle frame, chin bar and visor accents, crown intakes), the gloves, black or white boots by style; dirt STREAKS that grow with `st.mud`; the hem and sleeves puff with the wind of speed (one phase per rider: no sparkle).

### r3d-fx.js (fx)

The flying dirt of the cover, driven by the riders' real motion. Every piece is pooled and instanced, one draw call each, counts set by the tier.

- `createFx({lo, C, look, cam, ...Q.options}) -> FX` (a new one for every race; reads `q.tier`, `q.lo`, `q.live.particleScale` EVERY frame (the ladder) and `q.cam` (the weak tiers rank riders by the camera)). Pools: high 900 clods + 2600 spray + 260 puffs + 36 haze + 170 motes + lens flecks; ultra 1300 / 3600 / 340 / 44; balanced 420 / 1000 / 130 / 14; firetv 160 / 300 / 44 / 0 (8-triangle clods, no motes, no lens). A pool filling up slows its emitters. Reduced motion = no effects at all.
- `FX.group` (added to the scene by `race3d.js`): `fx-clods` (an InstancedMesh of lit low-poly rocks that bounce and settle on the REAL dirt height through `Course.ground`, then shrink away; clods inside 1.1 m of the lens shrink to nothing), `fx-sprites` (an InstancedBufferGeometry mesh: velocity-stretched spray, dust puffs with baked normals, haze puffs trailing the pack; a ShaderMaterial lit by the scene's own lights, fog, tone mapping and colour space, so it is right on the plain frame AND inside the HDR chain; it writes no depth),
  `fx-motes` (Points, high tiers: dust specks floating round the camera), `fx-lens` (high tiers: mud flecks on the lens when the camera is right behind a roosting rider: a pure function of the riders' spray and the DRAWING camera).
- `FX.inputs(st, dt)` (race3d.js `[hook:fx]` in `rider()`, above `poseRider`): derives `st.throttle` / `st.slip` (0..1) and `st.roost` (0..8) from the rider's real acceleration x a low-speed factor, the gate launch and lean x speed (wheelspin is a low-speed thing), and raises `st.mud` when riding in another rider's roost (the same line, 1.2-9 m ahead; it clears at about 1% a second).
  `FX.rider(st, dt)` (the emission: a fan of clods and spray off the rear tyre, to the outside in a berm; front-wheel flicks in a berm; a dust trail in a hollow fan so a chase camera keeps a clear line; sand and braking add dust; a haze behind fast riders; a take-off burst at a lip; a landing burst (a ring of clods, spray, puffs) scaled by `st.impact`),
  `FX.step(dt)`, `FX.focus(a, b)` (the leader's and the person's positions: the high tiers weight the dirt toward them: race state only, NEVER the camera, so frames stay a pure function of the tick), `FX.crashStart(f, gy, r)` (a burst and a dust cloud where the rider goes down; `r` = the rider's record), `FX.crashStep(...)` (a burst at each bounce, a plough behind the sliding bike),
  `FX.setBudget(0..1)`, `FX.stats()`, `FX.debug(x, z, r)`, `FX.hash()` (tests), `FX.dispose()`, `FX.part` (a debug view of the clods).
- `emit(P, ...)` and `stepParticles(P, dt)` stay as module exports only because `r3d-riders.js` re-exports them.
- Determinism: a private seeded generator (never `Math.random`); the high / ultra tiers never read the camera while simulating; the lens flecks are a uniform array set while the lens is drawn.
- Cost (high, the specialist's numbers): +3 draw calls, +24k triangles, +0.36 ms of JS at the busiest moment (960x540).
**Milestone 2 (fx): THE DIRT STORM.** Pools per tier (`TIERS` in r3d-fx.js; crumbs / clods / puffs / haze / motes / lens flecks): high 20000 / 1400 / 300 / 36 / 170 / 6; ultra 26000 / 2000 / 380 / 44 / 210 / 6; balanced 5000 / 640 / 150 / 14 / 80 / 0; FIRE TV 1400 / 160 / 40 / 0 / 0 / 0; low 1200 / 240 / 64 / 0. `FX.group` = `fx-clods`, **`fx-specks`** (new: GPU crumbs in ONE draw call, written once when thrown and flown by the vertex shader on the simulation clock with air drag; only the slots thrown that frame are uploaded; a camera-relative SHUTTER: a streak is where the crumb was 1/250 s ago relative to the lens, at most 5 crumb widths and 5.5% of the frame height, never thinner than 1.4 px; capsules lit like lumps of dirt, 25% glinting chips; crumb cores write depth on high / balanced / ultra; far crumbs keep 18% opacity), `fx-sprites` (dust and haze only: the CPU spray pool is gone), `fx-motes`, `fx-lens`. The roost: a rooster tail off the rear tyre under power (25-45 degrees up, 1-1.8 m high) in a wider fan, berm spray to the outside, front-wheel flicks, up to 450 crumbs a second a rider at speed, bursts at take-offs, landings and crashes; on the start pad 40% rising to 100% at 18 m, launch clods up to 1.6x. Clods: darker moist dirt (physically based, roughness 0.56, a wet sheen, no emissive floor), log-normal 1-3.4 cm (4% chunks to 6.5 cm), stretched along their velocity, shrinking inside 1.6 m of the lens. THE VEIL RULE: puffs fade out from 2.2 m to 0.7 m from the lens, no puff covers over a quarter of the frame height within 3-6 m, the dust layer's share of the frame is capped at draw time (high 30%, ultra 32%, balanced 28%, low 24%, FIRE TV 22%). Backlit dust and crumbs (forward scattering toward the floodlight ring 30 degrees up, 0.22-0.30 per tier). `FX.stats()` adds `specks`, `speckPool`, `veil {cov, gain, cap}`, `regulator`. THE CRUMB MASK (the merge, the lead's request): the specks blend their colour as before and write the scene alpha as 1 - their coverage (`CustomBlending`: SrcAlpha / OneMinusSrcAlpha, alpha Zero / OneMinusSrcAlpha), so the chain's camera motion blur leaves them alone (the canvas has no alpha: a frame drawn to the screen is unchanged). Cost: +1 draw call, +13.5k triangles on high, +2.2k on FIRE TV; the effects' frame cost measured below milestone 1's dust veil.

### r3d-cams.js (cams)

A TV broadcast of a supercross night. `createCams(VIEW) -> CAMS` (once per view; `VIEW` = the view's live state, section 6); per frame the view calls `CAMS.director(dt)` then `CAMS.camera(dt)`. Every camera is a critically damped rig (no jitter, continuous velocity); hard cuts only between shots.

- Shot types: `gate | turn1 | chase | wide | onboard | track | whoops | jump | corner | crash | line | heli`. THE DEFAULT is the cover chase (`rigChase`: 3.5 m behind, 1.5 m up, 70 degrees vertical, the rider in the right third, the pack ahead and the lit stands in frame, path-following so hairpins swing it round, other riders pushed off the lens and lifted over, landing shake, 0.2 x lean roll). Broadcast = fixed trackside spots with a 20-35 degree long lens;
  corner = low inside the berm before the apex; **stadium-wide = on the stadium's own seats (`world.ctx.bowlY(x, z)`: the eye 2.8 m above them, in the lower tiers like a TV's main camera) at 50 degrees**, a slow crane along the stands (outdoors a tower); onboard = on the bars (bike-local 0.40 / 1.32), 82 degrees. THE DIRECTOR cuts every 2.6-5.6 s (reserved shots: the gate drop, the holeshot, a featured battle or war, a crash and the marshal's yellow flag, the line, the white / checkered flags, a launch chase on the person), and lifts the person's rider when it has had under 62% of the last 28 s.
- **Every eye is kept at least 2.5 m above the stands under it**: `ctx.bowlY(x, z)` (where `d > -0.5`) is applied right before the camera is set; on the floor nothing changes. The camera is also kept above the exact dirt height (a crest sight test) and `inFloor` keeps the floor cameras inside the bowl (a smaller superellipse, e = 4, shrunk 3.5 m, inside the bowl's e = 6).
- Presets for the remote and the phone button: `CAMS.modes()` -> `[{id, name}]` (auto = Director, chase, broadcast, stadium, onboard), `CAMS.mode(id?)`, `CAMS.nextMode()`. The view exposes `V.camModes()`, `V.camMode(id?)`, `V.camNext()`, `V.camReplay()` and `V.camState()` -> `{mode, shot, replay, replays, rec, recMB, share}`. A preset holds its rider and never cuts (the broadcast re-picks its spot).
- **The REPLAY** (render time only: the race is never touched; automatic for the person's own crash, never over the last lap and the flag; `CAMS.replayNow({subj, ev})` or `V.camReplay()` on demand): a ring of the last 7 s, 30 Hz at most, records every drawn instanced matrix, instance colour and count, the riders' per-instance attributes AND BONE MATRICES (the skinned riders' data texture), the clods' matrices and a plain object's transform (about 25 MB on the high tier);
  a replay draws COPIES of the riders' and particles' groups (the live ones hidden) from the ring at 0.3-1.0x speed through a low 3/4-rear chase and then a low side long lens; the recorded bone matrices are written into the live bone texture each replay frame (the live step rewrites them). The dust sprites and lens flecks are not recorded (about 190 KB a frame): their copies stay hidden in a replay.
  **`VIEW.replayOK` is false on the FIRE TV tier (tier flag `replay`): nothing is recorded there** (about 25 MB is too much for a 1-2 GB device).
- Tools: `sees`, `safeCam`, `dirtTop`, `terrainAt`, `inFloor`, `trackCam`, `featCam`, `cornerCam`, `lineCam`, `crashCam`, `yellowCam`, `gateCam`, `turn1Cam`, `spotCam`, `secPt`, `force(spec)` (tests), `corners()`, `focus` (the subject's point: where a depth of field would focus), `target` (the aim point: the shadow box follows it), `camS`, `shot`, `setShot(s)`, `pickShot(force)`, `shotLog`, `featLog`, `snap()`, `buildGrid()` (a new course), `reset()` (a new race), `state()`.
- It moves `VIEW.cam` every frame: position, `lookAt`, `fov` (portrait phones get a wider vertical field) AND `near` (0.1 onboard, 0.5 otherwise): a post chain must read them every frame.
**Milestone 2 (cams):** the default chase is THE HERO CHASE (`rigHero`: 2.6 m behind the hip, 1 m to his left, 1.1 m up, 72 degrees (+2 with speed), his hip at NDC +0.42 / -0.28, the eye on his own heading on a spring (tau 0.38 s) at most 43 degrees behind the track's, roll 0.22 x his lean (at most 0.12 rad), a landing shake). Four MOUNTS chosen every frame by cost: cover; mirror (pref 0.55); high (3.4 m back, 3.4 m up, pref 0.6); wide (3.6 / 1.6, pref 0.62). The cost: a rival's 2.2 x 0.8 x 1.9 m box filling over 12% of the mount's own frame now and 0.35 s ahead, the lens over the lane blocks, a berm under the lens, the wall, a roost-dust term on the low mounts (calibrated on `st.roost`); smoothed 0.25 s, a 0.3 margin and a 1.4 s dwell to switch, the switch glides. Lens safety: a rival's body within 2.4 m of the lens (from his wheelbase segment) pushes it out by 2.4 - d and lifts it up to 1.8 m (tau 0.08 s); the subject's own body keeps 1.6 m. Milestone 1's 3.5 m rig stays as the wide chase and the replay's. THE BROADCAST (`rigBroadcast`, shot type `bcast`): a TV platform 6.5 m over the seats on a rail along a long side (the seats there 9.5 m high), dollying (tau 3 s), panning with the pack led by its speed, zooming 12-42 degrees so the pack fills about 60% of the width, changing sides at most every 5 s; the director's once-a-lap establishing shot frames the person's pack. PRESETS (`CAMS.modes()`; the camera button cycles six): Director, Chase, Broadcast, Trackside (milestone 1's crane), Stadium (4.6 m over the seats, 46 degrees, aimed halfway to the pack), Onboard (the hero chase while part of a rival is within 1.7 m in the middle of the onboard picture; back when he is 2.2 m away for 1.5 s). The director: the person's screen share counts the time he is really in the frame (target 75%, lift up to +1.6; out of the frame over 5 s: +2.6 to his hero chase; over 6 s: someone else's filler ends early, at most once every 4 s); the yellow-flag shot starts about 1.8 s (at most 30 m) before the first rider reaches the section; the finish arch's legs block fixed spots and their sight lines; the onboard eye stays 0.25 m above the dirt and no onboard is picked with a rider within 3.5 m; a portrait broadcast is not widened twice. `CAMS.keep` (Vector4: the chase subject's hip and 1.6 m; w = 0: none) is copied into `MX_KEEP` (r3d-util.js) by race3d.js every frame. `V.camState().shot.mount` names the hero mount.

### race3d.js (lead)

`supported()` (**WebGL2 is required** — the riders' skinning needs `texelFetch` on a float data texture; `?gl=0` in the page's address forces the 2D fallback) and `create(host, hooks {onLap(n), onFinish(), lost()}) -> V`. The API `game.js` uses is in the file's header: `V.setRace(o)`, `V.gate()`, `V.drop()`, `V.lap(result)` -> show,
`V.hold(o)`, `V.standings(order, cnt, lap)`, `V.setFlag(k)`, `V.setRed(seat)`, `V.markOut(seat)`, `V.show(on)`, `V.resize()`, `V.skip()`, `V.lapTime()`, `V.yellowAt(sector)`, `V.yellowOff()`, `V.stop()`, `V.dispose()`; since the eight specialists:
**`V.warm()`** -> Promise (compiles every shader of the scene now: `game.js` calls it after every `setRace`, while the gate shows), `V.qualityNames()`, `V.qualityLabel(name)`, `V.quality()`, `V.setQuality(name)`, `V.bench({seconds})` / `V.benchResult()` (section 9.4), **`V.camModes()`, `V.camMode(id?)`, `V.camNext()`, `V.camReplay()`, `V.camState()`** (the camera presets and the replay: the game's phone and remote buttons call them; section 3 cams).
Tools for tests: `V.state()`, `V.stats()` (draw calls, triangles, frame times, pixel ratio, memory), `V.shot(name, o)`, `V.release()`, `V.advance(sec, noDraw)` (steps in 1/60 s; deterministic), `V.sweep(sec)`, `V.proj(seat)`,
`V.renderNow()`, `V.camInfo()`, `V.setShadows(on)`, `V.fixPR(p)` / `V.prFixed` (freeze the pixel-ratio ladder), `V.timeScale`, `V._dbg` (`riders()`, `fx()`, `state()` = the per-rider state array, `gate()`, `world()`, `marshal()`, `target()`, `sees()`, `dirt()`, `hf()`, `yellow()`, `shot()`, `pos()`, `clearance()`).
`V.renderer`, `V.scene`, `V.camera` are public. (`V._dbg.riders().part` is now `V._dbg.fx().part`.)
`V.camHook` (null; the capture harness' camera: `function(dt, riders, T) -> null | {eye: [x, y, z], target: [x, y, z], fov}`, applied right after the director's camera; the game never sets it). `V._dbg` also has `look()` (the `createLook` object: `.post`,
`.sun`, `.setShadows`), `quality()` (the `createQuality` object) and `cams()` (the cameras module), for experiments from the harness page (`__mxv3._dbg.look().post = ...`).
**Milestone 2 merge:** `V.warm()` / `V.warmSync()` (the perf warm-up), `V.perfRaces()` (the passive per-race record), six camera presets; **`hooks.shown(kind, info)`** (optional, for the announcers: the game wires it to `annShown` / the booth's `booth.shown`): `"holeshot"` {s} (the leader into turn 1 on lap 1), `"pass"` {s} (the lap winner's first pass), `"crash"` {s, kind} (the bike goes down), `"lapped"` {s, by} (the leader rides past a rider a lap down), `"checkered"` {s} (the winner takes the flag); s / by are the game's seats, the call comes in a timeout after the frame (never inside it), the harness sets no such hook. `show.at(name)` (holeshot | pass | crash | yellow | line | done) is unchanged. The motion zones (section 4) move the riders; `st.th` and `rs[i].th` are the BIKE's heading (sections 5, 6). `MX_KEEP` is set after the camera (the near-lens keep).

### ui/vendor/three-addons (nobody edits; the integrator adds on REQUEST)

56 files, the `examples/jsm` folder of three@0.160.0 (MIT, `LICENSE` and `README.txt` beside them), flat, imports rewritten (`../three-0.160.0.module.min.js` for the engine, `./X.js` for a sibling), so one ES module in `mxwar/` is enough:
`import {EffectComposer} from "../ui/vendor/three-addons/EffectComposer.js";`. What is there: the composer and its passes (Render, TAARender, SSAARender, Shader, Mask, Clear, Texture, Save, UnrealBloom, Bokeh, SMAA, Film, LUT, Afterimage, GTAO, SSAO, SAO, Outline, Output),
their shaders (Copy, LuminosityHighPass, Output, SMAA, FXAA, Bokeh, Vignette, GammaCorrection, Film, Afterimage, GTAO, PoissonDenoise, SSAO, SAO, DepthLimitedBlur), `GLTFLoader`, `RGBELoader`, `RoomEnvironment` (a PMREM environment for reflections),
`BufferGeometryUtils`, `SkeletonUtils`, `RoundedBoxGeometry`, `DecalGeometry`, `ConvexGeometry` + `ConvexHull`, `Lensflare`, `Sky`, `Reflector`, `MeshSurfaceSampler`, `ImprovedNoise`, `SimplexNoise`, `GPUComputationRenderer`, `Timer`, `CCDIKSolver`,
`WebGL` (capabilities), `SceneUtils`. Not there on purpose (REQUEST them): loaders that need a wasm decoder (KTX2, Draco, Meshopt), `RectAreaLightUniformsLib` (314 KB), SSR, volumetrics. `tools/addons-check.js` proves every file imports and every pass
renders on the GPU. They are not in `sw.js` ASSETS yet: a module that imports one is listed there by the integrator (REQUEST). Prefer `SMAAPass` to `FXAAShader`: FXAA's `texture2D(t, p, -100.0)` makes Direct3D print the harmless warning X4713.

## 4. race3d.js: the frame, and the hook zones

Every frame (`tick` -> `step(dt)` -> `render()`): the clock and the lap boundaries (the leader starts a lap: `hooks.onLap`) -> each rider's gap, position, racing line and passing room ->
the flagger and the show moments -> **per rider `rider(i, r, dt)`**: speed, the two sprung axles, stance, the bike matrix, the per-rider state `st`, `poseRider`, the blob shadow, `FX.rider` ->
`FX.step` -> `commit` -> `world.dirt.frame` -> flagger and marshal waves, `world.frame` -> `CAMS.director`, `CAMS.camera` -> the harness' `V.camHook` (never in the game) -> the sky follows the lens, `LOOK.fitShadow` -> the number tags ->
`LOOK.render` -> `QUAL.adapt`. A crashed rider goes through `crashPose` instead of the riding branch (a double-war loser tumbles, lies, gets up, lifts the bike, remounts; a triple-war loser walks off).

Zones (find them with a search for `[hook:`); each role may change only its own lines:

| Role | Where | What is there now |
|---|---|---|
| perf | `create()` top | `QUAL = createQuality(...)` (with `resized` and `redraw` callbacks), `renderer = QUAL.renderer`, `lastRace` / `builtTier` |
| perf | `setRace` | `lastRace = o`; Reduce-effects change (`LOOK.setShadows(QUAL.shadowsWanted(LO))`); the world cache `key` (+ `QUAL.buildKey(LO)`); `buildWorld(C, look, QUAL.options(LO))` and `QUAL.fitTextures(world.root)` |
| perf | `tick`, `V.resize` | `QUAL.adapt(dt, ms)` (the ladder, the benchmark, the riders' level of detail, the GPU sample); `QUAL.resize(w, h, W, H, LO)` |
| cams | `create()` | `VIEW` (the live state, section 6), `CAMS = createCams(VIEW)` and the view's `V.camModes()`, `V.camMode(id?)`, `V.camNext()`, `V.camReplay()`, `V.camState()` |
| cams | `setRace` | `CAMS.buildGrid()` after the world is built; `CAMS.reset()` |
| cams | `step` | `CAMS.director(dt)`, `CAMS.camera(dt)` |
| cams | `beginCrash` | the cut to the crash camera (`CAMS.pickShot(true)`) |
| stadium | `setRace` | the flagger and the marshal are built; the big screen shows 0 / laps |
| stadium | `V.lap`, `step` | the big screen's lap number |
| stadium | `step` | `flagger.wave`, `marshal.wave`, `world.frame(dt, tw, cam, T, lap, len, leaderNum)` (the video boards show the race clock, the lap and the leader's number) |
| dirt | `step` | `world.dirt.frame(dt, RST)` |
| fx | `setRace` | the old `FX` is disposed (`FX.dispose()`); `FX = createFx({C, look, cam, ...QUAL.options(LO)})` is added to the scene |
| fx | `step` | `FX.focus(leaderPos, personPos)` (race state only), `FX.step(dt)` |
| fx | `rider()` (two zones) | `FX.inputs(st, dt)` (above `poseRider`: `st.throttle`, `st.slip`, `st.roost`, `st.mud`); `FX.rider(st, dt)` (the last line) |
| fx | `beginCrash`, `crashPose` | `FX.crashStart(f, gy, r)`, `FX.crashStep(...)` |
| bike | `rider()` | the bike's inputs: `st.lodD` (distance to the lens scaled by the field of view, x2.6 when off screen), `st.lodCut` (the camera jumped more than 3 m: choose the level of detail afresh), `st.mud` (+0.00058 a metre ridden, x3.5 in sand, + up to 0.03 on a hard landing; the ONLY writer of the distance part) |
| rider | `rider()` | nothing written (the rider branch's time-based `st.mud` rise was removed in the merge: `st.mud` has one physical source, the `bike` zone, plus the roost in `FX.inputs`); the skinned riders' shader browns the boots, legs, gloves, chest and helmet front with `st.mud` |
| rider | `step` | `commit(R, cam, dt)` (the level of detail by depth in view; every instance buffer and the bone texture are uploaded) |
| harness | `create()`, right after the view object `V` | `V.camHook = null` (frozen: the capture harness' camera, section 9) |
| harness | `step`, right after the cams zone | the `V.camHook` call: when the harness set a camera it replaces the director's position, look-at point (`CAMS.target`) and field of view; nothing happens in the game (frozen) |
| perf | `create()`, after `V.fixPR` | `V.qualityNames()`, `V.qualityLabel()`, `V.quality()`, `V.setQuality(name)`, `V.bench(o)`, `V.benchResult()`, `QUAL.bindLook(LOOK)`, `QUAL.attach(view)`; the harness, `perf.js`, `shots.js` and `finish.js` use them (section 9.4) |
| motion | `setRace` | the riders' records (`rs`, with the motion fields `Dl, P, sb, vl, al, alF, psi, psiHold, sd, jF, jR, jDone, czone, rem`) and `gridBuild()` |
| motion | after `setRace` | `GRID`, `gridBuild`, `gridLat`, `gridBack`, `rightOf`, `sideOf` (unused), `slotOf` (reference only), `SEP`, `passLine` |
| motion | `V.lap` | `r.cr`: the cards' order this lap (who has the right of way when two riders are level) |
| motion | `V.gate` | the whole function (the gate and the motion state reset) |
| motion | `step` | the positions (the logical distance `Dl`, the setbacks `sb`, the drawn `D`), the frames, the lateral lines (the passing solver, the follower, the crash no-go stretches, the hard limits) |
| motion | `rider()` (five zones) | the speed (`r.rem`, `r.vi`) and the `jumpArc()` calls; `r.rem = false`; the heading / lean block (`psi`, the lane-change lean); `st.x .. st.pitch` with `st.th` = the bike's heading; the blob shadow's heading; `r.pos`, `r.th`, `r.oy`, `r.gy` |
| motion | after `rider()`, `axle()` | `ride()`, `JLIM`, `arcY`, `jumpArc`; the progressive spring and the bump stop |
| motion | `crashPose` | `tmpCW`; the remount's lift settles the bike onto its own wheels |

Lead lines added by the milestone 2 merge (not zones): `keepCam` / `MX_KEEP.value.copy(CAMS.keep)` around the harness zone in `step` (the near-lens keep), the announcers' seam (`shown()`, `lappedK`, `shownHs`: section 3 race3d.js).

Lead lines for the look (not zones): `createLook(renderer, {shadows, lo, tv, weak, host})`, `LOOK.apply(C, look, world, {lo, tv})` after the world is built, `LOOK.upgrade(R.grp)` + `LOOK.receive(R.grp)` after `createRiders`, `LOOK.frame(cam, CAMS.target, dt, tw, subjectDist())` after the camera (the rider nearest the middle of the picture within 34 m is the depth of field's subject), `LOOK.render(scene, cam, tw)`, `LOOK.dispose()` in `V.dispose`.

Other lines that touch a module (lead's, ask for a change through REQUESTS): the shot tweaks in `V.drop`, `V.gate`, `V.standings`, `placeMarshalS` (uses `CAMS.shot`, `CAMS.sees`, `CAMS.terrainAt`), the sky / shadow-box lines after the cams zone, `tags()`
(number tags: placement and size on screen), `crashPose` (the fall's trajectory and pose script), `surfY` / `trackXZ` (where the dirt is, for fallen riders).

## 5. Per-rider state (`st`)

One object per rider, `RST[i]` in `race3d.js`, refilled every frame by `rider()` (and `crashState()` for a fallen rider), passed to `poseRider(R, i, B, st)`, `FX.rider(st, dt)`, `world.dirt.frame(dt, RST)`.
Read it; write only in your zone and only fields your zone computes. SI units, metres, seconds, radians. World: +Y up; the track heading `th` points forward = `(cos th, 0, sin th)`, right = `(-sin th, 0, cos th)`.

| Field | Meaning |
|---|---|
| `i`, `seat` | index in the view's list; the game's seat number |
| `me` | true for the person's rider ("YOU") |
| `red` | true for the rider with the red plate (points leader; follows `V.setRed`) |
| `visible` | false once the rider is out of the race or hidden |
| `x`, `y`, `z` | world position of the bike frame's origin (the matrix translation: `y` = the frame height). While a rider is down: where the bike lies |
| `th` | **the BIKE's heading** (milestone 2, motion: the track's heading + the angle of its own path `psi`; the roost leaves the real rear wheel); the track's own heading is `rs[i].fr.th`. `yaw` = `-th` plus the whip in the air (the rotation about Y in the matrix). A fallen rider (`crashState`): `y` = the ground at the bike, `pitch` = 0, `th` = the track's heading at the bike, not the drawn lifted bike (motion asked for the drawn values; not applied: section 16) |
| `pitch` | bike pitch, + = nose up (includes weight transfer under throttle and brakes) |
| `lean` | bike roll, + = lean right (includes the air whip on the big jumps); the matrix angle |
| `v`, `acc` | speed along the track (m/s); its derivative (m/s^2) |
| `throttle` 0..1, `slip` 0..1, `roost` | derived by `FX.inputs` (the `fx` zone): power at low speed (acceleration x a low-speed factor + the gate launch), the rear wheel digging, how hard it throws dirt (`roost` 0..8) |
| `lat`, `s`, `D`, `onStart`, `k`, `tag`, `sand`, `gate` | lateral position on the track (+ right, m); distance along the lap (m); race distance (m); on the start path; track curvature (1/m, + right); the section (`"whoops"`, `"rhythm"`, `"jump"`, `"bigjump"`, `"rollers"`, ...); sand 0..1; riders still at the gate |
| `air`, `landed`, `impact`, `hAir` | an axle is on a jump arc; true on the frame the bike touches down; the downward speed just before it (m/s, 0 unless `landed`); the frame's height above the ground (m) |
| `gF`, `gR`, `tF`, `tR`, `gy` | the ride line under the front / rear wheel (with the whoops skim), the terrain under them, the lower of the two |
| `compF`, `compR` | suspension compression, fork / shock (m, + compressed, -0.12..0.28) |
| `spinF`, `spinR` | accumulated wheel spin (rad) |
| `stand`, `dab`, `crouch` | standing on the pegs 0..1; the inside foot out -1..1 (+ right); the crouch under load |
| `mud` | 0..1, kept between frames: +0.00058 a metre ridden (x3.5 in sand, + up to 0.03 on a hard landing) in the `bike` zone, + riding in another rider's roost in `FX.inputs` (clears about 1% a second). The bike's lower parts and the rider's boots, legs, gloves, chest and helmet front brown with it |
| `lodD`, `lodCut`, `bv`, `bq`, `cp` | the `bike` zone's own: the distance that picks the bike's level of detail, "the camera jumped", scratch vectors |
| `steer` | optional: the bars' angle (rad, + right); when absent `steerAngle` works it out from `k` and `air` (the hands follow it) |
| `crash` | `null`, or `{kind: "remount" \| "out", t: seconds since the fall, hx, hy, hz: the rider's hip}` |
| `body`, `limbs` | reserved for `poseRider`'s crash pose (null in normal riding) |

## 6. The view's live state for the cameras (`VIEW`)

Getters on an object `race3d.js` owns (always the current value; never assign): `VIEW.cam`, `VIEW.C` (the course), `VIEW.world`, `VIEW.rs` (the riders' records), `VIEW.gate`, `VIEW.marshal`, `VIEW.T` (the race clock, s), `VIEW.lapNo`,
`VIEW.lenLaps`, `VIEW.mode` ("gate" | "race" | "idle"), `VIEW.holdInfo` (a war: `{war: [seat...]}`), `VIEW.yellow` (`{lap, s0, len, s}`), `VIEW.lapPlan` (`{n, win, over, last, rank0}`), `VIEW.meSeats`, `VIEW.W`, `VIEW.H` (canvas size),
`VIEW.leaderIdx()`, and the read-only views the cameras' replay and tests need: `VIEW.st` (the per-rider state), `VIEW.R` (the riders' set: its meshes, `bones`, `boneTex`), `VIEW.FX`, `VIEW.flag`, `VIEW.finished`, `VIEW.tv`, `VIEW.replayOK` (false on the FIRE TV tier). A rider record `rs[i]` (read-only for the cameras): `gone, crash ({kind, T, D, ...}), crashPlan, onStart, D, s, v, k (index), seat, pos (Vector3: the hip point, +1 m for a bike), th, gy, bikeP, lapN`. Milestone 2 (motion): `D` is the DRAWN distance = `Dl` (the logical distance, from the cards' gap) - `sb` (the setback, >= 0, view only); `th` is the bike's heading (the track's is `fr.th`); new fields `Dl`, `Db`, `sb`, `Dq`, `P` (the start path's draw distance, negative = behind its first point), `vl` / `al` / `alF` (lateral speed, acceleration, filtered), `psi` / `psiHold` (the path angle), `sd` (pass sides), `cr` (the cards' order this lap), `jF` / `jR` / `jDone` (the jump arcs), `czone` (a crash ahead), `rem` (riding on from a remount), `vi` (this frame's own speed).
A camera that needs more of the view's state asks for a new getter (REQUESTS).

## 7. Couplings to keep in step (the split did not remove them)

- The dirt's shoulder shape (a drop of 0.55 m outdoors / 0.3 m in a stadium over a width of 2.6 m, wider beside a tall jump; the grass apron) is built by `trackMesh` (dirt) and mirrored by
  `heightGrid` (cams), `surfY` and `placeMarshalS` (lead). Change it in one place and the others follow through REQUESTS.
- The stadium bowl is a superellipse (`e = 4`, rounded corners) built in `stadium()` (stadium) and mirrored by `inFloor` (cams) and `C.layout.floor`. `world.ctx.hf` is the terrain height the cameras and the fallen riders stand on.
- `BIKE` (bike) feeds the suspension physics in `race3d.js` and the IK targets in `r3d-riders.js`.
- The riders' atlas (rider) draws three cells per rider (plate, jersey back, tag) from `list[k] = {num, color, accent, red, me}`; `drawPlate` (bike) draws the plate's face.
- Opaque parts are drawn in material-creation order (three.js sorts by `material.id`); exact depth ties between two parts flip with it. The split keeps the original order (the bike's materials, then the rider's).
- Everything three.js builds draws its UUID from `Math.random()` (4 calls each): one more Group, material or texture shifts a seeded `Math.random` by that many calls. The capture harness reseeds after the world is built (section 9).
- The rider's hands and knees follow the bike's own numbers: `BIKE.GRIP` / `PEG` / `SEAT` / `KNEE`, the bars' turn `steerOf(st)` (`steerAngle` x `BIKE.steerGain`) and the same turn for a plain point, `steerXYZ`, must stay the one rotation `steerMatrix` draws (bike) and `poseRide` aims at (rider).
- The dirt wraps `MXWar.Course.ground` once (`installGround`): the wheels, the camera's dirt tests, the fallen riders and the clods all see the dirt as drawn; the cameras' `heightGrid` is built AFTER the world (`CAMS.buildGrid()` in `setRace`) so it samples the wrapped function.
- The stadium's `ctx.bowlY(x, z)` (stands) and the cameras' `inFloor` (the e = 4 superellipse inside the bowl's e = 6) are the two halves of "no camera inside the stands"; the harness' own poses (B2) must be chosen against `bowlY` too (section 9.2).
- The replay (cams) records the riders' groups generically: a new per-instance attribute on a rider mesh is recorded by itself (any InstancedBufferAttribute of a mesh under `R.grp`); a new texture or uniform the riders' shader reads per frame (as the bone texture) must be added to `recBuild` / `replayFrame`.
- Particles are `FX.group`, a separate Group in the scene (they used to live in the riders' group). They are disposed and rebuilt with every race.

## 8. Behaviour that must keep working

The cards -> riders sync (`V.lap` moves each rider's gap to the new standings over the lap; no passing in the yellow section); real lap times (the race clock runs at 1x from the gate drop); crashes (a double-war loser crashes and remounts, a triple-war
loser crashes out and walks off, the marshal's yellow flag, no passing there the next lap); places 1..N in the results; the red plate; the war corner window (`V.hold`); phone and TV controls (the 3D view only draws; `game.js` owns the controls);
Reduce effects (`data-effects="reduced"`: a simpler world, no shadows, fewer particles, no antialiasing) and reduced motion (`data-motion="reduce"`: a still frame every 2 s, no camera moves); the no-WebGL fallback to the 2D track
(`supported()`, a lost context -> `hooks.lost`); paused while the page is hidden (`visibilitychange` stops the loop); progress saving and the season (untouched).

## 9. How to capture, prove and measure (the harness, the tools, the GPU result)

Written by the base step (2026-10-17). Everything runs the REAL game engine through the REAL view, in a browser that draws on this laptop's GPU. Nothing here is a mock-up.

### 9.1 What is where

| thing | where |
|---|---|
| the capture page | `<worktree>/mxwar/demo.html` + `demo.js` (the harness) + `demo-engine.js` (the real engine driver: the same drive as `game.js`) + `demo-bookmarks.json` (a copy of the plan). Frozen. `window.DEMO` is documented in `demo.js` and in the tools' README. |
| the plan: six bookmarks, extras, two recordings | `C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/bookmarks.json` (the tools read THIS file; `--plan <file>` takes your own extra views; never edit the master) |
| the tools and their README (every option) | `C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/tools/` |
| the BEFORE set | `C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/before/`: 12 stills (6 views x 2 sizes), the clips `R1` / `R2`, before-next-to-the-cover `compare/`, `perf.md` (counts the scene pass only), `before-manifest-whole-frame.json` and `perf-whole-frame.md` (the same pixels with the whole-frame counters: compare against these) |
| the base's own evidence | `C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/base/` (`after/` stills, `finish/` whole-race frames, `game/` real-game screens, `post/` post-slot check, `perf-whole-frame.md`) |
| the GPU browser | `C:/Users/Maverick/AppData/Local/Temp/jsdomtest/kit/browser-gpu.js` (the same API as `browser.js`; every tool uses it; `--soft` = the software kit: pictures only, its frame times mean nothing) |
| the cover and the crops | `C:/Users/Maverick/Documents/BG_audit/games/mxwar/visual-pack/Motocross_War_3D_Visual_Pack/01_FINAL_COVER_Motocross_War.png`, `Reference_Crops/` |

### 9.2 The race and the six fixed views

One race for everybody: the 2026 Supercross season, round 1 Anaheim, the Main, 22 riders, the person "YOU" = seat 12, the red plate on seat 0, engine seed 22, 24 laps of 53.7 s on the generated stadium layout (`sx-modern-v832`, 518 m), driven
through the view exactly as `game.js` drives it (the gate drop, the lap plans with the cards' results, the white flag, the yellow marshal), no menus, no HUD. The state is a pure function of the tick count: a virtual clock (`performance.now`, `Date.now`, timers) and a
`Math.random` seeded again every tick (three.js draws object UUIDs from it while it builds or first renders: a render must never shift the next tick's random numbers). `t` = race seconds after the gate drop. A bookmark's camera is a rigid mount set 3 ticks before its
frame (the view's blob shadows and shadow box read the previous tick's camera), so a frame never depends on what was drawn before it (`determinism.js` proves it). World: x east, y up, z south; the stadium floor is x -67.5..67.5, z -32..44; the whoops lane is z -5, the big jump z 19, the gate (-54.6, 33).

| id | view | t (s) | camera | what it shows |
|---|---|---|---|---|
| B1 | cover chase | 41.5 | rig on seat 15: back 3.5, up 1.5, side 0.9, aim {ahead 10, up 1.2, side -0.4}, fov 70 | the cover's framing: low behind a rider, riders ahead, the stadium lights in frame |
| B2 | stadium wide | 125 | eye [22, 18, 63] looking at [-6, 0, 2], fov 48 (MOVED 2026-10-17 from eye [0, 33, 92] at [0, 0, 4], fov 50: that eye is inside the new south upper deck, `bowlY(0, 92)` = 32.4 m there) | an elevated broadcast view from the lower stands, 6.6 m above the seats (`bowlY(22, 63)` = 11.4): the course and the pack across the floor, the far stands and the light rigs above, like `Reference_Crops/broadcast_overview` |
| B3 | whoops | 46 | eye [-8, 2, -12] at [8, 1, -5], fov 42 | the first-lap pack skimming the whoops head-on |
| B4 | jump | 77.5 | eye [6, 1.1, 34] at [10, 3.2, 19], fov 45 | six riders in the air over the triple |
| B5 | gate | 1.6 | eye [-60, 2.2, 24] at [-45, 0.9, 33], fov 50 | the launch from the start gate |
| B6 | crash | 111.5 | eye [4, 3, -12.5] at [-2, 0.7, -6], fov 52 | a double-war loser thrown over the bars, dust, the yellow flag |

Camera specs (`DEMO.camera(spec)`, a plan's `cam`): a rider rig `{seat: "you" | "lead" | "crash" | N | {rank: k}, back, up, side, aim: 8 | {ahead, up, side}, fov, damp}` (metres along / across the rider's heading, + side = the rider's right; `damp` 0 = rigid) or a world pose
`{eye: [x, y, z] | at: {s, lat, h}, target: [x, y, z] | look: {s, lat, h} | follow: {seat, up, damp}, fov}` (`at` / `look`: course distance s in metres, lat across, h above the dirt); `null` = the view's own director. The view applies it through `V.camHook` (section 4, zone `harness`).
Known limits: a camera inside the stadium bowl clips the near stands (a dark band): choose a pose against `world.ctx.bowlY(x, z)` (the eye at least 2.5 m above `y`); the old B2 / B2b / R2 eyes were such poses and were moved (`before/README-B2-moved.txt`, `bookmarks.v1-before-D2.json`); `DEMO.step(0, true)` (a redraw) moves the clock by one microsecond, so use it to grab a frame, not inside a plan;
the runner's CPU cap makes frame TIMES noisy, never the pictures.

### 9.3 Your cycle, with the exact commands

```bash
# once per Git Bash shell. <role> = your role name. Every browser run goes ONLY through the runner (never msedge by hand, never in the background).
run() { powershell -NoProfile -ExecutionPolicy Bypass -File "C:/Users/Maverick/Documents/Board Games/.dev/run-one.ps1" -Cmd "$1" -TimeoutSec "${2:-600}"; }
T=C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/tools
WT=C:/Users/Maverick/Documents/BG_mxV-<role>                    # your worktree: the folder that holds mxwar/ and ui/
OUT=C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/<role>     # your evidence folder (outside the repo)
BEFORE=C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/before
```

1. Lint (light, run it directly; exit 0): `cd "$WT" && node --expose-internals C:/Users/Maverick/Documents/BG_audit/sprint/mx3d-split/lint-modules.js mxwar/race3d.js mxwar/r3d-*.js`
2. The six stills at 1280x720 and 1920x1080 (about 45 s): `run "node \"$T/shots.js\" --root \"$WT\" --out \"$OUT/after\" --tag after" 600`
   (options: `--ids B1,B3`, `--sizes 1280x720`, `--quality high|medium|low|stick`, `--plan <your.json>`; writes `after-<id>-<name>-<size>.png` and `after-manifest.json` with the draw calls and triangles per frame).
3. What did I change (light, directly): `node "$T/pixeldiff.js" --before "$BEFORE" --after "$OUT/after" --out "$OUT/diff"` (differing pixels per frame; `DIFF-*.png`: red = changed). The base itself differs from `before/` by 0 pixels, so every difference is yours.
4. Next to the cover (ffmpeg only, directly): `node "$T/compare.js" --before "$BEFORE" --after "$OUT/after" --out "$OUT/compare" --sheet --label-after "AFTER: <what you changed>"` writes `cmp-B1.png` ... (before | after | THE COVER) and `cmp-sheet.jpg`.
   Then LOOK at them (Read the PNGs) the way the CEO will: the cover is the target; a frame that still reads as a toy next to it is not done.
5. The whole race to the checkered flag (about 1 minute; also with `--quality stick`): `run "node \"$T/finish.js\" --root \"$WT\" --size 960x540 --quality high --out \"$OUT/finish\"" 800`. Every check must PASS: both flags shown, the view's final order = the engine's standings,
   no page or console error, no blank frame, no leak. It saves four frames (first lap, white flag, checkered flag, finish).
6. Frame cost and budgets (about 3 minutes for 4 rows): `run "node \"$T/perf.js\" --root \"$WT\" --qualities high,stick --sizes 960x540,1920x1080 --seconds 8 --out \"$OUT/perf.md\" --tag after" 800`. Report your rows next to the base's (section 9.5); the JS calibration column says when the laptop was too busy to trust the times.
7. Clips, for the final captures only (about 1 minute each): `run "node \"$T/record.js\" --root \"$WT\" --rec R1 --out \"$OUT/after-R1-cinematic-chase.mp4\"" 600`, the same with `--rec R2` (stadium broadcast, then the director). Before | after | cover:
   `node "$T/compare.js" --videos "$BEFORE/before-R1-cinematic-chase.mp4,$OUT/after-R1-cinematic-chase.mp4" --out "$OUT/cmp-R1.mp4"`.
8. If you touched anything per frame, random or timed: `run "node \"$T/determinism.js\" --root \"$WT\"" 600` (the six frames must be byte-identical alone in a fresh page and in one session).
9. Once before you report, the REAL game page on a phone (3 minutes; no console error allowed): `run "node \"$T/game-flow.js\" --root \"$WT\" --out \"$OUT/game\"" 600`.
10. Lead only: `run "node \"$T/post-slot-check.js\" --root \"$WT\" --out \"$OUT/post\"" 300` (a post chain in the real view, the counters, the resize). Integrator: `MX_ROOT="$WT" node "$T/engine-tests/run-engine-tests.js"` (10 s) and `run "node \"$T/addons-check.js\" --root \"$WT\"" 300`.

Your own views and measurements (a node script; one browser per script):
```js
const L = require("C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/tools/lib.js");
const WT = "C:/Users/Maverick/Documents/BG_mxV-<role>", OUT = "C:/Users/Maverick/Documents/BG_audit/sprint/mxvis/<role>";
(async () => {
  const { b, info } = await L.openDemo({ root: WT, w: 1280, h: 720, plan: L.loadPlan(null), seed: 22 });   // the GPU browser + the demo page, booted (info.hook must say "native")
  try {
    await b.eval("DEMO.bookmark('B1',{draw:true});1");                                                    // or DEMO.camera({...spec, damp: 0}); DEMO.seek(t); DEMO.step(1/60, true)
    const url = await b.eval("DEMO.step(0,true);DEMO.grab('image/png')");                                 // grab in the SAME eval as the draw: the drawing buffer is not preserved
    L.saveDataUrl(OUT + "/mine.png", url);
    console.log(await b.eval("JSON.stringify(DEMO.stats())"), await b.eval("JSON.stringify(DEMO.memory())"));   // calls, triangles, textures, programs, heap; texture and geometry bytes
  } finally { await b.close(); }
})();
```
`DEMO.seek(t)`, `DEMO.step(dt, draw)`, `DEMO.skip(s)`, `DEMO.quality(name)`, `DEMO.size(w, h, pr)`, `DEMO.bench(n)`, `DEMO.live(true)` (the view's own requestAnimationFrame loop on the real clock), `DEMO.scan(seconds, every)` (when is a rider in a feature, in the air; the crashes) are in `tools/README.md`.

### 9.4 Quality tiers (the perf engineer, 2026-10-17)

Four tiers, names for people and for tools: `firetv` (FIRE TV), `balanced`, `high`, `ultra`. The old harness names still work everywhere (`--quality stick|low` = firetv, `medium` = balanced, `high` = high; `auto` = what this device would choose for itself).
`V.qualityNames()`, `V.setQuality(name)`, `V.quality()`, `V.bench(o)`, `V.benchResult()`, `V.warm()` (compile every shader of the scene now: call it once after `setRace`, while the line-up shows) are in the `[hook:perf]` zone after `V.fixPR`. `Q.skipFrame(t)` (true = skip this rAF callback) is the frame cap of a 30 fps target (FIRE TV; BALANCED on a TV): the view shadows `requestAnimationFrame` in its `[hook:perf]` zone so the loop draws every second vsync (an even 33 ms cadence, half the GPU work); 60 fps targets and the fixed-ratio tests are untouched. The capture tools now use the view's own names (`perf.js` runs the four tiers by default; `shots.js`, `finish.js`, `record.js` take `--quality firetv|balanced|high|ultra` or the old names).
**The `high` tier draws exactly the base's pixels** (the six stills at 1280x720 and 1920x1080: 0 differing pixels, 12 of 12); `firetv` builds exactly the old `stick` world (36 calls / 101,448 triangles at B1, 30 / 100,888 at the pack).

**The flag table.** Every field is in `Q.options(LO)` (builders) and the tier definition `TIERS[id]`. A builder reads what it knows and ignores the rest; **a specialist whose new feature costs more than the tier's budget gates it on the tier**, never builds it unconditionally:

| flag (`Q.options(LO)` field) | FIRE TV (`firetv`) | BALANCED (`balanced`) | HIGH (`high`) | ULTRA (`ultra`) |
|---|---|---|---|---|
| who it is for | Fire TV Stick / Lite / 4K class, old phones, Pi | mid phones, old laptops, integrated GPUs | new phones, Apple, good laptops | discrete GPUs, Apple M |
| frame rate the ladder holds (`fps`) | 30 | 60 (TV: 30) | 60 (TV: 60) | 60 (TV: 60) |
| `lo` (the simple world: fewer trees, small textures, ...) | true | false | false | false |
| `msaa` (canvas antialiasing; fixed when the renderer is made; milestone 2: `?msaa=0|1` overrides) | **true** (4x: resolved in a Mali's tile memory; this tier has no chain) | false (the chain's FXAA) | false | false |
| `res.maxPR` / `res.tvW` / `res.capW` / `res.start` | 1 (milestone 2: `maxPRtv` 2 on a TV) / 1280 / 1280 / 0.75 | 1.25 / 1280 / - / 1 | 1.75 / 1280 / - / 1 | 2 / 1920 / - / 1 |
| `shadow` real / map size / soft | blob only / 512 / false | real / 1024 / false | real / 1024 / false | real / 2048 / true |
| `post` on / bloom (scale) / aa / dof / shafts | false / no bloom / none / false / false | true / bloom(0.5) / fxaa / false / false | true / bloom(1) / smaa / false / true | true / bloom(1) / smaa / true / true |
| `fog` far scale | 0.75 | 0.9 | 1 | 1 |
| `fx.particles` (ring buffer size) | 160 | 360 | 520 | 900 |
| `crowd.detail` / `crowd.anim` | **0.7** / false (milestone 2: the lit crowd cards; Reduce effects keeps 0.35) | 0.7 / false | 1 / true | 1 / true |
| `scenery.trees` / `scenery.terrain` | 0.4 / 0.5 | 0.7 / 0.8 | 1 / 1 | 1 / 1 |
| `riders.full` / `mid` / `near` m / `far` m (the perf helper `createLod`; nobody consumes its levels yet) | 4 / 6 / 14 / 40 | 8 / 8 / 22 / 60 | 12 / 10 / 30 / 80 | 22 / 0 / 60 / 120 |
| **`riderHi`** (riders drawn as the full 3.9k-triangle model, by depth in view) / **`bikeLod`** (m: LOD 0 -> 1 [-> 2]) / **`dirtTier`** / **`replay`** (the cams' 7 s ring, about 25 MB) | 3 / [8] / lo / false | 4 / [6, 17] / hi / true | 6 / [8, 22] / hi / true | 10 / [12, 34] / hi / true |
| **`bikeHi`** (bikes allowed in LOD 0, the 21.8k-triangle level: the N nearest) | 0 | 2 | 4 | 8 |
| **`stadium`** (milestone 2 merge: `nearPeople` 3D front rows / `cardRows` cut-out rows on a tier with no crowd cards / `twinkle` / `roofBanks` / `heroSigns` / `shaftI`; Reduce effects and reduced motion: no front rows, no cut-out rows, no flashes) | 0 / 3 / on / 8 / 0 / 0.065 | 0 / 3 / on / 12 / 22 / 0.065 | 2 / 3 / on (an animated crowd has its own) / 18 / 22 / 0.065 | 3 / 3 / on / 18 / 22 / 0.065 |
| `tex.max` px / `aniso` / `budgetMB` | 512 / 1 / 24 | 1024 / 4 / 48 | 1024 / 8 / 96 | 2048 / 16 / 192 |
| budget: draw calls / triangles / geometry MB (whole frame) | 46 / **150k** / 6 (milestone 2: a Mali-G52 MC2 class stick) | 60 / 200k / 10 | 90 / 350k / 16 | 140 / 600k / 32 |

**Rules for builders.**
- Read `q.lo` for "the simple world" exactly as today (FIRE TV and Reduce effects). New detail goes behind a tier flag: crowd density and animation (`q.crowdDetail`, `q.crowdAnim`), trees and terrain (`q.trees`, `q.terrainDetail`), particle ring size (`q.particles`), texture size (`q.texMax`: choose the 512 / 1K / 2K file or canvas size from it), anisotropy (`q.aniso`, applied by `setAniso` at texture creation).
- Anything that moves at run time reads `q.live` / `QUAL.live` EVERY FRAME, not at build time: `live.particleScale` multiplies the roost / dust emission, `live.crowdAnim` stops the crowd's animation, `live.post` switches bloom / depth of field / the whole chain (a chain that is `on` only when `live.post.on`), `live.shadows` is the real shadow map (the view toggles `LOOK.setShadows` itself, and resizes the shadow map to `live.shadowSize`).
- Riders: the integrated riders choose their own detail by depth in view (`q.riderHi` nearest in-view riders in full, the rest the thin skeleton; `R.stats` {hi, lo}) and the bikes theirs (`q.bikeLod` distances, 8% hysteresis); `QUAL.lod.level[i]` / `st.lod` (the perf helper's own levels) is computed but nobody reads it. A bike or rider mesh is one instanced draw call per part type: keep it that way, draw calls (CPU) matter more than triangles on a Fire TV.
- Budgets (whole frame: the shadow pass counted): the last row of the table. `V.stats().calls / tris`, `DEMO.stats()` and the bench panel show them; `Q.budgetCheck(calls, tris)` says ok / over. Textures: `Q.memory(scene)`; the riders' number atlas (2048x640, 7 MB with mipmaps) was 43% of the texture memory and larger than the FIRE TV tier's 512: **on the FIRE TV tier it is now kept at half size (1024x320, 1.7 MB: that tier's textures went from 10.4 MB to 5.4 MB)**, the other tiers keep 2048x640.
- Do not change `renderer.setPixelRatio` / `setSize` yourself: the ladder owns them (it also resizes the post chain through `LOOK.resize` and redraws the frame at once, so a resolution step never shows a blank frame).

**Milestone 2 (perf, 2026-10-18).** The FIRE TV tier is the CEO's TV (a Fire TV Stick 4K Max class device: a Mali-G52 / G57 MC2 class GPU, 4 x Cortex-A55, 2 GB): 4x MSAA (the canvas; this tier has no post chain), the lit crowd cards (crowd 0.7; Reduce effects 0.35), 150k triangles, `res.maxPRtv` 2 (a TV WebView at DPR 2 now starts at 960x540, not 720x405). A TV stick (`data-tv`, at most 4 cores, at most 2 GB or unknown memory) is FIRE TV BEFORE the renderer is made (so it gets the MSAA canvas) and is never probed. THE LADDER cuts only when OUR frame is slow: the JS median over 70% of the target, or the GPU still busy at more than 35% of frame starts (a WebGL2 fence read at the next frame start), or two sampled costs over 85%; other late frames (runner stalls, 48 Hz callbacks, other processes) are counted in `ladder.external` and cut nothing. `gl.finish` runs only when an UP move is near, a try is watched, or a slow window is not yet known to be ours (quiet periods of 7 / 14 / 20 s after a no). A resolution step applies its effect flags at once and keeps the new size pending until the next camera cut (at most 2 s down, 6 s up), applied at the start of a frame (no blank frame). The ladder never switches the post chain itself off mid-race any more (that recompiled 26-28 programs: a 16.4 s freeze on HIGH here); a device still too slow at the floor is demoted for the next race. THE WARM-UP (`r3d-perf-warm.js`, section 3): `V.warm()` / `V.warmSync()`; measured here 0 programs compiled during a whole ladder walk (milestone 1: 59), the worst step on HIGH 16,363 -> 45 ms; the cost moved to the gate (the async warm: FIRE TV 0.43 s, HIGH 8.8 s on this laptop: the game must keep the line-up up until `V.warm()` resolves, REQUEST to the game integration). THE PASSIVE RECORD: `V.perfRaces()` (localStorage `mxwar.perf.races`, the last 6 races): the first real Fire TV numbers will come from it once the game shows it.

**How a tier is chosen.** (1) `?quality=firetv|balanced|high|ultra` (or `?tier=`; on the capture page `?q=`; the `data-quality` attribute of `<html>`; `V.setQuality(name)`). (2) A stored choice for this GPU string (localStorage `mxwar.quality.v1`, written after 20 s of calm and on every manual / auto change).
(3) The GPU string (`classifyGpu`: Mali-G31 / G51 / T-series, PowerVR GE8xxx, Adreno 3xx-5xx, VideoCore, old Intel HD = weak -> `firetv`; mid Mali-G5x/G7x, Adreno 6xx low, integrated Intel / AMD = `balanced`; Adreno 64x+, Mali-G77+, Apple = `high`; GeForce / Radeon RX / Apple M = `ultra`; a software rasteriser = `firetv`) then a GPU probe
(`probeGpu`: a fixed 960x540 workload timed with `gl.finish()` on the real clock, 11 frames; under 3 ms promotes a strong desktop GPU one tier, over 12 ms demotes one, over 30 ms two; a weak GPU is never probed). A TV with at most 4 cores and 2 GB is `firetv` whatever the GPU says. Reduce effects / reduced motion always force the FIRE TV flags.
When the ladder sits at its floor for 10 s and frames still run long, an automatic choice is demoted one tier (`Q.demote`) and the next `setRace` builds that tier's world.
`V.setQuality(name)` applies the run-time flags at once and rebuilds the world immediately when its build flags differ and the view is at the gate or idle (what the capture harness needs: it calls it right after `V.setRace`); during a race it keeps the world and the next `setRace` rebuilds.

**The ladder (adaptive resolution).** The render scale moves along 7 steps (`STEPS`) relative to the pixel-ratio cap of the tier and device; effects are cut in a fixed order as rungs of ONE chain: scale .9, .8, particles x.6, depth of field, bloom to half resolution, real shadows, scale .75, crowd animation, particles x.35, bloom, the post chain, scale .67, .6
(the cuts a tier has nothing to cut for are skipped; FIRE TV also has three rungs UP from its start of 0.75 x 1280 = 960x540). It holds 30 fps on a TV (FIRE TV always) and 60 elsewhere. Down: the 1.2 s mean frame time (slowest 6% dropped: a hitch is not a slow device) over 1.18 x the target on two checks in a row; the cost model picks how far (at most 3 rungs); the rung it left is banned for 3 dwells (21 s) and each repeat doubles the ban.
Up: after a dwell (7 s; 3 s with lots of room), the frame's own cost (sim + draw + a `gl.finish()` sampled every 30th frame) predicts at most 82% of the frame time one rung up, never above the 90 s decaying peak of that cost; a try is watched for 3.5 s and undone at once if its own samples exceed 97% of the frame time. `BG_audit/sprint/mxvis/perf/ladder-sim.js` runs the controller on 9 simulated devices: a static device converges in 1-3 moves within 10 s and then never moves; a load swing of +-22% settles in 3 moves; a 30 s load spike is followed by a recovery in 40 s.

**The in-game benchmark.** `?bench=1` on `mxwar/demo.html?live=1&q=auto` (a real race of the real engine, measured from the gate drop; `mxwar/assets/perf/bench.html` opens exactly that, with `?sweep=1` for all four tiers, `?quality=` to force one, `?seconds=` for another length) or on the game page (`mxwar/index.html?bench=1`: start any race, the first 20 s after the gate drops are measured).
It shows on the screen: tier and how it was chosen, target fps, fps average / 1% low / 0.1% low, frame ms average / p95 / p99 / max / share of frames on target, canvas size and render scale, calls, triangles, JS ms per frame, the frame's own cost, JS heap, textures (MB), the ladder's steps, the GPU string and the probe ms, device flags; PASS = average at least 95% of the target and 1% low at least 80% of it.
The result is `window.__MXBENCH`, a console line `[mxwar-bench] {json}`, localStorage `mxwar.bench.last` / `.history`, and `__mxv3.benchResult()`. `?bench=sweep` runs firetv, balanced, high, ultra one after the other (the page reloads between them; sessionStorage keeps the results) and ends with a table (`window.__MXBENCH_SWEEP`). `?fps=1` shows a one-line counter in any race.
OK / tap runs it again, Esc / Back closes it.

**Measure it.** `perf.js --qualities firetv,balanced,high,ultra --sizes 960x540,1920x1080` (frame cost per tier and size, fixed pixel ratio so the ladder is off); `DEMO.quality(name)` switches a page's tier (rebuilding the world); the ladder runs only on the view's own loop (`DEMO.live(true)`, or `?live=1`).
The runner's CPU cap decides how noisy a timing is (the calibration column says): compare ratios and the best-of columns, and trust calls / triangles / textures / memory always. The Fire TV Stick has still not been measured by anyone: `?bench=1` on the device is the measurement, and the probe ms it prints calibrates the thresholds above.

**Measured by the perf engineer (2026-10-17, Intel UHD on a shared laptop; `BG_audit/sprint/mxvis/perf/`).** The laptop was busy with the other builders (the runner capped this task at 10-67% of the CPU; every row prints its JS calibration, under 150 Mit/s = throttled), so the times are noisy and only ratios and the exact columns (calls, triangles, textures, geometry, programs) are facts. Fixed pixel ratio 1 (ladder off), race time 20 s, the director's camera, whole-frame counters (shadow pass included).

| tree | tier | size | calls | triangles | textures MB | geometry MB | programs | frame work ms (best 30 of 90 / avg) | fps if vsync-free | calib |
|---|---|---|---|---|---|---|---|---|---|---|
| merged | firetv | 960x540 | 31 | 131003 | 10.4 | 2.4 | 22 | 20.7 / 32.5 | 48.3 | 179 |
| base | firetv | 960x540 | 26 | 100860 | 3.2 | 3.1 | 20 | 18.6 / 21.5 | 53.7 | 153 |
| merged | balanced | 960x540 | 70 | 819306 | 17.7 | 11.7 | 34 | 38.2 / 49.0 | 26.2 | 129 (throttled) |
| merged | high | 960x540 | 75 | 832426 | 17.7 | 11.8 | 40 | 27.5 / 48.8 | 36.4 | 30 (throttled) |
| base | high | 960x540 | 39 | 198190 | 8.9 | 5.7 | 25 | 29.8 / 40.4 | 33.6 | 161 |
| merged | ultra | 960x540 | 75 | 842602 | 18.4 | 11.9 | 40 | 34.3 / 46.6 | 29.2 | 129 (throttled) |
| merged | firetv | 1920x1080 | 31 | 131003 | 10.4 | 2.4 | 22 | 15.4 / 27.1 | 64.9 | 167 |
| base | firetv | 1920x1080 | 26 | 100860 | 3.2 | 3.1 | 20 | 22.6 / 27.8 | 44.2 | 122 (throttled) |
| merged | balanced | 1920x1080 | 70 | 819306 | 17.7 | 11.7 | 34 | 76.9 / 92.4 | 13.0 | 179 |
| merged | high | 1920x1080 | 75 | 832426 | 17.7 | 11.8 | 40 | 68.0 / 91.1 | 14.7 | 134 (throttled) |
| base | high | 1920x1080 | 39 | 198190 | 8.9 | 5.7 | 25 | 26.4 / 30.6 | 37.8 | 65 (throttled) |
| merged | ultra | 1920x1080 | failed |

- `base` = the studio's `mxvis` (high = today's full look, stick = the old Fire TV proxy); `merged` = a trial merge in a scratch worktree of every specialist's committed branch (lead, rider, bike, dirt, cams, stadium, fx) + perf: clean, no conflict in any file, the hook zones held, lint clean, boots with 0 errors on all four tiers. The merged frame depends on the camera far more than the base's: at the cover chase (B1) HIGH is 69 calls / 223k triangles and BALANCED 65 / 210k, but with the director's camera at t = 20 s (this table) HIGH / BALANCED / ULTRA are 70-75 calls / 819-843k triangles, because the wide shots see the whole bowl: about four times the base's triangles (shadow pass included) and over the BALANCED budget (60 calls / 200k) and the HIGH triangle budget (350k). The FIRE TV frame is 31-38 calls / 99-131k triangles: inside its call budget (46), 19% over its triangle budget (110k) in the worst view measured. Programs: 22-42 against the base's 20-25 (shader compile hitches on a weak GPU: call `V.warm()` while the line-up shows). Timings: only a row whose calibration is not THROTTLED means anything; merged HIGH at 1920x1080 (calib 134) and BALANCED at 1920x1080 (calib 179) cost 68 and 77 ms of frame work here against 26 ms for the base's HIGH: the merged HIGH / BALANCED tiers would run this laptop's iGPU at 1080p near 13-15 fps with the ladder off, and 26-36 fps at 960x540; the merged FIRE TV frame costs about what the base's did (20.7 against 18.6 ms at 960x540).
- Anatomy of the base's cheapest frame (diag-cost.js, stick, 960x540): JS submit 0.7 ms, simulation 0.3 ms, the rest is the GPU side: about 4-6 ms that does not shrink with the resolution (36 calls, 101k non-indexed triangles, the sync) plus about 5 ms per megapixel of fill; the riders are 77% of the triangles but hiding them saves only 1.7-3 ms, the crowd 0.4-3.9 ms, the shadow pass 0-3 ms. With the main thread slowed 6x (CDP `Emulation.setCPUThrottlingRate`) the frame goes from 6.9 to 15.5 ms plus 3.4 ms more of simulation: a CPU about 6x slower than this laptop's still fits a FIRE TV frame in 33 ms, the GPU side is the unknown.
- The Fire TV Stick has NOT been measured. This laptop's GPU is roughly 15-30x a Mali-G31 MP2 in ALU and several times in bandwidth: if the 4-6 ms fixed part scaled 10-20x the cheapest tier would need 40-120 ms, which no resolution step can fix. That is why the FIRE TV tier is the smallest frame the specialists must hold (46 calls / 110k triangles / 24 MB textures), why the ladder starts it one step low on a known-weak GPU, and why the first number that matters is `?bench=1` run on the device (it prints the probe ms and the frame work ms; those two calibrate everything above).

### 9.5 The GPU result (this laptop, measured 2026-10-17 14:15, the base's pixels)

- The laptop's GPU works headless: Edge started with `--use-angle=d3d11 --ignore-gpu-blocklist` renders WebGL2 on `ANGLE (Intel, Intel(R) UHD Graphics (0x000046D2) Direct3D11 vs_5_0 ps_5_0, D3D11)`: WebGL 2.0, max texture 16384, anisotropy 16, no GPU timer queries.
  Stills and frame times from `browser-gpu.js` are real GPU output. The plain `browser.js` is the SwiftShader software rasteriser (its pictures are the same up to rasteriser differences, its frame times are meaningless).
- The view today, per frame, at the race's lap-1 pack (22 riders; counters = the whole frame since the base step; `perf-whole-frame.md` has every column):

| tier | canvas | calls | triangles | textures (MB) | geometry (MB) | programs | sim + draw + GPU sync, best 30 of 90 frames | live fps over 10 s (p50 / p95 frame ms) |
|---|---|---|---|---|---|---|---|---|
| high | 960x540 | 43 | 198,218 | 16 (8.9) | 5.7 | 25 | 21.1 ms (47 fps); mean 26.9 | 49.5 (17 / 37) |
| high | 1920x1080 | 43 | 198,218 | 16 (8.9) | 5.7 | 25 | 23.8 ms (42 fps); mean 27.8 | 24.0 (27 / 64) |
| medium | 960x540 | 31 | 120,338 | 16 (8.9) | 5.7 | 30 | 19.6 ms (51 fps); mean 21.0 | 64.4 (4.5 / 28.6) |
| medium | 1920x1080 | 31 | 120,338 | 16 (8.9) | 5.7 | 30 | 20.2 ms (49 fps); mean 23.4 | 32.8 (20 / 39) |
| low | 960x540 | 30 | 100,888 | 16 (3.2) | 3.1 | 20 | 14.0 ms (72 fps); mean 14.9 | 69.0 (9.4 / 25) |
| low | 1920x1080 | 30 | 100,888 | 16 (3.2) | 3.1 | 20 | 26.3 ms (38 fps); mean 27.3 | 34.8 (16.6 / 48) |
| stick | 960x540 | 30 | 100,888 | 16 (3.2) | 3.1 | 20 | 11.9 ms (84 fps); mean 13.1 | 66.4 (10.6 / 23) |
| stick | 1920x1080 | 30 | 100,888 | 16 (3.2) | 3.1 | 20 | 19.2 ms (52 fps); mean 21.5 | 50.7 (14.7 / 26.5) |

- How to read it. The simulation costs 0.3-0.5 ms per frame; everything else is drawing and waiting for the GPU. Real shadows add 12 draw calls and 78k triangles (39% of the frame's triangles) and about 1.5-6 ms here (the high rows minus the medium rows, noisy). The runs share the laptop (the runner caps this task at 22-54% of the CPU and
  other agents use the GPU), so a row moves by up to 30% from run to run (high 960x540 measured 20 ms in one run and 27 ms in the next): trust ratios and the budget columns, and treat a row whose calibration says THROTTLED (under 150 Mit/s) as unreliable. `stick` at a 1920x1080 canvas
  draws 960x540 internally (the TV cap) and is then scaled up, so it costs a little more than the 960x540 canvas. The JS heap stays between 11 and 33 MB; the textures hold 8.9 MB (3.2 MB with Reduce effects).
- What it does NOT tell us: the Fire TV Stick has NOT been measured; no Stick was available to the studio. The harness author's estimate is a Mali-G31 MP2 GPU at roughly 1/10 to 1/20 of this laptop's and a CPU several times slower; if a frame that costs 12-14 ms here costs 5x (CPU-bound) to 20x (GPU-bound) there, today's cheapest tier would run at 4-15 fps on a Stick:
  an extrapolation, not a measurement. `detectWeakGPU` already switches real shadows off on that GPU class. Until a Stick (or a throttled run: Chrome DevTools `Emulation.setCPUThrottlingRate` plus a GPU-only microbenchmark) is measured, nobody states a Stick frame rate as fact.
  The first perf task is to find what the 12 ms of the cheapest tier is (JS draw submission, driver, GPU), then to budget against it.
- Budgets to hold or lower (and report your delta against): the `stick` row (30 calls, 100.9k triangles, 16 textures / 3.2 MB, 3.1 MB geometry, 20 programs) and the `high` row (43 calls, 198k triangles, 8.9 MB textures, 5.7 MB geometry, 25 programs). Quality that costs more than that belongs in the `high` tier,
  gated by `Q.options(LO)` and the adaptive ladder, never in `stick`.

### 9.6 What counts as evidence

- Only captures from the running view count. Concept art is never "gameplay"; the cover is the TARGET, so every judgement is a frame of yours next to the cover (step 4). A before / after pair is the same bookmark at the same size on the same race (step 3 shows exactly what moved).
- A report carries: at least three real stills (absolute paths), `finish.js` PASS for `high` and `stick`, the `perf.js` rows against the base, the clips for the final captures, and a plain list of what is still short of the cover. A failing check or a missed target is reported with its numbers, not hidden.
- The Quality Director runs steps 2-5 on each branch itself and judges the pictures, not the report. Fix the largest visible shortcoming first: the machines and riders before decoration, the dirt before the menus.

### 9.7 The older scenario captures (software GL, 10 scenarios, 84 frames in 60 s)

Everything is at `C:/Users/Maverick/Documents/BG_audit/sprint/mx3d-split/`. `node cap.js <TAG> S,O,H,C,L,M,P,R,N,T /BG_mxV-<role>` (through the runner; give the scenarios, then your tree relative to `C:/Users/Maverick/Documents`) captures a stadium lap (S), an outdoor track (O),
a speedway hybrid (H), a crash lap with a remount, the yellow flag and a crash-out (C), Reduce effects (L), reduced motion (M), a portrait phone (P), a restored race with the game's helper calls (R), three races in one view (N) and a TV (T) with a seeded `Math.random` and a fake clock;
`node cmp.js join <TAG>` compares your set with the reference `out/join` (the base, 84 frames) pixel by pixel and prints the state and shot choices too (`DIFF-*.png`). These scenarios are what proves "Reduce effects, reduced motion, portrait, outdoor, the restored race, a new race in the same view still work".
`api-check.js` runs the view's test API (`V.sweep`, `V.proj`, `V.camInfo`, `V.stats`, `V.order`, `V.setShadows`, `V.fixPR`, `V._dbg.*`, `V.dispose`) on two trees and prints SAME / DIFF per call. Frame times in software GL mean nothing.

### 9.8 What the base proved (2026-10-17)

- The joined branch draws the BEFORE set: the six bookmarks at 1280x720 and 1920x1080 on the GPU, 12 of 12 frames with 0 differing pixels (`pixeldiff.js`); the same six frames are byte-identical alone in a fresh page and in one session (`determinism.js`, two browsers).
- The split's 84 software-GL frames over 10 scenarios: 0 differing pixels against the split's own set, with the same state and shot choices (the draw-call and triangle counters differ by design: +12 calls and about +78k triangles where real shadows are on, the shadow pass now being counted).
- The whole race on the GPU, `high` and `stick`: 24 laps (about 21.5 minutes of race time, about 40 s of wall time), 4 crashes with remounts, 4 yellow-flag laps, the white and checkered flags, the view's final order = the engine's standings, 22 places each once, 0 page errors, 0 console errors or warnings,
  geometry and texture counts level off after the first laps (41 / 18 at 200 s, 41 / 19 at the end), no blank frame.
- The real game page on a phone: setup -> season -> line-up -> the 3D gate -> the drop -> 8 real-time laps (clock 1.00) -> the flag -> the results sheet with places 1..20 once each; 0 console errors or warnings. The five engine test suites pass (fuzz of 300 races: 732 crashes, 670 remounts, 62 crash-outs).
- The 56 vendored add-ons import and every pass renders (GTAO, SSAO, SAO, film, afterimage, outline, LUT, TAA, SSAA, bloom, bokeh, SMAA); an EffectComposer in the real view through `L.post` draws the frame (mean difference to the plain frame 2 of 255: the bloom only), the counters add up over the passes, a resize reaches the chain.
- Lint: 10 modules, 0 undeclared identifiers, every import resolved. `record.js` writes H.264 clips through the native camera hook.
- What the base did NOT prove: any frame rate on a Fire TV Stick or a phone (section 9.5); that the new look will fit the Stick's budget (nothing new exists yet); the game-integration step (menus, Party Mode, the HUD over the new look) beyond the one real heat above.

## 10. What the split changed in the code (for the integrator)

- New: `r3d-util.js`, `r3d-look.js`, `r3d-quality.js`, `r3d-track.js`, `r3d-bike.js`, `r3d-fx.js`, `r3d-cams.js`. Rewritten from slices: `r3d-world.js`, `r3d-riders.js`, `race3d.js`. `sw.js`: the new files are cached, `mxwar-v7`.
- `r3d-cams.js`: the closure variables of the old `create()` (`C`, `rs`, `T`, `lapNo`, `mode`, `world`, `gate`, `marshal`, `yellow`, `lapPlan`, `holdInfo`, `meSeats`, `lenLaps`, `W`, `H`, `leaderIdx`) are read as `VIEW.name`; nothing else in the camera code changed.
- Particles: made by `createFx` (they were part of the riders' group, `R.part`); the emission rules (landing dust, roost, the crash bursts) are `FX.rider`, `FX.crashStart`, `FX.crashStep`, same Math.random order. `emit` / `stepParticles` take the particle system instead of `R`.
- `poseRider` is `poseBike` (bike) + the rider's pose. `hideRider` is `hideBike` + the rider's parts. Mesh casting flags are set where the meshes are made.
- Per-rider state: `st` objects (section 5) replace the literal that `poseRider` used to get. New fields (`throttle`, `slip`, `roost`, `landed`, `impact`, `mud`) are derived values; nothing reads them yet except `FX.rider` (`roost`, `landed`).
- Quality: `QUAL.options(LO)` replaces `{lo: LO}` at the three builders; `QUAL.pr` / `QUAL.prCap` / `QUAL.stats.prDrops` feed `V.stats()`.

### What the base step changed (for the integrator)

- `race3d.js`: the two `[hook:harness]` zones (`V.camHook`), an empty `[hook:perf]` zone after `V.fixPR` for `V.qualityNames()` / `V.setQuality()`, `V._dbg.look()` / `quality()` / `cams()`. Nothing else.
- `r3d-look.js`: `L.render` resets `renderer.info` once per frame and leaves `autoReset` off, so calls and triangles are the whole frame (the shadow pass and every pass of a post chain). The pixels are unchanged.
- New: `mxwar/demo.html`, `demo.js`, `demo-engine.js`, `demo-bookmarks.json` (the harness; not part of the game, not in `sw.js`), `ui/vendor/three-addons/` (56 files, MIT), the "base" section of `mxwar/assets/LICENSES.md`.
- `sw.js` is unchanged (`mxwar-v7`): scripts are fetched network-first, so the service worker serves the new view without a version bump; bump it at release, and add every `three-addons` file a merged module imports.

## 11. The look (lead, 2026-10-17): the light rig, the post chain, the environment map, the material kit, the quality flags

What the lead built (branch `mxvis-lead`; files `r3d-look.js`, `r3d-lead-post.js`, `r3d-lead-env.js`, `r3d-util.js` (the kit), the lead lines of `race3d.js`, `sw.js`). Every effect is one flag; a TIER is a named set of flags.

### 11.1 The light rig (`r3d-look.js`)

A stadium at night, lit like the cover: `L.sun` = THE KEY (a hard warm-white floodlight, intensity 6.8, from the south-west at 30 degrees: raking light, long shadows, the only light that casts real shadows; PCF-soft 2048 on high, PCF 1024 below),
`L.rim` = a warm rim light AHEAD of the camera (turned 28 degrees to its right, 26 degrees up: it cuts helmets, shoulders and fenders out of the dark), `L.kick` = a soft cool fill from BEHIND the camera (the jersey numbers stay readable),
`L.bounce` = the warm light off the dirt, pointing up (undersides), `L.hemi` = blue sky over a warm ground, `L.fill` = a cool world-fixed fill. `rim` and `kick` follow the camera (`L.frame(cam, target, dt, tw, subjD)`, every frame,
called by `race3d.js` after the camera is placed). The shadow box (`L.fitShadow`) is unchanged: fitted to what the camera looks at, snapped to texels. Real shadows fall on the dirt from the bike and rider parts, and every instanced body part now
RECEIVES the key's shadow too (`L.receive(R.grp)`: the helmet's shadow on the shoulders). Stadium air: `FogExp2` (density 0.0042, deep blue) on the high / medium tiers; the venue's own linear fog on low / stick and outdoors by day.

### 11.2 The post chain (`r3d-lead-post.js`, installed in `L.post` by the tier)

The scene is drawn into a half-float HDR target (three.js applies no tone mapping to a target), then: **bloom** (dual filter, 4 levels, soft threshold at linear 1.35, knee 0.45) -> ONE final pass: **depth of field** (a half-resolution gather pass, for the close camera only: the subject is the rider
nearest the middle of the picture within 34 m, `subjectDist()` in `race3d.js`; the near field blurs fully, the far field at most 42 %, no blur in wide shots), **camera motion blur** on whatever is nearer than the subject (the dirt streaming past the lens), **height haze** (a warm dust glow near the ground,
cool air above, added light) and a **sky glow** over the horizon, the bloom, **ACES filmic** tone mapping, a **grade** (cool blue shadows, warm gold highlights, saturation 1.02, an S-curve 0.62), a **vignette**, **film grain** (24 per second, hashed from the clock: deterministic in the harness) and **FXAA** inside the same pass
(on edges only, averaged in a tone-compressed space so a 30x-bright light still blends), then sRGB. SMAA (three passes, the best edges) is available as `aa: "smaa"`. NaN / Inf from any shader is clamped away. A cut (the camera jumps more than 2 m) snaps the focus and drops the motion blur for that frame.
The targets follow the DRAWING-BUFFER size every frame (the adaptive pixel-ratio ladder changes it behind our back: the chain rebuilds its targets). `postSupported(renderer)` (WebGL2 + a float colour buffer) gates the whole chain: no support = the plain frame.

### 11.3 The flags and the tiers (the performance engineer switches them: `L.setTier(name)` / `L.setFlags({...})`; `L.flags` is live, `L.tiers` is the table)

| flag | meaning | high | medium | low | stick |
|---|---|---|---|---|---|
| `post` | `"full"` (HDR + bloom + depth effects) / `"lite"` (HDR + bloom + grade) / `"off"` (the renderer's own frame) | full | lite | off | off |
| `bloom` | strength 0..2 (0 = no bloom passes at all) | 1 | 0.75 | 0 | 0 |
| `dof` | depth of field (needs the depth texture) | on | off | off | off |
| `motionBlur` | foreground motion blur 0..2 (needs the depth texture) | 1 | 0 | 0 | 0 |
| `haze`, `hazeI` | height haze density and intensity (also the sky glow); 0 = off | 0.011, 1 | 0 | 0 | 0 |
| `aa` | `"fxaa"` (inline, almost free) / `"smaa"` / `"msaa"` (a 4x target: cheap on tiled GPUs, slow on this laptop; not with the depth effects) / `"none"` | fxaa | fxaa | none | none |
| `grade`, `vignette`, `grain` | colour grade 0..1, vignette 0..1, film grain 0..0.1 | 1, 0.34, 0.035 | 1, 0.30, 0 | 0 | 0 |
| `rig` | `"full"` (key, rim, kick, bounce, hemi, fill) / `"lite"` (key, hemi, fill, ambient) | full | full | lite | lite |
| `shadowRes`, `softShadow` | the key's shadow map size and the PCF-soft filter (the real shadows themselves are `L.setShadows` / the ladder). Polish step: HIGH is 1024 plain as the quality table says (it drew a 2048 soft map); the new look tier `ultra` (race3d.js `LOOKTIER.ultra`) keeps 2048 soft | 1024 | 1024 | 1024 | 1024 |
| `bloomDiv` | the bloom's first level is 1/bloomDiv of the frame (4 = a quarter: about 4x less bloom work than the old half-resolution chain; `ultra` keeps 2) | 4 | 4 | - | - |
| `env` | the environment map for physically based materials | on | on | off | off |
| `pbr` | `L.upgrade`: Physical stand-ins for Phong parts; also the material kit's tier | on | on | off | off |
| `fog` | `"exp"` (FogExp2 at night) / `"lin"` (the venue's) | exp | exp | lin | lin |
| `exposure` | a multiplier on the venue's exposure | 1 | 1 | 1 | 1 |

Nobody has to call `setTier`: `L.apply` picks one when a race starts: a TV = `stick` (the Stick's model is NOT measured: no post chain until a device is), Reduce effects or a weak GPU = `low`, a touch device = `medium`, anything else = `high`.
The harness' `DEMO.quality("medium")` (real shadows off) does not change the look's tier: use `look.setTier("medium")` for the lite chain (`lead-shots.js`, `lead-prof2.js` in `BG_audit/sprint/mxvis/lead/tools/`). `L.info()` says what is on.

### 11.4 The environment map (`r3d-lead-env.js`)

`makeEnvironment(renderer, {kind: "night" | "day", key, seed}) -> {rt, dispose}`: a procedural night stadium (a dark dome, a warm dirt floor, a crowd band of speckles, ten light banks at 26-34 degrees, a 46x floodlight where the key is, two more up to the sides) drawn once into a PMREM cube
(256 px, about 30 ms, once per venue kind). `scene.environment` lights every `MeshStandardMaterial` / `MeshPhysicalMaterial` by itself (`material.envMapIntensity` scales it; three.js r160 has no `scene.environmentIntensity`). Lambert / Phong / Basic materials ignore it.

### 11.5 The material kit (`r3d-util.js`) for the bike, rider, dirt and stadium specialists

`import {MAT, material, setKitTier, getKitTier} from "./r3d-util.js"`: `MAT.gloss(color, opts)` (painted plastic, clear coat), `MAT.plastic`, `MAT.rubber`, `MAT.paint` (painted metal), `MAT.anodized`, `MAT.chrome(opts)`, `MAT.steel(opts)`, `MAT.fabric` (sheen), `MAT.leather`, `MAT.visor(opts)`, `MAT.dirt`, `MAT.mud`;
`opts` go to the constructor (`vertexColors`, `map`, `normalMap`, `side` ... override the preset; `env` scales its environment strength); the preset table is in the file. The kit tier (`high` = MeshPhysicalMaterial, `mid` = MeshStandardMaterial, `low` = Lambert / Phong with no environment map) follows the look's tier (`setKitTier` runs in `setFlags`).
Materials made with the kit take the tier that is current when `buildWorld` / `createRiders` run (a new race). Instanced parts with `onBeforeCompile` patches work on Standard / Physical too (the chunks have the same names).
`L.upgrade(root)` (called by `race3d.js` for the riders' group) swaps every MeshPhongMaterial under root for a Physical stand-in (`pbrFromPhong`) on the high / medium tiers and back on the others: it keeps the base bike and helmet reflective until the bike / rider specialists use the kit; materials that are already Standard / Physical are left alone.

### 11.6 HDR conventions every specialist needs

- Everything is drawn in linear HDR and tone-mapped at the end: a light that should GLOW must output more than 1.2 in linear (a sprite's colour times 3, a `MeshBasicMaterial` colour `setRGB(4, 4, 3.6)`); bloom starts at 1.35 with a soft knee of 0.45. White blocks and plates under the key reach about 1.4-1.7: they still glow a little (the lane blocks look neon: make them greyer). A light sprite that is not HDR-aware (peak at most 1.0, like the stadium's star sprites of the first merge) will not bloom: multiply its colour by 2-3.
  The light-bank glows that existed before (colour at most 1.05) are scaled x2 by `L.apply`, once (`material.userData.hdr` marks a material that is already HDR-aware).
- A shader that outputs NaN or Inf (for example `pow(x, 1.6)` with x slightly below 0: the stadium's light beams do) is clamped to 0 in the chain (Direct3D drops a NaN in `min` / `max`; `isnan()` is folded away by its compiler and warns X3577).
- Do not rely on `renderer.toneMapping` with the chain on: three.js ignores it for targets; `renderer.toneMappingExposure` is read by the final pass.

### 11.7 What the lead measured (this laptop, Intel UHD 0x46D2, the interleaved minimum of 3 rounds, the other lanes' load included: ratios, not absolutes; `lead/prof2-final.md`, `lead/perf-final.md`)

| ms per frame (sim + draw + GPU sync) | 1280x720 | 1920x1080 |
|---|---|---|
| plain frame, the new light rig (`post: "off"`) | 18.5 (54 fps) | 27.4 (37 fps) |
| stick tier of the look (lite rig, no post; the world here is the full one, not the Reduce effects world) | 15.1 (66 fps) | 22.7 (44 fps) |
| medium (HDR + bloom + grade + inline FXAA) | 19.1 (52 fps) | 32.4 (31 fps) |
| high (everything) | 27.3 (37 fps) | 52.3 (19 fps) |
| high without depth of field | 24.6 | 42.2 |
| high without depth of field, motion blur and haze (no depth texture) | 21.7 | 38.2 |

So: `medium` costs +0.6 ms at 720p and +5 ms at 1080p; `high` costs +9 ms at 720p and +25 ms at 1080p (depth of field about 3 / 10 ms of it, the depth texture and haze / motion blur about 3 / 4 ms): `high` is a laptop / tablet tier at 720p-class render sizes; at 1080p the adaptive ladder must lower the pixel ratio (the chain follows it: it rebuilds its targets
from the drawing buffer, about 50 MB at 1080p). The whole-frame counters: high 52-58 draw calls (the base 43), medium 51-57, stick 30; triangles do not change (198.2k high, 100.9k stick). The official `perf.js` rows (contended run, calibration under 150): high 960x540 22.6 ms (the base 21.1), high 1920x1080 61.3 ms (the base 23.8), stick 960x540 17.9 ms, stick 1920x1080 18.4 ms.
Nothing here is a Fire TV or a phone measurement: the Stick runs `stick` (no post chain) until a device says otherwise.

## 12. The integrated build (the merge step, 2026-10-17: what is on `mxvis` now)

Written by the integration step (label `integrate:merge`, from 18:18). Sections 3-7 above already describe the integrated modules; this section is what the merge decided, changed, tested and left open.

### 12.1 What merged, in which order, and how

`git log --oneline mxvis`: the base `ac4b1bf` -> perf (8 commits) -> lead (9) -> dirt (4) -> stadium (5) -> bike (6) -> rider (5) -> fx (6) -> cams (6) = 49 specialist commits, each CHERRY-PICKED in that order (`git cherry-pick ac4b1bf..mxvis-<role>`): a LINEAR history, no merge commit, each owner's version winning in its own files; then the integration commits (12.2).
- ONE conflict in the whole series: `CONTRACT.md`, the dependency lines (lead's `r3d-look.js <- util, lead-env, lead-post` vs perf's `r3d-quality.js <- util, perf-bench`): both kept. `race3d.js` auto-merged on every pick (the hook zones did what they were for); `r3d-util.js`, `sw.js`, `LICENSES.md` merged without a conflict (different hunks).
- A slip of the integration, caught at once: the first resolution of that conflict was committed WITH its markers (a regex that did not know CRLF); the lead's contract commits were reset and re-picked (`git grep` finds no marker in the tree). Working copies are CRLF (`core.autocrlf`), the index is LF.
- The lead's dry run (`BG_mxV-lead-int`, branch `mxvis-lead-int`: merge commits, one conflict) agreed with this result and was deleted after the merge was committed and tested; the specialists' branches and worktrees (`BG_mxV-<role>`) are untouched.

### 12.2 What the integration commits changed

| File | What |
|---|---|
| `r3d-quality.js` | the tiers carry `riderHi` (3 / 6 / 8 / 12), `bikeLod` (`[8]` / `[7,30]` / `[9.5,36]` / `[12,45]`), `dirtTier` (lo / hi / hi / hi), `replay` (false on FIRE TV); `Q.options(LO)` returns them (9.4 table) |
| `r3d-riders.js` | `createBike(n, lo, mk, opts)`: the bike's level-of-detail distances come from the tier; **the lead's material kit on the riders' gear**: cloth = `MeshStandardMaterial` (rough 0.9, env 0.5), helmet = `MAT.gloss` (clear coat, reflects the floodlights), the kit tier decides (low / Reduce effects keep Lambert / Phong); the riders' own rim light lowered to 0.16 / 0.08 where the kit is on (the lead's rim and the bloom do that work); **the number atlas is kept at half size on the FIRE TV tier** (`q.texMax` 512: 1024x320, 1.7 MB instead of 7 MB; `setRed` redraws it at the same scale) |
| `r3d-rider-pose.js`, `r3d-bike.js` | **hands on the steered grips** (`steerOf(st)` + the new `steerXYZ`), `BIKE.steerGain = 1`, **knees pressing on `BIKE.KNEE`** (the leg IK's pole turns toward it), `BIKE.SEAT` kept |
| `race3d.js` | `supported()` = WebGL2 and not `?gl=0`; `VIEW.replayOK`; **`st.mud` has ONE physical source** (the bike zone: distance, sand, landings) + the roost in `FX.inputs`: the rider branch's time-based rise toward 1 (50 s) was removed, it would have caked every bike and rider after two laps on top of the bike's own build-up |
| `game.js` | `webgl()` = WebGL2 + `?gl=0` (the 2D track); `V3.warm()` after every `V3.setRace` (compile every shader while the gate shows). Nothing else: the engine, saves and controls are untouched |
| `sw.js` | `ASSETS` lists every new module and asset: `r3d-perf-bench`, `r3d-dirt-png`, `r3d-dirt-relief`, `assets/dirt/dirt-tiles(-lo)`, `r3d-stadium-bowl`, `r3d-stadium-art`, `r3d-bike-model`, `r3d-rider-model`, `r3d-rider-pose` (the lead's entries were in): checked against the import graph from `race3d.js`; `VERSION` NOT bumped |
| `r3d-util.js` | `setAniso` caps at 16 (ULTRA asks for 16) |
| `r3d-stadium-bowl.js`, `r3d-look.js` | **HDR glow sprites**: a `uHdr` gain (2.5 with the bloom chain, 1 on the plain frame): the floodlights bloom and star on HIGH / BALANCED, no clipped blobs on the TV tier. The `pow(vF, ...)` guards are already `max(vF, 0.0)` |
| `r3d-cams.js` | `wideSpot` stands on the stadium's own seats (`ctx.bowlY`); **every eye is kept at least 2.5 m above the stands**; **the replay records the skinned riders** (bone matrices, per-instance attributes, counts, colours), 30 Hz at most, and hides the sprite clones; nothing is recorded when `VIEW.replayOK` is false |
| `r3d-lead-post.js` | the depth-of-field gather clamps a bright tap (2.5 instead of 64), a lighter luminance weight and a far blur of at most 30% (was 42%): the thin light strings no longer glitter (director note D5) |
| `r3d-track.js` | **coloured tuff blocks** in the CEO's palette (yellow, red, blue, white), every albedo at 0.6 or less in linear light (they were near-white and glowed neon under the key); plain colours, no lettering, no brand |
| `demo-bookmarks.json` | **B2, B2b and R2 moved out of the stands** (12.3) |
| `CONTRACT.md` | ownership, dependencies, every module block of section 3, the hook-zone rows of section 4, the per-rider state (5), the view's getters (6), the couplings (7), the B2 pose (9.2), the flag table (9.4), this section |

### 12.3 B2 (the stadium wide) was INSIDE the new stands: moved (director note D2)

The harness' B2 eye `(0, 33, 92)` looking at `(0, 0, 4)`, fov 50 stands inside the new south upper deck (`bowlY(0, 92)` = 32.4 m: the eye is 0.6 m above the seats, among the upper deck's rows and fascia): the lower 40% of the frame was a black band of smeared crowd texture. The new pose is **eye `(22, 18, 63)`, target `(-6, 0, 2)`, fov 48** (6.6 m above the seats under it: `bowlY(22, 63)` = 11.4; an oblique elevated view across the floor like `Reference_Crops/broadcast_overview`, chosen from six candidates drawn on the merged build: `integrate/b2cand/`).
B2b (the south-west oblique) became eye `(-16, 17, 62)`, target `(4, 0, 2)`, fov 46; R2's first cut follows the leader from the new B2 eye. The master plan `BG_audit/sprint/mxvis/bookmarks.json` and `mxwar/demo-bookmarks.json` carry the move (a `moved` field with the old and the new pose; the previous plan is `bookmarks.v1-before-D2.json`); **the BEFORE frames of B2 were re-captured from the base commit `ac4b1bf` with the same new pose** in a temporary worktree (removed), so every before / after pair still has identical cameras (`before/README-B2-moved.txt`; the old-pose frames are in `before/old-pose-B2/`). The before-manifests, the perf rows and the old R2 clip still describe the old pose.
The cameras (`CAMS`) now keep every eye above `bowlY + 2.5 m` themselves; the harness' own poses must be chosen against `bowlY` (probe: `integrate/tools/probe-bowl.js`: the south stand is 2 m high at the wall (z 46), 9.5 m at z 61, 13 at z 66, 18 at z 76, 25 at z 81, 32 at z 91, 48.5 at the roof).

### 12.4 The reports' REQUESTS: applied, skipped, and why

| Request | Result |
|---|---|
| sw.js lists every new module (all) | applied (12.2) |
| `supported()` requires WebGL2 (rider) | applied; `?gl=0` added to test the fallback |
| `riderHi` / `bikeLod` / `crowdDetail` / `dirtTier` through `Q.options` per tier (rider, bike, stadium, dirt) | applied (`crowdDetail` was there already) |
| hands follow the steered grips, `steerGain` 1, `SEAT`, `KNEE` (bike) | applied |
| `V.warm()` while the gate shows (perf) | applied in `game.js` (after `setRace`: the shaders are compiled then; the line-up sheet itself has no scene yet) |
| glow sprites HDR; `max(vF, 0.0)` (lead) | applied / already in |
| lane blocks at albedo 0.6 or less, in the CEO's colours (lead, stadium, director D5) | applied |
| setAniso cap 16 (perf) | applied |
| `ctx.bowlY` in the cameras (stadium, lead, cams) | applied (eye clamp + wide spot); `ctx.bowl.prof` / `ctx.solids` not published: the cameras do not need them any more |
| `CONTRACT.md` for every new API (bike, cams, fx, dirt, stadium, rider, perf, lead) | applied |
| the replay must copy the riders (cams, rider) | applied: the skinned riders' bone matrices and instance attributes are recorded (they would have shown the LIVE riders on recorded bikes) |
| `st.mud` has one writer (bike) | applied: the rider zone's time-based rise was removed |
| materials from the kit on suits, gear, plastics (lead, director D3) | riders' cloth and helmet: applied. The bike's plastics keep their own shader (livery, mud, baked AO) and their own environment map: switching to `scene.environment` (one environment instead of two) is open |
| Settings row "Graphics" and "Run graphics benchmark" (perf); camera and replay buttons, a REPLAY badge, the cards window out of the chase framing (cams) | SKIPPED: `game.js` UI work of the game-integration step (the view side is ready: `V.setQuality`, `V.camNext`, `V.camReplay`, `V.camState`) |
| aim the corner line at `relief.lineAt` (dirt) | not needed: the ruts use the same formula (`-sign(k(s+9)) * hw * 0.36`) as `race3d.js` |
| Anaheim layout overlap (dirt, director D9) | LOGGED, not fixed: moving the connector changes the lap time and with it the whole seeded race (every bookmark time, the engine's lap plans), which would break the identical before / after cameras (D1) |
| remount pose blend (rider) | open (one-frame pose change when the rider remounts) |
| a depth-writing core for the dust so the DoF blurs it (fx, lead) | open |
| bike: livery art, handguards, cables; rider: a baked jersey / pants texture atlas, corrective shapes | open (director D3: the biggest single win left) |

### 12.5 Tests on the merged tree (this laptop, Intel UHD 0x46D2 via ANGLE / D3D11, the runner's 3 lanes shared with other work: absolute times are noisy; the Fire TV Stick was NOT measured)

- lint (`lint-modules.js`, 20 modules): 0 problems. Engine tests (`run-engine-tests.js`): 5 of 5 pass.
- `finish.js`, the whole 24-lap race, 22 riders: **high ALL CHECKS PASSED** (127 s wall; 4 crashes with remounts, 4 yellow laps, both flags, order = the engine's standings, 22 places once, 0 page / console errors, 0 warnings, no leak: 50 geometries / 33 textures at the first draw, 96 / 37 at the end; heap 77 MB; calls 47-90, triangles 213k-1.16M); **firetv ALL CHECKS PASSED** (53 s; calls 24-45, triangles 82k-163k; 27 -> 45 geometries, 20 -> 24 textures; heap 24-26 MB).
- `determinism.js`: IDENTICAL (6 frames byte-identical alone and in one session, B2 included).
- The REAL game page: `game-flow.js` on a phone (390x844, real touch): setup -> season -> line-up -> 3D gate -> drop -> 8 real-time laps (clock 1.00) -> results places 1..20, 0 errors. `tv-flow.js` (`?tv=1`, REAL KEYS: Enter / ArrowRight / ArrowDown, focus on the TV ring) at 1920x1080 with `quality=firetv` (the Stick's configuration: drawn at about 900 px, upscaled) and at 960x540 with the automatic tier: both to the checkered flag and the results sheet, places 1..20, 0 errors (the 960x540 run started BALANCED and the ladder walked to its floor and auto-demoted to FIRE TV under the shared CPU: that mechanism works). `gl0-flow.js` (`?gl=0`): the 2D track runs, no 3D view is created, 0 errors.
- The ten older scenarios (`cap.js`, GPU kit): stadium lap, outdoor RedBud, speedway hybrid, the CRASH LAP (a rigged double war: seat 7 crashes and remounts; the yellow lap; a rigged triple war: seat 9 crashes out and walks off), Reduce effects, reduced motion, portrait phone, a restored race (standings, hold, flags, skip), three races in one view, a TV: all ran to the end, 0 console logs.
- Quality tiers (`tiers.js`): all four tiers drawn in one page (B1 / B2 whole-frame counters, memory, the look's tier: firetv -> look `low` (`stick` on a TV), balanced -> `medium`, high -> `high`, ultra -> `high`); a MID-RACE switch (firetv -> ultra -> balanced -> high -> firetv through `V.setQuality`) raises no error and the next `setRace` builds the new world.
- The replay (`diag1.js`): a forced replay of seat 19's crash: the ring holds 211 frames (25.8 MB on high), 8 replay frames drawn, the riders sit on their bikes (before the fix they would have been drawn at their LIVE places), 0 errors. The AUTOMATIC trigger (the person's own crash) did not happen in the seed-22 race and is untested in a real race.
- Frame cost (`perf.js`, lap-1 pack at t = 20 s, pixel ratio 1, `integrate/perf/perf.md`): `bench draw+sync best-30 ms (calls / triangles)`: firetv 960x540 15.0 (34 / 98.7k), 1920x1080 33.8; balanced 31.0 (58 / 215.9k), 1080p 56.5 (THROTTLED row); high 34.5 (60 / 245k; THROTTLED row), 1080p 68.8; ultra 36.6 (75 / 334.5k), 1080p 72.0. The base's HIGH was 21.1 / 23.8 ms (43 calls / 198k): the merged HIGH costs about 1.6x at 960x540 and 2.9x at 1080p. Cover chase B1 (`tiers.js`): firetv 41 calls / 108k triangles, balanced 86 / 442k, high 89 / 617k, ultra 88 / 768k (the base: 49 / 199k).
- D7 numbers (`d7.js`, B1 held, the FIRE TV tier with the look's lite chain = bloom + grade + FXAA + the full rig): +5.4 ms at 960x540 (18.3 -> 23.7) and +6.3 ms at 1920x1080 (20.3 -> 26.7) on this iGPU, not the lead's +0.6 ms at 720p: the lead's figure was an uncontended minimum with the old rig; a quiet run and a real Stick are needed before the TV tier gets the chain. Until then the FIRE TV tier keeps no post chain (the look's `stick` / `low` tier).

### 12.6 What is still broken or short (honest list, biggest first)

1. PERFORMANCE: HIGH and ULTRA are far from 60 fps on this iGPU (balanced 31 ms at 960x540, high 69 ms at 1080p) and the whole-race peak is 1.16M triangles at a wide shot: the director's note D6 is NOT met. Where the weight is: the terrain's LOD 0 chunks (+81k near the lens), 21.8k-triangle bikes within 9.5 m, the shadow pass (every instanced body twice), the crowd cards, the post chain. `Q.lod` / `RST[i].lod` is computed but nobody consumes it (the riders choose by depth themselves). The Fire TV Stick is unmeasured by anyone: every FIRE TV statement is an estimate.
2. The riders are still mannequins next to the cover's athletes: vertex colours (no atlas, no seams, no dirt streaks), fists, huge white boots, a ball helmet with a ring, arms that read as wings from behind; the person's number is a plain patch. The bike is a step up but its plastics are simple stripes.
3. The FIRE TV tier's crowd reads dark and empty in the lower stands (72 segments, no cards), and it has no bloom, so the floodlights are small discs; the tuff blocks are smooth plastic.
4. Dust: B5 (the gate view) is veiled by the launch dust; the cover chase has tens of clods, not a storm; the dust writes no depth (the depth of field treats it as background).
5. The harness B5 eye is 3 m from the new gate truss: the banner crosses the top of the frame (not moved: it is not inside geometry).
6. The marshal's yellow flag is a flat yellow square; the starburst flares are large (HDR x2.5: a matter of taste to tune).
7. The remount pops from the walking pose to the seated pose in one frame; the replay's dust and lens flecks are not recorded; the REPLAY badge and the camera / replay buttons are not in `game.js` yet.
8. The Anaheim layout overlap (the connector under the 180's berm) is not fixed (12.4).
9. Load: the 3D modules are 1.78 MB of JavaScript (plus three.js 655 KB), 1.23 MB of it the two base64 dirt-tile files, both imported statically even when only the 256 px tiles are used (FIRE TV / Reduce effects): a dynamic import per tier would save about 1 MB of parsing and memory on the Stick. The first race of a session builds the world in about 2.5 s on high (1.0 s on FIRE TV) under a CPU cap here; a Stick will be slower.


## 13. The polish step (integrate:polish, 2026-10-17 20:00 - 2026-10-18: what changed on top of the merge, what was measured, what is still short)

Written by the polish step. Every picture and number here is from the REAL game on the harness page (GPU kit: ANGLE / Direct3D 11 on the Intel UHD 0x46D2, the runner's lanes shared with other work); the Fire TV Stick was NOT measured. Evidence: `BG_audit/sprint/mxvis/polish/` (README.md there: folders, tools, how each number was taken).

### 13.1 What changed (by director note)

| Note | File | What |
|---|---|---|
| D3 riders | `r3d-rider-apparel.js` (new), `r3d-rider-model.js`, `r3d-riders.js` | the outfit is PAINTED in the fragment shader (the skinned rider has no UV map): every vertex carries its outfit PART (`PART.JERSEY / SLEEVE / GLOVE / PANTS / BOOT / GEAR / SHELL / TRIM`, `aFx` is a vec4 now, the part in `.w`), the shader paints from the rest-pose position: jersey (yoke, side panels, piping, a sweep or a hoop, hem band), sleeves (biceps band, elbow guard, cuff), gloves, pants (outer stripe, leather knee panels, belt), boots (three straps, dark heel), helmet (centre stripe, side swooshes, back vent). Team / accent colour and the layout (style bits of `aInstC.y`) come from the instance attributes. **Level 2** (the near riders on the physically based tiers): cloth mottling, creases (a bump of the normal from screen derivatives), mud splatter from `st.mud` plus a dusting; **level 1** (the thin pack, FIRE TV, Reduce effects): flat panels, seams, a plain mud tint. The noise is an INTEGER hash (a float hash made frames intermittently not byte-identical: 13.2). The near riders receive the key's shadow (`receiveShadow`, physically based tiers). The neck brace is a coloured collar with a dark pad. |
| D3 bikes | `r3d-bike.js` | a floor of 0.16 of dirt on the lower parts of every bike (`st.mud` is the physical source above it) |
| D3 look | `r3d-lead-post.js` | the depth of field's NEAR side has a dead zone of 60% of 1/focus (the chased bike's tail, the legs and the rider stay sharp, only what is really near the lens blurs); the camera motion blur reaches only what is nearer than 0.28-0.58 of the focus (the chased rider moves WITH the camera: it was blurred into a stair of ghosts) and its taps are jittered |
| D4 flying dirt | `r3d-fx.js` | pools HIGH 2200 clods / 5200 spray / 340 puffs (ULTRA 3000 / 7000 / 420, BALANCED 900 / 2000 / 170, FIRE TV unchanged 160 / 300 / 44), clods 1.3x larger and round (normals lean 85% to the radial direction, a warm emissive floor), spray specks 1.5x bigger and brighter. **The gate**: the launch factor needed v > 1.2 m/s, so the first half second threw full dust and spray from all 22 riders (a wall of dust in front of the gate, found by hiding the sprite mesh and probing the riders' state): `e.ls` = the pad under him from the drop on (`st.onStart`, D < 18 m): clods 65%, spray 3% to 100% (quadratic), dust puffs 7% to 100% |
| D5 lights | `r3d-stadium-bowl.js`, `r3d-stadium-art.js`, `r3d-look.js` | every bulb a small distinct disc (the cover's grids of lights), a soft halo and a small flare instead of a 29 m four-point star, thinner shorter rays; with no bloom chain (FIRE TV) the glow sprites are 1.8x |
| D5 blocks | `r3d-track.js` | the tuff blocks get a procedural dirt / scuff / roughness pattern on their own position (no texture) |
| D12 lens | `r3d-cams.js`, `r3d-riders.js`, `r3d-bike.js` | the chase rig keeps the lens 2.1 m from every other rider's WHEELBASE SEGMENT (it measured from the origin: a rider alongside had his rear wheel at 0.3 m while the push did nothing), iterates twice, picks a stable side when the lens is nearly on the segment, lifts 1.5 m over a close rider's head, swaps sides only when the other side is clear by 2.6 m and not twice within 1.6 s; every rider and bike material has a dithered near-lens fade (0.8 m gone, 1.7 m whole) |
| D6 / D7 tiers | `r3d-quality.js`, `r3d-bike.js`, `r3d-track.js`, `r3d-look.js`, `race3d.js`, `r3d-lead-post.js` | `riderHi` 3 / 4 / 6 / 10, `bikeLod` `[8]` / `[6,17]` / `[8,22]` / `[12,34]`, NEW `bikeHi` 0 / 2 / 4 / 8 (how many bikes may use the 21.8k-triangle level: the N nearest of the last frame, no cap on the frame after a camera cut); the terrain's three levels scale their distances by the tier's terrain detail; HIGH and BALANCED use the 1024 plain shadow map the table promised (HIGH drew a 2048 soft one), ULTRA its own look tier; the bloom's first level is a quarter of the frame (`bloomDiv`) |
| D8 | `sw.js` | `r3d-rider-apparel.js` listed |
| D9 | - | NOT fixed: the connector under the 180's berm: moving it changes the lap time and with it the whole seeded race and every bookmark time (D1 needs identical before / after cameras); a layout change belongs to the game-integration step, with new BEFORE captures from a base that has the same layout |

### 13.2 Measured

- **Lens (D12)**, `polish/tools/lens.js`: 320 s of the director's own cameras, every 0.2 s, the share of the frame the biggest non-subject rider's SILHOUETTE covers (the convex hull of its 2.2 x 0.8 x 1.9 m box, clipped at the real 0.5 m near plane): samples over 30% of the frame, or nearer than 0.8 m with more than 10%: **66 -> 15** (the 15 left are 11-27% silhouettes at 0.5-0.7 m, inside the dither fade); the worst non-subject silhouette **54% -> 28%**. The chase shot's own subject is the picture and is not counted.
- **Triangles and calls per bookmark** (whole frame, shadow pass included; base `ac4b1bf` / merged `70cf8ed` / polish): B1 199k / 617k / **452k** (49 / 89 / 89 calls), B2 199k / 255k / 265k (64 calls), B3 199k / 414k / **352k** (69), B4 199k / 364k / 374k (70), B5 199k / 612k / **502k** (70), B6 199k / 407k / **378k** (83). Whole 24-lap race (`finish.js`): HIGH 47-90 calls, **232k-616k** triangles (the merge: 213k-1.16M), FIRE TV 24-45 calls, 82k-163k triangles; both runs ALL CHECKS PASSED.
- **Frame cost against the base, `ab-bench.js`** (two pages open at once, the cover chase B1 held, sim + draw + a GPU sync per frame, best 30, pixel ratio 1 = the ladder OFF, rounds alternated base / new, the minimum of 4): HIGH **15.6 -> 29.2 ms** at 960x540 (x1.87) and 26.9 -> 69.0 ms at 1920x1080 (x2.57); BALANCED (the base's `medium`) 10.8 -> 22.9 (x2.13) and 22.5 -> 48.9 (x2.17); FIRE TV (the base's `stick`) 13.6 -> 18.6 (x1.36) and 16.7 -> 20.9 (x1.26). HIGH is inside the director's 4x. It is NOT 50-60 fps on this iGPU with the ladder off (29 ms at 960x540).
- **Every tier, `tiers-bench.js`** (interleaved rounds, the minimum of 3, B1, ladder off): 960x540: FIRE TV 8.2 ms, **FIRE TV with the look's lite chain (bloom + grade + FXAA) 11.9 ms**, BALANCED 19.9 (50 fps), HIGH 26.3 (38 fps), ULTRA 31.8 (31 fps); 1920x1080: FIRE TV 15.9 (all 3 rounds THROTTLED: an upper bound), with the chain 22.7, BALANCED 49.2 (20 fps), HIGH 62.6 (16 fps), ULTRA 75.8 (13 fps). Rows with a JS calibration under 150 Mit/s are THROTTLED (`polish/perf-after/tiers-bench-1.json`: BALANCED 960x540 2 of 3 rounds, HIGH 960x540 1 of 3, 1080p BALANCED / HIGH 2 of 3).
- **D7 decision (numbers, not the Stick)**: the lite chain costs +3.6 ms at 960x540 (+44%) and +6.7 ms at 1080p (+42%) on this iGPU (a half-float target and nine passes): the FIRE TV tier gets NO post chain by default; its glow comes from the halo sprites (x1.8, additive). The Stick's CPU and GPU are not measured: `?bench=1` on the device is the measurement.
- **The adaptive ladder ON (the real loop, `bench-live.js`, 20 s from the gate drop, 1280x720, the director's cameras)**: the automatic tier here is BALANCED (`gpu+probe`): **56.5 fps average**, median frame 13.8 ms, the ladder settled at 0.67-0.8 (canvas 857x482), 70.8% of frames on target; BALANCED forced 60.3 fps (floor 0.6), HIGH 47.0 fps. The 1% low is 3 fps in every row: the first seconds are shader compiles and the ladder's resizes (a 400-500 ms hitch each; the game calls `V.warm()` while the gate shows, the capture page does not). FIRE TV live: 23-25 fps at the ladder's floor with a frame median of 40 ms at BOTH 480x270 and 960x540: that is the harness' ceiling, not the tier: `raf.js` measures a BLANK page in this headless browser under the runner's CPU cap at 20.8 ms per requestAnimationFrame callback (48 fps), and the 30 fps cap draws every second callback. These live rows prove the ladder works and say nothing about the Stick.
- **Where the time goes (HIGH, 960x540, interleaved ablation `ablate.js`, one noisy run)**: the post chain (bloom about 6 ms before `bloomDiv`), the particles about 3 ms, the riders and bikes about 3 ms, the crowd about 3 ms, the terrain about 2 ms, the real shadows about 1 ms. Under the runner's CPU cap a good part of it is JS submission and driver work (89 calls plus 9 post passes), which the Stick has too.
- **Determinism (`determinism.js`, six bookmarks alone in a fresh page and in one session, two browsers)**: the apparel's float hash made one or two frames of about every other run differ by 4-15 pixels (channel difference 1-3) on the jerseys; the merged build was byte-identical in 10 of 10 fresh pages of the same session test (20 frames), the polish before the fix differed in 5 frames of 20; with the integer hash 10 of 10 pages are identical (20 of 20 frames, B5 then B1).
- **Game**: `game-flow.js` (the real game page on a phone, touch): setup -> season -> line-up -> 3D gate -> drop -> 8 real-time laps -> results places 1..20, 0 errors, 0 logs (clock rate 0.93 under an 11% CPU cap).

### 13.3 What is still short of the cover (biggest first)

1. The riders are still stylised figures: painted panels, no fabric weave, mitten hands, a ball helmet with a flat peak (the front view shows a robot neck and a duck bill), no real wrinkles from the pose; the cover's riders are photographic athletes. The cover chase camera (rider in the right third, 2 m behind) is the cams rig's, not the harness B1 (a fixed 3.5 m / 70 degrees pose, the rider small in the frame).
2. The flying dirt is a lit particle field (round clods, streaks, puffs), not the cover's storm: the cover has hundreds of motion-blurred specks in the foreground; ours has tens to a hundred clods in the chase frame and no particle motion blur.
3. Performance: HIGH is x1.9-2.6 the base, 29 ms at 960x540 on this iGPU (ladder off). The post chain (HDR target, bloom, depth of field, haze) is the biggest single cost at full resolution and scales with the pixels; the default tier here is BALANCED and the ladder holds about 56-60 fps at 1280x720. The Fire TV Stick is unmeasured.
4. The crowd cards, the stadium's far stands and the FIRE TV tier's lower stands still read dark or flat; the tuff blocks are plain plastic with a scuff pattern; the marshal's flag is a flat yellow square.
5. Open from 12.6: the remount pose pop, the replay's dust, the REPLAY badge and the camera buttons in `game.js`, the dynamic import of the dirt tiles per tier, the Anaheim layout overlap.


## 14. Milestone 1: the proof (integrate:evidence, 2026-10-18: what was shown, what it measured, what is still short)

Written by the evidence step. **No game code changed in this step**; it captured, measured and judged the polished build (`c3f8623`). Everything is from the REAL game on the harness page (GPU kit: ANGLE / Direct3D 11 on the Intel UHD 0x46D2, the runner's lanes shared with other work). **The Fire TV Stick was NOT measured.**

### 14.1 Where the evidence is

- For the CEO: `BG_demos/v1/` (`shot-1..3.png`, `before-after-B1.png`, `before-after-B2.png`, `chase.mp4`, `broadcast.mp4`, `firetv-tier-before-after.jpg`, `PERF.md`, contact sheets).
- For the studio: `BG_audit/sprint/mxvis/after/` and `before/` (12 frames each: the six bookmarks at 1280x720 and 1920x1080, the old B2 pose as `*-oldpose.png`), `compare/` (`before-after-B1..B6.png`, `before-after-cover-B1.png`, `before-after-sheet.jpg`, `cmp-*` with the cover), `evidence/` (`plans/*.json`, `tools/rec.js` recordings + previews + a no-draw lens check, `sheet.js`, `make-perf-md.js`, `perf/*.json`, `stills1`, `stills2`, `tv/`, `finish-high`, `finish-firetv`, `game-phone`, `game-tv`, `game-gl0`).

### 14.2 What it proved

- **Same cameras.** The six BEFORE frames reproduce from the base `ac4b1bf` with 0 differing pixels (12 of 12, B2 re-captured at its new pose), the six AFTER frames are byte-identical to the polish step's (0 of 12). Whole frame B1 (HIGH): 49 calls / 198,778 triangles before, 89 / 451,783 now; all six: 45-53 calls and about 199k triangles before, 64-89 calls and 265k-502k now.
- **Frame cost, ladder off** (`tiers-bench.js`, B1 held, the minimum of 3 interleaved rounds): FIRE TV 17.5 ms (960x540) / 13.7 (1080p), BALANCED 23.3 / 46.5, HIGH 25.0 / 70.0, ULTRA 28.7 / 76.4; HIGH is x1.9 / x2.6 the base (polish `ab-bench`). **Ladder on** (`bench-live.js`, 20 s of the real loop): the laptop's automatic tier (BALANCED) 68.6 fps at 960x540, 43.6 fps at 1920x1080 (the ladder at its 0.6 floor; 56.5 fps at 1280x720 in the polish run): **50-60 fps holds up to 720p, not at 1080p**. The FIRE TV rows read 24 fps because this headless browser delivers a requestAnimationFrame every 20.8 ms (48 fps; the 30 fps cap draws every second one): a harness limit, not a measurement of the tier. Every row, the throttled ones marked, is in `BG_demos/v1/PERF.md`.
- **The FIRE TV tier at the same budget looks clearly better** (36 calls / 101k triangles before, 41 / 108k now): `firetv-tier-before-after.jpg`.
- **The game still works on the final tree:** `finish.js` (24 laps, 22 riders) ALL CHECKS PASSED on HIGH (47-90 calls, 232k-616k triangles, heap 87-99 MB) and FIRE TV (24-45 calls, 82k-163k triangles, heap 22-32 MB): 4 crashes with remounts, 4 yellow laps, both flags, order = the engine's standings; the REAL game page `game-flow.js` (phone, touch, 8 real-time laps, results places 1-20, clock 1.00), `tv-flow.js` (`?tv=1`, real keys, 1920x1080, `quality=firetv`), `gl0-flow.js` (`?gl=0`) all PASS with 0 errors; `cap.js` S,O,H,C,L,M,P,R,N,T (double-war crash and remount, yellow lap, triple-war crash-out, outdoor and speedway venues, Reduce effects, reduced motion, portrait phone, restored race, three races in one view, TV) all ran to the end; engine tests 5 of 5; `lint-modules.js` clean.

### 14.3 The two recordings (`rec.js`; how they were made and what they are not)

Frame by frame on the harness's fixed 1/30 s clock at 1920x1080 on the HIGH tier (this laptop cannot play it in real time), JPEG frames q 0.95 into x264 (High 4.1, CRF 20, VBV 4.4 Mbit/s, aq-mode 3, BT.709 limited, yuv420p, +faststart, no audio).
- `chase.mp4` (21.7 s, 12.4 MB): the cams module's own `rigChase` on rider #200 (seat 7), forced with `cams().force({type:"chase", subj})`; three real-time stretches of one race with hard cuts (lap 1 -0.8 to 11.5 s: the gate drop, launch, turn 1; lap 2 87.2 to 91.6 s: three rhythm jumps; lap 2 99.8 to 104.8 s: the whoops, a pass). Measured per frame by the lens probe: the biggest non-subject rider's silhouette never exceeds 21.5% of the frame (0 frames over 25%), the subject stays in frame (NDC x 0.19-0.58, mostly the right third).
- `broadcast.mp4` (24.0 s, 13.5 MB): one stretch of lap 1 (13 to 37 s), a fixed eye (0, 24, 70), 8.9 m above `bowlY` (15.1 m), panning with the field's centroid (led by the damping time) and zooming 17-42 degrees so the pack keeps its size. The pan / zoom is a hook in `rec.js` (a `V.camHook`), **not** a camera of `r3d-cams.js`.
- The person's own rider (seat 12) was tried first: last at turn 1, and a rival filled 44% of the frame for 7 frames in his lap-2 rhythm section, so the clip follows seat 7.

### 14.4 Found by looking, NOT fixed (needs code)

1. **The first hairpin with the lens inside the pack** (`chase.mp4` 9.2-11.4 s): a dust veil over the frame and riders under 1.7 m dither-fading into ghosts; puff sprites only fade inside 1.1 m (`SPR_VS`: `smoothstep(0.25,1.1,depth)`).
2. **A rival alongside the chase lens** still fills 25-44% of the frame at 2.1 m (the keep-out measured from the wheelbase segment is too small for a 102-degree horizontal lens) and the lens can swing ahead of the subject for about 0.3 s at a hairpin (seat 7, lap 2, 86.8-87.0 s: the subject leaves the frame for 9 frames, the first of them behind the lens).
3. **The high broadcast preset exists only in the capture tool**; the game's `broadcast` preset is the trackside long lens. The far upper stands read as a dark noisy mass; no light rig is in a high-broadcast frame.
4. The riders (arms like wings from behind, mitten hands, ball helmet, no cloth folds) and the dirt storm (tens to about a hundred clods in a chase frame, one soil family, no particle motion blur) are the two biggest gaps to the cover (13.3 items 1 and 2).
5. Still open from 12.6 / 13.3: the Graphics setting, the camera and replay buttons and the REPLAY badge in `game.js`, the replay's real-race trigger (never fired), the remount pop, the Anaheim connector overlap (D9).

### 14.5 Next milestone

Measure the Stick first (`mxwar/assets/perf/bench.html?sweep=1` on the device); then riders (atlas, hands, helmet, pose), the dirt storm, the chase lens (keep-out, dust veil, ghosting) closer to the cover's 2 m, the `game.js` screens and Party Mode parity, the broadcast preset in `r3d-cams.js`, crowd variety, and the Anaheim fix with new BEFORE captures.

## 15. The look, milestone 2 (lead, 2026-10-18): the half-resolution effects chain, contact shadows, the real stadium as the environment, the bikes' clear coat, the TV options

What the lead built on `mxvis2-lead` (files `r3d-lead-post.js`, `r3d-look.js`, `r3d-lead-env.js`; no new file, `sw.js` unchanged). Every effect is still one flag of the look's tier table.

| flag (`r3d-lead-post.js`) | what it does | where it is on |
|---|---|---|
| `half` | a PREPASS packs the frame at half size (colour + the linear depth in alpha); the depth of field and the camera motion blur GATHER from that small target only; the full-resolution final pass composites it where each pixel's own depth says it is out of focus or streaming past the lens (in-focus silhouettes stay the full-resolution scene). Replaces milestone 1's half-size gather that read the full-size scene and depth with every tap. | high, ultra (medium has it, but builds nothing: no depth effect there) |
| the crumb mask | a pixel whose scene alpha is under 0.5 is never smeared by the camera motion blur (its packed depth is negative): the fx crumbs write that alpha (section 3 fx, applied by the merge) | wherever `half` and the motion blur are |
| `ao` | CONTACT SHADOWS at half resolution from the packed depth: 8 spiral taps within `aoR` 0.45 m, the normal from the depth, a range check (no halo on the far background), faded out from 0.6 x `aoFar` to `aoFar` (30 m), never on bright light pixels; drawn only while the shot's subject rider is within 30 m (`P.setAo(on)`, from `L.frame`); `aoDebug` a test view | high, ultra (1.0) |
| `fmt` | `"r11"` = an R11F_G11F_B10F scene target (half the bytes of RGBA16F; no alpha, so only where there is no motion blur; needs `EXT_color_buffer_float`, else RGBA16F) | medium |
| `ldr`, `tvFxaa`, `tvGlow` | the TV tiers: the frame drawn into an RGBA8 target flagged `isXRRenderTarget` (three r160 then tone-maps and encodes sRGB in every material: the same programs as drawing to the screen), then FXAA (3.11 thresholds) and / or a GLOW (near-white pixels at 1/4 size, blurred one level down and up, added in roughly linear space; +3 calls) | OFF on every tier (look `low` / `stick`: `tvaa: false`, `tvGlow: 0`): measured, FXAA at 960x540 changed 25-27% of the pixels and doubled thin details (+2.2 ms here); the perf engineer's 4x MSAA canvas is the TV tier's anti-aliasing. `r3d-look.js` turns them on only where the canvas has NO MSAA (`canvasAA()`), never with Reduce effects |

- Loops and per-pixel branches sample with `textureLod(..., 0.0)` (the targets have no mips; Direct3D had warned X3595 on HIGH).
- **The environment is the REAL STADIUM** (`envCap`: high, ultra, medium): once per stadium world (in `L.apply`, or when a tier that wants it is raised mid-race) a 256 px half-float cube is rendered from the floor's middle (cx, 3.5, cz), the world only (riders and particles hidden), the lit surfaces dimmed (key x0.5, hemi / fill / bounce / ambient x0.75, rim / kick off, glow halos x0.8) while the unlit bulb discs keep their full HDR, the key's shadow box fixed over the floor (the map never depends on the last camera), prefiltered by PMREM at 256 (the same size as the procedural map: no recompile). The procedural map stays the fallback (outdoors, errors). `r3d-lead-env.js captureEnvironment(renderer, scene, {pos, keep, size, dim})` restores every visibility, intensity and renderer state, also on error; `L.envRecapture()` (tests) -> ms. About 24 ms with its programs compiled; the first race's capture compiles the world's shaders (2.3-7.6 s here), which the first frame would otherwise do.
- **The bikes' clear coat** (`bikeCC`: high, ultra): `L.upgrade` / `swapPBR` builds a `MeshPhysicalMaterial` stand-in for the bike's `mxbike-std` material: its own `onBeforeCompile` plus one line that limits the coat to the painted plastics (`material.clearcoat *= step(0.5, bkTn) * (1 - bkWl) * (1 - metalnessFactor) * (1 - mudK)`), `clearcoatRoughness` 0.07, `envMap` null (it reflects the captured stadium). The original material stays for the other tiers. The lead asked the bike to carry the coat natively (and delete the stand-in): the bike's milestone 2 branch rewrites the material and its cache key (`mxbike2-...`), so the stand-in will not find it once that branch is merged.
- Measured by the lead (this laptop's Intel UHD, lanes shared, the Stick NOT measured): the whole frame at 1920x1080 on B1, ladder off: HIGH 82.9 -> 79.0 ms (AO 0.7 ms of it), BALANCED 54.3 -> 47.5 ms (R11), FIRE TV unchanged. In a trial merge of all the branches the HIGH chain cost about 22 ms at 1080p (HIGH 70.4 ms = 14.2 fps; BALANCED 43.6 ms = 22.9 fps): the 1080p targets (HIGH 30, BALANCED 45 fps with the ladder off) are NOT met; only the ladder's resolution steps bring this iGPU to 25-35 fps. +6 MB of targets at 1080p on HIGH. The look against the cover (B1 foreground dirt luma p5 / p50 / p95): cover 9 / 57 / 160, milestone 1 20 / 70 / 129, now 9-16 / 53-63 / 116-126: the shadows and midtones match, the highlights do not.
