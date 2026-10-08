import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
export { DEMO_PASSWORD } from "@/lib/demo-accounts";

export const SESSION_COOKIE = "vih_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test") {
    return "dev-only-insecure-session-secret";
  }
  throw new Error("SESSION_SECRET must be set");
}

function sign(payload: string) {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

export function createSessionToken(userId: string) {
  const payload = `${userId}.${Date.now() + SESSION_TTL_SECONDS * 1000}`;
  return `${payload}.${sign(payload)}`;
}

function verifySessionToken(token: string): string | null {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) return null;
  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = sign(payload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  const payloadSeparator = payload.lastIndexOf(".");
  if (payloadSeparator === -1) return null;
  const userId = payload.slice(0, payloadSeparator);
  const expiresAt = Number(payload.slice(payloadSeparator + 1));
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return userId;
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = verifySessionToken(token);
  if (!userId) return null;

  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, active: true }
  });
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user || !user.active) redirect("/login");
  return user;
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export async function ensureDemoAccounts() {
  await Promise.all(
    DEMO_ACCOUNTS.map(async (account) => {
      const normalizedEmail = normalizeEmail(account.email);
      const passwordHash = await hashPassword(account.password);
      await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {
          name: account.name,
          password: passwordHash,
          role: account.role,
          active: true
        },
        create: {
          name: account.name,
          email: normalizedEmail,
          password: passwordHash,
          role: account.role,
          active: true
        }
      });
    })
  );
}

// Constant-cost placeholder hash so login always pays the bcrypt.compare cost,
// even when the email doesn't match an active user (avoids a timing side-channel).
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync("no-such-account", 10);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}
