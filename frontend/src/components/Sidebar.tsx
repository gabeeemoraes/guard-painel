import { NavLink } from "react-router-dom";
import { LayoutDashboard, Wallet, Receipt, Package, Landmark, Megaphone, BarChart3, Calculator, FileText, Plug, Settings, LifeBuoy, ExternalLink } from "lucide-react";
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
  return <aside className="sidebar">
    <div className="sidebar-brand"><img src="/guard-logo.svg" alt="GUARD PAINEL" /><span>GUARD <b>PAINEL</b></span></div>
    <nav>{MENU.filter((item) => can(item.page)).map((item) => { const Icon = item.icon; return <NavLink key={item.path} to={item.path} className={({ isActive }) => `sidebar-link${isActive ? " active" : ""}`}><Icon /><span>{item.label}</span></NavLink>; })}</nav>
    <div className="sidebar-support"><div className="support-title">Precisa de ajuda?</div><p>Acesse nossa central de suporte.</p><button><LifeBuoy size={14} /> Abrir suporte <ExternalLink size={12} /></button></div>
  </aside>;
}
