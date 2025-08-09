import { collection, addDoc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";

const initialCountries = [
  "Loxcall Netherlands",
  "Loxcall France",
  "Loxcall Germany",
  "Loxcall UK",
  "Loxcall Belgium",
  "Loxcall Sweden",
  "Loxcall Switzerland",
  "Loxcall Spain",
  "Loxcall Italy",
  "Loxcall Luxembourg",
  "Loxcall Ireland",
  "Loxcall Portugal",
  "Loxcall Denmark",
  "Loxcall Norway",
  "Loxcall Poland",
  "Loxcall Austria",
];

export const seedCountries = async () => {
  // Only run on client side
  if (typeof window === 'undefined') {
    console.log("seedCountries: Skipping on server side");
    return;
  }

  try {
    // Check if countries already exist
    const snapshot = await getDocs(collection(db, "countries"));
    
    if (snapshot.empty) {
      console.log("Seeding initial countries...");
      
      // Add initial countries
      for (const countryName of initialCountries) {
        await addDoc(collection(db, "countries"), {
          name: countryName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      console.log(`Successfully seeded ${initialCountries.length} countries`);
    } else {
      console.log("Countries already exist in database");
    }
  } catch (error) {
    console.error("Error seeding countries:", error);
    // Don't throw error, just log it
  }
};

// Function to call from browser console if needed
if (typeof window !== 'undefined') {
  (window as any).seedCountries = seedCountries;
} 