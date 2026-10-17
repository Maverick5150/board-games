/* MOTOCROSS WAR 3D — THE TRACK SURFACE (owner: dirt). Everything the riders ride on: the soil colours, the dirt's detail maps (colour and
   normal, drawn in code), the track ribbon (berms, jump faces, whoops, sand, the start path) and the material it is drawn with, the
   tuff blocks / hay bales along the lane edges. Moved out of r3d-world.js byte for byte (the file split: no visual change).
   r3d-world.js calls trackMaterial() first and addTrack() where the track joins the scene; the stadium floor and the starting pad use
   dirtMaps() / padMaps() / SOIL from here. addTrack() returns {track, frame}: race3d.js calls frame(dt, riders) every frame if it is set. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {lin,mixc,clamp,sstep,vnoise,pfbm,canvas,tex,normalTex,rngf,merge,clear} from "./r3d-util.js";
const MXG=(typeof window!=="undefined"?window:globalThis).MXWar;
const CO=()=>MXG.Course;

/* ---------------- the soil and the dirt's detail maps ---------------- */
export const SOIL={ /* dirt colours (sRGB): the groomed track, a lighter worn line, the packed / wet dark */
  "stadium-dirt":["#8a6544","#a07a54","#5e432c"], loam:["#5c4430","#6f5539","#3c2c1f"], clay:["#8c5634","#a0673f","#5c361f"],
  hardpack:["#9a7a56","#b08e66","#6c5238"], sand:["#c2a170","#d6b986","#97784b"]
};
/* the dirt's DETAIL (a warm near-white with darker ruts, tyre tracks and stones): the colour is in the vertex colours / the material,
   so the two don't multiply into mud */
/* the dirt's DETAIL as two maps that tile with no seam: a warm near-white colour (the soil's colour is in the vertex colours, so the two
   don't multiply into mud) and a NORMAL map from the same relief, so the light rakes across real-looking dirt: knobby tyre grooves along
   the lanes (every which way on the floor), clods and stones that catch the light, a soft lumpy base. Polish: the old detail had a
   periodic "rut" band that drew tree rings in every turn and a hard seam every 5 m that looked like planks. */
export function dirtMaps(soil,lo,floor){
  const W=lo?256:512, N=W*W, R=rngf(1234+soil.length*17+(floor?7:0)), Hh=new Float32Array(N), A=new Float32Array(N), Gv=new Float32Array(N), Bv=new Float32Array(N);
  const sandy=soil==="sand", hard=soil==="hardpack";
  for(let j=0;j<W;j++) for(let i=0;i<W;i++){ const u=i/W, v=j/W, k=j*W+i;
    const n=pfbm(u*4,v*4,4,4), m=pfbm(u*24,v*24,24,2);
    Hh[k]=n*0.7+m*0.35; A[k]=0.86+(n-0.5)*0.24+(m-0.5)*(sandy?0.2:0.12); }
  const stamp=(cx,cy,rx,ry,fn)=>{ const x0=Math.floor(cx-rx), x1=Math.ceil(cx+rx), y0=Math.floor(cy-ry), y1=Math.ceil(cy+ry);
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){ const dx=(x-cx)/rx, dy=(y-cy)/ry, r2=dx*dx+dy*dy; if(r2>=1) continue; fn((((y%W)+W)%W)*W+(((x%W)+W)%W),1-r2); } };
  /* knobby tyre grooves: along the lanes (v = the direction of travel), crossing every way on the floor */
  const nT=floor?(lo?5:10):(lo?6:12);
  for(let t=0;t<nT;t++){
    let px=R()*W, py=R()*W; const ang=floor?R()*Math.PI*2:(R()-0.5)*0.08, dx=Math.sin(ang), dy=Math.cos(ang), w=W*(0.007+R()*0.006), dep=(sandy?0.5:0.35)+R()*0.3, kn=W*0.011, len=floor?W*(0.35+R()*0.5):W;
    for(let s=0;s<len;s+=1){ px+=dx+(floor?0:(R()-0.5)*0.12); py+=dy; const knob=Math.floor(s/kn)%2?1:0.62;
      stamp(px,py,w,w,(k,f)=>{ const g=dep*Math.sqrt(f)*knob; if(g>Gv[k]) Gv[k]=g; }); }
  }
  /* clods and stones */
  const nC=lo?600:2400;
  for(let c=0;c<nC;c++){ const cx=R()*W, cy=R()*W, r=(lo?0.5:1)*(0.7+R()*R()*(sandy?1.6:3.4)), h=(sandy?0.12:0.22)+R()*0.4;
    stamp(cx,cy,r*1.25,r,(k,f)=>{ const b=h*Math.sqrt(f); if(b>Bv[k]) Bv[k]=b; }); }
  if(hard||soil==="loam") for(let c=0;c<(lo?60:220);c++){ const cx=R()*W, cy=R()*W, r=0.8+R()*1.6; stamp(cx,cy,r,r*0.8,(k,f)=>{ Bv[k]=Math.max(Bv[k],0.5*f); A[k]=Math.max(A[k],0.98+0.06*f); }); }
  const c=canvas(W,W), x=c.getContext("2d"), id=x.createImageData(W,W), d=id.data;
  for(let k=0;k<N;k++){ Hh[k]+=Bv[k]-Gv[k]; const v=clamp(A[k]-Gv[k]*0.22+Bv[k]*0.1,0.5,1.06)*255, p=k*4; d[p]=clamp(v,0,255); d[p+1]=clamp(v*0.965,0,255); d[p+2]=clamp(v*0.92,0,255); d[p+3]=255; }
  x.putImageData(id,0,0);
  return {map:tex(c,true),normal:normalTex(Hh,W,(lo?2.2:3.2)*(sandy?0.8:1))};
}
/* the starting pad's dirt maps: drawn once per soil (the gate is rebuilt every race) */
const PADMAPS={};
export function padMaps(sk){ return PADMAPS[sk]||(PADMAPS[sk]=dirtMaps(sk,true,true)); }

/* ---------------- the track ribbon (and the start path) ---------------- */
function trackMesh(C,look,q,matTrack){
  const Co=CO(), S=SOIL[look.soil]||SOIL["stadium-dirt"], base=lin(S[0]), dark=lin(S[2]), lite=lin(S[1]), sandc=lin(SOIL.sand[1]), grassEdge=lin("#4f6b33");
  const outdoor=C.kind!=="stadium";
  /* lateral stations (17 in a stadium: the berms' curve is smooth; 13 on a wide outdoor track): the shoulders go down to the surroundings;
     outdoors a grass apron blends into the terrain */
  const fr=outdoor?[-1.85,-1.35,-1,-0.8,-0.56,-0.28,0,0.28,0.56,0.8,1,1.35,1.85]:[-1.85,-1.35,-1,-0.86,-0.72,-0.57,-0.42,-0.21,0,0.21,0.42,0.57,0.72,0.86,1,1.35,1.85];
  const nl=fr.length, pos=[], col=[], uv=[], pl=[], idx=[], prevX=new Float64Array(nl), prevZ=new Float64Array(nl), o={}, o2={};
  /* along the loop: a row every ds (2 ds with Reduce effects) where the dirt has shape (a feature, sand, braking bumps; a turn or a berm
     in a stadium), every 2 ds in an outdoor turn, up to 1.6 m apart on a plain straight outdoors (polish: RedBud's ribbon was 81k
     triangles); the last row is the first (the loop closes) */
  const st=C.ds*(q.lo?2:1), coarse=outdoor?Math.max(st,1.6):st, mid=outdoor?Math.max(st,C.ds*2):st, sv=[];
  const shaped=i=>C.F[i]>0.004||C.sand[i]>0.01||C.rough[i]>0, turning=i=>Math.abs(C.k[i])>1/45||C.bank[i]>0.04;
  for(let s=0;s<C.L-st*0.5;){ sv.push(s); let w=coarse;
    for(let t=s;t<=s+coarse+C.ds;t+=C.ds){ const i=Math.round(t/C.ds)%C.N; if(shaped(i)){ w=st; break; } if(turning(i)) w=Math.min(w,mid); }
    s+=w; }
  sv.push(C.L);
  for(let k=0;k<sv.length;k++){
    const s=sv[k], f=Co.frame(C,s,o), hw=f.hw, nx=-Math.sin(f.th), nz=Math.cos(f.th), ii=Math.round(s/C.ds)%C.N, sand=C.sand[ii]||0, rough=C.rough[ii]||0;
    /* the tightest radius near here (the curvature is sampled, so look a little either side) */
    const kk=Math.max(Math.abs(f.k),Math.abs(Co.frame(C,s-1.5,o2).k),Math.abs(Co.frame(C,s+1.5,o2).k)), Rk=1/Math.max(1e-4,kk), inSide=f.k>0?1:-1;   /* the inside of a right turn is the right (+) */
    const lim=0.8*Rk, knee=0.55*lim;
    const Fh=C.F[ii]||0, Fs=Math.abs((C.F[(ii+1)%C.N]||0)-(C.F[(ii-1+C.N)%C.N]||0))/(2*C.ds);
    /* outdoors a tall feature gets wider shoulders (a jump's sides slope down like a real pile of dirt, not a wall), as far as the room
       beside it allows */
    const sideW=[2.6,2.6];
    if(outdoor) [-1,1].forEach((sd,m)=>{ const eh=Co.ground(C,s,sd*hw)-f.y; if(eh<0.45) return; let w=2.6*(1+Math.min(eh,4)*0.55);
      const room=roomBeside(C,f.x+nx*sd*hw,f.z+nz*sd*hw,s,30); w=Math.max(2.6,Math.min(w,room-1.5)); sideW[m]=w; });
    for(let j=0;j<nl;j++){
      const u=fr[j], a=Math.abs(u); let lat=a<=1?u*hw:Math.sign(u)*(hw+(a-1)*sideW[u<0?0:1]);
      /* inside a tight turn the stations are squeezed smoothly (never past 80% of the radius, never crossing): no folded triangles */
      if(Math.sign(lat)===inSide&&Math.abs(lat)>knee){ const xx=Math.abs(lat); lat=inSide*(knee+(lim-knee)*Math.tanh((xx-knee)/Math.max(0.01,lim-knee))); }
      let y, edge=0;
      if(a<=1) y=Co.ground(C,s,lat);
      else { edge=Co.ground(C,s,Math.sign(u)*hw); const t=(a-1)/0.85; y=edge+(f.y-(outdoor?0.55:0.3)-edge)*sstep(0,1,t); }   /* the shoulder dips under the ground at its outer edge */
      let vx=f.x+nx*lat, vz=f.z+nz*lat;
      /* small lumps and braking bumps (in world space: no stripes along the stations) */
      if(a<0.9) y+=(vnoise(vx*0.9,vz*0.9)-0.5)*0.05+rough*0.06*Math.sin(s*2.4)*(1-a);
      /* never behind the same station of the row before (a hairpin tighter than the track is wide): the inside fans round a point
         instead of folding back over itself */
      if(k>0){ const al=(vx-prevX[j])*Math.cos(f.th)+(vz-prevZ[j])*Math.sin(f.th); if(al<0.02){ vx+=Math.cos(f.th)*(0.02-al); vz+=Math.sin(f.th)*(0.02-al); } }
      prevX[j]=vx; prevZ[j]=vz;
      pos.push(vx,y,vz);
      /* colour: the main line darker and moist, the edges lighter and drier, berm faces packed, sand pale, the outside shoulders grass outdoors
         (only near the ground: a jump's sides are dirt) */
      const groove=Math.exp(-Math.pow(u*2.0,2)), bermFace=a>0.55&&a<=1?C.bank[ii]/2:0;
      let c=mixc(base,dark,groove*0.2+bermFace*0.3);
      c=mixc(c,lite,(a>0.78&&a<=1)?0.32:0);
      /* the tops of whoops, mounds and jumps catch the light, the troughs and steep faces are darker */
      const hs=Fh>0.05?clamp(0.86+0.26*clamp(Fh/1.4,0,1)-0.16*clamp(Fs,0,1),0.66,1.14):1;
      c=[c[0]*hs,c[1]*hs,c[2]*hs];
      if(sand>0) c=mixc(c,sandc,sand*0.85);
      if(a>1){ const hAbove=y-(f.y-0.55);
        c=outdoor?mixc(mixc(base,lite,0.3),grassEdge,sstep(1.05,1.8,a)*(1-sstep(0.35,1.1,hAbove))):mixc(mixc(base,dark,0.4),dark.map(v=>v*0.78),sstep(1.0,1.85,a)); }
      const wn=0.9+(vnoise(vx*0.13,vz*0.13)*0.65+vnoise(vx*0.41+11,vz*0.41)*0.35)*0.2;   /* damp and dry patches, in world space */
      col.push(c[0]*wn,c[1]*wn,c[2]*wn);
      uv.push(lat/5,s/5);
      /* the inside of a hairpin: the dirt's detail is drawn flat in world space there (polish: the lane-following grooves wound into a
         whorl round the apex) */
      const rIn=Math.sign(lat)===inSide?Rk-Math.abs(lat):1e9; pl.push(Rk<16?1-sstep(2.5,7.5,rIn):0);
    }
  }
  /* wound so the faces look UP (lat runs to the right of the direction of travel): from above they are front faces, lit by the sun */
  for(let k=0;k<sv.length-1;k++) for(let j=0;j<nl-1;j++){ const a=k*nl+j, b=a+1, c2=a+nl, d=c2+1; idx.push(a,b,c2,b,d,c2); }
  /* close the loop: the last ring is the first */
  const g=new THREE.BufferGeometry(); g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3)); g.setAttribute("color",new THREE.Float32BufferAttribute(col,3));
  g.setAttribute("uv",new THREE.Float32BufferAttribute(uv,2)); g.setAttribute("aPlan",new THREE.Float32BufferAttribute(pl,1)); g.setIndex(idx); g.computeVertexNormals();
  const parts=[g];
  /* the start path */
  if(C.S&&C.S.n){
    const P2=[], C2=[], U2=[], I2=[], S2=C.S, fr2=[-1.5,-1,-0.6,-0.2,0,0.2,0.6,1,1.5], nl2=fr2.length, st2=Math.max(1,Math.round(st/S2.ds));
    let rows=0;
    /* where the start path lies on the loop (where it merges, or where a stadium start crosses other lanes) it tucks just under the loop's
       dirt, so the two surfaces never fight for the same pixels */
    const lst=Math.max(1,Math.round(1/C.ds)), onLoop=(x,z)=>{ for(let i=0;i<C.N;i+=lst){ const dx=C.x[i]-x, dz=C.z[i]-z, r=C.hw[i]+0.3; if(dx*dx+dz*dz<r*r) return true; } return false; };
    for(let i=0;i<S2.n;i+=st2){ rows++; const th=S2.th[i], nx=-Math.sin(th), nz=Math.cos(th), hw=S2.hw[i], y0=S2.y[i]||0;
      for(let j=0;j<nl2;j++){ const u=fr2[j], a=Math.abs(u), lat=u*hw+(a>1?(a-1)*3*Math.sign(u):0); let y=a<=1?y0+0.02+(vnoise(i*0.4,lat)-0.5)*0.04:y0-0.06;
        const px=S2.x[i]+nx*lat, pz=S2.z[i]+nz*lat; if(onLoop(px,pz)) y=Math.min(y,y0-0.14);
        P2.push(px,y,pz); const c=a>1?(outdoor?grassEdge:mixc(base,dark,0.25)):mixc(base,dark,Math.exp(-u*u*3)*0.25); C2.push(c[0],c[1],c[2]); U2.push(lat/5,i*S2.ds/5); } }
    for(let k=0;k<rows-1;k++) for(let j=0;j<nl2-1;j++){ const a=k*nl2+j, b=a+1, c2=a+nl2, d=c2+1; I2.push(a,b,c2,b,d,c2); }
    const g2=new THREE.BufferGeometry(); g2.setAttribute("position",new THREE.Float32BufferAttribute(P2,3)); g2.setAttribute("color",new THREE.Float32BufferAttribute(C2,3)); g2.setAttribute("uv",new THREE.Float32BufferAttribute(U2,2)); g2.setAttribute("aPlan",new THREE.Float32BufferAttribute(new Float32Array(P2.length/3),1)); g2.setIndex(I2); g2.computeVertexNormals();
    parts.push(g2);
  }
  let geo=parts[0];
  if(parts.length>1){ /* one mesh (merge() keeps position, normal, colour, uv; the hairpin weight is carried here) */
    const nonI=parts.map(q=>q.index?q.toNonIndexed():q); geo=merge(nonI);
    const A=new Float32Array(geo.attributes.position.count); let o3=0; nonI.forEach(q=>{ const c=q.attributes.position.count, a=q.attributes.aPlan; if(a) A.set(a.array,o3); o3+=c; });
    geo.setAttribute("aPlan",new THREE.BufferAttribute(A,1)); }
  const mesh=new THREE.Mesh(geo,matTrack);
  mesh.receiveShadow=true;
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

/* how far (x, z) is from the nearest OTHER part of the track: samples within skip m of loop distance s don't count (its own section) */
function roomBeside(C,x,z,s,skip){
  const st=Math.max(1,Math.round(1/C.ds)); let best=1e9;
  for(let i=0;i<C.N;i+=st){ let dd=Math.abs(i*C.ds-s); dd=Math.min(dd,C.L-dd); if(dd<skip) continue; const dx=C.x[i]-x, dz=C.z[i]-z, d=Math.sqrt(dx*dx+dz*dz)-C.hw[i]; if(d<best) best=d; }
  if(C.S&&C.S.n) for(let i=0;i<C.S.n;i+=st){ const dx=C.S.x[i]-x, dz=C.S.z[i]-z, d=Math.sqrt(dx*dx+dz*dz)-C.S.hw[i]; if(d<best) best=d; }
  return best;
}

/* ---------------- the track's material and its scene objects ---------------- */
/* the material the track ribbon is drawn with (colour + normal detail map, the vertex colours, the hairpin shader patch) -> {mat, dirt (the colour map)} */
export function trackMaterial(look,q){

  const dm=dirtMaps(look.soil,q.lo,false);
  /* both sides: at a traced hairpin tighter than the track is wide the inside folds over itself; drawn from both sides it never shows a hole.
     The normal map rakes the light across the grooves and clods (polish) */
  const matTrack=new THREE.MeshLambertMaterial({map:dm.map,normalMap:dm.normal,normalScale:new THREE.Vector2(1,1),vertexColors:true,side:THREE.DoubleSide});
  /* aPlan (the inside of a hairpin): the detail sampled flat in world space there, its relief faded (no whorl of grooves at the apex) */
  matTrack.onBeforeCompile=sh=>{
    sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nattribute float aPlan;\nvarying float vPlan;\nvarying vec2 vWxz;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\nvPlan=aPlan; vWxz=(modelMatrix*vec4(transformed,1.0)).xz*0.2;");
    sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nvarying float vPlan;\nvarying vec2 vWxz;")
      .replace("#include <map_fragment>","#ifdef USE_MAP\n vec4 sampledDiffuseColor=mix(texture2D(map,vMapUv),texture2D(map,vWxz),vPlan);\n diffuseColor*=sampledDiffuseColor;\n#endif")
      .replace("#include <normal_fragment_maps>",THREE.ShaderChunk.normal_fragment_maps.replace("mapN.xy *= normalScale;","mapN.xy *= normalScale*(1.0-vPlan);"));
  };
  matTrack.customProgramCacheKey=()=>"mx-track";
  return {mat:matTrack,dirt:dm.map};
}
/* the track and the lane-edge blocks, added to the world's root -> {track, frame}; frame(dt, riders) is optional (set it for per-frame work:
   tyre tracks, ruts that deepen...), called by race3d.js with the riders' per-frame state (CONTRACT.md) */
export function addTrack(C,look,q,root,mat){
  const track=trackMesh(C,look,q,mat); root.add(track);
  if(C.kind!=="outdoor"&&look.around!=="hills-trees") root.add(edgeBlocks(C,look,q));
  return {track:track,frame:null};
}
