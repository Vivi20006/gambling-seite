/* NOVA app: topbar, hash router, home page */
(function () {
  const { h } = Nova;
  const app = document.getElementById('app');

  /* decorative card art per game (CSS + emoji, no external assets) */
  const ART = {
    mines: '<span class="art-big">💣</span><span class="art-tiles"></span>',
    coinflip: '<span class="art-coin a"></span><span class="art-coin b"></span>',
    tower: '<span class="art-tower"><i></i><i></i><i></i><i></i><i></i><i></i></span>',
    chicken: '<span class="art-big chick">🐔</span><span class="art-cones">🚧</span>',
    plinko: '<span class="art-plinko"></span>',
    dice: '<span class="art-die a"><i></i></span><span class="art-die b"><i></i></span>',
    upgrader: '<span class="art-upg">' + Nova.icon('chevrons-up', 84) + '</span>',
  };
  const BLURB = {
    mines: 'Reveal tiles, avoid the mines, cash out before your luck runs out. Every play costs credit tokens and can win you more — or lose your stake.',
    coinflip: 'Call heads or tails and flip. Win and you double your bet, lose and your stake is gone — simple, fast, and always your call.',
    tower: 'Climb floor by floor, picking the safe tile each time. Multipliers stack as you go — cash out anytime, or push for the top.',
    chicken: 'Cross the road lane by lane. Every safe step raises your multiplier — cash out anytime, or push for the far side.',
    plinko: 'Drop the ball and watch it bounce through the pegs. Every run pays out instantly, edges hit the biggest multipliers.',
    dice: 'Roll the dice and enjoy instant rewards. Choose your multiplier, test your luck, and see how high you can go.',
    upgrader: 'Increase your multiplier, or risk it all for a higher one. Each roll gives you a chance to upgrade — cash out before it\'s too late.',
  };
  const ORDER = ['mines', 'coinflip', 'tower', 'chicken', 'plinko', 'dice', 'upgrader'];

  /* topbar */
  document.getElementById('brandMark').innerHTML = Nova.logo();
  document.getElementById('chipIcon').innerHTML = Nova.icon('wallet', 16);
  const chip = document.getElementById('chipBalance');
  const syncChip = () => (chip.textContent = Nova.fmt(Nova.wallet.balance));
  syncChip();
  Nova.wallet.subscribe(syncChip);

  const nav = document.getElementById('topnav');
  nav.append(h('a', { href: '#/', 'data-id': '' }, 'Minigames'));
  ORDER.forEach((id) => {
    const g = Nova.games.find((x) => x.id === id);
    if (g) nav.append(h('a', { href: '#/' + id, 'data-id': id }, g.title));
  });

  document.getElementById('resetBtn').addEventListener('click', () => {
    if (confirm('Reset your balance to 1,000 tokens and clear your inventory?')) {
      Nova.wallet.reset();
      Nova.ui.toast('Balance reset to 1,000 tokens', 'info');
      route();
    }
  });

  /* home */
  function home() {
    const cards = ORDER.map((id) => Nova.games.find((g) => g.id === id)).filter(Boolean).map((g) =>
      h('a', { class: 'game-card card-' + g.id, href: '#/' + g.id },
        h('div', { class: 'card-art', html: ART[g.id] || '' }),
        h('div', { class: 'card-body' },
          h('div', { class: 'card-icon', html: Nova.icon(g.icon, 26) }),
          h('h3', {}, g.title),
          h('p', {}, BLURB[g.id] || g.subtitle),
          h('span', { class: 'play-now', html: 'Play now ' + Nova.icon('arrow-right', 15) }))));

    return h('div', { class: 'home' },
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
