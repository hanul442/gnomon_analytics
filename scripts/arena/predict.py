"""Forecasts for the model arena (G-290).

Reads the rows written by `node dist/cli/evalArena.js --stage prep` and, for each row, asks one model from
data/arena/models.json for the close 20 trading sessions after the cutoff, as a ratio to the cutoff close:
either the 10%..90% quantiles ({"q": [...9 values]}) or sample paths ({"paths": [...]}). Writes
.cache/eval/arena/<key>/preds-<shard>.json; `node dist/cli/evalArena.js --stage score` merges them into
data/arena/preds/<key>.json (committed, so a month later only the new dates need forecasting) and scores.

Every model sees only bars up to the cutoff (the prep stage cuts them) and is pinned to the revision in the registry.
Rows before the model's testFrom are skipped, so nothing is scored that the model could have trained on.

    python scripts/arena/predict.py --model chronos-2 [--shard 0/2] [--threads 2] [--limit 0]
        [--kronos <Kronos checkout, for the kronos adapter>]
"""

import argparse
import json
import os
import sys
import time

import numpy as np
import torch

LEVELS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]


def closes(row, context):
    bars = row['bars'][-context:]
    return np.asarray([b[4] for b in bars], dtype=np.float64)


def by_length(fn, context):
    """Runs fn on groups of rows with the same history length (a few young stocks have fewer bars) and keeps the order."""
    def run(rows):
        groups = {}
        for k, r in enumerate(rows):
            groups.setdefault(min(len(r['bars']), context), []).append(k)
        out = [None] * len(rows)
        for idx in groups.values():
            for k, fc in zip(idx, fn([rows[k] for k in idx])):
                out[k] = fc
        return out
    return run


# ---------- adapters: each takes a list of rows and returns a list of forecasts ----------

def chronos_like(m, a):
    from chronos import BaseChronosPipeline
    pipe = BaseChronosPipeline.from_pretrained(m['hf'], revision=m['revision'], device_map='cpu', torch_dtype=torch.float32)

    def run(rows):
        ctx = [torch.tensor(closes(r, m['context']), dtype=torch.float32) for r in rows]
        q, _ = pipe.predict_quantiles(ctx, prediction_length=20, quantile_levels=LEVELS)
        out = []
        for k, r in enumerate(rows):
            qq = q[k] if isinstance(q, list) else q[k]
            qq = qq.reshape(-1, 20, len(LEVELS))[0, -1] if qq.dim() == 3 else qq[-1]
            out.append({'q': [round(float(v) / closes(r, 1)[-1], 5) for v in qq]})
        return out
    return run, 64


def timesfm(m, a):
    import timesfm as tfm
    model = tfm.TimesFM_2p5_200M_torch.from_pretrained(m['hf'], revision=m['revision'], torch_compile=False)
    model.compile(tfm.ForecastConfig(max_context=m['context'], max_horizon=32, normalize_inputs=True, use_continuous_quantile_head=True, fix_quantile_crossing=True, infer_is_positive=True, per_core_batch_size=32))

    def run(rows):
        _, q = model.forecast(horizon=20, inputs=[closes(r, m['context']) for r in rows])
        # q[..., 0] is the mean, q[..., 1:10] the 10%..90% quantiles.
        return [{'q': [round(float(v) / closes(r, 1)[-1], 5) for v in q[k, 19, 1:10]]} for k, r in enumerate(rows)]
    return run, 64


def tirex(m, a):
    from tirex import load_model
    model = load_model(m['hf'], device='cpu', revision=m['revision']) if 'revision' in load_model.__code__.co_varnames else load_model(m['hf'], device='cpu')

    def run(rows):
        ctx = torch.tensor(np.stack([closes(r, m['context']) for r in rows]), dtype=torch.float32)
        q, _ = model.forecast(context=ctx, prediction_length=20)
        return [{'q': [round(float(v) / closes(r, 1)[-1], 5) for v in q[k, 19]]} for k, r in enumerate(rows)]
    return by_length(run, m['context']), 64


def toto(m, a):
    from toto.data.util.dataset import MaskedTimeseries
    from toto.inference.forecaster import TotoForecaster
    from toto.model.toto import Toto
    model = Toto.from_pretrained(m['hf'], revision=m['revision']).to('cpu').eval()
    fc = TotoForecaster(model.model)

    def run(rows):
        out = []
        for r in rows:
            x = closes(r, m['context'])
            series = torch.tensor(x, dtype=torch.float32).unsqueeze(0)
            n = series.shape[-1]
            inputs = MaskedTimeseries(series=series, padding_mask=torch.full_like(series, True, dtype=torch.bool), id_mask=torch.zeros_like(series),
                                      timestamp_seconds=torch.zeros_like(series), time_interval_seconds=torch.full((1,), 86400))
            f = fc.forecast(inputs, prediction_length=20, num_samples=64, samples_per_batch=64)
            samples = f.samples[0, -1].reshape(-1) if f.samples.dim() == 4 else f.samples.reshape(-1, 20, f.samples.shape[-1])[0, -1]
            qs = torch.quantile(samples.double(), torch.tensor(LEVELS, dtype=torch.float64))
            out.append({'q': [round(float(v) / x[-1], 5) for v in qs]})
            del n
        return out
    return run, 1


def sundial(m, a):
    from transformers import AutoModelForCausalLM
    model = AutoModelForCausalLM.from_pretrained(m['hf'], revision=m['revision'], trust_remote_code=True).eval()

    def run(rows):
        ctx = torch.tensor(np.stack([closes(r, m['context']) for r in rows]), dtype=torch.float32)
        ctx = ctx[:, -(ctx.shape[1] // 16) * 16:]  # whole 16-bar patches only
        mu, sd = ctx.mean(dim=1, keepdim=True), ctx.std(dim=1, keepdim=True) + 1e-8
        with torch.no_grad():
            # The model attends over 16-bar patches; newer transformers builds a bar-length mask unless given one.
            mask = torch.ones(ctx.shape[0], ctx.shape[1] // 16, dtype=torch.long)
            s = model.generate((ctx - mu) / sd, attention_mask=mask, max_new_tokens=20, num_samples=64)  # (batch, samples, 20)
        last = s[:, :, 19] * sd + mu
        return [{'q': [round(float(v) / closes(r, 1)[-1], 5) for v in torch.quantile(last[k].double(), torch.tensor(LEVELS, dtype=torch.float64))]} for k, r in enumerate(rows)]
    return by_length(run, m['context']), 16


def kronos(m, a):
    import pandas as pd
    sys.path.insert(0, a.kronos)
    from model import Kronos, KronosTokenizer  # noqa: E402
    from model.kronos import auto_regressive_inference, calc_time_stamps  # noqa: E402
    tok = KronosTokenizer.from_pretrained(m['tokenizer'], revision=m['tokenizerRevision']).eval()
    model = Kronos.from_pretrained(m['hf'], revision=m['revision']).eval()
    paths, clip = a.paths, 5
    max_ctx = 2048 if 'mini' in m['key'] else 512

    def prep(row):
        bars = np.asarray(row['bars'][-m['context']:], dtype=np.float64)  # [yyyymmdd, o, h, l, c, v]
        price, vol = bars[:, 1:5], bars[:, 5:6]
        x = np.concatenate([price, vol, vol * price.mean(axis=1, keepdims=True)], axis=1).astype(np.float32)
        mean, std = x.mean(axis=0), x.std(axis=0)
        x = np.clip((x - mean) / (std + 1e-5), -clip, clip)
        ts = lambda ds: calc_time_stamps(pd.Series(pd.to_datetime([str(int(d)) for d in ds], format='%Y%m%d'))).values.astype(np.float32)
        return x, ts(bars[:, 0]), ts(row['future']), mean[3], std[3], bars[-1, 4]

    def run(rows):
        p = [prep(r) for r in rows]
        rep = lambda arr: torch.from_numpy(np.repeat(np.stack(arr), paths, axis=0))
        preds = auto_regressive_inference(tok, model, rep([x[0] for x in p]), rep([x[1] for x in p]), rep([x[2] for x in p]), max_ctx, 20, clip, 1.0, 0, 0.9, 1, False)
        last = preds[:, -1, 3].reshape(len(rows), paths)
        return [{'paths': [round(float((c * (sd + 1e-5) + mu) / close), 5) for c in last[k]]} for k, (_, _, _, mu, sd, close) in enumerate(p)]
    return by_length(run, m['context']), max(1, 128 // paths)


ADAPTERS = {'chronos': chronos_like, 'chronos2': chronos_like, 'timesfm': timesfm, 'tirex': tirex, 'toto': toto, 'sundial': sundial, 'kronos': kronos}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--registry', default='data/arena/models.json')
    ap.add_argument('--input', default='.cache/eval/arena/input.json')
    ap.add_argument('--outdir', default='.cache/eval/arena')
    ap.add_argument('--shard', default='0/1', help='k/n: every n-th row starting at k (for parallel jobs)')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--threads', type=int, default=0)
    ap.add_argument('--paths', type=int, default=16, help='kronos: sample paths per row')
    ap.add_argument('--kronos', default='.cache/kronos-src')
    ap.add_argument('--seed', type=int, default=7)
    ap.add_argument('--redo', action='store_true', help='forecast rows already kept in data/arena/preds too')
    a = ap.parse_args()

    with open(a.registry, encoding='utf8') as f:
        m = next(x for x in json.load(f)['models'] if x['key'] == a.model)
    if m['status'] == 'excluded':
        sys.exit(f"{m['key']} is excluded: {m.get('note', '')}")
    if a.threads:
        torch.set_num_threads(a.threads)
    torch.manual_seed(a.seed)
    np.random.seed(a.seed)

    with open(a.input, encoding='utf8') as f:
        data = json.load(f)
    k_shard, n_shard = (int(v) for v in a.shard.split('/'))
    # Forecasts already kept in data/arena/preds/<key>.json are not made again (the monthly run only adds new dates).
    done = set()
    kept = os.path.join(os.path.dirname(a.registry), 'preds', f"{m['key']}.json")
    if os.path.exists(kept) and not a.redo:
        with open(kept, encoding='utf8') as f:
            done = set(json.load(f)['preds'])
    rows = [r for r in data['rows'] if r['id'][:10] >= m['testFrom'] and r['id'] not in done][k_shard::n_shard][: a.limit or None]
    if not rows:
        print(f"{m['key']}: nothing new to forecast", file=sys.stderr)
        return
    run, batch = ADAPTERS[m['adapter']](m, a)
    out, started = {}, time.time()
    with torch.no_grad():
        for s in range(0, len(rows), batch):
            chunk = rows[s : s + batch]
            for r, fc in zip(chunk, run(chunk)):
                out[r['id']] = fc
            print(f"{m['key']} {len(out)}/{len(rows)} rows, {len(out) / max(1e-9, time.time() - started):.2f} rows/s", file=sys.stderr, flush=True)

    meta = {'model': f"{m['hf']}@{m['revision'][:7]}", 'key': m['key'], 'shard': a.shard, 'seed': a.seed, 'rows': len(out), 'seconds': round(time.time() - started)}
    if m['adapter'] == 'kronos':
        meta['paths'] = a.paths
    os.makedirs(os.path.join(a.outdir, m['key']), exist_ok=True)
    with open(os.path.join(a.outdir, m['key'], f"preds-{a.shard.replace('/', 'of')}.json"), 'w', encoding='utf8') as f:
        json.dump({'meta': meta, 'preds': out}, f)
    print(json.dumps(meta), file=sys.stderr)


if __name__ == '__main__':
    main()
