import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";

type SharedDoc = {
  document: { id: string; title: string; content: string; updatedAt: string };
  role: "VIEWER" | "EDITOR";
};

export const Route = createFileRoute("/shared/$token")({
  component: SharedView,
});

function SharedView() {
  const { token } = Route.useParams();
  const [data, setData] = useState<SharedDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SharedDoc>("GET", `/shared/${token}`)
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Link is invalid or expired"),
      );
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 text-center">
        <h1 className="text-xl font-semibold">Can't open this link</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">{error}</p>
        <Link to="/" className="mt-6 inline-flex px-4 py-2 gradient-bg text-primary-foreground rounded-md text-sm font-medium">
          Go home
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="animate-spin" size={20} />
        <span className="text-sm">Loading shared document…</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-primary-foreground">
              <FileText size={14} />
            </div>
            <span className="font-bold tracking-tight">CollabDocs</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-secondary text-muted-foreground">
              Shared · {data.role.toLowerCase()}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 sm:px-10 py-10">
          <h1 className="text-3xl font-bold tracking-tight mb-6">{data.document.title}</h1>
          <pre className="whitespace-pre-wrap font-serif-editor text-[18px] leading-[1.75] text-foreground">
            {data.document.content || "(empty document)"}
          </pre>
        </div>
      </main>
    </div>
  );
}
