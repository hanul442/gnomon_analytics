// G-331 (한서님 11/4 '화면들볼때 이걸로 봐야뎀'): look at screens the Stageshow way (benji.org/stageshow), not from one
// settled screenshot. Each shot opens a live page, does one thing (load, a bottom-bar tap), slows the page down and
// films it as a contact sheet, then reports what a still can't show:
//   hop   — something sitting still moves 1–8px and comes back within a few frames (the "4px hop")
//   snap  — something sitting still jumps 12px+ in one frame (content arriving and shoving the page)
//   blank — a frame where almost nothing is visible (everything faded out at once)
// The sheet is for reading with your eyes; the report only points at frames worth a closer look.
// Read-only, no login. Usage:
//   node scripts/film-ui.mjs                      # default shots at 390 and 1280
//   SHOTS=home,stock WIDTHS=390 SLOW=6 node scripts/film-ui.mjs
//   SITE=http://localhost:8080/ OUT=film-out node scripts/film-ui.mjs
import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const BASE = (process.env.SITE ?? 'https://hanul442.github.io/gnomon_analytics/').replace(/\/?$/, '/');
const OUT = resolve(process.env.OUT ?? 'film-out');
const WIDTHS = (process.env.WIDTHS ?? '390,1280').split(',').map(Number);
const SLOW = Number(process.env.SLOW ?? 4); // the page runs this many times slower while filming
const FRAMES = Number(process.env.FRAMES ?? 24);
const SCENE_MS = Number(process.env.SCENE_MS ?? 1200); // how much page time each shot covers

// One thing happens per shot. `tap` is a selector clicked once the page has settled.
const ALL = {
  home: { path: 'index.html' },
  'home-to-find': { path: 'index.html', tap: '.nav-tabs a[href*="screener"]' },
  stock: { path: '005930/index.html' },
  'stock-chart': { path: '005930/index.html', tap: '.bottom-nav a[href="#tab-chart"]' },
  'stock-company': { path: '005930/index.html', tap: '.bottom-nav a[href="#tab-fundamentals"]' },
  'stock-news': { path: '005930/index.html', tap: '.bottom-nav a[href="#tab-news"]' },
  find: { path: 'screener.html' },
  committee: { path: 'reports.html' },
  me: { path: 'settings.html' },
};
const SHOTS = (process.env.SHOTS ?? Object.keys(ALL).join(',')).split(',').filter((k) => ALL[k]);

// Runs in the page before anything else: slows rAF time, timers and performance.now by SLOW, and records the box of
// every visible element on every real frame while window.__film.on is true.
function instrument(slow) {
  const realNow = performance.now.bind(performance);
  const t0 = realNow();
  const scene = (t) => t0 + (t - t0) / slow;
  performance.now = () => scene(realNow());
  const realDate = Date.now, d0 = realDate();
  Date.now = () => Math.round(d0 + (realDate() - d0) / slow);
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((ts) => cb(scene(ts)));
  const st = window.setTimeout.bind(window);
  window.setTimeout = (fn, ms, ...a) => st(fn, (Number(ms) || 0) * slow, ...a);
  const ids = new WeakMap(); let next = 0;
  const film = (window.__film = { on: false, frames: [], labels: {} });
  const label = (e) => {
    const t = (e.getAttribute('aria-label') || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.classList[0] ? '.' + e.classList[0] : ''}${t ? ` "${t}"` : ''}`;
  };
  const tick = (ts) => {
    if (film.on) {
      const boxes = {}; let shown = 0;
      for (const e of document.querySelectorAll('body *')) {
        if (e.children.length > 3 && !e.matches('svg')) continue; // leaves and small groups: what the eye follows
        if (e.closest('svg') && !e.matches('svg')) continue;
        const r = e.getBoundingClientRect();
        if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) continue;
        const cs = getComputedStyle(e);
        if (cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
        shown++;
        let id = ids.get(e); if (id === undefined) { id = next++; ids.set(e, id); film.labels[id] = label(e); }
        boxes[id] = [r.left + scrollX, r.top + scrollY, r.width, r.height];
      }
      film.frames.push({ t: scene(ts), shown, boxes });
    }
    raf(tick);
  };
  raf(tick);
}

// Hops and snaps from the recorded boxes. Only things that were still for 3 frames count, so a spring settling at the
// end of a real move is not a hop.
function analyse(film) {
  const { frames, labels } = film; const t0 = film.start ?? frames[0]?.t ?? 0; const found = [];
  const at = (i) => frames[i].t - t0;
  const ids = new Set(frames.flatMap((f) => Object.keys(f.boxes)));
  for (const id of ids) {
    const s = frames.map((f) => f.boxes[id]);
    for (let i = 3; i < s.length - 1; i++) {
      if (!s[i] || !s[i - 1] || !s[i - 2] || !s[i - 3]) continue;
      const still = [1, 2].every((k) => Math.abs(s[i - k][0] - s[i - k - 1][0]) < 0.5 && Math.abs(s[i - k][1] - s[i - k - 1][1]) < 0.5);
      if (!still) continue;
      const dx = s[i][0] - s[i - 1][0], dy = s[i][1] - s[i - 1][1], d = Math.hypot(dx, dy);
      if (d < 1) continue;
      if (d >= 12) { found.push({ kind: 'snap', id, t: at(i), px: Math.round(d), dx: Math.round(dx), dy: Math.round(dy) }); continue; }
      if (d <= 8) for (let k = i + 1; k < Math.min(s.length, i + 7); k++) {
        if (s[k] && Math.abs(s[k][0] - s[i - 1][0]) < 0.5 && Math.abs(s[k][1] - s[i - 1][1]) < 0.5) { found.push({ kind: 'hop', id, t: at(i), px: +d.toFixed(1), back: k - i }); break; }
      }
    }
  }
  // A block that moves together is one finding: keep the first element per (kind, frame time, delta).
  const seen = new Map();
  for (const f of found) { const key = `${f.kind}|${Math.round(f.t)}|${f.dx ?? f.px}|${f.dy ?? ''}`; if (!seen.has(key)) seen.set(key, { ...f, what: labels[f.id], n: 0 }); seen.get(key).n++; }
  const most = Math.max(1, ...frames.map((f) => f.shown));
  const blank = frames.filter((f, i) => i > 2 && f.shown < most * 0.15).map((f) => ({ kind: 'blank', t: f.t - t0, shown: f.shown }));
  return [...seen.values(), ...blank].map(({ id, ...f }) => f);
}

async function sheet(browser, files, title, width) {
  const cols = width < 800 ? 6 : 3;
  const imgs = await Promise.all(files.map(async (f) => `data:image/jpeg;base64,${(await readFile(f.file)).toString('base64')}`));
  const cell = width < 800 ? 300 : 600;
  const html = `<body style="margin:0;background:#fff;font:600 13px system-ui"><div style="padding:12px 16px">${title}</div>
<div style="display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;padding:0 16px 16px">${files.map((f, i) => `<figure style="margin:0"><img src="${imgs[i]}" style="width:${cell}px;display:block;border:1px solid #ddd"><figcaption style="color:#666;padding:2px 0">${(f.t / 1000).toFixed(2)}s</figcaption></figure>`).join('')}</div></body>`;
  const p = await browser.newPage({ viewport: { width: cols * (cell + 8) + 24, height: 400 } });
  await p.setContent(html); await p.waitForLoadState('load');
  const path = join(OUT, `${title}.png`); await p.screenshot({ path, fullPage: true }); await p.close();
  return path;
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const report = [];
for (const width of WIDTHS) for (const name of SHOTS) {
  const shot = ALL[name]; const title = `${name}-${width}`;
  const page = await browser.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
  await page.route('**/visit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }));
  await page.addInitScript(() => { try { localStorage.setItem('gnm-tour-done', '1'); localStorage.setItem('gnm-tour-stockhint', '1'); sessionStorage.setItem('gnm-ad-x', '1'); sessionStorage.setItem('gnm-nudge', '1'); } catch {} });
  await page.addInitScript(instrument, SLOW);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable'); await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
  const files = [];
  const roll = async () => {
    const start = Date.now(); const every = (SCENE_MS * SLOW) / FRAMES;
    for (let i = 0; i < FRAMES; i++) {
      const file = join(OUT, `${title}-${String(i).padStart(2, '0')}.jpg`);
      await page.screenshot({ path: file, type: 'jpeg', quality: 70 }).catch(() => {});
      files.push({ file, t: (Date.now() - start) / SLOW });
      const wait = start + (i + 1) * every - Date.now(); if (wait > 0) await page.waitForTimeout(wait);
    }
  };
  try {
    if (shot.tap) {
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
      await page.goto(BASE + shot.path, { waitUntil: 'load', timeout: 45000 }); await page.waitForTimeout(6000);
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
      await page.evaluate(() => { window.__film.on = true; window.__film.start = performance.now(); });
      const el = page.locator(`${shot.tap} >> visible=true`).first();
      // A real finger press at the element's centre (a slowed page never looks 'stable' to Playwright's click).
      const box = await el.boundingBox({ timeout: 4000 });
      if (!box) throw new Error(`nothing to tap: ${shot.tap}`);
      await Promise.all([page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 60 }), roll()]);
    } else {
      const go = page.goto(BASE + shot.path, { waitUntil: 'commit', timeout: 45000 });
      await go; await page.evaluate(() => { window.__film.on = true; }).catch(() => {});
      await roll();
    }
    const film = await page.evaluate(() => window.__film).catch(() => ({ frames: [], labels: {} }));
    const findings = analyse(film);
    const png = await sheet(browser, files, title, width);
    report.push({ shot: name, width, sheet: png, frames: film.frames.length, findings });
    const counts = ['hop', 'snap', 'blank'].map((k) => `${k} ${findings.filter((f) => f.kind === k).length}`).join(', ');
    console.log(`${title}: ${counts} → ${png}`);
    for (const f of findings.slice(0, 8)) console.log(`  ${f.kind} @${(f.t / 1000).toFixed(2)}s ${f.px ?? ''}${f.px ? 'px' : ''} ${f.what ?? ''}${f.n > 1 ? ` (+${f.n - 1} moved with it)` : ''}`);
  } catch (e) { console.log(`${title}: failed ${String(e.message).slice(0, 160)}`); report.push({ shot: name, width, error: String(e.message).slice(0, 300) }); }
  await page.close();
}
await browser.close();
await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
console.log(`film done: ${report.length} shots, sheets and report.json in ${OUT}`);
