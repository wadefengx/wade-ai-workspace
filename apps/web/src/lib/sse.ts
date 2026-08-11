type SseEvent = {
  event: string;
  data: string;
};

type StreamSseOptions = {
  url: string;
  body?: BodyInit | Record<string, unknown> | null;
  headers?: HeadersInit;
  method?: "GET" | "POST";
  signal?: AbortSignal;
  onEvent: (event: SseEvent) => void | Promise<void>;
};

function resolveBody(body: StreamSseOptions["body"]) {
  if (body == null) {
    return undefined;
  }

  if (typeof body === "string" || body instanceof Blob || body instanceof FormData || body instanceof URLSearchParams) {
    return body;
  }

  return JSON.stringify(body);
}

function parseEventBlock(block: string) {
  const lines = block.split("\n");
  let event = "message";
  const data: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "");

    if (!line || line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }

    if (line.startsWith("data:")) {
      data.push(line.slice(5).trimStart());
    }
  }

  if (!data.length) {
    return null;
  }

  return {
    event,
    data: data.join("\n")
  } satisfies SseEvent;
}

export async function streamSse({ url, body, headers, method = "POST", signal, onEvent }: StreamSseOptions) {
  const resolvedBody = resolveBody(body);
  const nextHeaders = new Headers(headers);

  if (resolvedBody && !(resolvedBody instanceof FormData) && !nextHeaders.has("Content-Type")) {
    nextHeaders.set("Content-Type", "application/json");
  }

  if (!nextHeaders.has("Accept")) {
    nextHeaders.set("Accept", "text/event-stream");
  }

  const response = await fetch(url, {
    method,
    body: resolvedBody,
    cache: "no-store",
    headers: nextHeaders,
    signal
  });

  if (!response.ok) {
    throw new Error(response.statusText || "SSE request failed");
  }

  if (!response.body) {
    throw new Error("SSE response body is empty");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    let boundary = buffer.search(/\r?\n\r?\n/);

    while (boundary >= 0) {
      const block = buffer.slice(0, boundary);
      const separatorLength = buffer[boundary] === "\r" ? 4 : 2;
      buffer = buffer.slice(boundary + separatorLength);

      const parsedEvent = parseEventBlock(block);

      if (parsedEvent) {
        await onEvent(parsedEvent);
      }

      boundary = buffer.search(/\r?\n\r?\n/);
    }

    if (done) {
      const parsedEvent = parseEventBlock(buffer);

      if (parsedEvent) {
        await onEvent(parsedEvent);
      }

      break;
    }
  }
}
