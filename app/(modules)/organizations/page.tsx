"use client";

import { useEffect, useState } from "react";
import { Badge, Card, Empty, Input, LoadingGrid, Title } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";

type OrganizationRecord = {
  id: string;
  name: string;
  industry?: string | null;
  website?: string | null;
  city?: string | null;
  country?: string | null;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  contacts: Array<{ id: string }>;
  leads: Array<{ id: string }>;
  createdAt: string;
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    const res = await fetch(`/api/organizations?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setOrganizations(data.organizations ?? []);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, [q]);

  if (loading) return <LoadingGrid />;

  return (
    <div className="space-y-5">
      <Title title="Organizations" subtitle="Company-level records used across leads, contacts, and deal workflows." />

      <Card>
        <div className="max-w-md">
          <Input label="Search" value={q} onChange={setQ} placeholder="Name, city, industry" />
        </div>
      </Card>

      {organizations.length === 0 ? (
        <Card><Empty label="No organizations found yet." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {organizations.map((org) => (
            <Card key={org.id} className="min-w-0 p-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="break-words text-lg font-semibold text-ink [overflow-wrap:anywhere]">{org.name}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{org.industry ? titleCase(org.industry) : "Uncategorized"}</p>
                </div>
                {org.tags?.length ? <span className="shrink-0"><Badge tone="slate">{org.tags[0]}</Badge></span> : null}
              </div>
              <div className="mt-4 min-w-0 space-y-2 text-sm text-slate-600 dark:text-slate-300 [&>div]:[overflow-wrap:anywhere]">
                <div>{org.website ?? "No website"}</div>
                <div>{org.city ?? "Unspecified city"}{org.country ? `, ${org.country}` : ""}</div>
                <div>{org.email ?? "No email"}</div>
                <div>{org.phone ?? "No phone"}</div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                <span>{org.contacts.length} contacts</span>
                <span>{org.leads.length} leads</span>
                <span>{dateLabel(org.createdAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
