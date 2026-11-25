#!/bin/bash
# usage: stitch.sh <out.mp4> [--draft]
cd /mnt/project-files/skills/code-video-studio-v6.1
node scripts/render_and_lint.mjs --project /tmp/claude-0/-home-user/6cdc2fd2-ef96-5beb-b1c4-0ea76e656a13/scratchpad/prod2 --skip-story-lint --json $2 > /tmp/claude-0/-home-user/6cdc2fd2-ef96-5beb-b1c4-0ea76e656a13/scratchpad/prod2/render.json 2>&1
cd /tmp/claude-0/-home-user/6cdc2fd2-ef96-5beb-b1c4-0ea76e656a13/scratchpad/prod2
node -e "const j=JSON.parse(require('fs').readFileSync('render.json','utf8'));console.log(j.manifest.map(m=>\"file '\"+m.segmentPath+\"'\").join('\n'))" > concat.txt
ffmpeg -v error -y -f concat -safe 0 -i concat.txt -c copy $1
ffprobe -v error -show_entries format=duration -of csv=p=0 $1
