import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, casesTable, transcriptsTable } from "@workspace/db";
import { IngestTransactionBody, AdjudicateCaseBody } from "@workspace/api-zod";
import { runCourtroomTrial } from "../lib/courtroom";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.post("/trials/ingest", async (req, res): Promise<void> => {
  const parsed = IngestTransactionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { transactionId, amount, currency, sourceAccount, destinationAccount, telemetry } = parsed.data;

  const [existing] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.transactionId, transactionId));

  if (existing) {
    res.status(409).json({ error: "Transaction already ingested", caseId: existing.id });
    return;
  }

  const [newCase] = await db
    .insert(casesTable)
    .values({
      transactionId,
      amount,
      currency: currency ?? "INR",
      sourceAccount,
      destinationAccount,
      ipAddress: telemetry?.ipAddress ?? null,
      deviceFingerprint: telemetry?.deviceFingerprint ?? null,
      biometricStatus: telemetry?.biometricStatus ?? null,
      status: "PROCESSING",
    })
    .returning();

  res.status(202).json({
    caseId: newCase.id,
    status: "PROCESSING_INITIATED",
    estimatedExecutionMs: 4200,
  });

  setImmediate(async () => {
    try {
      logger.info({ caseId: newCase.id }, "Starting courtroom trial");

      const verdict = await runCourtroomTrial({
        transactionId,
        amount,
        currency: currency ?? "INR",
        sourceAccount,
        destinationAccount,
        ipAddress: telemetry?.ipAddress,
        deviceFingerprint: telemetry?.deviceFingerprint,
        biometricStatus: telemetry?.biometricStatus,
      });

      await db.insert(transcriptsTable).values({
        caseId: newCase.id,
        evidenceDossier: verdict.evidenceDossier,
        prosecutorArgument: verdict.prosecutorArgument,
        defenseArgument: verdict.defenseArgument,
        devilsAdvocateArgument: verdict.devilsAdvocateArgument,
        judgeVerdict: verdict.judgeVerdict,
        parallelUniverseSimulation: verdict.parallelUniverseSimulation,
      });

      await db
        .update(casesTable)
        .set({
          status: "DRAFT_PENDING_HUMAN_REVIEW",
          riskScore: verdict.riskScore,
          juryApprove: verdict.juryApprove,
          juryReject: verdict.juryReject,
          juryAbstain: verdict.juryAbstain,
          recommendedAction: verdict.recommendedAction,
        })
        .where(eq(casesTable.id, newCase.id));

      logger.info({ caseId: newCase.id, riskScore: verdict.riskScore }, "Trial complete");
    } catch (err) {
      logger.error({ err, caseId: newCase.id }, "Trial failed");
      await db
        .update(casesTable)
        .set({ status: "ERROR" })
        .where(eq(casesTable.id, newCase.id));
    }
  });
});

router.post("/trials/adjudicate", async (req, res): Promise<void> => {
  const parsed = AdjudicateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { caseId, action, complianceOfficerId, justificationNotes } = parsed.data;

  const [existing] = await db
    .select()
    .from(casesTable)
    .where(eq(casesTable.id, caseId));

  if (!existing) {
    res.status(404).json({ error: "Case not found" });
    return;
  }

  if (existing.status !== "DRAFT_PENDING_HUMAN_REVIEW") {
    res.status(409).json({ error: "Case is not pending review", status: existing.status });
    return;
  }

  const newStatus =
    action === "APPROVE_VERDICT" ? "FINALIZED_APPROVED" : "FINALIZED_REJECTED";

  await db
    .update(casesTable)
    .set({
      status: newStatus,
      complianceOfficerId: complianceOfficerId ?? null,
      justificationNotes: justificationNotes ?? null,
    })
    .where(eq(casesTable.id, caseId));

  logger.info({ caseId, action, complianceOfficerId }, "Case adjudicated");

  res.json({
    caseId,
    status: newStatus,
    timestamp: new Date().toISOString(),
  });
});

router.post("/trials/demo", async (req, res): Promise<void> => {
  const demoScenarios = [
    {
      transactionId: `TXN-DEMO-${Date.now()}`,
      amount: 2000000,
      currency: "INR",
      sourceAccount: "ACC-CORP-MAHINDRA-7712",
      destinationAccount: "ACC-VENDOR-BERLIN-9941",
      telemetry: {
        ipAddress: "185.220.101.5",
        deviceFingerprint: `dev_mac_${Math.floor(Math.random() * 9000000 + 1000000)}`,
        biometricStatus: "PASS_MATCH",
      },
    },
    {
      transactionId: `TXN-DEMO-${Date.now()}`,
      amount: 5000000,
      currency: "INR",
      sourceAccount: "ACC-HNI-ROHAN-MEHTA-2211",
      destinationAccount: "ACC-INTL-SINGAPORE-7654",
      telemetry: {
        ipAddress: "103.87.104.22",
        deviceFingerprint: `dev_iphone_${Math.floor(Math.random() * 9000000 + 1000000)}`,
        biometricStatus: "FAIL_MISMATCH",
      },
    },
    {
      transactionId: `TXN-DEMO-${Date.now()}`,
      amount: 1500000,
      currency: "INR",
      sourceAccount: "ACC-SME-TEXTILES-4490",
      destinationAccount: "ACC-SUPPLIER-DUBAI-3321",
      telemetry: {
        ipAddress: "45.148.10.73",
        deviceFingerprint: `dev_android_${Math.floor(Math.random() * 9000000 + 1000000)}`,
        biometricStatus: "PASS_MATCH",
      },
    },
  ];

  const scenario = demoScenarios[Math.floor(Math.random() * demoScenarios.length)];

  const { telemetry, ...insertableScenario } = scenario;
  const [newCase] = await db
    .insert(casesTable)
    .values({
      ...insertableScenario,
      ipAddress: scenario.telemetry.ipAddress,
      deviceFingerprint: scenario.telemetry.deviceFingerprint,
      biometricStatus: scenario.telemetry.biometricStatus,
      status: "PROCESSING",
    })
    .returning();

  res.status(202).json({
    caseId: newCase.id,
    status: "PROCESSING_INITIATED",
    estimatedExecutionMs: 4200,
  });

  setImmediate(async () => {
    try {
      logger.info({ caseId: newCase.id }, "Starting demo courtroom trial");

      const verdict = await runCourtroomTrial({
        transactionId: scenario.transactionId,
        amount: scenario.amount,
        currency: scenario.currency,
        sourceAccount: scenario.sourceAccount,
        destinationAccount: scenario.destinationAccount,
        ipAddress: scenario.telemetry.ipAddress,
        deviceFingerprint: scenario.telemetry.deviceFingerprint,
        biometricStatus: scenario.telemetry.biometricStatus,
      });

      await db.insert(transcriptsTable).values({
        caseId: newCase.id,
        evidenceDossier: verdict.evidenceDossier,
        prosecutorArgument: verdict.prosecutorArgument,
        defenseArgument: verdict.defenseArgument,
        devilsAdvocateArgument: verdict.devilsAdvocateArgument,
        judgeVerdict: verdict.judgeVerdict,
        parallelUniverseSimulation: verdict.parallelUniverseSimulation,
      });

      await db
        .update(casesTable)
        .set({
          status: "DRAFT_PENDING_HUMAN_REVIEW",
          riskScore: verdict.riskScore,
          juryApprove: verdict.juryApprove,
          juryReject: verdict.juryReject,
          juryAbstain: verdict.juryAbstain,
          recommendedAction: verdict.recommendedAction,
        })
        .where(eq(casesTable.id, newCase.id));

      logger.info({ caseId: newCase.id }, "Demo trial complete");
    } catch (err) {
      logger.error({ err, caseId: newCase.id }, "Demo trial failed");
      await db
        .update(casesTable)
        .set({ status: "ERROR" })
        .where(eq(casesTable.id, newCase.id));
    }
  });
});

export default router;
