export function resolveBody(body: BodyInit | Record<string, unknown> | null | undefined) {
  if (body == null) {
    return undefined;
  }

  if (typeof body === "string" || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
}
