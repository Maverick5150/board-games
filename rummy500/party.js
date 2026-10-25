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
      cards:m.cards.map(function(e){ return [e.c.id,e.c.r,e.c.s,e.r,e.s,e.by,e.dbl?1:0,e.lay==null?e.by:e.lay]; })}; }),
    hist:(G.history||[]).map(function(h){ return h.rows.map(function(r){ return [r.t,r.s]; }); }),target:G.o.target,
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
    cards:m.cards.map(function(a){ return {c:{id:a[0],r:a[1],s:a[2],joker:a[1]===0},r:a[3],s:a[4],by:a[5],dbl:a[6],lay:a[7]}; })}; });
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
"#rtable{width:96vw;height:60vh;background:radial-gradient(120% 100% at 50% 20%,#1b7a4f,#0c4a2f);padding:1.4vh;position:relative;overflow:hidden;display:grid;box-sizing:border-box;gap:.4vh}",
".rvside{display:flex;min-width:0;min-height:0;gap:.8vh}.rvside.t,.rvside.b{flex-direction:row}.rvside.l,.rvside.r{flex-direction:column}",
".rvz{flex:1 1 0;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;border-radius:1.2vh;background:#0000002a;box-shadow:inset 0 0 0 .3vh #ffffff1c;padding:.2vh .6vh}",
".rvz.act{box-shadow:inset 0 0 0 .4vh var(--c)}",
".rvzn{flex:none;display:flex;align-items:center;gap:.8vh;height:3vh;font-size:2.3vh;font-weight:800;line-height:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}.rvzn .rd{width:1.9vh;height:1.9vh;border-radius:50%;flex:none}",
".rvmelds{flex:1;min-height:0;display:flex;flex-wrap:wrap;align-content:flex-start;align-items:flex-start;overflow:hidden}",
".rvmelds .empty{color:#bfe3cc;font-size:2.2vh;opacity:.7;padding:.4vh}",
".rvmelds .meld{--cw:var(--mcw);padding:.5vh .9vh .5vh .8vh;margin:.3vh;border-radius:1.2vh}",
".rvmelds .meld .pc{margin-left:calc(var(--mcw)*-.4)}.rvmelds .meld .pc:first-child{margin-left:0}",
".rvmelds .lopill{font-size:2vh}.rvmelds .lotags{margin-top:.3vh;gap:.4vh}",
".rvmid{display:flex;gap:3vh;align-items:center;justify-content:center;min-width:0;min-height:0;overflow:hidden}",
".rvstock{text-align:center;font-size:2.2vh;font-weight:800;color:#d6efdf;flex:none}.rvstock .pc{display:block;margin:0 auto .5vh}",
".rvdisc{flex:1;display:flex;align-items:center;overflow:hidden;padding:1.6vh 1vh .6vh;min-width:0}",
".rvdisc .none{font-size:2.4vh;opacity:.8}",
".rvdisc .pc.pf{transform:translateY(-1.6vh);box-shadow:0 0 0 .5vh #7bf2a3}",
".rvlog{font-size:2.3vh;color:#cfe9da;text-align:center;line-height:1.35;min-height:9vh;margin-top:.6vh}",
".rvsheet{background:#0c3322f2;border:.4vh solid #3d7a58;border-radius:2.4vh;padding:2vh 3vh;font-size:2.6vh;max-width:90vw}",
".rvsheet table{width:100%;border-collapse:collapse;margin:1vh 0}.rvsheet th,.rvsheet td{padding:.8vh 1.2vh;text-align:right;border-bottom:.2vh solid #ffffff22}.rvsheet th:first-child,.rvsheet td:first-child{text-align:left}",
".rvsheet td.pos{color:#8ff0b0}.rvsheet td.neg{color:#ff9a9a}",
".rvsheet .bg-ico{width:1em;height:1em;vertical-align:-.12em;color:#ffd84a}"
].join("\n");
/* ---- seat-based table: every player's melds (and the cards laid off onto them) sit on THAT player's side of the table ----
   sides clockwise from the bottom: [bottom, left, top, right] seat counts per player count (2 face each other, 4 = one per side, 5-8 share sides) */
var SIDE_COUNTS={2:[1,0,1,0],3:[1,1,0,1],4:[1,1,1,1],5:[1,1,2,1],6:[2,1,2,1],7:[2,1,3,1],8:[2,2,2,2]};
var SIDE_NAMES=["b","l","t","r"];
function seatSides(n){
  var cnt=SIDE_COUNTS[n]||SIDE_COUNTS[4], out=[], pos=[];
  for(var sd=0;sd<4;sd++) for(var k=0;k<cnt[sd];k++){ out.push(SIDE_NAMES[sd]); pos.push(k); }
  return {side:out.slice(0,n),pos:pos.slice(0,n),cnt:cnt};
}
/* the biggest card width (in vh) at which a player's melds fit their zone (w x h in vh); greedy row packing, the same as the wrapping flex row */
function fitCw(melds,w,h){
  for(var cw=7.6;cw>=3.2;cw-=.2){
    var rows=1,x=0,rowH=cw*1.42+2.6, avail=h-3.4;
    for(var i=0;i<melds.length;i++){
      var mw=cw*(1+.6*(melds[i].cards.length-1))+2.4+(melds[i].lo?Math.max(0,5-cw*.6*melds[i].cards.length):0);
      if(x>0&&x+mw>w){ rows++; x=0; } x+=mw;
    }
    if(rows*(rowH+(melds.some(function(m){ return m.lo; })?2.8:0))<=avail) return Math.round(cw*10)/10;
  }
  return 3.2;
}
function hasLo(m){ return m.cards.some(function(e){ return e.lay!=null&&e.lay!==m.owner; }); }
function tvHTML(G,ctx){
  ctx=ctx||{};
  var chips=rankIdx(G.scores,G.units.length).map(function(ui){
    var u=G.units[ui], act=!G.roundOver&&GM.unitOf(G,G.turn)===ui, col=UI.colorOf(G,u[0]);
    var nm=u.map(function(i){ var q=G.players[i]; return esc(q.name)+' <small>'+q.hand.length+(q.hand.length===1?' card':' cards')+'</small>'; }).join(" &amp; ");
    return '<div class="rvchip'+(act?" act":"")+'" style="--c:'+col+'"><span class="rd" style="background:'+col+'"></span>'+nm+' · <b>'+G.scores[ui]+'</b></div>';
  }).join("");
  var n=G.players.length, ss=seatSides(n), cnt=ss.cnt, SIDE_H=16, wide=170;
  var midH=57-(cnt[2]?SIDE_H:0)-(cnt[0]?SIDE_H:0), sideW=cnt[1]||cnt[3]?44:0, tall=cnt[1]>1||cnt[3]>1;   // tall: with two players on a side edge, the side columns take the corners too
  var zones={b:[],l:[],t:[],r:[]};
  G.players.forEach(function(q,i){
    var ms=G.melds.filter(function(m){ return m.owner===i; }).map(function(m){ return {m:m,cards:m.cards,lo:hasLo(m)}; });
    var side=ss.side[i], horiz=side==="b"||side==="t", k=cnt[SIDE_NAMES.indexOf(side)]||1;
    var w=horiz?((tall?wide-2*sideW-4:wide-2)/k)-2:sideW-3, h=horiz?SIDE_H-.6:(tall?57:midH)/k-.6, cw=fitCw(ms,w,h), col=UI.colorOf(G,i);
    var act=!G.roundOver&&G.turn===i;
    zones[side].push('<div class="rvz'+(act?" act":"")+'" data-seat="'+i+'" data-side="'+side+'" style="--c:'+col+';--mcw:'+cw+'vh"><div class="rvzn"><span class="rd" style="background:'+col+'"></span>'+esc(q.name)+'</div>'+
      '<div class="rvmelds">'+(ms.length?ms.map(function(x){ return UI.meldHTML(x.m,G,{cls:(ctx.flashMeld===x.m.id?"flash":"")}); }).join(""):'<span class="empty">no melds</span>')+'</div></div>');
  });
  var nd=G.discard.length, dcw=7, midW=wide-2*sideW-14, step=Math.min(4.4,Math.max(1.2,(midW-34)/Math.max(nd,1))), ml=-(dcw-step);
  var disc=nd?G.discard.map(function(c,i){ return UI.cardHTML(c,{cls:(ctx.pf!=null&&i>=ctx.pf?"pf ":"")+(ctx.flashCard===c.id?"flash":""),style:"margin-left:"+(i?ml:0)+"vh"}); }).join(""):'<span class="none">Discard pile is empty</span>';
  var cols=(cnt[1]||cnt[3]?"44vh":"0")+" minmax(0,1fr) "+(cnt[1]||cnt[3]?"44vh":"0");
  var rows=(cnt[2]?SIDE_H+"vh":"0")+" minmax(0,1fr) "+(cnt[0]?SIDE_H+"vh":"0");
  return '<div class="rvscore">'+chips+'<div class="rvchip" style="background:#00000040">Round '+G.round+(G.o.deals>0?' · <b>'+G.o.deals+'</b> deals':' · first to <b>'+G.o.target+'</b>')+(G.o.handSize>0?' · <b>'+GM.dealSize(G)+'</b> cards each':'')+'</div></div>'+
    '<div id="rtable" class="rvgrid n'+n+'" style="grid-template-columns:'+cols+';grid-template-rows:'+rows+'">'+
    '<div class="rvside t" style="grid-area:'+(tall?'1/2/2/3':'1/1/2/4')+'">'+zones.t.join("")+'</div>'+
    '<div class="rvside l" style="grid-area:'+(tall?'1/1/4/2':'2/1/3/2')+'">'+zones.l.join("")+'</div>'+
    '<div class="rvmid" style="grid-area:2/2/3/3"><div class="rvstock" style="--cw:6.4vh">'+UI.backHTML({label:G.stock.length?"":"EMPTY"})+G.stock.length+' in stock</div><div class="rvdisc" style="--cw:'+dcw+'vh">'+disc+'</div></div>'+
    '<div class="rvside r" style="grid-area:'+(tall?'1/3/4/4':'2/3/3/4')+'">'+zones.r.join("")+'</div>'+
    '<div class="rvside b" style="grid-area:'+(tall?'3/2/4/3':'3/1/4/4')+'">'+zones.b.join("")+'</div></div>';
}
function roundSheetHTML(G){
  var ro=G.roundOver; if(!ro) return "";
  var why=ro.reason==="out"?esc(G.players[ro.out].name)+" went out":"The stock ran out";
  var rows=rankRows(ro.rows).map(function(r){ return '<tr><td><span class="rd" style="display:inline-block;width:2.2vh;height:2.2vh;border-radius:50%;background:'+UI.colorOf(G,r.players[0])+'"></span> '+esc(r.name)+'</td><td>'+r.melded+'</td><td>'+(r.dead?-r.dead:0)+'</td><td>'+((r.bonus+r.oppHands)||0)+'</td><td class="'+(r.total>=0?"pos":"neg")+'">'+(r.total>0?"+":"")+r.total+'</td><td><b>'+r.score+'</b></td></tr>'; }).join("");
  return '<div class="rvsheet"><div style="font-size:3.6vh;font-weight:900">'+(ro.over?ic("trophy")+" Game over":"Round "+G.round+" complete")+'</div><div style="opacity:.8">'+why+'</div>'+
    '<table><tr><th>Player</th><th>Melds</th><th>Hand</th><th>Bonus</th><th>Round</th><th>Total</th></tr>'+rows+'</table>'+
    (ro.over?'<div style="font-size:3.2vh;text-align:center"><b style="color:#ffd84a">'+esc(ro.winnerName)+'</b> win'+(/ & /.test(ro.winnerName)||ro.winnerName==="You"?"":"s")+' with '+G.scores[ro.winner]+' points!</div>':'<div style="opacity:.75;font-size:2.2vh">'+esc(GM.goalText(G))+'</div>')+'</div>';
}

/* ---------------- phone: private hand + controls ---------------- */
var PCSS=[
/* the phone controller in Midnight Luxe: the felt table, tokens, buttons and sheets of ui/theme.css (text >= 12 px, targets >= 44 px, line icons) */
".rvp{width:100%;max-width:560px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:.5rem;text-align:center;font-family:var(--font-ui,system-ui,sans-serif)}",
".rvp .head{width:100%;padding:.625rem .875rem;border-radius:var(--r-lg,14px);background:var(--panel-fill,rgba(0,0,0,.35));box-shadow:var(--panel-edge,inset 0 0 0 1px rgba(255,255,255,.2)),inset 0 0 0 2px var(--c,transparent);color:var(--text-1,#f3f7ee);font:var(--fw-ui-strong,800) var(--fs-md,16px)/1.25 var(--font-ui,system-ui)}",
".rvp .head small{display:block;margin-top:.15rem;font:var(--fw-ui,600) var(--fs-sm,13px)/1.35 var(--font-ui,system-ui);color:var(--text-2,#c9e6d5)}",
".rvp .head .bg-ico{width:1.2em;height:1.2em;vertical-align:-.2em;margin-right:.3rem;color:var(--gold-200,#ffd84a)}",
".rvp .tbl{width:100%;border-radius:var(--r-lg,16px);padding:.375rem}",
".rvp .rm{max-height:30vh;overflow-y:auto;display:flex;flex-wrap:wrap;justify-content:center;min-height:50px}.rvp .rm .meld{--cw:34px;padding:4px 7px 4px 6px;margin:2px}.rvp .rm .meld .pc{margin-left:-14px}.rvp .rm .meld .pc:first-child{margin-left:0}",
".rvp .rm .empty{color:var(--text-2,#bfe3cc);font-size:var(--fs-micro,12px);padding:12px}",
".rvp .pl{display:flex;gap:8px;align-items:center;border-top:1px dashed var(--line-2,rgba(255,255,255,.2));padding:6px 4px 2px}",
".rvp .stk{--cw:50px;font:var(--fw-ui-strong,700) var(--fs-micro,12px)/1.3 var(--font-ui,system-ui);color:var(--text-1,#d6efdf);flex:none}.rvp .stk .pc{display:block;margin:0 auto 2px}",
".rvp .dp{--cw:44px;display:flex;align-items:flex-end;overflow-x:auto;padding:14px 6px 4px 2px;flex:1}.rvp .dp .pc{margin-left:-24px}.rvp .dp .pc:first-child{margin-left:0}",
".rvp .dp .none{font-size:var(--fs-micro,12px);color:var(--text-2,#c9e6d5)}",
".rvp .acts{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;min-height:var(--tap,44px);padding:var(--focus-room,.25rem)}",
".rvp .acts .bg-btn,.rvp .rvsb{min-height:var(--tap,44px)}.rvp .acts .bg-btn{padding-inline:.9rem}",
".rvp .acts .bg-btn .bg-ico{width:1.1em;height:1.1em}",
".rvp .acts .wait{font:var(--fw-ui,600) var(--fs-sm,13px)/1.3 var(--font-ui,system-ui);color:var(--text-2,#cfe9da)}",
".rvp .hd{--cw:56px;display:flex;flex-wrap:wrap;justify-content:center;padding:18px 20px 6px 4px;gap:8px 0}.rvp .hd .pc{margin-right:-15px}",
".rvp .lg{font:var(--fw-body,500) var(--fs-micro,12px)/1.45 var(--font-ui,system-ui);color:var(--text-2,#b5d8c3);min-height:2.5rem}",
".rvp .sc{display:flex;flex-wrap:wrap;gap:.35rem;justify-content:center;font:var(--fw-ui,600) var(--fs-micro,12px)/1.2 var(--font-ui,system-ui)}.rvp .sc span.pl2{display:inline-flex;align-items:center;gap:.4rem;min-height:1.75rem;background:var(--ink-2,rgba(0,0,0,.35));border-radius:var(--r-pill,99px);padding:.2rem .7rem;box-shadow:inset 0 0 0 2px var(--cc,transparent);color:var(--text-1,#fff)}.rvp .sc span.pl2.me{box-shadow:inset 0 0 0 2px var(--gold-200,#ffd84a)}.rvp .sc span.pl2 b{color:var(--gold-100,#ffd84a)}",
".rvp .sheet .bg-score td,.rvp .sheet .bg-score th{font-size:var(--fs-sm,13px)}",
".rvp .sheet .bg-score td.pos{color:var(--ok-text,#8ff0b0)}.rvp .sheet .bg-score td.neg{color:var(--danger-text,#ff9a9a)}",
".rvsb-ov{position:fixed;inset:0;z-index:99;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:1rem;background:rgba(8,10,21,.94)}",
".rvsb-ov .rvsb-card{width:min(100%,520px);padding:1rem;color:var(--text-1,#f3f7ee);text-align:left}",
".rvsb-ov h2{margin:0 0 .25rem;font:400 var(--fs-xl,24px)/1.15 var(--font-display,Georgia,serif)}",
".rvsb-ov .rvsb-sub{margin:0 0 .5rem;font:var(--fw-ui,600) var(--fs-sm,13px)/1.4 var(--font-ui,system-ui);color:var(--text-2,#c9e6d5)}.rvsb-ov .rvsb-sub b{color:var(--gold-100,#ffd84a)}",
".rvsb-ov .bg-score td.pos{color:var(--ok-text,#8ff0b0)}.rvsb-ov .bg-score td.neg{color:var(--danger-text,#ff9a9a)}",
".rvsb-ov .bg-btn{margin-top:.75rem}"
].join("\n");
var ui={sel:{},pf:null,sort:"suit",busy:false,peek:false,order:[],drawn:{},prev:null,round:-1};
function esc(s){ return String(s==null?"":s).replace(/[&<>]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;"}[c];}); }
/* standing order (presentation only): the leader first (highest total), ties in seat order. Scores, saves and the order of play never change */
function rankIdx(scores,n){ var a=[]; for(var i=0;i<n;i++) a.push(i); return a.sort(function(x,y){ return ((scores[y]||0)-(scores[x]||0))||(x-y); }); }
function rankRows(rows){ return rows.map(function(r,i){ return {r:r,i:i}; }).sort(function(a,b){ return ((b.r.score||0)-(a.r.score||0))||(a.i-b.i); }).map(function(x){ return x.r; }); }
/* a line icon from the shared ui/ set (no emoji as icons); empty on a page without ui/icons.js */
function ic(n){ var B=g.BGUI; return B&&B.icon?B.icon(n):""; }
function selIds(){ return Object.keys(ui.sel).map(Number); }
function phoneRender(root,st,ctx){
  UI.injectCSS(); if(!document.getElementById("rvPCss")){ var s=document.createElement("style"); s.id="rvPCss"; s.textContent=PCSS; document.head.appendChild(s); }
  ui.busy=false; g.Rummy.Party.last=st;
  var G=unpack(st), me=st.me, mine=G.players[me], hand=mine.hand;
  if(st.round!==ui.round){ ui.round=st.round; ui.prev=null; ui.drawn={}; }
  if(ui.prev){ var nowIds={}; hand.forEach(function(c){ nowIds[c.id]=1; if(!ui.prev[c.id]) ui.drawn[c.id]=Date.now(); }); ui.prev=nowIds; } else { ui.prev={}; hand.forEach(function(c){ ui.prev[c.id]=1; }); }
  var ids={}; hand.forEach(function(c){ ids[c.id]=1; }); Object.keys(ui.sel).forEach(function(k){ if(!ids[k]) delete ui.sel[k]; });
  var act=!!ctx.active&&!st.ro, draw=act&&st.phase==="draw", play=act&&st.phase==="play";
  if(!draw) ui.pf=null; if(ui.pf!=null&&ui.pf>=G.discard.length) ui.pf=null;
  var col=UI.colorOf(G,me), tcol=UI.colorOf(G,st.turn);
  var sel=hand.filter(function(c){ return ui.sel[c.id]; });
  var one=sel.length===1?sel[0]:null;
  // header
  var headTxt, sub="";
  if(st.ro) headTxt=st.ro.over?ic("trophy")+"Game over":"Round complete";
  else if(!act) { headTxt=esc(st.names[st.turn])+"’s turn"; sub="Waiting — your hand is below"; }
  else if(draw){ headTxt="Your turn — draw"; sub=st.stock?"Tap the stock, or tap a discard to take it":"Stock is empty — take from the pile or tap the stock to end the round";
    if(ui.pf!=null){ var f=GM.takeFeasible(G,ui.pf); sub=f?("Take "+(G.discard.length-ui.pf)+" card"+((G.discard.length-ui.pf)>1?"s":"")+" from the pile?"):"You can't use that card right away — pick another"; } }
  else { headTxt="Your turn"; sub=st.mustUse!=null?("Use the card you took from the pile ("+(st.mustNew?"in a new meld":"meld or lay off")+") then discard"):"Meld, lay off, then discard one card"; }
  var h='<div class="rvp"><div class="head" style="--c:'+tcol+'">'+headTxt+'<small>'+sub+'</small></div>';
  var rk=rankIdx(st.scores,G.units.length);   // the chips list the standing: leader first, ties in seat order
  h+='<div class="sc"><button type="button" id="rvScoreBtn" class="rvsb bg-btn bg-btn--secondary bg-btn--sm">'+ic("trophy")+'<span>Scores</span></button></div>'+
    '<div class="sc">'+rk.map(function(ui2){ var u=G.units[ui2], isMe=u.indexOf(me)>=0; return '<span class="pl2'+(isMe?" me":"")+'" style="--cc:'+UI.colorOf(G,u[0])+'">'+u.map(function(i){ return esc(st.names[i]); }).join(" &amp; ")+' · <b>'+st.scores[ui2]+'</b></span>'; }).join("")+'</div>';
  // table
  h+='<div class="tbl bg-surface--felt bg-frame" data-stage-solid><div class="rm" id="rvm">'+(G.melds.length?G.melds.map(function(m){
      var fit=play&&one&&GM.mayLayOn(G,m,me)&&R.layOff(m,one,G.o)&&!(st.mustNew&&st.mustUse===one.id);
      return UI.meldHTML(m,G,{cls:fit?"fit":""}); }).join(""):'<div class="empty">No melds yet</div>')+'</div>';
  h+='<div class="pl"><div class="stk" id="rvs">'+UI.backHTML({label:st.stock?"":"EMPTY"})+st.stock+' left</div><div class="dp" id="rvd">'+
    (G.discard.length?G.discard.map(function(c,i){ return UI.cardHTML(c,{cls:(ui.pf!=null&&i>=ui.pf?"pf":""),attrs:'data-i="'+i+'"'}); }).join(""):'<span class="none">Discard pile is empty</span>')+'</div></div></div>';
  // actions
  var btns="", SORTB=function(){ return '<button type="button" class="bg-btn bg-btn--secondary" data-a="sort">'+ic("swap")+'<span>Sort: '+ui.sort+'</span></button>'; };
  if(st.ro){ btns='<span class="wait">Waiting for the host to continue…</span>'; }
  else if(draw){
    if(ui.pf!=null){ var tf=GM.takeFeasible(G,ui.pf); btns+='<button type="button" class="pri bg-btn bg-btn--primary" data-a="take"'+(tf?"":" disabled")+'>Take '+(G.discard.length-ui.pf)+' from pile</button><button type="button" class="bg-btn bg-btn--secondary" data-a="cancel">Cancel</button>'; }
    else btns+='<button type="button" class="pri bg-btn bg-btn--primary" data-a="stock">Draw from stock</button>';
    btns+=SORTB();
  } else if(play){
    var m=sel.length>=3?R.buildMeld(sel,G.o):null;
    var ts=one?G.melds.filter(function(x){ return GM.mayLayOn(G,x,me)&&R.layOff(x,one,G.o)&&!(st.mustNew&&st.mustUse===one.id); }):[];
    btns+='<button type="button" class="'+(m?"pri bg-btn bg-btn--primary":"bg-btn bg-btn--secondary")+'" data-a="meld"'+(m?"":" disabled")+'>Meld'+(m?" (+"+R.meldPoints(m,G.o)*(G.o.doubleFour&&sel.length===4?2:1)+")":"")+'</button>'+
      '<button type="button" class="bg-btn bg-btn--secondary" data-a="lay"'+(ts.length?"":" disabled")+'>Lay off</button>'+
      '<button type="button" class="bg-btn bg-btn--secondary" data-a="discard"'+(sel.length===1?"":" disabled")+'>Discard</button>'+
      '<button type="button" class="bg-btn bg-btn--secondary" data-a="undo"'+(st.canUndo?"":" disabled")+'>'+ic("reset")+'<span>Undo</span></button><button type="button" class="bg-btn bg-btn--secondary" data-a="hint">'+ic("star")+'<span>Hint</span></button>'+SORTB();
  } else btns=SORTB();
  h+='<div class="acts" id="rva">'+btns+'</div>';
  h+='<div class="hd" id="rvh">'+(st.ro?"":UI.sortHand(hand,ui.sort,ui.order).map(function(c){ return UI.cardHTML(c,{cls:ui.sel[c.id]?"sel":"",style:UI.drawnStyle(ui.drawn,c.id)}); }).join(""))+'</div>';
  h+='<div class="lg">'+(st.log||[]).map(esc).join("<br>")+'</div>';
  if(st.ro){
    var rows=rankRows(st.ro.rows).map(function(r){ return '<tr><td>'+esc(r.name)+'</td><td>'+r.melded+'</td><td>'+(r.dead?-r.dead:0)+'</td><td>'+((r.bonus+r.oppHands)||0)+'</td><td class="'+(r.total>=0?"pos":"neg")+'">'+(r.total>0?"+":"")+r.total+'</td><td class="bg-score__total">'+r.score+'</td></tr>'; }).join("");
    h+='<div class="sheet bg-scorepad" style="width:100%"><table class="bg-score"><thead><tr><th scope="col">Player</th><th scope="col">Melds</th><th scope="col">Hand</th><th scope="col">Bonus</th><th scope="col">Round</th><th scope="col">Total</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  h+='</div>';
  root.innerHTML=h;
  var sb=root.querySelector("#rvScoreBtn");
  if(sb) sb.onclick=function(){
    var ov=document.createElement("div"); ov.className="rvsb-ov"; ov.setAttribute("role","dialog"); ov.setAttribute("aria-label","Scoreboard");
    var ord=rankIdx(st.scores,G.units.length);   // the columns follow the standing: leader first
    var th=ord.map(function(ui2){ return '<th scope="col">'+G.units[ui2].map(function(i){ return esc(st.names[i]); }).join(" &amp; ")+'</th>'; }).join("");
    var rowsH=(st.hist||[]).map(function(rw,ri){ return '<tr><td>R'+(ri+1)+'</td>'+ord.map(function(ui2){ var r=rw[ui2]||[0,0]; return '<td class="'+(r[0]>=0?"pos":"neg")+'">'+(r[0]>0?"+":"")+r[0]+'</td>'; }).join("")+'</tr>'; }).join("")||'<tr><td colspan="'+(G.units.length+1)+'" style="text-align:center">No rounds finished yet</td></tr>';
    var tot=ord.map(function(ui2){ return '<td class="bg-score__total">'+st.scores[ui2]+'</td>'; }).join("");
    ov.innerHTML='<div class="rvsb-card bg-card"><h2>Scoreboard</h2><p class="rvsb-sub">'+(st.o&&st.o.deals>0?'<b>'+st.o.deals+' deals</b> (+'+st.o.dealsBonus+' to the leader)':'Playing to <b>'+st.target+'</b>')+' · round '+st.round+'</p>'+
      '<div class="bg-scorepad"><table class="bg-score"><thead><tr><th scope="col">Round</th>'+th+'</tr></thead><tbody>'+rowsH+'<tr><td><b>Total</b></td>'+tot+'</tr></tbody></table></div>'+
      '<button type="button" id="rvScX" class="bg-btn bg-btn--primary bg-btn--block">Close</button></div>';
    document.body.appendChild(ov); var x=ov.querySelector("#rvScX"); x.onclick=function(){ ov.remove(); }; try{ x.focus({preventScroll:true}); }catch(e){}
  };
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
  if(!root.__drag){ root.__drag=true; UI.enableDragSort(root,"#rvh",function(ids){ if(root.__reorder) root.__reorder(ids); }); }
  root.__reorder=function(ids){ ui.order=ids; ui.sort="custom"; phoneRender(root,st,ctx); };
}
function resetUI(){ ui.sel={}; ui.pf=null; ui.busy=false; }
function unbusy(){ ui.busy=false; }

g.Rummy.Party={snap:snap,unpack:unpack,describe:describe,tvHTML:tvHTML,tvCSS:TVCSS,roundSheetHTML:roundSheetHTML,phoneRender:phoneRender,resetUI:resetUI,unbusy:unbusy,ui:ui,esc:esc};
if(typeof module!=="undefined"&&module.exports) module.exports=g.Rummy.Party;
})(typeof window!=="undefined"?window:globalThis);
