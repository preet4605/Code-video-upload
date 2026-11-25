#version 300 es
precision highp float;
uniform vec2 R; uniform int uScene; uniform float uSeed; uniform int uMask; uniform float uZoom;
out vec4 o;

float hash(vec3 p){p=fract(p*0.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);
 return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*noise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=.5;}return s;}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float smax(float a,float b,float k){return -smin(-a,-b,k);}
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,s,-s,c);}
float sdEllip(vec3 p,vec3 r){float k0=length(p/r),k1=length(p/(r*r));return k0*(k0-1.)/k1;}
float sdCap(vec3 p,vec3 a,vec3 b,float r){vec3 pa=p-a,ba=b-a;float h=clamp(dot(pa,ba)/dot(ba,ba),0.,1.);return length(pa-ba*h)-r;}

// ---------- unit head (local space, ~1.9 tall) ----------
float eggRaw(vec3 q){float sx=.80+.07*q.y;return (length(vec3(q.x/sx,q.y/.95,q.z/1.05))-1.)*.75;}
float crescent(vec2 xy){float dL=length(xy-vec2(0.,.08))-.72;float dU=length(xy-vec2(0.,.38))-.72;return max(dL,-dU);}
float cavity(vec3 q,float egg){return max(max(crescent(q.xy),-(egg+.12)),-q.z);}
vec3 eyeC(float s){return vec3(s*.36,.30,.78);}
vec3 eyeLocal(vec3 q,float s,vec3 c){vec3 l=q-c;l.xy=rot(-s*.5)*l.xy;return l;}
float teethUp(vec3 q,float egg){
  vec2 rel=q.xy-vec2(0.,.38);float r=length(rel);float ang=atan(rel.x,-rel.y);
  if(abs(ang)>1.2) return 1.;
  float cw=2.4/13.;float id=floor((ang+1.2)/cw);float ca=(id+.5)*cw-1.2;
  float b=(ang-ca)*r;float a=r-.72;
  float len=(.17+.07*hash(vec3(id,3.,7.)))*(1.-.55*pow(abs(ca)/1.3,2.));
  float t2=max(abs(b)-.052*(1.-a/len),max(-a-.02,a-len));
  float slab=max(egg-.01,-(egg+.17));
  return max(t2,slab)*.7;
}
float teethLo(vec3 q,float egg){
  vec2 rel=q.xy-vec2(0.,.08);float r=length(rel);float ang=atan(rel.x,-rel.y);
  if(abs(ang)>.95) return 1.;
  float cw=1.9/9.;float id=floor((ang+.95)/cw);float ca=(id+.5)*cw-.95;
  float b=(ang-ca)*r;float a=.72-r;
  float len=(.09+.05*hash(vec3(id,9.,2.)))*(1.-.5*pow(abs(ca)/1.1,2.));
  float t2=max(abs(b)-.045*(1.-a/len),max(-a-.02,a-len));
  float slab=max(egg-.01,-(egg+.17));
  return max(t2,slab)*.7;
}
// returns (dist, material) 1 skin 2 eye 3 beak 5 teeth
vec2 headMap(vec3 q){
  float egg=eggRaw(q);
  float d=smax(egg,-cavity(q,egg),.03);
  for(int i=0;i<2;i++){float s=i==0?-1.:1.;
    vec3 c=vec3(s*.36,.31,.84);vec3 l=q-c;l.xy=rot(-s*.5)*l.xy;
    d=smax(d,-sdEllip(l,vec3(.25,.115,.2)),.07);}
  vec2 res=vec2(d,1.);
  float beak=sdEllip(q-vec3(0.,-.03,.93),vec3(.085,.17,.11));
  float db=smin(res.x,beak,.04); if(beak<res.x) res=vec2(db,3.); else res.x=db;
  for(int i=0;i<2;i++){float s=i==0?-1.:1.;
    vec3 l=eyeLocal(q,s,eyeC(s));float de=sdEllip(l,vec3(.175,.075,.115));
    if(de<res.x) res=vec2(de,2.);}
  float tu=teethUp(q,egg); if(tu<res.x) res=vec2(tu,5.);
  float tl=teethLo(q,egg); if(tl<res.x) res=vec2(tl,5.);
  return res;
}
mat3 headRotM;
vec3 H0; float HS;
vec2 map(vec3 p){
  if(uScene==2){ return headMap(headRotM*p); }
  vec3 q=headRotM*((p-H0)/HS);
  vec2 hm=headMap(q); hm.x*=HS;
  float body=sdEllip(p-vec3(0.,-.3,0.),vec3(.82,1.25,.66));
  float d=smin(hm.x,body,.22); vec2 r=vec2(d,hm.x<body?hm.y:1.);
  for(int i=0;i<2;i++){float s=i==0?-1.:1.;
    float fl=sdCap(p,vec3(s*.62,.7,.0),vec3(s*1.0,-.7,.12),.09)*.9;
    float ft=sdEllip(p-vec3(s*.34,-1.5,.4),vec3(.3,.08,.4));
    float dd=smin(r.x,fl,.12); r.x=smin(dd,ft,.05);}
  float fl=p.y+1.56; if(fl<r.x) r=vec2(fl,6.);
  return r;
}
vec3 normalAt(vec3 p){const vec2 e=vec2(1.,-1.)*.0012;
  return normalize(e.xyy*map(p+e.xyy).x+e.yyx*map(p+e.yyx).x+e.yxy*map(p+e.yxy).x+e.xxx*map(p+e.xxx).x);}
float hitT(vec3 ro,vec3 rd,float tmax,out float mat){
  float t=.5;mat=0.;
  for(int i=0;i<140;i++){vec3 p=ro+rd*t;vec2 h=map(p);
    if(h.x<.0009*t){mat=h.y;return t;}
    t+=h.x*.75; if(t>tmax) break;}
  return -1.;
}
// lights
vec3 LE0,LE1,LM,LB; 
vec3 lightsFog(vec3 p){
  vec3 c=vec3(0.);
  vec3 d;float q;
  d=LE0-p;q=dot(d,d);c+=vec3(1.,.07,.03)*1.1/(q+.06);
  d=LE1-p;q=dot(d,d);c+=vec3(1.,.07,.03)*1.1/(q+.06);
  d=LM-p;q=dot(d,d);c+=vec3(.9,.03,.02)*.9/(q+.1);
  d=LB-p;q=dot(d,d);c+=vec3(1.,.14,.05)*(uScene==2?4.:12.)/(q+1.6);
  return c;
}
vec3 shade(vec3 p,vec3 n,vec3 v,float mat,vec3 q,float t){
  vec3 alb=vec3(.012,.011,.014);float rough=.32;float spec=1.;
  vec3 emis=vec3(0.);
  if(mat==3.){alb=vec3(.20,.035,.012);rough=.45;}
  if(mat==5.){alb=vec3(.72,.64,.5);rough=.22;}
  if(mat==6.){alb=vec3(.006,.006,.008);rough=.12;}
  // bump
  vec3 bp=p*14.;vec3 g=vec3(noise(bp+11.),noise(bp+23.),noise(bp+37.))-.5;
  n=normalize(n+g*(mat==6.?.02:.05));
  if(mat==1.){ // mouth interior glow
    float egg=eggRaw(headRotM*(uScene==2?p:(p-H0)/HS)); 
  }
  float eg=0.;
  if(mat==2.){
    float s=(q.x<0.)?-1.:1.;vec3 l=eyeLocal(q,s,eyeC(s));
    float rr=length(l.xy/vec2(.175,.075));
    float slit=mix(1.,smoothstep(.012,.032,abs(l.x)),smoothstep(.9,.5,abs(l.y)/.075*.9+.0));
    vec3 e=mix(vec3(1.,.03,.012)*3.6,vec3(1.,.6,.42)*8.,smoothstep(.5,.08,rr));
    emis=e*slit; alb=vec3(0.);spec=0.;
  }
  vec3 col=vec3(.0035,.005,.009)*(.5+.5*n.y);
  // point lights
  vec3 LP[4];vec3 LC[4];
  LP[0]=LE0;LC[0]=vec3(1.,.07,.03)*(uScene==2?.95:2.4);
  LP[1]=LE1;LC[1]=LC[0];
  LP[2]=LM; LC[2]=vec3(1.,.04,.02)*(uScene==2?.5:1.2);
  LP[3]=LB; LC[3]=vec3(1.,.16,.06)*(uScene==2?12.:140.);
  for(int i=0;i<4;i++){vec3 L=LP[i]-p;float d2=dot(L,L);vec3 l=L*inversesqrt(d2);
    float att=1./d2;float nl=max(dot(n,l),0.);
    vec3 h=normalize(l+v);float sh=mix(60.,12.,rough*2.);
    float F=.04+.96*pow(1.-max(dot(h,v),0.),5.);
    float sp=pow(max(dot(n,h),0.),sh)*(sh+8.)/25.*F;
    col+=LC[i]*att*(alb*nl+sp*spec*(mat==1.?1.:.8));}
  // wrap rim from back light
  float fres=pow(1.-max(dot(n,v),0.),3.5);
  col+=vec3(1.,.10,.04)*fres*(uScene==2?1.2:1.0)*(.35+.65*max(dot(n,normalize(LB-p)),0.));
  // cool fill, faint
  vec3 lf=normalize(vec3(-.3,.9,.6));col+=vec3(.05,.07,.11)*.5*(alb*max(dot(n,lf),0.)+pow(max(dot(n,normalize(lf+v)),0.),50.)*.15*spec);
  // AO
  float ao=0.;float sc=1.;for(int i=1;i<=4;i++){float h=.04*float(i);ao+=(h-map(p+n*h).x)*sc;sc*=.7;}
  col*=(mat==5.)?clamp(1.-ao*1.3,.3,1.):clamp(1.-ao*2.2,.12,1.);
  if(mat==5.) col+=alb*vec3(.95,.5,.38)*.42;
  col+=emis;
  return col;
}
void main(){
  vec2 fc=gl_FragCoord.xy;vec2 uv=(fc*2.-R)/R.y;
  float a=.045,b=.10,px=0.; // slight tilt + turn
  if(uScene==2) px=-.1;
  H0=vec3(0.,1.15,.1);HS=.5;
  if(uScene==2){a=.05;b=.12;} else {a=-.06;b=.16;}
  mat3 rz=mat3(cos(a),sin(a),0.,-sin(a),cos(a),0.,0.,0.,1.);
  mat3 ry=mat3(cos(b),0.,-sin(b),0.,1.,0.,sin(b),0.,cos(b));
  mat3 rx=mat3(1.,0.,0.,0.,cos(px),sin(px),0.,-sin(px),cos(px));
  headRotM=rx*rz*ry;
  vec3 ro,ta;float tf;
  if(uScene==2){ro=vec3(0.,.0,4.35);ta=vec3(0.,.0,0.);tf=1.18/4.4;
    LE0=vec3(-.32,.36,1.08);LE1=vec3(.37,.3,1.12);LM=vec3(0.,-.45,.72);LB=vec3(0.,.2,-2.3);}
  else {ro=vec3(0.,.55,5.0);ta=vec3(0.,.55,0.);tf=1.42/5.0;
    LE0=vec3(-.18,1.30,.56);LE1=vec3(.19,1.28,.58);LM=vec3(0.,.92,.55);LB=vec3(0.,.9,-2.4);}
  tf/=uZoom;
  vec3 ww=normalize(ta-ro),uu=normalize(cross(ww,vec3(0,1,0))),vv=cross(uu,ww);
  vec3 rd=normalize(uu*uv.x*tf+vv*uv.y*tf+ww);
  float mat;float tmax=16.;
  float t=hitT(ro,rd,tmax,mat);
  float tEnd=t>0.?t:tmax;
  // surface
  vec3 surf=vec3(0.);
  if(t>0.){vec3 p=ro+rd*t;vec3 n=normalAt(p);vec3 v=-rd;
    vec3 q=(uScene==2)?headRotM*p:headRotM*((p-H0)/HS);
    // mouth interior flag
    float mm=mat;
    if(mat==1.&&uScene>=1){float egg=eggRaw(q);if(cavity(q,egg)<.02) mm=4.;}
    vec3 c;
    if(mm==4.){vec3 base=vec3(.16,.005,.003);c=shade(p,n,v,1.,q,t)+base*(.35+.8*fbm(q*9.))*(uScene==2?.9:1.3);}
    else c=shade(p,n,v,mm,q,t);
    if(mat==6.){ // wet floor: one reflection
      vec3 rr=reflect(rd,n);float m2;float t2=hitT(p+n*.01,rr,10.,m2);
      float F=.08+.92*pow(1.-max(dot(n,v),0.),5.);
      vec3 rc=vec3(0.);
      if(t2>0.){vec3 p2=p+n*.01+rr*t2;vec3 n2=normalAt(p2);vec3 q2=headRotM*((p2-H0)/HS);
        rc=shade(p2,n2,-rr,m2,q2,t2);}
      else rc=lightsFog(p+rr*3.)*.03;
      c=c*.6+rc*(.25+.75*F)*.8;
      c*=1.-smoothstep(1.2,5.,length(p.xz));
    }
    surf=c;}
  // volumetric fog
  const int NS=44;float t0=.5;float dt=(tEnd-t0)/float(NS);
  float jit=fract(sin(dot(fc,vec2(12.9898,78.233)))*43758.5453);
  vec3 sc=vec3(0.);float T=1.;
  for(int i=0;i<NS;i++){float tt=t0+(float(i)+jit)*dt;vec3 p=ro+rd*tt;
    float dens=(.018+.30*pow(fbm(p*vec3(1.1,1.4,1.1)*1.25+vec3(0.,uSeed*.1,uSeed)),2.2));
    dens*=.55+.45*smoothstep(-1.8,1.4,p.y*(uScene==2?.6:.9)+.2);
    if(uScene==2) dens+=.55*smoothstep(1.2,3.2,p.z)*(.5+fbm(p*2.1+uSeed))*smoothstep(1.0,-.4,p.y)*.55;
    vec3 inL=lightsFog(p)*.017+vec3(.002,.003,.007)*.4;
    sc+=T*inL*dens*dt;T*=exp(-dens*dt*.9);}
  vec3 col=surf*T+sc;
  // tone map (ACES fitted)
  col*=.8;
  col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  o=vec4(col,1.);
  if(uMask==1) o=vec4(vec3(t>0.?1.:0.),1.);
}
