# AgentHub configuration data model

Use this when creating or reviewing records. Recheck `solid-core-module/src/entities/agent-*.entity.ts`, create/update DTOs, and `src/seeders/seed-data/solid-core-metadata.json` before relying on a field in a changed checkout.

## Definition and associations

| Model / table | Configuration meaning | Important fields |
| --- | --- | --- |
| `AgentRegistry` / `ss_agent_registry` | One runnable agent definition | unique `name`, `title`, `description`, `iconName`, `systemPrompt`, `requiredInputs`, `reasoningModelKey`, `fastModelKey`, `status`, `stepLimit`, `turnStepLimit`, `costLimit`, `configVersion` |
| `AgentSkillRegistry` / `ss_agent_skill_registry` | Shared Markdown skill catalog | unique `name`, `type`, `description`, `body`, tags |
| `AgentToolRegistry` / `ss_agent_tool_registry` | Shared Python tool catalog | unique `name`, `type`, `description`, `sourceCode`, `checksum`, `status`, `lastLoadError`, tags |
| `AgentSkill` / `ss_agent_skill` | Agent-to-skill link | required agent and catalog relations; `alwaysInclude` (default true) |
| `AgentTool` / `ss_agent_tool` | Agent-to-tool link | required agent and catalog relations; `requiresApproval` (default false) |
| `AgentRole` / `ss_agent_role` | Agent-to-`RoleMetadata` link | allowed caller role |
| `AgentSecret` / `ss_agent_secret` | Agent-to-`Secret` link | `envVarName` in worker environment |
| `AgentHubTag` / `ss_agent_hub_tag` | Discovery label on agents, skill catalog, tool catalog | unique `name` |

`AgentProcess`, `AgentSession`, `AgentJob`, `AgentEvent`, `AgentSessionCheckpoint`, and `AgentHumanRequest` are runtime/observability records. They are not resources to precreate as part of an agent definition. `AgentRegistry` exposes one-to-many relations to several of them because the generic CRUD metadata represents all entity relations; do not fill runtime collections when creating an agent. The current implementation has no separate AgentHub knowledge-base, policy, or output-schema entity. Those ideas appear in older vision notes, but should not be promised as live configuration fields.

## Exact contracts that affect decisions

- `status` is a string at the entity/DTO layer. The editor presents `draft`, `active`, `disabled`; the DB runtime loads only `active` agents. Start in `draft`, validate, then activate.
- `requiredInputs` is stored as a JSON **string**. Core normalizes an array of `{name, description, dataType}` (and accepts historical name-keyed objects and `variableName`/`type` aliases). Types are `string`, `number`, `integer`, `boolean`, `date`, `datetime`, `object`, `array`; names must be nonempty, case-insensitively unique, and cannot be `__proto__`, `constructor`, or `prototype`. See `src/helpers/agent-required-inputs.ts` and runtime `src/agenthub/inputs.py`.
- Both model keys use `<provider-id>:<provider-model-id>`, resolved from the SolidX AI setting `solidXGenAiCodeBuilderConfig` by the runtime. The editor lists enabled provider/model pairs. A syntactically plausible key without configured credentials can leave the runtime model unavailable.
- `configVersion` is set to 1 on registry create and bumped on registry edits and linked skill/tool/role/secret edits. Changes to a shared skill/tool catalog bump linked agents. Treat version as a process freshness signal, not a user-controlled version field. See `src/services/agent-config-version.service.ts`.
- `type='solidx'` skill/tool catalog rows are runtime-seeded and Core blocks their update/delete. Use a new `custom` or `thirdparty` entry for domain-specific resources; do not overwrite a built-in.
- Catalog `name` is globally unique. Link rows also have computed unique keys for each agent/resource pair in seeded metadata; avoid duplicate links.
- Delete behavior: definition links cascade with deleted agent/catalog records; process/session/job references to an agent may be set null. Deleting a definition is not a safe way to clear runtime history.

## Where configuration is edited

The Solid UI custom editors are `solid-core-ui/src/routes/pages/admin/core/AgentRegistryEditorPage.tsx`, `AgentSkillRegistryEditorPage.tsx`, and `AgentToolRegistryEditorPage.tsx`. The agent editor has Basics, Persona, Skills, Tools, Policies, Secrets, Processes, Sessions, and test/embedding affordances. It saves the agent scalar record first and then synchronizes link rows through the entity APIs. Check the saved result for partial link failures. Core controllers expose corresponding CRUD routes under `agent-registry`, `agent-skill-registry`, `agent-tool-registry`, `agent-skill`, `agent-tool`, `agent-role`, and `agent-secret`; tool checks use `agent-tool-registry/:id/check`.

The consuming `agent-hub-core` project currently wires the shared Core API/UI packages. Most behavior lives in `solid-core-module`, `solid-core-ui`, and the separate `agent-hub-runtime` repository. Read deployed package versions before assuming local source changes are present in the running app.
