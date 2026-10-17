/* MOTOCROSS WAR 3D — THE BIKE (owner: bike): the motorcycle as an ORIGINAL low-poly model (no logos, no sponsor marks; team = colours).
   The BIKE constants (wheelbase, wheel radius, fork, swingarm pivot, grips, pegs, suspension travel), the part geometries (wheel, chassis,
   plastics, trim, fork, swingarm, number plate), the bike's materials, the instanced meshes (one InstancedMesh per part type: every rider
   shares one draw call per part), the colouring per rider and the bike's pose each frame (wheels with spin and suspension travel, the fork,
   the swingarm, the plates). Moved out of the old r3d-riders.js byte for byte (the file split: no visual change).
   Bike local axes: +X forward, +Y up, +Z right (heading th: rotation.y = -th; roll + = lean right; pitch + = nose up; Euler order YZX).
   createBike(n, lo, mk) -> M {wheel, chassis, plastic, trim, fork, swing}; poseBike(M, i, B, st): B = the bike's world Matrix4, st = the
   rider's per-frame state (CONTRACT.md: compF / compR suspension compression, spinF / spinR wheel spin ...); hideBike(M, i). The number
   plates' mesh (M.plate) and its texture atlas are made by r3d-riders.js from plateGeo() and drawPlate() here. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {merge,paint,xf,lin,bone} from "./r3d-util.js";

const WB=1.48, WR=0.34;   /* wheelbase, wheel radius (m) */
export const BIKE={WB:WB,WR:WR,FA:new THREE.Vector3(0.74,WR,0),RA:new THREE.Vector3(-0.74,WR,0),HEAD:new THREE.Vector3(0.43,1.04,0),PIVOT:new THREE.Vector3(-0.08,0.46,0),
  GRIP:new THREE.Vector3(0.40,1.12,0.37),PEG:new THREE.Vector3(-0.07,0.43,0.21),TRAVEL:0.30,SAG:0.10};

/* ---------------- geometry of one bike (unit limbs along +Y) ----------------
   Polish: knobby tyres, a fork crown and a high front fender, flared radiator shrouds, a long seat and an upswept rear fender, the engine
   with fins and covers, the exhaust round the right side. Plastics are glossy (Phong), the metal parts have a sheen. */
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
/* a tube from a to b (open ended: its ends are inside other parts; half the triangles) */
function tube(a,b,r,c,seg,capped){ const d=new THREE.Vector3().subVectors(b,a), len=d.length(), g=paint(new THREE.CylinderGeometry(r,r,len,seg||6,1,!capped),c); g.translate(0,len/2,0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())); g.translate(a.x,a.y,a.z); return g; }
function wheelGeo(){
  /* polish: the tyre's tread is ONE torus with every other step of its outer ring pushed out (knobby in silhouette, the old 12 knob boxes
     cost more than the tyre), the rim, the hub, two crossed spokes, the brake disc: about 400 triangles a wheel instead of 630 */
  const NT=24, tire=new THREE.TorusGeometry(0.272,0.07,5,NT), TP=tire.attributes.position;
  for(let i=0;i<TP.count;i++){ const x=TP.getX(i), y=TP.getY(i), r=Math.hypot(x,y); if(r<0.3) continue; const a=Math.atan2(y,x), j=Math.round(a/(Math.PI*2)*NT);
    if(((j%2)+2)%2===0){ const k=1+0.034*(r-0.3)/0.042; TP.setX(i,x*k); TP.setY(i,y*k); } }
  tire.computeVertexNormals();
  const L=[paint(tire,lin("#18181b"))];
  L.push(paint(new THREE.TorusGeometry(0.212,0.017,3,16),lin("#c6cad1")));
  const hub=paint(new THREE.CylinderGeometry(0.05,0.05,0.17,8,1,true),lin("#9a9da6")); hub.rotateX(Math.PI/2); L.push(hub);
  for(let i=0;i<2;i++){ const b=paint(new THREE.BoxGeometry(0.008,0.42,0.008),lin("#b4b7be")); b.rotateZ(i*Math.PI/2+0.4); L.push(b); }
  const disc=paint(new THREE.CylinderGeometry(0.115,0.115,0.008,10,1,true),lin("#aeb2ba")); disc.rotateX(Math.PI/2); disc.translate(0,0,-0.075); L.push(disc);
  const dface=paint(new THREE.CircleGeometry(0.115,10),lin("#aeb2ba")); dface.translate(0,0,-0.071); L.push(dface);
  return merge(L);
}
function chassisGeo(){
  const dk=lin("#26272c"), mt=lin("#9ea2ac"), bl=lin("#111113"), ex=lin("#c4beb2"), L=[];
  /* the frame: twin spars from the head to the pivot, the cradle under the engine, the subframe to the back */
  [-1,1].forEach(sd=>{ const z=sd*0.075;
    L.push(tube(V3(0.40,1.0,z*0.5),V3(0.10,0.86,z),0.028,mt)); L.push(tube(V3(0.10,0.86,z),V3(-0.08,0.44,z),0.028,mt));
    L.push(tube(V3(0.38,0.96,z*0.5),V3(0.26,0.34,z*0.9),0.022,mt)); L.push(tube(V3(0.26,0.34,z*0.9),V3(-0.04,0.28,z*0.9),0.02,mt));
    L.push(tube(V3(0.06,0.84,z),V3(-0.66,0.93,z*1.3),0.018,mt)); L.push(tube(V3(-0.10,0.52,z),V3(-0.62,0.9,z*1.3),0.016,mt)); });
  /* the engine: the cases with round covers, the cylinder with fins, the airbox */
  L.push(xf(paint(new THREE.BoxGeometry(0.40,0.26,0.24),dk),0.04,0.42,0));
  L.push(xf(paint(new THREE.CylinderGeometry(0.075,0.085,0.24,10),lin("#3c3d44")),0.18,0.66,0,0,0,-0.3));
  for(let k=0;k<4;k++) L.push(xf(paint(new THREE.BoxGeometry(0.17,0.012,0.2),lin("#5a5b63")),0.16+k*0.016,0.58+k*0.045,0,0,0,-0.3));
  L.push(xf(paint(new THREE.CylinderGeometry(0.1,0.1,0.03,9),lin("#70727a")),0.02,0.42,0.13,Math.PI/2,0,0));
  L.push(xf(paint(new THREE.CylinderGeometry(0.08,0.08,0.03,9),lin("#70727a")),0.08,0.44,-0.13,Math.PI/2,0,0));
  [-1,1].forEach(sd=>L.push(xf(paint(new THREE.BoxGeometry(0.06,0.26,0.16),lin("#34353b")),0.30,0.74,sd*0.1,0,sd*0.25,-0.22)));   /* the radiators */
  L.push(xf(paint(new THREE.BoxGeometry(0.34,0.2,0.22),bl),-0.34,0.8,0));
  /* the seat: long and flat, the cover slightly rounded */
  const seat=new THREE.BoxGeometry(0.8,0.075,0.22,8,1,2), SP=seat.attributes.position; for(let i=0;i<SP.count;i++){ if(SP.getY(i)>0) SP.setZ(i,SP.getZ(i)*0.82); } seat.computeVertexNormals();
  L.push(xf(paint(seat,bl),-0.27,0.975,0,0,0,-0.045));
  /* the exhaust: the header out of the cylinder, round the right side, the silencer along the rear fender */
  L.push(tube(V3(0.26,0.66,0.06),V3(0.32,0.46,0.13),0.03,ex,8)); L.push(tube(V3(0.32,0.46,0.13),V3(0.12,0.40,0.17),0.03,ex,8));
  L.push(tube(V3(0.12,0.40,0.17),V3(-0.22,0.66,0.18),0.032,ex,8));
  L.push(tube(V3(-0.22,0.66,0.18),V3(-0.88,0.9,0.18),0.058,lin("#acaeb5"),10,true)); L.push(tube(V3(-0.88,0.9,0.18),V3(-0.95,0.925,0.18),0.036,lin("#26262a"),8,true));
  /* the handlebar and its clamp, the lower fork clamp, the grips and the levers */
  L.push(xf(paint(new THREE.CylinderGeometry(0.014,0.014,0.8,6),bl),0.40,1.12,0,Math.PI/2,0,0));
  L.push(xf(paint(new THREE.BoxGeometry(0.12,0.05,0.26),mt),0.43,1.05,0));
  L.push(xf(paint(new THREE.BoxGeometry(0.09,0.035,0.26),mt),0.535,0.80,0,0,0,0.42));
  [-0.37,0.37].forEach(z=>{ L.push(xf(paint(new THREE.CylinderGeometry(0.021,0.021,0.12,6),lin("#1e1e22")),0.40,1.12,z,Math.PI/2,0,0)); L.push(xf(paint(new THREE.BoxGeometry(0.12,0.012,0.02),lin("#3a3a40")),0.47,1.11,z*0.86,0,z>0?-0.45:0.45,0)); });
  /* the footpegs, the rear shock's spring */
  [-0.21,0.21].forEach(z=>L.push(xf(paint(new THREE.BoxGeometry(0.1,0.025,0.09),mt),-0.07,0.42,z)));
  L.push(tube(V3(-0.04,0.52,0),V3(-0.16,0.88,0),0.046,lin("#d9b02e"),8));
  return merge(L);
}
function plasticsGeo(){
  const W=[1,1,1], S=[0.86,0.86,0.86], L=[];
  /* the front fender: a long blade from under the fork clamp over the wheel, the tip curling up */
  const fp=[[0.47,0.80],[0.6,0.792],[0.74,0.786],[0.88,0.782],[1.0,0.79],[1.1,0.82]];
  for(let i=0;i<fp.length-1;i++){ const a=fp[i], b=fp[i+1], len=Math.hypot(b[0]-a[0],b[1]-a[1])+0.012; L.push(xf(paint(new THREE.BoxGeometry(len,0.016,0.155-i*0.008),W),(a[0]+b[0])/2,(a[1]+b[1])/2,0,0,0,Math.atan2(b[1]-a[1],b[0]-a[0]))); }
  /* the tank and the radiator shrouds: the widest part of the bike, flaring forward and down */
  const tank=new THREE.BoxGeometry(0.42,0.16,0.26,2,1,2); const P=tank.attributes.position; for(let i=0;i<P.count;i++){ const x=P.getX(i), y=P.getY(i); P.setZ(i,P.getZ(i)*(1+(x>0?0.25:0)+(y>0?-0.18:0.1))); } tank.computeVertexNormals();
  L.push(xf(paint(tank,W),0.21,0.98,0,0,0,-0.12));
  [-1,1].forEach(sd=>{ L.push(xf(paint(new THREE.BoxGeometry(0.38,0.28,0.026),W),0.31,0.83,sd*0.175,sd*0.16,0,-0.42)); L.push(xf(paint(new THREE.BoxGeometry(0.15,0.13,0.022),W),0.47,0.67,sd*0.158,sd*0.24,0,-0.62)); });
  /* the side panels under the seat (the side plates sit on them) */
  [-1,1].forEach(sd=>L.push(xf(paint(new THREE.BoxGeometry(0.44,0.27,0.025),S),-0.42,0.79,sd*0.14,0,0,-0.08)));
  /* the rear fender: long and swept up */
  L.push(xf(paint(new THREE.BoxGeometry(0.44,0.022,0.21),W),-0.79,0.995,0,0,0,0.1)); L.push(xf(paint(new THREE.BoxGeometry(0.3,0.02,0.18),W),-1.1,1.045,0,0,0,0.24));
  /* the front plate's backing */
  L.push(xf(paint(new THREE.BoxGeometry(0.03,0.27,0.3),W),0.50,1.0,0,0,0,-0.28));
  return merge(L);
}
function trimGeo(){
  const W=[1,1,1], L=[];
  /* graphics in the accent colour: a sweep down each shroud and along each side panel, the fork guards, the seat cover's stripe, a stripe on the rear fender */
  [-1,1].forEach(sd=>{ L.push(xf(paint(new THREE.BoxGeometry(0.34,0.045,0.012),W),0.31,0.86,sd*0.192,sd*0.16,0,-0.42)); L.push(xf(paint(new THREE.BoxGeometry(0.42,0.035,0.012),W),-0.42,0.66,sd*0.157,0,0,-0.08)); });
  [-1,1].forEach(sd=>L.push(xf(paint(new THREE.BoxGeometry(0.05,0.26,0.04),W),0.69,0.52,sd*0.1,0,0,0.42)));
  L.push(xf(paint(new THREE.BoxGeometry(0.46,0.012,0.22),W),-0.3,1.014,0,0,0,-0.045));
  L.push(xf(paint(new THREE.BoxGeometry(0.4,0.012,0.06),W),-0.8,1.008,0,0,0,0.1));
  return merge(L);
}
function forkGeo(){
  /* unit length along +Y: the lower legs (dark, the bottom 45%) and the gold tubes; local Z = the bike's right (bone() keeps it so) */
  const L=[]; [-0.095,0.095].forEach(z=>{ L.push(xf(paint(new THREE.CylinderGeometry(0.032,0.032,0.46,8),lin("#2a2b30")),0,0.23,z)); L.push(xf(paint(new THREE.CylinderGeometry(0.025,0.025,0.56,8),lin("#d6b24c")),0,0.72,z)); });
  return merge(L);
}
function swingGeo(){
  const L=[]; [-0.08,0.08].forEach(z=>L.push(xf(paint(new THREE.BoxGeometry(1,0.075,0.035),lin("#a3a7b0")),-0.5,0,z))); L.push(xf(paint(new THREE.BoxGeometry(0.08,0.06,0.18),lin("#a3a7b0")),-0.04,0,0));
  L.push(xf(paint(new THREE.BoxGeometry(0.34,0.05,0.008),lin("#1c1c20")),-0.62,0.0,-0.1));   /* the chain */
  return merge(L);
}
function plateGeo(){ const g=new THREE.PlaneGeometry(1,1); return g; }

/* ---------------- materials and instanced meshes ---------------- */
/* mk(geo, count, material) is the instancing glue of r3d-riders.js (an InstancedMesh added to the riders' group) */
export function createBike(n,lo,mk){
  const lam=new THREE.MeshLambertMaterial({vertexColors:true});
  /* glossy plastics, a sheen on the metal (polish) */
  const gloss=new THREE.MeshPhongMaterial({vertexColors:true,shininess:lo?30:70,specular:0x5c5c5c});
  const metal=new THREE.MeshPhongMaterial({vertexColors:true,shininess:45,specular:0x484848});
  const M={wheel:mk(wheelGeo(),n*2,lam), chassis:mk(chassisGeo(),n,metal), plastic:mk(plasticsGeo(),n,gloss), trim:mk(trimGeo(),n,gloss), fork:mk(forkGeo(),n,metal), swing:mk(swingGeo(),n,metal)};
  Object.values(M).forEach(m=>{ m.castShadow=true; });   /* every part of the bike casts the sun's shadow */
  return M;
}
/* the team colours of rider i's bike: the plastics in the team colour, the trim in the accent colour (instance colours) */
const _col=new THREE.Color();
export function colorBike(M,i,R){
  _col.set(R.color||"#888"); M.plastic.setColorAt(i,_col);
  _col.set(R.accent||"#f2f2f6"); M.trim.setColorAt(i,_col);
}
/* the number plate's face in the riders' atlas: white (or red for the points leader) with the team colour down its top, a black (white on
   red) number; x = the atlas canvas context, rr = rounded-rect path helper, fit = shrink the font to the plate, (px, py) = the cell's corner */
export function drawPlate(x,rr,fit,px,py,cell,R,t){
  x.fillStyle=R.red?"#c8101c":"#f4f1e8"; rr(px+4,py+10,cell-8,cell-20,14); x.fill();
  x.fillStyle=R.color||"#444"; x.fillRect(px+4,py+10,cell-8,13);
  x.lineWidth=4; x.strokeStyle=R.me?"#f0c040":"rgba(0,0,0,.55)"; rr(px+4,py+10,cell-8,cell-20,14); x.stroke();
  x.fillStyle=R.red?"#ffffff":"#121216"; x.textAlign="center"; x.textBaseline="middle"; fit(t,cell-22,84); x.fillText(t,px+cell/2,py+cell/2+8);
}

/* ---------------- posing ---------------- */
const _a=new THREE.Vector3(), _b=new THREE.Vector3(), _c=new THREE.Vector3(), _q1=new THREE.Quaternion(), _sc=new THREE.Vector3();
const _m1=new THREE.Matrix4(), _m2=new THREE.Matrix4();
const _fa=new THREE.Vector3(), _fh=new THREE.Vector3(), _ffw=new THREE.Vector3();
/* the number plates' fixed local matrices: the front plate (facing forward, tilted back) and the two side plates (facing out) */
export const PLATE_L=[new THREE.Matrix4().compose(new THREE.Vector3(0.522,1.0,0),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI/2,0.28,"ZYX")),new THREE.Vector3(0.25,0.22,1)),
  new THREE.Matrix4().compose(new THREE.Vector3(-0.42,0.78,0.155),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,0,-0.08)),new THREE.Vector3(0.3,0.21,1)),
  new THREE.Matrix4().compose(new THREE.Vector3(-0.42,0.78,-0.155),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,Math.PI,0.08)),new THREE.Vector3(0.3,0.21,1))];
/* the bike's pose: B = the bike's world matrix; st = the per-frame state (compF, compR, spinF, spinR used here) */
export function poseBike(M,i,B,st){
  /* ---- the bike (unless the crash script has thrown the rider clear: then B is the bike and st.body the rider) ---- */
  /* wheels with spin and suspension: the front axle slides up the fork, the rear axle swings on the swingarm */
  const cf=st.compF||0, cr=st.compR||0;
  const fa=_a.set(BIKE.FA.x-cf*0.42,BIKE.FA.y+cf*0.9,0), ra=_b.set(BIKE.RA.x,BIKE.RA.y+cr,0);
  _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinF||0)); _m1.compose(fa,_q1,_sc.set(1,1,1)); _m2.multiplyMatrices(B,_m1); M.wheel.setMatrixAt(i*2,_m2);
  _q1.setFromAxisAngle(_c.set(0,0,1),-(st.spinR||0)); _m1.compose(ra,_q1,_sc.set(1,1,1)); _m2.multiplyMatrices(B,_m1); M.wheel.setMatrixAt(i*2+1,_m2);
  M.chassis.setMatrixAt(i,B); M.plastic.setMatrixAt(i,B); M.trim.setMatrixAt(i,B);
  /* fork: from the front axle to the clamp */
  _fa.copy(fa).applyMatrix4(B); _fh.copy(BIKE.HEAD).applyMatrix4(B); _ffw.set(1,0,0).transformDirection(B); bone(M.fork,i,_fa,_fh,1,_ffw);
  /* swingarm: from the pivot to the rear axle (unit geometry runs to -X); rotate in the bike's XY plane */
  const ang=Math.atan2(ra.y-BIKE.PIVOT.y,ra.x-BIKE.PIVOT.x)-Math.PI, len=Math.hypot(ra.x-BIKE.PIVOT.x,ra.y-BIKE.PIVOT.y);
  _q1.setFromAxisAngle(_c.set(0,0,1),ang); _m1.compose(BIKE.PIVOT,_q1,_sc.set(len,1,1)); _m2.multiplyMatrices(B,_m1); M.swing.setMatrixAt(i,_m2);
  /* plates: front (facing forward, tilted back), sides (facing out) */
  for(let k=0;k<3;k++){ _m2.multiplyMatrices(B,PLATE_L[k]); M.plate.setMatrixAt(i*3+k,_m2); }
}
export function hideBike(M,i){
  const z=_m1.makeScale(0,0,0);
  M.wheel.setMatrixAt(i*2,z); M.wheel.setMatrixAt(i*2+1,z); ["chassis","plastic","trim","fork","swing"].forEach(k=>M[k].setMatrixAt(i,z));
  for(let k=0;k<3;k++) M.plate.setMatrixAt(i*3+k,z);
}
export {V3,tube,wheelGeo,chassisGeo,plasticsGeo,trimGeo,forkGeo,swingGeo,plateGeo};
