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
     aa         "fxaa" | "smaa" | "msaa" | "none"    fxaa = inside the final pass (a few taps only on edges: the cheap default);  smaa = three heavier passes (the best edges);  msaa = a 4x multisampled scene target (cheap on tiled GPUs; not with dof / depth)
     grade      0..1   colour grade amount       vignette 0..1   grain 0..0.1    exposure   (null = the renderer's toneMappingExposure)
     half       bool   (milestone 2, lead: THE 1080p COST) the depth of field, the camera motion blur and the contact shadows run at HALF resolution: one prepass packs the frame at half size
                       (colour + the linear depth in alpha), one gather pass blurs it (the depth of field's taps and the motion blur's taps read that small target only: four times fewer
                       bytes, cache-friendly), and the full-resolution final pass composites it where the full-resolution depth says a pixel is out of focus or streaming past the lens
                       (in-focus pixels stay the full-resolution scene: sharp silhouettes). false = the milestone-1 chain (a half-size gather that read the full-size scene and depth with
                       every tap, the motion blur at full size). THE CRUMB MASK: a pixel whose scene alpha is under 0.5 (the fx specks may write alpha 0: they streak themselves with their
                       own shutter) is left out of the camera motion blur (its depth is packed negative), so a crumb is never smeared twice.
     ao         0..1   (milestone 2, needs half) CONTACT SHADOWS: an ambient-occlusion pass at half resolution from the packed depth (8 taps on a spiral inside aoR metres, the normal from
                       the depth, a range check so a silhouette never darkens the far background), faded out from 0.6 x aoFar to aoFar metres: tyres in the ruts, the bike over its
                       shadow, the rider's legs against the shrouds, the blocks on the dirt. aoR 0.45   aoFar 30
     fmt        "rgba16f" | "r11"   the scene target: r11 = R11F_G11F_B10F (half the bytes of a half-float RGBA target; no alpha, so only where no crumb mask is needed: no motion blur)
     ldr        bool   (milestone 2, the FIRE TV tier's anti-aliasing) no HDR chain at all: the scene is drawn into an 8-bit target exactly as it would be drawn to the screen (three.js tone-maps and
                       encodes sRGB in every material: the target is flagged like a WebXR target, which is what tells r160 to do that, with a plain RGBA8 store), then ONE pass of FXAA (five taps,
                       four more only on edges) writes the screen. Same pixels as the plain frame except the edges; +1 draw call; about 2 MB more written and read per 960x540 frame.
     tvFxaa     bool   (with ldr) false = no FXAA, only the glow (a plain copy: nothing softened)
     tvGlow     0..1   (with ldr) THE TV TIER'S GLOW: the frame's near-white pixels (the floodlight bulbs, the glow sprites' cores) are taken at a quarter of the size, blurred one level down
                       and back up (three passes of 240x135 and 120x68 pixels at 960x540), and screen-blended in the FXAA pass: the light banks glow on the TV as on the cover. +3 draw calls.
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
float coc(float z){ float f=1.0/uFocus, d=1.0/max(z,0.05)-f; return d>0.0?clamp((d-uDead-0.6*f)*uAper,0.0,1.0):clamp((-d-uDead)*uAper*0.5,0.0,0.30); }   /* near: full blur; far: at most 30% (the stands stay a stadium, thin light strings do not turn to noise) */
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
    vec3 tc=min(max(texture2D(tScene,uv).rgb,vec3(0.0)),vec3(2.5));   /* (a tap on a thin bright light string is clamped: it would flicker under the random tap pattern: integrate:merge, director note D5) */
    w*=1.0+min(dot(tc,vec3(0.2126,0.7152,0.0722)),2.5)*0.05;
    acc+=tc*w; ws+=w;
  }
  gl_FragColor=vec4(acc/ws,1.0);
}`;

/* ---------- (half) the prepass: the frame at half size, the linear depth in alpha (the nearer of two texels: a near edge never takes the background's depth) ---------- */
const HALF_FRAG=`
precision highp float;
uniform sampler2D tScene; uniform sampler2D tDepth; uniform vec2 uTexel; uniform float uNear; uniform float uFar;
#include <packing>
varying vec2 vUv;
void main(){
  vec4 s=texture2D(tScene,vUv);   /* a half-size texel's centre is the corner of four full-size texels: one bilinear tap is their average */
  vec3 c=min(max(s.rgb,vec3(0.0)),vec3(64.0));
  float d=min(texture2D(tDepth,vUv-0.5*uTexel).x,texture2D(tDepth,vUv+0.5*uTexel).x);
  float z=max(-perspectiveDepthToViewZ(d,uNear,uFar),1e-3);
  gl_FragColor=vec4(c,s.a<0.5?-z:z);   /* the crumb mask: a negative depth = leave it out of the camera motion blur */
}`;
/* ---------- (half) the gather at half size: the depth of field and the camera motion blur read ONLY the packed half-size target ---------- */
const GATHER_FRAG=`
precision highp float;
uniform sampler2D tHalf; uniform vec2 uTexel; uniform float uDof; uniform float uFocus; uniform float uAper; uniform float uDead; uniform float uMaxPx; uniform float uFar;
uniform float uMB; uniform mat4 uPrevVP; uniform mat4 uCamWorld; uniform vec2 uProjInv;
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
float coc(float z){ float f=1.0/uFocus, d=1.0/max(z,0.05)-f; return d>0.0?clamp((d-uDead-0.6*f)*uAper,0.0,1.0):clamp((-d-uDead)*uAper*0.5,0.0,0.30); }
void main(){
  vec4 h0=texture2D(tHalf,vUv); float z0=abs(h0.a); vec3 res=h0.rgb; float kd=0.0, km=0.0;
  #ifdef DOF
  if(uDof>0.002){
    float c0=coc(z0)*uDof, rot=ign(gl_FragCoord.xy)*6.2831853; vec3 acc=h0.rgb; float ws=1.0;
    for(int i=0;i<DOF_TAPS;i++){
      float fi=float(i)+0.5, r=sqrt(fi/float(DOF_TAPS)), a=fi*2.39996323+rot;
      vec4 t=textureLod(tHalf,vUv+vec2(cos(a),sin(a))*r*uMaxPx*uTexel,0.0); float zt=abs(t.a);
      float ct=coc(zt)*uDof, cr=zt<z0?ct:c0, w=clamp((cr-r)/0.18+1.0,0.0,1.0);
      vec3 tc=min(t.rgb,vec3(2.5)); w*=1.0+min(dot(tc,vec3(0.2126,0.7152,0.0722)),2.5)*0.05;
      acc+=tc*w; ws+=w;
    }
    res=acc/ws; kd=smoothstep(0.02,0.5,c0);
  }
  #endif
  #ifdef MB
  if(uMB>0.001&&h0.a>0.0&&z0<uFar*0.98){
    float fg=1.0-smoothstep(0.28*uFocus,0.58*uFocus,z0);
    if(fg>0.01){
      vec2 ndc=vUv*2.0-1.0; vec3 wp=(uCamWorld*vec4(ndc.x*uProjInv.x*z0,ndc.y*uProjInv.y*z0,-z0,1.0)).xyz;
      vec4 pp=uPrevVP*vec4(wp,1.0); vec2 puv=pp.xy/pp.w*0.5+0.5; vec2 vel=(vUv-puv)*uMB*fg; float vl=length(vel); if(vl>0.03) vel*=0.03/vl;
      if(vl>0.0015){ vec3 acc=h0.rgb; float n=1.0, jt=ign(gl_FragCoord.xy)-0.5;
        for(int i=1;i<=8;i++){ float f=(float(i)+jt)/8.0-0.5; vec4 t=textureLod(tHalf,vUv-vel*f*2.0,0.0); float m=step(0.0,t.a); acc+=t.rgb*m; n+=m; }   /* a crumb tap is left out: it is never smeared into the dirt's streak */
        km=clamp(vl*60.0,0.0,1.0); res=mix(res,acc/n,km/max(max(kd,km),1e-4)); }
    }
  }
  #endif
  gl_FragColor=vec4(res,km);
}`;
/* ---------- (half + ao) contact shadows at half size, from the packed depth: 8 taps on a spiral within aoR metres, the normal from the depth (the flatter side at an edge), a range check ---------- */
const AO_FRAG=`
precision highp float;
uniform sampler2D tHalf; uniform vec2 uHTexel; uniform vec2 uProjInv; uniform float uAoR; uniform float uAoFar; uniform float uAoK;
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
vec3 vpos(vec2 uv,float z){ vec2 n=uv*2.0-1.0; return vec3(n.x*uProjInv.x*z,n.y*uProjInv.y*z,-z); }
float zat(vec2 uv){ return abs(textureLod(tHalf,uv,0.0).a); }   /* (explicit level 0: no derivatives in the loop and after the early return; the target has no mips) */
void main(){
  float z0=zat(vUv);
  if(z0>uAoFar){ gl_FragColor=vec4(1.0); return; }
  vec3 P=vpos(vUv,z0);
  vec2 ox=vec2(uHTexel.x,0.0), oy=vec2(0.0,uHTexel.y);
  float zr=zat(vUv+ox), zl=zat(vUv-ox), zu=zat(vUv+oy), zd=zat(vUv-oy);
  vec3 dx=abs(zr-z0)<abs(zl-z0)?vpos(vUv+ox,zr)-P:P-vpos(vUv-ox,zl);
  vec3 dy=abs(zu-z0)<abs(zd-z0)?vpos(vUv+oy,zu)-P:P-vpos(vUv-oy,zd);
  vec3 N=normalize(cross(dx,dy)); if(dot(N,P)>0.0) N=-N;
  vec2 rad=0.5*uAoR/(z0*uProjInv); float rp=rad.y/uHTexel.y; rad*=clamp(rp,1.5,28.0)/max(rp,1e-3);   /* the radius in uv: aoR metres at this depth, 1.5 to 28 half-size pixels */
  float rot=ign(gl_FragCoord.xy)*6.2831853, ao=0.0, r2=uAoR*uAoR;
  for(int i=0;i<8;i++){
    float fi=float(i)+0.5, r=sqrt(fi/8.0), a=fi*2.39996323+rot;
    vec2 uv=vUv+vec2(cos(a),sin(a))*r*rad;
    vec3 V=vpos(uv,zat(uv))-P; float vv=dot(V,V);
    ao+=max(dot(V,N)-0.015*z0,0.0)/(vv+0.02*r2)*(1.0-smoothstep(r2,4.0*r2,vv));   /* (Alchemy AO; an occluder more than 2 radii away counts nothing: no halo round a silhouette) */
  }
  ao=clamp(1.0-uAoK*ao*uAoR/8.0,0.0,1.0);
  gl_FragColor=vec4(vec3(mix(ao,1.0,smoothstep(0.6*uAoFar,uAoFar,z0))),1.0);
}`;
/* ---------- (ldr) the FIRE TV tier's anti-aliasing: FXAA on the frame as it would have gone to the screen (sRGB bytes: luma in a perceptual space, as FXAA expects) ---------- */
const TVAA_FRAG=`
precision mediump float;
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
#ifdef GLOW
uniform sampler2D tGlow; uniform float uGlow;
#define OUT(c) gl_FragColor=vec4(sqrt((c)*(c)+texture2D(tGlow,vUv).rgb*uGlow),1.0)
#else
#define OUT(c) gl_FragColor=vec4(c,1.0)
#endif
float lu(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
void main(){
  vec3 M=texture2D(tSrc,vUv).rgb;
  #ifdef NOAA
  OUT(M); return;
  #endif
  vec3 NW=texture2D(tSrc,vUv+vec2(-1.0,-1.0)*uTexel).rgb, NE=texture2D(tSrc,vUv+vec2(1.0,-1.0)*uTexel).rgb, SW=texture2D(tSrc,vUv+vec2(-1.0,1.0)*uTexel).rgb, SE=texture2D(tSrc,vUv+vec2(1.0,1.0)*uTexel).rgb;
  float lM=lu(M), lNW=lu(NW), lNE=lu(NE), lSW=lu(SW), lSE=lu(SE);
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))), lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  if(lMax-lMin<max(0.0833,lMax*0.166)){ OUT(M); return; }   /* (FXAA 3.11's quality thresholds: geometric edges only; the dirt's texture is left alone) */
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
  float red=max((lNW+lNE+lSW+lSE)*0.03125,0.0078125), rcp=1.0/(min(abs(dir.x),abs(dir.y))+red);
  dir=clamp(dir*rcp,vec2(-8.0),vec2(8.0))*uTexel;
  vec3 A=0.5*(texture2D(tSrc,vUv+dir*(1.0/3.0-0.5)).rgb+texture2D(tSrc,vUv+dir*(2.0/3.0-0.5)).rgb);
  vec3 B=A*0.5+0.25*(texture2D(tSrc,vUv+dir*-0.5).rgb+texture2D(tSrc,vUv+dir*0.5).rgb);
  float lB=lu(B);
  OUT((lB<lMin||lB>lMax)?A:B);
}`;

/* ---------- (ldr + tvGlow) the TV's glow: the near-white part of the 8-bit frame at a quarter of the size (four bilinear taps = a 4 x 4 block of the frame) ---------- */
const TVPRE_FRAG=`
precision mediump float;
uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
vec3 hi(vec3 c){ float l=dot(c,vec3(0.299,0.587,0.114)); return c*c*smoothstep(0.78,0.97,l); }
void main(){
  vec3 a=hi(texture2D(tSrc,vUv+uTexel*vec2(-1.0,-1.0)).rgb)+hi(texture2D(tSrc,vUv+uTexel*vec2(1.0,-1.0)).rgb)+hi(texture2D(tSrc,vUv+uTexel*vec2(-1.0,1.0)).rgb)+hi(texture2D(tSrc,vUv+uTexel*vec2(1.0,1.0)).rgb);
  gl_FragColor=vec4(a*0.25,1.0);
}`;

/* ---------- the final pass: depth of field, bloom, tone map, grade, vignette, grain, sRGB ---------- */
const FINAL_FRAG=`
precision highp float;
uniform sampler2D tScene; uniform sampler2D tBloom; uniform sampler2D tDepth;
uniform vec2 uTexel; uniform float uBloom; uniform float uDof; uniform float uFocus; uniform float uAper; uniform float uDead; uniform float uMaxPx; uniform float uNear; uniform float uFar;
uniform mat4 uInvVP; uniform mat4 uPrevVP; uniform vec3 uCamPos; uniform float uMB; uniform float uHaze; uniform float uHazeI; uniform float uHazeK;
uniform float uVig; uniform float uGrain; uniform float uTime; uniform float uGrade; uniform float uAspect; uniform float uSat; uniform float uCon;
#include <tonemapping_pars_fragment>
#include <packing>
varying vec2 vUv;
float ign(vec2 p){ return fract(52.9829189*fract(dot(p,vec2(0.06711056,0.00583715)))); }
#ifdef HALF
uniform sampler2D tFx; uniform float uFxOn;
#endif
#ifdef AO
uniform sampler2D tAo; uniform float uAoOn; uniform float uAoMix; uniform float uAoDbg;
#endif
#ifdef DOF
uniform sampler2D tBlur;
float zAt(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(tDepth,uv).x,uNear,uFar); }
float coc(float z){ float f=1.0/uFocus, d=1.0/max(z,0.05)-f; return d>0.0?clamp((d-uDead-0.6*f)*uAper,0.0,1.0):clamp((-d-uDead)*uAper*0.5,0.0,0.30); }   /* near: full blur; far: at most 30% (the stands stay a stadium, thin light strings do not turn to noise) */
#endif
float lm(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
float pl(vec3 c){ float l=lm(c); return l/(1.0+l); }
vec3 cmp(vec3 x){ x=min(max(x,vec3(0.0)),vec3(64.0)); return x/(1.0+x); }
vec3 unc(vec3 t){ return t/(1.0-min(t,vec3(0.9995))); }
vec3 enc(vec3 c){ c=clamp(c,0.0,1.0); return mix(c*12.92,1.055*pow(c,vec3(1.0/2.4))-0.055,step(0.0031308,c)); }
void main(){
  vec4 s0=texture2D(tScene,vUv); vec3 c=s0.rgb;
  c=min(max(c,vec3(0.0)),vec3(64.0));   /* a NaN (a shader that divided by zero) or an Inf becomes 0 / 64, never a black or white smear in the bloom */
  #ifdef AA
  { /* FXAA in the HDR frame, averaging in a tone-compressed space (a 30x-bright light edge must still blend): early-out where there is no edge */
    vec2 t=uTexel;
    vec3 NW=min(max(texture2D(tScene,vUv+vec2(-1.0,-1.0)*t).rgb,vec3(0.0)),vec3(64.0)), NE=min(max(texture2D(tScene,vUv+vec2(1.0,-1.0)*t).rgb,vec3(0.0)),vec3(64.0)), SW=min(max(texture2D(tScene,vUv+vec2(-1.0,1.0)*t).rgb,vec3(0.0)),vec3(64.0)), SE=min(max(texture2D(tScene,vUv+vec2(1.0,1.0)*t).rgb,vec3(0.0)),vec3(64.0));
    float lM=pl(c), lNW=pl(NW), lNE=pl(NE), lSW=pl(SW), lSE=pl(SE);
    float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))), lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
    if(lMax-lMin>max(0.04,lMax*0.12)){
      vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
      float red=max((lNW+lNE+lSW+lSE)*0.03125,0.0078125), rcp=1.0/(min(abs(dir.x),abs(dir.y))+red);
      dir=clamp(dir*rcp,vec2(-8.0),vec2(8.0))*t;
      vec3 A=0.5*(cmp(texture2D(tScene,vUv+dir*(1.0/3.0-0.5)).rgb)+cmp(texture2D(tScene,vUv+dir*(2.0/3.0-0.5)).rgb));
      vec3 B=A*0.5+0.25*(cmp(texture2D(tScene,vUv+dir*-0.5).rgb)+cmp(texture2D(tScene,vUv+dir*0.5).rgb));
      float lB=lm(unc(B)); lB=lB/(1.0+lB);
      c=unc((lB<lMin||lB>lMax)?A:B);
    }
  }
  #endif
  #ifdef DEPTH
  float dep=texture2D(tDepth,vUv).x;
  #ifdef HALF
  /* the half-size depth of field / motion blur, composited where THIS pixel's own (full-size) depth says it is out of focus, or where the gather says it streams past the lens */
  if(uFxOn>0.5){ float kd=0.0;
    #ifdef DOF
    if(uDof>0.002) kd=smoothstep(0.02,0.5,coc(-perspectiveDepthToViewZ(dep,uNear,uFar))*uDof);
    #endif
    vec4 fx=textureLod(tFx,vUv,0.0); float kk=max(kd,fx.a*step(0.5,s0.a)); if(kk>0.001) c=mix(c,fx.rgb,kk); }   /* (a crumb pixel itself: no motion blur, its own shutter streaked it) */
  #ifdef AO
  if(uAoOn>0.5){ vec2 h=uTexel*0.75; float ao=0.25*(textureLod(tAo,vUv+vec2(h.x,h.y),0.0).r+textureLod(tAo,vUv+vec2(-h.x,h.y),0.0).r+textureLod(tAo,vUv+vec2(h.x,-h.y),0.0).r+textureLod(tAo,vUv+vec2(-h.x,-h.y),0.0).r);
    if(uAoDbg>0.5){ gl_FragColor=vec4(vec3(ao),1.0); return; }   /* (a test view: the contact shadows alone) */
    c*=mix(1.0,ao,uAoMix*(1.0-smoothstep(1.2,4.0,lm(c)))); }   /* contact shadows (never on a light: a bright pixel keeps its glow) */
  #endif
  #else
  #ifdef DOF
  if(uDof>0.002){ float k=smoothstep(0.02,0.5,coc(-perspectiveDepthToViewZ(dep,uNear,uFar))*uDof); vec2 h=uTexel*1.5; vec3 bl=(texture2D(tBlur,vUv+vec2(h.x,h.y)).rgb+texture2D(tBlur,vUv+vec2(-h.x,-h.y)).rgb)*0.5; c=mix(c,bl,k); }
  #endif
  #endif
  if(dep<0.99999){
    vec4 wp=uInvVP*vec4(vUv*2.0-1.0,dep*2.0-1.0,1.0); wp.xyz/=wp.w;
    float zv=-perspectiveDepthToViewZ(dep,uNear,uFar);
    /* camera motion blur on whatever is nearer than the subject (the dirt streaming past the lens): the pixel's own world position, seen from the previous step's camera */
    #ifndef HALF
    if(uMB>0.001){
      float fg=1.0-smoothstep(0.28*uFocus,0.58*uFocus,zv);   /* (polish: only what is really near the lens streams: the chased bike and rider move WITH the camera and must stay sharp) */
      if(fg>0.01){
        vec4 pp=uPrevVP*vec4(wp.xyz,1.0); vec2 puv=pp.xy/pp.w*0.5+0.5; vec2 vel=(vUv-puv)*uMB*fg; float vl=length(vel); if(vl>0.03) vel*=0.03/vl;
        if(vl>0.0015){ vec3 acc=c; float n=1.0; float jt=ign(gl_FragCoord.xy)-0.5; for(int i=1;i<=8;i++){ float f=(float(i)+jt)/8.0-0.5; vec2 uv=vUv-vel*f*2.0; acc+=texture2D(tScene,uv).rgb; n+=1.0; } c=mix(c,acc/n,clamp(vl*60.0,0.0,1.0)); }   /* (jittered taps: noise, not a stair of ghosts) */
      }
    }
    #endif
    /* height haze: warm dust glow near the ground, cool air above (added light: the floodlights scatter in it); more with distance, thinning with height */
    if(uHaze>0.0){
      float t=length(wp.xyz-uCamPos), y0=max(min(uCamPos.y,wp.y),0.0), y1=max(max(uCamPos.y,wp.y),0.0);
      float avg=(y1-y0)<0.01?exp(-uHazeK*y0):(exp(-uHazeK*y0)-exp(-uHazeK*y1))/(uHazeK*(y1-y0));
      float fa=1.0-exp(-uHaze*t*avg);
      vec3 hc=mix(vec3(0.045,0.058,0.10),vec3(0.17,0.10,0.05),exp(-max(wp.y,0.0)*0.45));
      c+=hc*fa*uHazeI;
    }
  } else if(uHaze>0.0){
    /* the sky: the glow of a lit stadium low over the horizon (cool blue-violet), black overhead */
    vec4 wp=uInvVP*vec4(vUv*2.0-1.0,1.0,1.0); vec3 dir=normalize(wp.xyz/wp.w-uCamPos);
    c+=vec3(0.020,0.026,0.062)*exp(-max(dir.y,0.0)*7.0)*uHazeI;
  }
  #endif
  #ifdef BLOOM
  c+=texture2D(tBloom,vUv).rgb*uBloom;
  #endif
  c=ACESFilmicToneMapping(c);
  float lum=dot(c,vec3(0.2126,0.7152,0.0722));
  /* grade: cool blue-black shadows, warm gold highlights, a little more colour, an S-curve for deep contrast */
  vec3 cool=vec3(0.84,0.95,1.22), warm=vec3(1.07,1.01,0.90);
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
  const F=Object.assign({motionBlur:0,haze:0,hazeI:1,bloom:1,bloomThreshold:1.35,bloomKnee:0.45,dof:false,dofTaps:16,dofMax:0.017,aa:"none",grade:1,vignette:0.3,grain:0.03,exposure:null,sat:1.02,contrast:0.62,half:false,ldr:false,tvGlow:0,ao:0,aoR:0.45,aoFar:30,aoK:2.4,fmt:"rgba16f"},f0||{});
  const ext=renderer.extensions;
  const P={flags:F,dead:false};
  /* the fullscreen triangle */
  const fsGeo=new THREE.BufferGeometry(); fsGeo.setAttribute("position",new THREE.Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3)); fsGeo.setAttribute("uv",new THREE.Float32BufferAttribute([0,2,0,0,2,0],2));
  const fsMesh=new THREE.Mesh(fsGeo,null); fsMesh.frustumCulled=false; const fsScene=new THREE.Scene(); fsScene.add(fsMesh); const fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  const mk=(frag,uni,extra)=>new THREE.ShaderMaterial(Object.assign({uniforms:uni,vertexShader:VERT,fragmentShader:frag,depthTest:false,depthWrite:false,toneMapped:false,fog:false},extra||{}));
  const sizeV=new THREE.Vector2();
  const prevVP=new THREE.Matrix4(); let mbAmt=0;
  let builtBloomDiv=2, builtDepth=false, W=0,H=0, rtScene=null, rtLdr=null, rtDof=null, levels=[], smaa=null, depthTex=null, builtDof=false, builtMsaa=0, builtAa="none", builtBloom=false, dofAmt=0, dofFocus=8;
  let aoWant=true, rtHalf=null, rtFx=null, builtHalf=false, builtMB=false, rtTv=null, builtLdr=false, lastFx=0, rtAo=null, builtAo=false, builtFmt="rgba16f";   /* (milestone 2) the half-size effects and the TV's 8-bit target */
  const mPre=mk(PRE_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()},uThresh:{value:0.85},uKnee:{value:0.5}});
  const mDown=mk(DOWN_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()}});
  const mUp=mk(UP_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()},uGain:{value:1}},{transparent:true,blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneFactor,blendEquation:THREE.AddEquation});
  const mTv=mk(TVAA_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()}});
  const tvU={tSrc:{value:null},uTexel:{value:new THREE.Vector2()},tGlow:{value:null},uGlow:{value:1}};
  const mTvG=mk(TVAA_FRAG,tvU,{defines:{GLOW:1}}), mTvGc=mk(TVAA_FRAG,tvU,{defines:{GLOW:1,NOAA:1}}), mTvPre=mk(TVPRE_FRAG,{tSrc:{value:null},uTexel:{value:new THREE.Vector2()}});
  let tvLv=[], builtGlow=false;
  let mFinal=null, mDof=null, mHalf=null, mGather=null, mAo=null;
  const fu={tScene:{value:null},tBloom:{value:null},tDepth:{value:null},tBlur:{value:null},uTexel:{value:new THREE.Vector2()},uBloom:{value:0.4},uDof:{value:0},uFocus:{value:8},uAper:{value:3.2},uDead:{value:0.022},uMaxPx:{value:16},uNear:{value:0.5},uFar:{value:4200},
    uInvVP:{value:new THREE.Matrix4()},uPrevVP:{value:new THREE.Matrix4()},uCamPos:{value:new THREE.Vector3()},uMB:{value:0},uHaze:{value:0},uHazeI:{value:1},uHazeK:{value:0.22},uVig:{value:0.3},uGrain:{value:0.03},uTime:{value:0},uGrade:{value:1},uAspect:{value:1.78},uSat:{value:1.14},uCon:{value:0.5},toneMappingExposure:{value:1},
    tHalf:{value:null},tFx:{value:null},uFxOn:{value:0},uCamWorld:{value:new THREE.Matrix4()},uProjInv:{value:new THREE.Vector2(1,1)},
    tAo:{value:null},uAoOn:{value:0},uAoMix:{value:1},uAoDbg:{value:0},uHTexel:{value:new THREE.Vector2()},uAoR:{value:0.45},uAoFar:{value:30},uAoK:{value:1.6}};
  function rt(w,h,o){ return new THREE.WebGLRenderTarget(Math.max(1,w),Math.max(1,h),Object.assign({type:THREE.HalfFloatType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false,generateMipmaps:false},o||{})); }
  function free(){ if(rtScene){ rtScene.dispose(); if(depthTex) depthTex.dispose(); } if(rtLdr) rtLdr.dispose(); if(rtDof) rtDof.dispose(); rtDof=null; levels.forEach(l=>l.dispose()); levels=[]; rtScene=rtLdr=depthTex=null; if(smaa){ smaa.dispose(); smaa=null; }
    if(rtHalf) rtHalf.dispose(); if(rtFx) rtFx.dispose(); rtHalf=rtFx=null; if(rtTv) rtTv.dispose(); rtTv=null; if(rtAo) rtAo.dispose(); rtAo=null; tvLv.forEach(l=>l.dispose()); tvLv=[]; }
  /* (re)build the targets for the drawing buffer size and the flags that decide what exists */
  function build(){
    renderer.getDrawingBufferSize(sizeV); const w=Math.max(2,Math.round(sizeV.x)), h=Math.max(2,Math.round(sizeV.y));
    if(F.ldr){
      /* the FIRE TV tier: an 8-bit target that holds exactly what the screen would (tone-mapped, sRGB-encoded by every material), then the FXAA pass to the screen */
      const wantGlow=F.tvGlow>0;
      if(w===W&&h===H&&rtTv&&builtLdr&&wantGlow===builtGlow) return;
      free(); W=w; H=h; builtLdr=true; builtHalf=false; builtDof=builtDepth=builtBloom=false; builtMsaa=0; builtAa="fxaa"; builtGlow=wantGlow;
      if(wantGlow){ const o8={type:THREE.UnsignedByteType}; tvLv=[rt(Math.ceil(W/4),Math.ceil(H/4),o8),rt(Math.ceil(W/8),Math.ceil(H/8),o8)]; }
      rtTv=new THREE.WebGLRenderTarget(W,H,{type:THREE.UnsignedByteType,format:THREE.RGBAFormat,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false,generateMipmaps:false});
      rtTv.texture.colorSpace=THREE.SRGBColorSpace; rtTv.texture.internalFormat="RGBA8"; rtTv.isXRRenderTarget=true;   /* r160: an XR-flagged target gets the renderer's tone mapping and its own colour space (sRGB) in every material; the RGBA8 store keeps the bytes as written */
      return;
    }
    const wantDof=!!F.dof, wantDepth=wantDof||F.motionBlur>0||F.haze>0, wantMsaa=(!wantDepth&&F.aa==="msaa")?4:0, wantAa=(F.aa==="smaa"||F.aa==="fxaa")?F.aa:"none", wantBloom=F.bloom>0;
    const wantDiv=Math.max(2,Math.min(8,F.bloomDiv|0||2));   /* (polish, D6: the bloom's first level is 1/bloomDiv of the frame: 4 = a quarter, about 4x less bloom work than the old half-resolution chain) */
    const wantMB=F.motionBlur>0, wantAo=!!F.half&&wantDepth&&F.ao>0, wantHalf=!!F.half&&wantDepth&&(wantDof||wantMB||wantAo), wantFmt=(F.fmt==="r11"&&!wantMB)?"r11":"rgba16f";
    if(w===W&&h===H&&rtScene&&!builtLdr&&wantDof===builtDof&&wantDepth===builtDepth&&wantMsaa===builtMsaa&&wantAa===builtAa&&wantBloom===builtBloom&&wantDiv===builtBloomDiv&&wantHalf===builtHalf&&(!wantHalf||(wantMB===builtMB&&wantAo===builtAo))&&wantFmt===builtFmt) return;
    free(); W=w; H=h; builtLdr=false; builtBloomDiv=wantDiv; builtDof=wantDof; builtDepth=wantDepth; builtMsaa=wantMsaa; builtAa=wantAa; builtBloom=wantBloom; builtHalf=wantHalf; builtMB=wantMB; builtAo=wantAo; builtFmt=wantFmt;
    const o={depthBuffer:true}; if(wantDepth){ depthTex=new THREE.DepthTexture(W,H,THREE.UnsignedIntType); o.depthTexture=depthTex; } if(wantMsaa) o.samples=wantMsaa;
    rtScene=rt(W,H,o); if(wantFmt==="r11"){ rtScene.texture.format="RGB"; rtScene.texture.internalFormat="R11F_G11F_B10F"; }   /* (three.js passes an unknown format name to WebGL as gl[name]: RGB + HALF_FLOAT + R11F_G11F_B10F is a valid WebGL2 combination) */
    if(wantDof&&!wantHalf) rtDof=rt(Math.ceil(W/2),Math.ceil(H/2));
    if(wantHalf){ rtHalf=rt(Math.ceil(W/2),Math.ceil(H/2)); rtFx=rt(Math.ceil(W/2),Math.ceil(H/2)); }
    if(wantAo) rtAo=rt(Math.ceil(W/2),Math.ceil(H/2),{type:THREE.UnsignedByteType});
    if(wantBloom){ let lw=W,lh=H; for(let k=0;k<4;k++){ const dv=k===0?wantDiv:2; lw=Math.max(2,Math.ceil(lw/dv)); lh=Math.max(2,Math.ceil(lh/dv)); levels.push(rt(lw,lh)); } }
    if(wantAa==="smaa"){ rtLdr=rt(W,H,{type:THREE.UnsignedByteType}); smaa=new SMAAPass(W,H); smaa.renderToScreen=true; }
    /* the final material is made again when the compile-time options change (the depth of field's taps, the bloom) */
    const defs={}; if(wantDof){ defs.DOF=1; defs.DOF_TAPS=Math.max(6,F.dofTaps|0); } if(wantDepth) defs.DEPTH=1; if(wantBloom) defs.BLOOM=1; if(wantAa==="fxaa") defs.AA=1; if(wantHalf) defs.HALF=1; if(wantAo) defs.AO=1;
    if(mFinal) mFinal.dispose(); mFinal=mk(FINAL_FRAG,fu,{defines:defs});
    if(mDof) mDof.dispose(); mDof=(wantDof&&!wantHalf)?mk(DOF_FRAG,fu,{defines:{DOF_TAPS:Math.max(6,F.dofTaps|0)}}):null;
    if(mHalf) mHalf.dispose(); if(mGather) mGather.dispose(); if(mAo) mAo.dispose(); mHalf=mGather=mAo=null;
    if(wantHalf){ mHalf=mk(HALF_FRAG,fu); const gd={DOF_TAPS:Math.max(6,F.dofTaps|0)}; if(wantDof) gd.DOF=1; if(wantMB) gd.MB=1; if(wantDof||wantMB) mGather=mk(GATHER_FRAG,fu,{defines:gd}); }
    if(wantAo) mAo=mk(AO_FRAG,fu);
  }
  function pass(mat,target,src,srcW,srcH,extra){
    mat.uniforms.tSrc.value=src; mat.uniforms.uTexel.value.set(1/srcW,1/srcH); if(extra) extra(mat);
    fsMesh.material=mat; renderer.setRenderTarget(target); renderer.render(fsScene,fsCam);
  }
  P.render=function(scene,cam,tw){
    build();
    const ac=renderer.autoClear, tm=renderer.toneMapping;
    if(builtLdr){
      /* the FIRE TV tier: the frame as the screen would get it, then FXAA (one pass) to the screen */
      renderer.autoClear=true; renderer.setRenderTarget(rtTv); renderer.render(scene,cam);
      renderer.autoClear=false;
      if(builtGlow&&tvLv.length===2){
        pass(mTvPre,tvLv[0],rtTv.texture,W,H);
        pass(mDown,tvLv[1],tvLv[0].texture,tvLv[0].width,tvLv[0].height);
        pass(mUp,tvLv[0],tvLv[1].texture,tvLv[1].width,tvLv[1].height,m=>{ m.uniforms.uGain.value=1.0; });
        tvU.tGlow.value=tvLv[0].texture; tvU.uGlow.value=F.tvGlow;
        pass(F.tvFxaa===false?mTvGc:mTvG,null,rtTv.texture,W,H);
      } else pass(mTv,null,rtTv.texture,W,H);
      renderer.setRenderTarget(null); renderer.autoClear=ac; return;
    }
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
    if(depthTex){ cam.updateMatrixWorld(); u.uInvVP.value.multiplyMatrices(cam.matrixWorld,cam.projectionMatrixInverse); u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld); u.uPrevVP.value.copy(prevVP); u.uMB.value=F.motionBlur*mbAmt; u.uHaze.value=F.haze; u.uHazeI.value=F.hazeI; }
    u.toneMappingExposure.value=F.exposure!=null?F.exposure:renderer.toneMappingExposure;
    if(mDof&&u.uDof.value>0.002){ u.tBlur.value=rtDof.texture; fsMesh.material=mDof; renderer.setRenderTarget(rtDof); renderer.render(fsScene,fsCam); }
    /* (half) the depth of field and the motion blur at half size: the prepass packs colour + linear depth, the gather blurs that small target; the final pass composites it */
    lastFx=0;
    if(builtHalf){
      const fxOn=!!mGather&&((builtDof&&u.uDof.value>0.002)||(builtMB&&u.uMB.value>0.001)), aoOn=builtAo&&F.ao>0&&aoWant;
      u.uFxOn.value=fxOn?1:0; u.uAoOn.value=aoOn?1:0;
      if(fxOn||aoOn){
        const pe=cam.projectionMatrix.elements; u.uProjInv.value.set(1/pe[0],1/pe[5]); u.uCamWorld.value.copy(cam.matrixWorld);
        fsMesh.material=mHalf; renderer.setRenderTarget(rtHalf); renderer.render(fsScene,fsCam); u.tHalf.value=rtHalf.texture; lastFx=1;
        if(fxOn){ fsMesh.material=mGather; renderer.setRenderTarget(rtFx); renderer.render(fsScene,fsCam); u.tFx.value=rtFx.texture; lastFx++; }
        if(aoOn){ u.uHTexel.value.set(1/rtHalf.width,1/rtHalf.height); u.uAoR.value=F.aoR; u.uAoFar.value=F.aoFar; u.uAoK.value=F.aoK; u.uAoMix.value=Math.min(1,F.ao); u.uAoDbg.value=F.aoDebug?1:0;
          fsMesh.material=mAo; renderer.setRenderTarget(rtAo); renderer.render(fsScene,fsCam); u.tAo.value=rtAo.texture; lastFx++; }
      }
    }
    fsMesh.material=mFinal; renderer.setRenderTarget(rtLdr?rtLdr:null); renderer.render(fsScene,fsCam);
    if(smaa){ smaa.render(renderer,null,rtLdr); }
    renderer.setRenderTarget(null); renderer.autoClear=ac;
  };
  P.resize=function(){ /* the targets follow the drawing buffer: build() looks at it every frame */ };
  P.setFlags=function(f){ Object.assign(F,f||{}); fu.uAper.value=F.dofAper!=null?F.dofAper:3.2; fu.uDead.value=F.dofDead!=null?F.dofDead:0.022; };
  P.setDof=function(amount,focus){ dofAmt=amount; dofFocus=Math.max(0.5,focus); };
  /* the contact shadows only when the picture is about a rider near enough for them to show (a wide shot: no prepass, no AO pass) */
  P.setAo=function(on){ aoWant=!!on; };
  /* the camera's view-projection one step ago and how much of the foreground blur to keep (0 = none: a cut, a wide shot) */
  P.setMotion=function(prev,amount){ prevVP.copy(prev); mbAmt=amount; };
  P.info=function(){ if(builtLdr) return {w:W,h:H,passes:builtGlow?4:1,targets:1+tvLv.length,dof:false,depth:false,aa:"fxaa",msaa:0,bloom:false,half:false,ldr:true,tvGlow:builtGlow};
    return {w:W,h:H,passes:(levels.length?1+2*(levels.length-1):0)+1+(smaa?3:0)+(rtDof?1:0)+lastFx,targets:(rtScene?1:0)+levels.length+(rtLdr?1:0)+(depthTex?1:0)+(rtDof?1:0)+(rtHalf?2:0)+(rtAo?1:0),dof:builtDof,depth:builtDepth,aa:builtAa,msaa:builtMsaa,bloom:builtBloom,half:builtHalf,ao:builtAo,fmt:builtFmt,ldr:false}; };
  P.dispose=function(){ P.dead=true; free(); [mPre,mDown,mUp,mTv,mTvG,mTvGc,mTvPre].forEach(m=>m.dispose()); if(mFinal) mFinal.dispose(); if(mDof) mDof.dispose(); if(mHalf) mHalf.dispose(); if(mGather) mGather.dispose(); if(mAo) mAo.dispose(); fsGeo.dispose(); };
  P.setFlags(null);
  return P;
}
/* does this GPU render into half-float targets? (WebGL2 with EXT_color_buffer_float or EXT_color_buffer_half_float; WebGL1 never gets a chain) */
export function postSupported(renderer){
  try{ const gl=renderer.getContext(); if(!renderer.capabilities.isWebGL2) return false; return !!(renderer.extensions.has("EXT_color_buffer_float")||renderer.extensions.has("EXT_color_buffer_half_float")); }catch(e){ return false; }
}
