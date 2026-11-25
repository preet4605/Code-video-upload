import sys
from PIL import Image
out=sys.argv[1]; fs=sys.argv[2:]
ims=[Image.open(f).convert('RGB') for f in fs]
w,h=ims[0].size; sc=0.62
ims=[i.resize((int(w*sc),int(h*sc))) for i in ims]
W=sum(i.size[0] for i in ims)+6*(len(ims)-1); H=ims[0].size[1]
s=Image.new('RGB',(W,H),(40,40,40)); x=0
for i in ims: s.paste(i,(x,0)); x+=i.size[0]+6
s.save(out)
