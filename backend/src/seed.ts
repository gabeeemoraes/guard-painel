import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { env } from "./env";

async function main() {
  if (!env.adminEmail || !env.adminPassword || !env.secondaryUserEmail || !env.secondaryUserPassword) {
    throw new Error(
      "Preencha ADMIN_EMAIL, ADMIN_PASSWORD, SECONDARY_USER_EMAIL e SECONDARY_USER_PASSWORD no .env antes de rodar o seed. O Guard Painel usa exatamente dois usuários."
    );
  }

  const adminHash = await bcrypt.hash(env.adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: env.adminEmail },
    create: {
      name: env.adminName,
      email: env.adminEmail,
      passwordHash: adminHash,
      role: "ADMIN",
      active: true,
      permissions: JSON.stringify([
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
      ]),
    },
    update: { role: "ADMIN", active: true },
  });
  console.log(`Administrador criado/atualizado: ${admin.email}`);

  const userHash = await bcrypt.hash(env.secondaryUserPassword, 10);
  const secondary = await prisma.user.upsert({
    where: { email: env.secondaryUserEmail },
    create: {
      name: env.secondaryUserName,
      email: env.secondaryUserEmail,
      passwordHash: userHash,
      role: "USER",
      active: env.secondaryUserActive,
      permissions: JSON.stringify(["dashboard", "pedidos", "produtos"]),
    },
    update: { role: "USER" },
  });
  console.log(`Usuário comum criado/atualizado: ${secondary.email}`);

  // A instalação aceita somente estes dois usuários. Remove registros antigos/extras,
  // preservando os logs de auditoria de forma anônima.
  const extras = await prisma.user.findMany({
    where: { id: { notIn: [admin.id, secondary.id] } },
    select: { id: true },
  });
  if (extras.length) {
    const extraIds = extras.map((u) => u.id);
    await prisma.auditLog.updateMany({ where: { userId: { in: extraIds } }, data: { userId: null } });
    await prisma.user.deleteMany({ where: { id: { in: extraIds } } });
    console.log(`${extras.length} usuário(s) extra(s) removido(s) para manter a regra de dois usuários.`);
  }

  // Garante que a loja exista, mas sem nenhum dado dentro dela.
  const store = await prisma.store.findFirst();
  if (!store) {
    await prisma.store.create({ data: { name: "Minha Loja" } });
    console.log("Loja padrão criada, vazia (sem produtos, pedidos ou faturamento).");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
