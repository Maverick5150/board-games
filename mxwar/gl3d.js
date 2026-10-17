/* MOTOCROSS WAR 3D — a tiny WebGL renderer written for this game (no library): window.MXWar.GL.
   - A context: WebGL2 first, WebGL1 (+ ANGLE_instanced_arrays) as the fallback; every shader is GLSL ES 1.00, which both run. No VAOs
     (a handful of attributes bound per draw call: ~30 draws a frame), 16-bit indices (every mesh is split under 65536 vertices).
   - Our own matrix code (column-major 4x4 for the camera; instances carry a 3x4 affine "rows" transform: 12 floats).
   - Meshes are built from boxes, tapered boxes, cylinders, spheres and LOFTED shells with a per-vertex colour and a colour CODE in alpha:
     0 = its own colour, 1 = x the instance's team colour, 2 = emissive (unlit), 3 = x the instance's accent colour (4-8: the stands' patterns),
     and a MATERIAL (specular, gloss, mud, occlusion) per vertex. One instanced draw paints every bike part of every rider in its team
     colours (iAcc.a = how muddy that bike and rider are).
   - THE LOOK (the CEO's cover, 2026-10-17): lighting is done in LINEAR light with an ACES filmic tone curve; the dirt has tiling normal-map
     detail at three scales and wet / dry patches; bikes and riders have specular plastics, glossy helmets, rubber, cloth wrinkles and mud
     (shaders, per quality level); one shadow map from the key light (depth texture, 5-tap PCF); and an HDR post chain (half-float target,
     MSAA where WebGL2 has it, bloom at 1/4 and 1/8 resolution, a depth-of-field blend, vignette, grain, FXAA) that only runs when the
     quality level asks for it and the device can render to a float target.
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
/* an orthographic box (the shadow map's light camera) */
function ortho(o,l,r,b,t,n,f){ for(var i=0;i<16;i++) o[i]=0; o[0]=2/(r-l); o[5]=2/(t-b); o[10]=-2/(f-n); o[12]=-(r+l)/(r-l); o[13]=-(t+b)/(t-b); o[14]=-(f+n)/(f-n); o[15]=1; return o; }
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

/* ---------------- mesh builder (positions, normals, colour + code, material) ---------------- */
function Builder(){ this.p=[]; this.n=[]; this.c=[]; this.u=[]; this.m=[]; this.q=[]; this.i=[]; this.v=0; this.cm=[0.25,0.35,0,1]; }
/* the material the following vertices get: specular strength, gloss (0 rough .. 1 mirror-like), mud (how much dirt sticks), occlusion (1 = open) */
Builder.prototype.mat=function(spec,gloss,mud,ao){ this.cm=[spec,gloss,mud==null?0:mud,ao==null?1:ao]; return this; };
Builder.prototype.vert=function(x,y,z,nx,ny,nz,r,gg,b,a,u,v,m0,m1,m2,m3){
  this.p.push(x,y,z); this.n.push(nx,ny,nz); this.c.push(r,gg,b,a==null?0:a); var cm=this.cm; this.q.push(cm[0],cm[1],cm[2],cm[3]);
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
/* a LOFT: a smooth shell through a list of rings (each ring = a closed polygon of the same number of points, in 3D), normals from the
   neighbouring rings and points (smooth), optional caps; rings[i] = [[x,y,z], ...]. col = [r,g,b,code]; cols = an optional colour per ring */
Builder.prototype.loft=function(rings,col,o){
  o=o||{}; var R=rings.length, M=rings[0].length, s=this.v, i, j, cols=o.cols, cen=[];
  for(i=0;i<R;i++){ var ax=0, ay=0, az=0; for(j=0;j<M;j++){ ax+=rings[i][j][0]; ay+=rings[i][j][1]; az+=rings[i][j][2]; } cen.push([ax/M,ay/M,az/M]); }
  for(i=0;i<R;i++) for(j=0;j<M;j++){
    var P=rings[i][j], Pu=rings[i][(j+1)%M], Pd=rings[i][(j+M-1)%M], Pn=rings[Math.min(R-1,i+1)][j], Pp=rings[Math.max(0,i-1)][j];
    var tx=Pu[0]-Pd[0], ty=Pu[1]-Pd[1], tz=Pu[2]-Pd[2], sx=Pn[0]-Pp[0], sy=Pn[1]-Pp[1], sz=Pn[2]-Pp[2];
    var nx=ty*sz-tz*sy, ny=tz*sx-tx*sz, nz=tx*sy-ty*sx, l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; nx/=l; ny/=l; nz/=l;
    /* outward: away from the ring's centre */
    var ce=o.ref?o.ref(P):cen[i], ox=P[0]-ce[0], oy=P[1]-ce[1], oz=P[2]-ce[2]; if(nx*ox+ny*oy+nz*oz<0){ nx=-nx; ny=-ny; nz=-nz; }
    if(o.flip){ nx=-nx; ny=-ny; nz=-nz; }
    var c=cols?cols[i]:col; this.vert(P[0],P[1],P[2],nx,ny,nz,c[0],c[1],c[2],c[3]);
  }
  for(i=0;i<R-1;i++) for(j=0;j<M;j++){ var a=s+i*M+j, b=s+i*M+(j+1)%M, c2=s+(i+1)*M+(j+1)%M, d=s+(i+1)*M+j; this.quad(a,b,c2,d); }
  function cap(self,ring,toward,cc){ var cx=0, cy=0, cz=0; for(var q=0;q<M;q++){ cx+=ring[q][0]; cy+=ring[q][1]; cz+=ring[q][2]; } cx/=M; cy/=M; cz/=M;
    var nx=cx-toward[0], ny=cy-toward[1], nz=cz-toward[2], l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; nx/=l; ny/=l; nz/=l;
    var c0=self.vert(cx,cy,cz,nx,ny,nz,cc[0],cc[1],cc[2],cc[3]), b0=self.v; for(q=0;q<M;q++) self.vert(ring[q][0],ring[q][1],ring[q][2],nx,ny,nz,cc[0],cc[1],cc[2],cc[3]);
    for(q=0;q<M;q++) self.tri(c0,b0+q,b0+(q+1)%M); }
  if(o.cap0) cap(this,rings[0],cen[Math.min(1,R-1)],cols?cols[0]:col); if(o.cap1) cap(this,rings[R-1],cen[Math.max(0,R-2)],cols?cols[R-1]:col);
  return s;
};
/* apply a 3x4 affine to every vertex added since index v0 (models placed into a static scene) */
Builder.prototype.xform=function(v0,M){
  for(var k=v0;k<this.v;k++){ var x=this.p[k*3],y=this.p[k*3+1],z=this.p[k*3+2], nx=this.n[k*3],ny=this.n[k*3+1],nz=this.n[k*3+2];
    this.p[k*3]=M[0]*x+M[1]*y+M[2]*z+M[3]; this.p[k*3+1]=M[4]*x+M[5]*y+M[6]*z+M[7]; this.p[k*3+2]=M[8]*x+M[9]*y+M[10]*z+M[11];
    var a=M[0]*nx+M[1]*ny+M[2]*nz, b=M[4]*nx+M[5]*ny+M[6]*nz, c=M[8]*nx+M[9]*ny+M[10]*nz, l=Math.sqrt(a*a+b*b+c*c)||1;
    this.n[k*3]=a/l; this.n[k*3+1]=b/l; this.n[k*3+2]=c/l; }
};
/* append another builder (positions, normals, colours, uv, material, indices) */
Builder.prototype.add=function(Bb){ var o=this.v, k; for(k=0;k<Bb.p.length;k++) this.p.push(Bb.p[k]); for(k=0;k<Bb.n.length;k++) this.n.push(Bb.n[k]); for(k=0;k<Bb.c.length;k++) this.c.push(Bb.c[k]);
  for(k=0;k<Bb.u.length;k++) this.u.push(Bb.u[k]); for(k=0;k<Bb.m.length;k++) this.m.push(Bb.m[k]); for(k=0;k<Bb.q.length;k++) this.q.push(Bb.q[k]); for(k=0;k<Bb.i.length;k++) this.i.push(Bb.i[k]+o); this.v+=Bb.v; return this; };

/* ---------------- shaders ---------------- */
/* The light (all in LINEAR light, tone mapped with an ACES filmic curve at the end): a key light and a rim / back light (the page aims them
   relative to the camera, as a film crew would), the sky / ground ambient, the stadium's pool of light on the floor, the low haze of lit
   dust that thickens with distance near the floor and the far fog. In the HDR path the scene shaders write linear light (x uOut) and the
   DEPTH (alpha) for the post chain; without it they tone map themselves. */
var PREC=["precision mediump float;","#ifdef GL_FRAGMENT_PRECISION_HIGH","#define HP highp","#else","#define HP mediump","#endif"].join("\n");
var LIGHT=[
"uniform vec3 uSun; uniform vec3 uSunCol; uniform vec3 uFill; uniform vec3 uFillCol; uniform vec3 uSky; uniform vec3 uGnd; uniform vec3 uFog; uniform vec3 uHaze; uniform vec3 uFogR; uniform vec3 uCam; uniform vec4 uSpot;",
"uniform float uExpo; uniform float uTM; uniform float uOut; uniform float uFar;",
"vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
"vec3 toneOut(vec3 c){ return sqrt(aces(c*uExpo)); }",
"float pool(vec3 w){ return uSpot.w>0.0?clamp(1.15-length(w.xz-uSpot.xy)/uSpot.z,0.5,1.0):1.0; }",
"vec3 fogIt(vec3 c, vec3 w){ float dd=length(uCam-w); float hz=(1.0-exp(-dd*uFogR.z))*(1.0-0.55*clamp(w.y/38.0,0.0,1.0)); c=mix(c,uHaze,hz);",
"  float f=clamp((dd-uFogR.x)/(uFogR.y-uFogR.x),0.0,1.0); return mix(c,uFog,f*f*(3.0-2.0*f)); }",
"vec4 finalOut(vec3 c, vec3 w){ c=fogIt(c,w); if(uTM>0.5) return vec4(toneOut(c),1.0); return vec4(c*uOut,min(length(uCam-w)/uFar,1.0)); }"].join("\n");
/* the shadow map lookup: five taps (a soft edge), faded near the edge of the map; uShP = (texel, bias, strength, normal offset) */
var SHADOWFN=[
"uniform sampler2D uShadow; uniform HP vec4 uShP;",
"float shadowAt(vec4 sc){",
"  vec3 p=sc.xyz/sc.w*0.5+0.5;",
"  if(p.x<0.01||p.x>0.99||p.y<0.01||p.y>0.99||p.z>0.995) return 1.0;",
"  float d=p.z-uShP.y, t=uShP.x, s=0.0;",
"  s+=step(d,texture2D(uShadow,p.xy).r);",
"  s+=step(d,texture2D(uShadow,p.xy+vec2(t,t*0.4)).r);",
"  s+=step(d,texture2D(uShadow,p.xy+vec2(-t,-t*0.4)).r);",
"  s+=step(d,texture2D(uShadow,p.xy+vec2(-t*0.4,t)).r);",
"  s+=step(d,texture2D(uShadow,p.xy+vec2(t*0.4,-t)).r);",
"  float e=min(min(p.x,1.0-p.x),min(p.y,1.0-p.y));",
"  return mix(1.0,s*0.2,uShP.z*smoothstep(0.01,0.1,e));",
"}"].join("\n");

/* ---- the lit shader: bikes, riders, props, the stands' structure. Colour codes in aCol.a: 0 own colour, 1 x team, 2 emissive, 3 x accent,
   6 steel. Variants by #define: SHADOW (the shadow map), ENV (reflections of the stadium lights on glossy parts), MUD (dirt on the parts) ---- */
var LIT_VS=[
"attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol; attribute vec4 aMat;",
"attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iTeam; attribute vec4 iAcc;",
"uniform mat4 uVP;",
"#ifdef SHADOW",
"uniform mat4 uLVP; uniform vec4 uShP; varying vec4 vSC;",
"#endif",
"varying vec3 vCol; varying vec3 vNor; varying vec3 vW; varying float vEm; varying float vK; varying vec4 vMat; varying vec3 vLoc; varying float vMud;",
"void main(){",
"  vec3 w=vec3(dot(iA.xyz,aPos)+iA.w, dot(iB.xyz,aPos)+iB.w, dot(iC.xyz,aPos)+iC.w);",
"  vec3 nn=vec3(dot(iA.xyz,aNor), dot(iB.xyz,aNor), dot(iC.xyz,aNor));",
"  float k=aCol.a; vec3 c=aCol.rgb;",
"  if(k>0.5&&k<1.5) c*=iTeam.rgb; else if(k>2.5&&k<3.5) c*=iAcc.rgb;",
"  float kc=floor(k+0.5);",
"  vEm=(kc>1.5&&kc<2.5)?1.0:0.0; vCol=(kc<3.5)?c*c:c; vW=w; vK=kc; vNor=nn; vMat=aMat; vLoc=aPos; vMud=iAcc.a;",
"#ifdef SHADOW",
"  vSC=uLVP*vec4(w+normalize(nn)*uShP.w,1.0);",
"#endif",
"  gl_Position=uVP*vec4(w,1.0);",
"}"].join("\n");
var LIT_FS=[
PREC, LIGHT,
"#ifdef SHADOW",
"varying vec4 vSC;", SHADOWFN,
"#endif",
"uniform HP float uTime; uniform sampler2D uSmooth; uniform vec3 uMudCol; uniform vec3 uLDir[4]; uniform vec3 uLCol[4];",
"varying vec3 vCol; varying vec3 vNor; varying HP vec3 vW; varying float vEm; varying float vK; varying vec4 vMat; varying vec3 vLoc; varying float vMud;",
"void main(){",
"  vec3 n=normalize(vNor); vec3 v=normalize(uCam-vW);",
"  vec3 base=vCol; float spec=vMat.x, gl=vMat.y, mk=vMat.z, ao=vMat.w;",
"  vec4 sn=texture2D(uSmooth,fract(vLoc.xz*2.3+vLoc.y*1.7)); vec4 sm=texture2D(uSmooth,fract(vLoc.zy*1.3+vLoc.x*0.9+0.37));",
/* fine wrinkles on matte stuff (cloth, rubber, seat covers) and on plastics a faint orange peel */
"  n=normalize(n+(sn.xyz-0.5)*(0.55*(1.0-gl)*step(spec,0.5)+0.06));",
"#ifdef MUD",
"  float mud=0.0;",
"  if(mk>0.01&&vMud>0.01){ mud=smoothstep(0.38,0.6,mk*vMud*1.3+(sm.g-0.5)*0.95+(sn.b-0.5)*0.35); base=mix(base,uMudCol*(0.7+0.6*sm.b),mud*0.94); spec*=1.0-0.85*mud; gl*=1.0-0.6*mud; n=normalize(n+(sm.rgb-0.5)*0.9*mud); }",
"#endif",
"  float shp=4.0+gl*gl*230.0;",
"  float sh=1.0;",
"#ifdef SHADOW",
"  sh=shadowAt(vSC);",
"#endif",
"  float pl=pool(vW);",
"  float NdL=max(dot(n,uSun),0.0), NdF=max(dot(n,uFill),0.0);",
"  vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5)*ao;",
"  vec3 dif=base*(amb+(uSunCol*NdL*sh+uFillCol*NdF)*pl*(0.55+0.45*ao));",
"  float nv=max(dot(n,v),0.0); float F=0.04+0.96*pow(1.0-nv,5.0);",
"  float nrm=(shp+8.0)*0.0398;",
"  vec3 sp=(uSunCol*pow(max(dot(n,normalize(uSun+v)),0.0),shp)*NdL*sh+uFillCol*pow(max(dot(n,normalize(uFill+v)),0.0),shp)*NdF)*nrm*(0.15+0.85*F)*spec*pl;",
"#ifdef ENV",
"  vec3 r=reflect(-v,n); vec3 e=mix(uGnd,uSky,r.y*0.5+0.5)*0.9;",
"  for(int i=0;i<4;i++) e+=uLCol[i]*pow(max(dot(r,uLDir[i]),0.0),18.0+gl*190.0);",
"  sp+=e*(0.1+0.9*F)*spec*ao*(0.4+0.6*pl);",
"#endif",
"  float rim=pow(1.0-nv,3.0); dif+=base*(uSky*0.7+uFillCol*0.35)*rim*0.55;",
"  vec3 c=mix(dif+sp,base,vEm);",
"  gl_FragColor=finalOut(c,vW);",
"}"].join("\n");

/* ---- the stands: the crowd (seats from above, rows of heads and shoulders from the floor: they bob, wave and flash cameras), the LED
   ribbon boards, the suites. Colour codes: 4 crowd tread, 5 LED board, 7 suites, 8 crowd riser ---- */
var STAND_FS=[
PREC, LIGHT,
"uniform HP float uTime; uniform sampler2D uNoise;",
"varying vec3 vCol; varying vec3 vNor; varying HP vec3 vW; varying float vEm; varying float vK; varying vec4 vMat; varying vec3 vLoc; varying float vMud;",
"vec4 nz(HP vec3 p){ HP vec2 q=fract((p.xz+p.y*vec2(17.0,29.0)+0.5)/64.0); return texture2D(uNoise,q); }",
"HP float along(){ return abs(vNor.x)>abs(vNor.z)?vW.z:vW.x; }",
"vec3 lit(vec3 b, vec3 n){ vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5); return b*(amb+(uSunCol*max(dot(n,uSun),0.0)+uFillCol*max(dot(n,uFill),0.0))*pool(vW)); }",
"void main(){",
"  vec3 n=normalize(vNor); vec3 b=vCol; float em=0.0; vec3 glow=vec3(0.0); float dist=length(uCam-vW);",
"  if(vK>4.5&&vK<5.5){",
/* LED ribbon board: panels of colour that change every few seconds with a light sweep running along (original: no text or marks) */
"    HP float a=along()*0.5; HP float seg=floor(a/6.0)+floor(uTime*0.18)*5.0; float h=nz(vec3(seg,1.0,3.0)).r;",
"    vec3 c1=h<0.3?vec3(0.1,0.34,1.0):h<0.55?vec3(1.0,0.74,0.26):h<0.8?vec3(0.95,0.95,1.0):vec3(1.0,0.24,0.18);",
"    float sweep=smoothstep(0.9,1.0,fract(a*0.02-uTime*0.3)), px=1.0-0.32*(1.0-step(0.3,fract(a*3.0))*step(0.3,fract(vW.y*3.0)))*clamp(1.0-dist/55.0,0.0,1.0);",
"    glow=(c1*c1*px*0.85+sweep*0.7)*2.2*vCol.r; b=vec3(0.0); em=1.0; }",
"  else if(vK>3.5&&vK<4.5){",
/* the seats seen from above: a person in most of them; the odd camera flash */
"    HP vec3 cell=floor(vec3(vW.x*2.1,vW.y*2.6,vW.z*2.1)); vec4 hn=nz(cell); float h=hn.r, h2=hn.g;",
"    vec3 hue=0.5+0.5*cos(6.2832*(h+vec3(0.0,0.33,0.67))); vec3 p=mix(vec3(0.4),hue,0.38)*(0.46+0.5*h2); p*=p;",
"    float head=step(0.62,fract(vW.y*2.6))*step(0.3,h2); p=mix(p,vec3(0.5,0.34,0.26),head*0.5); b=mix(vec3(0.006,0.007,0.011),p,step(0.14,hn.b))*vCol;",
"    b=mix(b,vec3(0.12,0.1,0.1)*vCol,clamp((dist-30.0)/90.0,0.0,0.72));",
"    float fl=step(0.9975,nz(vec3(cell.x,floor(uTime*5.0+hn.r*13.0),cell.z)).g)*step(0.14,hn.b); glow=vec3(3.0,2.9,2.7)*fl*clamp(1.2-dist/160.0,0.0,1.0);",
"    em=0.3; }",
"  else if(vK>7.5){",
/* a row's riser: heads and shoulders, some people bouncing and waving, the odd flash */
"    HP float a=along()*2.15; float fx=fract(a), fy=vCol.g; vec4 hn=nz(vec3(floor(a),3.0,floor(vCol.b*251.0+0.5)));",
"    vec3 hue=0.5+0.5*cos(6.2832*(hn.r+vec3(0.0,0.33,0.67))); vec3 shirt=mix(vec3(0.42),hue,0.45)*(0.5+0.5*hn.g); shirt*=shirt; float occ=step(0.12,hn.b);",
"    float ph=hn.a*6.2832, spd=2.5+hn.r*4.5; float bob=0.045*(0.5+0.5*sin(uTime*spd+ph))*step(0.42,hn.g);",
"    float tor=step(abs(fx-0.5),0.41-0.13*fy)*step(fy,0.6+bob*0.5); vec2 hd=vec2((fx-0.5)*1.25,fy-0.79-bob); float head=step(dot(hd,hd),0.028);",
"    float armsUp=step(0.86,hn.b)*(0.5+0.5*sin(uTime*spd*0.7+ph)); float arm=step(0.42,fy)*step(fy,0.6+0.34*armsUp)*step(abs(abs(fx-0.5)-0.3),0.045)*step(0.86,hn.b);",
"    vec3 p=mix(vec3(0.004,0.0045,0.007),shirt,tor*occ); p=mix(p,vec3(0.6,0.36,0.26)*(0.75+0.3*hn.a),max(head,arm)*occ);",
"    p=mix(p,vec3(0.09,0.08,0.09),clamp((dist-35.0)/90.0,0.0,0.72)); b=p*vCol.r*2.0;",
"    float fl=step(0.9972,nz(vec3(floor(a),floor(uTime*5.5+hn.r*17.0),floor(vCol.b*251.0))).g)*occ; glow=vec3(3.4,3.3,3.0)*fl*head*clamp(1.3-dist/180.0,0.0,1.0);",
"    em=0.34; }",
"  else if(vK>6.5){",
/* suites: dark glass with warm lit windows, some dark */
"    HP float a=along()*0.5; HP float cx=floor(a*0.42); float wl=step(0.16,fract(a*0.42))*step(0.22,fract(vW.y*0.95))*step(0.12,1.0-fract(vW.y*0.95));",
"    float h=nz(vec3(cx,floor(vW.y*0.95),5.0)).b; b=vec3(0.002,0.0025,0.005); glow=vec3(0.95,0.7,0.42)*(0.45+0.55*h)*wl*step(0.22+0.5*(1.0-vCol.g),h)*1.9*vCol.r; em=1.0; }",
"  vec3 c=em>0.9?glow:mix(lit(b,n),b*1.6,em)+glow;",
"  gl_FragColor=finalOut(c,vW);",
"}"].join("\n");

/* ---- the ground: dirt (strip texture: ruts and tread marks along the track; tiling detail normal maps at two scales in world space), sand,
   grass; aMat = (grass, groove, tint, sand). Wet patches shine under the lights, loose dry dirt is pale and matte ---- */
var DIRT_VS=[
"attribute vec3 aPos; attribute vec3 aNor; attribute vec2 aUV; attribute vec4 aMat;",
"uniform mat4 uVP;",
"#ifdef SHADOW",
"uniform mat4 uLVP; uniform vec4 uShP; varying vec4 vSC;",
"#endif",
"varying vec3 vW; varying vec3 vNor; varying vec2 vUV; varying vec4 vMat;",
"void main(){ vW=aPos; vNor=aNor; vUV=aUV; vMat=aMat;",
"#ifdef SHADOW",
"  vSC=uLVP*vec4(aPos+aNor*uShP.w,1.0);",
"#endif",
"  gl_Position=uVP*vec4(aPos,1.0); }"].join("\n");
var DIRT_FS=[
PREC, LIGHT,
"#ifdef SHADOW",
"varying vec4 vSC;", SHADOWFN,
"#endif",
"uniform sampler2D uTex; uniform sampler2D uDetA; uniform sampler2D uDetB; uniform vec3 uDirt; uniform vec3 uSand; uniform vec3 uGrass; uniform float uWet; uniform vec3 uDetK;",
"varying HP vec3 vW; varying vec3 vNor; varying HP vec2 vUV; varying vec4 vMat;",
"void main(){",
"  vec4 t=texture2D(uTex,vUV); vec4 m=texture2D(uTex,vW.xz*0.031);",
"  float dist=length(uCam-vW);",
"  vec3 n=normalize(vNor); float gr=vMat.x;",
"  vec4 dA=vec4(0.5,0.5,0.5,0.5), dB=dA;",
"#ifdef DETAIL",
"  dA=texture2D(uDetA,vW.xz*uDetK.x); dB=texture2D(uDetB,vW.xz*uDetK.y+17.3);",
"  float fa=1.0-smoothstep(16.0,80.0,dist), fb=1.0-smoothstep(4.0,24.0,dist);",
"  vec2 sl=(dA.xy-0.5)*1.8*fa+(dB.xy-0.5)*1.5*fb; n=normalize(n+vec3(sl.x,0.0,sl.y)*(1.0-0.6*gr));",
"#endif",
/* albedo: a macro pattern, the detail layers, the ruts darker and damper; the racing line packed down */
"  float groove=vMat.y*t.g;",
"  float moist=clamp(uWet+groove*0.55+(m.r-0.5)*0.5+(1.0-vMat.z)*0.25,0.0,1.0);",
"  float bv=(0.5+0.9*t.r)*(0.78+0.44*m.b)*(0.72+0.56*dA.a)*(0.82+0.36*dB.a);",
"  vec3 dirt=uDirt*uDirt*bv; dirt*=1.0-0.5*groove-0.3*moist; dirt*=1.0-0.28*t.a*groove;",
"  dirt=mix(dirt,dirt*vec3(1.22,1.1,0.95),(1.0-vMat.y)*m.r*0.45);",
"  vec3 sand=uSand*uSand*(0.7+0.5*t.r)*(0.78+0.44*m.b)*(0.85+0.3*dA.a);",
"  vec3 grass=uGrass*uGrass*(0.7+0.45*m.r)*(0.8+0.35*m.b)*(0.9+0.3*dA.a)*(0.92+0.16*t.r);",
"  vec3 c=mix(mix(dirt,sand,vMat.w),grass,gr)*vMat.z;",
"  float sh=1.0;",
"#ifdef SHADOW",
"  sh=shadowAt(vSC);",
"#endif",
"  float pl=pool(vW);",
"  float NdL=max(dot(n,uSun),0.0), NdF=max(dot(n,uFill),0.0);",
"  vec3 amb=mix(uGnd,uSky,n.y*0.5+0.5);",
"  vec3 o=c*(amb+(uSunCol*NdL*sh+uFillCol*NdF)*pl);",
"  vec3 v=normalize(uCam-vW); float nv=max(dot(n,v),0.0);",
"  float spec=moist*(1.0-gr)*(1.0-0.7*vMat.w); float shp=14.0+moist*70.0;",
"  float F=0.04+0.96*pow(1.0-nv,5.0);",
"  vec3 sp=(uSunCol*pow(max(dot(n,normalize(uSun+v)),0.0),shp)*NdL*sh+uFillCol*pow(max(dot(n,normalize(uFill+v)),0.0),shp)*NdF)*(shp+8.0)*0.0398*(0.2+0.8*F)*spec*0.55*pl;",
"  o+=sp;",
/* grazing light (the crests of the whoops and the berms facing the lights glow) */
"  o+=c*uFillCol*pow(1.0-nv,2.5)*0.35*(1.0-gr);",
"  gl_FragColor=finalOut(o,vW);",
"}"].join("\n");

/* ---- the sky: the night's gradient with the glow of the city, stars, or the day's sky with clouds ---- */
var SKY_VS=[
"attribute vec2 aXY; uniform mat4 uIVP; varying vec3 vRay;",
"void main(){ vec4 a=uIVP*vec4(aXY,1.0,1.0); vec4 b=uIVP*vec4(aXY,-1.0,1.0); vRay=a.xyz/a.w-b.xyz/b.w; gl_Position=vec4(aXY,0.9999,1.0); }"].join("\n");
var SKY_FS=[
PREC,
"uniform float uExpo; uniform float uTM; uniform float uOut;",
"vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
"uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunCol; uniform float uNight; uniform sampler2D uTex; uniform sampler2D uNoise; uniform float uClouds;",
"varying HP vec3 vRay;",
"void main(){ HP vec3 r=normalize(vRay); float h=clamp(r.y,0.0,1.0);",
"  vec3 c=mix(uHor*uHor,uTop*uTop,pow(h,0.55));",
"  float sd=max(dot(r,uSun),0.0); c+=uSunCol*(pow(sd,400.0)*2.4+pow(sd,12.0)*0.3)*(1.0-uNight);",
"  if(uClouds>0.0&&r.y>0.0){ vec2 p=r.xz/(r.y+0.12)*0.16; float n=texture2D(uTex,p).b*0.6+texture2D(uTex,p*2.7).r*0.4;",
"    float cl=smoothstep(0.52,0.78,n)*uClouds*smoothstep(0.0,0.25,r.y); vec3 cc=mix(vec3(0.95,0.94,0.9),vec3(0.5,0.52,0.6),smoothstep(0.6,0.95,n)); c=mix(c,cc,cl*0.85); }",
"  if(uNight>0.0){ c+=vec3(0.3,0.16,0.07)*0.34*uNight*(1.0-smoothstep(0.0,0.5,r.y))*(1.0-smoothstep(0.0,0.1,-r.y));",
"    HP vec2 q=floor(r.xz/(r.y+0.3)*260.0); HP vec2 qn=fract((q+0.5)/64.0); float st=texture2D(uNoise,qn).g; c+=vec3(0.9,0.95,1.1)*step(0.9985,st)*uNight*smoothstep(0.25,0.5,r.y)*1.1; }",
"  gl_FragColor=(uTM>0.5)?vec4(sqrt(aces(c*uExpo)),1.0):vec4(c*uOut,1.0); }"].join("\n");

/* ---- sprites. DUST: soft billboards, lit by the lights (backlit dust glows), world size. CLUMPS: flying dirt, small lit pellets stretched
   along their velocity on screen. GLOW: additive star-burst flares for the floodlights. LABELS: fixed pixel size from the atlas. BLOB
   SHADOWS: flat oval decals. ---- */
var PART_VS=[
"attribute vec2 aXY; attribute vec4 iP; attribute vec4 iCol;",
"uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;",
"varying vec2 vXY; varying vec4 vCol; varying vec3 vW;",
"void main(){ vXY=aXY; vCol=iCol; vec3 w=iP.xyz+(uRight*aXY.x+uUp*aXY.y)*iP.w; vW=w; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var PART_FS=[
PREC,
"uniform vec3 uLitCol; uniform float uExpo; uniform float uTM; uniform float uOut; uniform sampler2D uSmooth;",
"vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
"varying vec2 vXY; varying vec4 vCol; varying vec3 vW;",
"void main(){ float d=dot(vXY,vXY); if(d>1.0) discard;",
"  vec4 sn=texture2D(uSmooth,vXY*0.31+0.5+vCol.a*0.37+vW.xz*0.013); float a=(1.0-d); a*=a; a*=0.35+1.1*sn.r; a=clamp(a,0.0,1.0)*vCol.a;",
"  vec3 c=vCol.rgb*uLitCol*(0.7+0.5*sn.g);",
"  gl_FragColor=(uTM>0.5)?vec4(sqrt(aces(c*uExpo))*a,a):vec4(c*uOut*a,a); }"].join("\n");
var CLUMP_VS=[
"attribute vec2 aXY; attribute vec4 iP; attribute vec4 iCol; attribute vec4 iV;",
"uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;",
"varying vec2 vXY; varying vec4 vCol; varying vec2 vDir;",
"void main(){ vXY=aXY; vCol=iCol; vec2 vv=vec2(dot(iV.xyz,uRight),dot(iV.xyz,uUp)); float sp=length(vv); vec2 dir=sp>0.05?vv/sp:vec2(1.0,0.0); vDir=dir;",
"  float st=1.0+min(sp*iV.w,3.0); vec2 q=vec2(aXY.x*st,aXY.y); vec2 o=dir*q.x+vec2(-dir.y,dir.x)*q.y;",
"  vec3 w=iP.xyz+(uRight*o.x+uUp*o.y)*iP.w; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var CLUMP_FS=[
PREC,
"uniform vec3 uLitCol; uniform vec3 uKeyScr; uniform float uExpo; uniform float uTM; uniform float uOut;",
"vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
"varying vec2 vXY; varying vec4 vCol; varying vec2 vDir;",
"void main(){ vec2 q=vec2(dot(vXY,vDir),dot(vXY,vec2(-vDir.y,vDir.x))); float d=dot(q,q); if(d>1.0) discard;",
"  vec3 nn=vec3(vXY*0.8,sqrt(max(0.05,1.0-d*0.8))); nn=normalize(nn); float dl=max(dot(nn,uKeyScr),0.0);",
"  vec3 c=vCol.rgb*(0.25+uLitCol*(0.35+1.3*dl))+vec3(0.9,0.75,0.55)*pow(max(dot(nn,normalize(uKeyScr+vec3(0.0,0.0,1.0))),0.0),24.0)*0.18;",
"  float a=vCol.a*(1.0-smoothstep(0.85,1.0,d));",
"  gl_FragColor=(uTM>0.5)?vec4(sqrt(aces(c*uExpo))*a,a):vec4(c*uOut*a,a); }"].join("\n");
var GLOW_VS=[
"attribute vec2 aXY; attribute vec4 iP; attribute vec4 iCol;",
"uniform mat4 uVP; uniform vec3 uRight; uniform vec3 uUp;",
"varying vec2 vXY; varying vec4 vCol;",
"void main(){ vXY=aXY; vCol=iCol; vec3 w=iP.xyz+(uRight*aXY.x+uUp*aXY.y)*iP.w; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var GLOW_FS=[
PREC,
"uniform float uExpo; uniform float uTM; uniform float uOut;",
"vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
"varying vec2 vXY; varying vec4 vCol;",
"void main(){ float r=length(vXY); if(r>1.0) discard;",
"  float core=exp(-r*r*18.0)+0.35*exp(-r*5.0);",
"  vec2 a=abs(vXY); float s1=exp(-a.x*22.0)*exp(-a.y*2.2)+exp(-a.y*22.0)*exp(-a.x*2.2);",
"  vec2 d=vec2(vXY.x+vXY.y,vXY.x-vXY.y)*0.7071; vec2 ad=abs(d); float s2=exp(-ad.x*30.0)*exp(-ad.y*3.2)+exp(-ad.y*30.0)*exp(-ad.x*3.2);",
"  float f=(core+0.55*s1+0.3*s2)*(1.0-r*r); vec3 c=vCol.rgb*f*vCol.a;",
"  gl_FragColor=(uTM>0.5)?vec4(sqrt(aces(c*uExpo)),0.0):vec4(c*uOut,0.0); }"].join("\n");
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
/* number plates on the bikes: instanced quads with the bike's transform and an atlas cell, lit like the bike */
var PLATE_VS=[
"attribute vec3 aPos; attribute vec2 aUV; attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; attribute vec4 iUV;",
"uniform mat4 uVP; varying vec2 vUV; varying vec3 vW; varying vec3 vNor;",
"void main(){ vec3 w=vec3(dot(iA.xyz,aPos)+iA.w, dot(iB.xyz,aPos)+iB.w, dot(iC.xyz,aPos)+iC.w);",
"  vNor=vec3(iA.x,iB.x,iC.x); vUV=mix(iUV.xy,iUV.zw,aUV); vW=w; gl_Position=uVP*vec4(w,1.0); }"].join("\n");
var PLATE_FS=[
PREC, LIGHT,
"uniform sampler2D uAtlas; varying vec2 vUV; varying vec3 vW; varying vec3 vNor;",
"void main(){ vec4 t=texture2D(uAtlas,vec2(vUV.x,1.0-vUV.y)); if(t.a<0.5) discard; vec3 b=t.rgb*t.rgb; vec3 n=normalize(vNor);",
"  vec3 c=b*(mix(uGnd,uSky,n.y*0.5+0.5)*1.3+uSunCol*(0.45+0.4*max(dot(n,uSun),0.0))+uFillCol*0.5)*pool(vW);",
"  gl_FragColor=finalOut(c,vW); }"].join("\n");
/* the shadow pass: depth only, through the same instance transforms */
var SHADOW_VS=[
"attribute vec3 aPos; attribute vec4 iA; attribute vec4 iB; attribute vec4 iC; uniform mat4 uLVP;",
"void main(){ vec3 w=vec3(dot(iA.xyz,aPos)+iA.w, dot(iB.xyz,aPos)+iB.w, dot(iC.xyz,aPos)+iC.w); gl_Position=uLVP*vec4(w,1.0); }"].join("\n");
var SHADOW_FS="precision mediump float; void main(){ gl_FragColor=vec4(1.0); }";

/* ---- the post chain: a bright / downsample pass, a separable blur, and the composite (depth of field from the blurred copy, bloom from the
   blurred copies, ACES, grade, vignette, grain, FXAA) ---- */
var POST_VS=["attribute vec2 aXY; varying vec2 vUV; void main(){ vUV=aXY*0.5+0.5; gl_Position=vec4(aXY,0.0,1.0); }"].join("\n");
var DOWN_FS=[
"precision mediump float; uniform sampler2D uSrc; uniform vec2 uPx; varying vec2 vUV;",
"void main(){ vec2 o=uPx*0.5; vec3 c=texture2D(uSrc,vUV+vec2(-o.x,-o.y)).rgb+texture2D(uSrc,vUV+vec2(o.x,-o.y)).rgb+texture2D(uSrc,vUV+vec2(-o.x,o.y)).rgb+texture2D(uSrc,vUV+vec2(o.x,o.y)).rgb;",
"  gl_FragColor=vec4(min(c*0.25,vec3(60.0)),1.0); }"].join("\n");
var BLUR_FS=[
"precision mediump float; uniform sampler2D uSrc; uniform vec2 uDir; varying vec2 vUV;",
"void main(){ vec3 c=texture2D(uSrc,vUV).rgb*0.227027+(texture2D(uSrc,vUV+uDir*1.3846153846).rgb+texture2D(uSrc,vUV-uDir*1.3846153846).rgb)*0.3162162162+(texture2D(uSrc,vUV+uDir*3.2307692308).rgb+texture2D(uSrc,vUV-uDir*3.2307692308).rgb)*0.0702702703;",
"  gl_FragColor=vec4(c,1.0); }"].join("\n");
var COMP_FS=[
"precision highp float; uniform sampler2D uScene; uniform sampler2D uB2; uniform sampler2D uB3; uniform vec2 uPx; uniform vec4 uP1; uniform vec4 uP2; uniform vec4 uP3; uniform vec4 uDof; uniform float uInv; varying vec2 vUV;",
/* uP1 = (bloom strength, bloom threshold, vignette, grain)  uP2 = (exposure, saturation, time, depth far)  uP3 = (fxaa 0/1, dof strength, split tone, 0) uDof = (focus m, near start m, far start m, far full m) */
"vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }",
"float lum(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }",
"float cl(vec3 c){ float l=lum(c); return l/(1.0+l); }",
"vec3 sc(vec2 uv){ return texture2D(uScene,uv).rgb*uInv; }",
"vec3 fxaa(vec2 uv,vec3 M){",
"  vec3 NW=sc(uv+vec2(-1.0,-1.0)*uPx), NE=sc(uv+vec2(1.0,-1.0)*uPx), SW=sc(uv+vec2(-1.0,1.0)*uPx), SE=sc(uv+vec2(1.0,1.0)*uPx);",
"  float lNW=cl(NW), lNE=cl(NE), lSW=cl(SW), lSE=cl(SE), lM=cl(M);",
"  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE))), lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));",
"  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));",
"  float dr=max((lNW+lNE+lSW+lSE)*0.0625,1.0/64.0); float rc=1.0/(min(abs(dir.x),abs(dir.y))+dr); dir=clamp(dir*rc,-6.0,6.0)*uPx;",
"  vec3 A=0.5*(sc(uv+dir*(1.0/3.0-0.5))+sc(uv+dir*(2.0/3.0-0.5)));",
"  vec3 B=A*0.5+0.25*(sc(uv+dir*-0.5)+sc(uv+dir*0.5)); float lB=cl(B);",
"  return (lB<lMin||lB>lMax)?A:B; }",
"void main(){",
"  vec4 s0=texture2D(uScene,vUV); vec3 col=s0.rgb*uInv; float dm=s0.a*uP2.w;",
"  if(uP3.x>0.5) col=fxaa(vUV,col);",
"  vec3 b2=texture2D(uB2,vUV).rgb*uInv, b3=texture2D(uB3,vUV).rgb*uInv;",
/* depth of field: blend toward the blurred copy by the circle of confusion (near blur for the dirt under the lens, far blur for the stands) */
"  float coc=0.0; if(uP3.y>0.0){ float nr=clamp((uDof.y-dm)/max(uDof.y-0.3,0.1),0.0,1.0)*0.55; float fr=clamp((dm-uDof.z)/max(uDof.w-uDof.z,1.0),0.0,1.0); coc=max(nr,fr)*uP3.y; col=mix(col,b2,min(coc,0.7)); }",
"  vec3 bl=max(b2-uP1.y,0.0)+max(b3-uP1.y,0.0)*1.2; col+=bl*uP1.x;",
"  col*=uP2.x;",
"  float l0=lum(col); col=aces(col);",
"  col=mix(vec3(lum(col)),col,uP2.y);",
"  col*=mix(vec3(0.96,1.0,1.06),vec3(1.05,1.0,0.93),smoothstep(0.05,0.65,lum(col))*uP3.z+(1.0-uP3.z)*0.5);",
"  vec2 q=vUV-0.5; float vg=1.0-uP1.z*dot(q,q)*1.9; col*=clamp(vg,0.0,1.0);",
"  col=sqrt(col);",
"  float gn=fract(sin(dot(vUV*vec2(1731.7,1299.3)+uP2.z,vec2(12.9898,78.233)))*43758.5453); col+=(gn-0.5)*uP1.w;",
"  gl_FragColor=vec4(col,1.0); }"].join("\n");

/* ---------------- the context ---------------- */
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
  var R={gl:gl,v2:v2,inst:inst,draws:0,tris:0,progs:{},maxAttr:gl.getParameter(gl.MAX_VERTEX_ATTRIBS),divs:{},enabled:{},caps:{}};
  /* what this device can do (the quality level asks for these: a float render target for the post chain, a depth texture for shadows, MSAA) */
  function ex(n){ try{ return gl.getExtension(n); }catch(e){ return null; } }
  var C=R.caps; C.aniso=ex("EXT_texture_filter_anisotropic")||ex("WEBKIT_EXT_texture_filter_anisotropic");
  if(v2){ C.floatRT=!!ex("EXT_color_buffer_float"); C.halfRT=!!(ex("EXT_color_buffer_half_float")||C.floatRT); C.hfLinear=true; C.depthTex=true; C.msaa=C.floatRT; C.depth24=true; }
  else { var hf=ex("OES_texture_half_float"); R.HF=hf; C.halfRT=!!(hf&&ex("EXT_color_buffer_half_float")); C.hfLinear=!!ex("OES_texture_half_float_linear"); C.depthTex=!!ex("WEBGL_depth_texture"); C.msaa=false; C.depth24=C.depthTex; }
  try{ var pf=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT); C.fragHigh=!!(pf&&pf.precision>0); }catch(e){ C.fragHigh=true; }
  C.maxFragU=gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS); C.maxTex=gl.getParameter(gl.MAX_TEXTURE_SIZE); C.vtf=gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>0;
  try{ var di=ex("WEBGL_debug_renderer_info"); C.renderer=di?gl.getParameter(di.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER); }catch(e){ C.renderer=""; }
  function sh(type,src){ var s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)&&!gl.isContextLost()) throw new Error("shader: "+gl.getShaderInfoLog(s)+"\n"+src.slice(0,160)); return s; }
  /* a program; defs = ["SHADOW", ...] become #defines in both stages; the name is the registry key */
  R.program=function(name,vs,fs,defs){
    var d=(defs||[]).map(function(x){ return "#define "+x+"\n"; }).join("");
    var p=gl.createProgram(); gl.attachShader(p,sh(gl.VERTEX_SHADER,d+"precision highp float;\n"+vs)); gl.attachShader(p,sh(gl.FRAGMENT_SHADER,d+fs));
    gl.bindAttribLocation(p,0,vs.indexOf("aPos")>=0?"aPos":"aXY");
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)&&!gl.isContextLost()) throw new Error("link: "+name+" "+gl.getProgramInfoLog(p));
    var P={p:p,a:{},u:{},name:name}, n=gl.getProgramParameter(p,gl.ACTIVE_ATTRIBUTES), i;
    for(i=0;i<n;i++){ var a=gl.getActiveAttrib(p,i); P.a[a.name]=gl.getAttribLocation(p,a.name); }
    n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(i=0;i<n;i++){ var u=gl.getActiveUniform(p,i); P.u[u.name.replace(/\[0\]$/,"")]=gl.getUniformLocation(p,u.name); }
    R.progs[name]=P; return P;
  };
  /* the programs: the lit shader in variants by quality (shadows, reflections, mud), the stands, the ground (with or without the detail
     layers and the shadow map), the sky, the sprites, the shadow pass; the post chain is compiled when the post is first asked for */
  R.litProgram=function(flags){ var key="lit:"+flags.join("|"); return R.progs[key]||R.program(key,LIT_VS,LIT_FS,flags); };
  R.standProgram=function(){ return R.progs.stand||R.program("stand",LIT_VS,STAND_FS,[]); };
  R.dirtProgram=function(flags){ var key="dirt:"+flags.join("|"); return R.progs[key]||R.program(key,DIRT_VS,DIRT_FS,flags); };
  R.programs=function(){
    R.program("sky",SKY_VS,SKY_FS); R.program("part",PART_VS,PART_FS); R.program("clump",CLUMP_VS,CLUMP_FS); R.program("glow",GLOW_VS,GLOW_FS);
    R.program("label",LABEL_VS,LABEL_FS); R.program("decal",DECAL_VS,DECAL_FS); R.program("plate",PLATE_VS,PLATE_FS); R.program("shadow",SHADOW_VS,SHADOW_FS);
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
  /* a mesh from a Builder: kind "lit" (pos, nor, col, material) or "dirt" (pos, nor, uv, mat); split into chunks under 65536 vertices */
  R.mesh=function(B,kind){
    var out=[], idx=B.i, chunks=[], cur=null, hasQ=B.q&&B.q.length===B.v*4;
    if(B.v<65536) chunks.push({vs:null,is:idx});
    else {
      cur={map:{},vs:[],is:[]};
      for(var t=0;t<idx.length;t+=3){
        if(cur.vs.length>65000){ chunks.push(cur); cur={map:{},vs:[],is:[]}; }
        for(var q=0;q<3;q++){ var v=idx[t+q], m=cur.map[v]; if(m==null){ m=cur.map[v]=cur.vs.length; cur.vs.push(v); } cur.is.push(m); }
      }
      chunks.push(cur);
    }
    chunks.forEach(function(ch){
      var list=ch.vs, n=list?list.length:B.v, stride=kind==="dirt"?12:14, d=new Float32Array(n*stride);
      for(var k=0;k<n;k++){ var v=list?list[k]:k, o=k*stride;
        d[o]=B.p[v*3]; d[o+1]=B.p[v*3+1]; d[o+2]=B.p[v*3+2]; d[o+3]=B.n[v*3]; d[o+4]=B.n[v*3+1]; d[o+5]=B.n[v*3+2];
        if(kind==="dirt"){ d[o+6]=B.u[v*2]; d[o+7]=B.u[v*2+1]; d[o+8]=B.m[v*4]; d[o+9]=B.m[v*4+1]; d[o+10]=B.m[v*4+2]; d[o+11]=B.m[v*4+3]; }
        else { d[o+6]=B.c[v*4]; d[o+7]=B.c[v*4+1]; d[o+8]=B.c[v*4+2]; d[o+9]=B.c[v*4+3];
          if(hasQ){ d[o+10]=B.q[v*4]; d[o+11]=B.q[v*4+1]; d[o+12]=B.q[v*4+2]; d[o+13]=B.q[v*4+3]; } else { d[o+10]=0.25; d[o+11]=0.35; d[o+12]=0; d[o+13]=1; } } }
      var spec=kind==="dirt"?[["aPos",3],["aNor",3],["aUV",2],["aMat",4]]:[["aPos",3],["aNor",3],["aCol",4],["aMat",4]];
      out.push({vb:R.vbuf(d,spec,false),ib:R.ibuf(new Uint16Array(ch.is)),tris:ch.is.length/3});
    });
    return out;
  };
  R.meshTris=function(m){ var t=0; m.forEach(function(c){ t+=c.tris; }); return t; };
  /* a texture from a canvas / image (src) or raw bytes (src = Uint8Array with o.w, o.h) */
  R.tex=function(src,o){
    o=o||{}; var t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    if(src&&src.byteLength!=null&&!src.getContext) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,o.w,o.h,0,gl.RGBA,gl.UNSIGNED_BYTE,src);
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);
    var wrap=o.clamp?gl.CLAMP_TO_EDGE:gl.REPEAT;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
    if(o.nearest){ gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST); return t; }
    if(o.mip!==false){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    var an=C.aniso;
    if(an&&o.aniso) gl.texParameterf(gl.TEXTURE_2D,an.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(o.aniso,gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  };
  R.retex=function(t,src){ gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src); gl.generateMipmap(gl.TEXTURE_2D); };
  /* the attributes a draw does not feed from a buffer get these constants */
  var DEF={aMat:[0.25,0.35,0,1],iA:[1,0,0,0],iB:[0,1,0,0],iC:[0,0,1,0],iTeam:[1,1,1,1],iAcc:[1,1,1,0]};
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
  /* draw a mesh chunk list; ivb = an instance buffer (n instances) or null (the static identity constants) */
  R.draw=function(P,mesh,ivb,count){
    for(var c=0;c<mesh.length;c++){
      var m=mesh[c];
      R.use(P); bindAttrs(P,m.vb,0);
      if(ivb) bindAttrs(P,ivb,1);
      for(var nm in DEF){ var loc=P.a[nm]; if(loc!=null&&loc>=0&&!R.enabled[loc]){ var dv=DEF[nm]; gl.vertexAttrib4f(loc,dv[0],dv[1],dv[2],dv[3]); } }
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

  /* ---------------- render targets ---------------- */
  /* o = {hdr, depth: "rb" | "tex" | null, ms: samples} */
  R.target=function(w,h,o){
    o=o||{}; var T={w:w,h:h,fb:gl.createFramebuffer(),tex:null,dtex:null,drb:null,hdr:!!o.hdr,ok:false};
    T.tex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,T.tex);
    if(o.hdr){ if(v2) gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA16F,w,h,0,gl.RGBA,gl.HALF_FLOAT,null); else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,R.HF.HALF_FLOAT_OES,null); }
    else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
    var filt=(o.hdr&&!C.hfLinear)?gl.NEAREST:gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filt); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filt);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER,T.fb); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,T.tex,0);
    if(o.depth==="tex"&&C.depthTex){
      T.dtex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,T.dtex);
      if(v2) gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,w,h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null); else gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT,w,h,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,T.dtex,0);
    } else if(o.depth){
      T.drb=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,T.drb);
      gl.renderbufferStorage(gl.RENDERBUFFER,v2?gl.DEPTH_COMPONENT24:gl.DEPTH_COMPONENT16,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,T.drb);
    }
    T.ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    return T;
  };
  R.freeTarget=function(T){ if(!T) return; try{ gl.deleteFramebuffer(T.fb); if(T.tex) gl.deleteTexture(T.tex); if(T.dtex) gl.deleteTexture(T.dtex); if(T.drb) gl.deleteRenderbuffer(T.drb); if(T.mfb) gl.deleteFramebuffer(T.mfb); if(T.mcrb) gl.deleteRenderbuffer(T.mcrb); if(T.mdrb) gl.deleteRenderbuffer(T.mdrb); }catch(e){} };
  /* a multisampled twin of a target (WebGL2 only): draw into T.mfb, then resolve into T.fb */
  R.msaa=function(T,samples){
    if(!v2||!C.msaa) return false;
    try{
      T.mfb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,T.mfb);
      T.mcrb=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,T.mcrb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,T.hdr?gl.RGBA16F:gl.RGBA8,T.w,T.h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,T.mcrb);
      T.mdrb=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,T.mdrb); gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,T.w,T.h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,T.mdrb);
      var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      if(!ok){ gl.deleteFramebuffer(T.mfb); gl.deleteRenderbuffer(T.mcrb); gl.deleteRenderbuffer(T.mdrb); T.mfb=null; return false; }
      return true;
    }catch(e){ T.mfb=null; return false; }
  };
  R.resolve=function(T){ if(!T.mfb) return; gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.mfb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.fb); gl.blitFramebuffer(0,0,T.w,T.h,0,0,T.w,T.h,gl.COLOR_BUFFER_BIT,gl.NEAREST); gl.bindFramebuffer(gl.FRAMEBUFFER,null); };
  R.bind=function(T,w,h){ gl.bindFramebuffer(gl.FRAMEBUFFER,T?(T.mfb||T.fb):null); gl.viewport(0,0,T?T.w:w,T?T.h:h); };
  R.bindPlain=function(T){ gl.bindFramebuffer(gl.FRAMEBUFFER,T.fb); gl.viewport(0,0,T.w,T.h); };

  /* ---------------- the shadow map ---------------- */
  R.shadow=null;
  R.initShadow=function(size){
    if(R.shadow&&R.shadow.size===size) return R.shadow; R.freeShadow();
    if(!C.depthTex) return null;
    var T=R.target(size,size,{hdr:false,depth:"tex"});
    if(!T.ok){ R.freeTarget(T); return null; }
    R.shadow={T:T,size:size,tex:T.dtex}; return R.shadow;
  };
  R.freeShadow=function(){ if(R.shadow){ R.freeTarget(R.shadow.T); R.shadow=null; } };

  /* ---------------- the post chain ---------------- */
  R.post=null;
  R.initPost=function(W,H,o){
    o=o||{}; R.freePost();
    if(!C.halfRT&&!o.ldr) return null;
    var hdr=!!C.halfRT, P={W:W,H:H,hdr:hdr,out:hdr?1:0.25,ms:false};
    P.scene=R.target(W,H,{hdr:hdr,depth:C.depthTex&&!v2?"tex":"rb"});
    if(!P.scene.ok){ R.freeTarget(P.scene); hdr=false; P.hdr=false; P.out=0.25; P.scene=R.target(W,H,{hdr:false,depth:"rb"}); if(!P.scene.ok){ R.freeTarget(P.scene); return null; } }
    if(o.msaa&&v2) P.ms=R.msaa(P.scene,4);
    var w2=Math.max(4,W>>2), h2=Math.max(4,H>>2), w3=Math.max(4,W>>3), h3=Math.max(4,H>>3);
    P.a2=R.target(w2,h2,{hdr:hdr}); P.b2=R.target(w2,h2,{hdr:hdr}); P.a3=R.target(w3,h3,{hdr:hdr}); P.b3=R.target(w3,h3,{hdr:hdr});
    if(!(P.a2.ok&&P.b2.ok&&P.a3.ok&&P.b3.ok)){ R.freePost(P); return null; }
    if(!R.progs.down){ R.program("down",POST_VS,DOWN_FS); R.program("blur",POST_VS,BLUR_FS); R.program("comp",POST_VS,COMP_FS.replace("precision highp float;",PREC+"\n")); }
    R.post=P; return P;
  };
  R.freePost=function(P){ P=P||R.post; if(!P) return; ["scene","a2","b2","a3","b3"].forEach(function(k){ R.freeTarget(P[k]); }); if(R.post===P) R.post=null; };
  function pass(Pg,src,dst,setup){
    R.use(Pg); gl.bindFramebuffer(gl.FRAMEBUFFER,dst?dst.fb:null); gl.viewport(0,0,dst?dst.w:R.postW,dst?dst.h:R.postH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,src.tex); if(Pg.u.uSrc!=null) gl.uniform1i(Pg.u.uSrc,0);
    if(setup) setup(Pg); R.sky(Pg);
  }
  /* after the scene is drawn into P.scene: resolve MSAA, blur the 1/4 and 1/8 copies, composite to the screen (outW x outH = the canvas) */
  R.postEnd=function(prm,outW,outH){
    var P=R.post; if(!P) return; R.postW=outW; R.postH=outH;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(true);
    R.resolve(P.scene);
    var Dn=R.progs.down, Bl=R.progs.blur, Cp=R.progs.comp;
    pass(Dn,P.scene,P.a2,function(Pg){ gl.uniform2f(Pg.u.uPx,1/P.scene.w,1/P.scene.h); });
    pass(Bl,P.a2,P.b2,function(Pg){ gl.uniform2f(Pg.u.uDir,1/P.a2.w,0); }); pass(Bl,P.b2,P.a2,function(Pg){ gl.uniform2f(Pg.u.uDir,0,1/P.a2.h); });
    pass(Dn,P.a2,P.a3,function(Pg){ gl.uniform2f(Pg.u.uPx,1/P.a2.w,1/P.a2.h); });
    pass(Bl,P.a3,P.b3,function(Pg){ gl.uniform2f(Pg.u.uDir,1/P.a3.w,0); }); pass(Bl,P.b3,P.a3,function(Pg){ gl.uniform2f(Pg.u.uDir,0,1/P.a3.h); });
    R.use(Cp); gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,outW,outH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,P.scene.tex); gl.uniform1i(Cp.u.uScene,0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,P.a2.tex); gl.uniform1i(Cp.u.uB2,1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,P.a3.tex); gl.uniform1i(Cp.u.uB3,2);
    gl.uniform2f(Cp.u.uPx,1/P.scene.w,1/P.scene.h); gl.uniform4fv(Cp.u.uP1,prm.p1); gl.uniform4fv(Cp.u.uP2,prm.p2); gl.uniform4fv(Cp.u.uP3,prm.p3); gl.uniform4fv(Cp.u.uDof,prm.dof); gl.uniform1f(Cp.u.uInv,1/P.out);
    R.sky(Cp); gl.activeTexture(gl.TEXTURE0);
  };
  R.depthBits=function(){ return gl.getParameter(gl.DEPTH_BITS); };

  return R;
}

MX.GL={create:create,Builder:Builder,m4:m4,mul:mul,persp:persp,ortho:ortho,lookAt:lookAt,inv:inv,aff:aff,frame:frame,amul:amul,local:local};
})(typeof window!=="undefined"?window:globalThis);
