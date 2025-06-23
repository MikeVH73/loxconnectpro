"use client";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseClient";

export default function Header() {
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  if (!user || userProfile === null) {
    return null;
  }

  return (
    <header className="h-16 bg-white border-b border-gray-200 shadow-sm flex items-center justify-between px-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-[#e40115] tracking-wide">
          LoxConnect PRO
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        {/* User info */}
        <div className="text-sm text-gray-600">
          <span className="font-medium">{user.displayName || user.email}</span>
          {userProfile?.role && (
            <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
              {userProfile.role}
            </span>
          )}
        </div>
        
        {/* Sign out button */}
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-[#e40115] text-white text-sm font-medium rounded-md hover:bg-[#c7010e] transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
} 