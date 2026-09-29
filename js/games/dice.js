/* Dice – drag handles to set a win zone; smaller zone = bigger multiplier */
(function () {
  const { h, fmt, round2, clamp } = Nova;
  const EDGE = 96; // payout = 96 / win chance
  const MIN_CHANCE = 1;
  const MAX_CHANCE = 95;
  const r2 = (n) => Math.round(n * 100) / 100;

  const MODES = {
    under: { label: 'Under', n: 1, icon: '<svg viewBox="0 0 34 12" width="34" height="12"><path d="M1 6h20" stroke="currentColor" stroke-width="1.6"/><path d="M21 6l5 0" stroke="currentColor" stroke-width="1.6" opacity=".35"/><path d="M28 3 31 6 28 9 25 6z" fill="none" stroke="currentColor" stroke-width="1.5" transform="translate(-4 0)"/></svg>' },
    over: { label: 'Over', n: 1, icon: '<svg viewBox="0 0 34 12" width="34" height="12"><path d="M13 6h20" stroke="currentColor" stroke-width="1.6"/><path d="M4 6h9" stroke="currentColor" stroke-width="1.6" opacity=".35"/><path d="M10 3 13 6 10 9 7 6z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    between: { label: 'Between', n: 2, icon: '<svg viewBox="0 0 34 12" width="34" height="12"><path d="M8 6h18" stroke="currentColor" stroke-width="1.6"/><path d="M5 3 8 6 5 9 2 6z M29 3 32 6 29 9 26 6z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>' },
    outside: { label: 'Outside', n: 2, icon: '<svg viewBox="0 0 34 12" width="34" height="12"><path d="M1 6h6M27 6h6" stroke="currentColor" stroke-width="1.6"/><path d="M11 3 14 6 11 9 8 6z M26 3 23 6 26 9 29 6z" fill="none" stroke="currentColor" stroke-width="1.5" transform="translate(-1 0)"/></svg>' },
    double: { label: 'Double Range', n: 4, icon: '<svg viewBox="0 0 44 12" width="44" height="12"><path d="M8 6h7M29 6h7" stroke="currentColor" stroke-width="1.6"/><path d="M5 3 8 6 5 9 2 6z M18 3 15 6 18 9 21 6z M26 3 29 6 26 9 23 6z M39 3 36 6 39 9 42 6z" fill="none" stroke="currentColor" stroke-width="1.5" transform="translate(-1 0)"/></svg>' },
  };
  const DEFAULTS = {
    under: [50],
    over: [50.5],
    between: [25.25, 74.75],
    outside: [24.75, 75.25],
    double: [12.5, 37.25, 62.5, 87.25],
  };
  const HINT = {
    under: 'Win if the roll lands below your target.',
    over: 'Win if the roll lands above your target.',
    between: 'Win if the roll lands inside your zone.',
    outside: 'Win if the roll lands outside your zone.',
    double: 'Win if the roll lands inside either zone.',
  };

  const chanceOf = (mode, x) =>
    r2(({
      under: () => x[0],
      over: () => 100 - x[0],
      between: () => x[1] - x[0],
      outside: () => 100 - (x[1] - x[0]),
      double: () => x[1] - x[0] + (x[3] - x[2]),
    })[mode]());

  const zonesOf = (mode, x) =>
    ({
      under: () => [[0, x[0]]],
      over: () => [[x[0], 100]],
      between: () => [[x[0], x[1]]],
      outside: () => [[0, x[0]], [x[1], 100]],
      double: () => [[x[0], x[1]], [x[2], x[3]]],
    })[mode]();

  const isWin = (mode, x, roll) => zonesOf(mode, x).some(([a, b]) => roll >= a && roll < b);

  function valid(mode, x) {
    for (let i = 0; i < x.length; i++) {
      if (x[i] < 0 || x[i] > 100) return false;
      if (i && x[i] - x[i - 1] < 0.01) return false;
    }
    const c = chanceOf(mode, x);
    return c >= MIN_CHANCE - 1e-9 && c <= MAX_CHANCE + 1e-9;
  }

  Nova.register({
    id: 'dice',
    title: 'Dice',
    icon: 'dice',
    subtitle: 'Drag the slider to set your win zone. Smaller zone, bigger multiplier.',
    badges: [
      { html: Nova.icon('dice', 14) + '<span>Rolls 0.00 – 100.00</span>', cls: 'accent' },
      { html: 'Random outcomes' },
    ],
    mount(shell) {
      let mode = 'over';
      let x = DEFAULTS.over.slice();
      let busy = false;
      let won = 0, lost = 0;

      const modePill = Nova.ui.pill('');
      const chancePill = Nova.ui.pill('');
      const bigNum = h('div', { class: 'dice-num mono idle' }, '00.00');
      const hint = h('div', { class: 'dice-hint' });
      const bar = h('div', { class: 'dice-bar' });
      const marker = h('div', { class: 'dice-marker', hidden: true });
      const track = h('div', { class: 'dice-track' }, bar, marker);
      const ticks = h('div', { class: 'dice-ticks' }, ...[0, 25, 50, 75, 100].map((n) => h('span', { style: { left: n + '%' } }, String(n))));
      const status = h('p', { class: 'stage-status' }, 'Set your zone and roll. Press Space to roll again.');

      const modeBtns = {};
      const modes = h('div', { class: 'dice-modes' });
      Object.entries(MODES).forEach(([k, m]) => {
        const b = h('button', { class: 'mode-btn', type: 'button', html: m.icon + `<span>${m.label}</span>` });
        b.addEventListener('click', () => { if (!busy) setMode(k); });
        modeBtns[k] = b;
        modes.append(b);
      });

      const multInput = h('input', { class: 'calc-input mono', type: 'text', inputmode: 'decimal', 'aria-label': 'Multiplier' });
      const chanceInput = h('input', { class: 'calc-input mono', type: 'text', inputmode: 'decimal', 'aria-label': 'Win chance' });
      const profitOut = h('div', { class: 'calc-input mono out good-text' });
      const calc = h('div', { class: 'dice-calc' },
        h('label', { class: 'calc' }, h('span', { class: 'field-label' }, 'Multiplier'), h('div', { class: 'calc-wrap' }, multInput, h('em', {}, '×'))),
        h('label', { class: 'calc' }, h('span', { class: 'field-label' }, 'Win chance'), h('div', { class: 'calc-wrap' }, chanceInput, h('em', {}, '%'))),
        h('div', { class: 'calc' }, h('span', { class: 'field-label' }, 'Profit on win'), profitOut));

      const recent = Nova.ui.recent('Recent results', 'No rolls yet.', 14);

      shell.stage.append(
        h('div', { class: 'stage-top' }, modePill, chancePill),
        h('div', { class: 'dice-display' }, bigNum, hint),
        h('div', { class: 'dice-slider-block' }, h('div', { class: 'dice-slider' }, track), ticks),
        modes, calc, status, recent.root);

      const bet = Nova.ui.betControl(shell);
      const rollBtn = h('button', { class: 'btn-primary', type: 'button' });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'Roll setup'),
        bet.root, rollBtn,
        h('p', { class: 'hint' }, `Win chance ${MIN_CHANCE}%–${MAX_CHANCE}%. Payout = ${EDGE}% ÷ win chance, so a smaller zone pays more. Drag a handle, click the bar, or use the arrow keys (Shift for bigger steps).`));
      const sync = Nova.ui.bindStart(shell, rollBtn, bet, 'Roll dice', () => busy);

      /* handles */
      let handles = [];
      function buildHandles() {
        handles.forEach((el) => el.remove());
        handles = x.map((_, i) => {
          const el = h('div', { class: 'dice-handle', tabindex: '0', role: 'slider', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Handle ' + (i + 1), html: '<i></i><i></i><i></i>' });
          el.addEventListener('pointerdown', (e) => startDrag(e, i));
          el.addEventListener('keydown', (e) => {
            if (busy) return;
            const step = e.shiftKey ? 5 : 0.5;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { move(i, x[i] - step); e.preventDefault(); }
            else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { move(i, x[i] + step); e.preventDefault(); }
          });
          track.append(el);
          return el;
        });
      }

      const valueAt = (clientX) => {
        const rect = track.getBoundingClientRect();
        return r2(clamp(((clientX - rect.left) / rect.width) * 100, 0, 100));
      };

      function move(i, target) {
        target = r2(clamp(target, 0, 100));
        const tryX = (v) => { const c = x.slice(); c[i] = v; return valid(mode, c) ? c : null; };
        let ok = tryX(target);
        if (!ok) {
          // walk back toward the current value until the position is legal
          let lo = 0, hi = 1, best = null;
          for (let k = 0; k < 14; k++) {
            const mid = (lo + hi) / 2;
            const c = tryX(r2(x[i] + (target - x[i]) * mid));
            if (c) { lo = mid; best = c; } else hi = mid;
          }
          ok = best;
        }
        if (ok) { x = ok; draw(); }
      }

      function startDrag(e, i) {
        if (busy) return;
        e.preventDefault();
        const el = handles[i];
        el.setPointerCapture(e.pointerId);
        el.classList.add('drag');
        const onMove = (ev) => move(i, valueAt(ev.clientX));
        const onUp = () => {
          el.classList.remove('drag');
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
          el.removeEventListener('pointercancel', onUp);
        };
        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
        el.addEventListener('pointercancel', onUp);
      }

      track.addEventListener('pointerdown', (e) => {
        if (busy || e.target.closest('.dice-handle')) return;
        const v = valueAt(e.clientX);
        let best = 0;
        x.forEach((hx, i) => { if (Math.abs(hx - v) < Math.abs(x[best] - v)) best = i; });
        move(best, v);
        startDrag(e, best);
      });

      /* mode + inputs */
      function setMode(k) {
        mode = k;
        x = DEFAULTS[k].slice();
        buildHandles();
        draw();
      }

      function applyChance(c) {
        c = r2(clamp(c, mode === 'outside' ? 100 - MAX_CHANCE : MIN_CHANCE, mode === 'outside' ? 100 - MIN_CHANCE : MAX_CHANCE));
        c = clamp(c, MIN_CHANCE, MAX_CHANCE);
        let nx = x.slice();
        if (mode === 'under') nx = [c];
        else if (mode === 'over') nx = [r2(100 - c)];
        else if (mode === 'between' || mode === 'outside') {
          const width = mode === 'between' ? c : 100 - c;
          let mid = (x[0] + x[1]) / 2;
          mid = clamp(mid, width / 2, 100 - width / 2);
          nx = [r2(mid - width / 2), r2(mid + width / 2)];
        } else {
          const w = c / 2;
          let c1 = clamp((x[0] + x[1]) / 2, w / 2, 100);
          let c2 = clamp((x[2] + x[3]) / 2, 0, 100 - w / 2);
          if (c1 + w / 2 + 0.01 > c2 - w / 2) { c1 = 25; c2 = 75; }
          nx = [r2(c1 - w / 2), r2(c1 + w / 2), r2(c2 - w / 2), r2(c2 + w / 2)];
        }
        if (valid(mode, nx)) x = nx;
        draw();
      }

      const num = (el) => parseFloat(el.value.replace(',', '.'));
      chanceInput.addEventListener('change', () => { if (!busy && isFinite(num(chanceInput))) applyChance(num(chanceInput)); else draw(); });
      multInput.addEventListener('change', () => { if (!busy && num(multInput) > 0) applyChance(EDGE / num(multInput)); else draw(); });
      [chanceInput, multInput].forEach((el) => el.addEventListener('focus', () => el.select()));
      bet.on(draw);

      function multiplier() { return EDGE / chanceOf(mode, x); }

      function draw() {
        const chance = chanceOf(mode, x);
        const m = multiplier();
        const zones = zonesOf(mode, x);
        // red/green bar with hard stops
        const stops = [];
        let pos = 0;
        const push = (a, b, color) => { if (b > a) stops.push(`${color} ${a}%`, `${color} ${b}%`); };
        const good = '#22c55e', bad = '#ef4444';
        zones.forEach(([a, b]) => { push(pos, a, bad); push(a, b, good); pos = b; });
        push(pos, 100, bad);
        bar.style.background = `linear-gradient(90deg, ${stops.join(', ')})`;
        handles.forEach((el, i) => {
          el.style.left = x[i] + '%';
          el.setAttribute('aria-valuenow', String(x[i]));
        });
        modePill.textContent = 'Roll ' + (mode === 'double' ? 'Double Range' : MODES[mode].label);
        chancePill.innerHTML = `<b>${chance.toFixed(2)}%</b> to win`;
        hint.textContent = HINT[mode];
        Object.entries(modeBtns).forEach(([k, b]) => b.classList.toggle('active', k === mode));
        if (document.activeElement !== chanceInput) chanceInput.value = chance.toFixed(2);
        if (document.activeElement !== multInput) multInput.value = m.toFixed(4);
        profitOut.textContent = fmt(round2(bet.get() * (m - 1)));
      }

      /* rolling */
      async function roll() {
        if (busy || Nova.ui.betBlock(bet)) return;
        const stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        busy = true;
        bet.lock(true);
        rollBtn.disabled = true;
        rollBtn.textContent = 'Rolling…';
        marker.hidden = true;
        bigNum.className = 'dice-num mono';
        handles.forEach((el) => el.classList.add('locked'));

        const roll = Nova.randInt(10000) / 100;
        const win = isWin(mode, x, roll);
        const m = multiplier();
        const t0 = performance.now();
        await new Promise((res) => {
          const tick = () => {
            if (performance.now() - t0 > 650) return res();
            bigNum.textContent = (Nova.randInt(10000) / 100).toFixed(2).padStart(5, '0');
            setTimeout(tick, 45);
          };
          tick();
        });
        bigNum.textContent = roll.toFixed(2).padStart(5, '0');
        bigNum.classList.add(win ? 'win' : 'lose');
        marker.hidden = false;
        marker.style.left = roll + '%';
        marker.className = 'dice-marker ' + (win ? 'win' : 'lose');

        const payout = round2(stake * m);
        if (win) { Nova.wallet.credit(payout); won++; } else lost++;
        status.innerHTML = win
          ? `<b class="good-text">You won ${fmt(payout)} tokens</b> at ${m.toFixed(2)}×.`
          : `<b class="bad-text">You lost ${fmt(stake)} tokens.</b> Press Space to roll again.`;
        recent.add(roll.toFixed(2), win ? 'win' : 'lose');
        recent.setRight(`<b>${won}</b> won · <b>${lost}</b> lost`);
        Nova.ui.toast(win ? `+${fmt(payout)} tokens` : `−${fmt(stake)} tokens`, win ? 'win' : 'lose');
        busy = false;
        bet.lock(false);
        handles.forEach((el) => el.classList.remove('locked'));
        sync();
      }

      rollBtn.addEventListener('click', roll);
      const onKey = (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.closest('.dice-handle'))) return;
        e.preventDefault();
        roll();
      };
      document.addEventListener('keydown', onKey);
      shell.cleanup(() => document.removeEventListener('keydown', onKey));

      buildHandles();
      draw();
    },
  });
})();
