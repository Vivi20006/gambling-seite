/* NOVA sound: every effect is synthesized with the Web Audio API – no audio files */
(function () {
  'use strict';

  const KEY = 'nova.sound.v1';
  const settings = { muted: false, volume: 0.6 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* ignore */ }

  let ctx = null;
  let master = null;
  let noiseBuf = null;
  const subs = new Set();

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.knee.value = 10;
    comp.ratio.value = 5;
    master = ctx.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  // browsers only allow audio after a user gesture
  const unlock = () => { if (init() && ctx.state === 'suspended') ctx.resume(); };
  ['pointerdown', 'keydown', 'touchend'].forEach((ev) => window.addEventListener(ev, unlock, { capture: true, passive: true }));

  function tone({ f = 440, to, type = 'sine', t = 0, dur = 0.12, gain = 0.2, a = 0.004, filter, q = 1 }) {
    const now = ctx.currentTime + t;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (to) o.frequency.exponentialRampToValueAtTime(to, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    let node = o;
    if (filter) {
      const fl = ctx.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = filter;
      fl.Q.value = q;
      o.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(master);
    o.start(now);
    o.stop(now + dur + 0.05);
  }

  function noise({ t = 0, dur = 0.2, gain = 0.3, type = 'lowpass', f = 1200, to, q = 0.8, a = 0.005 }) {
    const now = ctx.currentTime + t;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, now);
    fl.Q.value = q;
    if (to) fl.frequency.exponentialRampToValueAtTime(to, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + a);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(master);
    s.start(now, Math.random() * 0.5);
    s.stop(now + dur + 0.05);
  }

  const note = (n) => 440 * Math.pow(2, (n - 69) / 12); // midi → Hz
  const last = {};
  const throttle = (k, ms) => {
    const n = performance.now();
    if (last[k] && n - last[k] < ms) return false;
    last[k] = n;
    return true;
  };

  const S = {
    click() { tone({ f: 1500, to: 1000, dur: 0.045, gain: 0.06 }); },
    select() {
      tone({ f: 880, type: 'triangle', dur: 0.06, gain: 0.07 });
      tone({ f: 1320, type: 'triangle', t: 0.03, dur: 0.07, gain: 0.05 });
    },
    switchOn() { tone({ f: 660, to: 990, dur: 0.1, gain: 0.08 }); },
    error() {
      tone({ f: 170, type: 'square', dur: 0.1, gain: 0.04, filter: 900 });
      tone({ f: 150, type: 'square', t: 0.11, dur: 0.12, gain: 0.04, filter: 900 });
    },
    // chip clack when a bet is placed
    bet() {
      noise({ dur: 0.045, gain: 0.22, type: 'bandpass', f: 3500, q: 2.5 });
      tone({ f: 2400, to: 1700, type: 'triangle', dur: 0.06, gain: 0.06 });
      noise({ t: 0.055, dur: 0.04, gain: 0.14, type: 'bandpass', f: 2800, q: 2.5 });
      tone({ f: 2000, to: 1500, type: 'triangle', t: 0.055, dur: 0.05, gain: 0.04 });
    },
    tick(p = 1) {
      if (!throttle('tick', 20)) return;
      tone({ f: 1800 * p, type: 'square', dur: 0.022, gain: 0.028, filter: 4500 });
    },
    // bright chime, one semitone higher per step of a streak
    gem(step = 1) {
      const root = 72 + Math.min(Math.max(step - 1, 0), 14);
      [0, 7, 12].forEach((iv, i) => tone({ f: note(root + iv), t: i * 0.045, dur: 0.35, gain: 0.11 - i * 0.025 }));
      tone({ f: note(root + 24), type: 'triangle', t: 0.09, dur: 0.25, gain: 0.025 });
    },
    boom() {
      noise({ dur: 0.8, gain: 0.7, f: 2500, to: 60, q: 0.6, a: 0.003 });
      tone({ f: 150, to: 38, dur: 0.55, gain: 0.55 });
      noise({ t: 0.01, dur: 0.18, gain: 0.25, type: 'highpass', f: 3000 });
    },
    lose() {
      tone({ f: 392, to: 370, type: 'triangle', dur: 0.18, gain: 0.09 });
      tone({ f: 294, to: 262, type: 'triangle', t: 0.14, dur: 0.38, gain: 0.09 });
    },
    win(level = 1) {
      const seq = level >= 3 ? [60, 64, 67, 72, 76, 79, 84] : level === 2 ? [60, 64, 67, 72, 76] : [67, 72, 76];
      const step = level >= 3 ? 0.06 : 0.07;
      seq.forEach((n, i) => {
        tone({ f: note(n + 12), type: 'triangle', t: i * step, dur: 0.3, gain: 0.1 });
        tone({ f: note(n + 24), t: i * step, dur: 0.2, gain: 0.03 });
      });
      if (level >= 2) {
        const t = seq.length * step;
        [72, 76, 79].forEach((n) => tone({ f: note(n + 12), t, dur: level >= 3 ? 1.1 : 0.6, gain: 0.05, a: 0.02 }));
      }
      if (level >= 3) for (let i = 0; i < 10; i++) tone({ f: 3000 + Math.random() * 2500, t: 0.3 + i * 0.05, dur: 0.12, gain: 0.025 });
    },
    coins(n = 6) {
      for (let i = 0; i < n; i++) {
        const t = i * 0.045 + Math.random() * 0.02;
        const f = 2600 + Math.random() * 1400;
        tone({ f, t, dur: 0.18, gain: 0.05 });
        tone({ f: f * 1.5, t, dur: 0.1, gain: 0.025 });
      }
    },
    cash(level = 1) { S.coins(level >= 2 ? 10 : 6); S.win(level); },
    whoosh(dur = 0.6) { noise({ dur, gain: 0.18, type: 'bandpass', f: 300, to: 2600, q: 1.4, a: dur * 0.4 }); },
    // decelerating flutter of a spinning coin
    coinSpin(dur = 1.5) {
      let t = 0;
      let gap = 0.035;
      while (t < dur - 0.1) {
        tone({ f: 3200, t, dur: 0.03, gain: 0.022 });
        t += gap;
        gap *= 1.07;
      }
    },
    coinLand() {
      [2093, 3136, 4699].forEach((f, i) => tone({ f, dur: 0.7 - i * 0.2, gain: 0.08 - i * 0.02, a: 0.002 }));
      noise({ dur: 0.04, gain: 0.2, type: 'highpass', f: 4000 });
    },
    drop() { tone({ f: 600, to: 1200, dur: 0.08, gain: 0.06 }); },
    peg(row = 0) {
      if (!throttle('peg', 22)) return;
      tone({ f: 900 + row * 45 + Math.random() * 60, dur: 0.05, gain: 0.04 });
    },
    slot(mult = 1) {
      if (!throttle('slot', 30)) return;
      if (mult < 1) { tone({ f: 220, to: 160, type: 'triangle', dur: 0.14, gain: 0.08 }); return; }
      const n = 67 + Math.min(24, Math.round(Math.log2(mult) * 5));
      tone({ f: note(n), type: 'triangle', dur: 0.22, gain: 0.1 });
      tone({ f: note(n + 7), t: 0.05, dur: 0.2, gain: 0.05 });
    },
    hop() {
      tone({ f: 420, to: 820, dur: 0.13, gain: 0.09 });
      noise({ dur: 0.04, gain: 0.06, type: 'bandpass', f: 1800, q: 2 });
    },
    land() { tone({ f: 180, to: 90, dur: 0.1, gain: 0.12 }); },
    horn() { [415, 523].forEach((f) => tone({ f, type: 'sawtooth', dur: 0.28, gain: 0.035, filter: 1600, a: 0.01 })); },
    crash() {
      noise({ dur: 0.5, gain: 0.55, f: 1800, to: 80, a: 0.002 });
      noise({ t: 0.02, dur: 0.3, gain: 0.2, type: 'highpass', f: 5000 });
      tone({ f: 110, to: 45, dur: 0.35, gain: 0.4 });
    },
    spinTick() {
      if (!throttle('spin', 18)) return;
      tone({ f: 1400, type: 'triangle', dur: 0.03, gain: 0.05 });
      noise({ dur: 0.015, gain: 0.08, type: 'highpass', f: 3500 });
    },
  };

  const api = {
    get muted() { return settings.muted; },
    setMuted(m) {
      settings.muted = !!m;
      if (master) master.gain.value = settings.muted ? 0 : settings.volume;
      try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
      subs.forEach((fn) => fn());
      if (!settings.muted) api.switchOn();
    },
    toggle() { api.setMuted(!settings.muted); },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    // how big a celebration a multiplier deserves
    level: (m) => (m >= 10 ? 3 : m >= 2.5 ? 2 : 1),
  };
  Object.keys(S).forEach((k) => {
    api[k] = (...args) => {
      if (settings.muted || !init()) return;
      if (ctx.state === 'suspended') ctx.resume();
      try { S[k](...args); } catch (e) { /* never let audio break a game */ }
    };
  });

  window.Nova.sfx = api;
})();
