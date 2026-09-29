/* NOVA cursor: a glowing violet dot that glides after the mouse (mouse / trackpad only) */
(function () {
  'use strict';
  if (!window.matchMedia || !matchMedia('(pointer: fine)').matches) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dot = document.createElement('div');
  const glow = document.createElement('div');
  dot.className = 'cursor-dot';
  glow.className = 'cursor-glow';
  dot.setAttribute('aria-hidden', 'true');
  glow.setAttribute('aria-hidden', 'true');
  document.body.append(glow, dot);
  document.documentElement.classList.add('has-cursor');

  const HOVER = 'a, button, [role="slider"], [role="radio"], .lane.next, .dice-track, label';
  const mouse = { x: innerWidth / 2, y: innerHeight / 2 };
  const d = { x: mouse.x, y: mouse.y }; // dot: quick follow
  const g = { x: mouse.x, y: mouse.y }; // glow: lazier follow
  let raf = 0;
  let seen = false;

  // `translate` (not `transform`) so the CSS `scale` on hover does not scale the position too
  const place = (el, p) => { el.style.translate = `${p.x}px ${p.y}px`; };

  function frame() {
    const kd = reduced ? 1 : 0.32;
    const kg = reduced ? 1 : 0.12;
    d.x += (mouse.x - d.x) * kd;
    d.y += (mouse.y - d.y) * kd;
    g.x += (mouse.x - g.x) * kg;
    g.y += (mouse.y - g.y) * kg;
    place(dot, d);
    place(glow, g);
    const settled = Math.abs(mouse.x - g.x) < 0.1 && Math.abs(mouse.y - g.y) < 0.1;
    raf = settled ? 0 : requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    if (!seen) {
      // first move: appear right under the pointer instead of flying in from the centre
      seen = true;
      d.x = g.x = mouse.x;
      d.y = g.y = mouse.y;
    }
    document.documentElement.classList.add('cursor-visible');
    kick();
  }, { passive: true });

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest(HOVER);
    const blocked = !!(el && el.disabled);
    document.documentElement.classList.toggle('cursor-hover', !!el && !blocked);
    document.documentElement.classList.toggle('cursor-blocked', blocked);
  });
  document.addEventListener('mouseleave', () => document.documentElement.classList.remove('cursor-visible'));
  window.addEventListener('blur', () => document.documentElement.classList.remove('cursor-visible'));
  window.addEventListener('pointerdown', () => document.documentElement.classList.add('cursor-down'));
  window.addEventListener('pointerup', () => document.documentElement.classList.remove('cursor-down'));
})();
