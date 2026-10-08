"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Download } from "lucide-react";
import { Card, Badge, Title, Input, Info, Empty, LoadingGrid, primaryBtnClass, secondaryBtnClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";
import { DateField } from "@/components/shared/DateField";

type LineItem = { id: string; lineType: string; service?: string | null; component?: string | null; description: string; quantity?: number | null; rate?: number | null; amount: number };
type Payment = { id: string; amount: number; paidOn: string; method?: string | null; reference?: string | null; recordedBy?: { name: string } };
type Invoice = {
  id: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  subtotal: number;
  setupCharges: number;
  adjustmentsTotal: number;
  totalAmount: number;
  status: string;
  customer: { id: string; customerCode: string; name: string };
  billingRun: { id: string };
  lineItems: LineItem[];
  payments: Payment[];
};

function statusTone(status: string) {
  if (status === "PAID") return "green";
  if (status === "CANCELLED") return "red";
  return "blue";
}

const emptyPaymentForm = { amount: "", paidOn: new Date().toISOString().slice(0, 10), method: "", reference: "" };

export default function InvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/invoices/${params.id}`);
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setInvoice(data.invoice);
    }
    setLoading(false);
  }

  async function loadMe() {
    const res = await fetch("/api/bootstrap");
    if (res.ok) {
      const data = await res.json();
      setCanManage(data.user.role === "FINANCE" || data.user.role === "ADMIN");
    }
  }

  useEffect(() => {
    load();
    loadMe();
  }, [params.id]);

  const paidTotal = invoice?.payments.reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;

  async function recordPayment(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/invoices/${params.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentForm)
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not record this payment");
      return;
    }
    setPaymentForm({ ...emptyPaymentForm, paidOn: new Date().toISOString().slice(0, 10) });
    load();
  }

  if (loading) return <LoadingGrid />;
  if (notFound || !invoice) return <Empty label="Invoice not found." />;

  return (
    <div className="space-y-5">
      <Title
        title={invoice.invoiceNumber}
        subtitle={`${invoice.customer.customerCode} · ${invoice.customer.name}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={statusTone(invoice.status)}>{titleCase(invoice.status)}</Badge>
            <a href={`/api/invoices/export?ids=${invoice.id}`} className={`flex items-center gap-2 ${secondaryBtnClass}`}>
              <Download size={15} /> Export CSV
            </a>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold">Line Items</h3>
            <table className="mt-3 w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2">Type</th>
                  <th className="py-2">Description</th>
                  <th className="py-2">Qty</th>
                  <th className="py-2">Rate</th>
                  <th className="py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((li) => (
                  <tr key={li.id} className="border-b border-line/60">
                    <td className="py-2">
                      <Badge tone={li.lineType === "ADJUSTMENT" ? "amber" : "slate"}>{titleCase(li.lineType)}</Badge>
                    </td>
                    <td className="py-2">{li.description}</td>
                    <td className="py-2">{li.quantity != null ? li.quantity.toLocaleString("en-IN") : "—"}</td>
                    <td className="py-2">{li.rate != null ? `₹${li.rate}` : "—"}</td>
                    <td className="py-2 text-right">₹{Number(li.amount).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card>
            <h3 className="font-semibold">Payments</h3>
            <div className="mt-3 space-y-2">
              {invoice.payments.length ? (
                invoice.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-sm">
                    <span>
                      {dateLabel(p.paidOn)} {p.method ? `· ${p.method}` : ""} {p.reference ? `· ${p.reference}` : ""}
                    </span>
                    <span className="font-semibold">₹{Number(p.amount).toLocaleString("en-IN")}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No payments recorded yet.</p>
              )}
            </div>

            {canManage && invoice.status !== "PAID" && invoice.status !== "CANCELLED" ? (
              <form onSubmit={recordPayment} className="mt-4 space-y-3 border-t border-line pt-4">
                {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Amount (₹)" type="number" value={paymentForm.amount} onChange={(v) => setPaymentForm({ ...paymentForm, amount: v })} required />
                  <DateField label="Paid On" mode="date" value={paymentForm.paidOn} onChange={(v) => setPaymentForm({ ...paymentForm, paidOn: v })} required />
                  <Input label="Method" value={paymentForm.method} onChange={(v) => setPaymentForm({ ...paymentForm, method: v })} placeholder="e.g. NEFT" />
                  <Input label="Reference" value={paymentForm.reference} onChange={(v) => setPaymentForm({ ...paymentForm, reference: v })} />
                </div>
                <button disabled={busy} className={`w-full ${primaryBtnClass}`}>
                  {busy ? "Recording..." : "Record Payment"}
                </button>
              </form>
            ) : null}
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <h3 className="font-semibold">Summary</h3>
            <div className="mt-3 space-y-2">
              <Info label="Billing Period" value={`${dateLabel(invoice.periodStart)} – ${dateLabel(invoice.periodEnd)}`} />
              <Info label="Issue Date" value={dateLabel(invoice.issueDate)} />
              <Info label="Due Date" value={dateLabel(invoice.dueDate)} />
            </div>
            <div className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Usage</span>
                <span>₹{Number(invoice.subtotal).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Setup</span>
                <span>₹{Number(invoice.setupCharges).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Adjustments</span>
                <span>₹{Number(invoice.adjustmentsTotal).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
                <span>Total</span>
                <span>₹{Number(invoice.totalAmount).toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Paid</span>
                <span>₹{paidTotal.toLocaleString("en-IN")}</span>
              </div>
            </div>
          </Card>

          <Link href={`/billing/${invoice.billingRun.id}`} className="block text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
            View billing run →
          </Link>
          <Link href={`/customers/${invoice.customer.id}`} className="block text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">
            View customer profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
