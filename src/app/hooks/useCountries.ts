import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseClient";

interface Country {
  id: string;
  name: string;
  createdAt: any;
  updatedAt: any;
}

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCountries = async () => {
    try {
      setLoading(true);
      setError(null);
      const snapshot = await getDocs(collection(db, "countries"));
      const countriesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Country[];
      
      // Sort by name
      countriesData.sort((a, b) => a.name.localeCompare(b.name));
      setCountries(countriesData);
    } catch (error) {
      console.error("Error fetching countries:", error);
      setError("Failed to fetch countries");
      // Fallback to hardcoded countries if Firestore fails
      setCountries([
        { id: "1", name: "Netherlands", createdAt: null, updatedAt: null },
        { id: "2", name: "France", createdAt: null, updatedAt: null },
        { id: "3", name: "Germany", createdAt: null, updatedAt: null },
        { id: "4", name: "UK", createdAt: null, updatedAt: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCountries();
  }, []);

  return {
    countries,
    loading,
    error,
    refetchCountries: fetchCountries,
    // Helper to get just the country names as an array
    countryNames: countries.map(c => c.name)
  };
}; 