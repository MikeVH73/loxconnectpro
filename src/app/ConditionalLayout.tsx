"use client";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Prevent hydration mismatch by not rendering sidebar until client-side
  if (!isClient) {
    return <>{children}</>;
  }
  
  const showSidebar = !pathname.includes('/login');

  if (showSidebar) {
    return (
      <div className="flex h-screen">
        <div className="w-64 flex-none bg-white border-r">
          <Sidebar />
        </div>
        <div className="flex-1 overflow-auto">
          <Header />
          <main className="flex-1 bg-gray-50 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 