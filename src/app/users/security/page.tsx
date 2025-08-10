"use client";
import Link from "next/link";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Account Security</h1>
        <p className="text-gray-600">This page will guide users to enroll MFA and review recent sign-in activity. Coming soon.</p>
        <ul className="list-disc pl-6 text-gray-700">
          <li>MFA enrollment (TOTP) — pending</li>
          <li>Recovery codes — pending</li>
          <li>Recent sign-ins — pending</li>
        </ul>
        <Link href="/users/profile" className="text-blue-600 hover:underline">Back to Profile</Link>
      </div>
    </div>
  );
}


