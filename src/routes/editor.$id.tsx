import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { ArrowLeft, Type, Code2, Check, Loader2, Share2, MessageSquare, History, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/config";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShareDialog } from "@/components/share-dialog";
import { CommentsPanel, type Selection } from "@/components/comments-panel";
import { VersionsPanel } from "@/components/versions-panel";
import { AiAssist } from "@/components/ai-assist";

type DocumentDetail = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

type PresenceUser = {
  socketId: string;
  userId: string;
  name: string;
  color: string;
};

type SaveStatus = "idle" | "saving" | "saved";
type FontMode = "serif" | "mono";
type SidePanel = "comments" | "versions" | "ai" | null;

export const Route = createFileRoute("/editor/$id")({
  beforeLoad: () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.token) : null;
    if (!token) throw redirect({ to: "/auth" });
  },
  component: Editor,
});

function Editor() {
  const { id } = Route.useParams();
  const { token } = useAuth();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [panel, setPanel] = useState<SidePanel>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [fontMode, setFontMode] = useState<FontMode>(() => {
    if (typeof window === "undefined") return "serif";
    return localStorage.getItem("collab_font_mode") === "mono" ? "mono" : "serif";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("collab_font_mode", fontMode);
  }, [fontMode]);

  const socketRef = useRef<Socket | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextEmit = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Load document
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    apiFetch<DocumentDetail>("GET", `/documents/${id}`, undefined, token)
      .then((d) => {
        if (cancelled) return;
        setDoc(d);
        setContent(d.content ?? "");
        setTitle(d.title);
        setLastSavedAt(new Date(d.updatedAt));
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load"));
    return () => {
      cancelled = true;
    };
  }, [id, token]);

  // Socket lifecycle
  useEffect(() => {
    if (!token || !doc) return;

    const socket = io(API_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("document:join", doc.id);
    });

    socket.on("presence:update", (users: PresenceUser[]) => {
      setPresence(users);
    });

    socket.on("document:receive", (incoming: string) => {
      setContent((prev) => {
        if (prev === incoming) return prev;
        skipNextEmit.current = true;
        return incoming;
      });
      setLastSavedAt(new Date());
      setStatus("saved");
    });

    socket.on("error", (err: unknown) => {
      console.error("socket error", err);
      toast.error("Connection error");
    });

    socket.on("connect_error", (err) => {
      console.error("socket connect_error", err);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, doc]);

  // Save title (debounced) when changed
  useEffect(() => {
    if (!doc || !token) return;
    if (title === doc.title) return;
    const t = setTimeout(() => {
      apiFetch("PATCH", `/documents/${doc.id}`, { title }, token).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [title, doc, token]);

  const emitContent = (next: string) => {
    const socket = socketRef.current;
    if (!socket || !doc) return;
    socket.emit("document:update", { documentId: doc.id, content: next });
    setStatus("saving");
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => {
      setStatus("saved");
      setLastSavedAt(new Date());
    }, 2500);
  };

  const onContentChange = (next: string) => {
    setContent(next);
    if (skipNextEmit.current) {
      skipNextEmit.current = false;
      return;
    }
    emitContent(next);
  };

  const trackSelection = () => {
    const el = textareaRef.current;
    if (!el) return;
    const from = el.selectionStart;
    const to = el.selectionEnd;
    if (from === to) {
      setSelection(null);
      return;
    }
    setSelection({ from, to, text: content.slice(from, to) });
  };

  const replaceSelection = (text: string) => {
    if (!selection) return;
    const next = content.slice(0, selection.from) + text + content.slice(selection.to);
    setContent(next);
    emitContent(next);
  };

  const appendText = (text: string) => {
    const next = content + (content && !content.endsWith("\n") ? "\n\n" : "") + text;
    setContent(next);
    emitContent(next);
  };

  // Warn the user before they close/reload the tab while a save is in flight
  useEffect(() => {
    if (status !== "saving") return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [status]);

  const stats = useMemo(() => {
    const trimmed = content.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = content.length;
    const minutes = Math.max(1, Math.round(words / 200));
    return { words, chars, minutes };
  }, [content]);

  if (!doc) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-sm">Loading document…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={16} />
            </Link>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className="flex-1 bg-transparent text-base font-semibold focus:outline-none focus:bg-secondary rounded px-2 py-1.5 transition min-w-0"
            />
            <div className="flex items-center gap-1.5">
              <PanelButton active={panel === "ai"} onClick={() => setPanel(panel === "ai" ? null : "ai")} title="AI assistant">
                <Sparkles size={14} />
              </PanelButton>
              <PanelButton active={panel === "comments"} onClick={() => setPanel(panel === "comments" ? null : "comments")} title="Comments">
                <MessageSquare size={14} />
              </PanelButton>
              <PanelButton active={panel === "versions"} onClick={() => setPanel(panel === "versions" ? null : "versions")} title="Version history">
                <History size={14} />
              </PanelButton>
              <button
                onClick={() => setShareOpen(true)}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium text-foreground hover:bg-accent transition"
                title="Share document"
              >
                <Share2 size={14} />
                <span className="hidden sm:inline">Share</span>
              </button>
              <button
                onClick={() => setFontMode((f) => (f === "serif" ? "mono" : "serif"))}
                className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent transition"
                title={fontMode === "serif" ? "Switch to mono" : "Switch to serif"}
              >
                {fontMode === "serif" ? <Code2 size={15} /> : <Type size={15} />}
              </button>
              <ThemeToggle />
              <PresenceStack users={presence} />
            </div>
          </div>
        </header>

        <ShareDialog
          documentId={doc.id}
          token={token}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />

        <main className="flex-1">
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-14 flex flex-col min-h-[calc(100dvh-7.5rem)]">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => onContentChange(e.target.value)}
              onSelect={trackSelection}
              onKeyUp={trackSelection}
              onMouseUp={trackSelection}
              placeholder="Start writing…"
              rows={1}
              className={`w-full flex-1 min-h-[60vh] bg-transparent resize-none focus:outline-none overflow-hidden text-foreground placeholder-muted-foreground ${
                fontMode === "serif"
                  ? "font-serif-editor text-[18px] leading-[1.75]"
                  : "font-mono-editor text-[15px] leading-relaxed"
              }`}
              spellCheck
            />
          </div>
        </main>

        <footer className="border-t border-border bg-card/50 backdrop-blur">
          <div className="max-w-5xl mx-auto px-6 py-2 text-xs text-muted-foreground flex justify-between items-center gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <SaveIndicator status={status} lastSavedAt={lastSavedAt} />
              <span className="hidden sm:inline">·</span>
              <span>{stats.words.toLocaleString()} words</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{stats.chars.toLocaleString()} chars</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">{stats.minutes} min read</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                {presence.length} online
              </span>
            </div>
          </div>
        </footer>
      </div>

      {panel === "comments" && (
        <CommentsPanel
          documentId={doc.id}
          token={token}
          selection={selection}
          open
          onClose={() => setPanel(null)}
        />
      )}
      {panel === "versions" && (
        <VersionsPanel
          documentId={doc.id}
          token={token}
          open
          onClose={() => setPanel(null)}
          onRestored={(c) => { setContent(c); emitContent(c); }}
        />
      )}
      {panel === "ai" && (
        <AiAssist
          documentId={doc.id}
          token={token}
          selection={selection?.text ?? ""}
          open
          onClose={() => setPanel(null)}
          onReplace={replaceSelection}
          onAppend={appendText}
        />
      )}
    </div>
  );
}

function PanelButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

function SaveIndicator({
  status, lastSavedAt,
}: { status: SaveStatus; lastSavedAt: Date | null }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5" aria-live="polite">
        <Loader2 size={11} className="animate-spin" />
        Saving…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-success" aria-live="polite">
      <Check size={11} />
      {lastSavedAt ? `Saved ${formatTime(lastSavedAt)}` : "All changes saved"}
    </span>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function PresenceStack({ users }: { users: PresenceUser[] }) {
  const visible = useMemo(() => users.slice(0, 4), [users]);
  const extra = users.length - visible.length;
  return (
    <div className="flex -space-x-2">
      {visible.map((u) => (
        <div
          key={u.socketId}
          title={u.name}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white border-2 border-background shadow-sm transition-transform hover:scale-110 hover:z-10 animate-scale-in"
          style={{ backgroundColor: u.color }}
        >
          {(u.name?.[0] ?? "?").toUpperCase()}
        </div>
      ))}
      {extra > 0 && (
        <div className="w-8 h-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-medium">
          +{extra}
        </div>
      )}
    </div>
  );
}
