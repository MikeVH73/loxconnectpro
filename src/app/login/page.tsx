"use client";
import { useState, useEffect } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
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
      
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md"
      >
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
    </div>
  );
} 