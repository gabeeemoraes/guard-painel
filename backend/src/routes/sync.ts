import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { prisma } from "../lib/prisma";
import { runFullSync } from "../services/syncService";
import { isMarketplaceProvider, MarketplaceProvider } from "../types/marketplace";

const router = Router();

// Sincronização com progresso em tempo real (Server-Sent Events).
// ?provider=shopee|mercadolivre|tiktokshop sincroniza só aquele marketplace.
// Sem o parâmetro, sincroniza todos os marketplaces conectados, em sequência.
router.get("/run", requireAuth, requireAdmin, async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const store = await getOrCreateDefaultStore();
    const providerParam = req.query.provider as string | undefined;

    let accounts;
    if (providerParam) {
      if (!isMarketplaceProvider(providerParam)) {
        send("error", { message: "Marketplace inválido." });
        return res.end();
      }
      accounts = await prisma.marketplaceAccount.findMany({
        where: { storeId: store.id, provider: providerParam, status: "connected" },
      });
    } else {
      accounts = await prisma.marketplaceAccount.findMany({
        where: { storeId: store.id, status: "connected" },
      });
    }

    if (accounts.length === 0) {
      send("error", { message: "Nenhum marketplace conectado. Conecte em Integrações." });
      return res.end();
    }

    let totalOrders = 0;
    let totalProducts = 0;

    for (const account of accounts) {
      const label = account.provider as MarketplaceProvider;
      send("progress", { step: `Iniciando sincronização: ${label}...` });
      const result = await runFullSync(account.id, (step) => send("progress", { step: `[${label}] ${step}` }));
      totalOrders += result.ordersSynced;
      totalProducts += result.productsSynced;
    }

    send("done", { ordersSynced: totalOrders, productsSynced: totalProducts });
  } catch (err: any) {
    send("error", { message: String(err?.message ?? err) });
  } finally {
    res.end();
  }
});

router.get("/history", requireAuth, async (_req, res) => {
  const store = await getOrCreateDefaultStore();
  const history = await prisma.syncHistory.findMany({
    where: { storeId: store.id },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  res.json({ history });
});

export default router;
