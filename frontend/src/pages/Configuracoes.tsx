import { FormEvent, useEffect, useState } from "react";
import { Header } from "../components/Header";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Feedback";

interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "USER";
  active: boolean;
  permissions: string[];
}

const ALL_PAGES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "faturamento", label: "Faturamento" },
  { key: "pedidos", label: "Pedidos" },
  { key: "produtos", label: "Produtos" },
  { key: "financeiro", label: "Financeiro" },
  { key: "publicidade", label: "Publicidade" },
  { key: "curva-abc", label: "Curva ABC" },
  { key: "custos", label: "Custos" },
  { key: "relatorios", label: "Relatórios" },
  { key: "integracoes", label: "Integrações" },
  { key: "configuracoes", label: "Configurações" },
];

export default function Configuracoes() {
  const { user } = useAuth();
  const { notify } = useToast();
  const isAdmin = user?.role === "ADMIN";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [storeName, setStoreName] = useState("");
  const [savingStoreName, setSavingStoreName] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const settings = await api.get<{ storeName: string }>("/settings");
        if (!cancelled) setStoreName(settings.storeName);
        if (isAdmin) {
          const result = await api.get<{ users: ManagedUser[] }>("/users");
          if (!cancelled) setUsers(result.users);
        }
      } catch (err: any) {
        if (!cancelled) notify(err?.message ?? "Não foi possível carregar as configurações.", "error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [isAdmin, notify]);

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setChangingPassword(true);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      notify("Senha alterada com sucesso.", "success");
      setCurrentPassword("");
      setNewPassword("");
    } catch (err: any) {
      notify(err.message ?? "Erro ao alterar senha.", "error");
    } finally {
      setChangingPassword(false);
    }
  }

  async function toggleActive(u: ManagedUser) {
    try {
      const res = await api.patch<{ user: ManagedUser }>(`/users/${u.id}`, { active: !u.active });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.user : x)));
      notify(`Usuário ${res.user.active ? "ativado" : "desativado"}.`, "success");
    } catch (err: any) {
      notify(err.message ?? "Erro ao atualizar usuário.", "error");
    }
  }

  async function togglePermission(u: ManagedUser, page: string) {
    const has = u.permissions.includes(page);
    const permissions = has ? u.permissions.filter((p) => p !== page) : [...u.permissions, page];
    try {
      const res = await api.patch<{ user: ManagedUser }>(`/users/${u.id}`, { permissions });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? res.user : x)));
    } catch (err: any) {
      notify(err.message ?? "Erro ao atualizar permissões.", "error");
    }
  }

  async function resetUserPassword(u: ManagedUser) {
    const pass = prompt(`Nova senha para ${u.email} (mínimo 6 caracteres):`);
    if (!pass) return;
    if (pass.length < 6) {
      notify("A nova senha precisa ter pelo menos 6 caracteres.", "error");
      return;
    }
    try {
      await api.post(`/users/${u.id}/reset-password`, { newPassword: pass });
      notify("Senha redefinida com sucesso.", "success");
    } catch (err: any) {
      notify(err.message ?? "Erro ao redefinir senha.", "error");
    }
  }

  async function saveStoreName() {
    if (!storeName.trim()) {
      notify("Informe o nome da empresa.", "error");
      return;
    }
    setSavingStoreName(true);
    try {
      await api.patch("/settings", { storeName: storeName.trim() });
      notify("Nome da empresa atualizado.", "success");
    } catch (err: any) {
      notify(err.message ?? "Erro ao salvar.", "error");
    } finally {
      setSavingStoreName(false);
    }
  }

  const managedUsers = users.filter((u) => u.role === "USER");

  return (
    <>
      <Header title="Configurações" />
      <div className="content">
        <div className="grid grid-cols-2 mb-4">
          <div className="card">
            <div className="kpi-label mb-4">Alterar minha senha</div>
            <form onSubmit={handleChangePassword}>
              <div className="field">
                <label>Senha atual</label>
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <div className="field">
                <label>Nova senha</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required autoComplete="new-password" />
              </div>
              <button className="btn btn-primary" type="submit" disabled={changingPassword}>{changingPassword ? "Salvando..." : "Alterar senha"}</button>
            </form>
          </div>

          <div className="card">
            <div className="kpi-label mb-4">Minha empresa</div>
            <div className="field">
              <label>Nome exibido no sistema</label>
              <input value={storeName} onChange={(e) => setStoreName(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={saveStoreName} disabled={savingStoreName}>{savingStoreName ? "Salvando..." : "Salvar"}</button>
          </div>
        </div>

        {isAdmin && (
          <div className="card">
            <div className="kpi-label mb-4">Gestão do segundo usuário</div>
            {managedUsers.map((u) => (
              <div key={u.id} style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: 16, marginBottom: 16 }}>
                <div className="flex justify-between items-center mb-4 settings-user-row">
                  <div>
                    <strong>{u.name}</strong>
                    <div className="text-secondary" style={{ fontSize: 13 }}>{u.email}</div>
                  </div>
                  <div className="flex gap-2 items-center admin-actions-row">
                    <span className={`badge ${u.active ? "badge-green" : "badge-gray"}`}>{u.active ? "Ativo" : "Inativo"}</span>
                    <button className="btn btn-secondary" onClick={() => toggleActive(u)}>{u.active ? "Desativar" : "Ativar"}</button>
                    <button className="btn btn-secondary" onClick={() => resetUserPassword(u)}>Redefinir senha</button>
                  </div>
                </div>
                <div className="kpi-label mb-4">Permissões de acesso</div>
                <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
                  {ALL_PAGES.map((p) => (
                    <label key={p.key} className="badge badge-gray" style={{ cursor: "pointer", display: "inline-flex", gap: 6 }}>
                      <input type="checkbox" checked={u.permissions.includes(p.key)} onChange={() => togglePermission(u, p.key)} />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {managedUsers.length === 0 && <p className="text-secondary" style={{ fontSize: 13 }}>Nenhum usuário comum configurado.</p>}
          </div>
        )}
      </div>
    </>
  );
}
