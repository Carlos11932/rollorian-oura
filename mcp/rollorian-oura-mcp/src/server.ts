import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { RollorianOuraAgentClient } from "./client.js"

function toStructuredContent(output: unknown): Record<string, unknown> {
  if (output && typeof output === "object" && !Array.isArray(output)) {
    return output as Record<string, unknown>
  }

  return { result: output }
}

function asToolResult(output: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(output, null, 2),
      },
    ],
    structuredContent: toStructuredContent(output),
  }
}

export function buildRollorianOuraMcpServer(client = new RollorianOuraAgentClient()) {
  const server = new McpServer({
    name: "rollorian-oura-mcp",
    version: "0.1.0",
  })

  server.registerTool(
    "get_status",
    {
      title: "Get Oura status",
      description: "Return the Rollorian Oura connection and sync status.",
      inputSchema: {},
    },
    async () => asToolResult(await client.getStatus()),
  )

  server.registerTool(
    "get_health_day",
    {
      title: "Get daily health snapshot",
      description: "Return the aggregated daily health snapshot for a specific day.",
      inputSchema: {
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      },
    },
    async ({ day }) => asToolResult(await client.getHealthDay(day)),
  )

  server.registerTool(
    "get_trends",
    {
      title: "Get health trends",
      description: "Return the 7-day or 30-day Rollorian Oura trend snapshot.",
      inputSchema: {
        window: z.enum(["7d", "30d"]).default("7d"),
      },
    },
    async ({ window }) => asToolResult(await client.getTrends(window)),
  )

  return server
}
