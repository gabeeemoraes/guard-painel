import { useState } from "react";
import type { MarketplaceProvider } from "../types/marketplace";

const MARKETPLACE_META: Record<MarketplaceProvider, { label: string; logo: string; className: string }> = {
  shopee: {
    label: "Shopee",
    logo: "https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/shopee.svg",
    className: "shopee",
  },
  mercadolivre: {
    label: "Mercado Livre",
    logo: "https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/mercadolibre.svg",
    className: "meli",
  },
  tiktokshop: {
    label: "TikTok Shop",
    logo: "https://cdn.jsdelivr.net/npm/simple-icons@v15/icons/tiktok.svg",
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
      <span className="marketplace-logo-box" style={{ width: size, height: size, background: "#fff", borderRadius: 10, padding: 6, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }} aria-hidden="true">
        {failed ? (
          <strong>{meta.label.slice(0, 1)}</strong>
        ) : (
          <img
            src={meta.logo}
            alt={`Logo ${meta.label}`}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={() => setFailed(true)}
          />
        )}
      </span>
      {showLabel && <span className="marketplace-logo-label">{meta.label}</span>}
    </span>
  );
}
