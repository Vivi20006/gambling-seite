/* NOVA intro: a warp-speed starfield, 3D dice / cards / chips flying past the camera and an
   extruded logo that spins in from deep space. Clicking "Enter" punches through into the lobby.
   Plays once per browser session; ?intro in the URL forces it. */
(function () {
  'use strict';
  const root = document.documentElement;
  if (!root.classList.contains('intro-pending')) return;
  const { h } = Nova;

  const LOGO_PATH = 'M12 54V10h10l20 28V10h10v44H42L22 26v28z';
  const LAYERS = 22; // slices that give the logo its depth
  const AUTO_ENTER = 7000;
  let leaving = false;
  let raf = 0;
  const timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const audible = () => { try { return Nova.sfx.live(); } catch (e) { return false; } };
  const play = (name, ...a) => { if (audible()) Nova.sfx[name](...a); };

  /* ---------- DOM ---------- */
  const canvas = h('canvas', { class: 'intro-warp', 'aria-hidden': 'true' });
  const world = h('div', { class: 'intro-world' });
  const scene = h('div', { class: 'intro-scene', 'aria-hidden': 'true' }, world);
  const flash = h('div', { class: 'intro-flash' });
  const shock = h('div', { class: 'intro-shock' });

  // extruded logo: a stack of identical slices, brightest at the front
  const logo = h('div', { class: 'i-logo' });
  for (let i = LAYERS - 1; i >= 0; i--) {
    const front = i === 0;
    const k = i / LAYERS;
    const layer = h('div', {
      class: 'i-layer' + (front ? ' front' : ''),
      style: { transform: `translateZ(${-i * 2.2}px)`, color: front ? '' : `hsl(${270 - k * 8}, ${70 - k * 20}%, ${42 - k * 26}%)` },
      html: `<svg viewBox="0 0 64 64"><path d="${LOGO_PATH}" fill="${front ? 'url(#gLogo)' : 'currentColor'}"/></svg>`,
    });
    logo.append(layer);
  }
  logo.append(h('div', { class: 'i-shine' }));
  // glows are separate soft gradients: blurred shadows on 3D layers get clipped into boxes
  const logoWrap = h('div', { class: 'i-logo-wrap' }, h('div', { class: 'i-glow logo' }), logo);
  const ringA = h('div', { class: 'i-ring a' }, h('i'));
  const ringB = h('div', { class: 'i-ring b' }, h('i'));
  const word = h('div', { class: 'i-word' }, ...'NOVA'.split('').map((ch) => h('span', {}, ch)));
  const tag = h('div', { class: 'i-tag' }, 'SLOTS · BLACKJACK · MINIGAMES');
  world.append(h('div', { class: 'i-glow word' }), ringA, ringB, logoWrap, word, tag);

  const enterBtn = h('button', { class: 'i-enter', type: 'button' }, h('span', {}, 'Enter the lobby'));
  const hint = h('div', { class: 'i-hint' }, 'Click anywhere or press Enter');
  const skip = h('button', { class: 'i-skip', type: 'button' }, 'Skip intro');
  const ui = h('div', { class: 'intro-ui' }, enterBtn, hint);

  const el = h('div', { id: 'intro', class: 'intro', role: 'dialog', 'aria-label': 'NOVA intro' }, canvas, scene, shock, flash, ui, skip);
  document.body.append(el);

  /* ---------- flying 3D props ---------- */
  const PIP = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const FACES = ['translateZ(var(--hs))', 'rotateY(180deg) translateZ(var(--hs))', 'rotateY(90deg) translateZ(var(--hs))', 'rotateY(-90deg) translateZ(var(--hs))', 'rotateX(90deg) translateZ(var(--hs))', 'rotateX(-90deg) translateZ(var(--hs))'];
  function die() {
    const cube = h('div', { class: 'i-die' });
    [1, 6, 3, 4, 5, 2].forEach((n, f) => {
      const face = h('div', { class: 'i-face', style: { transform: FACES[f] } });
      for (let c = 0; c < 9; c++) face.append(h('i', { class: PIP[n].includes(c) ? 'on' : '' }));
      cube.append(face);
    });
    return cube;
  }
  function card(rank, suit, red) {
    return h('div', { class: 'i-card' + (red ? ' red' : '') },
      h('div', { class: 'i-card-front', html: `<b>${rank}</b><i>${suit}</i><span>${suit}</span>` }),
      h('div', { class: 'i-card-back' }));
  }
  function disc(cls, color, label) {
    const d = h('div', { class: 'i-disc ' + cls, style: { '--c': color } });
    for (let i = 0; i < 7; i++) d.append(h('i', { style: { transform: `translateZ(${i * 1.6}px)` } }));
    d.append(h('b', { style: { transform: 'translateZ(11.5px)' } }, label));
    return d;
  }
  const PROPS = [
    () => die(), () => card('A', '♠'), () => disc('chip', '#9333ea', '500'), () => card('K', '♥', true),
    () => disc('coin', '#cfcad9', 'N'), () => die(), () => disc('chip', '#dc2626', '5'), () => card('7', '♦', true),
    () => disc('chip', '#16a34a', '25'), () => card('Q', '♣'), () => die(), () => disc('chip', '#1c1917', '100'),
  ];

  function launch(i) {
    if (leaving) return;
    const prop = PROPS[i % PROPS.length]();
    const holder = h('div', { class: 'i-prop' }, prop);
    world.append(holder);
    // start deep in space, fly outward past the camera so the logo stays clear
    const side = i % 2 ? 1 : -1;
    const x0 = side * (120 + Math.random() * 260);
    const y0 = (Math.random() - 0.5) * 360;
    const x1 = x0 * 4.2;
    const y1 = y0 * 3.2 + (Math.random() - 0.5) * 200;
    const r = () => Math.round(Math.random() * 720 - 360);
    const dur = 1700 + Math.random() * 700;
    const a = holder.animate([
      { transform: `translate3d(${x0}px, ${y0}px, -2600px) rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(${r()}deg)`, opacity: 0 },
      { opacity: 1, offset: 0.15 },
      { opacity: 1, offset: 0.85 },
      { transform: `translate3d(${x1}px, ${y1}px, 760px) rotateX(${r()}deg) rotateY(${r()}deg) rotateZ(${r()}deg)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.55,0,.85,.35)', fill: 'forwards' });
    a.onfinish = () => holder.remove();
  }

  /* ---------- warp starfield ---------- */
  const c2 = canvas.getContext('2d');
  let W = 0;
  let H = 0;
  function resize() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = W * d;
    canvas.height = H * d;
    c2.setTransform(d, 0, 0, d, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  const DEPTH = 2000;
  const star = (anyZ) => ({
    x: (Math.random() * 2 - 1) * 1700,
    y: (Math.random() * 2 - 1) * 1100,
    z: anyZ ? Math.random() * DEPTH + 1 : DEPTH,
    px: null,
    py: null,
    hue: Math.random() < 0.75 ? 270 + Math.random() * 15 : 300 + Math.random() * 25,
    w: Math.random() * 1.3 + 0.4,
  });
  const stars = Array.from({ length: innerWidth < 700 ? 380 : 750 }, () => star(true));
  const sparks = [];
  let speed = 3;
  let target = 34;
  let glow = 0.25;
  const cam = { x: 0, y: 0, tx: 0, ty: 0 };
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(3, (now - last) / 16.7);
    last = now;
    speed += (target - speed) * 0.05 * dt;
    cam.x += (cam.tx - cam.x) * 0.06 * dt;
    cam.y += (cam.ty - cam.y) * 0.06 * dt;
    c2.fillStyle = `rgba(5,4,8,${speed > 60 ? 0.18 : 0.32})`;
    c2.fillRect(0, 0, W, H);
    const cx = W / 2 - cam.x * 40;
    const cy = H * 0.44 - cam.y * 30;
    const f = Math.min(W, H) * 0.95;

    const g = c2.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.55);
    g.addColorStop(0, `rgba(168,85,247,${glow * 0.35})`);
    g.addColorStop(0.4, `rgba(109,40,217,${glow * 0.12})`);
    g.addColorStop(1, 'rgba(5,4,8,0)');
    c2.fillStyle = g;
    c2.fillRect(0, 0, W, H);

    for (const s of stars) {
      s.z -= speed * dt;
      const sx = cx + (s.x / s.z) * f;
      const sy = cy + (s.y / s.z) * f;
      if (s.z < 1 || sx < -80 || sx > W + 80 || sy < -80 || sy > H + 80) { Object.assign(s, star(false)); continue; }
      if (s.px != null) {
        const near = 1 - s.z / DEPTH;
        c2.strokeStyle = `hsla(${s.hue}, 90%, ${55 + near * 40}%, ${Math.min(1, near * 1.6)})`;
        c2.lineWidth = s.w * (1 + near * 2.4);
        c2.beginPath();
        c2.moveTo(s.px, s.py);
        c2.lineTo(sx, sy);
        c2.stroke();
      }
      s.px = sx;
      s.py = sy;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.965;
      p.vy *= 0.965;
      p.life -= 0.018 * dt;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      c2.fillStyle = `hsla(${p.hue}, 95%, 75%, ${p.life})`;
      c2.beginPath();
      c2.arc(cx + p.x, cy + p.y, p.r * p.life, 0, Math.PI * 2);
      c2.fill();
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  function burst(n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 4 + Math.random() * 14;
      sparks.push({ x: 0, y: 0, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.5 + Math.random() * 3, life: 1, hue: 270 + Math.random() * 50 });
    }
  }

  /* ---------- mouse parallax ---------- */
  function onMove(e) {
    const nx = (e.clientX / innerWidth) * 2 - 1;
    const ny = (e.clientY / innerHeight) * 2 - 1;
    cam.tx = nx;
    cam.ty = ny;
    world.style.setProperty('--mx', nx.toFixed(3));
    world.style.setProperty('--my', ny.toFixed(3));
  }
  window.addEventListener('pointermove', onMove, { passive: true });

  /* ---------- timeline ---------- */
  play('riser', 1.6);
  for (let i = 0; i < 10; i++) later(() => launch(i), 120 + i * 150);

  later(() => { target = 4; }, 1250); // drop out of warp
  // logo spins in from deep space
  later(() => {
    logoWrap.classList.add('in');
    logo.animate([
      { transform: 'translateZ(-2400px) rotateY(-600deg) rotateX(30deg)' },
      { transform: 'translateZ(40px) rotateY(10deg) rotateX(-4deg)', offset: 0.82 },
      { transform: 'translateZ(0) rotateY(0deg) rotateX(0deg)' },
    ], { duration: 1100, easing: 'cubic-bezier(.12,.75,.2,1)', fill: 'backwards' });
  }, 1250);
  // impact
  later(() => {
    glow = 1;
    burst(90);
    el.classList.add('impact');
    shock.animate([{ transform: 'translate(-50%,-50%) scale(.2)', opacity: 0.9 }, { transform: 'translate(-50%,-50%) scale(7)', opacity: 0 }], { duration: 1100, easing: 'cubic-bezier(.1,.7,.3,1)' });
    flash.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: 600, easing: 'ease-out' });
    scene.animate([0, -1, 0.8, -0.5, 0.3, 0].map((k) => ({ transform: `translate(${k * 10}px, ${k * -6}px)` })), { duration: 500 });
    play('impact');
  }, 2150);
  later(() => { glow = 0.55; }, 2800);
  // wordmark letters flip up one by one
  [...word.children].forEach((span, i) => later(() => { span.classList.add('in'); play('letter', i); }, 2300 + i * 110));
  later(() => tag.classList.add('in'), 2850);
  later(() => ui.classList.add('in'), 3200);
  later(() => enter(false), AUTO_ENTER);

  /* ---------- exit: punch through into the lobby ---------- */
  function enter(user) {
    if (leaving) return;
    leaving = true;
    timers.forEach(clearTimeout);
    try { sessionStorage.setItem('nova.intro', '1'); } catch (e) { /* ignore */ }
    if (user) { try { Nova.sfx.warp(); setTimeout(() => Nova.sfx.impact(), 380); } catch (e) { /* ignore */ } }
    target = 140;
    glow = 1.2;
    ui.classList.remove('in');
    el.classList.add('leaving');
    world.animate([
      { transform: 'translateZ(0)', opacity: 1 },
      { transform: 'translateZ(820px)', opacity: 0 },
    ], { duration: 750, easing: 'cubic-bezier(.6,0,.9,.4)', fill: 'forwards' });
    setTimeout(() => flash.animate([{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { duration: 700, easing: 'ease-out' }), 450);
    setTimeout(() => {
      root.classList.remove('intro-pending');
      root.classList.add('intro-reveal');
      // re-render the current page so its entrance animations play in view
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: 'ease-out', fill: 'forwards' });
    }, 700);
    setTimeout(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('keydown', onKey, true);
      el.remove();
      if (/[?&]intro\b/.test(location.search)) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* file:// */ } }
    }, 1400);
    setTimeout(() => root.classList.remove('intro-reveal'), 2000);
  }

  el.addEventListener('click', () => enter(true));
  function onKey(e) {
    if (['Enter', ' ', 'Escape'].includes(e.key)) { e.preventDefault(); e.stopPropagation(); enter(true); }
  }
  document.addEventListener('keydown', onKey, true);
})();
