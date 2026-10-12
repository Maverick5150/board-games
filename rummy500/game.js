/* 500 Rummy — game state machine + computer player. Needs engine.js first (window.Rummy). */
(function(g){
"use strict";
var R=g.Rummy;
var DEAL={2:13,3:7,4:7,5:7,6:7,7:7,8:7};

function newGame(cfg){
  var o=R.mergeOpts(cfg.opts), rnd=cfg.rnd||Math.random, n=cfg.names.length;
  if(o.decksAuto) o.decks=n>=5?2:1;
  if(o.teams&&n!==4) o.teams=false;
  var G={ o:o, n:n, rnd:rnd, round:0, over:false, winner:null, log:[],
    players:cfg.names.map(function(nm,i){ return {id:i,name:nm,human:!!(cfg.humans&&cfg.humans[i]),score:0,hand:[]}; }),
    dealer:cfg.dealer!=null?cfg.dealer:Math.floor(rnd()*n),
    melds:[], stock:[], discard:[], turn:0, phase:"draw", mustUse:null, mustNew:false, noDiscard:null, nextMeldId:1, snap:null, roundOver:null };
  G.units=o.teams?[[0,2],[1,3]]:G.players.map(function(p){ return [p.id]; });
  G.scores=G.units.map(function(){ return 0; });
  G.history=[];
  return G;
}
function unitOf(G,i){ return G.o.teams?i%2:i; }
function unitName(G,u){ return G.units[u].map(function(i){ return G.players[i].name; }).join(" & "); }
function cur(G){ return G.players[G.turn]; }
function ev(G,type,data){ var e={type:type}; for(var k in (data||{})) e[k]=data[k]; G.log.push(e); return e; }

function startRound(G){
  var o=G.o; G.round++; G.roundOver=null;
  var deck=R.shuffle(R.makeDeck(o),G.rnd);
  G.players.forEach(function(p){ p.hand=[]; });
  var per=DEAL[G.n]||7;
  for(var i=0;i<per;i++) G.players.forEach(function(p){ p.hand.push(deck.pop()); });
  G.stock=deck; G.discard=[G.stock.pop()]; G.melds=[]; G.nextMeldId=1;
  G.dealer=(G.dealer+1)%G.n; G.turn=(G.dealer+1)%G.n; G.phase="draw"; G.mustUse=null; G.mustNew=false; G.noDiscard=null; G.snap=null;
  return ev(G,"deal",{dealer:G.dealer,per:per});
}

/* ---------- snapshots (undo back to just after the draw) ---------- */
function cloneMelds(ms){ return ms.map(function(m){ var c={}; for(var k in m) c[k]=m[k]; c.cards=m.cards.map(function(e){ return {c:e.c,r:e.r,s:e.s,by:e.by,dbl:e.dbl}; }); return c; }); }
function takeSnap(G){ G.snap={ hand:cur(G).hand.slice(), melds:cloneMelds(G.melds), mustUse:G.mustUse, mustNew:G.mustNew, noDiscard:G.noDiscard, nextMeldId:G.nextMeldId }; }
function undo(G){
  if(G.phase!=="play"||!G.snap) return {ok:false,msg:"Nothing to undo."};
  cur(G).hand=G.snap.hand.slice(); G.melds=cloneMelds(G.snap.melds); G.mustUse=G.snap.mustUse; G.mustNew=G.snap.mustNew; G.noDiscard=G.snap.noDiscard; G.nextMeldId=G.snap.nextMeldId;
  return {ok:true,events:[ev(G,"undo",{p:G.turn})]};
}

/* ---------- lay-off permission ---------- */
function hasOwnMeld(G,who){ for(var i=0;i<G.melds.length;i++) if(unitOf(G,G.melds[i].owner)===unitOf(G,who)) return true; return false; }
function mayLayOn(G,m,who){
  var o=G.o;
  if(!o.layOffOpp&&unitOf(G,m.owner)!==unitOf(G,who)) return false;
  if(o.layOffNeedsOwnMeld&&!hasOwnMeld(G,who)) return false;
  return true;
}
function layTarget(G,card,who){ for(var i=0;i<G.melds.length;i++){ if(mayLayOn(G,G.melds[i],who)&&R.layOff(G.melds[i],card,G.o)) return G.melds[i]; } return null; }

/* ---------- drawing ---------- */
function drawStock(G){
  if(G.over||G.roundOver) return {ok:false,msg:"The round is over."};
  if(G.phase!=="draw") return {ok:false,msg:"You already drew."};
  if(G.stock.length===0){
    if(G.o.emptyStock==="reshuffle"&&G.discard.length>1){
      var top=G.discard.pop(); G.stock=R.shuffle(G.discard,G.rnd); G.discard=[top];
    } else return endRound(G,"stock",null);
  }
  var c=G.stock.pop(); cur(G).hand.push(c); G.phase="play"; G.mustUse=null; G.mustNew=false; G.noDiscard=null; takeSnap(G);
  return {ok:true,card:c,events:[ev(G,"drawStock",{p:G.turn})]};
}
/* does taking from position idx need the deepest card to be used at once? (buried cards always; the top card only in "always" versions) */
function mustUseRule(G,idx){ return G.o.pickup==="always"||idx<G.discard.length-1; }
/* can the deepest taken card be used right away (lay-off, or new meld with the hand + other taken cards)? */
function takeFeasible(G,idx){
  if(idx<0||idx>=G.discard.length) return false;
  var o=G.o;
  if(!mustUseRule(G,idx)) return true;
  var taken=G.discard.slice(idx), d=taken[0], p=cur(G);
  if(!o.deepestNewMeld&&layTarget(G,d,G.turn)) return true;
  var pool=p.hand.concat(taken);
  var cands=R.candidateMelds(pool,o);
  for(var i=0;i<cands.length;i++){
    if(cands[i].ids.indexOf(d.id)<0) continue;
    if(o.goOutNeedsDiscard&&cands[i].ids.length>=pool.length) continue;
    return true;
  }
  return false;
}
function takeDiscard(G,idx){
  if(G.over||G.roundOver) return {ok:false,msg:"The round is over."};
  if(G.phase!=="draw") return {ok:false,msg:"You already drew."};
  if(!takeFeasible(G,idx)) return {ok:false,msg:"You can only take that card if you can use it right away in a meld"+(G.o.deepestNewMeld?"":" or lay-off")+"."};
  var must=mustUseRule(G,idx);
  var taken=G.discard.splice(idx), p=cur(G);
  taken.forEach(function(c){ p.hand.push(c); });
  G.mustUse=must?taken[0].id:null; G.mustNew=must&&!!G.o.deepestNewMeld;
  G.noDiscard=must?null:taken[0].id;
  G.phase="play"; takeSnap(G);
  return {ok:true,cards:taken,events:[ev(G,"takeDiscard",{p:G.turn,cards:taken.map(function(c){ return c.id; }),deepest:taken[0].id})]};
}

/* ---------- melding / laying off ---------- */
function handIndex(p,id){ for(var i=0;i<p.hand.length;i++) if(p.hand[i].id===id) return i; return -1; }
function wouldEmpty(G,p,removing){ return G.o.goOutNeedsDiscard&&p.hand.length-removing<1; }
function meld(G,ids){
  if(G.phase!=="play") return {ok:false,msg:"Draw first."};
  var p=cur(G), cards=[], i;
  for(i=0;i<ids.length;i++){ var k=handIndex(p,ids[i]); if(k<0) return {ok:false,msg:"Those cards aren't in your hand."}; cards.push(p.hand[k]); }
  if(wouldEmpty(G,p,cards.length)) return {ok:false,msg:"You must keep a card to discard when going out."};
  var m=R.buildMeld(cards,G.o);
  if(!m) return {ok:false,msg:"That isn't a valid set or run."};
  m.id=G.nextMeldId++; m.owner=G.turn;
  var dbl=G.o.doubleFour&&cards.length>=4;
  m.cards.forEach(function(e){ e.by=G.turn; if(dbl) e.dbl=true; });
  p.hand=p.hand.filter(function(c){ return ids.indexOf(c.id)<0; });
  if(G.mustUse!=null&&ids.indexOf(G.mustUse)>=0){ G.mustUse=null; G.mustNew=false; }
  G.melds.push(m);
  var events=[ev(G,"meld",{p:G.turn,meld:m.id,cards:ids.slice()})];
  if(!p.hand.length) return finishOut(G,events);
  return {ok:true,meld:m,events:events};
}
function layOffCard(G,meldId,cardId){
  if(G.phase!=="play") return {ok:false,msg:"Draw first."};
  var p=cur(G), k=handIndex(p,cardId); if(k<0) return {ok:false,msg:"That card isn't in your hand."};
  var m=null, mi=-1; for(var i=0;i<G.melds.length;i++) if(G.melds[i].id===meldId){ m=G.melds[i]; mi=i; }
  if(!m) return {ok:false,msg:"No such meld."};
  if(!G.o.layOffOpp&&unitOf(G,m.owner)!==unitOf(G,G.turn)) return {ok:false,msg:"You can't lay off on an opponent's meld in this version."};
  if(G.o.layOffNeedsOwnMeld&&!hasOwnMeld(G,G.turn)) return {ok:false,msg:"You need a meld of your own on the table before you can lay off."};
  if(G.mustNew&&G.mustUse===cardId) return {ok:false,msg:"The deepest card you took must go into a brand-new meld."};
  if(wouldEmpty(G,p,1)) return {ok:false,msg:"You must keep a card to discard when going out."};
  var card=p.hand[k], nm=R.layOff(m,card,G.o);
  if(!nm) return {ok:false,msg:"That card doesn't fit that meld."};
  nm.cards.forEach(function(e){ var old=null; for(var j=0;j<m.cards.length;j++) if(m.cards[j].c.id===e.c.id) old=m.cards[j]; e.by=old?old.by:G.turn; if(old&&old.dbl) e.dbl=true; });
  G.melds[mi]=nm; p.hand.splice(k,1);
  if(G.mustUse===cardId){ G.mustUse=null; G.mustNew=false; }
  var events=[ev(G,"layOff",{p:G.turn,meld:meldId,card:cardId})];
  if(!p.hand.length) return finishOut(G,events);
  return {ok:true,meld:nm,events:events};
}

/* ---------- discarding / ending ---------- */
function discardCard(G,cardId){
  if(G.phase!=="play") return {ok:false,msg:"Draw first."};
  var p=cur(G), k=handIndex(p,cardId); if(k<0) return {ok:false,msg:"That card isn't in your hand."};
  if(G.mustUse!=null) return {ok:false,msg:"First use the card you took from the discard pile (meld it"+(G.mustNew?"":" or lay it off")+")."};
  if(G.noDiscard===cardId&&p.hand.length>1) return {ok:false,msg:"You can't discard the card you just took from the pile."};
  var c=p.hand.splice(k,1)[0]; G.discard.push(c);
  var events=[ev(G,"discard",{p:G.turn,card:c.id})];
  if(!p.hand.length) return finishOut(G,events);
  G.turn=(G.turn+1)%G.n; G.phase="draw"; G.snap=null; G.noDiscard=null;
  return {ok:true,events:events};
}
function finishOut(G,events){
  var r=endRound(G,"out",G.turn); r.events=events.concat(r.events||[]); return r;
}
function handValue(G,p){ var s=0; p.hand.forEach(function(c){ s+=R.handCardValue(G.o,c); }); return s; }
function endRound(G,reason,outP){
  var o=G.o, rows=G.units.map(function(u,ui){ return {id:ui,players:u.slice(),name:unitName(G,ui),melded:0,dead:0,bonus:0,oppHands:0,total:0}; });
  G.melds.forEach(function(m){ m.cards.forEach(function(e){ rows[unitOf(G,e.by)].melded+=R.meldCardValue(o,e)*(e.dbl?2:1); }); });
  var penalty=o.handPenalty&&!(reason==="stock"&&!o.stockEndPenalty);
  G.players.forEach(function(p){ if(penalty) rows[unitOf(G,p.id)].dead+=handValue(G,p); });
  if(outP!=null){
    var ou=unitOf(G,outP); rows[ou].bonus=o.goOutBonus;
    if(o.addOppHands) G.players.forEach(function(p){ if(unitOf(G,p.id)!==ou) rows[ou].oppHands+=handValue(G,p); });
  }
  rows.forEach(function(r,ui){ r.total=r.melded-r.dead+r.bonus+r.oppHands; G.scores[ui]+=r.total; r.score=G.scores[ui]; });
  G.players.forEach(function(p){ p.score=G.scores[unitOf(G,p.id)]; });
  (G.history=G.history||[]).push({round:G.round,rows:rows.map(function(r){ return {t:r.total,s:r.score}; })});
  var outU=outP!=null?unitOf(G,outP):null;
  var cands=[]; G.scores.forEach(function(s,ui){ if(s>=o.target&&(!o.mustGoOut||ui===outU)) cands.push(ui); });
  var winU=null;
  if(cands.length){
    if(o.winnerRule==="outPlayer"&&outU!=null&&cands.indexOf(outU)>=0) winU=outU;
    else { var best=-Infinity; cands.forEach(function(ui){ if(G.scores[ui]>best) best=G.scores[ui]; }); var tops=cands.filter(function(ui){ return G.scores[ui]===best; }); if(tops.length===1) winU=tops[0]; }
  }
  if(winU!=null){ G.over=true; G.winner=winU; }
  G.roundOver={reason:reason,out:outP,rows:rows,over:G.over,winner:G.winner,winnerName:winU!=null?unitName(G,winU):null};
  return {ok:true,roundOver:G.roundOver,events:[ev(G,"roundOver",{reason:reason,out:outP})]};
}

/* ======================= computer player ======================= */
function containing(cands,id){ return cands.filter(function(m){ return m.ids.indexOf(id)>=0; }); }
function bestPlanPts(hand,o){ return R.bestMelds(hand,o).pts; }
function takeValue(G,idx){
  var p=cur(G), o=G.o, taken=G.discard.slice(idx), pool=p.hand.concat(taken), d=taken[0];
  var before=bestPlanPts(p.hand,o), best=-1;
  if(!o.deepestNewMeld&&layTarget(G,d,G.turn)) best=R.pipValue(o,d.r||10);
  var cands=containing(R.candidateMelds(pool,o),d.id);
  cands.forEach(function(m){ var rest=pool.filter(function(c){ return m.ids.indexOf(c.id)<0; }); var pts=R.meldPoints(m,o)+bestPlanPts(rest,o); if(pts>best) best=pts; });
  if(best<0) return null;
  var used=0;
  taken.forEach(function(c){ used+=R.handCardValue(o,c)*0.35; });
  return best-before-used*0.6;
}
function aiDraw(G){
  var best=null, bi=-1, empty=G.stock.length===0;
  for(var idx=G.discard.length-1;idx>=0;idx--){
    if(G.discard.length-idx>6) break;
    if(!takeFeasible(G,idx)) continue;
    var v=takeValue(G,idx); if(v==null) continue;
    if(best===null||v>best){ best=v; bi=idx; }
  }
  if(bi>=0&&(best>=6||(empty&&best>0))) return {t:"take",idx:bi};
  return {t:"stock"};
}
function synergy(hand,c){
  var s=0;
  hand.forEach(function(x){ if(x.id===c.id||x.joker) return;
    if(!c.joker&&x.r===c.r) s+=4;
    if(!c.joker&&x.s===c.s){ var d=Math.abs(x.r-c.r); if(d===1) s+=3; else if(d===2) s+=2; }
  });
  if(c.joker) s+=50;
  return s;
}
function aiDiscard(G,p){
  var o=G.o, best=null, bs=1e9;
  p.hand.forEach(function(c){
    if(G.noDiscard===c.id&&p.hand.length>1) return;
    var s=synergy(p.hand,c)*3 - R.handCardValue(o,c)*0.5;
    if(layTarget(G,c,G.turn)) s+=40;
    if(s<bs){ bs=s; best=c; }
  });
  if(!best) best=p.hand[0];
  return {t:"discard",card:best.id};
}
function aiAction(G){
  if(G.over||G.roundOver) return null;
  var p=cur(G), o=G.o;
  if(G.phase==="draw") return aiDraw(G);
  if(G.mustUse!=null){
    var d=null; p.hand.forEach(function(c){ if(c.id===G.mustUse) d=c; });
    if(d){
      if(!G.mustNew){ var t=layTarget(G,d,G.turn); if(t) return {t:"layoff",meld:t.id,card:d.id}; }
      var cs=containing(R.candidateMelds(p.hand,o),d.id).sort(function(a,b){ return R.meldPoints(b,o)-R.meldPoints(a,o); });
      for(var j=0;j<cs.length;j++){ if(!(o.goOutNeedsDiscard&&cs[j].ids.length>=p.hand.length)) return {t:"meld",ids:cs[j].ids}; }
    }
  }
  var order=p.hand.slice().sort(function(a,b){ return R.handCardValue(o,b)-R.handCardValue(o,a); });
  for(var a=0;a<order.length;a++){
    if(o.goOutNeedsDiscard&&p.hand.length<=1) break;
    if(G.mustNew&&G.mustUse===order[a].id) continue;
    var tm=layTarget(G,order[a],G.turn); if(tm) return {t:"layoff",meld:tm.id,card:order[a].id};
  }
  var plan=R.bestMelds(p.hand,o).list;
  for(var q=0;q<plan.length;q++){ if(!(o.goOutNeedsDiscard&&plan[q].ids.length>=p.hand.length)) return {t:"meld",ids:plan[q].ids}; }
  return aiDiscard(G,p);
}
function applyAction(G,a){
  if(a.t==="stock") return drawStock(G);
  if(a.t==="take") return takeDiscard(G,a.idx);
  if(a.t==="meld") return meld(G,a.ids);
  if(a.t==="layoff") return layOffCard(G,a.meld,a.card);
  if(a.t==="discard") return discardCard(G,a.card);
  return {ok:false,msg:"Unknown action."};
}

/* hint for humans */
function hint(G){
  var p=cur(G), o=G.o;
  if(G.phase==="draw") return o.pickup==="always"?"Draw from the stock, or take cards from the discard pile if you can use the deepest one right away.":"Draw from the stock, or take the top discard — or dig deeper if you can use the deepest card right away.";
  if(G.mustUse!=null) return "Use the card you took from the pile "+(G.mustNew?"in a new meld":"in a meld or lay-off")+" before you discard.";
  var plan=R.bestMelds(p.hand,o);
  if(plan.list.length) return "You can meld: "+plan.list.map(function(m){ return m.cards.map(function(e){ return R.cardLabel(e.c); }).join(" "); }).join("  |  ");
  return "Discard a card to end your turn.";
}

g.Rummy.Game={ newGame:newGame,startRound:startRound,cur:cur,unitOf:unitOf,unitName:unitName,drawStock:drawStock,takeDiscard:takeDiscard,takeFeasible:takeFeasible,mustUseRule:mustUseRule,
  mayLayOn:mayLayOn,layTarget:layTarget,
  meld:meld,layOffCard:layOffCard,discardCard:discardCard,undo:undo,endRound:endRound,aiAction:aiAction,applyAction:applyAction,hint:hint,handValue:handValue,DEAL:DEAL };
if(typeof module!=="undefined"&&module.exports) module.exports=g.Rummy.Game;
})(typeof window!=="undefined"?window:globalThis);
