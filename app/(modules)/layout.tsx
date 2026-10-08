import { requireUser } from "@/lib/auth";
import { ModulesShell } from "@/components/shell/ModulesShell";

export const dynamic = "force-dynamic";

export default async function ModulesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <ModulesShell user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>{children}</ModulesShell>;
}
