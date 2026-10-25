/* Monopoly house rules that are pure logic (no DOM): shared by the Party Mode TV host (firestick/index.html) and its tests.
   Loaded before the host script; also usable from node (module.exports). Board data: BOARD[i] = {t:"prop"|"rr"|"util", price, house, g}. */
(function(root){
  "use strict";
  var K={
    SALARY_FLAT_TAX:200, INCOME_TAX_PCT:10,
    TRADE_MAX_PER_PLAYER:5,        // trades a player may PROPOSE (and complete) in one game
    TRADE_COOLDOWN_TURNS:3,        // own complete turns between two trades the same player proposes
    JAIL_CARD_VALUE:50,            // what a Get Out of Jail Free card is worth in a deal
    MONO_BONUS_MULT:1.25,          // completing a colour set is worth this x the set's printed prices to the receiver
    RR_PER_OWNED:40, UTIL_PER_OWNED:30,
    GIFT_NOMINAL:25,               // a side giving no more than this counts as giving "nothing"
    GIFT_MIN:50,                   // ... and the other side must give at least this for it to be called a gift
    FAIR_SLACK:150,                // any imbalance up to this many dollars is always fine
    FAIR_RATIO_MIN:0.55,           // beyond the slack, the poorer side must still get this share of the richer side's value
    FEED_DIFF:200, FEED_RATIO:0.75, // "feeding": a bigger gap than this AND below this ratio, to a player who trails someone else
    FEED_BEHIND:0.9                // trailing = net worth under this x the leader's
  };
  function groupOf(BOARD,g){ var a=[]; for(var i=0;i<BOARD.length;i++) if(BOARD[i]&&BOARD[i].t==="prop"&&BOARD[i].g===g) a.push(i); return a; }
  function m(n){ return "$"+Math.round(n); }

  /* what one deed is worth to the player who would receive it (incoming = the deeds that player receives in this same deal) */
  function deedValue(c,i,recv,incoming){
    var B=c.BOARD, s=B[i], v=c.mort&&c.mort[i]?Math.floor((s.price||0)/2):(s.price||0), owned=function(x){ return x===i||c.owner[x]===recv||incoming.indexOf(x)>=0; };
    if(s.t==="prop"){
      v+=(c.houses&&c.houses[i]||0)*s.house;
      var grp=groupOf(B,s.g), mine=grp.filter(owned).length;
      if(mine===grp.length){ var sum=0; grp.forEach(function(x){ sum+=B[x].price; }); v+=Math.round(sum*K.MONO_BONUS_MULT); }
      else if(mine>1) v+=Math.round(s.price*0.15*(mine-1));
    } else if(s.t==="rr"){ var n=0; for(var x=0;x<B.length;x++) if(B[x]&&B[x].t==="rr"&&x!==i&&owned(x)) n++; v+=n*K.RR_PER_OWNED; }
    else if(s.t==="util"){ var u=0; for(var y=0;y<B.length;y++) if(B[y]&&B[y].t==="util"&&y!==i&&owned(y)) u++; v+=u*K.UTIL_PER_OWNED; }
    return v;
  }
  /* c: {BOARD, owner[], houses[], mort[], worth:{id:netWorth}, names:{id:name}, a, b, give[] (a -> b), get[] (b -> a), cg, cr, jg, jr}
     returns {ok, reason, aGets, bGets}. a proposed; b answers. */
  function evaluateTrade(c){
    var aGets=0, bGets=0, i;
    (c.get||[]).forEach(function(x){ aGets+=deedValue(c,x,c.a,c.get); });
    (c.give||[]).forEach(function(x){ bGets+=deedValue(c,x,c.b,c.give); });
    aGets+=(c.cr|0)+(c.jr?K.JAIL_CARD_VALUE:0); bGets+=(c.cg|0)+(c.jg?K.JAIL_CARD_VALUE:0);
    var na=(c.names&&c.names[c.a])||"A", nb=(c.names&&c.names[c.b])||"B";
    var lo=Math.min(aGets,bGets), hi=Math.max(aGets,bGets), ben=aGets>=bGets?c.a:c.b, nben=ben===c.a?na:nb, ndon=ben===c.a?nb:na;
    var res=function(ok,why){ return {ok:ok,reason:ok?"":"Not a fair trade: "+why,aGets:aGets,bGets:bGets}; };
    if(lo<=K.GIFT_NOMINAL&&hi>=K.GIFT_MIN) return res(false,ndon+" would be giving "+nben+" a gift ("+m(hi)+" of value for next to nothing).");
    var gap=hi-lo;
    if(gap>K.FAIR_SLACK&&lo/hi<K.FAIR_RATIO_MIN) return res(false,nben+" would get about "+m(hi)+" of value but give only about "+m(lo)+".");
    if(gap>=K.FEED_DIFF&&lo/hi<K.FEED_RATIO&&c.worth){
      var lead=0, id; for(id in c.worth) if(c.worth[id]>lead) lead=c.worth[id];
      var third=false; for(id in c.worth) if(id!==ben&&c.worth[id]>c.worth[ben]) third=true;
      if(third&&c.worth[ben]<lead*K.FEED_BEHIND) return res(false,"this feeds "+nben+" (who trails the leader) at "+ndon+"'s expense.");
    }
    return {ok:true,reason:"",aGets:aGets,bGets:bGets};
  }
  /* trading gate. st: {allOwned, count (trades this player already made), ownTurns (own complete turns so far), lastAt (ownTurns when they last traded, or null)}
     returns {ok, reason, left (trades left), wait (own turns still to wait), label (short text for the trade UI)} */
  function tradeGate(st){
    var left=Math.max(0,K.TRADE_MAX_PER_PLAYER-(st.count|0)), wait=0;
    if(st.lastAt!=null) wait=Math.max(0,K.TRADE_COOLDOWN_TURNS-((st.ownTurns|0)-st.lastAt));
    var label=left+" of "+K.TRADE_MAX_PER_PLAYER+" trades left"+(wait?" · wait "+wait+" more of your turns":" · no cooldown");
    if(!st.allOwned) return {ok:false,left:left,wait:wait,label:label,reason:"Trading unlocks once every property is owned."};
    if(left<=0) return {ok:false,left:0,wait:wait,label:label,reason:"You have used all "+K.TRADE_MAX_PER_PLAYER+" of your trades."};
    if(wait>0) return {ok:false,left:left,wait:wait,label:label,reason:"Cooldown: wait "+wait+" more of your own turn"+(wait>1?"s":"")+" before you propose another trade."};
    return {ok:true,left:left,wait:0,label:label,reason:""};
  }
  /* moving 'steps' squares one at a time: after step s (0-based) the token is on GO. Passing GO = the move continues beyond it.
     Landing exactly on GO (last step) does not count. */
  function passesGoAtStep(s,steps){ return s<steps-1; }
  /* total worth for the 10% Income Tax: cash + printed prices (mortgaged deeds too) + the cost of every building (a hotel = 5 houses) */
  function taxWorth(BOARD,id,cash,owner,houses){ var w=cash; for(var i=0;i<BOARD.length;i++) if(owner[i]===id&&BOARD[i]){ w+=BOARD[i].price||0; if(BOARD[i].t==="prop") w+=(houses[i]||0)*BOARD[i].house; } return w; }
  function incomeTax(worth){ return {flat:K.SALARY_FLAT_TAX,pct:Math.floor(worth*K.INCOME_TAX_PCT/100)}; }

  var API={K:K,deedValue:deedValue,evaluateTrade:evaluateTrade,tradeGate:tradeGate,passesGoAtStep:passesGoAtStep,taxWorth:taxWorth,incomeTax:incomeTax,groupOf:groupOf};
  root.MonoRules=API; if(typeof module!=="undefined"&&module.exports) module.exports=API;
})(typeof window!=="undefined"?window:globalThis);
