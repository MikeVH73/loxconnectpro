"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TotpMultiFactorGenerator,
  multiFactor,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
} from "firebase/auth";
import { useAuth } from "../../AuthProvider";

export default function SecurityPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [totpSecret, setTotpSecret] = useState<any | null>(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [displayName, setDisplayName] = useState("Authenticator");
  const [needsReauth, setNeedsReauth] = useState(false);
  const [password, setPassword] = useState("");
  const [verifSending, setVerifSending] = useState(false);

  const enrolledFactors = useMemo(() => {
    try {
      return user ? multiFactor(user).enrolledFactors : [];
    } catch {
      return [];
    }
  }, [user]);

  const issuer = "LoxConnect PRO";
  const accountName = user?.email || "user@loxconnect";

  // Keep user auth state fresh so emailVerified reflects latest
  useEffect(() => {
    if (!user) return;
    user.reload().catch(() => {});
  }, [user]);

  // Build otpauth URI from secret; fall back to provided uri if present
  const otpauthUri = useMemo(() => {
    if (!totpSecret) return "";
    const secret = totpSecret.secretKey || totpSecret.secret || "";
    const algo = (totpSecret.hashAlgorithm || "SHA1").toString();
    const digits = Number(totpSecret.verificationCodeLength || 6);
    const period = Number(totpSecret.codeIntervalSeconds || 30);
    const encodedLabel = encodeURIComponent(`${issuer}:${accountName}`);
    const params = new URLSearchParams({
      secret: secret,
      issuer: issuer,
      algorithm: algo,
      digits: String(digits),
      period: String(period),
    });
    return `otpauth://totp/${encodedLabel}?${params.toString()}`;
  }, [totpSecret, issuer, accountName]);

  const startEnroll = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Ensure latest verification status
      await user.reload();
      if (!user.emailVerified) {
        setError(
          "Email not verified. Please verify your email first, then return to this page and try again."
        );
        return;
      }
      const session = await multiFactor(user).getSession();
      const secret = await TotpMultiFactorGenerator.generateSecret(session);
      setTotpSecret(secret as any);
    } catch (e: any) {
      if (e?.code === "auth/requires-recent-login") {
        setNeedsReauth(true);
      } else {
        setError(e?.message || "Failed to start enrollment");
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmEnroll = async () => {
    if (!user || !totpSecret || !verificationCode) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        totpSecret,
        verificationCode.replace(/\s+/g, "")
      );
      await multiFactor(user).enroll(assertion, displayName || "Authenticator");
      setSuccess("Authenticator app enrolled successfully");
      setTotpSecret(null);
      setVerificationCode("");
      await user.reload().catch(() => {});
    } catch (e: any) {
      setError(e?.message || "Failed to enroll authenticator");
    } finally {
      setLoading(false);
    }
  };

  const reauthenticate = async () => {
    if (!user || !user.email) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const cred = EmailAuthProvider.credential(user.email, password);
      await reauthenticateWithCredential(user, cred);
      setNeedsReauth(false);
      setPassword("");
      await startEnroll();
    } catch (e: any) {
      setError(e?.message || "Re-authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const sendVerification = async () => {
    if (!user) return;
    setVerifSending(true);
    setError(null);
    setSuccess(null);
    try {
      await sendEmailVerification(user);
      setSuccess("Verification email sent. Please check your inbox.");
    } catch (e: any) {
      setError(e?.message || "Failed to send verification email");
    } finally {
      setVerifSending(false);
    }
  };

  const unenroll = async (factorUid: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await multiFactor(user).unenroll(factorUid);
      setSuccess("Authenticator removed");
    } catch (e: any) {
      setError(e?.message || "Failed to remove authenticator");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-semibold">Account Security</h1>
          <Link href="/users/profile" className="text-blue-600 hover:underline text-sm">
            Back to Profile
          </Link>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded text-sm">{success}</div>
        )}

        <section className="bg-white rounded border p-4 space-y-3">
          <h2 className="font-medium">Multi‑factor Authentication (Authenticator app)</h2>
          <div className="text-sm text-gray-700 flex items-center gap-2">
            <span>Email status:</span>
            <span className={user?.emailVerified ? "text-green-700" : "text-red-700"}>
              {user?.emailVerified ? "Verified" : "Not verified"}
            </span>
            {!user?.emailVerified && (
              <button
                onClick={sendVerification}
                className="ml-2 px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 disabled:opacity-50"
                disabled={verifSending}
              >
                {verifSending ? "Sending…" : "Send verification email"}
              </button>
            )}
            <button
              onClick={() => user?.reload()}
              className="ml-auto px-2 py-1 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
            >
              Refresh
            </button>
          </div>
          {enrolledFactors && enrolledFactors.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                You have {enrolledFactors.length} enrolled factor
                {enrolledFactors.length > 1 ? "s" : ""}.
              </p>
              <ul className="space-y-1">
                {enrolledFactors.map((f) => (
                  <li key={f.uid} className="flex items-center justify-between text-sm">
                    <span>
                      {f.displayName || "Authenticator"} • {f.factorId}
                    </span>
                    <button
                      onClick={() => unenroll(f.uid)}
                      className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No authenticators enrolled.</p>
          )}

          {!totpSecret ? (
            <button
              onClick={startEnroll}
              className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
              disabled={loading || !user}
            >
              Enroll Authenticator App
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">
                Scan this QR code with your authenticator app, then enter the 6‑digit code to confirm.
              </p>
              {otpauthUri && (
                <img
                  alt="QR"
                  className="border rounded w-40 h-40"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(
                    otpauthUri
                  )}`}
                />
              )}
              <div className="flex items-center gap-2">
                <input
                  className="p-2 border rounded w-32"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                />
                <input
                  className="p-2 border rounded flex-1"
                  placeholder="Device name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <button
                  onClick={confirmEnroll}
                  className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm disabled:opacity-50"
                  disabled={loading || !verificationCode}
                >
                  Confirm
                </button>
                <button
                  onClick={() => {
                    setTotpSecret(null);
                    setVerificationCode("");
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {needsReauth && (
            <div className="mt-3 p-3 border rounded bg-yellow-50 text-sm space-y-2">
              <p>For security reasons, please confirm your password to continue.</p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  className="p-2 border rounded flex-1"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  onClick={reauthenticate}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-50"
                  disabled={loading || !password}
                >
                  Re-authenticate
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}



