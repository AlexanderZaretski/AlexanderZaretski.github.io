# Portfolio — Visual & Animation Upgrade

What changed and why. **No copy, project content, or section order was changed.**
`index.html` is byte-for-byte identical to the original — every upgrade lives in
`assets/css/style.css` and `assets/js/main.js` / `assets/js/dashboards.js`, and the
hero chart / loading state are injected at runtime.

## 1. Motion system (foundation)
- Added CSS variables: one easing curve `--ease` and a timing scale (`--dur-fast`,
  `--dur`, `--dur-slow`). All new animations + the legacy `--tr` now use them, so
  timing is consistent everywhere.

## 2. Hero
- **Self-drawing line chart** background (canvas, injected by `main.js`): two faint
  "market" lines draw themselves left→right on load, then drift in a slow loop.
  Masked to fade out on the left so the headline stays fully readable. Low contrast.
- Headline/blocks keep their fade + upward-slide on load (now on the shared easing).
- **Tech-stack icons stagger in** one after another (each `.tool` has its own delay).
- Loop pauses when the hero scrolls off-screen (saves CPU); static single draw under
  reduced-motion.

## 3. Scroll reveals
- IntersectionObserver fade + slide for cards, skills, timeline, steps, education.
- **Children stagger** within each group (≈70ms apart).
- **Fires once** — each element is `unobserve`d after revealing, and the reveal
  classes are stripped afterward so hover transitions stay crisp.

## 4. Project cards
- **3D tilt toward the cursor** on hover (desktop / fine-pointer only), plus lift,
  soft violet **glow shadow**.
- **Touch devices** get a simple press (scale-down) instead of tilt.
- "Open interactive demo" button is **previewed on card hover** (border + fill +
  arrow nudge) so the affordance is obvious.

## 5. Count-up numbers
- All numeric KPIs count up from 0 when their modal opens.
- Formatting preserved: `$`, `%`, thousands commas, `M`/`K` suffix, leading `+`/`−`.
- Non-numeric labels (`9:12am`, `Crypto`, `FOMC`, `7:00am`…) are detected and left
  untouched. Verified against every KPI string on the site.

## 6. Nav + scroll polish
- Scroll-progress bar now updated via `requestAnimationFrame` (smoother, passive).
- **Active section highlighted** in the nav (IntersectionObserver) with the
  underline indicator.
- Nav **condenses** after the hero: shorter bar, stronger blur, subtle lift.
- Smooth-scroll anchors retained (disabled under reduced-motion).

## 7. Modals / demos
- Open/close is now a **fade + scale** (not a pop), in and out.
- **Loading shimmer** over each chart box until its chart is drawn.

## 8. Signature micro-detail
- **Underline-sweep on hover** for nav, contact, and footer links (consistent
  site-wide). Works on touch.

## Accessibility / performance
- `prefers-reduced-motion: reduce` disables non-essential motion: reveals show
  instantly, hero chart is static, icon stagger off, pulse/shimmer off, modal scale
  off (fade only), count-up jumps to final value.
- Transforms/opacity only (no layout-shifting properties).

## QA (headless Chrome, DevTools-protocol device emulation)
- **Mobile 390px:** horizontal overflow = **0px** (no horizontal scroll); hamburger
  works; content wraps; tilt disabled on touch (`pointer: fine` = false).
- **Desktop:** modals open, KPIs count to correct formatted values, both Chart.js
  charts + doughnut render, shimmer clears.
- **Reduced motion:** reveals off (cards visible immediately), hero static.
- **Zero console errors / uncaught exceptions** in every scenario tested.
