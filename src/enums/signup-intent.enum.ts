/**
 * Declares what kind of user a signup call is creating.
 *
 * The distinction is a domain one, not a mechanical one:
 *
 * - a base `User` is someone who administers the system - the seeded `sa`, users
 *   created from the admin console;
 * - an extension user is someone who *uses* the app - public signup, OTP
 *   registration, OAuth sign-in, and the extension model's own CRUD form.
 *
 * Each call site states which it means. Nothing inspects the request body to
 * decide, so the same payload posted to two endpoints cannot produce two
 * different kinds of user.
 */
export enum SignupIntent {
  /** Public self-registration: an anonymous visitor creating their own account. */
  SelfRegistration = 'self-registration',
  /** Explicit create of the extension model, via its generated CRUD form. */
  ExtensionModel = 'extension-model',
  /** Admin console and internal callers: a plain core user. */
  CoreUser = 'core-user',
}
