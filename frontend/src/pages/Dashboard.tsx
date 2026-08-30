import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { AlertTriangle, Inbox } from "lucide-react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, KpiCard } from "../components/Feedback";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { ConsolidatedTabs, providerLabel, providerColor } from "../components/MarketplaceFilter";
import { formatCurrency, formatPercent, formatDate } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

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
  lossProducts: { name: string; profit: number }[];
  lowMarginProducts: { name: string; margin: number }[];
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

function GradientArea({
  data,
  dataKey,
  color,
  id,
}: {
  data: { date: string; value: number }[];
  dataKey: string;
  color: string;
  id: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--grid-line)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--text-tertiary)" }}
          tickFormatter={(v) => formatDate(v)}
          axisLine={{ stroke: "var(--border-color)" }}
          tickLine={false}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-tertiary)" }} axisLine={false} tickLine={false} width={70} />
        <Tooltip
          formatter={(v: number) => formatCurrency(v)}
          labelFormatter={(v) => formatDate(v)}
          contentStyle={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12.5,
          }}
        />
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#${id})`} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default function Dashboard() {
  const [view, setView] = useState<"consolidado" | "separado">("consolidado");
  const [range, setRange] = useState<RangeFilterValue>({ preset: "last30" });
  const [data, setData] = useState<DashboardData | null>(null);
  const [marketplaces, setMarketplaces] = useState<MarketplaceRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    if (view === "consolidado") {
      api
        .get<DashboardData>(`/dashboard?${rangeToQuery(range)}`)
        .then(setData)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    } else {
      api
        .get<{ marketplaces: MarketplaceRow[] }>(`/dashboard/by-marketplace?${rangeToQuery(range)}`)
        .then((res) => setMarketplaces(res.marketplaces))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }
  }, [range, view]);

  return (
    <>
      <Header title="Dashboard" />
      <div className="content">
        <div className="filters-row" style={{ justifyContent: "space-between" }}>
          <RangeFilter value={range} onChange={setRange} />
          <ConsolidatedTabs view={view} onChange={setView} />
        </div>

        {loading && <Loading label="Carregando indicadores..." />}
        {!loading && error && (
          <EmptyState icon={<AlertTriangle size={40} strokeWidth={1.5} />} title="Erro ao carregar dashboard" description={error} />
        )}

        {/* ---------- Visão consolidada ---------- */}
        {!loading && !error && view === "consolidado" && data && !data.hasData && (
          <EmptyState
            icon={<Inbox size={40} strokeWidth={1.5} />}
            title="Nenhum dado disponível ainda"
            description="Conecte pelo menos um marketplace em Integrações e clique em Sincronizar Agora para ver seus indicadores aqui."
          />
        )}

        {!loading && !error && view === "consolidado" && data && data.hasData && (
          <>
            <div className="grid grid-cols-4 mb-4">
              <KpiCard label="Faturamento bruto" value={formatCurrency(data.grossRevenue)} />
              <KpiCard label="Faturamento líquido" value={formatCurrency(data.netRevenue)} />
              <KpiCard label="Pedidos" value={String(data.ordersCount)} />
              <KpiCard label="Produtos" value={String(data.productsCount)} />
            </div>
            <div className="grid grid-cols-4 mb-4">
              <KpiCard label="Ticket médio" value={formatCurrency(data.averageTicket)} />
              <KpiCard label="Custos" value={formatCurrency(data.totalCosts)} />
              <KpiCard label="Taxas" value={formatCurrency(data.totalFees)} />
              <KpiCard label="Frete" value={formatCurrency(data.totalShipping)} />
            </div>
            <div className="grid grid-cols-4 mb-4">
              <KpiCard label="Lucro" value={formatCurrency(data.profit)} tone={data.profit >= 0 ? "green" : "red"} />
              <KpiCard label="Margem" value={formatPercent(data.margin)} />
              <KpiCard label="Cancelamentos" value={String(data.cancellations)} />
              <KpiCard label="Devoluções" value={String(data.returns)} />
            </div>
            <div className="grid grid-cols-2 mb-4">
              <KpiCard
                label="Investimento em publicidade"
                value={data.adInvestment > 0 ? formatCurrency(data.adInvestment) : "Sem dados disponíveis"}
              />
              <KpiCard
                label="Retorno sobre publicidade (ROAS)"
                value={data.adReturn > 0 ? `${(data.adReturn / (data.adInvestment || 1)).toFixed(2)}x` : "Sem dados disponíveis"}
              />
            </div>

            <div className="grid grid-cols-2 mb-4">
              <div className="card card-glow">
                <div className="kpi-label mb-4">Evolução das vendas</div>
                <GradientArea data={data.salesEvolution} dataKey="value" color="var(--accent-cyan)" id="salesGradient" />
              </div>
              <div className="card card-glow">
                <div className="kpi-label mb-4">Evolução do lucro</div>
                <GradientArea data={data.profitEvolution} dataKey="value" color="var(--al-green)" id="profitGradient" />
              </div>
            </div>

            <div className="grid grid-cols-2 mb-4">
              <div className="card">
                <div className="kpi-label mb-4">Produtos mais vendidos</div>
                {data.topProducts.map((p, i) => (
                  <div key={i} className="flex justify-between" style={{ padding: "6px 0", fontSize: 13 }}>
                    <span>{p.name}</span>
                    <strong className="text-mono">{formatCurrency(p.revenue)}</strong>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="kpi-label mb-4">Produtos menos vendidos</div>
                {data.worstProducts.map((p, i) => (
                  <div key={i} className="flex justify-between" style={{ padding: "6px 0", fontSize: 13 }}>
                    <span>{p.name}</span>
                    <strong className="text-mono">{formatCurrency(p.revenue)}</strong>
                  </div>
                ))}
              </div>
            </div>

            {data.alerts.length > 0 && (
              <div className="card">
                <div className="kpi-label mb-4">Alertas</div>
                {data.alerts.map((a, i) => (
                  <div key={i} className="badge badge-amber" style={{ marginRight: 8, marginBottom: 6 }}>
                    {a}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ---------- Visão separada por marketplace ---------- */}
        {!loading && !error && view === "separado" && marketplaces && (
          <div className="grid grid-cols-3">
            {marketplaces.map((m) => (
              <div key={m.provider} className="card" style={{ borderTop: `2px solid ${providerColor(m.provider)}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: providerColor(m.provider) }} />
                  <strong style={{ fontFamily: "var(--font-display)" }}>{providerLabel(m.provider)}</strong>
                </div>

                {!m.hasData ? (
                  <p className="text-secondary" style={{ fontSize: 13 }}>
                    Sem dados disponíveis neste período.
                  </p>
                ) : (
                  <>
                    <div className="kpi-label">Faturamento bruto</div>
                    <div className="kpi-value mb-4">{formatCurrency(m.grossRevenue)}</div>

                    <div className="kpi-label">Lucro</div>
                    <div className="kpi-value mb-4" style={{ color: m.profit >= 0 ? "var(--al-green)" : "var(--al-red)" }}>
                      {formatCurrency(m.profit)}
                    </div>

                    <div className="flex justify-between" style={{ fontSize: 13, marginTop: 12 }}>
                      <span className="text-secondary">Margem</span>
                      <strong className="text-mono">{formatPercent(m.margin)}</strong>
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 13, marginTop: 6 }}>
                      <span className="text-secondary">Pedidos</span>
                      <strong className="text-mono">{m.ordersCount}</strong>
                    </div>
                    <div className="flex justify-between" style={{ fontSize: 13, marginTop: 6 }}>
                      <span className="text-secondary">Produtos</span>
                      <strong className="text-mono">{m.productsCount}</strong>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
