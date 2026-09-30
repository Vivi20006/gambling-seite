/* Bonbon Blast 2500 – candy-land 6×5 tumbling slot with rainbow/gold multiplier bombs,
   3 bonus buys and 4 special bets. Outcomes come from Nova.bonbonEngine; this file animates them. */
(function () {
  const { h, fmt, round2 } = Nova;
  const E = Nova.bonbonEngine;
  const { COLS, ROWS } = E;
  const BETS = [1, 2, 3, 4, 5, 10, 15, 20, 25, 50, 75, 100, 200, 500];
  const TIERS = [[1000, 'Sensational'], [250, 'Epic win'], [100, 'Mega win'], [40, 'Big win'], [15, 'Nice win']];
  const CANDY = ['#ff5fa2', '#ffd23f', '#3ec1ff', '#4ade80', '#c084fc', '#ffffff'];
  const SPECIAL_ORDER = ['ante', 'bombs', 'gold', 'scatters'];
  const SPECIAL_TEXT = {
    ante: 'Nearly double the chance to land free spins on every spin.',
    bombs: 'Every spin lands at least one rainbow multiplier bomb in the base game.',
    gold: 'Every spin lands a multiplier bomb – and about one in six is a gold bomb worth 250× to 2500×.',
    scatters: 'Every spin starts with 3 extra lollipops. One more and the free spins begin.',
  };
  const BONUS_ORDER = ['fs', 'super', 'mega'];
  const BONUS_TEXT = {
    fs: '10 free spins. Rainbow bombs 2×–100× multiply every tumble win, rare gold bombs up to 2500×.',
    super: '10 free spins where every bomb is at least 20× and gold bombs land far more often.',
    mega: '10 free spins where every bomb is at least 50× and about one in five is gold (250×–2500×).',
  };

  /* ---------- art (original candy set) ---------- */
  const DEFS = `<svg class="bb-defs" width="0" height="0" aria-hidden="true"><defs>
    <radialGradient id="bbHeart" cx=".38" cy=".32" r=".75"><stop offset="0" stop-color="#ff9aa8"/><stop offset=".5" stop-color="#f0213f"/><stop offset="1" stop-color="#a50c26"/></radialGradient>
    <radialGradient id="bbSquare" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#f7b2ff"/><stop offset=".5" stop-color="#d946ef"/><stop offset="1" stop-color="#8f1bb0"/></radialGradient>
    <radialGradient id="bbPent" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="#a8ffb4"/><stop offset=".5" stop-color="#22c55e"/><stop offset="1" stop-color="#0f7a33"/></radialGradient>
    <linearGradient id="bbOval" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a8dcff"/><stop offset=".5" stop-color="#3b82f6"/><stop offset="1" stop-color="#1e3a9e"/></linearGradient>
    <radialGradient id="bbApple" cx=".35" cy=".35" r=".8"><stop offset="0" stop-color="#ff8f8f"/><stop offset=".55" stop-color="#e11d2e"/><stop offset="1" stop-color="#8f1020"/></radialGradient>
    <radialGradient id="bbPlum" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#dcb3ff"/><stop offset=".55" stop-color="#9333ea"/><stop offset="1" stop-color="#4c1d95"/></radialGradient>
    <radialGradient id="bbMelon" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#9af5b8"/><stop offset=".55" stop-color="#22c55e"/><stop offset="1" stop-color="#14532d"/></radialGradient>
    <radialGradient id="bbGrape" cx=".35" cy=".3" r=".75"><stop offset="0" stop-color="#d4c6ff"/><stop offset=".55" stop-color="#7c3aed"/><stop offset="1" stop-color="#3b0764"/></radialGradient>
    <linearGradient id="bbBanana" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7a8"/><stop offset=".5" stop-color="#facc15"/><stop offset="1" stop-color="#c58a06"/></linearGradient>
  </defs></svg>`;
  const shine = (cx, cy, rx, ry, rot, a = 0.7) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(255,255,255,${a})" transform="rotate(${rot} ${cx} ${cy})"/>`;
  const GRAPES = [[36, 32], [52, 30], [68, 34], [28, 48], [44, 46], [60, 46], [75, 50], [36, 62], [52, 62], [67, 64], [44, 77], [59, 78]];
  const ART = {
    heart: `<path d="M50 90C22 70 6 52 9 32 12 13 35 8 50 26 65 8 88 13 91 32 94 52 78 70 50 90Z" fill="url(#bbHeart)" stroke="#8f0a20" stroke-width="3"/><path d="M50 80C30 66 18 52 19 38" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="5" stroke-linecap="round"/>${shine(32, 30, 11, 6.5, -35)}${shine(69, 27, 5, 3, 30, 0.55)}`,
    square: `<path d="M24 11h52c9 0 13 4 13 13v52c0 9-4 13-13 13H24c-9 0-13-4-13-13V24c0-9 4-13 13-13Z" fill="url(#bbSquare)" stroke="#7d168f" stroke-width="3"/><path d="M27 21h46c5 0 7 2 7 7v44c0 5-2 7-7 7H27c-5 0-7-2-7-7V28c0-5 2-7 7-7Z" fill="rgba(255,255,255,.14)"/>${shine(32, 25, 13, 5, -18)}`,
    pentagon: `<path d="M50 12 88 40 74 86H26L12 40Z" fill="#0c6b2c" stroke="#0c6b2c" stroke-width="16" stroke-linejoin="round"/><path d="M50 12 88 40 74 86H26L12 40Z" fill="url(#bbPent)" stroke="url(#bbPent)" stroke-width="10" stroke-linejoin="round"/><path d="M50 31 69 45 61 70H39L31 45Z" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.18)" stroke-width="8" stroke-linejoin="round"/>${shine(33, 35, 9, 5, -35)}`,
    oval: `<g transform="rotate(-28 50 50)"><rect x="7" y="26" width="86" height="48" rx="24" fill="#1a3690"/><rect x="10" y="28" width="80" height="42" rx="21" fill="url(#bbOval)"/><rect x="21" y="34" width="44" height="10" rx="5" fill="rgba(255,255,255,.6)"/></g>`,
    apple: `<path d="M50 30c-8-8-30-8-34 12-4 22 12 44 26 44 4 0 6-2 8-2s4 2 8 2c14 0 30-22 26-44-4-20-26-20-34-12Z" fill="url(#bbApple)" stroke="#7f0d1c" stroke-width="3"/><path d="M50 30c0-8 2-14 6-18" stroke="#6b3a1e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M54 22c6-10 18-12 24-8-4 8-14 12-24 8Z" fill="#34c759" stroke="#15803d" stroke-width="2"/>${shine(31, 46, 6, 11, 20, 0.55)}`,
    plum: `<ellipse cx="50" cy="56" rx="34" ry="32" fill="url(#bbPlum)" stroke="#3b0764" stroke-width="3"/><path d="M50 27c-5 16-5 40 0 60" stroke="rgba(0,0,0,.18)" stroke-width="3" fill="none"/><path d="M50 26c0-8 2-12 5-15" stroke="#6b3a1e" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M54 20c8-8 20-8 26-2-8 6-18 8-26 2Z" fill="#4ade80" stroke="#15803d" stroke-width="2"/>${shine(35, 45, 6, 10, 25, 0.5)}`,
    melon: `<ellipse cx="50" cy="52" rx="39" ry="33" fill="url(#bbMelon)" stroke="#14532d" stroke-width="3"/><path d="M23 37c8 10 8 30 0 36M38 23c8 14 8 43 0 56M57 21c-7 16-7 45 0 60M75 31c-8 11-8 31 0 42" stroke="#166534" stroke-width="5" fill="none" stroke-linecap="round"/>${shine(34, 35, 10, 5, -25, 0.5)}`,
    grapes: `<path d="M52 20c2-6 6-10 12-10" stroke="#6b3a1e" stroke-width="4" fill="none" stroke-linecap="round"/>${GRAPES.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="11" fill="url(#bbGrape)" stroke="#3b0764" stroke-width="1.6"/><circle cx="${x - 4}" cy="${y - 4}" r="2.8" fill="rgba(255,255,255,.65)"/>`).join('')}<path d="M54 18c10-6 22-2 26 6-10 4-20 2-26-6Z" fill="#4ade80" stroke="#15803d" stroke-width="2"/>`,
    banana: `<path d="M15 30c4 31 27 53 61 51 6 0 10-4 8-8-2-3-6-3-10-3-24 0-40-16-46-40-1-4-4-6-8-5-3 1-5 3-5 5Z" fill="url(#bbBanana)" stroke="#9a6206" stroke-width="3" stroke-linejoin="round"/><path d="M22 34c6 24 22 38 48 40" stroke="rgba(255,255,255,.6)" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M13 27l6-5 4 6Z" fill="#5b3a1e"/><path d="M80 72l6 1-2 5Z" fill="#5b3a1e"/>`,
    scatter: `<rect x="46.5" y="60" width="7" height="38" rx="3.5" fill="#fafafa" stroke="#cfcfd6" stroke-width="1.5"/><circle cx="50" cy="40" r="35" fill="#fff" /><circle cx="50" cy="40" r="32" fill="#ff5fa2"/><path d="M50 40a4 4 0 0 1 8 0a8 8 0 0 1-16 0a12 12 0 0 1 24 0a16 16 0 0 1-32 0a20 20 0 0 1 40 0a24 24 0 0 1-48 0a28 28 0 0 1 56 0" fill="none" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/><path d="M50 40a6 6 0 0 1 12 0a10 10 0 0 1-20 0a14 14 0 0 1 28 0a18 18 0 0 1-36 0a22 22 0 0 1 44 0a26 26 0 0 1-52 0" fill="none" stroke="#ffd23f" stroke-width="2.5" stroke-linecap="round" opacity=".85"/>${shine(36, 23, 9, 5, -30, 0.75)}`,
  };
  const symSvg = (id) => `<svg class="bb-art" viewBox="0 0 100 100" aria-hidden="true">${ART[id]}</svg>`;
  const bombHtml = (x) => `<span class="bb-bomb${x.gold ? ' gold' : ''}"><i class="bb-fuse"></i><b>${x.m}x</b></span>`;
  const symHtml = (x) => (x.s === 'orb' ? bombHtml(x) : symSvg(x.s));

  const SCENERY = `<div class="bb-scenery" aria-hidden="true">
      <i class="cloud c1"></i><i class="cloud c2"></i><i class="cloud c3"></i><i class="cloud c4"></i>
      <i class="hill h1"></i><i class="hill h2"></i><i class="hill h3"></i>
      <span class="deco lolly l1">${symSvg('scatter')}</span><span class="deco lolly l2">${symSvg('scatter')}</span>
      <span class="deco swirl s1"></span><span class="deco swirl s2"></span>
      <span class="deco cane"></span>
    </div>`;
  const TITLE = `<div class="bb-title" aria-label="Bonbon Blast 2500">${'BONBON'.split('').map((c, i) => `<span class="c${i % 5}">${c}</span>`).join('')}<span class="gap"></span>${'BLAST'.split('').map((c, i) => `<span class="c${(i + 2) % 5}">${c}</span>`).join('')}<em>2500</em></div>`;

  Nova.register({
    id: 'bonbon',
    title: 'Bonbon Blast 2500',
    titleHtml: 'Bonbon Blast <span class="grad">2500</span>',
    icon: 'candy',
    wide: true,
    subtitle: 'Candy-land tumbling slot with multiplier bombs up to 2500×, bonus buys and special bets.',
    badges: [
      { html: Nova.icon('sparkles', 14) + '<span>Bombs up to 2500×</span>', cls: 'accent' },
      { html: `Max win ${fmt(E.MAX_WIN)}×` },
    ],
    mount(shell) {
      let betIdx = 0;
      let special = 'off';
      let busy = false;
      let turbo = false;
      let alive = true;
      let autoLeft = 0;
      let fsLeft = 0;
      let fsPlayed = 0;
      let fsTotal = 0; // bonus win so far, in bets
      let fsBet = 0;
      let bonusType = 'fs';
      let pending = 0;
      let cells = [];
      const timers = [];

      const speed = () => (turbo ? 0.45 : 1);
      const later = (fn, ms) => timers.push(setTimeout(() => { if (alive) fn(); }, ms));
      const sfx = (name, ...a) => { if (alive) Nova.sfx[name](...a); };
      const fxAt = (el, o) => { if (alive && el.isConnected) Nova.fx.at(el, o); };
      const bet = () => BETS[betIdx];
      const spinCost = () => round2(bet() * E.SPECIAL[special].cost);

      /* ---------- machine ---------- */
      shell.stage.classList.add('bb-stage');
      const m = h('div', { class: 'bb', html: DEFS + SCENERY + TITLE });

      const buyTile = h('button', { class: 'bb-tile buy', type: 'button', html: '<b>BUY<br>FEATURE</b><small>3 OPTIONS</small>' });
      const specialTile = h('button', { class: 'bb-tile special', type: 'button', html: '<b>SPECIAL<br>BETS</b><small>4 OPTIONS</small><span class="bb-toggle"><i></i></span>' });
      const infoTop = h('div', { class: 'bb-info-top' });
      const infoBig = h('div', { class: 'bb-info-big' });
      const infoSub = h('div', { class: 'bb-info-sub' });
      const info = h('div', { class: 'bb-info' }, infoTop, infoBig, infoSub);
      const left = h('div', { class: 'bb-left' }, buyTile, specialTile, info);

      const board = h('div', { class: 'bb-board' });
      const colGlow = Array.from({ length: COLS }, (_, c) => h('div', { class: 'bb-col', style: { '--c': c } }));
      board.append(...colGlow);
      const frame = h('div', { class: 'bb-frame' }, h('div', { class: 'bb-frosting' }), board);

      const credit = h('b', { class: 'mono' });
      const setCredit = Nova.ui.counter(credit, Nova.wallet.balance);
      const betOut = h('b', { class: 'mono' });
      const msg = h('div', { class: 'bb-msg' });
      const minus = h('button', { class: 'bb-round small', type: 'button', 'aria-label': 'Lower bet', html: Nova.icon('minus', 22) });
      const plus = h('button', { class: 'bb-round small', type: 'button', 'aria-label': 'Raise bet', html: Nova.icon('plus', 22) });
      const spinBtn = h('button', { class: 'bb-spin', type: 'button', 'aria-label': 'Spin', html: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M36 17a14 14 0 0 0-24-2" /><path d="M12 8v7h7"/><path d="M12 31a14 14 0 0 0 24 2"/><path d="M36 40v-7h-7"/></svg>' });
      const autoBtn = h('button', { class: 'bb-pill', type: 'button' }, 'AUTOPLAY');
      const turboBtn = h('button', { class: 'bb-pill icon', type: 'button', 'aria-label': 'Turbo', html: Nova.icon('zap', 14) });
      const infoBtn = h('button', { class: 'bb-pill icon', type: 'button', 'aria-label': 'Paytable', html: '<b>i</b>' });
      const bar = h('div', { class: 'bb-bar' },
        h('div', { class: 'bb-money' }, h('div', {}, h('span', {}, 'CREDIT '), credit), h('div', {}, h('span', {}, 'BET '), betOut)),
        msg,
        h('div', { class: 'bb-controls' },
          h('div', { class: 'bb-spinrow' }, minus, spinBtn, plus),
          h('div', { class: 'bb-pills' }, infoBtn, autoBtn, turboBtn)));

      const overlay = h('div', { class: 'bb-overlay', hidden: true });
      const modal = h('div', { class: 'bb-modal-layer', hidden: true });
      m.append(left, frame, bar, overlay, modal);
      shell.stage.append(m);

      /* ---------- ui state ---------- */
      function drawMoney() {
        betOut.textContent = fmt(spinCost(), 2);
        setCredit(Nova.wallet.balance);
      }
      function drawInfo() {
        if (fsLeft > 0 || fsPlayed > 0) {
          infoTop.textContent = E.BONUS[bonusType].name.toUpperCase();
          infoBig.textContent = String(fsLeft);
          infoSub.innerHTML = `SPINS LEFT<br><span>WIN ${fmt(round2(fsTotal * fsBet))}</span>`;
        } else if (special !== 'off') {
          infoTop.textContent = 'SPECIAL BET';
          infoBig.textContent = E.SPECIAL[special].name.toUpperCase();
          infoSub.textContent = `${E.SPECIAL[special].cost}× BET PER SPIN`;
        } else {
          infoTop.textContent = 'WIN UP TO';
          infoBig.textContent = fmt(E.MAX_WIN) + '×';
          infoSub.textContent = 'PAY ANYWHERE · 8+';
        }
        info.classList.toggle('big-text', special !== 'off' && !(fsLeft > 0 || fsPlayed > 0));
        specialTile.classList.toggle('on', special !== 'off');
      }
      function setMsg(html) { msg.innerHTML = html; }
      function syncControls() {
        const inBonus = fsLeft > 0 || fsPlayed > 0;
        minus.disabled = busy || autoLeft > 0 || betIdx === 0;
        plus.disabled = busy || autoLeft > 0 || betIdx === BETS.length - 1;
        spinBtn.disabled = (busy && !autoLeft) || inBonus;
        spinBtn.classList.toggle('spinning', busy);
        spinBtn.classList.toggle('stop', autoLeft > 0);
        buyTile.disabled = busy || autoLeft > 0 || special !== 'off';
        specialTile.disabled = busy || autoLeft > 0;
        autoBtn.textContent = autoLeft > 0 ? (autoLeft === Infinity ? 'STOP ∞' : `STOP ${autoLeft}`) : 'AUTOPLAY';
        autoBtn.classList.toggle('on', autoLeft > 0);
        drawMoney();
        drawInfo();
      }
      shell.cleanup(Nova.wallet.subscribe(() => drawMoney()));

      /* ---------- board helpers ---------- */
      const setPos = (el, c, r) => { el.style.setProperty('--c', c); el.style.setProperty('--r', r); };
      function makeEl(x, c, r) {
        const el = h('div', { class: 'bb-sym s-' + x.s, html: symHtml(x) });
        setPos(el, c, r);
        board.append(el);
        return el;
      }
      const fall = (el, rows, delay, dur) => Nova.anim(el, [
        { transform: `translateY(${-rows * 100}%)`, easing: 'cubic-bezier(.5,0,.9,.55)' },
        { transform: 'translateY(0) scale(1.06, .92)', offset: 0.74, easing: 'ease-out' },
        { transform: 'translateY(-7%) scale(.97, 1.04)', offset: 0.87, easing: 'ease-in' },
        { transform: 'translateY(0)' },
      ], { duration: dur, delay, fill: 'backwards' });

      function quietGrid() {
        for (let i = 0; i < 60; i++) {
          const r = E.spin(Math.random, E.baseCfg('off'));
          if (!r.steps.length && r.scatters < 3) return r.initial;
        }
        return E.spin(Math.random, E.baseCfg('off')).final;
      }

      async function clearBoard() {
        const d = speed();
        cells.forEach((col, c) => col.forEach((cell, r) => {
          Nova.anim(cell.el, [{ transform: 'translateY(0)', opacity: 1 }, { transform: `translateY(${(ROWS - r + 1) * 100}%)`, opacity: 0.4 }],
            { duration: 250 * d, delay: (c * 30 + (ROWS - 1 - r) * 12) * d, easing: 'cubic-bezier(.55,0,.9,.5)', fill: 'forwards' });
        }));
        await Nova.sleep((250 + COLS * 30 + ROWS * 12) * d);
        cells.flat().forEach((cell) => cell.el.remove());
        cells = [];
      }

      async function dropIn(grid, free) {
        const d = speed();
        const DUR = 460 * d;
        let seen = 0;
        let extra = 0;
        let last = 0;
        const need = free ? 3 : 4;
        cells = grid.map((col, c) => {
          const before = seen;
          const tease = before >= need - 1 && c > 0;
          if (tease) extra += 800 * d;
          const delay = c * 75 * d + extra;
          const list = col.map((x, r) => {
            const el = makeEl(x, c, r);
            fall(el, ROWS + 1, delay + (ROWS - 1 - r) * 22 * d, DUR);
            return { x, el };
          });
          const here = col.filter((x) => x.s === 'scatter').length;
          seen += here;
          const land = delay + DUR * 0.78;
          if (tease) {
            later(() => { colGlow[c].classList.add('tease'); sfx('tease', 0.8 * d); }, Math.max(0, delay - 750 * d));
            later(() => colGlow[c].classList.remove('tease'), land + 160);
          }
          later(() => {
            sfx('plop', c);
            list.forEach((cell) => {
              if (cell.x.s === 'scatter') { cell.el.classList.add('land'); fxAt(cell.el, { count: 10, speed: 4, colors: CANDY, life: 600 }); }
              if (cell.x.s === 'orb') { cell.el.classList.add('land'); sfx('coins', 1); }
            });
            if (here) sfx('scatter', before + here);
          }, land);
          last = Math.max(last, delay + DUR + (ROWS - 1) * 22 * d);
          return list;
        });
        await Nova.sleep(last + 40);
      }

      async function playStep(step, b, index, running) {
        const d = speed();
        const ids = new Set(step.wins.map((w) => w.s));
        const winning = cells.flat().filter((cell) => ids.has(cell.x.s));
        winning.forEach((cell) => cell.el.classList.add('win'));
        setMsg(step.wins.map((w) => `<span class="bb-chip">${symSvg(w.s)}<b>${w.n}</b> PAYS <b>${fmt(round2(w.pay * b))}</b></span>`).join(''));
        sfx('gem', index + 1);
        await Nova.sleep(760 * d);
        winning.forEach((cell) => cell.el.classList.add('pop'));
        sfx('pop');
        winning.filter((_, i) => i % 2 === 0).slice(0, 8).forEach((cell) => fxAt(cell.el, { count: 8, speed: 4.5, size: 5, colors: CANDY, life: 560 }));
        await Nova.sleep(260 * d);
        winning.forEach((cell) => cell.el.remove());
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
              if (cell.x.s === 'orb') later(() => cell.el.classList.add('land'), dl + dur * 0.75);
            }
          });
          return next;
        });
        sfx('tumble');
        later(() => sfx('plop', 2), longest * 0.8);
        setMsg(`WIN <b class="mono">${fmt(round2(running * b))}</b>`);
        await Nova.sleep(longest + 90 * d);
      }

      async function applyBombs(res, b) {
        const d = speed();
        const bombs = cells.flat().filter((cell) => cell.x.s === 'orb');
        let total = 0;
        for (const cell of bombs) {
          total += cell.x.m;
          cell.el.classList.add('fire');
          sfx('multi');
          if (cell.x.gold) { sfx('cash', 2); shell.flash('win'); }
          fxAt(cell.el, { count: cell.x.gold ? 34 : 18, speed: cell.x.gold ? 9 : 6, colors: cell.x.gold ? ['#fde047', '#f59e0b', '#ffffff'] : CANDY, life: 800 });
          setMsg(`MULTIPLIER <b class="mono bb-x">x${total}</b>`);
          infoSub.innerHTML = `MULTIPLIER<br><span>x${total}</span>`;
          await Nova.sleep(460 * d);
          cell.el.classList.add('spent');
        }
        setMsg(`<b class="mono">${fmt(round2(res.win * b))}</b> × <b class="mono bb-x">${total}</b> = <b class="mono bb-total">${fmt(round2(res.win * total * b))}</b>`);
        shell.flash('win');
        await Nova.sleep(900 * d);
      }

      async function scatterPay(res, b) {
        cells.flat().filter((cell) => cell.x.s === 'scatter').forEach((cell) => { cell.el.classList.add('win'); fxAt(cell.el, { count: 12, speed: 5, colors: CANDY }); });
        setMsg(`<span class="bb-chip">${symSvg('scatter')}<b>${res.scatters}</b> PAYS <b>${fmt(round2(res.scatterPay * b))}</b></span>`);
        sfx('scatter', 6);
        await Nova.sleep(900 * speed());
      }

      /* ---------- overlays ---------- */
      function showOverlay(html, ms, cls = '', button) {
        overlay.className = 'bb-overlay ' + cls;
        overlay.innerHTML = html + (button ? `<button class="bb-cta" type="button">${button}</button>` : '<p class="bb-skip">Click to continue</p>');
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
        if (!tier) { if (amount > 0) sfx('win', Nova.sfx.level(x)); return; }
        sfx('cash', 3);
        if (alive) Nova.fx.confetti();
        const amt = h('div', { class: 'bb-amount mono' }, '0');
        const p = showOverlay(`<h2>${tier[1]}</h2>`, 3600, 'big');
        overlay.insertBefore(amt, overlay.lastChild);
        const t0 = performance.now();
        const tick = () => {
          if (overlay.hidden) return;
          const k = Math.min(1, (performance.now() - t0) / 2400);
          amt.textContent = fmt(round2(amount * (1 - Math.pow(1 - k, 3))));
          if (k < 1) { if (Math.random() < 0.25) sfx('coins', 1); requestAnimationFrame(tick); }
        };
        requestAnimationFrame(tick);
        await p;
      }

      /* ---------- one spin ---------- */
      async function spinOnce({ free = false, buy = null } = {}) {
        const b = free ? fsBet : bet();
        const cfg = free ? E.freeCfg(bonusType) : buy ? { ...E.baseCfg('off'), forceScatters: 4 } : E.baseCfg(special);
        const res = E.spin(Nova.rand, cfg);
        // book everything before animating so leaving mid-spin never loses a win
        let units;
        if (free) {
          units = Math.min(res.total, E.MAX_WIN - fsTotal);
          fsTotal += units;
          if (E.triggers(res, true) && fsTotal < E.MAX_WIN) fsLeft += E.RETRIGGER;
        } else {
          units = Math.min(res.total, E.MAX_WIN);
          if (buy || E.triggers(res, false)) { bonusType = buy || 'fs'; fsLeft = E.FREE_SPINS; fsBet = b; fsTotal = units; fsPlayed = 0; units = 0; }
        }
        pending = round2(units * b);
        if (!free && fsLeft > 0) pending = round2(fsTotal * b); // trigger spin's win counts toward the bonus total
        setMsg(free ? `FREE SPIN <b>${fsPlayed}</b>` : 'GOOD LUCK!');
        sfx('whoosh', 0.35);
        await clearBoard();
        await dropIn(res.initial, free);
        let running = 0;
        for (let i = 0; i < res.steps.length; i++) {
          running += res.steps[i].win;
          await playStep(res.steps[i], b, i, running);
        }
        if (res.multSum) await applyBombs(res, b);
        if (res.scatterPay) await scatterPay(res, b);
        const won = pending;
        pending = 0;
        if (won > 0) Nova.wallet.credit(won);
        const shown = round2(res.total * b);
        setMsg(shown > 0 ? `WIN <b class="mono">${fmt(shown)}</b>` : free ? 'NO WIN' : 'PLACE YOUR BETS!');
        return { res, won: shown, b };
      }

      async function runBonus() {
        const d = speed();
        syncControls();
        sfx('fanfare');
        if (alive) Nova.fx.confetti();
        await showOverlay(`<div class="bb-ov-icon">${symSvg('scatter')}</div><p class="bb-kicker">CONGRATULATIONS!</p><h2>${fsLeft} ${E.BONUS[bonusType].name}</h2><p>${BONUS_TEXT[bonusType]}</p>`, 6000, 'fs', 'START');
        m.classList.add('fs');
        while (alive && fsLeft > 0 && fsTotal < E.MAX_WIN) {
          fsLeft--;
          fsPlayed++;
          syncControls();
          const before = fsLeft;
          await spinOnce({ free: true });
          syncControls();
          if (alive && fsLeft > before) {
            sfx('fanfare');
            await showOverlay(`<h2>+${E.RETRIGGER} Free Spins</h2>`, 1800, 'fs');
          }
          await Nova.sleep(450 * d);
        }
        if (!alive) return;
        m.classList.remove('fs');
        const total = round2(fsTotal * fsBet);
        const played = fsPlayed;
        fsPlayed = 0;
        fsLeft = 0;
        syncControls();
        if (total / fsBet >= TIERS[TIERS.length - 1][0]) await celebrate(total, fsBet);
        sfx(total > 0 ? 'cash' : 'lose', 2);
        await showOverlay(`<p class="bb-kicker">CONGRATULATIONS!</p><p>YOU HAVE WON</p><div class="bb-amount mono">${fmt(total)}</div><p>IN ${played} FREE SPINS</p>`, 4000, 'fs', 'CONTINUE');
        setMsg(`BONUS WIN <b class="mono">${fmt(total)}</b>`);
      }

      async function play({ buy = null } = {}) {
        if (busy || !alive) return;
        const b = bet();
        const cost = round2(buy ? E.BONUS[buy].price * b : spinCost());
        if (!Nova.wallet.canAfford(cost) || !Nova.wallet.debit(cost)) {
          sfx('error');
          autoLeft = 0;
          setMsg('NOT ENOUGH CREDIT');
          syncControls();
          return;
        }
        sfx('bet');
        busy = true;
        syncControls();
        const { res, won } = await spinOnce({ buy });
        if (!alive) return;
        if (buy || E.triggers(res, false)) {
          if (autoLeft !== Infinity) autoLeft = 0;
          await Nova.sleep(500 * speed());
          await runBonus();
          autoLeft = 0;
        } else {
          await celebrate(won, b);
        }
        if (!alive) return;
        busy = false;
        if (autoLeft > 0) {
          if (autoLeft !== Infinity) autoLeft--;
          if (autoLeft > 0 && Nova.wallet.canAfford(spinCost())) { syncControls(); later(() => play(), 320 * speed()); return; }
          autoLeft = 0;
        }
        syncControls();
      }

      /* ---------- modals ---------- */
      function openModal(title, body, cls = '') {
        modal.innerHTML = '';
        const close = h('button', { class: 'bb-x-btn', type: 'button', 'aria-label': 'Close', html: Nova.icon('x', 20) });
        const box = h('div', { class: 'bb-modal ' + cls, role: 'dialog', 'aria-label': title }, h('div', { class: 'bb-modal-head' }, h('h3', {}, title), close), body);
        modal.append(box);
        modal.hidden = false;
        const shut = () => { modal.hidden = true; modal.innerHTML = ''; };
        close.addEventListener('click', shut);
        modal.onclick = (e) => { if (e.target === modal) shut(); };
        sfx('select');
        return shut;
      }

      function openBuy() {
        if (busy || special !== 'off') return;
        const b = bet();
        const grid = h('div', { class: 'bb-buy-grid' });
        const body = h('div', {}, grid);
        const shut = openModal('BUY FEATURE', body, 'buy');
        BONUS_ORDER.forEach((k) => {
          const o = E.BONUS[k];
          const price = round2(o.price * b);
          const can = Nova.wallet.canAfford(price);
          const buyBtn = h('button', { class: 'bb-buy-btn', type: 'button', disabled: !can }, can ? `BUY ${fmt(price)}` : 'NOT ENOUGH CREDIT');
          const card = h('div', { class: 'bb-buy-card k-' + k },
            h('div', { class: 'bb-buy-art', html: symSvg('scatter') + bombHtml({ m: k === 'fs' ? 25 : k === 'super' ? 100 : 2500, gold: k === 'mega' }) }),
            h('h4', {}, o.name.toUpperCase()),
            h('p', {}, BONUS_TEXT[k]),
            h('div', { class: 'bb-price' }, h('span', {}, `${o.price}× BET`), h('b', { class: 'mono' }, fmt(price))),
            buyBtn);
          buyBtn.addEventListener('click', () => {
            // confirmation step, like the real thing
            body.innerHTML = '';
            const yes = h('button', { class: 'bb-cta', type: 'button' }, 'YES');
            const no = h('button', { class: 'bb-cta ghost', type: 'button' }, 'NO');
            body.append(h('div', { class: 'bb-confirm' },
              h('div', { class: 'bb-buy-art big', html: symSvg('scatter') + bombHtml({ m: k === 'mega' ? 2500 : 100, gold: k === 'mega' }) }),
              h('p', {}, 'ARE YOU SURE YOU WANT TO BUY'),
              h('h4', {}, o.name.toUpperCase()),
              h('p', {}, 'AT THE COST OF'),
              h('div', { class: 'bb-amount mono' }, fmt(price)),
              h('div', { class: 'bb-confirm-row' }, no, yes)));
            no.addEventListener('click', () => { shut(); openBuy(); });
            yes.addEventListener('click', () => { shut(); play({ buy: k }); });
            sfx('select');
          });
          grid.append(card);
        });
      }

      function openSpecial() {
        if (busy) return;
        const list = h('div', { class: 'bb-special-list' });
        openModal('SPECIAL BETS', list, 'special');
        const render = () => {
          list.innerHTML = '';
          SPECIAL_ORDER.forEach((k) => {
            const o = E.SPECIAL[k];
            const on = special === k;
            const sw = h('button', { class: 'bb-switch' + (on ? ' on' : ''), type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': o.name }, h('i'));
            const row = h('div', { class: 'bb-special' + (on ? ' on' : '') },
              h('div', { class: 'bb-special-text' },
                h('h4', {}, o.name.toUpperCase()),
                h('p', {}, SPECIAL_TEXT[k]),
                h('div', { class: 'bb-price' }, h('span', {}, 'BET'), h('b', { class: 'mono' }, `${fmt(round2(o.cost * bet()))}`), h('span', {}, `(${o.cost}×)`))),
              sw);
            sw.addEventListener('click', () => {
              special = on ? 'off' : k;
              sfx(on ? 'click' : 'switchOn');
              render();
              syncControls();
              setMsg(special === 'off' ? 'SPECIAL BETS OFF' : `${E.SPECIAL[special].name.toUpperCase()} ON`);
            });
            list.append(row);
          });
          list.append(h('p', { class: 'bb-note' }, 'Only one special bet can be active. Buy Feature is unavailable while a special bet is on.'));
        };
        render();
      }

      function openAuto() {
        if (busy) return;
        const grid = h('div', { class: 'bb-auto-grid' });
        const shut = openModal('AUTOPLAY', h('div', {}, h('p', { class: 'bb-note' }, 'Number of spins. Autoplay stops on free spins or when credit runs out.'), grid), 'auto');
        [10, 25, 50, 100, 500, Infinity].forEach((n) => {
          const b = h('button', { class: 'bb-cta ghost', type: 'button' }, n === Infinity ? '∞' : String(n));
          b.addEventListener('click', () => { shut(); autoLeft = n; syncControls(); play(); });
          grid.append(b);
        });
      }

      function openPaytable() {
        const b = bet();
        const rows = E.SYMBOLS.map((s) => h('div', { class: 'bb-pay' }, h('span', { html: symSvg(s.id) }),
          h('div', {}, ...s.pay.map((p, i) => h('div', {}, h('em', {}, ['8–9', '10–11', '12+'][i]), h('b', { class: 'mono' }, fmt(round2(p * b))))))));
        openModal('PAYTABLE', h('div', {},
          h('div', { class: 'bb-pay-grid' }, rows),
          h('div', { class: 'bb-rules' },
            h('p', { html: `${symSvg('scatter')} <b>SCATTER</b> – 4 / 5 / 6 pay ${Object.values(E.SCATTER_PAY).map((p) => fmt(round2(p * b))).join(' / ')} and award ${E.FREE_SPINS} free spins. 3 more during free spins add ${E.RETRIGGER}.` }),
            h('p', { html: `${bombHtml({ m: 10 })} <b>MULTIPLIER BOMBS</b> – land in free spins (and with Bomb Rush / Gold Rush). Rainbow 2×–100×, gold 250×–2500×. All bombs on screen add up and multiply the tumble win.` }),
            h('p', {}, `Wins are paid for 8+ matching symbols anywhere. Max win ${fmt(E.MAX_WIN)}× bet. All options (standard spin, special bets, bonus buys) are tuned by simulation to about 95–97% return.`))), 'pay');
      }

      /* ---------- wiring ---------- */
      spinBtn.addEventListener('click', () => {
        if (autoLeft > 0) { autoLeft = 0; syncControls(); return; }
        play();
      });
      minus.addEventListener('click', () => { if (betIdx > 0) { betIdx--; sfx('click'); syncControls(); } });
      plus.addEventListener('click', () => { if (betIdx < BETS.length - 1) { betIdx++; sfx('click'); syncControls(); } });
      autoBtn.addEventListener('click', () => { if (autoLeft > 0) { autoLeft = 0; syncControls(); } else openAuto(); });
      turboBtn.addEventListener('click', () => { turbo = !turbo; turboBtn.classList.toggle('on', turbo); sfx(turbo ? 'switchOn' : 'click'); });
      infoBtn.addEventListener('click', openPaytable);
      buyTile.addEventListener('click', openBuy);
      specialTile.addEventListener('click', openSpecial);
      const onKey = (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON') || !modal.hidden) return;
        e.preventDefault();
        if (!overlay.hidden) overlay.click();
        else play();
      };
      document.addEventListener('keydown', onKey);

      shell.cleanup(() => {
        alive = false;
        autoLeft = 0;
        document.removeEventListener('keydown', onKey);
        timers.forEach(clearTimeout);
        if (pending) Nova.wallet.credit(pending);
        pending = 0;
        if (fsLeft > 0) {
          const units = E.playBonus(Nova.rand, bonusType, fsLeft, fsTotal) - fsTotal;
          fsLeft = 0;
          if (units > 0) {
            Nova.wallet.credit(round2(units * fsBet));
            Nova.ui.toast(`Bonbon Blast bonus finished: +${fmt(round2(units * fsBet))} tokens`, 'win');
          }
        }
      });

      cells = quietGrid().map((col, c) => col.map((x, r) => ({ x, el: makeEl(x, c, r) })));
      cells.forEach((col, c) => col.forEach((cell, r) => fall(cell.el, ROWS + 1, c * 70 + (ROWS - 1 - r) * 20, 520)));
      setMsg('PLACE YOUR BETS!');
      syncControls();
    },
  });
})();
