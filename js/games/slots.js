/* Candy Burst – 6×5 pay-anywhere tumbling slot with free spins and multiplier orbs.
   All outcomes come from Nova.slotEngine; this file only animates them. */
(function () {
  const { h, fmt, round2 } = Nova;
  const E = Nova.slotEngine;
  const { COLS, ROWS } = E;
  const TIERS = [[500, 'Legendary win'], [100, 'Epic win'], [40, 'Mega win'], [15, 'Big win']];
  const CANDY = ['#f0abfc', '#f472b6', '#fde047', '#c084fc', '#ffffff', '#4ade80'];

  const emojiOf = (id) => (E.BY_ID[id] || E.SCATTER).emoji;
  const symHtml = (x) => (x.s === 'orb' ? `<span class="orb"><b>${x.m}×</b></span>` : `<span class="sym-emoji">${emojiOf(x.s)}</span>`);

  Nova.register({
    id: 'slots',
    title: 'Candy Burst',
    titleHtml: 'Candy <span class="grad">Burst</span>',
    icon: 'candy',
    subtitle: 'Match 8+ sweets anywhere. Wins pop, the rest tumbles — chase the free spins.',
    badges: [
      { html: Nova.icon('sparkles', 14) + '<span>6×5 · pay anywhere</span>', cls: 'accent' },
      { html: `Max win ${fmt(E.MAX_WIN)}×` },
    ],
    mount(shell) {
      let busy = false;
      let auto = false;
      let turbo = false;
      let alive = true;
      let fsLeft = 0; // free spins still to play
      let fsPlayed = 0;
      let fsTotal = 0; // bonus win so far, in bets
      let fsBet = 0;
      let pending = 0; // tokens of the current spin not yet credited
      let cells = []; // cells[c][r] = { x, el }, r = 0 is the top row
      let buyArmed = false;
      const timers = [];

      const speed = () => (turbo ? 0.5 : 1);
      const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
      const sfx = (name, ...a) => { if (alive) Nova.sfx[name](...a); };
      const fxAt = (el, o) => { if (alive && el.isConnected) Nova.fx.at(el, o); };

      /* ---------- stage ---------- */
      const modePill = Nova.ui.pill('');
      const bonusPill = Nova.ui.pill('', 'accent');
      const payBtn = h('button', { class: 'pill btn-pill', type: 'button', html: Nova.icon('book', 14) + '<span>Paytable</span>' });
      const board = h('div', { class: 'slot-board' });
      const colGlow = Array.from({ length: COLS }, (_, c) => h('div', { class: 'slot-col', style: { '--c': c } }));
      board.append(...colGlow);
      const frame = h('div', { class: 'slot-frame' }, board);
      const overlay = h('div', { class: 'slot-overlay', hidden: true });
      const winInfo = h('div', { class: 'slot-win-info' }, h('span', { class: 'muted' }, 'Match 8 or more of a kind anywhere on the grid.'));
      const winAmount = h('b', { class: 'mono' });
      const setWin = Nova.ui.counter(winAmount, 0);
      const winBar = h('div', { class: 'slot-winbar' }, winInfo, h('div', { class: 'slot-win-amount' }, h('span', {}, 'Win'), winAmount));
      const recent = Nova.ui.recent('Recent spins', 'No spins yet.', 16);

      shell.stage.classList.add('slot-stage');
      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, modePill, bonusPill), payBtn),
        h('div', { class: 'slot-wrap' }, frame, overlay),
        winBar, recent.root);

      /* ---------- controls ---------- */
      const bet = Nova.ui.betControl(shell);
      const spinBtn = h('button', { class: 'btn-primary spin-btn', type: 'button' });
      const autoBtn = h('button', { class: 'toggle-btn auto', type: 'button', html: Nova.icon('repeat', 15) + '<span>Auto</span>' });
      const turboBtn = h('button', { class: 'toggle-btn turbo', type: 'button', html: Nova.icon('zap', 15) + '<span>Turbo</span>' });
      const buyBtn = h('button', { class: 'buy-btn', type: 'button' });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'Spin'),
        bet.root,
        spinBtn,
        h('div', { class: 'toggle-row' }, autoBtn, turboBtn),
        buyBtn,
        h('p', { class: 'hint' }, `8+ matching symbols anywhere pay. Winning symbols pop and new ones tumble in until nothing matches. 4+ 🍭 award ${E.FREE_SPINS} free spins, where multiplier orbs add up and multiply the whole tumble win. Press Space to spin.`));

      const syncSpin = Nova.ui.bindStart(shell, spinBtn, bet, 'Spin', () => busy || fsLeft > 0);
      function syncBuy() {
        const price = round2(E.BUY_PRICE * bet.get());
        const can = !busy && fsLeft === 0 && Nova.wallet.canAfford(price);
        buyBtn.disabled = !can;
        buyBtn.classList.toggle('confirm', buyArmed && can);
        buyBtn.innerHTML = buyArmed && can
          ? `<b>Confirm purchase?</b><span class="mono">${fmt(price)} tokens</span>`
          : `<b>Buy free spins</b><span class="mono">${E.BUY_PRICE}× · ${fmt(price)} tokens</span>`;
      }
      bet.on(() => { buyArmed = false; syncBuy(); });
      shell.cleanup(Nova.wallet.subscribe(syncBuy));

      function drawPills() {
        if (fsLeft > 0 || fsPlayed > 0 && busy) {
          modePill.innerHTML = Nova.icon('candy', 14) + `Free spin <b>${fsPlayed}</b> · ${fsLeft} left`;
          bonusPill.hidden = false;
          bonusPill.innerHTML = `Bonus win <b class="mono">${fmt(round2(fsTotal * fsBet))}</b>`;
          if (busy) spinBtn.textContent = 'Free spins…';
        } else {
          modePill.innerHTML = Nova.icon('sparkles', 14) + 'Base game';
          bonusPill.hidden = true;
        }
      }

      function lock(b) {
        busy = b;
        bet.lock(b);
        if (b) { spinBtn.disabled = true; spinBtn.textContent = fsLeft > 0 ? 'Free spins…' : 'Spinning…'; }
        else syncSpin();
        buyArmed = false;
        syncBuy();
        drawPills();
      }

      /* ---------- board helpers ---------- */
      const setPos = (el, c, r) => { el.style.setProperty('--c', c); el.style.setProperty('--r', r); };
      function makeEl(x, c, r) {
        const el = h('div', { class: 'sym sym-' + x.s, html: symHtml(x) });
        setPos(el, c, r);
        board.append(el);
        return el;
      }
      // fall `rows` cells down into place with a little bounce
      const fall = (el, rows, delay, dur) => Nova.anim(el, [
        { transform: `translateY(${-rows * 100}%)`, easing: 'cubic-bezier(.5,0,.9,.55)' },
        { transform: 'translateY(0)', offset: 0.76, easing: 'ease-out' },
        { transform: 'translateY(-6%)', offset: 0.88, easing: 'ease-in' },
        { transform: 'translateY(0)' },
      ], { duration: dur, delay, fill: 'backwards' });

      function quietGrid() {
        // a non-winning grid just for show
        for (let i = 0; i < 50; i++) {
          const r = E.spin(Math.random, false);
          if (!r.steps.length && r.scatters < 3) return r.initial;
        }
        return E.spin(Math.random, false).final;
      }

      async function clearBoard() {
        const d = speed();
        cells.forEach((col, c) => col.forEach((cell, r) => {
          Nova.anim(cell.el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${(ROWS - r + 1) * 100}%)`, opacity: 0.3 }],
            { duration: 260 * d, delay: (c * 32 + (ROWS - 1 - r) * 14) * d, easing: 'cubic-bezier(.55,0,.9,.5)', fill: 'forwards' });
        }));
        await Nova.sleep((260 + COLS * 32 + ROWS * 14) * d);
        cells.flat().forEach((cell) => cell.el.remove());
        cells = [];
      }

      async function dropIn(grid) {
        const d = speed();
        const DUR = 470 * d;
        let seen = 0; // scatters landed in earlier columns
        let extra = 0;
        let last = 0;
        cells = grid.map((col, c) => {
          const before = seen;
          const tease = before >= 3;
          if (tease) extra += 750 * d;
          const delay = c * 80 * d + extra;
          const list = col.map((x, r) => {
            const el = makeEl(x, c, r);
            fall(el, ROWS + 1, delay + (ROWS - 1 - r) * 24 * d, DUR);
            return { x, el };
          });
          const here = col.filter((x) => x.s === 'scatter').length;
          seen += here;
          const land = delay + DUR * 0.8;
          if (tease) {
            later(() => { colGlow[c].classList.add('tease'); sfx('tease', 0.75 * d); }, Math.max(0, delay - 700 * d));
            later(() => colGlow[c].classList.remove('tease'), land + 150);
          }
          later(() => {
            sfx('plop', c);
            if (here) {
              sfx('scatter', before + here);
              list.filter((cell) => cell.x.s === 'scatter').forEach((cell) => { cell.el.classList.add('land'); fxAt(cell.el, { count: 10, speed: 4, colors: CANDY, life: 600 }); });
            }
          }, land);
          last = Math.max(last, delay + DUR + (ROWS - 1) * 24 * d);
          return list;
        });
        await Nova.sleep(last + 40);
      }

      async function playStep(step, b, index, running) {
        const d = speed();
        const ids = new Set(step.wins.map((w) => w.s));
        const winning = cells.flat().filter((cell) => ids.has(cell.x.s));
        winning.forEach((cell) => cell.el.classList.add('win'));
        winInfo.innerHTML = step.wins.map((w) => `<span class="win-chip">${w.n}× ${emojiOf(w.s)} <b class="mono">${fmt(round2(w.pay * b))}</b></span>`).join('');
        setWin(round2(running * b));
        sfx('gem', index + 1);
        await Nova.sleep(720 * d);

        // pop the winners
        winning.forEach((cell) => cell.el.classList.add('pop'));
        sfx('pop');
        winning.filter((_, i) => i % 2 === 0).slice(0, 8).forEach((cell) => fxAt(cell.el, { count: 7, speed: 4, size: 5, colors: CANDY, life: 550 }));
        await Nova.sleep(250 * d);
        winning.forEach((cell) => cell.el.remove());

        // tumble: survivors fall, new symbols rain in from the top
        let longest = 0;
        cells = cells.map((col, c) => {
          const keep = col.filter((cell) => !ids.has(cell.x.s));
          const add = step.refill[c].map((x) => ({ x, el: null }));
          const next = add.concat(keep);
          next.forEach((cell, r) => {
            const delay = c * 22 * d;
            if (cell.el) {
              const delta = r - col.indexOf(cell);
              setPos(cell.el, c, r);
              if (delta > 0) { const dur = (230 + delta * 45) * d; fall(cell.el, delta, delay, dur); longest = Math.max(longest, delay + dur); }
            } else {
              cell.el = makeEl(cell.x, c, r);
              const dl = delay + (110 + (add.length - 1 - r) * 34) * d;
              const dur = (300 + add.length * 40) * d;
              fall(cell.el, add.length + 1, dl, dur);
              longest = Math.max(longest, dl + dur);
            }
          });
          return next;
        });
        sfx('tumble');
        later(() => sfx('plop', 2), longest * 0.8);
        await Nova.sleep(longest + 90 * d);
      }

      async function applyMults(res, b) {
        const d = speed();
        const orbs = cells.flat().filter((cell) => cell.x.s === 'orb');
        let total = 0;
        for (const cell of orbs) {
          total += cell.x.m;
          cell.el.classList.add('fire');
          sfx('multi');
          fxAt(cell.el, { count: 16, speed: 6, colors: ['#fde047', '#f0abfc', '#ffffff'], life: 700 });
          winInfo.innerHTML = `<span class="win-chip mult">Multiplier <b class="mono">×${total}</b></span>`;
          Nova.ui.bump(winInfo, 1.08);
          await Nova.sleep(420 * d);
        }
        winInfo.innerHTML = `<span class="win-chip">${fmt(round2(res.win * b))}</span><span class="win-chip mult"><b class="mono">×${total}</b></span><span class="win-chip total">= <b class="mono">${fmt(round2(res.win * total * b))}</b></span>`;
        setWin(round2(res.win * total * b));
        shell.flash('win');
        await Nova.sleep(700 * d);
      }

      async function scatterPay(res, b) {
        cells.flat().filter((cell) => cell.x.s === 'scatter').forEach((cell) => { cell.el.classList.add('win'); fxAt(cell.el, { count: 12, speed: 5, colors: CANDY }); });
        winInfo.innerHTML = `<span class="win-chip">${res.scatters}× ${E.SCATTER.emoji} <b class="mono">${fmt(round2(res.scatterPay * b))}</b></span>`;
        sfx('scatter', 6);
        await Nova.sleep(900 * speed());
      }

      /* ---------- overlays ---------- */
      function showOverlay(html, ms, cls = '') {
        overlay.className = 'slot-overlay ' + cls;
        overlay.innerHTML = html + '<p class="ov-skip">Click to continue</p>';
        overlay.hidden = false;
        return new Promise((res) => {
          const done = () => { clearTimeout(t); overlay.removeEventListener('click', done); overlay.hidden = true; res(); };
          const t = setTimeout(done, ms);
          overlay.addEventListener('click', done);
          shell.cleanup(done);
        });
      }

      async function celebrate(amount, b) {
        const x = amount / b;
        const tier = TIERS.find(([min]) => x >= min);
        if (!tier) {
          if (amount > 0) sfx('win', Nova.sfx.level(x));
          return;
        }
        sfx('cash', 3);
        if (alive) Nova.fx.confetti();
        const amt = h('div', { class: 'ov-amount mono' }, '0');
        const p = showOverlay(`<h2>${tier[1]}</h2>`, 3400, 'big');
        overlay.insertBefore(amt, overlay.querySelector('.ov-skip'));
        const t0 = performance.now();
        const tick = () => {
          if (overlay.hidden) return;
          const k = Math.min(1, (performance.now() - t0) / 2200);
          amt.textContent = fmt(round2(amount * (1 - Math.pow(1 - k, 3))));
          if (k < 1) { if (Math.random() < 0.25) sfx('coins', 1); requestAnimationFrame(tick); }
        };
        requestAnimationFrame(tick);
        await p;
      }

      /* ---------- a single spin (base, free or bought) ---------- */
      async function spinOnce({ free = false, buy = false } = {}) {
        const b = free ? fsBet : bet.get();
        const res = E.spin(Nova.rand, free, buy ? { scatters: 4 } : {});
        // book everything first so leaving mid-animation never loses a win
        let units;
        if (free) {
          units = Math.min(res.total, E.MAX_WIN - fsTotal);
          fsTotal += units;
          if (E.triggers(res, true) && fsTotal < E.MAX_WIN) fsLeft += E.RETRIGGER;
        } else {
          units = Math.min(res.total, E.MAX_WIN);
          if (E.triggers(res, false)) { fsLeft = E.FREE_SPINS; fsBet = b; fsTotal = 0; fsPlayed = 0; }
        }
        pending = round2(units * b);

        setWin(0);
        winInfo.innerHTML = '<span class="muted">Good luck…</span>';
        sfx('whoosh', 0.35);
        await clearBoard();
        await dropIn(res.initial);
        let running = 0;
        for (let i = 0; i < res.steps.length; i++) {
          running += res.steps[i].win;
          await playStep(res.steps[i], b, i, running);
        }
        if (res.multSum) await applyMults(res, b);
        if (res.scatterPay) await scatterPay(res, b);

        const won = pending;
        pending = 0;
        if (won > 0) Nova.wallet.credit(won);
        setWin(won);
        if (!res.steps.length && !res.scatterPay) winInfo.innerHTML = '<span class="muted">No win this time.</span>';
        return { res, won, b };
      }

      async function runBonus() {
        const d = speed();
        drawPills();
        sfx('fanfare');
        if (alive) Nova.fx.confetti();
        await showOverlay(`<div class="ov-icon">${E.SCATTER.emoji}</div><h2>${fsLeft} Free Spins</h2><p>Multiplier orbs are in play — they add up and multiply every tumble win.</p>`, 2600, 'fs');
        shell.stage.classList.add('slot-fs');
        while (alive && fsLeft > 0 && fsTotal < E.MAX_WIN) {
          fsLeft--;
          fsPlayed++;
          drawPills();
          const before = fsLeft;
          await spinOnce({ free: true });
          drawPills();
          if (alive && fsLeft > before) {
            sfx('fanfare');
            await showOverlay(`<h2>+${E.RETRIGGER} Free Spins</h2>`, 1600, 'fs');
          }
          await Nova.sleep(420 * d);
        }
        if (!alive) return;
        shell.stage.classList.remove('slot-fs');
        const total = round2(fsTotal * fsBet);
        recent.add(`Bonus ${fmt(round2(fsTotal))}×`, fsTotal >= 1 ? 'win' : 'lose');
        const played = fsPlayed;
        fsPlayed = 0;
        fsLeft = 0;
        drawPills();
        if (total / fsBet >= TIERS[TIERS.length - 1][0]) await celebrate(total, fsBet);
        else {
          sfx(total > 0 ? 'cash' : 'lose', 2);
          await showOverlay(`<h2>Bonus complete</h2><div class="ov-amount mono">${fmt(total)}</div><p>${played} free spins played</p>`, 2600, 'fs');
        }
      }

      async function play({ buy = false } = {}) {
        if (busy || !alive) return;
        const b = bet.get();
        const cost = round2(buy ? E.BUY_PRICE * b : b);
        if (!Nova.wallet.canAfford(cost) || !Nova.wallet.debit(cost)) { sfx('error'); setAuto(false); return; }
        sfx('bet');
        lock(true);
        const { res, won } = await spinOnce({ buy });
        if (!alive) return;
        if (!buy) recent.add(won > 0 ? `${fmt(round2(won / b))}×` : '0×', won > 0 ? 'win' : 'lose');
        if (E.triggers(res, false)) {
          if (won > 0) await Nova.sleep(500 * speed());
          await runBonus();
        } else {
          await celebrate(won, b);
        }
        if (!alive) return;
        lock(false);
        if (auto) {
          if (Nova.ui.betBlock(bet)) setAuto(false);
          else later(() => { if (auto && !busy) play(); }, 380 * speed());
        }
      }

      /* ---------- paytable ---------- */
      function openPaytable() {
        const b = bet.get();
        const overlayEl = h('div', { class: 'modal-overlay' });
        const close = () => overlayEl.remove();
        overlayEl.addEventListener('click', (e) => { if (e.target === overlayEl) close(); });
        const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', html: Nova.icon('x', 18) });
        closeBtn.addEventListener('click', close);
        const rows = E.SYMBOLS.map((s) => h('tr', {},
          h('td', { class: 'pt-sym' }, s.emoji),
          ...s.pay.map((p) => h('td', { class: 'mono' }, fmt(round2(p * b))))));
        const box = h('div', { class: 'modal paytable', role: 'dialog', 'aria-label': 'Paytable' },
          h('div', { class: 'modal-head' }, h('h3', {}, 'Paytable'), closeBtn),
          h('p', { class: 'muted small' }, `Payouts for your current bet of ${fmt(b)} tokens.`),
          h('table', { class: 'pt-table' },
            h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, '8–9'), h('th', {}, '10–11'), h('th', {}, '12+'))),
            h('tbody', {}, rows)),
          h('div', { class: 'pt-note' },
            h('p', {}, h('b', {}, `${E.SCATTER.emoji} Scatter — `), `4 / 5 / 6 anywhere pay ${Object.values(E.SCATTER_PAY).map((p) => fmt(round2(p * b))).join(' / ')} and award ${E.FREE_SPINS} free spins. 3+ during free spins add ${E.RETRIGGER} more.`),
            h('p', {}, h('span', { class: 'orb mini' }, h('b', {}, '×')), ' Multiplier orbs (2× – 100×) only land in free spins. When a tumble sequence wins, all orbs on screen are added up and multiply that win.'),
            h('p', { class: 'muted' }, `Max win ${fmt(E.MAX_WIN)}× bet. Theoretical return ≈ 95–96%.`)));
        overlayEl.append(box);
        document.body.append(overlayEl);
      }

      /* ---------- wiring ---------- */
      function setAuto(on) {
        auto = on;
        autoBtn.classList.toggle('on', on);
        if (on && !busy) play();
      }
      spinBtn.addEventListener('click', () => play());
      autoBtn.addEventListener('click', () => setAuto(!auto));
      turboBtn.addEventListener('click', () => { turbo = !turbo; turboBtn.classList.toggle('on', turbo); });
      payBtn.addEventListener('click', openPaytable);
      buyBtn.addEventListener('click', () => {
        if (busy) return;
        if (!buyArmed) {
          buyArmed = true;
          syncBuy();
          later(() => { buyArmed = false; syncBuy(); }, 3500);
          return;
        }
        buyArmed = false;
        setAuto(false);
        play({ buy: true });
      });
      const onKey = (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.closest('.modal'))) return;
        e.preventDefault();
        play();
      };
      document.addEventListener('keydown', onKey);

      shell.cleanup(() => {
        alive = false;
        auto = false;
        document.removeEventListener('keydown', onKey);
        timers.forEach(clearTimeout);
        // settle whatever was still animating, then finish the bonus instantly
        if (pending) Nova.wallet.credit(pending);
        pending = 0;
        if (fsLeft > 0) {
          const units = E.playBonus(Nova.rand, fsLeft, fsTotal) - fsTotal;
          fsLeft = 0;
          if (units > 0) {
            Nova.wallet.credit(round2(units * fsBet));
            Nova.ui.toast(`Candy Burst bonus finished: +${fmt(round2(units * fsBet))} tokens`, 'win');
          }
        }
      });

      // initial, non-paying grid
      cells = quietGrid().map((col, c) => col.map((x, r) => ({ x, el: makeEl(x, c, r) })));
      cells.forEach((col, c) => col.forEach((cell, r) => fall(cell.el, ROWS + 1, c * 70 + (ROWS - 1 - r) * 20, 520)));
      drawPills();
      syncBuy();
    },
  });
})();
