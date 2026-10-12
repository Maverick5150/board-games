/* Scattergories-style game — the player's screen: writing form, scoring review with challenges + votes, round and game results.
   It only reads a snapshot S (Scatter.Engine.snapshot) and sends intents, so the phone game and the Party-mode phones share it. */
(function(g){
"use strict";
var Sc=g.Scatter=g.Scatter||{}, E=Sc.Engine;
function esc(s){ return String(s==null?"":s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
var PCOL=["#e23b3b","#2b7be0","#27a758","#eec21b","#a65bd6","#19b5b0","#f08a24","#ec6aa8"];
var CSS=[
".scT{width:100%;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}",
".scTop{display:flex;align-items:center;gap:12px;justify-content:center;margin:6px 0}",
".scLetter{width:84px;height:84px;border-radius:18px;background:linear-gradient(145deg,#ffe36e,#f2a31b);color:#3a1d00;display:flex;align-items:center;justify-content:center;font:900 56px Georgia,serif;box-shadow:0 6px 0 #a56200,0 10px 18px #0007;transform:rotate(-4deg)}",
".scLetter.kw{width:auto;padding:0 14px;font-size:30px;letter-spacing:3px;height:64px}",
".scTimer{font:900 40px system-ui;min-width:112px;text-align:center;padding:4px 10px;border-radius:14px;background:#00000066}.scTimer.low{background:#b32b1f;animation:scpulse .6s infinite}",
"@keyframes scpulse{50%{opacity:.6}}",
".scBar{height:8px;border-radius:99px;background:#00000055;overflow:hidden;margin:4px 0 8px}.scBar i{display:block;height:100%;background:linear-gradient(90deg,#27a758,#eec21b,#e23b3b);transition:width .5s linear}",
".scHint{text-align:center;font-size:12.5px;color:#e6d9c4;margin-bottom:6px}",
".scRow{display:flex;gap:8px;align-items:center;background:#00000044;border-radius:12px;padding:7px 9px;margin:5px 0}",
".scRow .n{width:22px;font-weight:900;opacity:.7;text-align:right;flex:none}",
".scRow .lb{flex:1;font-size:13.5px;font-weight:700;line-height:1.2;min-width:0}",
".scRow .ins{display:flex;flex-direction:column;gap:4px;width:52%;flex:none}",
".scRow input{width:100%;padding:9px 10px;border-radius:9px;border:2px solid #ffffff33;background:#fffdf6;color:#1a1200;font-size:16px;font-weight:700}",
".scRow input:focus{outline:none;border-color:#f2bf24;box-shadow:0 0 0 3px #f2bf2466}",
".scRow input.good{border-color:#2f9e44}.scRow input.bad{border-color:#d6322b}",
".scBtns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:10px 0}",
".scBtns button,.scModal button.b{background:#2a1f45;color:#fff;border:1px solid #ffffff66;border-radius:12px;padding:12px 16px;font-size:15px;font-weight:900;cursor:pointer}",
".scBtns button.pri,.scModal button.pri{background:#e8590c;border-color:#ffa56a}.scBtns button[disabled]{opacity:.4}",
".scSlot{background:#00000044;border-radius:12px;padding:8px 10px;margin:6px 0}",
".scCat{font-weight:900;font-size:13.5px;margin-bottom:4px}.scCat span{opacity:.6;margin-right:4px}",
".scAns{display:inline-flex;align-items:center;gap:6px;border-radius:999px;padding:5px 11px;margin:3px 4px 3px 0;font-size:13px;font-weight:800;border:2px solid transparent;cursor:default}",
".scAns .w{opacity:.8;font-weight:600;font-size:11px}.scAns b{margin-left:2px}",
".scAns.ok{background:#1f6b36;border-color:#5fe08a}.scAns.dup{background:#6b2a1f;border-color:#ff8a6a;text-decoration:line-through;opacity:.85}.scAns.invalid{background:#444;border-color:#888;opacity:.7;text-decoration:line-through}",
".scAns.chal{cursor:pointer}.scAns.me{box-shadow:0 0 0 2px #ffd23f}",
".scAns .x{font-size:10px;font-weight:700;opacity:.85}",
".scTot{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}.scTot div{background:#00000066;border-radius:999px;padding:6px 12px;font-weight:800;font-size:13px;border:2px solid transparent}.scTot b{color:#ffd23f}",
"table.scTab{width:100%;border-collapse:collapse;font-size:14px;margin:6px 0}table.scTab th,table.scTab td{padding:7px 5px;text-align:right;border-bottom:1px solid #ffffff22}table.scTab th:first-child,table.scTab td:first-child{text-align:left}",
".scModal{position:fixed;inset:0;z-index:80;background:#0b0618ee;display:none;align-items:center;justify-content:center;padding:14px}.scModal.show{display:flex}",
".scModal .sh{width:min(100%,420px);background:#26193f;border:2px solid #ffffff55;border-radius:18px;padding:16px;text-align:center}",
".scModal h3{margin:0 0 8px;font-size:18px}.scModal .big{font:900 24px Georgia,serif;color:#ffd23f;margin:8px 0}",
".scLet{display:flex;flex-wrap:wrap;gap:6px;justify-content:center;margin:8px 0}.scLet button{width:40px;height:40px;border-radius:10px;border:2px solid #ffffff55;background:#2a1f45;color:#fff;font:900 18px Georgia,serif}.scLet button[disabled]{opacity:.25}",
"@media(min-width:520px){.scRow .ins{width:46%}}"
].join("\n");
function injectCSS(){ if(typeof document==="undefined"||document.getElementById("scatCss")) return; var s=document.createElement("style"); s.id="scatCss"; s.textContent=CSS; document.head.appendChild(s); }
function mmss(t){ t=Math.max(0,Math.ceil(t)); return Math.floor(t/60)+":"+("0"+(t%60)).slice(-2); }

function create(cfg){
  injectCSS();
  var root=cfg.root, S=null, built="", answers=null, deadline=0, tick=null, sent=false, shownVote={}, lastProg=0;
  root.classList.add("scT");
  var modal=document.createElement("div"); modal.className="scModal"; modal.innerHTML='<div class="sh" id="scsh"></div>'; document.body.appendChild(modal);
  function openModal(h){ modal.querySelector("#scsh").innerHTML=h; modal.classList.add("show"); }
  function closeModal(){ modal.classList.remove("show"); }
  function send(a){ var r=cfg.send(a); if(r&&r.ok===false&&cfg.toast) cfg.toast(r.msg||"Not allowed."); return r; }
  function readInputs(){ var out=[]; root.querySelectorAll(".scRow").forEach(function(row){ var arr=[]; row.querySelectorAll("input").forEach(function(i){ arr.push(i.value); }); out.push(arr); }); return out; }
  function submit(){ if(sent) return; sent=true; var a=readInputs(); send({t:"submit",answers:a}); render(); }
  function startTimer(){ clearInterval(tick); tick=setInterval(function(){ if(!S||S.phase!=="write"||sent) return; var left=(deadline-Date.now())/1000; paintTimer(left); if(left<=0){ submit(); } },250); }
  function paintTimer(left){
    var t=root.querySelector("#scTimer"), b=root.querySelector("#scBar i"); if(!t) return;
    t.textContent=mmss(left); t.classList.toggle("low",left<=10); if(b) b.style.width=Math.max(0,Math.min(100,left/(S.o.timer)*100))+"%";
    var now=Date.now(); if(cfg.onProgress&&now-lastProg>2500){ lastProg=now; cfg.onProgress(readInputs()); }
  }
  /* ---------- writing ---------- */
  function buildWrite(){
    var o=S.o, kw=o.mode==="keyword", me=S.me;
    var h='<div class="scTop"><div class="scLetter'+(kw?" kw":"")+'">'+(kw?esc(S.keyword):esc(S.letter))+'</div><div class="scTimer" id="scTimer">0:00</div></div><div class="scBar" id="scBar"><i></i></div>';
    h+='<div class="scHint">'+(kw?'Key word <b>'+esc(S.keyword)+'</b> — write <b>'+esc(S.slots[0].label)+'</b> for each letter':'Every answer must start with <b>'+esc(S.letter)+'</b>'+(o.startRule==="bonus"?' (2 points if it does, 1 if not)':'')+(o.answersPer>1?' · up to '+o.answersPer+' answers per category':''))+' · round '+S.round+(o.mode==="keyword"?'':'/'+S.rounds)+'</div>';
    if(S.star&&me>=0) h+='<div class="scBtns"><button id="scStar">⭐ You rolled the star — pick any letter</button></div>';
    h+='<div id="scForm">'+S.slots.map(function(s,i){
      var ins=""; for(var k=0;k<o.answersPer;k++) ins+='<input data-s="'+i+'" data-k="'+k+'" type="text" maxlength="60" autocomplete="off" autocapitalize="words" spellcheck="false" placeholder="'+(kw?esc(s.letter)+"…":esc(s.letter)+"…")+'" value="'+esc(((S.myAnswers||[])[i]||[])[k]||"")+'">';
      return '<div class="scRow"><span class="n">'+(i+1)+'</span><span class="lb">'+(kw?'<b style="font-size:20px;color:#ffd23f">'+esc(s.letter)+'</b>':esc(s.label))+'</span><span class="ins">'+ins+'</span></div>';
    }).join("")+'</div><div class="scBtns"><button class="pri" id="scDone">✓ I\'m done</button></div>';
    root.innerHTML=h; sent=false;
    root.querySelectorAll("input").forEach(function(inp){
      inp.addEventListener("input",function(){ var v=inp.value.trim(), L=S.slots[+inp.dataset.s].letter; inp.classList.toggle("good",!!v&&E.startsWith(v,L)); inp.classList.toggle("bad",!!v&&S.o.startRule==="must"&&!E.startsWith(v,L)); });
      inp.addEventListener("keydown",function(e){ if(e.key==="Enter"){ e.preventDefault(); var all=Array.prototype.slice.call(root.querySelectorAll("input")), i=all.indexOf(inp); if(all[i+1]) all[i+1].focus(); else inp.blur(); } });
    });
    var d=root.querySelector("#scDone"); d.addEventListener("click",function(){ submit(); });
    var st=root.querySelector("#scStar"); if(st) st.addEventListener("click",function(){ pickStar(); });
    deadline=Date.now()+(S.secLeft!=null?S.secLeft:S.o.timer)*1000; startTimer(); paintTimer((deadline-Date.now())/1000);
  }
  function pickStar(){
    var free=S.starFree||E.LETTERS; openModal('<h3>⭐ Star! Pick any unused letter</h3><div class="scLet">'+E.LETTERS.map(function(l){ return '<button data-l="'+l+'"'+(free.indexOf(l)<0?" disabled":"")+'>'+l+'</button>'; }).join("")+'</div>');
    modal.querySelector("#scsh").onclick=function(e){ var b=e.target.closest&&e.target.closest("button[data-l]"); if(b&&!b.disabled){ closeModal(); send({t:"star",letter:b.dataset.l}); } };
  }
  /* ---------- review / results ---------- */
  function playerName(i){ return S.players[i]?S.players[i].name:"?"; }
  function reviewHTML(res,scored){
    var o=S.o, me=S.me, h='';
    h+='<div class="scTop"><div class="scLetter'+(S.keyword?" kw":"")+'">'+(S.keyword?esc(S.keyword):esc(S.letter))+'</div></div>';
    h+='<div class="scHint">'+(scored?'Round '+S.round+' scored':'Scoring — '+(o.judge==="vote"?'tap someone\'s answer to challenge it':'answers are checked automatically'))+'</div>';
    h+=S.slots.map(function(s,i){
      var list=res.entries.filter(function(e){ return e.slot===i&&e.raw; });
      var chips=list.map(function(e){
        var cls=e.status==="ok"?"ok":(e.status==="dup"?"dup":"invalid"), canC=!scored&&o.judge==="vote"&&(e.status==="ok"||e.status==="dup"), chal=(S.challenges||[]).filter(function(c){ return c.slot===e.slot&&c.p===e.p&&c.k===e.k; })[0];
        return '<span class="scAns '+cls+(canC&&!chal?" chal":"")+(e.p===me?" me":"")+'" data-s="'+e.slot+'" data-p="'+e.p+'" data-k="'+e.k+'"><span class="w">'+esc(playerName(e.p))+'</span>'+esc(e.raw)+(e.pts?'<b>+'+e.pts+'</b>':'')+(chal?'<span class="x">⚖ '+(chal.state==="open"?"voting…":chal.state==="accepted"?"kept":"voted out")+'</span>':(e.status!=="ok"&&e.reason?'<span class="x">'+esc(e.reason)+'</span>':''))+'</span>';
      }).join("")||'<span style="opacity:.6;font-size:12px">no answers</span>';
      return '<div class="scSlot"><div class="scCat"><span>'+(i+1)+'.</span>'+(S.o.mode==="keyword"?'<b style="color:#ffd23f">'+esc(s.letter)+'</b> — ':'')+esc(s.label)+'</div>'+chips+'</div>';
    }).join("");
    h+='<div class="scTot">'+S.players.map(function(p){ return '<div>'+esc(p.name)+' <b>+'+((res.totals||{})[p.id]||0)+'</b></div>'; }).join("")+'</div>';
    return h;
  }
  function scoreTable(){
    var rows=S.players.slice().sort(function(a,b){ return b.score-a.score; }).map(function(p){ var cells=""; for(var i=0;i<(S.round);i++) cells+='<td>'+(p.rs[i]!=null?p.rs[i]:"—")+'</td>'; return '<tr><td>'+esc(p.name)+'</td>'+cells+'<td><b>'+p.score+'</b></td></tr>'; }).join("");
    var head='<tr><th>Player</th>'; for(var i=0;i<S.round;i++) head+='<th>R'+(i+1)+'</th>'; head+='<th>Total</th></tr>';
    return '<table class="scTab">'+head+rows+'</table>';
  }
  function render(){
    if(!S) return;
    var key=S.phase+":"+S.round+":"+S.me+":"+(S.letter||"")+":"+(S.keyword||"");
    if(S.phase==="write"){
      if(S.me<0){ clearInterval(tick); root.innerHTML='<div class="scHint" style="padding:30px 0;font-size:16px">Waiting for the next player…</div>'; built=key; return; }
      if(sent){ clearInterval(tick); root.innerHTML='<div class="scTop"><div class="scLetter">'+(S.keyword?"✓":esc(S.letter))+'</div></div><div class="scHint" style="font-size:16px;padding:14px 0">Answers sent ✔<br>Waiting for the others…</div><div class="scTot">'+S.players.map(function(p){ return '<div>'+esc(p.name)+' <b>'+p.filled+'/'+S.slots.length+'</b></div>'; }).join("")+'</div>'; return; }
      if(built!==key){ built=key; buildWrite(); }
      else if(S.starChanged){ }
      return;
    }
    clearInterval(tick); built=key;
    if(S.phase==="review"){
      root.innerHTML=reviewHTML(S.review,false)+'<div class="scBtns"><button class="pri" id="scReady">'+(cfg.readyLabel||"Done scoring ▶")+'</button></div>';
      var rb=root.querySelector("#scReady"); if(rb) rb.addEventListener("click",function(){ send({t:"ready"}); });
      voteCheck(); return;
    }
    if(S.phase==="scored"||S.phase==="over"){
      var over=S.phase==="over";
      var h=reviewHTML(S.result,true)+scoreTable();
      if(over){ h+='<div class="scTop" style="font-size:22px;font-weight:900;text-align:center">🏆 '+esc((S.winners||[]).map(playerName).join(" & "))+(S.winners&&S.winners.length>1?" tie!":" wins!")+'</div>'; }
      else if(S.tiebreak) h+='<div class="scHint" style="font-size:14px">Tied for the lead — an extra round decides it!</div>';
      h+='<div class="scBtns"><button class="pri" id="scNext">'+(over?"Play again":(S.tiebreak?"Tie-break round ▶":"Next round ▶"))+'</button></div>';
      root.innerHTML=h; root.querySelector("#scNext").addEventListener("click",function(){ send({t:over?"again":"next"}); });
      return;
    }
    root.innerHTML='<div class="scHint" style="padding:40px 0;font-size:18px">🎲 Rolling…<br>get ready!</div>';
  }
  /* challenge + vote windows */
  root.addEventListener("click",function(e){
    if(!S||S.phase!=="review"||S.o.judge!=="vote") return;
    var chip=e.target.closest&&e.target.closest(".scAns.chal"); if(!chip||S.me<0) return;
    var slot=+chip.dataset.s, p=+chip.dataset.p, k=+chip.dataset.k, ent=S.review.entries.filter(function(x){ return x.slot===slot&&x.p===p&&x.k===k; })[0]; if(!ent) return;
    openModal('<h3>Challenge this answer?</h3><div class="big">'+esc(ent.raw)+'</div><div style="opacity:.85;font-size:13px">'+esc(playerName(p))+' wrote it for “'+esc(S.slots[slot].label)+'” with the letter '+esc(S.slots[slot].letter)+'.<br>Everyone votes — majority wins.</div><div class="scBtns"><button class="pri b" data-c="1">⚖ Challenge it</button><button class="b" data-c="0">Never mind</button></div>');
    modal.querySelector("#scsh").onclick=function(ev){ var b=ev.target.closest&&ev.target.closest("button[data-c]"); if(!b) return; closeModal(); if(b.dataset.c==="1") send({t:"challenge",slot:slot,p:p,k:k}); };
  });
  function voteCheck(){
    if(S.me<0||S.phase!=="review") return;
    var open=(S.challenges||[]).filter(function(c){ return c.state==="open"&&c.votes[S.me]===undefined; })[0];
    if(!open){ if(modal.classList.contains("show")&&modal.dataset.vote){ closeModal(); modal.dataset.vote=""; } return; }
    var id=open.slot+"/"+open.p+"/"+open.k; if(modal.dataset.vote===id) return; modal.dataset.vote=id;
    var ent=S.review.entries.filter(function(x){ return x.slot===open.slot&&x.p===open.p&&x.k===open.k; })[0]||{raw:"?"};
    openModal('<h3>Vote: is this answer OK?</h3><div class="big">'+esc(ent.raw)+'</div><div style="font-size:13px;opacity:.9">for “'+esc(S.slots[open.slot].label)+'” starting with <b>'+esc(S.slots[open.slot].letter)+'</b><br><span style="opacity:.8">written by '+esc(playerName(open.p))+' · challenged by '+esc(playerName(open.by))+'</span></div><div class="scBtns"><button class="b pri" data-v="1">👍 Accept</button><button class="b" data-v="0">👎 Reject</button></div>');
    modal.querySelector("#scsh").onclick=function(ev){ var b=ev.target.closest&&ev.target.closest("button[data-v]"); if(!b) return; modal.dataset.vote=""; closeModal(); send({t:"vote",slot:open.slot,p:open.p,k:open.k,accept:b.dataset.v==="1"}); };
  }
  var self={update:function(s){ var prevPhase=S&&S.phase, prevRound=S&&S.round, prevMe=S&&S.me; S=s; if(S.phase==="write"&&(prevPhase!=="write"||prevRound!==S.round||prevMe!==S.me)){ sent=false; built=""; } render(); },
    destroy:function(){ clearInterval(tick); if(modal.parentNode) modal.parentNode.removeChild(modal); },
    readAnswers:readInputs,setDeadlineIn:function(sec){ deadline=Date.now()+sec*1000; },submitNow:function(){ submit(); },closeModal:closeModal,isSent:function(){ return sent; }};
  return self;
}
Sc.UI={create:create,CSS:CSS,mmss:mmss,PCOL:PCOL};
})(typeof window!=="undefined"?window:globalThis);
