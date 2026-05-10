export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://realtime-collab-docs.onrender.com";

export const STORAGE_KEYS = {
  token: "collab_token",
  user:  "collab_user",
} as const;