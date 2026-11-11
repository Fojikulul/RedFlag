import assert from 'node:assert/strict';
import { test } from 'node:test';

import { recordCheck, recordLookup, usageSummary } from '../server/src/usage.js';

// Just enough of D1 to run the two queries against an in-memory table.
function fakeDb() {
  const rows = new Map();
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) { this.args = args; return this; },
        async run() {
          const [day, verdict] = this.args;
          const key = `${day}|${verdict}`;
          rows.set(key, { day, verdict, n: (rows.get(key)?.n ?? 0) + 1 });
        },
        async all() {
          assert.match(sql, /^SELECT/);
          return { results: [...rows.values()].sort((a, b) => a.day.localeCompare(b.day)) };
        },
      };
    },
  };
}

test('counts checks by verdict and never stores anything else', async () => {
  const db = fakeDb();
  for (const verdict of ['red', 'red', 'yellow', 'green', null, 'made-up']) await recordCheck(db, verdict);
  const stored = [...db.rows.values()];
  assert.deepEqual(new Set(stored.map((row) => row.verdict)), new Set(['red', 'yellow', 'green', 'none']));
  for (const row of stored) assert.deepEqual(Object.keys(row).sort(), ['day', 'n', 'verdict']);

  const summary = await usageSummary(db);
  assert.equal(summary.checked, 6);
  assert.equal(summary.warned, 3);
  assert.equal(summary.days.length, 1);
});

test('an empty database reports zero', async () => {
  assert.deepEqual(await usageSummary(fakeDb()), { checked: 0, warned: 0, since: null, days: [] });
});

test('counts phone lookups apart from message checks', async () => {
  let sql;
  let args;
  const db = {
    prepare(text) {
      sql = text;
      return { bind(...bound) { args = bound; return this; }, async run() {} };
    },
  };
  await recordLookup(db);
  assert.match(sql, /INSERT INTO lookups/);
  assert.equal(args.length, 1);
  assert.match(args[0], /^\d{4}-\d{2}-\d{2}$/);
});
