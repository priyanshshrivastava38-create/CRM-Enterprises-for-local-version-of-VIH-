# Architecture Plan for Advanced CRM Upgrade

## Core principles
1. Preserve the existing Next.js + Prisma + PostgreSQL stack
2. Extend existing lead, activity, task, and call models instead of replacing them
3. Build reusable service layers for scoring, assignment, activity, workflow, and SLA
4. Keep the UI simple and enterprise-grade, inspired by Zoho/Frappe principles without copying their code
5. Ensure record-level permissions are enforced server-side, never only in the UI

## Phase 1 — Foundation hardening
- Audit auth and permission model
- Standardize feature semantics across entity types
- Improve lead score explanation and AI summary structure
- Create reusable activity-response components

## Phase 2 — Core CRM quality
- Upgrade lead 360 into a multi-section sales workspace
- Standardize timeline behavior across lead/contact/deal
- Add richer next-best-action and customer-intent metadata
- Improve lead-to-deal conversion flow and maintain audit continuity

## Phase 3 — Workflow and automation
- Build a reusable filter engine
- Add saved views and pinning logic
- Add assignment rules and workload-aware distribution
- Add basic workflow actions and notifications

## Phase 4 — Operational command center
- Build SLA timer and escalation engine
- Add manager dashboard widgets for pipeline health and follow-up urgency
- Add forecasting and agent performance reporting
- Add duplicate detection and merge strategy framework

## Phase 5 — Customization and scale
- Add custom fields and layout metadata models
- Add import pipeline with validation and preview
- Add enterprise settings and role permissions
- Add index review for large data handling

## Phase 6 — Advanced AI and integrations
- Add AI recommendation engine with confidence and explanation
- Prepare email/WhatsApp integration patterns
- Build provider-ready communication architecture
- Add sealed fallback behavior when external integrations are not configured

## Implementation priority
The project should move in dependency order: core CRM -> activity -> 360 workspace -> views -> assignment -> SLA -> communication -> custom fields -> automation -> AI.

This sequencing protects system stability and avoids replacing working flows with speculative modules.
