import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { countsAsSale, resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";
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
    o.items.map((it) => {
      const validSale = countsAsSale(o.status);
      const itemsTotal = o.items.reduce((sum, item) => sum + item.totalPrice, 0);
      const itemNet = validSale && itemsTotal > 0 ? o.netAmount * (it.totalPrice / itemsTotal) : 0;
      const itemProfit = validSale ? itemNet - it.totalCost : 0;
      return {
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
      profit: itemProfit,
      margin: validSale && it.totalPrice > 0 ? itemProfit / it.totalPrice : 0,
      status: o.status,
    };})
  );

  const sales = summary.filter((o) => countsAsSale(o.status));
  const bruto = sales.reduce((s, o) => s + o.totalAmount, 0);
  const liquido = sales.reduce((s, o) => s + o.netAmount, 0);
  const descontos = sales.reduce((s, o) => s + o.discountAmount, 0);
  const taxas = sales.reduce((s, o) => s + o.feeAmount, 0);
  const frete = sales.reduce((s, o) => s + o.shippingFee, 0);
  const custo = sales.reduce((s, o) => s + o.items.reduce((si, it) => si + it.totalCost, 0), 0);
  const lucro = liquido - custo;
  const margem = bruto > 0 ? lucro / bruto : 0;

  res.json({
    hasData: total > 0,
    summary: { bruto, liquido, descontos, taxas, comissoes: taxas, frete, custo, lucro, margem },
    rows,
    pagination: { page, pageSize, total },
  });
});

export default router;
