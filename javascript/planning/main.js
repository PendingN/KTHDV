import {start, query, transaction, owned, peer, records, money, safe, text, date, currency, integer, fields, requireThat, today} from '../common.js';

async function budgetValues(p, user) {
  fields(p, ['name', 'category_id', 'currency', 'limit_amount', 'start_on', 'end_on', 'threshold'], ['name', 'category_id', 'limit_amount', 'start_on', 'end_on']);
  const unit = currency(p.currency); const category = integer(p.category_id);
  const first = date(p.start_on), last = date(p.end_on); requireThat(first <= last, 'Khoảng thời gian không hợp lệ');
  const categories = await peer('ledger', 'GET', '/categories', user.token);
  requireThat(categories.some(c => c.id === category && c.kind === 'expense' && c.active), 'Danh mục chi không tồn tại hoặc đã ngừng dùng');
  return [text(p.name), category, unit, money(p.limit_amount, unit), first, last, integer(p.threshold ?? 80, 1, 100)];
}
function goalValues(p) {
  fields(p, ['name', 'currency', 'target_amount', 'deadline'], ['name', 'target_amount', 'deadline']);
  const unit = currency(p.currency); return [text(p.name), unit, money(p.target_amount, unit), date(p.deadline)];
}
async function usage(pool, user) {
  const budgets = await query(pool, 'SELECT * FROM budgets WHERE user_id=?', [user]);
  // ponytail: đọc lịch sử từng ngân sách; thêm tổng hợp theo kỳ khi dữ liệu lớn.
  for (const b of budgets) {
    const items = await records(user, b.start_on, b.end_on);
    b.spent_minor = safe(items.filter(t => t.kind === 'expense' && t.category_id === b.category_id && t.currency === b.currency).reduce((sum, t) => sum + BigInt(t.amount_minor), 0n));
    b.used_percent = Math.round(b.spent_minor * 10000 / Number(b.limit_minor)) / 100;
  }
  return budgets;
}
async function evaluate(pool, user) {
  const budgets = await usage(pool, user);
  for (const b of budgets) if (b.active) for (const threshold of [...new Set([b.threshold, 100])].sort((a, z) => a - z)) {
    if (BigInt(b.spent_minor) * 100n < BigInt(b.limit_minor) * BigInt(threshold)) continue;
    const existing = await query(pool, 'SELECT id FROM alerts WHERE budget_id=? AND threshold=?', [b.id, threshold]);
    if (!existing.length) {
      await peer('recurring', 'POST', '/internal/notifications', undefined, {user_id: user, message: `Ngân sách ${b.name} đạt ngưỡng ${threshold}%`, dedup_key: `budget:${b.id}:${threshold}`});
      await query(pool, 'INSERT IGNORE INTO alerts(budget_id,threshold) VALUES(?,?)', [b.id, threshold]);
    }
  }
  return budgets;
}
await start('planning', async ({route, method, body: p, user: u, pool}) => {
  if (route === '/budgets' && method === 'POST') {
    const values = await budgetValues(p, u);
    const row = await query(pool, 'INSERT INTO budgets(user_id,name,category_id,currency,limit_minor,start_on,end_on,threshold) VALUES(?,?,?,?,?,?,?,?)', [u.id, ...values]);
    return {status: 201, data: {id: row.insertId}};
  }
  if (route === '/budgets' && method === 'GET') return usage(pool, u.id);
  if (route === '/budgets/evaluate' && method === 'POST') return evaluate(pool, u.id);
  let match = /^\/internal\/evaluate\/([1-9]\d*)$/.exec(route);
  if (match && method === 'POST') return evaluate(pool, integer(Number(match[1])));
  match = /^\/(budgets|goals)\/([1-9]\d*)$/.exec(route);
  if (match && ['PUT', 'DELETE'].includes(method)) {
    const table = match[1], id = integer(Number(match[2]));
    const values = method === 'PUT' ? table === 'budgets' ? await budgetValues(p, u) : goalValues(p) : null;
    return transaction(pool, async db => {
      const old = await owned(db, table, id, u.id);
      if (method === 'DELETE') { await query(db, `UPDATE ${table} SET active=0 WHERE id=?`, [id]); return {id, active: false}; }
      if (table === 'budgets') {
        requireThat(old.category_id === values[1] && old.currency === values[2] && old.start_on === values[4] && old.end_on === values[5], 'Tạo ngân sách mới nếu đổi danh mục, kỳ hoặc tiền tệ');
        await query(db, 'UPDATE budgets SET name=?,category_id=?,currency=?,limit_minor=?,start_on=?,end_on=?,threshold=? WHERE id=?', [...values, id]);
      } else {
        requireThat(old.currency === values[1], 'Không đổi tiền tệ của mục tiêu');
        await query(db, 'UPDATE goals SET name=?,target_minor=?,deadline=? WHERE id=?', [values[0], values[2], values[3], id]);
      }
      return {id};
    });
  }
  if (route === '/goals' && method === 'POST') {
    const row = await query(pool, 'INSERT INTO goals(user_id,name,currency,target_minor,deadline) VALUES(?,?,?,?,?)', [u.id, ...goalValues(p)]);
    return {status: 201, data: {id: row.insertId}};
  }
  if (route === '/goals' && method === 'GET') {
    const items = await query(pool, 'SELECT * FROM goals WHERE user_id=?', [u.id]);
    return items.map(g => ({...g, progress_percent: Math.round(Number(g.saved_minor) * 10000 / Number(g.target_minor)) / 100}));
  }
  match = /^\/goals\/([1-9]\d*)\/contributions$/.exec(route);
  if (match && method === 'POST') {
    fields(p, ['amount']); const id = integer(Number(match[1]));
    return transaction(pool, async db => {
      const goal = await owned(db, 'goals', id, u.id); requireThat(goal.active, 'Mục tiêu đã kết thúc');
      const amount = money(p.amount, goal.currency), saved = safe(BigInt(goal.saved_minor) + BigInt(amount));
      await query(db, 'INSERT INTO goal_contributions(goal_id,amount_minor,created_on) VALUES(?,?,?)', [id, amount, today()]);
      await query(db, 'UPDATE goals SET saved_minor=? WHERE id=?', [saved, id]);
      return {status: 201, data: {id, saved_minor: saved}};
    });
  }
});
