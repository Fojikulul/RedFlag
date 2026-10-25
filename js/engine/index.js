import { detectLanguage } from './language.js';
import { checkLinks } from './links.js';
import { normalize } from './normalize.js';
import { findMatches } from './patterns.js';
import { HOMOGLYPH_RULE, RULES } from './rules/index.js';
import { scoreFlags } from './scoring.js';

export { CATEGORIES } from './rules/index.js';
export { THRESHOLDS } from './scoring.js';

export const VERSION = '1.0.0';
export const MAX_LENGTH = 10000;

const LANGUAGES = ['en', 'uk', 'ru', 'es'];

const ADVICE_BY_CATEGORY = [
  ['payment', 'advice.do_not_pay'],
  ['credentials', 'advice.never_share_codes'],
  ['links', 'advice.do_not_click'],
  ['impersonation', 'advice.contact_directly'],
  ['family-emergency', 'advice.call_family'],
  ['secrecy', 'advice.talk_to_someone'],
  ['prize', 'advice.too_good'],
  ['investment-romance', 'advice.too_good'],
  ['job', 'advice.too_good'],
  ['urgency', 'advice.slow_down'],
];
const MAX_ADVICE = 4;

// Links whose only problem is plain http aren't worth an automatic warning.
const SERIOUS_LINK_ISSUES = new Set([
  'shortener', 'ip_address', 'punycode', 'risky_tld', 'lookalike_domain', 'at_sign', 'deep_subdomains',
]);

export function getSupportedLanguages() {
  return [...LANGUAGES];
}

/**
 * Checks a message for common scam tactics.
 *
 * Pure and synchronous: nothing leaves the device and the same input always
 * gives the same result.
 *
 * @param {string} text  The message as the person received it.
 * @param {{ lang?: 'auto' | 'en' | 'uk' | 'ru' | 'es' }} [options]
 *   `lang` overrides language detection for `detectedLanguage`. Rules for all
 *   four languages always run, because scams often mix them.
 * @returns {{
 *   verdict: 'red' | 'yellow' | 'green',
 *   score: number,
 *   detectedLanguage: string,
 *   flags: Array<{ ruleId: string, category: string, severity: string, weight: number,
 *                  match: string, start: number, end: number, explanationKey: string }>,
 *   highlights: Array<{ start: number, end: number, ruleIds: string[] }>,
 *   links: Array<{ url: string, domain: string, issues: string[] }>,
 *   summaryKey: string,
 *   adviceKeys: string[],
 * }}
 */
export function analyze(text, { lang = 'auto' } = {}) {
  const input = typeof text === 'string' ? text.slice(0, MAX_LENGTH) : '';
  const detectedLanguage = LANGUAGES.includes(lang) ? lang : detectLanguage(input);

  if (input.trim() === '') return emptyResult(detectedLanguage);

  const normalized = normalize(input);
  const linkCheck = checkLinks(input);

  const flags = [
    ...ruleFlags(input, normalized),
    ...homoglyphFlags(input, normalized),
    ...linkCheck.flags,
  ].sort((a, b) => a.start - b.start || b.end - a.end);

  const { score, verdict } = scoreFlags(flags, {
    suspiciousLinkOnly: isSuspiciousLinkOnly(input, linkCheck.links),
  });

  return {
    verdict,
    score,
    detectedLanguage,
    flags,
    highlights: mergeSpans(flags),
    links: linkCheck.links.map(({ url, domain, issues }) => ({ url, domain, issues })),
    summaryKey: `summary.${verdict}`,
    adviceKeys: adviceFor(verdict, flags),
  };
}

function emptyResult(detectedLanguage) {
  return {
    verdict: 'green',
    score: 0,
    detectedLanguage,
    flags: [],
    highlights: [],
    links: [],
    summaryKey: 'summary.empty',
    adviceKeys: [],
  };
}

function ruleFlags(input, normalized) {
  const flags = [];
  for (const rule of RULES) {
    for (const hit of findMatches(rule, normalized.text)) {
      flags.push(toFlag(rule, input, normalized, hit));
    }
  }
  return flags;
}

function homoglyphFlags(input, normalized) {
  return normalized.mixedScript.map((hit) => toFlag(HOMOGLYPH_RULE, input, normalized, hit));
}

function toFlag(rule, input, normalized, hit) {
  const start = normalized.starts[hit.start];
  const end = normalized.ends[hit.end - 1];
  return {
    ruleId: rule.id,
    category: rule.category,
    severity: rule.severity,
    weight: rule.weight,
    match: input.slice(start, end),
    start,
    end,
    explanationKey: `explain.${rule.id}`,
  };
}

function isSuspiciousLinkOnly(input, links) {
  if (!links.some((link) => link.issues.some((issue) => SERIOUS_LINK_ISSUES.has(issue)))) {
    return false;
  }
  let rest = input;
  for (const link of links) rest = rest.replace(link.url, ' ');
  const words = rest.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return words.length <= 3;
}

/**
 * Collapses overlapping flags into non-overlapping spans for highlighting.
 * Expects flags sorted by start.
 */
export function mergeSpans(flags) {
  const spans = [];
  for (const flag of flags) {
    const last = spans[spans.length - 1];
    if (last && flag.start < last.end) {
      last.end = Math.max(last.end, flag.end);
      if (!last.ruleIds.includes(flag.ruleId)) last.ruleIds.push(flag.ruleId);
    } else {
      spans.push({ start: flag.start, end: flag.end, ruleIds: [flag.ruleId] });
    }
  }
  return spans;
}

function adviceFor(verdict, flags) {
  if (verdict === 'green') return ['advice.stay_careful'];

  const categories = new Set(flags.map((flag) => flag.category));
  const keys = [];
  for (const [category, key] of ADVICE_BY_CATEGORY) {
    if (categories.has(category) && !keys.includes(key)) keys.push(key);
  }
  return [...keys.slice(0, MAX_ADVICE), 'advice.report'];
}
