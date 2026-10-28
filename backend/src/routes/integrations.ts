import { Router } from "express";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { requireAuth, requirePermission, logAudit } from "../middleware/auth";
import { getOrCreateDefaultStore, storeUserContext } from "../services/store";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { encryptSecret } from "../lib/crypto";
import { isMarketplaceProvider, MarketplaceProvider, PROVIDER_LABELS } from "../types/marketplace";
import { getMarketplaceAppCredentials, saveMarketplaceAppCredentials, marketplaceCredentialLabels, connectionReady } from "../services/appCredentials";
import * as shopee from "../services/shopeeClient";
import * as meli from "../services/mercadoLivreClient";
import * as tiktok from "../services/tiktokShopClient";

import { getValidAccessToken as shopeeAccess } from "../services/syncShopee";
import { getValidAccessToken as meliAccess } from "../services/syncMercadoLivre";
import { getValidAccessToken as tiktokAccess } from "../services/syncTiktokShop";

const router = Router();

function oauthCookieName(provider: MarketplaceProvider) {
  return `guard_oauth_${provider}`;
}

function setOAuthState(req: any, res: any, provider: MarketplaceProvider) {
  const state = jwt.sign(
    { userId: req.auth!.userId, provider, nonce: randomBytes(16).toString("hex") },
    env.sessionSecret,
    { expiresIn: "10m" }
  );
  res.cookie(oauthCookieName(provider), state, {
    httpOnly: true,
    secure: env.frontendUrl.startsWith("https://"),
    sameSite: "lax",
    maxAge: 10 * 60 * 1000,
  });
  return state;
}

router.param("provider", (req, res, next, value) => {
  if (!isMarketplaceProvider(value)) return res.status(404).json({ error: "Marketplace inválido." });
  next();
});

async function configured(provider: MarketplaceProvider) {
  return connectionReady(provider, await getMarketplaceAppCredentials(provider));
}

router.get("/", requireAuth, requirePermission("integracoes"), async (_req, res) => {
  const store = await getOrCreateDefaultStore();
  const accounts = await prisma.marketplaceAccount.findMany({ where: { storeId: store.id } });
  const providers: MarketplaceProvider[] = ["shopee", "mercadolivre", "tiktokshop"];

  res.json({
    marketplaces: await Promise.all(
      providers.map(async (provider) => {
        const account = accounts.find((a) => a.provider === provider);
        return {
          provider,
          label: PROVIDER_LABELS[provider],
          configured: await configured(provider),
          connected: account?.status === "connected",
          shopName: account?.shopName ?? null,
          lastSyncAt: account?.lastSyncAt ?? null,
        };
      })
    ),
  });
});

router.get("/:provider/status", requireAuth, requirePermission("integracoes"), async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const store = await getOrCreateDefaultStore();
  const account = await prisma.marketplaceAccount.findFirst({
    where: { storeId: store.id, provider },
  });
  const isConfigured = await configured(provider);

  if (!account) {
    return res.json({
      connected: false,
      configured: isConfigured,
      provider,
      label: PROVIDER_LABELS[provider],
    });
  }

  res.json({
    connected: account.status === "connected",
    configured: isConfigured,
    provider,
    label: PROVIDER_LABELS[provider],
    shopId: account.shopId,
    shopName: account.shopName,
    status: account.status,
    lastSyncAt: account.lastSyncAt,
    syncedOrders: account.syncedOrders,
    syncedProducts: account.syncedProducts,
    syncFrom: account.syncFrom,
    syncTo: account.syncTo,
  });
});

router.get("/:provider/app-credentials", requireAuth, requirePermission("integracoes"), async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const creds = await getMarketplaceAppCredentials(provider);
  const labels = marketplaceCredentialLabels(provider);
  res.json({
    configured: connectionReady(provider, creds),
    environment: creds?.environment ?? "live",
    serviceId: creds?.serviceId ?? "",
    source: creds?.source ?? null,
    identifier: creds?.identifier ?? "",
    secretSaved: Boolean(creds?.secret),
    labels,
    redirectUri: `${env.backendPublicUrl}/api/integrations/${provider}/callback`,
  });
});

const appCredentialSchema = z.object({
  identifier: z.string().trim().min(1).max(200),
  secret: z.string().max(4096).optional(),
  environment: z.enum(["live", "test"]).optional(),
  serviceId: z.string().trim().max(200).optional(),
});

router.put("/:provider/app-credentials", requireAuth, requirePermission("integracoes"), async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const parsed = appCredentialSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Preencha o identificador e a credencial secreta." });
  }

  const current = await getMarketplaceAppCredentials(provider);
  const secret = parsed.data.secret?.trim() || current?.secret || "";
  if (!secret) {
    return res
      .status(400)
      .json({ error: `Preencha ${marketplaceCredentialLabels(provider).secret}.` });
  }

  const identifier = parsed.data.identifier.trim();
  if (provider !== "tiktokshop" && !/^\d+$/.test(identifier)) return res.status(400).json({ error: "O identificador deve conter apenas números." });
  if (current && identifier !== current.identifier && !parsed.data.secret?.trim()) return res.status(400).json({ error: "Ao trocar o identificador, informe também a nova chave secreta." });
  const options = { environment: parsed.data.environment ?? current?.environment ?? "live" as const, serviceId: parsed.data.serviceId ?? current?.serviceId ?? "" };
  if (provider === "tiktokshop" && !options.serviceId) return res.status(400).json({ error: "Preencha o Service ID exibido no link de autorização do TikTok Shop." });
  const changed = !current || current.identifier !== identifier || current.secret !== secret || current.environment !== options.environment || current.serviceId !== options.serviceId;

  await saveMarketplaceAppCredentials(provider, identifier, secret, options);

  if (changed) {
    const store = await getOrCreateDefaultStore();
    const account = await prisma.marketplaceAccount.findFirst({
      where: { storeId: store.id, provider },
    });
    if (account) {
      await prisma.credential.deleteMany({ where: { marketplaceAccountId: account.id } });
      await prisma.marketplaceAccount.update({
        where: { id: account.id },
        data: { status: "disconnected" },
      });
    }
  }

  await logAudit(
    req.auth!.userId,
    `${provider}_app_credentials_updated`,
    changed ? "oauth_reconnect_required" : "unchanged",
    req.ip
  );

  res.json({ ok: true, reconnectRequired: changed });
});

router.get("/:provider/connect-url", requireAuth, requirePermission("integracoes"), async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const c = await getMarketplaceAppCredentials(provider);
  if (!connectionReady(provider, c)) {
    return res.status(400).json({
      error: `Configure as credenciais de ${PROVIDER_LABELS[provider]} na própria tela de Integrações.`,
    });
  }

  if (!c) return res.status(400).json({ error: "Credenciais não configuradas." });
  const redirectUrl = `${env.backendPublicUrl}/api/integrations/${provider}/callback`;
  const state = setOAuthState(req, res, provider);
  let url = "";

  if (provider === "shopee") {
    url = shopee.buildAuthUrl(
      { partnerId: c.identifier, partnerKey: c.secret, environment: c.environment },
      redirectUrl, state
    );
  } else if (provider === "mercadolivre") {
    const codeVerifier = randomBytes(32).toString("base64url");
    res.cookie("guard_oauth_meli_verifier", codeVerifier, {
      httpOnly: true,
      secure: env.frontendUrl.startsWith("https://"),
      sameSite: "lax",
      maxAge: 10 * 60 * 1000,
    });
    url = meli.buildAuthUrl(
      { clientId: c.identifier, clientSecret: c.secret },
      redirectUrl,
      state,
      codeVerifier
    );
  } else {
    url = tiktok.buildAuthUrl({ appKey: c.identifier, appSecret: c.secret, serviceId: c.serviceId, environment: c.environment }, state);
  }

  return res.json({ url });
});

router.get("/:provider/callback", async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const cookieOptions = { httpOnly: true, secure: env.frontendUrl.startsWith("https://"), sameSite: "lax" as const };
  res.clearCookie(oauthCookieName(provider), cookieOptions);
  if (provider === "mercadolivre") res.clearCookie("guard_oauth_meli_verifier", cookieOptions);
  try {
    const oauthToken = req.cookies?.[oauthCookieName(provider)];
    if (!oauthToken) throw new Error("Sessão de conexão expirada. Inicie a conexão novamente.");
    const payload = jwt.verify(oauthToken, env.sessionSecret) as { userId?: string; provider?: string };
    if (!payload.userId || payload.provider !== provider || req.query.state !== oauthToken) throw new Error("Estado OAuth inválido.");
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.active) throw new Error("Usuário inativo ou não encontrado.");
    if (user.role !== "ADMIN" && !JSON.parse(user.permissions || "[]").includes("integracoes")) throw new Error("Sem permissão para gerenciar integrações.");
    if (typeof req.query.error === "string") throw new Error("Autorização recusada no marketplace. Inicie a conexão novamente.");
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) throw new Error("Código de autorização ausente. Inicie a conexão novamente.");

    return await storeUserContext.run(payload.userId, async () => {
      const store = await getOrCreateDefaultStore(payload.userId);
      const c = await getMarketplaceAppCredentials(provider);
      if (!c || !connectionReady(provider, c)) throw new Error("Credenciais do marketplace incompletas. Confira Integrações.");
      let accessToken: string;
      let refreshToken: string;
      let expiresAt: Date;
      let shop: { shopId: string; shopCipher?: string; shopName?: string; region?: string };
      if (provider === "shopee") {
        const shopId = typeof req.query.shop_id === "string" ? req.query.shop_id : "";
        if (!/^\d+$/.test(shopId)) throw new Error("Identificador da loja Shopee ausente ou inválido.");
        const app = { partnerId: c.identifier, partnerKey: c.secret, environment: c.environment };
        const token = await shopee.exchangeCodeForToken(app, code, shopId);
        accessToken = token.access_token; refreshToken = token.refresh_token;
        expiresAt = new Date(Date.now() + token.expire_in * 1000);
        const info = await shopee.getShopInfo(app, accessToken, shopId);
        shop = { shopId, shopName: info?.response?.shop_name || info?.shop_name };
      } else if (provider === "mercadolivre") {
        const verifier = req.cookies?.guard_oauth_meli_verifier;
        if (!verifier) throw new Error("Sessão PKCE expirada. Inicie a conexão novamente.");
        const redirectUri = `${env.backendPublicUrl}/api/integrations/${provider}/callback`;
        const token = await meli.exchangeCodeForToken({ clientId: c.identifier, clientSecret: c.secret }, code, redirectUri, verifier);
        accessToken = token.access_token; refreshToken = token.refresh_token;
        expiresAt = new Date(Date.now() + token.expires_in * 1000);
        const me = await meli.getMe(accessToken);
        if (String(me.id) !== String(token.user_id)) throw new Error("O vendedor retornado não corresponde à autorização.");
        shop = { shopId: String(me.id), shopName: me.nickname };
      } else {
        const app = { appKey: c.identifier, appSecret: c.secret, environment: c.environment };
        const token = await tiktok.exchangeCodeForToken(app, code);
        accessToken = token.access_token; refreshToken = token.refresh_token;
        expiresAt = new Date(token.access_token_expire_in * 1000);
        const response: any = await tiktok.getAuthorizedShops(app, accessToken);
        const shops = response?.data?.shops;
        if (!Array.isArray(shops) || shops.length === 0) throw new Error("Nenhuma loja autorizada no TikTok Shop.");
        // This installation connects one shop per marketplace. Never silently pick another shop.
        const current = await prisma.marketplaceAccount.findUnique({ where: { storeId_provider: { storeId: store.id, provider } } });
        const selected = shops.find((item: any) => String(item.id) === current?.shopId) || (shops.length === 1 ? shops[0] : null);
        if (!selected) throw new Error("Autorize apenas a loja que deseja conectar. Este painel aceita uma loja por marketplace e empresa.");
        if (!selected.id || !selected.cipher) throw new Error("TikTok Shop não retornou o identificador e o cipher da loja.");
        shop = { shopId: String(selected.id), shopCipher: selected.cipher, shopName: selected.name, region: selected.region };
      }
      if (!accessToken || !refreshToken || !Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new Error("O marketplace retornou tokens incompletos ou expirados. Inicie a conexão novamente.");
      await prisma.$transaction(async tx => {
        const account = await tx.marketplaceAccount.upsert({
          where: { storeId_provider: { storeId: store.id, provider } },
          create: { storeId: store.id, provider, ...shop, status: "connected" },
          update: { ...shop, status: "connected", lastSyncStatus: null },
        });
        const encrypted = { accessTokenEnc: encryptSecret(accessToken), refreshTokenEnc: encryptSecret(refreshToken), expiresAt };
        await tx.credential.upsert({ where: { marketplaceAccountId: account.id }, create: { marketplaceAccountId: account.id, ...encrypted }, update: encrypted });
      });
      await logAudit(payload.userId!, `${provider}_connected`);
      return res.redirect(`${env.frontendUrl}/integracoes?success=1&provider=${provider}`);
    });
  } catch (error: any) {
    return res.redirect(`${env.frontendUrl}/integracoes?error=${encodeURIComponent(String(error?.message ?? "Falha na conexão."))}&provider=${provider}`);
  }
});

router.post("/:provider/check", requireAuth, requirePermission("integracoes"), async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const store = await getOrCreateDefaultStore();
  const account = await prisma.marketplaceAccount.findUnique({ where: { storeId_provider: { storeId: store.id, provider } } });
  if (!account || account.status !== "connected") return res.status(400).json({ error: "Conecte a loja antes de verificar." });
  try {
    let shopName = account.shopName;
    if (provider === "shopee") {
      const { app, accessToken, shopId } = await shopeeAccess(account);
      const info = await shopee.getShopInfo(app, accessToken, shopId);
      shopName = info?.response?.shop_name || info?.shop_name || shopName;
    } else if (provider === "mercadolivre") {
      const me = await meli.getMe(await meliAccess(account));
      if (String(me.id) !== account.shopId) throw new Error("O token pertence a outro vendedor. Reconecte a loja.");
      shopName = me.nickname;
    } else {
      const { app, accessToken } = await tiktokAccess(account);
      const response: any = await tiktok.getAuthorizedShops(app, accessToken);
      if (!response?.data?.shops?.some((shop: any) => String(shop.id) === account.shopId)) throw new Error("A loja não está mais autorizada. Reconecte no TikTok Shop.");
    }
    return res.json({ ok: true, shopName, message: "O marketplace confirmou o acesso à loja." });
  } catch (error: any) {
    return res.status(502).json({ error: String(error?.message ?? "Não foi possível verificar a conexão.") });
  }
});

router.post("/:provider/disconnect", requireAuth, requirePermission("integracoes"), async (req, res) => {
  const provider = req.params.provider as MarketplaceProvider;
  const store = await getOrCreateDefaultStore();
  const account = await prisma.marketplaceAccount.findFirst({
    where: { storeId: store.id, provider },
  });

  if (!account) return res.json({ ok: true });

  await prisma.credential.deleteMany({ where: { marketplaceAccountId: account.id } });
  await prisma.marketplaceAccount.update({
    where: { id: account.id },
    data: { status: "disconnected" },
  });
  await logAudit(
    req.auth!.userId,
    `${provider}_disconnected`,
    `shop_id=${account.shopId}`,
    req.ip
  );
  res.json({ ok: true });
});

export default router;
