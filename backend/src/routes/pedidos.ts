import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("pedidos"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
  const search = String(req.query.search ?? "").trim();
  const status = String(req.query.status ?? "").trim();

  const where: any = {
    storeId: store.id,
    orderDate: { gte: range.from, lte: range.to },
    ...(provider ? { provider } : {}),
  };
  if (search) where.OR = [{ externalId: { contains: search } }, { buyerUsername: { contains: search } }];
  if (status) where.status = status;

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  res.json({
    hasData: total > 0,
    orders: orders.map((o) => ({
      id: o.externalId,
      provider: o.provider,
      date: o.orderDate,
      status: o.status,
      products: o.items.map((it) => ({ name: it.name, sku: it.sku, quantity: it.quantity })),
      value: o.totalAmount,
      discount: o.discountAmount,
      fees: o.feeAmount,
      shipping: o.shippingFee,
      netValue: o.netAmount,
    })),
    pagination: { page, pageSize, total },
  });
});

router.get("/:id", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const order = await prisma.order.findFirst({
    where: { storeId: store.id, externalId: req.params.id },
    include: { items: true, financialTx: true },
  });
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  res.json({ order });
});

export default router;
