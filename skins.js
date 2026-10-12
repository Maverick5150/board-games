/* Board Games — animated backgrounds + board frames. Skins.apply("trouble"|"sorry"|"monopoly"|"party") */
(function(g){
"use strict";
var CSS=
'#bgskin{position:fixed;inset:0;overflow:hidden;z-index:-1;pointer-events:none}'+
'#bgskin *{position:absolute;will-change:transform,opacity}'+
'@keyframes bgfloat{0%{transform:translate3d(0,112vh,0) rotate(0deg)}100%{transform:translate3d(var(--dx,0px),-25vh,0) rotate(var(--rot,0deg))}}'+
'@keyframes bgspin{to{transform:rotate(360deg)}}'+
'@keyframes bgtwinkle{0%,100%{opacity:.12}50%{opacity:.9}}'+
'@keyframes bgdrift{0%{transform:translateX(-30vw) rotate(var(--r,-18deg))}100%{transform:translateX(130vw) rotate(var(--r,-18deg))}}'+
'@keyframes bgbreathe{0%,100%{transform:scale(1);opacity:.55}50%{transform:scale(1.08);opacity:.85}}'+
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
function floater(root,css,dur,dx,rot){
  return el(root,"",css+";animation:bgfloat "+dur+"s linear "+(-rand(0,dur)).toFixed(1)+"s infinite;--dx:"+dx+"px;--rot:"+rot+"deg");
}

var THEMES={
  trouble:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 8%,#27408c 0%,#121c45 55%,#070b1d 100%)";
    el(root,"","left:50%;top:44%;width:150vmin;height:150vmin;margin:-75vmin 0 0 -75vmin;border-radius:50%;opacity:.4;"+
      "background:conic-gradient(from 0deg,#e23b3b,#eec21b,#27a758,#2b7be0,#e23b3b);"+
      "-webkit-mask-image:radial-gradient(circle,transparent 36%,#000 38%,#000 52%,transparent 55%);mask-image:radial-gradient(circle,transparent 36%,#000 38%,#000 52%,transparent 55%);"+
      "animation:bgspin 90s linear infinite");
    el(root,"","left:50%;top:44%;width:90vmin;height:90vmin;margin:-45vmin 0 0 -45vmin;border-radius:50%;background:radial-gradient(circle,rgba(120,160,255,.28),transparent 65%);animation:bgbreathe 6s ease-in-out infinite");
    for(var i=0;i<14;i++){ var s=rand(40,150),c=pick(COLS); floater(root,"left:"+rand(-5,100)+"vw;width:"+s+"px;height:"+s+"px;border-radius:50%;opacity:"+rand(.14,.3).toFixed(2)+";background:radial-gradient(circle,"+c+" 0%,transparent 70%)",rand(22,44),rand(-80,80),0); }
    for(var j=0;j<7;j++){ floater(root,"left:"+rand(0,95)+"vw;font-size:"+rand(26,58)+"px;opacity:.13",rand(26,48),rand(-60,60),rand(-90,90)).textContent="🎲"; }
  },
  sorry:function(root){
    root.style.background="linear-gradient(160deg,#7a1020 0%,#4a0d3a 38%,#0e1b5a 100%)";
    for(var b=0;b<4;b++){ el(root,"","left:-40vw;top:"+(8+b*24)+"vh;width:60vw;height:11vh;opacity:.13;background:"+COLS[b]+";border-radius:8vh;--r:-18deg;animation:bgdrift "+(46+b*9)+"s linear "+(-b*11)+"s infinite"); }
    var vals=["1","2","3","4","5","7","8","10","11","12","SORRY!"];
    for(var i=0;i<14;i++){ var c=pick(COLS),w=rand(54,92),v=pick(vals);
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
    for(var s=0;s<26;s++){ el(root,"","left:"+rand(0,99)+"vw;top:"+rand(0,60)+"vh;width:3px;height:3px;border-radius:50%;background:#ffe9a8;animation:bgtwinkle "+rand(2.5,6).toFixed(1)+"s ease-in-out "+(-rand(0,6)).toFixed(1)+"s infinite"); }
    for(var d=0;d<9;d++){ floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(36,86)+"px Georgia,serif;color:#f4c542;opacity:"+rand(.1,.2).toFixed(2),rand(26,50),rand(-60,60),rand(-30,30)).textContent=pick(["$","$","💵","🪙"]); }
  },
  risk:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 30%,#2a4c66 0%,#16293b 55%,#0a141e 100%)";
    el(root,"","inset:0;opacity:.18;background:repeating-linear-gradient(8deg,rgba(255,255,255,.12) 0 1px,transparent 1px 22px)");
    el(root,"","left:50%;top:44%;width:140vmin;height:140vmin;margin:-70vmin 0 0 -70vmin;border-radius:50%;background:radial-gradient(circle,rgba(255,226,160,.18),transparent 62%);animation:bgbreathe 8s ease-in-out infinite");
    for(var i=0;i<14;i++){ floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(40,100)+"px Georgia,serif;color:#e8c987;opacity:"+rand(.05,.12).toFixed(2),rand(30,58),rand(-60,60),rand(-120,120)).textContent=pick(["✦","⚓","✜","♜","☆"]); }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.55) 100%)");
  },
  rummy500:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 35%,#177048 0%,#0b4129 55%,#04180f 100%)";
    el(root,"","inset:0;opacity:.14;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 5px)");
    el(root,"","left:50%;top:46%;width:130vmin;height:130vmin;margin:-65vmin 0 0 -65vmin;border-radius:50%;background:radial-gradient(circle,rgba(255,240,170,.22),transparent 62%);animation:bgbreathe 7s ease-in-out infinite");
    var suits=[["♠","#cfd8ff"],["♥","#ff7b7b"],["♦","#ff9d6b"],["♣","#bfeccb"]];
    for(var i=0;i<16;i++){ var sv=pick(suits); floater(root,"left:"+rand(0,96)+"vw;font:900 "+rand(40,110)+"px Georgia,serif;color:"+sv[1]+";opacity:"+rand(.07,.16).toFixed(2),rand(26,52),rand(-70,70),rand(-160,160)).textContent=sv[0]; }
    for(var c=0;c<8;c++){ var w=rand(48,82); floater(root,"left:"+rand(0,96)+"vw;width:"+w+"px;height:"+(w*1.4)+"px;background:#fff;border-radius:8px;opacity:"+rand(.08,.15).toFixed(2)+";box-shadow:inset 0 0 0 3px #cc2b2b",rand(30,56),rand(-80,80),rand(-120,120)); }
    el(root,"","inset:0;background:radial-gradient(ellipse at center,transparent 50%,rgba(0,0,0,.5) 100%)");
  },
  party:function(root){
    root.style.background="radial-gradient(120% 90% at 50% 0%,#2a3d85 0%,#10183d 55%,#070a1a 100%)";
    for(var i=0;i<16;i++){ var s=rand(50,170),c=pick(COLS); floater(root,"left:"+rand(-5,100)+"vw;width:"+s+"px;height:"+s+"px;border-radius:50%;opacity:"+rand(.12,.26).toFixed(2)+";background:radial-gradient(circle,"+c+" 0%,transparent 70%)",rand(24,48),rand(-90,90),0); }
    var em=["🎲","♟️","🃏","🏠","🎩","🚂"];
    for(var j=0;j<9;j++){ floater(root,"left:"+rand(0,95)+"vw;font-size:"+rand(30,64)+"px;opacity:.14",rand(28,52),rand(-70,70),rand(-120,120)).textContent=pick(em); }
  }
};

function ensureCss(){
  if(document.getElementById("bgskinCss")) return;
  var s=document.createElement("style"); s.id="bgskinCss"; s.textContent=CSS; (document.head||document.documentElement).appendChild(s);
}
function apply(name){
  if(typeof document==="undefined"||!document.body) return;
  ensureCss();
  var key=THEMES[name]?name:"party";
  var cls=document.body.className.replace(/\bskin-\w+\b/g,"").trim();
  document.body.className=(cls?cls+" ":"")+"skin-"+key;
  var old=document.getElementById("bgskin");
  if(old&&old.getAttribute("data-skin")===key) return;
  if(old) old.remove();
  var root=document.createElement("div"); root.id="bgskin"; root.setAttribute("data-skin",key);
  THEMES[key](root);
  document.body.insertBefore(root,document.body.firstChild);
}
g.Skins={apply:apply};
})(window);
