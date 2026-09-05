import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Search, Sun, Moon, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const initials = (user?.name || "GU").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
  }

  function toggleMobileSidebar() {
    window.dispatchEvent(new Event("guard:toggle-sidebar"));
  }

  return (
    <header className="header dashboard-header">
      <button className="header-menu-button" onClick={toggleMobileSidebar} aria-label="Abrir menu">
        <span className="mobile-menu-glyph">☰</span>
      </button>
      <div className="header-title-mobile">{title}</div>
      <div className="header-search">
        <Search size={17} />
        <input ref={searchRef} placeholder="Buscar produtos, pedidos ou informações..." aria-label="Buscar" />
        <kbd>Ctrl K</kbd>
      </div>
      <div className="header-user-area">
        <button className="header-icon-button" aria-label="Notificações" type="button">
          <Bell size={19} />
          <i />
        </button>
        <button className="header-theme-button" type="button" aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="header-divider" />
        <div className="header-user-menu">
          <button className="header-user-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-haspopup="menu">
            <div className="header-user">
              <span className="avatar">{initials}</span>
              <span className="header-user-copy">
                <strong>{user?.name || "Usuário"}</strong>
                <small>{user?.role === "ADMIN" ? "Administrador" : "Usuário"}</small>
              </span>
              <ChevronDown size={16} />
            </div>
          </button>
          {menuOpen && (
            <div className="user-menu-dropdown" role="menu">
              <div className="user-menu-summary">
                <strong>{user?.name || "Usuário"}</strong>
                <span>{user?.email || ""}</span>
              </div>
              <div className="user-menu-divider" />
              <button type="button" onClick={() => window.location.assign("/configuracoes")}>
                Configurações
              </button>
              <button type="button" className="danger" onClick={handleLogout}>
                <LogOut size={14} style={{ verticalAlign: "-2px", marginRight: 7 }} />
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
