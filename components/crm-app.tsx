"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getLeadSlaState } from "@/lib/sla";
import { evaluateWorkflowActions } from "@/lib/workflow";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Download,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Sparkles,
  Upload,
  Users,
  XCircle
} from "lucide-react";
import { dateLabel, taskBucket, titleCase } from "@/lib/format";
import { homeViewFromSlug, homeViewHref, type HomeView } from "@/components/shell/module-nav";
import { SalesBillingWidgets } from "@/components/dashboards/SalesBillingWidgets";
import { FinanceDashboard } from "@/components/dashboards/FinanceDashboard";
import { useGreeting } from "@/components/shell/user-context";
import { BarList, CardLink, ChartCard as DashCard, DownloadReportButton, EmptyState, KpiTile, ReportHeader, TrendChart } from "@/components/dashboards/kit";
import { ThemeToggle } from "@/components/shared/ui";
import { DateField } from "@/components/shared/DateField";

type User = { id: string; name: string; email: string; role: string };
type Campaign = { id: string; name: string; source: string; status: string; budget: string | number; startDate: string; endDate?: string | null; leads?: Lead[] };
type Lead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  designation?: string;
  city?: string;
  source: string;
  status: string;
  priority: string;
  score: number;
  assignedTo?: string;
  notes?: string;
  nextFollowUpAt?: string;
  lastContactedAt?: string;
  createdAt: string;
  assignedUser?: User;
  campaign?: Campaign;
  tasks?: Task[];
  calls?: Call[];
  activities?: Activity[];
  scoreMeta?: { score: number; reasons: string[]; breakdown: { factor: string; delta: number; note: string }[]; classification: string };
  ai?: AIAnalysis;
};
type Task = { id: string; title: string; description?: string; type: string; status: string; priority: string; dueDate: string; leadId?: string; lead?: Lead; assignedTo?: string; assignedUser?: User };
type Call = { id: string; type?: string; direction: string; status?: string; outcome?: string; duration?: number; content?: string; notes?: string; transcript?: string; createdAt: string; agent?: User; lead?: Lead };
type Activity = { id: string; activityType: string; description: string; createdAt: string; user?: User; metadata?: { status?: string } | null };
type AIAnalysis = {
  mock: boolean;
  summary: string;
  intent: string;
  customerIntent?: string;
  keyRequirements?: string;
  sentiment: string;
  requirement: string;
  objections: string;
  buyingTimeline: string;
  recommendedNextAction: string;
  nextBestAction?: string;
  confidence?: number;
  scoreSummary?: string;
};

const statuses = ["NEW", "CONTACTED", "QUALIFIED", "INTERESTED", "FOLLOW_UP", "NURTURE", "CONVERTED", "LOST", "INVALID"];
const priorities = ["HOT", "WARM", "COLD"];
const sources = ["Website", "Facebook", "Instagram", "Google", "WhatsApp", "Referral", "Manual"];
const campaignStatuses = ["PLANNED", "ACTIVE", "PAUSED", "COMPLETED"];
const colors = ["#2563eb", "#0f766e", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2", "#64748b", "#16a34a"];
const chartTick = { fontSize: 11, fill: "var(--chart-text)" };
const chartTooltipStyle = { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8, fontSize: 12, color: "var(--ink)" };

const emptyLead = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  designation: "",
  city: "",
  source: "Website",
  priority: "WARM",
  assignedTo: "",
  campaignId: "",
  nextFollowUpAt: "",
  notes: ""
};

const emptyCampaign = {
  name: "",
  source: "Website",
  status: "ACTIVE",
  startDate: "",
  endDate: "",
  budget: ""
};

const defaultLeadFilters = { q: "", status: "ALL", source: "ALL", priority: "ALL", assignedTo: "ALL" };

type LeadFilterState = typeof defaultLeadFilters;
type SavedLeadView = { id: string; name: string; filters: LeadFilterState; isDefault?: boolean };

export function matchesLeadFilters(lead: Lead, filters: LeadFilterState) {
  const textQuery = filters.q.trim().toLowerCase();
  const matchesQuery =
    !textQuery ||
    `${lead.firstName} ${lead.lastName} ${lead.company} ${lead.email} ${lead.phone}`.toLowerCase().includes(textQuery) ||
    lead.source.toLowerCase().includes(textQuery);

  const matchesStatus = filters.status === "ALL" || lead.status === filters.status;
  const matchesSource = filters.source === "ALL" || lead.source === filters.source;
  const matchesPriority = filters.priority === "ALL" || lead.priority === filters.priority;
  const matchesAssigned = filters.assignedTo === "ALL" || (filters.assignedTo === "UNASSIGNED" ? !lead.assignedTo : lead.assignedTo === filters.assignedTo);

  return matchesQuery && matchesStatus && matchesSource && matchesPriority && matchesAssigned;
}

const defaultSavedViews: SavedLeadView[] = [
  { id: "all", name: "All Leads", filters: defaultLeadFilters, isDefault: true },
  { id: "hot", name: "Hot Pipeline", filters: { ...defaultLeadFilters, priority: "HOT" }, isDefault: true },
  { id: "follow-up", name: "Follow Up", filters: { ...defaultLeadFilters, status: "FOLLOW_UP" }, isDefault: true },
  { id: "unassigned", name: "Unassigned", filters: { ...defaultLeadFilters, assignedTo: "UNASSIGNED" }, isDefault: true }
];

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body) return {} as T;
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`API ${response.url} returned an invalid response.`);
  }
}

export function CRMApp() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = homeViewFromSlug(searchParams.get("view"));
  const setActive = useCallback((view: HomeView) => router.push(homeViewHref(view)), [router]);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [dashboard, setDashboard] = useState<any>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [filters, setFilters] = useState<LeadFilterState>(defaultLeadFilters);
  const [savedViews, setSavedViews] = useState<SavedLeadView[]>(defaultSavedViews);
  const [selectedViewId, setSelectedViewId] = useState<string>("all");
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsPagination, setLeadsPagination] = useState({ page: 1, pageSize: 25, total: 0, totalPages: 1 });
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [showImportLeadForm, setShowImportLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState(emptyLead);
  const [leadFormError, setLeadFormError] = useState("");
  const [leadImportMessage, setLeadImportMessage] = useState("");
  const [leadImportBusy, setLeadImportBusy] = useState(false);
  const [taskFormError, setTaskFormError] = useState("");
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState(emptyCampaign);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", type: "FOLLOW_UP", priority: "WARM", dueDate: "", assignedTo: "", leadId: "" });
  const [callForm, setCallForm] = useState({ type: "CALL", direction: "OUTBOUND", status: "CONNECTED", outcome: "Interested", duration: 6, content: "", notes: "", transcript: "" });
  const [busy, setBusy] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const agents = users.filter((item) => item.role === "SALES");

  const applyView = useCallback((view: SavedLeadView) => {
    setSelectedViewId(view.id);
    setFilters(view.filters);
  }, []);

  const saveCurrentView = useCallback(() => {
    const name = window.prompt("Name this saved view", `View ${savedViews.length + 1}`);
    if (!name) return;

    const trimmed = name.trim();
    if (!trimmed) return;

    const nextView: SavedLeadView = {
      id: `custom-${Date.now()}`,
      name: trimmed,
      filters: { ...filters }
    };

    setSavedViews((previous) => [nextView, ...previous]);
    setSelectedViewId(nextView.id);
  }, [filters, savedViews.length]);

  const loadAll = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const [boot, leadRes, taskRes, callRes, dashRes, campaignRes] = await Promise.all([
        fetch("/api/bootstrap"),
        fetch(`/api/leads?${new URLSearchParams({ ...filters, page: String(leadsPage), pageSize: String(leadsPagination.pageSize) })}`),
        fetch("/api/tasks"),
        fetch("/api/calls"),
        fetch("/api/dashboard"),
        fetch("/api/campaigns")
      ]);
      if (boot.status === 401) {
        location.href = "/login";
        return;
      }

      const [bootJson, campaignJson, leadJson, taskJson, callJson, dashboardJson] = await Promise.all([
        readJsonResponse<{ user?: User; users?: User[]; notifications?: unknown[] }>(boot),
        readJsonResponse<{ campaigns?: Campaign[] }>(campaignRes),
        readJsonResponse<{ leads?: Lead[]; pagination?: typeof leadsPagination }>(leadRes),
        readJsonResponse<{ tasks?: Task[] }>(taskRes),
        readJsonResponse<{ calls?: Call[] }>(callRes),
        readJsonResponse<any>(dashRes)
      ]);

      if (!bootJson.user) throw new Error("The CRM session is unavailable.");
      if (!campaignRes.ok || !campaignJson.campaigns) setCampaigns([]);
      else setCampaigns(campaignJson.campaigns);
      setUser(bootJson.user);
      setUsers(bootJson.users ?? []);
      setLeads(leadJson.leads ?? []);
      if (leadJson.pagination) setLeadsPagination(leadJson.pagination);
      setTasks(taskJson.tasks ?? []);
      setCalls(callJson.calls ?? []);
      setDashboard(dashboardJson);
    } catch (error) {
      console.error("CRM data load failed", error);
    } finally {
      setIsLoadingData(false);
    }
  }, [filters, leadsPage, leadsPagination.pageSize]);

  // The top bar search and "Create → Lead" arrive as ?q= and ?create=1 on the Leads view.
  const urlQuery = searchParams.get("q") ?? "";
  const urlCreate = searchParams.get("create");
  useEffect(() => {
    setGlobalSearch(urlQuery);
  }, [urlQuery]);
  useEffect(() => {
    if (urlCreate && active === "Leads") {
      setShowLeadForm(true);
      router.replace(homeViewHref("Leads"));
    }
  }, [active, router, urlCreate]);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((prev) => ({ ...prev, q: globalSearch })), 250);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  useEffect(() => {
    void loadAll();
  }, [filters, leadsPage, leadsPagination.pageSize, loadAll]);

  useEffect(() => {
    setLeadsPage(1);
  }, [filters.status, filters.source, filters.priority, filters.assignedTo, filters.q]);

  const openLead = useCallback(async (id: string) => {
    const response = await fetch(`/api/leads/${id}`);
    const json = await response.json();
    setSelectedLead(json.lead);
    setTaskForm((prev) => ({ ...prev, leadId: id, assignedTo: json.lead?.assignedTo ?? user?.id ?? "" }));
  }, [user?.id]);

  const createLead = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setLeadFormError("");
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(leadForm) });
    const json = await response.json();
    setBusy(false);
    if (response.ok) {
      setShowLeadForm(false);
      setLeadForm(emptyLead);
      setGlobalSearch("");
      setFilters(defaultLeadFilters);
      setSelectedViewId("all");
      setLeadsPage(1);
      await openLead(json.lead.id);
      setActive("Leads");
      const [leadRes, dashRes] = await Promise.all([fetch("/api/leads?page=1&pageSize=25"), fetch("/api/dashboard")]);
      const [leadJson, dashboardJson] = await Promise.all([
        readJsonResponse<{ leads?: Lead[]; pagination?: typeof leadsPagination }>(leadRes),
        readJsonResponse<any>(dashRes)
      ]);
      setLeads(leadJson.leads ?? []);
      if (leadJson.pagination) setLeadsPagination(leadJson.pagination);
      setDashboard(dashboardJson);
    } else {
      setLeadFormError(json.error ?? "Could not create lead.");
    }
  }, [leadForm, loadAll, openLead]);

  const importLeads = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const fileInput = form.elements.namedItem("leadCsvFile") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    setLeadImportBusy(true);
    setLeadImportMessage("");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/leads/import", { method: "POST", body });
    const json = await response.json();
    setLeadImportBusy(false);
    if (response.ok) {
      setLeadImportMessage(json.message);
      await loadAll();
      setShowImportLeadForm(false);
    } else {
      setLeadImportMessage(json.error ?? "The CSV could not be imported.");
    }
  }, [loadAll]);

  const exportLeads = useCallback(async () => {
    const response = await fetch("/api/leads/export");
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "crm-leads-export.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, []);

  const createCampaign = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setCampaignBusy(true);
    const response = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(campaignForm) });
    const json = await response.json();
    setCampaignBusy(false);
    if (response.ok) {
      setCampaigns((prev) => [json.campaign, ...prev]);
      setShowCampaignForm(false);
      setCampaignForm(emptyCampaign);
      setActive("Campaigns");
    }
  }, [campaignForm]);

  const updateLead = useCallback(async (id: string, patch: Partial<Lead>) => {
    const response = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const json = await response.json();
    if (response.ok) {
      setSelectedLead(json.lead);
      await loadAll();
    }
  }, [loadAll]);

  const createTask = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setTaskFormError("");
    const payload = { ...taskForm, assignedTo: taskForm.assignedTo || user?.id, leadId: taskForm.leadId || selectedLead?.id };
    const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json();
    if (!response.ok) {
      setTaskFormError(json.error ?? "Could not create follow-up.");
      return;
    }
    setTaskForm({ title: "", description: "", type: "FOLLOW_UP", priority: "WARM", dueDate: "", assignedTo: "", leadId: selectedLead?.id ?? "" });
    await loadAll();
    if (selectedLead) await openLead(selectedLead.id);
  }, [loadAll, openLead, selectedLead, taskForm, user?.id]);

  const completeTask = useCallback(async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "COMPLETED" }) });
    await loadAll();
    if (selectedLead) await openLead(selectedLead.id);
  }, [loadAll, openLead, selectedLead]);

  const logCall = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedLead || !user) return;
    const response = await fetch("/api/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...callForm, leadId: selectedLead.id, agentId: user.id })
    });
    if (!response.ok) return;
    setCallForm({ type: "CALL", direction: "OUTBOUND", status: "CONNECTED", outcome: "Interested", duration: 6, content: "", notes: "", transcript: "" });
    await loadAll();
    await openLead(selectedLead.id);
  }, [callForm, loadAll, openLead, selectedLead, user]);

  const analyze = useCallback(async () => {
    if (!selectedLead) return;
    const response = await fetch("/api/ai/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: selectedLead.id }) });
    const json = await response.json();
    setSelectedLead((lead) => (lead ? { ...lead, ai: json.analysis } : lead));
    await openLead(selectedLead.id);
  }, [openLead, selectedLead]);

  const content = useMemo(() => {
    if (active === "Dashboard") return <Dashboard dashboard={dashboard} leads={leads} openLead={openLead} setActive={setActive} user={user} loading={isLoadingData} />;
    if (active === "Leads")
      return (
        <LeadsView
          leads={leads}
          filters={filters}
          setFilters={setFilters}
          users={users}
          openLead={openLead}
          setShowLeadForm={setShowLeadForm}
          setShowImportLeadForm={setShowImportLeadForm}
          exportLeads={exportLeads}
          updateLead={updateLead}
          pagination={leadsPagination}
          page={leadsPage}
          setPage={setLeadsPage}
          savedViews={savedViews}
          selectedViewId={selectedViewId}
          onApplyView={applyView}
        />
      );
    if (active === "Tasks") return <TasksView tasks={tasks} completeTask={completeTask} setTaskForm={setTaskForm} taskForm={taskForm} users={users} leads={leads} createTask={createTask} taskFormError={taskFormError} />;
    if (active === "Conversations") return <CallsView calls={calls} openLead={openLead} />;
    if (active === "Campaigns") return <CampaignsView campaigns={campaigns} setShowCampaignForm={setShowCampaignForm} />;
    if (active === "Analytics") return <AnalyticsView dashboard={dashboard} tasks={tasks} />;
    return <SettingsView user={user} users={users} />;
  }, [active, applyView, calls, campaigns, completeTask, createTask, dashboard, exportLeads, filters, isLoadingData, leads, leadsPage, leadsPagination, openLead, savedViews, selectedViewId, taskForm, taskFormError, tasks, updateLead, user, users]);

  return (
    <div>
      {content}
      {showLeadForm ? (
        <CreateLeadModal
          form={leadForm}
          setForm={setLeadForm}
          users={agents}
          campaigns={campaigns}
          onClose={() => {
            setShowLeadForm(false);
            setLeadFormError("");
          }}
          onSubmit={createLead}
          busy={busy}
          error={leadFormError}
        />
      ) : null}
      {showImportLeadForm ? (
        <ImportLeadModal
          onClose={() => {
            setShowImportLeadForm(false);
            setLeadImportMessage("");
          }}
          onSubmit={importLeads}
          busy={leadImportBusy}
          message={leadImportMessage}
        />
      ) : null}
      {showCampaignForm ? <CreateCampaignModal form={campaignForm} setForm={setCampaignForm} onClose={() => setShowCampaignForm(false)} onSubmit={createCampaign} busy={campaignBusy} /> : null}
      {selectedLead ? <LeadDrawer lead={selectedLead} users={agents} updateLead={updateLead} onClose={() => setSelectedLead(null)} taskForm={taskForm} setTaskForm={setTaskForm} taskFormError={taskFormError} createTask={createTask} completeTask={completeTask} callForm={callForm} setCallForm={setCallForm} logCall={logCall} analyze={analyze} /> : null}
    </div>
  );
}

function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-800",
    amber: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-800",
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-800",
    blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-800",
    slate: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600"
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone] ?? tones.slate}`}>{typeof children === "string" ? <span className="inline-block lowercase first-letter:uppercase">{children}</span> : children}</span>;
}

function statusTone(status: string) {
  if (status === "CONVERTED" || status === "QUALIFIED") return "green";
  if (status === "LOST" || status === "INVALID") return "red";
  if (status === "FOLLOW_UP" || status === "INTERESTED") return "amber";
  return "blue";
}

function priorityTone(priority: string) {
  if (priority === "HOT") return "red";
  if (priority === "WARM") return "amber";
  return "slate";
}

function isMissedStatus(status?: string | null) {
  return status === "MISSED" || status === "NO_ANSWER";
}

function conversationTone(call: Call): "green" | "red" {
  if (call.type === "MESSAGE" || call.type === "EMAIL") return "green";
  return isMissedStatus(call.status) ? "red" : "green";
}

function conversationCardClass(tone: "green" | "red") {
  return tone === "green"
    ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-500/10"
    : "border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-500/10";
}

function activityConversationTone(activity: Activity): "green" | "red" | null {
  if (activity.activityType === "MESSAGE_LOGGED" || activity.activityType === "EMAIL_LOGGED") return "green";
  if (activity.activityType === "CALL_LOGGED") return isMissedStatus(activity.metadata?.status) ? "red" : "green";
  return null;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-surface p-4 shadow-card transition-shadow duration-200 hover:shadow-card-hover ${className}`}>{children}</section>;
}

function Dashboard({ dashboard, leads, openLead, setActive, user, loading }: any) {
  const [operationsData, setOperationsData] = useState<any>(null);
  const [operationsError, setOperationsError] = useState("");
  const slaSummary = useMemo(() => {
    const summary = { ok: 0, warning: 0, escalated: 0 };
    for (const lead of leads) {
      const state = getLeadSlaState({
        priority: lead.priority as "HOT" | "WARM" | "COLD",
        status: lead.status,
        nextFollowUpAt: lead.nextFollowUpAt ? new Date(lead.nextFollowUpAt) : null
      });
      if (state.status === "OK") summary.ok += 1;
      else if (state.status === "WARNING") summary.warning += 1;
      else summary.escalated += 1;
    }
    return summary;
  }, [leads]);

  const workflowActions = useMemo(() => leads.flatMap((lead) => evaluateWorkflowActions(lead)).slice(0, 4), [leads]);
  const greeting = useGreeting();
  const isFinance = user?.role === "FINANCE" || user?.role === "ADMIN";
  const isOperations = user?.role === "OPERATIONS";

  useEffect(() => {
    if (!isOperations) return;
    let cancelled = false;
    Promise.all([
      fetch("/api/onboarding").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load onboarding"))),
      fetch("/api/customers?pageSize=100").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load customers"))),
      fetch("/api/platform-accounts").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load platform mappings"))),
      fetch("/api/usage/batches").then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load usage imports")))
    ]).then(([onboarding, customers, platforms, batches]) => {
      if (!cancelled) {
        setOperationsData({ checklists: onboarding.checklists ?? [], customers: customers.customers ?? [], accounts: platforms.accounts ?? [], batches: batches.batches ?? [] });
        setOperationsError("");
      }
    }).catch((error) => {
      if (!cancelled) setOperationsError(error instanceof Error ? error.message : "Could not load operations dashboard");
    });
    return () => { cancelled = true; };
  }, [isOperations]);

  if (!dashboard || (loading && !dashboard)) return <LoadingGrid />;

  if (isFinance) {
    return (
      <FinanceDashboard
        header={(headline) => (
          <>
            <ReportHeader title="Finance Report" period={new Date().toLocaleString("en-IN", { month: "long", year: "numeric" })} />
            <Title
              title={greeting}
              subtitle={headline ?? "Billing, collections, receivables, and reconciliation at a glance."}
              action={<span className="flex flex-wrap items-center gap-2 print:hidden"><DownloadReportButton /><Link href="/reconciliation" className={secondaryBtnClass}>Review exceptions</Link><Link href="/billing" className={primaryBtnClass}>Run billing</Link></span>}
            />
            <div className="print:hidden"><WorkflowJourney title="Month-end close" steps={[{ label: "Usage", detail: "Review consumption", href: "/usage" }, { label: "Billing", detail: "Calculate customer charges", href: "/billing" }, { label: "Reconcile", detail: "Review variances", href: "/reconciliation" }, { label: "Invoice", detail: "Issue and collect", href: "/invoices" }]} /></div>
          </>
        )}
      />
    );
  }

  if (isOperations) {
    return (
      <div className="space-y-5">
        <Title title="Operations dashboard" subtitle="Track customer activation, platform connectivity, and usage imports." />
        <WorkflowJourney title="Customer activation workflow" steps={[{ label: "Onboarding", detail: "Complete team checklist", href: "/onboarding" }, { label: "Platform mapping", detail: "Connect customer services", href: "/platform-mapping" }, { label: "Usage", detail: "Import and validate records", href: "/usage" }, { label: "Customer", detail: "Confirm activation", href: "/customers" }]} />
        {operationsData ? <OperationsDashboard data={operationsData} /> : operationsError ? <Card><p role="alert" className="text-sm text-red-600 dark:text-red-400">{operationsError}</p><button onClick={() => window.location.reload()} className="mt-3 text-sm font-semibold text-brand-700 dark:text-brand-400">Retry</button></Card> : <LoadingGrid />}
      </div>
    );
  }

  const kpis = dashboard.kpis;
  const isRep = user?.role === "SALES";
  const sources = [...dashboard.bySource].sort((x: any, y: any) => y.value - x.value);

  return (
    <div className="space-y-6">
      <Title
        title={greeting}
        subtitle={`${kpis.followUpsDue} follow-up${kpis.followUpsDue === 1 ? "" : "s"} due today${kpis.overdueTasks ? ` and ${kpis.overdueTasks} overdue` : ""} · ${kpis.hot} hot lead${kpis.hot === 1 ? "" : "s"} in ${isRep ? "your" : "the team's"} pipeline.`}
        action={<><button onClick={() => setActive("Tasks")} className={secondaryBtnClass}>View tasks</button><button onClick={() => setActive("Leads")} className={primaryBtnClass}>Open leads</button></>}
      />

      <WorkflowJourney title="Sales workflow" steps={[{ label: "Lead", detail: "Qualify the requirement", href: "/?view=leads" }, { label: "Opportunity", detail: "Build the proposal", href: "/opportunities" }, { label: "Pricing", detail: "Submit for approval", href: "/price-approvals" }, { label: "Customer", detail: "Track account growth", href: "/customers" }]} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Total leads" icon={Users} href="/?view=leads" value={kpis.total} footer={<span className="text-xs text-slate-500 dark:text-slate-400">{kpis.newLeads} new · {kpis.qualified} qualified</span>} />
        <KpiTile label="Hot leads" icon={Sparkles} href="/?view=leads" value={kpis.hot} footer={<span className="text-xs text-slate-500 dark:text-slate-400">High-intent, call first</span>} />
        <KpiTile
          label="Follow-ups due today"
          icon={CalendarClock}
          href="/?view=tasks"
          value={kpis.followUpsDue}
          footer={<span className={`text-xs ${kpis.overdueTasks ? "font-semibold text-red-700 dark:text-red-400" : "text-slate-500 dark:text-slate-400"}`}>{kpis.overdueTasks ? `${kpis.overdueTasks} overdue` : "Nothing overdue"}</span>}
        />
        <KpiTile label="Conversion rate" icon={CircleDollarSign} value={`${kpis.conversionRate}%`} footer={<span className="text-xs text-slate-500 dark:text-slate-400">{kpis.converted} of {kpis.total} leads converted</span>} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashCard title="Lead flow" subtitle="Leads created each month, and how many of them have converted" className="xl:col-span-2">
          <TrendChart
            data={dashboard.trend ?? []}
            series={[
              { key: "created", name: "Leads created", color: "var(--series-1)" },
              { key: "converted", name: "Converted", color: "var(--series-2)" }
            ]}
            empty="No leads created in the last 6 months."
          />
        </DashCard>
        <DashCard title="Lead sources" subtitle="Where leads come from" action={<CardLink href="/?view=campaigns">Campaigns</CardLink>}>
          <BarList items={sources.map((row: any) => ({ label: row.name, value: row.value }))} empty="No leads yet." />
        </DashCard>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <DashCard title="Pipeline by stage" subtitle="Leads at each status" action={<CardLink href="/?view=leads">Leads</CardLink>}>
          <BarList items={dashboard.byStatus.map((row: any) => ({ label: titleCase(row.name.replace(" ", "_")), value: row.value }))} empty="No leads yet." />
        </DashCard>
        <DashCard title="Next best actions" subtitle="Recommended by the AI assistant">
          {dashboard.actions.length ? (
            <ul className="space-y-2">
              {dashboard.actions.map((action: any) => (
                <li key={action.type + action.message}>
                  <button onClick={() => (action.leadId ? openLead(action.leadId) : setActive("Tasks"))} className="group flex w-full items-center justify-between gap-3 rounded-xl border border-line p-3 text-left transition-colors hover:border-brand-300 hover:bg-panel/60 dark:hover:border-brand-700">
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-brand-700 dark:text-brand-400">{action.type}</span>
                      <span className="mt-0.5 block text-sm text-slate-700 dark:text-slate-200">{action.message}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>You&apos;re all caught up.</EmptyState>
          )}
        </DashCard>
        <DashCard title="Today's follow-ups" subtitle="Due today or earlier" action={<button onClick={() => setActive("Tasks")} className="text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">All tasks</button>}>
          {dashboard.todayTasks.length ? <div className="space-y-2">{dashboard.todayTasks.slice(0, 5).map((task: Task) => <TaskRow key={task.id} task={task} />)}</div> : <EmptyState>No follow-ups due today.</EmptyState>}
        </DashCard>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-3">
        <DashCard title={isRep ? "My performance" : "Team performance"} subtitle="Lead progress by sales rep" className="xl:col-span-2">
          {dashboard.agentPerformance.length ? (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-xs text-slate-500 dark:text-slate-400">
                  <tr className="border-b border-line">
                    <th className="px-5 pb-2.5 font-medium">Rep</th>
                    {["Assigned", "Contacted", "Qualified", "Converted", "Conversion"].map((h) => <th key={h} className="px-5 pb-2.5 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line whitespace-nowrap">
                  {dashboard.agentPerformance.map((agent: any) => (
                    <tr key={agent.name}>
                      <td className="px-5 py-3 font-semibold text-ink">{agent.name}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{agent.assigned}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{agent.contacted}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{agent.qualified}</td>
                      <td className="px-5 py-3 text-right tabular-nums text-slate-700 dark:text-slate-200">{agent.converted}</td>
                      <td className="px-5 py-3 text-right font-semibold tabular-nums text-ink">{agent.conversionRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState>No active sales reps yet.</EmptyState>
          )}
        </DashCard>
        <DashCard title="Follow-up SLA" subtitle="Response-time health across open leads">
          <ul className="divide-y divide-line text-sm">
            {([
              ["On track", slaSummary.ok, CheckCircle2, "text-emerald-700 dark:text-emerald-400"],
              ["Warning", slaSummary.warning, AlertTriangle, "text-amber-700 dark:text-amber-400"],
              ["Escalated", slaSummary.escalated, XCircle, "text-red-700 dark:text-red-400"]
            ] as const).map(([label, value, Icon, tone]) => (
              <li key={label} className="flex items-center justify-between py-2.5 first:pt-0">
                <span className={`flex items-center gap-2 font-medium ${tone}`}><Icon size={15} aria-hidden="true" />{label}</span>
                <span className="font-semibold tabular-nums text-ink">{value}</span>
              </li>
            ))}
          </ul>
          {workflowActions.length ? (
            <div className="mt-4 border-t border-line pt-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Automations queued</div>
              <ul className="mt-2 space-y-1.5">
                {workflowActions.slice(0, 3).map((action) => (
                  <li key={`${action.leadId ?? "lead"}-${action.id}`} className="text-xs text-slate-600 dark:text-slate-300"><span className="font-semibold text-ink">{action.name}</span> · {action.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </DashCard>
      </div>

      <div>
        <div className="mb-3"><h2 className="text-[15px] font-semibold text-ink">{isRep ? "My accounts & billing" : "Accounts & billing"}</h2><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Customers, billed revenue, and open pipeline value</p></div>
        <SalesBillingWidgets />
      </div>
    </div>
  );
}

function OperationsDashboard({ data }: { data: any }) {
  const customers = data.customers as any[];
  const checklists = data.checklists as any[];
  const accounts = data.accounts as any[];
  const batches = data.batches as any[];
  const operationalTasks = checklists.flatMap((checklist) => checklist.tasks ?? []).filter((task) => task.team === "OPERATIONS");
  const pendingTasks = operationalTasks.filter((task) => task.status === "PENDING" || task.status === "IN_PROGRESS").length;
  const blockedTasks = operationalTasks.filter((task) => task.status === "BLOCKED").length;
  const activeCustomers = customers.filter((customer) => customer.status === "ACTIVE").length;
  const activeAccounts = accounts.filter((account) => account.status === "ACTIVE").length;
  const recentBatches = batches.slice(0, 5);
  const stats = [
    { label: "Customers onboarding", value: customers.filter((customer) => customer.status === "ONBOARDING").length, detail: "Customer setups in progress", href: "/onboarding" },
    { label: "Operations tasks open", value: pendingTasks, detail: blockedTasks ? `${blockedTasks} blocked` : "No blocked Operations tasks", href: "/onboarding" },
    { label: "Active customers", value: activeCustomers, detail: "Customer accounts activated", href: "/customers" },
    { label: "Active platform mappings", value: activeAccounts, detail: `${accounts.length} total mappings`, href: "/platform-mapping" }
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="group rounded-xl border border-line bg-surface p-4 shadow-card transition-colors hover:border-brand-300 hover:bg-panel/60">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.detail}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold text-ink">Onboarding workload</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Operations checklist tasks across customer activations.</p></div>
            <Link href="/onboarding" className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">Open checklist</Link>
          </div>
          <div className="mt-4 space-y-2">
            {checklists.filter((checklist) => checklist.status !== "COMPLETED").slice(0, 5).map((checklist) => {
              const tasks = (checklist.tasks ?? []).filter((task: any) => task.team === "OPERATIONS");
              const openCount = tasks.filter((task: any) => task.status === "PENDING" || task.status === "IN_PROGRESS").length;
              const blockedCount = tasks.filter((task: any) => task.status === "BLOCKED").length;
              return <Link key={checklist.id} href="/onboarding" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5 transition-colors hover:bg-panel"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{checklist.customer.name}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{checklist.customer.customerCode} · {titleCase(checklist.status)}</span></span><span className="text-right text-xs text-slate-500 dark:text-slate-400">{openCount} open{blockedCount ? ` · ${blockedCount} blocked` : ""}</span></Link>;
            })}
            {!checklists.some((checklist) => checklist.status !== "COMPLETED") ? <p className="rounded-lg bg-panel p-3 text-sm text-slate-500 dark:text-slate-400">No open customer onboarding checklists.</p> : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="font-semibold text-ink">Recent usage imports</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Latest batch status and row processing results.</p></div>
            <Link href="/usage" className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">Open usage</Link>
          </div>
          <div className="mt-4 space-y-2">
            {recentBatches.map((batch) => <div key={batch.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2.5"><span className="min-w-0"><span className="block truncate text-sm font-semibold text-ink">{batch.fileName || `${titleCase(batch.service)} import`}</span><span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{dateLabel(batch.createdAt)} · {batch.successCount} of {batch.rowCount} rows imported</span></span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${batch.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400" : batch.status === "FAILED" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400" : "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"}`}>{titleCase(batch.status)}</span></div>)}
            {!recentBatches.length ? <p className="rounded-lg bg-panel p-3 text-sm text-slate-500 dark:text-slate-400">No usage imports yet. Import a batch to start tracking consumption.</p> : null}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold text-ink">Operations shortcuts</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Continue customer setup work.</p></div>
          <div className="flex flex-wrap gap-2">
            <Link href="/onboarding" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel">Onboarding</Link>
            <Link href="/platform-mapping" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel">Platform Mapping</Link>
            <Link href="/usage" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700">Import Usage</Link>
            <Link href="/customers" className="rounded-lg border border-line px-3 py-2 text-sm font-semibold text-ink transition-colors hover:bg-panel">Customers</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function WorkflowJourney({ title, steps }: { title: string; steps: { label: string; detail: string; href: string }[] }) {
  return (
    <section aria-label={title} className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li key={step.label}>
            <Link href={step.href} className="flex h-full min-h-[76px] items-start gap-3 rounded-xl border border-line bg-panel/70 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/70 dark:hover:bg-brand-500/10">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{index + 1}</span>
              <span className="min-w-0"><span className="block text-sm font-semibold text-ink">{step.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{step.detail}</span></span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function LeadsView({ leads, filters, setFilters, users, openLead, setShowLeadForm, setShowImportLeadForm, exportLeads, updateLead, pagination, page, setPage, savedViews, selectedViewId, onApplyView, onSaveView }: any) {
  const visibleLeads = useMemo(() => leads.filter((lead: Lead) => matchesLeadFilters(lead, filters)), [filters, leads]);

  return (
    <div className="space-y-5">
      <Title
        title="Leads"
        subtitle="Every lead in your pipeline. Filter, assign, and follow up — or import and export as CSV."
        action={
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowImportLeadForm(true)} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-panel"><Upload size={15} className="mr-2 inline" />Import CSV</button>
            <button onClick={exportLeads} className="rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-panel"><Download size={15} className="mr-2 inline" />Export CSV</button>
            <button onClick={() => setShowLeadForm(true)} className="rounded-xl bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:bg-brand-700 active:scale-[0.98]"><Plus size={15} className="mr-2 inline" />Create lead</button>
          </div>
        }
      />

      {filters.q ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
          <span className="text-slate-600 dark:text-slate-300">Showing results for <span className="font-semibold text-ink">&ldquo;{filters.q}&rdquo;</span></span>
          <Link href="/?view=leads" className="ml-auto text-xs font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">Clear search</Link>
        </div>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold text-ink">Saved views</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Quick access to your most used lead segments.</p></div>
            <div className="flex flex-wrap gap-2">
              {savedViews.map((view: SavedLeadView) => (
                <button key={view.id} type="button" onClick={() => onApplyView(view)} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${selectedViewId === view.id ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-500/10 dark:text-brand-300" : "border-line bg-surface text-slate-600 hover:bg-panel dark:text-slate-300"}`}>
                  {view.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <Filter label="Status" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={["ALL", ...statuses]} />
            <Filter label="Source" value={filters.source} onChange={(v) => setFilters({ ...filters, source: v })} options={["ALL", ...sources]} />
            <Filter label="Priority" value={filters.priority} onChange={(v) => setFilters({ ...filters, priority: v })} options={["ALL", ...priorities]} />
            <Filter label="Agent" value={filters.assignedTo} onChange={(v) => setFilters({ ...filters, assignedTo: v })} options={["ALL", "UNASSIGNED", ...users.map((u: User) => u.id)]} render={(v) => (v === "ALL" ? "All" : v === "UNASSIGNED" ? "Unassigned" : users.find((u: User) => u.id === v)?.name ?? v)} />
          </div>
        </div>
      </Card>

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div><p className="text-sm font-semibold text-ink">Lead pipeline</p><p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{visibleLeads.length} leads shown</p></div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Live workspace</div>
        </div>
        <div className="overflow-x-auto thin-scrollbar">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-panel text-[10px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
              <tr>{["Lead Name", "Company", "Phone", "Email", "Source", "Status", "Priority", "Score", "Assigned Agent", "Next Follow-up", "Created", "Actions"].map((h) => <th key={h} className="whitespace-nowrap px-4 py-3 font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line whitespace-nowrap">
              {visibleLeads.map((lead: Lead) => (
                <tr key={lead.id} className="transition-colors hover:bg-panel/60">
                  <td className="px-4 py-3"><button onClick={() => openLead(lead.id)} className="left text-left font-semibold text-ink transition-colors hover:text-brand-600">{lead.firstName} {lead.lastName}</button></td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.company}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.phone}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.email}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{lead.source}</td>
                  <td className="px-4 py-3"><Badge tone={statusTone(lead.status)}>{titleCase(lead.status)}</Badge></td>
                  <td className="px-4 py-3"><Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge></td>
                  <td className="px-4 py-3"><div className="flex items-center gap-2"><span className="w-5 font-semibold text-ink">{lead.score}</span><span className="h-1.5 w-16 overflow-hidden rounded-full bg-panel"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${lead.score}%` }} /></span></div></td>
                  <td className="px-4 py-3"><select value={lead.assignedTo ?? ""} onChange={(e) => updateLead(lead.id, { assignedTo: e.target.value })} className="max-w-[145px] rounded-lg border border-line bg-surface px-2 py-1.5 text-xs transition-colors hover:border-brand-400"><option value="">Unassigned</option>{users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{dateLabel(lead.nextFollowUpAt)}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">{dateLabel(lead.createdAt)}</td>
                  <td className="px-4 py-3"><button onClick={() => openLead(lead.id)} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10">View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!visibleLeads.length ? <Empty label="No leads match these filters. Adjust your view or create a new lead." /> : null}
        {visibleLeads.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
            <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} lead{pagination.total === 1 ? "" : "s"}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p: number) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-line px-3 py-1.5 font-semibold transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
              <button onClick={() => setPage((p: number) => Math.min(pagination.totalPages, p + 1))} disabled={page >= pagination.totalPages} className="rounded-lg border border-line px-3 py-1.5 font-semibold transition-colors hover:bg-panel disabled:cursor-not-allowed disabled:opacity-40">Next</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LeadDrawer({ lead, users, updateLead, onClose, taskForm, setTaskForm, taskFormError, createTask, completeTask, callForm, setCallForm, logCall, analyze }: any) {
  const ai = lead.ai;
  return (
    <div className="fixed inset-0 z-30 animate-fade-in bg-slate-900/40 backdrop-blur-sm">
      <aside className="absolute right-0 top-0 h-full w-full max-w-5xl animate-slide-in-right overflow-y-auto bg-surface shadow-soft thin-scrollbar sm:border-l sm:border-line">
        <div className="sticky top-0 z-10 border-b border-line bg-surface/90 px-5 py-4 backdrop-blur-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-semibold tracking-tight text-ink">{lead.firstName} {lead.lastName}</h2><Badge tone={statusTone(lead.status)}>{titleCase(lead.status)}</Badge><Badge tone={priorityTone(lead.priority)}>{lead.priority}</Badge></div>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{lead.company} · {lead.assignedUser?.name ?? "Unassigned"} · Score {lead.score}/100</p>
            </div>
            <button onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm font-semibold transition-colors hover:bg-panel">Close</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <select value={lead.status} onChange={(e) => updateLead(lead.id, { status: e.target.value })} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm transition-colors hover:border-brand-400">{statuses.map((s) => <option key={s} value={s}>{titleCase(s)}</option>)}</select>
            <select value={lead.assignedTo ?? ""} onChange={(e) => updateLead(lead.id, { assignedTo: e.target.value })} className="rounded-lg border border-line bg-surface px-3 py-2 text-sm transition-colors hover:border-brand-400"><option value="">Assign lead</option>{users.map((u: User) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
            <button onClick={analyze} className="flex items-center gap-2 rounded-lg bg-gradient-to-b from-slate-800 to-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:brightness-110 active:scale-[0.98] dark:from-slate-700 dark:to-slate-800"><Sparkles size={16} /> Analyze Call</button>
          </div>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <Card><h3 className="font-semibold">Contact Information</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[["Email", lead.email], ["Phone", lead.phone], ["Company", lead.company], ["Designation", lead.designation], ["Location", lead.city], ["Source", lead.source]].map(([k, v]) => <Info key={k} label={k} value={v || "Not set"} />)}</div></Card>
            <Card>
              <h3 className="font-semibold">AI Summary <span className="text-xs font-normal text-slate-500 dark:text-slate-400">(live insight)</span></h3>
              <p className="mt-3 text-sm leading-6 text-slate-700 dark:text-slate-200">{ai?.summary}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <Info label="Customer intent" value={ai?.customerIntent ?? ai?.intent ?? "Run analysis"} />
                <Info label="Sentiment" value={ai?.sentiment ?? "Available after analysis"} />
                <Info label="Key requirement" value={ai?.keyRequirements ?? ai?.requirement ?? "Not captured"} />
                <Info label="Objection" value={ai?.objections ?? "None captured"} />
                <Info label="Buying timeline" value={ai?.buyingTimeline ?? "Needs review"} />
                <Info label="Next best action" value={ai?.nextBestAction ?? ai?.recommendedNextAction ?? "Review lead"} />
              </div>
            </Card>
            <Card><h3 className="font-semibold">Timeline</h3><div className="mt-3 space-y-3">{lead.activities?.map((activity: Activity) => { const tone = activityConversationTone(activity); const borderClass = tone === "green" ? "border-emerald-400 dark:border-emerald-600" : tone === "red" ? "border-red-400 dark:border-red-600" : "border-brand-100"; return <div key={activity.id} className={`border-l-2 ${borderClass} pl-3`}><div className="text-sm font-semibold">{titleCase(activity.activityType)}</div><div className="text-sm text-slate-600 dark:text-slate-300">{activity.description}</div><div className="text-xs text-slate-400 dark:text-slate-500">{dateLabel(activity.createdAt)} · {activity.user?.name ?? "System"}</div></div>; })}</div></Card>
            <Card><h3 className="font-semibold">Means of Conversation</h3><div className="mt-3 space-y-2">{lead.calls?.map((call: Call) => { const tone = conversationTone(call); const toneClass = conversationCardClass(tone); if (call.type === "MESSAGE") return <div key={call.id} className={`rounded-xl border p-3 transition-colors ${toneClass}`}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold"><MessageSquare size={14} /> Message · {call.direction === "INBOUND" ? "Received" : "Sent"}</span><Badge tone={tone}>Logged</Badge></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{call.content || "No content"}</p><p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{dateLabel(call.createdAt)} · {call.agent?.name}</p></div>; if (call.type === "EMAIL") return <div key={call.id} className={`rounded-xl border p-3 transition-colors ${toneClass}`}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold"><Mail size={14} /> Email · {call.direction === "INBOUND" ? "Received" : "Sent"}{call.outcome ? ` · ${call.outcome}` : ""}</span><Badge tone={tone}>Logged</Badge></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{call.content || "No content"}</p><p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{dateLabel(call.createdAt)} · {call.agent?.name}</p></div>; return <div key={call.id} className={`rounded-xl border p-3 transition-colors ${toneClass}`}><div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 font-semibold"><Phone size={14} /> {call.outcome}</span><div className="flex items-center gap-2"><Badge tone={tone}>{call.status ? titleCase(call.status) : "Logged"}</Badge><span className="text-sm text-slate-500 dark:text-slate-400">{call.duration} min</span></div></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{call.notes || "No notes"}</p><p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{dateLabel(call.createdAt)} · {call.agent?.name}</p></div>; })}</div></Card>
          </div>
          <div className="space-y-4">
            <Card>
              <h3 className="font-semibold">Lead Score</h3>
              <div className="mt-3 text-4xl font-semibold text-ink">{lead.score}/100</div>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{lead.scoreMeta?.classification ?? (lead.score >= 75 ? "Hot Lead" : lead.score >= 45 ? "Warm Lead" : "Cold Lead")}</p>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"><span>Positive factors</span><span>{lead.scoreMeta?.breakdown.filter((item) => item.delta > 0).reduce((sum, item) => sum + item.delta, 0) ?? lead.score}</span></div>
                {lead.scoreMeta?.breakdown.filter((item) => item.delta > 0).slice(0, 4).map((item) => (
                  <div key={`${item.factor}-${item.delta}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.factor}</span><span>+{item.delta}</span></div>
                    <p className="mt-1 text-[11px] opacity-90">{item.note}</p>
                  </div>
                )) ?? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-300">Requested callback +20</div>
                )}
              </div>
              {lead.scoreMeta?.breakdown.some((item) => item.delta < 0) ? (
                <div className="mt-3 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Negative factors</div>
                  {lead.scoreMeta.breakdown.filter((item) => item.delta < 0).map((item) => (
                    <div key={`${item.factor}-${item.delta}`} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-500/10 dark:text-red-300">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{item.factor}</span><span>{item.delta}</span></div>
                      <p className="mt-1 text-[11px] opacity-90">{item.note}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </Card>
            <Card>
              <h3 className="font-semibold">Log Conversation</h3>
              <form onSubmit={logCall} className="mt-3 space-y-3">
                <Filter label="Type" value={callForm.type} onChange={(v) => setCallForm({ ...callForm, type: v })} options={["CALL", "MESSAGE", "EMAIL"]} render={(v) => (v === "MESSAGE" ? "Messages" : v === "EMAIL" ? "Email" : "Call")} />
                <Filter label="Direction" value={callForm.direction} onChange={(v) => setCallForm({ ...callForm, direction: v })} options={["OUTBOUND", "INBOUND"]} render={(v) => (callForm.type !== "CALL" ? (v === "OUTBOUND" ? "Sent" : "Received") : titleCase(v))} />
                {callForm.type === "MESSAGE" ? (
                  <Textarea label="Message" value={callForm.content} onChange={(v) => setCallForm({ ...callForm, content: v })} />
                ) : callForm.type === "EMAIL" ? (
                  <>
                    <Input label="Subject" value={callForm.outcome} onChange={(v) => setCallForm({ ...callForm, outcome: v })} />
                    <Textarea label="Body" value={callForm.content} onChange={(v) => setCallForm({ ...callForm, content: v })} />
                  </>
                ) : (
                  <>
                    <Filter label="Status" value={callForm.status} onChange={(v) => setCallForm({ ...callForm, status: v })} options={["CONNECTED", "MISSED", "NO_ANSWER"]} />
                    <Input label="Outcome" value={callForm.outcome} onChange={(v) => setCallForm({ ...callForm, outcome: v })} />
                    <Input label="Duration" type="number" value={callForm.duration} onChange={(v) => setCallForm({ ...callForm, duration: Number(v) })} />
                    <Textarea label="Transcript" value={callForm.transcript} onChange={(v) => setCallForm({ ...callForm, transcript: v })} />
                  </>
                )}
                <Textarea label="Notes" value={callForm.notes} onChange={(v) => setCallForm({ ...callForm, notes: v })} />
                <button className={`w-full ${primaryBtnClass}`}>{callForm.type === "MESSAGE" ? "Log Message" : callForm.type === "EMAIL" ? "Log Email" : "Log Call"}</button>
              </form>
            </Card>
            <Card><h3 className="font-semibold">Tasks / Follow-ups</h3><div className="mt-3 space-y-2">{lead.tasks?.map((task: Task) => <div key={task.id} className="rounded-xl border border-line p-3 transition-colors hover:bg-panel/50"><div className="font-semibold">{task.title}</div><div className="text-sm text-slate-500 dark:text-slate-400">{dateLabel(task.dueDate)} · {titleCase(task.status)}</div>{task.status !== "COMPLETED" ? <button onClick={() => completeTask(task.id)} className="mt-2 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-600 dark:text-brand-400">Complete</button> : null}</div>)}</div><form onSubmit={createTask} className="mt-4 space-y-3"><Input label="New task" value={taskForm.title} onChange={(v) => setTaskForm({ ...taskForm, title: v })} required /><DateField label="Due date" mode="datetime" value={taskForm.dueDate} onChange={(v) => setTaskForm({ ...taskForm, dueDate: v })} required />{taskFormError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{taskFormError}</p> : null}<button className={`w-full ${secondaryBtnClass}`}>Create Follow-up</button></form></Card>
          </div>
        </div>
      </aside>
    </div>
  );
}

function TasksView({ tasks, completeTask, setTaskForm, taskForm, users, leads, createTask, taskFormError }: any) {
  const buckets = [
    { name: "Overdue", tone: "text-red-700 dark:text-red-400" },
    { name: "Today", tone: "text-amber-700 dark:text-amber-400" },
    { name: "Upcoming", tone: "text-slate-700 dark:text-slate-200" },
    { name: "Completed", tone: "text-emerald-700 dark:text-emerald-400" }
  ];
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const COLUMN_LIMIT = 6;

  return (
    <div className="space-y-5">
      <Title title="Tasks" subtitle="Follow-ups grouped by when they are due." />
      <Card>
        <h3 className="mb-3 text-sm font-semibold text-ink">New task</h3>
        <form onSubmit={createTask} className="grid gap-3 md:grid-cols-[2fr_1.2fr_1fr_1fr_auto] md:items-end">
          <Input label="Title" value={taskForm.title} onChange={(v: string) => setTaskForm({ ...taskForm, title: v })} required />
          <DateField label="Due" mode="datetime" value={taskForm.dueDate} onChange={(v: string) => setTaskForm({ ...taskForm, dueDate: v })} required />
          <Filter label="Assignee" value={taskForm.assignedTo} onChange={(v: string) => setTaskForm({ ...taskForm, assignedTo: v })} options={["", ...users.map((u: User) => u.id)]} render={(v: string) => users.find((u: User) => u.id === v)?.name ?? "Assign"} />
          <Filter label="Lead" value={taskForm.leadId} onChange={(v: string) => setTaskForm({ ...taskForm, leadId: v })} options={["", ...leads.map((l: Lead) => l.id)]} render={(v: string) => { const lead = leads.find((l: Lead) => l.id === v); return lead ? `${lead.firstName} ${lead.lastName}` : "Optional"; }} />
          <button className={`h-10 ${primaryBtnClass}`}>Add task</button>
          {taskFormError ? <p role="alert" className="text-sm text-red-600 dark:text-red-400 md:col-span-5">{taskFormError}</p> : null}
        </form>
      </Card>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        {buckets.map(({ name, tone }) => {
          const items = tasks.filter((task: Task) => taskBucket(new Date(task.dueDate), task.status === "COMPLETED") === name);
          const shown = expanded[name] ? items : items.slice(0, COLUMN_LIMIT);
          return (
            <section key={name} aria-label={`${name} tasks`} className="rounded-2xl border border-line bg-panel/50 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className={`text-sm font-semibold ${tone}`}>{name}</h3>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-600 ring-1 ring-line dark:text-slate-300">{items.length}</span>
              </div>
              <div className="space-y-2">
                {shown.length ? shown.map((task: Task) => <TaskRow key={task.id} task={task} action={task.status !== "COMPLETED" ? () => completeTask(task.id) : undefined} />) : <p className="px-1 py-6 text-center text-xs text-slate-500 dark:text-slate-400">Nothing here.</p>}
              </div>
              {items.length > COLUMN_LIMIT ? (
                <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [name]: !prev[name] }))} className="mt-2 w-full rounded-lg py-2 text-xs font-semibold text-brand-700 hover:bg-surface dark:text-brand-400">
                  {expanded[name] ? "Show less" : `Show all ${items.length}`}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function CallsView({ calls, openLead }: any) {
  return (
    <div className="space-y-4">
      <Title title="Conversations" subtitle="Manual call, message, and email log for the POC, linked to leads and timelines." />
      <Card>
        <div className="space-y-2">
          {calls.map((call: Call) => {
            const tone = conversationTone(call);
            const toneClass = conversationCardClass(tone);
            return call.type === "MESSAGE" ? (
              <button key={call.id} onClick={() => call.lead?.id && openLead(call.lead.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-panel ${toneClass}`}>
                <div>
                  <div className="font-semibold">{call.lead?.firstName} {call.lead?.lastName} · {call.direction === "INBOUND" ? "Received" : "Sent"} message</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{call.agent?.name} · {dateLabel(call.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2"><Badge tone={tone}>Logged</Badge><MessageSquare size={16} /></div>
              </button>
            ) : call.type === "EMAIL" ? (
              <button key={call.id} onClick={() => call.lead?.id && openLead(call.lead.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-panel ${toneClass}`}>
                <div>
                  <div className="font-semibold">{call.lead?.firstName} {call.lead?.lastName} · {call.direction === "INBOUND" ? "Received" : "Sent"} email{call.outcome ? ` · ${call.outcome}` : ""}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{call.agent?.name} · {dateLabel(call.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2"><Badge tone={tone}>Logged</Badge><Mail size={16} /></div>
              </button>
            ) : (
              <button key={call.id} onClick={() => call.lead?.id && openLead(call.lead.id)} className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors hover:bg-panel ${toneClass}`}>
                <div>
                  <div className="font-semibold">{call.lead?.firstName} {call.lead?.lastName} · {call.outcome}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">{call.agent?.name} · {call.duration} min · {dateLabel(call.createdAt)}</div>
                </div>
                <div className="flex items-center gap-2"><Badge tone={tone}>{call.status ? titleCase(call.status) : "Logged"}</Badge><Phone size={16} /></div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function CampaignsView({ campaigns, setShowCampaignForm }: any) {
  return (
    <div className="space-y-4">
      <Title title="Campaigns" subtitle="Simple campaign performance tied to lead source and conversion." action={<button onClick={() => setShowCampaignForm(true)} className={primaryBtnClass}>Create Campaign</button>} />
      {!campaigns.length ? (
        <Card><Empty label="No campaigns yet. Create one to start tracking source performance." /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {campaigns.map((campaign: Campaign) => {
            const leads = campaign.leads ?? [];
            const converted = leads.filter((lead) => lead.status === "CONVERTED").length;
            const qualified = leads.filter((lead) => ["QUALIFIED", "INTERESTED", "CONVERTED"].includes(lead.status)).length;
            return (
              <Card key={campaign.id}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{campaign.name}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{campaign.source}</p>
                  </div>
                  <Badge tone={campaignStatusTone(campaign.status)}>{titleCase(campaign.status)}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>{dateLabel(campaign.startDate)}{campaign.endDate ? ` → ${dateLabel(campaign.endDate)}` : ""}</span>
                  <span>Budget ₹{Number(campaign.budget).toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Total leads" value={String(leads.length)} />
                  <Info label="Qualified" value={String(qualified)} />
                  <Info label="Converted" value={String(converted)} />
                  <Info label="Conv. rate" value={`${leads.length ? Math.round((converted / leads.length) * 100) : 0}%`} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function campaignStatusTone(status: string) {
  if (status === "ACTIVE") return "green";
  if (status === "PLANNED") return "slate";
  if (status === "PAUSED") return "amber";
  if (status === "COMPLETED") return "blue";
  return "slate";
}

function AnalyticsView({ dashboard, tasks }: any) {
  if (!dashboard) return <LoadingGrid />;
  const completed = tasks.filter((task: Task) => task.status === "COMPLETED").length;
  const trend = ["Week 1", "Week 2", "Week 3", "Week 4"].map((name, index) => ({ name, converted: Math.max(1, Math.round((dashboard.kpis.converted * (index + 1)) / 4)), leads: Math.round((dashboard.kpis.total * (index + 1)) / 4) }));
  return <div className="space-y-4"><Title title="Analytics" subtitle="Straightforward CRM analytics for the POC demo." /><div className="grid gap-4 xl:grid-cols-2"><ChartCard title="Conversion Trends"><AreaGraph data={trend} /></ChartCard><ChartCard title="Hot/Warm/Cold Distribution"><PieGraph data={dashboard.byPriority} /></ChartCard><ChartCard title="Agent Performance"><AgentGraph data={dashboard.agentPerformance} /></ChartCard><Card><h3 className="font-semibold">Follow-up Completion Rate</h3><div className="mt-5 text-5xl font-semibold">{tasks.length ? Math.round(completed / tasks.length * 100) : 0}%</div><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{completed} of {tasks.length} tasks completed</p></Card></div></div>;
}

function SettingsView({ user, users }: any) {
  return (
    <div className="space-y-4">
      <Title title="Settings" subtitle="Demo users and role-based access overview. Manage accounts in User Management (Admin)." />
      <Card>
        <h3 className="font-semibold">Appearance</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Switch the whole application between light and dark mode.</p>
        <div className="mt-4"><ThemeToggle /></div>
      </Card>
      <Card><h3 className="font-semibold">Current user</h3><p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{user?.name} · {user?.email} · {user?.role}</p></Card>
      <Card><h3 className="font-semibold">Demo users</h3><div className="mt-3 divide-y divide-line">{users.map((u: User) => <div key={u.id} className="flex items-center justify-between py-3 text-sm"><span className="flex items-center gap-2.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-semibold text-white">{u.name.charAt(0)}</span>{u.name}</span><span className="text-slate-500 dark:text-slate-400">{u.email} · {titleCase(u.role)}</span></div>)}</div></Card>
    </div>
  );
}

function CreateLeadModal({ form, setForm, users, campaigns, onClose, onSubmit, busy, error }: any) {
  return <div className="fixed inset-0 z-40 grid animate-fade-in place-items-center bg-slate-900/40 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-3xl animate-slide-up overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-soft thin-scrollbar"><div className="flex justify-between"><div><h2 className="text-xl font-semibold tracking-tight">Create Lead</h2><p className="text-sm text-slate-500 dark:text-slate-400">Saved to PostgreSQL, scored, and opened in Lead 360.</p></div><button type="button" onClick={onClose} className={secondaryBtnClass}>Close</button></div>{error ? <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">{error}</p> : null}<div className="mt-5 grid gap-3 md:grid-cols-2"><Input label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required /><Input label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required /><Input label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required /><Input label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} required /><Input label="Company" value={form.company} onChange={(v) => setForm({ ...form, company: v })} required /><Input label="Designation" value={form.designation} onChange={(v) => setForm({ ...form, designation: v })} /><Input label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} /><Filter label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} options={sources} /><Filter label="Priority" value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={priorities} /><Filter label="Assigned Agent" value={form.assignedTo} onChange={(v) => setForm({ ...form, assignedTo: v })} options={["", ...users.map((u: User) => u.id)]} render={(v) => users.find((u: User) => u.id === v)?.name ?? "Unassigned"} /><Filter label="Campaign" value={form.campaignId} onChange={(v) => setForm({ ...form, campaignId: v })} options={["", ...campaigns.map((c: Campaign) => c.id)]} render={(v) => campaigns.find((c: Campaign) => c.id === v)?.name ?? "None"} /><DateField label="Next Follow-up" mode="datetime" value={form.nextFollowUpAt} onChange={(v) => setForm({ ...form, nextFollowUpAt: v })} /><div className="md:col-span-2"><Textarea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} /></div></div><button disabled={busy} className={`mt-5 ${primaryBtnClass}`}>{busy ? "Creating..." : "Create Lead"}</button></form></div>;
}

function ImportLeadModal({ onClose, onSubmit, busy, message }: { onClose: () => void; onSubmit: (event: React.FormEvent) => void; busy: boolean; message: string }) {
  return (
    <div className="fixed inset-0 z-40 grid animate-fade-in place-items-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="w-full max-w-xl animate-slide-up rounded-2xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex justify-between gap-4">
          <div><h2 className="text-xl font-semibold tracking-tight">Import leads from CSV</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use Excel or Google Sheets. Required columns: First Name, Last Name, Email, Phone, Company.</p></div>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>Close</button>
        </div>
        <label className="mt-5 block rounded-2xl border-2 border-dashed border-brand-300 bg-brand-50/50 p-6 text-center transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-brand-700 dark:bg-brand-500/5">
          <Upload className="mx-auto text-brand-600 dark:text-brand-400" size={28} />
          <span className="mt-3 block text-sm font-semibold text-ink">Choose a CSV file</span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Drag and drop or browse · Max 5 MB</span>
          <input name="leadCsvFile" type="file" accept=".csv,text/csv" className="sr-only" required />
        </label>
        <div className="mt-4 rounded-xl border border-line bg-panel/60 p-3 text-xs leading-5 text-slate-500 dark:text-slate-400"><strong className="text-ink">Supported columns:</strong> First Name, Last Name, Email, Phone, Company, Designation, City, Source, Status, Priority, Assigned Agent, Next Follow-up, Notes.</div>
        {message ? <p className="mt-4 rounded-xl bg-brand-50 px-3 py-2.5 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{message}</p> : null}
        <button disabled={busy} className={`mt-5 w-full ${primaryBtnClass}`}>{busy ? "Importing..." : "Import CSV"}</button>
      </form>
    </div>
  );
}

function CreateCampaignModal({ form, setForm, onClose, onSubmit, busy }: any) {
  return (
    <div className="fixed inset-0 z-40 grid animate-fade-in place-items-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-xl animate-slide-up overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-soft thin-scrollbar">
        <div className="flex justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Create Campaign</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Tracks source performance, budget, and lead conversion.</p>
          </div>
          <button type="button" onClick={onClose} className={secondaryBtnClass}>Close</button>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Input label="Campaign Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required /></div>
          <Filter label="Source" value={form.source} onChange={(v) => setForm({ ...form, source: v })} options={sources} />
          <Filter label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={campaignStatuses} />
          <DateField label="Start Date" mode="date" value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} required />
          <DateField label="End Date" mode="date" value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} />
          <Input label="Budget (₹)" type="number" value={form.budget} onChange={(v) => setForm({ ...form, budget: v })} required />
        </div>
        <button disabled={busy} className={`mt-5 w-full ${primaryBtnClass}`}>{busy ? "Creating..." : "Create Campaign"}</button>
      </form>
    </div>
  );
}

function Title({ title, subtitle, action }: any) {
  return <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-[28px] font-semibold tracking-[-0.04em] text-ink">{title}</h1><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p></div>{action ? <div className="flex flex-wrap items-center gap-2">{action}</div> : null}</div>;
}

const fieldClass =
  "mt-2 w-full rounded-xl border border-line bg-panel px-3 text-sm text-ink outline-none transition-shadow duration-150 placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/12";

const primaryBtnClass =
  "rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-3.5 py-2 text-sm font-semibold text-white shadow-glow transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:hover:brightness-100";
const secondaryBtnClass = "rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-panel";

function Input({ label, value, onChange, type = "text", required = false }: any) {
  return <label className="block"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span><input required={required} type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`h-10 ${fieldClass}`} /></label>;
}

function Textarea({ label, value, onChange }: any) {
  return <label className="block"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span><textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} className={`py-2 ${fieldClass}`} /></label>;
}

function Filter({ label, value, onChange, options, render }: any) {
  return <label className="block"><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</span><select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={`h-10 ${fieldClass}`}>{options.map((option: string) => <option key={option} value={option}>{render ? render(option) : titleCase(option)}</option>)}</select></label>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div><div className="mt-1 text-sm text-ink">{value}</div></div>;
}

function TaskRow({ task, action }: { task: Task; action?: () => void }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface p-3">
      {action ? (
        <button type="button" onClick={action} aria-label={`Mark "${task.title}" complete`} title="Mark complete" className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-slate-300 text-transparent transition-colors hover:border-brand-500 hover:text-brand-600 dark:border-slate-600">
          <CheckCircle2 size={18} />
        </button>
      ) : task.status === "COMPLETED" ? (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Completed" />
      ) : null}
      <div className="min-w-0">
        <div className="text-sm font-medium text-ink">{task.title}</div>
        <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{task.lead ? `${task.lead.firstName} ${task.lead.lastName}` : "No lead"} · {dateLabel(task.dueDate)}</div>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">{label}</div>;
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="h-28 animate-pulse overflow-hidden rounded-2xl border border-line/70 bg-surface bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.06),transparent)] bg-[length:400px_100%]" />
      ))}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card><h3 className="font-semibold text-ink">{title}</h3><div className="mt-4 h-72">{children}</div></Card>;
}


function AgentGraph({ data }: any) {
  return <ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="name" tick={chartTick} /><YAxis allowDecimals={false} tick={chartTick} /><Tooltip contentStyle={chartTooltipStyle} /><Bar dataKey="assigned" fill="#2563eb" radius={[4, 4, 0, 0]} /><Bar dataKey="converted" fill="#16a34a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>;
}

function PieGraph({ data }: any) {
  return <ResponsiveContainer><PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={95} label>{data.map((_: any, i: number) => <Cell key={i} fill={colors[i % colors.length]} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} /></PieChart></ResponsiveContainer>;
}


function AreaGraph({ data }: any) {
  return <ResponsiveContainer><AreaChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" /><XAxis dataKey="name" tick={chartTick} /><YAxis allowDecimals={false} tick={chartTick} /><Tooltip contentStyle={chartTooltipStyle} /><Area type="monotone" dataKey="leads" stroke="#2563eb" fill="#dbeafe" /><Area type="monotone" dataKey="converted" stroke="#16a34a" fill="#dcfce7" /></AreaChart></ResponsiveContainer>;
}
