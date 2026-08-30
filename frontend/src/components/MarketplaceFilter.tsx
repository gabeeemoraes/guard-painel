import { Layers, Split } from "lucide-react";
import { MarketplaceProvider } from "../types/marketplace";

const PROVIDER_META: Record<MarketplaceProvider, { label: string; color: string }> = {
  shopee: { label: "Shopee", color: "var(--mkt-shopee)" },
  mercadolivre: { label: "Mercado Livre", color: "var(--mkt-mercadolivre)" },
  tiktokshop: { label: "TikTok Shop", color: "var(--mkt-tiktokshop)" },
};

export const ALL_PROVIDERS: MarketplaceProvider[] = ["shopee", "mercadolivre", "tiktokshop"];

export function providerLabel(p: MarketplaceProvider): string {
  return PROVIDER_META[p].label;
}

export function providerColor(p: MarketplaceProvider): string {
  return PROVIDER_META[p].color;
}

export function ProviderDot({ provider }: { provider: MarketplaceProvider }) {
  return <span style={{ width: 7, height: 7, borderRadius: "50%", display: "inline-block", background: providerColor(provider) }} />;
}

/**
 * Alterna entre a visão "Consolidado" (todos os marketplaces somados) e
 * "Separado" (comparativo lado a lado de cada marketplace).
 */
export function ConsolidatedTabs({
  view,
  onChange,
}: {
  view: "consolidado" | "separado";
  onChange: (v: "consolidado" | "separado") => void;
}) {
  return (
    <div className="marketplace-filter">
      <button className={view === "consolidado" ? "active" : ""} onClick={() => onChange("consolidado")}>
        <Layers size={13} />
        Consolidado
      </button>
      <button className={view === "separado" ? "active" : ""} onClick={() => onChange("separado")}>
        <Split size={13} />
        Separado
      </button>
    </div>
  );
}

/**
 * Filtro de um único marketplace por vez, para páginas de listagem
 * (Faturamento, Pedidos, Produtos, Curva ABC, Financeiro...).
 */
export function ProviderFilter({
  value,
  onChange,
}: {
  value: MarketplaceProvider | "all";
  onChange: (v: MarketplaceProvider | "all") => void;
}) {
  return (
    <div className="marketplace-filter">
      <button className={value === "all" ? "active" : ""} onClick={() => onChange("all")}>
        Todos
      </button>
      {ALL_PROVIDERS.map((p) => (
        <button key={p} className={value === p ? "active" : ""} onClick={() => onChange(p)}>
          <span className="dot" style={{ background: providerColor(p) }} />
          {providerLabel(p)}
        </button>
      ))}
    </div>
  );
}
