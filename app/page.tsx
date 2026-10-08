import { requireUser } from "@/lib/auth";
import { CRMApp } from "@/components/crm-app";
import { ModulesShell } from "@/components/shell/ModulesShell";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await requireUser();
  return (
    <ModulesShell user={{ id: user.id, name: user.name, email: user.email, role: user.role }}>
      <CRMApp />
    </ModulesShell>
  );
}
