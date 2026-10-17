// Scenario probability scoring (G-227). Every committee report gives BULL / BASE / BEAR a probability (G-60)
// and a trigger price for BULL (above) and BEAR (below) (G-65). Twenty sessions later the scenario that
// happened is the one whose trigger the close crossed first (BASE when neither was crossed), and the three
// probabilities are scored with the Brier score for three outcomes. Calls are read back from the stored
// reports themselves (they are never rewritten), so reports made before this existed are scored too. Pure.

export const SCENARIO_HORIZON = 20;
export type ScenarioKind = 'BULL' | 'BASE' | 'BEAR';
const KINDS: readonly ScenarioKind[] = ['BULL', 'BASE', 'BEAR'];

export interface ScenarioCall {
  reportDate: string; baseDate: string; baseClose: number;
  /** Whole percents summing to 100. */
  probs: Record<ScenarioKind, number>;
  bullTrigger: number; bearTrigger: number;
}

export interface ScenarioTrack extends ScenarioCall {
  done: boolean;
  /** What happened (done), or what has happened so far (a trigger already crossed), else null. */
  outcome: ScenarioKind | null;
  /** The session the trigger was crossed. */
  crossedOn: string | null;
  sessions: number;
  /** Three-outcome Brier score of this call (0 best, 2 worst), once done. */
  brier: number | null;
}

/** One bucket of the calibration table: what the committee said vs how often it happened. */
export interface CalibrationBin { lo: number; hi: number; n: number; saidPct: number; happenedPct: number }

export interface ScenarioBoard {
  scored: number; pending: number;
  /** Mean three-outcome Brier score; 0.667 is what always saying 33·33·33 earns. */
  brier: number | null;
  /** 1 − brier / 0.667: above 0 beats saying a third each, 1 is perfect. */
  skill: number | null;
  /** How often each scenario happened among scored calls. */
  happened: Record<ScenarioKind, number>;
  bins: CalibrationBin[];
  /** Newest first, up to 5. */
  calls: ScenarioTrack[];
}

export const UNIFORM_BRIER = 2 / 3;
const BIN_EDGES = [0, 20, 40, 60, 80, 101] as const;

/** A report's scenarios as a scorable call, or null when a probability or a trigger is missing. */
export function scenarioCallOf(report: {
  date: string; price?: { close: number; sessionDate?: string | null } | null;
  commentary?: { status: string; scenarios?: readonly { kind: ScenarioKind; probability?: number; trigger?: number }[] } | null;
}): ScenarioCall | null {
  const c = report.commentary, p = report.price;
  if (c?.status !== 'OK' || !c.scenarios || !p?.close) return null;
  const by = (k: ScenarioKind) => c.scenarios!.find((s) => s.kind === k);
  const probs = Object.fromEntries(KINDS.map((k) => [k, by(k)?.probability])) as Record<ScenarioKind, number | undefined>;
  if (KINDS.some((k) => !Number.isFinite(probs[k]))) return null;
  const total = KINDS.reduce((s, k) => s + probs[k]!, 0);
  const bull = by('BULL')?.trigger, bear = by('BEAR')?.trigger;
  if (!(total > 0) || !bull || !bear || !(bull > bear)) return null;
  return {
    reportDate: report.date, baseDate: p.sessionDate ?? report.date, baseClose: p.close,
    probs: Object.fromEntries(KINDS.map((k) => [k, (probs[k]! / total) * 100])) as Record<ScenarioKind, number>,
    bullTrigger: bull, bearTrigger: bear,
  };
}

export const brierOf = (probs: Record<ScenarioKind, number>, outcome: ScenarioKind) =>
  KINDS.reduce((s, k) => s + (probs[k] / 100 - (k === outcome ? 1 : 0)) ** 2, 0);

/** Follows each call over the 20 sessions after its base session and scores the finished ones. */
export function scoreScenarios(calls: readonly ScenarioCall[], bars: readonly { date: string; close: number }[]): ScenarioBoard {
  const sorted = [...bars].sort((a, b) => (a.date < b.date ? -1 : 1));
  const idx = new Map(sorted.map((b, i) => [b.date, i]));
  const seen = new Set<string>();
  const tracks: ScenarioTrack[] = [];
  for (const c of [...calls].sort((a, b) => (a.baseDate < b.baseDate ? -1 : 1))) {
    if (seen.has(c.baseDate)) continue; // one call per base session (the first report made on it)
    seen.add(c.baseDate);
    const i = idx.get(c.baseDate);
    if (i === undefined) continue;
    const window = sorted.slice(i + 1, i + 1 + SCENARIO_HORIZON);
    const hit = window.find((b) => b.close >= c.bullTrigger || b.close <= c.bearTrigger);
    const done = window.length === SCENARIO_HORIZON || !!hit;
    const outcome: ScenarioKind | null = hit ? (hit.close >= c.bullTrigger ? 'BULL' : 'BEAR') : done ? 'BASE' : null;
    tracks.push({ ...c, done, outcome, crossedOn: hit?.date ?? null, sessions: window.length, brier: done && outcome ? brierOf(c.probs, outcome) : null });
  }
  const scored = tracks.filter((t) => t.done && t.outcome);
  const happened = Object.fromEntries(KINDS.map((k) => [k, scored.filter((t) => t.outcome === k).length])) as Record<ScenarioKind, number>;
  const brier = scored.length ? scored.reduce((s, t) => s + t.brier!, 0) / scored.length : null;
  return {
    scored: scored.length, pending: tracks.length - scored.length, brier,
    skill: brier === null ? null : 1 - brier / UNIFORM_BRIER, happened,
    bins: calibrationBins(scored.flatMap((t) => KINDS.map((k) => ({ p: t.probs[k], hit: t.outcome === k })))),
    calls: tracks.slice(-5).reverse(),
  };
}

/** Each (probability, happened) pair dropped in a 20-point bucket. Empty buckets are left out. */
export function calibrationBins(pairs: readonly { p: number; hit: boolean }[]): CalibrationBin[] {
  const out: CalibrationBin[] = [];
  for (let b = 0; b < BIN_EDGES.length - 1; b += 1) {
    const lo = BIN_EDGES.at(b)!, hi = BIN_EDGES.at(b + 1)!;
    const xs = pairs.filter((x) => x.p >= lo && x.p < hi);
    if (!xs.length) continue;
    out.push({ lo, hi: Math.min(hi, 100), n: xs.length, saidPct: xs.reduce((s, x) => s + x.p, 0) / xs.length, happenedPct: (xs.filter((x) => x.hit).length / xs.length) * 100 });
  }
  return out;
}

/** Adds boards from several stocks into one (for the scorecard): sums, and bins weighted by count. */
export function mergeBoards(boards: readonly ScenarioBoard[]): Omit<ScenarioBoard, 'calls'> {
  const scored = boards.reduce((s, b) => s + b.scored, 0), pending = boards.reduce((s, b) => s + b.pending, 0);
  const brier = scored ? boards.reduce((s, b) => s + (b.brier ?? 0) * b.scored, 0) / scored : null;
  const happened = Object.fromEntries(KINDS.map((k) => [k, boards.reduce((s, b) => s + b.happened[k], 0)])) as Record<ScenarioKind, number>;
  const bins: CalibrationBin[] = [];
  for (let b = 0; b < BIN_EDGES.length - 1; b += 1) {
    const lo = BIN_EDGES.at(b)!, xs = boards.flatMap((x) => x.bins.filter((y) => y.lo === lo));
    const n = xs.reduce((s, x) => s + x.n, 0);
    if (n) bins.push({ lo, hi: Math.min(BIN_EDGES.at(b + 1)!, 100), n, saidPct: xs.reduce((s, x) => s + x.saidPct * x.n, 0) / n, happenedPct: xs.reduce((s, x) => s + x.happenedPct * x.n, 0) / n });
  }
  return { scored, pending, brier, skill: brier === null ? null : 1 - brier / UNIFORM_BRIER, happened, bins };
}
