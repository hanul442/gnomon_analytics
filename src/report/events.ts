// Credit events (G-73): a banner says "받기", the API grants the credits once per account (ledger ref
// event:<id>). Shared by the Worker and the pages so both read the same list.

export interface CreditEvent { id: string; credits: number; from: string; to: string; title: string; text: string }

export const EVENTS: readonly CreditEvent[] = [
  { id: 'alpha-thanks-2026-10', credits: 50, from: '2026-10-06', to: '2026-10-19', title: '알파 참여 감사 이벤트', text: '로그인하고 받기를 누르면 50크레딧을 드려요. 한 계정에 한 번이에요.' },
];

/** Events running on a KST date (YYYY-MM-DD). */
export const openEvents = (today: string) => EVENTS.filter((e) => e.from <= today && today <= e.to);
