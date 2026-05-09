import { API_BASE_URL, STORAGE_KEYS } from "./config";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function apiFetch<T = any>(
  method: string,
  path: string,
  body?: object,
  token?: string,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_BASE_URL + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Cannot reach server — is the backend running?", 0);
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      localStorage.removeItem(STORAGE_KEYS.token);
      localStorage.removeItem(STORAGE_KEYS.user);
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/auth")) {
        window.location.href = "/auth";
      }
    }
    const msg =
      typeof data?.error === "string"
        ? data.error
        : data?.error?.formErrors?.[0] ??
          (Object.values(data?.error?.fieldErrors ?? {})[0] as string[] | undefined)?.[0] ??
          "Request failed";
    throw new ApiError(msg, res.status, data?.error);
  }

  return data as T;
}
