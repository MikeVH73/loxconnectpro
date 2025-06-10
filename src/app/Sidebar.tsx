"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../firebaseClient";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Quote Requests", href: "/quote-requests" },
  { label: "Archived", href: "/archived" },
  { label: "Customers", href: "/customers" },
  { label: "Labels", href: "/labels" },
  { label: "Countries", href: "/countries" },
  { label: "Users", href: "/users" },
  { label: "Notifications", href: "/notifications" },
  { label: "Modifications", href: "/modifications" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  console.log("[Sidebar] userProfile:", userProfile);

  if (userProfile === null) {
    // Optionally, show a spinner here
    return null;
  }

  // Only show restricted items if not readOnly
  const restrictedLabels = ["Customers", "Labels", "Countries", "Users", "Notifications", "Modifications"];
  const filteredNavItems = navItems.filter(item => {
    if (restrictedLabels.includes(item.label)) {
      return userProfile?.role !== "readOnly";
    }
    return true;
  });

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col min-h-screen shadow-md">
      <div className="flex flex-col items-center justify-center border-b border-gray-100 py-4 gap-2">
        <div className="flex items-center justify-center w-20 h-20">
          <img
            src="https://i.ibb.co/60Q41WjS/Logo-rond-loxam-1.png"
            alt="LoxConnect Logo"
            width={64}
            height={64}
            className="rounded-full bg-white shadow object-contain"
            style={{ display: 'block' }}
          />
        </div>
        <span className="text-2xl font-bold text-[#e40115] tracking-wide text-center">LoxConnect PRO</span>
      </div>
      <nav className="flex-1 py-6">
        <ul className="space-y-1">
          {filteredNavItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block px-6 py-3 rounded-l-full font-medium transition-colors
                  ${pathname.startsWith(item.href)
                    ? "bg-[#e40115] text-white shadow"
                    : "text-gray-800 hover:bg-[#bbbdbe] hover:text-[#e40115]"}
                `}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Small welcome/user info at the bottom */}
      <div className="mt-auto mb-2 px-6 text-xs text-gray-400 text-center">
        <div>Welcome, {user?.displayName || user?.email || "User"}</div>
        <div>You are logged in.</div>
      </div>
      <div className="px-6 mb-6">
        <button
          onClick={async () => {
            try {
              await signOut(auth);
              router.replace("/login");
            } catch (error) {
              console.error("Logout error:", error);
            }
          }}
          className="w-full bg-gray-200 text-gray-700 text-xs py-2 rounded hover:bg-gray-300 transition font-semibold"
        >
          Sign Out
        </button>
      </div>
      {/* Leave space for future settings */}
      <div className="mb-4" />
    </aside>
  );
} 