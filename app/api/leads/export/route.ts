import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const where = user.role === "SALES" ? { assignedTo: user.id, deletedAt: null } : { deletedAt: null };
  const leads = await prisma.lead.findMany({
    where,
    include: { assignedUser: { select: { name: true } } },
    orderBy: [{ createdAt: "asc" }]
  });

  const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Designation", "City", "Source", "Status", "Priority", "Assigned Agent", "Next Follow-up", "Notes", "Created At"];
  const rows = leads.map((lead) => [
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.phone,
    lead.company,
    lead.designation ?? "",
    lead.city ?? "",
    lead.source,
    lead.status,
    lead.priority,
    lead.assignedUser?.name ?? "",
    lead.nextFollowUpAt ? lead.nextFollowUpAt.toISOString().slice(0, 10) : "",
    lead.notes ?? "",
    lead.createdAt.toISOString()
  ]);

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="crm-leads-export.csv"'
    }
  });
}
