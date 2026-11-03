// G-313: checks the design rules (src/report/designRules.ts) that a browser can measure, on the built site/ at 390px.
// Run after check-ui (npm run test:ui), which renders site/. No network: gnm-api calls are blocked.
// Rules checked: 1 (no orange accent, white light ground), 3 (no tab row at the top), 4 (✦ rightmost in the bottom bar),
// 5 (home banner at least 150px tall), 9 (bold only for a minority of first-screen text), 12 (no buy/sell/guarantee words).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('site');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try { const body = await readFile(join(root, path.endsWith('/') ? path + 'index.html' : path)); res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
}).listen(8766);
const origin = 'http://localhost:8766/';
const PAGES = (process.env.RULE_PAGES ?? 'index.html,005930/index.html,screener.html,scorecard.html,reports.html,pricing.html,settings.html,themes.html,updates.html').split(',');
const BANNED = /사세요|파세요|매수하세요|매도하세요|수익(을)? 보장|원금 보장|무조건 오르/;

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const problems = [];
for (const path of PAGES) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await page.route(/workers\.dev|gnm-api/, (r) => r.abort());
  await page.addInitScript(() => { try { for (const k of ['gnm-tour-done', 'gnm-tour-welcome', 'gnm-tour-stockhint']) localStorage.setItem(k, '1'); localStorage.setItem('gnm-theme', 'light'); } catch {} });
  await page.goto(origin + path, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const found = await page.evaluate(() => {
    const out = [];
    const vis = (e) => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0; };
    const inBar = (e) => !!e.closest('.bottom-nav,.nav-parts,dialog,[role=dialog]');
    // 1: the light ground is white, and nothing is orange.
    if (document.documentElement.getAttribute('data-theme') === 'light') { const bg = getComputedStyle(document.body).backgroundColor; if (!/rgb\(255, 255, 255\)|rgba\(0, 0, 0, 0\)/.test(bg)) out.push(`1 바탕이 흰색이 아니에요 (${bg})`); }
    const orange = (c) => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)/); if (!m) return false; const [r, g, b] = [+m[1], +m[2], +m[3]]; return r > 200 && g > 90 && g < 190 && b < 80; };
    for (const e of document.querySelectorAll('#main *')) { if (!vis(e) || e.closest('svg,canvas,img,.chart-card,.rh-chart')) continue; const s = getComputedStyle(e); if (orange(s.color) || orange(s.backgroundColor)) { out.push(`1 주황색: <${e.tagName.toLowerCase()} class="${e.className}">`); break; } }
    // 3: no tab row in the top of the page.
    for (const e of document.querySelectorAll('[role=tablist],.top-tabs,.seg-tabs')) { if (!vis(e) || inBar(e)) continue; const r = e.getBoundingClientRect(); if (r.top < 160 && e.querySelectorAll('[role=tab],a,button').length >= 2) out.push(`3 위쪽 탭: ${e.className || e.getAttribute('aria-label')}`); }
    // 4: ✦ is the rightmost thing in the bottom bar.
    const nav = document.querySelector('.bottom-nav'), spark = nav && [...nav.querySelectorAll('.nav-spark,.nav-ask-r')].find(vis);
    if (nav && vis(nav)) { if (!spark) out.push('4 아래 바에 ✦가 없어요'); else { const sx = spark.getBoundingClientRect().right; const right = Math.max(...[...nav.querySelectorAll('a,button')].filter(vis).map((b) => b.getBoundingClientRect().right)); if (right > sx + 1) out.push('4 ✦가 맨 오른쪽이 아니에요'); } }
    // 5: the home banner stays big.
    const bn = document.querySelector('.hm-bn .bn-slide, .hm-bn .banner');
    if (bn && vis(bn) && bn.getBoundingClientRect().height < 150) out.push(`5 배너 높이 ${Math.round(bn.getBoundingClientRect().height)}px`);
    // 9: bold is a minority of the first screen's text.
    let all = 0, bold = 0;
    const walk = document.createTreeWalker(document.querySelector('#main') || document.body, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { const t = walk.currentNode, el = t.parentElement, n = t.textContent.trim().length; if (!n || !el || el.closest("svg") || !vis(el) || inBar(el)) continue; const r = el.getBoundingClientRect(); if (r.top > innerHeight || r.bottom < 0) continue; all += n; if (+getComputedStyle(el).fontWeight >= 600) bold += n; }
    if (all > 80 && bold / all > 0.5) out.push(`9 첫 화면 굵은 글 ${Math.round((bold / all) * 100)}%`);
    return { out, text: document.body.innerText };
  });
  const words = found.text.match(BANNED); if (words) found.out.push(`12 금지 문구: ${words[0]}`);
  for (const o of found.out) problems.push(`${path}: ${o}`);
  await page.close();
}
await browser.close(); server.close();
if (problems.length) { console.log(problems.join('\n')); process.exitCode = 1; }
else console.log(`Design rules passed on ${PAGES.length} pages (1 3 4 5 9 12).`);
