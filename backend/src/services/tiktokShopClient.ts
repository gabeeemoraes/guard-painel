import { marketplaceFetch } from "../lib/marketplaceHttp";
import crypto from "crypto";
import { env } from "../env";

export interface TiktokAppCredentials { appKey: string; appSecret: string; environment?: "live" | "test"; serviceId?: string }
export interface TiktokTokenData { access_token:string; refresh_token:string; access_token_expire_in:number; refresh_token_expire_in:number; open_id?:string; seller_name?:string }
export interface TiktokTokenResponse { code?:number; message?:string; request_id?:string; data?:TiktokTokenData }
export interface NormalizedTiktokToken extends TiktokTokenData { message?:string }

function sign(creds:TiktokAppCredentials,path:string,params:Record<string,string>,rawBody:string):string {
  const keys=Object.keys(params).filter((key)=>key!=="sign"&&key!=="access_token").sort();
  let base=path;
  for(const key of keys) base+=key+params[key];
  base+=rawBody;
  return crypto.createHmac("sha256",creds.appSecret).update(creds.appSecret+base+creds.appSecret).digest("hex");
}
function nowTs(){ return Math.floor(Date.now()/1000); }

async function readJson<T>(res:Response):Promise<T>{
  const text=await res.text();
  let data:any={};
  try{ data=text?JSON.parse(text):{}; }catch{ throw new Error(`TikTok Shop retornou resposta inválida (HTTP ${res.status}).`); }
  if(!res.ok) throw new Error(`TikTok Shop HTTP ${res.status}: ${data?.message||"erro na API"}${data?.code!==undefined?` (code ${data.code})`:""}`);
  if (data?.code !== undefined && Number(data.code) !== 0) throw new Error(`TikTok Shop: ${data.message || "erro na API"} (code ${data.code})`);
  return data as T;
}

function normalizeTokenResponse(response:TiktokTokenResponse):NormalizedTiktokToken{
  if(response.code!==undefined&&response.code!==0) throw new Error(response.message||`TikTok Shop retornou code ${response.code}.`);
  const data=response.data;
  if(!data?.access_token||!data?.refresh_token||(!Number.isFinite(Number(data.access_token_expire_in)) || Number(data.access_token_expire_in) * 1000 <= Date.now())) throw new Error(response.message||"TikTok Shop não retornou um token válido.");
  return {...data,message:response.message};
}

export function buildAuthUrl(creds:TiktokAppCredentials,state:string):string{
  if (!creds.serviceId && !env.tiktokServiceId) throw new Error("Preencha o Service ID do TikTok Shop em Integrações.");
  const url=new URL("https://services.tiktokshop.com/open/authorize");
  url.searchParams.set("service_id",creds.serviceId || env.tiktokServiceId);
  url.searchParams.set("state",state);
  return url.toString();
}

export async function exchangeCodeForToken(creds:TiktokAppCredentials,code:string):Promise<NormalizedTiktokToken>{
  const url=new URL(`${env.tiktokAuthHost()}/api/v2/token/get`);
  url.searchParams.set("app_key",creds.appKey); url.searchParams.set("app_secret",creds.appSecret); url.searchParams.set("auth_code",code); url.searchParams.set("grant_type","authorized_code");
  return normalizeTokenResponse(await readJson<TiktokTokenResponse>(await marketplaceFetch(url.toString())));
}

export async function refreshAccessToken(creds:TiktokAppCredentials,refreshToken:string):Promise<NormalizedTiktokToken>{
  const url=new URL(`${env.tiktokAuthHost()}/api/v2/token/refresh`);
  url.searchParams.set("app_key",creds.appKey); url.searchParams.set("app_secret",creds.appSecret); url.searchParams.set("refresh_token",refreshToken); url.searchParams.set("grant_type","refresh_token");
  return normalizeTokenResponse(await readJson<TiktokTokenResponse>(await marketplaceFetch(url.toString())));
}

export async function getAuthorizedShops(creds:TiktokAppCredentials,accessToken:string){
  const path="/authorization/202309/shops";
  const params={app_key:creds.appKey,timestamp:String(nowTs())};
  const url=new URL((creds.environment === "test" ? "https://open-api-sandbox.tiktokglobalshop.com" : "https://open-api.tiktokglobalshop.com")+path);
  for(const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  url.searchParams.set("sign",sign(creds,path,params,""));
  return readJson(await marketplaceFetch(url.toString(),{headers:{"x-tts-access-token":accessToken}}));
}

async function signedCall<T=any>(creds:TiktokAppCredentials,path:string,accessToken:string,shopId:string,shopCipher:string,method:"GET"|"POST",query:Record<string,string>={},body?:Record<string,any>):Promise<T>{
  const params:Record<string,string>={app_key:creds.appKey,shop_id:shopId,shop_cipher:shopCipher,timestamp:String(nowTs()),...query};
  const rawBody=body?JSON.stringify(body):"";
  const url=new URL((creds.environment === "test" ? "https://open-api-sandbox.tiktokglobalshop.com" : "https://open-api.tiktokglobalshop.com")+path);
  for(const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  url.searchParams.set("sign",sign(creds,path,params,rawBody));
  return readJson<T>(await marketplaceFetch(url.toString(),{method,headers:{"x-tts-access-token":accessToken,"Content-Type":"application/json"},body:method==="POST"?rawBody:undefined}));
}

export const searchOrders=(c:TiktokAppCredentials,t:string,s:string,sc:string,p:{createTimeFrom:number;createTimeTo:number;pageSize?:number;pageToken?:string})=>signedCall(c,"/order/202309/orders/search",t,s,sc,"POST",{page_size:String(p.pageSize??50),...(p.pageToken?{page_token:p.pageToken}:{})},{create_time_ge:p.createTimeFrom,create_time_lt:p.createTimeTo});
export const getOrderDetail=(c:TiktokAppCredentials,t:string,s:string,sc:string,ids:string[])=>signedCall(c,"/order/202309/orders",t,s,sc,"GET",{ids:ids.join(",")});
export const searchProducts=(c:TiktokAppCredentials,t:string,s:string,sc:string,p:{pageSize?:number;pageToken?:string})=>signedCall(c,"/product/202309/products/search",t,s,sc,"POST",{page_size:String(p.pageSize??50),...(p.pageToken?{page_token:p.pageToken}:{})},{});

export const getProduct=(c:TiktokAppCredentials,t:string,s:string,sc:string,id:string)=>signedCall(c,`/product/202309/products/${encodeURIComponent(id)}`,t,s,sc,"GET");
