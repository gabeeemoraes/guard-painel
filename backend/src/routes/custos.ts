import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermission, logAudit } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("custos"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const search = String(req.query.search ?? "").trim();
  const where: any = { storeId: store.id };
  if (search) where.OR = [{ name: { contains: search } }, { sku: { contains: search } }];

  const products = await prisma.product.findMany({ where, include: { cost: true }, orderBy: { name: "asc" } });
  res.json({
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      cost: p.cost
        ? {
            productCost: p.cost.productCost,
            packagingCost: p.cost.packagingCost,
            taxCost: p.cost.taxCost,
            otherCost: p.cost.otherCost,
            total: p.cost.productCost + p.cost.packagingCost + p.cost.taxCost + p.cost.otherCost,
          }
        : null,
    })),
  });
});

const costSchema = z.object({
  productCost: z.number().min(0),
  packagingCost: z.number().min(0),
  taxCost: z.number().min(0),
  otherCost: z.number().min(0),
});

router.put("/:productId", async (req, res) => {
  const parsed = costSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Valores de custo inválidos." });

  const store = await getOrCreateDefaultStore();
  const product = await prisma.product.findFirst({ where: { id: req.params.productId, storeId: store.id } });
  if (!product) return res.status(404).json({ error: "Produto não encontrado." });

  const cost = await prisma.cost.upsert({
    where: { productId: product.id },
    create: { storeId: store.id, productId: product.id, ...parsed.data },
    update: parsed.data,
  });

  // Recalcula lucro/margem dos itens de pedido já sincronizados para este produto
  const unitCost = cost.productCost + cost.packagingCost + cost.taxCost + cost.otherCost;
  const items = await prisma.orderItem.findMany({ where: { productId: product.id } });
  for (const it of items) {
    const totalCost = unitCost * it.quantity;
    const profit = it.totalPrice - totalCost;
    const margin = it.totalPrice > 0 ? profit / it.totalPrice : 0;
    await prisma.orderItem.update({ where: { id: it.id }, data: { unitCost, totalCost, profit, margin } });
  }

  await logAudit(req.auth!.userId, "cost_updated", `product=${product.name}`, req.ip);
  res.json({ ok: true });
});

export default router;
