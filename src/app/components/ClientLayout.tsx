'use client';

import ErrorBoundary from './ErrorBoundary';
import { ReactNode } from 'react';
import AuthProvider from '../AuthProvider';
import ConditionalLayout from '../ConditionalLayout';

export default function ClientLayout({ children }: { children: ReactNode }) {
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