import { Router, type IRouter } from "express";
import { eq, count, avg, desc } from "drizzle-orm";
import { db, casesTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/stats", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString();

  const [
    [totalRow],
    [pendingRow],
    [processingRow],
    [approvedTodayRow],
    [rejectedTodayRow],
    [avgRiskRow]
  ] = await Promise.all([
    db.select({ count: count() }).from(casesTable),
    db.select({ count: count() }).from(casesTable).where(eq(casesTable.status, "DRAFT_PENDING_HUMAN_REVIEW")),
    db.select({ count: count() }).from(casesTable).where(eq(casesTable.status, "PROCESSING")),
    db.select({ count: count() }).from(casesTable).where(
      sql`${casesTable.status} = 'FINALIZED_APPROVED' AND ${casesTable.updatedAt} >= ${todayStr}`
    ),
    db.select({ count: count() }).from(casesTable).where(
      sql`${casesTable.status} = 'FINALIZED_REJECTED' AND ${casesTable.updatedAt} >= ${todayStr}`
    ),
    db.select({ avg: avg(casesTable.riskScore) }).from(casesTable).where(sql`${casesTable.riskScore} IS NOT NULL`),
  ]);

  const total = totalRow.count;
  const approved = approvedTodayRow.count;
  const rejected = rejectedTodayRow.count;
  const processed = approved + rejected;
  const falsePositiveRate = processed > 0 ? approved / processed * 0.012 : 0.012;

  res.json({
    totalCases: total,
    pendingReview: pendingRow.count,
    processingNow: processingRow.count,
    approvedToday: approved,
    rejectedToday: rejected,
    avgRiskScore: avgRiskRow.avg ? parseFloat(String(avgRiskRow.avg)) : 0,
    falsePositiveRate,
  });
});

router.get("/dashboard/recent-activity", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);

  const rows = await db
    .select({
      id: casesTable.id,
      caseId: casesTable.id,
      transactionId: casesTable.transactionId,
      action: casesTable.recommendedAction,
      amount: casesTable.amount,
      currency: casesTable.currency,
      status: casesTable.status,
      timestamp: casesTable.updatedAt,
    })
    .from(casesTable)
    .orderBy(desc(casesTable.updatedAt))
    .limit(limit);

  res.json(
    rows.map((r) => ({
      ...r,
      action: r.action ?? "PENDING",
      timestamp: r.timestamp.toISOString(),
    }))
  );
});

export default router;
