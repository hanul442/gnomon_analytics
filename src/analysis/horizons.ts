// Horizon gauges (docs/DESIGN.md §5.2, G-14). Each horizon runs the same
// 16-indicator vote (§4.2) on its own bar size, so the five gauges can
// disagree: a falling 15-minute tape inside a rising weekly trend is shown
// as exactly that. Pure functions.

import { summarizeTechnicals, type OhlcBar, type TechnicalSummary } from './technicals.js';
import type { IntradaySession } from '../types.js';

export type HorizonKey = 'ULTRA_SHORT' | 'SHORT' | 'MEDIUM' | 'MEDIUM_LONG' | 'LONG';

export interface HorizonGauge {
  key: HorizonKey;
  label: string;
  /** What the horizon is about, in plain words. */
  span: string;
  /** Bar size the vote ran on. */
  barLabel: string;
  bars: number;
  summary: TechnicalSummary;
  /** Caveat shown under the gauge (e.g. intraday bars approximated from closes). */
  note?: string;
}

export const HORIZONS: readonly { key: HorizonKey; label: string; span: string; barLabel: string }[] = [
  { key: 'ULTRA_SHORT', label: '초단기', span: '당일~1거래일', barLabel: '15분봉' },
  { key: 'SHORT', label: '단기', span: '1~10거래일', barLabel: '60분봉' },
  { key: 'MEDIUM', label: '중기', span: '2~12주', barLabel: '일봉' },
  { key: 'MEDIUM_LONG', label: '중장기', span: '3~6개월', barLabel: '주봉' },
  { key: 'LONG', label: '장기', span: '6개월 이상', barLabel: '월봉' },
];

export interface Bar extends OhlcBar { open: number; volume: number }

/**
 * Minute closes → N-minute bars. Naver's minute feed has closes only, so the
 * bar's high and low are the highest and lowest minute close (a slight
 * understatement of the true range). Volume comes from the cumulative count.
 */
export function intradayBars(sessions: readonly IntradaySession[], minutes: number): Bar[] {
  const out: Bar[] = [];
  for (const s of [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    let current: (Bar & { bucket: number }) | null = null;
    let prevCum = 0;
    s.times.forEach((time, i) => {
      const [h, m] = time.split(':').map(Number) as [number, number];
      const minuteOfSession = h * 60 + m - 9 * 60;
      // The 15:30 closing-auction print belongs to the last bar of the day.
      const bucket = Math.floor(Math.min(minuteOfSession, 389) / minutes);
      const close = s.closes[i]!, cum = s.cumVolumes[i]!;
      const volume = Math.max(0, cum - prevCum);
      prevCum = cum;
      if (!current || current.bucket !== bucket) {
        if (current) out.push(strip(current));
        current = { bucket, date: `${s.date}T${time}`, open: close, high: close, low: close, close, volume };
      } else {
        current.high = Math.max(current.high, close);
        current.low = Math.min(current.low, close);
        current.close = close;
        current.volume += volume;
      }
    });
    if (current) out.push(strip(current));
  }
  return out;
}

function strip({ bucket: _bucket, ...bar }: Bar & { bucket: number }): Bar {
  return bar;
}

/** Weekly (or daily) bars → calendar-month bars keyed by YYYY-MM. */
export function monthlyBars(bars: readonly Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const bar of [...bars].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const month = bar.date.slice(0, 7);
    const prev = out.at(-1);
    if (prev && prev.date === month) {
      prev.high = Math.max(prev.high, bar.high);
      prev.low = Math.min(prev.low, bar.low);
      prev.close = bar.close;
      prev.volume += bar.volume;
    } else {
      out.push({ date: month, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
    }
  }
  return out;
}

/** Weekly bars from daily ones (Monday-keyed weeks), for pages that have only daily prices. */
export function weeklyFromDaily(bars: readonly Bar[]): Bar[] {
  const out: Bar[] = [];
  for (const bar of [...bars].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    const d = new Date(`${bar.date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const week = d.toISOString().slice(0, 10), prev = out.at(-1);
    if (prev && prev.date === week) { prev.high = Math.max(prev.high, bar.high); prev.low = Math.min(prev.low, bar.low); prev.close = bar.close; prev.volume += bar.volume; }
    else out.push({ date: week, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume });
  }
  return out;
}

/** The five gauges. Any input may be empty; that horizon then withholds its call. Missing weekly bars are built from daily ones. */
export function horizonGauges(input: { intraday: readonly IntradaySession[]; daily: readonly Bar[]; weekly: readonly Bar[] }): HorizonGauge[] {
  const weekly = input.weekly.length ? [...input.weekly] : weeklyFromDaily(input.daily);
  const series: Record<HorizonKey, { bars: Bar[]; note?: string }> = {
    ULTRA_SHORT: { bars: intradayBars(input.intraday, 15), note: input.intraday.length ? '분봉 종가로 만든 15분봉이라 고가·저가가 실제보다 좁을 수 있어요.' : '이 종목은 저장된 분봉이 없어 초단기·단기는 판단을 보류해요. 차트의 분봉에서 직접 확인할 수 있어요.' },
    SHORT: { bars: intradayBars(input.intraday, 60), ...(input.intraday.length ? { note: '최근 약 10거래일의 60분봉이라 긴 이동평균은 계산되지 않을 수 있어요.' } : {}) },
    MEDIUM: { bars: [...input.daily] },
    MEDIUM_LONG: { bars: weekly, ...(input.weekly.length ? {} : { note: '일봉을 묶어 만든 주봉이에요.' }) },
    LONG: { bars: monthlyBars(weekly), note: input.weekly.length ? '주봉 5년치로 만든 월봉이라 120개월 이동평균은 계산되지 않아요.' : '일봉 약 2년치로 만든 월봉이라 긴 이동평균은 계산되지 않을 수 있어요.' },
  };
  return HORIZONS.map((h) => {
    const { bars, note } = series[h.key];
    return { ...h, bars: bars.length, summary: summarizeTechnicals(bars), ...(note ? { note } : {}) };
  });
}
