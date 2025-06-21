import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
}

export const useCustomers = () => {
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
      setLoading(true);
      setError(null);
      const q = query(collection(db as Firestore, "customers"), orderBy("name"));
      const snapshot = await getDocs(q);
      const customersData = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Customer[];
      setCustomers(customersData);
    } catch (err) {
      console.error("Error fetching customers:", err);
      setError("Failed to fetch customers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      fetchCustomers();
    }
  }, []);

  return {
    customers,
    loading,
    error,
    refetchCustomers: fetchCustomers,
    // Helper to get customer by ID
    getCustomerById: (id: string) => customers.find(c => c.id === id),
    // Helper to get customer name by ID
    getCustomerName: (id: string) => customers.find(c => c.id === id)?.name || id
  };
}; 