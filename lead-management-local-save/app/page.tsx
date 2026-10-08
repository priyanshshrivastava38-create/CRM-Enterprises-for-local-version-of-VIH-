import { requireUser } from "@/lib/auth";
import { CRMApp } from "@/components/crm-app";

export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser();
  return <CRMApp />;
}
