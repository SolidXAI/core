export type FacebookAuthConfiguration = {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  redirectURL: string;
};

export const isFacebookOAuthConfigured = (
  config: FacebookAuthConfiguration,
): boolean => {
  return !!(
    config.clientID &&
    config.clientSecret &&
    config.callbackURL &&
    config.redirectURL
  );
};
