"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Building2, ArrowRight, Columns3, List, CalendarClock, AlertTriangle, CircleDollarSign } from "lucide-react";
import { Card, Badge, Title, Input, Textarea, Select, Info, Empty, LoadingGrid, Modal, Drawer, primaryBtnClass, secondaryBtnClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";
import { calculatePipelineMetrics, OPPORTUNITY_STAGE_PROBABILITY } from "@/lib/pipeline-metrics";

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
  probability?: number;
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
  updatedAt: string;
};
type Lead = { id: string; firstName: string; lastName: string; company: string; status: string };

const statuses = ["NEW", "QUALIFYING", "PROPOSAL", "WON", "LOST"];
const services = ["SMS", "WHATSAPP"];
const activePipelineStages = ["NEW", "QUALIFYING", "PROPOSAL"];
const stageProbability = OPPORTUNITY_STAGE_PROBABILITY;

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

function money(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function daysInStage(updatedAt: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(updatedAt).getTime()) / 86_400_000));
}

export default function OpportunitiesPage() {
  const [me, setMe] = useState<UserRef & { role: string }>();
  const [users, setUsers] = useState<UserRef[]>([]);
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [pipelineSummary, setPipelineSummary] = useState<{ stages: Record<string, { count: number; value: number }>; openDealCount: number; totalValue: number; averageDealSize: number; stalledCount: number } | null>(null);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ q: "", status: "ALL" });
  const [view, setView] = useState<"board" | "list">("board");
  const [draggedOpportunity, setDraggedOpportunity] = useState<string | null>(null);
  const [movingOpportunity, setMovingOpportunity] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState("");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"new" | "fromLead">("new");
  const [form, setForm] = useState(emptyOpportunityForm);
  const [convertForm, setConvertForm] = useState(emptyConvertForm);
  const [convertibleLeads, setConvertibleLeads] = useState<Lead[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [noteText, setNoteText] = useState("");
  const [docForm, setDocForm] = useState({ title: "", url: "" });
  const [lostReason, setLostReason] = useState("");
  const [showLostForm, setShowLostForm] = useState(false);

  const salesUsers = useMemo(() => users.filter((u) => u.role === "SALES" || u.role === "ADMIN"), [users]);
  const openOpportunities = useMemo(() => opportunities.filter((opportunity) => !["WON", "LOST"].includes(opportunity.status)), [opportunities]);
  const pipelineTotals = useMemo(() => {
    const calculated = calculatePipelineMetrics(openOpportunities.map((opportunity) => ({
      ...opportunity,
      opportunityValue: Number(opportunity.opportunityValue)
    })));
    const weightedVisible = calculated.weightedValue;
    const weightedPipeline = pipelineSummary
      ? Object.entries(pipelineSummary.stages).reduce((sum, [stage, metrics]) => sum + (activePipelineStages.includes(stage) ? metrics.value * (stageProbability[stage] ?? 0) / 100 : 0), 0)
      : weightedVisible;
    return {
      total: pipelineSummary?.totalValue ?? calculated.totalValue,
      weighted: Math.round(weightedPipeline * 100) / 100,
      average: pipelineSummary?.averageDealSize ?? calculated.averageDealSize,
      aged: pipelineSummary?.stalledCount ?? calculated.stalledCount,
      openDealCount: pipelineSummary?.openDealCount ?? calculated.openDealCount
    };
  }, [openOpportunities, pipelineSummary]);

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
    const params = new URLSearchParams(view === "board" ? { view: "pipeline", page: "1", pageSize: "10000" } : { page: String(page), pageSize: "25" });
    if (filters.q) params.set("q", filters.q);
    if (filters.status !== "ALL") params.set("status", filters.status);
    const res = await fetch(`/api/opportunities?${params.toString()}`);
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setOpportunities(data.opportunities ?? []);
    setPipelineSummary(data.pipeline ?? null);
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

  async function moveOpportunity(opportunity: Opportunity, nextStatus: string) {
    if (movingOpportunity || opportunity.status === nextStatus || !activePipelineStages.includes(nextStatus)) return;
    setMovingOpportunity(opportunity.id);
    setPipelineError("");
    const response = await fetch(`/api/opportunities/${opportunity.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    const result = await response.json().catch(() => ({}));
    setMovingOpportunity(null);
    if (!response.ok) {
      setPipelineError(result.error ?? "Could not move this opportunity.");
      return;
    }
    await loadOpportunities();
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
        subtitle="Manage deal momentum, forecast weighted revenue, and advance qualified customers."
        action={
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
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: "Open pipeline", value: `${money(pipelineTotals.total)} · ${pipelineTotals.openDealCount} deals`, Icon: Building2 },
          { label: "Weighted pipeline", value: money(pipelineTotals.weighted), Icon: CircleDollarSign },
          { label: "Average deal", value: money(pipelineTotals.average), Icon: ArrowRight },
          { label: "Stalled 14+ days", value: String(pipelineTotals.aged), Icon: CalendarClock }
        ] satisfies { label: string; value: string; Icon: typeof Building2 }[]).map(({ label, value, Icon }) => (
          <Card key={label} className="p-4">
            <div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span><Icon size={16} className="text-brand-600 dark:text-brand-400" /></div>
            <div className="mt-2 text-xl font-semibold text-ink">{value}</div>
          </Card>
        ))}
      </div>

      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <Input label="Search" value={filters.q} onChange={(v) => setFilters({ ...filters, q: v })} placeholder="Name, company, email" />
          <Select label="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={["ALL", ...statuses]} render={(v) => (v === "ALL" ? "All" : titleCase(v))} />
          <div className="flex items-end">
            <button onClick={() => (page === 1 ? loadOpportunities() : setPage(1))} className={`${secondaryBtnClass}`}>
              Apply
            </button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-ink">Sales pipeline</h2><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Weighted value uses stage probability. Won deals are created through approved pricing.</p></div>
        <div className="inline-flex rounded-xl border border-line bg-surface p-1">
          <button type="button" onClick={() => setView("board")} aria-pressed={view === "board"} className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${view === "board" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-panel dark:text-slate-300"}`}><Columns3 size={15} /> Board</button>
          <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${view === "list" ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-panel dark:text-slate-300"}`}><List size={15} /> List</button>
        </div>
      </div>

      {pipelineError ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-300">{pipelineError}</p> : null}
      {view === "board" && pagination.total > opportunities.length ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Showing the first {opportunities.length.toLocaleString("en-IN")} of {pagination.total.toLocaleString("en-IN")} deals. Narrow by search or status to load a smaller board.</p> : null}

      {loading ? (
        <LoadingGrid />
      ) : opportunities.length === 0 ? (
        <Card>
          <Empty label="No opportunities yet. Create one, or convert a lead." />
        </Card>
      ) : view === "board" ? (
        <div className="grid gap-3 xl:grid-cols-5">
          {statuses.map((stage) => {
            const stageOpportunities = opportunities.filter((opportunity) => opportunity.status === stage);
            const canDrop = activePipelineStages.includes(stage);
            const stageSummary = pipelineSummary?.stages[stage];
            const stageValue = stageSummary?.value ?? stageOpportunities.reduce((sum, opportunity) => sum + Number(opportunity.opportunityValue), 0);
            const stageCount = stageSummary?.count ?? stageOpportunities.length;
            return (
              <section
                key={stage}
                aria-label={`${titleCase(stage)} opportunities`}
                onDragOver={(event) => { if (canDrop) event.preventDefault(); }}
                onDrop={(event) => {
                  event.preventDefault();
                  const opportunity = opportunities.find((item) => item.id === (event.dataTransfer.getData("text/plain") || draggedOpportunity));
                  if (opportunity && canDrop) void moveOpportunity(opportunity, stage);
                  setDraggedOpportunity(null);
                }}
                className={`min-h-56 rounded-xl border p-2.5 ${draggedOpportunity && canDrop ? "border-brand-400 bg-brand-50/50 dark:bg-brand-500/5" : "border-line bg-panel/50"}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2 border-b border-line pb-2">
                  <div><h3 className="text-xs font-semibold uppercase tracking-wide text-ink">{titleCase(stage)}</h3><p className="mt-1 text-[11px] text-slate-500">{stageCount} deals · {money(stageValue)}</p></div>
                  <Badge tone={statusTone(stage)}>{stage === "WON" ? "100%" : stage === "LOST" ? "0%" : `${stageProbability[stage]}%`}</Badge>
                </div>
                <div className="space-y-2">
                  {stageOpportunities.map((opportunity) => {
                    const days = daysInStage(opportunity.updatedAt);
                    const risk = activePipelineStages.includes(stage) && days >= 14;
                    return (
                      <article
                        key={opportunity.id}
                        draggable={canDrop && movingOpportunity !== opportunity.id}
                        onDragStart={(event) => { setDraggedOpportunity(opportunity.id); event.dataTransfer.setData("text/plain", opportunity.id); event.dataTransfer.effectAllowed = "move"; }}
                        onDragEnd={() => setDraggedOpportunity(null)}
                        className={`rounded-lg border border-line bg-surface p-3 shadow-card ${canDrop ? "cursor-grab active:cursor-grabbing" : ""} ${movingOpportunity === opportunity.id ? "opacity-50" : ""}`}
                      >
                        <button type="button" onClick={() => openOpportunity(opportunity.id)} className="w-full text-left">
                          <span className="block truncate text-sm font-semibold text-ink">{opportunity.companyName}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500 dark:text-slate-400">{opportunity.name}</span>
                          <span className="mt-3 block text-base font-semibold text-ink">{money(Number(opportunity.opportunityValue))}</span>
                          <span className="mt-2 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400"><span className="truncate">{opportunity.salesOwner?.name ?? "Unassigned"}</span><span>{stageProbability[stage] ?? 0}% · {money(Number(opportunity.opportunityValue) * (stageProbability[stage] ?? 0) / 100)}</span></span>
                          <span className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2 text-[11px]"><span className={risk ? "flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}>{risk ? <AlertTriangle size={12} /> : null}{risk ? "Stalled" : "In stage"} · {days}d</span><span className="text-slate-500 dark:text-slate-400">{opportunity.expectedStartDate ? dateLabel(opportunity.expectedStartDate) : "No start date"}</span></span>
                        </button>
                      </article>
                    );
                  })}
                  {stageOpportunities.length === 0 ? <p className="px-2 py-4 text-center text-xs text-slate-400">Drop a deal here</p> : null}
                  {stage === "WON" ? <p className="px-2 py-2 text-[11px] text-slate-500">Won when pricing is approved.</p> : null}
                </div>
              </section>
            );
          })}
        </div>
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
                <Input label="Expected Start Date" type="date" value={form.expectedStartDate} onChange={(v) => setForm({ ...form, expectedStartDate: v })} />
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
                <Input label="Expected Start Date" type="date" value={convertForm.expectedStartDate} onChange={(v) => setConvertForm({ ...convertForm, expectedStartDate: v })} />
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
