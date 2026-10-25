import { readFileSync } from 'node:fs';

export const VERDICTS = ['red', 'yellow', 'green'];

/**
 * Reads one or more sample files and checks every row has what the
 * scripts need. Format: [{ "id", "text", "lang", "expected", "source", "notes" }]
 */
export function loadSamples(paths) {
  const samples = [];
  for (const path of paths) {
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(rows)) throw new Error(`${path}: expected a JSON array of samples`);

    rows.forEach((row, index) => {
      if (typeof row.text !== 'string' || !VERDICTS.includes(row.expected)) {
        throw new Error(`${path} row ${index}: needs "text" and an "expected" of red, yellow or green`);
      }
      samples.push({ ...row, id: row.id ?? `${path}#${index}`, lang: row.lang ?? 'unknown' });
    });
  }
  return samples;
}

export function rate(part, whole) {
  return whole === 0 ? null : part / whole;
}

export function percent(value) {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}
