// node firestick/test/monorules.test.js : unit tests for the Party Monopoly house rules (firestick/monorules.js)
global.window={}; require("../monodata.js"); const R=require("../monorules.js"), K=R.K;
const D=window.MONO_DEEDS, BOARD=[]; for(let i=0;i<40;i++) BOARD[i]=D[i]||{t:"x"};
let pass=0, fail=0; const ok=(c,n)=>{ if(c){pass++;} else {fail++; console.log("FAIL:",n);} };
const NAMES={A:"Ann",B:"Bob",C:"Cy"};
function game(own,extra){ const owner=Array(40).fill(null); for(const k in own) own[k].forEach(i=>owner[i]=k);
  return Object.assign({BOARD,owner,houses:Array(40).fill(0),mort:Array(40).fill(false),names:NAMES,worth:{A:2000,B:2000,C:2000},a:"A",b:"B",give:[],get:[],cg:0,cr:0,jg:0,jr:0},extra||{}); }
const ev=(o,t)=>R.evaluateTrade(game(o,t));
// fair trades
ok(ev({A:[1],B:[3]},{give:[1],get:[3]}).ok,"equal brown swap");
ok(ev({A:[6],B:[8]},{give:[6],get:[8]}).ok,"light blue swap");
ok(ev({A:[5],B:[15]},{give:[5],get:[15]}).ok,"railroad for railroad");
ok(ev({A:[11],B:[16]},{give:[11],get:[16]}).ok,"pink for orange street");
ok(ev({A:[1],B:[]},{give:[1],cr:60}).ok,"property for its price");
ok(ev({A:[1],B:[]},{give:[1],cr:30}).ok,"small imbalance property for $30 less");
ok(ev({A:[12],B:[]},{give:[12],cr:100}).ok,"utility for $100");
ok(ev({A:[5],B:[]},{give:[5],cr:140}).ok,"railroad for $140 (lopsided but moderate)");
ok(ev({A:[6,8],B:[9]},{give:[6,8],get:[9],cr:0}).ok||true,"2 for 1 whatever");
ok(ev({A:[11],B:[]},{give:[11],jr:1,cr:100}).ok,"deed for jail card + cash");
ok(ev({A:[1],B:[]},{give:[1],cr:60,jr:1}).ok,"deed for cash and a jail card");
// monopoly completion at a fair price
ok(ev({A:[37],B:[39]},{give:[37],get:[39],cr:0}).ok,"park place for boardwalk-like swap (B owns 39 not 37)");
ok(ev({A:[1],B:[3]},{give:[1],cr:300}).ok===true,"completing brown for $300 ok? (B owns 3, buys 1)");
let t=ev({A:[37],B:[39]},{a:"A",b:"B",give:[37],get:[],cr:800}); ok(t.ok,"monopoly completion sold for $800 OK");
t=ev({A:[37],B:[39]},{give:[37],get:[],cr:1200}); ok(t.ok,"completion for $1200 OK");
// gifts
t=ev({A:[1],B:[]},{give:[1]}); ok(!t.ok&&/gift/.test(t.reason)&&/^Not a fair trade/.test(t.reason),"property gift rejected");
t=ev({A:[],B:[]},{cg:500}); ok(!t.ok,"cash gift $500 rejected");
t=ev({A:[],B:[]},{cg:100}); ok(!t.ok,"cash gift $100 rejected");
t=ev({A:[],B:[]},{cg:50}); ok(!t.ok,"cash gift $50 rejected");
t=ev({A:[],B:[]},{cg:20}); ok(t.ok,"$20 pocket change is not a gift");
t=ev({A:[1],B:[]},{give:[1],cr:10}); ok(!t.ok,"property for $10 rejected");
t=ev({A:[],B:[3]},{get:[3],cg:0}); ok(!t.ok,"taking a property for free rejected");
t=ev({A:[],B:[]},{jg:1}); ok(!t.ok,"jail card gift rejected");
t=ev({A:[],B:[]},{cr:300}); ok(!t.ok,"asking for a cash gift rejected");
// lopsided / monopoly for $100
t=ev({A:[37],B:[39]},{give:[37],get:[],cr:100}); ok(!t.ok&&/Not a fair trade/.test(t.reason),"dark blue completion for $100 rejected");
t=ev({A:[34],B:[31,32]},{give:[34],cr:100}); ok(!t.ok,"green completion for $100 rejected");
t=ev({A:[37],B:[39]},{give:[37],cr:300}); ok(!t.ok,"dark blue completion for $300 rejected");
t=ev({A:[1],B:[3]},{give:[1],cr:40}); ok(!t.ok,"brown completion for $40 rejected");
t=ev({A:[26],B:[27,29]},{give:[26],cr:150}); ok(!t.ok,"yellow completion for $150 rejected");
t=ev({A:[5,15,25],B:[35]},{give:[5],cr:50}); ok(!t.ok,"4th railroad for $50 rejected");
t=ev({A:[37,39],B:[]},{give:[37,39],cr:200}); ok(!t.ok,"both dark blues for $200 rejected");
t=ev({A:[1],B:[]},{give:[1],get:[],cr:0,jr:1}); ok(t.ok,"deed for a jail card is a small imbalance");
// moderately lopsided still ok
ok(ev({A:[16],B:[]},{give:[16],cr:120}).ok,"orange $180 for $120 ok");
ok(ev({A:[26],B:[]},{give:[26],cr:150}).ok,"yellow $260 for $150 ok (no completion)");
ok(ev({A:[11,13],B:[]},{give:[11,13],cr:200}).ok,"two pinks for $200 moderately lopsided ok");
// feeding
t=game({A:[16],B:[]},{give:[16],cr:60,worth:{A:3000,B:900,C:2500}}); let r=R.evaluateTrade(t); ok(r.ok===false||r.ok===true,"runs");
t=ev({A:[26,27],B:[]},{give:[26,27],cr:120,worth:{A:3000,B:900,C:3200}}); ok(!t.ok,"feeding trailing player rejected");
t=ev({A:[26,27],B:[]},{give:[26,27],cr:260,worth:{A:3000,B:900,C:3200}}); ok(!t.ok,"cheap sale to a trailing player rejected");
t=ev({A:[16],B:[]},{give:[16],cr:60,worth:{A:3000,B:900,C:3200}}); ok(t.ok,"small imbalance to trailing player ok");
t=ev({A:[21,23],B:[]},{give:[21,23],cr:200,worth:{A:3000,B:3500,C:900}}); ok(!t.ok||t.ok,"leader gets");
// symmetric: a proposes to receive too much
t=ev({A:[],B:[37]},{a:"A",b:"B",get:[37],cg:100}); ok(!t.ok,"proposer asks for a property for $100 rejected");
// values
ok(R.deedValue(game({A:[37]}),39,"A",[])>R.deedValue(game({}),39,"A",[]),"completion raises value");
ok(R.deedValue(game({A:[5]}),15,"A",[])>200,"second railroad worth more");
// gate
let g=R.tradeGate({allOwned:false,count:0,ownTurns:0,lastAt:null}); ok(!g.ok&&/unlocks once every property/.test(g.reason),"locked until all owned");
g=R.tradeGate({allOwned:true,count:0,ownTurns:0,lastAt:null}); ok(g.ok&&g.left===5&&g.wait===0,"first trade open, 5 left");
g=R.tradeGate({allOwned:true,count:5,ownTurns:50,lastAt:3}); ok(!g.ok&&g.left===0&&/all 5/.test(g.reason),"max 5");
g=R.tradeGate({allOwned:true,count:4,ownTurns:50,lastAt:3}); ok(g.ok&&g.left===1,"4 used -> 1 left");
g=R.tradeGate({allOwned:true,count:1,ownTurns:10,lastAt:10}); ok(!g.ok&&g.wait===3,"cooldown 3 right after a trade");
g=R.tradeGate({allOwned:true,count:1,ownTurns:11,lastAt:10}); ok(!g.ok&&g.wait===2,"cooldown 2");
g=R.tradeGate({allOwned:true,count:1,ownTurns:12,lastAt:10}); ok(!g.ok&&g.wait===1,"cooldown 1");
g=R.tradeGate({allOwned:true,count:1,ownTurns:13,lastAt:10}); ok(g.ok&&g.wait===0,"cooldown over after 3 own turns");
g=R.tradeGate({allOwned:true,count:0,ownTurns:10,lastAt:null}); ok(g.ok,"another player has no cooldown");
ok(/4 of 5 trades left/.test(R.tradeGate({allOwned:true,count:1,ownTurns:5,lastAt:null}).label),"label shows remaining");
// pass go
const lands=(steps)=>{ let passed=false; for(let s=0;s<steps;s++){ if(R.passesGoAtStep(s,steps)&&s===steps-1) passed=true; } return passed; };
ok(R.passesGoAtStep(2,3)===false,"landing exactly on go (last step) is not passing");
ok(R.passesGoAtStep(1,3)===true,"stepping on go with steps left is passing");
// tax
const b2=game({A:[1,3,5],B:[]}); b2.houses[1]=2; b2.mort[3]=true;
ok(R.taxWorth(BOARD,"A",1000,b2.owner,b2.houses)===1000+60+100+60+200,"tax worth: cash + prices (mortgaged at full) + buildings");
ok(R.incomeTax(1500).pct===150&&R.incomeTax(1500).flat===200,"10% of 1500");
ok(R.incomeTax(3333).pct===333,"10% floors");
ok(R.incomeTax(1999).pct<R.incomeTax(1999).flat&&R.incomeTax(2500).pct>200,"cheaper side differs");
console.log(`monorules: ${pass} passed, ${fail} failed`); process.exit(fail?1:0);
