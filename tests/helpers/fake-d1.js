// A small stand-in for Cloudflare D1 that understands only the statements
// the Worker uses.

export function fakeDb() {
  const reports = new Map();
  const progress = new Map();
  const counts = new Map();

  const run = (sql, args) => {
    if (sql.startsWith('INSERT OR IGNORE INTO reports')) {
      const [seq, number, created, subject, robocall] = args;
      if (!reports.has(seq)) reports.set(seq, { seq, number, created, subject, robocall });
    } else if (sql.startsWith('INSERT INTO import_progress')) {
      const [day, next_offset, done] = args;
      progress.set(day, { day, next_offset, done });
    } else if (sql.startsWith('INSERT INTO daily_counts')) {
      const key = args.join(' ');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else if (sql.startsWith('DELETE FROM reports')) {
      for (const [seq, row] of reports) if (row.created < args[0]) reports.delete(seq);
    } else if (sql.startsWith('DELETE FROM import_progress')) {
      for (const day of progress.keys()) if (day < args[0]) progress.delete(day);
    } else {
      throw new Error(`fake D1 does not know: ${sql}`);
    }
  };

  const all = (sql, args) => {
    if (sql.includes('FROM import_progress')) return [...progress.values()].filter((row) => row.day >= args[0]);
    if (sql.startsWith('SELECT created')) {
      return [...reports.values()]
        .filter((row) => row.number === args[0] && row.created >= args[1])
        .sort((a, b) => b.created.localeCompare(a.created));
    }
    const countRows = [...counts].map(([key, count]) => ({ day: key.split(' ')[0], kind: key.split(' ')[1], count }));
    if (sql.startsWith('SELECT kind, SUM')) {
      const totals = new Map();
      for (const row of countRows) totals.set(row.kind, (totals.get(row.kind) ?? 0) + row.count);
      return [...totals].map(([kind, total]) => ({ kind, total }));
    }
    if (sql.startsWith('SELECT day, kind')) {
      return countRows.filter((row) => row.day >= args[0]).sort((a, b) => b.day.localeCompare(a.day));
    }
    throw new Error(`fake D1 does not know: ${sql}`);
  };

  const statement = (sql, args = []) => ({
    sql,
    args,
    bind: (...bound) => statement(sql, bound),
    all: async () => ({ results: all(sql, args) }),
    run: async () => run(sql, args),
  });

  return {
    reports,
    progress,
    counts,
    prepare: (sql) => statement(sql),
    batch: async (statements) => {
      for (const { sql, args } of statements) run(sql, args);
    },
  };
}
