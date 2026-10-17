/* MOTOCROSS WAR 3D — EFFECTS (owner: fx): the roost (dirt chunks thrown off the rear wheel), the dust (landings, crashes, sand), the puff
   texture, the particle system (one Points draw call, a ring buffer of particles) and the emission rules (when and how much, from the
   riders' per-frame state). Moved out of r3d-riders.js (the particle system) and race3d.js (the emission rules) byte for byte (the file
   split: no visual change; the Math.random call order is kept).
   createFx({lo, C, look}) -> FX: FX.group (add it to the scene), FX.part (the ring buffer), FX.emit(x, y, z, vx, vy, vz, size, life, rgb),
   FX.step(dt) (every frame), FX.rider(st, dt) (every rider every frame: landing dust, roost; st = the rider's per-frame state, CONTRACT.md),
   FX.crashStart(f, gy) / FX.crashStep(c, t, dt, ...) (the crash script's bursts). A new FX is made for every race (setRace). */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {canvas} from "./r3d-util.js";

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

/* one particle into the ring buffer P (the system's part): position, velocity, size (> 0.3 = dust, grows), life, display colour */
export function emit(P,x,y,z,vx,vy,vz,size,life,dirt){
  const k=P.next; P.next=(P.next+1)%P.n;
  P.pos[k*3]=x; P.pos[k*3+1]=y; P.pos[k*3+2]=z; P.vel[k*3]=vx; P.vel[k*3+1]=vy; P.vel[k*3+2]=vz; P.life[k]=life; P.max[k]=life; P.size[k]=size;
  const c=dirt||[0.36,0.27,0.19]; P.col[k*3]=c[0]; P.col[k*3+1]=c[1]; P.col[k*3+2]=c[2]; P.vari[k]=(k*7)%4;
}
export function stepParticles(P,dt){
  for(let k=0;k<P.n;k++){ if(P.life[k]<=0){ P.alpha[k]=0; continue; } P.life[k]-=dt; const t=P.life[k]/P.max[k];
    P.vel[k*3+1]-=9.81*dt*(P.size[k]>0.3?0.15:1); const dr=P.size[k]>0.3?1-1.6*dt:1-0.4*dt; P.vel[k*3]*=dr; P.vel[k*3+2]*=dr;
    P.pos[k*3]+=P.vel[k*3]*dt; P.pos[k*3+1]+=P.vel[k*3+1]*dt; P.pos[k*3+2]+=P.vel[k*3+2]*dt;
    if(P.size[k]>0.3) P.size[k]+=dt*0.9;   /* dust grows */
    P.alpha[k]=Math.max(0,Math.min(1,t*1.6))*(P.size[k]>0.3?0.32:0.9); }
  P.geo.attributes.position.needsUpdate=true; P.geo.attributes.aAlpha.needsUpdate=true; P.geo.attributes.aSize.needsUpdate=true; P.geo.attributes.aCol.needsUpdate=true; P.geo.attributes.aVar.needsUpdate=true;
}

export function createFx(opts){
  opts=opts||{};
  const lo=!!opts.lo, C=opts.C, look=opts.look, grp=new THREE.Group();
  /* roost: dirt chunks and dust as points */
  const P=lo?160:520, pp=new Float32Array(P*3), pa=new Float32Array(P), ps=new Float32Array(P), pc=new Float32Array(P*3), pv=new Float32Array(P);
  const pgeo=new THREE.BufferGeometry(); pgeo.setAttribute("position",new THREE.BufferAttribute(pp,3)); pgeo.setAttribute("aAlpha",new THREE.BufferAttribute(pa,1)); pgeo.setAttribute("aSize",new THREE.BufferAttribute(ps,1)); pgeo.setAttribute("aCol",new THREE.BufferAttribute(pc,3)); pgeo.setAttribute("aVar",new THREE.BufferAttribute(pv,1));
  const pmat=new THREE.ShaderMaterial({uniforms:{uScale:{value:300},uPuff:{value:puffTex()}},transparent:true,depthWrite:false,
    vertexShader:"attribute float aAlpha; attribute float aSize; attribute vec3 aCol; attribute float aVar; varying float vA; varying vec3 vC; varying float vV; varying float vD; uniform float uScale; void main(){ vA=aAlpha; vC=aCol; vV=aVar; vD=aSize>0.3?1.0:0.0; vec4 mv=modelViewMatrix*vec4(position,1.); gl_PointSize=clamp(aSize*uScale/max(0.5,-mv.z),1.0,96.0); gl_Position=projectionMatrix*mv; }",
    fragmentShader:"uniform sampler2D uPuff; varying float vA; varying vec3 vC; varying float vV; varying float vD; void main(){ vec2 d=gl_PointCoord-0.5; float r=dot(d,d); if(vD<0.5){ if(r>0.25) discard; float f=1.0-r*4.0; gl_FragColor=vec4(vC,vA*f*sqrt(f)); return; } vec4 t=texture2D(uPuff,(gl_PointCoord+vec2(mod(vV,2.0),floor(vV*0.5)))*0.5); if(t.a<0.01) discard; gl_FragColor=vec4(vC*(0.82+0.24*t.r),vA*t.a); }"});   /* clods: small round; dust: soft irregular puffs (display sRGB colours) */
  const pts=new THREE.Points(pgeo,pmat); pts.frustumCulled=false; pts.renderOrder=3; grp.add(pts);
  const part={n:P,pos:pp,alpha:pa,size:ps,col:pc,vari:pv,vel:new Float32Array(P*3),life:new Float32Array(P),max:new Float32Array(P),next:0,geo:pgeo,mat:pmat};
  /* roost chunks a little darker than the lit dirt, dust paler than it (display colours: the particle shader writes them as they are) */
  function dirtCol(){ const s=look&&look.soil; return s==="sand"?[0.74,0.63,0.45]:s==="hardpack"?[0.55,0.43,0.3]:C.kind==="stadium"?[0.45,0.33,0.22]:[0.36,0.27,0.18]; }
  function dustCol(){ const s=look&&look.soil; return s==="sand"?[0.86,0.79,0.64]:C.kind==="stadium"?[0.7,0.6,0.48]:[0.74,0.67,0.55]; }
  const FX={group:grp,part:part,lo:lo};
  FX.emit=function(x,y,z,vx,vy,vz,size,life,dirt){ emit(part,x,y,z,vx,vy,vz,size,life,dirt); };
  FX.step=function(dt){ stepParticles(part,dt); };
  /* one rider, one frame: the dust when the bike lands, the roost off the rear wheel when the throttle opens (st: x, z, th, v, roost,
     sand, gR = the ground under the rear wheel, air, landed (this frame), gate) */
  FX.rider=function(st,dt){
    const x=st.x, z=st.z, gR=st.gR, cth=Math.cos(st.th), sth=Math.sin(st.th);
    if(st.landed&&!lo){ for(let k=0;k<6;k++) emit(part,x+(Math.random()-0.5)*1.2,gR+0.1,z+(Math.random()-0.5)*1.2,(Math.random()-0.5)*2,0.6+Math.random(),(Math.random()-0.5)*2,0.5+Math.random()*0.5,1.2,dustCol()); }
    if(!lo&&!st.gate&&!st.air&&dt>0){
      const want2=st.roost;   /* the roost demand: race3d.js derives it in rider() (the [hook:fx] zone) from the throttle, the sand and the launch */
      let nE=want2*dt*(part.n>300?5:2); while(nE>0){ if(Math.random()<nE){ const bx=x-cth*0.85, bz=z-sth*0.85, sp=2.5+st.v*0.35;
          emit(part,bx+(Math.random()-0.5)*0.3,gR+0.08,bz+(Math.random()-0.5)*0.3,-cth*sp+(Math.random()-0.5)*1.6,1.4+Math.random()*2.2,-sth*sp+(Math.random()-0.5)*1.6,0.05+Math.random()*0.07,0.55+Math.random()*0.4,st.sand>0.3?[0.62,0.52,0.36]:dirtCol());
          if(Math.random()<0.18) emit(part,bx,gR+0.3,bz,-cth*sp*0.3,0.5,-sth*sp*0.3,0.5+Math.random()*0.6,1.4,dustCol()); }
        nE-=1; }
    }
  };
  /* a crash begins at f ({x, z}), the ground there gy: a burst of dirt and dust */
  FX.crashStart=function(f,gy){
    if(!lo) for(let k=0;k<26;k++) emit(part,f.x+(Math.random()-0.5)*1.2,gy+0.3,f.z+(Math.random()-0.5)*1.2,(Math.random()-0.5)*5,1+Math.random()*3,(Math.random()-0.5)*5,k<18?0.06+Math.random()*0.08:0.8+Math.random()*0.7,k<18?0.8:1.8,k<18?dirtCol():dustCol());
  };
  /* the crash script, every frame: dust where the rider hits the dirt and at each bounce (c.fx counts them), a trail behind the sliding bike
     (c = the crash record, t = seconds since the fall, ts = how long the bike slides; (hx, hgy, hz) the rider, (bx, gy, bz) the bike, thB its heading) */
  FX.crashStep=function(c,t,dt,hx,hgy,hz,bx,gy,bz,thB,ts){
    if(!lo&&dt>0){
      const ev=[0.62,1.01,1.4]; while(c.fx<ev.length&&t>=ev[c.fx]){ const nb=c.fx?6:14; for(let k=0;k<nb;k++) emit(part,hx+(Math.random()-0.5)*0.9,hgy+0.15,hz+(Math.random()-0.5)*0.9,(Math.random()-0.5)*2.4,0.4+Math.random()*1.2,(Math.random()-0.5)*2.4,0.55+Math.random()*0.7,1.3+Math.random()*0.7,dustCol()); c.fx++; }
      if(t<ts&&Math.random()<Math.min(1,dt*40)) emit(part,bx+(Math.random()-0.5)*0.7,gy+0.12,bz+(Math.random()-0.5)*0.7,-Math.cos(thB)*1.2+(Math.random()-0.5),0.3+Math.random()*0.7,-Math.sin(thB)*1.2+(Math.random()-0.5),0.45+Math.random()*0.5,1.1,dustCol()); }
  };
  return FX;
}
