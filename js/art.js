// Line drawings for the "How it works" cards, in the spirit of the reference
// site's approach section. Built in code so the markup stays readable.

const SVG_NS = 'http://www.w3.org/2000/svg';
const SIZE = 200;
const CENTER = SIZE / 2;

function svg(children) {
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  root.append(...children);
  return root;
}

function shape(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  return node;
}

// A message bubble filling up with lines of text.
function paste() {
  const parts = [shape('rect', { x: 34, y: 38, width: 132, height: 104, rx: 18, class: 'art-strong' })];
  parts.push(shape('path', { d: 'M62 142 L54 166 L86 142', class: 'art-strong' }));
  [96, 72, 110, 58, 88].forEach((width, row) => {
    parts.push(shape('line', { x1: 54, x2: 54 + width, y1: 62 + row * 16, y2: 62 + row * 16, class: row === 2 ? 'art-accent' : '' }));
  });
  return svg(parts);
}

// Dotted rings with a sweep line, like a radar.
function scan() {
  const parts = [];
  for (let ring = 1; ring <= 6; ring++) {
    parts.push(shape('circle', { cx: CENTER, cy: CENTER, r: ring * 13, class: 'art-dotted' }));
  }
  const sweep = shape('g', { class: 'art-sweep' });
  sweep.append(shape('line', { x1: CENTER, y1: CENTER, x2: CENTER, y2: CENTER - 80, class: 'art-accent' }));
  sweep.append(shape('circle', { cx: CENTER + 28, cy: CENTER - 44, r: 4, class: 'art-dot' }));
  parts.push(sweep);
  return svg(parts);
}

// Rays bursting out of a ring, the moment the verdict lands.
function verdict() {
  const parts = [shape('circle', { cx: CENTER, cy: CENTER, r: 78, class: 'art-strong' })];
  const rays = 36;
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2;
    const inner = 18 + ((i * 7) % 5) * 6;
    const outer = 46 + ((i * 11) % 7) * 4;
    parts.push(shape('line', {
      x1: CENTER + Math.cos(angle) * inner,
      y1: CENTER + Math.sin(angle) * inner,
      x2: CENTER + Math.cos(angle) * outer,
      y2: CENTER + Math.sin(angle) * outer,
      class: i % 6 === 0 ? 'art-accent' : '',
    }));
  }
  return svg(parts);
}

// Rings turning slowly, one idea unfolding into the next.
function explain() {
  const parts = [];
  for (let i = 0; i < 14; i++) {
    parts.push(shape('ellipse', {
      cx: CENTER,
      cy: CENTER,
      rx: 82 - i * 3,
      ry: 48 + i * 1.5,
      transform: `rotate(${i * 13} ${CENTER} ${CENTER})`,
      class: i === 6 ? 'art-accent' : '',
    }));
  }
  return svg(parts);
}

// The large radar behind the checker. Rings, cross hairs and one beam.
function radar() {
  const size = 820;
  const middle = size / 2;
  const root = document.createElementNS(SVG_NS, 'svg');
  root.setAttribute('viewBox', `0 0 ${size} ${size}`);

  for (let ring = 1; ring <= 7; ring++) {
    root.append(shape('circle', { cx: middle, cy: middle, r: ring * 56, class: ring % 2 ? 'art-dotted' : '' }));
  }
  root.append(shape('line', { x1: middle, y1: 20, x2: middle, y2: size - 20 }));
  root.append(shape('line', { x1: 20, y1: middle, x2: size - 20, y2: middle }));

  const sweep = shape('g', { class: 'radar-sweep' });
  sweep.append(shape('line', { x1: middle, y1: middle, x2: middle, y2: middle - 392, class: 'radar-beam' }));
  root.append(sweep);
  return root;
}

const DRAWINGS = { paste, scan, verdict, explain, radar };

export function drawArt() {
  for (const slot of document.querySelectorAll('[data-art]')) {
    const draw = DRAWINGS[slot.dataset.art];
    if (draw) slot.replaceChildren(draw());
  }
}
