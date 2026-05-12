export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "https://realtime-collab-docs.onrender.com";

export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ??
  "706335464694-uq7hg99uspendasith6vcd82esfslj0u.apps.googleusercontent.com"; // Placeholder

export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const STORAGE_KEYS = {
  token: "collab_token",
  user: "collab_user",
} as const;