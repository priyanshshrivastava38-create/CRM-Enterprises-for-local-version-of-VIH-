import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse } from "@/lib/api-error";
import { directConversationKey } from "@/lib/messaging";

/** Opens (or creates) the direct conversation between the current user and another active user. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(await request.json());
    if (userId === user.id) throw new ApiError("You can't message yourself", 400);
    const other = await prisma.user.findFirst({ where: { id: userId, active: true }, select: { id: true } });
    if (!other) throw new ApiError("That person isn't available", 404);
    const conversation = await prisma.conversation.upsert({
      where: { key: directConversationKey(user.id, other.id) },
      update: {},
      create: { key: directConversationKey(user.id, other.id), kind: "DIRECT", participants: { create: [{ userId: user.id }, { userId: other.id }] } },
      select: { id: true }
    });
    return NextResponse.json({ id: conversation.id });
  } catch (error) {
    return errorResponse(error);
  }
}
