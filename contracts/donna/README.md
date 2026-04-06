# Donna Internal API

These contracts exist for Donna on the Pi5.

## Auth

- Header: `x-api-key`
- Environment: `INTERNAL_API_KEY`

## Endpoints

- `GET /api/internal/donna/status`
- `GET /api/internal/donna/context/health?day=YYYY-MM-DD`
- `GET /api/internal/donna/context/trends?window=7d|30d`

## Notes

- Oura remains read-only for Donna in v1
- the app keeps canonical sync ownership
- Donna consumes aggregated context so she does not need multiple round trips
