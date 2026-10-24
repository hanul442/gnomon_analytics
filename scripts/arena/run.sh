#!/usr/bin/env bash
# The model arena, end to end (G-290). Needs .cache/eval from `node dist/cli/evalFetch.js` and `npm run build`.
# Makes one Python 3.11 venv per adapter under .cache/arena-venv (models need clashing library versions), forecasts
# only the rows not already kept in data/arena/preds/, and writes data/eval/arena-<date>.md.
#
#   bash scripts/arena/run.sh [model keys...]     (default: every active model in data/arena/models.json)
set -euo pipefail
cd "$(dirname "$0")/../.."
PY=${ARENA_PYTHON:-python3.11}
THREADS=${ARENA_THREADS:-$(nproc)}
TORCH_INDEX=https://download.pytorch.org/whl/cpu
KRONOS_SHA=67b630e67f6a18c9e9be918d9b4337c960db1e9a

node --max-old-space-size=6000 dist/cli/evalArena.js --stage prep

if [ "$#" -gt 0 ]; then KEYS="$*"; else KEYS=$(node -e "console.log(require('./data/arena/models.json').models.filter(m=>m.status==='active').map(m=>m.key).join(' '))"); fi
adapter() { node -e "const m=require('./data/arena/models.json').models.find(m=>m.key===process.argv[1]);console.log(m.adapter)" "$1"; }
venv() {
  local a=$1 v=.cache/arena-venv/$1 req=scripts/arena/req/$1.txt
  [ "$a" = chronos2 ] && req=scripts/arena/req/chronos.txt
  if [ ! -x "$v/bin/python" ]; then
    "$PY" -m venv "$v"
    "$v/bin/pip" install -q --extra-index-url "$TORCH_INDEX" torch -r "$req"
  fi
  echo "$v/bin/python"
}
if [ ! -d .cache/kronos-src ]; then git clone -q https://github.com/shiyu-coder/Kronos .cache/kronos-src && git -C .cache/kronos-src checkout -q "$KRONOS_SHA"; fi

for key in $KEYS; do
  a=$(adapter "$key"); py=$(venv "$a")
  if [ "$a" = kronos ]; then
    half=$(( THREADS / 2 > 0 ? THREADS / 2 : 1 ))
    for k in 0 1; do "$py" -I scripts/arena/predict.py --model "$key" --kronos .cache/kronos-src --threads "$half" --shard "$k/2" & done; wait
  else
    "$py" -I scripts/arena/predict.py --model "$key" --threads "$THREADS"
  fi
done

node dist/cli/evalArena.js --stage score
