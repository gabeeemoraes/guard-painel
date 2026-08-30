import { prisma } from "../lib/prisma";
import { syncShopee } from "./syncShopee";
import { syncMercadoLivre } from "./syncMercadoLivre";
import { syncTiktokShop } from "./syncTiktokShop";
import { isMarketplaceProvider } from "../types/marketplace";

type ProgressCb = (step: string) => void;

/**
 * Executa uma sincronização completa para uma conta de marketplace já
 * conectada (Shopee, Mercado Livre ou TikTok Shop), delegando ao serviço
 * específico do provider. Não gera nenhum dado fictício — o que a API não
 * retornar, fica vazio/zero, e a interface mostra "Dado não disponível" /
 * "Sem dados disponíveis".
 */
export async function runFullSync(accountId: string, onProgress: ProgressCb) {
  const account = await prisma.marketplaceAccount.findUniqueOrThrow({ where: { id: accountId } });
  const history = await prisma.syncHistory.create({
    data: { storeId: account.storeId, status: "running", step: "iniciando" },
  });

  try {
    if (!isMarketplaceProvider(account.provider)) {
      throw new Error(`Marketplace desconhecido: ${account.provider}`);
    }

    let result: { ordersSynced: number; productsSynced: number };
    if (account.provider === "shopee") {
      result = await syncShopee(account, onProgress);
    } else if (account.provider === "mercadolivre") {
      result = await syncMercadoLivre(account, onProgress);
    } else {
      result = await syncTiktokShop(account, onProgress);
    }

    await prisma.marketplaceAccount.update({
      where: { id: accountId },
      data: {
        lastSyncAt: new Date(),
        lastSyncStatus: "success",
        syncedOrders: { increment: result.ordersSynced },
        syncedProducts: result.productsSynced,
        status: "connected",
      },
    });

    await prisma.syncHistory.update({
      where: { id: history.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        ordersSynced: result.ordersSynced,
        productsSynced: result.productsSynced,
        step: "concluído",
      },
    });

    onProgress("Sincronização concluída.");
    return result;
  } catch (err: any) {
    await prisma.syncHistory.update({
      where: { id: history.id },
      data: { status: "error", finishedAt: new Date(), errorMessage: String(err?.message ?? err) },
    });
    await prisma.marketplaceAccount
      .update({ where: { id: accountId }, data: { lastSyncStatus: "error" } })
      .catch(() => {});
    throw err;
  }
}
