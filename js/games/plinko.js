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
      const floaters = [];
      let raf = 0;
      let alive = true;

      const W = 640;
      const M = 34; // side margin
      const TOP = 40;
      let dx, dy, H, cx, sw, sh, sy, ballR, maxMult;

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
        h('p', { class: 'hint' }, 'Higher difficulty pushes multipliers toward the edges — the center pays less, the edges pay far more. Press Space to drop.'));

      const sync = Nova.ui.bindStart(shell, dropBtn, bet, 'Drop ball', () => balls.length >= MAX_BALLS);
      const pegHit = new Map();
      const slotHit = new Map();

      function rebuild() {
        mults = table(rows, diff);
        maxMult = Math.max(...mults);
        dx = (W - 2 * M) / rows;
        dy = dx * 0.85;
        H = Math.round(TOP + rows * dy + 70);
        cx = W / 2;
        sw = dx - 5;
        sh = Math.min(30, dx * 0.8);
        sy = TOP + rows * dy + 14;
        ballR = Math.max(5, dx * 0.17);
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

      function slotColor(m) {
        if (m < 1) return 'rgba(34,32,44,1)';
        const t = Math.min(1, Math.log(m + 0.01) / Math.log(maxMult + 0.01));
        return `hsl(${272 + t * 8}, ${60 + t * 30}%, ${26 + t * 34}%)`;
      }

      // position of a ball at time `now`; each segment is a ballistic arc between two peg contacts
      function ballPos(b, now) {
        const elapsed = Math.max(0, now - b.t0);
        let s = 0;
        let acc = 0;
        while (s < b.segs.length && acc + b.segs[s].ms <= elapsed) { acc += b.segs[s].ms; s++; }
        if (s >= b.segs.length) return null;
        const seg = b.segs[s];
        const t = (elapsed - acc) / seg.ms;
        const x = seg.a.x + (seg.c.x - seg.a.x) * t;
        const y = seg.a.y - seg.b * t + (seg.c.y - seg.a.y + seg.b) * t * t;
        return { x, y, s };
      }

      function draw(now) {
        ctx.clearRect(0, 0, W, H);
        // spotlight cone
        const grad = ctx.createLinearGradient(0, TOP - 10, 0, py(rows));
        grad.addColorStop(0, 'rgba(168,85,247,0.28)');
        grad.addColorStop(1, 'rgba(168,85,247,0.02)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx - 14, TOP - 10);
        ctx.lineTo(cx + 14, TOP - 10);
        ctx.lineTo(px(rows, rows) + dx / 2, py(rows));
        ctx.lineTo(px(rows, 0) - dx / 2, py(rows));
        ctx.closePath();
        ctx.fill();

        // pegs – glow and swell when hit
        for (let r = 0; r < rows; r++) {
          for (let j = 0; j <= r; j++) {
            const hit = pegHit.get(r * 100 + j);
            const k = hit ? Math.max(0, 1 - (now - hit) / 380) : 0;
            ctx.beginPath();
            ctx.arc(px(r, j), py(r), 3.6 + k * 2.6, 0, Math.PI * 2);
            ctx.shadowColor = 'rgba(192,132,252,0.9)';
            ctx.shadowBlur = 8 + k * 16;
            ctx.fillStyle = k > 0 ? `rgb(${192 + 51 * k},${132 + 100 * k},252)` : '#c084fc';
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;

        // slots – dip down and outline when hit
        ctx.font = `700 ${Math.max(9, Math.min(13, dx * 0.27))}px "Geist Mono", ui-monospace, monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        mults.forEach((m, k) => {
          const hit = slotHit.get(k);
          const t = hit ? Math.max(0, 1 - (now - hit) / 500) : 0;
          const x = px(rows, k) - sw / 2;
          const y = sy + Math.sin(t * Math.PI) * 7;
          ctx.fillStyle = slotColor(m);
          if (t > 0 && m >= 1) { ctx.shadowColor = 'rgba(192,132,252,.9)'; ctx.shadowBlur = 18 * t; }
          ctx.beginPath();
          ctx.roundRect(x, y, sw, sh, 6);
          ctx.fill();
          ctx.shadowBlur = 0;
          if (t > 0) {
            ctx.strokeStyle = `rgba(255,255,255,${t})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          ctx.fillStyle = m < 1 ? '#8b8798' : '#fff';
          ctx.fillText(fmtM(m), x + sw / 2, y + sh / 2 + 1);
        });

        // balls with a short fading trail
        for (let i = balls.length - 1; i >= 0; i--) {
          const b = balls[i];
          const p = ballPos(b, now);
          if (!p) { land(b, now); balls.splice(i, 1); continue; }
          if (p.s > b.seg) {
            b.seg = p.s;
            if (p.s >= 1 && p.s <= rows) {
              pegHit.set((p.s - 1) * 100 + b.path[p.s - 1], now);
              Nova.sfx.peg(p.s - 1);
            }
          }
          b.trail.push(p);
          if (b.trail.length > 7) b.trail.shift();
          b.trail.forEach((q, n) => {
            ctx.beginPath();
            ctx.arc(q.x, q.y, ballR * (0.35 + n / 14), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(192,132,252,${(n / b.trail.length) * 0.22})`;
            ctx.fill();
          });
          ctx.beginPath();
          ctx.arc(p.x, p.y, ballR, 0, Math.PI * 2);
          ctx.shadowColor = 'rgba(216,180,254,1)';
          ctx.shadowBlur = 14;
          const bg = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, ballR * 1.6);
          bg.addColorStop(0, '#fff');
          bg.addColorStop(1, '#a855f7');
          ctx.fillStyle = bg;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // floating payout labels above the slots
        for (let i = floaters.length - 1; i >= 0; i--) {
          const f = floaters[i];
          const t = (now - f.t0) / 900;
          if (t >= 1) { floaters.splice(i, 1); continue; }
          ctx.globalAlpha = 1 - t;
          ctx.fillStyle = f.color;
          ctx.font = `700 13px "Geist Mono", ui-monospace, monospace`;
          ctx.fillText(f.text, f.x, sy - 10 - t * 34);
          ctx.globalAlpha = 1;
        }
      }

      function loop() {
        if (!alive) return;
        draw(performance.now());
        raf = requestAnimationFrame(loop);
      }

      function land(b, now) {
        const m = b.mult;
        const win = round2(b.stake * m);
        slotHit.set(b.slot, now);
        if (win > 0) Nova.wallet.credit(win);
        const profit = round2(win - b.stake);
        Nova.sfx.slot(m);
        floaters.push({ x: px(rows, b.slot), text: `+${fmt(win)}`, color: m >= 1 ? '#86efac' : '#a09bb0', t0: now });
        recent.add(`${fmtM(m)} · ${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit))}`, m >= 1 ? 'win' : 'lose');
        if (m >= 10) {
          Nova.sfx.cash(3);
          Nova.fx.confetti();
          shell.flash('win');
        } else if (m >= 3) {
          Nova.sfx.coins(5);
          const r = canvas.getBoundingClientRect();
          const s = r.width / W;
          Nova.fx.burst(r.left + px(rows, b.slot) * s, r.top + sy * s, { count: 18, speed: 6, up: 3, life: 800 });
        }
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
        Nova.sfx.drop();
        // path[r] = column of the peg hit in row r; last entry = slot
        const path = [];
        let j = 0;
        for (let r = 0; r < rows; r++) { path.push(j); j += Nova.randInt(2); }
        path.push(j);
        // contact points: resting on top of each peg, nudged toward the side it bounces to
        const pts = [{ x: cx + (Math.random() - 0.5) * 4, y: TOP - 34 }];
        for (let r = 0; r < rows; r++) {
          const dir = path[r + 1] === path[r] ? -1 : 1;
          pts.push({ x: px(r, path[r]) + dir * dx * 0.12 + (Math.random() - 0.5) * 2, y: py(r) - 3.6 - ballR });
        }
        pts.push({ x: px(rows, j), y: sy + sh / 2 });
        const segMs = rows >= 16 ? 105 : rows >= 12 ? 120 : 140;
        const segs = [];
        for (let s = 0; s < pts.length - 1; s++) {
          segs.push({ a: pts[s], c: pts[s + 1], b: s === 0 ? 0 : dy * (0.35 + Math.random() * 0.2), ms: s === 0 ? 220 : segMs });
        }
        balls.push({ stake, path, segs, seg: -1, trail: [], slot: j, mult: mults[j], t0: performance.now() });
        updateBalls();
      }

      dropBtn.addEventListener('click', drop);
      const onKey = (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON')) return;
        e.preventDefault();
        drop();
      };
      document.addEventListener('keydown', onKey);
      shell.cleanup(() => document.removeEventListener('keydown', onKey));

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
