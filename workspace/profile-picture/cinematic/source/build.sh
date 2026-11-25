#!/bin/sh
# needs node + playwright (chromium, SwiftShader WebGL2) and python3 numpy + pillow
node render.mjs 2 1080 r2.png 3 0 1    && node render.mjs 2 1080 m2.png 3 1 1    && python3 post.py r2.png cine-1-face.png 1 m2.png
node render.mjs 2 1080 r3.png 5 0 1.28 && node render.mjs 2 1080 m3.png 5 1 1.28 && python3 post.py r3.png cine-2-face-tight.png 3 m3.png
node render.mjs 1 1080 r1.png 3 0 1    && node render.mjs 1 1080 m1.png 3 1 1    && python3 post.py r1.png cine-3-penguin.png 2 m1.png
