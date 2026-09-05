import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, Modal, useToast } from "../components/Feedback";
import { RangeFilter, RangeFilterValue, rangeToQuery } from "../components/RangeFilter";
import { ProviderFilter, providerLabel } from "../components/MarketplaceFilter";
import { formatCurrency, formatDate } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";

interface OrderRow { id:string; provider:MarketplaceProvider; date:string; status:string; products:{name:string;sku:string|null;quantity:number}[]; value:number; discount:number; fees:number; shipping:number; netValue:number; }
interface OrderData { hasData:boolean; orders:OrderRow[]; pagination:{page:number;pageSize:number;total:number}; }

export default function Pedidos(){
  const {notify}=useToast();
  const [range,setRange]=useState<RangeFilterValue>({preset:"last30"});
  const [provider,setProvider]=useState<MarketplaceProvider|"all">("all");
  const [search,setSearch]=useState("");
  const [page,setPage]=useState(1);
  const [data,setData]=useState<OrderData|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [selected,setSelected]=useState<string|null>(null);
  const [details,setDetails]=useState<any>(null);
  const [detailsLoading,setDetailsLoading]=useState(false);

  useEffect(()=>{setPage(1)},[range,provider,search]);
  useEffect(()=>{
    let cancelled=false;
    setLoading(true);setError(null);
    const params=new URLSearchParams(rangeToQuery(range));
    if(search.trim())params.set("search",search.trim());
    if(provider!=="all")params.set("provider",provider);
    params.set("page",String(page));
    api.get<OrderData>(`/pedidos?${params.toString()}`).then(res=>{if(!cancelled)setData(res)}).catch(err=>{if(!cancelled)setError(err?.message??"Não foi possível carregar os pedidos.")}).finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[range,search,page,provider]);

  useEffect(()=>{
    let cancelled=false;
    if(!selected){setDetails(null);return()=>{cancelled=true}};
    setDetails(null);setDetailsLoading(true);
    api.get<any>(`/pedidos/${encodeURIComponent(selected)}`).then(res=>{if(!cancelled)setDetails(res.order)}).catch(err=>{if(!cancelled)notify(err?.message??"Não foi possível carregar os detalhes.","error")}).finally(()=>{if(!cancelled)setDetailsLoading(false)});
    return()=>{cancelled=true};
  },[selected,notify]);

  return <>
    <Header title="Pedidos"/>
    <div className="content">
      <div className="filters-row" style={{justifyContent:"space-between"}}><div className="flex gap-2" style={{flexWrap:"wrap"}}><RangeFilter value={range} onChange={setRange}/><input placeholder="Buscar pedido ou comprador" value={search} onChange={e=>setSearch(e.target.value)} /></div><ProviderFilter value={provider} onChange={setProvider}/></div>
      {loading&&<Loading label="Carregando pedidos..."/>}
      {!loading&&error&&<EmptyState title="Erro ao carregar pedidos" description={error}/>} 
      {!loading&&!error&&data&&!data.hasData&&<EmptyState title="Nenhum pedido no período"/>}
      {!loading&&!error&&data&&data.hasData&&<>
        <div className="card table-wrap"><table><thead><tr><th>ID</th><th>Marketplace</th><th>Data</th><th>Status</th><th>Produtos</th><th>Valor</th><th>Desconto</th><th>Taxas</th><th>Frete</th><th>Líquido</th><th></th></tr></thead><tbody>{data.orders.map(o=><tr key={`${o.provider}-${o.id}`}><td>{o.id}</td><td><span className={`badge-provider ${o.provider}`}><span className="dot"/>{providerLabel(o.provider)}</span></td><td>{formatDate(o.date)}</td><td><span className="badge badge-gray">{o.status}</span></td><td>{o.products.map(p=>p.name).join(", ")}</td><td>{formatCurrency(o.value)}</td><td>{formatCurrency(o.discount)}</td><td>{formatCurrency(o.fees)}</td><td>{formatCurrency(o.shipping)}</td><td>{formatCurrency(o.netValue)}</td><td><button className="btn btn-secondary" onClick={()=>setSelected(o.id)}>Detalhes</button></td></tr>)}</tbody></table></div>
        <div className="flex justify-between items-center mt-4 pagination-row"><span className="text-secondary" style={{fontSize:13}}>Página {data.pagination.page} — {data.pagination.total} pedidos</span><div className="flex gap-2"><button className="btn btn-secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Anterior</button><button className="btn btn-secondary" disabled={page*data.pagination.pageSize>=data.pagination.total} onClick={()=>setPage(p=>p+1)}>Próxima</button></div></div>
      </>}
    </div>
    <Modal open={!!selected} onClose={()=>setSelected(null)}>{detailsLoading?<p className="text-secondary">Carregando pedido...</p>:details?<div><h3 style={{marginTop:0}}>Pedido {details.externalId}</h3><p className="text-secondary" style={{fontSize:13}}>Status: {details.status} · Data: {formatDate(details.orderDate)}</p><div className="table-wrap"><table><thead><tr><th>Produto</th><th>Qtd</th><th>Preço</th><th>Lucro</th></tr></thead><tbody>{details.items?.map((it:any)=><tr key={it.id}><td>{it.name}</td><td>{it.quantity}</td><td>{formatCurrency(it.unitPrice)}</td><td>{formatCurrency(it.profit)}</td></tr>)}</tbody></table></div></div>:<p className="text-secondary">Não foi possível carregar o pedido.</p>}</Modal>
  </>;
}
