const API_HOST = "https://api.mercadolibre.com";
const AUTH_HOST = "https://auth.mercadolivre.com.br";
export interface MercadoLivreAppCredentials { clientId: string; clientSecret: string }
export interface MeliTokenResponse { access_token: string; refresh_token: string; expires_in: number; user_id: number; error?: string; message?: string }

export function buildAuthUrl(creds: MercadoLivreAppCredentials, redirectUrl: string, state: string): string {
  const url = new URL(`${AUTH_HOST}/authorization`);
  url.searchParams.set("response_type", "code"); url.searchParams.set("client_id", creds.clientId); url.searchParams.set("redirect_uri", redirectUrl); url.searchParams.set("state", state);
  return url.toString();
}
export async function exchangeCodeForToken(creds: MercadoLivreAppCredentials, code: string, redirectUrl: string): Promise<MeliTokenResponse> {
  const res = await fetch(`${API_HOST}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "authorization_code", client_id: creds.clientId, client_secret: creds.clientSecret, code, redirect_uri: redirectUrl }) });
  return (await res.json()) as MeliTokenResponse;
}
export async function refreshAccessToken(creds: MercadoLivreAppCredentials, refreshToken: string): Promise<MeliTokenResponse> {
  const res = await fetch(`${API_HOST}/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: creds.clientId, client_secret: creds.clientSecret, refresh_token: refreshToken }) });
  return (await res.json()) as MeliTokenResponse;
}
async function authedGet<T = any>(path: string, accessToken: string, query: Record<string, string> = {}): Promise<T> { const url = new URL(API_HOST + path); for (const [k,v] of Object.entries(query)) url.searchParams.set(k,v); const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } }); return (await res.json()) as T; }
export const getMe = (t: string) => authedGet<{id:number;nickname:string}>("/users/me", t);
export const searchOrders = (t:string, sellerId:string, p:{dateFrom:string;dateTo:string;offset?:number;limit?:number}) => authedGet<{results:any[];paging:{total:number;offset:number;limit:number}}>("/orders/search", t, { seller:sellerId, "order.date_created.from":p.dateFrom, "order.date_created.to":p.dateTo, offset:String(p.offset??0), limit:String(p.limit??50), sort:"date_desc" });
export const getOrderDetail = (t:string, id:string) => authedGet<any>(`/orders/${id}`, t);
export const searchItemsByUser = (t:string, userId:string, p:{offset?:number;limit?:number}) => authedGet<{results:string[];paging:{total:number}}>(`/users/${userId}/items/search`, t, { offset:String(p.offset??0), limit:String(p.limit??50) });
export async function getItemsMultiget(accessToken:string,itemIds:string[]):Promise<any[]> { const url=new URL(`${API_HOST}/items`); url.searchParams.set("ids",itemIds.join(",")); const res=await fetch(url.toString(),{headers:{Authorization:`Bearer ${accessToken}`}}); const data=(await res.json()) as any[]; return data.map((entry)=>entry.body??entry); }
