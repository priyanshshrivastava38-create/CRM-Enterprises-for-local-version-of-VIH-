// Runs during Vercel builds. In demo mode (NEXT_PUBLIC_DEMO_MODE=true) an EMPTY database is filled with the demo
// data from prisma/seed.ts. A database that already has users is never touched, so redeploys keep any changes.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { DEMO_ACCOUNTS } from "../lib/demo-accounts";

const DEMO_EMAILS = DEMO_ACCOUNTS.map((account) => account.email);

/** Demo mode comes from the environment, or from the committed .env.production (which build scripts don't load). */
function demoModeOn() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE) return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  try {
    return /^\s*NEXT_PUBLIC_DEMO_MODE\s*=\s*"?true"?\s*$/m.test(readFileSync(".env.production", "utf8"));
  } catch {
    return false;
  }
}

async function main() {
  if (!demoModeOn()) {
    console.log("demo-bootstrap: demo mode is off; skipping demo data.");
    return;
  }
  const prisma = new PrismaClient();
  // "Empty" means no business data. Demo logins can create the demo users on their own, so users alone don't count —
  // but any non-demo user means real people are using this database, and it is never touched.
  const [leads, customers, opportunities, nonDemoUsers] = await Promise.all([
    prisma.lead.count(),
    prisma.customer.count(),
    prisma.opportunity.count(),
    prisma.user.count({ where: { email: { notIn: DEMO_EMAILS } } })
  ]);
  await prisma.$disconnect();
  if (leads + customers + opportunities > 0 || nonDemoUsers > 0) {
    console.log(`demo-bootstrap: database already has data (${leads} leads, ${customers} customers, ${nonDemoUsers} non-demo users); leaving it untouched.`);
    return;
  }
  console.log("demo-bootstrap: empty database in demo mode; loading demo data…");
  await import("./seed");
}

main().catch((error) => {
  console.error("demo-bootstrap failed:", error);
  process.exit(1);
});
