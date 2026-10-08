// Live-site audit (phase 1): opens the deployed pages in a real browser at phone and desktop widths and
// prints what looks broken — duplicated sections, sideways overflow, script errors, loading lines that never
// finish, empty cards, broken images. Read-only, no login, nothing personal in the output.
import { chromium } from 'playwright';

const BASE = (process.env.SITE ?? 'https://hanul442.github.io/gnomon_analytics/').replace(/\/?$/, '/');
const PAGES = (process.env.PAGES ?? [
  'index.html', 'reports.html', 'market-reports.html', 'themes.html', 'signals.html', 'screener.html',
  '005930/index.html', '005930/index.html#tab-technical', '005930/index.html#tab-ai', '005930/index.html#tab-fundamentals', '005930/index.html#tab-news',
  '000660/index.html', 'stock.html?c=015760', 'stock.html?c=015760#tab-fundamentals', 'coin.html?m=KRW-BTC', 'guide.html', 'pricing.html',
  'us.html?s=AAPL.O', 'us.html?s=NVDA.O', 'screener.html#us', 'screener.html#coin', 'watch.html', 'inbox.html', 'alerts.html', 'updates.html', 'scorecard.html',
].join(',')).split(',');
const WIDTHS = [390, 1280];
// Logged-in passes: {plan: session token} for throwaway audit accounts the workflow creates (never real users).
const SESSIONS = JSON.parse(process.env.AUDIT_SESSIONS || '{}');
const LOGGED = (process.env.LOGGED_PAGES ?? [
  'index.html', 'pricing.html', 'myreports.html', 'mydebates.html', 'alerts.html', 'screener.html', 'reports.html',
  '000660/index.html', '000660/index.html#tab-ai', '005930/index.html#tab-ai', 'stock.html?c=015760', 'stock.html?c=015760#tab-ai', 'coin.html?m=KRW-BTC',
].join(',')).split(',');

const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
let problems = 0;
// The newest market daily, found from its list page.
try {
  const p = await browser.newPage(); await p.goto(BASE + 'market-reports.html', { waitUntil: 'domcontentloaded' });
  const href = await p.locator('.mi-card').first().getAttribute('href').catch(() => null); if (href) PAGES.push(href); await p.close();
} catch { /* the list itself is audited below */ }

async function pass(label, pages, widths, session) {
 for (const width of widths) for (const path of pages) {
  const page = await browser.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  page.on('console', (m) => { if (m.type() === 'error' && !/api\.upbit\.com\/websocket.*429/.test(m.text())) errors.push(m.text().slice(0, 160)); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon|\/events|\/me\b/.test(r.url())) errors.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 100)}`); });
  await page.addInitScript((s) => { try { localStorage.setItem('gnm-tour-done', '1'); sessionStorage.setItem('gnm-ad-x', '1'); sessionStorage.setItem('gnm-nudge', '1'); if (s) localStorage.setItem('gnm-session', s); } catch {} }, session || '');
  try { await page.goto(BASE + path, { waitUntil: 'load', timeout: 45000 }); } catch (e) { console.log(JSON.stringify({ as: label, width, path, fatal: String(e).slice(0, 160) })); problems++; await page.close(); continue; }
  const hash = path.split('#')[1]; if (hash) await page.locator(`a[href="#${hash}"]`).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(session ? 7000 : 9000);
  const found = await page.evaluate(() => {
    const vis = (e) => !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length) && getComputedStyle(e).visibility !== 'hidden';
    const out = {};
    const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
    const dupIds = Object.keys(ids).filter((k) => ids[k] > 1); if (dupIds.length) out.duplicateIds = dupIds.slice(0, 10);
    const heads = {}; document.querySelectorAll('h1,h2,h3').forEach((e) => { if (!vis(e)) return; const t = e.textContent.trim().replace(/\s+/g, ' ').slice(0, 40); if (t) heads[t] = (heads[t] || 0) + 1; });
    const dupHeads = Object.keys(heads).filter((k) => heads[k] > 1); if (dupHeads.length) out.duplicateHeadings = dupHeads.slice(0, 10);
    if (document.documentElement.scrollWidth > innerWidth + 1) {
      out.overflowPx = document.documentElement.scrollWidth - innerWidth;
      out.overflowBy = [...document.querySelectorAll('body *')].filter((e) => vis(e) && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('[style*="overflow"], .chips, .seg, .hz-row, .moms, .pe-strip, .pe-themes, .market-thermals, .table-wrap, .ix-row, .mk-ix, .flt-list'))
        .slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')}`);
    }
    const stuck = [...document.querySelectorAll('p,span,div,li,td,small')].filter((e) => !e.children.length && vis(e) && /불러오는 중|준비하고 있어요|계산 중/.test(e.textContent) && e.textContent.length < 40).map((e) => e.textContent.trim());
    if (stuck.length) out.stuckLoading = [...new Set(stuck)].slice(0, 6);
    const empty = [...document.querySelectorAll('.card')].filter((e) => vis(e) && !e.textContent.trim() && !e.querySelector('canvas,svg,img'));
    if (empty.length) out.emptyCards = empty.length;
    const imgs = [...document.querySelectorAll('img')].filter((i) => vis(i) && i.complete && !i.naturalWidth).map((i) => i.getAttribute('src'));
    if (imgs.length) out.brokenImages = imgs.slice(0, 5);
    const per = document.querySelector('#peers .pe-per'); if (per && vis(per) && /불러오|못했|모자라/.test(per.textContent)) out.peersPer = per.textContent.trim().slice(0, 60);
    const seats = document.querySelectorAll('#tab-ai .parliament, #tab-ai [data-parliament]').length; if (seats > 1) out.aiParliaments = seats;
    const debates = document.querySelectorAll('#tab-ai #debate').length; if (debates > 1) out.aiDebates = debates;
    // G-144 intent checks: what the owner asked to avoid. Small tap targets on phones, pop-ups over the page,
    // old or raw wording, cards full of 없음, very long screens.
    if (innerWidth < 800) {
      const small = [...document.querySelectorAll('a[href], button, [role=tab], select, input:not([type=hidden])')].filter((e) => {
        if (!vis(e) || e.closest('p, li > small, .fine, footer, .price-bar, .tr-tip, [hidden]')) return false;
        const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 32 || r.width < 32) && r.bottom > 0;
      }).map((e) => (e.getAttribute('aria-label') || e.textContent || e.className).trim().replace(/\s+/g, ' ').slice(0, 18));
      if (small.length > 3) out.smallTargets = { n: small.length, eg: [...new Set(small)].slice(0, 8) };
    }
    const pops = [...document.querySelectorAll('[role=dialog], dialog[open], [class*="pop"]')].filter((e) => {
      if (!vis(e)) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
      return (cs.position === 'fixed' || cs.position === 'absolute') && r.width * r.height > innerWidth * innerHeight * 0.15;
    }).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')}`);
    if (pops.length) out.popups = pops.slice(0, 4);
    const text = document.body.innerText;
    const words = [/상승 구조|하락 구조|상승 시나리오|하락 시나리오/, /\b(BULLISH|BEARISH|NEUTRAL|WITHHELD|ACCUMULATION_LIKE|DISTRIBUTION_LIKE|UNKNOWN)\b/, /\bNaN\b|undefined|\[object|\bnull\b|Infinity/].flatMap((re) => { const m = text.match(re); return m ? [m[0]] : []; });
    if (words.length) out.wording = words;
    const nones = [...document.querySelectorAll('b, td, span, dd, strong')].filter((e) => vis(e) && !e.children.length && /^(없음|-|—|N\/A)$/.test(e.textContent.trim())).length;
    if (nones > 6) out.manyNone = nones;
    const screens = Math.round(document.documentElement.scrollHeight / innerHeight);
    if (screens > 14) out.longScreens = screens;
    // Logged in: the account must actually be recognised, and paid parts must not leak to plans without access.
    if (document.cookie !== null && localStorage.getItem('gnm-session')) {
      const me = JSON.parse(localStorage.getItem('gnm-me') || 'null');
      if (!me || !me.user) out.notLoggedIn = true;
      if (/로그인이 (필요|끝났)/.test(document.body.innerText)) out.loginMessage = true;
    }
    return out;
  });
  // Sealed committee text must not show for plans that have to unlock it (the audit accounts never unlock).
  if (['free', 'plus', 'alpha'].includes(label)) { const leak = await page.locator('.deep-body:visible').count(); if (leak) found.deepLeak = leak; }
  if (errors.length) found.errors = [...new Set(errors)].slice(0, 8);
  if (Object.keys(found).length) { problems++; console.log(JSON.stringify({ as: label, width, path, ...found })); }
  await page.close();
}
}

await pass('anon', PAGES, WIDTHS, '');
for (const [plan, token] of Object.entries(SESSIONS)) await pass(plan, LOGGED, plan === 'alpha' ? WIDTHS : [390], token);
await browser.close();
console.log(`audit done: ${problems} page-width pairs with findings`);
