// Central runtime config — change deployment URL via VITE_API_BASE_URL env var.
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://postmedullary-kandra-nonosmotically.ngrok-free.dev";

export const STORAGE_KEYS = {
  token: "collab_token",
  user: "collab_user",
} as const;
