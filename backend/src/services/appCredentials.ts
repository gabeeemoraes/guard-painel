import { prisma } from "../lib/prisma";
import { decryptSecret, encryptSecret } from "../lib/crypto";
import { MarketplaceProvider } from "../types/marketplace";
import { getOrCreateDefaultStore } from "./store";

export interface MarketplaceAppCredentials {
  identifier: string;
  secret: string;
  source: "database";
}

export async function getMarketplaceAppCredentials(
  provider: MarketplaceProvider
): Promise<MarketplaceAppCredentials | null> {
  const store = await getOrCreateDefaultStore();
  const saved = await prisma.marketplaceAppCredential.findUnique({
    where: { storeId_provider: { storeId: store.id, provider } },
  });

  if (!saved) return null;

  return {
    identifier: decryptSecret(saved.identifierEnc),
    secret: decryptSecret(saved.secretEnc),
    source: "database",
  };
}

export async function saveMarketplaceAppCredentials(
  provider: MarketplaceProvider,
  identifier: string,
  secret: string
) {
  const store = await getOrCreateDefaultStore();
  return prisma.marketplaceAppCredential.upsert({
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
