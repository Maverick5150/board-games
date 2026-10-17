# Motocross War 3D — CONTRACT

Who owns which file, what every module exposes, where each specialist plugs into `race3d.js`, what data the view hands every frame, and how to capture, prove and measure a change (section 9).
Written by the file-split step (branch `mxvis-split`) and finished by the BASE step (2026-10-17, about 14:30), which joined the split and the capture harness into the branch `mxvis` with a linear history:
`7dec470` (build B as the judges saw it) -> the split -> the harness (two commits) -> the base commit on top (`git log --oneline mxvis`). Neither step changed a pixel: the six bookmark frames at 1280x720 and 1920x1080
drawn on the laptop's GPU are identical to the BEFORE set (0 differing pixels, 12 of 12), and the split's 84 software-GL frames over 10 scenarios are identical before the split, after it, and on the joined branch (section 9.8).

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
| lead | Lead Graphics Engineer (the integrator step after the builders applies every REQUEST in these files) | `race3d.js` (everything outside the zones), `r3d-util.js`, `r3d-look.js`, `CONTRACT.md`, `sw.js` | none (it is the rest of the file) | the view: `create()`, the race state machine, rider motion and the cards sync, the crash scripts, the frame loop; shared helpers; renderer settings, light rig, fog, the post-processing slot and the frame's counters |
| dirt | Environment Artist (the ground) | `r3d-track.js`, `mxwar/assets/dirt/` | `dirt` | the track SURFACE: soil, dirt maps, the track ribbon (berms, jump faces, whoops, sand, the start path), its material, the lane-edge blocks |
| stadium | Environment Artist (the stadium) | `r3d-world.js`, `mxwar/assets/stadium/` | `stadium` | everything round the track: stands, crowd, suites, walls, light rigs and glow, the big screen, sky, start gate, finish line, flaggers and flags, outdoor terrain, trees, paddock, speedway infield; `buildWorld()` |
| bike | Vehicle / Rider Specialist (the machine) | `r3d-bike.js`, `mxwar/assets/bike/` | `bike` | the motorcycle: `BIKE` constants, part geometries, materials, instanced meshes, plates, the bike's pose |
| rider | Vehicle / Rider Specialist (the rider) | `r3d-riders.js`, `mxwar/assets/rider/` | `rider` | the rider: geometry, two-bone IK, poses (seated, standing, dab, crash body), the number atlas, blob shadows, number tags, the instancing glue |
| fx | Effects Specialist | `r3d-fx.js`, `mxwar/assets/fx/` | `fx` | roost, dust, impacts: the particle system and when / how much to emit |
| cams | Cinematic Camera Specialist | `r3d-cams.js` | `cams` | the TV director, every camera rig, the sight tests, the camera itself |
| perf | Performance Engineer | `r3d-quality.js`, `r3d-perf-bench.js`, `mxwar/assets/perf/` | `perf` | the quality tiers and their flags, the adaptive-resolution ladder, GPU classification and probe, reduce-effects and TV flags, the options every builder receives, `V.qualityNames()` / `V.setQuality()`, the riders' level-of-detail and texture-budget helpers, the in-game benchmark (`?bench=1`) |
| qa | Quality Director | no code | none | runs section 9.3 steps 2-5 on each specialist's branch, compares the real captures with the cover, rejects what the pictures do not support |
| base | the studio (done; frozen) | `mxwar/demo.html`, `demo.js`, `demo-engine.js`, `demo-bookmarks.json`, `ui/vendor/three-addons/`, `mxwar/assets/LICENSES.md` ("base" section), the tools in `BG_audit/sprint/mxvis/tools/` | `harness` (two frozen zones) | the capture harness, the vendored add-ons; the integrator adds an add-on or a tool option on REQUEST |

Not part of the view, nobody edits them in this phase (the integrator does, at the game-integration step): `game.js`, `index.html`, `course.js`,
`layouts.js`, `race.js`, `round.js`, `season.js`, `brain.js`, `art.js`, `track.js` (the 2D track), `data/`.

### Dependencies (no cycles)

```
r3d-util.js        <- everything (three.js only)
r3d-quality.js     <- util, perf-bench   (r3d-perf-bench.js imports nothing: the quality object and the view are passed in)
r3d-look.js        <- util
r3d-track.js       <- util
r3d-world.js       <- util, track
r3d-bike.js        <- util
r3d-fx.js          <- util
r3d-riders.js      <- util, bike  (re-exports BIKE; emit / stepParticles from fx)
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
  `setAniso(n)` / `getAniso()` (1..8; `r3d-quality.js` sets it from the GPU).
- Geometry: `merge(list)` -> one non-indexed BufferGeometry (position, normal, color, uv); `paint(g, [r, g, b])` vertex colours; `xf(g, x, y, z, rx, ry, rz, sx, sy, sz)` transform;
  `bone(mesh, i, a, b, thick, fw)` places instance `i` of an instanced unit-length +Y limb mesh between points `a` and `b` (the limb never spins about its axis: local +X toward `fw`).
- Course queries (pure): `clear(C, x, z, margin)` -> true if (x, z) is off every part of the track; `clearDist(C, x, z)` -> distance to the nearest track edge (negative on it).

### r3d-look.js (lead)

`createLook(renderer, {shadows}) -> L`: sets sRGB output, ACES filmic tone mapping, the PCF shadow map, the clear colour; makes the scene and the light rig.
`L.scene`, `L.hemi`, `L.sun`, `L.fill`, `L.amb`, `L.SUN` (the sun direction, a Vector3 updated per venue), `L.shadows` (are real shadows on), `L.shHalf`,
`L.setShadows(on)`, `L.apply(C, look, world)` (a new race: the venue's lights, exposure, sun disc, then the fog from `world.ctx.fogC`),
`L.fitShadow(cam, target)` (every frame while shadows are on: the shadow box follows the action, snapped to texels), `L.blobOp(x, y, z)` (0.42..1: how much blob
shadow to keep where the real shadows fall), `L.render(scene, cam)` (the frame), `L.resize(W, H, pr)`.
**`L.post = null` is the post-processing slot**: set it to `{render(scene, cam), resize(W, H, pr)}` and every frame is drawn through it (bloom, depth of field, SMAA; the add-ons are in `ui/vendor/three-addons/`;
`tools/post-slot-check.js` builds an EffectComposer with RenderPass + UnrealBloomPass + OutputPass in the real view as a working template, and proves a resize reaches `post.resize`). With a chain on, tone mapping and the sRGB
conversion belong to the chain's OutputPass (three.js applies `renderer.toneMapping` only when it draws to the screen). **`L.render` owns the frame's counters**: it sets `renderer.info.autoReset = false` and resets once per frame, so
`renderer.info.render.calls / triangles` (= `V.stats().calls / tris`, the harness' `DEMO.stats()`) are the WHOLE frame: the shadow map pass + the scene + every pass of a chain. (three.js alone resets the counters inside every `renderer.render()`
right AFTER it drew the shadow map, so it never counts the shadow pass, and a chain would show only its last pass.) A chain must not touch `renderer.info`.

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

### r3d-track.js (dirt)

- `SOIL` -> `{soil: [base, light, dark]}` (sRGB hex) for "stadium-dirt", loam, clay, hardpack, sand.
- `dirtMaps(soil, lo, floor) -> {map, normal}`: the dirt's detail as a colour map (a warm near-white with grooves, tyre tracks, stones: the soil colour is in the vertex colours) and a normal map;
  `floor` = the stadium floor's version. `padMaps(soil)` -> the same for the starting pad (cached per soil).
- `trackMaterial(look, q) -> {mat, dirt}`: the material the ribbon is drawn with (`MeshLambertMaterial` + map + normal map + vertex colours + the hairpin shader patch) and the colour map.
- `addTrack(C, look, q, root, mat) -> {track, frame}`: builds the ribbon (+ the start path) and the lane-edge blocks into `root`. `frame` is `null` or `function(dt, RST)`; `race3d.js` calls it every frame (zone `dirt`)
  with the riders' per-frame state (section 5): the hook for tyre tracks that deepen the ruts, dust that follows the lanes.
- The ribbon has attributes `position`, `normal`, `color` (the soil colours per vertex), `uv` (`lat/5, s/5`), `aPlan` (the hairpin weight). Lateral stations: 17 in a stadium, 13 outdoors.

### r3d-world.js (stadium)

- `buildWorld(C, look, q) -> {root, ctx, track, fin, info, matTrack, dirt, frame}`; `q = {lo, ...}` (Q.options). `root` is a Group (everything is added to it; `race3d.js` adds the gate, the flaggers, the marshal to it).
  - `ctx`: `dirt` (colour map), `glowTex`, `glow(list, color)`, `sky(top, mid, hor, withSun)` (-> `ctx.skyMesh`, `ctx.sunMesh`), `fog(color, near, far)` (stores `ctx.fogC`, applied by `L.apply`),
    `clouds(C, q)`, `screen(lap, len, num)` (the stadium's big screen: redraw it; `race3d.js` calls it at the gate and every lap), `hf(x, z)` (terrain height; outdoor and speedway only).
  - `fin`: `{grp, flagAt (Vector3, where the flagger stands), th, side, lat}`. `info`: `{cx, cz}`.
  - `frame`: `null` or `function(dt, tw, cam)`; `race3d.js` calls it every frame (zone `stadium`): crowd animation, flashing lights, the screen. `tw` = wall-clock seconds.
- `gateBuild(C, look, n) -> {grp, pads, slots, pad, gw, th, x, z, y, drop, dropT, slotLat(k), set(a)}`: `set(a)` lowers the pads (0 up .. 1 down); `slotLat(k)` = the lateral offset of slot k.
- `flaggerBuild(flagTex, {marshal}) -> {grp, arm, flag, wave(t, amp), setTex(tex)}`; `flagTex(kind)` ("checkered" | "white" | "yellow" | "green" | anything else = red).
- `fixMat()` (a Lambert material where vertices marked `aFix` keep their own colour), `glowTex()`.
- Re-exports for the old import path: `setAniso, merge, paint, xf, clear, clearDist, lin, mixc, fbm, vnoise, canvas, tex, rngf` (they live in `r3d-util.js`).

### r3d-bike.js (bike)

Bike local axes: +X forward, +Y up, +Z right. Heading `th`: `rotation.y = -th`; roll + = lean right; pitch + = nose up; Euler order YZX.

- `BIKE`: `WB` 1.48 m wheelbase, `WR` 0.34 m wheel radius, `FA` / `RA` front / rear axle (bike space), `HEAD` steering head, `PIVOT` swingarm pivot, `GRIP`, `PEG` (the rider's IK targets), `TRAVEL` 0.30, `SAG` 0.10.
  `race3d.js` uses `WB`, `WR`, `TRAVEL`, `SAG` for the suspension physics, `r3d-riders.js` uses `GRIP` and `PEG`: change them together or not at all.
- Geometry: `wheelGeo, chassisGeo, plasticsGeo, trimGeo, forkGeo, swingGeo, plateGeo` (merged, vertex-coloured; unit limbs along +Y for the fork and swingarm), helpers `V3`, `tube`.
- `createBike(n, lo, mk) -> M`: `mk(geo, count, material)` is the instancing glue of `r3d-riders.js` (an InstancedMesh added to the riders' group). `M` = `{wheel (2n: front, rear), chassis, plastic, trim, fork, swing}`;
  every part casts the sun's shadow. It makes the bike's materials first (Lambert wheels, glossy Phong plastics and trim, metal Phong chassis / fork / swing).
- `colorBike(M, i, R)`: `R = {color, accent}` of rider i -> the plastics in the team colour, the trim in the accent.
- `drawPlate(x, rr, fit, px, py, cell, R, t)`: draws the number plate's face into the riders' atlas canvas (`x` 2D context, `rr` rounded-rect path helper, `fit` font fitter, `t` the number text).
- `PLATE_L`: the three plates' local matrices (front, two sides); the plate mesh `M.plate` (3 per bike, `plateGeo()`) is made by `createRiders` because it needs the atlas.
- `poseBike(M, i, B, st)`: `B` = the bike's world Matrix4. Writes the matrices of both wheels (spin, suspension travel), chassis, plastic, trim, fork (a bone from the front axle to the steering head), swingarm, the three plates.
  Reads `st.compF`, `st.compR`, `st.spinF`, `st.spinR`. `hideBike(M, i)`.

### r3d-riders.js (rider)

- `createRiders(list, q) -> R`: `list[k] = {s (seat), color, accent, num, name, red, me}`. `R = {grp, M, A (the number atlas), n, list}`. `R.M` holds every InstancedMesh by name:
  bike parts (above), `helmet`, `torso` (n each), `uarm`, `farm`, `thigh`, `shin` (2n each: left, right), `plate` (3n), `back` (the jersey-back number, n), `shadow` (2n blob quads: bike, body), `tag` (n number tags).
  Helmet and body parts cast the sun's shadow. Materials: Phong helmets, Lambert cloth with the `aFix` colour exemption (boots, braces, gloves keep their colour).
- `poseRider(R, i, B, st)`: poses the bike (`poseBike`), then the rider. Normal riding reads `st.stand` 0..1, `st.dab` -1..1 (inside foot out, + = right), `st.lean`, `st.crouch`, plus the bike's inputs.
  A crashed rider: `st.body` = a Matrix4 (origin the hip, +Y up the spine, +X the chest's front, +Z right) and `st.limbs = {spread, walk, phase, stand, reach}` (the crash script in `race3d.js` builds them: `poseBody`). `st.hide` hides both.
- Two-bone IK (`ik`): arms 0.29 + 0.29 m to the grips (elbows up and out), legs 0.43 + 0.45 m to the pegs (knees forward); hip and shoulder from `localJoints(stand, dab, lean, crouch)`.
- `hideRider(R, i)`, `shadowAt(R, k, x, y, z, th, sx, sz, alpha, gs, gl, op)` (blob shadow `k`: a quad lying on the ground at (x, y, z), heading `th`, size `sx` x `sz` scaled by `alpha`, tilted to the slope along `gs` and across `gl`, opacity `op`),
  `tagAt(R, i, pos, size)` (a number tag billboard; `size` 0 hides it), `commit(R)` (flags every instance buffer for upload: call once per frame after posing), `setRed(R, list)` (the red plate moved: redraw the atlas).
- Old import path: `BIKE` (from `r3d-bike.js`), `emit`, `stepParticles` (from `r3d-fx.js`; their first argument is now a particle system, not `R`).

### r3d-fx.js (fx)

- `createFx({lo, C, look, ...}) -> FX` (a new one for every race): `FX.group` (a Group, added to the scene by `race3d.js`), `FX.part` (the ring buffer: `n, pos, alpha, size, col, vari, vel, life, max, next, geo, mat`; 520 particles, 160 with Reduce effects),
  `FX.emit(x, y, z, vx, vy, vz, size, life, rgb)` (size over 0.3 = dust that grows, otherwise a dirt clod), `FX.step(dt)` (every frame), `FX.rider(st, dt)` (every rider every frame: the landing dust when `st.landed`, the roost while `st.roost` > 0),
  `FX.crashStart(f, gy)` (the burst where a rider goes down), `FX.crashStep(c, t, dt, hx, hgy, hz, bx, gy, bz, thB, ts)` (dust at each bounce of the tumble, a trail behind the sliding bike). Everything is skipped with `lo`.
- Module functions: `emit(P, ...)` and `stepParticles(P, dt)` work on a particle system `P` (= `FX.part`); `puffTex` (a 2 x 2 atlas of lumpy dust puffs) is private.
- The default particle look: dirt clods are small round points (shader branch `vD < 0.5`), dust is a textured soft puff (`aSize > 0.3`); colours are display sRGB (the shader writes them as they are): `dirtCol()` / `dustCol()` by soil.

### r3d-cams.js (cams)

`createCams(VIEW) -> CAMS` (once per view). `VIEW` is the view's LIVE state, read-only here (section 6). Per frame the view calls `CAMS.director(dt)` then `CAMS.camera(dt)`.

- `CAMS.shot` (the current shot: `{type, subj, pri, min, max, cam (a Vector3 or null), why, t, feat, victim}`; `type` = gate | turn1 | chase | heli | track | whoops | jump | crash | line), `CAMS.setShot(s)`, `CAMS.pickShot(force)`,
  `CAMS.shotLog`, `CAMS.featLog`, `CAMS.target` (the look-at point), `CAMS.camS` (smoothing state: `fov`, `snap`, `gp`), `CAMS.snap()` (the next camera frame jumps instead of easing), `CAMS.buildGrid()` (a new course),
  `CAMS.reset()` (a new race).
- Spots and tests: `sees(a, b, margin)` (a sight line over the dirt and the hills), `safeCam(p, clearance)` (keeps a point above the dirt and the ground), `dirtTop(x, z)`, `terrainAt(x, z, y)`, `inFloor(p)` (keeps a camera inside the stadium bowl),
  `trackCam`, `featCam`, `lineCam`, `crashCam`, `yellowCam`, `gateCam`, `turn1Cam`, `spotCam`, `secPt`.
- It moves `VIEW.cam` (a `PerspectiveCamera`, near 0.5, far 4200): position, `lookAt`, `fov` (portrait phones get a wider vertical field). It does not move the sky or the shadow box (`race3d.js` does, right after).

### race3d.js (lead)

`supported()` (WebGL present) and `create(host, hooks {onLap(n), onFinish(), lost()}) -> V`. The API `game.js` uses is in the file's header: `V.setRace(o)`, `V.gate()`, `V.drop()`, `V.lap(result)` -> show,
`V.hold(o)`, `V.standings(order, cnt, lap)`, `V.setFlag(k)`, `V.setRed(seat)`, `V.markOut(seat)`, `V.show(on)`, `V.resize()`, `V.skip()`, `V.lapTime()`, `V.yellowAt(sector)`, `V.yellowOff()`, `V.stop()`, `V.dispose()`.
Tools for tests: `V.state()`, `V.stats()` (draw calls, triangles, frame times, pixel ratio, memory), `V.shot(name, o)`, `V.release()`, `V.advance(sec, noDraw)` (steps in 1/60 s; deterministic), `V.sweep(sec)`, `V.proj(seat)`,
`V.renderNow()`, `V.camInfo()`, `V.setShadows(on)`, `V.fixPR(p)` / `V.prFixed` (freeze the pixel-ratio ladder), `V.timeScale`, `V._dbg` (`riders()`, `fx()`, `state()` = the per-rider state array, `gate()`, `world()`, `marshal()`, `target()`, `sees()`, `dirt()`, `hf()`, `yellow()`, `shot()`, `pos()`, `clearance()`).
`V.renderer`, `V.scene`, `V.camera` are public. (`V._dbg.riders().part` is now `V._dbg.fx().part`.)
`V.camHook` (null; the capture harness' camera: `function(dt, riders, T) -> null | {eye: [x, y, z], target: [x, y, z], fov}`, applied right after the director's camera; the game never sets it). `V._dbg` also has `look()` (the `createLook` object: `.post`,
`.sun`, `.setShadows`), `quality()` (the `createQuality` object) and `cams()` (the cameras module), for experiments from the harness page (`__mxv3._dbg.look().post = ...`).

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
| cams | `create()` | `VIEW` (the live state) and `CAMS = createCams(VIEW)` |
| cams | `setRace` | `CAMS.buildGrid()` after the world is built; `CAMS.reset()` |
| cams | `step` | `CAMS.director(dt)`, `CAMS.camera(dt)` |
| cams | `beginCrash` | the cut to the crash camera (`CAMS.pickShot(true)`) |
| stadium | `setRace` | the flagger and the marshal are built; the big screen shows 0 / laps |
| stadium | `V.lap`, `step` | the big screen's lap number |
| stadium | `step` | `flagger.wave`, `marshal.wave`, `world.frame(dt, tw, cam)` |
| dirt | `step` | `world.dirt.frame(dt, RST)` |
| fx | `setRace` | the old `FX` is disposed; `FX = createFx(...)` is added to the scene |
| fx | `step` | `FX.step(dt)` |
| fx | `rider()` (two zones) | the effects inputs `st.roost`, `st.throttle`, `st.slip` (above `poseRider`); `FX.rider(st, dt)` (the last line) |
| fx | `beginCrash`, `crashPose` | `FX.crashStart(...)`, `FX.crashStep(...)` |
| bike | `rider()` | extra pose inputs for the bike (empty): compute any new `st.*` field `poseBike` needs, from the state above it |
| rider | `rider()` | extra pose inputs for the rider (empty) |
| rider | `step` | `commit(R)` |
| harness | `create()`, right after the view object `V` | `V.camHook = null` (frozen: the capture harness' camera, section 9) |
| harness | `step`, right after the cams zone | the `V.camHook` call: when the harness set a camera it replaces the director's position, look-at point (`CAMS.target`) and field of view; nothing happens in the game (frozen) |
| perf | `create()`, after `V.fixPR` | `V.qualityNames()`, `V.qualityLabel()`, `V.quality()`, `V.setQuality(name)`, `V.bench(o)`, `V.benchResult()`, `QUAL.bindLook(LOOK)`, `QUAL.attach(view)`; the harness, `perf.js`, `shots.js` and `finish.js` use them (section 9.4) |

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
| `th` | the track's heading at the rider. `yaw` = `-th` plus the whip in the air (the rotation about Y in the matrix) |
| `pitch` | bike pitch, + = nose up (includes weight transfer under throttle and brakes) |
| `lean` | bike roll, + = lean right (includes the air whip on the big jumps); the matrix angle |
| `v`, `acc` | speed along the track (m/s); its derivative (m/s^2) |
| `throttle` 0..1, `slip` 0..1, `roost` | derived in the `fx` zone: the throttle, the rear wheel digging, how hard it throws dirt (`roost` is the old particle demand; 6 at the gate drop) |
| `lat`, `s`, `D`, `onStart`, `k`, `tag`, `sand`, `gate` | lateral position on the track (+ right, m); distance along the lap (m); race distance (m); on the start path; track curvature (1/m, + right); the section (`"whoops"`, `"rhythm"`, `"jump"`, `"bigjump"`, `"rollers"`, ...); sand 0..1; riders still at the gate |
| `air`, `landed`, `impact`, `hAir` | an axle is on a jump arc; true on the frame the bike touches down; the downward speed just before it (m/s, 0 unless `landed`); the frame's height above the ground (m) |
| `gF`, `gR`, `tF`, `tR`, `gy` | the ride line under the front / rear wheel (with the whoops skim), the terrain under them, the lower of the two |
| `compF`, `compR` | suspension compression, fork / shock (m, + compressed, -0.12..0.28) |
| `spinF`, `spinR` | accumulated wheel spin (rad) |
| `stand`, `dab`, `crouch` | standing on the pegs 0..1; the inside foot out -1..1 (+ right); the crouch under load |
| `mud` | 0..1, kept between frames; nobody raises it yet (the fx / bike / rider specialists may) |
| `crash` | `null`, or `{kind: "remount" \| "out", t: seconds since the fall, hx, hy, hz: the rider's hip}` |
| `body`, `limbs` | reserved for `poseRider`'s crash pose (null in normal riding) |

## 6. The view's live state for the cameras (`VIEW`)

Getters on an object `race3d.js` owns (always the current value; never assign): `VIEW.cam`, `VIEW.C` (the course), `VIEW.world`, `VIEW.rs` (the riders' records), `VIEW.gate`, `VIEW.marshal`, `VIEW.T` (the race clock, s), `VIEW.lapNo`,
`VIEW.lenLaps`, `VIEW.mode` ("gate" | "race" | "idle"), `VIEW.holdInfo` (a war: `{war: [seat...]}`), `VIEW.yellow` (`{lap, s0, len, s}`), `VIEW.lapPlan` (`{n, win, over, last, rank0}`), `VIEW.meSeats`, `VIEW.W`, `VIEW.H` (canvas size),
`VIEW.leaderIdx()`. A rider record `rs[i]` (read-only for the cameras): `gone, crash ({kind, T, D, ...}), crashPlan, onStart, D, s, v, k (index), seat, pos (Vector3: the hip point, +1 m for a bike), th, gy, bikeP, lapN`.
A camera that needs more of the view's state asks for a new getter (REQUESTS).

## 7. Couplings to keep in step (the split did not remove them)

- The dirt's shoulder shape (a drop of 0.55 m outdoors / 0.3 m in a stadium over a width of 2.6 m, wider beside a tall jump; the grass apron) is built by `trackMesh` (dirt) and mirrored by
  `heightGrid` (cams), `surfY` and `placeMarshalS` (lead). Change it in one place and the others follow through REQUESTS.
- The stadium bowl is a superellipse (`e = 4`, rounded corners) built in `stadium()` (stadium) and mirrored by `inFloor` (cams) and `C.layout.floor`. `world.ctx.hf` is the terrain height the cameras and the fallen riders stand on.
- `BIKE` (bike) feeds the suspension physics in `race3d.js` and the IK targets in `r3d-riders.js`.
- The riders' atlas (rider) draws three cells per rider (plate, jersey back, tag) from `list[k] = {num, color, accent, red, me}`; `drawPlate` (bike) draws the plate's face.
- Opaque parts are drawn in material-creation order (three.js sorts by `material.id`); exact depth ties between two parts flip with it. The split keeps the original order (the bike's materials, then the rider's).
- Everything three.js builds draws its UUID from `Math.random()` (4 calls each): one more Group, material or texture shifts a seeded `Math.random` by that many calls. The capture harness reseeds after the world is built (section 9).
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
| B2 | stadium wide | 125 | eye [0, 33, 92] looking at [0, 0, 4], fov 50 | the whole course and all 22 riders (the broadcast / stadium_aerial target) |
| B3 | whoops | 46 | eye [-8, 2, -12] at [8, 1, -5], fov 42 | the first-lap pack skimming the whoops head-on |
| B4 | jump | 77.5 | eye [6, 1.1, 34] at [10, 3.2, 19], fov 45 | six riders in the air over the triple |
| B5 | gate | 1.6 | eye [-60, 2.2, 24] at [-45, 0.9, 33], fov 50 | the launch from the start gate |
| B6 | crash | 111.5 | eye [4, 3, -12.5] at [-2, 0.7, -6], fov 52 | a double-war loser thrown over the bars, dust, the yellow flag |

Camera specs (`DEMO.camera(spec)`, a plan's `cam`): a rider rig `{seat: "you" | "lead" | "crash" | N | {rank: k}, back, up, side, aim: 8 | {ahead, up, side}, fov, damp}` (metres along / across the rider's heading, + side = the rider's right; `damp` 0 = rigid) or a world pose
`{eye: [x, y, z] | at: {s, lat, h}, target: [x, y, z] | look: {s, lat, h} | follow: {seat, up, damp}, fov}` (`at` / `look`: course distance s in metres, lat across, h above the dirt); `null` = the view's own director. The view applies it through `V.camHook` (section 4, zone `harness`).
Known limits: a camera inside the stadium bowl clips the near stands (a dark band; the extra `B2b` is such a pose, the plan's `B2` is clear); `DEMO.step(0, true)` (a redraw) moves the clock by one microsecond, so use it to grab a frame, not inside a plan;
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
| `msaa` (canvas antialiasing; fixed when the renderer is made) | false | true | true | true |
| `res.maxPR` / `res.tvW` / `res.capW` / `res.start` | 1 / 1280 / 1280 / 0.75 | 1.25 / 1280 / - / 1 | 1.75 / 1280 / - / 1 | 2 / 1920 / - / 1 |
| `shadow` real / map size / soft | blob only / 512 / false | real / 1024 / false | real / 1024 / false | real / 2048 / true |
| `post` on / bloom (scale) / aa / dof / shafts | false / no bloom / none / false / false | true / bloom(0.5) / fxaa / false / false | true / bloom(1) / smaa / false / true | true / bloom(1) / smaa / true / true |
| `fog` far scale | 0.75 | 0.9 | 1 | 1 |
| `fx.particles` (ring buffer size) | 160 | 360 | 520 | 900 |
| `crowd.detail` / `crowd.anim` | 0.35 / false | 0.7 / false | 1 / true | 1 / true |
| `scenery.trees` / `scenery.terrain` | 0.4 / 0.5 | 0.7 / 0.8 | 1 / 1 | 1 / 1 |
| `riders.full` / `mid` / `near` m / `far` m | 4 / 6 / 14 / 40 | 8 / 8 / 22 / 60 | 12 / 10 / 30 / 80 | 22 / 0 / 60 / 120 |
| `tex.max` px / `aniso` / `budgetMB` | 512 / 1 / 24 | 1024 / 4 / 48 | 1024 / 8 / 96 | 2048 / 16 / 192 |
| budget: draw calls / triangles / geometry MB (whole frame) | 46 / 110k / 6 | 60 / 200k / 10 | 90 / 350k / 16 | 140 / 600k / 32 |

**Rules for builders.**
- Read `q.lo` for "the simple world" exactly as today (FIRE TV and Reduce effects). New detail goes behind a tier flag: crowd density and animation (`q.crowdDetail`, `q.crowdAnim`), trees and terrain (`q.trees`, `q.terrainDetail`), particle ring size (`q.particles`), texture size (`q.texMax`: choose the 512 / 1K / 2K file or canvas size from it), anisotropy (`q.aniso`, applied by `setAniso` at texture creation).
- Anything that moves at run time reads `q.live` / `QUAL.live` EVERY FRAME, not at build time: `live.particleScale` multiplies the roost / dust emission, `live.crowdAnim` stops the crowd's animation, `live.post` switches bloom / depth of field / the whole chain (a chain that is `on` only when `live.post.on`), `live.shadows` is the real shadow map (the view toggles `LOOK.setShadows` itself, and resizes the shadow map to `live.shadowSize`).
- Riders: draw the `q.riderLod.full` nearest riders in full, the next `mid` simplified, the rest minimal (`QUAL.lod.level[i]` / `st.lod`; hysteresis built in: a level changes only after 8 frames of asking). A bike or rider mesh is one instanced draw call per part type: keep it that way, draw calls (CPU) matter more than triangles on a Fire TV.
- Budgets (whole frame: the shadow pass counted): the last row of the table. `V.stats().calls / tris`, `DEMO.stats()` and the bench panel show them; `Q.budgetCheck(calls, tris)` says ok / over. Textures: `Q.memory(scene)`; the riders' number atlas (2048x640, 7 MB with mipmaps) is 43% of today's texture memory and larger than the FIRE TV tier's 512: it should follow `q.texMax`.
- Do not change `renderer.setPixelRatio` / `setSize` yourself: the ladder owns them (it also resizes the post chain through `LOOK.resize` and redraws the frame at once, so a resolution step never shows a blank frame).

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
