# ViH CRM

A single Next.js application covering ViH's complete commercial lifecycle for its SMS and WhatsApp (WABA) messaging business — from the first sales lead through commercial approval, customer onboarding, third-party platform mapping, usage collection, billing/rating, reconciliation, and invoicing:

```
Lead → Opportunity → Price Approval → Customer Onboarding → Platform Mapping →
Usage Collection → Billing / Rating → Reconciliation → Invoice → Payment
```

Every stage is backed by real PostgreSQL data via Prisma — there is no mock data layer in the running app (the only intentionally mocked piece is the third-party usage adapter; see [Known Simplifications](#known-simplifications-v1)).

## Tech Stack

- Next.js App Router, React 19, TypeScript
- Tailwind CSS
- Prisma ORM + PostgreSQL (`DATABASE_URL`), with a real migration history in `prisma/migrations/`
- Zod validation
- Recharts analytics
- Vitest for the billing engine's regression tests
- Mock deterministic AI lead-call analysis and rule-based lead scoring

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example` and set your PostgreSQL connection and session secret:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/vih_crm?schema=public"
SESSION_SECRET="a long random string"
```

3. Apply the schema (creates real migration history — use this instead of `db:push` going forward):

```bash
npx prisma migrate dev
```

4. Seed demo data (users across all 5 roles, leads, an approved customer with a live Rate Plan and real billing/invoice history, and one pending price approval for a live CEO-approval demo):

```bash
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

6. Run the billing engine's regression tests (pinned to the requirements doc's worked examples):

```bash
npm test
```

## Demo Users

> These demo accounts are for local development and testing only. They must not be used in production.

All demo users use password `ViH@Demo2026!`.

| Role | Email | Password |
|---|---|---|
| Sales | `vih.sales@vih.demo` | `ViH@Demo2026!` |
| CEO | `vih.ceo@vih.demo` | `ViH@Demo2026!` |
| Finance | `vih.finance@vih.demo` | `ViH@Demo2026!` |
| Tech | `vih.tech@vih.demo` | `ViH@Demo2026!` |

## Modules

- **Leads, Tasks, Calls, Campaigns** — the original lead-management pipeline (`/`): capture, score, assign, and convert leads, with a manual call/message/email timeline and follow-up tasks.
- **Opportunities** (`/opportunities`) — manage a deal from first enquiry to onboarding-ready; convert a lead into an opportunity, capture per-service volume requirements, link documents and notes.
- **Price Approvals** (`/price-approvals`) — Sales builds a rate card (flat or slab-priced line items) and submits it for CEO approval. Approving one atomically creates the Customer, freezes an immutable versioned Rate Plan, creates any one-time setup charge, and generates the full onboarding checklist.
- **Onboarding** (`/onboarding`) — per-team (Sales/Finance/Operations) checklist tasks; completing the last required task automatically activates the customer and notifies Finance and the account owner.
- **Platform Mapping** (`/platform-mapping`) — maps a customer to their third-party SMS/WhatsApp account IDs, the record all future usage attribution depends on.
- **Usage** (`/usage`) — pulls usage via a pluggable adapter (a mock adapter ships today; a real vendor connector can be registered in `lib/platform-adapters/registry.ts`) or CSV import, and a raw-usage browser.
- **Billing** (`/billing`) — runs the rating engine for a customer/month against their effective Rate Plan, with a full line-item drill-down (raw vs. billable usage, slab/flat rate applied, amounts).
- **Reconciliation** (`/reconciliation`) — compares raw vs. billable usage per run and supports authorized credit/debit adjustments with a full audit trail.
- **Invoices** (`/invoices`) — finalizing a billing run generates a numbered invoice; supports payment recording and a Finance/ERP-ready CSV export.
- **Customers** (`/customers`) — a customer's full commercial profile: Rate Plan (current + history), onboarding status, platform mappings, setup charges (with waiver), and activity feed.
- **CEO Snapshot** (`/ceo-snapshot`) — a single, summary-first monthly management dashboard across Sales, Onboarding, Usage, Billing, Finance, Operations, and Collections, with green/amber/red status and a management exceptions list.
- **User Management** (`/users`, Admin only) — create internal accounts and manage roles/active status.

## Roles & Permissions

| Role | Can do |
|---|---|
| **Sales** | Create leads/opportunities, submit price approval requests, manage their own onboarding/Sales tasks, view invoices for their customers |
| **CEO** | Approve/reject/return price approval requests, view the CEO Snapshot |
| **Finance** | View approved pricing, run/finalize billing, manage reconciliation and adjustments, waive setup charges, record payments, export CSV |
| **Operations** | Manage platform mappings, pull/import usage, manage Operations onboarding tasks |
| **Admin** | Everything, plus user management |

Sensitive commercial fields (rates, slabs, invoice/opportunity values) are redacted from the Operations role even where a screen is otherwise shared across roles (see `lib/rbac.ts`).

## Project Structure

- `app/api/*` — API routes, grouped by module
- `app/(modules)/*` — the newer, route-based screens (Opportunities, Price Approvals, Onboarding, Platform Mapping, Usage, Billing, Reconciliation, Invoices, Customers, CEO Snapshot, User Management)
- `components/crm-app.tsx` — the original lead-management single-page interface, rendered at `/`
- `components/shell/*` — shared sidebar and role-filtered navigation used by both the legacy app and the newer module pages
- `components/shared/ui.tsx` — shared presentational primitives (Card, Badge, Input, Modal, Drawer, …)
- `lib/billing/*` — the pure rating engine (flat/slab calculation) and its Prisma-backed rate lookup
- `lib/workflows/*` — multi-step business transactions (approve a price request, complete onboarding, run billing, finalize an invoice, reconcile a run)
- `lib/platform-adapters/*` — the pluggable third-party usage adapter interface + mock adapter
- `lib/rbac.ts` — role-gate helper functions shared by API routes and the UI
- `prisma/schema.prisma`, `prisma/migrations/` — schema and migration history
- `prisma/seed.ts` — demo data: 5-role users, leads, an approved customer with real billing/invoice history, and one pending price approval

## Known Simplifications (v1)

These are deliberate scope decisions, not oversights:

- **Third-party platform APIs**: no live vendor connector yet — usage comes from a mock adapter or CSV import. `lib/platform-adapters/` is built so a real connector slots in without touching the rest of the billing pipeline.
- **ERP integration**: CSV export only, matching the fields needed to raise an invoice (customer, period, service, component, usage, rate, amount, setup charge, adjustments, total). No live ERP API push.
- **No mid-period rate proration**: a Rate Plan's effective date is expected to align to a billing-period (monthly) boundary.
- **Billable usage = raw usage**: there's no validation-rule engine yet that would exclude specific usage records from billing; the two are modeled as separate tables (per the doc's requirement) so that logic can be added later without a schema change.
- **Document attachments** are external links (e.g. a Drive URL), not uploaded files — there's no file-storage backend in this project yet.
