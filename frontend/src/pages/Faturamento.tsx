import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, KpiCard, useToast } from "../components/Feedback";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { ProviderFilter } from "../components/MarketplaceFilter";
import { formatCurrency, formatPercent, formatDate } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

interface Row { orderId:string; date:string; product:string; sku:string|null; quantity:number; price:number; discount:number; fees:number; shipping:number; cost:number; profit:number; margin:number; status:string; }
interface FaturamentoData { hasData:boolean; summary:{ bruto:number; liquido:number; descontos:number; taxas:number; comissoes:number; frete:number; custo:number; lucro:number; margem:number; }; rows:Row[]; pagination:{page:number;pageSize:number;total:number}; }

export default function Faturamento() {
  const { notify } = useToast();
  const [range,setRange]=useState<RangeFilterValue>({preset:"last30"});
  const [provider,setProvider]=useState<MarketplaceProvider|"all">("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [data,setData]=useState<FaturamentoData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);

  useEffect(()=>{setPage(1)},[range,provider,search]);

  useEffect(()=>{
    let cancelled=false;
    setLoading(true); setError(null);
    const params=new URLSearchParams(rangeToQuery(range));
    if(search.trim())params.set("search",search.trim());
    if(provider!=="all")params.set("provider",provider);
    params.set("page",String(page));
    api.get<FaturamentoData>(`/faturamento?${params.toString()}`).then(res=>{if(!cancelled)setData(res)}).catch(err=>{if(!cancelled)setError(err?.message??"Não foi possível carregar o faturamento.")}).finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[range,search,page,provider]);

  async function exportCsv(){
    try{
      const params=new URLSearchParams(rangeToQuery(range));
      if(provider!=="all")params.set("provider",provider);
      await api.downloadCsv(`/relatorios/faturamento?${params.toString()}&format=csv`);
      notify("CSV de faturamento exportado.","success");
    }catch(err:any){notify(err?.message??"Não foi possível exportar o CSV.","error")}
  }

  return <>
    <Header title="Faturamento"/>
    <div className="content">
      <div className="filters-row" style={{justifyContent:"space-between"}}>
        <div className="flex gap-2" style={{flexWrap:"wrap"}}><RangeFilter value={range} onChange={setRange}/><input placeholder="Buscar pedido ou comprador" value={search} onChange={e=>setSearch(e.target.value)} /></div>
        <div className="flex gap-2" style={{flexWrap:"wrap"}}><ProviderFilter value={provider} onChange={setProvider}/><button className="btn btn-secondary" onClick={exportCsv}>Exportar CSV</button></div>
      </div>
      {loading&&<Loading label="Carregando faturamento..."/>}
      {!loading&&error&&<EmptyState title="Erro ao carregar faturamento" description={error}/>} 
      {!loading&&!error&&data&&!data.hasData&&<EmptyState title="Nenhum faturamento no período" description="Ajuste o filtro de datas ou sincronize a loja."/>}
      {!loading&&!error&&data&&data.hasData&&<>
        <div className="grid grid-cols-4 mb-4"><KpiCard label="Bruto" value={formatCurrency(data.summary.bruto)}/><KpiCard label="Líquido" value={formatCurrency(data.summary.liquido)}/><KpiCard label="Descontos" value={formatCurrency(data.summary.descontos)}/><KpiCard label="Taxas/Comissões" value={formatCurrency(data.summary.taxas)}/></div>
        <div className="grid grid-cols-4 mb-4"><KpiCard label="Frete" value={formatCurrency(data.summary.frete)}/><KpiCard label="Custo" value={formatCurrency(data.summary.custo)}/><KpiCard label="Lucro" value={formatCurrency(data.summary.lucro)} tone={data.summary.lucro>=0?"green":"red"}/><KpiCard label="Margem" value={formatPercent(data.summary.margem)}/></div>
        <div className="card table-wrap"><table><thead><tr><th>Pedido</th><th>Data</th><th>Produto</th><th>SKU</th><th>Qtd</th><th>Preço</th><th>Desconto</th><th>Taxas</th><th>Frete</th><th>Custo</th><th>Lucro</th><th>Margem</th><th>Status</th></tr></thead><tbody>{data.rows.map((r,i)=><tr key={`${r.orderId}-${i}`}><td>{r.orderId}</td><td>{formatDate(r.date)}</td><td>{r.product}</td><td>{r.sku??"—"}</td><td>{r.quantity}</td><td>{formatCurrency(r.price)}</td><td>{formatCurrency(r.discount)}</td><td>{formatCurrency(r.fees)}</td><td>{formatCurrency(r.shipping)}</td><td>{formatCurrency(r.cost)}</td><td style={{color:r.profit>=0?"var(--al-green)":"var(--al-red)"}}>{formatCurrency(r.profit)}</td><td>{formatPercent(r.margin)}</td><td><span className="badge badge-gray">{r.status}</span></td></tr>)}</tbody></table></div>
        <div className="flex justify-between items-center mt-4 pagination-row"><span className="text-secondary" style={{fontSize:13}}>Página {data.pagination.page} — {data.pagination.total} pedidos</span><div className="flex gap-2"><button className="btn btn-secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className="btn btn-secondary" disabled={page*data.pagination.pageSize>=data.pagination.total} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></div>
      </>}
    </div>
  </>;
}
