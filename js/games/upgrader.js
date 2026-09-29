/* Upgrader – stake tokens for a shot at a bigger item from the Credit Shop */
(function () {
  const { h, fmt, round2, clamp } = Nova;
  const EDGE = 0.96;
  const MIN_CHANCE = 1;
  const MAX_CHANCE = 80;
  const PRESETS = [1.5, 2, 3, 5, 10, 20];

  /* Credit Shop catalog: generated on a geometric value ladder so every target has items nearby */
  const NOUNS = [
    ['Keycap', '⌨️'], ['Headset', '🎧'], ['Sneakers', '👟'], ['Watch', '⌚'], ['Camera', '📷'], ['Console', '🎮'],
    ['Phone', '📱'], ['Laptop', '💻'], ['Saucer', '🛸'], ['Guitar', '🎸'], ['Crown', '👑'], ['Ring', '💍'],
    ['Trophy', '🏆'], ['Rocket', '🚀'], ['Diamond', '💎'], ['Key', '🗝️'],
  ];
  const ADJ = ['Neon', 'Chrome', 'Violet', 'Onyx', 'Solar', 'Lunar', 'Phantom', 'Glitch', 'Royal', 'Astral', 'Ember', 'Frost'];
  const ITEMS = [];
  for (let i = 0, v = 1.5; v < 60000; i++, v *= 1.17) {
    const [noun, emoji] = NOUNS[i % NOUNS.length];
    const value = v < 20 ? round2(v) : Math.round(v);
    ITEMS.push({ id: i, name: `${ADJ[(i * 5) % ADJ.length]} ${noun}`, emoji, value });
  }
  const itemById = (id) => ITEMS.find((it) => it.id === id);
  const tier = (v) => (v >= 5000 ? 'legend' : v >= 500 ? 'epic' : v >= 50 ? 'rare' : 'common');
  const chanceFor = (stake, item) => (stake * EDGE) / item.value * 100;

  Nova.register({
    id: 'upgrader',
    title: 'Upgrader',
    icon: 'chevrons-up',
    subtitle: 'Stake a few credits for a shot at something bigger from the Credit Shop.',
    badges: [
      { html: Nova.icon('chevrons-up', 14) + `<span>${MIN_CHANCE}%–${MAX_CHANCE}% chance</span>`, cls: 'accent' },
      { html: 'Random outcomes' },
    ],
    mount(shell) {
      let under = true; // roll under vs. roll over
      let preset = null;
      let target = null; // selected item
      let busy = false;
      let rot = 0;

      /* ring */
      const R = 96, C = 2 * Math.PI * R;
      const ticks = Array.from({ length: 60 }, (_, i) => {
        const a = (i * 6 * Math.PI) / 180;
        const r1 = 78, r2_ = i % 5 === 0 ? 70 : 74;
        return `<line x1="${110 + Math.sin(a) * r1}" y1="${110 - Math.cos(a) * r1}" x2="${110 + Math.sin(a) * r2_}" y2="${110 - Math.cos(a) * r2_}" />`;
      }).join('');
      const ringSvg = h('div', { class: 'ring-svg' });
      ringSvg.innerHTML = `
        <svg viewBox="0 0 220 220" class="ring">
          <g class="ring-rot">
            <circle class="ring-track" cx="110" cy="110" r="${R}" />
            <circle class="ring-win" cx="110" cy="110" r="${R}" transform="rotate(-90 110 110)" stroke-dasharray="0 ${C}" />
            <g class="ring-ticks">${ticks}</g>
          </g>
        </svg>
        <svg class="ring-pointer" viewBox="0 0 24 24"><path d="M3 4h18L12 20z" fill="currentColor"/></svg>`;
      const ringRot = ringSvg.querySelector('.ring-rot');
      const ringWin = ringSvg.querySelector('.ring-win');
      const centerLabel = h('span', { class: 'ring-label' }, 'Chance');
      const centerValue = h('span', { class: 'ring-value mono' });
      const ringWrap = h('div', { class: 'ring-wrap' }, ringSvg, h('div', { class: 'ring-center' }, centerLabel, centerValue));

      const stakeVal = h('b', { class: 'mono' });
      const stakeBox = h('div', { class: 'mini-card' }, h('span', { class: 'field-label' }, 'Your stake'), h('div', { class: 'mini-value', html: Nova.icon('sparkles', 14) }, stakeVal), h('span', { class: 'muted small' }, 'credits'));
      const targetBox = h('div', { class: 'mini-card target' });
      const invBtn = h('button', { class: 'pill btn-pill', type: 'button' });
      const modeUnder = h('button', { class: 'mode-wide', type: 'button', html: 'Roll Under ' + Nova.icon('chevron-down', 14) });
      const modeOver = h('button', { class: 'mode-wide', type: 'button', html: 'Roll Over ' + Nova.icon('chevron-up', 14) });
      const goBtn = h('button', { class: 'btn-primary wide', type: 'button' });
      const status = h('p', { class: 'stage-status' });
      const shop = h('div', { class: 'shop' });
      const shopHead = h('div', { class: 'recent-head' }, h('span', { class: 'field-label' }, 'Credit Shop'), h('span', { class: 'muted small shop-note' }));

      shell.stage.append(
        h('div', { class: 'stage-top' }, Nova.ui.pill('Roll ' + '<span class="mode-name"></span>'), invBtn),
        h('div', { class: 'upg-arena' }, stakeBox, ringWrap, targetBox),
        h('div', { class: 'upg-modes' }, modeUnder, modeOver),
        goBtn, status,
        h('div', { class: 'shop-wrap' }, shopHead, shop));
      const modeName = shell.stage.querySelector('.mode-name');

      /* controls */
      const bet = Nova.ui.betControl(shell);
      const presetBtns = new Map();
      const presetGrid = h('div', { class: 'preset-grid' });
      PRESETS.forEach((m) => {
        const b = h('button', { class: 'preset', type: 'button' }, m + '×');
        b.addEventListener('click', () => {
          if (busy) return;
          preset = preset === m ? null : m;
          if (preset && target) target = null;
          drawAll();
        });
        presetBtns.set(m, b);
        presetGrid.append(b);
      });
      const chanceInput = h('input', { class: 'bet-input mono left', type: 'text', inputmode: 'decimal', placeholder: 'Pick an item first', 'aria-label': 'Target chance' });
      const winChance = h('b', { class: 'mono' }, '–');
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'Stake'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Target multiplier'), presetGrid,
          h('p', { class: 'muted small' }, 'Pick one to see items near that value.')),
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Target chance (%)'), chanceInput),
        h('div', { class: 'stat-row' }, h('span', {}, 'Win chance'), winChance),
        h('p', { class: 'hint' }, `Chance = ${Math.round(EDGE * 100)}% × stake ÷ item value. Only items with a ${MIN_CHANCE}%–${MAX_CHANCE}% chance can be targeted. Won items go to your inventory — sell them for their value any time.`));

      bet.on(() => { drawAll(); });
      shell.cleanup(Nova.wallet.subscribe(() => { if (!busy) drawGo(); }));

      /* helpers */
      function eligible(stake) {
        return ITEMS.filter((it) => {
          const c = chanceFor(stake, it);
          return c >= MIN_CHANCE && c <= MAX_CHANCE;
        });
      }

      function drawShop() {
        const stake = bet.get();
        let list = eligible(stake);
        let note;
        if (preset) {
          const t = stake * preset;
          list = list.slice().sort((a, b) => Math.abs(Math.log(a.value / t)) - Math.abs(Math.log(b.value / t))).slice(0, 8).sort((a, b) => a.value - b.value);
          note = `Items near ${preset}× your stake`;
        } else {
          list = list.slice(0, 24);
          note = 'Choose a target multiplier or pick any item';
        }
        shopHead.querySelector('.shop-note').textContent = note;
        shop.innerHTML = '';
        if (!list.length) shop.append(h('p', { class: 'muted' }, 'No items fit this stake. Try a different bet.'));
        list.forEach((it) => {
          const c = chanceFor(stake, it);
          const card = h('button', { class: `item ${tier(it.value)}${target && target.id === it.id ? ' selected' : ''}`, type: 'button', disabled: busy },
            h('span', { class: 'item-emoji' }, it.emoji),
            h('span', { class: 'item-name' }, it.name),
            h('span', { class: 'item-value mono' }, fmt(it.value)),
            h('span', { class: 'item-chance mono' }, c.toFixed(c < 10 ? 2 : 1) + '%'));
          card.addEventListener('click', () => { if (!busy) { target = target && target.id === it.id ? null : it; drawAll(); } });
          shop.append(card);
        });
      }

      function currentChance() {
        return target ? chanceFor(bet.get(), target) : 0;
      }
      const chanceOk = () => { const c = currentChance(); return target && c >= MIN_CHANCE && c <= MAX_CHANCE; };

      function drawRing() {
        const c = chanceOk() ? currentChance() : 0;
        const len = (c / 100) * C;
        ringWin.setAttribute('stroke-dasharray', `${len} ${C - len}`);
        // roll under: win arc starts at 0; roll over: it ends at 100
        ringWin.setAttribute('transform', `rotate(${under ? -90 : -90 + (360 - (c / 100) * 360)} 110 110)`);
        centerLabel.textContent = 'Chance';
        centerValue.innerHTML = c.toFixed(2).replace(/^(\d+)\.(\d+)$/, '$1<i>.</i>$2') + '<small>%</small>';
        centerValue.className = 'ring-value mono';
      }

      function drawGo() {
        if (busy) return;
        const block = Nova.ui.betBlock(bet);
        goBtn.classList.remove('pick');
        if (!target) { goBtn.disabled = true; goBtn.innerHTML = Nova.icon('chevrons-up', 18) + '<span>Pick an item below</span>'; return; }
        if (!chanceOk()) { goBtn.disabled = true; goBtn.textContent = `Chance must be ${MIN_CHANCE}%–${MAX_CHANCE}%`; return; }
        goBtn.disabled = !!block;
        goBtn.innerHTML = block ? block : Nova.icon('chevrons-up', 18) + `<span>Upgrade to ${target.name}</span>`;
      }

      function drawAll() {
        const stake = bet.get();
        stakeVal.textContent = fmt(stake);
        presetBtns.forEach((b, m) => b.classList.toggle('active', m === preset));
        modeName.textContent = under ? 'Under' : 'Over';
        modeUnder.classList.toggle('active', under);
        modeOver.classList.toggle('active', !under);
        targetBox.innerHTML = '';
        if (target) {
          targetBox.append(
            h('span', { class: 'field-label' }, 'Target item'),
            h('div', { class: 'target-emoji' }, target.emoji),
            h('b', {}, target.name),
            h('span', { class: 'muted small mono' }, fmt(target.value) + ' credits · ' + (target.value / stake).toFixed(2) + '×'));
          if (document.activeElement !== chanceInput) chanceInput.value = currentChance().toFixed(2);
          winChance.textContent = currentChance().toFixed(2) + '%';
          chanceInput.placeholder = '';
        } else {
          targetBox.append(h('span', { class: 'field-label' }, 'Target item'), h('span', { class: 'muted' }, 'Pick an item below'));
          chanceInput.value = '';
          chanceInput.placeholder = 'Pick an item first';
          winChance.textContent = '–';
        }
        const invCount = Nova.inventory.items.length;
        invBtn.innerHTML = Nova.icon('package', 14) + `<span>Inventory${invCount ? ' (' + invCount + ')' : ''}</span>`;
        drawRing();
        drawShop();
        drawGo();
      }

      /* editing target chance selects the closest item */
      chanceInput.addEventListener('change', () => {
        const c = parseFloat(chanceInput.value.replace(',', '.'));
        if (!isFinite(c) || busy) { drawAll(); return; }
        const want = (bet.get() * EDGE) / (clamp(c, MIN_CHANCE, MAX_CHANCE) / 100);
        const pool = eligible(bet.get());
        if (!pool.length) return;
        target = pool.reduce((best, it) => (Math.abs(Math.log(it.value / want)) < Math.abs(Math.log(best.value / want)) ? it : best));
        preset = null;
        drawAll();
      });

      modeUnder.addEventListener('click', () => { if (!busy) { under = true; drawAll(); } });
      modeOver.addEventListener('click', () => { if (!busy) { under = false; drawAll(); } });

      /* inventory modal */
      invBtn.addEventListener('click', openInventory);
      function openInventory() {
        const overlay = h('div', { class: 'modal-overlay' });
        const box = h('div', { class: 'modal', role: 'dialog', 'aria-label': 'Inventory' });
        const close = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        const onEsc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
        document.addEventListener('keydown', onEsc);
        shell.cleanup(() => { document.removeEventListener('keydown', onEsc); overlay.remove(); });

        function render() {
          box.innerHTML = '';
          const items = Nova.inventory.items.map((s) => ({ s, it: itemById(s.itemId) })).filter((x) => x.it);
          const total = items.reduce((a, x) => a + x.it.value, 0);
          const closeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', html: Nova.icon('x', 18) });
          closeBtn.addEventListener('click', close);
          box.append(h('div', { class: 'modal-head' }, h('h3', {}, 'Inventory'), closeBtn));
          if (!items.length) {
            box.append(h('p', { class: 'muted pad' }, 'Nothing here yet — win an upgrade to fill your inventory.'));
          } else {
            const sellAll = h('button', { class: 'btn-primary', type: 'button' }, `Sell all for ${fmt(total)}`);
            sellAll.addEventListener('click', () => {
              items.forEach((x) => Nova.inventory.remove(x.s.uid));
              Nova.wallet.credit(round2(total));
              Nova.sfx.coins(10);
              Nova.ui.toast(`Sold ${items.length} items for ${fmt(total)} tokens`, 'win');
              render(); drawAll();
            });
            box.append(sellAll, h('div', { class: 'inv-list' }, items.map(({ s, it }) => {
              const sell = h('button', { class: 'btn-ghost small', type: 'button' }, `Sell ${fmt(it.value)}`);
              sell.addEventListener('click', () => {
                if (!Nova.inventory.remove(s.uid)) return;
                Nova.wallet.credit(it.value);
                Nova.sfx.coins(5);
                Nova.ui.toast(`Sold ${it.name} for ${fmt(it.value)} tokens`, 'win');
                render(); drawAll();
              });
              return h('div', { class: `inv-item ${tier(it.value)}` },
                h('span', { class: 'item-emoji' }, it.emoji),
                h('div', { class: 'inv-name' }, h('b', {}, it.name), h('span', { class: 'muted small mono' }, fmt(it.value) + ' credits')),
                sell);
            })));
          }
        }
        render();
        overlay.append(box);
        document.body.append(overlay);
      }

      /* the roll */
      const pointer = ringSvg.querySelector('.ring-pointer');
      const SPIN_MS = 4200;

      // spin the ring with rAF so every tick mark that passes the pointer can click
      function spinTo(target) {
        const from = rot;
        const t0 = performance.now();
        let lastTick = Math.floor(-from / 6);
        let alive = true;
        shell.cleanup(() => { alive = false; });
        const frame = (now) => {
          if (!alive) return;
          const k = Math.min(1, (now - t0) / SPIN_MS);
          const e = 1 - Math.pow(1 - k, 4);
          rot = from + (target - from) * e;
          ringRot.style.transform = `rotate(${rot}deg)`;
          const tick = Math.floor(-rot / 6);
          if (tick !== lastTick) {
            lastTick = tick;
            Nova.sfx.spinTick();
            if (!pointer.getAnimations().length) {
              Nova.anim(pointer, [{ transform: 'translateX(-50%) rotate(0)' }, { transform: 'translateX(-50%) rotate(-22deg)' }, { transform: 'translateX(-50%) rotate(0)' }], { duration: 110 });
            }
          }
          if (k < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        // resolve on a timer so the result still settles if the tab is backgrounded
        return Nova.sleep(SPIN_MS + 80).then(() => { rot = target; ringRot.style.transform = `rotate(${rot}deg)`; });
      }

      async function upgrade() {
        if (busy || !chanceOk() || Nova.ui.betBlock(bet)) return;
        const stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        const chance = currentChance();
        const item = target;
        busy = true;
        bet.lock(true);
        goBtn.disabled = true;
        goBtn.textContent = 'Rolling…';
        [modeUnder, modeOver, invBtn].forEach((b) => (b.disabled = true));
        presetBtns.forEach((b) => (b.disabled = true));
        shop.querySelectorAll('button').forEach((b) => (b.disabled = true));
        ringWrap.classList.remove('win', 'lose');
        ringWrap.classList.add('spinning');
        centerLabel.textContent = 'Rolling';
        status.textContent = `Spinning for ${item.emoji} ${item.name}…`;
        Nova.sfx.bet();
        Nova.sfx.whoosh(0.8);

        const roll = Nova.randInt(10000) / 100; // 0.00 – 99.99
        const win = under ? roll < chance : roll >= 100 - chance;
        // normalise, then land so that `roll` sits under the pointer after 5 full turns
        rot = ((rot % 360) + 360) % 360;
        const end = rot - 360 * 5 - ((((rot + roll * 3.6) % 360) + 360) % 360);
        await spinTo(end);

        ringWrap.classList.remove('spinning');
        ringWrap.classList.add(win ? 'win' : 'lose');
        centerLabel.textContent = win ? 'Upgraded!' : 'Rolled';
        centerValue.className = 'ring-value mono ' + (win ? 'good-text' : 'bad-text');
        centerValue.textContent = roll.toFixed(2);
        Nova.ui.bump(centerValue, 1.2);
        if (win) {
          Nova.inventory.add(item.id);
          Nova.sfx.cash(3);
          Nova.fx.at(ringWrap, { count: 50, speed: 11, life: 1200 });
          Nova.fx.confetti();
          Nova.ui.bump(targetBox, 1.08);
          shell.flash('win');
          status.innerHTML = `<b class="good-text">Upgrade!</b> ${item.emoji} ${item.name} (${fmt(item.value)}) is in your inventory.`;
        } else {
          Nova.sfx.lose();
          Nova.fx.shake(ringWrap, 8);
          shell.flash('lose');
          status.innerHTML = `<b class="bad-text">No luck.</b> Rolled ${roll.toFixed(2)} — you lost ${fmt(stake)} tokens.`;
        }
        busy = false;
        bet.lock(false);
        [modeUnder, modeOver, invBtn].forEach((b) => (b.disabled = false));
        presetBtns.forEach((b) => (b.disabled = false));
        // keep the result on screen a moment, then restore the chance readout
        setTimeout(() => {
          if (busy) return;
          ringWrap.classList.remove('win', 'lose');
          drawRing();
        }, 2600);
        drawShop();
        drawGo();
        invBtn.innerHTML = Nova.icon('package', 14) + `<span>Inventory (${Nova.inventory.items.length})</span>`;
      }

      goBtn.addEventListener('click', upgrade);
      status.textContent = 'Choose a stake, pick a target item and roll.';
      drawAll();
    },
  });
})();
