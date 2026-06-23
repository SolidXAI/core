# Changelog

## [0.1.10] - 2026-06-23

### Added

- add new dashboard controller actions to permissions
- simplify queue health permissions by consolidating patterns
- implement explicit widget permissions and unauthorized response handling
- enhance widget permission checks and add unauthorized response handling
- add Queue SLA heatmap provider and update metadata
- update queue health menu item and reorder messages
- add various dashboard providers and runtime services
- implement WhatsApp Cloud API integration
- add gupshup whatsapp provider
- add deleteByMediaRecord method to MediaStorageProvider implementations
- add updateCustomNoteMessage action to ChatterMessageController
- add secure custom-note edit API with attachment add/remove support
- implemented social media oath for facebook and microsoft
- add partialUpdate endpoint to menu-item-metadata controller and update metadata seeder relation field name
- implemented social media oath for facebook and microsoft
- add Message Tree Action and corresponding view for mqMessage
- implement processing timeout for RabbitMQ subscriber
- Add a composite index to `ChatterMessage` on `coModelName` and `coModelEntityId`, and an index to `chatterMessage` in `ChatterMessageDetails`.
- Migrate date/time transformers to UtcDateTimeTransformer.
- simplify S3 URL resolution DTO, and remove unused S3 resolution logic.

### Fixed

- correct package name in model generation command and update error handling in module metadata retrieval
- username
- remove type specification for encrypted column in Setting entity, to work in mssql also
- handle null or empty security rule configuration strings in repository

### Changed

- remove legacy dashboard files and add new dashboarding architecture guide
- remove unused dashboard question and variable providers, SQL expression resolver, and related subscribers
- remove redundant null check in resolveSecurityRuleConfig
- update body column type to longText using getColumnType helper in SmsTemplate entity
- update legacy entity fields to be nullable and support null types
- replace DTO introspection with explicit isUpdate flag in MediaFieldCrudManager
- make password scheme and failed login attempt columns non-nullable in UserEntity.
- make passwordScheme, passwordSchemeVersion, and failedLoginAttempts fields nullable in the User entity.

### Documentation

- update expired discord link

### Other

- ad changes
- subscribers now use the event’s own transaction connection instead of a second pooled one (helpful for embedded db)
- changes to avoid extra module checks before dynamically loading it
- defaulted to modulemetadataseederservice if no seeder provided
- Add Date field in Instructions Response
- ai interaction cleanup changes
- enabling create,edit,import,export on permission and lov modules
- added module to rolemetadata list view
- roles group by module changes
- added index to fields newly added as sortable and searchable
- Add archiver package to dependencies
- removed unnecessary seed file
- Add TypeORM migration helper functions and export in index
- fixes
- reverted accidental removal of the layout builder root menu
- pending cleanup of solid core menu items
- Refactor metadata: remove standalone menu items and add scheduled jobs and saved filters tree views
- Remove ChatterMessageDetails and ImportTransactionErrorLog menu items; add Chatter Messages tree view and action. Other menu sub menus cleanup done
- Add model sequence and list of values tree views to metadata, other cleanup changes
- changes for IAM
- Add clearPackageRuntime functionality and corresponding metadata action
- Add archiver dependency and implement module package export functionality
- Refactor menu cleanup logic in ModelMetadataService and ModuleMetadataService; improve error handling for file deletion and update build commands in ModulePackageService to use solidctl.
- Update solid-core-metadata.json to disable create, edit, and delete actions, and set searchable attributes to false for specific fields for media storage provider
- Add media tree view and action & media view cleanup, enhance file storage provider with file size tracking, implemented storeStreams for s3
- Remove cleanup procedures for module metadata across all SQL dialects and implement menu and action cleanup in the service layer.
- Remove unused database bootstrap service and related SQL cleanup procedures
- cleanup
- Add view and action metadata tree views with updated permissions and searchable fields
- Add view and action metadata tree views with updated permissions and searchable fields
- menu item model cleanup
- Add resumable import handling and transaction management in module package service
- Add method to retrieve Solid UI module path and enhance cleanup logging
- Enhance module metadata seeder: add validation for module name, streamline array handling for scheduled jobs, saved filters, list of values, security rules, sms templates, email templates, menus, actions, views, users, roles, media storage providers, model sequences, and models metadata.
- Implement module package management: add controller, service, and DTOs for import, export, and build operations.
- many to one left join issue fixed
- Refactor field metadata actions and views: update action types, enhance searchability, and adjust permissions for create, edit, and delete operations.
- Refactor CRUD and model metadata services to enhance group filtering and pagination; streamline response handling and improve query structure. configuration changes to support tree view in model metadata
- Update solid-core metadata: remove import/export options, rename fields, and add sortable attribute
- Enhance solid-core metadata structure for module mdtadata by removing import/export options and adding sortable attributes for fields
- Implement module metadata explorer with CRUD operations and search functionality
- Refactor module metadata paths to use a consistent directory structure and improve file resolution logic
- Bug fixs
- added frontend base url as well to the default settings
- minor cleanup
- changes to cleanup legacy table related fields
- changes for new dashboards functionality
- always print server startup line regardless of log level
- Add field quality checks and fixes checklist for backend validation
- typeo issue
- Agent table clean up
- Add manual interaction step for Playwright and update README
- provision made to unlink data rather than having to teardown everything
- provision made to unlink data rather than having to teardown everything
- changes to colour the server startup line
- Agent table clean up
- changes to avoid too many initialization logs. controlled thru the verboseBootstrap option to the boostrap helper
- removed id command options and retained the singular name option only for consistency purposes
- changes to route genertion commands thru solidctl. The refresh-module & refresh-model commands are what are eventually called and end up calling the services only, keeping calling consistent and ensuring everything is route thru solidctl generate
- got rid of fieldNamesForRefresh and fieldIdsForRefresh dead chain since it is not used now, due to fields being read in the code builder from the metadata json directly
- MCP table solid changes
- playwrite added as dependency instead
- changes to the test runner
- chatter message user resolution chagnes
- bug fix in chatter message user resolution after we moved to queues.
- moved back to beta3
- failed login attempts field added to the json and update dto and exposed in entity
- removed un-necessary index on newvalue display
- ts changes error: any
- auto addition of menus happens at the bottom now. list view layout changes for security access rules + enabled delete made welcome email & sms SystemAdminEditable
- changed model metadata service default form layout to be single column
- added typing to catch blocks + authentication service bug fixes for private registration flow
- added typing to catch blocks + authentication service bug fixes for private registration flow
- normalised @ApiTags
- enum for passwordless modes
- bug fix in how alternative actions are rendered
- queue related bug fixes
- changes to add a websocket adaptor to the bootstrap server routine
- license changes
- type fixes
- removed min and max from long text mapping
- bug fix for shortext field mapping
- changes to post the testing results to a webhook api with a test payload
- added import multer this fixes un-necessary ts errors in vscode
- ts errors fixed
- bug fix in rabbitmq subscriber optimisation in all subscribers to default to role both if not specified
- formatting changes
- facebook oauth
- Status required false
- updated gitignore
- dleete un-necessary docs
- deleted un-necessary files
- changes related to more grooming
- api added in cors
- refactor Oauth strategy
- Revert "Ft social media login"
- bug fix
- bug fix
- add new api me endpoint and role based settings
- setting changes for new ui architecture
- changes for new settings structure
- chatter task subtype and related changes
- bug fix
- fixes
- changes to get rid of angular schematics for helping with string case transformation for consistency  purpose i.e (lodash is being used on frontend too) and avoid edge cases
- changes to handle import logs as well, thru configured winston log level
- change isMultiSelect to true in solid-core-metadata.json
- change isMultiSelect to false and set visibility for cronExpression, dayOfWeek, and dayOfMonth fields to false
- tightened up queue subscriber interface + fixed core subscribers that were not returning anything. all subscribers must either return a promise or if not async then the actual value
- removed authTheme setting, auth pages dark - light is now controlled by the same local storage as the rest of the app shell
- bug fix: passwordless registration should create a user with active false
- apikeys attribute was not exposed
- refactor Oauth strategy
- changes to avoid sending out encrypted setting in api responses. also removed menu item and action entries for ai settings. (temporary fix, since setting ui to be revamped soon)
- bug fix
- null check on role
- made provision to seed custom permissions
- handled seed scenario too
- upload File and expectHidden changes
- extension user cleanup and checks added
- fixed types for cleanup
- added tsc-alias as well to ensure clean imports in dist as an extra cleanup measure
- fixes bare shell imports with relative imports
- dynamic import fix
- removed unnecessary file
- fixes for 1. throw exception if extension user and no provider configured 2. fixed roles method in the extensionUserProvider interface to make it mandatory
- removed base abstract class
- added interface too
- changes
- changes to test data seeding & fixed the type for authenticationService.signup method
- changes to user dto to include the api keys toggle
- add default role to the user only if there are no roles resolved against a user
- changes to replace current extension user custom user creation logic with the use of dynamic extension user provider. cleans up creation of an extension user
- Only forward --debug when explicitly enabled.
- toolOutput field changes to json
- adding user api key entity to export
- minor optimisation to how dynamic modules are loaded
- Add Discord badge to top of README
- Fix broken BSL license link and add Discord link to README
- Add BSL 1.1 license and update package.json license field
- Seed user and roles in testing data
- removed readme.txt
- moved type and interfaces in interfaces.ts and refactored accordingly
- changed to md
- added readme
- Ai setting model change
- changes to allow encrypting setting keys
- form view clean up
- Agent table list view changes
- synchronize false
- changes to resolve the selection dynamic provider by name and token both
- changes to bypass swagger urls from csp policy
- changes to create a seperate endpoint for admin users to generate api key + custom repository created for userApiKey
- changes to fix issue around isAllowedToGenerateApiKeys not getting saved during user creation
- changes to implement the sso code and sso exchange use cases
- removed orm types / exported api key entity
- added provision to control if api key creation is allowed for the user
- api key changes for backend
- changes to bootstrap helper to read from standard env variables and avoid redundantly passing swagger options
- fix to call addRoles only if role names are present
- Revert "revert: refactor: update legacy entity fields to be nullable and support null types"
- refactor: update legacy entity fields to be nullable and support null types
- Json structure change
- Agent table metadata clean up changes
- longtext
- longtext changes
- Agent tables clean up
- fixes to seed many-to-many relation for tests
- changes to seed media in testing data
- Chatter modelUserkey and excel many to one issue
- keeping the default selectionValueType as string since this is a good default
- bug fixes around how media is done
- bug fixes
- try catch inside logEvent
- media has card based metadata
- Refresh token activity
- changes to implement the sso code and sso exchange use cases
- cleanup
- enabled kanban view on mq message
- Agent table changes
- changes to disallow deleting a model or module in production
- changelog version bumped
- changelog added
- changes to control the logging using env variables & set appropriate defaults basis environment
- chnages for logging
- Chatter queue fixs
- one more "beta" for ozzy
- additional loggging in cors helper
- changes
- Redis Queue component  and rabbitMQ folder changes
- changes to track old and new fields as part of the delete entity operation
- optimizations done for audit subcriber
- changes to optimize audit subscriber code to use background jobs entirely instead of partially
- changes to push all work/processing to the chatter queue subscriber to better manage workloads & db pooling utilization
- formatting changes
- performance optimisations 1. created by updated by subscriber is not querying users again and again 2. rabbit pub / sub can now optinally switch off db persistence
- qs depth config increased
- changes to move the shouldTrackAudit check into registry to avoid unnecessary checks during runtime
- cached model metadata queries
- changse
- disabled extra loggign
- chagnes
- reduced concurrency in computed fields
- additional loggign
- added indexes to mobile & email since those are frequently queries upon
- changes to optimize the permission service methods used in the hotspot load paths within auth and access token guards
- Redis background job changes
- Chatter Rationalizing
- changes
- changes
- changes to merge the entityId sequence computed provider into the existing sequence number provider
- changes to export bootstrap helpers for server & cli nest applications
- changes to toggle the validation for selection dynamic provider. Also changes to export a bootstrap helper function
- registered the EntityIdSequenceNumComputedFieldProvider computation provider as a nest provider
- Added EntityIdSequenceNumComputedFieldProvider as an alternative simpler provider which uses the modelSequence configuration and relies on the id persisted during creation for an entity
- added index on message id in mq message table
- changes around sequence num computed field being a post computation provider error logging in rabbit mq
- changes to save model sequence id as part of post compute instead of pre compute
- changse
- Revert "High concurrency fix for alpha num and sequence num computed fields"
- High concurrency fix for alpha num and sequence num computed fields
- bug fix in cron evalutaion
- tighter logging around roles
- scheduler now supports env based specific jobs starting and others not
- reverting back to text (i.e since it is good enough for mysql too) i.e 64kb for these fields
- revert cross db changes for view-metadata-entity
- fixes
- changes to handle cross-db compatibility
- added type as simple-json
- Remove isValidateForUpdate hack that relied on checking dto.id !== undefined
- Revert "Merge branch 'media-update' into 'main'"
- Mysql related changes
- ts-morph and media storage fix
- dashboard layout menu item added
- dashboard changes
- scheduler bug fix
- made provision to execute scheduled jobs manually
- changes
- cleanup
- logging related changes and made user activity history tree view
- changes to return the wall clock time as utc for chatter as well to keep it...
- changes around dashboard question refactoring
- default tree view and action added on code generation
- Date time format changes in audit
- user activity history on otp login
- changes
- changelog added
- reverted legacy and common entity to use local date time transformer only
- added changelog
- made playwright dependency lazy
- ai interaction table user is nullable now
- rabbitmq subscriber does a prefetch now allowing for more concurrency
- formatting changes
- Version info changes
- dummy otp can now be enabled on a per user basis
- jwt token optimisation
- optimised the authentication flow in microservice adapter to cache access token
- deleted file containing secrets
- changes
- optimisation around how dummy otp is managed
- isSeeded added
- bug fix for fetch layouts
- view modes added in layout
- One to many crud manager fixes
- one-to-many-crud-manager-fixes
- Many to many crud field manager fixes
- patch endpoint added in role controller
- many-to-many field fixes
- modelSequenceFormViewChangeHandler added on field change
- changes to convert the passwordlessRegistrationValidateWhat from array to string
- changes to format group values consistently
- fixes for normalizing group values
- Revert "changes to return groupValue in the group meta response as well. groupValue is..."
- changes to return groupValue in the group meta response as well. groupValue is...
- changes to return groupValue in the group meta response as well. groupValue is...
- filter_field_granularity_supported_added_for_date_fields
- password registration/login cleanup + max failed login attempts checks added
- removed unsafe inline from CSP
- removed incorrect comment
- changes
- Revert "replaced playwright with lazy dependency"
- replaced playwright with lazy dependency
- count and average
- fixes to solid core metadata configuration
- make `s3Key` and `isPrivate` properties mandatory in `ResolveS3UrlDto`.
- solid seed now prints proper exception stack trace
- added playwright dependencies as peer dependencies
- changed playwright import to make it lazy
- issue fixes
- formatting changes
- formatting changes
- changes for test setup
- package changes
- Changes to generate an SA user with the default password for simpler experience during setup
- more changes to support form data based uploads
- changes
- changes around testing workflow
- unified testing utitlities
- added comments to the slug code
- refactored queue namespacign
- queue namespacing related chanes
- removed todo
- queue name related changes
- cag
- changrs
- queues names are now namespaced by service naem
- enabled logs
- debug logs
- testing docs updated
- changes
- cleanup
- removed old testing related fiels
- testing infra now supports data based interpolation
- testing changes: now we support fully custom test specs
- changes for test automation
- changes to tsconfig for playwright tests
- exporting typeorm db helper
- removed the files section
- changes for playwright testing
- changes to disable service controller seed method
- formatting changes
- oom issue
- logger added for chatter
- changed arg to kebab case instead of came case in schematic service
- default menu icons added
- rabbitmq subscriber: add retries, DLX queues, reconnects, and docs
- removed un-necessary log
- fix for handling non existence of fieldNamesForRemoval arg
- foirmatting canges
- Archived/solidstarters main
- version changes
- changed org : @solidstarters -> @solidxai
- removed publish script, since it is replaced with solidctl release
- chanes
- Revert "@solidstarters namespace changed to @solidx"
- @solidstarters namespace changed to @solidx
- file service interface changes
- CR in s3 file service, url options now supports isPrivateBucket allowing one to generate signed and un-signed URLs using the getUrl method
- changes to the publish script to support: 1.reverse merging main to dev to ensure latest package version is synced with dev post publish. 2. added guardrail to allow publishing from main branch only 3. added dry run option and force option i.e (in case we want to publish from another branch, but is hidden) 4. script now pushes the git version tags as well
- changes to pass minimal parameters to the schematics project and pick the rest from the metadata configuration json file (avoid long shell commands)
- test data workflow
- test-data command
- seed command updated
- changes
- changes
- seed command changes to support pruning, test-data-setup and test-data-teardown.
- seeding now supports seedData allowing us to seed fixtures for testing.
- precomputations now skip computation if value is already provided
- added utility for findOneByUserKey
- pruning related chagnes
- changes
- more changes related to pruning metadata
- pruen logs added
- module metadata seeder now does prune also
- reformatting to improve readability
- changes
- file type not allowed. Allowed: image, document, pdf. Received mimetype: application/pdf (mapped to file)
- bug fixes
- changes to cleanup the implementation by having the write method of file service return the url post write
- changes to support using the region specified in a media storage provider, instead only the default while creating an s3 client
- fixes for using the default-aws-s3 bucket for storing the settings media if default file service is s3
- changes to settings media storage logic i.e copy multer path to  file service implementation write
- file service abstraction cleanup
- chagnes
- Dashboard Question Responsive

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
