"use client";
import { useEffect, useState } from "react";
import { FiEdit, FiKey, FiMail, FiUserCheck, FiShieldOff, FiTrash2, FiZap } from "react-icons/fi";
import { getAuth } from "firebase/auth";
import { useAuth } from "../AuthProvider";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, Firestore } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { db, auth } from "../../firebaseClient";
import { checkAndFixUserProfiles } from "../utils/userProfileFixer";

export default function UsersPage() {
  const { user, loading, userProfile } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [countries, setCountries] = useState<any[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [newCountryName, setNewCountryName] = useState("");
  const [editingCountry, setEditingCountry] = useState<{id: string, name: string} | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // User management states
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: "",
    email: "",
    password: "",
    role: "Employee",
    countries: [] as string[],
  });
  const [fixingProfiles, setFixingProfiles] = useState(false);
  const [resettingPassword, setResettingPassword] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db as Firestore, "users"));
        let allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
        // SuperAdmin: augment with MFA status via Admin SDK API route
        if (userProfile?.role === 'superAdmin' && allUsers.length > 0) {
          try {
            const uids = allUsers.map(u => u.id);
            const res = await fetch('/api/admin/mfa-status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uids }) });
            const data = await res.json();
            if (res.ok && data?.statuses) {
              allUsers = allUsers.map(u => ({ ...u, mfaEnabled: Boolean(data.statuses[u.id]) }));
            }
          } catch {}
        }
        
        // If user is superAdmin, show all users
        if (userProfile?.role === "superAdmin") {
          setUsers(allUsers);
          return;
        }
        
        // Otherwise, filter users by current user's countries
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
        const countriesSnap = await getDocs(collection(db as Firestore, "countries"));
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
      await addDoc(collection(db as Firestore, "countries"), {
        name: newCountryName.trim(),
        createdAt: new Date()
      });
      setNewCountryName("");
      // Refresh countries list
      const countriesSnap = await getDocs(collection(db as Firestore, "countries"));
      setCountries(countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error creating country:", error);
    }
  };

  const handleUpdateCountry = async () => {
    if (!editingCountry || !editingCountry.name.trim()) return;
    
    const oldName = countries.find(c => c.id === editingCountry.id)?.name;
    const newName = editingCountry.name.trim();
    
    // Check if name actually changed
    if (oldName === newName) {
      setEditingCountry(null);
      return;
    }
    
    if (!window.confirm(`Are you sure you want to rename "${oldName}" to "${newName}"?\n\nThis will update ALL existing Quote Requests and User profiles that reference this country. This action cannot be undone.`)) {
      return;
    }
    
    try {
      setSubmitting(true);
      
      // First update the country in the countries collection
      await updateDoc(doc(db as Firestore, "countries", editingCountry.id), {
        name: newName,
        updatedAt: new Date()
      });
      
      // Then migrate all existing data
      console.log(`[Migration] Starting migration from "${oldName}" to "${newName}"`);
      const migrationResult = await migrateCountryData(oldName!, newName);
      
      setEditingCountry(null);
      setSuccess(`Country updated successfully! Migrated ${migrationResult.quoteRequests} quote requests and ${migrationResult.users} user profiles.`);
      
      // Refresh countries list
      const countriesSnap = await getDocs(collection(db as Firestore, "countries"));
      setCountries(countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // Refresh users list to show updated data
      const usersSnap = await getDocs(collection(db as Firestore, "users"));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      const userCountries = userProfile?.countries || [];
      const visibleUsers = userCountries.length > 0
        ? allUsers.filter((userData: any) => {
            return userData.countries?.some((country: string) => userCountries.includes(country));
          })
        : allUsers;
      setUsers(visibleUsers);
      
    } catch (error) {
      console.error("Error updating country:", error);
      setError(`Failed to update country: ${error}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCountry = async (countryId: string) => {
    if (!confirm("Are you sure you want to delete this country? This action cannot be undone.")) return;
    
    try {
      await deleteDoc(doc(db as Firestore, "countries", countryId));
      // Refresh countries list
      const countriesSnap = await getDocs(collection(db as Firestore, "countries"));
      setCountries(countriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error deleting country:", error);
    }
  };

  // User management functions
  const handleCreateUser = async () => {
    if (!newUser.email.trim() || !newUser.displayName.trim() || !newUser.password.trim()) {
      setError("Please fill in all required fields (Name, Email, Password)");
      return;
    }
    
    if (newUser.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }
    
    // Prompt for admin password to re-authenticate later
    setShowPasswordPrompt(true);
  };

  const handleCreateUserWithPassword = async () => {
    if (!adminPassword.trim()) {
      setError("Please enter your admin password to continue");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      
      // Store current user info
      const currentUser = (auth as any)?.currentUser;
      const currentUserEmail = currentUser?.email;
      
      if (!currentUserEmail) {
        setError("No current user found");
        return;
      }
      
      // Create Firebase Authentication account (this will sign in the new user)
      const userCredential = await createUserWithEmailAndPassword(
        auth as any,
        newUser.email.trim(), 
        newUser.password.trim()
      );
      
      // Update the user profile with display name
      await updateProfile(userCredential.user, {
        displayName: newUser.displayName.trim()
      });
      
      // Create Firestore user document with the Firebase Auth UID as document ID
      await setDoc(doc(db as Firestore, "users", userCredential.user.uid), {
        displayName: newUser.displayName.trim(),
        name: newUser.displayName.trim(), // Add name field for compatibility
        email: newUser.email.trim(),
        role: newUser.role,
        countries: newUser.countries,
        businessUnit: newUser.countries.length > 0 ? newUser.countries[0] : 'Unknown', // Add businessUnit
        uid: userCredential.user.uid,
        createdAt: new Date()
      });
      
      // Sign out the newly created user
      await signOut(auth as any);
      
      // Re-authenticate the original admin user
      await signInWithEmailAndPassword(auth as any, currentUserEmail, adminPassword);
      
      // Reset form and close modals
      setNewUser({
        displayName: "",
        email: "",
        password: "",
        role: "Employee",
        countries: [],
      });
      setAdminPassword("");
      setShowCreateUser(false);
      setShowPasswordPrompt(false);
      setSuccess(`User ${newUser.displayName} created successfully!`);
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db as Firestore, "users"));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const userCountries = userProfile?.countries || [];
      const visibleUsers = userCountries.length > 0
        ? allUsers.filter((userData: any) => {
            return userData.countries?.some((country: string) => userCountries.includes(country));
          })
        : allUsers;
      setUsers(visibleUsers);
      
    } catch (error: any) {
      console.error("Error creating user:", error);
      if (error.code === 'auth/email-already-in-use') {
        setError("This email address is already registered. Please use a different email.");
      } else if (error.code === 'auth/invalid-email') {
        setError("Please enter a valid email address.");
      } else if (error.code === 'auth/weak-password') {
        setError("Password is too weak. Please use at least 6 characters.");
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setError("Incorrect admin password. Please try again.");
      } else {
        setError(`Failed to create user: ${error.message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editingUser || !editingUser.email.trim() || !editingUser.displayName.trim()) return;
    
    try {
      await updateDoc(doc(db as Firestore, "users", editingUser.id), {
        displayName: editingUser.displayName.trim(),
        email: editingUser.email.trim(),
        role: editingUser.role,
        countries: editingUser.countries,
        updatedAt: new Date()
      });
      
      setEditingUser(null);
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db as Firestore, "users"));
      const allUsers = usersSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
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
      await deleteDoc(doc(db as Firestore, "users", userId));
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db as Firestore, "users"));
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

  const handleFixUserProfiles = async () => {
    try {
      setFixingProfiles(true);
      setError("");
      setSuccess("");
      
      const results = await checkAndFixUserProfiles();
      
      if (results.errors.length > 0) {
        setError(`Fixed ${results.fixedUsers} users but encountered ${results.errors.length} errors. Check console for details.`);
      } else {
        setSuccess(`Successfully fixed ${results.fixedUsers} out of ${results.totalUsers} user profiles!`);
      }
      
      // Refresh users list
      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // If user is superAdmin, show all users
      if (userProfile?.role === "superAdmin") {
        setUsers(allUsers);
      } else {
        // Otherwise, filter users by current user's countries
        const userCountries = userProfile?.countries || [];
        const visibleUsers = userCountries.length > 0
          ? allUsers.filter((userData: any) => {
              // Show users that have any country in common with current user
              return userData.countries?.some((country: string) => userCountries.includes(country));
            })
          : allUsers;
        setUsers(visibleUsers);
      }
      
    } catch (error) {
      console.error("Error fixing user profiles:", error);
      setError("Failed to fix user profiles");
    } finally {
      setFixingProfiles(false);
    }
  };

  // Create temporary password for a user
  const handleCreateTemporaryPassword = async (userId: string, userEmail: string, userCountries: string[]) => {
    try {
      setResettingPassword(userId);
      setError("");
      setSuccess("");

      // Check authorization
      if (userProfile?.role === "superAdmin") {
        // superAdmin can reset password for any user
      } else if (userProfile?.role === "admin") {
        // admin can only reset password for users in the same country
        const currentUserCountries = userProfile?.countries || [];
        const hasCommonCountry = currentUserCountries.some(country => 
          userCountries.includes(country)
        );
        if (!hasCommonCountry) {
          setError("You can only reset passwords for users in your country");
          return;
        }
      } else {
        setError("You don't have permission to reset passwords");
        return;
      }

      // Reset via secure server API using Admin SDK
      
      // Store current user info for re-authentication
      const currentUser = auth.currentUser;
      const currentUserEmail = currentUser?.email;
      
      if (!currentUserEmail) {
        setError("No current user found");
        return;
      }

      // Get admin password for re-authentication (client-only step)
      const adminPassword = prompt("Please enter your admin password to reset the user's password:");
      if (!adminPassword) {
        setError("Admin password required to reset user password");
        return;
      }

      try {
        // Re-authenticate admin user
        await signInWithEmailAndPassword(auth, currentUserEmail, adminPassword);

        // Call secure API to reset the target user's password
        const res = await fetch('/api/users/reset-password', { method: 'POST', body: JSON.stringify({ uid: userId }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Reset failed');

        const tempPassword = json.tempPassword as string;

        // Store audit trail only (never store passwords in Firestore)
        await updateDoc(doc(db as Firestore, "users", userId), {
          passwordResetAt: new Date(),
          passwordResetBy: userProfile?.email || 'unknown',
          passwordResetRequired: true,
        });

        setSuccess(`Temporary password created for ${userEmail}: ${tempPassword}. Ask the user to log in with it and change immediately.`);
        
      } catch (authError: any) {
        console.error("Authentication error:", authError);
        if (authError.code === 'auth/wrong-password' || authError.code === 'auth/invalid-credential') {
          setError("Incorrect admin password. Please try again.");
        } else {
          setError(`Authentication failed: ${authError.message}`);
        }
      }
      
    } catch (error: any) {
      console.error("Error creating temporary password:", error);
      setError(`Failed to create temporary password: ${error.message}`);
    } finally {
      setResettingPassword(null);
    }
  };

  // Handle country checkbox toggle for new user
  const handleNewUserCountryToggle = (countryName: string) => {
    setNewUser(prev => ({
      ...prev,
      countries: prev.countries.includes(countryName)
        ? prev.countries.filter(c => c !== countryName)
        : [...prev.countries, countryName]
    }));
  };

  // Handle country checkbox toggle for editing user
  const handleEditUserCountryToggle = (countryName: string) => {
    if (!editingUser) return;
    setEditingUser(prev => ({
      ...prev,
      countries: (prev.countries || []).includes(countryName)
        ? (prev.countries || []).filter(c => c !== countryName)
        : [...(prev.countries || []), countryName]
    }));
  };

  // Data migration function for country name changes
  const migrateCountryData = async (oldName: string, newName: string) => {
    try {
      console.log(`[Migration] Starting migration from "${oldName}" to "${newName}"`);
      
      // Update all quote requests
      const qrSnapshot = await getDocs(collection(db as Firestore, "quoteRequests"));
      const qrUpdates = [];
      
      for (const qrDoc of qrSnapshot.docs) {
        const data = qrDoc.data();
        const needsUpdate = data.creatorCountry === oldName || data.involvedCountry === oldName;
        
        if (needsUpdate) {
          const updates: any = {};
          if (data.creatorCountry === oldName) updates.creatorCountry = newName;
          if (data.involvedCountry === oldName) updates.involvedCountry = newName;
          qrUpdates.push(updateDoc(doc(db, "quoteRequests", qrDoc.id), updates));
        }
      }
      
      // Update all user profiles
      const usersSnapshot = await getDocs(collection(db as Firestore, "users"));
      const userUpdates = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const data = userDoc.data();
        const needsUpdate = data.country === oldName || 
                           data.businessUnit === oldName || 
                           (data.countries && data.countries.includes(oldName));
        
        if (needsUpdate) {
          const updates: any = {};
          if (data.country === oldName) updates.country = newName;
          if (data.businessUnit === oldName) updates.businessUnit = newName;
          if (data.countries && data.countries.includes(oldName)) {
            updates.countries = data.countries.map((c: string) => c === oldName ? newName : c);
          }
          userUpdates.push(updateDoc(doc(db as Firestore, "users", userDoc.id), updates));
        }
      }
      
      // Execute all updates
      await Promise.all([...qrUpdates, ...userUpdates]);
      
      console.log(`[Migration] Completed migration: ${qrUpdates.length} quote requests, ${userUpdates.length} users updated`);
      return { quoteRequests: qrUpdates.length, users: userUpdates.length };
      
    } catch (error) {
      console.error("[Migration] Error during migration:", error);
      throw error;
    }
  };

  // Data consistency checker for analytics and debugging
  const checkDataConsistency = async () => {
    try {
      setSubmitting(true);
      console.log("[Data Consistency] Starting comprehensive data check...");
      
      // Get all countries
      const countriesSnap = await getDocs(collection(db as Firestore, "countries"));
      const validCountries = countriesSnap.docs.map(doc => doc.data().name);
      console.log("[Data Consistency] Valid countries:", validCountries);
      
      // Check Quote Requests
      const qrSnapshot = await getDocs(collection(db, "quoteRequests"));
      const orphanedQuoteRequests = [];
      
      for (const qrDoc of qrSnapshot.docs) {
        const data = qrDoc.data();
        const creatorCountryValid = validCountries.some(c => 
          c === data.creatorCountry || c.includes(data.creatorCountry) || data.creatorCountry?.includes(c)
        );
        const involvedCountryValid = validCountries.some(c => 
          c === data.involvedCountry || c.includes(data.involvedCountry) || data.involvedCountry?.includes(c)
        );
        
        if (!creatorCountryValid || !involvedCountryValid) {
          orphanedQuoteRequests.push({
            id: qrDoc.id,
            creatorCountry: data.creatorCountry,
            involvedCountry: data.involvedCountry,
            creatorValid: creatorCountryValid,
            involvedValid: involvedCountryValid
          });
        }
      }
      
      // Check User Profiles
      const usersSnapshot = await getDocs(collection(db, "users"));
      const orphanedUsers = [];
      
      for (const userDoc of usersSnapshot.docs) {
        const data = userDoc.data();
        const userCountries = data.countries || [];
        const invalidCountries = userCountries.filter((userCountry: string) => 
          !validCountries.some(c => c === userCountry || c.includes(userCountry) || userCountry.includes(c))
        );
        
        if (invalidCountries.length > 0) {
          orphanedUsers.push({
            id: userDoc.id,
            email: data.email,
            countries: userCountries,
            invalidCountries
          });
        }
      }
      
      const report = {
        validCountries,
        totalQuoteRequests: qrSnapshot.docs.length,
        orphanedQuoteRequests: orphanedQuoteRequests.length,
        totalUsers: usersSnapshot.docs.length,
        orphanedUsers: orphanedUsers.length,
        details: {
          orphanedQuoteRequests,
          orphanedUsers
        }
      };
      
      console.log("[Data Consistency] Full Report:", report);
      setSuccess(`Data Consistency Check Complete:\n✅ ${validCountries.length} countries\n📊 ${qrSnapshot.docs.length} quote requests (${orphanedQuoteRequests.length} inconsistent)\n👥 ${usersSnapshot.docs.length} users (${orphanedUsers.length} inconsistent)\n\nCheck browser console for detailed report.`);
      
      return report;
      
    } catch (error) {
      console.error("[Data Consistency] Error during check:", error);
      setError(`Data consistency check failed: ${error}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
    setShowCreateUser(false);
    setNewUser({
      displayName: "",
      email: "",
      password: "",
      role: "Employee",
      countries: [],
    });
    setError("");
    setSuccess("");
  };

  // Function to detect and fix duplicate users
  const handleFixDuplicateUsers = async () => {
    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      if (!db) {
        setError("Firebase not initialized");
        return;
      }

      // Get all users
      const snapshot = await getDocs(collection(db as Firestore, "users"));
      const allUsers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Find duplicates by email
      const emailGroups = allUsers.reduce((acc, user) => {
        const email = user.email?.toLowerCase().trim();
        if (email) {
          if (!acc[email]) {
            acc[email] = [];
          }
          acc[email].push(user);
        }
        return acc;
      }, {} as Record<string, any[]>);

      // Find duplicates
      const duplicates = Object.entries(emailGroups)
        .filter(([email, users]) => users.length > 1)
        .map(([email, users]) => ({ email, users }));

      if (duplicates.length === 0) {
        setSuccess("No duplicate users found.");
        return;
      }

      // Remove duplicates, keeping the first one (usually the one with UID as document ID)
      let removedCount = 0;
      for (const { email, users } of duplicates) {
        // Sort by document ID - UID-based documents usually come first
        users.sort((a, b) => a.id.localeCompare(b.id));
        
        // Keep the first one, remove the rest
        const toRemove = users.slice(1);
        for (const user of toRemove) {
          await deleteDoc(doc(db as Firestore, "users", user.id));
          removedCount++;
        }
      }

      setSuccess(`Fixed ${removedCount} duplicate users. Kept the first occurrence of each email.`);

      // Refresh users list
      const newSnapshot = await getDocs(collection(db as Firestore, "users"));
      const newUsers = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const userCountries = userProfile?.countries || [];
      const visibleUsers = userCountries.length > 0
        ? newUsers.filter((userData: any) => {
            return userData.countries?.some((country: string) => userCountries.includes(country));
          })
        : newUsers;
      setUsers(visibleUsers);

    } catch (error: any) {
      console.error("Error fixing duplicate users:", error);
      setError(`Failed to fix duplicate users: ${error.message}`);
    } finally {
      setSubmitting(false);
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <div className="flex gap-2">
          <button
            onClick={handleFixDuplicateUsers}
            disabled={submitting}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
          >
            {submitting ? "Fixing..." : "Fix Duplicate Users"}
          </button>
          <button
            onClick={handleFixUserProfiles}
            disabled={fixingProfiles}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {fixingProfiles ? "Fixing..." : "Fix User Profiles"}
          </button>
          <button
            onClick={() => setShowCreateUser(true)}
            className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700"
          >
            Add User
          </button>
        </div>
      </div>
      
      {loadingUsers ? (
        <div className="text-center py-4">Loading users...</div>
      ) : (
        <div className="card-modern">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Users List</h2>
            <div className="flex gap-2">
            {canManageUsers && (
                <>
                  <button
                    onClick={handleFixUserProfiles}
                    disabled={fixingProfiles}
                    className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 transition font-semibold disabled:opacity-50"
                  >
                    {fixingProfiles ? "Fixing..." : "Fix User Profiles"}
                  </button>
              <button
                onClick={() => {
                  // Reset form completely when opening modal
                  setNewUser({
                    displayName: "",
                    email: "",
                    password: "",
                        role: "Employee",
                    countries: [],
                  });
                  setError("");
                  setShowCreateUser(true);
                }}
                className="bg-[#e40115] text-white px-4 py-2 rounded-md hover:bg-[#c7010e] transition font-semibold"
              >
                Add New User
              </button>
                </>
            )}
            </div>
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
                    {canManageUsers && <th className="text-left py-3 px-4 font-semibold">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                   {users.map((userData) => {
                    const normalizedRole = userData.role === 'readOnly' || userData.role === 'user' ? 'Employee' : userData.role;
                     const mfaStatus = (userData as any).mfaEnabled as boolean | undefined;
                    return (
                    <tr key={userData.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">{userData.displayName || "—"}</td>
                      <td className="py-3 px-4">{userData.email || "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`pill-modern ${
                          normalizedRole === "superAdmin" ? "bg-red-600" :
                          normalizedRole === "admin" ? "bg-orange-500" :
                          normalizedRole === "Employee" ? "bg-green-500" :
                          "bg-gray-500"
                        }`}>
                          {normalizedRole || "—"}
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
                          <span className="text-gray-400">No countries assigned</span>
                        )}
                         {userProfile?.role === 'superAdmin' && (
                           <div className="mt-1 text-xs">
                             {mfaStatus === true && <span className="text-green-700">MFA: Enabled</span>}
                             {mfaStatus === false && <span className="text-red-700">MFA: Not enabled</span>}
                           </div>
                         )}
                      </td>
                      {canManageUsers && (
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-2">
                            {/* 1) Edit - Dark Grey */}
                            <button
                              onClick={() => setEditingUser({...userData})}
                              className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1"
                            >
                              <FiEdit /> Edit
                            </button>
                            {/* 2) Reset Password - Black */}
                            {(userProfile?.role === "admin" || userProfile?.role === "superAdmin") && (
                              <button
                                onClick={async () => {
                                  try {
                                    setResettingPassword(userData.id);
                                    const res = await fetch('/api/admin/password-reset', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ uid: userData.id, email: userData.email })
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data?.error || 'Failed');
                                    const link: string = data?.link || '';
                                    if (link) {
                                      window.prompt('Copy password reset link for ' + (userData.email || 'user'), link);
                                    } else {
                                      alert('Reset link generated but not returned. Check console.');
                                      console.log('Reset link response:', data);
                                    }
                                  } catch (e: any) {
                                    alert(e?.message || 'Failed to generate reset link');
                                  } finally {
                                    setResettingPassword(null);
                                  }
                                }}
                                disabled={resettingPassword === userData.id}
                                className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                <FiKey /> {resettingPassword === userData.id ? "Creating..." : "Reset Password"}
                              </button>
                            )}
                            {/* SuperAdmin: Send MFA reminder */}
                            {userProfile?.role === 'superAdmin' && (
                              <button
                                onClick={async () => {
                                  try {
                                    const res = await fetch('/api/admin/send-mfa-reminder', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ uid: userData.id, email: userData.email })
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data?.error || 'Failed');
                                    const url: string = data?.securityUrl || '';
                                    window.prompt('Send this link to the user to enroll MFA', url);
                                  } catch (e: any) {
                                    alert(e?.message || 'Failed to send MFA reminder');
                                  }
                                }}
                                className="px-3 py-1 rounded text-sm bg-[#bbbdbe] hover:bg-[#aeb0b1] text-gray-900"
                              >
                                Send MFA Reminder
                              </button>
                            )}
                            {/* 3) Send Verification - Light Grey */}
                            {userProfile?.role === 'superAdmin' && (
                              <>
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch('/api/admin/send-verification', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ uid: userData.id, email: userData.email })
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data?.error || 'Failed');
                                      const link: string = data?.link || '';
                                      if (link) {
                                        window.prompt('Copy verification link for ' + (userData.email || 'user'), link);
                                      } else {
                                        alert('Verification link generated but not returned. Check console.');
                                        console.log('Verification link response:', data);
                                      }
                                    } catch (e: any) {
                                      alert(e?.message || 'Failed to send verification');
                                    }
                                  }}
                                  className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1"
                                >
                                  <FiMail /> Send Verification Email
                                </button>
                                {/* 4) Update Auth Email - Light Grey */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const newEmail = window.prompt('Enter new email for this user', userData.email || '');
                                      if (!newEmail || !newEmail.includes('@')) return;
                                      const res = await fetch('/api/admin/update-email', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ uid: userData.id, newEmail })
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data?.error || 'Failed');
                                      window.prompt('Copy verification link for ' + newEmail, data.link);
                                    } catch (e: any) {
                                      alert(e?.message || 'Failed to update email');
                                    }
                                  }}
                                  className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1"
                                >
                                  <FiUserCheck /> Update Auth Email
                                </button>
                                {/* 5) Grant 1-time Bypass - Dark Grey */}
                                <button
                                  onClick={async () => {
                                    try {
                                      const res = await fetch('/api/admin/bypass', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ uid: userData.id, enabled: true })
                                      });
                                      const data = await res.json();
                                      if (!res.ok) throw new Error(data?.error || 'Failed');
                                      alert('Granted one-time bypass. Remember to remove it after first sign-in.');
                                    } catch (e: any) {
                                      alert(e?.message || 'Failed to set bypass');
                                    }
                                  }}
                                  className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1"
                                >
                                  <FiShieldOff /> Grant 1-time Bypass
                                </button>
                              </>
                            )}
                            {/* 6) Set Temp Password - Red */}
                            {(userProfile?.role === "admin" || userProfile?.role === "superAdmin") && (
                              <button
                                onClick={async () => {
                                  try {
                                    setResettingPassword(userData.id);
                                    const res = await fetch('/api/admin/set-temp-password', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ uid: userData.id, email: userData.email })
                                    });
                                    const data = await res.json();
                                    if (!res.ok) throw new Error(data?.error || 'Failed');
                                    const pwd: string = data?.tempPassword || '';
                                    window.prompt('Copy temporary password for ' + (userData.email || 'user'), pwd);
                                  } catch (e: any) {
                                    alert(e?.message || 'Failed to set temp password');
                                  } finally {
                                    setResettingPassword(null);
                                  }
                                }}
                                disabled={resettingPassword === userData.id}
                                className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1 disabled:opacity-50"
                              >
                                <FiZap /> Set Temp Password
                              </button>
                            )}
                            {/* 7) Delete - Red */}
                            <button
                              onClick={() => handleDeleteUser(userData.id)}
                              className="px-3 py-1 rounded text-sm bg-[#cccdce] hover:bg-[#bbbdbe] text-gray-900 inline-flex items-center gap-1"
                            >
                              <FiTrash2 /> Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );})}
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
                  autoComplete="new-password"
                  placeholder="Enter email address"
                  name="new-user-email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
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
                  <option value="Employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="superAdmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Countries Responsible For</label>
                <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                  {loadingCountries ? (
                    <div className="text-sm text-gray-500">Loading countries...</div>
                  ) : countries.length === 0 ? (
                    <div className="text-sm text-gray-500">No countries available</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {countries.map((country) => (
                        <label key={country.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newUser.countries.includes(country.name)}
                            onChange={() => handleNewUserCountryToggle(country.name)}
                            className="rounded border-gray-300 text-[#e40115] focus:ring-[#e40115]"
                          />
                          <span className="text-sm">{country.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  User will see Quote Requests where selected countries are creator or involved country
                </div>
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
                  // Reset form completely
                  setNewUser({
                    displayName: "",
                    email: "",
                    password: "",
                    role: "Employee",
                    countries: [],
                  });
                  setError("");
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
                  value={editingUser.role || "Employee"}
                  onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                >
                  <option value="Employee">Employee</option>
                  <option value="admin">Admin</option>
                  <option value="superAdmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Countries Responsible For</label>
                <div className="border border-gray-300 rounded-md p-3 max-h-40 overflow-y-auto">
                  {loadingCountries ? (
                    <div className="text-sm text-gray-500">Loading countries...</div>
                  ) : countries.length === 0 ? (
                    <div className="text-sm text-gray-500">No countries available</div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {countries.map((country) => (
                        <label key={country.id} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(editingUser.countries || []).includes(country.name)}
                            onChange={() => handleEditUserCountryToggle(country.name)}
                            className="rounded border-gray-300 text-[#e40115] focus:ring-[#e40115]"
                          />
                          <span className="text-sm">{country.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  User will see Quote Requests where selected countries are creator or involved country
                </div>
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
                onClick={handleCancel}
                className="flex-1 btn-modern btn-modern-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Confirm Admin Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              To create a new user, please enter your admin password to maintain security.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Your Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                  placeholder="Enter your admin password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateUserWithPassword();
                    }
                  }}
                />
              </div>
            </div>
            {error && (
              <div className="mt-3 p-2 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
                {error}
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleCreateUserWithPassword}
                disabled={!adminPassword.trim() || submitting}
                className="flex-1 btn-modern btn-modern-primary disabled:opacity-50"
              >
                {submitting ? "Creating User..." : "Create User"}
              </button>
              <button
                onClick={() => {
                  setShowPasswordPrompt(false);
                  setAdminPassword("");
                  setError("");
                }}
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
          
          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
              {success}
              <button 
                onClick={() => setSuccess("")}
                className="ml-2 text-green-900 hover:text-green-700 font-bold"
              >
                ×
              </button>
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
              <button 
                onClick={() => setError("")}
                className="ml-2 text-red-900 hover:text-red-700 font-bold"
              >
                ×
              </button>
            </div>
          )}
        
        {/* Add New Country */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-md font-medium">Add New Country</h3>
            <button
              onClick={checkDataConsistency}
              disabled={submitting}
              className="btn-modern btn-modern-secondary disabled:opacity-50 text-sm px-4 py-2"
            >
              {submitting ? "Checking..." : "Check Data Consistency"}
            </button>
          </div>
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
              disabled={!newCountryName.trim() || submitting}
              className="btn-modern btn-modern-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Processing..." : "Add Country"}
            </button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            <strong>Data Consistency:</strong> When changing country names, all existing Quote Requests and User profiles are automatically updated to maintain data integrity for analytics.
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
                                disabled={submitting}
                                className="text-green-600 hover:text-green-800 font-medium text-sm disabled:opacity-50"
                              >
                                {submitting ? "Saving..." : "Save"}
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