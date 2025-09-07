import { useState, useEffect } from 'react';
import { collection, getDocs, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
  customerNumbers?: { [country: string]: string };
  ownerCountry?: string;
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = async () => {
    if (!db) {
      setError('Firestore is not initialized');
      setLoading(false);
      return;
    }

    try {
      const customersCollection = collection(db as Firestore, 'customers');
      const snapshot = await getDocs(customersCollection);
      const customersData = snapshot.docs.map(doc => {
        const data: any = doc.data();
        return {
          id: doc.id,
          name: data.name,
          address: data.address,
          contact: data.contact,
          phone: data.phone,
          email: data.email,
          customerNumbers: data.customerNumbers || {},
          ownerCountry: data.ownerCountry || data.creatorCountry || (Array.isArray(data.countries) && data.countries.length ? data.countries[0] : undefined)
        } as Customer;
      });
      setCustomers(customersData);
      setError(null);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  return {
    customers,
    loading,
    error,
    refetchCustomers: fetchCustomers
  };
}

export type { Customer };