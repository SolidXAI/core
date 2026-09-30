# solid-core-module (`@solidxai/core`)

NestJS backend foundation: CRUD, auth, metadata management, communication, storage, and the **built-in BDD test framework** that the dev loop drives. See [/home/rajeshchityal/projects/Solid/CLAUDE.md](/home/rajeshchityal/projects/Solid/CLAUDE.md) for the framework overview.

## Layout (under `src/`)
- [`src/index.ts`](src/index.ts) — 500+ public exports.
- [`src/solid-core.module.ts`](src/solid-core.module.ts) — main Nest module wired into consuming projects.
- [`src/cli.ts`](src/cli.ts) — CLI entry (`bin: solidCore`); `solidctl test/seed/generate/...` proxies to this.
- [`src/commands/`](src/commands/) — Nest-Commander subcommands. Key ones: [`test.command.ts`](src/commands/test.command.ts), [`run-tests.command.ts`](src/commands/run-tests.command.ts), [`test-data.command.ts`](src/commands/test-data.command.ts), [`seed.command.ts`](src/commands/seed.command.ts).
- [`src/services/`](src/services/) — `CRUDService<T>`, `AuthenticationService`, `ModelMetadataService`, `FieldMetadataService`.
- [`src/entities/`](src/entities/) — `ModelMetadata`, `FieldMetadata`, `ModuleMetadata`, `User`, etc.
- [`src/subscribers/`](src/subscribers/) — TypeORM subscribers (audit trail, soft-delete, computed fields).
- [`src/helpers/bootstrap.helper.ts`](src/helpers/bootstrap.helper.ts) — Nest bootstrap; sets global prefix, Swagger, ValidationPipe.

## Testing framework (the dev loop talks to this)
- [`src/testing/runner/run-from-metadata.ts`](src/testing/runner/run-from-metadata.ts) — entry; loads `testing.scenarios` from module metadata, filters by tags, dispatches to adapters.
- [`src/testing/adapters/api/api-adapter.ts`](src/testing/adapters/api/api-adapter.ts) — Axios.
- [`src/testing/adapters/ui/playwright-adapter.ts`](src/testing/adapters/ui/playwright-adapter.ts) — Chromium. **No screenshot-on-failure today** (queued upstream patch).
- [`src/testing/reporter/webhook-reporter.ts`](src/testing/reporter/webhook-reporter.ts) — POSTs `TestRunPayload` to `SOLIDCTL_WEBHOOK_URL` on flush. The dev-loop script reads this payload to build `verdict.json`.
- [`src/testing/reporter/console-reporter.ts`](src/testing/reporter/console-reporter.ts) — base stdout reporter (✔/✖).
- [`src/testing/steps/`](src/testing/steps/) — registered ops: `api.*`, `ui.*`, `assert.*`, `util.*`.

## Queued upstream patches (not yet landed)
1. `FileReporter` + `--report-file <path>` flag in [`run-tests.command.ts`](src/commands/run-tests.command.ts) — mirrors WebhookReporter payload to disk. Lets the dev-loop drop the ephemeral webhook receiver.
2. Screenshot-on-failure in [`playwright-adapter.ts`](src/testing/adapters/ui/playwright-adapter.ts) — `page.screenshot({fullPage:true})` + `reporter.attach()` on step throw.

## Conventions
- NestJS 10 + TypeORM + Passport/JWT. Decorators + DI throughout.
- DB-agnostic via TypeORM DataSource (PostgreSQL primary).
- Provider registry (`SolidRegistry`) discovers providers via decorators at startup.
- Memory index for cross-project context: [~/.claude/projects/-home-rajeshchityal-projects-Solid/memory/MEMORY.md](~/.claude/projects/-home-rajeshchityal-projects-Solid/memory/MEMORY.md).
