"use client";

import { useEffect, useRef, useState } from "react";
import { FAMILY_LEAGUE_ID, isSupabaseConfigured, supabase } from "@/lib/supabase";
import { Card, SectionTitle } from "./ui";

const MESSAGES_TABLE = "bb_messages";
const NAME_KEY = "fbb:chatName";

interface Msg {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

/** Stable accent per author so each family member reads as one color. */
const AUTHOR_COLORS = [
  "#38bdf8",
  "#ec4899",
  "#16a34a",
  "#d97706",
  "#a855f7",
  "#ef4444",
  "#0d9488",
];
function authorColor(name: string): string {
  let h = 0;
  for (const ch of name.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AUTHOR_COLORS[h % AUTHOR_COLORS.length];
}

export function LeagueChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Uncontrolled name input, hydrated from localStorage imperatively so the
  // server render and first client render agree.
  const nameRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(NAME_KEY);
      if (saved && nameRef.current && !nameRef.current.value) {
        nameRef.current.value = saved;
      }
    } catch {
      // ignore
    }
    if (!supabase) return;
    const sb = supabase;
    let active = true;
    (async () => {
      const { data } = await sb
        .from(MESSAGES_TABLE)
        .select("id,author,body,created_at")
        .eq("league_id", FAMILY_LEAGUE_ID)
        .order("created_at", { ascending: true })
        .limit(200);
      if (active && data) setMessages(data as Msg[]);
    })();
    const channel = sb
      .channel("family-chat")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: MESSAGES_TABLE,
          filter: `league_id=eq.${FAMILY_LEAGUE_ID}`,
        },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((cur) =>
            cur.some((x) => x.id === m.id) ? cur : [...cur, m],
          );
        },
      )
      .subscribe();
    return () => {
      active = false;
      sb.removeChannel(channel);
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  if (!isSupabaseConfigured) return null;

  const send = async () => {
    const body = draft.trim();
    const author = nameRef.current?.value.trim() ?? "";
    if (!body || !supabase) return;
    if (!author) {
      nameRef.current?.focus();
      return;
    }
    try {
      localStorage.setItem(NAME_KEY, author);
    } catch {
      // ignore
    }
    setSending(true);
    const { error } = await supabase.from(MESSAGES_TABLE).insert({
      league_id: FAMILY_LEAGUE_ID,
      author: author.slice(0, 40),
      body: body.slice(0, 500),
    });
    setSending(false);
    if (!error) setDraft("");
  };

  return (
    <Card className="lg:sticky lg:top-36">
      <SectionTitle title="House chat" subtitle="Trash talk, live for everyone." />
      <div
        ref={listRef}
        className="h-80 overflow-y-auto pr-1 space-y-2.5 border border-[var(--border)] rounded-lg bg-[var(--surface-2)]/50 p-3"
      >
        {messages.length === 0 ? (
          <p className="text-xs text-[var(--muted)] text-center pt-8">
            No messages yet. Start the trash talk.
          </p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-sm leading-snug">
              <span
                className="font-semibold mr-1.5"
                style={{ color: authorColor(m.author) }}
              >
                {m.author}
              </span>
              <span className="text-[10px] text-[var(--muted)] mr-1.5">
                {timeLabel(m.created_at)}
              </span>
              <span className="break-words">{m.body}</span>
            </div>
          ))
        )}
      </div>
      <div className="mt-3 space-y-2">
        <input
          ref={nameRef}
          placeholder="Your name"
          maxLength={40}
          className="w-full rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-1.5 text-xs outline-none focus:border-accent placeholder:text-[var(--muted)]"
        />
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Say something…"
            maxLength={500}
            className="flex-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] px-3 py-2 text-sm outline-none focus:border-accent placeholder:text-[var(--muted)]"
          />
          <button
            onClick={() => void send()}
            disabled={sending || !draft.trim()}
            className="shrink-0 px-3.5 rounded-lg bg-accent text-[#04263a] text-sm font-semibold hover:brightness-110 transition disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </Card>
  );
}
