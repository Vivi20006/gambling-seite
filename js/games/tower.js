/* Tower – climb floor by floor, pick the safe tile each time */
(function () {
  const { h, fmt, fmtMult, round2 } = Nova;
  const FLOORS = 8;
  const EDGE = 0.96;
  // tiles per floor / safe tiles per floor
  const DIFFS = {
    easy: { label: 'Easy', tiles: 4, safe: 3 },
    medium: { label: 'Medium', tiles: 3, safe: 2 },
    hard: { label: 'Hard', tiles: 2, safe: 1 },
    extreme: { label: 'Extreme', tiles: 3, safe: 1 },
  };
  const mult = (d, floors) => EDGE * Math.pow(DIFFS[d].tiles / DIFFS[d].safe, floors);

  Nova.register({
    id: 'tower',
    title: 'Tower',
    icon: 'building',
    subtitle: 'Climb floor by floor. Cash out whenever you like.',
    badges: [
      { html: Nova.icon('layers', 14) + `<span>${FLOORS} floors</span>`, cls: 'accent' },
      { html: 'Random outcomes' },
    ],
    mount(shell) {
      let diff = 'easy';
      let active = false;
      let floor = 0; // floors cleared
      let layout = []; // per floor: Set of mine indexes
      let stake = 0;
      let gen = 0;
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));
      shell.cleanup(() => timers.forEach(clearTimeout));

      const floorPill = Nova.ui.pill('');
      const diffPill = Nova.ui.pill('');
      const multPill = h('span', { class: 'pill mono mult-pill' }, '1.00×');
      const tower = h('div', { class: 'tower' });
      const scroller = h('div', { class: 'tower-scroll' }, tower);
      const status = h('p', { class: 'stage-status' }, 'Pick a difficulty and bet, then start your climb.');
      const recent = Nova.ui.recent('Recent results', 'No climbs yet.', 12);
      let rows = []; // rows[f] = {el, label, tiles[]}; f=0 is F1

      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, floorPill, diffPill), multPill),
        scroller, status, recent.root);

      const bet = Nova.ui.betControl(shell);
      const seg = Nova.ui.segmented({
        options: Object.entries(DIFFS).map(([k, d]) => ({ value: k, label: d.label, sub: `${d.safe} of ${d.tiles} safe` })),
        value: 'easy',
        onChange(v) { diff = v; buildTower(true); drawPills(); },
      });
      const startBtn = h('button', { class: 'btn-primary', type: 'button' });
      const cashBtn = h('button', { class: 'btn-primary cash', type: 'button', hidden: true });
      const next = h('p', { class: 'next-hint', hidden: true });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'New climb'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Difficulty'), seg.root),
        startBtn, cashBtn, next,
        h('p', { class: 'hint' }, 'Higher difficulty means fewer safe tiles per floor and bigger multipliers, but a much higher chance of falling. Cash out anytime after your first floor.'));

      const sync = Nova.ui.bindStart(shell, startBtn, bet, 'Start climb', () => active);

      function buildTower(animate) {
        const d = DIFFS[diff];
        tower.innerHTML = '';
        rows = [];
        for (let f = FLOORS - 1; f >= 0; f--) {
          const tiles = [];
          const label = h('span', { class: 'tower-floor' });
          const rowEl = h('div', { class: 'tower-row locked' },
            h('div', { class: 'tower-label' }, label, h('span', { class: 'muted mono tiny' }, fmtMult(mult(diff, f + 1)))),
            h('div', { class: 'tower-tiles', style: { '--n': d.tiles } }, ...Array.from({ length: d.tiles }, (_, i) => {
              const t = h('button', { class: 'tower-tile', type: 'button', disabled: true, 'aria-label': `Floor ${f + 1} tile ${i + 1}`, html: Nova.logo() });
              t.addEventListener('click', () => pick(f, i));
              tiles.push(t);
              return t;
            })));
          rows[f] = { el: rowEl, label, tiles };
          tower.append(rowEl);
          if (animate) {
            Nova.anim(rowEl, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
              { duration: 320, delay: f * 40, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'backwards' });
          }
        }
        drawRows();
        scroller.scrollTop = scroller.scrollHeight;
      }

      function drawPills() {
        floorPill.innerHTML = Nova.icon('building', 14) + `Floor <b>${floor}</b> / ${FLOORS}`;
        diffPill.textContent = DIFFS[diff].label;
        multPill.textContent = fmtMult(floor ? mult(diff, floor) : 1);
        if (active) {
          const m = floor ? mult(diff, floor) : 1;
          cashBtn.disabled = floor === 0;
          cashBtn.textContent = floor ? `Cash out ${fmt(round2(stake * m))}` : 'Clear a floor first';
          next.textContent = `Next floor: ${fmtMult(mult(diff, floor + 1))}`;
        }
      }

      function drawRows() {
        rows.forEach((r, f) => {
          const isActive = active && f === floor;
          r.el.classList.toggle('locked', !(isActive || f < floor));
          r.el.classList.toggle('current', isActive);
          r.tiles.forEach((t) => (t.disabled = !isActive));
          r.label.innerHTML = (f < floor ? Nova.icon('gem', 11) : isActive ? '' : Nova.icon('lock', 11)) + `<b>F${f + 1}</b>`;
        });
        if (active && rows[floor]) {
          const r = rows[floor].el;
          scroller.scrollTo({ top: r.offsetTop - scroller.clientHeight / 2 + r.offsetHeight / 2, behavior: Nova.reducedMotion ? 'auto' : 'smooth' });
        }
      }

      function showTile(t, mine, opts = {}) {
        t.className = `tower-tile open ${mine ? 'mine' : 'gem'}${opts.dim ? ' dim' : ''}${opts.hit ? ' hit' : ''}`;
        t.innerHTML = mine ? Nova.art.bomb : Nova.art.gem;
      }

      function revealFloor(f, chosen, dim) {
        rows[f].tiles.forEach((t, i) => showTile(t, layout[f].has(i), { dim: dim || i !== chosen, hit: i === chosen && layout[f].has(i) }));
      }

      function start() {
        if (active || Nova.ui.betBlock(bet)) return;
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        gen++;
        timers.forEach(clearTimeout);
        timers.length = 0;
        const d = DIFFS[diff];
        layout = Array.from({ length: FLOORS }, () => {
          const s = new Set();
          while (s.size < d.tiles - d.safe) s.add(Nova.randInt(d.tiles));
          return s;
        });
        floor = 0;
        active = true;
        Nova.sfx.bet();
        buildTower(true);
        bet.lock(true);
        seg.lock(true);
        startBtn.hidden = true;
        cashBtn.hidden = false;
        next.hidden = false;
        status.textContent = 'Pick a safe tile on the glowing floor.';
        drawRows();
        drawPills();
      }

      function finish() {
        active = false;
        bet.lock(false);
        seg.lock(false);
        startBtn.hidden = false;
        cashBtn.hidden = true;
        next.hidden = true;
        rows.forEach((r) => {
          r.el.classList.remove('current');
          r.tiles.forEach((t) => (t.disabled = true));
        });
        sync();
      }

      // show what was hidden above, floor by floor
      function revealAbove(from) {
        const my = gen;
        for (let g = from; g < FLOORS; g++) later(() => { if (gen === my) revealFloor(g, -1, true); }, 260 + (g - from) * 90);
      }

      function pick(f, i) {
        if (!active || f !== floor) return;
        const t = rows[f].tiles[i];
        if (layout[f].has(i)) {
          revealFloor(f, i);
          Nova.sfx.boom();
          Nova.fx.at(t, { count: 30, speed: 8, size: 6, colors: ['#ef4444', '#f97316', '#fde047', '#7f1d1d'], life: 800 });
          Nova.fx.shake(scroller, 9);
          shell.flash('lose');
          finish();
          revealAbove(f + 1);
          shell.result({ win: false, big: 'Fell', small: '−' + fmt(stake), anchor: scroller });
          status.textContent = `You fell on floor ${f + 1} and lost ${fmt(stake)}.`;
          recent.add(`${DIFFS[diff].label} · F${f + 1} · −${fmt(stake)}`, 'lose');
          drawPills();
          return;
        }
        revealFloor(f, i);
        floor++;
        Nova.sfx.gem(floor);
        Nova.fx.at(t, { count: 14, speed: 4.5, size: 4, life: 650 });
        Nova.ui.bump(multPill, 1.2);
        if (floor === FLOORS) { cashOut(true); return; }
        status.textContent = 'Safe! Climb higher or cash out.';
        drawRows();
        drawPills();
      }

      function cashOut(top) {
        if (!active || floor === 0) return;
        const m = mult(diff, floor);
        const win = round2(stake * m);
        Nova.wallet.credit(win);
        Nova.sfx.cash(Nova.sfx.level(m));
        shell.flash('win');
        Nova.fx.at(scroller, { count: 46, speed: 10, life: 1100 });
        if (m >= 10) Nova.fx.confetti();
        finish();
        revealAbove(floor);
        shell.result({ win: true, big: fmtMult(m), small: '+' + fmt(win), anchor: scroller });
        status.textContent = `${top ? 'You reached the top! ' : ''}Cashed out ${fmt(win)} at ${fmtMult(m)}.`;
        recent.add(`${DIFFS[diff].label} · F${floor} · +${fmt(round2(win - stake))}`, 'win');
        drawRows();
        drawPills();
      }

      startBtn.addEventListener('click', start);
      cashBtn.addEventListener('click', () => cashOut(false));
      buildTower(false);
      drawPills();
    },
  });
})();
