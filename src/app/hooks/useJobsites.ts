import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
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

    // Don't run query if customerId is empty string
    if (customerId === '') {
      setJobsites([]);
      setLoading(false);
      return;
    }

    // Use getDocs instead of onSnapshot to avoid index requirements
    const fetchJobsites = async () => {
      try {
        let jobsitesQuery;
        if (customerId && customerId.trim() !== '') {
          // Simple query without orderBy to avoid index requirements
          jobsitesQuery = query(
            collection(db, 'customerJobsites'),
            where('customerId', '==', customerId),
            where('isActive', '==', true)
          );
        } else {
          jobsitesQuery = query(
            collection(db, 'customerJobsites'),
            where('isActive', '==', true)
          );
        }

        const snapshot = await getDocs(jobsitesQuery);
        const jobsitesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as CustomerJobsite[];
        
        // Sort client-side to avoid Firebase index requirements
        jobsitesData.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
          return dateB.getTime() - dateA.getTime(); // Descending order
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
