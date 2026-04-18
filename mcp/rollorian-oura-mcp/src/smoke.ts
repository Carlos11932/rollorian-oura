import assert from "node:assert/strict"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
import { CallToolResultSchema, ListToolsResultSchema } from "@modelcontextprotocol/sdk/types.js"
import type { RollorianOuraAgentClient } from "./client.js"
import { buildRollorianOuraMcpServer } from "./server.js"

async function main() {
  const mockClient = {
    getStatus: async () => ({
      connected: true,
      lastSync: null,
    }),
    getHealthDay: async (day: string) => ({
      day,
      todaySummary: {
        state: "good",
      },
    }),
    getTrends: async (window: "7d" | "30d") => ({
      window,
      sleep: { points: [] },
    }),
  } satisfies Partial<RollorianOuraAgentClient>

  const server = buildRollorianOuraMcpServer(mockClient as unknown as RollorianOuraAgentClient)
  const client = new Client({
    name: "rollorian-oura-mcp-smoke",
    version: "0.1.0",
  })
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair()

  try {
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ])

    const tools = await client.request({
      method: "tools/list",
      params: {},
    }, ListToolsResultSchema)

    assert.equal(tools.tools.length, 3)
    assert.ok(tools.tools.some((tool) => tool.name === "get_health_day"))

    const result = await client.request({
      method: "tools/call",
      params: {
        name: "get_health_day",
        arguments: {
          day: "2026-04-18",
        },
      },
    }, CallToolResultSchema)

    assert.equal(result.content[0]?.type, "text")
    assert.match(result.content[0]?.type === "text" ? result.content[0].text : "", /2026-04-18/)
  } finally {
    await server.close()
    await client.close()
  }
}

main().catch((error) => {
  console.error("Rollorian Oura MCP smoke failed:", error)
  process.exit(1)
})
