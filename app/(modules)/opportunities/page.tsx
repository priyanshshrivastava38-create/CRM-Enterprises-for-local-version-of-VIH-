"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Building2, ArrowRight, Columns3, List, MessagesSquare } from "lucide-react";
import { DealBoard } from "@/components/opportunities/DealBoard";
import { Card, Badge, Title, Input, Textarea, Select, Info, Empty, LoadingGrid, Modal, Drawer, primaryBtnClass, secondaryBtnClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";
import { DateField } from "@/components/shared/DateField";

type UserRef = { id: string; name: string; role?: string };
type Requirement = { id?: string; service: string; expectedMonthlyVolume: number; notes?: string | null };
type Opportunity = {
  id: string;
  name: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  billingAddress?: string | null;
  gstNumber?: string | null;
  expectedStartDate?: string | null;
  opportunityValue: string | number;
  status: string;
  lostReason?: string | null;
  salesOwnerId: string;
  salesOwner?: UserRef;
  requirements?: Requirement[];
  documents?: { id: string; title: string; url: string; createdAt: string; uploadedBy?: UserRef }[];
  activities?: { id: string; activityType: string; description: string; createdAt: string; user?: UserRef }[];
  priceApprovals?: { id: string; requestNumber: string; status: string }[];
  customer?: { id: string; customerCode: string; status: string } | null;
  lead?: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
};
type Lead = { id: string; firstName: string; lastName: string; company: string; status: string };

const statuses = ["NEW", "QUALIFYING", "PROPOSAL", "WON", "LOST"];
const services = ["SMS", "WHATSAPP"];

const emptyRequirement: Requirement = { service: "SMS", expectedMonthlyVolume: 0, notes: "" };

const emptyOpportunityForm = {
  name: "",
  companyName: "",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  billingAddress: "",
  gstNumber: "",
  expectedStartDate: "",
  opportunityValue: "",
  salesOwnerId: "",
  requirements: [{ ...emptyRequirement }]
};

const emptyConvertForm = {
  leadId: "",
  opportunityValue: "",
  expectedStartDate: "",
  requirements: [{ ...emptyRequirement }]
};

function statusTone(status: string) {
  if (status === "WON") return "green";
  if (status === "LOST") return "red";
  if (status === "PROPOSAL") return "amber";
  return "blue";
}

export default function OpportunitiesPage() {
  const [me, setMe] = useState<UserRef & { role: string }>();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: "", status: "ALL" });
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [view, setView] = useState<"board" | "list">("board");
  const [createMode, setCreateMode] = useState<"new" | "fromLead">("new");
  const [form, setForm] = useState(emptyOpportunityForm);
  const [convertForm, setConvertForm] = useState(emptyConvertForm);
  const [convertibleLeads, setConvertibleLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [selected, setSelected] = useState<Opportunity | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem("vih_opportunity_view") === "list") setView("list");
    } catch {
      // Board stays the default when storage is unavailable.
    }
  }, []);

  function changeView(next: "board" | "list") {
    setView(next);
    setPage(1);
    try {
      localStorage.setItem("vih_opportunity_view", next);
    } catch {
      // The choice still applies for this visit.
    }
  }

  // "Create → Opportunity" links here with ?create=1; deal links shared in Messages use ?open=<id>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("create")) setShowCreate(true);
    const openId = params.get("open");
    if (openId) void openOpportunity(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [noteText, setNoteText] = useState("");
  const [docForm, setDocForm] = useState({ title: "", url: "" });
  const [lostReason, setLostReason] = useState("");
  const [showLostForm, setShowLostForm] = useState(false);

  const salesUsers = useMemo(() => users.filter((u) => u.role === "SALES" || u.role === "CEO" || u.role === "ADMIN"), [users]);

  async function loadUsers() {
    const res = await fetch("/api/bootstrap");
    if (!res.ok) return;
    const data = await res.json();
    setMe(data.user);
    setUsers(data.users ?? []);
    setForm((prev) => (prev.salesOwnerId ? prev : { ...prev, salesOwnerId: data.user?.id ?? "" }));
  }

  async function loadOpportunities() {
    setLoading(true);
    // The board shows every stage at once, so it loads all deals (up to 100) and ignores the status filter.
    const params = new URLSearchParams(view === "board" ? { page: "1", pageSize: "100" } : { page: String(page), pageSize: "25" });
    if (filters.q) params.set("q", filters.q);
    if (view === "list" && filters.status !== "ALL") params.set("status", filters.status);
    const res = await fetch(`/api/opportunities?${params.toString()}`);
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setOpportunities(data.opportunities ?? []);
    setPagination(data.pagination ?? pagination);
    setLoading(false);
  }

  async function loadConvertibleLeads() {
    const res = await fetch(`/api/leads?pageSize=100`);
    if (!res.ok) return;
    const data = await res.json();
    setConvertibleLeads((data.leads ?? []).filter((l: Lead) => l.status !== "CONVERTED"));
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    loadOpportunities();
  }, [page, filters.status, view]);

  async function openOpportunity(id: string) {
    const res = await fetch(`/api/opportunities/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data.opportunity);
    setShowLostForm(false);
    setLostReason("");
  }

  function updateRequirement(list: Requirement[], index: number, patch: Partial<Requirement>) {
    return list.map((r, i) => (i === index ? { ...r, ...patch } : r));
  }

  async function createOpportunity(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const res = await fetch("/api/opportunities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, requirements: form.requirements.filter((r) => r.expectedMonthlyVolume > 0) })
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Could not create opportunity");
      return;
    }
    setShowCreate(false);
    setForm({ ...emptyOpportunityForm, salesOwnerId: me?.id ?? "" });
    loadOpportunities();
  }

  async function convertLead(event: React.FormEvent) {
    event.preventDefault();
    if (!convertForm.leadId) {
      setFormError("Pick a lead to convert");
      return;
    }
    setBusy(true);
    setFormError("");
    const res = await fetch(`/api/leads/${convertForm.leadId}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        opportunityValue: convertForm.opportunityValue,
        expectedStartDate: convertForm.expectedStartDate || null,
        requirements: convertForm.requirements.filter((r) => r.expectedMonthlyVolume > 0)
      })
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Could not convert this lead");
      return;
    }
    setShowCreate(false);
    setConvertForm(emptyConvertForm);
    loadOpportunities();
  }

  async function updateStatus(status: string, reason?: string) {
    if (!selected) return;
    const res = await fetch(`/api/opportunities/${selected.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, lostReason: reason })
    });
    if (res.ok) {
      openOpportunity(selected.id);
      loadOpportunities();
      setShowLostForm(false);
    }
  }

  async function addNote(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !noteText.trim()) return;
    const res = await fetch(`/api/opportunities/${selected.id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: noteText })
    });
    if (res.ok) {
      setNoteText("");
      openOpportunity(selected.id);
    }
  }

  async function addDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !docForm.title || !docForm.url) return;
    const res = await fetch(`/api/opportunities/${selected.id}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(docForm)
    });
    if (res.ok) {
      setDocForm({ title: "", url: "" });
      openOpportunity(selected.id);
    }
  }

  if (forbidden) {
    return <Empty label="You don't have access to Opportunities." />;
  }

  return (
    <div className="space-y-5">
      <Title
        title="Opportunities"
        subtitle="Manage customers from first enquiry through to onboarding-ready."
        action={
          <div className="flex items-center gap-2">
          <div role="group" aria-label="View" className="inline-flex rounded-xl border border-line bg-surface p-1">
            {([["board", Columns3, "Board"], ["list", List, "List"]] as const).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => changeView(value)}
                aria-pressed={view === value}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${view === value ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300" : "text-slate-500 hover:text-ink dark:text-slate-400"}`}
              >
                <Icon size={15} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              setShowCreate(true);
              setCreateMode("new");
              setFormError("");
            }}
            className={`flex items-center gap-2 ${primaryBtnClass}`}
          >
            <Plus size={16} /> New Opportunity
          </button>
          </div>
        }
      />

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Search" value={filters.q} onChange={(v) => setFilters({ ...filters, q: v })} placeholder="Name, company, email" />
          {view === "list" ? <Select label="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={["ALL", ...statuses]} render={(v) => (v === "ALL" ? "All" : titleCase(v))} /> : null}
          <div className="flex items-end">
            <button onClick={() => (page === 1 ? loadOpportunities() : setPage(1))} className={`${secondaryBtnClass}`}>
              Apply
            </button>
          </div>
        </div>
      </Card>

      {loading && !(view === "board" && opportunities.length) ? (
        <LoadingGrid />
      ) : view === "board" ? (
        <DealBoard deals={opportunities} canEdit={me?.role === "SALES" || me?.role === "CEO" || me?.role === "ADMIN"} onOpen={openOpportunity} onChanged={loadOpportunities} />
      ) : opportunities.length === 0 ? (
        <Card>
          <Empty label="No opportunities yet. Create one, or convert a lead." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-3">Opportunity</th>
                <th className="p-3">Company</th>
                <th className="p-3">Sales Owner</th>
                <th className="p-3">Value</th>
                <th className="p-3">Expected Start</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.map((opp) => (
                <tr key={opp.id} onClick={() => openOpportunity(opp.id)} className="cursor-pointer border-b border-line/60 transition-colors hover:bg-panel/60">
                  <td className="p-3 font-semibold text-ink">{opp.name}</td>
                  <td className="p-3">{opp.companyName}</td>
                  <td className="p-3">{opp.salesOwner?.name ?? "—"}</td>
                  <td className="p-3">₹{Number(opp.opportunityValue).toLocaleString("en-IN")}</td>
                  <td className="p-3">{opp.expectedStartDate ? dateLabel(opp.expectedStartDate) : "—"}</td>
                  <td className="p-3">
                    <Badge tone={statusTone(opp.status)}>{titleCase(opp.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
            <span>
              Page {pagination.page} of {pagination.totalPages} · {pagination.total} total
            </span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className={`${secondaryBtnClass} disabled:opacity-40`}>
                Prev
              </button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className={`${secondaryBtnClass} disabled:opacity-40`}>
                Next
              </button>
            </div>
          </div>
        </Card>
      )}

      {showCreate ? (
        <Modal title={createMode === "new" ? "New Opportunity" : "Convert Lead to Opportunity"} onClose={() => setShowCreate(false)} wide>
          <div className="mb-4 flex gap-2">
            <button onClick={() => setCreateMode("new")} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${createMode === "new" ? "bg-brand-600 text-white" : secondaryBtnClass}`}>
              New
            </button>
            <button
              onClick={() => {
                setCreateMode("fromLead");
                loadConvertibleLeads();
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${createMode === "fromLead" ? "bg-brand-600 text-white" : secondaryBtnClass}`}
            >
              From Lead
            </button>
          </div>

          {formError ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{formError}</p> : null}

          {createMode === "new" ? (
            <form onSubmit={createOpportunity} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Opportunity Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
                <Input label="Company" value={form.companyName} onChange={(v) => setForm({ ...form, companyName: v })} required />
                <Input label="Contact Name" value={form.contactName} onChange={(v) => setForm({ ...form, contactName: v })} required />
                <Input label="Contact Email" type="email" value={form.contactEmail} onChange={(v) => setForm({ ...form, contactEmail: v })} required />
                <Input label="Contact Phone" value={form.contactPhone} onChange={(v) => setForm({ ...form, contactPhone: v })} required />
                <Input label="GST Number" value={form.gstNumber} onChange={(v) => setForm({ ...form, gstNumber: v })} />
                <Input label="Billing Address" value={form.billingAddress} onChange={(v) => setForm({ ...form, billingAddress: v })} />
                <DateField label="Expected Start Date" mode="date" value={form.expectedStartDate} onChange={(v) => setForm({ ...form, expectedStartDate: v })} />
                <Input label="Opportunity Value (₹)" type="number" value={form.opportunityValue} onChange={(v) => setForm({ ...form, opportunityValue: v })} required />
                <Select label="Sales Owner" value={form.salesOwnerId} onChange={(v) => setForm({ ...form, salesOwnerId: v })} options={salesUsers.map((u) => u.id)} render={(id) => salesUsers.find((u) => u.id === id)?.name ?? "Select"} />
              </div>
              <RequirementsEditor requirements={form.requirements} onChange={(reqs) => setForm({ ...form, requirements: reqs })} />
              <button disabled={busy} className={`w-full ${primaryBtnClass}`}>
                {busy ? "Creating..." : "Create Opportunity"}
              </button>
            </form>
          ) : (
            <form onSubmit={convertLead} className="space-y-4">
              <Select
                label="Lead"
                value={convertForm.leadId}
                onChange={(v) => setConvertForm({ ...convertForm, leadId: v })}
                options={["", ...convertibleLeads.map((l) => l.id)]}
                render={(id) => {
                  const lead = convertibleLeads.find((l) => l.id === id);
                  return lead ? `${lead.firstName} ${lead.lastName} — ${lead.company}` : "Select a lead";
                }}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label="Opportunity Value (₹)" type="number" value={convertForm.opportunityValue} onChange={(v) => setConvertForm({ ...convertForm, opportunityValue: v })} required />
                <DateField label="Expected Start Date" mode="date" value={convertForm.expectedStartDate} onChange={(v) => setConvertForm({ ...convertForm, expectedStartDate: v })} />
              </div>
              <RequirementsEditor requirements={convertForm.requirements} onChange={(reqs) => setConvertForm({ ...convertForm, requirements: reqs })} />
              <button disabled={busy} className={`w-full ${primaryBtnClass}`}>
                {busy ? "Converting..." : "Convert to Opportunity"}
              </button>
            </form>
          )}
        </Modal>
      ) : null}

      {selected ? (
        <Drawer title={selected.name} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(selected.status)}>{titleCase(selected.status)}</Badge>
              {selected.customer ? (
                <Link href={`/customers/${selected.customer.id}`} className="flex items-center gap-1 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
                  <Building2 size={14} /> {selected.customer.customerCode} <ArrowRight size={12} />
                </Link>
              ) : null}
              {selected.lead ? <span className="text-xs text-slate-500 dark:text-slate-400">From lead: {selected.lead.firstName} {selected.lead.lastName}</span> : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                ["FINANCE", "Discuss with Finance"],
                ["SALES", "Discuss with Sales"]
              ].map(([team, label]) => (
                <Link
                  key={team}
                  href={`/messages?team=${team}&recordType=opportunity&recordId=${selected.id}&recordLabel=${encodeURIComponent(`${selected.companyName} · ₹${Number(selected.opportunityValue).toLocaleString("en-IN")} · ${titleCase(selected.status)}`)}`}
                  className={`flex items-center gap-1.5 ${secondaryBtnClass}`}
                >
                  <MessagesSquare size={15} aria-hidden="true" /> {label}
                </Link>
              ))}
            </div>

            <Card>
              <h3 className="font-semibold">Contact & Commercial</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Company" value={selected.companyName} />
                <Info label="Contact" value={selected.contactName} />
                <Info label="Email" value={selected.contactEmail} />
                <Info label="Phone" value={selected.contactPhone} />
                <Info label="GST" value={selected.gstNumber || "Not set"} />
                <Info label="Billing Address" value={selected.billingAddress || "Not set"} />
                <Info label="Opportunity Value" value={`₹${Number(selected.opportunityValue).toLocaleString("en-IN")}`} />
                <Info label="Expected Start" value={selected.expectedStartDate ? dateLabel(selected.expectedStartDate) : "Not set"} />
                <Info label="Sales Owner" value={selected.salesOwner?.name ?? "Unassigned"} />
              </div>
              {selected.requirements?.length ? (
                <div className="mt-4">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Requirements</div>
                  <div className="mt-2 space-y-1">
                    {selected.requirements.map((r) => (
                      <div key={r.id} className="text-sm text-ink">
                        {titleCase(r.service)}: {r.expectedMonthlyVolume.toLocaleString("en-IN")} / month {r.notes ? `— ${r.notes}` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>

            {selected.status !== "WON" && selected.status !== "LOST" ? (
              <Card>
                <h3 className="font-semibold">Actions</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/price-approvals?opportunityId=${selected.id}`} className={`${primaryBtnClass}`}>
                    Create Price Approval Request
                  </Link>
                  <button onClick={() => setShowLostForm(true)} className={secondaryBtnClass}>
                    Mark Lost
                  </button>
                </div>
                {showLostForm ? (
                  <div className="mt-3 space-y-2">
                    <Textarea label="Reason" value={lostReason} onChange={setLostReason} />
                    <button onClick={() => updateStatus("LOST", lostReason)} className={secondaryBtnClass}>
                      Confirm Lost
                    </button>
                  </div>
                ) : null}
              </Card>
            ) : null}

            {selected.priceApprovals?.length ? (
              <Card>
                <h3 className="font-semibold">Price Approval Requests</h3>
                <div className="mt-3 space-y-2">
                  {selected.priceApprovals.map((par) => (
                    <div key={par.id} className="flex items-center justify-between rounded-xl border border-line p-3">
                      <span className="font-medium">{par.requestNumber}</span>
                      <Badge tone={par.status === "APPROVED" ? "green" : par.status === "REJECTED" ? "red" : "amber"}>{titleCase(par.status)}</Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            <Card>
              <h3 className="font-semibold">Documents</h3>
              <div className="mt-3 space-y-2">
                {selected.documents?.length ? (
                  selected.documents.map((doc) => (
                    <a key={doc.id} href={doc.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-line p-3 text-sm hover:bg-panel/50">
                      <div className="font-medium text-brand-700 dark:text-brand-400">{doc.title}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{dateLabel(doc.createdAt)} · {doc.uploadedBy?.name}</div>
                    </a>
                  ))
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400">No documents linked yet.</p>
                )}
              </div>
              <form onSubmit={addDocument} className="mt-3 flex flex-wrap items-end gap-2">
                <div className="min-w-[140px] flex-1">
                  <Input label="Title" value={docForm.title} onChange={(v) => setDocForm({ ...docForm, title: v })} />
                </div>
                <div className="min-w-[200px] flex-1">
                  <Input label="Link" value={docForm.url} onChange={(v) => setDocForm({ ...docForm, url: v })} placeholder="https://..." />
                </div>
                <button className={secondaryBtnClass}>Add</button>
              </form>
            </Card>

            <Card>
              <h3 className="font-semibold">Notes & Activity</h3>
              <div className="mt-3 space-y-3">
                {selected.activities?.map((activity) => (
                  <div key={activity.id} className="border-l-2 border-brand-100 pl-3">
                    <div className="text-sm font-semibold">{titleCase(activity.activityType)}</div>
                    <div className="text-sm text-slate-600 dark:text-slate-300">{activity.description}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {dateLabel(activity.createdAt)} · {activity.user?.name ?? "System"}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={addNote} className="mt-4 space-y-2">
                <Textarea label="Add a note" value={noteText} onChange={setNoteText} />
                <button className={`w-full ${secondaryBtnClass}`}>Add Note</button>
              </form>
            </Card>
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}

function RequirementsEditor({ requirements, onChange }: { requirements: Requirement[]; onChange: (reqs: Requirement[]) => void }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Service Requirements</div>
      <div className="mt-2 space-y-2">
        {requirements.map((req, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
            <Select label="Service" value={req.service} onChange={(v) => onChange(requirements.map((r, i) => (i === index ? { ...r, service: v } : r)))} options={services} render={titleCase} />
            <Input label="Monthly Volume" type="number" value={req.expectedMonthlyVolume} onChange={(v) => onChange(requirements.map((r, i) => (i === index ? { ...r, expectedMonthlyVolume: Number(v) } : r)))} />
            <Input label="Notes" value={req.notes ?? ""} onChange={(v) => onChange(requirements.map((r, i) => (i === index ? { ...r, notes: v } : r)))} />
            <button type="button" onClick={() => onChange(requirements.filter((_, i) => i !== index))} className="h-10 rounded-lg border border-line px-3 text-sm text-slate-500 hover:bg-panel">
              Remove
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...requirements, { ...emptyRequirement }])} className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
        + Add requirement
      </button>
    </div>
  );
}
