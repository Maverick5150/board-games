/* UNO — original card artwork (no Mattel art) as HTML/SVG, plus the table + hand controller shared by the phone game and the Party phones. Needs engine.js. */
(function(g){
"use strict";
var Uno=g.Uno=g.Uno||{}, E=Uno.Engine;
var COL={R:"#d6322b",Y:"#f2bf24",G:"#2f9e44",B:"#2d63c8",P:"#e0509a",T:"#15a39d",O:"#f08a24",V:"#7b4bc9",W:"#16161a"};
var INK={R:"#d6322b",Y:"#b8860b",G:"#2f9e44",B:"#2d63c8",P:"#e0509a",T:"#15a39d",O:"#f08a24",V:"#7b4bc9",W:"#16161a"};
var CN=E.CNAME;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }

/* symbol drawings on a 100x100 canvas; col = the card colour used for strokes */
function quarters(r,cols){ var o=''; var a=[[0,-r,r,0],[r,0,0,r],[0,r,-r,0],[-r,0,0,-r]]; cols.forEach(function(c,i){ var p=a[i]; o+='<path d="M0 0 L'+p[0]+' '+p[1]+' A'+r+' '+r+' 0 0 1 '+p[2]+' '+p[3]+' Z" fill="'+c+'"/>'; }); return o; }
function sym(v,col,side){
  var four=side?[COL.P,COL.T,COL.O,COL.V]:[COL.R,COL.Y,COL.G,COL.B];
  function txt(t,sz,y){ return '<text x="50" y="'+(y||64)+'" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="'+sz+'" fill="'+col+'">'+t+'</text>'; }
  var arrows='<g fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M28 40 H66"/><path d="M56 28 L68 40 L56 52"/><path d="M72 62 H34"/><path d="M44 50 L32 62 L44 74"/></g>';
  var skip='<g fill="none" stroke="'+col+'" stroke-width="10"><circle cx="50" cy="50" r="26"/><path d="M31 69 L69 31"/></g>';
  switch(v){
    case "skip": case "wskip": return skip;
    case "skipall": return '<g transform="translate(-14,0) scale(.7)" transform-origin="50 50">'+skip+'</g><g transform="translate(26,0) scale(.7)">'+skip+'</g>';
    case "rev": case "wrev": return arrows;
    case "d1": return txt("+1",44); case "d2": case "wd2": case "wtd2": return txt("+2",44); case "d4": case "wd4": return txt("+4",44); case "d5": return txt("+5",44); case "wd6": return txt("+6",44); case "wd10": return txt("+10",36,62);
    case "wrd4": return arrows.replace('stroke-width="9"','stroke-width="6"').replace(/<g /,'<g transform="translate(0,-8) scale(.78)" transform-origin="50 50" ')+txt("+4",30,86);
    case "wdc": return '<g transform="translate(50,40)">'+quarters(22,four)+'</g>'+txt("+",36,88);
    case "discardall": return '<g fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round"><path d="M32 32 L68 68 M68 32 L32 68"/></g>'+txt("ALL",20,90);
    case "flip": return '<g fill="none" stroke="'+col+'" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"><path d="M34 62 V30 M24 40 L34 28 L44 40"/><path d="M66 38 V70 M56 60 L66 72 L76 60"/></g>';
    case "wswap": return '<g fill="none" stroke="'+col+'" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"><path d="M24 40 H74 M62 28 L76 40 L62 52"/><path d="M76 62 H26 M38 50 L24 62 L38 74"/></g>';
    case "roul": return '<g transform="translate(50,50)">'+quarters(30,four)+'<circle r="9" fill="#fff"/></g>';
    case "wild": return '<g transform="translate(50,50) rotate(-20)">'+quarters(30,four)+'</g>';
  }
  return "";
}
function cornerText(f){
  var v=f.v; if(f.c!=="W"&&v.length===1) return v;
  return {skip:"⊘",rev:"⇄",d1:"+1",d2:"+2",d4:"+4",d5:"+5",skipall:"⊘⊘",discardall:"✕",flip:"⇅",wild:"W",wd4:"+4",wd2:"+2",wdc:"+C",wrd4:"+4",roul:"R",wd6:"+6",wd10:"+10",wrev:"⇄",wskip:"⊘",wskip2:"⊘2",wtd2:"+2",wswap:"⇄"}[v]||"";
}
/* one card face as HTML. card={id,f:[..]}; side 0/1 */
function cardHTML(card,side,o){
  o=o||{}; var f=card.f[side||0], dark=!!side, wild=f.c==="W", base=wild?"#16161a":COL[f.c], ink=wild?"#16161a":INK[f.c];
  var big=(f.c!=="W"&&f.v.length===1)?'<text x="50" y="68" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="58" fill="'+ink+'">'+f.v+'</text>':sym(f.v,ink,side);
  var oval='<ellipse cx="50" cy="50" rx="43" ry="30" transform="rotate(-24 50 50)" fill="'+(dark&&!wild?"#14141a":"#fff")+'"/>';
  var inner=(dark&&!wild&&f.c!=="W")?big.replace(new RegExp(ink,"g"),COL[f.c]):big;
  var ct=cornerText(f);
  var cls="uc"+(dark?" dk":"")+(o.cls?" "+o.cls:"")+(o.dim?" dim":"")+(o.glow?" glow":"");
  return '<div class="'+cls+'" data-id="'+card.id+'"'+(o.attrs?" "+o.attrs:"")+' style="--bg:'+base+';'+(o.style||"")+'">'+
    '<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">'+oval+(wild&&f.v!=="wild"&&f.v!=="roul"&&f.v!=="wdc"?'<g transform="translate(50,50) rotate(-24) translate(-50,-50)" opacity=".95"><g transform="translate(50,50) scale(.6) translate(-50,-50)">'+sym("wild","#000",side)+'</g></g>'+'<g opacity=".95">'+sym(f.v,"#111",side).replace(/#16161a/g,"#111")+'</g>':inner)+'</svg>'+
    '<i class="c1">'+esc(ct)+'</i><i class="c2">'+esc(ct)+'</i></div>';
}
function backHTML(o){ o=o||{}; return '<div class="uc back'+(o.cls?" "+o.cls:"")+'"'+(o.attrs?" "+o.attrs:"")+'><svg viewBox="0 0 100 100"><ellipse cx="50" cy="50" rx="40" ry="27" transform="rotate(-24 50 50)" fill="url(#ubg)" stroke="#fff" stroke-width="2.4"/><defs><linearGradient id="ubg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e53b2c"/><stop offset="1" stop-color="#f2bf24"/></linearGradient></defs><text x="50" y="62" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="38" fill="#fff" stroke="#16161a" stroke-width="1.4" transform="rotate(-24 50 50)">★</text></svg>'+(o.label?'<b class="bl">'+esc(o.label)+'</b>':"")+'</div>'; }

var CSS=[
".uc{position:relative;display:inline-block;flex:none;width:var(--cw,64px);height:calc(var(--cw,64px)*1.5);border-radius:calc(var(--cw,64px)*.12);background:var(--bg,#333);border:calc(var(--cw,64px)*.055) solid #fff;box-shadow:0 2px 6px #0009;font-family:Georgia,serif;user-select:none;-webkit-user-select:none;cursor:pointer;transition:transform .12s,box-shadow .12s;overflow:hidden}",
".uc.dk{border-color:#0d0d11;box-shadow:0 2px 6px #000b,inset 0 0 0 calc(var(--cw,64px)*.02) #ffffff30}",
".uc svg{position:absolute;inset:0;width:100%;height:100%}",
".uc i{position:absolute;font-style:normal;font-weight:900;color:#fff;font-size:calc(var(--cw,64px)*.2);line-height:1;text-shadow:0 1px 2px #0008;font-family:'Arial Black',Arial,sans-serif}",
".uc i.c1{left:calc(var(--cw,64px)*.07);top:calc(var(--cw,64px)*.05)}.uc i.c2{right:calc(var(--cw,64px)*.07);bottom:calc(var(--cw,64px)*.05);transform:rotate(180deg)}",
".uc.back{background:#16161a;border-color:#fff}",
".uc.back .bl{position:absolute;left:0;right:0;bottom:3%;text-align:center;color:#fff;font:800 calc(var(--cw,64px)*.2) system-ui;text-shadow:0 1px 3px #000}",
".uc.dim{filter:brightness(.55) saturate(.7)}",
".uc.glow{box-shadow:0 0 0 3px #7bf2a3,0 4px 12px #000b;transform:translateY(-8px)}",
".uc.sel{transform:translateY(-12px)}",
"@keyframes ucpop{from{transform:scale(.4) rotate(-12deg);opacity:0}to{transform:none;opacity:1}}.uc.pop{animation:ucpop .35s ease-out}",
".uc.jmp{box-shadow:0 0 0 3px #ffd23f,0 0 14px #ffd23f}"
].join("\n");
function injectCSS(){ if(typeof document==="undefined"||document.getElementById("unoCardCss")) return; var s=document.createElement("style"); s.id="unoCardCss"; s.textContent=CSS; document.head.appendChild(s); }

/* ================= controller (reads a snapshot V, sends action objects) ================= */
var CTCSS=[
".unoT{width:100%;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
".upl{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:4px 0}",
".upc{display:flex;align-items:center;gap:6px;background:#00000066;border:3px solid #ffffff22;border-radius:14px;padding:5px 9px;font-size:12.5px;font-weight:800;position:relative}",
".upc .bd{min-width:22px;height:22px;border-radius:6px;background:#fff;color:#111;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px}",
".upc.cur{border-color:var(--c);box-shadow:0 0 0 2px var(--c),0 0 16px 2px var(--c);background:#000000a8}",
".upc.out{opacity:.35}.upc small{opacity:.8;font-weight:600}",
".upc button{background:#ffd23f;color:#111;border:0;border-radius:8px;font-weight:900;padding:3px 7px;font-size:11px;cursor:pointer}",
".utbl{display:flex;align-items:center;justify-content:center;gap:16px;margin:8px 0;min-height:130px}",
".utbl .pile{--cw:78px;text-align:center;font-size:11px;font-weight:800;color:#fde;position:relative}",
".utbl .pile .uc{display:block;margin:0 auto 4px}",
".ucol{width:30px;height:30px;border-radius:50%;border:3px solid #fff;margin:6px auto 0;box-shadow:0 0 10px #000a}",
".udir{font-size:24px;text-align:center;opacity:.9;line-height:1}",
".upen{background:#e53b2c;border-radius:999px;padding:4px 12px;font-weight:900;font-size:15px;display:inline-block;margin-top:4px}",
".ustat{background:#00000066;border:2px solid var(--pc,#ffffff30);border-radius:12px;padding:8px 12px;margin:6px 0;font-weight:700;font-size:14px;text-align:center;min-height:42px;box-shadow:0 0 12px -2px var(--pc,transparent)}",
".uacts{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:6px 0;min-height:44px}",
".uacts button{background:#2a2118;color:#fff;border:1px solid #ffffff55;border-radius:12px;padding:11px 15px;font-size:15px;font-weight:900;cursor:pointer}",
".uacts button.pri{background:#e53b2c;border-color:#ff8a7a}.uacts button.gold{background:#f2bf24;color:#1a1200;border-color:#ffe38a}.uacts button[disabled]{opacity:.35}",
".uhand{--cw:64px;display:flex;flex-wrap:wrap;gap:8px 0;justify-content:center;padding:14px 20px 6px 4px;min-height:110px}.uhand .uc{margin-right:-18px}",
".ulog{font-size:11.5px;color:#d9cdd6;text-align:center;line-height:1.35;min-height:34px}",
".umodal{position:fixed;inset:0;z-index:70;background:#0a0a10ee;display:none;align-items:center;justify-content:center;padding:14px}.umodal.show{display:flex}",
".umodal .sh{width:min(100%,420px);background:#23232c;border:2px solid #ffffff44;border-radius:18px;padding:16px;text-align:center;box-shadow:0 18px 44px #000b}",
".umodal h3{margin:0 0 10px;font-size:18px}.ucp{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.ucp button{width:64px;height:64px;border-radius:50%;border:4px solid #fff;font-weight:900;font-size:13px;color:#fff;text-shadow:0 1px 2px #000;cursor:pointer}",
".utg{display:flex;flex-direction:column;gap:8px}.utg button{background:#2a2118;color:#fff;border:1px solid #ffffff66;border-radius:12px;padding:12px;font-size:15px;font-weight:800}",
"@media(min-width:520px){.uhand{--cw:74px}.utbl .pile{--cw:92px}}"
].join("\n");
function injectCtCSS(){ if(typeof document==="undefined"||document.getElementById("unoCtCss")) return; var s=document.createElement("style"); s.id="unoCtCss"; s.textContent=CTCSS; document.head.appendChild(s); }

function create(cfg){
  injectCSS(); injectCtCSS();
  var root=cfg.root, V=null, S={pend:null};
  root.classList.add("unoT");
  root.innerHTML='<div class="upl" id="upl"></div><div class="utbl" id="utbl"></div><div class="ustat" id="ustat"></div><div class="uacts" id="uacts"></div><div class="uhand" id="uhand"></div><div class="ulog" id="ulog"></div>';
  var modal=document.createElement("div"); modal.className="umodal"; modal.innerHTML='<div class="sh" id="ush"></div>'; document.body.appendChild(modal);
  var $=function(id){ return root.querySelector("#"+id); };
  function act(a){ var r=cfg.send(a); if(r&&r.ok===false&&cfg.toast) cfg.toast(r.msg||"Not allowed."); return r; }
  function openModal(h){ modal.querySelector("#ush").innerHTML=h; modal.classList.add("show"); }
  function closeModal(){ modal.classList.remove("show"); }
  function pcolor(i){ return (V&&V.cols&&V.cols[i])||(cfg.seatColor&&cfg.seatColor(i))||"#ffffff"; }
  function colorPicker(title,cb,only){
    var cols=E.colorsNow({side:V.side});
    openModal('<h3>'+esc(title)+'</h3><div class="ucp">'+cols.map(function(c){ return '<button data-c="'+c+'" style="background:'+COL[c]+'">'+CN[c]+'</button>'; }).join("")+'</div><div class="uacts"><button data-x="1">Cancel</button></div>');
    modal.querySelector("#ush").onclick=function(e){ var b=e.target.closest&&e.target.closest("button"); if(!b) return; if(b.dataset.c){ closeModal(); cb(b.dataset.c); } else if(b.dataset.x) closeModal(); };
  }
  function targetPicker(title,cb){
    var rows=V.players.filter(function(p){ return p.id!==V.me&&p.alive; });
    openModal('<h3>'+esc(title)+'</h3><div class="utg">'+rows.map(function(p){ return '<button data-t="'+p.id+'" style="border-color:'+pcolor(p.id)+'">'+esc(p.name)+' — '+p.cards+' cards</button>'; }).join("")+'<button data-x="1">Cancel</button></div>');
    modal.querySelector("#ush").onclick=function(e){ var b=e.target.closest&&e.target.closest("button"); if(!b) return; if(b.dataset.t!=null){ closeModal(); cb(+b.dataset.t); } else if(b.dataset.x) closeModal(); };
  }
  function cardById(id){ return V.hand.filter(function(c){ return c.id===id; })[0]; }
  function playCard(id,out){
    var c=cardById(id); if(!c) return; var f=c.f[V.side];
    var needT=E.needsTarget({o:V.o},f)&&!(V.hand.length===1&&f.v==="7");
    var needC=E.namesColor({o:V.o},f);   // Color Roulette: the next player names the colour
    function go(color,target){ var a={t:out?"jump":"play",card:id}; if(color) a.color=color; if(target!=null) a.target=target; act(a); }
    if(needC){ colorPicker("Choose a colour",function(col){ if(needT) targetPicker(f.v==="wtd2"?"Who draws 2?":"Swap hands with…",function(t){ go(col,t); }); else go(col,null); }); }
    else if(needT){ targetPicker(f.v==="wtd2"?"Who draws 2?":(f.v==="7"?"Swap hands with…":"Swap hands with…"),function(t){ go(null,t); }); }
    else go(null,null);
  }
  function render(){
    if(!V) return;
    var me=V.me, myTurn=V.actor===me&&me>=0&&!V.over&&!V.roundOver;
    var tp=V.players[V.turn];
    // players
    $("upl").innerHTML=V.players.map(function(p,i){
      var cur=!V.over&&!V.roundOver&&i===V.actor, c=pcolor(i);
      return '<div class="upc'+(cur?" cur":"")+(p.alive?"":" out")+'" style="--c:'+c+'"><span style="width:12px;height:12px;border-radius:3px;background:'+c+'"></span>'+esc(p.name)+(p.team>=0?' <small>T'+(p.team+1)+'</small>':'')+(p.human?'':' 🤖')+' <span class="bd">'+p.cards+'</span>'+(V.o.target?'<small>'+p.score+'</small>':'')+(p.vuln&&i!==me?' <button data-a="catch:'+i+'">Catch!</button>':'')+'</div>';
    }).join("");
    // table
    var top=V.top, dark=V.side===1;
    $("utbl").innerHTML='<div class="pile" id="udraw">'+backHTML({label:V.drawCount+" left",attrs:'data-pile="draw"'})+'<div style="opacity:.8">draw</div></div>'+
      '<div class="pile"><div class="udir">'+(V.dir>0?"↻":"↺")+'</div>'+(V.pen?'<div class="upen">+'+V.pen.n+'</div>':'')+'<div class="ucol" style="background:'+(V.color?COL[V.color]:"conic-gradient(#d6322b,#f2bf24,#2f9e44,#2d63c8,#d6322b)")+'" title="'+(V.color?CN[V.color]:"any colour")+'"></div></div>'+
      '<div class="pile">'+(top?cardHTML(top,V.side,{cls:"pop"}):"")+'<div style="opacity:.8">'+(dark?"Dark side":V.o.edition==="flip"?"Light side":"discard")+'</div></div>';
    // status
    var st="", acts="", cp=pcolor(V.actor);
    if(V.over||V.roundOver) st="Round over";
    else if(V.needColor&&V.turn===me) st="<b>You start</b> — choose the starting colour.";
    else if(V.phase==="challenge"){ var c=V.chal; st=V.actor===me?("<b>"+esc(V.players[c.by].name)+" played a "+esc(E.VNAME[c.v])+"</b> — accept the penalty or challenge it?"):(esc(V.players[V.actor].name)+" is deciding whether to challenge…"); }
    else if(V.phase==="roulette") st=V.actor===me?"<b>Color Roulette</b> — pick a colour; you'll draw until one shows up.":esc(V.players[V.actor].name)+" is spinning the roulette…";
    else if(V.phase==="drawn"&&V.turn===me) st="<b>You drew a playable card</b> — play it"+(V.canPass?" or keep it.":".");
    else if(myTurn) st=V.pen?"<b>Stack a draw card</b> or take the "+V.pen.n+" cards.":(V.playable.length?"<b>Your turn</b> — tap a glowing card.":"<b>Your turn</b> — nothing to play, draw a card.");
    else st="<b>"+esc(tp.name)+"</b> is playing…";
    if(!V.over&&!V.roundOver){
      if(V.needColor&&V.turn===me) acts+='<div class="ucp">'+E.colorsNow({side:V.side}).map(function(c2){ return '<button data-a="scolor:'+c2+'" style="background:'+COL[c2]+';width:54px;height:54px;font-size:11px">'+CN[c2]+'</button>'; }).join("")+'</div>';
      else if(V.phase==="challenge"&&V.actor===me) acts+='<button class="pri" data-a="chal:1">Challenge!</button><button data-a="chal:0">Accept '+(V.chal.v==="wdc"?"(draw until the colour)":V.chal.n+" cards")+'</button>';
      else if(V.phase==="roulette"&&V.actor===me) acts+='<div class="ucp">'+E.colorsNow({side:V.side}).map(function(c2){ return '<button data-a="roul:'+c2+'" style="background:'+COL[c2]+';width:54px;height:54px;font-size:11px">'+CN[c2]+'</button>'; }).join("")+'</div>';
      else if(myTurn){
        if(V.phase==="drawn"){ if(V.canPass) acts+='<button data-a="pass">Keep it</button>'; }
        else if(V.pen) acts+='<button class="pri" data-a="draw">Take '+V.pen.n+' cards</button>';
        else acts+='<button class="pri" data-a="draw">Draw'+(V.o.drawRule==="untilPlay"?" until playable":"")+'</button>';
      }
      var mypl=me>=0?V.players[me]:null;
      if(mypl&&mypl.alive&&(mypl.cards<=2||mypl.vuln)) acts+='<button class="gold" data-a="uno">'+(mypl.vuln?"Say UNO!":"UNO!")+'</button>';
    }
    var s=$("ustat"); s.style.setProperty("--pc",V.over||V.roundOver?"#ffffff30":cp); s.innerHTML=st;
    $("uacts").innerHTML=acts;
    // hand
    if(me>=0){
      var pl=V.playable||[], jmp=V.jump||[];
      $("uhand").innerHTML=V.hand.map(function(c){ var can=pl.indexOf(c.id)>=0, j=jmp.indexOf(c.id)>=0; return cardHTML(c,V.side,{dim:(myTurn||V.phase==="drawn")&&!can&&!j,glow:can&&myTurn,cls:j?"jmp":"",attrs:'data-h="1"'}); }).join("")||'<div style="opacity:.7;padding:30px 0">no cards</div>';
    } else $("uhand").innerHTML='<div style="opacity:.7;padding:30px 0;text-align:center">'+esc(tp.name)+' is playing…</div>';
    $("ulog").innerHTML=(V.log||[]).slice(-3).map(esc).join("<br>");
  }
  root.addEventListener("click",function(e){
    if(!V) return;
    var b=e.target.closest&&e.target.closest("button[data-a]");
    if(b&&!b.disabled){ var p=b.getAttribute("data-a").split(":");
      if(p[0]==="draw") act({t:"draw"}); else if(p[0]==="pass") act({t:"pass"}); else if(p[0]==="uno") act({t:"uno"});
      else if(p[0]==="catch") act({t:"catch",target:+p[1]});
      else if(p[0]==="chal") act({t:"challenge",yes:p[1]==="1"});
      else if(p[0]==="roul") act({t:"roulette",color:p[1]});
      else if(p[0]==="scolor") act({t:"startColor",color:p[1]});
      return; }
    var pile=e.target.closest&&e.target.closest("[data-pile=draw]");
    if(pile){ if(V.actor===V.me&&V.phase==="play"&&!V.pen) act({t:"draw"}); return; }
    var card=e.target.closest&&e.target.closest("#uhand .uc");
    if(card){ var id=+card.getAttribute("data-id"); var myTurn=V.actor===V.me&&(V.phase==="play"||V.phase==="drawn");
      if(myTurn&&(V.playable||[]).indexOf(id)>=0) playCard(id,false);
      else if((V.jump||[]).indexOf(id)>=0) playCard(id,true);
      else if(myTurn) { if(cfg.toast) cfg.toast(V.pen?"Stack a draw card or take the penalty.":"That card doesn't match."); } }
  });
  var self={update:function(v){ V=v; render(); },destroy:function(){ if(modal.parentNode) modal.parentNode.removeChild(modal); },closeModal:closeModal};
  return self;
}
Uno.Cards={cardHTML:cardHTML,backHTML:backHTML,injectCSS:injectCSS,COL:COL,CSS:CSS};
Uno.Ctrl={create:create,CSS:CTCSS,COL:COL};
})(typeof window!=="undefined"?window:globalThis);
