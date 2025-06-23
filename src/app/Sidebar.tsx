"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Image from "next/image";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Planning", href: "/planning" },
  { label: "Quote Requests", href: "/quote-requests" },
  { label: "Archived", href: "/archived" },
  { label: "Customers", href: "/customers" },
  { label: "Labels", href: "/labels" },
  { label: "Countries", href: "/countries" },
  { label: "Users", href: "/users" },
  { label: "Notifications", href: "/notifications" },
  { label: "Modifications", href: "/modifications" },
  { label: "Profile", href: "/users/profile" },
];

export default function Sidebar() {
  const pathname = usePathname();
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
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shadow-md">
      <div className="flex flex-col items-center justify-center border-b border-gray-100 py-2">
        <div className="w-40 h-40 relative">
          <Image
            src="/logo1.png"
            alt="LoxConnect Logo"
            fill
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
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
      <div className="mt-auto mb-4 px-6 text-xs text-gray-400 text-center">
        <div>Welcome, {user?.displayName || user?.email || "User"}</div>
        <div>You are logged in.</div>
      </div>
    </aside>
  );
} 