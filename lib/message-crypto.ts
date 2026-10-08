// Encryption at rest for message text (AES-256-GCM).
//
// Stored format: "enc:v1:" + base64(12-byte IV | 16-byte auth tag | ciphertext).
// Key: MESSAGE_ENCRYPTION_KEY — 32 bytes as base64 or 64 hex characters. Generate one with
//   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
// MESSAGE_ENCRYPTION_KEY_PREVIOUS (optional) is still accepted for reading, so the key can be rotated
// and old rows re-encrypted with `npm run messages:encrypt`.
// Without a key, text is stored as-is (and existing encrypted rows can't be read), so plaintext rows always stay readable.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

export const UNREADABLE_MESSAGE = "[This message can't be decrypted with the current key]";

function parseKey(value: string | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  const key = /^[0-9a-f]{64}$/i.test(trimmed) ? Buffer.from(trimmed, "hex") : Buffer.from(trimmed, "base64");
  if (key.length !== 32) throw new Error("MESSAGE_ENCRYPTION_KEY must be 32 bytes (base64 or 64 hex characters)");
  return key;
}

function currentKey() {
  return parseKey(process.env.MESSAGE_ENCRYPTION_KEY);
}

function readKeys() {
  const keys: Buffer[] = [];
  for (const key of [currentKey(), parseKey(process.env.MESSAGE_ENCRYPTION_KEY_PREVIOUS)]) if (key) keys.push(key);
  return keys;
}

export function messageEncryptionEnabled() {
  return currentKey() !== null;
}

export function isEncrypted(value: string) {
  return value.startsWith(PREFIX);
}

/** Encrypts with the current key; returns the text unchanged when no key is configured. */
export function encryptText(plain: string): string;
export function encryptText(plain: string | null | undefined): string | null | undefined;
export function encryptText(plain: string | null | undefined) {
  if (plain == null) return plain;
  const key = currentKey();
  if (!key || isEncrypted(plain)) return plain;
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

/** Decrypts stored text; plaintext passes through. Tampered data or an unknown key yields a placeholder, never a crash. */
export function decryptText(stored: string): string;
export function decryptText(stored: string | null | undefined): string | null | undefined;
export function decryptText(stored: string | null | undefined) {
  if (stored == null || !isEncrypted(stored)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const ciphertext = raw.subarray(IV_BYTES + TAG_BYTES);
  for (const key of readKeys()) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      // Wrong key or tampered data — try the next key.
    }
  }
  return UNREADABLE_MESSAGE;
}

/** Applies decryptText to the text fields of a message-like object. */
export function decryptMessage<T extends { body: string; recordLabel?: string | null }>(message: T): T {
  return { ...message, body: decryptText(message.body), ...(message.recordLabel !== undefined ? { recordLabel: decryptText(message.recordLabel) } : {}) };
}
