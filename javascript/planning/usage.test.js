import assert from 'node:assert/strict';
import { test } from 'node:test';
import { usage } from './usage.js';

function budget(id, changes = {}) {
  return {
    id,
    category_id: 1,
    currency: 'VND',
    limit_minor: '1000',
    active: 1,
    start_on: '2026-10-01',
    end_on: '2026-10-31',
    ...changes,
  };
}

function ledger(t, items) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    const request = new URL(url);
    calls.push(request);
    const offset = Number(request.searchParams.get('offset'));
    return Response.json(items.slice(offset, offset + 500));
  });
  return calls;
}

test('budgets in the same period share one ledger read and keep independent totals', async (t) => {
  const calls = ledger(t, [
    { kind: 'expense', category_id: 1, currency: 'VND', amount_minor: '800' },
    { kind: 'expense', category_id: 1, currency: 'VND', amount_minor: '-300', reversal_of: 1 },
    { kind: 'expense', category_id: 2, currency: 'VND', amount_minor: '1200' },
    { kind: 'expense', category_id: 1, currency: 'USD', amount_minor: '1050' },
    { kind: 'income', category_id: 1, currency: 'VND', amount_minor: '9999' },
    { kind: 'transfer', category_id: null, currency: 'VND', amount_minor: '9999' },
  ]);
  const budgets = [
    budget(1),
    budget(2, { category_id: 2 }),
    budget(3, { currency: 'USD' }),
    budget(4, { category_id: 3 }),
    budget(5, { active: 0, limit_minor: '2000' }),
  ];
  const pool = { execute: t.mock.fn(async () => [budgets]) };
  const result = await usage(pool, 7);
  assert.deepEqual(
    result.map((b) => [b.id, b.spent_minor, b.used_percent]),
    [
      [1, 500, 50],
      [2, 1200, 120],
      [3, 1050, 105],
      [4, 0, 0],
      [5, 500, 25],
    ],
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, '/internal/transactions/7');
  assert.deepEqual(pool.execute.mock.calls[0].arguments[1], [7]);
});

test('different periods use their own date range and preserve budget order', async (t) => {
  const calls = ledger(t, []);
  const budgets = [budget(1), budget(2, { end_on: '2026-10-15' }), budget(3)];
  const result = await usage({ execute: async () => [budgets] }, 7);
  assert.deepEqual(
    result.map((b) => b.id),
    [1, 2, 3],
  );
  assert.deepEqual(
    calls.map((url) => url.searchParams.get('end')),
    ['2026-10-31', '2026-10-15'],
  );
});

test('shared totals include every page of the ledger', async (t) => {
  const calls = ledger(
    t,
    Array.from({ length: 501 }, () => ({
      kind: 'expense',
      category_id: 1,
      currency: 'VND',
      amount_minor: '1',
    })),
  );
  const result = await usage({ execute: async () => [[budget(1), budget(2)]] }, 7);
  assert.deepEqual(
    result.map((b) => b.spent_minor),
    [501, 501],
  );
  assert.deepEqual(
    calls.map((url) => url.searchParams.get('offset')),
    ['0', '500'],
  );
});

test('no budgets need no ledger request', async (t) => {
  const calls = ledger(t, []);
  assert.deepEqual(await usage({ execute: async () => [[]] }, 7), []);
  assert.equal(calls.length, 0);
});

test('large opposing amounts cancel exactly before the safe integer check', async (t) => {
  ledger(t, [
    { kind: 'expense', category_id: 1, currency: 'VND', amount_minor: '9007199254740993' },
    { kind: 'expense', category_id: 1, currency: 'VND', amount_minor: '-9007199254740992' },
  ]);
  const [result] = await usage({ execute: async () => [[budget(1)]] }, 7);
  assert.equal(result.spent_minor, 1);
});

test('overflow and an unavailable ledger are not reported as zero spending', async (t) => {
  ledger(t, [
    { kind: 'expense', category_id: 1, currency: 'VND', amount_minor: '9007199254740992' },
  ]);
  const pool = { execute: async () => [[budget(1)]] };
  await assert.rejects(usage(pool, 7), (error) => error.status === 422);
  t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  await assert.rejects(usage(pool, 7), (error) => error.status === 503);
});
