import crypto from "crypto";
import { env } from "../env";

export interface TiktokAppCredentials {
  appKey: string;
  appSecret: string;
}

export interface TiktokTokenData {
  access_token: string;
  refresh_token: string;
  access_token_expire_in: number;
  refresh_token_expire_in: number;
  open_id?: string;
  seller_name?: string;
}

export interface TiktokTokenResponse {
  code?: number;
  message?: string;
  request_id?: string;
  data?: TiktokTokenData;
}

export interface NormalizedTiktokToken {
  access_token: string;
  refresh_token: string;
  access_token_expire_in: number;
  refresh_token_expire_in: number;
  open_id?: string;
  seller_name?: string;
  message?: string;
}

function sign(
  creds: TiktokAppCredentials,
  path: string,
  params: Record<string, string>,
  rawBody: string
): string {
  const keys = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort();

  let base = path;
  for (const key of keys) base += key + params[key];
  base += rawBody;

  const wrapped = creds.appSecret + base + creds.appSecret;
  return crypto
    .createHmac("sha256", creds.appSecret)
    .update(wrapped)
    .digest("hex");
}

function nowTs() {
  return Math.floor(Date.now() / 1000);
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`TikTok Shop retornou resposta inválida (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const body = data as { message?: string; code?: number };
    throw new Error(
      `TikTok Shop HTTP ${res.status}: ${body?.message || "erro na API"}${body?.code !== undefined ? ` (code ${body.code})` : ""}`
    );
  }

  return data as T;
}

function normalizeTokenResponse(response: TiktokTokenResponse): NormalizedTiktokToken {
  if (response.code !== undefined && response.code !== 0) {
    throw new Error(response.message || `TikTok Shop retornou code ${response.code}.`);
  }

  const data = response.data;
  if (!data?.access_token || !data?.refresh_token || !data.access_token_expire_in) {
    throw new Error(response.message || "TikTok Shop não retornou um token válido.");
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    access_token_expire_in: data.access_token_expire_in,
    refresh_token_expire_in: data.refresh_token_expire_in,
    open_id: data.open_id,
    seller_name: data.seller_name,
    message: response.message,
  };
}

export function buildAuthUrl(
  creds: TiktokAppCredentials,
  state: string
): string {
  // Seller authorization entry point for Rest of World.
  // The service-specific authorization flow uses app_key + state.
  const url = new URL("https://services.tiktokshop.com/open/authorize");
  url.searchParams.set("app_key", creds.appKey);
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForToken(
  creds: TiktokAppCredentials,
  code: string
): Promise<NormalizedTiktokToken> {
  const url = new URL(`${env.tiktokAuthHost()}/api/v2/token/get`);
  url.searchParams.set("app_key", creds.appKey);
  url.searchParams.set("app_secret", creds.appSecret);
  url.searchParams.set("auth_code", code);
  url.searchParams.set("grant_type", "authorized_code");

  const res = await fetch(url.toString());
  const response = await readJson<TiktokTokenResponse>(res);
  return normalizeTokenResponse(response);
}

export async function refreshAccessToken(
  creds: TiktokAppCredentials,
  refreshToken: string
): Promise<NormalizedTiktokToken> {
  const url = new URL(`${env.tiktokAuthHost()}/api/v2/token/refresh`);
  url.searchParams.set("app_key", creds.appKey);
  url.searchParams.set("app_secret", creds.appSecret);
  url.searchParams.set("refresh_token", refreshToken);
  url.searchParams.set("grant_type", "refresh_token");

  const res = await fetch(url.toString());
  const response = await readJson<TiktokTokenResponse>(res);
  return normalizeTokenResponse(response);
}

export async function getAuthorizedShops(
  creds: TiktokAppCredentials,
  accessToken: string
) {
  const path = "/authorization/202309/shops";
  const params = {
    app_key: creds.appKey,
    timestamp: String(nowTs()),
  };
  const signature = sign(creds, path, params, "");
  const url = new URL(env.tiktokApiHost() + path);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("sign", signature);

  const res = await fetch(url.toString(), {
    headers: { "x-tts-access-token": accessToken },
  });

  return readJson(res);
}

async function signedCall<T = any>(
  creds: TiktokAppCredentials,
  path: string,
  accessToken: string,
  shopId: string,
  shopCipher: string,
  method: "GET" | "POST",
  query: Record<string, string> = {},
  body?: Record<string, any>
): Promise<T> {
  const params: Record<string, string> = {
    app_key: creds.appKey,
    shop_id: shopId,
    shop_cipher: shopCipher,
    timestamp: String(nowTs()),
    ...query,
  };

  const rawBody = body ? JSON.stringify(body) : "";
  const signature = sign(creds, path, params, rawBody);
  const url = new URL(env.tiktokApiHost() + path);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set("sign", signature);

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "x-tts-access-token": accessToken,
      "Content-Type": "application/json",
    },
    body: method === "POST" ? rawBody : undefined,
  });

  return readJson<T>(res);
}

export const searchOrders = (
  c: TiktokAppCredentials,
  t: string,
  s: string,
  sc: string,
  p: {
    createTimeFrom: number;
    createTimeTo: number;
    pageSize?: number;
    pageToken?: string;
  }
) =>
  signedCall(
    c,
    "/order/202309/orders/search",
    t,
    s,
    sc,
    "POST",
    {
      page_size: String(p.pageSize ?? 50),
      ...(p.pageToken ? { page_token: p.pageToken } : {}),
    },
    {
      create_time_ge: p.createTimeFrom,
      create_time_lt: p.createTimeTo,
    }
  );

export const getOrderDetail = (
  c: TiktokAppCredentials,
  t: string,
  s: string,
  sc: string,
  ids: string[]
) =>
  signedCall(
    c,
    "/order/202309/orders",
    t,
    s,
    sc,
    "GET",
    { ids: JSON.stringify(ids) }
  );

export const searchProducts = (
  c: TiktokAppCredentials,
  t: string,
  s: string,
  sc: string,
  p: { pageSize?: number; pageToken?: string }
) =>
  signedCall(
    c,
    "/product/202309/products/search",
    t,
    s,
    sc,
    "POST",
    {
      page_size: String(p.pageSize ?? 50),
      ...(p.pageToken ? { page_token: p.pageToken } : {}),
    },
    {}
  );
