import sys, numpy as np
from PIL import Image
src, dst, seed, maskf = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
rng=np.random.default_rng(seed)
img=np.asarray(Image.open(src).convert('RGB')).astype(np.float32)/255.
H,W,_=img.shape
lin=img**2.2
def blur(a,sigma):
    # FFT gaussian blur (wraps; fine with dark borders)
    fy=np.fft.fftfreq(H)[:,None]; fx=np.fft.fftfreq(W)[None,:]
    g=np.exp(-2*(np.pi**2)*(sigma**2)*(fx**2+fy**2))
    return np.stack([np.fft.ifft2(np.fft.fft2(a[...,c])*g).real for c in range(a.shape[2])],-1)
def blurx(a,sigma):
    fx=np.fft.fftfreq(W)[None,:]
    g=np.exp(-2*(np.pi**2)*(sigma**2)*(fx**2))
    return np.stack([np.fft.ifft2(np.fft.fft2(a[...,c])*g).real for c in range(a.shape[2])],-1)
lum=(lin*np.array([.3,.6,.1])).sum(-1,keepdims=True)
hi=lin*np.clip((lum-.12)/.5,0,1)          # highlights only
hi2=lin*np.clip((lum-.45)/.4,0,1)
s=W/1080.
bloom=blur(hi,6*s)*.55+blur(hi,18*s)*.6+blur(hi,50*s)*.7
streak=blurx(hi2*np.array([1.,.3,.2]),70*s)*.7   # anamorphic streak
out=lin+bloom+streak
# depth-of-field bokeh in the haze (soft red discs, additive, away from subject)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
bok=np.zeros((H,W,3),np.float32)
for _ in range(9):
    cx,cy=rng.uniform(.05,.95)*W,rng.uniform(.05,.95)*H
    r=rng.uniform(26,62)*s
    d=np.hypot(xx-cx,yy-cy)
    disc=np.clip((r-d)/(3*s),0,1)*(.55+.45*np.clip(d/r,0,1))   # brighter rim like real bokeh
    bok+=disc[...,None]*np.array([1.,.12,.05])*rng.uniform(.012,.03)
subj=np.asarray(Image.open(maskf).convert('L')).astype(np.float32)/255.
subj=blur(subj[...,None],3*s)[...,0]
mask=np.clip(1-subj*1.2,0,1)[...,None]*np.clip(1-lum*8,0,1)
out+=blur(bok,2.5*s)*mask
# chromatic aberration: radial channel scale
def scale_ch(c,k):
    ys=(yy-H/2)/k+H/2; xs=(xx-W/2)/k+W/2
    ys=np.clip(ys,0,H-1).astype(np.float32); xs=np.clip(xs,0,W-1).astype(np.float32)
    y0=ys.astype(int); x0=xs.astype(int); y1=np.minimum(y0+1,H-1); x1=np.minimum(x0+1,W-1)
    fy=ys-y0; fx=xs-x0
    return (c[y0,x0]*(1-fy)*(1-fx)+c[y0,x1]*(1-fy)*fx+c[y1,x0]*fy*(1-fx)+c[y1,x1]*fy*fx)
out[...,0]=scale_ch(out[...,0],1.006); out[...,2]=scale_ch(out[...,2],.994)
# grade: cool, lifted-but-deep shadows, crush
out=out+np.array([.0025,.004,.008])
out=out/(1+out*.35)*1.15
# vignette
r=np.hypot((xx-W/2)/(W/2),(yy-H/2)/(H/2))
out*=(1-.8*np.clip((r-.45)/.75,0,1)**1.8)[...,None]
# film grain (luma-weighted, slight colour)
o=np.clip(out,0,1)**(1/2.2)
g=rng.normal(0,1,(H,W,1)).astype(np.float32)
g=blur(g,.6*s)*1.6
gc=rng.normal(0,1,(H,W,3)).astype(np.float32)*.35
lum2=o.mean(-1,keepdims=True)
o=o+ (g+gc*.4)*(.018+.016*(1-np.abs(lum2-.4)))
Image.fromarray((np.clip(o,0,1)*255+.5).astype(np.uint8)).save(dst)
