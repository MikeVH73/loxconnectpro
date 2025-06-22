import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, serverTimestamp, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";

interface Country {
  id: string;
  name: string;
  createdAt: any;
  updatedAt: any;
}

const initialCountries = [
  "Loxcall Netherlands",
  "Loxcall France",
  "Loxcall Germany",
  "Nationwide Platforms UK",
  "Loxcall Belgium",
  "Ramirent Sweden",
  "Loxcall Ireland",
  "Loxcall Italy",
  "Loxcall Luxembourg",
  "Loxcall Portugal",
  "Loxcall Spain",
  "Ramirent Finland",
  "Ramirent Norway"
];

export const useCountries = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const seedCountries = async () => {
    if (!db) {
      console.error('Firestore is not initialized during country seeding');
      throw new Error('Firestore is not initialized');
    }

    try {
      console.log("Starting to seed initial countries...");
      const batch = [];
      for (const countryName of initialCountries) {
        console.log(`Adding country: ${countryName}`);
        batch.push(addDoc(collection(db as Firestore, "countries"), {
          name: countryName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }));
      }
      await Promise.all(batch);
      console.log(`Successfully seeded ${initialCountries.length} countries`);
    } catch (error) {
      console.error("Error seeding countries:", error);
      throw error;
    }
  };

  const fetchCountries = async () => {
    if (!db) {
      console.error('Firestore is not initialized during country fetch');
      setError('Firestore is not initialized');
      setLoading(false);
      return;
    }

    try {
      console.log("Starting to fetch countries...");
      setLoading(true);
      setError(null);

      // First try to get countries
      const snapshot = await getDocs(collection(db as Firestore, "countries"));
      console.log(`Found ${snapshot.size} countries in database`);

      // If no countries exist, seed them
      if (snapshot.empty) {
        console.log("No countries found, starting seeding process");
        await seedCountries();
        // Fetch again after seeding
        const newSnapshot = await getDocs(collection(db as Firestore, "countries"));
        const countriesData = newSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Country[];
        countriesData.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Successfully fetched ${countriesData.length} countries after seeding`);
        setCountries(countriesData);
      } else {
        // Use existing countries
        const countriesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Country[];
        countriesData.sort((a, b) => a.name.localeCompare(b.name));
        console.log(`Successfully fetched ${countriesData.length} existing countries`);
        setCountries(countriesData);
      }
    } catch (error) {
      console.error("Error in fetchCountries:", error);
      setError("Failed to fetch countries");
      // Fallback to hardcoded countries if Firestore fails
      console.log("Using fallback hardcoded countries");
      const fallbackCountries = initialCountries.map((name, index) => ({
        id: String(index + 1),
        name,
        createdAt: null,
        updatedAt: null
      }));
      setCountries(fallbackCountries);
      console.log(`Set ${fallbackCountries.length} fallback countries`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log("Initializing countries fetch");
      fetchCountries();
    }
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