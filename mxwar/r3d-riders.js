/* MOTOCROSS WAR 3D — the RIDERS: bikes and riders as low-poly ORIGINAL models (no logos, no sponsor marks; team = colours, numbers as
   plain text). Every part type is ONE InstancedMesh (all riders in one draw call): wheels, chassis, plastics (team colour), trim (accent),
   fork, swingarm, plates (a number atlas drawn in code: white plates, the points leader's RED plate), helmet, torso, upper arms, forearms,
   thighs, shins, the jersey-back number; plus blob shadows, floating number tags and the roost (dirt spray) particles.
   Bike local axes: +X forward, +Y up, +Z right (heading th: rotation.y = -th; roll + = lean right; pitch + = nose up; Euler order YZX).
   createRiders(THREE, n, opts) -> R with R.set(i, look), R.pose(i, state), R.commit(), R.dispose(). The arms and legs are solved with
   two-bone IK (hands on the grips, feet on the pegs, an inside foot out in flat turns), seated in turns, standing in the whoops, the
   rhythm and the air; a crash pose comes from the crash script in race3d.js. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
import {merge,paint,xf,lin,canvas} from "./r3d-world.js";
const THREE=THREE_NS;

const WB=1.48, WR=0.34;   /* wheelbase, wheel radius (m) */
export const BIKE={WB:WB,WR:WR,FA:new THREE.Vector3(0.74,WR,0),RA:new THREE.Vector3(-0.74,WR,0),HEAD:new THREE.Vector3(0.43,1.04,0),PIVOT:new THREE.Vector3(-0.08,0.46,0),
  GRIP:new THREE.Vector3(0.40,1.12,0.37),PEG:new THREE.Vector3(-0.07,0.43,0.21),TRAVEL:0.30,SAG:0.10};

/* ---------------- geometry of one bike and one rider (unit limbs along +Y) ---------------- */
function wheelGeo(){
  const tire=paint(new THREE.TorusGeometry(0.275,0.068,6,16),lin("#141416"));
  const rim=paint(new THREE.TorusGeometry(0.215,0.016,4,16),lin("#b8bcc4"));
  const hub=paint(new THREE.CylinderGeometry(0.045,0.045,0.16,8),lin("#8a8d96")); hub.rotateX(Math.PI/2);
  const sp=[]; for(let i=0;i<4;i++){ const b=paint(new THREE.BoxGeometry(0.012,0.43,0.012),lin("#9da0a8")); b.rotateZ(i*Math.PI/4); sp.push(b); }
  return merge([tire,rim,hub].concat(sp));
}
function chassisGeo(){
  const dk=lin("#2a2b30"), mt=lin("#8f939c"), bl=lin("#121214"), ex=lin("#b9b2a6");
  const L=[];
  const tube=(a,b,r,c)=>{ const d=new THREE.Vector3().subVectors(b,a), len=d.length(), g=paint(new THREE.CylinderGeometry(r,r,len,6),c); g.translate(0,len/2,0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())); g.translate(a.x,a.y,a.z); return g; };
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  /* frame rails (both sides) */
  [-0.07,0.07].forEach(z=>{ L.push(tube(V(0.40,1.0,z*0.6),V(0.12,0.82,z),0.026,mt)); L.push(tube(V(0.12,0.82,z),V(-0.08,0.42,z),0.026,mt)); L.push(tube(V(0.12,0.82,z),V(-0.62,0.9,z*1.4),0.02,mt)); L.push(tube(V(0.36,0.98,z*0.6),V(0.22,0.36,z*0.8),0.022,mt)); });
  /* the engine, the cylinder, the airbox */
  L.push(xf(paint(new THREE.BoxGeometry(0.40,0.34,0.26),dk),0.06,0.52,0));
  L.push(xf(paint(new THREE.BoxGeometry(0.18,0.22,0.2),lin("#3a3b42")),0.2,0.76,0,0,0,-0.35));
  L.push(xf(paint(new THREE.BoxGeometry(0.34,0.2,0.22),bl),-0.32,0.82,0));
  /* the exhaust: header from the cylinder, round the right side, the muffler up by the rear fender */
  L.push(tube(V(0.27,0.74,0.08),V(0.3,0.5,0.15),0.03,ex)); L.push(tube(V(0.3,0.5,0.15),V(-0.15,0.66,0.17),0.03,ex));
  L.push(tube(V(-0.15,0.66,0.17),V(-0.86,0.9,0.18),0.055,lin("#9a9ca2"))); L.push(tube(V(-0.86,0.9,0.18),V(-0.92,0.92,0.18),0.035,lin("#2c2c30")));
  /* the seat */
  L.push(xf(paint(new THREE.BoxGeometry(0.72,0.07,0.21),bl),-0.28,0.97,0,0,0,-0.05));
  /* the handlebar, the triple clamp, the grips, the levers */
  L.push(xf(paint(new THREE.CylinderGeometry(0.014,0.014,0.8,6),bl),0.40,1.12,0,Math.PI/2,0,0));
  L.push(xf(paint(new THREE.BoxGeometry(0.12,0.05,0.26),mt),0.43,1.05,0));
  [-0.37,0.37].forEach(z=>{ L.push(xf(paint(new THREE.CylinderGeometry(0.02,0.02,0.12,6),lin("#202024")),0.40,1.12,z,Math.PI/2,0,0)); });
  /* footpegs, the rear shock spring (a hint) */
  [-0.21,0.21].forEach(z=>L.push(xf(paint(new THREE.BoxGeometry(0.1,0.025,0.09),mt),-0.07,0.42,z)));
  L.push(tube(V(-0.05,0.55,0),V(-0.18,0.9,0),0.04,lin("#c9a43a")));
  return merge(L);
}
function plasticsGeo(){
  const W=[1,1,1], S=[0.82,0.82,0.82], L=[];
  /* front fender: a thin curved blade over the front wheel */
  for(let i=0;i<5;i++){ const a=-0.25+i*0.16; L.push(xf(paint(new THREE.BoxGeometry(0.13,0.018,0.13),W),0.74+Math.cos(a+1.25)*0.42,0.36+Math.sin(a+1.25)*0.42,0,0,0,a-0.3)); }
  /* the tank and the radiator shrouds: the widest part of the bike */
  const tank=new THREE.BoxGeometry(0.40,0.16,0.26,2,1,2); const P=tank.attributes.position; for(let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i); P.setZ(i,P.getZ(i)*(1+(x>0?0.25:0)+(y>0?-0.15:0.1))); } tank.computeVertexNormals();
  L.push(xf(paint(tank,W),0.22,0.98,0,0,0,-0.12));
  [-1,1].forEach(sd=>{ const sh=paint(new THREE.BoxGeometry(0.30,0.24,0.03),W); L.push(xf(sh,0.30,0.86,sd*0.17,sd*0.12,0,-0.22)); });
  /* side panels under the seat (the side plates sit on them) */
  [-1,1].forEach(sd=>L.push(xf(paint(new THREE.BoxGeometry(0.42,0.26,0.025),S),-0.42,0.78,sd*0.14,0,0,-0.08)));
  /* the rear fender */
  L.push(xf(paint(new THREE.BoxGeometry(0.5,0.022,0.2),W),-0.86,1.0,0,0,0,0.13));
  /* the front plate backing */
  L.push(xf(paint(new THREE.BoxGeometry(0.03,0.27,0.3),W),0.50,1.0,0,0,0,-0.28));
  return merge(L);
}
function trimGeo(){
  const W=[1,1,1], L=[];
  [-1,1].forEach(sd=>{ L.push(xf(paint(new THREE.BoxGeometry(0.26,0.035,0.012),W),0.30,0.9,sd*0.19,sd*0.12,0,-0.22)); L.push(xf(paint(new THREE.BoxGeometry(0.4,0.03,0.012),W),-0.42,0.64,sd*0.157,0,0,-0.08)); });
  /* fork guards */
  [-1,1].forEach(sd=>L.push(xf(paint(new THREE.BoxGeometry(0.05,0.26,0.04),W),0.7,0.52,sd*0.1,0,0,-0.4)));
  L.push(xf(paint(new THREE.BoxGeometry(0.44,0.012,0.22),W),-0.3,1.012,0,0,0,-0.05));   /* seat cover stripe */
  return merge(L);
}
function forkGeo(){
  /* unit length along +Y: lower legs (dark, the bottom 45%) and the gold upper tubes */
  const L=[]; [-0.095,0.095].forEach(z=>{ L.push(xf(paint(new THREE.CylinderGeometry(0.03,0.03,0.46,6),lin("#2a2b30")),0,0.23,z)); L.push(xf(paint(new THREE.CylinderGeometry(0.024,0.024,0.56,6),lin("#d4b04a")),0,0.72,z)); });
  return merge(L);
}
function swingGeo(){
  const L=[]; [-0.08,0.08].forEach(z=>L.push(xf(paint(new THREE.BoxGeometry(1,0.07,0.035),lin("#9da1aa")),-0.5,0,z))); L.push(xf(paint(new THREE.BoxGeometry(0.08,0.06,0.18),lin("#9da1aa")),-0.04,0,0));
  return merge(L);
}
function plateGeo(){ const g=new THREE.PlaneGeometry(1,1); return g; }
function helmetGeo(){
  const W=[1,1,1], dk=lin("#14161b"), L=[];
  const shell=new THREE.SphereGeometry(0.155,10,8); const P=shell.attributes.position; for(let i=0;i<P.count;i++){ P.setX(i,P.getX(i)*1.12); } shell.computeVertexNormals();
  L.push(xf(paint(shell,W),0.0,0.0,0));
  L.push(xf(paint(new THREE.BoxGeometry(0.16,0.02,0.2),W),0.17,0.09,0,0,0,0.25));    /* the peak (visor) */
  L.push(xf(paint(new THREE.BoxGeometry(0.1,0.09,0.15),W),0.14,-0.1,0,0,0,-0.3));    /* the chin bar */
  L.push(xf(paint(new THREE.BoxGeometry(0.05,0.07,0.22),dk),0.155,0.01,0));          /* the goggles */
  L.push(xf(paint(new THREE.BoxGeometry(0.03,0.03,0.33),lin("#e8e8ea")),0.03,0.01,0)); /* the strap */
  return merge(L);
}
function torsoGeo(){
  /* from the hip (y 0) to the shoulders (y 1): a jersey over a chest protector, wider than deep, the shoulders broad, the waist band darker */
  const g=new THREE.CylinderGeometry(0.205,0.15,1,10,5); g.translate(0,0.5,0);
  const P=g.attributes.position, c=new Float32Array(P.count*3);
  for(let i=0;i<P.count;i++){ const y=P.getY(i), x=P.getX(i), z=P.getZ(i);
    const chest=y>0.45?1+0.12*Math.sin((y-0.45)/0.55*Math.PI):1;
    P.setX(i,x*0.62*chest+(x>0?0.02*y:0)); P.setZ(i,z*(1.0+0.12*y));
    const k=y<0.16?0.42:1; c[i*3]=k; c[i*3+1]=k; c[i*3+2]=k; }
  g.setAttribute("color",new THREE.BufferAttribute(c,3)); g.computeVertexNormals();
  /* the neck */
  const n=paint(new THREE.CylinderGeometry(0.055,0.06,0.12,6),[0.25,0.25,0.27]); n.translate(0.02,1.04,0);
  return merge([g,n]);
}
function limbGeo(r0,r1,endCol,endFrac){
  const g=new THREE.CylinderGeometry(r1,r0,1,6,3); g.translate(0,0.5,0);
  const P=g.attributes.position, c=new Float32Array(P.count*3), e=endCol||[1,1,1];
  for(let i=0;i<P.count;i++){ const y=P.getY(i), end=endFrac&&y>1-endFrac; c[i*3]=end?e[0]:1; c[i*3+1]=end?e[1]:1; c[i*3+2]=end?e[2]:1; }
  g.setAttribute("color",new THREE.BufferAttribute(c,3)); g.computeVertexNormals(); return g;
}
function shinGeo(){
  const g=limbGeo(0.055,0.048); const P=g.attributes.position, c=g.attributes.color;
  /* the boot: the lower 55% is white-grey with a toe */
  for(let i=0;i<P.count;i++){ const y=P.getY(i); if(y>0.45){ c.setXYZ(i,0.92,0.92,0.95); if(y>0.9) P.setX(i,P.getX(i)+0.06); } }
  return g;
}

/* ---------------- the number atlas: plates (white / red) and the jersey-back numbers, drawn in code ---------------- */
function atlas(riders){
  const cols=16, cell=128, rows=Math.ceil((riders.length*3+2)/cols), c=canvas(cols*cell,Math.max(1,rows)*cell), x=c.getContext("2d");
  const cells={};
  let k=0;
  function rr(px,py,w,h,r){ x.beginPath(); x.moveTo(px+r,py); x.lineTo(px+w-r,py); x.quadraticCurveTo(px+w,py,px+w,py+r); x.lineTo(px+w,py+h-r); x.quadraticCurveTo(px+w,py+h,px+w-r,py+h); x.lineTo(px+r,py+h); x.quadraticCurveTo(px,py+h,px,py+h-r); x.lineTo(px,py+r); x.quadraticCurveTo(px,py,px+r,py); x.closePath(); }
  function fit(t,max,base){ let fs=base; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; while(x.measureText(t).width>max&&fs>30){ fs-=4; x.font="800 "+fs+"px Manrope, system-ui, sans-serif"; } return fs; }
  riders.forEach(R=>{
    const t=String(R.num==null?"":R.num);
    /* the plate: white (or red for the points leader) with the team colour down its top, a black (white on red) number */
    const p=k++, px=(p%cols)*cell, py=Math.floor(p/cols)*cell;
    x.fillStyle=R.red?"#c8101c":"#f4f1e8"; rr(px+4,py+10,cell-8,cell-20,14); x.fill();
    x.fillStyle=R.color||"#444"; x.fillRect(px+4,py+10,cell-8,13);
    x.lineWidth=4; x.strokeStyle=R.me?"#f0c040":"rgba(0,0,0,.55)"; rr(px+4,py+10,cell-8,cell-20,14); x.stroke();
    x.fillStyle=R.red?"#ffffff":"#121216"; x.textAlign="center"; x.textBaseline="middle"; fit(t,cell-22,84); x.fillText(t,px+cell/2,py+cell/2+8);
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
  const lam=new THREE.MeshLambertMaterial({vertexColors:true});
  const mk=(geo,count,mat)=>{ const m=new THREE.InstancedMesh(geo,mat||lam,count); m.frustumCulled=false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(m); return m; };
  const A=atlas(list);
  const M={
    wheel:mk(wheelGeo(),n*2), chassis:mk(chassisGeo(),n), plastic:mk(plasticsGeo(),n), trim:mk(trimGeo(),n), fork:mk(forkGeo(),n), swing:mk(swingGeo(),n),
    helmet:mk(helmetGeo(),n), torso:mk(torsoGeo(),n), uarm:mk(limbGeo(0.05,0.045),n*2), farm:mk(limbGeo(0.045,0.04,lin("#1a1a1e"),0.22),n*2),
    thigh:mk(limbGeo(0.075,0.06),n*2), shin:mk(shinGeo(),n*2)
  };
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
    col.set(R.color||"#888"); M.plastic.setColorAt(i,col); M.helmet.setColorAt(i,col); M.torso.setColorAt(i,col); M.uarm.setColorAt(i*2,col); M.uarm.setColorAt(i*2+1,col); M.farm.setColorAt(i*2,col); M.farm.setColorAt(i*2+1,col);
    const pc=col.clone().multiplyScalar(0.5); M.thigh.setColorAt(i*2,pc); M.thigh.setColorAt(i*2+1,pc); M.shin.setColorAt(i*2,pc); M.shin.setColorAt(i*2+1,pc);
    col.set(R.accent||"#f2f2f6"); M.trim.setColorAt(i,col);
  });
  Object.values(M).forEach(m=>{ if(m.instanceColor) m.instanceColor.needsUpdate=true; });
  /* blob shadows: one quad under each bike and one under each rider (for crashes); a soft dark ellipse */
  const sc=canvas(64,64), sx=sc.getContext("2d"), sg=sx.createRadialGradient(32,32,2,32,32,32); sg.addColorStop(0,"rgba(0,0,0,.62)"); sg.addColorStop(0.6,"rgba(0,0,0,.32)"); sg.addColorStop(1,"rgba(0,0,0,0)"); sx.fillStyle=sg; sx.fillRect(0,0,64,64);
  const st=new THREE.CanvasTexture(sc);
  const shGeo=new THREE.PlaneGeometry(1,1); shGeo.rotateX(-Math.PI/2);
  const shMat=new THREE.MeshBasicMaterial({map:st,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
  M.shadow=new THREE.InstancedMesh(shGeo,shMat,n*2); M.shadow.frustumCulled=false; M.shadow.renderOrder=2; grp.add(M.shadow);
  /* floating number tags (billboards) */
  const tagG=new THREE.PlaneGeometry(1,1), cellT=new Float32Array(n*2);
  list.forEach((R,i)=>{ const c=A.cells[R.s]; cellT[i*2]=c.tag%A.cols; cellT[i*2+1]=Math.floor(c.tag/A.cols); });
  tagG.setAttribute("aCell",new THREE.InstancedBufferAttribute(cellT,2));
  const tagMat=new THREE.ShaderMaterial({uniforms:{map:{value:A.tex},uGrid:{value:new THREE.Vector2(1/A.cols,1/A.rows)}},transparent:true,depthTest:false,depthWrite:false,
    vertexShader:"attribute vec2 aCell; uniform vec2 uGrid; varying vec2 vUv; void main(){ vUv=vec2((aCell.x+uv.x)*uGrid.x,1.0-(aCell.y+1.0-uv.y)*uGrid.y); vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); float s=length(instanceMatrix[0].xyz); c.xy+=position.xy*s; gl_Position=projectionMatrix*c; }",
    fragmentShader:"uniform sampler2D map; varying vec2 vUv; void main(){ vec4 t=texture2D(map,vUv); if(t.a<0.05) discard; gl_FragColor=t; }"});
  M.tag=new THREE.InstancedMesh(tagG,tagMat,n); M.tag.frustumCulled=false; M.tag.renderOrder=20; grp.add(M.tag);
  /* roost: dirt chunks and dust as points */
  const P=lo?160:520, pp=new Float32Array(P*3), pa=new Float32Array(P), ps=new Float32Array(P), pc=new Float32Array(P*3);
  const pgeo=new THREE.BufferGeometry(); pgeo.setAttribute("position",new THREE.BufferAttribute(pp,3)); pgeo.setAttribute("aAlpha",new THREE.BufferAttribute(pa,1)); pgeo.setAttribute("aSize",new THREE.BufferAttribute(ps,1)); pgeo.setAttribute("aCol",new THREE.BufferAttribute(pc,3));
  const pmat=new THREE.ShaderMaterial({uniforms:{uScale:{value:300}},transparent:true,depthWrite:false,
    vertexShader:"attribute float aAlpha; attribute float aSize; attribute vec3 aCol; varying float vA; varying vec3 vC; uniform float uScale; void main(){ vA=aAlpha; vC=aCol; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uScale/max(0.5,-mv.z),1.0,64.0); gl_Position=projectionMatrix*mv; }",
    fragmentShader:"varying float vA; varying vec3 vC; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d); if(r>0.25) discard; gl_FragColor=vec4(vC,vA*(1.0-r*3.2)); }"});
  const pts=new THREE.Points(pgeo,pmat); pts.frustumCulled=false; pts.renderOrder=3; grp.add(pts);
  const part={n:P,pos:pp,alpha:pa,size:ps,col:pc,vel:new Float32Array(P*3),life:new Float32Array(P),max:new Float32Array(P),next:0,geo:pgeo,mat:pmat};
  const R={grp,M,A,n,part,list,hidden:new Uint8Array(n)};
  /* scratch */
  R._m=new THREE.Matrix4(); R._q=new THREE.Quaternion(); R._e=new THREE.Euler(0,0,0,"YZX"); R._v=new THREE.Vector3(); R._s=new THREE.Vector3(1,1,1);
  return R;
}

/* ---------------- posing ---------------- */
const _a=new THREE.Vector3(), _b=new THREE.Vector3(), _c=new THREE.Vector3(), _d=new THREE.Vector3(), _e=new THREE.Vector3(), _f=new THREE.Vector3(), _up=new THREE.Vector3(0,1,0);
const _m1=new THREE.Matrix4(), _m2=new THREE.Matrix4(), _q1=new THREE.Quaternion(), _sc=new THREE.Vector3();
const _bd=new THREE.Vector3(), _bq=new THREE.Quaternion(), _bm1=new THREE.Matrix4(), _bs=new THREE.Vector3(), _ka=new THREE.Vector3(), _kb=new THREE.Vector3(), _kc=new THREE.Vector3();
/* the bone mesh (unit +Y) from a to b (own scratch: a and b may be any vectors) */
function bone(m,i,a,b,thick){
  _bd.subVectors(b,a); const len=_bd.length()||1e-4; _bd.multiplyScalar(1/len);
  _bq.setFromUnitVectors(_up,_bd); _bs.set(thick||1,len,thick||1); _bm1.compose(a,_bq,_bs); m.setMatrixAt(i,_bm1);
}
/* two-bone IK: root a, target t, lengths l1 l2, pole direction p (world) -> the middle joint into out */
function ik(a,t,l1,l2,p,out){
  _ka.subVectors(t,a); let d=_ka.length(); const dmax=l1+l2-0.002, dmin=Math.abs(l1-l2)+0.002;
  if(d>dmax){ _ka.multiplyScalar(dmax/d); d=dmax; } if(d<dmin){ _ka.multiplyScalar(dmin/Math.max(1e-4,d)); d=dmin; }
  const e=_kb.copy(_ka).multiplyScalar(1/d), x=(l1*l1-l2*l2+d*d)/(2*d), h=Math.sqrt(Math.max(0,l1*l1-x*x));
  const nrm=_kc.copy(p).addScaledVector(e,-p.dot(e)); if(nrm.lengthSq()<1e-6) nrm.set(0,1,0); nrm.normalize();
  out.copy(a).addScaledVector(e,x).addScaledVector(nrm,h);
  return d;
}
/* the plates' and the jersey number's fixed local matrices */
const PLATE_L=[new THREE.Matrix4().compose(new THREE.Vector3(0.522,1.0,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0.28,"ZYX")),new THREE.Vector3(0.25,0.22,1)),
  new THREE.Matrix4().compose(new THREE.Vector3(-0.42,0.78,0.155),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-0.08)),new THREE.Vector3(0.3,0.21,1)),
  new THREE.Matrix4().compose(new THREE.Vector3(-0.42,0.78,-0.155),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI,0.08)),new THREE.Vector3(0.3,0.21,1))];
const BACK_ROT=new THREE.Matrix4().makeRotationY(-Math.PI/2);
const _fa=new THREE.Vector3(), _fh=new THREE.Vector3();
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
/* place one rider: B = the bike's world matrix (a Matrix4), st = {stand, dab, lean, crouch, spinF, spinR, compF, compR, hide, crash: {body matrix, limbs}} */
export function poseRider(R,i,B,st){
  const M=R.M;
  if(st.hide){ hideRider(R,i); return; }
  /* ---- the bike (unless the crash script has thrown the rider clear: then B is the bike and st.body the rider) ---- */
  /* wheels with spin and suspension: the front axle slides up the fork, the rear axle swings on the swingarm */
  const cf=st.compF||0, cr=st.compR||0;
  const fa=_a.set(BIKE.FA.x-cf*0.42,BIKE.FA.y+cf*0.9,0), ra=_b.set(BIKE.RA.x,BIKE.RA.y+cr,0);
  _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinF||0)); _m1.compose(fa,_q1,_sc.set(1,1,1)); _m2.multiplyMatrices(B,_m1); M.wheel.setMatrixAt(i*2,_m2);
  _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinR||0)); _m1.compose(ra,_q1,_sc.set(1,1,1)); _m2.multiplyMatrices(B,_m1); M.wheel.setMatrixAt(i*2+1,_m2);
  M.chassis.setMatrixAt(i,B); M.plastic.setMatrixAt(i,B); M.trim.setMatrixAt(i,B);
  /* fork: from the front axle to the clamp */
  _fa.copy(fa).applyMatrix4(B); _fh.copy(BIKE.HEAD).applyMatrix4(B); bone(M.fork,i,_fa,_fh,1);
  /* swingarm: from the pivot to the rear axle (unit geometry runs to -X); rotate in the bike's XY plane */
  const ang=Math.atan2(ra.y-BIKE.PIVOT.y,ra.x-BIKE.PIVOT.x)-Math.PI, len=Math.hypot(ra.x-BIKE.PIVOT.x,ra.y-BIKE.PIVOT.y);
  _q1.setFromAxisAngle(_c.set(0,0,1),ang); _m1.compose(BIKE.PIVOT,_q1,_sc.set(len,1,1)); _m2.multiplyMatrices(B,_m1); M.swing.setMatrixAt(i,_m2);
  /* plates: front (facing forward, tilted back), sides (facing out) */
  for(let k=0;k<3;k++){ _m2.multiplyMatrices(B,PLATE_L[k]); M.plate.setMatrixAt(i*3+k,_m2); }
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
    ik(s,t,0.29,0.29,W.pole,W.el); bone(M.uarm,i*2+a[3],s,W.el,1); bone(M.farm,i*2+a[3],W.el,t,1); });
  /* legs: knees forward, gripping the bike */
  [["hipL","fL",-1,0],["hipR","fR",1,1]].forEach(a=>{ const h=W[a[0]], t=W[a[1]], sd=a[2];
    W.pole.copy(fw).addScaledVector(rt,sd*0.25).addScaledVector(upv,0.15);
    ik(h,t,0.43,0.45,W.pole,W.kn); bone(M.thigh,i*2+a[3],h,W.kn,1); bone(M.shin,i*2+a[3],W.kn,t,1); });
}
/* a crash: the rider's body frame (world Matrix4: origin the hip, +Y up the spine, +X the chest's front, +Z right) and limb spread 0..1 */
const _bm=new THREE.Matrix4();
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
  M.wheel.setMatrixAt(i*2,z); M.wheel.setMatrixAt(i*2+1,z); ["chassis","plastic","trim","fork","swing","helmet","torso","back"].forEach(k=>M[k].setMatrixAt(i,z));
  ["uarm","farm","thigh","shin"].forEach(k=>{ M[k].setMatrixAt(i*2,z); M[k].setMatrixAt(i*2+1,z); });
  for(let k=0;k<3;k++) M.plate.setMatrixAt(i*3+k,z);
  M.shadow.setMatrixAt(i*2,z); M.shadow.setMatrixAt(i*2+1,z); M.tag.setMatrixAt(i,z);
}
export function shadowAt(R,k,x,y,z,th,sx,sz,alpha){
  _q1.setFromAxisAngle(_up,-th); _m1.compose(_a.set(x,y+0.03,z),_q1,_sc.set(sx*alpha+0.001,1,sz*alpha+0.001)); R.M.shadow.setMatrixAt(k,_m1);
}
export function tagAt(R,i,pos,size){ if(!size){ R.M.tag.setMatrixAt(i,_m1.makeScale(0,0,0)); return; } _m1.makeScale(size,size,size); _m1.setPosition(pos); R.M.tag.setMatrixAt(i,_m1); }
export function commit(R){
  const M=R.M; Object.keys(M).forEach(k=>{ if(M[k].instanceMatrix) M[k].instanceMatrix.needsUpdate=true; });
}
/* ---------------- roost ---------------- */
export function emit(R,x,y,z,vx,vy,vz,size,life,dirt){
  const P=R.part, k=P.next; P.next=(P.next+1)%P.n;
  P.pos[k*3]=x; P.pos[k*3+1]=y; P.pos[k*3+2]=z; P.vel[k*3]=vx; P.vel[k*3+1]=vy; P.vel[k*3+2]=vz; P.life[k]=life; P.max[k]=life; P.size[k]=size;
  const c=dirt||[0.36,0.27,0.19]; P.col[k*3]=c[0]; P.col[k*3+1]=c[1]; P.col[k*3+2]=c[2];
}
export function stepParticles(R,dt){
  const P=R.part;
  for(let k=0;k<P.n;k++){ if(P.life[k]<=0){ P.alpha[k]=0; continue; } P.life[k]-=dt; const t=P.life[k]/P.max[k];
    P.vel[k*3+1]-=9.81*dt*(P.size[k]>0.3?0.15:1); const dr=P.size[k]>0.3?1-1.6*dt:1-0.4*dt; P.vel[k*3]*=dr; P.vel[k*3+2]*=dr;
    P.pos[k*3]+=P.vel[k*3]*dt; P.pos[k*3+1]+=P.vel[k*3+1]*dt; P.pos[k*3+2]+=P.vel[k*3+2]*dt;
    if(P.size[k]>0.3) P.size[k]+=dt*0.9;   /* dust grows */
    P.alpha[k]=Math.max(0,Math.min(1,t*1.6))*(P.size[k]>0.3?0.32:0.9); }
  P.geo.attributes.position.needsUpdate=true; P.geo.attributes.aAlpha.needsUpdate=true; P.geo.attributes.aSize.needsUpdate=true; P.geo.attributes.aCol.needsUpdate=true;
}
export function setRed(R,list){ /* the red plate moved: redraw the atlas */ const A=atlas(list); R.A.tex.image=A.canvas; R.A.tex.needsUpdate=true; }
