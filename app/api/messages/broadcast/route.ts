import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api-error";
import { canAccessTeam, canBroadcast, teamConversationKey } from "@/lib/messaging";
import { ensureTeamConversations, markRead } from "@/lib/messaging-server";

/** Leaders post the same message to several team channels at once. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (!canBroadcast(user.role)) throw new ApiError("Only leaders can message several teams at once", 403);
    const input = z.object({ teams: z.array(z.string()).min(1, "Pick at least one team"), body: z.string().trim().min(1).max(4000) }).parse(await request.json());
    const teams = [...new Set(input.teams)].filter((team) => canAccessTeam(user.role, team));
    if (!teams.length) throw new ApiError("Pick at least one team you can post to", 400);
    await ensureTeamConversations();
    const conversations = await prisma.conversation.findMany({ where: { key: { in: teams.map(teamConversationKey) } }, select: { id: true } });
    const now = new Date();
    for (const conversation of conversations) {
      await prisma.message.create({ data: { conversationId: conversation.id, authorId: user.id, body: input.body, createdAt: now } });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastMessageAt: now } });
      await markRead(conversation.id, user.id, now);
    }
    return NextResponse.json({ sent: conversations.length }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
