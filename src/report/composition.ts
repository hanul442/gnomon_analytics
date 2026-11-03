// G-302 (한서님 10/27 "왜 ui 구도가 마음에 안 들지" → 다섯 개 다): one set of layout rules for every screen.
// Measured before (390px first screens): 4–5 left edges per screen, 71–87% of the text bold, home section gaps of
// 26/14/40px, every block in the same white card, and the biggest text on home was the word "오늘".
// 1 정렬: two left lines only. Outer line = 20px gutter (titles, section names, card edges); inner line = 20px card padding.
// 2 강약: bold only for page titles, section names and key numbers; labels, dates and links drop to regular + grey.
// 3 여백: 32px between sections, 12px from a section name to its card, one 20px card radius.
// 4 카드 위계: one floating card per screen (home = 위원회 오늘); lists sit on the ground as rows; older report days are one line.
// 5 시선 흐름: home's biggest text is today's sentence, stock reads 이름 → 가격 → 테마, one heading per section.
// Loaded last (after PC_RAIL_CSS). Page <style> blocks come later in the document, so every rule starts with
// `:root body #main` to outrank them without !important.
const M = ':root body #main';

export const COMPOSITION_CSS = `
/* 1 정렬 */
@media (max-width:820px){${M}{padding-left:20px;padding-right:20px}${M}>.pg-title{padding-left:0;padding-right:0}}
${M} .wd-p,${M} .hm-p{padding-left:0;padding-right:0}
${M} .hm-hero,${M} .hm-h,${M} .block-head,${M} .hm-p #watch .block-head,${M} .rp-lead,${M} .mb-lead,${M} .cl-head{margin-left:0;margin-right:0;padding-left:0;padding-right:0}
${M} section.hero,${M} .sc-hero,${M} .mi-card,${M} .cs-home,${M} .hm-card,${M} .my-card,${M} .block>.card:not(.km-stat){padding-left:20px;padding-right:20px}
${M} .km-stat{padding-left:12px;padding-right:12px}
/* 2 강약 */
${M} .block-head h2,${M} .hm-h h2,${M} .hm-p #watch .block-head h2{font-size:20px;font-weight:700;letter-spacing:-.01em}
${M} .st-h{font-size:20px;font-weight:700;letter-spacing:-.01em;margin-left:0;padding-left:0}
${M} .block-head .muted,${M} .hm-h .muted{font-weight:400}
${M} .wd-link,${M} .feed-redo,${M} .rp-what{font-weight:500}
${M} .hm-d,${M} .cs-k,${M} .cs-hh span,${M} .sc-k{font-weight:500;color:var(--muted)}
${M} .ia-t{font-weight:500}${M} .ia-from,${M} .badge,${M} .mkt-chip,${M} .fresh{font-weight:500}
${M} .mi-gi b{font-weight:500}${M} .mi-gi :is(.up,.down){font-weight:600}
${M} .eyebrow,${M} .eyebrow span{font-weight:500}
${M} .theme-chips a,${M} .theme-chips span,${M} .theme-chips button{font-weight:500}
${M} .kp-line b{font-weight:600}
@media (max-width:640px){${M}>.pg-title h1{font-size:30px;letter-spacing:-.02em}}
/* 3 여백 */
@media (max-width:820px){${M} .hm-p{gap:0}}
${M} .hm-bn{margin-top:20px}
${M} .hm-left,${M} .hm-com,${M} .hm-bn,${M} #banner{margin-bottom:0;padding-bottom:0}
${M} .hm-h{margin:32px 0 12px}
${M} .hm-p #watch{margin:32px 0 0}${M} .hm-p #watch .block-head{margin:0 0 12px}
:root:not([data-level=pro]) body #main .block{margin-top:32px}
${M} .block-head{margin-bottom:12px}
${M} .km-stats{gap:8px}
${M} :is(.card,.mi-card,section.hero,.sc-hero,.bn-slide){border-radius:20px}
${M} :is(section.hero,.sc-hero,.mi-card,.cs-home,.hm-card,.my-card){padding-top:20px;padding-bottom:20px}
/* 4 카드 위계 */
${M} .hm-card,${M} .my-card{background:transparent;box-shadow:none;border:0;-webkit-backdrop-filter:none;backdrop-filter:none;padding-left:0;padding-right:0}
${M} #watch .my-card:has(#watch-list>.empty){padding:4px 0}
${M} .km-stat{background:transparent;box-shadow:none;border:1px solid var(--line);-webkit-backdrop-filter:none;backdrop-filter:none}
${M} .cs-home{padding:24px}${M} .cs-home .cs-htitle{font-size:22px;line-height:1.35}
${M} .rp-day~.rp-day{margin-top:0}
${M} .rp-day~.rp-day .block-head{margin:16px 0 0}
${M} .rp-day~.rp-day .mi-card{background:transparent;box-shadow:none;border:0;border-bottom:1px solid var(--line);border-radius:0;padding:8px 0 16px}
${M} .rp-day~.rp-day .mi-top,${M} .rp-day~.rp-day .mi-g{display:none}
${M} .rp-day~.rp-day .mi-card p{margin:0;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
/* 5 시선 흐름 */
body:has(#mkt-hero) #main>.pg-title{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
${M} .hm-hero{margin:28px 0 0}
${M} .hm-d{font-size:15px}
${M} .hm-s{margin-top:6px;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-.02em}
${M} .hero-main .theme-chips{margin:14px 0 0}
`;
