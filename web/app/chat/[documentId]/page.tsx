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

interface Conversation {
  id: string;
  createdAt: string;
  messages: { content: string }[];
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

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);

  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);

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

  const fetchConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const res = await fetch(`/api/conversations?documentId=${documentId}`);
      const json = await res.json();
      const list: Conversation[] = json.data ?? [];
      setConversations(list);
      return list;
    } catch {
      return [];
    } finally {
      setConvsLoading(false);
    }
  }, [documentId]);

  const loadConversation = useCallback(async (id: string) => {
    setMessagesLoading(true);
    setConversationId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      const json = await res.json();
      const msgs: Message[] = (json.data ?? []).map((m: Message) => ({
        ...m,
        createdAt: new Date(m.createdAt),
      }));
      setMessages(msgs);
    } catch {
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchConversations().then((list) => {
      if (list.length > 0) loadConversation(list[0].id);
    });
  }, [status, fetchConversations, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

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
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setIsThinking(true);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "", createdAt: new Date() },
      ]);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: trimmed, documentId, conversationId }),
        });

        if (!res.ok || !res.body) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error ?? `HTTP ${res.status}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        const isNewConversation = !conversationId;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = JSON.parse(line.slice(6)) as {
              type: string;
              text?: string;
              message?: string;
              conversationId?: string;
            };

            if (payload.type === "delta" && payload.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: m.content + payload.text! }
                    : m,
                ),
              );
            } else if (payload.type === "done") {
              if (payload.conversationId) {
                setConversationId(payload.conversationId);
                if (isNewConversation) {
                  fetchConversations();
                } else {
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === payload.conversationId && c.messages.length === 0
                        ? { ...c, messages: [{ content: trimmed }] }
                        : c,
                    ),
                  );
                }
              }
            } else if (payload.type === "not_found" || payload.type === "error") {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content:
                          payload.message ??
                          "No relevant content found in this document for your query.",
                      }
                    : m,
                ),
              );
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: msg } : m,
          ),
        );
        fetchConversations();
      } finally {
        setIsThinking(false);
      }
    },
    [documentId, conversationId, isThinking, fetchConversations],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      await fetch(`/api/documents/${documentId}/reprocess`, { method: "POST" });
      setDoc((prev) => prev ? { ...prev, status: "processing" } : prev);
    } finally {
      setIsReprocessing(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
      </div>
    );
  }

  const isEmpty = messages.length === 0 && !messagesLoading;

  return (
    <div className="flex h-screen bg-background text-on-surface overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-white/5 bg-[#0d0d0d]">
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

        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-4">
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

          {/* Document info */}
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
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Ready
                  </span>
                  <button
                    onClick={handleReprocess}
                    disabled={isReprocessing}
                    title="Re-index document"
                    className="text-on-surface-variant hover:text-white disabled:opacity-40 transition-colors"
                  >
                    <span
                      className={`material-symbols-outlined ${isReprocessing ? "animate-spin" : ""}`}
                      style={{ fontSize: "14px" }}
                    >
                      refresh
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <p className="text-xs text-on-surface-variant">Not found</p>
            )}
          </div>

          {/* New chat button */}
          <button
            onClick={startNewChat}
            disabled={isThinking}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/8 bg-white/2 hover:bg-white/5 hover:border-white/15 text-sm font-medium text-on-surface-variant hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "16px" }}>
              add
            </span>
            New chat
          </button>

          {/* Conversations list */}
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <p className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">
              History
            </p>

            {convsLoading ? (
              <div className="space-y-1.5">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-white/3 animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <p className="px-1 text-xs text-on-surface-variant/40 italic">
                No chats yet
              </p>
            ) : (
              <div className="space-y-0.5 overflow-y-auto">
                {conversations.map((conv) => {
                  const isActive = conv.id === conversationId;
                  const preview = conv.messages[0]?.content ?? "New conversation";
                  const date = new Date(conv.createdAt);
                  const label = date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <button
                      key={conv.id}
                      onClick={() => !isActive && loadConversation(conv.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                        isActive
                          ? "bg-primary-fixed/10 border border-primary-fixed/20"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <p
                        className={`text-xs font-medium truncate ${
                          isActive ? "text-white" : "text-on-surface-variant"
                        }`}
                      >
                        {preview}
                      </p>
                      <p className="text-[10px] text-on-surface-variant/50 mt-0.5">
                        {label}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
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
              <p className="text-xs text-on-surface-variant">
                {conversationId ? "Conversation" : "New chat"}
              </p>
            </div>
          </div>

          <button
            onClick={startNewChat}
            disabled={isThinking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-on-surface-variant hover:text-white border border-white/8 hover:border-white/15 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>
              add
            </span>
            New chat
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {messagesLoading ? (
            <div className="max-w-2xl mx-auto space-y-6 pt-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex items-end gap-3 ${i % 2 === 0 ? "flex-row-reverse ml-auto max-w-sm" : "max-w-lg"}`}
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 shrink-0 animate-pulse" />
                  <div
                    className={`h-12 rounded-2xl animate-pulse ${i % 2 === 0 ? "bg-primary-fixed/20 w-full" : "bg-white/5 w-full"}`}
                  />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
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
                  Cortex has indexed every chunk of this file. Ask a question,
                  request a summary, or dig into the details.
                </p>
              </div>
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
              {isThinking && messages[messages.length - 1]?.content === "" && (
                <TypingIndicator />
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-8 py-5 border-t border-white/5 shrink-0">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-end gap-3 px-4 py-3 rounded-2xl border border-white/10 bg-surface-container-low focus-within:border-primary-fixed/40 transition-colors">
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
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
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
