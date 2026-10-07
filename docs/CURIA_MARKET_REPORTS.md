# CURIA market reports — 2026-10-07

The public brand is CURIA (큐리아). Keep the repository name, deployed URLs, gnm API routes, schema IDs, database, queue names, authentication keys and local preferences compatible. Supplied logo artwork is published intact; the header crops its symbol using CSS. PWA icons reference the same original artwork with its actual pixel dimensions.

Home order: release notice, search, large event banner, KOSPI/KOSDAQ index strip, compact daily market report link, personalized stock sections. Chart timeframe controls have one shared group: daily, weekly, monthly, minute candles and recent trades/live prices. Stock “ticks” are labelled live prices because their baseline is minute closes, not an exchange tick feed. Daily-only indicator switches, drawing, index comparison and period controls are disabled in non-daily views. Scenarios are off by default and controlled inside the indicator sheet; the selected mode is saved locally. Momentum gauges share a symmetric return scale, with the actual return and the scale shown.

## Generation and data contract

After the existing daily collection settles (18:00 KST), write `reports/market/{daily|weekly}-YYYY-MM-DD.json`. Render archives and `market-reports.html` in the existing deployment. Only the daily report is generated; the weekly market report was removed at the user’s request. Weekly is a Monday-to-as-of cumulative snapshot, with a baseline from the latest close strictly before Monday; it is not a rolling five-session return. Dates are KST. A stale quote or missing baseline yields a null period return.

Sources: stored Naver index prices; up to 30 common stocks by market capitalization per Korean exchange; collected domestic ETFs; Upbit KRW markets. Coin daily candles have a 09:00 KST boundary; the current candle is a forming price snapshot, not a final close. Ticker signed_change_rate is versus the previous close at UTC 00:00 (09:00 KST), while acc_trade_price_24h is 24-hour turnover. Reference: https://docs.upbit.com/kr/reference/list-quote-tickers. Market schema v2 corrects those labels; regeneration of an older schema snapshot is allowed. ETF returns are price returns, not total returns. Breadth is the current snapshot and must never be called weekly breadth. Each section reports coverage, source and dates. Missing sources remain visible.

Market schema v3 seals the full council in the repository; public HTML/JSON contain the summary only. The existing server checks paid plans for MARKET-DAILY deep access: Plus unlocks with 10 credits once, Pro/Max/alpha/admin access directly. Missing sealing keys fail closed. The existing debate composer and expert chooser ask /ask with a dated market context and retain account question history.

AI: four market desks, summary, consensus, disagreements, three conditional scenarios with invalidation, red-team arguments, watch items and gaps. Claims carry FACT/INFERENCE/ASSUMPTION and M1–M4 evidence references. The model only receives collected evidence; no invented news, macro data, fund flows or calibrated probabilities. Structured output and reference checks precede OK status. Source references prove provenance, not the factual accuracy of a model's interpretation. Use the existing shared monthly budget and usage ledger; failure and skipped statuses remain visible. Successful daily snapshots are not rewritten, while failed/skipped reports may retry.

Existing GitHub daily schedule remains 18:30 KST. A push affecting reporting/assets triggers collection and deployment immediately. No new independent scheduler is required.

## Verification

TypeScript typecheck, complete existing test suite, and new tests for weekly baseline, future/stale quotes and report escaping. Browser tests verify a single timeframe group, weekly→minute→daily transitions, scenario toggling and mobile overflow. Browser execution requires Playwright Chromium; CI installs it before running the UI suite.

## 2.7.1 화면 및 토론 계약

- 홈 데일리는 공시 레이더 옆 버튼 하나로 접근한다. 큰 카드는 제거한다.
- 시장 온도는 홈의 기존 7단계 기술 신호 인포그래픽을 공유하고 네 시장별 실제 집계를 표시한다. 신호가 없으면 기술 신호로 가장하지 않고 일간 상승·하락 분포라고 명시한다.
- v4 시장 리포트는 기존 분석가 6명·데스크 5곳이 각각 판단하고 12차례 토론한다. 마지막은 레드팀, 응답 대상은 앞 발언만 허용하고 입장은 개별 판단과 일치해야 한다. 일반 리포트의 토론 렌더러와 발언자·근거·질문 흐름을 재사용한다.
- 분봉은 일봉 앞에서 세부 단위를 고르고, 주식 실시간 가격 봉을 삭제한다. 주봉·월봉에서는 일봉 시리즈 데이터·가격선·보조 영역을 제거하고 일봉 복귀 때 복원한다.
- 분석 상위 메뉴 아래 기술·전략·수급·실적 화면을 각각 유지한다. 전략별 기록은 챔피언 레이스의 해당 전략을 펼쳐서 확인한다.
- 테마 목록과 구성 종목 정렬을 선택하고 방향을 변경한다. 구성 종목 정렬 기준·방향은 계정 설정으로 동기화한다.
