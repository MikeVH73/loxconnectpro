'use client';

import { ReactNode } from 'react';
import ErrorBoundary from './ErrorBoundary';
import ConditionalLayout from '../ConditionalLayout';
import AuthProvider from '../AuthProvider';

interface ClientLayoutProps {
  children: ReactNode;
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ConditionalLayout>
      {children}
        </ConditionalLayout>
      </AuthProvider>
    </ErrorBoundary>
  );
} 