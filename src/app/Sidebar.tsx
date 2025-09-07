"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import Image from "next/image";
import NotificationBadge from "./components/NotificationBadge";
import { useState, useEffect } from "react";
import { FiChevronDown, FiChevronRight, FiTag, FiGlobe, FiUsers, FiSearch, FiSpeaker, FiEdit3, FiBell, FiMonitor } from "react-icons/fi";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Planning", href: "/planning" },
  { label: "Quote Requests", href: "/quote-requests" },
  { label: "Archived", href: "/archived" },
  { label: "Customers", href: "/customers" },
  { label: "Products", href: "/products" },
  { label: "Notifications", href: "/notifications" },
  { label: "Analytics", href: "/analytics" },
  { label: "Report Issues", href: "/report-issues" },
  { label: "Submit Ideas", href: "/submit-ideas" },
  { label: "FAQs", href: "/faqs" },
  { label: "Profile", href: "/users/profile" },
  { label: "Security", href: "/users/security" },
];

// Admin-only menu items (visible to both admin and superAdmin)
const adminNavItems = [
  { label: "Users", href: "/users" },
  { label: "Notification Settings", href: "/admin/notification-settings" },
];

// Control Center submenu items for SuperAdmin only
const controlCenterItems = [
  { label: "Labels", href: "/labels", icon: FiTag },
  { label: "Countries", href: "/countries", icon: FiGlobe },
  { label: "Scan Customers", href: "/customers/scan", icon: FiSearch },
  { label: "Broadcast", href: "/notifications/broadcast", icon: FiSpeaker },
  { label: "Modifications", href: "/modifications", icon: FiEdit3 },
  { label: "IT Overview", href: "/admin/it-overview", icon: FiMonitor },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, userProfile, loading } = useAuth();
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const [hasUserToggledControlCenter, setHasUserToggledControlCenter] = useState(false);
  console.log("[Sidebar] userProfile:", userProfile);

  // Show loading state while auth is being determined
  if (loading || userProfile === null) {
    return (
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shadow-md">
        <div className="flex flex-col items-center justify-center border-b border-gray-100 py-3">
          <div className="w-44 h-44 relative -my-2">
            <Image
              src="/logo1.png"
              alt="LoxConnect Logo"
              fill
              style={{ objectFit: 'contain' }}
              priority
            />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </aside>
    );
  }

  // Check if any Control Center item is active
  const isControlCenterActive = controlCenterItems.some(item => pathname.startsWith(item.href));
  
  // Auto-open Control Center if one of its items is active (only if user hasn't manually toggled it)
  useEffect(() => {
    if (isControlCenterActive && !isControlCenterOpen && !hasUserToggledControlCenter) {
      setIsControlCenterOpen(true);
    }
  }, [isControlCenterActive, isControlCenterOpen, hasUserToggledControlCenter]);

  // Handle Control Center toggle
  const handleControlCenterToggle = () => {
    setHasUserToggledControlCenter(true);
    setIsControlCenterOpen(!isControlCenterOpen);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen shadow-md">
      <div className="flex flex-col items-center justify-center border-b border-gray-100 py-3">
        <div className="w-44 h-44 relative -my-2">
          <Image
            src="/logo1.png"
            alt="LoxConnect Logo"
            fill
            style={{ objectFit: 'contain' }}
            priority
          />
        </div>
      </div>
      <nav className="flex-1 py-3 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block px-6 py-3 rounded-l-full font-medium transition-colors relative
                  ${pathname.startsWith(item.href)
                    ? "bg-[#e40115] text-white shadow"
                    : "text-gray-800 hover:bg-[#bbbdbe] hover:text-[#e40115]"}
                `}
              >
                {item.label}
                {item.label === "Notifications" && <NotificationBadge />}
              </Link>
            </li>
          ))}

          {/* Admin menu items (visible to both admin and superAdmin) */}
          {(userProfile?.role === 'admin' || userProfile?.role === 'superAdmin') && (
            <>
              {adminNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-6 py-3 rounded-l-full font-medium transition-colors relative
                      ${pathname.startsWith(item.href)
                        ? "bg-[#e40115] text-white shadow"
                        : "text-gray-800 hover:bg-[#bbbdbe] hover:text-[#e40115]"}
                    `}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </>
          )}
          
          {/* Control Center for SuperAdmin */}
          {userProfile?.role === 'superAdmin' && (
            <li>
              <button
                onClick={handleControlCenterToggle}
                className={`w-full flex items-center justify-between px-6 py-3 rounded-l-full font-medium transition-colors relative
                  ${isControlCenterActive
                    ? "bg-[#e40115] text-white shadow"
                    : "text-gray-800 hover:bg-[#bbbdbe] hover:text-[#e40115]"}
                `}
              >
                <span>Control Center</span>
                {isControlCenterOpen ? (
                  <FiChevronDown className="h-4 w-4" />
                ) : (
                  <FiChevronRight className="h-4 w-4" />
                )}
              </button>
              
              {/* Control Center Submenu */}
              {isControlCenterOpen && (
                <ul className="ml-4 mt-1 space-y-1">
                  {controlCenterItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center px-4 py-2 rounded-l-full text-sm font-medium transition-colors
                            ${pathname.startsWith(item.href)
                              ? "bg-[#e40115] text-white shadow"
                              : "text-gray-700 hover:bg-[#bbbdbe] hover:text-[#e40115]"}
                          `}
                        >
                          <IconComponent className="h-4 w-4 mr-2" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          )}
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