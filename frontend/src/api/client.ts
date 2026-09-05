const DEFAULT_API = "https://guard-painel-backend.onrender.com/api";

function normalizeApiBase(value?: string) {
  const raw = String(value || DEFAULT_API).trim().replace(/\/$/, "");
  if (!raw) return DEFAULT_API;
  return /\/api$/i.test(raw) ? raw : `${raw}/api`;
}

export const BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const sessionToken = localStorage.getItem("guard_session_token");
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  if (sessionToken && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${sessionToken}`);

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(BASE + normalizedPath, {
    ...options,
    credentials: "include",
    headers,
  });

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch {}
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return res.json();
  return res.text() as unknown as T;
}

async function downloadCsv(path: string): Promise<void> {
  const sessionToken = localStorage.getItem("guard_session_token");
  const headers = new Headers({ Accept: "text/csv, text/plain;q=0.9, */*;q=0.8" });
  if (sessionToken) headers.set("Authorization", `Bearer ${sessionToken}`);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(BASE + normalizedPath, { credentials: "include", headers });

  if (!res.ok) {
    let message = `Erro ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch {}
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || "relatorio.csv";
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  downloadCsv,
};
