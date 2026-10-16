// 내 프로필 (G-207): the answers that shape the whole app in one place. The survey asks them once; the
// profile page changes them one at a time. Both write the same answers (gnm-prefs, synced with the
// account, and the onboarding survey on the server), and AI answers read the explanation depth and
// holding period from there.

export const EXPERIENCE = ['처음이거나 1년 미만', '1~3년', '3~10년', '10년 이상', '업으로 해요'] as const;
export const HORIZON = ['며칠 안(단기 매매)', '몇 주', '몇 달', '1년 이상'] as const;
export const ASSETS = ['국내 주식', '해외 주식', '국내 ETF', '해외 ETF', '코인', '채권·예금성', '아직 투자 전'] as const;
export const EXPLAIN = ['아주 쉬운 말로', '보통', '전문 용어 그대로'] as const;
/** 화면 수준 (G-218): how much the stock pages show and explain; level.ts turns it into html[data-level]. */
export const LEVEL = ['초보자', '중급자', '고급', '전문가'] as const;

const pick = <T extends string>(list: readonly T[], v: unknown): T | null => (typeof v === 'string' && (list as readonly string[]).includes(v) ? v as T : null);

/**
 * The reader line for the AI, from the latest onboarding answers. Only the fixed options pass, so
 * nothing a person typed reaches the prompt.
 */
export function readerNote(answers: unknown): string {
  const a = answers && typeof answers === 'object' ? answers as Record<string, unknown> : {};
  const level = pick(LEVEL, a.level), horizon = pick(HORIZON, a.horizon), exp = pick(EXPERIENCE, a.experience);
  // G-218: with no explanation depth picked, the screen level stands in for it (초보자 → 쉬운 말, 전문가 → 용어 그대로).
  const picked = pick(EXPLAIN, a.explain), explain = picked ?? (level === '초보자' ? '아주 쉬운 말로' : level === '전문가' ? '전문 용어 그대로' : null);
  if (!explain && !horizon && !exp && !level) return '';
  const bits = [explain && `설명 수준: ${explain}${picked ? '' : '(화면 수준에 맞춤)'}`, horizon && `보유 기간: ${horizon}`, exp && `투자 경험: ${exp}`, level && `화면 수준: ${level}`].filter(Boolean).join(' · ');
  const how = explain === '아주 쉬운 말로' ? '전문 용어는 쓰지 않거나 바로 풀어 쓰고, 짧은 문장으로 답해요.'
    : explain === '전문 용어 그대로' ? '용어를 풀어 쓰지 말고 지표 이름과 숫자를 그대로 써요.' : '';
  return `\n\n질문한 사람의 프로필이에요(본인이 고른 값): ${bits}. ${how}${horizon ? ' 이 보유 기간에서 무엇이 중요한지 먼저 말해요.' : ''} 숫자와 사실은 프로필과 상관없이 같아요.`.replace(/ {2,}/g, ' ');
}
