/* MOTOCROSS WAR 3D — THE POST CHAIN (owner: lead): the scene is drawn into a half-float (HDR) target, then
     bloom (a dual-filter mip chain: the light banks and the specular highlights glow, nothing else does)  ->  ONE final pass that does the depth of field (the chase camera only),
     adds the bloom, tone-maps (ACES filmic), grades (cool blue shadows, warm gold highlights, saturation, an S-curve), vignettes, adds a film grain and writes sRGB
     ->  an anti-aliasing pass (SMAA) on the high tier.
   It is a hand-written chain (no EffectComposer): fewer passes, the targets the right size for each effect, and every effect a flag the quality tiers switch off.
   createPost(renderer, flags) -> P:  P.render(scene, cam, tw), P.resize(W, H, pr) (the DRAWING-BUFFER size is read from the renderer; W, H, pr are only a hint),
   P.setFlags(f) (any of the flags below, at any time), P.setDof(amount 0..1, focusMetres) (every frame, from the camera), P.flags, P.info() -> {w, h, passes, targets, dof, aa},
   P.dispose().  Draw calls added: bloom 1 + 4 + 4 (nine small passes), the final pass 1, SMAA 3.
   Flags (all optional; the tier table in r3d-look.js sets them):
     bloom      0..2   strength multiplier (0 = no bloom passes at all)       bloomThreshold  linear HDR level where glow starts (0.85)     bloomKnee 0.5
     dof        bool   compile the depth-of-field gather into the final pass (needs the depth texture: no MSAA then)   dofTaps 14   dofMax  blur radius as a fraction of the height (0.022)
     aa         "smaa" | "msaa" | "none"    smaa = an SMAA pass after the grade;  msaa = a 4x multisampled scene target (cheap on tiled GPUs; not with dof)
     grade      0..1   colour grade amount       vignette 0..1   grain 0..0.1    exposure   (null = the renderer's toneMappingExposure)
   Nothing is random: the grain is hashed from the pixel and the clock (the harness' virtual clock makes a frame a pure function of the tick). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {SMAAPass} from "../ui/vendor/three-addons/SMAAPass.js";

const VERT="varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }";

/* ---------- bloom shaders ---------- */
const PRE_FRAG=`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh; uniform float uKnee; varying vec2 vUv;
vec3 soft(vec3 c){ c=min(max(c,vec3(0.0)),vec3(64.0));   /* max / min drop a NaN or an Inf (Direct3D: IEEE minNum / maxNum); isnan() is folded away by its compiler */ float br=max(c.r,max(c.g,c.b)); float s=clamp(br-uThresh+uKnee,0.0,2.0*uKnee); s=s*s/(4.0*uKnee+1e-4); float k=max(s,br-uThresh)/max(br,1e-4); return c*k; }
float kw(vec3 c){ return 1.0/(1.0+dot(c,vec3(0.2126,0.7152,0.0722))); }
void main(){
  vec3 a=soft(texture2D(tSrc,vUv+uTexel*vec2(-1.0,-1.0)).rgb), b=soft(texture2D(tSrc,vUv+uTexel*vec2(1.0,-1.0)).rgb), c=soft(texture2D(tSrc,vUv+uTexel*vec2(-1.0,1.0)).rgb), d=soft(texture2D(tSrc,vUv+uTexel*vec2(1.0,1.0)).rgb);
  float wa=kw(a), wb=kw(b), wc=kw(c), wd=kw(d);
  gl_FragColor=vec4((a*wa+b*wb+c*wc+d*wd)/(wa+wb+wc+wd),1.0);
}`;
const DOWN_FRAG=`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
void main(){
  vec3 s=texture2D(tSrc,vUv).rgb*4.0;
  s+=texture2D(tSrc,vUv+uTexel*vec2(-1.0,-1.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(1.0,-1.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(-1.0,1.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(1.0,1.0)).rgb;
  gl_FragColor=vec4(s*0.125,1.0);
}`;
const UP_FRAG=`
precision highp float;
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uGain; varying vec2 vUv;
void main(){
  vec3 s=texture2D(tSrc,vUv+uTexel*vec2(-2.0,0.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(2.0,0.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(0.0,-2.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(0.0,2.0)).rgb;
  s+=2.0*(texture2D(tSrc,vUv+uTexel*vec2(-1.0,-1.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(1.0,-1.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(-1.0,1.0)).rgb+texture2D(tSrc,vUv+uTexel*vec2(1.0,1.0)).rgb);
  gl_FragColor=vec4(s*(uGain/12.0),1.0);
}`;

/* ---------- the depth-of-field gather, at HALF resolution (fewer pixels, bilinear taps: the noise of a few random taps is averaged away) ---------- */
const DOF_FRAG=`
precision highp float;
uniform sampler2D tScene; uniform sampler2D tDepth;
uniform vec2 uTexel; uniform float uDof; uniform float uFocus; uniform float uAper; uniform float uDead; uniform float uMaxPx; uniform float uNear; uniform float uFar;
#include <packing>
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
float zAt(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,uNear,uFar); }
float coc(float z){ float d=1.0/max(z,0.05)-1.0/uFocus; return d>0.0?clamp((d-uDead)*uAper,0.0,1.0):clamp((-d-uDead)*uAper*0.5,0.0,0.55); }   /* near: full blur; far: at most 55% (the stands stay a stadium) */
void main(){
  vec3 c=texture2D(tScene,vUv).rgb;
  float z0=zAt(vUv), c0=coc(z0)*uDof, rot=ign(gl_FragCoord.xy)*6.2831853;
  vec3 acc=c; float ws=1.0;
  for(int i=0;i<DOF_TAPS;i++){
    float fi=float(i)+0.5, r=sqrt(fi/float(DOF_TAPS)), a=fi*2.39996323+rot;
    vec2 uv=vUv+vec2(cos(a),sin(a))*r*uMaxPx*uTexel;
    float zt=zAt(uv), ct=coc(zt)*uDof;
    float cr=zt<z0?ct:c0;
    float w=clamp((cr-r)/0.18+1.0,0.0,1.0);
    vec3 tc=min(max(texture2D(tScene,uv).rgb,vec3(0.0)),vec3(64.0));
    w*=1.0+min(dot(tc,vec3(0.2126,0.7152,0.0722)),6.0)*0.6;
    acc+=tc*w; ws+=w;
  }
  gl_FragColor=vec4(acc/ws,1.0);
}`;

/* ---------- the final pass: depth of field, bloom, tone map, grade, vignette, grain, sRGB ---------- */
const FINAL_FRAG=`
precision highp float;
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tDepth;
uniform vec2 uTexel; uniform float uBloom; uniform float uDof; uniform float uFocus; uniform float uAper; uniform float uDead; uniform float uMaxPx; uniform float uNear; uniform float uFar;
uniform float uVig; uniform float uGrain; uniform float uTime; uniform float uGrade; uniform float uAspect; uniform float uSat; uniform float uCon;
#include <tonemapping_pars_fragment>
#include <packing>
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
#ifdef DOF
uniform sampler2D tBlur;
float zAt(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,uNear,uFar); }
float coc(float z){ float d=1.0/max(z,0.05)-1.0/uFocus; return d>0.0?clamp((d-uDead)*uAper,0.0,1.0):clamp((-d-uDead)*uAper*0.5,0.0,0.55); }   /* near: full blur; far: at most 55% (the stands stay a stadium) */
#endif
vec3 enc(vec3 c){ c=clamp(c,0.0,1.0); return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(0.0031308,c)); }
void main(){
  vec3 c=texture2D(tScene,vUv).rgb;
  c=min(max(c,vec3(0.0)),vec3(64.0));   /* a NaN (a shader that divided by zero) or an Inf becomes 0 / 64, never a black or white smear in the bloom */
  #ifdef DOF
  if(uDof>0.002){ float k=smoothstep(0.02,0.5,coc(zAt(vUv))*uDof); vec2 h=uTexel*1.5; vec3 bl=(texture2D(tBlur,vUv).rgb*2.0+texture2D(tBlur,vUv+vec2(h.x,h.y)).rgb+texture2D(tBlur,vUv+vec2(-h.x,h.y)).rgb+texture2D(tBlur,vUv+vec2(h.x,-h.y)).rgb+texture2D(tBlur,vUv+vec2(-h.x,-h.y)).rgb)/6.0; c=mix(c,bl,k); }
  #endif
  #ifdef BLOOM
  c+=texture2D(tBloom,vUv).rgb*uBloom;
  #endif
  c=ACESFilmicToneMapping(c);
  float lum=dot(c,vec3(0.2126,0.7152,0.0722));
  /* grade: cool blue-black shadows, warm gold highlights, a little more colour, an S-curve for deep contrast */
  vec3 cool=vec3(0.86,0.96,1.20), warm=vec3(1.10,1.01,0.86);
  c*=mix(vec3(1.0),cool,(1.0-smoothstep(0.0,0.28,lum))*0.75*uGrade);
  c*=mix(vec3(1.0),warm,smoothstep(0.22,0.85,lum)*0.60*uGrade);
  lum=dot(c,vec3(0.2126,0.7152,0.0722));
  c=mix(vec3(lum),c,1.0+(uSat-1.0)*uGrade);
  vec3 g=pow(max(c,0.0),vec3(1.0/2.2)); g=mix(g,g*g*(3.0-2.0*g),uCon*uGrade); c=pow(g,vec3(2.2));
  vec2 q=(vUv-0.5)*vec2(uAspect,1.0); c*=1.0-uVig*smoothstep(0.30,1.05,length(q)*1.18);
  vec3 o=enc(c);
  float n=ign(gl_FragCoord.xy+vec2(uTime*37.0,uTime*91.0))-0.5;
  o+=n*(uGrain*(1.0-0.6*lum)+0.0035);
  gl_FragColor=vec4(o,1.0);
}`;

export function createPost(renderer,f0){
  const F=Object.assign({bloom:1,bloomThreshold:0.95,bloomKnee:0.4,dof:false,dofTaps:24,dofMax:0.017,aa:"none",grade:1,vignette:0.3,grain:0.03,exposure:null,sat:1.14,contrast:0.5},f0||{});
  const ext=renderer.extensions;
  const P={flags:F,dead:false};
  /* the fullscreen triangle */
  const fsGeo=new THREE.BufferGeometry(); fsGeo.setAttribute("position",new THREE.Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3)); fsGeo.setAttribute("uv",new THREE.Float32BufferAttribute([0,2,0,0,2,0],2));
  const fsMesh=new THREE.Mesh(fsGeo,null); fsMesh.frustumCulled=false; const fsScene=new THREE.Scene(); fsScene.add(fsMesh); const fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const mk=(frag,uni,extra)=>new THREE.ShaderMaterial(Object.assign({uniforms:uni,vertexShader:VERT,fragmentShader:frag,depthTest:false,depthWrite:false,toneMapped:false,fog:false},extra||{}));
  const sizeV=new THREE.Vector2();
  let W=0,H=0, rtScene=null, rtLdr=null, rtDof=null, levels=[], smaa=null, depthTex=null, builtDof=false, builtMsaa=0, builtAa="none", builtBloom=false, dofAmt=0, dofFocus=8;
  const mPre=mk(PRE_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()},uThresh:{value:0.85},uKnee:{value:0.5}});
  const mDown=mk(DOWN_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()}});
  const mUp=mk(UP_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()},uGain:{value:1}},{transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
  let mFinal=null, mDof=null;
  const fu={tScene:{value:null},tBloom:{value:null},tDepth:{value:null},tBlur:{value:null},uTexel:{value:new THREE.Vector2()},uBloom:{value:0.4},uDof:{value:0},uFocus:{value:8},uAper:{value:3.2},uDead:{value:0.022},uMaxPx:{value:16},uNear:{value:0.5},uFar:{value:4200},
    uVig:{value:0.3},uGrain:{value:0.03},uTime:{value:0},uGrade:{value:1},uAspect:{value:1.78},uSat:{value:1.14},uCon:{value:0.5},toneMappingExposure:{value:1}};
  function rt(w,h,o){ return new THREE.WebGLRenderTarget(Math.max(1,w),Math.max(1,h),Object.assign({type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false},o||{})); }
  function free(){ if(rtScene){ rtScene.dispose(); if(depthTex) depthTex.dispose(); } if(rtLdr) rtLdr.dispose(); if(rtDof) rtDof.dispose(); rtDof=null; levels.forEach(l=>l.dispose()); levels=[]; rtScene=rtLdr=depthTex=null; if(smaa){ smaa.dispose(); smaa=null; } }
  /* (re)build the targets for the drawing buffer size and the flags that decide what exists */
  function build(){
    renderer.getDrawingBufferSize(sizeV); const w=Math.max(2,Math.round(sizeV.x)), h=Math.max(2,Math.round(sizeV.y));
    const wantDof=!!F.dof, wantMsaa=(!wantDof&&F.aa==="msaa")?4:0, wantAa=F.aa==="smaa"?"smaa":"none", wantBloom=F.bloom>0;
    if(w===W&&h===H&&rtScene&&wantDof===builtDof&&wantMsaa===builtMsaa&&wantAa===builtAa&&wantBloom===builtBloom) return;
    free(); W=w; H=h; builtDof=wantDof; builtMsaa=wantMsaa; builtAa=wantAa; builtBloom=wantBloom;
    const o={depthBuffer:true}; if(wantDof){ depthTex=new THREE.DepthTexture(W,H,THREE.UnsignedIntType); o.depthTexture=depthTex; } if(wantMsaa) o.samples=wantMsaa;
    rtScene=rt(W,H,o); if(wantDof) rtDof=rt(Math.ceil(W/2),Math.ceil(H/2));
    if(wantBloom){ let lw=W,lh=H; for(let k=0;k<5;k++){ lw=Math.max(2,Math.ceil(lw/2)); lh=Math.max(2,Math.ceil(lh/2)); levels.push(rt(lw,lh)); } }
    if(wantAa==="smaa"){ rtLdr=rt(W,H,{type:THREE.UnsignedByteType}); smaa=new SMAAPass(W,H); smaa.renderToScreen=true; }
    /* the final material is made again when the compile-time options change (the depth of field's taps, the bloom) */
    const defs={}; if(wantDof){ defs.DOF=1; defs.DOF_TAPS=Math.max(6,F.dofTaps|0); } if(wantBloom) defs.BLOOM=1;
    if(mFinal) mFinal.dispose(); mFinal=mk(FINAL_FRAG,fu,{defines:defs});
    if(mDof) mDof.dispose(); mDof=wantDof?mk(DOF_FRAG,fu,{defines:{DOF_TAPS:Math.max(6,F.dofTaps|0)}}):null;
  }
  function pass(mat,target,src,srcW,srcH,extra){
    mat.uniforms.tSrc.value=src; mat.uniforms.uTexel.value.set(1/srcW,1/srcH); if(extra) extra(mat);
    fsMesh.material=mat; renderer.setRenderTarget(target); renderer.render(fsScene,fsCam);
  }
  P.render=function(scene,cam,tw){
    build();
    const ac=renderer.autoClear, tm=renderer.toneMapping;
    /* 1. the scene into the HDR target (three.js applies no tone mapping to a target: the final pass owns it) */
    renderer.autoClear=true; renderer.setRenderTarget(rtScene); renderer.render(scene,cam);
    renderer.autoClear=false;
    /* 2. bloom: prefilter into level 0, down the chain, back up adding */
    let bloomTex=null;
    if(levels.length){
      pass(mPre,levels[0],rtScene.texture,W,H,m=>{ m.uniforms.uThresh.value=F.bloomThreshold; m.uniforms.uKnee.value=F.bloomKnee; });
      for(let k=1;k<levels.length;k++) pass(mDown,levels[k],levels[k-1].texture,levels[k-1].width,levels[k-1].height);
      const gains=[1.0,0.9,0.85,0.8];
      for(let k=levels.length-1;k>=1;k--) pass(mUp,levels[k-1],levels[k].texture,levels[k].width,levels[k].height,m=>{ m.uniforms.uGain.value=gains[Math.min(gains.length-1,levels.length-1-k)]; });
      bloomTex=levels[0].texture;
    }
    /* 3. the final pass (to the screen, or to an 8-bit target when SMAA follows) */
    const u=fu; u.tScene.value=rtScene.texture; u.tBloom.value=bloomTex; u.tDepth.value=depthTex;
    u.uTexel.value.set(1/W,1/H); u.uBloom.value=0.6*F.bloom; u.uDof.value=F.dof?dofAmt:0; u.uFocus.value=dofFocus; u.uMaxPx.value=Math.max(4,F.dofMax*H); u.uNear.value=cam.near; u.uFar.value=cam.far;
    u.uVig.value=F.vignette; u.uGrain.value=F.grain; u.uTime.value=(Math.floor((tw||0)*24)%997)/997; u.uGrade.value=F.grade; u.uAspect.value=W/H; u.uSat.value=F.sat; u.uCon.value=F.contrast;
    u.toneMappingExposure.value=F.exposure!=null?F.exposure:renderer.toneMappingExposure;
    if(mDof&&u.uDof.value>0.002){ u.tBlur.value=rtDof.texture; fsMesh.material=mDof; renderer.setRenderTarget(rtDof); renderer.render(fsScene,fsCam); }
    fsMesh.material=mFinal; renderer.setRenderTarget(smaa?rtLdr:null); renderer.render(fsScene,fsCam);
    if(smaa){ smaa.render(renderer,null,rtLdr); }
    renderer.setRenderTarget(null); renderer.autoClear=ac;
  };
  P.resize=function(){ /* the targets follow the drawing buffer: build() looks at it every frame */ };
  P.setFlags=function(f){ Object.assign(F,f||{}); fu.uAper.value=F.dofAper!=null?F.dofAper:3.2; fu.uDead.value=F.dofDead!=null?F.dofDead:0.022; };
  P.setDof=function(amount,focus){ dofAmt=amount; dofFocus=Math.max(0.5,focus); };
  P.info=function(){ return {w:W,h:H,passes:(levels.length?1+2*(levels.length-1):0)+1+(smaa?3:0)+(rtDof?1:0),targets:(rtScene?1:0)+levels.length+(rtLdr?1:0)+(depthTex?1:0)+(rtDof?1:0),dof:builtDof,aa:builtAa,msaa:builtMsaa,bloom:builtBloom}; };
  P.dispose=function(){ P.dead=true; free(); [mPre,mDown,mUp].forEach(m=>m.dispose()); if(mFinal) mFinal.dispose(); if(mDof) mDof.dispose(); fsGeo.dispose(); };
  P.setFlags(null);
  return P;
}
/* does this GPU render into half-float targets? (WebGL2 with EXT_color_buffer_float or EXT_color_buffer_half_float; WebGL1 never gets a chain) */
export function postSupported(renderer){
  try{ const gl=renderer.getContext(); if(!renderer.capabilities.isWebGL2) return false; return !!(renderer.extensions.has("EXT_color_buffer_float")||renderer.extensions.has("EXT_color_buffer_half_float")); }catch(e){ return false; }
}
