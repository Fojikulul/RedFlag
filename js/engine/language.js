const CYRILLIC = /\p{Script=Cyrillic}/gu;
const LATIN = /\p{Script=Latin}/gu;
const UKRAINIAN_LETTERS = /[іїєґ]/iu;
const RUSSIAN_LETTERS = /[ыэъё]/iu;
const SPANISH_LETTERS = /[ñ¿¡]/iu;

const WORD_LISTS = {
  uk: ['що', 'це', 'ви', 'та', 'як', 'для', 'ваш', 'вам', 'мені', 'тому', 'буде'],
  ru: ['что', 'это', 'вы', 'и', 'как', 'для', 'ваш', 'вам', 'мне', 'будет', 'если'],
  en: ['the', 'you', 'your', 'and', 'to', 'is', 'are', 'please', 'this', 'with'],
  es: ['el', 'la', 'que', 'de', 'usted', 'su', 'para', 'por', 'los', 'es', 'con'],
};

function count(text, pattern) {
  return (text.match(pattern) || []).length;
}

function countWords(words, list) {
  return words.filter((word) => list.includes(word)).length;
}

/**
 * Best guess at the language a message is written in.
 * Returns 'en' | 'uk' | 'ru' | 'es' | 'unknown'.
 */
export function detectLanguage(text) {
  const cyrillic = count(text, CYRILLIC);
  const latin = count(text, LATIN);
  if (cyrillic === 0 && latin === 0) return 'unknown';

  const words = text.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);

  if (cyrillic >= latin) {
    if (UKRAINIAN_LETTERS.test(text)) return 'uk';
    if (RUSSIAN_LETTERS.test(text)) return 'ru';
    return countWords(words, WORD_LISTS.uk) > countWords(words, WORD_LISTS.ru) ? 'uk' : 'ru';
  }

  if (SPANISH_LETTERS.test(text)) return 'es';
  return countWords(words, WORD_LISTS.es) > countWords(words, WORD_LISTS.en) ? 'es' : 'en';
}
