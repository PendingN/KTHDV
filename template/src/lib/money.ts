import type { Currency, Minor } from "./contracts";

export const scales = { VND: 0, USD: 2, EUR: 2, JPY: 0 } as const;
export const currencies = Object.keys(scales) as Currency[];
export function amountInput(value: Minor, currency: Currency): string {
  const minor = BigInt(value),
    sign = minor < BigInt(0) ? "-" : "",
    absolute = minor < BigInt(0) ? -minor : minor;
  const scale = scales[currency],
    divisor = BigInt(10) ** BigInt(scale);
  return (
    sign +
    String(absolute / divisor) +
    (scale ? "." + String(absolute % divisor).padStart(scale, "0") : "")
  );
}
// Định dạng số thập phân dạng chuỗi (ví dụ kết quả quy đổi "2586940" hoặc "100.00"): 2.586.940 hoặc 100,00.
export function formatDecimal(value: string, currency: Currency): string {
  const scale = scales[currency];
  const [whole, fraction = ""] = value.split(".");
  return (
    BigInt(whole).toLocaleString("vi-VN") +
    (scale ? "," + fraction.padEnd(scale, "0") : "")
  );
}
export function formatMoney(value: Minor, currency: Currency): string {
  const [whole, fraction] = amountInput(value, currency).split(".");
  const negativeZero = whole === "-0";
  return (
    (negativeZero ? "-" : "") +
    BigInt(whole).toLocaleString("vi-VN") +
    (fraction ? "," + fraction : "") +
    " " +
    currency
  );
}
export function today() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}
export function monthRange() {
  const end = today();
  return { start: end.slice(0, 8) + "01", end };
}
export function previousRange(start: string, end: string) {
  const first = new Date(start + "T00:00:00Z"),
    last = new Date(end + "T00:00:00Z");
  const days = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;
  return {
    start: new Date(first.getTime() - days * 86400000)
      .toISOString()
      .slice(0, 10),
    end: new Date(first.getTime() - 86400000).toISOString().slice(0, 10),
  };
}
