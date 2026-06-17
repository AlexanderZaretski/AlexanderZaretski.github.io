// ════════════════════════════════════════════════════════════════════════════
//  Portfolio interactions — nav, scroll polish, reveals, hero chart, card tilt
//  Motion respects prefers-reduced-motion. Scroll triggers use IntersectionObserver.
// ════════════════════════════════════════════════════════════════════════════
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer  = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// ── Nav scrolled / condensed + scroll-progress bar (rAF-throttled) ──────────────
const nav      = document.getElementById('nav');
const progress = document.getElementById('progress');
let scrollTicking = false;

function onScroll() {
  if (scrollTicking) return;
  scrollTicking = true;
  requestAnimationFrame(() => {
    const y   = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    nav.classList.toggle('scrolled', y > 20);
    nav.classList.toggle('condensed', y > window.innerHeight * 0.6); // past the hero
    progress.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    scrollTicking = false;
  });
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// ── Mobile burger menu ──────────────────────────────────────────────────────────
const burger   = document.getElementById('burger');
const navLinks = document.querySelector('.nav-links');
burger.addEventListener('click', () => navLinks.classList.toggle('open'));
navLinks.querySelectorAll('a').forEach(link =>
  link.addEventListener('click', () => navLinks.classList.remove('open'))
);

// ── Scroll reveals: stagger children, animate once ──────────────────────────────
// Assign a per-item delay based on its position within its group.
[
  ['.projects-grid', '.card'],
  ['.skills-grid',   '.skill-group'],
  ['.timeline',      '.timeline-item'],
  ['.thinking-steps','.thinking-step']
].forEach(([containerSel, childSel]) => {
  document.querySelectorAll(containerSel).forEach(container => {
    container.querySelectorAll(':scope > ' + childSel).forEach((el, i) => {
      el.style.setProperty('--reveal-delay', Math.min(i, 6) * 70 + 'ms');
    });
  });
});

const revealEls = document.querySelectorAll(
  '.card, .skill-group, .timeline-item, .thinking-step, .edu-card'
);

if (reduceMotion) {
  // Nothing to animate; elements stay in their natural (visible) state.
} else {
  revealEls.forEach(el => el.classList.add('fade-up'));

  // Once an element has revealed, strip the reveal classes so its own
  // hover/press transitions (fast) take over instead of the slow reveal one.
  function cleanup(el) {
    el.classList.remove('fade-up', 'visible');
    el.style.removeProperty('--reveal-delay');
  }

  const revealObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('visible');
      obs.unobserve(el);                  // animate only once; don't re-trigger
      let done = false;
      const finish = () => { if (done) return; done = true; cleanup(el); };
      el.addEventListener('transitionend', ev => {
        if (ev.propertyName === 'opacity') finish();
      });
      setTimeout(finish, 1500);           // fallback if transitionend doesn't fire
    });
  }, { threshold: 0.12 });

  revealEls.forEach(el => revealObserver.observe(el));
}

// ── Active section highlight in nav ─────────────────────────────────────────────
const navLinkFor = new Map();
document.querySelectorAll('.nav-links a[href^="#"]').forEach(a =>
  navLinkFor.set(a.getAttribute('href').slice(1), a)
);
const activeObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    const link = navLinkFor.get(e.target.id);
    if (!link) return;
    navLinkFor.forEach(a => a.classList.remove('active'));
    link.classList.add('active');
  });
}, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
navLinkFor.forEach((_, id) => {
  const section = document.getElementById(id);
  if (section) activeObserver.observe(section);
});

// ── Hero: self-drawing line chart that loops subtly ─────────────────────────────
(function heroChart() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = hero.clientWidth;
    H = hero.clientHeight;
    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width  = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // Two faint "market" lines built from layered sines for an organic shape.
  const lines = [
    { rgb: '107,92,214', base: 0.62, amp: 0.075, freq: 1.5, drift: 0.00022, phase: 0   },
    { rgb: '77,227,240',  base: 0.74, amp: 0.055, freq: 2.2, drift: 0.00015, phase: 2.1 }
  ];
  const N = 70;            // points per line
  const DRAW_MS = 2600;    // self-draw duration
  let startT = null;
  let running = true;

  function yNorm(line, i, t) {
    const x = i / (N - 1);
    const w = Math.sin(x * Math.PI * line.freq + t * line.drift + line.phase) +
              0.5 * Math.sin(x * Math.PI * line.freq * 2.3 + t * line.drift * 1.6 + line.phase * 1.7);
    return line.base + line.amp * w;
  }

  function frame(now) {
    if (startT === null) startT = now;
    const prog = reduceMotion ? 1 : Math.min((now - startT) / DRAW_MS, 1);
    ctx.clearRect(0, 0, W, H);

    lines.forEach(line => {
      const maxI = Math.max(1, Math.floor((N - 1) * prog));

      // area fill under the line
      ctx.beginPath();
      for (let i = 0; i <= maxI; i++) {
        const x = (i / (N - 1)) * W;
        const y = yNorm(line, i, now) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      const lastX = (maxI / (N - 1)) * W;
      ctx.lineTo(lastX, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, `rgba(${line.rgb},0.10)`);
      grad.addColorStop(1, `rgba(${line.rgb},0)`);
      ctx.fillStyle = grad;
      ctx.fill();

      // the line itself
      ctx.beginPath();
      for (let i = 0; i <= maxI; i++) {
        const x = (i / (N - 1)) * W;
        const y = yNorm(line, i, now) * H;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(${line.rgb},0.22)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // leading dot while it draws itself
      if (prog < 1) {
        ctx.beginPath();
        ctx.arc(lastX, yNorm(line, maxI, now) * H, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${line.rgb},0.85)`;
        ctx.fill();
      }
    });

    if (reduceMotion) return;        // static: drawn once, no loop
    if (running) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Pause the loop when the hero is scrolled out of view (saves CPU)
  if (!reduceMotion) {
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running) { running = true; requestAnimationFrame(frame); }
      else if (!e.isIntersecting) { running = false; }
    }).observe(hero);
  }
})();

// ── Project cards: 3D tilt toward cursor (desktop only) ─────────────────────────
if (finePointer && !reduceMotion) {
  const MAX_TILT = 6; // degrees
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      // follow the cursor quickly; lift/return still uses the system easing
      card.style.transition =
        'transform .12s var(--ease), border-color var(--tr), background var(--tr), box-shadow var(--dur) var(--ease)';
    });
    card.addEventListener('mousemove', e => {
      const r  = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width  - 0.5;
      const py = (e.clientY - r.top)  / r.height - 0.5;
      card.style.transform =
        `perspective(900px) rotateX(${(-py * MAX_TILT).toFixed(2)}deg) ` +
        `rotateY(${(px * MAX_TILT).toFixed(2)}deg) translateY(-6px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transition = '';   // revert to CSS transition for a smooth ease-back
      card.style.transform  = '';
    });
  });
}
