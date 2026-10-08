export type ReceivableInvoice = {
  totalAmount: number;
  dueDate: Date | string;
  status: string;
  payments: { amount: number }[];
};

export type ReceivableMetrics = {
  outstandingAmount: number;
  overdueAmount: number;
  openInvoiceCount: number;
  overdueInvoiceCount: number;
  aging: { current: number; days1To30: number; days31To60: number; days61To90: number; days90Plus: number };
};

export function calculateReceivables(invoices: ReceivableInvoice[], asOf = new Date()): ReceivableMetrics {
  const aging: ReceivableMetrics["aging"] = { current: 0, days1To30: 0, days31To60: 0, days61To90: 0, days90Plus: 0 };
  let outstandingAmount = 0;
  let overdueAmount = 0;
  let openInvoiceCount = 0;
  let overdueInvoiceCount = 0;

  for (const invoice of invoices) {
    if (["PAID", "CANCELLED"].includes(invoice.status)) continue;
    const paid = invoice.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
    const remaining = Math.max(0, Math.round((Number(invoice.totalAmount) - paid + Number.EPSILON) * 100) / 100);
    if (remaining === 0) continue;

    outstandingAmount += remaining;
    openInvoiceCount += 1;
    const daysPastDue = Math.floor((asOf.getTime() - new Date(invoice.dueDate).getTime()) / 86_400_000);
    if (daysPastDue < 0) {
      aging.current += remaining;
    } else {
      overdueAmount += remaining;
      overdueInvoiceCount += 1;
      if (daysPastDue <= 30) aging.days1To30 += remaining;
      else if (daysPastDue <= 60) aging.days31To60 += remaining;
      else if (daysPastDue <= 90) aging.days61To90 += remaining;
      else aging.days90Plus += remaining;
    }
  }

  return {
    outstandingAmount: roundCurrency(outstandingAmount),
    overdueAmount: roundCurrency(overdueAmount),
    openInvoiceCount,
    overdueInvoiceCount,
    aging: {
      current: roundCurrency(aging.current),
      days1To30: roundCurrency(aging.days1To30),
      days31To60: roundCurrency(aging.days31To60),
      days61To90: roundCurrency(aging.days61To90),
      days90Plus: roundCurrency(aging.days90Plus)
    }
  };
}

function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}