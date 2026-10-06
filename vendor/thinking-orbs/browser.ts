// DOM adapter for the MIT Thinking Orbs engine. No React runtime required.
import { MODE_DRAWS } from './engine/registry';
import { resolvePreset } from './presets';
import type { OrbState } from './types';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const mounted = new Map<HTMLCanvasElement, { visible: boolean }>();
const io = new IntersectionObserver(entries => entries.forEach(e => { const m = mounted.get(e.target as HTMLCanvasElement); if (m) m.visible = e.isIntersecting; }));
function scan() {
  document.querySelectorAll<HTMLCanvasElement>('canvas[data-orb]').forEach(c => { if (!mounted.has(c)) { mounted.set(c, { visible: true }); io.observe(c); } });
  // Replace the old three-dot markup too: one engine across every existing loading surface.
  document.querySelectorAll<HTMLElement>('.orbs:not(:has(canvas))').forEach(e => {
    e.innerHTML = '<canvas data-orb="working" width="40" height="40" aria-hidden="true"></canvas>';
  });
}
let last = 0;
function loop(t: number) {
  if (t - last > 32 && document.visibilityState !== 'hidden') {
    last = t;
    for (const [c, m] of mounted) {
      if (!c.isConnected) { io.unobserve(c); mounted.delete(c); continue; }
      if (!m.visible || c.closest('[hidden]')) continue;
      const size = c.dataset.size === '64' || c.closest('.orbs-load') ? 64 : 20;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      if (c.width !== size * dpr) { c.width = size * dpr; c.height = size * dpr; }
      const ctx = c.getContext('2d'); if (!ctx) continue;
      const state = (c.dataset.orb || 'working') as OrbState;
      const preset = resolvePreset(state in { working:1, searching:1, solving:1, listening:1, connecting:1, weaving:1, composing:1, breathing:1, shaping:1 } ? state : 'working', size);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
      const dark = !!c.closest('[data-theme="dark"], .dark');
      if (!reduced.matches || !c.dataset.static) MODE_DRAWS[preset.mode](ctx, size, reduced.matches ? .6 : t / 1000 * preset.speed, dark, preset.opts);
      c.dataset.static = '1';
    }
  }
  requestAnimationFrame(loop);
}
new MutationObserver(scan).observe(document.documentElement, { childList:true, subtree:true });
reduced.addEventListener('change', () => mounted.forEach((_, c) => delete c.dataset.static));
scan(); requestAnimationFrame(loop);
