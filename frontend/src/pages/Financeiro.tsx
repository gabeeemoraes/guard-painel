import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, KpiCard } from "../components/Feedback";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { ProviderFilter } from "../components/MarketplaceFilter";
import { formatCurrency } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

interface FinanceiroData {
  hasData: boolean;
  totalVendido: number;
  totalRecebido: number;
  pendente: number;
  taxas: number;
  comissoes: number;
  descontos: number;
  frete: number;
  devolucoes: number;
  ajustes: number;
  repasses: number;
  divergencias: number;
}

interface ConciliacaoRow {
  orderId: string;
  venda: number;
  valorPago: number | null;
  taxas: number;
  frete: number;
  valorLiquido: number;
  valorRecebido: number | null;
  diferenca: number | null;
  status: "conciliado" | "divergente" | "pendente";
}

const statusBadge: Record<string, string> = {
  conciliado: "badge-green",
  divergente: "badge-red",
  pendente: "badge-amber",
};

export default function Financeiro() {
  const [tab, setTab] = useState<"financeiro" | "conciliacao">("financeiro");
  const [range, setRange] = useState<RangeFilterValue>({ preset: "last30" });
  const [provider, setProvider] = useState<MarketplaceProvider | "all">("all");
  const [data, setData] = useState<FinanceiroData | null>(null);
  const [conciliacao, setConciliacao] = useState<{ hasData: boolean; rows: ConciliacaoRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(rangeToQuery(range));
    if (provider !== "all") params.set("provider", provider);
    if (tab === "financeiro") {
      api.get<FinanceiroData>(`/financeiro?${params.toString()}`).then(setData).finally(() => setLoading(false));
    } else {
      api
        .get<any>(`/financeiro/conciliacao?${params.toString()}`)
        .then(setConciliacao)
        .finally(() => setLoading(false));
    }
  }, [tab, range, provider]);

  return (
    <>
      <Header title="Financeiro" />
      <div className="content">
        <div className="filters-row" style={{ justifyContent: "space-between" }}>
          <div className="flex gap-2">
            <button className={`btn ${tab === "financeiro" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("financeiro")}>
              Visão geral
            </button>
            <button className={`btn ${tab === "conciliacao" ? "btn-primary" : "btn-secondary"}`} onClick={() => setTab("conciliacao")}>
              Conciliação
            </button>
          </div>
          <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
            <RangeFilter value={range} onChange={setRange} />
            <ProviderFilter value={provider} onChange={setProvider} />
          </div>
        </div>

        {loading && <Loading label="Carregando dados financeiros..." />}

        {!loading && tab === "financeiro" && data && !data.hasData && <EmptyState title="Nenhum dado financeiro no período" />}
        {!loading && tab === "financeiro" && data && data.hasData && (
          <>
            <div className="grid grid-cols-4 mb-4">
              <KpiCard label="Total vendido" value={formatCurrency(data.totalVendido)} />
              <KpiCard label="Total recebido" value={formatCurrency(data.totalRecebido)} />
              <KpiCard label="Pendente" value={formatCurrency(data.pendente)} />
              <KpiCard label="Taxas/comissões" value={formatCurrency(data.taxas)} />
            </div>
            <div className="grid grid-cols-4">
              <KpiCard label="Descontos" value={formatCurrency(data.descontos)} />
              <KpiCard label="Frete" value={formatCurrency(data.frete)} />
              <KpiCard label="Devoluções" value={String(data.devolucoes)} />
              <KpiCard label="Divergências" value={String(data.divergencias)} tone={data.divergencias > 0 ? "red" : undefined} />
            </div>
          </>
        )}

        {!loading && tab === "conciliacao" && conciliacao && !conciliacao.hasData && (
          <EmptyState title="Nenhum pedido para conciliar no período" />
        )}
        {!loading && tab === "conciliacao" && conciliacao && conciliacao.hasData && (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Pedido</th>
                  <th>Venda</th>
                  <th>Valor pago</th>
                  <th>Taxas</th>
                  <th>Frete</th>
                  <th>Valor líquido</th>
                  <th>Valor recebido</th>
                  <th>Diferença</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {conciliacao.rows.map((r) => (
                  <tr key={r.orderId}>
                    <td>{r.orderId}</td>
                    <td>{formatCurrency(r.venda)}</td>
                    <td>{r.valorPago !== null ? formatCurrency(r.valorPago) : "Sem dados disponíveis"}</td>
                    <td>{formatCurrency(r.taxas)}</td>
                    <td>{formatCurrency(r.frete)}</td>
                    <td>{formatCurrency(r.valorLiquido)}</td>
                    <td>{r.valorRecebido !== null ? formatCurrency(r.valorRecebido) : "Sem dados disponíveis"}</td>
                    <td>{r.diferenca !== null ? formatCurrency(r.diferenca) : "—"}</td>
                    <td>
                      <span className={`badge ${statusBadge[r.status]}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
