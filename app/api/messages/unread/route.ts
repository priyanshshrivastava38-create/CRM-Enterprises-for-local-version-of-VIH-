import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { errorResponse } from "@/lib/api-error";
import { unreadCounts, visibleConversationIds } from "@/lib/messaging-server";

/** Lightweight total for the sidebar badge (polled). */
export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const counts = await unreadCounts(user, await visibleConversationIds(user));
    return NextResponse.json({ total: [...counts.values()].reduce((sum, count) => sum + count, 0) });
  } catch (error) {
    return errorResponse(error);
  }
}
