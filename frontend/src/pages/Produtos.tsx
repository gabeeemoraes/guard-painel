import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState } from "../components/Feedback";
import { ProviderFilter, providerLabel } from "../components/MarketplaceFilter";
import { formatCurrency, formatPercent, formatDate } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

interface ProductRow {
  id: string;
  provider: MarketplaceProvider;
  name: string;
  sku: string | null;
  price: number;
  sales: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  stock: number;
  averageSales: number;
  lastSale: string | null;
  stockCoverageDays: number | null;
  hasCostConfigured: boolean;
  alerts: string[];
}

const ALERT_LABELS: Record<string, string> = {
  prejuizo: "Prejuízo",
  baixa_margem: "Baixa margem",
  produto_parado: "Produto parado",
  estoque_baixo: "Estoque baixo",
  risco_ruptura: "Risco de ruptura",
};

export default function Produtos() {
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState<MarketplaceProvider | "all">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ hasData: boolean; products: ProductRow[]; pagination: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (provider !== "all") params.set("provider", provider);
    params.set("page", String(page));
    api
      .get<any>(`/produtos?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [search, page, provider]);

  return (
    <>
      <Header title="Produtos" />
      <div className="content">
        <div className="filters-row" style={{ justifyContent: "space-between" }}>
          <input placeholder="Buscar produto ou SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
          <ProviderFilter value={provider} onChange={setProvider} />
        </div>

        {loading && <Loading label="Carregando produtos..." />}
        {!loading && data && !data.hasData && (
          <EmptyState title="Nenhum produto importado ainda" description="Sincronize sua loja Shopee em Integrações." />
        )}

        {!loading && data && data.hasData && (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Marketplace</th>
                  <th>SKU</th>
                  <th>Preço</th>
                  <th>Vendas</th>
                  <th>Faturamento</th>
                  <th>Custo</th>
                  <th>Lucro</th>
                  <th>Margem</th>
                  <th>Estoque</th>
                  <th>Média vendas/dia</th>
                  <th>Última venda</th>
                  <th>Cobertura</th>
                  <th>Alertas</th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <span className={`badge-provider ${p.provider}`}>
                        <span className="dot" />
                        {providerLabel(p.provider)}
                      </span>
                    </td>
                    <td>{p.sku ?? "—"}</td>
                    <td>{formatCurrency(p.price)}</td>
                    <td>{p.sales}</td>
                    <td>{formatCurrency(p.revenue)}</td>
                    <td>{p.hasCostConfigured ? formatCurrency(p.cost) : "Sem dados disponíveis"}</td>
                    <td style={{ color: p.hasCostConfigured ? (p.profit >= 0 ? "var(--al-green)" : "var(--al-red)") : undefined }}>
                      {p.hasCostConfigured ? formatCurrency(p.profit) : "Sem dados disponíveis"}
                    </td>
                    <td>{p.hasCostConfigured ? formatPercent(p.margin) : "Sem dados disponíveis"}</td>
                    <td>{p.stock}</td>
                    <td>{p.averageSales}</td>
                    <td>{formatDate(p.lastSale)}</td>
                    <td>{p.stockCoverageDays !== null ? `${p.stockCoverageDays} dias` : "Sem dados disponíveis"}</td>
                    <td>
                      {p.alerts.map((a) => (
                        <span key={a} className="badge badge-amber" style={{ marginRight: 4 }}>
                          {ALERT_LABELS[a] ?? a}
                        </span>
                      ))}
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
