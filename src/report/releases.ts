/** Retrospective grouping of merged functionality, not historical Git tags. */
export const VERSION = '2.1.0';
export const RELEASES = [
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
export const versionBanner = (base:string) => `<aside class="version-banner" data-version="${VERSION}"><div><b>Alpha v${VERSION}</b><p>시나리오 차트 · 내 전문가 · 간결한 화면</p><a href="${base}guide.html">새 사용법</a> · <a href="${base}updates.html">릴리스 노트</a></div><button type="button" data-dismiss-version aria-label="이 버전 안내 닫기">×</button></aside>`;
export const VERSION_CSS = `.version-banner[hidden]{display:none}.version-banner{display:flex;justify-content:space-between;gap:12px;padding:14px 18px;margin:12px 0 18px;background:#eef3fb;border:1px solid #ccd9ee;border-radius:14px;font-size:13px}.version-banner p{margin:4px 0}.version-banner button{border:0;background:none;font-size:22px;align-self:start;cursor:pointer}`;
export const VERSION_JS = `(function(){var b=document.querySelector('[data-version]');if(!b)return;var key='gnm-version-dismissed-'+b.dataset.version;try{b.hidden=localStorage.getItem(key)==='1';}catch(e){}b.querySelector('[data-dismiss-version]').onclick=function(){b.hidden=true;try{localStorage.setItem(key,'1');}catch(e){}};})();`;
