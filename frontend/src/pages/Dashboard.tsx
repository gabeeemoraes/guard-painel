import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ArrowUpRight, CalendarDays, ChevronDown, Package, ShoppingCart, Tag, DollarSign, Plus, MoreHorizontal, AlertTriangle } from "lucide-react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState } from "../components/Feedback";
import { MarketplaceProvider } from "../types/marketplace";
import { formatCurrency, formatDate } from "../utils/format";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { MarketplaceLogo, marketplaceMeta } from "../components/MarketplaceLogo";

interface DashboardData { hasData:boolean; grossRevenue:number; netRevenue:number; ordersCount:number; productsCount:number; averageTicket:number; totalCosts:number; totalFees:number; totalDiscounts:number; totalShipping:number; profit:number; margin:number; cancellations:number; returns:number; adInvestment:number; adReturn:number; salesEvolution:{date:string;value:number}[]; profitEvolution:{date:string;value:number}[]; topProducts:{name:string;revenue:number}[]; worstProducts:{name:string;revenue:number}[]; alerts:string[]; }
interface MarketplaceRow { provider:MarketplaceProvider; hasData:boolean; grossRevenue:number; netRevenue:number; ordersCount:number; productsCount:number; profit:number; margin:number; }
interface IntegrationRow { provider:MarketplaceProvider; label:string; configured:boolean; connected:boolean; shopName?:string|null; lastSyncAt?:string|null; }
interface RecentOrder { id:string; provider:MarketplaceProvider; status:string; value:number; date:string; }

function SalesChart({data}:{data:{date:string;value:number}[]}){
  return <ResponsiveContainer width="100%" height={255}><AreaChart data={data} margin={{top:8,right:8,left:-14,bottom:0}}><defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity={.25}/><stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="var(--grid-line)" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="date" tickFormatter={v=>formatDate(v).slice(0,5)} tick={{fontSize:10,fill:"var(--text-tertiary)"}} axisLine={false} tickLine={false}/><YAxis tick={{fontSize:10,fill:"var(--text-tertiary)"}} axisLine={false} tickLine={false} width={48} tickFormatter={v=>`R$ ${(Number(v)/1000).toFixed(0)}k`}/><Tooltip formatter={(v:number)=>[formatCurrency(v),"Vendas"]} labelFormatter={v=>formatDate(v)} contentStyle={{background:"var(--bg-surface)",color:"var(--text-primary)",border:"1px solid var(--border-color)",borderRadius:10,fontSize:12,boxShadow:"var(--shadow-card)"}}/><Area type="monotone" dataKey="value" stroke="var(--accent-cyan)" strokeWidth={2.5} fill="url(#sales-fill)" dot={false} activeDot={{r:4}}/></AreaChart></ResponsiveContainer>
}

export default function Dashboard(){
 const navigate=useNavigate();
 const [range,setRange]=useState("last7");
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
       const q=`?preset=${range}`;
       const [d,m,i,o]=await Promise.all([
         api.get<DashboardData>(`/dashboard${q}`),
         api.get<{marketplaces:MarketplaceRow[]}>(`/dashboard/by-marketplace${q}`),
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
 },[range]);

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

 const kpis=[
   {label:"Vendas Totais",value:data.grossRevenue,format:formatCurrency,icon:DollarSign},
   {label:"Pedidos",value:data.ordersCount,format:(v:number)=>Math.round(v).toLocaleString("pt-BR"),icon:ShoppingCart},
   {label:"Ticket Médio",value:data.averageTicket,format:formatCurrency,icon:Tag},
   {label:"Produtos Ativos",value:data.productsCount,format:(v:number)=>Math.round(v).toLocaleString("pt-BR"),icon:Package}
 ];

 return <><Header title="Dashboard"/><main className="content dashboard-content dashboard-v2" data-testid="dashboard-page">
  <section className="dashboard-toolbar"><div><h2>Dashboard</h2><p>Acompanhe o desempenho das suas lojas integradas em um só lugar.</p></div><label className="dashboard-date-select"><CalendarDays size={16}/><select value={range} onChange={e=>setRange(e.target.value)} aria-label="Período do dashboard"><option value="today">Hoje</option><option value="last7">Últimos 7 dias</option><option value="last30">Últimos 30 dias</option><option value="currentMonth">Mês atual</option></select><ChevronDown size={15}/></label></section>

  <section className="integration-strip">{(["shopee","mercadolivre","tiktokshop"] as MarketplaceProvider[]).map(provider=>{const item=integrations.find(i=>i.provider===provider);const meta=marketplaceMeta(provider);return <button type="button" className={`integration-card ${item?.connected?"connected":""}`} key={provider} onClick={()=>navigate(`/integracoes?provider=${provider}`)} data-testid={`dashboard-integration-${provider}`}><MarketplaceLogo provider={provider} size={34}/><div><strong>{meta.label}</strong><span className={item?.connected?"status-connected":"status-offline"}><i/>{item?.connected?`Loja conectada${item.shopName?` · ${item.shopName}`:""}`:"Não conectada"}</span></div><ChevronDown size={18} className="integration-arrow"/></button>})}<button type="button" className="integration-card add-store" onClick={()=>navigate("/integracoes")}><span className="add-store-icon"><Plus size={21}/></span><div><strong>Conectar nova loja</strong><span>Expanda suas vendas</span></div></button></section>

  <section className="kpi-grid">{kpis.map(({label,value,format,icon:Icon})=><div className="dashboard-kpi" key={label}><div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={18}/></span></div><strong className="kpi-value-box" title={format(value)}><AnimatedNumber value={Number(value||0)} format={format}/></strong><div className="kpi-trend"><span>Dados reais sincronizados</span></div></div>)}</section>

  <section className="dashboard-main-grid"><div className="dashboard-card sales-card"><div className="dashboard-card-head"><div><h3>Vendas no período</h3><div className="chart-legend"><span><i className="legend-dot shopee"/>Consolidado</span></div></div><div className="chart-range-tabs"><button className={range==="last7"?"active":""} onClick={()=>setRange("last7")}>7 dias</button><button className={range==="last30"?"active":""} onClick={()=>setRange("last30")}>30 dias</button><button className={range==="currentMonth"?"active":""} onClick={()=>setRange("currentMonth")}>Mês</button></div></div><SalesChart data={data.salesEvolution}/></div>
   <div className="dashboard-card distribution-card"><div className="dashboard-card-head"><h3>Vendas por marketplace</h3><button className="icon-ghost" type="button" onClick={()=>navigate("/faturamento")} aria-label="Ver faturamento"><MoreHorizontal size={17}/></button></div><div className="donut-wrap"><div className="donut" style={{background:donutGradient}}><div><strong><AnimatedNumber value={total} format={formatCurrency}/></strong><span>Total</span></div></div><div className="donut-legend">{marketplaces.map(m=>{const pct=total?(Number(m.grossRevenue)/total)*100:0;return <div key={m.provider}><span><MarketplaceLogo provider={m.provider} size={20}/>{marketplaceMeta(m.provider).label}</span><strong>{formatCurrency(m.grossRevenue)} <small>{pct.toFixed(1)}%</small></strong></div>})}</div></div></div></section>

  <section className="dashboard-bottom-grid"><div className="dashboard-card orders-card"><div className="dashboard-card-head"><h3>Pedidos recentes</h3><button className="small-link" type="button" onClick={()=>navigate("/pedidos")}>Ver todos</button></div>{recentOrders.length?<div className="recent-orders"><div className="recent-order-head"><span>#</span><span>Marketplace</span><span>Status</span><span>Valor</span><span>Data</span></div>{recentOrders.map(o=><div className="recent-order" key={`${o.provider}-${o.id}`}><strong>#{o.id}</strong><span className="order-market"><MarketplaceLogo provider={o.provider} size={24}/>{marketplaceMeta(o.provider).label}</span><span className="order-status"><i/>{o.status}</span><strong>{formatCurrency(o.value)}</strong><span>{new Date(o.date).toLocaleDateString("pt-BR")} <small>{new Date(o.date).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</small></span></div>)}</div>:<div className="empty-inline">Nenhum pedido no período.</div>}</div>
   <div className="dashboard-card products-card"><div className="dashboard-card-head"><h3>Produtos mais vendidos</h3><button className="small-link" type="button" onClick={()=>navigate("/produtos")}>Ver todos</button></div><div className="best-products">{data.topProducts.slice(0,5).map((p,i)=><div className="best-product" key={`${p.name}-${i}`}><span className="product-thumb"><Package size={18}/></span><span className="product-name"><strong>{p.name}</strong><small>Receita no período</small></span><strong>{formatCurrency(p.revenue)}</strong><span className="product-growth"><ArrowUpRight size={13}/>{p.revenue>0?"Real":"—"}</span></div>)}</div></div></section>

  {data.alerts.length>0&&<section className="dashboard-alerts">{data.alerts.map((a,i)=><div key={i}><AlertTriangle size={15}/>{a}</div>)}</section>}
 </main></>;
}
