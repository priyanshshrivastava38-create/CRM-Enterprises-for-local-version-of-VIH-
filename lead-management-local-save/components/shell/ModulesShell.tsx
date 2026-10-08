"use client";

import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { Sidebar, type SidebarItem } from "@/components/shell/Sidebar";
import { moduleNavForRole } from "@/components/shell/module-nav";

const workspaceByRole: Record<string, string> = {
  SALES: "Sales & Revenue",
  FINANCE: "Finance & Billing",
  CEO: "Executive Snapshot",
  OPERATIONS: "Operations",
  ADMIN: "Administrator Console"
};

export function ModulesShell({ role, children }: { role: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = workspaceByRole[role] ?? "CRM Workspace";
  const items: SidebarItem[] = [
    { kind: "link", label: "CRM Home", icon: LayoutDashboard, href: "/", active: pathname === "/" },
    ...moduleNavForRole(role).map((item) => ({
      kind: "link" as const,
      label: item.label,
      icon: item.icon,
      href: item.href,
      active: pathname === item.href || pathname.startsWith(`${item.href}/`)
    }))
  ];

  return (
    <div className="flex min-h-screen flex-col bg-app-glow lg:flex-row">
      <Sidebar items={items} subtitle={workspace} workspace={workspace} />
      <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-[1500px]">{children}</div>
      </main>
    </div>
  );
}
