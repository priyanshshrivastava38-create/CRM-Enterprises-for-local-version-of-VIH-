import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { conversationForUser, markRead } from "@/lib/messaging-server";

const RECORD_TYPES = ["opportunity", "invoice", "customer", "lead"] as const;

const sendSchema = z.object({
  body: z.string().trim().min(1, "Write a message first").max(4000),
  record: z.object({ type: z.enum(RECORD_TYPES), id: z.string().min(1), label: z.string().min(1).max(200) }).optional().nullable()
});

const messageSelect = {
  id: true,
  body: true,
  createdAt: true,
  recordType: true,
  recordId: true,
  recordLabel: true,
  author: { select: { id: true, name: true, role: true } }
};

/** Messages in a conversation (newest 150, or only those after ?after=ISO when polling); marks it read. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    await conversationForUser(id, user);
    const after = new URL(request.url).searchParams.get("after");
    const afterDate = after ? new Date(after) : null;
    const messages = await prisma.message.findMany({
      where: { conversationId: id, ...(afterDate && !Number.isNaN(afterDate.getTime()) ? { createdAt: { gt: afterDate } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: messageSelect
    });
    await markRead(id, user.id);
    return NextResponse.json({ messages: messages.reverse() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const conversation = await conversationForUser(id, user);
    const input = sendSchema.parse(await request.json());
    const message = await prisma.message.create({
      data: { conversationId: id, authorId: user.id, body: input.body, recordType: input.record?.type, recordId: input.record?.id, recordLabel: input.record?.label },
      select: messageSelect
    });
    await prisma.conversation.update({ where: { id }, data: { lastMessageAt: message.createdAt } });
    await markRead(id, user.id, message.createdAt);
    if (conversation.kind === "DIRECT") {
      const recipient = conversation.participants.find((participant) => participant.userId !== user.id);
      if (recipient) {
        await prisma.notification.create({
          data: { userId: recipient.userId, title: `New message from ${user.name}`, message: input.body.slice(0, 140), type: "MESSAGE", entityType: "conversation", entityId: id }
        });
      }
    }
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
