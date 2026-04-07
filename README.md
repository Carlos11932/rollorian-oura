# Rollorian Oura

Aplicacion Next.js para consumir la API de Oura, persistir datos en Postgres y exponer:

- interfaz propia de salud y recuperacion
- rutas internas para Donna
- sincronizacion manual y por cron

## Arquitectura de datos

- El runtime usa Prisma con el schema `oura`.
- La base puede estar compartida con otras apps, asi que este proyecto no debe mutar la DB durante `build`.
- Los cambios de schema deben ejecutarse con comandos explicitos de Prisma.

## Variables de entorno

Consulta [.env.example](/Users/Carlo/AppData/Local/Temp/donna-impl/rollorian-oura/.env.example).

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
```
