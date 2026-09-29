/* Chicken – cross the road lane by lane, every safe step raises the multiplier */
(function () {
  const { h, fmt, fmtMult, round2 } = Nova;
  const LANES = 10;
  const EDGE = 0.96;
  const DIFFS = {
    easy: { label: 'Easy', safe: 0.85 },
    medium: { label: 'Medium', safe: 0.7 },
    hard: { label: 'Hard', safe: 0.55 },
    extreme: { label: 'Extreme', safe: 0.45 },
  };
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
      let step = 0; // lanes crossed
      let stake = 0;
      let busy = false;

      const lanePill = Nova.ui.pill('');
      const diffPill = Nova.ui.pill('');
      const multPill = h('span', { class: 'pill mono' }, '1.00×');
      const road = h('div', { class: 'road' });
      const chicken = h('div', { class: 'chicken', html: '<span class="chicken-emoji">🐔</span>' });
      const roadWrap = h('div', { class: 'road-scroll' }, road);
      const status = h('p', { class: 'stage-status' }, 'Pick a difficulty and bet, then start crossing.');
      const recent = Nova.ui.recent('Recent runs', 'No runs yet.', 12);
      let lanes = [];
      let start;

      shell.stage.append(
        h('div', { class: 'stage-top' }, h('div', { class: 'pill-row' }, lanePill, diffPill), multPill),
        roadWrap, status, recent.root);

      const bet = Nova.ui.betControl(shell);
      const seg = Nova.ui.segmented({
        options: Object.entries(DIFFS).map(([k, d]) => ({ value: k, label: d.label, sub: `${Math.round(d.safe * 100)}% safe` })),
        value: 'easy',
        onChange(v) { diff = v; buildRoad(); drawPills(); },
      });
      const startBtn = h('button', { class: 'btn-primary', type: 'button' });
      const goBtn = h('button', { class: 'btn-primary', type: 'button', hidden: true }, 'Go →');
      const cashBtn = h('button', { class: 'btn-primary cash', type: 'button', hidden: true });
      const next = h('p', { class: 'muted small center', hidden: true });
      shell.controls.append(
        h('h3', { class: 'panel-title' }, 'New run'),
        bet.root,
        h('div', { class: 'field' }, h('label', { class: 'field-label' }, 'Difficulty'), seg.root),
        startBtn, goBtn, cashBtn, next,
        h('p', { class: 'hint' }, 'Every safe lane raises your multiplier. Harder roads mean busier traffic and bigger rewards. Cash out anytime after your first step.'));

      const sync = Nova.ui.bindStart(shell, startBtn, bet, 'Start run', () => active);

      function buildRoad() {
        road.innerHTML = '';
        lanes = [];
        start = h('div', { class: 'lane start' }, h('span', { class: 'lane-mult muted' }, 'START'));
        road.append(start);
        for (let i = 0; i < LANES; i++) {
          const el = h('div', { class: 'lane', 'data-i': i },
            h('span', { class: 'lane-mult mono' }, fmtMult(mult(diff, i + 1))),
            h('div', { class: 'manhole' }));
          el.addEventListener('click', () => { if (active && i === step) go(); });
          lanes.push(el);
          road.append(el);
        }
        road.append(chicken);
        chicken.className = 'chicken';
        chicken.querySelector('.chicken-emoji').textContent = '🐔';
        placeChicken(true);
      }

      function placeChicken(instant) {
        const target = step === 0 ? start : lanes[step - 1];
        const x = target.offsetLeft + target.offsetWidth / 2 - 24;
        chicken.style.transition = instant ? 'none' : '';
        chicken.style.left = x + 'px';
        if (!instant) roadWrap.scrollTo({ left: Math.max(0, x - roadWrap.clientWidth / 2 + 24), behavior: 'smooth' });
        else roadWrap.scrollLeft = 0;
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

      function begin() {
        if (active || Nova.ui.betBlock(bet)) return;
        stake = bet.get();
        if (!Nova.wallet.debit(stake)) return;
        active = true;
        step = 0;
        buildRoad();
        bet.lock(true);
        seg.lock(true);
        startBtn.hidden = true;
        goBtn.hidden = false;
        cashBtn.hidden = false;
        next.hidden = false;
        status.textContent = 'Press Go (or tap the next lane) to cross.';
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
        step++;
        placeChicken(false);
        chicken.classList.add('hop');
        await Nova.sleep(420);
        chicken.classList.remove('hop');
        if (!safe) {
          const car = h('div', { class: 'car', html: '🚗' });
          lane.append(car);
          await Nova.sleep(260);
          chicken.classList.add('dead');
          chicken.querySelector('.chicken-emoji').textContent = '💥';
          lane.classList.add('crash');
          await Nova.sleep(500);
          car.remove();
          status.textContent = `A car got you on lane ${step}. You lost ${fmt(stake)}.`;
          recent.add(`${DIFFS[diff].label} · L${step} · −${fmt(stake)}`, 'lose');
          Nova.ui.toast(`Run over! −${fmt(stake)} tokens`, 'lose');
          const done = step;
          finish();
          step = done;
          drawPills();
          return;
        }
        lane.classList.add('done');
        busy = false;
        if (step === LANES) { cashOut(true); return; }
        lanes[step].classList.add('next');
        status.textContent = 'Made it! Go again or cash out.';
        drawPills();
      }

      function cashOut(end) {
        if (!active || busy && !end || step === 0) return;
        const m = mult(diff, step);
        const win = round2(stake * m);
        Nova.wallet.credit(win);
        status.textContent = `${end ? 'You crossed the whole road! ' : ''}Cashed out ${fmt(win)} at ${fmtMult(m)}.`;
        recent.add(`${DIFFS[diff].label} · L${step} · +${fmt(round2(win - stake))}`, 'win');
        Nova.ui.toast(`+${fmt(win)} tokens (${fmtMult(m)})`, 'win');
        finish();
        drawPills();
      }

      startBtn.addEventListener('click', begin);
      goBtn.addEventListener('click', go);
      cashBtn.addEventListener('click', () => cashOut(false));
      buildRoad();
      drawPills();
      shell.cleanup(() => { active = false; });
    },
  });
})();
