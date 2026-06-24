export type MicrosoftActiveDirectoryAuthConfiguration = {
  clientID: string;
  clientSecret: string;
  tenant: string;
  callbackURL: string;
  redirectURL: string;
};

export const DEFAULT_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT = "common";
export const MICROSOFT_ACTIVE_DIRECTORY_OAUTH_SCOPES = [
  "openid",
  "profile",
  "email",
  "User.Read",
];

type MicrosoftActiveDirectoryOauthProfileValue = {
  value?: string;
};

export type MicrosoftActiveDirectoryOauthProfile = {
  id?: string;
  displayName?: string;
  emails?: MicrosoftActiveDirectoryOauthProfileValue[];
  photos?: MicrosoftActiveDirectoryOauthProfileValue[];
  _json?: {
    id?: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
    email?: string;
    preferred_username?: string;
    picture?: string;
  };
};

export const isMicrosoftActiveDirectoryOAuthConfigured = (
  config: MicrosoftActiveDirectoryAuthConfiguration,
): boolean => {
  return !!(
    config.clientID &&
    config.clientSecret &&
    config.tenant &&
    config.callbackURL &&
    config.redirectURL
  );
};

export const getMicrosoftActiveDirectoryOAuthProfileId = (
  profile: MicrosoftActiveDirectoryOauthProfile,
): string | null => {
  return profile.id || profile._json?.id || null;
};

export const getMicrosoftActiveDirectoryOAuthEmail = (
  profile: MicrosoftActiveDirectoryOauthProfile,
): string | null => {
  const email =
    profile.emails?.find((item) => !!item.value)?.value ||
    profile._json?.mail ||
    profile._json?.userPrincipalName ||
    profile._json?.email ||
    profile._json?.preferred_username ||
    null;

  return email?.trim().toLowerCase() || null;
};

export const getMicrosoftActiveDirectoryOAuthDisplayName = (
  profile: MicrosoftActiveDirectoryOauthProfile,
): string | null => {
  return profile.displayName || profile._json?.displayName || null;
};

export const getMicrosoftActiveDirectoryOAuthPicture = (
  profile: MicrosoftActiveDirectoryOauthProfile,
): string | null => {
  return (
    profile.photos?.find((item) => !!item.value)?.value ||
    profile._json?.picture ||
    null
  );
};
