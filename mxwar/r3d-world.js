/* MOTOCROSS WAR 3D — the WORLD: the track and everything around it, built once per layout from course.js (ES module, three.js r160 vendored
   at ui/vendor). Original art only: every texture is drawn in code (dirt with ruts and tyre marks, sand, grass, the crowd, plain wall
   panels), every model is plain geometry; no logos, no sponsor marks, no copied maps, no text but lap numbers on the big screen.
   buildWorld(THREE, C, look, q) -> {group, update(dt, t), gate, finish, flagSpots, light, ...}. q = quality {lo: reduce effects}.
   Draw calls are kept low: the track, the floor or the terrain, the stands, the crowd, the lights' glow (one instanced mesh), the tuff
   blocks (one), the trees (two), the gate pads (one), the flaggers. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
const MXG=(typeof window!=="undefined"?window:globalThis).MXWar;
const CO=()=>MXG.Course;

/* ---------------- small helpers ---------------- */
function lin(hex){ const c=new THREE.Color(hex); return [c.r,c.g,c.b]; }   /* sRGB hex -> linear rgb for vertex colours */
function mixc(a,b,t){ return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]; }
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function sstep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function hash2(x,z){ let h=Math.imul((x|0)*73856093^(z|0)*19349663,1597334677)>>>0; return (h%10000)/10000; }
function vnoise(x,z){ const xi=Math.floor(x), zi=Math.floor(z), xf=x-xi, zf=z-zi, u=xf*xf*(3-2*xf), v=zf*zf*(3-2*zf);
  const a=hash2(xi,zi), b=hash2(xi+1,zi), c=hash2(xi,zi+1), d=hash2(xi+1,zi+1); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function fbm(x,z,o){ let s=0, a=0.5, f=1; for(let i=0;i<(o||4);i++){ s+=a*vnoise(x*f,z*f); f*=2.03; a*=0.5; } return s; }
function canvas(w,h){ const c=document.createElement("canvas"); c.width=w; c.height=h; return c; }
function tex(c,rep){ const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=rep?THREE.RepeatWrapping:THREE.ClampToEdgeWrapping; t.anisotropy=4; t.needsUpdate=true; return t; }
function rngf(seed){ let t=seed>>>0; return ()=>{ t=(t+0x6D2B79F5)>>>0; let x=Math.imul(t^(t>>>15),t|1); x^=x+Math.imul(x^(x>>>7),x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }
/* merge plain geometries (position, normal, color, uv) into one non-indexed BufferGeometry */
export function merge(list){
  let n=0; const parts=list.map(g=>{ const q=g.index?g.toNonIndexed():g; n+=q.attributes.position.count; return q; });
  const P=new Float32Array(n*3), N=new Float32Array(n*3), Cc=new Float32Array(n*3), U=new Float32Array(n*2); let o=0;
  parts.forEach(q=>{ const c=q.attributes.position.count; P.set(q.attributes.position.array,o*3); if(q.attributes.normal) N.set(q.attributes.normal.array,o*3);
    if(q.attributes.color) Cc.set(q.attributes.color.array,o*3); else Cc.fill(1,o*3,(o+c)*3); if(q.attributes.uv) U.set(q.attributes.uv.array,o*2); o+=c; });
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.BufferAttribute(P,3)); g.setAttribute("normal",new THREE.BufferAttribute(N,3));
  g.setAttribute("color",new THREE.BufferAttribute(Cc,3)); g.setAttribute("uv",new THREE.BufferAttribute(U,2)); return g;
}
export function paint(g,rgb){ const q=g.index?g.toNonIndexed():g; const n=q.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=rgb[0]; a[i*3+1]=rgb[1]; a[i*3+2]=rgb[2]; } q.setAttribute("color",new THREE.BufferAttribute(a,3)); return q; }
export function xf(g,x,y,z,rx,ry,rz,sx,sy,sz){ const m=new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0)),new THREE.Vector3(sx||1,sy||1,sz||1)); g.applyMatrix4(m); return g; }

/* ---------------- textures drawn in code ---------------- */
const SOIL={ /* dirt colours (sRGB): the groomed track, a lighter worn line, the packed / wet dark */
  "stadium-dirt":["#8a6544","#a07a54","#5e432c"], loam:["#5c4430","#6f5539","#3c2c1f"], clay:["#8c5634","#a0673f","#5c361f"],
  hardpack:["#9a7a56","#b08e66","#6c5238"], sand:["#c2a170","#d6b986","#97784b"]
};
/* the dirt's DETAIL (a warm near-white with darker ruts, tyre tracks and stones): the colour is in the vertex colours / the material,
   so the two don't multiply into mud */
function dirtTex(soil,lo,floor){
  const W=lo?256:512, c=canvas(W,W), x=c.getContext("2d"), R=rngf(1234+soil.length+(floor?7:0)), id=x.createImageData(W,W), d=id.data;
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){
    const n=fbm(i/W*8,j/W*8,4), m=fbm(i/W*48+7,j/W*48+3,2), p=(j*W+i)*4;
    const band=Math.sin(i/W*Math.PI*8+fbm(0,j/W*3,2)*2.5)*0.5+0.5, rut=floor?0:Math.pow(band,16)*0.12;
    let v=0.86+(n-0.5)*0.32+(m-0.5)*0.18-rut; v=clamp(v,0.45,1.0);
    const k=v*255+(R()-0.5)*10; d[p]=clamp(k*1.0,0,255); d[p+1]=clamp(k*0.97,0,255); d[p+2]=clamp(k*0.93,0,255); d[p+3]=255;
  }
  x.putImageData(id,0,0);
  for(let i=0;i<W*1.4;i++){ const px=R()*W, py=R()*W, r=0.6+R()*R()*2.4; x.fillStyle=R()<0.45?"rgba(255,250,240,.35)":"rgba(40,30,22,.30)"; x.beginPath(); x.ellipse(px,py,r*1.3,r,R()*3,0,7); x.fill(); }
  /* knobby tyre tracks: along the track on the lanes, every way on the floor (footprints and tracks where the crew walk) */
  for(let t=0;t<(lo?5:10);t++){ let px=R()*W, py=R()*W; const w=1.6+R()*1.6, ang=floor?R()*6.28:0, dx=Math.sin(ang), dy=Math.cos(ang); x.fillStyle="rgba(50,38,28,.16)";
    for(let k=0;k<W/4;k++){ px+=dx*4+(R()-0.5)*1.2; py+=dy*4; x.fillRect(((px%W)+W)%W,((py%W)+W)%W,w,2.2); } }
  return tex(c,true);
}
function grassTex(lo){
  const W=lo?256:512, c=canvas(W,W), x=c.getContext("2d"), id=x.createImageData(W,W), d=id.data;
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){ const n=fbm(i/W*10,j/W*10,4), m=fbm(i/W*70,j/W*70,2), p=(j*W+i)*4, v=clamp(0.78+(n-0.5)*0.35+(m-0.5)*0.3,0.4,1);
    d[p]=clamp(v*235,0,255); d[p+1]=clamp(v*255,0,255); d[p+2]=clamp(v*215,0,255); d[p+3]=255; }
  x.putImageData(id,0,0);
  return tex(c,true);
}
function crowdTex(lo,night){
  const W=lo?256:1024, H=lo?128:512, c=canvas(W,H), x=c.getContext("2d"), R=rngf(77);
  x.fillStyle=night?"#1a1620":"#34343c"; x.fillRect(0,0,W,H);
  const rows=lo?12:24, cols=lo?40:96, cw=W/cols, rh=H/rows;
  const shirts=night?["#8f8a84","#7a2a34","#2c3f78","#9a8648","#2e2e34","#3f6a3c","#9a5a2e","#5a5a64","#a4a4aa","#4a3428","#34466c","#5e3a62","#2e2e34","#3a3a42"]:["#e6e2da","#c8102e","#1f4fc4","#f2cf1d","#2a2a2a","#57b947","#ff7a1a","#8a8a96","#f2f2f4","#6b3f2a","#3a5ba0"];
  for(let r=0;r<rows;r++){
    x.fillStyle=night?"rgba(70,62,84,.55)":"rgba(110,110,120,.6)"; x.fillRect(0,r*rh+rh*0.8,W,rh*0.2);
    for(let k=0;k<cols;k++){
      if(k%12===0){ x.fillStyle=night?"rgba(120,110,130,.5)":"rgba(170,170,176,.6)"; x.fillRect(k*cw,r*rh,cw*0.9,rh); continue; }
      if(R()<0.1) continue;
      const px=k*cw+cw*0.1, py=r*rh+rh*0.12;
      x.fillStyle=shirts[Math.floor(R()*shirts.length)]; x.globalAlpha=0.85; x.fillRect(px,py+rh*0.34,cw*0.8,rh*0.46); x.globalAlpha=1;
      x.fillStyle=["#d9ae86","#8d5a3b","#c58c63","#5a3a26","#e3c09a"][Math.floor(R()*5)]; x.beginPath(); x.ellipse(px+cw*0.4,py+rh*0.2,cw*0.26,rh*0.18,0,0,7); x.fill();
    }
  }
  if(night) for(let i=0;i<(lo?20:60);i++){ x.fillStyle="rgba(255,250,230,"+(0.6+R()*0.4)+")"; x.fillRect(R()*W,R()*H,1.5,1.5); }
  const t=tex(c,true); t.anisotropy=2; return t;
}
function wallTex(){
  const c=canvas(256,32), x=c.getContext("2d");
  const cols=["#1b2a4a","#24365c","#1b2a4a","#2c2c34"];
  for(let i=0;i<8;i++){ x.fillStyle=cols[i%cols.length]; x.fillRect(i*32,0,32,32); x.fillStyle="rgba(255,255,255,.55)"; x.fillRect(i*32,25,32,2); x.fillStyle="rgba(240,212,138,.6)"; x.fillRect(i*32+2,5,28,2); }
  return tex(c,true);
}
function glowTex(){
  const c=canvas(64,64), x=c.getContext("2d"), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.18,"rgba(255,246,220,.85)"); g.addColorStop(0.5,"rgba(255,230,180,.18)"); g.addColorStop(1,"rgba(255,230,180,0)");
  x.fillStyle=g; x.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
function checkerTex(){
  const c=canvas(64,16), x=c.getContext("2d"); for(let i=0;i<16;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?"#111114":"#f4f1e8"; x.fillRect(i*4,j*4,4,4); }
  const t=tex(c,true); t.magFilter=THREE.NearestFilter; return t;
}

/* ---------------- the track ribbon (and the start path) ---------------- */
function trackMesh(C,look,q,matTrack){
  const Co=CO(), S=SOIL[look.soil]||SOIL["stadium-dirt"], base=lin(S[0]), dark=lin(S[2]), lite=lin(S[1]), sandc=lin(SOIL.sand[1]), grassEdge=lin("#4f6b33");
  const outdoor=C.kind!=="stadium";
  /* lateral stations: the shoulders go down to the surroundings; outdoors a grass apron blends into the terrain */
  const fr=[-1.85,-1.35,-1,-0.72,-0.42,-0.15,0,0.15,0.42,0.72,1,1.35,1.85];
  const nl=fr.length, pos=[], col=[], uv=[], idx=[];
  const st=C.ds*(q.lo?2:1), segs=Math.floor(C.L/st), o={};
  for(let k=0;k<=segs;k++){
    const s=k*st, f=Co.frame(C,s,o), hw=f.hw, nx=-Math.sin(f.th), nz=Math.cos(f.th), sand=C.sand[Math.round(s/C.ds)%C.N]||0;
    const rough=C.rough[Math.round(s/C.ds)%C.N]||0;
    const Rk=1/Math.max(1e-4,Math.abs(f.k)), inSide=f.k>0?1:-1;   /* the inside of a right turn is the right (+) */
    for(let j=0;j<nl;j++){
      const u=fr[j], a=Math.abs(u); let lat=a<=1?u*hw:Math.sign(u)*(hw+(a-1)*2.6);
      if(Math.sign(lat)===inSide&&Math.abs(lat)>Rk-0.6) lat=inSide*Math.max(0,Rk-0.6-(1-Math.min(1,a))*0.01);
      let y;
      if(a<=1) y=Co.ground(C,s,lat);
      else { const edge=Co.ground(C,s,Math.sign(u)*hw); const t=(a-1)/0.85; y=edge+(f.y-0.06-edge)*sstep(0,1,t); }
      /* small ruts and braking bumps */
      if(a<0.9) y+=(vnoise(s*0.9,lat*1.7)-0.5)*0.05+rough*0.06*Math.sin(s*2.4)*(1-a);
      pos.push(f.x+nx*lat,y,f.z+nz*lat);
      /* colour: the groove darker, the edges lighter and drier, berm faces packed, sand pale, the outside shoulders grass outdoors */
      const ii=Math.round(s/C.ds)%C.N, groove=Math.exp(-Math.pow(u*2.2,2)), bermFace=a>0.55&&a<=1?C.bank[ii]/2:0;
      const Fh=C.F[ii]||0, Fs=Math.abs((C.F[(ii+1)%C.N]||0)-(C.F[(ii-1+C.N)%C.N]||0))/(2*C.ds);
      let c=mixc(base,dark,groove*0.22+bermFace*0.35);
      c=mixc(c,lite,(a>0.8&&a<=1)?0.3:0);
      /* the tops of whoops, mounds and jumps catch the light, the troughs and steep faces are darker */
      const hs=Fh>0.05?clamp(0.82+0.32*clamp(Fh/1.4,0,1)-0.18*clamp(Fs,0,1),0.6,1.18):1;
      c=[c[0]*hs,c[1]*hs,c[2]*hs];
      if(sand>0) c=mixc(c,sandc,sand*0.85);
      if(a>1) c=outdoor?mixc(mixc(base,lite,0.3),grassEdge,sstep(1.05,1.8,a)):mixc(mixc(base,dark,0.4),mixc(dark,dark,1).map(v=>v*0.78),sstep(1.0,1.85,a));
      const nz2=0.92+vnoise(s*0.31+j,lat*0.5)*0.16; col.push(c[0]*nz2,c[1]*nz2,c[2]*nz2);
      uv.push(lat/5,s/5);
    }
  }
  for(let k=0;k<segs;k++) for(let j=0;j<nl-1;j++){ const a=k*nl+j, b=a+1, c2=a+nl, d=c2+1; idx.push(a,c2,b,b,c2,d); }
  /* close the loop: the last ring is the first */
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); g.setIndex(idx); g.computeVertexNormals();
  const parts=[g];
  /* the start path */
  if(C.S&&C.S.n){
    const P2=[], C2=[], U2=[], I2=[], S2=C.S, fr2=[-1.5,-1,-0.6,-0.2,0,0.2,0.6,1,1.5], nl2=fr2.length, st2=Math.max(1,Math.round(st/S2.ds));
    let rows=0;
    for(let i=0;i<S2.n;i+=st2){ rows++; const th=S2.th[i], nx=-Math.sin(th), nz=Math.cos(th), hw=S2.hw[i], y0=S2.y[i]||0;
      for(let j=0;j<nl2;j++){ const u=fr2[j], a=Math.abs(u), lat=u*hw+(a>1?(a-1)*3*Math.sign(u):0); const y=a<=1?y0+0.02+(vnoise(i*0.4,lat)-0.5)*0.04:y0-0.06;
        P2.push(S2.x[i]+nx*lat,y,S2.z[i]+nz*lat); const c=a>1?(outdoor?grassEdge:mixc(base,dark,0.25)):mixc(base,dark,Math.exp(-u*u*3)*0.25); C2.push(c[0],c[1],c[2]); U2.push(lat/5,i*S2.ds/5); } }
    for(let k=0;k<rows-1;k++) for(let j=0;j<nl2-1;j++){ const a=k*nl2+j, b=a+1, c2=a+nl2, d=c2+1; I2.push(a,c2,b,b,c2,d); }
    const g2=new THREE.BufferGeometry(); g2.setAttribute("position",new THREE.Float32BufferAttribute(P2,3)); g2.setAttribute("color",new THREE.Float32BufferAttribute(C2,3)); g2.setAttribute("uv",new THREE.Float32BufferAttribute(U2,2)); g2.setIndex(I2); g2.computeVertexNormals();
    parts.push(g2);
  }
  const mesh=new THREE.Mesh(parts.length>1?merge(parts):parts[0],matTrack);
  mesh.receiveShadow=false;
  return mesh;
}

/* ---------------- tuff blocks (modern stadium) or hay bales (old eras) along the lane edges ---------------- */
function edgeBlocks(C,look,q){
  /* one row of blocks in the middle of the gap between two lanes (never two rows), none on the outside of a berm */
  const Co=CO(), list=[], o={}, step=look.bales?2.6:2.0;
  for(let s=0;s<C.L;s+=step){
    const f=Co.frame(C,s,o);
    [-1,1].forEach(side=>{
      const nx=-Math.sin(f.th)*side, nz=Math.cos(f.th)*side;
      let gap=-1;
      for(let d=1.2;d<=9;d+=0.6){ const x=f.x+nx*(f.hw+d), z=f.z+nz*(f.hw+d); if(!clear(C,x,z,0.05)){ gap=d; break; } }
      if(gap<1.4) return;
      if(Math.abs(f.k)>1/28&&Math.sign(f.k)!==side) return;
      const lat=side*(f.hw+gap/2), x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat;
      if(list.some(b=>(b[0]-x)*(b[0]-x)+(b[1]-z)*(b[1]-z)<2.4)) return;
      if(!clear(C,x,z,0.35)) return;
      list.push([x,z,f.th,(f.y||0)]);
    });
  }
  const geo=look.bales?new THREE.BoxGeometry(1.2,0.5,0.55):new THREE.BoxGeometry(1.3,0.36,0.45);
  const mat=new THREE.MeshLambertMaterial({color:0xffffff});
  const m=new THREE.InstancedMesh(geo,mat,Math.max(1,list.length)), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), Sx=new THREE.Vector3(1,1,1), cl=new THREE.Color();
  const tints=look.bales?["#c9a55a","#b8944e","#d4b066"]:["#e9eaed","#e9eaed","#d7d9de","#e9eaed","#9fb6d9","#e9eaed","#d7d9de"];
  list.forEach((b,i)=>{ E.set(0,-b[2],0); Q.setFromEuler(E); V.set(b[0],b[3]+(look.bales?0.25:0.18),b[1]); M.compose(V,Q,Sx); m.setMatrixAt(i,M); cl.set(tints[i%tints.length]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; if(m.instanceColor) m.instanceColor.needsUpdate=true;
  return m;
}
function clear(C,x,z,margin){
  /* true if (x, z) is not on the track (any part) */
  const st=Math.max(1,Math.round(1/C.ds));
  for(let i=0;i<C.N;i+=st){ const dx=C.x[i]-x, dz=C.z[i]-z; if(dx*dx+dz*dz<(C.hw[i]+margin)*(C.hw[i]+margin)) return false; }
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st){ const dx=C.S.x[i]-x, dz=C.S.z[i]-z; if(dx*dx+dz*dz<(C.S.hw[i]+margin)*(C.S.hw[i]+margin)) return false; }
  return true;
}

/* ---------------- the starting gate: a long beam, one pad per rider slot, the concrete pad behind it ---------------- */
function gateBuild(C,look,n){
  const Co=CO(), grp=new THREE.Group(), o={};
  let f; if(C.S&&C.S.n) f=Co.startFrame(C,C.gateAt||2,o); else f=Co.frame(C,C.join+(C.gateAt||0),o);
  const th=f.th, gw=Math.max(n*0.9,C.gateW*0.92), slots=Math.max(n,Math.round(gw/0.9)), pad=gw/slots;
  const beamG=new THREE.BoxGeometry(0.16,0.16,gw+0.6); const beam=new THREE.Mesh(beamG,new THREE.MeshLambertMaterial({color:0x4a4d55})); beam.position.set(0,0.12,0); grp.add(beam);
  const padG=new THREE.BoxGeometry(0.05,0.55,pad*0.86); padG.translate(0,0.275,0);
  const pads=new THREE.InstancedMesh(padG,new THREE.MeshLambertMaterial({color:0xb9bcc4}),slots);
  pads.frustumCulled=false;
  /* the concrete pad behind the gate */
  const conc=new THREE.Mesh(new THREE.PlaneGeometry(6,gw+1.2),new THREE.MeshLambertMaterial({color:0x8f8e8a}));
  conc.rotation.x=-Math.PI/2; conc.position.set(-3.1,0.025,0); grp.add(conc);
  grp.add(pads);
  grp.position.set(f.x,(f.y||0)+0.01,f.z); grp.rotation.y=-th;
  const state={grp:grp,pads:pads,slots:slots,pad:pad,gw:gw,th:th,x:f.x,z:f.z,y:f.y||0,drop:0,dropT:-1};
  state.slotLat=function(k){ return -gw/2+pad*(k+0.5); };   /* lateral (right +) of slot k */
  state.set=function(a){ /* a = 0 (up) .. 1 (down, flat on the dirt toward the riders' front) */
    const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
    for(let k=0;k<slots;k++){ E.set(0,0,-a*Math.PI*0.47); Q.setFromEuler(E); V.set(0.05,0,-gw/2+pad*(k+0.5)); M.compose(V,Q,S); pads.setMatrixAt(k,M); }
    pads.instanceMatrix.needsUpdate=true;
  };
  state.set(0);
  return state;
}

/* ---------------- the finish line: a checkered stripe across the track, the flagger's stand ---------------- */
function finishBuild(C,look){
  const Co=CO(), o={}, f=Co.frame(C,0,o), grp=new THREE.Group();
  const stripe=new THREE.Mesh(new THREE.PlaneGeometry(1.1,f.hw*2+0.4),new THREE.MeshBasicMaterial({map:checkerTex(),transparent:false}));
  stripe.material.map.repeat.set(1,Math.max(2,Math.round(f.hw*2/1.1))*0.5);
  stripe.rotation.x=-Math.PI/2; stripe.position.set(0,Co.ground(C,0,0)-(f.y||0)+0.04,0); grp.add(stripe);
  /* the stand: on the inside (finSide) just past the line */
  const side=C.finSide||-1, lat=side*(f.hw+1.6);
  const stand=new THREE.Group(), st=lin("#3a3d46"), pl=lin("#d9d9de"), parts=[];
  [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]].forEach(c=>parts.push(xf(paint(new THREE.BoxGeometry(0.09,2.4,0.09),st),c[0],1.2,c[1])));
  parts.push(xf(paint(new THREE.BoxGeometry(1.5,0.1,1.5),pl),0,2.42,0));
  [[0,0.72,1.5,0.05],[0,-0.72,1.5,0.05]].forEach(r=>parts.push(xf(paint(new THREE.BoxGeometry(r[2],r[3],r[3]),st),r[0],3.4,r[1])));
  parts.push(xf(paint(new THREE.BoxGeometry(0.05,0.05,1.5),st),-0.72,3.4,0));
  [[-0.72,0.72],[-0.72,-0.72],[0.72,0.72],[0.72,-0.72]].forEach(c=>parts.push(xf(paint(new THREE.BoxGeometry(0.05,1.0,0.05),st),c[0],2.95,c[1])));
  [0.5,1.1,1.7].forEach(y=>parts.push(xf(paint(new THREE.BoxGeometry(0.05,0.05,1.2),st),-0.62,y,0)));   /* the ladder rungs */
  stand.add(new THREE.Mesh(merge(parts),new THREE.MeshLambertMaterial({vertexColors:true})));
  stand.position.set(0.9,0,lat); grp.add(stand);
  grp.position.set(f.x,f.y||0,f.z); grp.rotation.y=-f.th;
  return {grp:grp,flagAt:new THREE.Vector3(f.x+Math.cos(f.th)*0.9-Math.sin(f.th)*lat,(f.y||0)+2.47,f.z+Math.sin(f.th)*0.9+Math.cos(f.th)*lat),th:f.th,side:side,lat:lat};
}

/* ---------------- a flagger (a person on a stand or beside the track) waving a flag; one mesh each ---------------- */
export function flaggerBuild(flagTex){
  const grp=new THREE.Group();
  const body=merge([
    xf(paint(new THREE.BoxGeometry(0.36,0.5,0.22),lin("#e8e4dc")),0,1.2,0),            /* shirt */
    xf(paint(new THREE.BoxGeometry(0.32,0.62,0.2),lin("#2a2c34")),0,0.62,0),           /* trousers */
    xf(paint(new THREE.SphereGeometry(0.12,8,6),lin("#c58c63")),0,1.6,0),              /* head */
    xf(paint(new THREE.SphereGeometry(0.13,8,4,0,Math.PI*2,0,1.3),lin("#1d2a4a")),0,1.66,0)   /* cap */
  ]);
  const man=new THREE.Mesh(body,new THREE.MeshLambertMaterial({vertexColors:true})); grp.add(man);
  const arm=new THREE.Group(); arm.position.set(0.2,1.4,0);
  const armM=new THREE.Mesh(paint(new THREE.BoxGeometry(0.09,0.55,0.09),lin("#e8e4dc")),new THREE.MeshLambertMaterial({vertexColors:true})); armM.position.set(0,0.25,0); arm.add(armM);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.015,0.015,1.1,5),new THREE.MeshLambertMaterial({color:0xcccccc})); pole.position.set(0,0.75,0); arm.add(pole);
  const fg=new THREE.PlaneGeometry(0.9,0.6,6,1); fg.translate(0.45,0,0);
  const flag=new THREE.Mesh(fg,new THREE.MeshLambertMaterial({map:flagTex,side:THREE.DoubleSide})); flag.position.set(0,1.0,0); arm.add(flag);
  grp.add(arm);
  const P=fg.attributes.position, X0=Float32Array.from(P.array);
  return {grp,arm,flag,wave(t,amp){ for(let i=0;i<P.count;i++){ const x=X0[i*3]; P.array[i*3+2]=Math.sin(t*9-x*5)*0.12*x*amp; } P.needsUpdate=true; arm.rotation.z=-0.35+Math.sin(t*6)*0.55*amp; arm.rotation.x=Math.sin(t*3)*0.1*amp; },
    setTex(t){ flag.material.map=t; flag.material.needsUpdate=true; }};
}
export function flagTex(kind){
  const c=canvas(96,64), x=c.getContext("2d");
  if(kind==="checkered"){ for(let i=0;i<6;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?"#111114":"#f6f2e8"; x.fillRect(i*16,j*16,16,16); } }
  else { x.fillStyle=kind==="white"?"#fbfaf5":kind==="yellow"?"#f6d21c":kind==="green"?"#2fa84f":"#c8102e"; x.fillRect(0,0,96,64); }
  return tex(c,false);
}

/* ---------------- stadium: floor, wall, a bowl of stands with the crowd, light rings, the big screen ---------------- */
function stadium(C,look,q,root,ctx){
  const [x0,x1,z0,z1]=C.layout.floor||[-66,66,-48,32], cx=(x0+x1)/2, cz=(z0+z1)/2, W=x1-x0, D=z1-z0;
  const night=true, dome=look.around==="stadium-dome";
  /* the dirt floor */
  const floorT=dirtTex(look.soil,q.lo,true); floorT.repeat.set(W/9,D/9);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(W+4,D+4),new THREE.MeshLambertMaterial({map:floorT,color:new THREE.Color(SOIL[look.soil]?SOIL[look.soil][2]:"#5e432c").multiplyScalar(0.78)}));
  floor.rotation.x=-Math.PI/2; floor.position.set(cx,-0.05,cz); root.add(floor);
  /* the padded wall round the floor */
  const wt=wallTex(); wt.repeat.set((W+D)*2/14,1);
  const wallG=[]; const h=1.4;
  [[cx,z0-0.3,W+1.2,0],[cx,z1+0.3,W+1.2,0],[x0-0.3,cz,D+1.2,Math.PI/2],[x1+0.3,cz,D+1.2,Math.PI/2]].forEach(w=>{ const g=new THREE.BoxGeometry(w[2],h,0.5); g.rotateY(w[3]); g.translate(w[0],h/2,w[1]); wallG.push(g); });
  const wall=new THREE.Mesh(merge(wallG),new THREE.MeshLambertMaterial({map:wt})); root.add(wall);
  /* the bowl: a rounded rectangle lofted up and back (lower bowl, a concourse, the upper deck) */
  const ring=[], rx=W/2+1.5, rz=D/2+1.5, rad=Math.min(rx,rz)*0.42, segs=q.lo?40:72;
  for(let i=0;i<segs;i++){ const a=i/segs*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a);
    /* a superellipse: square-ish corners */
    const e=4, px=Math.sign(ca)*Math.pow(Math.abs(ca),2/e)*rx, pz=Math.sign(sa)*Math.pow(Math.abs(sa),2/e)*rz; const nx=Math.sign(ca)*Math.pow(Math.abs(ca),e/2-1)*0+ca, nz=sa;
    const L=Math.hypot(nx,nz)||1; ring.push([cx+px,cz+pz,nx/L,nz/L]); }
  const prof=[[0,h+0.2],[2,h+1.6],[30,18],[31,18.4],[32,22.5],[34,23],[62,42],[64,44]];   /* distance back, height: the lower bowl, the suites, the upper deck */
  const pos=[], uv=[], col=[], idx=[]; let uAcc=0;
  for(let i=0;i<=segs;i++){ const r=ring[i%segs], rp=ring[(i+segs-1)%segs]; if(i) uAcc+=Math.hypot(r[0]-rp[0],r[1]-rp[1]);
    prof.forEach((p,j)=>{ pos.push(r[0]+r[2]*p[0],p[1],r[1]+r[3]*p[0]); uv.push(uAcc/22,j<3?(p[1]/18)*1.5:1.9+(p[1]-22)/22*1.6); const shade=(j===3||j===4)?0.22:1; col.push(shade,shade*0.95,shade*0.9); }); }
  const np=prof.length; for(let i=0;i<segs;i++) for(let j=0;j<np-1;j++){ const a=i*np+j, b=a+1, c2=a+np, d=c2+1; idx.push(a,b,c2,b,d,c2); }
  const bg=new THREE.BufferGeometry(); bg.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); bg.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); bg.setAttribute("color",new THREE.Float32BufferAttribute(col,3)); bg.setIndex(idx); bg.computeVertexNormals();
  const ct=crowdTex(q.lo,night);
  const bowl=new THREE.Mesh(bg,new THREE.MeshLambertMaterial({map:ct,vertexColors:true,side:THREE.DoubleSide})); root.add(bowl);
  /* the rim and the light banks: glows round the top of the bowl, a few truss bars over the floor */
  const glows=[]; for(let i=0;i<segs;i+=q.lo?4:2){ const r=ring[i]; glows.push([r[0]+r[2]*63,46,r[1]+r[3]*63,7]); }
  if(dome){ /* a dome roof: dark, with the light rig hanging from it */
    const roof=new THREE.Mesh(new THREE.SphereGeometry(Math.max(rx,rz)+70,24,10,0,Math.PI*2,0,Math.PI*0.32),new THREE.MeshLambertMaterial({color:0x1a1a22,side:THREE.BackSide}));
    roof.scale.set(1,0.35,(rz+64)/(rx+64)); roof.position.set(cx,20,cz); root.add(roof);
  }
  for(let i=0;i<6;i++){ const x=x0+W*(i+0.5)/6; glows.push([x,38,z0-6,9]); glows.push([x,38,z1+6,9]); }
  ctx.glow(glows,0xfff1d6);
  /* light beams: soft cones from the light banks down to the floor (the haze of a stadium night under the lights); full quality only */
  if(!q.lo){
    const g=new THREE.CylinderGeometry(0.9,7.5,1,14,1,true); g.translate(0,-0.5,0);
    const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{col:{value:new THREE.Color(0xfff0d0)}},
      vertexShader:"varying float vF; varying float vE; void main(){ vF=1.0+position.y; vec4 mv=modelViewMatrix*instanceMatrix*vec4(position,1.0); vec3 n=normalize(mat3(modelViewMatrix*instanceMatrix)*normal); vE=abs(dot(n,normalize(-mv.xyz))); gl_Position=projectionMatrix*mv; }",
      fragmentShader:"uniform vec3 col; varying float vF; varying float vE; void main(){ float a=0.07*pow(vF,1.6)*pow(vE,1.4); gl_FragColor=vec4(col*a,a); }"});
    const n=8, m=new THREE.InstancedMesh(g,mat,n), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), up=new THREE.Vector3(0,-1,0), d=new THREE.Vector3(), pos=new THREE.Vector3(), sc=new THREE.Vector3();
    for(let i=0;i<n;i++){ const r=ring[Math.floor(i*segs/n+segs/16)%segs]; pos.set(r[0]+r[2]*60,44,r[1]+r[3]*60);
      const tx=cx+(((i*37)%11)/11-0.5)*W*0.6, tz=cz+(((i*53)%7)/7-0.5)*D*0.5; d.set(tx-pos.x,0.2-pos.y,tz-pos.z); const len=d.length(); d.normalize();
      Q.setFromUnitVectors(up,d); sc.set(1,len,1); M.compose(pos,Q,sc); m.setMatrixAt(i,M); }
    m.instanceMatrix.needsUpdate=true; m.frustumCulled=false; m.renderOrder=6; root.add(m);
  }
  /* the big screen at the west end: the lap and the leader's number (redrawn each lap) */
  const sc=canvas(256,128), sx=sc.getContext("2d"), st=tex(sc,false);
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(22,11),new THREE.MeshBasicMaterial({map:st}));
  screen.position.set(x0-20,30,cz); screen.rotation.y=Math.PI/2; root.add(screen);
  const frame=new THREE.Mesh(new THREE.BoxGeometry(1,12.4,23.4),new THREE.MeshLambertMaterial({color:0x15151a})); frame.position.set(x0-20.6,30,cz); root.add(frame);
  ctx.screen=function(lap,len,num){ sx.fillStyle="#0b0e1a"; sx.fillRect(0,0,256,128); sx.fillStyle="#f0d48a"; sx.font="800 30px Manrope, system-ui, sans-serif"; sx.textAlign="center";
    sx.fillText(len?("LAP "+lap+" / "+len):"",128,52); sx.fillStyle="#ffffff"; sx.font="800 44px Manrope, system-ui, sans-serif"; sx.fillText(num!=null?("#"+num):"",128,104); st.needsUpdate=true; };
  ctx.screen(0,0,null);
  /* the night sky (open stadiums) */
  ctx.sky(0x05060c,0x141a30,0x24233a);
  ctx.fog(0x0b0b12,150,420);
  return {cx:cx,cz:cz};
}

/* ---------------- outdoors: terrain carved round the track, trees, spectators, the paddock, far hills, a day sky ---------------- */
function terrainHeightFn(C,look){
  /* a smooth elevation field from the track's own heights (so the hills are where the track climbs), plus noise hills away from it */
  const pts=[], st=Math.max(1,Math.round(12/C.ds));
  for(let i=0;i<C.N;i+=st) pts.push([C.x[i],C.z[i],C.y[i],C.hw[i]]);
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st) pts.push([C.S.x[i],C.S.z[i],C.S.y[i]||0,C.S.hw[i]]);
  const amp=look.around==="beach-speedway"?0.4:look.around==="farmland"?2.5:7;
  /* a spatial hash for the nearest track point */
  const cell=24, H={}; pts.forEach((p,i)=>{ const k=Math.floor(p[0]/cell)+","+Math.floor(p[1]/cell); (H[k]=H[k]||[]).push(i); });
  function nearest(x,z){ let best=1e9, bi=-1; const cx=Math.floor(x/cell), cz=Math.floor(z/cell);
    for(let r=0;r<4&&bi<0||r<2;r++) for(let a=-r;a<=r;a++) for(let b=-r;b<=r;b++){ if(Math.max(Math.abs(a),Math.abs(b))!==r) continue; const L=H[(cx+a)+","+(cz+b)]; if(!L) continue; L.forEach(i=>{ const p=pts[i], d=(p[0]-x)*(p[0]-x)+(p[1]-z)*(p[1]-z); if(d<best){ best=d; bi=i; } }); }
    return bi<0?null:{d:Math.sqrt(best),p:pts[bi]}; }
  return function(x,z){
    let sw=0, sy=0; for(let i=0;i<pts.length;i+=3){ const p=pts[i], d2=(p[0]-x)*(p[0]-x)+(p[1]-z)*(p[1]-z), w=1/(d2+2500); sw+=w; sy+=w*p[2]; }
    let y=sy/sw+(fbm(x/140,z/140,4)-0.45)*amp*2.2;
    const n=nearest(x,z);
    if(n){ const t=sstep(n.p[3]+2,n.p[3]+46,n.d); y=(n.p[2]-0.18)*(1-t)+y*t; }
    return y;
  };
}
function outdoorWorld(C,look,q,root,ctx){
  const [x0,x1,z0,z1]=C.layout.floor||[-500,600,-400,520], W=x1-x0, D=z1-z0, cx=(x0+x1)/2, cz=(z0+z1)/2;
  const hf=terrainHeightFn(C,look), cs=q.lo?11:8, nx=Math.ceil(W/cs), nz=Math.ceil(D/cs);
  const pos=new Float32Array((nx+1)*(nz+1)*3), col=new Float32Array((nx+1)*(nz+1)*3), uv=new Float32Array((nx+1)*(nz+1)*2), idx=[];
  const g1=lin(look.around==="beach-speedway"?"#6f7f45":"#4a6b2c"), g2=lin(look.around==="beach-speedway"?"#a59a6a":"#36551f"), dry=lin("#7d7a48");
  for(let j=0;j<=nz;j++) for(let i=0;i<=nx;i++){ const x=x0+i*cs, z=z0+j*cs, y=hf(x,z), k=j*(nx+1)+i; pos[k*3]=x; pos[k*3+1]=y; pos[k*3+2]=z; uv[k*2]=x/9; uv[k*2+1]=z/9;
    const n=fbm(x/60,z/60,3); let c=mixc(g1,g2,n); c=mixc(c,dry,clamp((fbm(x/25+9,z/25,2)-0.55)*2,0,0.5)); col[k*3]=c[0]; col[k*3+1]=c[1]; col[k*3+2]=c[2]; }
  for(let j=0;j<nz;j++) for(let i=0;i<nx;i++){ const a=j*(nx+1)+i, b=a+1, c2=a+nx+1, d=c2+1; idx.push(a,c2,b,b,c2,d); }
  const tg=new THREE.BufferGeometry(); tg.setAttribute("position",new THREE.BufferAttribute(pos,3)); tg.setAttribute("color",new THREE.BufferAttribute(col,3)); tg.setAttribute("uv",new THREE.BufferAttribute(uv,2)); tg.setIndex(idx); tg.computeVertexNormals();
  const gt=grassTex(q.lo);
  const terr=new THREE.Mesh(tg,new THREE.MeshLambertMaterial({map:gt,vertexColors:true})); root.add(terr);
  ctx.hf=hf;
  /* far hills: a ring of low hills at the horizon */
  const fh=[], R0=Math.max(W,D)*0.95, nseg=q.lo?36:64; for(let i=0;i<=nseg;i++){ const a=i/nseg*Math.PI*2; const h=30+fbm(i*0.3,4,3)*90; fh.push([cx+Math.cos(a)*R0,cz+Math.sin(a)*R0,h]); }
  const hp=[], hi=[], hc=[]; fh.forEach((p,i)=>{ hp.push(p[0],-5,p[1], cx+(p[0]-cx)*1.25,p[2],cz+(p[1]-cz)*1.25); const c1=lin("#5d7350"), c2=lin("#8fa0a8"); hc.push(c1[0],c1[1],c1[2],c2[0],c2[1],c2[2]); });
  for(let i=0;i<nseg;i++){ const a=i*2; hi.push(a,a+1,a+2,a+1,a+3,a+2); }
  const hg=new THREE.BufferGeometry(); hg.setAttribute("position",new THREE.Float32BufferAttribute(hp,3)); hg.setAttribute("color",new THREE.Float32BufferAttribute(hc,3)); hg.setIndex(hi); hg.computeVertexNormals();
  root.add(new THREE.Mesh(hg,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  /* trees: pines and round trees in clumps, never on or near the track */
  const R=rngf(C.L|0), trees=[], want=q.lo?260:620;
  for(let k=0;k<want*6&&trees.length<want;k++){ const x=x0+R()*W, z=z0+R()*D; if(fbm(x/90,z/90,3)<0.47) continue; if(!clear(C,x,z,16)) continue; trees.push([x,z,hf(x,z),0.7+R()*0.7,R()<0.62?0:1]); }
  const pine=merge([xf(paint(new THREE.ConeGeometry(2.2,5.5,7),lin("#1f3d22")),0,5.2,0),xf(paint(new THREE.ConeGeometry(1.7,4.4,7),lin("#28482a")),0,7.6,0),xf(paint(new THREE.CylinderGeometry(0.25,0.32,2.8,5),lin("#4a3424")),0,1.4,0)]);
  const leafy=merge([xf(paint(new THREE.IcosahedronGeometry(3.0,0),lin("#35562a")),0,5.6,0),xf(paint(new THREE.IcosahedronGeometry(2.2,0),lin("#3f6630")),1.2,6.6,0.6),xf(paint(new THREE.CylinderGeometry(0.3,0.4,3.6,5),lin("#4a3424")),0,1.8,0)]);
  const tmat=new THREE.MeshLambertMaterial({vertexColors:true});
  [pine,leafy].forEach((geo,type)=>{ const L=trees.filter(t=>t[4]===type); if(!L.length) return; const m=new THREE.InstancedMesh(geo,tmat,L.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3();
    L.forEach((t,i)=>{ E.set(0,t[0]*1.7,0); Q.setFromEuler(E); V.set(t[0],t[2]-0.2,t[1]); S.set(t[3],t[3]*(0.85+0.3*((i*37)%10)/10),t[3]); M.compose(V,Q,S); m.setMatrixAt(i,M); });
    m.instanceMatrix.needsUpdate=true; root.add(m); });
  /* spectators along the fence at the jumps and the finish */
  spectators(C,look,q,root,hf,R);
  /* the paddock: trucks and tents near the start */
  paddock(C,look,q,root,hf,R);
  ctx.sky(look.around==="desert"?0x8fb6e0:0x5d8fd6,0xc9dcf0,0xe8e0cf,true);
  ctx.fog(0xcfdbe6,260,1300);
  return {cx:cx,cz:cz};
}
function spectators(C,look,q,root,hf,R){
  const Co=CO(), list=[], o={};
  const spots=C.feats.filter(f=>f.k==="jump"||f.k==="whoops"||f.k==="sand").map(f=>(f.from+f.to)/2).concat([0,C.L*0.5]);
  spots.forEach(s0=>{ for(let k=0;k<(q.lo?14:34);k++){ const s=s0+(R()-0.5)*40, f=Co.frame(C,s,o), side=R()<0.5?-1:1, lat=side*(f.hw+7+R()*7);
    const x=f.x-Math.sin(f.th)*lat, z=f.z+Math.cos(f.th)*lat; if(!clear(C,x,z,5)) continue; list.push([x,z,hf?hf(x,z):0,R()]); } });
  if(!list.length) return;
  const body=merge([xf(paint(new THREE.BoxGeometry(0.42,0.75,0.26),[1,1,1]),0,1.05,0),xf(paint(new THREE.BoxGeometry(0.34,0.7,0.22),lin("#2c2f3a")),0,0.35,0),xf(paint(new THREE.SphereGeometry(0.13,6,4),lin("#c58c63")),0,1.58,0)]);
  const m=new THREE.InstancedMesh(body,new THREE.MeshLambertMaterial({vertexColors:true}),list.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1), cl=new THREE.Color();
  const shirts=["#d8d4cc","#c8102e","#1f4fc4","#f2cf1d","#2a2a2a","#57b947","#ff7a1a","#e6e6ea","#3a5ba0","#7a3b8f"];
  list.forEach((p,i)=>{ Q.setFromAxisAngle(new THREE.Vector3(0,1,0),p[3]*6.28); V.set(p[0],p[2],p[1]); M.compose(V,Q,S); m.setMatrixAt(i,M); cl.set(shirts[i%shirts.length]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; root.add(m);
}
function paddock(C,look,q,root,hf,R){
  const Co=CO(), o={}; let f;
  if(C.S&&C.S.n) f=Co.startFrame(C,0,o); else f=Co.frame(C,C.join,o);
  const items=[], n=q.lo?8:18;
  for(let k=0;k<n*4&&items.length<n;k++){ const x=f.x-Math.cos(f.th)*(40+R()*90)+(R()-0.5)*120, z=f.z-Math.sin(f.th)*(30+R()*40)+(R()-0.5)*120; if(!clear(C,x,z,14)) continue; items.push([x,z,hf?hf(x,z):0,R()]); }
  const truck=merge([xf(paint(new THREE.BoxGeometry(13,3.6,2.6),[1,1,1]),0,2.2,0),xf(paint(new THREE.BoxGeometry(3,3,2.5),lin("#d8d8dc")),8.2,1.9,0),xf(paint(new THREE.BoxGeometry(16,0.5,2.4),lin("#1c1c20")),0.8,0.4,0)]);
  const m=new THREE.InstancedMesh(truck,new THREE.MeshLambertMaterial({vertexColors:true}),items.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1), cl=new THREE.Color();
  const cols=["#d62828","#1f4fc4","#57b947","#f2cf1d","#ff7a1a","#f2f4f8","#26292e","#a8101c"];
  items.forEach((p,i)=>{ Q.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.round(p[3]*4)*Math.PI/2+0.3); V.set(p[0],p[2],p[1]); M.compose(V,Q,S); m.setMatrixAt(i,M); cl.set(cols[i%cols.length]); m.setColorAt(i,cl); });
  m.instanceMatrix.needsUpdate=true; root.add(m);
}

/* ---------------- the speedway infield (Daytona-style): flat sandy infield, the banked oval, a grandstand, light towers, palms, a lake ---------------- */
function speedway(C,look,q,root,ctx){
  const [x0,x1,z0,z1]=C.layout.floor||[-150,90,-40,125], cx=(x0+x1)/2, cz=(z0+z1)/2;
  /* the infield: flat ground with sandy grass */
  const hf=(x,z)=>(fbm(x/80,z/80,2)-0.5)*0.3-0.32;   /* always under the track's shoulders (no grass poking through the dirt) */
  const flat={layout:{floor:[cx-700,cx+700,cz-420,cz+420]},L:C.L,N:C.N,x:C.x,z:C.z,hw:C.hw,y:C.y,S:C.S,feats:C.feats,ds:C.ds,k:C.k};
  const look2=Object.assign({},look,{around:"beach-speedway"});
  /* the oval: an ellipse-ish tri-oval ribbon of asphalt, banked in the turns */
  const ov=[], A=640, B=300, segs=q.lo?72:128;
  for(let i=0;i<=segs;i++){ const a=i/segs*Math.PI*2, ca=Math.cos(a), sa=Math.sin(a), e=3.2; const px=Math.sign(ca)*Math.pow(Math.abs(ca),2/e)*A, pz=Math.sign(sa)*Math.pow(Math.abs(sa),2/e)*B;
    ov.push([cx+px,cz+pz+40,Math.abs(ca)>0.75?1:0]); }
  const op=[], oc=[], oi=[];
  for(let i=0;i<=segs;i++){ const p=ov[i%segs], pn=ov[(i+1)%segs], dx=pn[0]-p[0], dz=pn[1]-p[1], L=Math.hypot(dx,dz)||1, nx=dz/L, nz=-dx/L;
    const bank=p[2]?9:1.2; const inn=[p[0]-nx*14,0.1,p[1]-nz*14], out=[p[0]+nx*14,bank,p[1]+nz*14], wall=[p[0]+nx*15,bank+1.4,p[1]+nz*15];
    op.push(inn[0],inn[1],inn[2],out[0],out[1],out[2],wall[0],wall[1],wall[2]); const g=lin("#3a3b40"), w=lin("#d9d9de"); oc.push(g[0],g[1],g[2],g[0]*1.1,g[1]*1.1,g[2]*1.1,w[0],w[1],w[2]); }
  for(let i=0;i<segs;i++){ const a=i*3; oi.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5); }
  const og=new THREE.BufferGeometry(); og.setAttribute("position",new THREE.Float32BufferAttribute(op,3)); og.setAttribute("color",new THREE.Float32BufferAttribute(oc,3)); og.setIndex(oi); og.computeVertexNormals();
  root.add(new THREE.Mesh(og,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  /* the grandstand along the front stretch (south), with the crowd */
  const gsW=900, gs=new THREE.Mesh(new THREE.PlaneGeometry(gsW,60),new THREE.MeshLambertMaterial({map:(()=>{ const t=crowdTex(q.lo,true); t.repeat.set(gsW/30,3); return t; })(),side:THREE.DoubleSide}));
  gs.position.set(cx,22,cz+B+40+28); gs.rotation.x=-0.78; root.add(gs);
  const gsBack=new THREE.Mesh(new THREE.BoxGeometry(gsW,4,4),new THREE.MeshLambertMaterial({color:0x22222a})); gsBack.position.set(cx,44,cz+B+40+50); root.add(gsBack);
  /* the infield ground */
  const W=1500, D=900, cs=q.lo?40:24, nx=Math.ceil(W/cs), nz=Math.ceil(D/cs);
  const g=new THREE.PlaneGeometry(W,D,nx,nz); g.rotateX(-Math.PI/2); g.translate(cx,0,cz+40);
  const P=g.attributes.position, cl=new Float32Array(P.count*3), g1=lin("#6f7f45"), g2=lin("#a08f62");
  for(let i=0;i<P.count;i++){ const x=P.getX(i), z=P.getZ(i); P.setY(i,hf(x,z)-0.15); const n=fbm(x/50,z/50,3); const c=mixc(g1,g2,n*0.8); cl[i*3]=c[0]; cl[i*3+1]=c[1]; cl[i*3+2]=c[2]; }
  g.setAttribute("color",new THREE.BufferAttribute(cl,3)); g.computeVertexNormals();
  const gt=grassTex(q.lo); gt.repeat.set(W/12,D/12);
  root.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:gt,vertexColors:true})));
  /* the lake (north of the track) */
  const lake=new THREE.Mesh(new THREE.CircleGeometry(160,40),new THREE.MeshLambertMaterial({color:0x0a1a2c,emissive:0x02060c}));
  lake.rotation.x=-Math.PI/2; lake.scale.set(1.6,1,1); lake.position.set(cx+60,0.02,cz-220); root.add(lake);
  /* palms and light towers round the track */
  const R=rngf(4242), palms=[], towers=[];
  for(let k=0;k<400&&palms.length<(q.lo?30:70);k++){ const x=cx+(R()-0.5)*520, z=cz+(R()-0.5)*360; if(!clear(C,x,z,12)) continue; palms.push([x,z,0.8+R()*0.6]); }
  const palm=merge([xf(paint(new THREE.CylinderGeometry(0.22,0.34,9,6),lin("#6b5238")),0,4.5,0)].concat([0,1,2,3,4,5,6].map(i=>{ const g2=paint(new THREE.ConeGeometry(0.7,4.2,4),lin("#3c6b2c")); g2.rotateZ(Math.PI/2.2); g2.translate(2.0,0,0); g2.rotateY(i/7*Math.PI*2); g2.translate(0,9,0); return g2; })));
  const pm=new THREE.InstancedMesh(palm,new THREE.MeshLambertMaterial({vertexColors:true}),palms.length), M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3();
  palms.forEach((p,i)=>{ Q.setFromAxisAngle(new THREE.Vector3(0,1,0),p[0]); V.set(p[0],0,p[1]); S.set(p[2],p[2],p[2]); M.compose(V,Q,S); pm.setMatrixAt(i,M); }); pm.instanceMatrix.needsUpdate=true; root.add(pm);
  const glows=[];
  for(let i=0;i<10;i++){ const a=i/10*Math.PI*2, x=cx+Math.cos(a)*150, z=cz+Math.sin(a)*95; if(!clear(C,x,z,8)) continue; towers.push([x,z]); glows.push([x,31,z,10]); }
  const tg=paint(new THREE.CylinderGeometry(0.35,0.5,30,6),lin("#3a3c44")); tg.translate(0,15,0);
  const tm=new THREE.InstancedMesh(tg,new THREE.MeshLambertMaterial({vertexColors:true}),Math.max(1,towers.length)); towers.forEach((t,i)=>{ M.makeTranslation(t[0],0,t[1]); tm.setMatrixAt(i,M); }); tm.instanceMatrix.needsUpdate=true; root.add(tm);
  /* stadium-style lights along the far grandstand roof */
  for(let i=0;i<14;i++) glows.push([cx-gsW/2+gsW*(i+0.5)/14,48,cz+B+40+52,9]);
  ctx.glow(glows,0xfff1d6);
  ctx.hf=hf;
  ctx.sky(0x0a1024,0x2b3a66,0x6a4a5a);
  ctx.fog(0x101626,220,1100);
  return {cx:cx,cz:cz};
}

/* ---------------- the whole world ---------------- */
export function buildWorld(C,look,q){
  const root=new THREE.Group(), ctx={};
  ctx.dirt=dirtTex(look.soil,q.lo);
  const tm=ctx.dirt.clone(); tm.needsUpdate=true;
  const matTrack=new THREE.MeshLambertMaterial({map:tm,vertexColors:true});
  ctx.glowTex=glowTex();
  ctx.glow=function(list,color){
    if(q.lo) list=list.filter((g,i)=>i%2===0);
    const geo=new THREE.PlaneGeometry(1,1), mat=new THREE.ShaderMaterial({uniforms:{map:{value:ctx.glowTex},col:{value:new THREE.Color(color)}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
      vertexShader:"varying vec2 vUv; void main(){ vUv=uv; vec4 c=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.); float s=length(instanceMatrix[0].xyz); c.xy+=position.xy*s; gl_Position=projectionMatrix*c; }",
      fragmentShader:"uniform sampler2D map; uniform vec3 col; varying vec2 vUv; void main(){ vec4 t=texture2D(map,vUv); gl_FragColor=vec4(col*t.rgb*t.a*1.1,t.a); }"});
    const m=new THREE.InstancedMesh(geo,mat,list.length), M=new THREE.Matrix4(); list.forEach((g,i)=>{ M.makeScale(g[3],g[3],g[3]); M.setPosition(g[0],g[1],g[2]); m.setMatrixAt(i,M); });
    m.instanceMatrix.needsUpdate=true; m.frustumCulled=false; m.renderOrder=5; root.add(m); ctx.glowMesh=m;
  };
  ctx.sky=function(top,mid,hor,sun){
    const g=new THREE.SphereGeometry(2600,24,12), P=g.attributes.position, c=new Float32Array(P.count*3), t=lin("#"+top.toString(16).padStart(6,"0")), m=lin("#"+mid.toString(16).padStart(6,"0")), h=lin("#"+hor.toString(16).padStart(6,"0"));
    for(let i=0;i<P.count;i++){ const y=P.getY(i)/2600; const col=y>0.25?mixc(m,t,clamp((y-0.25)/0.6,0,1)):mixc(h,m,clamp(y/0.25+0.15,0,1)); c[i*3]=col[0]; c[i*3+1]=col[1]; c[i*3+2]=col[2]; }
    g.setAttribute("color",new THREE.BufferAttribute(c,3));
    const sky=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.BackSide,fog:false,depthWrite:false})); sky.renderOrder=-10; root.add(sky); ctx.skyMesh=sky;
    if(sun){ const s=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({map:ctx.glowTex,transparent:true,depthWrite:false,fog:false,blending:THREE.AdditiveBlending,color:0xfff3d0}));
      s.scale.set(420,420,1); ctx.sunMesh=s; root.add(s); }
  };
  ctx.fog=function(col,near,far){ ctx.fogC=[col,near,far]; };
  let info;
  if(C.kind==="stadium") info=stadium(C,look,q,root,ctx);
  else if(look.around==="beach-speedway"||C.kind==="hybrid") info=speedway(C,look,q,root,ctx);
  else info=outdoorWorld(C,look,q,root,ctx);
  const track=trackMesh(C,look,q,matTrack); root.add(track);
  if(C.kind!=="outdoor"&&look.around!=="hills-trees") root.add(edgeBlocks(C,look,q));
  const fin=finishBuild(C,look); root.add(fin.grp);
  return {root,ctx,track,fin,info,matTrack};
}
export {gateBuild,clear,lin,mixc,fbm,vnoise,glowTex,canvas,tex,rngf};
