/* Board Games — the voice (window.BGVoice): speech and captions for any game's commentators. Shared, no dependencies.
   First user: the Motocross War announcers (mxwar/announce.js), two voices: "a" (the lead caller) and "b" (the analyst).
     BGVoice.speak(text, {who:"a"|"b", say, tier:"T0".."T3", priority:0..3, interrupt, ttl, line, onStart, onEnd})   -> id (null when Off)
     BGVoice.stop()                         stop the line playing and clear the queue
     BGVoice.mode("voice"|"captions"|"off") / BGVoice.on() / BGVoice.off() / BGVoice.volume(0..1)
     BGVoice.onCaption(fn)                  fn({id, text, who, name, state:"start"|"end"}) for the page's own caption UI
     BGVoice.captions(host, {names})        or the built-in caption strip (ui/voice.css, loaded on demand)
     BGVoice.onStart(fn) / BGVoice.onEnd(fn) the duck hook: lower the game's music while a line plays
     BGVoice.ready() / BGVoice.onReady(fn)  {ready, engine:"native"|"speech"|"captions"|"clips", voices (the men's voices it can use), unlocked, why, info (what was found when there is no man)}
     BGVoice.unlock()                       from a user tap (done automatically on the first tap or key: iOS needs it)
     BGVoice.voices() / BGVoice.setVoice(who, name) / BGVoice.configure({rate:{a,b}, pitch:{a,b}, names:{a,b}})   voices() lists only the men's voices
     BGVoice.useClips(fn)                   optional: fn(line) -> URL of a pre-recorded clip of that exact line (played first), or null
     BGVoice.useEngine({play(line,done)->true if it took the line, stop()})   optional: a recorded-voice player (stitched clips); tried first,
                                            the device voices are the fallback for a line it declines
   Engines, in order: the Board Games app's bridge (window.AndroidTV on the Fire TV app, window.BoardGamesApp on the phone app: speak / stop /
   voices / ttsReady / ttsStatus / ttsChosen, Android's own text to speech), else the browser's Web Speech API when it has on-device English
   voices (iPhone Safari, Android Chrome, desktop), else captions only. No network, no cloud voices, no keys: a voice that says it needs the
   network (localService false) is never used.
   THE ANNOUNCERS ARE MEN (the CEO, 2026-10-18): only a voice KNOWN to be a man's (an explicit list of names and Google voice codes, see "which
   voices may speak") is ever used, and the two announcers get two different men when the device has them. No man's voice = captions only;
   ready().why says why ("no-male-voice", "no-voice", "old-app" or "starting"); a woman's voice is never the fallback. An app from before the
   rule (a bridge without ttsChosen()) picks its own voice, which may be a woman's: it is not used (captions) until the app is updated.
   One line at a time; an interrupt cuts a lower line; a line that waited past its ttl is dropped (a late line is a wrong fact); the page hidden
   = stop and clear. Every engine call is guarded: a failing engine falls back to captions, never to an error. */
(function(g){
"use strict";
if(g.BGVoice) return;
var doc=g.document||null;
var NOW=function(){ return (g.performance&&g.performance.now)?g.performance.now():Date.now(); };
var SRC=(function(){ try{ var c=doc&&doc.currentScript; return c&&c.src?c.src:""; }catch(e){ return ""; } })();

var S={mode:"voice",vol:1,engine:null,ready:false,unlocked:false,q:[],cur:null,seq:0,bridge:null,list:[],pick:{a:null,b:null},chosen:{a:null,b:null},
  names:{a:"Caller",b:"Analyst"},rate:{a:1.08,b:0.96},pitch:{a:1.0,b:0.9},same:false,clips:null,caps:[],starts:[],ends:[],readyFns:[],strips:[],native:{},
  hidden:!!(doc&&doc.visibilityState==="hidden"),waitT:null,initDone:false,spoke:false,fails:0,cleared:false,why:"",info:"",told:"",nat:null};
function call(fns,arg){ for(var i=0;i<fns.length;i++){ try{ fns[i](arg); }catch(e){} } }
function words(t){ var m=String(t||"").match(/[A-Za-z0-9'’-]+/g); return m?m.length:0; }
/* the delivery energy of a line (T0 calm ... T3 peak, from the commentator): the voice speeds up and lifts a little as the action rises */
var TIERK={T0:[0.96,0.98],T1:[1,1],T2:[1.05,1.03],T3:[1.1,1.07]};
function clampN(x,a,b){ return Math.max(a,Math.min(b,x)); }
function rateOf(it){ return clampN((S.rate[it.who]||1)*(TIERK[it.tier]||TIERK.T1)[0],0.5,2); }
function pitchFor(it){ return clampN(pitchOf(it.who)*(TIERK[it.tier]||TIERK.T1)[1],0.5,2); }
function estMs(it){ var w=words(it.say||it.text), r=rateOf(it); return Math.round(w/(2.6*r)*1000+400); }
function readMs(it){ return Math.max(1600,words(it.text)*340+600); }

/* ---------------- engines ---------------- */
function bridgeOf(){
  try{ var b=g.AndroidTV||g.BoardGamesApp||null; if(b&&typeof b.speak==="function"&&typeof b.ttsReady==="function") return b; }catch(e){}
  return null;
}
function hasSpeech(){ try{ return !!(g.speechSynthesis&&g.SpeechSynthesisUtterance); }catch(e){ return false; } }
/* ---------------- which voices may speak: MEN only ----------------
   The CEO's rule (2026-10-18): "I need men announcers" - both announcers are men, on every device. A voice is used only when it is KNOWN to be a
   man's voice: an explicit list of first names and Google voice codes below, never a guess by pitch or by how deep it sounds. Every voice that is
   not on the list (a woman's, or one nobody can tell) is left out, and a voice on the women's list is left out even when its name also matches a
   man's. No man's voice on the device = captions only (ready().why is "no-male-voice" and the Menu says so): a woman's voice is never the
   fallback and nothing is pitch-shifted to pass for a man. Where the gender facts come from: Google's own voice manifest
   (dl.google.com/android/tts/v3/voices-list-r3.proto: en-gb-x-rjs male, en-gb-x-fis and en-us-x-sfg female), the Readium speech voice list
   (github.com/readium/speech, json/en.json) for the newer Google codes and the Apple and Microsoft voice names.
   The Fire TV / phone app has the same rule in Kotlin (android-tv/.../MenVoices.kt): keep the two lists the same. */
function setOf(s){ var o=Object.create(null); s.split(" ").forEach(function(w){ if(w) o[w]=1; }); return o; }
/* men's first names: a voice is a man's only when its name (or its voiceURI) has one of these as a whole word, or it is a known Google code below */
var MALE_NAMES=setOf("aaron alex aman arthur daniel evan gordon jamie lee nathan oliver rishi tom "+   /* Apple: iPhone, iPad, Mac */
  "david mark george james richard ravi sean "+                                                       /* Windows: the voices installed on the PC */
  "joey matthew stephen gregory russell geraint brian eric "+                                         /* Amazon / Polly style names (a Fire OS speech engine) */
  "andrew guy steffan christopher roger ryan thomas william liam prabhat connor luke chilemba mitchell abeo wayne elimu");   /* Edge "Online (Natural)": network voices, left out below; listed for the day one of them is local */
/* women's names: a voice with one of these is left out for good, even when it also matches a man's name */
var FEMALE_NAMES=setOf("samantha victoria vicki karen moira tessa fiona veena kate serena susan allison ava nicky zoe joelle noelle stephanie martha matilda catherine isha tara sangeeta kathy agnes "+
  "zira hazel linda heera eva "+
  "aria jenny michelle ana emma sonia libby maisie natasha hayley clara heather neerja emily leah yan asilia molly ezinne rosa luna imani "+
  "amy nicole olivia salli joanna kendra kimberly ivy raveena aditi niamh gwyneth ayanda lisa bixby "+
  "female woman girl");
/* Google's on-device voices (Android, Chrome on Android, Chrome OS): the three letters after "-x-" are the voice */
var MALE_CODES=setOf("en-us-x-iom en-us-x-iol en-us-x-tpd en-gb-x-rjs en-gb-x-gbb en-gb-x-gbd en-au-x-aub en-au-x-aud en-in-x-end en-in-x-ene");
var FEMALE_CODES=setOf("en-us-x-tpc en-us-x-iob en-us-x-iog en-us-x-tpf en-us-x-sfg en-gb-x-fis en-gb-x-gba en-gb-x-gbc en-gb-x-gbg en-au-x-aua en-au-x-auc en-in-x-ena en-in-x-enc en-in-x-ahp");
var CODE_NAME={"en-us-x-iom":"US man 1","en-us-x-iol":"US man 2","en-us-x-tpd":"US man 3","en-gb-x-rjs":"UK man 1","en-gb-x-gbb":"UK man 2","en-gb-x-gbd":"UK man 3",
  "en-au-x-aub":"Australian man 1","en-au-x-aud":"Australian man 2","en-in-x-end":"Indian man 1","en-in-x-ene":"Indian man 2"};
/* Chrome OS (and newer Chrome) call the same Google voices "Google US English 4 (Natural)": the number is the voice */
var NAT_MALE=/\b(?:google|chrome os) (?:us english (?:3|4|6)|uk english (?:1|3|5)|australian english (?:2|4|5))\b/;
var NAT_FEMALE=/\b(?:google|chrome os) (?:us english (?:1|2|5|7|8)|uk english (?:2|4|6|7)|australian english (?:1|3))\b/;
/* Apple's novelty and Eloquence voices, the old Mac robots, eSpeak and Flite: "super old models of AI" (Readium's novelty and very-low-quality lists) */
var NOVELTY=/\b(albert|bad news|bahh|bells|boing|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|deranged|hysterical|junior|ralph|grandma|grandpa|eddy|flo|reed|rocko|sandy|shelley|fred|jacques|kathy|bruce|espeak|flite|eloquence)\b/i;
var SIRI_MEN=setOf("aaron arthur gordon");   /* Apple's compact versions of its newer (Siri) voices: a little better than the older compact ones */
function vlang(v){ return String(v.lang||"").replace("_","-").toLowerCase(); }
/* what a voice's name says about its speaker: n = name + " " + voiceURI, lower case -> {g:"m"|"f"|"" (unknown), person (who: two voices of one person are one man), bonus (ranking)} */
function genderOf(n){
  var r={g:"",person:"",bonus:0}, m, i, tok, man=false, c=/\b([a-z]{2,3}-[a-z]{2,4})-x-([a-z]{3})\b/.exec(n), code=c?c[1]+"-x-"+c[2]:"";
  /* Google's own variant label ("en-us-x-sfg#male_1" = a male variant of a base voice, whatever the base voice is) says it outright; the oldest, plainest kind */
  m=/(?:([a-z]{2,3}-[a-z]{2,4}-x-[a-z]{3}))?#(fe)?male_?(\d*)/.exec(n);
  if(m){ r.g=m[2]?"f":"m"; r.person=(m[1]||"")+"#"+(m[2]||"")+"male"+m[3]; r.bonus=-30; return r; }
  /* women first: any sign of a woman's voice leaves it out for good */
  if((code&&FEMALE_CODES[code])||NAT_FEMALE.test(n)){ r.g="f"; return r; }
  var toks=n.split(/[^a-z0-9\u00c0-\u024f]+/);
  for(i=0;i<toks.length;i++){ tok=toks[i]; if(FEMALE_NAMES[tok]||/^smtf\d/.test(tok)){ r.g="f"; return r; } }
  if(code&&MALE_CODES[code]){ r.g="m"; r.person=code; r.bonus=12+(code==="en-us-x-iom"?5:code==="en-us-x-iol"?4:0); return r; }
  if((m=NAT_MALE.exec(n))){ r.g="m"; r.person=m[0]; r.bonus=/us english 4/.test(m[0])?5:/us english 3/.test(m[0])?4:0; return r; }   /* 4 = iom, 3 = iol */
  for(i=0;i<toks.length;i++){
    tok=toks[i];
    if(MALE_NAMES[tok]){ r.g="m"; r.person=tok; r.bonus=tok==="alex"?20:SIRI_MEN[tok]?4:0; return r; }   /* Alex is the Mac's best voice */
    if(tok==="male"||/^smtm\d/.test(tok)) man=true;   /* "Google UK English Male", Samsung's SMTm voices */
  }
  if(man){ r.g="m"; r.person=n.replace(/\([^)]*\)/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
  return r;
}
/* a friendlier name for the Menu: Google's codes are not for people */
function labelOf(name){ var c=/\b([a-z]{2,3}-[a-z]{2,4})-x-([a-z]{3})\b/.exec(String(name||"").toLowerCase()); return (c&&CODE_NAME[c[1]+"-x-"+c[2]])||String(name||""); }
var CLS=Object.create(null);
function classify(v){
  var key=[v.name,v.voiceURI,v.lang,v.localService===false?"n":"l",v.default?"d":""].join("|");
  return CLS[key]||(CLS[key]=classify1(v));
}
function classify1(v){
  var name=String(v.name||""), n=(name+" "+String(v.voiceURI||"")).toLowerCase(), l=vlang(v), r={ok:false,why:"",g:"",person:"",label:name,s:-1};
  if(!/^en(-|$)/.test(l)){ r.why="lang"; return r; }
  if(v.localService===false||/(^|[^a-z])(network|online)([^a-z]|$)/.test(n)){ r.why="network"; return r; }   /* a network voice: never (no cloud voices) */
  if(NOVELTY.test(n)){ r.why="novelty"; return r; }
  var g=genderOf(n); r.g=g.g; r.person=g.person; r.label=labelOf(name);
  if(g.g!=="m"){ r.why=g.g==="f"?"woman":"unknown"; return r; }   /* only a voice known to be a man's goes on the air */
  /* ranking among the men: the accent (the CEO and the sport are American), then the quality (premium > enhanced / natural > standard > compact) */
  var s=100+(l==="en-us"?30:l==="en-gb"?26:/^en-(au|ca|ie|nz)/.test(l)?18:10);
  if(/premium/.test(n)) s+=40; else if(/enhanced|natural|neural|studio/.test(n)) s+=25;
  if(/compact/.test(n)) s-=20;
  s+=g.bonus; if(v.default) s+=2;
  r.ok=true; r.s=s; return r;
}
function score(v){ return classify(v).s; }          /* -1 = not a man's voice we can use */
/* the men's voices of a list, best first */
function menOf(list){
  return list.map(function(v){ return {v:v,c:classify(v)}; }).filter(function(x){ return x.c.ok; })
    .sort(function(a,b){ return b.c.s-a.c.s||(a.v.name<b.v.name?-1:a.v.name>b.v.name?1:0); });
}
function menList(list){ var seen=Object.create(null); return menOf(list).filter(function(x){ if(seen[x.v.name]) return false; seen[x.v.name]=true; return true; }).map(function(x){ return x.v; }); }
/* two different men: the best for the caller; for the analyst the best other PERSON (two quality levels of one name are one man); one man only =
   the same voice for both, told apart by pitch. null = the device has no man's voice. */
function chooseVoices(list){
  var ok=menOf(list);
  if(!ok.length) return null;
  var a=S.pick.a&&ok.filter(function(x){ return x.v.name===S.pick.a; })[0]||ok[0];
  var b=S.pick.b&&ok.filter(function(x){ return x.v.name===S.pick.b; })[0]||null;
  if(!b) b=ok.filter(function(x){ return x.c.person!==a.c.person; })[0]||null;
  S.same=!b; if(!b) b=a;
  return {a:a.v,b:b.v};
}
function info(v){ if(!v) return null; var c=classify(v); return {name:v.name,lang:v.lang||"",local:v.localService!==false,male:c.ok,label:c.label||v.name}; }
function natInfo(o){ return o&&o.name?{name:o.name,lang:o.lang||"",local:true,male:true,label:labelOf(o.name)}:null; }
function pitchOf(who){ if(S.same) return who==="a"?1.05:0.85; return S.pitch[who]||1; }

function setReady(engine){
  var key=S.why+"|"+S.info, was=S.ready&&S.engine===engine&&S.told===key;
  S.engine=engine; S.ready=true; S.told=key;
  if(!was) call(S.readyFns,api.ready());
  pump();
}
function init(){
  if(S.initDone) return; S.initDone=true;
  var br=bridgeOf();
  if(br){
    /* An app from before the men's-voices rule has no ttsChosen(): it picks its own voice, which may be a woman's, and a page cannot tell it
       otherwise. Its speech is not used (a WebView has no speechSynthesis of its own): captions until the app is updated (it offers the update). */
    if(typeof br.ttsChosen!=="function"){ S.why="old-app"; setReady("captions"); return; }
    S.bridge=br;
    var t0=NOW(), fell=false;
    (function poll(){
      var ok=false, st=""; try{ ok=!!br.ttsReady(); }catch(e){ ok=false; } try{ st=String(br.ttsStatus()||""); }catch(e){ st=""; }
      if(ok){ useNative(br); return; }
      /* the app has finished looking and says there is no man's voice (or no English voice, or no speech engine): nothing to wait for */
      if(st==="no-male-voice"||st==="no-english"||st==="failed"){ S.bridge=null; S.why=st==="no-male-voice"?"no-male-voice":"no-voice"; S.info=nativeNote(br); setReady("captions"); return; }
      var waited=NOW()-t0;
      /* the app's speech engine starts asynchronously. After 6 s (by the clock, so a slow device does not wait longer) the page goes on with
         captions, and keeps asking for a minute and a half: a slow Fire TV may bring its voice up late (review) */
      if(!fell&&waited>=6000){ fell=true; S.bridge=null; webSpeechOrCaptions("starting"); }
      if(waited<90000) S.waitT=setTimeout(poll,fell?1500:250);
      else if(S.engine==="captions"&&S.why==="starting"){ S.why="no-voice"; call(S.readyFns,api.ready()); }
    })();
    return;
  }
  webSpeechOrCaptions();
}
/* what the app found (its speech engine and the English voices it listed): shown in the Menu when there is no man's voice */
function nativeNote(br){ try{ return typeof br.ttsInfo==="function"?String(br.ttsInfo()||"").slice(0,300):""; }catch(e){ return ""; } }
/* the app is ready: the men's voices it lists and the two it chose (ttsChosen) */
function useNative(br){
  var list=[], ch=null;
  try{ list=JSON.parse(br.voices()||"[]")||[]; }catch(e){ list=[]; }
  try{ ch=JSON.parse(br.ttsChosen()||"null"); }catch(e){ ch=null; }
  if(!ch||!ch.a||!ch.a.name){ S.bridge=null; S.why="no-male-voice"; S.info=nativeNote(br); setReady("captions"); return; }   /* it says it can speak but names no voice: not used */
  S.list=list; S.nat=ch; S.same=!ch.b||ch.same===true; S.bridge=br; S.unlocked=true; S.why=""; S.info=""; setReady("native");
}
/* why = the reason to give when there is no speech at all (default "no-voice"; "starting" while the app's own engine is still coming up) */
function webSpeechOrCaptions(why){
  if(!hasSpeech()){ S.why=why||"no-voice"; setReady("captions"); return; }
  var done=false;
  function voicesNow(){ var list=[]; try{ list=g.speechSynthesis.getVoices()||[]; }catch(e){ list=[]; } return list; }
  function none(list){   /* English voices on the device but no man among them, or no English voice at all (S.info: which ones) */
    if(why) return why;
    var seen=Object.create(null), names=[], n=0;
    list.forEach(function(v){ if(/^en(-|$)/.test(vlang(v))&&v.localService!==false&&!NOVELTY.test(String(v.name||"")+" "+String(v.voiceURI||""))){ n++; if(!seen[v.name]&&names.length<8){ seen[v.name]=1; names.push(v.name); } } });
    S.info=names.join(", ");
    return n?"no-male-voice":"no-voice";
  }
  function take(){
    if(done) return false; var list=voicesNow();
    var c=chooseVoices(list);
    if(!c){ var w=none(list); if(S.ready&&S.engine==="captions"){ S.why=w; setReady("captions"); } return false; }   /* a list that grew but still has no man: only the reason / what was found may change */
    done=true; S.list=list; S.chosen=c; S.why=""; S.info=""; setReady("speech"); return true;
  }
  if(take()) return;
  var onVC=function(){ if(!done) take(); };
  try{ g.speechSynthesis.addEventListener("voiceschanged",onVC); }catch(e){ try{ g.speechSynthesis.onvoiceschanged=onVC; }catch(x){} }
  /* no man's voice after 2.5 s: captions only (a voices list that arrives later still switches the voice on) */
  setTimeout(function(){ if(!done&&!S.ready){ S.why=none(voicesNow()); setReady("captions"); } },2500);
  setTimeout(function(){ if(!done) take(); },6000);
}

/* ---------------- the queue: one line at a time ---------------- */
function prio(o){ var p=o&&o.priority; if(p==="interrupt") return 3; if(p==="high") return 2; if(p==="normal") return 1; if(p==="filler") return 0; p=+p; return p>=0&&p<=3?p:1; }
function speak(text,o){
  init(); o=o||{};
  if(S.mode==="off"||text==null||!String(text).trim()) return null;
  var it={id:o.id||("v"+(++S.seq)),text:String(text),say:String(o.say||text),who:o.who==="b"?"b":"a",pri:o.interrupt?3:prio(o),
    exp:NOW()+(o.ttl>0?o.ttl:8000),onStart:o.onStart||null,onEnd:o.onEnd||null,line:o.line||null,tier:/^T[0-3]$/.test(o.tier)?o.tier:null};
  if(it.pri===3&&S.cur&&S.cur.pri<3){ var c=S.cur; finish(c,true); }
  /* waiting lines: interrupts first (in their order), then the rest by priority, first come first served */
  var k=S.q.length; while(k>0&&S.q[k-1].pri<it.pri) k--; S.q.splice(k,0,it);
  if(S.q.length>6){ var low=0; for(var i=1;i<S.q.length;i++) if(S.q[i].pri<S.q[low].pri) low=i; drop(S.q.splice(low,1)[0]); }
  pump();
  return it.id;
}
/* a line that never started (it waited past its ttl, was pushed out of a full queue, or was cleared): the page is told, or the commentator
   would think the booth is still busy with it (review). Told a moment later, never from inside pump() / speak() / stop(): the page's
   answer may hand a new line to speak() at once, and that must not happen in the middle of choosing the next line. */
function drop(x){ if(!x||x.done) return; x.done=true; clearTimeout(x.guard); if(x.onEnd) setTimeout(function(){ try{ x.onEnd(x,true); }catch(e){} },0); }
function pump(){
  if(S.cur||!S.ready||S.hidden) return;
  if(S.mode==="off"){ var gone=S.q; S.q=[]; gone.forEach(drop); return; }
  var t=NOW(), it=null;
  /* some engines drop a line spoken in the same breath as a cancel(): the next line waits a moment after a cut */
  if(S.cutAt&&t-S.cutAt<70){ clearTimeout(S.cutT); S.cutT=setTimeout(pump,75-(t-S.cutAt)); return; }
  while(S.q.length){ var x=S.q.shift(); if(x.exp>t){ it=x; break; } drop(x); }
  if(!it) return;
  S.cur=it; it.t0=t;
  caption(it,"start"); if(it.onStart) try{ it.onStart(it); }catch(e){} call(S.starts,it);
  var eng=S.mode==="captions"?"captions":S.engine, silent=S.mode==="captions";   /* a recorded-voice player works on a device that has no speech engine too */
  if(!silent&&S.custom&&playCustom(it)) return;
  if(!silent&&S.clips&&playClip(it)) return;
  run(it,eng);
}
function run(it,eng){
  var guard=function(ms){ clearTimeout(it.guard); it.guard=setTimeout(function(){ if(S.cur===it) finish(it,false); },ms); };
  if(eng==="native"&&S.bridge){
    try{
      if(typeof S.bridge.ttsVolume==="function"&&S.nvol!==S.vol){ try{ S.bridge.ttsVolume(S.vol); S.nvol=S.vol; }catch(e){} }
      var id=S.bridge.speak(it.say,it.who,rateOf(it),pitchFor(it),false);
      if(id){ it.nid=String(id); S.native[it.nid]=it; guard(estMs(it)*2.2+2500); return; }
    }catch(e){}
    eng="captions";
  }
  if(eng==="speech"&&hasSpeech()&&S.chosen&&S.chosen.a){
    try{
      var u=new g.SpeechSynthesisUtterance(it.say), v=(it.who==="b"?S.chosen.b:S.chosen.a)||S.chosen.a;
      if(v) u.voice=v; if(v&&v.lang) u.lang=v.lang;
      u.rate=rateOf(it); u.pitch=pitchFor(it); u.volume=Math.max(0,Math.min(1,S.vol));
      u.onstart=function(){ it.started=true; S.spoke=true; S.fails=0; };
      u.onend=function(){ if(S.cur===it) finish(it,false); };
      u.onerror=function(ev){
        if(S.cur!==it) return;
        var why=ev&&ev.error; if(why==="interrupted"||why==="canceled") return;
        if(it.started){ finish(it,false); return; }                 /* it had begun to speak: the line is over */
        /* the engine refused the line (not-allowed before the first tap, synthesis-failed ...): the caption stays up for its reading time,
           it does not flash by and take the next lines with it; an engine that keeps failing is given up for captions only (review) */
        S.fails++;
        if(why!=="not-allowed"&&S.fails>=3){ setReady("captions"); }
        guard(readMs(it));
      };
      it.u=u;
      var ss=g.speechSynthesis; try{ if(ss.paused) ss.resume(); }catch(e){}
      ss.speak(u); guard(estMs(it)*2.2+2500); return;
    }catch(e){}
    eng="captions";
  }
  /* captions only: the line stays up for its reading time */
  guard(readMs(it));
}
function playClip(it){
  var url=null; try{ url=S.clips(it.line||{text:it.text,who:it.who}); }catch(e){ url=null; }
  if(!url||typeof g.Audio!=="function") return false;
  try{
    var a=new g.Audio(url); a.volume=Math.max(0,Math.min(1,S.vol)); it.audio=a;
    a.onended=function(){ if(S.cur===it) finish(it,false); };
    a.onerror=function(){ if(S.cur===it&&!it.fell){ it.fell=true; it.audio=null; run(it,S.engine); } };
    var p=a.play(); if(p&&p.catch) p.catch(function(){ if(S.cur===it&&!it.fell){ it.fell=true; it.audio=null; run(it,S.engine); } });
    clearTimeout(it.guard); it.guard=setTimeout(function(){ if(S.cur===it) finish(it,false); },estMs(it)*3+4000);
    return true;
  }catch(e){ return false; }
}
/* a custom engine (the recorded-voice player): it takes the line or declines it */
function playCustom(it){
  var E=S.custom; if(!E||typeof E.play!=="function") return false;
  var line=it.line||{text:it.text,say:it.say,who:it.who,tier:it.tier}, took=false;
  try{ took=!!E.play(line,function(){ if(S.cur===it) finish(it,false); }); }catch(e){ took=false; }
  if(took){ it.custom=true; clearTimeout(it.guard); it.guard=setTimeout(function(){ if(S.cur===it) finish(it,false); },estMs(it)*3+6000); }
  return took;
}
function halt(it){
  if(!it) return;
  S.cutAt=NOW();
  if(it.custom&&S.custom&&typeof S.custom.stop==="function"){ try{ S.custom.stop(); }catch(e){} }
  if(it.audio){ try{ it.audio.pause(); }catch(e){} it.audio=null; }
  if(it.u&&hasSpeech()){ try{ it.u.onend=null; it.u.onerror=null; g.speechSynthesis.cancel(); }catch(e){} }
  if(it.nid&&S.bridge){ try{ S.bridge.stop(); }catch(e){} delete S.native[it.nid]; }
}
function finish(it,cut){
  if(!it||it.done) return; it.done=true; clearTimeout(it.guard);
  if(cut) halt(it); else if(it.nid) delete S.native[it.nid];
  if(S.cur===it) S.cur=null;
  caption(it,"end",cut);
  if(it.onEnd) try{ it.onEnd(it,!!cut); }catch(e){} call(S.ends,it);
  if(!cut) setTimeout(pump,0);
}
function stop(){
  var c=S.cur, gone=S.q; S.q=[]; clearTimeout(S.cutT);
  if(c) finish(c,true);
  gone.forEach(drop);
  if(hasSpeech()) try{ g.speechSynthesis.cancel(); }catch(e){}
  if(S.bridge) try{ S.bridge.stop(); }catch(e){}
  if(S.custom&&typeof S.custom.stop==="function") try{ S.custom.stop(); }catch(e){}
}
/* the app reports the end of a native line: window.__bgTts("start"|"done"|"error"|"stop", id) */
g.__bgTts=function(ev,id){ var it=S.native[String(id)]; if(!it) return; if(ev==="done"||ev==="error"||ev==="stop"){ if(S.cur===it) finish(it,false); } };

/* ---------------- unlocking (iOS and Chrome speak only after the page has had a tap) ---------------- */
function unlock(){
  init();
  if(S.spoke||S.engine==="native"){ S.unlocked=true; return true; }
  if(hasSpeech()){
    var c=S.cur;
    try{
      /* a line spoken before the first tap can sit blocked in the browser's own queue (iOS): clear it now, or it would be heard late (a
         line that is really playing - it has started - is left alone; one issued a moment ago may just not have reported its start yet) */
      if(c&&c.u&&!c.started&&S.engine==="speech"&&NOW()-c.t0>600) finish(c,true);
      else if(!c&&!S.cleared) g.speechSynthesis.cancel();
      S.cleared=true;
    }catch(e){}
    try{ var u=new g.SpeechSynthesisUtterance(" "); u.volume=0; u.rate=1; g.speechSynthesis.speak(u); }catch(e){}
  }
  S.unlocked=true; pump(); return true;
}
/* The first speak() must run inside a user gesture that the browser counts: touchend, click, keydown (iOS Safari does not count a
   pointerdown or a touchstart; Chrome counts pointerdown only for a mouse). So the unlock hangs on those, not on the first event that
   comes, and it tries again on the next taps until a line has really started to speak (review). */
if(doc&&doc.addEventListener){
  var GEST=["touchend","pointerup","mouseup","click","keydown"], nGest=0;
  var unhook=function(){ GEST.forEach(function(t){ try{ doc.removeEventListener(t,once,true); }catch(e){} }); };
  var once=function(){ unlock(); if(++nGest>=12||S.spoke||S.engine==="native") unhook(); };
  GEST.forEach(function(t){ try{ doc.addEventListener(t,once,{capture:true,passive:true}); }catch(e){ doc.addEventListener(t,once,true); } });
  doc.addEventListener("visibilitychange",function(){ S.hidden=doc.visibilityState==="hidden"; if(S.hidden) stop(); else pump(); });
  g.addEventListener&&g.addEventListener("pagehide",function(){ S.hidden=true; stop(); });
  g.addEventListener&&g.addEventListener("pageshow",function(){ S.hidden=false; });
}

/* ---------------- captions ---------------- */
function caption(it,state,cut){
  var ev={id:it.id,text:it.text,who:it.who,name:S.names[it.who]||"",state:state,cut:!!cut};
  call(S.caps,ev);
  S.strips.forEach(function(st){ try{ st.update(ev); }catch(e){} });
}
function ensureCss(){
  if(!doc||doc.getElementById("bgv-css")) return;
  var has=false; try{ for(var i=0;i<doc.styleSheets.length;i++){ var h=doc.styleSheets[i].href||""; if(/voice\.css/.test(h)) has=true; } }catch(e){}
  if(has) return;
  var l=doc.createElement("link"); l.id="bgv-css"; l.rel="stylesheet"; l.href=SRC?SRC.replace(/voice\.js(\?.*)?$/,"voice.css"):"../ui/voice.css";
  (doc.head||doc.documentElement).appendChild(l);
}
function captions(host,o){
  if(!doc) return null; o=o||{}; ensureCss();
  if(o.names) configure({names:o.names});
  host=host||doc.body;
  var el=doc.createElement("div"); el.className="bgv-cap"+(host===doc.body?" bgv-cap--fixed":""); el.setAttribute("role","status"); el.setAttribute("aria-live","polite");
  el.innerHTML='<span class="bgv-cap__who" aria-hidden="true"></span><span class="bgv-cap__text"></span>';
  host.appendChild(el);
  var whoEl=el.firstChild, txtEl=el.lastChild, hideT=null, curId=null;
  var st={el:el,update:function(ev){
    if(ev.state==="start"){ clearTimeout(hideT); curId=ev.id; whoEl.textContent=ev.name||""; txtEl.textContent=ev.text; el.setAttribute("data-who",ev.who); el.classList.add("is-on"); }
    else if(ev.id===curId){ clearTimeout(hideT); hideT=setTimeout(function(){ if(curId===ev.id) el.classList.remove("is-on"); },ev.cut?150:1300); }
  },hide:function(){ el.classList.remove("is-on"); },destroy:function(){ S.strips=S.strips.filter(function(x){ return x!==st; }); if(el.parentNode) el.parentNode.removeChild(el); }};
  S.strips.push(st);
  return st;
}

/* ---------------- settings ---------------- */
function mode(m){ if(m===undefined) return S.mode; m=m==="captions"||m==="off"?m:"voice"; S.mode=m; if(m==="off") stop(); return S.mode; }
function volume(v){ if(v===undefined) return S.vol; S.vol=Math.max(0,Math.min(1,+v||0)); return S.vol; }
function configure(c){
  c=c||{};
  ["a","b"].forEach(function(w){ if(c.rate&&c.rate[w]>0) S.rate[w]=Math.max(0.5,Math.min(2,+c.rate[w])); if(c.pitch&&c.pitch[w]>0) S.pitch[w]=Math.max(0.5,Math.min(2,+c.pitch[w])); if(c.names&&c.names[w]) S.names[w]=String(c.names[w]); });
}
function setVoice(who,name){ who=who==="b"?"b":"a"; S.pick[who]=name||null; if(S.engine==="speech"){ var c=chooseVoices(S.list); if(c) S.chosen=c; } return api.voices(); }

var api={
  speak:speak,stop:stop,unlock:unlock,mode:mode,volume:volume,configure:configure,setVoice:setVoice,captions:captions,
  on:function(){ return mode("voice"); },off:function(){ return mode("off"); },
  enabled:function(v){ if(v===undefined) return S.mode!=="off"; return mode(v?"voice":"off")!=="off"; },
  onCaption:function(fn){ if(typeof fn==="function") S.caps.push(fn); },
  onStart:function(fn){ if(typeof fn==="function") S.starts.push(fn); },
  onEnd:function(fn){ if(typeof fn==="function") S.ends.push(fn); },
  onReady:function(fn){ if(typeof fn!=="function") return; S.readyFns.push(fn); if(S.ready) try{ fn(api.ready()); }catch(e){} },
  ready:function(){ init(); return {ready:S.ready,engine:S.engine,voices:S.engine==="speech"?S.list.filter(function(v){ return score(v)>=0; }).length:S.engine==="native"?S.list.length:0,unlocked:S.unlocked,mode:S.mode,why:S.engine==="captions"?S.why:"",info:S.engine==="captions"?S.info:""}; },
  voices:function(){
    if(S.engine==="speech") return {a:info(S.chosen.a),b:info(S.chosen.b),same:S.same,list:menList(S.list).map(info)};
    if(S.engine==="native"){ var n=S.nat||{}; return {a:natInfo(n.a),b:natInfo(n.b||n.a),same:S.same,list:S.list.map(natInfo).filter(Boolean)}; }
    return {a:null,b:null,same:false,list:[],why:S.why};
  },
  speaking:function(){ return !!S.cur; },
  queued:function(){ return S.q.length; },
  useClips:function(fn){ S.clips=typeof fn==="function"?fn:null; },
  useEngine:function(e){ S.custom=e&&typeof e.play==="function"?e:null; },
  _S:S,_score:score,_classify:classify,_lists:{maleNames:MALE_NAMES,femaleNames:FEMALE_NAMES,maleCodes:MALE_CODES,femaleCodes:FEMALE_CODES}
};
g.BGVoice=api;
})(typeof window!=="undefined"?window:globalThis);
