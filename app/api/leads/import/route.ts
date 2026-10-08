import { NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeLeadCsvRows, type CsvRecord } from "@/lib/lead-import";
import { errorResponse } from "@/lib/api-error";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a CSV file to import." }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "The CSV file must be smaller than 5 MB." }, { status: 400 });

    const text = await file.text();
    const records = parse(text, { columns: true, bom: true, skip_empty_lines: true, trim: true }) as CsvRecord[];
    const { rows, errors } = normalizeLeadCsvRows(records);
    if (!rows.length) return NextResponse.json({ error: errors[0] ?? "No valid lead rows found.", errors }, { status: 400 });

    const salesAgents = await prisma.user.findMany({
      where: { role: "SALES", active: true },
      select: { id: true, name: true }
    });
    const agentByName = new Map(salesAgents.map((agent) => [agent.name.toLowerCase(), agent.id]));
    const created: string[] = [];
    const duplicateErrors: string[] = [];

    for (const row of rows) {
      const assignedTo = row.assignedTo ? agentByName.get(row.assignedTo.toLowerCase()) ?? null : null;
      const existing = await prisma.lead.findFirst({
        where: { deletedAt: null, OR: [{ email: row.email }, { phone: row.phone }] },
        select: { id: true }
      });
      if (existing) {
        duplicateErrors.push(`${row.firstName} ${row.lastName}`);
        continue;
      }

      const lead = await prisma.lead.create({
        data: {
          ...row,
          assignedTo,
          activities: { create: { userId: user.id, activityType: "LEAD_IMPORTED", description: `Lead imported by ${user.name}`, metadata: { source: "CSV_IMPORT" } } }
        },
        select: { id: true }
      });
      created.push(lead.id);
    }

    return NextResponse.json({
      imported: created.length,
      skipped: duplicateErrors.length,
      errors: duplicateErrors.length ? [`${duplicateErrors.length} row${duplicateErrors.length === 1 ? "" : "s"} already existed and were skipped.`] : [],
      message: `${created.length} lead${created.length === 1 ? "" : "s"} imported successfully.`
    }, { status: created.length ? 201 : 200 });
  } catch (error) {
    return errorResponse(error);
  }
}
