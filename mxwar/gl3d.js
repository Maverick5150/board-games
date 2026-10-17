/* MOTOCROSS WAR 3D — a tiny WebGL renderer written for this game (no library): window.MXWar.GL.
   - A context: WebGL2 first, WebGL1 (+ ANGLE_instanced_arrays) as the fallback; every shader is GLSL ES 1.00, which both run. No VAOs
     (a handful of attributes bound per draw call: ~20 draws a frame), 16-bit indices (every mesh is split under 65536 vertices).
   - Our own matrix code (column-major 4x4 for the camera; instances carry a 3x4 affine "rows" transform: 12 floats).
   - Meshes are built from boxes, tapered boxes, cylinders and spheres with a per-vertex colour and a colour CODE in alpha: 0 = its own
     colour, 1 = x the instance's team colour, 2 = emissive (unlit), 3 = x the instance's accent colour. One instanced draw paints every bike
     part of every rider (team colours per instance).
   - stats(): draw calls and triangles of the last frame (the tests read them). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.GL) return;

/* ---------------- math ---------------- */
function m4(){ var m=new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; }
function mul(o,a,b){
  var a0=a[0],a1=a[1],a2=a[2],a3=a[3],a4=a[4],a5=a[5],a6=a[6],a7=a[7],a8=a[8],a9=a[9],a10=a[10],a11=a[11],a12=a[12],a13=a[13],a14=a[14],a15=a[15];
  for(var i=0;i<4;i++){ var b0=b[i*4],b1=b[i*4+1],b2=b[i*4+2],b3=b[i*4+3];
    o[i*4]=a0*b0+a4*b1+a8*b2+a12*b3; o[i*4+1]=a1*b0+a5*b1+a9*b2+a13*b3; o[i*4+2]=a2*b0+a6*b1+a10*b2+a14*b3; o[i*4+3]=a3*b0+a7*b1+a11*b2+a15*b3; }
  return o;
}
function persp(o,fy,asp,n,f){ var t=1/Math.tan(fy/2), nf=1/(n-f); for(var i=0;i<16;i++) o[i]=0; o[0]=t/asp; o[5]=t; o[10]=(f+n)*nf; o[11]=-1; o[14]=2*f*n*nf; return o; }
function lookAt(o,e,c,u){
  var zx=e[0]-c[0], zy=e[1]-c[1], zz=e[2]-c[2], l=Math.sqrt(zx*zx+zy*zy+zz*zz)||1; zx/=l; zy/=l; zz/=l;
  var xx=u[1]*zz-u[2]*zy, xy=u[2]*zx-u[0]*zz, xz=u[0]*zy-u[1]*zx; l=Math.sqrt(xx*xx+xy*xy+xz*xz)||1; xx/=l; xy/=l; xz/=l;
  var yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
  o[0]=xx; o[1]=yx; o[2]=zx; o[3]=0; o[4]=xy; o[5]=yy; o[6]=zy; o[7]=0; o[8]=xz; o[9]=yz; o[10]=zz; o[11]=0;
  o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]); o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]); o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]); o[15]=1; return o;
}
function inv(o,m){
  var a00=m[0],a01=m[1],a02=m[2],a03=m[3],a10=m[4],a11=m[5],a12=m[6],a13=m[7],a20=m[8],a21=m[9],a22=m[10],a23=m[11],a30=m[12],a31=m[13],a32=m[14],a33=m[15];
  var b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
      b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
  var d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; if(!d) return o; d=1/d;
  o[0]=(a11*b11-a12*b10+a13*b09)*d; o[1]=(a02*b10-a01*b11-a03*b09)*d; o[2]=(a31*b05-a32*b04+a33*b03)*d; o[3]=(a22*b04-a21*b05-a23*b03)*d;
  o[4]=(a12*b08-a10*b11-a13*b07)*d; o[5]=(a00*b11-a02*b08+a03*b07)*d; o[6]=(a32*b02-a30*b05-a33*b01)*d; o[7]=(a20*b05-a22*b02+a23*b01)*d;
  o[8]=(a10*b10-a11*b08+a13*b06)*d; o[9]=(a01*b08-a00*b10-a03*b06)*d; o[10]=(a30*b04-a31*b02+a33*b00)*d; o[11]=(a21*b02-a20*b04-a23*b00)*d;
  o[12]=(a11*b07-a10*b09-a12*b06)*d; o[13]=(a00*b09-a01*b07+a02*b06)*d; o[14]=(a31*b01-a30*b03-a32*b00)*d; o[15]=(a20*b03-a21*b01+a22*b00)*d;
  return o;
}
/* a 3x4 affine transform as rows (12 floats: r0 = [Xx Yx Zx Tx], r1, r2): world = M * (x, y, z, 1). Local axes: X forward, Y up, Z right */
function aff(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0]); }
/* from a forward vector, a roll about it, a pitch already in f, and a position: the bike frame */
function frame(o,px,py,pz,fx,fy,fz,roll){
  var l=Math.sqrt(fx*fx+fy*fy+fz*fz)||1; fx/=l; fy/=l; fz/=l;
  /* right0 = f x up(0,1,0) = (-fz, 0, fx) */
  var rx=-fz, ry=0, rz=fx; l=Math.sqrt(rx*rx+rz*rz)||1; rx/=l; rz/=l;
  /* up0 = right0 x f */
  var ux=ry*fz-rz*fy, uy=rz*fx-rx*fz, uz=rx*fy-ry*fx;
  if(roll){ var c=Math.cos(roll), s=Math.sin(roll), ux2=ux*c+rx*s, uy2=uy*c+ry*s, uz2=uz*c+rz*s; rx=rx*c-ux*s; ry=ry*c-uy*s; rz=rz*c-uz*s; ux=ux2; uy=uy2; uz=uz2; }
  o[0]=fx; o[1]=ux; o[2]=rx; o[3]=px; o[4]=fy; o[5]=uy; o[6]=ry; o[7]=py; o[8]=fz; o[9]=uz; o[10]=rz; o[11]=pz;
  return o;
}
/* o = a * b (3x4 affines) */
function amul(o,a,b){
  var r=o===a||o===b?new Float32Array(12):o;
  for(var i=0;i<3;i++){ var x=a[i*4],y=a[i*4+1],z=a[i*4+2];
    r[i*4]=x*b[0]+y*b[4]+z*b[8]; r[i*4+1]=x*b[1]+y*b[5]+z*b[9]; r[i*4+2]=x*b[2]+y*b[6]+z*b[10]; r[i*4+3]=x*b[3]+y*b[7]+z*b[11]+a[i*4+3]; }
  if(r!==o) o.set(r); return o;
}
/* a local transform: translate (x,y,z), then rotate about Z (pitch, nose up +) and X (roll) and Y (yaw), uniform scale k */
function local(o,x,y,z,pitch,yaw,roll,k){
  k=k==null?1:k; var cp=Math.cos(pitch||0), sp=Math.sin(pitch||0), cy=Math.cos(yaw||0), sy=Math.sin(yaw||0), cr=Math.cos(roll||0), sr=Math.sin(roll||0);
  /* R = Ry(yaw) * Rz(pitch) * Rx(roll) */
  var m00=cp, m01=-sp, m02=0, m10=sp, m11=cp, m12=0, m20=0, m21=0, m22=1;
  /* * Rx(roll) */
  var n01=m01*cr+m02*sr, n02=-m01*sr+m02*cr, n11=m11*cr+m12*sr, n12=-m11*sr+m12*cr, n21=m21*cr+m22*sr, n22=-m21*sr+m22*cr;
  m01=n01; m02=n02; m11=n11; m12=n12; m21=n21; m22=n22;
  /* Ry(yaw) * */
  var q00=cy*m00+sy*m20, q01=cy*m01+sy*m21, q02=cy*m02+sy*m22, q20=-sy*m00+cy*m20, q21=-sy*m01+cy*m21, q22=-sy*m02+cy*m22;
  o[0]=q00*k; o[1]=q01*k; o[2]=q02*k; o[3]=x; o[4]=m10*k; o[5]=m11*k; o[6]=m12*k; o[7]=y; o[8]=q20*k; o[9]=q21*k; o[10]=q22*k; o[11]=z;
  return o;
}

/* ---------------- mesh builder (positions, normals, colour + code) ---------------- */
function Builder(){ this.p=[]; this.n=[]; this.c=[]; this.u=[]; this.m=[]; this.i=[]; this.v=0; }
Builder.prototype.vert=function(x,y,z,nx,ny,nz,r,gg,b,a,u,v,m0,m1,m2,m3){
  this.p.push(x,y,z); this.n.push(nx,ny,nz); this.c.push(r,gg,b,a==null?0:a);
  if(u!=null) this.u.push(u,v); if(m0!=null) this.m.push(m0,m1,m2,m3);
  return this.v++;
};
Builder.prototype.tri=function(a,b,c){ this.i.push(a,b,c); };
Builder.prototype.quad=function(a,b,c,d){ this.i.push(a,b,c,a,c,d); };
/* a flat-shaded quad from 4 points (counter-clockwise seen from the front) */
Builder.prototype.face=function(P,col){
  var ax=P[1][0]-P[0][0], ay=P[1][1]-P[0][1], az=P[1][2]-P[0][2], bx=P[3][0]-P[0][0], by=P[3][1]-P[0][1], bz=P[3][2]-P[0][2];
  var nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx, l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; nx/=l; ny/=l; nz/=l;
  var s=this.v; for(var k=0;k<4;k++) this.vert(P[k][0],P[k][1],P[k][2],nx,ny,nz,col[0],col[1],col[2],col[3]);
  this.quad(s,s+1,s+2,s+3);
};
/* a box between two corners, optionally tapered: the +x end scaled by (ty, tz) in y and z about its centre line */
Builder.prototype.box=function(x0,y0,z0,x1,y1,z1,col,ty,tz){
  ty=ty==null?1:ty; tz=tz==null?1:tz;
  var cy=(y0+y1)/2, cz=(z0+z1)/2, hy=(y1-y0)/2, hz=(z1-z0)/2;
  var A=[[x0,cy-hy,cz-hz],[x0,cy+hy,cz-hz],[x0,cy+hy,cz+hz],[x0,cy-hy,cz+hz]], Bq=[[x1,cy-hy*ty,cz-hz*tz],[x1,cy+hy*ty,cz-hz*tz],[x1,cy+hy*ty,cz+hz*tz],[x1,cy-hy*ty,cz+hz*tz]];
  this.face([A[0],A[3],A[2],A[1]],col); this.face([Bq[0],Bq[1],Bq[2],Bq[3]],col);
  this.face([A[0],A[1],Bq[1],Bq[0]],col); this.face([A[1],A[2],Bq[2],Bq[1]],col);
  this.face([A[2],A[3],Bq[3],Bq[2]],col); this.face([A[3],A[0],Bq[0],Bq[3]],col);
};
/* a beam (box) from point a to point b with a square section w x h (h along the "up" hint) */
Builder.prototype.beam=function(a,b,w,h,col){
  var dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; dx/=L; dy/=L; dz/=L;
  var ux=0, uy=1, uz=0; if(Math.abs(dy)>0.9){ ux=1; uy=0; }
  var sx=dy*uz-dz*uy, sy=dz*ux-dx*uz, sz=dx*uy-dy*ux, l=Math.sqrt(sx*sx+sy*sy+sz*sz)||1; sx/=l; sy/=l; sz/=l;
  var tx=sy*dz-sz*dy, ty=sz*dx-sx*dz, tz=sx*dy-sy*dx;
  var hw=w/2, hh=h/2, P=function(p,i,j){ return [p[0]+sx*i*hw+tx*j*hh, p[1]+sy*i*hw+ty*j*hh, p[2]+sz*i*hw+tz*j*hh]; };
  var a00=P(a,-1,-1),a10=P(a,1,-1),a11=P(a,1,1),a01=P(a,-1,1),b00=P(b,-1,-1),b10=P(b,1,-1),b11=P(b,1,1),b01=P(b,-1,1);
  this.face([a00,a01,a11,a10],col); this.face([b00,b10,b11,b01],col);
  this.face([a00,a10,b10,b00],col); this.face([a10,a11,b11,b10],col); this.face([a11,a01,b01,b11],col); this.face([a01,a00,b00,b01],col);
};
/* a tapered beam: section w0 x h0 at a, w1 x h1 at b */
Builder.prototype.tbeam=function(a,b,w0,h0,w1,h1,col){
  var dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; dx/=L; dy/=L; dz/=L;
  var ux=0, uy=1, uz=0; if(Math.abs(dy)>0.9){ ux=1; uy=0; }
  var sx=dy*uz-dz*uy, sy=dz*ux-dx*uz, sz=dx*uy-dy*ux, l=Math.sqrt(sx*sx+sy*sy+sz*sz)||1; sx/=l; sy/=l; sz/=l;
  var tx=sy*dz-sz*dy, ty=sz*dx-sx*dz, tz=sx*dy-sy*dx;
  function P(p,i,j,w,h){ return [p[0]+sx*i*w/2+tx*j*h/2, p[1]+sy*i*w/2+ty*j*h/2, p[2]+sz*i*w/2+tz*j*h/2]; }
  var a00=P(a,-1,-1,w0,h0),a10=P(a,1,-1,w0,h0),a11=P(a,1,1,w0,h0),a01=P(a,-1,1,w0,h0),b00=P(b,-1,-1,w1,h1),b10=P(b,1,-1,w1,h1),b11=P(b,1,1,w1,h1),b01=P(b,-1,1,w1,h1);
  this.face([a00,a01,a11,a10],col); this.face([b00,b10,b11,b01],col);
  this.face([a00,a10,b10,b00],col); this.face([a10,a11,b11,b10],col); this.face([a11,a01,b01,b11],col); this.face([a01,a00,b00,b01],col);
};
/* a cylinder along Z (a wheel) centred at (cx, cy, cz), radius r, width w, n sides; smooth sides, flat caps */
Builder.prototype.cylZ=function(cx,cy,cz,r,w,n,col,capCol){
  var s=this.v, k, a;
  for(k=0;k<=n;k++){ a=k/n*Math.PI*2; var x=Math.cos(a), y=Math.sin(a);
    this.vert(cx+x*r,cy+y*r,cz-w/2,x,y,0,col[0],col[1],col[2],col[3]); this.vert(cx+x*r,cy+y*r,cz+w/2,x,y,0,col[0],col[1],col[2],col[3]); }
  for(k=0;k<n;k++) this.quad(s+k*2,s+k*2+2,s+k*2+3,s+k*2+1);
  capCol=capCol||col;
  for(var side=-1;side<=1;side+=2){ var c0=this.vert(cx,cy,cz+side*w/2,0,0,side,capCol[0],capCol[1],capCol[2],capCol[3]), b0=this.v;
    for(k=0;k<=n;k++){ a=k/n*Math.PI*2; this.vert(cx+Math.cos(a)*r,cy+Math.sin(a)*r,cz+side*w/2,0,0,side,capCol[0],capCol[1],capCol[2],capCol[3]); }
    for(k=0;k<n;k++){ if(side>0) this.tri(c0,b0+k,b0+k+1); else this.tri(c0,b0+k+1,b0+k); } }
};
/* a cylinder (tube) between two points */
Builder.prototype.tube=function(a,b,r,n,col){
  var dx=b[0]-a[0], dy=b[1]-a[1], dz=b[2]-a[2], L=Math.sqrt(dx*dx+dy*dy+dz*dz)||1; dx/=L; dy/=L; dz/=L;
  var ux=0, uy=1, uz=0; if(Math.abs(dy)>0.9){ ux=1; uy=0; }
  var sx=dy*uz-dz*uy, sy=dz*ux-dx*uz, sz=dx*uy-dy*ux, l=Math.sqrt(sx*sx+sy*sy+sz*sz)||1; sx/=l; sy/=l; sz/=l;
  var tx=sy*dz-sz*dy, ty=sz*dx-sx*dz, tz=sx*dy-sy*dx, s=this.v;
  for(var k=0;k<=n;k++){ var an=k/n*Math.PI*2, c=Math.cos(an), si=Math.sin(an), nx=sx*c+tx*si, ny=sy*c+ty*si, nz=sz*c+tz*si;
    this.vert(a[0]+nx*r,a[1]+ny*r,a[2]+nz*r,nx,ny,nz,col[0],col[1],col[2],col[3]); this.vert(b[0]+nx*r,b[1]+ny*r,b[2]+nz*r,nx,ny,nz,col[0],col[1],col[2],col[3]); }
  for(k=0;k<n;k++) this.quad(s+k*2,s+k*2+1,s+k*2+3,s+k*2+2);
};
/* a low-poly ellipsoid */
Builder.prototype.ball=function(cx,cy,cz,rx,ry,rz,col,seg){
  seg=seg||8; var rings=Math.max(3,seg>>1), s=this.v, i, j;
  for(i=0;i<=rings;i++){ var th=i/rings*Math.PI, st=Math.sin(th), ct=Math.cos(th);
    for(j=0;j<=seg;j++){ var ph=j/seg*Math.PI*2, x=st*Math.cos(ph), z=st*Math.sin(ph);
      this.vert(cx+x*rx,cy+ct*ry,cz+z*rz,x,ct,z,col[0],col[1],col[2],col[3]); } }
  for(i=0;i<rings;i++) for(j=0;j<seg;j++){ var a=s+i*(seg+1)+j, b=a+seg+1; this.quad(a,a+1,b+1,b); }
};
/* apply a 3x4 affine to every vertex added since index v0 (models placed into a static scene) */
Builder.prototype.xform=function(v0,M){
  for(var k=v0;k<this.v;k++){ var x=this.p[k*3],y=this.p[k*3+1],z=this.p[k*3+2], nx=this.n[k*3],ny=this.n[k*3+1],nz=this.n[k*3+2];
    this.p[k*3]=M[0]*x+M[1]*y+M[2]*z+M[3]; this.p[k*3+1]=M[4]*x+M[5]*y+M[6]*z+M[7]; this.p[k*3+2]=M[8]*x+M[9]*y+M[10]*z+M[11];
    var a=M[0]*nx+M[1]*ny+M[2]*nz, b=M[4]*nx+M[5]*ny+M[6]*nz, c=M[8]*nx+M[9]*ny+M[10]*nz, l=Math.sqrt(a*a+b*b+c*c)||1;
    this.n[k*3]=a/l; this.n[k*3+1]=b/l; this.n[k*3+2]=c/l; }
};

/* ---------------- the context ---------------- */
var LIT_VS=[
"attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol;",
"attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iTeam; attribute vec4 iAcc;",
"uniform mat4 uVP;",
"varying vec3 vCol; varying vec3 vNor; varying vec3 vW; varying float vEm; varying float vK;",
"void main(){",
"  vec3 w=vec3(dot(iA.xyz,aPos)+iA.w, dot(iB.xyz,aPos)+iB.w, dot(iC.xyz,aPos)+iC.w);",
"  vNor=vec3(dot(iA.xyz,aNor), dot(iB.xyz,aNor), dot(iC.xyz,aNor));",
"  float k=aCol.a; vec3 c=aCol.rgb;",
"  if(k>0.5&&k<1.5) c*=iTeam.rgb; else if(k>2.5&&k<3.5) c*=iAcc.rgb;",
"  vEm=(k>1.5&&k<2.5)?1.0:0.0; vCol=c; vW=w; vK=k;",
"  gl_Position=uVP*vec4(w,1.0);",
"}"].join("\n");
/* the light (polish pass): a key light, a cooler fill from the other side (a stadium is lit from every side; outdoors the sky bounce), the
   sky / ground ambient, the stadium's pool of light on the floor, specular + rim on the bikes; then the air: a low HAZE of lit dust that
   thickens with distance near the floor (uFogR.z = its density) and the far fog; TONE: a soft shoulder so a white tuff block or a lit
   plate keeps its shading instead of clipping to flat white */
var LIGHT=[
"uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uFill; uniform vec3 uFillCol; uniform vec3 uSky; uniform vec3 uGnd; uniform vec3 uFog; uniform vec3 uHaze; uniform vec3 uFogR; uniform vec3 uCam; uniform vec4 uSpot;",
"vec3 shade(vec3 c, vec3 n, vec3 w, float spec){",
"  float d=max(dot(n,uSun),0.0), d2=max(dot(n,uFill),0.0); vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5);",
"  float sp=uSpot.w>0.0?clamp(1.15-length(w.xz-uSpot.xy)/uSpot.z,0.55,1.0):1.0;",
"  vec3 o=c*(amb+uSunCol*d+uFillCol*d2)*sp;",
"  if(spec>0.0){ vec3 v=normalize(uCam-w); vec3 h=normalize(uSun+v); o+=uSunCol*pow(max(dot(n,h),0.0),28.0)*spec*sp; float rim=pow(1.0-max(dot(n,v),0.0),3.0); o+=(uSky*0.45+c*0.35)*rim*spec; }",
"  return o;",
"}",
"vec3 fog(vec3 c, vec3 w){ float dd=length(uCam-w); float hz=(1.0-exp(-dd*uFogR.z))*(1.0-0.55*clamp(w.y/38.0,0.0,1.0)); c=mix(c,uHaze,hz);",
"  float f=clamp((dd-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0); return mix(c,uFog,f*f*(3.0-2.0*f)); }"].join("\n");
var TONE="uniform float uExpo; vec3 tone(vec3 c){ c*=uExpo; vec3 hi=max(c-0.62,0.0); return min(c-hi+hi/(1.0+hi*1.6),vec3(1.0)); }";
/* colour codes in aCol.a: 0 own colour, 1 x team, 2 emissive, 3 x accent, 4 CROWD (a seat pattern: shirts, heads, empty seats; partly
   self-lit by the house lights; far away it settles to the crowd's mean colour instead of shimmering), 5 LED RIBBON BOARD (panels of
   colour that change every few seconds with a light sweep running along: original, no text or marks), 6 ROOF / TRUSS steel, 7 SUITES (dark
   glass with warm lit windows, some dark) */
var LIT_FS=[
"precision mediump float;", LIGHT, TONE,
"uniform float uTime; uniform sampler2D uNoise;",
"varying vec3 vCol; varying vec3 vNor; varying vec3 vW; varying float vEm; varying float vK;",
"vec4 nz(vec3 p){ return texture2D(uNoise,(p.xz+p.y*vec2(17.0,29.0)+0.5)/64.0); }",
"void main(){ vec3 n=normalize(vNor); vec3 b=vCol; float em=vEm, spec=0.35;",
"  if(vK>4.5&&vK<5.5){ float a=(vW.x+vW.z)*0.5, seg=floor(a/6.0)+floor(uTime*0.18)*5.0, h=nz(vec3(seg,1.0,3.0)).r;",
"    vec3 c1=h<0.3?vec3(0.12,0.38,1.0):h<0.55?vec3(1.0,0.8,0.32):h<0.8?vec3(0.95,0.95,1.0):vec3(1.0,0.28,0.2);",
"    float sweep=smoothstep(0.9,1.0,fract(a*0.02-uTime*0.3)), px=1.0-0.32*(1.0-step(0.3,fract(a*3.0))*step(0.3,fract(vW.y*3.0)))*clamp(1.0-length(uCam-vW)/55.0,0.0,1.0);",
"    b=(c1*px*0.85+sweep*0.5)*vCol; em=1.0; spec=0.0; }",
"  else if(vK>3.5&&vK<4.5){ vec3 cell=floor(vec3(vW.x*2.1,vW.y*2.6,vW.z*2.1)); vec4 hn=nz(cell); float h=hn.r, h2=hn.g;",
"    vec3 hue=0.5+0.5*cos(6.2832*(h+vec3(0.0,0.33,0.67))); vec3 p=mix(vec3(0.4),hue,0.38)*(0.46+0.5*h2);",
"    float head=step(0.62,fract(vW.y*2.6))*step(0.3,h2); p=mix(p,vec3(0.8,0.62,0.5),head*0.5); b=mix(vec3(0.08,0.085,0.11),p,step(0.14,hn.b))*vCol;",
"    b=mix(b,vec3(0.34,0.31,0.32)*vCol,clamp((length(uCam-vW)-30.0)/90.0,0.0,0.72)); em=0.42; spec=0.0; }",
"  else if(vK>6.5){ float a=(vW.x+vW.z)*0.5, cx=floor(a*0.42), wl=step(0.16,fract(a*0.42))*step(0.22,fract(vW.y*0.95))*step(0.12,1.0-fract(vW.y*0.95));",
"    float h=nz(vec3(cx,floor(vW.y*0.95),5.0)).b; b=mix(vec3(0.035,0.04,0.055),vec3(0.95,0.74,0.48)*(0.45+0.55*h),wl*step(0.22,h))*vCol; em=1.0; spec=0.0; }",
"  else if(vK>5.5){ spec=0.12; }",
"  vec3 c=mix(shade(b,n,vW,spec),b,em); gl_FragColor=vec4(tone(fog(c,vW)),1.0); }"].join("\n");
/* the ground: dirt (the code-made texture: ruts and tyre marks along the track), sand, grass; aMat = (grass, groove, tint, sand) */
var DIRT_VS=[
"attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUV; attribute vec4 aMat;",
"uniform mat4 uVP;",
"varying vec3 vW; varying vec3 vNor; varying vec2 vUV; varying vec4 vMat;",
"void main(){ vW=aPos; vNor=aNor; vUV=aUV; vMat=aMat; gl_Position=uVP*vec4(aPos,1.0); }"].join("\n");
/* polish: the packed racing line darker and with a damp sheen under the lights (uWet), loose dry dirt lighter; vMat.z carries the tint
   and the cavity light baked by the scene (the troughs of the whoops and the bottoms of the landings darker, the crests and lips lighter) */
var DIRT_FS=[
"precision mediump float;", LIGHT, TONE,
"uniform sampler2D uTex; uniform vec3 uDirt; uniform vec3 uSand; uniform vec3 uGrass; uniform float uWet;",
"varying vec3 vW; varying vec3 vNor; varying vec2 vUV; varying vec4 vMat;",
"void main(){",
"  vec4 t=texture2D(uTex,vUV); vec4 m=texture2D(uTex,vW.xz*0.031);",
"  float macro=0.8+0.4*m.b, gr=(0.2+0.5*vMat.y)*t.g;",
"  vec3 dirt=uDirt*(0.5+0.95*t.r)*macro; dirt*=1.0-gr; dirt=mix(dirt,dirt*vec3(1.1,1.06,1.0),(1.0-vMat.y)*m.r*0.5);",
"  vec3 sand=uSand*(0.8+0.35*t.r)*macro;",
"  vec3 grass=uGrass*(0.7+0.45*m.r)*(0.8+0.35*m.b)*(0.92+0.16*t.r);",
"  vec3 c=mix(mix(dirt,sand,vMat.w),grass,vMat.x)*vMat.z;",
"  vec3 n=normalize(vNor); vec3 o=shade(c,n,vW,0.0);",
"  vec3 v=normalize(uCam-vW); vec3 h=normalize(uSun+v);",
"  o+=uSunCol*pow(max(dot(n,h),0.0),12.0)*uWet*(0.3+gr*1.8)*(1.0-vMat.x)*(1.0-0.7*vMat.w);",
"  gl_FragColor=vec4(tone(fog(o,vW)),1.0);",
"}"].join("\n");
var SKY_VS=[
"attribute vec2 aXY; uniform mat4 uIVP; varying vec3 vRay;",
"void main(){ vec4 a=uIVP*vec4(aXY,1.0,1.0); vec4 b=uIVP*vec4(aXY,-1.0,1.0); vRay=a.xyz/a.w-b.xyz/b.w; gl_Position=vec4(aXY,0.9999,1.0); }"].join("\n");
var SKY_FS=[
"precision mediump float;", TONE,
"uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; uniform sampler2D uTex; uniform sampler2D uNoise; uniform float uClouds;",
"varying vec3 vRay;",
"void main(){ vec3 r=normalize(vRay); float h=clamp(r.y,0.0,1.0);",
"  vec3 c=mix(uHor,uTop,pow(h,0.55));",
"  float sd=max(dot(r,uSun),0.0); c+=uSunCol*(pow(sd,400.0)*1.6+pow(sd,12.0)*0.22)*(1.0-uNight);",
"  if(uClouds>0.0&&r.y>0.0){ vec2 p=r.xz/(r.y+0.12)*0.16; float n=texture2D(uTex,p).b*0.6+texture2D(uTex,p*2.7).r*0.4;",
"    float cl=smoothstep(0.52,0.78,n)*uClouds*smoothstep(0.0,0.25,r.y); vec3 cc=mix(vec3(0.98,0.97,0.95),vec3(0.7,0.72,0.78),smoothstep(0.6,0.95,n)); c=mix(c,cc,cl*0.85); }",
"  if(uNight>0.0){ c+=vec3(0.06,0.05,0.045)*uNight*(1.0-smoothstep(0.0,0.45,r.y));",
"    vec2 q=floor(r.xz/(r.y+0.3)*260.0); float st=texture2D(uNoise,(q+0.5)/64.0).g; c+=vec3(0.75)*step(0.9965,st)*uNight*smoothstep(0.25,0.5,r.y); }",
"  gl_FragColor=vec4(tone(c),1.0); }"].join("\n");
/* sprites: roost dust (world-size soft discs), labels (fixed pixel size, from the atlas), blob shadows (flat oval decals) */
var PART_VS=[
"attribute vec2 aXY; attribute vec4 iP; attribute vec4 iCol;",
"uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;",
"varying vec2 vXY; varying vec4 vCol;",
"void main(){ vXY=aXY; vCol=iCol; vec3 w=iP.xyz+(uRight*aXY.x+uUp*aXY.y)*iP.w; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var PART_FS=[
"precision mediump float; varying vec2 vXY; varying vec4 vCol; uniform vec3 uFog; uniform float uLit;",
"void main(){ float d=dot(vXY,vXY); if(d>1.0) discard; float a=(1.0-d)*(1.0-d)*vCol.a; gl_FragColor=vec4(vCol.rgb*uLit*a,a); }"].join("\n");
var LABEL_VS=[
"attribute vec2 aXY; attribute vec4 iP; attribute vec4 iUV; attribute vec4 iS;",
"uniform mat4 uVP; uniform vec2 uPx;",
"varying vec2 vUV; varying float vA;",
"void main(){ vec4 c=uVP*vec4(iP.xyz,1.0); vec2 o=vec2(aXY.x*iS.x, aXY.y*iS.y+iS.z)*uPx*c.w*2.0;",
"  vUV=mix(iUV.xy,iUV.zw,aXY*0.5+0.5); vA=iP.w; gl_Position=vec4(c.xy+o,c.z-0.002*c.w,c.w); }"].join("\n");
var LABEL_FS=[
"precision mediump float; uniform sampler2D uAtlas; varying vec2 vUV; varying float vA;",
"void main(){ vec4 t=texture2D(uAtlas,vec2(vUV.x,1.0-vUV.y)); gl_FragColor=vec4(t.rgb*t.a*vA,t.a*vA); }"].join("\n");
var DECAL_VS=[
"attribute vec2 aXY; attribute vec4 iP; attribute vec4 iD; attribute vec4 iN;",
"uniform mat4 uVP; varying vec2 vXY; varying float vA;",
"void main(){ vXY=aXY; vA=iN.w; vec3 f=vec3(iD.x,0.0,iD.y); vec3 n=normalize(iN.xyz); vec3 r=normalize(cross(f,n)); f=cross(n,r);",
"  vec3 w=iP.xyz+f*aXY.x*iD.z+r*aXY.y*iD.w+n*0.05; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var DECAL_FS=[
"precision mediump float; varying vec2 vXY; varying float vA;",
"void main(){ float d=dot(vXY,vXY); if(d>1.0) discard; float a=(1.0-d)*vA; gl_FragColor=vec4(0.0,0.0,0.0,a); }"].join("\n");
/* number plates on the bikes: instanced quads with the bike's transform and an atlas cell */
var PLATE_VS=[
"attribute vec3 aPos; attribute vec2 aUV; attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iUV;",
"uniform mat4 uVP; varying vec2 vUV; varying vec3 vW;",
"void main(){ vec3 w=vec3(dot(iA.xyz,aPos)+iA.w, dot(iB.xyz,aPos)+iB.w, dot(iC.xyz,aPos)+iC.w);",
"  vUV=mix(iUV.xy,iUV.zw,aUV); vW=w; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var PLATE_FS=[
"precision mediump float;", LIGHT, TONE,
"uniform sampler2D uAtlas; varying vec2 vUV; varying vec3 vW;",
"void main(){ vec4 t=texture2D(uAtlas,vec2(vUV.x,1.0-vUV.y)); if(t.a<0.5) discard; gl_FragColor=vec4(tone(fog(t.rgb*(0.5+0.42*(uSky.r+uSunCol.r)),vW)),1.0); }"].join("\n");

function create(canvas,opt){
  opt=opt||{};
  var attrs={antialias:opt.aa!==false,alpha:false,depth:true,stencil:false,premultipliedAlpha:true,preserveDrawingBuffer:!!opt.keep,powerPreference:"high-performance",failIfMajorPerformanceCaveat:false};
  var gl=null, v2=false;
  if(opt.webgl1!==true){ try{ gl=canvas.getContext("webgl2",attrs); v2=!!gl; }catch(e){ gl=null; } }
  if(!gl){ try{ gl=canvas.getContext("webgl",attrs)||canvas.getContext("experimental-webgl",attrs); }catch(e){ gl=null; } }
  if(!gl) return null;
  var inst=null;
  if(v2) inst={div:function(l,d){ gl.vertexAttribDivisor(l,d); },el:function(m,n,t,o,c){ gl.drawElementsInstanced(m,n,t,o,c); },arr:function(m,f,n,c){ gl.drawArraysInstanced(m,f,n,c); }};
  else { var ext=gl.getExtension("ANGLE_instanced_arrays"); if(ext) inst={div:function(l,d){ ext.vertexAttribDivisorANGLE(l,d); },el:function(m,n,t,o,c){ ext.drawElementsInstancedANGLE(m,n,t,o,c); },arr:function(m,f,n,c){ ext.drawArraysInstancedANGLE(m,f,n,c); }}; }
  if(!inst) return null;   /* every WebGL1 device we target has instancing; without it the 2D view takes over */
  var R={gl:gl,v2:v2,inst:inst,draws:0,tris:0,progs:{},maxAttr:gl.getParameter(gl.MAX_VERTEX_ATTRIBS),divs:{},enabled:{}};
  function sh(type,src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)&&!gl.isContextLost()) throw new Error("shader: "+gl.getShaderInfoLog(s)+"\n"+src.slice(0,200)); return s; }
  R.program=function(name,vs,fs){
    var p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,"precision highp float;\n"+vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));
    gl.bindAttribLocation(p,0,vs.indexOf("aPos")>=0?"aPos":"aXY");
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)&&!gl.isContextLost()) throw new Error("link: "+gl.getProgramInfoLog(p));
    var P={p:p,a:{},u:{}}, n=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES), i;
    for(i=0;i<n;i++){ var a=gl.getActiveAttrib(p,i); P.a[a.name]=gl.getAttribLocation(p,a.name); }
    n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(i=0;i<n;i++){ var u=gl.getActiveUniform(p,i); P.u[u.name.replace(/\[0\]$/,"")]=gl.getUniformLocation(p,u.name); }
    R.progs[name]=P; return P;
  };
  R.programs=function(){
    R.program("lit",LIT_VS,LIT_FS); R.program("dirt",DIRT_VS,DIRT_FS); R.program("sky",SKY_VS,SKY_FS);
    R.program("part",PART_VS,PART_FS); R.program("label",LABEL_VS,LABEL_FS); R.program("decal",DECAL_VS,DECAL_FS); R.program("plate",PLATE_VS,PLATE_FS);
  };
  /* a static or dynamic vertex buffer: spec = [[name, size], ...] interleaved floats */
  R.vbuf=function(data,spec,dynamic){
    var b=gl.createBuffer(), stride=0; spec.forEach(function(s){ stride+=s[1]; });
    gl.bindBuffer(gl.ARRAY_BUFFER,b); gl.bufferData(gl.ARRAY_BUFFER,data,dynamic?gl.DYNAMIC_DRAW:gl.STATIC_DRAW);
    return {b:b,spec:spec,stride:stride*4,n:data.length/stride,cap:data.length,dyn:!!dynamic};
  };
  R.update=function(vb,data,count){
    gl.bindBuffer(gl.ARRAY_BUFFER,vb.b);
    if(data.length>vb.cap){ gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW); vb.cap=data.length; }
    else gl.bufferSubData(gl.ARRAY_BUFFER,0,count!=null?data.subarray(0,count*vb.stride/4):data);
    vb.n=count!=null?count:data.length/(vb.stride/4);
  };
  R.ibuf=function(idx){ var b=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,b); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,idx,gl.STATIC_DRAW); return {b:b,n:idx.length}; };
  /* a mesh from a Builder: kind "lit" (pos, nor, col) or "dirt" (pos, nor, uv, mat); split into chunks under 65536 vertices */
  R.mesh=function(B,kind){
    var out=[], idx=B.i, used={}, vmap=null, chunks=[], cur=null;
    if(B.v<65536) chunks.push({vs:null,is:idx});
    else {
      /* split by triangles: each chunk remaps its vertices */
      cur={map:{},vs:[],is:[]};
      for(var t=0;t<idx.length;t+=3){
        if(cur.vs.length>65000){ chunks.push(cur); cur={map:{},vs:[],is:[]}; }
        for(var q=0;q<3;q++){ var v=idx[t+q], m=cur.map[v]; if(m==null){ m=cur.map[v]=cur.vs.length; cur.vs.push(v); } cur.is.push(m); }
      }
      chunks.push(cur);
    }
    chunks.forEach(function(ch){
      var list=ch.vs, n=list?list.length:B.v, stride=kind==="dirt"?12:10, d=new Float32Array(n*stride);
      for(var k=0;k<n;k++){ var v=list?list[k]:k, o=k*stride;
        d[o]=B.p[v*3]; d[o+1]=B.p[v*3+1]; d[o+2]=B.p[v*3+2]; d[o+3]=B.n[v*3]; d[o+4]=B.n[v*3+1]; d[o+5]=B.n[v*3+2];
        if(kind==="dirt"){ d[o+6]=B.u[v*2]; d[o+7]=B.u[v*2+1]; d[o+8]=B.m[v*4]; d[o+9]=B.m[v*4+1]; d[o+10]=B.m[v*4+2]; d[o+11]=B.m[v*4+3]; }
        else { d[o+6]=B.c[v*4]; d[o+7]=B.c[v*4+1]; d[o+8]=B.c[v*4+2]; d[o+9]=B.c[v*4+3]; } }
      var spec=kind==="dirt"?[["aPos",3],["aNor",3],["aUV",2],["aMat",4]]:[["aPos",3],["aNor",3],["aCol",4]];
      out.push({vb:R.vbuf(d,spec,false),ib:R.ibuf(new Uint16Array(ch.vs?ch.is:ch.is)),tris:(ch.vs?ch.is.length:ch.is.length)/3});
    });
    return out;
  };
  R.tex=function(src,o){
    o=o||{}; var t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
    var wrap=o.clamp?gl.CLAMP_TO_EDGE:gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
    if(o.nearest){ gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST); return t; }
    if(o.mip!==false){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    var an=gl.getExtension("EXT_texture_filter_anisotropic")||gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
    if(an&&o.aniso) gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(o.aniso,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  };
  R.retex=function(t,src){ gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src); gl.generateMipmap(gl.TEXTURE_2D); };
  /* bind a vertex buffer's attributes for a program (div = 1 for an instance buffer) */
  function bindAttrs(P,vb,div){
    gl.bindBuffer(gl.ARRAY_BUFFER,vb.b); var off=0;
    vb.spec.forEach(function(s){ var loc=P.a[s[0]];
      if(loc!=null&&loc>=0){ gl.enableVertexAttribArray(loc); R.enabled[loc]=1; gl.vertexAttribPointer(loc,s[1],gl.FLOAT,false,vb.stride,off); if((R.divs[loc]|0)!==div){ inst.div(loc,div); R.divs[loc]=div; } }
      off+=s[1]*4; });
  }
  R.use=function(P){
    if(R.cur!==P){ gl.useProgram(P.p); R.cur=P; }
    for(var l in R.enabled){ gl.disableVertexAttribArray(+l); if(R.divs[l]){ inst.div(+l,0); R.divs[l]=0; } } R.enabled={};
  };
  /* draw a mesh chunk list; ivb = an instance buffer (n instances) or null (the static identity constants for "lit") */
  R.draw=function(P,mesh,ivb,count){
    for(var c=0;c<mesh.length;c++){
      var m=mesh[c];
      R.use(P); bindAttrs(P,m.vb,0);
      if(ivb){ bindAttrs(P,ivb,1); }
      else if(P.a.iA!=null){ gl.vertexAttrib4f(P.a.iA,1,0,0,0); gl.vertexAttrib4f(P.a.iB,0,1,0,0); gl.vertexAttrib4f(P.a.iC,0,0,1,0); if(P.a.iTeam!=null) gl.vertexAttrib4f(P.a.iTeam,1,1,1,1); if(P.a.iAcc!=null) gl.vertexAttrib4f(P.a.iAcc,1,1,1,1); }
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.ib.b);
      var n=ivb?(count!=null?count:ivb.n):1; if(ivb&&!n) continue;
      if(ivb) inst.el(gl.TRIANGLES,m.ib.n,gl.UNSIGNED_SHORT,0,n); else gl.drawElements(gl.TRIANGLES,m.ib.n,gl.UNSIGNED_SHORT,0);
      R.draws++; R.tris+=m.tris*n;
    }
  };
  /* instanced quads (sprites, labels, decals): a shared corner buffer, 4 vertices as a triangle strip */
  R.quadVB=R.vbuf(new Float32Array([-1,-1, 1,-1, -1,1, 1,1]),[["aXY",2]],false);
  R.skyVB=R.vbuf(new Float32Array([-1,-1, 3,-1, -1,3]),[["aXY",2]],false);
  R.quads=function(P,ivb,count){
    if(!count) return; R.use(P); bindAttrs(P,R.quadVB,0); bindAttrs(P,ivb,1);
    inst.arr(gl.TRIANGLE_STRIP,0,4,count); R.draws++; R.tris+=2*count;
  };
  R.sky=function(P){ R.use(P); bindAttrs(P,R.skyVB,0); gl.drawArrays(gl.TRIANGLES,0,3); R.draws++; R.tris++; };
  R.frame=function(){ R.draws=0; R.tris=0; R.cur=null; };
  R.stats=function(){ return {draws:R.draws,tris:R.tris,webgl2:v2}; };
  return R;
}

MX.GL={create:create,Builder:Builder,m4:m4,mul:mul,persp:persp,lookAt:lookAt,inv:inv,aff:aff,frame:frame,amul:amul,local:local};
})(typeof window!=="undefined"?window:globalThis);
