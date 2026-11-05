// G-313 (한서님 11/2 "디자인하기 전에 디자인 규칙을 정하면 참 좋을듯", 11/3 "지금 할 수 있는 거 다"): the twelve design
// rules in one place. docs/DESIGN.md §4.5 lists them in words, scripts/check-rules.mjs checks the ones a browser can
// measure, and RULES_CSS carries rule 1. G-330 (11/4, 로빈후드식 시안 A) rewrote rules 1, 9 and 10; the look itself lives in rhSystem.ts (회색: 한서님 11/2 "회색을 왜 써" → white ground, darker helper text).

export const DESIGN_RULES: readonly string[] = [
  '색은 흰 바탕(다크는 순수 검정), 검정 글자, 강조색은 라임(#CCFF00) 하나예요. 라임은 검정 옆에만 써요(검정 버튼의 라임 글자, ✦). 회색은 보조 글자에만, 진하게 써요. 파랑+주황 짝은 안 써요.',
  '빨강▲(상승)과 파랑▼(하락)은 가격에만 써요.',
  '화면 위쪽에 탭이나 바를 두지 않아요. 전환은 아래 바에서만 해요.',
  '아래 바는 홈·찾기·위원회·나 4개예요. 아이콘 밑에 글자가 있고, ✦는 항상 오른쪽이에요.',
  '배너는 크게 둬요. 한 줄 공지로 줄이지 않아요.',
  '같은 숫자는 한 화면에 한 곳에만 보여요.',
  '기업정보 같은 핵심 정보는 접거나 숨기지 않아요.',
  '정렬선은 2개예요. 바깥 20px, 카드 안 20px.',
  '크게 쓰되 덜 굵게 써요. 화면 제목 32, 섹션 제목 24, 본문 16이고 제목은 중간 굵기(500)예요. 굵은 글은 가격·등락 같은 핵심 숫자에만 써요.',
  '상자 대신 얇은 선 하나로 나눠요. 상자는 시장 지수 카드만, 그림자는 0개예요. 모양은 둘뿐이에요: 버튼·칩은 완전한 알약, 작은 모양은 모서리 8px. 섹션 사이 32px.',
  '움직임은 쫀득한 스프링으로, 누를 때 반응은 0.15초. 움직임 줄이기를 켜면 꺼져요.',
  "문구는 쉬운 한국어로 쓰고, '사세요·파세요·수익 보장' 같은 말은 쓰지 않아요.",
];

/** Rule 1 and 10 on the light theme. .my-card/.hm-card and the older days' market lines in 위원회 (.rp-day~.rp-day .mi-card) are flat rows on the ground (G-302), so no shadow box (4.6.1). Loaded last, after ROBINHOOD_CSS. Dark theme keeps its own tokens. */
export const RULES_CSS = `
html:root[data-theme=light]{--page:#FFFFFF;--page-grad:none;--muted:#5A5F67;--fg2:#2B2F35;--soft:rgba(0,0,0,.035)}
html:root[data-theme=light] body{background:#FFFFFF}
`;
