# Grouping & Aggregation Enhancements (Code Review Summary)

This document explains the recent changes to grouping/aggregation in the CRUD helper/service, why they were made, and how to use them (with examples on `PincodeMaster`).

## What Changed and Why
- **Dedicated grouping pipeline**: Grouping no longer reuses the record-level query (which had `SELECT entity.*`, pagination, and default order). A separate path builds clean group queries to avoid SQL errors and ensure correct counts.
- **Multiple group-by fields**: The one-field limit was removed. You can now group on multiple fields (including relations) in the requested order.
- **Relation-safe grouping**: Group-by fields can traverse many-to-one relations (e.g., `state.name`, `city.name`). The helper reuses existing joins (from filters) or adds the necessary joins and aliases.
- **Date granularity**: Grouping supports `day`, `week`, `month`, `year` granularities in a DB-aware way (Postgres, MySQL/MariaDB, SQL Server).
- **Aggregates**: Supports a core, DB-agnostic set: `count`, `count_distinct`, `sum`, `avg`, `min`, `max`. If `aggregates` is omitted, it defaults to `count(*)`.
- **Group sorting/pagination**: Sorting and pagination are applied to group rows (not entity rows). Record pagination is kept separate for non-grouped queries.
- **Ordered group names**: Group names follow the order of `groupBy` fields. Relation values and date/grouped values are included in sequence.
- **Formatted date group labels**: You can add an optional format specifier to a date groupBy field: `field:granularity:format`. Supported formats: `MMM`, `MMMM`, `YYYY`, `YYYY-MM`, `YYYY-MM-DD` (defaults to the raw value if omitted).
- **Count of groups**: Group counts are computed without pagination interference, so `meta.totalRecords` reflects total groups.
- **DTO update**: `BasicFilterDto` now includes optional `aggregates?: string[]`.

## Caveats
- `populateGroup` is **not** supported when grouping on relation fields (e.g., `state.name`, `city.name`). Use it for scalar group-by fields only; otherwise fetch group metadata and then retrieve records in a separate call with the group key.
- Sorting works for group keys without extra colons (e.g., `state.name`) and for aggregate aliases (e.g., `id_max`). For date bucket group keys with granularity/format (`createdAt:month:YYYY`), the sort parser treats the last segment as the order; results may vary by driver and may not sort as expected in all cases.

## Usage Examples (PincodeMaster)
Assume `PincodeMaster` has many-to-one `state` and `city` relations and a `createdAt` timestamp.

### 1) Group by State and City
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=state.name&groupBy[1]=city.name
```
Returns groups for every state/city combination with default `count(*)` aggregate.

### 2) Group by Relation + Filter on Relation
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=state.name&filters[state][name][$eq]=Maharashtra
```
Groups by state name but only for rows where state is Maharashtra.

### 3) Multiple Group Fields (Relation + Scalar)
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=state.name&groupBy[1]=city.name&groupBy[2]=pincode
```
Group names are ordered: state → city → pincode.

### 4) Group by Date with Granularity (Month)
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=createdAt:month
```
Groups by month (driver-aware), default group labels are raw date buckets.

### 5) Date Granularity with Formatting
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=createdAt:month:MMM
```
Group labels use short month names (Jan, Feb, …). For full names: `createdAt:month:MMMM`. Other formats: `YYYY`, `YYYY-MM`, `YYYY-MM-DD`.

### 6) Aggregates (Count Distinct)
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=state.name&aggregates[0]=pincode:count_distinct
```
Shows distinct pincodes per state.

### 7) Aggregates (Multiple)
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=state.name&groupBy[1]=city.name&aggregates[0]=id:count&aggregates[1]=id:count_distinct
```
Returns both total rows and distinct IDs per state/city group.

### 8) Date Granularity + Relations + Aggregates
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=createdAt:year&groupBy[1]=state.name&aggregates[0]=pincode:count_distinct
```
Distinct pincodes per state, per year.

### 9) Filters with Grouping (Many-to-One)
```
GET /api/pincode-master?offset=0&limit=200&groupBy[0]=state.name&groupBy[1]=city.name&filters[state][name][$eq]=Nagaland
```
Groups only rows where state.name = Nagaland.

### 10) Group Sorting and Pagination
- Sorting applies to the group rows. Example:
```
GET /api/pincode-master?offset=0&limit=50&groupBy[0]=state.name&sort[0]=state.name:ASC
```
- Pagination (`offset/limit`) limits the number of groups returned; total group count remains in `meta.totalRecords`.

## Notes and Behavior
- If `aggregates` is omitted, `COUNT(*)` is added automatically.
- Group names reflect `groupBy` order and apply formatting when specified.
- Group queries reuse joins from filters when possible; otherwise, they create necessary joins for relation paths.
- Non-grouped find behavior remains unchanged.
