"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../AuthProvider";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebaseClient";

export default function UsersPage() {
  const { user, loading, userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [countries, setCountries] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [newCountryName, setNewCountryName] = useState("");
  const [editingCountry, setEditingCountry] = useState<{id: string, name: string} | null>(null);
  
  // User management states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: "",
    email: "",
    role: "readOnly",
    countries: [] as string[],
    businessUnit: ""
  });

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, "users"));
        const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Filter users by current user's countries (like dashboard filtering)
        const userCountries = userProfile?.countries || [];
        const visibleUsers = userCountries.length > 0
          ? allUsers.filter((userData: any) => {
              // Show users that have any country in common with current user
              return userData.countries?.some((country: string) => userCountries.includes(country));
            })
          : allUsers;
        
        setUsers(visibleUsers);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoadingUsers(false);
      }
    };

    if (user && userProfile) {
      fetchUsers();
    }
  }, [user, userProfile]);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const countriesSnap = await getDocs(collection(db, "countries"));
        const countriesData = countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCountries(countriesData);
      } catch (error) {
        console.error("Error fetching countries:", error);
      } finally {
        setLoadingCountries(false);
      }
    };

    if (user) {
      fetchCountries();
    }
  }, [user]);

  const handleCreateCountry = async () => {
    if (!newCountryName.trim()) return;
    
    try {
      await addDoc(collection(db, "countries"), {
        name: newCountryName.trim(),
        createdAt: new Date()
      });
      setNewCountryName("");
      // Refresh countries list
      const countriesSnap = await getDocs(collection(db, "countries"));
      setCountries(countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error creating country:", error);
    }
  };

  const handleUpdateCountry = async () => {
    if (!editingCountry || !editingCountry.name.trim()) return;
    
    try {
      await updateDoc(doc(db, "countries", editingCountry.id), {
        name: editingCountry.name.trim(),
        updatedAt: new Date()
      });
      setEditingCountry(null);
      // Refresh countries list
      const countriesSnap = await getDocs(collection(db, "countries"));
      setCountries(countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error updating country:", error);
    }
  };

  const handleDeleteCountry = async (countryId: string) => {
    if (!confirm("Are you sure you want to delete this country? This action cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db, "countries", countryId));
      // Refresh countries list
      const countriesSnap = await getDocs(collection(db, "countries"));
      setCountries(countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error deleting country:", error);
    }
  };

  // User management functions
  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.displayName.trim()) return;
    
    try {
      await addDoc(collection(db, "users"), {
        ...newUser,
        email: newUser.email.trim(),
        displayName: newUser.displayName.trim(),
        businessUnit: newUser.businessUnit.trim(),
        createdAt: new Date()
      });
      
      // Reset form
      setNewUser({
        displayName: "",
        email: "",
        role: "readOnly",
        countries: [],
        businessUnit: ""
      });
      setShowCreateUser(false);
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const userCountries = userProfile?.countries || [];
      const visibleUsers = userCountries.length > 0
        ? allUsers.filter((userData: any) => {
            return userData.countries?.some((country: string) => userCountries.includes(country));
          })
        : allUsers;
      setUsers(visibleUsers);
    } catch (error) {
      console.error("Error creating user:", error);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editingUser.email.trim() || !editingUser.displayName.trim()) return;
    
    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        displayName: editingUser.displayName.trim(),
        email: editingUser.email.trim(),
        role: editingUser.role,
        countries: editingUser.countries,
        businessUnit: editingUser.businessUnit.trim(),
        updatedAt: new Date()
      });
      
      setEditingUser(null);
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const userCountries = userProfile?.countries || [];
      const visibleUsers = userCountries.length > 0
        ? allUsers.filter((userData: any) => {
            return userData.countries?.some((country: string) => userCountries.includes(country));
          })
        : allUsers;
      setUsers(visibleUsers);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db, "users", userId));
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const userCountries = userProfile?.countries || [];
      const visibleUsers = userCountries.length > 0
        ? allUsers.filter((userData: any) => {
            return userData.countries?.some((country: string) => userCountries.includes(country));
          })
        : allUsers;
      setUsers(visibleUsers);
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  // Check if user has permission to view and manage users
  const canViewUsers = userProfile?.role === "admin" || userProfile?.role === "superAdmin";
  const canManageUsers = userProfile?.role === "admin" || userProfile?.role === "superAdmin";
  const canManageCountries = userProfile?.role === "admin" || userProfile?.role === "superAdmin";
  
  if (!canViewUsers) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e40115] mb-4">Users</h1>
        <p className="text-gray-600">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-6">Users Management</h1>
      
      {loadingUsers ? (
        <div className="text-center py-4">Loading users...</div>
      ) : (
        <div className="card-modern">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Users List</h2>
            {canManageUsers && (
              <button
                onClick={() => setShowCreateUser(true)}
                className="btn-modern btn-modern-primary"
              >
                Add New User
              </button>
            )}
          </div>
          
          {users.length === 0 ? (
            <p className="text-gray-600">No users found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold">Name</th>
                    <th className="text-left py-3 px-4 font-semibold">Email</th>
                    <th className="text-left py-3 px-4 font-semibold">Role</th>
                    <th className="text-left py-3 px-4 font-semibold">Countries</th>
                    <th className="text-left py-3 px-4 font-semibold">Business Unit</th>
                    {canManageUsers && <th className="text-left py-3 px-4 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((userData) => (
                    <tr key={userData.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{userData.displayName || "—"}</td>
                      <td className="py-3 px-4">{userData.email || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`pill-modern ${
                          userData.role === "superAdmin" ? "bg-red-600" :
                          userData.role === "admin" ? "bg-orange-500" :
                          "bg-blue-500"
                        }`}>
                          {userData.role || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {userData.countries && userData.countries.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {userData.countries.map((country: string, index: number) => (
                              <span key={index} className="pill-modern bg-gray-500 text-xs">
                                {country}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4">{userData.businessUnit || "—"}</td>
                      {canManageUsers && (
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingUser({...userData})}
                              className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(userData.id)}
                              className="text-red-600 hover:text-red-800 font-medium text-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && canManageUsers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Create New User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={newUser.displayName}
                  onChange={(e) => setNewUser({...newUser, displayName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                >
                  <option value="readOnly">Read Only</option>
                  <option value="admin">Admin</option>
                  <option value="superAdmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Business Unit</label>
                <input
                  type="text"
                  value={newUser.businessUnit}
                  onChange={(e) => setNewUser({...newUser, businessUnit: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateUser}
                disabled={!newUser.email.trim() || !newUser.displayName.trim()}
                className="flex-1 btn-modern btn-modern-primary disabled:opacity-50"
              >
                Create User
              </button>
              <button
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUser({
                    displayName: "",
                    email: "",
                    role: "readOnly",
                    countries: [],
                    businessUnit: ""
                  });
                }}
                className="flex-1 btn-modern btn-modern-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && canManageUsers && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={editingUser.displayName || ""}
                  onChange={(e) => setEditingUser({...editingUser, displayName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email || ""}
                  onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={editingUser.role || "readOnly"}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                >
                  <option value="readOnly">Read Only</option>
                  <option value="admin">Admin</option>
                  <option value="superAdmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Business Unit</label>
                <input
                  type="text"
                  value={editingUser.businessUnit || ""}
                  onChange={(e) => setEditingUser({...editingUser, businessUnit: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleUpdateUser}
                disabled={!editingUser.email?.trim() || !editingUser.displayName?.trim()}
                className="flex-1 btn-modern btn-modern-primary disabled:opacity-50"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingUser(null)}
                className="flex-1 btn-modern btn-modern-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Countries Management Section */}
      {canManageCountries && (
        <div className="card-modern mt-8">
          <h2 className="text-lg font-semibold mb-4">Countries Management</h2>
        
        {/* Add New Country */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-md font-medium mb-3">Add New Country</h3>
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Country name"
              value={newCountryName}
              onChange={(e) => setNewCountryName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateCountry();
                }
              }}
            />
            <button
              onClick={handleCreateCountry}
              disabled={!newCountryName.trim()}
              className="btn-modern btn-modern-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Country
            </button>
          </div>
        </div>

        {/* Countries List */}
        {loadingCountries ? (
          <div className="text-center py-4">Loading countries...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-semibold">Country Name</th>
                  <th className="text-left py-3 px-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {countries.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="py-4 px-4 text-gray-600 text-center">
                      No countries found. Add one above.
                    </td>
                  </tr>
                ) : (
                  countries.map((country) => (
                    <tr key={country.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        {editingCountry?.id === country.id ? (
                          <input
                            type="text"
                            value={editingCountry?.name || ""}
                            onChange={(e) => setEditingCountry(editingCountry ? {...editingCountry, name: e.target.value} : null)}
                            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleUpdateCountry();
                              } else if (e.key === "Escape") {
                                setEditingCountry(null);
                              }
                            }}
                            autoFocus
                          />
                        ) : (
                          country.name
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          {editingCountry?.id === country.id ? (
                            <>
                              <button
                                onClick={handleUpdateCountry}
                                className="text-green-600 hover:text-green-800 font-medium text-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCountry(null)}
                                className="text-gray-600 hover:text-gray-800 font-medium text-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setEditingCountry({id: country.id, name: country.name})}
                                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteCountry(country.id)}
                                className="text-red-600 hover:text-red-800 font-medium text-sm"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
              </div>
      )}
    </div>
  );
} 