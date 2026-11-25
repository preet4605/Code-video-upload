#!/bin/bash
# usage: tools/make.sh <project>  -> render + master + print verdict
cd "$(dirname "$0")/.."
S=/mnt/attach/project-files/skills/code-video-studio-v6.2
node $S/scripts/render_and_lint.mjs --project $1 --json > /tmp/rl_full.json 2>/tmp/rl_full.err
python3 -I -c "import json;d=json.load(open('/tmp/rl_full.json'));print('render',d.get('ok'),d['lint']['errors'],d['lint']['warnings'])"
node $S/scripts/master_and_qa.mjs --project $1 --bgm $PWD/$1/sound_bed.wav --bgm-gain -9 --preset reel-vocal --audio-mood horror --platform reels --json > /tmp/qa.json 2>/tmp/qa.err
python3 -I - <<'PY'
import json
d=json.load(open('/tmp/qa.json'))
print(d['verdict']); print('FAILS',json.dumps(d['ship']['fails'],indent=0)); print('WARNS',json.dumps([w for w in d['ship']['warns'] if 'voiced-span' not in w and 'SHIP means' not in w])); print(json.dumps(d['ship']['measured'])[:900])
h=d['ship'].get('horror',{}); print('scares',json.dumps(h.get('measured',{}).get('scares')))
PY
