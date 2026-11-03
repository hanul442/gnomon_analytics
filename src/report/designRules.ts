// G-313 (한서님 11/2 "디자인하기 전에 디자인 규칙을 정하면 참 좋을듯", 11/3 "지금 할 수 있는 거 다"): the twelve design
// rules in one place. docs/DESIGN.md §4.5 lists them in words, scripts/check-rules.mjs checks the ones a browser can
// measure, and RULES_CSS carries rule 1 (회색: 한서님 11/2 "회색을 왜 써" → white ground, darker helper text).

export const DESIGN_RULES: readonly string[] = [
  '색은 흰 바탕, 검정 글자, 강조색 하나(거의 검정)만 써요. 회색은 날짜·설명 같은 보조 글자에만, 진하게 써요. 파랑+주황 짝은 안 써요.',
  '빨강▲(상승)과 파랑▼(하락)은 가격에만 써요.',
  '화면 위쪽에 탭이나 바를 두지 않아요. 전환은 아래 바에서만 해요.',
  '아래 바는 홈·찾기·위원회·나 4개예요. 아이콘 밑에 글자가 있고, ✦는 항상 오른쪽이에요.',
  '배너는 크게 둬요. 한 줄 공지로 줄이지 않아요.',
  '같은 숫자는 한 화면에 한 곳에만 보여요.',
  '기업정보 같은 핵심 정보는 접거나 숨기지 않아요.',
  '정렬선은 2개예요. 바깥 20px, 카드 안 20px.',
  '굵은 글은 제목, 섹션 이름, 핵심 숫자에만 써요. 글자 크기는 30/20/16이에요.',
  '섹션 사이 32px, 모서리 20px. 흰 카드 상자는 그대로 두고, 흰 바탕 위에서는 옅은 그림자로 떠 보이게 해요.',
  '움직임은 쫀득한 스프링으로, 누를 때 반응은 0.15초. 움직임 줄이기를 켜면 꺼져요.',
  "문구는 쉬운 한국어로 쓰고, '사세요·파세요·수익 보장' 같은 말은 쓰지 않아요.",
];

/** Rule 1 and 10 on the light theme. .my-card/.hm-card are flat rows on the ground (G-302), so no shadow box (4.6.1). Loaded last, after ROBINHOOD_CSS. Dark theme keeps its own tokens. */
export const RULES_CSS = `
html:root[data-theme=light]{--page:#FFFFFF;--page-grad:none;--muted:#5A5F67;--fg2:#2B2F35;--soft:rgba(0,0,0,.035)}
html:root[data-theme=light] body{background:#FFFFFF}
html:root[data-theme=light] body #main :is(.card,.mi-card,.iss-c):not(.my-card):not(.hm-card){box-shadow:0 0 0 1px rgba(0,0,0,.06),0 2px 12px rgba(0,0,0,.05)}
`;
