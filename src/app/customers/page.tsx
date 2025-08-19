"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc, addDoc, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import { useCountries } from "../hooks/useCountries";

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
  customerNumbers: { [country: string]: string };
  countries?: string[];
  ownerCountry?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

type CustomerDataForFirestore = Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> & {
  createdAt?: Date | null;
  updatedAt?: Date | null;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { userProfile, loading: authLoading, user } = useAuth();
  const { countryNames: countries, loading: countriesLoading } = useCountries();

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!db) {
        console.error('Firebase DB not initialized');
        return;
      }
      
      try {
        console.log('Fetching customers...');
        const customersRef = collection(db as Firestore, "customers");
        const q = query(customersRef, orderBy("name"));
        const snapshot = await getDocs(q);
        console.log(`Found ${snapshot.size} customers in database`);
        
        let fetchedCustomers = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Customer data:', data);
          return {
        id: doc.id, 
            name: data.name || '',
            address: data.address || '',
            contact: data.contact || '',
            phone: data.phone || '',
            email: data.email || '',
            customerNumbers: data.customerNumbers || {},
            countries: Array.isArray(data.countries) ? data.countries : 
                      Object.keys(data.customerNumbers || {}).filter(k => data.customerNumbers[k]),
            ownerCountry: data.ownerCountry || data.creatorCountry || (Array.isArray(data.countries) && data.countries.length ? data.countries[0] : undefined),
            createdBy: data.createdBy || '',
            createdByName: data.createdByName || '',
            createdAt: data.createdAt?.toDate() || null,
            updatedAt: data.updatedAt?.toDate() || null
          } as Customer;
        });

        console.log('Fetched customers:', fetchedCustomers);
        console.log('User profile:', userProfile);

        // Filter customers based on user role and countries
        if (userProfile?.role === "Employee" && userProfile.countries && userProfile.countries.length > 0) {
          console.log('Filtering customers for user countries:', userProfile.countries);
          fetchedCustomers = fetchedCustomers.filter(customer => {
            const owner = customer.ownerCountry || (customer.countries || [])[0];
            const related = new Set<string>([owner, ...Object.keys(customer.customerNumbers || {})]);
            const match = Array.from(related).some(c => userProfile.countries?.includes(c));
            console.log(`Customer ${customer.name} owner=${owner} related=${Array.from(related).join(',')}, match=${match}`);
            return match;
          });
        }

        console.log('Final customers after filtering:', fetchedCustomers);
        setCustomers(fetchedCustomers);
      } catch (error) {
        console.error("Error fetching customers:", error);
      } finally {
      setLoading(false);
      }
    };

    if (!countriesLoading && !authLoading) {
      fetchCustomers();
    }
  }, [userProfile, countriesLoading, authLoading]);

  // Group customers by ownerCountry only to prevent duplication across countries
  const groupedCustomers = customers.reduce<{ [country: string]: Customer[] }>((acc, customer) => {
    const owner = customer.ownerCountry || (customer.countries && customer.countries.length ? customer.countries[0] : 'Unknown');
    if (!acc[owner]) acc[owner] = [];
    if (!acc[owner].find(c => c.id === customer.id)) acc[owner].push(customer);
    return acc;
  }, {});

  console.log('Available countries:', countries);
  console.log('Grouped customers:', groupedCustomers);

  const handleDelete = async (customerId: string) => {
    if (!db) return;
    
    try {
      await deleteDoc(doc(db as Firestore, "customers", customerId));
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting customer:", error);
    }
  };

  const handleEdit = async () => {
    if (!db || !editingCustomer) return;

    try {
      const customerData: CustomerDataForFirestore = {
        name: editingCustomer.name || '',
        address: editingCustomer.address || '',
        contact: editingCustomer.contact || '',
        phone: editingCustomer.phone || '',
        email: editingCustomer.email || '',
        customerNumbers: editingCustomer.customerNumbers || {},
        countries: Array.isArray(editingCustomer.countries) && editingCustomer.countries.length
          ? editingCustomer.countries
          : Object.keys(editingCustomer.customerNumbers || {}).filter(k => editingCustomer.customerNumbers[k]),
        ownerCountry: editingCustomer.ownerCountry || userProfile?.businessUnit,
        createdBy: editingCustomer.createdBy || (user?.email || ''),
        createdByName: editingCustomer.createdByName || (userProfile?.name || ''),
        updatedAt: new Date()
      };

      if (editingCustomer.id) {
        await updateDoc(doc(db as Firestore, "customers", editingCustomer.id), customerData);
        setCustomers(prev => prev.map(c => c.id === editingCustomer.id ? { ...customerData, id: editingCustomer.id } as Customer : c));
      } else {
        customerData.createdAt = new Date();
        const withOwner = { ...customerData, ownerCountry: customerData.ownerCountry || userProfile?.businessUnit } as any;
        const docRef = await addDoc(collection(db as Firestore, "customers"), withOwner);
        setCustomers(prev => [...prev, { ...withOwner, id: docRef.id } as Customer]);
      }
      setShowEditModal(null);
      setEditingCustomer(null);
    } catch (error) {
      console.error("Error saving customer:", error);
    }
  };

  if (loading || countriesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Filter countries based on user role
  // Show all countries for everyone so customers appear under their owner country.
  // Editing permissions are enforced per card/modal.
  const availableCountries = countries;

  const createInitialCustomerNumbers = (countries: string[]): { [key: string]: string } => {
    return countries.reduce((acc: { [key: string]: string }, country: string) => {
      acc[country] = "";
      return acc;
    }, {});
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Customers</h1>
        {/* Only show Add Customer button for users who can create customers */}
        {userProfile?.businessUnit && (
        <button
          onClick={() => {
            setEditingCustomer({
              id: "",
              name: "",
              address: "",
              customerNumbers: createInitialCustomerNumbers(availableCountries),
                countries: [userProfile.businessUnit] // Default to user's country
            } as Customer);
            setShowEditModal("new");
          }}
          className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700"
          >
          Add Customer
        </button>
        )}
      </div>

      {/* Display customers grouped by country */}
      {availableCountries.map((country: string) => {
        // Only render country section if there are customers for this country
        const countryCustomers = groupedCustomers[country] || [];
        console.log(`Customers for country ${country}:`, countryCustomers);
        
        return (
          <div key={`country-${country}`} className="mb-8">
            <h2 className="text-xl font-semibold mb-4">{country}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {countryCustomers.length > 0 ? (
                countryCustomers.map(customer => (
                  <div key={`customer-${customer.id}`} className="bg-white p-4 rounded-lg shadow">
                    <h3 className="font-semibold text-lg mb-2">{customer.name}</h3>
                    <p className="text-gray-600 mb-2">{customer.address}</p>
                    {customer.ownerCountry && (
                      <p className="text-xs text-gray-500 mb-1">Owner country: {customer.ownerCountry}</p>
                    )}
                    {customer.createdBy && (
                      <p className="text-xs text-gray-500 mb-3">Created by: {customer.createdByName || customer.createdBy}</p>
                    )}
                    {customer.contact && <p className="text-gray-600 mb-1">Contact: {customer.contact}</p>}
                    {customer.phone && <p className="text-gray-600 mb-1">Phone: {customer.phone}</p>}
                    {customer.email && <p className="text-gray-600 mb-1">Email: {customer.email}</p>}
                    <div className="mt-4 flex justify-end gap-2">
                      {/* Only allow full edit/delete if user owns this customer (creator country) */}
                      {userProfile?.businessUnit && customer.ownerCountry === userProfile.businessUnit && (
                        <>
                          <button
                            onClick={() => {
                          setEditingCustomer(customer);
                          setShowEditModal(customer.id);
                            }}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                          >
                            Edit
                          </button>
                          <button
                        onClick={() => setShowDeleteConfirm(customer.id)}
                        className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </>
                      )}
                      {/* Show read-only indicator for customers from other countries */}
                      {userProfile?.businessUnit && customer.ownerCountry !== userProfile.businessUnit && (
                        <span className="px-3 py-1 text-sm bg-gray-50 text-gray-500 rounded">
                          Read-only
                        </span>
                      )}
                      {/* Non-owner may add their own customer number only */}
                      {userProfile?.businessUnit && customer.ownerCountry !== userProfile.businessUnit && (
                        <button
                          onClick={() => {
                            // Open modal limited to current country number field
                            setEditingCustomer({
                              ...customer,
                              countries: [customer.ownerCountry!],
                              customerNumbers: { ...customer.customerNumbers }
                            });
                            setShowEditModal(customer.id);
                          }}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Add my country number
                        </button>
                      )}
                      {/* Manage Contacts button - always visible */}
                      <button
                        onClick={() => window.location.href = `/customers/${customer.id}`}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        Manage Contacts
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-3 text-center text-gray-500">
                  No customers found for {country}
        </div>
      )}
            </div>
          </div>
        );
      })}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p>Are you sure you want to delete this customer?</p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingCustomer.id ? 'Edit Customer' : 'Add Customer'}
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - General Customer Information */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={editingCustomer.name}
                    onChange={e => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input
                    type="text"
                    value={editingCustomer.address}
                    onChange={e => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={editingCustomer.contact || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, contact: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingCustomer.phone || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={e => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    className="w-full border rounded px-3 py-2"
                  />
                </div>
              </div>

              {/* Right Column - Customer Numbers */}
              <div>
                <label className="block text-sm font-medium mb-3">Customer Numbers</label>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {(userProfile?.businessUnit && editingCustomer.ownerCountry !== userProfile.businessUnit)
                    ? [userProfile.businessUnit].map((country: string) => (
                      <div key={country} className="flex items-center gap-3">
                        <span className="w-32 text-sm font-medium">{country}:</span>
                        <input
                          type="text"
                          value={editingCustomer.customerNumbers[country] || ''}
                          onChange={e => setEditingCustomer({
                            ...editingCustomer,
                            customerNumbers: {
                              ...editingCustomer.customerNumbers,
                              [country]: e.target.value
                            }
                          })}
                          className="flex-1 border rounded px-3 py-2"
                          placeholder="Enter customer number"
                        />
                      </div>
                    ))
                    : availableCountries.map((country: string) => (
                      <div key={country} className="flex items-center gap-3">
                        <span className="w-32 text-sm font-medium">{country}:</span>
                        <input
                          type="text"
                          value={editingCustomer.customerNumbers[country] || ''}
                          onChange={e => setEditingCustomer({
                            ...editingCustomer,
                            customerNumbers: {
                              ...editingCustomer.customerNumbers,
                              [country]: e.target.value
                            }
                          })}
                          className="flex-1 border rounded px-3 py-2"
                          placeholder="Enter customer number"
                        />
                      </div>
                    ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowEditModal(null);
                  setEditingCustomer(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 