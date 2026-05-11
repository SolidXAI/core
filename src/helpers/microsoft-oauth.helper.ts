export type MicrosoftAuthConfiguration = {
  clientID: string;
  clientSecret: string;
  tenant: string;
  callbackURL: string;
  redirectURL: string;
};

export const isMicrosoftOAuthConfigured = (
  config: MicrosoftAuthConfiguration,
): boolean => {
  return !!(
    config.clientID &&
    config.clientSecret &&
    config.tenant &&
    config.callbackURL &&
    config.redirectURL
  );
};
