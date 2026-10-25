import en from './en.js';
import es from './es.js';
import ru from './ru.js';
import uk from './uk.js';

export const STRINGS = { en, uk, ru, es };

export const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'uk', label: 'УКР', name: 'Українська' },
  { code: 'ru', label: 'РУС', name: 'Русский' },
  { code: 'es', label: 'ESP', name: 'Español' },
];

export const DEFAULT_LANGUAGE = 'en';

/**
 * Looks up a UI string, falling back to English so a missing translation
 * never shows up as a raw key. `{name}` placeholders are filled from `vars`.
 */
export function t(key, lang, vars = {}) {
  const template = STRINGS[lang]?.[key] ?? STRINGS[DEFAULT_LANGUAGE][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

/** Picks the first supported language from a list like `navigator.languages`. */
export function pickLanguage(preferred = []) {
  for (const tag of preferred) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (code in STRINGS) return code;
  }
  return DEFAULT_LANGUAGE;
}
