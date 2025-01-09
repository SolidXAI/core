
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
   * The subject's (user) roles.
   * These are part of the JWT token, we simply decode them.
   */
  roles: string[];

  /**
   * The subject's (user) permissions.
   * These are not part of the JWT token, we query them from the database each time the access-token guard is run. 
   * So basically each time an authenticated request is initiated, we end up loading all the users permissions.
   */
  permissions: string[];
}
