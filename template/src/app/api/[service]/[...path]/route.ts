import { NextRequest, NextResponse } from "next/server";
import {
  allowed,
  sameOrigin,
  serviceUrl,
  sessionCookie,
  cookieOptions,
} from "@/lib/backend";

export const runtime = "nodejs";
async function handle(
  request: NextRequest,
  context: { params: Promise<{ service: string; path: string[] }> },
) {
  const { service, path } = await context.params;
  const route = "/" + path.join("/");
  const json = (detail: string, status: number) =>
    NextResponse.json(
      { detail },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (!allowed(service, route, request.method))
    return json("Không tìm thấy API người dùng", 404);
  if (request.method !== "GET" && !sameOrigin(request))
    return json("Yêu cầu phải đến từ cùng trang", 403);
  const publicRoute =
    service === "identity" && ["/users", "/auth/login"].includes(route);
  const token = request.cookies.get(sessionCookie)?.value;
  if (!publicRoute && !token) return json("Cần đăng nhập", 401);
  try {
    const headers = new Headers({ Accept: "application/json" });
    if (token && !publicRoute) headers.set("Authorization", "Bearer " + token);
    let body: ArrayBuffer | undefined;
    if (request.method !== "GET") {
      if (Number(request.headers.get("content-length")) > 65536)
        return json("Dữ liệu quá lớn", 413);
      const reader = request.body?.getReader(),
        chunks: Uint8Array[] = [];
      let size = 0;
      if (reader)
        for (;;) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > 65536) {
            await reader.cancel();
            return json("Dữ liệu quá lớn", 413);
          }
          chunks.push(part.value);
        }
      if (size) {
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.length;
        }
        body = bytes.buffer;
        headers.set("Content-Type", "application/json");
      }
    }
    const key = request.headers.get("idempotency-key");
    if (
      service === "ledger" &&
      route === "/transactions" &&
      request.method === "POST" &&
      key
    )
      headers.set("Idempotency-Key", key);
    const upstream = await fetch(
      serviceUrl(service) + route + request.nextUrl.search,
      {
        method: request.method,
        headers,
        body,
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(15000),
      },
    );
    let response: NextResponse;
    if (service === "identity" && route === "/auth/login" && upstream.ok) {
      const session = (await upstream.json()) as {
        access_token: string;
        expires_at: number;
      };
      if (!session.access_token || !Number.isFinite(session.expires_at))
        return json("Phản hồi đăng nhập không hợp lệ", 502);
      response = NextResponse.json({ expires_at: session.expires_at });
      response.cookies.set(
        sessionCookie,
        session.access_token,
        cookieOptions(session.expires_at),
      );
    } else {
      response = new NextResponse(await upstream.arrayBuffer(), {
        status: upstream.status,
      });
      for (const name of ["content-type", "content-disposition"]) {
        const value = upstream.headers.get(name);
        if (value) response.headers.set(name, value);
      }
    }
    response.headers.set("Cache-Control", "no-store");
    if (
      (!publicRoute && upstream.status === 401) ||
      (service === "identity" && route === "/auth/logout" && upstream.ok)
    )
      response.cookies.set(sessionCookie, "", cookieOptions());
    return response;
  } catch {
    return json(
      request.method === "GET"
        ? "Không kết nối được dịch vụ. Hãy thử tải lại."
        : "Chưa xác nhận được kết quả. Hãy tải lại dữ liệu để kiểm tra trước khi gửi lại.",
      502,
    );
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
