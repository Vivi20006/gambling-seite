/* Coin Flip – call heads or tails, win 2x */
(function () {
  const { h, fmt, round2 } = Nova;
  const PAYOUT = 2;

  const face = (kind) =>
    kind === 'heads'
      ? `<div class="coin-face heads"><span class="coin-text top">HEADS</span>${Nova.logo('coin-logo')}<span class="coin-text bottom">NOVA · OWN EVERY FLIP</span></div>`
      : `<div class="coin-face tails"><span class="coin-text top">TAILS</span><div class="coin-star">${Nova.icon('sparkles', 64)}</div></div>`;

  const mini = (kind) => `<span class="mini-coin ${kind}">${kind === 'heads' ? Nova.logo() : Nova.icon('sparkles', 12)}</span>`;

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

      const callPill = Nova.ui.pill('');
      const winPill = Nova.ui.pill('');
      const coin = h('div', { class: 'coin', html: face('heads') + face('tails') });
      const wrap = h('div', { class: 'coin-wrap' }, coin);
      const status = h('p', { class: 'stage-status' }, 'Pick a side, set your bet and flip.');
      const recent = Nova.ui.recent('Recent flips', 'No flips yet this session.', 14);

      shell.stage.append(
        h('div', { class: 'stage-top' }, callPill, winPill),
        h('div', { class: 'stage-center tall' }, wrap),
        status,
        recent.root);

      const bet = Nova.ui.betControl(shell);
      const sideBtns = {};
      const sides = h('div', { class: 'side-pick' });
      ['heads', 'tails'].forEach((k) => {
        const b = h('button', { class: 'side-btn', type: 'button', html: mini(k) + `<span>${k === 'heads' ? 'Heads' : 'Tails'}</span>` });
        b.addEventListener('click', () => { if (!busy) { call = k; draw(); } });
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
        callPill.innerHTML = mini(call) + `<span>Your call: <b>${call === 'heads' ? 'Heads' : 'Tails'}</b></span>`;
        winPill.innerHTML = `Win <b class="good-text">${fmt(round2(bet.get() * PAYOUT))}</b>`;
        payout.lastChild.innerHTML = `${fmt(round2(bet.get() * PAYOUT))} <small>tokens</small>`;
        Object.entries(sideBtns).forEach(([k, b]) => b.classList.toggle('active', k === call));
      }

      async function flip() {
        if (busy || Nova.ui.betBlock(bet)) return;
        const stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        busy = true;
        bet.lock(true);
        flipBtn.disabled = true;
        flipBtn.textContent = 'Flipping…';
        status.textContent = 'Coin in the air…';

        const result = Nova.randInt(2) === 0 ? 'heads' : 'tails';
        rot = Math.ceil(rot / 360) * 360 + 360 * 6 + (result === 'tails' ? 180 : 0);
        wrap.classList.remove('jump');
        void wrap.offsetWidth;
        wrap.classList.add('jump');
        coin.style.transform = `rotateY(${rot}deg)`;
        await Nova.sleep(1750);

        const won = result === call;
        const win = round2(stake * PAYOUT);
        if (won) Nova.wallet.credit(win);
        status.innerHTML = won
          ? `<b class="good-text">${result === 'heads' ? 'Heads' : 'Tails'}!</b> You won ${fmt(win)} tokens.`
          : `<b class="bad-text">${result === 'heads' ? 'Heads' : 'Tails'}.</b> You lost ${fmt(stake)} tokens.`;
        recent.add((result === 'heads' ? 'H' : 'T') + ' · ' + (won ? '+' + fmt(win - stake) : '−' + fmt(stake)), won ? 'win' : 'lose');
        Nova.ui.toast(won ? `+${fmt(win)} tokens` : `−${fmt(stake)} tokens`, won ? 'win' : 'lose');
        busy = false;
        bet.lock(false);
        sync();
      }

      flipBtn.addEventListener('click', flip);
      draw();
    },
  });
})();
