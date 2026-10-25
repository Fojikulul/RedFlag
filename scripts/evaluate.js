#!/usr/bin/env node
// Scores the rules engine against labeled samples. Runs offline.
//
//   node scripts/evaluate.js tests/fixtures/scams.json tests/fixtures/safe.json
//   node scripts/evaluate.js my-samples.json --json
//
// Sample format: [{ "id", "text", "lang", "expected": "red|yellow|green", "source", "notes" }]

import { readFileSync } from 'node:fs';

import { analyze } from '../js/engine/index.js';

const VERDICTS = ['red', 'yellow', 'green'];

function loadSamples(paths) {
  const samples = [];
  for (const path of paths) {
    const rows = JSON.parse(readFileSync(path, 'utf8'));
    rows.forEach((row, index) => {
      if (typeof row.text !== 'string' || !VERDICTS.includes(row.expected)) {
        throw new Error(`${path} row ${index}: needs "text" and an "expected" of red, yellow or green`);
      }
      samples.push({ id: row.id ?? `${path}#${index}`, lang: row.lang ?? 'unknown', ...row });
    });
  }
  return samples;
}

function evaluate(samples) {
  return samples.map((sample) => {
    const result = analyze(sample.text);
    return {
      ...sample,
      actual: result.verdict,
      score: result.score,
      rules: [...new Set(result.flags.map((flag) => flag.ruleId))],
      categories: [...new Set(result.flags.map((flag) => flag.category))],
    };
  });
}

// A scam marked yellow still warns the person, so it counts as caught.
// A safe message marked yellow is a false alarm.
function summarize(rows) {
  const scams = rows.filter((row) => row.expected !== 'green');
  const safe = rows.filter((row) => row.expected === 'green');
  const exact = rows.filter((row) => row.actual === row.expected).length;
  const caught = scams.filter((row) => row.actual !== 'green').length;
  const falseAlarms = safe.filter((row) => row.actual !== 'green').length;

  return {
    total: rows.length,
    exact,
    exactRate: rate(exact, rows.length),
    scams: scams.length,
    caught,
    catchRate: rate(caught, scams.length),
    falseNegativeRate: rate(scams.length - caught, scams.length),
    safe: safe.length,
    falseAlarms,
    falsePositiveRate: rate(falseAlarms, safe.length),
  };
}

function rate(part, whole) {
  return whole === 0 ? null : part / whole;
}

function percent(value) {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

function groupBy(rows, keyOf) {
  const groups = new Map();
  for (const row of rows) {
    for (const key of [keyOf(row)].flat()) {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    }
  }
  return [...groups.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
}

function printReport(rows) {
  const overall = summarize(rows);
  const line = (label, value) => console.log(`  ${label.padEnd(22)}${value}`);

  console.log(`\nRedFlag evaluation: ${overall.total} samples\n`);
  line('Exact verdict', `${overall.exact}/${overall.total} (${percent(overall.exactRate)})`);
  line('Scams caught', `${overall.caught}/${overall.scams} (${percent(overall.catchRate)})`);
  line('False negatives', percent(overall.falseNegativeRate));
  line('False alarms', `${overall.falseAlarms}/${overall.safe} (${percent(overall.falsePositiveRate)})`);

  console.log('\nBy language');
  for (const [lang, group] of groupBy(rows, (row) => row.lang)) {
    const s = summarize(group);
    line(lang, `exact ${percent(s.exactRate)}  caught ${percent(s.catchRate)}  false alarms ${percent(s.falsePositiveRate)}  (n=${s.total})`);
  }

  console.log('\nBy category (samples where it fired)');
  const flagged = rows.filter((row) => row.categories.length > 0);
  for (const [category, group] of groupBy(flagged, (row) => row.categories)) {
    const correct = group.filter((row) => row.actual === row.expected).length;
    line(category, `${group.length} samples, ${correct} exact`);
  }

  const misses = rows.filter((row) => row.actual !== row.expected);
  console.log(`\nMisses (${misses.length})`);
  for (const miss of misses) {
    console.log(`\n  ${miss.id} [${miss.lang}] expected ${miss.expected}, got ${miss.actual} (score ${miss.score})`);
    console.log(`  ${miss.text}`);
    console.log(`  rules: ${miss.rules.join(', ') || 'none'}`);
  }
  console.log('');
}

function main(argv) {
  const json = argv.includes('--json');
  const paths = argv.filter((arg) => !arg.startsWith('--'));
  if (paths.length === 0) {
    console.error('Usage: node scripts/evaluate.js <samples.json> [more.json] [--json]');
    process.exit(1);
  }

  const rows = evaluate(loadSamples(paths));
  if (json) {
    console.log(JSON.stringify({ summary: summarize(rows), rows }, null, 2));
  } else {
    printReport(rows);
  }
}

main(process.argv.slice(2));
