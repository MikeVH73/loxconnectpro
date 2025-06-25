"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import Link from "next/link";
import { useAuth } from "../AuthProvider";

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
  customerNumbers?: { [country: string]: string };
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [countries, setCountries] = useState<string[]>([]);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [customersSnap, countriesSnap] = await Promise.all([
        getDocs(query(collection(db, "customers"), orderBy("name"))),
        getDocs(collection(db, "countries"))
      ]);
      
      const countriesList = countriesSnap.docs.map(doc => doc.data().name);
      setCountries(countriesList);
      
      setCustomers(customersSnap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        customerNumbers: doc.data().customerNumbers || {} 
      } as Customer)));
      
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleDelete = async (customerId: string) => {
    try {
      await deleteDoc(doc(db, "customers", customerId));
      setCustomers(prev => prev.filter(c => c.id !== customerId));
      setDeleteSuccess("Customer deleted successfully");
      setShowDeleteConfirm(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setDeleteSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting customer:", error);
      setDeleteError("Failed to delete customer. Please try again.");
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setDeleteError("");
      }, 3000);
    }
  };

  const handleEdit = async () => {
    if (!editingCustomer) return;

    try {
      await updateDoc(doc(db, "customers", editingCustomer.id), {
        name: editingCustomer.name,
        address: editingCustomer.address,
        contact: editingCustomer.contact || "",
        phone: editingCustomer.phone || "",
        email: editingCustomer.email || "",
        customerNumbers: editingCustomer.customerNumbers || {}
      });

      setCustomers(prev => 
        prev.map(c => c.id === editingCustomer.id ? editingCustomer : c)
      );

      setEditSuccess("Customer updated successfully");
      setShowEditModal(false);
      setEditingCustomer(null);

      // Clear success message after 3 seconds
      setTimeout(() => {
        setEditSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error updating customer:", error);
      setEditError("Failed to update customer. Please try again.");

      // Clear error message after 3 seconds
      setTimeout(() => {
        setEditError("");
      }, 3000);
    }
  };

  const canManageCustomers = userProfile?.role === "admin" || userProfile?.role === "superAdmin";

  return (
    <div className="p-8">
      {deleteError && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          {deleteError}
        </div>
      )}
      {deleteSuccess && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
          {deleteSuccess}
        </div>
      )}
      {editError && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          {editError}
        </div>
      )}
      {editSuccess && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
          {editSuccess}
        </div>
      )}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-[#e40115]">Customers</h1>
        {canManageCustomers && (
          <Link
            href="/customers/new"
            className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 transition"
          >
            + New Customer
          </Link>
        )}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : customers.length === 0 ? (
        <div>No customers found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Address</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Customer Numbers</th>
                <th className="px-4 py-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.id} className="border-t">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2">{c.address}</td>
                  <td className="px-4 py-2">{c.contact || '—'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-col gap-1">
                      {Object.entries(c.customerNumbers || {}).map(([country, number]) => (
                        <div key={country} className="text-sm">
                          <span className="font-medium">{country}:</span> {number}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-2">
                      <Link href={`/customers/${c.id}`} className="text-blue-600 hover:text-blue-800">
                        View
                      </Link>
                      {canManageCustomers && (
                        <>
                          <button
                            onClick={() => {
                              setEditingCustomer(c);
                              setShowEditModal(true);
                            }}
                            className="text-orange-600 hover:text-orange-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(c.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Customer</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this customer? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h3 className="text-lg font-semibold mb-4">Edit Customer</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    value={editingCustomer.name}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Address</label>
                  <input
                    type="text"
                    value={editingCustomer.address}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Name</label>
                  <input
                    type="text"
                    value={editingCustomer.contact || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, contact: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={editingCustomer.phone || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={editingCustomer.email || ''}
                    onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Customer Numbers</label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {countries.map(country => (
                    <div key={country} className="flex gap-2 items-center">
                      <span className="w-24 text-sm font-medium">{country}:</span>
                      <input
                        type="text"
                        value={editingCustomer.customerNumbers?.[country] || ''}
                        onChange={(e) => {
                          const newNumbers = {
                            ...editingCustomer.customerNumbers,
                            [country]: e.target.value
                          };
                          setEditingCustomer({
                            ...editingCustomer,
                            customerNumbers: newNumbers
                          });
                        }}
                        placeholder={`${country} Number`}
                        className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-4 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCustomer(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700 font-medium"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 