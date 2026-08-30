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

export function RangeFilter({
  value,
  onChange,
}: {
  value: RangeFilterValue;
  onChange: (v: RangeFilterValue) => void;
}) {
  return (
    <div className="filters-row">
      <select
        value={value.preset ?? "last30"}
        onChange={(e) => onChange({ preset: e.target.value })}
      >
        {PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
        <option value="custom">Período personalizado</option>
      </select>
      {value.preset === "custom" && (
        <>
          <input
            type="date"
            value={value.from ?? ""}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <input
            type="date"
            value={value.to ?? ""}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </>
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
