import { FormEvent, useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth, ApiError } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => !loading && email.trim().length > 3 && password.length > 0,
    [email, password, loading]
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(from && from !== "/login" ? from : "/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen" data-testid="login-screen">
      <div className="login-orb login-orb-a" />
      <div className="login-orb login-orb-b" />
      <div className="login-card">
        <div className="sidebar-brand" style={{ color: "var(--text-primary)", padding: 0, marginBottom: 24 }}>
          <img src="/guard-logo.svg" alt="GUARD PAINEL" />
          <span>GUARD <b>PAINEL</b></span>
        </div>
        <p className="text-secondary" style={{ marginTop: -12, marginBottom: 24, fontSize: 14 }}>
          Acesso privado à sua plataforma de análise da loja.
        </p>
        <form onSubmit={handleSubmit} noValidate data-testid="login-form">
          <div className="field">
            <label htmlFor="login-email">E-mail</label>
            <div className="input-icon-wrap">
              <Mail size={17} />
              <input
                id="login-email"
                data-testid="login-email"
                type="email"
                inputMode="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(error)}
                placeholder="seu@email.com"
                required
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="login-password">Senha</label>
            <div className="input-icon-wrap">
              <LockKeyhole size={17} />
              <input
                id="login-password"
                data-testid="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(error)}
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((value) => !value)}
                data-testid="toggle-password"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </div>
          {error && (
            <div className="login-error" role="alert" data-testid="login-error" style={{ color: "var(--al-red)", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}
          <button
            className="btn btn-primary login-submit"
            data-testid="login-submit"
            type="submit"
            disabled={!canSubmit}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading && <span className="spinner" aria-hidden="true" />}
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
