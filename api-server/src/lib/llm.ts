import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "./logger";

// Lazy-initialized clients
let geminiClient: GoogleGenerativeAI | null = null;

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }
  return geminiClient;
}

export type LLMProvider = "gemini";

async function executeGemini(
  systemPrompt: string,
  userContent: string,
  temperature: number,
  maxTokens: number
): Promise<string> {
  const client = getGeminiClient();
  if (!client) throw new Error("Gemini API key not configured");

  const model = client.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemPrompt,
  });

  const response = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  });

  return response.response.text();
}

function parseDossier(text: string) {
  const amountMatch = text.match(/Amount:\s*([^\n\r]+)/);
  const sourceMatch = text.match(/Source Account:\s*([^\n\r]+)/);
  const destMatch = text.match(/Destination:\s*([^\n\r]+)/);
  const ipMatch = text.match(/IP Address:\s*([^\n\r]+)/);
  const bioMatch = text.match(/Biometric Status:\s*([^\n\r]+)/);
  
  return {
    amount: amountMatch ? amountMatch[1].trim() : "₹20,00,000",
    source: sourceMatch ? sourceMatch[1].trim() : "ACC-HNI-ROHAN-MEHTA-2211",
    destination: destMatch ? destMatch[1].trim() : "ACC-INTL-SINGAPORE-7654",
    ipAddress: ipMatch ? ipMatch[1].trim() : "103.87.104.22",
    biometricStatus: bioMatch ? bioMatch[1].trim() : "FAIL_MISMATCH",
  };
}

function generateMockResponse(systemPrompt: string, userContent: string): string {
  const data = parseDossier(userContent);
  const sysUpper = systemPrompt.toUpperCase();

  if (sysUpper.includes("PROSECUTOR")) {
    return `As the Prosecution Agent, I submit that this transaction of ${data.amount} from ${data.source} to ${data.destination} presents severe risk indicators that warrant immediate block and review.
   
Key Risk Factors Identified:
1. High-Value Profile: The transfer of ${data.amount} is a substantial outflow that exceeds standard high-risk transaction thresholds.
2. Telemetry Anomalies: The routing via IP Address ${data.ipAddress} shows high divergence from the customer's typical geographical telemetry profile.
3. Security Gate Status: The biometric validation result is "${data.biometricStatus}". This represents a critical failure of step-up verification, suggesting a high probability of account takeover or device spoofing.
   
Allowing this transaction to proceed is a direct violation of our risk parameters. We request a mandatory block on this transfer.`;
  }

  if (sysUpper.includes("DEFENSE")) {
    return `As the Defense Agent, I argue for the legitimacy and approval of this transaction. While the Prosecution focuses purely on raw risk scores, we must consider the business context:
   
Contextual Mitigating Factors:
1. Business Continuity: The source account ${data.source} is a established business relationship. Restricting this payment of ${data.amount} to ${data.destination} could cause severe reputational damage and operational gridlock.
2. Behavioral Normalcy: High-value transactions are normal during this business cycle. A biometric status of "${data.biometricStatus}" can easily result from environmental factors (poor lighting, temporary camera issues) and should not be treated as a definitive fraud signal.
3. Network Consistency: The destination account has a long history of receiving payments from our network.
   
We recommend resolving this by clearing the transaction or placing it in a temporary pending state for human confirmation rather than blocking it outright.`;
  }

  if (sysUpper.includes("DEVIL'S ADVOCATE") || sysUpper.includes("DEVILS ADVOCATE")) {
    return `As Devil's Advocate, I must stress-test the assumptions of both sides.
   
To the Prosecution: You assume a biometric state of "${data.biometricStatus}" implies fraud. But if this is a false positive, blocking a critical ${data.amount} transaction could drive a high-net-worth client to close their account. Have we evaluated the financial impact of customer churn vs. the fraud risk?
   
To the Defense: You attribute the biometric anomaly to camera issues. But what if this is a sophisticated 'Man-in-the-Middle' or SIM-swapping attack bypassing normal device recognition? Why did the IP address switch to ${data.ipAddress} precisely when this transfer was initiated?
   
The most dangerous scenario is that the client's credentials are completely compromised, and they are currently unaware. We need to look beyond automated biometrics.`;
  }

  if (sysUpper.includes("JUROR-ALPHA")) {
    return userContent.includes("FAIL_MISMATCH") ? "REJECT" : "APPROVE";
  }

  if (sysUpper.includes("JUROR-BETA")) {
    return "APPROVE";
  }

  if (sysUpper.includes("JUROR-GAMMA")) {
    return userContent.includes("FAIL_MISMATCH") || userContent.includes("185.220") ? "REJECT" : "APPROVE";
  }

  if (sysUpper.includes("JUROR-DELTA")) {
    return "ABSTAIN";
  }

  if (sysUpper.includes("PARALLEL UNIVERSE")) {
    return `PARALLEL UNIVERSE SIMULATION REPORT:
   
1. APPROVE Scenario (Risk/Benefit):
   - Benefit: Transaction of ${data.amount} completes instantly. Client relationship is preserved; business processes proceed without disruption.
   - Risk: If this is fraud, the funds are unrecoverable once routed to ${data.destination}. The bank faces liability, regulatory audit, and loss of confidence.
   
2. REJECT Scenario (Risk/Benefit):
   - Benefit: Prevents potential loss of ${data.amount} if the transfer is malicious. Protects the account from unauthorized drainage.
   - Risk: If legitimate, the customer faces severe disruption. Reputation damage to the bank for an unnecessary block of valid business operations.
   
3. STEP-UP VERIFICATION Scenario (Recommended):
   - Triggers secondary manual verification channels (voice/identity check). Neutralizes biometric failure ambiguity with minimal delay.`;
  }

  if (sysUpper.includes("JUDGE") || sysUpper.includes("SYNTHESIS")) {
    const isReject = userContent.includes("REJECT") && (userContent.split("REJECT").length - 1) >= 2;
    const action = isReject ? "BLOCK" : "VERIFY";
    return `JUDICIAL DETERMINATION & VERDICT SYNTHESIS
   
Having reviewed the case dossier for transaction ${data.amount} and the adversarial arguments presented, the court rules as follows:
   
1. Synthesis of Arguments:
   - The Prosecution raised critical concerns regarding the biometric status "${data.biometricStatus}" and geographic telemetry anomalies.
   - The Defense highlighted the transactional history of source account ${data.source} and the high impact of false positives.
   - The Devil's Advocate exposed vulnerabilities in both arguments, warning of sophisticated account hijacking.
   
2. Jury Consensus:
   - The Heterogeneous Jury has voted. Based on the risk signals, the consensus recommendation is to ${action} the transaction.
   
3. Final Court Ruling:
   - Action: ${action === "BLOCK" ? "BLOCK" : "STEP-UP VERIFY"}
   - Justification: The presence of unresolved telemetry anomalies and critical biometric validation mismatch poses an unacceptable security vulnerability. Proceeding without secondary authentication is legally indefensible.
   - Compliance Notice: Human compliance officer should perform voice verification before overriding this ruling.`;
  }

  return "Trial observation recorded. The agent suggests proceeding with security review.";
}

/**
 * Execute agent call with Gemini and graceful fallback if the call fails or is not configured.
 */
export async function callAgent(
  systemPrompt: string,
  userContent: string,
  temperature: number = 0.5,
  maxTokens: number = 800,
  preferredProvider?: LLMProvider
): Promise<string> {
  const hasGemini = !!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith("AQ.Ab8");
  let lastError: any = null;

  if (hasGemini) {
    try {
      logger.info({ provider: "gemini", model: "gemini-1.5-flash" }, `Routing agent call`);
      const result = await executeGemini(systemPrompt, userContent, temperature, maxTokens);
      return result;
    } catch (err: any) {
      lastError = err;
      logger.warn({ provider: "gemini", error: err.message || err }, `Gemini execution failed, attempting fallback`);
    }
  }

  // If we reach here, Gemini failed or is not configured. Instead of crashing, trigger local mock generator to preserve demo!
  logger.warn("⚠️ Gemini API call failed or is not configured. Falling back to local Mock agent response generator.");
  try {
    const mockResponse = generateMockResponse(systemPrompt, userContent);
    return mockResponse;
  } catch (mockErr: any) {
    const errorMsg = lastError?.message || lastError || "Gemini provider could not be initialized (missing/invalid API key)";
    logger.error({ error: errorMsg }, `Gemini execution attempt and Mock generation failed`);
    throw new Error(`Courtroom LLM Error: ${errorMsg}`);
  }
}
