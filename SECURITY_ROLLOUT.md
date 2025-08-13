# Security Rollout Plan (Feature-Flagged)

This plan introduces optional security layers that are disabled by default and safe to deploy. You can roll back by toggling env flags or reverting the branch.

## Feature Flags (env)
- `NEXT_PUBLIC_ENABLE_APP_CHECK`: `true` to enable App Check initialization on the client
- `NEXT_PUBLIC_RECAPTCHA_KEY`: reCAPTCHA Enterprise site key (required if enabling App Check)
- `NEXT_PUBLIC_ENABLE_EDGE_AUTH`: `true` to enable edge middleware gating (expects `__session` cookie)

## Steps
1) Deploy with flags OFF (default)
   - Confirms no behavioral changes
2) Turn ON App Check in code (flag true) and in Firebase Console keep enforcement OFF
   - Validate functionality
   - Then enforce App Check for Firestore/Storage in Console when ready
3) Turn ON edge auth flag when session cookie handling is added
   - Until then, middleware only redirects if no `__session` cookie; keep OFF by default
4) Add Auth Blocking Functions and MFA enforcement (future step)

## Files
- `src/firebaseClient.ts`: Optional App Check init
- `middleware.ts`: Edge auth scaffold, disabled unless `NEXT_PUBLIC_ENABLE_EDGE_AUTH=true`

## Rollback
- Toggle flags back to `false`, or `git checkout main`




