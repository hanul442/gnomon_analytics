import {volumeRead} from '../analysis/quickCalc.js';
import type {DailyReport} from './dailyReport.js';
export function coinFlow(report:DailyReport):string{
 const v=volumeRead(report.recentBars??[]);
 if(!v)return '<section class="card block"><h2>거래량·매집/분산</h2><p>거래량 분석에는 25개 이상의 일봉이 필요해요.</p></section>';
 const signed=(n:number)=>(n>0?'+':'')+n.toFixed(1)+'%';
 return `<section class="card block"><h2>거래량·매집/분산</h2><p>투자자별 수급이 없는 코인은 업비트 일봉의 거래량과 종가 위치로 거래 흔적을 읽어요.</p><div class="facts"><div><span class="label">오늘 거래량 / 이전 20일 평균</span><b>${v.ratio1.toFixed(2)}배</b></div><div><span class="label">최근 5일 거래량 / 이전 20일 평균</span><b>${v.ratio5.toFixed(2)}배</b></div><div><span class="label">20일 OBV 흐름</span><b>${signed(v.obvPct)}</b></div><div><span class="label">매집·분산 강도(A/D)</span><b>${(v.adPct??0).toFixed(1)} / 100</b></div><div><span class="label">20일 VWAP 대비</span><b>${signed(v.vwapGapPct)}</b></div></div><h3>${v.flow==='ACCUM'?'매집과 비슷한 흔적':v.flow==='DIST'?'분산과 비슷한 흔적':'뚜렷한 매집·분산 괴리 없음'}</h3><p class="fine">데이터 기준 ${report.recentBars?.at(-1)?.date??report.date}. 실제 매수자·매도자의 신원을 뜻하지 않아요. A/D는 거래량이 많은 날 종가가 일중 범위의 어디에서 끝났는지, OBV는 상승·하락일 거래량의 방향을 비교합니다.</p></section>`;
}
