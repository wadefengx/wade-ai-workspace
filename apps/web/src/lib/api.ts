type ApiErrorPayload = {
  statusCode?: number;
  message?: string;
};

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  body?: BodyInit | Record<string, unknown> | null;
};

const DEFAULT_API_BASE_URL = "http://localhost:3001/api";
const AUTH_ROUTES = new Set(["/login", "/register"]);

let getAccessToken = () => null as string | null;
let handleUnauthorized = () => {};

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function resolveApiUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL}${path}`;
}

// API 列表接口返回裸数组(workspaces/channels/members),兼容 {items} 包装
export function unwrapItems<T>(data: T[] | { items: T[] } | undefined | null): T[] {
  if (!data) return [];
  return Array.isArray(data) ? data : data.items ?? [];
}

function resolveBody(body: ApiFetchOptions["body"]) {
  if (body == null) {
    return undefined;
  }

  if (typeof body === "string" || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
}

export function setAccessTokenGetter(getter: () => string | null) {
  getAccessToken = getter;
}

export function setUnauthorizedHandler(handler: () => void) {
  handleUnauthorized = handler;
}

export async function apiFetch<T = void>(path: string, options: ApiFetchOptions = {}) {
  const { auth = true, body, headers, ...init } = options;
  const token = auth ? getAccessToken() : null;
  const resolvedBody = resolveBody(body);
  const nextHeaders = new Headers(headers);

  if (resolvedBody && !(resolvedBody instanceof FormData) && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(resolveApiUrl(path), {
    ...init,
    body: resolvedBody,
    cache: "no-store",
    headers: nextHeaders
  });

  if (response.status === 401 && auth) {
    handleUnauthorized();

    if (typeof window !== "undefined" && !AUTH_ROUTES.has(window.location.pathname)) {
      window.location.replace("/login");
    }
  }

  if (!response.ok) {
    const fallbackMessage = response.statusText || "请求失败";
    let payload: ApiErrorPayload | null = null;

    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = null;
    }

    throw new ApiError(payload?.statusCode ?? response.status, payload?.message ?? fallbackMessage);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("Content-Type");

  if (!contentType?.includes("application/json")) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
