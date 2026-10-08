"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Badge, Title, Select, Empty, LoadingGrid, fieldClass } from "@/components/shared/ui";
import { dateLabel, titleCase } from "@/lib/format";

type UserRef = { id: string; name: string };
type Task = {
  id: string;
  team: string;
  title: string;
  description?: string | null;
  status: string;
  isRequired: boolean;
  assignedTo?: UserRef | null;
  completedBy?: UserRef | null;
  completedAt?: string | null;
};
type Checklist = {
  id: string;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  customer: { id: string; customerCode: string; name: string; status: string; accountManager?: UserRef };
  tasks: Task[];
};

const teams = ["SALES", "FINANCE", "OPERATIONS"];
const taskStatuses = ["PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED", "SKIPPED"];
const checklistStatuses = ["ALL", "PENDING", "IN_PROGRESS", "COMPLETED", "BLOCKED"];

function statusTone(status: string) {
  if (status === "ACTIVE" || status === "COMPLETED") return "green";
  if (status === "BLOCKED") return "red";
  if (status === "IN_PROGRESS") return "blue";
  return "slate";
}

export default function OnboardingPage() {
  const [me, setMe] = useState<{ id: string; role: string }>();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  async function loadMe() {
    const res = await fetch("/api/bootstrap");
    if (!res.ok) return;
    const data = await res.json();
    setMe(data.user);
    if (["SALES", "FINANCE", "OPERATIONS"].includes(data.user.role)) setTeamFilter(data.user.role);
  }

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    const res = await fetch(`/api/onboarding?${params.toString()}`);
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setChecklists(data.checklists ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadMe();
  }, []);

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function updateTask(taskId: string, status: string) {
    const res = await fetch(`/api/onboarding/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    if (res.ok) load();
  }

  const visibleChecklists = useMemo(() => {
    if (teamFilter === "ALL") return checklists;
    return checklists.filter((c) => c.tasks.some((t) => t.team === teamFilter));
  }, [checklists, teamFilter]);

  if (forbidden) return <Empty label="You don't have access to Onboarding." />;

  return (
    <div className="space-y-5">
      <Title title="Onboarding" subtitle="Sales, Finance, and Operations checklist tasks until a customer is fully active." />

      <Card className="min-w-0 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Team" value={teamFilter} onChange={setTeamFilter} options={["ALL", ...teams]} render={(v) => (v === "ALL" ? "All Teams" : titleCase(v))} />
          <Select label="Checklist Status" value={statusFilter} onChange={setStatusFilter} options={checklistStatuses} render={(v) => (v === "ALL" ? "All" : titleCase(v))} />
        </div>
      </Card>

      {loading ? (
        <LoadingGrid />
      ) : visibleChecklists.length === 0 ? (
        <Card className="min-w-0 p-5 sm:p-6">
          <Empty label="No onboarding checklists in this view." />
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleChecklists.map((checklist) => {
            const required = checklist.tasks.filter((t) => t.isRequired);
            const requiredDone = required.filter((t) => t.status === "COMPLETED").length;
            const tasksToShow = teamFilter === "ALL" ? checklist.tasks : checklist.tasks.filter((t) => t.team === teamFilter);

            return (
              <Card key={checklist.id} className="min-w-0 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/customers/${checklist.customer.id}`} className="break-words font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400 [overflow-wrap:anywhere]">
                      {checklist.customer.customerCode} · {checklist.customer.name}
                    </Link>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {requiredDone}/{required.length} required tasks complete · Account manager: {checklist.customer.accountManager?.name ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={statusTone(checklist.customer.status)}>Customer: {titleCase(checklist.customer.status)}</Badge>
                    <Badge tone={statusTone(checklist.status)}>{titleCase(checklist.status)}</Badge>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {teams
                    .filter((team) => teamFilter === "ALL" || team === teamFilter)
                    .map((team) => {
                      const teamTasks = tasksToShow.filter((t) => t.team === team);
                      if (!teamTasks.length) return null;
                      return (
                        <div key={team}>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titleCase(team)}</div>
                          <div className="mt-2 space-y-2">
                            {teamTasks.map((task) => (
                              <TaskRow key={task.id} task={task} canManage={!!me && (me.role === "ADMIN" || me.role === team)} onChange={(status) => updateTask(task.id, status)} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, canManage, onChange }: { task: Task; canManage: boolean; onChange: (status: string) => void }) {
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">{task.title}</div>
          {task.description ? <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{task.description}</div> : null}
        </div>
        <Badge tone={task.isRequired ? "amber" : "slate"}>{task.isRequired ? "Required" : "Optional"}</Badge>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {canManage ? (
          <select value={task.status} onChange={(e) => onChange(e.target.value)} className={`h-9 w-40 ${fieldClass}`}>
            {taskStatuses.map((s) => (
              <option key={s} value={s}>
                {titleCase(s)}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={task.status === "COMPLETED" ? "green" : task.status === "BLOCKED" ? "red" : "slate"}>{titleCase(task.status)}</Badge>
        )}
        {task.completedBy ? (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {task.completedBy.name} · {task.completedAt ? dateLabel(task.completedAt) : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}
