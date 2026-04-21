import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { startHttpServer } from "./http.js"
import { buildRollorianOuraMcpServer } from "./server.js"

async function main() {
  const mode = process.argv[2] ?? process.env.ROLLORIAN_OURA_MCP_MODE ?? "stdio"

  if (mode === "http") {
    await startHttpServer()
    return
  }

  const server = buildRollorianOuraMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error("Rollorian Oura MCP failed to start:", error)
  process.exit(1)
})
