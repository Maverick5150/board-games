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
<!-- end dirt -->

## stadium
<!-- end stadium -->

## bike
<!-- end bike -->

## rider
<!-- end rider -->

## fx
<!-- end fx -->

## cams
<!-- end cams -->

## perf
<!-- end perf -->
