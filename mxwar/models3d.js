/* MOTOCROSS WAR 3D: the MODELS (the CEO, 2026-10-17: "realistic motorcycles, detailed riders, mud-covered tires"). window.MXWar.Models (node:
   module.exports; pure, no DOM). Everything is built in code from lofted shells (superellipse sections), tubes, lathes and boxes: ORIGINAL
   shapes, no logos or marks. Local axes: X forward, Y up, Z right; the bike's origin is on the ground between the wheels.
   - THE BIKE (a 450 in the modern style, 1.48 m wheelbase): in parts that move on their own, one instanced draw each for the whole field:
       body (frame, engine, tank and shrouds, seat, fenders, exhaust, bars), fork (the lowers and the front fender: they slide up the gold
       uppers as the fork compresses), swing (the swingarm, chain and brake: it turns about its pivot), shock (spring and body, spanning the
       frame and the swingarm), wheelF / wheelR (a lathe-turned knobby tyre with tread blocks, rim, spokes, hub, brake disc, sprocket).
   - THE RIDER: torso (jersey, pants, helmet with peak, chin bar, goggles and strap), the arms (upper arm, forearm and glove, by IK to the
       grips), the legs (thigh with knee guard, shin and boot, by IK to the pegs): so he stands in the whoops, sits in the turns, drops his hips
       on a landing and puts a foot out.
   - LEVEL OF DETAIL: LOD 0 is all of the above; LOD 1 and 2 are RIGID bike-and-rider meshes (a standing and a seated pose each) with fewer
       sides and no knobs, spokes or buckles, for the pack at a distance.
   Materials per vertex: (specular, gloss, mud, occlusion); the colour codes of gl3d.js (0 own, 1 team, 3 accent). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Models) return;
var GL=MX.GL||(typeof require==="function"?require("./gl3d.js"):null);
var PI=Math.PI, TAU=PI*2;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function add(a,b){ return [a[0]+b[0],a[1]+b[1],a[2]+b[2]]; }
function sub(a,b){ return [a[0]-b[0],a[1]-b[1],a[2]-b[2]]; }
function mul(a,k){ return [a[0]*k,a[1]*k,a[2]*k]; }
function dot(a,b){ return a[0]*b[0]+a[1]*b[1]+a[2]*b[2]; }
function cross(a,b){ return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]; }
function len(a){ return Math.sqrt(a[0]*a[0]+a[1]*a[1]+a[2]*a[2]); }
function norm(a){ var l=len(a)||1; return [a[0]/l,a[1]/l,a[2]/l]; }
function lerp3(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function sgn(x){ return x<0?-1:1; }

/* palette (authored in display-ish values; the shader squares them) and materials (specular, gloss, mud, occlusion) */
var K={black:[0.06,0.06,0.07,0],dark:[0.14,0.14,0.16,0],steel:[0.46,0.47,0.5,0],silver:[0.58,0.59,0.62,0],alu:[0.5,0.51,0.54,0],gold:[0.8,0.58,0.2,0],
  team:[1,1,1,1],teamD:[0.55,0.55,0.55,1],teamL:[1.0,1.0,1.0,1],acc:[1,1,1,3],white:[0.93,0.93,0.91,0],seat:[0.07,0.07,0.075,0],tire:[0.05,0.05,0.055,0],
  boot:[0.92,0.92,0.9,0],bootD:[0.07,0.07,0.08,0],lens:[0.1,0.16,0.3,0],skin:[0.82,0.63,0.5,0],pants:[0.09,0.09,0.11,0],rubber:[0.04,0.04,0.045,0],
  carbon:[0.09,0.09,0.1,0],red:[0.85,0.12,0.12,0],pad:[0.08,0.08,0.09,0]};
var MAT={plastic:[0.6,0.62,0.4,1],metal:[0.7,0.72,0.12,1],cast:[0.55,0.55,0.4,1],gold:[1.0,0.9,0.05,1],rubber:[0.1,0.18,0.55,1],tyre:[0.07,0.14,1.0,1],cloth:[0.05,0.12,0.4,1],
  pants:[0.06,0.12,0.5,1],helmet:[1.0,0.94,0.12,1],lens:[1.0,1.0,0,1],boot:[0.35,0.45,0.9,1],glove:[0.1,0.2,0.3,1],seat:[0.08,0.1,0.25,1],plate:[0.5,0.55,0.3,1],skin:[0.15,0.3,0,1]};
function M(B,m,ao){ B.mat(m[0],m[1],m[2],ao==null?m[3]:ao); }

/* ---- shape helpers ---- */
/* a ring of n points round centre c in the plane spanned by unit vectors b and u, radii rb and ru, superellipse exponent e (2 = ellipse, more = squarer) */
function ringAt(c,b,u,rb,ru,n,e,rot){
  var pts=[], p=2/(e||2);
  for(var k=0;k<n;k++){ var a=k/n*TAU+(rot||0), ca=Math.cos(a), sa=Math.sin(a), px=sgn(ca)*Math.pow(Math.abs(ca),p), py=sgn(sa)*Math.pow(Math.abs(sa),p);
    pts.push([c[0]+b[0]*rb*px+u[0]*ru*py,c[1]+b[1]*rb*px+u[1]*ru*py,c[2]+b[2]*rb*px+u[2]*ru*py]); }
  return pts;
}
/* the section frames of a polyline: b across (hint x tangent), u up */
function framesOf(pts,hint){
  var F=[];
  for(var i=0;i<pts.length;i++){ var t=norm(sub(pts[Math.min(pts.length-1,i+1)],pts[Math.max(0,i-1)])), h=hint||[0,1,0]; if(Math.abs(dot(t,h))>0.93) h=Math.abs(t[0])<0.9?[1,0,0]:[0,0,1];
    var b=norm(cross(t,h)), u=cross(b,t); F.push({b:b,u:u}); }
  return F;
}
/* a loft along a polyline: radii = a number, an array or a function of the index; o = {n, e, ratio (ru/rb), hint, cap0, cap1, cols} */
function tubeLoft(B,pts,radii,col,o){
  o=o||{}; var F=framesOf(pts,o.hint), rings=[], n=o.n||8;
  for(var i=0;i<pts.length;i++){ var r=typeof radii==="number"?radii:typeof radii==="function"?radii(i,pts.length):radii[i], ra=o.ratio==null?1:(typeof o.ratio==="function"?o.ratio(i):o.ratio);
    rings.push(ringAt(pts[i],F[i].b,F[i].u,r,r*ra,n,o.e,o.rot)); }
  return B.loft(rings,col,{cap0:o.cap0,cap1:o.cap1,cols:o.cols});
}
/* a limb from a to b: a short loft with a belly (mid) and ends r0, r1, ratio = depth over width */
function limb(B,a,b,r0,r1,col,o){
  o=o||{}; var N=o.rings||5, pts=[], mid=o.mid==null?1.08:o.mid;
  for(var i=0;i<N;i++){ var t=i/(N-1); pts.push(lerp3(a,b,t)); }
  return tubeLoft(B,pts,function(i){ var t=i/(N-1); return (r0+(r1-r0)*t)*(1+(mid-1)*Math.sin(PI*t)); },col,{n:o.n||8,e:o.e||2.3,ratio:o.ratio||1,hint:o.hint||[0,1,0],cap0:true,cap1:true});
}
/* an annulus at z (a brake disc, a rim lip, a sprocket) facing nz (+1 / -1) */
function disc(B,r0,r1,z,n,col,nz){
  var s=B.v, k; for(k=0;k<=n;k++){ var a=k/n*TAU, c=Math.cos(a), si=Math.sin(a); B.vert(c*r0,si*r0,z,0,0,nz,col[0],col[1],col[2],col[3]); B.vert(c*r1,si*r1,z,0,0,nz,col[0],col[1],col[2],col[3]); }
  for(k=0;k<n;k++) B.quad(s+k*2,s+k*2+1,s+k*2+3,s+k*2+2);
}
/* a lathe about Z of a profile [[r, z], ...] (the wheel's tyre, a hub): n segments; core = [r, z] the centre of the section (the normals face
   away from it; the default is the axis at the section's own z) */
function lathe(B,prof,n,col,core){
  var rings=prof.map(function(p){ var pts=[]; for(var k=0;k<n;k++){ var a=k/n*TAU; pts.push([Math.cos(a)*p[0],Math.sin(a)*p[0],p[1]]); } return pts; });
  var ref=core?function(P){ var l=Math.hypot(P[0],P[1])||1; return [P[0]/l*core[0],P[1]/l*core[0],core[1]]; }:null;
  return B.loft(rings,col,{ref:ref});
}
/* a copy of builder S transformed by the 3x4 affine m, added to B (S is left alone) */
function place(B,S,m){ var v0=B.v; B.add(S); B.xform(v0,m); }
/* a limb segment's frame: X from a to b, Y = the lateral axis x X (never flips), Z = X x Y (as race3d seg) */
function seg(o,ax,ay,az,bx,by,bz){
  var X0=bx-ax, X1=by-ay, X2=bz-az, l=Math.hypot(X0,X1,X2)||1; X0/=l; X1/=l; X2/=l;
  var Y0=-X1, Y1=X0; l=Math.hypot(Y0,Y1)||1; Y0/=l; Y1/=l;
  var Z0=-X2*Y1, Z1=X2*Y0, Z2=X0*Y1-X1*Y0;
  o[0]=X0; o[1]=Y0; o[2]=Z0; o[3]=ax; o[4]=X1; o[5]=Y1; o[6]=Z1; o[7]=ay; o[8]=X2; o[9]=0; o[10]=Z2; o[11]=az; return o;
}
/* two-bone IK: from a to b with bones L1, L2; the middle joint bends toward hint */
function solve2(a,b,L1,L2,hint){
  var d=sub(b,a), dl=len(d)||1e-3, u=mul(d,1/dl), dd=clamp(dl,0.1,L1+L2-0.004), x=(L1*L1-L2*L2+dd*dd)/(2*dd), h=Math.sqrt(Math.max(0,L1*L1-x*x));
  var p=sub(hint,mul(u,dot(hint,u))), pl=len(p)||1; p=mul(p,1/pl);
  return {mid:add(add(a,mul(u,x)),mul(p,h)),end:add(a,mul(u,dd))};
}

/* ---- the dimensions the page shares ---- */
var D={
  WB:0.74,                        /* wheel centres at x = +-0.74 */
  RF:0.36, RR:0.34,               /* front and rear tyre radius */
  HIP:[-0.18,1.02], PEG:[-0.1,0.4], THIGH:0.44, SHIN:0.47, UARM:0.31, FARM:0.30,
  FORK_A:[0.74,0.36], FORK_U:[-0.3517,0.9361],   /* the front axle and the fork's axis (up the fork) */
  PIVOT:[-0.30,0.40], SHOCK_TOP:[-0.19,0.88], SHOCK_BOT:[-0.37,0.47],   /* the swingarm's pivot and the shock's two ends */
  GRIP:[0.43,1.13,0.42],          /* a grip (x, y, +z; the left is -z) */
  SHOULDER:[0.17,0.47,0.24]      /* a shoulder in the torso frame (hip pivot), before the pitch */
};

/* ---------------- the wheel ---------------- */
function wheelMesh(lod,rear){
  var B=new GL.Builder(), R=rear?D.RR:D.RF, Ri=R-0.088, w=rear?0.125:0.105, h=w/2, n=lod===0?26:lod===1?16:10;
  /* the tyre: a rounded section, the crown flat, the shoulders rounded */
  M(B,MAT.tyre);
  var tp=[[Ri+0.004,-h*0.55],[Ri+0.026,-h*0.97],[R-0.05,-h],[R-0.02,-h*0.78],[R-0.004,-h*0.42],[R,-h*0.14],[R,h*0.14],[R-0.004,h*0.42],[R-0.02,h*0.78],[R-0.05,h],[Ri+0.026,h*0.97],[Ri+0.004,h*0.55]];
  if(lod>=2) tp=[[Ri+0.01,-h*0.8],[R-0.03,-h],[R,-h*0.3],[R,h*0.3],[R-0.03,h],[Ri+0.01,h*0.8]];
  lathe(B,tp,n,K.tire,[(Ri+R)/2,0]);
  if(lod===0){
    /* the tread blocks: three columns (the middle one offset half a step), each a small proud box standing on the crown */
    var NK=rear?19:18, bl=new GL.Builder(), bs=new GL.Builder(); M(bl,MAT.tyre); M(bs,MAT.tyre);
    bl.box(0,-0.019,-0.0135,0.021,0.019,0.0135,K.tire); bs.box(0,-0.02,-0.012,0.03,0.02,0.012,K.tire);
    var m12=new Float32Array(12), col, i;
    for(col=-1;col<=1;col++) for(i=0;i<NK;i++){
      var a=(i+(col===0?0.5:0))/NK*TAU, z=col*h*0.64, rr=col===0?R-0.004:R-0.02, c=Math.cos(a), s=Math.sin(a);
      var v0=B.v; B.add(col===0?bl:bs);
      /* the block's frame: X radial, Y tangential, Z across */
      m12[0]=c; m12[1]=-s; m12[2]=0; m12[3]=c*rr; m12[4]=s; m12[5]=c; m12[6]=0; m12[7]=s*rr; m12[8]=0; m12[9]=0; m12[10]=1; m12[11]=z;
      B.xform(v0,m12);
    }
    /* rim: a lathe shell and its lips, spokes, hub */
    M(B,MAT.cast);
    var rim=[[Ri-0.022,-0.034],[Ri-0.004,-0.04],[Ri,-0.034],[Ri,0.034],[Ri-0.004,0.04],[Ri-0.022,0.034]];
    lathe(B,rim,n,K.dark,[Ri-0.011,0]);
    M(B,MAT.metal); var NS=16;
    for(i=0;i<NS;i++){ var a2=i/NS*TAU, a3=a2+0.42, zz=(i%2?0.012:-0.012);
      B.beam([Math.cos(a2)*0.045,Math.sin(a2)*0.045,zz*0.4],[Math.cos(a3)*(Ri-0.018),Math.sin(a3)*(Ri-0.018),zz],0.006,0.004,K.silver); }
    M(B,MAT.cast); B.cylZ(0,0,0,0.034,0.1,12,K.alu,K.steel);
    B.cylZ(0,0,0.056,0.02,0.02,10,K.dark);
    /* the brake disc (front: the left; rear: the right) and the rear sprocket (the left) with its teeth */
    M(B,MAT.metal);
    if(!rear){ disc(B,0.058,0.118,-0.052,24,K.steel,-1); disc(B,0.058,0.118,-0.0485,24,K.steel,1); }
    else { disc(B,0.05,0.1,0.052,24,K.steel,1); disc(B,0.05,0.1,0.0485,24,K.steel,-1);
      var spr=new GL.Builder(); M(spr,MAT.metal); for(i=0;i<24;i++){ var q0=i/24*TAU, q1=(i+0.5)/24*TAU; spr.beam([Math.cos(q0)*0.07,Math.sin(q0)*0.07,0],[Math.cos(q1)*0.1,Math.sin(q1)*0.1,0],0.008,0.006,K.steel); }
      var vs=B.v; B.add(spr); var mz=new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,-0.054]); B.xform(vs,mz); }
  } else {
    M(B,MAT.cast); lathe(B,[[Ri,-0.034],[Ri,0.034]],n,K.dark,[0,0]); B.cylZ(0,0,0,0.04,0.09,8,K.alu,K.steel);
    if(lod===1) for(i=0;i<4;i++){ var a4=i/4*PI; B.beam([Math.cos(a4)*Ri*0.95,Math.sin(a4)*Ri*0.95,0],[-Math.cos(a4)*Ri*0.95,-Math.sin(a4)*Ri*0.95,0],0.012,0.008,K.silver); }
  }
  return B;
}

/* ---------------- the bike's body ---------------- */
function bikeBody(lod){
  var B=new GL.Builder(), z, i, nn=lod===0?12:lod===1?8:6;
  /* engine cases, the clutch cover, the cylinder and head */
  M(B,MAT.cast);
  B.box(-0.22,0.30,-0.115,0.15,0.58,0.115,K.steel,0.92,0.92);
  if(lod<2){ B.cylZ(-0.10,0.42,0.12,0.088,0.035,14,K.dark,K.steel); B.cylZ(-0.10,0.42,-0.12,0.07,0.03,12,K.dark,K.steel); }
  limb(B,[-0.0,0.54,0],[0.06,0.80,0],0.082,0.07,K.silver,{n:10,e:2.6,ratio:0.95,hint:[0,0,1]});
  B.box(0.0,0.74,-0.075,0.17,0.84,0.075,K.silver,0.9,0.9);
  /* the frame: twin spars from the head tube over the tank and to the seat, the down tubes and the rear subframe (aluminium) */
  M(B,MAT.metal);
  for(z=-1;z<=1;z+=2){
    tubeLoft(B,[[0.5,0.98,0.05*z],[0.28,0.95,0.11*z],[0.0,0.92,0.12*z],[-0.34,0.9,0.115*z]],0.019,K.alu,{n:nn,e:2.8,ratio:1.4,cap0:true,cap1:true});
    tubeLoft(B,[[0.5,0.96,0.05*z],[0.44,0.62,0.1*z],[0.28,0.38,0.095*z]],0.017,K.alu,{n:nn,cap0:true,cap1:true});
    tubeLoft(B,[[-0.34,0.9,0.115*z],[-0.62,0.93,0.09*z],[-0.85,0.92,0.075*z]],0.015,K.alu,{n:nn,cap0:true,cap1:true});
    tubeLoft(B,[[-0.2,0.42,0.1*z],[-0.34,0.7,0.115*z],[-0.36,0.88,0.115*z]],0.016,K.alu,{n:nn,cap0:true,cap1:true});
  }
  /* the head tube, the triple clamps, the fork's gold uppers, the bars and their guards */
  M(B,MAT.cast);
  tubeLoft(B,[[0.5,1.0,0],[0.5,0.9,0]],0.034,K.dark,{n:nn,cap0:true,cap1:true,ratio:1.1});
  B.box(0.41,1.06,-0.115,0.53,1.095,0.115,K.dark,1,0.96); B.box(0.46,0.9,-0.108,0.58,0.935,0.108,K.dark,1,0.96);
  M(B,MAT.gold);
  var A=D.FORK_A, U=D.FORK_U;
  for(z=-1;z<=1;z+=2){ var top=add(A,mul(U,0.77)), bot=add(A,mul(U,0.40)); top=[top[0],top[1],0.087*z]; bot=[bot[0],bot[1],0.087*z]; tubeLoft(B,[top,bot],0.0235,K.gold,{n:nn,cap0:true,cap1:true}); }
  M(B,MAT.rubber);
  tubeLoft(B,[[0.47,1.14,-0.44],[0.45,1.135,-0.2],[0.45,1.135,0.2],[0.47,1.14,0.44]],0.0125,K.dark,{n:8,cap0:true,cap1:true});
  for(z=-1;z<=1;z+=2){ tubeLoft(B,[[0.47,1.14,0.33*z],[0.48,1.14,0.45*z]],0.019,K.rubber,{n:8,cap0:true,cap1:true});
    B.box(0.5,1.105,0.2*z,0.58,1.12,0.205*z,K.dark); if(lod<2) B.box(0.43,1.15,0.34*z,0.5,1.165,0.4*z,K.black);
    if(lod<2) tubeLoft(B,[[0.5,1.146,0.43*z],[0.58,1.1,0.4*z]],0.006,K.silver,{n:5,cap0:true,cap1:true}); }
  M(B,MAT.plastic); B.box(0.44,1.15,-0.16,0.52,1.19,0.16,K.pad,0.9,0.9);   /* the bar pad */
  /* tank and shrouds: team plastic. The tank is a loft along X; the radiator shrouds flare out and forward on each side */
  M(B,MAT.plastic);
  var tx=[0.54,0.46,0.34,0.2,0.1], tw=[0.075,0.105,0.135,0.15,0.135], th=[0.045,0.075,0.085,0.075,0.05], tyc=[0.97,0.98,0.97,0.945,0.93], tp=[];
  for(i=0;i<tx.length;i++) tp.push([tx[i],tyc[i],0]);
  tubeLoft(B,tp,function(i){ return tw[i]; },K.team,{n:nn+2,e:2.6,ratio:function(i){ return th[i]/tw[i]; },hint:[0,1,0],cap0:true,cap1:true});
  for(z=-1;z<=1;z+=2){
    var sp=[[0.58,0.86,0.14*z],[0.46,0.88,0.2*z],[0.3,0.88,0.215*z],[0.14,0.86,0.2*z]];
    tubeLoft(B,sp,function(i){ return [0.05,0.075,0.085,0.06][i]; },K.team,{n:nn,e:2.4,ratio:function(i){ return [1.4,1.55,1.6,1.4][i]; },hint:[0,1,0],cap0:true,cap1:true});
    /* the accent stripe on the shroud */
    if(lod<2){ M(B,MAT.plastic); tubeLoft(B,[[0.55,0.93,0.15*z],[0.42,0.95,0.215*z],[0.26,0.94,0.235*z]],0.012,K.acc,{n:6,e:2.4,ratio:0.6,cap0:true,cap1:true}); M(B,MAT.plastic); }
    /* the side panel / airbox cover, rising to the rear fender */
    tubeLoft(B,[[-0.02,0.76,0.14*z],[-0.26,0.8,0.15*z],[-0.52,0.86,0.14*z]],function(i){ return [0.022,0.026,0.02][i]; },K.team,{n:nn,e:2.8,ratio:function(i){ return [5.2,5.4,3.6][i]; },hint:[0,1,0],cap0:true,cap1:true});
  }
  /* the seat and the rear fender / tail */
  M(B,MAT.seat);
  tubeLoft(B,[[0.24,0.975,0],[0.02,0.97,0],[-0.3,0.965,0],[-0.62,0.955,0]],function(i){ return [0.085,0.125,0.14,0.115][i]; },K.seat,{n:nn+2,e:3,ratio:function(i){ return [0.35,0.36,0.34,0.3][i]; },hint:[0,1,0],cap0:true,cap1:true});
  M(B,MAT.plastic);
  tubeLoft(B,[[-0.6,0.935,0],[-0.78,0.925,0],[-0.93,0.915,0],[-1.03,0.925,0]],function(i){ return [0.115,0.095,0.075,0.06][i]; },K.team,{n:nn,e:2.4,ratio:function(i){ return [0.28,0.26,0.26,0.28][i]; },hint:[0,1,0],cap0:true,cap1:true});
  if(lod<2){ M(B,MAT.plastic); B.box(-1.05,0.9,-0.04,-1.025,0.93,0.04,K.red,1,1); }
  /* the exhaust: the header round the front of the cylinder, the mid-pipe's bulge, the silencer with its carbon cap (right side) */
  M(B,MAT.metal);
  tubeLoft(B,[[0.17,0.66,0.04],[0.28,0.6,0.12],[0.25,0.5,0.19],[0.06,0.46,0.215],[-0.18,0.55,0.225],[-0.4,0.7,0.215]],function(i){ return [0.021,0.021,0.022,0.032,0.044,0.04][i]; },K.steel,{n:nn,cap0:true});
  tubeLoft(B,[[-0.4,0.7,0.215],[-0.62,0.79,0.2],[-0.9,0.88,0.185],[-0.99,0.905,0.18]],function(i){ return [0.04,0.052,0.053,0.05][i]; },K.silver,{n:nn+2,cap0:true});
  M(B,MAT.cast); tubeLoft(B,[[-0.985,0.903,0.18],[-1.02,0.911,0.178]],0.046,K.carbon,{n:nn+2,cap0:true,cap1:true});
  M(B,MAT.metal);
  /* footpegs, the skid plate, the brake and clutch levers */
  for(z=-1;z<=1;z+=2){ B.box(-0.14,0.385,0.195*z-0.04,-0.06,0.41,0.195*z+0.04,K.steel); B.box(-0.14,0.385,0.14*z-0.02,-0.06,0.41,0.2*z+0.02,K.steel,1,1); }
  B.box(-0.2,0.275,-0.09,0.14,0.31,0.09,K.alu,1,0.9);
  /* the rear brake cylinder, the chain guide, the rear tail light */
  if(lod<2){ M(B,MAT.cast); B.box(-0.74,0.5,0.075,-0.6,0.55,0.11,K.dark); B.box(-0.8,0.42,-0.11,-0.5,0.44,-0.085,K.dark); }
  return B;
}
/* the fork's lowers and the front fender: they slide up the uppers; the model's origin is the front axle, its axis up the fork */
function forkMesh(lod){
  var B=new GL.Builder(), z, nn=lod===0?10:8;
  M(B,MAT.cast);
  for(z=-1;z<=1;z+=2) tubeLoft(B,[[0,0,0.087*z],[D.FORK_U[0]*0.43,D.FORK_U[1]*0.43,0.087*z]],0.031,K.dark,{n:nn,cap0:true,cap1:true});
  /* the axle clamps and the brake caliper (front, left) */
  M(B,MAT.metal); for(z=-1;z<=1;z+=2) B.box(-0.03,-0.03,0.087*z-0.02,0.03,0.03,0.087*z+0.02,K.silver);
  if(lod<2){ M(B,MAT.cast); B.box(-0.055,0.04,-0.1,0.03,0.105,-0.075,K.gold); B.box(0.0,0.08,-0.115,0.05,0.12,-0.1,K.dark); }
  /* the front fender: an arc over the wheel */
  M(B,MAT.plastic);
  var arc=[], rr=0.43, k; for(k=0;k<7;k++){ var a=(150-k*22)*PI/180; arc.push([Math.cos(a)*rr-0.0,Math.sin(a)*rr,0]); }
  tubeLoft(B,arc,function(i){ return 0.062+0.012*Math.sin(i/6*PI); },K.team,{n:nn,e:3,ratio:0.16,cap0:true,cap1:true});
  B.box(-0.03,0.05,-0.1,0.03,0.32,-0.092,K.team,1,1); B.box(-0.03,0.05,0.092,0.03,0.32,0.1,K.team,1,1);
  return B;
}
/* the swingarm with its chain, the brake caliper and the linkage: the origin is the pivot, the arm runs back along -X */
function swingMesh(lod){
  var B=new GL.Builder(), z, nn=lod===0?10:8, P=D.PIVOT, ax=[-D.WB-P[0],0.34-P[1]];
  M(B,MAT.metal);
  for(z=-1;z<=1;z+=2){ tubeLoft(B,[[0,0,0.09*z],[ax[0]*0.5,ax[1]*0.5+0.015,0.095*z],[ax[0],ax[1],0.1*z]],function(i){ return [0.035,0.032,0.024][i]; },K.alu,{n:nn,e:2.6,ratio:function(i){ return [1.4,1.5,1.7][i]; },hint:[0,0,1],cap0:true,cap1:true});
    B.box(ax[0]-0.04,ax[1]-0.03,0.1*z-0.012,ax[0]+0.03,ax[1]+0.03,0.1*z+0.012,K.dark); }
  M(B,MAT.cast); tubeLoft(B,[[ax[0]*0.45,ax[1]*0.45,-0.09],[ax[0]*0.45,ax[1]*0.45,0.09]],0.022,K.alu,{n:8,cap0:true,cap1:true});
  if(lod<2){
    /* the chain on the left: the upper run and the lower, a chain guide slider */
    M(B,MAT.metal); B.beam([0.04,0.0,-0.098],[ax[0],ax[1]+0.098,-0.098],0.012,0.006,K.dark); B.beam([0.04,-0.01,-0.098],[ax[0],ax[1]-0.09,-0.098],0.012,0.006,K.dark);
    M(B,MAT.cast); B.box(ax[0]+0.04,ax[1]-0.12,0.06,ax[0]+0.14,ax[1]-0.06,0.095,K.gold);   /* the brake caliper */
    B.box(-0.09,-0.05,-0.05,0.06,0.02,0.05,K.dark);                                         /* the linkage */
  }
  return B;
}
/* the shock: along +X from 0 (the top mount) to 1 (the bottom); the page stretches it between the two mounts */
function shockMesh(lod){
  var B=new GL.Builder(); M(B,MAT.gold);
  B.mat(1.0,0.9,0.05,1); tubeLoft(B,[[0,0,0],[0.32,0,0],[0.55,0,0]],[0.03,0.03,0.022],K.gold,{n:8,cap0:true,cap1:true});
  M(B,MAT.metal); var nb=lod===0?8:4;
  for(var i=0;i<nb;i++){ var x0=0.16+0.84*i/nb, x1=0.16+0.84*(i+0.62)/nb; tubeLoft(B,[[x0,0,0],[x1,0,0]],0.046,i%2?K.acc:K.teamD,{n:8,cap0:true,cap1:true}); }
  M(B,MAT.cast); B.box(-0.02,-0.03,-0.03,0.04,0.03,0.03,K.dark); B.box(0.95,-0.03,-0.03,1.0,0.03,0.03,K.dark);
  return B;
}

/* ---------------- the rider ---------------- */
/* the torso: jersey (team), pants at the hips, the chest protector's bulk, neck and the helmet with its peak, chin bar, goggles and strap; the
   hip pivot is the origin, the lean baked in; the instance transform adds the live pitch */
function torsoMesh(lod){
  var B=new GL.Builder(), nn=lod===0?14:lod===1?10:8, i, LEAN=0.34, cl=Math.cos(LEAN), sl=Math.sin(LEAN);
  function P(x,y,z){ return [x*cl+y*sl,-x*sl+y*cl,z]; }   /* rotate (x, y) forward by the baked lean about the hip */
  /* pelvis and pants down to the thighs' tops (the thighs are separate limbs): a squarish loft */
  M(B,MAT.pants);
  var rows=[[0.0,0.17,0.12,K.pants],[0.1,0.175,0.125,K.pants],[0.17,0.175,0.128,K.pants],[0.17,0.176,0.129,K.black],[0.215,0.178,0.131,K.black],
    [0.215,0.18,0.131,K.team],[0.3,0.2,0.145,K.team],[0.4,0.235,0.152,K.team],[0.455,0.25,0.15,K.team],[0.455,0.25,0.15,K.acc],[0.5,0.255,0.14,K.acc],[0.55,0.22,0.12,K.acc],
    [0.55,0.22,0.12,K.pad],[0.6,0.1,0.09,K.pad]];
  var Fx=[1,0,0], Fz=[0,0,1];
  var rings=[], cols=[], mats=[];
  rows.forEach(function(r,idx){
    var c=P(0.035*Math.sin(r[0]/0.6*PI),r[0],0), bz=[0,0,1], bx=[cl,-sl,0];
    var rg=[], p=2/2.6; for(var k=0;k<nn;k++){ var a=k/nn*TAU, ca=Math.cos(a), sa=Math.sin(a), px=sgn(ca)*Math.pow(Math.abs(ca),p), pz=sgn(sa)*Math.pow(Math.abs(sa),p);
      var back=px<0?1.0:1.0; rg.push([c[0]+bx[0]*r[2]*px,c[1]+bx[1]*r[2]*px,c[2]+bz[2]*r[1]*pz]); }
    rings.push(rg); cols.push(r[3]);
  });
  /* jersey in the team colour from the waist up, the hips in dark pants; sleeves come from the arm parts */
  M(B,MAT.cloth);
  B.loft(rings,K.team,{cols:cols,cap0:true,cap1:false});
  /* the roost deflector / chest protector: a plate on the front of the chest, a back protector bump */
  if(lod<2){ M(B,MAT.plastic); var cp=P(0.12,0.44,0); B.ball(cp[0],cp[1],cp[2],0.07,0.1,0.2,K.acc,8); }
  /* neck roll and collar */
  M(B,MAT.cloth); var nk=P(0.03,0.6,0), nk2=P(0.06,0.68,0); tubeLoft(B,[[nk[0],nk[1],0],[nk2[0],nk2[1],0]],0.062,K.pad,{n:10,cap0:true,cap1:true});
  /* the helmet: an ellipsoid shell (team colour), a white stripe along the crown, the peak, the chin bar, the goggles and their strap */
  var hc=P(0.075,0.78,0), hr=[0.165,0.15,0.145];
  M(B,MAT.helmet);
  var hr_=[], H=lod===0?12:lod===1?9:7, W=nn;
  for(i=0;i<=H;i++){ var th=i/H*PI, st=Math.sin(th), ct=Math.cos(th), rg2=[]; for(var k2=0;k2<W;k2++){ var ph=k2/W*TAU, x=st*Math.cos(ph), z2=st*Math.sin(ph);
      /* a slightly squashed shell: longer than wide, flatter at the back of the head */
      rg2.push([hc[0]+x*hr[0]*(x<0?0.94:1.0),hc[1]+ct*hr[1],hc[2]+z2*hr[2]]); } hr_.push(rg2); }
  var hcols=hr_.map(function(r,idx){ return (idx>0&&idx<3)?K.acc:K.team; });
  B.loft(hr_.slice(1,H),K.team,{cols:hcols.slice(1,H),cap0:true,cap1:true});
  if(lod<2){
    /* the peak: a wedge on the front of the crown; the chin bar jutting forward below the eye port */
    M(B,MAT.helmet);
    var pk=P(0.2,0.86,0); tubeLoft(B,[[pk[0]-0.03,pk[1]+0.0,0],[pk[0]+0.1,pk[1]+0.045,0],[pk[0]+0.19,pk[1]+0.075,0]],function(i){ return [0.12,0.125,0.115][i]; },K.team,{n:8,e:3,ratio:function(i){ return [0.07,0.05,0.035][i]; },cap0:true,cap1:true});
    var ch0=P(0.19,0.66,0), ch1=P(0.27,0.7,0); tubeLoft(B,[[ch0[0],ch0[1],0],[ch1[0],ch1[1],0]],[0.085,0.075],K.teamD,{n:10,e:2.4,ratio:0.62,cap0:true,cap1:true});
    M(B,MAT.lens);
    /* the goggles: a dark frame, a lens that catches the lights, a strap round the helmet */
    var gc=P(0.205,0.76,0); B.box(gc[0]-0.03,gc[1]-0.045,-0.115,gc[0]+0.04,gc[1]+0.045,0.115,K.black,0.96,0.94);
    B.box(gc[0]+0.035,gc[1]-0.036,-0.1,gc[0]+0.05,gc[1]+0.036,0.1,K.lens,0.97,0.97);
    M(B,MAT.cloth); var sr=[]; for(i=0;i<=20;i++){ var sa2=i/20*TAU, sx=Math.cos(sa2)*0.172, sz=Math.sin(sa2)*0.152; sr.push([hc[0]+sx,hc[1]-0.015,hc[2]+sz]); }
    for(i=0;i<20;i++) B.beam(sr[i],sr[i+1],0.012,0.045,K.acc);
  }
  return B;
}
/* an upper arm (jersey sleeve), a forearm (sleeve, the glove): along +X from 0 to the segment's length */
function upperArmMesh(lod){ var B=new GL.Builder(); M(B,MAT.cloth); limb(B,[0,0,0],[D.UARM,0,0],0.062,0.05,K.team,{n:lod===0?9:7,mid:1.12,ratio:1,rings:4}); M(B,MAT.pads_||MAT.cloth); if(lod<2) B.ball(0,0,0,0.068,0.068,0.068,K.acc,6); return B; }
function foreArmMesh(lod){
  var B=new GL.Builder(); M(B,MAT.cloth); limb(B,[0,0,0],[D.FARM*0.78,0,0],0.05,0.042,K.team,{n:lod===0?9:7,mid:1.1,ratio:1,rings:4});
  M(B,MAT.glove); var gn=lod===0?8:6; limb(B,[D.FARM*0.74,0,0],[D.FARM*1.1,0,0],0.05,0.038,K.acc,{n:gn,mid:1.15,ratio:1.1,rings:3});
  if(lod===0){ M(B,MAT.glove); B.ball(D.FARM*1.12,0,0,0.04,0.034,0.034,K.acc,6); }
  return B;
}
/* a thigh (pants with a knee guard) along +X from the hip to the knee; a shin with the boot: from the knee to the ankle, the boot's foot at the end */
function thighMesh(lod){
  var B=new GL.Builder(); M(B,MAT.pants); limb(B,[0,0,0],[D.THIGH,0,0],0.088,0.066,K.pants,{n:lod===0?10:7,mid:1.1,ratio:1,rings:5});
  M(B,MAT.plastic); if(lod<2){ B.ball(D.THIGH,-0.012,0,0.078,0.08,0.074,K.teamD,7); limb(B,[D.THIGH-0.14,0,0],[D.THIGH+0.04,0,0],0.082,0.075,K.black,{n:8,mid:1.04,rings:3}); }
  /* the team colour stripe down the thigh */
  if(lod===0){ M(B,MAT.pants); B.box(0.04,0.06,-0.014,D.THIGH*0.92,0.09,0.014,K.acc); }
  return B;
}
function shinMesh(lod){
  /* origin = the ankle, X up the shin to the knee; the foot points along -Y (forward, in the segment frame the page builds), the sole below (-X) */
  var B=new GL.Builder(), S=D.SHIN-0.07, nn=lod===0?10:7;
  M(B,MAT.boot);
  limb(B,[-0.03,0,0],[S*0.93,0,0],0.058,0.074,K.boot,{n:nn,mid:1.06,ratio:1.0,rings:4});
  M(B,MAT.boot); tubeLoft(B,[[S*0.93,0,0],[S*0.93+0.045,0,0]],[0.08,0.074],K.bootD,{n:nn,cap0:true,cap1:true});
  tubeLoft(B,[[-0.035,0.045,0],[-0.045,-0.07,0],[-0.05,-0.18,0]],[0.062,0.06,0.048],K.boot,{n:nn,e:2.4,ratio:0.88,hint:[1,0,0],cap0:true,cap1:true});
  M(B,MAT.rubber); B.box(-0.122,-0.19,-0.064,-0.1,0.07,0.064,K.black);
  if(lod===0){ M(B,MAT.boot); for(var i=0;i<3;i++) for(var sd=-1;sd<=1;sd+=2) B.box(0.07+i*0.11,-0.045,0.056*sd-0.007,0.1+i*0.11,0.0,0.056*sd+0.007,K.acc); }
  return B;
}
MAT.pads_=MAT.plastic;

/* ---------------- a standing person (a flagger, a marshal, a photographer): origin at the feet, facing +X ---------------- */
function personMesh(){
  var B=new GL.Builder(), z; M(B,MAT.cloth);
  for(z=-1;z<=1;z+=2){ B.tbeam([0,0.9,0.1*z],[0.02,0.09,0.11*z],0.16,0.17,0.11,0.12,K.dark); B.box(-0.07,0,0.11*z-0.06,0.17,0.09,0.11*z+0.06,K.black); }
  B.tbeam([0,0.86,0],[0,1.44,0],0.36,0.22,0.44,0.25,K.team); B.ball(0,1.42,0,0.12,0.075,0.235,K.team,6);
  M(B,MAT.skin); B.beam([0,1.44,0],[0.01,1.54,0],0.08,0.08,K.skin); B.ball(0.01,1.62,0,0.1,0.12,0.1,K.skin,6);
  M(B,MAT.cloth); B.box(-0.1,1.68,-0.105,0.1,1.76,0.105,K.team); B.box(0.08,1.68,-0.085,0.21,1.7,0.085,K.team);
  B.tbeam([0,1.39,-0.25],[0.05,1.12,-0.29],0.1,0.1,0.085,0.085,K.team); M(B,MAT.skin); B.tbeam([0.05,1.12,-0.29],[0.12,0.9,-0.27],0.085,0.085,0.07,0.07,K.skin);
  M(B,MAT.cloth); B.tbeam([0,1.41,0.25],[0.09,1.63,0.3],0.1,0.1,0.085,0.085,K.team); M(B,MAT.skin); B.tbeam([0.09,1.63,0.3],[0.16,1.86,0.3],0.085,0.085,0.07,0.07,K.skin);
  return B;
}

/* ---------------- the rigid bike-and-rider meshes of the distance levels ---------------- */
/* a bike with its rider in one pose, for LOD 1 (wheels are separate and spin) and LOD 2 (everything baked): stand = 0..1 (seated .. standing) */
function rigid(stand,lod){
  var B=new GL.Builder(), m12=new Float32Array(12), L12=new Float32Array(12), body=bikeBody(lod), st=clamp(stand,0,1);
  place(B,body,[1,0,0,0, 0,1,0,0, 0,0,1,0]);
  /* fork lowers and swing at rest */
  var fk=forkMesh(lod); place(B,fk,[1,0,0,D.FORK_A[0], 0,1,0,D.FORK_A[1], 0,0,1,0]);
  var sw=swingMesh(lod); place(B,sw,[1,0,0,D.PIVOT[0], 0,1,0,D.PIVOT[1], 0,0,1,0]);
  var sk=shockMesh(lod), top=D.SHOCK_TOP, bot=D.SHOCK_BOT, sl=Math.hypot(bot[0]-top[0],bot[1]-top[1]), ux=(bot[0]-top[0])/sl, uy=(bot[1]-top[1])/sl;
  place(B,sk,[ux*sl,-uy,0,top[0], uy*sl,ux,0,top[1], 0,0,1,0]);
  if(lod>=2){ var wf=wheelMesh(2,false), wr=wheelMesh(2,true); place(B,wf,[1,0,0,D.WB, 0,1,0,D.RF, 0,0,1,0]); place(B,wr,[1,0,0,-D.WB, 0,1,0,D.RR, 0,0,1,0]); }
  /* the rider: hips and torso for this pose, arms and legs by IK */
  var hx=D.HIP[0]+0.06*st, hy=D.HIP[1]+0.22*st, pitch=-0.35*st, cp=Math.cos(pitch), sp=Math.sin(pitch);
  var tm=torsoMesh(lod); place(B,tm,[cp,-sp,0,hx, sp,cp,0,hy, 0,0,1,0]);
  var sd, hint;
  for(sd=-1;sd<=1;sd+=2){
    var hip=[hx,hy,0.12*sd], foot=[D.PEG[0]+0.02,D.PEG[1]+0.1,0.17*sd], kn=solve2(hip,foot,D.THIGH,D.SHIN,[1,0.3,0.22*sd]);
    var th=thighMesh(lod); seg(m12,hip[0],hip[1],hip[2],kn.mid[0],kn.mid[1],kn.mid[2]); place(B,th,m12);
    var sh=shinMesh(lod); seg(m12,kn.end[0],kn.end[1],kn.end[2],kn.mid[0],kn.mid[1],kn.mid[2]); place(B,sh,m12);
    var shl=[D.SHOULDER[0]*cp-D.SHOULDER[1]*sp+hx,D.SHOULDER[0]*sp+D.SHOULDER[1]*cp+hy,D.SHOULDER[2]*sd], grip=[D.GRIP[0],D.GRIP[1],D.GRIP[2]*sd];
    var ar=solve2(shl,grip,D.UARM,D.FARM,[0.2,0.6,0.7*sd]);
    var ua=upperArmMesh(lod); seg(m12,shl[0],shl[1],shl[2],ar.mid[0],ar.mid[1],ar.mid[2]); place(B,ua,m12);
    var fa=foreArmMesh(lod); seg(m12,ar.mid[0],ar.mid[1],ar.mid[2],ar.end[0],ar.end[1],ar.end[2]); place(B,fa,m12);
  }
  return B;
}

var API={K:K,MAT:MAT,D:D,solve2:solve2,seg:seg,wheel:wheelMesh,body:bikeBody,fork:forkMesh,swing:swingMesh,shock:shockMesh,torso:torsoMesh,uarm:upperArmMesh,farm:foreArmMesh,thigh:thighMesh,shin:shinMesh,person:personMesh,rigid:rigid,
  tubeLoft:tubeLoft,limb:limb,ringAt:ringAt,place:place};
MX.Models=API;
if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
