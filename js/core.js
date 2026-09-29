/* NOVA core: rng, wallet, icons, shared UI components */
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
    swap: '<path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/>',
  };
  Nova.icon = (name, size = 18) =>
    `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  /* brand "N" mark */
  Nova.logo = (cls = '') =>
    `<svg class="logo ${cls}" viewBox="0 0 64 64" aria-hidden="true"><path fill="currentColor" d="M12 54V10h10l20 28V10h10v44H42L22 26v28z"/></svg>`;

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

  /* ---------- toast ---------- */
  Nova.ui.toast = function (text, type = 'info') {
    const box = document.getElementById('toasts');
    if (!box) return;
    const t = h('div', { class: 'toast ' + type }, text);
    box.append(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3600);
  };

  /* ---------- shared components ---------- */
  Nova.ui.pill = (html, cls = '') => h('span', { class: 'pill ' + cls, html });

  /* Game page shell: header, stage, side column with balance card */
  Nova.ui.shell = function (game) {
    const cleanups = [];
    const cleanup = (fn) => { cleanups.push(fn); return fn; };

    const balanceValue = h('div', { class: 'balance-value mono' });
    const freeBtn = h('button', { class: 'btn-ghost small', type: 'button' }, `Claim ${FREE_AMOUNT} free tokens`);
    freeBtn.addEventListener('click', () => {
      if (Nova.wallet.claimFree()) Nova.ui.toast(`+${FREE_AMOUNT} free tokens`, 'win');
    });
    const syncBalance = () => {
      balanceValue.textContent = Nova.fmt(Nova.wallet.balance);
      freeBtn.hidden = Nova.wallet.balance >= 1;
    };
    syncBalance();
    cleanup(Nova.wallet.subscribe(syncBalance));

    const balanceCard = h('div', { class: 'panel balance-card' },
      h('div', { class: 'balance-label', html: Nova.icon('wallet', 16) + '<span>Credit tokens</span>' }),
      balanceValue,
      freeBtn);

    const stage = h('section', { class: 'stage' });
    const controls = h('div', { class: 'panel controls' });
    const side = h('aside', { class: 'side' }, balanceCard, controls);

    const root = h('div', { class: 'game-page' },
      h('a', { class: 'back-link', href: '#/', html: Nova.icon('arrow-left', 16) + '<span>Back to Minigames</span>' }),
      h('div', { class: 'game-head' },
        h('div', { class: 'game-title' },
          h('div', { class: 'game-icon', html: Nova.icon(game.icon, 26) }),
          h('div', {},
            h('h1', { html: game.titleHtml || game.title }),
            h('p', {}, game.subtitle))),
        h('div', { class: 'badges' }, (game.badges || []).map((b) => Nova.ui.pill(b.html, b.cls)))),
      h('div', { class: 'game-grid' }, stage, side));

    return {
      root, stage, controls, cleanup,
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
    opts.options.forEach((o) => {
      const b = h('button', { class: 'seg-btn', type: 'button', role: 'radio' },
        h('span', { class: 'seg-label' }, o.label),
        o.sub != null ? h('span', { class: 'seg-sub' }, o.sub) : null);
      b.addEventListener('click', () => {
        if (locked || value === o.value) return;
        api.set(o.value);
        opts.onChange && opts.onChange(o.value);
      });
      btns.set(o.value, { b, label: b.querySelector('.seg-label'), sub: b.querySelector('.seg-sub') });
      root.append(b);
    });
    const api = {
      root,
      get value() { return value; },
      set(v) {
        value = v;
        btns.forEach((x, k) => {
          x.b.classList.toggle('active', k === v);
          x.b.setAttribute('aria-checked', k === v ? 'true' : 'false');
        });
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
      value = Nova.round2(Nova.clamp(v, 1, 1e9));
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

  /* Small "recent results" list */
  Nova.ui.recent = function (title, emptyText, max = 12, right) {
    const list = h('div', { class: 'recent-list' }, h('span', { class: 'muted' }, emptyText));
    const rightEl = h('span', { class: 'recent-right' });
    const root = h('div', { class: 'recent' },
      h('div', { class: 'recent-head' }, h('span', { class: 'field-label' }, title), rightEl),
      list);
    let n = 0;
    return {
      root,
      add(text, cls = '') {
        if (n === 0) list.textContent = '';
        n++;
        list.prepend(h('span', { class: 'chip ' + cls }, text));
        while (list.children.length > max) list.lastChild.remove();
      },
      setRight(t) { rightEl.innerHTML = t; },
    };
  };

  /* Register a game */
  Nova.register = function (game) { Nova.games.push(game); };
})();
