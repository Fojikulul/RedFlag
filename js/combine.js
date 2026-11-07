import { adviceForCategories } from './engine/index.js';

/**
 * Puts the rules result and the AI's opinion together. The AI leads: it reads
 * the whole message and knows tricks the rules don't. The rules still keep it
 * honest, because a scam can tell the AI it is harmless but can't talk the
 * rules out of what they see. So when the rules are sure it's a scam, the
 * answer is never green.
 *
 * Without an opinion (AI off, offline, or out of free checks for the day)
 * the rules answer alone.
 */
export function combine(rules, opinion) {
  if (!opinion) {
    return { verdict: rules.verdict, aiScore: null, ruleScore: rules.score, adviceKeys: rules.adviceKeys };
  }

  let { verdict } = opinion;
  if (rules.verdict === 'red' && verdict === 'green') verdict = 'yellow';

  const categories = new Set([...rules.flags.map((flag) => flag.category), ...opinion.tactics]);
  return {
    verdict,
    aiScore: opinion.score,
    ruleScore: rules.score,
    adviceKeys: adviceForCategories(verdict, categories),
  };
}
