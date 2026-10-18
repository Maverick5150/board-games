# The bike (role `bike`): what is in the tree and how to use it

Files: `mxwar/r3d-bike-model.js` (the geometry: every part of a 450 cc Supercross bike built in code, three levels of detail), `mxwar/r3d-bike.js` (BIKE constants, materials and the shader,
the livery, the side-panel number atlas, the instanced level-of-detail sets, the wheels' blur discs, colours, number plates, the pose), `mxwar/assets/bike/viewer.html` + `viewer.js` (the bike's own test page, not part of the game, not in `sw.js`),
the `[hook:bike]` zone in `mxwar/race3d.js` `rider()` (the inputs `st.lodD`, `st.lodCut`, `st.mud`). No third-party assets: every texture is drawn in code.

## The bike
Original design (no brand shapes, no logos): aluminium twin-spar frame, steel cradle, subframe, engine cases with clutch / ignition / water-pump covers, cylinder with fins and head, throttle body, shrouds over the
radiators with louvre fins over a black vent (team colour), tank, long seat, side panels and rear fender, exhaust header sweeping round the right side into a muffler with a machined end cap and a dark outlet pipe,
a fork with gold lower legs, polished upper tubes, fork guards, triple clamps, bars with crossbar and pad, grips, forged levers along the bars, handguards in the team colour on alloy mounts, master cylinder,
the front brake line (bars -> right fork leg -> caliper), the clutch cable and two throttle cables, radiator hoses, a moulded skid plate with wings, wave brake discs and calipers (front right, rear right) and the
rear brake line along the swingarm, chain (left) with real link plates on LOD 0, a sprocket with a six-arm web, an aluminium swingarm, rear shock with coil spring in the accent colour, linkage, cleated footpegs,
a curved front number plate. Knobby tyres: real knob geometry on LOD 0 (130 knobs on the rear tyre), simplified knobs on LOD 1, a smooth crown on LOD 2; moulded marks and a raised ring on the sidewalls (shader).
21 inch front / 19 inch rear wheels, wheelbase 1.48 m, seat 0.96 m, steering head raked 27 degrees.

## The graphics (milestone 2)
- **Livery v2**: four masks in one RGBA texture (1024 x 512; 512 x 256 on the Fire TV tier / Reduce effects), packed from four canvases: r = accent colour, g = black, b = white, a = where the team colour carries the team's
  fine pattern. Shroud: a black lower band, a wide accent blade from the vent to the tank, a thin slash, white pinstripes; side panel: a black front corner, an accent band under the seat with a pinstripe,
  two chevrons behind the number, a black tail; fenders (seen from above): an accent centre stripe with pinstripes and a black chevron at the tip. The shader works the coordinates out from the model position, so every level of detail wears it.
- **A style per team**: `styleOf(team colour)` (0..3) picks which mask takes which colour (accent / black / white) and the fine pattern the shader draws in the pattern zones: honeycomb, halftone dots that grow toward the front,
  pinstripes, or shards. The fenders are the team colour, white or the accent colour by style. Every pattern fades to its mean where a pixel covers a cell (no shimmer without anti-aliasing).
- **The number and the name on the side panels**: a per-race atlas (`decalAtlas`, one 128 x 72 cell per rider; 64 x 36 on the Fire TV tier), three masks (background, numerals + surname, border), projected by the shader onto
  both side panels (mirrored on the left so it reads correctly) in the class colours (`PLATE_CLASS`: 450 = white with black numerals; `setPlateClass("250")` = black with white numerals) and in red with white numerals for the
  points leader (`st.red`, no redraw). Mud and the clear coat go over it like over the plastic. The old flat side-plate quads are no longer drawn (`poseBike` gives them a zero matrix).
- **The front plate** (`drawPlate`, the riders' atlas cell): a team-coloured plastic plate with a dark rim, the rider's surname across its top, the class-coloured number background, the numerals, a gold ring for the person's rider;
  the plate geometry (`plateGeo`) is curved round the fork.
- **Clear coat**: on the high kit tier (`getKitTier() === "high"`: HIGH / ULTRA) the bike's material comes from the lead's kit (`MAT.gloss`, MeshPhysicalMaterial); the shader keeps the coat on the plastics only and takes it off where mud lies.

## Mud (milestone 2)
`st.mud` (0..1) drives three layers: a caked coat that creeps up from the lower parts, the rear, the undersides, the skid plate and the tyres; splats flung back off the wheels (stretched along the bike) in two sizes
(about 2.6 cm and 1 cm cells, one integer hash a cell: no float hash, frames stay byte-identical); wet (dark, glossy) and dry (light, rough) patches. The Fire TV tier draws the coat and the big splats only.

## The spinning wheels (milestone 2)
A fast wheel's spokes thin out by screen-door dither (82% at most, from the wheel's turn a frame) and a translucent, lit **blur disc** in each plane of spokes takes over (densest at the hub where the spokes crowd):
one instanced draw per level of detail for both wheels of every bike (`M["bk<lod>_blur"]`, attribute `aBlur`), no shadow pass, faded near the lens like the bike. The far level's wheel disc is a dark grey (a spinning wheel at a distance).

## Levels of detail (InstancedMesh sets; bikes are packed into the slots 0..count-1 of the set their distance picks, so the draw counters are honest)
| set | distance (m) | triangles per bike (milestone 1 -> 2) | draw calls |
|---|---|---|---|
| LOD 0 | `q.bikeLod[0]`, the nearest `q.bikeHi` only | 21,820 -> 26,748 | 7 meshes + 1 blur disc mesh (112 triangles a wheel pair... 2 instances a bike) |
| LOD 1 | to `q.bikeLod[1]` | 5,632 -> 6,978 | 7 meshes + 1 blur disc mesh |
| LOD 2 | beyond | 776 (one static mesh) | 1 mesh |
| Reduce effects / Fire TV tier (`lo`) | LOD 1 < 8 m, LOD 2 beyond; Lambert version of the same shader | | |

The distance is `st.lodD` (see below); a bike behind the lens or well outside the picture counts 2.6 times further, a narrow lens counts nearer.

## What a caller passes and reads
- `createBike(n, lo, mk, q?)` -> `M` (as before: `mk(geo, count, material)` is the instancing glue). `M` holds every InstancedMesh as `M["bk<lod>_<part>"]` (parts `body`, `steer`, `fork`, `swing`, `shock`, `wheelF`, `wheelR`, `blur`; `far`) and the state as `M.bk`.
- `colorBike(M, i, R)`: `R = {color, accent, num, name, red}` (the riders' list entry): the team colours, the team's style and the rider's cell in the side-panel atlas. `poseBike(M, i, B, st)` and `hideBike(M, i)` as before; every rider must be posed or hidden once per frame, in index order.
- `st` fields `poseBike` reads: `compF`, `compR`, `spinF`, `spinR`, `lodD`, `lodCut`, `mud` (0..1), `red` (the red plate), `steer` (rad, + right) or else the track curvature `k`.
- Per-instance `aMud` is a vec4 now: (mud, the team's style, the wheels' blur, the rider's atlas cell + 0.5 for the red plate). `aMat.z` = tint + 4 * kind + 32 * (wheel / shock part); kinds: 0 plain, 1 spoke, 2 tyre, 3 solid team colour (handguards, fins), 4 skid plate.
- Steering: the front end turns about the real steering axis by `steerOf(st)` = `steerAngle(st) * BIKE.steerGain` (1). `steerMatrix`, `steerPoint`, `steerXYZ` as before (the rider's hands follow the grips).
- `BIKE`: unchanged (`WB`, `WR`, `FA`, `RA`, `HEAD`, `PIVOT`, `GRIP`, `PEG`, `SEAT`, `KNEE`, `TRAVEL`, `SAG`, `RAKE`, `UP`, `FWD`, `STEER_PT`, `ARM`, `SHOCK_TOP`, `SHOCK_BOT`, `SHOCK_STROKE`, `STEER_MAX`, `CHAIN_SPROCKET`, `steerGain`).
- New exports: `PLATE_CLASS`, `setPlateClass(c)`; `buildBlurDisc(seg)` in the model. `lodCounts(M)`, `PLATE_L`, `plateGeo()`, `drawPlate(...)` as before.

## The bike's inputs in race3d.js (`[hook:bike]`, inside `rider()`)
`st.lodD` (distance to the lens, scaled by the field of view, x2.6 when off screen), `st.lodCut` (the camera jumped more than 3 m since the last frame: the level of detail is chosen afresh, so a frame never depends on the shot before it),
`st.mud` (0..1, kept between frames: +0.00058 per metre ridden, x3.5 in sand, + up to 0.03 on a hard landing).

## Evidence
Milestone 2 captures (the harness' race, seed and cameras; BEFORE = mxvis 42bb9f4, AFTER = this branch): `BG_audit/sprint/mxvis2/bike/` (`cap/before`, `cap/after*`, the close-up plan `tools/bike-plan.json` with K1-K8, the capture script `tools/bk-cap.js`).
