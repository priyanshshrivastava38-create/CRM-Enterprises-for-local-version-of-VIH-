import { Briefcase, FileCheck2, ListChecks, Building2, Link2, Database, Receipt, Scale, FileStack, Gauge, UserCog } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RoleName = "ADMIN" | "SALES" | "CEO" | "FINANCE" | "OPERATIONS";

export type ModuleNavItem = { label: string; href: string; icon: LucideIcon; roles: RoleName[] };

export const moduleNav: ModuleNavItem[] = [
  { label: "Lead Pipeline", href: "/", icon: Briefcase, roles: ["SALES", "CEO", "ADMIN"] },
  { label: "Opportunities", href: "/opportunities", icon: Briefcase, roles: ["SALES", "CEO", "ADMIN"] },
  { label: "Contacts", href: "/contacts", icon: UserCog, roles: ["SALES", "CEO", "ADMIN"] },
  { label: "Organizations", href: "/organizations", icon: Building2, roles: ["SALES", "CEO", "ADMIN"] },
  { label: "Price Approvals", href: "/price-approvals", icon: FileCheck2, roles: ["SALES", "CEO", "FINANCE", "ADMIN"] },
  { label: "Customer Onboarding", href: "/onboarding", icon: ListChecks, roles: ["SALES", "FINANCE", "OPERATIONS", "ADMIN"] },
  { label: "Customers", href: "/customers", icon: Building2, roles: ["SALES", "CEO", "FINANCE", "OPERATIONS", "ADMIN"] },
  { label: "Platform Mapping", href: "/platform-mapping", icon: Link2, roles: ["OPERATIONS", "ADMIN"] },
  { label: "Usage & Consumption", href: "/usage", icon: Database, roles: ["OPERATIONS", "FINANCE", "ADMIN"] },
  { label: "Billing Runs", href: "/billing", icon: Receipt, roles: ["FINANCE", "ADMIN"] },
  { label: "Reconciliation", href: "/reconciliation", icon: Scale, roles: ["FINANCE", "ADMIN"] },
  { label: "Invoices", href: "/invoices", icon: FileStack, roles: ["FINANCE", "SALES", "ADMIN"] },
  { label: "Executive Snapshot", href: "/ceo-snapshot", icon: Gauge, roles: ["CEO", "ADMIN"] },
  { label: "Team Management", href: "/users", icon: UserCog, roles: ["ADMIN"] }
];

export function moduleNavForRole(role: string) {
  return moduleNav.filter((item) => item.roles.includes(role as RoleName));
}
