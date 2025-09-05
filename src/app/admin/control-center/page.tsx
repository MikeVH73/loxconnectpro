"use client";

import { useAuth } from "../../AuthProvider";
import Link from "next/link";
import { FiSettings, FiUsers, FiGlobe, FiTag, FiMegaphone, FiEdit3, FiBell, FiMonitor } from "react-icons/fi";

export default function ControlCenterPage() {
  const { userProfile } = useAuth();

  // Check if user has permission to access control center
  if (userProfile?.role !== 'superAdmin') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">Only SuperAdmins can access the Control Center.</p>
        </div>
      </div>
    );
  }

  const controlCenterItems = [
    {
      title: "Labels Management",
      description: "Create, edit, and manage system labels for quote requests",
      href: "/labels",
      icon: FiTag,
      color: "bg-blue-500"
    },
    {
      title: "Countries Management",
      description: "Manage countries and their configurations",
      href: "/countries",
      icon: FiGlobe,
      color: "bg-green-500"
    },
    {
      title: "User Management",
      description: "Manage users, roles, and permissions",
      href: "/users",
      icon: FiUsers,
      color: "bg-purple-500"
    },
    {
      title: "Broadcast Messages",
      description: "Send broadcast notifications to all users",
      href: "/notifications/broadcast",
      icon: FiMegaphone,
      color: "bg-orange-500"
    },
    {
      title: "Modifications Log",
      description: "View and manage system modifications",
      href: "/modifications",
      icon: FiEdit3,
      color: "bg-red-500"
    },
    {
      title: "Notification Settings",
      description: "Configure deadline notification preferences",
      href: "/admin/notification-settings",
      icon: FiBell,
      color: "bg-yellow-500"
    },
    {
      title: "IT Overview",
      description: "System information, security, and technical details",
      href: "/admin/it-overview",
      icon: FiMonitor,
      color: "bg-gray-500"
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Control Center</h1>
          <p className="mt-2 text-gray-600">
            Centralized management for system administration and configuration
          </p>
        </div>

        {/* Control Center Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {controlCenterItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6 border border-gray-200 hover:border-gray-300"
              >
                <div className="flex items-start space-x-4">
                  <div className={`${item.color} p-3 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                    <IconComponent className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {item.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Stats or Additional Info */}
        <div className="mt-12 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">Active</div>
              <div className="text-sm text-gray-600">System Status</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">Online</div>
              <div className="text-sm text-gray-600">Service Status</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">Secure</div>
              <div className="text-sm text-gray-600">Security Status</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
