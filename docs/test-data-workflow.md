# Test Data Workflow

This document describes the end-to-end workflow for creating isolated test databases, seeding metadata, loading test data, and tearing everything down.

## Overview
The workflow is designed to:
- Create one **test database per configured datasource** in the project.
- Point the app to those new databases via `.env` updates.
- Seed all metadata into the fresh databases.
- Load model-specific `testData` entries from module metadata JSON files.
- Cleanly reverse everything at the end.

The commands below are the canonical flow.

---

## Step 1: Create test datasources

Command:
```
npx @solidstarters/solidctl test-data --create-datasources
```

What this does:
- Reads all configured datasources from the Solid registry (`SolidRegistry.getSolidDatabaseModules()`), and uses their `name()` values.
- Generates a unique **run name** (two words, underscore-separated, e.g. `steady_wolf`).
- Builds a **timestamped database name** per datasource:
  - `<datasource>_<timestamp>_<runName>`
- Backs up the current `.env` into `.env.backup.<runName>`.
- Rewrites `.env` in-place with new `*_DATABASE_NAME` values.
- Creates the databases/schemas using TypeORM and the configured connection info.
- Writes a `.solidx-test-manifest` with the run name + database names so the teardown can reverse everything later.

Example output:
```
▶ Running solid test-data
Creating test datasource environment file and manifest.
Backed up .env to .env.backup.steady_wolf and applied new test datasource names to .env.
Creating test database/schema "default_20260201234402_steady_wolf" on datasource "default"...

============================================================
  TEST DATASOURCE ENVIRONMENT CREATED
------------------------------------------------------------
  Run name : steady_wolf
  Env backup : .env.backup.steady_wolf

  Test databases/schemas created:
- default: default_20260201234402_steady_wolf

  Next steps:
  1) Using updated .env with test datasource names
  2) Run solid seed as usual
  3) Proceed with loading the test data for each module
  4) Run the test cases 
  5) Tear down
============================================================

✔ solid test-data completed
```

Rationale:
- The `.env` rewrite guarantees the app connects to fresh databases without changing code.
- The manifest records the run so deletion is safe and deterministic.

---

## Step 2: Seed metadata into the new databases

Command:
```
npx @solidstarters/solidctl seed
```

What this does:
- Seeds full module metadata into the **fresh test databases**.
- Generates the `sa` user if needed and prints its password.
- Ensures all models, fields, roles, permissions, views, actions, etc. exist before loading test data.

Example output (truncated):
```
▶ Running solid seed
▶ Pruning disabled: existing metadata will be kept.
▶ No modulesToSeed provided. Seeding ALL modules.
▶ Seeding Metadata for Module: solid-core
✔ [solid-core] Module/Model/Fields seeded (upserted 376)
...
✔ Seeding completed.
✔ solid seed completed
```

Rationale:
- Test data relies on model metadata and relationships; this ensures the schema and reference data are ready.

---

## Step 3: Load test data

Command:
```
npx @solidstarters/solidctl test-data --load-data
```

What this does:
- Reads all module metadata files (or a subset if `--modules-to-test` is provided).
- Looks for `testData` arrays in each metadata file.
- Resolves the correct repository for each model (repository name pattern: `<ModelName>Repository`).
- Performs **upsert-style** inserts using the model’s `userKeyFieldUserKey`.
- Resolves many-to-one relations using `${fieldName}UserKey`.

Example output:
```
▶ Running solid test-data
Test data setup for all modules.
Processing test data for module: solid-core
✔ Test data setup complete for module: solid-core
Processing test data for module: venue
✔ Test data setup complete for module: venue
✔ solid test-data completed
```

Rationale:
- This keeps test fixtures human-readable and tied to module metadata.

---

## Step 4: Tear everything down

Command:
```
npx @solidstarters/solidctl test-data --delete-datasources
```

What this does:
- Restores `.env` from the latest `.env.backup.<runName>`.
- Deletes all `.env.backup.<runName>` files created by the workflow.
- Drops each test database/schema recorded in `.solidx-test-manifest`.
- Deletes the manifest file.

Example output:
```
▶ Running solid test-data
Deleting test datasource environment and databases.
Dropping test database/schema "default_20260201234402_steady_wolf" on datasource "default"...
✔ Test datasource env files and manifest deleted; test databases dropped.
✔ solid test-data completed
```

Rationale:
- Keeps the local environment clean and restores the original `.env` safely.

---

## Optional: Limit modules for test data load

You can restrict test data loading to a subset of modules:
```
npx @solidstarters/solidctl test-data --load-data --modules-to-test venue,reports
```

Only the listed modules are processed.
