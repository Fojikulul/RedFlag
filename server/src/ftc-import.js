// Copies the FTC's Do Not Call "reported calls" data into D1, a little at a
// time on a schedule. The FTC API can't search by phone number, so lookups
// read our copy instead, and the numbers people look up never reach the FTC.

import { REPORT_DAYS } from './phone.js';

const FTC_URL = 'https://api.ftc.gov/v0/dnc-complaints';
export const PAGE_SIZE = 50;

// The FTC adds a day's reports over the next few weekdays, so recent days
// stay open and are checked again for new rows.
const SETTLE_DAYS = 5;

// Matches the cron in wrangler.toml: only the first run after midnight UTC.
const CLEANUP_MINUTES = 20;

const day = (date) => date.toISOString().slice(0, 10);
const daysBefore = (date, n) => new Date(date.getTime() - n * 86_400_000);
const nextDay = (date) => day(daysBefore(new Date(`${date}T00:00:00Z`), -1));

/** Keeps the rows with a usable ten-digit number. */
export function parsePage(json) {
  const rows = [];
  for (const record of json?.data ?? []) {
    const a = record?.attributes ?? {};
    const number = String(a['company-phone-number'] ?? '');
    const created = String(a['created-date'] ?? '');
    if (!Number.isInteger(a.seq) || !/^\d{10}$/.test(number) || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(created)) continue;
    rows.push({
      seq: a.seq,
      number,
      created,
      subject: String(a.subject ?? '').slice(0, 120),
      robocall: a['recorded-message-or-robocall'] === 'Y' ? 1 : 0,
    });
  }
  return { rows, received: json?.data?.length ?? 0 };
}

async function fetchPage({ apiKey, date, offset, fetchImpl }) {
  const params = new URLSearchParams({
    api_key: apiKey,
    created_date: date,
    sort_order: 'ASC',
    items_per_page: String(PAGE_SIZE),
    offset: String(offset),
  });
  const response = await fetchImpl(`${FTC_URL}?${params}`);
  if (!response.ok) throw new Error(`FTC answered ${response.status}`);
  return parsePage(await response.json());
}

/**
 * Imports up to `pages` pages, oldest unfinished day first, and returns how
 * many rows it saw. Safe to run as often as you like: rows are keyed on the
 * FTC's own sequence number, so repeats are ignored.
 */
export async function importReports({
  db, apiKey, fetchImpl = fetch, now = new Date(), pages = 10, backfillDays = 14,
}) {
  const today = day(now);
  const settled = day(daysBefore(now, SETTLE_DAYS));
  const first = day(daysBefore(now, backfillDays));

  const { results } = await db.prepare('SELECT day, next_offset, done FROM import_progress WHERE day >= ?').bind(first).all();
  const progress = new Map(results.map((row) => [row.day, row]));

  let budget = pages;
  let imported = 0;
  for (let date = first; date <= today && budget > 0; date = nextDay(date)) {
    const state = progress.get(date) ?? { next_offset: 0, done: 0 };
    if (state.done) continue;

    let offset = state.next_offset;
    let done = 0;
    while (budget > 0) {
      budget--;
      const { rows, received } = await fetchPage({ apiKey, date, offset, fetchImpl });
      offset += received;
      imported += rows.length;
      if (received < PAGE_SIZE && date <= settled) done = 1;

      const insert = db.prepare('INSERT OR IGNORE INTO reports (seq, number, created, subject, robocall) VALUES (?, ?, ?, ?, ?)');
      await db.batch([
        ...rows.map((row) => insert.bind(row.seq, row.number, row.created, row.subject, row.robocall)),
        db.prepare('INSERT INTO import_progress (day, next_offset, done) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET next_offset = excluded.next_offset, done = excluded.done')
          .bind(date, offset, done),
      ]);
      if (received < PAGE_SIZE) break;
    }
  }

  // Dropping year-old reports reads the whole table, so it runs once a day.
  const cleanup = [db.prepare('DELETE FROM import_progress WHERE day < ?').bind(first)];
  if (now.getUTCHours() === 0 && now.getUTCMinutes() < CLEANUP_MINUTES) {
    cleanup.push(db.prepare('DELETE FROM reports WHERE created < ?').bind(day(daysBefore(now, REPORT_DAYS))));
  }
  await db.batch(cleanup);
  return imported;
}
