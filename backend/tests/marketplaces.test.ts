import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import type { AddressInfo } from "node:net";
process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
process.env.SESSION_SECRET = "marketplace-test-secret";
process.env.CREDENTIALS_ENCRYPTION_KEY = "marketplace-test-encryption";
process.env.FRONTEND_URL = "https://guard-painel-moraes-corp.vercel.app";
process.env.BACKEND_PUBLIC_URL = process.env.FRONTEND_URL;
const { prisma } = require("../src/lib/prisma");
const { encryptSecret, decryptSecret } = require("../src/lib/crypto");
const { signSession } = require("../src/middleware/auth");
const { storeUserContext } = require("../src/services/store");
const shopee = require("../src/services/shopeeClient");
const tiktok = require("../src/services/tiktokShopClient");
const meli = require("../src/services/mercadoLivreClient");
const app = require("../src/app").default;

test("Marketplace authorization, configuration and synchronization", async t => {
  const settings = new Map<string, any>();
  const saved = new Map<string, any>();
  let persisted = 0;
  let remoteFailure = false;
  let refreshCalled = false;
  let expired = false;
  let currentAccount: any = null;
  let tokenExpiry: Date;
  const calls: URL[] = [];
  const user = { id: "user-a", storeId: "store-a", role: "ADMIN", active: true, permissions: "[]" };
  prisma.user.findUnique = async () => user;
  prisma.store.findUnique = async (args: any) => ({ id: args.where.id });
  prisma.setting.findUnique = async (args: any) => {
    assert.equal(args.where.storeId_key.storeId, "store-a");
    const v = settings.get(args.where.storeId_key.key);
    return v ? { value: JSON.stringify(v) } : null;
  };
  prisma.setting.upsert = async (args: any) => { settings.set(args.create.key, JSON.parse(args.create.value)); };
  prisma.marketplaceAppCredential.findUnique = async (args: any) => {
    assert.equal(args.where.storeId_provider.storeId, "store-a");
    return saved.get(args.where.storeId_provider.provider) ?? { identifierEnc: encryptSecret("123456"), secretEnc: encryptSecret("app-secret") };
  };
  prisma.marketplaceAppCredential.upsert = async (args: any) => { saved.set(args.create.provider, args.create); return args.create; };
  prisma.$transaction = async (fn: any) => fn(prisma);
  prisma.marketplaceAccount.findFirst = async () => currentAccount;
  prisma.marketplaceAccount.findUnique = async () => currentAccount;
  prisma.marketplaceAccount.upsert = async (args: any) => { persisted++; assert.equal(args.create.storeId, "store-a"); return { id: "account-a" }; };
  prisma.marketplaceAccount.update = async () => ({});
  prisma.credential.upsert = async (args: any) => { assert.equal(decryptSecret(args.create.accessTokenEnc), "access"); tokenExpiry = args.create.expiresAt; };
  prisma.credential.findUnique = async () => ({ accessTokenEnc: encryptSecret("access"), refreshTokenEnc: encryptSecret("refresh"), expiresAt: new Date(Date.now() + (expired ? -1000 : 3600000)) });
  prisma.credential.update = async (args: any) => { refreshCalled = true; assert.equal(decryptSecret(args.data.refreshTokenEnc), "new-refresh"); };
  prisma.auditLog.create = async () => ({});
  const realFetch = globalThis.fetch;
  const json = (data: any) => new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });
  let handler = async (url: URL, init: any): Promise<Response> => {
    if (url.pathname.endsWith("/auth/token/get")) return json({ access_token: "access", refresh_token: "refresh", expire_in: 14400 });
    if (url.pathname.endsWith("/shop/get_shop_info")) return json({ response: { shop_name: "Shopee Test" } });
    if (url.pathname === "/api/v2/token/get") return json({ code: 0, data: { access_token: "access", refresh_token: "refresh", access_token_expire_in: Math.floor(Date.now()/1000)+3600 } });
    if (url.pathname === "/authorization/202309/shops") return json(remoteFailure ? { code: 106001, message: "Permission denied" } : { code: 0, data: { shops: [{ id: "shop-t", cipher: "cipher-t", name: "TikTok Test" }] } });
    if (url.pathname.endsWith("/auth/access_token/get")) return json({ access_token: "access", refresh_token: "new-refresh", expire_in: 14400 });
    if (url.pathname === "/oauth/token") return json({ access_token: "access", refresh_token: "new-refresh", expires_in: 21600 });
    if (url.pathname === "/api/v2/token/refresh") return json({ code: 0, data: { access_token: "access", refresh_token: "new-refresh", access_token_expire_in: Math.floor(Date.now()/1000)+3600 } });
    throw new Error(`Unexpected external endpoint ${url.pathname}`);
  };
  globalThis.fetch = (async (input: any, init: any) => {
    const url = new URL(String(input));
    if (url.hostname === "127.0.0.1") return realFetch(input, init);
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const authorization = `Bearer ${signSession({ userId: "user-a", role: "ADMIN" })}`;
  const request = (path: string, init: RequestInit = {}) => realFetch(base + path, { ...init, headers: { authorization, "content-type": "application/json", ...init.headers }, redirect: "manual" });
  const cookieHeader = (res: Response) => res.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
  try {
    await t.test("Shopee signs production URL and binds state into the callback", async () => {
      const res = await request("/api/integrations/shopee/connect-url");
      assert.equal(res.status, 200);
      const url = new URL((await res.json()).url);
      assert.equal(url.origin, "https://partner.shopeemobile.com");
      const state = new URL(url.searchParams.get("redirect")!).searchParams.get("state")!;
      assert.ok(state);
      const expected = createHmac("sha256", "app-secret").update(`123456${url.pathname}${url.searchParams.get("timestamp")}`).digest("hex");
      assert.equal(url.searchParams.get("sign"), expected);
      const bad = await request("/api/integrations/shopee/callback?code=one-time-code&shop_id=22&state=wrong", { headers: { cookie: cookieHeader(res) } });
      assert.match(new URL(bad.headers.get("location")!).searchParams.get("error")!, /Estado OAuth/);
      assert.equal(persisted, 0);
      const ok = await request(`/api/integrations/shopee/callback?code=one-time-code&shop_id=22&state=${state}`, { headers: { cookie: cookieHeader(res) } });
      assert.equal(new URL(ok.headers.get("location")!).searchParams.get("success"), "1");
      assert.equal(persisted, 1);
      assert.ok(tokenExpiry.getTime() > Date.now());
    });
    await t.test("TikTok requires Service ID, stores it per company, never exposes secret", async () => {
      assert.equal((await request("/api/integrations/tiktokshop/connect-url")).status, 400);
      const bad = await request("/api/integrations/tiktokshop/app-credentials", { method: "PUT", body: JSON.stringify({ identifier: "app-key", secret: "app-secret" }) });
      assert.equal(bad.status, 400);
      const ok = await request("/api/integrations/tiktokshop/app-credentials", { method: "PUT", body: JSON.stringify({ identifier: "app-key", secret: "app-secret", serviceId: "service-123", environment: "live" }) });
      assert.equal(ok.status, 200);
      const credentials = await (await request("/api/integrations/tiktokshop/app-credentials")).json();
      assert.equal(credentials.serviceId, "service-123");
      assert.equal(credentials.secretSaved, true);
      assert.equal(JSON.stringify(credentials).includes("app-secret"), false);
      const res = await request("/api/integrations/tiktokshop/connect-url");
      const url = new URL((await res.json()).url);
      assert.equal(url.searchParams.get("service_id"), "service-123");
      assert.equal(url.origin, "https://services.tiktokshop.com");
      remoteFailure = true;
      const fail = await request(`/api/integrations/tiktokshop/callback?code=one-time&state=${url.searchParams.get("state")}`, { headers: { cookie: cookieHeader(res) } });
      assert.match(new URL(fail.headers.get("location")!).searchParams.get("error")!, /Permission denied/);
      assert.equal(persisted, 1, "failed provider response must not create a connected account");
      remoteFailure = false;
      const good = await request(`/api/integrations/tiktokshop/callback?code=one-time&state=${url.searchParams.get("state")}`, { headers: { cookie: cookieHeader(res) } });
      assert.equal(new URL(good.headers.get("location")!).searchParams.get("success"), "1");
      assert.equal(persisted, 2);
    });
    await t.test("changed app identifier requires a new secret", async () => {
      const res = await request("/api/integrations/mercadolivre/app-credentials", { method: "PUT", body: JSON.stringify({ identifier: "999999" }) });
      assert.equal(res.status, 400);
    });
    await t.test("Shopee sandbox is explicit and does not affect other marketplaces", async () => {
      settings.set("marketplace_options_shopee", { environment: "test", serviceId: "" });
      const url = new URL((await (await request("/api/integrations/shopee/connect-url")).json()).url);
      assert.equal(url.origin, "https://partner.test-stable.shopeemobile.com");
      const m = new URL((await (await request("/api/integrations/mercadolivre/connect-url")).json()).url);
      assert.equal(m.origin, "https://auth.mercadolivre.com.br");
      settings.delete("marketplace_options_shopee");
    });
    await t.test("all providers refresh expiring tokens and persist rotated refresh tokens", async () => {
      expired = true;
      const account = { id: "account-a", storeId: "store-a", shopId: "22" };
      for (const module of ["syncShopee", "syncMercadoLivre", "syncTiktokShop"]) {
        refreshCalled = false;
        await storeUserContext.run("user-a", () => require(`../src/services/${module}`).getValidAccessToken(account));
        assert.equal(refreshCalled, true, module);
      }
      expired = false;
    });
    await t.test("connection check confirms seller identity and rejects a different shop", async () => {
      currentAccount = { id: "account-a", storeId: "store-a", shopId: "shop-t", status: "connected" };
      assert.equal((await request("/api/integrations/tiktokshop/check", { method: "POST" })).status, 200);
      currentAccount.shopId = "other-shop";
      assert.equal((await request("/api/integrations/tiktokshop/check", { method: "POST" })).status, 502);
      currentAccount = null;
    });
    await t.test("Shopee sync splits order history into bounded contiguous windows", async () => {
      const previous = handler;
      const windows: Array<[number,number]> = [];
      handler = async (url, init) => {
        if (url.pathname.endsWith("/get_item_list")) return json({ response: { item: [] } });
        if (url.pathname.endsWith("/get_order_list")) { windows.push([Number(url.searchParams.get("time_from")),Number(url.searchParams.get("time_to"))]); return json({ response: { order_list: [], more: false } }); }
        return previous(url, init);
      };
      const result = await storeUserContext.run("user-a", () => require("../src/services/syncShopee").syncShopee({ id: "a", storeId: "store-a", shopId: "22" }, () => {}));
      assert.deepEqual(result, { ordersSynced: 0, productsSynced: 0 });
      assert.equal(windows.length, 7);
      for (let i=0;i<windows.length;i++) { assert.ok(windows[i][1]-windows[i][0] < 14*86400); if(i) assert.equal(windows[i][0],windows[i-1][1]+1); }
      handler = previous;
    });
    await t.test("TikTok sync loads product/order details and preserves quantities and warehouse stock", async () => {
      const previous = handler;
      let product: any;
      let item: any;
      prisma.product.upsert = async (args: any) => { product = args.create; return { id: "p" }; };
      prisma.product.findUnique = async () => null;
      prisma.order.upsert = async () => ({ id: "o" });
      prisma.orderItem.deleteMany = async () => ({});
      prisma.orderItem.create = async (args: any) => { item = args.data; };
      prisma.financialTransaction.deleteMany = async () => ({});
      prisma.financialTransaction.create = async () => ({});
      handler = async (url, init) => {
        if (url.pathname === "/product/202309/products/search") return json({ code: 0, data: { products: [{ id: "product-t" }] } });
        if (url.pathname === "/product/202309/products/product-t") return json({ code: 0, data: { id: "product-t", title: "Detailed product", skus: [{ seller_sku: "sku", price: { amount: "19.90" }, inventory: [{ quantity: 4 }, { quantity: 5 }] }] } });
        if (url.pathname === "/order/202309/orders/search") return json({ code: 0, data: { orders: [{ id: "order-t" }] } });
        if (url.pathname === "/order/202309/orders") return json({ code: 0, data: { orders: [{ id: "order-t", create_time: Math.floor(Date.now()/1000), payment: { total_amount: "59.70" }, line_items: [{ product_id: "product-t", product_name: "Detailed product", quantity: 3, sale_price: "19.90" }] }] } });
        return previous(url, init);
      };
      const result = await storeUserContext.run("user-a", () => require("../src/services/syncTiktokShop").syncTiktokShop({ id: "a", storeId: "store-a", shopId: "shop-t", shopCipher: "cipher-t" }, () => {}));
      assert.deepEqual(result, { ordersSynced: 1, productsSynced: 1 });
      assert.equal(product.price,19.9);
      assert.equal(product.stock,9);
      assert.equal(item.quantity,3);
      assert.equal(item.unitPrice,19.9);
      handler = previous;
    });
    await t.test("business API errors and incomplete tokens fail rather than report empty success", async () => {
      const previous = handler;
      handler = async () => json({ code: 105002, message: "Scope missing" });
      await assert.rejects(tiktok.searchProducts({ appKey: "key", appSecret: "secret" }, "token", "shop", "cipher", {}), /Scope missing/);
      handler = async () => json({ access_token: "access" });
      await assert.rejects(shopee.refreshAccessToken({ partnerId: "123", partnerKey: "secret" }, "refresh", "22"), /tokens incompletos/);
      await assert.rejects(meli.refreshAccessToken({ clientId: "123", clientSecret: "secret" }, "refresh"), /tokens incompletos/);
      handler = previous;
    });
    await t.test("TikTok detail request sends comma-separated IDs and uses token header", async () => {
      const previous = handler;
      handler = async (url, init) => { assert.equal(url.searchParams.get("ids"), "11,22"); assert.equal(init.headers["x-tts-access-token"], "token"); assert.equal(url.searchParams.has("access_token"), false); return json({ code: 0, data: { orders: [] } }); };
      await tiktok.getOrderDetail({ appKey: "key", appSecret: "secret" }, "token", "shop", "cipher", ["11", "22"]);
      handler = previous;
    });
  } finally {
    globalThis.fetch = realFetch;
    await new Promise<void>(resolve=>server.close(resolve));
    await prisma.$disconnect();
  }
});
