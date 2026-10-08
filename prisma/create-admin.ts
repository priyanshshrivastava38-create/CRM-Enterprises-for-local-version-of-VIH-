// Creates the first administrator on a fresh (e.g. production) database — the demo accounts are never created there.
//
//   ADMIN_PASSWORD='a strong password' DATABASE_URL='<database url>' \
//     npm run create-admin -- --email you@company.com --name "Your Name"
//
// Add --reset-password to set a new password for an existing account. Nothing else in the database is touched.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 ? process.argv[index + 1] : undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name")?.trim();
  const password = process.env.ADMIN_PASSWORD ?? "";
  const reset = process.argv.includes("--reset-password");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Pass a valid --email.");
  if (password.length < 10) throw new Error("Set ADMIN_PASSWORD to at least 10 characters (it is read from the environment so it stays out of your shell history's arguments).");
  if (password === "ViH@Demo2026!") throw new Error("Don't reuse the published demo password.");

  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    const hash = await bcrypt.hash(password, 10);
    if (existing) {
      if (!reset) throw new Error(`${email} already exists. Re-run with --reset-password to set a new password.`);
      await prisma.user.update({ where: { email }, data: { password: hash, active: true } });
      console.log(`Password reset and account re-activated for ${email} (${existing.role}).`);
      return;
    }
    if (!name) throw new Error("Pass --name for the new account.");
    await prisma.user.create({ data: { email, name, password: hash, role: "ADMIN", active: true } });
    console.log(`Created administrator ${name} <${email}>. Sign in, then add your team under User Management.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`create-admin: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
