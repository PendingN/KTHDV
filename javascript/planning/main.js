import {
  start,
  query,
  transaction,
  owned,
  peer,
  money,
  safe,
  text,
  date,
  currency,
  integer,
  fields,
  requireThat,
  today,
} from '../common.js';
import { usage } from './usage.js';

async function budgetValues(body, user) {
  fields(
    body,
    ['name', 'category_id', 'currency', 'limit_amount', 'start_on', 'end_on', 'threshold'],
    ['name', 'category_id', 'limit_amount', 'start_on', 'end_on'],
  );
  const unit = currency(body.currency);
  const category = integer(body.category_id);
  const first = date(body.start_on),
    last = date(body.end_on);
  requireThat(first <= last, 'Khoảng thời gian không hợp lệ');
  const categories = await peer('ledger', 'GET', '/categories', user.token);
  requireThat(
    categories.some((c) => c.id === category && c.kind === 'expense' && c.active),
    'Danh mục chi không tồn tại hoặc đã ngừng dùng',
  );
  return [
    text(body.name),
    category,
    unit,
    money(body.limit_amount, unit),
    first,
    last,
    integer(body.threshold ?? 80, 1, 100),
  ];
}
function goalValues(body) {
  fields(
    body,
    ['name', 'currency', 'target_amount', 'deadline'],
    ['name', 'target_amount', 'deadline'],
  );
  const unit = currency(body.currency);
  return [text(body.name), unit, money(body.target_amount, unit), date(body.deadline)];
}
async function evaluate(pool, user) {
  const budgets = await usage(pool, user);
  for (const budget of budgets) {
    if (!budget.active) continue;
    const thresholds = [...new Set([budget.threshold, 100])].sort((a, b) => a - b);
    for (const threshold of thresholds) {
      if (BigInt(budget.spent_minor) * 100n < BigInt(budget.limit_minor) * BigInt(threshold))
        continue;
      const existing = await query(
        pool,
        'SELECT id FROM alerts WHERE budget_id=? AND threshold=?',
        [budget.id, threshold],
      );
      if (existing.length) continue;
      await peer('recurring', 'POST', '/internal/notifications', undefined, {
        user_id: user,
        message: `Ngân sách ${budget.name} đạt ngưỡng ${threshold}%`,
        dedup_key: `budget:${budget.id}:${threshold}`,
      });
      await query(pool, 'INSERT IGNORE INTO alerts(budget_id,threshold) VALUES(?,?)', [
        budget.id,
        threshold,
      ]);
    }
  }
  return budgets;
}
await start('planning', async ({ route, method, body, user, pool }) => {
  if (route === '/budgets' && method === 'POST') {
    const values = await budgetValues(body, user);
    const row = await query(
      pool,
      'INSERT INTO budgets(user_id,name,category_id,currency,limit_minor,start_on,end_on,threshold) VALUES(?,?,?,?,?,?,?,?)',
      [user.id, ...values],
    );
    return { status: 201, data: { id: row.insertId } };
  }
  if (route === '/budgets' && method === 'GET') return usage(pool, user.id);
  if (route === '/budgets/evaluate' && method === 'POST') return evaluate(pool, user.id);
  let match = /^\/internal\/evaluate\/([1-9]\d*)$/.exec(route);
  if (match && method === 'POST') return evaluate(pool, integer(Number(match[1])));
  match = /^\/(budgets|goals)\/([1-9]\d*)$/.exec(route);
  if (match && ['PUT', 'DELETE'].includes(method)) {
    const table = match[1],
      id = integer(Number(match[2]));
    const values =
      method === 'PUT'
        ? table === 'budgets'
          ? await budgetValues(body, user)
          : goalValues(body)
        : null;
    return transaction(pool, async (db) => {
      const old = await owned(db, table, id, user.id);
      if (method === 'DELETE') {
        await query(db, `UPDATE ${table} SET active=0 WHERE id=?`, [id]);
        return { id, active: false };
      }
      if (table === 'budgets') {
        requireThat(
          old.category_id === values[1] &&
            old.currency === values[2] &&
            old.start_on === values[4] &&
            old.end_on === values[5],
          'Tạo ngân sách mới nếu đổi danh mục, kỳ hoặc tiền tệ',
        );
        await query(
          db,
          'UPDATE budgets SET name=?,category_id=?,currency=?,limit_minor=?,start_on=?,end_on=?,threshold=? WHERE id=?',
          [...values, id],
        );
      } else {
        requireThat(old.currency === values[1], 'Không đổi tiền tệ của mục tiêu');
        await query(db, 'UPDATE goals SET name=?,target_minor=?,deadline=? WHERE id=?', [
          values[0],
          values[2],
          values[3],
          id,
        ]);
      }
      return { id };
    });
  }
  if (route === '/goals' && method === 'POST') {
    const row = await query(
      pool,
      'INSERT INTO goals(user_id,name,currency,target_minor,deadline) VALUES(?,?,?,?,?)',
      [user.id, ...goalValues(body)],
    );
    return { status: 201, data: { id: row.insertId } };
  }
  if (route === '/goals' && method === 'GET') {
    const items = await query(pool, 'SELECT * FROM goals WHERE user_id=?', [user.id]);
    return items.map((g) => ({
      ...g,
      progress_percent: Math.round((Number(g.saved_minor) * 10000) / Number(g.target_minor)) / 100,
    }));
  }
  match = /^\/goals\/([1-9]\d*)\/contributions$/.exec(route);
  if (match && method === 'POST') {
    fields(body, ['amount']);
    const id = integer(Number(match[1]));
    return transaction(pool, async (db) => {
      const goal = await owned(db, 'goals', id, user.id);
      requireThat(goal.active, 'Mục tiêu đã kết thúc');
      const amount = money(body.amount, goal.currency),
        saved = safe(BigInt(goal.saved_minor) + BigInt(amount));
      await query(
        db,
        'INSERT INTO goal_contributions(goal_id,amount_minor,created_on) VALUES(?,?,?)',
        [id, amount, today()],
      );
      await query(db, 'UPDATE goals SET saved_minor=? WHERE id=?', [saved, id]);
      return { status: 201, data: { id, saved_minor: saved } };
    });
  }
});
