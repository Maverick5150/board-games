/* 500 Rummy — Party Mode helpers shared by the TV host (firestick/index.html) and the phone controller (firestick/play.html).
   Needs engine.js, game.js, cards.js first. The TV shows only public information; each phone shows its owner's private hand. */
(function(g){
"use strict";
var R=g.Rummy, GM=R.Game, UI=R.UI;

/* ---------------- state shipped from the TV to a phone ---------------- */
function enc(c){ return [c.id,c.r,c.s]; }
function dec(a){ return {id:a[0],r:a[1],s:a[2],joker:a[1]===0}; }
function snap(G,me,ex){
  var st={ o:G.o,n:G.n,me:me,colors:G.colors,names:G.players.map(function(p){ return p.name; }),hc:G.players.map(function(p){ return p.hand.length; }),
    units:G.units,scores:G.scores,turn:G.turn,phase:G.phase,mustUse:G.mustUse,mustNew:G.mustNew,noDiscard:G.noDiscard,
    canUndo:!!(G.snap&&G.turn===me&&G.phase==="play"),
    hand:me>=0?G.players[me].hand.map(enc):[],discard:G.discard.map(enc),stock:G.stock.length,round:G.round,dealer:G.dealer,
    melds:G.melds.map(function(m){ return {id:m.id,owner:m.owner,kind:m.kind,rank:m.rank,suit:m.suit,lo:m.lo,hi:m.hi,
      cards:m.cards.map(function(e){ return [e.c.id,e.c.r,e.c.s,e.r,e.s,e.by,e.dbl?1:0]; })}; }),
    log:(G.logText||[]).slice(-3),ro:G.roundOver?{reason:G.roundOver.reason,out:G.roundOver.out,rows:G.roundOver.rows,over:G.roundOver.over,winner:G.roundOver.winner,winnerName:G.roundOver.winnerName}:null };
  if(ex) for(var k in ex) st[k]=ex[k];
  return st;
}
function unpack(st){
  var G={o:st.o,n:st.n,turn:st.me,phase:st.phase,mustUse:st.mustUse,mustNew:st.mustNew,noDiscard:st.noDiscard,colors:st.colors,
    players:[],discard:st.discard.map(dec),stock:{length:st.stock},units:st.units,scores:st.scores,melds:[]};
  for(var i=0;i<st.n;i++) G.players.push({id:i,name:st.names[i],hand:[]});
  if(st.me>=0) G.players[st.me].hand=st.hand.map(dec);
  G.melds=st.melds.map(function(m){ return {id:m.id,owner:m.owner,kind:m.kind,rank:m.rank,suit:m.suit,lo:m.lo,hi:m.hi,
    cards:m.cards.map(function(a){ return {c:{id:a[0],r:a[1],s:a[2],joker:a[1]===0},r:a[3],s:a[4],by:a[5],dbl:a[6]}; })}; });
  return G;
}

/* ---------------- announcements ---------------- */
function lab(cs){ return cs.map(R.cardLabel).join(" "); }
function describe(G,a){
  var p=GM.cur(G), nm=p.name;
  var hand=function(id){ return p.hand.filter(function(c){ return c.id===id; })[0]; };
  if(a.t==="stock") return nm+" draws from the stock";
  if(a.t==="take") return nm+" takes "+lab(G.discard.slice(a.idx))+" from the discard pile";
  if(a.t==="meld"){ var cs=a.ids.map(hand).filter(Boolean), m=R.buildMeld(cs,G.o); return nm+" melds "+lab(m?m.cards.map(function(e){ return e.c; }):cs); }
  if(a.t==="layoff"){ var mm=G.melds.filter(function(x){ return x.id===a.meld; })[0], c=hand(a.card); return nm+" lays off "+(c?R.cardLabel(c):"a card")+" on "+(mm&&mm.owner!==p.id?G.players[mm.owner].name+"'s ":"a ")+(mm&&mm.kind==="set"?"set":"run"); }
  if(a.t==="discard"){ var d=hand(a.card); return nm+" discards "+(d?R.cardLabel(d):"a card"); }
  return "";
}

/* ---------------- TV: the public table ---------------- */
var TVCSS=[
".rvtv{width:96vw;display:flex;flex-direction:column;align-items:center}",
".rvscore{display:flex;flex-wrap:wrap;gap:1vh;justify-content:center;margin:.4vh 0 1vh}",
".rvchip{display:flex;align-items:center;gap:1vh;background:#00000060;border:.4vh solid #ffffff25;border-radius:99vh;padding:.7vh 1.8vh;font-size:2.5vh;font-weight:800}",
".rvchip .rd{width:2.4vh;height:2.4vh;border-radius:50%}.rvchip b{color:#ffd84a}.rvchip small{opacity:.8;font-size:2vh}",
".rvchip.act{border-color:var(--c);box-shadow:0 0 0 .4vh var(--c),0 0 3vh .5vh var(--c);background:#000000a0}",
"#rtable{width:96vw;height:60vh;background:radial-gradient(120% 100% at 50% 20%,#1b7a4f,#0c4a2f);padding:1.4vh;position:relative;overflow:hidden;display:flex;flex-direction:column}",
".rvmelds{flex:1;display:flex;flex-wrap:wrap;align-content:flex-start;justify-content:center;overflow:hidden;padding:.4vh}",
".rvmelds .empty{color:#bfe3cc;font-size:2.6vh;opacity:.8;align-self:center}",
".rvmelds .meld{--cw:var(--mcw);padding:.7vh 1.2vh .7vh 1vh;margin:.4vh;border-radius:1.4vh}",
".rvmelds .meld .pc{margin-left:calc(var(--mcw)*-.4)}.rvmelds .meld .pc:first-child{margin-left:0}",
".rvpiles{display:flex;gap:3vh;align-items:center;border-top:.3vh dashed #ffffff40;padding:1vh 1vh 0;height:18vh}",
".rvstock{text-align:center;font-size:2.2vh;font-weight:800;color:#d6efdf;flex:none}.rvstock .pc{display:block;margin:0 auto .5vh}",
".rvdisc{flex:1;display:flex;align-items:center;overflow:hidden;padding:1vh 1vh}",
".rvdisc .none{font-size:2.4vh;opacity:.8}",
".rvdisc .pc.pf{transform:translateY(-1.6vh);box-shadow:0 0 0 .5vh #7bf2a3}",
".rvlog{font-size:2.3vh;color:#cfe9da;text-align:center;line-height:1.35;min-height:9vh;margin-top:.6vh}",
".rvsheet{background:#0c3322f2;border:.4vh solid #3d7a58;border-radius:2.4vh;padding:2vh 3vh;font-size:2.6vh;max-width:90vw}",
".rvsheet table{width:100%;border-collapse:collapse;margin:1vh 0}.rvsheet th,.rvsheet td{padding:.8vh 1.2vh;text-align:right;border-bottom:.2vh solid #ffffff22}.rvsheet th:first-child,.rvsheet td:first-child{text-align:left}",
".rvsheet td.pos{color:#8ff0b0}.rvsheet td.neg{color:#ff9a9a}"
].join("\n");
function tvHTML(G,ctx){
  ctx=ctx||{};
  var chips=G.units.map(function(u,ui){
    var act=!G.roundOver&&GM.unitOf(G,G.turn)===ui, col=UI.colorOf(G,u[0]);
    var nm=u.map(function(i){ var q=G.players[i]; return esc(q.name)+' <small>✋'+q.hand.length+'</small>'; }).join(" &amp; ");
    return '<div class="rvchip'+(act?" act":"")+'" style="--c:'+col+'"><span class="rd" style="background:'+col+'"></span>'+nm+' · <b>'+G.scores[ui]+'</b></div>';
  }).join("");
  var nm=G.melds.length, cw=nm>22?3.8:nm>14?4.8:nm>8?6:nm>4?7.2:8.6;
  var melds=nm?G.melds.map(function(m){ return UI.meldHTML(m,G,{cls:(ctx.flashMeld===m.id?"flash":"")}); }).join(""):'<div class="empty">No melds yet — sets of 3–4 of a kind, runs of 3+ in one suit</div>';
  var nd=G.discard.length, dcw=8, step=Math.min(4.6,100/Math.max(nd,1)), ml=-(dcw-step);
  var disc=nd?G.discard.map(function(c,i){ return UI.cardHTML(c,{cls:(ctx.pf!=null&&i>=ctx.pf?"pf ":"")+(ctx.flashCard===c.id?"flash":""),style:"margin-left:"+(i?ml:0)+"vh"}); }).join(""):'<span class="none">Discard pile is empty</span>';
  return '<div class="rvscore">'+chips+'</div>'+
    '<div id="rtable"><div class="rvmelds" style="--mcw:'+cw+'vh">'+melds+'</div>'+
    '<div class="rvpiles"><div class="rvstock" style="--cw:7vh">'+UI.backHTML({label:G.stock.length?"":"EMPTY"})+G.stock.length+' in stock</div><div class="rvdisc" style="--cw:'+dcw+'vh">'+disc+'</div></div></div>';
}
function roundSheetHTML(G){
  var ro=G.roundOver; if(!ro) return "";
  var why=ro.reason==="out"?esc(G.players[ro.out].name)+" went out":"The stock ran out";
  var rows=ro.rows.map(function(r){ return '<tr><td><span class="rd" style="display:inline-block;width:2.2vh;height:2.2vh;border-radius:50%;background:'+UI.colorOf(G,r.players[0])+'"></span> '+esc(r.name)+'</td><td>'+r.melded+'</td><td>'+(r.dead?-r.dead:0)+'</td><td>'+((r.bonus+r.oppHands)||0)+'</td><td class="'+(r.total>=0?"pos":"neg")+'">'+(r.total>0?"+":"")+r.total+'</td><td><b>'+r.score+'</b></td></tr>'; }).join("");
  return '<div class="rvsheet"><div style="font-size:3.6vh;font-weight:900">'+(ro.over?"🏆 Game over":"Round "+G.round+" complete")+'</div><div style="opacity:.8">'+why+'</div>'+
    '<table><tr><th>Player</th><th>Melds</th><th>Hand</th><th>Bonus</th><th>Round</th><th>Total</th></tr>'+rows+'</table>'+
    (ro.over?'<div style="font-size:3.2vh;text-align:center"><b style="color:#ffd84a">'+esc(ro.winnerName)+'</b> win'+(/ & /.test(ro.winnerName)||ro.winnerName==="You"?"":"s")+' with '+G.scores[ro.winner]+' points!</div>':'<div style="opacity:.75;font-size:2.2vh">First to '+G.o.target+' wins.</div>')+'</div>';
}

/* ---------------- phone: private hand + controls ---------------- */
var PCSS=[
".rvp{width:100%;max-width:560px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}",
".rvp .head{font-size:15px;font-weight:800;border:2px solid var(--c,#fff3);border-radius:14px;padding:8px 12px;width:100%;background:#00000050;box-shadow:0 0 12px var(--c,transparent)}",
".rvp .head small{display:block;font-weight:600;font-size:12px;color:#c9e6d5;margin-top:2px}",
".rvp .tbl{width:100%;border:3px solid #ffffff22;border-radius:16px;background:radial-gradient(120% 100% at 50% 20%,#1b7a4f,#0c4a2f);padding:4px}",
".rvp .rm{max-height:30vh;overflow-y:auto;display:flex;flex-wrap:wrap;justify-content:center;min-height:50px}.rvp .rm .meld{--cw:34px;padding:4px 7px 4px 6px;margin:2px}.rvp .rm .meld .pc{margin-left:-14px}.rvp .rm .meld .pc:first-child{margin-left:0}",
".rvp .rm .empty{color:#bfe3cc;font-size:12px;padding:12px}",
".rvp .pl{display:flex;gap:8px;align-items:center;border-top:1px dashed #ffffff30;padding:6px 4px 2px}",
".rvp .stk{--cw:50px;font-size:11px;font-weight:700;color:#d6efdf;flex:none}.rvp .stk .pc{display:block;margin:0 auto 2px}",
".rvp .dp{--cw:44px;display:flex;align-items:flex-end;overflow-x:auto;padding:14px 6px 4px 2px;flex:1}.rvp .dp .pc{margin-left:-24px}.rvp .dp .pc:first-child{margin-left:0}",
".rvp .acts{display:flex;flex-wrap:wrap;gap:7px;justify-content:center;min-height:44px}",
".rvp .acts button{background:#0b2d1e;color:#f3f7ee;border:1px solid #3d7a58;border-radius:12px;padding:11px 14px;font-size:15px;font-weight:800}",
".rvp .acts button.pri{background:#d9a21b;border-color:#d9a21b;color:#2a1c00}.rvp .acts button:disabled{opacity:.35}",
".rvp .hd{--cw:56px;display:flex;flex-wrap:wrap;justify-content:center;padding:18px 20px 6px 4px;gap:8px 0}.rvp .hd .pc{margin-right:-15px}",
".rvp .lg{font-size:11.5px;color:#b5d8c3;min-height:30px}",
".rvp .sc{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;font-size:12px}.rvp .sc span{background:#00000055;border-radius:99px;padding:3px 9px;border:2px solid transparent}.rvp .sc span.me{border-color:#ffd84a}",
".rvp .sheet table{width:100%;border-collapse:collapse;font-size:13px}.rvp .sheet th,.rvp .sheet td{padding:5px 3px;text-align:right;border-bottom:1px solid #ffffff22}.rvp .sheet th:first-child,.rvp .sheet td:first-child{text-align:left}"
].join("\n");
var ui={sel:{},pf:null,sort:"suit",busy:false,peek:false};
function esc(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }
function selIds(){ return Object.keys(ui.sel).map(Number); }
function phoneRender(root,st,ctx){
  UI.injectCSS(); if(!document.getElementById("rvPCss")){ var s=document.createElement("style"); s.id="rvPCss"; s.textContent=PCSS; document.head.appendChild(s); }
  ui.busy=false; g.Rummy.Party.last=st;
  var G=unpack(st), me=st.me, mine=G.players[me], hand=mine.hand;
  var ids={}; hand.forEach(function(c){ ids[c.id]=1; }); Object.keys(ui.sel).forEach(function(k){ if(!ids[k]) delete ui.sel[k]; });
  var act=!!ctx.active&&!st.ro, draw=act&&st.phase==="draw", play=act&&st.phase==="play";
  if(!draw) ui.pf=null; if(ui.pf!=null&&ui.pf>=G.discard.length) ui.pf=null;
  var col=UI.colorOf(G,me), tcol=UI.colorOf(G,st.turn);
  var sel=hand.filter(function(c){ return ui.sel[c.id]; });
  var one=sel.length===1?sel[0]:null;
  // header
  var headTxt, sub="";
  if(st.ro) headTxt=st.ro.over?"🏆 Game over":"Round complete";
  else if(!act) { headTxt=esc(st.names[st.turn])+"’s turn"; sub="Waiting — your hand is below"; }
  else if(draw){ headTxt="Your turn — draw"; sub=st.stock?"Tap the stock, or tap a discard to take it":"Stock is empty — take from the pile or tap the stock to end the round";
    if(ui.pf!=null){ var f=GM.takeFeasible(G,ui.pf); sub=f?("Take "+(G.discard.length-ui.pf)+" card"+((G.discard.length-ui.pf)>1?"s":"")+" from the pile?"):"You can't use that card right away — pick another"; } }
  else { headTxt="Your turn"; sub=st.mustUse!=null?("Use the card you took from the pile ("+(st.mustNew?"in a new meld":"meld or lay off")+") then discard"):"Meld, lay off, then discard one card"; }
  var h='<div class="rvp"><div class="head" style="--c:'+tcol+'">'+headTxt+'<small>'+sub+'</small></div>';
  h+='<div class="sc">'+G.units.map(function(u,ui2){ var isMe=u.indexOf(me)>=0; return '<span class="'+(isMe?"me":"")+'" style="border-color:'+(isMe?"#ffd84a":UI.colorOf(G,u[0]))+'">'+u.map(function(i){ return esc(st.names[i]); }).join(" &amp; ")+' · <b>'+st.scores[ui2]+'</b></span>'; }).join("")+'</div>';
  // table
  h+='<div class="tbl"><div class="rm" id="rvm">'+(G.melds.length?G.melds.map(function(m){
      var fit=play&&one&&GM.mayLayOn(G,m,me)&&R.layOff(m,one,G.o)&&!(st.mustNew&&st.mustUse===one.id);
      return UI.meldHTML(m,G,{cls:fit?"fit":""}); }).join(""):'<div class="empty">No melds yet</div>')+'</div>';
  h+='<div class="pl"><div class="stk" id="rvs">'+UI.backHTML({label:st.stock?"":"EMPTY"})+st.stock+' left</div><div class="dp" id="rvd">'+
    (G.discard.length?G.discard.map(function(c,i){ return UI.cardHTML(c,{cls:(ui.pf!=null&&i>=ui.pf?"pf":""),attrs:'data-i="'+i+'"'}); }).join(""):'<span style="font-size:12px;opacity:.8">Discard pile is empty</span>')+'</div></div></div>';
  // actions
  var btns="";
  if(st.ro){ btns='<span style="font-size:13px;color:#cfe9da">Waiting for the host to continue…</span>'; }
  else if(draw){
    if(ui.pf!=null){ var tf=GM.takeFeasible(G,ui.pf); btns+='<button class="pri" data-a="take"'+(tf?"":" disabled")+'>Take '+(G.discard.length-ui.pf)+' from pile</button><button data-a="cancel">Cancel</button>'; }
    else btns+='<button class="pri" data-a="stock">Draw from stock</button>';
    btns+='<button data-a="sort">Sort: '+ui.sort+'</button>';
  } else if(play){
    var m=sel.length>=3?R.buildMeld(sel,G.o):null;
    var ts=one?G.melds.filter(function(x){ return GM.mayLayOn(G,x,me)&&R.layOff(x,one,G.o)&&!(st.mustNew&&st.mustUse===one.id); }):[];
    btns+='<button class="'+(m?"pri":"")+'" data-a="meld"'+(m?"":" disabled")+'>Meld'+(m?" (+"+R.meldPoints(m,G.o)+")":"")+'</button>'+
      '<button data-a="lay"'+(ts.length?"":" disabled")+'>Lay off</button>'+
      '<button data-a="discard"'+(sel.length===1?"":" disabled")+'>Discard</button>'+
      '<button data-a="undo"'+(st.canUndo?"":" disabled")+'>↶ Undo</button><button data-a="hint">💡 Hint</button><button data-a="sort">Sort: '+ui.sort+'</button>';
  } else btns='<button data-a="sort">Sort: '+ui.sort+'</button>';
  h+='<div class="acts" id="rva">'+btns+'</div>';
  h+='<div class="hd" id="rvh">'+(st.ro?"":UI.sortHand(hand,ui.sort).map(function(c){ return UI.cardHTML(c,{cls:ui.sel[c.id]?"sel":""}); }).join(""))+'</div>';
  h+='<div class="lg">'+(st.log||[]).map(esc).join("<br>")+'</div>';
  if(st.ro){
    var rows=st.ro.rows.map(function(r){ return '<tr><td>'+esc(r.name)+'</td><td>'+r.melded+'</td><td>'+(r.dead?-r.dead:0)+'</td><td>'+((r.bonus+r.oppHands)||0)+'</td><td>'+(r.total>0?"+":"")+r.total+'</td><td><b>'+r.score+'</b></td></tr>'; }).join("");
    h+='<div class="sheet" style="width:100%;background:#0c3322;border-radius:14px;padding:10px"><table><tr><th>Player</th><th>Melds</th><th>Hand</th><th>Bonus</th><th>Round</th><th>Total</th></tr>'+rows+'</table></div>';
  }
  h+='</div>';
  root.innerHTML=h;
  var send=function(id,data){ if(ui.busy) return; ui.busy=true; ctx.act(id,data); };
  root.onclick=function(e){
    var n=e.target.closest?e.target.closest(".pc,button,.meld,#rvs"):null; if(!n) return;
    if(n.tagName==="BUTTON"){
      var a=n.getAttribute("data-a");
      if(a==="sort"){ ui.sort=ui.sort==="suit"?"rank":"suit"; phoneRender(root,st,ctx); }
      else if(a==="cancel"){ ui.pf=null; ctx.view&&ctx.view(null); phoneRender(root,st,ctx); }
      else if(a==="stock") send("stock");
      else if(a==="take") send("take",{idx:ui.pf});
      else if(a==="meld") send("meld",{ids:selIds()});
      else if(a==="lay"){ var cand=G.melds.filter(function(x){ return GM.mayLayOn(G,x,me)&&R.layOff(x,one,G.o)&&!(st.mustNew&&st.mustUse===one.id); }); if(cand.length===1) send("layoff",{meld:cand[0].id,card:one.id}); else ctx.toast&&ctx.toast("Tap the glowing meld you want"); }
      else if(a==="discard") send("discard",{card:sel[0].id});
      else if(a==="undo") send("undo");
      else if(a==="hint"){ var plan=R.bestMelds(hand,G.o); if(plan.list.length){ ui.sel={}; plan.list[0].ids.forEach(function(i){ ui.sel[i]=1; }); ctx.toast&&ctx.toast("Best meld selected"); } else ctx.toast&&ctx.toast(st.mustUse!=null?"Look for a lay-off for the card you took":"No melds yet — discard your least useful card"); phoneRender(root,st,ctx); }
      return;
    }
    if(n.id==="rvs"){ if(draw) send("stock"); return; }
    if(n.classList.contains("meld")){ if(play&&one) send("layoff",{meld:+n.getAttribute("data-m"),card:one.id}); return; }
    var inDisc=n.parentNode&&n.parentNode.id==="rvd";
    if(inDisc){ if(draw){ var i=+n.getAttribute("data-i"); ui.pf=(ui.pf===i)?null:i; ctx.view&&ctx.view(ui.pf); phoneRender(root,st,ctx); } return; }
    if(n.parentNode&&n.parentNode.id==="rvh"){ var id=+n.getAttribute("data-id"); if(ui.sel[id]) delete ui.sel[id]; else ui.sel[id]=1; phoneRender(root,st,ctx); }
  };
  if(!root.__peek){ root.__peek=true; UI.enablePeek(root); }
}
function resetUI(){ ui.sel={}; ui.pf=null; ui.busy=false; }
function unbusy(){ ui.busy=false; }

g.Rummy.Party={snap:snap,unpack:unpack,describe:describe,tvHTML:tvHTML,tvCSS:TVCSS,roundSheetHTML:roundSheetHTML,phoneRender:phoneRender,resetUI:resetUI,unbusy:unbusy,ui:ui,esc:esc};
if(typeof module!=="undefined"&&module.exports) module.exports=g.Rummy.Party;
})(typeof window!=="undefined"?window:globalThis);
