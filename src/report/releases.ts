/** Retrospective grouping of merged functionality, not historical Git tags. */
export const VERSION = '2.3.0';
export const RELEASES = [
 ['2.3.0','2026-10-06','☰ 메뉴를 없애고 아래 탭바(홈·검색·관심·성적표·전체)로 바꿨습니다. 전체를 누르면 내 계정·보기 방식·사용법·FAQ 등 나머지가 아래에서 올라옵니다. 넓은 화면은 같은 탭이 위쪽에 있습니다. 차트의 시나리오 전망은 강세·기본·약세 예상 가격대를 나란히 선 박스로 보여 줍니다. 위원회 가격대가 없는 리포트는 AI 분석가 목표가로, 그것도 없으면 변동성 계산으로 가격대를 채웁니다. 작은 광고는 6초마다 바뀌고 아래 카드와 간격을 띄웠습니다.'],
 ['2.2.0','2026-10-06','☰ 메뉴에 홈·관심·성적표·내 계정 바로가기와 FAQ·1:1 문의를 넣고, 홈을 뺀 모든 화면 위에 작은 광고 띠를 붙였습니다. 시나리오는 돌파 가격 대신 20거래일 예상 가격대(%)로 보여 주고 차트 안의 레이어로 옮겼습니다. 전략별 강세·약세를 챔피언 레이스 안에 표시하고 게이지 카드를 없앴습니다. 토론은 2초 생각 → 발언 → 2초 쉼으로 재생하고, 토론에서 한 질문과 답은 다시 들어와도 보입니다. 전문가 답변 대기 표시, 필터 메뉴 구성, 즉시 리포트 생성의 시간 초과를 고쳤습니다.'],
 ['2.1.4','2026-10-06','시나리오를 확정적인 가격 돌파·이탈 표현 대신 가정으로 표시하고 성립 근거·촉매와 무효화 조건을 구분했습니다. 지지·저항을 임의의 시나리오 기준으로 사용하지 않고 모바일 운영 표를 카드 형태로 표시합니다. 전략 중복 순위표를 제거하고 업데이트 배너는 홈에만 표시하며 토론 순차 재생을 복구했습니다.'],
 ['2.1.3','2026-10-06','기술 탭 상단 지표 버튼을 제거하고 지표 본문에서 선택한 지표만 차트에 표시합니다. 돌아가면 이전 지표와 화면 위치를 복원하며 개인 기본 설정을 유지합니다.'],
 ['2.1.2','2026-10-06','시나리오 조건·근거를 바로 표시하고 미니 차트의 숫자 크기·가격 라벨 간격·현재 가격과 범례를 개선했습니다.'],
 ['2.1.1','2026-10-06','기술과 전략 탭 분리, 기존 시나리오 설명 속 가격도 미니 차트에 표시, 스트리밍 답변 중 Thinking Orbs 유지, 전체 토론 항상 표시, 뉴스·공시 5건 이후 더 보기.'],
 ['2.1.0','2026-10-06','리포트 유무와 관계없이 동일한 분석 화면, 피보나치·RSI 등 지표에서 차트로 바로 이동, 시나리오 미니 차트와 차트 탭 비교, 토론 안의 질문 입력·전송 아이콘·작은 비용 안내, 계정에 저장하는 맞춤 전문가, 간결한 AI 조건 버튼, 즉시 화면 표시와 실제 대기 시에만 Thinking Orbs.'],
 ['2.0.0','2026-10-06','요청 즉시 리포트 생성과 채팅 스트리밍, Thinking Orbs 공통 로딩(최소 2초), AI 검색 조건 만들기, 전문가 선택 팝업, 리포트 권한·모자이크, 모바일 화면 안정화, 차트·기술 탭 분리, 코인 분봉과 거래량·매집/분산, 토론 입력 옆 + 전문가 선택.'],
 ['1.4.0','2026-10-06','토론 발언자 표시와 실시간 답변, 필터 팝업, ETF·코인 필터, 홈 개인화와 모바일 채팅.'],
 ['1.3.0','2026-10-06','사용법·화면 둘러보기·맞춤 설문, 투자 스타일별 위원회, 여섯 리포트 탭과 표결 화면.'],
 ['1.2.0','2026-10-05~06','ETF·코인 검색과 분석, 거래량·거래대금 조건, 시장별 필터 확장.'],
 ['1.1.0','2026-10-05','스크리너와 저장 조건, 위원회 토론·질문, 장중 데이터.'],
 ['1.0.0','2026-10-05','계정과 크레딧, AI 질문, 알파 참여와 권한 체계.'],
 ['0.5.0','2026-10-04~05','분석 성적표, 근거 추적, 데이터 갱신 상태와 요금제 화면.'],
 ['0.4.0','2026-10-04','전 종목 검색과 무료 계산, 종목 리포트 요청.'],
 ['0.3.0','2026-10-04','전략 대결과 모의투자.'],
 ['0.2.0','2026-10-04','기간별 신호, 기술적 적정가·예측 범위, AI 위원회.'],
 ['0.1.0','2026-10-04','차트·기술 지표·뉴스와 AI 해설 확장.'],
 ['0.0.0','2026-10-03','SK하이닉스 일일 리포트로 시작한 알파 기본판.'],
] as const;
export const versionBanner = (base:string) => `<aside class="version-banner" data-version="${VERSION}"><div><b>Alpha v${VERSION}</b><p>아래 탭바와 전체 메뉴 · 차트 속 시나리오 가격대 박스</p><a href="${base}guide.html">새 사용법</a> · <a href="${base}updates.html">릴리스 노트</a></div><button type="button" data-dismiss-version aria-label="이 버전 안내 닫기">×</button></aside>`;
export const VERSION_CSS = `.version-banner[hidden]{display:none}.version-banner{display:flex;justify-content:space-between;gap:12px;padding:14px 18px;margin:12px 0 18px;background:#eef3fb;border:1px solid #ccd9ee;border-radius:14px;font-size:13px}.version-banner p{margin:4px 0}.version-banner button{border:0;background:none;font-size:22px;align-self:start;cursor:pointer}`;
export const VERSION_JS = `(function(){var b=document.querySelector('[data-version]');if(!b)return;var key='gnm-version-dismissed-'+b.dataset.version;try{b.hidden=localStorage.getItem(key)==='1';}catch(e){}b.querySelector('[data-dismiss-version]').onclick=function(){b.hidden=true;try{localStorage.setItem(key,'1');}catch(e){}};})();`;
