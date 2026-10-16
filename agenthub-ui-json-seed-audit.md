# AgentHub UI, JSON, and Seeder Audit

**Audited:** 2026-10-15  
**UI:** `http://localhost:3001`, Solid Core workspace, AgentHub forms  
**Metadata JSON:** `/opt/gitco/javascript/thing-7-agent-registry/solid-api/src/thing7-agent-registry/metadata/thing7-agent-registry-metadata.json`

This report records the live UI create/update checks, the resulting JSON, and the corresponding seeder behavior. All test records use the `codex-audit-20261015` prefix. No pre-existing records were edited or deleted. The older `codex-audit-20261015-tag` row (ID 31) was already present in the database when this run began; it was not changed.

## Live test results

At the start of this run, the JSON contained 3 Agents, 85 Skills, 4 Tools, 3 Tags, and no Secrets. The UI created one new record in each model. Agent, Skill, Tool, and Secret updates were then made only to those test records. The Tag has only its identifier and module, so no non-identifier update was available to test.

| Model | UI operation and saved record | JSON result | Outcome |
|---|---|---|---|
| Agent | Created ID `10`, `codex-audit-20261015-agent`, module `thing7-agent-registry`; updated title and added an input. Linked the test Tag, Skill, Tool, and Secret. | `agenthubAgents` entry updated with scalar fields, `requiredInputs`, `moduleUserKey`, and relations `tags`, `agentSkills`, `agentTools`, `agentSecrets`. | **Create and update passed.** Relation fields and exact values verified in JSON. Roles were not assigned in the test. |
| Skill | Created ID `138`, `codex-audit-20261015-skill`; updated description and linked the test Tag. | `agenthubSkills` entry contains `name`, `type`, `description`, `body`, `tags`, and `moduleUserKey`. Agent link appears in `agenthubAgents[].agentSkills` with `alwaysInclude`. | **Create and update passed.** |
| Tool | Created ID `55`, `codex-audit-20261015-tool`; updated description and linked the test Tag. | `agenthubTools` entry contains `name`, `type`, `description`, `sourceCode`, derived `checksum`, `status`, `tags`, and `moduleUserKey`. Agent link appears in `agenthubAgents[].agentTools` with `requiresApproval`. | **Create and update passed.** Tool remained Inactive; no code was run. |
| Tag | Created ID `32`, `codex-audit-20261015-tag-live`, module `thing7-agent-registry`. | `agenthubTags` contains the new name and module. Agent, Skill, and Tool each serialize the tag name in their own `tags` array. | **Create passed.** Tag has no other editable data to use for a non-identifier update. |
| Secret | Created ID `1`, key `codex-audit-20261015-secret`, module `thing7-agent-registry`; updated description through the UI. A synthetic dummy value was used only to check exclusion. | Secret metadata was written to top-level `secrets`. Updated description is present. No `value` property appears. Agent link appears in `agenthubAgents[].agentSecrets` as `{ "key", "envVarName" }`. | **Create and update passed for metadata.** Value exclusion and Agent relation passed. See the key mismatch below. |

### Exact JSON counts after the run

| JSON key | Before | After |
|---|---:|---:|
| `agenthubAgents` | 3 | 4 |
| `agenthubSkills` | 85 | 86 |
| `agenthubTools` | 4 | 5 |
| `agenthubTags` | 3 | 4 |
| `secrets` | 0 | 1 |
| `agenthubSecrets` | 0 | 0 |

All five new JSON entries use `moduleUserKey: "thing7-agent-registry"`. The final JSON parsed successfully. The test Secret's `value` was masked in the edit form and is absent from JSON. The Agent secret relation contains only the secret key and environment-variable name.

## Model field inventory

“UI → JSON” reports the live subscriber result for the test records. “Seeder” describes the current code path; no seeder was run in this live-data test because it would also upsert existing records in the module. Identifier names/keys are used to match rows and are not treated as renameable values.

### Agent

The live Agent editor exposes Basics, Persona, Skills, Tools, Policies, Secrets, Processes, Jobs, Sessions, and Embedding tabs. The model/data fields visible for editing are listed below. Processes, Jobs, Sessions, and Embedding are related-record or runtime views rather than scalar Agent fields.

| UI field | JSON key / UI → JSON result | Seeder behavior | Test |
|---|---|---|---|
| Name | `agenthubAgents[].name`; used as identity | Finds by name and retains the existing name | Created; no rename attempted |
| Title | `title` | Upserted | Create and update passed |
| Description | `description` | Upserted | Create passed |
| Icon | `iconName` | Upserted | Empty/default icon serialized |
| Module | `moduleUserKey` | Resolved by module user key | Create and update passed |
| Tags | `tags[]` by tag name | Resolves tags by name | Relation create/update passed |
| Input name, description, type, default, optional | `requiredInputs` (serialized JSON string) | Upserted from the JSON value | Create/update passed with one optional string input and default |
| Reasoning model provider/model/region | `reasoningModelKey` | Upserted | Create passed |
| Fast model provider/model/region | `fastModelKey` | Upserted | Create passed |
| System prompt | `systemPrompt` | Upserted | Create and update passed; final exact text verified |
| Lifecycle status | `status` | Upserted | Draft serialized |
| Step limit | `stepLimit` | Upserted | Default serialized |
| Turn step limit | `turnStepLimit` | Upserted | Default serialized |
| Cost limit | `costLimit` | Upserted and converted to number for JSON | Default serialized |
| Config version | Displayed by editor; not emitted as an Agent JSON property | If present in JSON, passed through the entity payload; not a UI → JSON field | Not a portable JSON field |
| Roles / role checkboxes | `agentRoles[]` | Resolved from role name / `roleMetadataUserKey`; relation metadata upserted | Not assigned during the test |
| Skills relation and “Always include” | `agentSkills[]: { name, alwaysInclude }` on the Agent JSON entry | Resolves Skill by name and updates relation flag | Create passed |
| Tools relation and “Require approval” | `agentTools[]: { name, requiresApproval }` on the Agent JSON entry | Resolves Tool by name and updates relation flag | Create passed |
| Secrets relation and environment-variable name | `agentSecrets[]: { key, envVarName }` on the Agent JSON entry | Resolves Secret by key and updates environment-variable name; value excluded | Create passed |

### Skill

The editor exposes General Info, Skill, and Agents tabs.

| UI field | JSON key / UI → JSON result | Seeder behavior | Test |
|---|---|---|---|
| Name | `agenthubSkills[].name`; used as identity | Finds by name and retains existing name | Created; no rename attempted |
| Icon | `iconName` | Upserted | Default/null serialized |
| Description | `description` | Upserted | Create and update passed |
| Type | `type` | Upserted | Create passed |
| Module | `moduleUserKey` | Resolved by module user key | Create passed |
| Tags | `tags[]` by tag name | Resolves each tag and sets the relation | Create/update passed |
| Skill body/instructions | `body` | Upserted | Create passed |
| Agents tab / Agent relation | Agent JSON `agentSkills[]` with `alwaysInclude` | Resolved from Agent entry into AgentSkill relation | Agent-side relation create passed |

### Tool

The editor exposes General Info, Tool, Agents, and Sessions tabs. Runtime status and load error are displayed as state; they are not editable general fields.

| UI field | JSON key / UI → JSON result | Seeder behavior | Test |
|---|---|---|---|
| Name | `agenthubTools[].name`; used as identity | Finds by name and retains existing name | Created; no rename attempted |
| Icon | `iconName` | Upserted | Default/null serialized |
| Description | `description` | Upserted | Create and update passed |
| Type | `type` | Upserted | Create passed |
| Module | `moduleUserKey` | Resolved by module user key | Create passed |
| Tags | `tags[]` by tag name | Resolves each tag and sets the relation | Create/update passed |
| Lifecycle status | `status` | Upserted | Inactive serialized; activation checks not run |
| Source code | `sourceCode` | Upserted; checksum is computed when omitted | Create passed |
| Checksum | `checksum` | Upserted or computed from source | Computed checksum serialized |
| Last load error / runtime state | Display-only; subscriber does not emit `lastLoadError` | A supplied JSON value can flow through the entity payload | No load error; no tool execution |
| Agents tab / Agent relation | Agent JSON `agentTools[]` with `requiresApproval` | Resolved from Agent entry into AgentTool relation | Agent-side relation create passed |

### Tag

The Tag form exposes Details, Skills, Tools, and Agents tabs. Details has required Name and Module fields.

| UI field | JSON key / UI → JSON result | Seeder behavior | Test |
|---|---|---|---|
| Name | `agenthubTags[].name`; used as identity | Creates if absent; does not rename/update existing Tag data | Create passed; no rename attempted |
| Module | `moduleUserKey` | Resolves module on create; existing Tag module assignment is only filled when missing | Create passed |
| Skills, Tools, Agents tabs | Inverse relation views; Tag subscriber does not write these lists | Tag seeder does not resolve inverse lists | Not tested through Tag tabs; forward tag relations on Agent/Skill/Tool were tested |

The portable relation representation is on each Agent, Skill, or Tool under `tags[]`. A change made only through a Tag inverse tab is not represented by the Tag JSON entry.

### Secret

The Secret form exposes Basic Info and Usage. Basic Info has Key, Display Name, Description, Value, Value Type, Status, and required Module. Usage shows Last Rotated At and Last Accessed At. The Value is masked when editing. `redact` is present in the metadata form seed but was not a rendered UI field in this run.

| UI field | JSON key / UI → JSON result | Seeder behavior | Test |
|---|---|---|---|
| Key | Expected `agenthubSecrets[].key`; current subscriber writes `secrets[].key`; used as identity | Current seeder reads `secrets[]`, matches by key, creates when missing | Create and update key-path behavior observed; no key rename |
| Display Name | `displayName` in current `secrets[]` entry | Upserted | Create passed |
| Description | `description` in current `secrets[]` entry | Upserted | Create and update passed |
| Value | Never written to JSON | New row starts with empty value; update preserves current DB value and ignores JSON value | Dummy test value absent from JSON; UI masked it on edit |
| Value Type | `valueType` in current `secrets[]` entry | Upserted | Create passed |
| Status | `status` in current `secrets[]` entry | Upserted | Create passed |
| Last Rotated At | `lastRotatedAt` in current `secrets[]` entry | Upserted | UI-generated value serialized |
| Last Accessed At | `lastAccessedAt` in current `secrets[]` entry | Upserted | `null` serialized |
| Module | `moduleUserKey` | Resolved by module user key | Create passed |
| `redact` | Not rendered in the live form | Upserted if present in JSON | Not UI-editable/tested |

## Seeder and sync behavior from code

- `seedSecrets` is a separate step before `seedAgentHubRegistries`. It currently reads top-level `secrets`, matches by key, creates new Secrets with an empty `value`, and preserves the DB value on updates.
- AgentHub registry seed order is Tags → Skills → Tools → Agents. Agent role and Agent-Secret relations are seeded after Agent rows.
- Agent, Skill, and Tool updates match by name and retain the existing name while upserting other fields. Their tag relations resolve by tag name. Secret updates match by key and retain its value. Tag is matched by name and is not updated beyond the module assignment behavior described above.
- The Agent JSON relation fields are `agentSkills`, `agentTools`, `agentSecrets`, and `agentRoles`. Secret values are excluded from both standalone Secret JSON serialization and Agent-Secret relations.
- This run did not execute the module seeder: it upserts every matching record in the JSON, and the test constraint was to leave existing data untouched. Seeder behavior above is from code inspection, not a live re-seed result.
- Delete synchronization was outside this test. No record was deleted.

## Findings and limits

1. **The Module dropdown is present.** It is present in the loaded Agent, Skill, Tool, Tag, and Secret forms. The Secret Module field appears below Status; the form may first render in a loading state, so its initial accessibility snapshot can omit the field. All new records in this run were assigned to `thing7-agent-registry` through the UI dropdown.
2. **Secret key mismatch remains.** The requested portable key is `agenthubSecrets`; the live subscriber/seeder currently use `secrets`. The test JSON has one entry in `secrets` and an empty/absent `agenthubSecrets` array. UI create/update and value exclusion work through the current key, but the requested key name is not satisfied.
3. **Database and JSON are not necessarily exact mirrors.** The prior test Tag row ID 31 remains in the DB but is absent from JSON in this run. It was not edited. Current JSON has the new Tag created in this run and the original three Tags.
4. **Seed round-trip was not executed.** Running the full module seeder could update existing DB rows, so this live test verifies UI → JSON and relation serialization only. Seeder field mapping/order was checked in code.
5. **Not exercised:** Agent role assignment; update of Tag identity/module; Tag inverse-tab edits; Tool activation or execution; deletion behavior. No existing records were changed, and no Secret value was exposed in JSON.

## Automated checks already recorded

| Check | Result |
|---|---|
| `agent-registry-subscribers.spec.ts` (Jest alias mapping) | Passed |
| `module-metadata-agenthub.spec.ts` (Jest alias mapping) | Failed in the existing test mock: its AgentRegistry repository stub lacks `save()` while the Agent update path calls `repo.save()` |
| `npx tsc --noEmit --pretty false` | Passed |
| Metadata JSON parse and targeted record/count inspection | Passed |

