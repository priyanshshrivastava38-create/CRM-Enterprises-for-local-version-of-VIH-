import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

describe("sessionSecret", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers SESSION_SECRET", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "explicit");
    const { sessionSecret } = await import("./auth");
    expect(sessionSecret()).toBe("explicit");
  });

  it("derives a stable key from DATABASE_URL in production when SESSION_SECRET is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@host/db");
    const { sessionSecret } = await import("./auth");
    const first = sessionSecret();
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionSecret()).toBe(first);
    expect(first).not.toContain("pass");
  });

  it("refuses to run in production with neither setting", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_SECRET", "");
    vi.stubEnv("DATABASE_URL", "");
    const { sessionSecret } = await import("./auth");
    expect(() => sessionSecret()).toThrow("SESSION_SECRET must be set");
  });
});
