import { decryptSecret, encryptSecret, isEncryptedSecret } from "./secret-cipher";

describe("secret-cipher", () => {
  const originalEnv = process.env.CREDENTIAL_ENCRYPTION_KEY;

  afterEach(() => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = originalEnv;
  });

  it("round-trips a plaintext secret", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = "test-key-abc123";
    const encrypted = encryptSecret("sk-super-secret-key");

    expect(encrypted).toBeDefined();
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(encrypted).not.toContain("sk-super-secret-key");
    expect(decryptSecret(encrypted)).toBe("sk-super-secret-key");
  });

  it("returns undefined for empty input", () => {
    expect(encryptSecret(undefined)).toBeUndefined();
    expect(encryptSecret("")).toBeUndefined();
    expect(decryptSecret(undefined)).toBeUndefined();
  });

  it("treats legacy plaintext (no enc:v1: prefix) as already-decrypted for backward compatibility", () => {
    expect(decryptSecret("sk-legacy-plaintext-key")).toBe("sk-legacy-plaintext-key");
    expect(isEncryptedSecret("sk-legacy-plaintext-key")).toBe(false);
  });

  it("fails to decrypt with the wrong key", () => {
    process.env.CREDENTIAL_ENCRYPTION_KEY = "key-one";
    const encrypted = encryptSecret("sk-secret")!;

    process.env.CREDENTIAL_ENCRYPTION_KEY = "key-two";
    expect(() => decryptSecret(encrypted)).toThrow();
  });
});
