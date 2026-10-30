// Motion is loaded as a classic script (assets/vendor/motion/motion.js) and
// exposes window.Motion. Every effect here is optional: if Motion didn't load
// or the visitor asked for reduced motion, the page just works without it.

const motion = window.Motion;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const largeScreen = window.matchMedia('(min-width: 768px)');

const enabled = Boolean(motion) && !reducedMotion;
const EASE = [0.22, 1, 0.36, 1];

// Scroll reveals, counters and the radar sweep are skipped on phones. Older
// phones are what a lot of our visitors use.
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

/**
 * A beam passes once over the message box, so pressing "Check it" visibly
 * does something. Resolves when the result can be shown.
 */
export function scan(field) {
  if (!enabled) return Promise.resolve();
  const beam = document.createElement('div');
  beam.className = 'scan-beam';
  field.append(beam);

  const animation = enter(beam, { x: ['-100%', '400%'], opacity: [1, 1, 0] }, { duration: 0.55, ease: 'easeInOut' });
  return animation.then(() => beam.remove(), () => beam.remove());
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
        enter(body, { height: [`${body.offsetHeight}px`, '0px'], opacity: [1, 0] }, { duration: 0.25, ease: EASE }).then(() => {
          details.open = false;
          body.style.height = '';
          body.style.opacity = '';
        });
      } else {
        details.open = true;
        const height = body.scrollHeight;
        enter(body, { height: ['0px', `${height}px`], opacity: [0, 1] }, { duration: 0.3, ease: EASE }).then(() => {
          body.style.height = '';
        });
      }
    });
  }
}

/** Fades groups of cards in as they scroll into view. Headings never hide. */
export function setUpReveals() {
  if (!richEffects()) return;
  const { inView, stagger } = motion;

  for (const group of document.querySelectorAll('[data-reveal]')) {
    const items = group.querySelectorAll('[data-reveal-item]');
    const targets = items.length > 0 ? items : [group];
    for (const target of targets) target.style.opacity = '0';

    inView(group, () => {
      enter(targets, { opacity: [0, 1], y: [24, 0] }, { delay: stagger(0.08), duration: 0.55, ease: EASE });
    }, { amount: 0.2 });
  }
}

/** Counts numbers like "4" and "100%" up from zero when they appear. */
export function setUpCounters() {
  if (!richEffects()) return;
  const { inView } = motion;

  for (const node of document.querySelectorAll('[data-count]')) {
    const target = Number(node.dataset.count);
    const suffix = node.dataset.countSuffix ?? '';
    const format = (value) => `${Math.round(value)}${suffix}`;

    node.textContent = format(0);
    inView(node, () => {
      enter(0, target, { duration: 1.4, ease: EASE, onUpdate: (value) => { node.textContent = format(value); } });
    }, { amount: 0.6 });
  }
}

/** The radar beam behind the checker turns slowly, once a minute. */
export function setUpRadar() {
  if (!richEffects()) return;
  const sweep = document.querySelector('.hero-radar .radar-sweep');
  if (sweep) motion.animate(sweep, { rotate: [0, 360] }, { duration: 60, repeat: Infinity, ease: 'linear' });
}

/**
 * The footer wordmark wipes in from the left when it comes into view, then
 * the pennant unfurls from the pole.
 */
export function setUpWordmark(wordmark) {
  if (!richEffects()) return;
  const flag = wordmark.querySelector('.wordmark-flag');
  wordmark.style.clipPath = 'inset(0 100% 0 0)';

  motion.inView(wordmark, () => {
    enter(wordmark, { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 1.1, ease: EASE });
    if (flag) {
      enter(flag, { scaleX: [0, 1] }, { delay: 0.9, duration: 0.5, ease: EASE });
      flag.style.transformOrigin = '0 50%';
    }
  }, { amount: 0.5 });
}

/** A small press-down on buttons, so taps feel acknowledged. */
export function setUpPress() {
  if (!enabled || !motion.press) return;
  motion.press('.btn, .lang-toggle, .text-size, .paste-button', (element) => {
    motion.animate(element, { scale: 0.97 }, { duration: 0.1 });
    return () => motion.animate(element, { scale: 1 }, { type: 'spring', bounce: 0.4, duration: 0.35 });
  });
}

export function waveFlag(animateElement) {
  if (reducedMotion) return;
  animateElement.beginElement();
}
