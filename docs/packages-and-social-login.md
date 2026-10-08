# Packages and social login

Pending implementation; not verified or deployed.

## Packages
- Basic: USD20/month, 30 tokens each month (1 token per started caption minute).
- Basic Annual: USD144 paid yearly (USD12/month), 30 tokens refreshed on monthly boundaries. Unused tokens expire; annual grants refresh lazily on account access.
- Basic Loyalty (test): 30 tokens/month, USD20 then USD19 ... floor USD10. Only confirmed paid renewals advance the counter. Cancellation, switching plan, or a lapse longer than 24 hours resets it. The 24-hour renewal processing grace does not extend paid access.
- Existing legacy subscriptions are not silently converted or marked paid. An administrator must confirm payment for new paid access. Partner/free grants do not count as purchases.
- Checkout remains a non-charging package preview. No payment provider is connected. Admin activation records confirmed payments; renewals are not automatically charged. The account page exposes cancellation/reset.
- Affiliate links, attribution, rewards and activation require current paid access. New admin-created affiliate accounts stay inactive until a paid package is confirmed and the role is enabled.
- Voice generation/conversion requires paid access. Reserve available tokens while processing, decode the actual resulting audio server-side, charge ceil(seconds/90), return unused reservation. Insufficient balance for the generated result discards it and refunds the reservation. Failed generation refunds it. Administrator exemption remains. Audio cleaning remains unavailable for customers until its price is defined.

## OAuth setup
Do not use a Google API key. Use web OAuth Client ID and Client Secret in server environment variables listed in .env.example. Never put secrets into VITE variables or Git.

Set SOCIAL_AUTH_BASE_URL to the exact public origin (including www if used). Register each exact callback:
- /api/auth/social/google/callback
- /api/auth/social/facebook/callback
- /api/auth/social/linkedin/callback
- /api/auth/social/microsoft/callback
- /api/auth/social/twitter/callback

Local Google callback: http://127.0.0.1:5175/api/auth/social/google/callback. Other providers may require an HTTPS development origin; register separate production/local clients as needed.

Google: web OAuth client, consent screen and allowed testers/publishing.
Facebook: Facebook Login web application, app ID/secret, valid OAuth redirect URI and required review/live status.
LinkedIn: enable Sign In with LinkedIn using OpenID Connect product; openid/profile/email scopes.
Microsoft: web app registration supporting personal Microsoft accounts AND organizational accounts for the common endpoint; client secret VALUE, not its ID. Supports Outlook/Hotmail users.
X: confidential Web App with OAuth2 enabled, client ID/secret, PKCE and tweet.read/users.read access. No posting permission requested.
Instagram: not exposed as general consumer login. Meta's professional-account API is a separate integration; no misleading working button is added.

Existing account email matches never silently link identities. Log in normally and use Options to explicitly link another provider. Existing account approval rules still apply. Provider buttons remain disabled until server credentials exist.

Sources:
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
- https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
- https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login


## Edita setup: Facebook login (2026-10-08)

Meta setup progress (2026-10-08): created **Edita**, App ID `1093331956435688`,
under the account that also has Gumar. Saved the staging OAuth callback below,
website `https://staging.edita.ba/`, domain `edita.ba`, the existing Edita brand icon,
Utility & productivity category, and public privacy/deletion-instructions URLs
`https://www.edita.ba/privatnost` and `https://www.edita.ba/privatnost#cuvanje`.
Both `email` and `public_profile` are **Ready for testing** in Meta.
No business portfolio was selected: the only offered portfolio was unrelated
"Mau mau brlog". Business verification and App Review remain required for publication.
The account holder completed Meta password confirmation. Facebook credentials are
installed only in staging's private server environment, with the staging social origin
set explicitly. Signed-in staging testers can link a provider through Options; anonymous
social login and public registration remain blocked. No new staging users are provisioned.
The existing production social origin was verified as `https://edita.ba`; its exact
Facebook callback is also registered in Meta. Production Facebook credentials remain
unset until Meta publication requirements are met. End-to-end OAuth verification is pending.

The Facebook OAuth flow is already implemented in `backend/studio/social_auth.py`.
No additional frontend SDK is needed. The button is enabled by the server only when
both Facebook credentials are present.

1. In Meta for Developers, create/open the Edita app and configure Facebook Login for a website.
2. Register the exact staging redirect URI:
   `https://staging.edita.ba/api/auth/social/facebook/callback`.
3. On the staging server set `FACEBOOK_CLIENT_ID` (Meta App ID),
   `FACEBOOK_CLIENT_SECRET` (Meta App Secret), and
   `SOCIAL_AUTH_BASE_URL=https://staging.edita.ba` in the private server environment.
   Keep credentials outside Git and frontend/VITE variables. Reload the application
   after changing the environment.
4. Sign in to staging with an existing Edita test account, then link Facebook in Options
   using a Meta app administrator/developer/tester while the app is unpublished.
   Edita requests `public_profile` and `email`; email is not guaranteed, and matching
   emails never automatically merge Edita accounts.
5. Complete the publishing/access requirements shown by Meta for the chosen use case,
   including app details, privacy policy and data-deletion information. Edita's existing
   public privacy route is `/privatnost`, with deletion/contact instructions under
   `#cuvanje`. Make those URLs publicly reachable by reviewers; staging itself is private.
6. For production, independently configure credentials and the exact production origin.
   The current code default is `https://www.edita.ba`, so its callback is
   `https://www.edita.ba/api/auth/social/facebook/callback`. If production explicitly
   sets a different canonical `SOCIAL_AUTH_BASE_URL`, register that exact URL instead.
   Deploying to staging does not enable production login.

An existing Edita user links Facebook through **Profil i postavke → Povezivanje prijave**.
A new user uses Facebook on the login page. Existing access-approval rules remain in force.

Instagram API with Instagram Login is a separate professional-account integration
(Business/Creator), not a replacement for general consumer login. Do not add a generic
Instagram sign-in button unless an appropriate supported identity flow is designed.

Reference docs:
- https://developers.facebook.com/docs/facebook-login/web/
- https://learn.microsoft.com/en-us/aspnet/core/security/authentication/social/facebook-logins
- https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login

## In-app announcements

Administracija → Obavijesti provides a themed preview, draft creation, explicit
publication to all visitors, expiry and withdrawal. It does not send OS/browser push
notifications, emails or sounds. Publishing occurs only through the administrator's
**Objavi svima → Da, objavi** action; saving a draft is private.

The global strip appears on all routes including login, polls every 30 seconds while
visible, and reserves space above the app. Only the newest undismissed notice is shown;
closing it reveals the next eligible notice. Authenticated dismissal is stored per
account and publication version; guests use browser-local dismissal. Republishing a
withdrawn announcement creates a new version and can show it again. Publishing an
already-active version is idempotent. Expired notices are not returned to visitors.
Backend migration: `0025_announcements`.
