import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, ApiError } from "../api/client";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  permissions: string[];
}

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (page: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: CurrentUser }>("/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await api.post<{ user: CurrentUser }>("/auth/login", { email, password });
    setUser(res.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // segue para limpar o estado local mesmo se a requisição falhar
    }
    setUser(null);
  }

  function can(page: string) {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    return user.permissions.includes(page);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}

export { ApiError };
