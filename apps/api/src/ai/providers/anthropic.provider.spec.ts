import { AnthropicProvider } from "./anthropic.provider";

describe("AnthropicProvider", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_BASE_URL = "https://anthropic.test";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
    process.env.ANTHROPIC_MODEL = "claude-test";
  });

  afterAll(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  it("sends anthropic message payloads and parses text deltas", async () => {
    global.fetch = jest.fn().mockResolvedValue(createResponse([
      "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Hel\"}}\n\n",
      "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"lo\"}}\n\n",
      "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
    ])) as typeof fetch;
    const provider = new AnthropicProvider();

    await expect(collect(provider.stream({
      messages: [{
        role: "system",
        content: "be helpful"
      }, {
        role: "user",
        content: "hello"
      }, {
        role: "assistant",
        content: "hi"
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
      "https://anthropic.test/v1/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "x-api-key": "anthropic-key"
        })
      })
    );
    const firstCall = (global.fetch as jest.Mock).mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(firstCall.body)).toEqual({
      model: "claude-test",
      stream: true,
      max_tokens: 1024,
      system: "be helpful",
      messages: [{
        role: "user",
        content: [{
          type: "text",
          text: "hello"
        }]
      }, {
        role: "assistant",
        content: [{
          type: "text",
          text: "hi"
        }]
      }]
    });
  });

  it("prefers per-request provider overrides", async () => {
    global.fetch = jest.fn().mockResolvedValue(createResponse([
      "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
    ])) as typeof fetch;
    const provider = new AnthropicProvider();

    await collect(provider.stream({
      messages: [{
        role: "user",
        content: "hello"
      }],
      provider: {
        baseUrl: "https://workspace-provider.test/v1",
        apiKey: "workspace-key",
        model: "workspace-model"
      }
    }));

    expect(global.fetch).toHaveBeenCalledWith(
      "https://workspace-provider.test/v1/messages",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-api-key": "workspace-key"
        })
      })
    );
    const overrideCall = (global.fetch as jest.Mock).mock.calls[0]?.[1] as { body: string };
    expect(JSON.parse(overrideCall.body)).toEqual(expect.objectContaining({
      model: "workspace-model"
    }));
  });

  it("does not expose upstream stream errors", async () => {
    const sentinel = "anthropic-response-sentinel";
    global.fetch = jest.fn().mockResolvedValue(createResponse([
      `event: error\ndata: {"error":{"message":"${sentinel}"}}\n\n`
    ])) as typeof fetch;
    const provider = new AnthropicProvider();

    await expect(collect(provider.stream({
      messages: [{ role: "user", content: "hello" }]
    }))).resolves.toEqual([{
      type: "error",
      message: "AI provider request failed"
    }]);
  });

  it("uses a bounded request timeout", async () => {
    global.fetch = jest.fn().mockResolvedValue(createResponse([
      "event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"
    ])) as typeof fetch;
    const provider = new AnthropicProvider();

    await collect(provider.stream({
      messages: [{ role: "user", content: "hello" }]
    }));

    expect((global.fetch as jest.Mock).mock.calls[0]?.[1]).toEqual(expect.objectContaining({
      signal: expect.any(AbortSignal)
    }));
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
