import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("faturamento"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);

  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const pageSize = Math.min(200, Math.max(1, parseInt(String(req.query.pageSize ?? "20"), 10)));
  const search = String(req.query.search ?? "").trim();

  const where: any = {
    storeId: store.id,
    orderDate: { gte: range.from, lte: range.to },
    ...(provider ? { provider } : {}),
  };
  if (search) {
    where.OR = [
      { externalId: { contains: search } },
      { buyerUsername: { contains: search } },
    ];
  }

  const [orders, total, summary] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { items: true },
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: { items: true } }),
  ]);

  const rows = orders.flatMap((o) =>
    o.items.map((it) => ({
      orderId: o.externalId,
      date: o.orderDate,
      product: it.name,
      sku: it.sku,
      quantity: it.quantity,
      price: it.unitPrice,
      discount: it.discount,
      fees: o.items.length > 0 ? o.feeAmount / o.items.length : 0,
      shipping: o.items.length > 0 ? o.shippingFee / o.items.length : 0,
      cost: it.totalCost,
      profit: it.profit,
      margin: it.margin,
      status: o.status,
    }))
  );

  const bruto = summary.reduce((s, o) => s + o.totalAmount, 0);
  const liquido = summary.reduce((s, o) => s + o.netAmount, 0);
  const descontos = summary.reduce((s, o) => s + o.discountAmount, 0);
  const taxas = summary.reduce((s, o) => s + o.feeAmount, 0);
  const frete = summary.reduce((s, o) => s + o.shippingFee, 0);
  const custo = summary.reduce((s, o) => s + o.items.reduce((si, it) => si + it.totalCost, 0), 0);
  const lucro = summary.reduce((s, o) => s + o.items.reduce((si, it) => si + it.profit, 0), 0);
  const margem = bruto > 0 ? lucro / bruto : 0;

  res.json({
    hasData: total > 0,
    summary: { bruto, liquido, descontos, taxas, comissoes: taxas, frete, custo, lucro, margem },
    rows,
    pagination: { page, pageSize, total },
  });
});

export default router;
