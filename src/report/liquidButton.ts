// G-185: ThreeUI Community's ShaderButtons "Tactile" (MengTo/threeui, MIT, Copyright (c) 2026 Meng To;
// src/shaders/neuform-isolated/sources/nexus-tactile.html, SHA-256 1811a640…9cb4). Two raw-WebGL pieces are ported
// as authored (shaders, constants, spring and decay rates, pointer and click handling, reduced-motion values):
//  - the liquid button: a lit liquid that tilts toward the pointer, sloshes when swept, and gulps when pressed.
//    GNOMON uses it as the report job's progress: the liquid's resting level is the job's progress instead of the
//    source's fixed 0.56, and each new stage adds a slosh.
//  - the ambient field: the slow dark-liquid background, behind the stock page's loading screen.
// Without WebGL the button keeps its CSS fill and the loading screen its plain background.

/** The button liquid, as ES5 for assets/ui.js: gnmLiquid(button) → { level(v), slosh(n), stop() } or null. */
export const LIQUID_JS = `
(function () {
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    'precision highp float;',
    'uniform vec2 u_res;',
    'uniform float u_time;',
    'uniform float u_level;',
    'uniform float u_tilt;',
    'uniform float u_slosh;',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}',
    'float noise(vec2 p){',
    '  vec2 i=floor(p), f=fract(p);',
    '  vec2 u=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),',
    '             mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),u.x),u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v=0.0; float a=0.5;',
    '  for(int i=0;i<4;i++){ v+=a*noise(p); p=p*2.04+vec2(11.3,7.1); a*=0.5; }',
    '  return v;',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    '  float ar = u_res.x / u_res.y;',
    '  float x = uv.x * ar;',
    '  float t = u_time;',
    '  float amp = 0.012 + u_slosh * 0.045;',
    '  float surf = u_level',
    '    + u_tilt * (uv.x - 0.5) * 0.34',
    '    + amp * sin(x * 5.1 + t * 4.6)',
    '    + amp * 0.62 * sin(x * 9.7 + t * (-6.8) + 1.7)',
    '    + amp * 0.38 * sin(x * 14.3 + t * 8.9 + 4.2);',
    '  float d = surf - uv.y;',
    '  vec3 col = mix(vec3(0.03, 0.06, 0.1), vec3(0.05, 0.09, 0.15), uv.y);',
    '  col += vec3(0.02, 0.05, 0.1) * pow(max(0.0, 1.0 - abs(uv.y - 0.88) * 6.0), 2.0);',
    '  float inside = smoothstep(0.0, 0.012, d);',
    '  float depth = clamp(d / max(u_level, 0.001), 0.0, 1.0);',
    '  vec3 liq = mix(vec3(0.0, 0.9, 1.0), vec3(0.02, 0.15, 0.45), depth);',
    '  float caust = fbm(vec2(x * 4.2, (uv.y + t * 0.14) * 4.2));',
    '  liq *= 0.8 + 0.42 * caust;',
    '  liq += vec3(0.02, 0.25, 0.35) * pow(max(0.0, d * 3.0), 1.5) * u_slosh;',
    '  col = mix(col, liq, inside);',
    '  col += vec3(0.4, 0.9, 1.0) * exp(-abs(d) * 80.0) * 0.85;',
    '  col += vec3(0.8, 0.98, 1.0) * exp(-abs(d) * 220.0) * 0.5;',
    '  vec2 e = uv * (1.0 - uv);',
    '  col *= 0.55 + 0.45 * pow(e.x * e.y * 16.0, 0.22);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\\n');
  var compile = function (gl, type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  window.gnmLiquid = function (btn) {
    if (!btn || btn.__liquid) return btn && btn.__liquid;
    var canvas = document.createElement('canvas'); canvas.className = 'lq-gl'; canvas.setAttribute('aria-hidden', 'true');
    var gl = null; try { gl = canvas.getContext('webgl'); } catch (e) {}
    if (!gl) return null;
    btn.insertBefore(canvas, btn.firstChild); btn.classList.add('has-liquid');
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog); gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var locP = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(locP); gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);
    var uRes = gl.getUniformLocation(prog, 'u_res'), uTime = gl.getUniformLocation(prog, 'u_time'), uLevel = gl.getUniformLocation(prog, 'u_level'), uTilt = gl.getUniformLocation(prog, 'u_tilt'), uSlosh = gl.getUniformLocation(prog, 'u_slosh');
    var resize = function () { var dpr = Math.min(window.devicePixelRatio || 1, 2), w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); } };
    // The source's state: BASE is the resting level (here the job's progress), gulp the press, slosh the stir, tilt the lean.
    var BASE = 0.12, level = BASE, gulp = 0, slosh = 0.4, tilt = 0, tiltTarget = 0, lastX = null, last = performance.now(), raf = 0, alive = true;
    var move = function (e) { var rect = btn.getBoundingClientRect(), cx = e.touches ? e.touches[0].clientX : e.clientX, x = (cx - rect.left) / Math.max(1, rect.width); if (lastX !== null) slosh = Math.min(1.4, slosh + Math.abs(x - lastX) * 2.6); lastX = x; tiltTarget = Math.max(-1, Math.min(1, (x - 0.5) * 2)); };
    var leave = function () { lastX = null; tiltTarget = 0; }, focus = function () { slosh = Math.min(1.4, slosh + 0.5); }, click = function () { gulp = 1; slosh = Math.min(1.4, slosh + 0.7); };
    btn.addEventListener('mousemove', move); btn.addEventListener('touchmove', move, { passive: true }); btn.addEventListener('mouseleave', leave); btn.addEventListener('touchend', leave); btn.addEventListener('focus', focus); btn.addEventListener('click', click);
    var frame = function (now) {
      if (!alive) return;
      var dt = Math.min(0.05, (now - last) / 1000); last = now;
      slosh *= Math.exp(-1.5 * dt); gulp *= Math.exp(-1.1 * dt);
      tilt += (tiltTarget - tilt) * Math.min(1, dt * 5);
      var levelTarget = BASE - 0.36 * gulp * Math.min(1, BASE / 0.56);
      level += (levelTarget - level) * Math.min(1, dt * 5.5);
      resize();
      gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, reduced ? 2.0 : now / 1000);
      gl.uniform1f(uLevel, level); gl.uniform1f(uTilt, tilt); gl.uniform1f(uSlosh, reduced ? 0.25 : slosh);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    var api = {
      level: function (v) { BASE = Math.max(0.06, Math.min(0.94, v)); },
      slosh: function (n) { slosh = Math.min(1.4, slosh + (n || 0.6)); },
      stop: function () { alive = false; cancelAnimationFrame(raf); btn.removeEventListener('mousemove', move); btn.removeEventListener('touchmove', move); btn.removeEventListener('mouseleave', leave); btn.removeEventListener('touchend', leave); btn.removeEventListener('focus', focus); btn.removeEventListener('click', click); var ext = gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); canvas.remove(); btn.classList.remove('has-liquid'); btn.__liquid = null; }
    };
    btn.__liquid = api; return api;
  };

  // The ambient field behind the loading screen (the source's bg-canvas), stopped as soon as the screen goes.
  var host = document.getElementById('page-load'); if (!host) return;
  var canvas = document.createElement('canvas'); canvas.className = 'pl-bg'; canvas.setAttribute('aria-hidden', 'true');
  var gl = null; try { gl = canvas.getContext('webgl'); } catch (e) {} if (!gl) return;
  host.insertBefore(canvas, host.firstChild);
  var vs = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
  var fs = ['precision mediump float;', 'uniform vec2 u_res;', 'uniform float u_time;',
    'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float noise(vec2 p) {', '    vec2 i = floor(p);', '    vec2 f = fract(p);', '    vec2 u = f * f * (3.0 - 2.0 * f);',
    '    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),', '               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);', '}',
    'float fbm(vec2 p) {', '    float v = 0.0, a = 0.5;', '    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.0; a *= 0.5; }', '    return v;', '}',
    'void main() {', '    vec2 uv = gl_FragCoord.xy / u_res;', '    uv.x *= u_res.x / u_res.y;', '    float t = u_time * 0.15;',
    '    vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(1.0) + t));',
    '    vec2 r = vec2(fbm(uv + 1.0*q + vec2(1.7, 9.2) + 0.15*t),', '                  fbm(uv + 1.0*q + vec2(8.3, 2.8) + 0.126*t));',
    '    float f = fbm(uv + r);',
    '    vec3 col = mix(vec3(0.01, 0.02, 0.03), vec3(0.01, 0.04, 0.07), f);', '    col = mix(col, vec3(0.02, 0.07, 0.12), clamp(length(q) * 0.5, 0.0, 1.0));',
    '    vec2 e = gl_FragCoord.xy / u_res * (1.0 - gl_FragCoord.xy / u_res);', '    col *= 0.5 + 0.5 * pow(e.x * e.y * 15.0, 0.3);',
    '    gl_FragColor = vec4(col, 1.0);', '}'].join('\\n');
  var prog = gl.createProgram(); gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs)); gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var locP = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(locP); gl.vertexAttribPointer(locP, 2, gl.FLOAT, false, 0, 0);
  var uRes = gl.getUniformLocation(prog, 'u_res'), uTime = gl.getUniformLocation(prog, 'u_time');
  var resize = function () { var dpr = Math.min(window.devicePixelRatio || 1, 2); canvas.width = window.innerWidth * dpr; canvas.height = window.innerHeight * dpr; gl.viewport(0, 0, canvas.width, canvas.height); };
  window.addEventListener('resize', resize); resize();
  var start = performance.now();
  var render = function (now) {
    if (!host.isConnected || host.classList.contains('out')) { window.removeEventListener('resize', resize); var ext = gl.getExtension('WEBGL_lose_context'); if (ext) setTimeout(function () { ext.loseContext(); }, 400); return; }
    gl.uniform2f(uRes, canvas.width, canvas.height); gl.uniform1f(uTime, (now - start) / 1000); gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(render);
  };
  requestAnimationFrame(render); canvas.classList.add('on');
})();`;

export const LIQUID_CSS = `
.lq-gl{position:absolute;inset:0;width:100%;height:100%;display:block;border-radius:inherit;z-index:0;pointer-events:none}
.has-liquid .job-fill,.has-liquid .job-spin{display:none}
.gen-btn.has-liquid{background-color:#050b11;border-color:rgba(6,182,212,.3)}
.gen-btn.has-liquid .job-main,.gen-btn.has-liquid .job-sub{color:#e0faff;text-shadow:0 1px 10px rgba(0,18,25,.85)}
.pl-bg{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:-1;opacity:0;transition:opacity 2s ease-in-out;pointer-events:none}
.pl-bg.on{opacity:1}
.page-load{isolation:isolate}`;
