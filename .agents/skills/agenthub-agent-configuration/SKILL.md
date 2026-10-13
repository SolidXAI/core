---
name: agenthub-agent-configuration
description: Design, configure, and review bespoke domain agents in SolidX AgentHub using AgentRegistry, linked skill/tool catalogs, roles, secrets, and runtime validation. Use for AgentHub agent setup in solid-core-module, solid-core-ui, and consuming projects; not for standalone Codex skills or the separate SolidX agent runtime.
---

# Configure a SolidX AgentHub agent

Treat an AgentHub agent as a **configured, runnable `AgentRegistry` row** whose behavior comes from its system prompt, linked skills, linked tools, model selections, access roles, required inputs, and limits. The registry and link tables are the source of truth. A Markdown skill in this repository is guidance for the builder; an `AgentSkillRegistry.body` is guidance loaded by a *running AgentHub agent*. Do not confuse them.

Before editing a real agent, read [references/data-model.md](references/data-model.md). For execution, activation, and verification, read [references/runtime.md](references/runtime.md). The references name the implementation files to recheck when code has changed.

## Work with the human

Translate the domain request into a small configuration brief:

- **Job and boundary:** who will invoke it, what outcome it owns, what it must escalate, and what evidence it must cite or return.
- **Inputs:** initial facts the caller must supply, with names, descriptions, and data types. Keep optional conversational context out of `requiredInputs`.
- **Knowledge and actions:** reusable instructions belong in skills; executable capabilities belong in tools. Identify the exact data source or API behind any requested capability. A tag only aids discovery; it does not grant a capability.
- **Authority:** select caller roles, per-tool approval gates, and only the secrets actually needed. A system prompt is behavioral guidance, not an access control boundary.
- **Operation:** choose enabled reasoning and fast models, initial step/cost budgets, and a few representative success and failure scenarios.

Ask only for genuinely missing domain decisions. When live workspace access is available, inspect existing agents, catalog entries, roles, settings, and secrets before proposing duplicates or identifiers. Do not invent IDs, provider keys, secret names, working integrations, or runtime results.

## Configuration sequence

1. Reuse suitable catalog skills and tools; create `custom` or `thirdparty` catalog rows only when necessary. Keep a skill focused on a repeatable method and a tool focused on one callable operation. A tool needs Python source conforming to the AgentHub SDK; a URL, model instruction, or tag alone is not executable.
2. Draft `AgentRegistry`: stable unique `name`, human `title` and `description`, specific `systemPrompt`, JSON `requiredInputs`, configured `reasoningModelKey` and `fastModelKey`, positive `stepLimit` and `turnStepLimit`, nonnegative `costLimit`, and initially `draft` status. Use the current UI/API contract for field names and payload shape.
3. Create separate `AgentSkill`, `AgentTool`, `AgentRole`, and `AgentSecret` links. Set `alwaysInclude`, `requiresApproval`, and `envVarName` on the links. A catalog row without a link is unavailable to that agent. Avoid broad roles, unnecessary secrets, and action tools with approval off unless the domain case justifies them.
4. For custom or third-party tools, save the source, run configuration and initialization checks, then activate. Resolve required secrets and load errors. The source checksum and status matter; linking an inactive tool is insufficient.
5. Save and inspect all links, then activate the agent. The editor saves the registry and links in separate calls, so a partial save can leave missing associations. Test through the embedded AgentHub chat as an allowed user, with realistic `requiredInputs`; exercise success, missing/invalid input, denied access, tool failure, and approval paths relevant to the agent. Inspect process load reports, sessions, and events when a run disagrees with the design. Report observed behavior separately from configuration intent.
6. After changing the agent or a linked catalog item, check `configVersion` and process freshness. Restart or allow a new process where needed, then retest the updated configuration. Do not infer that an already running session adopted new instructions.

## Prompt and resource design

Write the `systemPrompt` as a concise contract: role, supported tasks, decision rules, evidence standard, tool-use criteria, escalation conditions, and completion criteria. Put long reusable domain procedures in linked skills. `alwaysInclude=true` injects the full skill body into the initial prompt; `false` leaves it indexed for on-demand loading through a linked `load_skill` tool. If on-demand skills are desired, ensure `load_skill` is linked and test retrieval. Do not duplicate the runtime's mandatory widget/JSON response instructions in the persona prompt.

Describe each tool in operational terms: what it reads or changes, arguments, expected result, required credentials, and whether a human must approve calls. For tools that mutate external state, explicitly define when the agent should ask for approval or stop. Link `AgentSecret` to an existing SolidX `Secret` with a valid, unique environment variable name; never place credential values in a prompt, skill body, or tool source.

## Handoff

Leave the human with a configuration map: registry fields; linked skills/tools and their link settings; roles; secret *names* and environment bindings; model keys; status; and tests performed. Mark any unverified runtime dependency or missing integration explicitly. If asked only to design, provide this map without creating or activating live records.
