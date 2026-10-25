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
KAIROS_SHA=16eb4b984eb547023187813056a5f289734b9cf6
LAGLLAMA_SHA=df7531a83a19b3c6a0222d703ca9bf59ef7a6ab9

node --max-old-space-size=6000 dist/cli/evalArena.js --stage prep

if [ "$#" -gt 0 ]; then KEYS="$*"; else KEYS=$(node -e "console.log(require('./data/arena/models.json').models.filter(m=>m.status==='active').map(m=>m.key).join(' '))"); fi
adapter() { node -e "const m=require('./data/arena/models.json').models.find(m=>m.key===process.argv[1]);console.log(m.adapter)" "$1"; }
venv() {
  local a=$1 v req
  case "$a" in
    chronos2) a=chronos ;;
    kairos | yinglong) a=misc ;;  # these two share one set of libraries
  esac
  v=.cache/arena-venv/$a; req=scripts/arena/req/$a.txt
  if [ ! -x "$v/bin/python" ]; then
    "$PY" -m venv "$v"
    "$v/bin/pip" install -q --extra-index-url "$TORCH_INDEX" torch -r "$req"
  fi
  echo "$v/bin/python"
}
checkout() { [ -d "$2" ] || { git clone -q "$1" "$2" && git -C "$2" checkout -q "$3"; }; }
checkout https://github.com/shiyu-coder/Kronos .cache/kronos-src "$KRONOS_SHA"
checkout https://github.com/foundation-model-research/Kairos .cache/kairos-src "$KAIROS_SHA"
checkout https://github.com/time-series-foundation-models/lag-llama .cache/lagllama-src "$LAGLLAMA_SHA"

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
