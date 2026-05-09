import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, History, RotateCcw, Camera, X, Eye } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

type Version = {
  id: string;
  createdAt: string;
  author?: { id: string; name: string } | null;
  size?: number;
};

interface Props {
  documentId: string;
  token: string | null;
  open: boolean;
  onClose: () => void;
  onRestored: (content: string) => void;
}

export function VersionsPanel({ documentId, token, open, onClose, onRestored }: Props) {
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [snapping, setSnapping] = useState(false);
  const [previewing, setPreviewing] = useState<{ id: string; content: string; createdAt: string } | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const data = await apiFetch<Version[]>("GET", `/documents/${documentId}/versions`, undefined, token);
      setVersions(Array.isArray(data) ? data : []);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setVersions([]);
      else toast.error(err instanceof Error ? err.message : "Failed to load versions");
    }
  };

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId, token]);

  const snapshot = async () => {
    if (!token) return;
    setSnapping(true);
    try {
      await apiFetch("POST", `/documents/${documentId}/versions`, undefined, token);
      toast.success("Snapshot saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSnapping(false);
    }
  };

  const restore = async (vid: string) => {
    if (!token) return;
    if (!confirm("Restore this version? Current content will be snapshotted first.")) return;
    setBusyId(vid);
    try {
      const res = await apiFetch<{ content: string }>("POST", `/documents/${documentId}/versions/${vid}/restore`, undefined, token);
      onRestored(res.content ?? "");
      toast.success("Version restored");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to restore");
    } finally {
      setBusyId(null);
    }
  };

  const preview = async (v: Version) => {
    if (!token) return;
    setBusyId(v.id);
    try {
      const res = await apiFetch<{ content: string }>("GET", `/documents/${documentId}/versions/${v.id}`, undefined, token);
      setPreviewing({ id: v.id, content: res.content ?? "", createdAt: v.createdAt });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setBusyId(null);
    }
  };

  if (!open) return null;
  return (
    <aside className="w-full sm:w-96 border-l border-border bg-card flex flex-col h-[100dvh] sticky top-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm inline-flex items-center gap-1.5"><History size={14} /> Version history</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground" aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border">
        <button
          onClick={snapshot}
          disabled={snapping}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-border bg-background hover:bg-accent rounded-md text-sm disabled:opacity-50"
        >
          {snapping ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
          Save a snapshot now
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {versions === null ? (
          <div className="text-center py-6"><Loader2 className="animate-spin inline" size={14} /></div>
        ) : versions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-6">No snapshots yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {versions.map((v) => (
              <li key={v.id} className="rounded-lg border border-border p-3">
                <div className="text-sm font-medium">{new Date(v.createdAt).toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">
                  {v.author?.name ?? "—"}{typeof v.size === "number" ? ` · ${v.size} chars` : ""}
                </div>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => preview(v)}
                    disabled={busyId === v.id}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-border rounded hover:bg-accent disabled:opacity-50"
                  >
                    <Eye size={11} /> Preview
                  </button>
                  <button
                    onClick={() => restore(v.id)}
                    disabled={busyId === v.id}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs gradient-bg text-primary-foreground rounded disabled:opacity-50"
                  >
                    {busyId === v.id ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                    Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewing && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewing(null)}>
          <div className="bg-card border border-border rounded-xl max-w-2xl w-full max-h-[80vh] flex flex-col shadow-card-hover" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <div>
                <h4 className="font-semibold text-sm">Snapshot preview</h4>
                <p className="text-xs text-muted-foreground">{new Date(previewing.createdAt).toLocaleString()}</p>
              </div>
              <button onClick={() => setPreviewing(null)} className="p-1 rounded hover:bg-accent" aria-label="Close"><X size={14} /></button>
            </div>
            <pre className="flex-1 overflow-auto p-5 whitespace-pre-wrap text-sm font-serif-editor leading-relaxed">
              {previewing.content || "(empty)"}
            </pre>
          </div>
        </div>
      )}
    </aside>
  );
}
