import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileText, Clock, Loader2, Save } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { STORAGE_KEYS } from "@/lib/config";
import { ThemeToggle } from "@/components/theme-toggle";

type Profile = { id: string; email: string; name: string; bio?: string | null; avatarUrl?: string | null };
type SharedDoc = { id: string; title: string; updatedAt: string; ownerName?: string };

export const Route = createFileRoute("/profile")({
  ssr: false,
  component: ProfilePage,
});

function ProfilePage() {
  const { token, setSession, user: authUser } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!token) navigate({ to: "/auth" });
  }, [token, navigate]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [shared, setShared] = useState<SharedDoc[] | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<Profile>("GET", "/users/me", undefined, token)
      .then((p) => {
        setProfile(p);
        setName(p.name ?? "");
        setBio(p.bio ?? "");
        setAvatarUrl(p.avatarUrl ?? "");
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load profile"));
    apiFetch<SharedDoc[]>("GET", "/users/me/shared", undefined, token)
      .then((d) => setShared(Array.isArray(d) ? d : []))
      .catch(() => setShared([]));
  }, [token]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Profile>(
        "PATCH",
        "/users/me",
        { name: name.trim(), bio: bio.trim() || null, avatarUrl: avatarUrl.trim() || null },
        token,
      );
      setProfile(updated);
      // Sync auth context user
      if (authUser) setSession(token, { ...authUser, name: updated.name });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-10 grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Profile</h1>
          <p className="text-sm text-muted-foreground mb-6">Update your public details.</p>
          {!profile ? (
            <div className="text-muted-foreground text-sm">Loading…</div>
          ) : (
            <form onSubmit={save} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full gradient-bg flex items-center justify-center text-primary-foreground text-lg font-semibold overflow-hidden">
                  {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : (name?.[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{profile.email}</div>
                  <div className="text-xs text-muted-foreground">Email can't be changed</div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Bio</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Avatar URL</label>
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://…" className="w-full px-3 py-2 bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 gradient-bg text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save changes
              </button>
            </form>
          )}
        </section>

        <aside>
          <h2 className="text-lg font-semibold mb-3">Shared with me</h2>
          {shared === null ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : shared.length === 0 ? (
            <p className="text-sm text-muted-foreground">No documents have been shared with you yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shared.map((d) => (
                <li key={d.id}>
                  <Link
                    to="/editor/$id"
                    params={{ id: d.id }}
                    className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/40 transition"
                  >
                    <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center"><FileText size={14} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{d.title}</div>
                      <div className="text-xs text-muted-foreground inline-flex items-center gap-1"><Clock size={10} />{new Date(d.updatedAt).toLocaleDateString()}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}
