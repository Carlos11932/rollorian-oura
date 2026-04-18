# Rollorian Oura Agent API

Private Agent API for MCP clients and companions. The API is app-scoped and read-only in v1.

## Auth

- Agent API: `Authorization: Bearer <issued-agent-token>`
- Management API: `x-api-key: <INTERNAL_API_KEY>`

## Management endpoints

- `GET /api/agent-clients`
- `POST /api/agent-clients`
- `POST /api/agent-clients/[agentClientId]/credentials`
- `POST /api/agent-clients/[agentClientId]/credentials/[credentialId]/revoke`
- `POST /api/agent-clients/[agentClientId]/revoke`

## Agent API endpoints

- `GET /api/agent/v1/status`
- `GET /api/agent/v1/health?day=YYYY-MM-DD`
- `GET /api/agent/v1/trends?window=7d|30d`

## Scopes

- `status:read`
- `health:read`
- `trends:read`

## Examples

- [status.response.json](./status.response.json)
- [health.response.json](./health.response.json)
- [trends.response.json](./trends.response.json)
- [errors/unauthorized.json](./errors/unauthorized.json)
- [errors/forbidden.json](./errors/forbidden.json)

## Compatibility

Donna internal routes remain available:

- `GET /api/internal/donna/status`
- `GET /api/internal/donna/context/health?day=YYYY-MM-DD`
- `GET /api/internal/donna/context/trends?window=7d|30d`
