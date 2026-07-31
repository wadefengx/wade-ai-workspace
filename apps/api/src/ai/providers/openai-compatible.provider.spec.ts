import { OpenAICompatibleProvider } from "./openai-compatible.provider";

describe("OpenAICompatibleProvider", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.AI_PROVIDER_BASE_URL = "http://provider.test/v1";
    process.env.AI_PROVIDER_API_KEY = "test-key";
    process.env.AI_PROVIDER_MODEL = "test-model";
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("parses token events from an SSE response", async () => {
    global.fetch = jest.fn().mockResolvedValue(createResponse([
      "data: {\"choices\":[{\"delta\":{\"content\":\"Hel\"}}]}\n\n",
      "data: {\"choices\":[{\"delta\":{\"content\":\"lo\"}}]}\n\n",
      "data: [DONE]\n\n"
    ])) as typeof fetch;
    const provider = new OpenAICompatibleProvider();

    await expect(collect(provider.stream({
      messages: [{
        role: "user",
        content: "hello"
      }]
    }))).resolves.toEqual([{
      type: "token",
      content: "Hel"
    }, {
      type: "token",
      content: "lo"
    }, {
      type: "done"
    }]);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://provider.test/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
          "Content-Type": "application/json"
        })
      })
    );
  });

  it("normalizes non-2xx provider errors", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        message: "upstream rejected the request"
      }
    }), {
      status: 401,
      headers: {
        "Content-Type": "application/json"
      }
    })) as typeof fetch;
    const provider = new OpenAICompatibleProvider();

    await expect(collect(provider.stream({
      messages: [{
        role: "user",
        content: "hello"
      }]
    }))).rejects.toThrow("upstream rejected the request");
  });

  it("prefers per-request provider overrides over environment defaults", async () => {
    global.fetch = jest.fn().mockResolvedValue(createResponse([
      "data: [DONE]\n\n"
    ])) as typeof fetch;
    const provider = new OpenAICompatibleProvider();

    await collect(provider.stream({
      messages: [{
        role: "user",
        content: "hello"
      }],
      provider: {
        baseUrl: "http://workspace-provider.test/v1",
        apiKey: "workspace-key",
        model: "workspace-model"
      }
    }));

    expect(global.fetch).toHaveBeenCalledWith(
      "http://workspace-provider.test/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: expect.any(String),
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          model: "workspace-model",
          stream: true,
          messages: [{
            role: "user",
            content: "hello"
          }]
        })
      })
    );
  });
});

async function collect<T>(iterable: AsyncIterable<T>) {
  const items: T[] = [];

  for await (const item of iterable) {
    items.push(item);
  }

  return items;
}

function createResponse(chunks: string[]) {
  const encoder = new TextEncoder();

  return new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    }
  }), {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream"
    }
  });
}
