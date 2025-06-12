"use client";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !pathname.startsWith("/login");

  if (showSidebar) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 bg-gray-50">{children}</main>
      </div>
    );
  }

  return <>{children}</>;
} 