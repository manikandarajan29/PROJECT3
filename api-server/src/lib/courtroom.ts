import { callAgent, type LLMProvider } from "./llm";
import { queryPartnerTool } from "./mcp";

export interface TransactionPayload {
  transactionId: string;
  amount: number;
  currency: string;
  sourceAccount: string;
  destinationAccount: string;
  ipAddress?: string;
  deviceFingerprint?: string;
  biometricStatus?: string;
}

export interface CourtVerdict {
  evidenceDossier: string;
  prosecutorArgument: string;
  defenseArgument: string;
  devilsAdvocateArgument: string;
  judgeVerdict: string;
  parallelUniverseSimulation: string;
  riskScore: number;
  juryApprove: number;
  juryReject: number;
  juryAbstain: number;
  recommendedAction: string;
}

function buildEvidenceDossier(tx: TransactionPayload): string {
  const amountLakh = (tx.amount / 100000).toFixed(2);
  return `CASE DOSSIER — ${tx.transactionId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TRANSACTION PROFILE
  Amount:             ${tx.currency} ${tx.amount.toLocaleString("en-IN")} (${amountLakh} Lakhs)
  Source Account:     ${tx.sourceAccount}
  Destination:        ${tx.destinationAccount}
  Transaction ID:     ${tx.transactionId}

TELEMETRY SIGNALS
  IP Address:         ${tx.ipAddress ?? "NOT_PROVIDED"}
  Device Fingerprint: ${tx.deviceFingerprint ?? "NOT_PROVIDED"}
  Biometric Status:   ${tx.biometricStatus ?? "NOT_ENROLLED"}

RISK THRESHOLDS
  High-Value Flag:    YES (exceeds ₹5 Lakh threshold)
  Tier-2 Escalation:  ACTIVE
  Human Review Gate:  MANDATORY

CONTEXT
  Transaction routed to Tier-2 DecisionVerse AI Courtroom for multi-agent adversarial review.
  All arguments must be evaluated by Prosecution, Defense, and Devil's Advocate independently.
`;
}

export async function runCourtroomTrial(tx: TransactionPayload): Promise<CourtVerdict> {
  const mcpRiskIntel = await queryPartnerTool("get_account_reputation", {
    accountId: tx.sourceAccount,
  });

  const baseEvidence = buildEvidenceDossier(tx);
  const evidenceDossier = `${baseEvidence}\nPARTNER MCP RISK INTELLIGENCE:\n${mcpRiskIntel}\n`;

  const prosecutorPrompt = `You are the PROSECUTOR AGENT in a banking AI courtroom. Your role is to build the strongest possible case for why this transaction is suspicious or fraudulent. Be analytical, specific, and cite the telemetry signals as evidence. Be concise (200-300 words). Focus on anomalies, risks, and fraud vectors.`;

  const defensePrompt = `You are the DEFENSE AGENT in a banking AI courtroom. Your role is to argue why this transaction is likely legitimate and the client should not be penalized. Cite contextual factors, historical patterns, and mitigating evidence. Be concise (200-300 words). Focus on the client's perspective and business justifications.`;

  const devilsAdvocatePrompt = `You are the DEVIL'S ADVOCATE AGENT in a banking AI courtroom. Challenge both the Prosecution AND Defense assumptions. Stress-test logical gaps. Identify what both sides might be wrong about. What's the most dangerous scenario that hasn't been considered? Be contrarian and rigorous. (200-250 words)`;

  const jurorSystemPrompts = [
    `You are JUROR-ALPHA, a conservative risk-averse banking analyst. Vote only based on hard evidence.`,
    `You are JUROR-BETA, a customer-centric advocate. Weight false positives heavily.`,
    `You are JUROR-GAMMA, a cybersecurity specialist focused on digital threat vectors.`,
    `You are JUROR-DELTA, a regulatory compliance officer. Consider legal defensibility.`,
  ];

  const [prosecutorArgument, defenseArgument] = await Promise.all([
    callAgent(prosecutorPrompt, evidenceDossier, 0.2, 400, "gemini"),
    callAgent(defensePrompt, evidenceDossier, 0.3, 400, "gemini"),
  ]);

  const debateSummary = `${evidenceDossier}\n\nPROSECUTION:\n${prosecutorArgument}\n\nDEFENSE:\n${defenseArgument}`;

  const jurorProviders: LLMProvider[] = ["gemini", "gemini", "gemini", "gemini"];

  const [devilsAdvocateArgument, jurorVotes, simulationResult] = await Promise.all([
    callAgent(devilsAdvocatePrompt, debateSummary, 0.7, 350, "gemini"),
    Promise.all(
      jurorSystemPrompts.map((sys, idx) =>
        callAgent(
          sys +
            ` After reading the debate, respond with ONLY one word: APPROVE, REJECT, or ABSTAIN. Nothing else.`,
          debateSummary,
          0.3,
          10,
          jurorProviders[idx]
        )
      )
    ),
    callAgent(
      `You are the PARALLEL UNIVERSE SIMULATOR. Given this transaction debate, simulate 3 possible futures:
1. APPROVE scenario: What happens if approved? (risk/benefit)
2. REJECT scenario: What happens if rejected? (risk/benefit)  
3. VERIFY scenario: What if step-up biometric verification is required?
Be concise and analytical. (250-300 words)`,
      debateSummary,
      0.1,
      400,
      "gemini"
    ),
  ]);

  let juryApprove = 0;
  let juryReject = 0;
  let juryAbstain = 0;
  for (const vote of jurorVotes) {
    const v = vote.trim().toUpperCase();
    if (v.includes("APPROVE")) juryApprove++;
    else if (v.includes("REJECT")) juryReject++;
    else juryAbstain++;
  }

  const totalVotes = juryApprove + juryReject + juryAbstain;
  const approveRatio = juryApprove / totalVotes;

  let recommendedAction: string;
  if (approveRatio >= 0.75) {
    recommendedAction = "APPROVE";
  } else if (approveRatio <= 0.25) {
    recommendedAction = "BLOCK";
  } else {
    recommendedAction = "VERIFY";
  }

  const biometricPass = tx.biometricStatus === "PASS_MATCH";
  const highAmount = tx.amount >= 2000000;
  const suspiciousIp = !tx.ipAddress || tx.ipAddress.startsWith("185.220");

  let baseRisk = 50;
  if (highAmount) baseRisk += 15;
  if (suspiciousIp) baseRisk += 20;
  if (!biometricPass) baseRisk += 15;
  if (juryReject > juryApprove) baseRisk += 10;
  if (juryApprove > juryReject) baseRisk -= 10;
  const riskScore = Math.min(99, Math.max(10, baseRisk + (Math.random() * 10 - 5)));

  const fullDebate = `${debateSummary}\n\nDEVIL'S ADVOCATE:\n${devilsAdvocateArgument}\n\nJURY: ${juryApprove} Approve / ${juryReject} Reject / ${juryAbstain} Abstain\nSIMULATION:\n${simulationResult}`;

  const judgeVerdict = await callAgent(
    `You are the CHIEF JUDGE SYNTHESIS AGENT. You have read the full trial transcript. Synthesize a proposed verdict:
1. Summarize the key arguments from both sides
2. Note the jury split (${juryApprove} Approve / ${juryReject} Reject / ${juryAbstain} Abstain)
3. State your recommended action: ${recommendedAction}
4. Explain your judicial reasoning clearly
5. Note what the human compliance officer should consider before final adjudication
Be authoritative, balanced, and legally precise. (300-350 words)`,
    fullDebate,
    0.2,
    500,
    "gemini"
  );

  return {
    evidenceDossier,
    prosecutorArgument,
    defenseArgument,
    devilsAdvocateArgument,
    judgeVerdict,
    parallelUniverseSimulation: simulationResult,
    riskScore,
    juryApprove,
    juryReject,
    juryAbstain,
    recommendedAction,
  };
}
