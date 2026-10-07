// The stock's themes as chips under its name (G-99). No imports: the shared shell pulls this in.
// Only the first few show; a "+N" chip expands the rest (and folds them back).

/** On stock pages: the stock's themes as chips under the name (theme-index.json, small). */
export const THEME_CHIPS_JS = `
(function () {
  var star = document.querySelector('.hero .star, #sp-star'); if (!star) return;
  var base = document.body.getAttribute('data-base') || '', SHOW = 3;
  var go = function () {
    var sym = star.getAttribute('data-star'); if (!sym || document.querySelector('.theme-chips')) return;
    fetch(base + 'theme-index.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (idx) {
      var t = idx[sym]; if (!t || !t.length || document.querySelector('.theme-chips')) return;
      var row = document.createElement('div'); row.className = 'theme-chips';
      row.innerHTML = '<span>테마</span>' + t.map(function (x, i) { return '<a' + (i >= SHOW ? ' class="tc-more" hidden' : '') + ' href="' + base + 'themes.html#' + encodeURIComponent(x[0]) + '">' + String(x[1]).replace(/[&<>"]/g, '') + '</a>'; }).join('') +
        (t.length > SHOW ? '<button type="button" class="tc-toggle" aria-expanded="false">+' + (t.length - SHOW) + '</button>' : '');
      var btn = row.querySelector('.tc-toggle');
      if (btn) btn.onclick = function () { var open = btn.getAttribute('aria-expanded') !== 'true'; btn.setAttribute('aria-expanded', String(open)); btn.textContent = open ? '접기' : '+' + (t.length - SHOW); row.querySelectorAll('.tc-more').forEach(function (a) { a.hidden = !open; }); };
      var h = star.closest('.h1-row'); (h || star).after(row);
    }).catch(function () {});
  };
  go(); setTimeout(go, 1500);
})();`;
export const THEME_CHIPS_CSS = `.theme-chips{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin:6px 0 4px}.theme-chips span{font-size:11px;font-weight:800;color:var(--muted);margin-right:2px}.theme-chips a,.theme-chips button{font:inherit;font-size:11.5px;font-weight:600;border:0;border-radius:999px;padding:3px 8px;text-decoration:none;color:var(--fg2);background:#eef1f6;max-width:12em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}.theme-chips a[hidden]{display:none}.theme-chips a:hover{background:#e3e8f1}.theme-chips .tc-toggle{color:var(--navy);font-weight:800;background:transparent;border:1px dashed var(--line-strong)}`;
