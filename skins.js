/* Board Games — animated backgrounds + board frames. Skins.apply("trouble"|"sorry"|"monopoly"|"party") */
/* Midnight Luxe (step 4): on a page that loads ui/ui.js, Skins.apply(game) hands over to BGUI.stage(game): html[data-game], the
   Luxe ambient layer (orbs + rising gold-line motifs on the ONE effects ticker, honouring "Reduce effects", reduced motion and a
   hidden page) and Luxe board frames (gold hairline + soft static shadow, no filter) on the same board elements as before.
   ui.js is loaded with defer, so it runs after the page's own scripts: when the page calls Skins.apply() before BGUI exists,
   the Luxe stage is applied on DOMContentLoaded (by then the deferred ui.js has run). If ui.js never arrives, the old skin is
   used. Pages that do not load ui.js keep the old animated skins below, unchanged. Skins.mode() = "luxe" | "classic". */
(function(g){
"use strict";
/* TV (?tv=1 = the Fire TV app, or its AndroidTV bridge): fewer moving pieces (the TV screen is wide, so they still fill it). */
var TV=(function(){ try{ return /[?&]tv=1(&|$)/.test(location.search)||!!g.AndroidTV; }catch(e){ return false; } })();
var STEP=50;   // ms between background frames: 20 a second, every 3rd refresh of a 60 Hz screen (was every refresh)
/* "animation:" for a piece: duration (split in segs equal segments) and delay rounded to whole STEPs, steps() timing, so every
   piece changes at the same moments and nothing changes in between. */
/* Apple WebKit (Safari and every iPhone/iPad browser) may not run steps() animations on the compositor, so there they keep
   plain linear timing (same durations and paths), which it does accelerate. */
var APPLE=(function(){ try{ var n=g.navigator||{}; return /Apple/.test(n.vendor||"")||/iP(hone|ad|od)/.test(n.userAgent||""); }catch(e){ return false; } })();
function anim(name,durS,delS,segs){ segs=segs||1;
  var sd=Math.max(1,Math.round(durS*1000/segs/STEP)), l=Math.round(delS*1000/STEP)*STEP;
  return "animation:"+name+" "+(sd*STEP*segs)+"ms "+(APPLE?"linear":"steps("+sd+")")+" "+(-l)+"ms infinite"; }
function pulse(name,f){ var k="@keyframes "+name+"{"; for(var i=0;i<=16;i++) k+=(i*6.25)+"%{"+f((1-Math.cos(Math.PI*i/8))/2)+"}"; return k+"}"; }
var CSS=
'#bgskin{position:fixed;inset:0;overflow:hidden;z-index:-1;pointer-events:none}'+
'#bgskin *{position:absolute}'+
/* CPU (shell-13): almost all of the cost was drawing a new background frame 60 times a second. Now every animation moves in
   steps of STEP ms that line up across all pieces (see anim), so a new frame is drawn only 20 times a second, with
   the same paths, speeds and colours. Keyframes hold literal values (one set per floater, no var()), only animated pieces
   are layers (.bga), and static stripes, skylines and vignettes are painted once. */
'#bgskin .bga{will-change:transform}'+
'@keyframes bgspin{to{transform:rotate(360deg)}}'+
pulse("bgtwinkle",function(t){ return "opacity:"+(.12+.78*t).toFixed(3); })+
'@keyframes bgdrift{0%{transform:translateX(-30vw) rotate(-18deg)}100%{transform:translateX(130vw) rotate(-18deg)}}'+
pulse("bgbreathe",function(t){ return "transform:scale("+(1+.08*t).toFixed(4)+");opacity:"+(.55+.3*t).toFixed(3); })+
/* "Reduce motion" in the phone/TV settings: a still background. Every animated piece carries an inline still pose (a point on
   its path, a mid opacity) that the running animation overrides, so it simply stays there. */
'@media (prefers-reduced-motion:reduce){#bgskin *{animation:none!important}}'+
/* board frames */
'body.skin-trouble #board,body.skin-trouble #tboard{filter:drop-shadow(0 0 22px rgba(91,140,255,.45)) drop-shadow(0 12px 20px rgba(0,0,0,.7))}'+
'body.skin-sorry #boardWrap{border-radius:26px;box-shadow:0 0 0 6px #c62222,0 0 0 11px #eec21b,0 0 0 16px #27a758,0 0 0 21px #2b7be0,0 24px 54px rgba(0,0,0,.75)}'+
'body.skin-risk #rkframe{border-radius:16px;box-shadow:0 0 0 6px #5a3a1c,0 0 0 10px #c79a4a,0 0 0 13px #3a230f,0 24px 56px rgba(0,0,0,.8)}'+
'body.skin-rummy500 #rtable,body.skin-rummy500 #boardWrap{border-radius:34px;box-shadow:0 0 0 7px #5b3a1e,0 0 0 11px #8a5a2b,0 0 0 14px #3a230f,0 26px 60px rgba(0,0,0,.8)}'+
'body.skin-monopoly #board,body.skin-monopoly .mboard{box-shadow:0 0 0 5px #d4a017,0 0 0 9px #0a0f22,0 24px 60px rgba(0,0,0,.8);border-radius:8px}';
var COLS=["#e23b3b","#2b7be0","#27a758","#eec21b"];
function rand(a,b){ return a+Math.random()*(b-a); }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function el(parent,cls,css,txt){ var e=document.createElement("div"); if(cls) e.className=cls; if(css) e.style.cssText=css; if(txt!=null) e.textContent=txt; parent.appendChild(e); return e; }
function n(k){ return TV?Math.round(k*0.6):k; }
var KF=[];   // literal keyframes of the theme being built (one per floater), written to <style id="bgskinKf"> by apply()
function floater(root,css,dur,dx,rot){
  var id="bgf"+KF.length, del=rand(0,dur), p=del/dur; dx=+(+dx).toFixed(1); rot=+(+rot).toFixed(1);
  KF.push("@keyframes "+id+"{0%{transform:translate3d(0,112vh,0) rotate(0deg)}100%{transform:translate3d("+dx+"px,-25vh,0) rotate("+rot+"deg)}}");
  return el(root,"bga",css+";"+anim(id,dur,del)+";"+
    "transform:translate3d("+(dx*p).toFixed(1)+"px,"+(112-137*p).toFixed(1)+"vh,0) rotate("+(rot*p).toFixed(1)+"deg)");
}

var THEMES={
  trouble:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 8%,#27408c 0%,#121c45 55%,#070b1d 100%)";
    el(root,"bga","left:50%;top:44%;width:150vmin;height:150vmin;margin:-75vmin 0 0 -75vmin;border-radius:50%;opacity:.4;"+
      "background:conic-gradient(from 0deg,#e23b3b,#eec21b,#27a758,#2b7be0,#e23b3b);"+
      "-webkit-mask-image:radial-gradient(circle,transparent 36%,#000 38%,#000 52%,transparent 55%);mask-image:radial-gradient(circle,transparent 36%,#000 38%,#000 52%,transparent 55%);"+
      anim("bgspin",90,0));
    el(root,"bga","left:50%;top:44%;width:90vmin;height:90vmin;margin:-45vmin 0 0 -45vmin;border-radius:50%;background:radial-gradient(circle,rgba(120,160,255,.28),transparent 65%);opacity:.7;"+anim("bgbreathe",6,0,16));
    for(var i=0;i<n(14);i++){ var s=rand(40,150),c=pick(COLS); floater(root,"left:"+rand(-5,100)+"vw;width:"+s+"px;height:"+s+"px;border-radius:50%;opacity:"+rand(.14,.3).toFixed(2)+";background:radial-gradient(circle,"+c+" 0%,transparent 70%)",rand(22,44),rand(-80,80),0); }
    for(var j=0;j<n(7);j++){ floater(root,"left:"+rand(0,95)+"vw;font-size:"+rand(26,58)+"px;opacity:.13",rand(26,48),rand(-60,60),rand(-90,90)).textContent="🎲"; }
  },
  sorry:function(root){
    root.style.background="linear-gradient(160deg,#7a1020 0%,#4a0d3a 38%,#0e1b5a 100%)";
    for(var b=0;b<4;b++){ el(root,"bga","left:-40vw;top:"+(8+b*24)+"vh;width:60vw;height:11vh;opacity:.13;background:"+COLS[b]+";border-radius:8vh;transform:translateX("+(-30+160*b*11/(46+b*9)).toFixed(1)+"vw) rotate(-18deg);"+anim("bgdrift",46+b*9,b*11)); }
    var vals=["1","2","3","4","5","7","8","10","11","12","SORRY!"];
    for(var i=0;i<n(14);i++){ var c=pick(COLS),w=rand(54,92),v=pick(vals);
      var f=floater(root,"left:"+rand(0,96)+"vw;width:"+w+"px;height:"+(w*1.4)+"px;background:#fff;border:5px solid "+c+";border-radius:10px;opacity:"+rand(.12,.24).toFixed(2)+";display:flex;align-items:center;justify-content:center;color:"+c+";font:900 "+(v.length>2?w*.22:w*.5)+"px Arial,sans-serif",rand(24,48),rand(-90,90),rand(-200,200)); f.textContent=v; }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.45) 100%)");
  },
  monopoly:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 25%,#14693d 0%,#0a3d24 55%,#04170d 100%)";
    el(root,"","inset:0;opacity:.18;background:repeating-linear-gradient(45deg,rgba(255,255,255,.07) 0 2px,transparent 2px 14px)");
    /* skyline */
    var sky=el(root,"","left:0;right:0;bottom:0;height:30vh");
    for(var i=0;i<22;i++){ var w=rand(4,8),h=rand(8,28);
      el(sky,"","bottom:0;left:"+(i*4.6+rand(-.5,.5)).toFixed(1)+"vw;width:"+w+"vw;height:"+h+"vh;background:linear-gradient(#0b1c2b,#061019);"+
        "box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);"+
        "background-image:radial-gradient(circle,rgba(255,213,90,.75) 1.2px,transparent 1.6px),linear-gradient(#0b1c2b,#061019);background-size:11px 13px,100% 100%;opacity:.95"); }
    for(var s=0;s<n(26);s++){ el(root,"","left:"+rand(0,99)+"vw;top:"+rand(0,60)+"vh;width:3px;height:3px;border-radius:50%;background:#ffe9a8;opacity:.5;"+anim("bgtwinkle",rand(2.5,6),rand(0,6),16)); }
    for(var d=0;d<n(9);d++){ floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(36,86)+"px Georgia,serif;color:#f4c542;opacity:"+rand(.1,.2).toFixed(2),rand(26,50),rand(-60,60),rand(-30,30)).textContent=pick(["$","$","💵","🪙"]); }
  },
  scatter:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 30%,#1f6d85 0%,#0f3f52 55%,#082430 100%)";
    el(root,"","inset:0;opacity:.1;background:repeating-linear-gradient(0deg,rgba(255,255,255,.18) 0 1px,transparent 1px 30px)");
    var L="ABCDEFGHIJKLMNOPRSTW";
    for(var i=0;i<n(22);i++){ var ch=L[Math.floor(Math.random()*L.length)]; floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(50,120)+"px Georgia,serif;color:"+pick(["#ffd23f","#e8590c","#ffffff","#7fe0f0"])+";opacity:"+rand(.06,.14).toFixed(2),rand(28,56),rand(-80,80),rand(-160,160)).textContent=ch; }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.5) 100%)");
  },
  uno:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 30%,#3a2a78 0%,#241a52 55%,#120c2a 100%)";
    el(root,"","inset:0;opacity:.12;background:repeating-linear-gradient(135deg,rgba(255,255,255,.18) 0 2px,transparent 2px 26px)");
    var cols=["#d6322b","#f2bf24","#2f9e44","#2d63c8"];
    for(var i=0;i<n(16);i++){ var w=rand(46,86); floater(root,"left:"+rand(0,96)+"vw;width:"+w+"px;height:"+(w*1.5)+"px;background:"+pick(cols)+";border:4px solid #fff;border-radius:10px;opacity:"+rand(.10,.2).toFixed(2),rand(26,52),rand(-80,80),rand(-160,160)); }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.5) 100%)");
  },
  risk:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 30%,#2a4c66 0%,#16293b 55%,#0a141e 100%)";
    el(root,"","inset:0;opacity:.18;background:repeating-linear-gradient(8deg,rgba(255,255,255,.12) 0 1px,transparent 1px 22px)");
    el(root,"bga","left:50%;top:44%;width:140vmin;height:140vmin;margin:-70vmin 0 0 -70vmin;border-radius:50%;background:radial-gradient(circle,rgba(255,226,160,.18),transparent 62%);opacity:.7;"+anim("bgbreathe",8,0,16));
    for(var i=0;i<n(14);i++){ floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(40,100)+"px Georgia,serif;color:#e8c987;opacity:"+rand(.05,.12).toFixed(2),rand(30,58),rand(-60,60),rand(-120,120)).textContent=pick(["✦","⚓","✜","♜","☆"]); }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.55) 100%)");
  },
  rummy500:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 35%,#177048 0%,#0b4129 55%,#04180f 100%)";
    el(root,"","inset:0;opacity:.14;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 5px)");
    el(root,"bga","left:50%;top:46%;width:130vmin;height:130vmin;margin:-65vmin 0 0 -65vmin;border-radius:50%;background:radial-gradient(circle,rgba(255,240,170,.22),transparent 62%);opacity:.7;"+anim("bgbreathe",7,0,16));
    var suits=[["♠","#cfd8ff"],["♥","#ff7b7b"],["♦","#ff9d6b"],["♣","#bfeccb"]];
    for(var i=0;i<n(16);i++){ var sv=pick(suits); floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(40,110)+"px Georgia,serif;color:"+sv[1]+";opacity:"+rand(.07,.16).toFixed(2),rand(26,52),rand(-70,70),rand(-160,160)).textContent=sv[0]; }
    for(var c=0;c<n(8);c++){ var w=rand(48,82); floater(root,"left:"+rand(0,96)+"vw;width:"+w+"px;height:"+(w*1.4)+"px;background:#fff;border-radius:8px;opacity:"+rand(.08,.15).toFixed(2)+";box-shadow:inset 0 0 0 3px #cc2b2b",rand(30,56),rand(-80,80),rand(-120,120)); }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.5) 100%)");
  },
  party:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 0%,#2a3d85 0%,#10183d 55%,#070a1a 100%)";
    for(var i=0;i<n(16);i++){ var s=rand(50,170),c=pick(COLS); floater(root,"left:"+rand(-5,100)+"vw;width:"+s+"px;height:"+s+"px;border-radius:50%;opacity:"+rand(.12,.26).toFixed(2)+";background:radial-gradient(circle,"+c+" 0%,transparent 70%)",rand(24,48),rand(-90,90),0); }
    var em=["🎲","♟️","🃏","🏠","🎩","🚂"];
    for(var j=0;j<n(9);j++){ floater(root,"left:"+rand(0,95)+"vw;font-size:"+rand(30,64)+"px;opacity:.14",rand(28,52),rand(-70,70),rand(-120,120)).textContent=pick(em); }
  }
};

function ensureCss(){
  if(document.getElementById("bgskinCss")) return;
  var s=document.createElement("style"); s.id="bgskinCss"; s.textContent=CSS; (document.head||document.documentElement).appendChild(s);
}
function bodySkin(key){
  var cls=document.body.className.replace(/\bskin-\w+\b/g,"").trim();
  document.body.className=(cls?cls+" ":"")+"skin-"+key;
}
function classic(key){
  ensureCss();
  bodySkin(key);
  var old=document.getElementById("bgskin");
  if(old&&old.getAttribute("data-skin")===key) return;
  if(old) old.remove();
  var root=document.createElement("div"); root.id="bgskin"; root.setAttribute("data-skin",key);
  KF=[]; THEMES[key](root);
  var kf=document.getElementById("bgskinKf"); if(!kf){ kf=document.createElement("style"); kf.id="bgskinKf"; (document.head||document.documentElement).appendChild(kf); }
  kf.textContent=KF.join(""); KF=[];
  document.body.insertBefore(root,document.body.firstChild);
}

/* ---------- Midnight Luxe path (pages that load ui/ui.js) ---------- */
/* Luxe board frames on the same board elements the old skins framed (--frame-shadow comes from ui/theme.css). The Trouble plate
   is round and its home nests overhang it, so its frame is a circle drawn UNDER the board svg. */
var LUXE_CSS=
'body.skin-trouble #boardWrap{isolation:isolate}'+
'body.skin-trouble #boardWrap::before{content:"";position:absolute;inset:2.5%;z-index:-1;border-radius:50%;box-shadow:var(--frame-shadow);pointer-events:none}'+
'body.skin-sorry #boardWrap{border-radius:3.7%;box-shadow:var(--frame-shadow)}'+
'body.skin-risk #rkframe{border-radius:16px;box-shadow:var(--frame-shadow)}'+
'body.skin-rummy500 #rtable,body.skin-rummy500 #boardWrap{border-radius:34px;box-shadow:var(--frame-shadow)}'+
'body.skin-monopoly #board,body.skin-monopoly .mboard{border-radius:8px;box-shadow:var(--frame-shadow)}';
function luxeReady(){ var B=g.BGUI; return !!(B&&typeof B.stage==="function"); }
function luxePage(){ try{ return !!document.querySelector('script[src*="ui/ui.js"]'); }catch(e){ return false; } }
function luxe(key){
  if(!document.getElementById("bgskinLuxe")){ var s=document.createElement("style"); s.id="bgskinLuxe"; s.textContent=LUXE_CSS; (document.head||document.documentElement).appendChild(s); }
  bodySkin(key);
  var old=document.getElementById("bgskin"); if(old) old.remove();            // an old skin painted before ui.js arrived
  var kf=document.getElementById("bgskinKf"); if(kf) kf.textContent="";
  var oc=document.getElementById("bgskinCss"); if(oc) oc.remove();             // its filter / colour-ring frames must not stack under the Luxe ones
  try{ g.BGUI.stage(key); }catch(e){ classic(key); return; }
  mode="luxe";
}
var mode="classic", pending=null, waiting=false;
function apply(name){
  if(typeof document==="undefined"||!document.body) return;
  var key=THEMES[name]?name:"party";
  if(luxeReady()){ pending=null; luxe(key); return; }
  if(luxePage()&&document.readyState==="loading"){                            // ui.js is deferred: finish on DOMContentLoaded
    pending=key; bodySkin(key); document.documentElement.setAttribute("data-game",key);
    if(!waiting){ waiting=true; document.addEventListener("DOMContentLoaded",function(){ waiting=false; var k=pending; pending=null; if(k) apply(k); }); }
    return;
  }
  mode="classic"; classic(key);
}
g.Skins={apply:apply,mode:function(){ return mode; }};
})(window);
