import { useEffect, useMemo, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { Loading } from "./Feedback";
import { ScrollControls } from "./ScrollControls";

const ROUTE_ANIMATIONS: Record<string, string> = {
  "/dashboard": "route-scale",
  "/faturamento": "route-left",
  "/pedidos": "route-right",
  "/produtos": "route-left",
  "/financeiro": "route-right",
  "/publicidade": "route-left",
  "/curva-abc": "route-right",
  "/custos": "route-left",
  "/relatorios": "route-right",
  "/integracoes": "route-scale",
  "/configuracoes": "route-left",
};

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem("guard_focus_mode") === "1");

  useEffect(() => {
    const toggle = () => {
      setFocusMode((current) => {
        const next = !current;
        localStorage.setItem("guard_focus_mode", next ? "1" : "0");
        return next;
      });
    };
    window.addEventListener("guard:toggle-focus", toggle);
    return () => window.removeEventListener("guard:toggle-focus", toggle);
  }, []);

  const routeClass = useMemo(
    () => ROUTE_ANIMATIONS[location.pathname] || "",
    [location.pathname]
  );

  if (loading) {
    return (
      <div className="content" style={{ maxWidth: 600, margin: "80px auto" }}>
        <Loading label="Carregando sessão..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className={`app-shell${focusMode ? " focus-mode" : ""}`} data-focus-mode={focusMode ? "on" : "off"}>
      <Sidebar />
      <div className="main-area">
        <ScrollControls />
        <div key={location.pathname} className={`route-transition ${routeClass}`.trim()}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function RequirePage({ page, children }: { page: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(page)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
