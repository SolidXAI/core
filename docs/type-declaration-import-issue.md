# Issue: Consumer sees `Property 'id' does not exist on type 'VenueUser'`

## Summary
The published declaration files in `dist/` import internal types using `src/...` module specifiers. In a consuming project, TypeScript resolves those imports against the consumer's `src` path (or fails), which can cause `User` to extend a different `CommonEntity` that does not define `id`. This leads to `Property 'id' does not exist on type 'VenueUser'` even though `CommonEntity` in the library defines it.

## Evidence
- `dist/entities/user.entity.d.ts` starts with:
  - `import { CommonEntity } from "src/entities/common.entity";`
- `dist/entities/common.entity.d.ts` correctly contains:
  - `id: number;`

Because the import is `src/...`, the consumer may resolve it to their own `src` tree instead of the library's `dist` types.

## Root Cause
Library declarations are not portable because internal imports are using absolute `src/...` aliases. These aliases are not part of Node module resolution, so consumers resolve them differently.

## Fix Options
1. **Preferred:** Replace internal imports in `src/` with relative paths so emitted `.d.ts` files are portable.
2. **Alternative:** Keep `src/*` aliases but add a post-build step (e.g., `tsc-alias`) to rewrite `dist/**/*.d.ts` imports to relative paths.

## Next Steps
- Decide on option 1 or 2.
- Rebuild and verify `dist/**/*.d.ts` no longer import from `src/...`.
- Publish a new package version and ensure the consuming app resolves `User` and `CommonEntity` from the same package instance.
