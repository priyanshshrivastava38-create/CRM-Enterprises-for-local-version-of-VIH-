"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Plus, RefreshCcw } from "lucide-react";
import { Card, Badge, Title, Select, Empty, Input, LoadingGrid, secondaryBtnClass, primaryBtnClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";
import { DateField } from "@/components/shared/DateField";

type Customer = { id: string; customerCode: string; name: string };
type PlatformAccount = { id: string; service: string; externalAccountId: string; providerName: string; customer: Customer };
type Batch = {
  id: string;
  fileName?: string | null;
  service: string;
  status: string;
  rowCount: number;
  successCount: number;
  errorCount: number;
  errorLog?: { row: number; message: string }[] | null;
  createdAt: string;
  uploadedBy?: { name: string };
};
type UsageRecord = {
  id: string;
  service: string;
  component: string;
  usageDate: string;
  quantity: number;
  sourceReference?: string | null;
  platformAccount: { externalAccountId: string; customer: Customer };
};

const tabs = ["Import", "Manual Entry", "Browse"] as const;

function batchStatusTone(status: string) {
  if (status === "COMPLETED") return "green";
  if (status === "FAILED") return "red";
  if (status === "PARTIAL") return "amber";
  return "slate";
}

export default function UsagePage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Import");
  const [forbidden, setForbidden] = useState(false);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pulling, setPulling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [importMessage, setImportMessage] = useState("");
  const [manualEntry, setManualEntry] = useState({ usageDate: new Date().toISOString().slice(0, 10), component: "", quantity: "", sourceReference: "" });
  const [manualBusy, setManualBusy] = useState(false);
  const [manualMessage, setManualMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [records, setRecords] = useState<UsageRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [filters, setFilters] = useState({ customerId: "ALL", service: "ALL" });

  async function loadAccounts() {
    const res = await fetch("/api/platform-accounts");
    if (res.ok) {
      const data = await res.json();
      setAccounts(data.accounts ?? []);
      if (data.accounts?.length && !selectedAccountId) setSelectedAccountId(data.accounts[0].id);
    }
  }

  async function loadBatches() {
    const res = await fetch("/api/usage/batches");
    if (res.status === 403) {
      setForbidden(true);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setBatches(data.batches ?? []);
    }
  }

  async function loadRecords() {
    setRecordsLoading(true);
    const params = new URLSearchParams({ pageSize: "100" });
    if (filters.customerId !== "ALL") params.set("customerId", filters.customerId);
    if (filters.service !== "ALL") params.set("service", filters.service);
    const res = await fetch(`/api/usage/records?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setRecords(data.records ?? []);
    }
    setRecordsLoading(false);
  }

  useEffect(() => {
    loadAccounts();
    loadBatches();
  }, []);

  useEffect(() => {
    if (tab === "Browse") loadRecords();
  }, [tab, filters]);

  async function pullUsage() {
    if (!selectedAccountId) return;
    setPulling(true);
    setImportMessage("");
    const res = await fetch(`/api/platform-accounts/${selectedAccountId}/pull-usage`, { method: "POST" });
    setPulling(false);
    if (res.ok) {
      const data = await res.json();
      setImportMessage(`Pulled ${data.batch.successCount} usage rows.`);
      loadBatches();
    } else {
      const data = await res.json().catch(() => ({}));
      setImportMessage(data.error ?? "Could not pull usage.");
    }
  }

  async function uploadCsv(event: React.FormEvent) {
    event.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file || !selectedAccountId) {
      setImportMessage("Choose a platform account and a CSV file first.");
      return;
    }
    setUploading(true);
    setImportMessage("");
    const formData = new FormData();
    formData.set("platformAccountId", selectedAccountId);
    formData.set("file", file);
    const res = await fetch("/api/usage/import", { method: "POST", body: formData });
    setUploading(false);
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setImportMessage(`Imported ${data.batch.successCount} rows${data.batch.errorCount ? `, ${data.batch.errorCount} row(s) had errors` : ""}.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadBatches();
    } else {
      setImportMessage(data.error ?? "Could not import this file.");
    }
  }

  async function createManualUsage(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedAccountId) {
      setManualMessage("Choose a platform account before adding usage.");
      return;
    }
    setManualBusy(true);
    setManualMessage("");
    const res = await fetch("/api/usage/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...manualEntry, platformAccountId: selectedAccountId, quantity: Number(manualEntry.quantity) })
    });
    const data = await res.json().catch(() => ({}));
    setManualBusy(false);
    if (!res.ok) {
      setManualMessage(data.error ?? "Could not add usage record.");
      return;
    }
    setManualMessage("Usage record added.");
    setManualEntry((previous) => ({ ...previous, component: "", quantity: "", sourceReference: "" }));
    await Promise.all([loadBatches(), tab === "Browse" ? loadRecords() : Promise.resolve()]);
  }

  if (forbidden) return <Empty label="You don't have access to Usage." />;

  const customerOptions = Array.from(new Map(accounts.map((a) => [a.customer.id, a.customer])).values());

  return (
    <div className="space-y-5">
      <Title title="Usage" subtitle="Import and browse raw platform usage before it is converted into billable usage." />

      <div className="flex gap-2">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${
              tab === t ? "bg-brand-600 text-white" : "border border-line text-slate-600 hover:bg-panel dark:text-slate-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Import" ? (
        <div className="space-y-4">
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-ink">Pull or Import Usage</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select a mapped platform account, then pull sample data or upload a CSV.</p>
              </div>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">Import</span>
            </div>
            <div className="max-w-2xl space-y-5">
              <Select
                label="Platform Account"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={accounts.map((a) => a.id)}
                render={(id) => {
                  const a = accounts.find((a) => a.id === id);
                  return a ? `${a.customer.customerCode} · ${titleCase(a.service)} · ${a.externalAccountId}` : "Select";
                }}
              />
              {accounts.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">No platform accounts are mapped yet — map one in Platform Mapping first.</p> : null}

              <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end">
                <button type="button" disabled={pulling || !selectedAccountId} onClick={pullUsage} className={`flex w-full items-center justify-center gap-2 sm:w-auto ${primaryBtnClass}`}>
                  <RefreshCcw size={15} /> {pulling ? "Pulling..." : "Pull Usage (Mock)"}
                </button>

                <form onSubmit={uploadCsv} className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <label className="block min-w-0">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">CSV file</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Columns: date, component, quantity</span>
                    <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="mt-2 block min-w-0 max-w-full text-sm file:mr-3 file:rounded-lg file:border file:border-line file:bg-panel file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink" />
                  </label>
                  <button disabled={uploading || !selectedAccountId} className={`${secondaryBtnClass} w-full sm:w-auto`}>
                    <span className="flex items-center gap-2">
                      <Download size={15} /> {uploading ? "Uploading..." : "Import CSV"}
                    </span>
                  </button>
                </form>
              </div>
              {importMessage ? <p className="text-sm text-slate-600 dark:text-slate-300">{importMessage}</p> : null}
            </div>
          </Card>

          <Card className="min-w-0 overflow-hidden p-0">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4 sm:px-6">
              <div><h3 className="font-semibold text-ink">Import History</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recent usage batches and processing results.</p></div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{batches.length} batch{batches.length === 1 ? "" : "es"}</span>
            </div>
            {batches.length === 0 ? (
              <div className="p-5 sm:p-6"><Empty label="No import batches yet." /></div>
            ) : (
              <>
              <div className="divide-y divide-line md:hidden">
                {batches.map((batch) => (
                  <article key={batch.id} className="space-y-2 px-5 py-4">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="min-w-0 break-words text-sm font-semibold text-ink [overflow-wrap:anywhere]">{batch.fileName ?? "Mock pull"}</p>
                      <Badge tone={batchStatusTone(batch.status)}>{titleCase(batch.status)}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Service: {titleCase(batch.service)}</span>
                      <span>Rows: {batch.successCount}/{batch.rowCount}{batch.errorCount ? ` (${batch.errorCount} errors)` : ""}</span>
                      <span className="break-words [overflow-wrap:anywhere]">Uploaded by: {batch.uploadedBy?.name ?? "—"}</span>
                      <span>{dateLabel(batch.createdAt)}</span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Source</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Rows</th>
                    <th className="p-3">Uploaded By</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b border-line/60">
                      <td className="p-3">{batch.fileName ?? "Mock pull"}</td>
                      <td className="p-3">{titleCase(batch.service)}</td>
                      <td className="p-3">
                        {batch.successCount}/{batch.rowCount} {batch.errorCount ? `(${batch.errorCount} errors)` : ""}
                      </td>
                      <td className="p-3">{batch.uploadedBy?.name ?? "—"}</td>
                      <td className="p-3">{dateLabel(batch.createdAt)}</td>
                      <td className="p-3">
                        <Badge tone={batchStatusTone(batch.status)}>{titleCase(batch.status)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              </>
            )}
          </Card>
        </div>
      ) : tab === "Manual Entry" ? (
        <div className="space-y-4">
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="mb-5">
              <h3 className="text-base font-semibold text-ink">Add usage record</h3>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Enter a single usage item directly; it will also appear in import history.</p>
            </div>
            <form onSubmit={createManualUsage} className="max-w-3xl space-y-4">
              <Select
                label="Platform Account"
                value={selectedAccountId}
                onChange={setSelectedAccountId}
                options={accounts.map((account) => account.id)}
                render={(id) => {
                  const account = accounts.find((item) => item.id === id);
                  return account ? `${account.customer.customerCode} · ${titleCase(account.service)} · ${account.externalAccountId}` : "Select an account";
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <DateField label="Usage date" mode="date" value={manualEntry.usageDate} onChange={(value) => setManualEntry({ ...manualEntry, usageDate: value })} required />
                <Input label="Component" value={manualEntry.component} onChange={(value) => setManualEntry({ ...manualEntry, component: value })} placeholder={selectedAccountId ? accounts.find((account) => account.id === selectedAccountId)?.service === "SMS" ? "e.g. DELIVERED" : "e.g. MARKETING" : "Select an account first"} required />
                <Input label="Quantity" type="number" value={manualEntry.quantity} onChange={(value) => setManualEntry({ ...manualEntry, quantity: value })} placeholder="e.g. 1250" required />
                <Input label="Source reference (optional)" value={manualEntry.sourceReference} onChange={(value) => setManualEntry({ ...manualEntry, sourceReference: value })} placeholder="e.g. Batch or external reference" />
              </div>
              {accounts.length === 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">Map a customer platform account before entering usage.</p> : null}
              {manualMessage ? <p role="status" className="text-sm text-slate-600 dark:text-slate-300">{manualMessage}</p> : null}
              <button disabled={manualBusy || !selectedAccountId} className={primaryBtnClass}>
                <Plus size={15} /> {manualBusy ? "Adding..." : "Add Usage Record"}
              </button>
            </form>
          </Card>
        </div>
      ) : (
        <div className="space-y-4">
          <Card className="min-w-0 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Customer"
                value={filters.customerId}
                onChange={(v) => setFilters({ ...filters, customerId: v })}
                options={["ALL", ...customerOptions.map((c) => c.id)]}
                render={(id) => (id === "ALL" ? "All" : `${customerOptions.find((c) => c.id === id)?.customerCode} · ${customerOptions.find((c) => c.id === id)?.name}`)}
              />
              <Select label="Service" value={filters.service} onChange={(v) => setFilters({ ...filters, service: v })} options={["ALL", "SMS", "WHATSAPP"]} render={(v) => (v === "ALL" ? "All" : titleCase(v))} />
            </div>
          </Card>

          {recordsLoading ? (
            <LoadingGrid />
          ) : records.length === 0 ? (
            <Card>
              <Empty label="No raw usage records in this view." />
            </Card>
          ) : (
            <Card className="min-w-0 overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Service</th>
                    <th className="p-3">Component</th>
                    <th className="p-3">Quantity</th>
                    <th className="p-3">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id} className="border-b border-line/60">
                      <td className="p-3">{dateLabel(record.usageDate)}</td>
                      <td className="p-3">
                        {record.platformAccount.customer.customerCode} · {record.platformAccount.customer.name}
                      </td>
                      <td className="p-3">{titleCase(record.service)}</td>
                      <td className="p-3">{record.component}</td>
                      <td className="p-3">{record.quantity.toLocaleString("en-IN")}</td>
                      <td className="p-3 text-xs text-slate-500 dark:text-slate-400">{record.sourceReference ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
