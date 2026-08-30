import { useState } from "react";
import { Header } from "../components/Header";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { api } from "../api/client";
import { useToast } from "../components/Feedback";

const REPORTS = [
  { type: "vendas", label: "Vendas" },
  { type: "faturamento", label: "Faturamento" },
  { type: "lucro", label: "Lucro" },
  { type: "produtos", label: "Produtos" },
  { type: "curva-abc", label: "Curva ABC" },
  { type: "financeiro", label: "Financeiro" },
  { type: "conciliacao", label: "Conciliação" },
  { type: "publicidade", label: "Publicidade" },
];

export default function Relatorios() {
  const [range, setRange] = useState<RangeFilterValue>({ preset: "last30" });
  const [downloading, setDownloading] = useState<string|null>(null);
  const { notify } = useToast();

  async function download(type: string) {
    setDownloading(type);
    try {
      await api.downloadCsv(`/relatorios/${type}?${rangeToQuery(range)}&format=csv`);
      notify(`CSV de ${REPORTS.find(r=>r.type===type)?.label ?? "relatório"} exportado.`, "success");
    } catch (err: any) {
      notify(err?.message ?? "Não foi possível exportar o CSV.", "error");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <>
      <Header title="Relatórios" />
      <div className="content">
        <RangeFilter value={range} onChange={setRange} />
        <div className="grid grid-cols-3">
          {REPORTS.map((r) => (
            <div key={r.type} className="card">
              <div className="kpi-label mb-4">{r.label}</div>
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => download(r.type)} disabled={downloading===r.type}>
                  {downloading===r.type ? "Exportando..." : "Exportar CSV"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-secondary mt-4" style={{ fontSize: 13 }}>
          Os relatórios são gerados exclusivamente a partir dos dados reais sincronizados das lojas conectadas no período selecionado. Sem sincronização, não há dados para exportar.
        </p>
      </div>
    </>
  );
}
