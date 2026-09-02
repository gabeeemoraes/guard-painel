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

// Render usa proxy reverso e envia X-Forwarded-For
app.set("trust proxy", 1);

app.use(
  cors({
    origin: env.frontendUrl,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Limite de requisições para rotas de autenticação (proteção contra força bruta)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
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

// Tratamento centralizado de erros
app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("Erro interno:", err);
    res.status(500).json({ error: "Erro interno do servidor." });
  }
);

app.listen(env.port, () => {
  console.log(
    `GUARD PAINEL backend rodando em http://localhost:${env.port}`
  );
  console.log(
    "Credenciais dos marketplaces podem ser configuradas em Integrações pelo administrador."
  );
});