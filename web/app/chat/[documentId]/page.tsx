"use client";

import { useState, useRef, useEffect, useCallback, use } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  fileName: string;
  fileSize: number | null;
  status: string;
  createdAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 max-w-2xl">
      <div className="w-8 h-8 rounded-full bg-primary-fixed/15 border border-primary-fixed/25 flex items-center justify-center shrink-0">
        <span
          className="material-symbols-outlined text-primary-fixed"
          style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
        >
          hub
        </span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-surface-container-low border border-white/5">
        <div className="flex items-center gap-1.5 h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-on-surface-variant"
              style={{
                animation: `typing-dot 1.2s ease-in-out infinite`,
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ content }: { content: string }) {
  return (
    <div className="flex items-end gap-3 max-w-2xl">
      <div className="w-8 h-8 rounded-full bg-primary-fixed/15 border border-primary-fixed/25 flex items-center justify-center shrink-0">
        <span
          className="material-symbols-outlined text-primary-fixed"
          style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
        >
          hub
        </span>
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-surface-container-low border border-white/5 text-sm text-on-surface leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function UserMessage({
  content,
  avatarUrl,
}: {
  content: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="flex items-end gap-3 max-w-2xl ml-auto flex-row-reverse">
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-white/10">
        {avatarUrl ? (
          <Image src={avatarUrl} alt="You" width={32} height={32} />
        ) : (
          <div className="w-full h-full bg-primary-fixed/20 flex items-center justify-center">
            <span className="text-[11px] font-bold text-primary-fixed">Y</span>
          </div>
        )}
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-br-sm bg-primary-fixed text-white text-sm leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

const STARTERS = [
  "Summarize this document",
  "What are the key takeaways?",
  "List the main topics covered",
  "What questions does this document answer?",
];

export default function ChatPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const [doc, setDoc] = useState<Doc | null>(null);
  const [docLoading, setDocLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch(`/api/documents/${documentId}`)
      .then((r) => r.json())
      .then((json) => setDoc(json.data ?? null))
      .catch(() => setDoc(null))
      .finally(() => setDocLoading(false));
  }, [documentId, status]);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isThinking) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setIsThinking(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId, message: trimmed }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: json.answer ?? json.message ?? "No response received.",
            createdAt: new Date(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content:
              "The chat API isn't connected yet. Once the backend is wired up, responses will appear here.",
            createdAt: new Date(),
          },
        ]);
      } finally {
        setIsThinking(false);
      }
    },
    [documentId, isThinking],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
      </div>
    );
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-screen bg-background text-on-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-white/5 bg-[#0d0d0d]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/5">
          <div className="w-7 h-7 rounded-md bg-primary-fixed flex items-center justify-center">
            <span
              className="material-symbols-outlined text-white"
              style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
            >
              hub
            </span>
          </div>
          <button
            onClick={() => router.push("/")}
            className="text-xl font-bold tracking-tighter text-white"
          >
            Cortex
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Back */}
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-on-surface-variant hover:text-white hover:bg-white/5 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
              arrow_back
            </span>
            Dashboard
          </button>

          {/* Document info card */}
          <div className="rounded-xl border border-white/6 bg-white/2 p-3 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">
              Document
            </p>
            {docLoading ? (
              <div className="space-y-2">
                <div className="h-3 bg-white/5 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-white/5 rounded animate-pulse w-1/2" />
              </div>
            ) : doc ? (
              <>
                <p className="text-xs font-semibold text-white leading-snug line-clamp-3">
                  {doc.fileName}
                </p>
                {doc.fileSize && (
                  <p className="text-[11px] text-on-surface-variant">
                    {(doc.fileSize / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Ready
                </span>
              </>
            ) : (
              <p className="text-xs text-on-surface-variant">Not found</p>
            )}
          </div>

          {/* Chat sessions placeholder */}
          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">
              This Session
            </p>
            <p className="px-3 text-xs text-on-surface-variant/40 italic">
              {messages.length === 0
                ? "No messages yet"
                : `${messages.filter((m) => m.role === "user").length} question${messages.filter((m) => m.role === "user").length !== 1 ? "s" : ""} asked`}
            </p>
          </div>
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/5">
          <div className="flex items-center gap-3">
            {session.user?.image ? (
              <Image
                src={session.user.image}
                alt={session.user.name ?? "User"}
                width={32}
                height={32}
                className="rounded-full border border-white/10 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary-fixed/20 flex items-center justify-center border border-primary-fixed/30 shrink-0">
                <span className="text-xs font-bold text-primary-fixed">
                  {session.user?.name?.[0] ?? "U"}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {session.user?.name ?? "User"}
              </p>
              <p className="text-[11px] text-on-surface-variant truncate">
                {session.user?.email}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="text-on-surface-variant hover:text-white transition-colors"
              title="Sign out"
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                logout
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Chat area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
              <span
                className="material-symbols-outlined text-on-surface-variant"
                style={{ fontSize: "18px", fontVariationSettings: "'FILL' 1" }}
              >
                description
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white truncate">
                {docLoading ? "Loading…" : (doc?.fileName ?? "Document")}
              </h1>
              <p className="text-xs text-on-surface-variant">Chat</p>
            </div>
          </div>

          <button
            onClick={() => {
              if (messages.length > 0 && !confirm("Clear this conversation?")) return;
              setMessages([]);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-on-surface-variant hover:text-white border border-white/8 hover:border-white/15 hover:bg-white/5 transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
              refresh
            </span>
            New chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {isEmpty ? (
            /* Empty state */
            <div className="h-full flex flex-col items-center justify-center gap-8 max-w-xl mx-auto text-center">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-primary-fixed/10 border border-primary-fixed/20 flex items-center justify-center mx-auto mb-4">
                  <span
                    className="material-symbols-outlined text-primary-fixed"
                    style={{ fontSize: "28px", fontVariationSettings: "'FILL' 1" }}
                  >
                    hub
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Ask anything about this document
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant leading-relaxed">
                  Cortex has indexed every chunk of this file. Ask a question, request a
                  summary, or dig into the details.
                </p>
              </div>

              {/* Starter questions */}
              <div className="w-full grid grid-cols-2 gap-2">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="text-left px-4 py-3 rounded-xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 transition-all text-sm text-on-surface-variant hover:text-white"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-6">
              {messages.map((msg) =>
                msg.role === "user" ? (
                  <UserMessage
                    key={msg.id}
                    content={msg.content}
                    avatarUrl={session.user?.image}
                  />
                ) : (
                  <AssistantMessage key={msg.id} content={msg.content} />
                ),
              )}
              {isThinking && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-8 py-5 border-t border-white/5 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div
              className="flex items-end gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-surface-container-low focus-within:border-primary-fixed/40 transition-colors"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
                rows={1}
                disabled={isThinking}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-on-surface-variant/50 resize-none outline-none leading-relaxed disabled:opacity-50"
                style={{ maxHeight: "160px" }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || isThinking}
                className="w-8 h-8 rounded-xl bg-primary-fixed flex items-center justify-center shrink-0 hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                {isThinking ? (
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"
                  />
                ) : (
                  <span
                    className="material-symbols-outlined text-white"
                    style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
                  >
                    arrow_upward
                  </span>
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-on-surface-variant/40">
              Cortex may make mistakes. Verify important information in the source document.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
