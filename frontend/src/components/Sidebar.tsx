import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Wallet, Receipt, Package, Landmark, Megaphone, BarChart3, Calculator, FileText, Plug, Settings, LifeBuoy, ChevronRight, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const MENU = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { path: "/faturamento", label: "Faturamento", icon: Wallet, page: "faturamento" },
  { path: "/pedidos", label: "Pedidos", icon: Receipt, page: "pedidos" },
  { path: "/produtos", label: "Produtos", icon: Package, page: "produtos" },
  { path: "/financeiro", label: "Financeiro", icon: Landmark, page: "financeiro" },
  { path: "/publicidade", label: "Publicidade", icon: Megaphone, page: "publicidade" },
  { path: "/curva-abc", label: "Curva ABC", icon: BarChart3, page: "curva-abc" },
  { path: "/custos", label: "Custos", icon: Calculator, page: "custos" },
  { path: "/relatorios", label: "Relatórios", icon: FileText, page: "relatorios" },
  { path: "/integracoes", label: "Integrações", icon: Plug, page: "integracoes" },
  { path: "/configuracoes", label: "Configurações", icon: Settings, page: "configuracoes" },
];

export function Sidebar() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const toggle = () => setOpen((value) => !value);
    const close = () => setOpen(false);
    window.addEventListener("guard:toggle-sidebar", toggle);
    window.addEventListener("guard:close-sidebar", close);
    return () => {
      window.removeEventListener("guard:toggle-sidebar", toggle);
      window.removeEventListener("guard:close-sidebar", close);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return <>
    {open && <button className="sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Fechar menu" />}
    <aside className={`sidebar${open ? " mobile-open" : ""}`} data-testid="app-sidebar">
      <div className="sidebar-mobile-head">
        <div className="sidebar-brand" style={{ paddingBottom: 0, margin: 0 }}>
          <img src="/guard-logo.svg" alt="GUARD PAINEL" />
          <span>GUARD <b>PAINEL</b></span>
        </div>
        <button className="sidebar-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><X size={18} /></button>
      </div>
      <div className="sidebar-brand sidebar-desktop-brand"><img src="/guard-logo.svg" alt="GUARD PAINEL" /><span>GUARD <b>PAINEL</b></span></div>
      <nav>
        {MENU.filter((item) => can(item.page)).map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}
              data-testid={`sidebar-${item.page}`}
            >
              <Icon />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-support">
        <div className="support-title"><LifeBuoy size={15} /> Precisa de ajuda?</div>
        <p>Revise integrações, conta e preferências no painel.</p>
        <button type="button" onClick={() => { setOpen(false); navigate("/configuracoes"); }}>
          Central da conta <ChevronRight size={13} />
        </button>
      </div>
    </aside>
  </>;
}
