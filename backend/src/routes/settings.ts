import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(requireAuth);

router.get("/", async (_req, res) => {
  const store = await getOrCreateDefaultStore();
  const settings = await prisma.setting.findMany({ where: { storeId: store.id } });
  const map: Record<string, string> = {};
  for (const s of settings) map[s.key] = s.value;
  res.json({ storeName: store.name, settings: map });
});

const updateSchema = z.object({
  storeName: z.string().min(1).optional(),
  settings: z.record(z.string()).optional(),
});

router.patch("/", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Dados inválidos." });

  const store = await getOrCreateDefaultStore();
  if (parsed.data.storeName) {
    await prisma.store.update({ where: { id: store.id }, data: { name: parsed.data.storeName } });
  }
  if (parsed.data.settings) {
    for (const [key, value] of Object.entries(parsed.data.settings)) {
      await prisma.setting.upsert({
        where: { storeId_key: { storeId: store.id, key } },
        create: { storeId: store.id, key, value },
        update: { value },
      });
    }
  }
  res.json({ ok: true });
});

export default router;
