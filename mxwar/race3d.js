/* MOTOCROSS WAR 3D — the race in 3D (the CEO, 2026-10-16 20:06: "i want 3D perfection on every track ... People will want to watch the race
   with perfect physics ... I wanna see the whoop section and jumps. With great graphics"). window.MXWar.Race3D.create(host, opt) -> a view, or
   null when WebGL is missing (the page keeps the 2D track then). Our own renderer (gl3d.js), our own models: no library, no logos.
   - THE TRACK: the round's layout (tracks3d.js) as a dirt strip with banked berms, jump faces with solid sides, the whoops as real mounds, the
     start funnel and the gate, the finish line with its arch and the flagger; a night stadium (tiers of crowd, the light rig), the Daytona
     speedway infield, or an outdoor national (hills, trees, sky). The dirt texture is made in code (ruts and tyre marks along the track).
   - THE RIDERS: low-poly bikes in team colours with plates (the red plate on the points leader), riders standing in the whoops and over the
     jumps, seated and leaning in the berms, suspension compressing on every landing; roost when they drive out of a turn; blob shadows that
     shrink as a bike flies. Every rider rides the course's physics profile (real speed: a stadium lap about 50-60 s) at their own time gap.
   - THE CARDS MOVE THE RIDERS: every battle is one lap. result() gets the new standings: each rider's time gap eases to the gap of their new
     place (cards held), the lap's winner surges past (a featured pass shown side on), losers fade; the order on track is the standings at
     the line. CRASHES (CRASH-CONTRACT.md): a double-war loser tumbles, gets up, picks the bike up and rejoins further back; a triple-war loser
     crashes out (the bike pushed off the track, "OUT"); a marshal waves the YELLOW FLAG there and nobody passes in that section on the next
     lap. Riders out of cards pull off the track.
   - A TV DIRECTOR: the gate drop from the side, the holeshot into turn 1, chase cams, trackside pans at the whoops and the big jump, high
     wide shots, a side-on cable cam for a pass, the crash, the white flag and the checkered flag at the line. A lap is a few TV cuts of
     different sections at real speed (Medium about 6-8 s a lap on screen); while a card decision is pending the director keeps cutting
     between sections without crossing the line, so a lap is never counted early.
   - Cheap: instancing (one draw call per bike part for the whole field), about 20 draw calls a frame, a capped pixel budget, 30 frames a
     second when the device is slow or effects are reduced, paused while hidden; reduced motion = a still frame after every lap. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Race3D) return;
var GL=MX.GL, TK=MX.Tracks, PI=Math.PI, TAU=PI*2;
function clamp(x,a,b){ return x<a?a:x>b?b:x; }
function lerp(a,b,t){ return a+(b-a)*t; }
function sstep(x){ x=clamp(x,0,1); return x*x*(3-2*x); }
function hash(s){ var h=2166136261>>>0; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
function rng(seed){ var t=seed>>>0; return function(){ t=(t+0x6D2B79F5)>>>0; var x=Math.imul(t^(t>>>15),t|1); x^=x+Math.imul(x^(x>>>7),x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }
function now(){ return (g.performance&&performance.now)?performance.now():Date.now(); }
function hex(c){ c=String(c||"#888888").replace("#",""); if(c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; var n=parseInt(c,16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }

/* ---------------- textures made in code ---------------- */
function vnoise(W,cell,seed){ /* tileable value noise, W x W, lattice every cell px */
  var R=rng(seed), n=W/cell, lat=new Float32Array(n*n), out=new Float32Array(W*W), x, y;
  for(var i=0;i<n*n;i++) lat[i]=R();
  for(y=0;y<W;y++) for(x=0;x<W;x++){ var fx=x/cell, fy=y/cell, ix=Math.floor(fx), iy=Math.floor(fy), tx=sstep(fx-ix), ty=sstep(fy-iy), x1=(ix+1)%n, y1=(iy+1)%n, x0=ix%n, y0=iy%n;
    out[y*W+x]=lerp(lerp(lat[y0*n+x0],lat[y0*n+x1],tx),lerp(lat[y1*n+x0],lat[y1*n+x1],tx),ty); }
  return out;
}
function dirtTexture(seed){
  var W=256, c=document.createElement("canvas"); c.width=c.height=W; var x=c.getContext("2d"), im=x.createImageData(W,W), d=im.data;
  var n1=vnoise(W,32,seed), n2=vnoise(W,8,seed+1), n3=vnoise(W,64,seed+2), n4=vnoise(W,4,seed+3), R=rng(seed+9), i, px, py;
  /* ruts: grooves along v (the track direction): lines across u that wander slowly; tyre marks: thin dashed lines */
  var ruts=new Float32Array(W*W), lines=[];
  for(i=0;i<9;i++) lines.push({u:0.12+R()*0.76,w:0.012+R()*0.03,a:0.4+R()*0.6,ph:R()*TAU,amp:0.01+R()*0.02});
  for(py=0;py<W;py++) for(px=0;px<W;px++){ var u=px/W, v=py/W, r=0;
    for(var k=0;k<lines.length;k++){ var L=lines[k], cu=L.u+Math.sin(v*TAU*2+L.ph)*L.amp, dd=Math.abs(u-cu)/L.w; if(dd<1) r=Math.max(r,L.a*(1-dd*dd)); }
    var knob=(Math.sin(v*TAU*48)>0.3&&Math.abs(u-0.5)<0.42)?0.12:0; ruts[py*W+px]=Math.min(1,r+knob*n2[py*W+px]); }
  for(i=0;i<W*W;i++){
    var base=0.32+0.34*n1[i]+0.22*n2[i]+0.12*n4[i], clod=R()<0.012?(R()<0.5?-0.25:0.3):0;
    d[i*4]=clamp((base+clod)*255,0,255); d[i*4+1]=clamp(ruts[i]*255,0,255); d[i*4+2]=clamp((0.25+0.75*n3[i]*0.7+0.3*n1[i]*0.3)*255,0,255); d[i*4+3]=255;
  }
  x.putImageData(im,0,0); return c;
}

/* ---------------- models (local axes: X forward, Y up, Z right; origin on the ground between the wheels) ---------------- */
var K={black:[0.06,0.06,0.07,0],dark:[0.15,0.15,0.17,0],grey:[0.42,0.43,0.47,0],silver:[0.74,0.75,0.78,0],engine:[0.3,0.3,0.32,0],gold:[0.86,0.68,0.3,0],
  team:[1,1,1,1],teamD:[0.62,0.62,0.62,1],acc:[1,1,1,3],white:[0.93,0.93,0.91,0],seat:[0.09,0.09,0.1,0],tire:[0.09,0.09,0.1,0],glove:[0.14,0.14,0.16,0],
  boot:[0.9,0.9,0.88,0],lens:[0.2,0.32,0.5,0],skin:[0.82,0.63,0.5,0]};
function bikeBody(){
  var B=new GL.Builder(), z;
  B.box(-0.22,0.3,-0.13,0.18,0.62,0.13,K.engine); B.box(-0.02,0.58,-0.1,0.2,0.74,0.1,[0.24,0.24,0.26,0]);
  for(z=-1;z<=1;z+=2){
    B.beam([0.5,0.98,0.06*z],[0.2,0.38,0.09*z],0.05,0.05,K.silver); B.beam([0.5,0.98,0.06*z],[-0.36,0.88,0.1*z],0.045,0.045,K.silver);
    B.beam([-0.18,0.46,0.1*z],[-0.74,0.34,0.1*z],0.06,0.05,K.silver);
    B.tube([0.53,1.02,0.085*z],[0.7,0.5,0.085*z],0.028,6,K.gold); B.tube([0.66,0.62,0.085*z],[0.745,0.36,0.085*z],0.037,6,K.dark);
    B.beam([0.47,1.13,0.34*z],[0.47,1.13,0.43*z],0.045,0.045,K.black);
  }
  B.beam([-0.22,0.86,0],[-0.34,0.48,0],0.075,0.075,K.acc);
  B.box(0.47,0.96,-0.12,0.58,1.03,0.12,K.silver);
  B.beam([0.47,1.13,-0.4],[0.47,1.13,0.4],0.028,0.028,K.dark); B.box(0.45,1.02,-0.03,0.52,1.13,0.03,K.dark);
  B.box(0.62,0.78,-0.075,1.1,0.83,0.075,K.team,0.55,0.75);
  B.box(0.55,0.92,-0.135,0.6,1.17,0.135,K.team);
  B.box(0.1,0.85,-0.13,0.5,1.04,0.13,K.team,0.8,0.72);
  B.box(0.18,0.68,-0.225,0.56,1.0,0.225,K.team,0.72,0.86);
  B.box(-0.64,0.93,-0.115,0.24,1.0,0.115,K.seat);
  B.box(-0.56,0.64,-0.155,-0.1,0.92,0.155,K.team);
  B.box(-1.04,0.87,-0.09,-0.46,0.94,0.09,K.team);
  B.tube([0.06,0.52,0.15],[-0.26,0.72,0.17],0.034,6,K.silver); B.tube([-0.26,0.72,0.17],[-0.86,0.86,0.15],0.055,8,K.silver);
  return B;
}
function ring(B,rO,rI,w,n,col){ /* an annulus about Z (a tyre or a rim) */
  var s=B.v, k, a;
  for(k=0;k<=n;k++){ a=k/n*TAU; var c=Math.cos(a), si=Math.sin(a);
    B.vert(c*rO,si*rO,-w/2,c,si,0,col[0],col[1],col[2],col[3]); B.vert(c*rO,si*rO,w/2,c,si,0,col[0],col[1],col[2],col[3]);
    B.vert(c*rI,si*rI,-w/2,-c,-si,0,col[0],col[1],col[2],col[3]); B.vert(c*rI,si*rI,w/2,-c,-si,0,col[0],col[1],col[2],col[3]);
    B.vert(c*rO,si*rO,-w/2,0,0,-1,col[0],col[1],col[2],col[3]); B.vert(c*rI,si*rI,-w/2,0,0,-1,col[0],col[1],col[2],col[3]);
    B.vert(c*rO,si*rO,w/2,0,0,1,col[0],col[1],col[2],col[3]); B.vert(c*rI,si*rI,w/2,0,0,1,col[0],col[1],col[2],col[3]); }
  for(k=0;k<n;k++){ var o=s+k*8, p=o+8; B.quad(o,p,p+1,o+1); B.quad(o+2,o+3,p+3,p+2); B.quad(o+4,o+5,p+5,p+4); B.quad(o+6,p+6,p+7,o+7); }
}
function wheelMesh(){
  var B=new GL.Builder(); ring(B,0.36,0.285,0.11,12,K.tire); ring(B,0.285,0.262,0.075,12,K.silver);
  for(var k=0;k<3;k++){ var a=k/3*PI; B.beam([Math.cos(a)*0.26,Math.sin(a)*0.26,0],[-Math.cos(a)*0.26,-Math.sin(a)*0.26,0],0.012,0.012,K.grey); }
  B.cylZ(0,0,0,0.055,0.14,6,K.silver); return B;
}
/* the rider: the upper body about the hip pivot; the thighs along +X from the hip; the shins along +X from the peg (boots at the peg) */
var HIP=[-0.18,1.02], PEG=[-0.1,0.4], THIGH=0.44, SHIN=0.47;
function riderUpper(){
  var B=new GL.Builder(), z;
  B.box(-0.1,-0.07,-0.16,0.12,0.12,0.16,K.acc);
  B.beam([0.0,0.03,0],[0.24,0.5,0],0.36,0.23,K.team);
  B.ball(0.3,0.68,0,0.15,0.15,0.14,K.team,8);
  B.box(0.36,0.73,-0.09,0.5,0.76,0.09,K.acc); B.box(0.37,0.56,-0.075,0.47,0.64,0.075,K.acc); B.box(0.4,0.63,-0.1,0.45,0.69,0.1,K.lens);
  for(z=-1;z<=1;z+=2){
    B.beam([0.22,0.46,0.19*z],[0.38,0.29,0.33*z],0.11,0.1,K.team); B.beam([0.38,0.29,0.33*z],[0.63,0.11,0.38*z],0.09,0.09,K.team);
    B.box(0.6,0.07,0.33*z-0.05,0.69,0.15,0.33*z+0.05,K.glove);
  }
  return B;
}
function riderThighs(){ var B=new GL.Builder(); for(var z=-1;z<=1;z+=2) B.beam([0,0,0.13*z],[THIGH,0,0.17*z],0.15,0.15,K.acc); return B; }
function riderShins(){ var B=new GL.Builder(); for(var z=-1;z<=1;z+=2){ B.beam([0.02,0,0.17*z],[SHIN,0,0.17*z],0.12,0.12,K.boot); B.box(-0.12,-0.06,0.17*z-0.06,0.14,0.06,0.17*z+0.06,K.boot); } return B; }
function personMesh(){ /* a standing person (flagger, marshal): origin at the feet, facing +X; clothes in the instance colour */
  var B=new GL.Builder(); B.beam([0,0,-0.1],[0,0.86,-0.1],0.13,0.13,K.dark); B.beam([0,0,0.1],[0,0.86,0.1],0.13,0.13,K.dark);
  B.beam([0,0.84,0],[0,1.46,0],0.42,0.24,K.team); B.ball(0,1.62,0,0.11,0.13,0.11,K.skin,6); B.box(-0.12,1.7,-0.12,0.16,1.78,0.12,K.team);
  B.beam([0,1.4,-0.24],[0.05,0.92,-0.3],0.09,0.09,K.team); B.beam([0,1.42,0.24],[0.16,1.86,0.3],0.09,0.09,K.team); return B;
}
function plateMesh(){ var B=new GL.Builder(); var w=0.15, h=0.11; B.p.push(0,-h,-w, 0,-h,w, 0,h,w, 0,h,-w); B.u.push(0,0, 1,0, 1,1, 0,1); B.n.push(1,0,0,1,0,0,1,0,0,1,0,0); B.c.push(1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,0); B.v=4; B.i.push(0,1,2,0,2,3); return B; }

/* ---------------- the view ---------------- */
function create(host,opt){
  opt=opt||{};
  if(!GL||!TK) return null;
  var canvas=document.createElement("canvas"); canvas.className="mx-3d__cv"; canvas.setAttribute("aria-hidden","true");
  var fx=(document.documentElement.getAttribute("data-effects")==="reduced");
  var R=null; try{ R=GL.create(canvas,{aa:!fx&&!opt.noAA,webgl1:/[?&]gl=1(&|$)/.test(location.search)}); }catch(e){ R=null; }
  if(!R) return null;
  try{ R.programs(); }catch(e){ try{ console.warn("mxwar 3d:",e); }catch(x){} return null; }
  host.appendChild(canvas);
  var gl=R.gl;
  var V={is3d:true,host:host,canvas:canvas,R:R,C:null,key:"",riders:[],by:{},T:-3,phase:"idle",lap:0,len:30,shots:[],shot:null,flag:null,flagT:0,
    run:false,want:false,raf:0,last:0,frames:0,ms:0,msN:0,frozen:false,scale:1,W:0,H:0,dpr:1,banners:opt.onBanner||function(){},waiters:[],lapEndT:{},
    yellow:null,marshals:[],red:-1,fxMode:"full",half:false,costs:[],lastShotKind:"",rot:0};
  var M={}, TEX={}, IB={}, SC=null;   // meshes, textures, instance buffers, the scene of the current course
  var VP=GL.m4(), PROJ=GL.m4(), VIEW=GL.m4(), IVP=GL.m4();
  var CAM={eye:[0,30,60],tgt:[0,0,0],fov:0.9,se:null,st:null};
  function motion(){ var B=g.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off"; return document.documentElement.getAttribute("data-effects")==="reduced"?"reduced":"full"; }
  function speedK(){ return ({slow:1.5,fast:0.6})[g.bgGameSpeed]||1; }

  /* ---------- GPU resources that don't depend on the course ---------- */
  function initModels(){
    M.body=R.mesh(bikeBody(),"lit"); M.wheel=R.mesh(wheelMesh(),"lit"); M.upper=R.mesh(riderUpper(),"lit"); M.thigh=R.mesh(riderThighs(),"lit"); M.shin=R.mesh(riderShins(),"lit");
    M.person=R.mesh(personMesh(),"lit"); M.plate=[{vb:R.vbuf(new Float32Array([0,-0.11,-0.15,0,0, 0,-0.11,0.15,1,0, 0,0.11,0.15,1,1, 0,0.11,-0.15,0,1]),[["aPos",3],["aUV",2]],false),ib:R.ibuf(new Uint16Array([0,1,2,0,2,3])),tris:2}];
    var ispec=[["iA",4],["iB",4],["iC",4],["iTeam",4],["iAcc",4]];
    IB.body=R.vbuf(new Float32Array(42*20),ispec,true); IB.wheel=R.vbuf(new Float32Array(84*20),ispec,true); IB.upper=R.vbuf(new Float32Array(42*20),ispec,true);
    IB.thigh=R.vbuf(new Float32Array(42*20),ispec,true); IB.shin=R.vbuf(new Float32Array(42*20),ispec,true); IB.person=R.vbuf(new Float32Array(12*20),ispec,true);
    IB.gate=R.vbuf(new Float32Array(20),ispec,true);
    IB.plate=R.vbuf(new Float32Array(126*16),[["iA",4],["iB",4],["iC",4],["iUV",4]],true);
    IB.part=R.vbuf(new Float32Array(400*8),[["iP",4],["iCol",4]],true);
    IB.label=R.vbuf(new Float32Array(90*12),[["iP",4],["iUV",4],["iS",4]],true);
    IB.decal=R.vbuf(new Float32Array(44*12),[["iP",4],["iD",4],["iN",4]],true);
    IB.flag=R.vbuf(new Float32Array(3000*10),[["aPos",3],["aNor",3],["aCol",4]],true);
    TEX.dirt=R.tex(dirtTexture(7),{aniso:4});
    atlasInit();
  }
  /* ---------- the plate / label atlas: 8 x 8 cells of 128 x 64 ---------- */
  var ATL={c:null,x:null,t:null,cells:{},dirty:false};
  function atlasInit(){ ATL.c=document.createElement("canvas"); ATL.c.width=1024; ATL.c.height=1024; ATL.x=ATL.c.getContext("2d"); ATL.t=R.tex(ATL.c,{clamp:true}); ATL.dirty=true; }
  function cellUV(i){ var cx=(i%8)*128, cy=Math.floor(i/8)*64; return [(cx+2)/1024,1-(cy+62)/1024,(cx+126)/1024,1-(cy+2)/1024]; }
  function rr(x,X,Y,W,H,r){ x.beginPath(); x.moveTo(X+r,Y); x.lineTo(X+W-r,Y); x.quadraticCurveTo(X+W,Y,X+W,Y+r); x.lineTo(X+W,Y+H-r); x.quadraticCurveTo(X+W,Y+H,X+W-r,Y+H); x.lineTo(X+r,Y+H); x.quadraticCurveTo(X,Y+H,X,Y+H-r); x.lineTo(X,Y+r); x.quadraticCurveTo(X,Y,X+r,Y); x.closePath(); }
  function drawCell(i,num,o){
    var x=ATL.x, cx=(i%8)*128, cy=Math.floor(i/8)*64; x.clearRect(cx,cy,128,64);
    var red=!!o.red, me=!!o.me;
    if(me){ x.fillStyle="#f0d48a"; rr(x,cx+2,cy+2,124,60,12); x.fill(); }
    x.fillStyle=red?"#c8101c":"#f6f3ea"; rr(x,cx+(me?7:4),cy+(me?7:4),me?114:120,me?50:56,9); x.fill();
    x.fillStyle=o.color||"#3a3a44"; x.fillRect(cx+(me?9:6),cy+(me?11:8),14,me?42:48);
    x.lineWidth=3; x.strokeStyle="rgba(0,0,0,.55)"; rr(x,cx+(me?7:4),cy+(me?7:4),me?114:120,me?50:56,9); x.stroke();
    x.fillStyle=red?"#ffffff":"#111116"; x.textAlign="center"; x.textBaseline="middle";
    var t=String(num==null?"-":num); x.font="800 "+(t.length>2?40:46)+"px Manrope, 'Segoe UI', system-ui, sans-serif"; x.fillText(t,cx+70,cy+35);
    ATL.dirty=true;
  }
  /* the OUT label of rider k: the number in grey and OUT in red on a dark plate */
  function drawOut(k,num){ var x=ATL.x, i=64+k, cx=(i%8)*128, cy=Math.floor(i/8)*64; x.clearRect(cx,cy,128,64); x.fillStyle="#1a1a1f"; rr(x,cx+4,cy+6,120,52,10); x.fill(); x.strokeStyle="#e8584a"; x.lineWidth=4; rr(x,cx+4,cy+6,120,52,10); x.stroke();
    x.textBaseline="middle"; x.textAlign="left"; x.fillStyle="#c9c9d2"; x.font="800 30px Manrope, 'Segoe UI', system-ui, sans-serif"; x.fillText(String(num==null?"-":num),cx+12,cy+33);
    x.textAlign="right"; x.fillStyle="#ff8a7a"; x.font="800 26px Manrope, 'Segoe UI', system-ui, sans-serif"; x.fillText("OUT",cx+118,cy+33); ATL.dirty=true; }
  function atlasRedraw(){ V.riders.forEach(function(r){ drawCell(r.k,r.plate,{red:r.red,me:r.me,color:r.hex}); drawOut(r.k,r.plate); }); }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ if(ATL.x){ atlasRedraw(); } });

  /* ---------- the scene for a course ---------- */
  function sideClear(C,s,side,d){ /* how much room beside the track at s on one side (to the nearest other part of the course) */
    var i=Math.round(s/C.DS)%C.N, nx=-C.tz[i]*side, nz=C.tx[i]*side, px=C.x[i]+nx*d, pz=C.z[i]+nz*d, best=1e9;
    for(var j=0;j<C.N;j+=3){ var along=Math.min(Math.abs(j-i),C.N-Math.abs(j-i))*C.DS; if(along<d*2.2) continue; var q=Math.hypot(C.x[j]-px,C.z[j]-pz)-C.hw[j]; if(q<best) best=q; }
    return best;
  }
  function buildScene(C){
    var S={C:C,meshes:[],spots:{},night:true,cols:{}}, sur=C.layout.surroundings||(C.outdoor?"hills-trees":"stadium-open"), Rn=rng(hash(C.id)+C.variant);
    S.sur=sur; S.night=!C.outdoor; S.sandy=C.layout.soil==="sand";
    /* colours of the ground */
    S.cols.dirt=C.outdoor?[0.55,0.4,0.28]:S.sandy?[0.68,0.55,0.4]:[0.5,0.36,0.25]; S.cols.sand=[0.86,0.76,0.56]; S.cols.grass=[0.25,0.38,0.16];
    /* 1. the track strip: 9 columns (foot, 7 across the surface, foot), every 0.5 m on features, coarser on the flat */
    var T=new GL.Builder(), rows=[], U=[-1,-0.62,-0.26,0,0.26,0.62,1], i=0, step=C.outdoor?3:2;
    var minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
    while(i<C.N){
      rows.push(i);
      var nf=(C.F[i]>0.02||C.F[(i+step)%C.N]>0.02||C.F[(i+1)%C.N]>0.02||Math.abs(C.berm[i])>0.3||(C.camb&&C.camb[i]))?1:step;
      if(i*C.DS<C.startLen+6) nf=Math.min(nf,2);
      i+=nf;
    }
    var nc=U.length+2, vRep=C.L/Math.max(1,Math.round(C.L/7));
    rows.forEach(function(ii){
      var s=ii*C.DS, cx=C.x[ii], cz=C.z[ii], nx=-C.tz[ii], nz=C.tx[ii], hw=C.hw[ii], off=C.off[ii], E=C.E[ii];
      var ys=U.map(function(u){ return TK.ground(C,s,u*hw); });
      var lineU=Math.abs(C.k[ii])>0.02?(C.k[ii]>0?0.3:-0.3):0, sand=C.sand[ii], hiF=C.F[ii];
      for(var c=0;c<nc;c++){
        var u, lat, y, tint=1, groove=0;
        if(c===0||c===nc-1){ var e=c===0?0:U.length-1, he=ys[e]-E; lat=off+(c===0?-1:1)*(hw+0.35+Math.max(0,he)*0.95); y=E-0.06; u=c===0?-1.25:1.25; tint=0.7; }
        else { u=U[c-1]; lat=off+u*hw; y=ys[c-1]; groove=Math.max(0,1-Math.abs(u-lineU)*2.3); tint=1+0.06*Math.max(0,(ys[c-1]-ys[3])); if(hiF>0.3) tint*=0.94; }
        var px=cx+nx*lat, pz=cz+nz*lat;
        minx=Math.min(minx,px); maxx=Math.max(maxx,px); minz=Math.min(minz,pz); maxz=Math.max(maxz,pz);
        T.vert(px,y,pz,0,1,0,1,1,1,0,(u+1.25)/2.5,s/vRep,0,groove,tint,sand);
      }
    });
    var nr=rows.length, r, c2;
    for(r=0;r<nr;r++){ var a=r*nc, b=((r+1)%nr)*nc; for(c2=0;c2<nc-1;c2++) T.quad(a+c2,b+c2,b+c2+1,a+c2+1); }
    /* the last row wraps to the first: its v coordinate continues past the lap */
    gridNormals(T,nr,nc);
    S.track=R.mesh(T,"dirt");
    S.box={x0:minx,x1:maxx,z0:minz,z1:maxz};
    /* 2. the floor / the land */
    var F=new GL.Builder(), mar=C.outdoor?260:14;
    if(!C.outdoor){
      var fx0=minx-mar, fx1=maxx+mar, fz0=minz-mar, fz1=maxz+mar; S.floor={x0:fx0,x1:fx1,z0:fz0,z1:fz1};
      var gx=12, gz=8;
      for(var zi=0;zi<=gz;zi++) for(var xi=0;xi<=gx;xi++){ var X=lerp(fx0,fx1,xi/gx), Z=lerp(fz0,fz1,zi/gz); F.vert(X,-0.02,Z,0,1,0,1,1,1,0,X/9,Z/9,0,0,0.86,S.sandy?0.35:0); }
      for(zi=0;zi<gz;zi++) for(xi=0;xi<gx;xi++){ var q=zi*(gx+1)+xi; F.quad(q,q+gx+1,q+gx+2,q+1); }
      if(sur==="beach-speedway"){ /* the infield grass beyond the dirt floor */
        var big=420, o0=F.v; [[-big,-big],[big,-big],[big,big],[-big,big]].forEach(function(p){ F.vert(p[0],-0.08,p[1],0,1,0,1,1,1,0,p[0]/9,p[1]/9,1,0,0.9,0); }); F.quad(o0,o0+3,o0+2,o0+1);
      }
    } else {
      S.land=landHeights(C,minx-mar,maxx+mar,minz-mar,maxz+mar,Rn);
      var L=S.land;
      for(var zz=0;zz<=L.nz;zz++) for(var xx=0;xx<=L.nx;xx++){ var hv=L.h[zz*(L.nx+1)+xx], gr=L.g[zz*(L.nx+1)+xx]; F.vert(L.x0+xx*L.cs,hv,L.z0+zz*L.cs,0,1,0,1,1,1,0,(L.x0+xx*L.cs)/9,(L.z0+zz*L.cs)/9,gr,0,0.85+0.15*gr,0); }
      for(zz=0;zz<L.nz;zz++) for(xx=0;xx<L.nx;xx++){ var q2=zz*(L.nx+1)+xx; F.quad(q2,q2+L.nx+1,q2+L.nx+2,q2+1); }
      gridNormals(F,L.nz+1,L.nx+1,true);
    }
    S.floorMesh=R.mesh(F,"dirt");
    /* 3. the static props (one lit mesh): tuff blocks / track stakes, the finish line, its arch, the flag stand, the gate posts, the venue */
    var P=new GL.Builder();
    edges(C,P,Rn,S);
    finish(C,P,S);
    gateStatic(C,P,S);
    if(C.outdoor) outdoorSet(C,P,Rn,S); else if(sur==="beach-speedway") speedwaySet(C,P,Rn,S); else stadiumSet(C,P,Rn,S);
    S.props=R.mesh(P,"lit");
    /* 4. the gate (it falls toward the riders when it drops) */
    S.gateMesh=R.mesh(gateMesh(C),"lit");
    /* 5. camera spots */
    spots(C,S);
    return S;
  }
  function gridNormals(B,nr,nc,open){
    var P=B.p, N=B.n;
    for(var r=0;r<nr;r++) for(var c=0;c<nc;c++){
      var i=r*nc+c, rp=open?Math.min(nr-1,r+1):(r+1)%nr, rm=open?Math.max(0,r-1):(r-1+nr)%nr, cp=Math.min(nc-1,c+1), cm=Math.max(0,c-1);
      var a=rp*nc+c, b=rm*nc+c, d=r*nc+cp, e=r*nc+cm;
      var ax=P[a*3]-P[b*3], ay=P[a*3+1]-P[b*3+1], az=P[a*3+2]-P[b*3+2], bx=P[d*3]-P[e*3], by=P[d*3+1]-P[e*3+1], bz=P[d*3+2]-P[e*3+2];
      var nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx, l=Math.sqrt(nx*nx+ny*ny+nz*nz)||1; if(ny<0){ nx=-nx; ny=-ny; nz=-nz; }
      N[i*3]=nx/l; N[i*3+1]=ny/l; N[i*3+2]=nz/l;
    }
  }
  /* the outdoor land: the track's base level near the track, rolling hills away from it, a bowl rising at the edges */
  function landHeights(C,x0,x1,z0,z1,Rn){
    var cs=C.L>1500?9:7, nx=Math.ceil((x1-x0)/cs), nz=Math.ceil((z1-z0)/cs), h=new Float32Array((nx+1)*(nz+1)), gr=new Float32Array((nx+1)*(nz+1));
    var sx=[], sz=[], se=[], sw=[];
    for(var i=0;i<C.N;i+=4){ sx.push(C.x[i]); sz.push(C.z[i]); se.push(C.E[i]); sw.push(C.hw[i]+Math.abs(C.off[i])); }
    var ph1=Rn()*TAU, ph2=Rn()*TAU, cx=(x0+x1)/2, cz=(z0+z1)/2, rad=Math.max(x1-x0,z1-z0)/2;
    for(var zi=0;zi<=nz;zi++) for(var xi=0;xi<=nx;xi++){
      var X=x0+xi*cs, Z=z0+zi*cs, best=1e9, bi=0;
      for(var k=0;k<sx.length;k++){ var d=(sx[k]-X)*(sx[k]-X)+(sz[k]-Z)*(sz[k]-Z); if(d<best){ best=d; bi=k; } }
      var dist=Math.sqrt(best)-sw[bi], base=se[bi]-0.25;
      var hill=Math.sin(X*0.011+ph1)*Math.cos(Z*0.009+ph2)*7+Math.sin(X*0.023+Z*0.017)*3, rim=Math.pow(Math.max(0,Math.hypot(X-cx,Z-cz)/rad-0.55),2)*70;
      var w=sstep((dist-3)/45);
      h[zi*(nx+1)+xi]=lerp(base,base*0.6+hill+rim,w);
      gr[zi*(nx+1)+xi]=sstep((dist-2)/7);
    }
    return {x0:x0,z0:z0,cs:cs,nx:nx,nz:nz,h:h,g:gr};
  }
  function landAt(S,X,Z){ var L=S.land; if(!L) return 0; var fx=clamp((X-L.x0)/L.cs,0,L.nx-0.001), fz=clamp((Z-L.z0)/L.cs,0,L.nz-0.001), ix=Math.floor(fx), iz=Math.floor(fz), tx=fx-ix, tz=fz-iz, W=L.nx+1;
    return lerp(lerp(L.h[iz*W+ix],L.h[iz*W+ix+1],tx),lerp(L.h[(iz+1)*W+ix],L.h[(iz+1)*W+ix+1],tx),tz); }
  /* tuff blocks (stadium) or stakes (outdoors) along both edges, outside the jump sides */
  function gateSpot(C){ var gl0=C.off[0]+C.fside*(C.hw[0]+9); return {x:C.x[0]-C.tz[0]*gl0+C.tx[0]*6,y:C.E[0]+2.6,z:C.z[0]+C.tx[0]*gl0+C.tz[0]*6}; }
  function edges(C,P,Rn,S){
    var stepM=C.outdoor?7:1.3, s, side, GS=gateSpot(C);
    for(side=-1;side<=1;side+=2){
      for(s=C.startLen*0.9;s<C.L;s+=stepM){
        var i=Math.round(s/C.DS)%C.N, hw=C.hw[i], off=C.off[i], hv=TK.ground(C,s,side*hw)-C.E[i], lat=off+side*(hw+0.75+Math.max(0,hv)*0.95);
        if(sideClear(C,s,side,Math.abs(lat)+0.6)<0.6) continue;
        if(Math.hypot(C.x[i]-C.tz[i]*lat-GS.x,C.z[i]+C.tx[i]*lat-GS.z)<9) continue;
        var px=C.x[i]-C.tz[i]*lat, pz=C.z[i]+C.tx[i]*lat, y=C.outdoor?C.E[i]-0.2:0, v0=P.v;
        if(C.outdoor){ P.box(-0.05,0,-0.05,0.05,1.1,0.05,(Math.floor(s/stepM)%2)?[0.9,0.9,0.88,0]:[0.95,0.45,0.15,0]); }
        else { var blue=(Math.floor(s/stepM)%5)===0; P.box(-0.6,0,-0.28,0.6,0.42,0.28,blue?[0.2,0.32,0.62,0]:[0.86,0.86,0.84,0]); }
        P.xform(v0,GL.local(new Float32Array(12),px,y,pz,0,-Math.atan2(C.tz[i],C.tx[i]),0,1));
      }
    }
  }
  function finish(C,P,S){
    var s=C.sFin, i=Math.round(s/C.DS)%C.N, hw=C.hw[i], off=C.off[i], nx=-C.tz[i], nz=C.tx[i], tx=C.tx[i], tz=C.tz[i];
    /* the checkered strip on the ground */
    var cells=14, w=hw*2/cells;
    for(var a=0;a<cells;a++) for(var b=0;b<2;b++){
      var l0=off-hw+a*w, l1=l0+w, d0=(b-1)*0.9, d1=d0+0.9, col=(a+b)%2?[0.06,0.06,0.07,0]:[0.92,0.92,0.9,2];
      var pts=[[l0,d0],[l1,d0],[l1,d1],[l0,d1]].map(function(q){ var X=C.x[i]+nx*q[0]+tx*q[1], Z=C.z[i]+nz*q[0]+tz*q[1]; return [X,TK.ground(C,s+q[1],q[0]-off)+0.035,Z]; });
      P.face([pts[0],pts[3],pts[2],pts[1]],col);
    }
    /* the arch: two posts and a checkered beam */
    var side=1, la=off+hw+1.4, lb=off-hw-1.4, yb=Math.max(TK.ground(C,s,0),C.E[i]), top=yb+6.2;
    [la,lb].forEach(function(l){ var X=C.x[i]+nx*l, Z=C.z[i]+nz*l; P.beam([X,C.E[i]-0.1,Z],[X,top+0.5,Z],0.35,0.35,[0.2,0.2,0.23,0]); });
    var n2=12; for(var k=0;k<n2;k++){ for(var r2=0;r2<2;r2++){ var l1b=lerp(lb,la,k/n2), l2b=lerp(lb,la,(k+1)/n2);
      var A=[C.x[i]+nx*l1b,top+r2*0.42,C.z[i]+nz*l1b], B2=[C.x[i]+nx*l2b,top+r2*0.42,C.z[i]+nz*l2b];
      P.beam(A,B2,0.3,0.42,(k+r2)%2?[0.07,0.07,0.08,2]:[0.96,0.96,0.94,2]); } }
    /* the flag stand beside the line (on the right) */
    var ls=off+hw+3.2, X0=C.x[i]+nx*ls-tx*1.5, Z0=C.z[i]+nz*ls-tz*1.5, yg=C.outdoor?C.E[i]-0.1:0;
    P.box(-0.9,0,-0.9,0.9,2.2,0.9,[0.32,0.33,0.37,0]); P.xform(P.v-24,GL.local(new Float32Array(12),X0,yg,Z0,0,-Math.atan2(tz,tx),0,1));
    S.flagger={x:X0,y:yg+2.2,z:Z0,yaw:Math.atan2(tx,tz),fx:-nx,fz:-nz};
  }
  function gateStatic(C,P,S){
    var i=2, hw=C.hw[0], off=C.off[0], nx=-C.tz[0], nz=C.tx[0];
    [off-hw-0.3,off+hw+0.3].forEach(function(l){ var X=C.x[i]+nx*l, Z=C.z[i]+nz*l; P.beam([X,C.E[0]-0.1,Z],[X,C.E[0]+0.9,Z],0.16,0.16,[0.35,0.36,0.4,0]); });
    var A=[C.x[i]+nx*(off-hw-0.3),C.E[0]+0.04,C.z[i]+nz*(off-hw-0.3)], B2=[C.x[i]+nx*(off+hw+0.3),C.E[0]+0.04,C.z[i]+nz*(off+hw+0.3)];
    P.beam(A,B2,0.18,0.08,[0.3,0.3,0.33,0]);
  }
  function gateMesh(C){ /* in the gate's own frame: X along the track, Z across, pivot on the ground */
    var B=new GL.Builder(), hw=C.hw[0], n=Math.max(6,Math.floor(hw*2/1.0)), w=hw*2/n;
    for(var k=0;k<n;k++){ var z0=-hw+k*w+0.04, z1=z0+w-0.08; B.box(-0.03,0.02,z0,0.03,0.56,z1,[0.62,0.63,0.67,0]); B.box(-0.04,0.42,z0,0.04,0.52,z1,[0.85,0.2,0.16,0]); }
    return B;
  }
  /* the stadium: the wall round the floor, tiers of crowd, the light rig on the roof ring */
  function stadiumSet(C,P,Rn,S){
    var f=S.floor, x0=f.x0-1, x1=f.x1+1, z0=f.z0-1, z1=f.z1+1, rc=16;
    var path=roundRect(x0,z0,x1,z1,rc,84);
    wallRing(P,path,1.8,[0.13,0.13,0.16,0],[0.85,0.85,0.83,0]);
    tiers(P,path,Rn,0.6,1.8,26,0.9,0.46,1);
    tiers(P,path,Rn,26,15,20,0.85,0.62,0.78);
    /* the roof ring and its light banks (emissive) */
    var top=path.map(function(p){ return [p[0]+p[2]*44,40,p[1]+p[3]*44]; });
    for(var k=0;k<top.length;k++){ var a=top[k], b=top[(k+1)%top.length]; P.beam(a,b,1.2,1.6,[0.1,0.1,0.12,0]); }
    S.lights=[];
    for(k=0;k<top.length;k+=6){ var t=top[k], q=path[k]; var cx=t[0]-q[2]*1.5, cz=t[2]-q[3]*1.5; P.box(-2.2,-0.4,-0.9,2.2,0.4,0.9,[1.6,1.55,1.4,2]); P.xform(P.v-24,GL.local(new Float32Array(12),cx,38.8,cz,0,-Math.atan2(q[3],q[2])+PI/2,0,1)); S.lights.push([cx,38.6,cz]); }
  }
  function roundRect(x0,z0,x1,z1,r,n){ /* points with outward normals [x, z, nx, nz] round a rounded rectangle */
    var segs=[], L=0, pts=[], k;
    var cs=[[x1-r,z0+r,-PI/2],[x1-r,z1-r,0],[x0+r,z1-r,PI/2],[x0+r,z0+r,PI]];
    for(k=0;k<4;k++){ var c=cs[k]; for(var j=0;j<=6;j++){ var a=c[2]+j/6*PI/2; pts.push([c[0]+Math.cos(a)*r,c[1]+Math.sin(a)*r,Math.cos(a),Math.sin(a)]); } }
    /* resample evenly */
    var cum=[0]; for(k=1;k<=pts.length;k++){ var p=pts[k-1], q=pts[k%pts.length]; cum.push(cum[k-1]+Math.hypot(q[0]-p[0],q[1]-p[1])); }
    L=cum[pts.length]; var out=[], j2=0;
    for(k=0;k<n;k++){ var s=k*L/n; while(cum[j2+1]<s) j2++; var t=(s-cum[j2])/(cum[j2+1]-cum[j2]), A=pts[j2], B2=pts[(j2+1)%pts.length];
      var nx=lerp(A[2],B2[2],t), nz=lerp(A[3],B2[3],t), l=Math.hypot(nx,nz)||1; out.push([lerp(A[0],B2[0],t),lerp(A[1],B2[1],t),nx/l,nz/l]); }
    return out;
  }
  function wallRing(P,path,h,col,top){ for(var k=0;k<path.length;k++){ var a=path[k], b=path[(k+1)%path.length];
    P.face([[a[0],0,a[1]],[b[0],0,b[1]],[b[0],h,b[1]],[a[0],h,a[1]]],col); P.face([[a[0],h,a[1]],[b[0],h,b[1]],[b[0]+b[2]*0.5,h,b[1]+b[3]*0.5],[a[0]+a[2]*0.5,h,a[1]+a[3]*0.5]],top); } }
  var CROWD=[[0.12,0.13,0.18],[0.08,0.08,0.1],[0.75,0.74,0.72],[0.6,0.12,0.12],[0.15,0.25,0.55],[0.35,0.36,0.4],[0.8,0.65,0.15],[0.12,0.45,0.42],[0.75,0.38,0.12],[0.22,0.22,0.26]];
  function tiers(P,path,Rn,d0,h0,rows,dep,rise,lit){
    for(var k=0;k<path.length;k++){ var a=path[k], b=path[(k+1)%path.length];
      for(var r=0;r<rows;r++){ var d=d0+r*dep, h=h0+r*rise, v=(0.8+Rn()*0.2)*lit;
        var col=[v,v,v,4], dark=[v*0.6,v*0.6,v*0.6,4];
        var A0=[a[0]+a[2]*d,h,a[1]+a[3]*d], B0=[b[0]+b[2]*d,h,b[1]+b[3]*d], A1=[a[0]+a[2]*(d+dep),h,a[1]+a[3]*(d+dep)], B1=[b[0]+b[2]*(d+dep),h,b[1]+b[3]*(d+dep)];
        P.face([A0,B0,B1,A1],col); P.face([A1,B1,[B1[0],h+rise,B1[2]],[A1[0],h+rise,A1[2]]],dark); } }
  }
  /* Daytona: the speedway's banked tri-oval round the infield, a long grandstand on the front stretch, light poles */
  function speedwaySet(C,P,Rn,S){
    var cx=(S.floor.x0+S.floor.x1)/2, cz=(S.floor.z0+S.floor.z1)/2, ax=Math.max(260,(S.floor.x1-S.floor.x0)/2+120), az=Math.max(140,(S.floor.z1-S.floor.z0)/2+70), n=96, k;
    var ring2=[]; for(k=0;k<n;k++){ var a=k/n*TAU, sq=Math.pow(Math.abs(Math.cos(a)),0.6)*Math.sign(Math.cos(a)), sz=Math.pow(Math.abs(Math.sin(a)),0.6)*Math.sign(Math.sin(a)); ring2.push([cx+sq*ax,cz+sz*az]); }
    for(k=0;k<n;k++){ var p=ring2[k], q=ring2[(k+1)%n], dx=q[0]-p[0], dz=q[1]-p[1], l=Math.hypot(dx,dz)||1, ox=dz/l, oz=-dx/l;
      var bank=Math.abs(Math.cos(k/n*TAU))>0.75?5.5:1.2;
      P.face([[p[0],0,p[1]],[q[0],0,q[1]],[q[0]+ox*22,bank,q[1]+oz*22],[p[0]+ox*22,bank,p[1]+oz*22]],[0.22,0.22,0.24,0]);
      P.face([[p[0]+ox*22,bank,p[1]+oz*22],[q[0]+ox*22,bank,q[1]+oz*22],[q[0]+ox*23,bank+1.3,q[1]+oz*23],[p[0]+ox*23,bank+1.3,p[1]+oz*23]],[0.85,0.85,0.83,0]); }
    var path=[]; for(k=0;k<=40;k++){ var X=cx-ax*0.75+k/40*ax*1.5; path.push([X,cz+az+30,0,1]); }
    var Rs=path.slice(0,-1).map(function(p,i){ return p; });
    for(k=0;k<Rs.length;k++){ var a2=path[k], b2=path[k+1]; for(var r=0;r<30;r++){ var d=r*0.9, h=1.5+r*0.55, v=0.75+Rn()*0.25, col=[v,v,v,4];
      P.face([[a2[0],h,a2[1]+d],[a2[0],h,a2[1]+d+0.9],[b2[0],h,b2[1]+d+0.9],[b2[0],h,b2[1]+d]],col); P.face([[a2[0],h,a2[1]+d+0.9],[a2[0],h+0.55,a2[1]+d+0.9],[b2[0],h+0.55,b2[1]+d+0.9],[b2[0],h,b2[1]+d+0.9]],[v*0.6,v*0.6,v*0.6,4]); } }
    S.lights=[];
    for(k=0;k<n;k+=8){ var p2=ring2[k], X2=lerp(p2[0],cx,0.08), Z2=lerp(p2[1],cz,0.08); P.beam([X2,0,Z2],[X2,34,Z2],0.6,0.6,[0.3,0.3,0.33,0]); P.box(-2,-0.5,-0.8,2,0.5,0.8,[1.6,1.55,1.4,2]); P.xform(P.v-24,GL.local(new Float32Array(12),X2,34.5,Z2,0,Math.atan2(cz-Z2,cx-X2),0,1)); S.lights.push([X2,34,Z2]); }
  }
  /* outdoors: trees on the land, spectators at the big jumps, a ring of far hills */
  function outdoorSet(C,P,Rn,S){
    var L=S.land, n=0, tries=0, k;
    while(n<320&&tries<6000){ tries++;
      var X=L.x0+Rn()*L.nx*L.cs, Z=L.z0+Rn()*L.nz*L.cs, best=1e9;
      for(k=0;k<C.N;k+=10){ var d=Math.hypot(C.x[k]-X,C.z[k]-Z); if(d<best) best=d; }
      if(best<16) continue; if(best<45&&Rn()<0.6) continue;
      var y=landAt(S,X,Z), hgt=6+Rn()*7, wv=0.75+Rn()*0.25, col=[0.13*wv,0.27*wv,0.12*wv,0], v0=P.v;
      P.box(-0.2,0,-0.2,0.2,hgt*0.35,0.2,[0.3,0.22,0.15,0]);
      cone(P,0,hgt*0.25,0,hgt*0.32,hgt*0.55,7,col); cone(P,0,hgt*0.55,0,hgt*0.24,hgt*0.45,7,[col[0]*1.15,col[1]*1.12,col[2]*1.1,0]);
      P.xform(v0,GL.local(new Float32Array(12),X,y,Z,0,Rn()*TAU,0,1)); n++; }
    /* far hills: a ring of low mounds in the haze */
    var cx=(L.x0+L.x0+L.nx*L.cs)/2, cz=(L.z0+L.z0+L.nz*L.cs)/2, rad=Math.max(L.nx,L.nz)*L.cs*0.62+120;
    for(k=0;k<26;k++){ var a=k/26*TAU+Rn()*0.1, X2=cx+Math.cos(a)*rad, Z2=cz+Math.sin(a)*rad, w=150+Rn()*120, hh=40+Rn()*60;
      cone(P,X2,-5,Z2,w,hh,6,[0.27,0.36,0.24,0]); }
    /* spectators along the big jumps */
    S.crowd=[];
    C.feats.forEach(function(F){ if(!(F.type==="big-jump"||F.type==="triple"||F.type==="whoops"||F.type==="stepup")) return;
      for(var j=0;j<14;j++){ var s=F.s0+Rn()*F.len, i=Math.round(s/C.DS)%C.N, side=Rn()<0.5?-1:1, lat=side*(C.hw[i]+7+Rn()*4), X3=C.x[i]-C.tz[i]*lat, Z3=C.z[i]+C.tx[i]*lat;
        if(sideClear(C,s,side,Math.abs(lat))<3) continue;
        S.crowd.push({x:X3,y:landAt(S,X3,Z3),z:Z3,yaw:Math.atan2(C.z[i]-Z3,C.x[i]-X3),col:CROWD[Math.floor(Rn()*CROWD.length)]}); } });
  }
  function cone(P,x,y,z,r,h,n,col){ var s=P.v; for(var k=0;k<n;k++){ var a=k/n*TAU, b=(k+1)/n*TAU, A=[x+Math.cos(a)*r,y,z+Math.sin(a)*r], B2=[x+Math.cos(b)*r,y,z+Math.sin(b)*r], T=[x,y+h,z];
    var ex=B2[0]-A[0], ez=B2[2]-A[2], fx2=T[0]-A[0], fy=T[1]-A[1], fz=T[2]-A[2], nx=-(ez*fy), ny=ez*fx2-ex*fz, nz=ex*fy, l=Math.hypot(nx,ny,nz)||1; if(ny<0){ nx=-nx; ny=-ny; nz=-nz; }
    var i0=P.vert(A[0],A[1],A[2],nx/l,ny/l,nz/l,col[0],col[1],col[2],col[3]), i1=P.vert(B2[0],B2[1],B2[2],nx/l,ny/l,nz/l,col[0],col[1],col[2],col[3]), i2=P.vert(T[0],T[1],T[2],nx/l,ny/l,nz/l,col[0],col[1],col[2],col[3]); P.tri(i0,i2,i1); } }
  /* camera spots: beside every feature (the clearer side), at every turn, at the line, at the gate */
  function spots(C,S){
    var list=[], i;
    function spot(s,kind,dist,h){
      var a=sideClear(C,s,1,C.hw[Math.round(s/C.DS)%C.N]+dist), b=sideClear(C,s,-1,C.hw[Math.round(s/C.DS)%C.N]+dist), side=a>=b?1:-1, ii=Math.round(s/C.DS)%C.N, lat=side*(C.hw[ii]+dist);
      var X=C.x[ii]-C.tz[ii]*lat, Z=C.z[ii]+C.tx[ii]*lat, y=(C.outdoor?Math.max(landAt(S,X,Z),C.E[ii]):0)+h+(Math.max(a,b)<2?6:0);
      return {s:s,kind:kind,x:X,y:y,z:Z,side:side};
    }
    C.feats.forEach(function(F){ if(F.type==="start"||F.type==="finish"||F.type==="berm"||F.type==="hill") return; var sm=(F.s0+F.s1)/2, jump=!!F.vj;
      list.push(spot(sm,F.type,C.outdoor?(jump?28:24):(jump?17:14),C.outdoor?(jump?8:5):(jump?6:3.6))); list[list.length-1].F=F; list[list.length-1].name=F.name||F.type; });
    S.secs=list;
    /* turns: the apex of every tight turn */
    S.turns=[];
    var inT=false, best=0, bi=0;
    for(i=0;i<C.N;i++){ var kk=Math.abs(C.k[i]); if(kk>0.045){ if(!inT){ inT=true; best=0; } if(kk>best){ best=kk; bi=i; } } else if(inT){ inT=false; var sp=spot(bi*C.DS,"turn",C.outdoor?18:9,C.outdoor?3.5:2.6); S.turns.push(sp); } }
    /* turn 1 after the start straight */
    S.turn1=S.turns.filter(function(t){ return t.s>C.startLen*0.6; })[0]||S.turns[0]||{s:C.startLen,x:0,y:3,z:0};
    var fi=Math.round(C.sFin/C.DS)%C.N;
    var lsd=-(C.hw[fi]+C.off[fi]+7.5), lb=Math.round(((C.sFin-11)%C.L+C.L)%C.L/C.DS)%C.N;
    S.line={s:C.sFin,x:C.x[lb]-C.tz[lb]*lsd,y:(C.outdoor?C.E[lb]:0)+2.6,z:C.z[lb]+C.tx[lb]*lsd};
    S.gate=gateSpot(C);
    var cx=(S.box.x0+S.box.x1)/2, cz=(S.box.z0+S.box.z1)/2; S.centre=[cx,C.outdoor?10:0,cz]; S.radius=Math.max(S.box.x1-S.box.x0,S.box.z1-S.box.z0)*0.62;
  }

  /* ---------- lighting by the surroundings ---------- */
  function light(S){
    if(S.night) return {sun:norm3([0.25,0.92,0.32]),sunCol:[1.0,0.97,0.9],sky:[0.36,0.37,0.45],gnd:[0.3,0.24,0.18],fog:[0.035,0.035,0.06],fogR:[140,520],
      top:[0.01,0.012,0.03],hor:S.sur==="beach-speedway"?[0.16,0.1,0.12]:[0.05,0.05,0.09],nightK:1,clouds:0,clear:[0.03,0.03,0.05],spot:[S.centre[0],S.centre[2],S.radius*1.05,1]};
    return {sun:norm3([0.45,0.72,0.3]),sunCol:[1.12,1.04,0.9],sky:[0.5,0.58,0.72],gnd:[0.33,0.29,0.21],fog:[0.7,0.77,0.86],fogR:[220,1500],top:[0.24,0.42,0.74],hor:[0.72,0.8,0.9],nightK:0,clouds:fx?0:0.85,clear:[0.7,0.77,0.86],spot:[0,0,1,0]};
  }
  function norm3(v){ var l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; }

  /* ---------- riders ---------- */
  V.setTrack=function(series,year,cal,gateN){
    var pick=TK.forRound(series,year,cal||{}), key=pick.key+"|"+(gateN>30?40:22);
    if(key===V.key&&SC) return pick;
    V.key=key; var C=TK.build(pick.layout,{variant:pick.variant,gate:gateN>30?40:22}); V.C=C;
    SC=buildScene(C); SC.L=light(SC); V.lapEndT={};
    V.trackName=pick.layout.name; V.trackStatus=pick.layout.status;
    return pick;
  };
  V.setRiders=function(list){
    V.riders=list.map(function(o,k){ var c=hex(o.color), a=hex(o.accent||"#f2f2f6");
      return {s:o.s,k:k,hex:o.color,col:c,acc:a,plate:o.plate,red:!!o.red,me:!!o.me,name:o.name||"",segs:[],lag0:0,lane:((k*7919)%13-6)/6*0.55,lat:0,latV:0,D:0,
        crash:null,out:false,dnf:null,pull:null,park:null,spin:0,place:k,hold:null}; });
    V.by={}; V.riders.forEach(function(r){ V.by[r.s]=r; drawCell(r.k,r.plate,{red:r.red,me:r.me,color:r.hex}); drawOut(r.k,r.plate); });
    V.n=V.riders.length;
  };
  V.setRed=function(s){ V.riders.forEach(function(r){ var on=r.s===s; if(on!==r.red){ r.red=on; drawCell(r.k,r.plate,{red:r.red,me:r.me,color:r.hex}); } }); };
  /* the gate slots across the start (the people's riders get no special slot: the gate order is the race's) */
  function gateLat(r){ var C=V.C, hw=C.hw[0]-0.7, n=V.n, w=Math.min(1.05,hw*2/Math.max(1,n)); return C.off[0]+(-((n-1)*w)/2+r.k*w); }

  /* ---------- the time gaps ---------- */
  function segLag(r,T){
    var sg=r.segs, L=r.lag0;
    for(var i=0;i<sg.length;i++){ var q=sg[i]; if(T<q.t0) break;
      if(T>=q.t1){ L=q.l1; continue; }
      var el=T-q.t0, dur=q.t1-q.t0;
      if(q.y0!=null){ el-=ov(q.t0,T,q.y0,q.y1); dur-=ov(q.t0,q.t1,q.y0,q.y1); }
      var u=dur>0?clamp(el/dur,0,1):1; L=q.l0+(q.l1-q.l0)*(q.lin?u:sstep(u)); }
    return L;
  }
  function ov(a,b,c,d){ return Math.max(0,Math.min(b,d)-Math.max(a,c)); }
  function lagAt(r,T){ return segLag(r,T); }
  function dAt(r,T){ var C=V.C, tau=T-lagAt(r,T); return tau<=0?0:TK.distAt(C,tau); }
  function lapEnd(k){ if(V.lapEndT[k]==null) V.lapEndT[k]=TK.timeAt(V.C,TK.lapEnd(V.C,k)); return V.lapEndT[k]; }
  /* the gap of every place from the cards held: about a bike and a half per place, plus a little per card behind (a 40-rider field strings out) */
  function targets(order,cnt,outs){
    var out={}, lag=0, prev=null;
    order.forEach(function(s){ if(outs&&outs[s]) return; var r=V.by[s]; if(!r||r.out) return;
      if(prev!=null){ var d=Math.max(0,(cnt[prev]||0)-(cnt[s]||0)); lag+=0.36+0.042*Math.min(d,18); }
      out[s]=lag; prev=s; });
    return out;
  }

  /* ---------- the show: REAL TIME (the CEO ~21:10: a lap on screen takes a real lap time). The race clock never jumps; the director only
     cuts between cameras: reserved shots for the start, a crash, the lap's featured pass, the yellow section and the leader at the line,
     and fillers between them (trackside at the next section the leader reaches, a close battle side on, the chase on the leader or on you,
     a high crane, the stadium from the air) ---------- */
  V.atGate=function(len){
    V.len=len||V.len; V.phase="pre"; V.T=-3; V.lap=1; V.resLap=0; V.flag=null; V.yellow=null; V.isLast=false; V.res=[]; V.pass=null; V.crashT=null; V.needSent=0; V.endT=null;
    V.riders.forEach(function(r){ r.segs=[]; r.lag0=0; r.crash=null; r.out=false; r.dnf=null; r.pull=null; r.park=null; r.lat=gateLat(r); r.D=0; r.latOk=false; });
    V.dropT=null; setShot({kind:"heli",d:3.4});
  };
  /* a race restored mid-way (a save, a reload): the riders at their gaps at the start of the next lap, waiting for its cards */
  V.resume=function(st){
    V.len=st.len||V.len; V.lap=(st.lap|0)+1; V.resLap=st.lap|0; V.phase="race"; V.flag=st.flag||null; V.yellow=null; V.res=[]; V.pass=null; V.crashT=null; V.isLast=false; V.needSent=0;
    var tg=targets(st.order,st.counts,st.outs), T0=st.lap>0?lapEnd(st.lap):0, C=V.C;
    V.riders.forEach(function(r){ r.segs=[]; r.crash=null; r.pull=null; r.out=!!(st.outs&&st.outs[r.s]); r.park=null; r.lag0=tg[r.s]!=null?tg[r.s]:0; r.latOk=false; });
    V.T=T0+0.3; V.dropT=0;
    V.riders.forEach(function(r){ if(r.out){ var D=Math.max(8,dAt(r,V.T)-6); r.park={D:D,lat:(r.lane>=0?1:-1)*(C.hw[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]+3.5),T:-1e9}; } });
    reserveLine(V.lap); V.shot=null;
  };
  /* the cards of lap k are in: the moves spread over what is left of the lap */
  V.result=function(res){
    var C=V.C; if(!C) return;
    var k=res.lap|0, first=k===1&&V.phase==="pre";
    if(first){ V.T=-1.5; V.dropT=0; V.phase="race"; V.res=[]; }
    if(k>V.lap) V.lap=k;
    var Tend=lapEnd(k), Tb=first?0:V.T+0.3, t1end=Math.max(Tb+4,Tend-2);
    V.resLap=k; V.len=res.len||V.len; V.isLast=!!res.last; V.lapWin=res.winner;
    var tg=targets(res.order,res.counts,res.outs);
    var crashes=(res.crashes||[]).filter(function(c){ return V.by[c.s]; }), outs=res.outs||{}, crashT=null;
    if(crashes.length){ var sec=crashes[0].sector==null?0.5:crashes[0].sector, lo=Tb+3, hi=Math.max(lo+1,Tend-6); crashT=snapCrash(crashes[0].s,lo+(hi-lo)*clamp(sec,0,1),lo-0.5,hi+1); }
    var holdSec=V.yellow&&V.yellow.lap===k?V.yellow:null;   /* the yellow lap: nobody changes place in that section */
    var turnT=first?leadTimeAt(SC.turn1.s):0;
    V.riders.forEach(function(r){
      if(r.out||r.park) return;
      var cur=lagAt(r,Tb), want=tg[r.s];
      if(r.crash&&Tb<r.crash.T0+r.crash.dur+0.5){ if(r.crash.kind==="out"||want==null) return; var ls=r.segs[r.segs.length-1]; if(ls) r.segs.push({t0:ls.t1,t1:Math.max(ls.t1+3,t1end),l0:ls.l1,l1:Math.max(want,ls.l1-0.15*Math.max(3,t1end-ls.t1))}); return; }
      r.segs=r.segs.filter(function(q){ return q.t0<Tb; }).map(function(q){ if(q.t1>Tb){ var l=segLag(r,Tb); return {t0:q.t0,t1:Tb,l0:q.l0,l1:l,lin:true}; } return q; });
      if(outs[r.s]&&!crashes.some(function(c){ return c.s===r.s; })){ r.pull={T0:Tb+2+Math.random()*3}; r.segs.push({t0:Tb,t1:Tb+0.1,l0:cur,l1:cur}); return; }
      if(want==null) want=cur;
      var q={t0:Tb+0.5,t1:first?Math.max(3,turnT-0.6):t1end,l0:cur,l1:want};
      if(holdSec){ var w=secWindow(r,holdSec,cur); if(w){ q.y0=w[0]; q.y1=w[1]; } }
      r.segs.push(q);
    });
    V.crashT=null; V.crashBanner=false;
    crashes.forEach(function(c,ci){ var r=V.by[c.s]; if(!r) return; var tc=crashT+ci*0.15; planCrash(r,tc,c.kind,Tend); if(ci===0) V.crashT=tc;
      V.yellow={lap:k+1,T0:tc,s:dAt(r,tc)%C.L,seat:c.s}; });
    V.pass=planPass(res,tg,Tb,Tend,crashT);
    /* reserve the shots of this lap */
    if(first){ reserve({kind:"gate",t0:-1.5,t1:Math.min(3.4,turnT-2.2),pri:6}); reserve({kind:"turn1",t0:turnT-2.2,t1:turnT+2.6,spot:SC.turn1,holeshot:turnT+0.9,pri:6}); }
    if(crashT!=null) reserve({kind:"crash",t0:crashT-1.7,t1:crashT+(crashes[0].kind==="out"?6.8:5.4),focus:crashes[0].s,pri:5});
    if(V.pass) reserve({kind:"battle",t0:V.pass.t0-0.9,t1:V.pass.t1+1.0,pair:[V.pass.w,V.pass.p],pri:3});
    if(holdSec){ var ty=leadTimeAt(holdSec.s,Tb); if(ty<Tend-3) reserve({kind:"yellow",t0:ty-2.8,t1:ty+3.4,spot:mkSpot(holdSec.s,C.outdoor?20:12,C.outdoor?4.5:3.4),pri:4}); }
    reserveLine(k);
    V.lapT=Tend;
    if(first) V.shot=null;
  };
  function reserveLine(k){ if(V.res.some(function(o){ return o.kind==="line"&&o.lapK===k; })) return; var te=lapEnd(k); reserve({kind:"line",t0:te-3.4,t1:te+1.8,pri:2,lapK:k}); }
  /* a reserved shot keeps its slot unless a higher one overlaps; a line shot trims itself after a crash shot instead of vanishing */
  function reserve(sh){
    sh.res=true; V.res=V.res.filter(function(o){ return o.t1>V.T-0.5; });
    var clash=V.res.filter(function(o){ return sh.t0<o.t1&&o.t0<sh.t1; });
    if(clash.some(function(o){ return (o.pri||0)>=(sh.pri||0); })){
      if(sh.kind!=="line") return;
      var last=0; clash.forEach(function(o){ last=Math.max(last,o.t1); }); if(last>sh.t1-1.9) return; sh.t0=last;
    } else clash.forEach(function(o){ if(o.kind==="line"&&o.t1>sh.t1+1.9) o.t0=sh.t1; else V.res.splice(V.res.indexOf(o),1); });
    V.res.push(sh); V.res.sort(function(a,b){ return a.t0-b.t0; });
  }
  /* a crash looks right on a jump landing, in the whoops or rhythm: move it to the nearest such place within a few seconds */
  function snapCrash(s,tl,lo,hi){
    var r=V.by[s], C=V.C, best=tl, bestD=1e9;
    for(var t=Math.max(lo,tl-6);t<=Math.min(hi,tl+6);t+=0.25){ var D=dAt(r,t)%C.L, F=C.featAt(D); if(!F) continue;
      var good=(F.type==="whoops")||(F.vj&&Math.abs(D-F.tgt)<3)||(F.type==="rhythm"); if(good&&Math.abs(t-tl)<bestD){ bestD=Math.abs(t-tl); best=t; } }
    return clamp(best,lo,hi);
  }
  /* when a rider rides through the yellow section on this lap (from the gap they have now) */
  function secWindow(r,Y,cur){ var C=V.C, D=lapD(Y.s); return [TK.timeAt(C,Math.max(0,D-12))+cur,TK.timeAt(C,D+12)+cur]; }
  function planCrash(r,tc,kind,Tend){
    var C=V.C, D=dAt(r,tc), lat=r.lat, i=Math.round((D%C.L)/C.DS)%C.N, v=Math.max(6,C.v[i]);
    var dur=kind==="out"?9.5:7.2;
    r.crash={T0:tc,D:D,lat:lat,v:v,kind:kind,dur:dur,side:lat>=0?1:-1};
    if(kind==="out"){ r.segs.push({t0:tc,t1:tc+0.01,l0:lagAt(r,tc),l1:lagAt(r,tc)}); r.outAt=tc; }
    else {
      /* rejoin from the crash site: the time lost is the crash plus the restart; then ease back to the gap of the new place (at most 15%
         faster than the field), even if that runs into the next lap */
      var back=tc+dur, tau=TK.timeAt(C,D+1.2*v), lagAfter=back-tau, want=r.segs.length?r.segs[r.segs.length-1].l1:lagAfter;
      r.segs=r.segs.filter(function(q){ return q.t0<tc; }).map(function(q){ if(q.t1>tc){ var l=segLag(r,tc); return {t0:q.t0,t1:tc,l0:q.l0,l1:l,lin:true}; } return q; });
      r.segs.push({t0:tc,t1:back,l0:lagAt(r,tc),l1:lagAfter,lin:true});
      var need=Math.max(0,lagAfter-want), dt=Math.max(Tend-2-back,need/0.15);
      r.segs.push({t0:back,t1:back+Math.max(3,dt),l0:lagAfter,l1:Math.max(want,0)});
    }
  }
  /* the lap's featured pass: the lap's winner (or you) gets by the rider just ahead, in about 2.5 s, shown side on */
  function planPass(res,tg,Tb,Tend,crashT){
    var w=null, best=0;
    V.riders.forEach(function(r){ if(r.out||r.park||r.crash&&r.crash.T0>=Tb-8||tg[r.s]==null) return; var gain=lagAt(r,Tb)-tg[r.s], pref=(r.s===res.winner?0.6:0)+(r.me?0.9:0); if(gain+pref>best&&gain>0.3){ best=gain+pref; w=r; } });
    if(!w) return null;
    var lw=lagAt(w,Tb), p=null, pl=-1;
    V.riders.forEach(function(r){ if(r===w||r.out||r.park||r.crash&&r.crash.T0>=Tb-8||tg[r.s]==null) return; var l=lagAt(r,Tb); if(l<lw&&tg[r.s]>tg[w.s]&&l>pl){ pl=l; p=r; } });
    if(!p) return null;
    var span=Tend-Tb, tp=Tb+Math.max(5,span*(0.3+Math.random()*0.25));
    if(crashT!=null&&Math.abs(tp-crashT)<9) tp=crashT>Tb+span*0.5?Math.max(Tb+5,crashT-12):crashT+10;
    tp=clamp(tp,Tb+4,Math.max(Tb+4.5,Tend-8));
    /* w closes to just behind p by the window, gets by inside it (ahead by a third of a second at its end), then eases to its new place */
    var lpA=lagAt(p,tp-0.6), lpB=lagAt(p,tp+2.4), pre=Math.max(lpA+0.12,Math.min(lw,lpA+0.3)), mid=Math.min(pre,lpB-0.32);
    w.segs=w.segs.filter(function(q){ return q.t0<Tb+0.5; });
    w.segs.push({t0:Tb+0.5,t1:tp-0.6,l0:lw,l1:pre}); w.segs.push({t0:tp-0.6,t1:tp+2.4,l0:pre,l1:mid}); w.segs.push({t0:tp+2.4,t1:Math.max(tp+4,Tend-2),l0:mid,l1:tg[w.s]});
    return {w:w.s,p:p.s,t0:tp-0.6,t1:tp+2.4};
  }
  function lapD(s){ var C=V.C, k=Math.max(1,V.lap), f0=TK.lapEnd(C,k)-C.L, D=f0+(((s-C.sFin)%C.L)+C.L)%C.L; if(D<0) D+=C.L; return D; }
  function leadTimeAt(s,after){ /* the race time when the leader (gap 0) reaches track position s on the current lap (or the next time after "after") */
    var C=V.C, D=lapD(s), t=TK.timeAt(C,D), k=0; while(after!=null&&t<after&&k++<4){ D+=C.L; t=TK.timeAt(C,D); } return t;
  }
  V.lapDone=function(k){
    return new Promise(function(res){
      if(motion()==="off"||!V.C){ V.T=lapEnd(k)+0.1; renderStill(); setTimeout(res,2200); return; }
      if(V.T>=lapEnd(k)) return res();
      V.waiters.push({k:k,res:res});
    });
  };
  /* the seconds left before the leader reaches the line that ends lap k */
  V.timeLeft=function(k){ return V.C?lapEnd(k==null?V.lap:k)-V.T:0; };
  V.lapTime=function(){ return V.C?V.C.Tlap:55; };
  function checkWaiters(){ for(var i=V.waiters.length-1;i>=0;i--){ var w=V.waiters[i]; if(V.T>=lapEnd(w.k)-0.02){ V.waiters.splice(i,1); try{ w.res(); }catch(e){} } } }
  V.setFlag=function(f){ V.flag=f||null; V.flagT=now(); };
  V.finishShow=function(){ V.phase="end"; };

  /* ---------- the director ---------- */
  function setShot(sh){
    V.shot=sh; if(!sh) return;
    sh.el=0; if(sh.res) sh.d=Math.max(0.4,sh.t1-V.T);
    CAM.se=null; CAM.st=null; V.lastShotKind=sh.kind; V.cuts=(V.cuts|0)+1; parts.n=0;
    if(sh.kind==="crash"&&sh.focus>=0){ var r=V.by[sh.focus]; if(r&&r.crash) sh.spot=crashSpot(r); }
    V.hist=(V.hist||[]).concat([[sh.kind,+V.T.toFixed(1)]]).slice(-40);
  }
  function crashSpot(r){ var C=V.C, D=((r.crash.D%C.L)+C.L)%C.L, i=Math.round(D/C.DS)%C.N, side=sideClear(C,D,1,C.hw[i]+7)>=sideClear(C,D,-1,C.hw[i]+7)?1:-1, lat=side*(C.hw[i]+7);
    var X=C.x[i]-C.tz[i]*lat+C.tx[i]*6, Z=C.z[i]+C.tx[i]*lat+C.tz[i]*6; return {x:X,y:(C.outdoor?Math.max(C.E[i],landAt(SC,X,Z)):0)+2.8,z:Z}; }
  function mkSpot(s,dist,h){ var C=V.C, i=Math.round(((s%C.L)+C.L)%C.L/C.DS)%C.N, a=sideClear(C,s,1,C.hw[i]+dist), b=sideClear(C,s,-1,C.hw[i]+dist), side=a>=b?1:-1, lat=side*(C.hw[i]+dist);
    var X=C.x[i]-C.tz[i]*lat, Z=C.z[i]+C.tx[i]*lat; return {s:s,x:X,y:(C.outdoor?Math.max(landAt(SC,X,Z),C.E[i]):0)+h+(Math.max(a,b)<2?6:0),z:Z,side:side}; }
  function meSeat(){ var m=-1; V.riders.forEach(function(r){ if(r.me&&!r.out&&!r.park&&!(r.crash&&r.crash.kind==="out")) m=r.s; }); return m; }
  function closePair(){
    var rid=poses.filter(function(p){ return !p.parked&&!p.crash; }).sort(function(a,b){ return b.D-a.D; }), best=null, bd=1e9, you=meSeat();
    for(var i=0;i<rid.length-1&&i<14;i++){ var d=rid[i].D-rid[i+1].D; if(d<5.5){ var sc=d-(rid[i].r.s===you||rid[i+1].r.s===you?4:0)+i*0.15; if(sc<bd){ bd=sc; best=[rid[i+1].r.s,rid[i].r.s]; } } }
    return best;
  }
  function pickFiller(d){
    var S=SC, T=V.T, opts=[], last=V.lastShotKind, sp=null, best=1e9;
    S.secs.concat(S.turns).forEach(function(x){ var dt=leadTimeAt(x.s,T)-T; if(dt>0.9&&dt<Math.min(d,6.5)-0.7&&dt<best){ best=dt; sp=x; } });
    if(sp&&last!=="side") opts.push({kind:"side",spot:sp,d:Math.min(d,best+2.2),w:3.2});
    var pair=closePair(); if(pair&&last!=="battle") opts.push({kind:"battle",pair:pair,d:Math.min(d,4.6),w:2.4});
    var you=meSeat(); opts.push({kind:"chase",focus:(you>=0&&Math.random()<0.45)?you:-1,d:Math.min(d,5.2),w:last==="chase"?0.5:2});
    var ws=null; S.secs.forEach(function(x){ var dt=leadTimeAt(x.s,T)-T; if(dt>0.4&&dt<4) ws=x; }); if(ws&&last!=="wide") opts.push({kind:"wide",spot:ws,d:Math.min(d,4.6),w:1.6});
    if(last!=="heli"&&(V.rot%6===5)) opts.push({kind:"heli",d:Math.min(d,4.2),w:1.4});
    V.rot++;
    var tot=0; opts.forEach(function(o){ tot+=o.w; }); var r=Math.random()*tot;
    for(var i=0;i<opts.length;i++){ r-=opts[i].w; if(r<=0) return opts[i]; } return opts[0];
  }
  function direct(){
    var T=V.T, sh=V.shot, i;
    if(V.phase==="pre"){ if(!sh||(sh.kind!=="gate"&&sh.el>=sh.d)) setShot({kind:"gate",d:1e9}); return; }
    var R0=null; for(i=0;i<V.res.length;i++){ var o=V.res[i]; if(o.t0<=T+0.02&&o.t1>T){ R0=o; break; } }
    if(R0){ if(sh!==R0) setShot(R0); return; }
    if(sh&&sh.res&&T>=sh.t1) sh=null;
    var next=null; for(i=0;i<V.res.length;i++){ if(V.res[i].t0>T){ next=V.res[i]; break; } }
    var room=next?next.t0-T:99;
    if(sh&&sh.el<sh.d) return;
    if(sh&&room<2.4){ sh.d=sh.el+room+0.02; return; }
    setShot(pickFiller(Math.min(room,4.2+Math.random()*2.6)));
  }
  /* ---------- per frame: the riders' poses ---------- */
  var A12=new Float32Array(12), B12=new Float32Array(12), C12=new Float32Array(12), L12=new Float32Array(12);
  var IBD={body:new Float32Array(42*20),wheel:new Float32Array(84*20),upper:new Float32Array(42*20),thigh:new Float32Array(42*20),shin:new Float32Array(42*20),plate:new Float32Array(126*16),
    person:new Float32Array(12*20),label:new Float32Array(90*12),decal:new Float32Array(44*12),part:new Float32Array(400*8),gate:new Float32Array(20)};
  var counts={body:0,wheel:0,upper:0,plate:0,person:0,label:0,decal:0,part:0};
  var poses=[];
  function putInst(arr,n,M,col,acc){ var o=n*20; arr[o]=M[0];arr[o+1]=M[1];arr[o+2]=M[2];arr[o+3]=M[3];arr[o+4]=M[4];arr[o+5]=M[5];arr[o+6]=M[6];arr[o+7]=M[7];arr[o+8]=M[8];arr[o+9]=M[9];arr[o+10]=M[10];arr[o+11]=M[11];
    arr[o+12]=col[0];arr[o+13]=col[1];arr[o+14]=col[2];arr[o+15]=1;arr[o+16]=acc[0];arr[o+17]=acc[1];arr[o+18]=acc[2];arr[o+19]=1; }
  function putPlate(n,M,uv){ var a=IBD.plate, o=n*16; for(var i=0;i<12;i++) a[o+i]=M[i]; a[o+12]=uv[0]; a[o+13]=uv[1]; a[o+14]=uv[2]; a[o+15]=uv[3]; }
  /* the pose of a riding bike at race distance D, lateral lat */
  function ridePose(D,lat,o){
    var C=V.C, s=((D%C.L)+C.L)%C.L, f=s/C.DS, i=Math.floor(f)%C.N, j=(i+1)%C.N, t=f-Math.floor(f);
    var tx=lerp(C.tx[i],C.tx[j],t), tz=lerp(C.tz[i],C.tz[j],t), l=Math.hypot(tx,tz)||1; tx/=l; tz/=l;
    var off=lerp(C.off[i],C.off[j],t), x=lerp(C.x[i],C.x[j],t)-tz*(lat+off), z=lerp(C.z[i],C.z[j],t)+tx*(lat+off);
    var Y=lerp(C.Y[i],C.Y[j],t), air=C.air[i]||C.air[j], gc=TK.ground(C,s,0), gl=TK.ground(C,s,lat), y=Y+(gl-gc);
    o.x=x; o.y=y; o.z=z; o.tx=tx; o.tz=tz; o.pitch=lerp(C.pitch[i],C.pitch[j],t); o.lean=lerp(C.lean[i],C.lean[j],t); o.stand=lerp(C.stand[i],C.stand[j],t);
    o.air=air; o.v=lerp(C.v[i],C.v[j],t); o.roost=C.roost[i]; o.comp=lerp(C.comp[i],C.comp[j],t); o.s=s; o.gl=gl; o.sand=C.sand[i]; return o;
  }
  var PO={}, PO2={};
  /* the bike frame matrix from a pose, plus the wheel offsets (the ground pushes the wheels up into the frame) */
  function bikeMats(o,r,lateralYaw){
    var cp=Math.cos(o.pitch), fx=o.tx*cp, fy=Math.sin(o.pitch), fz=o.tz*cp;
    if(lateralYaw){ var c=Math.cos(lateralYaw), s=Math.sin(lateralYaw), nx=fx*c-fz*s, nz=fx*s+fz*c; fx=nx; fz=nz; }
    GL.frame(A12,o.x,o.y,o.z,fx,fy,fz,o.lean);
    return A12;
  }
  function wheelOff(o,dx,lat,R0){ var C=V.C, g2=TK.ground(C,o.s+dx,lat), fy=o.y+Math.sin(o.pitch)*dx; if(o.air) return R0-0.1; return clamp(g2+R0-fy,R0-0.12,R0+0.28); }
  /* everything for one rider: body, wheels, the rider (IK legs), plates, label, shadow */
  function emitRider(r,o,M,riderState){
    var team=r.col, acc=r.acc, nb=counts.body;
    putInst(IBD.body,nb,M,team,acc);
    var spin=(r.spin=(r.spin+(o.v||0)*V.dtR/0.36)%TAU);
    var fo=riderState==="lying"?0.36:wheelOff(o,0.74,r.lat,0.36), ro=riderState==="lying"?0.34:wheelOff(o,-0.74,r.lat,0.34);
    GL.amul(B12,M,GL.local(L12,0.74,fo,0,-spin,0,0,1)); putInst(IBD.wheel,counts.wheel++,B12,team,acc);
    GL.amul(B12,M,GL.local(L12,-0.74,ro,0,-spin,0,0,0.945)); putInst(IBD.wheel,counts.wheel++,B12,team,acc);
    /* plates: the front plate and the two side plates */
    var uv=cellUV(r.k);
    var fu=[uv[2],uv[1],uv[0],uv[3]];
    GL.amul(B12,M,GL.local(L12,0.607,1.045,0,0.35,0,0,1)); putPlate(counts.plate++,B12,fu);
    GL.amul(B12,M,GL.local(L12,-0.33,0.79,0.158,0,-PI/2,0,1)); putPlate(counts.plate++,B12,fu);
    GL.amul(B12,M,GL.local(L12,-0.33,0.79,-0.158,0,PI/2,0,1)); putPlate(counts.plate++,B12,fu);
    counts.body++;
  }
  /* the rider on the bike: hips up and forward when standing, the torso over the bars; the legs by IK from the hip to the pegs */
  function emitRiderBody(r,M,stand,extraPitch){
    var team=r.col, acc=r.acc, st=clamp(stand,0,1), hx=HIP[0]+0.06*st, hy=HIP[1]+0.22*st;
    GL.amul(B12,M,GL.local(L12,hx,hy,0,-0.35*st+(extraPitch||0),0,0,1)); putInst(IBD.upper,counts.upper,B12,team,acc);
    legs(r,M,hx,hy,PEG[0],PEG[1]);
    counts.upper++;
  }
  function legs(r,M,hx,hy,px,py){
    var dx=hx-px, dy=hy-py, d=Math.min(THIGH+SHIN-0.001,Math.hypot(dx,dy)), th=Math.atan2(dy,dx);
    var ca=clamp((SHIN*SHIN+d*d-THIGH*THIGH)/(2*SHIN*d),-1,1), a=Math.acos(ca);
    var k1x=px+Math.cos(th-a)*SHIN, k1y=py+Math.sin(th-a)*SHIN, k2x=px+Math.cos(th+a)*SHIN, k2y=py+Math.sin(th+a)*SHIN;
    var kx=k1x>k2x?k1x:k2x, ky=k1x>k2x?k1y:k2y;
    GL.amul(B12,M,GL.local(L12,hx,hy,0,Math.atan2(ky-hy,kx-hx),0,0,1)); putInst(IBD.thigh,counts.upper,B12,r.col,r.acc);
    GL.amul(B12,M,GL.local(L12,px,py,0,Math.atan2(ky-py,kx-px),0,0,1)); putInst(IBD.shin,counts.upper,B12,r.col,r.acc);
  }
  function emitShadow(x,y,z,tx,tz,nrm,a,k){ var n=counts.decal++, d=IBD.decal, o=n*12; d[o]=x; d[o+1]=y; d[o+2]=z; d[o+3]=0; d[o+4]=tx; d[o+5]=tz; d[o+6]=1.15*k; d[o+7]=0.5*k; d[o+8]=nrm[0]; d[o+9]=nrm[1]; d[o+10]=nrm[2]; d[o+11]=a; }
  function emitLabel(x,y,z,cell,grp,pxH,yoff){ if(counts.label>=90) return; var n=counts.label++, d=IBD.label, o=n*12, uv=cellUV(cell); d[o]=x; d[o+1]=y; d[o+2]=z; d[o+3]=grp; d[o+4]=uv[0]; d[o+5]=uv[1]; d[o+6]=uv[2]; d[o+7]=uv[3]; d[o+8]=pxH; d[o+9]=yoff||0; d[o+10]=0; d[o+11]=0; }
  /* roost and dust */
  var parts={n:0,p:new Float32Array(400*10)};
  function spawn(x,y,z,vx,vy,vz,size,life,col){ if(parts.n>=400) return; var o=parts.n++*10, p=parts.p; p[o]=x;p[o+1]=y;p[o+2]=z;p[o+3]=vx;p[o+4]=vy;p[o+5]=vz;p[o+6]=size;p[o+7]=life;p[o+8]=life;p[o+9]=col; }
  function stepParts(dt){
    var p=parts.p, n=0;
    for(var i=0;i<parts.n;i++){ var o=i*10; p[o+7]-=dt; if(p[o+7]<=0) continue;
      p[o+4]-=9.81*dt*0.55; p[o+3]*=1-1.6*dt; p[o+5]*=1-1.6*dt; p[o]+=p[o+3]*dt; p[o+1]+=p[o+4]*dt; p[o+2]+=p[o+5]*dt; if(p[o+1]<0&&!V.C.outdoor) p[o+1]=0;
      if(n!==i) for(var k=0;k<10;k++) p[n*10+k]=p[o+k]; n++; }
    parts.n=n;
    var d=IBD.part, dirt=SC.cols.dirt, sand=SC.cols.sand;
    for(i=0;i<n;i++){ var q=i*10, lf=p[q+7]/p[q+8], sz=p[q+6]*(1.6-lf*0.9), c=p[q+9]>0.5?sand:dirt;
      d[i*8]=p[q]; d[i*8+1]=p[q+1]; d[i*8+2]=p[q+2]; d[i*8+3]=sz; d[i*8+4]=c[0]*1.25; d[i*8+5]=c[1]*1.2; d[i*8+6]=c[2]*1.15; d[i*8+7]=Math.min(1,lf*1.4)*0.62; }
    counts.part=n;
  }
  /* crash poses: tumble, lie, get up, walk back, lift the bike, remount, ride off (or push it off the track: OUT) */
  function crashPose(r,T,o){
    var cr=r.crash, t=T-cr.T0, C=V.C, v=cr.v, sl=v*0.6, side=cr.side;
    var bt=Math.min(t,1.2), bD=cr.D+v*bt-0.5*(v/1.2)*bt*bt, bLat=cr.lat+side*1.6*sstep(t/1.2)*(cr.kind==="out"?1:1-sstep((t-4.6)/1.2)*0.8);
    if(cr.kind!=="out"&&t>6.0){ var ta=Math.min(t-6.0,1.2); bD+=0.5*(v/1.2)*ta*ta; }
    var rt=Math.min(t,1.5), rD=cr.D+v*1.08*rt-0.5*(v*1.08/1.5)*rt*rt, rLat=cr.lat+side*0.8*sstep(t/1.5);
    var outPush=cr.kind==="out"?sstep((t-5.4)/3.2)*(C.hw[Math.round(((bD%C.L)+C.L)%C.L/C.DS)%C.N]+3.2-Math.abs(bLat))*side:0;
    ridePose(bD,bLat+outPush,o); o.air=false; o.y=TK.ground(C,o.s,bLat+outPush);
    var lift=cr.kind==="out"?sstep((t-4.6)/0.8):sstep((t-4.6)/0.8), roll=side*(PI/2)*(1-lift)*sstep(t/0.9)+side*0.25*Math.sin(Math.min(t,1.2)*7)*(1-sstep(t/1.2));
    var yaw=0.7*side*sstep(t/1.2)*(1-lift*0.6), tumble=t<1.2?-Math.sin(t/1.2*PI)*0.6:0;
    o.lean=roll; o.pitch=tumble; o.v=0; o.y+=0.22*(1-lift)*sstep(t/0.9);
    /* the rider's own spot */
    var ph=t<1.5?"tumble":t<(cr.kind==="out"?2.8:2.6)?"lying":t<3.4?"up":t<4.6?"walk":t<6.0?(cr.kind==="out"?"push":"lift"):cr.kind==="out"?"push":"ride";
    return {bD:bD,bLat:bLat+outPush,rD:rD,rLat:rLat,ph:ph,t:t,yaw:yaw};
  }
  function emitCrash(r,T){
    var o=PO, cp=crashPose(r,T,o), C=V.C, M=bikeMats(o,r,cp.yaw), t=cp.t;
    emitRider(r,o,M,cp.ph==="ride"?"ride":"lying");
    var nrm=[0,1,0];
    emitShadow(o.x,o.gl,o.z,o.tx,o.tz,nrm,0.5,1);
    if(cp.ph==="ride"){ emitRiderBody(r,M,0.2); return o; }
    if(t>=6.0&&r.crash.kind!=="out"){ emitRiderBody(r,M,0); return o; }
    /* off the bike: the rider is a rigid body of the same parts: thrown and tumbling, lying, standing, walking */
    var p=PO2;
    if(cp.ph==="tumble"){ ridePose(cp.rD,cp.rLat,p); var hgt=0.9*Math.sin(Math.min(1,t/0.7)*PI)*(t<0.7?1:0); p.y=TK.ground(C,p.s,cp.rLat)+0.25+hgt; var rot=t*7.5;
      GL.frame(C12,p.x,p.y,p.z,p.tx,0,p.tz,rot); GL.amul(C12,C12,GL.local(L12,0,0,0,-t*2.2,0,0,1)); GL.amul(C12,C12,GL.local(L12,-HIP[0],-HIP[1]+0.3,0,0,0,0,1)); emitRiderBody(r,C12,0.3); }
    else if(cp.ph==="lying"){ ridePose(cp.rD,cp.rLat,p); p.y=TK.ground(C,p.s,cp.rLat)+0.2; GL.frame(C12,p.x,p.y,p.z,p.tx,0,p.tz,PI/2*r.crash.side); GL.amul(C12,C12,GL.local(L12,-HIP[0],-0.2,0,-0.2,0,0,1)); emitRiderBody(r,C12,0); }
    else {
      /* standing / walking back to the bike / lifting / pushing: a standing figure */
      var wD, wLat;
      if(cp.ph==="up"){ wD=cp.rD; wLat=cp.rLat; }
      else if(cp.ph==="walk"){ var u=sstep((t-3.4)/1.2); wD=lerp(cp.rD,cp.bD+0.2,u); wLat=lerp(cp.rLat,cp.bLat-r.crash.side*0.6,u); }
      else { wD=cp.bD+0.1; wLat=cp.bLat-r.crash.side*0.65; }
      ridePose(wD,wLat,p); p.y=TK.ground(C,p.s,wLat);
      var up=cp.ph==="up"?sstep((t-2.6)/0.8):1, walkBob=cp.ph==="walk"?Math.abs(Math.sin(t*9))*0.04:0;
      GL.frame(C12,p.x,p.y+walkBob,p.z,p.tx,0,p.tz,(1-up)*PI/2*r.crash.side);
      /* hips over the feet: the upper body upright-ish, the legs straight down */
      GL.amul(B12,C12,GL.local(L12,0,0.92,0,0.25,0,0,1)); putInst(IBD.upper,counts.upper,B12,r.col,r.acc);
      legs(r,C12,0.0,0.92,0.03,0.06);
      counts.upper++;
    }
    return o;
  }
  function parkAt(r,T){ var C=V.C, D=dAt(r,T)+3; r.park={D:D,lat:(r.lat>=0?1:-1)*(C.hw[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]+3.5),T:T}; }

  /* ---------- the frame ---------- */
  V.dtR=0;
  function update(dt){
    var C=V.C; if(!C) return;
    var sh=V.shot, adv=V.frozen?0:dt;
    V.dtR=adv;
    if(sh) sh.el+=adv;
    if(V.phase!=="pre") V.T+=adv;
    if(V.phase==="race"&&V.T>=lapEnd(V.lap)){ V.lap++; reserveLine(V.lap); }
    if(V.phase==="race"&&V.resLap<V.lap&&V.T>=lapEnd(V.lap)-5&&V.needSent!==V.lap){ V.needSent=V.lap; if(opt.onNeed) try{ opt.onNeed(V.lap); }catch(e){} }
    if(V.isLast&&V.T>=lapEnd(V.resLap)-6&&V.flag!=="checkered") V.flag="checkered";
    direct(); sh=V.shot;
    checkWaiters();
    if(sh&&sh.holeshot&&!sh.hsDone&&V.T>=sh.holeshot){ sh.hsDone=true; V.banners({kind:"holeshot"}); }
    if(V.crashT!=null&&V.T>=V.crashT+0.35&&!V.crashBanner){ V.crashBanner=true; var yr=V.yellow&&V.by[V.yellow.seat]; V.banners({kind:"crash",seat:yr?yr.s:-1,out:!!(yr&&yr.crash&&yr.crash.kind==="out")}); }
    /* the riders */
    var T=V.T, fieldN=0;
    counts.body=0; counts.wheel=0; counts.upper=0; counts.plate=0; counts.person=0; counts.label=0; counts.decal=0;
    poses.length=0;
    var list=[];
    V.riders.forEach(function(r){
      if(r.park){ if(T>=r.park.T) { list.push({r:r,mode:"park"}); return; } }
      if(r.crash&&T>=r.crash.T0&&T<r.crash.T0+r.crash.dur){ list.push({r:r,mode:"crash"}); return; }
      if(r.crash&&r.crash.kind==="out"&&T>=r.crash.T0+r.crash.dur){ if(!r.park){ var cp=crashPose(r,r.crash.T0+r.crash.dur-0.01,PO); r.park={D:cp.bD,lat:cp.bLat,T:r.crash.T0+r.crash.dur,crashed:true}; } list.push({r:r,mode:"park"}); return; }
      if(r.pull&&T>=r.pull.T0){ if(r.pull.D==null){ r.pull.D=dAt(r,r.pull.T0); r.pull.lat=r.lat; } if(T>=r.pull.T0+3){ if(!r.park) r.park={D:r.pull.D+12,lat:r.pull.lat+(r.pull.lat>=0?1:-1)*4,T:r.pull.T0+3}; list.push({r:r,mode:"park"}); return; } list.push({r:r,mode:"pull"}); return; }
      var D=V.phase==="pre"||T<0?0:dAt(r,T); r.D=D; list.push({r:r,mode:"ride",D:D}); fieldN++;
    });
    /* lanes: spread the riders across the track; a rider catching the one ahead swings out to pass; the gate slots funnel into turn 1 */
    var riding=list.filter(function(x){ return x.mode==="ride"; }).sort(function(a,b){ return b.D-a.D; });
    riding.forEach(function(x){ var r=x.r, hw=C.hw[Math.round(((x.D%C.L)+C.L)%C.L/C.DS)%C.N]; x.hw=hw; x.want=r.lane*hw*0.6; if(x.D<C.startLen*1.05){ var u=sstep(x.D/(C.startLen*0.95)); x.want=lerp(gateLat(r)-C.off[Math.min(C.N-1,Math.round(x.D/C.DS))],x.want,u); } });
    for(var it=0;it<3;it++) for(var a=0;a<riding.length;a++) for(var b=a+1;b<riding.length&&b<a+4;b++){ var A=riding[a], Bq=riding[b]; if(A.D-Bq.D>3.4) break; var dl=Bq.want-A.want;
      if(Math.abs(dl)<1.25){ var push=(1.25-Math.abs(dl))/2, sg=dl>=0?1:-1; A.want-=push*sg; Bq.want+=push*sg; } }
    var kl=V.cut?1:1-Math.exp(-adv/0.45);
    riding.forEach(function(x){ var r=x.r, lim=Math.max(0.5,x.hw-0.75); x.want=clamp(x.want,-lim-(x.D<C.startLen?20:0),lim+(x.D<C.startLen?20:0)); if(V.cut||!r.latOk){ r.lat=x.want; r.latOk=true; } else r.lat+=(x.want-r.lat)*kl; });
    V.cut=false;
    /* emit */
    var lead=riding[0]?riding[0].r:null; V.leadS=lead?lead.s:-1;
    riding.forEach(function(x,ix){ x.r.pos=ix; });
    var camP=CAM.eye, labelPx=document.documentElement.hasAttribute("data-tv")?Math.max(14,Math.round(30*(g.innerHeight||1080)/1080)):18;
    list.forEach(function(x){
      var r=x.r, o=PO;
      if(x.mode==="ride"||x.mode==="pull"){
        if(x.mode==="pull"){ var tp=Math.min(3,T-r.pull.T0), Dp=r.pull.D+8*tp-0.5*(8/3)*tp*tp; ridePose(Dp,r.pull.lat+(r.pull.lat>=0?1:-1)*sstep(tp/3)*4,o); o.v=8*(1-tp/3); }
        else ridePose(x.D,r.lat,o);
        if(V.phase==="pre"||T<0){ o.pitch=0.02+(V.phase==="pre"?Math.sin(now()/90+r.k)*0.006:0); o.lean=0; o.stand=0; o.v=V.phase==="pre"?0:o.v; }
        var M=bikeMats(o,r,0);
        emitRider(r,o,M,"ride"); emitRiderBody(r,M,o.stand,o.air?-0.05:0);
        var h=o.y-o.gl, k=clamp(1-h/7,0.35,1);
        emitShadow(o.x,o.gl,o.z,o.tx,o.tz,[0,1,0],0.72*k,0.9+0.6*(1-k));
        poses.push({r:r,x:o.x,y:o.y,z:o.z,tx:o.tx,tz:o.tz,v:o.v,air:o.air,roost:o.roost,sand:o.sand,D:x.D});
        if(adv>0&&!fx&&V.fxMode==="full"&&o.roost>0.15&&!o.air){ var dx=o.x-camP[0], dz=o.z-camP[2]; if(dx*dx+dz*dz<90*90&&Math.random()<o.roost*adv*60*0.9){ var bx=o.x-o.tx*0.95, bz=o.z-o.tz*0.95;
          spawn(bx+(Math.random()-0.5)*0.3,o.y+0.15,bz+(Math.random()-0.5)*0.3,-o.tx*o.v*0.35+(Math.random()-0.5)*2.2,1.5+Math.random()*2.6,-o.tz*o.v*0.35+(Math.random()-0.5)*2.2,0.22+Math.random()*0.22,0.7+Math.random()*0.5,o.sand?1:0); } }
      } else if(x.mode==="crash"){ var oc=emitCrash(r,T); poses.push({r:r,x:oc.x,y:oc.y,z:oc.z,tx:oc.tx,tz:oc.tz,v:0,crash:true,D:r.crash.D});
        if(adv>0&&T-r.crash.T0<1.3&&!fx){ for(var q=0;q<3;q++) spawn(oc.x,oc.y+0.2,oc.z,(Math.random()-0.5)*3,1+Math.random()*2.5,(Math.random()-0.5)*3,0.35+Math.random()*0.4,1.1+Math.random()*0.6,oc.sand?1:0); } }
      else if(x.mode==="park"){ var pk=r.park; ridePose(pk.D,pk.lat,o); o.air=false; o.y=TK.ground(C,o.s,pk.lat); o.lean=pk.crashed?0:0; o.pitch=0; var Mp=bikeMats(o,r,0.5); emitRider(r,o,Mp,"lying");
        if(!pk.crashed) emitRiderBody(r,Mp,0); else { ridePose(pk.D+0.2,pk.lat-(pk.lat>=0?1:-1)*0.8,PO2); GL.frame(C12,PO2.x,TK.ground(C,PO2.s,pk.lat),PO2.z,PO2.tx,0,PO2.tz,0); GL.amul(B12,C12,GL.local(L12,0,0.92,0,0.2,0,0,1)); putInst(IBD.upper,counts.upper,B12,r.col,r.acc); legs(r,C12,0,0.92,0.03,0.06); counts.upper++; }
        poses.push({r:r,x:o.x,y:o.y,z:o.z,parked:true,out:!!pk.crashed||r.out,D:pk.D}); }
    });
    /* people: the flagger, the yellow-flag marshal */
    counts.person=0;
    var FG=SC.flagger;
    GL.local(B12,FG.x,FG.y,FG.z,0,FG.yaw,0,1); putInst(IBD.person,counts.person++,B12,[0.12,0.13,0.16],[1,1,1]);
    var marshal=null;
    if(V.yellow&&V.T>=V.yellow.T0&&V.lap<=V.yellow.lap){ var ys=V.yellow.s, yi=Math.round(ys/C.DS)%C.N, side=sideClear(C,ys,1,C.hw[yi]+2.5)>sideClear(C,ys,-1,C.hw[yi]+2.5)?1:-1, lat=side*(C.hw[yi]+2.2);
      var mx=C.x[yi]-C.tz[yi]*lat, mz=C.z[yi]+C.tx[yi]*lat, my=C.outdoor?TK.ground(C,ys,lat)-0.1:0; var myaw=Math.atan2(side*C.tx[yi],side*C.tz[yi]); GL.local(B12,mx,my,mz,0,myaw,0,1); putInst(IBD.person,counts.person++,B12,[0.95,0.55,0.12],[1,1,1]); marshal={x:mx,y:my,z:mz,yaw:myaw}; }
    if(SC.crowd) SC.crowd.forEach(function(p){ if(counts.person<11){ GL.local(B12,p.x,p.y,p.z,0,-p.yaw,0,1); putInst(IBD.person,counts.person++,B12,p.col,[1,1,1]); } });
    V.marshal=marshal;
    /* the gate: down once it has dropped */
    var gA=V.dropT==null||T<0?0:Math.min(1.45,sstep(T/0.32)*1.45+Math.sin(clamp(T/0.32,0,1)*PI)*0.05);
    GL.frame(A12,C.x[0]+C.tx[0]*1.2,C.E[0],C.z[0]+C.tz[0]*1.2,C.tx[0],0,C.tz[0],0);
    GL.amul(B12,A12,GL.local(L12,0,0,C.off[0],gA,0,0,1)); putInst(IBD.gate,0,B12,[1,1,1],[1,1,1]);
    if(adv>0&&V.fxMode==="full"&&!fx) stepParts(adv); else if(adv>0){ parts.n=0; counts.part=0; }
    /* labels: the top of the field, you, the red plate, the fighters of a shown battle; OUT under a crashed-out rider */
    var showAll=CAM.close;
    poses.forEach(function(p){ var r=p.r;
      var want=showAll||r.me||r.red||(!p.parked&&r.pos<3)||(V.shot&&V.shot.pair&&V.shot.pair.indexOf(r.s)>=0)||(V.shot&&V.shot.focus===r.s)||p.crash||p.out;
      if(!want||p.parked&&!p.out) return;
      var isOut=p.out||(r.crash&&r.crash.kind==="out"&&V.T>=r.crash.T0+1.2);
      emitLabel(p.x,p.y+1.95,p.z,isOut?64+r.k:r.k,r.k,labelPx,0);
    });
  }
  /* the flags: the flagger's (white / checkered) and the marshal's yellow, waving */
  function buildFlags(){
    var d=IBDf, n=0, t=now()/1000;
    function flag(px,py,pz,yaw,kind,phase){
      GL.local(C12,px,py,pz,0,yaw,0,1);
      var sw=Math.sin(t*6.2+phase)*0.7, cu=Math.cos(sw), su=Math.sin(sw), H=[0.16,1.86,0.3], T=[H[0],H[1]+1.15*cu,H[2]+1.15*su];
      function W(p){ return [C12[0]*p[0]+C12[1]*p[1]+C12[2]*p[2]+C12[3],C12[4]*p[0]+C12[5]*p[1]+C12[6]*p[2]+C12[7],C12[8]*p[0]+C12[9]*p[1]+C12[10]*p[2]+C12[11]]; }
      n=quadBeam(d,n,W([H[0],H[1]-0.25,H[2]]),W(T),0.03,[0.85,0.85,0.88,0]);
      var nx2=6, ny2=4, fw=0.95, fh=0.66;
      for(var i=0;i<nx2;i++) for(var j=0;j<ny2;j++){
        var col=kind==="yellow"?[1.15,0.88,0.1,2]:kind==="white"?[1.15,1.15,1.12,2]:((i+j)%2?[0.05,0.05,0.06,0]:[1.08,1.08,1.05,2]);
        var P=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(function(q){ var u=q[0]/nx2, v=q[1]/ny2, wave=Math.sin(u*4.5-t*9+phase)*0.13*u;
          return W([T[0]+wave, T[1]-v*fh*cu-u*fw*su, T[2]-v*fh*su+u*fw*cu]); });
        n=quadFace(d,n,P,col);
      }
    }
    var FG=SC.flagger;
    if(V.flag) flag(FG.x,FG.y,FG.z,FG.yaw,V.flag==="white"?"white":"checkered",0);
    if(V.marshal) flag(V.marshal.x,V.marshal.y,V.marshal.z,V.marshal.yaw,"yellow",1.7);
    return n;
  }
  var IBDf=new Float32Array(3000*10);
  function quadFace(d,n,P,col){ var ax=P[1][0]-P[0][0], ay=P[1][1]-P[0][1], az=P[1][2]-P[0][2], bx=P[3][0]-P[0][0], by=P[3][1]-P[0][1], bz=P[3][2]-P[0][2], nx=ay*bz-az*by, ny=az*bx-ax*bz, nz=ax*by-ay*bx, l=Math.hypot(nx,ny,nz)||1;
    [0,1,2,0,2,3].forEach(function(k){ if(n>=2990) return; var o=n*10; d[o]=P[k][0]; d[o+1]=P[k][1]; d[o+2]=P[k][2]; d[o+3]=nx/l; d[o+4]=ny/l; d[o+5]=nz/l; d[o+6]=col[0]; d[o+7]=col[1]; d[o+8]=col[2]; d[o+9]=col[3]; n++; }); return n; }
  function quadBeam(d,n,a,b,w,col){ var P=[[a[0]-w,a[1],a[2]],[a[0]+w,a[1],a[2]],[b[0]+w,b[1],b[2]],[b[0]-w,b[1],b[2]]]; n=quadFace(d,n,P,col); var Q=[[a[0],a[1],a[2]-w],[a[0],a[1],a[2]+w],[b[0],b[1],b[2]+w],[b[0],b[1],b[2]-w]]; return quadFace(d,n,Q,col); }

  /* ---------- the camera of the shot ---------- */
  var EYE=[0,0,0], TGT=[0,0,0];
  function riderPos(s){ for(var i=0;i<poses.length;i++) if(poses[i].r.s===s) return poses[i]; return null; }
  function nearest(sp){ var b=null, bd=1e9; poses.forEach(function(p){ if(p.parked) return; var d=Math.hypot(p.x-sp.x,p.z-sp.z); if(d<bd){ bd=d; b=p; } }); return b; }
  function camera(dt){
    var C=V.C, S=SC, sh=V.shot||{kind:"heli",el:0}, lead=riderPos(V.leadS)||poses.filter(function(p){ return !p.parked; })[0], fov=0.9, close=false;
    var focus=sh.focus!=null&&sh.focus>=0?riderPos(sh.focus):null; if(!focus) focus=lead;
    var u=sh.el||0;
    switch(sh.kind){
      case "heli": { var a=0.35+u*0.08+(V.rot*0.7), R0=S.radius*1.25, cx=S.centre; EYE[0]=cx[0]+Math.cos(a)*R0; EYE[1]=(C.outdoor?S.radius*0.55:42)+cx[1]; EYE[2]=cx[2]+Math.sin(a)*R0; TGT[0]=cx[0]; TGT[1]=cx[1]; TGT[2]=cx[2]; fov=0.95; break; }
      case "gate": { var G=S.gate, Tn=V.T; EYE[0]=G.x; EYE[1]=G.y; EYE[2]=G.z;
        var gc=[C.x[0]-C.tz[0]*C.off[0],C.E[0]+0.7,C.z[0]+C.tx[0]*C.off[0]];
        if(Tn>0.4&&lead){ var w2=sstep((Tn-0.4)/1.2); TGT[0]=lerp(gc[0],lead.x,w2); TGT[1]=lerp(gc[1],lead.y+0.6,w2); TGT[2]=lerp(gc[2],lead.z,w2); fov=lerp(0.5,0.42,w2); }
        else { TGT[0]=gc[0]; TGT[1]=gc[1]; TGT[2]=gc[2]; fov=0.5; } close=true; break; }
      case "chase": { var f=focus||lead; if(!f) break; var hx=f.tx, hz=f.tz; EYE[0]=f.x-hx*10.5; EYE[1]=f.y+3.6; EYE[2]=f.z-hz*10.5; TGT[0]=f.x+hx*3.5; TGT[1]=f.y+0.5; TGT[2]=f.z+hz*3.5; fov=0.85; close=true;
        if(C.outdoor){ var gy=landAt(S,EYE[0],EYE[2])+1.5; if(EYE[1]<gy) EYE[1]=gy; } break; }
      case "side": case "turn1": case "yellow": { var sp=sh.spot||S.turn1, f2=sh.kind==="turn1"?lead:sh.kind==="yellow"?nearest(V.marshal||sp):(focus||lead); EYE[0]=sp.x; EYE[1]=sp.y; EYE[2]=sp.z;
        if(f2){ TGT[0]=f2.x+f2.tx*(f2.v||8)*0.12; TGT[1]=f2.y+0.8; TGT[2]=f2.z+f2.tz*(f2.v||8)*0.12;
          if(sh.kind==="yellow"&&V.marshal){ TGT[0]=lerp(TGT[0],V.marshal.x,0.45); TGT[1]=lerp(TGT[1],V.marshal.y+1.6,0.45); TGT[2]=lerp(TGT[2],V.marshal.z,0.45); }
          var dd=Math.hypot(TGT[0]-sp.x,TGT[2]-sp.z,TGT[1]-sp.y); fov=clamp(2*Math.atan((sh.kind==="yellow"?13:9)/Math.max(1,dd)),0.3,1.05); close=dd<34; } break; }
      case "wide": { var sp2=sh.spot||S.secs[0], f3=focus||lead; var F=sp2.F, s0=F?F.s0:sp2.s, i0=Math.round(s0/C.DS)%C.N, side=sp2.side||1, lat=side*(C.hw[i0]+(C.outdoor?32:20));
        EYE[0]=C.x[i0]-C.tz[i0]*lat-C.tx[i0]*12; EYE[2]=C.z[i0]+C.tx[i0]*lat-C.tz[i0]*12; EYE[1]=(C.outdoor?Math.max(C.E[i0],landAt(S,EYE[0],EYE[2])):0)+(C.outdoor?24:16);
        if(f3){ TGT[0]=f3.x; TGT[1]=f3.y; TGT[2]=f3.z; } fov=0.72; close=false; break; }
      case "battle": { var pa=riderPos(sh.pair[0]), pb=riderPos(sh.pair[1]); if(!pa||!pb){ pa=pb=focus||lead; } if(!pa) break; var mx=(pa.x+pb.x)/2, my=(pa.y+pb.y)/2, mz=(pa.z+pb.z)/2, tx=pa.tx, tz=pa.tz;
        var sd=sh.side||(sh.side=(sideClear(C,pa.D%C.L,1,9)>=sideClear(C,pa.D%C.L,-1,9)?1:-1)); EYE[0]=mx-tz*7.5*sd-tx*3; EYE[1]=my+1.9; EYE[2]=mz+tx*7.5*sd-tz*3; TGT[0]=mx+tx*1.5; TGT[1]=my+0.75; TGT[2]=mz+tz*1.5; fov=0.92; close=true;
        if(C.outdoor){ var gy2=landAt(S,EYE[0],EYE[2])+1.2; if(EYE[1]<gy2) EYE[1]=gy2; } break; }
      case "crash": { var sp3=sh.spot, f4=sh.focus>=0?riderPos(sh.focus):null; if(!sp3&&f4){ sp3={x:f4.x+8,y:f4.y+3.5,z:f4.z+8}; } if(!sp3) break; EYE[0]=sp3.x; EYE[1]=sp3.y; EYE[2]=sp3.z;
        if(f4){ TGT[0]=f4.x; TGT[1]=f4.y+0.5; TGT[2]=f4.z; var dd2=Math.hypot(f4.x-sp3.x,f4.z-sp3.z); fov=clamp(2*Math.atan(4.6/Math.max(1,dd2)),0.3,0.9); } close=true; break; }
      case "line": { var L=S.line, f5=lead, FG2=S.flagger; EYE[0]=L.x; EYE[1]=L.y; EYE[2]=L.z;
        if(f5){ var dl=Math.hypot(f5.x-FG2.x,f5.z-FG2.z), w3=clamp(dl/40,0,1)*0.55; TGT[0]=lerp(FG2.x,f5.x,w3); TGT[1]=lerp(FG2.y+0.5,f5.y+0.8,w3); TGT[2]=lerp(FG2.z,f5.z,w3); } else { TGT[0]=FG2.x; TGT[1]=FG2.y+0.5; TGT[2]=FG2.z; }
        fov=0.72; close=true; break; }
    }
    /* a phone held upright shows more height: lift the camera and aim it lower so the track, not the roof, fills the frame */
    if(V.H>V.W*1.05&&sh.kind!=="heli"&&sh.kind!=="wide"){ var up=sh.kind==="chase"?1.6:sh.kind==="gate"?1.4:1.2; EYE[1]+=up; TGT[1]-=0.45; }
    /* smoothing inside a shot (reset on every cut) */
    if(!CAM.se||!CAM.st){ CAM.se=EYE.slice(); CAM.st=TGT.slice(); CAM.fv=fov; V.cut=true; }
    else { var ke=1-Math.exp(-dt/0.22), kt=1-Math.exp(-dt/0.12); for(var i=0;i<3;i++){ CAM.se[i]+=(EYE[i]-CAM.se[i])*ke; CAM.st[i]+=(TGT[i]-CAM.st[i])*kt; } CAM.fv+=(fov-CAM.fv)*ke; }
    CAM.eye=CAM.se; CAM.tgt=CAM.st; CAM.fov=CAM.fv; CAM.close=close;
  }

  /* ---------- draw ---------- */
  function resize(){
    var w=Math.max(1,host.clientWidth), h=Math.max(1,host.clientHeight), tv=document.documentElement.hasAttribute("data-tv");
    var dpr=Math.min(g.devicePixelRatio||1,tv?1.5:2), budget=(fx||V.fxMode!=="full")?0.55e6:tv?1.35e6:1.1e6;
    var sc=Math.min(dpr,Math.sqrt(budget/(w*h)))*(V.half?0.8:1); sc=Math.max(0.5,sc);
    var W=Math.round(w*sc), H=Math.round(h*sc);
    if(W!==canvas.width||H!==canvas.height){ canvas.width=W; canvas.height=H; }
    canvas.style.width=w+"px"; canvas.style.height=h+"px"; V.W=W; V.H=H; V.dpr=sc; V.cssW=w; V.cssH=h;
  }
  V.resize=function(){ resize(); if(!V.run) draw(0); };
  function draw(dt){
    var C=V.C; if(!C||!SC) return;
    resize();
    var Lg=SC.L, W=V.W, H=V.H;
    R.frame(); gl.viewport(0,0,W,H);
    gl.clearColor(Lg.clear[0],Lg.clear[1],Lg.clear[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
    /* CAM.fov is the vertical field of a 16:9 frame: a portrait screen keeps most of the width (a taller view), a very wide one a little less height */
    var asp=W/H, kk=(16/9)/asp, fy=Math.min(1.4,2*Math.atan(Math.tan(CAM.fov/2)*(kk>1?Math.pow(kk,0.52):Math.pow(kk,0.35))));
    GL.persp(PROJ,fy,asp,0.3,C.outdoor?2400:900); GL.lookAt(VIEW,CAM.eye,CAM.tgt,[0,1,0]); GL.mul(VP,PROJ,VIEW); GL.inv(IVP,VP);
    function common(P){ var u=P.u; gl.uniformMatrix4fv(u.uVP,false,VP); if(u.uSun!=null){ gl.uniform3fv(u.uSun,Lg.sun); gl.uniform3fv(u.uSunCol,Lg.sunCol); gl.uniform3fv(u.uSky,Lg.sky); gl.uniform3fv(u.uGnd,Lg.gnd); }
      if(u.uFog!=null){ gl.uniform3fv(u.uFog,Lg.fog); gl.uniform2fv(u.uFogR,Lg.fogR); } if(u.uCam!=null) gl.uniform3fv(u.uCam,CAM.eye); if(u.uSpot!=null) gl.uniform4fv(u.uSpot,Lg.spot); }
    /* the sky */
    var P=R.progs.sky; R.use(P); gl.depthMask(false); gl.uniformMatrix4fv(P.u.uIVP,false,IVP); gl.uniform3fv(P.u.uTop,Lg.top); gl.uniform3fv(P.u.uHor,Lg.hor); gl.uniform3fv(P.u.uSun,Lg.sun); gl.uniform3fv(P.u.uSunCol,Lg.sunCol);
    gl.uniform1f(P.u.uNight,Lg.nightK); gl.uniform1f(P.u.uClouds,Lg.clouds); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,TEX.dirt); gl.uniform1i(P.u.uTex,0); R.sky(P); gl.depthMask(true);
    /* the ground and the track */
    P=R.progs.dirt; R.use(P); common(P); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,TEX.dirt); gl.uniform1i(P.u.uTex,0);
    gl.uniform3fv(P.u.uDirt,SC.cols.dirt); gl.uniform3fv(P.u.uSand,SC.cols.sand); gl.uniform3fv(P.u.uGrass,SC.cols.grass);
    R.draw(P,SC.floorMesh,null); R.draw(P,SC.track,null);
    /* props */
    P=R.progs.lit; R.use(P); common(P); R.draw(P,SC.props,null);
    R.update(IB.gate,IBD.gate,1); R.draw(P,SC.gateMesh,IB.gate,1);
    /* the bikes and riders: one draw per part for the whole field */
    var nb=counts.body; if(nb){ R.update(IB.body,IBD.body,nb); R.draw(P,M.body,IB.body,nb); R.update(IB.wheel,IBD.wheel,counts.wheel); R.draw(P,M.wheel,IB.wheel,counts.wheel); }
    if(counts.upper){ R.update(IB.upper,IBD.upper,counts.upper); R.draw(P,M.upper,IB.upper,counts.upper); R.update(IB.thigh,IBD.thigh,counts.upper); R.draw(P,M.thigh,IB.thigh,counts.upper); R.update(IB.shin,IBD.shin,counts.upper); R.draw(P,M.shin,IB.shin,counts.upper); }
    if(counts.person){ R.update(IB.person,IBD.person,counts.person); R.draw(P,M.person,IB.person,counts.person); }
    var nf=buildFlags(); if(nf){ R.update(IB.flag,IBDf,nf); R.use(P); common(P); drawArraysLit(P,IB.flag,nf); }
    /* plates */
    if(ATL.dirty){ R.retex(ATL.t,ATL.c); ATL.dirty=false; }
    P=R.progs.plate; R.use(P); common(P); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ATL.t); gl.uniform1i(P.u.uAtlas,0);
    if(counts.plate){ R.update(IB.plate,IBD.plate,counts.plate); R.draw(P,M.plate,IB.plate,counts.plate); }
    /* shadows, dust: blended */
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2,-4);
    P=R.progs.decal; if(counts.decal){ R.use(P); gl.uniformMatrix4fv(P.u.uVP,false,VP); R.update(IB.decal,IBD.decal,counts.decal); R.quads(P,IB.decal,counts.decal); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    P=R.progs.part; if(counts.part){ R.use(P); gl.uniformMatrix4fv(P.u.uVP,false,VP); gl.uniform3fv(P.u.uRight,[VIEW[0],VIEW[4],VIEW[8]]); gl.uniform3fv(P.u.uUp,[VIEW[1],VIEW[5],VIEW[9]]); gl.uniform1f(P.u.uLit,SC.night?0.9:1.05); R.update(IB.part,IBD.part,counts.part); R.quads(P,IB.part,counts.part); }
    /* the stadium light glows */
    if(SC.lights&&SC.night){ var gd=IBD.part, gn=0; SC.lights.forEach(function(l){ if(gn<60){ gd[gn*8]=l[0]; gd[gn*8+1]=l[1]; gd[gn*8+2]=l[2]; gd[gn*8+3]=7; gd[gn*8+4]=1.5; gd[gn*8+5]=1.45; gd[gn*8+6]=1.25; gd[gn*8+7]=0.5; gn++; } });
      R.use(P); gl.uniformMatrix4fv(P.u.uVP,false,VP); gl.uniform3fv(P.u.uRight,[VIEW[0],VIEW[4],VIEW[8]]); gl.uniform3fv(P.u.uUp,[VIEW[1],VIEW[5],VIEW[9]]); gl.uniform1f(P.u.uLit,1.6); R.update(IB.part,gd,gn); R.quads(P,IB.part,gn); }
    /* labels on top */
    gl.disable(gl.DEPTH_TEST);
    P=R.progs.label; if(counts.label){ R.use(P); gl.uniformMatrix4fv(P.u.uVP,false,VP); gl.uniform2fv(P.u.uPx,[1/W,1/H]); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ATL.t); gl.uniform1i(P.u.uAtlas,0);
      var nl=fixLabels(W,H); if(nl){ R.update(IB.label,LBL,nl); R.quads(P,IB.label,nl); } }
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    V.stat={draws:R.draws,tris:R.tris};
  }
  /* label sizes: a label with a negative size is the OUT tag under its rider's plate */
  var LBL=new Float32Array(90*12);
  function fixLabels(W,H){
    var d=IBD.label, k=V.dpr, items=[], i, out=0;
    for(i=0;i<counts.label;i++){ var o=i*12, x=d[o], y=d[o+1], z=d[o+2];
      var cw=VP[3]*x+VP[7]*y+VP[11]*z+VP[15]; if(cw<=0.2) continue;
      var cx=(VP[0]*x+VP[4]*y+VP[8]*z+VP[12])/cw, cy=(VP[1]*x+VP[5]*y+VP[9]*z+VP[13])/cw;
      var h=d[o+8]*k, yo=d[o+9], sx=(cx*0.5+0.5)*W, sy=(cy*0.5+0.5)*H+h/2+4*k+yo*h;
      items.push({i:i,w:cw,x:sx,y:sy,h:h,yo:yo,grp:d[o+3]}); }
    items.sort(function(a,b){ return a.w-b.w||(a.yo?1:0)-(b.yo?1:0); });
    var placed=[], keepGrp={};
    items.forEach(function(it){
      if(it.yo){ if(!keepGrp[it.grp+"|"+it.x.toFixed(0)]) return; }
      else { var hw2=it.h, hh=it.h/2;
        for(var j=0;j<placed.length;j++){ var p=placed[j]; if(Math.abs(p.x-it.x)<hw2+p.hw+2*k&&Math.abs(p.y-it.y)<hh+p.hh+2*k) return; }
        placed.push({x:it.x,y:it.y,hw:hw2,hh:hh}); keepGrp[it.grp+"|"+it.x.toFixed(0)]=1; }
      var o=it.i*12, q=out*12; for(var c=0;c<12;c++) LBL[q+c]=d[o+c];
      LBL[q+3]=1; LBL[q+8]=it.h; LBL[q+9]=it.h/2; LBL[q+10]=it.h/2+4*k+it.yo*it.h; out++;
    });
    return out;
  }
  function drawArraysLit(P,vb,n){ R.use(P); var spec=vb.spec, off=0; gl.bindBuffer(gl.ARRAY_BUFFER,vb.b);
    spec.forEach(function(s){ var loc=P.a[s[0]]; if(loc!=null&&loc>=0){ gl.enableVertexAttribArray(loc); R.enabled[loc]=1; gl.vertexAttribPointer(loc,s[1],gl.FLOAT,false,vb.stride,off); } off+=s[1]*4; });
    gl.vertexAttrib4f(P.a.iA,1,0,0,0); gl.vertexAttrib4f(P.a.iB,0,1,0,0); gl.vertexAttrib4f(P.a.iC,0,0,1,0); gl.vertexAttrib4f(P.a.iTeam,1,1,1,1); gl.vertexAttrib4f(P.a.iAcc,1,1,1,1);
    gl.drawArrays(gl.TRIANGLES,0,n); R.draws++; R.tris+=n/3; }
  function renderStill(){ if(!V.C) return; update(0); camera(0); draw(0); }

  /* ---------- the loop ---------- */
  function tick(t){
    V.raf=0; if(!V.run) return;
    if(document.hidden){ V.run=false; return; }
    var mo=motion(); V.fxMode=mo;
    if(mo==="off"){ V.run=false; renderStill(); return; }
    var dt=(V.last?Math.min(0.1,(t-V.last)/1000):0.016)*(V.timeScale||1);   /* timeScale: tests only (the race view is real time) */
    if((mo==="reduced"||V.half)&&V.last&&t-V.last<31){ V.raf=requestAnimationFrame(tick); return; }
    V.last=t;
    var c0=now();
    try{ update(dt); camera(dt); draw(dt); }catch(e){ V.err=String(e&&e.stack||e); try{ console.warn("mxwar 3d:",e); }catch(x){} }
    var cost=now()-c0; V.frames++; V.ms+=cost; V.msN++;
    V.costs.push(cost); if(V.costs.length>120) V.costs.shift();
    /* a device that can't keep up (frames over 22 ms of our own work for 3 s) drops to 30 fps and a smaller canvas */
    if(!V.half&&V.msN>=90){ if(V.ms/V.msN>22) V.half=true; V.ms=0; V.msN=0; }
    V.raf=requestAnimationFrame(tick);
  }
  V.start=function(){ if(V.run||document.hidden) return; if(motion()==="off"){ renderStill(); return; } V.run=true; V.last=0; V.raf=requestAnimationFrame(tick); };
  V.stop=function(){ V.run=false; if(V.raf){ cancelAnimationFrame(V.raf); V.raf=0; } };
  V.show=function(on){ V.want=!!on; if(on) V.start(); else V.stop(); };
  document.addEventListener("visibilitychange",function(){ if(document.hidden) V.stop(); else if(V.want) V.start(); });
  canvas.addEventListener("webglcontextlost",function(e){ e.preventDefault(); V.lost=true; V.stop(); V.waiters.splice(0).forEach(function(w){ try{ w.res(); }catch(x){} }); });
  canvas.addEventListener("webglcontextrestored",function(){ V.lost=false; try{ R.programs(); initModels(); if(V.C){ SC=buildScene(V.C); SC.L=light(SC); atlasRedraw(); } if(V.want) V.start(); }catch(e){ V.err=String(e); } });
  /* tests and tools */
  V.freeze=function(on){ V.frozen=!!on; };
  V.debugShot=function(kind,o){ o=o||{}; V.res=[]; setShot({kind:kind,d:o.d||999,spot:o.spot||(kind==="side"||kind==="wide"?(SC.secs.filter(function(x){ return !o.type||x.F&&x.F.type===o.type; })[0]):null),focus:o.focus!=null?o.focus:-1,pair:o.pair}); };
  V.timeFor=function(type){ var sp=SC.secs.filter(function(x){ return x.F&&x.F.type===type; })[0]; return sp?{lip:sp.F.lip!=null?leadTimeAt(sp.F.lip,(V.lap>1?lapEnd(V.lap-1):0)):null,s0:leadTimeAt(sp.F.s0,(V.lap>1?lapEnd(V.lap-1):0)),F:{type:sp.F.type,s0:sp.F.s0,s1:sp.F.s1,lip:sp.F.lip,tgt:sp.F.tgt}}:null; };
  V.setT=function(t){ V.T=t; };
  V.stats=function(){ var cs=V.costs.slice().sort(function(a,b){ return a-b; }); return {draws:V.stat?V.stat.draws:0,tris:V.stat?V.stat.tris:0,w:V.W,h:V.H,scale:+V.dpr.toFixed(2),webgl2:R.v2,
    jsMs:cs.length?+(cs.reduce(function(a,b){ return a+b; },0)/cs.length).toFixed(2):0,jsP95:cs.length?+cs[Math.floor(cs.length*0.95)].toFixed(2):0,frames:V.frames,half:V.half,riders:V.riders.length,parts:counts.part}; };
  V.state=function(){ return {T:+V.T.toFixed(2),lap:V.lap,resLap:V.resLap,cuts:V.cuts|0,phase:V.phase,shot:V.shot?V.shot.kind:null,shotEl:V.shot?+V.shot.el.toFixed(2):0,flag:V.flag,yellow:V.yellow?{lap:V.yellow.lap,seat:V.yellow.seat}:null,
    waiting:V.waiters.length,lapT:V.lapT?+V.lapT.toFixed(2):null,track:V.trackName,status:V.trackStatus,lead:V.leadS,err:V.err||null,
    order:poses.filter(function(p){ return !p.parked; }).map(function(p){ return p.r.s; }),crashes:V.riders.filter(function(r){ return r.crash; }).map(function(r){ return {s:r.s,kind:r.crash.kind,T0:+r.crash.T0.toFixed(2)}; }),
    air:poses.filter(function(p){ return p.air; }).length,run:V.run}; };
  V.debugCam=function(){ var f=V.shot&&V.shot.focus>=0?riderPos(V.shot.focus):null; return {eye:CAM.eye.map(function(x){ return +x.toFixed(1); }),tgt:CAM.tgt.map(function(x){ return +x.toFixed(1); }),fov:+CAM.fov.toFixed(2),shot:V.shot&&V.shot.kind,spot:V.shot&&V.shot.spot?[+V.shot.spot.x.toFixed(1),+V.shot.spot.y.toFixed(1),+V.shot.spot.z.toFixed(1)]:null,focus:f?[+f.x.toFixed(1),+f.y.toFixed(1),+f.z.toFixed(1),!!f.crash]:null,marshal:V.marshal?[+V.marshal.x.toFixed(1),+V.marshal.z.toFixed(1)]:null}; };
  V.order=function(){ return poses.filter(function(p){ return !p.parked; }).sort(function(a,b){ return b.D-a.D; }).map(function(p){ return p.r.s; }); };
  V.destroy=function(){ V.stop(); try{ canvas.remove(); }catch(e){} };
  initModels();
  return V;
}

MX.Race3D={create:create,supported:function(){ try{ var c=document.createElement("canvas"); return !!(c.getContext("webgl2")||c.getContext("webgl")); }catch(e){ return false; } }};
})(typeof window!=="undefined"?window:globalThis);
