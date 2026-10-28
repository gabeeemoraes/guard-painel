import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import type { AddressInfo } from "node:net";

process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
process.env.SESSION_SECRET = "local-test-session-secret";
process.env.CREDENTIALS_ENCRYPTION_KEY = "local-test-encryption-secret";
process.env.FRONTEND_URL = "https://guard-painel-moraes-corp.vercel.app";
process.env.BACKEND_PUBLIC_URL = process.env.FRONTEND_URL;

const app = require("../src/app").default;
const { prisma } = require("../src/lib/prisma");
const { signSession } = require("../src/middleware/auth");
const { encryptSecret, decryptSecret } = require("../src/lib/crypto");

// Isolated HTTP integration test: no production credentials, writes or marketplace calls.
test("OAuth and session regression flow", async (t) => {
  let active = true;
  let role = "ADMIN";
  let savedCredentials: any;
  const user = () => ({ id: "test-user", active, role, storeId: "test-store", permissions: "[]" });
  prisma.user.findUnique = async () => user();
  prisma.setting.findUnique = async () => null;
  prisma.$transaction = async (fn: any) => fn(prisma);
  prisma.store.findUnique = async () => ({ id: "test-store" });
  prisma.marketplaceAppCredential.findUnique = async () => ({ identifierEnc: encryptSecret("123456"), secretEnc: encryptSecret("test-client-secret") });
  prisma.marketplaceAccount.findMany = async () => [];
  prisma.marketplaceAccount.upsert = async (args: any) => {
    assert.equal(args.where.storeId_provider.storeId, "test-store");
    return { id: "test-account" };
  };
  prisma.credential.upsert = async (args: any) => { savedCredentials = args.create; };
  prisma.auditLog.create = async () => ({});

  const realFetch = globalThis.fetch;
  let tokenBody: URLSearchParams | undefined;
  globalThis.fetch = (async (input: any, init: any) => {
    if (String(input) === "https://api.mercadolibre.com/oauth/token") {
      tokenBody = new URLSearchParams(init.body);
      return new Response(JSON.stringify({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600, user_id: 12 }), { headers: { "content-type": "application/json" } });
    }
    if (String(input) === "https://api.mercadolibre.com/users/me") return new Response(JSON.stringify({ id: 12, nickname: "Test Shop" }));
    return realFetch(input, init);
  }) as typeof fetch;
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const authorization = `Bearer ${signSession({ userId: "test-user", role: "ADMIN" })}`;
  const call = (path: string, headers: Record<string, string> = {}) => realFetch(base + path, { headers, redirect: "manual" });
  let authUrl: URL;
  let cookies: string;
  try {
    await t.test("health and private responses are not cached", async () => {
      const health = await call("/api/health");
      assert.equal(health.status, 200);
      assert.equal(health.headers.get("cache-control"), "no-store");
      assert.equal((await call("/api/integrations")).status, 401);
    });
    await t.test("callback URL matches the public panel origin", async () => {
      const res = await call("/api/integrations/mercadolivre/app-credentials", { authorization });
      assert.equal((await res.json()).redirectUri, `${process.env.FRONTEND_URL}/api/integrations/mercadolivre/callback`);
    });
    await t.test("connect sets HttpOnly cookies and PKCE without exposing verifier", async () => {
      const res = await call("/api/integrations/mercadolivre/connect-url", { authorization });
      assert.equal(res.status, 200);
      authUrl = new URL((await res.json()).url);
      const setCookies = res.headers.getSetCookie();
      assert.ok(setCookies.every(c => c.includes("HttpOnly") && c.includes("Secure") && c.includes("SameSite=Lax")));
      cookies = setCookies.map(c => c.split(";")[0]).join("; ");
      const verifier = decodeURIComponent(setCookies.find(c => c.startsWith("guard_oauth_meli_verifier="))!.split(";")[0].split("=")[1]);
      assert.equal(authUrl.origin, "https://auth.mercadolivre.com.br");
      assert.equal(authUrl.searchParams.get("redirect_uri"), `${process.env.FRONTEND_URL}/api/integrations/mercadolivre/callback`);
      assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
      assert.equal(authUrl.searchParams.get("code_challenge"), createHash("sha256").update(verifier).digest("base64url"));
      assert.equal(authUrl.searchParams.has("code_verifier"), false);
      const second = await call("/api/integrations/mercadolivre/connect-url", { authorization });
      assert.notEqual(new URL((await second.json()).url).searchParams.get("state"), authUrl.searchParams.get("state"));
    });
    await t.test("tampered state is refused before token exchange", async () => {
      const res = await call("/api/integrations/mercadolivre/callback?code=test&state=wrong", { cookie: cookies });
      assert.match(new URL(res.headers.get("location")!).searchParams.get("error")!, /Estado OAuth inválido/);
      assert.equal(tokenBody, undefined);
    });
    await t.test("callback exchanges code with the same redirect and PKCE, encrypts tokens", async () => {
      const res = await call(`/api/integrations/mercadolivre/callback?code=test-code&state=${authUrl.searchParams.get("state")}`, { cookie: cookies });
      assert.equal(res.status, 302);
      assert.equal(new URL(res.headers.get("location")!).searchParams.get("success"), "1");
      assert.equal(tokenBody!.get("redirect_uri"), authUrl.searchParams.get("redirect_uri"));
      assert.ok(tokenBody!.get("code_verifier"));
      assert.equal(decryptSecret(savedCredentials.accessTokenEnc), "test-access");
      assert.equal(decryptSecret(savedCredentials.refreshTokenEnc), "test-refresh");
      assert.ok(res.headers.getSetCookie().some(c => c.startsWith("guard_oauth_meli_verifier=;") && c.includes("Expires=")));
    });
    await t.test("missing cookie and refused authorization return actionable errors", async () => {
      const missing = await call("/api/integrations/mercadolivre/callback?code=test");
      assert.match(new URL(missing.headers.get("location")!).searchParams.get("error")!, /expirada/);
      const denied = await call(`/api/integrations/mercadolivre/callback?error=access_denied&state=${authUrl.searchParams.get("state")}`, { cookie: cookies });
      assert.match(new URL(denied.headers.get("location")!).searchParams.get("error")!, /Autorização recusada/);
    });
    await t.test("SSE handles no connected marketplace cleanly", async () => {
      const res = await call("/api/sync/run?provider=mercadolivre", { authorization });
      assert.equal(res.status, 200);
      assert.match(await res.text(), /Nenhum marketplace conectado/);
    });
    await t.test("disabled users and stale admin roles are rejected", async () => {
      active = false;
      assert.equal((await call("/api/integrations", { authorization })).status, 401);
      active = true;
      role = "USER";
      assert.equal((await call("/api/users", { authorization })).status, 403);
    });
  } finally {
    globalThis.fetch = realFetch;
    await new Promise<void>(resolve => server.close(resolve));
    await prisma.$disconnect();
  }
});
