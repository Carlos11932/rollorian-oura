# Rollorian Oura

Aplicacion Next.js para consumir la API de Oura, persistir datos en Postgres y exponer:

- interfaz propia de salud y recuperacion
- rutas internas para Donna
- Agent API privada para companeros y clientes MCP
- sincronizacion manual y por cron

## Arquitectura de datos

- El runtime usa Prisma con el schema `oura`.
- La base puede estar compartida con otras apps, asi que este proyecto no debe mutar la DB durante `build`.
- Los cambios de schema deben ejecutarse con comandos explicitos de Prisma.

## Variables de entorno

Consulta [.env.example](/C:/Users/Carlo/Desktop/proyectos/rollorian-oura-agent-platform-v1/.env.example).

Minimas para runtime:

- `DATABASE_URL`
- `OURA_CLIENT_ID`
- `OURA_CLIENT_SECRET`
- `INTERNAL_API_KEY`
- `CRON_SECRET`

Para OAuth web:

- `NEXTAUTH_URL`
- `OURA_REDIRECT_URI` opcional para sobreescribir la callback inferida

`DIRECT_URL` se usa solo para Prisma CLI y migraciones.

## Desarrollo

```bash
npm install
npm run dev
```

## Build y despliegue

```bash
npm run build
```

El build ya no ejecuta `prisma db push`.

Para cambios de schema en desarrollo:

```bash
npm run db:migrate
```

Para aplicar migraciones en despliegue:

```bash
npm run db:migrate:deploy
```

## Validacion

```bash
npm test
npm run lint
npm run build
```

Validacion del MCP:

```bash
cd mcp/rollorian-oura-mcp
npm ci
npm run build
npm run smoke
```

## Agent Platform

Management API protegida por `x-api-key`:

- `GET /api/agent-clients`
- `POST /api/agent-clients`
- `POST /api/agent-clients/[agentClientId]/credentials`
- `POST /api/agent-clients/[agentClientId]/credentials/[credentialId]/revoke`
- `POST /api/agent-clients/[agentClientId]/revoke`

Agent API protegida por bearer token:

- `GET /api/agent/v1/status`
- `GET /api/agent/v1/health?day=YYYY-MM-DD`
- `GET /api/agent/v1/trends?window=7d|30d`

Documentacion adicional:

- [docs/agent-platform.md](/C:/Users/Carlo/Desktop/proyectos/rollorian-oura-agent-platform-v1/docs/agent-platform.md)
- [contracts/agent/README.md](/C:/Users/Carlo/Desktop/proyectos/rollorian-oura-agent-platform-v1/contracts/agent/README.md)
