import {
  BarChart3,
  Briefcase,
  Building2,
  ClipboardList,
  Contact,
  Database,
  FileCheck2,
  FileStack,
  Gauge,
  LayoutDashboard,
  Link2,
  ListChecks,
  Megaphone,
  MessageSquare,
  MessagesSquare,
  Receipt,
  Scale,
  Settings,
  UserCog,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type RoleName = "ADMIN" | "SALES" | "CEO" | "FINANCE" | "OPERATIONS" | "CSO" | "CTO" | "CFO" | "REGIONAL_SALES_HEAD";

export type ModuleNavItem = { label: string; href: string; icon: LucideIcon; roles: RoleName[] };
export type ModuleNavSection = { title: string; items: ModuleNavItem[] };

const ALL: RoleName[] = ["ADMIN", "SALES", "CEO", "FINANCE", "OPERATIONS", "CSO", "CTO", "CFO", "REGIONAL_SALES_HEAD"];
const SALES_TEAM: RoleName[] = ["SALES", "CEO", "ADMIN", "CSO", "REGIONAL_SALES_HEAD"];
const LEADERSHIP: RoleName[] = ["CEO", "ADMIN", "CSO", "CFO"];
const FINANCE_TEAM: RoleName[] = ["FINANCE", "ADMIN", "CFO"];

// Views rendered inside the home page (components/crm-app.tsx) are addressed as "/?view=<slug>".
export const HOME_VIEWS = {
  Dashboard: "",
  Leads: "leads",
  Tasks: "tasks",
  Conversations: "conversations",
  Campaigns: "campaigns",
  Analytics: "analytics",
  Settings: "settings"
} as const;

export type HomeView = keyof typeof HOME_VIEWS;

export function homeViewHref(view: HomeView) {
  return HOME_VIEWS[view] ? `/?view=${HOME_VIEWS[view]}` : "/";
}

export function homeViewFromSlug(slug: string | null): HomeView {
  const match = (Object.keys(HOME_VIEWS) as HomeView[]).find((view) => HOME_VIEWS[view] === (slug ?? ""));
  return match ?? "Dashboard";
}

export const moduleNavSections: ModuleNavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Executive Summary", href: "/ceo-snapshot", icon: Gauge, roles: LEADERSHIP },
      { label: "Dashboard", href: "/", icon: LayoutDashboard, roles: ALL },
      { label: "Messages", href: "/messages", icon: MessagesSquare, roles: ALL },
      { label: "Analytics", href: homeViewHref("Analytics"), icon: BarChart3, roles: SALES_TEAM }
    ]
  },
  {
    title: "Sales",
    items: [
      { label: "Leads", href: homeViewHref("Leads"), icon: Users, roles: SALES_TEAM },
      { label: "Opportunities", href: "/opportunities", icon: Briefcase, roles: SALES_TEAM },
      { label: "Contacts", href: "/contacts", icon: Contact, roles: SALES_TEAM },
      { label: "Organizations", href: "/organizations", icon: Building2, roles: SALES_TEAM },
      { label: "Conversations", href: homeViewHref("Conversations"), icon: MessageSquare, roles: SALES_TEAM },
      { label: "Campaigns", href: homeViewHref("Campaigns"), icon: Megaphone, roles: SALES_TEAM },
      { label: "Tasks", href: homeViewHref("Tasks"), icon: ClipboardList, roles: ALL }
    ]
  },
  {
    title: "Approvals",
    items: [{ label: "Price Approvals", href: "/price-approvals", icon: FileCheck2, roles: ["SALES", "CEO", "FINANCE", "ADMIN", "CSO", "CFO"] }]
  },
  {
    title: "Finance",
    items: [
      { label: "Billing", href: "/billing", icon: Receipt, roles: FINANCE_TEAM },
      { label: "Reconciliation", href: "/reconciliation", icon: Scale, roles: FINANCE_TEAM },
      { label: "Invoices", href: "/invoices", icon: FileStack, roles: ["FINANCE", "SALES", "ADMIN", "CFO"] },
      { label: "Usage", href: "/usage", icon: Database, roles: ["OPERATIONS", "FINANCE", "ADMIN", "CTO", "CFO"] }
    ]
  },
  {
    title: "Customers",
    items: [
      { label: "Customers", href: "/customers", icon: Building2, roles: ["SALES", "CEO", "FINANCE", "OPERATIONS", "ADMIN", "CSO", "CFO"] },
      { label: "Onboarding", href: "/onboarding", icon: ListChecks, roles: ["SALES", "FINANCE", "OPERATIONS", "ADMIN", "CSO", "CFO", "CTO"] },
      { label: "Platform Mapping", href: "/platform-mapping", icon: Link2, roles: ["OPERATIONS", "ADMIN", "CTO"] }
    ]
  },
  {
    title: "Administration",
    items: [
      { label: "User Management", href: "/users", icon: UserCog, roles: ["ADMIN"] },
      { label: "Settings", href: homeViewHref("Settings"), icon: Settings, roles: ALL }
    ]
  }
];

export const moduleNav: ModuleNavItem[] = moduleNavSections.flatMap((section) => section.items);

export function moduleNavSectionsForRole(role: string) {
  return moduleNavSections
    .map((section) => ({ ...section, items: section.items.filter((item) => item.roles.includes(role as RoleName)) }))
    .filter((section) => section.items.length > 0);
}

export function moduleNavForRole(role: string) {
  return moduleNav.filter((item) => item.roles.includes(role as RoleName));
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrator",
  SALES: "Sales",
  CEO: "Chief Executive Officer",
  FINANCE: "Finance",
  OPERATIONS: "Operations",
  CSO: "Chief Sales Officer",
  CTO: "Chief Technology Officer",
  CFO: "Chief Financial Officer",
  REGIONAL_SALES_HEAD: "Regional Sales Head"
};

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

/** Where a role should land right after signing in. */
export function landingPathForRole(role: string) {
  return LEADERSHIP.includes(role as RoleName) && role !== "ADMIN" ? "/ceo-snapshot" : "/";
}

/** Whether a nav item matches the current location; home views match on their ?view= slug. */
export function isNavItemActive(item: ModuleNavItem, pathname: string, view: string | null) {
  const [path, query] = item.href.split("?");
  if (path === "/") {
    if (pathname !== "/") return false;
    return new URLSearchParams(query ?? "").get("view") === (view || null);
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** The section and item for the current location, used for breadcrumbs. */
export function locateNavItem(pathname: string, view: string | null) {
  for (const section of moduleNavSections) {
    const item = section.items.find((candidate) => isNavItemActive(candidate, pathname, view));
    if (item) return { section: section.title, item };
  }
  return null;
}
