import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_MODE } from "@/lib/demo-mode";
import { messageEncryptionEnabled } from "@/lib/message-crypto";

export const dynamic = "force-dynamic";

type DatabaseState = "ok" | "not-configured" | "unreachable" | "tables-missing" | "error";

function classify(error: unknown): DatabaseState {
  const code = (error as { code?: string; errorCode?: string })?.code ?? (error as { errorCode?: string })?.errorCode;
  const message = error instanceof Error ? error.message : String(error);
  if (/Environment variable not found: DATABASE_URL/i.test(message)) return "not-configured";
  if (code === "P1001" || code === "P1002" || /Can't reach database server|timed out/i.test(message)) return "unreachable";
  if (code === "P2021" || /does not exist/i.test(message)) return "tables-missing";
  return "error";
}

/**
 * Deployment health check for uptime monitors and setup troubleshooting.
 * Reports only coarse states — never connection strings, secrets, or user details.
 */
export async function GET() {
  const checks = {
    databaseUrlSet: Boolean(process.env.DATABASE_URL),
    sessionSecretSet: Boolean(process.env.SESSION_SECRET),
    // Without SESSION_SECRET the app derives a key from DATABASE_URL (see lib/auth.ts), so sign-in still works.
    sessionSecretDerived: !process.env.SESSION_SECRET && Boolean(process.env.DATABASE_URL),
    database: "ok" as DatabaseState,
    hasUsers: false,
    demoMode: DEMO_MODE,
    messageEncryption: messageEncryptionEnabled(),
    hasDemoData: false
  };

  if (!checks.databaseUrlSet) {
    checks.database = "not-configured";
  } else {
    try {
      checks.hasUsers = (await prisma.user.count({ where: { active: true } })) > 0;
      checks.hasDemoData = (await prisma.lead.count()) > 0;
    } catch (error) {
      checks.database = classify(error);
    }
  }

  const healthy = checks.database === "ok" && (checks.sessionSecretSet || checks.sessionSecretDerived) && checks.hasUsers;
  return NextResponse.json({ status: healthy ? "ok" : "needs-attention", checks }, { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
