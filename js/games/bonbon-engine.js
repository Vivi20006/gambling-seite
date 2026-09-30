/* Bonbon Blast 2500 engine – pure game logic (no DOM), shared by the browser and the RTP simulator.
   6×5 pay-anywhere grid with tumbles. 4+ scatters start free spins with multiplier bombs
   (rainbow 2×–100×, gold 250×–2500×). Special bets change every paid spin; bonus buys start a
   free-spins round directly. Every option is tuned by simulation to roughly the same RTP. */
(function (root) {
  'use strict';

  const COLS = 6;
  const ROWS = 5;
  const MIN_MATCH = 8;
  const MAX_WIN = 25000; // × bet, per paid spin incl. its bonus
  const FREE_SPINS = 10;
  const RETRIGGER = 5;
  const SCATTER_PAY = { 4: 3, 5: 5, 6: 100 };

  // pays are × bet for 8–9 / 10–11 / 12+ symbols; w = weight per cell
  const SYMBOLS = [
    { id: 'heart', name: 'Heart candy', pay: [10, 25, 50], w: 2.2 },
    { id: 'square', name: 'Jelly square', pay: [2.5, 10, 25], w: 3.2 },
    { id: 'pentagon', name: 'Gum drop', pay: [2, 5, 15], w: 4.0 },
    { id: 'oval', name: 'Bean candy', pay: [1.5, 2, 12], w: 5.0 },
    { id: 'apple', name: 'Apple', pay: [1, 1.5, 10], w: 6.4 },
    { id: 'plum', name: 'Plum', pay: [0.8, 1.2, 8], w: 8.0 },
    { id: 'melon', name: 'Watermelon', pay: [0.5, 1, 5], w: 9.6 },
    { id: 'grapes', name: 'Grapes', pay: [0.4, 0.9, 4], w: 12.2 },
    { id: 'banana', name: 'Banana', pay: [0.25, 0.75, 2], w: 15.4 },
  ];
  const RAINBOW = [[2, 20], [3, 18], [4, 15], [5, 13], [6, 11], [8, 10], [10, 10], [12, 7], [15, 6], [20, 5], [25, 4], [50, 2], [100, 0.9]];
  const GOLD = [[250, 6], [500, 3], [1000, 1.2], [2500, 0.4]];

  /* Special bets – change every paid spin in the base game */
  const SPECIAL = {
    off: { name: 'Standard', cost: 1, scatter: 1.056 },
    ante: { name: 'Double Chance', cost: 1.25, scatter: 1.25 },
    bombs: { name: 'Bomb Rush', cost: 5, scatter: 1.046, orb: 0.3, minOrbs: 1, gold: 0 },
    gold: { name: 'Gold Rush', cost: 50, scatter: 1.046, orb: 0.3, minOrbs: 1, gold: 0.17 },
    scatters: { name: 'Lolly Hunt', cost: 44, scatter: 1.046, addScatters: 3 },
  };
  /* Bonus buys – the price starts a round with 4 guaranteed scatters */
  const BONUS = {
    fs: { name: 'Free Spins', price: 100, orb: 3.6, min: 2, gold: 0.0015 },
    super: { name: 'Super Free Spins', price: 500, orb: 5.2, min: 20, gold: 0.018 },
    mega: { name: 'Mega Free Spins', price: 2000, orb: 7.5, min: 50, gold: 0.205 },
  };
  const FREE_SCATTER = 0.75;

  const tables = new Map();
  function table(list) {
    let t = tables.get(list);
    if (!t) { t = { list, total: list.reduce((a, x) => a + x[1], 0) }; tables.set(list, t); }
    return t;
  }
  function pick(t, rng) {
    let r = rng() * t.total;
    for (const [v, w] of t.list) { if ((r -= w) < 0) return v; }
    return t.list[t.list.length - 1][0];
  }
  const cellTables = new Map();
  function cellTable(scatterW, orbW) {
    const key = scatterW + '|' + orbW;
    let t = cellTables.get(key);
    if (!t) {
      const list = SYMBOLS.map((s) => [s.id, s.w]).concat([['scatter', scatterW]]);
      if (orbW) list.push(['orb', orbW]);
      t = table(list);
      cellTables.set(key, t);
    }
    return t;
  }
  const rainbowByMin = new Map();
  function orbValue(rng, cfg) {
    if (rng() < (cfg.gold || 0)) return { m: pick(table(GOLD), rng), gold: true };
    let list = rainbowByMin.get(cfg.min || 2);
    if (!list) { list = RAINBOW.filter(([v]) => v >= (cfg.min || 2)); rainbowByMin.set(cfg.min || 2, list); }
    return { m: pick(table(list), rng), gold: false };
  }
  function cell(rng, cfg) {
    const s = pick(cellTable(cfg.scatter, cfg.orb || 0), rng);
    if (s !== 'orb') return { s };
    const o = orbValue(rng, cfg);
    return { s, m: o.m, gold: o.gold };
  }

  const tier = (n) => (n >= 12 ? 2 : n >= 10 ? 1 : 0);
  function evaluate(grid) {
    const counts = {};
    for (const col of grid) for (const x of col) counts[x.s] = (counts[x.s] || 0) + 1;
    const out = [];
    for (const s of SYMBOLS) if (counts[s.id] >= MIN_MATCH) out.push({ s: s.id, n: counts[s.id], pay: s.pay[tier(counts[s.id])] });
    return out;
  }
  const count = (grid, id) => grid.reduce((a, col) => a + col.filter((x) => x.s === id).length, 0);
  function place(grid, rng, n, make, avoid) {
    const spots = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) if (!avoid(grid[c][r])) spots.push([c, r]);
    for (let i = 0; i < n && spots.length; i++) {
      const k = Math.floor(rng() * spots.length);
      const [c, r] = spots.splice(k, 1)[0];
      grid[c][r] = make();
    }
  }

  /* One spin incl. all tumbles. Amounts are in multiples of the (base) bet.
     cfg: { free, scatter, orb, min, gold, forceScatters, addScatters, minOrbs } */
  function spin(rng, cfg) {
    const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => cell(rng, cfg)));
    if (cfg.forceScatters) {
      const have = count(grid, 'scatter');
      if (have < cfg.forceScatters) place(grid, rng, cfg.forceScatters - have, () => ({ s: 'scatter' }), (x) => x.s === 'scatter');
    }
    if (cfg.addScatters) place(grid, rng, cfg.addScatters, () => ({ s: 'scatter' }), (x) => x.s === 'scatter');
    if (cfg.minOrbs) {
      const have = count(grid, 'orb');
      if (have < cfg.minOrbs) place(grid, rng, cfg.minOrbs - have, () => { const o = orbValue(rng, cfg); return { s: 'orb', m: o.m, gold: o.gold }; }, (x) => x.s === 'scatter' || x.s === 'orb');
    }
    const initial = grid.map((col) => col.slice());
    const steps = [];
    let win = 0;
    for (;;) {
      const wins = evaluate(grid);
      if (!wins.length) break;
      const ids = new Set(wins.map((w) => w.s));
      const removed = [];
      grid.forEach((col, c) => col.forEach((x, r) => { if (ids.has(x.s)) removed.push([c, r]); }));
      const stepWin = wins.reduce((a, w) => a + w.pay, 0);
      win += stepWin;
      const refill = [];
      for (let c = 0; c < COLS; c++) {
        const keep = grid[c].filter((x) => !ids.has(x.s));
        const add = Array.from({ length: ROWS - keep.length }, () => cell(rng, cfg));
        grid[c] = add.concat(keep); // add[0] is the top row
        refill.push(add);
      }
      steps.push({ wins, removed, win: stepWin, refill });
    }
    const multSum = win > 0 ? grid.reduce((a, col) => a + col.reduce((b, x) => b + (x.m || 0), 0), 0) : 0;
    const scatters = count(grid, 'scatter');
    const scatterPay = SCATTER_PAY[Math.min(scatters, 6)] || 0;
    const total = win * (multSum || 1) + scatterPay;
    return { initial, steps, final: grid, win, multSum, scatters, scatterPay, total };
  }

  const baseCfg = (special) => ({ free: false, ...SPECIAL[special] });
  const freeCfg = (bonus) => ({ free: true, scatter: FREE_SCATTER, ...BONUS[bonus] });
  const triggers = (res, free) => (free ? res.scatters >= 3 : res.scatters >= 4);

  /* Plays the rest of a bonus instantly (leaving the page mid-bonus, and the simulator). */
  function playBonus(rng, bonus, spinsLeft, already = 0) {
    let total = already;
    while (spinsLeft > 0 && total < MAX_WIN) {
      spinsLeft--;
      const res = spin(rng, freeCfg(bonus));
      total += res.total;
      if (triggers(res, true)) spinsLeft += RETRIGGER;
    }
    return Math.min(total, MAX_WIN);
  }

  const engine = {
    COLS, ROWS, MIN_MATCH, MAX_WIN, FREE_SPINS, RETRIGGER, SCATTER_PAY, SYMBOLS, RAINBOW, GOLD, SPECIAL, BONUS,
    spin, baseCfg, freeCfg, triggers, playBonus,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  else root.Nova.bonbonEngine = engine;
})(typeof window !== 'undefined' ? window : globalThis);
