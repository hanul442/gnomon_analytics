"""Kronos sample paths for the hidden-future evaluation (G-286).

Reads the rows written by `node dist/cli/evalKronos.js --stage prep` and, for each row, draws PATHS independent
20-session paths from Kronos (shiyu-coder/Kronos, MIT). Writes only each path's final close, as a ratio to the
cutoff close, so the TypeScript scorer can turn them into a chance of being higher, an expected move and a range.

The model only sees the bars up to the cutoff (the prep stage cuts them), and the trading calendar of the next 20
sessions for its time features. It is run with sample_count=1 on PATHS copies of each row, which is the same as
the library's own sampling but keeps the paths instead of averaging them.

    python scripts/kronos/predict.py --kronos <path to a Kronos checkout> \
        --input .cache/eval/kronos/input.json --out .cache/eval/kronos/preds-0.json [--paths 16] [--shard 0/1]

The model and tokenizer are pinned to the Hugging Face revisions below (weights first published 2025-06-30, last
changed 2025-09-09), so the scored window starts after that.
"""

import argparse
import json
import sys
import time

import numpy as np
import pandas as pd
import torch


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--kronos', required=True)
    ap.add_argument('--input', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--model', default='NeoQuasar/Kronos-small')
    ap.add_argument('--model-rev', default='901c26c1332695a2a8f243eb2f37243a37bea320')
    ap.add_argument('--tokenizer', default='NeoQuasar/Kronos-Tokenizer-base')
    ap.add_argument('--tokenizer-rev', default='0e0117387f39004a9016484a186a908917e22426')
    ap.add_argument('--shard', default='0/1', help='k/n: run every n-th row starting at k (for parallel jobs)')
    ap.add_argument('--paths', type=int, default=16)
    ap.add_argument('--batch', type=int, default=256, help='sequences per forward pass (rows x paths)')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--threads', type=int, default=0)
    ap.add_argument('--seed', type=int, default=7)
    a = ap.parse_args()

    sys.path.insert(0, a.kronos)
    from model import Kronos, KronosTokenizer  # noqa: E402
    from model.kronos import auto_regressive_inference, calc_time_stamps  # noqa: E402

    if a.threads:
        torch.set_num_threads(a.threads)
    torch.manual_seed(a.seed)
    np.random.seed(a.seed)

    with open(a.input, encoding='utf8') as f:
        data = json.load(f)
    k_shard, n_shard = (int(v) for v in a.shard.split('/'))
    rows = data['rows'][k_shard::n_shard][: a.limit or None]
    horizon = int(data['horizon'])
    tokenizer = KronosTokenizer.from_pretrained(a.tokenizer, revision=a.tokenizer_rev).eval()
    model = Kronos.from_pretrained(a.model, revision=a.model_rev).eval()
    clip = 5

    def prepare(row):
        bars = np.asarray(row['bars'], dtype=np.float64)  # [yyyymmdd, o, h, l, c, v]
        price = bars[:, 1:5]
        vol = bars[:, 5:6]
        amount = vol * price.mean(axis=1, keepdims=True)
        x = np.concatenate([price, vol, amount], axis=1).astype(np.float32)
        mean, std = x.mean(axis=0), x.std(axis=0)
        x = np.clip((x - mean) / (std + 1e-5), -clip, clip)
        ts = lambda ds: calc_time_stamps(pd.Series(pd.to_datetime([str(int(d)) for d in ds], format='%Y%m%d'))).values.astype(np.float32)
        return x, ts(bars[:, 0]), ts(row['future']), mean[3], std[3], bars[-1, 4]

    # Rows are grouped by history length so a batch is one tensor (the prep stage gives almost all the same length).
    groups: dict[int, list[int]] = {}
    for k, r in enumerate(rows):
        groups.setdefault(len(r['bars']), []).append(k)
    per = max(1, a.batch // a.paths)
    out: dict[str, list[float]] = {}
    started, done = time.time(), 0
    for _, idx in sorted(groups.items()):
        for s in range(0, len(idx), per):
            chunk = idx[s : s + per]
            prepared = [prepare(rows[k]) for k in chunk]
            rep = lambda arr: torch.from_numpy(np.repeat(np.stack(arr), a.paths, axis=0))
            x = rep([p[0] for p in prepared])
            xs = rep([p[1] for p in prepared])
            ys = rep([p[2] for p in prepared])
            preds = auto_regressive_inference(tokenizer, model, x, xs, ys, 512, horizon, clip, 1.0, 0, 0.9, 1, False)
            last = preds[:, -1, 3].reshape(len(chunk), a.paths)  # normalised close at the horizon, per path
            for j, k in enumerate(chunk):
                _, _, _, mu, sd, close = prepared[j]
                closes = last[j] * (sd + 1e-5) + mu
                out[rows[k]['id']] = [round(float(c / close), 5) for c in closes]
            done += len(chunk)
            rate = done / max(1e-9, time.time() - started)
            print(f'{done}/{len(rows)} rows, {rate:.2f} rows/s', file=sys.stderr, flush=True)

    meta = {'model': f'{a.model}@{a.model_rev[:7]}', 'tokenizer': f'{a.tokenizer}@{a.tokenizer_rev[:7]}', 'shard': a.shard, 'paths': a.paths, 'seed': a.seed, 'rows': len(out), 'seconds': round(time.time() - started)}
    with open(a.out, 'w', encoding='utf8') as f:
        json.dump({'meta': meta, 'preds': out}, f)
    print(json.dumps(meta), file=sys.stderr)


if __name__ == '__main__':
    main()
