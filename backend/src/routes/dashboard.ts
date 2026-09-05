import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { computeDashboard, computeByMarketplace, resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("dashboard"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);
  const data = await computeDashboard(store.id, range, provider);
  res.json({ range, provider: provider ?? "all", ...data });
});

router.get("/by-marketplace", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const data = await computeByMarketplace(store.id, range);
  res.json({ range, marketplaces: data });
});

router.get("/recent-orders", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const orders = await prisma.order.findMany({ where: { storeId: store.id, orderDate: { gte: range.from, lte: range.to } }, orderBy: { orderDate: "desc" }, take: 5 });
  res.json({ orders: orders.map((o) => ({ id: o.externalId, provider: o.provider, status: o.status, value: o.totalAmount, date: o.orderDate })) });
});

export default router;
