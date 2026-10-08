// Adds demo team conversations to an already-seeded database: `npm run db:seed:messages`.
import { PrismaClient } from "@prisma/client";
import { seedMessages } from "./seed-messages";

const prisma = new PrismaClient();

async function main() {
  if (await prisma.message.count()) {
    console.log("Messages already exist; nothing to do.");
    return;
  }
  const find = (email: string) => prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  const [ceo, sales, finance, operations, admin] = await Promise.all(
    ["vih.ceo@vih.demo", "vih.sales@vih.demo", "vih.finance@vih.demo", "vih.tech@vih.demo", "admin@vihmetaverse.com"].map(find)
  );
  if (!ceo || !sales || !finance || !operations) throw new Error("Demo users are missing; run `npm run db:seed` first.");
  await seedMessages(prisma, { ceo, sales, finance, operations, admin });
  console.log("Added demo team conversations.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
