import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, casesTable, transcriptsTable } from "@workspace/db";
import {
  GetCaseParams,
  GetCaseTranscriptParams,
  ListCasesQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cases", async (req, res): Promise<void> => {
  const query = ListCasesQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { status, limit = 50, offset = 0 } = query.data;

  const rows = await db
    .select()
    .from(casesTable)
    .where(status ? eq(casesTable.status, status) : undefined)
    .orderBy(desc(casesTable.createdAt))
    .limit(limit)
    .offset(offset);

  res.json(rows);
});

router.get("/cases/:id", async (req, res): Promise<void> => {
  const params = GetCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.id, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  res.json(row);
});

router.get("/cases/:id/transcript", async (req, res): Promise<void> => {
  const params = GetCaseTranscriptParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select()
    .from(transcriptsTable)
    .where(eq(transcriptsTable.caseId, params.data.id));

  if (!row) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }

  res.json(row);
});

export default router;
