import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// ponytail: AES-256-GCM with a single env-derived key. Add key versioning/KMS when rotation is actually needed.
const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:v1:";
const DEV_FALLBACK_SECRET = "development-only-change-me";

function deriveKey(secret: string): Buffer {
  // scrypt with a fixed static salt: acceptable here because the "password" is a high-entropy env secret,
  // not a user password — this only needs to map one env string to a stable 32-byte key.
  return scryptSync(secret, "wade-ai-workspace-credential-key", 32);
}

function getSecret(): string {
  const secret = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (secret) {
    return secret;
  }

  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv && nodeEnv !== "development" && nodeEnv !== "test") {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY must be set outside development");
  }

  return DEV_FALLBACK_SECRET;
}

/** Encrypt a plaintext secret (e.g. a provider API key) for storage. Returns null for empty input. */
export function encryptSecret(plaintext?: string | null): string | undefined {
  if (!plaintext) {
    return undefined;
  }

  const key = deriveKey(getSecret());
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return ENC_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

/**
 * Decrypt a value produced by encryptSecret. Values without the enc:v1: prefix are treated as
 * legacy plaintext (pre-encryption rows) and returned as-is so existing agents keep working
 * until they are next saved, at which point they get encrypted automatically.
 */
export function decryptSecret(stored?: string | null): string | undefined {
  if (!stored) {
    return undefined;
  }

  if (!stored.startsWith(ENC_PREFIX)) {
    return stored;
  }

  const key = deriveKey(getSecret());
  const raw = Buffer.from(stored.slice(ENC_PREFIX.length), "base64");
  const iv = raw.subarray(0, 12);
  const authTag = raw.subarray(12, 28);
  const encrypted = raw.subarray(28);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function isEncryptedSecret(value?: string | null): boolean {
  return Boolean(value && value.startsWith(ENC_PREFIX));
}
