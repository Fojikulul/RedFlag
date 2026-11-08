// Usage counts, so RedFlag can show that people use it. One row per UTC day
// and verdict with a number in it. Nothing about the message or the person
// is stored: no text, no address, no time of day.

const VERDICTS = ['red', 'yellow', 'green', 'none'];

const today = () => new Date().toISOString().slice(0, 10);

/** Adds one check to today's count. `verdict` is the AI's, or null. */
export function recordCheck(db, verdict) {
  const key = VERDICTS.includes(verdict) ? verdict : 'none';
  return db
    .prepare('INSERT INTO checks (day, verdict, n) VALUES (?, ?, 1) ON CONFLICT (day, verdict) DO UPDATE SET n = n + 1')
    .bind(today(), key)
    .run();
}

/**
 * Totals for the site and a daily list for the owner:
 * { checked, warned, since, days: [{ day, checked, warned }] }
 * "warned" counts checks the AI marked red or yellow.
 */
export async function usageSummary(db) {
  const { results } = await db
    .prepare('SELECT day, verdict, n FROM checks ORDER BY day')
    .all();

  const byDay = new Map();
  for (const { day, verdict, n } of results) {
    const row = byDay.get(day) ?? { day, checked: 0, warned: 0 };
    row.checked += n;
    if (verdict === 'red' || verdict === 'yellow') row.warned += n;
    byDay.set(day, row);
  }

  const days = [...byDay.values()];
  return {
    checked: days.reduce((sum, row) => sum + row.checked, 0),
    warned: days.reduce((sum, row) => sum + row.warned, 0),
    since: days[0]?.day ?? null,
    days: days.slice(-90),
  };
}
