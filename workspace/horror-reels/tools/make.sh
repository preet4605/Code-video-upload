#!/bin/bash
# usage: tools/make.sh reel-NN  -> full render + master + print verdict
set -e
cd "$(dirname "$0")/.."
node skill/code-video-studio/scripts/render_and_lint.mjs --project $1 --json 2>&1 | python3 -I -c "import json,sys;d=json.load(sys.stdin);print('render',d['ok'],d['lint']['errors'],d['lint']['warnings'])"
node skill/code-video-studio/scripts/master_and_qa.mjs --project $1 --bgm auto --sfx-auto --preset reel-vocal --audio-mood horror --platform reels --json 2>&1 | python3 -I -c "import json,sys;d=json.load(sys.stdin);print('QA',d['verdict'],d['ship']['fails'],[w for w in d['ship']['warns'] if 'voiced-span' not in w],d['ship']['measured'].get('mix'),d['audio_qa']['integrated_lufs'],round(d['ffprobe']['duration'],1))"
