import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UNREADABLE_MESSAGE, decryptMessage, decryptText, encryptText, isEncrypted, messageEncryptionEnabled } from "./message-crypto";

const keyA = randomBytes(32).toString("base64");
const keyB = randomBytes(32).toString("hex");

describe("message encryption", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips text and never stores the plaintext", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyA);
    const stored = encryptText("Swift Logistics is 37 days overdue — ₹4.6L");
    expect(isEncrypted(stored)).toBe(true);
    expect(stored).not.toContain("Swift");
    expect(decryptText(stored)).toBe("Swift Logistics is 37 days overdue — ₹4.6L");
  });

  it("uses a fresh IV so identical messages encrypt differently", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyA);
    expect(encryptText("hello")).not.toBe(encryptText("hello"));
  });

  it("passes plaintext through and leaves text unencrypted when no key is set", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", "");
    expect(messageEncryptionEnabled()).toBe(false);
    expect(encryptText("plain")).toBe("plain");
    expect(decryptText("legacy plaintext")).toBe("legacy plaintext");
  });

  it("detects tampering and wrong keys without throwing", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyA);
    const stored = encryptText("secret");
    const tampered = stored.slice(0, -4) + (stored.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(decryptText(tampered)).toBe(UNREADABLE_MESSAGE);
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyB);
    expect(decryptText(stored)).toBe(UNREADABLE_MESSAGE);
  });

  it("still reads old messages after a key rotation", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyA);
    const stored = encryptText("before rotation");
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyB);
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY_PREVIOUS", keyA);
    expect(decryptText(stored)).toBe("before rotation");
  });

  it("rejects malformed keys", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", "too-short");
    expect(() => encryptText("x")).toThrow("32 bytes");
  });

  it("decrypts body and record label together", () => {
    vi.stubEnv("MESSAGE_ENCRYPTION_KEY", keyA);
    const message = decryptMessage({ id: "1", body: encryptText("hi"), recordLabel: encryptText("FreshKart · ₹9.8L") });
    expect(message).toMatchObject({ id: "1", body: "hi", recordLabel: "FreshKart · ₹9.8L" });
  });
});
