// Motion is loaded as a classic script (assets/vendor/motion/motion.js) and
// exposes window.Motion. Every effect here is optional: if Motion didn't load
// or the visitor asked for reduced motion, the page just works without it.

const motion = window.Motion;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const largeScreen = window.matchMedia('(min-width: 768px)');

const enabled = Boolean(motion) && !reducedMotion;
const EASE = [0.22, 1, 0.36, 1];

// Scroll reveals, counters and the background glow are skipped on phones.
// Older phones are what a lot of our visitors use.
function richEffects() {
  return enabled && largeScreen.matches;
}

// Browsers pause animations in background tabs and on some power-saving
// phones. Anything that starts hidden must never get stuck that way, so each
// entrance is forced to its end state shortly after it should have finished.
function enter(targets, keyframes, options = {}) {
  const animation = motion.animate(targets, keyframes, options);
  const delay = typeof options.delay === 'number' ? options.delay : 0.6;
  setTimeout(() => animation.complete(), ((options.duration ?? 0.4) + delay + 0.5) * 1000);
  return animation;
}

export function popIn(element) {
  if (!enabled) return;
  enter(element, { opacity: [0, 1], scale: [0.96, 1], y: [-6, 0] }, { duration: 0.18, ease: EASE });
}

export function revealResult(result) {
  if (!enabled) return;
  const { animate, stagger } = motion;

  enter(result, { opacity: [0, 1], y: [16, 0] }, { duration: 0.35, ease: EASE });
  animate(result.querySelector('.verdict svg'), { scale: [0.6, 1], rotate: [-12, 0] }, { type: 'spring', bounce: 0.45, duration: 0.6 });

  const items = result.querySelectorAll('.flag-reason, .advice li');
  if (items.length > 0) {
    enter(items, { opacity: [0, 1], x: [-10, 0] }, { delay: stagger(0.06, { startDelay: 0.15 }), duration: 0.3, ease: EASE });
  }

  // Highlights sweep in left to right, like a marker pen.
  const marks = result.querySelectorAll('mark');
  if (marks.length > 0) {
    enter(marks, { backgroundSize: ['0% 100%', '100% 100%'] }, { delay: stagger(0.08, { startDelay: 0.2 }), duration: 0.45, ease: EASE });
  }
}

/** Smoothly opens and closes <details> elements instead of snapping. */
export function setUpAccordions(selector) {
  for (const details of document.querySelectorAll(selector)) {
    const summary = details.querySelector('summary');
    const body = summary.nextElementSibling;
    if (!body) continue;

    summary.addEventListener('click', (event) => {
      if (!enabled) return;
      event.preventDefault();

      if (details.open) {
        const animation = enter(body, { height: [`${body.offsetHeight}px`, '0px'], opacity: [1, 0] }, { duration: 0.25, ease: EASE });
        animation.then(() => {
          details.open = false;
          body.style.height = '';
          body.style.opacity = '';
        });
      } else {
        details.open = true;
        const height = body.scrollHeight;
        const animation = enter(body, { height: ['0px', `${height}px`], opacity: [0, 1] }, { duration: 0.3, ease: EASE });
        animation.then(() => {
          body.style.height = '';
        });
      }
    });
  }
}

/** Fades sections and their cards in as they scroll into view. */
export function setUpReveals() {
  if (!richEffects()) return;
  const { inView, stagger } = motion;

  for (const group of document.querySelectorAll('[data-reveal]')) {
    const items = group.querySelectorAll('[data-reveal-item]');
    const targets = items.length > 0 ? items : [group];
    for (const target of targets) target.style.opacity = '0';

    inView(group, () => {
      enter(targets, { opacity: [0, 1], y: [28, 0] }, { delay: stagger(0.09), duration: 0.6, ease: EASE });
    }, { amount: 0.2 });
  }
}

/** Counts numbers like "04" and "100%" up from zero when they appear. */
export function setUpCounters() {
  if (!richEffects()) return;
  const { inView } = motion;

  for (const node of document.querySelectorAll('[data-count]')) {
    const target = Number(node.dataset.count);
    const pad = node.dataset.countPad ? Number(node.dataset.countPad) : 0;
    const suffix = node.dataset.countSuffix ?? '';
    const format = (value) => `${String(Math.round(value)).padStart(pad, '0')}${suffix}`;

    node.textContent = format(0);
    inView(node, () => {
      enter(0, target, { duration: 1.4, ease: EASE, onUpdate: (value) => { node.textContent = format(value); } });
    }, { amount: 0.6 });
  }
}

/** The slow red glow drifting behind the hero, like the reference's gradient. */
export function setUpHeroGlow() {
  if (!richEffects()) return;
  const blobs = document.querySelectorAll('.hero-glow span');
  const paths = [
    { x: [0, 120, -60, 0], y: [0, -40, 30, 0], scale: [1, 1.15, 0.95, 1] },
    { x: [0, -140, 40, 0], y: [0, 30, -50, 0], scale: [1, 0.9, 1.1, 1] },
    { x: [0, 80, -100, 0], y: [0, 50, -20, 0], scale: [1, 1.1, 1, 1] },
  ];
  blobs.forEach((blob, index) => {
    motion.animate(blob, paths[index % paths.length], { duration: 22 + index * 6, repeat: Infinity, ease: 'easeInOut' });
  });
}

/** A small press-down on buttons, so taps feel acknowledged. */
export function setUpPress() {
  if (!enabled || !motion.press) return;
  motion.press('.btn, .lang-toggle', (element) => {
    motion.animate(element, { scale: 0.97 }, { duration: 0.1 });
    return () => motion.animate(element, { scale: 1 }, { type: 'spring', bounce: 0.4, duration: 0.35 });
  });
}

export function waveFlag(animateElement) {
  if (reducedMotion) return;
  animateElement.beginElement();
}
