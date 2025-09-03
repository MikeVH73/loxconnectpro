"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import { seedCountries } from "../utils/seedCountries";

interface Country {
  id: string;
  name: string;
  createdAt: any;
  updatedAt: any;
}

export default function CountriesPage() {
  const { userProfile } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [countryName, setCountryName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const isSuperAdmin = userProfile?.role === "superAdmin";
  const isAdmin = userProfile?.role === "admin";
  const canManageCountries = isSuperAdmin || isAdmin;

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch countries
  useEffect(() => {
    if (!isClient) return;
    
    const fetchCountries = async () => {
      try {
        setLoading(true);
        const snapshot = await getDocs(collection(db, "countries"));
        
        // If no countries exist, seed them first
        if (snapshot.empty) {
          await seedCountries();
          // Fetch again after seeding
          const newSnapshot = await getDocs(collection(db, "countries"));
          const countriesData = newSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Country[];
          // Deduplicate by normalized name
          const byName = new Map<string, Country>();
          for (const c of countriesData) {
            const key = String(c.name || '').trim().toLowerCase();
            if (!byName.has(key)) byName.set(key, c);
          }
          const unique = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
          setCountries(unique);
        } else {
          const countriesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Country[];
          // Deduplicate by normalized name
          const byName = new Map<string, Country>();
          for (const c of countriesData) {
            const key = String(c.name || '').trim().toLowerCase();
            if (!byName.has(key)) byName.set(key, c);
          }
          const unique = Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
          setCountries(unique);
        }
      } catch (error) {
        console.error("Error fetching countries:", error);
        setError("Failed to fetch countries");
      } finally {
        setLoading(false);
      }
    };

    fetchCountries();
  }, [isClient]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCountries) {
      setError("Only superAdmin or admin can manage countries");
      return;
    }

    if (!countryName.trim()) {
      setError("Country name is required");
      return;
    }

    // Check for duplicate country names
    const existingCountry = countries.find(c => 
      c.name.toLowerCase() === countryName.trim().toLowerCase() && c.id !== editingCountry?.id
    );
    if (existingCountry) {
      setError("A country with this name already exists");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      if (editingCountry) {
        // Update existing country
        const countryRef = doc(db, "countries", editingCountry.id);
        await updateDoc(countryRef, {
          name: countryName.trim(),
          updatedAt: serverTimestamp()
        });
        
        setCountries(prev => prev.map(c => 
          c.id === editingCountry.id 
            ? { ...c, name: countryName.trim() }
            : c
        ).sort((a, b) => a.name.localeCompare(b.name)));
        
        setSuccess("Country updated successfully");
      } else {
        // Add new country
        const docRef = await addDoc(collection(db, "countries"), {
          name: countryName.trim(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        const newCountry: Country = {
          id: docRef.id,
          name: countryName.trim(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        setCountries(prev => [...prev, newCountry].sort((a, b) => a.name.localeCompare(b.name)));
        setSuccess("Country added successfully");
      }
      
      closeModal();
    } catch (error) {
      console.error("Error saving country:", error);
      setError("Failed to save country");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (country: Country) => {
    if (!canManageCountries) return;
    setEditingCountry(country);
    setCountryName(country.name);
    setShowModal(true);
  };

  const handleDelete = async (country: Country) => {
    if (!canManageCountries) return;
    
    if (!confirm(`Are you sure you want to delete "${country.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setSubmitting(true);
      await deleteDoc(doc(db, "countries", country.id));
      setCountries(prev => prev.filter(c => c.id !== country.id));
      setSuccess("Country deleted successfully");
    } catch (error) {
      console.error("Error deleting country:", error);
      setError("Failed to delete country");
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCountry(null);
    setCountryName("");
    setError("");
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading countries...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#e40115] mb-2">Countries Management</h1>
          <p className="text-gray-600">
            {canManageCountries 
              ? "Manage countries that can be used throughout the application"
              : "View available countries"
            }
          </p>
        </div>
        {canManageCountries && (
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 transition"
            disabled={submitting}
          >
            Add Country
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Country Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                {canManageCountries && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {countries.length === 0 ? (
                <tr>
                  <td colSpan={canManageCountries ? 4 : 3} className="px-6 py-4 text-center text-gray-500">
                    No countries found. {canManageCountries ? "Click 'Add Country' to create the first one." : ""}
                  </td>
                </tr>
              ) : (
                countries.map((country) => (
                  <tr key={country.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{country.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {country.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {country.updatedAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </div>
                    </td>
                    {canManageCountries && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleEdit(country)}
                          className="text-[#e40115] hover:text-red-700 mr-4"
                          disabled={submitting}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(country)}
                          className="text-red-600 hover:text-red-800"
                          disabled={submitting}
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">
              {editingCountry ? 'Edit Country' : 'Add New Country'}
            </h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Country Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={countryName}
                  onChange={(e) => setCountryName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e40115] focus:border-transparent"
                  placeholder="Enter country name"
                  required
                  disabled={submitting}
                />
              </div>
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700 transition disabled:opacity-50"
                  disabled={submitting || !countryName.trim()}
                >
                  {submitting ? 'Saving...' : (editingCountry ? 'Update' : 'Add')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}