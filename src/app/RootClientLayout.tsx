'use client';

import AuthProvider from "./AuthProvider";
import ConditionalLayout from "./ConditionalLayout";
import ClientLayout from "./components/ClientLayout";
import type { ReactNode } from "react";

export default function RootClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ClientLayout>
      <AuthProvider>
        <ConditionalLayout>
          {children}
        </ConditionalLayout>
      </AuthProvider>
    </ClientLayout>
  );
} 