import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useAuth } from "../context/AuthContext";
import { Loading } from "./Feedback";
import { ScrollControls } from "./ScrollControls";

export function ProtectedLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();

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
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <ScrollControls />
        <Outlet />
      </div>
    </div>
  );
}

// Impede acesso direto por URL a páginas sem permissão, redirecionando ao dashboard.
export function RequirePage({ page, children }: { page: string; children: React.ReactNode }) {
  const { can } = useAuth();
  if (!can(page)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
