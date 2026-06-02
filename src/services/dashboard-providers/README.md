# Dashboarding Architecture and Developer Guide

This document is the canonical guide for SolidX dashboarding in its new metadata-driven architecture.

It covers:
- end-to-end architecture (`solid-core-module` + `solid-core-ui`)
- metadata authoring model
- backend widget data providers
- frontend default/custom widget rendering
- layout persistence model
- extension points and troubleshooting

---

## 1. Guiding Principles

- **Metadata-first**: dashboard definitions live in module metadata JSON under root-level `dashboards`.
- **Provider-driven backend**: every widget resolves data through a backend data provider.
- **Extension-driven frontend**: widgets render through extension registry components (`dashboardWidget` type).
- **User personalization**: only user layout overrides are persisted; dashboard definitions are not persisted.

---

## 2. Source of Truth (Important)

### 2.1 What is persisted vs what is not

Persisted:
- user-specific layout override (`ss_dashboard_user_layout`)

Not persisted:
- dashboard definitions (`dashboards` metadata)
- variables
- widgets
- default layout

### 2.2 Metadata location resolution

At runtime, metadata is read from file paths resolved by `ModuleMetadataHelperService`:

1. `module-metadata/<module-name>/<module-name>-metadata.json`
2. fallback (solid-core local run): `src/seeders/seed-data/solid-core-metadata.json`
3. fallback (consuming project): `node_modules/@solidxai/core/src/seeders/seed-data/solid-core-metadata.json`

This is the most common reason for “changes not taking effect”: the running service may be reading the installed package metadata, not local source metadata.

---

## 3. End-to-End Runtime Flow

1. UI route opens dashboard page:
- `/admin/core/:moduleName/dashboard/:dashboardName`

2. UI loads definition:
- `GET /dashboard/:module/:dashboardName/definition`

3. UI loads layout:
- `GET /dashboard/:module/:dashboardName/layout`
- backend returns `{ defaultLayout, userLayout, effectiveLayout }`

4. UI resolves filters and requests data:
- `POST /dashboard/:module/:dashboardName/data`

5. Backend runtime service:
- reads metadata dashboard definition
- resolves provider per widget from registry
- checks widget permissions for the active user
- executes providers with variables + provider context only for authorized widgets
- returns normalized provider envelopes

6. User drag/resize save:
- `PUT /dashboard/:module/:dashboardName/layout`
- persists user layout override

---

## 4. Backend Architecture (`solid-core-module`)

### 4.1 Core runtime controller

File:
- `src/controllers/dashboard.controller.ts`

Endpoints:
- `GET /dashboard/:moduleName/:dashboardName/definition`
- `POST /dashboard/:moduleName/:dashboardName/widgets/:widgetName/data`
- `POST /dashboard/:moduleName/:dashboardName/data`
- `GET /dashboard/:moduleName/:dashboardName/variable-options/:variableName`
- `GET /dashboard/:moduleName/:dashboardName/layout`
- `PUT /dashboard/:moduleName/:dashboardName/layout`

All runtime dashboard endpoints are JWT-protected (`@ApiBearerAuth('jwt')`).

### 4.2 Runtime service

File:
- `src/services/dashboard-runtime.service.ts`

Responsibilities:
- load dashboard definition from metadata
- resolve and invoke widget providers
- resolve static/dynamic variable options
- compute `effectiveLayout` via default+user merge
- save per-user layout

### 4.3 Provider contract

File:
- `src/interfaces.ts`

Interfaces:
- `IDashboardWidgetDataProviderContext`
- `IDashboardWidgetDataResponseEnvelope`
- `IDashboardWidgetDataProvider`

Provider contract:
- `name(): string`
- `help(): string`
- `getData(widgetDefinition, ctxt): Promise<Envelope | any>`

Envelope shape:
- `meta`: provider name, widget name, duration, generatedAt
- `data`: widget payload
- `uiHints` (optional)

### 4.4 Provider registration flow

Files:
- decorator: `src/decorators/dashboard-widget-data-provider.decorator.ts`
- introspection: `src/services/solid-introspect.service.ts`
- registry: `src/helpers/solid-registry.ts`

Pattern:
- annotate with `@DashboardWidgetDataProvider()`
- introspection discovers providers
- registry stores providers
- runtime resolves by `widget.dataProvider`

### 4.5 Variable options providers

Dynamic selection variables reuse existing selection provider infrastructure.

Reference providers:
- `src/services/selection-providers/mq-dashboard-queue-name-variable-options-provider.service.ts`
- `src/services/selection-providers/mq-dashboard-message-broker-variable-options-provider.service.ts`

Metadata variable uses:
- `type: "selectionDynamic"`
- `selectionConfig.providerName`

### 4.6 Queue-health reference providers

Folder:
- `src/services/dashboard-providers/`

Includes KPI + charts + table providers:
- `mq-dashboard-total-messages-kpi-provider.service.ts`
- `mq-dashboard-succeeded-messages-kpi-provider.service.ts`
- `mq-dashboard-failed-messages-kpi-provider.service.ts`
- `mq-dashboard-inflight-messages-kpi-provider.service.ts`
- `mq-dashboard-success-rate-kpi-provider.service.ts`
- `mq-dashboard-avg-elapsed-kpi-provider.service.ts`
- `mq-dashboard-messages-over-time-provider.service.ts`
- `mq-dashboard-stage-distribution-provider.service.ts`
- `mq-dashboard-queue-wise-failures-provider.service.ts`
- `mq-dashboard-queue-wise-avg-elapsed-provider.service.ts`
- `mq-dashboard-latency-trend-provider.service.ts`
- `mq-dashboard-recent-failures-provider.service.ts`

Shared filter utilities:
- `mq-dashboard-provider-utils.ts`

### 4.7 Layout persistence model

Generated model and assets:
- entity: `src/entities/dashboard-user-layout.entity.ts`
- repository: `src/repositories/dashboard-user-layout.repository.ts`
- service: `src/services/dashboard-user-layout.service.ts`
- controller: `src/controllers/dashboard-user-layout.controller.ts`

Table:
- `ss_dashboard_user_layout`

Uniqueness:
- `(user_id, module_id, dashboard_name)`

Stored payload:
- `layoutJson` with Gridstack-compatible `items`.

---

## 5. Metadata Contract (`dashboards`)

Metadata file (solid-core reference):
- `src/seeders/seed-data/solid-core-metadata.json`

`dashboards` is a root peer of `actions`, `menus`, `roles`, `users`, etc.

### 5.1 Dashboard definition shape

Typical fields:
- `dashboardSchemaVersion`
- `name`
- `displayName`
- `description`
- `moduleUserKey`
- `variables[]`
- `widgets[]`
- `defaultLayout`

### 5.2 Variable types in current implementation

- `date`
- `selectionStatic`
- `selectionDynamic`
- `isMultiSelect` supported for selection types

Date variable payload sent to backend:
- `{ from?: ISO, to?: ISO }`
- UI preset flow supports `today`, `last_24_hours`, `last_7_days`, `last_30_days`, `custom`

Static selection:
- `selectionStaticValues: ["value:Label", ...]`

Dynamic selection:
- `selectionConfig.providerName`
- optional `selectionConfig.providerContext`

### 5.3 Widget definition shape

Typical fields:
- `id`
- `name`
- `type` (`kpi`, `lineChart`, `barChart`, `pieChart`, `table`, `customChart`, ...)
- `dataProvider`
- `providerContext`
- optional UI override:
  - `componentName` (or equivalent custom component key)

### 5.4 Default layout shape

`defaultLayout`:
- `engine: "gridstack"`
- `columns: number`
- `items[]` each with:
  - `widgetId`, `x`, `y`, `w`, `h`, optional `minW`, `minH`

### 5.5 Explicit widget permissions

Dashboards use SolidX's existing explicit permission mechanism for widget-level authorization.

Permission format:
- `dashboard:<dashboard-name>:<widget-pattern>`

Rules:
- the first segment is always `dashboard`
- the dashboard name must match exactly
- the widget segment supports:
  - exact widget names
  - `*`
  - regex-style patterns

Queue-health reference example:
- `dashboard:queue-health:kpi-.*`
- `dashboard:queue-health:chart-queue-.*`
- `dashboard:queue-health:chart-processing-latency-trend`

What this means:
- all KPI widgets are authorized by `kpi-.*`
- queue-oriented chart widgets such as `chart-queue-wise-failures`, `chart-queue-wise-avg-elapsed`, and `chart-queue-sla-heatmap` are authorized by `chart-queue-.*`
- `chart-processing-latency-trend` is authorized explicitly
- widgets like `chart-stage-distribution`, `chart-messages-over-time`, and `table-recent-failures` remain unauthorized unless extra permissions are granted

Important:
- dashboard developers must declare these permissions explicitly in module metadata
- they must then assign them to roles
- users receive them through standard SolidX RBAC

---

## 6. Frontend Architecture (`solid-core-ui`)

### 6.1 Route and page

Route registration:
- `src/routes/solidRoutes.tsx`
- path: `/admin/core/:moduleName/dashboard/:dashboardName`

Page:
- `src/routes/pages/admin/core/DashboardPage.tsx`

### 6.2 Dashboard API slice

File:
- `src/redux/api/dashboardRuntimeApi.ts`

Hooks:
- `useGetDashboardDefinitionQuery`
- `useGetDashboardLayoutQuery`
- `useSaveDashboardLayoutMutation`
- `useGetDashboardDataMutation`
- `useLazyGetDashboardVariableOptionsQuery`

### 6.3 Filter UX (current)

- Filters are rendered in a modal dialog (not inline panel)
- Header has icon CTAs: filter, refresh, save layout
- Filter icon shows applied-filter badge count
- Date variable UX:
  - preset dropdown first
  - selecting `custom` reveals start/end date pickers
- Dynamic selection uses Solid autocomplete primitives
- Static selection uses Solid primitives (single/multi behavior)

### 6.4 Layout engine

- Gridstack integration in `DashboardPage`
- layout source order:
  - `effectiveLayout.items` from backend
  - fallback computed layout from widget order
- save sends full layout snapshot for all widgets

### 6.5 Widget extension system

Types:
- `src/types/extension-registry.ts`
- includes `dashboardWidget`

Registry:
- `src/helpers/registry.ts`

Dashboard widget props:
- `src/types/dashboard.ts` (`DashboardWidgetComponentProps`)

Default registered dashboard widgets:
- `DefaultDashboardKpiWidget`
- `DefaultDashboardLineChartWidget`
- `DefaultDashboardBarChartWidget`
- `DefaultDashboardPieChartWidget`
- `DefaultDashboardTableWidget`
- `DefaultDashboardUnknownWidget`

### 6.6 Unauthorized widget rendering

Authorization is enforced on the backend first and reflected in the frontend second.

Current behavior:
- if the active user lacks widget permission, the backend does not invoke the widget provider at all
- the backend returns a normalized unauthorized envelope
- the frontend still renders the widget card in the dashboard grid
- the widget body shows a compact centered `Unauthorized` state

This preserves layout stability while ensuring protected widget data never leaves the server.

### 6.7 Chart abstraction

- baseline chart engine: Apache ECharts
- mapper lives under:
  - `src/components/core/dashboard/mappers/echartsOptionMapper`
- default chart widgets convert provider payload -> ECharts options

---

## 7. Developer Workflows

## 7.1 Create a new dashboard (metadata-first)

1. Add dashboard block under root `dashboards[]`
2. Define variables
3. Define widgets with `dataProvider`
4. Define `defaultLayout`
5. Add action/menu entries for navigation
6. ensure route points to `/admin/core/<module>/dashboard/<dashboardName>`

## 7.2 Add a new backend widget provider

1. Create provider class under `src/services/dashboard-providers`
2. Implement `IDashboardWidgetDataProvider`
3. Annotate with `@DashboardWidgetDataProvider()` + `@Injectable()`
4. Inject repositories and use security-rule-aware query builders
5. Return envelope with `meta` and `data`
6. Reference provider name in metadata widget definition

Minimal skeleton:

```ts
@DashboardWidgetDataProvider()
@Injectable()
export class MyWidgetProvider implements IDashboardWidgetDataProvider {
  name(): string {
    return "MyWidgetProvider";
  }

  help(): string {
    return "Returns data for My Widget.";
  }

  async getData(widgetDefinition: Record<string, any>, ctxt: IDashboardWidgetDataProviderContext) {
    return {
      meta: {
        providerName: this.name(),
        widgetName: ctxt.widgetName,
        generatedAt: new Date().toISOString(),
        durationMs: 0,
      },
      data: {
        value: 123,
      },
    };
  }
}
```

## 7.3 Add dynamic variable options provider

1. Create `ISelectionProvider` class
2. Decorate with `@SelectionProvider()`
3. Implement `value()` and `values()`
4. Reference provider in variable `selectionConfig.providerName`

## 7.4 Add a custom frontend widget (optional)

Custom rendering is optional.

Model:
- backend provider is mandatory for data
- custom widget component is optional override

Steps:
1. Create component in UI project
2. Register with `registerExtensionComponent(..., ExtensionComponentTypes.dashboardWidget)`
3. Reference component in widget metadata (`componentName`)
4. If no custom widget is provided, framework default widgets are used

---

## 8. Queue Health Reference Implementation

Reference dashboard:
- module: `solid-core`
- dashboard: `queue-health`

Variables:
- `date` (`type: date`)
- `queueName` (`selectionDynamic`)
- `stage` (`selectionStatic`, multi)
- `messageBroker` (`selectionDynamic`)

Widgets include:
- KPIs (total, succeeded, failed, in-flight, success rate, avg elapsed)
- Charts (time series, stage distribution, queue failures, queue avg elapsed, latency trend)
- Custom chart (Queue SLA Heatmap)
- Table (recent failures)

This RI is the baseline for future dashboards and for custom widget extension examples.

It also now includes the canonical 100% custom widget example:
- backend provider: `MqDashboardQueueSlaHeatmapProvider`
- frontend widget: `QueueSlaHeatmapWidget`

Heatmap provider response contract:
- `xCategories`
- `yCategories`
- `points` (`[xIndex, yIndex, metricValue]`)
- optional `tooltipFields`
- optional `pointDetails`
- optional `legendThresholds`

Queue-health permission example used for validating the authorization flow:
- `dashboard:queue-health:kpi-.*`
- `dashboard:queue-health:chart-queue-.*`
- `dashboard:queue-health:chart-processing-latency-trend`

---

## 9. Troubleshooting Guide

### 9.1 Metadata change not reflecting

Check which metadata file runtime reads (see Section 2.2 precedence).

In consuming projects, ensure latest package is linked/installed:
- `@solidxai/core`
- `@solidxai/core-ui`

Then restart backend and frontend dev servers.

### 9.2 Layout saves but refresh shows old layout

Checklist:
- verify `GET /dashboard/:module/:dashboard/layout` returns updated `userLayout` / `effectiveLayout`
- confirm UI bundle includes latest `DashboardPage` grid initialization logic
- clear Vite cache and hard refresh browser

### 9.3 Dynamic options not showing

Checklist:
- variable `type` is exactly `selectionDynamic`
- `selectionConfig.providerName` matches provider `name()`
- provider class has `@SelectionProvider()` and is registered via module wiring

### 9.4 Widget shows fallback/unknown renderer

Checklist:
- provider returns expected shape in `data`
- widget metadata `type` aligns with default mapper support
- if using custom renderer, ensure component is registered as `dashboardWidget`

### 9.5 Auth / permission issues

- Dashboard runtime endpoints require JWT
- verify the authenticated user can access the module and dashboard route in the consuming app
- verify explicit dashboard widget permissions are declared in metadata
- verify those permissions are assigned to the correct roles
- remember that unauthorized widgets still render their card, but the provider will not run and the body will show `Unauthorized`

---

## 10. Security and Guardrails (Current + Near-term)

Current:
- JWT-protected endpoints
- repository/security-rule-aware query builder usage in reference providers

Recommended next:
- strict provider allowlist enforcement in runtime layer
- query timeout and payload-size limits
- row limits for heavy chart/table providers

---

## 11. API Examples

### 11.1 Fetch definition

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/dashboard/solid-core/queue-health/definition"
```

### 11.2 Fetch full dashboard data

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE_URL/dashboard/solid-core/queue-health/data" \
  -d '{
    "variables": {
      "date": { "from": "2026-05-01T00:00:00.000Z", "to": "2026-05-31T23:59:59.999Z" },
      "queueName": "create_sandbox_dev_sandbox_provisioning_queue",
      "stage": ["failed", "retrying"]
    }
  }'
```

### 11.3 Save layout

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  "$BASE_URL/dashboard/solid-core/queue-health/layout" \
  -d '{
    "layout": {
      "engine": "gridstack",
      "columns": 12,
      "items": [
        { "widgetId": "kpi-total-messages", "x": 0, "y": 0, "w": 2, "h": 2 }
      ]
    }
  }'
```

---

## 12. What to Reuse vs What to Customize

Reuse defaults when:
- metric/table/chart fits existing renderer types
- ECharts mapper can render your shape

Create custom component when:
- interaction/visual behavior is domain-specific
- advanced chart behavior is needed beyond generic renderer

Always keep backend provider contract stable so UI remains pluggable.

---

## 13. Current Status Snapshot

Implemented:
- metadata-driven dashboard runtime
- backend provider contracts + registry wiring
- dashboard controller endpoints
- queue-health reference providers
- dynamic variable options providers
- frontend dashboard page, filter modal, Gridstack persistence
- ECharts-based default dashboard widgets
- `dashboardWidget` extension type and default registrations
- user layout persistence via generated model assets

Pending/next:
- stronger runtime schema validation and guardrails
- richer renderer pluggability contract (`chartRenderer` beyond v1)
- additional documentation templates and automated validation helpers
