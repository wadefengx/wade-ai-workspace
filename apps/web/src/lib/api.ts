type ApiErrorPayload = {
  statusCode?: number;
  message?: string;
};

type ApiFetchOptions = Omit<RequestInit, "body"> & {
  auth?: boolean;
  autoRefresh?: boolean;
  body?: BodyInit | Record<string, unknown> | null;
};

const DEFAULT_API_BASE_URL = "http://localhost:3001/api";
const REFRESH_EXCLUDED_PATHS = new Set(["/auth/login", "/auth/refresh"]);

let getAccessToken = () => null as string | null;
let refreshSession = async () => false;
let handleUnauthorized = () => {};
let refreshPromise: Promise<boolean> | null = null;

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

export function setSessionRefreshHandler(handler: () => Promise<boolean>) {
  refreshSession = handler;
}

function buildRequestHeaders(headers: HeadersInit | undefined, body: ApiFetchOptions["body"], token: string | null) {
  const resolvedBody = resolveBody(body);
  const nextHeaders = new Headers(headers);

  if (resolvedBody && !(resolvedBody instanceof FormData) && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return { headers: nextHeaders, body: resolvedBody };
}

async function executeRequest(path: string, options: ApiFetchOptions, tokenOverride?: string | null) {
  const { body, headers, ...init } = options;
  const { headers: nextHeaders, body: resolvedBody } = buildRequestHeaders(headers, body, tokenOverride ?? null);

  return fetch(resolveApiUrl(path), {
    ...init,
    body: resolvedBody,
    cache: "no-store",
    headers: nextHeaders
  });
}

function redirectToLogin() {
  if (typeof window === "undefined" || window.location.pathname === "/login") {
    return;
  }

  window.location.replace("/login");
}

function handleSessionExpired() {
  handleUnauthorized();
  redirectToLogin();
}

async function waitForRefreshSession() {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function toApiError(response: Response) {
  const fallbackMessage = response.statusText || "请求失败";
  let payload: ApiErrorPayload | null = null;

  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = null;
  }

  return new ApiError(payload?.statusCode ?? response.status, payload?.message ?? fallbackMessage);
}

export async function apiFetch<T = void>(path: string, options: ApiFetchOptions = {}) {
  const { auth = true, autoRefresh = true } = options;
  const token = auth ? getAccessToken() : null;
  let response = await executeRequest(path, options, token);
  const canAutoRefresh = auth && autoRefresh && !REFRESH_EXCLUDED_PATHS.has(path);
  let attemptedRefresh = false;

  if (response.status === 401 && canAutoRefresh) {
    attemptedRefresh = true;
    const refreshed = await waitForRefreshSession();

    if (!refreshed) {
      handleSessionExpired();
      throw await toApiError(response);
    }

    response = await executeRequest(path, options, auth ? getAccessToken() : null);
  }

  if (response.status === 401 && auth) {
    if (attemptedRefresh) {
      handleSessionExpired();
    }

    throw await toApiError(response);
  }

  if (!response.ok) {
    throw await toApiError(response);
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
