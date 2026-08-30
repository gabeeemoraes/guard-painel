import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signSession, requireAuth, logAudit } from "../middleware/auth";
import { env } from "../env";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) {
    await logAudit(null, "login_failed", `email=${email}`, req.ip);
    return res.status(401).json({ error: "Credenciais inválidas ou usuário inativo." });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    await logAudit(user.id, "login_failed", "senha incorreta", req.ip);
    return res.status(401).json({ error: "Credenciais inválidas." });
  }

  const token = signSession({ userId: user.id, role: user.role as "ADMIN" | "USER" });
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 12 * 60 * 60 * 1000,
  });

  await logAudit(user.id, "login_success", undefined, req.ip);

  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: JSON.parse(user.permissions || "[]"),
    },
  });
});

router.post("/logout", requireAuth, async (req, res) => {
  await logAudit(req.auth!.userId, "logout", undefined, req.ip);
  res.clearCookie("session");
  res.json({ ok: true });
});

router.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
  if (!user || !user.active) {
    res.clearCookie("session");
    return res.status(401).json({ error: "Usuário não encontrado ou inativo." });
  }
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: JSON.parse(user.permissions || "[]"),
    },
  });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, "A nova senha deve ter ao menos 6 caracteres."),
});

router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  }
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.auth!.userId } });
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Senha atual incorreta." });

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newHash } });
  await logAudit(user.id, "password_changed", undefined, req.ip);
  res.json({ ok: true });
});

export default router;
