// Adds the six-month trading history to an already-seeded database without wiping it: `npm run db:seed:history`.
import { PrismaClient } from "@prisma/client";
import { seedHistory } from "./seed-history";

const prisma = new PrismaClient();

async function main() {
  const emails = { sales: "vih.sales@vih.demo", ceo: "vih.ceo@vih.demo", finance: "vih.finance@vih.demo", operations: "vih.tech@vih.demo" };
  const users = Object.fromEntries(
    await Promise.all(Object.entries(emails).map(async ([key, email]) => [key, await prisma.user.findUniqueOrThrow({ where: { email }, select: { id: true } })]))
  );
  if (await prisma.customer.findFirst({ where: { name: "Swift Logistics" } })) {
    console.log("Trading history is already present; nothing to do.");
    return;
  }
  await seedHistory(prisma, users as Parameters<typeof seedHistory>[1]);
  console.log("Added six months of customer, billing, invoice, and payment history.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
