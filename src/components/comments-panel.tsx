import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Send, Check, MessageSquarePlus, Undo2, X } from "lucide-react";
import type { Socket } from "socket.io-client";
import { apiFetch, ApiError } from "@/lib/api";

export type Selection = { from: number; to: number; text: string };

type Comment = {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
  isDeleted?: boolean;
};
type Thread = {
  id: string;
  resolved: boolean;
  selection?: Selection | null;
  comments: Comment[];
};

interface Props {
  documentId: string;
  token: string | null;
  selection: Selection | null;
  socket?: Socket | null;
  open: boolean;
  onClose: () => void;
}

export function CommentsPanel({ documentId, token, selection, socket, open, onClose }: Props) {
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Thread[]>(
        "GET",
        `/documents/${documentId}/threads${showResolved ? "?includeResolved=true" : ""}`,
        undefined,
        token,
      );
      setThreads(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setThreads([]);
      else toast.error(err instanceof Error ? err.message : "Failed to load comments");
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    polling.current = setInterval(load, 8000);
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId, token, showResolved]);

  const createThread = async () => {
    if (!token || !newBody.trim()) return;
    setPosting(true);
    try {
      await apiFetch(
        "POST",
        `/documents/${documentId}/threads`,
        { body: newBody.trim(), selection: selection ?? undefined },
        token,
      );
      setNewBody("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const reply = async (tid: string, body: string) => {
    if (!token || !body.trim()) return;
    await apiFetch("POST", `/documents/${documentId}/threads/${tid}/replies`, { body: body.trim() }, token);
    await load();
  };

  const toggleResolve = async (t: Thread) => {
    if (!token) return;
    const action = t.resolved ? "unresolve" : "resolve";
    try {
      await apiFetch("PATCH", `/documents/${documentId}/threads/${t.id}/${action}`, undefined, token);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    }
  };

  if (!open) return null;
  return (
    <aside className="w-full sm:w-96 border-l border-border bg-card flex flex-col h-[100dvh] sticky top-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Comments</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground" aria-label="Close">
          <X size={14} />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-border space-y-2">
        {selection && (
          <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs italic text-muted-foreground">
            Comment on: <span className="text-foreground not-italic">"{selection.text.slice(0, 80)}{selection.text.length > 80 ? "…" : ""}"</span>
          </div>
        )}
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          rows={3}
          placeholder={selection ? "Comment on selection…" : "Add a comment…"}
          className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-between items-center">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Show resolved
          </label>
          <button
            onClick={createThread}
            disabled={posting || !newBody.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 gradient-bg text-primary-foreground rounded-md text-xs font-medium disabled:opacity-50"
          >
            {posting ? <Loader2 size={12} className="animate-spin" /> : <MessageSquarePlus size={12} />}
            Post
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {threads === null ? (
          <div className="text-center text-muted-foreground text-sm py-6"><Loader2 className="animate-spin inline" size={14} /></div>
        ) : threads.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No comments yet.</p>
        ) : (
          threads.map((t) => <ThreadView key={t.id} thread={t} onReply={reply} onToggleResolve={toggleResolve} />)
        )}
      </div>
    </aside>
  );
}

function ThreadView({
  thread,
  onReply,
  onToggleResolve,
}: {
  thread: Thread;
  onReply: (tid: string, body: string) => Promise<void>;
  onToggleResolve: (t: Thread) => void;
}) {
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className={`rounded-lg border border-border p-3 ${thread.resolved ? "opacity-60" : ""}`}>
      {thread.selection?.text && (
        <div className="text-xs italic text-muted-foreground border-l-2 border-primary/40 pl-2 mb-2">
          "{thread.selection.text.slice(0, 100)}{thread.selection.text.length > 100 ? "…" : ""}"
        </div>
      )}
      <div className="space-y-2">
        {thread.comments.map((c) => (
          <div key={c.id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-medium text-foreground">{c.user?.name ?? "Unknown"}</span>
              <span className="text-[10px] text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
            </div>
            <p className="text-foreground whitespace-pre-wrap">{c.isDeleted ? <em className="text-muted-foreground">(deleted)</em> : c.body}</p>
          </div>
        ))}
      </div>
      {!thread.resolved && (
        <div className="mt-2 flex items-end gap-2">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={1}
            placeholder="Reply…"
            className="flex-1 px-2 py-1.5 bg-background border border-input rounded text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            disabled={busy || !reply.trim()}
            onClick={async () => {
              setBusy(true);
              try { await onReply(thread.id, reply); setReply(""); } finally { setBusy(false); }
            }}
            className="p-1.5 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            aria-label="Send reply"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          </button>
        </div>
      )}
      <button
        onClick={() => onToggleResolve(thread)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        {thread.resolved ? <><Undo2 size={11} /> Reopen</> : <><Check size={11} /> Resolve</>}
      </button>
    </div>
  );
}
