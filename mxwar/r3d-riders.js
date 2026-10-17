/* MOTOCROSS WAR 3D — THE RIDERS (owner: rider): the rider as an ORIGINAL low-poly model (no logos, no sponsor marks; team = colours,
   numbers as plain text): the helmet, the torso, the arms and legs (rounded limbs, one InstancedMesh per part type: every rider in one draw
   call per part), the number atlas (plates, jersey-back numbers, floating tags, drawn in code), the blob shadows and number tags, and the
   posing: two-bone IK (hands on the grips, feet on the pegs, an inside foot out in flat turns), seated in turns, standing in the whoops,
   the rhythm and the air; a crash pose from the crash script in race3d.js (poseBody). createRiders() is the instancing glue: it makes the
   bike's meshes (r3d-bike.js createBike) and the rider's, poseRider() poses the bike (poseBike) and then the rider. The roost / dust
   particles are r3d-fx.js (they used to be made here). Moved out of the old one-file r3d-riders.js byte for byte (the file split: no visual change).
   Bike local axes: +X forward, +Y up, +Z right (heading th: rotation.y = -th; roll + = lean right; pitch + = nose up; Euler order YZX).
   createRiders(list, {lo}) -> R {grp, M (every InstancedMesh by name), A (atlas), n, list}; poseRider(R, i, B, st) with B = the bike's world
   Matrix4 and st = the per-frame state (CONTRACT.md). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {merge,paint,xf,lin,canvas,bone} from "./r3d-util.js";
import {BIKE,createBike,colorBike,poseBike,hideBike,plateGeo,drawPlate} from "./r3d-bike.js";
export {BIKE} from "./r3d-bike.js";   /* (the old import path) */
export {emit,stepParticles} from "./r3d-fx.js";   /* (the old import path: the particles moved to r3d-fx.js; the first argument is now the particle system FX.part, no longer the rider set) */

/* ---------------- geometry of one rider (unit limbs along +Y) ----------------
   Polish: the rider in baggy gear (jersey and pants in the team colour, knee braces, white boots with a toe, dark gloves), a helmet with a
   big peak, a chin bar and goggles. Helmets are glossy (Phong), the gear is cloth (Lambert). Parts marked aFix keep their own colour
   instead of the team colour. */
function fixed(g,rgb){ const q=paint(g,rgb); q.setAttribute("aFix",new THREE.BufferAttribute(new Float32Array(q.attributes.position.count).fill(1),1)); return q; }
function tinted(g,rgb){ const q=paint(g,rgb||[1,1,1]); q.setAttribute("aFix",new THREE.BufferAttribute(new Float32Array(q.attributes.position.count),1)); return q; }
function mergeF(list){ const g=merge(list), F=new Float32Array(g.attributes.position.count); let n=0;
  list.forEach(q=>{ const c=q.attributes.position.count, a=q.attributes.aFix; if(a) F.set(a.array,n); n+=c; }); g.setAttribute("aFix",new THREE.BufferAttribute(F,1)); return g; }
function helmetGeo(){
  const W=[1,1,1], dk=lin("#0f1115"), L=[];
  const shell=new THREE.SphereGeometry(0.152,14,10), P=shell.attributes.position;
  for(let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i); P.setX(i,x*1.12+(x>0&&y<0?x*0.14:0)); if(y<-0.06) P.setY(i,y*0.92); } shell.computeVertexNormals();
  L.push(paint(shell,W));
  L.push(xf(paint(new THREE.BoxGeometry(0.13,0.01,0.2),W),0.185,0.1,0,0,0,0.26));        /* the peak, angled up */
  L.push(xf(paint(new THREE.BoxGeometry(0.11,0.095,0.13),W),0.17,-0.088,0,0,0,-0.45));    /* the chin bar, forward and down */
  L.push(xf(paint(new THREE.BoxGeometry(0.05,0.04,0.09),dk),0.222,-0.104,0,0,0,-0.45));   /* its vent */
  L.push(xf(paint(new THREE.BoxGeometry(0.045,0.07,0.2),dk),0.168,0.016,0));              /* the goggles' lens */
  L.push(xf(paint(new THREE.CylinderGeometry(0.163,0.163,0.032,16,1,true),lin("#ececf0")),0,0.016,0,0,0,0,1.12,1,1.0));   /* the strap */
  return merge(L);
}
function torsoGeo(){
  /* from the hip (y 0) to the shoulders (y 1): a baggy jersey over a chest protector. Polish: shaped ring by ring (narrow waist, the chest
     protector's bulge forward, broad shoulders that round over into the neck) instead of a squashed cylinder that read as a box; the waist
     band and the collar dark (fixed), the jersey in the team colour */
  const g=new THREE.CylinderGeometry(1,1,1,14,9,true); g.translate(0,0.5,0);
  const key=[[0,0.158,0.112,0],[0.14,0.162,0.108,0],[0.32,0.168,0.112,0.004],[0.55,0.198,0.13,0.018],[0.75,0.214,0.136,0.02],[0.88,0.21,0.124,0.012],[0.95,0.175,0.105,0.006],[1,0.11,0.075,0.004]];
  const at=y=>{ for(let k=1;k<key.length;k++) if(y<=key[k][0]+1e-6){ const a=key[k-1], b=key[k], t=(y-a[0])/(b[0]-a[0]), u=t*t*(3-2*t); return [a[1]+(b[1]-a[1])*u,a[2]+(b[2]-a[2])*u,a[3]+(b[3]-a[3])*u]; } return key[key.length-1].slice(1); };
  const P=g.attributes.position, c=new Float32Array(P.count*3), fix=new Float32Array(P.count);
  for(let i=0;i<P.count;i++){ const y=P.getY(i), x=P.getX(i), z=P.getZ(i), w=at(y);
    P.setX(i,x*w[1]+w[2]+(x>0?0.012*Math.sin(Math.PI*Math.min(1,Math.max(0,(y-0.4)/0.5))):0)); P.setZ(i,z*w[0]);
    const band=y<0.13, collar=y>0.965; if(band||collar){ c[i*3]=0.11; c[i*3+1]=0.11; c[i*3+2]=0.13; fix[i]=1; } else { c[i*3]=1; c[i*3+1]=1; c[i*3+2]=1; } }
  g.setAttribute("color",new THREE.BufferAttribute(c,3)); g.setAttribute("aFix",new THREE.BufferAttribute(fix,1)); g.computeVertexNormals();
  const n=fixed(new THREE.CylinderGeometry(0.055,0.062,0.14,8,1,true),[0.22,0.22,0.24]); n.translate(0.015,1.04,0);   /* the neck brace */
  /* the bottom and the top closed (never a hole seen from below or above) */
  const hb=fixed(new THREE.CircleGeometry(1,12),[0.1,0.1,0.12]); hb.rotateX(Math.PI/2); hb.scale(0.112,1,0.158); hb.translate(0,0.002,0);
  const ht=fixed(new THREE.CircleGeometry(1,12),[0.11,0.11,0.13]); ht.rotateX(-Math.PI/2); ht.scale(0.077,1,0.112); ht.translate(0.004,0.998,0);
  return mergeF([g.toNonIndexed(),n,hb,ht]);
}
/* a limb along +Y from the root (y 0, radius r0) to the end (y 1, radius r1), ROUNDED at both ends (polish: the old open cylinders met at
   the shoulders, elbows and knees with hard creases; a lathe with a ball at each end makes a joint that reads as one body). The bone
   matrix stretches the unit length to the limb's real length L, so the balls are built pre-squashed by 1/L (L never changes: IK keeps the
   bone lengths). The end fraction ef keeps its own colour (a glove) */
function limbGeo(r0,r1,L,endCol,ef){
  const pts=[], K=2;
  for(let k=0;k<=K;k++){ const a=-Math.PI/2+k/K*Math.PI/2; pts.push(new THREE.Vector2(Math.max(0.0005,r0*Math.cos(a)),r0*Math.sin(a))); }
  pts.push(new THREE.Vector2(r0+(r1-r0)*0.5,L*0.5));
  for(let k=0;k<=K;k++){ const a=k/K*Math.PI/2; pts.push(new THREE.Vector2(Math.max(0.0005,r1*Math.cos(a)),L+r1*Math.sin(a))); }
  const g=new THREE.LatheGeometry(pts,8); g.scale(1,1/L,1);
  const P=g.attributes.position, c=new Float32Array(P.count*3), fix=new Float32Array(P.count);
  for(let i=0;i<P.count;i++){ const y=P.getY(i), end=ef&&y>1-ef; if(end){ c[i*3]=endCol[0]; c[i*3+1]=endCol[1]; c[i*3+2]=endCol[2]; fix[i]=1; P.setX(i,P.getX(i)*1.14); P.setZ(i,P.getZ(i)*1.14); } else { c[i*3]=1; c[i*3+1]=1; c[i*3+2]=1; } }
  g.setAttribute("color",new THREE.BufferAttribute(c,3)); g.setAttribute("aFix",new THREE.BufferAttribute(fix,1)); g.computeVertexNormals(); return g;
}
function shinGeo(){
  /* from the knee (y 0) to the foot (y 1, L = 0.45 m): a rounded knee in the dark knee brace, the pants, the tall white boot with a toe
     forward (local +X is the rider's front) and a dark sole */
  const L=0.45, R=y=>y<=0.2?0.074:y<0.42?0.06:0.066+0.009*(y-0.42)/0.58, pts=[], K=2;
  for(let k=0;k<=K;k++){ const a=-Math.PI/2+k/K*Math.PI/2; pts.push(new THREE.Vector2(Math.max(0.0005,0.074*Math.cos(a)),0.074*Math.sin(a))); }
  [0.2,0.24,0.42,0.46,0.86,0.96].forEach(y=>pts.push(new THREE.Vector2(R(y),y*L)));
  pts.push(new THREE.Vector2(0.074,L)); pts.push(new THREE.Vector2(0.0005,L+0.014));
  const g=new THREE.LatheGeometry(pts,8); g.scale(1,1/L,1);
  const P=g.attributes.position, c=new Float32Array(P.count*3), fix=new Float32Array(P.count);
  for(let i=0;i<P.count;i++){ const y=P.getY(i); let x=P.getX(i);
    let col=[1,1,1], f=0;
    if(y<=0.2){ col=[0.12,0.12,0.14]; f=1; } else if(y>=0.42){ col=y>=0.985?[0.16,0.16,0.18]:[0.9,0.9,0.93]; f=1; if(y>=0.84&&x>0) x+=0.085*sstepR(0.84,1.0,y); }
    P.setX(i,x); c[i*3]=col[0]; c[i*3+1]=col[1]; c[i*3+2]=col[2]; fix[i]=f; }
  g.setAttribute("color",new THREE.BufferAttribute(c,3)); g.setAttribute("aFix",new THREE.BufferAttribute(fix,1)); g.computeVertexNormals(); return g;
}
function sstepR(a,b,x){ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); }
/* a Lambert material where vertices marked aFix keep their own colour (not tinted by the team colour): boots, braces, gloves, the collar */
function fixMat(){
  const m=new THREE.MeshLambertMaterial({vertexColors:true});
  m.onBeforeCompile=sh=>{ sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aFix;").replace("#include <color_vertex>","#include <color_vertex>\n#ifdef USE_COLOR\n vColor.rgb=mix(vColor.rgb,color.rgb,aFix);\n#endif"); };
  m.customProgramCacheKey=()=>"mx-fix";
  return m;
}

/* ---------------- the number atlas: plates (white / red) and the jersey-back numbers, drawn in code ---------------- */
/* ---------------- the number atlas: plates (white / red) and the jersey-back numbers, drawn in code ---------------- */
function atlas(riders){
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
    fit(t,cell-14,88); x.lineWidth=9; x.strokeStyle="rgba(10,10,14,.9)"; x.strokeText(t,dx+cell/2,dy+cell/2+4); x.fillStyle=R.red?"#ff5a5a":"#ffffff"; x.fillText(t,dx+cell/2,dy+cell/2+4);
    /* the floating tag: the plate on a dark pill (gold ring for a person, red for the leader) */
    const g=k++, gx=(g%cols)*cell, gy=Math.floor(g/cols)*cell;
    x.fillStyle="rgba(10,10,16,.82)"; rr(gx+2,gy+24,cell-4,cell-48,22); x.fill();
    x.lineWidth=6; x.strokeStyle=R.me?"#f0c040":R.red?"#ff3b3b":"rgba(255,255,255,.35)"; rr(gx+5,gy+27,cell-10,cell-54,19); x.stroke();
    x.fillStyle=R.me?"#ffd76a":R.red?"#ff6b6b":"#ffffff"; fit(t,cell-26,64); x.fillText(t,gx+cell/2,gy+cell/2+3);
    cells[R.s]={plate:p,decal:d,tag:g};
  });
  const T=new THREE.CanvasTexture(c); T.colorSpace=THREE.SRGBColorSpace; T.anisotropy=4; T.generateMipmaps=true; T.minFilter=THREE.LinearMipmapLinearFilter;
  return {tex:T,cells:cells,cols:cols,rows:Math.max(1,rows),canvas:c};
}
/* a Lambert material whose map is one atlas cell per instance (attribute aCell = column, row) */
function atlasMat(T,cols,rows,opts){
  const m=new THREE.MeshLambertMaterial(Object.assign({map:T},opts||{}));
  m.onBeforeCompile=function(sh){
    sh.uniforms.uGrid={value:new THREE.Vector2(1/cols,1/rows)};
    sh.vertexShader="attribute vec2 aCell;\nuniform vec2 uGrid;\n"+sh.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\n#ifdef USE_MAP\n vMapUv=vec2((aCell.x+uv.x)*uGrid.x,1.0-(aCell.y+1.0-uv.y)*uGrid.y);\n#endif");
  };
  m.customProgramCacheKey=()=>"atlas"+cols+"x"+rows;
  return m;
}

/* ---------------- the rider set ---------------- */
export function createRiders(list,opts){
  opts=opts||{};
  const n=list.length, lo=!!opts.lo, grp=new THREE.Group();
  const mk=(geo,count,mat)=>{ const m=new THREE.InstancedMesh(geo,mat,count); m.frustumCulled=false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(m); return m; };
  const A=atlas(list);
  const M=createBike(n,lo,mk);   /* wheel, chassis, plastic, trim, fork, swing (r3d-bike.js: it makes the bike's materials first) */
  /* glossy helmets, cloth gear (polish); then the rider's meshes */
  const shell=new THREE.MeshPhongMaterial({vertexColors:true,shininess:lo?40:110,specular:0x8c8c8c});
  const cloth=fixMat();
  Object.assign(M,{
    helmet:mk(helmetGeo(),n,shell), torso:mk(torsoGeo(),n,cloth), uarm:mk(limbGeo(0.056,0.048,0.29),n*2,cloth), farm:mk(limbGeo(0.048,0.042,0.29,lin("#24252b"),0.2),n*2,cloth),
    thigh:mk(limbGeo(0.088,0.07,0.43),n*2,cloth), shin:mk(shinGeo(),n*2,cloth)
  });
  ["helmet","torso","uarm","farm","thigh","shin"].forEach(k=>{ M[k].castShadow=true; });   /* the rider's parts cast the sun's shadow too */
  /* plates (3 a bike) and the jersey back (1) use the atlas */
  const pg=plateGeo(), cellA=new Float32Array(n*3*2), cellB=new Float32Array(n*2);
  list.forEach((R,i)=>{ const c=A.cells[R.s]; for(let k=0;k<3;k++){ cellA[(i*3+k)*2]=c.plate%A.cols; cellA[(i*3+k)*2+1]=Math.floor(c.plate/A.cols); } cellB[i*2]=c.decal%A.cols; cellB[i*2+1]=Math.floor(c.decal/A.cols); });
  const pgA=pg.clone(); pgA.setAttribute("aCell",new THREE.InstancedBufferAttribute(cellA,2));
  const pgB=pg.clone(); pgB.setAttribute("aCell",new THREE.InstancedBufferAttribute(cellB,2));
  M.plate=mk(pgA,n*3,atlasMat(A.tex,A.cols,A.rows,{side:THREE.DoubleSide}));
  M.back=mk(pgB,n,atlasMat(A.tex,A.cols,A.rows,{transparent:true,alphaTest:0.4,depthWrite:false}));
  /* team colours */
  const col=new THREE.Color();
  list.forEach((R,i)=>{
    colorBike(M,i,R);   /* the bike's plastics and trim: r3d-bike.js */
    col.set(R.color||"#888"); M.helmet.setColorAt(i,col); M.torso.setColorAt(i,col); M.uarm.setColorAt(i*2,col); M.uarm.setColorAt(i*2+1,col); M.farm.setColorAt(i*2,col); M.farm.setColorAt(i*2+1,col);
    const pc=col.clone().multiplyScalar(0.62); M.thigh.setColorAt(i*2,pc); M.thigh.setColorAt(i*2+1,pc); M.shin.setColorAt(i*2,pc); M.shin.setColorAt(i*2+1,pc);
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
  const R={grp,M,A,n,list,hidden:new Uint8Array(n)};
  /* scratch */
  R._m=new THREE.Matrix4(); R._q=new THREE.Quaternion(); R._e=new THREE.Euler(0,0,0,"YZX"); R._v=new THREE.Vector3(); R._s=new THREE.Vector3(1,1,1);
  return R;
}

/* ---------------- posing ---------------- */
const _a=new THREE.Vector3(), _c=new THREE.Vector3(), _d=new THREE.Vector3(), _e=new THREE.Vector3(), _f=new THREE.Vector3();
const _m1=new THREE.Matrix4(), _m2=new THREE.Matrix4(), _sc=new THREE.Vector3(), _ka=new THREE.Vector3(), _kb=new THREE.Vector3(), _kc=new THREE.Vector3();
/* two-bone IK: root a, target t, lengths l1 l2, pole direction p (world) -> the middle joint into out */
function ik(a,t,l1,l2,p,out){
  _ka.subVectors(t,a); let d=_ka.length(); const dmax=l1+l2-0.002, dmin=Math.abs(l1-l2)+0.002;
  if(d>dmax){ _ka.multiplyScalar(dmax/d); d=dmax; } if(d<dmin){ _ka.multiplyScalar(dmin/Math.max(1e-4,d)); d=dmin; }
  const e=_kb.copy(_ka).multiplyScalar(1/d), x=(l1*l1-l2*l2+d*d)/(2*d), h=Math.sqrt(Math.max(0,l1*l1-x*x));
  const nrm=_kc.copy(p).addScaledVector(e,-p.dot(e)); if(nrm.lengthSq()<1e-6) nrm.set(0,1,0); nrm.normalize();
  out.copy(a).addScaledVector(e,x).addScaledVector(nrm,h);
  return d;
}
/* the rider's joints in bike-local space for a stance (stand 0..1, dab -1..1 the inside foot out, lean for the counter-lean) */
const J={hip:new THREE.Vector3(),sh:new THREE.Vector3(),head:new THREE.Vector3(),gL:new THREE.Vector3(),gR:new THREE.Vector3(),fL:new THREE.Vector3(),fR:new THREE.Vector3()};
function localJoints(stand,dab,lean,crouch){
  J.hip.set(-0.21+0.09*stand,0.99+0.22*stand-0.06*crouch,0);
  const pitch=0.48+0.3*stand+0.15*crouch, tl=0.52;
  J.sh.set(J.hip.x+Math.sin(pitch)*tl,J.hip.y+Math.cos(pitch)*tl,0);
  /* the counter-lean: the body stays more upright than the bike in a turn (rotate about the bike's X through the hip) */
  const cl=-lean*0.3, cy=J.sh.y-J.hip.y; J.sh.z=Math.sin(cl)*cy; J.sh.y=J.hip.y+Math.cos(cl)*cy;
  J.head.set(J.sh.x+0.07,J.sh.y+0.17,J.sh.z*1.1);
  J.gL.set(BIKE.GRIP.x,BIKE.GRIP.y,-BIKE.GRIP.z); J.gR.set(BIKE.GRIP.x,BIKE.GRIP.y,BIKE.GRIP.z);
  J.fL.set(BIKE.PEG.x,BIKE.PEG.y,-BIKE.PEG.z); J.fR.set(BIKE.PEG.x,BIKE.PEG.y,BIKE.PEG.z);
  if(dab>0.01){ J.fR.lerp(_a.set(0.5,0.26,0.44),dab); }          /* the inside foot out (a right turn: the right foot) */
  else if(dab<-0.01){ J.fL.lerp(_a.set(0.5,0.26,-0.44),-dab); }
  return J;
}
const W={hip:new THREE.Vector3(),sh:new THREE.Vector3(),shL:new THREE.Vector3(),shR:new THREE.Vector3(),head:new THREE.Vector3(),gL:new THREE.Vector3(),gR:new THREE.Vector3(),fL:new THREE.Vector3(),fR:new THREE.Vector3(),hipL:new THREE.Vector3(),hipR:new THREE.Vector3(),el:new THREE.Vector3(),kn:new THREE.Vector3(),pole:new THREE.Vector3(),fw:new THREE.Vector3(),rt:new THREE.Vector3(),upv:new THREE.Vector3()};
/* place one rider: B = the bike's world matrix (a Matrix4), st = {stand, dab, lean, crouch, spinF, spinR, compF, compR, hide, body, limbs}
   (a crash: body = the rider's body matrix, limbs = {spread, walk, phase, stand, reach}) */
export function poseRider(R,i,B,st){
  const M=R.M;
  if(st.hide){ hideRider(R,i); return; }
  poseBike(M,i,B,st);   /* the bike: wheels, suspension, fork, swingarm, plates (r3d-bike.js) */
  /* ---- the rider ---- */
  if(st.body){ poseBody(R,i,st.body,st.limbs); return; }
  const j=localJoints(st.stand||0,st.dab||0,st.lean||0,st.crouch||0);
  W.hip.copy(j.hip).applyMatrix4(B); W.sh.copy(j.sh).applyMatrix4(B); W.head.copy(j.head).applyMatrix4(B);
  W.gL.copy(j.gL).applyMatrix4(B); W.gR.copy(j.gR).applyMatrix4(B); W.fL.copy(j.fL).applyMatrix4(B); W.fR.copy(j.fR).applyMatrix4(B);
  W.fw.set(1,0,0).transformDirection(B); W.rt.set(0,0,1).transformDirection(B); W.upv.set(0,1,0).transformDirection(B);
  limbs(R,i,W.fw,W.rt,W.upv,st);
}
/* torso, helmet, arms, legs from the world joints in W */
function limbs(R,i,fw,rt,upv,st){
  const M=R.M;
  /* torso: a basis with +Y from hip to shoulders, +Z the bike's right */
  _d.subVectors(W.sh,W.hip); const tl=_d.length(); _d.normalize();
  _e.copy(rt).addScaledVector(_d,-rt.dot(_d)).normalize(); _f.crossVectors(_d,_e);   /* X = Y x Z */
  _m1.makeBasis(_f,_d,_e); _m1.scale(_sc.set(1,tl,1)); _m1.setPosition(W.hip); M.torso.setMatrixAt(i,_m1);
  /* the jersey-back number: on the upper back, facing back */
  /* the plane's +Z (its face) points back, its +X to the rider's right: read from behind */
  _c.copy(_f).negate(); _m2.makeBasis(_e,_d,_c); const back=_a.copy(W.hip).addScaledVector(_d,tl*0.62).addScaledVector(_f,-0.125);
  _m2.scale(_sc.set(0.26,0.22,1)); _m2.setPosition(back); M.back.setMatrixAt(i,_m2);
  /* helmet: at the head, facing forward (pitched with the torso a little) */
  _m1.makeBasis(_f,_d,_e); _m1.setPosition(W.head); M.helmet.setMatrixAt(i,_m1);
  /* shoulders, hips */
  W.shL.copy(W.sh).addScaledVector(_e,-0.19); W.shR.copy(W.sh).addScaledVector(_e,0.19);
  W.hipL.copy(W.hip).addScaledVector(_e,-0.11); W.hipR.copy(W.hip).addScaledVector(_e,0.11);
  /* arms: elbows up and out (MX style) */
  [["shL","gL",-1,0],["shR","gR",1,1]].forEach(a=>{ const s=W[a[0]], t=W[a[1]], sd=a[2];
    W.pole.copy(rt).multiplyScalar(sd*1.0).addScaledVector(upv,0.55).addScaledVector(fw,-0.35);
    ik(s,t,0.29,0.29,W.pole,W.el); bone(M.uarm,i*2+a[3],s,W.el,1,fw); bone(M.farm,i*2+a[3],W.el,t,1,fw); });
  /* legs: knees forward, gripping the bike */
  [["hipL","fL",-1,0],["hipR","fR",1,1]].forEach(a=>{ const h=W[a[0]], t=W[a[1]], sd=a[2];
    W.pole.copy(fw).addScaledVector(rt,sd*0.25).addScaledVector(upv,0.15);
    ik(h,t,0.43,0.45,W.pole,W.kn); bone(M.thigh,i*2+a[3],h,W.kn,1,fw); bone(M.shin,i*2+a[3],W.kn,t,1,fw); });
}
/* a crash: the rider's body frame (world Matrix4: origin the hip, +Y up the spine, +X the chest's front, +Z right) and limb spread 0..1 */
function poseBody(R,i,body,lim){
  const L=lim||{};
  _f.set(1,0,0).transformDirection(body); _d.set(0,1,0).transformDirection(body); _e.set(0,0,1).transformDirection(body);
  W.hip.setFromMatrixPosition(body); W.sh.copy(W.hip).addScaledVector(_d,0.52); W.head.copy(W.sh).addScaledVector(_d,0.17).addScaledVector(_f,0.05);
  const spread=L.spread||0, walk=L.walk||0, ph=L.phase||0, stand=L.stand||0;
  /* hands and feet relative to the body: spread out when tumbling, at the sides and swinging when walking, reaching when lifting the bike */
  W.gL.copy(W.sh).addScaledVector(_e,-0.25-0.35*spread).addScaledVector(_d,-0.45+0.5*spread).addScaledVector(_f,0.12+0.1*Math.sin(ph)*walk+(L.reach||0)*0.45);
  W.gR.copy(W.sh).addScaledVector(_e,0.25+0.35*spread).addScaledVector(_d,-0.45+0.5*spread).addScaledVector(_f,0.12-0.1*Math.sin(ph)*walk+(L.reach||0)*0.45);
  W.fL.copy(W.hip).addScaledVector(_e,-0.14-0.3*spread).addScaledVector(_d,-0.86+0.1*spread*(1-stand)).addScaledVector(_f,0.25*Math.sin(ph)*walk+0.1*spread);
  W.fR.copy(W.hip).addScaledVector(_e,0.14+0.3*spread).addScaledVector(_d,-0.86+0.1*spread*(1-stand)).addScaledVector(_f,-0.25*Math.sin(ph)*walk-0.05*spread);
  limbs(R,i,_f.clone(),_e.clone(),_d.clone(),{});
}
export function hideRider(R,i){
  const M=R.M, z=_m1.makeScale(0,0,0);
  hideBike(M,i);
  ["helmet","torso","back"].forEach(k=>M[k].setMatrixAt(i,z));
  ["uarm","farm","thigh","shin"].forEach(k=>{ M[k].setMatrixAt(i*2,z); M[k].setMatrixAt(i*2+1,z); });
  M.shadow.setMatrixAt(i*2,z); M.shadow.setMatrixAt(i*2+1,z); M.tag.setMatrixAt(i,z);
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
export function commit(R){
  const M=R.M; Object.keys(M).forEach(k=>{ if(M[k].instanceMatrix) M[k].instanceMatrix.needsUpdate=true; });
  if(M.shadow.instanceColor) M.shadow.instanceColor.needsUpdate=true;
}
export function setRed(R,list){ /* the red plate moved: redraw the atlas */ const A=atlas(list); R.A.tex.image=A.canvas; R.A.tex.needsUpdate=true; }
