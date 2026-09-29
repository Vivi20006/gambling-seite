/* Mines – 5x5 board, reveal gems, avoid mines, cash out any time after the first gem */
(function () {
  const { h, fmt, fmtMult, round2 } = Nova;
  const SIZE = 25;
  const EDGE = 0.96; // 96% RTP
  const MINE_OPTIONS = [1, 3, 5, 10, 24];

  function mult(mines, gems) {
    let m = EDGE;
    for (let i = 0; i < gems; i++) m *= (SIZE - i) / (SIZE - mines - i);
    return m;
  }
  const dist = (a, b) => Math.abs((a % 5) - (b % 5)) + Math.abs(Math.floor(a / 5) - Math.floor(b / 5));

  Nova.register({
    id: 'mines',
    title: 'Mines',
    icon: 'bomb',
    subtitle: 'Reveal gems, dodge the mines, cash out before your luck runs out.',
    badges: [
      { html: Nova.icon('gem', 14) + '<span>25-tile board</span>', cls: 'accent' },
      { html: 'Random outcomes' },
    ],
    mount(shell) {
      let active = false;
      let mines = new Set();
      let revealed = new Set();
      let count = 3;
      let stake = 0;
      let gen = 0; // bumps every game so stale reveal timers do nothing
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));
      shell.cleanup(() => timers.forEach(clearTimeout));

      /* stage */
      const minePill = Nova.ui.pill('');
      const gemPill = Nova.ui.pill('');
      const multPill = h('span', { class: 'pill mono mult-pill' }, '1.00×');
      const board = h('div', { class: 'mines-board' });
      const status = h('p', { class: 'stage-status' }, 'Set your bet and mine count, then start a game.');
      const tiles = [];
      for (let i = 0; i < SIZE; i++) {
        const t = h('button', { class: 'tile', type: 'button', disabled: true, 'aria-label': 'Tile ' + (i + 1), html: Nova.logo() });
        t.addEventListener('click', () => reveal(i));
        tiles.push(t);
        board.append(t);
      }
      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, minePill, gemPill), multPill),
        h('div', { class: 'stage-center' }, board),
        status);

      /* controls */
      const bet = Nova.ui.betControl(shell);
      const seg = Nova.ui.segmented({
        options: MINE_OPTIONS.map((n) => ({ value: n, label: String(n), sub: fmtMult(mult(n, 1)) })),
        value: 3,
        onChange(v) { count = v; drawPills(); },
      });
      const startBtn = h('button', { class: 'btn-primary', type: 'button' });
      const cashBtn = h('button', { class: 'btn-primary cash', type: 'button', hidden: true });
      const next = h('p', { class: 'next-hint', hidden: true });

      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'New game'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Mines'), seg.root),
        startBtn, cashBtn, next,
        h('p', { class: 'hint' }, 'More mines = bigger multiplier per safe tile, but higher risk. Cash out anytime after your first safe reveal — bust and your stake is gone.'));

      const sync = Nova.ui.bindStart(shell, startBtn, bet, 'Start game', () => active);

      function drawPills() {
        minePill.innerHTML = Nova.icon('bomb', 14) + `<b>${count}</b> mines`;
        gemPill.innerHTML = Nova.icon('gem', 14) + `<b>${revealed.size}</b> gems`;
        const m = revealed.size ? mult(count, revealed.size) : 1;
        multPill.textContent = fmtMult(m);
        if (active) {
          const canCash = revealed.size > 0;
          cashBtn.disabled = !canCash;
          cashBtn.textContent = canCash ? `Cash out ${fmt(round2(stake * m))}` : 'Reveal a tile first';
          next.textContent = `Next gem: ${fmtMult(mult(count, revealed.size + 1))}`;
        }
      }

      function showTile(i, kind, opts = {}) {
        const t = tiles[i];
        t.className = `tile open ${kind}${opts.dim ? ' dim' : ''}${opts.hit ? ' hit' : ''}`;
        t.innerHTML = kind === 'mine' ? Nova.art.bomb : Nova.art.gem;
        t.disabled = true;
      }

      function start() {
        if (active || Nova.ui.betBlock(bet)) return;
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        gen++;
        timers.forEach(clearTimeout);
        timers.length = 0;
        mines = new Set();
        while (mines.size < count) mines.add(Nova.randInt(SIZE));
        revealed = new Set();
        active = true;
        Nova.sfx.bet();
        tiles.forEach((t, i) => {
          t.className = 'tile';
          t.innerHTML = Nova.logo();
          t.disabled = false;
          Nova.anim(t, [{ transform: 'scale(.8)', opacity: 0.3 }, { transform: 'scale(1)', opacity: 1 }],
            { duration: 340, delay: ((i % 5) + Math.floor(i / 5)) * 26, easing: 'cubic-bezier(.2,.9,.3,1.25)', fill: 'backwards' });
        });
        bet.lock(true);
        seg.lock(true);
        startBtn.hidden = true;
        cashBtn.hidden = false;
        next.hidden = false;
        status.textContent = 'Pick a tile. Cash out whenever you like.';
        drawPills();
      }

      function finish() {
        active = false;
        tiles.forEach((t) => (t.disabled = true));
        bet.lock(false);
        seg.lock(false);
        startBtn.hidden = false;
        cashBtn.hidden = true;
        next.hidden = true;
        sync();
      }

      // flip the remaining tiles in a ripple outward from `from`
      function revealRest(from) {
        const my = gen;
        tiles.map((_, k) => k)
          .filter((k) => k !== from && !revealed.has(k))
          .sort((a, b) => dist(a, from) - dist(b, from))
          .forEach((k, n) => later(() => { if (gen === my) showTile(k, mines.has(k) ? 'mine' : 'gem', { dim: true }); }, 240 + n * 24));
      }

      function reveal(i) {
        if (!active || revealed.has(i)) return;
        if (mines.has(i)) { bust(i); return; }
        revealed.add(i);
        showTile(i, 'gem');
        Nova.sfx.gem(revealed.size);
        Nova.fx.at(tiles[i], { count: 14, speed: 4.5, size: 4, life: 650 });
        Nova.ui.bump(multPill, 1.2);
        if (revealed.size === SIZE - count) { cashOut(true); return; }
        status.textContent = 'Safe! Keep going or cash out.';
        drawPills();
      }

      function bust(i) {
        showTile(i, 'mine', { hit: true });
        Nova.sfx.boom();
        Nova.fx.at(tiles[i], { count: 34, speed: 8, size: 6, colors: ['#ef4444', '#f97316', '#fde047', '#7f1d1d', '#ffffff'], life: 850 });
        Nova.fx.shake(board, 9);
        shell.flash('lose');
        finish();
        revealRest(i);
        shell.result({ win: false, big: 'Busted', small: '−' + fmt(stake), anchor: board });
        status.textContent = `Boom — you hit a mine and lost ${fmt(stake)}.`;
        drawPills();
      }

      function cashOut(cleared) {
        if (!active || revealed.size === 0) return;
        const m = mult(count, revealed.size);
        const win = round2(stake * m);
        Nova.wallet.credit(win);
        Nova.sfx.cash(Nova.sfx.level(m));
        shell.flash('win');
        Nova.fx.at(board, { count: 46, speed: 10, life: 1100 });
        if (m >= 10) Nova.fx.confetti();
        finish();
        revealRest(12);
        shell.result({ win: true, big: fmtMult(m), small: '+' + fmt(win), anchor: board });
        status.textContent = `${cleared ? 'Board cleared! ' : ''}Cashed out ${fmt(win)} at ${fmtMult(m)}.`;
        drawPills();
      }

      startBtn.addEventListener('click', start);
      cashBtn.addEventListener('click', () => cashOut(false));
      drawPills();
    },
  });
})();
