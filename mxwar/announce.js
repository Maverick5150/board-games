/* MOTOCROSS WAR — the AI announcers: a pure commentator (no DOM; runs in node and in the page). Node: module.exports = MXWar.Announce.
   The CEO (2026-10-17 ~06:45): "I want the camera to be just like motocross and Supercross, is it possible to add AI announcers just like
   Supercross and motocross?" Two ORIGINAL characters with invented names: Wes Calloway (the lead caller, voice "a") and Hutch Bramlett
   (the analyst, voice "b"); the phrase bank is mxwar/announce-lines.js, the research and the rules BG_audit/games/mxwar/ANNOUNCERS.md.
   It never touches the game: it READS the season (G), the race (G.race) and the events the engine already returns, and it says lines
   through the page's callback (ui/voice.js speaks them; a caption always shows them).
     var ann = MXWar.Announce.create({say, caption, onStory, speed, chatter, era, sayNames, sectionAt, layout, gapAt, lapMs, seed, clock, estimate});
       say(line)         the page speaks it (ui/voice.js BGVoice.speak); line = {id, who:"a"|"b", name, role:"C"|"A", text (the caption),
                         say (the speech respelling), pri 0..3 (3 = interrupt), interrupt, tier "T0".."T3" (delivery energy), ttl (ms the
                         line stays true), ev, tpl, lap, race, est (ms), parts (the template cut into literal / slot pieces, for a
                         recorded-voice player), lv 0..3 (the intensity: calm, lively, BIG, HUGE; tier = "T"+lv), why (the rules that
                         set it), facts (what the line states, for tests)}
       caption(line)     optional: the same line for a caption (BGVoice shows captions itself)
       onStory(story)    the camera director hears every change of what the commentary is about
       speed             "slow" | "medium" | "fast" (the Slow / Medium / Fast option: Slow busier, Fast quieter); chatter "less" | "normal" | "more"
       era / sayNames    the year (default: the season's) / {typed rider name: respelling} for the people's own names
       sectionAt(sector) -> {type, name, turn} of the track at a lap position 0..1 (the 3D track), or layout = a track-layouts.json layout
       gapAt(seatA, seatB) -> seconds between two riders (the 3D time model); without it the gap is told in cards
       lapMs             the length of a lap on screen when the page compresses it (the 2D view: 6-14 s); 0 = the real lap times
       clock()           the race clock the picture is at, {t: ms of the time model, rate: race ms per page ms} (the view that rides the model); without
                         it the commentator works the clock out from the lap on screen
       estimate(line)    a clip pack's real length of a line in ms (the booth then holds the floor for it), 0 = the words-per-second estimate
     ann.feed(G, events, now)      after every Season.startRace / step / apply / simRace (the same batch the page plays); now = the page clock (ms)
     ann.tick(now)                 every 100-250 ms while the race screen is up (cheap)
     ann.phase(kind, info, now)    page moments: "lineup" | "engines" | "board30" | "sideways" | "podium" | "pause" | "resume"
     ann.shown(kind, info, now)    the race view's moments: "pass" {s} | "crash" {s} | "holeshot" | "checkered" | "lapped" {s, by}
     ann.shot(shot)                the camera director's cut {kind, riders: [seats], section}
     ann.lineStart(id, now) / ann.lineDone(id, now)   the voice started / finished a line (keeps the booth honest about real speech lengths)
     ann.story() / ann.upcoming()  what the commentary is about now / next (for the camera director)
     ann.setTrack({layout, sectionAt}) / ann.set(key, value) / ann.pause() / ann.resume(now) / ann.state() / ann.restore(state, now) / ann.reset()
   Pacing (ANNOUNCERS.md D): one voice at a time; INTERRUPT lines (gate, holeshot, wars, crashes, lead changes, white flag, checkered)
   cut a calm or lively line, never a BIG or HUGE one; the lap's main story where the race view shows it; a budget of event lines per
   lap from the lap's length on screen, scaled by the speed (Slow busier, Fast quieter) and the Chatter setting.
   THE TALK (mxann3; the CEO, 2026-10-18: "I want the announcers to talk the entire time ... it should be talking about the race itself"):
   between the calls the booth talks (talk()): with real lap times no silence over about 4 s from the gate to the flag. What it talks
   about, in the CEO's order: the live battles (the gap in seconds and its trend at the line, side by side, the war that set it up), the
   person's own rider, the leader's gap and the top five, lap times and the fastest lap, what a crash cost, the points as they run; then
   the context: the rider's season so far, his history in earlier seasons, the venue and the series last. When nothing longer fits before
   the next lap's cards, a few words on the leader at the line. A lap shown short (the 2D view) is talked through less.
   Variety: the same words never twice inside 10 minutes, never the same template twice in a row; a line with no fact in it is heard once
   in a race; a fact (a rider's title, his last result) is told once in a race, in whatever words.
   History: only seasons that ENDED before this round (data/history.js, read as of the round's date) and this season's own results: never
   a later year, and never "the real" anything. Intensity: mxwar/intensity.js gives every line its level (HUGE stays rare).
   Facts are always TRUE: every slot comes from the engine or the season data; a line whose fact changed before it was spoken is dropped,
   never spoken late; once the results are read, nothing more is said about that race's laps. */
(function(g){
"use strict";
var MX=g.MXWar=g.MXWar||{};
if(MX.Announce) return;
function req(p){ try{ return typeof require==="function"?require(p):null; }catch(e){ return null; } }
function BANK(){ return MX.AnnounceLines||req("./announce-lines.js"); }
function RC(){ return MX.Race||req("./race.js"); }
function RD(){ return MX.Round||req("./round.js"); }
function SN(){ return MX.Season||req("./season.js"); }
function TIME(){ return MX.Time||req("./time.js"); }
function INT(){ return MX.Intensity||(req("./intensity-data.js"),req("./intensity.js")); }
/* the history book (data/history.js): read only for seasons that were over before the round being raced */
function HIST(){ if(g.MXWarHistory) return g.MXWarHistory; req("./data/history.js"); return g.MXWarHistory||null; }

/* ---------------- words for speech (ANNOUNCERS.md E.2) ---------------- */
var ONES=["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"];
var TENS=["","","twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"];
function words(n){
  n=Math.round(+n||0); if(n<0) return "minus "+words(-n);
  if(n<20) return ONES[n];
  if(n<100) return TENS[(n/10)|0]+(n%10?"-"+ONES[n%10]:"");
  if(n<1000){ var h=(n/100)|0, r=n%100; return ONES[h]+" hundred"+(r?" "+words(r):""); }
  var t=(n/1000)|0, r2=n%1000; return words(t)+" thousand"+(r2?" "+words(r2):"");
}
var ORDX={one:"first",two:"second",three:"third",five:"fifth",eight:"eighth",nine:"ninth",twelve:"twelfth"};
function ordWord(n){ var w=words(n), m=w.match(/^(.*?)([a-z]+)$/), pre=m[1], last=m[2]; if(ORDX[last]) return pre+ORDX[last]; if(/y$/.test(last)) return pre+last.slice(0,-1)+"ieth"; return pre+last+"th"; }
function ordNum(n){ var t=n%100; return n+((t>=11&&t<=13)?"th":(["th","st","nd","rd"][n%10]||"th")); }
function plateWords(n){ n=Math.round(+n); if(!(n>=0)) return null; if(n<100) return words(n); if(n%100===0) return words(n/100)+" hundred"; var h=(n/100)|0, r=n%100; return words(h)+" "+(r<10?"oh "+words(r):words(r)); }
function yearWords(y){ y=+y; var r=y%100; if(y>=2000&&y<=2009) return y===2000?"two thousand":"two thousand "+words(r); if(y>=1910&&y<2000) return "nineteen "+(r<10?"oh "+words(r):words(r)); if(y>=2010&&y<2100) return "twenty "+words(r); return words(y); }
function V(c,s){ return {c:String(c),s:String(s==null?c:s)}; }
function numV(n){ n=Math.round(n); return V(n<10?words(n):String(n),words(n)); }
function ordV(n){ return V(n<10?ordWord(n):ordNum(n),ordWord(n)); }
function cntV(n,one,many){ n=Math.round(n); var w=n===1?one:many; return V((n<10?words(n):String(n))+" "+w,words(n)+" "+w); }
function secV(x){   /* a lap time: one decimal; over a minute as m:ss.s */
  x=Math.round((+x)*10)/10; if(!(x>0)) return null;
  if(x<60){ var i=Math.floor(x), d=Math.round((x-i)*10); return V(x.toFixed(1)+" seconds",words(i)+(d?" point "+words(d):"")+" seconds"); }
  var m=Math.floor(x/60), r=Math.round((x-m*60)*10)/10, ri=Math.floor(r), rd=Math.round((r-ri)*10);
  return V(m+":"+(r<10?"0":"")+r.toFixed(1),words(m)+(m===1?" minute, ":" minutes, ")+words(ri)+(rd?" point "+words(rd):"")+" seconds");
}
function raceTimeV(t){ var m=String(t||"").match(/^(\d+):(\d\d)(?:\.\d+)?$/); if(!m) return null; var mi=+m[1], s=+m[2]; return V(mi+":"+m[2],words(mi)+(mi===1?" minute, ":" minutes, ")+words(s)+(s===1?" second":" seconds")); }
/* a gap in seconds as the booth says it: under a second in tenths ("0.6 seconds" / "six tenths of a second"), then one decimal up to 10 s
   ("1.4 seconds" / "one point four seconds"), then whole seconds */
function gapSecV(x){
  x=+x; if(!(x>=0.05)) return null;
  var d=Math.round(x*10)/10;
  if(d<1){ var tn=Math.round(d*10); return V(d.toFixed(1)+" seconds",tn===1?"a tenth of a second":words(tn)+" tenths of a second"); }
  if(d<10){ var i=Math.floor(d), f=Math.round((d-i)*10); return f?V(d.toFixed(1)+" seconds",words(i)+" point "+words(f)+" seconds"):V(i+(i===1?" second":" seconds"),words(i)+(i===1?" second":" seconds")); }
  var n=Math.round(x); return V(n+" seconds",words(n)+" seconds");
}
/* a lap time as the booth reads it off the timing screen: "53.4" ("fifty-three point four"), outdoors "2:05.3" ("two oh five point three") */
function lapTimeV(x){
  x=Math.round((+x)*10)/10; if(!(x>0)) return null;
  var tenth=Math.round((x-Math.floor(x))*10);
  if(x<60){ var i=Math.floor(x); return V(x.toFixed(1),words(i)+" point "+words(tenth)); }
  var m=Math.floor(x/60), s=Math.floor(x-m*60);
  return V(m+":"+(s<10?"0":"")+s+"."+tenth,words(m)+" "+(s<10?"oh "+words(s):words(s))+" point "+words(tenth));
}
/* the series in its own era's words: outdoors it was the AMA Motocross Championship until 1985 and Pro Motocross from 1986 (the season's own
   name says which); SuperMotocross only exists from 2023 */
function seriesV(Gs){ if(!Gs) return null; if(Gs.series==="sx") return V("Supercross"); if(Gs.series==="smx") return V("SuperMotocross"); return /Pro Motocross/.test(String(Gs.name||""))?V("Pro Motocross"):V("Motocross"); }
var TIMESW=["","one-time","two-time","three-time","four-time","five-time","six-time","seven-time","eight-time","nine-time","ten-time","eleven-time","twelve-time"];
/* the history book's names: the same key the book was built with (no nickname, no brackets, lower case, no dots or commas) */
function normName(n){ return String(n||"").replace(/\s*\([^)]*\)/g," ").replace(/\s*"[^"]*"\s*/g," ").replace(/\s+/g," ").trim().toLowerCase().replace(/[.,]/g,"").replace(/\s+/g," ").trim(); }
function fnv(s){ var h=0x811c9dc5; s=String(s); for(var i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return ("0000000"+h.toString(16)).slice(-8); }
function clsV(c){ c=String(c||""); if(/^500/.test(c)) return V("500cc","five hundred"); if(/^450/.test(c)) return V("450","four-fifty"); if(/^250/.test(c)) return V("250","two-fifty"); if(/^125/.test(c)) return V("125","one twenty-five"); return c?V(c,c):null; }
var RW={2:"two",3:"three",4:"four",5:"five",6:"six",7:"seven",8:"eight",9:"nine",10:"ten",11:"Jack",12:"Queen",13:"King",14:"Ace",15:"Joker"};
function rankOf(id){ var R=RC(); return R?R.rank(id):((id%54)>=52?15:2+(id%54)%13); }
function cardBare(id){ return RW[rankOf(id)]||null; }
function cardV(id){ var w=cardBare(id); if(!w) return null; var a=/^[aeiouAEIOU]/.test(w)||w==="eight"?"an ":"a "; return V(a+w,a+w); }
function cardPV(id){ var r=rankOf(id), w=RW[r]; if(!w) return null; return V(r===6?"sixes":w+"s",r===6?"sixes":w+"s"); }

/* ---------------- the phonetic table and the speech form ---------------- */
var SAYIDX=null, WORDRX=null;
function buildSay(){
  if(SAYIDX) return; var B=BANK()||{}; SAYIDX={};
  (B.say||[]).forEach(function(r){ SAYIDX[r[0]]=[r[1],r[2]]; });
  WORDRX=(B.words||[]).map(function(w){ var k=w[0].replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); return [new RegExp("(^|[^A-Za-z0-9])"+k+"(?![A-Za-z0-9])","g"),w[1]]; });
}
function sayify(t){
  buildSay(); t=String(t);
  WORDRX.forEach(function(p){ t=t.replace(p[0],function(m,pre){ return pre+p[1]; }); });
  t=t.replace(/&/g," and ").replace(/#/g,"").replace(/[()"\/]/g," ").replace(/\.\.\.|…/g,".");
  t=t.replace(/\d+/g,function(d){ return d.length===4&&+d>=1900&&+d<2100?yearWords(+d):words(+d); });
  return t.replace(/\s+/g," ").replace(/\s+([.,!?:])/g,"$1").trim();
}
/* a literal piece of a template keeps its outer spaces (the slot values are joined to it) */
function sayLit(t){ var m=String(t).match(/^(\s*)([\s\S]*?)(\s*)$/); return m[1]+(m[2]?sayify(m[2]):"")+m[3]; }
/* a city or a venue: the speech form spells out an all-caps abbreviation ("SVRA" -> "S V R A") */
/* "stadium" or "speedway": from the layout's surroundings when the round has one, else from the venue's name */
function venueKind(cal,layout){
  var sr=layout&&layout.surroundings?String(layout.surroundings):"";
  if(/^stadium/.test(sr)) return "stadium";
  if(/speedway/.test(sr)) return "speedway";
  var v=String((cal&&cal.venue)||"")+" "+String((cal&&cal.city)||"");
  return /speedway|raceway|dragstrip|fairground|cycle park|mx park|motocross park|motorsports park|sports park|ranch|daytona/i.test(v)?"speedway":"stadium";
}
/* a real rider named by a plain string (the night's real winner, the real fastest lap): the caption as written, the speech through the
   respelling table like every other rider's name */
function nameV(raw){
  var cl=String(raw||"").replace(/\s*\([^)]*\)/g," ").replace(/\s*"[^"]*"\s*/g," ").replace(/\s+/g," ").trim(); if(!cl) return null;
  var m=cl.match(/^(.*?),?\s+(Jr\.?|Sr\.?|II|III|IV)$/i), core=(m?m[1]:cl).trim(), suf=m?m[2].replace(/\./g,"").toUpperCase():"";
  var sufS={JR:" Junior",SR:" Senior",II:" the second",III:" the third",IV:" the fourth"}[suf]||"";
  buildSay(); var e=SAYIDX[cl]||SAYIDX[core]||SAYIDX[String(raw)];
  return V(cl,e?e[0]+" "+e[1]+sufS:sayify(core)+sufS);
}
/* a typed name with a rude word in it is not spoken (a short list of whole words; "Scunthorpe" and "Dick" are fine) */
var RUDE={fuck:1,fucker:1,fucking:1,fuk:1,shit:1,shitty:1,bitch:1,cunt:1,nigger:1,nigga:1,faggot:1,fag:1,pussy:1,asshole:1,slut:1,whore:1,rapist:1,nazi:1,twat:1,wanker:1};
function rude(name){ var t=String(name).toLowerCase().split(/[^a-z]+/); for(var i=0;i<t.length;i++) if(RUDE[t[i]]===1) return true; return false; }
function placeV(s){ s=String(s||"").replace(/\s*,.*$/,"").trim(); return s?V(s,sayify(s).replace(/\b([A-Z]{2,5})\b/g,function(m){ return m.split("").join(" "); })):null; }

/* ---------------- era, tags ---------------- */
var ERAS=["e70","e80","e90","e00","e10","e20"];
function eraOf(y){ y=+y||2026; return y<1980?"e70":y<1990?"e80":y<2000?"e90":y<2010?"e00":y<2020?"e10":"e20"; }
function eraOK(tag,era){ var m=tag.match(/^(e\d0)(?:-(e\d0))?$/); if(!m) return null; var a=ERAS.indexOf(m[1]), b=ERAS.indexOf(m[2]||m[1]), e=ERAS.indexOf(era); return e>=a&&e<=b; }
var SERIES={sx:1,mx:1,smx:1};
var HYPE=["unbelievable","what a","statement","heartbreak","huge","monster","incredible","terrific"];
var PRONOUN=/\b(he|him|his|he's|himself)\b/i;
/* action events: an analyst line spoken on its own (not as the follow-up of a call) must name the rider it is about */
var ACTION={lap_win:1,big_move:1,pass_top:1,war_won:1,wild_card:1,transfer_change:1,lead_battle:1,bubble:1,midpack_battle:1,teammates:1,privateer:1,runaway:1,
  out_of_cards:1,deadlock:1,kitty:1,you_up:1,you_down:1,lead_change:1,crash_remount:1,crash_out:1,multi_crash:1,holeshot:1,war_start:1,double_war:1,triple_war:1,last_lap_battle:1};
var YOULOW={halfway:1,laps_to_go:1,white_flag:1,show_open:1,race_intro_heat:1,race_intro_semi:1,race_intro_lcq:1,race_intro_qual:1,race_intro_main:1,race_intro_moto:1,lineup_gate:1,first_lap_order:1,heat_transfers:1,lcq_result:1,moto_done:1,overall:1,round_podium:1,records:1,championship_math:1};
var NAMED=/\{(rider|last|num|you|by|p1|last1|a|red|cutRider|bubble|star|riders|humans|aLast|bLast|cLast|otherLast|last2|bestBy|quickLast|redLast|secondLast|leaderLast|aheadLast|behindLast|hsLast|wLast|lLast|p4|p5|hchamp|hwinner|champion)\}/;
/* the talk and the passes on the track: an analyst line said on its own (not as the answer to a call) must name who it is about, or the
   room hears "that's a proper fight" without knowing whose */
var TALKEV={talk_battle:1,talk_you:1,talk_leader:1,talk_top5:1,talk_laps:1,talk_crash:1,talk_points:1,talk_stats:1,talk_season:1,talk_history:1,talk_venue:1,talk_series:1,talk_open:1,track_pass:1};
var TALKSOLO={talk_battle:1,talk_leader:1,talk_top5:1,talk_laps:1,talk_crash:1,talk_points:1,talk_stats:1,talk_season:1,talk_history:1,track_pass:1};
function wc(t){ var m=String(t).match(/[A-Za-z0-9'’-]+/g); return m?m.length:0; }
function sentenceCase(t){ t=String(t).replace(/\s+/g," ").trim(); t=t.charAt(0).toUpperCase()+t.slice(1); return t.replace(/([.!?]\s+)([a-z])/g,function(m,p,c){ return p+c.toUpperCase(); }); }

/* ---------------- a section of the track (LAYOUT-FORMAT.md features) ---------------- */
var SEC={whoops:["the whoops","in the whoops"],rhythm:["the rhythm section","in the rhythm section"],triple:["the triple","on the triple"],
  double:["the double","on the double"],tabletop:["the tabletop","on the tabletop"],stepup:["the step-up","on the step-up"],stepdown:["the step-down","on the step-down"],
  "big-jump":["the big jump","on the big jump"],sand:["the sand","in the sand"],hill:["the hill","on the hill"],offcamber:["the off-camber","in the off-camber"],
  start:["the start straight","on the start straight"],finish:["the finish-line jump","at the finish line"],bridge:["the bridge","on the bridge"],tunnel:["the bridge","on the bridge"]};
var SECPRI={whoops:9,triple:8,rhythm:8,"big-jump":8,double:7,tabletop:7,stepup:7,stepdown:7,sand:6,berm:5,offcamber:4,bridge:4,tunnel:4,hill:3,finish:2,start:1};
function sectionFromLayout(L,x){
  if(!L||!L.features||!(x>=0)) return null;
  var best=null, bs=-1, berms=0, bn=0;
  L.features.forEach(function(f){
    if(f.type==="berm"&&f.t0<=x) berms++;
    var p=SECPRI[f.type]; if(!p) return;
    var d=x<f.t0?f.t0-x:x>f.t1?x-f.t1:0; if(d>0.04) return;
    var sc=p*10-d*200; if(sc>bs){ bs=sc; best=f; bn=f.type==="berm"?berms+(f.t0>x?1:0):0; }
  });
  if(!best) return null;
  return {type:best.type,name:best.name||null,turn:best.type==="berm"?Math.max(1,bn):0};
}
function secWords(sec){
  if(!sec) return null; if(typeof sec==="string") sec={type:sec};
  if(sec.type==="berm"){ if(!(sec.turn>0)) return {n:V("the berm"),at:V("in the berm"),type:"berm"}; return {n:V("turn "+(sec.turn<10?words(sec.turn):sec.turn),"turn "+words(sec.turn)),at:V("in turn "+(sec.turn<10?words(sec.turn):sec.turn),"in turn "+words(sec.turn)),type:"berm"}; }
  if(sec.type==="big-jump"&&sec.name){ var nm=String(sec.name); return {n:V(nm,sayify(nm)),at:V("on "+nm,"on "+sayify(nm)),type:"big-jump"}; }
  var w=SEC[sec.type]; if(!w) return null;
  return {n:V(w[0]),at:V(w[1]),type:sec.type==="tunnel"?"bridge":sec.type};
}
function featureOf(L){
  if(!L||!L.features) return null; var f=L.features, has=function(t){ return f.filter(function(x){ return x.type===t; }); };
  var big=has("big-jump").filter(function(x){ return x.name; })[0]; if(big) return V(big.name,sayify(big.name));
  if(has("whoops").length) return V("the whoop section");
  if(has("sand").length) return V("the sand section");
  if(has("triple").length) return V(has("triple").length>1?"the triples":"that triple");
  if(has("rhythm").length) return V("the rhythm lanes");
  if(has("hill").length) return V("the hills");
  return null;
}

/* =====================================================================================================================================
   the commentator
   ===================================================================================================================================== */
function create(o){
  o=o||{};
  var B=BANK(); if(!B) throw new Error("MXWar.AnnounceLines is not loaded.");
  buildSay();
  var EV=B.events;
  var A={G:null,R:null,rmap:null,race:null,round:null,now:0,q:[],seq:0,id:0,rs:((o.seed==null?(Date.now()&0x7fffffff):o.seed)>>>0)||1,
    booth:{until:0,cur:null,lastEnd:-1e9,lastWho:null,run:0,lastAction:-1e9,lastPri:0,lastEv:"",fb:false},
    recent:[],hype:{},bags:{},named:{},cd:{},names:{},sid:null,rounds:{},used:{},
    sit:{party:false,lcqSaid:false,redHist:[],redSeen:-1,clinched:false},
    story:{kind:"leader",label:"the leader",riders:[],ids:[],section:null,lap:0,at:0,until:0},shotInfo:null,
    track:{layout:o.layout||null,sectionAt:o.sectionAt||null,features:null},hist:[],paused:false,pausedAt:0,
    said:{},saidN:0,   /* the texts said in the last 10 minutes (a hash of the caption -> when): no line is said twice inside 10 minutes */
    tk:{at:{},pair:{},rider:{},sig:{},gap:null,wait:0,n:0,ctxAt:-1e9,last:null},hb:null};   /* talk: when each topic, pair and rider was last talked about */
  var say=typeof o.say==="function"?o.say:function(){}, capt=typeof o.caption==="function"?o.caption:null, onStory=typeof o.onStory==="function"?o.onStory:null;
  var sayNames=o.sayNames||{};

  function rnd(){ var t=(A.rs=(A.rs+0x6D2B79F5)>>>0); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }
  function pick(a){ return a[Math.floor(rnd()*a.length)]; }
  function chance(p){ return rnd()<p; }
  function speedK(){ var s=o.speed; return s==="slow"?1.3:s==="fast"?0.45:1; }
  function chatK(){ var c=o.chatter; return c==="less"?0.5:c==="more"?1.35:1; }

  /* ---------------- the season and the race ---------------- */
  function G(){ return A.G; }
  function rider(id){ return A.G&&A.G.riders?A.G.riders[id]:null; }
  function seatId(s){ return A.rmap?A.rmap[s]:null; }
  function era(){ if(o.era) return typeof o.era==="number"?eraOf(o.era):String(o.era); return eraOf(A.G&&A.G.year); }
  var seasonCache={k:null,L:null};
  function sstand(){ var Gs=A.G; if(!Gs||!SN()) return []; var k=Gs.results.length+"|"+Gs.ri+"|"+(Gs.over?1:0); if(seasonCache.k!==k||seasonCache.G!==Gs){ seasonCache={k:k,G:Gs,L:SN().standings(Gs)}; } return seasonCache.L; }
  function redNow(){ var L=sstand(); return L.length&&L[0].pts>0?L[0].id:null; }
  function splace(id){ var L=sstand(); for(var i=0;i<L.length;i++) if(L[i].id===id) return L[i]; return null; }
  /* the season as the talk tells it during a race: the engine scores a round the moment its last race ends, while the picture still shows
     that last lap; until the winner is called the talk uses the standings and the results from before this round */
  function preRound(){ var r=A.race, rc=r&&r.rc; return !!(rc&&!r.ckSaid&&A.G&&(A.G.results||[]).some(function(x){ return x.ri===rc.ri; })); }
  function standNow(){ return preRound()&&A.race.rc.stand?A.race.rc.stand:sstand(); }
  function resNow(){ var R=(A.G&&A.G.results)||[]; if(!preRound()) return R; var ri=A.race.rc.ri; return R.filter(function(x){ return x.ri<ri; }); }
  function splaceNow(id){ var L=standNow(); for(var i=0;i<L.length;i++) if(L[i].id===id) return L[i]; return null; }
  function redPre(){ var L=standNow(); return L.length&&L[0].pts>0?L[0].id:null; }
  function rstand(){ var R=A.R; if(!R||!RC()) return []; return RC().standings(R); }
  function placeIn(L,s){ for(var i=0;i<L.length;i++) if(L[i].s===s) return i+1; return 0; }
  function alive(L){ return L.filter(function(r){ return !r.out; }).length; }
  /* mxtime: a race with a time model hands over rows with the gap in SECONDS (gs: behind the leader; t / laps: the race time at the line); the old card gap (cgap, or the
     number in gap) is the fallback for a race without one and for the gate order. "Close" is within 2 s, a battle within 1 s, a bubble within 3 s. */
  function gapS(r){ return r&&typeof r.gs==="number"&&r.gs>=0?r.gs:null; }
  function gapC(r){ return r?(r.cgap!=null?r.cgap:(typeof r.gap==="number"?r.gap:null)):null; }
  function gapN(r){ var g=gapS(r); return g!=null?g:(gapC(r)==null?0:gapC(r)); }
  function isClose(r,n){ var g=gapS(r); return g!=null?g<=2:(gapC(r)!=null&&gapC(r)<=Math.max(2,Math.round(n/4))); }
  function between(a,b){ if(a&&b&&typeof a.t==="number"&&typeof b.t==="number"&&a.laps===b.laps) return (b.t-a.t)/1000; return null; }   /* seconds from a to b (b behind a), same lap */
  function bubbleNear(cr,bu){ var d=between(cr,bu); return d!=null?d<=3:cr.count-bu.count<=3; }
  function nearRows(a,b){ var d=between(a,b); return d!=null?Math.abs(d)<=1:Math.abs(a.count-b.count)<=1; }
  function isHumanSeat(s){ var R=rider(seatId(s)); return !!(R&&R.kind==="human"); }

  /* ---------------- names, numbers, makes as slot values ---------------- */
  function nameRec(id){
    var c=A.names[id]; if(c) return c;
    var R=rider(id); if(!R) return null;
    var raw=String(R.name||"").replace(/\s*\([^)]*\)/g," ").replace(/\s*"[^"]*"\s*/g," ").replace(/\s+/g," ").trim();
    var m=raw.match(/^(.*?),?\s+(Jr\.?|Sr\.?|II|III|IV)$/i), core=(m?m[1]:raw).trim(), suf=m?m[2].replace(/\./g,""):"";
    var parts=core.split(" "), human=R.kind==="human", plate=R.plate;
    var numv=plate!=null?V("#"+plate,"number "+plateWords(plate)):null;
    var capFull=core+(suf?" "+suf:""), capLast=parts.length>1?parts[parts.length-1]:core;
    var sufS={JR:" Junior",SR:" Senior",II:" the second",III:" the third",IV:" the fourth"}[suf.toUpperCase()]||"";
    var e=SAYIDX[raw]||SAYIDX[core]||SAYIDX[R.name], sFull, sLast;
    if(e){ sFull=e[0]+" "+e[1]+sufS; sLast=e[1]; }
    else { var dz=core.replace(/\./g," ").replace(/\s+/g," ").trim(), dp=dz.split(" "); sFull=dz+sufS; sLast=dp.length>1?dp[dp.length-1]:dz; }
    if(human){
      var ov=sayNames[id]||sayNames[R.name];
      if(!/[A-Za-z]/.test(raw)||/^you$/i.test(raw)||rude(raw)){ capFull=capLast=numv?numv.c:"the home rider"; sFull=sLast=numv?numv.s:"the home rider"; }   /* no letters, "You" or a rude word: the number, never read aloud on the family's TV */
      else { capLast=capFull; sFull=sLast=ov?String(ov):sFull.replace(/[^A-Za-z0-9' -]/g," ").replace(/\s+/g," ").trim(); }
    }
    var mk=R.bike&&!/^(privateer|null|unknown)$/i.test(String(R.bike))?String(R.bike):null;
    c={id:id,full:V(capFull,sFull),last:V(capLast,sLast),num:numv,make:mk?V(mk,sayify(mk)):null,human:human,kind:R.kind,plate:plate};
    c.full.rid=id; c.last.rid=id; if(numv) numv.rid=id;   /* a recorded-voice player can tell which rider a slot names */
    A.names[id]=c; return c;
  }
  function riderSlots(sl,id,pre){ var n=nameRec(id); if(!n) return false; pre=pre||"";
    if(pre==="other"){ sl.other=n.full; sl.otherLast=n.last; return true; }
    sl[pre?pre:"rider"]=n.full; if(!pre){ sl.last=n.last; sl.num=n.num; sl.make=n.make; if(n.human) sl.you=n.full; } return true; }
  function listV(ids,useLast){
    var ns=ids.map(nameRec).filter(Boolean); if(!ns.length) return null;
    var k=useLast?"last":"full", shown=ns.length>3?ns.slice(0,3):ns, more=ns.length-shown.length;
    var c=shown.map(function(n){ return n[k].c; }), s=shown.map(function(n){ return n[k].s; });
    function join(a,tail){ if(tail) return a.join(", ")+" and "+tail; return a.length<=2?a.join(" and "):a.slice(0,-1).join(", ")+" and "+a[a.length-1]; }
    var out=more?V(join(c,cntV(more,"more","more").c),join(s,words(more)+" more")):V(join(c),join(s));
    out.rids=ns.map(function(n){ return n.id; });   /* who the list names (the pronoun rule looks at it) */
    return out;
  }
  /* does the slot value print a home rider's name? (a name slot carries rid, a list of names rids) */
  function slotHuman(v){
    if(!v||typeof v==="function") return false;
    if(v.rid!=null){ var R=rider(v.rid); if(R&&R.kind==="human") return true; }
    if(v.rids) for(var i=0;i<v.rids.length;i++){ var R2=rider(v.rids[i]); if(R2&&R2.kind==="human") return true; }
    return false;
  }
  /* a template that prints a home rider's name through a slot ({by}, {red}, {last1} ...) never says he / him / his about the line */
  function printsHuman(text,sl){
    var re=/\{([A-Za-z0-9]+)\}/g, m; while((m=re.exec(text))) if(slotHuman(sl[m[1]])) return true;
    return false;
  }

  /* ---------------- the race context (set up from the season's own state) ---------------- */
  function raceName(label){
    var l=String(label||""), m;
    if((m=l.match(/^Heat (\d+)$/))) return V("Heat "+m[1],"Heat "+words(+m[1]));
    if((m=l.match(/^Semi (\d+)$/))) return V("Semi "+m[1],"Semi "+words(+m[1]));
    if(l==="Semi") return V("the semi");
    if(l==="LCQ"){ if(!A.sit.lcqSaid){ A.sit.lcqSaid=true; return V("the LCQ","the Last Chance Qualifier"); } return V("the LCQ","the L C Q"); }
    if(l==="Last Chance") return V("the Last Chance");
    if(l==="Main Event") return V("the Main Event");
    if((m=l.match(/^Main (\d+)$/))) return V("Main Event "+m[1],"Main Event "+words(+m[1]));
    if((m=l.match(/^Moto (\d+)$/))) return V("Moto "+m[1],"Moto "+words(+m[1]));
    if(l==="Moto") return V("the moto");
    if(l==="Qualifying") return V("the qualifying race");
    return l?V(l,sayify(l)):null;
  }
  function stageName(st){ if(!st) return null; var l=st.label; if(st.kind==="semi") return V(st.races>1?"the semis":"the semi"); if(l==="LCQ") return V("the LCQ","the L C Q"); if(l==="Last Chance") return V("the Last Chance"); return V("the "+l.toLowerCase()); }
  function lcqOf(F){ var st=F&&F.qual?F.qual.filter(function(q){ return q.kind==="lcq"; })[0]:null; if(!st) return V("the LCQ","the L C Q"); return st.label==="Last Chance"?V("the Last Chance"):V("the LCQ","the L C Q"); }
  function setupRace(key,label,kind,n,ids,quiet,ri){
    var Gs=A.G; if(ri==null) ri=Gs?Gs.ri:0;
    var rc=roundCtxFor(ri), RG=Gs&&Gs.round&&Gs.round.ri===ri?Gs.round:null, rdef=RG?RG.races.filter(function(r){ return r.key===key; })[0]:null;
    var F=RG?RG.F:(rc?rc.F:null), cal=rc?rc.cal:null;
    /* a race simmed with its round already scored (the whole batch at once): its stage from the key ("heat1-2" = stage 1, race 2) */
    var km=String(key||"").match(/^([a-z]+)(\d+)-(\d+)$/), si=rdef?rdef.st:(km?(+km[2])-1:-1), stages=RG?RG.st:(F?F.qual:null);
    var st=si>=0&&stages?stages[si]:null, lastSt=st?si===stages.length-1:false;
    var len=rdef?rdef.len:(Gs&&Gs.race&&Gs.rkey===key?Gs.race.o.len:0), lapS=rdef&&rdef.lap>0?rdef.lap:(Gs&&Gs.race&&Gs.race.lapS>0?Gs.race.lapS:55), fl=rdef&&rdef.fl>0?rdef.fl:0;
    var r={key:key,label:label,kind:kind,i:rdef?rdef.i:(km?(+km[3])-1:(/^final-(\d+)$/.test(key)?(+key.split("-")[1])-1:0)),n:n,len:len,lapS:lapS,fl:fl,ids:ids?ids.slice():null,F:F,cal:cal,rdef:rdef,ri:ri,
      tm:0,tn:0,cut:0,next:null,stage:st,isFinal:!st,lap:0,lapAt:0,gateAt:0,gated:false,flagged:false,done:false,laps:[],prev:null,cur:null,hist:[],
      changes:0,changeLaps:[],wars:0,warsWon:{},hs:-1,cards:{},up:{},crashQ:[],lineCount:{},tokens:1,lastRO:-9,lastLB:-9,lastRun:-9,lastMid:-9,lastBubble:-9,lastTC:-9,
      led:{},startPlace:{},real:null,timed:null,clockSaid:{},timeUp:false,sideways:false,yellowNext:null,milestones:{},humanCd:{},sim:false,lapLens:[],
      lapWinN:0,rc:rc};
    if(st){
      r.tm=st.toMain|0; r.tn=lastSt?0:(st.toNext==="rest"?Math.max(0,n-r.tm):(+st.toNext||0));
      r.cut=r.tm>0?r.tm:r.tn; r.rest=st.toNext==="rest"&&!lastSt; r.elim=!lastSt&&st.toNext!=="rest"&&r.tn>0&&r.tm+r.tn<n;
      r.next=stages[si+1]||null;
    }
    /* the clock of a timed race (the era's rule, Round.realSpec; Half length halves the minutes): the lap the clock runs out on (k0) and the
       laps after it must agree with this race's own laps, or the race is called as a lap count */
    if(F&&RD()){
      var spec=RD().realSpec(F,kind,r.i,Gs.year);
      if(spec&&spec.min>0){
        var mins=spec.min*(Gs.o&&Gs.o.length==="half"?0.5:1), T=mins*60, t=0, k0=0;
        for(var k=1;k<=len;k++){ t+=k===1&&fl>0?fl:lapS; if(t>=T-1e-6){ k0=k; break; } }
        var plus=k0?len-k0:0;
        if(k0&&plus>=1&&plus<=3) r.timed={min:mins,sec:T,k0:k0,plus:plus};
      }
      try{ r.real=RD().realRace(cal,F,kind,r.i)||null; }catch(e){ r.real=null; }
    }
    if(F){ r.olympic=F.overall==="olympic"; r.motos=F.finals?F.finals.races:1; r.tc=!!F.isTC; }
    A.race=r;
    if(Gs&&Gs.race&&Gs.rkey===key){ A.R=Gs.race; A.rmap=Gs.rmap?Gs.rmap.slice():(ids?ids.slice():null); }
    else { A.R=null; A.rmap=ids?ids.slice():null; }
    checkCompressed();
    return r;
  }
  /* a race whose laps are shown much shorter than the real lap (the 2D view at 6-14 s a lap) is not a race against a clock on screen:
     it is called as a lap count (no "ten minutes to go" in a race that takes three minutes to watch) */
  function checkCompressed(){ var r=A.race; if(r&&r.timed&&Lms()<0.5*r.lapS*1000){ r.timed=null; r.compressed=true; } }
  /* one round's context (kept per round: a round's lines still name ITS venue after the season has moved on to the next round) */
  function roundCtxFor(ri){
    var Gs=A.G; if(!Gs) return null; if(ri==null) ri=Gs.ri;
    var key=Gs.sid+"|"+ri, rc=A.rounds[key];
    if(!rc){
      var cal=Gs.cal[Math.max(0,Math.min(ri,Gs.cal.length-1))], res=(Gs.results||[]).filter(function(x){ return x.ri===ri; })[0];
      rc=A.rounds[key]={key:key,ri:ri,cal:cal,redBefore:res?redBeforeFrom(res):redNow(),opened:false,F:null,stand:res?null:sstand().map(function(x){ return Object.assign({},x); })};   /* stand: the standings as the round began */
    }
    if(!rc.F){ if(Gs.round&&Gs.round.ri===ri) rc.F=Gs.round.F; else if(rc.cal&&SN()){ try{ rc.F=SN().calFormat(Gs,rc.cal); }catch(e){ rc.F=null; } } }
    return rc;
  }
  function roundCtx(){ return roundCtxFor(A.G?A.G.ri:0); }
  /* the points leader before a round that is already scored (a simmed round): the most points without that round's (a tie: unknown) */
  function redBeforeFrom(res){ var Gs=A.G, best=null, bp=0, tie=false; for(var id in Gs.pts){ var p=(Gs.pts[id]||0)-((res.pts&&res.pts[id])||0); if(p>bp){ bp=p; best=id; tie=false; } else if(p===bp&&p>0) tie=true; } return tie?undefined:best; }
  /* per-rider laps led etc. from the race object (survives the season clearing G.race at the flag: we hold our own reference) */
  function lapNo(){ return A.race?A.race.lap:0; }
  function Lms(){
    var r=A.race; if(!r) return 10000;
    if(o.lapMs>0) return o.lapMs;
    if(r.lapLens.length>=2){ var a=r.lapLens.slice(-3).sort(function(x,y){ return x-y; }); return a[a.length>>1]; }
    return r.lapS*1000;
  }
  function lapLen(b){ var r=A.race; if(b===1&&r&&!(o.lapMs>0)&&r.lapLens.length<2&&r.fl>0) return r.fl*1000; return Lms(); }

  /* ---------------- the context of one line: tags + slots + facts ---------------- */
  function baseCtx(){
    var Gs=A.G, r=A.race, rc=(r&&r.rc)||roundCtx(), tags={}, sl={}, f={lap:lapNo(),race:r?r.key:null};
    if(Gs){ tags[Gs.series]=1; tags[era()]=1; }
    var e=era(); tags[e]=1;
    if(Gs){
      var cal=rc&&rc.cal, ri=rc?rc.ri:Gs.ri;
      if(cal){ sl.city=placeV(cal.city); sl.venue=placeV(cal.venue||cal.city); }
      /* a Supercross (or SMX) night is in a stadium, or on a speedway's grounds (Daytona, Talladega ...): "the building is full" is only for a stadium */
      if(Gs.series!=="mx") tags[venueKind(cal,A.track.layout)]=1;
      if(rc&&rc.F&&rc.F.finals&&rc.F.finals.kind==="main") tags.hasmain=1;   /* the night ends with a Main Event (the 1974-76 nights and the outdoor days are motos) */
      sl.year=V(String(Gs.year),yearWords(Gs.year));
      sl.cls=clsV(Gs.cls);
      sl.series=seriesV(Gs);
      /* the era's own words: the red plate marks the points leader from 2012 (before, the leader is "the points leader"); a four-fifty is
         the class from its data name (450cc from 2006) */
      if(Gs.year>=2012) tags.redplate=1;
      if(/^450/.test(String(Gs.cls))) tags.fourfifty=1;
      sl.rn=numV(ri+1); sl.rounds=numV(Gs.cal.length);
      if(ri===0) tags.first=1; if(ri===Gs.cal.length-1) tags.last=1;
      var hum=Gs.humans||[]; if(hum.length) sl.humans=listV(hum,false);
      var red=redPre(); if(red){ sl.red=nameRec(red)?nameRec(red).full:null; var L=standNow(); if(L[1]){ sl.second=nameRec(L[1].id).full; var ld=L[0].pts-L[1].pts; if(ld>0) sl.leadN=cntV(ld,"point","points"); if(ld>0&&ld<=10) tags.ptsclose=1; } if(L[2]) sl.third=nameRec(L[2].id).full; }
      var wv=Gs.o&&Gs.o.war; if(wv){ if(wv.noDown) tags.nodown=1; else if(wv.version==="classic") tags.classic=1; else tags.three=1; }
      var feat=featureOf(A.track.layout); if(feat){ sl.feature=feat; tags.feature=1; }
      var lq=lcqOf(rc&&rc.F||(Gs.round&&Gs.round.F)); sl.lcq=lq;
    }
    if(r){
      tags[r.kind]=1; if(r.isFinal) tags.final=1;
      sl.race=raceName(r.label); sl.n=numV(r.n); sl.laps=numV(r.len);
      if(r.timed){ tags.timed=1; sl.min=numV(r.timed.min); sl.plus=cntV(r.timed.plus,"lap","laps"); } else tags.laps=1;
      if(r.kind==="moto"){ var mi=r.i+1; tags["moto"+mi]=1; sl.m=numV(mi); tags["motos"+(r.motos||1)]=1; if(r.motos>1&&mi>1){ var w1=firstFinalWinner(); if(w1) sl.m1winner=nameRec(w1).full; } }
      if(r.tc&&r.kind==="main"){ tags["main"+(r.i+1)]=1; if(r.i>0){ var w2=firstFinalWinner(); if(w2) sl.m1winner=nameRec(w2).full; } }
      if(r.olympic) tags.olympic=1; else if(r.isFinal&&r.motos>1) tags.pointsov=1;
      if(r.stage){ if(r.tm>0) tags.direct=1; else if(r.tn>0) tags.nodirect=1; if(r.rest) tags.rest=1; if(r.elim) tags.elim=1; tags[r.tm===1?"tm1":"tmn"]=1;
        sl.tm=numV(r.tm||r.tn); sl.tmN=cntV(r.tm,"spot","spots"); sl.tn=numV(r.tn); if(r.cut>0){ sl.cut=ordV(r.cut); tags.cut=1; } if(r.next) sl.nextStage=stageName(r.next); }
      var lap=lapNo(); if(lap>0){ sl.lap=numV(lap); var left=r.len-lap+1; if(left>=2){ sl.left=numV(left); sl.leftN=cntV(left,"lap","laps"); } if(lap>r.len*2/3) tags.late=1; if(left>=5) tags.plenty=1; if(left>=3) tags.time=1; if(left<=1) tags.lastlap=1; }
      var humIn=(A.rmap||[]).filter(function(id){ var R=rider(id); return R&&R.kind==="human"; });
      if(humIn.length>=2) tags.party=1;
      if(A.rmap&&A.rmap[0]) sl.first=nameRec(A.rmap[0])?nameRec(A.rmap[0]).full:null;
      if(r.cur) orderSlots(sl,r.cur);
      if(r.timed&&A.race.gated&&!r.timeUp){ var cl=clockLeft(); if(cl!=null&&cl>0) sl.clockNow=clockWords(cl); }
      if(A.G&&A.G.o&&A.G.o.war&&A.G.o.war.outLoses) tags.shortrule=1;
    }
    return {tags:tags,slots:sl,facts:f};
  }
  /* the running order as slots (p1..p5, last1..last3, the gap P1-P2) from a given standings list: the order AT THE LINE (before this lap's
     result) for lines spoken as the lap starts, the order after the lap for lines spoken once the race view has shown the passes */
  function orderSlots(sl,L){
    ["p1","p2","p3","p4","p5"].forEach(function(k){ delete sl[k]; }); ["last1","last2","last3","last4","gap"].forEach(function(k){ delete sl[k]; });
    if(!L) return;
    ["p1","p2","p3","p4","p5"].forEach(function(k,i){ if(L[i]&&!L[i].out) sl[k]=nameRec(seatId(L[i].s)).full; });
    ["last1","last2","last3","last4"].forEach(function(k,i){ if(L[i]&&!L[i].out) sl[k]=nameRec(seatId(L[i].s)).last; });
    if(L[1]&&!L[1].out) sl.gap=gapV(L[0].s,L[1].s,gapC(L[1]),gapS(L[1]));
  }
  /* the gap between two riders: the race view's seconds when it gives them (o.gapAt), else the cards between them; level on cards = no gap
     to speak of (a line that needs {gap} is skipped) */
  function secV(x){ return gapSecV(x); }
  function gapV(sa,sb,cards,secs){
    if(typeof o.gapAt==="function"){ try{ var x=+o.gapAt(sa,sb); if(x>0) return secV(x); }catch(e){} }
    if(secs!=null) return secs>=0.05?secV(secs):null;   /* mxtime: the race's own seconds; level (under a twentieth) = no gap to speak of */
    if(cards==null||!(cards>0)||cards>Math.max(12,Math.round((A.race?A.race.n:20)/2))) return null;
    return cntV(cards,"card","cards");
  }
  function clockWords(sec){ var m=Math.floor(sec/60); return m>=2?V(numV(m).c+" minutes",words(m)+" minutes"):m===1?V("one minute"):V("under a minute"); }
  function clockLeft(){
    var r=A.race; if(!r||!r.timed||!r.gated) return null;
    var lap=Math.max(1,r.lap), done=0, k; for(k=1;k<lap;k++) done+=k===1&&r.fl>0?r.fl:r.lapS;
    var cur=lap===1&&r.fl>0?r.fl:r.lapS, frac=Math.max(0,Math.min(1,(A.now-r.lapAt)/Math.max(1,lapLen(lap))));
    return r.timed.sec-(done+frac*cur);
  }
  function firstFinalWinner(){ var RG=A.G&&A.G.round; if(!RG) return null; var f=RG.races.filter(function(x){ return x.st<0&&x.res; })[0]; return f?f.res[0]:null; }

  /* ---------------- rendering one line from the bank ---------------- */
  function parse(ev){ var E=EV[ev]; if(!E) return []; if(!E._p){ E._p=E.L.map(function(t,i){ var a=t.split("|"); return {id:ev+"#"+i,role:a[0],tags:a[1]?a[1].split(" ").filter(Boolean):[],text:a.slice(2).join("|")}; }); } return E._p; }
  function tplTags(id){ var i=String(id).indexOf("#"), P=i>0?parse(String(id).slice(0,i)):[], x=P[+String(id).slice(i+1)]; return x?x.tags:[]; }
  function tplText(id){ var i=String(id).indexOf("#"), P=i>0?parse(String(id).slice(0,i)):[], x=P[+String(id).slice(i+1)]; return x?x.text:""; }
  function eligible(tp,ctx){
    var e=era(), Gs=A.G;
    for(var i=0;i<tp.tags.length;i++){ var t=tp.tags[i], ok=eraOK(t,e);
      if(ok===false) return false; if(ok===true) continue;
      if(SERIES[t]){ if(!Gs||Gs.series!==t) return false; continue; }
      if(!ctx.tags[t]) return false; }
    return true;
  }
  /* the template with its slots filled: the caption (c), the speech form (s) and the pieces (parts: literal text and slots, raw, for a
     recorded-voice player that stitches names and numbers into carrier phrases) */
  function fill(text,sl){
    var miss=false, c="", s="", last=0, re=/\{([A-Za-z0-9]+)\}/g, m, parts=[];
    while((m=re.exec(text))){ var lit=text.slice(last,m.index); c+=lit; s+=sayLit(lit); if(lit) parts.push({t:"lit",c:lit,s:sayLit(lit)}); var v=sl[m[1]]; if(typeof v==="function") v=v(); if(!v||v.c==null||v.c===""){ miss=true; break; } c+=v.c; s+=v.s; var pt={t:"slot",k:m[1],c:v.c,s:v.s}; if(v.rid!=null) pt.rid=v.rid; parts.push(pt); last=re.lastIndex; }
    if(miss) return null;
    var tail=text.slice(last); c+=tail; s+=sayLit(tail); if(tail) parts.push({t:"lit",c:tail,s:sayLit(tail)});
    return {c:sentenceCase(c),s:sentenceCase(s),parts:parts};
  }
  function render(ev,role,ctx,strict){
    var P=parse(ev).filter(function(tp){ return tp.role===role&&eligible(tp,ctx); });
    if(!P.length) return null;
    var now=A.now, rec={}; A.recent.forEach(function(id){ rec[id]=1; });
    /* a line that names a home rider never says he / him / his (a person is only ever "{you}") unless its template is tagged you */
    var humanRef=!!ctx.human||((ctx.facts&&ctx.facts.named)||[]).some(function(id){ var R=rider(id); return !!(R&&R.kind==="human"); }), solo=role==="A"&&!ctx.follow&&(ACTION[ev]||TALKSOLO[ev]);
    P=P.filter(function(tp){ if(rec[tp.id]) return false; if(tp.tags.indexOf("you")<0&&PRONOUN.test(tp.text)&&(humanRef||printsHuman(tp.text,ctx.slots))) return false; if(solo&&!NAMED.test(tp.text)) return false; return true; });
    if(!P.length) return null;
    if(ctx.onlyYou) P=P.filter(function(tp){ return tp.tags.indexOf("you")>=0; });
    if(!P.length) return null;
    if(ctx.only){ var po=P.filter(function(tp){ return tp.tags.indexOf(ctx.only)>=0; }); if(po.length) P=po; }   /* a line that must say it (the home rider passed): those lines first */
    /* a line already heard in this race sounds canned: prefer templates this race has not used yet, then ones not heard in the last
       4 minutes (colour and filler: 10) */
    var ru=A.race&&A.race.usedT; if(ru){ var fresh=P.filter(function(tp){ return !ru[tp.id]; }); if(fresh.length) P=fresh; }
    /* talk with no fact in it (no number, place, gap or year: "that's a proper fight") is heard once in a race; a talk topic with nothing else to say gives way */
    if(ru&&EV[ev].p==="F"){ P=P.filter(function(tp){ return !(ru[tp.id]&&!FACTSLOT.test(tp.text)); }); if(!P.length) return null; }
    var span=EV[ev].p==="F"?600000:240000, older=P.filter(function(tp){ return !(A.used[tp.id]&&now-A.used[tp.id]<span); }), stages;
    if(older.length) stages=EV[ev].p==="F"?[older,P.filter(function(tp){ return older.indexOf(tp)<0; })]:[older];   /* the talk: when every template not heard for 10 minutes fails (its words were said), new facts in a template heard sooner (never the same words) */
    else if(strict&&PRI[EV[ev].p]<3) return null;
    else stages=[P];
    var fb=null, fbAt=Infinity;
    for(var si=0;si<stages.length;si++){
      var P2=stages[si]; if(!P2.length) continue;
      /* hype words: a 3-minute cooldown */
      var cool=P2.filter(function(tp){ var low=tp.text.toLowerCase(); return !HYPE.some(function(h){ return low.indexOf(h)>=0&&A.hype[h]&&now-A.hype[h]<180000; }); });
      if(cool.length) P2=cool;
      /* era lines about half the time; the human's own lines most of the time: a preference, so when the preferred lines were all heard in
         the last 10 minutes the others are tried before any words are said again */
      var e=era(), eraL=P2.filter(function(tp){ return tp.tags.some(function(t){ return eraOK(t,e)===true; }); }), plain=P2.filter(function(tp){ return eraL.indexOf(tp)<0; }), pref=P2;
      if(eraL.length&&plain.length) pref=chance(0.4)?eraL:plain;
      if(ctx.tags.you){ var yl=pref.filter(function(tp){ return tp.tags.indexOf("you")>=0; }); if(yl.length&&chance(YOULOW[ev]?0.3:0.75)) pref=yl; }
      var pools=pref.length<P2.length?[pref,P2.filter(function(tp){ return pref.indexOf(tp)<0; })]:[P2];
      for(var pi=0;pi<pools.length;pi++){
        /* least recently used first: never-used templates in random order, then the oldest (a little randomness among the three oldest) */
        var tries=pools[pi].slice().sort(function(a,b2){ return (A.used[a.id]||0)-(A.used[b2.id]||0)||rnd()-0.5; });
        var nUnused=tries.filter(function(tp){ return !A.used[tp.id]; }).length;
        if(nUnused>1){ var head=tries.slice(0,nUnused); for(var hi=head.length-1;hi>0;hi--){ var hj=Math.floor(rnd()*(hi+1)), ht=head[hi]; head[hi]=head[hj]; head[hj]=ht; } tries=head.concat(tries.slice(nUnused)); }
        else if(tries.length>2&&chance(0.5)){ var sw=Math.floor(rnd()*Math.min(3,tries.length)), st=tries[0]; tries[0]=tries[sw]; tries[sw]=st; }
        /* the same words twice inside 10 minutes sound canned (the CEO): a text said in the last 10 minutes is skipped; a call that must be made
           (an interrupt) takes the one heard longest ago when every template it has was said that recently */
        while(tries.length){
          var tp=tries.shift();
          var out=fill(tp.text,ctx.slots);
          if(!out) continue;
          if(!out.c||/undefined|null|NaN|\{|\}/.test(out.c+out.s)) continue;
          var heard=A.said[fnv(out.c)];
          if(heard!=null&&now-heard<600000){ if(PRI[EV[ev].p]>=3&&heard<fbAt){ fbAt=heard; fb={tpl:tp.id,text:out.c,say:out.s,parts:out.parts}; } continue; }
          return {tpl:tp.id,text:out.c,say:out.s,parts:out.parts};
        }
      }
    }
    return fb;
  }

  /* ---------------- the queue and the booth (one voice at a time) ---------------- */
  var PRI={I:3,H:2,N:1,F:0};
  function q(ev,opt){
    var E=EV[ev]; if(!E) return null;
    opt=opt||{};
    var pri=opt.pri!=null?opt.pri:PRI[E.p];
    var it={id:++A.seq,ev:ev,role:opt.role||"any",pri:pri,rank:opt.rank!=null?opt.rank:(E.rank||50),due:opt.due!=null?opt.due:A.now,
      exp:(opt.due!=null?opt.due:A.now)+(opt.ttl!=null?opt.ttl:(E.ttl||8))*1000,ctx:opt.ctx,key:opt.key||null,after:opt.after||null,delay:opt.delay||0,
      follow:!!opt.follow,race:A.race?A.race.key:null,lap:lapNo(),build:!!opt.build,post:!!opt.post,budget:opt.budget!==false&&pri<3,story:opt.story||E.story||null,subj:opt.subj||null,
      followP:opt.followP||0,ttlMs:(opt.ttl!=null?opt.ttl:(E.ttl||8))*1000,
      rc:A.race,rm:A.rmap,Rr:A.R};   /* the race this line is about: a line spoken after the next race has been set up still reads ITS race (its seats, its lap, its kind) */
    if(it.key){ A.q=A.q.filter(function(x){ return x.key!==it.key||x.pri>it.pri; }); if(A.q.some(function(x){ return x.key===it.key; })) return null; }
    if(it.after!=null&&!A.q.some(function(x){ return x.id===it.after; })) it.after=null;   /* the line it follows is already said (or gone): do not wait for it */
    A.q.push(it);
    return it;
  }
  function resolveAfter(id){ A.q.forEach(function(x){ if(x.after===id){ x.after=null; x.due=Math.max(x.due,A.now+x.delay); x.exp=Math.max(x.exp,x.due+x.ttlMs); if(x.hard!=null) x.exp=Math.min(x.exp,x.hard); } }); }   /* hard: the last race's leftovers never outlive the next race's first 8 s (review) */
  function estMs(who,text){ var w=wc(text); return Math.round((who==="a"?w/2.7:w/2.5)*1000+350+(/^Sideways\.$|^Board's sideways\.$/.test(text)?600:0)); }
  function boothBusy(){ var b=A.booth; if(A.now<b.until) return true; if(b.fb&&b.cur&&!b.cur.done&&A.now<b.cur.at+b.cur.est*2.5) return true; return false; }
  /* a line is made in the context of ITS race (a line spoken after the next race has been set up still reads its own race) */
  function inRace(it,fn){
    var sv={race:A.race,rmap:A.rmap,R:A.R};
    if(it.rc){ A.race=it.rc; A.rmap=it.rm; A.R=it.Rr; }
    try{ return fn(); } finally{ A.race=sv.race; A.rmap=sv.rmap; A.R=sv.R; }
  }
  function emit(it,cut){ return inRace(it,function(){ return emit2(it,cut); }); }
  /* the line itself: its context (the facts, read now), the voice and the template (the talk picks a line before it speaks it, to see that it
     fits before the next call) */
  function prepare(it){
    var ctx=null; try{ ctx=it.ctx?it.ctx():baseCtx(); }catch(e){ ctx=null; if(o.debug) throw e; }
    if(!ctx) return null;
    ctx.follow=it.follow;
    var E=EV[it.ev], roles=it.role==="any"?roleOrder(E,it):[it.role], out=null, role=null, i;
    for(i=0;i<roles.length&&!out;i++){ role=roles[i]; out=render(it.ev,role,ctx,true); }
    for(i=0;i<roles.length&&!out;i++){ role=roles[i]; out=render(it.ev,role,ctx,false); }
    if(!out) return null;
    var who=role==="C"?"a":"b";
    return {ctx:ctx,role:role,out:out,who:who,est:estMs(who,out.text)};
  }
  function emit2(it,cut){
    if(it.follow&&it.parent&&(!A.booth.cur||A.booth.cur.id!==it.parent)) return false;   /* another line came between the call and its answer: the answer is dropped */
    var pr=it.pre||prepare(it); it.pre=null;
    if(!pr) return false;
    var ctx=pr.ctx, role=pr.role, out=pr.out, E=EV[it.ev];
    var who=pr.who, crew=B.crew[who];
    var line={id:"L"+(++A.id),who:who,name:crew.short,role:role,text:out.text,say:out.say,pri:it.pri,interrupt:!!cut||it.pri===3,ev:it.ev,tpl:out.tpl,
      lap:lapNo(),race:A.race?A.race.key:null,at:A.now,est:pr.est,ttl:Math.max(1000,it.exp-A.now),facts:ctx.facts,words:wc(out.text),
      tier:E.t||"T1",parts:out.parts};
    /* INTENSITY (BG_audit/sprint/mxvoice/intensity, INTENSITY.md): how excited the line sounds, 0 calm, 1 lively, 2 BIG, 3 HUGE, decided here from
       the race facts by mxwar/intensity.js (+ intensity-data.js). line.tier follows it, so the device voices lift their rate and pitch a little
       by level too; a recorded-voice player picks the take by line.lv. A HUGE line is an interrupt for the voice as well: nothing cuts it. */
    var IN=INT(), lvr=null;
    if(IN&&IN.decide){ try{ lvr=IN.decide({ev:it.ev,tpl:out.tpl,role:role,follow:it.follow,A:A,it:it,ctx:ctx,lapMs:lapLen(lapNo())}); }catch(e){ if(o.debug) throw e; lvr=null; } }
    if(lvr){ line.lv=lvr.lv; line.E=lvr.E; line.why=lvr.why; line.tier="T"+lvr.lv; }
    if(lvr&&lvr.lv>=3&&line.pri<3){ line.pri=3; line.interrupt=true; }
    if(typeof o.estimate==="function"){ try{ var ee=+o.estimate(line); if(ee>0) line.est=Math.round(ee); }catch(e){} }   /* a clip pack knows how long its recording is */
    if(ctx.story) line.story=ctx.story;
    var b=A.booth;
    b.cur={id:line.id,at:A.now,est:line.est,pri:it.pri,who:who,done:false,ev:it.ev,lv:lvr?lvr.lv:0,post:!!it.post};
    b.until=A.now+line.est; b.run=b.lastWho===who?b.run+1:1; b.lastWho=who; b.lastPri=it.pri; b.lastEv=it.ev;
    if(it.pri===3&&role==="C") b.lastAction=A.now;
    A.recent.push(out.tpl); if(A.recent.length>12) A.recent.shift(); A.used[out.tpl]=A.now;
    if(it.ev==="talk_you") noteYouFacts(out.tpl,ctx);
    A.said[fnv(out.text)]=A.now; if(++A.saidN%40===0) pruneSaid();
    if(it.ev==="holeshot"&&A.race) A.race.hsCalled=true;
    if(A.race) (A.race.usedT=A.race.usedT||{})[out.tpl]=1;
    var low=out.text.toLowerCase(); HYPE.forEach(function(h){ if(low.indexOf(h)>=0) A.hype[h]=A.now; });
    (ctx.facts.named||[]).forEach(function(id){ A.named[id]=A.now; });
    if(A.race&&it.budget&&!it.build&&!it.post) A.race.tokens-=1;
    if(A.race){ var lc=A.race.lineCount; lc[lapNo()]=(lc[lapNo()]||0)+1; }
    setStory(it,ctx,line);
    var tpc=TOPIC_OF[it.ev]; if(tpc&&A.race&&A.race.gated) A.tk.at[tpc]=A.now;   /* an event line that told a topic's facts counts as that topic */
    A.hist.push(line); if(A.hist.length>400) A.hist.shift();
    A.q=A.q.filter(function(x){ return x!==it; }); resolveAfter(it.id);
    /* the flag has fallen: what the race was doing is old news (a pass or a crash at the line is still called, before the results are read);
       once the results are read, nothing more from that race's laps */
    if(it.ev==="checkered"||it.ev==="photo_finish"){ if(it.rc) it.rc.ckSaid=true; } if(it.ev==="checkered"||it.ev==="photo_finish") dropQ(function(x){ return x.race===it.race&&!x.post&&!x.build&&!ATLINE[x.ev]; });
    else if(it.post) dropQ(function(x){ return x.race===it.race&&!x.post&&!x.build; });
    if(it.ev==="board_sideways"&&A.race) A.race.sideways=true;
    if(it.ev==="engines"&&A.race){ A.race.enginesSaid=true; A.q=A.q.filter(function(x){ return x.ev!=="engines"||x.follow; }); }
    /* the analyst's follow-up of a call (one line, about 1.2 s after an interrupt, 0.7 s after a pass) */
    if(role==="C"&&it.followP&&chance(it.followP)){ var fu=q(it.ev,{role:"A",pri:1,due:A.now+line.est+(it.pri===3?1200:700),ttl:5,ctx:it.ctx,follow:true,budget:false,story:it.story,key:it.pri===3&&/war/.test(it.ev)?"warf@"+lapNo():null}); if(fu) fu.parent=line.id; }
    try{ say(line); }catch(e){}
    if(capt) try{ capt(line); }catch(e){}
    return true;
  }
  function roleOrder(E,it){
    var w=E.w||[1,1], b=A.booth;
    if(!w[1]) return ["C"]; if(!w[0]) return ["A"];
    var pC=w[0]/(w[0]+w[1]);
    if(b.run>=2&&b.lastWho==="a") pC=0.15; else if(b.run>=2&&b.lastWho==="b") pC=0.9;
    if(A.now<b.lastAction+3000) pC=Math.max(pC,0.85);   /* the analyst waits 3 s after an action call */
    return chance(pC)?["C","A"]:["A","C"];
  }
  function setStory(it,ctx,line){
    var k=ctx.story&&ctx.story.kind||it.story; if(!k) return;
    var s=ctx.story||{};
    var st={kind:k,label:s.label||storyLabel(k,ctx),riders:s.riders||[],ids:(s.riders||[]).map(seatId).filter(Boolean),section:s.section||null,lap:lapNo(),at:A.now,until:A.now+line.est+(k==="crash"||k==="lead-change"?5000:3000),line:line.id};
    A.story=st; if(onStory) try{ onStory(st); }catch(e){}
  }
  function storyLabel(k,ctx){
    var sec=ctx.slots&&ctx.slots.section; var p=ctx.slots&&ctx.slots.place;
    return {start:"the start",holeshot:"the holeshot",leader:"the leader","lead-change":"a new leader","battle-lead":"battle for the lead",pass:"a pass"+(p?" for "+p.c:""),
      battle:"battle"+(p?" for "+p.c:""),bubble:"the fight for the last transfer spot",war:"a war in the corner window",crash:"crash"+(sec?" at "+sec.c:""),
      yellow:"yellow flag"+(sec?" at "+sec.c:""),you:"the home rider",runaway:"the leader on his own","white-flag":"the white flag","last-lap":"last-lap battle",
      checkered:"the checkered flag",podium:"the podium",section:sec?sec.c:"the track"}[k]||k;
  }
  function tick(now){
    if(now!=null) A.now=now;
    if(A.paused) return;
    var b=A.booth, t=A.now;
    A.q=A.q.filter(function(x){ if(x.after==null&&x.exp<=t){ resolveAfter(x.id); return false; } return true; });
    if(A.race&&A.race.gated&&!A.race.flagged) clockCheck();
    var due=A.q.filter(function(x){ return x.after==null&&x.due<=t; });
    /* interrupts: the big moments (the flag, the title, crashes, a lead change) by rank; the rest first come, first served */
    due.sort(function(a,b2){ return b2.pri-a.pri||Math.min(a.rank,6)-Math.min(b2.rank,6)||a.due-b2.due||a.rank-b2.rank||a.id-b2.id; });
    var busy=boothBusy();
    if(due.length){
      var it=due[0];
      if(A.race&&A.race.sideways&&it.ev!=="gate_drop"){ /* nothing between "sideways" and the drop */ return; }
      /* an interrupt cuts a normal or filler line that is speaking, unless that line is nearly over (under 0.9 s left: it waits for the
         end, nobody is cut off in the last word) or has run long (past 1.4 times its length: a slow voice is cut after all) */
      if(busy){ if(it.pri===3&&b.cur&&b.cur.pri<3&&!b.cur.done&&cutOK(b.cur,t,it)){ emit(it,true); } return; }
      var gap=gapNeeded(it); if(t<lastEnd()+gap) return;
      /* a normal line that would still be speaking when the next lap's cards turn (a war call there would cut it) waits for that moment, while it
         stays true long enough */
      if(it.pri<=2&&!it.post&&!it.build&&A.race&&A.race.gated){ var le2=nextBigAt(t);
        if(isFinite(le2)&&le2-t<6000&&le2-t>-500){
          if(!(it.follow&&it.parent&&(!b.cur||b.cur.id!==it.parent))){ var pr2=inRace(it,function(){ return prepare(it); }); if(pr2) it.pre=pr2; }
          var need=it.pre?it.pre.est+200:3000;
          if(need>le2-t&&(LIVEFACT[it.ev]||it.follow)&&it.pre&&le2-t>=1300){ for(var tr=0;tr<4;tr++){ var pr4=inRace(it,function(){ return prepare(it); }); if(pr4&&pr4.est+200<=le2-t){ it.pre=pr4; need=pr4.est+200; break; } } }   /* a shorter way to say it may fit */
          if(need>le2-t){ it.pre=null; if(it.exp>le2+3000){ if(LIVEFACT[it.ev]) it.held=true; if(!busy) talk(); return; }   /* while it waits, a few words that fit may still come (the leader at the line) */ A.q=A.q.filter(function(x){ return x!==it; }); resolveAfter(it.id); return; }   /* it would still be speaking when a big call (or the next cards) comes: it waits for it, or, when it cannot wait that long, is dropped (never cut) */
        } }
      if(it.budget&&A.race&&!it.build&&!it.post&&A.race.gated&&!A.race.flagged&&A.race.tokens<(it.pri>=2?-0.5:0.999)){ A.q=A.q.filter(function(x){ return x!==it; }); resolveAfter(it.id); return; }
      if(!emit(it)){ A.q=A.q.filter(function(x){ return x!==it; }); resolveAfter(it.id); }
      return;
    }
    if(!busy) talk();
  }
  /* may an interrupt cut the line that is speaking? A BIG or HUGE line: never (unless it has run past 2.5 times its length: a stuck engine).
     A lively or calm line: when more than 0.9 s of it is left, or it has run long (1.4 times its length). A line chained after another
     (the post-race read-outs) waits for it instead of cutting it (INTENSITY.md 5.2, 6.3). */
  function cutOK(cur,t,it){ if(it.post) return false; var lv=cur.lv|0, left=A.booth.until-t; if(lv>=2) return t>cur.at+cur.est*2.5; return left>900||t>cur.at+cur.est*1.4; }
  /* the next line in the queue that will come due (a chained line waits for its predecessor and is not counted) */
  /* the lines whose facts are read live when they are said (the race clock, the view's own moment): one held back for the next cards may still be
     said early in the next lap; every other line is about its own lap and goes stale with it */
  var CARRY={crash_remount:1,crash_out:1,multi_crash:1,lead_change:1};
  var FACTSLOT=/\{(?!(rider|last|other|otherLast|you|by|p[1-5]|last[1-5]|a|b|c|aLast|bLast|cLast|red|redLast|second|secondLast|third|first|cutRider|bubble|star|riders|others|humans|lapper|champion|champ|next|old|m1winner|bestBy|quickLast|leaderLast|aheadLast|behindLast|hsLast|wLast|lLast|hwinner|hchamp|num)\})[A-Za-z0-9]+\}/;   /* a slot that is a fact (any slot but a name or a plate) */
  var ATLINE={track_pass:1,pass_top:1,big_move:1,you_up:1,you_down:1,crash_remount:1,crash_out:1,multi_crash:1,last_lap_battle:1,transfer_change:1};   /* still news after the winner's call */
  function dropQ(pred){ var gone=[]; A.q=A.q.filter(function(x){ if(pred(x)){ gone.push(x.id); return false; } return true; }); gone.forEach(resolveAfter); }
  var LIVEFACT={lapped:1,track_pass:1,talk_battle:1,talk_you:1,talk_leader:1,talk_top5:1,talk_laps:1,talk_crash:1,talk_points:1,talk_stats:1,talk_season:1,talk_history:1,talk_venue:1,talk_series:1};
  function nextDue(t,minPri){ var best=null; for(var i=0;i<A.q.length;i++){ var x=A.q[i]; if(x.after!=null||x.due<=t||(minPri!=null&&x.pri<minPri)) continue; if(!best||x.due<best.due) best=x; } return best; }
  /* the next moment a big call may start: the next interrupt in the queue, or the next lap's cards (a war), or the flag */
  function nextBigAt(t){ var n3=nextDue(t,3), at=n3?n3.due:Infinity, le=lapEndAt(); if(le!=null&&le>t-500&&le<at) at=le; return at; }
  function pruneSaid(){ var t=A.now; for(var k in A.said) if(t-A.said[k]>=600000) delete A.said[k]; }
  function lastEnd(){ var b=A.booth; return b.cur?(b.cur.done?b.cur.end:b.cur.at+b.cur.est):b.lastEnd; }
  function gapNeeded(it){
    var b=A.booth; if(!b.cur) return 0;
    var nextWho=it.role==="A"?"b":it.role==="C"?"a":null, g2=nextWho&&nextWho!==b.lastWho?650:300;
    if(b.lastPri===3&&it.pri<3) g2=Math.max(g2,1200);
    if(b.lastEv==="checkered"||b.lastEv==="photo_finish") g2=Math.max(g2,it.pri<3?2500:0);
    if(b.run>=2&&nextWho===b.lastWho&&it.pri<3) g2+=1500;
    if(it.pri===0) g2=Math.max(g2,4000);
    if(it.ev==="holeshot"&&A.race&&A.race.gateAt) return Math.max(g2,0);
    return g2;
  }

  /* =================================================================================================================================
     TALK: the whole race (the CEO, 2026-10-18: "I want the announcers to talk the entire time, even if they got to bring up history. But it
     should be talking about the race itself"). In the silences of green-flag racing the booth picks the freshest true thing worth saying:
     the race first (the live battles and the gap trends, the war that decided a fight, the person's own rider, the leader and the top five,
     lap times and the fastest lap, crashes and what they cost, the points as they run, the race's numbers), then the riders' season so far
     (this season, as raced here), their history in EARLIER seasons (data/history.js: only seasons over before this round), and the venue and
     the series last. A silence is about 1 to 2.5 s at real lap times (never much over 4 s; Chatter Less about 5 to 8 s, More about 0.6 to
     1.5 s), shorter in proportion when a lap on screen is shorter than the real lap. Every fact is read at the moment it is said, from the
     race clock the picture is at (the time model's lap times and gaps, MXWar.Time), so a line never tells what the picture has not shown.
     Wes calls it (numbers, fights, the order), Hutch explains it (what it means, what a rider needs, the history).
     ================================================================================================================================= */
  function TMm(){ var R=A.R, T=TIME(); return R&&R.tm&&T?T:null; }
  /* the race clock (model ms) the picture is at: the leader's line at the start of this lap plus the time since, never past the line of the
     last lap decided (the field waits there for the next cards); a lap shown shorter than the real one runs the clock faster in proportion */
  function lapSpan(b){ var R=A.R, T=TMm(), tm=R.tm, t0=b>1?T.leaderLine(R,b-1):0, t1=tm.k>=b?T.leaderLine(R,b):null; if(t0==null) t0=0; return {t0:t0,span:t1!=null&&t1>t0?t1-t0:(b===1&&tm.fl>0?tm.fl:tm.p)*1000}; }
  /* the page's own race clock when it gives one (o.clock() -> {t: ms, rate: race ms per page ms}: the view that rides the time model) */
  function pageClock(){ if(typeof o.clock!=="function") return null; var c=null; try{ c=o.clock(); }catch(e){ c=null; } return c&&c.t>=0&&isFinite(c.t)?c:null; }
  function rclock(){
    var r=A.race, R=A.R, T=TMm(); if(!r||!T||!r.gated) return null;
    var pc=pageClock(); if(pc){ var lim0=T.clockLimit(R), c0=pc.t; if(isFinite(lim0)&&c0>lim0) c0=lim0; if(R.tm.done&&R.tm.flag!=null&&c0>R.tm.flag) c0=R.tm.flag; return Math.max(0,Math.round(c0)); }
    var b=Math.max(1,r.lap|0), ls=lapSpan(b), rate=o.lapMs>0?ls.span/Math.max(1,lapLen(b)):1;
    var c=ls.t0+Math.max(0,A.now-rideAt(r,b))*rate, lim=T.clockLimit(R);
    if(isFinite(lim)&&c>lim) c=lim;
    if(R.tm.done&&R.tm.flag!=null&&c>R.tm.flag) c=R.tm.flag;
    return Math.max(0,Math.round(c));
  }
  /* the commentator's own time of a moment of the race clock in the lap now riding (a pass the picture will show) */
  function screenAt(cms){ var r=A.race; if(!r||!TMm()) return A.now; var pc=pageClock(); if(pc) return A.now+(cms-pc.t)/(pc.rate>0?pc.rate:1); var b=Math.max(1,r.lap|0), ls=lapSpan(b), rate=o.lapMs>0?ls.span/Math.max(1,lapLen(b)):1; return rideAt(r,b)+(cms-ls.t0)/rate; }
  /* when the race clock started riding lap b on screen: as its battle was decided (the cards turn as the leader reaches the line; a war holds the
     field there until it is settled) */
  function rideAt(r,b){ return r.rideLap===b&&r.rideAt!=null?r.rideAt:(r.lapAt||A.now); }
  var rowsMemo={c:-1,k:-1,R:null,rows:null};
  function liveRows(at){
    var T=TMm(), c=at!=null?at:rclock(); if(!T||c==null) return null;
    var R=A.R; if(rowsMemo.R===R&&rowsMemo.c===c&&rowsMemo.k===R.tm.k) return rowsMemo.rows;
    var rows=null; try{ rows=T.walker(R).rows(c); }catch(e){ if(o.debug) throw e; rows=null; }
    rowsMemo={c:c,k:R.tm.k,R:R,rows:rows}; return rows;
  }
  function rowOf(rows,s){ for(var i=0;i<rows.length;i++) if(rows[i].s===s) return rows[i]; return null; }
  /* laps down on the leader (the tower's "+1 Lap"): 0 on the lead lap; a lapped rider's gap is told in laps, never in seconds */
  /* the gap to the rider just ahead (s): the tower's own (riders on the lead lap), else from the time model for two lapped riders racing each other */
  function intOf(x,ah,cl){ if(!x||!ah) return null; if(x.int!=null) return x.int; var T=TMm(); if(!T||x.pr==null||ah.pr==null||ah.pr<x.pr) return null; var ta=null; try{ ta=T.timeAt(A.R,ah.s,x.pr); }catch(e){ ta=null; } return ta==null?null:Math.round(cl-ta)/1000; }
  function lapsDown(rows,x){ var ld=rows&&rows[0]; if(!ld||!x||x===ld||ld.pr==null||x.pr==null) return 0; var a=Math.floor(ld.pr), b=Math.floor(x.pr), dl=a-b-(ld.pr-a<x.pr-b?1:0); return dl>0?dl:0; }
  function onTrack(x){ return !!(x&&!x.dnf&&x.status!=="out"&&x.status!=="pits"); }
  function racingRow(x){ return !!(x&&!x.dnf&&x.status==="run"); }
  function crossT(s,k){ var T=A.R.tm.r[s].T; return k>=1&&T.length>=k?T[k-1]:null; }
  function lapsBy(s,c){ var T=A.R.tm.r[s].T, n=0; while(n<T.length&&T[n]<=c) n++; return n; }
  function crossGap(sa,sb,k){ var a=crossT(sa,k), b=crossT(sb,k); return a!=null&&b!=null?(b-a)/1000:null; }
  function lineLeader(k){ var best=-1, bt=Infinity, n=A.R.tm.r.length; for(var s=0;s<n;s++){ var t=crossT(s,k); if(t!=null&&t<bt){ bt=t; best=s; } } return best; }
  /* the gap from a (ahead) to b over the last laps at the line: "closing" (b gains 0.4 s or more), "away" (a pulls out), "steady" (locked
     within 0.3 s, both under 1.5 s behind) - and the live gap now must agree with the trend */
  function trendOf(sa,sb,c,now){
    var K=Math.min(lapsBy(sa,c),lapsBy(sb,c)); if(K<3) return null;
    for(var m=3;m>=2;m--){
      if(K-m<1) continue;
      var g1=crossGap(sa,sb,K), g0=crossGap(sa,sb,K-m); if(g1==null||g0==null||g1<0||g0<0) continue;
      var d=g1-g0, live=now!=null?now:g1;
      if(d<=-0.4&&live<g0-0.2) return {kind:"closing",m:m,g0:g0,g1:g1,d:d,K:K};
      if(d>=0.4&&live>g0+0.2) return {kind:"away",m:m,g0:g0,g1:g1,d:d,K:K};
      if(Math.abs(d)<0.3&&Math.max(g0,g1)<=1.5&&Math.abs(live-g0)<0.4) return {kind:"steady",m:m,g0:g0,g1:g1,d:d,K:K};
      return null;
    }
    return null;
  }
  /* the live running order as slots (p1..p5 full names, last1..last5 last names) */
  function liveOrderSlots(sl,rows){
    ["p1","p2","p3","p4","p5","last1","last2","last3","last4","last5","gap"].forEach(function(k){ delete sl[k]; });
    var al=rows.filter(onTrack);
    ["p1","p2","p3","p4","p5"].forEach(function(k,i){ if(al[i]) sl[k]=nameRec(seatId(al[i].s)).full; });
    ["last1","last2","last3","last4","last5"].forEach(function(k,i){ if(al[i]) sl[k]=nameRec(seatId(al[i].s)).last; });
    return al;
  }
  /* a talk line's context: the round and the race as always, the order from the clock, the facts it states (checked by the tests) */
  function talkBase(topic,cl,rows){
    var c=baseCtx(); c.facts.ev="talk"; c.facts.topic=topic; c.facts.clock=cl; c.facts.named=[];
    if(rows) liveOrderSlots(c.slots,rows);
    return c;
  }
  function humanSeats(){ var out=[]; (A.rmap||[]).forEach(function(id,s){ var R=rider(id); if(R&&R.kind==="human") out.push(s); }); return out; }
  function leftLaps(){ var r=A.race; return r?r.len-r.lap+1:0; }
  /* least recently used among a topic's variants that have something to say */
  function pickVar(topic,list){
    if(!list.length) return null; var m=A.tk.sig[topic]||(A.tk.sig[topic]={});
    list.sort(function(a,b){ return (m[a.v]||0)-(m[b.v]||0)||(b.w||1)-(a.w||1); });
    var top=list.filter(function(x){ return (m[x.v]||0)===(m[list[0].v]||0); });
    var pk=top.length>1?top[Math.floor(rnd()*top.length)]:list[0];
    return pk;
  }
  function useVar(topic,v){ (A.tk.sig[topic]||(A.tk.sig[topic]={}))[v]=A.now; }

  /* ---- 1. the live battles: two riders inside 1.2 s, side by side or closing, the trend at the line, the war that set it up ---- */
  function topicBattle(rows,cl){
    var r=A.race, cands=[];
    for(var i=1;i<rows.length&&i<16;i++){
      var a=rows[i-1], b=rows[i]; if(!racingRow(a)||!racingRow(b)||b.place!==a.place+1||b.int==null||b.int>1.2) continue;
      var hum=isHumanSeat(a.s)||isHumanSeat(b.s), key=Math.min(a.s,b.s)+"|"+Math.max(a.s,b.s), lastP=A.tk.pair[key];
      if(lastP!=null&&A.now-lastP<(hum?16000:24000)) continue;
      cands.push({a:a,b:b,key:key,sc:1.3-Math.min(a.place,12)*0.06+(hum?0.5:0)+(b.int<=0.35?0.15:0)});
    }
    if(!cands.length) return null;
    cands.sort(function(x,y){ return y.sc-x.sc; }); var pk=cands[0];
    return {k:"battle",ev:"talk_battle",sc:pk.sc,fp:0.3,ctx:battleCtx(pk.a.s,pk.b.s),subj:[pk.a.s,pk.b.s],mark:function(){ A.tk.pair[pk.key]=A.now; A.tk.rider[seatId(pk.a.s)]=A.now; A.tk.rider[seatId(pk.b.s)]=A.now; }};
  }
  function battleCtx(sa,sb){
    return function(){
      var r=A.race, cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var a=rowOf(rows,sa), b=rowOf(rows,sb); if(!racingRow(a)||!racingRow(b)||b.place!==a.place+1||b.int==null||b.int>1.5) return null;
      var c=talkBase("battle",cl,rows), sl=c.slots, t=c.tags, ia=seatId(sa), ib=seatId(sb), na=nameRec(ia), nb=nameRec(ib);
      sl.a=na.full; sl.b=nb.full; sl.aLast=na.last; sl.bLast=nb.last; sl.place=ordV(a.place); var gv=gapSecV(b.int); if(gv) sl.gap=gv;
      if(b.int<=0.35) t.side=1; else t.close=1;
      c.facts.seats=[sa,sb]; c.facts.places=[a.place,b.place]; c.facts.gapS=b.int; c.facts.named=[ia,ib]; c.facts.livePlace=a.place;
      var tr=trendOf(sa,sb,cl,b.int);
      if(tr){ t[tr.kind]=1; var g0=gapSecV(tr.g0), cut=gapSecV(Math.abs(tr.d)); if(g0) sl.gap0=g0; if(cut) sl.cutBy=cut; sl.kLaps=cntV(tr.m,"lap","laps"); c.facts.trend={kind:tr.kind,m:tr.m,K:tr.K,g0:tr.g0,g1:tr.g1}; }
      /* the war that set this fight up: both of them tied, one of them won it, in the last five laps */
      var wl=(r.warLog||[]).filter(function(w){ return w.seats.indexOf(sa)>=0&&w.seats.indexOf(sb)>=0&&(w.win===sa||w.win===sb)&&w.lap>=r.lap-5; }).pop();
      if(wl){ var cp=wl.card!=null?cardPV(wl.card):null, wc=wl.wc!=null?cardV(wl.wc):null, los=wl.win===sa?sb:sa;
        if(cp&&wc){ t.war=1; sl.warLap=numV(wl.lap); sl.cardp=(RC()&&A.R&&RC().isWild(A.R,wl.card))?V("wild cards"):cp; sl.wLast=nameRec(seatId(wl.win)).last; sl.lLast=nameRec(seatId(los)).last; sl.wcard=wc; c.facts.war={lap:wl.lap,win:seatId(wl.win),los:seatId(los),card:rankOf(wl.card),wc:rankOf(wl.wc)}; } }
      var cc=rows[b.place]; if(racingRow(cc)&&cc.place===b.place+1&&cc.int!=null&&cc.int<=1.2){ var nc=nameRec(seatId(cc.s)); t.many=1; sl.c=nc.full; sl.cLast=nc.last; c.facts.seats.push(cc.s); c.facts.named.push(nc.id); c.facts.places.push(cc.place); c.facts.gapC=cc.int; }
      if(a.place===1) t.lead=1; else if(a.place===2) t.second=1; else if(a.place===3) t.third=1;
      if(a.place<=5&&a.place>1) t.top5=1;
      var hum=na.human||nb.human; if(a.place>=8&&!hum) t.back=1;
      if(na.make&&nb.make&&na.make.c===nb.make.c){ t.mates=1; sl.make=na.make; }
      if(r.cut>0&&a.place===r.cut) t.cutfight=1;
      if(na.human){ t.you=1; t.youAhead=1; sl.you=na.full; sl.otherLast=nb.last; c.human=true; }
      else if(nb.human){ t.you=1; t.youBehind=1; sl.you=nb.full; sl.otherLast=na.last; c.human=true; }
      if(cc&&t.many&&isHumanSeat(cc.s)) c.human=true;
      c.story={kind:"battle",riders:c.facts.seats.slice()};
      return c;
    };
  }

  /* ---- 2. the person's own rider: the place, the gaps ahead and behind, what he needs ---- */
  function topicYou(rows,cl){
    var hs=humanSeats().filter(function(s){ var x=rowOf(rows,s); return x&&onTrack(x)&&x.status!=="down"; });
    if(!hs.length) return null;
    hs.sort(function(a,b){ return (A.tk.rider[seatId(a)]||0)-(A.tk.rider[seatId(b)]||0); });
    var s=hs[0], me=rowOf(rows,s), ah=me&&me.place>1?rows[me.place-2]:null, bh=me?rows[me.place]:null;
    var sig="you:"+s+":"+(me?me.place:0)+":"+(ah?ah.s:-1)+":"+(bh?bh.s:-1);
    return {k:"you",ev:"talk_you",sc:me&&me.place===1?0.75:me&&lapsDown(rows,me)>0?0.7:me&&me.place>10?0.85:1,sig:sig,fp:0.3,ctx:youTalkCtx(s),subj:[s],mark:function(){ A.tk.rider[seatId(s)]=A.now; }};
  }
  /* what the person's own talk last told (which fact, its value, when): the same fact is not told again inside 75 s unless it changed (no
     "Pinney is 1.7 seconds back" and then "Pinney is 1.8 seconds behind Maverick") */
  var YOUF={ahead:function(f){ return f.ahead+":"+Math.round((f.gapA||0)*2); },behind:function(f){ return f.behind+":"+Math.round((f.gapB||0)*2); },
    gapL:function(f){ return Math.round((f.gapL||0)/2); },lapped:function(f){ return f.down+":"+f.lp; },placeNew:function(f){ return f.lp; }};
  function noteYouFacts(tpl,ctx){ var m=A.tk.yf||(A.tk.yf={}); tplTags(tpl).forEach(function(tg){ if(YOUF[tg]) m[tg]={v:YOUF[tg](ctx.facts||{}),at:A.now}; }); }
  function youFresh(tag,f){ var m=A.tk.yf&&A.tk.yf[tag]; return !(m&&A.now-m.at<75000&&m.v===YOUF[tag](f)); }
  function youTalkCtx(s){
    return function(){
      var r=A.race, cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var me=rowOf(rows,s); if(!onTrack(me)) return null;
      var c=talkBase("you",cl,rows), sl=c.slots, t=c.tags, id=seatId(s), p=me.place;
      sl.you=nameRec(id).full; sl.place=ordV(p); c.human=true; c.facts.you=id; c.facts.lp=p; c.facts.named=[id]; c.facts.livePlace=p;
      var ah=p>1?rows[p-2]:null, bh=rows[p]||null;
      var iA=ah&&onTrack(ah)?intOf(me,ah,cl):null, iB=bh&&onTrack(bh)?intOf(bh,me,cl):null;
      if(iA!=null&&iA>=0){ var ga=gapSecV(iA); if(ga){ t.ahead=1; sl.aheadLast=nameRec(seatId(ah.s)).last; sl.gapA=ga; c.facts.ahead=seatId(ah.s); c.facts.gapA=iA; if(iA<=1.5) t.aheadClose=1; } }
      if(iB!=null&&iB>=0){ var gb=gapSecV(iB); if(gb){ t.behind=1; sl.behindLast=nameRec(seatId(bh.s)).last; sl.gapB=gb; c.facts.behind=seatId(bh.s); c.facts.gapB=iB; if(iB<=1.5) t.behindClose=1; } }
      if(p===1) t.lead=1; else if(p<=3) t.podium=1;
      if(p>=4&&p<=6){ t.toPodium=1; sl.toPodN=cntV(p-3,"spot","spots"); if(p===4) t.reach=1; }
      if(p>=7&&p<=10&&!(r.cut>0)) t.top10=1;   /* a heat's story is the transfer line, not the top ten */
      if(p>=11&&p<=15&&!(r.cut>0)){ t.toTen=1; sl.toTenN=cntV(p-10,"spot","spots"); }
      if(p>=12) t.back=1;
      if(r.cut>0){ if(p<=r.cut) t.in=1; else { t.out=1; sl.toCutN=cntV(p-r.cut,"spot","spots"); if(p===r.cut+1) t.bubble=1; } c.facts.cut=r.cut; }
      var dn=lapsDown(rows,me);
      if(dn>0){ t.lapped=1; sl.downN=dn===1?V("a lap"):cntV(dn,"lap","laps"); c.facts.down=dn; }
      else if(p>1&&me.gs!=null&&rows[0]&&onTrack(rows[0])){ var gl=gapSecV(me.gs); if(gl){ t.gapL=1; sl.gapL=gl; sl.leaderLast=nameRec(seatId(rows[0].s)).last; c.facts.gapL=me.gs; c.facts.leader=seatId(rows[0].s); } }
      /* against the opening lap: the spots made up or lost since (a race of more than two laps) */
      var sp=r.startPlace&&r.startPlace[s];
      if(sp>0&&r.lap>=3&&!t.lapped){ if(sp-p>=2){ t.gainedStart=1; sl.gainN=cntV(sp-p,"spot","spots"); sl.startPlace=ordV(sp); c.facts.startPlace=sp; } else if(p-sp>=2){ t.lostStart=1; sl.lostN=cntV(p-sp,"spot","spots"); sl.startPlace=ordV(sp); c.facts.startPlace=sp; } }
      if(!t.lapped&&(p<=Math.max(3,Math.ceil(rows.filter(onTrack).length/2))||t.gainedStart)) t.smart=1;   /* "a smart race" only for a rider who is having one */
      if(t.ahead&&!youFresh("ahead",c.facts)){ delete t.ahead; delete t.aheadClose; }
      if(t.behind&&!youFresh("behind",c.facts)){ delete t.behind; delete t.behindClose; }
      if(t.gapL&&!youFresh("gapL",c.facts)) delete t.gapL;
      if(t.lapped&&!youFresh("lapped",c.facts)) delete t.lapped;
      if(youFresh("placeNew",c.facts)) t.placeNew=1;
      c.story={kind:"you",riders:[s],label:nameRec(id).full.c};
      return c;
    };
  }

  /* ---- 3. the leader: the lead in seconds, its trend at the line, the laps he has led ---- */
  function topicLeader(rows,cl){
    var a=rows[0], b=rows[1]; if(!racingRow(a)||!onTrack(b)||b.gs==null||b.gs<0.4) return null;
    if(isHumanSeat(a.s)) return null;   /* the person leading: his own talk tells the lead (no "Maverick leads by 4 s" twice over) */
    return {k:"leader",ev:"talk_leader",sc:1,sig:"leader:"+a.s+":"+b.s+":"+Math.round(b.gs),fp:0.3,ctx:leaderTalkCtx(a.s,b.s),subj:[a.s,b.s],mark:function(){ A.tk.rider[seatId(a.s)]=A.now; }};
  }
  function leaderTalkCtx(sa,sb){
    return function(){
      var r=A.race, cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var a=rows[0], b=rows[1]; if(!a||!b||a.s!==sa||b.s!==sb||!racingRow(a)||!onTrack(b)||b.gs==null||lapsDown(rows,b)) return null;
      var gv=gapSecV(b.gs); if(!gv) return null;
      var c=talkBase("leader",cl,rows), sl=c.slots, t=c.tags; sl.gap=gv;
      c.facts.seats=[sa,sb]; c.facts.gapS=b.gs; c.facts.named=[seatId(sa),seatId(sb)]; c.facts.livePlace=1;
      if(b.gs<=1.5) t.small=1; else if(b.gs>=5) t.big=1;
      var K=Math.min(lapsBy(sa,cl),lapsBy(sb,cl));
      if(K>=3){ var m=K>=4?3:2, g1=crossGap(sa,sb,K), g0=crossGap(sa,sb,K-m);
        if(g1!=null&&g0!=null&&g1>0&&g0>0){ var d=g1-g0;
          if(d>=0.5&&b.gs>g0+0.2) t.growing=1; else if(d<=-0.5&&b.gs<g0-0.2) t.shrinking=1; else if(Math.abs(d)<0.3&&Math.abs(b.gs-g0)<0.5) t.steady=1;
          if(t.growing||t.shrinking||t.steady){ var gg=gapSecV(g0); if(gg) sl.gap0=gg; sl.kLaps=cntV(m,"lap","laps"); c.facts.trend={m:m,K:K,g0:g0,g1:g1}; } } }
      var KL=lapsBy(sa,cl), led=0; for(var k=1;k<=KL;k++) if(lineLeader(k)===sa) led++;
      if(led>=3){ t.ledk=1; sl.ledN=cntV(led,"lap","laps"); c.facts.led=led; }
      if(KL>=4&&led===KL){ t.ledall=1; c.facts.ledAll=KL; }
      if(isHumanSeat(sa)||isHumanSeat(sb)) c.human=true;
      c.story={kind:"leader",riders:[sa,sb]};
      return c;
    };
  }

  /* ---- the leader at the line: a few words while the next lap's cards are a moment away (only when nothing longer fits before them) ---- */
  function lineTalkCtx(){
    return function(){
      var r=A.race, cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows||r.flagged) return null;
      var a=rows[0], b=rows[1]; if(!racingRow(a)) return null;
      var c=talkBase("line",cl,rows), sl=c.slots, t=c.tags, ia=seatId(a.s);
      c.facts.seats=[a.s]; c.facts.named=[ia]; c.facts.livePlace=1;
      if(r.lap<r.len){ t.next=1; sl.nextLap=numV(r.lap+1); }
      if(onTrack(b)&&b.gs!=null&&!lapsDown(rows,b)){ if(b.gs<=1){ t.near=1; c.facts.named.push(seatId(b.s)); c.facts.seats.push(b.s); c.facts.gapS=b.gs; } else if(b.gs>=3){ t.clear=1; c.facts.gapS=b.gs; } }
      if(isHumanSeat(a.s)||(t.near&&isHumanSeat(b.s))) c.human=true;
      c.story={kind:"leader",riders:[a.s]};
      return c;
    };
  }

  /* ---- 4. the top five ---- */
  function topicTop5(rows,cl){
    var al=rows.filter(onTrack); if(al.length<8) return null;
    return {k:"top5",ev:"talk_top5",sc:1,fp:0.15,ctx:function(){
      var cl2=rclock(), rows2=cl2!=null?liveRows(cl2):null; if(!rows2) return null;
      var c=talkBase("top5",cl2,rows2), sl=c.slots, t=c.tags, al2=rows2.filter(onTrack); if(al2.length<5) return null;
      c.facts.order=al2.slice(0,5).map(function(x){ return seatId(x.s); }); c.facts.named=c.facts.order.slice(); c.facts.livePlace=1;
      [[2,"gap3"],[3,"gap4"],[4,"gap5"]].forEach(function(z){ var x=al2[z[0]]; if(x&&x.gs!=null&&!lapsDown(rows2,x)){ var v=gapSecV(x.gs); if(v){ sl[z[1]]=v; t[z[1]]=1; c.facts[z[1]]=x.gs; } } });
      if(al2.slice(1,5).every(function(x){ return x.int!=null&&x.int>=2; })) t.spread=1;
      if(t.gap5&&al2[4].gs<=5) t.tight5=1;
      if(al2.slice(0,5).some(function(x){ return isHumanSeat(x.s); })) c.human=true;
      c.story={kind:"leader",riders:al2.slice(0,3).map(function(x){ return x.s; })};
      return c; }};
  }

  /* ---- 5. lap times: the fastest lap of the race, a new one, the leader's last lap, the person's, the quickest on the last lap ---- */
  function topicLaps(rows,cl){
    var r=A.race, R=A.R, T=TMm(), lead=rows[0]; if(!lead||!onTrack(lead)) return null;
    var best=null; rows.forEach(function(x){ if(x.best!=null&&x.bestK>=2&&(!best||x.best<best.t)) best={s:x.s,t:x.best,k:x.bestK}; });
    var vs=[], bestKey=best?best.s+"@"+best.k:null, lspan=lapSpan(Math.max(1,r.lap|0)).span;
    if(best){ var bt=crossT(best.s,best.k); var fresh=bt!=null&&bt<=cl&&cl-bt<lspan*0.8&&A.tk.bestSaid!==bestKey; vs.push({v:fresh?"bestNew":"best",w:fresh?3:1}); if(isHumanSeat(best.s)) vs.push({v:"bestYou",w:2}); }
    if(lead.last!=null&&lead.lastK>=2) vs.push({v:"leadLap",w:1});
    var hs=humanSeats().filter(function(s){ var x=rowOf(rows,s); return x&&onTrack(x)&&x.last!=null&&x.lastK>=2; }); if(hs.length) vs.push({v:"youLap",w:1.5});
    var K=lead.lastK|0, quick=null;
    if(K>=2) rows.forEach(function(x){ if(!onTrack(x)||lapsBy(x.s,cl)<K||R.tm.r[x.s].hold[K]||R.tm.yz[K]) return; var lt=(crossT(x.s,K)-crossT(x.s,K-1))/1000; if(!quick||lt<quick.t) quick={s:x.s,t:lt,k:K}; });
    if(quick&&quick.s!==lead.s) vs.push({v:"quick",w:1});
    var pk=pickVar("laps",vs); if(!pk) return null;
    return {k:"laps",ev:"talk_laps",sc:pk.v==="bestNew"?1.4:1,fp:0.25,ctx:lapsTalkCtx(pk.v,best,quick,hs[0]),mark:function(){ useVar("laps",pk.v); if(pk.v==="bestNew"||pk.v==="best"||pk.v==="bestYou") A.tk.bestSaid=bestKey; }};
  }
  function lapsTalkCtx(v,best,quick,hseat){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var c=talkBase("laps",cl,rows), sl=c.slots, t=c.tags, lead=rows[0]; c.facts.v=v;
      if(v==="best"||v==="bestNew"||v==="bestYou"){ if(!best) return null; var bx=rowOf(rows,best.s); if(!bx||bx.best==null||Math.abs(bx.best-best.t)>0.0005) return null;
        t[v==="bestYou"?"bestYou":v]=1; if(v==="bestYou"){ t.you=1; sl.you=nameRec(seatId(best.s)).full; c.human=true; } sl.bestBy=nameRec(seatId(best.s)).last; sl.bestLap=lapTimeV(best.t); sl.bestLapNo=numV(best.k);
        c.facts.best={s:best.s,t:best.t,k:best.k}; c.facts.named=[seatId(best.s)]; c.facts.livePlace=bx.place; }
      else if(v==="leadLap"){ if(!onTrack(lead)||lead.last==null) return null; t.leadLap=1; sl.lapTime=lapTimeV(lead.last); c.facts.lapOf={s:lead.s,t:lead.last,k:lead.lastK}; c.facts.named=[seatId(lead.s)]; c.facts.livePlace=1; }
      else if(v==="youLap"){ var me=rowOf(rows,hseat); if(!me||me.last==null) return null; t.youLap=1; t.you=1; sl.you=nameRec(seatId(hseat)).full; sl.lapTime=lapTimeV(me.last); c.human=true; c.facts.lapOf={s:hseat,t:me.last,k:me.lastK}; c.facts.named=[seatId(hseat)]; c.facts.livePlace=me.place; }
      else if(v==="quick"){ if(!quick) return null; var qx=rowOf(rows,quick.s); if(!qx) return null; t.quick=1; sl.quickLast=nameRec(seatId(quick.s)).last; sl.quickTime=lapTimeV(quick.t); c.facts.quick={s:quick.s,t:quick.t,k:quick.k}; c.facts.named=[seatId(quick.s)]; c.facts.livePlace=qx.place; if(isHumanSeat(quick.s)) c.human=true; }
      if(A.race&&A.race.lap>A.race.len/2) t.half2=1;
      c.story={kind:"leader",riders:lead?[lead.s]:[]};
      return c;
    };
  }

  /* ---- 6. crashes and what they cost: where he was when he went down, where he is now ---- */
  function topicCrash(rows,cl){
    var r=A.race, R=A.R, T=TMm(), log=(r.crashLog||[]).filter(function(x){ return x.at<=A.now-6000&&(x.n|0)<2&&A.now-(x.said||-1e9)>25000&&x.lap>=r.lap-6; });
    if(!log.length) return null;
    log.sort(function(a,b){ return (isHumanSeat(b.s)?1:0)-(isHumanSeat(a.s)?1:0)||a.from-b.from||b.lap-a.lap; });
    var x=log[0];
    return {k:"crash",ev:"talk_crash",sc:1+(x.from<=5?0.3:0),fp:0.35,ctx:crashTalkCtx(x),subj:[x.s],mark:function(){ x.n=(x.n|0)+1; x.said=A.now; }};
  }
  function crashPlace(x){
    var R=A.R, T=TMm(), hw=T.holdWindow(R,x.s,x.lap), at=hw?hw[0]:null;
    if(at==null) return x.from;
    try{ var tw=T.tower(R,Math.max(0,at-50)), rw=rowOf(tw,x.s); return rw?rw.place:x.from; }catch(e){ return x.from; }
  }
  function crashTalkCtx(x){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var me=rowOf(rows,x.s); if(!me) return null;
      var c=talkBase("crash",cl,rows), sl=c.slots, t=c.tags, id=seatId(x.s), was=crashPlace(x);
      riderSlots(sl,id); sl.crashLap=numV(x.lap); sl.from=ordV(was); c.facts.crash2={s:x.s,lap:x.lap,kind:x.kind,was:was}; c.facts.named=[id];
      var out=!!(me.dnf&&me.dnf.why==="crash");
      if(out){ t.out=1; c.facts.out=true; c.facts.livePlace=was; }
      else { if(!onTrack(me)||me.status==="down") return null; t.remount=1; sl.place=ordV(me.place); c.facts.lp=me.place; c.facts.livePlace=me.place;
        if(me.place>was){ t.lost=1; sl.lostN=cntV(me.place-was,"spot","spots"); } else t.back=1; }
      if(isHumanSeat(x.s)){ t.you=1; sl.you=nameRec(id).full; c.human=true; c.facts.you=id; }
      c.story={kind:"battle",riders:[x.s]};
      return c;
    };
  }

  /* ---- 7. the points as they run (a final that pays points race by race: the season's points + this round's finals so far + this race now) ---- */
  function pointsCase(rows){
    var r=A.race, Gs=A.G, rc=r.rc||roundCtx(), F=r.F; if(!r.isFinal||!F||F.pointsOn!=="race"||!F.table||!rc||!rc.cal||!rc.cal.title) return null;
    var mult=rc.cal.mult||1, T2=F.table, now={}, base={}, RG=Gs.round&&Gs.round.ri===rc.ri?Gs.round:null;
    /* the engine may have scored this round already (its last race ended; the picture still shows the last lap): the points before it */
    var done=(Gs.results||[]).filter(function(x){ return x.ri===rc.ri; })[0], dp=done&&done.pts||{};
    var L0=sstand(); if(L0.length<2) return null;
    L0.forEach(function(x){ base[x.id]=(x.pts||0)-(dp[x.id]||0); });
    var L=L0.slice().sort(function(a,b){ return base[b.id]-base[a.id]; }); if(!(base[L[0].id]>0)) return null;
    var fin=RG?RG.races.filter(function(x){ return x.st<0; }):(done?(done.races||[]).filter(function(x){ return /^final-/.test(x.key); }):[]);
    fin.forEach(function(x){ if(x.res&&x.key!==r.key) x.res.forEach(function(id,p){ base[id]=(base[id]||0)+(T2[p]||0)*mult; }); });
    var al=rows.filter(function(x){ return !!x; });
    for(var id in base) now[id]=base[id];
    al.forEach(function(x){ var rid=seatId(x.s); now[rid]=(now[rid]||base[rid]||0)+(T2[x.place-1]||0)*mult; });
    return {T:T2,mult:mult,base:base,now:now,red:L[0].id,second:L[1].id};
  }
  function topicPoints(rows,cl){
    var pc=pointsCase(rows); if(!pc) return null;
    var redRow=rowOf(rows,(A.rmap||[]).indexOf(pc.red)), vs=[], top=null, tn=-1, tie=false;
    for(var id in pc.now){ if(pc.now[id]>tn){ tn=pc.now[id]; top=id; tie=false; } else if(pc.now[id]===tn) tie=true; }
    if(!tie&&top===pc.red&&redRow) vs.push({v:"keeps",w:1});
    if(!tie&&top!==pc.red&&(A.rmap||[]).indexOf(top)>=0) vs.push({v:"newRed",w:2.5});
    if(redRow&&onTrack(redRow)) vs.push({v:"red",w:1});
    var sRow=rowOf(rows,(A.rmap||[]).indexOf(pc.second)); if(redRow&&sRow&&onTrack(sRow)&&sRow.place<redRow.place&&(pc.T[sRow.place-1]||0)>(pc.T[redRow.place-1]||0)) vs.push({v:"gain",w:1.5});
    var hs=humanSeats().filter(function(s){ var x=rowOf(rows,s); return x&&onTrack(x)&&(pc.T[x.place-1]||0)>0; }); if(hs.length) vs.push({v:"you",w:1.5});
    var pk=pickVar("points",vs); if(!pk) return null;
    return {k:"points",ev:"talk_points",sc:pk.v==="newRed"?1.3:1,fp:0.35,ctx:pointsTalkCtx(pk.v,top,hs[0]),mark:function(){ useVar("points",pk.v); }};
  }
  function pointsTalkCtx(v,top,hseat){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var pc=pointsCase(rows); if(!pc) return null;
      var c=talkBase("points",cl,rows), sl=c.slots, t=c.tags, seatOfId=function(id){ return (A.rmap||[]).indexOf(id); }, redS=seatOfId(pc.red), redRow=rowOf(rows,redS);
      var nr=nameRec(pc.red); sl.red=nr.full; sl.redLast=nr.last; c.facts.v=v; c.facts.points={red:pc.red,second:pc.second};
      if(v==="keeps"){ var tn=-1, tp=null; for(var id in pc.now) if(pc.now[id]>tn){ tn=pc.now[id]; tp=id; } if(tp!==pc.red) return null; t.keeps=1; t.red=1; c.facts.named=[pc.red]; c.facts.points.now=pc.now[pc.red]; }
      else if(v==="newRed"){ if(!top||seatOfId(top)<0) return null; var tn2=pc.now[top]; for(var id2 in pc.now) if(id2!==top&&pc.now[id2]>=tn2) return null; t.newRed=1; riderSlots(sl,top); c.facts.named=[top]; c.facts.points.top=top; c.facts.points.now=tn2; c.facts.livePlace=(rowOf(rows,seatOfId(top))||{}).place; }
      else if(v==="red"){ if(!onTrack(redRow)) return null; t.red=1; sl.place=ordV(redRow.place); c.facts.lp=redRow.place; c.facts.named=[pc.red]; c.facts.livePlace=redRow.place; }
      else if(v==="gain"){ var sRow=rowOf(rows,seatOfId(pc.second)); if(!sRow||!redRow) return null; var g=((pc.T[sRow.place-1]||0)-(pc.T[redRow.place-1]||0))*pc.mult; if(!(g>0)) return null;
        t.gain=1; var ns=nameRec(pc.second); sl.secondLast=ns.last; sl.place=ordV(sRow.place); sl.gainN=cntV(g,"point","points"); c.facts.gain=g; c.facts.lp=sRow.place; c.facts.named=[pc.second,pc.red]; c.facts.livePlace=Math.min(sRow.place,redRow.place); }
      else if(v==="you"){ var me=rowOf(rows,hseat); if(!me) return null; var pts=(pc.T[me.place-1]||0)*pc.mult; if(!(pts>0)) return null; t.you=1; sl.you=nameRec(seatId(hseat)).full; sl.ptsN=cntV(pts,"point","points"); c.facts.youPts=pts; c.facts.lp=me.place; c.human=true; c.facts.named=[seatId(hseat)]; c.facts.livePlace=me.place; }
      if(c.facts.named.some(function(id){ var R=rider(id); return R&&R.kind==="human"; })) c.human=true;
      return c;
    };
  }

  /* ---- 8. the race's numbers: wars, lead changes at the line, riders down, laps and wars won, the holeshot rider ---- */
  function topicStats(rows,cl){
    var r=A.race, vs=[], b=r.lap|0;
    if((r.wars|0)>=3) vs.push({v:"wars"});
    var KL=rows[0]?lapsBy(rows[0].s,cl):0, ch=0; for(var k=2;k<=KL;k++){ var l1=lineLeader(k), l0=lineLeader(k-1); if(l1>=0&&l0>=0&&l1!==l0) ch++; }
    if(ch>=2) vs.push({v:"changes"});
    var down=(r.crashLog||[]).filter(function(x){ return x.at<=A.now; }), who={}; down.forEach(function(x){ who[x.s]=1; }); var nd=Object.keys(who).length;
    if(nd>=2) vs.push({v:"crashes"}); else if(nd===1&&b>=4) vs.push({v:"crash1"}); else if(nd===0&&b>=4&&b>=r.len/4) vs.push({v:"nocrash"});
    var lw=r.lapWins||{}, ls=-1, ln=0; for(var s in lw) if(lw[s]>ln){ ln=lw[s]; ls=+s; } if(ln>=3) vs.push({v:"lapsWon"});
    var ww=r.warsWon||{}, ws=-1, wn=0; for(var s2 in ww) if(ww[s2]>wn){ wn=ww[s2]; ws=+s2; } if(wn>=2) vs.push({v:"warsWon"});
    if(r.hs>=0&&b>=3){ var hx=rowOf(rows,r.hs); if(hx&&onTrack(hx)) vs.push({v:hx.place===1?"hslead":"hsnow"}); }
    var pk=pickVar("stats",vs); if(!pk) return null;
    return {k:"stats",ev:"talk_stats",sc:1,fp:0.3,ctx:statsTalkCtx(pk.v,ch,nd,down,ls,ln,ws,wn),mark:function(){ useVar("stats",pk.v); }};
  }
  function statsTalkCtx(v,ch,nd,down,ls,ln,ws,wn){
    return function(){
      var r=A.race, cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var c=talkBase("stats",cl,rows), sl=c.slots, t=c.tags; c.facts.v=v; t[v]=1;
      if(v==="wars"){ sl.warsN=cntV(r.wars,"war","wars"); c.facts.wars=r.wars; }
      else if(v==="changes"){ sl.changesN=cntV(ch,"lead change","lead changes"); c.facts.changes=ch; }
      else if(v==="crashes"){ sl.crashedN=cntV(nd,"rider","riders"); c.facts.crashed=nd; }
      else if(v==="crash1"){ riderSlots(sl,seatId(down[0].s)); c.facts.crashed=1; c.facts.named=[seatId(down[0].s)]; if(isHumanSeat(down[0].s)) c.human=true; }
      else if(v==="nocrash"){ c.facts.crashed=0; }
      else if(v==="lapsWon"){ riderSlots(sl,seatId(ls)); sl.wonN=cntV(ln,"lap","laps"); c.facts.lapsWon={s:ls,n:ln}; c.facts.named=[seatId(ls)]; if(isHumanSeat(ls)) c.human=true; }
      else if(v==="warsWon"){ riderSlots(sl,seatId(ws)); sl.warsWonN=cntV(wn,"war","wars"); c.facts.warsWon={s:ws,n:wn}; c.facts.named=[seatId(ws)]; if(isHumanSeat(ws)) c.human=true; }
      else if(v==="hslead"||v==="hsnow"){ var hx=rowOf(rows,r.hs); if(!hx||!onTrack(hx)||(v==="hslead")!==(hx.place===1)) return null; riderSlots(sl,seatId(r.hs)); sl.place=ordV(hx.place); c.facts.hs=r.hs; c.facts.lp=hx.place; c.facts.named=[seatId(r.hs)]; c.facts.livePlace=hx.place; if(isHumanSeat(r.hs)) c.human=true; }
      if(sl.you) c.human=true;
      return c;
    };
  }

  /* ---- 9. the riders' season so far (THIS season, as raced here: the game's own results) ---- */
  function talkRiders(rows){
    var out=[], seen={}; function add(s){ if(s==null||s<0||seen[s]) return; var x=rowOf(rows,s); if(!x||!onTrack(x)) return; seen[s]=1; out.push(s); }
    var st=A.story; if(st&&st.riders) st.riders.forEach(add);
    rows.slice(0,10).forEach(function(x){ add(x.s); });
    return out;
  }
  function seasonFacts(id){
    var Gs=A.G, res=resNow(); if(!res.length) return null;
    var sp=splaceNow(id), L=standNow(), f={wins:0,lastWin:false,lastPlace:0,lastCity:null,pts:sp?sp.pts:0,place:sp?sp.place:0,pod:sp?sp.pod:0,hs:sp?sp.hs:0,rounds:res.length};
    res.forEach(function(x){ if(x.winner===id) f.wins++; });
    var lr=res[res.length-1]; f.lastCity=lr.city||lr.venue||null; var lp=lr.cls?lr.cls.indexOf(id):-1; f.lastPlace=lp>=0?lp+1:0; f.lastWin=lr.winner===id;
    var hsMax=0, hsTie=false; L.forEach(function(x){ if(x.id===id) return; if(x.hs>hsMax){ hsMax=x.hs; } }); f.hsMost=f.hs>=3&&f.hs>hsMax;
    return f;
  }
  /* a FACT (a rider's wins, his last result, a title...) is told once in a race, in whatever words: never the same fact twice over (and not again
     inside 30 minutes in the next race of the round) */
  function factUsed(key){ var m=A.tk.facts||(A.tk.facts={}), x=m[key]; return !!(x&&((A.race&&x.race===A.race.key)||A.now-x.at<1800000)); }
  function factSay(key){ (A.tk.facts||(A.tk.facts={}))[key]={race:A.race?A.race.key:null,at:A.now}; }
  function seasonVars(f){
    var vs=[];
    if(f.wins>=1) vs.push({v:"wins",w:f.wins>=3?2:1.5});
    if(f.lastCity&&placeV(f.lastCity)&&(f.lastWin||(f.lastPlace>=2&&f.lastPlace<=10))) vs.push({v:"last",w:f.lastWin?2:1});
    if(f.pts>0&&f.place>=1&&f.place<=10) vs.push({v:"pts",w:f.place===1?2:1});
    if(f.pod>=2) vs.push({v:"pod",w:1});
    if(f.hsMost) vs.push({v:"hs",w:1});
    if(f.wins===0&&f.rounds>=3&&f.pts>0&&f.place<=8) vs.push({v:"nowin",w:1});
    return vs;
  }
  function topicSeason(rows,cl){
    var cand=talkRiders(rows).filter(function(s){ var id=seatId(s); return A.now-(A.tk.rider[id]||-1e9)>20000&&A.now-(A.tk.season&&A.tk.season[id]||-1e9)>150000; });
    for(var i=0;i<cand.length;i++){ var s=cand[i], id=seatId(s), f=seasonFacts(id); if(!f) return null;
      var vs=seasonVars(f).filter(function(x){ return !factUsed(id+"|s|"+x.v); }); if(!vs.length) continue;
      vs.sort(function(a,b){ return b.w-a.w; }); var pk=vs[Math.floor(rnd()*Math.min(2,vs.length))];
      return {k:"season",ev:"talk_season",sc:1,fp:0,ctx:seasonTalkCtx(s,pk.v),subj:[s],mark:function(){ (A.tk.season=A.tk.season||{})[id]=A.now; A.tk.rider[id]=A.now; factSay(id+"|s|"+pk.v); }}; }
    return null;
  }
  function seasonTalkCtx(s,v){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var id=seatId(s), f=seasonFacts(id); if(!f) return null;
      var c=talkBase("season",cl,rows), sl=c.slots, t=c.tags, hum=isHumanSeat(s), me=rowOf(rows,s);
      riderSlots(sl,id); if(hum){ t.you=1; sl.you=nameRec(id).full; c.human=true; c.facts.you=id; }
      c.facts.season={id:id,wins:f.wins,lastWin:f.lastWin,lastPlace:f.lastPlace,lastCity:f.lastCity,place:f.place,pts:f.pts,pod:f.pod,hs:f.hs}; c.facts.named=[id]; if(me) c.facts.livePlace=me.place;
      if(v==="wins"){ if(f.wins<1) return null; t.wins=1; sl.winsN=cntV(f.wins,"win","wins"); if(f.wins>=3) t.winsMany=1; }
      else if(v==="last"){ var lc=f.lastCity?placeV(f.lastCity):null; if(!lc) return null; sl.lastCity=lc; if(f.lastWin) t.lastwin=1; else if(f.lastPlace>=2&&f.lastPlace<=10){ t.lastRound=1; sl.lastPlace=ordV(f.lastPlace); } else return null; }
      else if(v==="pts"){ if(!(f.pts>0)) return null; if(f.place===1) t.ptsLead=1; else if(f.place>=2&&f.place<=10){ t.ptsPos=1; sl.ptsPlace=ordV(f.place); } else return null; }
      else if(v==="pod"){ if(f.pod<2) return null; t.pod=1; sl.podN=cntV(f.pod,"podium","podiums"); }
      else if(v==="hs"){ if(!f.hsMost) return null; t.hs=1; t.hsMost=1; sl.hsN=cntV(f.hs,"holeshot","holeshots"); }
      else if(v==="nowin"){ if(f.wins!==0) return null; t.nowin=1; }
      else return null;
      c.facts.fact=v;
      c.story={kind:"battle",riders:[s]};
      return c;
    };
  }

  /* ---- 10. history (EARLIER seasons only: data/history.js read as of this round's date) ---- */
  function hbook(){
    var H=HIST(), Gs=A.G, rc=(A.race&&A.race.rc)||roundCtx(); if(!H||!Gs||!rc||!rc.cal) return null;
    var date=String(rc.cal.date||""), key=Gs.sid+"|"+date; if(A.hb&&A.hb.key===key) return A.hb;
    var ok={}, S=H.s;
    H.seasons.forEach(function(x,i){ if(date&&x[4]&&x[4]<date&&x[0]!==Gs.sid&&x[2]<=Gs.year) ok[i]=1; });
    var hb={key:key,date:date,H:H,ok:ok,people:{},city:normName(String(rc.cal.city||"").replace(/\s*,.*$/,""))};
    H.rs.forEach(function(r){ if(!ok[r[1]]) return; var p=hb.people[r[0]]||(hb.people[r[0]]={rs:[],titles:[]}); p.rs.push({i:r[1],pos:r[2],w:r[3]}); });
    H.seasons.forEach(function(x,i){ if(!ok[i]) return; var p=hb.people[x[5]]||(hb.people[x[5]]={rs:[],titles:[]}); p.titles.push(i); });
    hb.rounds=H.rounds.filter(function(rr){ return ok[rr[0]]&&rr[2]<date; });
    hb.series=[]; H.seasons.forEach(function(x,i){ if(ok[i]&&x[1]===Gs.series) hb.series.push(i); });
    hb.series.sort(function(a,b){ return H.seasons[a][4]<H.seasons[b][4]?-1:1; });
    A.hb=hb; return hb;
  }
  function hsx(i){ var x=A.hb.H.seasons[i]; return {i:i,id:x[0],series:x[1],year:x[2],last:x[4],champ:x[5],label:x[7]}; }
  function hname(pi){ var H=HIST(); return H.s[H.p[pi]]; }
  function personOf(id){ var H=HIST(), R=rider(id); if(!H||!R||R.kind==="human") return null; var k=normName(R.name), a=H.amb&&H.amb[k]; if(a) return a[A.G.sid]!=null?a[A.G.sid]:null; var p=H.names[k]; return p!=null?p:null; }
  function riderHist(pi){
    var hb=hbook(); if(!hb||pi==null) return null; var p=hb.people[pi]; if(!p) return null;
    var Gs=A.G, ser=Gs.series, out={titles:[],titlesSer:0,defending:false,lastYear:null,bestPos:null,lastWins:null,careerWins:0,wonHere:null};
    p.titles.forEach(function(i){ var x=hsx(i); out.titles.push(x); if(x.series===ser) out.titlesSer++; });
    out.titles.sort(function(a,b){ return a.last<b.last?-1:1; });
    var lastSer=hb.series.length?hsx(hb.series[hb.series.length-1]):null; if(lastSer&&lastSer.champ===pi) out.defending=lastSer;
    p.rs.forEach(function(r){ var x=hsx(r.i); if(x.series!==ser) return; out.careerWins+=r.w;
      if(x.year===Gs.year-1&&r.pos>=1&&r.pos<=10) out.lastYear={x:x,pos:r.pos};
      if(r.pos>=2&&r.pos<=3&&x.year!==Gs.year-1&&(!out.bestPos||r.pos<out.bestPos.pos||(r.pos===out.bestPos.pos&&x.year>out.bestPos.x.year))) out.bestPos={x:x,pos:r.pos};
      if(r.w>0&&(!out.lastWins||x.last>out.lastWins.x.last)) out.lastWins={x:x,w:r.w}; });
    hb.rounds.forEach(function(rr){ var x=hsx(rr[0]); if(x.series!==ser||rr[4]!==pi||normName(hb.H.s[rr[3]])!==hb.city) return; if(!out.wonHere||rr[2]>out.wonHere.date) out.wonHere={x:x,date:rr[2]}; });
    return out;
  }
  function topicRider(rows,cl){
    if(!hbook()) return null;
    var cand=talkRiders(rows).filter(function(s){ var id=seatId(s); return A.now-(A.tk.rider[id]||-1e9)>15000; });
    for(var i=0;i<cand.length;i++){
      var s=cand[i], id=seatId(s), pi=personOf(id), h=pi!=null?riderHist(pi):null; if(!h) continue;
      var vs=[], lt=h.titles.length?h.titles[h.titles.length-1]:null, add=function(v,w,key){ key="P"+pi+"|"+key; if(!factUsed(key)) vs.push({v:v,w:w,key:key}); };   /* keyed by the person: the venue and the series talk share them */
      if(lt) add("champ",2,"t"+lt.i); if(h.titlesSer>=2) add("titles",2,"n"+h.titlesSer); if(h.defending) add("defending",3,"t"+h.defending.i);
      if(h.lastYear) add("lastyear",1.5,(h.lastYear.pos===1?"t":"p")+h.lastYear.x.i); if(h.bestPos) add("pos",1,"p"+h.bestPos.x.i); if(h.lastWins) add("hwins",1.2,"w"+h.lastWins.x.i);
      if(h.careerWins>=3) add("cwins",1.2,"c"); if(h.wonHere) add("wonhere",2,"h"+h.wonHere.date);
      if(!vs.length) continue;
      vs.sort(function(a,b){ return (b.w||1)-(a.w||1); }); var pk=vs[Math.floor(rnd()*Math.min(2,vs.length))];
      return {k:"rider",ev:"talk_history",sc:1,fp:0,ctx:riderTalkCtx(s,pi,pk.v),subj:[s],mark:function(){ factSay(pk.key); A.tk.rider[id]=A.now; }};
    }
    return null;
  }
  function riderTalkCtx(s,pi,v){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null; if(!rows) return null;
      var id=seatId(s), h=riderHist(pi), me=rowOf(rows,s); if(!h||!me) return null;
      var c=talkBase("history",cl,rows), sl=c.slots, t=c.tags, refs=[];
      riderSlots(sl,id); sl.place=ordV(me.place); c.facts.lp=me.place; c.facts.named=[id]; c.facts.livePlace=me.place; c.facts.v=v; c.facts.person=pi;
      function yr(x){ refs.push({sid:x.id,year:x.year,last:x.last}); return V(String(x.year),yearWords(x.year)); }
      if(v==="champ"){ var tl=h.titles[h.titles.length-1]; t.champ=1; sl.hyear=yr(tl); sl.hseries=V(tl.label); }
      else if(v==="titles"){ t.titles=1; sl.titlesN=cntV(h.titlesSer,"title","titles"); sl.titlesT=V(TIMESW[h.titlesSer]||words(h.titlesSer)+"-time"); h.titles.forEach(function(x){ if(x.series===A.G.series) yr(x); }); c.facts.titles=h.titlesSer; }
      else if(v==="defending"){ t.defending=1; yr(h.defending); }
      else if(v==="lastyear"){ t.lastyear=1; sl.hpos=ordV(h.lastYear.pos); yr(h.lastYear.x); c.facts.hpos=h.lastYear.pos; }
      else if(v==="pos"){ t.pos=1; sl.hpos=ordV(h.bestPos.pos); sl.hyear=yr(h.bestPos.x); c.facts.hpos=h.bestPos.pos; }
      else if(v==="hwins"){ t[h.lastWins.x.year===A.G.year-1?"hwinsLast":"hwins"]=1; sl.hwinsN=cntV(h.lastWins.w,"win","wins"); sl.hyear=yr(h.lastWins.x); c.facts.hwins=h.lastWins.w; }
      else if(v==="cwins"){ t.cwins=1; sl.cwinsN=cntV(h.careerWins,"win","wins"); c.facts.cwins=h.careerWins; refs.push({sid:"all-before",year:A.G.year-1,last:A.hb.date}); }
      else if(v==="wonhere"){ t.wonhere=1; sl.hyear=yr(h.wonHere.x); var cv=placeV((A.race&&A.race.rc&&A.race.rc.cal&&A.race.rc.cal.city)||""); if(cv) sl.city=cv; c.facts.wonHere=h.wonHere.date; }
      c.facts.hist=refs;
      c.story={kind:"battle",riders:[s]};
      return c;
    };
  }
  /* the venue: this series in this city before (earlier seasons), and earlier this season (the game's own results) */
  function venueFacts(){
    var hb=hbook(), Gs=A.G; if(!hb) return null;
    var ser=Gs.series, here=hb.rounds.filter(function(rr){ var x=hsx(rr[0]); return x.series===ser&&normName(hb.H.s[rr[3]])===hb.city; });
    here.sort(function(a,b){ return a[2]<b[2]?-1:1; });
    var f={n:here.length,first:here[0]||null,last:here[here.length-1]||null,most:null,earlier:null};
    var cnt={}; here.forEach(function(rr){ cnt[rr[4]]=(cnt[rr[4]]||0)+1; }); var mx=0, mi=null, tie=false; for(var k in cnt){ if(cnt[k]>mx){ mx=cnt[k]; mi=+k; tie=false; } else if(cnt[k]===mx) tie=true; } if(mx>=2&&!tie) f.most={pi:mi,n:mx};
    var rc=(A.race&&A.race.rc)||roundCtx(); (Gs.results||[]).forEach(function(x){ if(rc&&x.ri<rc.ri&&normName(String(x.city||"").replace(/\s*,.*$/,""))===hb.city) f.earlier=x; });
    return f;
  }
  function topicVenue(rows,cl){
    var f=venueFacts(); if(!f) return null; var vs=[];
    var lastKey=f.last?"P"+f.last[4]+"|h"+f.last[2]:null;
    if(f.last&&f.n>=1&&!factUsed(lastKey)) vs.push({v:"lastHere"}); if(f.n>=2) vs.push({v:"countHere"}); if(f.n>=2&&f.first) vs.push({v:"firstHere"}); if(f.most) vs.push({v:"mostHere"});
    if(f.n===0&&!f.earlier) vs.push({v:"newHere"}); if(f.earlier) vs.push({v:"earlierHere",w:2});
    vs=vs.filter(function(x){ return A.now-((A.tk.vv||{})[x.v]||-1e9)>900000; });
    var pk=pickVar("venue",vs); if(!pk) return null;
    return {k:"venue",ev:"talk_venue",sc:1,fp:0,ctx:venueTalkCtx(pk.v),mark:function(){ useVar("venue",pk.v); (A.tk.vv=A.tk.vv||{})[pk.v]=A.now; if(pk.v==="lastHere") factSay(lastKey); }};
  }
  function venueTalkCtx(v){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null, f=venueFacts(); if(!f) return null;
      var c=talkBase("venue",cl,rows), sl=c.slots, t=c.tags, refs=[], H=HIST(); c.facts.v=v; t[v]=1;
      function yr(rr){ var x=hsx(rr[0]); refs.push({sid:x.id,year:x.year,last:x.last,date:rr[2]}); return V(String(x.year),yearWords(x.year)); }
      if(v==="lastHere"){ sl.hyear=yr(f.last); sl.hwinner=nameV(hname(f.last[4])); }
      else if(v==="countHere"){ sl.countN=cntV(f.n,"round","rounds"); refs.push({sid:"all-before",year:A.G.year-1,last:A.hb.date}); c.facts.count=f.n; }
      else if(v==="firstHere"){ sl.hfirst=yr(f.first); }
      else if(v==="mostHere"){ sl.hwinner=nameV(hname(f.most.pi)); sl.winsHereN=cntV(f.most.n,"time","times"); refs.push({sid:"all-before",year:A.G.year-1,last:A.hb.date}); c.facts.most=f.most; }
      else if(v==="earlierHere"){ if(!f.earlier||!f.earlier.winner) return null; sl.hwinner=nameRec(f.earlier.winner).full; c.facts.earlier=f.earlier.ri; if(rider(f.earlier.winner)&&rider(f.earlier.winner).kind==="human") c.human=true; }
      c.facts.hist=refs;
      return c;
    };
  }
  /* the series: how long it has run, its first champion, last year's champion, the most titles so far (earlier seasons only) */
  function seriesFacts(){
    var hb=hbook(); if(!hb) return null; var L=hb.series.map(hsx), f={n:L.length,first:L[0]||null,last:L[L.length-1]||null,most:null};
    var cnt={}; L.forEach(function(x){ cnt[x.champ]=(cnt[x.champ]||0)+1; }); var mx=0, mi=null, tie=false; for(var k in cnt){ if(cnt[k]>mx){ mx=cnt[k]; mi=+k; tie=false; } else if(cnt[k]===mx) tie=true; } if(mx>=2&&!tie) f.most={pi:mi,n:mx};
    return f;
  }
  function topicSeries(rows,cl){
    var f=seriesFacts(); if(!f) return null; var vs=[];
    if(f.n>=1) vs.push({v:"nth"}); if(f.n===0) vs.push({v:"firstSeason"}); if(f.first&&f.n>=2) vs.push({v:"firstChamp"});
    var defKey=f.last?"P"+f.last.champ+"|t"+f.last.i:null;
    if(f.last&&!factUsed(defKey)){ vs.push({v:"defending"}); var dp=f.last.champ, id=null; (A.rmap||[]).forEach(function(rid){ if(personOf(rid)===dp) id=rid; }); if(id) vs.push({v:"defendingIn",w:2}); }
    if(f.most) vs.push({v:"mostTitles"});
    vs=vs.filter(function(x){ return A.now-((A.tk.sv||{})[x.v]||-1e9)>1200000; });
    var pk=pickVar("series",vs); if(!pk) return null;
    return {k:"series",ev:"talk_series",sc:1,fp:0,ctx:seriesTalkCtx(pk.v),mark:function(){ useVar("series",pk.v); (A.tk.sv=A.tk.sv||{})[pk.v]=A.now; if(pk.v==="defending"||pk.v==="defendingIn") factSay(defKey); }};
  }
  function seriesTalkCtx(v){
    return function(){
      var cl=rclock(), rows=cl!=null?liveRows(cl):null, f=seriesFacts(); if(!f) return null;
      var c=talkBase("series",cl,rows), sl=c.slots, t=c.tags, refs=[]; c.facts.v=v; t[v]=1;
      function yr(x){ refs.push({sid:x.id,year:x.year,last:x.last}); return V(String(x.year),yearWords(x.year)); }
      if(v==="nth"){ sl.hfirst=yr(f.first); sl.nthN=numV(f.n+1); c.facts.nth=f.n+1; }
      else if(v==="firstChamp"){ sl.hfirst=yr(f.first); sl.hchamp=nameV(hname(f.first.champ)); }
      else if(v==="defending"){ sl.hyear=yr(f.last); sl.hchamp=nameV(hname(f.last.champ)); }
      else if(v==="defendingIn"){ var id=null; (A.rmap||[]).forEach(function(rid){ if(personOf(rid)===f.last.champ) id=rid; }); var me=id&&rows?rowOf(rows,(A.rmap||[]).indexOf(id)):null; if(!me) return null; sl.hyear=yr(f.last); sl.hchamp=nameRec(id).full; sl.place=ordV(me.place); c.facts.lp=me.place; c.facts.named=[id]; c.facts.livePlace=me.place; }
      else if(v==="mostTitles"){ sl.hchamp=nameV(hname(f.most.pi)); sl.titlesN=cntV(f.most.n,"title","titles"); refs.push({sid:"all-before",year:A.G.year-1,last:A.hb.date}); c.facts.most=f.most; }
      c.facts.hist=refs;
      return c;
    };
  }

  /* ---- 11. the opening lap ---- */
  function topicOpen(rows,cl){
    var r=A.race; if((r.lap|0)>1||!rows[0]||lapsBy(rows[0].s,cl)>0) return null;
    var pre1=!r.hsCalled;   /* before the holeshot call: the drag race into turn one (short calls that fit before it) */
    return {k:"open",ev:"talk_open",sc:pre1?3:1,fp:pre1?0:0.2,ctx:function(){
      var cl2=rclock(), rows2=cl2!=null?liveRows(cl2):null; if(!rows2) return null;
      var c=talkBase("open",cl2,rows2), sl=c.slots, t=c.tags;
      if(!r.hsCalled){ t.turn1=1; return c; } t.after1=1;
      if(r.hs>=0&&A.now>=(r.gateAt||0)+6000){ t.hs=1; sl.hsLast=nameRec(seatId(r.hs)).last; c.facts.hs=r.hs; if(rows2[0]&&rows2[0].s===r.hs){ t.hslead=1; c.facts.livePlace=1; } if(isHumanSeat(r.hs)) c.human=true; }
      var hs2=humanSeats(); if(hs2.length){ t.you=1; sl.you=nameRec(seatId(hs2[0])).full; c.human=true; }
      var red=redPre(), rs=red&&A.rmap?A.rmap.indexOf(red):-1; if(rs>=0&&!isHumanSeat(rs)){ t.red=1; sl.redLast=nameRec(red).last; }
      return c; }};
  }

  /* ---- 12. colour (the analyst's eye, the bikes, the crowd, the race's records) and the pack (mid-pack fights, teammates, a privateer, a
     runaway leader): the old fillers, now one topic each ---- */
  function topicColour(rows,cl){
    var r=A.race; if(r.lap>=r.len-1) return null; if(r.lap<=1&&lapLen(1)<40000) return null;
    var vs=[]; if(r.colorLap!==r.lap){ vs.push({v:"color_technique",w:curSection()?3:1}); vs.push({v:"color_bike",w:0.8}); }
    vs.push({v:"idle_filler",w:1.2}); if(!(r.recN|0)) vs.push({v:"records",w:0.8});
    var tot=vs.reduce(function(s,a){ return s+a.w; },0), x=rnd()*tot, k=0; for(;k<vs.length-1;k++){ x-=vs[k].w; if(x<=0) break; }
    var ev=vs[k].v, ctxf=fillerCtx(ev); if(!ctxf) return null;
    return {k:"colour",ev:ev,sc:r.lap===1?1.8:1,fp:0,ctx:ctxf,mark:function(){ if(ev==="color_technique"||ev==="color_bike") r.colorLap=r.lap; if(ev==="records") r.recN=1; }};
  }
  function topicPack(rows,cl){
    var r=A.race; if(r.lap<=1&&lapLen(1)<40000) return null; if(!r.cur) return null;
    var vs=[]; if(r.lap-r.lastMid>=3) vs.push({v:"midpack_battle",w:1.4},{v:"teammates",w:1},{v:"privateer",w:1}); if(r.lap-r.lastRun>=4) vs.push({v:"runaway",w:1.5});
    if(!vs.length) return null;
    var tot=vs.reduce(function(s,a){ return s+a.w; },0), x=rnd()*tot, k=0; for(;k<vs.length-1;k++){ x-=vs[k].w; if(x<=0) break; }
    var ev=vs[k].v;
    return {k:"pack",ev:ev,sc:r.lap===1?1.5:1,fp:0,ctx:fillerCtx(ev),mark:function(){ if(ev==="runaway") r.lastRun=r.lap; else r.lastMid=r.lap; }};
  }

  /* ---- the choice: the race topics first (higher weight, shorter rest), the context ones when the race has been told; never a context line
     in the last two laps; Chatter Less = the race only ---- */
  var TOPICS=[["open",topicOpen,9,6000,1],["battle",topicBattle,10,7000,1],["you",topicYou,9,13000,1],["leader",topicLeader,8,17000,1],["crash",topicCrash,7.5,18000,1],
    ["laps",topicLaps,6,22000,1],["top5",topicTop5,5.5,30000,1],["points",topicPoints,5,40000,1],["stats",topicStats,4.5,40000,1],["pack",topicPack,4,28000,1],
    ["season",topicSeason,3.6,26000,0],["rider",topicRider,3.2,34000,0],["colour",topicColour,2.6,34000,0],["venue",topicVenue,1.1,140000,0],["series",topicSeries,1,190000,0]];
  function talkCands(rows,cl){
    var r=A.race, t=A.now, out=[], late=r.lap>=r.len-1, less=o.chatter==="less", tk=A.tk;
    /* the context (season, history, colour) gets about one talk line in five: more when it has been quiet for a while, none in a row */
    var rk=tk.recentK||[], ctxShare=rk.length?rk.filter(function(x){ return !x; }).length/rk.length:0, ctxBoost=(t-tk.ctxAt>35000&&ctxShare<0.2)?3:1;
    TOPICS.forEach(function(T){
      var k=T[0], race=T[4];
      if(!race&&(late||less)) return;
      if(!rows&&k!=="colour"&&k!=="pack") return;
      var el=t-(tk.at[k]||-1e9), x=el/T[3], f=x>=1?Math.min(1.8,1+(x-1)*0.3):0.06+0.22*x*x;
      if(!race){ if(t-tk.ctxAt<18000) f*=0.25; else f*=ctxBoost; }
      var cd=null; try{ cd=T[1](rows||[],cl); }catch(e){ if(o.debug) throw e; cd=null; }
      if(!cd) return;
      cd.k=k; cd.race=race; cd.score=T[2]*f*(cd.sc||1)*(0.8+0.4*rnd());
      if(cd.sig&&tk.sigAt&&tk.sigAt[cd.sig]!=null&&t-tk.sigAt[cd.sig]<45000) cd.score*=0.3;   /* the same fact again inside 45 s: only when there is nothing fresher */
      out.push(cd);
    });
    out.sort(function(a,b){ return b.score-a.score; });
    return out;
  }
  /* the event lines that already said a topic's facts count as that topic (no "the lead is 2.1 s" right after the order read said it) */
  var TOPIC_OF={running_order:"top5",first_lap_order:"top5",halfway:"leader",laps_to_go:"leader",lead_battle:"leader",runaway:"leader",clock:"leader",white_flag:"leader",last_lap_lead:"leader",
    you_up:"you",you_down:"you",bubble:"you",crash_remount:"crash",crash_out:"crash",multi_crash:"crash"};
  /* the next lap's cards on the commentator's clock (the leader at the line, less the 350 ms the page turns them early); null when unknown */
  function lapEndAt(){ var r=A.race, R=A.R, T=TMm(); if(!T||!r||!r.gated||r.lap<1) return null; if(r.flagged) return r.flagAt||null; if(r.lap>=r.len||R.tm.k<r.lap) return null; var tl=T.leaderLine(R,r.lap); return tl==null?null:screenAt(tl)-350; }
  function talkOK(){
    var r=A.race; if(!(r&&r.gated&&!r.sim&&!A.paused&&!r.sideways&&A.R)) return false;
    if(r.flagged) return A.now<(r.flagAt||0)-1500;   /* the flag is decided as the last lap STARTS: that lap is talked through, up to the checkered call */
    return !r.done&&!A.R.over;
  }
  function talkGapMs(){
    var lo=1000, hi=2500; if(o.chatter==="less"){ lo=5200; hi=8200; } else if(o.chatter==="more"){ lo=600; hi=1500; }
    var r=A.race, b=Math.max(1,r.lap|0), real=(b===1&&r.fl>0?r.fl:r.lapS)*1000, scr=lapLen(b), k=real>0&&scr<real*0.9?Math.max(0.3,scr/real):1;
    return Math.round((lo+rnd()*(hi-lo))*k);
  }
  function talk(){
    if(!talkOK()) return false;
    var t=A.now, tk=A.tk;
    if(t<tk.wait) return false;
    if(tk.gap==null) tk.gap=talkGapMs();
    var gapNow=tk.gap, bigSoon=nextBigAt(t); if(isFinite(bigSoon)&&bigSoon-lastEnd()<7000) gapNow=Math.min(gapNow,600);   /* a big call or the next cards are near: start sooner, so a line fits before them */
    if(t<lastEnd()+gapNow) return false;
    var nd=nextDue(t); if(nd&&nd.due-t<1200) return false;   /* a call is about to come: it has the floor */
    var n3=nextDue(t,3), room=n3?n3.due-t-300:Infinity;      /* a talk line ends before the next interrupt, or that call would cut it */
    /* the next lap's cards turn as the leader reaches the line (a war there is a call that cuts a talk line): a talk line should end before it */
    var lapEnd=lapEndAt();
    if(lapEnd!=null&&lapEnd-t<900&&lapEnd-t>-500) return false;   /* the next cards (or the flag) are a moment away: they have the floor */
    if(lapEnd!=null&&lapEnd>t) room=Math.min(room,lapEnd-t-300); else lapEnd=null;
    var bigAt=n3?n3.due:Infinity; if(lapEnd!=null&&lapEnd<bigAt) bigAt=lapEnd;
    var fit=room+700;   /* a line may end up to 0.7 s after the next call is due: that call waits for it (a line with under 0.9 s left is never cut) */
    var cl=rclock(), rows=cl!=null?liveRows(cl):null;
    var cands=talkCands(rows,cl), short=null;
    function said(cd,it){ tk.at[cd.k]=t; if(!cd.race) tk.ctxAt=t; tk.gap=null; tk.n++; if(cd.mark) cd.mark();
      (tk.recentK=tk.recentK||[]).push(!!cd.race); if(tk.recentK.length>10) tk.recentK.shift();
      if(cd.sig) (tk.sigAt=tk.sigAt||{})[cd.sig]=t; return true; }
    for(var i=0;i<cands.length&&i<8;i++){
      var cd=cands[i], it=q(cd.ev,{pri:0,ctx:cd.ctx,ttl:4,budget:false,story:cd.story||null,followP:cd.fp||0,subj:cd.subj||null});
      if(!it) continue;
      it.talk=cd.k;
      var pre=inRace(it,function(){ return prepare(it); });
      if(!pre){ A.q=A.q.filter(function(x){ return x!==it; }); continue; }
      if(pre.est>fit){ if(!short||pre.est<short.pre.est) short={cd:cd,pre:pre,ev:cd.ev}; A.q=A.q.filter(function(x){ return x!==it; }); continue; }
      it.pre=pre;
      if(emit(it)) return said(cd,it);
      A.q=A.q.filter(function(x){ return x!==it; });
    }
    /* nothing fitted: a shorter way to say one of the best topics (another template) may fit before the next big call */
    if(isFinite(room)&&room>=1800){
      for(var j=0;j<cands.length&&j<4;j++){
        for(var tr=0;tr<3;tr++){
          var cd3=cands[j], it3=q(cd3.ev,{pri:0,ctx:cd3.ctx,ttl:4,budget:false,story:cd3.story||null,followP:0,subj:cd3.subj||null}); if(!it3) break;
          it3.talk=cd3.k; var pre3=inRace(it3,function(){ return prepare(it3); });
          if(pre3&&pre3.est<=fit){ it3.pre=pre3; if(emit(it3)) return said(cd3,it3); }
          A.q=A.q.filter(function(x){ return x!==it3; });
          if(!pre3) break;
        }
      }
    }
    /* the leader is a moment from the line (the next lap's cards) and nothing else fits before it: a few words on him there */
    if(lapEnd!=null&&lapEnd-t<5000&&room>=1100&&t-(tk.at.line||-1e9)>20000){
      var itL=q("talk_line",{pri:0,ctx:lineTalkCtx(),ttl:4,budget:false,story:"leader",followP:0});
      if(itL){ itL.talk="line";
        for(var tl=0;tl<8;tl++){ var preL=inRace(itL,function(){ return prepare(itL); }); if(!preL) break; if(preL.est<=fit){ itL.pre=preL; if(emit(itL)) return said({k:"line",race:true},itL); break; } }
        A.q=A.q.filter(function(x){ return x!==itL; }); }
    }
    /* nothing fits before the next big call: when waiting for it would leave more than 4 s of silence, the shortest line is said anyway (a calm or
       lively line may be cut by the call; a BIG or HUGE one never is) */
    if(short&&isFinite(bigAt)&&bigAt-lastEnd()>4500){
      var it2=q(short.ev,{pri:0,ctx:short.cd.ctx,ttl:4,budget:false,story:short.cd.story||null,followP:0,subj:short.cd.subj||null});
      if(it2){ it2.talk=short.cd.k; it2.pre=short.pre; if(emit(it2)) return said(short.cd,it2); A.q=A.q.filter(function(x){ return x!==it2; }); }
    }
    tk.wait=t+600; return false;
  }
  function curSection(){
    var s=A.shotInfo; if(s&&s.section&&A.now-s.at<8000) return {type:s.section};
    var r=A.race; if(!r||!A.track.layout) return null;
    var x=(A.now-r.lapAt)/Math.max(1,lapLen(r.lap)); return sectionFromLayout(A.track.layout,((x%1)+1)%1);
  }
  function fillerCtx(ev){
    var r=A.race, L=r.cur||[], al=L.filter(function(z){ return !z.out; });
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev=ev; c.facts.named=[];
      if(ev==="color_technique"){ var sec=curSection(); if(sec){ var sw=secWords(sec); if(sw){ t["section:"+sw.type]=1; sl.section=sw.n; c.story={kind:"section",section:sw.type}; } } return c; }
      if(ev==="idle_filler"){ sl.n=numV(al.length); if(al[0]) t.lead=1; return c; }
      if(ev==="color_bike"){
        var Gs=A.G; if(Gs.year>=2006) t.fourstroke=1; if(/^500/.test(String(Gs.cls))) t.fivehundred=1;
        var top=al.slice(0,10), cnt={}; top.forEach(function(z){ var n=nameRec(seatId(z.s)); if(n&&n.make) cnt[n.make.c]=(cnt[n.make.c]||0)+1; });
        var best=null, bn=0; for(var m in cnt) if(cnt[m]>bn){ bn=cnt[m]; best=m; }
        if(best&&bn>=3){ t.make=1; sl.make=V(best,sayify(best)); sl.k=numV(bn); c.facts.make=best; c.facts.k=bn; }
        var m1=al[0]&&nameRec(seatId(al[0].s)), m2=al[1]&&nameRec(seatId(al[1].s));
        if(m1&&m2&&m1.make&&m2.make&&m1.make.c!==m2.make.c&&!(best&&bn>=3)){ t.make2=1; sl.make=m1.make; sl.make2=m2.make; c.facts.makes=[m1.make.c,m2.make.c]; }
        return c;
      }
      if(ev==="records"){
        var Rs=A.R&&A.R.st; if(!Rs) return null; var any=false;
        if(Rs.pot>=Math.max(2*r.n,20)){ sl.pot=numV(Rs.pot); t.pot=1; any=true; c.facts.pot=Rs.pot; }
        if(Rs.chain>=3){ sl.depthw=V(depthWord(Rs.chain)); t.deep=1; any=true; c.facts.depth=Rs.chain; }
        if(Rs.changes>=4){ sl.changesN=cntV(Rs.changes,"lead change","lead changes"); t.changes=1; any=true; c.facts.changes=Rs.changes; }
        var lid=al[0]&&seatId(al[0].s), sp=lid&&splaceNow(lid);
        if(sp&&sp.wins>=3){ riderSlots(sl,lid); sl.winsN=cntV(sp.wins,"win","wins"); t.wins=1; any=true; c.facts.rid=lid; c.facts.wins=sp.wins; }
        if(sp&&sp.hs>=3){ riderSlots(sl,lid); sl.hsN=cntV(sp.hs,"holeshot","holeshots"); t.hs=1; any=true; c.facts.rid=lid; c.facts.hs=sp.hs; }
        return any?c:null;
      }
      if(ev==="midpack_battle"||ev==="teammates"){
        var lo=5, hi=Math.min(al.length,r.cut>0?r.cut+1:15);
        for(var i=lo;i<hi-1;i++){
          var a1=al[i], b1=al[i+1], c1=al[i+2]; if(!a1||!b1) break;
          if(!nearRows(a1,b1)) continue;
          var na=nameRec(seatId(a1.s)), nb=nameRec(seatId(b1.s));
          if(ev==="teammates"){ if(!(na.make&&nb.make&&na.make.c===nb.make.c)) continue; if(i>=10) continue; sl.make=na.make; c.facts.make=na.make.c; }
          sl.a=na.full; sl.b=nb.full; sl.place=ordV(i+1); c.facts.place=i+1; c.facts.seats=[a1.s,b1.s]; c.facts.named=[na.id,nb.id];
          if(ev==="midpack_battle"&&c1&&nearRows(b1,c1)){ var nc=nameRec(seatId(c1.s)); sl.c=nc.full; t.many=1; c.facts.seats.push(c1.s); c.facts.named.push(nc.id); }
          if(na.human||nb.human) c.human=true;
          c.story={kind:"battle",riders:c.facts.seats.slice()};
          return c;
        }
        return null;
      }
      if(ev==="privateer"){
        for(var j=0;j<Math.min(10,al.length);j++){ var id2=seatId(al[j].s), Rp=rider(id2); if(Rp&&(Rp.kind==="privateer"||/^privateer$/i.test(String(Rp.bike||"")))){ riderSlots(sl,id2); sl.place=ordV(j+1); c.facts.rid=id2; c.facts.place=j+1; c.facts.named=[id2]; c.story={kind:"battle",riders:[al[j].s]}; return c; } }
        return null;
      }
      if(ev==="runaway"){
        if(al.length<3) return null; var g1=gapS(al[1]), d=al[0].count-al[1].count;
        if(g1!=null){ if(g1<Math.max(10,0.18*(r.lapS||55))) return null; d=g1; } else if(d<Math.max(6,Math.ceil(1.5*al.length))) return null;   /* mxtime: a runaway is 10 s (a fifth of a lap) clear */
        if((r.ledRun|0)<3) return null;
        riderSlots(sl,seatId(al[0].s)); sl.gap=g1!=null?gapV(al[0].s,al[1].s,null,g1):gapV(al[0].s,al[1].s,d); c.facts.rid=seatId(al[0].s); c.facts.gap=al[0].count-al[1].count; if(g1!=null) c.facts.secs=g1; c.facts.named=[c.facts.rid]; c.story={kind:"runaway",riders:[al[0].s]}; if(c.slots.you) c.human=true; return c;
      }
      return c;
    };
  }
  function depthWord(n){ return n<=1?"single":n===2?"double":n===3?"triple":n===4?"quadruple":n===5?"quintuple":words(n)+"-deep"; }

  /* =================================================================================================================================
     feeding the engine's events
     ================================================================================================================================= */
  function feed(Gs,evs,now,flags){
    if(now!=null) A.now=now;
    if(Gs){ if(A.G!==Gs){ A.G=Gs; if(A.sid!==Gs.sid){ A.names={}; A.sid=Gs.sid; } } }
    evs=evs||[]; flags=flags||{};
    if(A.paused) return;
    /* a whole race in one batch (Sim to results / Skip to the finish): the engine's run() returns no lap events, only the result */
    var hasDone=evs.some(function(e){ return e.e==="raceDone"; }), hasFlag=evs.some(function(e){ return e.e==="flag"; }), hasRace=evs.some(function(e){ return e.e==="race"; });
    var lapDone=false;
    for(var i=0;i<evs.length;i++){
      var e=evs[i];
      switch(e.e){
        case "race": onRace(e,hasDone&&!hasFlag); break;
        case "gate": onGate(e); break;
        case "reveal": if(e.w===0) onLapStart(e); else onWarCards(e); break;
        case "war": onWar(e); break;
        case "win": onWin(e); lapDone=true; break;
        case "holeshot": onHoleshot(e); break;
        case "crash": if(A.race) A.race.crashQ.push(e); break;
        case "crashCards": if(A.race) A.race.crashGain=(A.race.crashGain||0)+e.n; break;
        case "yellow": onYellow(e); break;
        case "out": case "short": onOut(e); break;
        case "deadlock": onDeadlock(e); lapDone=true; break;
        case "kitty": onKitty(e); break;
        case "lead": if(A.race) A.race.leadEv={s:e.s,from:e.from}; break;
        case "next": lapDone=true; break;
        case "flag": onFlag(e); lapDone=true; break;
        case "raceDone": onRaceDone(e,hasFlag||(A.race&&A.race.flagged)); break;
        case "roundDone": onRoundDone(e); break;
        case "seasonOver": onSeasonOver(e); break;
      }
    }
    if(lapDone&&A.race&&!A.race.sim) onLapDone();
    tick(A.now);
  }
  function ensureRace(){
    var Gs=A.G; if(!Gs||!Gs.race) return;
    if(A.race&&A.race.key===Gs.rkey&&A.R===Gs.race) return;
    if(A.race&&A.race.key===Gs.rkey){ A.R=Gs.race; A.rmap=Gs.rmap.slice(); return; }
    /* a race we did not see start (a reload mid-race): pick it up quietly */
    var RG=Gs.round, r=RG&&RG.races.filter(function(x){ return x.key===Gs.rkey; })[0];
    setupRace(Gs.rkey,r?r.label:"",Gs.race.kind||(r&&r.kind)||"main",Gs.race.n,Gs.rmap,true,Gs.ri);
    var R=Gs.race; A.race.lap=R.battle; A.race.gated=R.phase!=="gate"; A.race.gateAt=A.now; A.race.lapAt=A.now; A.race.cur=rstand(); A.race.prev=A.race.cur;
    A.race.hs=R.hs; A.race.changes=R.st?R.st.changes:0;
  }

  /* ---------------- before the gate ---------------- */
  function onRace(e,simmed){
    /* the last race's leftovers: its post-race lines may finish (8 s at most); nothing else from it is still true */
    A.q=A.q.filter(function(x){ return x.post; }); A.q.forEach(function(x){ x.hard=A.now+8000; x.exp=Math.min(x.exp,x.hard); });
    var r=setupRace(e.key,e.label,e.kind,e.n,e.riders,false,e.ri);
    var rc=r.rc, Gs=A.G, RG=Gs.round, first=!rc.opened;   /* the show opens with the round's first race, watched or simmed (a sim summary never comes before the welcome) */
    if(simmed) r.sim=true;
    var tail=A.q.filter(function(x){ return x.post; }).sort(function(a,b){ return b.id-a.id; })[0], prev=tail||null;
    /* a simmed race's lines are "post" lines (they outlive the sim's own cleanup); a watched race's build-up ends at the gate drop */
    function chain(ev,opt){ opt=opt||{}; if(simmed) opt.post=true; else opt.build=true; opt.after=prev?prev.id:null; opt.delay=opt.delay!=null?opt.delay:500; var it=q(ev,opt); if(it) prev=it; return it; }
    if(first&&!rc.opened){
      rc.opened=true; rc.redBefore=redNow();
      chain("show_open",{role:"C",ctx:introCtx("show_open")});
      chain("show_open",{role:"A",ctx:introCtx("show_open"),delay:700});
      if(Gs.series==="smx"&&rc.cal) chain("smx_playoff",{role:"C",ctx:introCtx("smx_playoff")});
      if(RG&&RG.tc) chain("triple_crown",{role:"C",ctx:introCtx("triple_crown")});
      if((Gs.humans||[]).length>=2&&!A.sit.party){ A.sit.party=true; chain("party_welcome",{role:"C",ctx:introCtx("party_welcome")}); chain("party_welcome",{role:"A",ctx:introCtx("party_welcome")}); }
      var cm=champCtx("intro"); if(cm) chain("championship_math",{role:"C",ctx:cm});
    }
    if(simmed) return;
    if(RG&&RG.tc&&r.kind==="main"&&r.i>0) chain("triple_crown",{role:"C",ctx:introCtx("triple_crown")});
    var ik="race_intro_"+(r.kind==="qual"?"qual":r.kind);
    /* the first race of the round a person rides in: the analyst always names him in its intro (later races: now and then) */
    var yf=!rc.youNamed&&(A.rmap||[]).some(function(id){ return rider(id)&&rider(id).kind==="human"; }); if(yf) rc.youNamed=true;
    if(EV[ik]){ chain(ik,{role:"C",ctx:introCtx(ik)}); if(yf||chance(0.8)) chain(ik,{role:"A",ctx:introCtx(ik,yf),delay:650}); }
    if(o.autoEngines!==false) chain("engines",{ctx:introCtx("engines"),delay:900});
  }
  function introCtx(ev,youFirst){
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags, r=A.race, Gs=A.G; c.facts.ev=ev; c.facts.named=[];
      var red=redNow(), redIn=!!(red&&A.rmap&&A.rmap.indexOf(red)>=0);
      if(red&&(ev==="show_open"||ev==="championship_math"||redIn)){ t.red=1; c.facts.red=red; }
      var hum=(A.rmap||[]).filter(function(id){ return rider(id)&&rider(id).kind==="human"; });
      if(hum.length&&ev!=="show_open"&&ev!=="party_welcome"){ var hid=pick(hum); var hn=nameRec(hid); sl.you=hn.full; sl.num=hn.num; t.you=1; c.facts.you=hid; c.human=true; }
      if(ev==="show_open"&&(Gs.humans||[]).length===1){ sl.you=nameRec(Gs.humans[0]).full; t.you=1; c.facts.you=Gs.humans[0]; }
      if(youFirst&&t.you) c.only="you";
      if(ev==="party_welcome"){ sl.k=numV((Gs.humans||[]).length); }
      if(ev==="race_intro_lcq"&&r){ var star=starIn(A.rmap); if(star){ sl.star=nameRec(star).full; t.star=1; c.facts.star=star; } }
      if(ev==="race_intro_main"){ var vf=venueFacts(); if(vf&&vf.last){ var hx=hsx(vf.last[0]); t.histcity=1; sl.hyear=V(String(hx.year),yearWords(hx.year)); sl.hwinner=nameV(hname(vf.last[4])); c.facts.hist=[{sid:hx.id,year:hx.year,last:hx.last,date:vf.last[2]}]; } }
      if(ev==="smx_playoff"){ var mult=(r&&r.rc&&r.rc.cal&&r.rc.cal.mult)||1; t["x"+mult]=1; if(mult>1) t.mult=1; var F=Gs.round&&Gs.round.F; if(F&&F.direct&&F.qual&&F.qual.length){ t.seeds=1; sl.tm=numV(F.qual[0].toMain); sl.seedsN=numV(F.direct); } }
      if(ev==="triple_crown"&&r&&r.kind==="main"){ t["main"+(r.i+1)]=1; }
      if(ev==="triple_crown"&&(!r||r.kind!=="main")) t.main1=1;
      return c;
    };
  }
  function starIn(ids){ var L=sstand(); for(var i=0;i<Math.min(5,L.length);i++){ if(L[i].pts>0&&ids&&ids.indexOf(L[i].id)>=0&&L[i].kind!=="human") return L[i].id; } return null; }
  function onGate(){
    ensureRace();
    var r=A.race; if(!r) return;
    A.q=A.q.filter(function(x){ return !x.build&&x.race===r.key; });   /* the drop: the build-up and anything from before are over */
    r.gated=true; r.sideways=false; r.gateAt=A.now; r.lapAt=A.now; r.lap=0; r.cur=null;
    r.prev=gateOrder();
    q("gate_drop",{role:"C",ctx:simpleCtx("gate_drop"),ttl:4});
  }
  function gateOrder(){ var n=A.race?A.race.n:0, out=[]; for(var s=0;s<n;s++) out.push({s:s,place:s+1,count:0,out:false,gap:0}); return out; }
  function simpleCtx(ev,extra){ return function(){ var c=baseCtx(); c.facts.ev=ev; c.facts.named=[]; if(extra) extra(c); return c; }; }

  /* ---------------- a lap: the cards turn as the leader starts it ---------------- */
  function onLapStart(e){
    ensureRace();
    var r=A.race; if(!r) return;
    if(!r.gated){ r.gated=true; r.gateAt=A.now; }
    var b=e.b;
    if(r.lap>=1&&b===r.lap+1&&r.lapAt>0){ var d=A.now-r.lapAt; if(r.lap>=2&&d>800) r.lapLens.push(d); }
    A.q=A.q.filter(function(x){ return x.post||x.build||x.race!==r.key||x.lap>=b||((x.held||CARRY[x.ev])&&x.exp>A.now); });   /* the last lap's unsaid lines are stale now (a line held back for the cards, and the call of a crash or a new leader that came at the very end of the lap, keep their own time to live: still true a moment later) */
    r.lap=b; r.lapAt=A.now; r.cards={}; r.up={}; r.warLap=null; r.crashQ=[]; r.crashGain=0; r.leadEv=null; r.winEv=null; r.dead=null;
    checkCompressed();
    (e.cards||[]).forEach(function(x){ r.cards[x.s]=x.c; r.up[x.s]=x.c; });
    /* the lap budget: lines this lap from its length on screen */
    var L=lapLen(b)/1000, base=L>=90?12:L>=40?8:L>=15?3:1.5, k=speedK()*chatK();   /* the calls (the action) have room every lap; the talk fills the silences without using the budget */
    r.tokens=Math.min(r.tokens,1.5)+base*k;
    if(b<=1) r.tokens=Math.max(r.tokens,base*k);
    /* the lap's milestones, as the leader reaches the line */
    var left=r.len-b+1;
    if(b===2&&r.cur&&!r.milestones.first){ r.milestones.first=true; q("first_lap_order",{role:"C",ctx:orderCtx("first_lap_order"),due:A.now+Math.min(1800,lapLen(b)*0.1),ttl:8,pri:2,followP:lapLen(b)>=40000?0.3:0}); }
    if(b===r.len&&r.len>1&&!r.milestones.white){ r.milestones.white=true; q("white_flag",{role:"C",ctx:whiteCtx(),ttl:5,followP:0.25}); }
    else if(b===Math.floor(r.len/2)+1&&r.len>=6&&!r.milestones.half){ r.milestones.half=true; q("halfway",{ctx:milestoneCtx("halfway",b-1),due:A.now+300,ttl:8}); }
    else if((left===5||left===3||left===2)&&r.len>=8&&!r.milestones["l"+left]&&(!r.timed||b>r.timed.k0)){ r.milestones["l"+left]=true; q("laps_to_go",{ctx:milestoneCtx("laps_to_go",b),due:A.now+300,ttl:8}); }
    /* the yellow flag flies on this lap where the last one went down (CRASH-CONTRACT.md: the game's rule) */
    if(r.yellowNext&&r.yellowNext.lap===b){ var y=r.yellowNext, cw=null; r.yellowNext=null;
      A.q.forEach(function(x){ if(x.key==="crash@"+(b-1)) cw=x; });   /* a rider deep in the field goes down after the leader has started this lap: the yellow waits for the crash call */
      q("yellow_flag",{ctx:yellowCtx(y),due:A.now+Math.min(2500,lapLen(b)*0.12),ttl:10,pri:1,after:cw?cw.id:null,delay:2500}); }
  }
  function onWarCards(e){ var r=A.race; if(!r) return; (e.cards||[]).forEach(function(x){ if(!x.held&&x.c!=null) r.up[x.s]=x.c; }); }
  function onWar(e){
    var r=A.race; if(!r) return;
    var n=e.n, ev=n>=3?"triple_war":n===2?"double_war":"war_start";
    if(n===1) r.wars++;
    r.warLap=true; r.lastWarSeats=(e.seats||e.tied).slice();
    if(n>=2) A.q=A.q.filter(function(x){ return !(x.follow&&/war/.test(x.ev)&&x.lap===r.lap); });
    var tied=e.tied.slice(), L=r.cur||[], inTop=tied.some(function(s){ var p=placeIn(L,s); return p>0&&p<=5; }), hum=tied.some(isHumanSeat);
    if(n===1) r.curWar={lap:r.lap,seats:tied.slice(),card:r.up[tied[0]],depth:1}; else if(r.curWar) r.curWar.depth=n;   /* talk: the war the riders fought (who, the card, the depth), kept with its winner below */
    if(n===1&&r.wars>=(lapLen(r.lap)<15000?3:5)&&!inTop&&!hum) return;   /* from the 5th war (3rd on a short lap), only the front, the people or a deeper war get a call */
    /* a short (2D) lap has room for the big calls only (ANNOUNCERS.md D.1): a plain war just for the people, and a double war is
       carried by the crash call it causes */
    if(lapLen(r.lap)<15000&&((n===1&&!hum)||(n===2&&!hum))) return;
    var gateWait=r.gateAt?Math.max(0,r.gateAt+1500-A.now):0;
    var follow=n===1?(r.wars<=1?0.4:0.15):n===2?0.5:0.75;
    if(lapLen(r.lap)<15000) follow*=0.4;
    q(ev,{role:"C",key:"war@"+r.lap,ctx:warCtx(e),due:A.now+gateWait,ttl:6,followP:follow,story:"war"});   /* 6 s, not 4: a double war waits behind the war call that announced it (INTENSITY.md 6.3) */
  }
  function warCtx(e){
    var r=A.race, tied=e.tied.slice(), n=e.n, up=Object.assign({},r.up), L=(r.cur||[]).slice(), wl=r.lap;
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="war"; c.facts.depth=n; c.facts.seats=tied.slice(); c.facts.named=tied.map(seatId); c.facts.lap=wl;
      sl.riders=listV(tied.map(seatId),true); var c0=up[tied[0]]; if(c0!=null){ var wild=RC()&&A.R&&RC().isWild(A.R,c0); sl.cardp=wild?V("wild cards"):cardPV(c0); c.facts.rank=rankOf(c0); }
      if(tied.length===2){ t.two=1; sl.a=nameRec(seatId(tied[0])).full; sl.b=nameRec(seatId(tied[1])).full; }
      if(tied.length>=3){ t.many=1; sl.k=numV(tied.length); }
      if(tied.some(function(s){ return placeIn(L,s)===1; })) t.lead=1;
      var hs=tied.filter(isHumanSeat); if(hs.length){ t.you=1; sl.you=nameRec(seatId(hs[0])).full; c.human=true; c.facts.you=seatId(hs[0]); sl.others=listV(tied.filter(function(s){ return s!==hs[0]; }).map(seatId),true); }
      if(n===3) t.d3=1;                                    /* exactly a triple war: only these lines may say "triple" or "a third time" */
      if(n>=4){ t.deep=1; sl.depthw=V(depthWord(n)); }     /* four ties and more: the lines that name the depth (quadruple, quintuple ...) */
      c.story={kind:"war",riders:tied.slice(),label:n>=4?depthWord(n)+" war":n===3?"triple war":n===2?"double war":"a war"};
      return c;
    };
  }
  function onWin(e){ var r=A.race; if(!r) return; r.winEv={s:e.s,n:e.n,war:e.war,c:e.c}; if(e.war>0){ r.warsWon[e.s]=(r.warsWon[e.s]||0)+1; }
    (r.lapWins=r.lapWins||{})[e.s]=(r.lapWins[e.s]|0)+1;
    /* talk: the war that decided a fight (its riders, the card they tied on, the depth, who won it and with what) */
    if(e.war>0&&r.curWar&&r.curWar.lap===r.lap&&r.curWar.seats.indexOf(e.s)>=0){ var w=r.curWar; (r.warLog=r.warLog||[]).push({lap:w.lap,seats:w.seats.slice(),card:w.card,depth:Math.max(w.depth,e.war),win:e.s,wc:e.c}); }
    r.curWar=null; }
  function onHoleshot(e){
    var r=A.race; if(!r) return; r.hs=e.s;
    var L1=lapLen(1), d=Math.max(1500,Math.min(L1*0.12,8000));
    q("holeshot",{role:"C",ctx:holeshotCtx(e.s),due:Math.max(A.now,(r.gateAt||A.now)+d),ttl:6,followP:L1>=15000?0.5:0.2,story:"holeshot"});
  }
  function holeshotCtx(s){ return function(){ var c=baseCtx(), id=seatId(s); c.facts.ev="holeshot"; c.facts.rid=id; c.facts.seat=s; c.facts.named=[id]; riderSlots(c.slots,id); var n=nameRec(id); if(n.human){ c.tags.you=1; c.human=true; } if(n.make) c.tags.make=1; if(id===redNow()) c.tags.red=1; c.story={kind:"holeshot",riders:[s]}; return c; }; }
  function onYellow(e){
    var r=A.race; if(!r) return;
    var y=r.yellowNext;   /* one yellow event per rider who went down in this war: they share the lap and the place */
    if(y&&y.lap===e.lap&&y.sector===e.sector){ if(y.seats.indexOf(e.s)<0) y.seats.push(e.s); y.s=e.s; }
    else r.yellowNext={lap:e.lap,sector:e.sector,s:e.s,seats:[e.s]};
    r.yellowSector=e.sector;
  }
  function onOut(e){
    var r=A.race; if(!r) return;
    var seats=(e.seats||[]).slice(); if(!seats.length) return;
    r.outQ=(r.outQ||[]).concat([{seats:seats,short:e.e==="short"}]);
  }
  function onDeadlock(e){ var r=A.race; if(!r) return; r.dead={seats:e.seats.slice(),n:e.n}; }
  function onKitty(e){ var r=A.race; if(!r||r.kittySaid) return; r.kittySaid=true; r.kitty={s:e.s,n:e.n}; }

  /* the moment (screen time) the picture shows rider s make the pass of lap b that puts him in place pos (pos -1: his last pass of the lap),
     from the time model's passes; no model or no such pass: def */
  function passAt(b,s,pos,def){
    var T=TMm(); if(!T) return def; var R=A.R, ev=null, i; for(i=R.tm.laps.length-1;i>=0;i--) if(R.tm.laps[i].k===b){ ev=R.tm.laps[i].ev; break; } if(!ev) return def;
    var hit=null; ev.forEach(function(e){ if(e.e!=="pass"||e.a!==s||e.crash) return; if(pos>0&&e.pos!==pos) return; if(!hit||(pos<0&&e.at>hit.at)||(pos>0&&e.at<hit.at)) hit=e; });
    if(!hit) return def; var tp=null; try{ tp=T.timeAt(R,s,b-1+hit.at); }catch(x){ tp=null; } if(tp==null) return def;
    return Math.max(A.now+300,screenAt(tp)+300);
  }
  /* ---------------- after a lap's result: what the field will ride this lap, and what the booth says about it ---------------- */
  function onLapDone(){
    var r=A.race, R=A.R; if(!r||!R) return;
    var cur=rstand(); r.prev=r.cur||gateOrder(); r.cur=cur;
    var prev=r.prev, b=r.lap, L=lapLen(b), t0=r.lapAt, last=b===r.len||R.over;
    r.rideAt=A.now; r.rideLap=b;
    var lead=cur[0]; if(lead){ r.led[lead.s]=(r.led[lead.s]|0)+1; r.ledRun=r.lastLeader===lead.s?(r.ledRun|0)+1:1; r.lastLeader=lead.s; }
    if(b===1) cur.forEach(function(x,i){ r.startPlace[x.s]=i+1; });
    var passT=t0+Math.max(L*0.35,(r.warLap?2500:0)), main=null, used={}, fp=L>=40000?0.35:L>=15000?0.15:0;
    var w=r.winEv;
    /* crashes: called where the race view shows them (sector x lap, or the view's own moment) */
    if(r.crashQ.length){
      var cq=r.crashQ.slice(), sector=r.yellowSector!=null?r.yellowSector:0.5, at=t0+Math.max(Math.min(L*sector,L*0.92),Math.min(2000,L*0.25));
      if(TMm()){ try{ var hw=TMm().holdWindow(R,cq[0].s,b); if(hw&&isFinite(hw[0])) at=Math.max(A.now+300,screenAt(hw[0])+250); }catch(x){} }   /* mxtime: the moment he goes down on the race clock */
      var gain=r.crashGain|0;
      if(cq.length>=2) q("multi_crash",{role:"C",ctx:crashCtx(cq,sector,gain),due:at,ttl:7,followP:0.8,key:"crash@"+b,story:"crash",subj:cq.map(function(x){ return x.s; })});
      else q(cq[0].kind==="out"?"crash_out":"crash_remount",{role:"C",ctx:crashCtx(cq,sector,gain),due:at,ttl:7,followP:cq[0].kind==="out"?0.85:0.7,key:"crash@"+b,story:"crash",subj:[cq[0].s]});
      cq.forEach(function(x){ used[x.s]=1; (r.crashLog=r.crashLog||[]).push({s:x.s,lap:b,kind:x.kind,from:placeIn(prev,x.s)||placeIn(cur,x.s),at:at}); });   /* talk: what each crash cost, told later */
    }
    /* the main story of the lap */
    var le=r.leadEv;
    /* short laps: a lead change gets a call at most every other lap (never skipped on the last two laps or for the people) */
    if(le&&L<15000&&b-(r.lastLeadCall|0)<2&&b<r.len-1&&!isHumanSeat(le.s)){ r.changes++; r.changeLaps.push(b); le=null; }
    if(le){ r.lastLeadCall=b;
      r.changes++; r.changeLaps.push(b);
      var ev=last?"last_lap_battle":"lead_change";
      main=q(ev,{role:"C",ctx:leadCtx(le,last),due:passAt(b,le.s,1,passT),ttl:5,followP:L>=15000?0.6:0.25,story:last?"last-lap":"lead-change",subj:[le.s]}); if(main) main.passPos=1;
      used[le.s]=1;
    }
    var tcDone=false;
    if(r.cut>0&&prev&&prev.length&&b>=2){
      var tp=transferPair(prev,cur,r.cut);
      if(tp){
        r.tcLaps=(r.tcLaps|0)+1;   /* laps on which somebody crossed the line: "that's N times it has changed" counts these, called or not */
        var lateL=b>r.len*2/3;
        if(last&&!le) { main=q("last_lap_battle",{role:"C",ctx:transferCtx(tp,true),due:passT,ttl:5,followP:0.5,story:"last-lap"}); tcDone=true; }
        else if(b-r.lastTC>=(lateL?2:3)){ r.lastTC=b; r.tcCount=(r.tcCount|0)+1; q("transfer_change",{role:lateL?"C":"any",pri:lateL?3:1,rank:7,ctx:transferCtx(tp,false),due:t0+L*(main?0.55:0.4),ttl:6,followP:0.3,story:"bubble"}); tcDone=true; }
        used[tp.sIn]=1;
      }
    }
    var moves=cur.map(function(x){ var p0=placeIn(prev,x.s); return {s:x.s,p:x.place,p0:p0,d:p0-x.place}; });
    /* the lap winner's charge: in War the lap's winner takes the whole pot, so he always surges; the booth calls it when it matters
       (into the top five, a war won, a wild card) and only now and then from deep in the pack, never on the opening lap (the holeshot
       is that story) and never a war that put somebody on the ground (the crash call is that story) */
    if(!main&&w&&b>1){
      var wm=moves.filter(function(m){ return m.s===w.s; })[0], big=(r.n>=30?5:3), front=wm&&wm.p<=5, deep=wm&&wm.p>8;
      var wild=w.war===0&&RC()&&A.R&&RC().isWild(A.R,w.c), crashWar=w.war>=2&&r.crashQ.length>0;
      if(last&&!front&&!isHumanSeat(w.s)) { /* the last lap belongs to the front */ }
      else if(wild){ main=q("wild_card",{ctx:winCtx("wild_card",w,wm),due:passT,ttl:6,followP:fp,subj:[w.s]}); }
      else if(w.war>0&&!crashWar&&(front||w.war>=2||isHumanSeat(w.s)||chance(0.55))){ main=q("war_won",{ctx:winCtx("war_won",w,wm),due:passT,ttl:6,story:"pass",subj:[w.s],followP:fp}); }
      else if(crashWar){ }
      else if(wm&&wm.d>0&&wm.p>=2&&wm.p<=5&&(wm.d<big||chance(0.5))){ main=q("pass_top",{ctx:passCtx(wm,prev),due:passAt(b,w.s,wm.p,passT),ttl:6,subj:[w.s],followP:fp}); if(main) main.passPos=wm.p; }
      else if(wm&&wm.d>=big&&(!deep||chance(0.45)||isHumanSeat(w.s))){ main=q("big_move",{ctx:moveCtx("big_move",wm),due:passAt(b,w.s,-1,passT),ttl:6,subj:[w.s],followP:fp}); if(main) main.passPos=wm.p; }
      else if(r.lapWinN/(b-1)<0.6&&lapLen(b)>=8000&&!deep){ main=q("lap_win",{ctx:winCtx("lap_win",w,wm),due:passT,ttl:6,subj:[w.s],followP:fp*0.7}); r.lapWinN=(r.lapWinN|0)+1; }
      used[w.s]=1;
    }
    /* the last lap with no change at the front: the leader bringing it home */
    if(last&&!le&&!tcDone&&b>1&&cur[0]&&prev[0]&&cur[0].s===prev[0].s) q("last_lap_lead",{role:"C",ctx:lastLeadCtx(),due:t0+L*0.45,ttl:8,pri:2,followP:L>=40000?0.3:0,story:"leader",subj:[cur[0].s]});
    /* a second move: a big gainer near the front who is not the winner, or a new podium rider (not every lap) */
    if(L>=15000&&b>1&&!last&&b-(r.lastMove2|0)>=2){
      var big2=moves.filter(function(m){ return !used[m.s]&&m.d>=(r.n>=30?7:5)&&m.p<=8; }).sort(function(a,c2){ return c2.d-a.d; })[0];
      if(big2){ r.lastMove2=b; q("big_move",{ctx:moveCtx("big_move",big2),due:t0+L*0.5,ttl:6,pri:1,subj:[big2.s]}); used[big2.s]=1; }
      else { var pod=moves.filter(function(m){ return !used[m.s]&&m.p>=2&&m.p<=3&&m.p0>=4; })[0]; if(pod){ r.lastMove2=b; q("pass_top",{ctx:passCtx(pod,prev),due:t0+L*0.5,ttl:6,pri:1,subj:[pod.s]}); used[pod.s]=1; } }
    }
    /* the people's own riders: up and down (at most every other lap or 20 s, unless the transfer line, the podium or the top ten is
       crossed, or it is a big change) */
    var youCap=L>=90000?2:1, youN=0, swing=Math.max(6,Math.round(r.n/4));   /* in War a place jumps about every lap: only a crossing or a big swing is news */
    moves.slice().sort(function(a,c2){ return Math.abs(c2.d)-Math.abs(a.d); }).forEach(function(m){
      if(!isHumanSeat(m.s)||used[m.s]||m.d===0||b===1||youN>=youCap) return;
      var cross=(r.cut>0&&((m.p0>r.cut&&m.p<=r.cut)||(m.p0<=r.cut&&m.p>r.cut)))||((m.p0>3)!==(m.p>3))||((m.p0>10)!==(m.p>10))||Math.abs(m.d)>=swing;
      var lastAt=r.humanCd[m.s]||-1e9; if(A.now-lastAt<(cross?Math.max(20000,L*0.9):Math.max(30000,L*2.4))) return;
      r.humanCd[m.s]=A.now; youN++; used[m.s]=1;
      q(m.d>0?"you_up":"you_down",{ctx:youCtx(m),due:t0+L*(main?0.55:0.4),ttl:8,pri:cross?2:1,story:"you",subj:[m.s]});
    });
    /* way more action (the CEO): the passes the picture shows, called as they happen. The time model knows every pass of this lap and where on
       the lap it comes (at); the call is due at that moment and the page's shown("pass") pulls it to the very frame. Never the lead (the lead
       change is that call), never a rider already called this lap, never a pass on a crashed rider (the crash call is that story); the front
       and the people first; one a lap on a short lap, two on a stadium lap, three on an outdoor lap. */
    var Tm=TMm();
    if(Tm&&b>=2&&L>=15000){
      var lev=null; for(var li=R.tm.laps.length-1;li>=0;li--) if(R.tm.laps[li].k===b){ lev=R.tm.laps[li].ev; break; }
      var capP=L>=90000?3:L>=40000?2:1, nP=0, seen={};
      (lev||[]).filter(function(e){ return e.e==="pass"&&!e.crash&&e.pos>=2&&(e.pos<=8||isHumanSeat(e.a)||isHumanSeat(e.d)); })
        .sort(function(x,y){ return ((isHumanSeat(y.a)||isHumanSeat(y.d))?1:0)-((isHumanSeat(x.a)||isHumanSeat(x.d))?1:0)||x.pos-y.pos||x.at-y.at; })
        .forEach(function(e){
          if(nP>=capP||used[e.a]||seen[e.a]||seen[e.d]) return;
          var tp2=null; try{ tp2=Tm.timeAt(R,e.a,b-1+e.at); }catch(x){ tp2=null; } if(tp2==null) return;
          nP++; seen[e.a]=1; seen[e.d]=1;
          var tpi=q("track_pass",{ctx:trackPassCtx(e,b,tp2),due:Math.max(A.now,screenAt(tp2)+400),ttl:5,pri:2,subj:[e.a],story:"pass",followP:L>=40000?0.2:0}); if(tpi){ tpi.passPos=e.pos; tpi.passD=e.d; }
        });
    }
    /* outs (no crash: an empty hand), a dead heat, the spare cards */
    (r.outQ||[]).forEach(function(oq){ q("out_of_cards",{ctx:outCtx(oq),due:t0+L*0.45,ttl:8,pri:1}); }); r.outQ=[];
    if(r.dead){ q("deadlock",{ctx:deadCtx(r.dead),due:t0+Math.min(L*0.3,4000),ttl:8,pri:1}); }
    if(r.kitty&&!r.kittyQ){ r.kittyQ=true; q("kitty",{ctx:kittyCtx(r.kitty),due:t0+L*0.6,ttl:10,pri:0}); }
    /* the reads: running order, the fight at the front, the bubble */
    var Ls=L/1000;
    if(!last&&b>1){
      var ro=Ls>=90?1:Ls>=40?2:Ls>=15?3:99; if(Ls>=15&&r.len-b<=3) ro=1;   /* the last laps: the order every lap */
      if(b-r.lastRO>=ro){ r.lastRO=b; q("running_order",{ctx:orderCtx("running_order"),due:t0+L*(main?0.62:0.45),ttl:8,pri:1}); }
      var close=cur[1]&&!cur[1].out&&isClose(cur[1],alive(cur));
      r.closeRun=close?(r.closeRun|0)+1:0;
      if(close&&r.closeRun>=2&&b-r.lastLB>=3&&Ls>=12){ r.lastLB=b; q("lead_battle",{ctx:leadBattleCtx(),due:t0+L*0.72,ttl:8,pri:1,story:"battle-lead",subj:[cur[0].s,cur[1].s]}); }
      if(r.cut>0&&!tcDone&&b-r.lastBubble>=(b>r.len*2/3?2:3)&&Ls>=12){ var cr=cur[r.cut-1], bu=cur[r.cut]; if(cr&&bu&&!bu.out&&bubbleNear(cr,bu)){ r.lastBubble=b; q("bubble",{ctx:bubbleCtx(),due:t0+L*0.8,ttl:8,pri:1,story:"bubble",subj:[bu.s,cr.s]}); } }
    }
    if(cur[1]) (r.gapHist=r.gapHist||[]).push({s:cur[1].s,g:gapN(cur[1])});
    r.crashQ=[]; r.leadEv=null;
  }
  /* ---------------- line contexts (the facts are captured now, checked again when spoken) ---------------- */
  function crashCtx(cq,sector,gain){
    var r=A.race, cur=r.cur.slice(), b=r.lap;
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags, s0=cq[0].s, id=seatId(s0);
      c.facts.ev="crash"; c.facts.crash=cq.map(function(x){ return {s:x.s,id:seatId(x.s),kind:x.kind,lap:x.lap}; }); c.facts.named=cq.map(function(x){ return seatId(x.s); });
      c.facts.lap=b;
      riderSlots(sl,id); var n=nameRec(id); if(n.human){ t.you=1; c.human=true; }
      sl.place=ordV(placeIn(cur,s0)); c.facts.place=placeIn(cur,s0); c.facts.rid=id;
      var by=cq[0].by; if(by!=null&&by>=0){ sl.by=nameRec(seatId(by)).last; c.facts.by=seatId(by); }
      if(cq.length>=2){ sl.riders=listV(cq.map(function(x){ return seatId(x.s); }),true); sl.k=numV(cq.length); if(cq.some(function(x){ return x.kind==="out"; })) t.out=1; c.human=cq.some(function(x){ return isHumanSeat(x.s); }); if(cq.length>=3) t.many=1; else t.pair=1; }
      if(cq[0].kind==="out"&&gain>0) t.gain=1;
      /* the war the crash came out of: "double" is a remount, "triple", "quadruple" ... a crash out (the lines name the depth from the engine's own number) */
      var dp=cq[0].depth|0; if(dp>=2){ sl.depthw=V(depthWord(dp)); c.facts.depth=dp; }
      /* a yellow flag flies on the NEXT lap: none when this was the last lap (the race is over) */
      if(b<r.len&&!(A.R&&A.R.over)) t.yel=1;
      if(r.isFinal&&r.rc&&r.rc.cal&&r.rc.cal.title&&r.F&&r.F.pointsOn==="race"&&r.F.table&&(r.F.table[placeIn(cur,s0)-1]||0)>0) t.points=1;
      var sec=sectionFor(sector); if(sec){ sl.section=sec.n; sl.atSection=sec.at; t.section=1; c.facts.section=sec.type; }
      c.story={kind:"crash",riders:cq.map(function(x){ return x.s; }),section:sec?sec.type:null};
      return c;
    };
  }
  function sectionFor(sector){
    var sec=null;
    if(typeof A.track.sectionAt==="function"){ try{ sec=A.track.sectionAt(sector); }catch(e){ sec=null; } }
    else if(A.track.layout) sec=sectionFromLayout(A.track.layout,sector);
    return secWords(sec);
  }
  function yellowCtx(y){
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="yellow"; c.facts.sector=y.sector; c.facts.yellowLap=y.lap;
      var down=(y.seats||(y.s!=null?[y.s]:[])).slice();
      c.facts.named=down.map(seatId).filter(Boolean);   /* who went down: "where he went down" is never said about a home rider */
      if(down.some(isHumanSeat)) c.human=true;
      var sec=sectionFor(y.sector); if(sec){ sl.section=sec.n; sl.atSection=sec.at; t.section=1; c.facts.section=sec.type; }
      c.story={kind:"yellow",section:sec?sec.type:null,riders:down};
      return c;
    };
  }
  function leadCtx(le,last){
    var r=A.race, cur=r.cur.slice(), b=r.lap, ch=r.changes, again=r.changeLaps.filter(function(x){ return x>b-3; }).length>=2;
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(le.s);
      if(placeIn(rstand(),le.s)!==1&&!last) return null;     /* still the leader when spoken, or never said */
      if(TMm()&&!last){ var cl=rclock(), lr=cl!=null?liveRows(cl+1500):null; if(lr&&lr[0]&&lr[0].s!==le.s) return null; }   /* mxtime: and the picture shows him in front (a moment of slack for the voice) */
      c.facts.ev=last?"last_lap_battle":"lead_change"; c.facts.rid=id; c.facts.place=1; c.facts.lap=b; c.facts.named=[id];
      riderSlots(sl,id); var n=nameRec(id); if(n.human){ t.you=1; c.human=true; } if(n.make) t.make=1;
      if(le.from>=0){ riderSlots(sl,seatId(le.from),"other"); c.facts.oid=seatId(le.from); c.facts.named.push(c.facts.oid); if(isHumanSeat(le.from)) c.human=true; }
      sl.place=ordV(1);
      if(again&&ch>=2){ t.again=1; sl.changesN=cntV(ch,"lead change","lead changes"); c.facts.changes=ch; }
      if(last) t.lead=1;
      if(le.from>=0&&b>=4&&(r.led[le.from]|0)>=Math.ceil((b-1)*0.6)){ t.ledlong=1; c.facts.ledOld=r.led[le.from]|0; }   /* "led all that way" only when it is true */
      c.story={kind:last?"last-lap":"lead-change",riders:[le.s].concat(le.from>=0?[le.from]:[])};
      return c;
    };
  }
  /* the transfer line moved: a rider who was outside the places that move on is now inside (sIn: the one nearest the line) and a rider who
     was inside is now outside (sOut: the one just beyond it). null = nobody crossed. lastspot = sIn took exactly the last place that moves
     on, the only case for "the last transfer spot". */
  function transferPair(prev,cur,cut){
    var pp={}, pn={};
    prev.forEach(function(x){ pp[x.s]=x.place; }); cur.forEach(function(x){ pn[x.s]=x.place; });
    var ins=cur.filter(function(x){ return !x.out&&x.place<=cut&&(pp[x.s]||0)>cut; });
    var outs=prev.filter(function(x){ return !x.out&&x.place<=cut&&(pn[x.s]||0)>cut; });
    if(!ins.length||!outs.length) return null;
    ins.sort(function(a,b2){ return b2.place-a.place; }); outs.sort(function(a,b2){ return (pn[a.s]||0)-(pn[b2.s]||0); });
    var i=ins[0], o2=outs[0];
    return {sIn:i.s,sOut:o2.s,inFrom:pp[i.s],inPlace:i.place,outFrom:o2.place,outNow:pn[o2.s],lastspot:i.place===cut,cut:cut};
  }
  function transferCtx(tp,last){
    var r=A.race, cur=r.cur.slice(), b=r.lap, k=r.tcLaps|0, sIn=tp.sIn, sOut=tp.sOut;
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(sIn); c.facts.ev=last?"last_lap_battle":"transfer_change"; c.facts.rid=id; c.facts.place=placeIn(cur,sIn); c.facts.lap=b; c.facts.named=[id,seatId(sOut)];
      c.facts.tc={cut:tp.cut,inFrom:tp.inFrom,outFrom:tp.outFrom,outNow:tp.outNow,lastspot:tp.lastspot};
      riderSlots(sl,id); riderSlots(sl,seatId(sOut),"other"); c.facts.oid=seatId(sOut);
      sl.place=ordV(placeIn(cur,sIn)); t.transfer=1; if(tp.lastspot) t.lastspot=1;
      if(isHumanSeat(sIn)){ t.you=1; c.human=true; } else if(isHumanSeat(sOut)){ t.youOut=1; sl.you=nameRec(seatId(sOut)).full; c.human=true; }
      if(k>=2) sl.k=numV(k);
      c.story={kind:"bubble",riders:[sIn,sOut]};
      return c;
    };
  }
  function winCtx(ev,w,wm){
    var r=A.race, cur=r.cur.slice(), b=r.lap, prev=r.prev.slice(), fighters=null;
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(w.s); c.facts.ev=ev; c.facts.rid=id; c.facts.lap=b; c.facts.named=[id];
      riderSlots(sl,id); var n=nameRec(id); if(n.human){ t.you=1; c.human=true; }
      var p=placeIn(cur,w.s), p0=placeIn(prev,w.s); sl.place=ordV(p); c.facts.place=p;
      if(p<p0) t.up=1; else if(p===1) t.lead=1; else t.hold=1;
      if(w.c!=null){ sl.card=cardV(w.c); sl.cardName=V(cardBare(w.c)); c.facts.card=rankOf(w.c); }
      sl.pot=numV(w.n); c.facts.pot=w.n; sl.by=n.last;
      if(ev==="war_won"){
        var los=(r.lastWarSeats||[]).filter(function(s){ return s!==w.s; });
        if(los.length===1){ t.two=1; riderSlots(sl,seatId(los[0]),"other"); c.facts.oid=seatId(los[0]); }
        var hl=los.filter(isHumanSeat); if(!n.human&&hl.length){ t.youOut=1; sl.you=nameRec(seatId(hl[0])).full; c.human=true; }
      }
      c.story={kind:"pass",riders:[w.s]};
      return c;
    };
  }
  function moveCtx(ev,m){
    var r=A.race, b=r.lap;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(m.s); c.facts.ev=ev; c.facts.rid=id; c.facts.place=m.p; c.facts.from=m.p0; c.facts.lap=b; c.facts.named=[id];
      riderSlots(sl,id); if(nameRec(id).human){ t.you=1; c.human=true; } sl.place=ordV(m.p); sl.from=ordV(m.p0); sl.gained=numV(m.d); c.facts.gained=m.d; t[m.d>=8?"huge":"small"]=1; c.story={kind:"pass",riders:[m.s]}; return c; };
  }
  /* the rider he passed for that place: the time model's own pass at that place (the one the picture shows), else a rider who was ahead
     of him and is now behind him (never a rider who moved up past the place himself) */
  function passedRider(b,m,prev,cur){
    var R=A.R, ev=null, i, hit=null, best=null, bp=1e9;
    if(R&&R.tm&&R.tm.laps) for(i=R.tm.laps.length-1;i>=0;i--) if(R.tm.laps[i].k===b){ ev=R.tm.laps[i].ev; break; }
    if(ev) ev.forEach(function(e){ if(e.e==="pass"&&e.a===m.s&&!e.crash&&e.pos===m.p&&(!hit||e.at<hit.at)) hit=e; });
    if(hit&&placeIn(cur,hit.d)>m.p) return hit.d;
    cur.forEach(function(x,k){ var p0=placeIn(prev,x.s); if(x.s!==m.s&&p0>0&&p0<m.p0&&k+1>m.p&&k+1<bp){ bp=k+1; best=x.s; } });
    return best;
  }
  function passCtx(m,prev){
    var r=A.race, b=r.lap, other=passedRider(b,m,prev,r.cur||[]);
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(m.s); c.facts.ev="pass_top"; c.facts.rid=id; c.facts.place=m.p; c.facts.from=m.p0; c.facts.lap=b; c.facts.named=[id];
      riderSlots(sl,id); if(nameRec(id).human){ t.you=1; c.human=true; } sl.place=ordV(m.p); if(m.p<=3) t.podium=1;
      if(other!=null&&other!==m.s){ riderSlots(sl,seatId(other),"other"); c.facts.oid=seatId(other); c.facts.named.push(c.facts.oid); if(isHumanSeat(other)){ c.human=true; t.youOut=1; sl.you=nameRec(c.facts.oid).full; c.only="youOut"; } }
      c.story={kind:"pass",riders:[m.s].concat(other!=null?[other]:[])}; return c; };
  }
  /* a pass on the track (the time model's pass event e of lap b, at clock tp): said once the picture has shown it, while the passer is still
     ahead (a pass undone before it is called is never called) */
  function trackPassCtx(e,b,tp){
    var r=A.race;
    return function(){
      var cl=rclock(); if(cl==null) return null; cl=Math.max(cl,Math.round(tp)+250);
      var lim=TMm().clockLimit(A.R); if(isFinite(lim)&&cl>lim) return null;
      var rows=liveRows(cl); if(!rows) return null;
      var a=rowOf(rows,e.a), d=rowOf(rows,e.d); if(!onTrack(a)||!d||a.place>=d.place) return null;
      var c=talkBase("pass",cl,rows), sl=c.slots, t=c.tags, ia=seatId(e.a), idd=seatId(e.d);
      c.facts.ev="track_pass"; c.facts.seats=[e.a,e.d]; c.facts.lp=a.place; c.facts.lap=b; c.facts.named=[ia,idd]; c.facts.livePlace=a.place;
      riderSlots(sl,ia); riderSlots(sl,idd,"other"); sl.place=ordV(a.place);
      if(a.place<=3) t.podium=1; else if(a.place===5) t.top5=1;
      if(isHumanSeat(e.a)){ t.you=1; sl.you=nameRec(ia).full; c.human=true; } else if(isHumanSeat(e.d)){ t.youOut=1; sl.you=nameRec(idd).full; c.human=true; }
      var tr=trendOf(e.d,e.a,cl,null); if(tr&&tr.kind==="closing") t.closing=1;   /* he had been closing on the rider he passed, lap after lap: the pass was coming */
      c.story={kind:"pass",riders:[e.a,e.d]};
      return c;
    };
  }
  function youCtx(m){
    var r=A.race, b=r.lap;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(m.s); c.facts.ev=m.d>0?"you_up":"you_down"; c.facts.rid=id; c.facts.place=m.p; c.facts.from=m.p0; c.facts.lap=b; c.facts.named=[id];
      sl.you=nameRec(id).full; t.you=1; c.human=true; sl.place=ordV(m.p); sl.from=ordV(m.p0); sl.lostN=cntV(Math.abs(m.d),"spot","spots");
      if(r.cut>0&&((m.d>0&&m.p<=r.cut&&m.p0>r.cut)||(m.d<0&&m.p>r.cut&&m.p0<=r.cut))) t.transfer=1;
      /* podium: on it now. top10: has just come INTO the top ten. near10: still outside it, 11th to 15th ("the top ten is coming") */
      if(m.d>0&&m.p<=3) t.podium=1; if(m.d>0&&m.p<=10&&m.p0>10) t.top10=1; if(m.d>0&&m.p>10&&m.p<=15) t.near10=1;
      c.story={kind:"you",riders:[m.s],label:nameRec(id).full.c}; return c; };
  }
  function orderCtx(ev){
    var r=A.race, b=r.lap, cur=r.cur.slice(), prev=(r.prev||[]).slice(), ledRun=r.ledRun|0, gh=(r.gapHist||[]).slice(0,ev==="first_lap_order"?0:undefined),
        ledAll=!!(cur[0]&&b>=4&&(r.led[cur[0].s]|0)===b);   /* the leader has led every lap so far (the only case for "has controlled this from the front") */
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev=ev; c.facts.lap=b;
      var al=cur.filter(function(x){ return !x.out; }); if(al.length<3) return null;
      if(ev!=="first_lap_order"){ var now=rstand(); if(now.length&&now[0].s!==cur[0].s) return null; }
      orderSlots(sl,cur);
      c.facts.order=al.slice(0,5).map(function(x){ return seatId(x.s); }); c.facts.named=c.facts.order.slice(0,3);
      if(prev.length&&prev[0]&&prev[0].s===cur[0].s&&ledRun>=2){ t.same1=1; sl.k=numV(ledRun); if(ledAll&&ev==="running_order"){ t.long1=1; c.facts.ledAll=true; } }
      if(gh.length>=2&&cur[1]&&gh[gh.length-1].s===cur[1].s&&gh[gh.length-2].s===cur[1].s&&gh[gh.length-2].g>gh[gh.length-1].g&&gh[gh.length-1].g>gapN(cur[1])) t.closing=1;
      if(ev==="first_lap_order"){
        sl.lap=numV(1);
        var star=null, L=sstand(); for(var i=0;i<Math.min(5,L.length);i++){ var s=A.rmap?A.rmap.indexOf(L[i].id):-1; if(s>=0&&L[i].pts>0&&L[i].kind!=="human"){ var p=placeIn(cur,s); if(p>10){ star={id:L[i].id,p:p}; break; } } }
        if(star){ t.star=1; riderSlots(sl,star.id); sl.star=nameRec(star.id).full; sl.place=ordV(star.p); c.facts.star=star.id; c.facts.place=star.p; c.facts.rid=star.id; }
        var hs=al.filter(function(x){ return isHumanSeat(x.s); })[0]; if(hs&&!star){ t.you=1; sl.you=nameRec(seatId(hs.s)).full; sl.place=ordV(placeIn(cur,hs.s)); c.facts.you=seatId(hs.s); c.facts.place=placeIn(cur,hs.s); c.human=true; }
      }
      c.story={kind:"leader",riders:[cur[0].s]};
      return c;
    };
  }
  function milestoneCtx(ev,lapShown){
    var r=A.race, cur=(r.cur||[]).slice();
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev=ev; c.facts.lap=r.lap; c.facts.named=[];
      orderSlots(sl,cur);
      if(ev==="halfway"){ sl.lap=numV(lapShown); }
      var al=cur.filter(function(x){ return !x.out; });
      if(al.length>=2){ c.facts.order=al.slice(0,3).map(function(x){ return seatId(x.s); }); }
      var left=r.len-r.lap+1; c.facts.left=left; if(left>=2) sl.left=numV(left);
      if(r.cut>0){ var cr=cur[r.cut-1], bu=cur[r.cut]; if(cr&&bu&&!bu.out&&bubbleNear(cr,bu)){ t.bubble=1; sl.bubble=nameRec(seatId(bu.s)).full; c.facts.bubble=seatId(bu.s); } }
      var hs=al.filter(function(x){ return isHumanSeat(x.s); })[0]; if(hs){ t.you=1; sl.you=nameRec(seatId(hs.s)).full; sl.place=ordV(placeIn(cur,hs.s)); c.facts.you=seatId(hs.s); c.facts.place=placeIn(cur,hs.s); c.human=true; }
      c.story={kind:"leader",riders:al[0]?[al[0].s]:[]};
      return c;
    };
  }
  function whiteCtx(){
    var r=A.race, cur=(r.cur||[]).slice();   /* the order AT THE LINE as the last lap starts */
    return function(){
      var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="white_flag"; c.facts.lap=r.lap; c.facts.named=[];
      orderSlots(sl,cur);
      var al=cur.filter(function(x){ return !x.out; });
      if(al[1]&&isClose(al[1],al.length)) t.close=1;
      if(r.cut>0){ var cr=cur[r.cut-1], bu=cur[r.cut]; if(cr&&bu&&!bu.out&&bubbleNear(cr,bu)){ t.bubble=1; sl.bubble=nameRec(seatId(bu.s)).full; c.facts.bubble=seatId(bu.s); } }
      var hs=al.filter(function(x){ var p=placeIn(cur,x.s); return isHumanSeat(x.s)&&(p<=5||(r.cut>0&&Math.abs(p-r.cut)<=1)); })[0]; if(hs){ t.you=1; sl.you=nameRec(seatId(hs.s)).full; sl.place=ordV(placeIn(cur,hs.s)); c.facts.you=seatId(hs.s); c.facts.place=placeIn(cur,hs.s); c.facts.atLine=true; c.human=true; }
      if(al.length>=2) c.facts.order=al.slice(0,2).map(function(x){ return seatId(x.s); });
      c.story={kind:"white-flag",riders:al[0]?[al[0].s]:[]};
      return c;
    };
  }
  function lastLeadCtx(){
    var r=A.race, cur=r.cur.slice();
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="last_lap_lead"; c.facts.lap=r.lap; orderSlots(sl,cur);
      var al=cur.filter(function(x){ return !x.out; }); if(al.length<2) return null;
      c.facts.order=[seatId(al[0].s),seatId(al[1].s)]; c.facts.named=c.facts.order.slice();
      if(isClose(al[1],al.length)) t.close=1; else t.clear=1;
      if(isHumanSeat(al[0].s)){ t.you=1; sl.you=nameRec(seatId(al[0].s)).full; c.facts.you=seatId(al[0].s); c.human=true; } else if(isHumanSeat(al[1].s)) c.human=true;
      c.story={kind:"leader",riders:[al[0].s,al[1].s]}; return c; };
  }
  function leadBattleCtx(){
    var r=A.race, cur=r.cur.slice();
    return function(){ var c=baseCtx(), sl=c.slots; c.facts.ev="lead_battle"; c.facts.lap=r.lap; c.facts.order=[seatId(cur[0].s),seatId(cur[1].s)]; c.facts.gap=cur[1].gap; if(gapS(cur[1])!=null) c.facts.secs=gapS(cur[1]); c.facts.named=c.facts.order.slice();
      if(rstand()[0].s!==cur[0].s) return null; if(isHumanSeat(cur[0].s)||isHumanSeat(cur[1].s)) c.human=true; c.story={kind:"battle-lead",riders:[cur[0].s,cur[1].s]}; return c; };
  }
  function bubbleCtx(){
    var r=A.race, cur=r.cur.slice(), cr=cur[r.cut-1], bu=cur[r.cut];
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="bubble"; c.facts.lap=r.lap; c.facts.cutRider=seatId(cr.s); c.facts.bubble=seatId(bu.s); c.facts.named=[seatId(cr.s),seatId(bu.s)];
      sl.cutRider=nameRec(seatId(cr.s)).full; sl.bubble=nameRec(seatId(bu.s)).full; var bd=between(cr,bu); sl.cards=bd!=null?(bd>=0.05?secV(bd):null):cntV(Math.max(0,cr.count-bu.count),"card","cards"); c.facts.cards=cr.count-bu.count; if(bd!=null) c.facts.secs=bd;
      if(bd==null&&cr.count===bu.count) sl.cards=null;
      if(isHumanSeat(bu.s)){ t.you=1; sl.you=nameRec(seatId(bu.s)).full; c.human=true; } else if(isHumanSeat(cr.s)) c.human=true;
      c.story={kind:"bubble",riders:[bu.s,cr.s]}; return c; };
  }
  function outCtx(oq){
    var r=A.race, b=r.lap;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, s=oq.seats; c.facts.ev="out_of_cards"; c.facts.seats=s.slice(); c.facts.lap=b; c.facts.named=s.map(seatId);
      if(s.length>1){ t.many=1; sl.riders=listV(s.map(seatId),true); } riderSlots(sl,seatId(s[0])); c.facts.rid=seatId(s[0]); if(oq.short) t.short=1; if(s.some(isHumanSeat)){ t.you=1; c.human=true; } return c; };
  }
  function deadCtx(d){ return function(){ var c=baseCtx(); c.facts.ev="deadlock"; c.facts.seats=d.seats.slice(); c.facts.named=d.seats.map(seatId); c.slots.riders=listV(d.seats.map(seatId),true); c.slots.k=numV(d.n); if(d.seats.some(isHumanSeat)) c.human=true; return c; }; }
  function kittyCtx(k){ return function(){ var c=baseCtx(); c.facts.ev="kitty"; c.facts.rid=seatId(k.s); c.facts.named=[seatId(k.s)]; c.slots.by=nameRec(seatId(k.s)).last; c.slots.k=numV(k.n); if(isHumanSeat(k.s)) c.human=true; return c; }; }

  /* the clock of a timed race: 10, 5, 2 and 1 minutes, then time up */
  function clockCheck(){
    var r=A.race; if(!r||!r.timed||r.lap<1) return;
    var left=clockLeft(); if(left==null) return;
    [600,300,120,60].forEach(function(m){
      if(left<=m&&left>m-45&&!r.clockSaid[m]&&r.timed.sec>m+30){ r.clockSaid[m]=true;
        q("clock",{role:"C",followP:0.25,ctx:function(){ if(r.timeUp) return null; var c=baseCtx(); c.facts.ev="clock"; c.facts.clock=m; c.facts.named=[]; c.slots.clock=clockWords(m+1); var cur=r.cur||[]; if(cur[1]&&!cur[1].out){ c.facts.order=[seatId(cur[0].s),seatId(cur[1].s)]; } return c; },ttl:8,pri:1}); }
      else if(left<=m-45) r.clockSaid[m]=true;
    });
    if(left<=0&&!r.timeUp&&r.lap===r.timed.k0){ r.timeUp=true;
      q("time_up",{role:"C",followP:lapLen(r.lap)>=40000?0.4:0,ctx:function(){ if(r.lap!==r.timed.k0) return null; var c=baseCtx(); c.facts.ev="time_up"; c.facts.plus=r.timed.plus; c.facts.lap=r.lap; c.facts.named=[]; c.slots.plus=cntV(r.timed.plus,"lap","laps"); return c; },ttl:8,pri:2}); }
    else if(left<=0) r.timeUp=true;
  }

  /* ---------------- the flag and after ---------------- */
  function onFlag(e){
    var r=A.race; if(!r) return;
    r.flagged=true;
    var b=r.lap, L=lapLen(b), at=Math.max(A.now,r.lapAt+L);
    if(TMm()&&A.R.tm.done&&A.R.tm.flag!=null) at=Math.max(A.now,screenAt(A.R.tm.flag));   /* mxtime: the leader's own line on the race clock */
    r.flagAt=at;
    if(r.leadEv||r.crashQ.length) { /* handled by onLapDone below (same batch) */ }
    var order=e.order.slice(), R=A.R, photo=false;
    if(R&&e.why==="flag"&&order.length>=2){ var a=R.r[order[0]], c2=R.r[order[1]];
      if(R.tm&&MX.Time){ try{ var mg=MX.Time.result(R).margin; photo=mg!=null&&mg<0.3; }catch(x){ photo=false; } }   /* mxtime: a photo finish is under 0.3 s */
      else photo=!a.out&&!c2.out&&a.pk.length===c2.pk.length; }
    r.final={order:order,why:e.why,photo:photo};
    var ck=q(photo?"photo_finish":"checkered",{role:"C",ctx:flagCtx(order,e.why),due:at,ttl:7,followP:photo?0.8:0,story:"checkered"});
    r.flagItem=ck?ck.id:null;
    var wl=q("winner_line",{ctx:winnerCtx(order),due:at,after:ck?ck.id:null,delay:2500,ttl:20,post:true});
    var rr=q("result_rundown",{role:"C",ctx:rundownCtx(order,false),due:at,after:wl?wl.id:(ck?ck.id:null),delay:700,ttl:20,post:true});
    var hasHuman=order.some(isHumanSeat), ry=hasHuman?q("result_rundown",{role:"A",ctx:rundownCtx(order,true),due:at,after:rr?rr.id:null,delay:500,ttl:20,post:true}):null;
    r.postTail=ry?ry.id:rr?rr.id:(wl?wl.id:(ck?ck.id:null));
  }
  function flagCtx(order,why){
    var r=A.race;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(order[0]); c.facts.ev="checkered"; c.facts.race=r.key; c.facts.rid=id; c.facts.place=1; c.facts.lap=r.len; c.facts.named=[id];
      riderSlots(sl,id); var n=nameRec(id); if(n.human){ t.you=1; c.human=true; } if(why==="all") t.all=1; c.story={kind:"checkered",riders:[order[0]]}; return c; };
  }
  function winnerCtx(order){
    var r=A.race, s=order[0], R=A.R;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, id=seatId(s), n=nameRec(id); c.facts.ev="winner_line"; c.facts.race=r.key; c.facts.rid=id; c.facts.named=[id];
      riderSlots(sl,id); if(n.human){ t.you=1; c.human=true; } if(n.make) t.make=1;
      var wire=R&&R.st&&R.st.led&&R.st.led[s]>=(R.battle|0); if(r.hs===s&&wire) t.hs=1; else if(r.hs===s) t.hsback=1;   /* led every lap that was run (a race can end before its last lap when one rider holds every card) */
      var ww=r.warsWon[s]|0; if(ww>=2){ t.wars=1; sl.warsWonN=cntV(ww,"war","wars"); c.facts.warsWon=ww; }
      var wcr=R&&R.r&&R.r[s]?(R.r[s].crashes|0):0; if(wcr>0){ t.crashed=1; c.facts.crashes=wcr; } else { t.clean=1; c.facts.crashes=0; }
      var sp=r.startPlace[s]; if(sp>=5){ t.came=1; sl.startPlace=ordV(sp); c.facts.startPlace=sp; }
      if(R&&R.st&&R.st.led&&R.st.led[s]>=r.len/2) t.lead=1;
      if(r.isFinal&&seasonWinsBefore(id,r.key)===0) t.firstwin=1;
      c.story={kind:"checkered",riders:[s]}; return c; };
  }
  function seasonWinsBefore(id,key){
    var Gs=A.G, n=0, rri=A.race&&A.race.rc?A.race.rc.ri:Gs.ri; (Gs.results||[]).forEach(function(res){ (res.races||[]).forEach(function(x){ if((x.kind==="main"||x.kind==="moto")&&x.res&&x.res[0]===id&&!(res.ri===rri&&x.key===key)) n++; }); });
    var RG=Gs.round; if(RG&&RG.ri===rri) RG.races.forEach(function(x){ if(x.st<0&&x.res&&x.res[0]===id&&x.key!==key) n++; });
    return n;
  }
  function rundownCtx(order,youOnly){
    var r=A.race, R=A.R;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags;
      if(youOnly&&!order.some(isHumanSeat)) return null; if(youOnly) c.onlyYou=true; c.facts.ev="result_rundown"; c.facts.race=r.key; c.facts.order=order.slice(0,3).map(seatId); c.facts.named=c.facts.order.slice();
      ["p1","p2","p3"].forEach(function(k,i){ if(order[i]!=null) sl[k]=nameRec(seatId(order[i])).full; });
      if(r.isFinal&&(r.motos||1)===1) t.podiumrace=1;
      if(order[2]!=null){ sl.last3=nameRec(seatId(order[2])).last; t.podium3=1; if(isHumanSeat(order[2])) c.human=true; }
      var dn=R?order.filter(function(s){ return R.r[s].dnf&&R.r[s].dnf.why==="crash"; }):[]; if(dn.length){ t.dnf=1; sl.riders=listV(dn.map(seatId),true); c.facts.dnf=dn.map(seatId); }
      var hs=order.filter(isHumanSeat); if(hs.length){ t.you=1; sl.you=nameRec(seatId(hs[0])).full; sl.place=ordV(order.indexOf(hs[0])+1); c.facts.you=seatId(hs[0]); c.facts.place=order.indexOf(hs[0])+1; }
      c.story={kind:"podium",riders:order.slice(0,3)}; return c; };
  }
  function onRaceDone(e,watched){
    var r=A.race&&A.race.key===e.key?A.race:null;
    if(!r){ r=setupRace(e.key,e.label,e.kind,e.order.length,e.order,true,e.ri); r.sim=true; }
    var Gs=A.G;
    if(!watched){
      /* Sim to results / Skip to the finish: a short summary from the result (the engine's run() gives no lap events) */
      var live=r.gated&&r.lap>0;
      A.q=A.q.filter(function(x){ return x.race!==r.key||x.post; });
      var tl=A.q.filter(function(x){ return x.post||x.build; }).sort(function(a,b){ return b.id-a.id; })[0], prev=tl||null;
      function ch(ev,opt){ opt=opt||{}; opt.post=true; opt.after=prev?prev.id:null; opt.delay=opt.delay!=null?opt.delay:450; var it=q(ev,opt); if(it) prev=it; return it; }
      var sc=simCtx(e,r);
      if(live){ A.q=A.q.filter(function(x){ return x.race!==r.key; }); prev=null; ch("skip_open",{role:"C",ctx:sc}); ch("skip_result",{role:"C",ctx:sc}); if(chance(0.5)) ch("skip_close",{role:"A",ctx:sc}); }
      else { ch("sim_open",{role:"C",ctx:sc}); ch("sim_wars",{role:"C",ctx:sc}); ch("sim_result",{role:"C",ctx:sc}); if(chance(0.35)) ch("sim_close",{role:"A",ctx:sc}); }
      r.postTail=prev?prev.id:null;
    }
    r.done=true; r.doneEv=e;
    var after=r.postTail||null, delay=1200;
    function ch2(ev,opt){ opt=opt||{}; opt.post=true; opt.after=after; opt.delay=opt.delay!=null?opt.delay:delay; opt.due=opt.due!=null?opt.due:A.now; var it=q(ev,opt); if(it) after=it.id; return it; }
    if(r.stage){
      var ctx=transferDoneCtx(e,r);
      if(r.kind==="lcq"||(r.stage&&!r.next)){ ch2("lcq_result",{role:"C",ctx:ctx}); if(chance(0.6)) ch2("lcq_result",{role:"A",ctx:ctx,delay:600}); }
      else { ch2("heat_transfers",{role:"C",ctx:ctx}); if(chance(0.6)) ch2("heat_transfers",{role:"A",ctx:ctx,delay:600}); }
    } else if(r.kind==="moto"&&Gs.round&&!Gs.round.done&&r.motos>1){
      ch2("moto_done",{role:"C",ctx:motoDoneCtx(e,r)}); if(chance(0.5)) ch2("moto_done",{role:"A",ctx:motoDoneCtx(e,r),delay:600});
    }
    if(e.walkover&&e.walkover.length){ e.walkover.forEach(function(k){ var RG=Gs.round, x=RG&&RG.races.filter(function(z){ return z.key===k; })[0]; ch2("walkover",{role:"C",ctx:simpleCtx("walkover",function(c){ c.slots.race=raceName(x?x.label:k); })}); }); }
    A.postAfter=after;
  }
  function simCtx(e,r){
    var Gs=A.G, order=e.order.slice(), hs=e.hs, crashed=Object.keys(e.crashes||{}).length, wars=Gs.last&&Gs.last.key===e.key?Gs.last.wars:null;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev=r.lap>0?"skip_finish":"sim_summary"; c.facts.race=r.key; c.facts.order=order.slice(0,3); c.facts.named=order.slice(0,3); c.facts.simmed=true;
      sl.race=raceName(e.label);
      ["p1","p2","p3"].forEach(function(k,i){ if(order[i]) sl[k]=nameRec(order[i]).full; });
      if(hs){ t.hs=1; riderSlots(sl,hs); c.facts.hs=hs; }
      if(wars>0){ t.wars=1; sl.warsN=cntV(wars,"war","wars"); c.facts.wars=wars; } else if(wars===0) t.nowars=1;
      if(crashed>0){ t.crashed=1; sl.crashedN=cntV(crashed,"rider","riders"); } else t.calm=1; c.facts.crashed=crashed;
      if(r.stage&&r.tm>0){ t.direct=1; sl.tm=numV(r.tm); if(order[r.tm]) sl.next=nameRec(order[r.tm]).full; c.facts.next=order[r.tm]; }
      if(A.R&&A.R.st&&A.R.st.changes>=2&&r.lap>0){ sl.changesN=cntV(A.R.st.changes,"lead change","lead changes"); t.changes=1; }
      return c; };
  }
  function transferDoneCtx(e,r){
    var order=e.order.slice(), toMain=(e.toMain||[]).slice(), toNext=(e.toNext||[]).slice(), out=(e.out||[]).slice();
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev=r.kind==="lcq"?"lcq_result":"heat_transfers"; c.facts.race=r.key; c.facts.toMain=toMain; c.facts.named=[];
      ["p1","p2","p3"].forEach(function(k,i){ if(order[i]) sl[k]=nameRec(order[i]).full; });
      var cutN=r.tm>0?r.tm:r.tn, nx=order[cutN]; if(nx){ sl.next=nameRec(nx).full; c.facts.next=nx; c.facts.named.push(nx); }
      if(toMain.length) sl.riders=listV(toMain,true);
      sl.tm=numV(r.tm>0?r.tm:r.tn); sl.tn=numV(r.tn);
      var L=sstand(); for(var i=0;i<Math.min(5,L.length);i++){ var id=L[i].id; if(L[i].pts>0&&order.indexOf(id)>=0&&toMain.indexOf(id)<0&&L[i].kind!=="human"){ t.star=1; sl.star=nameRec(id).full; c.facts.star=id; break; } }
      var hum=order.filter(function(id){ return rider(id)&&rider(id).kind==="human"; });
      if(hum.length){ var h=hum[0]; t.you=1; sl.you=nameRec(h).full; c.facts.you=h; c.human=true; if(toMain.indexOf(h)>=0) t.youMain=1; else if(toNext.indexOf(h)>=0) t.youNext=1; else t.youOut=1; }
      return c; };
  }
  function motoDoneCtx(e,r){
    var order=e.order.slice();
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="moto_done"; c.facts.race=r.key; c.facts.order=order.slice(0,3); c.facts.named=order.slice(0,3);
      sl.race=raceName(e.label); ["p1","p2","p3"].forEach(function(k,i){ if(order[i]) sl[k]=nameRec(order[i]).full; });
      if(r.i===r.motos-2) t.nextlast=1;
      var hum=order.filter(function(id){ return rider(id)&&rider(id).kind==="human"; }); if(hum.length){ t.you=1; sl.you=nameRec(hum[0]).full; sl.place=ordV(order.indexOf(hum[0])+1); c.facts.you=hum[0]; c.facts.place=order.indexOf(hum[0])+1; c.human=true; }
      return c; };
  }
  function onRoundDone(e){
    var Gs=A.G, rc=roundCtxFor(e.ri), res=(Gs.results||[]).filter(function(x){ return x.ri===e.ri; })[0]||Gs.results[Gs.results.length-1], after=A.postAfter||null;
    function ch(ev,opt){ opt=opt||{}; opt.post=true; opt.after=after; opt.delay=opt.delay!=null?opt.delay:1300; opt.due=A.now; var it=q(ev,opt); if(it) after=it.id; return it; }
    var cls=e.cls.slice(), F=rc&&rc.F||(res&&Gs.formats[res.fmt]);
    var finals=res?res.races.filter(function(x){ return x.kind==="main"||x.kind==="moto"; }):[];
    if(finals.length>1){ ch("overall",{role:"C",ctx:overallCtx(cls,finals,res)}); if(chance(0.5)) ch("overall",{role:"A",ctx:overallCtx(cls,finals,res),delay:600}); }
    if(finals.length>1){ ch("round_podium",{role:"C",ctx:podiumCtx(cls)}); if(chance(0.45)) ch("round_podium",{role:"A",ctx:podiumCtx(cls),delay:600}); }
    else if(chance(0.5)) ch("round_podium",{role:"A",ctx:podiumCtx(cls),delay:600});
    var redA=redNow(), redB=rc?rc.redBefore:null;
    if(res&&res.title){
      var firstRed=A.sit.redHist.length===(Gs.results.length-1)&&A.sit.redHist.indexOf(redA)<0;
      if(redA&&redB!==undefined&&redA!==redB&&!Gs.over){ ch("red_plate_change",{role:"C",ctx:redCtx(redA,redB,firstRed),pri:3,rank:8,ttl:30}); if(chance(0.6)) ch("red_plate_change",{role:"A",ctx:redCtx(redA,redB,firstRed),delay:600,pri:1}); }
      ch("points_update",{role:"C",ctx:pointsCtx(false)}); if(Gs.humans&&Gs.humans.length) ch("points_update",{role:"any",ctx:pointsCtx(true),delay:600}); else if(chance(0.4)) ch("points_update",{role:"A",ctx:pointsCtx(false),delay:600});
      var cm=champCtx("after"); if(cm) ch("championship_math",{role:"C",ctx:cm});
    }
    A.sit.redHist.push(redA); A.postAfter=after;
  }
  function overallCtx(cls,finals,res){
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="overall"; c.facts.order=cls.slice(0,3); c.facts.named=cls.slice(0,3);
      ["p1","p2","p3"].forEach(function(k,i){ if(cls[i]) sl[k]=nameRec(cls[i]).full; });
      var F=A.G.formats[res.fmt]||null; if(F&&F.overall==="olympic") t.olympic=1;
      if(finals.every(function(x){ return x.res&&x.res[0]===cls[0]; })) t.sweep=1;
      if(F&&F.overall!=="olympic"&&F.table&&cls[1]){ var sc=function(id){ return finals.reduce(function(s,x){ var p=x.res.indexOf(id); return s+(p>=0?(F.table[p]||0):0); },0); }; if(sc(cls[0])===sc(cls[1])){ t.tie=1; c.facts.tie=true; } }
      var hum=cls.filter(function(id){ return rider(id)&&rider(id).kind==="human"; }); if(hum.length){ t.you=1; sl.you=nameRec(hum[0]).full; sl.place=ordV(cls.indexOf(hum[0])+1); c.facts.you=hum[0]; c.facts.place=cls.indexOf(hum[0])+1; c.human=true; }
      c.story={kind:"podium"}; return c; };
  }
  function podiumCtx(cls){
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="round_podium"; c.facts.order=cls.slice(0,3); c.facts.named=cls.slice(0,3);
      ["p1","p2","p3"].forEach(function(k,i){ if(cls[i]) sl[k]=nameRec(cls[i]).full; });
      var mk={}; cls.slice(0,3).forEach(function(id){ var n=nameRec(id); if(n&&n.make) mk[n.make.c]=1; }); if(Object.keys(mk).length===3) t.makes3=1;
      var nw=(A.G.results||[]).filter(function(x){ return x.winner===cls[0]; }).length; if(nw>=2){ t.wins=1; sl.winsN=cntV(nw,"win","wins"); c.facts.wins=nw; }
      var hum=cls.slice(0,3).filter(function(id){ return rider(id)&&rider(id).kind==="human"; }); if(hum.length){ t.you=1; sl.you=nameRec(hum[0]).full; c.facts.you=hum[0]; c.human=true; }
      c.story={kind:"podium"}; return c; };
  }
  function redCtx(redA,redB,firstRed){
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="red_plate_change"; c.facts.red=redA; c.facts.old=redB; c.facts.named=[redA];
      sl.red=nameRec(redA).full; if(redB){ t.old=1; sl.old=nameRec(redB).full; } else { t.opening=1; c.only="opening"; }   /* the first round: somebody has to lead (no "new points leader") */
      var Gs=A.G; if(Gs.ri<Gs.cal.length){ t.more=1; sl.nextCity=placeV(Gs.cal[Gs.ri].city); }
      if(firstRed) t.firstred=1;
      if(rider(redA).kind==="human"){ t.you=1; sl.you=nameRec(redA).full; c.human=true; }
      c.story={kind:"podium"}; return c; };
  }
  function pointsCtx(youLine){
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags, L=sstand(); if(L.length<3||!(L[0].pts>0)) return null; c.facts.ev="points_update"; c.facts.order=[L[0].id,L[1].id,L[2].id]; c.facts.pts=L[0].pts; c.facts.named=[L[0].id,L[1].id];
      sl.red=nameRec(L[0].id).full; sl.second=nameRec(L[1].id).full; sl.third=nameRec(L[2].id).full; sl.ptsN=cntV(L[0].pts,"point","points");
      var d=L[0].pts-L[1].pts; if(d>0){ t.lead=1; sl.leadN=cntV(d,"point","points"); if(d<=Math.max(10,maxRound(A.G.results.length?A.G.results[A.G.results.length-1].ri:A.G.ri))) t.slim=1; } else t.tie=1; c.facts.lead=d;
      var Gs=A.G; sl.rn=numV(Gs.results.length?Gs.results[Gs.results.length-1].ri+1:Gs.ri); if(Gs.ri<Gs.cal.length) t.more=1;
      if(Gs.cal.length-Gs.ri>=1&&Gs.cal.length-Gs.ri<=4) t.fewleft=1;   /* "the rounds are running out": only when four or fewer are left */
      var hum=L.filter(function(x){ return x.human; })[0];
      if(youLine){ if(!hum||hum.place<=1||!(hum.pts>0)) return null; t={}; c.tags=Object.assign({},c.tags,{you:1}); delete c.tags.lead; delete c.tags.tie; delete c.tags.more; sl.you=nameRec(hum.id).full; sl.place=ordV(hum.place); sl.ptsN=cntV(hum.pts,"point","points"); c.facts.you=hum.id; c.facts.place=hum.place; c.facts.youPts=hum.pts; c.facts.pts=null; c.human=true; c.onlyYou=true; }
      return c; };
  }
  /* the championship maths: the most points one rider can still score (each round's table x the races that pay x its multiplier) */
  function maxRound(ri){
    var Gs=A.G, cal=Gs.cal[ri]; if(!cal||!cal.title) return 0;
    var F; try{ F=SN().calFormat(Gs,cal); }catch(e){ F=Gs.formats[Gs.fmt]; } if(!F||!F.table) return 0;
    var races=F.pointsOn==="race"?(F.finals?F.finals.races:1):1; return (F.table[0]||0)*races*(cal.mult||1);
  }
  function champCtx(when){
    var Gs=A.G; if(!Gs||Gs.over&&when==="intro") return null;
    var L=sstand(); if(L.length<2||!(L[0].pts>0)) return null;
    var lead=L[0].pts-L[1].pts, startR=when==="intro"?Gs.ri+1:Gs.ri, left=0, k;
    for(k=startR;k<Gs.cal.length;k++) left+=maxRound(k);
    var roundsLeft=Gs.cal.length-startR;
    if(when==="intro"){ var tonight=maxRound(Gs.ri); if(roundsLeft<1||roundsLeft>4||!(lead+tonight>left)||lead>left+tonight) return null;
      return function(){ var c=baseCtx(), sl=c.slots; c.tags.can=1; c.facts.ev="championship_math"; c.facts.need=left; c.facts.named=[L[0].id]; sl.red=nameRec(L[0].id).full; sl.needN=cntV(left,"point","points"); return c; }; }
    if(roundsLeft<1||Gs.over) return null;
    if(roundsLeft>4) return null;
    var clinched=lead>left&&!A.sit.clinched;
    if(lead>left&&!clinched) return null;
    if(clinched) A.sit.clinched=true;
    return function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="championship_math"; c.facts.lead=lead; c.facts.maxLeft=left; c.facts.roundsLeft=roundsLeft; c.facts.named=[L[0].id];
      sl.red=nameRec(L[0].id).full; sl.second=nameRec(L[1].id).full; if(lead>0) sl.leadN=cntV(lead,"point","points");
      if(clinched){ t.clinched=1; } else { t.open=1; sl.roundsLeftN=cntV(roundsLeft,"round","rounds"); sl.maxLeftN=cntV(left,"point","points"); }
      var hum=L.filter(function(x){ return x.human; })[0]; if(hum&&hum.place>1){ var up=L[hum.place-2].pts-hum.pts; if(up>0){ t.you=1; sl.you=nameRec(hum.id).full; sl.upN=cntV(up,"point","points"); c.facts.you=hum.id; c.facts.up=up; c.human=true; } }
      return c; };
  }
  function onSeasonOver(e){
    var after=A.postAfter||null, ch=e.champion;
    var it=q("season_champion",{role:"C",post:true,after:after,delay:1500,ttl:40,ctx:function(){ var c=baseCtx(), sl=c.slots, t=c.tags; c.facts.ev="season_champion"; c.facts.rid=ch; c.facts.named=[ch];
      sl.champion=nameRec(ch).full; var sp=splace(ch); if(sp&&sp.wins>=3){ t.wins=1; sl.winsN=cntV(sp.wins,"win","wins"); c.facts.wins=sp.wins; } else if(sp) t.fewwins=1; sl.rounds=numV(A.G.cal.length);
      var pi=personOf(ch), hh=pi!=null?riderHist(pi):null, tn=(hh?hh.titlesSer:0)+1; if(tn>=2){ t.titles=1; sl.titlesN=cntV(tn,"title","titles"); c.facts.titles=tn; } if(rider(ch).kind==="human"){ t.you=1; sl.you=nameRec(ch).full; c.human=true; } c.story={kind:"podium"}; return c; },followP:1});
    if(it) A.postAfter=it.id;
  }

  /* =================================================================================================================================
     the page's and the view's hooks
     ================================================================================================================================= */
  function phase(kind,info,now){
    if(now!=null) A.now=now;
    var r=A.race;
    switch(kind){
      case "lineup": if(r&&!r.gated) q("lineup_gate",{ctx:introCtx("lineup_gate"),build:true,ttl:25}); break;
      case "engines": if(r&&!r.gated&&!r.enginesSaid){ A.q=A.q.filter(function(x){ return x.ev!=="engines"; }); q("engines",{ctx:introCtx("engines"),build:true,ttl:20}); } break;
      case "board30": if(r&&!r.gated){ A.q=A.q.filter(function(x){ return x.ev!=="lineup_gate"&&x.ev!=="engines"; }); q("board_30",{role:"C",ctx:simpleCtx("board_30"),build:true,ttl:10,pri:2}); } break;
      case "sideways": if(r&&!r.gated){ A.q=A.q.filter(function(x){ return !x.build; }); q("board_sideways",{role:"C",ctx:simpleCtx("board_sideways"),build:true,ttl:5}); } break;
      case "podium": break;
      case "pause": pause(); break;
      case "resume": resume(now); break;
    }
    tick(A.now);
  }
  function shown(kind,info,now){
    if(now!=null) A.now=now; info=info||{};
    var r=A.race; if(!r) return;
    function pull(f){ A.q.forEach(function(x){ if(f(x)&&x.due>A.now){ var d=x.due-A.now; x.due=A.now; x.exp=Math.max(x.exp-d,A.now+(x.pri>=3?6500:3000)); } }); }   /* a big call pulled to the picture keeps time to wait for a BIG line that is never cut */
    /* a pass the picture shows pulls the call of THAT pass (the view says who passed whom for which place): a pass for second never pulls the
       lead change the same rider makes later in the lap */
    if(kind==="pass") pull(function(x){ if(!(x.race===r.key&&x.lap===r.lap&&x.pri>=2&&x.subj&&x.subj.indexOf(info.s)>=0)) return false;
      if(info.pos!=null&&x.passPos!=null&&x.passPos!==info.pos) return false; if(info.d!=null&&x.passD!=null&&x.passD!==info.d) return false; return true; });
    else if(kind==="crash") pull(function(x){ return x.race===r.key&&/crash/.test(x.ev)&&x.lap===r.lap; });
    else if(kind==="holeshot") pull(function(x){ return x.ev==="holeshot"; });
    else if(kind==="checkered") pull(function(x){ return x.ev==="checkered"||x.ev==="photo_finish"; });
    else if(kind==="lapped"&&info.s!=null&&!r.ckSaid){   /* after the winner's call, traffic is no news */
      /* info.s = the rider being lapped, info.by = the rider lapping him (the view tells us): only a lap by the LEADER is called as the leader's */
      q("lapped",{ctx:function(){
        var c=baseCtx(), sid=seatId(info.s); c.facts.ev="lapped"; c.facts.rid=sid; c.facts.named=[sid]; riderSlots(c.slots,sid,"other");
        var human=!!(nameRec(sid)&&nameRec(sid).human);
        if(info.by!=null&&seatId(info.by)){ var bid=seatId(info.by), bn=nameRec(bid), rr=A.race, Lc=(rr&&rr.cur)||[]; c.facts.by=bid; c.facts.named.push(bid); c.slots.lapper=bn.full; if(Lc[0]&&Lc[0].s===info.by) c.tags.lapperlead=1; if(bn.human) human=true; }
        if(human) c.human=true;
        return c; },ttl:8,pri:1});
    }
    tick(A.now);
  }
  function shot(s){ if(!s) { A.shotInfo=null; return; } A.shotInfo={kind:s.kind||null,riders:(s.riders||[]).slice(),section:s.section||null,at:A.now}; }
  function lineDone(id,now){ if(now!=null) A.now=now; var b=A.booth; b.fb=true; if(b.cur&&b.cur.id===id&&!b.cur.done){ b.cur.done=true; b.cur.end=A.now; b.until=A.now; b.lastEnd=A.now; } tick(A.now); }
  function lineStart(id,now){ if(now!=null) A.now=now; var b=A.booth; if(b.cur&&b.cur.id===id){ b.cur.at=A.now; b.until=A.now+b.cur.est; } }
  function pause(){ if(A.paused) return; A.paused=true; A.pausedAt=A.now; A.q=A.q.filter(function(x){ return x.pri===3&&false; }); var b=A.booth; b.until=0; if(b.cur) b.cur.done=true; }
  function resume(now){ if(!A.paused) return; if(now!=null) A.now=now; var d=A.now-A.pausedAt; A.paused=false; var r=A.race; if(r){ if(r.lapAt) r.lapAt+=d; if(r.gateAt) r.gateAt+=d; } }
  function story(){ var s=A.story; if(s&&s.until&&A.now>s.until+6000&&s.kind!=="leader"&&A.race&&A.race.cur){ var l=A.race.cur[0]; return {kind:"leader",label:"the leader",riders:l?[l.s]:[],ids:l?[seatId(l.s)]:[],section:null,lap:lapNo(),at:A.now,until:A.now}; } return s; }
  function upcoming(){ return A.q.filter(function(x){ return x.story&&x.race===(A.race&&A.race.key); }).map(function(x){ return {kind:x.story,at:x.due,riders:(x.subj||[]).slice(),ev:x.ev,pri:x.pri}; }).sort(function(a,b){ return a.at-b.at; }); }
  function setTrack(t){ t=t||{}; A.track.layout=t.layout||null; A.track.sectionAt=typeof t.sectionAt==="function"?t.sectionAt:null; }
  /* the variety memory (which lines were heard and how long ago) and the sitting's flags, for the page to keep with its save */
  function state(){ var age={}, sd={}; for(var k in A.used) age[k]=Math.max(0,Math.round(A.now-A.used[k])); for(var h in A.said){ var a=A.now-A.said[h]; if(a<600000) sd[h]=Math.max(0,Math.round(a)); } return JSON.parse(JSON.stringify({v:1,recent:A.recent,age:age,sit:A.sit,said:sd})); }   /* said: the texts of the last 10 minutes (hashes), so a reload never repeats them */
  function restore(st,now){ if(!st||st.v!==1) return; if(now!=null) A.now=now; if(Array.isArray(st.recent)) A.recent=st.recent.slice(-12); if(st.age) for(var k in st.age) A.used[k]=A.now-(+st.age[k]||0); if(st.sit) for(var k2 in st.sit) A.sit[k2]=st.sit[k2]; if(st.said&&typeof st.said==="object") for(var h in st.said) A.said[h]=A.now-(+st.said[h]||0); }
  function set(k,v){ if(k==="speed"||k==="chatter"||k==="era"||k==="lapMs") o[k]=v; if(k==="sayNames"){ sayNames=v||{}; A.names={}; } }
  function reset(){ A.q=[]; A.race=null; A.R=null; A.rmap=null; A.rounds={}; var b=A.booth; b.until=0; b.cur=null; }

  /* the booth must never break the game: a bug in here is swallowed (and logged once), the race goes on. create({debug:true}) throws instead
     (the tests). */
  var warned=false;
  function safe(f,def){ return function(){ try{ return f.apply(null,arguments); }catch(e){ if(o.debug) throw e; if(!warned){ warned=true; try{ if(g.console&&g.console.warn) g.console.warn("announce.js:",e&&e.message); }catch(x){} } return def; } }; }
  return {feed:safe(feed),tick:safe(tick),phase:safe(phase),shown:safe(shown),shot:safe(shot),lineDone:safe(lineDone),lineStart:safe(lineStart),story:safe(story,null),upcoming:safe(upcoming,[]),setTrack:safe(setTrack),
    state:safe(state,null),restore:safe(restore),set:safe(set),reset:safe(reset),pause:safe(pause),resume:safe(resume),
    history:function(){ return A.hist.slice(); },queue:function(){ return A.q.map(function(x){ return {ev:x.ev,pri:x.pri,due:x.due,exp:x.exp,after:x.after}; }); },
    _A:A};
}

MX.Announce={create:create,sayify:sayify,words:words,ordWord:ordWord,plateWords:plateWords,yearWords:yearWords,sectionFromLayout:sectionFromLayout,eraOf:eraOf,
  crew:function(){ var B=BANK(); return B?B.crew:null; }};
if(typeof module!=="undefined"&&module.exports) module.exports=MX.Announce;
})(typeof window!=="undefined"?window:globalThis);
