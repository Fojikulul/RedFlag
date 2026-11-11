// A daily tally of how often the checker and the phone lookup are used.
// Only the day, the kind of use and a number are kept: nothing about the
// message, the phone number or the visitor.

export const KINDS = ['check', 'lookup'];

const day = (date) => date.toISOString().slice(0, 10);

/** Adds one to today's count. Days are counted in UTC. */
export async function countUse(db, kind, now = new Date()) {
  if (!db || !KINDS.includes(kind)) return;
  await db
    .prepare('INSERT INTO daily_counts (day, kind, count) VALUES (?, ?, 1) ON CONFLICT(day, kind) DO UPDATE SET count = count + 1')
    .bind(day(now), kind)
    .run();
}

/** All-time totals, plus one line per day for the last `days` days. */
export async function readCounts(db, now = new Date(), days = 30) {
  const since = day(new Date(now.getTime() - (days - 1) * 86_400_000));
  const [totals, recent] = await Promise.all([
    db.prepare('SELECT kind, SUM(count) AS total FROM daily_counts GROUP BY kind').all(),
    db.prepare('SELECT day, kind, count FROM daily_counts WHERE day >= ? ORDER BY day DESC').bind(since).all(),
  ]);

  const total = (kind) => totals.results.find((row) => row.kind === kind)?.total ?? 0;
  const byDay = new Map();
  for (const row of recent.results) {
    if (!byDay.has(row.day)) byDay.set(row.day, { day: row.day, checks: 0, lookups: 0 });
    if (row.kind === 'check') byDay.get(row.day).checks = row.count;
    if (row.kind === 'lookup') byDay.get(row.day).lookups = row.count;
  }

  return { checks: total('check'), lookups: total('lookup'), days: [...byDay.values()] };
}
