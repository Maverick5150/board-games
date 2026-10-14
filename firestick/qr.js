/* Minimal QR Code encoder for the Party Mode join code (original code, no third-party service).
   Byte mode, error-correction level L/M/Q/H, versions 1-10 (up to 213 bytes at level M), automatic mask choice.
   Follows the public QR specification (ISO/IEC 18004).
   QR.matrix(text,{ecl:"M",mask:-1}) -> {size, mask, version, dark(x,y)}
   QR.svg(text,{ecl:"M",margin:4}) -> "<svg ...>" (black modules on white, crisp edges)
   "QR Code" is a registered trademark of DENSO WAVE INCORPORATED. */
(function(global){
  "use strict";
  // per version 1..10: [L, M, Q, H]
  var ECC_PER_BLOCK=[null,[7,10,13,17],[10,16,22,28],[15,26,18,22],[20,18,26,16],[26,24,18,22],[18,16,24,28],[20,18,18,26],[24,22,22,26],[30,22,20,24],[18,26,24,28]];
  var NUM_BLOCKS=[null,[1,1,1,1],[1,1,1,1],[1,1,2,2],[1,2,2,4],[1,2,4,4],[2,4,4,4],[2,4,6,5],[2,4,6,6],[2,5,8,8],[4,5,8,8]];
  var ECL={L:[0,1],M:[1,0],Q:[2,3],H:[3,2]};   // [table column, format bits]

  function utf8(s){ var out=[]; s=unescape(encodeURIComponent(String(s))); for(var i=0;i<s.length;i++) out.push(s.charCodeAt(i)); return out; }
  function rawModules(v){ var r=(16*v+128)*v+64; if(v>=2){ var na=Math.floor(v/7)+2; r-=(25*na-10)*na-55; if(v>=7) r-=36; } return r; }
  function dataCodewords(v,e){ return Math.floor(rawModules(v)/8)-ECC_PER_BLOCK[v][e]*NUM_BLOCKS[v][e]; }
  function gfMul(x,y){ var z=0; for(var i=7;i>=0;i--){ z=(z<<1)^((z>>>7)*0x11D); z^=((y>>>i)&1)*x; } return z&0xFF; }
  function rsDivisor(deg){ var r=[]; for(var i=0;i<deg-1;i++) r.push(0); r.push(1); var root=1;
    for(var k=0;k<deg;k++){ for(var j=0;j<r.length;j++){ r[j]=gfMul(r[j],root); if(j+1<r.length) r[j]^=r[j+1]; } root=gfMul(root,2); }
    return r; }
  function rsRemainder(data,div){ var r=div.map(function(){ return 0; });
    data.forEach(function(b){ var f=b^r.shift(); r.push(0); div.forEach(function(c,i){ r[i]^=gfMul(c,f); }); });
    return r; }

  function matrix(text,opt){
    opt=opt||{}; var ecl=ECL[opt.ecl||"M"]||ECL.M, e=ecl[0], bytes=utf8(text), v, cap;
    for(v=1;v<=10;v++){ cap=dataCodewords(v,e)*8; if(4+(v<10?8:16)+bytes.length*8<=cap) break; }
    if(v>10) throw new Error("QR: text too long");
    // data bits: byte mode, length, bytes, terminator, pad
    var bits=[]; function put(val,n){ for(var i=n-1;i>=0;i--) bits.push((val>>>i)&1); }
    put(4,4); put(bytes.length,v<10?8:16); bytes.forEach(function(b){ put(b,8); });
    put(0,Math.min(4,cap-bits.length)); while(bits.length%8) bits.push(0);
    for(var pad=0xEC;bits.length<cap;pad^=0xEC^0x11) put(pad,8);
    var data=[]; for(var i=0;i<bits.length;i+=8){ var b=0; for(var j=0;j<8;j++) b=(b<<1)|bits[i+j]; data.push(b); }
    // error correction + interleaving
    var nb=NUM_BLOCKS[v][e], eccLen=ECC_PER_BLOCK[v][e], raw=Math.floor(rawModules(v)/8), nShort=nb-raw%nb, shortLen=Math.floor(raw/nb);
    var div=rsDivisor(eccLen), blocks=[], k=0;
    for(i=0;i<nb;i++){ var dat=data.slice(k,k+shortLen-eccLen+(i<nShort?0:1)); k+=dat.length; var ecc=rsRemainder(dat,div); if(i<nShort) dat.push(0); blocks.push(dat.concat(ecc)); }
    var cw=[]; for(i=0;i<blocks[0].length;i++) blocks.forEach(function(bl,j){ if(i!==shortLen-eccLen||j>=nShort) cw.push(bl[i]); });

    var size=v*4+17, mod=[], fn=[];
    for(i=0;i<size;i++){ mod.push(new Array(size).fill(false)); fn.push(new Array(size).fill(false)); }
    function setF(x,y,d){ mod[y][x]=!!d; fn[y][x]=true; }
    for(i=0;i<size;i++){ setF(6,i,i%2===0); setF(i,6,i%2===0); }   // timing
    function finder(cx,cy){ for(var dy=-4;dy<=4;dy++) for(var dx=-4;dx<=4;dx++){ var d=Math.max(Math.abs(dx),Math.abs(dy)), x=cx+dx, y=cy+dy; if(x>=0&&x<size&&y>=0&&y<size) setF(x,y,d!==2&&d!==4); } }
    finder(3,3); finder(size-4,3); finder(3,size-4);
    var al=[]; if(v>1){ var na=Math.floor(v/7)+2, step=Math.ceil((v*4+4)/(na*2-2))*2; al=[6]; for(var p=size-7;al.length<na;p-=step) al.splice(1,0,p); }
    al.forEach(function(ay,ii){ al.forEach(function(ax,jj){ if((ii===0&&jj===0)||(ii===0&&jj===al.length-1)||(ii===al.length-1&&jj===0)) return;
      for(var dy=-2;dy<=2;dy++) for(var dx=-2;dx<=2;dx++) setF(ax+dx,ay+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1); }); });
    function format(mask){ var d=(ecl[1]<<3)|mask, r=d; for(var t=0;t<10;t++) r=(r<<1)^((r>>>9)*0x537); var fb=((d<<10)|r)^0x5412, bit=function(n){ return (fb>>>n)&1; };
      for(var q=0;q<=5;q++) setF(8,q,bit(q)); setF(8,7,bit(6)); setF(8,8,bit(7)); setF(7,8,bit(8)); for(q=9;q<15;q++) setF(14-q,8,bit(q));
      for(q=0;q<8;q++) setF(size-1-q,8,bit(q)); for(q=8;q<15;q++) setF(8,size-15+q,bit(q)); setF(8,size-8,1); }
    format(0);
    if(v>=7){ var r=v; for(var t=0;t<12;t++) r=(r<<1)^((r>>>11)*0x1F25); var vb=(v<<12)|r;
      for(i=0;i<18;i++){ var bt=(vb>>>i)&1, a=size-11+i%3, c=Math.floor(i/3); setF(a,c,bt); setF(c,a,bt); } }
    // codewords in the zig-zag order
    var n=0;
    for(var right=size-1;right>=1;right-=2){ if(right===6) right=5;
      for(var vert=0;vert<size;vert++) for(j=0;j<2;j++){ var x=right-j, up=((right+1)&2)===0, y=up?size-1-vert:vert;
        if(!fn[y][x]&&n<cw.length*8){ mod[y][x]=((cw[n>>>3]>>>(7-(n&7)))&1)===1; n++; } } }
    var MASKS=[function(x,y){return (x+y)%2===0;},function(x,y){return y%2===0;},function(x,y){return x%3===0;},function(x,y){return (x+y)%3===0;},
      function(x,y){return (Math.floor(x/3)+Math.floor(y/2))%2===0;},function(x,y){return x*y%2+x*y%3===0;},function(x,y){return (x*y%2+x*y%3)%2===0;},function(x,y){return ((x+y)%2+x*y%3)%2===0;}];
    function applyMask(m){ for(var y=0;y<size;y++) for(var x=0;x<size;x++) if(!fn[y][x]&&MASKS[m](x,y)) mod[y][x]=!mod[y][x]; }
    function penalty(){ var pen=0, dark=0, x, y;
      function lines(get){ for(var a=0;a<size;a++){ var run=1, line=[get(a,0)];
          for(var b=1;b<size;b++){ var c=get(a,b); line.push(c); if(c===line[b-1]){ run++; if(run===5) pen+=3; else if(run>5) pen++; } else run=1; }
          var s=line.map(function(z){ return z?"1":"0"; }).join(""), at=-1;
          while((at=s.indexOf("10111010000",at+1))>=0) pen+=40; at=-1; while((at=s.indexOf("00001011101",at+1))>=0) pen+=40; } }
      lines(function(a,b){ return mod[a][b]; }); lines(function(a,b){ return mod[b][a]; });
      for(y=0;y<size-1;y++) for(x=0;x<size-1;x++){ var c0=mod[y][x]; if(c0===mod[y][x+1]&&c0===mod[y+1][x]&&c0===mod[y+1][x+1]) pen+=3; }
      for(y=0;y<size;y++) for(x=0;x<size;x++) if(mod[y][x]) dark++;
      var total=size*size; pen+=(Math.ceil(Math.abs(dark*20-total*10)/total)-1)*10;
      return pen; }
    var mask=(opt.mask>=0&&opt.mask<8)?opt.mask:-1;
    if(mask<0){ var best=1e9; for(var m=0;m<8;m++){ applyMask(m); format(m); var pn=penalty(); if(pn<best){ best=pn; mask=m; } applyMask(m); } }
    applyMask(mask); format(mask);
    return {size:size, version:v, mask:mask, dark:function(x,y){ return mod[y][x]; }, isFunction:function(x,y){ return fn[y][x]; }};
  }
  function svg(text,opt){
    opt=opt||{}; var q=matrix(text,opt), m=opt.margin==null?4:opt.margin, w=q.size+2*m, d="";
    for(var y=0;y<q.size;y++) for(var x=0;x<q.size;x++) if(q.dark(x,y)) d+="M"+(x+m)+" "+(y+m)+"h1v1h-1z";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+w+'" shape-rendering="crispEdges"'+(opt.cls?' class="'+opt.cls+'"':'')+(opt.id?' id="'+opt.id+'"':'')+' role="img" aria-label="QR code">'+
      '<rect width="'+w+'" height="'+w+'" fill="#fff"/><path d="'+d+'" fill="#000"/></svg>';
  }
  global.QR={matrix:matrix, svg:svg};
})(window);
