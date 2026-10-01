/* Crash – a rocket climbs along an exponential curve; cash out before it explodes.
   P(crash ≥ x) = 0.96 / x, so every cash-out target returns 96%. */
(function () {
  'use strict';
  const { h, fmt, round2 } = Nova;

  const EDGE = 0.96;
  const MAX = 10000;
  const K = 0.00009; // growth per ms: 2× ≈ 7.7 s, 10× ≈ 25.6 s, 100× ≈ 51 s
  const multAt = (ms) => Math.exp(K * ms);
  const timeFor = (m) => Math.log(m) / K;
  const floor2 = (m) => Math.floor(m * 100 + 1e-9) / 100;

  function crashPoint() {
    const r = EDGE / (1 - Nova.rand());
    return Nova.clamp(floor2(r), 1, MAX);
  }
  Nova.crashPoint = crashPoint;

  /* ---------- canvas scene: stars, grid, curve, rocket, smoke, explosion ---------- */
  function scene(canvas, opts = {}) {
    const c = canvas.getContext('2d');
    const compact = !!opts.compact;
    let W = 0, H = 0, dpr = 1;
    let raf = 0;
    let dead = false;
    let attached = false;
    let last = performance.now();

    const stars = Array.from({ length: compact ? 50 : 110 }, () => ({ x: Math.random(), y: Math.random(), z: 0.2 + Math.random() * 0.8 }));
    let smoke = [];
    let sparks = [];
    let rings = [];

    // phase: idle | ignite | fly | crash
    const st = { phase: 'idle', t0: 0, crash: 1, m: 1, t: 0, cashouts: [], shakeUntil: 0, crashedAt: 0, igniteUntil: 0, rocket: { x: 0, y: 0, a: -0.6 } };
    let onTick = null;
    let resolveFly = null;

    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = Math.max(1, r.width);
      H = Math.max(1, r.height);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const pad = () => compact
      ? { l: 18, r: 46, t: 34, b: 22 }
      : { l: 54, r: 70, t: 70, b: 40 };

    /* plot ranges grow with the flight */
    function ranges(t, m) {
      return { xMax: Math.max(compact ? 7000 : 9000, t * 1.18), yMax: Math.max(2, m * 1.25) };
    }
    function toScreen(t, m, R, P) {
      const pw = W - P.l - P.r;
      const ph = H - P.t - P.b;
      return { x: P.l + (t / R.xMax) * pw, y: H - P.b - ((m - 1) / (R.yMax - 1)) * ph };
    }

    function niceStep(range, n) {
      const raw = range / n;
      const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const k = raw / p;
      return (k < 1.5 ? 1 : k < 3.5 ? 2 : k < 7.5 ? 5 : 10) * p;
    }

    function drawStars(dt, speed, ang) {
      const vx = -Math.cos(ang) * speed;
      const vy = -Math.sin(ang) * speed;
      c.fillStyle = '#fff';
      for (const s of stars) {
        s.x += (vx * s.z * dt) / W;
        s.y += (vy * s.z * dt) / H;
        if (s.x < 0) { s.x += 1; s.y = Math.random(); }
        if (s.x > 1) s.x -= 1;
        if (s.y < 0) s.y += 1;
        if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
        const streak = Math.min(26, speed * 0.05 * s.z);
        c.globalAlpha = 0.25 + s.z * 0.55;
        if (streak > 1.5) {
          c.strokeStyle = '#e9d5ff';
          c.lineWidth = s.z * 1.4;
          c.beginPath();
          c.moveTo(s.x * W, s.y * H);
          c.lineTo(s.x * W - (vx / speed) * streak, s.y * H - (vy / speed) * streak);
          c.stroke();
        } else {
          c.beginPath();
          c.arc(s.x * W, s.y * H, s.z * 1.3, 0, Math.PI * 2);
          c.fill();
        }
      }
      c.globalAlpha = 1;
    }

    function drawGrid(R, P) {
      c.font = '500 11px "Geist Mono", ui-monospace, monospace';
      c.lineWidth = 1;
      // horizontal: multipliers
      const yStep = niceStep(R.yMax - 1, compact ? 3 : 5);
      for (let v = 1; v <= R.yMax + 1e-9; v += yStep) {
        const { y } = toScreen(0, v, R, P);
        c.strokeStyle = 'rgba(255,255,255,.06)';
        c.beginPath(); c.moveTo(P.l, y); c.lineTo(W - P.r + 20, y); c.stroke();
        if (!compact) {
          c.fillStyle = 'rgba(201,196,214,.55)';
          c.textAlign = 'right';
          c.fillText((v >= 100 ? Math.round(v) : v.toFixed(v < 10 ? 1 : 0)) + '×', P.l - 10, y + 4);
        }
      }
      // vertical: seconds
      if (!compact) {
        const xStep = niceStep(R.xMax / 1000, 6);
        c.textAlign = 'center';
        for (let s = xStep; s * 1000 <= R.xMax; s += xStep) {
          const { x } = toScreen(s * 1000, 1, R, P);
          c.strokeStyle = 'rgba(255,255,255,.04)';
          c.beginPath(); c.moveTo(x, P.t - 20); c.lineTo(x, H - P.b); c.stroke();
          c.fillStyle = 'rgba(141,136,156,.7)';
          c.fillText(Math.round(s) + 's', x, H - P.b + 20);
        }
      }
      // axes
      c.strokeStyle = 'rgba(192,132,252,.25)';
      c.beginPath(); c.moveTo(P.l, P.t - 20); c.lineTo(P.l, H - P.b); c.lineTo(W - P.r + 20, H - P.b); c.stroke();
    }

    function drawCurve(R, P, t, crashed) {
      const n = 90;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const ti = (t * i) / n;
        pts.push(toScreen(ti, multAt(ti), R, P));
      }
      const base = H - P.b;
      const col = crashed ? [239, 68, 68] : [192, 132, 252];
      // fill under the curve
      const g = c.createLinearGradient(0, P.t, 0, base);
      g.addColorStop(0, `rgba(${col},.32)`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.beginPath();
      c.moveTo(pts[0].x, base);
      pts.forEach((p) => c.lineTo(p.x, p.y));
      c.lineTo(pts[n].x, base);
      c.closePath();
      c.fillStyle = g;
      c.fill();
      // line with glow
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = `rgba(${col},.35)`;
      c.lineWidth = compact ? 7 : 10;
      c.stroke();
      const lg = c.createLinearGradient(pts[0].x, 0, pts[n].x, 0);
      lg.addColorStop(0, crashed ? '#7f1d1d' : '#7c3aed');
      lg.addColorStop(1, crashed ? '#f87171' : '#f0abfc');
      c.strokeStyle = lg;
      c.lineWidth = compact ? 3 : 4;
      c.stroke();
      return pts;
    }

    function drawRocket(x, y, ang, s, flame, now) {
      c.save();
      c.translate(x, y);
      c.rotate(ang);
      // flame
      if (flame > 0) {
        const fl = s * (0.55 + flame * (0.9 + Math.random() * 0.45));
        const fw = s * 0.15;
        const fg = c.createLinearGradient(-s * 0.45, 0, -s * 0.45 - fl, 0);
        fg.addColorStop(0, '#fff7d6');
        fg.addColorStop(0.25, '#fde047');
        fg.addColorStop(0.6, '#f97316');
        fg.addColorStop(1, 'rgba(239,68,68,0)');
        c.fillStyle = fg;
        c.beginPath();
        c.moveTo(-s * 0.45, -fw);
        c.quadraticCurveTo(-s * 0.45 - fl * 0.5, -fw * 1.4, -s * 0.45 - fl, 0);
        c.quadraticCurveTo(-s * 0.45 - fl * 0.5, fw * 1.4, -s * 0.45, fw);
        c.closePath();
        c.fill();
        c.globalCompositeOperation = 'lighter';
        const gl = c.createRadialGradient(-s * 0.5, 0, 0, -s * 0.5, 0, s * 0.7);
        gl.addColorStop(0, 'rgba(253,186,116,.55)');
        gl.addColorStop(1, 'rgba(253,186,116,0)');
        c.fillStyle = gl;
        c.beginPath(); c.arc(-s * 0.5, 0, s * 0.7, 0, Math.PI * 2); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      // fins
      c.fillStyle = '#7c3aed';
      c.beginPath(); c.moveTo(-s * 0.12, -s * 0.15); c.lineTo(-s * 0.5, -s * 0.4); c.lineTo(-s * 0.42, -s * 0.1); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-s * 0.12, s * 0.15); c.lineTo(-s * 0.5, s * 0.4); c.lineTo(-s * 0.42, s * 0.1); c.closePath(); c.fill();
      // nozzle
      c.fillStyle = '#3b3446';
      c.fillRect(-s * 0.5, -s * 0.1, s * 0.1, s * 0.2);
      // body
      const bg = c.createLinearGradient(0, -s * 0.2, 0, s * 0.2);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.55, '#ddd6ea');
      bg.addColorStop(1, '#8b819e');
      c.fillStyle = bg;
      c.beginPath();
      c.moveTo(s * 0.62, 0);
      c.bezierCurveTo(s * 0.42, -s * 0.22, -s * 0.05, -s * 0.2, -s * 0.42, -s * 0.15);
      c.lineTo(-s * 0.42, s * 0.15);
      c.bezierCurveTo(-s * 0.05, s * 0.2, s * 0.42, s * 0.22, s * 0.62, 0);
      c.fill();
      // nose cone
      c.save();
      c.clip();
      c.fillStyle = '#c084fc';
      c.fillRect(s * 0.36, -s * 0.3, s * 0.4, s * 0.6);
      c.restore();
      // window
      c.fillStyle = '#1e1036';
      c.strokeStyle = '#fff';
      c.lineWidth = Math.max(1.5, s * 0.045);
      c.beginPath(); c.arc(s * 0.12, 0, s * 0.085, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = 'rgba(192,132,252,.8)';
      c.beginPath(); c.arc(s * 0.1, -s * 0.025, s * 0.03, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    function emitSmoke(x, y, ang, s, k) {
      const bx = x - Math.cos(ang) * s * 0.55;
      const by = y - Math.sin(ang) * s * 0.55;
      for (let i = 0; i < (compact ? 1 : 2); i++) {
        smoke.push({
          x: bx, y: by,
          vx: -Math.cos(ang) * (0.6 + Math.random() * 1.2) * k + (Math.random() - 0.5) * 0.6,
          vy: -Math.sin(ang) * (0.6 + Math.random() * 1.2) * k + (Math.random() - 0.5) * 0.6,
          r: s * (0.08 + Math.random() * 0.1), life: 0, max: 600 + Math.random() * 600,
        });
      }
    }

    function explode(x, y) {
      const n = compact ? 40 : 90;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = 1.5 + Math.random() * (compact ? 4 : 7);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0, max: 500 + Math.random() * 700,
          col: ['#fde047', '#f97316', '#ef4444', '#fff7d6', '#f0abfc'][i % 5], r: 1.5 + Math.random() * 3 });
      }
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        smoke.push({ x, y, vx: Math.cos(a) * Math.random() * 2, vy: Math.sin(a) * Math.random() * 2, r: 6 + Math.random() * 12, life: 0, max: 900 + Math.random() * 700 });
      }
      rings.push({ x, y, life: 0, max: 650 });
    }

    function frame(now) {
      if (dead) return;
      raf = requestAnimationFrame(frame);
      if (!canvas.isConnected) { if (attached) destroy(); return; }
      attached = true;
      const dt = Math.min(64, now - last);
      last = now;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);

      const P = pad();
      const s = compact ? 30 : Math.max(38, Math.min(56, W / 16));

      // advance the flight
      if (st.phase === 'fly') {
        st.t = now - st.t0;
        st.m = Math.min(multAt(st.t), st.crash);
        if (onTick) onTick(st.m, st.t);
        if (st.m >= st.crash) {
          st.phase = 'crash';
          st.t = timeFor(st.crash);
          st.crashedAt = now;
          st.shakeUntil = now + 450;
          explode(st.rocket.x, st.rocket.y);
          const r = resolveFly;
          resolveFly = null;
          onTick = null;
          if (r) r('crash');
        }
      }

      const flying = st.phase === 'fly';
      const t = st.phase === 'idle' || st.phase === 'ignite' ? 0 : st.t;
      const m = st.phase === 'idle' || st.phase === 'ignite' ? 1 : st.m;
      const R = ranges(t, m);

      // camera shake
      c.save();
      if (now < st.shakeUntil) {
        const k = (st.shakeUntil - now) / 450;
        c.translate((Math.random() - 0.5) * 12 * k, (Math.random() - 0.5) * 12 * k);
      } else if (st.phase === 'ignite') {
        c.translate((Math.random() - 0.5) * 2.2, (Math.random() - 0.5) * 2.2);
      }

      const speed = flying ? 60 + Math.log(m) * 260 : st.phase === 'ignite' ? 25 : 12;
      drawStars(dt / 16, speed / 16 * (compact ? 0.7 : 1), flying ? st.rocket.a : -0.35);
      drawGrid(R, P);

      let tip;
      if (st.phase === 'fly' || st.phase === 'crash') {
        const pts = drawCurve(R, P, t, st.phase === 'crash');
        tip = pts[pts.length - 1];
        // cash-out markers
        st.cashouts.forEach((co) => {
          const p = toScreen(timeFor(co.m), co.m, R, P);
          c.fillStyle = '#4ade80';
          c.strokeStyle = '#052e16';
          c.lineWidth = 2;
          c.beginPath(); c.arc(p.x, p.y, compact ? 4 : 6, 0, Math.PI * 2); c.fill(); c.stroke();
          if (!compact) {
            c.font = '700 12px "Geist Mono", ui-monospace, monospace';
            c.textAlign = 'center';
            c.fillStyle = '#86efac';
            c.fillText(co.label, p.x, p.y - 12);
          }
        });
      } else {
        tip = toScreen(0, 1, R, P);
      }

      // rocket position & heading
      if (st.phase === 'fly') {
        const dtProbe = 60;
        const a2 = toScreen(t + dtProbe, multAt(t + dtProbe), R, P);
        st.rocket.a = Math.atan2(a2.y - tip.y, a2.x - tip.x);
        st.rocket.x = tip.x;
        st.rocket.y = tip.y;
      } else if (st.phase === 'idle' || st.phase === 'ignite') {
        st.rocket.a = -0.55;
        st.rocket.x = tip.x + s * 0.3;
        st.rocket.y = tip.y - s * 0.32 + (st.phase === 'idle' ? Math.sin(now / 500) * 2 : 0);
      }

      // smoke
      if (flying) emitSmoke(st.rocket.x, st.rocket.y, st.rocket.a, s, 1 + Math.log(m));
      else if (st.phase === 'ignite') { emitSmoke(st.rocket.x, st.rocket.y, st.rocket.a, s, 0.6); emitSmoke(st.rocket.x, st.rocket.y, st.rocket.a, s, 0.4); }
      smoke = smoke.filter((p) => {
        p.life += dt;
        if (p.life >= p.max) return false;
        const k = p.life / p.max;
        p.x += p.vx * dt / 16;
        p.y += p.vy * dt / 16;
        p.vx *= 0.97; p.vy *= 0.97;
        c.globalAlpha = (1 - k) * 0.28;
        c.fillStyle = '#d8ccef';
        c.beginPath(); c.arc(p.x, p.y, p.r * (1 + k * 2.2), 0, Math.PI * 2); c.fill();
        return true;
      });
      c.globalAlpha = 1;

      // rocket
      if (st.phase !== 'crash') {
        const flame = flying ? Math.min(1.4, 0.75 + Math.log(m) * 0.18) : st.phase === 'ignite' ? 0.35 + Math.random() * 0.3 : 0;
        drawRocket(st.rocket.x, st.rocket.y, st.rocket.a, s, flame, now);
      }

      // explosion
      rings = rings.filter((r) => {
        r.life += dt;
        if (r.life >= r.max) return false;
        const k = r.life / r.max;
        c.strokeStyle = `rgba(253,224,71,${(1 - k) * 0.8})`;
        c.lineWidth = 4 * (1 - k) + 1;
        c.beginPath(); c.arc(r.x, r.y, 8 + k * (compact ? 60 : 120), 0, Math.PI * 2); c.stroke();
        if (k < 0.25) {
          c.fillStyle = `rgba(255,247,214,${(0.25 - k) * 3})`;
          c.beginPath(); c.arc(r.x, r.y, 30 + k * 120, 0, Math.PI * 2); c.fill();
        }
        return true;
      });
      sparks = sparks.filter((p) => {
        p.life += dt;
        if (p.life >= p.max) return false;
        const k = p.life / p.max;
        p.x += p.vx * dt / 16;
        p.y += p.vy * dt / 16;
        p.vx *= 0.965; p.vy = p.vy * 0.965 + 0.05;
        c.globalAlpha = 1 - k;
        c.fillStyle = p.col;
        c.beginPath(); c.arc(p.x, p.y, p.r * (1 - k * 0.5), 0, Math.PI * 2); c.fill();
        return true;
      });
      c.globalAlpha = 1;
      c.restore();
    }
    raf = requestAnimationFrame(frame);

    function destroy() {
      dead = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (resolveFly) { const r = resolveFly; resolveFly = null; r('gone'); }
    }

    return {
      get phase() { return st.phase; },
      get m() { return st.m; },
      get rocketPos() { return { x: st.rocket.x, y: st.rocket.y }; },
      idle() {
        if (resolveFly) { const r = resolveFly; resolveFly = null; onTick = null; r('skip'); }
        st.phase = 'idle'; st.m = 1; st.t = 0; st.cashouts = [];
      },
      ignite(ms) {
        st.phase = 'ignite'; st.cashouts = []; st.m = 1; st.t = 0;
        return Nova.sleep(ms);
      },
      /* resolves 'crash' when it blows up, 'skip' if idle() is called first */
      fly(crash, tick) {
        st.phase = 'fly'; st.crash = crash; st.t0 = performance.now(); st.m = 1; st.t = 0;
        onTick = tick;
        return new Promise((res) => { resolveFly = res; });
      },
      markCashout(m, label) { st.cashouts.push({ m, label }); },
      destroy,
    };
  }
  Nova.crashScene = scene;

  /* ---------- the game ---------- */
  const tier = (m) => (m >= 10 ? 'gold' : m >= 2 ? 'hi' : 'lo');

  Nova.register({
    id: 'crash',
    title: 'Crash',
    titleHtml: '<span class="grad">Crash</span>',
    icon: 'rocket',
    subtitle: 'Ride the rocket. Cash out before it blows.',
    badges: [
      { html: Nova.icon('trending', 14) + '<span>Up to 10,000×</span>', cls: 'accent' },
      { html: Nova.icon('shield-check', 14) + '<span>96% RTP</span>', cls: 'good' },
    ],
    mount(shell) {
      let state = 'ready'; // ready | ignite | flying
      let stake = 0;
      let cashed = false;
      let roundCrash = 1;
      let auto = true;
      let target = 2;
      let autoPlay = false;
      let autoTimer = 0;
      let engine = null;
      let milestone = 0;
      let rounds = 0;
      let profit = 0;

      /* stage */
      const history = h('div', { class: 'crash-history' }, h('span', { class: 'muted small' }, 'Last crashes appear here'));
      const canvas = h('canvas', { class: 'crash-canvas', 'aria-hidden': 'true' });
      const multEl = h('div', { class: 'crash-mult mono' }, '1.00×');
      const subEl = h('div', { class: 'crash-sub' }, 'Place your bet and launch');
      const hud = h('div', { class: 'crash-hud' }, multEl, subEl);
      const view = h('div', { class: 'crash-view' }, canvas, hud);
      const recent = Nova.ui.recent('Your rounds', 'No rounds yet this session.', 14);
      shell.stage.classList.add('crash-stage');
      shell.stage.append(h('div', { class: 'stage-top crash-top' }, history), view, recent.root);
      const sc = scene(canvas);
      shell.cleanup(() => sc.destroy());

      /* controls */
      const bet = Nova.ui.betControl(shell);
      const targetInput = h('input', { class: 'bet-input left mono', type: 'text', inputmode: 'decimal', value: '2.00', 'aria-label': 'Auto cash out multiplier' });
      const autoSwitch = h('button', { class: 'switch on', type: 'button', role: 'switch', 'aria-checked': 'true', 'aria-label': 'Auto cash out', html: '<i></i>' });
      const presets = h('div', { class: 'preset-grid four' });
      [1.5, 2, 5, 10].forEach((v) => {
        const b = h('button', { class: 'preset', type: 'button' }, v + '×');
        b.addEventListener('click', () => { if (state === 'ready') setTarget(v); });
        presets.append(b);
      });
      const chanceRow = h('div', { class: 'stat-row' }, h('span', {}, 'Win chance'), h('b', { class: 'mono' }));
      const payoutRow = h('div', { class: 'stat-row' }, h('span', {}, 'Payout at target'), h('b', { class: 'mono good-text' }));
      const mainBtn = h('button', { class: 'btn-primary', type: 'button' });
      const autoPlaySwitch = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-checked': 'false', 'aria-label': 'Auto-play', html: '<i></i>' });
      const autoPlayRow = h('label', { class: 'switch-row' }, h('span', {}, h('b', {}, 'Auto-play'), h('small', {}, 'Relaunch every round with these settings')), autoPlaySwitch);

      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'Launch control'),
        bet.root,
        h('div', { class: 'field' },
          h('div', { class: 'field-label-row' }, h('label', { class: 'field-label' }, 'Auto cash out'), autoSwitch),
          h('div', { class: 'target-row' }, targetInput, h('span', { class: 'target-x' }, '×')),
          presets),
        chanceRow, payoutRow,
        mainBtn,
        autoPlayRow,
        h('p', { class: 'hint' }, 'The multiplier climbs until the rocket explodes — anywhere from 1.00× to 10,000×. Cash out in time to win your bet times the multiplier. Space bar launches and cashes out.'));

      function setTarget(v) {
        v = parseFloat(String(v).replace(',', '.'));
        if (!isFinite(v)) v = 2;
        target = Nova.clamp(floor2(v), 1.01, MAX);
        targetInput.value = target.toFixed(2);
        Nova.ui.bump(targetInput, 1.05);
        draw();
      }
      targetInput.addEventListener('change', () => setTarget(targetInput.value));
      targetInput.addEventListener('focus', () => targetInput.select());
      autoSwitch.addEventListener('click', () => {
        if (state !== 'ready') return;
        auto = !auto;
        if (!auto && autoPlay) toggleAutoPlay(false);
        draw();
      });
      autoPlaySwitch.addEventListener('click', () => toggleAutoPlay(!autoPlay));
      function toggleAutoPlay(on) {
        if (on && !auto) { auto = true; Nova.ui.toast('Auto-play needs auto cash out — turned it on', 'info'); }
        autoPlay = on;
        clearTimeout(autoTimer);
        if (on && state === 'ready') launch();
        draw();
      }

      function draw() {
        autoSwitch.classList.toggle('on', auto);
        autoSwitch.setAttribute('aria-checked', String(auto));
        autoPlaySwitch.classList.toggle('on', autoPlay);
        autoPlaySwitch.setAttribute('aria-checked', String(autoPlay));
        const locked = state !== 'ready';
        targetInput.disabled = locked || !auto;
        presets.querySelectorAll('.preset').forEach((b) => {
          b.disabled = locked || !auto;
          b.classList.toggle('active', auto && parseFloat(b.textContent) === target);
        });
        autoSwitch.disabled = locked;
        chanceRow.lastChild.textContent = auto ? (EDGE / target * 100).toFixed(2) + '%' : '—';
        payoutRow.lastChild.innerHTML = auto ? `${fmt(round2(bet.get() * target))} <small>coins</small>` : '<small>manual cash out</small>';
        syncBtn();
      }

      function syncBtn() {
        mainBtn.classList.remove('cash');
        if (state === 'ignite') { mainBtn.disabled = true; mainBtn.innerHTML = Nova.icon('rocket', 18) + '<span>Igniting…</span>'; return; }
        if (state === 'flying' && !cashed) {
          mainBtn.disabled = false;
          mainBtn.classList.add('cash');
          mainBtn.innerHTML = `<span>Cash out</span><b class="mono">${fmt(round2(stake * floor2(sc.m)))}</b>`;
          return;
        }
        if (state === 'flying' && cashed) {
          const block = Nova.ui.betBlock(bet);
          mainBtn.disabled = !!block;
          mainBtn.innerHTML = block || Nova.icon('rocket', 18) + '<span>Launch next round</span>';
          return;
        }
        const block = Nova.ui.betBlock(bet);
        mainBtn.disabled = !!block;
        mainBtn.innerHTML = block || Nova.icon('rocket', 18) + '<span>Launch</span>';
      }
      bet.on(draw);
      shell.cleanup(Nova.wallet.subscribe(() => { if (state !== 'flying' || cashed) syncBtn(); }));

      function addHistory(m) {
        if (!history.querySelector('.crash-chip')) history.textContent = '';
        const chip = h('span', { class: 'crash-chip mono ' + tier(m) }, Nova.fmtMult(m));
        history.prepend(chip);
        Nova.anim(chip, [{ opacity: 0, transform: 'translateX(-10px) scale(.8)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.3,1.3)' });
        while (history.children.length > 16) history.lastChild.remove();
      }

      function setHud(m, mode) {
        multEl.textContent = Nova.fmtMult(m);
        hud.className = 'crash-hud ' + (mode || '');
      }

      async function launch() {
        clearTimeout(autoTimer);
        if (state === 'flying' && cashed) { // skip the rest of a round we already cashed out of
          addHistory(roundCrash);
          if (engine) { engine.stop(0.1); engine = null; }
          sc.idle();
          state = 'ready';
        }
        if (state !== 'ready') return;
        if (Nova.ui.betBlock(bet)) { if (autoPlay) toggleAutoPlay(false); Nova.sfx.error(); return; }
        if (auto) setTarget(targetInput.value);
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        state = 'ignite';
        cashed = false;
        milestone = 0;
        roundCrash = crashPoint();
        bet.lock(true);
        draw();
        setHud(1, 'ignite');
        subEl.textContent = 'Ignition…';
        Nova.sfx.bet();
        Nova.sfx.ignite();
        await sc.ignite(1000);
        if (!view.isConnected) return;
        state = 'flying';
        engine = Nova.sfx.engine();
        setHud(1, 'flying');
        subEl.textContent = auto ? `Auto cash out at ${Nova.fmtMult(target)}` : 'Cash out any time';
        draw();
        const how = await sc.fly(roundCrash, onTick);
        if (how === 'crash') crashed();
      }

      function onTick(m) {
        setHud(m, cashed ? 'flying cashed' : 'flying');
        if (engine) engine.set(Math.min(1, Math.log(m) / Math.log(50)));
        const marks = [2, 5, 10, 25, 50, 100, 250, 500, 1000];
        while (milestone < marks.length && m >= marks[milestone]) { Nova.sfx.milestone(milestone); milestone++; }
        if (!cashed) {
          if (auto && m >= target) cashOut(target);
          else syncBtn();
        }
      }

      function cashOut(at) {
        if (state !== 'flying' || cashed) return;
        at = floor2(at);
        if (at < 1.01) return; // nothing to win at 1.00×
        cashed = true;
        const win = round2(stake * at);
        Nova.wallet.credit(win);
        rounds++;
        profit = round2(profit + win - stake);
        sc.markCashout(at, '+' + fmt(win));
        const lvl = Nova.sfx.level(at);
        Nova.sfx.cash(lvl);
        Nova.fx.at(mainBtn, { count: 30 + lvl * 12, speed: 9 });
        if (at >= 10) Nova.fx.confetti();
        shell.flash('win');
        shell.result({ win: true, big: '+' + fmt(win), small: 'cashed out at ' + Nova.fmtMult(at), anchor: hud });
        subEl.innerHTML = `<b class="good-text">Cashed out at ${Nova.fmtMult(at)}</b> · +${fmt(win)} coins`;
        recent.add(Nova.fmtMult(at) + ' · +' + fmt(round2(win - stake)), 'win');
        recent.setRight(`${rounds} rounds · <b class="${profit >= 0 ? 'good-text' : 'bad-text'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</b>`);
        bet.lock(false);
        syncBtn();
        if (autoPlay) autoTimer = setTimeout(() => { if (view.isConnected && autoPlay) launch(); }, 1400);
      }

      function crashed() {
        if (engine) { engine.stop(0.1); engine = null; }
        Nova.sfx.crash();
        addHistory(roundCrash);
        setHud(roundCrash, 'crashed');
        if (!cashed) {
          rounds++;
          profit = round2(profit - stake);
          shell.flash('lose');
          Nova.fx.shake(view, 9);
          subEl.innerHTML = `<b class="bad-text">Crashed at ${Nova.fmtMult(roundCrash)}</b> · −${fmt(stake)} coins`;
          recent.add('✕ ' + Nova.fmtMult(roundCrash) + ' · −' + fmt(stake), 'lose');
          recent.setRight(`${rounds} rounds · <b class="${profit >= 0 ? 'good-text' : 'bad-text'}">${profit >= 0 ? '+' : ''}${fmt(profit)}</b>`);
        } else {
          subEl.innerHTML = `Rocket blew up at ${Nova.fmtMult(roundCrash)} — you were already out`;
        }
        state = 'ready';
        bet.lock(false);
        draw();
        // after a cash-out the relaunch is already scheduled by cashOut()
        if (autoPlay && !cashed) autoTimer = setTimeout(() => { if (view.isConnected && autoPlay) launch(); }, 1600);
      }

      mainBtn.addEventListener('click', () => {
        if (state === 'flying' && !cashed) cashOut(sc.m);
        else launch();
      });
      const onKey = (e) => {
        if (e.code !== 'Space' || e.repeat) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON' || t.closest('.modal'))) return;
        e.preventDefault();
        if (!mainBtn.disabled) mainBtn.click();
      };
      document.addEventListener('keydown', onKey);
      shell.cleanup(() => document.removeEventListener('keydown', onKey));
      shell.cleanup(() => {
        clearTimeout(autoTimer);
        if (engine) engine.stop(0.1);
        if (state === 'ignite') Nova.wallet.credit(stake); // not launched yet: refund
        // leaving mid-flight: an auto cash-out that would have been hit still pays
        if (state === 'flying' && !cashed && auto && target <= roundCrash) Nova.wallet.credit(round2(stake * target));
      });

      setTarget(2);
      draw();
    },
  });
})();
