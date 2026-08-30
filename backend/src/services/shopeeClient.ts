import crypto from "crypto";
import { env } from "../env";

export interface ShopeeAppCredentials { partnerId: string; partnerKey: string }

function sign(baseString: string, partnerKey: string): string {
  return crypto.createHmac("sha256", partnerKey).update(baseString).digest("hex");
}
function nowTs(): number { return Math.floor(Date.now() / 1000); }

export interface ShopeeTokenResponse {
  access_token: string;
  refresh_token: string;
  expire_in: number;
  shop_id?: number;
  error?: string;
  message?: string;
}

export function buildAuthUrl(creds: ShopeeAppCredentials, redirectUrl: string): string {
  const path = "/api/v2/shop/auth_partner";
  const timestamp = nowTs();
  const signature = sign(`${creds.partnerId}${path}${timestamp}`, creds.partnerKey);
  const url = new URL(env.shopeeHost() + path);
  url.searchParams.set("partner_id", creds.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);
  url.searchParams.set("redirect", redirectUrl);
  return url.toString();
}

export async function exchangeCodeForToken(creds: ShopeeAppCredentials, code: string, shopId: string): Promise<ShopeeTokenResponse> {
  const path = "/api/v2/auth/token/get";
  const timestamp = nowTs();
  const signature = sign(`${creds.partnerId}${path}${timestamp}`, creds.partnerKey);
  const url = new URL(env.shopeeHost() + path);
  url.searchParams.set("partner_id", creds.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);
  const res = await fetch(url.toString(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, shop_id: Number(shopId), partner_id: Number(creds.partnerId) }),
  });
  return (await res.json()) as ShopeeTokenResponse;
}

export async function refreshAccessToken(creds: ShopeeAppCredentials, refreshToken: string, shopId: string): Promise<ShopeeTokenResponse> {
  const path = "/api/v2/auth/access_token/get";
  const timestamp = nowTs();
  const signature = sign(`${creds.partnerId}${path}${timestamp}`, creds.partnerKey);
  const url = new URL(env.shopeeHost() + path);
  url.searchParams.set("partner_id", creds.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signature);
  const res = await fetch(url.toString(), {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken, shop_id: Number(shopId), partner_id: Number(creds.partnerId) }),
  });
  return (await res.json()) as ShopeeTokenResponse;
}

async function callShopApi<T = any>(creds: ShopeeAppCredentials, path: string, accessToken: string, shopId: string, query: Record<string, string | number> = {}, method: "GET" | "POST" = "GET", body?: Record<string, any>): Promise<T> {
  const timestamp = nowTs();
  const signature = sign(`${creds.partnerId}${path}${timestamp}${accessToken}${shopId}`, creds.partnerKey);
  const url = new URL(env.shopeeHost() + path);
  url.searchParams.set("partner_id", creds.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("shop_id", shopId);
  url.searchParams.set("sign", signature);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v));
  const res = await fetch(url.toString(), { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? JSON.stringify(body ?? {}) : undefined });
  return (await res.json()) as T;
}

export const getShopInfo = (c: ShopeeAppCredentials, t: string, s: string) => callShopApi(c, "/api/v2/shop/get_shop_info", t, s);
export const getOrderList = (c: ShopeeAppCredentials, t: string, s: string, p: { timeFrom: number; timeTo: number; cursor?: string; pageSize?: number }) => callShopApi(c, "/api/v2/order/get_order_list", t, s, { time_range_field: "create_time", time_from: p.timeFrom, time_to: p.timeTo, page_size: p.pageSize ?? 50, cursor: p.cursor ?? "", response_optional_fields: "order_status" });
export const getOrderDetail = (c: ShopeeAppCredentials, t: string, s: string, ids: string[]) => callShopApi(c, "/api/v2/order/get_order_detail", t, s, { order_sn_list: ids.join(","), response_optional_fields: "item_list,total_amount,order_status,payment_method,buyer_username,create_time" });
export const getEscrowDetail = (c: ShopeeAppCredentials, t: string, s: string, sn: string) => callShopApi(c, "/api/v2/payment/get_escrow_detail", t, s, { order_sn: sn });
export const getItemList = (c: ShopeeAppCredentials, t: string, s: string, p: { offset?: number; pageSize?: number }) => callShopApi(c, "/api/v2/product/get_item_list", t, s, { offset: p.offset ?? 0, page_size: p.pageSize ?? 50, item_status: "NORMAL" });
export const getItemBaseInfo = (c: ShopeeAppCredentials, t: string, s: string, ids: number[]) => callShopApi(c, "/api/v2/product/get_item_base_info", t, s, { item_id_list: ids.join(",") });
