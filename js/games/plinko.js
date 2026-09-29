/* Plinko – drop balls through a peg pyramid, every slot pays a different multiplier */
(function () {
  const { h, fmt, round2 } = Nova;
  const EDGE = 0.96;
  const MAX_BALLS = 12;
  const DIFFS = {
    easy: { label: 'Easy', K: 2.2, g: 1 },
    medium: { label: 'Medium', K: 3.6, g: 1.15 },
    hard: { label: 'Hard', K: 5, g: 1.3 },
    extreme: { label: 'Extreme', K: 7, g: 1.5 },
  };

  const choose = (n, k) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };

  // multiplier per slot, scaled so the expected return is exactly EDGE (before rounding)
  function table(rows, diff) {
    const { K, g } = DIFFS[diff];
    const p = [], raw = [];
    for (let k = 0; k <= rows; k++) {
      p.push(choose(rows, k) / Math.pow(2, rows));
      raw.push(Math.exp(K * Math.pow(Math.abs(k - rows / 2) / (rows / 2), g)));
    }
    const scale = EDGE / raw.reduce((a, r, i) => a + r * p[i], 0);
    return raw.map((r) => Math.round(r * scale * 100) / 100);
  }
  const fmtM = (m) => (m >= 100 ? m.toFixed(0) : m.toFixed(2)) + 'x';

  Nova.register({
    id: 'plinko',
    title: 'Plinko',
    icon: 'circle-dot',
    subtitle: 'Drop the ball. Every landing pays a different multiplier.',
    badges: [
      { html: Nova.icon('layers', 14) + `<span>Up to ${MAX_BALLS} balls at once</span>`, cls: 'accent' },
      { html: 'Random outcomes' },
    ],
    mount(shell) {
      let rows = 12;
      let diff = 'easy';
      let mults = table(rows, diff);
      const balls = [];
      let raf = 0;
      let alive = true;

      const W = 640;
      const M = 34; // side margin
      const TOP = 40;
      let dx, dy, H, cx;

      const rowsPill = Nova.ui.pill('');
      const diffPill = Nova.ui.pill('');
      const ballsPill = Nova.ui.pill('');
      const canvas = h('canvas', { class: 'plinko-canvas' });
      const ctx = canvas.getContext('2d');
      const recent = Nova.ui.recent('Recent drops', 'No drops yet.', 14);
      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, rowsPill, diffPill), ballsPill),
        h('div', { class: 'stage-center plinko-center' }, canvas),
        recent.root);

      const bet = Nova.ui.betControl(shell);
      const diffSeg = Nova.ui.segmented({
        options: Object.entries(DIFFS).map(([k, d]) => ({ value: k, label: d.label, sub: '' })),
        value: 'easy',
        cls: 'small-sub',
        onChange(v) { diff = v; rebuild(); },
      });
      const rowsSeg = Nova.ui.segmented({
        options: [8, 12, 16].map((n) => ({ value: n, label: String(n) })),
        value: 12,
        onChange(v) { rows = v; rebuild(); },
      });
      const dropBtn = h('button', { class: 'btn-primary', type: 'button' });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'Drop setup'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Difficulty'), diffSeg.root),
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Rows'), rowsSeg.root),
        dropBtn,
        h('p', { class: 'hint' }, 'Higher difficulty pushes multipliers toward the edges — the center pays less, the edges pay far more.'));

      const sync = Nova.ui.bindStart(shell, dropBtn, bet, 'Drop ball', () => balls.length >= MAX_BALLS);
      const pegHit = new Map();
      const slotHit = new Map();

      function rebuild() {
        mults = table(rows, diff);
        dx = (W - 2 * M) / rows;
        dy = dx * 0.85;
        H = Math.round(TOP + rows * dy + 70);
        cx = W / 2;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        canvas.style.aspectRatio = `${W} / ${H}`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        Object.keys(DIFFS).forEach((k) => diffSeg.setSub(k, `${fmtM(Math.max(...table(rows, k)))} max`));
        rowsPill.innerHTML = Nova.icon('layers', 14) + `<b>${rows}</b> rows`;
        diffPill.textContent = DIFFS[diff].label;
        pegHit.clear();
        slotHit.clear();
      }

      const px = (r, j) => cx + (j - r / 2) * dx;
      const py = (r) => TOP + r * dy;

      function slotColor(m, a = 1) {
        const max = Math.max(...mults);
        const t = m < 1 ? 0 : Math.min(1, Math.log(m + 0.01) / Math.log(max + 0.01));
        if (m < 1) return `rgba(34,32,44,${a})`;
        const l = 26 + t * 34;
        return `hsla(${272 + t * 8}, ${60 + t * 30}%, ${l}%, ${a})`;
      }

      function draw(now) {
        ctx.clearRect(0, 0, W, H);
        // spotlight cone
        const grad = ctx.createLinearGradient(0, TOP - 10, 0, py(rows));
        grad.addColorStop(0, 'rgba(168,85,247,0.30)');
        grad.addColorStop(1, 'rgba(168,85,247,0.02)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx - 14, TOP - 10);
        ctx.lineTo(cx + 14, TOP - 10);
        ctx.lineTo(px(rows, rows) + dx / 2, py(rows));
        ctx.lineTo(px(rows, 0) - dx / 2, py(rows));
        ctx.closePath();
        ctx.fill();

        // pegs
        for (let r = 0; r < rows; r++) {
          for (let j = 0; j <= r; j++) {
            const hit = pegHit.get(r * 100 + j);
            const k = hit ? Math.max(0, 1 - (now - hit) / 350) : 0;
            const rad = 3.6 + k * 2.4;
            ctx.beginPath();
            ctx.arc(px(r, j), py(r), rad, 0, Math.PI * 2);
            ctx.shadowColor = 'rgba(192,132,252,0.9)';
            ctx.shadowBlur = 8 + k * 14;
            ctx.fillStyle = k > 0 ? '#f3e8ff' : '#c084fc';
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;

        // slots
        const sw = dx - 5, sh = Math.min(30, dx * 0.8), sy = py(rows) + 14;
        ctx.font = `700 ${Math.max(9, Math.min(13, dx * 0.27))}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        mults.forEach((m, k) => {
          const hit = slotHit.get(k);
          const t = hit ? Math.max(0, 1 - (now - hit) / 500) : 0;
          const x = px(rows, k) - sw / 2;
          const y = sy + t * 6;
          ctx.fillStyle = slotColor(m);
          ctx.beginPath();
          ctx.roundRect(x, y, sw, sh, 6);
          ctx.fill();
          if (t > 0) {
            ctx.strokeStyle = `rgba(255,255,255,${t})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.fillStyle = m < 1 ? '#8b8798' : '#fff';
          ctx.fillText(fmtM(m), x + sw / 2, y + sh / 2 + 1);
        });

        // balls
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          const elapsed = Math.max(0, now - b.t0);
          const seg = Math.min(rows + 1, Math.floor(elapsed / b.segMs));
          const t = Math.min(1, (elapsed - seg * b.segMs) / b.segMs);
          if (seg >= rows + 1) { land(b); balls.splice(i, 1); continue; }
          const a = b.pts[seg], c = b.pts[seg + 1];
          const x = a.x + (c.x - a.x) * t;
          const y = a.y + (c.y - a.y) * t * t - Math.sin(Math.PI * t) * (seg === 0 ? 0 : 9) * (1 - t);
          if (t < 0.08 && seg > 0 && !b['hit' + seg]) {
            b['hit' + seg] = true;
            pegHit.set((seg - 1) * 100 + b.path[seg - 1], now);
          }
          ctx.beginPath();
          ctx.arc(x, y, Math.max(5, dx * 0.17), 0, Math.PI * 2);
          ctx.shadowColor = 'rgba(216,180,254,1)';
          ctx.shadowBlur = 14;
          const bg = ctx.createRadialGradient(x - 2, y - 2, 1, x, y, 9);
          bg.addColorStop(0, '#fff');
          bg.addColorStop(1, '#a855f7');
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      function loop() {
        if (!alive) return;
        draw(performance.now());
        raf = requestAnimationFrame(loop);
      }

      function land(b) {
        const m = b.mult;
        const win = round2(b.stake * m);
        slotHit.set(b.slot, performance.now());
        if (win > 0) Nova.wallet.credit(win);
        const profit = round2(win - b.stake);
        recent.add(`${fmtM(m)} · ${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit))}`, m >= 1 ? 'win' : 'lose');
        if (m >= 5 || profit >= b.stake * 4) Nova.ui.toast(`${fmtM(m)} — +${fmt(win)} tokens`, 'win');
        updateBalls();
      }

      function updateBalls() {
        ballsPill.innerHTML = `<b>${balls.length}</b> balls in play`;
        diffSeg.lock(balls.length > 0);
        rowsSeg.lock(balls.length > 0);
        sync();
      }

      function drop() {
        if (balls.length >= MAX_BALLS || Nova.ui.betBlock(bet)) return;
        const stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        const path = [];
        let j = 0;
        // path[r] = column index of the peg the ball is on in row r; final entry = slot
        for (let r = 0; r < rows; r++) { path.push(j); j += Nova.randInt(2); }
        path.push(j);
        const pts = [{ x: cx, y: TOP - 34 }];
        for (let r = 0; r <= rows; r++) pts.push({ x: px(r, path[r]), y: r === rows ? py(rows) + 14 + 12 : py(r) - 9 });
        balls.push({ stake, path, pts, slot: j, mult: mults[j], t0: performance.now(), segMs: rows >= 16 ? 95 : 115 });
        updateBalls();
      }

      dropBtn.addEventListener('click', drop);
      rebuild();
      updateBalls();
      raf = requestAnimationFrame(loop);
      shell.cleanup(() => {
        alive = false;
        cancelAnimationFrame(raf);
        // settle balls still in flight (their slot is already decided) so leaving never eats a bet
        balls.forEach((b) => Nova.wallet.credit(round2(b.stake * b.mult)));
        balls.length = 0;
      });
    },
  });
})();
