import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import mysql from 'mysql2/promise';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const names = ['identity', 'ledger', 'planning', 'recurring', 'fx', 'reporting'];
export const scales = { VND: 0, USD: 2, EUR: 2, JPY: 0 };
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
export function requireThat(ok, message, status = 422) {
  if (!ok) throw Object.assign(new Error(message), { status });
}
export function integer(value, min = 1, max = Number.MAX_SAFE_INTEGER) {
  requireThat(
    typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max,
    'Số nguyên không hợp lệ',
  );
  return value;
}
export function text(value, max = 120) {
  requireThat(
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max,
    'Nội dung không hợp lệ',
  );
  return value.trim();
}
export function currency(value = 'VND') {
  requireThat(value === 'VND', 'Chỉ hỗ trợ tiền Việt (VND)');
  return value;
}
export function date(value) {
  requireThat(
    typeof value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    'Ngày không hợp lệ',
  );
  return value;
}
export function fields(body, allowed, required = allowed) {
  requireThat(body && typeof body === 'object' && !Array.isArray(body), 'Cần JSON object');
  requireThat(
    Object.keys(body).every((key) => allowed.includes(key)) &&
      required.every((key) => Object.hasOwn(body, key)),
    'Thiếu trường hoặc có trường không được phép',
  );
}
export function safe(value) {
  const result = Number(value);
  requireThat(Number.isSafeInteger(result), 'Tổng tiền vượt giới hạn bản học tập');
  return result;
}
export function money(value, unit) {
  const s = String(value).trim();
  requireThat(/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s), 'Số tiền không hợp lệ');
  const [whole, fraction = ''] = s.split('.');
  const digits = scales[currency(unit)];
  requireThat(!/[1-9]/.test(fraction.slice(digits)), 'Số tiền có quá nhiều chữ số thập phân');
  const amount =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.slice(0, digits).padEnd(digits, '0') || '0');
  requireThat(
    amount > 0n && amount <= 1000000000000n * 10n ** BigInt(digits),
    'Số tiền phải dương và không quá 10^12',
  );
  return safe(amount);
}
export async function peer(name, method, route, token, body) {
  const base =
    process.env[name.toUpperCase() + '_URL'] ||
    `http://127.0.0.1:${Number(process.env.PORT_BASE || 8001) + names.indexOf(name)}`;
  let response;
  try {
    response = await fetch(base + route, {
      method,
      signal: AbortSignal.timeout(10000),
      headers: {
        ...(token
          ? { Authorization: 'Bearer ' + token }
          : { 'X-Service-Key': process.env.INTERNAL_KEY || '' }),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    requireThat(false, `Service ${name} không kết nối được`, 503);
  }
  const data = await response.json();
  requireThat(response.ok, data.detail || `Service ${name} báo lỗi`, response.status);
  return data;
}
export async function records(user, start, end) {
  const result = [];
  for (;;) {
    const page = await peer(
      'ledger',
      'GET',
      `/internal/transactions/${user}?start=${start}&end=${end}&offset=${result.length}`,
    );
    result.push(...page);
    if (page.length < 500) return result;
  }
}
export async function query(db, sql, args = []) {
  const [result] = await db.execute(sql, args);
  return result;
}
export async function transaction(pool, work) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const value = await work(db);
    await db.commit();
    return value;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
export async function owned(db, table, id, user) {
  const rows = await query(db, `SELECT * FROM ${table} WHERE id=? AND user_id=? FOR UPDATE`, [
    id,
    user,
  ]);
  requireThat(rows.length, 'Không tìm thấy dữ liệu thuộc người dùng', 404);
  return rows[0];
}
export async function start(name, handler) {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(root, 'javascript', name, 'service.json'), 'utf8'),
  );
  const file = path.join(root, 'config.local.json');
  const local = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
    : {};
  const config = {
    host: process.env.DB_HOST ?? local.host ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? local.port ?? 3306),
    user: process.env.DB_USER ?? local.user ?? 'root',
    password: process.env.DB_PASSWORD ?? local.password ?? '',
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    connectionLimit: 5,
  };
  const database = (process.env.DB_PREFIX ?? local.prefix ?? 'kthdv_') + name;
  requireThat(/^[a-zA-Z0-9_]{1,64}$/.test(database), 'Tên database không hợp lệ');
  const setup = await mysql.createConnection(config);
  try {
    await query(
      setup,
      `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await setup.end();
  }
  const pool = mysql.createPool({ ...config, database });
  for (const sql of metadata.schema.split(';'))
    if (sql.trim()) await query(pool, sql + ' ENGINE=InnoDB');
  if (process.argv.includes('--setup')) {
    await pool.end();
    return;
  }
  const port = Number(process.env.PORT_BASE || 8001) + names.indexOf(name);
  const server = http.createServer(async (request, response) => {
    // Trang người dùng (/app) chạy ở cổng khác với API nên cần CORS cho localhost.
    const origin = request.headers.origin || '';
    const cors = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)
      ? {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
          Vary: 'Origin',
        }
      : {};
    function send(data, status = 200, type = 'application/json; charset=utf-8') {
      response.writeHead(status, { 'Content-Type': type, ...cors });
      response.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
    }
    try {
      const url = new URL(request.url, 'http://localhost');
      const route = url.pathname;
      const method = request.method;
      if (method === 'OPTIONS') {
        response.writeHead(204, cors);
        return response.end();
      }
      if (method === 'GET' && ['/', '/admin'].includes(route))
        return send(
          fs.readFileSync(path.join(root, 'giao_dien', 'admin.html'), 'utf8'),
          200,
          'text/html; charset=utf-8',
        );
      if (method === 'GET' && route === '/app')
        return send(
          fs.readFileSync(path.join(root, 'giao_dien', 'user.html'), 'utf8'),
          200,
          'text/html; charset=utf-8',
        );
      if (method === 'GET' && route === '/health') return send({ service: name, status: 'ok' });
      if (method === 'GET' && route === '/openapi.json')
        return send({
          openapi: '3.0.3',
          info: { title: name + ' Service', version: '0.1' },
          paths: {},
        });
      if (method === 'GET' && route === '/docs')
        return send({ service: name, actions: metadata.actions });
      let body = {};
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        requireThat(size <= 65536, 'JSON quá lớn', 413);
        chunks.push(chunk);
      }
      if (size) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString());
        } catch {
          requireThat(false, 'JSON không hợp lệ', 422);
        }
      }
      if (method === 'POST' && route === '/auth/login')
        return send(await peer('identity', method, route, undefined, body));
      const internal = route.startsWith('/internal/');
      let user;
      if (internal) {
        const expected = Buffer.from(process.env.INTERNAL_KEY || '');
        const actual = Buffer.from(request.headers['x-service-key'] || '');
        requireThat(
          expected.length > 0 &&
            expected.length === actual.length &&
            timingSafeEqual(expected, actual),
          'Chỉ dành cho giao tiếp nội bộ',
          403,
        );
      } else {
        const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization || '');
        requireThat(match, 'Cần đăng nhập', 401);
        user = await peer('identity', 'GET', '/auth/me', match[1]);
        user.token = match[1];
      }
      if (method === 'GET' && route === '/auth/me') {
        const { token, ...publicUser } = user;
        return send(publicUser);
      }
      if (method === 'POST' && route === '/auth/logout')
        return send(await peer('identity', method, route, user.token));
      if (route.startsWith('/admin/')) {
        requireThat(user.role === 'admin', 'Cần quyền admin', 403);
        if (method === 'GET' && route === '/admin/actions')
          return send({
            service: name,
            actions: metadata.actions,
            services: names.map((n, i) => ({
              name: n,
              url: `http://127.0.0.1:${Number(process.env.PORT_BASE || 8001) + i}/admin`,
            })),
          });
        if (method === 'GET' && route === '/admin/data') {
          const data = {};
          for (const [label, sql] of Object.entries(metadata.tables))
            data[label] = await query(pool, sql);
          return send(data);
        }
      }
      const result = await handler({ route, method, body, user, pool, url });
      requireThat(result !== undefined, 'Không tìm thấy API', 404);
      send(result.data ?? result, result.status ?? 200);
    } catch (error) {
      const conflict = ['ER_DUP_ENTRY', 'ER_NO_REFERENCED_ROW_2'].includes(error.code);
      const status = error.status || (conflict ? 409 : 500);
      const detail = error.status
        ? error.message
        : conflict
          ? 'Dữ liệu trùng hoặc vi phạm ràng buộc'
          : 'Lỗi xử lý dữ liệu';
      if (!error.status && !conflict) console.error(error);
      send({ detail }, status);
    }
  });
  server.listen(port, '127.0.0.1', () => console.log(`${name}: ${port}`));
  server.on('error', (error) => {
    console.error(error.message);
    process.exit(1);
  });
}
