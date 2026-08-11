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
    process.env.CREDENTIAL_ENCRYPTION_KEY = "a-real-production-key";

    expect(() => validateRuntimeConfiguration()).toThrow("JWT_SECRET must be set");

    delete process.env.JWT_SECRET;
    expect(() => validateRuntimeConfiguration()).toThrow("JWT_SECRET must be set");
  });

  it("rejects a missing or placeholder credential encryption key outside development", () => {
    process.env.NODE_ENV = "production";
    process.env.JWT_SECRET = "a-real-production-secret";
    process.env.CREDENTIAL_ENCRYPTION_KEY = "replace-with-a-long-random-secret";

    expect(() => validateRuntimeConfiguration()).toThrow("CREDENTIAL_ENCRYPTION_KEY must be set");

    delete process.env.CREDENTIAL_ENCRYPTION_KEY;
    expect(() => validateRuntimeConfiguration()).toThrow("CREDENTIAL_ENCRYPTION_KEY must be set");
  });

  it("permits local startup when NODE_ENV is not set", () => {
    delete process.env.NODE_ENV;
    process.env.JWT_SECRET = "replace-with-a-long-random-secret";

    expect(() => validateRuntimeConfiguration()).not.toThrow();
  });

  it("permits the development JWT secret in development", () => {
    process.env.NODE_ENV = "development";
    process.env.JWT_SECRET = "development-only-change-me";

    expect(() => validateRuntimeConfiguration()).not.toThrow();
  });
});
