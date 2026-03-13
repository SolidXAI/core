# Changelog

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
