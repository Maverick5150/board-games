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

/* ---------------- geometry of one bike and one rider (unit limbs along +Y) ----------------
   Polish: knobby tyres, a fork crown and a high front fender, flared radiator shrouds, a long seat and an upswept rear fender, the engine
   with fins and covers, the exhaust round the right side; the rider in baggy gear (jersey and pants in the team colour, knee braces,
   white boots with a toe, dark gloves), a helmet with a big peak, a chin bar and goggles. Plastics and helmets are glossy (Phong), the
   metal parts have a sheen, the gear is cloth (Lambert). Parts marked aFix keep their own colour instead of the team colour. */
function fixed(g,rgb){ const q=paint(g,rgb); q.setAttribute("aFix",new THREE.BufferAttribute(new Float32Array(q.attributes.position.count).fill(1),1)); return q; }
function tinted(g,rgb){ const q=paint(g,rgb||[1,1,1]); q.setAttribute("aFix",new THREE.BufferAttribute(new Float32Array(q.attributes.position.count),1)); return q; }
function mergeF(list){ const g=merge(list), F=new Float32Array(g.attributes.position.count); let n=0;
  list.forEach(q=>{ const c=q.attributes.position.count, a=q.attributes.aFix; if(a) F.set(a.array,n); n+=c; }); g.setAttribute("aFix",new THREE.BufferAttribute(F,1)); return g; }
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
/* a tube from a to b (open ended: its ends are inside other parts; half the triangles) */
function tube(a,b,r,c,seg,capped){ const d=new THREE.Vector3().subVectors(b,a), len=d.length(), g=paint(new THREE.CylinderGeometry(r,r,len,seg||6,1,!capped),c); g.translate(0,len/2,0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())); g.translate(a.x,a.y,a.z); return g; }
function wheelGeo(){
  /* polish: the tyre's tread is ONE torus with every other step of its outer ring pushed out (knobby in silhouette, the old 12 knob boxes
     cost more than the tyre), the rim, the hub, two crossed spokes, the brake disc: about 380 triangles a wheel instead of 630 */
  const NT=26, tire=new THREE.TorusGeometry(0.272,0.07,6,NT), TP=tire.attributes.position;
  for(let i=0;i<TP.count;i++){ const x=TP.getX(i), y=TP.getY(i), r=Math.hypot(x,y); if(r<0.3) continue; const a=Math.atan2(y,x), j=Math.round(a/(Math.PI*2)*NT);
    if(((j%2)+2)%2===0){ const k=1+0.034*(r-0.3)/0.042; TP.setX(i,x*k); TP.setY(i,y*k); } }
  tire.computeVertexNormals();
  const L=[paint(tire,lin("#18181b"))];
  L.push(paint(new THREE.TorusGeometry(0.212,0.017,3,18),lin("#c6cad1")));
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

/* four soft, lumpy dust puffs in a 2 x 2 atlas (white; the particle's colour tints them) */
let PUFF=null;
function puffTex(){
  if(PUFF) return PUFF;
  const c=canvas(128,128), x=c.getContext("2d");
  for(let v=0;v<4;v++){ const ox=(v%2)*64, oy=Math.floor(v/2)*64; let sd=17+v*31; const R=()=>{ sd=(sd*16807)%2147483647; return sd/2147483647; };
    x.save(); x.beginPath(); x.rect(ox,oy,64,64); x.clip();
    for(let k=0;k<9;k++){ const a=R()*6.28, d=R()*8, px=ox+32+Math.cos(a)*d, py=oy+32+Math.sin(a)*d, r=9+R()*12, g=x.createRadialGradient(px,py,0,px,py,r);
      const sh=Math.round(200+R()*55); g.addColorStop(0,"rgba("+sh+","+sh+","+sh+",.42)"); g.addColorStop(0.6,"rgba("+sh+","+sh+","+sh+",.18)"); g.addColorStop(1,"rgba("+sh+","+sh+","+sh+",0)"); x.fillStyle=g; x.beginPath(); x.arc(px,py,r,0,7); x.fill(); } x.restore(); }
  PUFF=new THREE.CanvasTexture(c); return PUFF;
}
/* ---------------- the rider set ---------------- */
export function createRiders(list,opts){
  opts=opts||{};
  const n=list.length, lo=!!opts.lo, grp=new THREE.Group();
  const lam=new THREE.MeshLambertMaterial({vertexColors:true});
  /* glossy plastics and helmets, a sheen on the metal, cloth gear (polish) */
  const gloss=new THREE.MeshPhongMaterial({vertexColors:true,shininess:lo?30:70,specular:0x5c5c5c});
  const shell=new THREE.MeshPhongMaterial({vertexColors:true,shininess:lo?40:110,specular:0x8c8c8c});
  const metal=new THREE.MeshPhongMaterial({vertexColors:true,shininess:45,specular:0x484848});
  const cloth=fixMat();
  const mk=(geo,count,mat)=>{ const m=new THREE.InstancedMesh(geo,mat||lam,count); m.frustumCulled=false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); grp.add(m); return m; };
  const A=atlas(list);
  const M={
    wheel:mk(wheelGeo(),n*2), chassis:mk(chassisGeo(),n,metal), plastic:mk(plasticsGeo(),n,gloss), trim:mk(trimGeo(),n,gloss), fork:mk(forkGeo(),n,metal), swing:mk(swingGeo(),n,metal),
    helmet:mk(helmetGeo(),n,shell), torso:mk(torsoGeo(),n,cloth), uarm:mk(limbGeo(0.056,0.048,0.29),n*2,cloth), farm:mk(limbGeo(0.048,0.042,0.29,lin("#24252b"),0.2),n*2,cloth),
    thigh:mk(limbGeo(0.088,0.07,0.43),n*2,cloth), shin:mk(shinGeo(),n*2,cloth)
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
    const pc=col.clone().multiplyScalar(0.62); M.thigh.setColorAt(i*2,pc); M.thigh.setColorAt(i*2+1,pc); M.shin.setColorAt(i*2,pc); M.shin.setColorAt(i*2+1,pc);
    col.set(R.accent||"#f2f2f6"); M.trim.setColorAt(i,col);
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
  /* roost: dirt chunks and dust as points */
  const P=lo?160:520, pp=new Float32Array(P*3), pa=new Float32Array(P), ps=new Float32Array(P), pc=new Float32Array(P*3), pv=new Float32Array(P);
  const pgeo=new THREE.BufferGeometry(); pgeo.setAttribute("position",new THREE.BufferAttribute(pp,3)); pgeo.setAttribute("aAlpha",new THREE.BufferAttribute(pa,1)); pgeo.setAttribute("aSize",new THREE.BufferAttribute(ps,1)); pgeo.setAttribute("aCol",new THREE.BufferAttribute(pc,3)); pgeo.setAttribute("aVar",new THREE.BufferAttribute(pv,1));
  const pmat=new THREE.ShaderMaterial({uniforms:{uScale:{value:300},uPuff:{value:puffTex()}},transparent:true,depthWrite:false,
    vertexShader:"attribute float aAlpha; attribute float aSize; attribute vec3 aCol; attribute float aVar; varying float vA; varying vec3 vC; varying float vV; varying float vD; uniform float uScale; void main(){ vA=aAlpha; vC=aCol; vV=aVar; vD=aSize>0.3?1.0:0.0; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uScale/max(0.5,-mv.z),1.0,96.0); gl_Position=projectionMatrix*mv; }",
    fragmentShader:"uniform sampler2D uPuff; varying float vA; varying vec3 vC; varying float vV; varying float vD; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d); if(vD<0.5){ if(r>0.25) discard; float f=1.0-r*4.0; gl_FragColor=vec4(vC,vA*f*sqrt(f)); return; } vec4 t=texture2D(uPuff,(gl_PointCoord+vec2(mod(vV,2.0),floor(vV*0.5)))*0.5); if(t.a<0.01) discard; gl_FragColor=vec4(vC*(0.82+0.24*t.r),vA*t.a); }"});   /* clods: small round; dust: soft irregular puffs (display sRGB colours) */
  const pts=new THREE.Points(pgeo,pmat); pts.frustumCulled=false; pts.renderOrder=3; grp.add(pts);
  const part={n:P,pos:pp,alpha:pa,size:ps,col:pc,vari:pv,vel:new Float32Array(P*3),life:new Float32Array(P),max:new Float32Array(P),next:0,geo:pgeo,mat:pmat};
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
const _bx=new THREE.Vector3(), _bz=new THREE.Vector3();
function bone(m,i,a,b,thick,fw){
  _bd.subVectors(b,a); const len=_bd.length()||1e-4; _bd.multiplyScalar(1/len);
  if(fw){ /* local +X toward fw (the rider's or the bike's front), +Z = X x Y: the limb never spins about its own axis */
    _bx.copy(fw).addScaledVector(_bd,-fw.dot(_bd)); if(_bx.lengthSq()<1e-6) _bx.set(0,1,0).addScaledVector(_bd,-_bd.y); _bx.normalize(); _bz.crossVectors(_bx,_bd);
    const t=thick||1; _bm1.set(_bx.x*t,_bd.x*len,_bz.x*t,a.x, _bx.y*t,_bd.y*len,_bz.y*t,a.y, _bx.z*t,_bd.z*len,_bz.z*t,a.z, 0,0,0,1); m.setMatrixAt(i,_bm1); return; }
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
const _fa=new THREE.Vector3(), _fh=new THREE.Vector3(), _ffw=new THREE.Vector3();
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
  _fa.copy(fa).applyMatrix4(B); _fh.copy(BIKE.HEAD).applyMatrix4(B); _ffw.set(1,0,0).transformDirection(B); bone(M.fork,i,_fa,_fh,1,_ffw);
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
    ik(s,t,0.29,0.29,W.pole,W.el); bone(M.uarm,i*2+a[3],s,W.el,1,fw); bone(M.farm,i*2+a[3],W.el,t,1,fw); });
  /* legs: knees forward, gripping the bike */
  [["hipL","fL",-1,0],["hipR","fR",1,1]].forEach(a=>{ const h=W[a[0]], t=W[a[1]], sd=a[2];
    W.pole.copy(fw).addScaledVector(rt,sd*0.25).addScaledVector(upv,0.15);
    ik(h,t,0.43,0.45,W.pole,W.kn); bone(M.thigh,i*2+a[3],h,W.kn,1,fw); bone(M.shin,i*2+a[3],W.kn,t,1,fw); });
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
/* ---------------- roost ---------------- */
export function emit(R,x,y,z,vx,vy,vz,size,life,dirt){
  const P=R.part, k=P.next; P.next=(P.next+1)%P.n;
  P.pos[k*3]=x; P.pos[k*3+1]=y; P.pos[k*3+2]=z; P.vel[k*3]=vx; P.vel[k*3+1]=vy; P.vel[k*3+2]=vz; P.life[k]=life; P.max[k]=life; P.size[k]=size;
  const c=dirt||[0.36,0.27,0.19]; P.col[k*3]=c[0]; P.col[k*3+1]=c[1]; P.col[k*3+2]=c[2]; P.vari[k]=(k*7)%4;
}
export function stepParticles(R,dt){
  const P=R.part;
  for(let k=0;k<P.n;k++){ if(P.life[k]<=0){ P.alpha[k]=0; continue; } P.life[k]-=dt; const t=P.life[k]/P.max[k];
    P.vel[k*3+1]-=9.81*dt*(P.size[k]>0.3?0.15:1); const dr=P.size[k]>0.3?1-1.6*dt:1-0.4*dt; P.vel[k*3]*=dr; P.vel[k*3+2]*=dr;
    P.pos[k*3]+=P.vel[k*3]*dt; P.pos[k*3+1]+=P.vel[k*3+1]*dt; P.pos[k*3+2]+=P.vel[k*3+2]*dt;
    if(P.size[k]>0.3) P.size[k]+=dt*0.9;   /* dust grows */
    P.alpha[k]=Math.max(0,Math.min(1,t*1.6))*(P.size[k]>0.3?0.32:0.9); }
  P.geo.attributes.position.needsUpdate=true; P.geo.attributes.aAlpha.needsUpdate=true; P.geo.attributes.aSize.needsUpdate=true; P.geo.attributes.aCol.needsUpdate=true; P.geo.attributes.aVar.needsUpdate=true;
}
export function setRed(R,list){ /* the red plate moved: redraw the atlas */ const A=atlas(list); R.A.tex.image=A.canvas; R.A.tex.needsUpdate=true; }
