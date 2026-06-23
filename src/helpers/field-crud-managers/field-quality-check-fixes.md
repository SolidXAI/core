# Field Quality Checks And Fixes

This checklist tracks backend issues and logical enhancements for each field type in `solid-core-module`.

Use it for backend concerns only:

- CRUD validation
- transformation and normalization
- persistence behavior
- relation semantics
- field-level correctness and consistency

Frontend widget and rendering concerns belong in `solid-core-ui`.

## `shortText`

- [ ] Resolve the `length` versus `max` contract for `shortText` and document one clear meaning for each attribute.
- [ ] Decide whether backend validation should also enforce `min`, so `shortText` constraints remain consistent even outside generated form flows.
- [ ] Return the configured regex mismatch message when `regexPatternNotMatchingErrorMsg` is present instead of always using a generic regex error.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `shortText` field.
- [ ] Decide whether `shortText` should support optional normalization such as trimming or whitespace collapsing, and keep that decision consistent across comparable text field types.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for partial update behavior, empty string versus null handling, regex validation, and max-length enforcement.
- [ ] Review whether the text-oriented managers share enough behavior to justify a common validation utility or base manager without weakening field-specific semantics.

## `longText`

- [ ] Decide whether backend validation should also enforce `min` and `max`, so `longText` constraints remain consistent outside generated form flows.
- [ ] Return the configured regex mismatch message when `regexPatternNotMatchingErrorMsg` is present instead of always using a generic regex error.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `longText` field.
- [ ] Decide whether `longText` should support optional normalization such as trimming trailing whitespace while preserving intentional line breaks.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for multiline content, regex validation, partial updates, and empty string versus null handling.
- [ ] Review whether the text-oriented managers share enough behavior to justify a common validation utility or base manager without weakening field-specific semantics.

## `richText`

- [ ] Decide whether backend validation should also enforce `min` and `max`, so `richText` constraints remain consistent outside generated form flows.
- [ ] Return the configured regex mismatch message when `regexPatternNotMatchingErrorMsg` is present instead of always using a generic regex error.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `richText` field.
- [ ] Decide whether `richText` should support optional normalization or sanitization at save time, and define that behavior explicitly.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for rich HTML-like content, regex validation, partial updates, and empty string versus null handling.
- [ ] Review whether the text-oriented managers share enough behavior to justify a common validation utility or base manager without weakening field-specific semantics.

## `json`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `json` field.
- [ ] Decide whether backend validation should accept only stringified JSON or also handle already-parsed object and array payloads more explicitly.
- [ ] Review whether the current JSON validation error should distinguish between invalid JSON syntax and unsupported runtime value shapes.
- [ ] Decide whether normalization or canonical stringification should happen before persistence for comparable JSON values.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for object payloads, array payloads, stringified JSON payloads, invalid JSON, partial updates, and empty string versus null handling.

## `int`

- [ ] Fix the current min/max activation rule, because backend validation only applies numeric bounds when the configured value is greater than `0`, which skips valid `0` and negative thresholds.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits an `int` field.
- [ ] Decide whether the CRUD layer should normalize numeric strings into integers more explicitly before validation and persistence.
- [ ] Review whether integer fields should reject decimal-shaped inputs more clearly when values arrive from metadata-driven clients as strings.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for `0`, negative values, numeric strings, invalid decimal-like input, min/max bounds, and partial update behavior.


## `bigint`

- [ ] Clarify the authored support surface for `bigint`, because the CRUD manager contains numeric bound logic while the authored field surface does not currently present `min` and `max` in the same way as `int` and `decimal`.
- [ ] Fix or clarify the current numeric-bound activation rule if bigint bounds are intended to be supported, since the logic only applies bounds when the configured value is greater than `0`.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `bigint` field.
- [ ] Decide what the canonical runtime contract should be for bigint inputs: native `bigint`, numeric strings, or finite JavaScript numbers.
- [ ] Review whether accepting finite JavaScript numbers for bigint validation is sufficient when exact large-integer fidelity matters.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for numeric strings, very large values, invalid numeric input, bound handling, null handling, and partial update behavior.


## `decimal`

- [ ] Fix the current min/max activation rule, because backend validation only applies numeric bounds when the configured value is greater than `0`, which skips valid `0` and negative thresholds.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `decimal` field.
- [ ] Decide whether the CRUD layer should normalize numeric strings into decimal numbers more explicitly before validation and persistence.
- [ ] Review whether decimal fields need an explicit precision-and-scale contract instead of relying entirely on the persistence-layer `ormType`.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for `0`, negative values, fractional values, numeric strings, invalid numeric input, min/max bounds, and partial update behavior.


## `boolean`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `boolean` field.
- [ ] Decide whether boolean CRUD validation should accept only runtime booleans or also normalize `"true"` and `"false"` string payloads when they arrive from metadata-driven clients.
- [ ] Review whether the required validation path should distinguish more clearly between an omitted value and an explicit `false` value, especially for partial updates.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for `true`, `false`, null, empty string, string booleans, and partial update behavior.

## `date`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `date` field.
- [ ] Review whether the CRUD layer should accept only runtime `Date` objects or also normalize common serialized date inputs more explicitly before validation.
- [ ] Decide whether `date` and `datetime` should continue to share the same backend validation path or receive more distinct normalization and validation behavior.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for `Date` objects, serialized date strings, null handling, invalid date inputs, and partial update behavior.

## `datetime`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `datetime` field.
- [ ] Review whether the CRUD layer should accept only runtime `Date` objects or also normalize common serialized datetime inputs more explicitly before validation.
- [ ] Decide whether `date` and `datetime` should continue to share the same backend validation path or receive more distinct normalization and validation behavior.
- [ ] Review whether timezone normalization rules should be documented and enforced more explicitly at save time.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for `Date` objects, serialized datetime strings, null handling, timezone-sensitive values, invalid datetime inputs, and partial update behavior.

## `time`

- [ ] Add an explicit CRUD-manager path for `SolidFieldType.time`, since the field currently has core UI support but is not routed through a dedicated backend field manager.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `time` field.
- [ ] Decide what canonical persisted shape `time` should use: pure time string, database-native time value, or a normalized timestamp-derived representation.
- [ ] Review whether the CRUD layer should normalize common time inputs such as `HH:mm:ss`, ISO timestamps, and UI-submitted values more explicitly before validation and persistence.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for `HH:mm:ss` inputs, ISO-style inputs, invalid time values, null handling, and partial update behavior.

## `email`

- [ ] Decide whether backend validation should also enforce `min`, so email constraints remain consistent outside generated form flows.
- [ ] Return the configured regex mismatch message when `regexPatternNotMatchingErrorMsg` is present instead of always using a generic regex error.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits an `email` field.
- [ ] Decide whether email values should support optional normalization such as trimming and lowercasing before persistence.
- [ ] Review whether uniqueness should receive any pre-save validation support at the CRUD layer or continue to rely entirely on persistence-layer constraints.
- [ ] Add targeted coverage for max-length enforcement, regex overrides, invalid email formats, null handling, and partial update behavior.

## `password`

- [ ] Return the configured regex mismatch message when `regexPatternNotMatchingErrorMsg` is present instead of always using a generic password-regex error.
- [ ] Review whether password validation should produce clearer error messages for min, max, regex, and confirm-password mismatch failures.
- [ ] Clarify and implement the expected behavior for `defaultValue` on password fields, including whether it should be ignored entirely for secure create flows.
- [ ] Review whether password hashing and password-update flows should share a more explicit single contract across create and update operations.
- [ ] Decide whether password normalization should include trimming or whether exact raw user input should always be preserved before hashing.
- [ ] Add targeted coverage for create-required behavior, update-optional behavior, confirm-password mismatch, hashing behavior, regex fallback behavior, and partial update behavior.

## `selectionStatic`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `selectionStatic` field, especially for multi-select fields.
- [ ] Decide whether the CRUD layer should normalize single-select and multi-select payloads into one consistent stored shape before persistence.
- [ ] Review whether the current `selectionStaticValues` parsing should validate malformed `value:label` entries more explicitly instead of assuming a valid authored format.
- [ ] Add clearer error messaging when the submitted value has the wrong type versus when it is simply not part of the authored option set.
- [ ] Review whether numeric selection values need more explicit normalization, especially when values can arrive as strings from metadata-driven clients.
- [ ] Add targeted coverage for single-select string values, single-select numeric values, JSON-stringified multi-select arrays, invalid option tokens, malformed arrays, and partial update behavior.

## `selectionDynamic`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `selectionDynamic` field, especially for multi-select fields.
- [ ] Review whether the CRUD layer should normalize single-select and multi-select payloads into one consistent stored shape before persistence.
- [ ] Add clearer error messaging when the submitted value has the wrong type, when the provider rejects the value, and when the provider itself cannot be resolved.
- [ ] Review whether numeric selection values need more explicit normalization, especially when values can arrive as strings from metadata-driven clients.
- [ ] Clarify how `validateOnSave` in `selectionDynamicProviderCtxt` should be treated as part of the supported field contract and whether more provider-context keys should be validated.
- [ ] Add targeted coverage for provider-backed single-select values, JSON-stringified multi-select arrays, invalid provider names, `validateOnSave: false`, invalid option values, and partial update behavior.

## `many-to-one`

- [ ] Clarify and document the preferred request contract for single relations, because accepting both `<fieldName>Id` and `<fieldName>UserKey` is useful but easy to apply inconsistently across clients.
- [ ] Review whether the CRUD layer should normalize empty strings for `<fieldName>Id` and `<fieldName>UserKey` more explicitly before required validation runs.
- [ ] Decide whether user-key-based lookup failures should return a more specific error message than generic required or invalid relation errors.
- [ ] Review whether relation resolution should support optional fixed-filter enforcement at save time in addition to UI-level filtering.
- [ ] Consider whether uniqueness on a `many-to-one` field should receive clearer pre-save validation when the authored intent effectively makes the relation one-to-one.
- [ ] Add targeted coverage for id-based lookup, user-key-based lookup, missing required relations, invalid id shapes, invalid user keys, and partial update behavior.

## `one-to-many`

- [ ] Clarify and document the command contract for collection relations so `set`, `clear`, `link`, `unlink`, `create`, `update`, and `delete` are easier to use consistently from clients.
- [ ] Review whether malformed or unsupported command values should return more specific validation errors than the current generic failure path.
- [ ] Decide whether create-time and update-time collection mutation semantics should be normalized more explicitly, especially where some commands are intentionally update-only.
- [ ] Review whether `relationCoModelFieldName` should be validated more aggressively, because this field is central to child binding and inverse resolution.
- [ ] Consider whether `relationFieldFixedFilter` should be enforced during relation mutation so child records cannot be linked outside the authored collection scope.
- [ ] Add targeted coverage for `set`, `clear`, `link`, `unlink`, `create`, `update`, `delete`, invalid command payloads, and partial update behavior.

## `many-to-many`

- [ ] Clarify and document owner-side versus inverse-side mutation semantics so clients understand which effective field names and id lists are honored during CRUD operations.
- [ ] Review whether malformed owner-side metadata such as missing `isRelationManyToManyOwner` or mismatched inverse names should fail earlier and more clearly.
- [ ] Decide whether `relationJoinTableName` and related ownership attrs need stronger validation at metadata authoring time to avoid ambiguous join behavior later.
- [ ] Review whether `relationFieldFixedFilter` should be enforced during membership mutation so unsupported links cannot be created through direct payloads.
- [ ] Consider whether create, update, and delete operations against related entities should be more clearly separated from plain membership operations such as `set`, `link`, and `unlink`.
- [ ] Add targeted coverage for owner-side mutations, inverse-side mutations, `set`, `clear`, `link`, `unlink`, related-entity create/update/delete flows, and partial update behavior.

## `mediaSingle`

- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `mediaSingle` field, including whether the field should ever accept persisted references without a new upload.
- [ ] Review whether media validation should normalize authored `mediaTypes` values more explicitly so unsupported tokens fail early and predictably.
- [ ] Consider whether storage-provider resolution should fail with a clearer field-specific error when `mediaStorageProviderUserKey` is missing or invalid.
- [ ] Review whether replace and delete semantics should be more explicit in the CRUD layer when an existing asset is being updated or removed.
- [ ] Consider whether upload validation should be refactored into shared utilities so size, type, and required checks stay consistent across media field types.
- [ ] Add targeted coverage for required create-time uploads, oversized files, unsupported media types, missing providers, replacement flows, and partial update behavior.

## `mediaMultiple`

- [ ] Align collection-level validation with the single-media path so `mediaTypes` and `mediaMaxSizeKb` are enforced consistently for every uploaded file.
- [ ] Clarify and implement the expected behavior for `defaultValue` when a create payload omits a `mediaMultiple` field, including whether persisted media references should ever be accepted directly.
- [ ] Review whether storage-provider resolution should fail with a clearer field-specific error when `mediaStorageProviderUserKey` is missing or invalid.
- [ ] Decide what the canonical update semantics should be for attachment collections: append-only, replace-all, explicit remove, or a more command-style contract.
- [ ] Consider whether media collection validation should report per-file errors more explicitly when one file fails and others succeed.
- [ ] Add targeted coverage for required create-time collections, mixed valid and invalid uploads, oversized files, unsupported media types, missing providers, and partial update behavior.

## `computed`

- [ ] Clarify and document the supported provider contract more explicitly, including what a computed-field provider must return and how failures should be surfaced to callers.
- [ ] Review whether `computedFieldValueProviderCtxt` should be validated as JSON earlier and with clearer error messaging before provider execution begins.
- [ ] Decide whether inline computation should remain skipped on partial updates by default, or whether some computed fields need an opt-in recompute path during patch-style operations.
- [ ] Review whether `computedFieldTriggerConfig` should be validated more aggressively so unsupported operations or malformed trigger definitions fail earlier.
- [ ] Consider whether the CRUD layer should verify that the provider’s returned value matches `computedFieldValueType` before persistence.
- [ ] Add targeted coverage for inline provider execution, malformed provider context, missing providers, trigger-configured fields, partial updates, and mismatched computed value types.
