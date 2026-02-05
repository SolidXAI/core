# Seeding Enhancements Summary

## Overview
This document summarizes the changes made to seeding behavior in `solid-core`:
- Metadata pruning support across targets.
- CLI flags for selective modules and pruning.

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

## CLI Changes
### Modules to Seed
`--conf` was removed. Use:
```
--modules-to-seed venue,reports
```
This passes `modulesToSeed` to the seeder as an array.

## Sample Commands
### Default seeding
```
npx @solidx/solidctl seed
```

### Select modules only
```
npx @solidx/solidctl seed --modules-to-seed venue,reports
```

### Pruning enabled
```
npx @solidx/solidctl seed --modules-to-seed venue --prune
```

### Pruning enabled (all modules)
```
npx @solidx/solidctl seed --prune
```

## Files Touched (Key)
- `src/seeders/module-metadata-seeder.service.ts`
- `src/commands/seed.command.ts`
- `src/repository/solid-base.repository.ts` (added `findOneByUserKey`)
