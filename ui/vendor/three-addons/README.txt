three.js r160 add-ons (examples/jsm of the npm package three@0.160.0, MIT, see LICENSE), vendored flat, imports rewritten.
Every file imports the engine as '../three-0.160.0.module.min.js' (ui/vendor/three-0.160.0.module.min.js) and its sibling add-ons as './X.js'.
From an ES module in mxwar/ (race3d.js and the r3d-*.js files):  import {EffectComposer} from "../ui/vendor/three-addons/EffectComposer.js";
Nothing is loaded from a CDN at run time. Re-made by BG_audit/sprint/mxvis/tools/vendor-addons.js (extra add-ons: pass their examples/jsm paths as more arguments).

Files (25):
  BokehPass.js  <- examples/jsm/postprocessing/BokehPass.js
  BokehShader.js  <- examples/jsm/shaders/BokehShader.js
  BufferGeometryUtils.js  <- examples/jsm/utils/BufferGeometryUtils.js
  CopyShader.js  <- examples/jsm/shaders/CopyShader.js
  DecalGeometry.js  <- examples/jsm/geometries/DecalGeometry.js
  EffectComposer.js  <- examples/jsm/postprocessing/EffectComposer.js
  FXAAShader.js  <- examples/jsm/shaders/FXAAShader.js
  GammaCorrectionShader.js  <- examples/jsm/shaders/GammaCorrectionShader.js
  GLTFLoader.js  <- examples/jsm/loaders/GLTFLoader.js
  Lensflare.js  <- examples/jsm/objects/Lensflare.js
  LuminosityHighPassShader.js  <- examples/jsm/shaders/LuminosityHighPassShader.js
  MaskPass.js  <- examples/jsm/postprocessing/MaskPass.js
  OutputPass.js  <- examples/jsm/postprocessing/OutputPass.js
  OutputShader.js  <- examples/jsm/shaders/OutputShader.js
  Pass.js  <- examples/jsm/postprocessing/Pass.js
  RenderPass.js  <- examples/jsm/postprocessing/RenderPass.js
  RGBELoader.js  <- examples/jsm/loaders/RGBELoader.js
  RoomEnvironment.js  <- examples/jsm/environments/RoomEnvironment.js
  RoundedBoxGeometry.js  <- examples/jsm/geometries/RoundedBoxGeometry.js
  ShaderPass.js  <- examples/jsm/postprocessing/ShaderPass.js
  SkeletonUtils.js  <- examples/jsm/utils/SkeletonUtils.js
  SMAAPass.js  <- examples/jsm/postprocessing/SMAAPass.js
  SMAAShader.js  <- examples/jsm/shaders/SMAAShader.js
  UnrealBloomPass.js  <- examples/jsm/postprocessing/UnrealBloomPass.js
  VignetteShader.js  <- examples/jsm/shaders/VignetteShader.js
