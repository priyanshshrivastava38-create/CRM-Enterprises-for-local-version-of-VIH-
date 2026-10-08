// NOTE: These are DEVELOPMENT/DEMO credentials only and must not be used in production.
import type { Role } from "@prisma/client";

export const DEMO_PASSWORD = "ViH@Demo2026!";

export const DEMO_ACCOUNTS: Array<{
  roleLabel: string;
  email: string;
  password: string;
  name: string;
  role: Role;
}> = [
  { roleLabel: "Sales", email: "vih.sales@vih.demo", password: DEMO_PASSWORD, name: "ViH Sales User", role: "SALES" },
  { roleLabel: "CEO", email: "vih.ceo@vih.demo", password: DEMO_PASSWORD, name: "ViH CEO", role: "CEO" },
  { roleLabel: "Finance", email: "vih.finance@vih.demo", password: DEMO_PASSWORD, name: "ViH Finance User", role: "FINANCE" },
  { roleLabel: "Tech", email: "vih.tech@vih.demo", password: DEMO_PASSWORD, name: "ViH Tech User", role: "OPERATIONS" }
];
