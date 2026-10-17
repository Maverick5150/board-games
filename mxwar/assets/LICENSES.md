# Motocross War 3D — third-party assets

Original art and code only. The one exception: CC0 material textures from ambientCG (ambientcg.com) or Poly Haven (polyhaven.com),
downloaded at 1K, converted to JPG / WebP, each set kept small. Record every texture here, under your role, before you commit it:
name, source URL, licence (CC0), the file(s) it became, what it is used for. No photos of people, crowds, brands or real venues, no logos,
no sponsor marks, no real liveries, no third-party models. The vendored three.js r160 (MIT) is `ui/vendor/three-0.160.0.LICENSE`.

Add your lines between your heading and its end marker only (this keeps the roles' branches merging without conflicts).

## base (vendored code, the integrator's; nobody else edits this section)
- three.js r160, `ui/vendor/three-0.160.0.module.min.js`: MIT, https://github.com/mrdoob/three.js (npm three@0.160.0), licence `ui/vendor/three-0.160.0.LICENSE`.
- three.js r160 add-ons, `ui/vendor/three-addons/` (56 files, flat, imports rewritten to the vendored engine): MIT, the `examples/jsm` folder of the same npm package, licence `ui/vendor/three-addons/LICENSE`,
  the list with each file's origin in `ui/vendor/three-addons/README.txt`. Code only, no models, textures or fonts. Made by `BG_audit/sprint/mxvis/tools/vendor-addons.js`. Not in the service worker's cache list until a
  module that imports one is merged (the integrator adds it then).
- The capture harness (`mxwar/demo.html`, `demo.js`, `demo-engine.js`, `demo-bookmarks.json`) is original code and is not part of the game.
<!-- end base -->

## dirt
- Poly Haven "Dirt Floor" (`dirt_floor`), https://polyhaven.com/a/dirt_floor, licence CC0 (public domain). Used: the 1K diffuse (luminance only, divided by its own large-scale blur so just the grain is kept) and the 1K displacement map, both
  downsampled to 512 x 512 and packed into the R and G channels of one 512 x 512 RGBA PNG, shipped as base64 in `mxwar/assets/dirt/dirt-tiles.js` (and as a 256 x 256 copy, `dirt-tiles-lo.js`, for Reduce effects / the TV), decoded by `r3d-dirt-png.js`. The packed arena dirt of the track.
- Poly Haven "Brown Mud Dry" (`brown_mud_dry`), https://polyhaven.com/a/brown_mud_dry, licence CC0 (public domain). Used the same way, packed into the B and A channels of the same PNG. The crumbly loose dirt (edges, roost, windrows).
- Everything else the dirt draws (the relief, the ruts, the track-space texture, the start strip) is original code (`r3d-dirt-relief.js`, `r3d-track.js`). Nothing is loaded from a CDN at run time.
- Made by `BG_audit/sprint/mxvis/dirt/tools/pack_tiles.py` (the packing) and `make_b64.js` (the base64 module and a check that the decoder is bit-exact against zlib).
<!-- end dirt -->

## stadium
- No third-party texture, model, font or photo is used by the stadium: every texture (the two crowd atlases of 64 little people, the ad boards, the LED ribbon, the suites' windows, the video boards, the gate / finish / hanging banners, the glow and starburst sprites) is drawn in code at build time
  (`mxwar/r3d-stadium-art.js`), every model is plain geometry (`r3d-stadium-bowl.js`, `r3d-world.js`). The writing on the boards is plain words of the game (MOTOCROSS WAR, FULL SEND, DOUBLE WAR, ACE HIGH, HOLESHOT, MAIN EVENT, START, FINISH,
  lap numbers, the leader's number, the race clock) in the brand palette (war red, stadium gold, hud white, night black). No real sponsor, logo, brand, venue or person.
<!-- end stadium -->

## bike
- Nothing third-party. The motorcycle is original code (`mxwar/r3d-bike-model.js`, `mxwar/r3d-bike.js`): geometry, the knob pattern, the livery mask, the night-stadium reflection map and the mud are all drawn / generated in code at run time. No photographs, no brand shapes, no logos, no sponsor marks, no downloaded textures or models.
<!-- end bike -->

## rider
<!-- end rider -->

## fx
<!-- end fx -->

## cams
<!-- end cams -->

## perf
<!-- end perf -->
