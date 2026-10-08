// Demo team conversations (team channels + a direct message) linked to real seeded deals and invoices.
import type { PrismaClient } from "@prisma/client";
import { TEAM_CHANNELS, canAccessTeam, directConversationKey, teamConversationKey } from "../lib/messaging";

type Person = { id: string; role: string };
type People = { ceo: Person; sales: Person; finance: Person; operations: Person; admin?: Person | null };
type Script = { team?: string; dm?: [keyof People, keyof People]; from: keyof People; minutesAgo: number; body: string; record?: { type: string; id: string; label: string } | null };

export async function seedMessages(prisma: PrismaClient, people: People) {
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000);

  const [overdueInvoice, freshKart, eduSpark] = await Promise.all([
    prisma.invoice.findFirst({ where: { status: "OVERDUE", customer: { name: "Swift Logistics" } }, select: { id: true, invoiceNumber: true, totalAmount: true } }),
    prisma.opportunity.findFirst({ where: { companyName: "FreshKart Grocers" }, select: { id: true, opportunityValue: true } }),
    prisma.opportunity.findFirst({ where: { companyName: "EduSpark Academy" }, select: { id: true, opportunityValue: true } })
  ]);
  const inr = (value: unknown) => `₹${Number(value).toLocaleString("en-IN")}`;
  const invoiceRef = overdueInvoice ? { type: "invoice", id: overdueInvoice.id, label: `${overdueInvoice.invoiceNumber} · Swift Logistics · ${inr(overdueInvoice.totalAmount)} · Overdue` } : null;
  const freshKartRef = freshKart ? { type: "opportunity", id: freshKart.id, label: `FreshKart Grocers · ${inr(freshKart.opportunityValue)} · Proposal` } : null;
  const eduSparkRef = eduSpark ? { type: "opportunity", id: eduSpark.id, label: `EduSpark Academy · ${inr(eduSpark.opportunityValue)} · Proposal` } : null;

  const script: Script[] = [
    { team: "COMPANY", from: "ceo", minutesAgo: 26 * 60, body: "Team — October is tracking at ₹35L billed, up about 25% on September. Great work, everyone.\nFor the rest of the month: collections first, and let's close the three proposals in flight." },
    { team: "COMPANY", from: "finance", minutesAgo: 25 * 60 + 30, body: "Thanks! Reminder: month-end invoices go out on the 2nd. Please flag any customer disputes to Finance before then." },
    { team: "OPERATIONS", from: "operations", minutesAgo: 20 * 60, body: "Northstar Bank's WhatsApp account is live and delivering. October usage import is scheduled for the 1st." },
    { team: "LEADERSHIP", from: "ceo", minutesAgo: 15 * 60, body: "₹6.8L is overdue across Swift Logistics and MedCare. Can Finance share a recovery plan by Thursday?", record: invoiceRef },
    { team: "SALES", from: "ceo", minutesAgo: 9 * 60, body: "EduSpark and FreshKart are our two biggest proposals this month. What do you need from me to get them over the line?", record: eduSparkRef },
    { team: "SALES", from: "sales", minutesAgo: 8 * 60 + 40, body: "EduSpark wants a call with you on WhatsApp volume pricing — could you join Thursday at 4 pm?" },
    { team: "FINANCE", from: "sales", minutesAgo: 7 * 60, body: "Hi Finance — FreshKart Grocers is asking for Net 45 instead of Net 30. Is that okay before I send the proposal?", record: freshKartRef },
    { team: "FINANCE", from: "finance", minutesAgo: 6 * 60 + 45, body: "Net 45 is fine for a deal this size if they sign the annual contract. Please note it in the price request so the CEO sees it when approving." },
    { team: "FINANCE", from: "sales", minutesAgo: 6 * 60 + 41, body: "Perfect, will do. Thanks!" },
    { dm: ["finance", "sales"], from: "finance", minutesAgo: 3 * 60, body: "Swift Logistics' July invoice is now over a month overdue. Could you nudge their accounts team? You know Rohan well.", record: invoiceRef },
    { team: "SALES", from: "ceo", minutesAgo: 90, body: "Thursday 4 pm works — send me the invite." }
  ];

  await prisma.conversation.createMany({
    data: TEAM_CHANNELS.map((team) => ({ key: teamConversationKey(team.key), kind: "TEAM" as const, team: team.key })),
    skipDuplicates: true
  });

  for (const line of script) {
    const author = people[line.from];
    if (!author) continue;
    let conversationId: string;
    if (line.team) {
      conversationId = (await prisma.conversation.findUniqueOrThrow({ where: { key: teamConversationKey(line.team) }, select: { id: true } })).id;
    } else {
      const [a, b] = line.dm!.map((key) => people[key]!);
      const key = directConversationKey(a.id, b.id);
      conversationId = (
        await prisma.conversation.upsert({
          where: { key },
          update: {},
          create: { key, kind: "DIRECT", participants: { create: [{ userId: a.id }, { userId: b.id }] } },
          select: { id: true }
        })
      ).id;
    }
    const createdAt = at(line.minutesAgo);
    await prisma.message.create({
      data: { conversationId, authorId: author.id, body: line.body, createdAt, recordType: line.record?.type, recordId: line.record?.id, recordLabel: line.record?.label }
    });
    await prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: createdAt } });
  }

  // Everyone has "read" up to 12 hours ago, so the most recent messages show as unread.
  const readUpTo = at(12 * 60);
  const conversations = await prisma.conversation.findMany({ include: { participants: true } });
  for (const person of Object.values(people)) {
    if (!person) continue;
    for (const conversation of conversations) {
      const visible = conversation.kind === "TEAM" ? canAccessTeam(person.role, conversation.team ?? "") : conversation.participants.some((participant) => participant.userId === person.id);
      if (!visible) continue;
      await prisma.conversationParticipant.upsert({
        where: { conversationId_userId: { conversationId: conversation.id, userId: person.id } },
        update: { lastReadAt: readUpTo },
        create: { conversationId: conversation.id, userId: person.id, lastReadAt: readUpTo }
      });
    }
  }
}
