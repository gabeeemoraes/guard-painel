import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { MarketplaceProvider } from "../types/marketplace";
import { env } from "../env";
import { getOrCreateDefaultStore } from "./store";

export interface MarketplaceAppCredentials {
  identifier: string;
  secret: string;
  source: "database";
  environment: "live" | "test";
  serviceId: string;
}

export async function getMarketplaceAppCredentials(
  provider: MarketplaceProvider
): Promise<MarketplaceAppCredentials | null> {
  const store = await getOrCreateDefaultStore();
  const saved = await prisma.marketplaceAppCredential.findUnique({
    where: { storeId_provider: { storeId: store.id, provider } },
  });

  if (!saved) return null;
  const setting = await prisma.setting.findUnique({ where: { storeId_key: { storeId: store.id, key: `marketplace_options_${provider}` } } });
  const options = setting ? JSON.parse(setting.value) : {};


  return {
    identifier: decryptSecret(saved.identifierEnc),
    secret: decryptSecret(saved.secretEnc),
    source: "database",
    environment: options.environment === "test" ? "test" : "live",
    serviceId: options.serviceId || (provider === "tiktokshop" ? env.tiktokServiceId : ""),
  };
}

export async function saveMarketplaceAppCredentials(
  provider: MarketplaceProvider,
  identifier: string,
  secret: string,
  options: { environment: "live" | "test"; serviceId: string }
) {
  const store = await getOrCreateDefaultStore();
  return prisma.$transaction(async tx => {
  await tx.setting.upsert({ where: { storeId_key: { storeId: store.id, key: `marketplace_options_${provider}` } }, create: { storeId: store.id, key: `marketplace_options_${provider}`, value: JSON.stringify(options) }, update: { value: JSON.stringify(options) } });
  return tx.marketplaceAppCredential.upsert({
    where: { storeId_provider: { storeId: store.id, provider } },
    create: {
      storeId: store.id,
      provider,
      identifierEnc: encryptSecret(identifier.trim()),
      secretEnc: encryptSecret(secret),
    },
    update: {
      identifierEnc: encryptSecret(identifier.trim()),
      secretEnc: encryptSecret(secret),
    },
  });
  });
}

export async function deleteMarketplaceAppCredentials(provider: MarketplaceProvider) {
  const store = await getOrCreateDefaultStore();
  await prisma.marketplaceAppCredential.deleteMany({
    where: { storeId: store.id, provider },
  });
}

export function marketplaceCredentialLabels(provider: MarketplaceProvider) {
  if (provider === "shopee") return { identifier: "Partner ID", secret: "Partner Key" };
  if (provider === "mercadolivre") return { identifier: "Client ID", secret: "Client Secret" };
  return { identifier: "App Key", secret: "App Secret" };
}

export function connectionReady(provider: MarketplaceProvider, credentials: MarketplaceAppCredentials | null) {
  return Boolean(credentials && (provider !== "tiktokshop" || credentials.serviceId));
}
