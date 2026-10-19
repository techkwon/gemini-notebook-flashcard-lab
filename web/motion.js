// Notebook Lab motion engine: WebGL aurora + Canvas2D particles, pointer effects,
// scroll choreography. Dependency-free. Content never depends on this module.
const STORE_KEY = 'notebook-lab:motion';
const mqReduce = matchMedia('(prefers-reduced-motion: reduce)');
const mqCoarse = matchMedia('(pointer: coarse)');
const mqHover = matchMedia('(hover: hover) and (pointer: fine)');

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
const FRAG = `precision mediump float;
uniform vec2 uRes;uniform float uTime;uniform vec2 uPtr;uniform float uPtrS;uniform vec4 uRip[4];
float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n(p);p=m*p;a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/uRes;float ar=uRes.x/uRes.y;vec2 p=vec2(uv.x*ar,uv.y);
 vec2 m=vec2(uPtr.x*ar,uPtr.y);vec2 d=p-m;float dist=length(d);
 p-=d*exp(-dist*dist*6.)*uPtrS*.3;
 float ring=0.;
 for(int i=0;i<4;i++){vec4 r=uRip[i];float age=uTime-r.z;
  if(r.w>0.&&age>0.&&age<3.){vec2 rp=vec2(r.x*ar,r.y);float rd=length(p-rp);float k=rd-age*.42;
   float w=sin(k*38.)*exp(-abs(k)*16.)*(1.-age/3.)*r.w;p+=normalize(p-rp+1e-4)*w*.006;ring+=w;}}
 float t=uTime*.035;
 vec2 q=vec2(fbm(p*1.5+t),fbm(p*1.5+vec2(5.2,1.3)-t));
 float a=fbm(p*1.3+q*1.4+vec2(t*.7,-t*.4));
 float band=1.-smoothstep(.0,.2,abs(uv.y-.62-.18*sin(p.x*1.7+t*3.+q.x*2.)));
 vec3 col=vec3(.969,.973,.988);
 col=mix(col,vec3(.80,.76,.96),smoothstep(.38,.85,a)*.55);
 col=mix(col,vec3(.83,.91,.85),smoothstep(.5,.9,q.x)*.22);
 col=mix(col,vec3(.99,.88,.81),smoothstep(.52,.95,q.y)*.2);
 col=mix(col,vec3(.78,.74,.97),band*.28);
 col=mix(col,vec3(.87,.84,1.),exp(-dist*dist*8.)*.35*uPtrS);
 col+=ring*.014+(h(gl_FragCoord.xy)-.5)*.01;
 gl_FragColor=vec4(col,1.);}`;

export function initMotion(data) {
  const root = document.documentElement;
  const toggle = document.querySelector('#motion-toggle');
  const S = {
    enabled: false, engine: 'none', frameCount: 0, particleCount: 0, dpr: 1,
    running: false, hidden: document.hidden, raf: 0, last: 0, t0: performance.now(),
    ptr: { x: innerWidth / 2, y: innerHeight / 2, nx: .5, ny: .5, s: 0, active: false },
  };
  const coarse = () => mqCoarse.matches || !mqHover.matches;
  const lowPower = () => coarse() || innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
  const capDpr = () => Math.min(devicePixelRatio || 1, lowPower() ? 1.25 : 1.75);
  const cleanups = [];
  const on = (el, ev, fn, opt = { passive: true }) => { el.addEventListener(ev, fn, opt); cleanups.push(() => el.removeEventListener(ev, fn, opt)); };

  // ---------- preference ----------
  const readPref = () => { try { return localStorage.getItem(STORE_KEY); } catch { return null; } };
  const writePref = v => { try { localStorage.setItem(STORE_KEY, v); } catch { /* storage unavailable */ } };
  const stored = readPref();
  let initial = stored === 'on' ? true : stored === 'off' ? false : !mqReduce.matches;

  // ---------- ambient: WebGL with Canvas2D fallback ----------
  let bg = document.querySelector('#ambient-canvas');
  let gl = null, prog = null, U = {}, ctx2d = null;
  const ripples = [[0, 0, -9, 0], [0, 0, -9, 0], [0, 0, -9, 0], [0, 0, -9, 0]];
  const rippleUniform = new Float32Array(16);
  let ripIdx = 0;
  function initGL() {
    if (!bg) return false;
    try {
      gl = bg.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
      if (!gl) return false;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      for (const k of ['uRes', 'uTime', 'uPtr', 'uPtrS', 'uRip']) U[k] = gl.getUniformLocation(prog, k);
      return true;
    } catch (e) { console.warn('[motion] WebGL unavailable', e); gl = null; return false; }
  }
  if (initGL()) {
    S.engine = 'webgl';
    on(bg, 'webglcontextlost', e => { e.preventDefault(); S.engine = 'lost'; }, false);
    on(bg, 'webglcontextrestored', () => { if (initGL()) { S.engine = 'webgl'; sizeAll(); drawFrame(performance.now()); } });
  } else if (bg) {
    const freshCanvas = bg.cloneNode(false); bg.replaceWith(freshCanvas); bg = freshCanvas;
    if ((ctx2d = bg.getContext('2d'))) S.engine = 'canvas2d';
  }

  function drawAmbient(time) {
    if (S.engine === 'webgl' && gl) {
      gl.viewport(0, 0, bg.width, bg.height);
      gl.uniform2f(U.uRes, bg.width, bg.height); gl.uniform1f(U.uTime, time);
      gl.uniform2f(U.uPtr, S.ptr.nx, 1 - S.ptr.ny); gl.uniform1f(U.uPtrS, S.ptr.s);
      gl.uniform4fv(U.uRip, rippleUniform);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else if (S.engine === 'canvas2d' && ctx2d) {
      const w = bg.width, h = bg.height;
      ctx2d.fillStyle = '#f7f8fc'; ctx2d.fillRect(0, 0, w, h);
      const blobs = [[.25, .3, '204,198,245'], [.75, .55, '209,231,214'], [.55, .85, '252,224,207']];
      blobs.forEach(([x, y, c], i) => {
        const cx = (x + Math.sin(time * .1 + i * 2) * .06) * w, cy = (y + Math.cos(time * .08 + i) * .05) * h;
        const g = ctx2d.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * .45);
        g.addColorStop(0, `rgba(${c},.75)`); g.addColorStop(1, `rgba(${c},0)`);
        ctx2d.fillStyle = g; ctx2d.fillRect(0, 0, w, h);
      });
    }
  }

  // ---------- particles (Canvas2D constellation) ----------
  let pc = document.querySelector('#particle-canvas');
  if (!pc && bg) {
    pc = document.createElement('canvas'); pc.id = 'particle-canvas'; pc.setAttribute('aria-hidden', 'true');
    Object.assign(pc.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '-1' });
    bg.after(pc);
  }
  const pctx = pc ? pc.getContext('2d') : null;
  let parts = [], lastScroll = scrollY, heroHeight = innerHeight, lastParticleOpacity = null;
  function seedParticles() {
    const budget = Math.round(Math.min(lowPower() ? 28 : 72, innerWidth * innerHeight / 18000));
    parts = Array.from({ length: budget }, () => ({
      x: Math.random() * innerWidth, y: Math.random() * innerHeight, vx: 0, vy: 0,
      ox: (Math.random() - .5) * .25, oy: (Math.random() - .5) * .25, r: 1 + Math.random() * 1.8,
      c: ['101,80,180', '120,160,130', '220,150,120'][Math.random() * 3 | 0],
    }));
    S.particleCount = parts.length;
  }
  function drawParticles(dt, still) {
    if (!pctx) return;
    const d = S.dpr, w = innerWidth, h = innerHeight, p = S.ptr, R = 170;
    pctx.setTransform(d, 0, 0, d, 0, 0);
    if (still) pctx.clearRect(0, 0, w, h);
    else { pctx.globalCompositeOperation = 'destination-out'; pctx.fillStyle = 'rgba(0,0,0,.22)';
      pctx.fillRect(0, 0, w, h); pctx.globalCompositeOperation = 'source-over'; }
    const dy = (scrollY - lastScroll) * .25; lastScroll = scrollY;
    const k = Math.min(dt * 60, 3);
    for (const q of parts) {
      if (!still) {
        const ex = q.x - p.x, ey = q.y - p.y, dd = Math.hypot(ex, ey);
        if (p.active && dd < R && dd > 1) { const f = (1 - dd / R) * .35;
          q.vx += (-ey / dd * f + ex / dd * f * .4) * k; q.vy += (ex / dd * f + ey / dd * f * .4) * k; }
        q.vx = q.vx * .94 + q.ox * .06; q.vy = q.vy * .94 + q.oy * .06;
        q.x += q.vx * k; q.y += q.vy * k - dy;
        if (q.x < -20) q.x = w + 20; else if (q.x > w + 20) q.x = -20;
        if (q.y < -20) q.y = h + 20; else if (q.y > h + 20) q.y = -20;
      }
      pctx.fillStyle = `rgba(${q.c},.55)`; pctx.beginPath(); pctx.arc(q.x, q.y, q.r, 0, 6.283); pctx.fill();
    }
    pctx.lineWidth = .7;
    for (let i = 0; i < parts.length; i++) {
      const a = parts[i];
      for (let j = i + 1; j < parts.length; j++) {
        const b = parts[j], dx = a.x - b.x, dy2 = a.y - b.y, q2 = dx * dx + dy2 * dy2;
        if (q2 < 14400) { pctx.strokeStyle = `rgba(101,80,180,${(1 - q2 / 14400) * .18})`;
          pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(b.x, b.y); pctx.stroke(); }
      }
      if (p.active && !still) { const dx = a.x - p.x, dy3 = a.y - p.y, q3 = dx * dx + dy3 * dy3;
        if (q3 < 32400) { pctx.strokeStyle = `rgba(101,80,180,${(1 - q3 / 32400) * .3})`;
          pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(p.x, p.y); pctx.stroke(); } }
    }
    const opacity = scrollY < heroHeight * .6 ? 1 : .45;
    if (opacity !== lastParticleOpacity) { pc.style.opacity = String(opacity); lastParticleOpacity = opacity; }
  }

  // ---------- sizing ----------
  let lastW = 0, lastH = 0;
  function sizeAll(force) {
    const w = innerWidth, h = innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w; lastH = h; S.dpr = capDpr();
    heroHeight = document.querySelector('#top')?.offsetHeight || h;
    if (bg) { const scale = S.engine === 'webgl' ? (lowPower() ? .4 : .55) : .5;
      bg.width = Math.max(1, Math.round(w * S.dpr * scale)); bg.height = Math.max(1, Math.round(h * S.dpr * scale)); }
    if (pc) { pc.width = Math.round(w * S.dpr); pc.height = Math.round(h * S.dpr); seedParticles(); }
    if (!S.running) drawFrame(performance.now());
  }
  let rsz = 0;
  on(window, 'resize', () => { cancelAnimationFrame(rsz); rsz = requestAnimationFrame(() => {
    resetTilt(tiltEl); tiltEl = null;
    if (magnet) magnet.style.translate = ''; magnet = null;
    sizeAll();
  }); });

  // ---------- pointer, halo, label, magnetic, tilt ----------
  const orb = document.querySelector('.cursor-orb');
  const label = document.querySelector('.cursor-label');
  const halo = { x: S.ptr.x, y: S.ptr.y };
  const labelFor = el => el.closest('[data-hero-card]') ? '뒤집기' : el.closest('[data-evidence]') ? '확대' :
    el.closest('.notebook-card a, .result-notebook-link') ? '열기' : el.closest('[role=tab]') ? '비교' : '';
  let magnet = null, tiltEl = null;
  const baseTf = new WeakMap();
  const base = el => { if (!baseTf.has(el)) { const t = getComputedStyle(el).transform; baseTf.set(el, t === 'none' ? '' : t); } return baseTf.get(el); };
  const resetTilt = el => { if (el) { el.style.removeProperty('transform'); baseTf.delete(el); el.style.removeProperty('--gx'); el.style.removeProperty('--gy'); } };

  on(window, 'pointermove', e => {
    const p = S.ptr; p.x = e.clientX; p.y = e.clientY; p.nx = p.x / innerWidth; p.ny = p.y / innerHeight;
    p.active = e.pointerType === 'mouse'; p.s = 1;
    if (!S.enabled || coarse() || e.pointerType !== 'mouse') { clearPointer(); return; }
    if (orb) orb.style.opacity = '1';
    const t = e.target instanceof Element ? e.target : null;
    const text = t ? labelFor(t) : '';
    if (label) { label.textContent = text || label.textContent; label.classList.toggle('is-visible', !!text); }
    const m = t && t.closest('.magnetic, .button.primary');
    if (magnet && magnet !== m) { magnet.style.translate = ''; }
    magnet = m;
    if (m) { const r = m.getBoundingClientRect();
      m.style.translate = `${(e.clientX - r.left - r.width / 2) * .22}px ${(e.clientY - r.top - r.height / 2) * .3}px`; }
    const tl = t && t.closest('[data-tilt], .evidence-card, .result-card, [data-hero-card]');
    if (tiltEl && tiltEl !== tl) resetTilt(tiltEl);
    tiltEl = tl;
    if (tl) { const r = tl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
      const amt = tl.matches('[data-hero-card]') ? 10 : 6;
      tl.style.transform = `${base(tl)} perspective(900px) rotateX(${-y * amt}deg) rotateY(${x * amt}deg)`;
      tl.style.setProperty('--gx', `${(x + .5) * 100}%`); tl.style.setProperty('--gy', `${(y + .5) * 100}%`); }
  });
  const clearPointer = () => { S.ptr.active = false; if (orb) orb.style.opacity = '0'; if (label) label.classList.remove('is-visible'); resetTilt(tiltEl); tiltEl = null; if (magnet) magnet.style.translate = ''; magnet = null; };
  on(document, 'pointerleave', clearPointer);
  on(window, 'blur', clearPointer);
  on(window, 'pointercancel', clearPointer);
  on(mqCoarse, 'change', clearPointer);
  on(mqHover, 'change', clearPointer);
  on(window, 'pointerdown', e => {
    if (e.pointerType !== 'mouse') clearPointer();
    ripples[ripIdx] = [e.clientX / innerWidth, 1 - e.clientY / innerHeight, (performance.now() - S.t0) / 1000, 1];
    rippleUniform.set(ripples[ripIdx], ripIdx * 4);
    ripIdx = (ripIdx + 1) % 4;
    if (!S.enabled) return;
    const t = e.target instanceof Element && e.target.closest('.button, [data-hero-card], [role=tab], .evidence-card');
    if (t && t.animate) t.animate([{ scale: '1' }, { scale: '.97' }, { scale: '1' }], { duration: 320, easing: 'ease-out' });
  });

  // ---------- floating hero cards (WAAPI on `translate`, keeps base transform) ----------
  let floats = [];
  function startFloats() {
    floats = [...document.querySelectorAll('[data-hero-card], .stage-chip')].map((el, i) =>
      el.animate([{ translate: '0 0' }, { translate: `0 ${i % 2 ? 9 : -11}px` }, { translate: '0 0' }],
        { duration: 5200 + i * 700, iterations: Infinity, easing: 'ease-in-out', delay: -i * 900 }));
    if (S.hidden) floats.forEach(a => a.pause());
  }
  const stopFloats = () => { floats.forEach(a => a.cancel()); floats = []; };

  // ---------- scroll reveals & counters (no pre-hiding) ----------
  const revealSel = '.reveal, .section-kicker, section h2, .section-lead, .stats-strip > div, .pipeline > div, .takeaway-grid article, .edit-comparison article, .evidence-card, .notebook-card, .method-grid > div, .conclusion-line';
  const seen = new WeakSet();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      const el = en.target; io.unobserve(el);
      if (seen.has(el)) continue; seen.add(el); el.classList.add('is-in');
      if (!S.enabled) continue;
      const sib = el.parentElement ? [...el.parentElement.children].indexOf(el) : 0;
      el.animate([{ opacity: 0, translate: '0 28px', filter: 'blur(4px)' }, { opacity: 1, translate: '0 0', filter: 'blur(0)' }],
        { duration: 820, delay: Math.min(sib, 6) * 90, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      el.querySelectorAll?.('[data-count]').forEach(countUp);
      if (el.matches('[data-count]')) countUp(el);
    }
  }, { rootMargin: '0px 0px -8% 0px', threshold: .08 }) : null;
  function observeReveals() {
    if (!io) return;
    document.querySelectorAll(revealSel).forEach(el => {
      if (seen.has(el)) return;
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight && r.bottom > 0) { seen.add(el); el.classList.add('is-in'); } else io.observe(el);
    });
  }
  function countUp(el) {
    const target = Number(el.dataset.count); if (!Number.isFinite(target)) return;
    const start = performance.now(), dur = 1200 + target * 6;
    const step = now => { const k = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = String(Math.round(target * e)); if (k < 1 && S.enabled) requestAnimationFrame(step); else el.textContent = String(target); };
    requestAnimationFrame(step);
  }

  // ---------- round change data transitions ----------
  on(document, 'lab:roundchange', () => {
    clearPointer();
    observeReveals();
    if (!S.enabled) return;
    document.querySelectorAll('#round-results [data-result-card]').forEach((c, i) => {
      c.animate([{ opacity: 0, translate: '0 22px', scale: '.97' }, { opacity: 1, translate: '0 0', scale: '1' }],
        { duration: 640, delay: i * 80, easing: 'cubic-bezier(.2,1.3,.4,1)', fill: 'backwards' });
      c.querySelectorAll('.metric-track i').forEach(b => b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
        { duration: 900, delay: 160 + i * 80, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    });
    document.querySelector('#round-story')?.animate([{ opacity: 0, translate: '0 10px' }, { opacity: 1, translate: '0 0' }], { duration: 420, easing: 'ease-out' });
  });

  // ---------- scroll progress ----------
  const bar = document.querySelector('.scroll-progress');
  function progress() {
    if (!bar) return;
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = '100%'; bar.style.transformOrigin = '0 50%';
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
  }
  let sTick = 0;
  on(window, 'scroll', () => { clearPointer(); if (!sTick) sTick = requestAnimationFrame(() => { sTick = 0; progress(); }); });

  // ---------- main loop ----------
  function drawFrame(now, dt = 0) {
    const time = (now - S.t0) / 1000;
    drawAmbient(time); drawParticles(dt, !S.running);
    if ((S.engine === 'webgl' && gl) || (S.engine === 'canvas2d' && ctx2d) || pctx) S.frameCount++;
  }
  function loop(now) {
    S.raf = requestAnimationFrame(loop);
    const minGap = lowPower() ? 1000 / 30 - 2 : 1000 / 60 - 2;
    if (now - S.last < minGap) return;
    const dt = Math.min(.1, (now - (S.last || now)) / 1000); S.last = now;
    S.ptr.s *= .985;
    if (orb && !coarse()) {
      halo.x += (S.ptr.x - halo.x) * .14; halo.y += (S.ptr.y - halo.y) * .14;
      orb.style.transform = `translate3d(${halo.x}px, ${halo.y}px, 0) translate(-50%, -50%)`;
      if (label) label.style.transform = `translate3d(${S.ptr.x + 18}px, ${S.ptr.y + 18}px, 0)`;
    }
    drawFrame(now, dt);
  }
  const start = () => { if (S.running || S.hidden || !S.enabled) return; S.running = true; S.last = 0; S.raf = requestAnimationFrame(loop); };
  const stop = () => { S.running = false; cancelAnimationFrame(S.raf); S.raf = 0; };
  on(document, 'visibilitychange', () => { S.hidden = document.hidden; root.dataset.motionPaused = String(S.hidden);
    if (S.hidden) { stop(); floats.forEach(a => a.pause()); }
    else if (S.enabled) { floats.forEach(a => a.play()); start(); } });

  // ---------- enable / disable ----------
  function setEnabled(v, persist = true) {
    S.enabled = !!v; root.dataset.motion = S.enabled ? 'on' : 'off';
    root.classList.toggle('has-fine-pointer', !coarse());
    if (persist) writePref(S.enabled ? 'on' : 'off');
    if (toggle) { toggle.setAttribute('aria-pressed', String(S.enabled)); toggle.removeAttribute('aria-label'); toggle.textContent = S.enabled ? '모션 켜짐' : '모션 꺼짐'; toggle.title = S.enabled ? '클릭하여 모션 끄기' : '클릭하여 모션 켜기'; }
    const showFollower = S.enabled && !coarse();
    if (orb) orb.style.display = showFollower ? 'block' : '';
    if (label) { label.style.display = showFollower ? 'block' : ''; if (!showFollower) label.classList.remove('is-visible'); }
    if (S.enabled) { stopFloats(); startFloats(); start(); }
    else {
      stop(); stopFloats(); resetTilt(tiltEl); tiltEl = null;
      if (magnet) magnet.style.translate = ''; magnet = null;
      document.getAnimations?.().forEach(a => { try { if (a.effect?.getTiming?.().iterations === Infinity) a.cancel(); else a.finish?.(); } catch { a.cancel(); } });
      document.querySelectorAll('[data-count]').forEach(el => { el.textContent = el.dataset.count; });
      drawFrame(performance.now());
    }
  }
  if (toggle) on(toggle, 'click', () => setEnabled(!S.enabled), false);
  on(mqReduce, 'change', () => { if (readPref() === null) setEnabled(!mqReduce.matches, false); });

  // ---------- boot ----------
  try {
    root.dataset.motionPaused = String(S.hidden);
    sizeAll(true); progress(); observeReveals();
    setEnabled(initial, false);
  } catch (e) {
    console.warn('[motion] disabled after error', e);
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('is-in'));
  }

  const api = {
    get enabled() { return S.enabled; }, get engine() { return S.engine; }, get frameCount() { return S.frameCount; },
    get particleCount() { return S.particleCount; }, get dpr() { return S.dpr; },
    get running() { return S.running; }, get reducedMotion() { return mqReduce.matches; }, get coarsePointer() { return coarse(); },
    get rounds() { return data?.rounds ?? window.__LAB_DATA__?.rounds ?? null; },
    setEnabled: v => setEnabled(v, true),
    destroy() { stop(); stopFloats(); io?.disconnect(); cancelAnimationFrame(rsz); cancelAnimationFrame(sTick); cleanups.forEach(f => f()); },
  };
  window.__LAB_MOTION__ = api;
  return api;
}
