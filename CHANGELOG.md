# Changelog

## [1.7.0] - 2026-04-08

### New Features

#### Bootstrap Helper
- **`bootstrapSolidApp()` and `bootstrapSolidCli()`**: New exported helper functions that wire up a SolidX NestJS HTTP server or CLI application with sensible defaults — security headers, CORS, Winston logger, `ValidationPipe`, `WrapResponseInterceptor`, qs deep query parsing, Swagger, and the pg BIGINT type parser. Replaces the boilerplate `main.ts` that every app had to copy and maintain.

#### Dashboard Layouts
- **`DashboardLayout` entity and full CRUD**: A new `DashboardLayout` entity, repository, service, and controller have been added. Dashboard layouts allow configuring the visual arrangement of a dashboard and are available via `/dashboard-layout` endpoints. Create and update DTOs are included.

#### Scheduled Jobs
- **Manual trigger endpoint**: `POST /scheduled-job/:id/trigger` allows any scheduled job to be invoked immediately on demand, outside its normal cron window. The job's `lastRunAt` and `nextRunAt` are updated after execution.
- **Selective job enabling via regex**: Set `SOLID_SCHEDULER_JOBS_REGEX_TO_ENABLE` to a regex string to allow only matching job names to run in a given environment. Set it to `"all"` (or leave it empty) to enable all jobs. Invalid regex causes the scheduler loop to skip the run and log an error.

#### Audit — Fully Queue-Driven Processing
- **All audit work pushed to the queue**: The audit subscriber no longer calls `ChatterMessageService` directly. All insert/update/delete audit events are serialised into `AuditQueuePayload` messages and dispatched through the publisher (RabbitMQ or database broker). The chatter queue subscriber then processes these asynchronously, improving database connection pool utilisation under load.
- **Database broker for chatter queue**: New `ChatterQueuePublisherDatabase` and `ChatterQueueSubscriberDatabase` services provide a database-backed alternative to the RabbitMQ chatter queue, for deployments that do not run RabbitMQ.
- **Old and new field values captured on delete**: The audit subscriber now records the full entity state (old values) when a delete event fires, so the audit log shows what was deleted.

#### SQL Stored Procedures
- **`proc_CleanupModelMetadata` and `proc_CleanupModuleMetadata`**: New stored procedures for MariaDB and MySQL that purge stale model and module metadata entries. Useful for keeping the metadata tables clean after module restructuring.

---

### Performance Improvements

#### Audit & Subscribers
- **`shouldTrackAudit` moved to registry**: The per-event auditability check is now a synchronous in-memory lookup against the `SolidRegistry` (populated at startup) rather than a live database query on every TypeORM event. Removes N+1 queries from the hot path.
- **`CreatedByUpdatedBySubscriber` no longer queries the database**: `createdBy` / `updatedBy` are now stamped directly from the JWT `sub` claim available in `RequestContextService`, eliminating a `User` table lookup per insert/update.
- **Model metadata queries cached**: Frequently used model metadata lookups are cached in the registry, avoiding repeated database round-trips during request handling.
- **Permission service hot-path optimisation**: Methods in `PermissionMetadataService` used during auth and access-token guard evaluation have been optimised to reduce redundant work on the critical authentication path.

#### Computed Fields
- **`EntityIdSequenceNumComputedFieldProvider` merged into `SequenceNumComputedFieldProvider`**: The two sequence providers have been consolidated. The entity-ID-based sequence now runs as a post-compute step, removing a duplicated provider registration.

#### Database
- **Indexes on `User.email` and `User.mobile`**: Both columns now have database indexes, speeding up the frequent lookups performed during OTP and email-based login flows.
- **Index on `MqMessage` message ID**: Adds an index on the message ID column in the MQ message table for faster message lookups.

---

### Improvements

#### Logging
- **Environment-variable log level control**: Log verbosity can now be configured via environment variables, with sensible defaults per environment (development vs production). Previously log levels were hardcoded.
- **CORS diagnostic logging**: The CORS helper logs the allowed origins list and the compiled regexes at startup, and logs per-request debug output showing which regex matched (or why a request was rejected). Makes CORS misconfiguration much easier to diagnose.
- **RabbitMQ subscriber logs service role on skip**: When `QUEUES_SERVICE_ROLE` is set to a value that disables the subscriber, a clear log message is emitted instead of silently not connecting.
- **RabbitMQ error logs now include stack traces**: `handleProcessingError` passes the full error stack to the logger, rather than only the message string.

#### RabbitMQ Subscriber
- **Processing timeout**: Subscribers can now declare a per-queue processing timeout. If a message handler exceeds the timeout a `ConsumerProcessingTimeoutError` is thrown, preventing a slow message from blocking the consumer indefinitely.
- **`shouldPersistToDatabase()` flag**: Subscribers can opt out of DB persistence for retry/dead-letter tracking by overriding `shouldPersistToDatabase()` returning `false`.

#### Audit — Chatter Message Details
- **`fieldType` stored on `ChatterMessageDetails`**: Audit detail records now capture the field's metadata type (e.g. `"relation"`, `"date"`, `"select"`), enabling richer display logic on the client without re-fetching field metadata.

#### Scheduler
- **Scheduler disabled state is now logged**: When `SOLID_SCHEDULER_ENABLED=false` the scheduler logs a debug message instead of returning silently.

#### Query String Parsing
- **qs depth limit increased**: The `qs` query-string depth limit has been raised to accommodate deeper nested filter objects.

---

### Bug Fixes

- **RabbitMQ subscriber role check refactored**: The service-role guard that was inline inside the connection block has been pulled out to a top-level check with a clear log message, preventing silent no-ops when the role is misconfigured.
- **Audit subscriber no longer holds `ChatterMessageService` in synchronous TypeORM event scope**: Resolves potential circular dependency and scope issues that could cause runtime errors under certain module initialisation orders.

---

## [0.1.5] - 2026-03-13

### Breaking Changes

- **Date/time handling**: All base entity timestamp columns (`createdAt`, `updatedAt`, `deletedAt`, `publishedAt`) now use a UTC passthrough transformer. Previously, timestamps were adjusted to the configured wall-clock timezone when read back. They are now always returned as UTC. Applications that relied on timezone-adjusted timestamps from `CommonEntity` or `LegacyCommonEntity` will see different date values. 
- **Passwordless registration configuration**: `IAM_PASSWORD_LESS_REGISTRATION_VALIDATE_WHAT` is now treated as a plain string (e.g. `"email"` or `"mobile"`) instead of a comma-separated list. Multi-value configurations are no longer supported.
- **Local Passport strategy removed**: `LocalStrategy` / `LocalAuthGuard` have been deleted. Applications that depended on the local passport strategy must migrate away from it.
---

### New Features

#### Authentication & Security
- **Account blocking on repeated login failures**: A new `failedLoginAttempts` counter column is tracked on the `User` entity. When the counter exceeds the configured threshold (`IAM_MAX_FAILED_LOGIN_ATTEMPTS`, default `0` = disabled), the user receives a `ForbiddenException` with message `"Your account has been blocked due to multiple failed login attempts."` The check runs on password login, OTP login, and Google OAuth login. The counter resets to 0 on a successful login.
- **Active-user check on OTP login**: Initiating a mobile OTP login now checks `user.active` upfront. Inactive users receive an `UnauthorizedException("User is inactive.")` before an OTP is ever generated.
- **Per-user dummy OTP**: The dummy OTP can now be enabled on a per-user basis, in addition to the global setting. This allows test/development accounts to be individually configured without affecting all users.
- **New system setting exposed**: `maxFailedLoginAttempts` (env: `IAM_MAX_FAILED_LOGIN_ATTEMPTS`) is now surfaced as a `SystemAdminReadonly` setting.

#### Layout & Views
- **`viewModes` in layout response**: `fetchLayout()` now returns a `viewModes` array alongside the layout payload. Each entry describes an alternative view (list, kanban, or tree) available for the current model, containing `{ type, menuItemId, menuItemName, actionId, actionName }`. This allows clients to offer view-switcher UI without a separate API call.

#### Saved Filters
- **`isSeeded` flag on SavedFilters**: A new `isSeeded` boolean column (default `false`) has been added to the `SavedFilters` entity. Filters created by the seeder automatically have `isSeeded: true`, making it easy to distinguish programmatic seed data from user-created filters. Both create and update DTOs accept this field.

#### Aggregate Queries
- **Security-aware aggregate methods**: `SolidBaseRepository` now applies security rules (row-level access control) before executing `count`, `average`, `sum`, `min`, `max`, `increment`, and `decrement` operations. Previously these methods bypassed security rules entirely. `increment` and `decrement` now only mutate rows the current user is allowed to access.

#### Filter Field Granularity
- **Date field granularity in filters**: Filter keys can now include a granularity suffix using colon syntax (e.g. `createdAt:month`, `createdAt:day`, `createdAt:year`). The backend generates a DB-level date truncation expression for the specified granularity. Unsupported aliases return a `BadRequestException`. Granularity is not supported on relation/join fields.
- **`groupValue` in group meta response**: Grouped query results now include `groupValue` (the raw, normalised group key) alongside `groupName` in each group's metadata. This allows consumers to use the raw value for programmatic filtering without re-deriving it from the display name. Date group values are normalised to ISO date format (`YYYY-MM-DD`).

#### Role Management
- **`PATCH /role-metadata/:id` endpoint**: A new partial update endpoint has been added to the role metadata controller, allowing partial role updates without sending the full role object.

#### Version Info
- **`GET /info` endpoint**: A new `InfoService` and controller expose the installed versions of `solid-core`, `solid-core-ui`, and `solid-code-builder`, indicating whether each package is resolved from a local path or npm.

---

### Bug Fixes

- **Many-to-many `link`/`unlink` commands**: Previously, `link` and `unlink` on many-to-many relation fields would load the entire association and replace it, causing data loss and N+1 queries. Both commands now use TypeORM's `QueryBuilder.relation().add()` / `.remove()` to perform targeted join-table mutations without touching the rest of the association.
- **One-to-many `link`/`unlink` commands**: Same fix applied — targeted relation mutations replace the previous full-collection replacement approach.
- **`fetchLayout` view modes query**: Fixed an issue where the initial view modes query filtered by menu item role access and `modelName`, which produced incorrect results. The query now resolves the model and module IDs from the menu item and queries `ActionMetadata` directly.
- **Seeder filter validation**: The seeder now validates that each saved filter's `filterQueryJson` is an object with a top-level `$or` or `$and` key before upserting. Invalid filter JSON fails with a clear error rather than silently seeding malformed data.
- **`solid-core-metadata.json` corrections**: Fixed stale view user keys for chatter models (`chatter-message-list-view` → `chatterMessage-list-view`); removed a stale `locale-list-view` action definition; cleared incorrect `actionUserKey` values on top-level menu items that pointed to non-existent actions.
- **AI interaction entity**: The `user` relation on `AiInteraction` is now nullable, allowing AI interactions to be recorded without a linked user.

---

### Improvements

#### Authentication
- **Microservice adapter access token caching**: `SolidMicroserviceAdapter` now caches the access token and reuses it across requests, avoiding redundant re-authentication on every call.
- **JWT token optimisation**: Minor optimisation to JWT handling in the microservice adapter.
- **Dummy OTP optimisation**: After a successful OTP login, the OTP is no longer cleared when a `dummyOtp` is configured in settings. This prevents the dummy OTP from being consumed on first use in test/development environments.
- **OTP registration flow refactored**: Internal OTP registration logic split into focused private methods (`upsertUserWithRegistrationVerificationTokens`, `assignRegistrationOtp`, etc.) for maintainability.

#### Security
- **CSP tightened**: The default Content Security Policy now explicitly sets `style-src: 'self'`, removing the implicit `unsafe-inline` allowance for stylesheets.

#### Database
- **New indexes on Chatter tables**: A composite index on `ChatterMessage(coModelName, coModelEntityId)` and an index on `ChatterMessageDetails(chatterMessage)` have been added, improving lookup performance for the typical chatter query pattern.

#### Messaging
- **RabbitMQ subscriber prefetch**: The RabbitMQ subscriber now sets a prefetch count, allowing fairer concurrency by preventing a single consumer from hogging all unacknowledged messages.

#### Request Handling
- **Request body size limit raised to 10 MB**: `SolidCoreModule` now configures `express.json` and `express.urlencoded` middleware with a `10mb` limit globally.

#### S3
- **`ResolveS3UrlDto` simplified**: The model/field entity-lookup-based resolution flow has been removed. The DTO now only requires `s3Key` and `isPrivate`. The old `modelName`, `fieldName`, and `fileType` fields are gone.

#### Developer Experience
- **Seeder error output**: On seed failure, a structured JSON block is now printed to stdout containing the module name, step name, error name, message, and the first 8 lines of the stack trace. The error is then re-thrown.
- **`modelSequenceFormViewChangeHandler` wired up**: The field-change hook for the Model Sequence form view in the seed metadata now correctly points to `"modelSequenceFormViewChangeHandler"`.

#### Dependencies
- **Playwright moved to optional peer dependency**: `@playwright/test` removed from `devDependencies`. `playwright` is now listed as an optional peer dependency — consumers who need it for testing must install it explicitly.
- **`form-data` added as a direct dependency**.

---

## [0.1.4]

Previous stable release.
