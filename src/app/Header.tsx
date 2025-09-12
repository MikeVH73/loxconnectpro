"use client";
import { useAuth } from "./AuthProvider";

export default function Header() {
  const { user, userProfile, signOutUser } = useAuth();

  return (
    <div className="flex items-center justify-between px-6 py-3 bg-white border-b">
      <div className="flex items-center space-x-4">
        <h1 className="text-[#e40115] font-bold text-lg">LoxCall PRO</h1>
      </div>
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <span className="text-gray-600">{user?.email}</span>
          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded">{userProfile?.role || 'admin'}</span>
        </div>
        <button
          onClick={() => signOutUser()}
          className="px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
} 