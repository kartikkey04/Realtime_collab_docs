import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { STORAGE_KEYS } from "./config";

export type User = {
  id: string;
  email?: string;
  name?: string;
  phoneNumber?: string;
  googleId?: string;
  avatar?: string;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setSession: (token: string, user: User) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEYS.token) : null
  );
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null"); }
    catch { return null; }
  });
  

  const setSession = (t: string, u: User) => {
    localStorage.setItem(STORAGE_KEYS.token, t);
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(u));
    setToken(t);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.user);
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/auth";
  };

  return (
    <AuthContext.Provider
      value={{ token, user, isAuthenticated: !!token, setSession, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
