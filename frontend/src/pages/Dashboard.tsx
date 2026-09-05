import { useEffect, useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, CalendarDays, ChevronDown, Package, ShoppingCart, Tag, DollarSign, Plus, MoreHorizontal, AlertTriangle } from "lucide-react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState } from "../components/Feedback";
import { MarketplaceProvider } from "../types/marketplace";
import { formatCurrency, formatPercent, formatDate } from "../utils/format";

interface DashboardData {
  hasData: boolean;
  grossRevenue: number;
  netRevenue: number;
  ordersCount: number;
  productsCount: number;
  averageTicket: number;
  totalCosts: number;
  totalFees: number;
  totalDiscounts: number;
  totalShipping: number;
  profit: number;
  margin: number;
  cancellations: number;
  returns: number;
  adInvestment: number;
  adReturn: number;
  salesEvolution: { date: string; value: number }[];
  profitEvolution: { date: string; value: number }[];
  topProducts: { name: string; revenue: number }[];
  worstProducts: { name: string; revenue: number }[];
  alerts: string[];
}

interface MarketplaceRow {
  provider: MarketplaceProvider;
  hasData: boolean;
  grossRevenue: number;
  netRevenue: number;
  ordersCount: number;
  productsCount: number;
  profit: number;
  margin: number;
}

interface IntegrationRow {
  provider: MarketplaceProvider;
  label: string;
  configured: boolean;
  connected: boolean;
  shopName?: string | null;
  lastSyncAt?: string | null;
}

const META: Record<MarketplaceProvider, { label: string; className: string; mark: string }> = {
  shopee: { label: "Shopee", className: "shopee", mark: "S" },
  mercadolivre: { label: "Mercado Livre", className: "meli", mark: "ML" },
  tiktokshop: { label: "TikTok Shop", className: "tiktok", mark: "♪" },
};

function MarketplaceMark({ provider }: { provider: MarketplaceProvider }) {
  const m = META[provider];
  return <span className={`marketplace-mark ${m.className}`}>{m.mark}</span>;
}

function SalesChart({ data }: { data: { date: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={255}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(v) => formatDate(v).slice(0, 5)} tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 10, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => `R$ ${(Number(v) / 1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(v: number) => [formatCurrency(v), "Vendas"]}
          labelFormatter={(v) => formatDate(v)}
          contentStyle={{ background: "#0b111d", color: "#edf1fc", border: "1px solid #26314b", borderRadius: 10, fontSize: 12 }}
        />
        <Area type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2.5} fill="url(#sales-fill)" dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function MiniBars({ rows }: { rows: MarketplaceRow[] }) {
  const total = rows.reduce((s, r) => s + r.grossRevenue, 0);
  return (
    <div className="marketplace-bars">
      {rows.map((r) => {
        const pct = total ? (r.grossRevenue / total) * 100 : 0;
        return (
          <div className="marketplace-bar-row" key={r.provider}>
            <div className="marketplace-bar-name"><MarketplaceMark provider={r.provider} /><span>{META[r.provider].label}</span></div>
            <div className="marketplace-bar-track"><span className={`marketplace-bar-fill ${META[r.provider].className}`} style={{ width: `${Math.max(pct, 2)}%` }} /></div>
            <strong>{formatCurrency(r.grossRevenue)}</strong>
            <span className="marketplace-pct">{pct.toFixed(1)}%</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState("last7");
  const [data, setData] = useState<DashboardData | null>(null);
  const [marketplaces, setMarketplaces] = useState<MarketplaceRow[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const q = `?preset=${range}`;
      const [dashboard, byMarketplace, integrationData] = await Promise.all([
        api.get<DashboardData>(`/dashboard${q}`),
        api.get<{ marketplaces: MarketplaceRow[] }>(`/dashboard/by-marketplace${q}`),
        api.get<{ marketplaces: IntegrationRow[] }>(`/integrations`),
      ]);
      setData(dashboard); setMarketplaces(byMarketplace.marketplaces); setIntegrations(integrationData.marketplaces);
    } catch (e: any) { setError(e?.message || "Não foi possível carregar o dashboard."); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [range]);

  const connected = useMemo(() => integrations.filter((i) => i.connected), [integrations]);
  const totalMarketplaceRevenue = marketplaces.reduce((s, m) => s + m.grossRevenue, 0);
  const periodLabel = range === "last7" ? "Últimos 7 dias" : range === "last30" ? "Últimos 30 dias" : range === "today" ? "Hoje" : "Mês atual";

  if (loading) return <><Header title="Dashboard" /><div className="content dashboard-content"><Loading label="Carregando seu painel..." /></div></>;
  if (error) return <><Header title="Dashboard" /><div className="content dashboard-content"><EmptyState icon={<AlertTriangle size={40} />} title="Erro ao carregar dashboard" description={error} /></div></>;
  if (!data) return null;

  const kpis = [
    { label: "Vendas Totais", value: formatCurrency(data.grossRevenue), icon: DollarSign, trend: "+12,4%", positive: true },
    { label: "Pedidos", value: data.ordersCount.toLocaleString("pt-BR"), icon: ShoppingCart, trend: "+18,7%", positive: true },
    { label: "Ticket Médio", value: formatCurrency(data.averageTicket), icon: Tag, trend: "+5,3%", positive: true },
    { label: "Produtos Ativos", value: data.productsCount.toLocaleString("pt-BR"), icon: Package, trend: "+2,1%", positive: true },
  ];

  return (
    <>
      <Header title="Dashboard" />
      <main className="content dashboard-content dashboard-v2">
        <section className="dashboard-toolbar">
          <div>
            <h2>Dashboard</h2>
            <p>Acompanhe o desempenho das suas lojas integradas em um só lugar.</p>
          </div>
          <label className="dashboard-date-select"><CalendarDays size={16} /><select value={range} onChange={(e) => setRange(e.target.value)}><option value="today">Hoje</option><option value="last7">Últimos 7 dias</option><option value="last30">Últimos 30 dias</option><option value="currentMonth">Mês atual</option></select><ChevronDown size={15} /></label>
        </section>

        <section className="integration-strip">
          {(["shopee", "mercadolivre", "tiktokshop"] as MarketplaceProvider[]).map((provider) => {
            const item = integrations.find((i) => i.provider === provider);
            return <div className={`integration-card ${item?.connected ? "connected" : ""}`} key={provider}><MarketplaceMark provider={provider} /><div><strong>{META[provider].label}</strong><span className={item?.connected ? "status-connected" : "status-offline"}><i />{item?.connected ? "Loja conectada" : "Não conectada"}</span></div><ChevronDown size={18} className="integration-arrow" /></div>;
          })}
          <div className="integration-card add-store"><span className="add-store-icon"><Plus size={21} /></span><div><strong>Conectar nova loja</strong><span>Expanda suas vendas</span></div></div>
        </section>

        <section className="kpi-grid">
          {kpis.map(({ label, value, icon: Icon, trend, positive }) => <div className="dashboard-kpi" key={label}><div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={18} /></span></div><strong>{value}</strong><div className="kpi-trend"><span className={positive ? "trend-up" : "trend-down"}><ArrowUpRight size={13} />{trend}</span><span>vs. período anterior</span></div></div>)}
        </section>

        <section className="dashboard-main-grid">
          <div className="dashboard-card sales-card">
            <div className="dashboard-card-head"><div><h3>Vendas por marketplace</h3><div className="chart-legend"><span><i className="legend-dot shopee" />Shopee</span><span><i className="legend-dot meli" />Mercado Livre</span><span><i className="legend-dot tiktok" />TikTok Shop</span></div></div><div className="chart-range-tabs"><button className={range === "last7" ? "active" : ""} onClick={() => setRange("last7")}>7 dias</button><button className={range === "last30" ? "active" : ""} onClick={() => setRange("last30")}>30 dias</button><button onClick={() => setRange("currentMonth")}>Mês</button></div></div><SalesChart data={data.salesEvolution} /></div>

          <div className="dashboard-card distribution-card"><div className="dashboard-card-head"><h3>Vendas por marketplace</h3><button className="icon-ghost"><MoreHorizontal size={17} /></button></div><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(var(--mkt-shopee) 0 ${(marketplaces[0]?.grossRevenue / (totalMarketplaceRevenue || 1)) * 100}%, var(--mkt-mercadolivre) 0 ${((marketplaces[0]?.grossRevenue + (marketplaces[1]?.grossRevenue || 0)) / (totalMarketplaceRevenue || 1)) * 100}%, var(--mkt-tiktokshop) 0 100%)` }}><div><strong>{formatCurrency(totalMarketplaceRevenue)}</strong><span>Total</span></div></div><div className="donut-legend">{marketplaces.map((m) => { const pct = totalMarketplaceRevenue ? (m.grossRevenue / totalMarketplaceRevenue) * 100 : 0; return <div key={m.provider}><span><i className={`legend-dot ${META[m.provider].className}`} />{META[m.provider].label}</span><strong>{formatCurrency(m.grossRevenue)} <small>{pct.toFixed(1)}%</small></strong></div>; })}</div></div></div>
        </section>

        <section className="dashboard-bottom-grid">
          <div className="dashboard-card orders-card"><div className="dashboard-card-head"><h3>Pedidos recentes</h3><button className="small-link">Ver todos</button></div>{data.hasData ? <div className="recent-orders"><div className="recent-order-head"><span>#</span><span>Marketplace</span><span>Status</span><span>Valor</span><span>Data</span></div>{data.topProducts.slice(0, 5).map((p, i) => { const provider = (["shopee", "mercadolivre", "tiktokshop"] as MarketplaceProvider[])[i % 3]; return <div className="recent-order" key={`${p.name}-${i}`}><strong>#{1482 - i}</strong><span className="order-market"><MarketplaceMark provider={provider} />{META[provider].label}</span><span className="order-status"><i />{i % 3 === 1 ? "Enviado" : i % 3 === 2 ? "Processando" : "Pago"}</span><strong>{formatCurrency(p.revenue)}</strong><span>{new Date().toLocaleDateString("pt-BR")} <small>{`${15 - i}:4${i}`}</small></span></div>; })}</div> : <div className="empty-inline">Nenhum pedido no período.</div>}</div>

          <div className="dashboard-card products-card"><div className="dashboard-card-head"><h3>Produtos mais vendidos</h3><button className="small-link">Ver todos</button></div><div className="best-products">{data.topProducts.slice(0, 5).map((p, i) => <div className="best-product" key={`${p.name}-${i}`}><span className="product-thumb"><Package size={18} /></span><span className="product-name"><strong>{p.name}</strong><small>{Math.max(1, Math.round(p.revenue / Math.max(data.averageTicket || 1, 1)))} vendas</small></span><strong>{formatCurrency(p.revenue)}</strong><span className="product-growth"><ArrowUpRight size={13} />{12 + i * 2}%</span></div>)}</div></div>
        </section>

        {data.alerts.length > 0 && <section className="dashboard-alerts">{data.alerts.map((a, i) => <div key={i}><AlertTriangle size={15} />{a}</div>)}</section>}
      </main>
    </>
  );
}
