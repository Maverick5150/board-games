/* MOTOCROSS WAR 3D — THE RIDERS (owner: rider): the rider as a SKINNED, SKELETAL character (an original model, no logos, no sponsor marks, no real liveries:
   the team is the colour, the number is plain text). The body is ONE skinned mesh (r3d-rider-model.js: a 17-bone skeleton, jersey, sleeves, gloves, pants, knee braces,
   boots, helmet with peak, goggles, a neck brace, the number patch curved over the back) posed every frame by r3d-rider-pose.js (damped springs for the body, two-bone
   IK for hands on the grips and feet on the pegs, a ragdoll-ish crash). The skinning is done on the GPU for ALL riders in one draw call per part: every rider's bone
   matrices live in a float DATA TEXTURE (one row a rider), the vertex shader (patched into three.js' own Lambert / Phong / depth materials) blends two bones a vertex
   and tints the colour slots (team / accent / fixed) per rider, so the shadow pass and the lights work as for any mesh. Levels of detail: the nearest riders (hi) are the
   full model (about 3,500 triangles: body + glossy helmet + the number patch), the rest of the pack is a thin version of the same skeleton (about 1,000, one mesh).
   createRiders() is the instancing glue: it makes the bike's meshes (r3d-bike.js createBike) and the rider's, poseRider() poses the bike (poseBike) and then the rider.
   The roost / dust particles are r3d-fx.js. Bike local axes: +X forward, +Y up, +Z right (heading th: rotation.y = -th; roll + = lean right; pitch + = nose up; Euler order YZX).
   createRiders(list, {lo, riderHi}) -> R {grp, M (the bike's InstancedMeshes, plates, blob shadows, tags), A (atlas), n, list, S (the skinned meshes)};
   poseRider(R, i, B, st) with B = the bike's world Matrix4 and st = the per-frame state (CONTRACT.md); commit(R, cam, dt) once a frame after posing. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {canvas,MAT,getKitTier} from "./r3d-util.js";
import {BIKE,createBike,colorBike,poseBike,hideBike,plateGeo,drawPlate} from "./r3d-bike.js";
import {buildRider,NB} from "./r3d-rider-model.js";
import {newRig,poseRide,poseBody,blendStart,blendStep} from "./r3d-rider-pose.js";
import {applyApparel,AP_VERT_DECL,AP_VERT_SET} from "./r3d-rider-apparel.js";   /* the outfit painted in the fragment shader (polish step) */
export {BIKE} from "./r3d-bike.js";   /* (the old import path) */
export {emit,stepParticles} from "./r3d-fx.js";   /* (the old import path: the particles moved to r3d-fx.js; the first argument is now the particle system FX.part, no longer the rider set) */

/* ---------------- the number atlas: plates (white / red), the jersey-back numbers and the floating tags, drawn in code ---------------- */
function atlas(riders,scale){
  const cols=16, cell=128, rows=Math.ceil((riders.length*3+2)/cols), c=canvas(cols*cell,Math.max(1,rows)*cell), x=c.getContext("2d");
  const cells={};
  let k=0;
  function rr(px,py,w,h,r){ x.beginPath(); x.moveTo(px+r,py); x.lineTo(px+w-r,py); x.quadraticCurveTo(px+w,py,px+w,py+r); x.lineTo(px+w,py+h-r); x.quadraticCurveTo(px+w,py+h,px+w-r,py+h); x.lineTo(px+r,py+h); x.quadraticCurveTo(px,py+h,px,py+h-r); x.lineTo(px,py+r); x.quadraticCurveTo(px,py,px+r,py); x.closePath(); }
  function fit(t,max,base){ let fs=base; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; while(x.measureText(t).width>max&&fs>30){ fs-=4; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; } return fs; }
  riders.forEach(R=>{
    const t=String(R.num==null?"":R.num);
    const p=k++, px=(p%cols)*cell, py=Math.floor(p/cols)*cell;
    drawPlate(x,rr,fit,px,py,cell,R,t);   /* the plate: r3d-bike.js */
    /* the jersey back: the number in white with a dark edge (transparent around it) */
    const d=k++, dx=(d%cols)*cell, dy=Math.floor(d/cols)*cell;
    /* (milestone 2) the NAME across the shoulders and the number under it, both plain text, the number with a dark stitched-on edge */
    { const nm=String(R.name||"").trim().split(/\s+/).pop().toUpperCase().slice(0,11);
      x.textAlign="center"; x.textBaseline="middle"; x.lineJoin="round";
      if(nm){ let fs=24; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; while(x.measureText(nm).width>cell-12&&fs>12){ fs-=2; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; }
        x.lineWidth=5; x.strokeStyle="rgba(10,10,14,.85)"; x.strokeText(nm,dx+cell/2,dy+15); x.fillStyle="#f4f5f7"; x.fillText(nm,dx+cell/2,dy+15); }
      fit(t,cell-10,100); const ny=dy+(nm?cell*0.615:cell/2+4);   /* (the number as big as the cover's: across the whole upper back) */
      x.lineWidth=12; x.strokeStyle="rgba(10,10,14,.92)"; x.strokeText(t,dx+cell/2,ny); x.lineWidth=4; x.strokeStyle="rgba(255,255,255,.55)"; x.strokeText(t,dx+cell/2,ny);
      x.fillStyle=R.red?"#ff5a5a":"#ffffff"; x.fillText(t,dx+cell/2,ny); }
    /* the floating tag: the plate on a dark pill (gold ring for a person, red for the leader) */
    const g=k++, gx=(g%cols)*cell, gy=Math.floor(g/cols)*cell;
    x.fillStyle="rgba(10,10,16,.82)"; rr(gx+2,gy+24,cell-4,cell-48,22); x.fill();
    x.lineWidth=6; x.strokeStyle=R.me?"#f0c040":R.red?"#ff3b3b":"rgba(255,255,255,.35)"; rr(gx+5,gy+27,cell-10,cell-54,19); x.stroke();
    x.fillStyle=R.me?"#ffd76a":R.red?"#ff6b6b":"#ffffff"; fit(t,cell-26,64); x.fillText(t,gx+cell/2,gy+cell/2+3);
    cells[R.s]={plate:p,decal:d,tag:g};
  });
  /* the FIRE TV tier (q.texMax 512): the atlas is drawn at 2048 px and kept at half size (the cells keep their place: the UVs are fractions of the grid): 1.7 MB with mipmaps instead of 7 MB, the biggest texture of that tier */
  let img=c; if(scale&&scale<1){ img=canvas(Math.round(c.width*scale),Math.round(c.height*scale)); const g=img.getContext("2d"); g.imageSmoothingQuality="high"; g.drawImage(c,0,0,img.width,img.height); }
  const T=new THREE.CanvasTexture(img); T.colorSpace=THREE.SRGBColorSpace; T.anisotropy=4; T.generateMipmaps=true; T.minFilter=THREE.LinearMipmapLinearFilter;
  return {tex:T,cells:cells,cols:cols,rows:Math.max(1,rows),canvas:img};
}
/* a Lambert material whose map is one atlas cell per instance (attribute aCell = column, row) */
function atlasMat(T,cols,rows,opts){
  const m=new THREE.MeshLambertMaterial(Object.assign({map:T},opts||{}));
  m.onBeforeCompile=function(sh){
    sh.uniforms.uGrid={value:new THREE.Vector2(1/cols,1/rows)};
    sh.vertexShader="attribute vec2 aCell;\nuniform vec2 uGrid;\n"+sh.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv=vec2((aCell.x+uv.x)*uGrid.x,1.0-(aCell.y+1.0-uv.y)*uGrid.y);\n#endif");
    /* milestone 2 (director's note: a ghost bike near the lens kept an opaque number plate): the plates fade with the bike and the rider (the same dither, 1.7 m to 0.8 m from the lens) */
    sh.fragmentShader=sh.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n { float mxZ=vViewPosition.z; if(mxZ<1.7){ float mxA=smoothstep(0.8,1.7,mxZ); if(mxA<fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))) discard; } }");
  };
  m.customProgramCacheKey=()=>"atlas-fade"+cols+"x"+rows;
  return m;
}

/* ---------------- the skinned rider's shader: bone matrices from a data texture, two bones a vertex, colour slots, cloth flutter ---------------- */
/* per vertex: aSkin (bone, bone, weight, weight), aFx (colour slot 0 team / 1 accent / 2 fixed, flutter, mud weight); per instance: aInstA (rider row, team rgb),
   aInstB (accent rgb, wind), aInstC (mud, -, atlas column, atlas row). uBones: NB x 3 texels a row (the three rows of each bone's 3 x 4 matrix), one row a rider. */
const SKIN_DECL=`
attribute vec4 aSkin; attribute vec4 aFx; attribute vec4 aInstA; attribute vec4 aInstB; attribute vec4 aInstC;
uniform highp sampler2D uBones; uniform float uTime;
#ifdef MX_WRINKLE
varying vec3 vMxP; varying float vMxK;
#endif
${AP_VERT_DECL}
void mxRows(out vec4 R0,out vec4 R1,out vec4 R2){
  int row=int(aInstA.x+0.5), b0=int(aSkin.x+0.5)*3, b1=int(aSkin.y+0.5)*3;
  vec4 a0=texelFetch(uBones,ivec2(b0,row),0), a1=texelFetch(uBones,ivec2(b0+1,row),0), a2=texelFetch(uBones,ivec2(b0+2,row),0);
  if(aSkin.w>0.001){
    vec4 c0=texelFetch(uBones,ivec2(b1,row),0), c1=texelFetch(uBones,ivec2(b1+1,row),0), c2=texelFetch(uBones,ivec2(b1+2,row),0);
    R0=a0*aSkin.z+c0*aSkin.w; R1=a1*aSkin.z+c1*aSkin.w; R2=a2*aSkin.z+c2*aSkin.w;
  } else { R0=a0; R1=a1; R2=a2; }
}
`;
const SKIN_NORMAL=`
vec4 mxR0,mxR1,mxR2; mxRows(mxR0,mxR1,mxR2);
vec3 objectNormal=normalize(vec3(dot(mxR0.xyz,normal),dot(mxR1.xyz,normal),dot(mxR2.xyz,normal)));
#ifdef USE_TANGENT
 vec3 objectTangent=vec3(tangent.xyz);
#endif
#define MX_ROWS
`;
const SKIN_POS=`
#ifndef MX_ROWS
 vec4 mxR0,mxR1,mxR2; mxRows(mxR0,mxR1,mxR2);
#endif
vec4 mxP=vec4(position,1.0);
vec3 transformed=vec3(dot(mxR0,mxP),dot(mxR1,mxP),dot(mxR2,mxP));
#ifdef MX_WRINKLE
 vMxP=position; vMxK=clamp(0.25+aFx.y*1.4,0.0,1.0);
#endif
${AP_VERT_SET}
#ifdef MX_ROWS
 { float fl=aFx.y*aInstB.w; if(fl>0.0){ float ph=dot(position,vec3(5.0,8.0,4.0))+aInstA.x*2.7; transformed+=objectNormal*(fl*0.015*(0.6*sin(uTime*12.0+ph)+0.4*sin(uTime*19.0+ph*1.6))); } }
#endif
`;
const SKIN_COLOR=`
#include <color_vertex>
#ifdef USE_COLOR
 { float sl=aFx.x; int sty=int(aInstC.y+0.5); vec3 tint=sl<0.5?aInstA.yzw:(sl<1.5?aInstB.xyz:(sl<2.5?vec3(1.0):(sl<3.5?(((sty&1)!=0)?aInstB.xyz:aInstA.yzw):(sl<4.5?(((sty&2)!=0)?aInstB.xyz:aInstA.yzw):(((sty&4)!=0)?aInstB.xyz:aInstA.yzw))))); vColor.rgb*=tint; vColor.rgb=mix(vColor.rgb,vec3(0.26,0.17,0.10),aFx.z*aInstC.x*0.78); }
#endif
`;
/* patch a three.js material: kind "main" (lit), "depth" (the shadow pass), opts.atlas (the number patch's atlas cell from aInstC.zw) */
function skinMat(mat,U,kind,opts){
  opts=opts||{};
  mat.onBeforeCompile=sh=>{
    sh.uniforms.uBones=U.uBones; sh.uniforms.uTime=U.uTime;
    if(opts.apparel) applyApparel(sh,opts.apparel,opts.kind||"cloth");
    if(kind==="main") sh.fragmentShader=sh.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n/* the near-lens fade (director note D12: no body ever fills the lens): a dithered dissolve between 1.7 m and 0.8 m from the camera */\n { float mxZ=vViewPosition.z; if(mxZ<1.7){ float mxA=smoothstep(0.8,1.7,mxZ); if(mxA<fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(0.06711056,0.00583715))))) discard; } }");
    if(opts.wrinkle&&!opts.apparel){ sh.vertexShader="#define MX_WRINKLE\n"+sh.vertexShader;
      sh.fragmentShader="#define MX_WRINKLE\nvarying vec3 vMxP; varying float vMxK;\n"+sh.fragmentShader.replace("#include <color_fragment>","#include <color_fragment>\n { float w=sin(vMxP.y*46.0+2.2*sin(vMxP.x*29.0+vMxP.z*35.0))*0.55+sin(vMxP.y*83.0+vMxP.z*41.0+1.7)*0.25; diffuseColor.rgb*=1.0+0.06*w*vMxK; }"); }
    /* a rim of the rider's own colour on the edges facing away from the camera: the riders stand out of the dark stands as in a backlit cover */
    if(opts.rim){ sh.uniforms.uRim={value:opts.rim}; sh.fragmentShader="uniform float uRim;\n"+sh.fragmentShader.replace("#include <emissivemap_fragment>","#include <emissivemap_fragment>\n float mxRim=pow(1.0-clamp(dot(normalize(normal),normalize(vViewPosition)),0.0,1.0),3.0); totalEmissiveRadiance+=diffuseColor.rgb*mxRim*uRim;"); }
    if(opts.atlas) sh.uniforms.uGrid={value:opts.atlas};
    let vs=sh.vertexShader.replace("#include <common>","#include <common>\n"+SKIN_DECL+(opts.atlas?"uniform vec2 uGrid;\n":""));
    vs=vs.replace("#include <beginnormal_vertex>",SKIN_NORMAL).replace("#include <begin_vertex>",SKIN_POS).replace("#include <color_vertex>",SKIN_COLOR);
    if(opts.atlas) vs=vs.replace("#include <uv_vertex>","#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv=vec2((aInstC.z+uv.x)*uGrid.x,1.0-(aInstC.w+1.0-uv.y)*uGrid.y);\n#endif");
    sh.vertexShader=vs;
  };
  mat.customProgramCacheKey=()=>"mx-skin-"+kind+"-"+(opts.tag||"")+(opts.atlas?"-atlas":"")+(opts.rim?"-rim":"")+(opts.wrinkle&&!opts.apparel?"-wr":"")+(opts.apparel?"-ap"+opts.apparel+(opts.kind||""):"");   /* (a key of its own per material: three.js only calls onBeforeCompile for a program it has not built yet, so a second material with the same key would never get its uniforms) */
  return mat;
}
/* an instanced geometry (a plain Mesh drawn instanced: no instance matrix) over a source geometry, sharing the per-instance attributes */
function instGeo(src,inst){
  const g=new THREE.InstancedBufferGeometry(); g.setIndex(src.index); Object.keys(src.attributes).forEach(k=>g.setAttribute(k,src.attributes[k]));
  g.setAttribute("aInstA",inst.A); g.setAttribute("aInstB",inst.B); g.setAttribute("aInstC",inst.C); g.instanceCount=0; g.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,0),1e5); return g;
}
function instAttrs(n){ const mk=()=>{ const a=new THREE.InstancedBufferAttribute(new Float32Array(n*4),4); a.setUsage(THREE.DynamicDrawUsage); return a; }; return {A:mk(),B:mk(),C:mk()}; }

/* ---------------- the rider set ---------------- */
export function createRiders(list,opts){
  opts=opts||{};
  const n=list.length, lo=!!opts.lo, grp=new THREE.Group();
  const mk=(geo,count,mat)=>{ const m=new THREE.InstancedMesh(geo,mat,count); m.frustumCulled=false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(m); return m; };
  const aScale=(opts.texMax||2048)<=512?0.5:1;
  const A=atlas(list,aScale);
  const M=createBike(n,lo,mk,opts);   /* the bike's instanced parts in three levels of detail (r3d-bike.js: opts.bikeLod = the distances at which a bike leaves one level for the next, from the quality tier) */
  /* ---- the skinned riders ---- */
  const boneData=new Float32Array(n*NB*12), boneTex=new THREE.DataTexture(boneData,NB*3,n,THREE.RGBAFormat,THREE.FloatType);
  boneTex.minFilter=boneTex.magFilter=THREE.NearestFilter; boneTex.generateMipmaps=false; boneTex.needsUpdate=true;
  const U={uBones:{value:boneTex},uTime:{value:0}};
  const hiModel=buildRider(1,lo), loModel=buildRider(0);   /* (milestone 2: the near rider is 5,500 triangles on the physically based tiers; the FIRE TV tier / Reduce effects build the lite one, 4,100, about the old cost) */
  const hiInst=instAttrs(n), loInst=instAttrs(n);
  /* THE LEAD'S MATERIAL KIT on the gear (integrate step): the jersey, pants and gloves are physically based cloth (rough, a touch of the stadium's light from the environment map), the helmet is a glossy clear-coat shell that reflects the floodlights; the kit tier follows the quality tier (r3d-look.js), "low" / Reduce effects keep the old Lambert / Phong parts.
     The skinning patch (skinMat) works on any of them: the same chunks. The riders' own rim light is lighter than in the rider branch (the lead's rim and the bloom do that work now). */
  const KT=lo?"low":getKitTier();
  /* THE APPAREL (r3d-rider-apparel.js): the outfit is painted in the fragment shader from the rest-pose position and the outfit part: level 2 (noise, creases, mud splatter) on the near riders of the physically based tiers, level 1 (flat panels, seams, a plain mud tint) on the thin pack and the FIRE TV tier */
  const apHi=(lo||KT==="low")?1:2;
  /* (milestone 2) the near riders' cloth on the high kit tier is the kit's FABRIC (a physically based cloth with a soft sheen at grazing angles: the folds catch the floodlights like the cover's jerseys); the pack keeps the plain standard cloth */
  const fabric=()=>{ const m=MAT.fabric(null,{vertexColors:true,roughness:0.9,envMapIntensity:0.42}); if(m.sheen!=null) m.sheen=0.32; return m; };
  const mkCloth=(ap,tag)=>skinMat(KT==="low"?(lo?new THREE.MeshLambertMaterial({vertexColors:true}):new THREE.MeshPhongMaterial({vertexColors:true,shininess:22,specular:0x262626})):(KT==="high"&&tag==="hi"?fabric():new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.92,metalness:0,envMapIntensity:0.42})),U,"main",{tag:"cloth"+KT+tag,rim:lo?0:(KT==="low"?0.34:0.16),wrinkle:!lo,apparel:ap,kind:"cloth"});
  const cloth=mkCloth(apHi,"hi"), clothLo=mkCloth(1,"lo");
  const shell=skinMat(KT==="low"?(lo?new THREE.MeshLambertMaterial({vertexColors:true}):new THREE.MeshPhongMaterial({vertexColors:true,shininess:120,specular:0x9a9a9a})):MAT.gloss(null,{vertexColors:true}),U,"main",{tag:"shell"+KT,rim:lo?0:(KT==="low"?0.22:0.08),apparel:apHi,kind:"shell"});
  const decal=skinMat(new THREE.MeshLambertMaterial({map:A.tex,vertexColors:true,alphaTest:0.4}),U,"main",{tag:"decal",atlas:new THREE.Vector2(1/A.cols,1/A.rows)});
  const depth=skinMat(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}),U,"depth",{tag:"shadow"});
  cloth.addEventListener("dispose",()=>{ boneTex.dispose(); depth.dispose(); });   /* (the bone texture and the shadow pass material are not reached by a tree walk) */
  const part=(geo,mat,shadow,order)=>{ const m=new THREE.Mesh(geo,mat); m.frustumCulled=false; m.castShadow=!!shadow; if(shadow) m.customDepthMaterial=depth; if(order) m.renderOrder=order; grp.add(m); return m; };
  const S={hiBody:part(instGeo(hiModel.body,hiInst),cloth,true), hiHelmet:part(instGeo(hiModel.helmet,hiInst),shell,true), hiBack:part(instGeo(hiModel.back,hiInst),decal,false), loBody:part(instGeo(loModel.body,loInst),clothLo,true)};
  /* the near riders receive the key's shadow (the helmet's on the shoulders, the arm's on the jersey, the bike's on the legs): the physically based tiers only */
  if(KT!=="low"&&!lo){ S.hiBody.receiveShadow=true; S.hiHelmet.receiveShadow=true; S.loBody.receiveShadow=true; }
  /* plates (3 a bike) use the atlas */
  const pg=plateGeo(), cellA=new Float32Array(n*3*2);
  list.forEach((R,i)=>{ const c=A.cells[R.s]; for(let k=0;k<3;k++){ cellA[(i*3+k)*2]=c.plate%A.cols; cellA[(i*3+k)*2+1]=Math.floor(c.plate/A.cols); } });
  const pgA=pg.clone(); pgA.setAttribute("aCell",new THREE.InstancedBufferAttribute(cellA,2));
  M.plate=mk(pgA,n*3,atlasMat(A.tex,A.cols,A.rows,{side:THREE.DoubleSide}));
  /* team colours: the bike's plastics and trim (r3d-bike.js), the riders' tints (linear rgb) */
  const col=new THREE.Color(), team=new Float32Array(n*3), acc=new Float32Array(n*3), cell=new Float32Array(n*2), style=new Uint8Array(n);
  list.forEach((R,i)=>{
    colorBike(M,i,R);
    col.set(R.color||"#888"); team[i*3]=col.r; team[i*3+1]=col.g; team[i*3+2]=col.b;
    col.set(R.accent||"#f2f2f6"); acc[i*3]=col.r; acc[i*3+1]=col.g; acc[i*3+2]=col.b;
    const c=A.cells[R.s]; cell[i*2]=c.decal%A.cols; cell[i*2+1]=Math.floor(c.decal/A.cols); style[i]=((R.s|0)*5+2)&7;   /* which zones (chest band and biceps / side panels / pants) take the accent colour */
  });
  Object.values(M).forEach(m=>{ if(m.instanceColor) m.instanceColor.needsUpdate=true; });
  /* blob shadows: one quad under each bike and one under each rider (for crashes); a soft dark ellipse */
  const sc=canvas(64,64), sx=sc.getContext("2d"), sg=sx.createRadialGradient(32,32,2,32,32,32); sg.addColorStop(0,"rgba(0,0,0,.74)"); sg.addColorStop(0.45,"rgba(0,0,0,.46)"); sg.addColorStop(0.8,"rgba(0,0,0,.16)"); sg.addColorStop(1,"rgba(0,0,0,0)"); sx.fillStyle=sg; sx.fillRect(0,0,64,64);
  const st=new THREE.CanvasTexture(sc);
  const shGeo=new THREE.PlaneGeometry(1,1); shGeo.rotateX(-Math.PI/2);
  const shMat=new THREE.MeshBasicMaterial({map:st,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  /* each blob's own opacity in its instance colour (red channel): faint where the real shadows fall, whole elsewhere */
  shMat.onBeforeCompile=sh=>{ sh.fragmentShader=sh.fragmentShader.replace("#include <color_fragment>","#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )\n diffuseColor.a*=vColor.r;\n#endif"); };
  shMat.customProgramCacheKey=()=>"mx-blob";
  M.shadow=new THREE.InstancedMesh(shGeo,shMat,n*2); M.shadow.frustumCulled=false; M.shadow.renderOrder=2; grp.add(M.shadow);
  { const w=new THREE.Color(1,1,1); for(let k=0;k<n*2;k++) M.shadow.setColorAt(k,w); M.shadow.instanceColor.setUsage(THREE.DynamicDrawUsage); }
  /* floating number tags (billboards) */
  const tagG=new THREE.PlaneGeometry(1,1), cellT=new Float32Array(n*2);
  list.forEach((R,i)=>{ const c=A.cells[R.s]; cellT[i*2]=c.tag%A.cols; cellT[i*2+1]=Math.floor(c.tag/A.cols); });
  tagG.setAttribute("aCell",new THREE.InstancedBufferAttribute(cellT,2));
  const tagMat=new THREE.ShaderMaterial({uniforms:{map:{value:A.tex},uGrid:{value:new THREE.Vector2(1/A.cols,1/A.rows)}},transparent:true,depthTest:true,depthWrite:false,
    vertexShader:"attribute vec2 aCell; uniform vec2 uGrid; varying vec2 vUv; void main(){ vUv=vec2((aCell.x+uv.x)*uGrid.x,1.0-(aCell.y+1.0-uv.y)*uGrid.y); vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); float s=length(instanceMatrix[0].xyz); c.xyz+=normalize(-c.xyz)*min(1.8,0.25*length(c.xyz)); c.xy+=position.xy*s; gl_Position=projectionMatrix*c; }",
    fragmentShader:"uniform sampler2D map; varying vec2 vUv; void main(){ vec4 t=texture2D(map,vUv); if(t.a<0.05) discard; gl_FragColor=t; }"});
  M.tag=new THREE.InstancedMesh(tagG,tagMat,n); M.tag.frustumCulled=false; M.tag.renderOrder=20; grp.add(M.tag);
  const R={grp,M,A,aScale,n,list,S,hidden:new Uint8Array(n),vis:new Uint8Array(n),shown:new Uint8Array(n),pos:new Float32Array(n*3),team,acc,cell,style,me:list.map(r=>!!r.me),wind:new Float32Array(n),mud:new Float32Array(n),
    rig:list.map((r,i)=>newRig(i)),bones:boneData,boneTex,U,hiInst,loInst,nHi:Math.max(0,opts.riderHi!=null?opts.riderHi:(lo?3:8)),dt:1/60,t:0,order:[],lod:new Int8Array(n),stats:{hi:0,lo:0,tris:hiModel.tris}};
  /* scratch */
  R._m=new THREE.Matrix4(); R._q=new THREE.Quaternion(); R._e=new THREE.Euler(0,0,0,"YZX"); R._v=new THREE.Vector3(); R._s=new THREE.Vector3(1,1,1);
  return R;
}

/* ---------------- posing ---------------- */
const _m1=new THREE.Matrix4();
/* place one rider: B = the bike's world matrix (a Matrix4), st = the per-frame state (CONTRACT.md). Normal riding reads st.stand, dab, lean, crouch, pitch, acc, v, k, air, landed, impact
   (the bike's own acceleration is measured from B). A crash: st.body = the rider's body matrix and st.limbs = {spread, walk, phase, stand, reach} */
export function poseRider(R,i,B,st){
  if(st.hide){ hideRider(R,i); return; }
  poseBike(R.M,i,B,st);   /* the bike: wheels, suspension, fork, swingarm, plates (r3d-bike.js) */
  const e=B.elements, p=R.pos; p[i*3]=e[12]; p[i*3+1]=e[13]; p[i*3+2]=e[14]; R.vis[i]=1; R.wind[i]=Math.min(1,Math.max(0,(st.v||0)/16)); if(st.mud!=null) R.mud[i]=st.mud;
  /* milestone 2: a change of pose kind (riding -> the fall, the walk back -> riding again at the remount) BLENDS from the pose he showed last frame (0.16 s into a fall, 0.55 s onto the bike) */
  const rig=R.rig[i], mode=st.body?"body":"ride", base=i*NB*12, ref=st.body?st.body.elements:e;
  if(rig.mode&&rig.mode!==mode&&R.shown&&R.shown[i]) blendStart(rig,R.bones,base,ref,mode==="ride"?0.55:0.16);
  rig.mode=mode;
  if(st.body) poseBody(rig,st.body,st.limbs,R.dt,R.bones,base);
  else poseRide(rig,e,st,R.dt,R.bones,base);
  blendStep(rig,R.bones,base,ref,R.dt);
  if(R.shown) R.shown[i]=1;
}
export function hideRider(R,i){
  hideBike(R.M,i); R.vis[i]=0; if(R.shown) R.shown[i]=0;
  const z=_m1.makeScale(0,0,0); R.M.shadow.setMatrixAt(i*2,z); R.M.shadow.setMatrixAt(i*2+1,z); R.M.tag.setMatrixAt(i,z);
}
const _sCol=new THREE.Color();
export function shadowAt(R,k,x,y,z,th,sx,sz,alpha,gs,gl,op){
  if(op!=null){ _sCol.setRGB(op,op,op); R.M.shadow.setColorAt(k,_sCol); }
  /* a quad lying ON the ground: tilted to the slope along the bike (gs = dy/ds) and across it (gl = dy/dlat), so a berm or a mound face
     never half-buries it */
  const c=Math.cos(th), s2=Math.sin(th), a=sx*alpha+0.001, b=sz*alpha+0.001; gs=gs||0; gl=gl||0;
  const fl=Math.hypot(1,gs), ll=Math.hypot(1,gl);
  const fx=c/fl, fy=gs/fl, fz=s2/fl, lx=-s2/ll, ly=gl/ll, lz=c/ll;
  let ux=ly*fz-lz*fy, uy=lz*fx-lx*fz, uz=lx*fy-ly*fx; const ul=Math.hypot(ux,uy,uz)||1; ux/=ul; uy/=ul; uz/=ul;
  _m1.set(fx*a,ux,lx*b,x+ux*0.05, fy*a,uy,ly*b,y+uy*0.05, fz*a,uz,lz*b,z+uz*0.05, 0,0,0,1); R.M.shadow.setMatrixAt(k,_m1);
}
export function tagAt(R,i,pos,size){ if(!size){ R.M.tag.setMatrixAt(i,_m1.makeScale(0,0,0)); return; } _m1.makeScale(size,size,size); _m1.setPosition(pos); R.M.tag.setMatrixAt(i,_m1); }
/* once a frame, after posing: the nearest riders (R.nHi, by distance to the camera) are drawn as the full model, the rest as the thin one; every buffer is uploaded.
   cam = the camera (its position), dt = the step just taken (the next frame's poses use it for their springs) */
export function commit(R,cam,dt){
  const M=R.M; Object.keys(M).forEach(k=>{ if(M[k].instanceMatrix) M[k].instanceMatrix.needsUpdate=true; });
  if(M.shadow.instanceColor) M.shadow.instanceColor.needsUpdate=true;
  R.dt=dt>=1/240?Math.min(0.05,dt):0; if(dt>0){ R.t+=dt; R.U.uTime.value=R.t%1000; }
  const n=R.n, order=R.order, P=R.pos; order.length=0;
  /* who gets the full model: the riders IN VIEW, the nearest first by depth (a rider behind the lens or off the screen is the last to be chosen, the person's own rider is favoured) */
  if(cam) cam.updateMatrixWorld();   /* (the view matrix as the camera is NOW, not as the last draw left it: the same riders get the full model whatever was drawn before) */
  const mi=cam?cam.matrixWorldInverse.elements:null, pj=cam?cam.projectionMatrix.elements:null;
  for(let i=0;i<n;i++) if(R.vis[i]){
    let score=0;
    if(mi){ const x=P[i*3], y=P[i*3+1], z=P[i*3+2], vz=mi[2]*x+mi[6]*y+mi[10]*z+mi[14];
      if(vz<-0.2){ const vx=mi[0]*x+mi[4]*y+mi[8]*z+mi[12], vy=mi[1]*x+mi[5]*y+mi[9]*z+mi[13], k=1/(-vz), nx=vx*pj[0]*k, ny=vy*pj[5]*k; score=(Math.abs(nx)<1.3&&Math.abs(ny)<1.6)?-vz:1e3-vz; }
      else score=1e4-vz; }
    else score=i;
    if(R.me[i]) score*=0.3;
    order.push(i,score); }
  /* sort the (index, score) pairs by score (n is at most 40) */
  const k=order.length/2, idx=[]; for(let j=0;j<k;j++) idx.push(j); idx.sort((a,b)=>order[a*2+1]-order[b*2+1]);
  const H=R.hiInst, L=R.loInst; let nh=0, nl=0;
  for(let q=0;q<k;q++){ const i=order[idx[q]*2], hi=q<R.nHi, I=hi?H:L, s=hi?nh++:nl++;
    I.A.array[s*4]=i; I.A.array[s*4+1]=R.team[i*3]; I.A.array[s*4+2]=R.team[i*3+1]; I.A.array[s*4+3]=R.team[i*3+2];
    I.B.array[s*4]=R.acc[i*3]; I.B.array[s*4+1]=R.acc[i*3+1]; I.B.array[s*4+2]=R.acc[i*3+2]; I.B.array[s*4+3]=R.wind[i];
    I.C.array[s*4]=R.mud[i]; I.C.array[s*4+1]=R.style[i]; I.C.array[s*4+2]=R.cell[i*2]; I.C.array[s*4+3]=R.cell[i*2+1]; }
  H.A.needsUpdate=H.B.needsUpdate=H.C.needsUpdate=true; L.A.needsUpdate=L.B.needsUpdate=L.C.needsUpdate=true;
  const S=R.S; S.hiBody.geometry.instanceCount=nh; S.hiHelmet.geometry.instanceCount=nh; S.hiBack.geometry.instanceCount=nh; S.loBody.geometry.instanceCount=nl;
  S.hiBody.visible=S.hiHelmet.visible=S.hiBack.visible=nh>0; S.loBody.visible=nl>0; R.stats.hi=nh; R.stats.lo=nl;
  R.boneTex.needsUpdate=true;
}
export function setRed(R,list){ /* the red plate moved: redraw the atlas */ const A=atlas(list,R.aScale||1); R.A.tex.image=A.canvas; R.A.tex.needsUpdate=true; }
