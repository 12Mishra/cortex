"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

interface Doc {
  id: string;
  userId: string;
  fileName: string;
  s3Key: string;
  fileSize: number | null;
  mimeType: string | null;
  status: string; // "pending" | "uploaded" | "processing" | "ready" | "failed"
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        Ready
      </span>
    );
  }
  if (status === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary-fixed/10 border border-primary-fixed/20 text-primary-fixed text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-primary-fixed animate-pulse" />
        Processing
      </span>
    );
  }
  if (status === "uploaded") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-secondary text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
        Uploaded
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 border border-error/20 text-error text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-error" />
        Failed
      </span>
    );
  }
  // pending / unknown
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-on-surface-variant text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-on-surface-variant animate-pulse" />
      Pending
    </span>
  );
}

type FileUploadState = "idle" | "uploading" | "done" | "error";

interface FileEntry {
  file: File;
  state: FileUploadState;
  progress: number; // 0-100
  error?: string;
  documentId?: string; // set after confirm step succeeds
}

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded?: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (incoming: File[]) => {
    const pdfs = incoming.filter((f) => f.type === "application/pdf");
    setEntries((prev) => [
      ...prev,
      ...pdfs.map((file) => ({
        file,
        state: "idle" as FileUploadState,
        progress: 0,
      })),
    ]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(e.dataTransfer.files));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const removeEntry = (i: number) =>
    setEntries((prev) => prev.filter((_, idx) => idx !== i));

  const setEntryState = (i: number, patch: Partial<Omit<FileEntry, "file">>) =>
    setEntries((prev) =>
      prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)),
    );

  const handleUpload = async () => {
    const idleIndexes = entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.state === "idle")
      .map(({ i }) => i);

    if (idleIndexes.length === 0) return;

    await Promise.all(
      idleIndexes.map(async (i) => {
        const { file } = entries[i];
        try {
          setEntryState(i, { state: "uploading", progress: 10 });

          const presignRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "presign",
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || "application/pdf",
            }),
          });
          if (!presignRes.ok) throw new Error("Failed to get upload URL");
          const { presignedUrl, s3Key } = await presignRes.json();

          setEntryState(i, { progress: 30 });

          await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("PUT", presignedUrl);
            xhr.setRequestHeader(
              "Content-Type",
              file.type || "application/pdf",
            );
            xhr.upload.onprogress = (ev) => {
              if (ev.lengthComputable) {
                const pct = 30 + Math.round((ev.loaded / ev.total) * 55);
                setEntryState(i, { progress: pct });
              }
            };
            xhr.onload = () =>
              xhr.status === 200
                ? resolve()
                : reject(new Error(`S3 error ${xhr.status}`));
            xhr.onerror = () => reject(new Error("Network error"));
            xhr.send(file);
          });

          setEntryState(i, { progress: 90 });

          const confirmRes = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "confirm",
              s3Key,
              fileName: file.name,
              fileSize: file.size,
              mimeType: file.type || "application/pdf",
            }),
          });
          if (!confirmRes.ok) throw new Error("Failed to save document");
          const { document } = await confirmRes.json();

          setEntryState(i, { state: "done", progress: 100, documentId: document.id });
        } catch (err) {
          setEntryState(i, {
            state: "error",
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }
      }),
    );

    setUploadDone(true);
    onUploaded?.();
  };

  const [isProcessing, setIsProcessing] = useState(false);

  const handleStartProcessing = async () => {
    const docIds = entries
      .filter((e) => e.state === "done" && e.documentId)
      .map((e) => e.documentId!);

    if (docIds.length === 0) return;

    setIsProcessing(true);
    try {
      await Promise.all(
        docIds.map((id) =>
          fetch("http://localhost:3001/file/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fileId: id }),
          }),
        ),
      );
    } finally {
      setIsProcessing(false);
      onUploaded?.();
      onClose();
    }
  };

  const isUploading = entries.some((e) => e.state === "uploading");
  const hasIdle = entries.some((e) => e.state === "idle");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => e.target === e.currentTarget && !isUploading && onClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border border-white/8 flex flex-col"
        style={{
          background: "#111111",
          boxShadow: "0 32px 64px -12px rgba(0,0,0,0.8)",
          animation: "auth-card-in 0.25s ease-out forwards",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Upload documents
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant leading-relaxed">
              For best results, upload PDFs up to 50&nbsp;MB. Cortex will index
              and chunk them automatically.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="ml-4 w-8 h-8 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-white hover:bg-white/8 disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "20px" }}
            >
              close
            </span>
          </button>
        </div>

        {/* Drop zone — hide once uploading starts */}
        {!isUploading && !uploadDone && (
          <div className="px-6">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className="relative cursor-pointer rounded-xl flex flex-col items-center justify-center gap-3 py-10 px-6 text-center transition-all duration-200"
              style={{
                border: isDragging
                  ? "2px dashed #005ac2"
                  : "2px dashed rgba(255,255,255,0.12)",
                background: isDragging
                  ? "rgba(0,90,194,0.06)"
                  : "rgba(255,255,255,0.02)",
              }}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{
                  background: isDragging
                    ? "rgba(0,90,194,0.15)"
                    : "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "28px",
                    color: isDragging ? "#005ac2" : "#919191",
                    fontVariationSettings: "'FILL' 0",
                  }}
                >
                  upload_file
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Drag and drop PDF files to upload
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Your files will be private until processed.
                </p>
              </div>
              <button
                type="button"
                className="mt-1 px-4 py-2 rounded-lg text-sm font-semibold text-white border border-white/10 bg-white/5 hover:bg-white/10 transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Select files
              </button>
            </div>
          </div>
        )}

        {/* File list with per-file progress */}
        {entries.length > 0 && (
          <div className="px-6 mt-3 space-y-2 max-h-48 overflow-y-auto">
            {entries.map(({ file, state, progress, error }, i) => (
              <div
                key={i}
                className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-white/3 border border-white/6"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{
                      fontSize: "18px",
                      fontVariationSettings: "'FILL' 1",
                      color:
                        state === "done"
                          ? "#34d399"
                          : state === "error"
                            ? "#f87171"
                            : "#005ac2",
                    }}
                  >
                    {state === "done"
                      ? "check_circle"
                      : state === "error"
                        ? "error"
                        : "picture_as_pdf"}
                  </span>
                  <span className="flex-1 text-xs text-white truncate">
                    {file.name}
                  </span>
                  <span className="text-[11px] text-on-surface-variant shrink-0">
                    {(file.size / 1024 / 1024).toFixed(1)} MB
                  </span>
                  {state === "idle" && (
                    <button
                      onClick={() => removeEntry(i)}
                      className="shrink-0 text-on-surface-variant hover:text-white transition-colors"
                    >
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "16px" }}
                      >
                        close
                      </span>
                    </button>
                  )}
                  {state === "done" && (
                    <span className="text-[11px] text-emerald-400 font-medium shrink-0">
                      Done
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                {(state === "uploading" || state === "done") && (
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${state === "done" ? "bg-emerald-500/60" : "bg-primary-fixed"}`}
                      style={{
                        width: `${progress}%`,
                        boxShadow:
                          state === "uploading"
                            ? "0 0 8px rgba(0,90,194,0.7)"
                            : "none",
                      }}
                    />
                  </div>
                )}
                {state === "error" && (
                  <p className="text-[11px] text-red-400">{error}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Step-by-step guide */}
        <div className="px-6 mt-4">
          <button
            onClick={() => setGuideOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-all"
          >
            <span className="text-sm font-medium text-on-surface-variant">
              Step-by-step guide
            </span>
            <span
              className="material-symbols-outlined text-on-surface-variant transition-transform duration-200"
              style={{
                fontSize: "20px",
                transform: guideOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              keyboard_arrow_down
            </span>
          </button>
          {guideOpen && (
            <div className="mt-2 px-4 py-3 rounded-xl bg-white/2 border border-white/5 space-y-2.5">
              {[
                "Click \u201cSelect files\u201d or drag your PDFs into the drop zone above.",
                "Files are uploaded securely and never shared.",
                "Cortex extracts text, splits it into chunks, and indexes vectors.",
                "Once status shows Ready, open a chat to start asking questions.",
              ].map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-primary-fixed/15 border border-primary-fixed/30 text-primary-fixed text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-3 p-6 pt-5">
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-on-surface-variant hover:text-white border border-white/8 hover:border-white/15 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Cancel
          </button>
          <button
            onClick={uploadDone ? handleStartProcessing : handleUpload}
            disabled={isUploading || isProcessing || (!uploadDone && !hasIdle)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-fixed hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Starting…
              </>
            ) : isUploading ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Uploading…
              </>
            ) : uploadDone ? (
              <>
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "16px",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  bolt
                </span>
                Start Processing
              </>
            ) : (
              <>
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "16px",
                    fontVariationSettings: "'FILL' 1",
                  }}
                >
                  cloud_upload
                </span>
                Upload{" "}
                {entries.length > 0
                  ? `${entries.filter((e) => e.state === "idle").length} file${entries.filter((e) => e.state === "idle").length !== 1 ? "s" : ""}`
                  : "files"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(false);
  const [activePage, setActivePage] = useState<
    "dashboard" | "documents" | "repositories"
  >("dashboard");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth");
    }
  }, [status, router]);

  const fetchDocs = useCallback(async () => {
    try {
      setDocsLoading(true);
      const res = await fetch("/api/documents");
      const json = await res.json();
      setDocs(json.data ?? []);
    } catch {
      // silently fail — list stays empty
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchDocs();
  }, [status, fetchDocs]);

  const readyCount = docs.filter((d) => d.status === "ready").length;
  const uploadedCount = docs.filter((d) => d.status === "uploaded").length;
  const processingCount = docs.filter((d) => d.status === "processing").length;

  if (status === "loading" || !session) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <span className="w-2 h-2 rounded-full bg-primary-fixed animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background text-on-surface overflow-hidden">
      <aside className="w-60 shrink-0 flex flex-col border-r border-white/5 bg-[#0d0d0d]">
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

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          <div>
            <button
              onClick={() => setActivePage("dashboard")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activePage === "dashboard"
                  ? "bg-white/8 text-white"
                  : "text-on-surface-variant hover:bg-white/5 hover:text-white"
              }`}
            >
              <span
                className="material-symbols-outlined"
                style={{
                  fontSize: "18px",
                  fontVariationSettings:
                    activePage === "dashboard" ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                grid_view
              </span>
              Dashboard
            </button>
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">
              Knowledge
            </p>
            {(
              [
                { id: "documents", icon: "description", label: "Documents" },
                {
                  id: "repositories",
                  icon: "account_tree",
                  label: "Repositories",
                },
              ] as const
            ).map(({ id, icon, label }) => (
              <button
                key={id}
                onClick={() => setActivePage(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  activePage === id
                    ? "bg-white/8 text-white"
                    : "text-on-surface-variant hover:bg-white/5 hover:text-white"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "18px",
                    fontVariationSettings:
                      activePage === id ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {icon}
                </span>
                {label}
              </button>
            ))}
          </div>

          <div>
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-on-surface-variant/50">
              Recent Chats
            </p>
            <p className="px-3 text-xs text-on-surface-variant/40 italic">
              No chats yet
            </p>
          </div>
        </nav>

        <div className="px-4 py-4 border-t border-white/5">
          {session ? (
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
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: "18px" }}
                >
                  logout
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => router.push("/auth")}
              className="w-full text-sm text-on-surface-variant hover:text-white transition-colors"
            >
              Sign in
            </button>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-8 py-5 border-b border-white/5 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">
              Knowledge Base
            </h1>
            <p className="text-sm text-on-surface-variant mt-0.5">
              {docs.length} documents · {readyCount + uploadedCount} processed
            </p>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-fixed text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all"
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: "16px", fontVariationSettings: "'FILL' 1" }}
            >
              upload
            </span>
            Upload PDF
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8">
          <button
            onClick={() => setShowUpload(true)}
            className="w-full rounded-xl border-2 border-dashed border-white/10 hover:border-primary-fixed/40 hover:bg-primary-fixed/4 py-10 flex flex-col items-center gap-3 transition-all duration-200 group"
          >
            <div className="w-12 h-12 rounded-xl bg-white/5 group-hover:bg-primary-fixed/10 border border-white/8 group-hover:border-primary-fixed/20 flex items-center justify-center transition-all">
              <span
                className="material-symbols-outlined text-on-surface-variant group-hover:text-primary-fixed transition-colors"
                style={{ fontSize: "24px", fontVariationSettings: "'FILL' 0" }}
              >
                upload_file
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white">
                Drop PDFs here to upload
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Supports PDF up to 50MB · Drag and drop or click to browse
              </p>
            </div>
          </button>

          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Documents",
                value: docs.length,
                sub: `${readyCount} ready to chat`,
              },
              {
                label: "Uploaded",
                value: uploadedCount,
                sub: "awaiting processing",
              },
              {
                label: "Processing",
                value: processingCount,
                sub: "being indexed",
              },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-xl bg-surface-container-low border border-white/5 p-5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-widest text-on-surface-variant/60 mb-2">
                  {label}
                </p>
                <p className="text-3xl font-extrabold tracking-tighter text-white">
                  {value}
                </p>
                <p className="text-xs text-on-surface-variant mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant/50 mb-3">
              All Documents
            </p>
            {docsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 rounded-xl bg-surface-container-low border border-white/5 animate-pulse"
                  />
                ))}
              </div>
            ) : docs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span
                  className="material-symbols-outlined text-on-surface-variant/30 mb-3"
                  style={{ fontSize: "40px", fontVariationSettings: "'FILL' 0" }}
                >
                  folder_open
                </span>
                <p className="text-sm font-semibold text-on-surface-variant">No documents yet</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">Upload a PDF to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-4 px-4 py-4 rounded-xl bg-surface-container-low border border-white/5 hover:border-white/10 hover:bg-surface-container transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center shrink-0">
                      <span
                        className="material-symbols-outlined text-on-surface-variant"
                        style={{ fontSize: "20px", fontVariationSettings: "'FILL' 1" }}
                      >
                        description
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        {doc.fileSize
                          ? `${(doc.fileSize / 1024 / 1024).toFixed(1)} MB · `
                          : ""}
                        {new Date(doc.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <StatusBadge status={doc.status} />

                    {doc.status === "ready" && (
                      <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/3 hover:bg-white/8 text-sm font-semibold text-white transition-all shrink-0">
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "16px", fontVariationSettings: "'FILL' 0" }}
                        >
                          chat_bubble_outline
                        </span>
                        Chat
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {showUpload && (
        <UploadModal onClose={() => setShowUpload(false)} onUploaded={fetchDocs} />
      )}
    </div>
  );
}
