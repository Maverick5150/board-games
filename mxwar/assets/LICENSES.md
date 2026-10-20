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
- No third-party assets. The rider (skeleton, skinned mesh, weights, colours, the number patch) is generated in code by `mxwar/r3d-rider-model.js`; the poses are `mxwar/r3d-rider-pose.js`; the number atlas is drawn on a canvas with the page's own font. No models, textures, photos or logos were downloaded.
<!-- end rider -->

## fx
- No third-party assets. Everything the effects draw is original code made at run time: the dust puff atlas (blurred radial gradients turned into a normal / density map in code), the clod rocks (a jittered icosahedron / octahedron), the mud flecks (a procedural shader). No textures, models, fonts or photos are loaded.
<!-- end fx -->

## cams
<!-- end cams -->

## perf
<!-- end perf -->

## shows-music
- The broadcast's show music (the shows, the menu, the bumpers, the podium, the replay wipes), package `mxwar/audio/base/` (`pkg.json` lists every cue). Picked by the CEO by ear from the listening reel (2026-10-19,
  `BG_audit/sprint/mxshow/music/CEO-PICKS.md`); cut, looped and levelled to -16 LUFS by our own tool (`BG_audit/sprint/mxshow/w3/tools/cutpkg.js`, never shipped). AAC-LC 128 kbit/s. The same credits are
  in `pkg.json` (`credits`) and come back from `Sound.show.credits()` for the Credits sheet. Only CC0 and CC BY works and our own code-made audio; no real song, sound-alike or broadcast theme.
- "Hotrock" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/ (ISRC USUAN1100201). Source: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Hotrock.mp3. Became `bumper-c1.2d186281.m4a`, `long-c1.d939f5f4.m4a`, `next-c1.a62de2c3.m4a`. Used for: Up next: the next race; menu (after the theme) and finale; Up next / next week. Changes: cut, looped and levelled for Motocross War.
- "Welcome to the Show" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/ (ISRC USUAN1100013). Source: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Welcome%20to%20the%20Show.mp3. Became `open.9dd73277.m4a`. Used for: the cold open's first frame. Changes: cut and levelled for Motocross War.
- "Last Stand Lets Go" by Peachtea (Noah Cedeno) (https://opengameart.org/content/last-stand-lets-go), CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), public domain dedication: credited as a courtesy. Became `bumper-c3.bc74c402.m4a`, `long-c3.a5a1af06.m4a`, `next-c3.d33a23e6.m4a`. Used for: Up next: the next race; menu (after the theme) and finale; Up next / next week. Changes: cut, looped and levelled for Motocross War.
- "The Wreck" by Zander Noriega (https://opengameart.org/content/the-wreck), CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/). Became `bumper-c4.6d6e209c.m4a`, `long-c4.bc32aff4.m4a`, `next-c4.0efca8ba.m4a`. Used for: Up next: the next race; menu (after the theme) and finale; Up next / next week. Changes: cut, looped and levelled for Motocross War.
- "Exhilarate" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/ (ISRC USUAN1300028). Source: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Exhilarate.mp3. Became `bumper-c5.dfacddec.m4a`, `long-c5.9b3e5206.m4a`, `next-c5.3b42a57b.m4a`. Used for: Up next: the next race; menu (after the theme) and finale; Up next / next week. Changes: cut, looped and levelled for Motocross War.
- "Ready Aim Fire" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/ (ISRC USUAN1500002). Source: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Ready%20Aim%20Fire.mp3. Became `bumper-c6.a044ea4c.m4a`, `long-c6.c919b698.m4a`, `next-c6.a996b167.m4a`. Used for: Up next: the next race; menu (after the theme) and finale; Up next / next week. Changes: cut, looped and levelled for Motocross War.
- "Summon the Rawk" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/ (ISRC USUAN1200050). Source: https://incompetech.com/music/royalty-free/mp3-royaltyfree/Summon%20the%20Rawk.mp3. Became `bumper-c7.9974fab9.m4a`, `long-c7.195a5d4a.m4a`, `next-c7.f5f1b478.m4a`. Used for: Up next: the next race; menu (after the theme) and finale; Up next / next week. Changes: cut, looped and levelled for Motocross War.
- "Megasong" by Emma_MA (https://opengameart.org/content/megasong), CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/), public domain dedication: credited as a courtesy. Became `outro.33da1067.m4a`, `podium.d4cdbb12.m4a`, `recapB1.1dfb6533.m4a`, `recapB2.d12175f3.m4a`. Used for: the sign-off, the cut to the gate; the podium: the song's last 16 bars and its final hit; the recap and the replays; the recap, high stakes. Changes: cut, looped and levelled for Motocross War.
- "MX War Theme", Motocross War (original, made by the game's own code): no licence needed (made for Motocross War). Became `checkered.9f57b7f5.m4a`, `hit.fd5ff5fb.m4a`, `preA1.2ff8a679.m4a`, `preA2.18aafb0e.m4a`, `theme.82dff8a7.m4a`, `title.f5494759.m4a`, `war.3817f7bc.m4a`. Used for: the Main's winner takes the flag; a stat lands, a stamp; the pre-race talk; the pre-race talk, high stakes; the signature under the title card; the title / first menu: the whole theme as the CEO heard it; the WAR flash. Changes: made for Motocross War.
- "Replay whooshes", Motocross War (original, synthesized by the game's own code): no licence needed (made for Motocross War). Became `whooshIn.f6d675c6.m4a`, `whooshOut.509bb9e1.m4a`. Used for: into a replay; back to live. Changes: made for Motocross War.
<!-- end shows-music -->

## race screen fonts
- Barlow Condensed SemiBold and Bold, `mxwar/assets/fonts/barlowcondensed-600-latin.woff2` (22 308 B, sha256 215a93c6...cbb2b66) and `barlowcondensed-700-latin.woff2` (22 444 B, sha256 3787a5a4...dc11ec090fdc3ee2b8):
  SIL Open Font License 1.1, no Reserved Font Name; Google Fonts' latin subset (https://fonts.gstatic.com/s/barlowcondensed/v13/); "Copyright 2017 The Barlow Project Authors (https://github.com/jpt/barlow)";
  licence `mxwar/assets/fonts/OFL-BarlowCondensed.txt`. The page names it "MXW Barlow Condensed" (`@font-face`) for the phone's timing board, the cards chip and a results name that would be cut
  (mxfix1); Party Mode loads the same files. The same files and family name as the visual pack's ("ui skin").
<!-- end race screen fonts -->
