// The versioning columns CommonEntity adds for draft/publish support. These don't exist on
// legacy tables (see LegacyCommonEntityWithExistingId) and don't carry over when a new draft
// version is copied from its source entity, so both of those call sites share this list rather
// than each hand-enumerating the same four names.
export const DRAFT_PUBLISH_VERSIONING_FIELD_NAMES = ['isPublished', 'isLatest', 'initialEntityVersionId', 'publishedTracker'] as const;
