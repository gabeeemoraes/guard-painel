import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth, requireAdmin, logAudit } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { prisma } from "../lib/prisma";
import { env } from "../env";
import { encryptSecret } from "../lib/crypto";
import { isMarketplaceProvider, MarketplaceProvider, PROVIDER_LABELS } from "../types/marketplace";
import { getMarketplaceAppCredentials, saveMarketplaceAppCredentials, marketplaceCredentialLabels } from "../services/appCredentials";
import * as shopee from "../services/shopeeClient";
import * as meli from "../services/mercadoLivreClient";
import * as tiktok from "../services/tiktokShopClient";

const router = Router();
router.param("provider", (req, res, next, value) => {
  if (!isMarketplaceProvider(value)) return res.status(404).json({ error: "Marketplace inválido." });
  next();
});

async function configured(provider: MarketplaceProvider) { return Boolean(await getMarketplaceAppCredentials(provider)); }
async function saveToken(marketplaceAccountId: string, accessToken: string, refreshToken: string, expiresAt: Date) {
  await prisma.credential.upsert({ where: { marketplaceAccountId }, create: { marketplaceAccountId, accessTokenEnc: encryptSecret(accessToken), refreshTokenEnc: encryptSecret(refreshToken), expiresAt }, update: { accessTokenEnc: encryptSecret(accessToken), refreshTokenEnc: encryptSecret(refreshToken), expiresAt } });
}

router.get("/", requireAuth, async (_req, res) => {
  const store = await getOrCreateDefaultStore();
  const accounts = await prisma.marketplaceAccount.findMany({ where: { storeId: store.id } });
  const providers: MarketplaceProvider[] = ["shopee", "mercadolivre", "tiktokshop"];
  res.json({ marketplaces: await Promise.all(providers.map(async provider => { const account=accounts.find(a=>a.provider===provider); return { provider, label:PROVIDER_LABELS[provider], configured:await configured(provider), connected:account?.status==="connected", shopName:account?.shopName??null, lastSyncAt:account?.lastSyncAt??null }; })) });
});

router.get("/:provider/status", requireAuth, async (req, res) => {
  const provider=req.params.provider as MarketplaceProvider; const store=await getOrCreateDefaultStore(); const account=await prisma.marketplaceAccount.findFirst({where:{storeId:store.id,provider}}); const isConfigured=await configured(provider);
  if(!account) return res.json({connected:false,configured:isConfigured,provider,label:PROVIDER_LABELS[provider]});
  res.json({ connected:account.status==="connected", configured:isConfigured, provider, label:PROVIDER_LABELS[provider], shopId:account.shopId, shopName:account.shopName, status:account.status, lastSyncAt:account.lastSyncAt, syncedOrders:account.syncedOrders, syncedProducts:account.syncedProducts, syncFrom:account.syncFrom, syncTo:account.syncTo });
});

router.get("/:provider/app-credentials", requireAuth, requireAdmin, async (req,res)=>{
  const provider=req.params.provider as MarketplaceProvider; const creds=await getMarketplaceAppCredentials(provider); const labels=marketplaceCredentialLabels(provider);
  res.json({ configured:Boolean(creds), source:creds?.source??null, identifier:creds?.identifier??"", secretSaved:Boolean(creds?.secret), labels });
});

const appCredentialSchema=z.object({ identifier:z.string().trim().min(1), secret:z.string().optional() });
router.put("/:provider/app-credentials", requireAuth, requireAdmin, async (req,res)=>{
  const provider=req.params.provider as MarketplaceProvider; const parsed=appCredentialSchema.safeParse(req.body); if(!parsed.success) return res.status(400).json({error:"Preencha o identificador e a credencial secreta."});
  const current=await getMarketplaceAppCredentials(provider); const secret=parsed.data.secret?.trim() || current?.secret || ""; if(!secret) return res.status(400).json({error:`Preencha ${marketplaceCredentialLabels(provider).secret}.`});
  const identifier=parsed.data.identifier.trim();
  const changed=!current || current.identifier!==identifier || current.secret!==secret;
  await saveMarketplaceAppCredentials(provider,identifier,secret);
  if(changed){
    const store=await getOrCreateDefaultStore();
    const account=await prisma.marketplaceAccount.findFirst({where:{storeId:store.id,provider}});
    if(account){
      await prisma.credential.deleteMany({where:{marketplaceAccountId:account.id}});
      await prisma.marketplaceAccount.update({where:{id:account.id},data:{status:"disconnected"}});
    }
  }
  await logAudit(req.auth!.userId,`${provider}_app_credentials_updated`,changed?"oauth_reconnect_required":"unchanged",req.ip); res.json({ok:true,reconnectRequired:changed});
});

router.get("/:provider/connect", requireAuth, requireAdmin, async (req,res)=>{
  const provider=req.params.provider as MarketplaceProvider; const c=await getMarketplaceAppCredentials(provider); if(!c) return res.status(400).json({error:`Configure as credenciais de ${PROVIDER_LABELS[provider]} na própria tela de Integrações.`});
  const redirectUrl=`${env.backendPublicUrl}/api/integrations/${provider}/callback`;
  if(provider==="shopee") return res.redirect(shopee.buildAuthUrl({partnerId:c.identifier,partnerKey:c.secret},redirectUrl));
  const state=crypto.randomBytes(16).toString("hex");
  if(provider==="mercadolivre") return res.redirect(meli.buildAuthUrl({clientId:c.identifier,clientSecret:c.secret},redirectUrl,state));
  return res.redirect(tiktok.buildAuthUrl({appKey:c.identifier,appSecret:c.secret},state));
});

router.get("/:provider/callback", async (req,res)=>{
  const provider=req.params.provider as MarketplaceProvider; const store=await getOrCreateDefaultStore();
  try {
    const c=await getMarketplaceAppCredentials(provider); if(!c) throw new Error("Credenciais do marketplace não configuradas.");
    if(provider==="shopee") { const {code,shop_id:shopId}=req.query as {code?:string;shop_id?:string}; if(!code||!shopId) return res.redirect(`${env.frontendUrl}/integracoes?error=parametros_ausentes&provider=${provider}`); const token=await shopee.exchangeCodeForToken({partnerId:c.identifier,partnerKey:c.secret},code,shopId); if(!token.access_token) throw new Error(token.message||"falha_ao_autenticar"); const account=await prisma.marketplaceAccount.upsert({where:{storeId_provider:{storeId:store.id,provider}},create:{storeId:store.id,provider,shopId:String(shopId),status:"connected"},update:{shopId:String(shopId),status:"connected"}}); await saveToken(account.id,token.access_token,token.refresh_token,new Date(Date.now()+token.expire_in*1000)); }
    else if(provider==="mercadolivre") { const {code}=req.query as {code?:string}; if(!code) return res.redirect(`${env.frontendUrl}/integracoes?error=parametros_ausentes&provider=${provider}`); const redirectUrl=`${env.backendPublicUrl}/api/integrations/${provider}/callback`; const token=await meli.exchangeCodeForToken({clientId:c.identifier,clientSecret:c.secret},code,redirectUrl); if(!token.access_token) throw new Error(token.message||"falha_ao_autenticar"); const account=await prisma.marketplaceAccount.upsert({where:{storeId_provider:{storeId:store.id,provider}},create:{storeId:store.id,provider,shopId:String(token.user_id),status:"connected"},update:{shopId:String(token.user_id),status:"connected"}}); await saveToken(account.id,token.access_token,token.refresh_token,new Date(Date.now()+token.expires_in*1000)); }
    else { const {code}=req.query as {code?:string}; if(!code) return res.redirect(`${env.frontendUrl}/integracoes?error=parametros_ausentes&provider=${provider}`); const app={appKey:c.identifier,appSecret:c.secret}; const token=await tiktok.exchangeCodeForToken(app,code); if(!token.access_token) throw new Error(token.message||"falha_ao_autenticar"); const shops:any=await tiktok.getAuthorizedShops(app,token.access_token); const shop=shops?.data?.shops?.[0]; if(!shop) throw new Error("nenhuma_loja_autorizada"); const account=await prisma.marketplaceAccount.upsert({where:{storeId_provider:{storeId:store.id,provider}},create:{storeId:store.id,provider,shopId:String(shop.id),shopCipher:shop.cipher,shopName:shop.name,status:"connected"},update:{shopId:String(shop.id),shopCipher:shop.cipher,shopName:shop.name,status:"connected"}}); await saveToken(account.id,token.access_token,token.refresh_token,new Date(token.access_token_expire_in*1000)); }
    await logAudit(null,`${provider}_connected`); return res.redirect(`${env.frontendUrl}/integracoes?success=1&provider=${provider}`);
  } catch(err:any) { return res.redirect(`${env.frontendUrl}/integracoes?error=${encodeURIComponent(String(err?.message??err))}&provider=${provider}`); }
});

router.post("/:provider/disconnect", requireAuth, requireAdmin, async (req,res)=>{ const provider=req.params.provider as MarketplaceProvider; const store=await getOrCreateDefaultStore(); const account=await prisma.marketplaceAccount.findFirst({where:{storeId:store.id,provider}}); if(!account) return res.json({ok:true}); await prisma.credential.deleteMany({where:{marketplaceAccountId:account.id}}); await prisma.marketplaceAccount.update({where:{id:account.id},data:{status:"disconnected"}}); await logAudit(req.auth!.userId,`${provider}_disconnected`,`shop_id=${account.shopId}`,req.ip); res.json({ok:true}); });
export default router;
