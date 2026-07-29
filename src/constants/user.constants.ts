/**
 * The columns of a `User` that are safe to embed in another entity's API response.
 *
 * Whenever a user is attached to a record the caller asked for - a `createdBy` /
 * `updatedBy` populate, a chatter message author - the caller wants to display who it
 * was, not to read their profile. Everything else on `User` is PII (email, mobile),
 * authz metadata (roles, apiKeys) or secret, and the embedded user is frequently
 * someone the viewer has no other visibility of.
 *
 * `fullName` is nullable; consumers that need a fallback should use the record's own
 * context rather than widening this list.
 */
export const USER_SUMMARY_FIELDS = ['id', 'fullName'] as const;
