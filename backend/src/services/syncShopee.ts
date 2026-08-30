import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import * as shopee from "./shopeeClient";
import { upsertProduct, upsertOrderWithItems } from "./syncHelpers";
import { getMarketplaceAppCredentials } from "./appCredentials";

type ProgressCb = (step: string) => void;
type MarketplaceAccount = Awaited<ReturnType<typeof prisma.marketplaceAccount.findUniqueOrThrow>>;

async function getValidAccessToken(account: MarketplaceAccount): Promise<{ accessToken: string; shopId: string; app: shopee.ShopeeAppCredentials }> {
  const appCreds = await getMarketplaceAppCredentials("shopee");
  if (!appCreds) throw new Error("Credenciais da Shopee não configuradas em Integrações.");
  const app = { partnerId: appCreds.identifier, partnerKey: appCreds.secret };
  const credentials = await prisma.credential.findUnique({ where: { marketplaceAccountId: account.id } });
  if (!credentials) {
    throw new Error("Loja Shopee não conectada. Conecte em Integrações → Shopee.");
  }

  const isExpiring = credentials.expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
  if (isExpiring) {
    const refreshToken = decryptSecret(credentials.refreshTokenEnc);
    const refreshed = await shopee.refreshAccessToken(app, refreshToken, account.shopId);
    if (!refreshed.access_token) {
      throw new Error(
        `Falha ao renovar token da Shopee: ${refreshed.message || "erro desconhecido"}. Reconecte a loja.`
      );
    }
    await prisma.credential.update({
      where: { marketplaceAccountId: account.id },
      data: {
        accessTokenEnc: encryptSecret(refreshed.access_token),
        refreshTokenEnc: encryptSecret(refreshed.refresh_token),
        expiresAt: new Date(Date.now() + refreshed.expire_in * 1000),
      },
    });
    return { accessToken: refreshed.access_token, shopId: account.shopId, app };
  }

  return { accessToken: decryptSecret(credentials.accessTokenEnc), shopId: account.shopId, app };
}

export async function syncShopee(account: MarketplaceAccount, onProgress: ProgressCb) {
  onProgress("Conectando...");
  const { accessToken, shopId, app } = await getValidAccessToken(account);

  const shopInfo = await shopee.getShopInfo(app, accessToken, shopId);
  if (shopInfo?.shop_name) {
    await prisma.marketplaceAccount.update({
      where: { id: account.id },
      data: { shopName: shopInfo.shop_name, status: "connected" },
    });
  }

  onProgress("Processando produtos...");
  let productsSynced = 0;
  let offset = 0;
  const pageSize = 50;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const itemListRes = await shopee.getItemList(app, accessToken, shopId, { offset, pageSize });
    const items = itemListRes?.response?.item ?? [];
    if (items.length === 0) break;

    const itemIds: number[] = items.map((i: any) => i.item_id);
    const baseInfoRes = await shopee.getItemBaseInfo(app, accessToken, shopId, itemIds);
    const baseItems = baseInfoRes?.response?.item_list ?? [];

    for (const item of baseItems) {
      const price = item?.price_info?.[0]?.current_price ?? item?.price_info?.[0]?.original_price ?? 0;
      const stock = item?.stock_info_v2?.summary_info?.total_available_stock ?? item?.stock_info?.[0]?.current_stock ?? 0;

      await upsertProduct(account.storeId, "shopee", {
        externalId: String(item.item_id),
        sku: item.item_sku || null,
        name: item.item_name || `Produto ${item.item_id}`,
        price,
        stock,
        imageUrl: item?.image?.image_url_list?.[0] || null,
        status: item.item_status || "ACTIVE",
      });
      productsSynced++;
    }

    if (!itemListRes?.response?.has_next_page) break;
    offset += pageSize;
  }

  onProgress("Buscando pedidos...");
  const timeTo = Math.floor(Date.now() / 1000);
  const timeFrom = timeTo - 90 * 24 * 60 * 60;

  let cursor = "";
  const allOrderSns: string[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const listRes = await shopee.getOrderList(app, accessToken, shopId, { timeFrom, timeTo, cursor });
    const orderList = listRes?.response?.order_list ?? [];
    for (const o of orderList) allOrderSns.push(o.order_sn);
    if (!listRes?.response?.more) break;
    cursor = listRes?.response?.next_cursor;
    if (!cursor) break;
  }

  onProgress("Processando financeiro...");
  let ordersSynced = 0;
  for (let i = 0; i < allOrderSns.length; i += 50) {
    const batch = allOrderSns.slice(i, i + 50);
    const detailRes = await shopee.getOrderDetail(app, accessToken, shopId, batch);
    const orders = detailRes?.response?.order_list ?? [];

    for (const o of orders) {
      const orderDate = new Date((o.create_time ?? Math.floor(Date.now() / 1000)) * 1000);
      const totalAmount = Number(o.total_amount ?? 0);

      let escrow: any = null;
      try {
        const escrowRes = await shopee.getEscrowDetail(app, accessToken, shopId, o.order_sn);
        escrow = escrowRes?.response ?? null;
      } catch {
        escrow = null;
      }

      const income = escrow?.order_income;
      const feeAmount = income
        ? Number(income.commission_fee ?? 0) + Number(income.service_fee ?? 0) + Number(income.seller_transaction_fee ?? 0)
        : 0;
      const shippingFee = income ? Number(income.actual_shipping_fee ?? income.shipping_fee ?? 0) : 0;
      const discountAmount = income ? Number(income.seller_discount ?? 0) : 0;
      const netAmount = income ? Number(income.escrow_amount ?? totalAmount - feeAmount) : totalAmount;

      const itemList = o.item_list ?? [];
      await upsertOrderWithItems(account.storeId, "shopee", {
        externalId: o.order_sn,
        status: o.order_status || "UNKNOWN",
        orderDate,
        totalAmount,
        discountAmount,
        shippingFee,
        feeAmount,
        netAmount,
        buyerUsername: o.buyer_username || null,
        items: itemList.map((it: any) => ({
          externalItemId: it.item_id ? String(it.item_id) : null,
          sku: it.item_sku || null,
          name: it.item_name || `Item ${it.item_id}`,
          quantity: Number(it.model_quantity_purchased ?? it.quantity_purchased ?? 1),
          unitPrice: Number(it.model_discounted_price ?? it.model_original_price ?? 0),
        })),
      });
      ordersSynced++;
    }
  }

  await prisma.marketplaceAccount.update({
    where: { id: account.id },
    data: { syncFrom: new Date(timeFrom * 1000), syncTo: new Date(timeTo * 1000) },
  });

  return { ordersSynced, productsSynced };
}
