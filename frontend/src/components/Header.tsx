import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, Search, Sun, Moon, LogOut, Maximize2, Minimize2, Menu, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function Header({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(() => localStorage.getItem("guard_focus_mode") === "1");
  const searchRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const initials = (user?.name || "GU").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuOpen && userMenuRef.current && !userMenuRef.current.contains(target)) setMenuOpen(false);
      if (notificationsOpen && notificationRef.current && !notificationRef.current.contains(target)) setNotificationsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpen, notificationsOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    navigate("/login", { replace: true });
  }

  function toggleMobileSidebar() {
    window.dispatchEvent(new Event("guard:toggle-sidebar"));
  }

  function toggleFocusMode() {
    setFocusMode((current) => !current);
    window.dispatchEvent(new Event("guard:toggle-focus"));
  }

  return (
    <header className="header dashboard-header" data-testid="app-header">
      <button className="header-menu-button" onClick={toggleMobileSidebar} aria-label="Abrir menu" data-testid="mobile-menu-button">
        <Menu size={20} />
      </button>
      <div className="header-title-mobile">{title}</div>
      <div className="header-search" data-testid="global-search">
        <Search size={17} />
        <input ref={searchRef} placeholder="Buscar produtos, pedidos ou informações..." aria-label="Buscar" />
        <kbd>Ctrl K</kbd>
      </div>
      <div className="header-user-area">
        <button
          className={`header-icon-button focus-mode-button${focusMode ? " active" : ""}`}
          aria-label={focusMode ? "Sair do modo foco" : "Ativar modo foco"}
          title={focusMode ? "Sair do modo foco" : "Modo foco"}
          type="button"
          onClick={toggleFocusMode}
          data-testid="focus-mode-button"
        >
          {focusMode ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
        </button>
        <div className="header-user-menu" ref={notificationRef}>
          <button
            className="header-icon-button"
            aria-label="Notificações"
            aria-expanded={notificationsOpen}
            type="button"
            onClick={() => { setNotificationsOpen((v) => !v); setMenuOpen(false); }}
            data-testid="notifications-button"
          >
            <Bell size={19} />
          </button>
          {notificationsOpen && (
            <div className="user-menu-dropdown notification-dropdown" role="status" data-testid="notifications-dropdown">
              <div className="user-menu-summary">
                <strong>Notificações</strong>
                <span>Avisos importantes aparecem aqui.</span>
              </div>
              <div className="user-menu-divider" />
              <div className="notification-empty"><CheckCircle2 size={17} /> Tudo certo por enquanto.</div>
            </div>
          )}
        </div>
        <button
          className="header-theme-button"
          type="button"
          aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          data-testid="theme-toggle"
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <div className="header-divider" />
        <div className="header-user-menu" ref={userMenuRef}>
          <button
            className="header-user-button"
            type="button"
            onClick={() => { setMenuOpen((value) => !value); setNotificationsOpen(false); }}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            data-testid="user-menu-button"
          >
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
            <div className="user-menu-dropdown" role="menu" data-testid="user-menu-dropdown">
              <div className="user-menu-summary">
                <strong>{user?.name || "Usuário"}</strong>
                <span>{user?.email || ""}</span>
              </div>
              <div className="user-menu-divider" />
              <button type="button" onClick={() => { setMenuOpen(false); navigate("/configuracoes"); }}>
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
