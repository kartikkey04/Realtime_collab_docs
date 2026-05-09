import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Link as LinkIcon, X, UserPlus } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
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

type Collaborator = {
  id: string;
  userId: string;
  role: Role;
  user: { id: string; name: string; email: string };
};

interface ShareDialogProps {
  documentId: string;
  token: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ documentId, token, open, onOpenChange }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("VIEWER");
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Collaborator[]>(
        "GET",
        `/documents/${documentId}/collaborators`,
        undefined,
        token,
      );
      setCollaborators(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load collaborators");
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
      await apiFetch(
        "DELETE",
        `/documents/${documentId}/collaborators/${collab.userId}`,
        undefined,
        token,
      );
      setCollaborators((prev) => prev.filter((c) => c.userId !== collab.userId));
      toast.success("Collaborator removed");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to remove");
    } finally {
      setRemovingId(null);
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share document</DialogTitle>
          <DialogDescription>
            Invite people by email or copy the link to share access.
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
            {inviting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <UserPlus size={14} />
            )}
            Invite
          </Button>
        </form>

        <div className="border-t border-border pt-3">
          <h3 className="text-xs font-medium text-muted-foreground mb-2">
            People with access
          </h3>
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
            </div>
          ) : collaborators.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No collaborators yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {collaborators.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent transition"
                >
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold">
                    {(c.user?.name?.[0] ?? c.user?.email?.[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {c.user?.name ?? c.user?.email ?? "Unknown"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {c.user?.email}
                    </div>
                  </div>
                  <Badge variant={c.role === "EDITOR" ? "default" : "secondary"}>
                    {c.role.charAt(0) + c.role.slice(1).toLowerCase()}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleRemove(c)}
                    disabled={removingId === c.userId}
                    aria-label="Remove collaborator"
                  >
                    {removingId === c.userId ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <X size={14} />
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-3 flex justify-between items-center">
          <Button variant="outline" size="sm" onClick={handleCopyLink}>
            <LinkIcon size={14} />
            Copy link
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
