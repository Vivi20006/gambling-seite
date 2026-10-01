/* NOVA app: topbar + account menu, hash router, landing page, lobby, sign-in gate */
(function () {
  const { h, fmt } = Nova;
  const app = document.getElementById('app');
  const HOURLY = fmt(Nova.wallet.hourlyAmount);

  /* rocket art (gradients live in index.html) */
  Nova.art.rocket = '<svg class="svg-rocket" viewBox="0 0 120 60" aria-hidden="true"><path class="rk-flame" d="M26 30C16 21 7 25 0 30c7 5 16 9 26 0z" fill="url(#gFlame)"/><path d="M42 19 24 6l8 15zM42 41 24 54l8-15z" fill="#7c3aed"/><rect x="23" y="24" width="7" height="12" rx="2" fill="#3b3446"/><path d="M28 21c25-6 57-5 79 9-22 14-54 15-79 9z" fill="url(#gRocket)"/><path d="M89 22.4c7 2.4 13 5 18 7.6-5 2.6-11 5.2-18 7.6 2.2-4.6 2.2-10.6 0-15.2z" fill="#c084fc"/><circle cx="67" cy="30" r="6.5" fill="#1e1036" stroke="#fff" stroke-width="2.5"/></svg>';

  /* decorative card art per game (CSS + inline SVG, no external assets) */
  const ART = {
    crash: '<svg class="art-curve" viewBox="0 0 400 200" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="gCurveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c084fc" stop-opacity=".45"/><stop offset="1" stop-color="#c084fc" stop-opacity="0"/></linearGradient></defs><path d="M0 200C150 196 270 160 380 26V200z" fill="url(#gCurveFill)"/><path d="M0 200C150 196 270 160 380 26" fill="none" stroke="#f0abfc" stroke-width="4" vector-effect="non-scaling-stroke"/></svg>' +
      `<span class="art-float art-rocket">${'{rocket}'}</span><span class="art-crash-mult mono">12.48×</span><span class="art-stars"></span>`,
    bonbon: '<span class="art-float art-bb bomb"><b>2500x</b></span><span class="art-float slow art-bb bomb2"><b>100x</b></span><span class="art-bb lolly"></span>',
    blackjack: '<span class="art-bj"><span class="bjc a"><b>A</b><i>♠</i></span><span class="bjc b"><b>K</b><i>♥</i></span><span class="art-float bjchips"><i></i><i></i><i></i><i></i></span></span>',
    slots: '<span class="art-float art-candy a">🍭</span><span class="art-float slow art-candy b">🍬</span><span class="art-float art-candy c">💖</span><span class="art-candy d">🍩</span><span class="art-orb">25×</span>',
    mines: `<span class="art-float art-bomb">${Nova.art.bomb}</span><span class="art-gem-sm">${Nova.art.gem}</span><span class="art-tiles"></span>`,
    coinflip: '<span class="art-float art-coin a"></span><span class="art-float slow art-coin b"></span>',
    tower: '<span class="art-tower"><i></i><i></i><i></i><i></i><i></i><i></i></span>',
    chicken: '<span class="art-float art-big chick">🐔</span><span class="art-cones">🚧</span>',
    plinko: '<span class="art-plinko"></span><span class="art-ball"></span>',
    dice: '<span class="art-float art-die a"><i></i></span><span class="art-float slow art-die b"><i></i></span>',
    upgrader: '<span class="art-float art-upg">' + Nova.icon('chevrons-up', 84) + '</span>',
  };
  ART.crash = ART.crash.replace('{rocket}', Nova.art.rocket);
  const BLURB = {
    crash: 'Strap in and watch the multiplier climb as the rocket rips through space. Cash out before it explodes — or ride it all the way to 10,000×.',
    bonbon: 'Candy-land tumbling slot with rainbow and gold multiplier bombs up to 2500×. Buy Feature with 3 options and 4 Special Bets.',
    blackjack: 'Take on the dealer at a 3D felt table: hit, stand, double and split your way to 21. Blackjack pays 3 to 2, with Perfect Pairs and 21+3 side bets.',
    slots: 'A real 6×5 tumbling slot: match 8+ sweets anywhere, watch wins pop and new candy rain down. Land 4 lollipops for free spins with multiplier orbs up to 100×.',
    mines: 'Reveal tiles, avoid the mines, cash out before your luck runs out. Every gem raises the multiplier.',
    coinflip: 'Call heads or tails and flip. Win and you double your bet, lose and your stake is gone.',
    tower: 'Climb floor by floor, picking the safe tile each time. Multipliers stack — cash out anytime.',
    chicken: 'Cross the road lane by lane. Every safe step raises your multiplier — don\'t get run over.',
    plinko: 'Drop the ball and watch it bounce through the pegs. The edges hit the biggest multipliers.',
    dice: 'Drag your win zone, roll, and see how high you can go. Smaller zone, bigger payout.',
    upgrader: 'Stake a few coins for a shot at a much bigger item. Pick your odds and spin the ring.',
  };
  const ORDER = ['crash', 'bonbon', 'slots', 'blackjack', 'mines', 'coinflip', 'tower', 'chicken', 'plinko', 'dice', 'upgrader'];
  const NEW = new Set(['crash']);
  const gameById = (id) => Nova.games.find((g) => g.id === id);

  /* ---------- topbar ---------- */
  document.getElementById('brandMark').innerHTML = Nova.logo();

  const soundBtn = document.getElementById('soundBtn');
  const syncSound = () => {
    soundBtn.innerHTML = Nova.icon(Nova.sfx.muted ? 'volume-x' : 'volume', 18);
    soundBtn.classList.toggle('off', Nova.sfx.muted);
    soundBtn.setAttribute('aria-label', Nova.sfx.muted ? 'Unmute sound' : 'Mute sound');
    soundBtn.title = Nova.sfx.muted ? 'Sound off' : 'Sound on';
  };
  soundBtn.addEventListener('click', () => Nova.sfx.toggle());
  Nova.sfx.subscribe(syncSound);
  syncSound();

  const nav = document.getElementById('topnav');
  nav.append(h('a', { href: '#/', 'data-id': '' }, 'Lobby'));
  ORDER.forEach((id) => {
    const g = gameById(id);
    if (g) nav.append(h('a', { href: '#/' + id, 'data-id': id, class: NEW.has(id) ? 'is-new' : null }, g.title));
  });

  /* account area: log in / sign up, or claim + balance + avatar menu */
  const account = document.getElementById('account');
  let closeMenu = () => {};
  function renderAccount() {
    closeMenu();
    account.replaceChildren();
    const u = Nova.auth.user;
    if (!u) {
      const login = h('button', { class: 'btn-ghost top-login', type: 'button' }, 'Log in');
      const signup = h('button', { class: 'btn-cta', type: 'button', html: Nova.icon('gift', 15) + '<span>Sign up</span>' });
      login.addEventListener('click', () => Nova.auth.open('Welcome back! Sign in with the account you used before.'));
      signup.addEventListener('click', () => Nova.auth.open());
      account.append(login, signup);
      return;
    }
    const chipVal = h('strong', { class: 'mono' }, fmt(Nova.wallet.balance));
    const setChip = Nova.ui.counter(chipVal, Nova.wallet.balance);
    const chip = h('div', { class: 'wallet-chip', title: 'Your coin balance' },
      h('span', { class: 'coin-ico', html: Nova.icon('coin', 16) }),
      h('span', { class: 'wallet-chip-label' }, 'Coins'),
      chipVal);
    Nova.ui.everySecond(chip, () => {}, Nova.wallet.subscribe(() => setChip(Nova.wallet.balance)));
    const claim = Nova.ui.claimButton('top-claim', { compact: true });

    const avBtn = h('button', { class: 'avatar-btn', type: 'button', 'aria-label': 'Account menu', 'aria-haspopup': 'true' },
      Nova.auth.avatar(u, 32), h('span', { class: 'avatar-name' }, u.name), h('span', { html: Nova.icon('chevron-down', 14) }));
    const stat = (label, val) => h('div', { class: 'menu-stat' }, h('span', {}, label), h('b', { class: 'mono' }, val));
    const menu = h('div', { class: 'acct-menu', role: 'menu' });
    const fill = () => {
      const logout = h('button', { class: 'menu-item danger', type: 'button', html: Nova.icon('log-out', 16) + '<span>Log out</span>' });
      logout.addEventListener('click', () => Nova.auth.logout());
      menu.replaceChildren(
        h('div', { class: 'menu-head' },
          Nova.auth.avatar(u, 44),
          h('div', {},
            h('b', {}, u.name),
            h('span', { class: 'prov-tag prov-' + u.provider }, Nova.auth.providerName(u.provider) + (u.demo ? ' · demo' : '')))),
        h('div', { class: 'menu-stats' },
          stat('Balance', fmt(Nova.wallet.balance)),
          stat('Wagered', fmt(u.wagered || 0)),
          stat('Best win', fmt(u.bestWin || 0)),
          stat('Free claims', fmt(u.claims || 0))),
        h('div', { class: 'menu-note muted small' }, 'Member since ' + new Date(u.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })),
        logout);
    };
    const wrap = h('div', { class: 'acct-wrap' }, avBtn, menu);
    const onDoc = (e) => { if (!wrap.contains(e.target)) closeMenu(); };
    closeMenu = () => { wrap.classList.remove('open'); document.removeEventListener('mousedown', onDoc); };
    avBtn.addEventListener('click', () => {
      if (wrap.classList.contains('open')) return closeMenu();
      fill();
      wrap.classList.add('open');
      document.addEventListener('mousedown', onDoc);
    });
    account.append(claim, chip, wrap);
  }

  /* soft UI sounds for every control (game actions play their own) */
  const CLICKY = '.bet-step, .bet-quick, .toggle-btn, .buy-btn, .btn-ghost, .btn-pill, .icon-btn:not(#soundBtn), .topnav a, .back-link, .game-card, .linklike, .avatar-btn, .menu-item, .btn-cta, .switch';
  const SELECTY = '.seg-btn, .side-btn, .mode-btn, .mode-wide, .item, .preset';
  document.addEventListener('click', (e) => {
    const el = e.target.closest(SELECTY + ',' + CLICKY);
    if (!el || el.disabled) return;
    if (el.matches(SELECTY)) Nova.sfx.select();
    else Nova.sfx.click();
  }, true);

  /* ---------- shared home pieces ---------- */
  function gameCards() {
    const locked = !Nova.auth.user;
    return h('div', { class: 'cards' }, ORDER.map(gameById).filter(Boolean).map((g, i) =>
      h('a', { class: 'game-card card-' + g.id, href: '#/' + g.id, style: { '--i': i } },
        h('div', { class: 'card-art', html: ART[g.id] || '' }),
        NEW.has(g.id) ? h('span', { class: 'card-new' }, 'New') : null,
        locked ? h('span', { class: 'card-lock', html: Nova.icon('lock', 13) + '<span>Sign in to play</span>' }) : null,
        h('div', { class: 'card-body' },
          h('div', { class: 'card-icon', html: Nova.icon(g.icon, 24) }),
          h('h3', {}, g.title),
          h('p', {}, BLURB[g.id] || g.subtitle),
          h('span', { class: 'play-now', html: 'Play now ' + Nova.icon('arrow-right', 15) })))));
  }

  /* a small self-playing crash round loop for the hero */
  function crashPreview() {
    const canvas = h('canvas', { class: 'crash-canvas', 'aria-hidden': 'true' });
    const mult = h('div', { class: 'crash-mult mono' }, '1.00×');
    const sub = h('div', { class: 'crash-sub' }, 'Next launch…');
    const hud = h('div', { class: 'crash-hud' }, mult, sub);
    const hist = h('div', { class: 'preview-hist' });
    const box = h('div', { class: 'hero-crash' },
      h('div', { class: 'preview-top' }, h('span', { class: 'live-dot' }, 'Live preview'), h('span', { class: 'muted small' }, 'Crash')),
      h('div', { class: 'crash-view' }, canvas, hud),
      hist);
    const sc = Nova.crashScene(canvas, { compact: true });
    (async () => {
      await Nova.sleep(700);
      while (box.isConnected) {
        hud.className = 'crash-hud ignite';
        sub.textContent = 'Ignition…';
        mult.textContent = '1.00×';
        await sc.ignite(800);
        if (!box.isConnected) break;
        // a short, mostly-winning flight for the demo
        const cp = Math.round((1.3 + Math.pow(Nova.rand(), 1.6) * 8) * 100) / 100;
        const cashAt = Nova.rand() < 0.7 ? Math.round((1.2 + Nova.rand() * (cp - 1.2)) * 100) / 100 : 0;
        let out = false;
        hud.className = 'crash-hud flying';
        sub.textContent = 'Flying';
        const how = await sc.fly(cp, (m) => {
          mult.textContent = Nova.fmtMult(m);
          if (cashAt && !out && m >= cashAt && cashAt < cp) {
            out = true;
            sc.markCashout(cashAt, '');
            sub.innerHTML = `<b class="good-text">Cashed out ${Nova.fmtMult(cashAt)}</b>`;
            hud.className = 'crash-hud flying cashed';
          }
        });
        if (how !== 'crash' || !box.isConnected) break;
        hud.className = 'crash-hud crashed';
        mult.textContent = Nova.fmtMult(cp);
        sub.textContent = 'Crashed!';
        const chip = h('span', { class: 'crash-chip mono ' + (cp >= 10 ? 'gold' : cp >= 2 ? 'hi' : 'lo') }, Nova.fmtMult(cp));
        hist.prepend(chip);
        while (hist.children.length > 6) hist.lastChild.remove();
        await Nova.sleep(1900);
        sc.idle();
        await Nova.sleep(400);
      }
    })();
    return box;
  }

  /* ---------- landing page (signed out) ---------- */
  function landing() {
    const step = (n, icon, title, text) => h('div', { class: 'step', style: { '--i': n } },
      h('div', { class: 'step-num mono' }, '0' + n),
      h('div', { class: 'step-icon', html: Nova.icon(icon, 22) }),
      h('h3', {}, title), h('p', {}, text));
    const stat = (big, label) => h('div', { class: 'hstat' }, h('b', { class: 'mono' }, big), h('span', {}, label));

    return h('div', { class: 'landing page-enter' },
      h('section', { class: 'hero' },
        h('div', { class: 'hero-copy' },
          h('span', { class: 'hero-kicker', html: Nova.icon('gift', 15) + `<span><b>${HOURLY} free coins</b> every hour</span>` }),
          h('h1', { class: 'hero-title', html: 'Launch higher.<br><span class="grad-hot">Win bigger.</span>' }),
          h('p', { class: 'hero-lead' }, `NOVA is a free play-money casino with ${ORDER.length} original games — the brand-new rocket Crash, candy slots, 3D blackjack and more. Create your account with Google or Discord and claim ${HOURLY} coins every single hour.`),
          Nova.auth.buttons(),
          h('div', { class: 'hero-trust' },
            h('span', { html: Nova.icon('shield-check', 15) + '<span>100% play money</span>' }),
            h('span', { html: Nova.icon('clock', 15) + '<span>Free coins hourly</span>' }),
            h('span', { html: Nova.icon('lock', 15) + '<span>No deposits — ever</span>' }))),
        h('div', { class: 'hero-visual' },
          h('div', { class: 'hero-orb', 'aria-hidden': 'true' }),
          crashPreview(),
          h('div', { class: 'hero-float f1', html: Nova.icon('gift', 16) + `<span><b>+${HOURLY}</b> claimed</span>` }),
          h('div', { class: 'hero-float f2', html: `<span class="mini-rocket">${Nova.art.rocket}</span><span>Cashed out <b class="good-text">8.42×</b></span>` }))),

      h('section', { class: 'hstats' },
        stat(String(ORDER.length), 'original games'),
        stat(HOURLY, 'free coins / hour'),
        stat('10,000×', 'max Crash multiplier'),
        stat('~96%', 'return to player')),

      h('section', { class: 'how' },
        h('div', { class: 'section-head' },
          h('h2', { html: 'Three steps to <span class="grad">lift-off</span>' }),
          h('p', {}, 'No deposits, no credit card — just sign in and play.')),
        h('div', { class: 'steps' },
          step(1, 'user', 'Create your account', 'One click with Google or Discord. Your balance, inventory and stats are saved to your account.'),
          step(2, 'gift', `Claim ${HOURLY} coins`, 'Your first coins are waiting. Come back every hour for another free batch — no limits on how often.'),
          step(3, 'rocket', 'Play & climb', 'Ride the Crash rocket, spin the slots or beat the dealer. Cash out whenever you like.'))),

      h('section', { class: 'lobby' },
        h('div', { class: 'section-head row' },
          h('div', {},
            h('h2', { html: Nova.icon('sparkles', 22) + '<span>The games</span>' }),
            h('p', {}, 'Every game uses the same coin balance. Sign in to start playing.')),
          h('div', { class: 'badges' },
            Nova.ui.pill(Nova.icon('shield-check', 14) + '<span>Random outcomes</span>', 'good'),
            Nova.ui.pill(Nova.icon('coin', 14) + '<span>Play money only</span>'))),
        gameCards()),

      h('section', { class: 'cta-band' },
        h('div', { class: 'cta-rocket', html: Nova.art.rocket }),
        h('div', { class: 'cta-copy' },
          h('h2', {}, 'Ready for lift-off?'),
          h('p', {}, `Sign up in seconds and your first ${HOURLY} coins are on us.`)),
        Nova.auth.buttons({ short: true })));
  }

  /* ---------- lobby (signed in) ---------- */
  function lobby() {
    const u = Nova.auth.user;
    const bal = h('div', { class: 'dash-balance mono' });
    const setBal = Nova.ui.counter(bal, Nova.wallet.balance);

    // claim ring: fills up over the hour
    const R = 54;
    const C = 2 * Math.PI * R;
    const ring = h('div', { class: 'claim-ring', html: `<svg viewBox="0 0 128 128" aria-hidden="true"><circle cx="64" cy="64" r="${R}" class="ring-bg"/><circle cx="64" cy="64" r="${R}" class="ring-fg" stroke-dasharray="${C}" stroke-dashoffset="${C}"/></svg>` });
    const ringText = h('div', { class: 'claim-ring-text' });
    ring.append(ringText);
    const claimCard = h('div', { class: 'dash-card claim-card' },
      ring,
      h('div', { class: 'claim-copy' },
        h('span', { class: 'field-label' }, 'Hourly bonus'),
        h('h3', {}, `${HOURLY} free coins`),
        h('p', { class: 'muted small' }, 'Claim once every hour, every account.'),
        Nova.ui.claimButton('btn-primary claim-big')));
    const syncRing = () => {
      setBal(Nova.wallet.balance);
      const left = Math.max(0, Nova.wallet.nextClaimAt() - Date.now());
      const k = 1 - left / Nova.wallet.hourlyMs;
      ring.querySelector('.ring-fg').style.strokeDashoffset = String(C * (1 - Nova.clamp(k, 0, 1)));
      ring.classList.toggle('ready', left <= 0);
      ringText.innerHTML = left <= 0 ? `${Nova.icon('gift', 26)}<b>Ready!</b>` : `<b class="mono">${Nova.fmtCountdown(left)}</b><span>until next</span>`;
      claimCard.classList.toggle('ready', left <= 0);
    };
    syncRing();
    Nova.ui.everySecond(claimCard, syncRing, Nova.wallet.subscribe(syncRing));

    const greeting = (() => { const hr = new Date().getHours(); return hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'; })();
    return h('div', { class: 'home page-enter' },
      h('section', { class: 'dash' },
        h('div', { class: 'dash-card welcome-card' },
          h('div', { class: 'welcome-top' },
            Nova.auth.avatar(u, 56),
            h('div', {},
              h('span', { class: 'muted small' }, greeting + ','),
              h('h1', {}, u.name))),
          h('span', { class: 'field-label' }, 'Your balance'),
          h('div', { class: 'dash-bal-row' }, h('span', { class: 'coin-ico big', html: Nova.icon('coin', 26) }), bal, h('span', { class: 'muted' }, 'coins')),
          h('div', { class: 'dash-mini' },
            h('span', { html: `${Nova.icon('trending', 14)}<span>Wagered <b class="mono">${fmt(u.wagered || 0)}</b></span>` }),
            h('span', { html: `${Nova.icon('trophy', 14)}<span>Best win <b class="mono">${fmt(u.bestWin || 0)}</b></span>` })),
          h('a', { class: 'btn-cta wide', href: '#/crash', html: Nova.icon('rocket', 16) + '<span>Launch Crash</span>' })),
        claimCard),
      h('div', { class: 'home-head' },
        h('h2', { html: Nova.icon('sparkles', 22) + '<span>Games</span>' }),
        h('p', {}, 'Real risk — these can win you more coins, or lose your stake entirely.')),
      gameCards());
  }

  /* ---------- gate for game pages while signed out ---------- */
  function gate(game) {
    return h('div', { class: 'gate page-enter' },
      h('a', { class: 'back-link', href: '#/', html: Nova.icon('arrow-left', 16) + '<span>Back to lobby</span>' }),
      h('div', { class: 'gate-card card-' + game.id },
        h('div', { class: 'gate-art', html: ART[game.id] || '' }),
        h('div', { class: 'gate-body' },
          h('div', { class: 'gate-lock', html: Nova.icon('lock', 22) }),
          h('h1', { html: `Sign in to play <span class="grad">${game.title}</span>` }),
          h('p', {}, `You need a free NOVA account to play. Sign in with Google or Discord and claim ${HOURLY} coins right away — then another ${HOURLY} every hour.`),
          Nova.auth.buttons({ stack: true }))));
  }

  /* ---------- router ---------- */
  let current = null;
  function route() {
    if (current) { current.destroy(); current = null; }
    document.querySelectorAll('.modal-overlay:not(.auth-overlay)').forEach((m) => m.remove());
    const id = location.hash.replace(/^#\/?/, '');
    const game = gameById(id);
    const user = Nova.auth.user;
    app.replaceChildren();
    document.body.classList.toggle('signed-out', !user);
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === (game ? id : '')));
    document.title = game ? `${game.title} – NOVA` : user ? 'Lobby – NOVA' : 'NOVA – Free play-money casino';
    if (!game) app.append(user ? lobby() : landing());
    else if (!user) app.append(gate(game));
    else {
      const shell = Nova.ui.shell(game);
      app.append(shell.root);
      game.mount(shell);
      current = shell;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  Nova.auth.subscribe((e) => {
    if (e.login || e.logout) { renderAccount(); route(); }
  });
  renderAccount();
  route();
})();
