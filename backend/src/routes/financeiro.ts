import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("financeiro"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);

  const tx = await prisma.financialTransaction.findMany({
    where: {
      storeId: store.id,
      occurredAt: { gte: range.from, lte: range.to },
      ...(provider ? { order: { provider } } : {}),
    },
    include: { order: true },
  });

  if (tx.length === 0) {
    return res.json({
      hasData: false,
      totalVendido: 0,
      totalRecebido: 0,
      pendente: 0,
      taxas: 0,
      comissoes: 0,
      descontos: 0,
      frete: 0,
      devolucoes: 0,
      ajustes: 0,
      repasses: 0,
      divergencias: 0,
    });
  }

  const totalVendido = tx.reduce((s, t) => s + t.grossAmount, 0);
  const totalRecebido = tx.filter((t) => t.status === "completed").reduce((s, t) => s + t.netAmount, 0);
  const pendente = tx.filter((t) => t.status === "pending").reduce((s, t) => s + t.netAmount, 0);
  const taxas = tx.reduce((s, t) => s + t.feeAmount, 0);
  const divergencias = tx.filter((t) => t.status === "divergent").length;

  res.json({
    hasData: true,
    totalVendido,
    totalRecebido,
    pendente,
    taxas,
    comissoes: taxas,
    descontos: tx.reduce((s, t) => s + (t.order?.discountAmount ?? 0), 0),
    frete: tx.reduce((s, t) => s + (t.order?.shippingFee ?? 0), 0),
    devolucoes: tx.filter((t) => t.type === "refund").length,
    ajustes: tx.filter((t) => t.type === "adjustment").length,
    repasses: tx.filter((t) => t.type === "payout").length,
    divergencias,
  });
});

router.get("/conciliacao", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);

  const orders = await prisma.order.findMany({
    where: { storeId: store.id, orderDate: { gte: range.from, lte: range.to }, ...(provider ? { provider } : {}) },
    include: { financialTx: true },
    orderBy: { orderDate: "desc" },
    take: 500,
  });

  const rows = orders.map((o) => {
    const tx = o.financialTx[0];
    const valorPago = tx?.netAmount ?? null;
    const diferenca = valorPago !== null ? o.netAmount - valorPago : null;
    let status: "conciliado" | "divergente" | "pendente" = "pendente";
    if (tx?.status === "completed") status = diferenca !== null && Math.abs(diferenca) < 0.01 ? "conciliado" : "divergente";

    return {
      orderId: o.externalId,
      venda: o.totalAmount,
      valorPago,
      taxas: o.feeAmount,
      comissoes: o.feeAmount,
      descontos: o.discountAmount,
      frete: o.shippingFee,
      ajustes: 0,
      valorLiquido: o.netAmount,
      valorRecebido: valorPago,
      diferenca,
      status,
    };
  });

  res.json({ hasData: rows.length > 0, rows });
});

export default router;
