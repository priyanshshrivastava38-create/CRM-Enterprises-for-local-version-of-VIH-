"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, GripVertical, Lock } from "lucide-react";
import { Avatar, Modal, primaryBtnClass, secondaryBtnClass } from "@/components/shared/ui";
import { STAGE_PROBABILITY, pipelineForecast } from "@/lib/dashboard-metrics";
import { dateLabel, inrCompact, titleCase } from "@/lib/format";

export type BoardDeal = {
  id: string;
  name: string;
  companyName: string;
  opportunityValue: string | number;
  status: string;
  expectedStartDate?: string | null;
  createdAt: string;
  salesOwner?: { id: string; name: string };
};

const STAGES = ["NEW", "QUALIFYING", "PROPOSAL", "WON", "LOST"] as const;
const MOVABLE = new Set(["NEW", "QUALIFYING", "PROPOSAL", "LOST"]);

function daysSince(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

/**
 * HubSpot-style deal board. Sales/Admin drag deals between open stages and Lost (Lost asks for a reason);
 * Won is reached only by approving a price request, so dropping on Won offers that instead.
 */
export function DealBoard({ deals, canEdit, onOpen, onChanged }: { deals: BoardDeal[]; canEdit: boolean; onOpen: (id: string) => void; onChanged: () => void }) {
  const [items, setItems] = useState(deals);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<BoardDeal | null>(null);
  const [lostReason, setLostReason] = useState("");
  const [wonFor, setWonFor] = useState<BoardDeal | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Take fresh server data whenever the page reloads the deals (keeps the optimistic move until then).
  useEffect(() => setItems(deals), [deals]);

  const value = (deal: BoardDeal) => Number(deal.opportunityValue) || 0;
  const forecast = pipelineForecast(items.map((deal) => ({ status: deal.status, value: value(deal) })));

  async function move(deal: BoardDeal, status: string, reason?: string) {
    const previous = items;
    setError("");
    setBusy(true);
    setItems((list) => list.map((item) => (item.id === deal.id ? { ...item, status } : item)));
    const response = await fetch(`/api/opportunities/${deal.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, lostReason: reason })
    });
    setBusy(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setItems(previous);
      setError(body?.error ?? "Could not move the deal. Please try again.");
      return;
    }
    onChanged();
  }

  function drop(stage: string) {
    const deal = items.find((item) => item.id === dragId);
    setDragId(null);
    setOverStage(null);
    if (!deal || deal.status === stage) return;
    if (stage === "WON") return setWonFor(deal);
    if (stage === "LOST") {
      setLostReason("");
      return setLostFor(deal);
    }
    void move(deal, stage);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl border border-line bg-surface px-5 py-3.5 text-sm shadow-card">
        <div>
          <span className="text-slate-500 dark:text-slate-400">Open pipeline</span> <span className="ml-1.5 font-semibold tabular-nums text-ink">{inrCompact(forecast.openValue)}</span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Weighted forecast</span> <span className="ml-1.5 font-semibold tabular-nums text-ink">{inrCompact(forecast.weightedValue)}</span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {canEdit ? "Drag a deal to move it to another stage." : "Read-only view — deals are moved by their sales owner."}
        </div>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-500/10 dark:text-red-400">{error}</p> : null}

      <div className="-mx-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
        <div className="grid min-w-[1080px] grid-cols-5 gap-3">
          {STAGES.map((stage) => {
            const stageDeals = items.filter((deal) => deal.status === stage);
            const total = stageDeals.reduce((sum, deal) => sum + value(deal), 0);
            const isTarget = overStage === stage && dragId !== null;
            return (
              <section
                key={stage}
                aria-label={`${titleCase(stage)} stage`}
                onDragOver={(event) => {
                  if (!dragId) return;
                  event.preventDefault();
                  setOverStage(stage);
                }}
                onDragLeave={() => setOverStage((current) => (current === stage ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  drop(stage);
                }}
                className={`flex min-h-[420px] flex-col rounded-2xl border p-2.5 transition-colors ${isTarget ? "border-brand-400 bg-brand-50/70 dark:border-brand-600 dark:bg-brand-500/10" : "border-line bg-panel/60"}`}
              >
                <header className="px-1.5 pb-3 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                      {titleCase(stage)}
                      {stage === "WON" ? <Lock size={12} className="text-slate-400" aria-label="Set by price approval" /> : null}
                    </h3>
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-line dark:text-slate-300">{stageDeals.length}</span>
                  </div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold tabular-nums text-ink">{inrCompact(total)}</span>
                    {stage !== "WON" && stage !== "LOST" ? <span> · {Math.round((STAGE_PROBABILITY[stage] ?? 0) * 100)}% win probability</span> : null}
                  </div>
                </header>
                <div className="flex-1 space-y-2">
                  {stageDeals.map((deal) => {
                    const draggable = canEdit && MOVABLE.has(deal.status) && !busy;
                    return (
                      <article
                        key={deal.id}
                        draggable={draggable}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = "move";
                          setDragId(deal.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setOverStage(null);
                        }}
                        // The card itself is the click target (a nested <button> would block dragging in some browsers).
                        role="button"
                        tabIndex={0}
                        aria-label={`${deal.companyName}, ${inrCompact(value(deal))}, ${titleCase(deal.status)}`}
                        onClick={() => onOpen(deal.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onOpen(deal.id);
                          }
                        }}
                        className={`group cursor-pointer rounded-xl border border-line bg-surface p-3 shadow-card transition-all hover:border-brand-300 dark:hover:border-brand-700 ${dragId === deal.id ? "opacity-40" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
                      >
                          <div className="flex items-start gap-2.5">
                            <Avatar name={deal.companyName} size={30} square />
                            <div className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold leading-5 text-ink" title={deal.name}>{deal.companyName}</div>
                            {draggable ? <GripVertical size={14} className="mt-1 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" aria-hidden="true" /> : null}
                          </div>
                          <div className="mt-3 text-lg font-semibold tabular-nums tracking-[-0.01em] text-ink">{inrCompact(value(deal))}</div>
                          <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1" title={deal.expectedStartDate ? "Expected start" : "Added"}>
                              <CalendarDays size={12} aria-hidden="true" />
                              {deal.expectedStartDate ? dateLabel(deal.expectedStartDate).replace(/ \d{4}$/, "") : daysSince(deal.createdAt) === 0 ? "Added today" : `Added ${daysSince(deal.createdAt)}d ago`}
                            </span>
                            <span title={`Owner: ${deal.salesOwner?.name ?? "Unassigned"}`}>{deal.salesOwner ? <Avatar name={deal.salesOwner.name} size={22} /> : null}</span>
                          </div>
                      </article>
                    );
                  })}
                  {!stageDeals.length ? <div className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-xs text-slate-400">{isTarget ? "Drop here" : "No deals"}</div> : null}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {lostFor ? (
        <Modal title={`Mark ${lostFor.companyName} as lost`} onClose={() => setLostFor(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const deal = lostFor;
              setLostFor(null);
              void move(deal, "LOST", lostReason.trim());
            }}
            className="space-y-4"
          >
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Why was this deal lost?</span>
              <textarea autoFocus required value={lostReason} onChange={(event) => setLostReason(event.target.value)} rows={3} placeholder="e.g. Chose a competitor on price" className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLostFor(null)} className={secondaryBtnClass}>Cancel</button>
              <button type="submit" disabled={!lostReason.trim()} className={primaryBtnClass}>Mark as lost</button>
            </div>
          </form>
        </Modal>
      ) : null}

      {wonFor ? (
        <Modal title="Deals are won through pricing approval" onClose={() => setWonFor(null)}>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
            {wonFor.companyName} moves to <span className="font-semibold text-ink">Won</span> automatically when the CEO approves its price request. That also creates the customer and kicks off onboarding.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setWonFor(null)} className={secondaryBtnClass}>Not now</button>
            <Link href={`/price-approvals?opportunityId=${wonFor.id}`} className={primaryBtnClass}>Create price request</Link>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
