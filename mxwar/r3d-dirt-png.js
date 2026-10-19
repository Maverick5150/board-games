/* MOTOCROSS WAR 3D — the DIRT's tiny PNG reader (owner: dirt). The soil scans (assets/dirt/dirt-tiles.js, base64 of a PNG) must be on the GPU the
   moment the track is built (a world is built in one synchronous call, the capture harness draws a frame the same task), and a browser can only
   decode an image asynchronously: so the bytes are inflated here, in plain JS (puff-style canonical Huffman, about 25 ms for 1 MB).
   decodePNG(base64 | Uint8Array) -> {w, h, data: Uint8Array RGBA (8 bit, straight alpha: nothing is premultiplied)} for 8-bit RGBA / RGB / grey PNGs. */
const LBASE=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
const LEXT=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
const DBASE=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
const DEXT=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
const CLORD=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

function huff(lengths,n){
  const count=new Uint16Array(16), symbol=new Uint16Array(n), offs=new Uint16Array(17);
  for(let i=0;i<n;i++) count[lengths[i]]++;
  for(let l=1;l<16;l++) offs[l+1]=offs[l]+count[l];
  for(let i=0;i<n;i++) if(lengths[i]) symbol[offs[lengths[i]]++]=i;
  return {count,symbol};
}
let FIXL=null, FIXD=null;
function inflate(src,pos,out){
  let bitBuf=0, bitCnt=0, o=0;
  const bit=()=>{ if(!bitCnt){ bitBuf=src[pos++]; bitCnt=8; } const b=bitBuf&1; bitBuf>>=1; bitCnt--; return b; };
  const bits=n=>{ let v=0; for(let i=0;i<n;i++) v|=bit()<<i; return v; };
  const decode=h=>{ let code=0, first=0, index=0;
    for(let len=1;len<16;len++){ code|=bit(); const c=h.count[len]; if(code-c<first) return h.symbol[index+(code-first)]; index+=c; first+=c; first<<=1; code<<=1; }
    throw new Error("png: bad code"); };
  let last;
  do{
    last=bit(); const type=bits(2);
    if(type===0){ bitCnt=0; const len=src[pos]|(src[pos+1]<<8); pos+=4; out.set(src.subarray(pos,pos+len),o); o+=len; pos+=len; continue; }
    let L, D;
    if(type===1){
      if(!FIXL){ const l=new Uint8Array(288); for(let i=0;i<144;i++) l[i]=8; for(let i=144;i<256;i++) l[i]=9; for(let i=256;i<280;i++) l[i]=7; for(let i=280;i<288;i++) l[i]=8; FIXL=huff(l,288); const d=new Uint8Array(30).fill(5); FIXD=huff(d,30); }
      L=FIXL; D=FIXD;
    } else if(type===2){
      const nlen=bits(5)+257, ndist=bits(5)+1, ncode=bits(4)+4, lengths=new Uint8Array(320);
      for(let i=0;i<ncode;i++) lengths[CLORD[i]]=bits(3);
      const lc=huff(lengths.subarray(0,19),19); let idx=0; lengths.fill(0);
      while(idx<nlen+ndist){
        const sym=decode(lc);
        if(sym<16) lengths[idx++]=sym;
        else { let prev=0, rep; if(sym===16){ prev=lengths[idx-1]; rep=3+bits(2); } else if(sym===17) rep=3+bits(3); else rep=11+bits(7); while(rep--) lengths[idx++]=prev; }
      }
      L=huff(lengths.subarray(0,nlen),nlen); D=huff(lengths.subarray(nlen,nlen+ndist),ndist);
    } else throw new Error("png: bad block");
    for(;;){
      const sym=decode(L);
      if(sym<256) out[o++]=sym;
      else if(sym===256) break;
      else { const s=sym-257, len=LBASE[s]+bits(LEXT[s]), ds=decode(D), dist=DBASE[ds]+bits(DEXT[ds]); for(let i=0;i<len;i++){ out[o]=out[o-dist]; o++; } }
    }
  } while(!last);
  return o;
}
export function decodePNG(input){
  let b=input;
  if(typeof input==="string"){ const s=(typeof window!=="undefined"?window:globalThis).atob(input); b=new Uint8Array(s.length); for(let i=0;i<s.length;i++) b[i]=s.charCodeAt(i); }
  const dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
  let p=8, w=0, h=0, depth=8, ctype=6; const idat=[]; let total=0;
  while(p<b.length){
    const len=dv.getUint32(p), type=String.fromCharCode(b[p+4],b[p+5],b[p+6],b[p+7]); p+=8;
    if(type==="IHDR"){ w=dv.getUint32(p); h=dv.getUint32(p+4); depth=b[p+8]; ctype=b[p+9]; }
    else if(type==="IDAT"){ idat.push(b.subarray(p,p+len)); total+=len; }
    p+=len+4; if(type==="IEND") break;
  }
  if(depth!==8||(ctype!==6&&ctype!==2&&ctype!==0)) throw new Error("png: only 8-bit grey / RGB / RGBA");
  const z=new Uint8Array(total); let q=0; idat.forEach(c=>{ z.set(c,q); q+=c.length; });
  const ch=ctype===6?4:ctype===2?3:1, stride=w*ch, raw=new Uint8Array((stride+1)*h);
  inflate(z,2,raw);
  const px=new Uint8Array(stride*h);
  for(let y=0;y<h;y++){
    const f=raw[y*(stride+1)], r0=y*(stride+1)+1, d0=y*stride, u0=d0-stride;
    for(let x=0;x<stride;x++){
      const v=raw[r0+x], a=x>=ch?px[d0+x-ch]:0, up=y?px[u0+x]:0, c=(x>=ch&&y)?px[u0+x-ch]:0; let r;
      if(f===0) r=v; else if(f===1) r=v+a; else if(f===2) r=v+up; else if(f===3) r=v+((a+up)>>1);
      else { const pp=a+up-c, pa=Math.abs(pp-a), pb=Math.abs(pp-up), pc=Math.abs(pp-c); r=v+((pa<=pb&&pa<=pc)?a:(pb<=pc?up:c)); }
      px[d0+x]=r&255;
    }
  }
  if(ch===4) return {w,h,data:px};
  const rgba=new Uint8Array(w*h*4);
  for(let i=0;i<w*h;i++){ if(ch===3){ rgba[i*4]=px[i*3]; rgba[i*4+1]=px[i*3+1]; rgba[i*4+2]=px[i*3+2]; } else { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=px[i]; } rgba[i*4+3]=255; }
  return {w,h,data:rgba};
}
