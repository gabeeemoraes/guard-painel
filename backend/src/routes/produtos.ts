import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { resolveProviderFromQuery } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("produtos"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const provider = resolveProviderFromQuery(req.query);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
  const search = String(req.query.search ?? "").trim();

  const where: any = { storeId: store.id, ...(provider ? { provider } : {}) };
  if (search) where.OR = [{ name: { contains: search } }, { sku: { contains: search } }];

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { cost: true, orderItems: { include: { order: true } } },
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.product.count({ where }),
  ]);

  const now = Date.now();
  const rows = products.map((p) => {
    const sales = p.orderItems;
    const revenue = sales.reduce((s, it) => s + it.totalPrice, 0);
    const totalCost = sales.reduce((s, it) => s + it.totalCost, 0);
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? profit / revenue : 0;
    const totalQty = sales.reduce((s, it) => s + it.quantity, 0);
    const lastSale = sales.length
      ? sales.reduce((max, it) => (it.order.orderDate > max ? it.order.orderDate : max), sales[0].order.orderDate)
      : null;
    const daysSinceCreation = Math.max(1, Math.floor((now - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDailySales = totalQty / daysSinceCreation;
    const stockCoverageDays = avgDailySales > 0 ? p.stock / avgDailySales : null;

    const alerts: string[] = [];
    if (sales.length > 0 && margin < 0) alerts.push("prejuízo");
    if (sales.length > 0 && margin >= 0 && margin < 0.1) alerts.push("baixa_margem");
    if (!lastSale || now - lastSale.getTime() > 30 * 24 * 60 * 60 * 1000) alerts.push("produto_parado");
    if (p.stock <= 3) alerts.push("estoque_baixo");
    if (stockCoverageDays !== null && stockCoverageDays < 7) alerts.push("risco_ruptura");

    return {
      id: p.id,
      provider: p.provider,
      name: p.name,
      sku: p.sku,
      price: p.price,
      sales: totalQty,
      revenue,
      cost: totalCost,
      profit,
      margin,
      stock: p.stock,
      averageSales: Number(avgDailySales.toFixed(2)),
      lastSale,
      stockCoverageDays: stockCoverageDays !== null ? Math.round(stockCoverageDays) : null,
      hasCostConfigured: Boolean(p.cost),
      alerts,
    };
  });

  res.json({ hasData: total > 0, products: rows, pagination: { page, pageSize, total } });
});

export default router;
