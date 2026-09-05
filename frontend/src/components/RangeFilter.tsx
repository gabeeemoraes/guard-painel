export interface RangeFilterValue {
  preset?: string;
  from?: string;
  to?: string;
}

const PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "currentMonth", label: "Mês atual" },
  { value: "lastMonth", label: "Mês anterior" },
];

function toInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function defaultCustomRange(): Pick<RangeFilterValue, "from" | "to"> {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: toInputDate(from), to: toInputDate(to) };
}

export function RangeFilter({ value, onChange }: { value: RangeFilterValue; onChange: (v: RangeFilterValue) => void }) {
  function handlePresetChange(preset: string) {
    if (preset === "custom") {
      const range = defaultCustomRange();
      onChange({ preset, ...range });
      return;
    }
    onChange({ preset });
  }

  return (
    <div className="filters-row range-filter">
      <select value={value.preset ?? "last30"} onChange={(e) => handlePresetChange(e.target.value)} aria-label="Período">
        {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        <option value="custom">Período personalizado</option>
      </select>
      {value.preset === "custom" && (
        <div className="custom-range-fields">
          <label>
            <span>De</span>
            <input type="date" value={value.from ?? ""} max={value.to || undefined} onChange={(e) => onChange({ ...value, from: e.target.value })} aria-label="Data inicial" />
          </label>
          <label>
            <span>Até</span>
            <input type="date" value={value.to ?? ""} min={value.from || undefined} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-label="Data final" />
          </label>
        </div>
      )}
    </div>
  );
}

export function rangeToQuery(value: RangeFilterValue): string {
  const params = new URLSearchParams();
  if (value.preset === "custom" && value.from && value.to) {
    params.set("from", value.from);
    params.set("to", value.to);
  } else {
    params.set("preset", value.preset ?? "last30");
  }
  return params.toString();
}
