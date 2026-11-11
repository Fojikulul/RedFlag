import assert from 'node:assert/strict';
import { test } from 'node:test';

import { importReports, PAGE_SIZE, parsePage } from '../server/src/ftc-import.js';
import { fakeDb } from './helpers/fake-d1.js';

const NOW = new Date('2026-11-10T12:00:00Z');

const record = (seq, number, created = '2026-11-03 09:00:00', extra = {}) => ({
  type: 'dnc_complaint',
  attributes: {
    'company-phone-number': number,
    'created-date': created,
    subject: 'Other',
    'recorded-message-or-robocall': 'N',
    seq,
    ...extra,
  },
});

// Answers like the FTC API: one day's rows, a page at a time.
function fakeFtc(days) {
  const calls = [];
  const fetchImpl = async (url) => {
    const params = new URL(url).searchParams;
    calls.push({ date: params.get('created_date'), offset: Number(params.get('offset')), key: params.get('api_key'), order: params.get('sort_order') });
    const rows = days[params.get('created_date')] ?? [];
    const offset = Number(params.get('offset'));
    return { ok: true, json: async () => ({ data: rows.slice(offset, offset + Number(params.get('items_per_page'))) }) };
  };
  return { calls, fetchImpl };
}

const dayOf = (date, count, firstSeq) => Array.from({ length: count }, (_, i) => record(firstSeq + i, String(5054200000 + firstSeq + i), `${date} 10:00:00`));

test('keeps only rows with a real ten-digit number', () => {
  const { rows, received } = parsePage({
    data: [
      record(1, '5054205449', '2026-11-03 15:14:51', { subject: 'Medical & prescriptions', 'recorded-message-or-robocall': 'Y' }),
      record(2, ''),
      record(3, '06/10/2026', '20261235'),
      record(4, '50542'),
      record('five', '5054205449'),
      { type: 'dnc_complaint' },
    ],
  });
  assert.equal(received, 6);
  assert.deepEqual(rows, [{ seq: 1, number: '5054205449', created: '2026-11-03 15:14:51', subject: 'Medical & prescriptions', robocall: 1 }]);
  assert.deepEqual(parsePage(null), { rows: [], received: 0 });
});

test('imports day by day, oldest first, and finishes settled days', async () => {
  const db = fakeDb();
  const ftc = fakeFtc({ '2026-11-03': dayOf('2026-11-03', PAGE_SIZE + 10, 1000), '2026-11-05': dayOf('2026-11-05', 4, 2000) });

  const imported = await importReports({ db, apiKey: 'ftc-key', fetchImpl: ftc.fetchImpl, now: NOW, pages: 3, backfillDays: 7 });
  assert.equal(imported, PAGE_SIZE + 10);
  assert.deepEqual(ftc.calls.map(({ date, offset }) => [date, offset]), [['2026-11-03', 0], ['2026-11-03', PAGE_SIZE], ['2026-11-04', 0]]);
  assert.ok(ftc.calls.every((call) => call.key === 'ftc-key' && call.order === 'ASC'));
  assert.deepEqual(db.progress.get('2026-11-03'), { day: '2026-11-03', next_offset: PAGE_SIZE + 10, done: 1 });
  assert.equal(db.progress.get('2026-11-04').done, 1);

  // The next run skips the finished days and carries on.
  ftc.calls.length = 0;
  await importReports({ db, apiKey: 'ftc-key', fetchImpl: ftc.fetchImpl, now: NOW, pages: 1, backfillDays: 7 });
  assert.deepEqual(ftc.calls.map(({ date, offset }) => [date, offset]), [['2026-11-05', 0]]);
  assert.equal(db.reports.size, PAGE_SIZE + 14);
});

test('keeps recent days open and picks up where it stopped', async () => {
  const db = fakeDb();
  const days = { '2026-11-10': dayOf('2026-11-10', 10, 1) };
  const ftc = fakeFtc(days);
  const options = { db, apiKey: 'k', fetchImpl: ftc.fetchImpl, now: NOW, pages: 5, backfillDays: 0 };

  await importReports(options);
  assert.deepEqual(db.progress.get('2026-11-10'), { day: '2026-11-10', next_offset: 10, done: 0 });

  // More reports for the same day arrive later.
  days['2026-11-10'].push(...dayOf('2026-11-10', 5, 500));
  await importReports(options);
  assert.equal(ftc.calls.at(-1).offset, 10);
  assert.equal(db.reports.size, 15);
  assert.equal(db.progress.get('2026-11-10').next_offset, 15);
});

test('importing the same rows twice changes nothing', async () => {
  const db = fakeDb();
  const ftc = fakeFtc({ '2026-11-10': dayOf('2026-11-10', 3, 1) });
  const options = { db, apiKey: 'k', fetchImpl: ftc.fetchImpl, now: NOW, backfillDays: 0 };
  await importReports(options);
  db.progress.clear();
  await importReports(options);
  assert.equal(db.reports.size, 3);
});

test('drops reports older than a year, once a day, and stops on an FTC error', async () => {
  const db = fakeDb();
  db.reports.set(1, { seq: 1, number: '5054205449', created: '2025-11-01 08:00:00', subject: '', robocall: 0 });
  db.reports.set(2, { seq: 2, number: '5054205449', created: '2026-01-01 08:00:00', subject: '', robocall: 0 });
  await importReports({ db, apiKey: 'k', fetchImpl: fakeFtc({}).fetchImpl, now: NOW, backfillDays: 0 });
  assert.equal(db.reports.size, 2);

  const midnight = new Date('2026-11-11T00:05:00Z');
  await importReports({ db, apiKey: 'k', fetchImpl: fakeFtc({}).fetchImpl, now: midnight, backfillDays: 0 });
  assert.deepEqual([...db.reports.keys()], [2]);

  const failing = async () => ({ ok: false, status: 429 });
  await assert.rejects(importReports({ db, apiKey: 'k', fetchImpl: failing, now: NOW, backfillDays: 0 }), /FTC answered 429/);
});
