import { prisma } from "../lib/prisma";
import { isMarketplaceProvider, MarketplaceProvider } from "../types/marketplace";

export interface DateRange {
  from: Date;
  to: Date;
}

// Lê o filtro de marketplace da query string. Ausente ou "all" = visão
// consolidada (todos os marketplaces juntos). Um provider específico = visão
// separada daquele marketplace apenas.
export function resolveProviderFromQuery(query: any): MarketplaceProvider | undefined {
  const raw = query.provider as string | undefined;
  if (!raw || raw === "all") return undefined;
  return isMarketplaceProvider(raw) ? raw : undefined;
}

export function resolveRangeFromQuery(query: any): DateRange {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  const preset = query.preset as string | undefined;
  if (preset === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (preset === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === "last7") {
    const f = new Date(now);
    f.setDate(f.getDate() - 6);
    return { from: startOfDay(f), to: endOfDay(now) };
  }
  if (preset === "last30") {
    const f = new Date(now);
    f.setDate(f.getDate() - 29);
    return { from: startOfDay(f), to: endOfDay(now) };
  }
  if (preset === "currentMonth") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  }
  if (preset === "lastMonth") {
    const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const t = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { from: f, to: t };
  }
  if (query.from && query.to) {
    return { from: new Date(query.from), to: new Date(query.to) };
  }
  // padrão: últimos 30 dias
  const f = new Date(now);
  f.setDate(f.getDate() - 29);
  return { from: startOfDay(f), to: endOfDay(now) };
}

export async function computeDashboard(storeId: string, range: DateRange, provider?: MarketplaceProvider) {
  const orders = await prisma.order.findMany({
    where: { storeId, orderDate: { gte: range.from, lte: range.to }, ...(provider ? { provider } : {}) },
    include: { items: true },
  });

  if (orders.length === 0) {
    return {
      hasData: false,
      grossRevenue: 0,
      netRevenue: 0,
      ordersCount: 0,
      productsCount: await prisma.product.count({ where: { storeId, ...(provider ? { provider } : {}) } }),
      averageTicket: 0,
      totalCosts: 0,
      totalFees: 0,
      totalDiscounts: 0,
      totalShipping: 0,
      profit: 0,
      margin: 0,
      cancellations: 0,
      returns: 0,
      adInvestment: 0,
      adReturn: 0,
      salesEvolution: [],
      profitEvolution: [],
      topProducts: [],
      worstProducts: [],
      lossProducts: [],
      lowMarginProducts: [],
      alerts: [],
    };
  }

  const grossRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
  const netRevenue = orders.reduce((s, o) => s + o.netAmount, 0);
  const totalFees = orders.reduce((s, o) => s + o.feeAmount, 0);
  const totalDiscounts = orders.reduce((s, o) => s + o.discountAmount, 0);
  const totalShipping = orders.reduce((s, o) => s + o.shippingFee, 0);
  const totalCosts = orders.reduce((s, o) => s + o.items.reduce((si, it) => si + it.totalCost, 0), 0);
  const profit = orders.reduce((s, o) => s + o.items.reduce((si, it) => si + it.profit, 0), 0);
  const margin = grossRevenue > 0 ? profit / grossRevenue : 0;
  const cancellations = orders.filter((o) => o.status === "CANCELLED").length;
  const returns = orders.filter((o) => o.status === "RETURNED" || o.status === "REFUNDED").length;

  const adAgg = await prisma.advertisingData.aggregate({
    where: { storeId, date: { gte: range.from, lte: range.to }, ...(provider ? { provider } : {}) },
    _sum: { spend: true, revenue: true },
  });
  const adInvestment = adAgg._sum.spend ?? 0;
  const adReturn = adAgg._sum.revenue ?? 0;

  // Evolução diária
  const byDay = new Map<string, { revenue: number; profit: number }>();
  for (const o of orders) {
    const key = o.orderDate.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { revenue: 0, profit: 0 };
    entry.revenue += o.totalAmount;
    entry.profit += o.items.reduce((s, it) => s + it.profit, 0);
    byDay.set(key, entry);
  }
  const sortedDays = Array.from(byDay.entries()).sort(([a], [b]) => a.localeCompare(b));
  const salesEvolution = sortedDays.map(([date, v]) => ({ date, value: v.revenue }));
  const profitEvolution = sortedDays.map(([date, v]) => ({ date, value: v.profit }));

  // Produtos: agregação a partir de OrderItem
  const productMap = new Map<
    string,
    { name: string; sku: string | null; revenue: number; quantity: number; profit: number; margin: number }
  >();
  for (const o of orders) {
    for (const it of o.items) {
      const key = it.productId ?? it.name;
      const entry = productMap.get(key) ?? {
        name: it.name,
        sku: it.sku,
        revenue: 0,
        quantity: 0,
        profit: 0,
        margin: 0,
      };
      entry.revenue += it.totalPrice;
      entry.quantity += it.quantity;
      entry.profit += it.profit;
      productMap.set(key, entry);
    }
  }
  const productArr = Array.from(productMap.values()).map((p) => ({
    ...p,
    margin: p.revenue > 0 ? p.profit / p.revenue : 0,
  }));

  const topProducts = [...productArr].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const worstProducts = [...productArr].sort((a, b) => a.revenue - b.revenue).slice(0, 5);
  const lossProducts = productArr.filter((p) => p.profit < 0);
  const lowMarginProducts = productArr.filter((p) => p.margin < 0.1 && p.margin >= 0);

  const alerts: string[] = [];
  if (lossProducts.length > 0) alerts.push(`${lossProducts.length} produto(s) com prejuízo no período.`);
  if (lowMarginProducts.length > 0) alerts.push(`${lowMarginProducts.length} produto(s) com margem abaixo de 10%.`);
  if (cancellations > 0) alerts.push(`${cancellations} pedido(s) cancelado(s) no período.`);

  return {
    hasData: true,
    grossRevenue,
    netRevenue,
    ordersCount: orders.length,
    productsCount: await prisma.product.count({ where: { storeId, ...(provider ? { provider } : {}) } }),
    averageTicket: orders.length > 0 ? grossRevenue / orders.length : 0,
    totalCosts,
    totalFees,
    totalDiscounts,
    totalShipping,
    profit,
    margin,
    cancellations,
    returns,
    adInvestment,
    adReturn,
    salesEvolution,
    profitEvolution,
    topProducts,
    worstProducts,
    lossProducts,
    lowMarginProducts,
    alerts,
  };
}

export async function computeAbcCurve(storeId: string, range: DateRange, provider?: MarketplaceProvider) {
  const items = await prisma.orderItem.findMany({
    where: {
      order: { storeId, orderDate: { gte: range.from, lte: range.to }, ...(provider ? { provider } : {}) },
    },
    include: { order: true },
  });

  if (items.length === 0) return { hasData: false, classes: [] as any[] };

  const byProduct = new Map<string, { name: string; sku: string | null; revenue: number; quantity: number }>();
  for (const it of items) {
    const key = it.productId ?? it.name;
    const entry = byProduct.get(key) ?? { name: it.name, sku: it.sku, revenue: 0, quantity: 0 };
    entry.revenue += it.totalPrice;
    entry.quantity += it.quantity;
    byProduct.set(key, entry);
  }

  const total = Array.from(byProduct.values()).reduce((s, p) => s + p.revenue, 0);
  const sorted = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);

  let cumulative = 0;
  const classified = sorted.map((p) => {
    cumulative += p.revenue;
    const cumulativePct = total > 0 ? cumulative / total : 0;
    const participation = total > 0 ? p.revenue / total : 0;
    let cls: "A" | "B" | "C" = "C";
    if (cumulativePct <= 0.8) cls = "A";
    else if (cumulativePct <= 0.95) cls = "B";
    return { ...p, participation, cumulativePct, class: cls };
  });

  return { hasData: true, classes: classified };
}

/**
 * Retorna os indicadores principais separados por marketplace, lado a lado
 * (para a aba "Separado" do dashboard) — um item por provider conectado, na
 * mesma janela de tempo.
 */
export async function computeByMarketplace(storeId: string, range: DateRange) {
  const providers: MarketplaceProvider[] = ["shopee", "mercadolivre", "tiktokshop"];

  const results = await Promise.all(
    providers.map(async (provider) => {
      const orders = await prisma.order.findMany({
        where: { storeId, provider, orderDate: { gte: range.from, lte: range.to } },
        include: { items: true },
      });

      const productsCount = await prisma.product.count({ where: { storeId, provider } });

      if (orders.length === 0) {
        return {
          provider,
          hasData: false,
          grossRevenue: 0,
          netRevenue: 0,
          ordersCount: 0,
          productsCount,
          profit: 0,
          margin: 0,
        };
      }

      const grossRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);
      const netRevenue = orders.reduce((s, o) => s + o.netAmount, 0);
      const profit = orders.reduce((s, o) => s + o.items.reduce((si, it) => si + it.profit, 0), 0);
      const margin = grossRevenue > 0 ? profit / grossRevenue : 0;

      return {
        provider,
        hasData: true,
        grossRevenue,
        netRevenue,
        ordersCount: orders.length,
        productsCount,
        profit,
        margin,
      };
    })
  );

  return results;
}

