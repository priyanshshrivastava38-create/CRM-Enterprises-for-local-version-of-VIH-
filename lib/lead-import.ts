import { LeadStatus, Priority } from "@prisma/client";
import { z } from "zod";

export type CsvRecord = Record<string, string | undefined>;

export type NormalizedLeadCsvRow = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  designation?: string | null;
  city?: string | null;
  source: string;
  status: LeadStatus;
  priority: Priority;
  assignedTo?: string | null;
  nextFollowUpAt?: Date | null;
  notes?: string | null;
};

const aliases: Record<keyof NormalizedLeadCsvRow, string[]> = {
  firstName: ["first name", "firstname"],
  lastName: ["last name", "lastname"],
  email: ["email", "email address"],
  phone: ["phone", "phone number", "mobile", "mobile number"],
  company: ["company", "company name", "account"],
  designation: ["designation", "job title", "role"],
  city: ["city", "location"],
  source: ["source", "lead source", "campaign source"],
  status: ["status", "lead status"],
  priority: ["priority", "lead priority"],
  assignedTo: ["assigned agent", "assigned to", "owner", "sales agent"],
  nextFollowUpAt: ["next follow-up", "next follow up", "next followup", "follow-up date", "follow up date"],
  notes: ["notes", "comments", "description"]
};

const requiredFields: (keyof NormalizedLeadCsvRow)[] = ["firstName", "lastName", "email", "phone", "company"];
const fieldLabels: Record<keyof NormalizedLeadCsvRow, string> = {
  firstName: "First Name",
  lastName: "Last Name",
  email: "Email",
  phone: "Phone",
  company: "Company",
  designation: "Designation",
  city: "City",
  source: "Source",
  status: "Status",
  priority: "Priority",
  assignedTo: "Assigned Agent",
  nextFollowUpAt: "Next Follow-up",
  notes: "Notes"
};
const statusValues = new Set(Object.values(LeadStatus));
const priorityValues = new Set(Object.values(Priority));

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, " ");
}

function findValue(row: CsvRecord, field: keyof NormalizedLeadCsvRow) {
  const normalizedAliases = aliases[field].map((alias) => normalizeHeader(alias));
  const key = Object.keys(row).find((candidate) => normalizedAliases.includes(normalizeHeader(candidate)));
  return key ? row[key]?.trim() : "";
}

export function normalizeLeadCsvRows(rows: CsvRecord[]) {
  const normalized: NormalizedLeadCsvRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const values = Object.fromEntries(
      (Object.keys(aliases) as (keyof NormalizedLeadCsvRow)[]).map((field) => [field, findValue(row, field)])
    ) as Record<keyof NormalizedLeadCsvRow, string>;

    const missing = requiredFields.filter((field) => !values[field]);
    const email = values.email;
    const phone = values.phone;
    const errorsForRow: string[] = [];

    if (missing.length) errorsForRow.push(`Missing required field${missing.length > 1 ? "s" : ""}: ${missing.map((field) => fieldLabels[field]).join(", ")}`);
    if (email && !z.string().email().safeParse(email).success) errorsForRow.push("Invalid Email");
    if (phone && phone.replace(/\D/g, "").length < 7) errorsForRow.push("Invalid Phone");

    if (values.status && !statusValues.has(values.status as LeadStatus)) errorsForRow.push("Invalid Status");
    if (values.priority && !priorityValues.has(values.priority as Priority)) errorsForRow.push("Invalid Priority");
    if (values.nextFollowUpAt && Number.isNaN(Date.parse(values.nextFollowUpAt))) errorsForRow.push("Invalid Next Follow-up date");

    if (errorsForRow.length) {
      errors.push(`row ${rowNumber}: ${errorsForRow.join("; ")}`);
      return;
    }

    normalized.push({
      firstName: values.firstName,
      lastName: values.lastName,
      email,
      phone,
      company: values.company,
      designation: values.designation || null,
      city: values.city || null,
      source: values.source || "Manual",
      status: (values.status || "NEW") as LeadStatus,
      priority: (values.priority || "WARM") as Priority,
      assignedTo: values.assignedTo || null,
      nextFollowUpAt: values.nextFollowUpAt ? new Date(values.nextFollowUpAt) : null,
      notes: values.notes || null
    });
  });

  return { rows: normalized, errors };
}
