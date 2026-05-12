import { createFileRoute, redirect } from "@tanstack/react-router";
import { STORAGE_KEYS } from "@/lib/config";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: () => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    throw redirect({ to: token ? "/dashboard" : "/auth" });
  },
});
