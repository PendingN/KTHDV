import "server-only";
import { cookies } from "next/headers";
import { serviceUrl, sessionCookie } from "./backend";
import type { User } from "./contracts";

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  const result = await fetch(serviceUrl("identity") + "/auth/me", {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (result.status === 401) return null;
  if (!result.ok)
    throw new Error("Không xác minh được phiên đăng nhập. Hãy thử lại.");
  return result.json();
}
