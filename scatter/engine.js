/* SCATTERGORIES-style category game — pure rules engine + computer players (no DOM). Needs bank.js (window.ScatterBank).
   A round has SLOTS: {label, letter, bank}. Classic: one slot per category (same letter). Key-word mode: one slot per letter of a key word (same category). */
(function(g){
"use strict";
var Sc=g.Scatter=g.Scatter||{};
var LETTERS="ABCDEFGHIJKLMNOPRSTW".split("");

/* ---------------- options / versions ---------------- */
function defaultOpts(){
  return {
    mode:"letter",            // letter (roll a letter, many categories) | keyword (one category, the letters of a key word)
    rounds:3,                 // rounds per game (keyword mode: play to `target` points instead)
    cats:12,                  // categories per round
    timer:180,                // seconds to write
    answersPer:1,             // answers allowed per category
    listMode:"same",          // same = every round uses the same categories (1988 rules) | new = fresh categories each round
    kidOnly:false,            // only categories marked easy / family friendly
    startRule:"must",         // must = answer has to start with the letter | bonus = (Junior) 2 pts if it starts with the letter, 1 pt if not
    bonus:"none",             // none | double (2023: 2 pts when a second word also starts with the letter) | extra (1988: +1 per extra word starting with the letter)
    strict:"plurals",         // how alike two answers must be to count as the same: exact | plurals | fuzzy
    judge:"vote",             // vote = anyone can challenge an answer and everyone votes | auto = anything that starts with the letter counts
    stopRule:false,           // round ends 8 seconds after someone fills every category
    star:false,               // Junior: a star on the die lets the roller pick any unused letter
    target:0,                 // keyword mode: first to this many points wins
    tieRound:true,            // tied after the last round -> extra round
    cpuSkill:"normal"         // easy | normal | hard  (how many answers the computers fill in and how common they are)
  };
}
function mergeOpts(o){ var d=defaultOpts(); for(var k in (o||{})) d[k]=o[k]; return d; }
var VERSIONS=[
  {id:"classic",name:"Classic (1988 rules)",tag:"3 rounds · 12 categories · 3:00",desc:"The original: a letter is rolled and everyone fills in the same 12 categories with answers starting with it. 1 point for each answer nobody else wrote. 3 rounds, same list every round.",opts:{}},
  {id:"modern",name:"Modern (2023 rules)",tag:"4 rounds · fresh lists",desc:"The current rulebook: 4 rounds, a new list of categories each round, and optional double points for an answer that repeats the letter (like “coffee cup”).",opts:{rounds:4,listMode:"new"}},
  {id:"refresh",name:"Refresh (house variant)",tag:"2 rounds · up to 3 answers · house",desc:"A house variant (not from a published rulebook): 2 rounds, up to three different answers per category (1 point each if unique), double points for repeating the letter, tie → extra round.",opts:{rounds:2,answersPer:3,bonus:"double"}},
  {id:"junior",name:"Junior",tag:"2 rounds · 90 seconds · easy lists",desc:"For kids: easy categories, 2 rounds, 90 seconds. 2 points for an answer starting with the letter, 1 point if it doesn't. A star on the die lets the roller pick any letter. (The 90-second timer and the star are house choices, not checked against the Junior rulebook.)",opts:{rounds:2,cats:8,timer:90,kidOnly:true,startRule:"bonus",star:true,judge:"auto",listMode:"new"}},
  {id:"keyword",name:"Key Word (Categories style)",tag:"no die · first to 25 · house",desc:"No letter die: one category and a KEY WORD. Fill a line for every letter of the word with an answer starting with that letter. 2:00, first to 25 points. (A house version, not from a published rulebook.)",opts:{mode:"keyword",timer:120,target:25,rounds:99,cats:1,tieRound:false}}
];
/* [key, label, kind, choices, published?, only in this mode] - rows for another mode are not shown (Key Word games have no rounds/lists: first to the target wins) */
var HOUSE=[
  ["rounds","Rounds","choice",[[1,"1"],[2,"2"],[3,"3"],[4,"4"],[5,"5"],[6,"6"]],1,"letter"],
  ["cats","Categories per round","choice",[[6,"6"],[8,"8"],[12,"12"]],0,"letter"],
  ["timer","Time to write","choice",[[60,"1:00"],[90,"1:30"],[120,"2:00"],[180,"3:00"],[240,"4:00"]],1],
  ["answersPer","Answers per category","choice",[[1,"1"],[2,"2"],[3,"3"]],1],
  ["listMode","Category lists","choice",[["same","Same every round"],["new","New each round"]],1,"letter"],
  ["kidOnly","Easy / family categories only","bool",null,0],
  ["bonus","Bonus for repeating the letter","choice",[["none","None"],["double","Double points (2023)"],["extra","+1 per extra word (1988)"]],1],
  ["strict","Same answer means","choice",[["exact","Exactly the same"],["plurals","Same, or plural of it"],["fuzzy","Close spelling too"]],0],
  ["judge","Doubtful answers","choice",[["vote","Players can challenge & vote"],["auto","Accept anything that fits the letter"]],1],
  ["stopRule","Stop when someone finishes","bool",null,0],
  ["tieRound","Tie → extra round","bool",null,1,"letter"],
  ["cpuSkill","Computer players","choice",[["easy","Easy"],["normal","Normal"],["hard","Hard"]],0]
];
function versionOpts(id,extra){ var v=VERSIONS.filter(function(x){ return x.id===id; })[0]||VERSIONS[0]; var o={}; for(var k in v.opts) o[k]=v.opts[k]; for(var k2 in (extra||{})) o[k2]=extra[k2]; return mergeOpts(o); }

/* ---------------- text helpers ---------------- */
function fold(s){ s=String(s==null?"":s); try{ s=s.normalize("NFD").replace(/[̀-ͯ]/g,""); }catch(e){} return s.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim(); }
var ART={a:1,an:1,the:1};
/* a leading "a / an / the" is dropped only when a space follows it ("A-line skirt" starts with A) */
function words(s){ var raw=String(s==null?"":s), w=fold(raw).split(" ").filter(Boolean); if(w.length>1&&ART[w[0]]&&/^\s*(a|an|the)\s/i.test(raw)) w.shift(); else if(w.length===1&&ART[w[0]]) return []; return w; }
function stemWord(w){
  if(w.length>4&&/ies$/.test(w)) w=w.replace(/ies$/,"y"); else if(w.length>4&&/(ches|shes|xes|zes|sses)$/.test(w)) w=w.replace(/es$/,""); else if(w.length>3&&/s$/.test(w)&&!/ss$/.test(w)) w=w.replace(/s$/,"");
  // fold what is left the same way for the singular and the plural: cookie/cookies, tomato/tomatoes, bus/buses, virus/viruses, shoe/shoes
  if(w.length>3&&/ie$/.test(w)) w=w.slice(0,-2)+"y";
  if(w.length>3&&/[os]e$/.test(w)) w=w.slice(0,-1);
  if(w.length>3&&/s$/.test(w)&&!/ss$/.test(w)) w=w.slice(0,-1);
  return w;
}
function keyOf(raw,strict){ var w=words(raw); if(!w.length) return ""; if(strict!=="exact"){ w[w.length-1]=stemWord(w[w.length-1]); } return w.join(" "); }
function lev(a,b){ var m=a.length,n=b.length,i,j; if(Math.abs(m-n)>1) return 2; var d=[]; for(i=0;i<=m;i++){ d[i]=[i]; } for(j=1;j<=n;j++) d[0][j]=j; for(i=1;i<=m;i++) for(j=1;j<=n;j++) d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1)); return d[m][n]; }
function same(a,b,strict){ if(!a||!b) return false; if(a===b) return true; if(strict==="fuzzy"&&a.length>=6&&b.length>=6&&lev(a,b)<=1) return true; return false; }
function startsWith(raw,letter){ var w=words(raw); return !!w.length&&w[0][0]===letter.toLowerCase(); }
function letterWords(raw,letter){ var w=words(raw), n=0; w.forEach(function(x){ if(x[0]===letter.toLowerCase()) n++; }); return n; }

/* ---------------- key words (only letters that are on the die) ---------------- */
var KEYWORDS=("garden planet kitchen bonfire teapot winter sailboat castle market forest island rocket school windmill picnic starfish monster harbor candle snowman popcorn dragon feather pancake lantern mirror pencil rabbit shadow tractor wonder blanket bridge desert engine fabric gather hammer ladder magnet meadow object palace ribbon saddle camera wagon basket cabin dinner eagle finger balloon honest jacket knight lemon melon needle orange parade robot random season table acorn window wallet carpet doctor flower golden cobweb insect pebble kettle laptop marble napkin orchard pirate remote spider kitten whistle blossom compass diamond elephant fiction giraffe seashell isle lighter mammal notebook parcel rainbow sandwich theater package").split(" ");
function goodKeyword(w){ return /^[abcdefghijklmnoprstw]{4,9}$/.test(w); }

/* ---------------- new game / round ---------------- */
function bank(){ return g.ScatterBank||[]; }
function newGame(cfg){
  var o=mergeOpts(cfg.opts), rnd=cfg.rnd||Math.random;
  var G={o:o,rnd:rnd,round:0,over:false,log:[],usedLetters:[],usedCats:[],usedWords:[],roundsDone:0,
    players:cfg.names.map(function(n,i){ return {id:i,name:n,human:!!(cfg.humans&&cfg.humans[i]),score:0,roundScores:[]}; }),phase:"idle",tiebreak:false};
  return G;
}
function pickRandom(a,rnd){ return a[Math.floor(rnd()*a.length)]; }
/* near-identical categories (mostly the same answers) are never dealt in the same list or game */
var TWIN={f12:"g27",f04:"g23",p28:"t31",f17:"g06"}; Object.keys(TWIN).forEach(function(k){ TWIN[TWIN[k]]=k; });
function pickCats(G,n){
  var pool=bank().filter(function(c){ return !G.o.kidOnly||c.kid; });
  var fresh=pool.filter(function(c){ return G.usedCats.indexOf(c.id)<0&&!(TWIN[c.id]&&G.usedCats.indexOf(TWIN[c.id])>=0); });
  if(fresh.length<n){ G.usedCats=[]; fresh=pool.slice(); }
  var out=[]; while(out.length<n&&fresh.length){ var i=Math.floor(G.rnd()*fresh.length), c=fresh.splice(i,1)[0]; out.push(c); if(TWIN[c.id]) fresh=fresh.filter(function(x){ return x.id!==TWIN[c.id]; }); }
  return out;
}
function rollLetter(G){
  var free=LETTERS.filter(function(l){ return G.usedLetters.indexOf(l)<0; }); if(!free.length){ G.usedLetters=[]; free=LETTERS.slice(); }
  var star=G.o.star&&G.rnd()<1/20;
  return {letter:pickRandom(free,G.rnd),star:star,free:free};
}
function startRound(G,opts){
  opts=opts||{}; var o=G.o; if(G.tiebreak){ G.tieActive=G.tieIds; G.tiebreak=false; G.tieRounds=(G.tieRounds||0)+1; } G.round++; G.phase="write"; G.reviewed=false; G.answers={}; G.challenges={}; G.result=null; G.roundScores=null; G.stopped=false;
  var slots=[];
  if(o.mode==="keyword"){
    var cat=pickCats(G,1)[0]; G.usedCats.push(cat.id);
    var wl=KEYWORDS.filter(goodKeyword).filter(function(w){ return G.usedWords.indexOf(w)<0; }); if(!wl.length){ G.usedWords=[]; wl=KEYWORDS.filter(goodKeyword); }
    var kw=pickRandom(wl,G.rnd); G.usedWords.push(kw); G.keyword=kw.toUpperCase();
    G.keyword.split("").forEach(function(l,i){ slots.push({label:cat.text,letter:l,bank:cat,idx:i}); });
    G.letter=null; G.cat=cat;
  } else {
    var cats;
    if(o.listMode==="same"&&G.listCats&&!opts.newList) cats=G.listCats; else { cats=pickCats(G,o.cats); cats.forEach(function(c){ G.usedCats.push(c.id); }); G.listCats=cats; }
    var r=rollLetter(G); G.star=r.star; G.starFree=r.free; G.letter=r.letter; G.usedLetters.push(r.letter);
    G.starBy=r.star?(G.round-1)%G.players.length:-1;   // players take turns rolling: the roller of a star picks the letter before anyone writes
    cats.forEach(function(c,i){ slots.push({label:c.text,letter:r.letter,bank:c,idx:i}); });
  }
  G.slots=slots;
  G.players.forEach(function(p){ G.answers[p.id]=slots.map(function(){ var a=[]; for(var i=0;i<o.answersPer;i++) a.push(""); return a; }); });
  return G;
}
/* star on the junior die: the roller picks any unused letter (the screens offer it only before writing starts and then clear G.star) */
function chooseStarLetter(G,letter){
  if(!G.star||G.phase!=="write") return {ok:false}; if(G.players.some(function(p){ return filledCount(G,p.id)>0; })) return {ok:false,msg:"Writing has started — the letter is set."};
  if(G.usedLetters.indexOf(letter)>=0&&letter!==G.letter) return {ok:false,msg:"That letter was already used."};
  if(LETTERS.indexOf(letter)<0) return {ok:false,msg:"Pick a letter from the die."};
  var i=G.usedLetters.indexOf(G.letter); if(i>=0) G.usedLetters.splice(i,1); G.letter=letter; G.usedLetters.push(letter); G.star=false; G.slots.forEach(function(s){ s.letter=letter; });
  return {ok:true};
}
function setAnswers(G,p,answers){
  if(G.phase!=="write") return {ok:false};
  var o=G.o, cur=G.answers[p]; if(!cur) return {ok:false};
  G.slots.forEach(function(s,i){ var a=(answers&&answers[i])||[]; if(!Array.isArray(a)) a=[a]; for(var k=0;k<o.answersPer;k++) cur[i][k]=String(a[k]==null?"":a[k]).slice(0,60); });
  return {ok:true};
}
function beginReview(G){ if(G.phase!=="write") return; cpuFillAll(G); G.phase="review"; cpuChallenges(G); }
/* computers challenge a human's scoring answer that is clearly made up (madeUp); the humans then vote as usual */
function cpuChallenges(G){
  var out=[]; if(G.o.judge!=="vote") return out;
  evaluate(G).entries.forEach(function(e){
    if(e.status!=="ok"||!G.players[e.p].human||!madeUp(e.raw)) return;
    var by=G.players.filter(function(c){ return !c.human; })[0]; if(!by) return;
    var r=openChallenge(G,by.id,e.slot,e.p,e.k); if(r.ok){ resolveChallenge(G,r.ch,false); out.push(r.ch); }
  });
  return out;
}
function filledCount(G,p){ var n=0; (G.answers[p]||[]).forEach(function(a){ if(a.some(function(x){ return String(x).trim(); })) n++; }); return n; }
function allFilled(G,p){ return filledCount(G,p)===G.slots.length; }

/* ---------------- computer players ---------------- */
var SKILL={easy:{rate:0.6,deep:0.15},normal:{rate:0.85,deep:0.5},hard:{rate:0.97,deep:0.8}};
function cpuAnswers(G,p){
  var o=G.o, sk=SKILL[o.cpuSkill]||SKILL.normal, used={}, out=[];
  G.slots.forEach(function(s,i){
    var row=[];
    for(var k=0;k<o.answersPer;k++){
      var pool=((s.bank.answers||{})[s.letter]||[]).filter(function(x){ return !used[keyOf(x,"plurals")]; });
      if(!pool.length||G.rnd()>(k===0?sk.rate:sk.rate*0.6)){ row.push(""); continue; }
      // "deep" players prefer the less obvious answers further down the list (more likely to be unique)
      var idx=G.rnd()<sk.deep?Math.floor(G.rnd()*pool.length):Math.floor(G.rnd()*Math.min(2,pool.length));
      var ans=pool[idx]; used[keyOf(ans,"plurals")]=1; row.push(ans);
    }
    out.push(row);
  });
  return out;
}
function cpuFillAll(G){ G.players.forEach(function(p){ if(!p.human&&inPlay(G,p.id)) setAnswers(G,p.id,cpuAnswers(G,p.id)); }); }
/* a tie-break round is played only by the tied leaders; everyone else sits it out */
function inPlay(G,id){ return !G.tieActive||G.tieActive.indexOf(id)>=0; }

/* ---------------- judging ---------------- */
function inBank(s,raw){ var arr=((s.bank&&s.bank.answers)||{})[s.letter]||[]; var k=keyOf(raw,"plurals"); return arr.some(function(x){ return keyOf(x,"plurals")===k; }); }
function inBankAny(s,raw){ var a=(s.bank&&s.bank.answers)||{}, k=keyOf(raw,"plurals"); return Object.keys(a).some(function(L){ return a[L].some(function(x){ return keyOf(x,"plurals")===k; }); }); }
/* the computers' dictionary: every word used in the answer bank and the category names */
var VOCAB=null;
function vocab(){
  if(VOCAB) return VOCAB; var v={}, add=function(t){ words(t).forEach(function(w){ v[w]=1; v[stemWord(w)]=1; }); };
  bank().forEach(function(c){ add(c.text); Object.keys(c.answers||{}).forEach(function(L){ c.answers[L].forEach(add); }); });
  if(bank().length) VOCAB=v; return v;
}
function knownWord(w){ var v=vocab(); return !!(v[w]||v[stemWord(w)])||/^[0-9]+$/.test(w); }
function knownWords(raw){ var w=words(raw); return !!w.length&&w.every(knownWord); }
/* clearly made-up: an unknown word that mixes letters and digits, has no vowel, repeats a letter 3 times or strings 6 consonants together */
function madeUp(raw){ return words(raw).some(function(w){ return !knownWord(w)&&((w.length>=3&&/[0-9]/.test(w)&&/[a-z]/.test(w))||(w.length>=4&&!/[aeiouy]/.test(w))||/([a-z])\1\1/.test(w)||/[bcdfghjklmnpqrstvwxz]{6}/.test(w)); }); }
/* a computer accepts an answer it knows for this category, or one made of real words; it rejects words it has never seen (no coin flips) */
function cpuJudge(G,s,raw){ return inBank(s,raw)||(G.o.startRule!=="must"&&inBankAny(s,raw))||knownWords(raw); }
/* compute every entry's status and points. challenges can already have been decided (rejected/accepted) */
function evaluate(G){
  var o=G.o, entries=[], bySlot=[], pi, si, k;
  G.slots.forEach(function(){ bySlot.push([]); });
  var seenOwn={};
  G.players.forEach(function(p){ seenOwn[p.id]={}; });
  for(si=0;si<G.slots.length;si++){
    G.players.forEach(function(p){
      if(!inPlay(G,p.id)) return;   // sitting out a tie-break round: no answers, can't cancel anyone's
      for(k=0;k<o.answersPer;k++){
        var raw=String((G.answers[p.id][si]||[])[k]||"").trim(), e={p:p.id,slot:si,k:k,raw:raw,key:keyOf(raw,o.strict),status:"ok",pts:0,reason:""};
        if(!raw||!e.key) e.status="blank";
        else if(o.startRule==="must"&&!startsWith(raw,G.slots[si].letter)){ e.status="invalid"; e.reason="doesn't start with "+G.slots[si].letter; }
        else if(o.mode==="keyword"&&false){ }
        else {
          // the same answer can't be used twice by one player in a round (the first use stands)
          var dupOwn=seenOwn[p.id][e.key]; if(dupOwn!=null){ e.status="invalid"; e.reason=dupOwn===si?"already written in this category":"already used in another line"; } else seenOwn[p.id][e.key]=si;
        }
        var ch=(G.challenges[si]||{})[p.id+"/"+k]; if(ch&&ch.state==="rejected"&&e.status==="ok"){ e.status="invalid"; e.reason="voted out"; e.out=true; }
        e.challenge=ch?ch.state:null;
        entries.push(e); bySlot[si].push(e);
      }
    });
  }
  // an answer the vote threw out is out for everyone who wrote it: a duplicate scores nothing, so its twin gets no free point
  bySlot.forEach(function(list){
    var out=list.filter(function(e){ return e.out; });
    if(out.length) list.forEach(function(e){ if(e.status==="ok"&&out.some(function(x){ return same(x.key,e.key,o.strict); })){ e.status="invalid"; e.reason="voted out"; } });
  });
  // duplicates between different players
  bySlot.forEach(function(list){
    var live=list.filter(function(e){ return e.status==="ok"; });
    live.forEach(function(e){ e.group=null; });
    for(var i=0;i<live.length;i++) for(var j=i+1;j<live.length;j++){
      if(live[i].p!==live[j].p&&same(live[i].key,live[j].key,o.strict)){ live[i].dup=true; live[j].dup=true; }
    }
    live.forEach(function(e){ if(e.dup){ e.status="dup"; e.reason="someone else wrote it too"; } });
  });
  // points
  var slotLetter=function(si){ return G.slots[si].letter; };
  entries.forEach(function(e){
    if(e.status!=="ok"){ e.pts=0; return; }
    var L=slotLetter(e.slot), sw=startsWith(e.raw,L), pts=1;
    if(o.startRule==="bonus") pts=sw?2:1;
    if(sw&&o.bonus!=="none"){ var n=letterWords(e.raw,L); if(o.bonus==="double"&&n>=2) pts=2; else if(o.bonus==="extra"&&n>=2) pts=n; }
    e.pts=pts;
  });
  // a junior-style answer that doesn't start with the letter still has to fit; with judge=auto we accept it
  return {entries:entries,bySlot:bySlot};
}
function totals(G,ev){ var t={}; G.players.forEach(function(p){ t[p.id]=0; }); ev.entries.forEach(function(e){ t[e.p]+=e.pts; }); return t; }
/* challenges: any entry that is OK/dup/invalid-by-letter can't be challenged; blanks neither */
function canChallenge(G,e){ return G.o.judge==="vote"&&e&&(e.status==="ok"||e.status==="dup")&&e.raw; }
function openChallenge(G,by,slot,p,k){
  var key=p+"/"+k; G.challenges[slot]=G.challenges[slot]||{};
  if(G.challenges[slot][key]) return {ok:false,msg:"That answer was already challenged."};
  if(by===p&&false) return {ok:false};
  var votes={}; // computers vote immediately (cpuJudge: answers they know or real words yes, made-up words no)
  var s=G.slots[slot], raw=((G.answers[p][slot]||[])[k])||"";
  G.players.forEach(function(pl){ if(pl.human) return; votes[pl.id]=cpuJudge(G,s,raw); });
  G.challenges[slot][key]={by:by,p:p,k:k,slot:slot,votes:votes,state:"open"};
  return {ok:true,ch:G.challenges[slot][key]};
}
function castVote(G,voter,slot,p,k,accept){
  var ch=((G.challenges[slot]||{})[p+"/"+k]); if(!ch||ch.state!=="open") return {ok:false};
  ch.votes[voter]=!!accept; return resolveChallenge(G,ch,false);
}
function resolveChallenge(G,ch,force){
  var need=G.players.length, got=Object.keys(ch.votes).length;
  if(got<need&&!force) return {ok:true,done:false};
  var yes=0,no=0; Object.keys(ch.votes).forEach(function(v){ if(ch.votes[v]) yes++; else no++; });
  if(yes===no){ // tie: the challenged player's own vote does not count
    var own=ch.votes[ch.p]; if(own===true) yes--; else if(own===false) no--;
  }
  ch.state=(yes>no)?"accepted":"rejected"; ch.yes=yes; ch.no=no;
  return {ok:true,done:true,state:ch.state};
}
function pendingVoters(G,ch){ return G.players.filter(function(p){ return ch.votes[p.id]===undefined; }).map(function(p){ return p.id; }); }

/* ---------------- finishing ---------------- */
function finishRound(G){
  var ev=evaluate(G), t=totals(G,ev);
  G.players.forEach(function(p){ var on=inPlay(G,p.id); p.score+=on?t[p.id]:0; p.roundScores.push(on?t[p.id]:null); });   // null = sat out the tie-break ("—")
  G.result={entries:ev.entries,totals:t,letter:G.letter,keyword:G.keyword};
  G.phase="scored"; G.roundsDone++;
  var over=false, winners=null;
  if(G.tieActive){
    var ids=G.tieActive, bestR=Math.max.apply(null,ids.map(function(i){ return t[i]; })), tops2=ids.filter(function(i){ return t[i]===bestR; });
    if(tops2.length>1&&(G.tieRounds||0)<3){ G.tiebreak=true; G.tieIds=tops2; G.tieActive=null; }   // tied again: another round (after 3 tie-break rounds they share the win)
    else { G.over=true; G.winners=tops2; G.phase="over"; G.tieActive=null; }
    return G.result;
  }
  var best=Math.max.apply(null,G.players.map(function(p){ return p.score; }));
  if(G.o.mode==="keyword"){ if(best>=G.o.target){ over=true; } }
  else if(G.roundsDone>=G.o.rounds){ over=true; }
  if(over){ var tops=G.players.filter(function(p){ return p.score===best; }); if(tops.length>1&&G.o.tieRound&&G.o.mode!=="keyword"){ G.tiebreak=true; over=false; G.tieIds=tops.map(function(p){ return p.id; }); } else { winners=tops.map(function(p){ return p.id; }); } }
  if(over){ G.over=true; G.winners=winners; G.phase="over"; }
  return G.result;
}
function standings(G){ return G.players.slice().sort(function(a,b){ return b.score-a.score; }); }

/* ---------------- snapshot ---------------- */
function snapshot(G,me,extra){
  var s={o:G.o,round:G.round,rounds:G.o.rounds,phase:G.phase,letter:G.letter,star:!!G.star,keyword:G.keyword||null,me:me,starFree:G.starFree||null,
    slots:(G.slots||[]).map(function(x,i){ return {i:i,label:x.label,letter:x.letter}; }),
    players:G.players.map(function(p,i){ return {id:i,name:p.name,human:p.human,score:p.score,rs:p.roundScores.slice(),filled:G.answers&&G.answers[i]?filledCount(G,i):0}; }),
    myAnswers:(me>=0&&G.answers&&G.answers[me])?G.answers[me]:null,over:G.over,winners:G.winners||null,tiebreak:!!G.tiebreak,tieIds:G.tieIds||null,tieActive:G.tieActive||null,starBy:G.starBy!=null?G.starBy:-1,
    result:G.result?{totals:G.result.totals,entries:G.result.entries}:null};
  if(G.phase==="review"){ var ev=evaluate(G); s.review={totals:totals(G,ev),entries:ev.entries}; }
  s.challenges=[]; Object.keys(G.challenges||{}).forEach(function(si){ Object.keys(G.challenges[si]).forEach(function(k){ var c=G.challenges[si][k]; s.challenges.push({slot:+si,p:c.p,k:c.k,by:c.by,state:c.state,votes:c.votes,yes:c.yes,no:c.no}); }); });
  if(extra) for(var q in extra) s[q]=extra[q];
  return s;
}

/* save / restore (the bank categories are stored by id so saves stay small) */
function serialize(G){
  var c=JSON.parse(JSON.stringify(G,function(k,v){ return (k==="bank"||k==="cat"||k==="listCats"||k==="rnd"||k==="log")?undefined:v; }));
  c.slotBank=(G.slots||[]).map(function(s){ return s.bank?s.bank.id:null; }); c.catId=G.cat?G.cat.id:null; c.listIds=(G.listCats||[]).map(function(x){ return x.id; });
  return c;
}
function restore(c){
  var byId={}; bank().forEach(function(x){ byId[x.id]=x; });
  c.rnd=Math.random; c.log=[]; (c.slots||[]).forEach(function(s,i){ s.bank=byId[(c.slotBank||[])[i]]||{answers:{},text:s.label}; });
  c.cat=c.catId?byId[c.catId]:null; c.listCats=(c.listIds||[]).map(function(i){ return byId[i]; }).filter(Boolean);
  return c;
}
Sc.Engine={serialize:serialize,restore:restore,beginReview:beginReview,VERSIONS:VERSIONS,HOUSE:HOUSE,LETTERS:LETTERS,defaultOpts:defaultOpts,mergeOpts:mergeOpts,versionOpts:versionOpts,fold:fold,words:words,keyOf:keyOf,same:same,startsWith:startsWith,
  newGame:newGame,startRound:startRound,chooseStarLetter:chooseStarLetter,setAnswers:setAnswers,filledCount:filledCount,allFilled:allFilled,cpuAnswers:cpuAnswers,cpuFillAll:cpuFillAll,
  evaluate:evaluate,totals:totals,canChallenge:canChallenge,openChallenge:openChallenge,castVote:castVote,resolveChallenge:resolveChallenge,pendingVoters:pendingVoters,finishRound:finishRound,standings:standings,snapshot:snapshot,inBank:inBank,KEYWORDS:KEYWORDS,goodKeyword:goodKeyword,
  inPlay:inPlay,cpuChallenges:cpuChallenges,cpuJudge:cpuJudge,madeUp:madeUp,knownWords:knownWords};
if(typeof module!=="undefined"&&module.exports) module.exports=Sc.Engine;
})(typeof window!=="undefined"?window:globalThis);
