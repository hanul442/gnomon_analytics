import type { PriceBar } from '../types.js';
import { buildDailyReport } from './dailyReport.js';
import { buildMarketSection } from './marketSection.js';
import { renderReport } from './renderHtml.js';

/** Identical report template, using available prices without fabricating AI commentary. */
export function renderCalculationPage(input: {symbol:string;name:string;kind?:'etf'|'coin';bars:readonly PriceBar[];now:Date}):string {
  const date=input.bars.at(-1)?.date??new Date(input.now.getTime()+9*3600000).toISOString().slice(0,10);
  const report=buildDailyReport({symbol:input.symbol,name:input.name,...(input.kind?{kind:input.kind}:{}),date,generatedAt:input.now,bars:input.bars,disclosures:[],sources:[]});
  report.market=buildMarketSection({symbol:input.symbol,date,generatedAt:input.now,daily:input.bars,weekly:[],intraday:[],flows:[],snapshots:[],finance:[],research:[],benchmarks:[],loggedForecasts:[],status:[],calculationOnly:true});
  return renderReport(report,{index:'../index.html',base:'../',live:true}).replaceAll('최근 7일 관련 뉴스가 없어요.','관련 뉴스 자료가 아직 수집되지 않았어요.').replaceAll('최근 30일 공시가 없어요.','공시 자료가 아직 수집되지 않았어요.');
}
