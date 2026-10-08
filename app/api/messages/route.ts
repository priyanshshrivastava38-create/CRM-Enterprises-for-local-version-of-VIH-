import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { errorResponse } from "@/lib/api-error";
import { accessibleTeams, canBroadcast, isTeamMember, teamConversationKey } from "@/lib/messaging";
import { ensureTeamConversations, unreadCounts } from "@/lib/messaging-server";
import { decryptText } from "@/lib/message-crypto";

const lastMessageSelect = { orderBy: { createdAt: "desc" as const }, take: 1, select: { body: true, createdAt: true, author: { select: { id: true, name: true } } } };

function preview<T extends { body: string }>(message: T | undefined) {
  return message ? { ...message, body: decryptText(message.body) } : null;
}

/** Inbox: accessible team channels, the user's direct messages, unread counts, and people to message. */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await ensureTeamConversations();
    const teams = accessibleTeams(user.role);
    const [teamConversations, directConversations, people] = await Promise.all([
      prisma.conversation.findMany({ where: { key: { in: teams.map((team) => teamConversationKey(team.key)) } }, include: { messages: lastMessageSelect } }),
      prisma.conversation.findMany({
        where: { kind: "DIRECT", participants: { some: { userId: user.id } } },
        include: { messages: lastMessageSelect, participants: { include: { user: { select: { id: true, name: true, role: true } } } } },
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } }
      }),
      prisma.user.findMany({ where: { active: true, id: { not: user.id } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } })
    ]);
    const unread = await unreadCounts(user, [...teamConversations, ...directConversations].map((conversation) => conversation.id));
    const byKey = new Map(teamConversations.map((conversation) => [conversation.key, conversation]));

    return NextResponse.json({
      canBroadcast: canBroadcast(user.role),
      teams: teams.map((team) => {
        const conversation = byKey.get(teamConversationKey(team.key))!;
        return {
          id: conversation.id,
          team: team.key,
          name: team.name,
          description: team.description,
          private: !!team.private,
          isMember: isTeamMember(user.role, team.key),
          unread: unread.get(conversation.id) ?? 0,
          lastMessage: preview(conversation.messages[0])
        };
      }),
      directs: directConversations.map((conversation) => ({
        id: conversation.id,
        other: conversation.participants.find((participant) => participant.userId !== user.id)?.user ?? null,
        unread: unread.get(conversation.id) ?? 0,
        lastMessage: preview(conversation.messages[0])
      })),
      people
    });
  } catch (error) {
    return errorResponse(error);
  }
}
