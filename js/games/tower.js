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

      const floorPill = Nova.ui.pill('');
      const diffPill = Nova.ui.pill('');
      const multPill = h('span', { class: 'pill mono' }, '1.00×');
      const tower = h('div', { class: 'tower' });
      const scroller = h('div', { class: 'tower-scroll' }, tower);
      const status = h('p', { class: 'stage-status' }, 'Pick a difficulty and bet, then start your climb.');
      const recent = Nova.ui.recent('Recent results', 'No climbs yet.', 12);
      let rows = []; // rows[f] = {el, tiles[]} f=0 is F1

      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, floorPill, diffPill), multPill),
        scroller, status, recent.root);

      const bet = Nova.ui.betControl(shell);
      const seg = Nova.ui.segmented({
        options: Object.entries(DIFFS).map(([k, d]) => ({ value: k, label: d.label, sub: `${d.safe} of ${d.tiles} safe` })),
        value: 'easy',
        onChange(v) { diff = v; buildTower(); drawPills(); },
      });
      const startBtn = h('button', { class: 'btn-primary', type: 'button' });
      const cashBtn = h('button', { class: 'btn-primary cash', type: 'button', hidden: true });
      const next = h('p', { class: 'muted small center', hidden: true });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'New climb'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Difficulty'), seg.root),
        startBtn, cashBtn, next,
        h('p', { class: 'hint' }, 'Higher difficulty means fewer safe tiles per floor and bigger multipliers, but a much higher chance of falling. Cash out anytime after your first floor.'));

      const sync = Nova.ui.bindStart(shell, startBtn, bet, 'Start climb', () => active);

      function buildTower() {
        const d = DIFFS[diff];
        tower.innerHTML = '';
        rows = [];
        for (let f = FLOORS - 1; f >= 0; f--) {
          const tiles = [];
          const rowEl = h('div', { class: 'tower-row locked' },
            h('div', { class: 'tower-label' },
              h('span', { class: 'tower-floor', html: Nova.icon('lock', 11) + `<b>F${f + 1}</b>` }),
              h('span', { class: 'muted mono tiny' }, fmtMult(mult(diff, f + 1)))),
            h('div', { class: 'tower-tiles', style: { '--n': d.tiles } }, ...Array.from({ length: d.tiles }, (_, i) => {
              const t = h('button', { class: 'tower-tile', type: 'button', disabled: true, 'aria-label': `Floor ${f + 1} tile ${i + 1}`, html: Nova.logo() });
              t.addEventListener('click', () => pick(f, i));
              tiles.push(t);
              return t;
            })));
          rows[f] = { el: rowEl, tiles };
          tower.append(rowEl);
        }
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

      function activateRow() {
        rows.forEach((r, f) => {
          const isActive = active && f === floor;
          r.el.classList.toggle('locked', !(isActive || f < floor));
          r.el.classList.toggle('current', isActive);
          r.tiles.forEach((t) => (t.disabled = !isActive));
          const lock = r.el.querySelector('.tower-floor');
          lock.innerHTML = (f < floor ? Nova.icon('gem', 11) : isActive ? '' : Nova.icon('lock', 11)) + `<b>F${f + 1}</b>`;
        });
        if (active && rows[floor]) rows[floor].el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }

      function start() {
        if (active || Nova.ui.betBlock(bet)) return;
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        const d = DIFFS[diff];
        layout = Array.from({ length: FLOORS }, () => {
          const s = new Set();
          while (s.size < d.tiles - d.safe) s.add(Nova.randInt(d.tiles));
          return s;
        });
        floor = 0;
        active = true;
        buildTower();
        bet.lock(true);
        seg.lock(true);
        startBtn.hidden = true;
        cashBtn.hidden = false;
        next.hidden = false;
        status.textContent = 'Pick a safe tile on the glowing floor.';
        activateRow();
        drawPills();
      }

      function finish() {
        active = false;
        bet.lock(false);
        seg.lock(false);
        startBtn.hidden = false;
        cashBtn.hidden = true;
        next.hidden = true;
        rows.forEach((r) => r.tiles.forEach((t) => (t.disabled = true)));
        rows.forEach((r) => r.el.classList.remove('current'));
        sync();
      }

      function revealFloor(f, chosen) {
        rows[f].tiles.forEach((t, i) => {
          const mine = layout[f].has(i);
          t.classList.add('open', mine ? 'mine' : 'gem');
          if (i !== chosen) t.classList.add('dim');
          t.innerHTML = Nova.icon(mine ? 'bomb' : 'gem', 20);
        });
      }

      function pick(f, i) {
        if (!active || f !== floor) return;
        if (layout[f].has(i)) {
          revealFloor(f, i);
          rows[f].tiles[i].classList.add('hit');
          // show what was above, dimmed
          for (let g = f + 1; g < FLOORS; g++) revealFloor(g, -1);
          status.textContent = `You fell on floor ${f + 1} and lost ${fmt(stake)}.`;
          recent.add(`${DIFFS[diff].label} · F${f + 1} · −${fmt(stake)}`, 'lose');
          Nova.ui.toast(`Fell! −${fmt(stake)} tokens`, 'lose');
          finish();
          drawPills();
          return;
        }
        revealFloor(f, i);
        floor++;
        if (floor === FLOORS) { cashOut(true); return; }
        status.textContent = 'Safe! Climb higher or cash out.';
        activateRow();
        drawPills();
      }

      function cashOut(top) {
        if (!active || floor === 0) return;
        const m = mult(diff, floor);
        const win = round2(stake * m);
        Nova.wallet.credit(win);
        status.textContent = `${top ? 'You reached the top! ' : ''}Cashed out ${fmt(win)} at ${fmtMult(m)}.`;
        recent.add(`${DIFFS[diff].label} · F${floor} · +${fmt(round2(win - stake))}`, 'win');
        Nova.ui.toast(`+${fmt(win)} tokens (${fmtMult(m)})`, 'win');
        finish();
        activateRow();
        drawPills();
      }

      startBtn.addEventListener('click', start);
      cashBtn.addEventListener('click', () => cashOut(false));
      buildTower();
      drawPills();
    },
  });
})();
