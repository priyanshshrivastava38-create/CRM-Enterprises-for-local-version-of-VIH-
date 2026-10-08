import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !user.active) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, message: true, read: true, createdAt: true }
    }),
    prisma.notification.count({ where: { userId: user.id, read: false } })
  ]);

  return NextResponse.json({ notifications, unread });
}
