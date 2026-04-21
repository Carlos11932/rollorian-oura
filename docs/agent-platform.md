# Rollorian Oura Agent Platform

`rollorian-oura` exposes a private Agent API for local companions and MCP clients.

## Architecture

`domain services -> Agent API HTTP -> MCP server`

- Domain services stay in `src/features/oura/server/*`
- Agent auth, scopes, audit, and credential management live in `src/lib/agents`
- MCP lives in `mcp/rollorian-oura-mcp` and only calls HTTP

## Management surface

Management uses `x-api-key` with `INTERNAL_API_KEY`:

- `GET /api/agent-clients`
- `POST /api/agent-clients`
- `POST /api/agent-clients/[agentClientId]/credentials`
- `POST /api/agent-clients/[agentClientId]/credentials/[credentialId]/revoke`
- `POST /api/agent-clients/[agentClientId]/revoke`

## Agent API

- `GET /api/agent/v1/status`
- `GET /api/agent/v1/health?day=YYYY-MM-DD`
- `GET /api/agent/v1/trends?window=7d|30d`

## Scopes

- `status:read`
- `health:read`
- `trends:read`

## Validation

```bash
npm test
npm run lint
npm run build
cd mcp/rollorian-oura-mcp
npm ci
npm run build
npm run smoke
```
