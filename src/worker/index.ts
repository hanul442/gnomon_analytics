// Cloudflare Worker entry (wrangler.toml). Wires the real clock, fetch and Anthropic client into the API.

import Anthropic from '@anthropic-ai/sdk';
import { handle, runAlerts, runIntraday, type Env } from './api.js';
import { writeCommentary } from '../analysis/commentary.js';
import { runReportJob } from './reports.js';
import { runDailyNotify, runPriceAlerts, runUpdateNotify } from './notify.js';
import type { AskClient } from './ask.js';

export default {
  async fetch(req: Request, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response> {
    return handle(req,env,dependencies(env,ctx));
  },
  async queue(batch: { messages: { body: {id:string}; ack():void; retry():void }[] }, env: Env): Promise<void> {
    const deps=dependencies(env);
    for(const message of batch.messages){try{await runReportJob(env.DB,message.body.id,deps);message.ack();}catch{message.retry();}}
  },
  /** Cron (wrangler.toml): screener alerts after the site's daily build. */
  async scheduled(event: { cron: string }, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<void> {
    const deps = { now: () => new Date(), fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init) };
    const nctx = { db: env.DB, fetch: deps.fetch, site: env.SITE_URL, now: deps.now() };
    // Every 10 minutes: the intraday scan (session only) and price alerts; the evening triggers: screener alerts and the daily report note.
    const job = event.cron.startsWith('*/10')
      ? Promise.all([runIntraday(env, deps), runPriceAlerts(nctx), runUpdateNotify(nctx)])
      : Promise.all([runAlerts(env, deps), runDailyNotify(nctx)]);
    ctx.waitUntil(job.then((r) => console.log(event.cron, JSON.stringify(r))));
  },
};

function dependencies(env: Env, ctx?: {waitUntil(p:Promise<unknown>):void}) {
 const client=env.ANTHROPIC_API_KEY?new Anthropic({apiKey:env.ANTHROPIC_API_KEY,maxRetries:0,timeout:180000}):undefined;
 const ai:AskClient|undefined=client?{
  create:params=>client.messages.create(params as never) as never,
  stream:async(params,onText)=>{const stream=client.messages.stream(params as never);stream.on('text',onText);return await stream.finalMessage() as never;}
 }:undefined;
 // Report jobs run in the queue consumer (up to 15 minutes): give the streamed committee call room to finish.
 const reportClient=env.ANTHROPIC_API_KEY?new Anthropic({apiKey:env.ANTHROPIC_API_KEY,maxRetries:0,timeout:600000}):undefined;
 return {site:env.SITE_URL,now:()=>new Date(),fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,init),...(env.EDGAR_CONTACT?{edgarContact:env.EDGAR_CONTACT}:{}),...(ai?{ai}:{}),...(reportClient?{generate:(report:import('../report/dailyReport.js').DailyReport)=>writeCommentary(report,{client:reportClient})}:{}),...(ctx?{waitUntil:(p:Promise<unknown>)=>ctx.waitUntil(p)}:{})};
}
