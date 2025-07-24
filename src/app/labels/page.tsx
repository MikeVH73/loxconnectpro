'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import dynamic from 'next/dynamic';

const LoadingSpinner = dynamic(() => import('../components/LoadingSpinner'), { ssr: false });

function LabelsPage() {
  const { userProfile } = useAuth();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return <LoadingSpinner />;
    }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Labels Management</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p>Labels management functionality will be implemented here.</p>
        </div>
    </div>
  );
} 

// Export with no SSR
export default dynamic(() => Promise.resolve(LabelsPage), {
  ssr: false
}); 