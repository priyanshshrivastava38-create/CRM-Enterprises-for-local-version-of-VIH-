"use client";

import { Sidebar, type ShellUser } from "@/components/shell/Sidebar";
import { TopBar } from "@/components/shell/TopBar";
import { ShellUserProvider } from "@/components/shell/user-context";

export function ModulesShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return (
    <ShellUserProvider value={user}>
      <div className="flex min-h-screen flex-col bg-app-glow lg:flex-row">
        <Sidebar user={user} />
        <div className="min-w-0 flex-1">
          <TopBar role={user.role} />
          <main className="px-4 py-5 lg:px-8 lg:py-7 print:p-0">
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </ShellUserProvider>
  );
}
