import { Sun, Moon, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function Header({ title }: { title: string }) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  return (
    <header className="header">
      <h1>{title}</h1>
      <div className="flex items-center gap-2">
        <div className="theme-toggle">
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-label="Modo claro">
            <Sun />
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-label="Modo escuro">
            <Moon />
          </button>
        </div>
        <div className="text-secondary text-mono" style={{ fontSize: 12.5, marginLeft: 8 }}>
          {user?.name} <span className="badge badge-gray">{user?.role === "ADMIN" ? "Administrador" : "Usuário"}</span>
        </div>
        <button className="btn btn-secondary" onClick={logout}>
          <LogOut />
          Sair
        </button>
      </div>
    </header>
  );
}
