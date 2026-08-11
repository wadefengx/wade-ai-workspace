import { resolveCorsOrigins, validateRuntimeConfiguration } from "./main";

describe("runtime configuration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("uses a trimmed explicit CORS allowlist", () => {
    process.env.CORS_ORIGINS = " https://app.example.com, http://localhost:3000 ";

    expect(resolveCorsOrigins()).toEqual([
      "https://app.example.com",
      "http://localhost:3000"
    ]);
  });

  it("keeps local browser defaults when no CORS allowlist is configured", () => {
    delete process.env.CORS_ORIGINS;

    expect(resolveCorsOrigins()).toEqual([
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ]);
  });

  it("rejects a missing or placeholder JWT secret outside development", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "replace-with-a-long-random-secret";

    expect(() => validateRuntimeConfiguration()).toThrow("JWT_SECRET must be set");

    delete process.env.JWT_SECRET;
    expect(() => validateRuntimeConfiguration()).toThrow("JWT_SECRET must be set");
  });

  it("permits the development JWT secret in development", () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "development-only-change-me";

    expect(() => validateRuntimeConfiguration()).not.toThrow();
  });
});
