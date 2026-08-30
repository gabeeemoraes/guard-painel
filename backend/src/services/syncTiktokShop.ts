import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import * as tiktok from "./tiktokShopClient";
import { upsertProduct, upsertOrderWithItems } from "./syncHelpers";
import { getMarketplaceAppCredentials } from "./appCredentials";

type ProgressCb = (step: string) => void;
type MarketplaceAccount = Awaited<ReturnType<typeof prisma.marketplaceAccount.findUniqueOrThrow>>;

async function getValidAccessToken(account: MarketplaceAccount): Promise<{ accessToken: string; app: tiktok.TiktokAppCredentials }> {
  const appCreds = await getMarketplaceAppCredentials("tiktokshop");
  if (!appCreds) throw new Error("Credenciais do TikTok Shop não configuradas em Integrações.");
  const app = { appKey: appCreds.identifier, appSecret: appCreds.secret };
  const credentials = await prisma.credential.findUnique({ where: { marketplaceAccountId: account.id } });
  if (!credentials) {
    throw new Error("Loja TikTok Shop não conectada. Conecte em Integrações → TikTok Shop.");
  }

  const isExpiring = credentials.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  if (isExpiring) {
    const refreshToken = decryptSecret(credentials.refreshTokenEnc);
    const refreshed = await tiktok.refreshAccessToken(app, refreshToken);
    if (!refreshed.access_token) {
      throw new Error(
        `Falha ao renovar token do TikTok Shop: ${refreshed.message || "erro desconhecido"}. Reconecte a loja.`
      );
    }
    await prisma.credential.update({
      where: { marketplaceAccountId: account.id },
      data: {
        accessTokenEnc: encryptSecret(refreshed.access_token),
        refreshTokenEnc: encryptSecret(refreshed.refresh_token),
        // access_token_expire_in da TikTok Shop já é um timestamp absoluto (não uma duração)
        expiresAt: new Date(refreshed.access_token_expire_in * 1000),
      },
    });
    return { accessToken: refreshed.access_token, app };
  }

  return { accessToken: decryptSecret(credentials.accessTokenEnc), app };
}

export async function syncTiktokShop(account: MarketplaceAccount, onProgress: ProgressCb) {
  onProgress("Conectando...");
  const { accessToken, app } = await getValidAccessToken(account);
  const shopId = account.shopId;
  const shopCipher = account.shopCipher;

  if (!shopCipher) {
    throw new Error("shop_cipher ausente para esta loja TikTok Shop. Reconecte a loja em Integrações.");
  }

  onProgress("Processando produtos...");
  let productsSynced = 0;
  let pageToken = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res: any = await tiktok.searchProducts(app, accessToken, shopId, shopCipher, {
      pageSize: 50,
      pageToken: pageToken || undefined,
    });
    const products = res?.data?.products ?? [];

    for (const p of products) {
      const skus = p.skus ?? [];
      const firstSku = skus[0];
      const price = Number(firstSku?.price?.sale_price ?? firstSku?.price?.original_price ?? 0);
      const stock = skus.reduce((s: number, sk: any) => s + Number(sk?.inventory?.[0]?.quantity ?? 0), 0);

      await upsertProduct(account.storeId, "tiktokshop", {
        externalId: String(p.id),
        sku: firstSku?.seller_sku || null,
        name: p.title || `Produto ${p.id}`,
        price,
        stock,
        imageUrl: p?.main_images?.[0]?.url || null,
        status: p.status || "ACTIVATE",
      });
      productsSynced++;
    }

    pageToken = res?.data?.next_page_token || "";
    if (!pageToken || products.length === 0) break;
  }

  onProgress("Buscando pedidos...");
  const now = Math.floor(Date.now() / 1000);
  const from = now - 90 * 24 * 60 * 60;

  const allOrders: any[] = [];
  let orderPageToken = "";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res: any = await tiktok.searchOrders(app, accessToken, shopId, shopCipher, {
      createTimeFrom: from,
      createTimeTo: now,
      pageSize: 50,
      pageToken: orderPageToken || undefined,
    });
    const orders = res?.data?.orders ?? [];
    allOrders.push(...orders);
    orderPageToken = res?.data?.next_page_token || "";
    if (!orderPageToken || orders.length === 0) break;
  }

  onProgress("Processando financeiro...");
  let ordersSynced = 0;
  for (const o of allOrders) {
    const orderDate = new Date(Number(o.create_time ?? now) * 1000);
    const totalAmount = Number(o.payment?.total_amount ?? 0);
    const feeAmount = Number(o.payment?.platform_discount ?? 0) + Number(o.payment?.commission_fee ?? 0);
    const shippingFee = Number(o.payment?.shipping_fee ?? 0);
    const discountAmount = Number(o.payment?.seller_discount ?? 0);
    const netAmount = Number(o.payment?.total_amount ?? totalAmount) - feeAmount;

    const items = o.line_items ?? [];

    await upsertOrderWithItems(account.storeId, "tiktokshop", {
      externalId: String(o.id),
      status: o.status || "UNKNOWN",
      orderDate,
      totalAmount,
      discountAmount,
      shippingFee,
      feeAmount,
      netAmount,
      buyerUsername: o.buyer_email || null,
      items: items.map((it: any) => ({
        externalItemId: it.product_id ? String(it.product_id) : null,
        sku: it.seller_sku || null,
        name: it.product_name || `Item ${it.product_id}`,
        quantity: 1,
        unitPrice: Number(it.sale_price ?? 0),
      })),
    });
    ordersSynced++;
  }

  await prisma.marketplaceAccount.update({
    where: { id: account.id },
    data: { syncFrom: new Date(from * 1000), syncTo: new Date(now * 1000), status: "connected" },
  });

  return { ordersSynced, productsSynced };
}
