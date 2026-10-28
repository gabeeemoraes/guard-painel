import assert from "node:assert/strict";
import { test } from "node:test";
import type { AddressInfo } from "node:net";
process.env.NODE_ENV = "production";
process.env.DATABASE_URL = "postgresql://test:test@localhost:1/test";
process.env.SESSION_SECRET = "panel-test-session-secret";
process.env.CREDENTIALS_ENCRYPTION_KEY = "panel-test-key";
process.env.FRONTEND_URL = "https://guard-painel-moraes-corp.vercel.app";
const app = require("../src/app").default;
const { prisma } = require("../src/lib/prisma");
const bcrypt = require("bcryptjs");
const { resolveRangeFromQuery } = require("../src/services/calculations");

test("Panel API, session cookies and reporting dates", async t => {
  const user = { id: "test-user", name: "Test", email: "test@example.invalid", passwordHash: await bcrypt.hash("isolated-test-password", 4), role: "ADMIN", active: true, permissions: "[]", storeId: "isolated-store" };
  prisma.user.findUnique = async () => user;
  prisma.user.findMany = async () => [];
  prisma.store.findUnique = async () => ({ id: "isolated-store", name: "Test" });
  prisma.auditLog.create = async () => ({});
  for (const name of ["order", "product", "orderItem", "financialTransaction", "advertisingData", "setting", "syncHistory", "marketplaceAccount"]) {
    prisma[name].findMany = async () => [];
    prisma[name].count = async () => 0;
    prisma[name].aggregate = async () => ({ _sum: {} });
  }
  prisma.marketplaceAppCredential.findUnique = async () => null;
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve=>server.once("listening",resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let cookie = "";
  try {
    await t.test("valid login produces a secure HttpOnly same-origin cookie and restores session", async () => {
      const res = await fetch(base+"/api/auth/login", { method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({email:user.email,password:"isolated-test-password"}) });
      assert.equal(res.status, 200);
      const c = res.headers.getSetCookie().find(c=>c.startsWith("session="))!;
      assert.ok(c.includes("HttpOnly") && c.includes("SameSite=Lax") && c.includes("Secure"));
      cookie = c.split(";")[0];
      const me = await fetch(base+"/api/auth/me",{headers:{cookie}});
      assert.equal(me.status,200);
      assert.equal((await me.json()).user.id,user.id);
    });
    for (const path of ["dashboard", "dashboard/by-marketplace", "dashboard/recent-orders", "faturamento", "pedidos", "produtos", "curva-abc", "custos", "financeiro", "financeiro/conciliacao", "publicidade", "settings", "integrations", "sync/history", "users"]) {
      await t.test(`GET /${path} handles an empty company`, async () => {
        const res = await fetch(`${base}/api/${path}`, { headers: { cookie } });
        assert.equal(res.status,200,await res.clone().text());
        assert.match(res.headers.get("content-type")!, /application\/json/);
      });
    }
    await t.test("all report types return a meaningful empty result", async () => {
      for(const type of ["vendas","produtos","curva-abc","lucro","financeiro","publicidade"]){
        const res=await fetch(`${base}/api/relatorios/${type}`,{headers:{cookie}});
        assert.equal(res.status,200,type);
        assert.equal((await res.json()).hasData,false,type);
      }
    });
    await t.test("custom date ranges include the final day in São Paulo time", () => {
      const r=resolveRangeFromQuery({from:"2026-10-01",to:"2026-10-28"});
      assert.equal(r.from.toISOString(),"2026-10-01T03:00:00.000Z");
      assert.equal(r.to.toISOString(),"2026-10-29T02:59:59.999Z");
    });
    await t.test("invalid dates and malformed JSON produce 400 instead of 500", async () => {
      assert.equal((await fetch(`${base}/api/dashboard?from=invalid&to=2026-10-28`,{headers:{cookie}})).status,400);
      assert.equal((await fetch(`${base}/api/dashboard?from=2026-10-29&to=2026-10-28`,{headers:{cookie}})).status,400);
      const res=await fetch(base+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:"{"});
      assert.equal(res.status,400);
    });
    await t.test("generic settings cannot bypass marketplace option validation",async()=>{
      const res=await fetch(base+"/api/settings",{method:"PATCH",headers:{cookie,"content-type":"application/json"},body:JSON.stringify({settings:{marketplace_options_tiktokshop:"bad-json"}})});
      assert.equal(res.status,400);
    });
    await t.test("logout clears the browser session cookie",async()=>{
      const res=await fetch(base+"/api/auth/logout",{method:"POST",headers:{cookie}});
      assert.equal(res.status,200);
      assert.ok(res.headers.getSetCookie().some(c=>c.startsWith("session=;")&&c.includes("Expires=")));
    });
  } finally {
    await new Promise<void>(resolve=>server.close(resolve));
    await prisma.$disconnect();
  }
});
