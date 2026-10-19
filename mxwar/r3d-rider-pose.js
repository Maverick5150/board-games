/* MOTOCROSS WAR 3D — THE RIDER'S POSE (owner: rider): the skeleton driven every frame. No THREE objects, plain arrays (40 riders must stay cheap on a Fire TV).
   Riding: the pelvis, the torso's pitch / roll and the head are DAMPED SPRINGS in the bike's frame that chase the stance (seated, standing, crouched, extended in the
   air, forward on the tank in a flat turn) and feel the bike's own acceleration (a landing pushes the pelvis down through the legs, a hard brake throws the shoulders
   forward, the air takes the weight off so the legs extend); the arms and legs are two-bone IK to the grips and the pegs with elbows up and out and knees forward;
   a reach constraint keeps the hands on the bars and the feet on the pegs whatever the springs do. A crash (the script in race3d.js gives a body frame and limb
   parameters): the hands and feet are under-damped springs in the WORLD frame (limbs lag and flop behind the tumbling body). The result: per bone a 3 x 4 skinning
   matrix (world) written into the rider's row of the bone texture (r3d-riders.js). Bike frame: +X forward, +Y up, +Z right; angles in radians. */
import {BN,NB,REST,LEN} from "./r3d-rider-model.js";
import {BIKE,steerOf,steerXYZ} from "./r3d-bike.js";

const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const sst=(a,b,x)=>{ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); };
const lerp=(a,b,t)=>a+(b-a)*t;

/* ---------------- 3 x 3 (row-major, columns = the frame's axes) ---------------- */
function Rx(m,a){ const c=Math.cos(a), s=Math.sin(a); m[0]=1; m[1]=0; m[2]=0; m[3]=0; m[4]=c; m[5]=-s; m[6]=0; m[7]=s; m[8]=c; }
function Rz(m,a){ const c=Math.cos(a), s=Math.sin(a); m[0]=c; m[1]=-s; m[2]=0; m[3]=s; m[4]=c; m[5]=0; m[6]=0; m[7]=0; m[8]=1; }
function Ry(m,a){ const c=Math.cos(a), s=Math.sin(a); m[0]=c; m[1]=0; m[2]=s; m[3]=0; m[4]=1; m[5]=0; m[6]=-s; m[7]=0; m[8]=c; }
function mm(A,B,o){ for(let r=0;r<3;r++) for(let c=0;c<3;c++) o[r*3+c]=A[r*3]*B[c]+A[r*3+1]*B[3+c]+A[r*3+2]*B[6+c]; return o; }
const T1=new Float64Array(9), T2=new Float64Array(9), T3=new Float64Array(9);
/* the rotation for a body part: roll about x, then pitch forward about z (the parent's frame times Rx(roll) times Rz(-pitch), then a yaw) */
function body(o,parent,pitch,roll,yaw){ Rz(T1,-pitch); Rx(T2,roll); mm(T2,T1,T3); if(yaw){ Ry(T1,yaw); mm(T3,T1,T2); T3.set(T2); } return mm(parent,T3,o); }
function mulv(R,x,y,z,o){ o[0]=R[0]*x+R[1]*y+R[2]*z; o[1]=R[3]*x+R[4]*y+R[5]*z; o[2]=R[6]*x+R[7]*y+R[8]*z; }

/* two-bone IK: root a, target t, lengths l1 l2, pole p -> the middle joint in out; returns the clamped distance */
function ik2(a,t,l1,l2,p,out){
  let dx=t[0]-a[0], dy=t[1]-a[1], dz=t[2]-a[2], d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1e-6;
  const dmax=l1+l2-0.002, dmin=Math.abs(l1-l2)+0.03;
  if(d>dmax){ const k=dmax/d; dx*=k; dy*=k; dz*=k; d=dmax; } else if(d<dmin){ const k=dmin/d; dx*=k; dy*=k; dz*=k; d=dmin; }
  const ex=dx/d, ey=dy/d, ez=dz/d, x=(l1*l1-l2*l2+d*d)/(2*d), h=Math.sqrt(Math.max(0,l1*l1-x*x));
  const pd=p[0]*ex+p[1]*ey+p[2]*ez; let nx=p[0]-pd*ex, ny=p[1]-pd*ey, nz=p[2]-pd*ez, nl=Math.sqrt(nx*nx+ny*ny+nz*nz);
  if(nl<1e-6){ nx=-ex*ey; ny=1-ey*ey; nz=-ez*ey; nl=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; }
  out[0]=a[0]+ex*x+nx/nl*h; out[1]=a[1]+ey*x+ny/nl*h; out[2]=a[2]+ez*x+nz/nl*h; return d;
}
/* a bone frame for a limb pointing along d (child direction): +Y = -d (so the rest pose, hanging down, is the identity), +X = the hint made perpendicular, +Z = X x Y */
function frameDir(R,dx,dy,dz,hx,hy,hz){
  const l0=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; const yx=-dx/l0, yy=-dy/l0, yz=-dz/l0;
  const d=hx*yx+hy*yy+hz*yz; let xx=hx-d*yx, xy=hy-d*yy, xz=hz-d*yz, l=Math.sqrt(xx*xx+xy*xy+xz*xz);
  if(l<1e-4){ xx=-yy; xy=yx; xz=0; l=Math.sqrt(xx*xx+xy*xy)||1; }
  xx/=l; xy/=l; xz/=l;
  const zx=xy*yz-xz*yy, zy=xz*yx-xx*yz, zz=xx*yy-xy*yx;
  R[0]=xx; R[3]=xy; R[6]=xz; R[1]=yx; R[4]=yy; R[7]=yz; R[2]=zx; R[5]=zy; R[8]=zz;
}
/* a critically-ish damped spring step (x, v: the state in a[i], a[i+1]) */
function spring(S,i,target,w,z,dt,extra){
  const n=Math.max(1,Math.ceil(dt/0.0083)), h=dt/n; let x=S[i], v=S[i+1];
  for(let k=0;k<n;k++){ const a=w*w*(target-x)-2*z*w*v+extra; v+=a*h; x+=v*h; }
  S[i]=x; S[i+1]=v; return x;
}

/* ---------------- the rider's state (one per rider) ---------------- */
/* milestone 2: every rider has his own STYLE (deterministic from his index: no two riders in a pack ride alike): how wide his elbows go, how high he
   carries them, how deep he crouches, how far forward he leans, how quickly he gets up on the pegs, where he looks, how far back his hips sit */
function riderStyle(i){
  const h=k=>{ const x=Math.sin((i+1)*12.9898+k*78.233)*43758.5453; return x-Math.floor(x); };
  return {flare:0.78+0.44*h(1), crouch:(h(2)-0.5)*0.10, pitch:(h(3)-0.5)*0.16, lag:0.05+0.17*h(4), head:(h(5)-0.5)*0.10, up:0.85+0.30*h(6), hip:(h(7)-0.5)*0.07, knee:(h(8)-0.5)*0.10};
}
export function newRig(i){
  return {init:false, S:new Float64Array(24),   /* springs: [x,v] pairs: 0 pelvis x, 2 y, 4 z, 6 pitch, 8 roll, 10 head pitch, 12 head yaw, 14 shoulder sway, 16 stand */
    pp:[0,0,0], pv:[0,0,0], a:[0,0,0], ph:i*1.7+0.3, tw:0, fl:new Float64Array(12), flv:new Float64Array(12), fl0:false, w:0, hand:[0,0,0,0,0,0], foot:[0,0,0,0,0,0], err:{hand:0,foot:0},
    sty:riderStyle(i), sf:0, mode:"", bl:null};
}
/* scratch */
const Rp=new Float64Array(9), Rs=new Float64Array(9), Rc=new Float64Array(9), Rn=new Float64Array(9), Rh=new Float64Array(9);
const O=new Float64Array(NB*3), RR=new Float64Array(NB*9);   /* every bone's frame (local space): origin and rotation */
const v3=()=>new Float64Array(3);
const P=v3(), Os=v3(), Oc=v3(), On=v3(), Oh=v3(), tv=v3(), SL=v3(), SRr=v3(), HL=v3(), HR=v3(), E=v3(), W=v3(), Kn=v3(), A=v3(), G=v3(), pole=v3(), tmp=v3();
const RA=new Float64Array(9), RB=new Float64Array(9);
function put(b,R,o){ RR.set(R,b*9); O[b*3]=o[0]; O[b*3+1]=o[1]; O[b*3+2]=o[2]; }
function off(b,par){ return [REST[b][0]-REST[par][0],REST[b][1]-REST[par][1],REST[b][2]-REST[par][2]]; }
const OFF_SP=off(BN.SPINE,BN.PELVIS), OFF_CH=off(BN.CHEST,BN.SPINE), OFF_NK=off(BN.NECK,BN.CHEST), OFF_HD=off(BN.HEAD,BN.NECK);
const SHO_L=off(BN.UAL,BN.CHEST), SHO_R=off(BN.UAR,BN.CHEST), HIP_L=REST[BN.THL], HIP_R=REST[BN.THR];

/* the skeleton: a pelvis (origin P, frame Rp), the torso's angles, the head, and the hand and foot targets (all in one space) -> every bone's frame.
   o = {pitch, roll, hpitch, hyaw, hand: [gLx,gLy,gLz,gRx,gRy,gRz], foot: [aLx..aRz] (ankle targets), fwdX: the hint for hands / feet, elbow: pole mix, toe: [pitch L, R], toeOut}. */
function skeleton(Pp,Rpel,o){
  put(BN.PELVIS,Rpel,Pp);
  const sp=o.pitch, ro=o.roll;
  body(Rs,Rpel,sp*0.34,ro*0.32,0); mulv(Rpel,OFF_SP[0],OFF_SP[1],OFF_SP[2],tv); Os[0]=Pp[0]+tv[0]; Os[1]=Pp[1]+tv[1]; Os[2]=Pp[2]+tv[2]; put(BN.SPINE,Rs,Os);
  body(Rc,Rs,sp*0.38,ro*0.38,0); mulv(Rs,OFF_CH[0],OFF_CH[1],OFF_CH[2],tv); Oc[0]=Os[0]+tv[0]; Oc[1]=Os[1]+tv[1]; Oc[2]=Os[2]+tv[2]; put(BN.CHEST,Rc,Oc);
  /* the neck and head: they look ahead: the neck takes back the torso's lean, the head turns */
  body(Rn,Rc,o.hpitch*0.5,0,o.hyaw*0.4); mulv(Rc,OFF_NK[0],OFF_NK[1],OFF_NK[2],tv); On[0]=Oc[0]+tv[0]; On[1]=Oc[1]+tv[1]; On[2]=Oc[2]+tv[2]; put(BN.NECK,Rn,On);
  body(Rh,Rn,o.hpitch*0.5,0,o.hyaw*0.6); mulv(Rn,OFF_HD[0],OFF_HD[1],OFF_HD[2],tv); Oh[0]=On[0]+tv[0]; Oh[1]=On[1]+tv[1]; Oh[2]=On[2]+tv[2]; put(BN.HEAD,Rh,Oh);
  /* the arms: shoulders on the chest, two-bone IK to the grips (elbows out and up), then the hand on the bar */
  const hint=o.fwdX;
  for(let sd=-1;sd<=1;sd+=2){
    const L=sd<0, S=L?SL:SRr, so=L?SHO_L:SHO_R, UA=L?BN.UAL:BN.UAR, FA=L?BN.FAL:BN.FAR, HA=L?BN.HAL:BN.HAR, h=L?0:3;
    mulv(Rc,so[0]+(o.shF||0),so[1]+(o.shU||0),so[2],tv); S[0]=Oc[0]+tv[0]; S[1]=Oc[1]+tv[1]; S[2]=Oc[2]+tv[2];   /* (milestone 2: the shoulders roll forward and up toward the bars when he rides: o.shF, o.shU) */
    G[0]=o.hand[h]; G[1]=o.hand[h+1]; G[2]=o.hand[h+2];
    /* the pole: out to the side and up in the chest's frame, a little back */
    pole[0]=-o.elbowBack; pole[1]=o.elbowUp*(o.elbowAdapt?clamp((S[1]-G[1]-0.17)/0.17,0.25,1):1); pole[2]=sd*o.elbowOut;   /* out to the side and up, in the bike's frame (milestone 2: less up when the shoulders are low over the bars, so the elbows never rise over the shoulders: the gate's 'scarecrows') */
    ik2(S,G,LEN.UA,LEN.FA+LEN.HAND,pole,E);
    let dx=E[0]-S[0], dy=E[1]-S[1], dz=E[2]-S[2];
    frameDir(RA,dx,dy,dz,Rc[0],Rc[3],Rc[6]); put(UA,RA,S);
    dx=G[0]-E[0]; dy=G[1]-E[1]; dz=G[2]-E[2]; const dl=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; dx/=dl; dy/=dl; dz/=dl;
    frameDir(RB,dx,dy,dz,RA[0],RA[3],RA[6]); put(FA,RB,E);
    W[0]=E[0]+dx*LEN.FA; W[1]=E[1]+dy*LEN.FA; W[2]=E[2]+dz*LEN.FA;
    frameDir(RA,dx,dy,dz,hint[0],hint[1],hint[2]); put(HA,RA,W);
    const ex=G[0]-(W[0]+dx*LEN.HAND), ey=G[1]-(W[1]+dy*LEN.HAND), ez=G[2]-(W[2]+dz*LEN.HAND); o.herr=Math.max(o.herr||0,Math.sqrt(ex*ex+ey*ey+ez*ez));
  }
  /* the legs: hips on the pelvis, two-bone IK to the ankles (knees forward and a little out), the foot flat on the peg, toes a little out */
  for(let sd=-1;sd<=1;sd+=2){
    const L=sd<0, H=L?HL:HR, ho=L?HIP_L:HIP_R, TH=L?BN.THL:BN.THR, SH=L?BN.SHL:BN.SHR, FT=L?BN.FTL:BN.FTR, h=L?0:3;
    mulv(Rpel,ho[0],ho[1],ho[2],tv); H[0]=Pp[0]+tv[0]; H[1]=Pp[1]+tv[1]; H[2]=Pp[2]+tv[2];
    A[0]=o.foot[h]; A[1]=o.foot[h+1]; A[2]=o.foot[h+2];
    mulv(Rpel,1,0.12,sd*o.kneeOut,pole);
    if(o.kneeAim>0){ const kx=o.knee[0]-H[0], ky=o.knee[1]-H[1], kz=sd*o.knee[2]-H[2], kl=Math.sqrt(kx*kx+ky*ky+kz*kz)||1, w=o.kneeAim, pm=Math.sqrt(pole[0]*pole[0]+pole[1]*pole[1]+pole[2]*pole[2])||1;   /* the pole turns toward the bike's knee point */
      pole[0]=pole[0]*(1-w)+kx/kl*pm*w; pole[1]=pole[1]*(1-w)+ky/kl*pm*w; pole[2]=pole[2]*(1-w)+kz/kl*pm*w; }
    ik2(H,A,LEN.TH,LEN.SH,pole,Kn);
    let dx=Kn[0]-H[0], dy=Kn[1]-H[1], dz=Kn[2]-H[2];
    frameDir(RA,dx,dy,dz,Rpel[0],Rpel[3],Rpel[6]); put(TH,RA,H);
    dx=A[0]-Kn[0]; dy=A[1]-Kn[1]; dz=A[2]-Kn[2];
    frameDir(RB,dx,dy,dz,RA[0],RA[3],RA[6]); put(SH,RB,Kn);
    /* the foot: forward turned out about the up axis, toe pitched (down +) */
    const to=o.toeOut*sd, tp=o.toe[L?0:1], cp=Math.cos(tp), sp2=Math.sin(tp), cy=Math.cos(to), sy=Math.sin(to);
    const fx=cp*cy, fy=-sp2, fz=cp*sy*1;   /* forward */
    /* up = world up made perpendicular to forward */
    let ux=-fx*fy, uy=1-fy*fy, uz=-fz*fy, ul=Math.sqrt(ux*ux+uy*uy+uz*uz)||1; ux/=ul; uy/=ul; uz/=ul;
    const zx=fy*uz-fz*uy, zy=fz*ux-fx*uz, zz=fx*uy-fy*ux;
    RA[0]=fx; RA[3]=fy; RA[6]=fz; RA[1]=ux; RA[4]=uy; RA[7]=uz; RA[2]=zx; RA[5]=zy; RA[8]=zz; put(FT,RA,A);
  }
}
/* the bone frames (local space) -> skinning matrices in the world: row-major 3 x 4 per bone, M = B * [R | o - R * rest] (B = a column-major 4 x 4: THREE.Matrix4.elements) */
function emit(Bm,out,base){
  const b00=Bm[0], b10=Bm[1], b20=Bm[2], b01=Bm[4], b11=Bm[5], b21=Bm[6], b02=Bm[8], b12=Bm[9], b22=Bm[10], tx=Bm[12], ty=Bm[13], tz=Bm[14];
  for(let b=0;b<NB;b++){
    const r=b*9, rx=REST[b][0], ry=REST[b][1], rz=REST[b][2];
    const R0=RR[r], R1=RR[r+1], R2=RR[r+2], R3=RR[r+3], R4=RR[r+4], R5=RR[r+5], R6=RR[r+6], R7=RR[r+7], R8=RR[r+8];
    const t0=O[b*3]-(R0*rx+R1*ry+R2*rz), t1=O[b*3+1]-(R3*rx+R4*ry+R5*rz), t2=O[b*3+2]-(R6*rx+R7*ry+R8*rz);
    const o=base+b*12;
    out[o]=b00*R0+b01*R3+b02*R6; out[o+1]=b00*R1+b01*R4+b02*R7; out[o+2]=b00*R2+b01*R5+b02*R8; out[o+3]=b00*t0+b01*t1+b02*t2+tx;
    out[o+4]=b10*R0+b11*R3+b12*R6; out[o+5]=b10*R1+b11*R4+b12*R7; out[o+6]=b10*R2+b11*R5+b12*R8; out[o+7]=b10*t0+b11*t1+b12*t2+ty;
    out[o+8]=b20*R0+b21*R3+b22*R6; out[o+9]=b20*R1+b21*R4+b22*R7; out[o+10]=b20*R2+b21*R5+b22*R8; out[o+11]=b20*t0+b21*t1+b22*t2+tz;
  }
}
const IDM=new Float64Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);

/* ---------------- riding ---------------- */
const HINT=v3(); HINT[0]=1;
/* the seat and the contact points of the bike, read at every call (the bike's constants can change): the grips and pegs from BIKE */
function bikePts(){
  const g=BIKE.GRIP, p=BIKE.PEG, s=BIKE.SEAT||null, k=BIKE.KNEE||null;
  return {gx:g.x,gy:g.y,gz:g.z,px:p.x,py:p.y,pz:p.z,sx:s?s.x:-0.20,sy:s?s.y:1.00,kx:k?k.x:0.14,ky:k?k.y:0.84,kz:k?k.z:0.15};
}
/* B = the bike's world matrix elements (column-major, 16), st = the per-rider state (CONTRACT.md section 5), dt the last step (s) */
export function poseRide(rig,Bm,st,dt,out,base){
  const bp=bikePts(), S=rig.S;
  const px=Bm[12], py=Bm[13], pz=Bm[14];
  /* the bike's own acceleration in its frame (world position differences, filtered): a landing, a bump, the brakes, a turn */
  let teleport=false, jump=false;
  if(rig.init){ const dx=px-rig.pp[0], dy=py-rig.pp[1], dz=pz-rig.pp[2], d2=dx*dx+dy*dy+dz*dz; if(d2>9) teleport=true; else if(dt>0&&d2>Math.pow(Math.max(0.45,dt*32),2)) jump=true; }   /* (a jump of the bike faster than 32 m/s, e.g. the remount putting him back on his line, is not an acceleration the body feels) */
  if(!rig.init||teleport||jump){ rig.pp[0]=px; rig.pp[1]=py; rig.pp[2]=pz; if(!jump){ rig.pv[0]=rig.pv[1]=rig.pv[2]=0; } rig.a[0]=rig.a[1]=rig.a[2]=0; }
  else if(dt>=1/240){
    const vx=(px-rig.pp[0])/dt, vy=(py-rig.pp[1])/dt, vz=(pz-rig.pp[2])/dt, k=Math.min(1,dt*18);
    rig.a[0]+=(clamp((vx-rig.pv[0])/dt,-60,60)-rig.a[0])*k; rig.a[1]+=(clamp((vy-rig.pv[1])/dt,-60,60)-rig.a[1])*k; rig.a[2]+=(clamp((vz-rig.pv[2])/dt,-60,60)-rig.a[2])*k;
    rig.pv[0]=vx; rig.pv[1]=vy; rig.pv[2]=vz; rig.pp[0]=px; rig.pp[1]=py; rig.pp[2]=pz; }
  const ax=rig.a[0], ay=rig.a[1], az=rig.a[2];
  const aLx=ax*Bm[0]+ay*Bm[1]+az*Bm[2], aLy=ax*Bm[4]+ay*Bm[5]+az*Bm[6], aLz=ax*Bm[8]+ay*Bm[9]+az*Bm[10];
  if(dt>0) rig.tw+=dt;
  /* the stance (milestone 2: the real ATTACK position: standing, the hips back over the pegs and low, the chest forward, the head over the bars, the arms
     bent; seated forward on the seat in a flat turn; each rider with his own style (rig.sty) and his own timing getting up on the pegs) */
  const sy=rig.sty;
  let standIn=clamp(st.stand||0,0,1);
  if(!rig.init||teleport||dt<=0) rig.sf=standIn; else rig.sf+=(standIn-rig.sf)*Math.min(1,dt/sy.lag);   /* (a pack does not stand up on the same instant) */
  const stand=st.gate?standIn:rig.sf, crouch=clamp(st.crouch||0,0,0.8), lean=st.lean||0, dab=st.dab||0, adab=Math.abs(dab), pitchB=st.pitch||0, v=st.v||0, acc=st.acc||0;
  const air=!!st.air, kk=st.k||0, turn=clamp(Math.abs(kk)*14,0,1);
  const sit=1-stand;
  /* targets in the bike frame */
  let tx=lerp(bp.sx+0.10,-0.10+sy.hip,stand)+0.04*turn*sit+0.05*adab, ty=lerp(bp.sy+0.10,1.25+sy.crouch,stand)-0.20*crouch*(0.5+0.5*stand)+(air?0.05:0), tz=0.045*Math.sign(dab)*adab-0.05*clamp(lean,-0.8,0.8)*sit;
  if(air&&pitchB<-0.05) tx-=Math.min(0.07,(-pitchB-0.05)*0.25);   /* nose down on the way down: the hips go back */
  let tp=lerp(0.90,1.12,stand)+sy.pitch+0.22*crouch*(st.gate?0.4:1)+0.05*turn*sit+clamp(-acc*0.012,-0.07,0.11)+pitchB*(air?0.78:0.5);   /* torso pitch forward (in the air he holds his body against the bike's pitch) */
  if(air&&Math.abs(pitchB)<0.02) tp-=0.06;
  let tr=-(air?0.62:0.30)*lean-0.12*dab*adab;   /* torso roll relative to the bike: more upright than the bike (in the air he stays upright while the bike is whipped under him), the inside shoulder dropped with the foot out */
  /* idle life: the rider works on the bike: shifts a little, faster with speed */
  const sw=Math.sin(rig.tw*(2.3+0.05*v)+rig.ph)*0.7+Math.sin(rig.tw*(5.1+0.1*v)+rig.ph*2.1)*0.3, spd=clamp(v/14,0,1);
  tr+=sw*0.025*(0.4+spd); tp+=Math.sin(rig.tw*3.7+rig.ph*1.3)*0.012*(0.4+spd);
  const hyT=clamp(kk*9+sy.head*(1-turn),-0.55,0.55), hpT=-tp+0.02-0.15*pitchB;
  if(!rig.init||teleport){ S[0]=tx; S[1]=0; S[2]=ty; S[3]=0; S[4]=tz; S[5]=0; S[6]=tp; S[7]=0; S[8]=tr; S[9]=0; S[10]=hpT; S[11]=0; S[12]=hyT; S[13]=0; rig.init=true; }
  rig.fl0=false;
  if(dt>0){
    const w1=11.5, z1=0.72;
    if(st.landed){ S[3]-=Math.min(1.6,0.10*st.impact); S[7]+=Math.min(0.9,0.05*st.impact); }   /* the landing: the legs take it */
    spring(S,0,tx,w1,z1,dt,-aLx*0.55); spring(S,2,ty,w1,z1,dt,-aLy*0.9); spring(S,4,tz,w1*0.9,z1,dt,-aLz*0.4);
    spring(S,6,tp,9.5,0.8,dt,0); spring(S,8,tr,8.0,0.8,dt,0);
  }
  /* the head looks into the turn and keeps its eyes on the road ahead whatever the torso does */
  if(dt>0){ spring(S,10,hpT,12,0.8,dt,0); spring(S,12,hyT,7,0.9,dt,0); }
  /* the pelvis position, clamped so the legs always reach the pegs and never fold flat */
  const Px=clamp(S[0],tx-0.20,tx+0.20), Py=clamp(S[2],ty-0.26,ty+0.20), Pz=clamp(S[4],tz-0.15,tz+0.15);
  P[0]=Px; P[1]=Py; P[2]=Pz;
  /* the pelvis frame: the torso's pitch is shared up the spine; the pelvis takes a part, rolled a little */
  const pitch=S[6], roll=S[8];
  Rz(T1,-pitch*0.28); Rx(T2,roll*0.30); mm(T2,T1,Rp);
  /* the contact targets: hands on the grips, the ankles over the pegs (the boot's ball on the peg; the inside foot out in a flat turn) */
  const o=SKO; o.pitch=pitch; o.roll=roll; o.hpitch=S[10]; o.hyaw=S[12]; o.fwdX=HINT; o.herr=0;
  /* the hands are on the grips AS THE BARS ARE TURNED (r3d-bike.js steerOf / steerXYZ: the same turn the bike draws), so the arms follow the steering */
  { const dl=steerOf(st); if(dl>1e-4||dl<-1e-4){ steerXYZ(bp.gx,bp.gy,-bp.gz,dl,o.hand,0); steerXYZ(bp.gx,bp.gy,bp.gz,dl,o.hand,3); } else { o.hand[0]=bp.gx; o.hand[1]=bp.gy; o.hand[2]=-bp.gz; o.hand[3]=bp.gx; o.hand[4]=bp.gy; o.hand[5]=bp.gz; } }
  o.knee[0]=bp.kx; o.knee[1]=bp.ky; o.knee[2]=bp.kz; o.kneeAim=clamp(0.78*(1-stand)+0.55*stand+sy.knee,0,1);   /* the knees press on the shrouds (BIKE.KNEE): the leg's IK bends toward that point (standing too: he grips the bike with his knees) */
  o.foot[0]=bp.px-0.095; o.foot[1]=bp.py+0.115; o.foot[2]=-bp.pz; o.foot[3]=bp.px-0.095; o.foot[4]=bp.py+0.115; o.foot[5]=bp.pz;
  if(adab>0.01){ const R=dab>0, k=adab, i=R?3:0, s=R?1:-1; o.foot[i]=lerp(o.foot[i],0.30,k); o.foot[i+1]=lerp(o.foot[i+1],0.52,k); o.foot[i+2]=lerp(o.foot[i+2],s*0.46,k); }
  o.toe[0]=o.toe[1]=0.12+0.28*(air?1:0)-0.1*stand; if(adab>0.01){ const k=adab; if(dab>0) o.toe[1]=lerp(o.toe[1],-0.35,k); else o.toe[0]=lerp(o.toe[0],-0.35,k); }
  /* the elbows (milestone 2; they were a straight 'wing' out to the side from behind): OUT and a little BACK with the arm visibly bent, as the cover's
     riders: from behind the upper arm drops about 30 degrees from the shoulder to the elbow, the forearm comes back in and down to the grip; each rider
     carries them his own way (rig.sty.flare, rig.sty.up) */
  o.toeOut=0.12+0.15*adab; o.kneeOut=0.20+0.06*stand; o.elbowOut=(0.62+0.06*turn)*sy.flare; o.elbowUp=(sy.up-1.0)*0.5-0.04+0.05*stand; o.elbowBack=0.30; o.elbowAdapt=false; o.shF=0.022+0.026*stand; o.shU=0.008+0.014*stand;
  /* the reach: the pelvis is pulled / pushed along the line to the pegs so the legs neither overstretch nor fold flat */
  { const hx=P[0], hy=P[1]-0.03, hz=P[2], ax=(o.foot[0]+o.foot[3])*0.5, ay=(o.foot[1]+o.foot[4])*0.5, az=(o.foot[2]+o.foot[5])*0.5;
    let dx=ax-hx, dy=ay-hy, dz=az-hz, d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
    const lmax=adab>0.5?0.80:0.855, lmin=0.34; let c=0; if(d>lmax) c=d-lmax; else if(d<lmin) c=d-lmin;
    if(c!==0){ P[0]+=dx/d*c; P[1]+=dy/d*c; P[2]+=dz/d*c; } }
  /* the arms: if the shoulders are further from the grips than the arms are long, the whole upper body moves toward the bars (a little) */
  skeleton(P,Rp,o);
  { const lmax=LEN.UA+LEN.FA+LEN.HAND-0.025; let dxs=0, dys=0, dzs=0, cm=0;
    for(let sd=0;sd<2;sd++){ const S0=sd?SRr:SL, g=sd*3, dx=o.hand[g]-S0[0], dy=o.hand[g+1]-S0[1], dz=o.hand[g+2]-S0[2], d=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; if(d-lmax>cm){ cm=d-lmax; dxs=dx/d; dys=dy/d; dzs=dz/d; } }
    if(cm>0){ const c=Math.min(0.12,cm); P[0]+=dxs*c; P[1]+=dys*c; P[2]+=dzs*c*0.3; o.herr=0; skeleton(P,Rp,o); } }
  rig.err.hand=o.herr;
  emit(Bm,out,base);
}
const SKO={pitch:0,roll:0,hpitch:0,hyaw:0,fwdX:HINT,hand:[0,0,0,0,0,0],foot:[0,0,0,0,0,0],toe:[0,0],toeOut:0.12,kneeOut:0.28,elbowOut:0.9,elbowUp:0.55,elbowBack:0.25,herr:0,knee:[0.14,0.84,0.15],kneeAim:0};

/* ---------------- a crash: the body frame (a world matrix: origin the hip, +Y up the spine, +X the chest's front, +Z right) and limb parameters ---------------- */
const BF=new Float64Array(16), BI=new Float64Array(9), wp=v3(), lp=v3();
export function poseBody(rig,body,lim,dt,out,base){
  const L=lim||{}, spread=L.spread||0, walk=L.walk||0, ph=L.phase||0, stand=L.stand||0, reach=L.reach||0;
  rig.init=false;   /* (riding starts afresh when he is back on the bike) */
  const e=body.elements; for(let i=0;i<16;i++) BF[i]=e[i];
  /* the body frame's rotation (columns) and its transpose */
  const R=[BF[0],BF[4],BF[8], BF[1],BF[5],BF[9], BF[2],BF[6],BF[10]];
  for(let r=0;r<3;r++) for(let c=0;c<3;c++) BI[r*3+c]=R[c*3+r];
  const spine=0.12*(1-spread)+0.25*spread*Math.sin(ph*0.5), lk=0.25;
  /* targets in the body's frame (as the old crash pose): hands by the sides when standing, flung out when tumbling, the feet under the hip; the shoulders sit 0.52 above the hip */
  const sh=0.5, tg=rig.tgt||(rig.tgt=new Float64Array(12));
  tg[0]=0.12+0.1*Math.sin(ph)*walk+reach*0.45; tg[1]=sh-0.45+0.5*spread; tg[2]=-0.25-0.35*spread-0.0;
  tg[3]=0.12-0.1*Math.sin(ph)*walk+reach*0.45; tg[4]=sh-0.45+0.5*spread; tg[5]=0.25+0.35*spread;
  tg[6]=0.25*Math.sin(ph)*walk+0.10*spread-0.10; tg[7]=-0.86+0.1*spread*(1-stand)+0.05; tg[8]=-0.14-0.3*spread-0.0;
  tg[9]=-0.25*Math.sin(ph)*walk-0.05*spread-0.10; tg[10]=-0.86+0.1*spread*(1-stand)+0.05; tg[11]=0.14+0.3*spread;
  /* the effectors are springs in the WORLD frame: the limbs trail the tumbling body */
  const ox=BF[12], oy=BF[13], oz=BF[14];
  for(let k=0;k<4;k++){ const a=tg[k*3], b=tg[k*3+1], c=tg[k*3+2];
    const wx=ox+R[0]*a+R[1]*b+R[2]*c, wy=oy+R[3]*a+R[4]*b+R[5]*c, wz=oz+R[6]*a+R[7]*b+R[8]*c, i=k*3;
    if(!rig.fl0||dt<=0||(Math.abs(rig.fl[i]-wx)+Math.abs(rig.fl[i+1]-wy)+Math.abs(rig.fl[i+2]-wz))>3){ rig.fl[i]=wx; rig.fl[i+1]=wy; rig.fl[i+2]=wz; rig.flv[i]=rig.flv[i+1]=rig.flv[i+2]=0; }
    else { const w=k<2?13:15, z=k<2?0.38:0.46, n=Math.max(1,Math.ceil(dt/0.0083)), h=dt/n;
      for(let s=0;s<n;s++){ const g=[wx,wy,wz]; for(let q=0;q<3;q++){ const a2=w*w*(g[q]-rig.fl[i+q])-2*z*w*rig.flv[i+q]; rig.flv[i+q]+=a2*h; rig.fl[i+q]+=rig.flv[i+q]*h; } } } }
  rig.fl0=true;
  /* back into the body's frame */
  const loc=rig.loc||(rig.loc=new Float64Array(12));
  for(let k=0;k<4;k++){ const dx=rig.fl[k*3]-ox, dy=rig.fl[k*3+1]-oy, dz=rig.fl[k*3+2]-oz; loc[k*3]=BI[0]*dx+BI[1]*dy+BI[2]*dz; loc[k*3+1]=BI[3]*dx+BI[4]*dy+BI[5]*dz; loc[k*3+2]=BI[6]*dx+BI[7]*dy+BI[8]*dz; }
  const o=SKO; o.pitch=spine; o.roll=0; o.hpitch=-spine*0.6+0.1*spread; o.hyaw=0.3*Math.sin(ph*0.7)*spread; o.fwdX=HINT; o.herr=0;
  o.hand[0]=loc[0]; o.hand[1]=loc[1]; o.hand[2]=loc[2]; o.hand[3]=loc[3]; o.hand[4]=loc[4]; o.hand[5]=loc[5];
  o.foot[0]=loc[6]; o.foot[1]=loc[7]; o.foot[2]=loc[8]; o.foot[3]=loc[9]; o.foot[4]=loc[10]; o.foot[5]=loc[11];
  o.toe[0]=o.toe[1]=0.25-0.4*spread; o.toeOut=0.15; o.kneeOut=0.35; o.elbowOut=0.8; o.elbowUp=0.2; o.elbowBack=0.4; o.kneeAim=0; o.elbowAdapt=false; o.shF=0; o.shU=0;
  P[0]=P[1]=P[2]=0;
  body_id(Rp);
  skeleton(P,Rp,o);
  emit(e,out,base);
}
function body_id(R){ R[0]=1; R[1]=0; R[2]=0; R[3]=0; R[4]=1; R[5]=0; R[6]=0; R[7]=0; R[8]=1; }

/* ---------------- milestone 2: a BLEND between two poses (the remount: from walking to the bike into the riding pose; the fall: from riding into the
   tumble), so nothing pops in one frame. blendStart takes the pose the rider showed LAST frame (his row of skinning matrices, still in `out`), expressed in
   the frame of reference of the new pose (the bike, or the crash body): it moves with that frame while it fades. blendStep (after the new pose has been
   written) mixes every bone: rotations by quaternion (nlerp), origins linearly, eased over `dur` seconds. ---------------- */
function m2q(R,q){ const t=R[0]+R[4]+R[8]; let w,x,y,z;
  if(t>0){ const s=Math.sqrt(t+1)*2; w=0.25*s; x=(R[7]-R[5])/s; y=(R[2]-R[6])/s; z=(R[3]-R[1])/s; }
  else if(R[0]>R[4]&&R[0]>R[8]){ const s=Math.sqrt(1+R[0]-R[4]-R[8])*2; w=(R[7]-R[5])/s; x=0.25*s; y=(R[1]+R[3])/s; z=(R[2]+R[6])/s; }
  else if(R[4]>R[8]){ const s=Math.sqrt(1+R[4]-R[0]-R[8])*2; w=(R[2]-R[6])/s; x=(R[1]+R[3])/s; y=0.25*s; z=(R[5]+R[7])/s; }
  else { const s=Math.sqrt(1+R[8]-R[0]-R[4])*2; w=(R[3]-R[1])/s; x=(R[2]+R[6])/s; y=(R[5]+R[7])/s; z=0.25*s; }
  q[0]=w; q[1]=x; q[2]=y; q[3]=z; }
function q2m(q,R){ const w=q[0], x=q[1], y=q[2], z=q[3];
  R[0]=1-2*(y*y+z*z); R[1]=2*(x*y-w*z); R[2]=2*(x*z+w*y); R[3]=2*(x*y+w*z); R[4]=1-2*(x*x+z*z); R[5]=2*(y*z-w*x); R[6]=2*(x*z-w*y); R[7]=2*(y*z+w*x); R[8]=1-2*(x*x+y*y); }
const BQa=new Float64Array(4), BQb=new Float64Array(4), BR=new Float64Array(9), BW2=new Float64Array(9);
/* Bm: the new pose's frame of reference (a column-major 4 x 4: the bike's matrix, or the crash body's) */
export function blendStart(rig,out,base,Bm,dur){
  const bl=rig.bl||(rig.bl={rel:new Float64Array(NB*12),t:0,dur:0.4});
  const ax=[Bm[0],Bm[1],Bm[2]], ay=[Bm[4],Bm[5],Bm[6]], az=[Bm[8],Bm[9],Bm[10]], tx=Bm[12], ty=Bm[13], tz=Bm[14];
  let ok=true;
  for(let b=0;b<NB;b++){ const o=base+b*12, r=REST[b];
    /* the bone's world frame from its skinning matrix: rotation R, origin = M * rest joint */
    const R0=out[o],R1=out[o+1],R2=out[o+2],R3=out[o+4],R4=out[o+5],R5=out[o+6],R6=out[o+8],R7=out[o+9],R8=out[o+10];
    const wx=R0*r[0]+R1*r[1]+R2*r[2]+out[o+3], wy=R3*r[0]+R4*r[1]+R5*r[2]+out[o+7], wz=R6*r[0]+R7*r[1]+R8*r[2]+out[o+11];
    if(!(isFinite(wx)&&isFinite(wy)&&isFinite(wz))||(R0===0&&R4===0&&R8===0)){ ok=false; break; }
    /* into the reference frame: rel R = B^T R, rel o = B^T (o - t) */
    const q=bl.rel, k=b*12, dx=wx-tx, dy=wy-ty, dz=wz-tz;
    q[k]=ax[0]*R0+ax[1]*R3+ax[2]*R6; q[k+1]=ax[0]*R1+ax[1]*R4+ax[2]*R7; q[k+2]=ax[0]*R2+ax[1]*R5+ax[2]*R8;
    q[k+3]=ay[0]*R0+ay[1]*R3+ay[2]*R6; q[k+4]=ay[0]*R1+ay[1]*R4+ay[2]*R7; q[k+5]=ay[0]*R2+ay[1]*R5+ay[2]*R8;
    q[k+6]=az[0]*R0+az[1]*R3+az[2]*R6; q[k+7]=az[0]*R1+az[1]*R4+az[2]*R7; q[k+8]=az[0]*R2+az[1]*R5+az[2]*R8;
    q[k+9]=ax[0]*dx+ax[1]*dy+ax[2]*dz; q[k+10]=ay[0]*dx+ay[1]*dy+ay[2]*dz; q[k+11]=az[0]*dx+az[1]*dy+az[2]*dz; }
  if(!ok){ rig.blOn=false; return; }
  bl.t=0; bl.dur=dur; rig.blOn=true;
}
export function blendStep(rig,out,base,Bm,dt){
  const bl=rig.bl; if(!rig.blOn||!bl) return;
  bl.t+=Math.max(0,dt||0); if(bl.t>=bl.dur){ rig.blOn=false; return; }
  const u=sst(0,1,bl.t/bl.dur), wF=1-u;
  const a00=Bm[0],a10=Bm[1],a20=Bm[2],a01=Bm[4],a11=Bm[5],a21=Bm[6],a02=Bm[8],a12=Bm[9],a22=Bm[10], tx=Bm[12], ty=Bm[13], tz=Bm[14];
  for(let b=0;b<NB;b++){ const o=base+b*12, r=REST[b], q=bl.rel, k=b*12;
    /* the old pose, carried by the reference frame: B * rel */
    for(let c=0;c<3;c++){ const x=q[k+c], y=q[k+3+c], z=q[k+6+c]; BW2[c]=a00*x+a01*y+a02*z; BW2[3+c]=a10*x+a11*y+a12*z; BW2[6+c]=a20*x+a21*y+a22*z; }
    const ox=a00*q[k+9]+a01*q[k+10]+a02*q[k+11]+tx, oy=a10*q[k+9]+a11*q[k+10]+a12*q[k+11]+ty, oz=a20*q[k+9]+a21*q[k+10]+a22*q[k+11]+tz;
    /* the new pose (just written): rotation and origin */
    BR[0]=out[o]; BR[1]=out[o+1]; BR[2]=out[o+2]; BR[3]=out[o+4]; BR[4]=out[o+5]; BR[5]=out[o+6]; BR[6]=out[o+8]; BR[7]=out[o+9]; BR[8]=out[o+10];
    const nx=BR[0]*r[0]+BR[1]*r[1]+BR[2]*r[2]+out[o+3], ny=BR[3]*r[0]+BR[4]*r[1]+BR[5]*r[2]+out[o+7], nz=BR[6]*r[0]+BR[7]*r[1]+BR[8]*r[2]+out[o+11];
    m2q(BW2,BQa); m2q(BR,BQb);
    const dq=BQa[0]*BQb[0]+BQa[1]*BQb[1]+BQa[2]*BQb[2]+BQa[3]*BQb[3], sg=dq<0?-1:1;
    let qw=BQa[0]*wF+BQb[0]*u*sg, qx=BQa[1]*wF+BQb[1]*u*sg, qy=BQa[2]*wF+BQb[2]*u*sg, qz=BQa[3]*wF+BQb[3]*u*sg; const ql=Math.sqrt(qw*qw+qx*qx+qy*qy+qz*qz)||1;
    BQa[0]=qw/ql; BQa[1]=qx/ql; BQa[2]=qy/ql; BQa[3]=qz/ql; q2m(BQa,BR);
    const px=ox*wF+nx*u, py=oy*wF+ny*u, pz=oz*wF+nz*u;
    out[o]=BR[0]; out[o+1]=BR[1]; out[o+2]=BR[2]; out[o+3]=px-(BR[0]*r[0]+BR[1]*r[1]+BR[2]*r[2]);
    out[o+4]=BR[3]; out[o+5]=BR[4]; out[o+6]=BR[5]; out[o+7]=py-(BR[3]*r[0]+BR[4]*r[1]+BR[5]*r[2]);
    out[o+8]=BR[6]; out[o+9]=BR[7]; out[o+10]=BR[8]; out[o+11]=pz-(BR[6]*r[0]+BR[7]*r[1]+BR[8]*r[2]); }
}
/* the bone frames as the last pose left them (tests) */
export function lastFrames(){ return {O:O,RR:RR}; }
export {skeleton,emit,ik2,frameDir,P as _P,SL as _SL,SRr as _SR,HL as _HL,HR as _HR,SKO as _SKO};
