"use client";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword, getMultiFactorResolver, TotpMultiFactorGenerator, MultiFactorResolver } from "firebase/auth";
import { getIdToken } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth, db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import { doc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mfaResolver, setMfaResolver] = useState<MultiFactorResolver | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (!loading && user) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    
    try {
      // First, try normal Firebase Auth login and set a secure session cookie
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await getIdToken(cred.user, true);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      router.replace("/dashboard");
    } catch (err: any) {
      // MFA required flow (e.g., TOTP)
      if (err?.code === 'auth/multi-factor-auth-required') {
        try {
          const resolver = getMultiFactorResolver(auth, err);
          setMfaResolver(resolver);
          setMfaCode("");
          setMfaError("");
          return; // Show MFA code form below
        } catch (resolverErr: any) {
          setError(resolverErr?.message || 'Multi-factor authentication required but could not be initialized.');
          return;
        }
      }
      // If normal login fails, check if it's a temporary password
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        try {
          // Check if there's a temporary password in Firestore
          const userDoc = await getDoc(doc(db, "users", email));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.tempPassword === password) {
              // Temporary password matches, allow login
              // We need to create a custom auth session or redirect to password change
              setError("Temporary password accepted. Please change your password on the next page.");
              // For now, we'll redirect to profile page to change password
              router.replace("/users/profile?tempPassword=true");
              return;
            }
          }
        } catch (firestoreErr) {
          console.error("Error checking temporary password:", firestoreErr);
        }
      }
      
      // Friendlier hint for unverified emails or strict policy
      if (err?.code === 'auth/invalid-credential') {
        setError('Login failed. If you recently changed your email, make sure it is verified. Contact an admin to resend a verification email.');
      } else {
        setError(err.message || "Login failed");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaResolver) return;
    setSubmitting(true);
    setMfaError("");
    try {
      const cleanCode = mfaCode.replace(/\s+/g, "");
      const selectedHint = mfaResolver.hints?.[0];
      const assertion = TotpMultiFactorGenerator.assertionForSignIn(cleanCode, selectedHint as any);
      const cred = await mfaResolver.resolveSignIn(assertion);
      const idToken = await getIdToken(cred.user, true);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      router.replace('/dashboard');
    } catch (err: any) {
      if (err?.code === 'auth/invalid-verification-code') {
        setMfaError('Invalid code. Please open your authenticator app and enter the current 6‑digit code.');
      } else {
        setMfaError(err?.message || 'Failed to verify code.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      {!mfaResolver ? (
        <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-2xl font-bold mb-6 text-center text-[#e40115]">LoxConnect PRO Login</h1>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Email</label>
            <input
              type="email"
              className="w-full border rounded px-3 py-2"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Password</label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            className="w-full bg-[#e40115] text-white py-2 rounded hover:bg-red-700 transition"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Login"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleMfaSubmit} className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h1 className="text-xl font-semibold mb-4 text-center">Two‑Step Verification</h1>
          <p className="text-sm text-gray-600 mb-4">Enter the 6‑digit code from your Authenticator app to finish signing in.</p>
          <div className="mb-4">
            <label className="block mb-1 font-medium">Authenticator code</label>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              className="w-full border rounded px-3 py-2 tracking-widest text-center text-2xl"
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value)}
              required
              autoFocus
            />
          </div>
          {mfaError && <div className="mb-4 text-red-600 text-sm">{mfaError}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-[#e40115] text-white py-2 rounded hover:bg-red-700 transition"
              disabled={submitting}
            >
              {submitting ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="px-4 py-2 border rounded"
              onClick={() => { setMfaResolver(null); setMfaCode(""); setMfaError(""); }}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 