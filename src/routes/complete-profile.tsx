import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { User, ArrowRight, Loader2, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/complete-profile")({
  ssr: false,
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const { token, user, setSession } = useAuth();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      navigate({ to: "/auth" });
    } else if (user?.name) {
      navigate({ to: "/dashboard" });
    }
  }, [token, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !token) return;

    setLoading(true);
    try {
      const updatedUser = await apiFetch(
        "PATCH",
        "/users/me",
        { name: name.trim() },
        token
      );
      setSession(token, updatedUser);
      toast.success("Profile completed! Welcome to CollabDocs.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="p-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center text-white">
            <FileText size={16} />
          </div>
          <span className="font-bold tracking-tight">CollabDocs</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card text-center">
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <User size={32} />
            </div>
            
            <h1 className="text-2xl font-bold tracking-tight mb-2">
              Almost there!
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              We just need your name to set up your profile.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6 text-left">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  autoFocus
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="w-full py-2.5 gradient-bg text-primary-foreground rounded-md font-medium hover:opacity-95 hover:shadow-elegant disabled:opacity-50 transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <>Complete Setup <ArrowRight size={18} /></>}
              </button>
            </form>
          </div>
        </div>
      </main>
      
      <footer className="p-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} CollabDocs
      </footer>
    </div>
  );
}
