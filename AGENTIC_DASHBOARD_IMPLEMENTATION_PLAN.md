# Agentic Dashboard Implementation Plan

## 1. Scope and Goals

### 1.1 Outcome
- [ ] Build a new generic, metadata-driven dashboard framework across `solid-core-module` and `solid-core-ui`.
- [ ] Replace all legacy dashboard implementation code (backend + frontend) with the new architecture.
- [ ] Support existing configured data sources and optional model metadata integration.
- [ ] Provide a clean extension architecture so teams/agents can add new dashboard widgets consistently.

### 1.2 Core Principles
- [ ] Metadata first: dashboards, variables, widgets, filters, and layout defaults are defined in module metadata JSON.
- [ ] Provider driven: each widget resolves data through a common backend provider contract.
- [ ] UI abstraction: widget rendering uses a typed extension registry entry (`DashboardWidget`) instead of hard-coded branches.
- [ ] User personalization: per-user layout is persisted and merged over metadata defaults.

---

## 2. Reference Patterns to Mirror

### 2.1 Backend provider registration and resolution pattern
- [x] Follow existing pattern used by:
  - `src/services/computed-fields/entity/sequence-num-computed-field-provider.ts`
  - `src/services/selection-providers/list-of-values-selection-providers.service.ts`
  - `src/services/solid-introspect.service.ts`
  - `src/helpers/solid-registry.ts`
- [x] Keep flow: `decorator -> introspection -> registry -> resolver service -> controller endpoint`.

### 2.2 Frontend extension pattern
- [ ] Mirror existing extension architecture in:
  - `solid-core-ui/src/helpers/registry.ts`
  - `solid-core-ui/src/types/extension-registry.ts`
- [ ] Add a dedicated extension component type for dashboard widgets.

---

## 3. Legacy Dashboard Decommission (Must happen first)

### 3.1 Backend legacy removal inventory
- [x] Remove legacy dashboard entities:
  - `dashboard.entity.ts`, `dashboard-variable.entity.ts`, `dashboard-question.entity.ts`, `dashboard-question-sql-dataset-config.entity.ts`, `dashboard-layout.entity.ts`.
- [x] Remove legacy controllers/services/repositories/mappers/subscribers/decorators:
  - `dashboard*.controller.ts`
  - `dashboard*.service.ts`
  - `dashboard*.repository.ts`
  - `dashboard-mapper.ts`
  - `dashboard*.subscriber.ts`
  - `dashboard-selection-provider.decorator.ts`
  - `dashboard-question-data-provider.decorator.ts`
- [x] Remove old dashboard-specific selection providers and question-data providers currently tied to the old model.
- [x] Remove old exports from `src/index.ts`, `src/interfaces.ts`, and any DTO references.
- [x] Remove all old dashboard wiring from `src/solid-core.module.ts` (imports, entities, providers, controllers).

### 3.2 Frontend legacy removal inventory
- [x] Remove old dashboard API slices:
  - `dashboardApi.ts`, `dashboardQuestionApi.ts`, `dashboardLayoutApi.ts`.
- [x] Remove old dashboard components and route page:
  - `components/core/dashboard/*`
  - `routes/pages/admin/core/DashboardPage.tsx` (legacy implementation).
- [x] Remove old dashboard extension handlers/widgets under `components/core/extension/solid-core/dashboard*`.
- [x] Remove old store wiring from `redux/store/defaultStoreConfig.ts`.
- [x] Remove stale assets only used by old dashboard implementation.

### 3.3 Metadata cleanup
- [x] Remove old dashboard-related testing permissions (legacy controller methods) from module metadata examples.
- [x] Update seed metadata (`solid-core-metadata.json`) to remove old dashboard management models/actions/views.

---

## 4. New Metadata Schema Design

### 4.1 Module metadata structure
- [x] Introduce/replace `dashboards` section schema in module metadata (similar placement as `testing` section).
- [x] Define top-level dashboard fields:
  - `name`, `displayName`, `description`, `routeName`, `menu`, `variables`, `widgets`, `defaultLayout`, `permissions`.
- [x] Define variable schema:
  - `name`, `label`, `type`, `required`, `defaultValue`, `operators`, `selectionConfig`, `visibilityRules`.
- [x] Define widget schema:
  - `name`, `title`, `type`, `dataProvider`, `providerContext`, `visualization`, `layoutRef`, `refreshPolicy`.
- [x] Define layout schema:
  - Grid cell contract compatible with Gridstack (`x`, `y`, `w`, `h`, min/max constraints, responsive overrides).

### 4.2 Validation + compatibility
- [ ] Add runtime validation for dashboard metadata schema (clear error messages for malformed config).
- [x] Introduce schema versioning (`dashboardSchemaVersion`) for future migrations.
- [ ] Add backward-compat guard (disable old schema loading explicitly and log actionable migration hints).

### 4.3 ADR-001: Dashboard definition source of truth
- [x] **Decision**:
  - dashboard definitions remain in module metadata JSON under root-level `dashboards` (peer of `actions`, `menus`, `roles`, `users`, etc.)
  - seed only dashboard navigation metadata (`actions`, `menus`)
  - do not persist dashboard definitions in dedicated dashboard DB tables
  - persist only user-specific layout overrides in the new user layout table.
- [x] **Context**:
  - legacy dashboard persistence model has been removed
  - new dashboard framework is explicitly metadata-driven
  - we need a single source of truth with git versioning and no JSON-vs-DB drift.
- [x] **Consequences**:
  - simpler rollout and migrations for v1
  - dashboard updates ship through metadata changes
  - runtime must always resolve dashboard definition from module metadata
  - no CRUD for dashboard definitions in DB for v1.
- [x] **Alternatives considered (rejected for v1)**:
  - persist full dashboard definitions in DB tables
  - hybrid model where DB can override JSON definitions.

### 4.4 ADR-002: Dashboard layout persistence implementation pattern
- [x] **Decision**:
  - do not hand-code dashboard layout entity/repository/service in `solid-core-module` source
  - define dashboard layout persistence model in module metadata JSON
  - generate entity/service/controller artifacts through solid-core metadata code generation flow.
- [x] **Context**:
  - project prefers metadata-first model management for framework-owned models
  - generated artifacts keep persistence layer consistent with standard solid-core patterns.
- [x] **Consequences**:
  - layout persistence endpoint behavior can be stub/fallback until generated model artifacts are available
  - consuming projects can regenerate cleanly from metadata without custom table code drift.

---

## 5. Backend Architecture (solid-core-module)

### 5.1 New provider contracts
- [x] Create new interface:
  - `IDashboardWidgetDataProvider<TContext, TResponse>` with methods:
    - `name()`
    - `help()`
    - `getData(widgetDefinition, runtimeContext): Promise<TResponse>`
- [x] Optionally split provider contracts:
  - widget data provider
  - variable options provider (if dynamic filter options are needed separately)
- [x] Define standard response envelope for all widget providers:
  - `meta` (widget name/provider/version/time)
  - `data` (typed payload)
  - `uiHints` (optional rendering hints)

### 5.2 Decorator + registry + introspection
- [x] Add new decorator for widget data providers (parallel to existing provider decorators).
- [x] Extend `SolidIntrospectService` to auto-register dashboard widget data providers.
- [x] Extend `SolidRegistry` with:
  - register/get/list methods for widget providers.
- [x] Keep naming resolution strategy consistent with existing providers.

### 5.3 Dashboard runtime service layer
- [x] Add new dashboard runtime service:
  - resolves dashboard metadata by module + dashboard name
  - resolves dashboard variables and validated filter input
  - resolves widget provider instance per widget
  - executes provider and aggregates response
- [x] Add expression/filter resolver for dashboard variables (provider-level filter utility for date/queue/stage/messageBroker).
- [ ] Add secure execution guardrails:
  - provider allowlist
  - parameterized SQL only
  - timeout + row limits + payload size limits

### 5.4 New controller endpoints
- [x] Add `DashboardController` (new runtime controller, not CRUD dashboard model controller).
- [x] Proposed endpoints:
  - `GET /dashboard/:module/:dashboardName/definition`
  - `POST /dashboard/:module/:dashboardName/widgets/:widgetName/data`
  - `POST /dashboard/:module/:dashboardName/data` (batch widget fetch)
  - `GET /dashboard/:module/:dashboardName/variable-options/:variableName`
  - `GET /dashboard/:module/:dashboardName/layout` (resolved default + user override)
  - `PUT /dashboard/:module/:dashboardName/layout` (save user layout)
- [x] Add Swagger + permission mapping for new endpoints.

### 5.5 User layout persistence model
- [x] Add metadata model for personalized layout (and generate entity/service using solid-core code generation):
  - `dashboardName` (string/user key reference to metadata dashboard)
  - `layoutJson` (long text / json)
  - `user` (many-to-one with `User`)
  - `module` (many-to-one with `Module`, resolved using `moduleUserKey` from dashboard metadata context)
- [x] Add unique index:
  - `(user_id, module_id, dashboard_name)`.
- [x] Add repository/service methods and runtime integration:
  - `getUserLayout()`
  - `upsertUserLayout()`
  - `resetToDefault()`
  - wired into `GET/PUT /dashboard/:module/:dashboardName/layout`.

---

## 6. Frontend Architecture (solid-core-ui)

### 6.1 Extension system for dashboard widgets
- [ ] Add new extension component type in `extension-registry.ts`:
  - `dashboardWidget`.
- [ ] Add typed widget props contract (single source of truth for all dashboard widgets), e.g.:
  - widget metadata
  - resolved variables
  - loading/error state
  - normalized provider response
  - callbacks (refresh, open details, export).
- [ ] Register default widgets via `registry.ts` using the new extension type.

### 6.2 Dashboard runtime UI
- [ ] Create new generic dashboard route/page:
  - `/admin/dashboard/:dashboardName` or `/admin/core/:moduleName/dashboard/:dashboardName` (finalize one canonical route).
- [ ] Build page structure:
  - dynamic header
  - metadata-driven variable filter bar
  - widget grid body
  - save/reset layout actions.
- [ ] Resolve dashboard via new backend definition endpoint.

### 6.3 Layout engine integration
- [ ] Standardize on Gridstack for drag/drop/resize (metadata layout to Gridstack contract adapter).
- [ ] Create layout adapter:
  - metadata default layout -> Gridstack nodes
  - Gridstack save format -> persisted `layoutJson`.
- [ ] Persist user changes through new layout endpoints.
- [ ] Add responsive behavior and conflict handling for missing/renamed widgets.

### 6.4 Widget rendering pipeline
- [ ] Implement widget host container that:
  - resolves widget extension component by type/name
  - fetches provider data
  - handles loading/empty/error states consistently
  - supports per-widget refresh intervals.
- [ ] Implement first-party default widgets (KPI, line/bar/pie, table, meter/progress).
- [ ] Ensure each widget reads dashboard variables as input params.

### 6.5 State and API slices
- [ ] Add new RTK Query slices for dashboard runtime endpoints.
- [x] Remove legacy dashboard slices from store config.
- [ ] Add cache keys by `module + dashboard + variable hash + widget`.

---

## 7. Charting Library Recommendation

### 7.1 Recommended baseline
- [ ] Use **Apache ECharts** as the default charting engine abstraction for v1.

### 7.2 Why ECharts
- [ ] Broad chart coverage (20+ types and combinable series).
- [ ] Strong visual quality out of the box, plus deep customization.
- [ ] Apache-2.0 license (friendly for framework redistribution/use).
- [ ] Handles large datasets and supports Canvas/SVG rendering modes.

### 7.3 UI abstraction requirement
- [ ] Do not couple widget contracts directly to ECharts option schema.
- [ ] Add a renderer adapter layer:
  - `chartRenderer: "echarts"` (v1)
  - future pluggable renderers without metadata breaking changes.

---

## 8. Menu, Routes, and Metadata Navigation

### 8.1 Metadata-driven menu/action integration
- [x] Add metadata authoring convention for dashboard menu/action pairs:
  - action type `custom`
  - route template resolved to canonical dashboard route.
- [ ] Update backend menu path generation rules if needed for dashboard route parameters.

### 8.2 Permission model
- [ ] Define dashboard runtime permissions at dashboard definition and endpoint level.
- [ ] Update testing metadata generation to include new runtime controller permissions.

---

## 9. Migration and Rollout Strategy

### 9.1 Phase rollout
- [x] Phase A: remove legacy code and compile cleanly.
- [x] Phase B: introduce new backend runtime + metadata schema + provider set for queue-health reference dashboard.
- [ ] Phase C: introduce UI runtime + Gridstack + ECharts adapter + baseline widgets.
- [ ] Phase D: add user layout persistence and menu integration.
- [ ] Phase E: documentation, sample module metadata, agent reference implementation.

### 9.2 Data/config migration
- [ ] Provide migration script or one-time converter for old dashboard JSON to new metadata schema (where feasible).
- [ ] Explicitly document non-migratable legacy constructs and fallback behavior.

---

## 10. Testing and Quality Gates

### 10.1 Backend tests
- [ ] Unit tests for provider registry resolution, schema validation, and controller contract.
- [ ] Integration tests for dashboard definition load, widget data batch response, variable option resolution, layout upsert/load.
- [ ] Security tests for SQL/provider guardrails.

### 10.2 Frontend tests
- [ ] Component tests for dynamic filter rendering from metadata.
- [ ] Widget host tests for loading/error/retry states.
- [ ] Layout persistence tests (save/load/reset).
- [ ] Route/menu rendering tests for dashboard navigation.

### 10.3 End-to-end smoke
- [x] Seed one reference dashboard in sample metadata.
- [ ] Validate: open dashboard -> apply filters -> render widgets -> drag/resize -> save layout -> reload persistence.

---

## 11. Documentation and Developer Experience

### 11.1 Framework docs
- [ ] Add “Dashboard Metadata Authoring Guide”.
- [ ] Add “Build a Custom Dashboard Widget Provider” guide.
- [ ] Add “Frontend DashboardWidget extension contract” guide.

### 11.2 Agent-ready templates
- [ ] Add reference widget provider template files.
- [ ] Add reference dashboard metadata JSON template.
- [ ] Add checklist for creating a new widget end-to-end.

---

## 12. Agent Project Enablement (Skills and Tooling)

### 12.1 Agent capability goals
- [ ] Enable agents to discover dashboard definitions, variables, widgets, and layout metadata quickly.
- [ ] Enable agents to generate new dashboard/widget scaffolds that conform to framework contracts.
- [ ] Enable agents to validate dashboard metadata and provider wiring before runtime.
- [ ] Enable agents to troubleshoot dashboard rendering/data issues with structured diagnostics.

### 12.2 New/updated skill surfaces
- [ ] Add a dedicated agent skill guide for dashboard implementation:
  - metadata authoring (`dashboards`, `variables`, `widgets`, `defaultLayout`)
  - backend provider scaffolding (`IDashboardWidgetDataProvider`)
  - frontend widget extension scaffolding (`dashboardWidget` type)
  - menu/action/route integration pattern.
- [ ] Add cookbook-style examples in the skill:
  - create dashboard from scratch
  - add a new widget type
  - add variable-driven filtering
  - persist and reset user layout.
- [ ] Add anti-patterns and guardrails section:
  - avoid hard-coded UI branches per widget
  - enforce provider response contract
  - enforce parameterized SQL and payload limits.

### 12.3 Tooling opportunities (optional but recommended)
- [ ] Add CLI-style helper commands (or MCP handlers) for:
  - scaffold dashboard metadata block
  - scaffold backend widget provider class
  - scaffold frontend dashboard widget component
  - run dashboard metadata validation.
- [ ] Add validation utility callable by agents:
  - checks metadata schema compliance
  - checks referenced providers/widgets/routes exist
  - checks layout schema compatibility.
- [ ] Add introspection/debug endpoint(s) for agents:
  - list registered dashboard widget providers
  - preview resolved dashboard definition
  - dry-run widget data contract output.

### 12.4 Agent integration with existing project tooling
- [ ] Extend existing MCP handler ecosystem to support dashboard-specific actions:
  - create dashboard
  - add widget to dashboard
  - add variable to dashboard
  - regenerate menu/action links for dashboard routes.
- [ ] Ensure handler outputs are idempotent and metadata-safe (no duplicate entries, deterministic updates).
- [ ] Add structured result payloads so agents can chain operations reliably.

### 12.5 Agent quality and safety checks
- [ ] Add preflight checks agents must run before patch generation:
  - schema validation
  - provider registration check
  - permission mapping check
  - route resolution check.
- [ ] Add post-change verification checklist for agents:
  - metadata compiles/loads
  - widget provider resolves in registry
  - UI widget mounts with mocked data
  - layout save/load roundtrip works.
- [ ] Add fail-fast diagnostics format:
  - missing provider
  - invalid widget type
  - malformed layout
  - variable expression mismatch.

### 12.6 Agent adoption rollout
- [ ] Phase 1: publish the dashboard skill + templates with one golden-path example.
- [ ] Phase 2: add scaffold + validation tools for fast and safe agent output.
- [ ] Phase 3: add advanced capabilities (migration assistant, dashboard linting, widget contract tests).
- [ ] Track adoption metrics:
  - time to create new dashboard
  - first-pass success rate
  - number of manual fixes after agent-generated changes.

---

## 13. Immediate Execution Checklist (Sprint-1 Proposal)

- [ ] Finalize canonical route format (`/admin/core/:module/dashboard/:dashboardName` vs `/admin/dashboard/:dashboardName`).
- [ ] Freeze new metadata schema draft (`dashboards.variables.widgets.layout`).
- [x] Delete legacy dashboard code paths in `solid-core-module`.
- [x] Delete legacy dashboard code paths in `solid-core-ui`.
- [x] Add new provider decorator + registry wiring + introspection.
- [x] Add new runtime controller + definition/data endpoints.
- [ ] Add dashboard layout metadata model and run code generation for persistence service/entity.
- [ ] Add UI dashboard page scaffold with metadata header + variable bar.
- [ ] Add Gridstack integration adapter and persist layout flow.
- [ ] Add ECharts renderer adapter + first 2 widgets (KPI + Bar/Line).
- [ ] Add one sample dashboard metadata entry in `solid-library-management` as reference.

---

## 14. External Library Notes (validated May 30, 2026)

- [ ] ECharts official feature/license references:
  - https://echarts.apache.org/
  - https://echarts.apache.org/en/feature.html
  - https://echarts.apache.org/faq
- [ ] Gridstack docs/releases references:
  - https://gridstackjs.com/
  - https://gridstackjs.com/doc/html/classes/GridStack.html
  - https://github.com/gridstack/gridstack.js/releases
