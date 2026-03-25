# rollorian-oura — Requirements & Source of Truth

> See full document in Engram memory: topic_key `sdd-init/rollorian-oura`, project `rollorian-oura`

This file is a pointer. The full requirements document lives in persistent memory (Engram MCP).

## Quick reference

- **Stack**: Next.js 16, React 19, TypeScript 5 strict, Prisma 7.5+, Neon Postgres, Zod 4.3+, Tailwind 4
- **Auth**: Oura API v2 via OAuth2 (PATs deprecated since Jan 2024)
- **Endpoints**: 18 Oura API v2 endpoints documented
- **Phases**: v1.0 (foundations) → v1.1 (query API) → v1.2 (dashboard) → v2.0 (Donna integration)
- **Key decisions**: Gaps as first-class entities, confidence field per table, SleepDaily/SleepPeriod split, HeartRate as flat table
