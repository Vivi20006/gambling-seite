/* Chicken – cross the road lane by lane, every safe step raises the multiplier */
(function () {
  const { h, fmt, fmtMult, round2 } = Nova;
  const LANES = 10;
  const EDGE = 0.96;
  const HOP_MS = 440;
  const DIFFS = {
    easy: { label: 'Easy', safe: 0.85 },
    medium: { label: 'Medium', safe: 0.7 },
    hard: { label: 'Hard', safe: 0.55 },
    extreme: { label: 'Extreme', safe: 0.45 },
  };
  const CARS = ['🚗', '🚕', '🚙', '🚓'];
  const mult = (d, steps) => EDGE / Math.pow(DIFFS[d].safe, steps);

  Nova.register({
    id: 'chicken',
    title: 'Chicken',
    icon: 'footprints',
    subtitle: 'Cross the road lane by lane. Cash out before the traffic gets you.',
    badges: [
      { html: Nova.icon('footprints', 14) + `<span>${LANES} lanes</span>`, cls: 'accent' },
      { html: 'Random outcomes' },
    ],
    mount(shell) {
      let diff = 'easy';
      let active = false;
      let busy = false;
      let step = 0; // lanes crossed
      let stake = 0;
      let lanes = [];
      let startLane;

      const lanePill = Nova.ui.pill('');
      const diffPill = Nova.ui.pill('');
      const multPill = h('span', { class: 'pill mono mult-pill' }, '1.00×');
      const road = h('div', { class: 'road' });
      const bird = h('span', { class: 'chicken-emoji' }, '🐔');
      const chicken = h('div', { class: 'chicken' }, h('span', { class: 'chicken-shadow' }), bird);
      const roadWrap = h('div', { class: 'road-scroll' }, road);
      const status = h('p', { class: 'stage-status' }, 'Pick a difficulty and bet, then start crossing.');
      const recent = Nova.ui.recent('Recent runs', 'No runs yet.', 12);

      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, lanePill, diffPill), multPill),
        roadWrap, status, recent.root);

      const bet = Nova.ui.betControl(shell);
      const seg = Nova.ui.segmented({
        options: Object.entries(DIFFS).map(([k, d]) => ({ value: k, label: d.label, sub: `${Math.round(d.safe * 100)}% safe` })),
        value: 'easy',
        onChange(v) { diff = v; step = 0; buildRoad(); drawPills(); },
      });
      const startBtn = h('button', { class: 'btn-primary', type: 'button' });
      const goBtn = h('button', { class: 'btn-primary', type: 'button', hidden: true, html: `Go ${Nova.icon('arrow-right', 18)}` });
      const cashBtn = h('button', { class: 'btn-primary cash', type: 'button', hidden: true });
      const next = h('p', { class: 'next-hint', hidden: true });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'New run'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Difficulty'), seg.root),
        startBtn, goBtn, cashBtn, next,
        h('p', { class: 'hint' }, 'Every safe lane raises your multiplier. Harder roads mean busier traffic and bigger rewards. Cash out anytime after your first step. Press Space to step.'));

      const sync = Nova.ui.bindStart(shell, startBtn, bet, 'Start run', () => active);

      function buildRoad() {
        road.innerHTML = '';
        lanes = [];
        startLane = h('div', { class: 'lane start' }, h('span', { class: 'lane-mult muted' }, 'START'));
        road.append(startLane);
        for (let i = 0; i < LANES; i++) {
          const el = h('div', { class: 'lane' },
            h('span', { class: 'lane-mult mono' }, fmtMult(mult(diff, i + 1))),
            h('div', { class: 'manhole' }));
          el.addEventListener('click', () => { if (active && i === step) go(); });
          lanes.push(el);
          road.append(el);
        }
        road.append(h('div', { class: 'lane finish', html: `<span class="lane-mult">${Nova.icon('flag', 16)}</span>` }));
        road.append(chicken);
        bird.textContent = '🐔';
        chicken.classList.remove('dead');
        placeChicken(true);
      }

      function placeChicken(instant) {
        const target = step === 0 ? startLane : lanes[step - 1];
        const x = target.offsetLeft + target.offsetWidth / 2 - 26;
        chicken.style.transition = instant ? 'none' : '';
        chicken.style.left = x + 'px';
        const scrollX = Math.max(0, x - roadWrap.clientWidth / 2 + 26);
        if (instant) roadWrap.scrollLeft = scrollX;
        else roadWrap.scrollTo({ left: scrollX, behavior: Nova.reducedMotion ? 'auto' : 'smooth' });
      }

      function drawPills() {
        lanePill.innerHTML = Nova.icon('footprints', 14) + `Lane <b>${step}</b> / ${LANES}`;
        diffPill.textContent = DIFFS[diff].label;
        multPill.textContent = fmtMult(step ? mult(diff, step) : 1);
        if (active) {
          cashBtn.disabled = step === 0 || busy;
          cashBtn.textContent = step ? `Cash out ${fmt(round2(stake * mult(diff, step)))}` : 'Cross a lane first';
          goBtn.disabled = busy;
          next.textContent = `Next lane: ${fmtMult(mult(diff, step + 1))}`;
        }
      }

      /* ambient traffic in lanes the chicken has not reached – purely cosmetic */
      function spawnTraffic() {
        if (document.hidden || !lanes.length) return;
        const first = active ? step + 1 : 0;
        const free = lanes.map((_, i) => i).filter((i) => i >= first && !lanes[i].classList.contains('done') && !lanes[i].querySelector('.car'));
        if (!free.length) return;
        driveCar(lanes[free[Math.floor(Math.random() * free.length)]], 900 + Math.random() * 900);
      }
      function driveCar(lane, ms) {
        const car = h('div', { class: 'car' }, CARS[Math.floor(Math.random() * CARS.length)]);
        lane.append(car);
        const a = Nova.anim(car, [{ top: '-70px' }, { top: 'calc(100% + 10px)' }], { duration: ms, easing: 'linear', fill: 'forwards' });
        if (a) a.onfinish = () => car.remove();
        else setTimeout(() => car.remove(), ms);
        return car;
      }
      const traffic = setInterval(spawnTraffic, 650);
      shell.cleanup(() => clearInterval(traffic));

      function begin() {
        if (active || Nova.ui.betBlock(bet)) return;
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        active = true;
        step = 0;
        Nova.sfx.bet();
        buildRoad();
        bet.lock(true);
        seg.lock(true);
        startBtn.hidden = true;
        goBtn.hidden = false;
        cashBtn.hidden = false;
        next.hidden = false;
        status.textContent = 'Press Go, Space or tap the next lane to cross.';
        lanes[0].classList.add('next');
        drawPills();
      }

      function finish() {
        active = false;
        busy = false;
        bet.lock(false);
        seg.lock(false);
        startBtn.hidden = false;
        goBtn.hidden = true;
        cashBtn.hidden = true;
        next.hidden = true;
        lanes.forEach((l) => l.classList.remove('next'));
        sync();
      }

      async function go() {
        if (!active || busy) return;
        busy = true;
        drawPills();
        const lane = lanes[step];
        const safe = Nova.rand() < DIFFS[diff].safe;
        lane.classList.remove('next');
        lane.querySelectorAll('.car').forEach((c) => c.remove());
        step++;
        Nova.sfx.hop();
        placeChicken(false);
        Nova.anim(bird, [
          { transform: 'translateY(0) scale(1.15, .85)' },
          { transform: 'translateY(-40px) scale(.9, 1.12) rotate(-8deg)', offset: 0.45 },
          { transform: 'translateY(0) scale(1.18, .82)', offset: 0.85 },
          { transform: 'translateY(0) scale(1)' },
        ], { duration: HOP_MS, easing: 'ease-in-out' });
        await Nova.sleep(HOP_MS * 0.85);
        Nova.sfx.land();
        await Nova.sleep(HOP_MS * 0.15);

        if (!safe) {
          Nova.sfx.horn();
          driveCar(lane, 480);
          await Nova.sleep(215);
          Nova.sfx.crash();
          bird.textContent = '💥';
          chicken.classList.add('dead');
          lane.classList.add('crash');
          Nova.fx.at(chicken, { count: 30, speed: 7, size: 6, colors: ['#ffffff', '#fde68a', '#f97316', '#ef4444'], life: 900 });
          Nova.fx.shake(roadWrap, 10);
          shell.flash('lose');
          finish();
          shell.result({ win: false, big: 'Splat!', small: '−' + fmt(stake), anchor: roadWrap });
          status.textContent = `A car got you on lane ${step}. You lost ${fmt(stake)}.`;
          recent.add(`${DIFFS[diff].label} · L${step} · −${fmt(stake)}`, 'lose');
          drawPills();
          return;
        }
        lane.classList.add('done');
        lane.append(h('div', { class: 'barrier' }));
        Nova.sfx.gem(step);
        Nova.ui.bump(multPill, 1.2);
        busy = false;
        if (step === LANES) { cashOut(true); return; }
        lanes[step].classList.add('next');
        status.textContent = 'Made it! Go again or cash out.';
        drawPills();
      }

      function cashOut(end) {
        if (!active || (busy && !end) || step === 0) return;
        const m = mult(diff, step);
        const win = round2(stake * m);
        Nova.wallet.credit(win);
        Nova.sfx.cash(Nova.sfx.level(m));
        shell.flash('win');
        Nova.fx.at(chicken, { count: 40, speed: 9, life: 1000 });
        if (m >= 10) Nova.fx.confetti();
        finish();
        shell.result({ win: true, big: fmtMult(m), small: '+' + fmt(win), anchor: roadWrap });
        status.textContent = `${end ? 'You crossed the whole road! ' : ''}Cashed out ${fmt(win)} at ${fmtMult(m)}.`;
        recent.add(`${DIFFS[diff].label} · L${step} · +${fmt(round2(win - stake))}`, 'win');
        drawPills();
      }

      const onKey = (e) => {
        if (e.code !== 'Space' || e.repeat || !active) return;
        const t = e.target;
        if (t && (t.tagName === 'INPUT' || t.tagName === 'BUTTON')) return;
        e.preventDefault();
        go();
      };
      document.addEventListener('keydown', onKey);
      shell.cleanup(() => document.removeEventListener('keydown', onKey));

      startBtn.addEventListener('click', begin);
      goBtn.addEventListener('click', go);
      cashBtn.addEventListener('click', () => cashOut(false));
      shell.cleanup(() => { active = false; });
      // lanes need layout before the chicken can be positioned
      requestAnimationFrame(() => { buildRoad(); drawPills(); });
      drawPills();
    },
  });
})();
