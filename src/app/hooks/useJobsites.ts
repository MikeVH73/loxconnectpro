import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc } from 'firebase/firestore';
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

    let jobsitesQuery;
    if (customerId && customerId.trim() !== '') {
      jobsitesQuery = query(
        collection(db, 'customerJobsites'),
        where('customerId', '==', customerId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
    } else {
      jobsitesQuery = query(
        collection(db, 'customerJobsites'),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(jobsitesQuery, (snapshot) => {
      const jobsitesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as CustomerJobsite[];
      setJobsites(jobsitesData);
      setLoading(false);
    }, (error) => {
      console.error('Error in jobsites listener:', error);
      setLoading(false);
    });

    return () => unsubscribe();
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
