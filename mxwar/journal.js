/* MOTOCROSS WAR — the season JOURNAL (mxann4; the CEO, 2026-10-19: "The announcers should remember previous races, like previous tracks ... if
   we're in week three, they should remember weeks one and two"): what the booth remembers after every race and every round of the season,
   watched OR simulated. Pure, no DOM, no random draw (G.rs is never touched), ES5 (the Fire TV WebView). The engine never READS it: it is not
   part of the rules, and nothing in here can fail a race, a round, a save or a load.
   Node: module.exports = MXWar.Journal; browser: MXWar.Journal (load after season.js; season.js finds it lazily either way).
   The plan: BG_audit/sprint/mxann4/design/MEMORY-PLAN.md section 3. The hooks (season.js, lazy JN(), each in a try):
     newSeason(G)  -> G.jr = Journal.create(G)
     endRace(G)    -> Journal.race(G, R, rdef)   BEFORE G.race is cleared (R = the finished race, rdef = its round.js entry)
     endRound(G)   -> Journal.round(G)           AFTER G.results.push(...) and BEFORE G.round = null
     upgrade(G)    -> Journal.upgrade(G)         a save without a journal (or one that does not match G.results) gets one built from G.results
   G.jr = {v:1, id, r:[RoundRec...] (one per scored round, in order), cur:{ri, races:[RaceRec...]} (the round under way)}
   RaceRec {k key, kind, n riders, L laps run, w winner, hs holeshot, o top ids (a qualifier: top 3), s1 their lap-1 places,
            how {led laps led at the line, wire 1 = led every lap, s1 his lap-1 place, ll 1 = took the lead on the last lap, ch lead changes at
            the line, m margin s (0.1)}, ldr [[id, laps led]] (the top three), fl [id, s, lap] the fastest lap, dnf [[id, lap, "c" crash | "o" out of
            cards]], cr [[id, crashes]], mv [[id, lap-1 place, place]] (gains and losses of 5+), bt [[a, b, laps, a finished ahead]] (side by side at
            the line, within 1.0 s, 3+ laps running), hu {id: [place, s1, best place at the line, laps led, crashes, dnf 0 | 1 crash | 2 cards]},
            d 1 = derived from G.results (no race details), nt 1 = raced without the time model (an old save's race) }
   RoundRec {ri, n, c city, v venue, d date, t title, m mult, tc, fk finals kind, w, p podium, top, fin [RaceRec], q [RaceRec with people],
             hq {hid: "seed" | "heat" | "semi" | "lcq" | "qual" | "out"}, tb [[id, place, pts]] (the standings after it: top 10 + the people),
             red, dv 1 = derived, lite 1 = details dropped by the size cap }
   THE CAREER BOOK (per device, localStorage "bg_mxwar_career"), compact: {v:2, p:{normName:[[h, sid, year, rounds, wins, pod, best, full(,
   series)]]}}: the people in the order they were last kept (at most 16: the first goes when a 17th comes), at most 12 seasons a person; h a short
   hash of the season's journal id (Journal.keep(G) upserts by it, from both hosts' save()), full 1 = the season over with every round scored,
   series only when it is not the sid's prefix. 16 people x 12 seasons stay under 8 KB. A v1 book (records as objects, an o list) is read too.
   The booth reads it through an injected career(name) (announce.js stays storage-free); Journal.career returns records as objects
   {id (h), sid, series, year, rounds, n (the season's length when full, else 0), wins, pod, best, over}. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Journal) return;
var VER=1, MAXB=48000, KEEPFULL=10, BOOKKEY="bg_mxwar_career", BOOKSEASONS=12, BOOKPEOPLE=16;
function req(p){ try{ return typeof require==="function"?require(p):null; }catch(e){ return null; } }
function TM(){ return MX.Time||req("./time.js"); }
function SN(){ return MX.Season||req("./season.js"); }
function r1(x){ return Math.round(x*10)/10; }
function isFinalKey(k){ return /^final-/.test(String(k||"")); }
var stampN=0;
function create(G){
  /* the id: the season's seed and file, and when it began (two seasons of the same file never share an id; the booth's ledger is keyed by it) */
  var t=0; try{ t=Date.now(); }catch(e){ t=0; }
  return {v:VER,id:"j"+(((G&&G.rs)>>>0).toString(36))+"-"+(G&&G.sid||"")+"-"+(t%2176782336).toString(36)+(stampN++).toString(36),r:[],cur:null};
}
function ok(G){ var j=G&&G.jr; return !!(j&&j.v===VER&&j.r&&j.r.length!=null); }

/* ---------------- a race ---------------- */
function seatOf(R,id){ for(var s=0;s<R.n;s++) if(R.r[s].id===id) return s; return -1; }
function crossT(R,s,k){ var T=R.tm.r[s].T; return k>=1&&T.length>=k?T[k-1]:null; }
function lineOrder(R,k){ var out=[]; for(var s=0;s<R.n;s++){ var t=crossT(R,s,k); if(t!=null) out.push([s,t]); } out.sort(function(a,b){ return a[1]-b[1]||a[0]-b[0]; }); return out; }
function raceRec(G,R,rd){
  var fin=rd.st<0, order=(R.res||[]).slice(), hum=G.humans||[], hin=order.filter(function(id){ return hum.indexOf(id)>=0; });
  if(!fin&&!hin.length) return null;                 /* a qualifier without a person in it: nothing to keep */
  var rec={k:rd.key,kind:rd.kind,n:R.n,w:order[0]||null};
  if(R.hs>=0&&R.r[R.hs]) rec.hs=R.r[R.hs].id;
  rec.o=order.slice(0,fin?10:3);
  var T=TM();
  if(!R.tm||!T){ rec.nt=1; rec.L=R.battle|0; hin.forEach(function(id){ var s=seatOf(R,id); (rec.hu=rec.hu||{})[id]=[order.indexOf(id)+1,0,0,0,(R.r[s].crashes|0),R.r[s].dnf?(R.r[s].dnf.why==="crash"?1:2):0]; }); return rec; }
  var tm=R.tm, L=tm.k|0, lead=[], led={}, ch=0, k, s1={}, best={}, i;
  rec.L=L;
  for(k=1;k<=L;k++){
    var lo=lineOrder(R,k), ls=lo.length?lo[0][0]:-1; lead.push(ls); if(ls>=0) led[ls]=(led[ls]|0)+1;
    if(k>1&&ls>=0&&lead[k-2]>=0&&ls!==lead[k-2]) ch++;
    for(i=0;i<lo.length;i++){ var s=lo[i][0]; if(k===1) s1[s]=i+1; if(!best[s]||i+1<best[s]) best[s]=i+1; }
  }
  var ws=seatOf(R,rec.w);
  rec.how={led:led[ws]|0,wire:L>0&&(led[ws]|0)===L?1:0,s1:s1[ws]|0,ll:L>=2&&lead[L-2]!==ws&&lead[L-1]===ws?1:0,ch:ch};
  try{ var rs=T.result(R); if(rs&&rs.margin!=null) rec.how.m=r1(rs.margin); }catch(e){}
  rec.s1=rec.o.map(function(id){ return s1[seatOf(R,id)]|0; });
  /* the top three in laps led at the line */
  var ll=[]; for(var sk in led) ll.push([R.r[+sk].id,led[sk]]); ll.sort(function(a,b){ return b[1]-a[1]||order.indexOf(a[0])-order.indexOf(b[0]); }); if(ll.length) rec.ldr=ll.slice(0,3);
  if(tm.best&&R.r[tm.best.s]) rec.fl=[R.r[tm.best.s].id,r1(tm.best.t),tm.best.k];
  var dnf=[], cr=[];
  R.r.forEach(function(p){ if(p.dnf) dnf.push([p.id,p.dnf.lap,p.dnf.why==="crash"?"c":"o"]); if(p.crashes) cr.push([p.id,p.crashes]); });
  if(fin){ if(dnf.length) rec.dnf=dnf.slice(0,8); if(cr.length) rec.cr=cr.slice(0,10); }
  /* the movers: from the opening lap to the flag (finishers), the three biggest gains and two biggest losses of 5 places or more */
  var mv=[];
  order.forEach(function(id,p){ var s=seatOf(R,id); if(R.r[s].dnf||!s1[s]) return; mv.push([id,s1[s],p+1]); });
  var up=mv.filter(function(x){ return x[1]-x[2]>=5; }).sort(function(a,b){ return (b[1]-b[2])-(a[1]-a[2]); }).slice(0,3);
  var dn=mv.filter(function(x){ return x[2]-x[1]>=5; }).sort(function(a,b){ return (b[2]-b[1])-(a[2]-a[1]); }).slice(0,2);
  if(fin&&(up.length||dn.length)) rec.mv=up.concat(dn);
  /* the battles: two riders side by side at the line (same lap, within 1.0 s, places 1..10) for 3 laps running or more; the longest three */
  if(fin){
    var run={}, longest={};
    for(k=1;k<=L;k++){ var lo2=lineOrder(R,k), now={};
      for(i=1;i<lo2.length&&i<10;i++){ var a=lo2[i-1], b=lo2[i]; if(b[1]-a[1]<=1000){ var key=Math.min(a[0],b[0])+"|"+Math.max(a[0],b[0]); now[key]=(run[key]|0)+1; if(!longest[key]||now[key]>longest[key]) longest[key]=now[key]; } }
      run=now; }
    var bt=[]; for(var key2 in longest) if(longest[key2]>=3){ var pr=key2.split("|"), sa=+pr[0], sb=+pr[1], ia=R.r[sa].id, ib=R.r[sb].id; bt.push([ia,ib,longest[key2],order.indexOf(ia)<order.indexOf(ib)?1:0]); }
    bt.sort(function(x,y){ return y[2]-x[2]; }); if(bt.length) rec.bt=bt.slice(0,3);
  }
  /* the people: place, lap-1 place, best place at the line, laps led, crashes, DNF */
  hin.forEach(function(id){ var s=seatOf(R,id); (rec.hu=rec.hu||{})[id]=[order.indexOf(id)+1,s1[s]|0,best[s]|0,led[s]|0,R.r[s].crashes|0,R.r[s].dnf?(R.r[s].dnf.why==="crash"?1:2):0]; });
  return rec;
}
function race(G,R,rd){
  if(!G||!R||!rd||!G.results) return;
  sync(G,G.results.length);
  var j=G.jr; if(!j.cur||j.cur.ri!==G.ri) j.cur={ri:G.ri,races:[]};
  var rec=null; try{ rec=raceRec(G,R,rd); }catch(e){ rec=null; }
  if(!rec) return;
  j.cur.races=j.cur.races.filter(function(x){ return x.k!==rec.k; });   /* a derived record of this race (a repair before it) gives way to the full one */
  j.cur.races.push(rec);
}

/* ---------------- a round ---------------- */
function qualPath(RG,h){
  if(!RG) return null;
  if(RG.fin&&RG.fin.indexOf(h)>=0){ var e=(RG.main||[]).filter(function(x){ return x.id===h; })[0]; if(!e||e.s<0) return "seed"; var st=RG.st&&RG.st[e.s]; return st?st.kind:"seed"; }
  return "out";
}
function table(L,hum){ var out=[]; L.forEach(function(x,i){ if(i<10||hum.indexOf(x.id)>=0) out.push([x.id,x.place,x.pts]); }); return out; }
function round(G){
  if(!G||!G.results||!G.results.length) return;
  var res=G.results[G.results.length-1], RG=G.round;
  sync(G,G.results.length-1);
  var j=G.jr, cal=G.cal[res.ri]||{}, cur=j.cur&&j.cur.ri===res.ri?j.cur.races:[];
  var rr={ri:res.ri,n:res.n,c:res.city||null,v:res.venue||null,d:res.date||null,t:res.title?1:0,w:res.winner,p:res.cls.slice(0,3),top:res.cls.slice(0,10)};
  if(cal.mult>1) rr.m=cal.mult; if(res.tc) rr.tc=1;
  rr.fk=RG&&RG.F&&RG.F.finals?RG.F.finals.kind:null;
  /* the finals recorded live (or simmed); a final the journal missed (a repair mid-round) is derived from the results */
  var fins=(res.races||[]).filter(function(x){ return isFinalKey(x.key); });
  rr.fin=fins.map(function(x){ var f=cur.filter(function(y){ return y.k===x.key; })[0]; return f||derivedRace(x,G.humans); });
  rr.q=cur.filter(function(x){ return !isFinalKey(x.k); });
  rr.hq={}; (G.humans||[]).forEach(function(h){ rr.hq[h]=qualPath(RG,h); });
  var L=SN().standings(G); rr.tb=table(L,G.humans||[]); rr.red=L.length&&L[0].pts>0?L[0].id:null;
  j.r.push(rr); j.cur=null; cap(j);
}
/* the size cap: the older rounds keep the story (winner, podium, the people, the table) and lose the details first */
function cap(j){
  var n=JSON.stringify(j).length; if(n<=MAXB) return n;
  for(var i=0;i<j.r.length-KEEPFULL&&n>MAXB;i++){ if(j.r[i].lite) continue; j.r[i].fin.forEach(function(x){ delete x.bt; delete x.mv; delete x.cr; delete x.s1; delete x.fl; delete x.ldr; }); j.r[i].q=[]; j.r[i].lite=1; n=JSON.stringify(j).length; }
  return n;
}

/* ---------------- an old save: the journal from G.results (exact standings by replaying the rounds; no race details) ---------------- */
function shadowStand(G,k){
  var sh={results:G.results.slice(0,k+1),riders:G.riders,humans:G.humans,pts:{},st:{},base:G.base||{}}, id;
  for(id in sh.base) sh.pts[id]=sh.base[id];
  function st(id){ return sh.st[id]||(sh.st[id]={races:0,finals:0,wins:0,hs:0,hsAll:0,pod:0,best:0,rounds:0,pl:{}}); }
  sh.results.forEach(function(res){
    var F=G.formats[res.fmt]||{}, fin=(res.races||[]).filter(function(x){ return isFinalKey(x.key); });
    res.cls.forEach(function(id,p){ var s=st(id); s.rounds++;
      if(res.pts&&res.pts[id]) sh.pts[id]=(sh.pts[id]||0)+res.pts[id];
      if(res.wins&&res.wins[id]) s.wins+=res.wins[id];
      var pl=F.pointsOn==="race"?fin.map(function(x){ return x.res?x.res.indexOf(id)+1:0; }).filter(function(v){ return v>0; }):(fin.length&&fin.every(function(x){ return x.res&&x.res.indexOf(id)>=0; })?[p+1]:[]);
      pl.forEach(function(v){ s.pl[v]=(s.pl[v]||0)+1; });
      if(p<3&&(res.main||[]).indexOf(id)>=0) s.pod++; });
  });
  return SN().standings(sh);
}
function derivedRace(x,hum){
  var rec={k:x.key,kind:x.kind,w:x.res?x.res[0]:null,o:x.res?x.res.slice(0,10):[],d:1}; if(x.hs!=null) rec.hs=x.hs;
  (hum||[]).forEach(function(h){ var p=x.res?x.res.indexOf(h):-1; if(p>=0) (rec.hu=rec.hu||{})[h]=[p+1,0,0,0,0,0]; });
  return rec;
}
function derivedRound(G,res,k){
  var hum=G.humans||[];
  var fin=(res.races||[]).filter(function(x){ return isFinalKey(x.key); }).map(function(x){ return derivedRace(x,hum); });
  var q=(res.races||[]).filter(function(x){ return !isFinalKey(x.key)&&x.res&&hum.some(function(h){ return x.res.indexOf(h)>=0; }); }).map(function(x){ var d=derivedRace(x,hum); d.o=d.o.slice(0,3); return d; });
  var L=shadowStand(G,k);
  var rr={ri:res.ri,n:res.n,c:res.city||null,v:res.venue||null,d:res.date||null,t:res.title?1:0,w:res.winner,p:res.cls.slice(0,3),top:res.cls.slice(0,10),fin:fin,q:q,hq:{},tb:table(L,hum),red:L.length&&L[0].pts>0?L[0].id:null,dv:1};
  var cal=G.cal[res.ri]||{}; if(cal.mult>1) rr.m=cal.mult; if(res.tc) rr.tc=1;
  return rr;
}
/* the journal for the first n scored rounds: a recorded round (same ri, same winner) is kept, a missing one derived; the round under way is kept */
function sync(G,n){
  if(!G||!G.results) return;
  var j=G.jr;
  if(ok(G)&&j.r.length===n&&j.r.every(function(x,i){ var res=G.results[i]; return res&&x.ri===res.ri&&x.w===res.winner; })) return;
  var nj=create(G); if(j&&j.id) nj.id=j.id;
  for(var k=0;k<n&&k<G.results.length;k++){
    var res=G.results[k], old=j&&j.r?j.r.filter(function(x){ return x&&x.ri===res.ri&&x.w===res.winner&&!x.dv; })[0]:null;
    nj.r.push(old||derivedRound(G,res,k));
  }
  if(j&&j.cur&&j.cur.ri===G.ri) nj.cur=j.cur;
  G.jr=nj; cap(nj);
}
function upgrade(G){
  if(!G||!G.results) return G;
  var j=G.jr, had=ok(G)&&j.r.length===G.results.length&&j.r.every(function(x,i){ return x.ri===G.results[i].ri&&x.w===G.results[i].winner; });
  if(!had) sync(G,G.results.length);
  j=G.jr;
  /* the round under way at load time: its races that have results (derived) */
  var hum=G.humans||[];
  if(G.round&&!(j.cur&&j.cur.ri===G.round.ri)){
    j.cur={ri:G.round.ri,races:G.round.races.filter(function(x){ return x.res&&(x.st<0||hum.some(function(h){ return x.res.indexOf(h)>=0; })); }).map(function(x){ var d=derivedRace(x,hum); if(x.st>=0) d.o=d.o.slice(0,3); return d; })};
  }
  if(!G.round&&j.cur) j.cur=null;
  return G;
}
function check(G){
  var err=[], j=G&&G.jr; if(!j) return ["no journal"];
  if(j.v!==VER) err.push("version "+j.v);
  if(!j.r||j.r.length!==G.results.length) err.push("rounds "+(j.r?j.r.length:"-")+" != results "+G.results.length);
  (j.r||[]).forEach(function(x,i){ var res=G.results[i]; if(!res) return; if(x.ri!==res.ri) err.push("ri "+i); if(x.w!==res.winner) err.push("winner "+i); if(!x.tb||!x.tb.length) err.push("table "+i); });
  if(JSON.stringify(j).length>MAXB) err.push("size "+JSON.stringify(j).length);
  return err;
}

/* ---------------- the career book: the people's seasons on this device ---------------- */
var STORE=null, lastSig=null;
function store(){ if(STORE) return STORE; try{ return g.localStorage||null; }catch(e){ return null; } }
function setStore(s){ STORE=s||null; lastSig=null; }
function normName(n){ return String(n||"").replace(/\s+/g," ").trim().toLowerCase(); }
function hid(s){ var h=0x811c9dc5; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return h.toString(36); }
function pack(x){ if(Array.isArray(x)) return x; var n=x.n|0, a=[hid(x.id),String(x.sid||""),+x.year||0,x.rounds|0,x.wins|0,x.pod|0,x.best|0,x.over&&n>=1&&(x.rounds|0)>=n?1:0], pre=String(x.sid||"").split("-")[0]; if(x.series&&x.series!==pre) a.push(String(x.series)); return a; }
function unpack(a){ if(!Array.isArray(a)) return a&&typeof a==="object"?JSON.parse(JSON.stringify(a)):null; var full=a[7]===1; return {id:a[0],sid:a[1],series:a[8]||String(a[1]||"").split("-")[0],year:a[2],rounds:a[3],n:full?a[3]:0,wins:a[4],pod:a[5],best:a[6],over:full?1:0}; }
function readBook(st){
  var b={v:2,p:{}};
  try{ var x=JSON.parse(st.getItem(BOOKKEY)||"null"); if(x&&(x.v===1||x.v===2)&&x.p&&typeof x.p==="object"){
    var own=function(k){ return Object.prototype.hasOwnProperty.call(x.p,k); }, ord=Array.isArray(x.o)?x.o.filter(own):[];
    Object.keys(x.p).forEach(function(k){ if(ord.indexOf(k)<0) ord.push(k); });
    ord.forEach(function(k){ if(Array.isArray(x.p[k])) b.p[k]=x.p[k].filter(function(r){ return r&&typeof r==="object"; }).map(pack); }); } }catch(e){}
  return b;
}
/* one person's season so far: rounds raced, wins, round podiums, the best round place in the finals, top tens; the championship place (never spoken) */
function seasonRec(G,h){
  var R=G.riders[h], rec={id:G.jr.id,sid:G.sid,series:G.series,year:G.year,name:String(R.name||""),rounds:0,n:G.cal.length,wins:0,pod:0,best:0,top10:0,over:G.over?1:0};
  (G.results||[]).forEach(function(res){ rec.rounds++; var p=res.cls.indexOf(h)+1, inMain=(res.main||[]).indexOf(h)>=0;
    if(res.winner===h) rec.wins++; if(inMain&&p>=1&&p<=3) rec.pod++; if(inMain&&p>=1&&(!rec.best||p<rec.best)) rec.best=p; if(inMain&&p>=1&&p<=10) rec.top10++; });
  if(G.over){ try{ var L=SN().standings(G); for(var i=0;i<L.length;i++) if(L[i].id===h){ rec.pl=L[i].place; break; } }catch(e){} }
  return rec;
}
function keep(G,st){
  try{
    st=st||store(); if(!st||!G||!G.jr||!G.jr.id||!G.humans||!G.humans.length||!G.results) return false;
    var sig=G.jr.id+"|"+G.results.length+"|"+(G.over?1:0)+"|"+G.humans.length; if(lastSig===sig) return false;
    var book=readBook(st);
    G.humans.forEach(function(h){ var R=G.riders[h]; if(!R) return; var k=normName(R.name); if(!k) return;
      var list=book.p[k]||[], rec=pack(seasonRec(G,h)), at=-1;
      for(var i=0;i<list.length;i++) if(list[i][0]===rec[0]){ at=i; break; }
      if(at>=0) list.splice(at,1); list.push(rec); while(list.length>BOOKSEASONS) list.shift();
      delete book.p[k]; book.p[k]=list; });   /* kept last: the most recent */
    var ks=Object.keys(book.p); while(ks.length>BOOKPEOPLE) delete book.p[ks.shift()];
    st.setItem(BOOKKEY,JSON.stringify(book)); lastSig=sig; return true;
  }catch(e){ return false; }
}
/* a person's seasons in the book (copies), or [] */
function career(st,name){
  try{ st=st||store(); if(!st) return []; var b=readBook(st), list=b.p[normName(name)]; return Array.isArray(list)?list.map(unpack).filter(Boolean):[]; }catch(e){ return []; }
}
MX.Journal={VER:VER,MAXB:MAXB,BOOKKEY:BOOKKEY,create:create,race:race,round:round,upgrade:upgrade,sync:sync,check:check,shadowStand:shadowStand,lineOrder:lineOrder,derivedRound:derivedRound,
  keep:keep,career:career,setStore:setStore,normName:normName,seasonRec:seasonRec,hid:hid};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Journal;
})(typeof window!=="undefined"?window:globalThis);
