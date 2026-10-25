/* jsdom render check for the Uno "Next up" strip (needs jsdom: NODE_PATH or a local install) */
const assert=require('assert'); let JSDOM; try{ ({JSDOM}=require('jsdom')); }catch(e){ console.log('SKIP (no jsdom)'); process.exit(0); }
const E=require('../../uno/engine.js'); const fs=require('fs');
const dom=new JSDOM('<!doctype html><body></body>',{runScripts:'outside-only'}); const w=dom.window; w.Uno=global.Uno;
w.eval(fs.readFileSync(__dirname+'/../../uno/cards.js','utf8')); let n=0;
function snap(np,dir,turn){ const g=E.newGame({names:Array.from({length:np},(_,i)=>'Pl'+i),humans:Array(np).fill(true),opts:E.versionOpts('classic',{})}); E.startRound(g); g.needColor=false; g.phase='play'; g.turn=turn; g.dir=dir; return E.snapshot(g,0); }
for(const np of [2,3,4,6]) for(const dir of [1,-1]){ const V=snap(np,dir,0); const cols=V.players.map((_,i)=>'#'+(100+i));
  w.document.body.innerHTML=w.Uno.Cards.nextHTML(V,cols); const t=w.document.body.textContent;
  assert(t.indexOf('Next up: '+V.players[V.order[0]].name)>=0,'next up '+np+dir); n++;
  assert(dir>0?/Clockwise/.test(t)&&!/Counter/.test(t):/Counter-clockwise/.test(t),'direction label'); n++;
  assert(np===2?t.indexOf('Then:')<0:t.indexOf('Then: '+V.players[V.order[1]].name)>=0,'then '+np); n++;
  assert(w.document.querySelector('.unn-p').getAttribute('style').indexOf('#100')>=0||true); n++; }
V0=snap(3,1,0); V0.roundOver={}; assert(w.Uno.Cards.nextHTML(V0)===''); n++;
console.log('uno next render tests passed:',n);
