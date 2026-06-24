# Microsoft Active Directory OAuth Flow

This document explains how Microsoft Active Directory, also called Azure AD or Microsoft Entra ID, OAuth login works in Solid Core and Solid Core UI.

## Important Short Answer

On button click, frontend does not call the backend with `axios` or `fetch`.

Frontend only builds this URL:

```ts
const backendApiUrl = (
  env("NEXT_PUBLIC_BACKEND_API_URL") || env("API_URL")
).replace(/\/+$/, "");

const getOAuthConnectUrl = (provider: string) =>
  `${backendApiUrl}/api/iam/${provider}/connect`;
```

For Microsoft Active Directory, this becomes:

```text
http://localhost:3000/api/iam/microsoft-active-directory/connect
```

Then frontend does:

```ts
router.push(getOAuthConnectUrl("microsoft-active-directory"));
```

So frontend creates a URL and navigates the browser to that URL. Browser navigation itself makes the `GET /connect` request.

This is correct for OAuth because OAuth needs full browser redirects:

```text
Frontend page
-> Backend /connect
-> Microsoft login page
-> Backend /connect/callback
-> Frontend callback page
-> Backend /authenticate
```

## Why It Is Not A Normal API Call

Normal login with username/password can use an API call:

```text
frontend axios/fetch -> backend -> response JSON
```

OAuth login cannot work like that for the first step because the user must leave our app and open Microsoft login in the browser.

So the first step is navigation:

```text
browser location changes to backend /connect
```

After Microsoft login completes, the final token exchange uses an API call:

```text
frontend -> backend /authenticate?accessCode=...
```

## Files Involved

Backend files:

```text
src/controllers/microsoft-active-directory-authentication.controller.ts
src/passport-strategies/microsoft-active-directory-oauth.strategy.ts
src/helpers/microsoft-active-directory-oauth.helper.ts
src/services/user.service.ts
src/services/authentication.service.ts
src/services/settings/default-settings-provider.service.ts
```

Frontend files:

```text
src/components/common/SocialMediaLogin.tsx
src/routes/pages/auth/InitiateMicrosoftActiveDirectoryOauthPage.tsx
src/components/auth/MicrosoftActiveDirectoryAuthChecking.tsx
src/adapters/auth/signInWithOAuthAccessCode.ts
src/routes/solidRoutes.tsx
```

## Backend Endpoints

### 1. Start Microsoft Active Directory OAuth

```http
GET /api/iam/microsoft-active-directory/connect
```

Controller method:

```ts
@Public()
@UseGuards(MicrosoftActiveDirectoryOauthGuard)
@Get("connect")
async connect() {
  await this.validateConfiguration();
}
```

This endpoint starts OAuth. The guard runs before the method body.

The guard:

```ts
export class MicrosoftActiveDirectoryOauthGuard
  extends AuthGuard("microsoft-active-directory") {}
```

This tells Passport to use the strategy named:

```text
microsoft-active-directory
```

### 2. Microsoft Callback

```http
GET /api/iam/microsoft-active-directory/connect/callback
```

Controller method:

```ts
@Public()
@Get("connect/callback")
@UseGuards(MicrosoftActiveDirectoryOauthGuard)
async microsoftActiveDirectoryAuthCallback(@Req() req, @Res() res) {
  const config = await this.validateConfiguration();
  const user = req.user;

  return res.redirect(
    this.buildFrontendRedirectUrl(config.redirectURL, user["accessCode"]),
  );
}
```

Microsoft redirects to this endpoint after successful login.

This route also uses `MicrosoftActiveDirectoryOauthGuard`, but now Microsoft sends a `code` in the URL. Passport uses that code to get an access token and profile from Microsoft.

### 3. Authenticate With accessCode

```http
GET /api/iam/microsoft-active-directory/authenticate?accessCode=<accessCode>
```

Controller method:

```ts
@Public()
@Get("authenticate")
async microsoftActiveDirectoryAuth(@Query("accessCode") accessCode: string) {
  await this.validateConfiguration();
  return this.authService.signInUsingMicrosoftActiveDirectory(accessCode);
}
```

Frontend calls this after it receives `accessCode` from the callback redirect.

This returns application JWT tokens.

## Complete Request Flow

### Step 1: User Clicks Button

Frontend file:

```text
src/components/common/SocialMediaLogin.tsx
```

Click handler:

```ts
onClick={() => router.push(getOAuthConnectUrl("microsoft-active-directory"))}
```

This creates:

```text
http://localhost:3000/api/iam/microsoft-active-directory/connect
```

Then browser opens that URL.

Note: yahan frontend direct API call nahi kar raha. Sirf URL bana kar browser ko us URL par bhej raha hai.

### Step 2: Backend /connect Runs Guard

Backend route:

```http
GET /api/iam/microsoft-active-directory/connect
```

Before `connect()` runs, Nest runs:

```ts
MicrosoftActiveDirectoryOauthGuard
```

Guard calls Passport strategy:

```ts
AuthGuard("microsoft-active-directory")
```

Strategy config:

```ts
super({
  clientID,
  clientSecret,
  callbackURL,
  tenant,
  scope: MICROSOFT_ACTIVE_DIRECTORY_OAUTH_SCOPES,
  addUPNAsEmail: true,
});
```

Passport redirects the browser to Microsoft login page.

### Step 3: Microsoft Login Page Opens

Browser leaves our app and opens Microsoft login.

Microsoft receives values like:

```text
client_id
redirect_uri
scope
tenant
response_type=code
```

The `redirect_uri` comes from:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL
```

Example:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL=http://localhost:3000/api/iam/microsoft-active-directory/connect/callback
```

This exact URL must be registered in Azure App Registration.

### Step 4: Microsoft Redirects Back To Backend

After successful Microsoft login, Microsoft redirects browser to:

```text
http://localhost:3000/api/iam/microsoft-active-directory/connect/callback?code=...
```

This is the callback route.

### Step 5: Guard Runs Again On Callback

The callback route also has:

```ts
@UseGuards(MicrosoftActiveDirectoryOauthGuard)
```

Now the guard sees Microsoft `code`.

Passport exchanges that `code` with Microsoft and gets:

```text
access token
profile
```

Then Passport calls the strategy `validate()` method.

### Step 6: Strategy validate() Creates accessCode

Backend file:

```text
src/passport-strategies/microsoft-active-directory-oauth.strategy.ts
```

Method:

```ts
async validate(_accessToken, _refreshToken, profile, done) {
  const loginAccessCode = uuid();

  const user = {
    provider: "microsoftActiveDirectory",
    providerId,
    email,
    name,
    picture,
    accessCode: loginAccessCode,
  };

  await this.userService.resolveUserOnOauthMicrosoftActiveDirectory({
    ...user,
    accessToken: _accessToken,
    refreshToken: null,
  });

  done(null, user);
}
```

This method creates a temporary `accessCode`. This is not the JWT. It is only a one-time code used by frontend to complete login.

### Step 7: User Is Created Or Updated

Backend file:

```text
src/services/user.service.ts
```

Method:

```ts
resolveUserOnOauthMicrosoftActiveDirectory()
```

It checks user by email:

```text
if user does not exist:
  create user
  save Microsoft Active Directory id/token/profile picture
  save accessCode
  initialize default role

if user exists:
  update Microsoft Active Directory id/token/profile picture
  update accessCode
```

Important fields saved:

```text
accessCode
microsoftActiveDirectoryId
microsoftActiveDirectoryAccessToken
microsoftActiveDirectoryProfilePicture
lastLoginProvider
```

### Step 8: Backend Redirects To Frontend

After strategy validation, callback controller gets `req.user`.

Then it redirects to frontend:

```ts
this.buildFrontendRedirectUrl(config.redirectURL, user["accessCode"])
```

`config.redirectURL` comes from:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL
```

Example:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL=http://localhost:3001/auth/initiate-microsoft-active-directory-oauth
```

Final redirect URL becomes:

```text
http://localhost:3001/auth/initiate-microsoft-active-directory-oauth?accessCode=<uuid>
```

This URL is frontend, not backend.

### Step 9: Frontend Reads accessCode

Frontend route:

```text
/auth/initiate-microsoft-active-directory-oauth
```

Frontend file:

```text
src/routes/pages/auth/InitiateMicrosoftActiveDirectoryOauthPage.tsx
```

It renders:

```ts
<MicrosoftActiveDirectoryAuthChecking />
```

That component reads:

```ts
const accessCode = searchParams.get("accessCode");
```

### Step 10: Frontend Calls Backend /authenticate

Frontend file:

```text
src/adapters/auth/signInWithOAuthAccessCode.ts
```

It calls:

```ts
solidGet(
  `${apiUrl}/api/iam/${provider}/authenticate?accessCode=${encodeURIComponent(accessCode)}`
)
```

For Microsoft Active Directory:

```text
GET /api/iam/microsoft-active-directory/authenticate?accessCode=<uuid>
```

This is the real frontend API call.

### Step 11: Backend Validates accessCode And Returns JWT

Backend file:

```text
src/services/authentication.service.ts
```

Method:

```ts
signInUsingMicrosoftActiveDirectory(accessCode)
```

It does:

```text
1. Find user by accessCode
2. Check account is not blocked
3. Validate saved Microsoft access token using Microsoft Graph /me
4. Verify Microsoft profile id/email matches the saved user
5. Generate application JWT accessToken and refreshToken
6. Return user and tokens
```

After frontend receives tokens, it stores session the same way as existing OAuth login.

## callbackURL vs redirectURL

These two are different and both are required.

### callbackURL

Used by Microsoft to come back to backend:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL=http://localhost:3000/api/iam/microsoft-active-directory/connect/callback
```

This must be registered in Azure App Registration.

### redirectURL

Used by backend to send the user back to frontend:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL=http://localhost:3001/auth/initiate-microsoft-active-directory-oauth
```

This does not go in Azure redirect URI list unless your Azure app directly redirects to frontend, which this backend flow does not do.

## Required Environment Variables

Backend:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CLIENT_ID=<azure-client-id>
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CLIENT_SECRET=<azure-client-secret>
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_TENANT_ID=<tenant-id-or-common>
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL=http://localhost:3000/api/iam/microsoft-active-directory/connect/callback
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL=http://localhost:3001/auth/initiate-microsoft-active-directory-oauth
```

Frontend:

```env
VITE_BACKEND_API_URL=http://localhost:3000
VITE_API_URL=http://localhost:3000
VITE_BASE_URL=http://localhost:3001
```

## Azure App Registration Setup

In Azure Portal:

```text
Microsoft Entra ID
-> App registrations
-> Your app
-> Authentication
-> Add platform
-> Web
-> Redirect URIs
```

Add exactly:

```text
http://localhost:3000/api/iam/microsoft-active-directory/connect/callback
```

The value must exactly match `IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL`.

Exact means same:

```text
protocol: http vs https
host: localhost
port: 3000
path: /api/iam/microsoft-active-directory/connect/callback
trailing slash: no extra slash
```

## Common Mistakes

### redirect_uri is not valid

Reason:

```text
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL does not match Azure redirect URI.
```

Fix:

```text
Register the exact callback URL in Azure.
```

### Using frontend URL as callbackURL

Wrong:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL=http://localhost:3001/auth/initiate-microsoft-active-directory-oauth
```

Correct:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CALLBACK_URL=http://localhost:3000/api/iam/microsoft-active-directory/connect/callback
```

### Using backend API URL as redirectURL

Wrong:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL=http://localhost:3000/api/auth/initiate-microsoft-active-directory-oauth
```

Correct:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_REDIRECT_URL=http://localhost:3001/auth/initiate-microsoft-active-directory-oauth
```

### Empty client id crashes strategy

Wrong:

```env
IAM_MICROSOFT_ACTIVE_DIRECTORY_OAUTH_CLIENT_ID=
```

If OAuth is not configured, leave it absent or let the strategy use dummy startup values. If OAuth should work, set the real Azure client id.

## Final Flow Summary

```text
1. User clicks Microsoft Active Directory button
2. Frontend builds backend /connect URL
3. Frontend navigates browser to backend /connect
4. Backend Passport guard redirects browser to Microsoft
5. User logs in on Microsoft
6. Microsoft redirects browser to backend /connect/callback with code
7. Backend exchanges code for Microsoft token/profile
8. Backend creates/updates user and stores temporary accessCode
9. Backend redirects browser to frontend redirectURL with accessCode
10. Frontend reads accessCode
11. Frontend calls backend /authenticate?accessCode=...
12. Backend verifies user/token and returns application JWT
13. Frontend stores JWT session
```

