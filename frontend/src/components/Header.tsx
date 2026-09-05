import { Bell, ChevronDown, Search } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function Header({ title: _title }: { title: string }) {
  const { user } = useAuth();
  const initials = (user?.name || "Gabriel Moraes").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <header className="header dashboard-header">
      <div className="header-search"><Search size={17} /><input placeholder="Buscar produtos, pedidos ou informações..." /><kbd>Ctrl K</kbd></div>
      <div className="header-user-area">
        <button className="header-icon-button" aria-label="Notificações"><Bell size={19} /><i /></button>
        <div className="header-divider" />
        <div className="header-user"><span className="avatar">{initials}</span><span className="header-user-copy"><strong>{user?.name || "Gabriel Moraes"}</strong><small>{user?.role === "ADMIN" ? "Administrador" : "Usuário"}</small></span><ChevronDown size={16} /></div>
      </div>
    </header>
  );
}
