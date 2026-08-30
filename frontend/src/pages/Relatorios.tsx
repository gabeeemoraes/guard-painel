import { useState } from "react";
import { Header } from "../components/Header";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";

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

  function download(type: string) {
    window.open(`/api/relatorios/${type}?${rangeToQuery(range)}&format=csv`, "_blank");
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
                <button className="btn btn-primary" onClick={() => download(r.type)}>
                  Exportar CSV
                </button>
              </div>
            </div>
          ))}
        </div>
        <p className="text-secondary mt-4" style={{ fontSize: 13 }}>
          Os relatórios são gerados a partir dos dados reais já sincronizados no período selecionado. Se não houver
          dados, o arquivo indicará "Sem dados disponíveis".
        </p>
      </div>
    </>
  );
}
