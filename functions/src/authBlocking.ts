import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Blocking functions scaffold. Disabled until deployed.
// Add to firebase.json under "functions" -> "blockingFunctions" to enable.

// beforeCreate: Allowlist domain check and basic password policy example
export const beforeCreate = functions.auth.user().beforeCreate(async (user, context) => {
  const email = user.email || '';
  const allowedDomainsEnv = process.env.ALLOWED_EMAIL_DOMAINS || '';
  const allowedDomains = allowedDomainsEnv.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);

  if (allowedDomains.length > 0) {
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain || !allowedDomains.includes(domain)) {
      throw new functions.auth.HttpsError('permission-denied', 'Email domain not allowed');
    }
  }

  // Optionally write initial custom claims or profile setup here via Admin SDK
  // e.g., set default role
  // const auth = admin.auth(); await auth.setCustomUserClaims(user.uid, { role: 'user' });
});

// beforeSignIn: enforce emailVerified and active flag in custom claims
export const beforeSignIn = functions.auth.user().beforeSignIn(async (user, context) => {
  const claims: any = context?.authCredential?.claims || {};
  // One-time bypass for emergencies; admin sets this via Admin SDK and clears after use
  if (claims?.one_time_bypass === true) {
    return;
  }
  if (!user.emailVerified) {
    throw new functions.auth.HttpsError('permission-denied', 'Email not verified');
  }
  // Optional: active flag
  if (claims?.active === false) {
    throw new functions.auth.HttpsError('permission-denied', 'Account disabled');
  }
});



