const assert = require("node:assert/strict");
const { once } = require("node:events");
const http = require("node:http");
const { test, after } = require("node:test");

let upstream;
let admin;

test("Node admin serves the page and proxies the selected service", async () => {
  process.env.PORT_BASE = "18001";
  process.env.ADMIN_PORT = "0";
  upstream = http.createServer((request, response) => {
    assert.equal(request.headers.authorization, "Bearer test-token");
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ method: request.method, url: request.url, body }));
    });
  });
  upstream.listen(18001, "127.0.0.1");
  await once(upstream, "listening");

  ({ server: admin } = await import("./main.js?test=" + Date.now()));
  if (!admin.listening) await once(admin, "listening");
  const origin = `http://127.0.0.1:${admin.address().port}`;

  const page = await fetch(`${origin}/admin`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /KTHDV/);

  const result = await fetch(`${origin}/api/identity/health?check=1`, {
    headers: { authorization: "Bearer test-token" },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { method: "GET", url: "/health?check=1", body: "" });
});

after(() => {
  admin?.close();
  upstream?.close();
});
