import { useEffect, useState } from "react";
import { Megaphone } from "lucide-react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, KpiCard } from "../components/Feedback";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { ProviderFilter } from "../components/MarketplaceFilter";
import { formatCurrency } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

export default function Publicidade() {
  const [range, setRange] = useState<RangeFilterValue>({ preset: "last30" });
  const [provider, setProvider] = useState<MarketplaceProvider | "all">("all");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams(rangeToQuery(range));
    if (provider !== "all") params.set("provider", provider);
    api
      .get<any>(`/publicidade?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [range, provider]);

  return (
    <>
      <Header title="Publicidade" />
      <div className="content">
        <div className="filters-row" style={{ justifyContent: "space-between" }}>
          <RangeFilter value={range} onChange={setRange} />
          <ProviderFilter value={provider} onChange={setProvider} />
        </div>

        {loading && <Loading label="Carregando dados de publicidade..." />}

        {!loading && data && !data.hasData && (
          <EmptyState
            icon={<Megaphone size={40} strokeWidth={1.5} />}
            title="Dado não disponível"
            description="A integração de anúncios de cada marketplace requer um escopo adicional de API de Marketing, aprovado separadamente pela plataforma. Enquanto essa integração não estiver ativa, esta página permanece vazia — nenhum número é inventado."
          />
        )}

        {!loading && data && data.hasData && (
          <>
            <div className="grid grid-cols-3 mb-4">
              <KpiCard label="Investimento" value={formatCurrency(data.investimento)} />
              <KpiCard label="Receita atribuída" value={formatCurrency(data.receita)} />
              <KpiCard label="Retorno (ROAS)" value={`${data.retorno.toFixed(2)}x`} />
            </div>
            <div className="card table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Campanha</th>
                    <th>Data</th>
                    <th>Investimento</th>
                    <th>Receita</th>
                    <th>Cliques</th>
                    <th>Impressões</th>
                    <th>Pedidos</th>
                  </tr>
                </thead>
                <tbody>
                  {data.campanhas.map((c: any, i: number) => (
                    <tr key={i}>
                      <td>{c.nome ?? c.id}</td>
                      <td>{new Date(c.data).toLocaleDateString("pt-BR")}</td>
                      <td>{formatCurrency(c.investimento)}</td>
                      <td>{formatCurrency(c.receita)}</td>
                      <td>{c.cliques}</td>
                      <td>{c.impressoes}</td>
                      <td>{c.pedidos}</td>
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
