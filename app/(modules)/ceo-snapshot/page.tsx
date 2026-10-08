"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, Briefcase, CircleDollarSign, FileCheck2, Landmark, TrendingUp, UserPlus, Users, Wallet } from "lucide-react";
import { Card, Title, Empty, LoadingGrid, fieldClass } from "@/components/shared/ui";
import { BarList, ChartCard, CardLink, Delta, DownloadReportButton, HealthBadge, KpiTile, ReportHeader, TrendChart, type Health } from "@/components/dashboards/kit";
import { inr, inrCompact, titleCase } from "@/lib/format";
import { useGreeting } from "@/components/shell/user-context";

type Snapshot = {
  month: string;
  sales: { newLeads: number; newOpportunities: number; wonCustomers: number; pipelineValue: number; approvedPricingRequests: number; status: Health };
  priceApprovals: { pending: number; approved: number; rejected: number; approvedValue: number; status: Health };
  onboarding: { newCustomers: number; activated: number; inProgress: number; delayed: number; status: Health };
  customers: { total: number; new: number; active: number; inactive: number };
  usage: { smsSubmitted: number; smsDelivered: number; wabaByCategory: { category: string; quantity: number }[] };
  billing: { serviceWise: { SMS: number; WHATSAPP: number }; setupCharges: number; totalBilling: number; previousMonthTotal: number; growthPct: number | null };
  finance: { billingCompleted: number; pendingReconciliation: number; creditsTotal: number; debitsTotal: number; outstanding: number; overdue: number; status: Health };
  operations: { customersPendingActivation: number; technicalTasksPending: number; platformIssues: number; status: Health };
  collections: { invoicesRaised: number; outstandingCount: number; outstandingAmount: number; overdueCount: number; overdueAmount: number; collectionsReceived: number; status: Health };
  trend: { month: string; label: string; revenue: number; collected: number; newLeads: number; wonValue: number }[];
  pipelineByStage: { stage: string; count: number; value: number }[];
  alerts: { severity: "amber" | "red"; message: string }[];
};

function monthName(month: string) {
  const [year, m] = month.split("-").map(Number);
  return new Date(Date.UTC(year, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

export default function ExecutiveSummaryPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch(`/api/dashboards/ceo-snapshot?month=${month}`);
      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }
      if (res.ok) setData(await res.json());
      setLoading(false);
    }
    load();
  }, [month]);

  const greeting = useGreeting();

  if (forbidden) return <Empty label="You don't have access to the Executive Summary." />;

  return (
    <div className="space-y-6">
      <ReportHeader title="Executive Summary" period={monthName(month)} />
      <Title
        title={greeting}
        subtitle={data ? executiveHeadline(data, monthName(month)) : `Company performance across sales, finance, and operations for ${monthName(month)}.`}
        action={
          <div className="flex items-center gap-2 print:hidden">
            <input type="month" aria-label="Reporting month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} className={`!mt-0 h-10 w-44 ${fieldClass}`} />
            <DownloadReportButton />
          </div>
        }
      />

      {loading && !data ? (
        <LoadingGrid />
      ) : !data ? (
        <Empty label="The Executive Summary could not be loaded. Refresh to try again." />
      ) : (
        <div className={`space-y-6 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {data.alerts.length ? (
            <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-500/5">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <AlertTriangle size={16} className="text-amber-600" aria-hidden="true" /> Needs your attention
              </div>
              <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                {data.alerts.map((alert, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${alert.severity === "red" ? "bg-red-500" : "bg-amber-500"}`} aria-hidden="true" />
                    <span>
                      <span className="sr-only">{alert.severity === "red" ? "Critical: " : "Warning: "}</span>
                      {alert.message}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-4">
            <KpiTile label="Revenue billed" icon={CircleDollarSign} href="/billing" value={inrCompact(data.billing.totalBilling)} footer={<Delta value={data.billing.growthPct} />} />
            <KpiTile
              label="Collections received"
              icon={Wallet}
              href="/invoices"
              value={inrCompact(data.collections.collectionsReceived)}
              footer={<span className="text-xs text-slate-500 dark:text-slate-400">{data.collections.invoicesRaised} invoice(s) raised this month</span>}
            />
            <KpiTile
              label="Receivables outstanding"
              icon={Landmark}
              href="/invoices"
              value={inrCompact(data.collections.outstandingAmount)}
              footer={
                <span className={`text-xs ${data.collections.overdueAmount > 0 ? "font-semibold text-red-700 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {data.collections.overdueAmount > 0 ? `${inrCompact(data.collections.overdueAmount)} overdue` : "Nothing overdue"}
                </span>
              }
            />
            <KpiTile
              label="Open pipeline"
              icon={Briefcase}
              href="/opportunities"
              value={inrCompact(data.sales.pipelineValue)}
              footer={<span className="text-xs text-slate-500 dark:text-slate-400">{openDeals(data)} open opportunities</span>}
            />
            <KpiTile label="New leads" icon={UserPlus} href="/?view=leads" value={data.sales.newLeads} footer={<span className="text-xs text-slate-500 dark:text-slate-400">Added this month</span>} />
            <KpiTile label="New opportunities" icon={TrendingUp} href="/opportunities" value={data.sales.newOpportunities} footer={<span className="text-xs text-slate-500 dark:text-slate-400">Created this month</span>} />
            <KpiTile label="New customers" icon={Users} href="/customers" value={data.sales.wonCustomers} footer={<span className="text-xs text-slate-500 dark:text-slate-400">{data.customers.total} customers in total</span>} />
            <KpiTile
              label="Pricing awaiting approval"
              icon={FileCheck2}
              href="/price-approvals"
              value={data.priceApprovals.pending}
              footer={<span className="text-xs text-slate-500 dark:text-slate-400">{data.priceApprovals.approved} approved · {data.priceApprovals.rejected} rejected</span>}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3 print:grid-cols-3">
            <ChartCard title="Revenue vs collections" subtitle="Billed revenue and cash collected, last 6 months" className="xl:col-span-2 print:col-span-2" action={<CardLink href="/billing">Billing</CardLink>}>
              <TrendChart
                data={data.trend}
                series={[
                  { key: "revenue", name: "Revenue billed", color: "var(--series-1)" },
                  { key: "collected", name: "Collected", color: "var(--series-2)" }
                ]}
                format={inr}
                axisFormat={inrCompact}
                empty="No billing or collections recorded in the last 6 months."
              />
            </ChartCard>
            <ChartCard title="Revenue mix" subtitle={`By service, ${monthName(month)}`}>
              <BarList
                items={[
                  { label: "SMS", value: data.billing.serviceWise.SMS },
                  { label: "WhatsApp Business", value: data.billing.serviceWise.WHATSAPP },
                  { label: "Setup charges", value: data.billing.setupCharges }
                ]}
                format={inrCompact}
                empty="No revenue billed this month."
              />
            </ChartCard>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-3">
            <ChartCard title="Pipeline by stage" subtitle="Opportunity value at each stage" action={<CardLink href="/opportunities">Opportunities</CardLink>}>
              <BarList
                items={data.pipelineByStage.map((row) => ({ label: titleCase(row.stage), value: row.value, detail: `· ${row.count}` }))}
                format={inrCompact}
                empty="No opportunities yet."
              />
            </ChartCard>
            <ChartCard title="Lead inflow" subtitle="New leads per month, last 6 months" action={<CardLink href="/?view=leads">Leads</CardLink>}>
              <TrendChart data={data.trend} series={[{ key: "newLeads", name: "New leads", color: "var(--series-1)" }]} height={200} empty="No new leads in the last 6 months." />
            </ChartCard>
            <ChartCard title="Platform usage" subtitle={`Message volume, ${monthName(month)}`} action={<CardLink href="/usage">Usage</CardLink>}>
              <BarList
                items={[
                  { label: "SMS submitted", value: data.usage.smsSubmitted },
                  { label: "SMS delivered", value: data.usage.smsDelivered },
                  ...data.usage.wabaByCategory.map((row) => ({ label: `WhatsApp · ${titleCase(row.category)}`, value: row.quantity }))
                ]}
                empty="No usage imported for this month."
              />
            </ChartCard>
          </div>

          <ChartCard title="Department health" subtitle="Status of each function this month">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-line">
                    <th className="pb-2.5 pr-4 font-medium">Area</th>
                    <th className="pb-2.5 pr-4 font-medium">Key figures</th>
                    <th className="pb-2.5 pr-4 font-medium">Status</th>
                    <th className="pb-2.5 font-medium"><span className="sr-only">Open</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {departmentRows(data).map((row) => (
                    <tr key={row.area}>
                      <td className="whitespace-nowrap py-3 pr-4 font-semibold text-ink">{row.area}</td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{row.figures}</td>
                      <td className="whitespace-nowrap py-3 pr-4"><HealthBadge status={row.status} /></td>
                      <td className="whitespace-nowrap py-3 text-right">
                        <Link href={row.href} className="text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400 print:hidden">Open</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function openDeals(data: Snapshot) {
  return data.pipelineByStage.filter((row) => row.stage !== "WON" && row.stage !== "LOST").reduce((sum, row) => sum + row.count, 0);
}

function departmentRows(data: Snapshot): { area: string; figures: string; status: Health; href: string }[] {
  return [
    { area: "Sales", figures: `${data.sales.newLeads} new leads · ${data.sales.newOpportunities} new opportunities · ${inrCompact(data.sales.pipelineValue)} open pipeline`, status: data.sales.status, href: "/opportunities" },
    { area: "Price approvals", figures: `${data.priceApprovals.pending} pending · ${data.priceApprovals.approved} approved (${inrCompact(data.priceApprovals.approvedValue)}/mo) · ${data.priceApprovals.rejected} rejected`, status: data.priceApprovals.status, href: "/price-approvals" },
    { area: "Onboarding", figures: `${data.onboarding.inProgress} in progress · ${data.onboarding.activated} activated · ${data.onboarding.delayed} blocked`, status: data.onboarding.status, href: "/onboarding" },
    { area: "Finance", figures: `${data.finance.pendingReconciliation} pending reconciliation · credits ${inrCompact(data.finance.creditsTotal)} · debits ${inrCompact(data.finance.debitsTotal)}`, status: data.finance.status, href: "/reconciliation" },
    { area: "Collections", figures: `${inrCompact(data.collections.outstandingAmount)} outstanding · ${inrCompact(data.collections.overdueAmount)} overdue (${data.collections.overdueCount})`, status: data.collections.status, href: "/invoices" },
    { area: "Operations", figures: `${data.operations.customersPendingActivation} awaiting activation · ${data.operations.technicalTasksPending} technical tasks · ${data.operations.platformIssues} platform issues`, status: data.operations.status, href: "/platform-mapping" }
  ];
}

/** One-sentence briefing for the top of the page. */
function executiveHeadline(data: Snapshot, period: string) {
  const growth = data.billing.growthPct;
  const revenue = `${inrCompact(data.billing.totalBilling)} billed in ${period}${growth != null ? ` (${growth >= 0 ? "up" : "down"} ${Math.abs(growth)}% on last month)` : ""}`;
  const attention = data.alerts.length ? `${data.alerts.length} item${data.alerts.length === 1 ? " needs" : "s need"} your attention.` : "Nothing needs your attention.";
  return `${revenue}. ${attention}`;
}
