import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { env } from "./env";

const ALL_PERMISSIONS = [
  "dashboard",
  "faturamento",
  "pedidos",
  "produtos",
  "financeiro",
  "publicidade",
  "curva-abc",
  "custos",
  "relatorios",
  "integracoes",
  "configuracoes",
];

async function main() {
  if (!env.adminEmail || !env.adminPassword || !env.secondaryUserEmail || !env.secondaryUserPassword) {
    throw new Error(
      "Preencha ADMIN_EMAIL, ADMIN_PASSWORD, SECONDARY_USER_EMAIL e SECONDARY_USER_PASSWORD no Render."
    );
  }

  const permissions = JSON.stringify(ALL_PERMISSIONS);

  // Senhas de ambiente são usadas somente na criação. Um deploy nunca deve
  // sobrescrever uma senha que o usuário já alterou dentro do painel.
  const admin = await prisma.user.upsert({
    where: { email: env.adminEmail },
    create: {
      name: env.adminName,
      email: env.adminEmail,
      passwordHash: await bcrypt.hash(env.adminPassword, 10),
      role: "ADMIN",
      active: true,
      permissions,
    },
    update: {
      name: env.adminName,
      role: "ADMIN",
      active: true,
      permissions,
    },
  });

  const secondary = await prisma.user.upsert({
    where: { email: env.secondaryUserEmail },
    create: {
      name: env.secondaryUserName,
      email: env.secondaryUserEmail,
      passwordHash: await bcrypt.hash(env.secondaryUserPassword, 10),
      role: "USER",
      active: env.secondaryUserActive,
      permissions,
    },
    update: {
      name: env.secondaryUserName,
      role: "USER",
      active: env.secondaryUserActive,
      permissions,
    },
  });

  let adminStore = admin.storeId
    ? await prisma.store.findUnique({ where: { id: admin.storeId } })
    : null;

  if (!adminStore) adminStore = await prisma.store.findFirst();

  if (!adminStore) {
    adminStore = await prisma.store.create({
      data: { name: `${admin.name} - Empresa` },
    });
  }

  await prisma.user.update({
    where: { id: admin.id },
    data: { storeId: adminStore.id, permissions },
  });

  let secondaryStore = secondary.storeId
    ? await prisma.store.findUnique({ where: { id: secondary.storeId } })
    : null;

  if (!secondaryStore || secondaryStore.id === adminStore.id) {
    secondaryStore = await prisma.store.findFirst({
      where: { id: { not: adminStore.id } },
    });
  }

  if (!secondaryStore) {
    secondaryStore = await prisma.store.create({
      data: { name: `${secondary.name} - Empresa` },
    });
  }

  await prisma.user.update({
    where: { id: secondary.id },
    data: { storeId: secondaryStore.id, permissions },
  });

  console.log("Seed concluído: usuários e empresas verificados.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
