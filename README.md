# nest-starter-minimal

A minimal NestJS starter that wires Interloid's six Tier 1 platform packages
into a runnable HTTP service. Clone this to bootstrap any service that needs
config, logging, observability, security, and validation without writing the
wiring yourself.

This is the **minimal** starter — no database, no auth, no business logic.
For a full API with Postgres, Redis, JWT auth, and user/role/audit modules,
use `nest-starter-api` (coming in Phase 4 of the platform roadmap).

## What you get

| Endpoint        | What it does                                               |
| --------------- | ---------------------------------------------------------- |
| `GET /`         | Hello World — temporary smoke test (replace with `/ping`)  |
| `GET /health`   | Liveness + readiness checks (disk, memory, optional Redis) |
| `GET /metrics`  | Prometheus metrics                                         |
| `GET /api/docs` | Swagger UI (development only)                              |

Behind every request:

- Correlation ID propagated through logs and traces (via `@interloid/core`)
- Structured logging with sensitive-field redaction (via `@interloid/logger`)
- Validation of any DTO with `class-validator` (via `@interloid/validation`)
- Standard response envelope `{ data, meta, error }` (via `@interloid/core`)
- Rate limiting by client IP (via `@interloid/security`)
- Security headers via Helmet (via `@interloid/security`)
- Optional OpenTelemetry tracing + Sentry error capture (via `@interloid/observability`)

## Prerequisites

- Node.js 20+ (see `.nvmrc`)
- npm 9+
- A GitHub personal access token with `read:packages` scope (the
  `@interloid/*` packages live in a private registry)

## Setup

### 1. Authenticate npm to GitHub Packages

The Interloid packages are hosted in GitHub Packages. Generate a personal
access token at GitHub → Settings → Developer settings → Personal access
tokens → Tokens (classic), with the `read:packages` scope.

Then export it in your shell:

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
curl http://localhost:3000/         # Hello World
curl http://localhost:3000/health   # health JSON
curl http://localhost:3000/metrics  # Prometheus text
open http://localhost:3000/api/docs # Swagger UI in browser
```

## Project structure

```
src/
├── main.ts              # Bootstrap order: tracing → sentry → Nest → Helmet → CORS → Swagger
├── app.module.ts        # All six @interloid/* libraries wired with config from env
├── app.controller.ts    # Temporary "Hello World" — replace per your needs
├── app.service.ts
└── config/
    └── env.schema.ts    # Zod schema — single source of truth for env vars
```

## How configuration works

The starter parses `process.env` against `appConfigSchema` (Zod) at top of
`main.ts` and `app.module.ts`. This gives every other module typed,
validated config values with defaults applied.

`ConfigModule` from `@interloid/config` is also wired so that services
elsewhere in the app can inject `ConfigService<AppConfig>` and read the same
values at request time.

To add a new config variable:

1. Add it to `src/config/env.schema.ts` with a type, default, and JSDoc
2. Add it to `.env.example` with the same default
3. Reference it as `env.YOUR_VAR` in `main.ts` or `app.module.ts`, or inject
   `ConfigService<AppConfig>` and call `config.get('YOUR_VAR')` from a
   service.

## The platform packages — what each does in this starter

### `@interloid/config`

Loads `.env` and validates it against the Zod schema. Registers
`ConfigService` globally so any service can inject typed config.

### `@interloid/core`

Adds request context (correlation IDs via AsyncLocalStorage), the global
exception filter, the response envelope interceptor, and pagination DTOs.
`applyMiddleware: true` activates the correlation ID + envelope middlewares
on every route.

### `@interloid/logger`

Pino-based structured logger. Reads `LOG_LEVEL`, `LOG_FORMAT`,
`LOG_RETENTION_DAYS`, `LOG_DIRECTORY`, `LOG_ALSO_STDOUT` from env.
Automatically redacts fields named `password` and `secret`.
`app.useLogger(app.get(LoggerService))` replaces Nest's default logger.

### `@interloid/validation`

Registers the global validation pipe with `class-validator`. Any DTO
parameter gets automatic validation; failures return a structured `400`.

### `@interloid/observability`

Three sub-systems:

- **Health checks** at `/health` — disk, memory heap, optional Redis ping
- **Prometheus metrics** at `/metrics`
- **Sentry** error tracking, enabled when `SENTRY_DSN` is set

Plus two top-level bootstrap functions called _before_ `NestFactory.create()`
in `main.ts`:

- `bootstrapTracing()` — initializes OpenTelemetry SDK so instrumentation
  catches the full startup
- `bootstrapSentry()` — initializes Sentry SDK so startup errors are
  captured

### `@interloid/security`

Four concerns:

- **Helmet** — `strictHelmet()` in prod, `swaggerSafeHelmet()` in dev so
  Swagger UI renders
- **CORS** — origins configured via `CORS_ORIGINS` env
- **Throttler** — `THROTTLER_LIMIT` requests per `THROTTLER_TTL_MS` window
- **CSRF** — opt-in via `CSRF_ENABLED=true`; only needed for cookie-session
  auth, _not_ for bearer-token APIs

## Environment variables

See `.env.example` for the full list with inline documentation. Highlights:

| Variable                      | Default                | Notes                                                    |
| ----------------------------- | ---------------------- | -------------------------------------------------------- |
| `PORT`                        | 3000                   |                                                          |
| `NODE_ENV`                    | development            | Controls log format, HSTS, secure cookies, Swagger mount |
| `TRUST_PROXY_DEPTH`           | 1                      | Set to 0 if no proxy, 2 for ALB+Cloudflare               |
| `LOG_LEVEL`                   | debug                  | `info` or higher in prod                                 |
| `LOG_FORMAT`                  | json                   | `pretty` for local dev                                   |
| `LOG_DIRECTORY`               | ./logs                 |                                                          |
| `LOG_RETENTION_DAYS`          | 7                      |                                                          |
| `CORS_ORIGINS`                | (empty)                | Comma-separated exact origins                            |
| `CORS_PATTERN`                | (empty)                | Single regex                                             |
| `THROTTLER_LIMIT`             | 100                    | Requests per window per IP                               |
| `THROTTLER_TTL_MS`            | 60000                  | Window in ms                                             |
| `CSRF_ENABLED`                | false                  | Only for cookie-session apps                             |
| `HEALTH_DISK_THRESHOLD`       | 0.8                    | Fail at 80% disk usage                                   |
| `HEALTH_MEMORY_HEAP_MB`       | 512                    | Heap limit in MB                                         |
| `REDIS_URL`                   | redis://localhost:6379 | Health probe ping target                                 |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | (empty)                | Enables tracing when set                                 |
| `SENTRY_DSN`                  | (empty)                | Enables Sentry when set                                  |
| `SENTRY_TRACES_SAMPLE_RATE`   | 0.1                    | 0.0–1.0                                                  |

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
THROTTLER_LIMIT=200          # tune for your traffic
SENTRY_DSN=https://...@sentry.io/...
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318/v1/traces
```

Confirm `TRUST_PROXY_DEPTH` matches your reverse proxy topology. Without
this, rate limiting is keyed off the proxy's IP and is effectively
disabled.

## Footguns checklist

Three configuration steps that, if forgotten, silently disable protections.
Verify each before shipping to production:

- [ ] `TRUST_PROXY_DEPTH` matches your real proxy count (1 if behind ALB
      or Cloudflare, 2 if behind both)
- [ ] `NODE_ENV=production` so `Secure` cookies, strict Helmet CSP, and
      Sentry environment tags activate
- [ ] `CORS_ORIGINS` is set to the actual frontend origins, not left empty
      or set to `*`

## What's NOT included

This is the **minimal** starter. It deliberately excludes:

- **Database** — no Prisma, no TypeORM. Add when you need persistence.
- **Authentication** — `@interloid/auth` is Phase 3. Use `nest-starter-api`.
- **Feature modules** — no users, RBAC, audit, settings. Those are in the
  API Starter.
- **Docker** — add per-project.

## License

UNLICENSED — Interloid internal use only.
