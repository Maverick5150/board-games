/* MOTOCROSS WAR 3D — THE DIRT'S RELIEF (owner: dirt). Pure maths, no three.js, no DOM: a height field in TRACK SPACE (s along the lap, lat across) made from
   the course numbers (curvature, berms, features, the speed profile) and a seed. One field feeds everything, so the wheels, the mesh and the lighting agree:
     phys   the smooth part (ruts, berm grooves, windrows, whoop erosion, swells, half of the braking-bump crests) on a grid of rows x columns: the mesh's
            heights, and the ground the wheels follow (r3d-track.js adds delta() to Course.ground), so a wheel sits IN a rut and never floats or sinks
     moist  how wet the dirt is (0..255: dark and shiny in ruts and on the racing line, dry and pale on crests and edges); tone = a slow colour drift
     fine() the detail a mesh can't carry, as a track-space texture: R,G = the slope along / across the track (tyre grooves, braking bumps, roost ripples, clods),
            B = cavity (ambient occlusion from the whole relief), A = loose-dirt mask (the shader blends the crumbly scan in there)
   The riders' racing line is the one race3d.js uses (outside of a corner at 0.36 of the half width), so the ruts lie where the wheels go. */
const TAU=Math.PI*2;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function sstep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }

/* seeded value noise on a 256 lattice (typed arrays: a texel costs a few ns) */
function noiseKit(seed){
  let r=(seed>>>0)||1; const rnd=()=>{ r^=r<<13; r>>>=0; r^=r>>>17; r^=r<<5; r>>>=0; return r/4294967296; };
  const P=new Uint8Array(512), T=new Float32Array(256); const perm=[]; for(let i=0;i<256;i++){ perm.push(i); T[i]=rnd(); }
  for(let i=255;i>0;i--){ const j=Math.floor(rnd()*(i+1)); const t=perm[i]; perm[i]=perm[j]; perm[j]=t; } for(let i=0;i<512;i++) P[i]=perm[i&255];
  function n2(x,y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf), X=xi&255, Y=yi&255;
    const a=T[P[P[X]+Y]], b=T[P[P[X+1]+Y]], c=T[P[P[X]+Y+1]], d=T[P[P[X+1]+Y+1]]; return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
  function f2(x,y,o){ let s=0, a=0.5, f=1, w=0; for(let i=0;i<o;i++){ s+=a*n2(x*f+i*17.3,y*f-i*9.1); w+=a; f*=2.02; a*=0.5; } return s/w; }
  return {n2,f2,rnd};
}

/* the course arrays sampled at loop distance s (linear, wrapping) */
function sampler(C){ const N=C.N, ds=C.ds, L=C.L; return (A,s)=>{ s%=L; if(s<0) s+=L; const x=s/ds, i=Math.floor(x), f=x-i, a=A[i%N], b=A[(i+1)%N]; return a+(b-a)*f; }; }

/* the whoop (or roller) at loop distance s: {ix: its index in the row (the nearest crest), h: its height}; course.js gives every whoop its crest (f.crests = [[s, h], ...]) */
function whoopAt(feats,s){
  for(let q=0;q<feats.length;q++){ const f=feats[q]; if((f.k!=="whoops"&&f.k!=="rollers")||s<f.from-1||s>f.to+1) continue;
    if(f.crests&&f.crests.length){ let j=0, d=1e9; for(let c=0;c<f.crests.length;c++){ const e=Math.abs(f.crests[c][0]-s); if(e<d){ d=e; j=c; } } return {ix:j,h:f.crests[j][1]}; }
    const sp=f.sp||((f.to-f.from)/(f.n||5)); return {ix:Math.max(0,Math.floor((s-f.from)/sp)),h:f.h||0.75}; }
  return {ix:Math.floor(s/4),h:0.75};
}
/* the rows of per-s facts (n rows over the lap) */
function makeRows(C,n,K){
  const L=C.L, ds=L/n, at=sampler(C), R={n:n,ds:ds};
  const f=()=>new Float32Array(n);
  Object.assign(R,{hw:f(),side:f(),A:f(),k:f(),la:f(),line:f(),bank:f(),F:f(),Fs:f(),rough:f(),sand:f(),acc:f(),whoop:f(),brake:f(),accel:f(),
    gc0:f(),gc1:f(),gc2:f(),ga0:f(),ga1:f(),ga2:f(),gw:f(),bph:f(),blam:f(),aph:f(),alam:f(),wind:f(),wnd:f(),swirl:f(),hi:f(),gen:f(),land:f(),pile:f(),wix:f(),wh:f()});
  const feats=C.feats||[], vA=C.v, N=C.N;
  let bp=0, ap=0;
  for(let i=0;i<n;i++){
    const s=i*ds, hw=at(C.hw,s); R.hw[i]=hw;
    const kk=at(C.k,s+4), kl=at(C.k,s+9);               /* the corner a little ahead (the ruts start before the corner) and the one race3d.js looks at (the racing line) */
    R.k[i]=at(C.k,s); R.side[i]=Math.sign(kk);
    R.A[i]=sstep(1/48,1/13,Math.abs(kk));
    R.la[i]=sstep(1/48,1/13,Math.abs(kl));
    R.line[i]=Math.abs(kl)>1/30?-Math.sign(kl)*hw*0.36:0;   /* the step race3d.js's riders aim at (smoothed below) */
    R.bank[i]=at(C.bank,s); R.F[i]=at(C.F,s); R.Fs[i]=(at(C.F,s+0.5)-at(C.F,s-0.5));
    R.rough[i]=at(C.rough,s); R.sand[i]=at(C.sand,s);
    /* acceleration along the lap: v dv/ds */
    const v=at(vA,s), dv=(at(vA,s+1)-at(vA,s-1))/2; R.acc[i]=v*dv;
    /* tags */
    const ii=Math.round(s/C.ds)%N, tg=C.tag?C.tag[ii]:""; R.whoop[i]=(tg==="whoops"||tg==="rollers")?1:0; R.gen[i]=0;
    R.hi[i]=(tg==="jump"||tg==="bigjump"||tg==="rhythm")?1:0;
    /* (2026-10-19) the whoop this row is on: its index along the row (each one its own noise) and its height (the scour and the crests scale with it); the tags work since the
       course's C.N fix, so this block (written for 1.05 m whoops 3.75 m apart) runs for the first time: everything in it is relative to the whoop's own size now */
    if(R.whoop[i]){ const w=whoopAt(feats,s); R.wix[i]=w.ix; R.wh[i]=w.h; }
    /* the straight-line grooves (three wandering tyre tracks) */
    const w0=K.n2(s*0.045,3.1), w1=K.n2(s*0.05,11.7), w2=K.n2(s*0.04,23.9);
    R.gc0[i]=-0.62+(w0-0.5)*0.9; R.gc1[i]=(w1-0.5)*0.7; R.gc2[i]=0.62+(w2-0.5)*0.9;
    R.ga0[i]=Math.max(R.whoop[i]*0.9,sstep(0.22,0.48,K.n2(s*0.11,41.3))); R.ga1[i]=Math.max(R.whoop[i]*0.8,sstep(0.2,0.45,K.n2(s*0.09,53.1))); R.ga2[i]=Math.max(R.whoop[i]*0.9,sstep(0.22,0.48,K.n2(s*0.1,67.9)));
    R.gw[i]=0.11+0.04*K.n2(s*0.2,5.5);
    /* braking bumps: a run of ripples where the lap slows hard (and on the layout's rough stretches); the wavelength drifts a little, the phase is a running sum */
    const brk=clamp(-R.acc[i]/6.5,0,1), rg=R.rough[i]>0?clamp(R.rough[i],0,1.4):0;
    R.brake[i]=clamp(brk*0.9+rg*0.7,0,1)*(1-0.7*R.hi[i])*(1-R.whoop[i]);
    R.blam[i]=0.52+0.22*K.n2(s*0.07,77.7)+0.1*(1-brk);
    bp+=TAU*ds/R.blam[i]; R.bph[i]=bp;
    R.accel[i]=clamp((R.acc[i]-1.6)/3.5,0,1)*(1-0.8*R.hi[i])*(1-R.whoop[i]);
    R.alam[i]=0.85+0.3*K.n2(s*0.06,91.3); ap+=TAU*ds/R.alam[i]; R.aph[i]=ap;
    /* the windrow of loose dirt at each edge: how tall, and the second noise that breaks it up */
    R.wind[i]=0.03+0.07*sstep(0.35,0.75,K.n2(s*0.3,111.1)); R.wnd[i]=K.n2(s*1.1,5.7);
  }
  /* where a jump's arc touches down: the bikes' wheels scoop the face (a shallow dish, tyre-scuffed) and push a pile of dirt ahead of it */
  (C.arcs||[]).forEach(A=>{ if(A.kind==="drop"||A.kind==="stepup") return; const b=A.b;
    for(let i=0;i<n;i++){ const s=i*ds; let d=s-b; if(d>L/2) d-=L; if(d<-L/2) d+=L; R.land[i]=Math.max(R.land[i],Math.exp(-Math.pow((d-0.3)/1.15,2))); R.pile[i]=Math.max(R.pile[i],Math.exp(-Math.pow((d-2.3)/0.8,2))); } });
  /* the ruts fade in before a corner and trail off 16 m after it (the bikes keep digging on the way out): the strongest recent corner decides the amount and the side;
     the racing line is smoothed over the few metres a rider takes to move across */
  const nT=Math.max(1,Math.round(16/ds)), A0=R.A.slice(), S0=R.side.slice();
  for(let i=0;i<n;i++){ let best=A0[i], bs=S0[i]; for(let q=1;q<=nT;q++){ const j=(i-q+n)%n, v=A0[j]*(1-q/nT); if(v>best){ best=v; bs=S0[j]; } } R.A[i]=best; R.side[i]=bs; }
  const w=Math.max(1,Math.round(3.5/ds)), l0=R.line.slice(); let acc=0; for(let q=-w;q<=w;q++) acc+=l0[(q+n)%n];
  for(let i=0;i<n;i++){ R.line[i]=acc/(2*w+1); acc+=l0[(i+w+1)%n]-l0[((i-w)%n+n)%n]; }
  return R;
}

const cube=t=>t*t*Math.sqrt(t);
/* one rut: a trench (1-a^2)^1.5 of half width w and depth D, with a lip of pushed dirt either side */
function rut(d,w,D){ const a=Math.abs(d)/w; if(a<1){ const t=1-a*a; return -D*t*Math.sqrt(t); }
  const e=(a-1)*w/(0.34*w+0.16); if(e<1){ const q=1-e; return D*0.5*6.75*e*q*q; } return 0; }

/* the main corner rut, asymmetric: the outside wall steep with a lip of pushed dirt (half width w), the inside wall a gentle slope with no lip (half width wi: the riders'
   inside feet knock it down, and a dabbed boot is not buried in a wall); d = lat - the rut's centre, side = the inside of the corner (+1 right) */
function rutA(d,w,wi,D,side){ if(d*side>0){ const a=Math.abs(d)/wi; if(a>=1) return 0; const t=1-a*a; return -D*t*Math.sqrt(t); } return rut(d,w,D); }

/* the smooth field at one row r (rows object R) and lateral position lat: height (m), moisture 0..1, traffic 0..1 (where the wheels pass: it wears first) and loose 0..1
   (pushed-up, crumbly dirt: rut lips, berm lips, windrows); K = noise kit; the profile of every smooth part is here.
   Milestone 2 (the cover's dirt): the main rut on the racing line is 20-28 cm deep (was 12-16), its bottom wanders and its depth comes and goes (dug by many lines, chopped by
   the braking); the two braided wings split off and rejoin; the berm's outside edge carries a lip of loose dirt the riders threw up; three soil families by moisture (the
   track's colour reads them: wet dark brown in the ruts and on the line, mid brown, dry tan on crests, lips and edges), with big watered patches across the floor. */
function smoothAt(R,i,s,lat,K,out){
  const hw=R.hw[i], a=Math.abs(lat);
  const edge=(1-sstep(hw-0.28,hw-0.02,a))*sstep(1.2,4.5,Math.min(s,R.ds*R.n-s));   /* everything dies at the track's edge (the ribbon's shoulders are not mine) and flattens at the finish line */
  let h=0, wet=0.4, loose=0.12;
  if(edge<=0){ out.h=0; out.wet=0.16; out.traf=0; out.loose=0.6; return out; }
  const A=R.A[i], side=R.side[i], lc=R.line[i];
  /* how much of a corner's racing line this row has (0 on a straight, 1 in a corner): the smoothed line over its full value */
  const cw=clamp(Math.abs(lc)/Math.max(0.5,hw*0.36),0,1);
  /* corner ruts: the main trench on the racing line, two wings (braided), the high line up the berm face, an inside line */
  if(A>0.001){
    const n1=K.n2(s*0.13,7.7), n2=K.n2(s*0.17,19.3), n3=K.n2(s*0.11,29.9), n4=K.n2(s*0.14,43.1), n5=K.n2(s*0.47,61.7), wan=(K.n2(s*0.19,71.3)-0.5)*0.18;
    const D0=0.235*A*(0.84+0.3*n1)*(0.88+0.24*n5), w0=0.31+0.08*n2;
    const r0=rutA(lat-lc-wan,w0,w0*2.3,D0,side);
    const r1=rut(lat-(lc+side*(0.58+0.14*n3)),0.24,0.13*A*sstep(0.18,0.5,n3));
    const r2=rut(lat-(lc-side*(0.6+0.12*n4)),0.25,0.14*A*sstep(0.18,0.5,n4));
    const r3=rut(lat-(-side*(hw*0.8+0.1*n1)),0.27,0.16*A*sstep(0.18,0.5,n2)*(0.6+0.4*R.bank[i]));
    const r4=rut(lat-(side*hw*0.3),0.26,0.08*A*sstep(0.22,0.5,n1));
    const rs=(r0+r1+r2+r3+r4)*(R.rutK||1);   /* (the TV's coarse mesh draws them at 65%: o.rut) */
    h+=rs; if(rs<0) wet+=A*(-rs)*5.0; else { wet-=rs*3.2; loose+=rs*7.5; }   /* the rut bottoms are the wettest dirt; the lips are dry crumbly pushed dirt */
  }
  /* the windrows of loose dirt at both edges; on the outside of a corner the berm's lip: the dirt the riders threw up the face, lumpy along the lap */
  { const c=hw-0.52, x=(a-c)/0.4; if(x>-1&&x<1){ const t=1-x*x, hb=R.wind[i]*(0.55+0.9*K.n2(s*0.9+(lat>0?31:0),9.3))*t*t; h+=hb; wet-=0.2*t; loose+=0.55*t; } }
  if(A>0.001&&Math.sign(lat)===-side){ const c=hw-0.62, x=(a-c)/0.5; if(x>-1&&x<1){ const t=1-x*x, lump=0.55+0.75*K.n2(s*1.35,lat*0.8+17.1)+0.35*(K.n2(s*3.1,lat*2.2+5.3)-0.5);
    const hb=A*0.14*lump*t*t; h+=hb; wet-=0.28*t*A; loose+=0.7*t*A; } }
  /* whoops: the troughs are scoured, every crest a little uneven across the lane */
  if(R.whoop[i]>0){ const f=R.F[i], wh=Math.max(0.3,R.wh[i]||0.75), ix=R.wix[i]; h+=-0.035*sstep(0.36*wh,0,f)*R.whoop[i]; h+=0.024*(K.n2(lat*0.55+ix*7.1,ix*3.3)-0.5)*2*sstep(0.55*wh,0.95*wh,f);
    wet-=0.25*sstep(0.6*wh,wh,f); loose+=0.25*sstep(0.65*wh,wh,f); }   /* the troughs scoured by the tyres (3.5 cm), every crest a little uneven across the lane (+-2.4 cm), the crests dry and loose */
  /* slow swells, wavelength well above the springs' resonance */
  h+=(K.f2(s*0.075,lat*0.22,2)-0.5)*0.026;
  /* the traffic: where the wheels go. In a corner the riders hold the racing line (+-0.2 m, the wings when they pass); on a straight they spread over +-0.6 m */
  const tc=Math.exp(-Math.pow((lat-lc)/0.5,2))+0.4*Math.exp(-Math.pow((lat-lc-side*0.62)/0.3,2))+0.4*Math.exp(-Math.pow((lat-lc+side*0.62)/0.3,2));
  const tsI=1-sstep(0.7,1.5,Math.abs(lat-lc*0.5)), traf=clamp(tc*cw+tsI*(1-cw)*0.9,0,1);
  /* the racing line is packed and darker; crests and edges are dry */
  wet+=0.26*traf;
  wet-=0.32*sstep(hw*0.55,hw,a); wet-=0.24*sstep(0.35,1.0,R.F[i]/1.3);
  { const wx=s+(K.n2(s*0.08,lat*0.2+3)-0.5)*7, wy=lat+(K.n2(s*0.1+9,lat*0.25)-0.5)*2.6; wet+=(K.f2(wx*0.075,wy*0.3+50,3)-0.5)*0.42; }
  /* big watered patches (the crew's water trucks: dark wet stretches and dry pale ones, 15-30 m across) */
  wet+=(sstep(0.3,0.7,K.f2(s*0.035+3.7,lat*0.09+81.3,2))-0.5)*0.36;
  /* the braking bumps' crests (the wheels ride the crests: half the amplitude is in the ground the wheels follow) */
  const bAmp=R.brake[i]*0.05*Math.exp(-Math.pow((lat-lc*0.5)/1.8,2));
  h+=bAmp*0.5; h+=R.accel[i]*0.017*Math.exp(-Math.pow((lat-lc*0.5)/1.1,2))*0.5;
  loose+=0.3*sstep(hw*0.5,hw,a)-0.15*traf;
  out.h=h*edge; out.wet=clamp(wet,0,1); out.traf=traf*edge; out.loose=clamp(loose,0,1); return out;
}

/* the field on the mesh's grid: nl columns across [-LATR, LATR] (nl odd), ns rows. Returns the arrays and the samplers */
export function buildRelief(C,o){
  o=o||{}; const L=C.L, ns=4*Math.max(2,Math.round(L/(4*(o.ds||0.25)))), ds=L/ns;   /* a multiple of 4 rows: the mesh's three levels of detail all land on whole rows */
  let LATR=0; for(let i=0;i<C.N;i++) if(C.hw[i]>LATR) LATR=C.hw[i];
  const nl=o.nl||51, dl=2*LATR/(nl-1), K=noiseKit(((C.id||"").length*2654435761+(Math.round(L*10)))>>>0);
  const rows=makeRows(C,ns,K); rows.rutK=o.rut||1; const phys=new Float32Array(ns*nl), moist=new Uint8Array(ns*nl), tone=new Uint8Array(ns*nl), traf=new Uint8Array(ns*nl), loose=new Uint8Array(ns*nl), tmp={h:0,wet:0,traf:0,loose:0};
  for(let i=0;i<ns;i++){ const s=i*ds;
    for(let j=0;j<nl;j++){ const lat=-LATR+j*dl, k=i*nl+j; smoothAt(rows,i,s,lat,K,tmp); phys[k]=tmp.h; moist[k]=Math.round(tmp.wet*255); traf[k]=Math.round(tmp.traf*255); loose[k]=Math.round(tmp.loose*255);
      tone[k]=Math.round(clamp(0.5+(K.f2(s*0.045,lat*0.13+9,3)-0.5)*0.9+(K.n2(s*0.3,lat*0.5)-0.5)*0.12,0,1)*255); } }
  const Rl={ns:ns,nl:nl,ds:ds,dl:dl,LATR:LATR,L:L,phys:phys,moist:moist,tone:tone,traf:traf,loose:loose,rows:rows,K:K,C:C};
  /* at(A, s, lat): bilinear sample of any of the grid arrays (the loop wraps along s, the lateral edge clamps) */
  Rl.at=function(A,s,lat){
    s%=L; if(s<0) s+=L; const x=s/ds, i0=Math.floor(x), fx=x-i0, i1=(i0+1)%ns, y=clamp((lat+LATR)/dl,0,nl-1.0001), j0=Math.floor(y), fy=y-j0, j1=j0+1, a=(i0%ns)*nl, b=i1*nl;
    const p00=A[a+j0], p01=A[a+j1], p10=A[b+j0], p11=A[b+j1];
    return (p00+(p01-p00)*fy)*(1-fx)+(p10+(p11-p10)*fy)*fx;
  };
  /* delta(s, lat): the ground the wheels follow (the mesh's heights; zero outside the track, and fading to zero at the finish line so the painted line lies flat) */
  Rl.delta=function(s,lat){ if(lat>=LATR||lat<=-LATR) return 0; return Rl.at(phys,s,lat); };
  /* lineAt(s): the racing line's lateral offset (m, + right) the ruts lie on: the outside of a corner at 0.36 of the half width, smoothed (race3d.js's riders aim at the same, unsmoothed) */
  Rl.lineAt=function(s){ s%=L; if(s<0) s+=L; const x=s/ds, i0=Math.floor(x), f=x-i0, a=rows.line[i0%ns], b=rows.line[(i0+1)%ns]; return a+(b-a)*f; };
  Rl.fine=(nt,nv)=>fineMap(Rl,nt,nv);
  Rl.wear=(nt,nv)=>wearMap(Rl,nt,nv);
  return Rl;
}

/* THE WEAR MAP (milestone 2: the track wears over the race). The tyre grooves the race itself cuts, in the same track space as the fine map: NG lines that follow where the wheels
   really go (in a corner the racing line and its wings, on a straight the riders' spread of +-0.6 m), each with the lap fraction it appears at (the shader shows a groove once the
   race's wear passes its threshold, so new grooves arrive lap by lap); -> RGBA8: R,G = the grooves' slopes (along / across, per metre, 0.5 = flat), B = the groove itself (a darker,
   packed, wetter strip), A = its threshold 0..1 (255 = never). Pure, deterministic. */
function wearMap(Rl,nt,nv){
  const L=Rl.L, LATR=Rl.LATR, K=Rl.K, dsT=L/nt, dlT=2*LATR/nv, rows=Rl.rows, NG=11;
  const F=new Float32Array(nt*nv), TH=new Float32Array(nt*nv).fill(1), GM=new Float32Array(nt*nv);
  for(let g=0;g<NG;g++){
    const off=((g+0.5)/NG-0.5)*2, thr=0.04+((g*0.6180339)%1)*0.86, dep=0.03+0.02*((g*0.37)%1), hwG=0.06+0.025*((g*0.53)%1);
    for(let i=0;i<nt;i++){
      const s=(i+0.5)*dsT, ri=Math.min(rows.n-1,Math.floor(s/rows.ds)), hw=rows.hw[ri], lc=Rl.lineAt(s), cw=clamp(Math.abs(lc)/Math.max(0.5,hw*0.36),0,1);
      /* the line this groove takes: a corner's racing line (+-0.45 m, braided out to the wings) or a straight's lane (+-0.62 m), wandering a little */
      const c=cw*(lc+off*0.45+(Math.abs(off)>0.7?Math.sign(off)*0.2:0))+(1-cw)*(off*0.62)+(K.n2(s*0.07+g*13.1,g*7.7)-0.5)*0.22+(K.n2(s*0.5+g*3.3,g*2.9)-0.5)*0.035;
      const fade=sstep(0.15,0.55,K.n2(s*0.045+g*5.7,g*11.3))*sstep(1.2,4.5,Math.min(s,L-s));   /* a groove comes and goes along the lap (lines cross and part) */
      if(fade<=0.01) continue;
      const j0=Math.max(0,Math.floor((c-hwG*1.6+LATR)/dlT)), j1=Math.min(nv-1,Math.ceil((c+hwG*1.6+LATR)/dlT));
      for(let j=j0;j<=j1;j++){ const lat=-LATR+(j+0.5)*dlT, d=(lat-c)/hwG, k=i*nv+j;
        if(Math.abs(lat)>hw-0.25) continue;
        if(d*d<1){ const t=1-d*d, v=-dep*t*t*fade; if(v<F[k]){ F[k]=v; TH[k]=Math.min(TH[k],thr); } GM[k]=Math.max(GM[k],t*fade); }
        else if(d*d<2.56){ const e=(Math.abs(d)-1)/0.6, v=dep*0.22*Math.sin(Math.PI*e)*fade; if(v>0&&F[k]>=0){ F[k]=Math.max(F[k],v); TH[k]=Math.min(TH[k],thr); } } }   /* the little berm of dirt it pushes aside */
    }
  }
  const out=new Uint8Array(nt*nv*4), inv2s=1/(2*dsT), inv2l=1/(2*dlT);
  for(let i=0;i<nt;i++){ const ip=((i+1)%nt)*nv, im=((i-1+nt)%nt)*nv, ic=i*nv;
    for(let j=0;j<nv;j++){ const jp=Math.min(nv-1,j+1), jm=Math.max(0,j-1), gs=(F[ip+j]-F[im+j])*inv2s, gl=(F[ic+jp]-F[ic+jm])*inv2l/((jp-jm)/2||1), p=(ic+j)*4;
      out[p]=Math.round(clamp(0.5+gs*0.5,0,1)*255); out[p+1]=Math.round(clamp(0.5+gl*0.5,0,1)*255); out[p+2]=Math.round(clamp(GM[ic+j],0,1)*255); out[p+3]=Math.round(clamp(TH[ic+j],0,1)*255); } }
  return {data:out,nt:nt,nv:nv};
}

/* the track-space texture: nt texels along the lap, nv across [-LATR, LATR] -> {data (RGBA8), nt, nv} */
function fineMap(Rl,nt,nv){
  const C=Rl.C, L=Rl.L, LATR=Rl.LATR, K=Rl.K, rows=makeRows(C,nt,K), dsT=L/nt, dlT=2*LATR/nv; rows.rutK=Rl.rows.rutK;
  const H=new Float32Array(nt*nv), F=new Float32Array(nt*nv), LO=new Float32Array(nt*nv);
  for(let i=0;i<nt;i++){
    const s=(i+0.5)*dsT, hw=rows.hw[i], A=rows.A[i], line=rows.line[i], ph=rows.bph[i], aph=rows.aph[i], bk=rows.brake[i], ac=rows.accel[i], gw=rows.gw[i];
    const fl=sstep(1.2,4.5,Math.min(s,L-s));
    const gC0=rows.gc0[i], gC1=rows.gc1[i], gC2=rows.gc2[i], gA0=rows.ga0[i], gA1=rows.ga1[i], gA2=rows.ga2[i], hiF=rows.hi[i], wh=rows.whoop[i];
    for(let j=0;j<nv;j++){
      const lat=-LATR+(j+0.5)*dlT, a=Math.abs(lat), edge=(1-sstep(hw-0.2,hw-0.02,a))*fl, k=i*nv+j;
      let f=0;
      /* the three tyre tracks of a straight (fewer in a corner, where the ruts are) */
      const gk=(1-A*0.85)*(1+wh*0.7);
      let d=(lat-gC0)/gw; if(d*d<1){ const t=1-d*d; f-=0.036*gA0*gk*t*t; }
      d=(lat-gC1)/gw; if(d*d<1){ const t=1-d*d; f-=0.03*gA1*gk*t*t; }
      d=(lat-gC2)/gw; if(d*d<1){ const t=1-d*d; f-=0.036*gA2*gk*t*t; }
      /* braking bumps: ripples across the line, slightly slanted (phase shears with lat), strongest on the line */
      if(bk>0.01){ const en=Math.exp(-Math.pow((lat-line*0.5)/1.8,2))*(0.55+0.9*K.n2(s*0.8+3,lat*0.7)); f+=bk*0.05*en*Math.cos(ph+lat*1.9+(K.n2(s*0.6,lat*0.5+7)-0.5)*2.2); }
      /* roost ripples where the bikes dig out of a corner */
      if(ac>0.01){ const en=Math.exp(-Math.pow((lat-line*0.5)/1.1,2))*(0.55+0.9*K.n2(s*0.7+11,lat*0.8)); f+=ac*0.02*en*Math.cos(aph+lat*2.4+(K.n2(s*0.5,lat*0.4)-0.5)*2.2); }
      /* the landing: a scoop with scuffs across it, a pile of loose dirt just ahead */
      const ld=rows.land[i], pl=rows.pile[i];
      if(ld>0.02||pl>0.02){ const en=Math.exp(-Math.pow(lat/1.9,2)), sc=0.5+0.5*Math.cos(s*17+lat*3.7+K.n2(s*1.3,lat*1.1)*5); f-=ld*en*(0.02+0.014*sc*K.n2(s*0.9,lat*0.6+4)); f+=pl*en*0.028*(0.6+0.4*K.n2(s*4,lat*3)); }
      /* whoops: chopped scallops down the faces */
      if(wh>0){ const fs=rows.Fs[i]; if(fs<-0.04){ f+=0.03*Math.cos(s*12.2+lat*2.1+rows.wix[i]*1.7)*clamp(-fs*3,0,1)*sstep(0.1,0.7,1-Math.abs(lat)/hw); } }
      /* milestone 2: the corner ruts are CHOPPED: braking chatter across the trench every 0.6-1.0 m, slanted, strongest in its bottom (the mesh carries the trench, this the chatter) */
      if(A>0.01){ const dl0=(lat-line)/0.42; if(dl0*dl0<1){ const t=1-dl0*dl0, ch=Math.cos(s*(TAU/(0.72+0.22*K.n2(s*0.3,5.1)))+lat*2.6+K.n2(s*0.9,lat*0.7+13)*3.2);
        f+=A*0.03*t*t*ch*(0.6+0.5*K.n2(s*0.5,lat*0.4+21)); } }
      /* clods and crumbs: more of them at the edges and where the dirt is loose (the rut lips, the berm's lip, the windrows: the relief's loose grid) */
      const lg=Rl.at(Rl.loose,s,clamp(lat,-LATR+0.001,LATR-0.001))/255, tr=Rl.at(Rl.traf,s,clamp(lat,-LATR+0.001,LATR-0.001))/255;
      const loose=clamp(0.18+0.85*sstep(hw*0.5,hw,a)+0.4*ac+0.3*bk+0.75*lg-0.25*tr,0,1);
      const c1=K.f2(s*3.1,lat*3.1,2), c2=K.n2(s*10.5,lat*10.5);
      f+=((c1-0.5)*0.034*(0.5+loose)+(c2-0.5)*0.012*(0.5+loose))*(1-0.35*tr);
      F[k]=f*edge; LO[k]=loose;
      H[k]=Rl.delta(s,lat)+f*edge;
    }
  }
  return encode(F,H,LO,nt,nv,dsT,dlT,true);
}
/* slopes of the FINE part (the mesh carries the rest), per metre, and the cavity of the whole relief H, and the loose mask -> RGBA8; wrap = periodic along s (the loop) */
function encode(F,H,LO,nt,nv,dsT,dlT,wrap){
  const out=new Uint8Array(nt*nv*4), inv2s=1/(2*dsT), inv2l=1/(2*dlT);
  const B1=new Float32Array(nt*nv), B2=new Float32Array(nt*nv), rS=Math.max(1,Math.round(0.6/dsT)), rV=Math.max(1,Math.round(0.55/dlT));
  const wi=i=>wrap?((i%nt)+nt)%nt:Math.min(nt-1,Math.max(0,i));
  for(let i=0;i<nt;i++) for(let j=0;j<nv;j++){ let s=0,c=0; for(let q=-rV;q<=rV;q++){ const jj=j+q; if(jj<0||jj>=nv) continue; s+=H[i*nv+jj]; c++; } B1[i*nv+j]=s/c; }
  for(let j=0;j<nv;j++){ let s=0; for(let q=-rS;q<=rS;q++) s+=B1[wi(q)*nv+j]; for(let i=0;i<nt;i++){ B2[i*nv+j]=s/(2*rS+1); s+=B1[wi(i+rS+1)*nv+j]-B1[wi(i-rS)*nv+j]; } }
  for(let i=0;i<nt;i++){ const ip=wi(i+1)*nv, im=wi(i-1)*nv, ic=i*nv;
    for(let j=0;j<nv;j++){
      const jp=Math.min(nv-1,j+1), jm=Math.max(0,j-1), gs=(F[ip+j]-F[im+j])*inv2s, gl=(F[ic+jp]-F[ic+jm])*inv2l/((jp-jm)/2||1);
      const cav=clamp((B2[ic+j]-H[ic+j])*12,0,0.8), ao=1-cav, p=(ic+j)*4;
      out[p]=Math.round(clamp(0.5+gs*0.5,0,1)*255); out[p+1]=Math.round(clamp(0.5+gl*0.5,0,1)*255); out[p+2]=Math.round(ao*255); out[p+3]=Math.round(clamp(LO[ic+j],0,1)*255);
    } }
  return {data:out,nt:nt,nv:nv};
}

/* THE START STRIP: the fine detail of the start path (gate -> where it joins the loop), as the same kind of texture, s from the gate (0) to C.S.L, lat across [-LAT, LAT] with LAT the gate's half width.
   Launch grooves in every lane for the first 10-30 m (22 bikes spinning out of the gate), roost ripples where they dig, then the straight's tyre tracks and clods. The start path itself stays flat
   (the wheels there follow it, they do not call Course.ground), so this is shading only. */
export function buildStartFine(C,nt,nv){
  const S=C.S, L=S.L, LAT=S.hw[0], K=noiseKit(0x5747+Math.round(L)), dsT=L/nt, dlT=2*LAT/nv, N=S.n;
  const F=new Float32Array(nt*nv), H=new Float32Array(nt*nv), LO=new Float32Array(nt*nv), pitch=0.78;
  const hash=(m)=>{ let h=Math.imul(m*374761393+668265263,1274126177); h^=h>>>13; return ((h>>>0)%1000)/1000; };
  for(let i=0;i<nt;i++){
    const s=(i+0.5)*dsT, x=s/S.ds, i0=Math.min(N-2,Math.floor(x)), fx=x-i0, hw=S.hw[i0]+(S.hw[i0+1]-S.hw[i0])*fx;
    const gate=sstep(34,8,s), start=sstep(0,2.5,s), rip=sstep(55,10,s)*sstep(0,3,s);
    for(let j=0;j<nv;j++){
      const lat=-LAT+(j+0.5)*dlT, a=Math.abs(lat), k=i*nv+j, edge=1-sstep(hw-0.4,hw-0.02,a);
      let f=0;
      /* a groove per lane: each runs a different length from the gate, wanders a little */
      const m=Math.round(lat/pitch), d=(lat-m*pitch+(K.n2(s*0.2,m*3.1)-0.5)*0.14)/0.075, run=sstep(10+22*hash(m),(10+22*hash(m))*0.6,s)*start;
      if(d*d<1&&run>0){ const t=1-d*d; f-=0.034*t*t*run*(0.55+0.45*hash(m+101)); }
      /* the second, shallower track of the same lane (the back wheel's) */
      const d2=(lat-m*pitch-0.11)/0.05; if(d2*d2<1&&run>0){ const t=1-d2*d2; f-=0.014*t*t*run; }
      /* roost ripples across the whole gate width, strongest in the first 25 m */
      f+=0.034*rip*Math.cos(s*(TAU/0.95)+lat*1.7+K.n2(s*0.3,lat*0.3)*3)*(0.6+0.4*K.n2(lat*0.4,9));
      /* the straight's tyre tracks beyond the gate */
      const w0=K.n2(s*0.05,3.3+m);
      const loose=clamp(0.3+0.7*sstep(hw*0.55,hw,a)+0.5*rip,0,1);
      f+=(K.f2(s*3.1,lat*3.1,2)-0.5)*0.03*(0.5+loose)+(K.n2(s*10.5,lat*10.5)-0.5)*0.011*(0.5+loose);
      F[k]=f*edge; LO[k]=loose; H[k]=f*edge;
    }
  }
  const enc=encode(F,H,LO,nt,nv,dsT,dlT,false); enc.L=L; enc.LAT=LAT; return enc;
}
