/* MOTOCROSS WAR 3D — THE STADIUM'S ART (owner: stadium): every texture of the bowl, drawn in code (original art, no photos, no logos, no
   brands): the crowd atlas (64 little people: seated, cheering, filming, standing, empty seats, an aisle), the ad boards round the floor
   (MOTOCROSS WAR in the brand palette and plain words of the game), the LED ribbon, the suites' windows, the big video board, the starburst
   flares and the soft glow. ES module (three.js r160 vendored at ui/vendor). Used by r3d-stadium-bowl.js and r3d-world.js. */
import * as THREE_NS from "../ui/vendor/three-0.160.0.module.min.js";
const THREE=THREE_NS;
import {clamp,canvas,tex,rngf,getAniso} from "./r3d-util.js";

/* the brand palette (11_SKIN_DESIGN_TOKENS.json) */
export const BRAND={night:"#090C12",red:"#F72D2E",dust:"#7B4A2B",dirt:"#B6824C",gold:"#ECB967",white:"#F0F1F3"};
const FONT="'Arial Black', Impact, 'Helvetica Neue', Arial, system-ui, sans-serif";

/* ---------------- the crowd atlas ---------------- */
export const CROWD={seat:0.55,row:0.85,N:8};   /* a seat 0.55 m wide, a row 0.85 m up the slope; the atlas is N x N sprites, one sprite per seat */
export const SPR={PEOPLE:36,ARMS0:36,ARMS1:47,PHONE0:48,PHONE1:55,STAND0:56,STAND1:59,EMPTY0:60,EMPTY1:61,AISLE:62,FLAG:63};
/* the crowd of a night race under floodlights: mostly dark clothes, a lot of red (the war red) and white, a few bright pops */
const SHIRTS=["#1a1b22","#26262e","#303036","#3a3a44","#1d2433","#2a2f45","#3b4a66","#4a2a2e","#6a1f26","#1a1b22","#26262e","#303036","#c8102e","#f72d2e","#b0221f","#c8102e","#d9d4cc","#f0f1f3","#9a9aa8","#c8c8d0","#d9d4cc","#c89a50","#b8561a","#2a4a9a","#2f6b3a","#6a3f2a"];
const SKIN=["#e8bf98","#c98f66","#8d5a3b","#5a3a26","#f0cfae","#a8714c","#d9a77d"];
const HAIR=["#1c1410","#3a281a","#101014","#6a4a2a","#b89a6a","#8a8a90","#c8aa6a","#d8d0c0"];
const SEATS=["#1b2a52","#4a1a1f","#222633","#1d3d3a","#2a2a44"];
function rgb(h){ const n=parseInt(h.slice(1),16); return [n>>16,(n>>8)&255,n&255]; }
function mul(h,k,a){ const c=rgb(h); return "rgba("+Math.min(255,c[0]*k|0)+","+Math.min(255,c[1]*k|0)+","+Math.min(255,c[2]*k|0)+","+(a==null?1:a)+")"; }
function pick(L,R){ return L[Math.floor(R()*L.length)]; }
function ell(x,cx,cy,rx,ry){ x.beginPath(); x.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); x.fill(); }
/* one sprite, drawn in metres inside a 0.55 x 0.85 cell (y down); the seat behind, the person, the shade of the row in front */
function sprite(x,k,R,cut){
  const W=CROWD.seat, H=CROWD.row;
  let g; if(!cut){ g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#17151d"); g.addColorStop(1,"#08070b"); x.fillStyle=g; x.fillRect(0,0,W,H); }
  const seatC=pick(SEATS,R);
  const seat=()=>{ x.fillStyle=mul(seatC,1.0); x.beginPath(); x.moveTo(0.07,0.84); x.lineTo(0.08,0.46); x.quadraticCurveTo(0.09,0.37,0.2,0.37); x.lineTo(0.35,0.37); x.quadraticCurveTo(0.46,0.37,0.47,0.46); x.lineTo(0.48,0.84); x.closePath(); x.fill();
    x.fillStyle="rgba(255,255,255,0.10)"; x.fillRect(0.14,0.375,0.27,0.02); };
  if(cut&&(k>=SPR.EMPTY0)){ return; }
  if(k===SPR.AISLE){ /* concrete steps with a handrail and the odd step light */
    g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#5a5862"); g.addColorStop(1,"#2a2931"); x.fillStyle=g; x.fillRect(0,0,W,H);
    for(let y=0.04;y<H;y+=0.17){ x.fillStyle="rgba(255,255,255,0.22)"; x.fillRect(0,y,W,0.022); x.fillStyle="rgba(0,0,0,0.3)"; x.fillRect(0,y+0.03,W,0.04); }
    x.fillStyle="#9a9aa6"; x.fillRect(0.26,0,0.028,H); x.fillStyle="rgba(255,255,255,0.3)"; x.fillRect(0.26,0,0.008,H);
    x.fillStyle="#ffd890"; for(let y=0.1;y<H;y+=0.34){ x.fillRect(0.02,y,0.03,0.016); x.fillRect(0.5,y,0.03,0.016); }
    return; }
  if(k>=SPR.EMPTY0&&k<=SPR.EMPTY1){ seat(); if(R()<0.5){ x.fillStyle=mul(pick(SHIRTS,R),0.5); x.fillRect(0.16,0.6,0.23,0.1); } shadeRow(x); return; }
  if(k===SPR.FLAG){ person(x,R,cut,"flag"); return; }
  if(!cut) seat();
  person(x,R,cut,k>=SPR.ARMS0&&k<=SPR.ARMS1?"arms":k>=SPR.PHONE0&&k<=SPR.PHONE1?"phone":k>=SPR.STAND0&&k<=SPR.STAND1?"stand":"sit");
}
function shadeRow(x){ const H=CROWD.row, g=x.createLinearGradient(0,H*0.55,0,H); g.addColorStop(0,"rgba(0,0,0,0)"); g.addColorStop(0.7,"rgba(0,0,0,0.55)"); g.addColorStop(1,"rgba(0,0,0,0.85)"); x.fillStyle=g; x.fillRect(0,H*0.55,CROWD.seat,H*0.45); }
function person(x,R,cut,kind){
  let g; const shirt=pick(SHIRTS,R), skin=pick(SKIN,R), hair=pick(HAIR,R), stand=kind==="stand", W=CROWD.seat;
  const cx=W/2+(R()-0.5)*0.1, hy=(stand?0.15:0.215)+(R()-0.5)*0.04, y0=hy+0.135, lean=(R()-0.5)*0.05;
  const hood=R()<0.16, cap=!hood&&R()<0.2, beanie=!hood&&!cap&&R()<0.08;
  /* arms up behind the head (cheering), drawn first */
  if(kind==="arms"){ x.lineCap="round"; x.strokeStyle=mul(shirt,0.8); x.lineWidth=0.07; const sp=0.05+R()*0.06;
    for(const s of [-1,1]){ x.beginPath(); x.moveTo(cx+s*0.17,y0+0.08); x.lineTo(cx+s*(0.24+sp),y0-0.16-R()*0.04); x.stroke(); x.fillStyle=skin; ell(x,cx+s*(0.25+sp),y0-0.19,0.034,0.04); } }
  /* the torso */
  g=x.createLinearGradient(0,y0,0,0.86); g.addColorStop(0,mul(shirt,1.15)); g.addColorStop(0.45,mul(shirt,0.78)); g.addColorStop(1,mul(shirt,0.3)); x.fillStyle=g;
  x.beginPath(); x.moveTo(cx+lean-0.245,y0+0.09); x.quadraticCurveTo(cx+lean-0.25,y0-0.005,cx+lean-0.14,y0-0.012); x.lineTo(cx+lean+0.14,y0-0.012); x.quadraticCurveTo(cx+lean+0.25,y0-0.005,cx+lean+0.245,y0+0.09); x.lineTo(cx+0.25,0.86); x.lineTo(cx-0.25,0.86); x.closePath(); x.fill();
  x.fillStyle=mul(shirt,0.62,0.7); x.fillRect(cx-0.245,y0+0.1,0.05,0.76); x.fillRect(cx+0.195,y0+0.1,0.05,0.76);   /* the arms at the sides, a little darker */
  const pr=R(); if(pr<0.3){ x.fillStyle=mul(pick(SHIRTS,R),1.0,0.9); x.fillRect(cx-0.2,y0+0.14,0.4,0.035+R()*0.03); } else if(pr<0.42){ x.fillStyle=mul(BRAND.white,0.9,0.8); x.fillRect(cx-0.06,y0+0.12,0.12,0.12); }   /* a stripe or a print */
  x.strokeStyle="rgba(255,255,255,0.22)"; x.lineWidth=0.014; x.beginPath(); x.moveTo(cx+lean-0.22,y0+0.045); x.quadraticCurveTo(cx+lean-0.2,y0+0.005,cx+lean-0.12,y0+0.002); x.lineTo(cx+lean+0.12,y0+0.002); x.quadraticCurveTo(cx+lean+0.2,y0+0.005,cx+lean+0.22,y0+0.045); x.stroke();   /* the floodlights on the shoulders */
  if(hood){ x.fillStyle=mul(shirt,0.7); ell(x,cx+lean,hy+0.07,0.12,0.095); }
  /* the neck and the head */
  x.fillStyle=mul(skin,0.8); x.fillRect(cx+lean-0.035,hy+0.08,0.07,0.075);
  g=x.createLinearGradient(0,hy-0.1,0,hy+0.1); g.addColorStop(0,mul(skin,1.12)); g.addColorStop(1,mul(skin,0.72)); x.fillStyle=g; ell(x,cx+lean*0.6,hy,0.083,0.1);
  /* hair, a cap, a beanie */
  if(cap){ x.fillStyle=mul(pick(SHIRTS,R),0.95); x.beginPath(); x.ellipse(cx+lean*0.6,hy-0.025,0.09,0.07,0,Math.PI,0); x.fill(); x.fillRect(cx+lean*0.6-0.02,hy-0.03,0.13,0.022); }
  else if(beanie){ x.fillStyle=mul(pick(SHIRTS,R),0.9); x.beginPath(); x.ellipse(cx+lean*0.6,hy-0.02,0.088,0.085,0,Math.PI,0); x.fill(); }
  else if(!hood){ x.fillStyle=mul(hair,1.0); x.beginPath(); x.ellipse(cx+lean*0.6,hy-0.03,0.088,0.068,0,Math.PI,0); x.fill(); if(R()<0.3){ ell(x,cx+lean*0.6,hy+0.0,0.093,0.09); x.fillStyle=g; ell(x,cx+lean*0.6,hy+0.035,0.07,0.07); } }
  else { x.fillStyle=g; ell(x,cx+lean*0.6,hy+0.02,0.062,0.078); }
  if(kind==="phone"){ const px=cx+0.07, py=hy-0.005; x.fillStyle=mul(shirt,0.85); x.lineCap="round"; x.strokeStyle=mul(shirt,0.85); x.lineWidth=0.065; x.beginPath(); x.moveTo(cx+0.2,y0+0.1); x.lineTo(px+0.03,py+0.07); x.stroke();
    const gg=x.createRadialGradient(px,py,0,px,py,0.16); gg.addColorStop(0,"rgba(210,235,255,0.9)"); gg.addColorStop(0.3,"rgba(150,200,255,0.35)"); gg.addColorStop(1,"rgba(150,200,255,0)"); x.fillStyle=gg; x.fillRect(px-0.17,py-0.17,0.34,0.34);
    x.fillStyle="#e8f4ff"; x.fillRect(px-0.026,py-0.05,0.052,0.095); }
  if(kind==="flag"){ x.strokeStyle="#c8c8d0"; x.lineWidth=0.012; x.beginPath(); x.moveTo(cx+0.17,y0+0.02); x.lineTo(cx+0.2,0.0); x.stroke(); x.fillStyle=R()<0.5?BRAND.red:BRAND.gold; x.beginPath(); x.moveTo(cx+0.2,0.0); x.lineTo(cx+0.5,0.05); x.lineTo(cx+0.2,0.12); x.closePath(); x.fill(); }
  if(!cut) shadeRow(x);
}
/* cut = people only on a clear background (the upright cards of the near rows); otherwise the seat, the shade of the row in front, the aisle: the slope itself */
export function crowdAtlas(lo,cut){
  const S=lo?32:64, N=CROWD.N, c=canvas(S*N,S*N), x=c.getContext("2d"), R=rngf(cut?9001:7117);
  if(!cut){ x.fillStyle="#0c0b10"; x.fillRect(0,0,c.width,c.height); }
  for(let k=0;k<N*N;k++){ const col=k%N, row=(k/N)|0; x.save(); x.beginPath(); x.rect(col*S,row*S,S,S); x.clip(); x.translate(col*S,row*S); x.scale(S/CROWD.seat,S/CROWD.row); sprite(x,k,R,cut); x.restore(); }
  const t=tex(c,false); t.anisotropy=Math.min(getAniso(),4); return t;
}

/* ---------------- writing on boards ---------------- */
function words(x,txt,cx,cy,size,fill,stroke,skew,font,maxW){
  x.save(); if(maxW){ x.font=font||("900 "+size+"px "+FONT); const w=x.measureText(txt).width; if(w>maxW) size=size*maxW/w; } x.translate(cx,cy); x.transform(1,0,-(skew==null?0.22:skew),1,0,0); x.font=font||("900 "+size+"px "+FONT); x.textAlign="center"; x.textBaseline="middle"; x.lineJoin="round";
  if(stroke){ x.lineWidth=size*0.16; x.strokeStyle=stroke; x.strokeText(txt,0,0); } x.fillStyle=fill; x.fillText(txt,0,0); x.restore();
}
function worn(x,w,h,R,n,col){ x.fillStyle=col; for(let i=0;i<n;i++){ x.globalAlpha=0.25+R()*0.5; const s=0.6+R()*R()*2.6; x.fillRect(R()*w,R()*h,s*(1+R()*2),s); } x.globalAlpha=1; }
function chevrons(x,x0,y0,w,h,n,col){ x.fillStyle=col; for(let i=0;i<n;i++){ const o=i*w/n; x.beginPath(); x.moveTo(x0+o,y0); x.lineTo(x0+o+w/n*0.5,y0); x.lineTo(x0+o+w/n*0.5+h*0.35,y0+h/2); x.lineTo(x0+o+w/n*0.5,y0+h); x.lineTo(x0+o,y0+h); x.lineTo(x0+o+h*0.35,y0+h/2); x.closePath(); x.fill(); } }
/* the ad boards round the floor: 8 panels of 4 m (a strip that tiles every 32 m), a padded cap on top */
export function boardsTex(lo){
  const PW=lo?128:256, PH=lo?48:96, W=PW*8, c=canvas(W,PH), x=c.getContext("2d"), R=rngf(515), B=BRAND;
  const panel=(k,fn)=>{ x.save(); x.beginPath(); x.rect(k*PW,0,PW,PH); x.clip(); x.translate(k*PW,0); x.scale(PW/256,PH/96); fn(); x.restore(); };
  const bg=(a,b)=>{ const g=x.createLinearGradient(0,0,0,96); g.addColorStop(0,a); g.addColorStop(1,b); x.fillStyle=g; x.fillRect(0,0,256,96); };
  panel(0,()=>{ bg("#ff4a3c","#a80f18"); x.fillStyle=B.night; x.beginPath(); x.moveTo(-5,0); x.lineTo(60,0); x.lineTo(22,96); x.lineTo(-5,96); x.fill(); words(x,"MOTOCROSS",150,32,30,B.white,"#3a0509"); words(x,"WAR",160,70,46,B.night,B.white); });
  panel(1,()=>{ bg("#15182a",B.night); chevrons(x,6,34,64,28,4,B.red); chevrons(x,186,34,64,28,4,B.red); words(x,"WAR",128,50,64,B.gold,"#3a1a05"); });
  panel(2,()=>{ bg("#fafafc","#cfd0d8"); x.fillStyle=B.red; for(let i=-2;i<10;i++){ x.beginPath(); x.moveTo(i*34,96); x.lineTo(i*34+20,96); x.lineTo(i*34+60,0); x.lineTo(i*34+40,0); x.fill(); } words(x,"FULL SEND",128,48,36,B.night,B.white,0.2); });
  panel(3,()=>{ bg("#ffd98a","#c4902c"); x.strokeStyle=B.night; x.lineWidth=5; x.strokeRect(10,10,236,76); words(x,"MAIN",128,34,34,B.night,null); words(x,"EVENT",128,70,34,B.night,null); });
  panel(4,()=>{ bg("#2d6cff","#0a2a8a"); x.strokeStyle="rgba(255,255,255,0.6)"; x.lineWidth=3; x.beginPath(); for(let i=0;i<=256;i+=8) x.lineTo(i,80+Math.sin(i*0.06)*6); x.stroke(); words(x,"ACE HIGH",128,38,40,B.white,"#06164a"); });
  panel(5,()=>{ bg(B.night,"#14161e"); for(let i=0;i<16;i++) for(let j=0;j<2;j++){ x.fillStyle=(i+j)%2?B.white:B.night; x.fillRect(i*16,j*8,16,8); x.fillRect(i*16,88-j*8,16,8); } words(x,"HOLESHOT",128,48,38,B.red,B.white); });
  panel(6,()=>{ bg("#ff3b2e","#9c0f16"); words(x,"DOUBLE WAR",128,34,34,B.white,"#3a0509"); words(x,"TRIPLE WAR",128,72,28,B.gold,"#3a0509"); });
  panel(7,()=>{ bg("#171b30","#0b0d18"); x.strokeStyle=B.gold; x.lineWidth=2; x.strokeRect(6,6,244,84); for(let i=0;i<4;i++) words(x,"MX WAR",36+i*62,48,20,i%2?B.gold:B.white,null); });
  for(let k=0;k<8;k++){ x.fillStyle="rgba(0,0,0,0.5)"; x.fillRect(k*PW,0,Math.max(1,PW/128),PH); }   /* the joints between the boards */
  worn(x,W,PH,R,lo?60:220,"#1c120c");
  const t=tex(c,true); t.anisotropy=getAniso(); return t;
}
/* the LED ribbon that runs round the bowl: dot-matrix words, scrolled by the view */
export function ribbonTex(lo){
  const W=lo?512:1024, H=lo?32:64, c=canvas(W,H), x=c.getContext("2d"), B=BRAND;
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#0a1a4a"); g.addColorStop(0.5,"#0f2a78"); g.addColorStop(1,"#081238"); x.fillStyle=g; x.fillRect(0,0,W,H);
  const items=[["MOTOCROSS WAR",B.white],["FULL SEND",B.gold],["DOUBLE WAR",B.white],["ACE HIGH",B.gold]];
  const sl=W/items.length;
  items.forEach((it,i)=>{ words(x,it[0],sl*(i+0.5),H*0.52,H*0.6,it[1],null,0.2,null,sl*0.78); x.fillStyle=B.red; x.fillRect(sl*i-3,H*0.2,6,H*0.6); });
  const gl=x.createLinearGradient(0,0,0,H); gl.addColorStop(0,"rgba(255,255,255,0.25)"); gl.addColorStop(0.5,"rgba(255,255,255,0)"); x.fillStyle=gl; x.fillRect(0,0,W,H*0.5);
  if(!lo){ x.fillStyle="rgba(0,0,0,0.32)"; for(let y=0;y<H;y+=3) x.fillRect(0,y,W,1); for(let xx=0;xx<W;xx+=3) x.fillRect(xx,0,1,H); }
  const t=tex(c,true); t.anisotropy=getAniso(); return t;
}
/* the suites: a band of lit boxes (warm light, a few TVs, people in the glass), a counter rail along the bottom */
export function suitesTex(lo){
  const W=lo?256:512, H=lo?64:128, c=canvas(W,H), x=c.getContext("2d"), R=rngf(31), n=8, w=W/n;
  x.fillStyle="#0a0a10"; x.fillRect(0,0,W,H);
  for(let i=0;i<n;i++){ const px=i*w, lit=R()<0.9, k=0.5+R()*0.38, cool=R()<0.18;
    const g=x.createLinearGradient(0,H*0.14,0,H*0.86); if(lit){ const c0=cool?[215,232,255]:[255,238,205], c1=cool?[170,200,240]:[246,208,142], c2=cool?[90,120,170]:[170,118,62]; g.addColorStop(0,"rgb("+(c0[0]*k|0)+","+(c0[1]*k|0)+","+(c0[2]*k|0)+")"); g.addColorStop(0.55,"rgb("+(c1[0]*k|0)+","+(c1[1]*k|0)+","+(c1[2]*k|0)+")"); g.addColorStop(1,"rgb("+(c2[0]*k|0)+","+(c2[1]*k|0)+","+(c2[2]*k|0)+")"); } else { g.addColorStop(0,"#2a2e3c"); g.addColorStop(1,"#141620"); }
    x.fillStyle=g; x.fillRect(px+w*0.1,H*0.14,w*0.8,H*0.72);
    if(lit&&R()<0.25){ x.fillStyle="rgba(120,180,255,0.85)"; x.fillRect(px+w*0.58,H*0.22,w*0.24,H*0.15); }
    if(lit) for(let p=0;p<Math.floor(R()*3);p++){ const sx=px+w*(0.2+R()*0.6), sy=H*(0.66+R()*0.08); x.fillStyle="rgba(50,30,20,0.45)"; x.beginPath(); x.arc(sx,sy-H*0.07,H*0.04,0,7); x.fill(); x.fillRect(sx-H*0.06,sy-H*0.03,H*0.12,H*0.2); }
    x.fillStyle="rgba(255,255,255,0.55)"; x.fillRect(px+w*0.1,H*0.14,w*0.8,H*0.025);
    x.fillStyle="#0a0a10"; x.fillRect(px+w*0.5-1.5,H*0.14,3,H*0.72);
    x.fillStyle="#3c3c48"; x.fillRect(px+w*0.06,H*0.86,w*0.88,H*0.05); }
  x.fillStyle="#1c1c26"; x.fillRect(0,0,W,H*0.1); x.fillStyle="rgba(255,255,255,0.14)"; x.fillRect(0,H*0.1,W,2);
  const t=tex(c,true); t.anisotropy=getAniso(); return t;
}
/* the big video board: original graphics, plain text: the lap, the leader's number, the race clock */
export function drawBoard(x,W,H,st){
  const B=BRAND; x.save();
  let g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,"#101a3a"); g.addColorStop(1,"#070a16"); x.fillStyle=g; x.fillRect(0,0,W,H);
  x.scale(W/512,H/256);
  g=x.createLinearGradient(0,0,512,0); g.addColorStop(0,"#ff3a30"); g.addColorStop(1,"#b01018"); x.fillStyle=g; x.fillRect(0,0,512,50);
  x.fillStyle=B.night; x.beginPath(); x.moveTo(300,0); x.lineTo(330,0); x.lineTo(300,50); x.lineTo(270,50); x.fill();
  words(x,"MOTOCROSS WAR",150,26,30,B.white,"#4a0508"); x.textAlign="right"; x.font="900 22px "+FONT; x.fillStyle=B.gold; x.fillText("LIVE",492,28);
  const lap=st.lap|0, len=st.len|0;
  x.textAlign="left"; x.textBaseline="alphabetic"; x.font="800 22px "+FONT; x.fillStyle=B.gold; x.fillText(lap>0?"LAP":"RACE",24,96);
  x.font="900 108px "+FONT; x.fillStyle=B.white; const big=lap>0?String(lap):String(len); x.fillText(big,24,196); const bw=x.measureText(big).width;
  x.font="800 40px "+FONT; x.fillStyle=B.gold; x.fillText(lap>0?"/ "+len:"LAPS",24+bw+10,196);
  if(st.num!=null){ x.font="800 22px "+FONT; x.fillStyle=B.gold; x.fillText("LEADER",290,96); x.font="900 80px "+FONT; x.fillStyle=B.white; x.fillText("#"+st.num,280,186); }
  if(st.T!=null){ const s=Math.floor(Math.max(0,st.T)), m=Math.floor(s/60), r=s%60; x.fillStyle="rgba(255,255,255,0.1)"; x.fillRect(0,214,512,42); x.font="800 30px "+FONT; x.fillStyle=B.white; x.textAlign="center"; x.fillText("TIME  "+m+":"+(r<10?"0":"")+r,256,246); }
  x.restore();
  x.fillStyle="rgba(0,0,0,0.18)"; for(let y=0;y<H;y+=3) x.fillRect(0,y,W,1);   /* the LED rows */
}
/* a starburst: a bright core, four long rays and four short ones (the flare of a stadium light) */
export function starTex(){
  const S=128, c=canvas(S,S), x=c.getContext("2d");
  let g=x.createRadialGradient(64,64,0,64,64,64); g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.1,"rgba(255,244,220,0.8)"); g.addColorStop(0.35,"rgba(255,226,170,0.16)"); g.addColorStop(1,"rgba(255,220,160,0)"); x.fillStyle=g; x.fillRect(0,0,S,S);
  const ray=(ang,len,wd,a)=>{ x.save(); x.translate(64,64); x.rotate(ang); const gg=x.createLinearGradient(-len,0,len,0); gg.addColorStop(0,"rgba(255,240,210,0)"); gg.addColorStop(0.5,"rgba(255,250,235,"+a+")"); gg.addColorStop(1,"rgba(255,240,210,0)"); x.fillStyle=gg; x.beginPath(); x.ellipse(0,0,len,wd,0,0,7); x.fill(); x.restore(); };
  ray(0,64,2.2,0.9); ray(Math.PI/2,64,2.2,0.9); ray(Math.PI/4,44,1.4,0.5); ray(-Math.PI/4,44,1.4,0.5);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
/* a soft round light */
export function softTex(){
  const c=canvas(64,64), x=c.getContext("2d"), g=x.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,"rgba(255,255,255,1)"); g.addColorStop(0.16,"rgba(255,246,224,0.9)"); g.addColorStop(0.45,"rgba(255,232,190,0.2)"); g.addColorStop(1,"rgba(255,230,180,0)"); x.fillStyle=g; x.fillRect(0,0,64,64);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}
/* the sprite sheet the glow shader reads: the soft light on the left, the starburst on the right (u 0..0.5, 0.5..1) */
export function glowSheet(){
  const c=canvas(256,128), x=c.getContext("2d"); x.drawImage(softTex().image,0,0,128,128); x.drawImage(starTex().image,128,0,128,128);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t;
}

/* ---------------- props: the start gate's and the finish arch's banners (one texture: a white block for the plain steel, the two banners) ---------------- */
export const PROPS={w:1024,h:512,white:[0,480,32,32],gate:[0,32,1024,96],finish:[0,128,1024,96],ban:[[0,240,240,230],[256,240,240,230],[512,240,240,230],[768,240,240,230]]};
/* the uv rectangle (u0, v0, u1, v1) of a region of the props texture (v up) */
export function propsUV(r){ return [r[0]/PROPS.w,1-(r[1]+r[3])/PROPS.h,(r[0]+r[2])/PROPS.w,1-r[1]/PROPS.h]; }
/* Reduce effects (the Stick): the props texture is drawn at half size (the art is laid out in 1024 x 512 design units) */
function loMode(){ try{ const d=document.documentElement; return d.getAttribute("data-effects")==="reduced"||d.getAttribute("data-motion")==="reduce"; }catch(e){ return false; } }
const PTEX=[null,null];
export function propsTex(){
  const lo=loMode()?1:0; if(PTEX[lo]) return PTEX[lo];
  const sc=lo?0.5:1, c=canvas(PROPS.w*sc,PROPS.h*sc), x=c.getContext("2d"), B=BRAND, R=rngf(88); x.scale(sc,sc);
  x.fillStyle="#ffffff"; x.fillRect(0,0,PROPS.w,PROPS.h);   /* white everywhere but the art: the plain steel samples it (uv 0,0 is its bottom-left corner) */
  /* the gate banner: war red with the black slash, MOTOCROSS WAR, the gold START */
  let r=PROPS.gate; x.save(); x.beginPath(); x.rect(r[0],r[1],r[2],r[3]); x.clip(); x.translate(r[0],r[1]);
  let g=x.createLinearGradient(0,0,0,r[3]); g.addColorStop(0,"#ff4a3c"); g.addColorStop(1,"#a80f18"); x.fillStyle=g; x.fillRect(0,0,r[2],r[3]);
  x.fillStyle=B.night; x.beginPath(); x.moveTo(0,0); x.lineTo(260,0); x.lineTo(210,r[3]); x.lineTo(0,r[3]); x.fill();
  x.fillStyle=B.gold; x.beginPath(); x.moveTo(760,0); x.lineTo(1024,0); x.lineTo(1024,r[3]); x.lineTo(710,r[3]); x.fill();
  words(x,"MOTOCROSS WAR",500,50,66,B.white,"#3a0509",0.22,null,440); words(x,"START",868,50,64,B.night,null,0.22,null,230); words(x,"WAR",110,52,62,B.red,B.white,0.22,null,150);
  worn(x,r[2],r[3],R,70,"#3a0509"); x.restore();
  /* the finish banner: a checkered band round the word FINISH */
  r=PROPS.finish; x.save(); x.beginPath(); x.rect(r[0],r[1],r[2],r[3]); x.clip(); x.translate(r[0],r[1]);
  for(let i=0;i<64;i++) for(let j=0;j<6;j++){ x.fillStyle=(i+j)%2?B.night:B.white; x.fillRect(i*16,j*16,16,16); }
  x.fillStyle=B.red; x.fillRect(250,12,524,72); x.strokeStyle=B.white; x.lineWidth=4; x.strokeRect(250,12,524,72); words(x,"FINISH",512,50,64,B.white,"#3a0509",0.2,null,480);
  x.restore();
  /* four tall banners (drawn in a 120 x 230 design space, stretched 2x across: they hang 3.2 m x 6 m): they hang from the roof edge of the bowl */
  const ban=[
    (g)=>{ g.addColorStop(0,"#ff4a3c"); g.addColorStop(1,"#8f0c14"); },
    (g)=>{ g.addColorStop(0,"#171b30"); g.addColorStop(1,B.night); },
    (g)=>{ g.addColorStop(0,"#ffd98a"); g.addColorStop(1,"#c4902c"); },
    (g)=>{ g.addColorStop(0,"#f0f1f3"); g.addColorStop(1,"#c0c2cc"); }];
  PROPS.ban.forEach((r,k)=>{ x.save(); x.beginPath(); x.rect(r[0],r[1],r[2],r[3]); x.clip(); x.translate(r[0],r[1]); x.scale(2,1);
    const g=x.createLinearGradient(0,0,0,230); ban[k](g); x.fillStyle=g; x.fillRect(0,0,120,230);
    if(k===0){ x.fillStyle=B.night; x.beginPath(); x.moveTo(0,0); x.lineTo(46,0); x.lineTo(0,120); x.fill(); words(x,"MOTOCROSS",60,26,19,B.white,"#3a0509",0.2,null,112); ["W","A","R"].forEach((ch,i)=>words(x,ch,60,78+i*46,56,B.white,"#3a0509",0.18)); words(x,"MAIN EVENT",60,214,15,B.gold,"#3a0509",0.2,null,112); }
    else if(k===1){ chevrons(x,0,18,120,34,3,B.red); words(x,"FULL",60,86,46,B.white,B.red,0.18,null,112); words(x,"SEND",60,138,46,B.gold,"#3a1a05",0.18,null,112); chevrons(x,0,176,120,34,3,B.red); }
    else if(k===2){ words(x,"ACE",60,64,56,B.night,null,0.18,null,112); words(x,"HIGH",60,122,48,B.red,B.white,0.18,null,112); x.fillStyle=B.night; x.fillRect(10,160,100,4); words(x,"MOTOCROSS WAR",60,192,13,B.night,null,0.2,null,110); }
    else { for(let i=0;i<8;i++) for(let j=0;j<4;j++){ x.fillStyle=(i+j)%2?B.night:B.white; x.fillRect(i*15,j*15,15,15); x.fillRect(i*15,170+j*15,15,15); } words(x,"DOUBLE",60,86,30,B.red,B.night,0.18,null,112); words(x,"WAR",60,132,48,B.night,B.red,0.18,null,112); }
    worn(x,120,230,R,26,"#1c120c"); x.restore(); });
  const t=tex(c,false); t.anisotropy=getAniso(); PTEX[lo]=t; return t;
}
