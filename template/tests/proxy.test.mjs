import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const origin = "http://127.0.0.1:3011";
const upstreams = [],
  received = [];
let next,
  logs = "";
before(async () => {
  for (let i = 0; i < 6; i++) {
    const server = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      received.push({
        service: i,
        url: req.url,
        headers: req.headers,
        body,
        method: req.method,
      });
      res.setHeader("Content-Type", "application/json");
      if (req.url === "/auth/login")
        return res.end(
          JSON.stringify({
            access_token: "private-test-token",
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          }),
        );
      if (
        req.url === "/auth/me" &&
        req.headers.authorization !== "Bearer private-test-token"
      ) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ detail: "Phiên hết hạn" }));
      }
      if (req.url === "/auth/me")
        return res.end(
          JSON.stringify({
            id: 1,
            name: "Test",
            email: "test@example.test",
            role: "user",
            active: 1,
          }),
        );
      if (req.url === "/auth/logout")
        return res.end(JSON.stringify({ message: "Đã đăng xuất" }));
      if (req.url === "/reports.csv?start=2026-01-01&end=2026-01-31") {
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="report.csv"',
        );
        return res.end("currency,income\nVND,1000\n");
      }
      if (req.url === "/wallets/9") {
        res.statusCode = 403;
        return res.end(JSON.stringify({ detail: "Không được phép" }));
      }
      res.end(JSON.stringify({ ok: true, url: req.url }));
    });
    server.listen(18101 + i, "127.0.0.1");
    await once(server, "listening");
    upstreams.push(server);
  }
  next = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3011",
    ],
    {
      cwd: root,
      env: { ...process.env, PORT_BASE: "18101", NEXT_TELEMETRY_DISABLED: "1" },
      windowsHide: true,
    },
  );
  next.stdout.on("data", (chunk) => {
    logs += chunk;
  });
  next.stderr.on("data", (chunk) => {
    logs += chunk;
  });
  for (let i = 0; i < 100; i++) {
    if (next.exitCode !== null) throw new Error(logs);
    try {
      const res = await fetch(origin + "/api/unknown/test");
      if (res.status === 404) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("Next.js did not start: " + logs);
});
after(async () => {
  if (next && next.exitCode === null) {
    const stopped = once(next, "exit");
    if (process.platform === "win32") {
      try {
        execFileSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } catch {}
    } else next.kill("SIGTERM");
    await stopped;
  }
  for (const server of upstreams) {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
const session = { Cookie: "kthdv_session=private-test-token" };
const post = (body = {}) => ({
  method: "POST",
  headers: { ...session, Origin: origin, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
test("Login sets HttpOnly cookie without returning bearer token", async () => {
  const response = await fetch(
    origin + "/api/identity/auth/login",
    post({ email: "test@example.test", password: "password" }),
  );
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie");
  assert.match(cookie, /kthdv_session=private-test-token/);
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=lax/i);
  assert.match(cookie, /Expires=/i);
  assert.equal((await response.json()).access_token, undefined);
});
test("Proxy forwards method, query, body and idempotency but strips internal credentials", async () => {
  const request = post({ wallet_id: 1, amount: "123.45" });
  request.headers["Idempotency-Key"] = "stable-key";
  request.headers["X-Service-Key"] = "never-forward";
  request.headers.Authorization = "Bearer attacker-token";
  const response = await fetch(
    origin + "/api/ledger/transactions?check=1",
    request,
  );
  assert.equal(response.status, 200);
  const upstream = received.at(-1);
  assert.equal(upstream.service, 1);
  assert.equal(upstream.method, "POST");
  assert.equal(upstream.url, "/transactions?check=1");
  assert.equal(upstream.headers.authorization, "Bearer private-test-token");
  assert.equal(upstream.headers["x-service-key"], undefined);
  assert.equal(upstream.headers["idempotency-key"], "stable-key");
  assert.deepEqual(JSON.parse(upstream.body), {
    wallet_id: 1,
    amount: "123.45",
  });
});
test("Blocks anonymous, cross-origin, administrative and internal operations", async () => {
  assert.equal((await fetch(origin + "/api/ledger/wallets")).status, 401);
  const bad = post();
  bad.headers.Origin = "http://evil.test";
  assert.equal(
    (await fetch(origin + "/api/identity/auth/login", bad)).status,
    403,
  );
  for (const route of [
    "/api/ledger/admin/data",
    "/api/ledger/internal/dispatch",
    "/api/fx/rates",
    "/api/__proto__/users",
  ])
    assert.equal((await fetch(origin + route, post())).status, 404);
  assert.equal(
    (
      await fetch(origin + "/api/identity/users", {
        ...post(),
        body: "x".repeat(65537),
      })
    ).status,
    413,
  );
});
test("401 clears session, 403 preserves it, logout clears it", async () => {
  const expired = await fetch(origin + "/api/identity/auth/me", {
    headers: { Cookie: "kthdv_session=expired" },
  });
  assert.equal(expired.status, 401);
  assert.match(expired.headers.get("set-cookie"), /Max-Age=0/i);
  const forbidden = await fetch(origin + "/api/ledger/wallets/9", {
    method: "PATCH",
    headers: { ...session, Origin: origin },
  });
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("set-cookie"), null);
  const logout = await fetch(origin + "/api/identity/auth/logout", post());
  assert.equal(logout.status, 200);
  assert.match(logout.headers.get("set-cookie"), /Max-Age=0/i);
});
test("CSV response keeps content and download headers", async () => {
  const response = await fetch(
    origin + "/api/reporting/reports.csv?start=2026-01-01&end=2026-01-31",
    { headers: session },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /text\/csv/);
  assert.match(response.headers.get("content-disposition"), /report.csv/);
  assert.match(await response.text(), /VND,1000/);
});
test("Unsupported product pages return 404", async () => {
  for (const route of ["cards", "crypto", "investments", "support"])
    assert.equal(
      (await fetch(origin + "/" + route, { headers: session })).status,
      404,
    );
});
test("Offline service returns actionable error", async () => {
  upstreams[4].closeAllConnections();
  await new Promise((resolve) => upstreams[4].close(resolve));
  const response = await fetch(origin + "/api/fx/rates", { headers: session });
  assert.equal(response.status, 502);
  assert.match((await response.json()).detail, /Không kết nối/);
});
