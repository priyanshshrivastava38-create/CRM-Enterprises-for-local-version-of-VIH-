"use client";

import { useEffect, useState } from "react";
import { Briefcase, Building2, CircleDollarSign } from "lucide-react";
import { Delta, KpiTile } from "@/components/dashboards/kit";
import { inrCompact, titleCase } from "@/lib/format";

type Data = {
  customerStatusCounts: { ONBOARDING: number; ACTIVE: number; INACTIVE: number; SUSPENDED: number };
  serviceUsage: { service: string; quantity: number }[];
  currentMonthBilling: number;
  previousMonthBilling: number;
  growthPct: number | null;
  opportunityPipelineValue: number;
};

const SERVICE_LABELS: Record<string, string> = { SMS: "SMS", WHATSAPP: "WhatsApp" };

export function SalesBillingWidgets() {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    fetch("/api/dashboards/sales")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData);
  }, []);

  if (!data) return null;

  const counts = data.customerStatusCounts;
  const totalCustomers = counts.ONBOARDING + counts.ACTIVE + counts.INACTIVE + counts.SUSPENDED;
  const usage = data.serviceUsage.map((u) => `${SERVICE_LABELS[u.service] ?? titleCase(u.service)} ${u.quantity.toLocaleString("en-IN")}`).join(" · ");

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <KpiTile
        label="Customers"
        icon={Building2}
        href="/customers"
        value={totalCustomers}
        footer={<span className="text-xs text-slate-500 dark:text-slate-400">{counts.ACTIVE} active · {counts.ONBOARDING} onboarding · {counts.INACTIVE + counts.SUSPENDED} inactive</span>}
      />
      <KpiTile label="Billed this month" icon={CircleDollarSign} href="/invoices" value={inrCompact(data.currentMonthBilling)} footer={<Delta value={data.growthPct} />} />
      <KpiTile
        label="Open pipeline value"
        icon={Briefcase}
        href="/opportunities"
        value={inrCompact(data.opportunityPipelineValue)}
        footer={<span className="block truncate text-xs text-slate-500 dark:text-slate-400">{usage ? `Usage this month: ${usage}` : "No usage this month"}</span>}
      />
    </div>
  );
}
