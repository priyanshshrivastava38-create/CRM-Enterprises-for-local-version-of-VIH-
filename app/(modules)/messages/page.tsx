"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Hash, Link2, Lock, Megaphone, PenSquare, Search, Send, X } from "lucide-react";
import { Avatar, Modal, primaryBtnClass, secondaryBtnClass } from "@/components/shared/ui";
import { roleLabel } from "@/components/shell/module-nav";
import { useShellUser } from "@/components/shell/user-context";

type Person = { id: string; name: string; role: string };
type LastMessage = { body: string; createdAt: string; author: { id: string; name: string } } | null;
type TeamItem = { id: string; team: string; name: string; description: string; private: boolean; isMember: boolean; unread: number; lastMessage: LastMessage };
type DirectItem = { id: string; other: Person | null; unread: number; lastMessage: LastMessage };
type Inbox = { canBroadcast: boolean; teams: TeamItem[]; directs: DirectItem[]; people: Person[] };
type Message = { id: string; body: string; createdAt: string; recordType: string | null; recordId: string | null; recordLabel: string | null; author: Person };
type RecordRef = { type: string; id: string; label: string };

const POLL_THREAD_MS = 4000;
const POLL_INBOX_MS = 10000;

function recordHref(type: string, id: string) {
  if (type === "opportunity") return `/opportunities?open=${id}`;
  if (type === "invoice") return `/invoices/${id}`;
  if (type === "customer") return `/customers/${id}`;
  return "/?view=leads";
}

function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

function dayLabel(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });
}

function preview(last: LastMessage, meId?: string) {
  if (!last) return "No messages yet";
  return `${last.author.id === meId ? "You" : last.author.name.split(" ")[0]}: ${last.body}`;
}

export default function MessagesPage() {
  return (
    <Suspense fallback={null}>
      <Messages />
    </Suspense>
  );
}

function Messages() {
  const me = useShellUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<RecordRef | null>(null);
  const [filter, setFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showPeople, setShowPeople] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [mobileThread, setMobileThread] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const handledParams = useRef(false);

  const loadInbox = useCallback(async () => {
    const response = await fetch("/api/messages");
    if (response.ok) setInbox(await response.json());
  }, []);

  const openDirect = useCallback(
    async (userId: string) => {
      const response = await fetch("/api/messages/direct", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!response.ok) return;
      const { id } = (await response.json()) as { id: string };
      setShowPeople(false);
      await loadInbox();
      setActiveId(id);
      setMobileThread(true);
    },
    [loadInbox]
  );

  useEffect(() => {
    void loadInbox();
    const timer = setInterval(loadInbox, POLL_INBOX_MS);
    return () => clearInterval(timer);
  }, [loadInbox]);

  // Deep links: ?c=<conversation>, ?team=FINANCE, ?dm=<userId>, plus an optional record to attach (?recordType=&recordId=&recordLabel=).
  useEffect(() => {
    if (!inbox || handledParams.current) return;
    handledParams.current = true;
    const recordType = searchParams.get("recordType");
    const recordId = searchParams.get("recordId");
    const recordLabel = searchParams.get("recordLabel");
    if (recordType && recordId && recordLabel) setAttachment({ type: recordType, id: recordId, label: recordLabel });
    const dm = searchParams.get("dm");
    if (dm) return void openDirect(dm);
    const fromParam = searchParams.get("c") ?? inbox.teams.find((team) => team.team === searchParams.get("team"))?.id;
    const fallback = inbox.teams.find((team) => team.isMember && team.team !== "COMPANY") ?? inbox.teams[0];
    setActiveId(fromParam ?? fallback?.id ?? null);
    if (fromParam) setMobileThread(true);
  }, [inbox, openDirect, searchParams]);

  // Load the open conversation, then poll for newer messages.
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    let latest = "";
    setMessages([]);
    setError("");
    async function poll(initial: boolean) {
      const response = await fetch(`/api/messages/${activeId}${!initial && latest ? `?after=${encodeURIComponent(latest)}` : ""}`);
      if (!response.ok || cancelled) return;
      const { messages: incoming } = (await response.json()) as { messages: Message[] };
      if (!incoming.length && !initial) return;
      latest = incoming.length ? incoming[incoming.length - 1].createdAt : latest;
      setMessages((current) => {
        if (initial) return incoming;
        const seen = new Set(current.map((message) => message.id));
        return [...current, ...incoming.filter((message) => !seen.has(message.id))];
      });
      if (initial || incoming.length) void loadInbox();
    }
    void poll(true);
    const timer = setInterval(() => void poll(false), POLL_THREAD_MS);
    router.replace(`/messages?c=${activeId}`, { scroll: false });
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId, loadInbox, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

  const activeTeam = inbox?.teams.find((team) => team.id === activeId) ?? null;
  const activeDirect = inbox?.directs.find((direct) => direct.id === activeId) ?? null;

  const needle = filter.trim().toLowerCase();
  const teams = useMemo(() => (inbox?.teams ?? []).filter((team) => !needle || team.name.toLowerCase().includes(needle)), [inbox, needle]);
  const directs = useMemo(() => (inbox?.directs ?? []).filter((direct) => !needle || direct.other?.name.toLowerCase().includes(needle)), [inbox, needle]);

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    setSending(true);
    setError("");
    const response = await fetch(`/api/messages/${activeId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: draft, record: attachment })
    });
    setSending(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Message not sent. Please try again.");
      return;
    }
    const { message } = (await response.json()) as { message: Message };
    setMessages((current) => [...current, message]);
    setDraft("");
    setAttachment(null);
    void loadInbox();
  }

  function select(id: string) {
    setActiveId(id);
    setMobileThread(true);
  }

  return (
    <div className="flex h-[calc(100vh-8.5rem)] min-h-[520px] overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      {/* Inbox */}
      <aside className={`w-full shrink-0 flex-col border-r border-line md:flex md:w-[300px] ${mobileThread ? "hidden" : "flex"}`}>
        <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h1 className="text-base font-semibold text-ink">Messages</h1>
          <div className="flex items-center gap-1">
            {inbox?.canBroadcast ? (
              <button type="button" onClick={() => setShowBroadcast(true)} title="Message several teams" aria-label="Message several teams" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-panel hover:text-ink dark:text-slate-400">
                <Megaphone size={16} />
              </button>
            ) : null}
            <button type="button" onClick={() => setShowPeople(true)} title="New direct message" aria-label="New direct message" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-panel hover:text-ink dark:text-slate-400">
              <PenSquare size={16} />
            </button>
          </div>
        </div>
        <div className="px-3 pt-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Find a team or person" aria-label="Find a team or person" className="h-8 w-full rounded-lg border border-line bg-panel pl-8 pr-2 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand-500" />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Conversations">
          <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Teams</div>
          {teams.map((team) => (
            <InboxRow key={team.id} active={team.id === activeId} unread={team.unread} onClick={() => select(team.id)} icon={<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{team.private ? <Lock size={14} /> : <Hash size={15} />}</span>} title={team.name} badge={team.isMember && team.team !== "COMPANY" ? "Your team" : undefined} subtitle={preview(team.lastMessage, me?.id)} />
          ))}
          <div className="mt-4 flex items-center justify-between px-2 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">Direct messages</span>
            <button type="button" onClick={() => setShowPeople(true)} className="text-[11px] font-semibold text-brand-700 hover:text-brand-600 dark:text-brand-400">+ New</button>
          </div>
          {directs.length ? (
            directs.map((direct) => (
              <InboxRow key={direct.id} active={direct.id === activeId} unread={direct.unread} onClick={() => select(direct.id)} icon={<Avatar name={direct.other?.name ?? "?"} size={32} />} title={direct.other?.name ?? "Unknown"} subtitle={preview(direct.lastMessage, me?.id)} />
            ))
          ) : (
            <p className="px-2 py-2 text-xs text-slate-500 dark:text-slate-400">No direct messages yet.</p>
          )}
        </nav>
      </aside>

      {/* Conversation */}
      <section className={`min-w-0 flex-1 flex-col md:flex ${mobileThread ? "flex" : "hidden"}`} aria-label="Conversation">
        {activeTeam || activeDirect ? (
          <>
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
              <button type="button" onClick={() => setMobileThread(false)} aria-label="Back to conversations" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-panel md:hidden">
                <ArrowLeft size={16} />
              </button>
              {activeTeam ? (
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">{activeTeam.private ? <Lock size={15} /> : <Hash size={16} />}</span>
              ) : (
                <Avatar name={activeDirect?.other?.name ?? "?"} size={36} />
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{activeTeam?.name ?? activeDirect?.other?.name}</div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{activeTeam ? activeTeam.description : roleLabel(activeDirect?.other?.role ?? "")}</div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length ? (
                <MessageList messages={messages} meId={me?.id} />
              ) : (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-sm font-semibold text-ink">Start the conversation</div>
                  <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">{activeTeam ? `Everyone in ${activeTeam.name} will see what you post here.` : `Only you and ${activeDirect?.other?.name.split(" ")[0]} can see this conversation.`}</p>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="border-t border-line p-3">
              {attachment ? (
                <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200">
                  <Link2 size={13} className="shrink-0 text-brand-600" aria-hidden="true" />
                  <span className="truncate">
                    Attached: <span className="font-semibold">{attachment.label}</span>
                  </span>
                  <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="text-slate-400 hover:text-ink">
                    <X size={13} />
                  </button>
                </div>
              ) : null}
              {error ? <p role="alert" className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={Math.min(5, Math.max(1, draft.split("\n").length))}
                  placeholder={activeTeam ? `Message ${activeTeam.name}` : `Message ${activeDirect?.other?.name ?? ""}`}
                  aria-label="Message"
                  className="min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10"
                />
                <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40">
                  <Send size={17} />
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
            </form>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-500 dark:text-slate-400">{inbox ? "Choose a team or person to start." : "Loading messages…"}</div>
        )}
      </section>

      {showPeople && inbox ? <PeoplePicker people={inbox.people} onPick={openDirect} onClose={() => setShowPeople(false)} /> : null}
      {showBroadcast && inbox ? (
        <BroadcastModal
          teams={inbox.teams}
          onClose={() => setShowBroadcast(false)}
          onSent={() => {
            setShowBroadcast(false);
            void loadInbox();
          }}
        />
      ) : null}
    </div>
  );
}

function InboxRow({ active, unread, onClick, icon, title, subtitle, badge }: { active: boolean; unread: number; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string; badge?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${active ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-panel"}`}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate text-sm ${unread ? "font-semibold text-ink" : "font-medium text-slate-700 dark:text-slate-200"}`}>{title}</span>
          {badge ? <span className="shrink-0 rounded bg-panel px-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">{badge}</span> : null}
        </span>
        <span className={`block truncate text-xs ${unread ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>{subtitle}</span>
      </span>
      {unread ? <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{unread > 99 ? "99+" : unread}</span> : null}
    </button>
  );
}

function MessageList({ messages, meId }: { messages: Message[]; meId?: string }) {
  return (
    <ol className="space-y-1">
      {messages.map((message, index) => {
        const previous = messages[index - 1];
        const newDay = !previous || dayLabel(previous.createdAt) !== dayLabel(message.createdAt);
        // Consecutive messages from the same person within 5 minutes share one header.
        const grouped = !newDay && previous?.author.id === message.author.id && new Date(message.createdAt).getTime() - new Date(previous.createdAt).getTime() < 5 * 60_000;
        return (
          <li key={message.id}>
            {newDay ? (
              <div className="my-4 flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                <span className="h-px flex-1 bg-line" />
                {dayLabel(message.createdAt)}
                <span className="h-px flex-1 bg-line" />
              </div>
            ) : null}
            <div className={`group flex gap-3 rounded-lg px-2 py-1 hover:bg-panel/60 ${grouped ? "" : "mt-2"}`}>
              <div className="w-8 shrink-0">{grouped ? null : <Avatar name={message.author.name} size={32} />}</div>
              <div className="min-w-0 flex-1">
                {grouped ? null : (
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-ink">{message.author.id === meId ? "You" : message.author.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{roleLabel(message.author.role)}</span>
                    <span className="text-xs text-slate-400">{timeLabel(message.createdAt)}</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 dark:text-slate-200">{message.body}</p>
                {message.recordType && message.recordId && message.recordLabel ? (
                  <Link href={recordHref(message.recordType, message.recordId)} className="mt-1.5 inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand-300">
                    <Link2 size={13} className="shrink-0 text-brand-600" aria-hidden="true" />
                    <span className="truncate">{message.recordLabel}</span>
                  </Link>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function PeoplePicker({ people, onPick, onClose }: { people: Person[]; onPick: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const shown = people.filter((person) => `${person.name} ${roleLabel(person.role)}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Modal title="New direct message" onClose={onClose}>
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or role" aria-label="Search people" className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
      <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto">
        {shown.map((person) => (
          <li key={person.id}>
            <button type="button" onClick={() => onPick(person.id)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-panel">
              <Avatar name={person.name} size={32} />
              <span>
                <span className="block text-sm font-medium text-ink">{person.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">{roleLabel(person.role)}</span>
              </span>
            </button>
          </li>
        ))}
        {!shown.length ? <li className="px-2 py-6 text-center text-sm text-slate-500">No one matches.</li> : null}
      </ul>
    </Modal>
  );
}

function BroadcastModal({ teams, onClose, onSent }: { teams: TeamItem[]; onClose: () => void; onSent: () => void }) {
  const [selected, setSelected] = useState<string[]>(teams.filter((team) => team.team !== "LEADERSHIP" && team.team !== "COMPANY").map((team) => team.team));
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/messages/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teams: selected, body }) });
    setBusy(false);
    if (!response.ok) {
      const json = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(json?.error ?? "Could not send. Please try again.");
      return;
    }
    onSent();
  }

  return (
    <Modal title="Message several teams" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <fieldset>
          <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">Send to</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {teams.map((team) => (
              <label key={team.team} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm ${selected.includes(team.team) ? "border-brand-400 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-200" : "border-line text-ink"}`}>
                <input type="checkbox" checked={selected.includes(team.team)} onChange={(event) => setSelected((current) => (event.target.checked ? [...current, team.team] : current.filter((key) => key !== team.team)))} className="h-4 w-4 accent-[var(--series-1)]" />
                {team.name}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Message</span>
          <textarea required value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="e.g. Great month everyone — let's close the Q3 collections gap by Friday." className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10" />
        </label>
        {error ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400">Posts to {selected.length} team{selected.length === 1 ? "" : "s"}</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className={secondaryBtnClass}>Cancel</button>
            <button type="submit" disabled={busy || !selected.length || !body.trim()} className={primaryBtnClass}>{busy ? "Sending…" : "Send"}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
