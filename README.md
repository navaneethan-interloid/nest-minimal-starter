# nest-starter-minimal

A minimal NestJS starter that wires Interloid's six Tier 1 platform packages
into a runnable HTTP service. Clone this to bootstrap any service that
needs config, logging, observability, security, and validation without
writing the wiring yourself.

This is the **minimal** starter — no database, no auth, no business logic.
For a full API with Postgres, Redis, JWT auth, and user/role/audit modules,
use `nest-starter-api` (Phase 4 of the platform roadmap).

## What you get

| Endpoint        | What it does                                              |
|-----------------|-----------------------------------------------------------|
| `GET /ping`     | Smoke-test endpoint returning `{ pong, environment }`    |
| `GET /profile`  | Demonstrates `@Public()` decorator (no auth in Minimal)   |
| `POST /webhook` | Demonstrates `@SkipCsrf()` decorator                      |
| `POST /login`   | Demonstrates `@StrictThrottle()` decorator                |
| `GET /health`   | Liveness + readiness checks (disk, memory, optional Redis)|
| `GET /metrics`  | Prometheus metrics                                        |
| `GET /api/docs` | Swagger UI (development only)                             |

Behind every request:

- Correlation ID propagated through logs and traces (via `@interloid/core`)
- Structured logging with sensitive-field redaction (via `@interloid/logger`)
- Validation of any DTO with `class-validator` (via `@interloid/validation`)
- Standard response envelope `{ data, meta, error }` (via `@interloid/core`)
- Rate limiting by client IP (via `@interloid/security`)
- Security headers via Helmet (via `@interloid/security`)
- Optional OpenTelemetry tracing + Sentry error capture (via `@interloid/observability`)

## Prerequisites

- Node.js 20+
- npm 9+
- A GitHub personal access token with `read:packages` scope (the
  `@interloid/*` packages live in a private GitHub Packages registry)

## Setup

### 1. Authenticate npm to GitHub Packages

The Interloid packages are hosted in GitHub Packages. Generate a personal
access token at GitHub → Settings → Developer settings → Personal access
tokens → Tokens (classic), with the `read:packages` scope. Then export it:

```bash
export NODE_AUTH_TOKEN=ghp_your_token_here
```

For permanence, add the line to `~/.zshrc` or `~/.bashrc`.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Open `.env` and review the values. Every variable is documented inline and
has a sensible default — the file works as-is for local development. Adjust
only what you need.

### 4. Start the app

```bash
npm run start:dev
```

The app starts on `http://localhost:3000`. Verify:

```bash
curl http://localhost:3000/ping     # { "data": { "pong": true, "environment": "development" } }
curl http://localhost:3000/health   # JSON health report
curl http://localhost:3000/metrics  # Prometheus text
open http://localhost:3000/api/docs # Swagger UI in browser
```

## Project structure

```
src/
├── main.ts                # Bootstrap: tracing → sentry → Nest → Helmet → CORS → Swagger
├── app.module.ts          # All six @interloid/* libraries wired with config from env
├── app.controller.ts      # /ping smoke test + decorator demonstration endpoints
├── app.service.ts         # Injects TypedConfigService to demonstrate config injection
└── config/
    └── env.schema.ts      # Zod schema — single source of truth for env vars
```

## How configuration works

The starter parses `process.env` against `appConfigSchema` (Zod) at top of
`main.ts` and `app.module.ts`. This gives every module typed, validated
config values with defaults applied.

`ConfigModule` from `@interloid/config` is also wired so that services
elsewhere in the app can inject `TypedConfigService<AppConfig>` and read
the same values at request time. See `AppService` for an example.

To add a new config variable:

1. Add it to `src/config/env.schema.ts` with a type, default, and JSDoc.
2. Add it to `.env.example` with the same default and a comment.
3. Reference it as `env.YOUR_VAR` in `main.ts` or `app.module.ts`, or
   inject `TypedConfigService<AppConfig>` and call `config.get('YOUR_VAR')`
   from a service.

## The platform packages

Six libraries, each with one job. All configured from env vars — change
behavior through `.env`, not by editing `app.module.ts`.

### `@interloid/config`

Loads `.env` and validates against the Zod schema. Exports
`TypedConfigService<AppConfig>` for type-safe config access in services.

### `@interloid/core`

Adds request context (correlation IDs via AsyncLocalStorage), global
exception filter, response envelope interceptor, and pagination DTOs.
Also exports `@Public()` and `@CurrentUser()` decorators used in
combination with `@interloid/auth` (not in this starter).

### `@interloid/logger`

Pino-based structured logger. Reads `LOG_LEVEL`, `LOG_FORMAT`,
`LOG_RETENTION_DAYS`, `LOG_DIRECTORY`, `LOG_ALSO_STDOUT` from env.
Automatically redacts fields named `password` and `secret`.

### `@interloid/validation`

Registers the global validation pipe with `class-validator`. Any DTO
parameter gets automatic validation; failures return a structured 400.

### `@interloid/observability`

Three sub-systems plus two early-bootstrap functions:

- `bootstrapTracing()` and `bootstrapSentry()` — called in `main.ts`
  **before** `NestFactory.create()` so instrumentation catches the full
  request lifecycle and startup errors
- **Health checks** at `/health` — disk, memory, optional Redis ping
- **Prometheus metrics** at `/metrics`
- **Sentry** error tracking — enabled when `SENTRY_DSN` is set

### `@interloid/security`

Four security concerns plus a set of decorators:

- **Helmet** — `strictHelmet()` in prod, `swaggerSafeHelmet()` in dev so
  Swagger UI renders
- **CORS** — origins configured via `CORS_ORIGINS` env
- **Throttler** — `THROTTLER_LIMIT` requests per `THROTTLER_TTL_MS` window
- **CSRF** — opt-in via `CSRF_ENABLED=true`; only needed for cookie-session
  auth, **not** for bearer-token APIs
- `@SkipCsrf()`, `@StrictThrottle()`, `@SkipThrottle()` decorators

## Common decorator patterns

The starter demonstrates these in `app.controller.ts`. Copy the patterns
into your own controllers as needed.

### Public route (no auth required)

```typescript
import { Public, CurrentUser } from '@interloid/core';

@Public()
@Get('profile')
getProfile(@CurrentUser() user: User) {
  return { data: { user } };
}
```

`@Public()` marks a route as not requiring authentication. The decorator
sets metadata that `@interloid/auth`'s guard reads. In the Minimal Starter
there is no auth module, so this decorator is currently a no-op — it
becomes active when you add `@interloid/auth` from the API Starter.

### Skip CSRF on a route

```typescript
import { SkipCsrf } from '@interloid/security';

@SkipCsrf()
@Post('webhook')
handleWebhook() { /* ... */ }
```

Use this for endpoints that can't receive a CSRF header (webhook
receivers, OAuth callbacks, server-to-server APIs). Only meaningful when
`CSRF_ENABLED=true`.

### Stricter rate limit on a route

```typescript
import { StrictThrottle } from '@interloid/security';

@StrictThrottle()            // override 'global' bucket — 5 req/min
@Post('login')
login() { /* ... */ }

@StrictThrottle('global', 10, 60_000)   // custom: 10 req/min
@Post('signup')
signup() { /* ... */ }
```

Signature: `StrictThrottle(bucket = 'global', limit = 5, ttl = 60_000)`.
Note that `bucket` must match a throttler name declared in your
`SecurityModule.forRoot({ throttler })` config.

### Skip rate limiting entirely

```typescript
import { SkipThrottle } from '@interloid/security';

@SkipThrottle()
@Get('healthcheck')
ping() { /* ... */ }
```

## Environment variables

See `.env.example` for the full list with inline documentation. Quick
reference:

| Variable                       | Default                  | Notes                              |
|--------------------------------|--------------------------|------------------------------------|
| `PORT`                         | 3000                     |                                    |
| `NODE_ENV`                     | development              | Controls log format, HSTS, cookies, Swagger |
| `TRUST_PROXY_DEPTH`            | 1                        | 0 if no proxy, 2 for ALB+Cloudflare |
| `LOG_LEVEL`                    | debug                    | `info` or higher in prod           |
| `LOG_FORMAT`                   | pretty                   | `json` in prod for aggregators     |
| `LOG_DIRECTORY`                | ./logs                   |                                    |
| `LOG_RETENTION_DAYS`           | 7                        |                                    |
| `LOG_ALSO_STDOUT`              | true                     |                                    |
| `CORS_ORIGINS`                 | http://localhost:3000    | Comma-separated exact origins      |
| `CORS_PATTERN`                 | (empty)                  | Regex body (no surrounding slashes) |
| `THROTTLER_LIMIT`              | 100                      | Requests per window per IP         |
| `THROTTLER_TTL_MS`             | 60000                    | Window in ms                       |
| `CSRF_ENABLED`                 | false                    | Only for cookie-session apps       |
| `CSRF_COOKIE_DOMAIN`           | (empty)                  | Leave empty for current host       |
| `CSRF_SAME_SITE`               | lax                      | lax \| strict \| none              |
| `HEALTH_DISK_THRESHOLD`        | 0.8                      | Fail at 80% disk usage             |
| `HEALTH_MEMORY_HEAP_MB`        | 512                      | Heap limit in MB                   |
| `REDIS_URL`                    | redis://localhost:6379   | Health probe target                |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | (empty)                  | Enables tracing when set           |
| `SENTRY_DSN`                   | (empty)                  | Enables Sentry when set            |
| `SENTRY_TRACES_SAMPLE_RATE`    | 0.1                      | 0.0–1.0                            |

## Scripts

```bash
npm run start:dev      # development with hot reload
npm run start          # development without reload
npm run start:prod     # production (build first)
npm run build          # compile to dist/
npm run test           # unit tests
npm run test:e2e       # end-to-end tests
npm run test:cov       # unit tests with coverage
npm run lint           # ESLint with auto-fix
npm run format         # Prettier
```

## Deploying to production

Before deploying, at minimum:

```bash
NODE_ENV=production
LOG_LEVEL=info
LOG_FORMAT=json
CORS_ORIGINS=https://app.yourdomain.com
THROTTLER_LIMIT=200
SENTRY_DSN=https://...@sentry.io/...
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
```

Confirm `TRUST_PROXY_DEPTH` matches your reverse proxy topology (1 behind
ALB or Cloudflare, 2 if behind both). Without this, rate limiting is keyed
off the proxy's IP and is effectively disabled.

## Footguns checklist

Three configuration steps that, if forgotten, silently disable
protections. Verify each before shipping:

- [ ] `TRUST_PROXY_DEPTH` matches your real proxy count
- [ ] `NODE_ENV=production` so `Secure` cookies, strict Helmet CSP, and
  Sentry environment tags activate
- [ ] `CORS_ORIGINS` lists actual frontend origins (not left empty, not
  `*`)

## Troubleshooting

### "CORS: origin http://localhost:3000 not allowed" on POST requests from Swagger

Add your local origin to `.env`:

```bash
CORS_ORIGINS=http://localhost:3000
```

Restart the server (`.env` is read at startup, not per-request). Swagger
UI sends an `Origin` header even for same-origin POST requests, so the
origin must be explicitly allowed.

### `/health` returns 503

If `REDIS_URL` points at a Redis you don't have running locally, the
health probe fails. Either start a local Redis (`docker run -p 6379:6379
redis`) or remove the `redis` block from `ObservabilityModule.forRoot`
in `app.module.ts` for purely local development.

### Logs don't appear / `dotenv` isn't loading

Verify your `.env` file exists (not just `.env.example`):

```bash
ls -la .env*
```

If only `.env.example` is listed, copy it:

```bash
cp .env.example .env
```

The schema reads `process.env` at boot. `dotenv/config` (imported as the
first line of `main.ts`) populates `process.env` from `.env`. If `.env`
doesn't exist, only shell-exported vars are loaded.

## What's NOT included

This is the **minimal** starter. Deliberately excludes:

- **Database** — no Prisma, no TypeORM. Add when you need persistence.
- **Authentication** — `@interloid/auth` is Phase 3. Use `nest-starter-api`.
- **Feature modules** — no users, RBAC, audit, settings. Those are in the
  API Starter.
- **Docker / docker-compose** — add per-project.

## License

UNLICENSED — Interloid internal use only.