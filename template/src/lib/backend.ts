export const services = [
  "identity",
  "ledger",
  "planning",
  "recurring",
  "fx",
  "reporting",
] as const;
export const sessionCookie = "kthdv_session";
export function serviceUrl(name: string) {
  const index = services.indexOf(name as (typeof services)[number]);
  if (index < 0) throw new Error("Service không hợp lệ");
  return "http://127.0.0.1:" + (Number(process.env.PORT_BASE || 8001) + index);
}
const routes: Record<string, [RegExp, string[]][]> = {
  identity: [
    [/^\/users$/, ["POST"]],
    [/^\/auth\/login$/, ["POST"]],
    [/^\/auth\/me$/, ["GET"]],
    [/^\/auth\/logout$/, ["POST"]],
  ],
  ledger: [
    [/^\/(wallets|categories)$/, ["GET", "POST"]],
    [/^\/(wallets|categories)\/[1-9]\d*$/, ["PATCH"]],
    [/^\/transactions$/, ["GET", "POST"]],
    [/^\/transactions\/[1-9]\d*\/(reverse|adjust)$/, ["POST"]],
    [/^\/transfers$/, ["POST"]],
  ],
  planning: [
    [/^\/(budgets|goals)$/, ["GET", "POST"]],
    [/^\/(budgets|goals)\/[1-9]\d*$/, ["PUT", "DELETE"]],
    [/^\/goals\/[1-9]\d*\/contributions$/, ["POST"]],
    [/^\/budgets\/evaluate$/, ["POST"]],
  ],
  recurring: [
    [/^\/subscriptions$/, ["GET", "POST"]],
    [/^\/subscriptions\/[1-9]\d*$/, ["PUT", "DELETE"]],
    [/^\/subscriptions\/[1-9]\d*\/paid$/, ["POST"]],
    [/^\/reminders\/check$/, ["POST"]],
    [/^\/(notifications|suggestions)$/, ["GET"]],
    [/^\/notifications\/[1-9]\d*\/read$/, ["PATCH"]],
  ],
  fx: [
    [/^\/rates$/, ["GET"]],
    [/^\/convert$/, ["POST"]],
  ],
  reporting: [
    [/^\/(reports|dashboard|compare|reports\.csv)$/, ["GET"]],
    [/^\/reports\/requests$/, ["POST"]],
  ],
};
export function allowed(service: string, route: string, method: string) {
  return (
    Object.hasOwn(routes, service) &&
    routes[service].some(
      ([pattern, methods]) => pattern.test(route) && methods.includes(method),
    )
  );
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  return (
    origin === url.protocol + "//" + host &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  );
}
export function cookieOptions(expiresAt?: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    path: "/",
    ...(expiresAt ? { expires: new Date(expiresAt * 1000) } : { maxAge: 0 }),
  };
}
