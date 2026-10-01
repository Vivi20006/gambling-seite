/* Coin Flip – call heads or tails, win 2x */
(function () {
  const { h, fmt, round2 } = Nova;
  const PAYOUT = 2;
  const FLIP_MS = 1700;
  const LAND_AT = 0.84; // fraction of the flip when the coin touches down

  const face = (kind) =>
    kind === 'heads'
      ? `<div class="coin-face heads"><span class="coin-text top">HEADS</span>${Nova.logo('coin-logo')}<span class="coin-text bottom">NOVA · OWN EVERY FLIP</span></div>`
      : `<div class="coin-face tails"><span class="coin-text top">TAILS</span><div class="coin-star">${Nova.icon('sparkles', 64)}</div></div>`;

  const mini = (kind) => `<span class="mini-coin ${kind}">${kind === 'heads' ? Nova.logo() : Nova.icon('sparkles', 12)}</span>`;
  const name = (k) => (k === 'heads' ? 'Heads' : 'Tails');

  Nova.register({
    id: 'coinflip',
    title: 'Coin Flip',
    titleHtml: 'Coin <span class="grad">Flip</span>',
    icon: 'coin',
    subtitle: 'Call it in the air. Double or nothing.',
    badges: [
      { html: '2× payout on a win', cls: 'accent' },
      { html: Nova.icon('shield-check', 14) + '<span>Random outcome</span>', cls: 'good' },
    ],
    mount(shell) {
      let call = 'heads';
      let busy = false;
      let rot = 0;
      let streak = 0;

      const callPill = Nova.ui.pill('');
      const winPill = Nova.ui.pill('');
      const coin = h('div', { class: 'coin', html: face('heads') + face('tails') });
      const wrap = h('div', { class: 'coin-wrap' }, coin);
      const shadow = h('div', { class: 'coin-shadow' });
      const arena = h('div', { class: 'coin-arena' }, h('div', { class: 'coin-halo' }), wrap, shadow);
      const status = h('p', { class: 'stage-status' }, 'Pick a side, set your bet and flip.');
      const recent = Nova.ui.recent('Recent flips', 'No flips yet this session.', 16);

      shell.stage.append(
        h('div', { class: 'stage-top' }, callPill, winPill),
        h('div', { class: 'stage-center tall' }, arena),
        status,
        recent.root);

      const bet = Nova.ui.betControl(shell);
      const sideBtns = {};
      const sides = h('div', { class: 'side-pick' });
      ['heads', 'tails'].forEach((k) => {
        const b = h('button', { class: 'side-btn', type: 'button', html: mini(k) + `<span>${name(k)}</span>` });
        b.addEventListener('click', () => {
          if (busy || call === k) return;
          call = k;
          // show the called side face-up
          rot = Math.round(rot / 360) * 360 + (k === 'tails' ? 180 : 0);
          coin.classList.add('quick');
          coin.style.transform = `rotateY(${rot}deg)`;
          setTimeout(() => coin.classList.remove('quick'), 400);
          draw();
        });
        sideBtns[k] = b;
        sides.append(b);
      });
      const payout = h('div', { class: 'stat-row' }, h('span', {}, 'Potential payout'), h('b', { class: 'mono good-text' }));
      const flipBtn = h('button', { class: 'btn-primary', type: 'button' });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'Place your bet'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Call it'), sides),
        payout, flipBtn,
        h('p', { class: 'hint' }, 'Pick a side and flip — win and you double your bet, lose and your stake is gone.'));

      const sync = Nova.ui.bindStart(shell, flipBtn, bet, 'Flip coin', () => busy);
      bet.on(draw);

      function draw() {
        callPill.innerHTML = mini(call) + `<span>Your call: <b>${name(call)}</b></span>`;
        winPill.innerHTML = streak > 1
          ? `<span class="streak">${streak}× streak</span>`
          : `Win <b class="good-text">${fmt(round2(bet.get() * PAYOUT))}</b>`;
        payout.lastChild.innerHTML = `${fmt(round2(bet.get() * PAYOUT))} <small>coins</small>`;
        Object.entries(sideBtns).forEach(([k, b]) => b.classList.toggle('active', k === call));
      }

      async function flip() {
        if (busy || Nova.ui.betBlock(bet)) return;
        const stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        busy = true;
        bet.lock(true);
        Object.values(sideBtns).forEach((b) => (b.disabled = true));
        flipBtn.disabled = true;
        flipBtn.textContent = 'Flipping…';
        status.textContent = 'Coin in the air…';
        arena.classList.remove('win', 'lose');

        Nova.sfx.bet();
        Nova.sfx.whoosh(0.55);
        Nova.sfx.coinSpin(FLIP_MS * LAND_AT / 1000);

        const result = Nova.randInt(2) === 0 ? 'heads' : 'tails';
        rot = Math.ceil(rot / 360) * 360 + 360 * 6 + (result === 'tails' ? 180 : 0);
        coin.style.transform = `rotateY(${rot}deg)`;
        const up = 'cubic-bezier(.2,.6,.35,1)';
        const down = 'cubic-bezier(.55,0,.85,.4)';
        Nova.anim(wrap, [
          { transform: 'translateY(0) scale(1)', easing: up },
          { transform: 'translateY(-105px) scale(1.16)', offset: 0.42, easing: down },
          { transform: 'translateY(0) scale(1)', offset: LAND_AT, easing: up },
          { transform: 'translateY(-14px) scale(1.02)', offset: 0.92, easing: down },
          { transform: 'translateY(0) scale(1)' },
        ], { duration: FLIP_MS });
        Nova.anim(shadow, [
          { transform: 'scale(1)', opacity: 0.7, easing: up },
          { transform: 'scale(.45)', opacity: 0.2, offset: 0.42, easing: down },
          { transform: 'scale(1)', opacity: 0.7, offset: LAND_AT, easing: up },
          { transform: 'scale(.9)', opacity: 0.55, offset: 0.92, easing: down },
          { transform: 'scale(1)', opacity: 0.7 },
        ], { duration: FLIP_MS });

        await Nova.sleep(FLIP_MS * LAND_AT);
        Nova.sfx.coinLand();
        await Nova.sleep(FLIP_MS * (1 - LAND_AT) + 60);

        const won = result === call;
        const win = round2(stake * PAYOUT);
        if (won) {
          Nova.wallet.credit(win);
          streak++;
          arena.classList.add('win');
          Nova.sfx.win(streak >= 3 ? 2 : 1);
          Nova.fx.at(wrap, { count: 40, speed: 9, life: 1000 });
          shell.flash('win');
          status.innerHTML = `<b class="good-text">${name(result)}!</b> You won ${fmt(win)} coins.`;
        } else {
          streak = 0;
          arena.classList.add('lose');
          Nova.sfx.lose();
          shell.flash('lose');
          status.innerHTML = `<b class="bad-text">${name(result)}.</b> You lost ${fmt(stake)} coins.`;
        }
        recent.add(mini(result) + `<span>${won ? '+' + fmt(win - stake) : '−' + fmt(stake)}</span>`, (won ? 'win' : 'lose') + ' coin-chip', true);
        busy = false;
        bet.lock(false);
        Object.values(sideBtns).forEach((b) => (b.disabled = false));
        draw();
        sync();
      }

      flipBtn.addEventListener('click', flip);
      draw();
    },
  });
})();
