import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { CustomerJobsite } from '../../types';

export function useJobsites(customerId?: string) {
  const [jobsites, setJobsites] = useState<CustomerJobsite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    // Fetch all active jobsites and filter client-side to avoid index requirements
    const fetchJobsites = async () => {
      try {
        // Simple query - just get all active jobsites (no complex where clauses)
        const jobsitesQuery = collection(db, 'customerJobsites');
        const snapshot = await getDocs(jobsitesQuery);
        
        let jobsitesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CustomerJobsite[];
        
        // Filter client-side for active jobsites
        jobsitesData = jobsitesData.filter(jobsite => jobsite.isActive === true);
        
        // Filter by customerId if provided
        if (customerId && customerId.trim() !== '') {
          jobsitesData = jobsitesData.filter(jobsite => jobsite.customerId === customerId);
        }
        
        // Sort client-side by creation date (newest first)
        jobsitesData.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });
        
        setJobsites(jobsitesData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching jobsites:', error);
        setLoading(false);
      }
    };

    fetchJobsites();
  }, [customerId]);

  const createJobsite = async (jobsiteData: Omit<CustomerJobsite, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (!db) throw new Error('Database not available');

    const newJobsite = {
      ...jobsiteData,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const docRef = await addDoc(collection(db, 'customerJobsites'), newJobsite);
    return { id: docRef.id, ...newJobsite };
  };

  const updateJobsite = async (jobsiteId: string, updates: Partial<CustomerJobsite>) => {
    if (!db) throw new Error('Database not available');

    await updateDoc(doc(db, 'customerJobsites', jobsiteId), {
      ...updates,
      updatedAt: new Date()
    });
  };

  return {
    jobsites,
    loading,
    createJobsite,
    updateJobsite
  };
}
