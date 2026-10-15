import { query, records, safe } from '../common.js';

export async function usage(pool, user) {
  const budgets = await query(pool, 'SELECT * FROM budgets WHERE user_id=?', [user]);
  const totalsByPeriod = new Map();

  for (const budget of budgets) {
    const period = `${budget.start_on}:${budget.end_on}`;
    if (!totalsByPeriod.has(period)) {
      const items = await records(user, budget.start_on, budget.end_on);
      const totals = new Map();
      for (const item of items) {
        if (item.kind !== 'expense') continue;
        const key = `${item.category_id}:${item.currency}`;
        // Bút toán đảo có số tiền âm và phải được cộng vào cùng tổng.
        totals.set(key, (totals.get(key) ?? 0n) + BigInt(item.amount_minor));
      }
      totalsByPeriod.set(period, totals);
    }

    const key = `${budget.category_id}:${budget.currency}`;
    budget.spent_minor = safe(totalsByPeriod.get(period).get(key) ?? 0n);
    budget.used_percent =
      Math.round((budget.spent_minor * 10000) / Number(budget.limit_minor)) / 100;
  }
  return budgets;
}
