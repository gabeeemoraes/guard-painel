import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, ArrowDownRight, CalendarDays, ChevronDown, Package, ShoppingCart, Tag, DollarSign, Plus, MoreHorizontal, AlertTriangle, RefreshCw, Clock3 } from "lucide-react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState } from "../components/Feedback";
import { MarketplaceProvider } from "../types/marketplace";
import { formatCurrency, formatDate, formatDateTime, formatPercent } from "../utils/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { MarketplaceLogo, marketplaceMeta } from "../components/MarketplaceLogo";

interface DashboardData { hasData:boolean; grossRevenue:number; netRevenue:number; ordersCount:number; productsCount:number; averageTicket:number; totalCosts:number; totalFees:number; totalDiscounts:number; totalShipping:number; profit:number; margin:number; cancellations:number; returns:number; adInvestment:number; adReturn:number; salesEvolution:{date:string;value:number}[]; profitEvolution:{date:string;value:number}[]; topProducts:{name:string;revenue:number}[]; worstProducts:{name:string;revenue:number}[]; alerts:string[]; comparison?:{previousRevenue:number;previousOrders:number;revenueChangePercent:number|null;ordersChangePercent:number|null}; }
interface MarketplaceRow { provider:MarketplaceProvider; hasData:boolean; grossRevenue:number; netRevenue:number; ordersCount:number; productsCount:number; profit:number; margin:number; }
interface IntegrationRow { provider:MarketplaceProvider; label:string; configured:boolean; connected:boolean; shopName?:string|null; lastSyncAt?:string|null; lastSyncStatus?:string|null; }
interface RecentOrder { id:string; provider:MarketplaceProvider; status:string; value:number; date:string; }

function SalesChart({data}:{data:{date:string;value:number}[]}){
  return <ResponsiveContainer width="100%" height={255}><AreaChart data={data} margin={{top:8,right:8,left:-14,bottom:0}}><defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={.25}/><stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={v=>formatDate(v).slice(0,5)} tick={{fontSize:10,fill:"var(--text-tertiary)"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"var(--text-tertiary)"}} axisLine={false} tickLine={false} width={48} tickFormatter={v=>`R$ ${(Number(v)/1000).toFixed(0)}k`}/><Tooltip formatter={(v:number)=>[formatCurrency(v),"Vendas"]} labelFormatter={v=>formatDate(v)} contentStyle={{background:"var(--bg-surface)",color:"var(--text-primary)",border:"1px solid var(--border-color)",borderRadius:10,fontSize:12,boxShadow:"var(--shadow-card)"}}/><Area type="monotone" dataKey="value" stroke="var(--accent-cyan)" strokeWidth={2.5} fill="url(#sales-fill)" dot={false} activeDot={{r:4}}/></AreaChart></ResponsiveContainer>
}

function ChangeLabel({value}:{value:number|null}){
  if(value===null)return <span>Sem base para comparar</span>;
  const positive=value>=0;
  return <span className={`sales-change ${positive?"positive":"negative"}`}>{positive?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {positive?"+":""}{value.toFixed(1).replace(".",",")}% vs. período anterior</span>;
}

function orderStatusTone(status:string):string{
 const value=status.toUpperCase();
 if(/CANCEL|REFUND|RETURN/.test(value))return "status-danger";
 if(/PAID|COMPLETED|DELIVERED|SHIPPED/.test(value))return "status-success";
 return "status-neutral";
}

export default function Dashboard(){
 const navigate=useNavigate();
 const [range,setRange]=useState("last7");
 const [provider,setProvider]=useState<MarketplaceProvider|"all">("all");
 const [refreshKey,setRefreshKey]=useState(0);
 const [data,setData]=useState<DashboardData|null>(null);
 const [marketplaces,setMarketplaces]=useState<MarketplaceRow[]>([]);
 const [integrations,setIntegrations]=useState<IntegrationRow[]>([]);
 const [recentOrders,setRecentOrders]=useState<RecentOrder[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState<string|null>(null);

 useEffect(()=>{
   let cancelled=false;
   async function load(){
     setLoading(true);setError(null);
     try{
       const q=`?preset=${range}${provider!=="all"?`&provider=${provider}`:""}`;
       const [d,m,i,o]=await Promise.all([
         api.get<DashboardData>(`/dashboard${q}`),
         api.get<{marketplaces:MarketplaceRow[]}>(`/dashboard/by-marketplace?preset=${range}`),
         api.get<{marketplaces:IntegrationRow[]}>(`/integrations`),
         api.get<{orders:RecentOrder[]}>(`/dashboard/recent-orders${q}`)
       ]);
       if(cancelled)return;
       setData(d);setMarketplaces(m.marketplaces);setIntegrations(i.marketplaces);setRecentOrders(o.orders);
     }catch(e:any){if(!cancelled)setError(e?.message||"Não foi possível carregar o dashboard.");}
     finally{if(!cancelled)setLoading(false);}
   }
   load();
   return()=>{cancelled=true;};
 },[range,provider,refreshKey]);

 const total=useMemo(()=>marketplaces.reduce((s,m)=>s+Number(m.grossRevenue||0),0),[marketplaces]);
 const donutGradient=useMemo(()=>{
   if(total<=0)return "conic-gradient(var(--border-color) 0 100%)";
   let cursor=0;
   const segments=marketplaces.filter(m=>Number(m.grossRevenue)>0).map(m=>{
     const start=cursor;
     cursor+=(Number(m.grossRevenue)/total)*100;
     return `var(--mkt-${m.provider}) ${start}% ${cursor}%`;
   });
   return `conic-gradient(${segments.join(",")})`;
 },[marketplaces,total]);

 if(loading)return <><Header title="Dashboard"/><div className="content dashboard-content"><Loading label="Carregando seu painel..."/></div></>;
 if(error)return <><Header title="Dashboard"/><div className="content dashboard-content"><EmptyState icon={<AlertTriangle size={40}/>} title="Erro ao carregar dashboard" description={error}/></div></>;
 if(!data)return null;

 const netAdjustments=Number(data.grossRevenue||0)-Number(data.netRevenue||0);
 const synced=integrations.filter(i=>i.connected&&i.lastSyncAt&&Number.isFinite(new Date(i.lastSyncAt).getTime())).sort((a,b)=>new Date(b.lastSyncAt!).getTime()-new Date(a.lastSyncAt!).getTime());
 const connectedCount=integrations.filter(i=>i.connected).length;
 const lastSyncAt=synced[0]?.lastSyncAt;
 const syncFailures=integrations.filter(i=>i.connected&&i.lastSyncStatus==="error");
 const scopeLabel=provider==="all"?"todas as lojas":marketplaceMeta(provider).label;

 return <><Header title="Dashboard"/><main className="content dashboard-content dashboard-v2" data-testid="dashboard-page">
  <section className="dashboard-toolbar"><div><h2>Vendas da loja</h2><p>Faturamento, pedidos e produtos — o essencial para acompanhar o negócio.</p></div><div className="dashboard-filters"><label className="dashboard-date-select"><CalendarDays size={16}/><select value={range} onChange={e=>setRange(e.target.value)} aria-label="Período do dashboard"><option value="today">Hoje</option><option value="yesterday">Ontem</option><option value="last7">Últimos 7 dias</option><option value="last30">Últimos 30 dias</option><option value="currentMonth">Mês atual</option><option value="lastMonth">Mês anterior</option></select><ChevronDown size={15}/></label><label className="dashboard-date-select dashboard-provider-select"><ShoppingCart size={16}/><select value={provider} onChange={e=>setProvider(e.target.value as MarketplaceProvider|"all")} aria-label="Filtrar loja"><option value="all">Todas as lojas</option><option value="shopee">Shopee</option><option value="mercadolivre">Mercado Livre</option><option value="tiktokshop">TikTok Shop</option></select><ChevronDown size={15}/></label></div></section>

  <section className="integration-strip">{(["shopee","mercadolivre","tiktokshop"] as MarketplaceProvider[]).map(provider=>{const item=integrations.find(i=>i.provider===provider);const meta=marketplaceMeta(provider);return <button type="button" className={`integration-card ${item?.connected?"connected":""}`} key={provider} onClick={()=>navigate(`/integracoes?provider=${provider}`)} data-testid={`dashboard-integration-${provider}`}><MarketplaceLogo provider={provider} size={34}/><div><strong>{meta.label}</strong><span className={item?.connected?"status-connected":"status-offline"}><i/>{item?.connected?`Loja conectada${item.shopName?` · ${item.shopName}`:""}`:"Não conectada"}</span>{item?.connected&&<small className={item.lastSyncStatus==="error"?"sync-failed":""}>{item.lastSyncStatus==="error"?"Falha na última sincronização":item.lastSyncAt?`Sincronizado em ${formatDate(item.lastSyncAt)}`:"Ainda não sincronizada"}</small>}</div><ChevronDown size={18} className="integration-arrow"/></button>})}<button type="button" className="integration-card add-store" onClick={()=>navigate("/integracoes")}><span className="add-store-icon"><Plus size={21}/></span><div><strong>Conectar nova loja</strong><span>Expanda suas vendas</span></div></button></section>

  <section className={`dashboard-sync-banner ${!connectedCount||!lastSyncAt||syncFailures.length?"needs-sync":""}`} aria-label="Situação dos dados"><div className="sync-copy"><Clock3 size={17}/><span>{!connectedCount?"Nenhuma loja conectada no momento. Dados históricos podem estar desatualizados.":!lastSyncAt?"Loja conectada, mas ainda sem sincronização concluída.":`Sincronização mais recente: ${formatDateTime(lastSyncAt)} · atualização manual.`}{syncFailures.length>0?` Atenção: falha de sincronização em ${syncFailures.map(i=>marketplaceMeta(i.provider).label).join(", ")}.`:""}</span></div><div className="sync-actions"><button type="button" onClick={()=>setRefreshKey(k=>k+1)}><RefreshCw size={14}/>Recarregar painel</button><button type="button" onClick={()=>navigate("/integracoes")}>Sincronizar loja</button></div></section>

  <section className="kpi-grid sales-kpi-grid" aria-label="Resumo de vendas">
   <div className="dashboard-kpi featured-kpi"><div className="kpi-top"><span>Faturamento · {scopeLabel}</span><span className="kpi-icon"><DollarSign size={18}/></span></div><strong className="kpi-value-box" title={formatCurrency(data.grossRevenue)}><AnimatedNumber value={data.grossRevenue} format={formatCurrency}/></strong><div className="kpi-trend"><ChangeLabel value={data.comparison?.revenueChangePercent??null}/></div></div>
   <div className="dashboard-kpi"><div className="kpi-top"><span>Pedidos não cancelados</span><span className="kpi-icon"><ShoppingCart size={18}/></span></div><strong className="kpi-value-box"><AnimatedNumber value={data.ordersCount} format={n=>Math.round(n).toLocaleString("pt-BR")}/></strong><div className="kpi-trend"><ChangeLabel value={data.comparison?.ordersChangePercent??null}/></div></div>
   <div className="dashboard-kpi"><div className="kpi-top"><span>Ticket médio</span><span className="kpi-icon"><Tag size={18}/></span></div><strong className="kpi-value-box" title={formatCurrency(data.averageTicket)}><AnimatedNumber value={data.averageTicket} format={formatCurrency}/></strong><div className="kpi-trend"><span>Faturamento ÷ pedidos</span></div></div>
   <div className="dashboard-kpi"><div className="kpi-top"><span>Receita líquida</span><span className="kpi-icon"><ArrowUpRight size={18}/></span></div><strong className="kpi-value-box" title={formatCurrency(data.netRevenue)}><AnimatedNumber value={data.netRevenue} format={formatCurrency}/></strong><div className="kpi-trend"><span>Valor informado pelos marketplaces</span></div></div>
  </section>

  <section className="sales-quality" aria-label="Qualidade das vendas"><div><span>Cancelamentos</span><strong>{data.cancellations.toLocaleString("pt-BR")}</strong></div><div><span>Devoluções / reembolsos</span><strong>{data.returns.toLocaleString("pt-BR")}</strong></div><p>Faturamento exclui pedidos cancelados, devolvidos ou reembolsados. Pedidos pendentes podem estar incluídos conforme o status enviado pelo canal.</p></section>

  <section className="dashboard-card financial-overview"><div className="dashboard-card-head"><div><h3>Resultado estimado</h3><p className="financial-subtitle">Visão complementar das vendas. Depende dos custos cadastrados.</p></div><button className="small-link" type="button" onClick={()=>navigate("/faturamento")}>Ver faturamento</button></div><div className="financial-flow"><div className="financial-step"><span>Faturamento bruto</span><strong>{formatCurrency(data.grossRevenue)}</strong></div><div className="financial-connector">→</div><div className="financial-deductions"><div><span>Taxas informadas</span><strong>{formatCurrency(data.totalFees)}</strong></div><div><span>Descontos informados</span><strong>{formatCurrency(data.totalDiscounts)}</strong></div><div><span>Frete informado</span><strong>{formatCurrency(data.totalShipping)}</strong></div></div><div className="financial-connector">→</div><div className="financial-step net"><span>Receita líquida</span><strong>{formatCurrency(data.netRevenue)}</strong></div><div className="financial-connector">−</div><div className="financial-step"><span>Custos cadastrados</span><strong>{formatCurrency(data.totalCosts)}</strong></div><div className="financial-connector">=</div><div className="financial-step profit"><span>Resultado estimado</span><strong>{formatCurrency(data.profit)}</strong><small>Margem estimada {formatPercent(data.margin)}</small></div></div><div className="financial-note">Diferença entre bruto e líquido: <strong>{formatCurrency(netAdjustments)}</strong>. Taxas, descontos e frete são informativos: o líquido já vem dos canais. O resultado não representa lucro contábil e pode estar superestimado se faltarem custos.</div></section>

  <section className="dashboard-main-grid"><div className="dashboard-card sales-card"><div className="dashboard-card-head"><div><h3>Vendas no período</h3><div className="chart-legend"><span><i className="legend-dot shopee"/>{scopeLabel}</span></div></div><div className="chart-range-tabs"><button className={range==="last7"?"active":""} onClick={()=>setRange("last7")}>7 dias</button><button className={range==="last30"?"active":""} onClick={()=>setRange("last30")}>30 dias</button><button className={range==="currentMonth"?"active":""} onClick={()=>setRange("currentMonth")}>Mês</button></div></div>{data.salesEvolution.length?<SalesChart data={data.salesEvolution}/>:<div className="chart-empty">Sem vendas registradas neste período.</div>}</div>
   <div className="dashboard-card distribution-card"><div className="dashboard-card-head"><div><h3>Vendas por marketplace</h3><p className="dashboard-card-hint">Distribuição de todas as lojas</p></div><button className="icon-ghost" type="button" onClick={()=>navigate("/faturamento")} aria-label="Ver faturamento"><MoreHorizontal size={17}/></button></div><div className="donut-wrap"><div className="donut" style={{background:donutGradient}}><div><strong><AnimatedNumber value={total} format={formatCurrency}/></strong><span>Total</span></div></div><div className="donut-legend">{marketplaces.map(m=>{const pct=total?(Number(m.grossRevenue)/total)*100:0;return <div key={m.provider}><span><MarketplaceLogo provider={m.provider} size={20}/>{marketplaceMeta(m.provider).label}</span><strong>{formatCurrency(m.grossRevenue)} <small>{pct.toFixed(1)}%</small></strong></div>})}</div></div></div></section>

  <section className="dashboard-bottom-grid"><div className="dashboard-card orders-card"><div className="dashboard-card-head"><h3>Pedidos recentes</h3><button className="small-link" type="button" onClick={()=>navigate("/pedidos")}>Ver todos</button></div>{recentOrders.length?<div className="recent-orders"><div className="recent-order-head"><span>#</span><span>Marketplace</span><span>Status</span><span>Valor</span><span>Data</span></div>{recentOrders.map(o=><div className="recent-order" key={`${o.provider}-${o.id}`}><strong>#{o.id}</strong><span className="order-market"><MarketplaceLogo provider={o.provider} size={24}/>{marketplaceMeta(o.provider).label}</span><span className={`order-status ${orderStatusTone(o.status)}`}><i/>{o.status}</span><strong>{formatCurrency(o.value)}</strong><span>{new Date(o.date).toLocaleDateString("pt-BR")} <small>{new Date(o.date).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</small></span></div>)}</div>:<div className="empty-inline">Nenhum pedido no período.</div>}</div>
   <div className="dashboard-card products-card"><div className="dashboard-card-head"><h3>Produtos mais vendidos</h3><button className="small-link" type="button" onClick={()=>navigate("/produtos")}>Ver todos</button></div>{data.topProducts.length?<div className="best-products">{data.topProducts.slice(0,5).map((p,i)=><div className="best-product" key={`${p.name}-${i}`}><span className="product-thumb"><Package size={18}/></span><span className="product-name"><strong>{p.name}</strong><small>Receita no período</small></span><strong>{formatCurrency(p.revenue)}</strong><span className="product-growth"><ArrowUpRight size={13}/>{p.revenue>0?"Real":"—"}</span></div>)}</div>:<div className="empty-inline">Nenhum produto vendido no período.</div>}</div></section>

  {data.alerts.length>0&&<section className="dashboard-alerts">{data.alerts.map((a,i)=><div key={i}><AlertTriangle size={15}/>{a}</div>)}</section>}
 </main></>;
}
