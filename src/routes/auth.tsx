import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Users, Zap, FileText } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth, type User } from "@/lib/auth-context";
import { ThemeToggle } from "@/components/theme-toggle";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "login" | "register";

function AuthPage() {
  const { isAuthenticated, user, setSession, logout } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Hero side */}
      <div className="hidden lg:flex flex-col justify-between p-12 gradient-hero-bg text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center">
              <FileText size={18} />
            </div>
            <span className="text-lg font-bold tracking-tight">CollabDocs</span>
          </div>
        </div>
        <div className="relative z-10 space-y-8 animate-fade-in">
          <div>
            <h2 className="text-4xl font-bold tracking-tight leading-tight">
              Write together,<br />in real time.
            </h2>
            <p className="mt-4 text-white/80 text-lg max-w-md">
              The fastest way to draft, edit, and ship documents with your team —
              no friction, no lag.
            </p>
          </div>
          <div className="space-y-4 max-w-md">
            <Feature icon={<Zap size={18} />} text="Instant sync across every device" />
            <Feature icon={<Users size={18} />} text="See teammates' presence live" />
            <Feature icon={<Sparkles size={18} />} text="Beautifully simple writing experience" />
          </div>
        </div>
        <div className="relative z-10 text-sm text-white/60">
          © {new Date().getFullYear()} CollabDocs
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center px-4 py-10 relative">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8 lg:hidden">
            <h1 className="text-3xl font-bold tracking-tight gradient-text">
              CollabDocs
            </h1>
            <p className="text-sm text-muted-foreground mt-2">
              Real-time collaborative documents
            </p>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-card">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold tracking-tight">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {mode === "login"
                  ? "Sign in to continue to your documents."
                  : "Start collaborating in seconds."}
              </p>
            </div>

            {isAuthenticated ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  You're already signed in as{" "}
                  <span className="font-medium text-foreground">{user?.email}</span>.
                </p>
                <button
                  onClick={() => navigate({ to: "/dashboard" })}
                  className="w-full py-2.5 gradient-bg text-primary-foreground rounded-md font-medium hover:opacity-95 transition"
                >
                  Continue to dashboard
                </button>
                <button
                  onClick={logout}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md transition"
                >
                  Sign out & use a different account
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-md mb-6">
                  {(["login", "register"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`py-2 text-sm font-medium rounded transition-all duration-200 ${
                        mode === m
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "login" ? "Login" : "Register"}
                    </button>
                  ))}
                </div>

                {mode === "login" ? (
                  <LoginForm onSuccess={setSession} />
                ) : (
                  <RegisterForm onSuccess={setSession} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <span className="text-white/90">{text}</span>
    </div>
  );
}

type FieldErrors = Record<string, string>;

function useSubmit(
  fn: () => Promise<{ token: string; user: User }>,
  onSuccess: (token: string, user: User) => void,
  setErrors: (e: FieldErrors) => void,
) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  return {
    loading,
    submit: async (e: React.FormEvent) => {
      e.preventDefault();
      setErrors({});
      setLoading(true);
      try {
        const data = await fn();
        onSuccess(data.token, data.user);
        toast.success("Welcome!");
        navigate({ to: "/dashboard" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Request failed";
        toast.error(msg);
        if (/email/i.test(msg)) setErrors({ email: msg });
        else if (/password/i.test(msg)) setErrors({ password: msg });
        else setErrors({ form: msg });
      } finally {
        setLoading(false);
      }
    },
  };
}

function LoginForm({ onSuccess }: { onSuccess: (t: string, u: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const { loading, submit } = useSubmit(
    () => apiFetch("POST", "/auth/login", { email, password }),
    onSuccess,
    setErrors,
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email" type="email" value={email} onChange={setEmail} error={errors.email} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password} required />
      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
      <SubmitButton loading={loading}>Sign In</SubmitButton>
    </form>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: (t: string, u: User) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const { loading, submit } = useSubmit(
    () => apiFetch("POST", "/auth/register", { name, email, password }),
    onSuccess,
    setErrors,
  );

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Name" value={name} onChange={setName} error={errors.name} required />
      <Field label="Email" type="email" value={email} onChange={setEmail} error={errors.email} required />
      <Field label="Password" type="password" value={password} onChange={setPassword} error={errors.password} minLength={8} required hint="At least 8 characters" />
      {errors.form && <p className="text-sm text-destructive">{errors.form}</p>}
      <SubmitButton loading={loading}>Create Account</SubmitButton>
    </form>
  );
}

function Field({
  label, type = "text", value, onChange, error, required, minLength, hint,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  error?: string; required?: boolean; minLength?: number; hint?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        className="w-full px-3 py-2 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition"
      />
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-2.5 gradient-bg text-primary-foreground rounded-md font-medium hover:opacity-95 hover:shadow-elegant disabled:opacity-50 transition-all duration-200 active:scale-[0.99]"
    >
      {loading ? "Please wait..." : children}
    </button>
  );
}
