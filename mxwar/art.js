/* MOTOCROSS WAR — the art (original; gradients and plain shapes only: no filters, no <text>, no URLs, no logos or sponsor marks).
   window.MXWar.Art (node: module.exports, used by BG_audit/sprint/mxbuild/page/gen-art.js for the hero, the tile and the icons):
   - mk(make): a bike make's plain-text colours [background, ink] (the CEO: "Honda red, Yamaha blue, Kawasaki green..."; colours and names
     only, never a logo or a mark), mkStyle(make) the inline style for a badge or a plate;
   - bike(color, accent): a generic dirt bike and rider seen from the side (viewBox 0 0 60 40, facing right);
   - track(kind, uid): the arena behind a race: "stadium" (a supercross night: stands, lights, a dirt floor, tuff blocks, whoops, a
     tabletop) or "outdoor" (a national: sky, hills, trees, a dirt ribbon on grass); viewBox 0 0 1000 400, sliced to fill;
   - gate(): the steel starting gate (viewBox 0 0 20 160); flag(): the checkered flag; wflag(): the white flag (the last lap);
   - suit(s): a suit symbol path (viewBox 0 0 100 100); card(id, up, extra): a playing card's HTML (ids as race.js: id % 54). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Art) return;

/* ---------------- bike makes: colours and names as plain text ---------------- */
var MK={
  "Honda":["#d62828","#ffffff"], "Yamaha":["#1f4fc4","#ffffff"], "Kawasaki":["#57b947","#0b0a12"], "Suzuki":["#f2cf1d","#0b0a12"],
  "KTM":["#ff7a1a","#0b0a12"], "Husqvarna":["#f2f4f8","#183a8c"], "GasGas":["#a8101c","#ffffff"], "Maico":["#e6dcc0","#1d1a24"],
  "CZ":["#7d1f1f","#ffffff"], "Bultaco":["#a8adb5","#0b0a12"], "Can-Am":["#26292e","#ffd23f"], "Beta":["#c3102a","#ffffff"],
  "Penton":["#ef7d22","#0b0a12"], "Triumph":["#1b1b1e","#e8e8ee"], "Harley-Davidson":["#121214","#ff8a3d"], "Ducati":["#c8101e","#ffffff"],
  "ATK":["#2c5d9c","#ffffff"], "Montesa":["#d9262e","#ffffff"], "Cannondale":["#8cc63f","#0b0a12"], "Greeves":["#1f6f5c","#ffffff"],
  "Carabela":["#3a3a44","#ffffff"], "Cagiva":["#b01c2e","#ffffff"], "Ammex/Islo":["#55555f","#ffffff"], "AJS":["#222226","#f0d48a"],
  "Privateer":["#6b6f7a","#ffffff"]   // v2: a rider whose make no source gives rides "Privateer" (its own neutral colour)
};
var MK0=["#3a3a44","#e8e8f0"];
var MODERN=["Honda","Yamaha","Kawasaki","Suzuki","KTM","Husqvarna","GasGas"];
function mk(make){ return MK[make]||MK0; }
function mkStyle(make){ var c=mk(make); return "--mk:"+c[0]+";--mk-ink:"+c[1]; }

/* ---------------- a generic dirt bike and rider (side view, facing right) ---------------- */
function bike(color,accent){
  color=color||"#d62828"; accent=accent||"#f2f2f6";
  return '<svg viewBox="0 0 60 40" aria-hidden="true" focusable="false">'+
    '<g fill="none" stroke="#111116" stroke-width="3.4"><circle cx="13" cy="30" r="8.2"/><circle cx="48" cy="30" r="8.2"/></g>'+
    '<g fill="none" stroke="#8d8d98" stroke-width="1.1"><circle cx="13" cy="30" r="5.6"/><circle cx="48" cy="30" r="5.6"/></g>'+
    '<path d="M13 30L27 25" stroke="#9a9aa6" stroke-width="2.4" stroke-linecap="round"/>'+
    '<path d="M48 30L41.5 12" stroke="#c9c9d2" stroke-width="2.6" stroke-linecap="round"/>'+
    '<path d="M25 21h10v7h-10z" fill="#2a2a32"/>'+
    '<path d="M4 15.5L23 18.5L23 22L8 19.5Z" fill="'+color+'"/>'+
    '<path d="M18 19L29 15.5L40 12.5L44.5 13.5L41 18.5L30 21.5L21 22.5Z" fill="'+color+'"/>'+
    '<path d="M40 14.5L55 16.5L53.5 18.5L41.5 17.5Z" fill="'+color+'"/>'+
    '<path d="M24 18.6L37 15.2" stroke="'+accent+'" stroke-width="1.3" stroke-linecap="round" opacity=".85"/>'+
    '<path d="M41 11.5L38 8.5" stroke="#111116" stroke-width="1.8" stroke-linecap="round"/>'+
    '<path d="M27.5 16.5L33.5 7.5" stroke="#1d1d24" stroke-width="4.2" stroke-linecap="round"/>'+
    '<path d="M33 9L38.5 9.5" stroke="#1d1d24" stroke-width="2.6" stroke-linecap="round"/>'+
    '<path d="M27.5 17L31 24.5L34 24.5" stroke="#1d1d24" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>'+
    '<circle cx="35.4" cy="4.6" r="4.1" fill="'+color+'"/>'+
    '<path d="M36 3.3h3.6v2.6h-3.2z" fill="#151519"/>'+
    '<path d="M31.6 3.8a4 4 0 0 1 3-3" stroke="'+accent+'" stroke-width="1" fill="none" opacity=".8"/>'+
  '</svg>';
}

/* ---------------- the arena behind a race ---------------- */
function track(kind,uid){
  var u="mxt"+(uid||"");
  if(kind==="outdoor") return '<svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>'+
    '<linearGradient id="'+u+'s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c2a4a"/><stop offset=".55" stop-color="#4a5b7a"/><stop offset="1" stop-color="#b98a5a"/></linearGradient>'+
    '<linearGradient id="'+u+'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f4a22"/><stop offset="1" stop-color="#14200f"/></linearGradient>'+
    '<linearGradient id="'+u+'d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6240"/><stop offset="1" stop-color="#5a3d26"/></linearGradient>'+
    '<radialGradient id="'+u+'sun" cx="820" cy="58" r="160" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffe2a8" stop-opacity=".85"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="'+u+'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0a08" stop-opacity=".2"/><stop offset=".45" stop-color="#0d0a08" stop-opacity=".72"/><stop offset="1" stop-color="#0d0a08" stop-opacity=".9"/></linearGradient></defs>'+
    '<rect width="1000" height="400" fill="url(#'+u+'g)"/><rect width="1000" height="96" fill="url(#'+u+'s)"/><rect width="1000" height="140" fill="url(#'+u+'sun)"/>'+
    '<path d="M0 92C90 58 170 70 260 52C360 32 430 66 520 58C620 48 700 30 800 44C880 55 940 50 1000 40V110H0Z" fill="#3d5a35"/>'+
    '<path d="M0 104C120 86 220 98 330 84C450 70 560 96 690 82C800 72 900 88 1000 78V130H0Z" fill="#2c4426"/>'+
    '<g fill="#18291a">'+[40,95,150,610,655,700,905,950].map(function(x,i){ var h=26+(i%3)*8; return '<path d="M'+x+' '+(108-h)+'L'+(x-11)+' 110H'+(x+11)+'Z"/>'; }).join("")+'</g>'+
    '<path d="M-10 118C200 104 420 126 640 112C800 102 900 112 1010 106V168C900 172 800 162 640 172C420 186 200 162 -10 176Z" fill="url(#'+u+'d)"/>'+
    '<path d="M-10 118C200 104 420 126 640 112C800 102 900 112 1010 106" fill="none" stroke="#c9a77c" stroke-width="3" opacity=".7"/>'+
    '<path d="M-10 176C200 162 420 186 640 172C800 162 900 172 1010 168" fill="none" stroke="#2a1c10" stroke-width="4" opacity=".6"/>'+
    '<g fill="#a5784e" opacity=".55">'+[0,1,2,3,4,5].map(function(i){ return '<ellipse cx="'+(560+i*38)+'" cy="'+(142-i)+'" rx="15" ry="5"/>'; }).join("")+'</g>'+
    '<path d="M0 250C180 230 330 262 520 248C700 236 840 262 1000 246V400H0Z" fill="#5a3d26" opacity=".55"/>'+
    '<g stroke="#e9e3d2" stroke-width="3" opacity=".55">'+[90,250,410,570,730,890].map(function(x){ return '<path d="M'+x+' 190V214"/>'; }).join("")+'</g>'+
    '<rect y="150" width="1000" height="250" fill="url(#'+u+'k)"/></svg>';
  return '<svg viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><defs>'+
    '<linearGradient id="'+u+'n" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07060b"/><stop offset="1" stop-color="#1d1520"/></linearGradient>'+
    '<linearGradient id="'+u+'f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a4a30"/><stop offset=".5" stop-color="#4a3220"/><stop offset="1" stop-color="#2b1d12"/></linearGradient>'+
    '<linearGradient id="'+u+'st" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2433"/><stop offset="1" stop-color="#141019"/></linearGradient>'+
    '<radialGradient id="'+u+'l1" cx="160" cy="18" r="230" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff4d6" stop-opacity=".55"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient>'+
    '<radialGradient id="'+u+'l2" cx="840" cy="18" r="230" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff4d6" stop-opacity=".55"/><stop offset="1" stop-color="#fff4d6" stop-opacity="0"/></radialGradient>'+
    '<linearGradient id="'+u+'k" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d0a08" stop-opacity=".25"/><stop offset=".45" stop-color="#0d0a08" stop-opacity=".72"/><stop offset="1" stop-color="#0d0a08" stop-opacity=".9"/></linearGradient></defs>'+
    '<rect width="1000" height="400" fill="url(#'+u+'f)"/><rect width="1000" height="70" fill="url(#'+u+'n)"/>'+
    '<path d="M0 22H1000V58H0Z" fill="url(#'+u+'st)"/>'+
    '<g stroke="#3b3346" stroke-width="2">'+[28,36,44,52].map(function(y){ return '<path d="M0 '+y+'H1000"/>'; }).join("")+'</g>'+
    '<g fill="#5c5268" opacity=".55">'+Array.apply(null,{length:44}).map(function(_,i){ return '<rect x="'+(8+i*23)+'" y="'+(25+(i*7)%22)+'" width="6" height="4" rx="2"/>'; }).join("")+'</g>'+
    '<path d="M0 58H1000V64H0Z" fill="#8f8a96"/>'+
    '<rect width="1000" height="260" fill="url(#'+u+'l1)"/><rect width="1000" height="260" fill="url(#'+u+'l2)"/>'+
    '<g fill="#fff8e6"><circle cx="160" cy="10" r="5"/><circle cx="175" cy="10" r="5"/><circle cx="145" cy="10" r="5"/><circle cx="825" cy="10" r="5"/><circle cx="840" cy="10" r="5"/><circle cx="855" cy="10" r="5"/></g>'+
    '<path d="M0 72H1000V160H0Z" fill="#7a5638" opacity=".75"/>'+
    '<g fill="#e9e3d2" opacity=".85">'+Array.apply(null,{length:21}).map(function(_,i){ return '<rect x="'+(i*50)+'" y="68" width="34" height="7" rx="2"/>'; }).join("")+'</g>'+
    '<g fill="#e9e3d2" opacity=".7">'+Array.apply(null,{length:21}).map(function(_,i){ return '<rect x="'+(18+i*50)+'" y="160" width="34" height="7" rx="2"/>'; }).join("")+'</g>'+
    '<path d="M905 72C990 100 990 150 905 168" fill="none" stroke="#9a7048" stroke-width="16" opacity=".6"/>'+
    '<g fill="#93694a" opacity=".6">'+[0,1,2,3,4,5,6,7].map(function(i){ return '<ellipse cx="'+(120+i*44)+'" cy="248" rx="18" ry="7"/>'; }).join("")+'</g>'+
    '<path d="M560 268L610 232H760L810 268Z" fill="#8a6240" opacity=".6"/>'+
    '<rect y="168" width="1000" height="232" fill="url(#'+u+'k)"/></svg>';
}

/* ---------------- the starting gate (it falls back toward the riders when it drops) and the checkered flag ---------------- */
function gate(){
  var bars="", y;
  for(y=8;y<156;y+=14) bars+='<rect x="3" y="'+y+'" width="14" height="10" rx="1.5" fill="'+((y/14|0)%2?"#d9dbe2":"#9ea2ae")+'"/>';
  return '<svg viewBox="0 0 20 160" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect x="0" y="0" width="20" height="160" rx="3" fill="#2a2a32"/>'+bars+
    '<rect x="1" y="0" width="3" height="160" fill="#c99f5e"/><rect x="16" y="0" width="3" height="160" fill="#c99f5e"/></svg>';
}
function flag(){
  var sq="", r, c;
  for(r=0;r<4;r++) for(c=0;c<6;c++) sq+='<rect x="'+(8+c*8)+'" y="'+(3+r*7)+'" width="8" height="7" fill="'+((r+c)%2?"#111116":"#f6f2e8")+'"/>';
  return '<svg class="mx-flag" viewBox="0 0 60 40" aria-hidden="true" focusable="false"><rect x="4" y="2" width="3" height="37" rx="1.5" fill="#c99f5e"/><g transform="skewY(-6) translate(0 4)">'+sq+'</g></svg>';
}

/* the white flag (v2: the last lap) */
function wflag(){
  return '<svg class="mx-flag mx-wflag" viewBox="0 0 60 40" aria-hidden="true" focusable="false"><rect x="4" y="2" width="3" height="37" rx="1.5" fill="#c99f5e"/>'+
    '<path d="M8 4C20 1 30 9 42 5C47 3.5 51 3 54 4V28C51 27 47 27.5 42 29C30 33 20 25 8 28Z" fill="#fbfaf5" stroke="#22222a" stroke-width="1.2"/></svg>';
}

/* the yellow flag (3D: in the lap bug while a crash's yellow flag is out) */
function yflag(){
  return '<svg class="mx-flag mx-yflag" viewBox="0 0 60 40" aria-hidden="true" focusable="false"><rect x="4" y="2" width="3" height="37" rx="1.5" fill="#c99f5e"/>'+
    '<path d="M8 4C20 1 30 9 42 5C47 3.5 51 3 54 4V28C51 27 47 27.5 42 29C30 33 20 25 8 28Z" fill="#f6d21c" stroke="#22222a" stroke-width="1.2"/></svg>';
}

/* ---------------- cards ---------------- */
var SUIT={
  S:'<path fill="currentColor" d="M50 5C50 5 13 38 13 62C13 76 24 85 36 85C42 85 47 82 49 79C48 89 44 94 35 97H65C56 94 52 89 51 79C53 82 58 85 64 85C76 85 87 76 87 62C87 38 50 5 50 5Z"/>',
  H:'<path fill="currentColor" d="M50 94C19 68 7 49 7 32C7 17 18 7 31 7C40 7 47 12 50 20C53 12 60 7 69 7C82 7 93 17 93 32C93 49 81 68 50 94Z"/>',
  D:'<path fill="currentColor" d="M50 3C60 22 76 38 90 50C76 62 60 78 50 97C40 78 24 62 10 50C24 38 40 22 50 3Z"/>',
  C:'<g fill="currentColor"><circle cx="50" cy="27" r="21"/><circle cx="27" cy="62" r="21"/><circle cx="73" cy="62" r="21"/><path d="M50 50C50 72 46 85 37 96H63C54 85 50 72 50 50Z"/></g>',
  J:'<path fill="currentColor" d="M50 4L61 37H96L68 58L79 92L50 71L21 92L32 58L4 37H39Z"/>'
};
var SUITS=["S","H","D","C"];
function info(id){ id=(+id)%54; if(id>=52) return {r:15,s:"J",red:id===52}; var s=SUITS[(id/13)|0]; return {r:2+id%13,s:s,red:s==="H"||s==="D"}; }
function rankLabel(r){ return r===15?"JK":r===14?"A":r===13?"K":r===12?"Q":r===11?"J":String(r); }
function suit(s){ return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">'+(SUIT[s]||SUIT.S)+'</svg>'; }
function face(id){
  var c=info(id), r=rankLabel(c.r), sv=suit(c.s);
  return '<div class="mx-cf'+(c.red?" is-red":"")+(c.s==="J"?" is-jk":"")+'"><span class="mx-ck"><b>'+r+'</b>'+sv+'</span><span class="mx-cs">'+sv+'</span><span class="mx-ck is-b"><b>'+r+'</b>'+sv+'</span></div>';
}
function cardInner(id){ return '<div class="mx-ci">'+(id!=null?face(id):'<div class="mx-cf"></div>')+'<div class="mx-cb"></div></div>'; }
function chip(id){ if(id==null) return ""; var c=info(id); return '<span class="mx-tw__cv">'+rankLabel(c.r)+'</span>'+suit(c.s); }
function chipRed(id){ return id!=null&&info(id).red; }
function short(id){ var c=info(id); return rankLabel(c.r)+({S:"♠",H:"♥",D:"♦",C:"♣",J:""}[c.s]); }

MX.Art={MK:MK,MODERN:MODERN,mk:mk,mkStyle:mkStyle,bike:bike,track:track,gate:gate,flag:flag,wflag:wflag,yflag:yflag,suit:suit,info:info,rankLabel:rankLabel,face:face,cardInner:cardInner,chip:chip,chipRed:chipRed,short:short};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Art;
})(typeof window!=="undefined"?window:globalThis);
