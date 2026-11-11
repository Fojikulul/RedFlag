// Merges the rules verdict with the AI double-check.
//
// When the AI is more worried than the rules, it wins: it can read wording
// the rules don't know. When it is less worried, the warning only drops one
// step, so a strong rules warning never turns into "no red flags" on the
// AI's word alone.

const ORDER = ['green', 'yellow', 'red'];

/**
 * @param {'red' | 'yellow' | 'green'} rules
 * @param {'red' | 'yellow' | 'green' | undefined} ai
 * @returns {{ verdict: 'red' | 'yellow' | 'green', change: 'none' | 'agree' | 'raised' | 'lowered' }}
 */
export function combineVerdicts(rules, ai) {
  const r = ORDER.indexOf(rules);
  const a = ORDER.indexOf(ai);
  if (a === -1) return { verdict: rules, change: 'none' };
  if (a === r) return { verdict: rules, change: 'agree' };
  if (a > r) return { verdict: ai, change: 'raised' };
  return { verdict: ORDER[r - 1], change: 'lowered' };
}
