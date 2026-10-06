// The stock's themes as chips under its name (G-99). No imports: the shared shell pulls this in.

/** On stock pages: the stock's themes as chips under the name (theme-index.json, small). */
export const THEME_CHIPS_JS = `
(function () {
  var star = document.querySelector('.hero .star, #sp-star'); if (!star) return;
  var base = document.body.getAttribute('data-base') || '';
  var go = function () {
    var sym = star.getAttribute('data-star'); if (!sym || document.querySelector('.theme-chips')) return;
    fetch(base + 'theme-index.json').then(function (r) { return r.ok ? r.json() : {}; }).then(function (idx) {
      var t = idx[sym]; if (!t || !t.length) return;
      var row = document.createElement('div'); row.className = 'theme-chips';
      row.innerHTML = '<span>테마</span>' + t.map(function (x) { return '<a href="' + base + 'themes.html#' + encodeURIComponent(x[0]) + '">' + String(x[1]).replace(/[&<>"]/g, '') + '</a>'; }).join('');
      var h = star.closest('.h1-row'); (h || star).after(row);
    }).catch(function () {});
  };
  go(); setTimeout(go, 1500);
})();`;
export const THEME_CHIPS_CSS = `.theme-chips{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin:6px 0 4px}.theme-chips span{font-size:11.5px;font-weight:800;color:var(--muted)}.theme-chips a{font-size:12px;font-weight:700;border:1px solid var(--line-strong);border-radius:999px;padding:3px 9px;text-decoration:none;color:var(--fg);background:#fff}.theme-chips a:hover{border-color:var(--accent)}`;
