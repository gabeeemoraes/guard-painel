export type MarketplaceProvider = "shopee" | "mercadolivre" | "tiktokshop";

export const MARKETPLACE_PROVIDERS: MarketplaceProvider[] = ["shopee", "mercadolivre", "tiktokshop"];

export function isMarketplaceProvider(value: string): value is MarketplaceProvider {
  return (MARKETPLACE_PROVIDERS as string[]).includes(value);
}

export const PROVIDER_LABELS: Record<MarketplaceProvider, string> = {
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
  tiktokshop: "TikTok Shop",
};
