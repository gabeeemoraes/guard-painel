import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env } from "./env";

import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import dashboardRoutes from "./routes/dashboard";
import faturamentoRoutes from "./routes/faturamento";
import pedidosRoutes from "./routes/pedidos";
import produtosRoutes from "./routes/produtos";
import curvaAbcRoutes from "./routes/curvaAbc";
import custosRoutes from "./routes/custos";
import financeiroRoutes from "./routes/financeiro";
import publicidadeRoutes from "./routes/publicidade";
import relatoriosRoutes from "./routes/relatorios";
import integrationsRoutes from "./routes/integrations";
import syncRoutes from "./routes/sync";
import settingsRoutes from "./routes/settings";

const app = express();

// Render usa proxy reverso e envia X-Forwarded-For.
app.set("trust proxy", 1);
app.disable("x-powered-by");

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Limita payloads JSON para reduzir abuso/memória excessiva.
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Limite de requisições para rotas de autenticação (proteção contra força bruta).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Muitas tentativas de login. Tente novamente em alguns minutos." },
});

app.use("/api/auth/login", authLimiter);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/faturamento", faturamentoRoutes);
app.use("/api/pedidos", pedidosRoutes);
app.use("/api/produtos", produtosRoutes);
app.use("/api/curva-abc", curvaAbcRoutes);
app.use("/api/custos", custosRoutes);
app.use("/api/financeiro", financeiroRoutes);
app.use("/api/publicidade", publicidadeRoutes);
app.use("/api/relatorios", relatoriosRoutes);
app.use("/api/integrations", integrationsRoutes);
app.use("/api/sync", syncRoutes);
app.use("/api/settings", settingsRoutes);

// 404 padronizado para evitar HTML do Express em chamadas da API.
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

// Tratamento centralizado de erros.
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Erro interno:", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Erro interno do servidor." });
  }
);

app.listen(env.port, () => {
  console.log(`GUARD PAINEL backend rodando na porta ${env.port}`);
});
