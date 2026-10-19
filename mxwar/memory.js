/* MOTOCROSS WAR — the booth's BRAIN (mxann4; the CEO, 2026-10-19: "They should have their own brain and be ever learning as the season goes on.
   Everything must be balanced though ... just make it sound like a normal announcer on TV throughout the season"). Opinions that move with the
   evidence: this season's results (G.results) and the season journal (G.jr, mxwar/journal.js), plus the history book's EARLIER seasons and the
   person's earlier seasons on this device (the career book) through env. Never the season file's real results for this season (rule M1).
   Pure, no DOM, no random draw, ES5: the same journal gives the same opinions after a reload. Node: module.exports = MXWar.Memory.
   The plan: BG_audit/sprint/mxann4/design/MEMORY-PLAN.md section 4.
     env = {book(id) -> {pos: last season's championship place, defending: bool} | null (seasons over before the round), career(name) -> [seasons]}
     led = what the booth SAID (announce.js A.mem): {picks:{ri:{id}}, told:{key:{ver, ri}}, views:{id:{v, ri}}, lead:{ri:kind}, youV:{hid:{v, ri}},
           careerMile:{hid:ri}, patternAt}
     Memory.form(G, id, ri, env)               {r 0..1, n, list}  an EWMA (alpha 0.45) of each round's place as a share of the winner's points
     Memory.stories(G, ri, env, led)           the storylines coming into round ri, best first
     Memory.lead / second (G, ri, env, led, said)  the opening's lead story (Hutch) and second story (Wes), by the selection rules
     Memory.wrap(G, ri, env, led)              the storylines round ri (scored) created or changed
     Memory.notes(G, ri, id, env, led)         what the booth knows about one rider coming into round ri (the in-race context line)
     Memory.arc(G, ri, hid) / youNotes(G, ri, hid) / heatNote(G, ri, id)   the person's arc; the person's notes; a rider's race earlier in round ri
     Memory.pick(G, ri, ids, env, led)         the analyst's pick among the finalists ids;  Memory.grade(G, ri, id): how it did
     Memory.records(G, upto) / rivals(G, upto) / weights(G, ri, env) / career(G, hid, env)
   A story: {kind, key, ver, score, needs "results" | "details", v (its variant: the one tag every template of it carries), tags [...],
   d {slot: raw value} (a rider id for a name slot, a number for an ordinal or a count, a city for a place slot), claims [{k, v}] (what it states,
   in a form memcheck.js recomputes from G.results / G.jr / the career book), ids [the riders it is about], you (a person's id)}. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Memory) return;
var A0=0.45, DEF_T=[25,22,20,18,16,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1];
function req(p){ try{ return typeof require==="function"?require(p):null; }catch(e){ return null; } }
function SN(){ return MX.Season||req("./season.js"); }

/* ---------------- the season so far ---------------- */
function resAt(G,r){ var L=G.results||[]; for(var i=0;i<L.length;i++) if(L[i].ri===r) return L[i]; return null; }
function before(G,ri){ var out=[]; (G.results||[]).forEach(function(x){ if(x.ri<ri) out.push(x); }); return out; }
function upto(G,ri){ var out=[]; (G.results||[]).forEach(function(x){ if(x.ri<=ri) out.push(x); }); return out; }
function jrAt(G,r){ var j=G.jr; if(!j||!j.r) return null; for(var i=0;i<j.r.length;i++) if(j.r[i].ri===r) return j.r[i]; return null; }
function place(x,id){ return x?x.cls.indexOf(id)+1:0; }
function inMain(x,id){ return !!x&&(x.main||[]).indexOf(id)>=0; }
function fplace(x,id){ return inMain(x,id)?place(x,id):0; }                  /* a finals place; 0 = no final (the arc counts finals results only) */
function fmtOf(G,x){ return (G.formats&&(G.formats[x.fmt]||G.formats[G.fmt]))||{}; }
function tableOf(G,x){ var F=fmtOf(G,x); return F.table&&F.table.length?F.table:DEF_T; }
function finalsOf(x){ return (x&&x.races||[]).filter(function(r){ return /^final-/.test(r.key); }); }
function oneFinal(jx){ return jx&&jx.fin&&jx.fin.length===1?jx.fin[0]:null; }
function detailed(jx,f){ return !!(jx&&!jx.dv&&!jx.lite&&f&&!f.d&&!f.nt&&f.how); }
function tbOf(G,r){ var jx=jrAt(G,r); return jx&&jx.tb?jx.tb:null; }
function tbRow(tb,id){ if(!tb) return null; for(var i=0;i<tb.length;i++) if(tb[i][0]===id) return tb[i]; return null; }
function ptsAfter(G,r,id){ var p=(G.base&&G.base[id])||0; (G.results||[]).forEach(function(x){ if(x.ri<=r&&x.pts&&x.pts[id]) p+=x.pts[id]; }); return p; }
function winsBefore(G,id,ri){ var n=0; (G.results||[]).forEach(function(x){ if(x.ri<ri&&x.winner===id) n++; }); return n; }
function podsBefore(G,id,ri){ var n=0; (G.results||[]).forEach(function(x){ var p=fplace(x,id); if(x.ri<ri&&p>=1&&p<=3) n++; }); return n; }
function rider(G,id){ return G.riders&&G.riders[id]||null; }
function isHuman(G,id){ var R=rider(G,id); return !!(R&&R.kind==="human"); }
function cityKey(c){ return String(c||"").replace(/\s*,.*$/,"").trim().toLowerCase(); }
function daysBetween(a,b){ var x=Date.parse(String(a||"")+"T12:00:00Z"), y=Date.parse(String(b||"")+"T12:00:00Z"); return isFinite(x)&&isFinite(y)?Math.round((y-x)/86400000):null; }
/* the most points one round can pay (a title round): the table's first place x the races that pay x the multiplier */
function maxRound(G,ri){
  var cal=G.cal&&G.cal[ri]; if(!cal||!cal.title) return 0;
  var F=null; try{ F=SN().calFormat(G,cal); }catch(e){ F=null; } F=F||G.formats[G.fmt]||{};
  var T=F.table&&F.table.length?F.table:DEF_T, n=F.pointsOn==="race"&&F.finals?F.finals.races:1; return (T[0]||25)*n*(cal.mult||1);
}
/* consecutive rounds ending at round r (inclusive) where id won the round / finished on the podium / in the top five (finals places) */
function streak(G,id,r,kind){
  var n=0; for(var k=r;k>=0;k--){ var x=resAt(G,k); if(!x) break; var p=fplace(x,id), hit=kind==="win"?x.winner===id:kind==="pod"?(p>=1&&p<=3):(p>=1&&p<=5); if(hit) n++; else break; } return n;
}
function crashedOut(G,r,id){ var jx=jrAt(G,r); if(!jx||jx.dv) return false; return jx.fin.some(function(f){ return !f.d&&(f.dnf||[]).some(function(d){ return d[0]===id&&d[2]==="c"; }); }); }
/* the per-round cache (the key: the season, its results and its journal; the base opinions never change inside it) */
var CACHE={k:null,m:{}};
function cached(G,ri,name,fn){ var k=(G.jr&&G.jr.id||G.sid||"")+"|"+((G.results||[]).length)+"|"+((G.jr&&G.jr.r)?G.jr.r.length:0); if(CACHE.k!==k){ CACHE={k:k,m:{}}; } var key=name+"@"+ri; if(!(key in CACHE.m)) CACHE.m[key]=fn(); return CACHE.m[key]; }

/* ---------------- form ---------------- */
function score1(G,x,id){ var p=place(x,id); if(p<=0) return null; var T=tableOf(G,x); return (T[p-1]||0)/(T[0]||1); }
function prior(b){ if(!b||!b.pos) return null; return b.pos===1?0.8:b.pos<=3?0.65:b.pos<=10?0.45:0.25; }
function form(G,id,ri,env){
  var rt=prior(env&&env.book?env.book(id):null), n=0, list=[];
  before(G,ri).forEach(function(x){ var s=score1(G,x,id); if(s==null) return; n++; list.push(fplace(x,id)); rt=rt==null?s:A0*s+(1-A0)*rt; });
  return {r:rt==null?0.2:rt,n:n,list:list};
}
/* the pick's form: the EWMA with the last two rounds counted twice */
function pickForm(G,id,ri,env){
  var f=form(G,id,ri,env), L=before(G,ri), last=[]; for(var i=L.length-1;i>=0&&last.length<2;i--){ var s=score1(G,L[i],id); if(s!=null) last.push(s); }
  if(!last.length) return f.r; var m=last.reduce(function(a,b){ return a+b; },0)/last.length; return 0.5*f.r+0.5*m;
}

/* ---------------- records and rivals ---------------- */
/* this season's records through round r: the biggest winning margin (5 s and more), the deepest lap-1 place a winner came from (5th and back),
   the most holeshots and the most wins (3 and more, no tie) */
function records(G,r){
  return cached(G,r,"rec",function(){
    var out={}, hs={}, wins={};
    upto(G,r).forEach(function(x){
      var jx=jrAt(G,x.ri);
      if(x.winner) wins[x.winner]=(wins[x.winner]||0)+1;
      finalsOf(x).forEach(function(f){ if(f.hs!=null) hs[f.hs]=(hs[f.hs]||0)+1; });
      if(!jx||jx.dv||jx.lite) return;
      jx.fin.forEach(function(f){ if(f.d||f.nt||!f.how) return;
        if(f.how.m!=null&&f.how.m>=5&&(!out.margin||f.how.m>out.margin.v)) out.margin={id:f.w,v:f.how.m,ri:x.ri,k:f.k};
        if(f.how.s1>=5&&(!out.from||f.how.s1>out.from.v)) out.from={id:f.w,v:f.how.s1,ri:x.ri,k:f.k}; });
    });
    function top(m,kind){ var best=null, tie=false; for(var id in m){ if(!best||m[id]>best.v){ best={id:id,v:m[id]}; tie=false; } else if(m[id]===best.v) tie=true; } if(best&&!tie&&best.v>=3) out[kind]=best; }
    top(hs,"hs"); top(wins,"wins");
    return out;
  });
}
/* pairs side by side (next to each other) in the top five of a round, or in a recorded battle of 3+ laps at the line in a final, at two rounds or
   more: [{a, b, n, last (the latest round), ahead {id: rounds finished ahead}}] (a < b by id) */
function rivals(G,r){
  return cached(G,r,"riv",function(){
    var m={};
    function meet(a,b,ri){ if(a===b) return; var k=a<b?a+"|"+b:b+"|"+a, e=m[k]||(m[k]={a:a<b?a:b,b:a<b?b:a,n:0,rs:{},last:-1,ahead:{}}); if(e.rs[ri]) return; e.rs[ri]=1; e.n++; if(ri>e.last) e.last=ri; }
    upto(G,r).forEach(function(x){
      var top=x.cls.filter(function(id){ return inMain(x,id); }).slice(0,5);
      for(var i=1;i<top.length;i++) meet(top[i-1],top[i],x.ri);
      var jx=jrAt(G,x.ri); if(jx&&!jx.dv&&!jx.lite) jx.fin.forEach(function(f){ (f.bt||[]).forEach(function(b){ meet(b[0],b[1],x.ri); }); });
    });
    var out=[]; for(var k in m){ var e=m[k]; if(e.n<2) continue;
      for(var ri in e.rs){ var x=resAt(G,+ri), pa=place(x,e.a), pb=place(x,e.b); if(pa&&pb){ var w=pa<pb?e.a:e.b; e.ahead[w]=(e.ahead[w]||0)+1; } }
      delete e.rs; out.push(e); }
    out.sort(function(p,q){ return q.n-p.n||q.last-p.last||(p.a+p.b<q.a+q.b?-1:1); });
    return out;
  });
}
/* the person's rival: the rider who finished directly ahead of him (finals places) most often, at two rounds or more */
function rivalFor(G,r,hid){
  var cnt={}; upto(G,r).forEach(function(x){ var p=fplace(x,hid); if(p>=2){ var a=x.cls[p-2]; if(a&&inMain(x,a)&&!isHuman(G,a)) cnt[a]=(cnt[a]||0)+1; } });
  var best=null, tie=false; for(var id in cnt){ if(!best||cnt[id]>best.n){ best={id:id,n:cnt[id]}; tie=false; } else if(cnt[id]===best.n) tie=true; }
  return best&&best.n>=2&&!tie?best:null;
}

/* ---------------- the pick model learns (form against the points table, 0.3 .. 0.7) ---------------- */
function formPick(G,x,env){ var fin=(x.main&&x.main.length?x.main:x.cls.slice(0,20)), pf=null, bf=-1; fin.forEach(function(id){ var f=form(G,id,x.ri,env).r; if(f>bf+1e-12||(Math.abs(f-bf)<=1e-12&&id<pf)){ bf=f; pf=id; } }); return pf; }
function pointsPick(G,x){ var fin=(x.main&&x.main.length?x.main:x.cls.slice(0,20)), pp=null, bp=-1; fin.forEach(function(id){ var p=ptsAfter(G,x.ri-1,id); if(p>bp||(p===bp&&id<pp)){ bp=p; pp=id; } }); return pp; }
function weights(G,ri,env){
  return cached(G,ri,"wf",function(){
    var wf=0.5;
    before(G,ri).forEach(function(x){ if(x.ri<1||!x.title) return;
      var pf=formPick(G,x,env), pp=pointsPick(G,x);
      if(pf===x.winner&&pp!==x.winner) wf=Math.min(0.7,wf+0.1); else if(pp===x.winner&&pf!==x.winner) wf=Math.max(0.3,wf-0.1);
      wf=Math.round(wf*10)/10; });
    return wf;
  });
}
/* how often the form-alone pick won in the last k title rounds (the pattern story's claim) */
function formHits(G,ri,env,k){
  var L=before(G,ri).filter(function(x){ return x.ri>=1&&x.title; }).slice(-k), n=0;
  L.forEach(function(x){ if(formPick(G,x,env)===x.winner) n++; });
  return {n:n,of:L.length};
}

/* ---------------- a story ---------------- */
function S(kind,key,ver,score,v,d,claims,o){ var s={kind:kind,key:key,ver:String(ver),score:score,v:v,tags:v?[kind,v]:[kind],d:d||{},claims:claims||[],ids:[],needs:"results"}; if(o) for(var k in o) if(o[k]!==undefined) s[k]=o[k]; return s; }
function C(k,v){ return {k:k,v:v}; }
/* the last round's winner and HOW: one variant (the most telling); a first win of the season and "last week" are variants of their own */
function howOf(G,r,jx){
  var x=resAt(G,r), f=oneFinal(jx); if(!x||!detailed(jx,f)) return null; var w=x.winner, how=f.how, out=[];
  if(f.w!==w) return null;
  if(how.ll) out.push({v:"llpass",claims:[C("ll|"+r+"|"+f.k,1)]});
  if(how.s1>=6) out.push({v:"fromback",d:{fromPlace:how.s1},claims:[C("s1|"+r+"|"+f.k+"|"+w,how.s1)]});
  var wc=(f.cr||[]).filter(function(c){ return c[0]===w; })[0]; if(wc) out.push({v:"crashwin",claims:[C("crash|"+r+"|"+f.k+"|"+w,wc[1])]});
  if(f.hs===w&&how.wire) out.push({v:"hswire",claims:[C("hs|"+r+"|"+f.k,w),C("wire|"+r+"|"+f.k,1)]});
  if(how.m!=null&&how.m>=8) out.push({v:"bigmargin",d:{marginS:how.m},claims:[C("margin|"+r+"|"+f.k,how.m)]});
  else if(how.m!=null&&how.m>0&&how.m<1) out.push({v:"photo",d:{marginS:how.m},claims:[C("margin|"+r+"|"+f.k,how.m)]});
  return out.length?out:null;
}
function lastwinStory(G,R){
  var r=R-1, x=resAt(G,r); if(!x||!x.winner) return null;
  var w=x.winner, jx=jrAt(G,r), hw=howOf(G,r,jx), fw=r>=2&&winsBefore(G,w,r)===0&&!isHuman(G,w), gap=null, multi=finalsOf(x).length>1;
  var calR=G.cal[R]; if(calR&&calR.date&&x.date){ gap=daysBetween(x.date,calR.date); }
  var base=[C("win|"+r,w),C("city|"+r,x.city),C("lastround|"+R,r)], d={last:w,lastCity:x.city}, v=null, sc=0.6, extra=[], needs="results";
  if(hw&&!multi&&(hw[0].v==="llpass"||hw[0].v==="fromback"||hw[0].v==="crashwin"||!fw)){ v=hw[0].v; extra=hw[0].claims; if(hw[0].d) for(var k in hw[0].d) d[k]=hw[0].d[k]; sc=0.75; needs="details"; }
  else if(fw){ v="firstwin"; extra=[C("wins|"+w+"|"+r,0)]; sc=0.7; }
  else if(multi&&finalsOf(x).every(function(f){ return f.res&&f.res[0]===w; })){ v="sweep"; extra=finalsOf(x).map(function(f){ return C("rwin|"+r+"|"+f.key,w); }); sc=0.75; }
  else if(gap!=null&&gap>=5&&gap<=9){ v="lastweek"; extra=[C("daygap|"+R,gap)]; }
  var s=S("lastwin","lastwin|"+r,"1",sc,v,d,base.concat(extra),{ids:[w],needs:needs});
  if(isHuman(G,w)) s.you=w;
  return s;
}

/* ---------------- the storylines coming into round R ---------------- */
function stories(G,R,env,led){
  var base=cached(G,R,"stories",function(){ return storiesBase(G,R,env); });
  var out=base.slice();
  (G.humans||[]).forEach(function(h){ var y=youStory(G,R,h,env,led); if(y) out.push(y); var cr=careerStory(G,R,h,env); if(cr) out.push(cr); });
  out=out.concat(mindStories(G,R,led));
  var pt=patternStory(G,R,env,led); if(pt) out.push(pt);
  out.forEach(function(s){ if(s.tags.indexOf("early")<0&&s.tags.indexOf("firm")<0){ if(R<=2) s.tags.push("early"); else if(R>=4) s.tags.push("firm"); } });
  out.sort(function(a,b){ return b.score-a.score||(a.key<b.key?-1:1); });
  return out;
}
function storiesBase(G,R,env){
  var out=[], last=resAt(G,R-1); if(!last) return out;
  var r=R-1, tb=tbOf(G,r), tb0=R>=2?tbOf(G,R-2):null, n=G.cal.length, late=R>=Math.ceil(n*2/3), left=n-R, cal=G.cal[R]||{};
  /* 1 the title fight (the table after the last round) */
  if(tb&&tb.length>=2&&tb[0][2]>0){
    var red=tb[0][0], sec=tb[1][0], gap=tb[0][2]-tb[1][2], mr=maxRound(G,R), close=mr>0&&gap<=mr, three=!!(tb[2]&&mr>0&&tb[2][2]>0&&gap>0&&tb[0][2]-tb[2][2]<=mr), lastTwo=R>=n-2;
    var v=gap===0?"tie":three?"threeway":close?"close":"wide", sc=0.4+(close?0.15:0)+(late?0.15:0)+(three?0.1:0); if(lastTwo&&close) sc=0.95;
    var cl=[C("red|"+r,red),C("ptsgap|"+red+"|"+sec+"|"+r,gap),C("ptsplace|"+sec+"|"+r,2)], d={red:red,second:sec,leadN:gap};
    if(v==="threeway"){ d.third=tb[2][0]; cl.push(C("ptsplace|"+tb[2][0]+"|"+r,3),C("ptsgap|"+red+"|"+tb[2][0]+"|"+r,tb[0][2]-tb[2][2])); }
    if(v==="close"||v==="wide"||v==="threeway") cl.push(C("maxpts|"+R,mr));
    var st=S("title","title",red+"|"+sec+"|"+Math.floor(gap/5)+(v==="threeway"?"|3":""),sc,v,d,cl,{ids:[red,sec]});
    if(left>=1&&left<=4&&v!=="tie"){ st.tags.push("fewleft"); st.d.roundsN=left; st.claims.push(C("left|"+R,left)); }
    if(isHuman(G,red)) st.you=red; else if(isHuman(G,sec)) st.you=sec;
    out.push(st);
    /* 2 a new points leader at the last round */
    if(tb0&&tb0.length&&tb0[0][2]>0&&tb0[0][0]!==red){ var old=tb0[0][0];
      out.push(S("newred","newred|"+r,"1",0.85,"newleader",{red:red,oldLast:old,lastCity:last.city},[C("red|"+r,red),C("red|"+(R-2),old),C("city|"+r,last.city),C("lastround|"+R,r)],{ids:[red,old],you:isHuman(G,red)?red:isHuman(G,old)?old:undefined})); }
    /* 3 the same leader three rounds or more */
    var k=0; for(var q=r;q>=0;q--){ var t=tbOf(G,q); if(t&&t[0]&&t[0][0]===red&&t[0][2]>0) k++; else break; }
    if(k>=3) out.push(S("redrun","redrun|"+red,k,0.6+0.05*Math.min(4,k-3),"redrun",{red:red,rowN:k},[C("redrun|"+red+"|"+r,k)],{ids:[red],you:isHuman(G,red)?red:undefined}));
  }
  /* 4 the last winner and how */
  var lw=lastwinStory(G,R); if(lw) out.push(lw);
  /* 5 streaks: wins 2+, podiums 3+, top fives 4+ (the top ten of the table, and the last winner) */
  var seen={}, pool=(tb||[]).slice(0,10).map(function(x){ return x[0]; }); if(last.winner&&pool.indexOf(last.winner)<0) pool.push(last.winner);
  pool.forEach(function(id){ if(seen[id]) return; seen[id]=1;
    var ws=streak(G,id,r,"win"), ps=streak(G,id,r,"pod"), fs=streak(G,id,r,"top5"), you=isHuman(G,id)?id:undefined;
    if(ws>=2) out.push(S("streak","streak|win|"+id,ws,ws>=3?1:0.85,"winrun",{last:id,rowN:ws},[C("streak|win|"+id+"|"+r,ws)],{ids:[id],you:you}));
    else if(ps>=3) out.push(S("streak","streak|pod|"+id,ps,0.7,"podrun",{last:id,rowN:ps},[C("streak|pod|"+id+"|"+r,ps)],{ids:[id],you:you}));
    else if(fs>=4) out.push(S("streak","streak|top5|"+id,fs,0.6,"top5run",{last:id,rowN:fs},[C("streak|top5|"+id+"|"+r,fs)],{ids:[id],you:you}));
  });
  /* 6 a slump: a contender (form 0.6+ before the round before last, top ten in the table) outside the top ten at the last two rounds (finals
     places 11-20), or crashed out of the last one */
  if(R>=4&&tb){ var ra=resAt(G,R-2), rb=last;
    tb.slice(0,10).forEach(function(row){ var id=row[0]; if(isHuman(G,id)) return; var f2=form(G,id,R-2,env), pa=fplace(ra,id), pb=fplace(rb,id);
      if(!(f2.n>=2&&f2.r>=0.6)) return;
      if(crashedOut(G,r,id)&&pa>10&&pa<=20) out.push(S("slump","slump|"+id+"|"+r,"1",0.55,"slumpdnf",{last:id,placeA:pa,lastCity:rb.city},[C("place|"+(R-2)+"|"+id,pa),C("dnf|"+r+"|"+id,1),C("city|"+r,rb.city)],{ids:[id],needs:"details",view:"slump"}));
      else if(pa>10&&pa<=20&&pb>10&&pb<=20) out.push(S("slump","slump|"+id+"|"+r,"1",0.55,"slump",{last:id,placeA:pa,placeB:pb},[C("place|"+(R-2)+"|"+id,pa),C("place|"+r+"|"+id,pb)],{ids:[id],view:"slump"}));
    });
  }
  /* 7 crashed out of the last round's final (a top-ten points rider): let's see the answer */
  var lj=jrAt(G,r);
  if(lj&&!lj.dv) lj.fin.forEach(function(f){ if(f.d) return; (f.dnf||[]).forEach(function(dd){ if(dd[2]!=="c") return; var row=tbRow(tb,dd[0]); if(!row||row[1]>10||isHuman(G,dd[0])) return;
    if(out.some(function(s){ return s.key==="bounce|"+dd[0]+"|"+r; })) return;
    out.push(S("bounce","bounce|"+dd[0]+"|"+r,"1",0.65,"bounce",{last:dd[0],lastCity:last.city},[C("dnf|"+r+"|"+dd[0],1),C("city|"+r,last.city),C("lastround|"+R,r)],{ids:[dd[0]],needs:"details"})); }); });
  /* 8 a rivalry: side by side in the top five (or a battle at the line) at two rounds or more, the last of them the last round */
  rivals(G,r).forEach(function(e){ if(e.last!==r||isHuman(G,e.a)||isHuman(G,e.b)) return;
    out.push(S("rival","rival|"+e.a+"|"+e.b,e.n,0.45+0.05*Math.min(6,e.n),"rival",{aLast:e.a,bLast:e.b,timesN:e.n},[C("pair|"+e.a+"|"+e.b+"|"+r,e.n)],{ids:[e.a,e.b]})); });
  /* 9 back at a city raced earlier this season: who won it there */
  var here=before(G,R).filter(function(x){ return cityKey(x.city)===cityKey(cal.city)&&x.winner; }).pop();
  if(here) out.push(S("venue","venue|"+R,"1",0.7,"venue",{last:here.winner,city:here.city},[C("win|"+here.ri,here.winner),C("city|"+here.ri,here.city)],{ids:[here.winner],you:isHuman(G,here.winner)?here.winner:undefined}));
  return out;
}

/* the booth changes its mind: a rider it called struggling (a told slump) who has podiumed since */
function mindStories(G,R,led){
  var out=[], V=led&&led.views; if(!V) return out;
  for(var id in V){ var w=V[id]; if(!w||w.v!=="slump"||w.done||!(w.ri<R)) continue;
    var since=before(G,R).filter(function(x){ return x.ri>=w.ri; }), pods=since.filter(function(x){ var p=fplace(x,id); return p>=1&&p<=3; });
    if(!pods.length) continue;
    var two=since.slice(-2), pl=two.map(function(x){ return fplace(x,id); }); if(pl.some(function(p){ return !p||p>20; })) continue;
    var d={last:id,placeA:pl[0]}, cl=[C("view|"+id,"slump@"+w.ri)].concat(two.map(function(x){ return C("place|"+x.ri+"|"+id,fplace(x,id)); }));
    if(pl.length>=2) d.placeB=pl[1];
    out.push(S("mind","mind|"+id,w.ri,0.6,pl.length>=2?"mind":"mind1",d,cl,{ids:[id]}));
  }
  return out;
}
/* a season that really does run one way: the pick model's weight has moved 0.2 from the middle (the booth tells it at most once in four rounds) */
function patternStory(G,R,env,led){
  if(R<5) return null; var wf=weights(G,R,env); if(Math.abs(wf-0.5)<0.2-1e-9) return null;
  var last=led&&led.patternAt; if(last!=null&&R-last<4) return null;
  var h=formHits(G,R,env,5);
  if(wf>0.5&&h.n>=2) return S("pattern","pattern|"+R,"1",0.4,"formwins",{timesN:h.n,roundsN:h.of},[C("formhits|"+R+"|"+h.of,h.n)]);
  if(wf<0.5&&h.n===0) return S("pattern","pattern|"+R,"1",0.4,"formfails",{roundsN:h.of},[C("formhits|"+R+"|"+h.of,0)]);
  return null;
}

/* ---------------- the person ---------------- */
/* the arc coming into round R: finals places by round (0 = no final), the best (and where), rising, the points place and its change, how the
   last round's final was reached, crashes, the rival */
function arc(G,R,hid){
  return cached(G,R,"arc|"+hid,function(){
    var L=before(G,R), pl=L.map(function(x){ return {ri:x.ri,p:fplace(x,hid),cp:place(x,hid),city:x.city}; }), fin=pl.filter(function(x){ return x.p>0; });
    var a={hid:hid,rounds:pl,n:L.length,finals:fin.length,best:null,last:pl[pl.length-1]||null,rising:false,pts:null,pts0:null,qual:null,crash:false,rival:null,wins:winsBefore(G,hid,R),pods:podsBefore(G,hid,R)};
    fin.forEach(function(x){ if(!a.best||x.p<a.best.p) a.best=x; });
    var t3=pl.slice(-3); a.rising=t3.length===3&&t3.every(function(x){ return x.p>0&&x.p<=20; })&&t3[2].p<t3[1].p&&t3[1].p<t3[0].p;
    var tb=tbOf(G,R-1), tb0=tbOf(G,R-2), row=tbRow(tb,hid), row0=tbRow(tb0,hid); if(row&&row[2]>0) a.pts={place:row[1],pts:row[2]}; if(row0&&row0[2]>0) a.pts0={place:row0[1],pts:row0[2]};
    var jx=jrAt(G,R-1); if(jx&&jx.hq&&jx.hq[hid]) a.qual=jx.hq[hid];
    a.crash=crashedOut(G,R-1,hid);
    a.rival=rivalFor(G,R-1,hid);
    return a;
  });
}
/* the person's story coming into round R: the most telling angle, not the same angle as last round's (unless it is a milestone) */
function youCands(G,R,hid){
  var a=arc(G,R,hid); if(!a.n) return [];
  var last=a.last, r=R-1, out=[];
  function add(v,sc,d,cl){ d.you=hid; out.push({v:v,sc:sc,d:d,cl:cl}); }
  function pc(x){ return x.p>0?C("place|"+x.ri+"|"+hid,x.p):C("main|"+x.ri+"|"+hid,0); }
  if(last&&last.p===1) add("youWon",0.95,{lastCity:last.city},[C("win|"+r,hid),C("city|"+r,last.city),C("lastround|"+R,r)]);
  if(last&&!last.p) add("youNoMain",0.75,{lastCity:last.city},[C("main|"+r+"|"+hid,0),C("city|"+r,last.city),C("lastround|"+R,r)]);
  if(a.crash&&last) add("youCrash",0.8,{lastCity:last.city},[C("dnf|"+r+"|"+hid,1),C("city|"+r,last.city),C("lastround|"+R,r)]);
  if(a.rising){ var t3=a.rounds.slice(-3); add("youUp",0.9,{placeA:t3[0].p,placeB:t3[1].p,placeC:t3[2].p},t3.map(pc)); }
  if(last&&a.best&&last.ri===a.best.ri&&a.finals>=2&&last.p>1&&last.p<=20) add("youBest",0.85,{bestPlace:last.p,bestCity:last.city},[C("place|"+r+"|"+hid,last.p),C("best|"+hid+"|"+r,last.p),C("city|"+r,last.city),C("lastround|"+R,r)]);
  if(a.pts&&a.pts0&&a.pts0.place-a.pts.place>=3&&a.pts.place<=20) add("youPts",0.8,{ptsPlace:a.pts.place,upN:a.pts0.place-a.pts.place},[C("ptsplace|"+hid+"|"+r,a.pts.place),C("ptsplace|"+hid+"|"+(R-2),a.pts0.place)]);
  if(a.qual==="lcq"&&last&&last.p>0&&last.p<=20) add("youLcq",0.8,{lastCity:last.city,lastPlace:last.p},[C("qual|"+r+"|"+hid,"lcq"),C("place|"+r+"|"+hid,last.p),C("city|"+r,last.city)]);
  if(a.wins>=1&&R>=3&&!(last&&last.p===1)) add("youWins",0.8,{winsN:a.wins},[C("wins|"+hid+"|"+R,a.wins)]);
  if(a.rival&&R>=3) add("youRival",0.78,{rivalLast:a.rival.id,timesN:a.rival.n},[C("rival|"+hid+"|"+a.rival.id+"|"+r,a.rival.n)]);
  var two=a.rounds.slice(-2);
  if(two.length===2&&two.every(function(x){ return x.p>0&&x.p<=20; })) add("youArc",0.74,{placeA:two[0].p,cityA:two[0].city,placeB:two[1].p,cityB:two[1].city},two.map(pc).concat([C("city|"+two[0].ri,two[0].city),C("city|"+two[1].ri,two[1].city)]));
  if(a.best&&a.best.p<=20&&!(last&&last.ri===a.best.ri)) add("youBestSoFar",0.72,{bestPlace:a.best.p,bestCity:a.best.city},[C("best|"+hid+"|"+r,a.best.p),C("place|"+a.best.ri+"|"+hid,a.best.p),C("city|"+a.best.ri,a.best.city)]);
  if(last&&last.p>1&&last.p<=20){ if(a.pts&&a.pts.place<=40) add("youLastPts",0.7,{lastPlace:last.p,lastCity:last.city,ptsPlace:a.pts.place},[C("place|"+r+"|"+hid,last.p),C("city|"+r,last.city),C("lastround|"+R,r),C("ptsplace|"+hid+"|"+r,a.pts.place)]);
    else add("youLast",0.7,{lastPlace:last.p,lastCity:last.city},[C("place|"+r+"|"+hid,last.p),C("city|"+r,last.city),C("lastround|"+R,r)]); }
  if(last&&last.p>20) add("youBack",0.7,{lastCity:last.city},[C("place|"+r+"|"+hid,last.p),C("city|"+r,last.city),C("lastround|"+R,r)]);
  out.sort(function(p,q){ return q.sc-p.sc; });
  return out;
}
function youSig(c){ return c.v+":"+c.cl.filter(function(x){ return String(x.k).split("|")[0]!=="lastround"; }).map(function(x){ return String(x.k).replace(/\|\d+$/,"")+"="+x.v; }).join(","); }
function youStory(G,R,hid,env,led){
  var c=youCands(G,R,hid), told=led&&led.youSig&&led.youSig[hid]||{};
  c=c.filter(function(x){ var at=told[youSig(x)]; return !(at!=null&&R-at<=6); });   /* the same facts told in the last six rounds: not again */
  if(!c.length) return null;
  var prev=led&&led.youV&&led.youV[hid], pk=c[0];
  if(prev&&prev.ri===R-1&&prev.v===pk.v&&pk.sc<0.9&&c.length>1) pk=c[1];   /* not the same angle two rounds running */
  var a=arc(G,R,hid), ver=a.rounds.map(function(x){ return x.p; }).join(",");
  var s=S("you","you|"+hid,ver,pk.sc,pk.v,pk.d,pk.cl,{ids:[hid],you:hid}); s.tags.push("you"); s.milestone=pk.sc>=0.85; s.sig=youSig(pk); return s;
}
/* the person's earlier seasons (the career book): years before this season only, never this season, counts only (never a championship place) */
function career(G,hid,env){
  var R=rider(G,hid); if(!R||!env||typeof env.career!=="function") return [];
  var list=[]; try{ list=env.career(R.name)||[]; }catch(e){ list=[]; }
  var id=G.jr&&G.jr.id;
  return list.filter(function(x){ return x&&+x.year<+G.year&&x.id!==id&&x.sid!==G.sid&&(x.rounds|0)>=1; }).sort(function(a,b){ return b.year-a.year||(a.sid<b.sid?-1:1); });
}
var SERN={sx:"Supercross",mx:"Motocross",smx:"SuperMotocross"};
function careerStory(G,R,hid,env){
  var L=career(G,hid,env); if(!L.length) return null;
  var nm=String(rider(G,hid).name||"").toLowerCase(), x=L[0], k=function(f){ return "career|"+nm+"|"+x.sid+"|"+f; }, base=[C("careeryear|"+nm+"|"+x.sid,x.year)];
  var d={you:hid,hyear:x.year,hseries:SERN[x.series]||"Supercross"}, v, cl;
  if(L.length>=3){ v="many"; d={you:hid,seasonsN:L.length}; cl=[C("careerN|"+nm+"|"+G.year,L.length)]; base=[]; }
  else if(x.wins>=1){ v="wins"; d.winsN=x.wins; cl=[C(k("wins"),x.wins)]; }
  else if(x.pod>=1){ v="pods"; d.podN=x.pod; cl=[C(k("pod"),x.pod)]; }
  else if(x.over&&x.rounds>=x.n&&x.n>=2){ v="full"; d.roundsN=x.n; cl=[C(k("rounds"),x.rounds),C(k("n"),x.n)]; }
  else if(x.best>=1&&x.best<=20){ v="raced"; d.bestPlace=x.best; cl=[C(k("best"),x.best)]; }
  else { v="plain"; cl=[C(k("rounds"),x.rounds)]; }
  var s=S("career","career|"+hid,x.id,0.5,v,d,base.concat(cl),{ids:[hid],you:hid}); s.tags.push("you"); return s;
}

/* ---------------- the opening's choices (pure, so the tests can see them) ----------------
   said = the claims already said this round {k: v}. The lead story (Hutch): the best story that is NOT the title, the person or the career book,
   fresh in the ledger, not the same kind as last round's lead unless it scores 0.9+, none of its claims said. The title leads only when the
   standings were not said and it scores 0.85+ (and not two openings running unless the last two rounds). The second (Wes): the person's story
   (the person featured least recently, a milestone first), else the title (when the standings were not said), else the next story of another kind */
var SOFT={city:1,lastround:1,daygap:1,left:1,maxpts:1,careeryear:1,pick:1,view:1};   /* context, not a fact told: "my pick", the city a round was in */
function claimSaid(c,said){ var t=String(c.k).split("|")[0]; if(SOFT[t]) return false; return !!said&&(c.k in said)&&String(said[c.k])===String(c.v); }
function anySaid(s,said){ return s.claims.some(function(c){ return claimSaid(c,said); }); }
function fresh(s,led,R){ var t=led&&led.told&&led.told[s.key]; if(!t) return true; return t.ver!==s.ver; }
function lead(G,R,env,led,said){
  if(R<1) return null;
  var st=stories(G,R,env,led), lk=led&&led.lead&&led.lead[R-1];
  var c=st.filter(function(s){ return s.kind!=="title"&&s.kind!=="you"&&s.kind!=="career"&&fresh(s,led,R)&&!anySaid(s,said)&&(s.kind!==lk||s.score>=0.9); });
  if(c.length) return c[0];
  var t=st.filter(function(s){ return s.kind==="title"&&s.score>=0.85&&fresh(s,led,R)&&!anySaid(s,said)&&(lk!=="title"||R>=G.cal.length-2); })[0];
  return t||null;
}
function second(G,R,env,led,said,leadKey,o){
  if(R<1) return null; o=o||{};
  var st=stories(G,R,env,led).filter(function(s){ return s.key!==leadKey&&fresh(s,led,R)&&!anySaid(s,said); });
  var per=led&&led.per||{}, ys=st.filter(function(s){ return s.kind==="you"; });
  if(ys.length){ ys.sort(function(a,b){ var pa=per[a.you]!=null?per[a.you]:-1, pb=per[b.you]!=null?per[b.you]:-1; return (b.milestone?1:0)-(a.milestone?1:0)||pa-pb||b.score-a.score; }); return ys[0]; }
  if(!o.standingsSaid){ var t=st.filter(function(s){ return s.kind==="title"; })[0]; if(t) return t; }
  var lk=o.leadKind;
  return st.filter(function(s){ return s.kind!=="career"&&s.kind!=="title"&&s.kind!==lk; })[0]||null;
}

/* ---------------- the wrap: round r (scored) in the season story ---------------- */
function wrap(G,r,env,led){
  var x=resAt(G,r); if(!x) return [];
  var out=[], w=x.winner, multi=finalsOf(x).length>1, tb=tbOf(G,r), tb0=r>=1?tbOf(G,r-1):null;
  var ws=streak(G,w,r,"win"); if(ws>=2) out.push(S("streak","streak|win|"+w,ws,ws>=3?1:0.9,"winrun",{last:w,rowN:ws},[C("streak|win|"+w+"|"+r,ws)],{ids:[w],you:isHuman(G,w)?w:undefined}));
  else if(r>=2&&!isHuman(G,w)){ var wn=winsBefore(G,w,r)+1; if(multi&&wn===1) out.push(S("firstwin","firstwin|"+w,"1",0.8,"firstwin",{last:w},[C("win|"+r,w),C("wins|"+w+"|"+r,0)],{ids:[w]}));
    else if(wn>=2) out.push(S("tally","wins|"+w+"|"+r,"1",0.6,"winsN",{last:w,winsN:wn},[C("win|"+r,w),C("wins|"+w+"|"+(r+1),wn)],{ids:[w]})); }
  /* a bounce-back: crashed out of the round before's final, on the podium now */
  if(r>=1) x.cls.slice(0,3).forEach(function(id){ if(!inMain(x,id)||isHuman(G,id)) return; if(crashedOut(G,r-1,id)){ var pv=resAt(G,r-1);
    out.push(S("bounce","bounce2|"+id+"|"+r,"1",0.85,"bounce",{last:id,lastCity:pv.city,place:fplace(x,id)},[C("dnf|"+(r-1)+"|"+id,1),C("city|"+(r-1),pv.city),C("place|"+r+"|"+id,fplace(x,id))],{ids:[id],needs:"details"})); } });
  /* the title fight: closer or wider (the same two at the top, the gap moved by a third or 5 points at least) */
  if(tb&&tb0&&tb.length>=2&&tb0.length>=2&&tb[0][2]>0&&tb[0][0]===tb0[0][0]&&tb[1][0]===tb0[1][0]){
    var g1=tb[0][2]-tb[1][2], g0=tb0[0][2]-tb0[1][2], dd=g1-g0;
    if(g1>0&&Math.abs(dd)>=Math.max(5,Math.round(Math.max(g0,1)/3))) out.push(S("gap",(dd<0?"closer|":"wider|")+r,"1",dd<0?0.75:0.7,dd<0?"closer":"wider",{red:tb[0][0],second:tb[1][0],leadN:g1},[C("ptsgap|"+tb[0][0]+"|"+tb[1][0]+"|"+r,g1),C("gapdir|"+tb[0][0]+"|"+tb[1][0]+"|"+r,dd<0?"closer":"wider")],{ids:[tb[0][0],tb[1][0]]}));
  }
  /* a season record set in this round */
  if(r>=2){ var rc=records(G,r), rp=records(G,r-1);
    [["margin","bigmargin"],["from","fromback"],["hs","hsmost"],["wins","winsmost"]].forEach(function(z){ var a=rc[z[0]], b=rp[z[0]]; if(!a) return;
      var cnt=z[0]==="hs"||z[0]==="wins", set=cnt?(!b||b.id!==a.id):(a.ri===r&&(!b||a.v>b.v)); if(!set) return;
      var d2={last:a.id}; if(z[0]==="margin") d2.marginS=a.v; else if(z[0]==="from") d2.fromPlace=a.v; else if(z[0]==="hs") d2.hsN=a.v; else d2.winsN=a.v;
      out.push(S("record","rec|"+z[0],a.id+"|"+a.v,0.7,z[1],d2,[C("rec|"+z[0]+"|"+r,a.id+":"+a.v)],{ids:[a.id],needs:cnt?"results":"details",you:isHuman(G,a.id)?a.id:undefined})); }); }
  /* a rivalry renewed: the pair side by side again, three times or more */
  rivals(G,r).forEach(function(e){ if(e.last!==r||e.n<3||isHuman(G,e.a)||isHuman(G,e.b)) return; out.push(S("rival","rival|"+e.a+"|"+e.b,e.n,0.6,"rival",{aLast:e.a,bLast:e.b,timesN:e.n},[C("pair|"+e.a+"|"+e.b+"|"+r,e.n)],{ids:[e.a,e.b]})); });
  /* I said he was struggling: a podium now */
  mindStories(G,r+1,led).forEach(function(s){ var pp=fplace(x,s.ids[0]); if(pp>=1&&pp<=3){ s.score=0.8; out.push(s); } });
  /* the people's round in their season */
  (G.humans||[]).forEach(function(h){ var y=youWrap(G,r,h,env,led); if(y) out.push(y); });
  out.sort(function(a,b){ return b.score-a.score||(a.key<b.key?-1:1); });
  return out;
}
function youWrap(G,r,hid,env,led){
  var x=resAt(G,r); if(!x) return null; var p=fplace(x,hid), a=arc(G,r+1,hid), prev=arc(G,r,hid), d={you:hid}, v=null, cl=[], sc=0.7, pv=resAt(G,r-1), pp=pv?fplace(pv,hid):0;
  var last=r===G.cal.length-1;
  var cm=careerMilestone(G,r,hid,env,led);
  if(last){ if(a.wins>=1){ v="youSeason"; d.winsN=a.wins; d.podN=a.pods; cl=[C("wins|"+hid+"|"+(r+1),a.wins),C("pods|"+hid+"|"+(r+1),a.pods)]; }
    else if(a.pods>=1){ v="youSeasonPod"; d.podN=a.pods; d.bestPlace=a.best.p; cl=[C("wins|"+hid+"|"+(r+1),0),C("pods|"+hid+"|"+(r+1),a.pods),C("best|"+hid+"|"+r,a.best.p)]; }
    else if(a.best&&a.best.p<=20){ v="youSeasonBest"; d.bestPlace=a.best.p; d.bestCity=a.best.city; cl=[C("best|"+hid+"|"+r,a.best.p),C("place|"+a.best.ri+"|"+hid,a.best.p),C("city|"+a.best.ri,a.best.city)]; }
    else { v="youSeasonNone"; cl=[C("best|"+hid+"|"+r,a.best?a.best.p:0)]; }
    sc=0.9; }
  else if(p===1&&a.wins===1){ v="youFirstWin"; cl=[C("win|"+r,hid),C("wins|"+hid+"|"+r,0)]; sc=0.95; }
  else if(cm) return cm;
  else if(p>=1&&p<=3&&a.pods===1){ v="youFirstPod"; d.place=p; cl=[C("place|"+r+"|"+hid,p),C("pods|"+hid+"|"+r,0)]; sc=0.9; }
  else if(p>1&&p<=20&&prev.best&&p<prev.best.p&&prev.finals>=1){ v="youBest"; d.place=p; cl=[C("place|"+r+"|"+hid,p),C("best|"+hid+"|"+r,p)]; sc=0.85; }
  else if(a.rising&&p>0){ var t3=a.rounds.slice(-3); v="youArc"; d.place=t3[2].p; cl=[C("place|"+r+"|"+hid,p),C("rise|"+hid+"|"+r,3)]; sc=0.85; }
  else if(!p&&r>=1){ v="youNoMain"; cl=[C("main|"+r+"|"+hid,0)]; sc=0.6; }
  else if(p>0&&p<=20&&pp>0&&pp<=20&&p<pp){ v="youUp"; d.place=p; cl=[C("place|"+r+"|"+hid,p),C("updown|"+hid+"|"+r,"up")]; sc=0.65; }
  else if(p>0&&p<=20&&pp>0&&pp<=20&&p>pp){ v="youDown"; d.place=p; cl=[C("place|"+r+"|"+hid,p),C("updown|"+hid+"|"+r,"down")]; sc=0.55; }
  if(!v) return null;
  var s=S("you","youw|"+hid+"|"+r,"1",sc,v,d,cl,{ids:[hid],you:hid}); s.tags.push("you"); return s;
}
function careerMilestone(G,r,hid,env,led){
  if(led&&led.careerMile&&led.careerMile[hid]!=null) return null;
  var L=career(G,hid,env); if(!L.length) return null; var nm=String(rider(G,hid).name||"").toLowerCase();
  var best=null; L.forEach(function(x){ if(x.wins>=1&&(!best||x.wins>best.wins)) best=x; });
  var x=resAt(G,r), wins=upto(G,r).filter(function(z){ return z.winner===hid; }).length;
  if(!best||!x||x.winner!==hid||wins!==best.wins+1) return null;
  var s=S("you","youc|"+hid,"1",0.9,"youCareer",{you:hid,winsN:wins,hyear:best.year},[C("wins|"+hid+"|"+(r+1),wins),C("career|"+nm+"|"+best.sid+"|wins",best.wins),C("careeryear|"+nm+"|"+best.sid,best.year)],{ids:[hid],you:hid,careerMile:true});
  s.tags.push("you"); return s;
}

/* ---------------- what the booth knows about one rider coming into round R (the in-race context line) ---------------- */
function notes(G,R,id,env,led){ return cached(G,R,"notes|"+id,function(){ return notesBase(G,R,id,env); }); }
function notesBase(G,R,id,env){
  var out=[], r=R-1, last=resAt(G,r); if(!last) return out;
  var lw=lastwinStory(G,R); if(lw&&last.winner===id) out.push(lw);
  var ws=streak(G,id,r,"win"), ps=streak(G,id,r,"pod");
  if(ws>=2) out.push(S("streak","streak|win|"+id,ws,1,"winrun",{last:id,rowN:ws},[C("streak|win|"+id+"|"+r,ws)],{ids:[id]}));
  else if(ps>=3) out.push(S("streak","streak|pod|"+id,ps,0.8,"podrun",{last:id,rowN:ps},[C("streak|pod|"+id+"|"+r,ps)],{ids:[id]}));
  if(crashedOut(G,r,id)) out.push(S("bounce","bounce|"+id+"|"+r,"1",0.85,"bounce",{last:id,lastCity:last.city},[C("dnf|"+r+"|"+id,1),C("city|"+r,last.city),C("lastround|"+R,r)],{ids:[id],needs:"details"}));
  /* his last two finals places, when they say something (both top five, or both 11th-20th) */
  var pv=resAt(G,R-2); if(pv){ var a=fplace(pv,id), b=fplace(last,id);
    if(a>=1&&b>=1&&a<=5&&b<=5&&last.winner!==id) out.push(S("form","form|"+id+"|"+R,"1",0.7,"formgood",{last:id,placeA:a,placeB:b},[C("place|"+(R-2)+"|"+id,a),C("place|"+r+"|"+id,b)],{ids:[id]}));
    else if(a>10&&b>10&&a<=20&&b<=20) out.push(S("form","form|"+id+"|"+R,"1",0.55,"formbad",{last:id,placeA:a,placeB:b},[C("place|"+(R-2)+"|"+id,a),C("place|"+r+"|"+id,b)],{ids:[id]})); }
  /* won here earlier this season */
  var cal=G.cal[R]||{}, here=before(G,R).filter(function(x){ return cityKey(x.city)===cityKey(cal.city)&&x.winner===id; }).pop();
  if(here) out.push(S("venue","venue|"+R,"1",0.75,"venue",{last:id,city:here.city},[C("win|"+here.ri,id),C("city|"+here.ri,here.city)],{ids:[id]}));
  /* a season record he holds */
  if(r>=2){ var rc=records(G,r);
    [["margin","bigmargin"],["from","fromback"],["hs","hsmost"],["wins","winsmost"]].forEach(function(z){ var a2=rc[z[0]]; if(!a2||a2.id!==id) return;
      var dd={last:id}; if(z[0]==="margin") dd.marginS=a2.v; else if(z[0]==="from") dd.fromPlace=a2.v; else if(z[0]==="hs") dd.hsN=a2.v; else dd.winsN=a2.v;
      out.push(S("record","rec|"+z[0],a2.id+"|"+a2.v,0.6,z[1],dd,[C("rec|"+z[0]+"|"+r,a2.id+":"+a2.v)],{ids:[id],needs:z[0]==="hs"||z[0]==="wins"?"results":"details"})); }); }
  out.sort(function(p,q){ return q.score-p.score||(p.key<q.key?-1:1); });
  return out;
}
/* a rider's race earlier in round R (a heat, a semi, the LCQ, an earlier moto or Main): its place, from the round under way */
function heatNote(G,R,id){
  var RG=G.round&&G.round.ri===R?G.round:null; if(!RG) return null;
  var done=RG.races.filter(function(x){ return x.res&&x.res.indexOf(id)>=0; }), x=done[done.length-1]; if(!x) return null;
  var p=x.res.indexOf(id)+1; if(p<1||p>20) return null;
  if(p!==1&&!isHuman(G,id)) return null;   /* a heat win is a story; ninth in a heat is not (the person's own heat always is) */
  return S("heat","heat|"+id+"|"+R+"|"+x.key,"1",0.5,p===1?"heatwin":"heatplace",{last:id,heatPlace:p,heatLabel:x.label},[C("rplace|"+R+"|"+x.key+"|"+id,p)],{ids:[id]});
}
/* a rivalry note for two riders fighting right now (the pair has met at two rounds or more) */
function rivalNote(G,R,a,b){
  var e=rivals(G,R-1).filter(function(x){ return (x.a===a&&x.b===b)||(x.a===b&&x.b===a); })[0]; if(!e) return null;
  return S("rival","rival|"+e.a+"|"+e.b,e.n,0.9,"rival",{aLast:a,bLast:b,timesN:e.n},[C("pair|"+e.a+"|"+e.b+"|"+(R-1),e.n)],{ids:[a,b]});
}
/* the person's season against the race now (the booth adds the live place): best so far, last time out, the last two, the rival */
function youNotes(G,R,hid){
  var a=arc(G,R,hid), out=[];
  if(a.best) out.push({v:"youBest",best:a.best,claims:[C("best|"+hid+"|"+(R-1),a.best.p)]});
  if(a.last&&a.last.p>0&&a.last.p<=20) out.push({v:"youLast",last:a.last,claims:[C("place|"+a.last.ri+"|"+hid,a.last.p),C("lastround|"+R,a.last.ri)]});
  var t2=a.rounds.slice(-2); if(t2.length===2&&t2.every(function(x){ return x.p>0&&x.p<=20; })) out.push({v:"youArc",two:t2,claims:t2.map(function(x){ return C("place|"+x.ri+"|"+hid,x.p); })});
  if(a.rival) out.push({v:"youRival",rival:a.rival,claims:[C("rival|"+hid+"|"+a.rival.id+"|"+(R-1),a.rival.n)]});
  return out;
}

/* ---------------- the analyst's pick ---------------- */
function pick(G,R,ids,env,led){
  ids=(ids||[]).filter(function(id){ return !!rider(G,id); }); if(!ids.length) return null;
  var L=before(G,R);
  if(!L.length){
    var best=null; ids.forEach(function(id){ if(isHuman(G,id)) return; var b=env&&env.book?env.book(id):null; if(!b||!b.pos) return; var s=(b.defending?100:0)+(100-b.pos); if(!best||s>best.s||(s===best.s&&id<best.id)) best={id:id,s:s,b:b}; });
    if(!best) return {id:null,why:"none",v:"none",claims:[C("pick|"+R,"none")],d:{}};
    var vv=best.b.defending?"defending":"lastyear";
    return {id:best.id,why:vv,v:vv,d:{last:best.id,ptsPlace:best.b.pos},claims:[C("pick|"+R,best.id),C("book|"+best.id+"|"+G.sid,best.b.defending?"champ":"pos"+best.b.pos)]};
  }
  var wf=weights(G,R,env), r=R-1, fr={}, pts={}, maxF=0, maxP=0;
  ids.forEach(function(id){ fr[id]=pickForm(G,id,R,env); pts[id]=ptsAfter(G,r,id); if(fr[id]>maxF) maxF=fr[id]; if(pts[id]>maxP) maxP=pts[id]; });
  /* variety: not the same rider three rounds running unless he won or podiumed one of the last two (only picks that were said count) */
  var P=led&&led.picks||{}, p1=P[R-1], p2=P[R-2], cold=null;
  if(p1&&p2&&p1.id&&p1.id===p2.id){ var q1=fplace(resAt(G,R-1),p1.id), q2=fplace(resAt(G,R-2),p1.id); if(!((q1>=1&&q1<=3)||(q2>=1&&q2<=3))) cold=p1.id; }
  var best2=null;
  ids.forEach(function(id){ if(id===cold) return; var fs=maxF>0?fr[id]/maxF:0, ps=maxP>0?pts[id]/maxP:0, s=wf*fs+(1-wf)*ps+0.05*streak(G,id,r,"win");
    if(!best2||s>best2.s+1e-9||(Math.abs(s-best2.s)<=1e-9&&(pts[id]>pts[best2.id]||(pts[id]===pts[best2.id]&&id<best2.id)))) best2={id:id,s:s,fs:wf*fs,ps:(1-wf)*ps}; });
  if(!best2) return null;
  var id=best2.id, out={id:id,w:wf,d:{last:id},claims:[C("pick|"+R,id)]};
  /* why: a streak, a podium every round, a win here earlier this season; else the bigger weighted part (form: his last three places, all in a
     final; the table: his place in it) */
  var wsN=streak(G,id,r,"win"), psN=streak(G,id,r,"pod"), cal=G.cal[R]||{}, here=L.filter(function(x){ return cityKey(x.city)===cityKey(cal.city)&&x.winner===id; }).pop();
  var l3=L.slice(-3).map(function(x){ return fplace(x,id); }), tbr=tbRow(tbOf(G,r),id);
  if(wsN>=2){ out.why="streak"; out.d.rowN=wsN; out.claims.push(C("streak|win|"+id+"|"+r,wsN)); }
  else if(psN>=2&&psN===L.length){ out.why="pod"; out.claims.push(C("streak|pod|"+id+"|"+r,psN),C("rounds|"+R,L.length)); }
  else if(here){ out.why="venue"; out.d.city=here.city; out.claims.push(C("win|"+here.ri,id),C("city|"+here.ri,here.city)); }
  else if(best2.fs>=best2.ps&&l3.length===3&&l3.every(function(p){ return p>=1&&p<=20; })){ out.why="form"; out.d.placeA=l3[0]; out.d.placeB=l3[1]; out.d.placeC=l3[2]; out.claims.push(C("last3|"+id+"|"+R,l3.join(","))); }
  else if(tbr&&tbr[2]>0&&tbr[1]===1){ out.why="leader"; out.claims.push(C("red|"+r,id)); }
  else if(tbr&&tbr[2]>0){ out.why="points"; out.d.ptsPlace=tbr[1]; out.claims.push(C("ptsplace|"+id+"|"+r,tbr[1])); }
  else if(l3.length>=2&&l3.slice(-2).every(function(p){ return p>=1&&p<=20; })){ out.why="form2"; out.d.placeA=l3[l3.length-2]; out.d.placeB=l3[l3.length-1]; out.claims.push(C("place|"+L[L.length-2].ri+"|"+id,l3[l3.length-2]),C("place|"+L[L.length-1].ri+"|"+id,l3[l3.length-1])); }
  else { out.why="hunch"; }
  out.v=out.why;
  /* the last pick: kept after a bad night, or changed (a crash out, no final, or tenth and worse) */
  if(cold){ out.v="cold"; out.d={last:id,oldLast:cold}; out.claims=[C("pick|"+R,id),C("pick|"+(R-1),cold),C("pick|"+(R-2),cold)]; }
  else if(p1&&p1.id&&!/^(stick|switch)/.test(p1.v||"")){ var g1=grade(G,R-1,p1.id), bad=g1&&(g1.cls==="crashed"||g1.place===0||g1.place>=15);
    if(bad){ var vague=g1.cls==="crashed"||g1.place===0||g1.place>20;
      out.d={last:id}; if(!vague) out.d.place=g1.place;
      if(p1.id===id){ out.v=vague?"stickout":"stick"; out.claims=[C("pick|"+R,id),C("pick|"+(R-1),id)].concat(vague?[]:[C("place|"+(R-1)+"|"+id,g1.place)]); }
      else { out.v=vague?"switchout":"switch"; out.d.oldLast=p1.id; out.claims=[C("pick|"+R,id),C("pick|"+(R-1),p1.id)].concat(vague?[]:[C("place|"+(R-1)+"|"+p1.id,g1.place)]); }
      out.prev=g1; } }
  if(isHuman(G,id)){ out.you=id; out.v="pickYou"; out.d={last:id,you:id}; out.claims=[C("pick|"+R,id)]; }
  return out;
}
function grade(G,R,id){
  var x=resAt(G,R); if(!x||!id) return null; var p=fplace(x,id), crashed=crashedOut(G,R,id);
  var cls=p===1?"hit":p>=2&&p<=3?"podium":p>=4&&p<=5?"top5":crashed?"crashed":"back";
  var cl=[C("pick|"+R,id)]; if(cls==="crashed") cl.push(C("dnf|"+R+"|"+id,1)); else if(p>0) cl.push(C("place|"+R+"|"+id,p)); else cl.push(C("main|"+R+"|"+id,0));
  return {cls:cls,place:p,claims:cl};
}

MX.Memory={form:form,stories:stories,lead:lead,second:second,wrap:wrap,notes:notes,heatNote:heatNote,rivalNote:rivalNote,youNotes:youNotes,arc:arc,pick:pick,grade:grade,
  records:records,rivals:rivals,rivalFor:rivalFor,weights:weights,formHits:formHits,career:career,streak:streak,maxRound:maxRound,lastwin:lastwinStory,fplace:fplace,
  winsBefore:winsBefore,podsBefore:podsBefore,anySaid:anySaid,claimSaid:claimSaid,SOFT:SOFT,crashedOut:crashedOut,resAt:resAt,_reset:function(){ CACHE={k:null,m:{}}; }};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Memory;
})(typeof window!=="undefined"?window:globalThis);
