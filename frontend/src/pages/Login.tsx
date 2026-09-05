import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../context/AuthContext";

export default function Login(){
 const {login}=useAuth();const navigate=useNavigate();const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [error,setError]=useState<string|null>(null);const [loading,setLoading]=useState(false);
 async function handleSubmit(e:FormEvent){e.preventDefault();setError(null);setLoading(true);try{await login(email.trim(),password);navigate("/dashboard",{replace:true})}catch(err){setError(err instanceof ApiError?err.message:"Não foi possível entrar. Tente novamente.")}finally{setLoading(false)}}
 return <div className="login-screen"><div className="login-card"><div className="sidebar-brand" style={{color:"var(--text-primary)",padding:0,marginBottom:24}}><span className="dot"/>GUARD PAINEL</div><p className="text-secondary" style={{marginTop:-12,marginBottom:24,fontSize:14}}>Acesso privado à sua plataforma de análise da loja.</p><form onSubmit={handleSubmit}><div className="field"><label htmlFor="login-email">E-mail</label><input id="login-email" type="email" inputMode="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></div><div className="field"><label htmlFor="login-password">Senha</label><input id="login-password" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>{error&&<div role="alert" style={{color:"var(--al-red)",fontSize:13,marginBottom:12}}>{error}</div>}<button className="btn btn-primary" type="submit" disabled={loading} style={{width:"100%",justifyContent:"center"}}>{loading?"Entrando...":"Entrar"}</button></form></div></div>;
}
