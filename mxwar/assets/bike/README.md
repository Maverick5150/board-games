# The bike (role `bike`): what is in the tree and how to use it

Files: `mxwar/r3d-bike-model.js` (the geometry: every part of a 450 cc Supercross bike built in code, three levels of detail), `mxwar/r3d-bike.js` (BIKE constants, materials and the shader,
the instanced level-of-detail sets, colours, number plates, the pose), `mxwar/assets/bike/viewer.html` + `viewer.js` (the bike's own test page, not part of the game, not in `sw.js`),
the `[hook:bike]` zone in `mxwar/race3d.js` `rider()` (the inputs `st.lodD`, `st.lodCut`, `st.mud`). No third-party assets.

## The bike
Original design (no brand shapes, no logos): aluminium twin-spar frame, steel cradle, subframe, engine cases with clutch / ignition covers, cylinder with fins and head, throttle body, shrouds over the
radiators with louvres (team colour), tank, long seat, side panels and rear fender (team colour, livery graphics in the accent colour), exhaust header sweeping round the right side into a muffler,
a fork with gold lower legs, polished upper tubes, fork guards, triple clamps, bars with crossbar and pad, grips, levers, master cylinder, wave brake discs and calipers (front right, rear right),
chain (left) with sprockets, an aluminium swingarm, rear shock with coil spring in the accent colour, linkage, footpegs, front number plate and two side plates. Knobby tyres: real knob geometry on LOD 0
(130 knobs on the rear tyre), simplified knobs on LOD 1, a smooth crown on LOD 2. 21 inch front / 19 inch rear wheels, wheelbase 1.48 m, seat 0.96 m, steering head raked 27 degrees.

## Levels of detail (InstancedMesh sets; bikes are packed into the slots 0..count-1 of the set their distance picks, so the draw counters are honest)
| set | distance (m) | triangles per bike | draw calls |
|---|---|---|---|
| LOD 0 | < 9.5 | about 21,800 (3,764 + 4,240 of them the two wheels) | 7 meshes |
| LOD 1 | 9.5 .. 36 | about 5,600 | 7 meshes |
| LOD 2 | > 36 | 776 (one static mesh) | 1 mesh |
| Reduce effects / Fire TV tier (`lo`) | LOD 1 < 8 m, LOD 2 beyond; Lambert version of the same shader | | |

The distance is `st.lodD` (see below); a bike behind the lens or well outside the picture counts 2.6 times further, a narrow lens counts nearer.

## What a caller passes and reads
- `createBike(n, lo, mk, q?)` -> `M` (as before: `mk(geo, count, material)` is the instancing glue). `M` holds every InstancedMesh as `M["bk<lod>_<part>"]` and the state as `M.bk`. `q` (the quality options) is optional.
- `colorBike(M, i, R)`: `R = {color, accent}` as before. `poseBike(M, i, B, st)` and `hideBike(M, i)` as before; every rider must be posed or hidden once per frame, in index order (a lower index than the last call starts a new frame).
- `st` fields `poseBike` reads: `compF`, `compR` (suspension compression, m: the fork slides along its axis, the swingarm pivots on its arc, the shock is a bone from the linkage to the frame mount and shortens by 0.11 m at full travel),
  `spinF`, `spinR` (wheel spin; the spokes fade by screen-door dither when a wheel turns more than 9 degrees a frame), `lodD`, `lodCut`, `mud` (0..1), `steer` (rad, + right) or else the track curvature `k`.
- Steering: the front end (bars, clamps, upper fork tubes, lower legs, fender, front wheel, front plate) turns about the real steering axis by `steerOf(st)` = `steerAngle(st) * BIKE.steerGain` (0.6 for now, max 0.34 rad).
  The rider's hands should follow the grips: `steerPoint(p, steerOf(st), out)` rotates a bike-space point (`BIKE.GRIP` with z mirrored for the left hand) the same way. When r3d-riders.js uses it, set `BIKE.steerGain = 1`.
- `BIKE` (new fields, nothing removed): `RAKE`, `UP` (the fork axis), `FWD`, `STEER_PT`, `HEAD` (the top clamp on the steering axis), `ARM` (swingarm length), `SEAT` (the top of the seat where the hips rest), `KNEE` (a shroud contact point),
  `SHOCK_TOP`, `SHOCK_BOT`, `SHOCK_STROKE`, `STEER_MAX`, `CHAIN_SPROCKET`. `WB`, `WR`, `FA`, `RA`, `PIVOT`, `GRIP`, `PEG`, `TRAVEL`, `SAG` keep their numbers (PIVOT moved from x -0.08 to x -0.17: a real swingarm length).
- `lodCounts(M)` -> bikes in each set this frame. `PLATE_L`, `plateGeo()`, `drawPlate(...)` as before (the plate is a black plate with a white or red face).

## The bike's inputs in race3d.js (`[hook:bike]`, inside `rider()`)
`st.lodD` (distance to the lens, scaled by the field of view, x2.6 when off screen), `st.lodCut` (the camera jumped more than 3 m since the last frame: the level of detail is chosen afresh, so a frame never depends on the shot before it),
`st.mud` (0..1, kept between frames: +0.00058 per metre ridden, x3.5 in sand, + up to 0.03 on a hard landing).

## The test page
`mxwar/assets/bike/viewer.html` (the real modules in a small stadium-lit scene, the same light rig as r3d-look.js): `window.VIEWER.shot(cfg)`; the scripts in `BG_audit/sprint/mxvis/bike/tools/vshots.js` and `shots1.js`, `shots2.js` drive it through the runner.
