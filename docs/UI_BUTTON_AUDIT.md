# Alpha v2.1.0 버튼·정보 밀도 점검

점검 범위: src/report의 모든 버튼 템플릿과 공유 스타일, 홈·종목·스크리너·채팅·전문가 팝업 및 계정·설정·안내 화면. 아래 수는 소스의 버튼 템플릿 수이며 동적으로 반복 렌더링되는 버튼 개수가 아닙니다.

| 화면 | 조정 |
|---|---|
| 토론 | 별도 질문 제목·예시·중복 설명 제거. 한 줄 입력과 + 선택·➤ 전송, 비용은 작은 하단 문구 |
| AI 조건 | 입력 옆 ✦ 생성. 적용·저장·+ 조건으로 버튼 문구 축약, 크레딧은 버튼 밖 표시 |
| 홈 | 필터의 두 줄 문구를 한 줄로, 더 보기 단축 |
| 시나리오 | 최근 가격·범위 차트 먼저, 조건·근거는 접기. 강세·기본·약세·비교 버튼 |
| 위원회 | 처음 세 발언 이후 전체 토론 접기, 위원별 상세 근거 접기 |
| 공통 | 버튼 줄 간격·간격 정돈, 그룹 줄바꿈, 아이콘 버튼에 접근성 이름·툴팁 |
| 결제·삭제·계정·운영 | 동작 의미와 확인 문구 유지. 비용·삭제 의미를 아이콘만으로 대체하지 않음 |

검증 기준: 375/390/768/1280px에서 가로 넘침 없음, 전송 버튼·AI 버튼의 접근성 이름, 전문가 팝업의 화면 안 배치, 입력창 높이 제한, 시나리오 선택·비교, 빠른 작업에 로딩 없음, 느린 작업과 모션 줄이기에 실제 Orb 표시.

| 템플릿 파일 | 버튼 템플릿 수 |
|---|---|

| `alpha.ts` | 8 |
| `alphaPages.ts` | 3 |
| `appParts.ts` | 12 |
| `chartTools.ts` | 6 |
| `chat.ts` | 8 |
| `coinChart.ts` | 1 |
| `conclusion.ts` | 2 |
| `onDemandBrowser.ts` | 1 |
| `persona.ts` | 1 |
| `plans.ts` | 2 |
| `releases.ts` | 1 |
| `renderAlpha.ts` | 20 |
| `renderHome.ts` | 7 |
| `renderHtml.ts` | 12 |
| `renderParliament.ts` | 3 |
| `renderPricing.ts` | 2 |
| `renderReportExtras.ts` | 5 |
| `renderScorecard.ts` | 3 |
| `renderScreener.ts` | 12 |
| `scenarioChart.ts` | 1 |
| `ui.ts` | 7 |
