// Phone number lookup: reports people made to the FTC, from our own copy in
// D1, plus a web search through Gemini. The number is used for the one
// lookup and is never logged or stored.

import { InputError, LANGUAGES } from './check.js';

// How far back FTC reports count. Numbers get reused, so older reports say
// little about who has the number today.
export const REPORT_DAYS = 365;

// The FTC's fixed list of call subjects, matched loosely in case the
// wording changes a little.
const SUBJECTS = [
  ['imposters', /pretending to be|imposter/i],
  ['debt', /debt|credit card|mortgage|student loan/i],
  ['medical', /medical|prescription|health/i],
  ['energy', /energy|solar|utilit/i],
  ['warranties', /warrant|protection plan/i],
  ['travel', /vacation|timeshare|travel/i],
  ['tech', /computer|technical support|tech support/i],
  ['home', /home improvement|cleaning|home security/i],
  ['prize', /lotter|prize|sweepstake/i],
  ['dropped', /dropped call|no message/i],
];

export const SUBJECT_SLUGS = SUBJECTS.map(([slug]) => slug);

export function subjectSlug(subject) {
  for (const [slug, pattern] of SUBJECTS) if (pattern.test(subject ?? '')) return slug;
  return null;
}

/**
 * Turns what the visitor typed into digits. US and Canadian numbers become
 * ten digits; anything else needs a leading + and its country code.
 */
export function parsePhone(input) {
  const raw = typeof input === 'string' ? input.trim() : '';
  if (raw === '') throw new InputError('The number is empty.');
  if (raw.length > 40 || /[^\d\s()+.\-]/.test(raw)) throw new InputError('That is not a phone number.');

  let digits = raw.replace(/\D/g, '');
  if (!raw.startsWith('+') || digits.startsWith('1')) {
    if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
    if (digits.length === 10 && /^[2-9]\d{2}[2-9]/.test(digits)) {
      return { digits, us: true, display: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` };
    }
    if (!raw.startsWith('+')) throw new InputError('That is not a phone number.');
  }
  if (digits.length < 8 || digits.length > 15) throw new InputError('That is not a phone number.');
  return { digits, us: false, display: `+${digits}` };
}

export function parseLookupInput(body) {
  if (!body || typeof body !== 'object') throw new InputError('Expected a JSON object.');
  const phone = parsePhone(body.number);
  const lang = LANGUAGES.includes(body.lang) ? body.lang : 'en';
  return { ...phone, lang };
}

/**
 * Sums up the FTC rows for one number: how many, how recent, about what.
 * The FTC sometimes lists one complaint twice, so rows filed at the same
 * second count once.
 */
export function summarizeReports(rows) {
  if (rows.length === 0) return { count: 0, lastReported: null, subjects: [], robocall: false };

  const tally = new Map();
  const seen = new Set();
  let robocalls = 0;
  let last = '';
  for (const row of rows) {
    if (seen.has(row.created)) continue;
    seen.add(row.created);
    if (row.created > last) last = row.created;
    if (row.robocall) robocalls++;
    const slug = subjectSlug(row.subject);
    if (slug) tally.set(slug, (tally.get(slug) ?? 0) + 1);
  }

  return {
    count: seen.size,
    lastReported: last.slice(0, 10),
    subjects: [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([slug]) => slug),
    robocall: robocalls > 0,
  };
}

export async function findReports(db, digits, now = new Date()) {
  const since = new Date(now.getTime() - REPORT_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { results } = await db
    .prepare('SELECT created, subject, robocall FROM reports WHERE number = ? AND created >= ? ORDER BY created DESC LIMIT 1000')
    .bind(digits, since)
    .all();
  return summarizeReports(results);
}

const LEVELS = { unknown: 0, yellow: 1, red: 2 };

/**
 * The overall answer is the more worried of the two sources. There is no
 * "safe": finding nothing only means nobody has reported the number yet.
 */
export function phoneVerdict(ftc, web) {
  let ftcLevel = 'unknown';
  if (ftc?.count >= 3) ftcLevel = 'red';
  else if (ftc?.count >= 1) ftcLevel = 'yellow';

  const webLevel = web?.verdict in LEVELS ? web.verdict : 'unknown';
  return LEVELS[webLevel] > LEVELS[ftcLevel] ? webLevel : ftcLevel;
}

/**
 * Runs one lookup. `searchWeb` is the Gemini call, passed in so tests can use
 * a fake. Either source can fail without failing the whole lookup.
 */
export async function lookupPhone(body, { db, searchWeb, now } = {}) {
  const input = parseLookupInput(body);

  const [ftcResult, webResult] = await Promise.allSettled([
    input.us && db ? findReports(db, input.digits, now) : Promise.resolve(null),
    searchWeb ? searchWeb(input) : Promise.resolve(null),
  ]);

  const ftc = ftcResult.status === 'fulfilled' ? ftcResult.value : null;
  const web = webResult.status === 'fulfilled' ? webResult.value : null;
  if (ftcResult.status === 'rejected') console.error('report lookup failed:', ftcResult.reason?.name);
  if (webResult.status === 'rejected') console.error('web search failed:', webResult.reason?.status ?? webResult.reason?.name);

  return {
    display: input.display,
    us: input.us,
    verdict: phoneVerdict(ftc, web),
    ftc: input.us ? (ftc ? { status: 'done', ...ftc } : { status: 'unavailable' }) : { status: 'not_us' },
    web: web ? { status: 'done', ...web } : { status: 'unavailable' },
  };
}
