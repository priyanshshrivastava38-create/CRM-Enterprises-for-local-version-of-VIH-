import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { TEAM_CHANNELS, canAccessTeam, teamConversationKey } from "@/lib/messaging";

type SessionUser = { id: string; role: string };

/** Team channels are created lazily the first time anyone opens Messages. */
export async function ensureTeamConversations() {
  await prisma.conversation.createMany({
    data: TEAM_CHANNELS.map((team) => ({ key: teamConversationKey(team.key), kind: "TEAM" as const, team: team.key })),
    skipDuplicates: true
  });
}

/** Loads a conversation the user is allowed to see, or throws 404/403. */
export async function conversationForUser(conversationId: string, user: SessionUser) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { participants: { include: { user: { select: { id: true, name: true, role: true } } } } }
  });
  if (!conversation) throw new ApiError("Conversation not found", 404);
  const allowed =
    conversation.kind === "TEAM" ? canAccessTeam(user.role, conversation.team ?? "") : conversation.participants.some((participant) => participant.userId === user.id);
  if (!allowed) throw new ApiError("You don't have access to this conversation", 403);
  return conversation;
}

/** Conversation ids the user can see: accessible team channels plus their direct messages. */
export async function visibleConversationIds(user: SessionUser) {
  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ kind: "TEAM" }, { kind: "DIRECT", participants: { some: { userId: user.id } } }] },
    select: { id: true, kind: true, team: true }
  });
  return conversations.filter((conversation) => conversation.kind === "DIRECT" || canAccessTeam(user.role, conversation.team ?? "")).map((conversation) => conversation.id);
}

/** Unread = messages from other people newer than the user's last read position in that conversation. */
export async function unreadCounts(user: SessionUser, conversationIds: string[]) {
  if (!conversationIds.length) return new Map<string, number>();
  const reads = await prisma.conversationParticipant.findMany({ where: { userId: user.id, conversationId: { in: conversationIds } }, select: { conversationId: true, lastReadAt: true } });
  const readMap = new Map(reads.map((read) => [read.conversationId, read.lastReadAt]));
  const counts = await Promise.all(
    conversationIds.map(async (id) => {
      const since = readMap.get(id);
      const count = await prisma.message.count({ where: { conversationId: id, authorId: { not: user.id }, ...(since ? { createdAt: { gt: since } } : {}) } });
      return [id, count] as const;
    })
  );
  return new Map(counts);
}

export async function markRead(conversationId: string, userId: string, at = new Date()) {
  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: { lastReadAt: at },
    create: { conversationId, userId, lastReadAt: at }
  });
}
