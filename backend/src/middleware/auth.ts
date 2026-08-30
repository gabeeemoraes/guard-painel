import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { prisma } from "../lib/prisma";
import { runWithStoreUser } from "../services/store";

export interface AuthPayload {
  userId: string;
  role: "ADMIN" | "USER";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

export function signSession(payload: AuthPayload): string {
  return jwt.sign(payload, env.sessionSecret, { expiresIn: env.jwtExpiresIn as any });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.session;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : undefined;
  const token = cookieToken || bearerToken;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado. Faça login novamente." });
  }

  try {
    const payload = jwt.verify(token, env.sessionSecret) as AuthPayload;
    req.auth = payload;
    return runWithStoreUser(payload.userId, next);
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada." });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== "ADMIN") {
    return res.status(403).json({ error: "Apenas o administrador pode realizar esta ação." });
  }
  next();
}

// Verifica se o usuário comum tem permissão para acessar determinada página.
// Administrador sempre tem acesso total.
export function requirePermission(page: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ error: "Não autenticado." });
    if (req.auth.role === "ADMIN") return next();

    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user || !user.active) {
      return res.status(403).json({ error: "Usuário inativo ou não encontrado." });
    }
    const permissions: string[] = JSON.parse(user.permissions || "[]");
    if (!permissions.includes(page)) {
      return res.status(403).json({ error: `Sem permissão para acessar: ${page}.` });
    }
    next();
  };
}

export async function logAudit(userId: string | null, action: string, details?: string, ip?: string) {
  try {
    await prisma.auditLog.create({
      data: { userId: userId ?? undefined, action, details, ip },
    });
  } catch {
    // auditoria não deve derrubar a aplicação
  }
}
