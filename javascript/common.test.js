import assert from 'node:assert/strict';
import { test } from 'node:test';
import { currency, date, fields, integer, money, text, transaction } from './common.js';

test('money preserves each currency scale and rejects invalid precision or range', () => {
  assert.equal(money('1000000000000', 'USD'), 100000000000000);
  assert.equal(money('10.50', 'USD'), 1050);
  assert.equal(money('10.00', 'JPY'), 10);
  assert.equal(money('10', 'VND'), 10);
  for (const value of ['0', '-1', '0.001', '1000000000001', 'NaN', '1e3']) {
    assert.throws(
      () => money(value, 'USD'),
      (error) => error.status === 422,
    );
  }
  assert.throws(() => money('10.5', 'VND'));
});

test('input validation rejects invalid dates, fields, IDs and currencies', () => {
  assert.equal(date('2024-02-29'), '2024-02-29');
  assert.equal(text('  Tiền nhà  '), 'Tiền nhà');
  assert.equal(currency(), 'VND');
  for (const invalid of ['2026-02-29', '2026-02-30', '2026-13-01', '1/2/2026']) {
    assert.throws(() => date(invalid));
  }
  for (const invalid of [0, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => integer(invalid));
  }
  assert.throws(() => currency('__proto__'));
  assert.throws(() => text('   '));
  assert.throws(() => fields([], []));
  assert.throws(() => fields({ name: 'A', admin: true }, ['name']));
  assert.throws(() => fields({}, ['name']));
  assert.doesNotThrow(() => fields({ name: 'A' }, ['name', 'note'], ['name']));
});

test('successful transactions commit before releasing the connection', async () => {
  const calls = [];
  const db = {
    beginTransaction: async () => calls.push('begin'),
    commit: async () => calls.push('commit'),
    rollback: async () => calls.push('rollback'),
    release: () => calls.push('release'),
  };
  const result = await transaction({ getConnection: async () => db }, async (connection) => {
    assert.equal(connection, db);
    calls.push('work');
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(calls, ['begin', 'work', 'commit', 'release']);
});

test('failed work or commit rolls back and releases the connection', async () => {
  for (const failAt of ['work', 'commit']) {
    const calls = [];
    const failure = new Error(failAt);
    const db = {
      beginTransaction: async () => calls.push('begin'),
      commit: async () => {
        calls.push('commit');
        if (failAt === 'commit') throw failure;
      },
      rollback: async () => calls.push('rollback'),
      release: () => calls.push('release'),
    };
    await assert.rejects(
      transaction({ getConnection: async () => db }, async () => {
        calls.push('work');
        if (failAt === 'work') throw failure;
      }),
      (error) => error === failure,
    );
    assert.deepEqual(calls.slice(-2), ['rollback', 'release']);
  }
});
