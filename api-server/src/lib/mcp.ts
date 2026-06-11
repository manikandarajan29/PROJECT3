import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { logger } from "./logger";

let mcpClient: Client | null = null;
let isConnecting = false;

/**
 * Initialize and connect to the partner MCP server lazily.
 */
export async function getMcpClient(): Promise<Client | null> {
  if (mcpClient) return mcpClient;
  if (isConnecting) {
    // Return null or wait. For courtroom execution simplicity, return null to avoid race conditions.
    return null;
  }

  const mcpType = process.env.MCP_SERVER_TYPE;
  const mcpUrl = process.env.MCP_SERVER_URL;
  const mcpCmd = process.env.MCP_SERVER_CMD;
  const mcpArgs = process.env.MCP_SERVER_ARGS;

  logger.info({ mcpType, mcpUrl, mcpCmd, mcpArgs }, "Checking partner MCP Server configurations");

  if (!mcpType) {
    logger.info("Partner MCP Server not configured (MCP_SERVER_TYPE is missing). Skipping connection.");
    return null;
  }

  isConnecting = true;
  try {
    const client = new Client(
      { name: "decisionverse-client", version: "1.0.0" },
      { capabilities: {} }
    );

    let transport;
    if (mcpType === "sse" && mcpUrl) {
      logger.info({ mcpUrl }, "Connecting to remote partner MCP server via SSE");
      transport = new SSEClientTransport(new URL(mcpUrl));
    } else if (mcpType === "stdio" && mcpCmd) {
      logger.info({ mcpCmd, mcpArgs }, "Connecting to local partner MCP server via stdio");
      const argsArray = mcpArgs ? mcpArgs.split(" ") : [];
      transport = new StdioClientTransport({
        command: mcpCmd,
        args: argsArray,
      });
    } else {
      throw new Error(`Unsupported or misconfigured MCP transport: ${mcpType}`);
    }

    await client.connect(transport);
    logger.info("Successfully connected to partner MCP server.");
    mcpClient = client;
    return mcpClient;
  } catch (err: any) {
    logger.error({ error: err.message || err }, "Failed to establish partner MCP connection.");
    return null;
  } finally {
    isConnecting = false;
  }
}

/**
 * Call a partner tool dynamically. Falls back to a safe placeholder message on failure or if offline.
 */
export async function queryPartnerTool(toolName: string, args: Record<string, any>): Promise<string> {
  const client = await getMcpClient();
  if (!client) {
    logger.debug("Partner MCP Server is offline or not configured. Skipping integration.");
    return "PARTNER DATA: [Partner database connection offline. Skipping intelligence query]";
  }

  try {
    logger.info({ toolName, arguments: args }, "Querying partner MCP server tool");
    const response = (await client.callTool({
      name: toolName,
      arguments: args,
    })) as any;

    if (!response || !response.content) {
      return "PARTNER DATA: [No response content returned from partner database]";
    }

    const textContent = response.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n");

    return textContent || "PARTNER DATA: [Partner tool returned empty content]";
  } catch (err: any) {
    logger.warn({ toolName, error: err.message || err }, "Partner MCP tool query failed");
    return `PARTNER DATA: [Failed to query partner database: ${err.message || err}]`;
  }
}
