"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Card, Badge, Title, Input, Select, Empty, LoadingGrid, Modal, primaryBtnClass, secondaryBtnClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";

type Customer = { id: string; customerCode: string; name: string };
type PlatformAccount = {
  id: string;
  service: string;
  externalAccountId: string;
  providerName: string;
  adapterKey: string;
  status: string;
  createdAt: string;
  customer: Customer;
};

const services = ["SMS", "WHATSAPP"];

function statusTone(status: string) {
  if (status === "ACTIVE") return "green";
  if (status === "INACTIVE") return "red";
  return "amber";
}

const emptyForm = { customerId: "", service: "SMS", externalAccountId: "", providerName: "" };

export default function PlatformMappingPage() {
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/platform-accounts");
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setAccounts(data.accounts ?? []);
    setLoading(false);
  }

  async function loadCustomers() {
    const res = await fetch("/api/customers?pageSize=100");
    if (res.ok) {
      const data = await res.json();
      setCustomers(data.customers ?? []);
    }
  }

  useEffect(() => {
    load();
    loadCustomers();
  }, []);

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!form.customerId) {
      setFormError("Select a customer before creating a platform mapping.");
      return;
    }
    if (!form.providerName.trim() || !form.externalAccountId.trim()) {
      setFormError("Enter both a provider name and external account ID.");
      return;
    }
    setBusy(true);
    setFormError("");
    const res = await fetch("/api/platform-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFormError(data.error ?? "Could not create the mapping");
      return;
    }
    setShowCreate(false);
    setForm(emptyForm);
    load();
  }

  async function toggleStatus(account: PlatformAccount) {
    const nextStatus = account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await fetch(`/api/platform-accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus })
    });
    if (res.ok) load();
  }

  if (forbidden) return <Empty label="You don't have access to Platform Mapping." />;

  return (
    <div className="space-y-5">
      <Title
        title="Platform Mapping"
        subtitle="Map each customer to their SMS and WhatsApp (WABA) platform account IDs."
        action={
          <button onClick={() => setShowCreate(true)} className={`flex items-center gap-2 ${primaryBtnClass}`}>
            <Plus size={16} /> New Mapping
          </button>
        }
      />

      {loading ? (
        <LoadingGrid />
      ) : accounts.length === 0 ? (
        <Card>
          <Empty label="No platform accounts mapped yet." />
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="p-3">Customer</th>
                <th className="p-3">Service</th>
                <th className="p-3">Provider</th>
                <th className="p-3">External Account ID</th>
                <th className="p-3">Mapped</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-line/60">
                  <td className="p-3 font-semibold text-ink">
                    {account.customer.customerCode} · {account.customer.name}
                  </td>
                  <td className="p-3">{titleCase(account.service)}</td>
                  <td className="p-3">{account.providerName}</td>
                  <td className="p-3 font-mono text-xs">{account.externalAccountId}</td>
                  <td className="p-3">{dateLabel(account.createdAt)}</td>
                  <td className="p-3">
                    <Badge tone={statusTone(account.status)}>{titleCase(account.status)}</Badge>
                  </td>
                  <td className="p-3">
                    <button onClick={() => toggleStatus(account)} className="text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
                      {account.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showCreate ? (
        <Modal title="New Platform Mapping" onClose={() => setShowCreate(false)}>
          {formError ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{formError}</p> : null}
          <form onSubmit={createAccount} className="space-y-3">
            <Select
              label="Customer"
              value={form.customerId}
              onChange={(v) => setForm({ ...form, customerId: v })}
              options={customers.map((c) => c.id)}
              render={(id) => {
                const c = customers.find((c) => c.id === id);
                return c ? `${c.customerCode} — ${c.name}` : "Select a customer";
              }}
            />
            {customers.length === 0 ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
                No customers are available to map yet. Complete a price approval to create a customer, then return here to connect its platform account.
              </p>
            ) : null}
            <Select label="Service" value={form.service} onChange={(v) => setForm({ ...form, service: v })} options={services} render={titleCase} />
            <Input label="Provider Name" value={form.providerName} onChange={(v) => setForm({ ...form, providerName: v })} placeholder="e.g. Karix SMS Gateway" required />
            <Input label="External Account ID" value={form.externalAccountId} onChange={(v) => setForm({ ...form, externalAccountId: v })} placeholder="e.g. ABC123 or WABA-78945" required />
            <button disabled={busy || customers.length === 0 || !form.customerId} className={`w-full ${primaryBtnClass}`}>
              {busy ? "Saving..." : customers.length === 0 ? "No customers to map" : "Create Mapping"}
            </button>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
