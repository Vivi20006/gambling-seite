/* NOVA core: rng, wallet, icons, effects, shared UI components */
(function () {
  'use strict';

  const Nova = (window.Nova = { games: [], ui: {} });

  /* ---------- utils ---------- */
  const buf = new Uint32Array(2);
  Nova.rand = function () {
    crypto.getRandomValues(buf);
    return (buf[0] * 2097152 + (buf[1] >>> 11)) / 9007199254740992;
  };
  Nova.randInt = (n) => Math.floor(Nova.rand() * n);
  Nova.round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  Nova.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  Nova.fmt = (n, max = 2) =>
    Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: max });
  Nova.fmtMult = (m) => (m >= 1000 ? Nova.fmt(m, 0) : m.toFixed(2)) + '×';
  Nova.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  Nova.reducedMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  Nova.anim = (el, frames, opts) => (Nova.reducedMotion || !el || !el.animate ? null : el.animate(frames, opts));

  Nova.h = function (tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style' && typeof v === 'object') {
        for (const [sk, sv] of Object.entries(v)) {
          if (sk.startsWith('--')) e.style.setProperty(sk, sv);
          else e.style[sk] = sv;
        }
      }
      else if (k.startsWith('on')) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat()) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(c));
    }
    return e;
  };
  const h = Nova.h;

  /* ---------- icons (lucide-style) ---------- */
  const P = {
    'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    'shield-check': '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/>',
    gem: '<path d="M6 3h12l4 6-10 13L2 9z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M16 14h.01M8 10h.01M8 14h.01"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    'circle-dot': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
    dice: '<rect width="12" height="12" x="2" y="10" rx="2" ry="2"/><path d="m17.92 14 3.5-3.5a2.24 2.24 0 0 0 0-3l-5-4.92a2.24 2.24 0 0 0-3 0L10 6"/><path d="M6 18h.01M10 14h.01M15 6h.01M18 9h.01"/>',
    'chevrons-up': '<path d="m17 11-5-5-5 5"/><path d="m17 18-5-5-5 5"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    'chevron-up': '<path d="m18 15-6-6-6 6"/>',
    footprints: '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
    package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    bomb: '<circle cx="11" cy="14" r="8"/><path d="M16.5 8.5 19 6"/><path d="M19 3v2M22 5h-2M20.6 3.4l-1.2 1.2"/>',
    coin: '<circle cx="12" cy="12" r="9"/><path d="M9 9h6M9 15h6M12 6v12"/>',
    volume: '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.4 18.4a9 9 0 0 0 0-12.8"/>',
    'volume-x': '<path d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5z"/><path d="m22 9-6 6"/><path d="m16 9 6 6"/>',
    candy: '<path d="m9.5 7.5-2 2a4.95 4.95 0 1 0 7 7l2-2a4.95 4.95 0 1 0-7-7Z"/><path d="M14 6.5v10"/><path d="M10 7.5v10"/><path d="m16 7 1-5 1.37.68A3 3 0 0 0 19.7 3H21v1.3c0 .46.1.92.32 1.33L22 7l-5 1"/><path d="m8 17-1 5-1.37-.68A3 3 0 0 0 4.3 21H3v-1.3a3 3 0 0 0-.32-1.33L2 17l5-1"/>',
    zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
    repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
    flag: '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.3 2A6 6 0 0 0 19.6 3a1 1 0 0 1 1.4.9v10.2a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-7.3-2a6 6 0 0 0-4.7 2"/>',
  };
  Nova.icon = (name, size = 18) =>
    `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  /* brand "N" mark */
  Nova.logo = (cls = '') =>
    `<svg class="logo ${cls}" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M12 54V10h10l20 28V10h10v44H42L22 26v28z"/></svg>`;

  /* filled game art (gradients live in index.html) */
  Nova.art = {
    gem: '<svg class="svg-gem" viewBox="0 0 64 64" aria-hidden="true"><path d="M18 10h28l12 14-26 30L6 24z" fill="url(#gGem)"/><path d="M6 24h52M18 10l8 14 6-14 6 14 8-14M26 24l6 30 6-30" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    bomb: '<svg class="svg-bomb" viewBox="0 0 64 64" aria-hidden="true"><circle cx="30" cy="37" r="19" fill="url(#gBomb)" stroke="rgba(255,255,255,.14)"/><ellipse cx="23" cy="30" rx="6" ry="3.5" fill="rgba(255,255,255,.28)" transform="rotate(-35 23 30)"/><rect x="38" y="14" width="10" height="9" rx="2" fill="#3a3346" transform="rotate(40 43 18)"/><path d="M46 14c3-6 8-6 10-2" stroke="#f59e0b" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle class="spark" cx="56.5" cy="11" r="3.5" fill="#fde047"/></svg>',
  };

  /* ---------- wallet ---------- */
  const KEY = 'nova.save.v1';
  const START_BALANCE = 1000;
  const FREE_AMOUNT = 100;
  let save;
  try { save = JSON.parse(localStorage.getItem(KEY)); } catch (e) { save = null; }
  if (!save || typeof save.balance !== 'number') save = { balance: START_BALANCE, inventory: [] };
  if (!Array.isArray(save.inventory)) save.inventory = [];

  const subs = new Set();
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
  }
  function emit() { persist(); subs.forEach((fn) => fn()); }

  Nova.wallet = {
    get balance() { return save.balance; },
    freeAmount: FREE_AMOUNT,
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    canAfford(n) { return n >= 1 && n <= save.balance + 1e-9; },
    debit(n) {
      if (!this.canAfford(n)) return false;
      save.balance = Nova.round2(save.balance - n);
      emit();
      return true;
    },
    credit(n) {
      save.balance = Nova.round2(save.balance + n);
      emit();
    },
    claimFree() {
      if (save.balance >= 1) return false;
      save.balance = Nova.round2(save.balance + FREE_AMOUNT);
      emit();
      return true;
    },
    reset() {
      save = { balance: START_BALANCE, inventory: [] };
      emit();
    },
  };

  Nova.inventory = {
    get items() { return save.inventory.slice(); },
    add(itemId) {
      save.inventory.push({ uid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), itemId });
      emit();
    },
    remove(uid) {
      const i = save.inventory.findIndex((x) => x.uid === uid);
      if (i < 0) return null;
      const [it] = save.inventory.splice(i, 1);
      emit();
      return it;
    },
  };

  /* ---------- effects ---------- */
  Nova.fx = (function () {
    let canvas = null;
    let c2 = null;
    let parts = [];
    let raf = 0;
    const COLORS = ['#c084fc', '#e9d5ff', '#a855f7', '#f0abfc', '#ffffff'];

    function resize() {
      const d = window.devicePixelRatio || 1;
      canvas.width = innerWidth * d;
      canvas.height = innerHeight * d;
      c2.setTransform(d, 0, 0, d, 0, 0);
    }
    function ensure() {
      if (canvas) return;
      canvas = h('canvas', { class: 'fx-canvas', 'aria-hidden': 'true' });
      document.body.append(canvas);
      c2 = canvas.getContext('2d');
      resize();
      window.addEventListener('resize', resize);
    }
    function loop() {
      c2.clearRect(0, 0, innerWidth, innerHeight);
      const now = performance.now();
      parts = parts.filter((p) => {
        const t = (now - p.t0) / p.life;
        if (t >= 1) return false;
        p.vx *= p.drag;
        p.vy = p.vy * p.drag + p.g;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        c2.globalAlpha = 1 - t * t;
        c2.fillStyle = p.color;
        c2.save();
        c2.translate(p.x, p.y);
        c2.rotate(p.rot);
        if (p.shape === 'rect') c2.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2 * (0.4 + Math.abs(Math.cos(p.rot * 2))));
        else { c2.beginPath(); c2.arc(0, 0, (p.s / 2) * (1 - t * 0.5), 0, Math.PI * 2); c2.fill(); }
        c2.restore();
        return true;
      });
      c2.globalAlpha = 1;
      raf = parts.length ? requestAnimationFrame(loop) : 0;
    }
    function burst(x, y, o = {}) {
      if (Nova.reducedMotion) return;
      ensure();
      const n = o.count || 24;
      const colors = o.colors || COLORS;
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        const a = (o.angle != null ? o.angle : 0) + (Math.random() - 0.5) * (o.spread != null ? o.spread : Math.PI * 2);
        const sp = (o.speed || 6) * (0.35 + Math.random() * 0.85);
        parts.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (o.up != null ? o.up : 1.5),
          g: o.gravity != null ? o.gravity : 0.18,
          drag: o.drag || 0.96,
          s: (o.size || 5) * (0.6 + Math.random() * 0.8),
          color: colors[i % colors.length],
          t0: now,
          life: (o.life || 900) * (0.7 + Math.random() * 0.6),
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 0.3,
          shape: o.shape || (Math.random() < 0.5 ? 'rect' : 'dot'),
        });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    }
    function at(el, o) {
      if (!el) return;
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, o);
    }
    function confetti() {
      const o = { count: 70, speed: 17, up: 0, gravity: 0.32, drag: 0.985, life: 2300, shape: 'rect', size: 9, spread: 0.8,
        colors: ['#c084fc', '#f0abfc', '#ffffff', '#fde047', '#4ade80', '#a855f7'] };
      burst(innerWidth * 0.12, innerHeight + 10, { ...o, angle: -Math.PI / 2 + 0.38 });
      burst(innerWidth * 0.88, innerHeight + 10, { ...o, angle: -Math.PI / 2 - 0.38 });
    }
    function shake(el, px = 7) {
      Nova.anim(el, [0, -1, 0.8, -0.6, 0.4, -0.2, 0].map((k) => ({ transform: `translateX(${k * px}px)` })), { duration: 420, easing: 'ease-out' });
    }
    return { burst, at, confetti, shake };
  })();

  /* ---------- toast (system messages only) ---------- */
  Nova.ui.toast = function (text, type = 'info') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = h('div', { class: 'toast ' + type }, text);
    box.append(t);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 2600);
    setTimeout(() => t.remove(), 3000);
  };

  /* ---------- shared components ---------- */
  Nova.ui.pill = (html, cls = '') => h('span', { class: 'pill ' + cls, html });
  Nova.ui.bump = (el, s = 1.14) =>
    Nova.anim(el, [{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' });

  /* Number that eases to each new value and flashes green/red */
  Nova.ui.counter = function (el, initial) {
    let shown = initial;
    let raf = 0;
    el.textContent = Nova.fmt(shown);
    return function (target) {
      if (target === shown) return;
      const from = shown;
      const t0 = performance.now();
      el.classList.remove('up', 'down');
      void el.offsetWidth;
      el.classList.add(target > from ? 'up' : 'down');
      cancelAnimationFrame(raf);
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 520);
        const e = 1 - Math.pow(1 - k, 3);
        shown = k < 1 ? from + (target - from) * e : target;
        el.textContent = Nova.fmt(Nova.round2(shown));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
  };

  /* Game page shell: header, stage, side column with balance card */
  Nova.ui.shell = function (game) {
    const cleanups = [];
    const cleanup = (fn) => { cleanups.push(fn); return fn; };

    const balanceValue = h('div', { class: 'balance-value mono' });
    const setBalance = Nova.ui.counter(balanceValue, Nova.wallet.balance);
    const freeBtn = h('button', { class: 'btn-ghost small', type: 'button' }, `Claim ${FREE_AMOUNT} free tokens`);
    freeBtn.addEventListener('click', () => {
      if (!Nova.wallet.claimFree()) return;
      Nova.sfx.coins(8);
      Nova.fx.at(balanceValue, { count: 20 });
      Nova.ui.toast(`+${FREE_AMOUNT} free tokens`, 'win');
    });
    const syncBalance = () => {
      setBalance(Nova.wallet.balance);
      freeBtn.hidden = Nova.wallet.balance >= 1;
    };
    syncBalance();
    cleanup(Nova.wallet.subscribe(syncBalance));

    const balanceCard = h('div', { class: 'panel balance-card' },
      h('div', { class: 'balance-label', html: Nova.icon('wallet', 16) + '<span>Credit tokens</span>' }),
      balanceValue,
      freeBtn);

    const flashEl = h('div', { class: 'stage-flash', 'aria-hidden': 'true' });
    const pop = h('div', { class: 'result-pop', role: 'status' });
    const stage = h('section', { class: 'stage' }, flashEl, pop);
    const controls = h('div', { class: 'panel controls' });
    const side = h('aside', { class: 'side' }, balanceCard, controls);

    const root = h('div', { class: 'game-page page-enter' },
      h('a', { class: 'back-link', href: '#/', html: Nova.icon('arrow-left', 16) + '<span>Back to Minigames</span>' }),
      h('div', { class: 'game-head' },
        h('div', { class: 'game-title' },
          h('div', { class: 'game-icon', html: Nova.icon(game.icon, 26) }),
          h('div', {},
            h('h1', { html: game.titleHtml || game.title }),
            h('p', {}, game.subtitle))),
        h('div', { class: 'badges' }, (game.badges || []).map((b) => Nova.ui.pill(b.html, b.cls)))),
      h('div', { class: 'game-grid' }, stage, side));

    /* big centered win/lose card over an element of the stage */
    function result({ win, big, small, anchor }) {
      pop.className = 'result-pop ' + (win ? 'win' : 'lose');
      pop.innerHTML = `<b class="mono">${big}</b>${small ? `<span class="mono">${small}</span>` : ''}`;
      if (anchor) {
        const sr = stage.getBoundingClientRect();
        const ar = anchor.getBoundingClientRect();
        pop.style.left = ar.left - sr.left + ar.width / 2 + 'px';
        pop.style.top = ar.top - sr.top + ar.height / 2 + 'px';
      } else {
        pop.style.left = '50%';
        pop.style.top = '45%';
      }
      pop.getAnimations().forEach((a) => a.cancel());
      const frames = [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.08)', offset: 0.14 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.22 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.86 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.95)' },
      ];
      if (Nova.reducedMotion) frames.forEach((f) => (f.transform = 'translate(-50%,-50%)'));
      pop.animate(frames, { duration: 2000, easing: 'ease-out', fill: 'forwards' });
    }

    function flash(kind) {
      flashEl.className = 'stage-flash ' + kind;
      Nova.anim(flashEl, [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 0 }], { duration: 750, easing: 'ease-out' });
    }

    return {
      root, stage, controls, cleanup, result, flash,
      destroy() { cleanups.splice(0).forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } }); },
    };
  };

  /* Segmented option picker: options = [{value, label, sub}] */
  Nova.ui.segmented = function (opts) {
    let value = opts.value;
    let locked = false;
    const btns = new Map();
    const root = h('div', { class: 'seg ' + (opts.cls || ''), role: 'radiogroup' });
    root.style.setProperty('--cols', opts.cols || opts.options.length);
    const glider = h('span', { class: 'seg-glider', 'aria-hidden': 'true' });
    root.append(glider);
    opts.options.forEach((o) => {
      const b = h('button', { class: 'seg-btn', type: 'button', role: 'radio' },
        h('span', { class: 'seg-label' }, o.label),
        o.sub != null ? h('span', { class: 'seg-sub' }, o.sub) : null);
      b.addEventListener('click', () => {
        if (locked || value === o.value) return;
        api.set(o.value);
        opts.onChange && opts.onChange(o.value);
      });
      btns.set(o.value, { b, sub: b.querySelector('.seg-sub') });
      root.append(b);
    });
    const idx = () => [...btns.keys()].indexOf(value);
    const api = {
      root,
      get value() { return value; },
      set(v) {
        value = v;
        btns.forEach((x, k) => {
          x.b.classList.toggle('active', k === v);
          x.b.setAttribute('aria-checked', k === v ? 'true' : 'false');
        });
        glider.style.setProperty('--i', idx());
      },
      setSub(v, text) { const x = btns.get(v); if (x && x.sub) x.sub.textContent = text; },
      lock(b) { locked = b; root.classList.toggle('locked', b); btns.forEach((x) => (x.b.disabled = b)); },
    };
    api.set(value);
    return api;
  };

  /* Bet input with -, +, ½, 2×, Max */
  Nova.ui.betControl = function (shell) {
    let value = 1;
    let locked = false;
    const listeners = [];
    const input = h('input', { class: 'bet-input mono', type: 'text', inputmode: 'decimal', value: '1', 'aria-label': 'Bet in tokens' });
    const mk = (cls, label, fn, html) => {
      const b = h('button', { class: cls, type: 'button', 'aria-label': label, html }, html ? null : label);
      b.addEventListener('click', () => { if (!locked) fn(); });
      return b;
    };
    const minus = mk('bet-step', 'Decrease bet', () => set(value - 1), Nova.icon('minus', 18));
    const plus = mk('bet-step', 'Increase bet', () => set(value + 1), Nova.icon('plus', 18));
    const half = mk('bet-quick', '½', () => set(Math.max(1, Nova.round2(value / 2))));
    const dbl = mk('bet-quick', '2×', () => set(value * 2));
    const max = mk('bet-quick', 'Max', () => set(Math.max(1, Math.floor(Nova.wallet.balance * 100) / 100)));

    function set(v) {
      v = parseFloat(v);
      if (!isFinite(v)) v = 1;
      const next = Nova.round2(Nova.clamp(v, 1, 1e9));
      if (next !== value) Nova.ui.bump(input, 1.08);
      value = next;
      input.value = String(value);
      listeners.forEach((fn) => fn(value));
    }
    input.addEventListener('change', () => set(input.value.replace(',', '.')));
    input.addEventListener('focus', () => input.select());

    const sync = () => {
      const off = locked || Nova.wallet.balance < 1;
      [half, dbl, max].forEach((b) => (b.disabled = off));
      minus.disabled = plus.disabled = input.disabled = locked;
    };
    sync();
    shell.cleanup(Nova.wallet.subscribe(sync));

    const root = h('div', { class: 'field' },
      h('label', { class: 'field-label' }, 'Bet (tokens)'),
      h('div', { class: 'bet-row' }, minus, input, plus),
      h('div', { class: 'bet-quick-row' }, half, dbl, max));

    return {
      root,
      get: () => value,
      set,
      on: (fn) => listeners.push(fn),
      lock(b) { locked = b; sync(); },
    };
  };

  /* State of the primary action button relative to the bet. Returns null if OK. */
  Nova.ui.betBlock = function (bet) {
    if (Nova.wallet.balance < 1) return 'No credit tokens';
    if (bet.get() > Nova.wallet.balance + 1e-9) return 'Not enough tokens';
    return null;
  };

  /* Keeps a "start" button in sync with wallet + bet. isBusy() true → leave it alone. */
  Nova.ui.bindStart = function (shell, btn, bet, label, isBusy) {
    const sync = () => {
      if (isBusy()) return;
      const block = Nova.ui.betBlock(bet);
      btn.disabled = !!block;
      btn.textContent = block || (typeof label === 'function' ? label() : label);
    };
    bet.on(sync);
    shell.cleanup(Nova.wallet.subscribe(sync));
    sync();
    return sync;
  };

  /* Small "recent results" list; newest chip slides in on the left */
  Nova.ui.recent = function (title, emptyText, max = 12) {
    const list = h('div', { class: 'recent-list' }, h('span', { class: 'muted' }, emptyText));
    const rightEl = h('span', { class: 'recent-right' });
    const root = h('div', { class: 'recent' },
      h('div', { class: 'recent-head' }, h('span', { class: 'field-label' }, title), rightEl),
      list);
    let n = 0;
    return {
      root,
      add(content, cls = '', isHtml = false) {
        if (n === 0) list.textContent = '';
        n++;
        const chip = h('span', { class: 'chip ' + cls, html: isHtml ? content : null }, isHtml ? null : content);
        list.prepend(chip);
        Nova.anim(chip, [{ opacity: 0, transform: 'translateX(-12px) scale(.85)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
        while (list.children.length > max) list.lastChild.remove();
      },
      setRight(t) { rightEl.innerHTML = t; },
    };
  };

  /* Register a game */
  Nova.register = function (game) { Nova.games.push(game); };
})();
