import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, KpiCard } from "../components/Feedback";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { ProviderFilter } from "../components/MarketplaceFilter";
import { formatCurrency, formatPercent } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

interface AbcItem {
  name: string;
  sku: string | null;
  revenue: number;
  quantity: number;
  participation: number;
  cumulativePct: number;
  class: "A" | "B" | "C";
}

export default function CurvaAbc() {
  const [range, setRange] = useState<RangeFilterValue>({ preset: "last30" });
  const [provider, setProvider] = useState<MarketplaceProvider | "all">("all");
  const [data, setData] = useState<{ hasData: boolean; classes: AbcItem[]; summary: Record<string, number> } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(rangeToQuery(range));
    if (provider !== "all") params.set("provider", provider);
    api
      .get<any>(`/curva-abc?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [range, provider]);

  function exportCsv() {
    const params = new URLSearchParams(rangeToQuery(range));
    if (provider !== "all") params.set("provider", provider);
    params.set("format", "csv");
    window.open(`/api/relatorios/curva-abc?${params.toString()}`, "_blank");
  }

  const classColor: Record<string, string> = { A: "badge-green", B: "badge-amber", C: "badge-gray" };

  return (
    <>
      <Header title="Curva ABC" />
      <div className="content">
        <div className="filters-row" style={{ justifyContent: "space-between" }}>
          <RangeFilter value={range} onChange={setRange} />
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            <ProviderFilter value={provider} onChange={setProvider} />
            <button className="btn btn-secondary" onClick={exportCsv}>
              Exportar CSV
            </button>
          </div>
        </div>

        {loading && <Loading label="Calculando curva ABC..." />}
        {!loading && data && !data.hasData && <EmptyState title="Nenhum dado disponível para o período" />}

        {!loading && data && data.hasData && (
          <>
            <div className="grid grid-cols-3 mb-4">
              <KpiCard label="Classe A" value={String(data.summary.A ?? 0)} tone="green" />
              <KpiCard label="Classe B" value={String(data.summary.B ?? 0)} tone="amber" />
              <KpiCard label="Classe C" value={String(data.summary.C ?? 0)} />
            </div>

            <div className="card mb-4">
              <div className="kpi-label mb-4">Faturamento por produto</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.classes.slice(0, 15)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={70} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="var(--al-blue)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>SKU</th>
                    <th>Classe</th>
                    <th>Faturamento</th>
                    <th>Quantidade</th>
                    <th>Participação</th>
                    <th>% Acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.classes.map((c, i) => (
                    <tr key={i}>
                      <td>{c.name}</td>
                      <td>{c.sku ?? "—"}</td>
                      <td>
                        <span className={`badge ${classColor[c.class]}`}>{c.class}</span>
                      </td>
                      <td>{formatCurrency(c.revenue)}</td>
                      <td>{c.quantity}</td>
                      <td>{formatPercent(c.participation)}</td>
                      <td>{formatPercent(c.cumulativePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
