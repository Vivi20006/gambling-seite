/* Candy Burst engine – pure game logic (no DOM), shared by the browser and the RTP simulator.
   6×5 "pay anywhere" grid: 8+ matching symbols anywhere pay, winners pop and the grid tumbles.
   4+ scatters start free spins, where multiplier orbs can land and multiply each tumble sequence. */
(function (root) {
  'use strict';

  const COLS = 6;
  const ROWS = 5;
  const MIN_MATCH = 8;
  const MAX_WIN = 5000; // × bet, per bonus round or base spin
  const FREE_SPINS = 10;
  const RETRIGGER = 5;
  const SCATTER_PAY = { 4: 3, 5: 5, 6: 100 }; // × bet

  // pays are × bet for 8–9 / 10–11 / 12+ symbols; w = weight per cell
  const SYMBOLS = [
    { id: 'heart', emoji: '💖', pay: [10, 25, 50], w: 2.2 },
    { id: 'candy', emoji: '🍬', pay: [2.5, 10, 25], w: 3.2 },
    { id: 'cupcake', emoji: '🧁', pay: [2, 5, 15], w: 4.0 },
    { id: 'donut', emoji: '🍩', pay: [1.5, 2, 12], w: 5.0 },
    { id: 'apple', emoji: '🍎', pay: [1, 1.5, 10], w: 6.4 },
    { id: 'peach', emoji: '🍑', pay: [0.8, 1.2, 8], w: 8.0 },
    { id: 'melon', emoji: '🍉', pay: [0.5, 1, 5], w: 9.6 },
    { id: 'grapes', emoji: '🍇', pay: [0.4, 0.9, 4], w: 12.2 },
    { id: 'banana', emoji: '🍌', pay: [0.25, 0.75, 2], w: 15.4 },
  ];
  const SCATTER = { id: 'scatter', emoji: '🍭', w: 1.0, wFree: 0.75 };
  const ORB = { id: 'orb', wFree: 6.8 };
  const MULTS = [[2, 20], [3, 18], [4, 15], [5, 13], [6, 11], [8, 10], [10, 10], [12, 7], [15, 6], [20, 5], [25, 4], [50, 2], [100, 0.9]];

  const BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));
  const TABLE_BASE = SYMBOLS.map((s) => [s.id, s.w]).concat([[SCATTER.id, SCATTER.w]]);
  const TABLE_FREE = SYMBOLS.map((s) => [s.id, s.w]).concat([[SCATTER.id, SCATTER.wFree], [ORB.id, ORB.wFree]]);
  const sum = (t) => t.reduce((a, x) => a + x[1], 0);
  const TOTAL_BASE = sum(TABLE_BASE);
  const TOTAL_FREE = sum(TABLE_FREE);
  const TOTAL_MULTS = sum(MULTS);

  function pick(table, total, rng) {
    let r = rng() * total;
    for (const [v, w] of table) { if ((r -= w) < 0) return v; }
    return table[table.length - 1][0];
  }

  function cell(rng, free) {
    const s = free ? pick(TABLE_FREE, TOTAL_FREE, rng) : pick(TABLE_BASE, TOTAL_BASE, rng);
    return s === 'orb' ? { s, m: pick(MULTS, TOTAL_MULTS, rng) } : { s };
  }

  const tier = (n) => (n >= 12 ? 2 : n >= 10 ? 1 : 0);

  function evaluate(grid) {
    const counts = {};
    grid.forEach((col) => col.forEach((x) => { counts[x.s] = (counts[x.s] || 0) + 1; }));
    return SYMBOLS.filter((s) => counts[s.id] >= MIN_MATCH).map((s) => ({ s: s.id, n: counts[s.id], pay: s.pay[tier(counts[s.id])] }));
  }

  const count = (grid, id) => grid.reduce((a, col) => a + col.filter((x) => x.s === id).length, 0);

  /* One spin incl. all tumbles. Every amount is in multiples of the bet.
     opts.scatters: force exactly that many scatters onto the first grid (bonus buy). */
  function spin(rng, free, opts = {}) {
    const grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, () => cell(rng, free)));
    if (opts.scatters) {
      grid.forEach((col) => col.forEach((x, r) => { if (x.s === 'scatter') col[r] = { s: 'banana' }; }));
      const spots = new Set();
      while (spots.size < opts.scatters) spots.add(Math.floor(rng() * COLS * ROWS));
      spots.forEach((p) => { grid[Math.floor(p / ROWS)][p % ROWS] = { s: 'scatter' }; });
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
        const add = Array.from({ length: ROWS - keep.length }, () => cell(rng, free));
        grid[c] = add.concat(keep); // add[0] is the top row
        refill.push(add);
      }
      steps.push({ wins, removed, win: stepWin, refill });
    }
    const multSum = free && win > 0 ? grid.reduce((a, col) => a + col.reduce((b, x) => b + (x.m || 0), 0), 0) : 0;
    const scatters = count(grid, 'scatter');
    const scatterPay = SCATTER_PAY[Math.min(scatters, 6)] || 0;
    const total = win * (multSum || 1) + scatterPay;
    return { initial, steps, final: grid, win, multSum, scatters, scatterPay, total };
  }

  const triggers = (res, free) => (free ? res.scatters >= 3 : res.scatters >= 4);

  /* Plays a whole bonus round instantly (used when leaving the page mid-bonus, and by the simulator). */
  function playBonus(rng, spinsLeft, already = 0) {
    let total = already;
    while (spinsLeft > 0 && total < MAX_WIN) {
      spinsLeft--;
      const res = spin(rng, true);
      total += res.total;
      if (triggers(res, true)) spinsLeft += RETRIGGER;
    }
    return Math.min(total, MAX_WIN);
  }

  const engine = { COLS, ROWS, MIN_MATCH, MAX_WIN, FREE_SPINS, RETRIGGER, SCATTER_PAY, SYMBOLS, SCATTER, ORB, BY_ID, spin, triggers, playBonus, BUY_PRICE: 115 };
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  else root.Nova.slotEngine = engine;
})(typeof window !== 'undefined' ? window : globalThis);
