import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifyPassword, SESSION_COOKIE, SESSION_TTL_SECONDS, DUMMY_PASSWORD_HASH, ensureDemoAccounts, normalizeEmail } from "@/lib/auth";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const normalizedEmail = normalizeEmail(body.email);
  try {
    const isDemoAccount = DEMO_ACCOUNTS.some((account) => account.email === normalizedEmail);
    if (isDemoAccount) {
      await ensureDemoAccounts();
    }
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      await ensureDemoAccounts();
      user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    }

    const passwordValid = await verifyPassword(body.password, user?.password ?? DUMMY_PASSWORD_HASH);
    if (!user || !user.active || !passwordValid) {
      console.warn("[auth] sign-in failed", {
        email: normalizedEmail,
        reason: !user ? "user-not-found" : !user.active ? "user-inactive" : "invalid-password"
      });
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[auth] sign-in database error", error);
    return NextResponse.json({ error: "Sign-in service unavailable. Check DATABASE_URL, SESSION_SECRET, and Prisma migrations." }, { status: 503 });
  }
}
