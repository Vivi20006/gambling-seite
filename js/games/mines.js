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
      let ended = false;

      /* stage */
      const minePill = Nova.ui.pill('');
      const gemPill = Nova.ui.pill('');
      const multPill = h('span', { class: 'pill mono' }, '1.00×');
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
      const next = h('p', { class: 'muted small center', hidden: true });
      const info = h('p', { class: 'hint' }, 'More mines = bigger multiplier per safe tile, but higher risk. Cash out anytime after your first safe reveal — bust and your stake is gone.');

      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'New game'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Mines'), seg.root),
        startBtn, cashBtn, next, info);

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
          const left = SIZE - count - revealed.size;
          next.textContent = left > 0 ? `Next gem: ${fmtMult(mult(count, revealed.size + 1))}` : '';
        }
      }

      function setTiles(enabled) {
        tiles.forEach((t, i) => (t.disabled = !enabled || revealed.has(i)));
      }

      function start() {
        if (active || Nova.ui.betBlock(bet)) return;
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        mines = new Set();
        while (mines.size < count) mines.add(Nova.randInt(SIZE));
        revealed = new Set();
        active = true;
        ended = false;
        tiles.forEach((t) => {
          t.className = 'tile';
          t.innerHTML = Nova.logo();
        });
        setTiles(true);
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
        ended = true;
        setTiles(false);
        bet.lock(false);
        seg.lock(false);
        startBtn.hidden = false;
        cashBtn.hidden = true;
        next.hidden = true;
        sync();
      }

      function revealAll(hit) {
        tiles.forEach((t, i) => {
          if (revealed.has(i)) return;
          const isMine = mines.has(i);
          t.classList.add('open', 'dim', isMine ? 'mine' : 'gem');
          if (i === hit) t.classList.remove('dim');
          t.innerHTML = Nova.icon(isMine ? 'bomb' : 'gem', 30);
        });
      }

      function reveal(i) {
        if (!active || revealed.has(i)) return;
        const t = tiles[i];
        if (mines.has(i)) {
          t.classList.add('open', 'mine', 'hit');
          t.innerHTML = Nova.icon('bomb', 30);
          revealAll(i);
          status.textContent = `Boom — you hit a mine and lost ${fmt(stake)}.`;
          Nova.ui.toast(`Mine! −${fmt(stake)} tokens`, 'lose');
          finish();
          drawPills();
          return;
        }
        revealed.add(i);
        t.classList.add('open', 'gem');
        t.disabled = true;
        t.innerHTML = Nova.icon('gem', 30);
        if (revealed.size === SIZE - count) { cashOut(true); return; }
        status.textContent = 'Safe! Keep going or cash out.';
        drawPills();
      }

      function cashOut(cleared) {
        if (!active || revealed.size === 0) return;
        const m = mult(count, revealed.size);
        const win = round2(stake * m);
        Nova.wallet.credit(win);
        revealAll(-1);
        status.textContent = `${cleared ? 'Board cleared! ' : ''}Cashed out ${fmt(win)} at ${fmtMult(m)}.`;
        Nova.ui.toast(`+${fmt(win)} tokens (${fmtMult(m)})`, 'win');
        finish();
        drawPills();
      }

      startBtn.addEventListener('click', start);
      cashBtn.addEventListener('click', () => cashOut(false));
      drawPills();
    },
  });
})();
