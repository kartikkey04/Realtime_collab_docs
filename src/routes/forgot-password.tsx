import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      await apiFetch("POST", "/auth/forgot-password", { email: email.trim() });
      setSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background relative">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card animate-slide-up">
        <Link to="/auth" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft size={12} /> Back to sign in
        </Link>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-primary-foreground">
            <FileText size={16} />
          </div>
          <span className="font-bold tracking-tight">CollabDocs</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          We'll email you a link to choose a new one.
        </p>
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-secondary/40 p-4 text-sm">
              If an account exists for <span className="font-medium text-foreground">{email}</span>,
              a reset link is on its way. Check your inbox (and spam).
            </div>
            <Link to="/auth" className="inline-block w-full text-center py-2.5 gradient-bg text-primary-foreground rounded-md font-medium">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-2.5 gradient-bg text-primary-foreground rounded-md font-medium disabled:opacity-50 transition-all active:scale-[0.99] inline-flex items-center justify-center gap-2"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              Send reset link
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
