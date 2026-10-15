import {
  start,
  query,
  transaction,
  owned,
  records,
  money,
  text,
  date,
  currency,
  integer,
  fields,
  requireThat,
  today,
} from '../common.js';

export function nextDate(value, period, anchor) {
  const current = new Date(value + 'T00:00:00Z');
  if (period === 'weekly') {
    current.setUTCDate(current.getUTCDate() + 7);
    return current.toISOString().slice(0, 10);
  }
  const month = current.getUTCMonth() + (period === 'monthly' ? 1 : 0);
  const year = current.getUTCFullYear() + (period === 'yearly' ? 1 : 0);
  const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(anchor, last))).toISOString().slice(0, 10);
}
function subscriptionValues(body) {
  fields(
    body,
    ['name', 'amount', 'currency', 'period', 'next_due', 'remind_days'],
    ['name', 'amount', 'next_due'],
  );
  const unit = currency(body.currency),
    due = date(body.next_due),
    period = body.period ?? 'monthly';
  requireThat(['weekly', 'monthly', 'yearly'].includes(period), 'Chu kỳ không hợp lệ');
  return [
    text(body.name),
    money(body.amount, unit),
    unit,
    period,
    due,
    Number(due.slice(-2)),
    integer(body.remind_days ?? 3, 0, 30),
  ];
}
async function reminders(pool, user) {
  const items = await query(
    pool,
    'SELECT * FROM subscriptions WHERE active=1' + (user ? ' AND user_id=?' : ''),
    user ? [user] : [],
  );
  let created = 0;
  for (const item of items) {
    const threshold = new Date(item.next_due + 'T00:00:00Z');
    threshold.setUTCDate(threshold.getUTCDate() - item.remind_days);
    if (threshold.toISOString().slice(0, 10) <= today()) {
      const row = await query(
        pool,
        'INSERT IGNORE INTO notifications(user_id,message,dedup_key,created_on) VALUES(?,?,?,?)',
        [
          item.user_id,
          `${item.name} đến hạn ${item.next_due}`,
          `subscription:${item.id}:${item.next_due}`,
          today(),
        ],
      );
      created += row.affectedRows;
    }
  }
  return { created };
}
if (process.argv.includes('--self-test')) {
  const assert = (await import('node:assert/strict')).default;
  assert.equal(nextDate('2027-01-31', 'monthly', 31), '2027-02-28');
  assert.equal(nextDate('2027-02-28', 'monthly', 31), '2027-03-31');
  assert.equal(nextDate('2024-02-29', 'yearly', 29), '2025-02-28');
  assert.equal(nextDate('2026-12-28', 'weekly', 28), '2027-01-04');
  assert.equal(money('10.50', 'USD'), 1050);
  assert.throws(() => money('0.001', 'USD'));
  assert.throws(() => date('2026-02-30'));
  console.log('PASS: lịch cuối tháng, năm nhuận, tiền và ngày');
} else
  await start('recurring', async ({ route, method, body, user, pool }) => {
    if (route === '/subscriptions' && method === 'POST') {
      const row = await query(
        pool,
        'INSERT INTO subscriptions(user_id,name,amount_minor,currency,period,next_due,anchor_day,remind_days) VALUES(?,?,?,?,?,?,?,?)',
        [user.id, ...subscriptionValues(body)],
      );
      return { status: 201, data: { id: row.insertId } };
    }
    if (route === '/subscriptions' && method === 'GET')
      return query(pool, 'SELECT * FROM subscriptions WHERE user_id=?', [user.id]);
    let match = /^\/subscriptions\/([1-9]\d*)(\/paid)?$/.exec(route);
    if (match && ['PUT', 'DELETE', 'POST'].includes(method)) {
      if (match[2] ? method !== 'POST' : method === 'POST') return;
      const id = integer(Number(match[1])),
        values = method === 'PUT' ? subscriptionValues(body) : null;
      return transaction(pool, async (db) => {
        const old = await owned(db, 'subscriptions', id, user.id);
        if (method === 'PUT') {
          await query(
            db,
            'UPDATE subscriptions SET name=?,amount_minor=?,currency=?,period=?,next_due=?,anchor_day=?,remind_days=? WHERE id=?',
            [...values, id],
          );
          return { id };
        }
        if (method === 'DELETE') {
          await query(db, 'UPDATE subscriptions SET active=0 WHERE id=?', [id]);
          return { id, active: false };
        }
        requireThat(old.active, 'Khoản định kỳ đã ngừng theo dõi');
        const next_due = nextDate(old.next_due, old.period, old.anchor_day);
        await query(
          db,
          'INSERT INTO payments(subscription_id,due_on,paid_on,amount_minor) VALUES(?,?,?,?)',
          [id, old.next_due, today(), old.amount_minor],
        );
        await query(db, 'UPDATE subscriptions SET next_due=? WHERE id=?', [next_due, id]);
        return { id, next_due, message: 'Đã ghi nhận theo dõi; ghi khoản chi riêng ở Ledger' };
      });
    }
    if (route === '/reminders/check' && method === 'POST') return reminders(pool, user.id);
    if (route === '/internal/reminders/check' && method === 'POST') return reminders(pool);
    if (route === '/internal/notifications' && method === 'POST') {
      fields(body, ['user_id', 'message', 'dedup_key']);
      const row = await query(
        pool,
        'INSERT IGNORE INTO notifications(user_id,message,dedup_key,created_on) VALUES(?,?,?,?)',
        [integer(body.user_id), text(body.message, 500), text(body.dedup_key, 160), today()],
      );
      return { status: 201, data: { created: row.affectedRows > 0 } };
    }
    if (route === '/notifications' && method === 'GET')
      return query(pool, 'SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 200', [
        user.id,
      ]);
    match = /^\/notifications\/([1-9]\d*)\/read$/.exec(route);
    if (match && method === 'PATCH')
      return transaction(pool, async (db) => {
        const id = integer(Number(match[1]));
        await owned(db, 'notifications', id, user.id);
        await query(db, 'UPDATE notifications SET is_read=1 WHERE id=?', [id]);
        return { id, is_read: true };
      });
    if (route === '/suggestions' && method === 'GET') {
      const first = new Date(today() + 'T00:00:00Z');
      first.setUTCDate(first.getUTCDate() - 180);
      const items = await records(user.id, first.toISOString().slice(0, 10), today());
      const reversed = new Set(items.filter((t) => t.reversal_of).map((t) => t.reversal_of)),
        groups = new Map();
      for (const t of items)
        if (t.kind === 'expense' && !t.reversal_of && !reversed.has(t.id) && t.note) {
          const key = JSON.stringify([t.note.toLowerCase(), t.amount_minor, t.currency]);
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(t.occurred_on);
        }
      const result = [];
      // shortcut: chỉ nhận nhịp tháng qua tên và số tiền; mở rộng khi cần nhận chu kỳ khác.
      for (const [key, dates] of groups) {
        dates.sort();
        const gaps = dates
          .slice(1)
          .map((d, i) => (Date.parse(d) - Date.parse(dates[i])) / 86400000);
        if (dates.length >= 3 && gaps.every((d) => d >= 26 && d <= 35)) {
          const [name, amount_minor, currency] = JSON.parse(key);
          result.push({
            name,
            amount_minor,
            currency,
            occurrences: dates.length,
            period: 'monthly',
          });
        }
      }
      return result;
    }
  });
