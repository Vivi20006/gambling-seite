/* NOVA accounts: sign in with Google or Discord. Each account keeps its own balance,
   inventory and hourly free-coin timer (stored in this browser). Client IDs live in js/config.js;
   a provider without one falls back to a local demo account. */
(function () {
  'use strict';
  const { h } = Nova;
  const CFG = window.NOVA_CONFIG || {};
  const ACC_KEY = 'nova.accounts.v1';
  const SES_KEY = 'nova.session.v1';
  const DC_STATE = 'nova.discord.state';
  const DC_RETURN = 'nova.discord.return';

  const read = (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) || fallback; } catch (e) { return fallback; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } };

  let user = null;
  let busy = '';
  const subs = new Set();
  const emit = (info) => subs.forEach((fn) => fn(info || {}));

  function persist() {
    if (!user) return;
    const all = read(ACC_KEY, {});
    all[user.id] = user;
    write(ACC_KEY, all);
  }

  function bind(acc) {
    user = acc;
    Nova.wallet.bind(acc, persist);
  }

  function signIn(p) {
    const id = p.provider + ':' + p.pid;
    const all = read(ACC_KEY, {});
    const isNew = !all[id];
    const acc = all[id] || {
      id, provider: p.provider, created: Date.now(),
      balance: 0, inventory: [], lastClaim: 0, claims: 0, wagered: 0, bestWin: 0,
    };
    Object.assign(acc, { name: p.name || 'Player', email: p.email || '', avatar: p.avatar || '', demo: !!p.demo, lastLogin: Date.now() });
    all[id] = acc;
    write(ACC_KEY, all);
    write(SES_KEY, id);
    busy = '';
    closeModal();
    bind(acc);
    Nova.sfx.win(2);
    Nova.ui.toast(isNew ? `Welcome, ${acc.name}! Your first ${Nova.fmt(Nova.wallet.hourlyAmount)} coins are ready to claim.` : `Welcome back, ${acc.name}!`, 'win');
    emit({ login: true, isNew });
  }

  function logout() {
    if (!user) return;
    try { localStorage.removeItem(SES_KEY); } catch (e) { /* ignore */ }
    try { if (user.provider === 'google' && window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* ignore */ }
    user = null;
    emit({ logout: true }); // closes any open game while its wallet is still bound (so pending payouts land)
    Nova.wallet.bind(null);
    Nova.ui.toast('Signed out. See you soon!', 'info');
  }

  function fail(msg) {
    busy = '';
    Nova.sfx.error();
    Nova.ui.toast(msg, 'lose');
    emit({});
  }

  /* ---------- Google (Google Identity Services token client) ---------- */
  let gTokenClient = null;
  function loadGoogle() {
    if (!CFG.googleClientId || document.getElementById('gsi-script')) return;
    const s = h('script', { id: 'gsi-script', src: 'https://accounts.google.com/gsi/client', async: true });
    s.onload = () => {
      try {
        gTokenClient = google.accounts.oauth2.initTokenClient({
          client_id: CFG.googleClientId,
          scope: 'openid email profile',
          callback: onGoogleToken,
          error_callback: (e) => fail(e && e.type === 'popup_closed' ? 'Google sign-in was cancelled.' : 'Google sign-in failed.'),
        });
      } catch (e) { /* reported when the button is used */ }
    };
    document.head.append(s);
  }
  async function onGoogleToken(resp) {
    if (!resp || resp.error || !resp.access_token) return fail('Google sign-in was cancelled.');
    try {
      const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + resp.access_token } });
      if (!r.ok) throw new Error(r.status);
      const u = await r.json();
      signIn({ provider: 'google', pid: u.sub, name: u.name || u.given_name || (u.email || '').split('@')[0], email: u.email, avatar: u.picture });
    } catch (e) { fail('Could not load your Google profile. Please try again.'); }
  }
  function google_() {
    if (!CFG.googleClientId) return demo('google');
    if (!gTokenClient) { loadGoogle(); return fail('Google sign-in is still loading — try again in a second.'); }
    busy = 'google';
    emit({});
    gTokenClient.requestAccessToken();
  }

  /* ---------- Discord (OAuth2 implicit grant: redirect, token comes back in the URL hash) ---------- */
  const discordRedirect = () => CFG.discordRedirectUri || location.origin + location.pathname;
  function discord() {
    if (!CFG.discordClientId) return demo('discord');
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    const state = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    try {
      sessionStorage.setItem(DC_STATE, state);
      sessionStorage.setItem(DC_RETURN, location.hash || '#/');
    } catch (e) { /* ignore */ }
    busy = 'discord';
    emit({});
    const q = new URLSearchParams({
      client_id: CFG.discordClientId, response_type: 'token', redirect_uri: discordRedirect(),
      scope: 'identify email', state, prompt: 'none',
    });
    location.href = 'https://discord.com/oauth2/authorize?' + q;
  }
  async function finishDiscord(p) {
    busy = 'discord';
    try {
      const r = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: 'Bearer ' + p.get('access_token') } });
      if (!r.ok) throw new Error(r.status);
      const u = await r.json();
      let avatar = '';
      if (u.avatar) avatar = `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`;
      else { try { avatar = `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`; } catch (e) { /* ignore */ } }
      signIn({ provider: 'discord', pid: u.id, name: u.global_name || u.username, email: u.email, avatar });
    } catch (e) { fail('Could not load your Discord profile. Please try again.'); }
  }
  // runs before the router: consume "#access_token=…" / "#error=…" coming back from Discord
  (function catchDiscordReturn() {
    const frag = location.hash.slice(1);
    if (!/(^|&)(access_token|error)=/.test(frag)) return;
    const p = new URLSearchParams(frag);
    let expected = null;
    let back = '#/';
    try {
      expected = sessionStorage.getItem(DC_STATE);
      back = sessionStorage.getItem(DC_RETURN) || '#/';
      sessionStorage.removeItem(DC_STATE);
      sessionStorage.removeItem(DC_RETURN);
    } catch (e) { /* ignore */ }
    history.replaceState(null, '', location.pathname + location.search + back);
    if (!p.get('access_token')) setTimeout(() => fail('Discord sign-in was cancelled.'), 300);
    else if (!expected || p.get('state') !== expected) setTimeout(() => fail('Discord sign-in failed, please try again.'), 300);
    else finishDiscord(p);
  })();

  /* ---------- demo accounts (used while a provider has no client ID) ---------- */
  function demo(provider) {
    const label = provider === 'google' ? 'Google' : 'Discord';
    const input = h('input', { class: 'bet-input left', type: 'text', maxlength: '20', placeholder: 'Your player name', 'aria-label': 'Player name' });
    const go = h('button', { class: 'btn-primary', type: 'submit' }, 'Create demo account');
    const form = h('form', { class: 'demo-form' },
      h('p', { class: 'demo-note', html: `${Nova.icon('flag', 15)}<span><b>${label} sign-in isn't connected yet.</b> Add a client ID in <code>js/config.js</code> to enable real ${label} accounts. Until then you can try NOVA with a local demo account.</span>` }),
      h('label', { class: 'field-label' }, 'Player name'),
      input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = input.value.trim().replace(/\s+/g, ' ').slice(0, 20);
      if (name.length < 2) { Nova.fx.shake(input); input.focus(); return; }
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      signIn({ provider, pid: 'demo-' + slug, name, demo: true });
    });
    openModal(h('div', {},
      modalHead(`Continue with ${label}`),
      form));
    setTimeout(() => input.focus(), 60);
  }

  /* ---------- UI ---------- */
  const GOOGLE_G = '<svg class="prov-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
  const DISCORD = '<svg class="prov-logo" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.028C.533 9.046-.32 13.58.099 18.058a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.873-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.099.246.198.373.292a.077.077 0 0 1-.007.128 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.029 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.331c-1.183 0-2.157-1.086-2.157-2.419s.956-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.42 0 1.332-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.086-2.157-2.419s.955-2.419 2.157-2.419c1.21 0 2.176 1.095 2.157 2.42 0 1.332-.946 2.418-2.157 2.418z"/></svg>';

  /* the two provider buttons; used in the hero, the login modal and the game gate */
  function buttons(opts = {}) {
    const mk = (prov, logo, label, fn) => {
      const b = h('button', { class: 'prov-btn prov-' + prov, type: 'button' });
      const sync = () => {
        const waiting = busy === prov;
        b.disabled = !!busy;
        b.innerHTML = logo + `<span>${waiting ? 'Connecting…' : label}</span>` + (waiting ? '<i class="prov-spin"></i>' : '');
      };
      b.addEventListener('click', () => { Nova.sfx.click(); fn(); });
      sync();
      const off = Nova.auth.subscribe(sync);
      Nova.ui.everySecond(b, () => {}, off);
      return b;
    };
    return h('div', { class: 'prov-row' + (opts.stack ? ' stack' : '') },
      mk('google', GOOGLE_G, opts.short ? 'Google' : 'Continue with Google', google_),
      mk('discord', DISCORD, opts.short ? 'Discord' : 'Continue with Discord', discord));
  }

  function modalHead(title) {
    const x = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', html: Nova.icon('x', 18) });
    x.addEventListener('click', closeModal);
    return h('div', { class: 'modal-head' }, h('h3', {}, title), x);
  }
  let overlay = null;
  function closeModal() { if (overlay) { overlay.remove(); overlay = null; } }
  function openModal(content) {
    closeModal();
    overlay = h('div', { class: 'modal-overlay auth-overlay' }, h('div', { class: 'modal auth-modal', role: 'dialog', 'aria-modal': 'true' }, content));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeModal(); });
    document.body.append(overlay);
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  function open(reason) {
    const amount = Nova.fmt(Nova.wallet.hourlyAmount);
    openModal(h('div', { class: 'auth-body' },
      modalHead(''),
      h('div', { class: 'auth-logo', html: Nova.logo() }),
      h('h2', { class: 'auth-title', html: 'Join <span class="grad">NOVA</span>' }),
      h('p', { class: 'auth-sub' }, reason || `Create your free account with Google or Discord and grab ${amount} coins every hour.`),
      h('ul', { class: 'auth-perks' },
        h('li', { html: Nova.icon('gift', 16) + `<span><b>${amount} free coins</b> every hour</span>` }),
        h('li', { html: Nova.icon('rocket', 16) + '<span><b>11 games</b> including Crash</span>' }),
        h('li', { html: Nova.icon('shield-check', 16) + '<span>Your balance is <b>saved to your account</b></span>' })),
      buttons({ stack: true }),
      h('p', { class: 'auth-fine' }, 'Play money only — coins have no real-world value and can never be bought or cashed out.')));
  }

  /* initials avatar when a provider has no picture (or it fails to load) */
  function avatar(u, size = 32) {
    const initials = (u.name || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const el = h('span', { class: 'avatar', style: { width: size + 'px', height: size + 'px', fontSize: Math.round(size * 0.4) + 'px' } }, initials);
    if (u.avatar) {
      const img = h('img', { src: u.avatar, alt: '', referrerpolicy: 'no-referrer' });
      img.onerror = () => img.remove();
      el.append(img);
    }
    return el;
  }

  Nova.auth = {
    get user() { return user; },
    get busy() { return busy; },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    open, close: closeModal, buttons, avatar, logout,
    providerName: (p) => (p === 'google' ? 'Google' : p === 'discord' ? 'Discord' : p),
  };

  /* restore the last session */
  const sid = read(SES_KEY, null);
  const saved = sid && read(ACC_KEY, {})[sid];
  if (saved) bind(saved);
  loadGoogle();

  // signing in / out in another tab
  window.addEventListener('storage', (e) => { if (e.key === SES_KEY) location.reload(); });
})();
