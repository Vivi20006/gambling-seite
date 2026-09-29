/* Blackjack – 6-deck shoe on a 3D felt table.
   Dealer stands on all 17s, blackjack pays 3:2, insurance 2:1, double on any two cards,
   split up to four hands (split aces get one card each). Side bets: Perfect Pairs and 21+3. */
(function () {
  const { h, fmt, round2, clamp } = Nova;
  const DECKS = 6;
  const CUT = 78; // reshuffle when fewer cards are left at the start of a round
  const TW = 960; // table plane size (px, before scaling)
  const TH = 580;
  const SCENE_H = 640;
  const TILT = 34;
  const CW = 84;
  const CH = 118;
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const CHIPS = [
    { v: 1, c: '#e7e5ee', t: '#1f1b2b' },
    { v: 5, c: '#dc2626' },
    { v: 25, c: '#16a34a' },
    { v: 100, c: '#1c1917' },
    { v: 500, c: '#9333ea' },
  ];
  const PP_PAY = { perfect: 25, colored: 12, mixed: 6 };
  const PP_NAME = { perfect: 'Perfect pair', colored: 'Colored pair', mixed: 'Mixed pair' };
  const T3_PAY = { 'Suited trips': 100, 'Straight flush': 40, 'Three of a kind': 30, Straight: 10, Flush: 5 };

  // landmarks on the table plane
  const SHOE = [852, 70];
  const DISCARD = [106, 70];
  const TRAY = [480, 40];
  const DEALER_Y = 158;
  const HAND_Y = 372;
  const CIRCLE_Y = 492;
  const SIDE_DX = 108;
  const SIDE_Y = 508;

  /* ---------- pure rules ---------- */
  const val = (c) => (c.r === 'A' ? 11 : 'JQK'.includes(c.r) || c.r === '10' ? 10 : +c.r);
  function score(cards) {
    let t = 0;
    let aces = 0;
    cards.forEach((c) => { t += val(c); if (c.r === 'A') aces++; });
    while (t > 21 && aces) { t -= 10; aces--; }
    return { t, soft: aces > 0 };
  }
  const isBJ = (cards) => cards.length === 2 && score(cards).t === 21;
  const isNatural = (hd) => !hd.split && isBJ(hd.cards);
  const isRed = (c) => c.s === '♥' || c.s === '♦';
  function pairKind(a, b) {
    if (a.r !== b.r) return null;
    if (a.s === b.s) return 'perfect';
    return isRed(a) === isRed(b) ? 'colored' : 'mixed';
  }
  function threeKind(cards) {
    const flush = cards.every((c) => c.s === cards[0].s);
    const r = cards.map((c) => RANKS.indexOf(c.r) + 1).sort((a, b) => a - b);
    const trips = r[0] === r[2];
    const straight = !trips && ((r[1] === r[0] + 1 && r[2] === r[1] + 1) || (r[0] === 1 && r[1] === 12 && r[2] === 13));
    if (trips && flush) return 'Suited trips';
    if (straight && flush) return 'Straight flush';
    if (trips) return 'Three of a kind';
    if (straight) return 'Straight';
    if (flush) return 'Flush';
    return null;
  }
  // [result, amount returned incl. stake]
  function payoutFor(hd, dealerCards) {
    const p = score(hd.cards).t;
    const d = score(dealerCards).t;
    const dBJ = isBJ(dealerCards);
    if (p > 21) return ['bust', 0];
    if (dBJ) return isNatural(hd) ? ['push', hd.bet] : ['lose', 0];
    if (isNatural(hd)) return ['blackjack', hd.bet * 2.5];
    if (d > 21 || p > d) return ['win', hd.bet * 2];
    if (p === d) return ['push', hd.bet];
    return ['lose', 0];
  }

  /* ---------- card faces ---------- */
  const PIPS = {
    2: [[50, 16], [50, 84, 1]],
    3: [[50, 16], [50, 50], [50, 84, 1]],
    4: [[30, 16], [70, 16], [30, 84, 1], [70, 84, 1]],
    5: [[30, 16], [70, 16], [50, 50], [30, 84, 1], [70, 84, 1]],
    6: [[30, 16], [70, 16], [30, 50], [70, 50], [30, 84, 1], [70, 84, 1]],
    7: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [30, 84, 1], [70, 84, 1]],
    8: [[30, 16], [70, 16], [50, 33], [30, 50], [70, 50], [50, 67, 1], [30, 84, 1], [70, 84, 1]],
    9: [[30, 16], [70, 16], [30, 39], [70, 39], [50, 50], [30, 61, 1], [70, 61, 1], [30, 84, 1], [70, 84, 1]],
    10: [[30, 16], [70, 16], [50, 28], [30, 39], [70, 39], [30, 61, 1], [70, 61, 1], [50, 72, 1], [30, 84, 1], [70, 84, 1]],
  };
  function faceHtml(c) {
    const corner = `<b>${c.r}</b><i>${c.s}</i>`;
    let mid;
    if (c.r === 'A') mid = `<span class="c-ace">${c.s}</span>`;
    else if ('JQK'.includes(c.r)) mid = `<span class="c-court"><b>${c.r}</b><i>${c.s}</i></span>`;
    else mid = PIPS[c.r].map(([x, y, f]) => `<i class="pip${f ? ' f' : ''}" style="left:${x}%;top:${y}%">${c.s}</i>`).join('');
    return `<span class="c-corner tl">${corner}</span><span class="c-mid">${mid}</span><span class="c-corner br">${corner}</span>`;
  }

  const chipLabel = (v) => (v >= 1000 ? v / 1000 + 'K' : String(v));
  function chipsFor(amount) {
    const out = [];
    let a = Math.floor(amount + 1e-9);
    for (const ch of CHIPS.slice().reverse()) while (a >= ch.v && out.length < 16) { out.push(ch); a -= ch.v; }
    if (!out.length && amount > 0) out.push(CHIPS[0]);
    return out;
  }
  const chipEl = (ch) => h('div', { class: 'chip3d', style: { '--c': ch.c, '--t': ch.t || '#fff' } }, h('span', {}, chipLabel(ch.v)));

  const FELT = `<svg viewBox="0 0 ${TW} ${TH}" class="bj-print" aria-hidden="true">
    <defs>
      <path id="bjIns" d="M 160 224 Q 480 322 800 224"/>
      <path id="bjPays" d="M 214 266 Q 480 352 746 266"/>
      <path id="bjRule" d="M 262 292 Q 480 364 698 292"/>
    </defs>
    <path d="M 146 206 Q 480 304 814 206" class="bj-line"/>
    <path d="M 138 238 Q 480 336 822 238" class="bj-line"/>
    <text class="bj-t-ins"><textPath href="#bjIns" startOffset="50%" text-anchor="middle">INSURANCE PAYS 2 TO 1</textPath></text>
    <text class="bj-t-pays"><textPath href="#bjPays" startOffset="50%" text-anchor="middle">BLACKJACK PAYS 3 TO 2</textPath></text>
    <text class="bj-t-rule"><textPath href="#bjRule" startOffset="50%" text-anchor="middle">DEALER MUST DRAW TO 16 AND STAND ON ALL 17s</textPath></text>
  </svg>`;

  Nova.register({
    id: 'blackjack',
    title: 'Blackjack',
    titleHtml: 'Black<span class="grad">jack</span>',
    icon: 'spade',
    subtitle: 'Beat the dealer to 21 on a 3D felt. Blackjack pays 3 to 2.',
    badges: [
      { html: Nova.icon('layers', 14) + `<span>${DECKS} decks · stands on 17</span>`, cls: 'accent' },
      { html: 'Blackjack pays 3:2' },
    ],
    mount(shell) {
      let shoe = [];
      let discarded = 0;
      let phase = 'bet'; // bet → deal → insurance? → player → dealer → done
      let busy = false;
      let alive = true;
      let chipSel = 5;
      let bets = { main: 0, pp: 0, t3: 0 };
      let lastBets = null;
      let hands = []; // { cards, els, bet, doubled, split, splitAces, done, result, stack, badge }
      let dealer = { cards: [], els: [] };
      let active = 0;
      let insurance = 0;
      const flags = { settled: true, side: true, ins: true };
      let staked = 0; // everything put on the table this round
      let returned = 0; // everything paid back this round
      let loose = []; // pay stacks, tags … cleared with the table

      const sfx = (name, ...a) => { if (alive) Nova.sfx[name](...a); };
      const wait = (ms) => Nova.sleep(ms);
      const anim = async (el, frames, opts) => {
        const a = Nova.anim(el, frames, opts);
        if (a) await a.finished.catch(() => {});
      };

      /* ---------- scene ---------- */
      const viewport = h('div', { class: 'bj-viewport' });
      const scaler = h('div', { class: 'bj-scale' });
      const scene = h('div', { class: 'bj-scene' });
      const table = h('div', { class: 'bj-table' });
      const layer = h('div', { class: 'bj-layer' });
      const felt = h('div', { class: 'bj-felt', html: FELT });

      // 3D shoe: base, raised top and three standing walls
      const shoeEl = h('div', { class: 'bj-shoe', html: '<i class="s-top"><b></b></i><i class="s-front"></i><i class="s-left"></i><i class="s-back"></i>' });
      const discardEl = h('div', { class: 'bj-discard', html: '<i class="d-front"></i><i class="d-right"></i>' });
      const pile = h('div', { class: 'd-pile' });
      discardEl.append(pile);
      // dealer chip tray with racked chips
      const tray = h('div', { class: 'bj-tray' });
      CHIPS.slice().reverse().forEach((ch, i) => {
        const col = h('div', { class: 'tray-col', style: { left: 14 + i * 38 + 'px' } });
        for (let k = 0; k < 7; k++) {
          const c = chipEl(ch);
          c.classList.add('racked');
          c.style.transform = `translateZ(${k * 3.4}px)`;
          col.append(c);
        }
        tray.append(col);
      });

      const T = (x, y, z = 0, rz = 0, ry = 0) => `translate3d(${x - CW / 2}px, ${y - CH / 2}px, ${z}px) rotateZ(${rz}deg) rotateY(${ry}deg)`;
      const flat = (el, x, y, z = 0) => { el.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`; };
      const board = (el, x, y, z = 40) => { el.style.transform = `translate3d(${x}px, ${y}px, ${z}px) rotateX(${-TILT}deg)`; };

      function circle(label, x, y, small, key) {
        const el = h('button', { class: 'bj-circle' + (small ? ' small' : ''), type: 'button', 'aria-label': 'Add chip to ' + label }, h('span', {}, label));
        flat(el, x, y, 0.5);
        el.addEventListener('click', () => addChip(key));
        layer.append(el);
        return el;
      }
      const mainCircle = circle('BET', TW / 2, CIRCLE_Y, false, 'main');
      const ppCircle = circle('PP', TW / 2 - SIDE_DX, SIDE_Y, true, 'pp');
      const t3Circle = circle('21+3', TW / 2 + SIDE_DX, SIDE_Y, true, 't3');

      const dealerBadge = h('div', { class: 'bj-badge dealer', hidden: true });
      const msg = h('div', { class: 'bj-msg' });
      board(msg, TW / 2, 262, 60);
      layer.append(dealerBadge, msg);
      table.append(felt, tray, shoeEl, discardEl, layer);
      scene.append(table);
      scaler.append(scene);
      viewport.append(scaler);

      const shoePill = Nova.ui.pill('');
      const rulesPill = Nova.ui.pill(Nova.icon('spade', 14) + '<span>Dealer stands on 17</span>');
      shell.stage.classList.add('bj-stage');
      shell.stage.append(h('div', { class: 'stage-top' }, rulesPill, shoePill), viewport);
      const recent = Nova.ui.recent('Recent hands', 'No hands yet.', 14);
      shell.stage.append(recent.root);

      // scale the fixed-size table to the stage
      const fit = () => {
        const w = viewport.clientWidth;
        const s = Math.min(1.12, w / TW);
        scaler.style.transform = `scale(${s})`;
        scaler.style.left = (w - TW * s) / 2 + 'px';
        viewport.style.height = SCENE_H * s + 'px';
      };
      const ro = new ResizeObserver(fit);
      ro.observe(viewport);
      shell.cleanup(() => ro.disconnect());

      // the table leans gently toward the mouse
      const cur = { x: TILT, y: 0 };
      const tgt = { x: TILT, y: 0 };
      let traf = 0;
      function tiltLoop() {
        cur.x += (tgt.x - cur.x) * 0.07;
        cur.y += (tgt.y - cur.y) * 0.07;
        table.style.transform = `rotateX(${cur.x}deg) rotateY(${cur.y}deg)`;
        traf = Math.abs(tgt.x - cur.x) + Math.abs(tgt.y - cur.y) > 0.01 && alive ? requestAnimationFrame(tiltLoop) : 0;
      }
      shell.stage.addEventListener('pointermove', (e) => {
        if (Nova.reducedMotion || e.pointerType === 'touch') return;
        const r = viewport.getBoundingClientRect();
        tgt.y = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1) * 4.5;
        tgt.x = TILT - clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1) * 3;
        if (!traf) traf = requestAnimationFrame(tiltLoop);
      });
      shell.stage.addEventListener('pointerleave', () => { tgt.x = TILT; tgt.y = 0; if (!traf) traf = requestAnimationFrame(tiltLoop); });
      table.style.transform = `rotateX(${TILT}deg)`;

      /* ---------- controls ---------- */
      const title = h('h3', { class: 'panel-title' });
      const rackBtns = [];
      const rack = h('div', { class: 'rack' });
      CHIPS.forEach((ch) => {
        const b = h('button', { class: 'rack-chip', type: 'button', style: { '--c': ch.c, '--t': ch.t || '#fff' }, 'aria-label': `${ch.v} token chip` }, h('span', {}, chipLabel(ch.v)));
        b.addEventListener('click', () => { chipSel = ch.v; drawRack(); addChip('main'); });
        rackBtns.push([ch.v, b]);
        rack.append(b);
      });
      const rowMain = h('b', { class: 'mono' });
      const rowPP = h('b', { class: 'mono' });
      const rowT3 = h('b', { class: 'mono' });
      const rowTotal = h('b', { class: 'mono' });
      const betRows = h('div', { class: 'bj-bets' },
        h('div', {}, h('span', {}, 'Main bet'), rowMain),
        h('div', {}, h('span', {}, 'Perfect Pairs'), rowPP),
        h('div', {}, h('span', {}, '21+3'), rowT3),
        h('div', { class: 'total' }, h('span', {}, 'Total'), rowTotal));
      const clearBtn = h('button', { class: 'bet-quick', type: 'button' }, 'Clear');
      const dblBetBtn = h('button', { class: 'bet-quick', type: 'button' }, '2×');
      const rebetBtn = h('button', { class: 'bet-quick', type: 'button' }, 'Rebet');
      const dealBtn = h('button', { class: 'btn-primary', type: 'button' });
      const betBox = h('div', {},
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Chips'), rack,
          h('p', { class: 'muted small' }, 'Click a chip to add it to your main bet. Click PP or 21+3 on the table for side bets.')),
        betRows,
        h('div', { class: 'bet-quick-row' }, clearBtn, dblBetBtn, rebetBtn),
        dealBtn);

      const act = (label, key, cls = '') => h('button', { class: 'bj-act ' + cls, type: 'button', html: `<span>${label}</span><kbd>${key}</kbd>` });
      const hitBtn = act('Hit', 'H', 'hit');
      const standBtn = act('Stand', 'S', 'stand');
      const doubleBtn = act('Double', 'D');
      const splitBtn = act('Split', 'P');
      const actBox = h('div', { class: 'bj-actions' }, hitBtn, standBtn, doubleBtn, splitBtn);

      const insText = h('p', { class: 'bj-ins-text' });
      const insYes = h('button', { class: 'btn-primary', type: 'button' });
      const insNo = h('button', { class: 'btn-ghost', type: 'button' }, 'No insurance');
      const insBox = h('div', { class: 'bj-ins' }, insText, insYes, insNo);

      const againBtn = h('button', { class: 'btn-primary', type: 'button' });
      const newBetBtn = h('button', { class: 'btn-ghost', type: 'button' }, 'Change bet');
      const doneBox = h('div', { class: 'bj-done' }, againBtn, newBetBtn);
      const waitBox = h('p', { class: 'bj-wait' });

      shell.controls.append(title, betBox, insBox, actBox, doneBox, waitBox,
        h('p', { class: 'hint' }, 'Blackjack pays 3:2, insurance 2:1. Double on any two cards, split up to four hands. Perfect Pairs pays 6 / 12 / 25 to 1, 21+3 pays 5 to 100 to 1. Keys: Space deal · H hit · S stand · D double · P split.'));

      function drawRack() { rackBtns.forEach(([v, b]) => b.classList.toggle('active', v === chipSel)); }

      const betTotal = () => bets.main + bets.pp + bets.t3;
      const hand = () => hands[active];
      const canDouble = () => { const hd = hand(); return hd && hd.cards.length === 2 && !hd.splitAces && Nova.wallet.canAfford(hd.bet); };
      const canSplit = () => { const hd = hand(); return hd && hd.cards.length === 2 && val(hd.cards[0]) === val(hd.cards[1]) && hands.length < 4 && Nova.wallet.canAfford(hd.bet); };

      function syncUI() {
        const betting = phase === 'bet';
        betBox.hidden = !betting;
        insBox.hidden = phase !== 'insurance';
        actBox.hidden = phase !== 'player';
        doneBox.hidden = phase !== 'done';
        waitBox.hidden = !(phase === 'deal' || phase === 'dealer');
        title.textContent = { bet: 'Place your bets', deal: 'Dealing…', insurance: 'Insurance?', player: hands.length > 1 ? `Your move · hand ${active + 1} of ${hands.length}` : 'Your move', dealer: "Dealer's turn", done: 'Hand complete' }[phase];
        waitBox.textContent = phase === 'dealer' ? 'Dealer draws to 16 and stands on 17.' : 'Cards are coming out of the shoe…';
        rowMain.textContent = fmt(bets.main);
        rowPP.textContent = fmt(bets.pp);
        rowT3.textContent = fmt(bets.t3);
        rowTotal.textContent = fmt(betTotal());
        const block = bets.main < 1 ? 'Add a chip to bet' : betTotal() > Nova.wallet.balance + 1e-9 ? 'Not enough tokens' : null;
        dealBtn.disabled = busy || !!block;
        dealBtn.textContent = block || `Deal · ${fmt(betTotal())}`;
        clearBtn.disabled = busy || betTotal() === 0;
        dblBetBtn.disabled = busy || betTotal() === 0 || betTotal() * 2 > Nova.wallet.balance + 1e-9;
        rebetBtn.disabled = busy || !lastBets;
        const off = busy || phase !== 'player';
        hitBtn.disabled = standBtn.disabled = off;
        doubleBtn.disabled = off || !canDouble();
        splitBtn.disabled = off || !canSplit();
        insYes.disabled = insNo.disabled = busy;
        insYes.textContent = `Take insurance · ${fmt(round2(bets.main / 2))}`;
        insYes.disabled = busy || !Nova.wallet.canAfford(round2(bets.main / 2));
        insText.textContent = 'The dealer shows an ace. Insurance costs half your bet and pays 2 to 1 if the dealer has blackjack.';
        const again = lastBets ? lastBets.main + lastBets.pp + lastBets.t3 : 0;
        againBtn.disabled = busy || !again || again > Nova.wallet.balance + 1e-9;
        againBtn.textContent = again > Nova.wallet.balance + 1e-9 ? 'Not enough tokens' : `Rebet & deal · ${fmt(again)}`;
        [mainCircle, ppCircle, t3Circle].forEach((c) => c.classList.toggle('live', betting && !busy));
        hands.forEach((hd, k) => hd.badge.classList.toggle('active', phase === 'player' && k === active));
      }
      shell.cleanup(Nova.wallet.subscribe(() => { if (!busy) syncUI(); }));

      /* ---------- table furniture ---------- */
      function stack(x, y) {
        const chips = h('div', { class: 'bj-chips' });
        const label = h('div', { class: 'bj-stack-label mono' });
        const el = h('div', { class: 'bj-stack' }, chips, label);
        layer.append(el);
        flat(el, x, y, 1);
        return { el, chips, label, amount: 0 };
      }
      function setStack(st, amount, drop = true) {
        const list = chipsFor(amount);
        const prev = drop ? st.chips.children.length : list.length;
        st.chips.innerHTML = '';
        list.forEach((ch, i) => {
          const c = chipEl(ch);
          const z = i * 3.4;
          c.style.transform = `translateZ(${z}px)`;
          st.chips.append(c);
          if (i >= prev) {
            Nova.anim(c, [
              { transform: `translateZ(${z + 150}px)`, opacity: 0 },
              { transform: `translateZ(${z}px)`, opacity: 1, offset: 0.7 },
              { transform: `translateZ(${z + 7}px)`, offset: 0.85 },
              { transform: `translateZ(${z}px)` },
            ], { duration: 380, delay: (i - prev) * 45, easing: 'ease-in', fill: 'backwards' });
          }
        });
        st.label.textContent = amount > 0 ? fmt(round2(amount)) : '';
        st.label.style.transform = `translateZ(${list.length * 3.4 + 2}px)`;
        st.amount = amount;
      }
      async function slide(st, x, y, fade) {
        flat(st.el, x, y, 1);
        if (fade) st.el.classList.add('gone');
        await wait(560);
        if (fade) st.el.remove();
      }
      function tag(text, cls, x, y) {
        const el = h('div', { class: 'bj-tag ' + cls }, text);
        board(el, x, y, 50);
        layer.append(el);
        loose.push({ el });
        return el;
      }
      function setMsg(text) {
        msg.textContent = text || '';
        msg.classList.toggle('on', !!text);
      }

      let stacks = {};
      function freshStacks() {
        stacks = {
          main: stack(TW / 2, CIRCLE_Y),
          pp: stack(TW / 2 - SIDE_DX, SIDE_Y),
          t3: stack(TW / 2 + SIDE_DX, SIDE_Y),
        };
      }
      freshStacks();

      function updateShoe() {
        const total = DECKS * 52;
        shoePill.innerHTML = `<span class="shoe-bar"><i style="width:${(shoe.length / total) * 100}%"></i></span><b class="mono">${shoe.length}</b> cards`;
      }
      function updateDiscard() {
        const n = Math.min(28, Math.ceil(discarded / 8));
        while (pile.children.length < n) { const c = h('i'); c.style.transform = `translateZ(${pile.children.length * 1.3 + 2}px) rotateZ(${(Math.random() - 0.5) * 6}deg)`; pile.append(c); }
        while (pile.children.length > n) pile.lastChild.remove();
      }
      function newShoe() {
        shoe = [];
        for (let d = 0; d < DECKS; d++) SUITS.forEach((s) => RANKS.forEach((r) => shoe.push({ r, s })));
        for (let i = shoe.length - 1; i > 0; i--) { const j = Nova.randInt(i + 1); [shoe[i], shoe[j]] = [shoe[j], shoe[i]]; }
        discarded = 0;
        updateDiscard();
        updateShoe();
      }
      function drawCard() {
        if (!shoe.length) newShoe();
        const c = shoe.pop();
        c.rz = (Math.random() - 0.5) * 7;
        return c;
      }
      async function reshuffle() {
        setMsg('Shuffling a fresh shoe…');
        sfx('shuffle');
        Nova.anim(shoeEl, [{ transform: shoeEl.style.transform || 'none' }, { transform: 'translate3d(0,0,14px)' }, { transform: 'none' }], { duration: 1100, easing: 'ease-in-out' });
        newShoe();
        await wait(1150);
        setMsg('');
      }
      newShoe();

      /* ---------- cards ---------- */
      function cardEl(c) {
        const el = h('div', { class: 'card3d' + (isRed(c) ? ' red' : ''), html: `<div class="cf">${faceHtml(c)}</div><div class="cb"></div>` });
        layer.append(el);
        return el;
      }
      const handX = (k) => { const n = hands.length; return TW / 2 + (k - (n - 1) / 2) * (n >= 3 ? 212 : 250); };
      function dealerSpot(i) {
        const n = Math.max(2, dealer.cards.length);
        return [TW / 2 + (i - (n - 1) / 2) * 66, DEALER_Y, 1 + i * 0.6, dealer.cards[i].rz];
      }
      function cardSpot(hd, k, i) {
        const side = hd.doubled && i === 2;
        return [handX(k) - 12 + i * 24 + (side ? 12 : 0), HAND_Y - i * 20, 1 + i * 0.6, side ? 90 + hd.cards[i].rz : hd.cards[i].rz];
      }
      function layout() {
        dealer.els.forEach((el, i) => { const [x, y, z, rz] = dealerSpot(i); el.style.transform = T(x, y, z, rz, el.up ? 0 : 180); });
        hands.forEach((hd, k) => {
          hd.els.forEach((el, i) => { const [x, y, z, rz] = cardSpot(hd, k, i); el.style.transform = T(x, y, z, rz, 0); });
          flat(hd.stack.el, handX(k), CIRCLE_Y, 1);
        });
        drawBadges();
      }
      function badgeText(cards, natural) {
        if (!cards.length) return '';
        const s = score(cards);
        if (natural) return 'Blackjack';
        if (s.t > 21) return `${s.t} · Bust`;
        return s.soft && s.t < 21 ? `${s.t - 10} / ${s.t}` : String(s.t);
      }
      function drawBadges() {
        const shown = dealer.cards.filter((_, i) => dealer.els[i] && dealer.els[i].up);
        dealerBadge.hidden = !shown.length;
        dealerBadge.textContent = badgeText(shown, shown.length === 2 && isBJ(dealer.cards));
        dealerBadge.classList.toggle('bust', score(shown).t > 21);
        const n = Math.max(2, dealer.cards.length);
        board(dealerBadge, TW / 2 - ((n - 1) / 2) * 66 - 92, DEALER_Y - 6, 40);
        hands.forEach((hd, k) => {
          if (!hd.result) {
            hd.badge.textContent = badgeText(hd.cards, isNatural(hd));
            hd.badge.classList.toggle('bust', score(hd.cards).t > 21);
            hd.badge.classList.toggle('bj', isNatural(hd));
          }
          board(hd.badge, handX(k) - 86, HAND_Y + 20, 40);
        });
      }

      async function dealTo(target, up = true) {
        if (!alive) return null;
        const c = drawCard();
        target.cards.push(c);
        updateShoe();
        const el = cardEl(c);
        el.up = up;
        target.els.push(el);
        const isDealer = target === dealer;
        if (isDealer) layout(); // earlier dealer cards shuffle left to make room
        const [x, y, z, rz] = isDealer ? dealerSpot(dealer.cards.length - 1) : cardSpot(target, hands.indexOf(target), target.cards.length - 1);
        const final = T(x, y, z, rz, up ? 0 : 180);
        el.style.transform = final;
        sfx('card');
        await anim(el, [
          { transform: T(SHOE[0] - 30, SHOE[1] + 30, 40, -26, 180), easing: 'cubic-bezier(.3,.7,.4,1)' },
          { transform: T((SHOE[0] + x) / 2, (SHOE[1] + y) / 2 - 20, 130, rz - 12, up ? 90 : 180), offset: 0.5, easing: 'cubic-bezier(.4,0,.5,1)' },
          { transform: final },
        ], { duration: 540 });
        drawBadges();
        return c;
      }
      async function flipHole() {
        const el = dealer.els[1];
        if (!el || el.up) return;
        el.up = true;
        const [x, y, z, rz] = dealerSpot(1);
        const final = T(x, y, z, rz, 0);
        el.style.transition = 'none';
        el.style.transform = final;
        sfx('flip');
        await anim(el, [
          { transform: T(x, y, z, rz, 180) },
          { transform: T(x, y - 12, z + 80, rz, 90), offset: 0.5 },
          { transform: final },
        ], { duration: 520, easing: 'ease-in-out' });
        el.style.transition = '';
        drawBadges();
      }
      async function peek() {
        const el = dealer.els[1];
        const [x, y, z, rz] = dealerSpot(1);
        setMsg('Dealer checks for blackjack…');
        el.style.transition = 'none';
        await anim(el, [
          { transform: T(x, y, z, rz, 180) },
          { transform: T(x + 4, y - 10, z + 26, rz + 8, 160), offset: 0.5 },
          { transform: T(x, y, z, rz, 180) },
        ], { duration: 900, easing: 'ease-in-out' });
        el.style.transition = '';
      }

      /* ---------- betting ---------- */
      function addChip(key) {
        if (busy || !alive) return;
        if (phase === 'done') { newBet(false).then(() => addChip(key)); return; }
        if (phase !== 'bet') return;
        if (betTotal() + chipSel > Nova.wallet.balance + 1e-9) {
          sfx('error');
          Nova.fx.shake(key === 'main' ? mainCircle : key === 'pp' ? ppCircle : t3Circle, 5);
          return;
        }
        bets[key] += chipSel;
        setStack(stacks[key], bets[key]);
        sfx('chip');
        syncUI();
      }
      function setBets(b) {
        bets = { ...b };
        Object.keys(stacks).forEach((k) => setStack(stacks[k], bets[k]));
        if (betTotal()) sfx('chip');
        syncUI();
      }

      async function clearTable() {
        const els = [...dealer.els, ...hands.flatMap((hd) => hd.els)];
        els.forEach((el, i) => {
          el.style.transition = 'none';
          const from = el.style.transform;
          const to = T(DISCARD[0], DISCARD[1], 24, 90 + (Math.random() - 0.5) * 16, 180);
          Nova.anim(el, [{ transform: from }, { transform: T((DISCARD[0] + 480) / 2, 150, 110, 0, 180), offset: 0.5 }, { transform: to, opacity: 0.4 }], { duration: 520, delay: i * 55, easing: 'ease-in-out', fill: 'forwards' });
          setTimeout(() => sfx('card'), i * 55);
        });
        // winnings and pushes slide back to the player
        const all = [...hands.map((hd) => hd.stack), ...Object.values(stacks), ...loose.filter((x) => x.chips)];
        all.forEach((st) => { if (st.el.isConnected) { const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(st.el.style.transform); slide(st, m ? +m[1] : TW / 2, TH + 90, true); } });
        loose.forEach((x) => { if (!x.chips) { x.el.classList.add('gone'); setTimeout(() => x.el.remove(), 400); } });
        hands.forEach((hd) => { hd.badge.classList.add('gone'); setTimeout(() => hd.badge.remove(), 400); });
        dealerBadge.hidden = true;
        setMsg('');
        await wait(Math.max(560, 520 + els.length * 55));
        els.forEach((el) => el.remove());
        discarded += els.length;
        updateDiscard();
        hands = [];
        dealer = { cards: [], els: [] };
        loose = [];
        freshStacks();
      }

      async function newBet(rebet) {
        if (busy) return;
        busy = true;
        syncUI();
        await clearTable();
        phase = 'bet';
        bets = { main: 0, pp: 0, t3: 0 };
        busy = false;
        if (rebet && lastBets) setBets(lastBets);
        syncUI();
      }

      /* ---------- the round ---------- */
      function newHand(bet, st) {
        const hd = { cards: [], els: [], bet, doubled: false, split: false, splitAces: false, done: false, result: null, stack: st, badge: h('div', { class: 'bj-badge' }) };
        layer.append(hd.badge);
        return hd;
      }

      async function deal() {
        if (busy || phase !== 'bet' || bets.main < 1) return;
        const total = betTotal();
        if (!Nova.wallet.debit(total)) { sfx('error'); return; }
        lastBets = { ...bets };
        staked = total;
        returned = 0;
        insurance = 0;
        flags.settled = flags.side = flags.ins = false;
        busy = true;
        phase = 'deal';
        syncUI();
        if (shoe.length < CUT) await reshuffle();
        hands = [newHand(bets.main, stacks.main)];
        dealer = { cards: [], els: [] };
        await dealTo(hands[0]);
        await dealTo(dealer, true);
        await dealTo(hands[0]);
        await dealTo(dealer, false);
        if (!alive) return;
        await sideBets();
        if (dealer.cards[0].r === 'A' && !isNatural(hands[0])) {
          phase = 'insurance';
          busy = false;
          setMsg('Insurance?');
          syncUI();
          return;
        }
        await afterInsurance();
      }

      function sideMoney() {
        if (flags.side) return [];
        flags.side = true;
        const [a, b] = hands[0].cards;
        const up = dealer.cards[0];
        const out = [];
        if (bets.pp) { const k = pairKind(a, b); out.push({ key: 'pp', name: k ? PP_NAME[k] : 'No pair', pay: k ? bets.pp * (PP_PAY[k] + 1) : 0 }); }
        if (bets.t3) { const k = threeKind([a, b, up]); out.push({ key: 't3', name: k || 'No 21+3', pay: k ? bets.t3 * (T3_PAY[k] + 1) : 0 }); }
        const tot = round2(out.reduce((s, o) => s + o.pay, 0));
        if (tot) Nova.wallet.credit(tot);
        returned += tot;
        return out;
      }
      async function sideBets() {
        const res = sideMoney();
        if (!res.length) return;
        for (const o of res) {
          const st = stacks[o.key];
          const x = TW / 2 + (o.key === 'pp' ? -SIDE_DX : SIDE_DX);
          if (o.pay) {
            tag(`${o.name} +${fmt(round2(o.pay - bets[o.key]))}`, 'win', x, SIDE_Y - 60);
            const pay = stack(TRAY[0], TRAY[1] + 30);
            setStack(pay, o.pay - bets[o.key], false);
            loose.push(pay);
            requestAnimationFrame(() => flat(pay.el, x + (o.key === 'pp' ? -52 : 52), SIDE_Y, 1));
            sfx('win', 2);
          } else {
            tag(o.name, 'lose', x, SIDE_Y - 60);
            slide(st, TRAY[0], TRAY[1] + 30, true);
          }
        }
        sfx('chip');
        await wait(900);
      }

      function insMoney() {
        if (flags.ins) return;
        flags.ins = true;
        if (!insurance) return;
        const pay = isBJ(dealer.cards) ? insurance * 3 : 0;
        if (pay) Nova.wallet.credit(round2(pay));
        returned += pay;
      }

      async function takeInsurance(yes) {
        if (phase !== 'insurance' || busy) return;
        if (yes) {
          const cost = round2(bets.main / 2);
          if (!Nova.wallet.debit(cost)) { sfx('error'); return; }
          insurance = cost;
          staked += cost;
          sfx('chip');
          const st = stack(TW / 2, 250);
          setStack(st, cost);
          loose.push(st);
          stacks.ins = st;
        }
        busy = true;
        phase = 'deal';
        syncUI();
        await afterInsurance();
      }

      async function afterInsurance() {
        const up = dealer.cards[0];
        const dBJ = isBJ(dealer.cards);
        if (val(up) >= 10) await peek();
        if (!alive) return;
        insMoney();
        if (insurance) {
          const st = stacks.ins;
          if (dBJ) { tag(`Insurance +${fmt(round2(insurance * 2))}`, 'win', TW / 2, 214); flat(st.el, TW / 2 + 60, 250, 1); }
          else { tag('Insurance lost', 'lose', TW / 2, 214); slide(st, TRAY[0], TRAY[1] + 30, true); }
        }
        if (dBJ) {
          await flipHole();
          setMsg('Dealer has blackjack');
          await wait(500);
          await settleAll();
          return;
        }
        if (val(up) >= 10) { setMsg('No blackjack'); await wait(700); setMsg(''); }
        if (isNatural(hands[0])) {
          hands[0].done = true;
          await flipHole();
          await settleAll();
          return;
        }
        phase = 'player';
        active = 0;
        busy = false;
        syncUI();
      }

      async function hit() {
        if (phase !== 'player' || busy) return;
        busy = true;
        syncUI();
        const hd = hand();
        await dealTo(hd);
        const t = score(hd.cards).t;
        if (t > 21) { hd.done = true; await bust(hd); }
        else if (t === 21) hd.done = true;
        await advance();
      }
      async function stand() {
        if (phase !== 'player' || busy) return;
        busy = true;
        hand().done = true;
        sfx('click');
        await advance();
      }
      async function doubleDown() {
        if (phase !== 'player' || busy || !canDouble()) return;
        const hd = hand();
        if (!Nova.wallet.debit(hd.bet)) { sfx('error'); return; }
        busy = true;
        syncUI();
        staked += hd.bet;
        hd.bet *= 2;
        hd.doubled = true;
        setStack(hd.stack, hd.bet);
        sfx('chip');
        await wait(250);
        await dealTo(hd);
        hd.done = true;
        if (score(hd.cards).t > 21) await bust(hd);
        await advance();
      }
      async function split() {
        if (phase !== 'player' || busy || !canSplit()) return;
        const hd = hand();
        if (!Nova.wallet.debit(hd.bet)) { sfx('error'); return; }
        busy = true;
        syncUI();
        staked += hd.bet;
        const card = hd.cards.pop();
        const el = hd.els.pop();
        const nh = newHand(hd.bet, stack(handX(active), CIRCLE_Y));
        setStack(nh.stack, nh.bet);
        nh.cards = [card];
        nh.els = [el];
        hd.split = nh.split = true;
        if (card.r === 'A') hd.splitAces = nh.splitAces = true;
        hands.splice(active + 1, 0, nh);
        sfx('chip');
        layout();
        await wait(480);
        await dealTo(hd);
        if (hd.splitAces) {
          hd.done = true;
          await dealTo(nh);
          nh.done = true;
        } else if (score(hd.cards).t === 21) hd.done = true;
        await advance();
      }
      async function bust(hd) {
        hd.result = 'bust';
        hd.badge.textContent = 'Bust';
        hd.badge.classList.add('bust', 'lose');
        sfx('lose');
        Nova.fx.shake(viewport, 5);
        await slide(hd.stack, TRAY[0], TRAY[1] + 30, true);
      }
      async function advance() {
        while (active < hands.length && hands[active].done) {
          active++;
          const nx = hands[active];
          if (nx && nx.cards.length === 1) {
            syncUI();
            await dealTo(nx);
            if (nx.splitAces || score(nx.cards).t === 21) nx.done = true;
          }
        }
        if (active >= hands.length) { await dealerTurn(); return; }
        busy = false;
        syncUI();
      }

      async function dealerTurn() {
        phase = 'dealer';
        busy = true;
        syncUI();
        await flipHole();
        const live = hands.some((hd) => score(hd.cards).t <= 21);
        while (alive && live && score(dealer.cards).t < 17) {
          await wait(380);
          await dealTo(dealer, true);
        }
        if (score(dealer.cards).t > 21) { setMsg('Dealer busts!'); sfx('win', 1); }
        await wait(300);
        await settleAll();
      }

      function settleMoney() {
        if (flags.settled) return;
        flags.settled = true;
        let tot = 0;
        hands.forEach((hd) => {
          const [res, amt] = payoutFor(hd, dealer.cards);
          hd.result = res;
          hd.payout = round2(amt);
          tot += hd.payout;
        });
        tot = round2(tot);
        if (tot) Nova.wallet.credit(tot);
        returned += tot;
      }

      async function settleAll() {
        if (!alive) return;
        settleMoney();
        const LABEL = { win: 'Win', blackjack: 'Blackjack', push: 'Push', lose: 'Lose', bust: 'Bust' };
        for (let k = 0; k < hands.length; k++) {
          const hd = hands[k];
          const profit = round2(hd.payout - hd.bet);
          hd.badge.className = 'bj-badge ' + ({ win: 'win', blackjack: 'win bj', push: 'push', lose: 'lose', bust: 'lose bust' }[hd.result]);
          hd.badge.textContent = hd.result === 'win' || hd.result === 'blackjack' ? `${LABEL[hd.result]} +${fmt(profit)}` : LABEL[hd.result];
          Nova.ui.bump(hd.badge, 1.15);
          if (hd.result === 'win' || hd.result === 'blackjack') {
            const pay = stack(TRAY[0], TRAY[1] + 30);
            setStack(pay, profit, false);
            loose.push(pay);
            requestAnimationFrame(() => flat(pay.el, handX(k) + 56, CIRCLE_Y, 1));
            sfx('chip');
            setTimeout(() => sfx('chip'), 120);
          } else if (hd.result === 'lose') {
            slide(hd.stack, TRAY[0], TRAY[1] + 30, true);
          }
          await wait(260);
        }
        const net = round2(returned - staked);
        const natural = hands.some((hd) => hd.result === 'blackjack');
        if (natural) { sfx('cash', 3); Nova.fx.confetti(); shell.flash('win'); }
        else if (net > 0) { sfx('cash', Nova.sfx.level(returned / staked)); shell.flash('win'); }
        else if (net < 0) { sfx('lose'); shell.flash('lose'); }
        shell.result({
          win: net > 0 || (net === 0 && returned > 0),
          big: natural ? 'Blackjack!' : net > 0 ? '+' + fmt(net) : net === 0 ? 'Push' : 'Dealer wins',
          small: natural ? '+' + fmt(net) : net < 0 ? '−' + fmt(-net) : `Dealer ${badgeText(dealer.cards, isBJ(dealer.cards))}`,
          anchor: viewport,
        });
        const summary = hands.map((hd) => score(hd.cards).t).join('/') + ' vs ' + score(dealer.cards).t;
        recent.add(`${summary} · ${net >= 0 ? '+' : '−'}${fmt(Math.abs(net))}`, net > 0 ? 'win' : net < 0 ? 'lose' : '');
        phase = 'done';
        busy = false;
        syncUI();
      }

      // leaving mid-hand: stand everything, let the dealer finish and pay out instantly
      function finishInstantly() {
        if (flags.settled) return;
        if (!hands.length) hands = [{ cards: [], bet: bets.main, split: false }];
        hands.forEach((hd) => { while (hd.cards.length < 2) hd.cards.push(drawCard()); });
        while (dealer.cards.length < 2) dealer.cards.push(drawCard());
        sideMoney();
        insMoney();
        const live = hands.some((hd) => score(hd.cards).t <= 21) && !isBJ(dealer.cards) && !(hands.length === 1 && isNatural(hands[0]));
        if (live) while (score(dealer.cards).t < 17) dealer.cards.push(drawCard());
        settleMoney();
      }

      /* ---------- wiring ---------- */
      dealBtn.addEventListener('click', deal);
      clearBtn.addEventListener('click', () => { if (!busy && phase === 'bet') { setBets({ main: 0, pp: 0, t3: 0 }); sfx('click'); } });
      dblBetBtn.addEventListener('click', () => { if (!busy && phase === 'bet' && betTotal() * 2 <= Nova.wallet.balance + 1e-9) setBets({ main: bets.main * 2, pp: bets.pp * 2, t3: bets.t3 * 2 }); });
      rebetBtn.addEventListener('click', () => {
        if (busy || phase !== 'bet' || !lastBets) return;
        if (lastBets.main + lastBets.pp + lastBets.t3 > Nova.wallet.balance + 1e-9) { sfx('error'); return; }
        setBets(lastBets);
      });
      hitBtn.addEventListener('click', hit);
      standBtn.addEventListener('click', stand);
      doubleBtn.addEventListener('click', doubleDown);
      splitBtn.addEventListener('click', split);
      insYes.addEventListener('click', () => takeInsurance(true));
      insNo.addEventListener('click', () => takeInsurance(false));
      againBtn.addEventListener('click', async () => {
        if (busy || phase !== 'done') return;
        await newBet(true);
        if (alive && bets.main >= 1) deal();
      });
      newBetBtn.addEventListener('click', () => { if (phase === 'done') newBet(false); });

      const onKey = (e) => {
        const t = e.target;
        if (e.repeat || (t && (t.tagName === 'INPUT' || t.closest('.modal')))) return;
        const k = e.key.toLowerCase();
        if (e.code === 'Space' || k === 'enter') {
          if (t && t.tagName === 'BUTTON') return;
          e.preventDefault();
          if (phase === 'bet') deal();
          else if (phase === 'done') againBtn.click();
        } else if (phase === 'player') {
          if (k === 'h') hit();
          else if (k === 's') stand();
          else if (k === 'd') doubleDown();
          else if (k === 'p') split();
        } else if (phase === 'insurance') {
          if (k === 'y') takeInsurance(true);
          else if (k === 'n') takeInsurance(false);
        }
      };
      document.addEventListener('keydown', onKey);

      shell.cleanup(() => {
        alive = false;
        cancelAnimationFrame(traf);
        document.removeEventListener('keydown', onKey);
        finishInstantly();
      });

      drawRack();
      updateShoe();
      syncUI();
    },
  });
})();
