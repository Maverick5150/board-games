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
/* the demo / capture clock: a VIRTUAL time (ms) that only moves when a frame is stepped (V.step), and a seeded random source, so a recorded run is
   exactly repeatable; in the game both are the real clock and Math.random */
var VCLK={on:false,ms:0}, RNG={f:null}, VR={f:null};
function vnow(){ return VCLK.on?VCLK.ms:now(); }
function rand(){ return RNG.f?RNG.f():Math.random(); }
function vrand(){ return VR.f?VR.f():Math.random(); }
function hex(c){ c=String(c||"#888888").replace("#",""); if(c.length===3) c=c[0]+c[0]+c[1]+c[1]+c[2]+c[2]; var n=parseInt(c,16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; }

/* ---------------- textures made in code ---------------- */
function vnoise(W,cell,seed){ /* tileable value noise, W x W, lattice every cell px */
  var R=rng(seed), n=W/cell, lat=new Float32Array(n*n), out=new Float32Array(W*W), x, y;
  for(var i=0;i<n*n;i++) lat[i]=R();
  for(y=0;y<W;y++) for(x=0;x<W;x++){ var fx=x/cell, fy=y/cell, ix=Math.floor(fx), iy=Math.floor(fy), tx=sstep(fx-ix), ty=sstep(fy-iy), x1=(ix+1)%n, y1=(iy+1)%n, x0=ix%n, y0=iy%n;
    out[y*W+x]=lerp(lerp(lat[y0*n+x0],lat[y0*n+x1],tx),lerp(lat[y1*n+x0],lat[y1*n+x1],tx),ty); }
  return out;
}
/* the track strip texture (u across the track, v along it, tiles every ~7 m): R light and dark patches, G the ruts (grooves along v), B a slow
   pattern, A the tyre TREAD printed in the ruts (a herringbone of knobs) */
function dirtTexture(seed,W){
  W=W||512; var out=new Uint8Array(W*W*4);
  var n1=vnoise(W,W/8,seed), n2=vnoise(W,W/32,seed+1), n3=vnoise(W,W/4,seed+2), n4=vnoise(W,W/64,seed+3), R=rng(seed+9), i, px, py;
  var lines=[];
  for(i=0;i<11;i++) lines.push({u:0.1+R()*0.8,w:0.012+R()*0.026,a:0.45+R()*0.55,ph:R()*TAU,amp:0.01+R()*0.02,tr:R()<0.7});
  for(py=0;py<W;py++) for(px=0;px<W;px++){
    var u=px/W, v=py/W, r=0, tr=0, o=(py*W+px)*4, ii=py*W+px;
    for(var k=0;k<lines.length;k++){ var L=lines[k], cu=L.u+Math.sin(v*TAU+L.ph)*L.amp*0.3, dd=Math.abs(u-cu)/L.w;
      if(dd<1){ var a=L.a*(1-dd*dd); if(a>r) r=a; if(L.tr&&dd<0.85){ var ch=Math.abs(((v*22+(u-cu)/L.w*1.6)%1+1)%1-0.5)*2; tr=Math.max(tr,(ch>0.45?1:0.15)*a); } } }
    var cl=R(), base=0.3+0.32*n1[ii]+0.22*n2[ii]+0.1*n4[ii]+0.06*n3[ii], clod=cl<0.01?(cl<0.005?-0.22:0.24):0;
    out[o]=clamp((base+clod)*255,0,255); out[o+1]=clamp((r*(0.8+0.2*n2[ii]))*255,0,255); out[o+2]=clamp((0.25+0.5*n3[ii]+0.25*n1[ii])*255,0,255); out[o+3]=clamp(tr*255,0,255);
  }
  return out;
}
/* a tiling normal / height / albedo map of loose dirt: R,G = the slope of the surface along world x and z (0.5 = flat), B = height, A = a
   brightness pattern. kind 0 = coarse (clods, cracks, pebbles, about 2 m a tile), 1 = fine grain (a few cm; the close-up under the lens) */
function detailTexture(seed,W,kind){
  var h=new Float32Array(W*W), R=rng(seed), i, x, y;
  var f1=vnoise(W,W/8,seed), f2=vnoise(W,W/16,seed+1), f3=vnoise(W,W/32,seed+2), f4=vnoise(W,W/64,seed+3), f5=vnoise(W,Math.max(2,W/128),seed+4);
  for(i=0;i<W*W;i++){ var r1=1-Math.abs(2*f2[i]-1);
    h[i]=kind===0?0.34*f1[i]+0.26*r1*r1+0.18*f3[i]+0.14*f4[i]+0.08*f5[i]:0.32*f3[i]+0.3*f4[i]+0.38*f5[i]; }
  function bump(cx,cy,rad,amp,pow){ var r2=Math.ceil(rad); for(var dy=-r2;dy<=r2;dy++) for(var dx=-r2;dx<=r2;dx++){ var d=Math.hypot(dx,dy)/rad; if(d>=1) continue; var xx=((cx+dx)%W+W)%W, yy=((cy+dy)%W+W)%W; h[yy*W+xx]+=amp*Math.pow(1-d*d,pow); } }
  var nClod=kind===0?Math.round(W*W/3600):Math.round(W*W/2600), nPeb=kind===0?Math.round(W*W/520):Math.round(W*W/260);
  for(i=0;i<nClod;i++) bump(Math.floor(R()*W),Math.floor(R()*W),(kind===0?W/55:W/60)*(0.6+R()*1.2),0.34*(0.5+R()),1.6);
  for(i=0;i<nPeb;i++){ var rr=(kind===0?W/260:W/150)*(0.7+R()*1.3); bump(Math.floor(R()*W),Math.floor(R()*W),rr,0.5*(0.4+R()*0.9),1.2); }
  var mn=1e9, mx=-1e9; for(i=0;i<W*W;i++){ if(h[i]<mn) mn=h[i]; if(h[i]>mx) mx=h[i]; }
  var out=new Uint8Array(W*W*4), S=kind===0?W/42:W/30;
  for(y=0;y<W;y++) for(x=0;x<W;x++){ var ii=y*W+x, hl=h[y*W+(x+W-1)%W], hr=h[y*W+(x+1)%W], hu=h[((y+W-1)%W)*W+x], hd=h[((y+1)%W)*W+x];
    var sx=clamp((hl-hr)*S,-0.5,0.5), sz=clamp((hu-hd)*S,-0.5,0.5), hv=(h[ii]-mn)/(mx-mn), o=ii*4;
    out[o]=Math.round((0.5+sx)*255); out[o+1]=Math.round((0.5+sz)*255); out[o+2]=Math.round(hv*255); out[o+3]=Math.round(clamp(0.25+0.9*hv-0.2*f1[ii]+0.2*f5[ii],0,1)*255); }
  return out;
}
/* four channels of smooth tiling noise: mud masks, cloth wrinkles, the dust's wisps */
function smoothTexture(seed,W){
  var a=vnoise(W,W/8,seed), b=vnoise(W,W/16,seed+1), c=vnoise(W,W/4,seed+2), d=vnoise(W,W/32,seed+3), out=new Uint8Array(W*W*4);
  for(var i=0;i<W*W;i++){ out[i*4]=Math.round(a[i]*255); out[i*4+1]=Math.round((0.6*b[i]+0.4*d[i])*255); out[i*4+2]=Math.round(c[i]*255); out[i*4+3]=Math.round(d[i]*255); }
  return out;
}

/* ---------------- models: models3d.js (the bike, the rider, the people) ---------------- */

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
    yellow:null,marshals:[],red:-1,fxMode:"full",half:false,costs:[],ucosts:[],lastShotKind:"",rot:0};
  var M={}, TEX={}, IB={}, SC=null;   // meshes, textures, instance buffers, the scene of the current course
  var VP=GL.m4(), PROJ=GL.m4(), VIEW=GL.m4(), IVP=GL.m4();
  var CAM={eye:[0,30,60],tgt:[0,0,0],fov:0.9,se:null,st:null};
  function motion(){ var B=g.BGUI; if(document.documentElement.getAttribute("data-motion")==="reduce"||(B&&B.reducedMotion&&B.reducedMotion())) return "off"; return document.documentElement.getAttribute("data-effects")==="reduced"?"reduced":"full"; }
  function speedK(){ return ({slow:1.5,fast:0.6})[g.bgGameSpeed]||1; }

  /* ---------- GPU resources that don't depend on the course ---------- */
  function initModels(){
    var Md=MX.Models;
    M.body=R.mesh(Md.body(0),"lit"); M.fork=R.mesh(Md.fork(0),"lit"); M.swing=R.mesh(Md.swing(0),"lit"); M.shock=R.mesh(Md.shock(0),"lit");
    M.wheelF=R.mesh(Md.wheel(0,false),"lit"); M.wheelR=R.mesh(Md.wheel(0,true),"lit"); M.torso=R.mesh(Md.torso(0),"lit");
    M.uarm=R.mesh(Md.uarm(0),"lit"); M.farm=R.mesh(Md.farm(0),"lit"); M.thigh=R.mesh(Md.thigh(0),"lit"); M.shin=R.mesh(Md.shin(0),"lit");
    M.r1s=R.mesh(Md.rigid(0,1),"lit"); M.r1t=R.mesh(Md.rigid(1,1),"lit"); M.w1=R.mesh(Md.wheel(1,false),"lit"); M.r2s=R.mesh(Md.rigid(0,2),"lit"); M.r2t=R.mesh(Md.rigid(1,2),"lit");
    M.person=R.mesh(Md.person(),"lit"); M.plate=[{vb:R.vbuf(new Float32Array([0,-0.11,-0.15,0,0, 0,-0.11,0.15,1,0, 0,0.11,0.15,1,1, 0,0.11,-0.15,0,1]),[["aPos",3],["aUV",2]],false),ib:R.ibuf(new Uint16Array([0,1,2,0,2,3])),tris:2}];
    var ispec=[["iA",4],["iB",4],["iC",4],["iTeam",4],["iAcc",4]];
    PARTS.forEach(function(k){ IB[k]=R.vbuf(new Float32Array(CAP*20),ispec,true); });
    IB.person=R.vbuf(new Float32Array(128*20),ispec,true);
    IB.gate=R.vbuf(new Float32Array(20),ispec,true);
    IB.plate=R.vbuf(new Float32Array(240*16),[["iA",4],["iB",4],["iC",4],["iUV",4]],true);
    IB.part=R.vbuf(new Float32Array(400*8),[["iP",4],["iCol",4]],true);
    IB.label=R.vbuf(new Float32Array(90*12),[["iP",4],["iUV",4],["iS",4]],true);
    IB.decal=R.vbuf(new Float32Array(64*12),[["iP",4],["iD",4],["iN",4]],true);
    IB.flag=R.vbuf(new Float32Array(3000*10),[["aPos",3],["aNor",3],["aCol",4]],true);
    IB.glow=R.vbuf(new Float32Array(48*8),[["iP",4],["iCol",4]],true);
    IB.clump=R.vbuf(new Float32Array(600*12),[["iP",4],["iCol",4],["iV",4]],true);
    /* the textures made in code (smaller on a device that starts at the lean level) */
    var big=V.q>=1;
    TEX.dirt=R.tex(dirtTexture(7,big?512:256),{aniso:4,w:big?512:256,h:big?512:256});
    TEX.detA=R.tex(detailTexture(21,big?512:256,0),{aniso:4,w:big?512:256,h:big?512:256});
    TEX.detB=R.tex(detailTexture(33,big?256:128,1),{aniso:2,w:big?256:128,h:big?256:128});
    TEX.smooth=R.tex(smoothTexture(55,128),{w:128,h:128});
    /* polish: a 64 x 64 white-noise texture for the per-cell patterns (the crowd, the LED boards, the suites, the stars): a texture lookup
       instead of a sin() hash, which falls apart in the 16-bit mediump floats of a Fire TV's GPU */
    var nc=document.createElement("canvas"); nc.width=nc.height=64; var nx=nc.getContext("2d"), ni=nx.createImageData(64,64), Rn0=rng(1234);
    for(var q=0;q<ni.data.length;q++) ni.data[q]=(q&3)===3?255:Math.floor(Rn0()*256);   /* opaque: a canvas keeps colour exactly only at full alpha */
    nx.putImageData(ni,0,0); TEX.noise=R.tex(nc,{nearest:true});
    atlasInit(); bannerInit();
  }
  /* ---------- the plate / label atlas: 8 x 8 cells of 128 x 64 ---------- */
  var ATL={c:null,x:null,t:null,cells:{},dirty:false};
  function atlasInit(){ ATL.c=document.createElement("canvas"); ATL.c.width=1024; ATL.c.height=2048; ATL.x=ATL.c.getContext("2d"); ATL.t=R.tex(ATL.c,{clamp:true}); ATL.dirty=true; }
  function cellUV(i){ var cx=(i%8)*128, cy=Math.floor(i/8)*64; return [(cx+2)/1024,1-(cy+62)/2048,(cx+126)/1024,1-(cy+2)/2048]; }
  function jerseyUV(k){ var cx=(k%8)*128, cy=1024+Math.floor(k/8)*128; return [(cx+3)/1024,1-(cy+125)/2048,(cx+125)/1024,1-(cy+3)/2048]; }
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
  /* the print on the jersey's back: the surname above and the number big (no background: it is printed on the cloth), in white on a dark jersey,
     in near black on a light one, with a thin outline of the other for readability */
  function drawJersey(r){
    var x=ATL.x, k=r.k, cx=(k%8)*128, cy=1024+Math.floor(k/8)*128, c=r.col, lum=0.299*c[0]+0.587*c[1]+0.114*c[2], dark=lum<0.55;
    x.clearRect(cx,cy,128,128); x.textAlign="center"; x.textBaseline="middle";
    var fill=dark?"#f4f1ea":"#15151a", edge=dark?"rgba(0,0,0,.55)":"rgba(255,255,255,.45)", t=String(r.plate==null?"-":r.plate), nm=String(r.name||"").split(" ").slice(-1)[0].toUpperCase().slice(0,10);
    x.lineJoin="round"; x.lineWidth=5; x.strokeStyle=edge; x.fillStyle=fill;
    var fs=t.length>2?64:84; x.font="900 "+fs+"px Manrope, 'Arial Black', Impact, sans-serif"; x.strokeText(t,cx+64,cy+84); x.fillText(t,cx+64,cy+84);
    var nf=nm.length>7?19:23; x.font="800 "+nf+"px Manrope, 'Arial Narrow', Impact, sans-serif"; x.lineWidth=3; x.strokeText(nm,cx+64,cy+22); x.fillText(nm,cx+64,cy+22);
    ATL.dirty=true;
  }
  function atlasRedraw(){ V.riders.forEach(function(r){ drawCell(r.k,r.plate,{red:r.red,me:r.me,color:r.hex}); drawOut(r.k,r.plate); drawJersey(r); }); }
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(function(){ if(ATL.x){ atlasRedraw(); } });

  /* ---------- the banners: ORIGINAL Motocross War graphics, drawn in code into an atlas (no logos, no marks of anyone else): the game's own wordmark,
     a red WAR slab, the tagline, gold chevrons; hung as hoardings round the floor wall and as tall banners from the canopy. The infield TOWER shows
     the live lap and race clock (its own small texture, redrawn once a second). ---------- */
  var BAN={c:null,t:null,tw:null,twc:null,twT:-1};
  var BUV={h:[],v:[]};   /* the atlas cells: horizontal (8:1) and vertical (1:2) */
  function bannerInit(){
    BUV.h=[]; BUV.v=[]; var c=document.createElement("canvas"); c.width=1024; c.height=1024; var x=c.getContext("2d"), i;
    var W=1024, HH=128;
    function distress(ctx,w,h,n,seed){ var Rr=rng(seed); ctx.save(); ctx.globalCompositeOperation="destination-out"; for(var q=0;q<n;q++){ var px=Rr()*w, py=Rr()*h, sz=1+Rr()*Rr()*7; ctx.globalAlpha=0.35+Rr()*0.65; ctx.fillRect(px,py,sz*(1+Rr()*2),sz); } ctx.restore(); }
    function word(ctx,txt,px,py,size,fill,edge,skew){
      ctx.save(); ctx.translate(px,py); ctx.transform(1,0,-(skew==null?0.2:skew),1,0,0); ctx.font="italic 900 "+size+"px 'Arial Black', Impact, Manrope, sans-serif"; ctx.textBaseline="middle"; ctx.textAlign="left";
      if(edge){ ctx.lineJoin="round"; ctx.lineWidth=size*0.12; ctx.strokeStyle=edge; ctx.strokeText(txt,0,0); } ctx.fillStyle=fill; ctx.fillText(txt,0,0); ctx.restore(); }
    /* H0: the wordmark on a night panel */
    var g=x.createLinearGradient(0,0,0,HH); g.addColorStop(0,"#121723"); g.addColorStop(1,"#080b12"); x.fillStyle=g; x.fillRect(0,0,W,HH);
    var tc=document.createElement("canvas"); tc.width=W; tc.height=HH; var t=tc.getContext("2d");
    word(t,"MOTOCROSS",34,64,74,"#f4f1ea","#0a0c12",0.22); word(t,"WAR",600,60,104,"#f72d2e","#0a0c12",0.22); distress(t,W,HH,520,11); x.drawImage(tc,0,0);
    x.fillStyle="#f72d2e"; x.fillRect(0,HH-7,W,7); x.fillStyle="#ecb967"; x.fillRect(0,0,W,4);
    /* H1: the red WAR slab with chevrons */
    g=x.createLinearGradient(0,HH,W,HH*2); g.addColorStop(0,"#d51e22"); g.addColorStop(1,"#8f0c10"); x.fillStyle=g; x.fillRect(0,HH,W,HH);
    x.save(); x.beginPath(); x.rect(0,HH,W,HH); x.clip(); x.fillStyle="rgba(255,255,255,.16)"; for(i=-2;i<22;i++){ x.beginPath(); x.moveTo(i*60,HH); x.lineTo(i*60+34,HH+64); x.lineTo(i*60,HH*2); x.lineTo(i*60+22,HH*2); x.lineTo(i*60+56,HH+64); x.lineTo(i*60+22,HH); x.fill(); } x.restore();
    tc=document.createElement("canvas"); tc.width=W; tc.height=HH; t=tc.getContext("2d"); word(t,"WAR",300,66,118,"#fbfaf6","#4a0608",0.2); word(t,"MX",70,66,58,"#fbfaf6",null,0.2); word(t,"MX",780,66,58,"#fbfaf6",null,0.2); distress(t,W,HH,420,23); x.drawImage(tc,0,HH);
    /* H2: the tagline */
    g=x.createLinearGradient(0,HH*2,0,HH*3); g.addColorStop(0,"#0c1019"); g.addColorStop(1,"#05070c"); x.fillStyle=g; x.fillRect(0,HH*2,W,HH);
    tc=document.createElement("canvas"); tc.width=W; tc.height=HH; t=tc.getContext("2d"); word(t,"REAL TRACKS  •  REAL RIDERS  •  REAL RACING",22,64,50,"#ecb967","#06080d",0.18); distress(t,W,HH,300,31); x.drawImage(tc,0,HH*2);
    x.fillStyle="#f72d2e"; x.fillRect(0,HH*3-6,W,6);
    /* H3: black and gold chevrons */
    x.fillStyle="#0b0d13"; x.fillRect(0,HH*3,W,HH); x.fillStyle="#ecb967"; for(i=-2;i<22;i++){ x.beginPath(); x.moveTo(i*60,HH*3); x.lineTo(i*60+30,HH*3); x.lineTo(i*60+66,HH*3+64); x.lineTo(i*60+30,HH*4); x.lineTo(i*60,HH*4); x.lineTo(i*60+36,HH*3+64); x.fill(); }
    x.fillStyle="#f72d2e"; x.fillRect(0,HH*3,W,5); x.fillRect(0,HH*4-5,W,5);
    for(i=0;i<4;i++) BUV.h.push([0,(i*HH)/1024,1,((i+1)*HH)/1024]);
    /* V0..V3: tall banners (256 x 512 each, in the lower half) */
    var VW=256, VH=512, vy=512;
    function vtext(ctx,txt,cx,cy,size,fill,edge){ ctx.save(); ctx.translate(cx,cy); ctx.rotate(-PI/2); ctx.transform(1,0,-0.2,1,0,0); ctx.font="italic 900 "+size+"px 'Arial Black', Impact, Manrope, sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle"; if(edge){ ctx.lineJoin="round"; ctx.lineWidth=size*0.12; ctx.strokeStyle=edge; ctx.strokeText(txt,0,0); } ctx.fillStyle=fill; ctx.fillText(txt,0,0); ctx.restore(); }
    var vc=document.createElement("canvas"); vc.width=VW; vc.height=VH; var v=vc.getContext("2d");
    function vcell(k,paint){ v.clearRect(0,0,VW,VH); paint(v); x.drawImage(vc,k*VW,vy); BUV.v.push([(k*VW)/1024,vy/1024,((k+1)*VW)/1024,(vy+VH)/1024]); }
    vcell(0,function(q){ var gg=q.createLinearGradient(0,0,0,VH); gg.addColorStop(0,"#121723"); gg.addColorStop(1,"#06080d"); q.fillStyle=gg; q.fillRect(0,0,VW,VH); vtext(q,"MOTOCROSS",VW*0.34,VH*0.5,76,"#f4f1ea","#0a0c12"); vtext(q,"WAR",VW*0.72,VH*0.5,124,"#f72d2e","#0a0c12"); distress(q,VW,VH,380,41); q.fillStyle="#f72d2e"; q.fillRect(0,0,8,VH); q.fillRect(VW-8,0,8,VH); });
    vcell(1,function(q){ var gg=q.createLinearGradient(0,0,VW,VH); gg.addColorStop(0,"#d51e22"); gg.addColorStop(1,"#7e090d"); q.fillStyle=gg; q.fillRect(0,0,VW,VH); vtext(q,"WAR",VW*0.5,VH*0.5,210,"#fbfaf6","#4a0608"); distress(q,VW,VH,380,43); });
    vcell(2,function(q){ q.fillStyle="#0b0d13"; q.fillRect(0,0,VW,VH); q.fillStyle="#ecb967"; for(var k=-2;k<12;k++){ q.beginPath(); q.moveTo(0,k*60+60); q.lineTo(VW/2,k*60); q.lineTo(VW,k*60+60); q.lineTo(VW,k*60+96); q.lineTo(VW/2,k*60+36); q.lineTo(0,k*60+96); q.fill(); } });
    vcell(3,function(q){ q.fillStyle="#f4f1ea"; q.fillRect(0,0,VW,VH); q.fillStyle="#f72d2e"; q.fillRect(0,0,VW*0.22,VH); q.fillStyle="#0b0d13"; q.fillRect(VW*0.78,0,VW*0.22,VH); vtext(q,"MX",VW*0.5,VH*0.5,150,"#0b0d13",null); distress(q,VW,VH,260,47); });
    BAN.c=c; BAN.t=R.tex(c,{aniso:4,w:1024,h:1024});
    /* the infield tower's own texture: blue, a lit face with the lap and the race clock */
    BAN.twc=document.createElement("canvas"); BAN.twc.width=256; BAN.twc.height=512; BAN.tw=R.tex(BAN.twc,{mip:false,clamp:true}); towerDraw(true);
  }
  function towerDraw(force){
    if(!BAN.twc) return; var sec=Math.max(0,Math.floor(V.T)); if(!force&&sec===BAN.twT) return; BAN.twT=sec;
    var x=BAN.twc.getContext("2d"), W=256, H=512, g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#1b49d8"); g.addColorStop(0.5,"#102f9e"); g.addColorStop(1,"#0a1c66"); x.fillStyle=g; x.fillRect(0,0,W,H);
    x.fillStyle="rgba(255,255,255,.07)"; for(var i=0;i<H;i+=8) x.fillRect(0,i,W,2);
    x.textAlign="center"; x.textBaseline="middle"; var lap=Math.min(Math.max(1,V.lap||1),V.len||99), mm=Math.floor(sec/60), ss=sec%60;
    x.fillStyle="#9fc0ff"; x.font="800 30px Manrope, 'Arial Narrow', sans-serif"; x.fillText("LAP",W/2,60);
    x.fillStyle="#ffffff"; x.font="900 96px Manrope, 'Arial Black', sans-serif"; x.fillText(String(lap),W/2,140); x.fillStyle="#9fc0ff"; x.font="800 30px Manrope, sans-serif"; x.fillText("OF "+(V.len||"-"),W/2,206);
    x.fillStyle="#ffffff"; x.fillRect(30,250,W-60,3);
    x.fillStyle="#9fc0ff"; x.fillText("RACE TIME",W/2,300); x.fillStyle="#ffe27a"; x.font="900 82px Manrope, 'Arial Black', sans-serif"; x.fillText((mm<10?"0":"")+mm+":"+(ss<10?"0":"")+ss,W/2,380);
    x.fillStyle="#f72d2e"; x.fillRect(0,H-26,W,26); x.fillStyle="#fff"; x.font="900 18px Manrope, sans-serif"; x.fillText("MOTOCROSS WAR",W/2,H-13);
    gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D,BAN.tw); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,BAN.twc); gl.activeTexture(gl.TEXTURE0);
  }
  /* a banner quad (code 9: the atlas coordinates ride in the material's first two numbers); a, b, c, d = the corners bottom-left, bottom-right,
     top-right, top-left seen from the front; inside = a point on the side it faces */
  function bannerQuad(P,a,b,c,d,uv,inside,code){
    var ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=d[0]-a[0], vy=d[1]-a[1], vz=d[2]-a[2], nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
    var mx=(a[0]+c[0])/2, my=(a[1]+c[1])/2, mz=(a[2]+c[2])/2; if(nx*(inside[0]-mx)+ny*(inside[1]-my)+nz*(inside[2]-mz)<0){ nx=-nx; ny=-ny; nz=-nz; }
    var u0=uv[0], v0=uv[1], u1=uv[2], v1=uv[3], s0=P.v, cc=code||9;
    [[a,u0,v1],[b,u1,v1],[c,u1,v0],[d,u0,v0]].forEach(function(q){ P.cm=[q[1],q[2],0,1]; P.vert(q[0][0],q[0][1],q[0][2],nx,ny,nz,1,1,1,cc); });
    P.quad(s0,s0+1,s0+2,s0+3); P.cm=[0.25,0.35,0,1];
  }

  /* ---------- the scene for a course ---------- */
  function sideClear(C,s,side,d){ /* how much room beside the track at s on one side (to the nearest other part of the course) */
    var i=Math.round(s/C.DS)%C.N, nx=-C.tz[i]*side, nz=C.tx[i]*side, px=C.x[i]+nx*d, pz=C.z[i]+nz*d, best=1e9;
    for(var j=0;j<C.N;j+=3){ var along=Math.min(Math.abs(j-i),C.N-Math.abs(j-i))*C.DS; if(along<d*2.2) continue; var q=Math.hypot(C.x[j]-px,C.z[j]-pz)-C.hw[j]; if(q<best) best=q; }
    return best;
  }
  /* split a builder's triangles in two by the colour code of their first vertex (the stands' patterns have their own shader) */
  function splitBy(P,pred){
    var A=new GL.Builder(), B2=new GL.Builder(), mA={}, mB={}, hasQ=P.q.length===P.v*4;
    for(var t=0;t<P.i.length;t+=3){ var i0=P.i[t], inB=pred(Math.round(P.c[i0*4+3])), dst=inB?B2:A, map=inB?mB:mA;
      for(var q=0;q<3;q++){ var v=P.i[t+q], m=map[v];
        if(m==null){ m=map[v]=dst.v; dst.p.push(P.p[v*3],P.p[v*3+1],P.p[v*3+2]); dst.n.push(P.n[v*3],P.n[v*3+1],P.n[v*3+2]); dst.c.push(P.c[v*4],P.c[v*4+1],P.c[v*4+2],P.c[v*4+3]);
          if(hasQ) dst.q.push(P.q[v*4],P.q[v*4+1],P.q[v*4+2],P.q[v*4+3]); else dst.q.push(0.25,0.35,0,1); dst.v++; }
        dst.i.push(m); } }
    return [A,B2];
  }
  function buildScene(C){
    var S={C:C,meshes:[],spots:{},night:true,cols:{}}, sur=C.layout.surroundings||(C.outdoor?"hills-trees":"stadium-open"), Rn=rng(hash(C.id)+C.variant);
    S.sur=sur; S.night=!C.outdoor; S.sandy=C.layout.soil==="sand";
    /* colours of the ground */
    S.cols.dirt=C.outdoor?[0.5,0.36,0.25]:S.sandy?[0.68,0.55,0.4]:[0.38,0.29,0.23]; S.cols.sand=[0.82,0.72,0.53]; S.cols.grass=[0.23,0.36,0.15];
    /* polish 2: every real track its own ground: the soil the researcher found (loam dark, clay red-brown, hard-pack pale, sand) and the
       country round it (the desert's dry brush, farmland's greener grass) */
    if(C.outdoor){ var SOIL={loam:[0.43,0.31,0.21],clay:[0.55,0.34,0.22],hardpack:[0.6,0.49,0.37],sand:[0.7,0.58,0.42]}; if(SOIL[C.layout.soil]) S.cols.dirt=SOIL[C.layout.soil];
      if(sur==="desert") S.cols.grass=[0.44,0.4,0.27]; else if(sur==="farmland") S.cols.grass=[0.25,0.39,0.15]; }
    /* 1. the track strip: 9 columns (foot, 7 across the surface, foot), every 0.5 m on features, coarser on the flat */
    var T=new GL.Builder(), rows=[], ncol=V.q>=2?27:V.q===1?19:13, U=[], i=0, step=C.outdoor?3:2; for(var uc0=0;uc0<ncol;uc0++) U.push(-1+2*uc0/(ncol-1)); var MIDC=(ncol-1)>>1;
    var minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9;
    while(i<C.N){
      rows.push(i);
      var nf=(C.F[i]>0.02||C.F[(i+step)%C.N]>0.02||C.F[(i+1)%C.N]>0.02||Math.abs(C.berm[i])>0.3||(C.camb&&C.camb[i]))?1:step;
      if(i*C.DS<C.startLen+6) nf=Math.min(nf,2);
      i+=nf;
    }
    var nc=U.length+2, vRep=C.L/Math.max(1,Math.round(C.L/7)), W0=(C.layout.widthM||(C.outdoor?10:8.5))/2;
    /* polish 2: the ruts wander slowly across the line over tens of metres (a lateral drift of the texture, periodic over the lap) instead of
       the texture's own short zigzag */
    var wn1=Math.max(1,Math.round(C.L/27)), wn2=Math.max(1,Math.round(C.L/11)), wph=Rn()*TAU;
    function wander(s){ return 0.03*Math.sin(TAU*wn1*s/C.L+wph)+0.012*Math.sin(TAU*wn2*s/C.L+wph*1.7); }
    /* polish 2: the over-under bridges: the rows of the deck over the tunnel get a thin deck edge instead of earth sides (the tunnel lane shows
       through under it) */
    C.bridges.forEach(function(B){ var iu=Math.round(B.su/C.DS)%C.N, io=Math.round(B.so/C.DS)%C.N; B.hwU=C.hw[iu]; B.span=Math.min(B.half-7.6,(B.hwU+0.45+(C.hw[io]+0.3)*B.cosA)/B.sinA+0.3); });
    function deckAt(s){ for(var b=0;b<C.bridges.length;b++){ var B=C.bridges[b], d=Math.abs(s-B.so); d=Math.min(d,C.L-d); if(d<B.span) return B; } return null; }
    rows.forEach(function(ii){
      var s=ii*C.DS, cx=C.x[ii], cz=C.z[ii], nx=-C.tz[ii], nz=C.tx[ii], hw=C.hw[ii], off=C.off[ii], E=C.E[ii];
      var ys=U.map(function(u){ return TK.ground(C,s,u*hw); });
      var lineU=C.rutU?C.rutU[ii]:0, rutD0=C.rutD?C.rutD[ii]:0, sand=C.sand[ii], hiF=C.F[ii], dk=C.bridges.length?deckAt(s):null, wu=wander(s);
      /* polish: cavity light: a crest or a lip above its surroundings lighter, a trough or the foot of a landing darker (the whoops and the
         jumps read at a glance, even under flat light) */
      var avg=0; for(var q=-5;q<=5;q++) avg+=C.F[(ii+q+C.N)%C.N]; avg/=11; var cav=clamp(1+(hiF-avg)*0.34,0.72,1.14);
      for(var c=0;c<nc;c++){
        var u, lat, y, tint=1, groove=0;
        if(c===0||c===nc-1){ var e=c===0?0:U.length-1, he=ys[e]-E; lat=off+(c===0?-1:1)*(hw+0.35+Math.max(0,he)*0.95); y=E-0.06; u=c===0?-1.25:1.25; tint=0.66*(0.5+0.5*cav);
          if(dk){ lat=off+(c===0?-1:1)*(hw+0.3); y=ys[e]-0.55; tint=0.5; } }
        else { u=U[c-1]; lat=off+u*hw; y=ys[c-1]; var gdu=(u-lineU)*hw/0.5; groove=clamp(Math.exp(-gdu*gdu)*(0.35+rutD0*7),0,1); tint=(1+0.06*Math.max(0,(ys[c-1]-ys[MIDC])))*cav*(0.94+0.06*Math.cos(u*1.4)); if(hiF>0.3) tint*=0.95;
          /* polish 2: the start funnel's extra width sits a few cm low, so where it overlaps another part of the lap (the built-in stadium's last
             turn) that lane wins instead of the two fighting in the depth buffer (dark jagged streaks in the gate shot) */
          if(s<C.startLen+1){ var ext=Math.abs(lat)-(W0+0.4); if(ext>0) y-=Math.min(0.05,ext*0.03); } }
        var px=cx+nx*lat, pz=cz+nz*lat;
        minx=Math.min(minx,px); maxx=Math.max(maxx,px); minz=Math.min(minz,pz); maxz=Math.max(maxz,pz);
        T.vert(px,y,pz,0,1,0,1,1,1,0,(u+1.25)/2.5+wu,s/vRep,0,groove,tint,sand);
      }
    });
    var nr=rows.length, r, c2;
    for(r=0;r<nr;r++){ var a=r*nc, b=((r+1)%nr)*nc; for(c2=0;c2<nc-1;c2++) T.quad(a+c2,b+c2,b+c2+1,a+c2+1); }
    /* the last row wraps to the first: its v coordinate continues past the lap */
    gridNormals(T,nr,nc);
    /* polish 2: the start chute (the real Supercross layouts: the start straight from the gate to where it joins the lap), merged into the
       track's mesh: no extra draw call */
    if(C.Lc){ var Tc=new GL.Builder(), cidx=[];
      for(var ci=0;ci<C.Nc;ci+=2) cidx.push(ci); cidx.push(C.Nc);
      cidx.forEach(function(ci){ var Dc=-C.Lc+ci*C.DS, ccx=C.cx[ci], ccz=C.cz[ci], cnx=-C.ctz[ci], cnz=C.ctx[ci], chw=C.chw[ci], coff=C.coff[ci], cE=C.cE-0.035;   /* (under the lap's strip where they overlap at the join) */
        for(var c3=0;c3<nc;c3++){ var u3, lat3, y3, tint3;
          if(c3===0||c3===nc-1){ lat3=coff+(c3===0?-1:1)*(chw+0.35); y3=cE-0.06; u3=c3===0?-1.25:1.25; tint3=0.66; }
          else { u3=U[c3-1]; lat3=coff+u3*chw; y3=cE; tint3=0.97+0.03*Math.cos(u3*1.4); }
          var px3=ccx+cnx*lat3, pz3=ccz+cnz*lat3;
          minx=Math.min(minx,px3); maxx=Math.max(maxx,px3); minz=Math.min(minz,pz3); maxz=Math.max(maxz,pz3);
          Tc.vert(px3,y3,pz3,0,1,0,1,1,1,0,(u3+1.25)/2.5,Dc/vRep,0,0,tint3,0); } });
      var crow=cidx.length;
      for(r=0;r<crow-1;r++){ var a3=r*nc, b3=(r+1)*nc; for(c2=0;c2<nc-1;c2++) Tc.quad(a3+c2,b3+c2,b3+c2+1,a3+c2+1); }
      gridNormals(Tc,crow,nc,true); mergeB(T,Tc); }
    S.track=R.mesh(T,"dirt");
    S.box={x0:minx,x1:maxx,z0:minz,z1:maxz};
    /* the infield tower: the clear spot nearest the middle of the course (at least 14 m from every lane), facing the start straight */
    if(!C.outdoor&&sur!=="beach-speedway"){ var bcx0=(minx+maxx)/2, bcz0=(minz+maxz)/2, bestT=null;
      for(var gz=-45;gz<=45;gz+=7.5) for(var gx=-60;gx<=60;gx+=7.5){ var px0=bcx0+gx, pz0=bcz0+gz, dmin=1e9; for(var q0=0;q0<C.N;q0+=4){ var dd0=Math.hypot(C.x[q0]-px0,C.z[q0]-pz0)-C.hw[q0]; if(dd0<dmin) dmin=dd0; }
        if(C.Lc) for(q0=0;q0<=C.Nc;q0+=4){ var dd1=Math.hypot(C.cx[q0]-px0,C.cz[q0]-pz0)-C.chw[q0]; if(dd1<dmin) dmin=dd1; }
        var sc0=Math.min(dmin,22)-Math.hypot(gx,gz)*0.08; if(dmin>=14&&(!bestT||sc0>bestT.sc)) bestT={x:px0,z:pz0,sc:sc0}; }
      if(bestT) S.towerSpot={x:bestT.x,z:bestT.z,yaw:Math.atan2(C.z[0]-bestT.z,C.x[0]-bestT.x)}; }
    /* 2. the floor / the land */
    var F=new GL.Builder(), mar=C.outdoor?260:14;
    if(!C.outdoor){
      var fx0=minx-mar, fx1=maxx+mar, fz0=minz-mar, fz1=maxz+mar; S.floor={x0:fx0,x1:fx1,z0:fz0,z1:fz1};
      var gx=12, gz=8, beach=sur==="beach-speedway";
      if(beach){ /* polish: the speedway infield is grass with the dirt only round the course (a fine flat grid, the grass blended in by the
                    distance to the track) instead of a hard-edged dirt rectangle */
        gx=Math.ceil((fx1-fx0)/6); gz=Math.ceil((fz1-fz0)/6); var sx2=[], sz2=[], sw2=[];
        for(var ti=0;ti<C.N;ti+=6){ sx2.push(C.x[ti]); sz2.push(C.z[ti]); sw2.push(C.hw[ti]+Math.abs(C.off[ti])); } }
      for(var zi=0;zi<=gz;zi++) for(var xi=0;xi<=gx;xi++){ var X=lerp(fx0,fx1,xi/gx), Z=lerp(fz0,fz1,zi/gz), gr=0;
        if(beach){ var bd=1e9, bi2=0; for(var k2=0;k2<sx2.length;k2++){ var dd2=(sx2[k2]-X)*(sx2[k2]-X)+(sz2[k2]-Z)*(sz2[k2]-Z); if(dd2<bd){ bd=dd2; bi2=k2; } } gr=sstep((Math.sqrt(bd)-sw2[bi2]-2.5)/6); }
        F.vert(X,-0.07,Z,0,1,0,1,1,1,0,X/9,Z/9,gr,0,0.8+0.14*gr,S.sandy?0.35*(1-gr):0); }   /* (7 cm under the track: no depth fight) */
      for(zi=0;zi<gz;zi++) for(xi=0;xi<gx;xi++){ var q=zi*(gx+1)+xi; F.quad(q,q+gx+1,q+gx+2,q+1); }
      if(sur==="beach-speedway"){ /* the infield grass beyond the dirt floor */
        var big=420, o0=F.v; [[-big,-big],[big,-big],[big,big],[-big,big]].forEach(function(p){ F.vert(p[0],-0.18,p[1],0,1,0,1,1,1,0,p[0]/9,p[1]/9,1,0,0.9,0); }); F.quad(o0,o0+3,o0+2,o0+1);
      }
    } else {
      S.pitSpots=pitSpots(C);
      S.land=landHeights(C,minx-mar,maxx+mar,minz-mar,maxz+mar,Rn,S.pitSpots);
      var L=S.land;
      for(var zz=0;zz<=L.nz;zz++) for(var xx=0;xx<=L.nx;xx++){ var hv=L.h[zz*(L.nx+1)+xx], gr=L.g[zz*(L.nx+1)+xx]; F.vert(L.x0+xx*L.cs,hv,L.z0+zz*L.cs,0,1,0,1,1,1,0,(L.x0+xx*L.cs)/9,(L.z0+zz*L.cs)/9,gr,0,0.85+0.15*gr,0); }
      for(zz=0;zz<L.nz;zz++) for(xx=0;xx<L.nx;xx++){ var q2=zz*(L.nx+1)+xx; F.quad(q2,q2+L.nx+1,q2+L.nx+2,q2+1); }
      gridNormals(F,L.nz+1,L.nx+1,true);
    }
    S.floorMesh=R.mesh(F,"dirt");
    S.centre=[(S.box.x0+S.box.x1)/2,C.outdoor?10:0,(S.box.z0+S.box.z1)/2]; S.radius=Math.max(S.box.x1-S.box.x0,S.box.z1-S.box.z0)*0.62; grandSpot(C,S);
    /* 3. the static props (one lit mesh): tuff blocks / track stakes, the finish line, its arch, the flag stand, the gate posts, the venue */
    var P=new GL.Builder();
    edges(C,P,Rn,S);
    finish(C,P,S);
    gateStatic(C,P,S);
    if(C.outdoor) outdoorSet(C,P,Rn,S); else if(sur==="beach-speedway") speedwaySet(C,P,Rn,S); else stadiumSet(C,P,Rn,S);
    var sp=splitBy(P,function(code){ return code===4||code===5||code===7||code===8||code===9||code===10; });
    S.props=R.mesh(sp[0],"lit"); S.stands=sp[1].v?R.mesh(sp[1],"lit"):null;
    var ev=S.banks&&S.banks.length?S.banks:(S.lights||[]), pick=[]; for(var li=0;li<4&&ev.length;li++) pick.push(ev[Math.floor(li*ev.length/4)]); S.envLights=pick;
    /* 4. the gate (it falls toward the riders when it drops) */
    S.gateMesh=R.mesh(gateMesh(C),"lit");
    /* 5. camera spots */
    spots(C,S);
    return S;
  }
  /* append builder Bb to A (positions, normals, colours, uv, material, indices) */
  function mergeB(A,Bb){ A.add(Bb); }
  /* polish 2: the gate's frame: the start of the chute on a real Supercross layout, else the lap's start */
  function gateF(C){ if(C.Lc) return {x:C.cx[0],z:C.cz[0],tx:C.ctx[0],tz:C.ctz[0],hw:C.chw[0],off:C.coff[0],E:C.cE}; return {x:C.x[0],z:C.z[0],tx:C.tx[0],tz:C.tz[0],hw:C.hw[0],off:C.off[0],E:C.E[0]}; }
  function chuteI(C,D){ return clamp(Math.round((D+C.Lc)/C.DS),0,C.Nc); }
  function hwAtD(D){ var C=V.C; if(D<0&&C.Lc) return C.chw[chuteI(C,D)]; return C.hw[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]; }
  function offAtD(D){ var C=V.C; if(D<0&&C.Lc) return C.coff[chuteI(C,D)]; return C.off[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]; }
  /* how far a point is from the lap's strip (the chute's tuff blocks and the gate camera keep clear of the lanes) */
  function lapClear(C,px,pz){ var best=1e9; for(var j=0;j<C.N;j+=3){ var s=j*C.DS; if(s<6||s>C.L-3) continue; var q=Math.hypot(C.x[j]-px,C.z[j]-pz)-C.hw[j]; if(q<best) best=q; } return best; }
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
  function landHeights(C,x0,x1,z0,z1,Rn,flat){
    var cs=C.L>1500?9:7, nx=Math.ceil((x1-x0)/cs), nz=Math.ceil((z1-z0)/cs), h=new Float32Array((nx+1)*(nz+1)), gr=new Float32Array((nx+1)*(nz+1));
    var sx=[], sz=[], se=[], sw=[];
    for(var i=0;i<C.N;i+=4){ sx.push(C.x[i]); sz.push(C.z[i]); se.push(C.E[i]); sw.push(C.hw[i]+Math.abs(C.off[i])); }
    if(C.Lc) for(i=0;i<=C.Nc;i+=4){ sx.push(C.cx[i]); sz.push(C.cz[i]); se.push(C.cE); sw.push(C.chw[i]+Math.abs(C.coff[i])); }
    (flat||[]).forEach(function(p){ for(var q=-1;q<=1;q++){ sx.push(p.x+p.cx*q*7); sz.push(p.z+p.cz*q*7); se.push(p.e); sw.push(6); } });   /* the pits stand on level ground */
    var ph1=Rn()*TAU, ph2=Rn()*TAU, cx=(x0+x1)/2, cz=(z0+z1)/2, rad=Math.max(x1-x0,z1-z0)/2;
    for(var zi=0;zi<=nz;zi++) for(var xi=0;xi<=nx;xi++){
      var X=x0+xi*cs, Z=z0+zi*cs, best=1e9, bi=0;
      for(var k=0;k<sx.length;k++){ var d=(sx[k]-X)*(sx[k]-X)+(sz[k]-Z)*(sz[k]-Z); if(d<best){ best=d; bi=k; } }
      var dist=Math.sqrt(best)-sw[bi], base=se[bi]-0.25;
      var hill=Math.sin(X*0.011+ph1)*Math.cos(Z*0.009+ph2)*7+Math.sin(X*0.023+Z*0.017)*3, rim=Math.pow(Math.max(0,Math.hypot(X-cx,Z-cz)/rad-0.55),2)*24;   /* (polish 2: a lower bowl: the ridgelines make the horizon now) */
      var w=sstep((dist-3)/45);
      h[zi*(nx+1)+xi]=lerp(base,base*0.6+hill+rim,w);
      gr[zi*(nx+1)+xi]=sstep((dist-2)/7);
    }
    return {x0:x0,z0:z0,cs:cs,nx:nx,nz:nz,h:h,g:gr};
  }
  function landAt(S,X,Z){ var L=S.land; if(!L) return 0; var fx=clamp((X-L.x0)/L.cs,0,L.nx-0.001), fz=clamp((Z-L.z0)/L.cs,0,L.nz-0.001), ix=Math.floor(fx), iz=Math.floor(fz), tx=fx-ix, tz=fz-iz, W=L.nx+1;
    return lerp(lerp(L.h[iz*W+ix],L.h[iz*W+ix+1],tx),lerp(L.h[(iz+1)*W+ix],L.h[(iz+1)*W+ix+1],tx),tz); }
  /* the gate camera's spot: beside the gate on the free side */
  /* polish 2: the gate camera beside the gate, clear of the lanes and never behind the finish line's arch or the flag stand (on the real
     layouts the finish line is often right beside the gate: the camera stood behind the stand) */
  function gateSpot(C){
    if(C._gs) return C._gs;
    var G=gateF(C), best=null, fi=Math.round(C.sFin/C.DS)%C.N, fo=C.off[fi], fh2=C.hw[fi], obs=[];
    [fo+fh2+1.4,fo-fh2-1.4,fo+fh2+3.2].forEach(function(l){ obs.push([C.x[fi]-C.tz[fi]*l,C.z[fi]+C.tx[fi]*l]); });
    var gcx=G.x-G.tz*G.off, gcz=G.z+G.tx*G.off;
    function segD(px,pz,ax,az,bx,bz){ var vx=bx-ax, vz=bz-az, t=clamp(((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz||1),0,1); return Math.hypot(ax+vx*t-px,az+vz*t-pz); }
    [C.fside,-C.fside].forEach(function(sd,si){ [9,12.5,16].forEach(function(lw){ [6,2.5,10].forEach(function(ah){
      var gl0=G.off+sd*(G.hw+lw), X=G.x-G.tz*gl0+G.tx*ah, Z=G.z+G.tx*gl0+G.tz*ah, sc=C.Lc?Math.min(8,lapClear(C,X,Z)):(si===0?8:2);
      if(occluded(C,X,Z,0,gcx,gcz)) sc-=6;
      obs.forEach(function(o){ var dd=Math.hypot(o[0]-X,o[1]-Z); if(dd<5) sc-=20; if(segD(o[0],o[1],X,Z,gcx,gcz)<1.8) sc-=30; });
      sc-=(lw-9)*0.15+Math.abs(ah-6)*0.05;
      if(!best||sc>best.sc) best={x:X,y:G.E+3.1,z:Z,sc:sc}; }); }); });
    return (C._gs=best); }
  /* a face whose normal points away from (cx, cy, cz) (props built from corner lists, lit correctly whatever the order) */
  function faceOut(P,pts,col,cx,cy,cz){
    var a=pts[0], b=pts[1], d=pts[3], ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=d[0]-a[0], vy=d[1]-a[1], vz=d[2]-a[2];
    var nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, mx=(a[0]+b[0]+pts[2][0]+d[0])/4-cx, my=(a[1]+b[1]+pts[2][1]+d[1])/4-cy, mz=(a[2]+b[2]+pts[2][2]+d[2])/4-cz;
    P.face(nx*mx+ny*my+nz*mz<0?[pts[3],pts[2],pts[1],pts[0]]:pts,col);
  }
  /* a tuff block (polish): 1.2 x 0.42 x 0.56 m with its top edges chamfered, so the light rolls over it instead of a hard white box */
  function tuff(P,col,top){
    P.mat(0.6,0.55,0.15,1);
    var x0=-0.6, x1=0.6, z0=-0.28, z1=0.28, h=0.42, b=0.075, m=h-b;
    faceOut(P,[[x0,0,z0],[x1,0,z0],[x1,m,z0],[x0,m,z0]],col,0,0.2,0); faceOut(P,[[x0,0,z1],[x1,0,z1],[x1,m,z1],[x0,m,z1]],col,0,0.2,0);
    faceOut(P,[[x0,0,z0],[x0,0,z1],[x0,m,z1],[x0,m,z0]],col,0,0.2,0); faceOut(P,[[x1,0,z0],[x1,0,z1],[x1,m,z1],[x1,m,z0]],col,0,0.2,0);
    faceOut(P,[[x0,m,z0],[x1,m,z0],[x1-b,h,z0+b],[x0+b,h,z0+b]],top,0,0.2,0); faceOut(P,[[x0,m,z1],[x1,m,z1],[x1-b,h,z1-b],[x0+b,h,z1-b]],top,0,0.2,0);
    faceOut(P,[[x0,m,z0],[x0,m,z1],[x0+b,h,z1-b],[x0+b,h,z0+b]],top,0,0.2,0); faceOut(P,[[x1,m,z0],[x1,m,z1],[x1-b,h,z1-b],[x1-b,h,z0+b]],top,0,0.2,0);
    faceOut(P,[[x0+b,h,z0+b],[x1-b,h,z0+b],[x1-b,h,z1-b],[x0+b,h,z1-b]],top,0,0.2,0);
    P.mat(0.25,0.35,0,1);
  }
  /* tuff blocks (stadium) or stakes with a tape line between them (outdoors) along both edges, outside the jump sides; outdoors, straw bales
     beside the jump faces and the landings */
  function edges(C,P,Rn,S){
    var stepM=C.outdoor?7:1.3, s, side, GS=gateSpot(C), M12=new Float32Array(12), last=null, cnt=0;
    /* one tuff block (stadium) or stake (outdoors); polish 2: never two blocks overlapping on the inside of a bend (they z-fought) */
    function put(px,pz,y,yaw,idx){
      if(!C.outdoor&&last&&Math.hypot(px-last[0],pz-last[1])<1.12) return false;
      var v0=P.v;
      if(C.outdoor) P.box(-0.05,0,-0.05,0.05,1.1,0.05,(idx%2)?[0.9,0.9,0.88,0]:[0.95,0.45,0.15,0]);
      else { var cc=idx%6, TC=[[0.66,0.66,0.64],[0.78,0.58,0.1],[0.66,0.66,0.64],[0.6,0.1,0.1],[0.66,0.66,0.64],[0.1,0.2,0.5]][cc]; tuff(P,[TC[0],TC[1],TC[2],0],[TC[0]*1.08,TC[1]*1.08,TC[2]*1.08,0]); }
      P.xform(v0,GL.local(M12,px,y,pz,0,yaw,0,1)); last=[px,pz]; return true;
    }
    for(side=-1;side<=1;side+=2){
      var prev=null; last=null;
      for(s=C.startLen*0.9;s<C.L;s+=stepM){
        var i=Math.round(s/C.DS)%C.N, hw=C.hw[i], off=C.off[i], hv=TK.ground(C,s,side*hw)-C.E[i], lat=off+side*(hw+0.75+Math.max(0,hv)*0.95);
        if(sideClear(C,s,side,Math.abs(lat)+0.6)<0.6){ prev=null; continue; }
        if(Math.hypot(C.x[i]-C.tz[i]*lat-GS.x,C.z[i]+C.tx[i]*lat-GS.z)<9){ prev=null; continue; }
        var px=C.x[i]-C.tz[i]*lat, pz=C.z[i]+C.tx[i]*lat, y=C.outdoor?C.E[i]-0.2:0;
        if(!put(px,pz,y,-Math.atan2(C.tz[i],C.tx[i]),Math.floor(s/stepM))) continue;
        /* the tape between two stakes (world coordinates: added after the stake's own transform) */
        if(C.outdoor){ if(prev&&Math.hypot(px-prev[0],pz-prev[2])<stepM*1.6) P.face([[prev[0],prev[1]+0.82,prev[2]],[px,y+0.82,pz],[px,y+0.9,pz],[prev[0],prev[1]+0.9,prev[2]]],[0.94,0.93,0.9,0]); prev=[px,y,pz]; }   /* one quad: back faces are drawn */
      }
    }
    /* polish 2: both sides of the start chute (clear of the lanes it runs beside) */
    if(C.Lc) for(side=-1;side<=1;side+=2){ last=null; cnt=0;
      for(var Dc=-C.Lc+1;Dc<-1;Dc+=stepM){ var ci=chuteI(C,Dc), lc=C.coff[ci]+side*(C.chw[ci]+0.75), qx=C.cx[ci]-C.ctz[ci]*lc, qz=C.cz[ci]+C.ctx[ci]*lc;
        if(lapClear(C,qx,qz)<0.8||Math.hypot(qx-GS.x,qz-GS.z)<7) continue;
        put(qx,qz,C.outdoor?C.cE-0.2:0,-Math.atan2(C.ctz[ci],C.ctx[ci]),cnt++); } }
    bridgeProps(C,P);
    if(!C.outdoor) return;
    C.feats.forEach(function(F){ if(!F.vj) return;
      [F.lip-1.5,F.tgt+1].forEach(function(sb,bi){ for(var sd=-1;sd<=1;sd+=2){ var i2=((Math.round(sb/C.DS))%C.N+C.N)%C.N, l2=C.off[i2]+sd*(C.hw[i2]+1.6+bi*0.4);
        if(sideClear(C,sb,sd,Math.abs(l2)+0.8)<1) continue;
        var bx=C.x[i2]-C.tz[i2]*l2, bz=C.z[i2]+C.tx[i2]*l2, by=Math.max(C.E[i2]-0.15,landAt(S,bx,bz)-0.05), v1=P.v;
        P.box(-0.55,0,-0.25,0.55,0.46,0.25,[0.78,0.66,0.38,0]); P.box(-0.5,0.46,-0.24,0.5,0.9,0.24,[0.74,0.62,0.35,0]);
        P.xform(v1,GL.local(M12,bx,by,bz,0,-Math.atan2(C.tz[i2],C.tx[i2])+(Rn()-0.5)*0.3,0,1)); } }); });
  }
  /* polish 2: the over-under bridge's structure: the tunnel's two concrete walls and its dark ceiling under the deck, steel fascia beams along
     the deck's edges over the opening */
  function bridgeProps(C,P){
    C.bridges.forEach(function(B){
      var io=Math.round(B.so/C.DS)%C.N, iu=Math.round(B.su/C.DS)%C.N, top=C.E[io]+C.F[io], under=top-0.55, Eu=C.E[iu], hwO=C.hw[io], hwU=B.hwU||C.hw[iu];
      if(under-Eu<1.6) return;
      var steel=[0.3,0.31,0.34,0], dark=[0.07,0.07,0.08,0], conc=[0.45,0.44,0.43,0];
      function at(s,lat,y){ var f=((s%C.L)+C.L)%C.L/C.DS, i=Math.floor(f)%C.N, j=(i+1)%C.N, t=f-Math.floor(f), l=lat+lerp(C.off[i],C.off[j],t), tx=lerp(C.tx[i],C.tx[j],t), tz=lerp(C.tz[i],C.tz[j],t);
        return [lerp(C.x[i],C.x[j],t)-tz*l,y,lerp(C.z[i],C.z[j],t)+tx*l]; }
      /* the tunnel exactly under the deck: where the tunnel lane's two edges meet the deck's two edges (the lanes taken straight at the
         crossing); the walls along the tunnel lane between those corners, the dark ceiling over the parallelogram they make (a rectangle
         stuck out beyond the deck on a slanted crossing) */
      var du=[C.tx[iu],C.tz[iu]], nu=[-C.tz[iu],C.tx[iu]], dO=[C.tx[io],C.tz[io]], nO=[-C.tz[io],C.tx[io]], X0=[B.x,B.z];
      function corner(eu,eo){ var rx=nO[0]*eo-nu[0]*eu, rz=nO[1]*eo-nu[1]*eu, det=du[0]*(-dO[1])-du[1]*(-dO[0]); if(Math.abs(det)<1e-6) return null;
        var t=(rx*(-dO[1])-rz*(-dO[0]))/det; return [X0[0]+nu[0]*eu+du[0]*t,X0[1]+nu[1]*eu+du[1]*t]; }
      var eU=hwU+0.45, eO=hwO+0.3, cs=[corner(-eU,-eO),corner(-eU,eO),corner(eU,eO),corner(eU,-eO)];
      if(cs.some(function(p){ return !p||Math.hypot(p[0]-X0[0],p[1]-X0[1])>30; })) return;
      [[cs[0],cs[1]],[cs[3],cs[2]]].forEach(function(w){ P.beam([w[0][0],(Eu+under)/2,w[0][1]],[w[1][0],(Eu+under)/2,w[1][1]],0.4,under-Eu+0.1,conc); });
      var cy=under-0.03, q4=cs.map(function(p){ return [p[0],cy,p[1]]; }); P.face(q4,dark); P.face([q4[3],q4[2],q4[1],q4[0]],dark);
      for(var sd=-1;sd<=1;sd+=2) P.beam(at(B.so-B.span,sd*(hwO+0.32),top-0.3),at(B.so+B.span,sd*(hwO+0.32),top-0.3),0.22,0.62,steel);
    });
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
    var G=gateF(C), hw=G.hw, off=G.off, nx=-G.tz, nz=G.tx, gx=G.x+G.tx*1.0, gz=G.z+G.tz*1.0;
    /* polish 2: a post never stands on another part of the lap (a wide funnel can reach a neighbouring turn), and the base bar lies flush in
       the dirt (the lap rides over it on every lap where the start straight is part of the lap) */
    [off-hw-0.3,off+hw+0.3].forEach(function(l){ var X=gx+nx*l, Z=gz+nz*l; if(lapClear(C,X,Z)<0.4) return; P.beam([X,G.E-0.1,Z],[X,G.E+0.9,Z],0.16,0.16,[0.35,0.36,0.4,0]); });
    var A=[gx+nx*(off-hw-0.3),G.E+0.012,gz+nz*(off-hw-0.3)], B2=[gx+nx*(off+hw+0.3),G.E+0.012,gz+nz*(off+hw+0.3)];
    P.beam(A,B2,0.18,0.03,[0.3,0.3,0.33,0]);
  }
  function gateMesh(C){ /* in the gate's own frame: X along the track, Z across, pivot on the ground */
    var B=new GL.Builder(), hw=gateF(C).hw, n=Math.max(6,Math.floor(hw*2/1.0)), w=hw*2/n;
    for(var k=0;k<n;k++){ var z0=-hw+k*w+0.04, z1=z0+w-0.08; B.box(-0.03,0.02,z0,0.03,0.56,z1,[0.62,0.63,0.67,0]); B.box(-0.04,0.42,z0,0.04,0.52,z1,[0.85,0.2,0.16,0]); }
    return B;
  }
  /* the stadium (polish): the floor wall with an LED ribbon; the lower bowl; the club fascia (a second LED ribbon) and the lit suites; the
     upper deck; the roof canopy round the rim (steel trusses, its fascia, the light banks under its edge, glowing); two big boards over the
     ends; the open night sky above (stars) */
  function band(P,path,d,y0,y1,col){ for(var k=0;k<path.length;k++){ var a=path[k], b=path[(k+1)%path.length];
    P.face([[a[0]+a[2]*d,y0,a[1]+a[3]*d],[b[0]+b[2]*d,y0,b[1]+b[3]*d],[b[0]+b[2]*d,y1,b[1]+b[3]*d],[a[0]+a[2]*d,y1,a[1]+a[3]*d]],col); } }
  function stadiumSet(C,P,Rn,S){
    var f=S.floor, x0=f.x0-1, x1=f.x1+1, z0=f.z0-1, z1=f.z1+1, rc=16, k;
    var path=roundRect(x0,z0,x1,z1,rc,84), M12=new Float32Array(12);
    wallRing(P,path,1.8,[0.13,0.13,0.16,0],[0.85,0.85,0.83,0]);
    /* the floor wall's hoardings: each segment either an LED panel or one of the four banner designs (original art) */
    for(k=0;k<path.length;k++){ var ha=path[k], hb=path[(k+1)%path.length], hh=hash("h"+k+C.id)%11, d0=-0.06, ins=[(x0+x1)/2,1,(z0+z1)/2];
      var A0=[ha[0]+ha[2]*d0,0.4,ha[1]+ha[3]*d0], B0=[hb[0]+hb[2]*d0,0.4,hb[1]+hb[3]*d0], B1=[hb[0]+hb[2]*d0,1.48,hb[1]+hb[3]*d0], A1=[ha[0]+ha[2]*d0,1.48,ha[1]+ha[3]*d0];
      if(hh<4) P.face([A0,B0,B1,A1],[1,1,1,5]); else bannerQuad(P,A0,B0,B1,A1,BUV.h[hh%4],ins); }
    tiers(P,path,Rn,0.6,1.8,26,0.9,0.46,1);
    band(P,path,24.0,13.76,15.4,[0.09,0.09,0.11,0]); band(P,path,23.96,13.95,15.2,[1,1,1,5]);
    band(P,path,24.6,15.4,18.4,[1,1,1,7]);
    for(k=0;k<path.length;k+=2){ var pa=path[k], pb=path[(k+1)%path.length]; P.beam([pa[0]+pa[2]*24.55,15.4,pa[1]+pa[3]*24.55],[pa[0]+pa[2]*24.55,18.4,pa[1]+pa[3]*24.55],0.35,0.35,[0.08,0.08,0.1,0]); }
    tiers(P,path,Rn,24.6,18.4,20,0.85,0.62,0.85);
    /* the canopy: a back wall over the top row, the roof out over the upper deck, its fascia, the trusses under it */
    band(P,path,41.6,30.8,35.2,[0.1,0.1,0.12,0]);
    for(k=0;k<path.length;k++){ var a=path[k], b=path[(k+1)%path.length];
      P.face([[b[0]+b[2]*41.6,35.2,b[1]+b[3]*41.6],[a[0]+a[2]*41.6,35.2,a[1]+a[3]*41.6],[a[0]+a[2]*28,37,a[1]+a[3]*28],[b[0]+b[2]*28,37,b[1]+b[3]*28]],[0.12,0.12,0.14,6]); }
    band(P,path,27.95,36.1,37.6,[0.16,0.16,0.19,6]);
    for(k=0;k<path.length;k+=4){ var q=path[k]; P.beam([q[0]+q[2]*41.4,33.9,q[1]+q[3]*41.4],[q[0]+q[2]*28.4,36.2,q[1]+q[3]*28.4],0.45,0.7,[0.2,0.2,0.23,6]); }
    S.lights=[]; S.banks=[];
    /* the floodlight banks: a dark frame with a 5 x 3 grid of hot bulbs, hung under the canopy's edge and facing the floor; each bank also
       gets a glow (the star-burst flare) */
    var nbk=Math.max(10,Math.round(path.length/8)), stp=Math.max(1,Math.round(path.length/nbk));
    for(k=2;k<path.length;k+=stp){ var t=path[k], nx=t[2], nz=t[3], tx=-nz, tz=nx, cxx=t[0]+nx*29.2, czz=t[1]+nz*29.2, hy=35.4;
      P.beam([cxx-tx*2.8,hy,czz-tz*2.8],[cxx+tx*2.8,hy,czz+tz*2.8],0.5,3.0,[0.07,0.07,0.08,6]);
      for(var bi=-2;bi<=2;bi++) for(var bj=-1;bj<=1;bj++){ var bx=cxx-nx*0.45+tx*bi*1.0, bz=czz-nz*0.45+tz*bi*1.0, by=hy+bj*0.85;
        P.box(bx-0.34,by-0.3,bz-0.34,bx+0.34,by+0.3,bz+0.34,[2.7,2.6,2.3,2]); }
      S.lights.push([cxx-nx*1.2,hy,czz-nz*1.2,6.0]); S.banks.push([cxx-nx*1.2,hy,czz-nz*1.2]); }
    /* tall banners hung from the canopy's edge, and the infield tower (the live lap and race clock) */
    for(k=5;k<path.length;k+=Math.max(2,Math.round(path.length/16))){ var tb=path[k], bnx=tb[2], bnz=tb[3], btx=-bnz, btz=bnx, bcx=tb[0]+bnx*28.4, bcz=tb[1]+bnz*28.4, bw=1.7, ct=[(x0+x1)/2,20,(z0+z1)/2];
      if(S.grand&&Math.hypot(bcx-S.grand.eye[0],bcz-S.grand.eye[2])<62) continue;
      bannerQuad(P,[bcx-btx*bw,23,bcz-btz*bw],[bcx+btx*bw,23,bcz+btz*bw],[bcx+btx*bw,35.6,bcz+btz*bw],[bcx-btx*bw,35.6,bcz-btz*bw],BUV.v[(k*7+hash(C.id))%4],ct); }
    if(S.towerSpot){ var tw=S.towerSpot, tcx=tw.x, tcz=tw.z, tyaw=tw.yaw, tcc=Math.cos(tyaw), tss=Math.sin(tyaw), ts=2.2, th0=0.0, th1=11.5;
      P.box(tcx-ts-0.3,th0,tcz-ts-0.3,tcx+ts+0.3,0.6,tcz+ts+0.3,[0.08,0.08,0.1,0]);
      [[0,-1],[1,0],[0,1],[-1,0]].forEach(function(nn2){ var fx2=tcx+nn2[0]*ts, fz2=tcz+nn2[1]*ts, rx2=nn2[1], rz2=-nn2[0];
        bannerQuad(P,[fx2-rx2*ts,th0+0.6,fz2-rz2*ts],[fx2+rx2*ts,th0+0.6,fz2+rz2*ts],[fx2+rx2*ts,th1,fz2+rz2*ts],[fx2-rx2*ts,th1,fz2-rz2*ts],[0,0,1,1],[fx2+nn2[0]*6,5,fz2+nn2[1]*6],10); });
      P.box(tcx-ts-0.2,th1,tcz-ts-0.2,tcx+ts+0.2,th1+0.5,tcz+ts+0.2,[0.07,0.07,0.09,0]); S.lights.push([tcx,th1+1.2,tcz,3.4]); }
    /* a lit strip along the canopy's lower edge */
    band(P,path,27.9,35.95,36.1,[1.5,1.35,1.1,2]);
    /* the skyline beyond the stands: dark towers with lit windows, some with a red beacon; fogged by the distance */
    var cx0=(x0+x1)/2, cz0=(z0+z1)/2, rad0=Math.max(x1-x0,z1-z0)/2+60, nsk=90;
    for(k=0;k<nsk;k++){ var ang=k/nsk*TAU+Rn()*0.05, rr=rad0+170+Rn()*260, w=24+Rn()*50, dd=24+Rn()*50, h=70+Math.pow(Rn(),1.6)*260, sx=cx0+Math.cos(ang)*rr*(0.9+Rn()*0.2)*1.15, sz=cz0+Math.sin(ang)*rr*(0.9+Rn()*0.2), v0=P.v;
      P.box(-w/2,0,-dd/2,w/2,h,dd/2,[0.2,0.2,0.2,7]); P.xform(v0,GL.local(M12,sx,-2,sz,0,ang+PI/2+(Rn()-0.5)*0.5,0,1));
      if(h>90&&Rn()<0.7){ P.box(sx-0.5,h-1,sz-0.5,sx+0.5,h+1,sz+0.5,[2.6,0.25,0.2,2]); S.lights.push([sx,h,sz,2.2]); } }
    /* two big boards over the ends (the short sides): a dark frame and an LED face */
    var ends=[0,0]; path.forEach(function(p,i){ if(p[0]<path[ends[0]][0]) ends[0]=i; if(p[0]>path[ends[1]][0]) ends[1]=i; });
    ends.forEach(function(ei){ var e=path[ei], bx=e[0]+e[2]*31, bz=e[1]+e[3]*31, yaw=-Math.atan2(e[3],e[2]), v0=P.v;
      P.box(-0.6,0,-12.6,0.6,8.6,12.6,[0.06,0.06,0.07,0]); P.xform(v0,GL.local(M12,bx,37.4,bz,0,yaw,0,1));
      var v1=P.v; P.face([[-0.65,0.5,-12],[-0.65,0.5,12],[-0.65,8.1,12],[-0.65,8.1,-12]],[1,1,1,5]); P.xform(v1,GL.local(M12,bx,37.4,bz,0,yaw,0,1));
      var v2=P.v; P.beam([0,0,-6],[0,-2.2,-6],0.5,0.5,[0.2,0.2,0.23,6]); P.beam([0,0,6],[0,-2.2,6],0.5,0.5,[0.2,0.2,0.23,6]); P.xform(v2,GL.local(M12,bx+e[2]*2,37.4,bz+e[3]*2,0,yaw,0,1)); });
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
  /* a quad with a colour per corner (the crowd's risers carry their own row coordinate: r = brightness, g = 0 at the foot / 1 at the top, b = the
     row's seed, code 8) */
  function faceC(P,pts,cols){
    var a=pts[0], b=pts[1], d=pts[3], ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=d[0]-a[0], vy=d[1]-a[1], vz=d[2]-a[2];
    var nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx, l=Math.hypot(nx,ny,nz)||1, s0=P.v;
    for(var k=0;k<4;k++){ var q=pts[k], c=cols[k]; P.vert(q[0],q[1],q[2],nx/l,ny/l,nz/l,c[0],c[1],c[2],c[3]); }
    P.quad(s0,s0+1,s0+2,s0+3);
  }
  /* polish: the risers (what the floor cameras see) show the heads and shoulders of each row, the treads (seen from above) keep the seat cells */
  function tiers(P,path,Rn,d0,h0,rows,dep,rise,lit){
    for(var k=0;k<path.length;k++){ var a=path[k], b=path[(k+1)%path.length];
      for(var r=0;r<rows;r++){ var d=d0+r*dep, h=h0+r*rise, v=(0.8+Rn()*0.2)*lit, sd=((r*37+d0*3+7)%251)/251;   /* one seed a row: a person never changes at a segment joint */
        var col=[v,v,v,4], lo=[v*0.92,0,sd,8], hi=[v*0.92,1,sd,8];
        var A0=[a[0]+a[2]*d,h,a[1]+a[3]*d], B0=[b[0]+b[2]*d,h,b[1]+b[3]*d], A1=[a[0]+a[2]*(d+dep),h,a[1]+a[3]*(d+dep)], B1=[b[0]+b[2]*(d+dep),h,b[1]+b[3]*(d+dep)];
        P.face([A0,B0,B1,A1],col); faceC(P,[A1,B1,[B1[0],h+rise,B1[2]],[A1[0],h+rise,A1[2]]],[lo,lo,hi,hi]); } }
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
      var sd2=((r*37+11)%251)/251, lo2=[v*0.92,0,sd2,8], hi2=[v*0.92,1,sd2,8];
      P.face([[a2[0],h,a2[1]+d],[a2[0],h,a2[1]+d+0.9],[b2[0],h,b2[1]+d+0.9],[b2[0],h,b2[1]+d]],col); faceC(P,[[a2[0],h,a2[1]+d+0.9],[a2[0],h+0.55,a2[1]+d+0.9],[b2[0],h+0.55,b2[1]+d+0.9],[b2[0],h,b2[1]+d+0.9]],[lo2,hi2,hi2,lo2]); } }
    /* polish: the grandstand's front LED ribbon, its roof on columns and the light banks under the roof's edge */
    var z0g=cz+az+30, xa=path[0][0], xb=path[40][0], M12=new Float32Array(12);
    for(k=0;k<40;k++){ var ga=path[k], gb=path[k+1];
      P.face([[ga[0],0.3,z0g-0.05],[gb[0],0.3,z0g-0.05],[gb[0],1.45,z0g-0.05],[ga[0],1.45,z0g-0.05]],[1,1,1,5]);
      P.face([[ga[0],24,z0g+29],[gb[0],24,z0g+29],[gb[0],25.2,z0g+5],[ga[0],25.2,z0g+5]],[0.12,0.12,0.14,6]);
      P.face([[ga[0],24.1,z0g+5],[gb[0],24.1,z0g+5],[gb[0],25.6,z0g+5],[ga[0],25.6,z0g+5]],[0.16,0.16,0.19,6]); }
    P.face([[xa,0,z0g+29],[xb,0,z0g+29],[xb,24,z0g+29],[xa,24,z0g+29]],[0.1,0.1,0.12,0]);
    S.lights=[];
    for(k=0;k<=40;k+=4){ var gx2=path[k][0]; P.beam([gx2,0,z0g+28.5],[gx2,24,z0g+28.5],0.7,0.7,[0.24,0.24,0.27,6]); P.beam([gx2,17.6,z0g+27],[gx2,24.4,z0g+12],0.45,0.6,[0.24,0.24,0.27,6]); }
    for(k=1;k<40;k+=3){ var gx3=(path[k][0]+path[k+1][0])/2; P.box(-1.6,-0.3,-0.55,1.6,0.3,0.55,[1.7,1.65,1.5,2]); P.xform(P.v-24,GL.local(M12,gx3,23.7,z0g+5.6,0,0,0,1)); S.lights.push([gx3,23.4,z0g+5.6,4.6]); }
    for(k=0;k<n;k+=8){ var p2=ring2[k], X2=lerp(p2[0],cx,0.08), Z2=lerp(p2[1],cz,0.08); P.beam([X2,0,Z2],[X2,34,Z2],0.6,0.6,[0.3,0.3,0.33,0]); P.box(-2,-0.5,-0.8,2,0.5,0.8,[1.6,1.55,1.4,2]); P.xform(P.v-24,GL.local(new Float32Array(12),X2,34.5,Z2,0,Math.atan2(cz-Z2,cx-X2),0,1)); S.lights.push([X2,34,Z2]); }
  }
  /* outdoors: trees on the land, spectators at the big jumps, a ring of far hills */
  function outdoorSet(C,P,Rn,S){
    var L=S.land, n=0, tries=0, k, desert=S.sur==="desert", farm=S.sur==="farmland", nT=desert?170:farm?220:320;
    while(n<nT&&tries<6000){ tries++;
      var X=L.x0+Rn()*L.nx*L.cs, Z=L.z0+Rn()*L.nz*L.cs, best=1e9;
      for(k=0;k<C.N;k+=10){ var d=Math.hypot(C.x[k]-X,C.z[k]-Z); if(d<best) best=d; }
      if(best<16) continue; if(best<45&&Rn()<0.6) continue;
      var y=landAt(S,X,Z), hgt=6+Rn()*7, wv=0.75+Rn()*0.25, col=[0.13*wv,0.27*wv,0.12*wv,0], v0=P.v;
      if(desert){ /* polish 2: the desert's scrub: low grey-green bushes, a few oaks */ var bh=1.2+Rn()*1.6;
        if(Rn()<0.18){ P.box(-0.2,0,-0.2,0.2,hgt*0.32,0.2,[0.34,0.27,0.19,0]); P.ball(0,hgt*0.45,0,hgt*0.36,hgt*0.2,hgt*0.36,[0.26*wv,0.31*wv,0.17*wv,0],7); }
        else P.ball(0,bh*0.4,0,bh*0.9,bh*0.55,bh*0.8,[0.36*wv,0.38*wv,0.24*wv,0],6); }
      else if(farm||Rn()<0.36){ /* a broadleaf tree: a trunk and two lumps of crown (farmland: broadleaf only) */
        P.box(-0.24,0,-0.24,0.24,hgt*0.5,0.24,[0.32,0.24,0.16,0]);
        P.ball(0,hgt*0.66,0,hgt*0.3,hgt*0.25,hgt*0.3,[0.17*wv,0.31*wv,0.12*wv,0],7); P.ball(hgt*0.12,hgt*0.8,hgt*0.05,hgt*0.2,hgt*0.17,hgt*0.2,[0.2*wv,0.35*wv,0.14*wv,0],6); }
      else { P.box(-0.2,0,-0.2,0.2,hgt*0.35,0.2,[0.3,0.22,0.15,0]);
        cone(P,0,hgt*0.25,0,hgt*0.32,hgt*0.55,7,col); cone(P,0,hgt*0.55,0,hgt*0.24,hgt*0.45,7,[col[0]*1.15,col[1]*1.12,col[2]*1.1,0]); }
      P.xform(v0,GL.local(new Float32Array(12),X,y,Z,0,Rn()*TAU,0,1)); n++; }
    /* polish 2: the far country: two smooth ridgelines round the valley (the nearer greener, the farther higher and lost in the haze) instead
       of a ring of pyramids; low and green round farmland, high and brown in the desert */
    var cx=(L.x0+L.x0+L.nx*L.cs)/2, cz=(L.z0+L.z0+L.nz*L.cs)/2, rad=0.93*Math.min(L.nx,L.nz)*L.cs/2;   /* (inside the land's edge: no gap of sky between the land and the hills) */
    var RG=S.sur==="desert"?[[0,26,34,[0.42,0.37,0.27,0]],[110,60,60,[0.46,0.42,0.36,0]]]:S.sur==="farmland"?[[0,14,16,[0.24,0.34,0.2,0]],[90,34,34,[0.3,0.38,0.33,0]]]:[[0,30,32,[0.22,0.32,0.2,0]],[110,64,56,[0.29,0.37,0.32,0]]];   /* (the farther ridge starts under the nearer one's crest: no gap of sky from the air) */
    RG.forEach(function(g2){ ridge(P,cx,cz,rad+g2[0],g2[1],g2[2],g2[3],Rn); });
    /* spectators along the big jumps */
    S.crowd=[];
    pits(C,P,Rn,S);
    C.feats.forEach(function(F){ if(!(F.type==="big-jump"||F.type==="triple"||F.type==="whoops"||F.type==="stepup")) return;
      for(var j=0;j<14;j++){ var s=F.s0+Rn()*F.len, i=Math.round(s/C.DS)%C.N, side=Rn()<0.5?-1:1, lat=side*(C.hw[i]+7+Rn()*4), X3=C.x[i]-C.tz[i]*lat, Z3=C.z[i]+C.tx[i]*lat;
        if(sideClear(C,s,side,Math.abs(lat))<3) continue;
        S.crowd.push({x:X3,y:landAt(S,X3,Z3),z:Z3,yaw:Math.atan2(C.z[i]-Z3,C.x[i]-X3),col:CROWD[Math.floor(Rn()*CROWD.length)]}); } });
  }
  /* the pits (polish): a row of team transporters beside the start straight on its free side, their awnings out, people about; plain
     colours, no names or marks */
  var TRUCK=[[0.84,0.16,0.16],[0.12,0.31,0.77],[0.34,0.73,0.28],[0.95,0.81,0.11],[1.0,0.48,0.1],[0.9,0.9,0.92],[0.13,0.13,0.15],[0.66,0.06,0.11]];
  /* polish 2: where the transporters stand: 20 m apart along the start straight (they overlapped like dominoes at 10 m), on level ground */
  function pitSpots(C){
    var side=C.fside, out=[], end=Math.max(Math.min(C.startLen,C.L*0.3),Math.min(170,C.L*0.12));
    for(var s=14;s<end&&out.length<8;s+=20){
      var i=Math.round(s/C.DS)%C.N, dist=C.hw[i]+Math.abs(C.off[i])+30;
      if(sideClear(C,s,side,dist+8)<10) continue;
      var lat=side*dist; out.push({x:C.x[i]-C.tz[i]*lat,z:C.z[i]+C.tx[i]*lat,e:C.E[i]-0.25,cx:C.tx[i],cz:C.tz[i],yaw:-Math.atan2(C.tz[i],C.tx[i])});
    }
    return out;
  }
  /* a smooth ridgeline round (cx, cz) at radius R0: its crest from a few sines, the face toward the valley */
  function ridge(P,cx,cz,R0,base,amp,col,Rn){
    var n=160, ph=[Rn()*TAU,Rn()*TAU,Rn()*TAU,Rn()*TAU], hs=[], k;
    for(k=0;k<=n;k++){ var a=k/n*TAU; hs.push(Math.max(6,base+amp*(0.5*Math.sin(a*3+ph[0])+0.32*Math.sin(a*7+ph[1])+0.18*Math.sin(a*13+ph[2])+0.1*Math.sin(a*29+ph[3])))); }
    var s0=P.v;
    for(k=0;k<=n;k++){ var a2=k/n*TAU, ca=Math.cos(a2), sa=Math.sin(a2), h=hs[k], dep=h*2.2+60, sl=Math.atan2(h,dep), cs=Math.cos(sl), sn=Math.sin(sl);
      var tint=0.9+0.2*((hs[k]-base)/(amp+1));
      P.vert(cx+ca*R0,-8,cz+sa*R0,-ca*sn,cs,-sa*sn,col[0]*1.05,col[1]*1.05,col[2]*1.02,0);
      P.vert(cx+ca*(R0+dep*0.55),h*0.78,cz+sa*(R0+dep*0.55),-ca*sn*0.8,Math.sqrt(1-0.64*sn*sn),-sa*sn*0.8,col[0]*tint,col[1]*tint,col[2]*tint,0);
      P.vert(cx+ca*(R0+dep),h,cz+sa*(R0+dep),0,1,0,col[0]*tint*1.04,col[1]*tint*1.04,col[2]*tint*1.06,0); }
    for(k=0;k<n;k++){ var a3=s0+k*3, b3=s0+(k+1)*3; P.quad(a3,b3,b3+1,a3+1); P.quad(a3+1,b3+1,b3+2,a3+2); }
  }
  function pits(C,P,Rn,S){
    var side=C.fside, M12=new Float32Array(12), placed=0;
    (S.pitSpots||[]).forEach(function(ps){
      var X=ps.x, Z=ps.z, y=Math.max(landAt(S,X,Z),landAt(S,X+ps.cx*7,Z+ps.cz*7),landAt(S,X-ps.cx*7,Z-ps.cz*7))-0.05, yaw=ps.yaw, col=TRUCK[placed%TRUCK.length], v0=P.v;
      P.box(-7,1.05,-1.25,7,4.0,1.25,[col[0],col[1],col[2],0]); P.box(-7.02,1.05,-1.27,7.02,1.6,1.27,[0.1,0.1,0.11,0]);
      P.box(7.3,0.9,-1.2,9.6,3.4,1.2,[col[0]*0.9,col[1]*0.9,col[2]*0.9,0]); P.box(9.35,2.1,-1.0,9.62,3.0,1.0,[0.12,0.16,0.22,0]);
      for(var w=0;w<4;w++){ var wx=[-5.6,-4.4,7.9,8.9][w]; P.box(wx-0.5,0,-1.3,wx+0.5,1.0,1.3,[0.08,0.08,0.09,0]); }
      var aw=-side; P.face([[-6,3.7,1.25*aw],[6,3.7,1.25*aw],[6,3.1,4.3*aw],[-6,3.1,4.3*aw]],[0.92,0.92,0.9,0]);
      P.beam([-5.8,0,4.2*aw],[-5.8,3.1,4.2*aw],0.08,0.08,[0.7,0.7,0.72,0]); P.beam([5.8,0,4.2*aw],[5.8,3.1,4.2*aw],0.08,0.08,[0.7,0.7,0.72,0]);
      P.xform(v0,GL.local(M12,X,y,Z,0,yaw,0,1));
      for(var q=0;q<3;q++){ var ox=(Rn()-0.5)*10, oz=(2.2+Rn()*2.5)*aw, c=Math.cos(yaw), sn=Math.sin(yaw), PX=X+ox*c+oz*sn, PZ=Z-ox*sn+oz*c;
        S.crowd.push({x:PX,y:landAt(S,PX,PZ),z:PZ,yaw:Rn()*TAU,col:CROWD[Math.floor(Rn()*CROWD.length)]}); }
      placed++;
    });
  }
  function cone(P,x,y,z,r,h,n,col){ var s=P.v; for(var k=0;k<n;k++){ var a=k/n*TAU, b=(k+1)/n*TAU, A=[x+Math.cos(a)*r,y,z+Math.sin(a)*r], B2=[x+Math.cos(b)*r,y,z+Math.sin(b)*r], T=[x,y+h,z];
    var ex=B2[0]-A[0], ez=B2[2]-A[2], fx2=T[0]-A[0], fy=T[1]-A[1], fz=T[2]-A[2], nx=-(ez*fy), ny=ez*fx2-ex*fz, nz=ex*fy, l=Math.hypot(nx,ny,nz)||1; if(ny<0){ nx=-nx; ny=-ny; nz=-nz; }
    var i0=P.vert(A[0],A[1],A[2],nx/l,ny/l,nz/l,col[0],col[1],col[2],col[3]), i1=P.vert(B2[0],B2[1],B2[2],nx/l,ny/l,nz/l,col[0],col[1],col[2],col[3]), i2=P.vert(T[0],T[1],T[2],nx/l,ny/l,nz/l,col[0],col[1],col[2],col[3]); P.tri(i0,i2,i1); } }
  /* camera spots: beside every feature (the clearer side), at every turn, at the line, at the gate */
  /* a camera spot beside the track at s (polish): as far out as asked when that is clear of every other section, else closer in (down to
     5.5 m), on the side with more room (a berm in the way, bermI, costs that side); lifted 6 m only if nothing is clear. On a tight
     stadium layout "14 m out" was often right over the next lane, so its riders passed under the camera (a top-down view of the wrong
     riders) */
  /* polish 2: does a tall part of another section (a jump, a berm wall) stand between a camera at (X, Z) and the track at s (or at tx, tz)? */
  function occluded(C,X,Z,s,tx,tz){
    var i=Math.round(((s%C.L)+C.L)%C.L/C.DS)%C.N, ax=tx!=null?tx:C.x[i], az=tz!=null?tz:C.z[i];
    for(var k=1;k<8;k++){ var u=k/8, px=X+(ax-X)*u, pz=Z+(az-Z)*u;
      for(var j=0;j<C.N;j+=4){ var along=Math.abs(j-i)*C.DS; along=Math.min(along,C.L-along); if(along<25) continue;
        if(C.F[j]>0.9&&Math.hypot(C.x[j]-px,C.z[j]-pz)<C.hw[j]+1) return true; } }
    return false;
  }
  function placeSpot(C,S,s,dist,bermI){
    var i=Math.round(((s%C.L)+C.L)%C.L/C.DS)%C.N, best=null, fs=[1,0.78,0.6,0.45];
    for(var q=0;q<fs.length;q++){ var d=Math.max(5.5,dist*fs[q]), top=null;
      for(var sd=1;sd>=-1;sd-=2){ var cl=sideClear(C,s,sd,C.hw[i]+d), sc=cl-((bermI!=null&&C.berm[bermI]*sd>0.4)?8:0);
        var lat0=sd*(C.hw[i]+d); if(occluded(C,C.x[i]-C.tz[i]*lat0,C.z[i]+C.tx[i]*lat0,s)) sc-=5;
        if(!top||sc>top.sc) top={d:d,side:sd,sc:sc}; }
      if(!best||top.sc>best.sc) best=top;
      if(top.sc>=2.5){ best=top; break; } }
    var lat=best.side*(C.hw[i]+best.d), X=C.x[i]-C.tz[i]*lat, Z=C.z[i]+C.tx[i]*lat;
    return {i:i,x:X,z:Z,side:best.side,lift:best.sc<2.5?6:0,land:C.outdoor?Math.max(landAt(S,X,Z),C.E[i]):0};
  }
  function spots(C,S){
    var list=[], i;
    function spot(s,kind,dist,h){ var p=placeSpot(C,S,s,dist); return {s:s,kind:kind,x:p.x,y:p.land+h+p.lift,z:p.z,side:p.side}; }
    C.feats.forEach(function(F){ if(F.type==="start"||F.type==="finish"||F.type==="berm"||F.type==="hill"||F.decl||F.flat) return; var sm=(F.s0+F.s1)/2, jump=!!F.vj;
      list.push(spot(sm,F.type,C.outdoor?(jump?28:24):(jump?17:14),C.outdoor?(jump?8:5):(jump?6:3.6))); list[list.length-1].F=F; list[list.length-1].name=F.name||F.type; });
    S.secs=list;
    /* turns: the apex of every tight turn */
    S.turns=[];
    var inT=false, best=0, bi=0;
    for(i=0;i<C.N;i++){ var kk=Math.abs(C.k[i]); if(kk>0.045){ if(!inT){ inT=true; best=0; } if(kk>best){ best=kk; bi=i; } } else if(inT){ inT=false; var sp=spot(bi*C.DS,"turn",C.outdoor?18:9,C.outdoor?3.5:2.6); S.turns.push(sp); } }
    /* turn 1 after the start straight */
    S.turn1=S.turns.filter(function(t){ return t.s>C.startLen*0.6; })[0]||S.turns[0]||{s:C.startLen,x:0,y:3,z:0};
    var fi=Math.round(C.sFin/C.DS)%C.N;
    /* polish: the line camera 13 m PAST the line across the track from the flagger, looking back up the track: the leader rides through the
       arch toward it with the flagger's flag in the frame (it used to sit before the line, so the leader came from behind it) */
    var lsd=-(C.hw[fi]+C.off[fi]+7.5), lb=Math.round(((C.sFin+13)%C.L+C.L)%C.L/C.DS)%C.N, lX=C.x[lb]-C.tz[lb]*lsd, lZ=C.z[lb]+C.tx[lb]*lsd;
    S.line={s:C.sFin,x:lX,y:(C.outdoor?Math.max(C.E[lb],landAt(S,lX,lZ)):0)+3.2,z:lZ}; S.lineAim=[C.x[fi]-C.tz[fi]*C.off[fi],(C.outdoor?C.E[fi]:0)+1.1,C.z[fi]+C.tx[fi]*C.off[fi]];
    S.gate=gateSpot(C);
    var cx=(S.box.x0+S.box.x1)/2, cz=(S.box.z0+S.box.z1)/2; S.centre=[cx,C.outdoor?10:0,cz]; S.radius=Math.max(S.box.x1-S.box.x0,S.box.z1-S.box.z0)*0.62;
  }

  /* ---------- lighting by the surroundings ---------- */
  /* polish: the key light lower (about 45 degrees, along the long axis) so the whoops, the faces and the landings model in light and shade,
     a cool fill from the other side, the stadium's lit dust haze and an open night sky over the rim; outdoors a warm sun, the sky bounce and
     the horizon haze */
  function light(S){
    var beach=S.sur==="beach-speedway";
    /* LINEAR light (the shaders square the authored colours and tone map with ACES at the end): a strong warm key and a stronger warm rim from
       the floodlights, a cool sky bounce and a warm ground bounce, the lit dust haze; by day the sun, the sky and a pale haze */
    if(S.night) return {sun:norm3([0.62,0.66,0.3]),sunCol:[2.1,1.95,1.7],fill:norm3([-0.5,0.55,-0.62]),fillCol:[1.9,1.3,0.82],sky:[0.06,0.075,0.14],gnd:[0.05,0.035,0.025],
      fog:[0.008,0.01,0.022],fogR:[240,820,beach?0.0020:0.0030],haze:beach?[0.1,0.06,0.05]:[0.07,0.05,0.04],expo:0.62,wet:0.2,
      top:[0.1,0.13,0.26],hor:beach?[0.4,0.26,0.26]:[0.3,0.25,0.26],nightK:1,clouds:0,clear:[0.008,0.01,0.02],spot:[S.centre[0],S.centre[2],S.radius*1.05,1],
      bloomK:1.0,bloomT:1.25,vig:1.0,sat:1.16};
    return {sun:norm3([0.5,0.66,0.32]),sunCol:[3.1,2.8,2.3],fill:norm3([-0.45,0.5,-0.6]),fillCol:[0.55,0.62,0.8],sky:[0.5,0.62,0.9],gnd:[0.3,0.25,0.17],
      fog:[0.42,0.52,0.7],fogR:[320,1900,0.00045],haze:[0.45,0.55,0.72],expo:0.85,wet:0.05,
      top:[0.3,0.5,0.85],hor:[0.75,0.85,0.95],nightK:0,clouds:fx?0:0.85,clear:[0.45,0.55,0.75],spot:[0,0,1,0],
      bloomK:0.7,bloomT:1.1,vig:0.55,sat:1.08};
  }
  function norm3(v){ var l=Math.hypot(v[0],v[1],v[2])||1; return [v[0]/l,v[1]/l,v[2]/l]; }

  /* ---------- riders ---------- */
  V.setTrack=function(series,year,cal,gateN){
    var pick=TK.forRound(series,year,cal||{}), key=pick.key+"|"+(gateN>30?40:22), gate=gateN>30?40:22;
    if(key===V.key&&SC) return pick;
    /* polish 2: the round's real layout when its season's file has it; a layout that cannot be built or staged gives way to a built-in track */
    var cr=TK.course(series,year,cal||{},{gate:gate}), C=cr.C; pick=cr.pick;
    V.key=key; V.C=C;
    try{ SC=buildScene(C); }catch(e){ try{ console.warn("mxwar 3d: scene",e); }catch(x){}
      pick=TK.forRound(series,year,cal||{},{builtin:true}); C=TK.build(pick.layout,{variant:pick.variant,gate:gate}); V.C=C; SC=buildScene(C); pick.fallback=true; }
    SC.L=light(SC); V.lapEndT={};
    V.trackName=pick.layout.name; V.trackStatus=pick.layout.status;
    return pick;
  };
  V.setRiders=function(list){
    V.riders=list.map(function(o,k){ var c=hex(o.color), a=hex(o.accent||"#f2f2f6");
      return {s:o.s,k:k,hex:o.color,col:c,acc:a,plate:o.plate,red:!!o.red,me:!!o.me,name:o.name||"",segs:[],lag0:0,lane:((k*7919)%13-6)/6*0.55,lat:0,latV:0,D:0,
        crash:null,out:false,dnf:null,pull:null,park:null,spin:0,place:k,hold:null,whip:((((k*2654435761)>>>0)%7)-3)*0.09}; });
    V.by={}; V.riders.forEach(function(r){ V.by[r.s]=r; r.mudJit=(vrand()-0.5)*0.2; drawCell(r.k,r.plate,{red:r.red,me:r.me,color:r.hex}); drawOut(r.k,r.plate); drawJersey(r); });
    V.n=V.riders.length;
  };
  V.setRed=function(s){ V.riders.forEach(function(r){ var on=r.s===s; if(on!==r.red){ r.red=on; drawCell(r.k,r.plate,{red:r.red,me:r.me,color:r.hex}); } }); };
  /* the gate slots across the start (the people's riders get no special slot: the gate order is the race's) */
  function gateLat(r){ var C=V.C, G=gateF(C), hw=G.hw-0.7, n=V.n, w=Math.min(1.05,hw*2/Math.max(1,n)); return G.off+(-((n-1)*w)/2+r.k*w); }

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
  function dAt(r,T){ var C=V.C, tau=T-lagAt(r,T); return TK.distAt(C,tau); }   /* (at the gate: -Lc, the start of the chute) */
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
    var D0=V.C?-V.C.Lc:0;
    V.riders.forEach(function(r){ r.segs=[]; r.lag0=0; r.crash=null; r.out=false; r.dnf=null; r.pull=null; r.park=null; r.lat=gateLat(r); r.D=D0; r.latOk=false; });
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
    if(crashes.length){ var sec=crashes[0].sector==null?0.5:crashes[0].sector, lo=Tb+3;
      if(C.Lc&&V.by[crashes[0].s]) lo=Math.max(lo,C.Tc+3+lagAt(V.by[crashes[0].s],Tb));   /* polish 2: never on the start chute (the crash belongs to the lap) */
      var hi=Math.max(lo+1,Tend-6); crashT=snapCrash(crashes[0].s,lo+(hi-lo)*clamp(sec,0,1),lo-0.5,hi+1); }
    var holdSec=V.yellow&&V.yellow.lap===k?V.yellow:null;   /* the yellow lap: nobody changes place in that section */
    var turnT=first?leadTimeAt(SC.turn1.s):0;
    V.riders.forEach(function(r){
      if(r.out||r.park) return;
      var cur=lagAt(r,Tb), want=tg[r.s];
      if(r.crash&&Tb<r.crash.T0+r.crash.dur+0.5){ if(r.crash.kind==="out"||want==null) return; var ls=r.segs[r.segs.length-1]; if(ls) r.segs.push({t0:ls.t1,t1:Math.max(ls.t1+3,t1end),l0:ls.l1,l1:Math.max(want,ls.l1-0.15*Math.max(3,t1end-ls.t1))}); return; }
      r.segs=r.segs.filter(function(q){ return q.t0<Tb; }).map(function(q){ if(q.t1>Tb){ var l=segLag(r,Tb); return {t0:q.t0,t1:Tb,l0:q.l0,l1:l,lin:true}; } return q; });
      if(outs[r.s]&&!crashes.some(function(c){ return c.s===r.s; })){ r.pull={T0:Tb+2+rand()*3}; r.segs.push({t0:Tb,t1:Tb+0.1,l0:cur,l1:cur}); return; }
      if(want==null) want=cur;
      var q={t0:Tb+0.5,t1:first?Math.max(3,turnT-0.6):t1end,l0:cur,l1:want};
      if(holdSec){ var w=secWindow(r,holdSec,cur); if(w){ q.y0=w[0]; q.y1=w[1]; } }
      r.segs.push(q);
    });
    V.crashT=null; V.crashBanner=false;
    crashes.forEach(function(c,ci){ var r=V.by[c.s]; if(!r) return; var tc=crashT+ci*0.15; planCrash(r,tc,c.kind,Tend); if(ci===0) V.crashT=tc;
      /* the marshal waves from the crash to the end of the lap after the one it happens on (a late result can put the crash a lap after
         the cards' lap: the flag still covers a whole lap of riding past it) */
      var lc=1; while(lc<999&&lapEnd(lc)<=tc) lc++;
      V.yellow={lap:k+1,T0:tc,until:lapEnd(Math.max(k+1,lc+1)),s:dAt(r,tc)%C.L,ms:(dAt(r,tc)+0.45*r.crash.v)%C.L,seat:c.s}; });
    V.pass=planPass(res,tg,Tb,Tend,crashT);
    if(V.pass) pushEv("pass",V.pass.t0,V.pass.t1,V.pass.w,{p:V.pass.p});
    /* reserve the shots of this lap */
    if(first){ reserve({kind:"gate",t0:-1.5,t1:Math.min(3.4,turnT-2.2),pri:6}); reserve({kind:"turn1",t0:turnT-2.2,t1:turnT+2.6,spot:SC.turn1,holeshot:turnT+0.9,pri:6}); }
    /* polish: the crash shot stays until he is back on and riding off (6.8 s), or has pushed the bike off the track (7.8 s) */
    if(crashT!=null) reserve({kind:"crash",t0:crashT-1.7,t1:crashT+(crashes[0].kind==="out"?7.8:6.8),focus:crashes[0].s,pri:5});
    if(V.pass) reserve({kind:"battle",t0:V.pass.t0-0.9,t1:V.pass.t1+1.0,pair:[V.pass.w,V.pass.p],pri:3});
    if(holdSec){ var ty=leadTimeAt(holdSec.s,Tb); if(ty<Tend-3) reserve({kind:"yellow",t0:ty-2.8,t1:ty+3.4,spot:mkSpot(holdSec.s,C.outdoor?20:14,C.outdoor?5.5:5.2),pri:4}); }
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
    pushEv("crash",tc,tc+dur,r.s,{out:kind==="out"});
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
    var span=Tend-Tb, tp=Tb+Math.max(5,span*(0.3+rand()*0.25));
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
  V.setFlag=function(f){ V.flag=f||null; V.flagT=vnow(); };
  V.flush=function(){ V.waiters.splice(0).forEach(function(w){ try{ w.res(); }catch(e){} }); };
  V.finishShow=function(){ V.phase="end"; };

  /* ---------- the director ---------- */
  function setShot(sh){
    V.shot=sh; if(!sh) return;
    sh.el=0; if(sh.res) sh.d=Math.max(0.4,sh.t1-V.T);
    CAM.se=null; CAM.st=null; V.lastShotKind=sh.kind; V.cuts=(V.cuts|0)+1; parts.n=0;
    if(sh.kind==="crash"&&sh.focus>=0){ var r=V.by[sh.focus]; if(r&&r.crash) sh.spot=crashSpot(r); }
    V.hist=(V.hist||[]).concat([[sh.kind,+V.T.toFixed(1)]]).slice(-40);
  }
  /* the crash camera (polish): abreast of where the bike and the rider come to rest (0.6 v on), 9 m out on the side without a berm in the
     way, 4.6 m up so the whole tumble is in view */
  function crashSpot(r){ var C=V.C, D=((r.crash.D%C.L)+C.L)%C.L, s=D+0.6*r.crash.v, p=placeSpot(C,SC,s,9,Math.round(D/C.DS)%C.N), j=p.i;
    return {x:p.x,y:(C.outdoor?Math.max(C.E[j]+C.F[j],p.land)+6.2:Math.max(0,C.F[j]*0.6)+5.2)+p.lift,z:p.z}; }
  function mkSpot(s,dist,h){ var C=V.C, p=placeSpot(C,SC,s,dist); return {s:s,x:p.x,y:p.land+h+p.lift,z:p.z,side:p.side}; }
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
    var you=meSeat(); opts.push({kind:"chase",focus:(you>=0&&rand()<0.45)?you:-1,d:Math.min(d,5.2),w:last==="chase"?0.5:2});
    var ws=null; S.secs.forEach(function(x){ var dt=leadTimeAt(x.s,T)-T; if(dt>0.4&&dt<4) ws=x; }); if(ws&&last!=="wide") opts.push({kind:"wide",spot:ws,d:Math.min(d,4.6),w:1.6});
    if(last!=="heli"&&(V.rot%6===5)) opts.push({kind:"heli",d:Math.min(d,4.2),w:1.4});
    V.rot++;
    var tot=0; opts.forEach(function(o){ tot+=o.w; }); var r=rand()*tot;
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
    setShot(pickFiller(Math.min(room,4.2+rand()*2.6)));
  }
  /* ---------- per frame: the riders' poses ---------- */
  var A12=new Float32Array(12), B12=new Float32Array(12), C12=new Float32Array(12), L12=new Float32Array(12);
  var PARTS=["body","fork","swing","shock","wheelF","wheelR","torso","uarm","farm","thigh","shin","r1s","r1t","w1","r2s","r2t"];
  var NCNT={body:"body",fork:"fork",swing:"swing",shock:"shock",wheelF:"wheelF",wheelR:"wheelR",torso:"torso",uarm:"arm",farm:"arm",thigh:"leg",shin:"leg",r1s:"r1s",r1t:"r1t",w1:"w1",r2s:"r2s",r2t:"r2t"};
  var SHCAST=["body","fork","swing","shock","wheelF","wheelR","torso","uarm","farm","thigh","shin","r1s","r1t","w1"];
  var CAP=48;
  var IBD={plate:new Float32Array(240*16),person:new Float32Array(128*20),label:new Float32Array(90*12),decal:new Float32Array(64*12),part:new Float32Array(400*8),gate:new Float32Array(20),glow:new Float32Array(48*8),clump:new Float32Array(600*12)};
  PARTS.forEach(function(k){ IBD[k]=new Float32Array(CAP*20); });
  var counts={body:0,fork:0,swing:0,shock:0,wheelF:0,wheelR:0,torso:0,arm:0,leg:0,r1s:0,r1t:0,w1:0,r2s:0,r2t:0,plate:0,person:0,label:0,decal:0,part:0,clump:0};
  var poses=[], LIST=[], RIDING=[], OBSL=[], UP=[0,1,0];
  function byD(a,b){ return b.D-a.D; }
  function pose(r,x,y,z,tx,tz,v,air,D,crash,parked,out,fig,o){ var p=r._po||(r._po={r:r}); p.x=x; p.y=y; p.z=z; p.tx=tx; p.tz=tz; p.v=v; p.air=air; p.D=D; p.crash=crash; p.parked=parked; p.out=out; p.fig=fig;
    if(o){ p.gl=o.gl; p.lean=o.lean||0; p.pitch=o.pitch||0; p.stand=o.stand||0; p.comp=o.comp||0; p.k=o.k||0; } poses.push(p); return p; }
  function putInst(arr,n,M,col,acc,mud){ var o=n*20; arr[o]=M[0];arr[o+1]=M[1];arr[o+2]=M[2];arr[o+3]=M[3];arr[o+4]=M[4];arr[o+5]=M[5];arr[o+6]=M[6];arr[o+7]=M[7];arr[o+8]=M[8];arr[o+9]=M[9];arr[o+10]=M[10];arr[o+11]=M[11];
    arr[o+12]=col[0];arr[o+13]=col[1];arr[o+14]=col[2];arr[o+15]=1;arr[o+16]=acc[0];arr[o+17]=acc[1];arr[o+18]=acc[2];arr[o+19]=(mud==null)?((arr===IBD.person||arr===IBD.gate)?0:V.mudAmt):mud; }
  function putPlate(n,M,uv){ var a=IBD.plate, o=n*16; for(var i=0;i<12;i++) a[o+i]=M[i]; a[o+12]=uv[0]; a[o+13]=uv[1]; a[o+14]=uv[2]; a[o+15]=uv[3]; }
  /* the pose of a riding bike at race distance D, lateral lat */
  function ridePose(D,lat,o){
    var C=V.C;
    if(D<0&&C.Lc) return chutePose(D,lat,o);
    var s=((D%C.L)+C.L)%C.L, f=s/C.DS, i=Math.floor(f)%C.N, j=(i+1)%C.N, t=f-Math.floor(f);
    o.chute=false;
    var tx=lerp(C.tx[i],C.tx[j],t), tz=lerp(C.tz[i],C.tz[j],t), l=Math.hypot(tx,tz)||1; tx/=l; tz/=l;
    var off=lerp(C.off[i],C.off[j],t), x=lerp(C.x[i],C.x[j],t)-tz*(lat+off), z=lerp(C.z[i],C.z[j],t)+tx*(lat+off);
    var Y=lerp(C.Y[i],C.Y[j],t), air=C.air[i]||C.air[j], gc=TK.ground(C,s,0,1), glB=TK.ground(C,s,lat,1), gl=TK.ground(C,s,lat), y=Y+(glB-gc);
    o.x=x; o.y=y; o.z=z; o.tx=tx; o.tz=tz; o.pitch=lerp(C.pitch[i],C.pitch[j],t); o.lean=lerp(C.lean[i],C.lean[j],t); o.stand=lerp(C.stand[i],C.stand[j],t);
    o.air=air; o.v=lerp(C.v[i],C.v[j],t); o.roost=C.roost[i]; o.comp=lerp(C.comp[i],C.comp[j],t); o.s=s; o.gl=gl; o.sand=C.sand[i]; o.k=lerp(C.k[i],C.k[j],t); return o;
  }
  /* polish 2: on the start chute (D < 0): flat at the join's level, leaning in its bends, the drive from the gate */
  function chutePose(D,lat,o){
    var C=V.C, f=clamp((D+C.Lc)/C.DS,0,C.Nc-1e-3), i=Math.floor(f), j=i+1, t=f-i;
    var tx=lerp(C.ctx[i],C.ctx[j],t), tz=lerp(C.ctz[i],C.ctz[j],t), l=Math.hypot(tx,tz)||1; tx/=l; tz/=l;
    var off=lerp(C.coff[i],C.coff[j],t), v=C.cv?lerp(C.cv[i],C.cv[j],t):8, k=lerp(C.ck[i],C.ck[j],t);
    o.x=lerp(C.cx[i],C.cx[j],t)-tz*(lat+off); o.z=lerp(C.cz[i],C.cz[j],t)+tx*(lat+off); o.y=C.cE-0.035; o.tx=tx; o.tz=tz;
    o.pitch=0; o.lean=clamp(Math.atan(v*v*k/9.81),-0.6,0.6); o.stand=v>9?0.75:0.25; o.air=false; o.v=v;
    o.roost=(D+C.Lc)<40?0.9:v<12?0.35:0; o.comp=0.04; o.s=D; o.gl=C.cE-0.035; o.sand=0; o.k=k; o.chute=true; return o;
  }
  var PO={}, PO2={}, CHP={};
  /* the inside foot off the peg: seated (not standing) in a tight turn; signed: + = the right foot (the inside of a right turn) */
  function footOut(o){ var k=Math.abs(o.k||0), a=clamp((k-0.03)/0.05,0,1)*clamp((0.5-o.stand)/0.3,0,1); return a<0.03?0:(o.k>0?a:-a); }
  function flightU(s){ var fl=V.C.flights; for(var i=0;i<fl.length;i++){ var a=fl[i].s0, b=fl[i].s1; if(b-a<6) continue; if(s>=a&&s<=b) return (s-a)/(b-a); } return -1; }
  /* the bike frame matrix from a pose, plus the wheel offsets (the ground pushes the wheels up into the frame) */
  function bikeMats(o,r,lateralYaw){
    var cp=Math.cos(o.pitch), fx=o.tx*cp, fy=Math.sin(o.pitch), fz=o.tz*cp;
    if(lateralYaw){ var c=Math.cos(lateralYaw), s=Math.sin(lateralYaw), nx=fx*c-fz*s, nz=fx*s+fz*c; fx=nx; fz=nz; }
    GL.frame(A12,o.x,o.y,o.z,fx,fy,fz,o.lean);
    return A12;
  }
  function wheelOff(o,dx,lat,R0){ if(o.chute) return R0; var C=V.C, g2=TK.ground(C,o.s+dx,lat), fy=o.y+Math.sin(o.pitch)*dx; if(o.air) return R0-0.1; return clamp(g2+R0-fy,R0-0.12,R0+0.28); }
  /* everything for one rider on or beside a bike. LEVEL OF DETAIL: the nearest riders (the quality level says how many, up to 26 m from the
     lens, and always the one on screen) are built from the articulated parts of models3d.js: the body, the fork (its lowers slide up the gold
     uppers by the wheel's travel), the swingarm (turns about its pivot), the shock (stretches between the frame and the swingarm), the wheels
     (they spin), the torso, the arms and the legs (IK to the grips and the pegs): he stands in the whoops, drops his hips on a landing, puts a
     foot out. The next riders (to 55 m) are one RIGID mesh each (seated or standing) with two spinning wheels; the rest one rigid mesh with the
     wheels baked in. */
  var Mo=MX.Models, MD=Mo.D;
  var HERO_D2=30*30, MID_D2=60*60;
  function lodOf(r,o,state){
    if(state==="lying") return 0;
    var Q=QUAL[V.q], d2=r._d2!=null?r._d2:1e9, hero=r._hero;
    r._d2=(o.x-CAM.eye[0])*(o.x-CAM.eye[0])+(o.y-CAM.eye[1])*(o.y-CAM.eye[1])+(o.z-CAM.eye[2])*(o.z-CAM.eye[2]);
    if(V.mode==="onboard"&&V.focusSeat()===r.s) return 0;
    if(hero) return 0;
    return d2<MID_D2?1:2;
  }
  var SW12=new Float32Array(12), SK12=new Float32Array(12);
  function emitRider(r,o,M,riderState){
    var team=r.col, acc=r.acc, mud=r.mud==null?V.mudAmt:r.mud;
    var spin=(r.spin=(r.spin+(o.v||0)*V.dtR/0.36)%TAU);
    var fo=riderState==="lying"?0.36:wheelOff(o,0.74,r.lat,0.36), ro=riderState==="lying"?0.34:wheelOff(o,-0.74,r.lat,0.34);
    var lod=lodOf(r,o,riderState); r._lod=lod;
    /* plates: the front plate and the two side plates (the page's number plates; the rider's colour stripe) */
    var fu=r.uvf||(r.uvf=(function(uv){ return [uv[2],uv[1],uv[0],uv[3]]; })(cellUV(r.k)));
    if(lod<2&&counts.plate<168){
      GL.amul(B12,M,GL.local(L12,0.612,1.04,0,0.3,0,0,1)); putPlate(counts.plate++,B12,fu);
      GL.amul(B12,M,GL.local(L12,-0.3,0.8,0.178,0,-PI/2,0,1)); putPlate(counts.plate++,B12,fu);
      GL.amul(B12,M,GL.local(L12,-0.3,0.8,-0.178,0,PI/2,0,1)); putPlate(counts.plate++,B12,fu);
    }
    if(lod===0){
      var nb=counts.body; putInst(IBD.body,nb,M,team,acc,mud);
      var cf=fo-0.36, cr=ro-0.34, sF=cf/MD.FORK_U[1], th=-cr/0.44, c=Math.cos(th), s=Math.sin(th), P=MD.PIVOT;
      /* the fork and the front wheel: the axle slides up the fork's axis by the travel */
      var ax=MD.FORK_A[0]+MD.FORK_U[0]*sF, ay=MD.FORK_A[1]+MD.FORK_U[1]*sF;
      GL.amul(B12,M,GL.local(L12,ax,ay,0,0,0,0,1)); putInst(IBD.fork,counts.fork++,B12,team,acc,mud);
      GL.amul(B12,M,GL.local(L12,ax,ay,0,-spin,0,0,1)); putInst(IBD.wheelF,counts.wheelF++,B12,team,acc,mud);
      /* the swingarm turns about its pivot; the rear axle rides on its end */
      GL.local(SW12,P[0],P[1],0,th,0,0,1); GL.amul(B12,M,SW12); putInst(IBD.swing,counts.swing++,B12,team,acc,mud);
      var vx=-MD.WB-P[0], vy=0.34-P[1], axr=P[0]+vx*c-vy*s, ayr=P[1]+vx*s+vy*c;
      GL.amul(B12,M,GL.local(L12,axr,ayr,0,-spin,0,0,1)); putInst(IBD.wheelR,counts.wheelR++,B12,team,acc,mud);
      /* the shock: from the frame's mount to the swingarm's linkage point */
      var bx=P[0]+(MD.SHOCK_BOT[0]-P[0])*c-(MD.SHOCK_BOT[1]-P[1])*s, by=P[1]+(MD.SHOCK_BOT[0]-P[0])*s+(MD.SHOCK_BOT[1]-P[1])*c, tp=MD.SHOCK_TOP, dx=bx-tp[0], dy=by-tp[1], sl=Math.hypot(dx,dy), ux=dx/sl, uy=dy/sl;
      SK12[0]=ux*sl; SK12[1]=-uy; SK12[2]=0; SK12[3]=tp[0]; SK12[4]=uy*sl; SK12[5]=ux; SK12[6]=0; SK12[7]=tp[1]; SK12[8]=0; SK12[9]=0; SK12[10]=1; SK12[11]=0;
      GL.amul(B12,M,SK12); putInst(IBD.shock,counts.shock++,B12,team,acc,mud);
      counts.body++;
    } else {
      /* the rigid mesh (seated or standing: the page decides at the rider) and, for the middle level, the two spinning wheels */
      var stand=o.stand>0.5||o.air, key=(lod===1?"r1":"r2")+(stand?"t":"s");
      putInst(IBD[key],counts[key]++,M,team,acc,mud);
      if(lod===1){
        GL.amul(B12,M,GL.local(L12,0.74,fo,0,-spin,0,0,1)); putInst(IBD.w1,counts.w1++,B12,team,acc,mud);
        GL.amul(B12,M,GL.local(L12,-0.74,ro,0,-spin,0,0,0.945)); putInst(IBD.w1,counts.w1++,B12,team,acc,mud);
      }
    }
  }
  /* the rider on the bike (the hero level only; the rigid meshes carry theirs): hips up and forward when standing, dropped on a landing, the
     torso over the bars; the arms by IK from the shoulders to the grips; the legs from the hips to the pegs */
  var BK=new Float32Array(12), FT=new Float32Array(6), SH=[0,0,0], GR=[0,0,0], HP=[0,0,0], AN=[0,0,0];
  var HINT_A=[0.2,0.6,0.7], HINT_L=[1,0.3,0.22];
  function emitRiderBody(r,M,stand,extraPitch,foot,lean,comp){
    if(r._lod!==0) return;
    var team=r.col, acc=r.acc, st=clamp(stand,0,1), mud=r.mud==null?V.mudAmt:r.mud, cmp=clamp((comp||0)/0.3,0,1);
    var hx=MD.HIP[0]+0.06*st, hy=MD.HIP[1]+0.22*st-0.1*cmp*(1-0.5*st), pitch=-0.35*st+(extraPitch||0)+0.06*cmp;
    var hideT=V.mode==="onboard"&&r.s===V._fseat&&!V.rp;
    GL.amul(B12,M,GL.local(L12,hx,hy,0,pitch,0,0,1)); if(!hideT) putInst(IBD.torso,counts.torso,B12,team,acc,mud);
    /* the number printed on the jersey's back (its own cell: the name above, the number big) */
    if(!hideT&&counts.plate<170){ GL.amul(BK,B12,GL.local(L12,-0.045,0.385,0,0.34,PI,0,1.0)); putPlate(counts.plate++,BK,r.uvj||(r.uvj=(function(uv){ return [uv[2],uv[1],uv[0],uv[3]]; })(jerseyUV(r.k)))); }
    if(!hideT) counts.torso++;
    /* the arms */
    var cp=Math.cos(pitch), sp=Math.sin(pitch), sd, ar;
    for(sd=-1;sd<=1;sd+=2){
      SH[0]=MD.SHOULDER[0]*cp-MD.SHOULDER[1]*sp+hx; SH[1]=MD.SHOULDER[0]*sp+MD.SHOULDER[1]*cp+hy; SH[2]=MD.SHOULDER[2]*sd;
      GR[0]=MD.GRIP[0]; GR[1]=MD.GRIP[1]; GR[2]=MD.GRIP[2]*sd; HINT_A[2]=0.7*sd;
      ar=Mo.solve2(SH,GR,MD.UARM,MD.FARM,HINT_A);
      GL.amul(B12,M,Mo.seg(L12,SH[0],SH[1],SH[2],ar.mid[0],ar.mid[1],ar.mid[2])); putInst(IBD.uarm,counts.arm,B12,team,acc,mud);
      GL.amul(B12,M,Mo.seg(L12,ar.mid[0],ar.mid[1],ar.mid[2],ar.end[0],ar.end[1],ar.end[2])); putInst(IBD.farm,counts.arm,B12,team,acc,mud);
      counts.arm++;
    }
    /* the feet: on the pegs (the ankle sits 0.1 above the peg), the inside one out in a flat turn */
    var PEG=MD.PEG;
    FT[0]=PEG[0]+0.02; FT[1]=PEG[1]+0.1; FT[2]=-0.17; FT[3]=PEG[0]+0.02; FT[4]=PEG[1]+0.1; FT[5]=0.17;
    if(foot){ var k=Math.min(1,Math.abs(foot)), o=foot>0?3:0, th=Math.min(0.75,Math.abs(lean||0)), fy=(0.14+0.44*Math.sin(th))/Math.cos(th);
      FT[o]=lerp(PEG[0],0.5,k); FT[o+1]=lerp(PEG[1]+0.1,Math.max(0.3,fy+0.1),k); FT[o+2]=(foot>0?1:-1)*lerp(0.17,0.44,k); }
    legs(r,M,hx,hy,0.13,FT,mud);
  }
  /* each leg by a 3D two-bone IK from its hip (hx, hy, -/+hz) to its ankle (F = left xyz, right xyz in M's frame); the knee bends forward and a
     little out; an ankle out of reach is met by the straight leg */
  function legs(r,M,hx,hy,hz,F,mud){
    for(var sd=0;sd<2;sd++){
      var o=sd*3, az=sd?hz:-hz, TH=MD.THIGH, SN=MD.SHIN;
      HP[0]=hx; HP[1]=hy; HP[2]=az; AN[0]=F[o]; AN[1]=F[o+1]; AN[2]=F[o+2]; HINT_L[2]=sd?0.22:-0.22;
      var kn=Mo.solve2(HP,AN,TH,SN,HINT_L), kx=kn.mid[0], ky=kn.mid[1], kz=kn.mid[2], e=kn.end;
      GL.amul(B12,M,Mo.seg(L12,hx,hy,az,kx,ky,kz)); putInst(IBD.thigh,counts.leg,B12,r.col,r.acc,mud);
      GL.amul(B12,M,Mo.seg(L12,e[0],e[1],e[2],kx,ky,kz)); putInst(IBD.shin,counts.leg,B12,r.col,r.acc,mud);
      counts.leg++;
    }
  }
  var seg=Mo.seg;
  /* a rider off the bike (thrown, lying, sitting up, standing, walking, lifting): Mb = the hip frame (X = the way he faces, Y up), the
     torso's pitch about the hips (0 = the riding lean, + = back), the ankles in Mb's frame; the arms hang, spread or fly with the torso */
  var ARM_D=[0,0,0];
  function emitFigure(r,Mb,torso,F){
    var mud=r.mud==null?V.mudAmt:r.mud, cp=Math.cos(torso), sp=Math.sin(torso), sd, t=clamp((torso-0.3)/1.6,0,1), fly=torso<-0.4?1:0;
    GL.amul(B12,Mb,GL.local(L12,0,0,0,torso,0,0,1)); putInst(IBD.torso,counts.torso,B12,r.col,r.acc,mud);
    if(counts.plate<170){ GL.amul(BK,B12,GL.local(L12,-0.045,0.385,0,0.34,PI,0,1.0)); putPlate(counts.plate++,BK,r.uvj||(r.uvj=(function(uv){ return [uv[2],uv[1],uv[0],uv[3]]; })(jerseyUV(r.k)))); }
    counts.torso++;
    for(sd=-1;sd<=1;sd+=2){
      SH[0]=MD.SHOULDER[0]*cp-MD.SHOULDER[1]*sp; SH[1]=MD.SHOULDER[0]*sp+MD.SHOULDER[1]*cp; SH[2]=MD.SHOULDER[2]*sd;
      /* the hand: hanging (down and a little forward), thrown out when he lies, up by the head when he tumbles */
      ARM_D[0]=lerp(0.08,-0.25,t)+fly*0.25; ARM_D[1]=lerp(-0.5,-0.1,t)+fly*0.75; ARM_D[2]=sd*(lerp(0.06,0.42,t)+fly*0.2);
      var dl=Math.hypot(ARM_D[0],ARM_D[1],ARM_D[2])||1, ln=0.5, hand=[SH[0]+ARM_D[0]/dl*ln,SH[1]+ARM_D[1]/dl*ln,SH[2]+ARM_D[2]/dl*ln];
      HINT_A[0]=-0.3; HINT_A[1]=-0.2; HINT_A[2]=0.8*sd;
      var ar=Mo.solve2(SH,hand,MD.UARM,MD.FARM,HINT_A);
      GL.amul(B12,Mb,Mo.seg(L12,SH[0],SH[1],SH[2],ar.mid[0],ar.mid[1],ar.mid[2])); putInst(IBD.uarm,counts.arm,B12,r.col,r.acc,mud);
      GL.amul(B12,Mb,Mo.seg(L12,ar.mid[0],ar.mid[1],ar.mid[2],ar.end[0],ar.end[1],ar.end[2])); putInst(IBD.farm,counts.arm,B12,r.col,r.acc,mud);
      counts.arm++;
    }
    legs(r,Mb,0,0,0.12,F,mud);
  }
  function emitShadow(x,y,z,tx,tz,nrm,a,k){ if(counts.decal>=64) return; var n=counts.decal++, d=IBD.decal, o=n*12; d[o]=x; d[o+1]=y; d[o+2]=z; d[o+3]=0; d[o+4]=tx; d[o+5]=tz; d[o+6]=1.15*k; d[o+7]=0.5*k; d[o+8]=nrm[0]; d[o+9]=nrm[1]; d[o+10]=nrm[2]; d[o+11]=a; }
  function emitLabel(x,y,z,cell,grp,pxH,yoff){ if(counts.label>=90) return; var n=counts.label++, d=IBD.label, o=n*12, uv=cellUV(cell); d[o]=x; d[o+1]=y; d[o+2]=z; d[o+3]=grp; d[o+4]=uv[0]; d[o+5]=uv[1]; d[o+6]=uv[2]; d[o+7]=uv[3]; d[o+8]=pxH; d[o+9]=yoff||0; d[o+10]=0; d[o+11]=0; }
  /* roost and dust. DUST: a few wide soft puffs, lit warm by the lights (the haze round a pack). CLUMPS: the roost proper: pellets of dirt
     thrown up and back by the rear tyre, ballistic (g = 9.81), bouncing on the ground, drawn as small lit pellets stretched along their
     velocity on screen; most of them near the lens (the quality level sets how many). */
  var parts={n:0,p:new Float32Array(400*10)}, CLN=13, CL={n:0,p:new Float32Array(600*CLN)};
  function spawn(x,y,z,vx,vy,vz,size,life,col){ if(parts.n>=QUAL[V.q].parts||parts.n>=400) return; var o=parts.n++*10, p=parts.p; p[o]=x;p[o+1]=y;p[o+2]=z;p[o+3]=vx;p[o+4]=vy;p[o+5]=vz;p[o+6]=size;p[o+7]=life;p[o+8]=life;p[o+9]=col; }
  function spawnClump(x,y,z,vx,vy,vz,size,life,gy,sand){ if(CL.n>=QUAL[V.q].clumps||CL.n>=600) return; var o=CL.n++*CLN, p=CL.p; p[o]=x;p[o+1]=y;p[o+2]=z;p[o+3]=vx;p[o+4]=vy;p[o+5]=vz;p[o+6]=size;p[o+7]=life;p[o+8]=life;p[o+9]=gy;p[o+10]=0.55+vrand()*0.6;p[o+11]=sand?1:0;p[o+12]=0; }
  /* the dirt a rear tyre throws: clumps by the roost amount (the nearer the lens and the more it matters, the more), a puff now and then */
  function roostFx(o,r,adv,boost){
    var dx=o.x-CAM.eye[0], dz=o.z-CAM.eye[2], d2=dx*dx+dz*dz; if(d2>75*75||o.v<1.5) return;
    var near=d2<16*16?1:d2<36*36?0.55:0.25, rate=o.roost*(60+200*boost)*near, n=rate*adv, k=Math.floor(n)+(vrand()<n-Math.floor(n)?1:0), i;
    var tx=o.tx, tz=o.tz, rx=-tz, rz=tx, rear=0.74+0.05, bx=o.x-tx*rear, bz=o.z-tz*rear, by=o.y+0.3, side=-clamp((o.k||0)*14,-1,1);
    for(i=0;i<k;i++){
      var back=2.2+vrand()*7.0, up=1.2+vrand()*4.2, sd=(vrand()-0.5)*3.4+side*(1.2+vrand()*2.2), big=vrand()<0.08;
      spawnClump(bx+(vrand()-0.5)*0.22,by+vrand()*0.12,bz+(vrand()-0.5)*0.22,tx*(o.v*0.28-back)+rx*sd,up+(o.air?0:0),tz*(o.v*0.28-back)+rz*sd,big?0.06+vrand()*0.04:(vrand()<0.55?0.012+vrand()*0.02:0.026+vrand()*0.04),0.9+vrand()*1.1,o.gl,o.sand);
    }
    if(vrand()<o.roost*adv*9*near) spawn(bx+(vrand()-0.5)*0.4,o.y+0.2,bz+(vrand()-0.5)*0.4,-tx*o.v*0.2+(vrand()-0.5)*1.4,0.6+vrand()*1.3,-tz*o.v*0.2+(vrand()-0.5)*1.4,0.35+vrand()*0.35,0.9+vrand()*0.7,o.sand?1:0);
  }
  /* a burst where a bike lands, the rider hits the ground, a crash digs in */
  function burstFx(x,y,z,gy,vx,vz,count,sand,power){
    var i; for(i=0;i<count;i++){ var a=vrand()*TAU, sp=(0.6+vrand()*3.2)*power;
      spawnClump(x+(vrand()-0.5)*0.8,gy+0.1,z+(vrand()-0.5)*0.8,Math.cos(a)*sp+vx,1.2+vrand()*3.8*power,Math.sin(a)*sp+vz,0.025+vrand()*0.05,0.8+vrand()*0.9,gy,sand); }
    for(i=0;i<Math.max(1,count>>2);i++) spawn(x+(vrand()-0.5)*1.2,gy+0.15,z+(vrand()-0.5)*1.2,(vrand()-0.5)*2.4+vx*0.3,0.5+vrand()*1.3,(vrand()-0.5)*2.4+vz*0.3,0.4+vrand()*0.5,1.0+vrand()*0.7,sand?1:0);
  }
  function stepParts(dt){
    var p=parts.p, n=0, i;
    for(i=0;i<parts.n;i++){ var o=i*10; p[o+7]-=dt; if(p[o+7]<=0) continue;
      p[o+4]-=9.81*dt*0.3; p[o+3]*=1-1.8*dt; p[o+5]*=1-1.8*dt; p[o+4]*=1-0.6*dt; p[o]+=p[o+3]*dt; p[o+1]+=p[o+4]*dt; p[o+2]+=p[o+5]*dt; if(p[o+1]<0&&!V.C.outdoor) p[o+1]=0;
      if(n!==i) for(var k=0;k<10;k++) p[n*10+k]=p[o+k]; n++; }
    parts.n=n;
    var d=IBD.part, dirt=SC.cols.dirt, sand=SC.cols.sand;
    for(i=0;i<n;i++){ var q=i*10, lf=p[q+7]/p[q+8], sz=p[q+6]*(1.5-lf*0.7), c=p[q+9]>0.5?sand:dirt;
      d[i*8]=p[q]; d[i*8+1]=p[q+1]; d[i*8+2]=p[q+2]; d[i*8+3]=sz; d[i*8+4]=c[0]*c[0]*1.5; d[i*8+5]=c[1]*c[1]*1.4; d[i*8+6]=c[2]*c[2]*1.3; d[i*8+7]=Math.min(1,lf*1.6)*0.3; }
    counts.part=n;
    /* the clumps */
    var cp=CL.p, m=0, cd=IBD.clump;
    for(i=0;i<CL.n;i++){ var u=i*CLN; cp[u+7]-=dt; if(cp[u+7]<=0) continue;
      cp[u+4]-=9.81*dt; cp[u+3]*=1-0.25*dt; cp[u+5]*=1-0.25*dt; cp[u]+=cp[u+3]*dt; cp[u+1]+=cp[u+4]*dt; cp[u+2]+=cp[u+5]*dt;
      var gyp=cp[u+9]; if(cp[u+1]<gyp+cp[u+6]*0.5&&cp[u+4]<0){ cp[u+1]=gyp+cp[u+6]*0.5; if(cp[u+12]>=2||-cp[u+4]<0.9){ cp[u+7]=Math.min(cp[u+7],0.2); cp[u+4]=0; cp[u+3]*=0.3; cp[u+5]*=0.3; } else { cp[u+4]=-cp[u+4]*0.34; cp[u+3]*=0.62; cp[u+5]*=0.62; cp[u+12]++; } }
      if(m!==i) for(var k2=0;k2<CLN;k2++) cp[m*CLN+k2]=cp[u+k2]; m++; }
    CL.n=m;
    for(i=0;i<m;i++){ var w=i*CLN, c2=cp[w+11]>0.5?sand:dirt, br=cp[w+10], la=cp[w+7]/cp[w+8], o2=i*12;
      cd[o2]=cp[w]; cd[o2+1]=cp[w+1]; cd[o2+2]=cp[w+2]; cd[o2+3]=cp[w+6];
      cd[o2+4]=c2[0]*c2[0]*br*0.75; cd[o2+5]=c2[1]*c2[1]*br*0.75; cd[o2+6]=c2[2]*c2[2]*br*0.75; cd[o2+7]=Math.min(1,la*5)*0.95;
      cd[o2+8]=cp[w+3]; cd[o2+9]=cp[w+4]; cd[o2+10]=cp[w+5]; cd[o2+11]=0.07; }
    counts.clump=m;
  }
  /* ---------- crashes (polish) ----------
     THE BIKE digs its front wheel in, falls on its side and cartwheels a full turn with two bounces, and slides to rest; THE RIDER is thrown
     over the bars on a ballistic arc (g = 9.81, a three-quarter forward flip), lands on his back, bounces, slides and stops, lies still, sits
     up, stands, walks back to the bike, bends and lifts it, remounts and rides off (a double-war loser), or lifts it and pushes it off the
     track and stands by it (a triple-war loser: OUT). Dust bursts where the bike and the rider hit the dirt. The phases keep the race model's
     times: on the bike again at 5.8 s and up to speed at dur, ending exactly where the time-gap model takes the rider back. */
  function crashPlan(cr){
    if(cr.plan) return cr.plan;
    var v=cr.v, vf=Math.min(0.85*v,11), vy=Math.min(2.3+0.06*v,3.4), h0=1.05, yl=0.17, g2=9.81;
    var tf=(vy+Math.sqrt(vy*vy+2*g2*(h0-yl)))/g2, vImp=vy-g2*tf, vb=Math.min(1.5,-vImp*0.26), tb=2*vb/g2, vs=vf*0.5, ts=vs/8, t0=0.12;
    return (cr.plan={t0:t0,vf:vf,vy:vy,h0:h0,yl:yl,tf:tf,vb:vb,tb:tb,vs:vs,ts:ts,tLand:t0+tf,tRest:t0+tf+tb+ts,acc:2*(1.2*v-0.55*v)/1.96,
      hits:[0.15,0.57,0.99,t0+tf,t0+tf+tb]});
  }
  /* the rider's distance from the crash point and his hip height above the dirt at t (ph: 0 on the bike, 1 in the air, 2 the bounce,
     3 sliding, 4 at rest) */
  function thrown(P,v,t,o){
    if(t<P.t0){ o.d=v*t; o.h=1.02; o.ph=0; o.u=0; return o; }
    var u=t-P.t0;
    if(u<P.tf){ o.d=v*P.t0+P.vf*u; o.h=P.h0+P.vy*u-4.905*u*u; o.ph=1; o.u=u/P.tf; return o; }
    u-=P.tf; var d1=v*P.t0+P.vf*P.tf;
    if(u<P.tb){ o.d=d1+P.vs*u; o.h=P.yl+P.vb*u-4.905*u*u; o.ph=2; o.u=u/P.tb; return o; }
    u-=P.tb; var d2=d1+P.vs*P.tb, us=Math.min(u,P.ts); o.d=d2+P.vs*us-4*us*us; o.h=P.yl; o.ph=u<P.ts?3:4; o.u=P.ts>0?us/P.ts:1; return o;
  }
  function angLerp(a,b,u){ var d=b-a; while(d>PI) d-=TAU; while(d<-PI) d+=TAU; return a+d*u; }
  var TH={}, LIE=PI/2+0.46;   /* LIE: the torso flat on its back (the mesh leans 0.46 forward in the riding pose) */
  function crashPose(r,T,o){
    var cr=r.crash, t=T-cr.T0, C=V.C, v=cr.v, side=cr.side, out=cr.kind==="out", P=crashPlan(cr);
    /* the bike: to rest by 1.1 s at 0.5 v (the rider flies on past it); a remount accelerates away from 5.8 s and is back at the field's
       speed and at D + 1.2 v at dur (7.2 s), where the time-gap model takes the rider back */
    var bt=Math.min(t,1.1), bD=cr.D+v*bt-0.5*(v/1.1)*bt*bt;
    if(!out&&t>5.8){ var ta=Math.min(t-5.8,1.4); bD+=0.5*P.acc*ta*ta; }
    var bLat=cr.lat+side*1.6*sstep(t/1.2)*(out?1:1-sstep((t-4.6)/1.2)*0.8);
    var pushU=out?sstep((t-5.4)/3.2):0, outPush=out?pushU*(C.hw[Math.round(((bD%C.L)+C.L)%C.L/C.DS)%C.N]+3.2-Math.abs(bLat))*side:0;
    ridePose(bD,bLat+outPush,o); o.air=false; o.y=TK.ground(C,o.s,bLat+outPush);
    var lift=sstep((t-4.6)/0.8), fall=side*(PI/2)*sstep((t-0.05)/0.45), spin=side*TAU*sstep((t-0.2)/1.0);
    var roll=fall*(1-lift)+spin+side*0.18*Math.sin(t*11)*Math.exp(-3*t);
    var dig=t<0.6?-0.75*Math.sin(clamp(t/0.6,0,1)*PI):0, bounce=t>0.15&&t<1.6?0.7*Math.abs(Math.sin(PI*(t-0.15)/0.42))*Math.exp(-2.2*(t-0.15)):0;
    var yaw=side*(0.7*sstep(t/1.2)*(1-lift*0.6)+(out?0.9*sstep((t-5.4)/1.0):0));
    /* keep the bike on top of the dirt whatever way up it is: lift it by its lowest corner (the bars 0.43 m out, the top 1.15 m up), and by
       the front wheel when its nose digs in */
    var sr=Math.abs(Math.sin(roll)), low=Math.min(-0.43*sr,1.15*Math.cos(roll)-0.43*sr);
    o.lean=roll; o.pitch=dig; o.v=!out&&t>5.8?P.acc*Math.min(t-5.8,1.4):0; o.y+=Math.max(0,-low)*0.8+0.74*Math.abs(Math.sin(dig))*0.85+bounce;
    var th=thrown(P,v,t,TH), rLat=cr.lat-side*0.9*sstep(t/1.6);
    var ph=t<P.tRest?"tumble":t<(out?2.8:2.6)?"lying":t<3.4?"up":t<4.6?"walk":t<5.8?(out?"push":"lift"):out?"push":"ride";
    return {bD:bD,bLat:bLat+outPush,rD:cr.D+th.d,rLat:rLat,ph:ph,t:t,yaw:yaw,lift:lift,th:th,P:P};
  }
  var FIG=new Float32Array(6), MB=new Float32Array(12), BP={}, BP2={};
  function feet(lx,ly,lz,rx,ry,rz){ FIG[0]=lx; FIG[1]=ly; FIG[2]=lz; FIG[3]=rx; FIG[4]=ry; FIG[5]=rz; return FIG; }
  function emitCrash(r,T,adv){
    var o=PO, cp=crashPose(r,T,o), C=V.C, M=bikeMats(o,r,cp.yaw), t=cp.t, cr=r.crash, side=cr.side, out=cr.kind==="out";
    r.obsB=r.obsB||{}; r.obsR=r.obsR||{}; r.obsB.D=cp.bD; r.obsB.lat=cp.bLat; r.obsR.D=cp.ph==="ride"?cp.bD:cp.rD; r.obsR.lat=cp.ph==="ride"?cp.bLat:cp.rLat;
    if(cp.ph!=="ride") r.obsF=V.fn;   /* (the pack steers round them next frame) */
    emitRider(r,o,M,cp.ph==="ride"?"ride":"lying");
    emitShadow(o.x,o.gl,o.z,o.tx,o.tz,UP,0.5,1);
    /* dust where the bike bounces and where the rider lands */
    if(adv>0&&!fx&&V.fxMode==="full"){ var last=r.cLast==null||r.cLast>t?t-adv:r.cLast, hits=cp.P.hits;
      for(var hi=0;hi<hits.length;hi++){ var h=hits[hi]; if(!(last<h&&t>=h)) continue; var onB=hi<3||!r.fig, bx=onB?o.x:r.fig[0], bz=onB?o.z:r.fig[2], by=onB?o.gl:r.fig[3];
        burstFx(bx,by+0.1,bz,by,0,0,onB?16:12,o.sand,1.4); } }
    r.cLast=t;
    if(cp.ph==="ride"){ emitRiderBody(r,M,0.2); r.fig=null; return o; }
    if(t>=5.8&&!out){ emitRiderBody(r,M,0); r.fig=null; return o; }
    var p=PO2, th=cp.th, P=cp.P, torso, F, fy;
    if(th.ph===0){ emitRiderBody(r,M,0); r.fig=null; return o; }   /* still on the bike as its front digs in */
    if(cp.ph==="tumble"||cp.ph==="lying"){
      ridePose(cp.rD,cp.rLat,p); fy=TK.ground(C,p.s,cp.rLat); var wobble=0;
      if(th.ph===1){ /* in the air: the whole body turns a three-quarter forward flip, knees tucked */
        var a=-(TAU-LIE)*th.u, ca=Math.cos(a), sa=Math.sin(a), kx=0.28, ky=-0.42;
        torso=a; F=feet(kx*ca-ky*sa,kx*sa+ky*ca,-0.17,kx*ca-ky*sa,kx*sa+ky*ca,0.17); }
      else { /* landed: on his back, the legs flop down; a little roll as he slides; then still */
        var b0=-(TAU-LIE), cb=Math.cos(b0), sb=Math.sin(b0), k=th.ph===2?sstep(th.u):1, lx=lerp(0.28*cb+0.42*sb,0.82,k), ly=lerp(0.28*sb-0.42*cb,-0.08,k);
        torso=LIE; F=feet(lx,ly,-0.2,lx,ly,0.2); wobble=th.ph===3?side*0.35*Math.sin(th.u*PI):0; }
      GL.frame(MB,p.x,fy+th.h,p.z,p.tx,0,p.tz,wobble); emitFigure(r,MB,torso,F); r.fig=[p.x,fy+th.h,p.z,fy];
      emitShadow(p.x,fy,p.z,p.tx,p.tz,UP,0.5*clamp(1-th.h/4,0.3,1),0.75); return o; }
    /* up: sit up, then stand; walk back to the bike; lift it (or push it off the track) */
    var tUp=out?2.8:2.6, hx, hz, hy, fdx, fdz, gw=null;
    ridePose(cp.rD,cp.rLat,p); var rx0=p.x, rz0=p.z;
    var bp=BP; ridePose(cp.bD,cp.bLat,bp); var bx=bp.x, bz=bp.z, rgx=-bp.tz, rgz=bp.tx;   /* the bike's spot and the track's right */
    var gOff=lerp(1.25,0.75,cp.lift), grab=out?-side:side, gx=bx+rgx*grab*gOff, gz=bz+rgz*grab*gOff;   /* where he stands to lift it: the bike's seat side */
    if(cp.ph==="up"){
      var u1=sstep((t-tUp)/0.45), u2=sstep((t-tUp-0.45)/(3.4-tUp-0.45));
      hx=rx0; hz=rz0; fdx=p.tx; fdz=p.tz; hy=lerp(P.yl,0.92,u2); torso=lerp(lerp(LIE,0.35,u1),0.25,u2);
      var fxp=lerp(lerp(0.82,0.6,u1),0.04,u2), fyp=lerp(-0.08,-hy+0.07,u2); F=feet(fxp,fyp,-0.16,fxp+0.06*(1-u2),fyp,0.16);
    } else {
      var step=0;
      /* he turns (never snaps) between facing: up the track (getting up), back to the bike (running), the bike's side (lifting), then the
         way the bike points (getting on, or pushing it off) */
      var aW=Math.atan2(gz-rz0,gx-rx0), aB=Math.atan2(-rgz*grab,-rgx*grab), ang;
      if(cp.ph==="walk"){ var u=sstep((t-3.4)/1.2), wl=lerp(cp.rLat,cp.bLat+grab*1.25,u), wp=BP2; ridePose(lerp(cp.rD,cp.bD,u),wl,wp); hx=wp.x; hz=wp.z; step=1; gw=TK.ground(C,wp.s,wl);
        ang=angLerp(Math.atan2(p.tz,p.tx),aW,sstep((t-3.4)/0.35)); }
      else if(!out){ /* lift: face the bike, bend down and lift it as it rises, then turn to it to get on */
        hx=gx; hz=gz; ang=angLerp(angLerp(aW,aB,sstep((t-4.6)/0.3)),Math.atan2(bp.tz,bp.tx),sstep((t-5.35)/0.4)); }
      else { /* push: beside the bike, walking it off the track the way it points */
        var cy=Math.cos(cp.yaw), sy=Math.sin(cp.yaw), ftx=bp.tx*cy-bp.tz*sy, ftz=bp.tx*sy+bp.tz*cy, mv=sstep((t-5.4)/0.4);
        hx=lerp(gx,bx-ftz*grab*0.78+ftx*0.25,mv); hz=lerp(gz,bz+ftx*grab*0.78+ftz*0.25,mv); step=t>5.6&&t<8.6?1:0;
        ang=angLerp(angLerp(aW,aB,sstep((t-4.6)/0.3)),Math.atan2(ftz,ftx),mv); }
      fdx=Math.cos(ang); fdz=Math.sin(ang);
      var ph2=(t-3.4)*9.5, sw=step?Math.sin(ph2):0, bend=cp.ph==="lift"||(out&&t<5.6)?(1-cp.lift)*sstep((t-4.6)/0.25):0;
      hy=0.92-0.03*Math.abs(sw)-0.16*bend; torso=lerp(0.22,-0.75,bend)+(out&&t>5.4?-0.2:0);
      F=feet(0.24*sw,-hy+0.06+0.08*Math.max(0,Math.cos(ph2))*step,-0.15,-0.24*sw+0.04*bend,-hy+0.06+0.08*Math.max(0,-Math.cos(ph2))*step,0.15);
    }
    var gy=gw!=null?gw:cp.ph==="up"?TK.ground(C,p.s,cp.rLat):TK.ground(C,bp.s,cp.bLat+(out&&t>5.4?0:grab*0.85));
    if(C.outdoor) gy=Math.max(gy,landAt(SC,hx,hz)-0.3); else gy=Math.max(0,gy);
    GL.frame(MB,hx,gy+hy,hz,fdx,0,fdz,0); emitFigure(r,MB,torso,F); r.fig=[hx,gy+hy,hz,gy];
    emitShadow(hx,gy,hz,fdx,fdz,UP,0.45,0.55);
    return o;
  }
  function parkAt(r,T){ var C=V.C, D=dAt(r,T)+3; r.park={D:D,lat:(r.lat>=0?1:-1)*(C.hw[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]+3.5),T:T}; }

  /* ---------- the frame ---------- */
  V.dtR=0;
  function update(dt){
    var C=V.C; if(!C) return;
    var sh=V.shot, adv=V.frozen?0:dt, rate=1, advP;
    if(V.rp){ rate=V.rp.rate; V.rp.t+=adv*rate; replayStep(); }
    advP=adv*(V.rp?V.rp.rate:1);
    V.dtR=advP;
    if(sh) sh.el+=adv;
    if(V.phase!=="pre") V.T+=adv;
    if(V.phase==="race"&&V.T>=lapEnd(V.lap)){ V.lap++; reserveLine(V.lap); }
    if(V.phase==="race"&&V.resLap<V.lap&&V.T>=lapEnd(V.lap)-5&&V.needSent!==V.lap){ V.needSent=V.lap; if(opt.onNeed) try{ opt.onNeed(V.lap); }catch(e){} }
    if(V.isLast&&V.T>=lapEnd(V.resLap)-6&&V.flag!=="checkered") V.flag="checkered";
    if(!V.rp) direct(); sh=V.shot;
    towerDraw();
    checkWaiters();
    if(sh&&sh.holeshot&&!sh.hsDone&&V.T>=sh.holeshot){ sh.hsDone=true; V.banners({kind:"holeshot"}); }
    if(V.crashT!=null&&V.T>=V.crashT+0.35&&!V.crashBanner){ V.crashBanner=true; var yr=V.yellow&&V.by[V.yellow.seat]; V.banners({kind:"crash",seat:yr?yr.s:-1,out:!!(yr&&yr.crash&&yr.crash.kind==="out")}); }
    /* the riders */
    var T=V.rp?V.rp.t:V.T, fieldN=0;
    PARTS.forEach(function(k){ counts[NCNT[k]]=0; }); counts.plate=0; counts.person=0; counts.label=0; counts.decal=0;
    /* the hero riders (the articulated models): the nearest few to the lens from the last frame, and the one on screen */
    var Qh=QUAL[V.q].hero, ord=V.riders.slice().sort(function(a,b){ return (a._d2!=null?a._d2:1e9)-(b._d2!=null?b._d2:1e9); }), fseat=V._fseat;
    for(var hi=0;hi<ord.length;hi++) ord[hi]._hero=(hi<Qh&&(ord[hi]._d2==null||ord[hi]._d2<HERO_D2))||ord[hi].s===fseat;
    V.riders.forEach(function(r){ r.mud=clamp(V.mudAmt+0.022*Math.max(0,V.lap-1)+(r.crash?0.25:0)+(r.mudJit||0),0,1); });
    poses.length=0;
    /* polish: the frame's entries are pooled per rider (no garbage each frame: steadier frames on a Fire TV) */
    var list=LIST; list.length=0;
    function ent(r,mode,D){ var e=r._le||(r._le={r:r}); e.mode=mode; e.D=D||0; e.hw=0; e.want=0; list.push(e); return e; }
    V.riders.forEach(function(r){
      if(r.park){ if(T>=r.park.T) { ent(r,"park"); return; } }
      if(r.crash&&T>=r.crash.T0&&T<r.crash.T0+r.crash.dur){ ent(r,"crash"); return; }
      if(r.crash&&r.crash.kind==="out"&&T>=r.crash.T0+r.crash.dur){ if(!r.park){ var cp=crashPose(r,r.crash.T0+r.crash.dur-0.01,PO); r.park={D:cp.bD,lat:cp.bLat,T:r.crash.T0+r.crash.dur,crashed:true}; } ent(r,"park"); return; }
      if(r.pull&&T>=r.pull.T0){ if(r.pull.D==null){ r.pull.D=dAt(r,r.pull.T0); r.pull.lat=r.lat; } if(T>=r.pull.T0+3){ if(!r.park) r.park={D:r.pull.D+12,lat:r.pull.lat+(r.pull.lat>=0?1:-1)*4,T:r.pull.T0+3}; ent(r,"park"); return; } ent(r,"pull"); return; }
      var D=V.phase==="pre"||T<0?-C.Lc:dAt(r,T); r.D=D; ent(r,"ride",D); fieldN++;
    });
    /* lanes: spread the riders across the track; a rider catching the one ahead swings out to pass; the gate slots funnel into turn 1 */
    var riding=RIDING; riding.length=0; for(var li=0;li<list.length;li++) if(list[li].mode==="ride") riding.push(list[li]); riding.sort(byD);
    /* (the gate slots funnel down the chute and the start straight: Dg = the distance from the gate) */
    var funL=C.funLen||C.startLen;
    riding.forEach(function(x){ var r=x.r, hw=hwAtD(x.D), Dg=x.D+C.Lc; x.hw=hw; x.want=r.lane*hw*0.6; x.fun=Dg<funL; if(Dg<funL*1.05){ var u=sstep(Dg/(funL*0.95)); x.want=lerp(gateLat(r)-offAtD(x.D),x.want,u); } });
    /* polish 2: the pack steers round a fallen bike and its rider (and a bike parked at the edge): a rider with one of them on his line within
       15 m ahead eases 2.1 m to the side with room (they used to ride straight through) */
    var OBS=OBSL; OBS.length=0; V.fn=(V.fn|0)+1;
    V.riders.forEach(function(r){ if(r.obsF===V.fn-1){ OBS.push(r.obsB,r.obsR); } else if(r.park&&T>=r.park.T) OBS.push({D:r.park.D,lat:r.park.lat}); });
    if(OBS.length) riding.forEach(function(x){ var lim=Math.max(0.5,x.hw-0.75);
      if(x.D<0) return;   /* (nobody falls on the start chute) */
      for(var q=0;q<OBS.length;q++){ var o=OBS[q], dD=o.D-x.D; dD-=Math.round(dD/C.L)*C.L; if(dD<-1.5||dD>15) continue;   /* (a lapped rider meets it too) */ var dl=x.want-o.lat; if(Math.abs(dl)>=2.1) continue;
        var tgt=dl>=0?o.lat+2.1:o.lat-2.1; if(Math.abs(tgt)>lim) tgt=dl>=0?o.lat-2.1:o.lat+2.1; var w=dD>4?clamp(1-(dD-4)/11,0,1):1; x.want=lerp(x.want,tgt,w); } });
    for(var it=0;it<3;it++) for(var a=0;a<riding.length;a++) for(var b=a+1;b<riding.length&&b<a+4;b++){ var A=riding[a], Bq=riding[b]; if(A.D-Bq.D>3.4) break; var dl=Bq.want-A.want;
      if(Math.abs(dl)<1.25){ var push=(1.25-Math.abs(dl))/2, sg=dl>=0?1:-1; A.want-=push*sg; Bq.want+=push*sg; } }
    var kl=V.cut?1:1-Math.exp(-adv/0.45);
    riding.forEach(function(x){ var r=x.r, lim=Math.max(0.5,x.hw-0.75); x.want=clamp(x.want,-lim-(x.fun?20:0),lim+(x.fun?20:0)); if(V.cut||!r.latOk){ r.lat=x.want; r.latOk=true; } else r.lat+=(x.want-r.lat)*kl; });
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
        var wy=0; if(o.air&&r.whip&&V.fxMode==="full"){ var fu=flightU(o.s); if(fu>=0){ var sw=Math.sin(PI*fu); wy=r.whip*sw; o.lean+=-r.whip*0.75*sw; } }
        if(V.phase==="pre"||T<0){ o.pitch=0.02+(V.phase==="pre"?Math.sin(vnow()/90+r.k)*0.006:0); o.lean=0; o.stand=0; o.v=V.phase==="pre"?0:o.v; }
        var M=bikeMats(o,r,wy);
        emitRider(r,o,M,"ride"); emitRiderBody(r,M,o.stand,o.air?-0.05:0,(V.phase==="pre"||T<0||o.air)?0:footOut(o),o.lean,o.comp);
        if(r.wasAir&&!o.air&&o.v>6&&adv>0&&!fx&&V.fxMode==="full") burstFx(o.x,o.y,o.z,o.gl,o.tx*o.v*0.15,o.tz*o.v*0.15,14,o.sand,1);
        if(o.air&&!r.wasAir) r.airT0=T; if(r.wasAir&&!o.air&&adv>0&&T-(r.airT0||T)>0.85&&(r.me||r.s===fseat)) pushEv("jump",r.airT0,T,r.s);
        r.wasAir=o.air;
        var h=o.y-o.gl, k=clamp(1-h/7,0.35,1);
        emitShadow(o.x,o.gl,o.z,o.tx,o.tz,UP,0.72*k,0.9+0.6*(1-k));
        pose(r,o.x,o.y,o.z,o.tx,o.tz,o.v,o.air,x.D,false,false,false,null,o);
        if(adv>0&&!fx&&V.fxMode==="full"&&o.roost>0.08&&!o.air) roostFx(o,r,advP,r.s===fseat?1:0);
      } else if(x.mode==="crash"){ var oc=emitCrash(r,T,advP); pose(r,oc.x,oc.y,oc.z,oc.tx,oc.tz,0,false,r.crash.D,true,false,false,r.fig,oc);
        if(adv>0&&T-r.crash.T0<1.4&&!fx&&V.fxMode==="full"&&vrand()<0.45) burstFx(oc.x,oc.y,oc.z,oc.gl,0,0,6,oc.sand,1.3); }
      else if(x.mode==="park"){ var pk=r.park;
        if(pk.crashed&&r.crash){ var op=emitCrash(r,r.crash.T0+r.crash.dur-0.01,0); pose(r,op.x,op.y,op.z,op.tx,op.tz,0,false,pk.D,false,true,true,null,op); return; }
        ridePose(pk.D,pk.lat,o); o.air=false; o.y=TK.ground(C,o.s,pk.lat); o.lean=0; o.pitch=0; var Mp=bikeMats(o,r,0.5); emitRider(r,o,Mp,"lying");
        emitRiderBody(r,Mp,0); emitShadow(o.x,o.y,o.z,o.tx,o.tz,UP,0.45,1);
        pose(r,o.x,o.y,o.z,o.tx,o.tz,0,false,pk.D,false,true,!!pk.crashed||r.out,null,o); }
    });
    /* people: the flagger, the yellow-flag marshal */
    counts.person=0;
    var FG=SC.flagger;
    GL.local(B12,FG.x,FG.y,FG.z,0,FG.yaw,0,1); putInst(IBD.person,counts.person++,B12,[0.12,0.13,0.16],[1,1,1]);
    var marshal=null;
    if(V.yellow&&V.T>=V.yellow.T0&&(V.yellow.until!=null?V.T<V.yellow.until:V.lap<=V.yellow.lap)){
      if(!V.yellow.m){ var ys=V.yellow.ms!=null?V.yellow.ms:V.yellow.s, yi=Math.round(ys/C.DS)%C.N, side=sideClear(C,ys,1,C.hw[yi]+2.5)>sideClear(C,ys,-1,C.hw[yi]+2.5)?1:-1, lat=side*(C.hw[yi]+2.2), mx=C.x[yi]-C.tz[yi]*lat, mz=C.z[yi]+C.tx[yi]*lat;
        V.yellow.m={x:mx,y:C.outdoor?TK.ground(C,ys,lat)-0.1:0,z:mz,yaw:Math.atan2(side*C.tx[yi],side*C.tz[yi])}; }
      marshal=V.yellow.m; GL.local(B12,marshal.x,marshal.y,marshal.z,0,marshal.yaw,0,1); putInst(IBD.person,counts.person++,B12,[0.95,0.55,0.12],[1,1,1]); }
    if(SC.crowd) SC.crowd.forEach(function(p){ if(counts.person<127){ GL.local(B12,p.x,p.y,p.z,0,-p.yaw,0,1); putInst(IBD.person,counts.person++,B12,p.col,[1,1,1]); } });
    V.marshal=marshal;
    /* the gate: down once it has dropped */
    var gA=V.dropT==null||T<0?0:Math.min(1.45,sstep(T/0.32)*1.45+Math.sin(clamp(T/0.32,0,1)*PI)*0.05);
    var GF=gateF(C); GL.frame(A12,GF.x+GF.tx*1.2,GF.E,GF.z+GF.tz*1.2,GF.tx,0,GF.tz,0);
    GL.amul(B12,A12,GL.local(L12,0,0,GF.off,gA,0,0,1)); putInst(IBD.gate,0,B12,[1,1,1],[1,1,1]);
    if(adv>0&&V.fxMode==="full"&&!fx) stepParts(advP); else if(adv>0){ parts.n=0; counts.part=0; CL.n=0; counts.clump=0; }
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
    var d=IBDf, n=0, t=vnow()/1000;
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
  /* ---------- the camera presets (11_SKIN_DESIGN_TOKENS.json "camera_presets", 12_COPY_PASTE_PROMPT_FOR_CLAUDE_CODE.txt "CAMERAS") ----------
     chase (the DEFAULT, the cover): 3.5 m behind and 1.5 m above the rider, 70 degrees vertical, damped follow, a soft landing shake;
     broadcast: the TV director (trackside, 7 m up at 22 m, 48 degrees, smooth pans across passes, cuts to the featured moments);
     grandstand: high in the stands, the whole course and every rider in true proportion, 50 degrees; onboard: the bars, 82 degrees,
     stabilised; replay: low 3/4 rear and jump side profiles in slow motion (the race clock keeps running underneath). */
  var DEG=PI/180;
  var PRESET={chase:{name:"Cover chase",back:3.5,up:1.5,fov:70*DEG},broadcast:{name:"Broadcast trackside",h:7,dist:22,fov:48*DEG},grandstand:{name:"Grandstand",fov:50*DEG},onboard:{name:"Onboard",fov:82*DEG},replay:{name:"Replay",fov:48*DEG}};
  V.PRESET=PRESET; V.mode="chase"; V.focus=-1;
  var CH={init:false,f:-1,ex:0,ey:0,ez:0,tx:0,ty:0,tz:0,gy:0,roll:0,fov:70*DEG,shk:0,shT:9,lastY:0,wasAir:false,vy:0,dolly:1,cr:0,sx:0,sz:0,side:1,ph:0,snap:true};
  V.setCamera=function(m){ if(!PRESET[m]) return false; if(V.mode!==m){ if(m==="replay") V.prevMode=V.mode; if(V.rp&&m!=="replay"){ V.rp=null; V.shot=null; } V.mode=m; CAM.se=null; CAM.st=null; CAM.near=0; V.cut=true; CH.init=false; OB.init=false; if(m==="broadcast") V.shot=null; if(m==="replay") startReplay(); if(V.onCamera) try{ V.onCamera(m); }catch(e){} } return true; };
  V.camera=function(){ return V.mode; };
  V.cameraName=function(m){ return (PRESET[m||V.mode]||PRESET.chase).name; };
  V.cycleCamera=function(dir){ var order=["chase","broadcast","grandstand","onboard","replay"], i=order.indexOf(V.mode); V.setCamera(order[(i+(dir<0?-1:1)+order.length)%order.length]); return V.mode; };
  V.setFocus=function(s){ V.focus=(s==null?-1:s|0); CH.init=false; };
  V.focusSeat=function(){ var f=focusPose(); return f?f.r.s:-1; };
  /* who the follow cameras stay on: a chosen rider, else a person (You), else the best battle, a featured pass or a crash, else the leader */
  var AF={s:-1,until:0};
  function focusPose(){
    var s=V.focus, p;
    if(s>=0){ p=riderPos(s); if(p) return p; }
    var you=meSeat(); if(you>=0){ p=riderPos(you); if(p&&!p.parked) return p; }
    var T=V.T, want=-1;
    if(V.pass&&T>=V.pass.t0-1.0&&T<V.pass.t1+2.2) want=V.pass.w;
    V.riders.forEach(function(r){ if(want<0&&r.crash&&T>=r.crash.T0-0.4&&T<r.crash.T0+Math.min(r.crash.dur,7)) want=r.s; });
    if(want>=0){ p=riderPos(want); if(p){ AF.s=want; AF.until=T+2.5; return p; } }
    if(AF.s>=0&&T<AF.until){ p=riderPos(AF.s); if(p&&!p.parked) return p; }
    var pair=closePair(); if(pair){ p=riderPos(pair[0]); if(p){ AF.s=pair[0]; AF.until=T+7; return p; } }
    var best=null; poses.forEach(function(q){ if(!q.parked&&(!best||q.D>best.D)) best=q; });
    if(best){ AF.s=best.r.s; AF.until=T+4; } return best;
  }
  /* the chase: on the track 3.5 m behind the rider (round the bends, not cutting them), 1.5 m up, aimed down the line ahead of him */
  var CHP={}, CHQ={}, CHQ2={};
  function chaseCam(dt){
    var f=focusPose(); if(!f) return false; V._fseat=f.r.s;
    var C=V.C, P=PRESET.chase, r=f.r, por=V.H>V.W*1.05, T=V.T, cr=!!f.crash, still=f.parked;
    if(!CH.init||CH.f!==r.s){ CH.init=true; CH.f=r.s; CH.snap=true; }
    var k=function(tau){ return CH.snap?1:1-Math.exp(-dt/tau); };
    /* a crash: further back, higher, off the racing line so the pack goes by without passing through the lens */
    CH.cr+=((cr||still?1:0)-CH.cr)*k(0.5);
    if(V.phase==="pre"||T<0) CH.dolly=1+0.32*clamp(1-(T+3)/3,0,1)*(T>-3?1:0); else CH.dolly+=(1-CH.dolly)*k(0.6);
    var back=(P.back*(por?1.16:1)*CH.dolly)+1.7*CH.cr, upH=P.up+0.35*CH.cr+(por?0.25:0);
    var D=f.D, useD=D-back, o=CHP, gyc, ex, ez, tx0, tz0, lat=r.lat||0;
    if(f.parked&&r.park){ D=r.park.D; useD=D-back; lat=r.park.lat; }
    var hwC=C.hw[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]||4, latC=clamp(lat*0.9,-(hwC-1.3),hwC-1.3); if(CH.cr>0.01){ var edge=(C.hw[Math.round(((D%C.L)+C.L)%C.L/C.DS)%C.N]||4)+2.4; latC=lerp(latC,(lat>=0?1:-1)*edge,CH.cr*0.85); }
    if(C.Lc&&useD<-C.Lc){ tx0=f.tx; tz0=f.tz; ex=f.x-tx0*back; ez=f.z-tz0*back; gyc=f.gl!=null?f.gl:f.y; }
    else { ridePose(useD,latC,o); ex=o.x; ez=o.z; gyc=o.gl; tx0=o.tx; tz0=o.tz; }
    /* the look-ahead: the line 9 m on (more at speed), so the view leans into the bend before the bike does */
    var kap=Math.abs(f.k||0), ahead=clamp((9+Math.min(f.v||0,22)*0.22)/(1+kap*22),3.2,13), o2=CHQ, tgx, tgz, tgy;
    if(cr){ var fg=f.fig, mx=fg?(f.x+fg[0])/2:f.x, mz=fg?(f.z+fg[2])/2:f.z, my=fg?(f.y+fg[3])/2:f.y; tgx=mx; tgz=mz; tgy=my+0.7; }
    else if(C.Lc&&D+ahead<-C.Lc){ tgx=f.x+f.tx*ahead; tgz=f.z+f.tz*ahead; tgy=(f.gl!=null?f.gl:f.y)+0.9; }
    else { ridePose(D+ahead,lat*0.8,o2); tgx=lerp(f.x,o2.x,0.62); tgz=lerp(f.z,o2.z,0.62); tgy=lerp(f.y,o2.gl,0.45)+0.85; if(f.air) tgy=f.y+0.2; }
    /* heights: the ground under the camera is smoothed (whoops don't shake the view), a little of the bike's height in the air */
    var airH=Math.max(0,f.y-(f.gl!=null?f.gl:f.y));
    if(CH.snap) CH.gy=gyc; else CH.gy+=(gyc-CH.gy)*k(gyc>CH.gy?0.1:0.3);
    var ey=CH.gy+upH+0.34*airH;
    /* the boom: three points of the line between the lens and the rider; the lens rises until each is 0.5 m clear of the dirt */
    if(!(C.Lc&&useD<-C.Lc)){ var ty0=f.y+0.95, bo=CHQ2; for(var bi=1;bi<=3;bi++){ var tt=bi*0.25; ridePose(D-back*(1-tt),lerp(latC,lat,tt),bo);
        var need=(bo.gl+0.5-ty0*tt)/(1-tt); if(need>ey) ey=need; } }
    if(C.outdoor){ var gl2=landAt(SC,ex,ez)+0.7; if(ey<gl2) ey=gl2; }
    /* the landing: a short soft shake (bounded) and a small push of the lens; a little vibration at speed (not with reduced motion) */
    var vy=CH.snap?0:(f.y-CH.lastY)/Math.max(dt,1e-3); CH.lastY=f.y;
    var mo=motion()==="full"&&!fx?1:0.25;
    if(CH.wasAir&&!f.air&&!cr){ CH.shk=clamp(Math.max(0,-CH.vy)*0.0075,0.004,0.05)*mo; CH.shT=0; CH.sx=vrand()*2-1; CH.sz=vrand()*2-1; }
    CH.wasAir=!!f.air; if(f.air) CH.vy=vy; else CH.vy=0;
    CH.shT+=dt; var dec=Math.exp(-CH.shT*7.5), sk=CH.shk*dec*Math.sin(CH.shT*34);
    var vib=(f.air||still?0:Math.min(1,(f.v||0)/20))*0.004*mo*Math.sin(T*61);
    ey+=sk+vib; ex+=CH.sx*sk*0.7; ez+=CH.sz*sk*0.7;
    /* smooth: horizontally tight (the path is already smooth), the look-at a little looser; a cut (a new rider) snaps */
    var ke=k(0.07), kt=k(0.16);
    if(CH.snap){ CH.ex=ex; CH.ey=ey; CH.ez=ez; CH.tx=tgx; CH.ty=tgy; CH.tz=tgz; } else {
      CH.ex+=(ex-CH.ex)*ke; CH.ez+=(ez-CH.ez)*ke; CH.ey+=(ey-CH.ey)*k(0.1); CH.tx+=(tgx-CH.tx)*kt; CH.ty+=(tgy-CH.ty)*k(0.2); CH.tz+=(tgz-CH.tz)*kt; }
    /* roll with the lean (a fraction, as a camera operator rolls into the bend), the field of view opening with speed and in the air */
    var roll=clamp(-(f.lean||0)*0.14,-0.14,0.14)*mo, fov=(P.fov+(Math.min(f.v||0,24)/24)*2.2*DEG+(f.air?2.4*DEG:0)-(CH.shT<0.3?2.6*DEG*mo*Math.exp(-CH.shT*10)*Math.min(1,CH.shk*60):0))-6*DEG*CH.cr;
    CH.roll+=(roll-CH.roll)*k(0.3); CH.fov+=(fov-CH.fov)*k(0.25);
    CAM.eye=[CH.ex,CH.ey,CH.ez]; CAM.tgt=[CH.tx,CH.ty,CH.tz]; CAM.fov=CH.fov; CAM.close=true; CAM.roll=CH.roll; CAM.se=null; CAM.st=null;
    CAM.focus=[f.x,(f.gl!=null?f.gl:f.y)+0.9,f.z]; CAM.sRad=13; CAM.dof=1;
    var cx=CH.tx-CH.ex, cz=CH.tz-CH.ez, cl=Math.hypot(cx,cz)||1, rx=cz/cl, rz=-cx/cl;
    CAM.up=[rx*Math.sin(CH.roll),Math.cos(CH.roll),rz*Math.sin(CH.roll)];
    CH.snap=false; V.cut=false; return true;
  }
  /* the grandstand: high in the upper deck on the long side, the whole course in view (set up with the scene) */
  function grandCam(dt){
    var G0=SC.grand; if(!G0) return false;
    var u=vnow()/1000*0.05;
    CAM.eye=[G0.eye[0]+Math.sin(u)*G0.sway,G0.eye[1]+Math.sin(u*1.3)*0.25,G0.eye[2]+Math.cos(u*0.8)*G0.sway*0.4]; CAM.tgt=G0.tgt.slice(); CAM.fov=G0.fov; CAM.close=false; CAM.up=null; CAM.roll=0; CAM.se=null; CAM.st=null; CAM.focus=G0.tgt.slice(); CAM.sRad=0; CAM.dof=0;
    return true;
  }
  /* ---------- the onboard camera: on the bars, stabilised (the roll a third of the bike's, the heading eased), 82 degrees ---------- */
  var OB={init:false,hx:1,hz:0,roll:0,fovs:0}, OB12=new Float32Array(12);
  function onboardCam(dt){
    var f=focusPose(); if(!f) return false; V._fseat=f.r.s;
    var cp=Math.cos(f.pitch||0), fx=f.tx*cp, fy=Math.sin(f.pitch||0), fz=f.tz*cp, mo=motion()==="full"&&!fx0?1:0.3;
    if(!OB.init||OB.f!==f.r.s){ OB.init=true; OB.f=f.r.s; OB.hx=f.tx; OB.hz=f.tz; OB.roll=f.lean||0; }
    var k=1-Math.exp(-dt/0.08); OB.hx+=(f.tx-OB.hx)*k; OB.hz+=(f.tz-OB.hz)*k; OB.roll+=((f.lean||0)*0.32-OB.roll)*(1-Math.exp(-dt/0.2));
    GL.frame(OB12,f.x,f.y,f.z,fx,fy,fz,f.lean||0);
    var M0=OB12, lx=0.52, ly=1.3, vib=(f.air||f.parked?0:Math.min(1,(f.v||0)/20))*0.006*mo;
    var ex=M0[0]*lx+M0[1]*ly+M0[3], ey=M0[4]*lx+M0[5]*ly+M0[7]+Math.sin(V.T*53)*vib, ez=M0[8]*lx+M0[9]*ly+M0[11];
    /* the view: along the track's heading with a share of the bike's pitch, tilted down a little; the up vector rolled by the stabilised roll */
    var hl=Math.hypot(OB.hx,OB.hz)||1, dx=OB.hx/hl, dz=OB.hz/hl, pitch=(f.pitch||0)*0.55-0.06;
    CAM.eye=[ex,ey,ez]; CAM.tgt=[ex+dx*20*Math.cos(pitch),ey+20*Math.sin(pitch),ez+dz*20*Math.cos(pitch)]; CAM.fov=PRESET.onboard.fov+(f.air?3*DEG:0); CAM.close=true; CAM.near=0.12;
    CAM.up=[dz*Math.sin(OB.roll)*-1,Math.cos(OB.roll),dx*Math.sin(OB.roll)]; CAM.roll=OB.roll; CAM.se=null; CAM.st=null; CAM.focus=[f.x,f.gl!=null?f.gl+0.9:f.y,f.z]; CAM.sRad=14; CAM.dof=0.25;
    return true;
  }
  var fx0=fx;
  /* ---------- the REPLAY: the race clock keeps running underneath; the riders are drawn at an earlier time (V.rp.t) in slow motion from a low
     3/4 rear angle (a crash, a pass) or a side profile (a jump), twice, then back to the camera it came from ---------- */
  V.events=[]; V.rp=null;
  function pushEv(kind,T0,T1,s,extra){ if(V.rp) return; var e={kind:kind,T:T0,T1:T1,s:s}; if(extra) for(var q in extra) e[q]=extra[q]; V.events.push(e); if(V.events.length>40) V.events.shift(); }
  V.replayInfo=function(){ return V.rp?{kind:V.rp.kind,t:+V.rp.t.toFixed(2),t0:+V.rp.t0.toFixed(2),t1:+V.rp.t1.toFixed(2),rate:V.rp.rate,loops:V.rp.loops}:null; };
  function startReplay(){
    var T=V.T, pick=null, i;
    for(i=V.events.length-1;i>=0;i--){ var e=V.events[i]; if(e.T1<T-0.4&&e.T>0){ pick=e; break; } }
    var t0,t1,shot;
    if(pick){ t0=Math.max(0,pick.T-(pick.kind==="jump"?1.6:pick.kind==="pass"?2.5:2)); t1=Math.min(T-0.3,pick.T1+(pick.kind==="crash"?3.2:2)); }
    else { var f=focusPose(); pick={kind:"chase",s:f?f.r.s:0}; t0=Math.max(0,T-9); t1=Math.max(t0+2,T-0.8); }
    var mode=pick.kind==="jump"?"side":"rear";
    V.rp={t:t0,t0:t0,t1:t1,rate:0.38,loops:0,kind:pick.kind,s:pick.s,mode:mode,side:(pick.s%2)?1:-1,from:V.prevMode||"chase"};
    V.shot=null; CAM.se=null; CAM.st=null; V.cut=true; CH.init=false;
    setShot({kind:"rep",focus:pick.s,mode:mode,side:V.rp.side,d:1e9});
  }
  function replayStep(){
    var R0=V.rp; if(!R0) return;
    if(R0.t>=R0.t1){ R0.loops++; if(R0.loops>=2){ var back=R0.from||"chase"; V.rp=null; V.mode=back; CAM.se=null; CAM.st=null; V.cut=true; CH.init=false; V.shot=null; if(V.onCamera) try{ V.onCamera(back); }catch(e){} return; }
      R0.t=R0.t0; V.cut=true; CAM.se=null; CAM.st=null; }
  }
  /* ---------- the grandstand camera: the upper deck on the long side, the whole course in true proportion ---------- */
  function fitGrand(eye,tgt,pts,fov0){
    var fw=[tgt[0]-eye[0],tgt[1]-eye[1],tgt[2]-eye[2]], fl=Math.hypot(fw[0],fw[1],fw[2]); fw[0]/=fl; fw[1]/=fl; fw[2]/=fl;
    var rx=-fw[2], rz=fw[0], rl=Math.hypot(rx,rz)||1; rx/=rl; rz/=rl; var ux=-fw[1]*rx, uy=fw[0]*rx+fw[2]*rz, uz=-fw[1]*rz;   /* up = right x forward */
    var tH=0, tV=0;
    pts.forEach(function(p){ var vx=p[0]-eye[0], vy=p[1]-eye[1], vz=p[2]-eye[2], cx=vx*rx+vz*rz, cy=vx*ux+vy*uy+vz*uz, cz=vx*fw[0]+vy*fw[1]+vz*fw[2]; if(cz<1) return; tH=Math.max(tH,Math.abs(cx/cz)); tV=Math.max(tV,Math.abs(cy/cz)); });
    var a=16/9, need=Math.max(tV,tH/a), fov=2*Math.atan(need*1.1);
    return Math.max(fov0,Math.min(fov,66*DEG));
  }
  function grandSpot(C,S){
    if(C.outdoor){ var R0=S.radius; S.grand={eye:[S.centre[0]+R0*0.15,R0*0.7,S.centre[2]+R0*1.2],tgt:[S.centre[0],0,S.centre[2]],fov:50*DEG,sway:4}; return; }
    var f=S.floor, wx=f.x1-f.x0, wz=f.z1-f.z0, cx=(f.x0+f.x1)/2, cz=(f.z0+f.z1)/2, dOut=39.5, eyeH=30.8, eye, side=C.fside>0?-1:1;
    if(wx>=wz) eye=[cx,eyeH,side>0?f.z1+dOut:f.z0-dOut]; else eye=[side>0?f.x1+dOut:f.x0-dOut,eyeH,cz];
    var bx=(S.box.x0+S.box.x1)/2, bz=(S.box.z0+S.box.z1)/2, dh=Math.hypot(bx-eye[0],bz-eye[2]), tgt=[bx,eye[1]-dh*Math.tan(9*DEG),bz], pts=[];
    [[S.box.x0,S.box.z0],[S.box.x1,S.box.z0],[S.box.x1,S.box.z1],[S.box.x0,S.box.z1],[bx,S.box.z0],[bx,S.box.z1],[S.box.x0,bz],[S.box.x1,bz]].forEach(function(q){ pts.push([q[0],0,q[1]]); pts.push([q[0],3,q[1]]); });
    var fov=fitGrand(eye,tgt,pts,50*DEG);
    S.grand={eye:eye,tgt:tgt,fov:fov,sway:1.2,fitted:+(fov/DEG).toFixed(1)};
  }
  function camera(dt){
    var done=false;
    if(V.mode==="chase") done=chaseCam(dt);
    else if(V.mode==="grandstand") done=grandCam(dt);
    else if(V.mode==="onboard") done=onboardCam(dt);
    if(!done) directorCamera(dt);
    if(V.free){ CAM.eye=V.free.eye; CAM.tgt=V.free.tgt; CAM.fov=V.free.fov||0.9; CAM.close=V.free.close!==false; CAM.up=V.free.up||null; CAM.roll=0; CAM.focus=V.free.focus||V.free.tgt; CAM.sRad=V.free.sRad!=null?V.free.sRad:12; CAM.dof=V.free.dof!=null?V.free.dof:0.5; }
  }
  function directorCamera(dt){
    var C=V.C, S=SC, sh=V.shot||{kind:"heli",el:0}, lead=riderPos(V.leadS)||poses.filter(function(p){ return !p.parked; })[0], fov=0.9, close=false;
    var focus=sh.focus!=null&&sh.focus>=0?riderPos(sh.focus):null; if(!focus) focus=lead;
    var u=sh.el||0;
    switch(sh.kind){
      case "heli": { var a=0.35+u*0.08+(V.rot*0.7), R0=S.radius*1.25, cx=S.centre; EYE[0]=cx[0]+Math.cos(a)*R0; EYE[1]=(C.outdoor?S.radius*0.55:42)+cx[1]; EYE[2]=cx[2]+Math.sin(a)*R0; TGT[0]=cx[0]; TGT[1]=cx[1]; TGT[2]=cx[2]; fov=0.95; break; }
      case "gate": { var G=S.gate, Tn=V.T; EYE[0]=G.x; EYE[1]=G.y; EYE[2]=G.z;
        var GG=gateF(C), gc=[GG.x-GG.tz*GG.off,GG.E+0.7,GG.z+GG.tx*GG.off];
        if(Tn>0.4&&lead){ var w2=sstep((Tn-0.4)/1.2); TGT[0]=lerp(gc[0],lead.x,w2); TGT[1]=lerp(gc[1],lead.y+0.6,w2); TGT[2]=lerp(gc[2],lead.z,w2); fov=lerp(0.5,0.42,w2); }
        else { TGT[0]=gc[0]; TGT[1]=gc[1]; TGT[2]=gc[2]; fov=0.5; } close=true; break; }
      case "chase": { var f=focus||lead; if(!f) break;
        /* polish: a cable-cam follow, higher and further back, its heading eased so it doesn't whip round every turn */
        if(sh.hx==null||sh.f!==f.r.s){ sh.hx=f.tx; sh.hz=f.tz; sh.f=f.r.s; } else { var kh=1-Math.exp(-dt/0.5); sh.hx+=(f.tx-sh.hx)*kh; sh.hz+=(f.tz-sh.hz)*kh; }
        var hl=Math.hypot(sh.hx,sh.hz)||1, hx=sh.hx/hl, hz=sh.hz/hl, crowd=0;
        for(var pi=0;pi<poses.length;pi++){ var pq=poses[pi]; if(pq!==f&&!pq.parked&&pq.D<f.D-1&&pq.D>f.D-13) crowd=1; }
        if(sh.up==null) sh.up=crowd; else sh.up+=(crowd-sh.up)*(1-Math.exp(-dt/0.8));
        /* polish 2: closer and lower (the rider was a speck 13 m ahead and 6 m below): 8.5 m back and 3.6 m up, lifting over a rider in between;
           the track ahead stays in the top of the frame */
        var por=V.H>V.W*1.05, back=(8.6-1.4*sh.up)*(por?0.9:1), upH=3.6+2.8*sh.up;
        /* (on the track behind him, round the bend: in a hairpin a camera straight behind his eased heading ended up beside him, looking down) */
        var bD=f.D-back*1.05; if(f.r&&f.r.lat!=null&&bD>-C.Lc){ ridePose(bD,f.r.lat*0.7,CHP); var ex=CHP.x-f.x, ez=CHP.z-f.z, el=Math.hypot(ex,ez)||1; ex=ex/el*back; ez=ez/el*back; EYE[0]=f.x+ex; EYE[2]=f.z+ez; hx=-ex/back; hz=-ez/back; }
        else { EYE[0]=f.x-hx*back; EYE[2]=f.z-hz*back; }
        EYE[1]=f.y+upH; TGT[0]=f.x+f.tx*7.5; TGT[1]=f.y+0.55; TGT[2]=f.z+f.tz*7.5; fov=0.78; close=true;
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
        /* polish: frame the bike AND the thrown rider (their midpoint, wide enough for both) */
        if(f4){ var fg=f4.fig, mxx=fg?(f4.x+fg[0])/2:f4.x, myy=fg?(f4.y+fg[3])/2:f4.y, mzz=fg?(f4.z+fg[2])/2:f4.z, spread=fg?Math.hypot(fg[0]-f4.x,fg[2]-f4.z):0;
          TGT[0]=mxx; TGT[1]=myy+0.5; TGT[2]=mzz; var dd2=Math.hypot(mxx-sp3.x,mzz-sp3.z); fov=clamp(2*Math.atan((4.6+spread*0.55)/Math.max(1,dd2)),0.3,1.0); } close=true; break; }
      case "rep": { var fr=focus||lead; if(!fr) break; var sd2=sh.side||1, rx2=-fr.tz, rz2=fr.tx, hgt=fr.gl!=null?fr.gl:fr.y;
        if(sh.mode==="side"){ EYE[0]=fr.x+rx2*13*sd2-fr.tx*1.5; EYE[1]=hgt+1.3; EYE[2]=fr.z+rz2*13*sd2-fr.tz*1.5; TGT[0]=fr.x+fr.tx*1.2; TGT[1]=fr.y+0.7; TGT[2]=fr.z+fr.tz*1.2; fov=0.5; }
        else { EYE[0]=fr.x-fr.tx*5.4+rx2*2.7*sd2; EYE[1]=hgt+1.05+Math.max(0,(fr.y-hgt))*0.4; EYE[2]=fr.z-fr.tz*5.4+rz2*2.7*sd2; TGT[0]=fr.x+fr.tx*1.4; TGT[1]=fr.y+0.85; TGT[2]=fr.z+fr.tz*1.4; fov=PRESET.replay.fov; }
        close=true; if(C.outdoor){ var gy3=landAt(S,EYE[0],EYE[2])+0.9; if(EYE[1]<gy3) EYE[1]=gy3; } break; }
      case "line": { var L=S.line, f5=lead, FG2=S.flagger, LA=S.lineAim, bx2=(LA[0]+FG2.x)/2, by2=(LA[1]+FG2.y+0.7)/2, bz2=(LA[2]+FG2.z)/2; EYE[0]=L.x; EYE[1]=L.y; EYE[2]=L.z;
        /* aim between the line and the flagger; the leader pulls the aim his way as he comes up to the line */
        if(f5){ var dl=Math.hypot(f5.x-LA[0],f5.z-LA[2]), w3=clamp(1-dl/45,0,1)*0.45; TGT[0]=lerp(bx2,f5.x,w3); TGT[1]=lerp(by2,f5.y+0.8,w3); TGT[2]=lerp(bz2,f5.z,w3); } else { TGT[0]=bx2; TGT[1]=by2; TGT[2]=bz2; }
        fov=0.64; close=true; break; }
    }
    /* a phone held upright shows more height: lift the camera and aim it lower so the track, not the roof, fills the frame */
    if(V.H>V.W*1.05&&sh.kind!=="heli"&&sh.kind!=="wide"){ var up=sh.kind==="chase"?1.1:sh.kind==="gate"?1.4:1.2; EYE[1]+=up; TGT[1]-=0.45; }
    /* smoothing inside a shot (reset on every cut) */
    if(!CAM.se||!CAM.st){ CAM.se=EYE.slice(); CAM.st=TGT.slice(); CAM.fv=fov; V.cut=true; }
    else { var ke=1-Math.exp(-dt/0.22), kt=1-Math.exp(-dt/0.12); for(var i=0;i<3;i++){ CAM.se[i]+=(EYE[i]-CAM.se[i])*ke; CAM.st[i]+=(TGT[i]-CAM.st[i])*kt; } CAM.fv+=(fov-CAM.fv)*ke; }
    CAM.eye=CAM.se; CAM.tgt=CAM.st; CAM.fov=CAM.fv; CAM.close=close; CAM.up=null; CAM.roll=0;
    CAM.focus=CAM.st.slice(); CAM.sRad=close?(sh.kind==='gate'?30:22):0; CAM.dof=close?0.6:0;
  }

  /* ---------- quality levels (the CEO: "adjustable graphics quality ... as close to the cover as the hardware allows") ----------
     0 PERFORMANCE: the lean path for a Fire TV Stick: the canvas about 0.6 megapixels (960 x 540), the tone curve in the shaders, no post chain,
                    no shadow map (blob shadows), plain dirt detail, one hero rider close up, a small particle budget, 30 frames a second.
     1 BALANCED:    about 1 megapixel, the HDR post chain (bloom, FXAA, vignette, grade), one shadow map from the key light, the detail layers on
                    the dirt, reflections and mud on the bikes, 3 hero riders, more particles.
     2 QUALITY:     up to 1080p, 4x MSAA where WebGL2 has it, a 2048 shadow map, depth of field, the most particles and hero riders.
     "auto" picks the level from the device and steps down when the measured frame time says so (and back up, once, when there is room). */
  var QUAL=[
    {name:"performance",px:0.62e6,post:false,shadow:0,env:false,mud:false,detail:false,bloom:0,dof:0,fxaa:false,msaa:false,hero:1,mid:5,parts:150,clumps:90,fps30:true,flare:false},
    {name:"balanced",px:1.0e6,post:true,shadow:1024,env:true,mud:true,detail:true,bloom:0.32,dof:0,fxaa:true,msaa:false,hero:3,mid:9,parts:300,clumps:280,fps30:false,flare:true},
    {name:"quality",px:2.15e6,post:true,shadow:2048,env:true,mud:true,detail:true,bloom:0.5,dof:0.6,fxaa:true,msaa:true,hero:6,mid:14,parts:480,clumps:560,fps30:false,flare:true}];
  V.q=startLevel(); V.qAuto=true; V.qCap=2; V.QUAL=QUAL; V.qLog=[]; V.qDirty=true;
  function startLevel(){
    var ua=(navigator&&navigator.userAgent)||"", rd=(R.caps.renderer||"");
    if(fx) return 0;
    if(/AFT[A-Z0-9]|Fire ?TV|Silk/i.test(ua)) return 0;
    if(/SwiftShader|llvmpipe|Basic Render|Mali-4|Mali-T|Mali-G31|Mali-G51|PowerVR|Adreno \(?[23]\d\d|Software/i.test(rd)) return 1;
    return /Android|iPhone|iPad/i.test(ua)?1:2;
  }
  V.setQuality=function(l){
    var i=typeof l==="number"?l:({performance:0,balanced:1,quality:2,auto:-1})[String(l).toLowerCase()];
    if(i==null||isNaN(i)) return V.q;
    if(i<0){ V.qAuto=true; V.q=Math.min(startLevel(),V.qCap); } else { V.qAuto=false; V.q=clamp(i|0,0,2); }
    V.qLog.push([+V.T.toFixed(1),V.q,V.qAuto?"auto":"manual"]); V.qDirty=true; return V.q;
  };
  V.qualityName=function(){ return (V.qAuto?"Auto · ":"")+QUAL[V.q].name; };
  /* the post chain, the shadow map and the programs this level needs (built when the level changes: a loading-screen cost, not a frame cost) */
  function applyQuality(W,H){
    var Q=QUAL[V.q]; V.qDirty=false;
    if(Q.shadow&&R.caps.depthTex){ V.shadowOn=!!R.initShadow(Q.shadow); } else { R.freeShadow(); V.shadowOn=false; }
    if(Q.post&&R.caps.halfRT||(Q.post&&R.caps.floatRT)){ V.postOn=!!R.initPost(W,H,{msaa:Q.msaa}); V.msaaOn=!!(R.post&&R.post.ms); } else { R.freePost(); V.postOn=false; V.msaaOn=false; }
    V.postKey=W+"x"+H+"|"+V.q;
    pickPrograms();
  }
  var PR={lit:null,dirt:null,stand:null};
  function pickPrograms(){
    var Q=QUAL[V.q], lf=[]; if(V.shadowOn) lf.push("SHADOW"); if(Q.env) lf.push("ENV"); if(Q.mud) lf.push("MUD");
    PR.lit=R.litProgram(lf); PR.stand=R.standProgram(); PR.dirt=R.dirtProgram((Q.detail?["DETAIL"]:[]).concat(V.shadowOn?["SHADOW"]:[]));
  }
  /* the frame-time controller: the median frame interval and our JavaScript time over a window decide a step down (slow) or up (a lot of room) */
  var AQ={n:0,sum:0,js:0,since:0,down:0};
  function autoQuality(dtMs,jsMs){
    if(!V.qAuto||V.frozen) return;
    AQ.n++; AQ.sum+=dtMs; AQ.js+=jsMs; AQ.since+=dtMs;
    var win=AQ.down?5000:2500;
    if(AQ.n<45||AQ.since<win) return;
    var avg=AQ.sum/AQ.n, js=AQ.js/AQ.n, tgt=QUAL[V.q].fps30?33.3:16.7;
    if(avg>tgt*1.38&&V.q>0){ V.q--; V.qCap=Math.max(V.q,V.qCap>V.q+1?V.q+1:V.qCap); V.qDirty=true; AQ.down++; V.qLog.push([+V.T.toFixed(1),V.q,"down "+avg.toFixed(1)+"ms"]); }
    else if(avg<tgt*0.78&&js<tgt*0.35&&V.q<V.qCap&&!AQ.down){ V.q++; V.qDirty=true; V.qLog.push([+V.T.toFixed(1),V.q,"up "+avg.toFixed(1)+"ms"]); }
    AQ.n=0; AQ.sum=0; AQ.js=0; AQ.since=0;
  }

  /* ---------- draw ---------- */
  function resize(){
    var Q=QUAL[V.q], w=Math.max(1,host.clientWidth), h=Math.max(1,host.clientHeight), tv=document.documentElement.hasAttribute("data-tv");
    var dpr=Math.min(g.devicePixelRatio||1,tv?2:2), budget=Q.px*(tv?1:(V.q===0?0.9:1));
    var sc=Math.min(dpr,Math.sqrt(budget/(w*h)))*(V.half?0.8:1); sc=Math.max(0.4,sc);
    var W=Math.round(w*sc), H=Math.round(h*sc);
    if(W!==canvas.width||H!==canvas.height){ canvas.width=W; canvas.height=H; }
    canvas.style.width=w+"px"; canvas.style.height=h+"px"; V.W=W; V.H=H; V.dpr=sc; V.cssW=w; V.cssH=h;
  }
  V.resize=function(){ resize(); if(!V.run) draw(0); };
  /* the light for this frame: at night a film-style rig relative to the camera (the key from behind and above on the camera side so the
     riders and the dirt in front of the lens are lit and readable, a strong warm back / rim light from the far floodlights that rims the
     riders and the crests; both turn slowly with the camera's heading), by day the fixed sun */
  var LS={init:false,fx:1,fz:0}, LU={sun:[0,1,0],fill:[0,1,0],sunCol:[1,1,1],fillCol:[1,1,1],sky:[0,0,0],gnd:[0,0,0],fog:[0,0,0],haze:[0,0,0],fogR:[0,0,0],spot:[0,0,1,0],ld:new Float32Array(12),lc:new Float32Array(12),mud:[0.2,0.12,0.07],expo:1};
  function n3(v){ var l=Math.hypot(v[0],v[1],v[2])||1; v[0]/=l; v[1]/=l; v[2]/=l; return v; }
  function frameLight(dt){
    var Lg=SC.L, ex=CAM.eye, tg=CAM.tgt, fx0=tg[0]-ex[0], fz0=tg[2]-ex[2], fl=Math.hypot(fx0,fz0)||1; fx0/=fl; fz0/=fl;
    if(!LS.init||V.cut){ LS.fx=fx0; LS.fz=fz0; LS.init=true; } else { var k=1-Math.exp(-Math.min(dt,0.1)/1.4); LS.fx+=(fx0-LS.fx)*k; LS.fz+=(fz0-LS.fz)*k; var l2=Math.hypot(LS.fx,LS.fz)||1; LS.fx/=l2; LS.fz/=l2; }
    var f0=LS.fx, f2=LS.fz, r0=-f2, r2=f0;   /* forward and right on the ground */
    LU.sunCol=Lg.sunCol; LU.fillCol=Lg.fillCol; LU.sky=Lg.sky; LU.gnd=Lg.gnd; LU.fog=Lg.fog; LU.haze=Lg.haze; LU.fogR=Lg.fogR; LU.spot=Lg.spot; LU.expo=Lg.expo;
    if(SC.night){ LU.sun=n3([-f0*0.40-r0*0.46,0.78,-f2*0.40-r2*0.46]); LU.fill=n3([f0*0.62+r0*0.40,0.58,f2*0.62+r2*0.40]); }
    else { LU.sun=Lg.sun; LU.fill=Lg.fill; }
    for(var li2=0;li2<3;li2++) LITD[li2]=LU.sky[li2]*0.5+LU.gnd[li2]*0.3+LU.sunCol[li2]*0.26+LU.fillCol[li2]*0.5;
    /* the brightest floodlights as seen from where the action is: for the glints on plastics and helmets */
    var L=SC.envLights||[], c=CAM.focus||tg, ld=LU.ld, lc=LU.lc;
    for(var i=0;i<4;i++){ var q=L[i%Math.max(1,L.length)]; if(q){ var dx=q[0]-c[0], dy=q[1]-c[1], dz=q[2]-c[2], dl=Math.hypot(dx,dy,dz)||1; ld[i*3]=dx/dl; ld[i*3+1]=dy/dl; ld[i*3+2]=dz/dl; lc[i*3]=1.3; lc[i*3+1]=1.25; lc[i*3+2]=1.1; } else { ld[i*3]=0; ld[i*3+1]=1; ld[i*3+2]=0; lc[i*3]=lc[i*3+1]=lc[i*3+2]=0; } }
  }
  /* the shadow map: an orthographic box round the point of interest along the key light, its centre snapped to the texel grid */
  var LVM=GL.m4(), LPM=GL.m4(), LVP=GL.m4(), SHP=new Float32Array(4);
  function shadowSetup(){
    var rad=CAM.sRad||0; if(!V.shadowOn||rad<=0){ V.shadowUse=false; return false; }
    var Sz=R.shadow.size, c0=CAM.focus||CAM.tgt, ld=LU.sun, up=Math.abs(ld[1])>0.95?[0,0,1]:[0,1,0];
    /* the texel grid in the light's own axes */
    var rx=ld[2]*up[1]-ld[1]*up[2], ry=ld[0]*up[2]-ld[2]*up[0], rz=ld[1]*up[0]-ld[0]*up[1], rl=Math.hypot(rx,ry,rz)||1; rx/=rl; ry/=rl; rz/=rl;
    var ux=ry*ld[2]-rz*ld[1], uy=rz*ld[0]-rx*ld[2], uz=rx*ld[1]-ry*ld[0];
    var tex=2*rad/Sz, a=c0[0]*rx+c0[1]*ry+c0[2]*rz, b=c0[0]*ux+c0[1]*uy+c0[2]*uz, da=Math.round(a/tex)*tex-a, db=Math.round(b/tex)*tex-b;
    var c=[c0[0]+rx*da+ux*db,c0[1]+ry*da+uy*db,c0[2]+rz*da+uz*db], D=70;
    GL.lookAt(LVM,[c[0]+ld[0]*D,c[1]+ld[1]*D,c[2]+ld[2]*D],c,up); GL.ortho(LPM,-rad,rad,-rad,rad,4,D*2); GL.mul(LVP,LPM,LVM);
    SHP[0]=1/Sz*1.25; SHP[1]=0.00045+rad*0.00003; SHP[2]=0.86; SHP[3]=0.02+tex*1.4;
    V.shadowUse=true; return true;
  }
  var IDM=GL.m4();
  function draw(dt){
    var C=V.C; if(!C||!SC) return;
    resize();
    var W=V.W, H=V.H, Q=QUAL[V.q], Lg=SC.L;
    if(V.qDirty||V.postKey!==W+"x"+H+"|"+V.q) applyQuality(W,H);
    var post=V.postOn&&R.post, P0;
    R.frame(); if(!V._lightDone) frameLight(dt);
    /* camera matrices: CAM.fov is the vertical field of a 16:9 frame: a portrait screen keeps most of the width (a taller view), a very wide one a little less height */
    var asp=W/H, kk=(16/9)/asp, fy=Math.min(1.4,2*Math.atan(Math.tan(CAM.fov/2)*(kk>1?Math.pow(kk,0.52):Math.pow(kk,0.35))));
    var far=C.outdoor?2400:900;
    GL.persp(PROJ,fy,asp,CAM.near||(CAM.close?0.35:1.5),far); GL.lookAt(VIEW,CAM.eye,CAM.tgt,CAM.up||[0,1,0]); GL.mul(VP,PROJ,VIEW); GL.inv(IVP,VP);
    var tSec=fx||V.fxMode!=="full"?0:(vnow()%600000)/1000;   /* the LED boards and the crowd hold still with Reduce effects */
    /* every instance buffer is filled once, then used by the shadow pass and the main pass */
    PARTS.forEach(function(k){ var n=counts[NCNT[k]]; if(n) R.update(IB[k],IBD[k],n); });
    if(counts.person) R.update(IB.person,IBD.person,counts.person);
    R.update(IB.gate,IBD.gate,1);
    var useSh=shadowSetup();
    if(useSh){
      var Sh=R.shadow; R.bindPlain(Sh.T); gl.depthMask(true); gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND); gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.colorMask(false,false,false,false); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5,3);
      var PS0=R.progs.shadow; R.use(PS0); gl.uniformMatrix4fv(PS0.u.uLVP,false,LVP);
      SHCAST.forEach(function(k){ var n=counts[NCNT[k]]; if(n) R.draw(PS0,M[k],IB[k],n); });
      if(counts.person) R.draw(PS0,M.person,IB.person,counts.person);
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true,true,true,true);
    }
    /* the main pass */
    if(post){ P0=R.post; R.bind(P0.scene); } else R.bind(null,W,H);
    var TM=post?0:1, OUT=post?R.post.out:1;
    gl.clearColor(Lg.clear[0],Lg.clear[1],Lg.clear[2],1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
    /* the shared textures: 1 noise, 2 smooth noise, 3 shadow, 4 / 5 the dirt's detail */
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,TEX.noise); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,TEX.smooth);
    if(useSh){ gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D,R.shadow.tex); }
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D,TEX.detA); gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D,TEX.detB);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_2D,BAN.t); gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D,BAN.tw); gl.activeTexture(gl.TEXTURE0);
    function u3(l,v){ if(l!=null) gl.uniform3fv(l,v); }
    function common(Pg){ var u=Pg.u; gl.uniformMatrix4fv(u.uVP,false,VP);
      u3(u.uSun,LU.sun); u3(u.uSunCol,LU.sunCol); u3(u.uFill,LU.fill); u3(u.uFillCol,LU.fillCol); u3(u.uSky,LU.sky); u3(u.uGnd,LU.gnd);
      u3(u.uFog,LU.fog); u3(u.uFogR,LU.fogR); u3(u.uHaze,LU.haze); u3(u.uCam,CAM.eye); if(u.uSpot!=null) gl.uniform4fv(u.uSpot,LU.spot);
      if(u.uExpo!=null) gl.uniform1f(u.uExpo,LU.expo); if(u.uTM!=null) gl.uniform1f(u.uTM,TM); if(u.uOut!=null) gl.uniform1f(u.uOut,OUT); if(u.uFar!=null) gl.uniform1f(u.uFar,far);
      if(u.uTime!=null) gl.uniform1f(u.uTime,tSec); if(u.uNoise!=null) gl.uniform1i(u.uNoise,1); if(u.uSmooth!=null) gl.uniform1i(u.uSmooth,2);
      if(u.uMudCol!=null) gl.uniform3fv(u.uMudCol,LU.mud); if(u.uLDir!=null) gl.uniform3fv(u.uLDir,LU.ld); if(u.uLCol!=null) gl.uniform3fv(u.uLCol,LU.lc);
      if(u.uBanner!=null) gl.uniform1i(u.uBanner,6); if(u.uTower!=null) gl.uniform1i(u.uTower,7); if(u.uPxW!=null) gl.uniform1f(u.uPxW,2*Math.tan(fy/2)/H);
      if(u.uLVP!=null){ gl.uniformMatrix4fv(u.uLVP,false,LVP); } if(u.uShP!=null){ gl.uniform4fv(u.uShP,SHP); } if(u.uShadow!=null) gl.uniform1i(u.uShadow,3); }
    /* the sky */
    var Pg=R.progs.sky; R.use(Pg); gl.depthMask(false); gl.uniformMatrix4fv(Pg.u.uIVP,false,IVP); gl.uniform3fv(Pg.u.uTop,Lg.top); gl.uniform3fv(Pg.u.uHor,Lg.hor); gl.uniform3fv(Pg.u.uSun,Lg.sun); gl.uniform3fv(Pg.u.uSunCol,Lg.sunCol);
    gl.uniform1f(Pg.u.uExpo,LU.expo); gl.uniform1f(Pg.u.uTM,TM); gl.uniform1f(Pg.u.uOut,OUT); gl.uniform1f(Pg.u.uNight,Lg.nightK); gl.uniform1f(Pg.u.uClouds,Lg.clouds);
    gl.uniform1i(Pg.u.uNoise,1); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,TEX.dirt); gl.uniform1i(Pg.u.uTex,0); R.sky(Pg); gl.depthMask(true);
    /* the ground and the track */
    Pg=PR.dirt; R.use(Pg); common(Pg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,TEX.dirt); gl.uniform1i(Pg.u.uTex,0);
    if(Pg.u.uDetA!=null) gl.uniform1i(Pg.u.uDetA,4); if(Pg.u.uDetB!=null) gl.uniform1i(Pg.u.uDetB,5); if(Pg.u.uDetK!=null) gl.uniform3f(Pg.u.uDetK,0.52,2.9,0);
    gl.uniform3fv(Pg.u.uDirt,SC.cols.dirt); gl.uniform3fv(Pg.u.uSand,SC.cols.sand); gl.uniform3fv(Pg.u.uGrass,SC.cols.grass); gl.uniform1f(Pg.u.uWet,Lg.wet);
    R.draw(Pg,SC.floorMesh,null); R.draw(Pg,SC.track,null);
    /* props, the gate, the stands */
    Pg=PR.lit; R.use(Pg); common(Pg); R.draw(Pg,SC.props,null); R.draw(Pg,SC.gateMesh,IB.gate,1);
    if(SC.stands){ var Ps=PR.stand; R.use(Ps); common(Ps); R.draw(Ps,SC.stands,null); }
    /* the bikes and riders: one draw per part for the whole field */
    Pg=PR.lit; R.use(Pg); common(Pg);
    PARTS.forEach(function(k){ var n=counts[NCNT[k]]; if(n) R.draw(Pg,M[k],IB[k],n); });
    if(counts.person) R.draw(Pg,M.person,IB.person,counts.person);
    var nf=buildFlags(); if(nf){ R.update(IB.flag,IBDf,nf); R.use(Pg); common(Pg); drawArraysLit(Pg,IB.flag,nf); }
    /* plates */
    if(ATL.dirty){ R.retex(ATL.t,ATL.c); ATL.dirty=false; }
    Pg=R.progs.plate; R.use(Pg); common(Pg); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ATL.t); gl.uniform1i(Pg.u.uAtlas,0);
    if(counts.plate){ R.update(IB.plate,IBD.plate,counts.plate); R.draw(Pg,M.plate,IB.plate,counts.plate); }
    /* shadows, dust: blended (the alpha channel keeps the depth the post chain reads) */
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE); gl.depthMask(false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-2,-4);
    Pg=R.progs.decal; if(counts.decal){ R.use(Pg); gl.uniformMatrix4fv(Pg.u.uVP,false,VP); R.update(IB.decal,IBD.decal,counts.decal); R.quads(Pg,IB.decal,counts.decal); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    var rgt=[VIEW[0],VIEW[4],VIEW[8]], upv=[VIEW[1],VIEW[5],VIEW[9]];
    Pg=R.progs.part; if(counts.part){ R.use(Pg); gl.uniformMatrix4fv(Pg.u.uVP,false,VP); gl.uniform3fv(Pg.u.uRight,rgt); gl.uniform3fv(Pg.u.uUp,upv); gl.uniform3fv(Pg.u.uLitCol,LITD); gl.uniform1f(Pg.u.uExpo,LU.expo); gl.uniform1f(Pg.u.uTM,TM); gl.uniform1f(Pg.u.uOut,OUT); gl.uniform1i(Pg.u.uSmooth,2); R.update(IB.part,IBD.part,counts.part); R.quads(Pg,IB.part,counts.part); }
    if(counts.clump){ Pg=R.progs.clump; R.use(Pg); gl.uniformMatrix4fv(Pg.u.uVP,false,VP); gl.uniform3fv(Pg.u.uRight,rgt); gl.uniform3fv(Pg.u.uUp,upv); gl.uniform3fv(Pg.u.uLitCol,LITD);
      gl.uniform3f(Pg.u.uKeyScr,VIEW[0]*LU.sun[0]+VIEW[4]*LU.sun[1]+VIEW[8]*LU.sun[2],VIEW[1]*LU.sun[0]+VIEW[5]*LU.sun[1]+VIEW[9]*LU.sun[2],VIEW[2]*LU.sun[0]+VIEW[6]*LU.sun[1]+VIEW[10]*LU.sun[2]);
      gl.uniform1f(Pg.u.uExpo,LU.expo); gl.uniform1f(Pg.u.uTM,TM); gl.uniform1f(Pg.u.uOut,OUT); R.update(IB.clump,IBD.clump,counts.clump); R.quads(Pg,IB.clump,counts.clump); }
    /* the stadium light glows (additive star-bursts) */
    if(SC.lights&&SC.night&&Q.flare){ var gd=IBD.glow, gn=0; SC.lights.forEach(function(l){ if(gn<48){ gd[gn*8]=l[0]; gd[gn*8+1]=l[1]; gd[gn*8+2]=l[2]; gd[gn*8+3]=(l[3]||7)*2.6; gd[gn*8+4]=1.0; gd[gn*8+5]=0.93; gd[gn*8+6]=0.8; gd[gn*8+7]=1.0; gn++; } });
      Pg=R.progs.glow; R.use(Pg); gl.blendFunc(gl.ONE,gl.ONE); gl.uniformMatrix4fv(Pg.u.uVP,false,VP); gl.uniform3fv(Pg.u.uRight,rgt); gl.uniform3fv(Pg.u.uUp,upv); gl.uniform1f(Pg.u.uExpo,LU.expo); gl.uniform1f(Pg.u.uTM,TM); gl.uniform1f(Pg.u.uOut,OUT); R.update(IB.glow,gd,gn); R.quads(Pg,IB.glow,gn);
      gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE); }
    else if(SC.lights&&SC.night){ var gd2=IBD.part, gn2=0; SC.lights.forEach(function(l){ if(gn2<60){ gd2[gn2*8]=l[0]; gd2[gn2*8+1]=l[1]; gd2[gn2*8+2]=l[2]; gd2[gn2*8+3]=l[3]||7; gd2[gn2*8+4]=1.4; gd2[gn2*8+5]=1.35; gd2[gn2*8+6]=1.15; gd2[gn2*8+7]=0.5; gn2++; } });
      Pg=R.progs.part; R.use(Pg); gl.uniformMatrix4fv(Pg.u.uVP,false,VP); gl.uniform3fv(Pg.u.uRight,rgt); gl.uniform3fv(Pg.u.uUp,upv); gl.uniform3fv(Pg.u.uLitCol,[1.6,1.6,1.6]); gl.uniform1f(Pg.u.uExpo,LU.expo); gl.uniform1f(Pg.u.uTM,TM); gl.uniform1f(Pg.u.uOut,OUT); R.update(IB.part,gd2,gn2); R.quads(Pg,IB.part,gn2); }
    gl.depthMask(true); gl.disable(gl.BLEND);
    /* the post chain: the scene (HDR) -> bloom, depth of field, the tone curve and the grade -> the canvas */
    if(post){
      var cam=CAM.eye, fc=CAM.focus||CAM.tgt, fd=Math.hypot(fc[0]-cam[0],fc[1]-cam[1],fc[2]-cam[2]);
      var dofOn=Q.dof>0&&CAM.dof>0, tim=(vnow()%100000)/1000;
      R.postEnd({p1:[Q.bloom*Lg.bloomK,Lg.bloomT,Lg.vig,fx?0:0.018],p2:[LU.expo,Lg.sat,tim,far],p3:[(Q.fxaa&&!V.msaaOn)?1:0,dofOn?Q.dof*CAM.dof:0,1,0],dof:[fd,fd*0.8,fd*3.0,fd*22]},W,H);
    }
    /* labels on top: fixed pixel size, after the tone curve */
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    Pg=R.progs.label; if(counts.label){ R.use(Pg); gl.uniformMatrix4fv(Pg.u.uVP,false,VP); gl.uniform2fv(Pg.u.uPx,[1/W,1/H]); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,ATL.t); gl.uniform1i(Pg.u.uAtlas,0);
      var nl=fixLabels(W,H); if(nl){ R.update(IB.label,LBL,nl); R.quads(Pg,IB.label,nl); } }
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    V.stat={draws:R.draws,tris:R.tris,shadow:!!useSh,post:!!post,msaa:!!V.msaaOn,q:V.q};
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
    gl.vertexAttrib4f(P.a.iA,1,0,0,0); gl.vertexAttrib4f(P.a.iB,0,1,0,0); gl.vertexAttrib4f(P.a.iC,0,0,1,0); gl.vertexAttrib4f(P.a.iTeam,1,1,1,1); gl.vertexAttrib4f(P.a.iAcc,1,1,1,0); if(P.a.aMat!=null&&P.a.aMat>=0) gl.vertexAttrib4f(P.a.aMat,0.1,0.2,0,1);
    gl.drawArrays(gl.TRIANGLES,0,n); R.draws++; R.tris+=n/3; }
  var LITD=[1,1,1];
  function renderStill(){ if(!V.C) return; update(0); camera(0); draw(0); }

  /* ---------- the loop ---------- */
  function tick(t){
    V.raf=0; if(!V.run) return;
    if(document.hidden){ V.run=false; return; }
    var mo=motion(); V.fxMode=mo;
    if(mo==="off"){ V.run=false; renderStill(); return; }
    var dt=(V.last?Math.min(0.1,(t-V.last)/1000):0.016)*(V.timeScale||1);   /* timeScale: tests only (the race view is real time) */
    if((mo==="reduced"||QUAL[V.q].fps30||V.half)&&V.last&&t-V.last<31){ V.raf=requestAnimationFrame(tick); return; }
    V.last=t;
    var c0=now(), c1=c0;
    try{ update(dt); camera(dt); c1=now(); draw(dt); }catch(e){ V.err=String(e&&e.stack||e); try{ console.warn("mxwar 3d:",e); }catch(x){} }
    var cost=now()-c0; V.frames++; V.ms+=cost; V.msN++;
    V.costs.push(cost); if(V.costs.length>120) V.costs.shift();
    V.ucosts.push(c1-c0); if(V.ucosts.length>120) V.ucosts.shift();
    /* a device that can't keep up (our own work over 22 ms a frame, or frames coming slower than 24 a second, a busy GPU, for 3 s) drops
       to 30 fps and a canvas 0.8 x the size */
    var dtMs=V.lastT?t-V.lastT:16; V.dtS=(V.dtS||0)+dtMs; V.lastT=t; autoQuality(dtMs,cost);
    V.raf=requestAnimationFrame(tick);
  }
  V.start=function(){ if(V.run||document.hidden) return; if(motion()==="off"){ renderStill(); return; } V.run=true; V.last=0; V.lastT=0; V.dtS=0; V.ms=0; V.msN=0; V.raf=requestAnimationFrame(tick); };
  V.stop=function(){ V.run=false; if(V.raf){ cancelAnimationFrame(V.raf); V.raf=0; } };
  V.show=function(on){ V.want=!!on; if(on) V.start(); else V.stop(); };
  document.addEventListener("visibilitychange",function(){ if(document.hidden) V.stop(); else if(V.want) V.start(); });
  canvas.addEventListener("webglcontextlost",function(e){ e.preventDefault(); V.lost=true; V.stop(); V.waiters.splice(0).forEach(function(w){ try{ w.res(); }catch(x){} }); });
  canvas.addEventListener("webglcontextrestored",function(){ V.lost=false; try{ R.progs={}; R.cur=null; R.shadow=null; R.post=null; V.qDirty=true; R.programs(); initModels(); if(V.C){ SC=buildScene(V.C); SC.L=light(SC); atlasRedraw(); } if(V.want) V.start(); }catch(e){ V.err=String(e); } });
  /* tests and tools */
  V.freeze=function(on){ V.frozen=!!on; };
  /* capture / demo hooks: a seeded random source, a virtual clock, one deterministic frame (update + camera + draw at a fixed dt; draw=false
     fast-forwards the same simulation without rendering) and a free camera for stills of a model or a spot */
  V.seed=function(n){ RNG.f=(n==null)?null:rng(n>>>0); VR.f=(n==null)?null:rng((n^0x5bd1e995)>>>0); };
  V.virtual=function(on){ VCLK.on=!!on; if(on) VCLK.ms=0; };
  V.step=function(dt,doDraw){ if(VCLK.on) VCLK.ms+=dt*1000; update(dt); camera(dt); if(V.C&&SC){ frameLight(dt); V._lightDone=true; } if(doDraw!==false) draw(dt); V._lightDone=false; };
  V.freeCam=function(o){ V.free=o||null; };
  V.debugShot=function(kind,o){ o=o||{}; V.res=[]; setShot({kind:kind,d:o.d||999,spot:o.spot||(kind==="side"||kind==="wide"?(SC.secs.filter(function(x){ return !o.type||x.F&&x.F.type===o.type; })[0]):null),focus:o.focus!=null?o.focus:-1,pair:o.pair}); };
  V.timeFor=function(type){ var sp=SC.secs.filter(function(x){ return x.F&&x.F.type===type; })[0]; return sp?{lip:sp.F.lip!=null?leadTimeAt(sp.F.lip,(V.lap>1?lapEnd(V.lap-1):0)):null,s0:leadTimeAt(sp.F.s0,(V.lap>1?lapEnd(V.lap-1):0)),F:{type:sp.F.type,s0:sp.F.s0,s1:sp.F.s1,lip:sp.F.lip,tgt:sp.F.tgt}}:null; };
  V.setT=function(t){ V.T=t; };
  /* tests: the JavaScript of n frames (update + camera at dt each, the race running) and of m draws (the GL submission; on a software renderer
     the raster work too): avg / p95 / max in ms */
  V.bench=function(n,dt,m){ function st(a){ var s=a.slice().sort(function(x,y){ return x-y; }), t=0; s.forEach(function(x){ t+=x; }); return {avg:+(t/s.length).toFixed(3),p95:+s[Math.floor(s.length*0.95)].toFixed(3),max:+s[s.length-1].toFixed(3)}; }
    var u=[], d=[], i, a; for(i=0;i<n;i++){ a=now(); update(dt); camera(dt); u.push(now()-a); } for(i=0;i<(m||10);i++){ a=now(); draw(dt); d.push(now()-a); }
    return {upd:st(u),draw:st(d),draws:V.stat?V.stat.draws:0,tris:V.stat?V.stat.tris:0,w:V.W,h:V.H,T:+V.T.toFixed(1)}; };
  V.timeAtS=function(s){ return leadTimeAt(s,(V.lap>1?lapEnd(V.lap-1):0)); };   /* tests: when the leader reaches lap position s on this lap */
  V.stats=function(){ var cs=V.costs.slice().sort(function(a,b){ return a-b; }); return {draws:V.stat?V.stat.draws:0,tris:V.stat?V.stat.tris:0,w:V.W,h:V.H,scale:+V.dpr.toFixed(2),webgl2:R.v2,
    jsMs:cs.length?+(cs.reduce(function(a,b){ return a+b; },0)/cs.length).toFixed(2):0,jsP95:cs.length?+cs[Math.floor(cs.length*0.95)].toFixed(2):0,updMs:V.ucosts.length?+(V.ucosts.reduce(function(a,b){ return a+b; },0)/V.ucosts.length).toFixed(2):0,updP95:V.ucosts.length?+(V.ucosts.slice().sort(function(a,b){ return a-b; })[Math.floor(V.ucosts.length*0.95)]).toFixed(2):0,frames:V.frames,half:V.half,riders:V.riders.length,parts:counts.part}; };
  V.state=function(){ return {T:+V.T.toFixed(2),lap:V.lap,resLap:V.resLap,cuts:V.cuts|0,phase:V.phase,shot:V.shot?V.shot.kind:null,shotEl:V.shot?+V.shot.el.toFixed(2):0,flag:V.flag,yellow:V.yellow?{lap:V.yellow.lap,seat:V.yellow.seat}:null,
    waiting:V.waiters.length,lapT:V.lapT?+V.lapT.toFixed(2):null,track:V.trackName,status:V.trackStatus,lead:V.leadS,err:V.err||null,
    order:poses.filter(function(p){ return !p.parked; }).map(function(p){ return p.r.s; }),crashes:V.riders.filter(function(r){ return r.crash; }).map(function(r){ return {s:r.s,kind:r.crash.kind,T0:+r.crash.T0.toFixed(2)}; }),
    air:poses.filter(function(p){ return p.air; }).length,run:V.run}; };
  V.debugCam=function(){ var f=V.shot&&V.shot.focus>=0?riderPos(V.shot.focus):null; return {eye:CAM.eye.map(function(x){ return +x.toFixed(1); }),tgt:CAM.tgt.map(function(x){ return +x.toFixed(1); }),fov:+CAM.fov.toFixed(2),shot:V.shot&&V.shot.kind,spot:V.shot&&V.shot.spot?[+V.shot.spot.x.toFixed(1),+V.shot.spot.y.toFixed(1),+V.shot.spot.z.toFixed(1)]:null,focus:f?[+f.x.toFixed(1),+f.y.toFixed(1),+f.z.toFixed(1),!!f.crash]:null,marshal:V.marshal?[+V.marshal.x.toFixed(1),+V.marshal.z.toFixed(1)]:null}; };
  /* the live timing board: every rider in track order with the gap in seconds to the leader (the time the leader needed from that rider's spot to
     his own: a timing loop's gap), the riders out last (the later out ahead); for the page's tower and the demo's overlay */
  V.board=function(){
    var C=V.C; if(!C) return [];
    var live=[], dead=[], T=V.T;
    poses.forEach(function(p){ if(p.parked||p.r.out) dead.push(p); else live.push(p); });
    live.sort(byD);
    dead.sort(function(a,b){ var A=a.r.park?a.r.park.T:a.r.crash?a.r.crash.T0:0, B=b.r.park?b.r.park.T:b.r.crash?b.r.crash.T0:0; return B-A; });
    var D0=live.length?live[0].D:0, t0=TK.timeAt(C,D0), rows=[];
    live.forEach(function(p,i){ rows.push({s:p.r.s,place:i+1,gap:Math.max(0,t0-TK.timeAt(C,p.D)),out:false,crash:!!p.crash,air:!!p.air,D:p.D,v:p.v||0}); });
    dead.forEach(function(p,i){ rows.push({s:p.r.s,place:live.length+i+1,gap:0,out:true,crash:!!p.crash,air:false,D:p.D,v:0}); });
    return rows;
  };
  V.poseList=function(){ return poses.map(function(p){ return {s:p.r.s,x:p.x,y:p.y,z:p.z,tx:p.tx,tz:p.tz,gl:p.gl,D:p.D,air:!!p.air,parked:!!p.parked,v:p.v||0,lod:p.r._lod}; }); };
  V.speedOf=function(s){ var p=s>=0?riderPos(s):null; return p&&!p.parked?(p.v||0):0; };
  V.order=function(){ return poses.filter(function(p){ return !p.parked; }).sort(function(a,b){ return b.D-a.D; }).map(function(p){ return p.r.s; }); };
  V.destroy=function(){ V.stop(); try{ canvas.remove(); }catch(e){} };
  initModels();
  return V;
}

MX.Race3D={create:create,supported:function(){ try{ var c=document.createElement("canvas"); return !!(c.getContext("webgl2")||c.getContext("webgl")); }catch(e){ return false; } }};
})(typeof window!=="undefined"?window:globalThis);
