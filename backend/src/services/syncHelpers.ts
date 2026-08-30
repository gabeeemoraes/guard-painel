import { prisma } from "../lib/prisma";
import { MarketplaceProvider } from "../types/marketplace";

export interface NormalizedProduct {
  externalId: string;
  sku: string | null;
  name: string;
  price: number;
  stock: number;
  imageUrl: string | null;
  status: string;
}

export async function upsertProduct(storeId: string, provider: MarketplaceProvider, p: NormalizedProduct) {
  return prisma.product.upsert({
    where: { storeId_provider_externalId: { storeId, provider, externalId: p.externalId } },
    create: { storeId, provider, ...p },
    update: { ...p, lastSyncedAt: new Date() },
  });
}

export interface NormalizedOrderItem {
  externalItemId: string | null; // usado para vincular ao Product.externalId já sincronizado
  sku: string | null;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface NormalizedOrder {
  externalId: string;
  status: string;
  orderDate: Date;
  totalAmount: number;
  discountAmount: number;
  shippingFee: number;
  feeAmount: number;
  netAmount: number;
  buyerUsername: string | null;
  items: NormalizedOrderItem[];
}

/**
 * Grava um pedido normalizado (independente da origem) e recalcula
 * custo/lucro/margem de cada item a partir da tabela Cost já cadastrada
 * para o produto correspondente.
 */
export async function upsertOrderWithItems(storeId: string, provider: MarketplaceProvider, o: NormalizedOrder) {
  const order = await prisma.order.upsert({
    where: { storeId_provider_externalId: { storeId, provider, externalId: o.externalId } },
    create: {
      storeId,
      provider,
      externalId: o.externalId,
      status: o.status,
      orderDate: o.orderDate,
      totalAmount: o.totalAmount,
      discountAmount: o.discountAmount,
      shippingFee: o.shippingFee,
      feeAmount: o.feeAmount,
      netAmount: o.netAmount,
      buyerUsername: o.buyerUsername,
    },
    update: {
      status: o.status,
      totalAmount: o.totalAmount,
      discountAmount: o.discountAmount,
      shippingFee: o.shippingFee,
      feeAmount: o.feeAmount,
      netAmount: o.netAmount,
      buyerUsername: o.buyerUsername,
    },
  });

  await prisma.orderItem.deleteMany({ where: { orderId: order.id } });

  for (const it of o.items) {
    let product = null;
    if (it.externalItemId) {
      product = await prisma.product.findUnique({
        where: { storeId_provider_externalId: { storeId, provider, externalId: it.externalItemId } },
        include: { cost: true },
      });
    }
    const unitCost = product?.cost
      ? product.cost.productCost + product.cost.packagingCost + product.cost.taxCost + product.cost.otherCost
      : 0;
    const totalPrice = it.unitPrice * it.quantity;
    const totalCost = unitCost * it.quantity;
    const profit = totalPrice - totalCost;
    const margin = totalPrice > 0 ? profit / totalPrice : 0;

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        productId: product?.id ?? null,
        sku: it.sku ?? product?.sku ?? null,
        name: it.name,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discount: 0,
        totalPrice,
        unitCost,
        totalCost,
        profit,
        margin,
      },
    });
  }

  await prisma.financialTransaction.deleteMany({ where: { orderId: order.id } });
  await prisma.financialTransaction.create({
    data: {
      storeId,
      orderId: order.id,
      type: "sale",
      description: `Venda ${o.externalId}`,
      grossAmount: o.totalAmount,
      feeAmount: o.feeAmount,
      netAmount: o.netAmount,
      status: "completed",
      occurredAt: o.orderDate,
    },
  });

  return order;
}
