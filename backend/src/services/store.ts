import { prisma } from "../lib/prisma";

// O sistema é single-tenant (uma loja Shopee por instalação). Este helper
// garante que sempre exista uma Store para associar contas, produtos, pedidos etc.
export async function getOrCreateDefaultStore() {
  const existing = await prisma.store.findFirst();
  if (existing) return existing;
  return prisma.store.create({ data: { name: "Minha Loja" } });
}
