const BARE_TLDS = [
  'com', 'net', 'org', 'info', 'biz', 'io', 'co', 'us', 'uk', 'ca', 'ru', 'ua',
  'su', 'by', 'kz', 'es', 'mx', 'ar', 'top', 'xyz', 'click', 'zip', 'link',
  'live', 'shop', 'online', 'site', 'icu', 'cyou', 'buzz', 'rest', 'support',
  'app', 'me', 'tk', 'ml', 'ga', 'cf', 'gq', 'pw', 'cc', 'ws', 'gov', 'edu',
  'ly', 'gl', 'gd', 'at', 'id', 'gy', 'in', 'de', 'fr', 'it', 'pl',
];

const URL_PATTERN = new RegExp(
  [
    'https?:\\/\\/[^\\s<>"\'`]+',
    'www\\.[^\\s<>"\'`]+',
    `(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+(?:${BARE_TLDS.join('|')})(?![a-z0-9-])(?:[/?#][^\\s<>"'\`]*)?`,
  ].join('|'),
  'gi',
);

const TRAILING_PUNCTUATION = /[.,;:!?)\]}»"'’]+$/;

const SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'ow.ly', 'buff.ly',
  'cutt.ly', 'rebrand.ly', 'tiny.cc', 'shorturl.at', 'rb.gy', 't.ly', 's.id',
  'v.gd', 'bl.ink', 'clck.ru', 'qps.ru',
]);

const RISKY_TLDS = new Set([
  'top', 'xyz', 'click', 'zip', 'mov', 'link', 'live', 'shop', 'online',
  'site', 'icu', 'cyou', 'buzz', 'rest', 'support', 'tk', 'ml', 'ga', 'cf',
  'gq', 'pw', 'cam', 'sbs', 'cfd', 'loan', 'win', 'bid', 'vip',
]);

// Two-part public suffixes, so "privatbank.com.ua" resolves to the right owner.
const SECOND_LEVEL_SUFFIXES = new Set([
  'co.uk', 'com.ua', 'org.ua', 'gov.ua', 'kiev.ua', 'com.mx', 'com.ar',
  'com.au', 'com.br', 'gob.mx', 'com.es',
]);

const BRANDS = {
  paypal: ['paypal.com'],
  amazon: ['amazon.com', 'amazon.ca', 'amazon.co.uk', 'amazon.com.mx', 'amazon.es'],
  apple: ['apple.com', 'icloud.com'],
  icloud: ['icloud.com', 'apple.com'],
  microsoft: ['microsoft.com', 'live.com', 'office.com'],
  netflix: ['netflix.com'],
  google: ['google.com', 'googleusercontent.com', 'googleapis.com'],
  facebook: ['facebook.com', 'fb.com'],
  instagram: ['instagram.com'],
  whatsapp: ['whatsapp.com'],
  coinbase: ['coinbase.com'],
  chase: ['chase.com'],
  wellsfargo: ['wellsfargo.com'],
  bankofamerica: ['bankofamerica.com'],
  citibank: ['citi.com', 'citibank.com'],
  usps: ['usps.com'],
  fedex: ['fedex.com'],
  ups: ['ups.com'],
  dhl: ['dhl.com'],
  irs: ['irs.gov'],
  ssa: ['ssa.gov'],
  medicare: ['medicare.gov'],
  uscis: ['uscis.gov'],
  zelle: ['zellepay.com'],
  venmo: ['venmo.com'],
  privatbank: ['privatbank.ua'],
  privat24: ['privat24.ua'],
  monobank: ['monobank.ua'],
  novaposhta: ['novaposhta.ua', 'novapost.com'],
  ukrposhta: ['ukrposhta.ua'],
  sberbank: ['sberbank.ru', 'sber.ru'],
  gosuslugi: ['gosuslugi.ru'],
  diia: ['diia.gov.ua'],
};

// Digits and symbols people swap in to make a fake domain look right.
const LOOKALIKE_CHARACTERS = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', $: 's', '@': 'a' };

export const LINK_RULES = {
  shortener: { id: 'links.shortener', severity: 'medium', weight: 15 },
  ip_address: { id: 'links.ip_address', severity: 'high', weight: 30 },
  no_https: { id: 'links.no_https', severity: 'low', weight: 10 },
  punycode: { id: 'links.punycode', severity: 'high', weight: 30 },
  risky_tld: { id: 'links.risky_tld', severity: 'medium', weight: 20 },
  lookalike_domain: { id: 'links.lookalike_domain', severity: 'high', weight: 35 },
  at_sign: { id: 'links.at_sign', severity: 'high', weight: 30 },
  deep_subdomains: { id: 'links.deep_subdomains', severity: 'medium', weight: 15 },
};

/**
 * Finds links in the original text and checks each one.
 *
 * @param {string} text
 * @returns {{ links: Array<{url: string, domain: string, issues: string[], start: number, end: number}>, flags: object[] }}
 */
export function checkLinks(text) {
  const links = [];
  const flags = [];

  URL_PATTERN.lastIndex = 0;
  let match;
  while ((match = URL_PATTERN.exec(text)) !== null) {
    const start = match.index;
    const raw = match[0].replace(TRAILING_PUNCTUATION, '');

    // "anna@gmail.com" is an email address, not a link.
    if (text[start - 1] === '@') continue;

    const end = start + raw.length;
    const { domain, issues } = inspectUrl(raw);
    if (!domain) continue;

    links.push({ url: raw, domain, issues, start, end });
    for (const issue of issues) {
      const rule = LINK_RULES[issue];
      flags.push({
        ruleId: rule.id,
        category: 'links',
        severity: rule.severity,
        weight: rule.weight,
        match: raw,
        start,
        end,
        explanationKey: `explain.${rule.id}`,
      });
    }
  }

  return { links, flags };
}

export function inspectUrl(raw) {
  const issues = [];
  const lower = raw.toLowerCase();

  if (lower.startsWith('http://')) issues.push('no_https');

  const withoutScheme = lower.replace(/^https?:\/\//, '');
  let authority = withoutScheme.split(/[/?#]/)[0];

  // http://paypal.com@evil.example sends you to evil.example.
  if (authority.includes('@')) {
    issues.push('at_sign');
    authority = authority.slice(authority.lastIndexOf('@') + 1);
  }

  const host = authority.replace(/:\d+$/, '').replace(/\.$/, '');
  if (!host) return { domain: '', issues: [] };

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    issues.push('ip_address');
    return { domain: host, issues };
  }

  const labels = host.split('.');
  const domain = registrableDomain(labels);
  const tld = labels[labels.length - 1];

  if (SHORTENERS.has(host) || SHORTENERS.has(domain)) issues.push('shortener');
  if (labels.some((label) => label.startsWith('xn--'))) issues.push('punycode');
  if (RISKY_TLDS.has(tld)) issues.push('risky_tld');
  if (isLookalike(host, domain)) issues.push('lookalike_domain');
  if (labels.length >= 5) issues.push('deep_subdomains');

  return { domain, issues };
}

function registrableDomain(labels) {
  const lastTwo = labels.slice(-2).join('.');
  const keep = SECOND_LEVEL_SUFFIXES.has(lastTwo) ? 3 : 2;
  return labels.slice(-keep).join('.');
}

const OFFICIAL_DOMAINS = new Set(Object.values(BRANDS).flat());

function isLookalike(host, domain) {
  if (OFFICIAL_DOMAINS.has(domain)) return false;

  const tokens = host.split(/[.-]/).map(unmask);

  // Short names like "ups" or "irs" hide inside ordinary words ("groups"),
  // so they only count as a whole token.
  return Object.keys(BRANDS).some((brand) =>
    tokens.some((token) => token === brand || (brand.length >= 5 && token.includes(brand))));
}

function unmask(token) {
  return token.replace(/[013457$@]/g, (char) => LOOKALIKE_CHARACTERS[char]);
}
