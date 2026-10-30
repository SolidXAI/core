
export interface ActiveUserData {
  /**
   * The "subject" of the token. The value of this property is the user ID
   * that granted this token.
   */
  sub: number;

  /**
   * The subject's (user) username.
   */
  username: string;

  /**
   * The subject's (user) email.
   */
  email: string;

  /**
   * Logical login session identifier used to invalidate older sessions when
   * concurrent logins are disabled.
   */
  sessionId?: string;

  /**
   * Identifies which per-device refresh-token bucket this session belongs to.
   * Present only while concurrent logins are permitted; mutually exclusive with
   * sessionId, which exists only when they are not. Carried on the access token
   * so bearer-authenticated endpoints that need this session's refresh token
   * can find it.
   */
  deviceKey?: string;

  /**
   * The subject's (user) roles.
   * These are part of the JWT token, we simply decode them.
   */
  roles: string[];

  /**
   * Standard JWT "issued at", in whole seconds. Stamped automatically by
   * signAsync on every token - declared here only because it was never typed.
   * Compared against a revocation instant to decide whether this token predates
   * a logout.
   */
  iat?: number;

  /**
   * The subject's (user) permissions.
   * These are not part of the JWT token, we query them from the database each time the access-token guard is run. 
   * So basically each time an authenticated request is initiated, we end up loading all the users permissions.
   */
  permissions: string[];
}
