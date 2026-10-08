"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, Badge, Title, Input, Textarea, Select, Info, Empty, LoadingGrid, Modal, Drawer, primaryBtnClass, secondaryBtnClass, fieldClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";
import { SERVICE_COMPONENTS } from "@/lib/billing/constants";
import { DateField } from "@/components/shared/DateField";
import { DEAL_MANAGER_ROLES } from "@/lib/rbac";

type Slab = { minVolume: number | ""; maxVolume: number | "" | null; rate: number | "" };
type LineItem = { service: string; component: string; rateType: string; flatRate: number | ""; expectedVolume: number | ""; billingMetric: string; slabs: Slab[] };
type UserRef = { id: string; name: string; role?: string };
type Opportunity = { id: string; name: string; companyName: string; status: string };
type Customer = { id: string; customerCode: string; name: string };
type ParRequest = {
  id: string;
  requestNumber: string;
  status: string;
  opportunityId?: string | null;
  customerId?: string | null;
  opportunity?: { id: string; name: string; companyName: string } | null;
  customer?: { id: string; customerCode: string; name: string } | null;
  requestedBy?: UserRef;
  reviewedBy?: UserRef | null;
  proposedEffectiveDate: string;
  setupCost?: string | number | null;
  paymentTerms?: string | null;
  commercialTerms?: string | null;
  expectedMonthlyRevenue?: string | number | null;
  expectedMarginPct?: string | number | null;
  reason?: string | null;
  reviewComments?: string | null;
  reviewedAt?: string | null;
  lineItems: LineItem[];
  createdAt: string;
};

const statusTabs = ["ALL", "DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "RETURNED_FOR_REVISION"];
const services = ["SMS", "WHATSAPP"];
const rateTypes = ["FLAT", "SLAB"];

const emptyLineItem: LineItem = { service: "SMS", component: "", rateType: "FLAT", flatRate: "", expectedVolume: "", billingMetric: "PER_UNIT", slabs: [] };

function emptyForm() {
  return {
    mode: "opportunity" as "opportunity" | "customer",
    opportunityId: "",
    customerId: "",
    proposedEffectiveDate: "",
    setupCost: "",
    paymentTerms: "",
    commercialTerms: "",
    expectedMonthlyRevenue: "",
    expectedMarginPct: "",
    reason: "",
    lineItems: [{ ...emptyLineItem }]
  };
}

function statusTone(status: string) {
  if (status === "APPROVED") return "green";
  if (status === "REJECTED") return "red";
  if (status === "RETURNED_FOR_REVISION") return "amber";
  if (status === "SUBMITTED") return "blue";
  return "slate";
}

export default function PriceApprovalsPage() {
  return (
    <Suspense fallback={<LoadingGrid />}>
      <PriceApprovalsContent />
    </Suspense>
  );
}

function PriceApprovalsContent() {
  const searchParams = useSearchParams();
  const [me, setMe] = useState<UserRef & { role: string }>();
  const [requests, setRequests] = useState<ParRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const [selected, setSelected] = useState<ParRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | "return" | null>(null);
  const [reviewComments, setReviewComments] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const canReview = me?.role === "CEO" || me?.role === "ADMIN";
  const canCreate = !!me && (DEAL_MANAGER_ROLES as readonly string[]).includes(me.role);

  async function loadMe() {
    const res = await fetch("/api/bootstrap");
    if (!res.ok) return;
    const data = await res.json();
    setMe(data.user);
  }

  async function loadRequests() {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "100" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const res = await fetch(`/api/price-approvals?${params.toString()}`);
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setRequests(data.requests ?? []);
    setLoading(false);
  }

  async function loadPickers() {
    const [oppRes, custRes] = await Promise.all([fetch("/api/opportunities?pageSize=100"), fetch("/api/customers?pageSize=100")]);
    if (oppRes.ok) {
      const data = await oppRes.json();
      setOpportunities((data.opportunities ?? []).filter((o: Opportunity) => o.status !== "WON" && o.status !== "LOST"));
    }
    if (custRes.ok) {
      const data = await custRes.json();
      setCustomers(data.customers ?? []);
    }
  }

  useEffect(() => {
    loadMe();
    loadPickers();
  }, []);

  useEffect(() => {
    loadRequests();
  }, [statusFilter]);

  useEffect(() => {
    const opportunityId = searchParams.get("opportunityId");
    if (opportunityId) {
      setForm({ ...emptyForm(), mode: "opportunity", opportunityId });
      setEditingId(null);
      setShowForm(true);
    } else if (searchParams.get("create") && canCreate) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, canCreate]);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setFormError("");
    setShowForm(true);
  }

  async function openDetail(id: string) {
    const res = await fetch(`/api/price-approvals/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data.request);
    setReviewAction(null);
    setReviewComments("");
    setReviewError("");
  }

  function openEdit(request: ParRequest) {
    setForm({
      mode: request.opportunityId ? "opportunity" : "customer",
      opportunityId: request.opportunityId ?? "",
      customerId: request.customerId ?? "",
      proposedEffectiveDate: request.proposedEffectiveDate.slice(0, 10),
      setupCost: request.setupCost != null ? String(request.setupCost) : "",
      paymentTerms: request.paymentTerms ?? "",
      commercialTerms: request.commercialTerms ?? "",
      expectedMonthlyRevenue: request.expectedMonthlyRevenue != null ? String(request.expectedMonthlyRevenue) : "",
      expectedMarginPct: request.expectedMarginPct != null ? String(request.expectedMarginPct) : "",
      reason: request.reason ?? "",
      lineItems: request.lineItems.map((li) => ({
        service: li.service,
        component: li.component,
        rateType: li.rateType,
        flatRate: li.flatRate ?? "",
        expectedVolume: li.expectedVolume ?? "",
        billingMetric: li.billingMetric,
        slabs: li.slabs.map((s) => ({ minVolume: s.minVolume, maxVolume: s.maxVolume, rate: s.rate }))
      }))
    });
    setEditingId(request.id);
    setSelected(null);
    setFormError("");
    setShowForm(true);
  }

  function buildPayload() {
    return {
      opportunityId: form.mode === "opportunity" ? form.opportunityId || null : null,
      customerId: form.mode === "customer" ? form.customerId || null : null,
      proposedEffectiveDate: form.proposedEffectiveDate,
      setupCost: form.setupCost === "" ? null : Number(form.setupCost),
      paymentTerms: form.paymentTerms || null,
      commercialTerms: form.commercialTerms || null,
      expectedMonthlyRevenue: form.expectedMonthlyRevenue === "" ? null : Number(form.expectedMonthlyRevenue),
      expectedMarginPct: form.expectedMarginPct === "" ? null : Number(form.expectedMarginPct),
      reason: form.reason || null,
      lineItems: form.lineItems.map((li) => ({
        service: li.service,
        component: li.component,
        rateType: li.rateType,
        flatRate: li.rateType === "FLAT" ? Number(li.flatRate || 0) : null,
        expectedVolume: li.expectedVolume === "" ? null : Number(li.expectedVolume),
        billingMetric: li.billingMetric,
        slabs:
          li.rateType === "SLAB"
            ? li.slabs.map((s) => ({ minVolume: Number(s.minVolume || 0), maxVolume: s.maxVolume === "" || s.maxVolume == null ? null : Number(s.maxVolume), rate: Number(s.rate || 0) }))
            : []
      }))
    };
  }

  async function saveDraft(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    const url = editingId ? `/api/price-approvals/${editingId}` : "/api/price-approvals";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Could not save the request");
      return;
    }
    setShowForm(false);
    loadRequests();
  }

  async function submitRequest(id: string) {
    const res = await fetch(`/api/price-approvals/${id}/submit`, { method: "POST" });
    if (res.ok) {
      loadRequests();
      openDetail(id);
    }
  }

  async function deleteRequest(id: string) {
    const res = await fetch(`/api/price-approvals/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSelected(null);
      loadRequests();
    }
  }

  async function runReview() {
    if (!selected || !reviewAction) return;
    if (reviewAction !== "approve" && !reviewComments.trim()) {
      setReviewError("A reason is required");
      return;
    }
    setReviewBusy(true);
    setReviewError("");
    const path = reviewAction === "approve" ? "approve" : reviewAction === "reject" ? "reject" : "return";
    const res = await fetch(`/api/price-approvals/${selected.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: reviewComments || undefined })
    });
    setReviewBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setReviewError(data.error ?? "Could not complete this action");
      return;
    }
    setReviewAction(null);
    setReviewComments("");
    loadRequests();
    openDetail(selected.id);
  }

  const editable = useMemo(() => selected && (selected.status === "DRAFT" || selected.status === "RETURNED_FOR_REVISION"), [selected]);

  if (forbidden) {
    return <Empty label="You don't have access to Price Approvals." />;
  }

  return (
    <div className="space-y-5">
      <Title
        title="Price Approvals"
        subtitle="Submit pricing for CEO approval. Approved requests become the customer's official Rate Plan."
        action={
          canCreate ? (
            <button onClick={openCreate} className={`flex items-center gap-2 ${primaryBtnClass}`}>
              <Plus size={16} /> New Request
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {statusTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setStatusFilter(tab)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === tab ? "bg-brand-600 text-white" : "border border-line text-slate-600 hover:bg-panel dark:text-slate-300"
            }`}
          >
            {tab === "ALL" ? "All" : titleCase(tab)}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingGrid />
      ) : requests.length === 0 ? (
        <Card>
          <Empty label="No price approval requests in this view." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-3">Request</th>
                <th className="p-3">For</th>
                <th className="p-3">Requested By</th>
                <th className="p-3">Effective Date</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req.id} onClick={() => openDetail(req.id)} className="cursor-pointer border-b border-line/60 transition-colors hover:bg-panel/60">
                  <td className="p-3 font-semibold text-ink">{req.requestNumber}</td>
                  <td className="p-3">{req.opportunity ? req.opportunity.companyName : req.customer ? `${req.customer.customerCode} · ${req.customer.name}` : "—"}</td>
                  <td className="p-3">{req.requestedBy?.name ?? "—"}</td>
                  <td className="p-3">{dateLabel(req.proposedEffectiveDate)}</td>
                  <td className="p-3">
                    <Badge tone={statusTone(req.status)}>{titleCase(req.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showForm ? (
        <Modal title={editingId ? "Edit Price Approval Request" : "New Price Approval Request"} onClose={() => setShowForm(false)} wide>
          {formError ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{formError}</p> : null}
          <form onSubmit={saveDraft} className="space-y-4">
            <div className="flex gap-2">
              <button type="button" onClick={() => setForm({ ...form, mode: "opportunity" })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${form.mode === "opportunity" ? "bg-brand-600 text-white" : secondaryBtnClass}`}>
                New Deal
              </button>
              <button type="button" onClick={() => setForm({ ...form, mode: "customer" })} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${form.mode === "customer" ? "bg-brand-600 text-white" : secondaryBtnClass}`}>
                Existing Customer (Repricing)
              </button>
            </div>

            {form.mode === "opportunity" ? (
              <Select
                label="Opportunity"
                value={form.opportunityId}
                onChange={(v) => setForm({ ...form, opportunityId: v })}
                options={["", ...opportunities.map((o) => o.id)]}
                render={(id) => {
                  const opp = opportunities.find((o) => o.id === id);
                  return opp ? `${opp.name} — ${opp.companyName}` : "Select an opportunity";
                }}
              />
            ) : (
              <Select
                label="Customer"
                value={form.customerId}
                onChange={(v) => setForm({ ...form, customerId: v })}
                options={["", ...customers.map((c) => c.id)]}
                render={(id) => {
                  const c = customers.find((c) => c.id === id);
                  return c ? `${c.customerCode} — ${c.name}` : "Select a customer";
                }}
              />
            )}

            <div className="grid gap-3 sm:grid-cols-3">
              <DateField label="Proposed Effective Date" mode="date" value={form.proposedEffectiveDate} onChange={(v) => setForm({ ...form, proposedEffectiveDate: v })} required />
              <Input label="One-time Setup Cost (₹)" type="number" value={form.setupCost} onChange={(v) => setForm({ ...form, setupCost: v })} />
              <Input label="Payment Terms" value={form.paymentTerms} onChange={(v) => setForm({ ...form, paymentTerms: v })} placeholder="e.g. Net 30" />
              <Input label="Expected Monthly Revenue (₹)" type="number" value={form.expectedMonthlyRevenue} onChange={(v) => setForm({ ...form, expectedMonthlyRevenue: v })} />
              <Input label="Expected Margin (%)" type="number" value={form.expectedMarginPct} onChange={(v) => setForm({ ...form, expectedMarginPct: v })} />
            </div>
            <Textarea label="Commercial Terms" value={form.commercialTerms} onChange={(v) => setForm({ ...form, commercialTerms: v })} />
            <Textarea label="Reason / Remarks" value={form.reason} onChange={(v) => setForm({ ...form, reason: v })} />

            <LineItemsEditor lineItems={form.lineItems} onChange={(items) => setForm({ ...form, lineItems: items })} />

            <button disabled={busy} className={`w-full ${primaryBtnClass}`}>
              {busy ? "Saving..." : editingId ? "Save Changes" : "Save as Draft"}
            </button>
          </form>
        </Modal>
      ) : null}

      {selected ? (
        <Drawer title={selected.requestNumber} onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(selected.status)}>{titleCase(selected.status)}</Badge>
              {selected.opportunity ? <span className="text-sm text-slate-500 dark:text-slate-400">{selected.opportunity.companyName}</span> : null}
              {selected.customer ? (
                <Link href={`/customers/${selected.customer.id}`} className="text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
                  {selected.customer.customerCode} — {selected.customer.name}
                </Link>
              ) : null}
            </div>

            <Card>
              <h3 className="font-semibold">Commercial Terms</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Info label="Effective Date" value={dateLabel(selected.proposedEffectiveDate)} />
                <Info label="Setup Cost" value={selected.setupCost != null ? `₹${Number(selected.setupCost).toLocaleString("en-IN")}` : "None"} />
                <Info label="Payment Terms" value={selected.paymentTerms || "Not set"} />
                <Info label="Expected Monthly Revenue" value={selected.expectedMonthlyRevenue != null ? `₹${Number(selected.expectedMonthlyRevenue).toLocaleString("en-IN")}` : "Not set"} />
                <Info label="Expected Margin" value={selected.expectedMarginPct != null ? `${selected.expectedMarginPct}%` : "Not set"} />
                <Info label="Requested By" value={selected.requestedBy?.name ?? "—"} />
              </div>
              {selected.reason ? <div className="mt-3"><Info label="Reason" value={selected.reason} /></div> : null}
              {selected.commercialTerms ? <div className="mt-3"><Info label="Commercial Terms" value={selected.commercialTerms} /></div> : null}
            </Card>

            <Card>
              <h3 className="font-semibold">Rate Line Items</h3>
              <div className="mt-3 space-y-3">
                {selected.lineItems.map((li, i) => (
                  <div key={i} className="rounded-xl border border-line p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{titleCase(li.service)} · {li.component}</span>
                      <Badge>{li.rateType === "FLAT" ? "Flat Rate" : "Slab"}</Badge>
                    </div>
                    {li.expectedVolume ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Expected volume: {Number(li.expectedVolume).toLocaleString("en-IN")}/month</p> : null}
                    {li.rateType === "FLAT" ? (
                      <p className="mt-2 text-sm">₹{li.flatRate} per unit</p>
                    ) : (
                      <table className="mt-2 w-full text-sm">
                        <tbody>
                          {li.slabs.map((s, si) => (
                            <tr key={si} className="border-t border-line/60">
                              <td className="py-1 pr-2">{Number(s.minVolume).toLocaleString("en-IN")}{s.maxVolume != null ? ` – ${Number(s.maxVolume).toLocaleString("en-IN")}` : "+"}</td>
                              <td className="py-1 text-right">₹{s.rate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {selected.reviewComments ? (
              <Card>
                <h3 className="font-semibold">Review Comments</h3>
                <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{selected.reviewComments}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {selected.reviewedBy?.name} · {selected.reviewedAt ? dateLabel(selected.reviewedAt) : ""}
                </p>
              </Card>
            ) : null}

            {editable ? (
              <Card>
                <h3 className="font-semibold">Actions</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => openEdit(selected)} className={secondaryBtnClass}>Edit</button>
                  <button onClick={() => submitRequest(selected.id)} className={primaryBtnClass}>Submit for Approval</button>
                  {selected.status === "DRAFT" ? (
                    <button onClick={() => deleteRequest(selected.id)} className="rounded-xl border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-500/10">
                      Delete
                    </button>
                  ) : null}
                </div>
              </Card>
            ) : null}

            {selected.status === "SUBMITTED" && canReview ? (
              <Card>
                <h3 className="font-semibold">CEO Review</h3>
                {reviewError ? <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{reviewError}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setReviewAction("approve")} className={`${primaryBtnClass} ${reviewAction === "approve" ? "ring-2 ring-brand-300" : ""}`}>Approve</button>
                  <button onClick={() => setReviewAction("return")} className={`${secondaryBtnClass} ${reviewAction === "return" ? "ring-2 ring-amber-300" : ""}`}>Send Back for Revision</button>
                  <button onClick={() => setReviewAction("reject")} className="rounded-xl border border-red-200 px-3.5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-500/10">
                    Reject
                  </button>
                </div>
                {reviewAction ? (
                  <div className="mt-3 space-y-2">
                    <Textarea label={reviewAction === "approve" ? "Comments (optional)" : "Reason (required)"} value={reviewComments} onChange={setReviewComments} />
                    <button disabled={reviewBusy} onClick={runReview} className={`w-full ${primaryBtnClass}`}>
                      {reviewBusy ? "Submitting..." : `Confirm ${titleCase(reviewAction)}`}
                    </button>
                  </div>
                ) : null}
              </Card>
            ) : null}
          </div>
        </Drawer>
      ) : null}
    </div>
  );
}

function LineItemsEditor({ lineItems, onChange }: { lineItems: LineItem[]; onChange: (items: LineItem[]) => void }) {
  function update(index: number, patch: Partial<LineItem>) {
    onChange(lineItems.map((li, i) => (i === index ? { ...li, ...patch } : li)));
  }
  function updateSlab(index: number, slabIndex: number, patch: Partial<Slab>) {
    const slabs = lineItems[index].slabs.map((s, si) => (si === slabIndex ? { ...s, ...patch } : s));
    update(index, { slabs });
  }

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Rate Line Items</div>
      <div className="mt-2 space-y-3">
        {lineItems.map((li, index) => (
          <div key={index} className="rounded-xl border border-line p-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <Select label="Service" value={li.service} onChange={(v) => update(index, { service: v, component: "" })} options={services} render={titleCase} />
              <label className="block">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Component</span>
                <input
                  list={`components-${index}`}
                  value={li.component}
                  onChange={(e) => update(index, { component: e.target.value.toUpperCase() })}
                  placeholder="e.g. SUBMITTED"
                  className={`h-10 ${fieldClass}`}
                />
                <datalist id={`components-${index}`}>
                  {(SERVICE_COMPONENTS[li.service] ?? []).map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </label>
              <Select label="Rate Type" value={li.rateType} onChange={(v) => update(index, { rateType: v })} options={rateTypes} render={(v) => (v === "FLAT" ? "Flat Rate" : "Slab")} />
              <Input label="Expected Monthly Volume" type="number" value={li.expectedVolume} onChange={(v) => update(index, { expectedVolume: v === "" ? "" : Number(v) })} />
            </div>

            {li.rateType === "FLAT" ? (
              <div className="mt-2 max-w-xs">
                <Input label="Rate per unit (₹)" type="number" value={li.flatRate} onChange={(v) => update(index, { flatRate: v === "" ? "" : Number(v) })} />
              </div>
            ) : (
              <div className="mt-2">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Slabs</div>
                <div className="mt-1 space-y-2">
                  {li.slabs.map((slab, slabIndex) => (
                    <div key={slabIndex} className="grid grid-cols-[1fr_1fr_1fr_auto] items-end gap-2">
                      <Input label="Min Volume" type="number" value={slab.minVolume} onChange={(v) => updateSlab(index, slabIndex, { minVolume: v === "" ? "" : Number(v) })} />
                      <Input label="Max Volume (blank = above)" type="number" value={slab.maxVolume ?? ""} onChange={(v) => updateSlab(index, slabIndex, { maxVolume: v === "" ? null : Number(v) })} />
                      <Input label="Rate (₹)" type="number" value={slab.rate} onChange={(v) => updateSlab(index, slabIndex, { rate: v === "" ? "" : Number(v) })} />
                      <button type="button" onClick={() => update(index, { slabs: li.slabs.filter((_, si) => si !== slabIndex) })} className="h-10 rounded-lg border border-line px-3 text-sm text-slate-500 hover:bg-panel">
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => update(index, { slabs: [...li.slabs, { minVolume: "", maxVolume: null, rate: "" }] })}
                  className="mt-1 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400"
                >
                  + Add slab
                </button>
              </div>
            )}

            <button type="button" onClick={() => onChange(lineItems.filter((_, i) => i !== index))} className="mt-2 text-sm text-red-600 hover:text-red-700">
              Remove line item
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => onChange([...lineItems, { ...emptyLineItem }])} className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
        + Add line item
      </button>
    </div>
  );
}
