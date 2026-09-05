import { useState } from "react";
import type { MarketplaceProvider } from "../types/marketplace";

const MARKETPLACE_META: Record<MarketplaceProvider, { label: string; logo: string; className: string }> = {
  shopee: {
    label: "Shopee",
    logo: "https://cdn.simpleicons.org/shopee/EE4D2D",
    className: "shopee",
  },
  mercadolivre: {
    label: "Mercado Livre",
    logo: "https://cdn.simpleicons.org/mercadolibre/FFE600",
    className: "meli",
  },
  tiktokshop: {
    label: "TikTok Shop",
    logo: "https://cdn.simpleicons.org/tiktok/000000",
    className: "tiktok",
  },
};

export function marketplaceMeta(provider: MarketplaceProvider) {
  return MARKETPLACE_META[provider];
}

export function MarketplaceLogo({
  provider,
  size = 28,
  showLabel = false,
}: {
  provider: MarketplaceProvider;
  size?: number;
  showLabel?: boolean;
}) {
  const meta = MARKETPLACE_META[provider];
  const [failed, setFailed] = useState(false);

  return (
    <span className={`marketplace-logo marketplace-logo-${meta.className}`}>
      <span className="marketplace-logo-box" style={{ width: size, height: size }} aria-hidden="true">
        {failed ? (
          <strong>{meta.label.slice(0, 1)}</strong>
        ) : (
          <img
            src={meta.logo}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
          />
        )}
      </span>
      {showLabel && <span className="marketplace-logo-label">{meta.label}</span>}
    </span>
  );
}
