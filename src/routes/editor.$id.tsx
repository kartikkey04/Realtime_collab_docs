import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { ArrowLeft, Type, Code2, Check, Loader2, Share2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/config";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShareDialog } from "@/components/share-dialog";

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
      apiFetch("PATCH", `/documents/${doc.id}`, { title }, token).catch(() => {
        // ignore — backend may use socket only
      });
    }, 800);
    return () => clearTimeout(t);
  }, [title, doc, token]);

  const onContentChange = (next: string) => {
    setContent(next);
    if (skipNextEmit.current) {
      skipNextEmit.current = false;
      return;
    }
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
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
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
          <div className="flex items-center gap-2">
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

      {/* Editor */}
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10 sm:py-14 min-h-[calc(100dvh-7.5rem)]">
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder="Start writing…"
            className={`w-full h-full bg-transparent resize-none focus:outline-none text-foreground placeholder-muted-foreground ${
              fontMode === "serif"
                ? "font-serif-editor text-[18px] leading-[1.75]"
                : "font-mono-editor text-[15px] leading-relaxed"
            }`}
            spellCheck
          />
        </div>
      </main>

      {/* Status bar */}
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
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <kbd>⌘</kbd>
              <kbd>S</kbd>
              <span>auto-saves</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              {presence.length} online
            </span>
          </div>
        </div>
      </footer>
    </div>
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
