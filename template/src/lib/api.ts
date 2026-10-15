export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  service: string,
  route: string,
  options: {
    method?: string;
    body?: unknown;
    key?: string;
    signal?: AbortSignal;
    blob?: boolean;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch("/api/" + service + route, {
      method: options.method || "GET",
      headers: {
        ...(options.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...(options.key ? { "Idempotency-Key": options.key } : {}),
      },
      body:
        options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError(
      options.method && options.method !== "GET"
        ? "Chưa xác nhận được kết quả. Tải lại dữ liệu để kiểm tra trước khi gửi lại."
        : "Không kết nối được dịch vụ. Hãy thử tải lại.",
      502,
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const fields: Record<string, string> = {};
    let message =
      typeof data.detail === "string" ? data.detail : "Yêu cầu chưa hoàn tất";
    if (Array.isArray(data.detail)) {
      for (const item of data.detail)
        fields[String(item.loc?.at(-1) || "form")] = item.msg;
      message =
        "Vui lòng kiểm tra thông tin: " + Object.values(fields).join("; ");
    }
    if (
      response.status === 401 &&
      !(service === "identity" && route === "/auth/login")
    )
      window.location.assign("/sign-in");
    throw new ApiError(message, response.status, fields);
  }
  return options.blob
    ? (response.blob() as Promise<T>)
    : (response.json() as Promise<T>);
}
