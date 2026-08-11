import assert from "node:assert/strict";
import test from "node:test";
import { apiFetch, setAccessTokenGetter, setSessionRefreshHandler, setUnauthorizedHandler } from "./api.ts";

test("apiFetch refreshes a 401 response and retries with the new access token", async () => {
  const originalFetch = globalThis.fetch;
  let accessToken = "expired-test-token";
  let refreshCalls = 0;
  const authorizationHeaders: Array<string | null> = [];

  setAccessTokenGetter(() => accessToken);
  setSessionRefreshHandler(async () => {
    refreshCalls += 1;
    accessToken = "refreshed-test-token";
    return true;
  });
  setUnauthorizedHandler(() => {});

  globalThis.fetch = async (_input, init) => {
    authorizationHeaders.push(new Headers(init?.headers).get("Authorization"));

    if (authorizationHeaders.length === 1) {
      return new Response(JSON.stringify({ message: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  };

  try {
    assert.deepEqual(await apiFetch<{ ok: boolean }>("/protected"), { ok: true });
    assert.equal(refreshCalls, 1);
    assert.deepEqual(authorizationHeaders, ["Bearer expired-test-token", "Bearer refreshed-test-token"]);
  } finally {
    globalThis.fetch = originalFetch;
    setAccessTokenGetter(() => null);
    setSessionRefreshHandler(async () => false);
    setUnauthorizedHandler(() => {});
  }
});
