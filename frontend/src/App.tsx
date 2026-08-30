import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/Feedback";
import { ProtectedLayout, RequirePage } from "./components/ProtectedLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Faturamento from "./pages/Faturamento";
import Pedidos from "./pages/Pedidos";
import Produtos from "./pages/Produtos";
import Financeiro from "./pages/Financeiro";
import Publicidade from "./pages/Publicidade";
import CurvaAbc from "./pages/CurvaAbc";
import Custos from "./pages/Custos";
import Relatorios from "./pages/Relatorios";
import Integracoes from "./pages/Integracoes";
import Configuracoes from "./pages/Configuracoes";

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequirePage page="dashboard">
                      <Dashboard />
                    </RequirePage>
                  }
                />
                <Route
                  path="/faturamento"
                  element={
                    <RequirePage page="faturamento">
                      <Faturamento />
                    </RequirePage>
                  }
                />
                <Route
                  path="/pedidos"
                  element={
                    <RequirePage page="pedidos">
                      <Pedidos />
                    </RequirePage>
                  }
                />
                <Route
                  path="/produtos"
                  element={
                    <RequirePage page="produtos">
                      <Produtos />
                    </RequirePage>
                  }
                />
                <Route
                  path="/financeiro"
                  element={
                    <RequirePage page="financeiro">
                      <Financeiro />
                    </RequirePage>
                  }
                />
                <Route
                  path="/publicidade"
                  element={
                    <RequirePage page="publicidade">
                      <Publicidade />
                    </RequirePage>
                  }
                />
                <Route
                  path="/curva-abc"
                  element={
                    <RequirePage page="curva-abc">
                      <CurvaAbc />
                    </RequirePage>
                  }
                />
                <Route
                  path="/custos"
                  element={
                    <RequirePage page="custos">
                      <Custos />
                    </RequirePage>
                  }
                />
                <Route
                  path="/relatorios"
                  element={
                    <RequirePage page="relatorios">
                      <Relatorios />
                    </RequirePage>
                  }
                />
                <Route
                  path="/integracoes"
                  element={
                    <RequirePage page="integracoes">
                      <Integracoes />
                    </RequirePage>
                  }
                />
                <Route
                  path="/configuracoes"
                  element={
                    <RequirePage page="configuracoes">
                      <Configuracoes />
                    </RequirePage>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
