/* NOVA app: topbar, hash router, home page */
(function () {
  const { h } = Nova;
  const app = document.getElementById('app');

  /* decorative card art per game (CSS + inline SVG, no external assets) */
  const ART = {
    slots: '<span class="art-float art-candy a">🍭</span><span class="art-float slow art-candy b">🍬</span><span class="art-float art-candy c">💖</span><span class="art-candy d">🍩</span><span class="art-orb">25×</span>',
    mines: `<span class="art-float art-bomb">${Nova.art.bomb}</span><span class="art-gem-sm">${Nova.art.gem}</span><span class="art-tiles"></span>`,
    coinflip: '<span class="art-float art-coin a"></span><span class="art-float slow art-coin b"></span>',
    tower: '<span class="art-tower"><i></i><i></i><i></i><i></i><i></i><i></i></span>',
    chicken: '<span class="art-float art-big chick">🐔</span><span class="art-cones">🚧</span>',
    plinko: '<span class="art-plinko"></span><span class="art-ball"></span>',
    dice: '<span class="art-float art-die a"><i></i></span><span class="art-float slow art-die b"><i></i></span>',
    upgrader: '<span class="art-float art-upg">' + Nova.icon('chevrons-up', 84) + '</span>',
  };
  const BLURB = {
    slots: 'A real 6×5 tumbling slot: match 8+ sweets anywhere, watch wins pop and new candy rain down. Land 4 lollipops for free spins with multiplier orbs up to 100×.',
    mines: 'Reveal tiles, avoid the mines, cash out before your luck runs out. Every gem raises the multiplier.',
    coinflip: 'Call heads or tails and flip. Win and you double your bet, lose and your stake is gone.',
    tower: 'Climb floor by floor, picking the safe tile each time. Multipliers stack — cash out anytime.',
    chicken: 'Cross the road lane by lane. Every safe step raises your multiplier — don\'t get run over.',
    plinko: 'Drop the ball and watch it bounce through the pegs. The edges hit the biggest multipliers.',
    dice: 'Drag your win zone, roll, and see how high you can go. Smaller zone, bigger payout.',
    upgrader: 'Stake a few tokens for a shot at a much bigger item. Pick your odds and spin the ring.',
  };
  const ORDER = ['slots', 'mines', 'coinflip', 'tower', 'chicken', 'plinko', 'dice', 'upgrader'];

  /* topbar */
  document.getElementById('brandMark').innerHTML = Nova.logo();
  document.getElementById('chipIcon').innerHTML = Nova.icon('wallet', 16);
  const chip = document.getElementById('chipBalance');
  const setChip = Nova.ui.counter(chip, Nova.wallet.balance);
  Nova.wallet.subscribe(() => setChip(Nova.wallet.balance));

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
  nav.append(h('a', { href: '#/', 'data-id': '' }, 'Minigames'));
  ORDER.forEach((id) => {
    const g = Nova.games.find((x) => x.id === id);
    if (g) nav.append(h('a', { href: '#/' + id, 'data-id': id }, g.title));
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset your balance to 1,000 tokens and clear your inventory?')) {
      Nova.wallet.reset();
      Nova.sfx.coins(8);
      Nova.ui.toast('Balance reset to 1,000 tokens', 'info');
      route();
    }
  });

  /* soft UI sounds for every control (game actions play their own) */
  const CLICKY = '.bet-step, .bet-quick, .toggle-btn, .buy-btn, .btn-ghost, .btn-pill, .icon-btn:not(#soundBtn), .topnav a, .back-link, .game-card, .linklike';
  const SELECTY = '.seg-btn, .side-btn, .mode-btn, .mode-wide, .item, .preset';
  document.addEventListener('click', (e) => {
    const el = e.target.closest(SELECTY + ',' + CLICKY);
    if (!el || el.disabled) return;
    if (el.matches(SELECTY)) Nova.sfx.select();
    else Nova.sfx.click();
  }, true);

  /* home */
  function home() {
    const cards = ORDER.map((id) => Nova.games.find((g) => g.id === id)).filter(Boolean).map((g, i) =>
      h('a', { class: 'game-card card-' + g.id, href: '#/' + g.id, style: { '--i': i } },
        h('div', { class: 'card-art', html: ART[g.id] || '' }),
        h('div', { class: 'card-body' },
          h('div', { class: 'card-icon', html: Nova.icon(g.icon, 24) }),
          h('h3', {}, g.title),
          h('p', {}, BLURB[g.id] || g.subtitle),
          h('span', { class: 'play-now', html: 'Play now ' + Nova.icon('arrow-right', 15) }))));

    return h('div', { class: 'home page-enter' },
      h('div', { class: 'home-head' },
        h('h2', { html: Nova.icon('sparkles', 22) + '<span>Games</span>' }),
        h('p', {}, 'Real risk — these can win you more tokens, or lose your stake entirely.'),
        h('div', { class: 'badges left' },
          Nova.ui.pill(Nova.icon('shield-check', 14) + '<span>Random outcomes</span>', 'good'),
          Nova.ui.pill(Nova.icon('sparkles', 14) + '<span>Cash out anytime</span>', 'accent'),
          Nova.ui.pill(Nova.icon('wallet', 14) + '<span>Play money only</span>'))),
      h('div', { class: 'cards' }, cards));
  }

  /* router */
  let current = null;
  function route() {
    if (current) { current.destroy(); current = null; }
    document.querySelectorAll('.modal-overlay').forEach((m) => m.remove());
    const id = location.hash.replace(/^#\/?/, '');
    const game = Nova.games.find((g) => g.id === id);
    app.replaceChildren();
    nav.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.id === (game ? id : '')));
    document.title = game ? `${game.title} – NOVA` : 'NOVA – Minigames';
    if (!game) { app.append(home()); }
    else {
      const shell = Nova.ui.shell(game);
      app.append(shell.root);
      game.mount(shell);
      current = shell;
    }
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', route);
  route();
})();
