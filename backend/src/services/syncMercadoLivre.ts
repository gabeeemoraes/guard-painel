import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import * as meli from "./mercadoLivreClient";
import { upsertProduct, upsertOrderWithItems } from "./syncHelpers";
import { getMarketplaceAppCredentials } from "./appCredentials";

type ProgressCb = (step: string) => void;
type MarketplaceAccount = Awaited<ReturnType<typeof prisma.marketplaceAccount.findUniqueOrThrow>>;

async function getValidAccessToken(account: MarketplaceAccount): Promise<string> {
  const appCreds = await getMarketplaceAppCredentials("mercadolivre");
  if (!appCreds) throw new Error("Credenciais do Mercado Livre não configuradas em Integrações.");
  const app = { clientId: appCreds.identifier, clientSecret: appCreds.secret };
  const credentials = await prisma.credential.findUnique({ where: { marketplaceAccountId: account.id } });
  if (!credentials) {
    throw new Error("Loja Mercado Livre não conectada. Conecte em Integrações → Mercado Livre.");
  }

  const isExpiring = credentials.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  if (isExpiring) {
    const refreshToken = decryptSecret(credentials.refreshTokenEnc);
    const refreshed = await meli.refreshAccessToken(app, refreshToken);
    if (!refreshed.access_token) {
      throw new Error(
        `Falha ao renovar token do Mercado Livre: ${refreshed.message || "erro desconhecido"}. Reconecte a loja.`
      );
    }
    await prisma.credential.update({
      where: { marketplaceAccountId: account.id },
      data: {
        accessTokenEnc: encryptSecret(refreshed.access_token),
        refreshTokenEnc: encryptSecret(refreshed.refresh_token),
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      },
    });
    return refreshed.access_token;
  }

  return decryptSecret(credentials.accessTokenEnc);
}

export async function syncMercadoLivre(account: MarketplaceAccount, onProgress: ProgressCb) {
  onProgress("Conectando...");
  const accessToken = await getValidAccessToken(account);
  const sellerId = account.shopId; // user_id do vendedor

  const me = await meli.getMe(accessToken);
  if (me?.nickname) {
    await prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: { shopName: me.nickname, status: "connected" },
    });
  }

  onProgress("Processando produtos...");
  let productsSynced = 0;
  let offset = 0;
  const pageSize = 50;
  const allItemIds: string[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await meli.searchItemsByUser(accessToken, sellerId, { offset, limit: pageSize });
    const ids = res?.results ?? [];
    allItemIds.push(...ids);
    if (ids.length === 0 || allItemIds.length >= (res?.paging?.total ?? 0)) break;
    offset += pageSize;
  }

  for (let i = 0; i < allItemIds.length; i += 20) {
    const batch = allItemIds.slice(i, i + 20);
    const items = await meli.getItemsMultiget(accessToken, batch);
    for (const item of items) {
      if (!item?.id) continue;
      await upsertProduct(account.storeId, "mercadolivre", {
        externalId: String(item.id),
        sku: item.seller_custom_field || item.seller_sku || null,
        name: item.title || `Anúncio ${item.id}`,
        price: Number(item.price ?? 0),
        stock: Number(item.available_quantity ?? 0),
        imageUrl: item?.pictures?.[0]?.secure_url || item?.thumbnail || null,
        status: item.status || "active",
      });
      productsSynced++;
    }
  }

  onProgress("Buscando pedidos...");
  const now = new Date();
  const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const dateFrom = from.toISOString();
  const dateTo = now.toISOString();

  const allOrders: any[] = [];
  let orderOffset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await meli.searchOrders(accessToken, sellerId, { dateFrom, dateTo, offset: orderOffset, limit: 50 });
    const results = res?.results ?? [];
    allOrders.push(...results);
    if (results.length === 0 || allOrders.length >= (res?.paging?.total ?? 0)) break;
    orderOffset += 50;
  }

  onProgress("Processando financeiro...");
  let ordersSynced = 0;
  for (const o of allOrders) {
    const orderDate = o.date_created ? new Date(o.date_created) : new Date();
    const totalAmount = Number(o.total_amount ?? 0);

    // O Mercado Livre expõe taxas/comissão dentro de order_items[].sale_fee
    const items = o.order_items ?? [];
    const feeAmount = items.reduce((s: number, it: any) => s + Number(it.sale_fee ?? 0), 0);
    const shippingFee = Number(o.shipping?.cost ?? 0);
    const netAmount = totalAmount - feeAmount;

    await upsertOrderWithItems(account.storeId, "mercadolivre", {
      externalId: String(o.id),
      status: o.status || "unknown",
      orderDate,
      totalAmount,
      discountAmount: 0,
      shippingFee,
      feeAmount,
      netAmount,
      buyerUsername: o.buyer?.nickname || null,
      items: items.map((it: any) => ({
        externalItemId: it.item?.id ? String(it.item.id) : null,
        sku: it.item?.seller_sku || null,
        name: it.item?.title || `Item ${it.item?.id}`,
        quantity: Number(it.quantity ?? 1),
        unitPrice: Number(it.unit_price ?? 0),
      })),
    });
    ordersSynced++;
  }

  await prisma.marketplaceAccount.update({
    where: { id: account.id },
    data: { syncFrom: from, syncTo: now },
  });

  return { ordersSynced, productsSynced };
}
