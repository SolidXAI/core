
export type GoogleAuthConfiguration = {
  clientID: String,
  clientSecret: String,
  callbackURL: String,
  redirectURL: String
}

export function isGoogleOAuthConfigured(googleOauthConfig: GoogleAuthConfiguration): boolean {

  return !!googleOauthConfig.clientID
    && !!googleOauthConfig.clientSecret && !!googleOauthConfig.callbackURL && !!googleOauthConfig.redirectURL;
}
