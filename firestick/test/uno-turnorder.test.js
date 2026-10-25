const E=require('../../uno/engine.js'), assert=require('assert'); let n=0;
function ok(c,m){ assert(c,m); n++; }
function G(np,o){ const g=E.newGame({names:Array.from({length:np},(_,i)=>'P'+i),humans:Array(np).fill(true),opts:E.versionOpts('classic',{})}); E.startRound(g); g.phase='play'; g.chal=null; g.roul=null; g.pen=null; g.over=false; g.roundOver=null; g.needColor=false; Object.assign(g,o); g.players.forEach(p=>p.alive=true); return g; }
for(const np of [2,3,4,6,10]){
  let g=G(np,{turn:0,dir:1}); let t=E.turnOrder(g,3);
  ok(t[0]===1%np,'cw next '+np); ok(t.indexOf(0)<0,'actor never listed '+np); ok(t.length===Math.min(3,np-1),'len '+np);
  g.dir=-1; t=E.turnOrder(g,3); ok(t[0]===(np-1),'ccw next '+np);
  if(np>2) ok(t[1]===np-2,'ccw then '+np);
  ok(E.snapshot(g,0).order.length===t.length,'snapshot order '+np);
}
// dead player is skipped
let g=G(4,{turn:0,dir:1}); g.players[1].alive=false; ok(E.turnOrder(g,3).join()==='2,3','dead skipped');
// round over: nothing
g=G(3,{turn:0}); g.roundOver={}; ok(E.snapshot(g,0).order.length===0,'none after round');
// challenge phase: order follows the deciding player
g=G(4,{turn:0,dir:1,phase:'challenge',chal:{by:0,victim:1,v:'wd4',n:4}}); ok(E.turnOrder(g,2).join()==='2,3','challenge actor');
// real card effects through the engine: put a known card in P0's hand over a matching top card
function play(np,v,dir,col){ const g=G(np,{turn:0,dir:dir||1}); const c=col||'R';
  g.discard.push({id:9100,f:[{c:'R',v:'5'},{c:'R',v:'5'}]}); g.color='R'; g.side=0;
  const card={id:9200,f:[{c:c,v:v},{c:c,v:v}]}; g.players[0].hand.push(card,{id:9201,f:[{c:'B',v:'3'},{c:'B',v:'3'}]});
  const r=E.applyAction(g,0,{t:'play',card:9200,color:'G'}); return {g,r}; }
let eff=0;
for(const np of [2,3,4,5,10]) for(const [v,k] of [['rev','rev'],['skip','skip'],['d2','d2']]){
  const {g,r}=play(np,v); ok(r.ok,k+' played '+np+' '+r.msg); eff++;
  const a=E.actor(g), t=E.turnOrder(g,3); ok(t.indexOf(a)<0,k+' actor excluded '+np);
  if(np===2){ ok(a===0&&t[0]===1,k+' 2p: reverse/skip/d2 give the turn back to P0, P1 next'); }
  else if(k==='rev'){ ok(g.dir===-1&&a===np-1&&t[0]===np-2,'reverse flips order '+np); }
  else { ok(a===2&&t[0]===3%np,k+' skipped/drawn player not next '+np+' a='+a); }
}
// wild draw four (no stacking): victim draws and is skipped
{ const {g,r}=play(4,'wd4',1,'W'); ok(r.ok,'wd4'); ok(E.actor(g)!==undefined,'wd4 actor'); if(g.phase==='play'||g.phase==='drawn'){ ok(E.turnOrder(g,3).indexOf(1)<0||E.actor(g)!==1,'wd4 victim not next'); } else ok(E.actor(g)===1&&E.turnOrder(g,2)[0]===2,'wd4 challenge: victim decides, then P2'); eff++; }
console.log('turnorder tests passed:',n,'effect cases',eff);
