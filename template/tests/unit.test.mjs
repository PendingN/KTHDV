import assert from "node:assert/strict";
import { test } from "node:test";
import { amountInput, formatMoney, previousRange } from "../src/lib/money.ts";
import { allowed, cookieOptions, sameOrigin } from "../src/lib/backend.ts";

test("Money preserves decimal scales, signs and large integer strings", () => {
  assert.equal(formatMoney("1234567", "VND"), "1.234.567 VND");
  assert.equal(amountInput("1050", "USD"), "10.50");
  assert.equal(formatMoney(-1, "USD"), "-0,01 USD");
  assert.equal(formatMoney("-1050", "EUR"), "-10,50 EUR");
  assert.equal(formatMoney("1050", "JPY"), "1.050 JPY");
  assert.equal(amountInput("900719925474099300", "USD"), "9007199254740993.00");
  assert.deepEqual(previousRange("2024-03-01", "2024-03-03"), {
    start: "2024-02-27",
    end: "2024-02-29",
  });
});
test("Only user routes and matching methods are allowed", () => {
  for (const [service, route, method] of [
    ["identity", "/users", "POST"],
    ["ledger", "/transactions/12/adjust", "POST"],
    ["planning", "/goals/2/contributions", "POST"],
    ["recurring", "/notifications/3/read", "PATCH"],
    ["fx", "/convert", "POST"],
    ["reporting", "/reports.csv", "GET"],
  ])
    assert.ok(allowed(service, route, method));
  for (const [service, route, method] of [
    ["identity", "/users/1", "PATCH"],
    ["ledger", "/internal/dispatch", "POST"],
    ["ledger", "/admin/data", "GET"],
    ["fx", "/rates", "POST"],
    ["recurring", "/subscriptions/0", "DELETE"],
    ["planning", "/goals/../internal/evaluate/1", "POST"],
    ["__proto__", "/users", "POST"],
    ["constructor", "/wallets", "GET"],
    ["reporting", "/reports.csv.exe", "GET"],
  ])
    assert.equal(allowed(service, route, method), false);
});
test("Cookie and origin policy protect sessions", () => {
  const options = cookieOptions(2000000000);
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax");
  assert.equal(options.path, "/");
  assert.equal(options.expires.getTime(), 2000000000000);
  assert.equal(cookieOptions().maxAge, 0);
  assert.ok(
    sameOrigin(
      new Request("http://127.0.0.1:3000/api/identity/auth/login", {
        headers: { Origin: "http://127.0.0.1:3000" },
      }),
    ),
  );
  assert.equal(
    sameOrigin(
      new Request("http://127.0.0.1:3000/api/identity/auth/login", {
        headers: { Origin: "http://evil.test" },
      }),
    ),
    false,
  );
  assert.equal(
    sameOrigin(new Request("http://127.0.0.1:3000/api/identity/auth/login")),
    false,
  );
  assert.ok(
    sameOrigin(
      new Request("http://localhost:3000/api/identity/auth/login", {
        headers: { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" },
      }),
    ),
  );
});
