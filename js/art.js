// Line drawings for the "How it works" steps and the radar behind the hero.
// Built in code so the markup stays readable. Parts that animate are tagged
// with data-part; effects.js decides how each one moves.

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 200;
const CENTER = SIZE / 2;

function svg(children, size = SIZE) {
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', `0 0 ${size} ${size}`);
  root.append(...children);
  return root;
}

function shape(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== '') node.setAttribute(name, value);
  }
  return node;
}

// A message bubble whose lines fill in, one of them suspicious.
function paste() {
  const parts = [
    shape('rect', { x: 34, y: 38, width: 132, height: 104, rx: 18, class: 'art-strong' }),
    shape('path', { d: 'M62 142 L54 166 L86 142', class: 'art-strong' }),
  ];
  [96, 72, 110, 58, 88].forEach((width, row) => {
    parts.push(shape('line', {
      x1: 54, x2: 54 + width, y1: 62 + row * 16, y2: 62 + row * 16,
      class: row === 2 ? 'art-accent' : '', pathLength: 1, 'data-part': 'draw',
    }));
  });
  return svg(parts);
}

// Rings opening out from the middle, a beam, and a blip where it finds something.
function scan() {
  const parts = [];
  for (let ring = 1; ring <= 6; ring++) {
    parts.push(shape('circle', { cx: CENTER, cy: CENTER, r: ring * 13, class: 'art-dotted', 'data-part': 'ring' }));
  }
  const sweep = shape('g', { 'data-part': 'sweep' });
  sweep.append(shape('line', { x1: CENTER, y1: CENTER, x2: CENTER, y2: CENTER - 80, class: 'art-accent' }));
  parts.push(sweep);
  parts.push(shape('circle', { cx: CENTER + 34, cy: CENTER - 40, r: 6, class: 'art-dot', 'data-part': 'blip' }));
  return svg(parts);
}

// A ring closing, then rays bursting out of it.
function verdict() {
  const parts = [shape('circle', { cx: CENTER, cy: CENTER, r: 78, class: 'art-strong', pathLength: 1, 'data-part': 'draw' })];
  const rays = shape('g', { 'data-part': 'burst' });
  const count = 36;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const inner = 18 + ((i * 7) % 5) * 6;
    const outer = 46 + ((i * 11) % 7) * 4;
    rays.append(shape('line', {
      x1: CENTER + Math.cos(angle) * inner,
      y1: CENTER + Math.sin(angle) * inner,
      x2: CENTER + Math.cos(angle) * outer,
      y2: CENTER + Math.sin(angle) * outer,
      class: i % 6 === 0 ? 'art-accent' : '',
    }));
  }
  parts.push(rays);
  return svg(parts);
}

// A short numbered list writing itself: the plain explanation.
function explain() {
  const parts = [shape('rect', { x: 30, y: 34, width: 140, height: 132, rx: 18, class: 'art-strong' })];
  [0, 1, 2].forEach((row) => {
    const y = 66 + row * 34;
    parts.push(shape('circle', { cx: 56, cy: y, r: 9, class: row === 0 ? 'art-accent' : 'art-strong', 'data-part': 'pop' }));
    parts.push(shape('line', {
      x1: 76, x2: row === 1 ? 128 : 146, y1: y, y2: y,
      class: row === 0 ? 'art-accent' : '', pathLength: 1, 'data-part': 'draw',
    }));
  });
  return svg(parts);
}

// The large radar behind the checker. Rings and cross hairs; the sweep is
// drawn in CSS so it always turns around the exact center.
function radar() {
  const size = 820;
  const middle = size / 2;
  const parts = [];
  for (let ring = 1; ring <= 7; ring++) {
    parts.push(shape('circle', { cx: middle, cy: middle, r: ring * 56, class: ring % 2 ? 'art-dotted' : '' }));
  }
  parts.push(shape('line', { x1: middle, y1: 20, x2: middle, y2: size - 20 }));
  parts.push(shape('line', { x1: 20, y1: middle, x2: size - 20, y2: middle }));
  return svg(parts, size);
}

const DRAWINGS = { paste, scan, verdict, explain, radar };

export function drawArt() {
  for (const slot of document.querySelectorAll('[data-art]')) {
    const draw = DRAWINGS[slot.dataset.art];
    if (draw) slot.replaceChildren(draw());
  }
}
