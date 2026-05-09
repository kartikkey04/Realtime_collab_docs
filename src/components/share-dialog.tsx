import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, X, UserPlus, Copy, Plus, Trash2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Role = "VIEWER" | "EDITOR";
type Expiry = "1h" | "24h" | "7d" | "30d" | "never";

type Collaborator = {
  id: string;
  userId: string;
  role: Role;
  user: { id: string; name: string; email: string };
};

type ShareToken = {
  id: string;
  token: string;
  role: Role;
  expiresAt: string | null;
  createdAt: string;
};

interface ShareDialogProps {
  documentId: string;
  token: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ documentId, token, open, onOpenChange }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [tokens, setTokens] = useState<ShareToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [linkRole, setLinkRole] = useState<Role>("VIEWER");
  const [linkExpiry, setLinkExpiry] = useState<Expiry>("7d");
  const [creatingLink, setCreatingLink] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        apiFetch<Collaborator[]>("GET", `/documents/${documentId}/collaborators`, undefined, token),
        apiFetch<ShareToken[]>("GET", `/documents/${documentId}/share-tokens`, undefined, token).catch(() => []),
      ]);
      setCollaborators(Array.isArray(c) ? c : []);
      setTokens(Array.isArray(t) ? t : []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId, token]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !email.trim()) return;
    setInviting(true);
    try {
      await apiFetch(
        "POST",
        `/documents/${documentId}/collaborators`,
        { email: email.trim(), role },
        token,
      );
      toast.success(`Invited ${email}`);
      setEmail("");
      setRole("VIEWER");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (collab: Collaborator) => {
    if (!token) return;
    setRemovingId(collab.userId);
    try {
      await apiFetch("DELETE", `/documents/${documentId}/collaborators/${collab.userId}`, undefined, token);
      setCollaborators((prev) => prev.filter((c) => c.userId !== collab.userId));
      toast.success("Collaborator removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove");
    } finally {
      setRemovingId(null);
    }
  };

  const createLink = async () => {
    if (!token) return;
    setCreatingLink(true);
    try {
      const t = await apiFetch<ShareToken>(
        "POST",
        `/documents/${documentId}/share-tokens`,
        { role: linkRole, expiresIn: linkExpiry },
        token,
      );
      setTokens((prev) => [t, ...prev]);
      toast.success("Share link created");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setCreatingLink(false);
    }
  };

  const revokeLink = async (id: string) => {
    if (!token) return;
    setRevokingId(id);
    try {
      await apiFetch("DELETE", `/documents/${documentId}/share-tokens/${id}`, undefined, token);
      setTokens((prev) => prev.filter((t) => t.id !== id));
      toast.success("Link revoked");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed");
    } finally {
      setRevokingId(null);
    }
  };

  const copyTokenLink = async (tk: ShareToken) => {
    const url = `${window.location.origin}/shared/${tk.token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Invite people by email or create a public share link.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row">
          <Input
            type="email"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
            disabled={inviting}
          />
          <Select value={role} onValueChange={(v) => setRole(v as Role)} disabled={inviting}>
            <SelectTrigger className="sm:w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="VIEWER">Viewer</SelectItem>
              <SelectItem value="EDITOR">Editor</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" disabled={inviting || !email.trim()}>
            {inviting ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
            Invite
          </Button>
        </form>

        <div className="border-t border-border pt-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">People with access</h3>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">No collaborators yet.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {collaborators.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition">
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                    {(c.user?.name?.[0] ?? c.user?.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.user?.name ?? c.user?.email ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.user?.email}</div>
                  </div>
                  <Badge variant={c.role === "EDITOR" ? "default" : "secondary"}>
                    {c.role.charAt(0) + c.role.slice(1).toLowerCase()}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemove(c)} disabled={removingId === c.userId} aria-label="Remove collaborator">
                    {removingId === c.userId ? <Loader2 size={13} className="animate-spin" /> : <X size={14} />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">Public share links</h3>
          <div className="flex gap-2 mb-2">
            <Select value={linkRole} onValueChange={(v) => setLinkRole(v as Role)} disabled={creatingLink}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="VIEWER">Viewer</SelectItem>
                <SelectItem value="EDITOR">Editor</SelectItem>
              </SelectContent>
            </Select>
            <Select value={linkExpiry} onValueChange={(v) => setLinkExpiry(v as Expiry)} disabled={creatingLink}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1h">1 hour</SelectItem>
                <SelectItem value="24h">24 hours</SelectItem>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
                <SelectItem value="never">Never expires</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={createLink} disabled={creatingLink} className="flex-1">
              {creatingLink ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create link
            </Button>
          </div>
          {tokens.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 text-center">No active links.</p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-40 overflow-y-auto">
              {tokens.map((tk) => (
                <li key={tk.id} className="flex items-center gap-2 p-2 rounded-md bg-secondary/40">
                  <LinkIcon size={12} className="text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <code className="text-xs truncate block">{`${API_BASE_URL.replace(/^https?:\/\//, "")}/shared/${tk.token.slice(0, 12)}…`}</code>
                    <div className="text-[10px] text-muted-foreground">
                      {tk.role.toLowerCase()} · {tk.expiresAt ? `expires ${new Date(tk.expiresAt).toLocaleDateString()}` : "no expiry"}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyTokenLink(tk)} aria-label="Copy link">
                    <Copy size={13} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => revokeLink(tk.id)} disabled={revokingId === tk.id} aria-label="Revoke">
                    {revokingId === tk.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <LinkIcon size={14} />
            Copy this URL
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
