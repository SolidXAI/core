# AgentHub runtime and verification

Use this when choosing links, activating tools, diagnosing access, or testing a configured agent. Implementation: `agent-hub-runtime/src/agenthub/` plus Core's `src/services/agent-tool-registry.service.ts` and `src/services/agent-hub-process-manager.service.ts`.

## What the runtime actually loads

`config/source_db.py` reads an active, nondeleted `AgentRegistry` row and builds `AgentSpec`. It reads linked skills, linked roles, and linked tools whose catalog status is `active` or `load_failed`. A `load_failed` tool is retried when a new process loads; an `inactive` tool is omitted. Secret links are read separately by the manager when it spawns a worker. The manager resolves secret values and injects them under each link's `envVarName`; it rejects invalid or reserved names. Do not confuse a tool's declared `required_secrets` with an agent's `AgentSecret` link: custom tool lifecycle checks verify active SolidX secrets, while process links determine which values the worker receives.

The manager admits callers by intersection of their SolidX role IDs and the agent's `AgentRole` IDs (`identity.authorized`). An agent with no role links does not grant ordinary users access. AgentHub administrator checks are separate. A tool's `requiresApproval` causes a pending human approval request before execution. The agent's system prompt cannot override either control.

`skills/__init__.py` places every linked skill name and description in the prompt; bodies with `alwaysInclude=true` are also inserted. `load_skill` can fetch another linked body on demand **only if the `load_skill` tool is linked and loaded**. Tags are exposed in the skill index but are not a retrieval or authorization mechanism.

The runtime appends its own prompt for widget choice and JSON reply envelope. It enforces `stepLimit`, `turnStepLimit`, and `costLimit` in the loop. The fast model supports auxiliary tasks; both selected models should resolve. Required inputs are validated by type at session start. Interactive tests pass them through the embedded chat; jobs accept them in the job payload.

## Tool lifecycle

`AgentToolRegistry.sourceCode` must contain one matching `@tool(name=...)` declaration with a Pydantic argument model and `(args, ctx) -> ToolResponse` behavior. The source is checksum verified. Custom and third-party source passes the import guard; SolidX built-ins are bundled and seeded by the manager. Custom/third-party activation also requires exactly one `@tool_config` and one `@tool_init` hook: the first declares required secret names, the second performs a bounded, non-destructive functional check. The UI saves these tools inactive, runs `config` and `init` checks against the saved checksum, then activates only after both pass. Source/name/type changes reset them to inactive. A linked tool can still fail at process load; inspect `lastLoadError` and the process `loadReport`.

Current built-ins are listed in `agent-hub-runtime/src/agenthub/builtin_catalog.json`; examples include `load_skill`, `request_human_input`, `web_search`, `filesystem`, `bash`, and read-only PostgreSQL/MSSQL tools. Their availability still requires a link to the agent and any environment dependencies. Do not infer database write ability from a read-only query tool.

## Practical verification

1. Read back the agent and its links; confirm statuses, model keys, required-input JSON, role IDs, secret environment names, and tool catalog state.
2. Activate the agent and use **Test Agent** in the Solid UI (embedded `agentHub` chat) as a user in an allowed role. Provide typed required inputs. Run a representative happy path and one important failure/approval path.
3. Inspect process readiness and `loadReport`; inspect session/event and human-request records when needed. A saved configuration or a successful tool check alone does not prove a working run.
4. After edits, compare process and agent `configVersion`. The manager uses a ready process with matching version or spawns a fresh one for new sessions; existing sessions may remain on their current process. The UI also offers process restart. Retest with a fresh session when validating changed instructions or tools.

For API jobs, `AgentJob` and `AgentSession` hold execution state; `AgentEvent` is the detailed trace and `AgentHumanRequest` holds pending input/approval. Treat these as diagnostics and audit data, not definition fields.
