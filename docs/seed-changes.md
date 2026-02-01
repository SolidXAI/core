# Seeding Enhancements Summary

## Overview
This document summarizes the changes made to seeding behavior in `solid-core`:
- Metadata pruning support across targets.
- Interactive pruning choice for normal seeding.
- Test data setup/teardown workflow.
- New `testData` section in module metadata.
- CLI flags for selective modules and test data flows.

## Pruning Support
Pruning is now available for most metadata targets. When enabled, records present in the DB but missing from JSON are removed. This is done in two phases:
1. Identify records in DB not present in JSON.
2. Delete those records before normal upsert seeding.

### Targets with Pruning
- Module models + fields (with model-level pruning).
- Views, actions, menus (with join cleanup).
- Security rules, list of values, dashboards.
- Scheduled jobs, saved filters, model sequences.
- Permissions (also clears role-permission join table).

### Targets WITHOUT Pruning (conservative)
- Module metadata itself
- Media storage providers
- Roles
- Users
- Email templates
- SMS templates
- System fields (global)
- Default settings (global)

### Pruning Mode
Pruning runs **only** when `--prune` is provided. If omitted, pruning is skipped.
Pruning is also skipped during test data setup/teardown.

## Test Data Workflow
Test data is now isolated from normal seeding and lives under `testData` in module metadata JSON.

### Behavior
- Default `solidctl seed` ignores `testData`.
- `--test-data-setup` seeds only `testData` (no other metadata).
- `--test-data-teardown` deletes only `testData` (no other metadata).
- Both flags together are rejected.

### Dependency-Aware Teardown
Teardown deletes records in reverse dependency order based on `many-to-one` relations in `moduleMetadata.models`.
This prevents FK violations (child records deleted before parent records).

## New `testData` Section
Module metadata now supports:
```json
"testData": [
  {
    "modelUserKey": "cityMaster",
    "data": {
      "name": "Mumbai",
      "stateUserKey": "Maharashtra"
    }
  }
]
```

### Many-to-One Resolution
For each `many-to-one` field:
- Use `${fieldName}UserKey` in test data.
- Resolve the target using that model’s `userKeyFieldUserKey`.
- If resolution fails, seeding aborts (transaction rollback).

## CLI Changes
### Modules to Seed
`--conf` was removed. Use:
```
--modules-to-seed venue,reports
```
This passes `modulesToSeed` to the seeder as an array.

### Test Data Flags
```
--test-data-setup
--test-data-teardown
```

## Sample Commands
### Default seeding (with optional pruning prompt)
```
npx @solidstarters/solidctl seed
```

### Select modules only
```
npx @solidstarters/solidctl seed --modules-to-seed venue,reports
```

### Test data setup only
```
npx @solidstarters/solidctl seed --modules-to-seed venue --test-data-setup
```

### Test data teardown only (dependency-aware delete)
```
npx @solidstarters/solidctl seed --modules-to-seed venue --test-data-teardown
```

### Pruning enabled
```
npx @solidstarters/solidctl seed --modules-to-seed venue
```

### Pruning enabled (all modules)
```
npx @solidstarters/solidctl seed --prune
```

## Files Touched (Key)
- `src/seeders/module-metadata-seeder.service.ts`
- `src/commands/seed.command.ts`
- `src/repository/solid-base.repository.ts` (added `findOneByUserKey`)
- `.../module-metadata/venue/venue-metadata.json` (testData sample)
