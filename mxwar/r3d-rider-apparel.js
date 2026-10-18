/* MOTOCROSS WAR 3D — THE RIDER'S APPAREL (polish step, 2026-10-17): the jersey, sleeves, gloves, pants, boots and helmet PAINTED in the fragment shader.
   The skinned rider (r3d-rider-model.js) has no UV map; its vertices carry the rest-pose position and the PART of the outfit (PART.*). The shader paints the rider from those:
   a jersey with a yoke, side panels, piping, a sweep or a hoop and a hem band; sleeves with a biceps band, an elbow guard and a cuff; pants with a side stripe, leather knee
   panels and a belt; boots with three straps and a dark heel; a helmet with a centre stripe, side swooshes and a dark back vent. The team colour and the accent colour come from
   the rider's instance attributes, the layout from the rider's style bits, so the 22 riders do not look alike. Seams are darker lines, the cloth has mottling and creases
   (a bump from the rest-pose position through screen derivatives: no texture, no UV, no memory), and the mud (st.mud + a dusting) is a noise threshold, so it reads as splatter
   that climbs the boots, the pants and the lower back. Nothing is a brand: plain colours, no lettering.
   Two levels: apparel 2 (hi riders on the physically based tiers: noise, creases, mud splatter) and apparel 1 (the thin pack and the FIRE TV tier: flat panels, seams, a plain mud tint).
   applyApparel(sh, level, kind): patches a three.js shader (kind "cloth" = jersey / sleeves / gloves / pants / boots, "shell" = the helmet); sh.vertexShader / sh.fragmentShader are rewritten. */

/* what the vertex shader hands the fragment shader */
export const AP_VERT_DECL=`
#ifdef MX_APPAREL
varying vec3 vApP; varying vec4 vApI; varying vec3 vApT; varying vec4 vApA;
#endif
`;
export const AP_VERT_SET=`
#ifdef MX_APPAREL
 vApP=position; vApI=vec4(aFx.w,aInstC.x,aInstC.y,aInstA.x); vApT=aInstA.yzw; vApA=aInstB;
#endif
`;

const AP_FS_DECL=`
#ifdef MX_APPAREL
varying vec3 vApP; varying vec4 vApI; varying vec3 vApT; varying vec4 vApA; uniform float uTime;
float apH(vec3 p){ uvec3 q=uvec3(ivec3(p)+ivec3(32768)); uint h=(q.x*1597334677u)^(q.y*3812015801u)^(q.z*2798796415u); h^=h>>15; h*=2246822519u; h^=h>>13; h*=3266489917u; h^=h>>16; return float(h&16777215u)*5.9604645e-8; }   /* (an INTEGER hash: bit-exact whatever the compiler does with float multiply-adds) */
float apN(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(apH(i),apH(i+vec3(1,0,0)),f.x),mix(apH(i+vec3(0,1,0)),apH(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(apH(i+vec3(0,0,1)),apH(i+vec3(1,0,1)),f.x),mix(apH(i+vec3(0,1,1)),apH(i+vec3(1,1,1)),f.x),f.y),f.z); }
/* a thin line at d = 0 (w = its half width), and a band a..b (s = the soft edge: at least a pixel, so nothing crawls) */
float apLine(float d,float w,float fw){ return 1.0-smoothstep(w-fw,w+fw,abs(d)); }
float apBand(float d,float a,float b,float fw){ return smoothstep(a-fw,a+fw,d)*(1.0-smoothstep(b-fw,b+fw,d)); }
vec3 apDark(vec3 T){ return T*0.06+vec3(0.007); }

/* the jersey (rest pose: x forward, y up 0 = the hips .. 0.55 = the shoulders, z to the rider's right) */
vec3 apJersey(vec3 p,vec3 T,vec3 A,int sty,float fw){
  float x=p.x, y=p.y, az=abs(p.z); vec3 D=apDark(T), W=vec3(0.62), c=T;
  bool s0=(sty&1)!=0, s1=(sty&2)!=0, s2=(sty&4)!=0;
  float side=smoothstep(0.125-fw,0.125+fw,az)*(1.0-smoothstep(0.40-fw,0.40+fw,y));
  c=mix(c,s1?D:T*0.58,side);                                                     /* the side panels */
  c=mix(c,s1?A:D,apLine(az-0.125,0.0045,fw)*step(0.09,y)*(1.0-step(0.40,y))*0.95); /* piping along their seam */
  float sw=y-0.9*az;
  float band=s0?apBand(sw,0.020,0.072,fw):apBand(y,0.118,0.152,fw);               /* a sweep (rises to the sides) or a hoop */
  c=mix(c,A,band*(1.0-side*0.55));
  c=mix(c,W,(s0?apBand(sw,0.080,0.090,fw):apBand(y,0.160,0.168,fw))*0.85);
  c=mix(c,D,1.0-smoothstep(0.075-fw,0.075+fw,y));                                /* the hem band */
  c=mix(c,A,apLine(y-0.083,0.0042,fw)*0.85);
  c=mix(c,mix(T,D,0.9),smoothstep(0.43-fw,0.43+fw,y));                           /* the yoke */
  c=mix(c,A,apLine(y-0.43,0.0045,fw)*0.9);
  c=mix(c,A,step(0.0,x)*apBand(y,0.29,0.35,fw)*(1.0-side)*(s2?1.0:0.0));         /* the chest band (front) */
  return c;
}
vec3 apSleeve(vec3 p,vec3 T,vec3 A,int sty,float fw){
  float y=p.y, lat=abs(p.z)-0.215; vec3 D=apDark(T), W=vec3(0.62), c=T;
  c=mix(c,mix(T,D,0.9),smoothstep(0.43-fw,0.43+fw,y));                           /* the shoulder cap */
  c=mix(c,A,apBand(y,0.335,0.395,fw)); c=mix(c,W,apBand(y,0.322,0.332,fw)*0.85); /* the biceps band */
  c=mix(c,T*0.40,apBand(y,0.13,0.25,0.02)*(1.0-smoothstep(-0.02,0.012,p.x))*0.85);    /* the elbow guard (the back of the elbow) */
  c=mix(c,D,apLine(lat-0.028,0.010,fw)*step(0.04,y)*(1.0-step(0.32,y))*0.9);     /* a dark stripe down the outside */
  c=mix(c,A,1.0-smoothstep(0.035-fw,0.035+fw,y));                                /* the cuff */
  return c;
}
vec3 apGlove(vec3 p,vec3 T,vec3 A,float fw){
  /* (milestone 2: the hand wraps the grip; rest frame: the wrist at y -0.06, the knuckles at -0.128 over the bar, the bar along z at y -0.145) */
  float y=p.y, x=p.x; vec3 c=vec3(0.026)+T*0.05;                                               /* the palm and the fingers: dark synthetic leather */
  c=mix(c,T*0.80+vec3(0.012),smoothstep(0.004,0.013,x)*step(-0.127,y)*step(y,-0.066));          /* the back of the hand in the team colour */
  c=mix(c,vec3(0.014),apBand(y,-0.126,-0.111,fw)*smoothstep(0.008,0.016,x)*0.9);                /* the knuckle pad */
  if(y<-0.124){ vec2 r=vec2(x,y+0.145); float top=smoothstep(0.25,0.75,r.x/max(length(r),1e-4)); c=mix(c,T*0.55+vec3(0.01),top*0.55); }   /* a team-colour panel on the top of the fingers */
  c=mix(c,A*0.85,smoothstep(-0.071-fw,-0.071+fw,y));                                           /* the cuff */
  return c;
}
vec3 apPants(vec3 p,vec3 T,vec3 A,int sty,float fw){
  float x=p.x, y=p.y, az=abs(p.z); float lat=(az-0.095)/0.10; vec3 D=apDark(T), W=vec3(0.62);
  vec3 c=(sty&4)!=0?mix(D,A,0.50):mix(D,T,0.66);
  float leg=step(y,0.02)*step(-0.50,y);
  c=mix(c,A,apBand(lat,0.50,0.92,0.05)*leg);                                     /* the outer stripe */
  c=mix(c,W,apLine(lat-0.40,0.026,0.03)*leg*0.8);
  float kp=apBand(y,-0.545,-0.330,fw)*smoothstep(-0.005,0.03,x);
  c=mix(c,vec3(0.018)+T*0.03,kp*0.92);                                           /* the knee panel (leather) */
  c=mix(c,A,(apLine(y+0.330,0.0045,fw)+apLine(y+0.545,0.0045,fw))*kp*0.7);
  c=mix(c,D*0.7,smoothstep(-0.015-fw,-0.015+fw,y));                              /* the belt / waist */
  c=mix(c,vec3(0.02),(1.0-smoothstep(-0.60,-0.50,y))*0.5);                             /* the shins go into the boots */
  return c;
}
vec3 apBoot(vec3 p,vec3 vc,vec3 T,vec3 A,int sty,float fw){
  /* (milestone 2: the boots were a big white tube) black or white boots by the rider's style, a shin plate in front, a team band under the padded collar, a dark heel */
  float x=p.x, y=p.y; bool blk=(sty&2)!=0;
  vec3 base=blk?vec3(0.030,0.031,0.036):vec3(0.42,0.43,0.45), plate=blk?vec3(0.20,0.21,0.23):vec3(0.60,0.61,0.63);
  vec3 c=mix(base,plate,smoothstep(0.034,0.054,x)*step(-0.905,y)*step(y,-0.588));               /* the shin plate */
  c=mix(c,T*0.75,apBand(y,-0.604,-0.588,fw)*0.9);                                                /* a team band under the collar */
  c=mix(c,vec3(0.022),step(-0.584,y));                                                           /* the padded collar */
  c=mix(c,vec3(0.030),step(y,-0.900)*(1.0-smoothstep(0.0,0.05,x))*0.9);                         /* the heel counter */
  c=mix(c,c*0.55,apLine(y+0.588,0.0016,fw)*smoothstep(0.03,0.05,x));                             /* the plate's edge */
  float vk=max(max(vc.r,vc.g),vc.b); return mix(vc,c,smoothstep(0.05,0.20,vk));                  /* the modelled sole and the dark toe stay */
}
vec3 apHelmet(vec3 p,vec3 T,vec3 A,int sty,float fw,vec3 vc,float part){
  /* (milestone 2: the real motocross helmet: the shell, the chin bar (10), the visor (7), the goggles' frame (11), the lens (9), the strap (8)) */
  float dk=1.0-smoothstep(0.02,0.09,max(max(vc.r,vc.g),vc.b));                   /* the modelled dark parts (vents, the visor's underside, the lip) stay */
  vec3 D=apDark(T), W=vec3(0.66);
  if(part>8.5&&part<9.5){ float g=clamp((p.y-0.712)/0.075,0.0,1.0);               /* the lens: a dark mirror with an iridium tint (the clear coat does the shine) */
    return mix(vec3(0.050,0.020,0.004),vec3(0.004,0.018,0.050),g)*0.85+vec3(0.006); }
  if(part>7.5&&part<8.5){ float ang=atan(p.z,p.x-0.02);                             /* the strap: the accent colour, dark blocks, two thin white edges */
    vec3 c=A*0.80; c=mix(c,D,step(0.62,fract(ang*2.2))*0.85);
    c=mix(c,W,(apLine(p.y-0.7335,0.0014,fw)+apLine(p.y-0.7685,0.0014,fw))*0.75); return c; }
  if(part>10.5) return mix(A*0.70+vec3(0.006),vc,dk);                              /* the goggles' frame */
  vec3 d=normalize(p-vec3(0.020,0.742,0.0)); float az=abs(d.z); vec3 c=T;
  if(part>9.5&&part<10.5){ c=mix(T,A,1.0-smoothstep(0.618,0.630,p.y));            /* the chin bar: its lower edge in the accent colour, the vent stays dark */
    c=mix(c,W,apLine(p.y-0.6305,0.0015,fw)*0.8); return mix(c,vc,dk); }
  if(part>6.5&&part<7.5){ c=mix(T,A,smoothstep(0.252,0.268,p.x+0.17*p.z*p.z/0.0142));  /* the visor: an accent edge round its tip */
    c=mix(c,W,apLine(p.x+0.17*p.z*p.z/0.0142-0.250,0.0016,fw)*0.8); return mix(c,vc,dk); }
  float top=smoothstep(0.10,0.14,d.y)*(1.0-smoothstep(0.14,0.18,az));            /* the centre stripe */
  c=mix(c,A,top); c=mix(c,W,apBand(az,0.165,0.195,fw*2.0)*smoothstep(0.08,0.14,d.y)*0.9);
  float sw=d.y*0.85-d.x*0.55;                                                    /* a swoosh each side */
  float swm=smoothstep(0.45,0.52,az)*apBand(sw,-0.10,0.16,0.03);
  c=mix(c,(sty&2)!=0?A:D,swm); c=mix(c,W,smoothstep(0.45,0.52,az)*apBand(sw,0.17,0.20,0.015)*0.9);
  c=mix(c,D,(1.0-smoothstep(-0.62,-0.40,d.x))*smoothstep(0.05,0.25,d.y)*0.9);           /* the dark back vent */
  c=mix(c,D*1.5,(1.0-smoothstep(-0.52,-0.28,d.y))*0.8);                                /* the lower shell */
  c=mix(c,vec3(0.018),apBand(d.x,0.40,0.62,0.03)*apBand(d.y,0.60,0.74,0.02)*apBand(az,0.05,0.15,0.012)*0.92);   /* two intakes on the crown behind the visor */
  return mix(c,vc,dk);
}
#endif
`;

/* the main painting: runs right after color_fragment and replaces diffuseColor.rgb; level 2 adds the noise mottling and the mud splatter */
const AP_FS_COLOR=`
#ifdef MX_APPAREL
{
  vec3 P=vApP, T=vApT; vec4 A=vApA; vec3 vc=diffuseColor.rgb; float part=vApI.x, mud=vApI.y; int sty=int(vApI.z+0.5);
  float fw=clamp(fwidth(P.y)*1.2,0.0012,0.02);
  vec3 c=vc;
  #ifdef MX_APPAREL_HELMET
   c=apHelmet(P,T,A.xyz,sty,fw,vc,part);
  #else
   if(part<0.5) c=apJersey(P,T,A.xyz,sty,fw);
   else if(part<1.5) c=apSleeve(P,T,A.xyz,sty,fw);
   else if(part<2.5) c=apGlove(P,T,A.xyz,fw);
   else if(part<3.5) c=apPants(P,T,A.xyz,sty,fw);
   else if(part<4.5) c=apBoot(P,vc,T,A.xyz,sty,fw);
  #endif
  #ifdef MX_APPAREL_HI
   float nz=0.6*apN(P*vec3(26.0,34.0,26.0)+vApI.w*1.7)+0.4*apN(P*82.0+3.1);
   c*=0.90+0.20*nz;                                                              /* the cloth's mottling */
   float wgt=1.0;
   #ifdef MX_APPAREL_HELMET
    wgt=(part>7.5&&part<9.5)?0.07:((part>9.5&&part<10.5)||(part>6.5&&part<7.5))?0.34:0.20;   /* (the chin bar and the visor catch the roost; the lens and the strap stay clean-ish) */
   #else
    if(part<0.5) wgt=(1.0-smoothstep(0.04,0.30,P.y))*mix(0.25,0.75,step(P.x,0.0));
    else if(part<1.5) wgt=(1.0-smoothstep(-0.05,0.22,P.y))*0.45;
    else if(part<2.5) wgt=0.8;
    else if(part<3.5) wgt=(1.0-smoothstep(-0.55,-0.05,P.y))*0.85+0.05;
    else if(part<4.5) wgt=0.95;
    else wgt=0.3;
   #endif
   float md=clamp(mud*0.8+0.10,0.0,0.9)*wgt;
   float nz2=0.65*apN(P*vec3(15.0,19.0,15.0)+vApI.w*3.1)+0.35*nz;                /* big splatters and small ones */
   float thr=1.0-md*0.85;
   float mk=smoothstep(thr-0.10,thr+0.10,nz2)*step(0.01,md);
   c=mix(c,mix(vec3(0.085,0.048,0.024),vec3(0.20,0.13,0.07),smoothstep(0.3,0.9,nz)),mk*0.88);
   /* milestone 2: STREAKS of thrown dirt (long drips down the shins, the front of the pants, the chest and the chin bar), growing with st.mud */
   float sk=apN(P*vec3(70.0,8.0,70.0)+vApI.w*5.3)*0.75+0.25*nz;
   float sw2=wgt*clamp(mud*1.25,0.0,1.0)*smoothstep(-0.01,0.03,P.x);
   c=mix(c,vec3(0.105,0.064,0.033),smoothstep(0.66,0.80,sk)*sw2*0.85);
  #else
   float md=clamp(mud+0.08,0.0,1.0);
   #ifndef MX_APPAREL_HELMET
    float lowK=(part>3.5&&part<4.5)?1.0:(part>2.5&&part<3.5)?(1.0-smoothstep(-0.55,-0.05,P.y)):0.0;
    c=mix(c,vec3(0.11,0.065,0.032),clamp(md*lowK*1.2,0.0,0.9));
   #endif
  #endif
  diffuseColor.rgb=c;
}
#endif
`;

/* creases: a bump of the normal from a smooth height in the rest pose (the screen derivatives do the rest); jersey, sleeves and pants only */
const AP_FS_BUMP=`
#if defined(MX_APPAREL) && defined(MX_APPAREL_HI) && !defined(MX_APPAREL_HELMET)
{
  vec3 q=vApP; float part=vApI.x;
  /* milestone 2: the folds MOVE with the wind of speed (vApA.w: 0 standing .. 1 at 16 m/s): a ripple runs back over the loose jersey and the sleeves */
  float wnd=clamp(vApA.w,0.0,1.0), loose=(part<0.5?(1.0-smoothstep(0.05,0.30,q.y)):(part<1.5?0.7:0.25)), tph=uTime*(2.0+9.0*wnd)*loose*wnd;
  float f1=sin(dot(q,vec3(9.0,33.0,13.0))+2.4*sin(dot(q,vec3(21.0,7.0,27.0))+vApI.w)+tph);
  float f2=sin(dot(q,vec3(37.0,15.0,-23.0))+1.7+vApI.w*0.6-tph*1.3);
  float cloth=(part<1.5||(part>2.5&&part<3.5))?1.0:0.0;
  float amp=0.0052*cloth*(part<0.5?(1.0+1.2*(1.0-smoothstep(0.0,0.22,q.y))):1.0)*(1.0+0.45*wnd*loose);
  float h=amp*(0.62*f1+0.38*f2);
  vec3 sp=-vViewPosition; vec3 dX=dFdx(sp), dY=dFdy(sp); vec3 R1=cross(dY,normal), R2=cross(normal,dX);
  float det=dot(dX,R1)*faceDirection; vec3 grad=sign(det)*(dFdx(h)*R1+dFdy(h)*R2);
  vec3 nb=abs(det)*normal-grad; float nl=length(nb); if(nl>1e-12) normal=nb/nl;   /* (never normalize a zero vector: a grazing pixel gave NaN) */
}
#endif
`;

/* patch a skin material's shader for the apparel: level 1 flat panels, 2 + noise / creases / mud (kind "shell" = the helmet) */
export function applyApparel(sh,level,kind){
  const hi=level>=2, helmet=kind==="shell", defs="#define MX_APPAREL\n"+(hi?"#define MX_APPAREL_HI\n":"")+(helmet?"#define MX_APPAREL_HELMET\n":"");
  sh.vertexShader=defs+sh.vertexShader;
  let fs=defs+sh.fragmentShader;
  fs=fs.replace("#include <common>","#include <common>\n"+AP_FS_DECL);
  fs=fs.replace("#include <color_fragment>","#include <color_fragment>\n"+AP_FS_COLOR);
  fs=fs.replace("#include <normal_fragment_maps>","#include <normal_fragment_maps>\n"+AP_FS_BUMP);
  sh.fragmentShader=fs;
}
