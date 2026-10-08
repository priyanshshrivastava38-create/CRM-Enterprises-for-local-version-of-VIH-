import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSessionToken, verifyPassword, SESSION_COOKIE, SESSION_TTL_SECONDS, DUMMY_PASSWORD_HASH, ensureDemoAccounts, normalizeEmail } from "@/lib/auth";
import { DEMO_ACCOUNTS } from "@/lib/demo-accounts";
import { landingPathForRole } from "@/components/shell/module-nav";

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
    if (process.env.NODE_ENV !== "production" && isDemoAccount) {
      await ensureDemoAccounts();
    }
    let user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    if (!user && process.env.NODE_ENV !== "production") {
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

    const host = request.headers.get("host") || "";
    const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1");
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, createSessionToken(user.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" && !isLocalhost,
      path: "/",
      maxAge: SESSION_TTL_SECONDS
    });

    return NextResponse.json({ ok: true, redirectTo: landingPathForRole(user.role) });
  } catch (error) {
    console.error("[auth] sign-in database error", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again in a moment or contact your administrator." }, { status: 503 });
  }
}
