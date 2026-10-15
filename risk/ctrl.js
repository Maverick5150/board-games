/* RISK — the player's control panel: instructions, tap-to-play flow, dice display, cards / mission / players windows.
   It only ever reads a snapshot V (Risk.Engine.snapshot) and sends action objects, so the SAME code runs the single-device game and the Party-mode phones.
   Step 4 (Midnight Luxe): create({luxe:true, seatOf, tv, onSheet}) draws the same panel with the shared ui/ pieces (bg- buttons with line icons,
   a status card with the seat dot, BGUI dice, the attack / move-in / free-move / shift choices and the cards, mission, HQ and players windows
   as BGUI sheets, D-pad focus kept across redraws). The single-device page asks for it when ui/ui.js is there; without it (Party Mode
   phones, the jsdom harnesses) every line below draws exactly what it drew before. */
(function(g){
"use strict";
var Risk=g.Risk=g.Risk||{}, MP=Risk.MAP, E=Risk.Engine;
var PC=MP.PCOLORS, NEUTRAL={c:"#9a9a9a",d:"#555",l:"#cfcfcf",name:"Neutral"};
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
function pcol(V,i){ var p=V.players[i]; return (!p||p.neutral)?NEUTRAL:PC[(p.ci==null?i:p.ci)%PC.length]; }

/* ---- card art: figure silhouettes (foot soldier, horseman, cannon) + territory silhouette ---- */
var FIG={
 I:'<g fill="#111"><rect x="14" y="2" width="12" height="9" rx="1.5"/><rect x="12" y="10" width="16" height="2.4"/><circle cx="20" cy="15" r="4.2"/><path d="M13 20h14l2 12h-5l-1 8h-4l-1-8h-5z"/><rect x="30" y="4" width="2.2" height="34" rx="1"/><path d="M30.5 1l-1.6 5h3.2z"/></g>',
 C:'<g fill="#111"><ellipse cx="19" cy="26" rx="11" ry="6"/><path d="M26 22l5-9 3 2-2 8z"/><path d="M31 11l6 1-1 4-5-1z"/><rect x="11" y="29" width="2.6" height="9"/><rect x="17" y="30" width="2.6" height="8"/><rect x="24" y="30" width="2.6" height="8"/><rect x="29" y="28" width="2.6" height="10"/><circle cx="19" cy="12" r="3.2"/><path d="M15 15h8l1 8h-10z"/><rect x="25" y="3" width="1.8" height="22"/><path d="M26.8 3l7 2-7 3z"/></g>',
 A:'<g fill="#111"><circle cx="15" cy="30" r="8"/><circle cx="15" cy="30" r="2.4" fill="#fff"/><path d="M13 18l22-7 2 5-22 8z"/><path d="M4 36l11-5 2 3-9 5z"/><circle cx="8" cy="12" r="2.6"/></g>'
};
function figSVG(sym,sz){ if(sym==="W") return '<svg viewBox="0 0 120 40" width="'+(sz*3)+'" height="'+sz+'">'+'<g transform="translate(0,0)">'+FIG.I+'</g><g transform="translate(40,0)">'+FIG.C+'</g><g transform="translate(80,0)">'+FIG.A+'</g></svg>'; return '<svg viewBox="0 0 40 40" width="'+sz+'" height="'+sz+'">'+FIG[sym]+'</svg>'; }
function cardHTML(c,opts){
  opts=opts||{};
  var w=c.sym==="W"; var ct=w?null:MP.continents[MP.cont[c.t]];
  var sil=(!w&&Risk.Board&&Risk.Board.silhouette)?Risk.Board.silhouette(c.t):"";
  // opts.luxe (step 4): a button for the keyboard / D-pad, with a spoken name; the "you own it" mark is opts.star (an svg icon: the font has no star)
  var lux=opts.luxe?' role="button" tabindex="0" aria-pressed="'+(opts.sel?"true":"false")+'" aria-label="'+esc(w?"Joker (wild card)":MP.names[c.t]+", "+(MP.SYM_NAMES[c.sym]||"")+(opts.owned?", you own it":""))+'"':"";
  return '<div class="rkcard'+(opts.sel?" sel":"")+(w?" wild":"")+'" data-id="'+c.id+'" style="'+(ct?'--cc:'+ct.color:'--cc:#7a4bd1')+'"'+lux+'>'+
    '<div class="cn">'+(w?"WILD":esc(MP.names[c.t]))+'</div>'+
    (w?'<div class="cs wide">'+figSVG("W",24)+'</div>':'<div class="cs">'+(sil?'<img src="'+sil+'" alt="">':'')+'</div>')+
    '<div class="cf">'+(w?'<b>JOKER</b>':figSVG(c.sym,34))+'</div>'+
    (opts.owned?'<i class="own">'+(opts.luxe&&opts.star?opts.star:'★')+'</i>':'')+'</div>';
}

/* ---- dice ---- */
function dieHTML(v,kind,lost){
  var pips={1:[[5,5]],2:[[2.5,2.5],[7.5,7.5]],3:[[2.5,2.5],[5,5],[7.5,7.5]],4:[[2.5,2.5],[7.5,2.5],[2.5,7.5],[7.5,7.5]],5:[[2.5,2.5],[7.5,2.5],[5,5],[2.5,7.5],[7.5,7.5]],6:[[2.5,2.5],[7.5,2.5],[2.5,5],[7.5,5],[2.5,7.5],[7.5,7.5]]}[v]||[];
  var fill=kind==="a"?"#d93a30":"#f7f1df", pip=kind==="a"?"#fff":"#1a1a1a", st=kind==="a"?"#7c1712":"#8a8576";
  return '<svg class="rkdie'+(lost?" lost":"")+'" viewBox="0 0 10 10" width="46" height="46"><rect x=".4" y=".4" width="9.2" height="9.2" rx="1.8" fill="'+fill+'" stroke="'+st+'" stroke-width=".5"/>'+pips.map(function(p){ return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".9" fill="'+pip+'"/>'; }).join("")+'</svg>';
}
function diceBlock(la,V){
  if(!la) return "";
  var n=Math.min(la.ar.length,la.dr.length), at=la.ar.map(function(v,i){ return dieHTML(v,"a",i<n&&!(v>la.dr[i])); }).join(""), df=la.dr.map(function(v,i){ return dieHTML(v,"d",i<n&&(la.ar[i]>v)); }).join("");
  var an=V.players[la.p]?V.players[la.p].name:"?", dn=V.players[la.def]?V.players[la.def].name:"?";
  return '<div class="rkdiceRow"><div class="rds"><small>'+esc(an)+' attacks</small><div>'+at+'</div></div><div class="vs">vs</div><div class="rds"><small>'+esc(dn)+' defends</small><div>'+df+'</div></div></div>'+
    '<div class="rkres">'+esc(MP.names[la.from])+' → '+esc(MP.names[la.to])+': attacker loses <b>'+la.al+'</b>, defender loses <b>'+la.dl+'</b>'+(la.conquered?' — <b class="cq">conquered!</b>':'')+'</div>';
}
/* the Luxe dice (step 4): the shared ivory dice (.bg-die, BGUI.dice), red lacquer for the attack as on the box, ivory for the defence; a
   die that lost its comparison fades. The class rkdie stays on every die (the harnesses look for it) */
function dieL(v,kind,lost){
  var B=g.BGUI;
  return '<span class="bg-die rkdie'+(kind==="a"?" bg-die--seat":"")+(lost?" lost":"")+'"'+(kind==="a"?' data-seat="1"':"")+' data-v="'+v+'" role="img" aria-label="'+(kind==="a"?"Attack":"Defence")+" die showing "+v+(lost?", lost":"")+'">'+(B&&B.dice?B.dice.svg(v):v)+'</span>';
}
function diceBlockL(la,V){
  if(!la) return "";
  var n=Math.min(la.ar.length,la.dr.length), at=la.ar.map(function(v,i){ return dieL(v,"a",i<n&&!(v>la.dr[i])); }).join(""), df=la.dr.map(function(v,i){ return dieL(v,"d",i<n&&(la.ar[i]>v)); }).join("");
  var an=V.players[la.p]?V.players[la.p].name:"?", dn=V.players[la.def]?V.players[la.def].name:"?";
  return '<div class="rk-dicerow"><div class="rk-side"><span class="rk-side__who">'+esc(an)+' attacks</span><span class="rk-side__dice">'+at+'</span></div><span class="rk-vs" aria-hidden="true">vs</span>'+
    '<div class="rk-side"><span class="rk-side__who">'+esc(dn)+' defends</span><span class="rk-side__dice">'+df+'</span></div></div>'+
    '<p class="rk-res">'+esc(MP.names[la.from])+' to '+esc(MP.names[la.to])+': <span class="rk-nw">attacker loses <b>'+la.al+'</b>,</span> <span class="rk-nw">defender loses <b>'+la.dl+'</b></span>'+(la.conquered?' <span class="rk-nw">— <b class="rk-cq">conquered!</b></span>':'')+'</p>';
}
function rollIn(box){   // fresh dice tumble in (one finite transform beat each; the face is the result when it settles)
  var B=g.BGUI; if(!box||!B||!B.dice) return;
  [].forEach.call(box.querySelectorAll(".bg-die[data-v]"),function(d){ B.dice.roll(d,+d.getAttribute("data-v"),{ms:460,flips:4,haptic:false}); });
}

var CSS=[
".rkpanel{width:100%;color:#f4ecd8;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
".rkstat{display:flex;align-items:center;gap:8px;background:#00000066;border:2px solid var(--pc,#ffffff30);border-radius:12px;padding:8px 12px;margin:6px 0;font-weight:700;font-size:14px;min-height:42px;box-shadow:0 0 12px -2px var(--pc,transparent)}",
".rkstat .pd{width:14px;height:14px;border-radius:3px;flex:none;border:1px solid #0006}",
".rkdice{background:#00000050;border-radius:12px;padding:6px 8px;margin:4px 0;text-align:center;min-height:0}",
".rkdice:empty{display:none}",
".rkdiceRow{display:flex;align-items:center;justify-content:center;gap:10px}.rds small{display:block;font-size:11px;opacity:.85;margin-bottom:2px}.rds div{display:flex;gap:5px;justify-content:center}.vs{font-weight:900;opacity:.7}",
".rkdie{filter:drop-shadow(0 2px 2px #0008);animation:dpop .35s ease-out 1}.rkdie.lost{opacity:.4}@keyframes dpop{from{transform:rotate(-35deg) scale(.4)}to{transform:none}}",
".rkres{font-size:12.5px;margin-top:3px}.rkres .cq{color:#ffd84a}",
".rkacts{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;margin:5px 0}",
".rkacts button,.rkbar button{background:#2a2118;color:#f4ecd8;border:1px solid #8a6d3b;border-radius:11px;padding:10px 13px;font-size:14px;font-weight:800;cursor:pointer}",
".rkacts button.pri{background:#c98b1a;border-color:#e6b04a;color:#2a1700}.rkacts button.red{background:#a8281f;border-color:#e05a4d}.rkacts button.on{background:#c98b1a;color:#2a1700}",
".rkacts button[disabled]{opacity:.35}",
".rkseg{display:flex;gap:4px;align-items:center}.rkseg span{font-size:12px;opacity:.85;margin-right:2px}.rkseg button{padding:8px 11px}",
".rkstep{display:flex;align-items:center;gap:8px;justify-content:center;width:100%}.rkstep b{font-size:22px;min-width:40px;text-align:center}.rkstep button{width:46px;padding:8px 0;font-size:20px}",
".rkbar{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin:6px 0}",
".rkbar button{flex:1 1 auto;padding:9px 8px;font-size:13px}",
".rklog{font-size:11.5px;color:#cdbf9b;text-align:center;min-height:36px;line-height:1.35;margin-top:2px}",
".rkmodal{position:fixed;inset:0;z-index:70;background:#120b02e8;display:none;align-items:flex-start;justify-content:center;overflow-y:auto;padding:max(12px,env(safe-area-inset-top)) 10px 24px}",
".rkmodal.show{display:flex}.rkmodal .sh{width:min(100%,560px);background:#2b2013;border:2px solid #8a6d3b;border-radius:18px;padding:14px;color:#f4ecd8;box-shadow:0 18px 44px #000b}",
".rkmodal h2{margin:0 0 6px;font-size:20px;letter-spacing:.5px}",
".rkcards{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:8px 0}",
".rkcard{position:relative;width:92px;height:134px;background:linear-gradient(#fffdf6,#f1ead6);border:2px solid #1b1b1b;border-radius:9px;color:#111;display:flex;flex-direction:column;align-items:center;padding:3px;cursor:pointer;box-shadow:0 2px 5px #0007;font-family:Georgia,'Times New Roman',serif;border-top:9px solid var(--cc)}",
".rkcard.sel{transform:translateY(-7px);box-shadow:0 0 0 3px #ffd23f,0 6px 12px #000a}",
".rkcard .cn{font-weight:900;font-size:10.5px;text-align:center;line-height:1.05;min-height:23px;letter-spacing:.3px;display:flex;align-items:center}",
".rkcard .cs{height:48px;display:flex;align-items:center;justify-content:center}.rkcard .cs img{max-width:78px;max-height:46px}",
".rkcard .cs.wide svg{width:78px;height:26px}",
".rkcard .cf{margin-top:auto;display:flex;align-items:center;justify-content:center;font-size:12px}",
".rkcard .own{position:absolute;right:3px;top:-1px;color:#c98b1a;font-style:normal;font-size:13px}",
".rkplayer{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:12px;background:#00000040;margin:5px 0;border:2px solid transparent}",
".rkplayer.cur{border-color:#ffd23f}.rkplayer.dead{opacity:.4}.rkplayer .nm{font-weight:800;flex:1}.rkplayer small{color:#cdbf9b;display:block;font-weight:500}",
".rkplayer .sw{width:20px;height:20px;border-radius:5px;border:2px solid #0008;flex:none}",
".rkmission{background:#f3e6c2;color:#2a1c05;border:3px double #7a5a1c;border-radius:10px;padding:14px;font-size:17px;font-weight:700;text-align:center;font-family:Georgia,serif}",
".rkinfo{position:absolute;left:8px;bottom:8px;max-width:78%;background:#120b02e6;color:#f4ecd8;border:1px solid #8a6d3b;border-radius:10px;padding:7px 10px;font-size:12px;z-index:5;pointer-events:none}"
].join("\n");
function injectCSS(){ if(typeof document==="undefined"||document.getElementById("rkCtrlCss")) return; var s=document.createElement("style"); s.id="rkCtrlCss"; s.textContent=CSS; document.head.appendChild(s); }

function create(cfg){
  injectCSS();
  var BG=g.BGUI, L=!!(cfg.luxe&&BG&&BG.sheet&&BG.icon);   // the Luxe panel (step 4): only with ui/ui.js on the page
  var root=cfg.root, board=cfg.board, V=null, S={key:"",src:null,tgt:null,amt:1,occN:null,fN:1,fSrc:null,fTgt:null,s2:[],s2n:null,cardSel:[],convSeen:{},lastSeq:-1,dice:"",blitz:false,blitzT:null,infoT:null,actKind:null,actClosing:false,barKey:""};
  var self={};
  var modal, actEl=null, actIn=null;
  if(!L){
  root.classList.add("rkpanel");
  root.innerHTML='<div class="rkstat" id="rkstat"></div><div class="rkdice" id="rkdice"></div><div class="rkacts" id="rkacts"></div><div class="rkbar" id="rkbar"></div><div class="rklog" id="rklog"></div>';
  modal=document.createElement("div"); modal.className="rkmodal"; modal.innerHTML='<div class="sh" id="rksh"></div>'; document.body.appendChild(modal);
  modal.addEventListener("click",function(e){ if(e.target===modal) closeModal(); });
  } else {
    // the same ids (the harnesses and the page find #rkstat, #rkdice, #rkacts, #rkbar, #rklog); Luxe class names, so the old panel CSS above never applies
    root.classList.add("rk-panel");
    root.innerHTML='<div class="rk-stat" id="rkstat" aria-live="polite"></div><div class="rk-dice" id="rkdice"></div><div class="rk-acts" id="rkacts" data-toast-avoid></div><div class="rk-bar" id="rkbar" data-toast-avoid></div><div class="rk-log" id="rklog" data-stage-text></div>';
    // the cards, mission, HQ and players windows share one sheet; the attack / move-in / free-move / shift choices have their own
    modal=document.createElement("section"); modal.className="bg-sheet rk-wsheet"; modal.id="rkSheet"; modal.setAttribute("aria-labelledby","rkSheetTitle"); modal.innerHTML='<div id="rksh"></div>'; document.body.appendChild(modal);
    actEl=document.createElement("section"); actEl.className="bg-sheet rk-asheet"; actEl.id="rkMove"; actEl.setAttribute("aria-labelledby","rkMoveTitle"); actEl.innerHTML='<div id="rkMoveIn"></div>'; document.body.appendChild(actEl); actIn=actEl.firstChild;
  }
  var $=function(id){ return root.querySelector("#"+id); };
  function openModal(h){
    if(L){ var k=fkey(modal); modal.querySelector("#rksh").innerHTML=h; if(!BG.sheet.isOpen(modal)) BG.sheet.open(modal); else frestore(modal,k); return; }
    modal.querySelector("#rksh").innerHTML=h; modal.classList.add("show");
  }
  function closeModal(){ if(L){ if(BG.sheet.isOpen(modal)) BG.sheet.close(modal); return; } modal.classList.remove("show"); }
  self.closeModal=closeModal;
  function act(a){ var r=cfg.send(a); if(r&&r.ok===false&&cfg.toast) cfg.toast(r.msg||"That isn't allowed."); return r; }
  function mine(){ return V&&V.me>=0&&V.turn===V.me&&!V.over; }
  function myTurnPhase(){ return mine(); }
  function nm(i){ return V.players[i]?V.players[i].name:"?"; }
  function owned(p){ var r=[]; V.terr.forEach(function(t,i){ if(t.o===p) r.push(i); }); return r; }

  /* ------------ Luxe helpers (step 4) ------------ */
  function ico(n){ return L&&BG.icon?BG.icon(n):""; }
  function onTV(){ return !!(cfg.tv&&cfg.tv()); }
  function tapW(cap){ var w=onTV()?"select":"tap"; return cap?w.charAt(0).toUpperCase()+w.slice(1):w; }   // the TV has no touch: "select" (OK on the remote)
  function seatOf(i){ return cfg.seatOf?cfg.seatOf(i):i+1; }
  // the D-pad / keyboard focus survives a redraw: the control with the same action (data-a, data-m, a card's data-id) takes it back
  function fkey(box){ var a=document.activeElement; if(!L||!box||!a||a===document.body||!box.contains(a)) return null; return a.getAttribute("data-a")?"a:"+a.getAttribute("data-a"):a.getAttribute("data-m")?"m:"+a.getAttribute("data-m"):a.getAttribute("data-id")!=null?"c:"+a.getAttribute("data-id"):"any"; }
  function frestore(box,k){
    if(!k||!box) return; var a=document.activeElement;
    if(a&&a!==document.body&&a.isConnected&&box.contains(a)) return;   // still there
    if(box===root&&BG.sheet.top()) return;                              // a sheet has just opened: the focus belongs there
    var el=null, v=k.slice(2);
    if(k.indexOf("a:")===0) el=box.querySelector('[data-a="'+v+'"]'); else if(k.indexOf("m:")===0) el=box.querySelector('[data-m="'+v+'"]'); else if(k.indexOf("c:")===0) el=box.querySelector('[data-id="'+v+'"]');
    if(!el||el.disabled) el=box.querySelector(".bg-sheet__option.is-best:not([disabled])")||(box===root?null:box.querySelector("button:not([disabled]), [role=button]"));
    if(!el) return;
    if(BG.focus&&BG.focus.enabled) BG.focus.set(el); else { try{ el.focus({preventScroll:true}); }catch(e){ try{ el.focus(); }catch(e2){} } }
  }
  function bt(label,a,o){ o=o||{}; return '<button type="button" class="bg-btn '+(o.pri?"bg-btn--primary pri":"bg-btn--secondary")+'" data-a="'+a+'"'+(o.dis?" disabled":"")+'>'+(o.icon?ico(o.icon):"")+'<span>'+label+'</span></button>'; }
  function shead(eyebrow,title,sub,id){ return '<div class="bg-sheet__grip" aria-hidden="true"></div><div class="rk-shead"><span class="bg-eyebrow bg-eyebrow--accent">'+eyebrow+'</span><h2 class="bg-sheet__title" id="'+id+'">'+title+'</h2>'+(sub?'<p class="bg-sheet__sub">'+sub+'</p>':"")+'</div>'; }
  function opt(a,label,desc,detail,o){ o=o||{};
    return '<button type="button" class="bg-sheet__option'+(o.best?" is-best":"")+'" data-a="'+a+'"'+(o.dis?" disabled":"")+'>'+(o.icon?ico(o.icon):"")+'<span class="bg-sheet__text"><span class="bg-sheet__label">'+label+'</span>'+
      (desc?'<span class="bg-sheet__desc">'+desc+'</span>':"")+(detail?'<span class="bg-sheet__detail">'+detail+'</span>':"")+'</span>'+ico("chevron")+'</button>'; }
  function stepper(k,n,label){ return '<div class="rk-step bg-stepper" role="group" aria-label="'+label+'"><button type="button" class="bg-stepper__btn" data-a="'+k+':-1" aria-label="One fewer">'+ico("minus")+'</button><output class="bg-stepper__val" aria-live="polite">'+n+'</output><button type="button" class="bg-stepper__btn" data-a="'+k+':1" aria-label="One more">'+ico("plus")+'</button></div>'; }
  function armies(n){ return n+" "+(n===1?"army":"armies"); }

  /* ------------ board taps ------------ */
  function tap(t){
    if(!V) return;
    var st=V.terr[t];
    if(!mine()){ info(t); return; }
    var ph=V.phase;
    if(ph==="claim"){ if(st.o===-1) act({t:"claim",terr:t}); else info(t); return; }
    if(ph==="deploy"){ if(st.o===V.me) act({t:"deployOne",terr:t}); else info(t); return; }
    if(ph==="hq"){ if(st.o===V.me) act({t:"hq",terr:t}); else info(t); return; }
    if(ph==="setup2p"){
      var need=Math.min(2,V.initLeft[V.me]);
      if(st.o===V.me&&S.s2.length<need){ S.s2.push(t); render(); }
      else if(st.o===2&&V.initLeft[2]>0){ S.s2n=t; render(); }
      else info(t);
      if(S.s2.length===need&&(S.s2n!=null||V.initLeft[2]<=0)){ var a={t:"setup2p",mine:S.s2.slice(),neutral:S.s2n}; S.s2=[]; S.s2n=null; act(a); }
      return;
    }
    if(ph==="reinforce"){
      if(st.o===V.me){ var n=S.amt==="all"?V.reserve:Math.min(V.reserve,S.amt|0||1); if(n>0) act({t:"place",terr:t,n:n}); } else info(t);
      return;
    }
    if(ph==="attack"){
      if(st.o===V.me){ if(st.a>=2){ S.src=(S.src===t)?null:t; S.tgt=null; render(); } else { toast("Needs at least 2 armies to attack from."); } }
      else if(S.src!=null&&E.targetsFrom(V,S.src).indexOf(t)>=0){ S.tgt=t; render(); }
      else info(t);
      return;
    }
    if(ph==="occupy"){ info(t); return; }
    if(ph==="fortify"){
      if(S.fSrc==null){ if(st.o===V.me&&st.a>=2&&E.fortifyTargets(V,t).length){ S.fSrc=t; S.fTgt=null; S.fN=1; render(); } else if(st.o===V.me) toast("Pick a territory with 2+ armies and a friendly place to move to."); else info(t); }
      else if(t===S.fSrc){ S.fSrc=null; S.fTgt=null; render(); }
      else if(E.fortifyTargets(V,S.fSrc).indexOf(t)>=0){ S.fTgt=t; S.fN=Math.max(1,Math.min(S.fN,maxFort())); render(); }
      else if(st.o===V.me&&st.a>=2&&E.fortifyTargets(V,t).length){ S.fSrc=t; S.fTgt=null; S.fN=1; render(); }
      else info(t);
      return;
    }
    info(t);
  }
  function maxFort(){ var m=V.terr[S.fSrc].a-1; if(V.o.fortify==="steps7") m=Math.min(m,V.fortLeft); return m; }
  function toast(m,icon){ if(cfg.toast){ if(L) cfg.toast(m,{icon:icon||"info"}); else cfg.toast(m); } }
  function info(t){
    var st=V.terr[t], c=MP.continents[MP.cont[t]];
    var own=st.o>=0?nm(st.o)+", "+st.a+" "+(st.a===1?"army":"armies"):"unclaimed", brd=MP.adj[t].map(function(u){ return MP.names[u]; }).join(", ");
    var txt="<b>"+esc(MP.names[t])+"</b><span>"+esc(c.name)+" (+"+c.bonus+") · "+esc(own)+"</span><span>Borders: "+esc(brd)+"</span>";
    var el=board.root.parentNode.querySelector(".rkinfo"); if(!el){ el=document.createElement("div"); el.className="rkinfo"; board.root.parentNode.appendChild(el); }
    var tvL=L&&onTV(), vp=board.viewPoint?board.viewPoint(t):[MP.x[t]/MP.W,MP.y[t]/MP.H], rt=vp[0]<.5, tp=vp[1]>.5;   // the card keeps off the territory it names: the opposite side, the other half
    if(!L){ el.style.left=rt?"auto":""; el.style.right=rt?".5rem":""; el.style.top=tp?".5rem":""; el.style.bottom=tp?"auto":""; }
    else if(!tvL) el.classList.toggle("is-top",tp);   // the Luxe phone: a card across the frame on the edge away from the territory (review, step 5, css); TV: under the map (css)
    el.innerHTML=txt; el.style.display="block"; if(!tvL&&board.setInspect) board.setInspect(t);   // the territory it names is outlined on the map
    clearTimeout(S.infoT); S.infoT=setTimeout(hideInfo,4200);
  }
  function hideInfo(){ var el=board.root.parentNode.querySelector(".rkinfo"); clearTimeout(S.infoT); if(el) el.style.display="none"; if(board.setInspect) board.setInspect(-1); }
  // a new touch on the map (a tap, a long press, a pinch or a pan) or a zoom closes the card: the next tap opens the right one
  board.root.addEventListener("pointerdown",function(e){ if(e.target&&e.target.closest&&e.target.closest(".rk-fitbtn")) return; if(!(L&&onTV())) hideInfo(); });
  if(L){   // TV: the territory the D-pad is on names itself (the map's own labels only show when zoomed in)
    board.root.addEventListener("focusin",function(e){ var tg=e.target&&e.target.closest&&e.target.closest(".tg"); if(tg&&V) info(+tg.getAttribute("data-t")); });
    board.root.addEventListener("focusout",function(e){ if(e.relatedTarget&&board.root.contains(e.relatedTarget)) return; var el=board.root.parentNode.querySelector(".rkinfo"); if(el){ clearTimeout(S.infoT); el.style.display="none"; } });
  }

  /* ------------ rendering ------------ */
  function setStat(txt,col){ var s=$("rkstat"); s.style.setProperty("--pc",col||"transparent"); s.innerHTML=(col?'<span class="pd" style="background:'+col+'"></span>':"")+'<span>'+txt+'</span>'; }
  function btn(txt,a,cls,dis){ return '<button data-a="'+a+'" class="'+(cls||"")+'"'+(dis?" disabled":"")+'>'+txt+'</button>'; }
  function render(){
    if(!V) return;
    var key=V.turn+"/"+V.phase; if(key!==S.key){ if(V.phase==="reinforce") S.amt=1; S.key=key; S.shiftOpen=false; S.src=null; S.tgt=null; S.fSrc=null; S.fTgt=null; S.s2=[]; S.s2n=null; S.occN=null; stopBlitz(); }
    if(S.src!=null&&(V.terr[S.src].o!==V.me||V.terr[S.src].a<2||V.phase!=="attack")){ S.src=null; S.tgt=null; }
    if(S.tgt!=null&&(V.terr[S.tgt].o===V.me||V.phase!=="attack")) S.tgt=null;
    if(S.fSrc!=null&&(V.terr[S.fSrc].o!==V.me||V.terr[S.fSrc].a<2||V.phase!=="fortify")){ S.fSrc=null; S.fTgt=null; }
    if(L){ renderL(); return; }
    var m=mine(), ph=V.phase, cp=pcol(V,V.turn), who=nm(V.turn);
    var acts="", marks={sel:null,src:{},tgt:{},hot:{},mine:{}};
    var stat="";
    if(V.over){ stat="🏆 <b>"+esc(nm(V.winner))+"</b> wins the game!"; }
    else if(!m){
      var ph2={claim:"is claiming territories",deploy:"is placing armies",setup2p:"is placing armies",hq:"is choosing a headquarters",choose:"is choosing",reinforce:"is placing reinforcements",attack:"is attacking",occupy:"is moving in",fortify:"is making a free move"}[ph]||"is playing";
      stat="<b>"+esc(who)+"</b> "+ph2+"…";
    } else {
      switch(ph){
        case "claim": stat="<b>Your turn</b> — tap an empty territory to claim it. ("+V.terr.filter(function(t){ return t.o===-1; }).length+" left)"; V.terr.forEach(function(t,i){ if(t.o===-1) marks.hot[i]=1; }); acts+=btn("Finish setup for me","autoSetup","");
          break;
        case "deploy": stat="<b>Place armies</b> — tap one of your territories to add an army ("+V.initLeft[V.me]+" left)."; owned(V.me).forEach(function(i){ marks.mine[i]=1; }); acts+=btn("Place the rest for me","autoSetup",""); break;
        case "setup2p": { var need=Math.min(2,V.initLeft[V.me]);
          stat="<b>Place armies</b> — tap your territory ("+Math.min(S.s2.length+1,need)+" of "+need+")"+(V.initLeft[2]>0?", then a NEUTRAL territory for the neutral army":"")+".";
          owned(V.me).forEach(function(i){ marks.mine[i]=1; }); S.s2.forEach(function(i){ marks.sel=i; }); owned(2).forEach(function(i){ marks.hot[i]=1; });
          acts+=btn("Reset picks","s2reset",""); acts+=btn("Finish setup for me","autoSetup",""); break; }
        case "hq": stat="<b>Secret headquarters</b> — tap one of your territories to make it your HQ."; owned(V.me).forEach(function(i){ marks.mine[i]=1; }); break;
        case "choose": stat="<b>Your turn</b> — old rules: reinforce OR attack this turn."; acts+=btn("Reinforce (+"+E.terrArmies(V,V.me)+" armies)","mode:reinforce","pri")+btn("Attack","mode:attack",""); break;
        case "reinforce": {
          var forced=V.myCards.length>=V.o.forcedTrade&&E.findSets(V.myCards).length||(V.mustDown&&V.myCards.length>4);
          stat="<b>Reinforce</b> — "+V.reserve+" "+(V.reserve===1?"army":"armies")+" left. Tap any of your territories to place "+(S.amt==="all"?"all remaining":Math.min(V.reserve,S.amt|0||1))+" there."+(forced?" You must trade in cards first!":"");
          owned(V.me).forEach(function(i){ marks.mine[i]=1; });
          if(V.reserve>0) acts+='<div class="rkseg"><span>Armies per tap:</span>'+[1,5,10,"all"].map(function(a){ return '<button data-a="amt:'+a+'" class="'+(String(S.amt)===String(a)?"on":"")+'">'+(a==="all"?"All":a)+'</button>'; }).join("")+'</div>';
          if(E.findSets(V.myCards).length&&!(V.mustDown&&V.myCards.length<=4)) acts+=btn("🃏 Trade cards","cards",forced?"pri":"");
          if(V.reserve===0) acts+=btn("Done — start attacking ▶","endReinforce","pri",forced);
          if(forced&&modalClosed()) setTimeout(function(){ openCards(); },50);
          break; }
        case "attack": {
          var sp=V.shiftPair;
          if(sp&&V.terr[sp.a].o===V.me&&V.terr[sp.b].o===V.me&&S.src==null){
            if(S.shiftOpen){
              var ta=V.terr[sp.a].a, tb=V.terr[sp.b].a, kb=Math.max(1,sp.min||1), mxA=ta-1, mxB=tb-kb; if(S.shiftN==null||S.shiftN<1) S.shiftN=1; S.shiftN=Math.max(1,Math.min(S.shiftN,Math.max(mxA,mxB,1)));
              stat="<b>Shift armies</b> between <b>"+esc(MP.names[sp.a])+"</b> ("+ta+") and <b>"+esc(MP.names[sp.b])+"</b> ("+tb+") — "+(kb>1?"at least "+kb+" stay in "+esc(MP.names[sp.b])+" (the dice you rolled) and 1 in "+esc(MP.names[sp.a])+".":"at least 1 stays in each.");
              marks.src[sp.a]=1; marks.src[sp.b]=1;
              acts+='<div class="rkstep"><button data-a="sh:-1">−</button><b>'+S.shiftN+'</b><button data-a="sh:1">+</button></div>'+
                btn("◀ Move "+S.shiftN+" to "+esc(MP.names[sp.a]),"shmove:"+sp.b+":"+sp.a,"pri",S.shiftN>mxB)+btn("Move "+S.shiftN+" to "+esc(MP.names[sp.b])+" ▶","shmove:"+sp.a+":"+sp.b,"pri",S.shiftN>mxA)+btn("Done","shdone","");
              acts+=btn("End attacks ▶","endAttack",""); break;
            }
            acts+=btn("↔ Shift armies ("+esc(MP.names[sp.a])+" / "+esc(MP.names[sp.b])+")","shopen","");
          }
          if(V.noAttack){ stat="You reinforced this turn, so no attacking."; acts+=btn("Continue ▶","endAttack","pri"); break; }
          if(S.src==null){ stat="<b>Attack</b> — tap one of your territories (2+ armies) to attack from, or end your attacks."; V.terr.forEach(function(t,i){ if(t.o===V.me&&t.a>=2&&E.targetsFrom(V,i).length) marks.mine[i]=1; }); }
          else if(S.tgt==null){ stat="<b>Attack from "+esc(MP.names[S.src])+"</b> ("+V.terr[S.src].a+") — tap a highlighted enemy territory."; marks.sel=S.src; E.targetsFrom(V,S.src).forEach(function(i){ marks.tgt[i]=1; }); }
          else {
            marks.sel=S.src; marks.tgt[S.tgt]=1; var A=V.terr[S.src].a, D=V.terr[S.tgt], md=Math.min(3,A-1);
            stat="<b>"+esc(MP.names[S.src])+"</b> ("+A+") ⚔ <b>"+esc(MP.names[S.tgt])+"</b> ("+D.a+", "+esc(nm(D.o))+") — win chance ≈ "+Math.round(E.winProb(A,D.a)*100)+"% if you fight to the end.";
            if(S.blitz) acts+=btn("⏹ Stop","stopblitz","red");
            else { for(var dd=md;dd>=1;dd--) acts+=btn("🎲 Roll "+dd+(dd===1?" die":" dice"),"atk:"+dd,dd===md?"pri":""); acts+=btn("⚔ Blitz (until won)","blitz",""); }
          }
          acts+=btn("End attacks ▶","endAttack","",S.blitz); break; }
        case "occupy": { var oc=V.occ; if(S.occN==null||S.occN<oc.min||S.occN>oc.max) S.occN=oc.min;
          stat="<b>Conquered "+esc(MP.names[oc.to])+"!</b> How many armies move in from "+esc(MP.names[oc.from])+"? ("+oc.min+"–"+oc.max+")"+(V.o.occupyFree?" You can shift armies back and forth afterwards.":"");
          marks.sel=oc.to; marks.src[oc.from]=1;
          acts+='<div class="rkstep"><button data-a="occ:-1">−</button><b>'+S.occN+'</b><button data-a="occ:1">+</button></div>'+btn("Min ("+oc.min+")","occset:"+oc.min,"")+btn("All ("+oc.max+")","occset:"+oc.max,"")+btn("Move in ▶","occupy","pri");
          break; }
        case "fortify": {
          if(S.fSrc==null){ stat="<b>Free move</b> — "+(V.o.fortify==="connected"?"move armies along any connected path of your territories":(V.o.fortify==="steps7"?"move up to "+V.fortLeft+" armies one step at a time":"move armies from one territory to a neighbour"))+". Tap a territory to move from, or end your turn."; V.terr.forEach(function(t,i){ if(t.o===V.me&&t.a>=2&&E.fortifyTargets(V,i).length) marks.mine[i]=1; }); }
          else if(S.fTgt==null){ stat="<b>Move from "+esc(MP.names[S.fSrc])+"</b> — tap where to send armies."; marks.sel=S.fSrc; E.fortifyTargets(V,S.fSrc).forEach(function(i){ marks.tgt[i]=1; }); acts+=btn("Cancel","fcancel",""); }
          else { var mx=maxFort(); if(S.fN>mx) S.fN=mx; stat="<b>"+esc(MP.names[S.fSrc])+" → "+esc(MP.names[S.fTgt])+"</b> — how many armies?"; marks.sel=S.fSrc; marks.tgt[S.fTgt]=1;
            acts+='<div class="rkstep"><button data-a="f:-1">−</button><b>'+S.fN+'</b><button data-a="f:1">+</button></div>'+btn("All ("+mx+")","fset:"+mx,"")+btn("Move ▶","fmove","pri")+btn("Cancel","fcancel",""); }
          acts+=btn("End turn ▶","endTurn","pri");
          break; }
      }
    }
    setStat(stat,V.over?null:cp.c);
    $("rkacts").innerHTML=acts;
    // log + dice
    $("rklog").innerHTML=(V.log||[]).slice(-3).map(esc).join("<br>");
    // toolbar
    var cardsN=V.myCards.length;
    $("rkbar").innerHTML='<button data-a="cards">🃏 Cards ('+cardsN+')</button>'+(V.o.mode==="mission"?'<button data-a="mission">🎯 Mission</button>':'')+(V.o.mode==="capital"?'<button data-a="hqinfo">🏰 HQ</button>':'')+'<button data-a="players">👥 Players</button><button data-a="zoomin">＋</button><button data-a="zoomout">－</button><button data-a="fit">⤢ Fit</button>'+(cfg.extraButtons||"");
    // dice display for the latest attack
    var la=V.lastAttack;
    if(la&&la.seq!==S.lastSeq){ S.lastSeq=la.seq; $("rkdice").innerHTML=diceBlock(la,V); board.flash(la.to,la.conquered?"win":"hit",800); if(cfg.onDice) cfg.onDice(la); }
    else if(!la) $("rkdice").innerHTML="";
    if(ph!=="attack"&&ph!=="occupy"&&la&&la.p!==V.turn){ /* keep showing the last roll until it is replaced */ }
    board.setMarks(marks);
  }
  /* the Luxe panel (step 4): the same turn flow, rules and actions as render() above; the choices that need an answer (how many dice,
     how many armies move in, how many move, the shift after a conquest) go into a sheet with the exact outcome under each one, the
     board staying in view above it (the page places it: cfg.onSheet) */
  function renderL(){
    var m=mine(), ph=V.phase, who=nm(V.turn);
    var acts="", marks={sel:null,src:{},tgt:{},hot:{},mine:{}}, stat="", sh=null;
    var la=V.lastAttack, fresh=!!(la&&la.seq!==S.lastSeq);
    if(fresh) S.lastSeq=la.seq;
    if(V.over){ stat="<b>"+esc(nm(V.winner))+"</b> wins the game!"; }
    else if(!m){
      var ph2={claim:"is claiming territories",deploy:"is placing armies",setup2p:"is placing armies",hq:"is choosing a headquarters",choose:"is choosing",reinforce:"is placing reinforcements",attack:"is attacking",occupy:"is moving in",fortify:"is making a free move"}[ph]||"is playing";
      stat="<b>"+esc(who)+"</b> "+ph2+"…";
    } else {
      switch(ph){
        case "claim": stat="<b>Your turn</b> — "+tapW()+" an empty territory to claim it. ("+V.terr.filter(function(t){ return t.o===-1; }).length+" left)"; V.terr.forEach(function(t,i){ if(t.o===-1) marks.hot[i]=1; }); acts+=bt("Finish setup for me","autoSetup");
          break;
        case "deploy": stat="<b>Place armies</b> — "+tapW()+" one of your territories to add an army ("+V.initLeft[V.me]+" left)."; owned(V.me).forEach(function(i){ marks.mine[i]=1; }); acts+=bt("Place the rest for me","autoSetup"); break;
        case "setup2p": { var need=Math.min(2,V.initLeft[V.me]);
          stat="<b>Place armies</b> — "+tapW()+" your territory ("+Math.min(S.s2.length+1,need)+" of "+need+")"+(V.initLeft[2]>0?", then a NEUTRAL territory for the neutral army":"")+".";
          owned(V.me).forEach(function(i){ marks.mine[i]=1; }); S.s2.forEach(function(i){ marks.sel=i; }); owned(2).forEach(function(i){ marks.hot[i]=1; });
          acts+=bt("Reset picks","s2reset",{icon:"reset"}); acts+=bt("Finish setup for me","autoSetup"); break; }
        case "hq": stat="<b>Secret headquarters</b> — "+tapW()+" one of your territories to make it your HQ."; owned(V.me).forEach(function(i){ marks.mine[i]=1; }); break;
        case "choose": stat="<b>Your turn</b> — old rules: reinforce OR attack this turn."; acts+=bt("Reinforce (+"+E.terrArmies(V,V.me)+" armies)","mode:reinforce",{pri:1,icon:"plus"})+bt("Attack","mode:attack",{icon:"dice"}); break;
        case "reinforce": {
          var forced=V.myCards.length>=V.o.forcedTrade&&E.findSets(V.myCards).length||(V.mustDown&&V.myCards.length>4);
          stat="<b>Reinforce</b> — "+V.reserve+" "+(V.reserve===1?"army":"armies")+" left. "+tapW(1)+" any of your territories to place "+(S.amt==="all"?"all remaining":Math.min(V.reserve,S.amt|0||1))+" there."+(forced?" You must trade in cards first!":"");
          owned(V.me).forEach(function(i){ marks.mine[i]=1; });
          if(V.reserve>0) acts+='<div class="rk-amt"><span class="rk-amt__lbl" id="rkAmtLbl">'+(onTV()?"Armies each time":"Armies per tap")+'</span><div class="bg-seg rk-amt__seg" role="group" aria-labelledby="rkAmtLbl">'+
            [1,5,10,"all"].map(function(a){ var on=String(S.amt)===String(a); return '<button type="button" data-a="amt:'+a+'" class="'+(on?"on":"")+'" aria-pressed="'+on+'">'+(a==="all"?"All":a)+'</button>'; }).join("")+'</div></div>';
          if(E.findSets(V.myCards).length&&!(V.mustDown&&V.myCards.length<=4)) acts+=bt("Trade cards","cards",{pri:forced,icon:"cards"});
          if(V.reserve===0) acts+=bt("Done — start attacking","endReinforce",{pri:1,dis:forced,icon:"check"});
          if(forced&&modalClosed()&&!held()) setTimeout(function(){ if(!held()&&modalClosed()&&mine()&&V.phase==="reinforce") openCards(); },50);
          break; }
        case "attack": {
          var sp=V.shiftPair, shiftable=sp&&V.terr[sp.a].o===V.me&&V.terr[sp.b].o===V.me&&S.src==null;
          if(shiftable&&S.shiftOpen){
            var ta=V.terr[sp.a].a, tb=V.terr[sp.b].a, kb=Math.max(1,sp.min||1), mxA=ta-1, mxB=tb-kb; if(S.shiftN==null||S.shiftN<1) S.shiftN=1; S.shiftN=Math.max(1,Math.min(S.shiftN,Math.max(mxA,mxB,1)));
            var keepTxt=kb>1?"at least "+kb+" stay in "+esc(MP.names[sp.b])+" (the dice you rolled) and 1 in "+esc(MP.names[sp.a])+".":"at least 1 stays in each.";
            stat="<b>Shift armies</b> between <b>"+esc(MP.names[sp.a])+"</b> ("+ta+") and <b>"+esc(MP.names[sp.b])+"</b> ("+tb+") — "+keepTxt;
            marks.src[sp.a]=1; marks.src[sp.b]=1;
            sh={kind:"shift",html:shiftSheet(sp,ta,tb,mxA,mxB,keepTxt)};
            acts+=bt("End attacks","endAttack"); break;
          }
          if(shiftable) acts+=bt("Shift armies ("+esc(MP.names[sp.a])+" / "+esc(MP.names[sp.b])+")","shopen",{icon:"swap"});
          if(V.noAttack){ stat="You reinforced this turn, so no attacking."; acts+=bt("Continue","endAttack",{pri:1,icon:"check"}); break; }
          if(S.src==null){ stat="<b>Attack</b> — "+tapW()+" one of your territories (2+ armies) to attack from, or end your attacks."; V.terr.forEach(function(t,i){ if(t.o===V.me&&t.a>=2&&E.targetsFrom(V,i).length) marks.mine[i]=1; }); }
          else if(S.tgt==null){ stat="<b>Attack from "+esc(MP.names[S.src])+"</b> ("+V.terr[S.src].a+") — "+tapW()+" a highlighted enemy territory."; marks.sel=S.src; E.targetsFrom(V,S.src).forEach(function(i){ marks.tgt[i]=1; }); acts+=bt("Cancel","acancel",{icon:"close"}); }
          else {
            marks.sel=S.src; marks.tgt[S.tgt]=1; var A=V.terr[S.src].a, D=V.terr[S.tgt], wp=Math.round(E.winProb(A,D.a)*100);   // the win chance: ONE table lookup a redraw (risk-1)
            stat="<b>"+esc(MP.names[S.src])+"</b> ("+A+") attacks <b>"+esc(MP.names[S.tgt])+"</b> ("+D.a+", "+esc(nm(D.o))+") — win chance about "+wp+"% if you fight to the end.";
            sh={kind:"attack",html:attackSheet(A,D,wp,la)};
          }
          acts+=bt("End attacks","endAttack",{dis:S.blitz}); break; }
        case "occupy": { var oc=V.occ; if(S.occN==null||S.occN<oc.min||S.occN>oc.max) S.occN=oc.min;
          stat="<b>Conquered "+esc(MP.names[oc.to])+"!</b> How many armies move in from "+esc(MP.names[oc.from])+"? ("+oc.min+"–"+oc.max+")"+(V.o.occupyFree?" You can shift armies back and forth afterwards.":"");
          marks.sel=oc.to; marks.src[oc.from]=1;
          sh={kind:"occupy",html:occupySheet(oc,la)};
          break; }
        case "fortify": {
          if(S.fSrc==null){ stat="<b>Free move</b> — "+(V.o.fortify==="connected"?"move armies along any connected path of your territories":(V.o.fortify==="steps7"?"move up to "+V.fortLeft+" armies one step at a time":"move armies from one territory to a neighbour"))+". "+tapW(1)+" a territory to move from, or end your turn."; V.terr.forEach(function(t,i){ if(t.o===V.me&&t.a>=2&&E.fortifyTargets(V,i).length) marks.mine[i]=1; }); }
          else if(S.fTgt==null){ stat="<b>Move from "+esc(MP.names[S.fSrc])+"</b> — "+tapW()+" where to send armies."; marks.sel=S.fSrc; E.fortifyTargets(V,S.fSrc).forEach(function(i){ marks.tgt[i]=1; }); acts+=bt("Cancel","fcancel",{icon:"close"}); }
          else { var mx=maxFort(); if(S.fN>mx) S.fN=mx; stat="<b>"+esc(MP.names[S.fSrc])+" to "+esc(MP.names[S.fTgt])+"</b> — how many armies?"; marks.sel=S.fSrc; marks.tgt[S.fTgt]=1;
            sh={kind:"fortify",html:fortifySheet(mx)}; acts+=bt("Cancel","fcancel",{icon:"close"}); }
          acts+=bt("End turn","endTurn",{pri:1,icon:"check"});
          break; }
      }
    }
    // the status card: the seat dot of whose turn it is (Luxe seat colours; the map keeps its own until step 5)
    var s=$("rkstat"), seat=V.over?null:seatOf(V.turn);
    if(seat) s.setAttribute("data-seat",seat); else s.removeAttribute("data-seat");
    s.innerHTML=(seat?'<span class="rk-dot" aria-hidden="true"></span>':ico("trophy"))+'<span class="rk-stat__txt">'+stat+'</span>';
    var ka=fkey(root);
    $("rkacts").innerHTML=acts;
    $("rklog").innerHTML=(V.log||[]).slice(-3).map(esc).join("<br>");
    var cardsN=V.myCards.length, bk=cardsN+"|"+V.o.mode+"|"+onTV();
    if(bk!==S.barKey){ S.barKey=bk;   // the toolbar is redrawn only when it changes, so the D-pad focus on it is never lost
      $("rkbar").innerHTML='<button type="button" class="bg-btn bg-btn--secondary bg-btn--sm" data-a="cards">'+ico("cards")+'<span>Cards ('+cardsN+')</span></button>'+
        (V.o.mode==="mission"?'<button type="button" class="bg-btn bg-btn--secondary bg-btn--sm" data-a="mission">'+ico("flag")+'<span>Mission</span></button>':'')+
        (V.o.mode==="capital"?'<button type="button" class="bg-btn bg-btn--secondary bg-btn--sm" data-a="hqinfo">'+ico("crown")+'<span>HQ</span></button>':'')+
        '<button type="button" class="bg-btn bg-btn--secondary bg-btn--sm" data-a="players">'+ico("user")+'<span>Players</span></button>'+
        '<span class="rk-zoom"><button type="button" class="bg-btn bg-btn--icon" data-a="zoomin" aria-label="Zoom in">'+ico("plus")+'</button><button type="button" class="bg-btn bg-btn--icon" data-a="zoomout" aria-label="Zoom out">'+ico("minus")+'</button>'+
        '<button type="button" class="bg-btn bg-btn--secondary bg-btn--sm" data-a="fit">'+ico("reset")+'<span>Fit</span></button></span>'+(cfg.extraButtons||"");
    }
    // the dice of the latest attack (CPU attacks too): they tumble in once, when the roll is new
    if(fresh){ $("rkdice").innerHTML=diceBlockL(la,V); rollIn($("rkdice")); board.flash(la.to,la.conquered?"win":"hit",800); if(cfg.onDice) cfg.onDice(la); }
    else if(!la) $("rkdice").innerHTML="";
    board.setMarks(marks);
    syncSheet(sh,fresh);
    frestore(root,ka);
  }
  function attackSheet(A,D,wp,la){
    var md=Math.min(3,A-1), dd=Math.min(2,D.a), an=esc(MP.names[S.src]), dn=esc(MP.names[S.tgt]);
    var h=shead("Attack",an+" attacks "+dn,"<b>"+A+"</b> armies against <b>"+D.a+"</b> ("+esc(nm(D.o))+"). Win chance about <b>"+wp+"%</b> if you fight to the end.","rkMoveTitle");
    if(la&&la.from===S.src&&la.to===S.tgt) h+='<div class="rk-dice rk-dice--sheet">'+diceBlockL(la,V)+'</div>';
    h+='<div class="bg-sheet__options">';
    var roll=function(d){ var k=Math.min(d,dd); return opt("atk:"+d,"Roll "+d+(d===1?" die":" dice"),d===md?"Your best odds for each roll.":"",d+" vs "+dd+(dd===1?" die":" dice")+" · "+armies(k)+" at stake",{best:d===md,icon:"dice"}); };
    if(S.blitz) h+=opt("stopblitz","Stop","Rolling until "+dn+" falls or "+an+" has 1 army left.","win chance about "+wp+"%",{best:1,icon:"close"});
    else {   // the best roll first, then Blitz (the next most used), then the weaker rolls
      h+=roll(md);
      h+=opt("blitz","Blitz","Rolls until "+dn+" falls or "+an+" has 1 army left.","win chance about "+wp+"%",{icon:"play"});
      for(var d=md-1;d>=1;d--) h+=roll(d);
    }
    h+='</div><div class="rk-sbtns"><button type="button" class="bg-btn bg-btn--secondary" data-a="atkback">'+ico("back")+'<span>Other target</span></button><button type="button" class="bg-btn bg-btn--secondary" data-a="endAttack"'+(S.blitz?" disabled":"")+'><span>End attacks</span></button></div>';
    return h;
  }
  function occupySheet(oc,la){
    var n=S.occN, fa=V.terr[oc.from].a, an=esc(MP.names[oc.from]), bn=esc(MP.names[oc.to]);
    var h=shead("Conquered!","Move into "+bn,"How many armies move in from "+an+"? ("+oc.min+"–"+oc.max+")"+(V.o.occupyFree?" You can shift armies back and forth afterwards.":""),"rkMoveTitle");
    if(la&&la.to===oc.to&&la.conquered) h+='<div class="rk-dice rk-dice--sheet">'+diceBlockL(la,V)+'</div>';
    h+='<div class="rk-pick">'+stepper("occ",n,"Armies to move in")+'<button type="button" class="bg-btn bg-btn--secondary" data-a="occset:'+oc.min+'"><span>Min '+oc.min+'</span></button><button type="button" class="bg-btn bg-btn--secondary" data-a="occset:'+oc.max+'"><span>All '+oc.max+'</span></button></div>';
    h+='<div class="bg-sheet__options">'+opt("occupy","Move in "+armies(n),"",an+" "+fa+" to "+(fa-n)+" · "+bn+" 0 to "+n,{best:1,icon:"check"})+'</div>';
    return h;
  }
  function fortifySheet(mx){
    var n=S.fN, a=V.terr[S.fSrc].a, b=V.terr[S.fTgt].a, an=esc(MP.names[S.fSrc]), bn=esc(MP.names[S.fTgt]);
    var rule=V.o.fortify==="connected"?"Along any connected path of your territories":(V.o.fortify==="steps7"?"One step at a time, "+V.fortLeft+" left this turn":"One territory to a neighbour");
    var h=shead("Free move",an+" to "+bn,rule+"; up to "+armies(mx)+".","rkMoveTitle");
    h+='<div class="rk-pick">'+stepper("f",n,"Armies to move")+'<button type="button" class="bg-btn bg-btn--secondary" data-a="fset:'+mx+'"><span>All '+mx+'</span></button></div>';
    h+='<div class="bg-sheet__options">'+opt("fmove","Move "+armies(n),"",an+" "+a+" to "+(a-n)+" · "+bn+" "+b+" to "+(b+n),{best:1,icon:"check"})+'</div>';
    h+='<div class="rk-sbtns"><button type="button" class="bg-btn bg-btn--secondary" data-a="fcancel">'+ico("close")+'<span>Cancel</span></button></div>';
    return h;
  }
  function shiftSheet(sp,ta,tb,mxA,mxB,keepTxt){
    var n=S.shiftN, an=esc(MP.names[sp.a]), bn=esc(MP.names[sp.b]);
    var h=shead("After the conquest","Shift armies","Between "+an+" ("+ta+") and "+bn+" ("+tb+"): "+keepTxt,"rkMoveTitle");
    h+='<div class="rk-pick">'+stepper("sh",n,"Armies to shift")+'</div>';
    h+='<div class="bg-sheet__options">'+opt("shmove:"+sp.a+":"+sp.b,"Move "+n+" to "+bn,"",an+" "+ta+" to "+(ta-n)+" · "+bn+" "+tb+" to "+(tb+n),{dis:n>mxA,best:n<=mxA,icon:"arrow"})+
      opt("shmove:"+sp.b+":"+sp.a,"Move "+n+" to "+an,"",bn+" "+tb+" to "+(tb-n)+" · "+an+" "+ta+" to "+(ta+n),{dis:n>mxB,best:n>mxA&&n<=mxB,icon:"swap"})+'</div>';
    h+='<div class="rk-sbtns"><button type="button" class="bg-btn bg-btn--secondary" data-a="shdone">'+ico("check")+'<span>Done</span></button></div>';
    return h;
  }
  // open, refill or close the choice sheet so it always matches the turn; a sheet the player closes (Back, the scrim) goes back to the map
  function held(){ return !!(cfg.held&&cfg.held()); }   // the page shows its Menu over the game: no sheet opens until Resume
  function syncSheet(sh,fresh){
    var kind=(sh&&!held())?sh.kind:null, open=BG.sheet.isOpen(actEl);
    if(!kind){ if(open) closeAct(); S.actKind=null; return; }
    var keep=(open&&S.actKind===kind)?fkey(actEl):null;
    if(open&&S.actKind!==kind) closeAct(true);   // another kind: it opens again in the same place (whether it may be dismissed is fixed when it opens)
    actIn.innerHTML=sh.html;
    if(fresh) rollIn(actIn);
    if(!BG.sheet.isOpen(actEl)){
      S.actKind=kind; actEl.setAttribute("data-kind",kind); actEl.scrollTop=0;
      if(cfg.onSheet) cfg.onSheet(true,actEl,kind);
      BG.sheet.open(actEl,{dismissible:kind!=="occupy",focus:actEl.querySelector(".bg-sheet__option.is-best:not([disabled])")||undefined,onClose:actClosed});
    } else frestore(actEl,keep);
  }
  function closeAct(silent){ S.actClosing=true; S.actSilent=!!silent; try{ BG.sheet.close(actEl); }finally{ S.actClosing=false; S.actSilent=false; } }
  function actClosed(){
    var k=S.actKind; S.actKind=null;
    if(cfg.onSheet&&!S.actSilent) cfg.onSheet(false,actEl,k);   // silent: the next sheet takes its place at once (the page keeps the map's place)
    if(S.actClosing||!V) return;   // the panel closed it: the game moved on
    if(k==="attack"){ stopBlitz(); S.tgt=null; } else if(k==="fortify"){ S.fTgt=null; } else if(k==="shift"){ S.shiftOpen=false; }
    render();
  }
  function modalClosed(){ return L?!BG.sheet.isOpen(modal):!modal.classList.contains("show"); }

  /* ------------ windows ------------ */
  function openCards(){
    if(L){ openCardsL(); return; }
    var cards=V.myCards;
    if(!cards.length){ openModal('<h2>🃏 Your cards</h2><p style="opacity:.8">You have no territory cards yet. You draw one at the end of any turn in which you conquer a territory.</p><div class="rkacts"><button data-m="close">Close</button></div>'); return; }
    var sets=E.findSets(cards), canTrade=V.phase==="reinforce"&&mine()&&!(V.mustDown&&cards.length<=4);   // after an elimination you stop trading at 4 cards
    var sel=S.cardSel.filter(function(id){ return cards.some(function(c){ return c.id===id; }); }); S.cardSel=sel;
    var sc=sel.map(function(id){ return cards.filter(function(c){ return c.id===id; })[0]; });
    var ok=sc.length===3&&E.validSet(sc), val=ok?E.setValue(V,sc):null;
    var bonusOpts=[]; if(ok&&(V.o.terrBonus==="cap2"||V.o.terrBonus==="cap2turn"&&!V.bonusUsed)){ sc.forEach(function(c){ if(c.t>=0&&V.terr[c.t].o===V.me&&bonusOpts.indexOf(c.t)<0) bonusOpts.push(c.t); }); }
    var h='<h2>🃏 Your cards ('+cards.length+')</h2><div style="font-size:12.5px;opacity:.85">Sets: three alike, one of each, or any two plus a wild card. '+(V.nextSet?'Next set is worth <b>'+V.nextSet+'</b> armies':'Set values depend on the card types')+' · '+V.setsTraded+' traded so far.'+(V.o.terrBonus!=="none"?' ★ = you own that territory (+2 armies on it when traded'+(V.o.terrBonus==="cap2turn"&&V.bonusUsed?'; already used this turn':'')+').':'')+'</div>';
    h+='<div class="rkcards">'+cards.map(function(c){ return cardHTML(c,{sel:sel.indexOf(c.id)>=0,owned:V.o.terrBonus!=="none"&&c.t>=0&&V.terr[c.t].o===V.me}); }).join("")+'</div>';
    if(canTrade){ h+='<div class="rkacts">'+(ok?'<button class="pri" data-m="trade">Trade in for '+val+' armies</button>':'<button disabled>Select 3 cards to trade</button>')+(sets.length&&!ok?'<button data-m="auto">Pick a set for me</button>':'')+'</div>';
      if(bonusOpts.length>1) h+='<div style="font-size:12px;text-align:center">+2 bonus armies go on: '+bonusOpts.map(function(t,i){ return '<label style="margin:0 6px"><input type="radio" name="bt" value="'+t+'"'+(i===0?" checked":"")+'> '+esc(MP.names[t])+'</label>'; }).join("")+'</div>'; }
    else h+='<div style="font-size:12px;opacity:.75;text-align:center">You can trade in cards at the start of your turn, while you reinforce.</div>';
    h+='<div class="rkacts"><button data-m="close">Close</button></div>';
    openModal(h);
  }
  function openMission(){ if(L){ openMissionL(); return; } openModal('<h2>🎯 Your secret mission</h2><div class="rkmission">'+esc(V.mission||"No mission.")+'</div><p style="font-size:12px;opacity:.8">Keep it secret! The first player to complete their mission wins. If you are dealt a mission to destroy your own colour, it becomes “Occupy 24 territories”.</p><div class="rkacts"><button data-m="close">Close</button></div>'); }
  function openHq(){ if(L){ openHqL(); return; } var t=V.myHq; var rows=V.players.filter(function(p){ return !p.neutral; }).map(function(p){ return '<div class="rkplayer"><span class="sw" style="background:'+pcol(V,p.id).c+'"></span><span class="nm">'+esc(p.name)+'<small>HQ: '+(p.hq!=null?esc(MP.names[p.hq])+(V.terr[p.hq].o===p.id?" (held)":" — captured by "+esc(nm(V.terr[p.hq].o))):"secret")+'</small></span></div>'; }).join(""); openModal('<h2>🏰 Headquarters</h2><div style="font-size:12.5px;opacity:.85">Capture the other players\' headquarters while holding your own to win. Losing your HQ does not eliminate you.</div>'+rows+'<div class="rkacts"><button data-m="close">Close</button></div>'); }
  function openPlayers(){
    if(L){ openPlayersL(); return; }
    var rows=V.players.map(function(p,i){
      var conts=MP.continents.filter(function(c){ return c.terrs.every(function(t){ return V.terr[t].o===i; }); }).map(function(c){ return c.name; });
      var st=V.terr.reduce(function(a,t){ return t.o===i?a+t.a:a; },0);
      return '<div class="rkplayer'+(i===V.turn&&!V.over?" cur":"")+(p.alive?"":" dead")+'"><span class="sw" style="background:'+pcol(V,i).c+'"></span><span class="nm">'+esc(p.name)+(p.neutral?" (neutral)":"")+(p.alive?"":" — out")+'<small>'+p.terrs+' territories · '+p.armies+' armies'+(p.neutral?"":' · '+p.cards+' cards')+(conts.length?' · holds '+conts.map(esc).join(", "):"")+'</small></span></div>';
    }).join("");
    var cb=MP.continents.map(function(c){ return '<span style="display:inline-block;margin:2px 6px 2px 0;font-size:12px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:'+c.color+';margin-right:4px"></span>'+esc(c.name)+' +'+c.bonus+'</span>'; }).join("");
    openModal('<h2>👥 Players</h2>'+rows+'<div style="margin-top:8px">'+cb+'</div><div style="font-size:12px;opacity:.8;margin-top:6px">Sets traded so far: '+V.setsTraded+(V.nextSet?' · next set worth '+V.nextSet:'')+' · cards in the draw pile: '+V.deck+'</div><div class="rkacts"><button data-m="close">Close</button></div>');
  }
  /* the Luxe windows (step 4): the same text and choices as above, on a sheet; Close (or Back, or the scrim) closes it */
  function wclose(af){ return '<div class="rk-sbtns rk-sbtns--end"><button type="button" class="bg-btn bg-btn--ghost bg-btn--block" data-m="close"'+(af?" data-autofocus":"")+'>'+ico("close")+'<span>Close</span></button></div>'; }
  function openCardsL(){
    var cards=V.myCards;
    if(!cards.length){ openModal(shead("Territory cards","Your cards","You have no territory cards yet. You draw one at the end of any turn in which you conquer a territory.","rkSheetTitle")+wclose(true)); return; }
    var sets=E.findSets(cards), canTrade=V.phase==="reinforce"&&mine()&&!(V.mustDown&&cards.length<=4);   // after an elimination you stop trading at 4 cards
    var sel=S.cardSel.filter(function(id){ return cards.some(function(c){ return c.id===id; }); }); S.cardSel=sel;
    var sc=sel.map(function(id){ return cards.filter(function(c){ return c.id===id; })[0]; });
    var ok=sc.length===3&&E.validSet(sc), val=ok?E.setValue(V,sc):null;
    var bonusOpts=[]; if(ok&&(V.o.terrBonus==="cap2"||V.o.terrBonus==="cap2turn"&&!V.bonusUsed)){ sc.forEach(function(c){ if(c.t>=0&&V.terr[c.t].o===V.me&&bonusOpts.indexOf(c.t)<0) bonusOpts.push(c.t); }); }
    var h=shead("Territory cards","Your cards ("+cards.length+")","Sets: three alike, one of each, or any two plus a wild card. "+(V.nextSet?'Next set is worth <b>'+V.nextSet+'</b> armies':'Set values depend on the card types')+' · '+V.setsTraded+' traded so far.'+
      (V.o.terrBonus!=="none"?' <span class="rk-star">'+ico("star")+'</span> = you own that territory (+2 armies on it when traded'+(V.o.terrBonus==="cap2turn"&&V.bonusUsed?'; already used this turn':'')+').':''),"rkSheetTitle");
    h+='<div class="rkcards rk-cards">'+cards.map(function(c){ return cardHTML(c,{sel:sel.indexOf(c.id)>=0,owned:V.o.terrBonus!=="none"&&c.t>=0&&V.terr[c.t].o===V.me,luxe:true,star:ico("star")}); }).join("")+'</div>';
    if(canTrade){ h+='<div class="rk-sbtns">'+(ok?'<button type="button" class="bg-btn bg-btn--primary" data-m="trade" data-autofocus>'+ico("cards")+'<span>Trade in for '+val+' armies</span></button>':'<button type="button" class="bg-btn bg-btn--secondary" disabled><span>Select 3 cards to trade</span></button>')+(sets.length&&!ok?'<button type="button" class="bg-btn bg-btn--secondary" data-m="auto" data-autofocus>'+ico("check")+'<span>Pick a set for me</span></button>':'')+'</div>';
      if(bonusOpts.length>1) h+='<div class="rk-bonus"><span class="rk-bonus__lbl">+2 bonus armies go on:</span>'+bonusOpts.map(function(t,i){ return '<label class="rk-radio"><input type="radio" name="bt" value="'+t+'"'+(i===0?" checked":"")+'><span>'+esc(MP.names[t])+'</span></label>'; }).join("")+'</div>'; }
    else h+='<p class="rk-note">You can trade in cards at the start of your turn, while you reinforce.</p>';
    h+=wclose(!canTrade||(!ok&&!sets.length));
    openModal(h);
  }
  function openMissionL(){ openModal(shead("Secret Mission Risk","Your secret mission","","rkSheetTitle")+'<div class="rk-mission">'+esc(V.mission||"No mission.")+'</div><p class="rk-note">Keep it secret! The first player to complete their mission wins. If you are dealt a mission to destroy your own colour, it becomes “Occupy 24 territories”.</p>'+wclose(true)); }
  function openHqL(){
    var rows=V.players.filter(function(p){ return !p.neutral; }).map(function(p){ var held=p.hq!=null&&V.terr[p.hq].o===p.id;
      return '<tr><td><span class="bg-score__who" data-seat="'+seatOf(p.id)+'">'+esc(p.name)+'</span></td><td>'+(p.hq!=null?esc(MP.names[p.hq]):"Secret")+'</td><td>'+(p.hq!=null?(held?"Held":"Captured by "+esc(nm(V.terr[p.hq].o))):"–")+'</td></tr>'; }).join("");
    openModal(shead("Capital Risk","Headquarters","Capture the other players' headquarters while holding your own to win. Losing your HQ does not eliminate you.","rkSheetTitle")+
      '<div class="bg-scorepad rk-pad"><table class="bg-score rk-hqtab"><thead><tr><th scope="col">Player</th><th scope="col">HQ</th><th scope="col">Status</th></tr></thead><tbody>'+rows+'</tbody></table></div>'+wclose(true));
  }
  function openPlayersL(){
    var lead=-1, best=-1; V.players.forEach(function(p,i){ if(!p.neutral&&p.alive&&p.terrs>best){ best=p.terrs; lead=i; } });
    var rows=V.players.map(function(p,i){
      var conts=MP.continents.filter(function(c){ return c.terrs.every(function(t){ return V.terr[t].o===i; }); }).map(function(c){ return c.name; });
      return '<tr'+(i===lead?' class="is-lead"':'')+'><td><span class="bg-score__who" data-seat="'+seatOf(i)+'"><span class="rk-pn">'+esc(p.name)+(p.neutral?" (neutral)":"")+(i===V.turn&&!V.over?' <span class="bg-tag bg-tag--accent">Turn</span>':'')+(p.alive?"":' <span class="bg-tag bg-tag--paper">Out</span>')+'</span></span>'+
        (conts.length?'<span class="rk-holds">Holds '+conts.map(esc).join(", ")+'</span>':'')+'</td><td>'+p.terrs+'</td><td class="bg-score__total">'+p.armies+'</td><td>'+(p.neutral?"–":p.cards)+'</td></tr>';
    }).join("");
    var h=shead("The world","Players","","rkSheetTitle")+'<div class="bg-scorepad rk-pad"><table class="bg-score"><thead><tr><th scope="col">Player</th><th scope="col">Territories</th><th scope="col">Armies</th><th scope="col">Cards</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    h+='<div class="rk-conts">'+MP.continents.map(function(c){ return '<span class="rk-cont"><i style="background:'+c.color+'"></i>'+esc(c.name)+' +'+c.bonus+'</span>'; }).join("")+'</div>';
    h+='<p class="rk-note">Sets traded so far: '+V.setsTraded+(V.nextSet?' · next set worth '+V.nextSet:'')+' · cards in the draw pile: '+V.deck+'</p>'+wclose(true);
    openModal(h);
  }
  modal.addEventListener("click",function(e){
    var cardEl=e.target.closest&&e.target.closest(".rkcard");
    if(cardEl){ var id=+cardEl.getAttribute("data-id"), i=S.cardSel.indexOf(id); if(i>=0) S.cardSel.splice(i,1); else if(S.cardSel.length<3) S.cardSel.push(id); if(V.phase==="reinforce"&&mine()) openCards(); return; }
    var b=e.target.closest&&e.target.closest("[data-m]"); if(!b||b.disabled) return; var m=b.getAttribute("data-m");
    if(m==="close") closeModal();
    else if(m==="trade"){ var bt=modal.querySelector('input[name="bt"]:checked'); var ids=S.cardSel.slice(); S.cardSel=[]; var r=act({t:"trade",ids:ids,bonusTerr:bt?+bt.value:null}); closeModal(); }
    else if(m==="auto"){ var sets=E.findSets(V.myCards); if(sets.length){ S.cardSel=sets[0].map(function(c){ return c.id; }); openCards(); } }
  });
  if(L) modal.addEventListener("keydown",function(e){   // a card is a button for the keyboard too (the D-pad's OK clicks it through BGUI)
    var c=e.target&&e.target.closest&&e.target.closest(".rkcard"); if(!c||e.defaultPrevented) return;
    if(e.key==="Enter"||e.key===" "||e.keyCode===13||e.keyCode===32){ e.preventDefault(); c.click(); }
  });

  /* ------------ buttons ------------ */
  function stopBlitz(){ S.blitz=false; clearTimeout(S.blitzT); }
  function blitzStep(){
    if(!S.blitz||!V) return;
    if(V.phase!=="attack"||S.src==null||S.tgt==null){ stopBlitz(); render(); return; }
    var A=V.terr[S.src].a; if(A<2||V.terr[S.tgt].o===V.me){ stopBlitz(); S.tgt=null; render(); return; }
    S.blitzSeq=V.lastAttack?V.lastAttack.seq:-1;
    var r=act({t:"attack",from:S.src,to:S.tgt,dice:Math.min(3,A-1)});
    if(r&&r.ok===false){ stopBlitz(); render(); return; }
    /* the next step is scheduled from update() once the result of this roll arrives (instantly on one device, via the network in Party Mode) */
  }
  function onAct(e){
    var b=e.target.closest&&e.target.closest("button[data-a]"); if(!b||b.disabled) return; var a=b.getAttribute("data-a"), p=a.split(":");
    switch(p[0]){
      case "autoSetup": act({t:"autoSetup"}); break;
      case "s2reset": S.s2=[]; S.s2n=null; render(); break;
      case "mode": act({t:"mode",m:p[1]}); break;
      case "amt": S.amt=p[1]==="all"?"all":+p[1]; render(); break;
      case "cards": openCards(); break;
      case "mission": openMission(); break;
      case "hqinfo": openHq(); break;
      case "players": openPlayers(); break;
      case "zoomin": if(!(L&&onTV())) hideInfo(); board.zoomAt(1.4); break;
      case "zoomout": if(!(L&&onTV())) hideInfo(); board.zoomAt(1/1.4); break;
      case "fit": if(!(L&&onTV())) hideInfo(); board.fit(); break;
      case "endReinforce": act({t:"endReinforce"}); break;
      case "atk": S.shiftOpen=false; act({t:"attack",from:S.src,to:S.tgt,dice:+p[1]}); break;
      case "blitz": S.blitz=true; render(); blitzStep(); break;
      case "stopblitz": stopBlitz(); render(); break;
      case "endAttack": stopBlitz(); S.shiftOpen=false; act({t:"endAttack"}); break;
      case "shopen": S.shiftOpen=true; S.shiftN=1; render(); break;
      case "shdone": S.shiftOpen=false; render(); break;
      case "sh": S.shiftN=Math.max(1,(S.shiftN||1)+(+p[1])); render(); break;
      case "shmove": act({t:"shift",from:+p[1],to:+p[2],n:S.shiftN||1}); break;
      case "occ": S.occN=Math.max(V.occ.min,Math.min(V.occ.max,S.occN+(+p[1]))); render(); break;
      case "occset": S.occN=+p[1]; render(); break;
      case "occupy": S.shiftOpen=false; act({t:"occupy",n:S.occN}); break;
      case "f": S.fN=Math.max(1,Math.min(maxFort(),S.fN+(+p[1]))); render(); break;
      case "fset": S.fN=+p[1]; render(); break;
      case "fcancel": S.fSrc=null; S.fTgt=null; render(); break;
      case "fmove": { var f=S.fSrc,t=S.fTgt,n=S.fN; S.fSrc=null; S.fTgt=null; act({t:"fortify",from:f,to:t,n:n}); break; }
      case "endTurn": act({t:"endTurn"}); break;
      case "acancel": S.src=null; S.tgt=null; render(); break;                 // (Luxe) the attack source picked again
      case "atkback": stopBlitz(); S.tgt=null; render(); break;                 // (Luxe) another target from the same territory
    }
  }
  root.addEventListener("click",onAct);
  if(actEl) actEl.addEventListener("click",onAct);
  board.onTap(tap);
  if(board.onInspect) board.onInspect(function(t){ if(V) info(t); });   // a long press on the map reads any territory without acting on it (step 5)
  self.update=function(v){
    V=v; render();
    if(V.missionConv&&V.me>=0&&!S.convSeen[V.me]){ S.convSeen[V.me]=1; if(L) toast("Another player eliminated your target. Your secret mission is now: "+V.mission,"flag"); else toast("🎯 Another player eliminated your target. Your secret mission is now: "+V.mission); }   // old UK rules
    else if(!V.missionConv&&V.me>=0) delete S.convSeen[V.me];
    if(S.blitz&&V.lastAttack&&V.lastAttack.seq!==S.blitzSeq){ S.blitzSeq=V.lastAttack.seq; clearTimeout(S.blitzT); S.blitzT=setTimeout(blitzStep,cfg.blitzDelay||420); }
  };
  self.openCards=openCards; self.openPlayers=openPlayers; self.openMission=openMission;
  // (Luxe) the page closes the sheets before the Menu shows; the turn's choice sheet comes back with the next redraw
  self.closeSheets=function(){ closeModal(); if(actEl&&BG.sheet.isOpen(actEl)) closeAct(); if(actEl) S.actKind=null; };
  self.destroy=function(){ stopBlitz(); if(L){ self.closeSheets(); if(actEl&&actEl.parentNode) actEl.parentNode.removeChild(actEl); } if(modal.parentNode) modal.parentNode.removeChild(modal); };
  self.reset=function(){ stopBlitz(); S.key=""; S.src=null; S.tgt=null; S.fSrc=null; S.fTgt=null; S.cardSel=[]; S.shiftOpen=false; S.lastSeq=-1; closeModal(); if(L) self.closeSheets(); };   // new game / load: nothing from the old game may act on the new one
  self.luxe=L;
  self.state=S;
  return self;
}
function boardView(v){ return {terr:v.terr,colors:v.players.map(function(p){ return p.neutral?"#9a9a9a":PC[(p.ci||0)%PC.length].c; }),pcol:v.players.map(function(p){ return p.neutral?NEUTRAL:PC[(p.ci||0)%PC.length]; })}; }
Risk.Ctrl={boardView:boardView,create:create,cardHTML:cardHTML,dieHTML:dieHTML,diceBlock:diceBlock,diceBlockL:diceBlockL,CSS:CSS,pcol:pcol,esc:esc,figSVG:figSVG};
})(typeof window!=="undefined"?window:globalThis);
