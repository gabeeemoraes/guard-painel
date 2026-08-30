import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("publicidade"));

// A Shopee Open Platform expõe dados de anúncios apenas através da API de
// Marketing/Ads, que exige escopo adicional aprovado pela Shopee para o app
// do parceiro. Este endpoint lê exclusivamente da tabela AdvertisingData,
// que só é preenchida se/quando essa integração de anúncios for habilitada.
// Sem isso, a página mostra "Dado não disponível" — nunca dados inventados.
router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);

  const rows = await prisma.advertisingData.findMany({
    where: { storeId: store.id, date: { gte: range.from, lte: range.to }, ...(provider ? { provider } : {}) },
    orderBy: { date: "desc" },
  });

  if (rows.length === 0) {
    return res.json({ hasData: false, message: "Dado não disponível." });
  }

  const investimento = rows.reduce((s, r) => s + r.spend, 0);
  const receita = rows.reduce((s, r) => s + r.revenue, 0);
  const retorno = investimento > 0 ? receita / investimento : 0;

  res.json({
    hasData: true,
    investimento,
    receita,
    retorno,
    campanhas: rows.map((r) => ({
      id: r.campaignId,
      nome: r.campaignName,
      data: r.date,
      investimento: r.spend,
      receita: r.revenue,
      cliques: r.clicks,
      impressoes: r.impressions,
      pedidos: r.orders,
    })),
  });
});

export default router;
