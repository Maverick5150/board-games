# Motocross War 3D — CONTRACT

Who owns which file, what every module exposes, where each specialist plugs into `race3d.js`, and what data the view hands every frame.
Written by the file-split step (2026-10-17, branch `mxvis-split`, base `mxvis` = commit 7dec470). The split changed no pixel: 84 captured
frames over 10 scenarios (stadium, outdoor, speedway, a crash lap with a remount, a crash-out and the yellow flag, Reduce effects, reduced
motion, a portrait phone, a TV, a restored race, three races in one view) are bit-identical before and after, with the same draw calls,
triangles, state and shot choices (section 9).

The race renderer is three.js r160 (`ui/vendor/three-0.160.0.module.min.js`, ES modules, WebGL2). The race view is only these files:
`race3d.js` and `r3d-*.js` in this folder. `game.js` creates it (`create(host, hooks)`) and talks to it through `V.*` (header of `race3d.js`).
Nothing in this contract changes how `game.js`, the engine (`race.js`, `round.js`, `season.js`), `course.js` or `layouts.js` work.

## 1. Rules for every specialist

- OWN WORKTREE: `git -C "C:/Users/Maverick/Documents/BG_mxV" worktree add "C:/Users/Maverick/Documents/BG_mxV-<role>" -b mxvis-<role> mxvis`
  (or reuse it; `mxvis` is the branch the split commit is merged into: if it is not merged yet, start from `mxvis-split`). Work and commit only there. Never push, never touch tags, never edit the main repo or the other `BG_*` folders.
- EDIT ONLY YOUR FILES (section 2). In `race3d.js` edit only between the lines `// [hook:<your role>]` and `// [/hook:<your role>]`. Nothing
  else in `race3d.js`, and no other module. New files: `r3d-<role>-*.js` or `mxwar/assets/<role>/...`; list a new `.js` in `sw.js` ASSETS only
  through a REQUEST (the integrator owns `sw.js`).
- NEED SOMETHING IN A FILE YOU DO NOT OWN? Work around it, and write it under REQUESTS in your report (file, what, why). The integrator applies it.
- HOOK ZONES ARE YOURS ALONE: two specialists never edit the same lines, so the branches merge without conflicts. A zone may be empty (only
  comments): add your lines between its markers.
- ART: original art and code only. CC0 textures from ambientCG / Poly Haven are allowed (1K, converted to JPG / WebP, small); record each in
  `mxwar/assets/LICENSES.md` under your role (name, URL, CC0). Never: photos of people, crowds, brands or real venues, logos, sponsor marks,
  real liveries, third-party models, rider names or numbers as anything but plain text, makes as anything but team colours. Everything vendored,
  nothing loaded from a CDN at run time.
- CPU: the 4-core laptop is shared (at most 90% sustained). Every browser run or long script goes through the runner:
  `powershell -NoProfile -ExecutionPolicy Bypass -File "C:/Users/Maverick/Documents/Board Games/.dev/run-one.ps1" -Cmd 'node "C:/full/path/script.js"' -TimeoutSec 300`
  One browser per script (`kit/browser.js`), at most 3 pages, `await b.close()` in `finally`, never in the background, never a sub-agent.
- EVIDENCE: judge your work only by captures from the running view (section 9: the same track, riders, seed, clock and cameras, so a
  before / after pair differs only by your change). Look at every capture next to the cover. Never call something finished that you have not
  seen working. Report failures and limits with numbers.
- PRESERVE THE GAME (section 10). Reduce effects, reduced motion, the no-WebGL fallback, paused while hidden: all keep working.
- TIME: about 2 hours. Commit working steps early; a tested, committed improvement beats an unfinished big one.

## 2. Ownership

| Role | Files | Hook zones in `race3d.js` | What it is |
|---|---|---|---|
| lead | `race3d.js` (everything outside the zones), `r3d-util.js`, `r3d-look.js`, `CONTRACT.md`, `sw.js` | none (it is the rest of the file) | the view: `create()`, the race state machine, rider motion and the cards sync, the crash scripts, the frame loop; shared helpers; renderer settings, light rig, fog, the post-processing slot |
| dirt | `r3d-track.js`, `mxwar/assets/dirt/` | `dirt` | the track SURFACE: soil, dirt maps, the track ribbon (berms, jump faces, whoops, sand, the start path), its material, the lane-edge blocks |
| stadium | `r3d-world.js`, `mxwar/assets/stadium/` | `stadium` | everything round the track: stands, crowd, suites, walls, light rigs and glow, the big screen, sky, start gate, finish line, flaggers and flags, outdoor terrain, trees, paddock, speedway infield; `buildWorld()` |
| bike | `r3d-bike.js`, `mxwar/assets/bike/` | `bike` | the motorcycle: `BIKE` constants, part geometries, materials, instanced meshes, plates, the bike's pose |
| rider | `r3d-riders.js`, `mxwar/assets/rider/` | `rider` | the rider: geometry, two-bone IK, poses (seated, standing, dab, crash body), the number atlas, blob shadows, number tags, the instancing glue |
| fx | `r3d-fx.js`, `mxwar/assets/fx/` | `fx` | roost, dust, impacts: the particle system and when / how much to emit |
| cams | `r3d-cams.js` | `cams` | the TV director, every camera rig, the sight tests, the camera itself |
| perf | `r3d-quality.js` | `perf` | the quality tiers, the adaptive pixel-ratio ladder, weak-GPU detection, reduce-effects and TV flags, the options every builder receives |
| qa | no code | none | compares real captures with the cover, rejects weak results |

Not part of the view, nobody edits them in this phase (the integrator does, at the game-integration step): `game.js`, `index.html`, `course.js`,
`layouts.js`, `race.js`, `round.js`, `season.js`, `brain.js`, `art.js`, `track.js` (the 2D track), `data/`.

### Dependencies (no cycles)

```
r3d-util.js        <- everything (three.js only)
r3d-quality.js     <- util
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
**`L.post = null` is the post-processing slot**: set it to `{render(scene, cam), resize(W, H, pr)}` and every frame is drawn through it (bloom, depth of field, SMAA).

### r3d-quality.js (perf)

`isTV()` (page has `data-tv`), `motionMode()` -> `"off"` (reduced motion) | `"lo"` (Reduce effects) | `"full"`, `detectWeakGPU(renderer)`.
`createQuality({host, lo, setShadows(on), shadowsOn(), W(), H()}) -> Q`: creates the WebGLRenderer (`Q.renderer`; antialias off with Reduce effects), sets anisotropy, tests the GPU.
`Q.weakGPU`, `Q.pr` / `Q.prCap` (the current / maximum pixel ratio), `Q.fixed`, `Q.stats {prDrops, shadowDrop}`, `Q.shadowsWanted(LO)`,
`Q.resize(w, h, W, H, LO) -> pr` (the cap per device: a TV at most 1280 wide, 960 with Reduce effects; a phone 1.75, 1.0), `Q.adapt(dt)` (every frame: frames over 34 ms for 1.2 s drop the real shadows,
for 1.5 s lower the pixel ratio by 15% down to half the cap; fast frames raise it again), `Q.fix(p, W, H)` (tests),
**`Q.options(LO) -> {lo}`: the quality options `buildWorld(C, look, q)`, `createRiders(list, q)` and `createFx({C, look, ...q})` receive.** Tiers (a crowd density, a particle budget...) go
here; the builders read the fields they know. A field that changes what is BUILT must also go into the world's cache key (the `[hook:perf]` zone next to `key` in `V.setRace`).

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

## 4. race3d.js: the frame, and the hook zones

Every frame (`tick` -> `step(dt)` -> `render()`): the clock and the lap boundaries (the leader starts a lap: `hooks.onLap`) -> each rider's gap, position, racing line and passing room ->
the flagger and the show moments -> **per rider `rider(i, r, dt)`**: speed, the two sprung axles, stance, the bike matrix, the per-rider state `st`, `poseRider`, the blob shadow, `FX.rider` ->
`FX.step` -> `commit` -> `world.dirt.frame` -> flagger and marshal waves, `world.frame` -> `CAMS.director`, `CAMS.camera` -> the sky follows the lens, `LOOK.fitShadow` -> the number tags ->
`LOOK.render` -> `QUAL.adapt`. A crashed rider goes through `crashPose` instead of the riding branch (a double-war loser tumbles, lies, gets up, lifts the bike, remounts; a triple-war loser walks off).

Zones (find them with a search for `[hook:`); each role may change only its own lines:

| Role | Where | What is there now |
|---|---|---|
| perf | `create()` top | `QUAL = createQuality(...)`, `renderer = QUAL.renderer` |
| perf | `setRace` | Reduce-effects change (`LOOK.setShadows(QUAL.shadowsWanted(LO))`); the world cache `key`; `buildWorld(C, look, QUAL.options(LO))` |
| perf | `tick`, `V.resize` | `QUAL.adapt(dt)`; `QUAL.resize(w, h, W, H, LO)` |
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

## 9. Testing and evidence

Everything is at `C:/Users/Maverick/Documents/BG_audit/sprint/mx3d-split/` (outside the repo).

- **Lint (run it before every commit):** `node --expose-internals C:/Users/Maverick/Documents/BG_audit/sprint/mx3d-split/lint-modules.js mxwar/race3d.js mxwar/r3d-*.js` — reports an identifier that nothing declares, a name imported from a module that does not export it, a missing file. Exit 0 = clean. Light: run it directly.
- **Deterministic captures** (`harness.html`, `cap.js`): a page with a seeded `Math.random`, a fake clock, no animation loop; `V.advance` steps in 1/60 s; laps are run by the driver with the real engine (`race.js`, seed 12345; riders: the 7 makes; "R5" is the person, "R3" has the red plate).
  `node cap.js <set> [scenarios] [/path/to/tree]` writes `out/<set>/<scenario>-NN-<name>.png` (640 x 360 unless the scenario says otherwise, pixel ratio 1) and `summary.json` (draw calls, triangles, geometries, textures, `V.state()`, `V.camInfo()` per frame).
  Scenarios: `S` stadium (the gate, the director, whoops, jump, rhythm, line, heli, chase, track, a battle), `O` outdoor (RedBud), `H` speedway hybrid (Daytona), `C` a crash lap (a double-war remount, the yellow lap, a triple-war crash-out),
  `L` Reduce effects, `M` reduced motion, `P` portrait phone, `R` a restored race (`standings`, `setRed`, `hold`, flags, `markOut`, `skip`), `N` three races in one view, `T` a TV. The tree path is the folder holding `mxwar/` and `ui/vendor/` (default for set `after`: `/BG_mxV-split`;
  give your worktree: `/BG_mxV-<role>`; the images of the base commit are in `out/before/`). Run it through the runner (section 1).
  `node cmp.js before <set>` compares two sets pixel by pixel (differing pixels, the biggest channel difference, draw calls / triangles / state, a `DIFF-*.png` where red = changed): a before / after pair on the same track, riders, seed and cameras.
  Frame times measured in software GL mean nothing; frame rates come from the GPU kit, on the device.
- **The view's tool API** (`api-check.js`): runs `V.sweep`, `V.proj`, `V.camInfo`, `V.stats`, `V.order`, `V.setShadows`, `V.fixPR`, `V._dbg.*`, `V.dispose` on the base tree and on `/BG_mxV-split` and prints SAME / DIFF per call (a new `_dbg` key is a DIFF you expect).
- **Real game flow:** `game-flow.js` (phone 390 x 844: setup -> season -> line-up -> the 3D gate -> the drop -> real-time laps -> the flag -> results; no console errors allowed).
- **Engine tests** (copies of B's): `course_test.js`, `crash_test.js`, `season_test.js`, `timing_test.js`, `venues_test.js` in the same folder (node, light).

### What the split proved (2026-10-17)

84 frames, 10 scenarios: 0 differing pixels, identical draw calls / triangles / geometries / textures / state / shot choices; the base commit captured twice also matches itself (the harness is deterministic).
The real game page: one 8-lap heat from setup to the results sheet, places 1..20 unique, no console error or warning. Engine tests: all pass. `race3d.js` went from 876 to about 650 lines; the other code moved byte for byte except the places listed in the commit message.

## 10. What the split changed in the code (for the integrator)

- New: `r3d-util.js`, `r3d-look.js`, `r3d-quality.js`, `r3d-track.js`, `r3d-bike.js`, `r3d-fx.js`, `r3d-cams.js`. Rewritten from slices: `r3d-world.js`, `r3d-riders.js`, `race3d.js`. `sw.js`: the new files are cached, `mxwar-v7`.
- `r3d-cams.js`: the closure variables of the old `create()` (`C`, `rs`, `T`, `lapNo`, `mode`, `world`, `gate`, `marshal`, `yellow`, `lapPlan`, `holdInfo`, `meSeats`, `lenLaps`, `W`, `H`, `leaderIdx`) are read as `VIEW.name`; nothing else in the camera code changed.
- Particles: made by `createFx` (they were part of the riders' group, `R.part`); the emission rules (landing dust, roost, the crash bursts) are `FX.rider`, `FX.crashStart`, `FX.crashStep`, same Math.random order. `emit` / `stepParticles` take the particle system instead of `R`.
- `poseRider` is `poseBike` (bike) + the rider's pose. `hideRider` is `hideBike` + the rider's parts. Mesh casting flags are set where the meshes are made.
- Per-rider state: `st` objects (section 5) replace the literal that `poseRider` used to get. New fields (`throttle`, `slip`, `roost`, `landed`, `impact`, `mud`) are derived values; nothing reads them yet except `FX.rider` (`roost`, `landed`).
- Quality: `QUAL.options(LO)` replaces `{lo: LO}` at the three builders; `QUAL.pr` / `QUAL.prCap` / `QUAL.stats.prDrops` feed `V.stats()`.
