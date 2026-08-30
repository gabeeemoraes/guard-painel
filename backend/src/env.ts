import dotenv from "dotenv";
dotenv.config();

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. Verifique seu arquivo .env (veja .env.example).`
    );
  }
  return v;
}

export const env = {
  port: parseInt(process.env.PORT || "4000", 10),
  databaseUrl: required("DATABASE_URL"),
  sessionSecret: required("SESSION_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  credentialsEncryptionKey: required("CREDENTIALS_ENCRYPTION_KEY"),

  adminName: process.env.ADMIN_NAME || "Administrador",
  adminEmail: process.env.ADMIN_EMAIL || "",
  adminPassword: process.env.ADMIN_PASSWORD || "",

  secondaryUserName: process.env.SECONDARY_USER_NAME || "Usuário",
  secondaryUserEmail: process.env.SECONDARY_USER_EMAIL || "",
  secondaryUserPassword: process.env.SECONDARY_USER_PASSWORD || "",
  secondaryUserActive: (process.env.SECONDARY_USER_ACTIVE || "true") === "true",

  shopeePartnerId: process.env.SHOPEE_PARTNER_ID || "",
  shopeePartnerKey: process.env.SHOPEE_PARTNER_KEY || "",
  shopeeEnv: (process.env.SHOPEE_ENV || "test") as "live" | "test",
  backendPublicUrl: process.env.BACKEND_PUBLIC_URL || `http://localhost:${process.env.PORT || 4000}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",

  isShopeeConfigured(): boolean {
    return Boolean(this.shopeePartnerId && this.shopeePartnerKey);
  },

  shopeeHost(): string {
    return this.shopeeEnv === "live"
      ? "https://partner.shopeemobile.com"
      : "https://partner.test-stable.shopeemobile.com";
  },

  // Mercado Livre
  mercadoLivreClientId: process.env.MERCADOLIVRE_CLIENT_ID || "",
  mercadoLivreClientSecret: process.env.MERCADOLIVRE_CLIENT_SECRET || "",
  // MLB = Brasil. Outros sites: MLA (Argentina), MLM (México), MCO (Colômbia), MLC (Chile), MLU (Uruguai)...
  mercadoLivreSiteId: process.env.MERCADOLIVRE_SITE_ID || "MLB",

  isMercadoLivreConfigured(): boolean {
    return Boolean(this.mercadoLivreClientId && this.mercadoLivreClientSecret);
  },

  // TikTok Shop
  tiktokAppKey: process.env.TIKTOK_APP_KEY || "",
  tiktokAppSecret: process.env.TIKTOK_APP_SECRET || "",
  tiktokEnv: (process.env.TIKTOK_ENV || "sandbox") as "live" | "sandbox",

  isTiktokConfigured(): boolean {
    return Boolean(this.tiktokAppKey && this.tiktokAppSecret);
  },

  tiktokAuthHost(): string {
    return "https://auth.tiktok-shops.com";
  },

  tiktokApiHost(): string {
    return this.tiktokEnv === "live"
      ? "https://open-api.tiktokglobalshop.com"
      : "https://open-api-sandbox.tiktokglobalshop.com";
  },
};
