// Runs during Vercel builds. In demo mode (NEXT_PUBLIC_DEMO_MODE=true) an EMPTY database is filled with the demo
// data from prisma/seed.ts. A database that already has users is never touched, so redeploys keep any changes.
import { PrismaClient } from "@prisma/client";

async function main() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
    console.log("demo-bootstrap: demo mode is off; skipping demo data.");
    return;
  }
  const prisma = new PrismaClient();
  const users = await prisma.user.count();
  await prisma.$disconnect();
  if (users > 0) {
    console.log(`demo-bootstrap: database already has ${users} user(s); leaving data untouched.`);
    return;
  }
  console.log("demo-bootstrap: empty database in demo mode; loading demo data…");
  await import("./seed");
}

main().catch((error) => {
  console.error("demo-bootstrap failed:", error);
  process.exit(1);
});
