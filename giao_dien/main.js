import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT_BASE = Number(process.env.PORT_BASE || 8001);
const PORT = Number(process.env.ADMIN_PORT || 8090);
const SERVICES = ["identity", "ledger", "planning", "recurring", "fx", "reporting"];
const MAX_BODY = 64 * 1024;

function servicePort(name) {
  const index = SERVICES.indexOf(name);
  if (index < 0) return null;
  return PORT_BASE + index;
}

async function bodyOf(request) {
  if (!request.headers["content-length"] && request.headers["transfer-encoding"] === undefined) return undefined;
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error("JSON quá lớn"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(response, status, value) {
  const payload = JSON.stringify(value);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(payload);
}

async function proxy(request, response, service, route, search) {
  const port = servicePort(service);
  if (!port) return sendJson(response, 404, { detail: "Service không hợp lệ" });
  try {
    const headers = {};
    for (const name of ["authorization", "content-type", "x-service-key", "accept"]) {
      if (request.headers[name]) headers[name] = request.headers[name];
    }
    const result = await fetch(`http://127.0.0.1:${port}${route}${search}`, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await bodyOf(request),
      signal: AbortSignal.timeout(15000),
    });
    const content = Buffer.from(await result.arrayBuffer());
    const outputHeaders = {};
    for (const name of ["content-type", "content-disposition", "location"]) {
      const value = result.headers.get(name);
      if (value) outputHeaders[name] = value;
    }
    response.writeHead(result.status, outputHeaders);
    response.end(content);
  } catch (error) {
    sendJson(response, error.status || 502, { detail: error.status ? error.message : "Service chưa chạy hoặc không phản hồi" });
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);
  if (request.method === "GET" && ["/", "/admin"].includes(url.pathname)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    const page = await readFile(path.join(ROOT, "admin.html"), "utf8");
    response.end(page.replace("<script>", "<script>globalThis.__KTHDV_NODE_ADMIN__=true;"));
    return;
  }
  const match = /^\/api\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (match) {
    await proxy(request, response, match[1], match[2] || "/", url.search);
    return;
  }
  sendJson(response, 404, { detail: "Không tìm thấy đường dẫn" });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Admin Node.js: http://127.0.0.1:${PORT}/admin`);
});

function stop() {
  server.close(() => process.exit(0));
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);

export { server, servicePort };
