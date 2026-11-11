#!/usr/bin/env node
// Scores the whole of RedFlag (rules plus the live AI check, combined the way
// the page combines them) against labeled samples. These are the numbers the
// stats section on the website may publish.
//
//   node scripts/evaluate-live.js tests/fixtures/sms-test-set.json
//   node scripts/evaluate-live.js my-samples.json --url https://example.workers.dev
//
// Each sample uses one AI check from the daily free allowance. Requests are
// spaced out to stay under the Worker's limit of 10 a minute.

import { combine } from '../js/combine.js';
import { analyze } from '../js/engine/index.js';
import { loadSamples, percent, rate } from './lib/samples.js';

const DEFAULT_URL = 'https://redflag.redflag-ai.workers.dev';
const GAP_MS = 6500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function askAi(url, sample) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${url}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: url },
      body: JSON.stringify({ text: sample.text, lang: sample.lang === 'unknown' ? 'en' : sample.lang }),
    });
    if (response.ok) return response.json();
    if (response.status !== 429) return null;
    await sleep(30_000);
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const url = urlIndex === -1 ? DEFAULT_URL : args[urlIndex + 1];
  const paths = args.filter((arg, index) => !arg.startsWith('--') && (urlIndex === -1 || index !== urlIndex + 1));
  if (paths.length === 0) {
    console.error('Usage: node scripts/evaluate-live.js <samples.json> [--url <worker url>]');
    process.exit(1);
  }

  const rows = [];
  for (const sample of loadSamples(paths)) {
    const rules = analyze(sample.text);
    const opinion = await askAi(url, sample);
    const { verdict } = combine(rules, opinion);
    const row = { ...sample, rules: rules.verdict, ai: opinion?.verdict ?? 'none', actual: verdict };
    rows.push(row);
    const scam = sample.expected !== 'green';
    const ok = scam ? verdict !== 'green' : verdict === 'green';
    console.log(`${ok ? 'ok  ' : 'MISS'} ${row.id.padEnd(9)} rules ${row.rules.padEnd(6)} ai ${row.ai.padEnd(6)} => ${verdict.padEnd(6)} ${row.notes ?? ''}`);
    await sleep(GAP_MS);
  }

  // A scam marked yellow still warns the person, so it counts as caught.
  // A safe message marked yellow is a false alarm.
  const scams = rows.filter((row) => row.expected !== 'green');
  const safe = rows.filter((row) => row.expected === 'green');
  const caught = scams.filter((row) => row.actual !== 'green').length;
  const falseAlarms = safe.filter((row) => row.actual !== 'green').length;
  const noAi = rows.filter((row) => row.ai === 'none').length;

  console.log('');
  console.log(`Messages tested: ${rows.length} (${scams.length} scams, ${safe.length} safe)`);
  console.log(`Catch rate:      ${percent(rate(caught, scams.length))} (${caught}/${scams.length})`);
  console.log(`False alarms:    ${percent(rate(falseAlarms, safe.length))} (${falseAlarms}/${safe.length})`);
  if (noAi > 0) console.log(`No AI answer:    ${noAi} (rules only for those)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
