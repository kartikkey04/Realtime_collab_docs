import { createFileRoute, redirect } from "@tanstack/react-router";
import { STORAGE_KEYS } from "@/lib/config";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.token) : null;
    throw redirect({ to: token ? "/dashboard" : "/auth" });
  },
});
