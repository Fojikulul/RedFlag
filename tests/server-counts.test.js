import assert from 'node:assert/strict';
import { test } from 'node:test';

import { countUse, readCounts } from '../server/src/counts.js';
import { fakeDb } from './helpers/fake-d1.js';

const at = (iso) => new Date(iso);

test('adds up checks and lookups by day', async () => {
  const db = fakeDb();
  await countUse(db, 'check', at('2026-11-10T09:00:00Z'));
  await countUse(db, 'check', at('2026-11-10T23:59:59Z'));
  await countUse(db, 'lookup', at('2026-11-10T12:00:00Z'));
  await countUse(db, 'check', at('2026-11-11T00:00:01Z'));

  assert.deepEqual(await readCounts(db, at('2026-11-11T08:00:00Z')), {
    checks: 3,
    lookups: 1,
    days: [
      { day: '2026-11-11', checks: 1, lookups: 0 },
      { day: '2026-11-10', checks: 2, lookups: 1 },
    ],
  });
});

test('stores nothing but the day, the kind and a number', async () => {
  const db = fakeDb();
  await countUse(db, 'check', at('2026-11-10T09:00:00Z'));
  assert.deepEqual([...db.counts], [['2026-11-10 check', 1]]);
});

test('the total covers every day, the list only recent ones', async () => {
  const db = fakeDb();
  await countUse(db, 'check', at('2026-08-01T10:00:00Z'));
  await countUse(db, 'check', at('2026-11-10T10:00:00Z'));
  const counts = await readCounts(db, at('2026-11-10T12:00:00Z'), 30);
  assert.equal(counts.checks, 2);
  assert.deepEqual(counts.days, [{ day: '2026-11-10', checks: 1, lookups: 0 }]);
});

test('starts at zero, and ignores unknown kinds or a missing database', async () => {
  const db = fakeDb();
  assert.deepEqual(await readCounts(db, at('2026-11-10T12:00:00Z')), { checks: 0, lookups: 0, days: [] });
  await countUse(db, 'something-else');
  await countUse(undefined, 'check');
  assert.equal(db.counts.size, 0);
});
