import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { resolveRangeFromQuery, computeDashboard, computeAbcCurve } from "../services/calculations";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth, requirePermission("relatorios"));

function toCsv(rows: Record<string, any>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";"), ...rows.map((r) => headers.map((h) => escape(r[h])).join(";"))];
  return lines.join("\n");
}

router.get("/:type", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const format = String(req.query.format ?? "json");
  const type = req.params.type;

  let rows: Record<string, any>[] = [];
  let hasData = true;

  if (type === "vendas" || type === "faturamento") {
    const orders = await prisma.order.findMany({
      where: { storeId: store.id, orderDate: { gte: range.from, lte: range.to } },
      include: { items: true },
      orderBy: { orderDate: "desc" },
    });
    hasData = orders.length > 0;
    rows = orders.flatMap((o) =>
      o.items.map((it) => ({
        pedido: o.externalId,
        data: o.orderDate.toISOString().slice(0, 10),
        produto: it.name,
        sku: it.sku ?? "",
        quantidade: it.quantity,
        preco: it.unitPrice,
        custo: it.totalCost,
        lucro: it.profit,
        margem: (it.margin * 100).toFixed(2) + "%",
        status: o.status,
      }))
    );
  } else if (type === "produtos") {
    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      include: { cost: true, orderItems: true },
    });
    hasData = products.length > 0;
    rows = products.map((p) => {
      const revenue = p.orderItems.reduce((s, it) => s + it.totalPrice, 0);
      const cost = p.orderItems.reduce((s, it) => s + it.totalCost, 0);
      return {
        produto: p.name,
        sku: p.sku ?? "",
        preco: p.price,
        estoque: p.stock,
        faturamento: revenue,
        custo: cost,
        lucro: revenue - cost,
      };
    });
  } else if (type === "curva-abc") {
    const abc = await computeAbcCurve(store.id, range);
    hasData = abc.hasData;
    rows = abc.classes.map((c) => ({
      produto: c.name,
      sku: c.sku ?? "",
      classe: c.class,
      faturamento: c.revenue,
      quantidade: c.quantity,
      participacao: (c.participation * 100).toFixed(2) + "%",
    }));
  } else if (type === "lucro" || type === "margem") {
    const dash = await computeDashboard(store.id, range);
    hasData = dash.hasData;
    rows = dash.hasData
      ? dash.salesEvolution.map((s, i) => ({
          data: s.date,
          faturamento: s.value,
          lucro: dash.profitEvolution[i]?.value ?? 0,
        }))
      : [];
  } else if (type === "financeiro" || type === "conciliacao") {
    const orders = await prisma.order.findMany({
      where: { storeId: store.id, orderDate: { gte: range.from, lte: range.to } },
      include: { financialTx: true },
    });
    hasData = orders.length > 0;
    rows = orders.map((o) => ({
      pedido: o.externalId,
      venda: o.totalAmount,
      liquido: o.netAmount,
      taxas: o.feeAmount,
      frete: o.shippingFee,
      status: o.financialTx[0]?.status ?? "pending",
    }));
  } else if (type === "publicidade") {
    const ads = await prisma.advertisingData.findMany({
      where: { storeId: store.id, date: { gte: range.from, lte: range.to } },
    });
    hasData = ads.length > 0;
    rows = ads.map((a) => ({
      campanha: a.campaignName ?? a.campaignId ?? "",
      data: a.date.toISOString().slice(0, 10),
      investimento: a.spend,
      receita: a.revenue,
    }));
  } else {
    return res.status(400).json({ error: "Tipo de relatório inválido." });
  }

  if (!hasData) {
    if (format === "csv" || format === "excel") {
      return res.status(200).send("Sem dados disponíveis.");
    }
    return res.json({ hasData: false, rows: [] });
  }

  if (format === "csv" || format === "excel") {
    const csv = toCsv(rows);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-${type}.csv"`);
    return res.send(csv);
  }

  res.json({ hasData: true, rows });
});

export default router;
