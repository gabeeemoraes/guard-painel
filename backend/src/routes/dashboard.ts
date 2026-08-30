import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { computeDashboard, computeByMarketplace, resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";

const router = Router();
router.use(requireAuth, requirePermission("dashboard"));

// Visão consolidada (todos os marketplaces juntos) ou separada de UM provider,
// dependendo de ?provider= na query.
router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);
  const data = await computeDashboard(store.id, range, provider);
  res.json({ range, provider: provider ?? "all", ...data });
});

// Comparativo lado a lado dos 3 marketplaces (aba "Separado").
router.get("/by-marketplace", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const data = await computeByMarketplace(store.id, range);
  res.json({ range, marketplaces: data });
});

export default router;
