import { useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { Loading, EmptyState, Modal, useToast } from "../components/Feedback";
import { formatCurrency } from "../utils/format";

interface CostRow {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  cost: { productCost: number; packagingCost: number; taxCost: number; otherCost: number; total: number } | null;
}

export default function Custos() {
  const { notify } = useToast();
  const [search, setSearch] = useState("");
  const [data, setData] = useState<{ products: CostRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CostRow | null>(null);
  const [form, setForm] = useState({ productCost: 0, packagingCost: 0, taxCost: 0, otherCost: 0 });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    api
      .get<any>(`/custos?${params.toString()}`)
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(load, [search]);

  function openEdit(row: CostRow) {
    setEditing(row);
    setForm({
      productCost: row.cost?.productCost ?? 0,
      packagingCost: row.cost?.packagingCost ?? 0,
      taxCost: row.cost?.taxCost ?? 0,
      otherCost: row.cost?.otherCost ?? 0,
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/custos/${editing.id}`, form);
      notify("Custo salvo. Lucro e margem recalculados.", "success");
      setEditing(null);
      load();
    } catch (err: any) {
      notify(err.message ?? "Erro ao salvar custo.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Custos" />
      <div className="content">
        <div className="filters-row">
          <input placeholder="Buscar produto ou SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {loading && <Loading label="Carregando produtos..." />}
        {!loading && data && data.products.length === 0 && (
          <EmptyState title="Nenhum produto cadastrado ainda" description="Sincronize a loja Shopee em Integrações." />
        )}

        {!loading && data && data.products.length > 0 && (
          <div className="card table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>SKU</th>
                  <th>Preço</th>
                  <th>Custo total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.products.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>{p.sku ?? "—"}</td>
                    <td>{formatCurrency(p.price)}</td>
                    <td>{p.cost ? formatCurrency(p.cost.total) : "Sem dados disponíveis"}</td>
                    <td>
                      <button className="btn btn-secondary" onClick={() => openEdit(p)}>
                        Configurar custo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)}>
        {editing && (
          <div>
            <h3 style={{ marginTop: 0 }}>Custo — {editing.name}</h3>
            <div className="field">
              <label>Custo do produto (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.productCost}
                onChange={(e) => setForm({ ...form, productCost: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Embalagem (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.packagingCost}
                onChange={(e) => setForm({ ...form, packagingCost: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Imposto (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.taxCost}
                onChange={(e) => setForm({ ...form, taxCost: Number(e.target.value) })}
              />
            </div>
            <div className="field">
              <label>Outros custos (R$)</label>
              <input
                type="number"
                step="0.01"
                value={form.otherCost}
                onChange={(e) => setForm({ ...form, otherCost: Number(e.target.value) })}
              />
            </div>
            <div className="flex gap-2 mt-4">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Salvando..." : "Salvar"}
              </button>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
