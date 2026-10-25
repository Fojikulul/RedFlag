export const THRESHOLDS = Object.freeze({ red: 60, yellow: 25 });

// Scams stack tactics. Pressure plus a payment request is far more telling
// than either one on its own.
const BOOSTS = [
  { categories: ['urgency', 'payment'], bonus: 15 },
  { categories: ['impersonation', 'credentials'], bonus: 15 },
  { categories: ['family-emergency', 'secrecy'], bonus: 15 },
  { categories: ['family-emergency', 'payment'], bonus: 10 },
  { categories: ['investment-romance', 'payment'], bonus: 15 },
  { categories: ['prize', 'payment'], bonus: 15 },
  { categories: ['job', 'payment'], bonus: 15 },
  { categories: ['links', 'credentials'], bonus: 10 },
  { categories: ['links', 'urgency'], bonus: 10 },
];

const MAX_SCORE = 100;

/**
 * @param {Array<{ruleId: string, category: string, weight: number}>} flags
 * @param {{ suspiciousLinkOnly?: boolean }} [options]
 * @returns {{ score: number, verdict: 'red' | 'yellow' | 'green' }}
 */
export function scoreFlags(flags, { suspiciousLinkOnly = false } = {}) {
  const weights = new Map();
  for (const flag of flags) weights.set(flag.ruleId, flag.weight);

  let total = 0;
  for (const weight of weights.values()) total += weight;

  const categories = new Set(flags.map((flag) => flag.category));
  for (const boost of BOOSTS) {
    if (boost.categories.every((category) => categories.has(category))) total += boost.bonus;
  }

  // A bare suspicious link gives the rules almost nothing to read, so never
  // call it safe.
  if (suspiciousLinkOnly) total = Math.max(total, THRESHOLDS.yellow);

  const score = Math.min(MAX_SCORE, Math.round(total));
  return { score, verdict: verdictFor(score) };
}

export function verdictFor(score) {
  if (score >= THRESHOLDS.red) return 'red';
  if (score >= THRESHOLDS.yellow) return 'yellow';
  return 'green';
}
