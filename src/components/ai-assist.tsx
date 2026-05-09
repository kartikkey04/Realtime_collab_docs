import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Sparkles, Wand2, X, Check, Copy, Replace } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

type Action = "rewrite" | "summarise" | "autocomplete" | "fix_grammar";

const ACTION_LABELS: Record<Action, string> = {
  rewrite: "Rewrite",
  summarise: "Summarise",
  autocomplete: "Continue writing",
  fix_grammar: "Fix grammar",
};

interface Props {
  documentId: string;
  token: string | null;
  selection: string;
  open: boolean;
  onClose: () => void;
  onReplace: (text: string) => void;
  onAppend: (text: string) => void;
}

export function AiAssist({ documentId, token, selection, open, onClose, onReplace, onAppend }: Props) {
  const [action, setAction] = useState<Action>("rewrite");
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);

  const run = async () => {
    if (!token) return;
    if (!selection.trim() && action !== "autocomplete") {
      toast.error("Select some text first");
      return;
    }
    setOutput("");
    setStreaming(true);
    try {
      const res = await fetch(`${API_BASE_URL}/ai/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ documentId, action, selection, instruction: instruction.trim() || undefined }),
      });
      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `AI request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      while (!done) {
        const r = await reader.read();
        if (r.done) break;
        buffer += decoder.decode(r.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            const piece = JSON.parse(data);
            if (typeof piece === "string") setOutput((p) => p + piece);
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed");
    } finally {
      setStreaming(false);
    }
  };

  if (!open) return null;
  return (
    <aside className="w-full sm:w-96 border-l border-border bg-card flex flex-col h-[100dvh] sticky top-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm inline-flex items-center gap-1.5"><Sparkles size={14} /> AI assistant</h3>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-accent text-muted-foreground" aria-label="Close">
          <X size={14} />
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border space-y-3">
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              className={`px-2 py-1.5 rounded-md text-xs font-medium border transition ${
                action === a ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:bg-accent"
              }`}
            >
              {ACTION_LABELS[a]}
            </button>
          ))}
        </div>
        {selection ? (
          <div className="text-xs text-muted-foreground bg-secondary/60 rounded-md p-2 max-h-24 overflow-y-auto">
            <span className="font-medium text-foreground">Selection:</span> {selection.slice(0, 200)}{selection.length > 200 ? "…" : ""}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Select text in the editor first, or use "Continue writing" with no selection.</p>
        )}
        {action === "rewrite" && (
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Optional instructions (e.g. 'make it formal')"
            className="w-full px-3 py-1.5 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        )}
        <button
          onClick={run}
          disabled={streaming}
          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 gradient-bg text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        >
          {streaming ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
          Run
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {output ? (
          <>
            <div className="rounded-lg border border-border bg-background p-3 text-sm whitespace-pre-wrap min-h-[80px]">
              {output}
              {streaming && <span className="inline-block w-1.5 h-4 ml-0.5 bg-primary animate-pulse align-middle" />}
            </div>
            {!streaming && (
              <div className="mt-3 flex flex-wrap gap-2">
                {selection && (
                  <button onClick={() => { onReplace(output); onClose(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 gradient-bg text-primary-foreground rounded-md text-xs font-medium">
                    <Replace size={11} /> Replace selection
                  </button>
                )}
                <button onClick={() => { onAppend(output); onClose(); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:bg-accent rounded-md text-xs">
                  Insert at end
                </button>
                <button
                  onClick={async () => {
                    try { await navigator.clipboard.writeText(output); toast.success("Copied"); } catch { toast.error("Copy failed"); }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border bg-background hover:bg-accent rounded-md text-xs"
                >
                  <Copy size={11} /> Copy
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="text-center text-xs text-muted-foreground py-6">Output will appear here.</p>
        )}
      </div>
    </aside>
  );
}
