const INVISIBLE = /[­​-‏⁠-⁤﻿]/;
const WHITESPACE = /\s/;
const LATIN = /\p{Script=Latin}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const LETTER = /\p{L}/u;

// One-to-one substitutions so rules don't have to spell out every variant.
const FOLD = { 'ё': 'е', '’': "'", '‘': "'", 'ʼ': "'", '`': "'" };

// Cyrillic letters that are drawn exactly like Latin ones. Scammers swap them
// in ("Аmazon", "Pаypal") to dodge simple keyword filters.
const CYRILLIC_TO_LATIN = {
  а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p',
  с: 'c', т: 't', у: 'y', х: 'x', і: 'i', ј: 'j', ѕ: 's', ԁ: 'd',
};
const LATIN_TO_CYRILLIC = {
  a: 'а', b: 'в', e: 'е', k: 'к', m: 'м', h: 'н', o: 'о', p: 'р',
  c: 'с', t: 'т', y: 'у', x: 'х', i: 'і',
};

/**
 * Prepares text for pattern matching and remembers where every character
 * came from, so matches can be highlighted in the original message.
 *
 * @param {string} input
 * @returns {{ text: string, starts: number[], ends: number[], mixedScript: Array<{start: number, end: number}> }}
 *   `starts[i]`/`ends[i]` give the original code-unit range behind character `i`
 *   of `text`. `mixedScript` lists words (in `text` positions) that combined
 *   Latin and Cyrillic letters before folding.
 */
export function normalize(input) {
  const chars = [];
  const starts = [];
  const ends = [];
  let pendingSpace = -1;

  let offset = 0;
  for (const raw of input) {
    const start = offset;
    offset += raw.length;

    if (INVISIBLE.test(raw)) continue;

    if (WHITESPACE.test(raw)) {
      if (chars.length > 0 && pendingSpace === -1) pendingSpace = start;
      continue;
    }

    if (pendingSpace !== -1) {
      chars.push(' ');
      starts.push(pendingSpace);
      ends.push(pendingSpace + 1);
      pendingSpace = -1;
    }

    // NFKC turns full-width and stylised letters (𝐏𝐚𝐲, ＰＡＹ) into plain ones.
    // It can expand one character into several, so each piece keeps the
    // original range.
    for (const piece of raw.normalize('NFKC').toLowerCase()) {
      const folded = FOLD[piece] ?? piece;
      chars.push(folded);
      // The maps are indexed by UTF-16 code unit, because that's what regex
      // match positions use. Emoji take two.
      for (let unit = 0; unit < folded.length; unit++) {
        starts.push(start);
        ends.push(offset);
      }
    }
  }

  const mixedScript = foldMixedScriptWords(chars);
  return { text: chars.join(''), starts, ends, mixedScript: toCodeUnits(chars, mixedScript) };
}

function toCodeUnits(chars, ranges) {
  if (ranges.length === 0) return ranges;
  const unitStart = [];
  let units = 0;
  for (const char of chars) {
    unitStart.push(units);
    units += char.length;
  }
  unitStart.push(units);
  return ranges.map(({ start, end }) => ({ start: unitStart[start], end: unitStart[end] }));
}

function foldMixedScriptWords(chars) {
  const found = [];
  let i = 0;

  while (i < chars.length) {
    if (!LETTER.test(chars[i])) {
      i++;
      continue;
    }

    const start = i;
    let latin = 0;
    let cyrillic = 0;
    while (i < chars.length && LETTER.test(chars[i])) {
      if (LATIN.test(chars[i])) latin++;
      else if (CYRILLIC.test(chars[i])) cyrillic++;
      i++;
    }

    if (latin > 0 && cyrillic > 0) {
      // Fold toward whichever script the word mostly uses.
      const table = latin >= cyrillic ? CYRILLIC_TO_LATIN : LATIN_TO_CYRILLIC;
      for (let j = start; j < i; j++) {
        if (table[chars[j]]) chars[j] = table[chars[j]];
      }
      found.push({ start, end: i });
    }
  }

  return found;
}
