const NEGATION = /(?:^|[^\p{L}])(?:don't|do not|never|not|не|ніколи|никогда|nunca|no)[^\p{L}]*$/u;
const NEGATION_WINDOW = 24;
const MAX_HITS_PER_RULE = 20;

/**
 * Rule patterns are regular expressions with three shorthands, because the
 * same phrase has to survive inflection in four languages:
 *
 *   word~   any ending: "заблокирован~" matches заблокирована, заблокированы…
 *   a _ b   up to three words between a and b
 *   a b     a space, a hyphen or nothing: "gift card", "gift-card", "giftcard"
 *
 * Every pattern only matches whole words. `\b` doesn't understand Cyrillic,
 * and lookbehind breaks older iPhones, so the leading boundary is a captured
 * group instead.
 */
export function compile(pattern) {
  const source = pattern
    .split(' _ ')
    .map((part) => part.replace(/~/g, '\\p{L}*').replace(/ /g, '[ \\-]?'))
    .join(" (?:[\\p{L}\\p{N}',]+ ){0,3}");
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${source})(?![\\p{L}\\p{N}])`, 'gu');
}

export function compileRule(rule) {
  const patterns = Object.values(rule.patterns).flat().map(compile);
  return { ...rule, patterns };
}

/**
 * Finds every occurrence of a compiled rule in normalized text.
 * Returns ranges in normalized-text positions.
 */
export function findMatches(rule, text) {
  const hits = [];
  const seen = new Set();

  for (const regex of rule.patterns) {
    regex.lastIndex = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const start = match.index + match[1].length;
      const end = start + match[2].length;

      if (end === start) {
        regex.lastIndex++;
        continue;
      }
      if (rule.skipIfNegated && isNegated(text, start)) continue;

      // Patterns from different languages can land on the same words.
      const key = `${start}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);

      hits.push({ start, end });
      if (hits.length >= MAX_HITS_PER_RULE) return hits;
    }
  }

  return hits;
}

// "Never share this code" is advice, not a request for the code.
function isNegated(text, start) {
  const before = text.slice(Math.max(0, start - NEGATION_WINDOW), start);
  return NEGATION.test(before);
}
