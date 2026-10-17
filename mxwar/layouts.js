/* MOTOCROSS WAR 3D — the TRACK LAYOUTS (data + the venue -> layout pick). Pure, no DOM. Node: module.exports = MXWar.Layouts.
   Our own descriptions (the CEO, 20:06: "these tracks are not the original tracks"): a layout is FACTS in our own coordinates (a centre-line,
   where the whoops, rhythm lanes, triples, tables, sand and the finish line are), never a copied track map or artwork.
   - Three hand-built templates (metres, course.js format): a modern stadium Supercross track ("sx-modern": a start straight beside the
     loop into a 180 turn 1, 4 lanes joined by berms: a rhythm lane, the big triple and a tabletop, the whoops, an on-off and the finish line),
     the Daytona-style hybrid on a speedway infield ("hybrid": a 146 m start, sweeping berms, a long sand section, whoops, rhythm, a big
     double, a finish-line jump, a wider track), and an outdoor national ("outdoor": 1.6 km over a hill: an uphill turn 1, a tabletop on
     the top, a downhill big jump, a valley with rollers, a sand corner, an off-camber hairpin, a big double down the finish straight).
   - The track researcher's shared format (BG_audit/games/mxwar/LAYOUT-FORMAT.md, packed into data/tracks.js as window.MXWarTracks):
     normalised points (driving order, from the gate), lengthM, widthM, elev by lap fraction, features by lap fraction t0..t1 with types
     (start, finish, whoops, rhythm, triple, double, tabletop, stepup, stepdown, big-jump, berm, sand, hill, offcamber, mechanics, tunnel,
     bridge), soil and surroundings. fromShared() turns one into the course.js format (standard dimensions for each feature type, fitted
     to its t0..t1). A round with a researched layout (rounds["sx-2025-r1"]) uses it; others use a template VARIANT seeded by the venue
     (every stadium its own lane order and mirror, every national its own hills), so no two venues look alike.
   pick(series, year, round, cal) -> {layout, look} where look = {soil, around, era, lights, sky}. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Layouts) return;
function hash(s){ var h=2166136261>>>0; s=String(s||""); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619)>>>0; } return h>>>0; }
function rng(seed){ var t=seed>>>0; return function(){ t=(t+0x6D2B79F5)>>>0; var x=Math.imul(t^(t>>>15),t|1); x^=x+Math.imul(x^(x>>>7),x|61); return ((x^(x>>>14))>>>0)/4294967296; }; }
function clone(x){ return JSON.parse(JSON.stringify(x)); }

/* ---------------- 1. the modern stadium (Supercross) ----------------
   The template (variant 0): floor about 132 x 80 m, 4 lanes of 100 m joined by hairpins (r 7) and a connector, the loop starting at the
   finish line (lane B, heading +x); the start: the gate beside lane A, a 102 m straight into a 180 that merges into lane A. Lap about 514 m
   (about 51 s). A venue variant changes the stadium: the lanes 95-115 m long (a bigger or smaller floor), the hairpins r 6, 7 or 8 (the
   lanes closer or wider apart), the whole layout mirrored, the three big lanes (rhythm, the triple and the table, the whoops) in another
   order, sometimes a sand lane: every stadium its own track, laps about 47-58 s. */
function sxGeom(k,r,m){
  var Ll=100*k, f0=30*k, conn=6*r-10, x0=Ll/2-f0, z0=(-r-1)*m, T=m>0?["L","R"]:["R","L"];
  var path=[["S",f0],[T[0],r,180],["S",Ll],[T[0],5,90],["S",conn],[T[0],5,90],["S",Ll],[T[0],r,180],["S",Ll],[T[1],r,180],["S",Ll-f0]];
  var hp=Math.PI*r, q=Math.PI*5/2, A0=f0+hp, D0=A0+Ll+2*q+conn, C0=D0+Ll+hp, B0=C0+Ll+hp;
  var zA=z0-2*r*m, zS=zA-14*m, lenS=102*k;
  var zs=[zS-11*m,zA+6*r*m+12*m].sort(function(a,b){ return a-b; });
  return {path:path,x0:x0,z0:z0,slots:{A:A0,D:D0,C:C0,B:B0},Ll:Ll,join:A0,
    start:{x0:Ll/2-lenS,z0:zS,th0:0,path:[["S",lenS],[T[1],7,180]],join:A0,gateW:17,narrow0:14,narrow1:lenS*0.9,gateAt:2},
    floor:[Math.min(-Ll/2-r-9,Ll/2-lenS-7),Ll/2+r+9,Math.min(zs[0],-r*3-14),Math.max(zs[1],r*3+12)],roughFrom:A0+Ll-10,roughTo:D0};
}
function sxPack(kind,a,R){
  /* a = the lane's start s; every package leaves room to brake for the next turn and to accelerate out of the last */
  switch(kind){
    case "rhythm": return [{k:"rhythm",from:a+15,combo:[[2,3,2,1],[3,2,2],[2,2,3],[1,3,3]][Math.floor(R()*4)],sp:5.6,h:1.35,name:"The rhythm lane"},{k:"rough",from:a+70,to:a+86,r:0.6}];
    case "triple": return [{k:"jump",s0:a+18,lip:a+24,mid:1.3,peak:a+44,touch:a+45.6,s1:a+54,h:2.1,hl:2.25,big:true,name:"The triple"},
                           {k:"jump",table:true,s0:a+62,lip:a+67,end:a+76,s1:a+82,h:1.7,name:"The tabletop"}];
    case "whoops": var nw=14+Math.floor(R()*4); return [{k:"whoops",from:a+16,to:a+16+3.75*nw,n:nw,h:1.05,name:"The whoops"}];
    case "sand": return [{k:"sand",from:a+8,to:a+60,name:"The sand"},{k:"jump",s0:a+64,lip:a+68,peak:a+80,touch:a+81.2,s1:a+86,h:1.6,hl:1.7,name:"The double"}];
    case "onoff": return [{k:"step",s0:a+13,lip:a+17,top0:a+20.5,top1:a+29,s1:a+36,h1:1.1,h2:2.1,drop:true,name:"The on-off"}];
  }
  return [];
}
function sxModern(variant){
  var R=rng(variant||1), lanes=["rhythm","triple","whoops"], feats=[], k=1, r=7, m=1;
  if(variant){
    k=0.95+Math.floor(R()*5)*0.05; r=[6,7,8][Math.floor(R()*3)]; m=R()<0.5?1:-1;
    for(var i=lanes.length-1;i>0;i--){ var j=Math.floor(R()*(i+1)), t=lanes[i]; lanes[i]=lanes[j]; lanes[j]=t; }
    if(R()<0.22) lanes[lanes.indexOf("rhythm")]="sand";
  }
  /* a modern stadium lap is 54-59 s (Main Events of 20 min + 1 lap run 21-23 laps): the speeds are tuned to it */
  var lapT=variant?54+R()*5:56;
  var Gm=sxGeom(k,r,m);
  feats=feats.concat(sxPack(lanes[0],Gm.slots.A,R),sxPack(lanes[1],Gm.slots.D,R),sxPack(lanes[2],Gm.slots.C,R),sxPack("onoff",Gm.slots.B,R));
  feats.push({k:"rough",from:Gm.roughFrom,to:Gm.roughTo,r:1});   /* the braking bumps round the connector */
  return {id:"sx-modern"+(variant?"-v"+(variant%997):""),name:"Stadium",kind:"stadium",width:7.5,berm:1.5,vtop:15.5,acc:0.72,grip:0.74,x0:Gm.x0,z0:Gm.z0,th0:0,path:Gm.path,
    start:Gm.start,floor:Gm.floor,finSide:-m,features:feats,lanes:lanes,shape:{k:k,r:r,mirror:m<0},lapT:lapT};
}

/* ---------------- 2. the Daytona-style hybrid (Supercross on a speedway infield) ----------------
   A bigger, flowing loop (about 540 m, 9 m wide): the finish straight heading +x at (0, 30), sweepers, a long sand section, the whoops,
   a rhythm lane, a big double, a tabletop, an on-off, a finish-line jump; the start: the gate at (-110, -12), a 146 m straight, a right
   sweeper and a run north that merges at loop s 62. */
var HY_PATH=[["S",40],["R",14,90],["S",20],["R",14,90],["S",30],["L",10,90],["S",10],["R",10,90],["S",70],["R",16,90],["S",30],["R",10,90],
  ["S",40],["L",9,180],["S",30],["R",12,180],["S",30],["R",10,90],["L",10,90],["S",26]];
function hybrid(variant){
  var R=rng(variant||7);
  var feats=[
    {k:"sand",from:104,to:150,name:"The sand"},
    {k:"whoops",from:186,to:236,n:14,h:0.95,name:"The whoops"},
    {k:"rhythm",from:270.5,combo:[2,2],sp:5.6,h:1.3,name:"The rhythm lane"},
    {k:"jump",s0:323,lip:328,peak:342,touch:343.3,s1:350,h:1.9,hl:2.0,big:true,name:"The big double"},
    {k:"jump",table:true,s0:388,lip:393,end:402,s1:408,h:1.6,name:"The tabletop"},
    {k:"step",s0:455,lip:459,top0:462.5,top1:470,s1:477,h1:1.0,h2:2.0,drop:true,name:"The on-off"},
    {k:"jump",s0:515,lip:520,peak:530,touch:531.3,s1:536,h:1.6,hl:1.7,name:"The finish-line jump"},
    {k:"rough",from:356,to:384,r:0.8}
  ];
  if(variant&&R()<0.5){ feats[2].combo=[3,1]; }
  var lapT=variant?60+R()*5:62;   /* the speedway infield's longer, sandier lap */
  return {id:"hybrid"+(variant?"-v"+(variant%997):""),name:"Speedway infield",kind:"hybrid",lapT:lapT,width:9,berm:1.7,vtop:18.5,acc:0.8,grip:0.84,x0:0,z0:30,th0:0,path:HY_PATH,
    start:{x0:-110,z0:-12,th0:0,path:[["S",146],["R",18,90],["S",38]],join:62,gateW:20,narrow0:20,narrow1:150,gateAt:2},
    floor:[-150,90,-40,125],finSide:-1,features:feats};
}

/* ---------------- 3. an outdoor national (Pro Motocross) ----------------
   A spline over a hill (metres; [x, z, height]); the loop starts at the finish line on the bottom straight (heading +x). Features by lap
   fraction f (course.js gets metres). The start: the gate on its own wide straight south of the finish straight, a left sweep that merges
   on the way up to turn 1. */
var OUT_PTS=[[0,222,0],[110,220,0],[220,216,0.5],[308,180,2],[348,110,6],[334,22,13],[286,-48,20],[209,-92,25],[110,-106,26],[11,-84,21],
  [-77,-33,12],[-165,18,4],[-238,66,1.5],[-238,136,0.5],[-176,172,1.5],[-110,136,6],[-84,79,9],[-33,84,8],[-18,143,4],[-33,194,1]];
function outdoor(variant){
  var R=rng(variant||11), pts=clone(OUT_PTS).map(function(p){ return [p[0]*1.22,p[1]*1.22,p[2]*1.15]; });   /* about 2 km */
  if(variant){ /* every national its own shape: the hill taller or lower, the points pushed about (never past their neighbours) */
    var hk=0.65+R()*0.75;
    pts=pts.map(function(p,i){ return i<3?p:[p[0]+(R()-0.5)*26,p[1]+(R()-0.5)*20,p[2]*hk]; });
  }
  var feats=[
    {k:"rough",f0:0.08,f1:0.14,r:0.7},
    {k:"jump",f:0.205,table:true,face:6,top:14,down:9,h:2.0,name:"The tabletop on the top"},
    {k:"jump",f:0.34,face:7,gap:26,down:11,h:2.4,hl:1.6,big:true,name:"The big downhill jump"},
    {k:"rollers",f0:0.43,f1:0.48,n:5,h:0.9},
    {k:"sand",f0:0.50,f1:0.585,name:"The sand corner"},
    {k:"rollers",f0:0.62,f1:0.66,n:4,h:0.8},
    {k:"step",f:0.705,face:4,top:9,down:7,h1:1.0,h2:2.0,name:"The step-up"},
    {k:"flat",f0:0.74,f1:0.80,keep:-0.35},   /* the off-camber hairpin: the outside LOWER than the inside */
    {k:"whoops",f0:0.83,f1:0.86,n:8,h:0.7,name:"The braking bumps"},
    {k:"jump",f:0.905,face:6,gap:22,down:9,h:2.2,hl:2.1,big:true,name:"The big double"}
  ];
  return {id:"outdoor"+(variant?"-v"+(variant%997):""),name:"Outdoor national",kind:"outdoor",width:9.5,berm:1.8,vtop:22.5,acc:0.86,grip:0.86,pts:pts,
    start:{pts:[[-183,366,0],[-49,366,0],[98,366,0],[244,363,0.5],[320,349,1],[366,305,2]],joinF:0.085,gateW:36,narrow0:30,narrow1:330,gateAt:2},
    floor:[-510,630,-400,530],finSide:1,features:feats,ds:0.5};
}

/* ---------------- the researcher's shared format -> ours ---------------- */
var STD={ /* standard dimensions of each feature type (metres): fitted into the feature's t0..t1 when that is long enough */
  whoops:{len:52}, rhythm:{len:44}, triple:{len:52}, double:{len:30}, tabletop:{len:28}, stepup:{len:26}, stepdown:{len:24}, "big-jump":{len:46}
};
function fromShared(S){
  var L=+S.lengthM||(S.kind==="stadium"?480:1800), w=+S.widthM||(S.kind==="stadium"?7.5:9.5), P=S.points||[], i;
  /* normalised 0..1 -> metres: scale so the closed polyline is lengthM long; centre on the origin; y down -> +z */
  var len=0; for(i=0;i<P.length;i++){ var a=P[i], b=P[(i+1)%P.length]; len+=Math.hypot(b[0]-a[0],b[1]-a[1]); }
  var k=len>0?L/len:1, cx=0, cz=0; P.forEach(function(p){ cx+=p[0]; cz+=p[1]; }); cx/=P.length||1; cz/=P.length||1;
  var elev=S.elev||[], pts=P.map(function(p,i2){ var t=i2/P.length; return [(p[0]-cx)*k,(p[1]-cz)*k,elevAt(elev,t)]; });
  var feats=[], fin=null, gate=0, startT1=0.04;
  (S.features||[]).forEach(function(f){ var t0=+f.t0||0, t1=f.t1!=null?+f.t1:t0; if(f.type==="finish") fin=t0; if(f.type==="start"){ gate=t0; startT1=Math.max(t1,t0+0.02); } });
  if(fin==null) fin=Math.min(0.995,startT1+0.0);
  /* our loop starts at the finish line: rotate t so fin = 0 */
  function sOf(t){ var u=t-fin; u-=Math.floor(u); return u*L; }
  (S.features||[]).forEach(function(f){
    var t0=+f.t0||0, t1=f.t1!=null?+f.t1:t0, a=sOf(t0), b=a+((t1-t0+1)%1)*L, mid=(a+b)/2, std=STD[f.type], span=Math.max(b-a,std?std.len:0);
    var s0=std?mid-span/2:a;
    switch(f.type){
      case "whoops": feats.push({k:"whoops",from:s0,to:s0+span,n:f.count||Math.round(span/3.7),h:S.kind==="stadium"?1.0:0.8,name:f.name}); break;
      case "rhythm": feats.push({k:"rhythm",from:s0,combo:comboFor(Math.max(3,f.count||Math.round((span-5)/5.6))),sp:5.6,h:1.3,name:f.name}); break;
      case "triple": feats.push({k:"jump",s0:s0,lip:s0+6,mid:1.3,peak:s0+26,touch:s0+27.5,s1:s0+span,h:2.1,hl:2.2,big:true,name:f.name}); break;
      case "double": if(S.kind==="stadium") feats.push({k:"jump",s0:s0,lip:s0+5,peak:s0+18,touch:s0+19.3,s1:s0+span,h:1.8,hl:1.9,name:f.name}); else feats.push({k:"jump",s0:s0,lip:s0+6,peak:s0+23,touch:s0+24.4,s1:s0+Math.max(span,32),h:1.9,hl:1.9,name:f.name}); break;
      case "big-jump": feats.push({k:"jump",s0:s0,lip:s0+7,peak:s0+33,touch:s0+34.6,s1:s0+span,h:2.5,hl:2.0,big:true,name:f.name}); break;
      case "tabletop": feats.push({k:"jump",table:true,s0:s0,lip:s0+5,end:s0+span-8,s1:s0+span,h:1.7,name:f.name}); break;
      case "stepup": feats.push({k:"step",s0:s0,lip:s0+4,top0:s0+7.5,top1:s0+span-7,s1:s0+span,h1:1.1,h2:2.1,drop:true,name:f.name}); break;
      case "stepdown": feats.push({k:"jump",table:true,s0:s0,lip:s0+5,end:s0+span-9,s1:s0+span,h:1.9,name:f.name}); break;
      case "sand": feats.push({k:"sand",from:a,to:Math.max(b,a+20),name:f.name}); break;
      case "berm": feats.push({k:"flat",from:a,to:b,keep:1.4}); break;
      case "offcamber": feats.push({k:"flat",from:a,to:Math.max(b,a+20),keep:-0.4}); break;
      case "start": break;
      default: break;
    }
  });
  var out={id:S.id,name:S.name||S.venue||S.id,kind:S.kind==="stadium"?"stadium":"outdoor",width:w,berm:S.kind==="stadium"?1.5:1.8,vtop:S.kind==="stadium"?15.5:22.5,acc:S.kind==="stadium"?0.72:0.86,grip:S.kind==="stadium"?0.74:0.86,
    pts:rot(pts,Math.round(fin*pts.length)),features:feats,shared:true,status:S.status,source:S.source,soil:S.soil,around:S.surroundings,
    gateS:sOf(gate),gateW:S.kind==="stadium"?17:36,startLen:((startT1-gate+1)%1)*L,minR:7,vavg:S.kind==="stadium"?10.0:15.5};
  if(S.kind==="stadium"){
    /* a real stadium lap is 50-60 s (the CEO): from the track's length at a stadium's average speed, kept inside that range */
    out.vavg=L/Math.max(48,Math.min(58,L/10.5));
    /* the floor: the track's bounding box with room for the outside berms and the wall, at least the researched floor size */
    var bx0=1e9, bx1=-1e9, bz0=1e9, bz1=-1e9, inc=function(x,z){ bx0=Math.min(bx0,x); bx1=Math.max(bx1,x); bz0=Math.min(bz0,z); bz1=Math.max(bz1,z); };
    pts.forEach(function(p){ inc(p[0],p[1]); });
    if(S.gate&&S.gate.x!=null&&S.gate.y!=null) inc((S.gate.x-cx)*k,(S.gate.y-cz)*k);   /* the gate (and the start behind it) stays on the floor */
    var mg=w/2+5, W0=bx1-bx0+2*mg, D0=bz1-bz0+2*mg;
    if(S.floorM&&S.floorM.length===2){ W0=Math.max(W0,+S.floorM[0]||0); D0=Math.max(D0,+S.floorM[1]||0); }
    var mx=(bx0+bx1)/2, mz=(bz0+bz1)/2; out.floor=[mx-W0/2,mx+W0/2,mz-D0/2,mz+D0/2];
  }
  /* a gate well behind the loop (the researcher's gate {x, y, behindM}): a start path from the gate that merges into the loop where the
     start straight begins; the loop's own start straight then runs on to turn 1 (the holeshot) */
  if(S.gate&&S.gate.x!=null&&S.gate.y!=null&&(+S.gate.behindM||0)>=15){
    var gx=(S.gate.x-cx)*k, gz=(S.gate.y-cz)*k;
    out.start={pts:[[gx,gz,elevAt(elev,0)],[0,0,0]],joinF:sOf(gate)/L,gateW:out.gateW,gateAt:2};
    out.startHs=out.startLen;
  }
  return out;
}
function rot(a,n){ n=((n%a.length)+a.length)%a.length; return a.slice(n).concat(a.slice(0,n)); }
function elevAt(E,t){ if(!E||!E.length) return 0; var i; for(i=0;i<E.length-1;i++){ if(t>=E[i][0]&&t<=E[i+1][0]){ var u=(t-E[i][0])/Math.max(1e-6,E[i+1][0]-E[i][0]); return E[i][1]+(E[i+1][1]-E[i][1])*u; } } return E[E.length-1][1]; }
function comboFor(n){ var c=[]; while(n>0){ if(n>=5){ c.push(3); n-=3; } else if(n>=2){ c.push(2); n-=2; } else { c.push(1); n-=1; } } return c; }

/* ---------------- the pick: a round -> its layout and its look ---------------- */
function lookFor(series,year,cal,shared){
  var v=String((cal&&cal.venue)||"")+" "+String((cal&&cal.city)||""), around=shared&&shared.around;
  var dome=/dome|ford field|lucas oil|u\.?s\.? bank|caesars|nrg|astrodome|kingdome|silverdome|georgia dome|metrodome|alamodome|trans world|edward jones|carrier dome|superdome|allegiant|at&t|state farm/i.test(v);
  var day=/daytona/i.test(v);
  var soil=shared&&shared.soil||(series==="mx"?(/southwick|wick|daytona/i.test(v)?"sand":/hangtown|prairie city|glen helen|pala|fox raceway|carlsbad|lake elsinore/i.test(v)?"hardpack":"loam"):day?"sand":"stadium-dirt");
  return {soil:soil,around:around||(series==="mx"?"hills-trees":day?"beach-speedway":dome?"stadium-dome":"stadium-open"),era:year<1990?"old":year<2006?"mid":"modern",
    night:series!=="mx",bales:year<1996,year:year};
}
function pick(series,year,roundN,cal,data){
  var key=(series==="smx"?"smx":series)+"-"+year+"-r"+roundN, D=data||g.MXWarTracks, shared=null, lay=null;
  if(D&&D.rounds&&D.rounds[key]){ var id=D.rounds[key]; (D.layouts||[]).forEach(function(l){ if(l.id===id) shared=l; }); }
  if(shared){ try{ lay=fromShared(shared); }catch(e){ lay=null; } }
  var seed=hash(((cal&&cal.venue)||"")+"|"+((cal&&cal.city)||"")+"|"+(series==="mx"?"":year));
  var v=String((cal&&cal.venue)||"")+" "+String((cal&&cal.city)||"");
  if(!lay){
    if(series==="mx") lay=outdoor(seed||1);
    else if(/daytona/i.test(v)||series==="smx") lay=hybrid(seed||1);   /* SMX: the big playoff tracks on speedways and dragways */
    else lay=sxModern(seed||1);
  }
  var look=lookFor(series,year,cal,lay.shared?lay:null);
  if(lay.kind==="hybrid"&&!lay.shared) look.around="beach-speedway";
  return {layout:lay,look:look,key:key,shared:!!(lay&&lay.shared)};
}

MX.Layouts={sxModern:sxModern,hybrid:hybrid,outdoor:outdoor,fromShared:fromShared,pick:pick,lookFor:lookFor,hash:hash,rng:rng};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Layouts;
})(typeof window!=="undefined"?window:globalThis);
