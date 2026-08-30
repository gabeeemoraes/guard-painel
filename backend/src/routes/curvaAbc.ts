import { Router } from "express";
import { requireAuth, requirePermission } from "../middleware/auth";
import { getOrCreateDefaultStore } from "../services/store";
import { computeAbcCurve, resolveRangeFromQuery, resolveProviderFromQuery } from "../services/calculations";

const router = Router();
router.use(requireAuth, requirePermission("curva-abc"));

router.get("/", async (req, res) => {
  const store = await getOrCreateDefaultStore();
  const range = resolveRangeFromQuery(req.query);
  const provider = resolveProviderFromQuery(req.query);
  const data = await computeAbcCurve(store.id, range, provider);

  const summary = { A: 0, B: 0, C: 0 } as Record<"A" | "B" | "C", number>;
  for (const item of data.classes) summary[item.class as "A" | "B" | "C"]++;

  res.json({ ...data, range, summary });
});

export default router;
