// Run with a separately installed Playwright; no production dependency is needed.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE ||
    "../../tmp/browser-tools/node_modules/playwright/index.mjs"
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const origin = "http://127.0.0.1:3000",
  tag = Date.now(),
  password = randomUUID() + "aA1!",
  errors = [],
  checks = [];
const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  page = await context.newPage();
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const artifactDir = new URL("../../tmp/", import.meta.url);
await mkdir(artifactDir, { recursive: true });
const check = (name) => {
  checks.push(name);
  console.log("PASS: " + name);
};
async function goto(route) {
  await page.goto(origin + route);
  await page.waitForLoadState("networkidle");
}
async function select(label, option) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function fill(label, value) {
  await page.getByLabel(label, { exact: true }).fill(value);
}
async function save() {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Lưu", exact: true }).click();
  await dialog.waitFor({ state: "hidden", timeout: 15000 });
  await page.waitForLoadState("networkidle");
}
async function visible(text) {
  await page
    .getByText(text, { exact: false })
    .first()
    .waitFor({ timeout: 15000 });
}
async function data(route, options = {}) {
  const response = await context.request.fetch(origin + "/api/" + route, {
    headers: { Origin: origin },
    ...options,
  });
  const body = await response.json();
  assert.ok(response.ok(), JSON.stringify(body));
  return body;
}
try {
  await goto("/accounts");
  assert.match(page.url(), /sign-in/);
  check("anonymous pages redirect to login");
  await page.getByRole("link", { name: "Đăng ký", exact: true }).click();
  await fill("Họ và tên", "QA Frontend " + tag);
  await fill("Email", "qa.frontend." + tag + "@example.test");
  await fill("Mật khẩu", password);
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await page.waitForURL("**/dashboard", { timeout: 20000 });
  await page.getByRole("heading", { name: "Tổng quan", exact: true }).waitFor();
  const cookies = await context.cookies();
  assert.ok(
    cookies.find(
      (c) => c.name === "kthdv_session" && c.httpOnly && c.sameSite === "Lax",
    ),
  );
  check("register, login and HttpOnly session");
  await goto("/accounts");
  await page.getByRole("button", { name: "Thêm ví", exact: true }).click();
  await fill("Tên", "Ví chính QA");
  await save();
  await visible("Ví chính QA");
  await page.getByRole("button", { name: "Thêm ví", exact: true }).click();
  await fill("Tên", "Ví phụ QA");
  await save();
  for (const [name, kind] of [
    ["Chi QA", "Chi tiêu"],
    ["Thu QA", "Thu nhập"],
  ]) {
    await page
      .getByRole("button", { name: "Thêm danh mục", exact: true })
      .click();
    await fill("Tên", name);
    await select("Loại danh mục", kind);
    await save();
    await visible(name);
  }
  check("create wallets and income/expense categories");
  await goto("/transactions");
  await page
    .getByRole("button", { name: "Ghi thu / chi", exact: true })
    .click();
  await select("Loại giao dịch", "Thu nhập");
  await select("Danh mục", "Thu QA");
  await fill("Số tiền (VND)", "1000000");
  await fill("Ghi chú", "Thu nhập QA");
  await save();
  await visible("Thu nhập QA");
  await page
    .getByRole("button", { name: "Ghi thu / chi", exact: true })
    .click();
  await fill("Số tiền (VND)", "100000");
  await fill("Ghi chú", "Bữa trưa QA");
  await save();
  await visible("Bữa trưa QA");
  let row = page.getByRole("row").filter({ hasText: "Bữa trưa QA" });
  await row.getByRole("button", { name: "Điều chỉnh", exact: true }).click();
  await fill("Số tiền (VND)", "120000");
  await fill("Ghi chú", "Bữa trưa điều chỉnh QA");
  await save();
  await visible("Bữa trưa điều chỉnh QA");
  row = page.getByRole("row").filter({ hasText: "Bữa trưa điều chỉnh QA" });
  await row.getByRole("button", { name: "Hủy giao dịch", exact: true }).click();
  await page.waitForLoadState("networkidle");
  await page.reload();
  await page.waitForLoadState("networkidle");
  await visible(
    "Bút toán đảo của #" +
      (await data("ledger/transactions")).find(
        (t) => t.note === "Bữa trưa điều chỉnh QA",
      ).id,
  );
  check("create, adjust, reverse and reload transactions");
  await fill("Từ ngày", "2000-01-01");
  await fill("Đến ngày", "2000-01-31");
  await page.getByRole("button", { name: "Áp dụng", exact: true }).click();
  await visible("Chưa có dữ liệu.");
  check("date filter submits and updates transaction list");
  await goto("/transfers");
  await page
    .getByRole("button", { name: "Chuyển giữa hai ví", exact: true })
    .click();
  await fill("Số tiền", "250000");
  await save();
  await visible("Đã chuyển tiền. Số dư các ví đã được cập nhật.");
  let wallets = await data("ledger/wallets");
  assert.equal(
    Number(wallets.find((w) => w.name === "Ví chính QA").balance_minor),
    750000,
  );
  assert.equal(
    Number(wallets.find((w) => w.name === "Ví phụ QA").balance_minor),
    250000,
  );
  check("transfer updates both wallet balances");
  await goto("/budgets");
  await page
    .getByRole("button", { name: "Thêm ngân sách", exact: true })
    .click();
  await fill("Tên ngân sách", "Ngân sách QA");
  await fill("Hạn mức", "100000");
  await save();
  await visible("Ngân sách QA");
  await page
    .getByRole("button", { name: "Sửa ngân sách", exact: true })
    .click();
  await fill("Hạn mức", "150000");
  await save();
  await page
    .getByRole("button", { name: "Thêm mục tiêu", exact: true })
    .click();
  await fill("Tên mục tiêu", "Mục tiêu QA");
  await fill("Số tiền mục tiêu", "500000");
  await save();
  await visible("Mục tiêu QA");
  await page.getByRole("button", { name: "Góp mục tiêu", exact: true }).click();
  await fill("Số tiền góp (VND)", "50000");
  await save();
  assert.equal(Number((await data("planning/goals"))[0].saved_minor), 50000);
  assert.deepEqual(await data("ledger/wallets"), wallets);
  check("budgets, goals and contributions without wallet debit");
  await goto("/subscriptions");
  await page
    .getByRole("button", { name: "Thêm khoản định kỳ", exact: true })
    .click();
  await fill("Tên khoản định kỳ", "Internet QA");
  await fill("Số tiền", "200000");
  await save();
  await visible("Internet QA");
  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await fill("Số tiền", "220000");
  await save();
  await page
    .getByRole("button", { name: "Kiểm tra nhắc hạn", exact: true })
    .click();
  await visible("Đã kiểm tra nhắc hạn.");
  await page
    .getByRole("button", { name: "Đã thanh toán", exact: true })
    .click();
  await page.waitForLoadState("networkidle");
  assert.deepEqual(await data("ledger/wallets"), wallets);
  await page.getByRole("link", { name: "Ghi khoản chi", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  assert.equal(
    await page.getByLabel("Ghi chú", { exact: true }).inputValue(),
    "Internet QA",
  );
  assert.equal(
    await page.getByLabel("Số tiền (VND)", { exact: true }).inputValue(),
    "220000",
  );
  await page.getByRole("button", { name: "Hủy", exact: true }).click();
  check("recurring payment tracking and expense draft");
  await goto("/notifications");
  await page
    .getByRole("button", { name: "Đánh dấu đã đọc", exact: true })
    .first()
    .click();
  await page.waitForLoadState("networkidle");
  assert.ok((await data("recurring/notifications")).some((n) => n.is_read));
  check("notification read state persists");
  await goto("/exchange");
  await select("Từ tiền tệ", "VND");
  await fill("Số tiền", "1000");
  await page.getByRole("button", { name: "Quy đổi", exact: true }).click();
  await visible("1000 VND");
  await select("Từ tiền tệ", "EUR");
  await fill("Số tiền", "1.001");
  await page.getByRole("button", { name: "Quy đổi", exact: true }).click();
  await page.getByRole("alert").waitFor();
  check("currency conversion and invalid precision error");
  await goto("/analytics");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Tải CSV", exact: true }).click();
  const download = await downloadEvent;
  assert.match(download.suggestedFilename(), /thu-chi/);
  check("report, comparison and CSV download");
  await goto("/dashboard");
  await page.screenshot({
    path: fileURLToPath(new URL("frontend-desktop.png", artifactDir)),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Đổi giao diện sáng / tối", exact: true })
    .click();
  assert.ok(
    await page.evaluate(() =>
      document.documentElement.classList.contains("dark"),
    ),
  );
  await page.screenshot({
    path: fileURLToPath(new URL("frontend-dark.png", artifactDir)),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Đổi giao diện sáng / tối", exact: true })
    .click();
  check("dark and light theme toggle");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForLoadState("networkidle");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  await page.getByRole("button", { name: "Mở menu", exact: true }).click();
  await page.getByRole("link", { name: "Ví & danh mục", exact: true }).click();
  await visible("Ví & danh mục");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await visible("Ví chính QA");
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: fileURLToPath(new URL("frontend-mobile.png", artifactDir)),
    fullPage: true,
  });
  check("mobile layout and sidebar navigation");
  const second = await browser.newContext(),
    secondPage = await second.newPage();
  await secondPage.goto(origin + "/sign-up");
  await secondPage
    .getByLabel("Họ và tên", { exact: true })
    .fill("QA Isolation " + tag);
  await secondPage
    .getByLabel("Email", { exact: true })
    .fill("qa.isolation." + tag + "@example.test");
  await secondPage.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await secondPage
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await secondPage.waitForURL("**/dashboard");
  await secondPage.waitForLoadState("networkidle");
  const ownWallets = await second.request.get(origin + "/api/ledger/wallets");
  assert.deepEqual(await ownWallets.json(), []);
  for (const route of [
    "planning/budgets",
    "planning/goals",
    "recurring/subscriptions",
    "recurring/notifications",
  ]) {
    const result = await second.request.get(origin + "/api/" + route);
    assert.deepEqual(await result.json(), []);
  }
  const ownTx = await second.request.get(origin + "/api/ledger/transactions");
  assert.deepEqual(await ownTx.json(), []);
  const denied = await second.request.patch(
    origin + "/api/ledger/wallets/" + wallets[0].id,
    {
      headers: { Origin: origin },
      data: { name: "Unauthorized", active: true },
    },
  );
  assert.equal(denied.status(), 404);
  check("two-account data isolation and unauthorized mutation denial");
  await secondPage
    .getByRole("button", { name: "Đăng xuất", exact: true })
    .click();
  await secondPage.waitForURL("**/sign-in");
  assert.equal(
    (await second.request.get(origin + "/api/ledger/wallets")).status(),
    401,
  );
  await second.close();
  check("logout revokes server session");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto("/settings");
  await visible("QA Frontend " + tag);
  const invalid = await context.request.post(
    origin + "/api/ledger/transactions",
    { headers: { Origin: origin }, data: { amount: "bad" } },
  );
  assert.equal(invalid.status(), 422);
  await context.addCookies([
    { name: "kthdv_session", value: "expired-test-token", url: origin },
  ]);
  await goto("/accounts");
  assert.match(page.url(), /sign-in/);
  check("profile, invalid input and expired-session redirect");
  await fill("Email", "qa.frontend." + tag + "@example.test");
  await fill("Mật khẩu", "wrong-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByRole("alert").waitFor();
  await fill("Mật khẩu", password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await goto("/accounts");
  await page.getByRole("button", { name: "Thêm ví", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  check("wrong password, regular login and keyboard dialog navigation");
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL("**/sign-in");
  assert.deepEqual(errors, []);
  check("no browser runtime errors");
  await writeFile(
    new URL("frontend-browser-results.json", artifactDir),
    JSON.stringify({ checks, errors, accountTag: tag }, null, 2),
  );
} catch (error) {
  await page
    .screenshot({
      path: fileURLToPath(new URL("frontend-failure.png", artifactDir)),
      fullPage: true,
    })
    .catch(() => {});
  console.error("FAILED: " + error.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
}
