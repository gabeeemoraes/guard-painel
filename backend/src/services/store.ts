import { AsyncLocalStorage } from "node:async_hooks";
import { prisma } from "../lib/prisma";

export const storeUserContext = new AsyncLocalStorage<string>();

export function runWithStoreUser(userId: string, next: () => void) {
  return storeUserContext.run(userId, next);
}

export async function getOrCreateDefaultStore(userId?: string) {
  const currentUserId = userId ?? storeUserContext.getStore();

  if (currentUserId) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { storeId: true },
    });

    if (!user) throw new Error("Usuário não encontrado.");

    if (user.storeId) {
      const existing = await prisma.store.findUnique({
        where: { id: user.storeId },
      });
      if (existing) return existing;
    }

    const store = await prisma.store.create({
      data: { name: "Minha Empresa" },
    });

    await prisma.user.update({
      where: { id: currentUserId },
      data: { storeId: store.id },
    });

    return store;
  }

  const existing = await prisma.store.findFirst();
  if (existing) return existing;

  return prisma.store.create({
    data: { name: "Minha Empresa" },
  });
}
