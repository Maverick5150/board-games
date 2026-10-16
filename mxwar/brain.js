/* MOTOCROSS WAR — the computer riders' brains. Load after race.js / round.js / season.js (node: require after them).
   HONEST SCOPE: a race is a game of War, and War has NO decisions: every rider turns the top card of their packet at the same time; the
   shuffle decides every battle, every war and every finishing place. There is nothing for a brain to choose, so a brain NEVER touches the
   cards, the race or the season RNG (G.rs): decide(G, seat) returns the only legal move (turn the card), exactly like baseline(G, seat).
   The tournament proves it: brains vs the baseline play identical seasons (lockstep, same seeds) and win at the fair share.
   What a brain does (AI-TASK.md, for character, not for results):
     - Its own temperament per rider (bold / balanced / reserved), seeded from the rider and the season (its OWN RNG b.r), so two riders
       don't behave alike; the real champion and front-runners lean reserved, the back of the field bold.
     - A mood read from the championship and the running order every time it is asked: behind with little to lose = bold, leading =
       reserved, a close fight = balanced (the temperament nudges the thresholds).
     - In-season opponent modelling: who finishes just ahead of whom (a rival per rider), who has the holeshots.
     - Pace: pace(G, speed) = how long the field takes to turn its cards at the Game speed (bold riders snap, reserved riders wait),
       so computer battles are visible and paced; think() per rider for a hot-seat or Party table.
     - Talk: react(G, ev) = a short line for the log / a toast (holeshot, a war won, the lead, out of cards), in the rider's temperament.
     - Light learning across seasons (localStorage 'bg_ai_mxwar', versioned, bounded to 300 riders, every access in try/catch): how often
       each real rider beat a human rider here, so an old rival is named again next season (rivalFor). Old or broken data never breaks a game.
   Skill (Easy / Normal / Hard): with no decision to make it cannot change a card; it sets the talk (Easy friendly, Hard sharp) and how much
   the riders remember (Easy no rival model). Said so on the setup page (skillNote). Every call is far under 50 ms (no search at all). */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Brain) return;
var Race=MX.Race||(typeof require==="function"?require("./race.js"):null);
var KEY="bg_ai_mxwar", VER=1, MAXN=300;
var SKILL={easy:{model:false,learn:false,talk:"friendly"},normal:{model:true,learn:true,talk:"plain"},hard:{model:true,learn:true,talk:"sharp"}};
var SPEED={slow:1100,medium:650,fast:320};
var store=null, storeSet=false;
function getStore(){ if(storeSet) return store; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ store=s; storeSet=true; }
function hash(str){ var h=2166136261; str=String(str); for(var i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function rnd(b){ b.r=(Math.imul(b.r,1664525)+1013904223)>>>0; return b.r/4294967296; }
function skillOf(G){ return SKILL[G&&G.o&&G.o.skill]||SKILL.normal; }

/* ---------------- one brain per computer rider (plain data in G.ai, saved with the season) ---------------- */
function brainOf(G,id){
  var b=G.ai[id]; if(b) return b;
  var R=G.riders[id]; if(!R||R.kind==="human") return null;
  var r=hash(G.sid+"|"+id+"|"+R.name), lean=R.pos!=null?(R.pos<=3?-.25:R.pos<=10?-.1:R.pos>=25?.2:0):(R.kind==="privateer"?.25:0);
  var b0={r:r}, x=rnd(b0)+lean;
  b={t:x<.33?"reserved":x<.7?"balanced":"bold",r:b0.r,mood:"balanced",ahead:{},rival:null,n:0};
  G.ai[id]=b; return b;
}
/* mood: from the championship (place and gap) and, in a race, the running order */
function readMood(G,id,b,race,L){
  var nudge=b.t==="bold"?1:b.t==="reserved"?-1:0, score=0;
  var place=0, n=0, gap=0;
  if(!L) L=MX.Season?MX.Season.standings(G):[];
  for(var i=0;i<L.length;i++) if(L[i].id===id){ place=i+1; gap=L[i].gap; break; }
  n=L.length||1;
  if(place){ if(place<=3) score-=1; else if(place>n*.6) score+=1; if(gap>50) score+=1; }
  if(race){ var s=G.rmap?G.rmap.indexOf(id):-1; if(s>=0){ var st=Race.standings(race); for(i=0;i<st.length;i++) if(st[i].s===s){ if(i===0) score-=1; else if(i>st.length/2) score+=1; break; } } }
  score+=nudge;
  b.mood=score>=1?"bold":score<=-1?"reserved":"balanced";
  return b.mood;
}

/* ---------------- the moves: no decisions (see the header) ---------------- */
function decide(G,s){ return Race.defaultMove(G,s); }      // G = a race: the only legal move
function baseline(G,s){ return Race.defaultMove(G,s); }
function hasDecisions(){ return false; }
var skillNote="War has no choices to make: the cards decide every race. Computer skill sets how the riders talk and remember rivals, never the cards.";

/* ---------------- pace: how long the field takes at the Game speed ---------------- */
function think(G,id,speed){
  var b=brainOf(G,id); if(!b) return 0;
  readMood(G,id,b,G.race);
  var base=SPEED[speed]||SPEED.medium, m=b.mood==="bold"?.75:b.mood==="reserved"?1.25:1;
  return Math.round(base*m*(.85+.3*rnd(b)));
}
function pace(G,speed){
  if(!G.race||!G.rmap) return SPEED[speed]||SPEED.medium;
  var t=0, k=0, base=SPEED[speed]||SPEED.medium, L=MX.Season?MX.Season.standings(G):[];
  G.rmap.forEach(function(id){ var b=brainOf(G,id); if(!b) return; k++; readMood(G,id,b,G.race,L); t+=b.mood==="bold"?.8:b.mood==="reserved"?1.2:1; });
  return Math.round(base*(k?t/k:1));
}

/* ---------------- opponent model: after every race ---------------- */
function observe(G,ev){
  var sk=skillOf(G); if(!sk.model) return;
  (ev||[]).forEach(function(e){
    if(e.e!=="raceDone") return;
    var o=e.order;
    for(var i=1;i<o.length;i++){
      var b=brainOf(G,o[i]); if(!b) continue;
      b.n++; var a=o[i-1]; b.ahead[a]=(b.ahead[a]||0)+1;
      var best=null, bn=0; for(var k in b.ahead) if(b.ahead[k]>bn){ bn=b.ahead[k]; best=k; }
      b.rival=best;
      /* keep the table small: drop the riders seen once when it grows */
      var keys=Object.keys(b.ahead); if(keys.length>24) keys.forEach(function(k){ if(b.ahead[k]<2&&k!==best) delete b.ahead[k]; });
    }
  });
}

/* ---------------- talk ---------------- */
var LINES={
  holeshot:{friendly:["{n} gets a great start!"],plain:["{n} grabs the holeshot!","Holeshot: {n}!"],sharp:["{n} owns the first turn.","{n} rips the holeshot."]},
  war:{friendly:["{n} wins the war!"],plain:["{n} wins the war and {k} cards.","{n} takes the war: {k} cards."],sharp:["{n} wins the war. {k} cards, thank you.","Big pass by {n}: {k} cards."]},
  lead:{friendly:["{n} takes the lead!"],plain:["{n} moves into the lead.","New leader: {n}."],sharp:["{n} goes by for the lead.","{n} makes the pass for P1."]},
  out:{friendly:["{n} is out of cards."],plain:["{n} is out of cards.","{n} pulls off: no cards left."],sharp:["{n} is done for the night.","{n} runs out of cards."]},
  win:{friendly:["{n} wins!"],plain:["{n} takes the checkered flag!"],sharp:["{n} wins it. Nobody close.","{n} takes the flag."]}
};
function line(G,kind,id,k){
  var sk=skillOf(G), b=brainOf(G,id), R=G.riders[id]; if(!R) return null;
  var set=(LINES[kind]||{})[sk.talk]||[]; if(!set.length) return null;
  var i=b?Math.floor(rnd(b)*set.length):0;
  return set[i].replace("{n}",R.name).replace("{k}",String(k||""));
}
/* a short line for an event (race events: seats are race seats; season events: rider ids) or null */
function react(G,e){
  var id=function(s){ return G.rmap?G.rmap[s]:null; };
  if(e.e==="holeshot") return line(G,"holeshot",id(e.s));
  if(e.e==="win"&&e.war>0&&e.n>=12){ var x=id(e.s); return G.riders[x]&&G.riders[x].kind!=="human"?line(G,"war",x,e.n):null; }
  if(e.e==="lead") return line(G,"lead",id(e.s));
  if(e.e==="out"&&e.seats&&e.seats.length===1) return line(G,"out",id(e.seats[0]));
  if(e.e==="raceDone") return line(G,"win",e.order[0]);
  return null;
}

/* ---------------- learning across seasons (localStorage, guarded) ---------------- */
function readTable(){
  try{
    var s=getStore(); if(!s) return {v:VER,r:{}};
    var t=JSON.parse(s.getItem(KEY)||"null");
    if(!t||t.v!==VER||typeof t.r!=="object"||!t.r) return {v:VER,r:{}};
    return t;
  }catch(e){ return {v:VER,r:{}}; }
}
function writeTable(t){ try{ var s=getStore(); if(s) s.setItem(KEY,JSON.stringify(t)); }catch(e){} }
/* at the end of a season: every real rider who raced a human: races together, times they finished ahead of the human */
function learn(G){
  if(!skillOf(G).learn||!G.humans.length) return false;
  var t=readTable(), h=G.humans[0];
  G.results.forEach(function(res){
    var c=res.cls, hi=c.indexOf(h); if(hi<0) return;
    c.forEach(function(id,i){
      var R=G.riders[id]; if(!R||R.kind!=="pro") return;
      var e=t.r[R.name]||(t.r[R.name]={n:0,a:0});
      e.n=Math.min(1e6,(e.n|0)+1); if(i<hi) e.a=Math.min(1e6,(e.a|0)+1);
    });
  });
  var names=Object.keys(t.r);
  if(names.length>MAXN){ names.sort(function(a,b){ return (t.r[b].n|0)-(t.r[a].n|0); }); names.slice(MAXN).forEach(function(k){ delete t.r[k]; }); }
  writeTable(t); return true;
}
/* the human's rival: this season the computer rider who finished just ahead of them most often; else the rider in this season who beat
   them most in earlier seasons on this device */
function rivalFor(G,hid){
  hid=hid||G.humans[0]; if(!hid) return null;
  var cnt={}, best=null, bn=0, k;
  G.results.forEach(function(res){ var i=res.cls.indexOf(hid); if(i>0){ var a=res.cls[i-1]; cnt[a]=(cnt[a]||0)+1; } });
  for(k in cnt) if(cnt[k]>bn&&G.riders[k].kind!=="human"){ bn=cnt[k]; best=k; }
  if(best) return {id:best,why:"season",n:bn};
  if(!skillOf(G).learn) return null;
  var t=readTable(), bestA=0;
  G.roster.forEach(function(id){ var e=t.r[G.riders[id].name]; if(e&&e.a>bestA){ bestA=e.a; best=id; } });
  return best?{id:best,why:"memory",n:bestA}:null;
}

MX.Brain={SKILL:SKILL,SPEED:SPEED,KEY:KEY,brainOf:brainOf,readMood:readMood,decide:decide,baseline:baseline,hasDecisions:hasDecisions,skillNote:skillNote,
  think:think,pace:pace,observe:observe,react:react,learn:learn,rivalFor:rivalFor,readTable:readTable,setStore:setStore};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Brain;
})(typeof window!=="undefined"?window:globalThis);
