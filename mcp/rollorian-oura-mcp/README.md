# Rollorian Oura MCP

Private MCP server for `rollorian-oura`. It does not access Prisma or the database directly. It only calls the Agent API:

- `GET /api/agent/v1/status`
- `GET /api/agent/v1/health?day=YYYY-MM-DD`
- `GET /api/agent/v1/trends?window=7d|30d`

## Environment

```bash
ROLLORIAN_OURA_BASE_URL=https://your-rollorian-oura.vercel.app
ROLLORIAN_OURA_AGENT_TOKEN=your-issued-agent-token
ROLLORIAN_OURA_MCP_MODE=stdio
ROLLORIAN_OURA_MCP_HTTP_HOST=127.0.0.1
ROLLORIAN_OURA_MCP_HTTP_PORT=8788
```

## Install

```bash
cd mcp/rollorian-oura-mcp
npm ci
```

## Build and smoke test

```bash
npm run build
npm run smoke
```

## Tools

- `get_status`
- `get_health_day`
- `get_trends`

## Related docs

- Product-facing overview: `../../docs/agent-platform.md`
- Agent contract examples: `../../contracts/agent/README.md`
