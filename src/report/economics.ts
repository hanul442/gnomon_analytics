// Unit economics of the plans (docs/DESIGN.md §5.8.1, G-34). Pure.
//
// Rule: what a customer pays, net of VAT (10%) and the payment fee, is at
// least twice what it costs us (cost ratio at most 50%). That also meets a
// 50% mark-up on cost with room to spare. Every plan is checked at its worst
// case: all included credits spent on the action with the lowest margin.
//
// Token counts are medians measured from stored reports (2026-10-04), with a
// 30% allowance for retries, failures and longer pages. Prices per million
// tokens: Opus 5.5 $4 / $20, Sonnet 5.5 $2 / $10, Haiku 4.5 $1 / $5.

import { CREDIT_COST, CREDIT_PACKS, PLANS, type CreditAction, type Plan } from './plans.js';

export const ASSUMPTIONS = {
  krwPerUsd: 1400,
  vat: 0.1,
  /** Card / easy-pay fee on the web. App-store in-app purchase would be 15–30%. */
  paymentFee: 0.035,
  allowance: 1.3,
  /** Hosting, domain, mail and the weekly AI reports shared by everyone, KRW a month. */
  fixedMonthly: 30000,
  /** Paying subscribers the fixed cost is spread over (alpha estimate). */
  subscribers: 50,
  maxCostRatio: 0.5,
} as const;

const MODELS = { opus: [4, 20], sonnet: [2, 10], haiku: [1, 5] } as const;
const callKrw = (model: keyof typeof MODELS, inTok: number, outTok: number) =>
  ((inTok * MODELS[model][0] + outTok * MODELS[model][1]) / 1e6) * ASSUMPTIONS.allowance * ASSUMPTIONS.krwPerUsd;

/** What one use of each credit action costs us, KRW. */
export const ACTION_COST: Record<CreditAction, number> = {
  // Measured: deep committee median 10.1K in / 3.9K out; v4 adds the debate, worst case and tab lines (~+900 out).
  report: callKrw('opus', 10_100, 4_850),
  // A brief on the small model (summary, both sides, watch items).
  brief: callKrw('haiku', 9_500, 2_200),
  // Rewriting a brief as the full committee costs a full report.
  upgrade: callKrw('opus', 10_100, 4_850),
  // An invited expert writes one opinion over the report's evidence.
  invite: callKrw('opus', 11_000, 2_500),
  // Red team over the report's evidence and the user's idea, with invalidation conditions.
  idea: callKrw('opus', 12_000, 3_000),
  // The committee model over the report's evidence plus the question.
  deep: callKrw('opus', 11_000, 2_000),
  // Sonnet over the same evidence.
  standard: callKrw('sonnet', 11_000, 2_000),
  // Haiku over the same evidence, short answer.
  question: callKrw('haiku', 11_000, 1_500),
  // Opening a report that is already written: no model call.
  unlock: 0,
};

/** One stock covered by the full committee every week, KRW a month (Max). */
export const WEEKLY_COVERAGE_COST = ACTION_COST.report * 4.35;

export const netOf = (price: number, fee: number = ASSUMPTIONS.paymentFee) => (price / (1 + ASSUMPTIONS.vat)) * (1 - fee);

/** The cheapest a credit can be bought for: the biggest pack with the biggest top-up bonus. */
export function cheapestCredit(): number {
  const bonus = Math.max(...PLANS.map((p) => p.topUpBonus));
  return Math.min(...CREDIT_PACKS.map((k) => k.price / (k.credits * (1 + bonus / 100))));
}

export interface ActionCheck { key: keyof typeof CREDIT_COST; credits: number; cost: number; net: number; ratio: number }

/** Each action at the cheapest credit price. */
export function actionChecks(): ActionCheck[] {
  const perCredit = cheapestCredit();
  return (Object.keys(CREDIT_COST) as (keyof typeof CREDIT_COST)[]).map((key) => {
    const credits = CREDIT_COST[key], cost = ACTION_COST[key], net = netOf(credits * perCredit);
    return { key, credits, cost, net, ratio: cost / net };
  });
}

export interface PlanCheck { key: Plan['key']; price: number; net: number; worstCost: number; ratio: number }

/** Each paid plan at its worst case. */
export function planChecks(): PlanCheck[] {
  const fixedShare = ASSUMPTIONS.fixedMonthly / ASSUMPTIONS.subscribers;
  const worstPerCredit = Math.max(...(Object.keys(CREDIT_COST) as (keyof typeof CREDIT_COST)[]).map((k) => ACTION_COST[k] / CREDIT_COST[k]));
  return PLANS.filter((p) => p.price > 0).map((p) => {
    // Included invitations, and standing experts writing on every weekly report of the covered stocks.
    const experts = (p.includedInvites + p.standingExperts * 4.35) * ACTION_COST.invite;
    const worstCost = fixedShare + p.monthlyCredits * worstPerCredit + p.weeklyCoverage * WEEKLY_COVERAGE_COST + experts;
    const net = netOf(p.price);
    return { key: p.key, price: p.price, net, worstCost, ratio: worstCost / net };
  });
}
