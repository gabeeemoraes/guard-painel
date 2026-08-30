import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { requireAuth, requireAdmin, logAudit } from "../middleware/auth";

const router = Router();
router.use(requireAuth, requireAdmin);

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  res.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      permissions: JSON.parse(u.permissions || "[]"),
    })),
  });
});

const updateSchema = z.object({
  active: z.boolean().optional(),
  permissions: z.array(z.string()).optional(),
  name: z.string().min(1).optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });
  if (target.role === "ADMIN") {
    return res.status(403).json({ error: "Não é possível alterar o administrador por esta rota." });
  }

  const data: any = {};
  if (parsed.data.active !== undefined) data.active = parsed.data.active;
  if (parsed.data.permissions !== undefined) data.permissions = JSON.stringify(parsed.data.permissions);
  if (parsed.data.name !== undefined) data.name = parsed.data.name;

  const updated = await prisma.user.update({ where: { id: target.id }, data });
  await logAudit(req.auth!.userId, "user_updated", `target=${target.email}`, req.ip);

  res.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      active: updated.active,
      permissions: JSON.parse(updated.permissions || "[]"),
    },
  });
});

const resetPasswordSchema = z.object({ newPassword: z.string().min(6) });

router.post("/:id/reset-password", async (req, res) => {
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Senha deve ter ao menos 6 caracteres." });

  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target) return res.status(404).json({ error: "Usuário não encontrado." });

  const hash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: target.id }, data: { passwordHash: hash } });
  await logAudit(req.auth!.userId, "password_reset", `target=${target.email}`, req.ip);
  res.json({ ok: true });
});

export default router;
