import { useEffect, useRef, useState } from "react";
import { KeyRound, Plug, RefreshCw, Save, Unplug } from "lucide-react";
import { Header } from "../components/Header";
import { api, BASE } from "../api/client";
import { Loading, useToast } from "../components/Feedback";
import { providerColor, providerLabel } from "../components/MarketplaceFilter";
import { formatDateTime } from "../utils/format";
import { MarketplaceProvider } from "../types/marketplace";
import { MarketplaceLogo } from "../components/MarketplaceLogo";

const PROVIDERS: MarketplaceProvider[] = ["shopee", "mercadolivre", "tiktokshop"];

interface ProviderStatus {
  connected:boolean;
  configured:boolean;
  shopId?:string;
  shopName?:string;
  lastSyncAt?:string|null;
  syncedOrders?:number;
  syncedProducts?:number;
  syncFrom?:string|null;
  syncTo?:string|null;
}

interface AppCredentialStatus {
  configured:boolean;
  source:"database"|"env"|null;
  identifier:string;
  secretSaved:boolean;
  labels:{identifier:string;secret:string};
}

function microConfetti() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const palette = ["#18c8ff", "#7c5cff", "#16c784", "#ffb020", "#ff4d67"];
  for (let i = 0; i < 22; i += 1) {
    const piece = document.createElement("i");
    piece.className = "confetti-piece";
    piece.style.background = palette[i % palette.length];
    piece.style.setProperty("--x", `${(Math.random() - .5) * 240}px`);
    piece.style.setProperty("--y", `${80 + Math.random() * 170}px`);
    piece.style.setProperty("--r", `${(Math.random() - .5) * 720}deg`);
    piece.style.animationDelay = `${Math.random() * 90}ms`;
    document.body.appendChild(piece);
    window.setTimeout(() => piece.remove(), 1100);
  }
}

function MarketplaceCard({ provider, onSyncAll }: { provider:MarketplaceProvider; onSyncAll:()=>void }) {
  const { notify }=useToast();
  const [status,setStatus]=useState<ProviderStatus|null>(null);
  const [credential,setCredential]=useState<AppCredentialStatus|null>(null);
  const [identifier,setIdentifier]=useState("");
  const [secret,setSecret]=useState("");
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState<string|null>(null);
  const [saving,setSaving]=useState(false);
  const [syncing,setSyncing]=useState(false);
  const [progressSteps,setProgressSteps]=useState<string[]>([]);
  const eventSourceRef=useRef<EventSource|null>(null);

  async function load(){
    setLoading(true);
    setError(null);
    try{
      const [st, cr] = await Promise.all([
        api.get<ProviderStatus>(`/integrations/${provider}/status`),
        api.get<AppCredentialStatus>(`/integrations/${provider}/app-credentials`),
      ]);
      setStatus(st);
      setCredential(cr);
      setIdentifier(cr.identifier||"");
    }catch(err:any){
      setStatus(null);
      setCredential(null);
      setError(err?.message ?? "Não foi possível carregar a integração.");
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{
    load();
    return()=>eventSourceRef.current?.close();
  },[provider]);

  async function saveCredentials(){
    if(!credential)return;
    if(!identifier.trim()){notify(`Preencha ${credential.labels.identifier}.`,"error");return;}
    if(!secret.trim()&&!credential.secretSaved){notify(`Preencha ${credential.labels.secret}.`,"error");return;}
    setSaving(true);
    try{
      const result=await api.put<{ok:boolean;reconnectRequired:boolean}>(
        `/integrations/${provider}/app-credentials`,
        {identifier:identifier.trim(),secret:secret.trim()||undefined}
      );
      setSecret("");
      notify(
        result.reconnectRequired
          ? `Credenciais de ${providerLabel(provider)} salvas. Conecte a loja novamente.`
          : `Credenciais de ${providerLabel(provider)} salvas.`,
        "success"
      );
      await load();
      onSyncAll();
    }catch(err:any){
      notify(err?.message ?? "Erro ao salvar credenciais.","error");
    }finally{
      setSaving(false);
    }
  }

  async function connect(){
    try{
      const result=await api.get<{url:string}>(`/integrations/${provider}/connect-url`);
      if(!result.url) throw new Error("URL de autorização não foi gerada.");
      window.location.assign(result.url);
    }catch(err:any){
      notify(err?.message ?? "Não foi possível iniciar a conexão.","error");
    }
  }

  async function disconnect(){
    if(!confirm(`Desconectar ${providerLabel(provider)}? A sincronização deixará de funcionar até reconectar.`))return;
    try{
      await api.post(`/integrations/${provider}/disconnect`);
      notify(`${providerLabel(provider)} desconectado.`,"success");
      await load();
      onSyncAll();
    }catch(err:any){
      notify(err?.message ?? "Erro ao desconectar.","error");
    }
  }

  function runSync(){
    if (syncing) return;
    setSyncing(true);
    setProgressSteps([]);
    eventSourceRef.current?.close();
    const es=new EventSource(`${BASE}/sync/run?provider=${provider}`, { withCredentials:true });
    eventSourceRef.current=es;

    es.addEventListener("progress",e=>{
      try {
        const d=JSON.parse((e as MessageEvent).data);
        setProgressSteps(p=>[...p,d.step]);
      } catch {}
    });

    es.addEventListener("done",()=>{
      setProgressSteps(p=>[...p,"Sincronização concluída."]);
      notify(`${providerLabel(provider)} sincronizado com sucesso.`,"success");
      setSyncing(false);
      es.close();
      eventSourceRef.current=null;
      load();
      onSyncAll();
    });

    es.addEventListener("error",(e:any)=>{
      let message="Erro durante a sincronização.";
      try{if(e?.data)message=JSON.parse(e.data).message||message;}catch{}
      notify(message,"error");
      setSyncing(false);
      es.close();
      eventSourceRef.current=null;
    });
  }

  return <div className={`card integration-provider-card${status?.connected ? " integration-success-pop" : ""}`} style={{borderTop:`2px solid ${providerColor(provider)}`}} data-testid={`integration-card-${provider}`}>
    <div className="flex items-center gap-2 mb-4">
      <MarketplaceLogo provider={provider} size={34} />
      <strong style={{fontFamily:"var(--font-display)",fontSize:15}}>{providerLabel(provider)}</strong>
    </div>
    {loading&&<Loading label="Verificando status..."/>}
    {!loading&&error&&<div>
      <span className="badge badge-gray">Não foi possível carregar</span>
      <p className="text-secondary" style={{fontSize:13,marginTop:10}}>{error}</p>
      <button className="btn btn-secondary mt-4" onClick={load}>Tentar novamente</button>
    </div>}
    {!loading&&!error&&credential&&<div style={{paddingBottom:14,marginBottom:14,borderBottom:"1px solid var(--border-color)"}}>
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={15}/><strong style={{fontSize:13}}>Credenciais da API</strong>
        {credential.configured&&<span className="badge badge-green">Configurada</span>}
      </div>
      <label className="form-label">{credential.labels.identifier}</label>
      <input className="input mb-4" value={identifier} onChange={e=>setIdentifier(e.target.value)} placeholder={`Digite ${credential.labels.identifier}`} autoComplete="off"/>
      <label className="form-label">{credential.labels.secret}</label>
      <input className="input" type="password" value={secret} onChange={e=>setSecret(e.target.value)} placeholder={credential.secretSaved?"Salvo — deixe vazio para manter":`Digite ${credential.labels.secret}`} autoComplete="new-password"/>
      <button className="btn btn-secondary mt-4" onClick={saveCredentials} disabled={saving}>
        <Save/>{saving?"Salvando...":"Salvar credenciais"}
      </button>
    </div>}
    {!loading&&!error&&status&&!status.configured&&<div>
      <span className="badge badge-gray">Não configurado</span>
      <p className="text-secondary" style={{fontSize:13,marginTop:10}}>Preencha as credenciais acima para habilitar a conexão.</p>
    </div>}
    {!loading&&!error&&status&&status.configured&&!status.connected&&<div>
      <span className="badge badge-gray">Não conectado</span>
      <div className="mt-4"><button className="btn btn-primary" onClick={connect}><Plug/>Conectar</button></div>
    </div>}
    {!loading&&!error&&status&&status.connected&&<div>
      <span className="badge badge-green mb-4">Conectado</span>
      <div style={{fontSize:13}} className="mb-4">
        <div className="flex justify-between" style={{padding:"4px 0"}}><span className="text-secondary">Loja</span><strong>{status.shopName??status.shopId}</strong></div>
        <div className="flex justify-between" style={{padding:"4px 0"}}><span className="text-secondary">Última sync.</span><strong>{status.lastSyncAt?formatDateTime(status.lastSyncAt):"Nunca"}</strong></div>
        <div className="flex justify-between" style={{padding:"4px 0"}}><span className="text-secondary">Pedidos</span><strong className="text-mono">{status.syncedOrders??0}</strong></div>
        <div className="flex justify-between" style={{padding:"4px 0"}}><span className="text-secondary">Produtos</span><strong className="text-mono">{status.syncedProducts??0}</strong></div>
      </div>
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={runSync} disabled={syncing}><RefreshCw className={syncing?"spin":""}/>{syncing?"Sincronizando...":"Sincronizar"}</button>
        <button className="btn btn-danger" onClick={disconnect} disabled={syncing} aria-label={`Desconectar ${providerLabel(provider)}`}><Unplug/></button>
      </div>
      {progressSteps.length>0&&<div className="mt-4" style={{borderTop:"1px solid var(--border-color)",paddingTop:10}}>
        {progressSteps.map((step,i)=><div key={`${step}-${i}`} className="text-mono text-secondary" style={{fontSize:11.5,padding:"2px 0"}}>{i===progressSteps.length-1&&syncing?"…":"✓"} {step}</div>)}
      </div>}
    </div>}
  </div>;
}

export default function Integracoes(){
  const {notify}=useToast();
  const[refreshKey,setRefreshKey]=useState(0);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const provider=params.get("provider");
    if(params.get("success")){
      notify(`${provider?providerLabel(provider as MarketplaceProvider):"Marketplace"} conectado com sucesso.`,"success");
      microConfetti();
      window.history.replaceState({},"","/integracoes");
    }
    if(params.get("error")){
      notify(`Falha ao conectar: ${params.get("error")}`,"error");
      window.history.replaceState({},"","/integracoes");
    }
  },[]);

  return <>
    <Header title="Integrações"/>
    <div className="content" data-testid="integrations-page">
      <p className="text-secondary mb-4" style={{fontSize:13}}>Configure a API e conecte cada marketplace direto por esta tela. Os segredos ficam criptografados no banco e não são exibidos novamente.</p>
      <div className="grid grid-cols-3" key={refreshKey}>
        {PROVIDERS.map(p=><MarketplaceCard key={p} provider={p} onSyncAll={()=>setRefreshKey(k=>k+1)}/>)}
      </div>
    </div>
  </>;
}
