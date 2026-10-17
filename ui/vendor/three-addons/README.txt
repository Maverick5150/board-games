three.js r160 add-ons (examples/jsm of the npm package three@0.160.0, MIT, see LICENSE), vendored flat, imports rewritten.
Every file imports the engine as '../three-0.160.0.module.min.js' (ui/vendor/three-0.160.0.module.min.js) and its sibling add-ons as './X.js'.
From an ES module in mxwar/ (race3d.js and the r3d-*.js files):  import {EffectComposer} from "../ui/vendor/three-addons/EffectComposer.js";
Nothing is loaded from a CDN at run time. Re-made by BG_audit/sprint/mxvis/tools/vendor-addons.js (extra add-ons: pass their examples/jsm paths as more arguments).

Files (56):
  AfterimagePass.js  <- examples/jsm/postprocessing/AfterimagePass.js
  AfterimageShader.js  <- examples/jsm/shaders/AfterimageShader.js
  BokehPass.js  <- examples/jsm/postprocessing/BokehPass.js
  BokehShader.js  <- examples/jsm/shaders/BokehShader.js
  BufferGeometryUtils.js  <- examples/jsm/utils/BufferGeometryUtils.js
  CCDIKSolver.js  <- examples/jsm/animation/CCDIKSolver.js
  ClearPass.js  <- examples/jsm/postprocessing/ClearPass.js
  ConvexGeometry.js  <- examples/jsm/geometries/ConvexGeometry.js
  ConvexHull.js  <- examples/jsm/math/ConvexHull.js
  CopyShader.js  <- examples/jsm/shaders/CopyShader.js
  DecalGeometry.js  <- examples/jsm/geometries/DecalGeometry.js
  DepthLimitedBlurShader.js  <- examples/jsm/shaders/DepthLimitedBlurShader.js
  EffectComposer.js  <- examples/jsm/postprocessing/EffectComposer.js
  FilmPass.js  <- examples/jsm/postprocessing/FilmPass.js
  FilmShader.js  <- examples/jsm/shaders/FilmShader.js
  FXAAShader.js  <- examples/jsm/shaders/FXAAShader.js
  GammaCorrectionShader.js  <- examples/jsm/shaders/GammaCorrectionShader.js
  GLTFLoader.js  <- examples/jsm/loaders/GLTFLoader.js
  GPUComputationRenderer.js  <- examples/jsm/misc/GPUComputationRenderer.js
  GTAOPass.js  <- examples/jsm/postprocessing/GTAOPass.js
  GTAOShader.js  <- examples/jsm/shaders/GTAOShader.js
  ImprovedNoise.js  <- examples/jsm/math/ImprovedNoise.js
  Lensflare.js  <- examples/jsm/objects/Lensflare.js
  LuminosityHighPassShader.js  <- examples/jsm/shaders/LuminosityHighPassShader.js
  LUTPass.js  <- examples/jsm/postprocessing/LUTPass.js
  MaskPass.js  <- examples/jsm/postprocessing/MaskPass.js
  MeshSurfaceSampler.js  <- examples/jsm/math/MeshSurfaceSampler.js
  OutlinePass.js  <- examples/jsm/postprocessing/OutlinePass.js
  OutputPass.js  <- examples/jsm/postprocessing/OutputPass.js
  OutputShader.js  <- examples/jsm/shaders/OutputShader.js
  Pass.js  <- examples/jsm/postprocessing/Pass.js
  PoissonDenoiseShader.js  <- examples/jsm/shaders/PoissonDenoiseShader.js
  Reflector.js  <- examples/jsm/objects/Reflector.js
  RenderPass.js  <- examples/jsm/postprocessing/RenderPass.js
  RGBELoader.js  <- examples/jsm/loaders/RGBELoader.js
  RoomEnvironment.js  <- examples/jsm/environments/RoomEnvironment.js
  RoundedBoxGeometry.js  <- examples/jsm/geometries/RoundedBoxGeometry.js
  SAOPass.js  <- examples/jsm/postprocessing/SAOPass.js
  SAOShader.js  <- examples/jsm/shaders/SAOShader.js
  SavePass.js  <- examples/jsm/postprocessing/SavePass.js
  SceneUtils.js  <- examples/jsm/utils/SceneUtils.js
  ShaderPass.js  <- examples/jsm/postprocessing/ShaderPass.js
  SimplexNoise.js  <- examples/jsm/math/SimplexNoise.js
  SkeletonUtils.js  <- examples/jsm/utils/SkeletonUtils.js
  Sky.js  <- examples/jsm/objects/Sky.js
  SMAAPass.js  <- examples/jsm/postprocessing/SMAAPass.js
  SMAAShader.js  <- examples/jsm/shaders/SMAAShader.js
  SSAARenderPass.js  <- examples/jsm/postprocessing/SSAARenderPass.js
  SSAOPass.js  <- examples/jsm/postprocessing/SSAOPass.js
  SSAOShader.js  <- examples/jsm/shaders/SSAOShader.js
  TAARenderPass.js  <- examples/jsm/postprocessing/TAARenderPass.js
  TexturePass.js  <- examples/jsm/postprocessing/TexturePass.js
  Timer.js  <- examples/jsm/misc/Timer.js
  UnrealBloomPass.js  <- examples/jsm/postprocessing/UnrealBloomPass.js
  VignetteShader.js  <- examples/jsm/shaders/VignetteShader.js
  WebGL.js  <- examples/jsm/capabilities/WebGL.js
