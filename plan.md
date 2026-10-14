# Plan: Prevent Setting Key Collisions with a Backward-Compatible Namespace Bridge

## Status

Proposed implementation plan.

## Problem

`SettingService.getAllSettingsFromProviders()` currently treats a setting's bare `key` as its global identity. A custom `@SettingsProvider()` can therefore collide with a Solid Core setting when both define a generic key such as `clientID`, `secret`, `callbackURL`, or `audience`.

The current duplicate check prevents silent overwrites, but the collision causes settings initialization or cache refresh to fail at runtime.

## Goals

- Allow different settings providers to use the same local key safely.
- Preserve all existing Solid Core keys, database rows, callers, APIs, and provider implementations.
- Avoid a database schema migration.
- Avoid requiring every provider to maintain a separate `ProviderSettingKeys` object.
- Keep collision detection deterministic and fail fast for genuine duplicates.
- Provide a clear migration path for existing custom providers.

## Non-goals

- Renaming existing Solid Core setting keys.
- Migrating existing database rows to prefixed keys.
- Replacing the current `ss_setting.key` unique index with a composite database constraint.
- Automatically migrating legacy custom providers.
- Allowing one provider to override another provider's setting silently.

## Decision

Add an optional, stable namespace to `@SettingsProvider()`.

Providers without a namespace retain the current behavior. Providers with a namespace declare local keys, and `SettingService` converts them to canonical keys internally:

```text
canonical key = <provider namespace>:<local key>
```

Example:

```ts
@SettingsProvider('acme-payments')
@Injectable()
export class AcmePaymentsSettingsProvider implements ISettingsProvider {
  getSettings(): SettingDefinition[] {
    return [
      {
        moduleName: 'acme-payments',
        key: 'clientID',
        value: '',
        level: SettingLevel.SystemAdminEditable,
      },
    ];
  }
}
```

The effective key used by the cache, database, admin API, and update flows is:

```text
acme-payments:clientID
```

An existing provider remains unchanged:

```ts
@SettingsProvider()
export class SolidCoreDefaultSettingsProvider implements ISettingsProvider {
  // Existing bare keys remain unchanged.
}
```

## Why this approach

This preserves the existing storage and transport model: the resolved key remains the single identifier used throughout the system. The existing unique index on `ss_setting.key` continues to provide database-level protection because canonical keys are globally unique strings.

It avoids the wider and riskier changes required by a `(moduleName, key)` composite database identity, including entity migration, nullable legacy rows, DTO changes, module-aware file uploads, repository query changes, and UI contract changes.

`moduleName` remains descriptive metadata. The provider namespace is the stable machine identifier used to construct setting identity. Multiple provider classes may share a namespace as long as their effective setting keys are distinct.

## Compatibility contract

### Legacy providers

The following remains valid and behaves exactly as it does today:

```ts
@SettingsProvider()
```

- Keys are not rewritten.
- Existing database rows remain valid.
- Existing `getConfigValue(key)` calls remain valid.
- Existing admin API payloads remain valid.
- Existing duplicate-key behavior remains valid.

### Namespaced providers

New and migrated custom providers use:

```ts
@SettingsProvider('acme-payments')
```

- Definitions contain local keys such as `clientID`.
- The framework resolves them to `acme-payments:clientID`.
- New database rows use the canonical key.
- Callers use the module-scoped accessor or the canonical key.

No existing key is changed automatically.

### Important: adding a namespace to an existing provider

Adding a namespace to a provider that has already seeded bare keys is a data migration, not a backward-compatible metadata-only change.

For example, if the database contains `clientID` and the provider changes to `@SettingsProvider('nbf')`, the next seed looks for `nbf:clientID`. It does not rename `clientID`; it creates `nbf:clientID` with the provider default while the old row remains unused.

Before enabling the namespace in production, use an explicit, transactional provider migration that:

1. Checks whether both the legacy and canonical rows exist and aborts on conflict.
2. Verifies ownership using `moduleMetadata.name` where available.
3. Renames each allowlisted legacy key, for example `clientID` to `nbf:clientID`.
4. Preserves the existing value, encryption flag, level, type, user, and module relation.
5. Runs before settings seeding and cache refresh.

Deleting and reseeding is acceptable only when resetting values to provider defaults is intentional, such as in a disposable development environment.

## Naming rules

Provider namespaces must:

- Be explicit and stable across releases.
- Use lowercase letters, digits, hyphens, and optional dot-separated segments.
- Start with a lowercase letter.
- Not contain the canonical separator `:`.
- Not be a user-facing display label.
- Be stable and intentionally shared only by providers that belong to the same namespace.

Recommended validation:

```ts
const SETTINGS_NAMESPACE_PATTERN =
  /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)*$/;
```

Examples:

```text
acme-payments
library-management
com.acme.payments
```

Local keys:

- Must not be empty.
- Must not contain `:`.
- Need only be unique within their provider namespace.

Reserve `solid-core` for possible future migration of Solid Core settings.

## Implementation plan

### Phase 1: Extend the provider decorator without breaking discovery

**File:** `src/decorators/settings-provider.decorator.ts`

Keep the existing boolean marker and add separate namespace metadata:

```ts
import { applyDecorators, SetMetadata } from '@nestjs/common';

export const IS_SETTINGS_PROVIDER = 'IS_SETTINGS_PROVIDER';
export const SETTINGS_PROVIDER_NAMESPACE =
  'SETTINGS_PROVIDER_NAMESPACE';

export const SettingsProvider = (namespace?: string) =>
  applyDecorators(
    SetMetadata(IS_SETTINGS_PROVIDER, true),
    SetMetadata(SETTINGS_PROVIDER_NAMESPACE, namespace),
  );
```

Keeping `IS_SETTINGS_PROVIDER` unchanged ensures that the existing discovery logic in `SolidIntrospectService` continues to work.

### Phase 2: Add a single canonical-key helper

Add a shared helper near the settings implementation:

```ts
export const SETTINGS_KEY_SEPARATOR = ':';

export function buildSettingKey(
  namespace: string,
  localKey: string,
): string {
  return `${namespace}${SETTINGS_KEY_SEPARATOR}${localKey}`;
}
```

All namespaced lookups and transformations must use this helper. Do not manually concatenate canonical keys in multiple places.

The helper should validate namespace and local-key input either directly or through provider validation performed before it is called.

### Phase 3: Resolve provider settings to canonical keys

**File:** `src/services/setting.service.ts`

When gathering settings:

1. Read optional namespace metadata from the provider class.
2. Validate each declared namespace.
3. Convert local keys to canonical keys only for namespaced providers.
4. Keep legacy-provider keys unchanged.
5. Run the duplicate check against the effective key.

Conceptual flow:

```ts
const namespace = this.reflector.get<string | undefined>(
  SETTINGS_PROVIDER_NAMESPACE,
  wrapper.metatype,
);

const effectiveKey = namespace
  ? buildSettingKey(namespace, setting.key)
  : setting.key;

const resolvedSetting = {
  ...setting,
  key: effectiveKey,
};
```

The settings returned by `getAllSettingsFromProviders()` must contain effective keys. Existing downstream code can then continue using `setting.key` without learning about local keys.

Do not mutate the object returned by the provider. Create a resolved copy so repeated cache refreshes cannot double-prefix a key.

### Phase 4: Keep the current cache and persistence model

Continue indexing resolved settings by their effective key:

```ts
this.settingsByKey = new Map(
  this.settings.map(setting => [setting.key, setting]),
);
```

Examples:

```text
Legacy/core setting:  clientID
Namespaced setting:   acme-payments:clientID
```

No entity or schema change is required. The existing unique index on `ss_setting.key` remains correct.

Because provider aggregation resolves keys before seeding and cache hydration, existing seeding, encryption, editability checks, admin updates, and file-setting flows continue to operate on one unambiguous key.

### Phase 5: Add a module-scoped accessor

**File:** `src/services/setting.service.ts`

Keep the existing accessor unchanged:

```ts
getConfigValue<T = never>(settingKey: NoInfer<T>)
```

It must continue performing an exact lookup of the supplied key. Do not silently redirect bare keys to `solid-core:<key>`, because existing Solid Core rows and cache entries remain unqualified.

Add:

```ts
forModule(namespace: string) {
  return {
    get: <T = never>(key: NoInfer<T>) =>
      this.getConfigValue<T>(
        buildSettingKey(namespace, key as string),
      ),
  };
}
```

Usage:

```ts
this.settingService
  .forModule('acme-payments')
  .get<AcmePaymentSetting>('clientID');
```

Direct canonical lookup remains possible:

```ts
this.settingService.getConfigValue(
  'acme-payments:clientID',
);
```

`forModule()` removes the need for a separate `ProviderSettingKeys` object while keeping call sites explicit.

If repeated creation of the accessor becomes relevant, it can later be cached by namespace; it is not necessary for the initial implementation.

### Phase 6: Improve diagnostics safely

Do not include complete setting definitions or values in collision errors. Default values may contain credentials or other secrets.

Required collision error:

```text
Duplicate effective setting key "acme-payments:clientID":
FirstProvider and SecondProvider.
```

Errors should include provider class names for diagnostics but must not use class names as persistent namespaces.

### Phase 7: Document adoption

Document the following rule:

> All new custom settings providers must declare a stable namespace. Existing unnamespaced providers remain supported for backward compatibility.

Provide one complete custom-provider example using `@SettingsProvider(namespace)` and `forModule(namespace).get(key)`.

Do not emit warnings for every legacy provider in the first release. That could add noisy logs to existing applications. Deprecation warnings may be introduced later with an explicit migration policy.

## Files expected to change

- `src/decorators/settings-provider.decorator.ts`
- `src/services/setting.service.ts`
- Unit/integration tests for settings providers and `SettingService`
- Settings-provider documentation or example

The following should not require changes:

- `src/entities/setting.entity.ts`
- Existing database migrations
- Existing settings DTOs
- Existing admin controller contract
- Existing Solid Core setting definitions
- Existing `getConfigValue()` call sites

## Test plan

### Backward compatibility

1. An existing `@SettingsProvider()` returns exactly the same keys as before.
2. Existing Solid Core keys remain bare.
3. Existing `getConfigValue<SolidCoreSetting>('clientID')` calls still resolve.
4. Existing database rows are read without migration.
5. Existing admin settings requests continue to update the same rows.

### Namespaced behavior

1. `@SettingsProvider('module-a')` with local key `clientID` resolves to `module-a:clientID`.
2. `module-a:clientID` and `module-b:clientID` coexist.
3. A legacy `clientID` and namespaced `module-a:clientID` coexist.
4. `forModule('module-a').get('clientID')` returns the correct value.
5. Namespaced settings seed and hydrate from the database correctly.
6. Namespaced encrypted settings encrypt and decrypt correctly.
7. Namespaced readonly settings cannot be modified.
8. Namespaced file settings round-trip through multipart updates.
9. Admin API returns and accepts the canonical key.

### Validation

1. Two providers sharing a namespace with different local keys are allowed.
2. Two providers sharing a namespace and local key are rejected.
3. A namespaced provider declaring the same local key twice is rejected by effective-key validation.
4. Two legacy providers declaring the same bare key remain rejected.
5. Invalid namespaces are rejected.
6. Local keys containing `:` are rejected for namespaced providers.
7. Repeated cache refresh does not double-prefix keys.
8. Provider registration order does not change the result.
9. Error messages do not contain setting values.

## Rollout plan

### Release 1

- Add optional namespace support.
- Add canonical-key resolution.
- Add `forModule()`.
- Keep all legacy behavior.
- Require namespaces in documentation for new custom providers.

### Subsequent releases

- Migrate existing custom providers individually when desired.
- Provide a targeted data migration for a provider only when that provider changes from legacy keys to namespaced keys.
- Consider opt-in warnings for unnamespaced custom providers.

### Future major version, only if needed

- Consider namespacing Solid Core settings as `solid-core:<key>`.
- Provide a transactional database migration and compatibility lookup window.
- Consider making namespaces mandatory.

These future changes are not required to solve collisions for new custom providers.

## Risks and mitigations

### Namespace changes after deployment

Changing a namespace changes every canonical key and would disconnect existing database values.

**Mitigation:** Treat namespace as an immutable persistence identifier and document that contract.

### Double prefixing

A developer may supply `acme-payments:clientID` as a local key to a namespaced provider.

**Mitigation:** Reject `:` in local keys and resolve copies rather than mutating provider definitions.

### Namespace reuse

Multiple providers may intentionally share a module namespace.

**Mitigation:** Enforce uniqueness of the complete effective key (`namespace:localKey`), not the namespace alone.

### Legacy providers remain collision-prone

Two unnamespaced legacy providers can still collide.

**Mitigation:** Preserve the existing fail-fast duplicate check and require namespaces for all new providers. Migrate legacy custom providers incrementally.

## Acceptance criteria

- No existing setting key or database row is modified by upgrading.
- No existing `@SettingsProvider()` implementation must change.
- No existing Solid Core `getConfigValue()` call must change.
- A new provider can declare `key: 'clientID'` under its namespace without colliding with Solid Core's `clientID`.
- Two different namespaces can use the same local key.
- Duplicate effective keys within one namespace fail deterministically.
- Namespaced settings work through cache, seeding, database hydration, admin updates, encryption, readonly validation, and file uploads.
- No setting values are exposed in duplicate or validation errors.
- No database migration is required for the initial release.

## Final example

Provider:

```ts
@SettingsProvider('acme-payments')
@Injectable()
export class AcmePaymentsSettingsProvider implements ISettingsProvider {
  getSettings(): SettingDefinition[] {
    return [
      {
        moduleName: 'acme-payments',
        key: 'clientID',
        value: '',
        level: SettingLevel.SystemAdminEditable,
      },
    ];
  }
}
```

Lookup:

```ts
const clientID = this.settingService
  .forModule('acme-payments')
  .get<string>('clientID');
```

Effective cache/database/API key:

```text
acme-payments:clientID
```

Existing Solid Core lookup remains unchanged:

```ts
const clientID = this.settingService
  .getConfigValue<SolidCoreSetting>('clientID');
```
