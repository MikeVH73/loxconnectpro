"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, collection, getDocs, addDoc, deleteDoc, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { Firestore } from "firebase/firestore";

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", type: "jobsite" });

  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      
      setLoading(true);
      try {
        // Fetch customer details
        const docRef = doc(db as Firestore, "customers", params.id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const customerData = snap.data();
          setForm({ ...customerData, id: snap.id });
          
          // If there's a first contact in the customer document, create a contact object
          if (customerData.contact && customerData.phone) {
            setContacts([{
              id: 'main',
              name: customerData.contact,
              phone: customerData.phone,
              email: customerData.email || '',
              type: 'first'
            }]);
          }
        } else {
          setError("Customer not found");
        }

        // Fetch additional contacts from subcollection
        const contactsRef = collection(db as Firestore, `customers/${params.id}/contacts`);
        const contactsSnapshot = await getDocs(contactsRef);
        const subcollectionContacts = contactsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: 'jobsite'
        }));
        
        setContacts(prev => [...prev, ...subcollectionContacts]);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to fetch data");
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, db]);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    
    setSaving(true);
    setError("");
    try {
      const docRef = doc(db as Firestore, "customers", params.id as string);
      await updateDoc(docRef, form);
      router.push("/customers");
    } catch (err: any) {
      setError(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContact = async () => {
    if (!db || !newContact.name || !newContact.phone) return;
    
    if (editingContact) {
      // Update existing contact
      const docRef = doc(db as Firestore, `customers/${params.id}/contacts`, editingContact.id);
      await updateDoc(docRef, newContact);
      setContacts(prev => prev.map(c => c.id === editingContact.id ? { ...c, ...newContact } : c));
    } else {
      // Add new contact
      const contactsRef = collection(db as Firestore, `customers/${params.id}/contacts`);
      const docRef = await addDoc(contactsRef, {
        ...newContact,
        createdAt: serverTimestamp(),
      });
      setContacts(prev => [...prev, { id: docRef.id, ...newContact }]);
    }
    setShowContactModal(false);
    setEditingContact(null);
    setNewContact({ name: "", phone: "", email: "", type: "jobsite" });
  };

  const handleEditContact = (contact: any) => {
    setEditingContact(contact);
    setNewContact({ name: contact.name, phone: contact.phone, email: contact.email || "", type: contact.type || "jobsite" });
    setShowContactModal(true);
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!db) return;
    
    const docRef = doc(db as Firestore, `customers/${params.id}/contacts`, contactId);
    await deleteDoc(docRef);
    setContacts(prev => prev.filter(c => c.id !== contactId));
  };

  const handleSetFirstContact = async (contact: any) => {
    if (!db) return;
    
    // Set this contact as the first contact for the customer
    const docRef = doc(db as Firestore, "customers", params.id as string);
    await updateDoc(docRef, { contact: contact.name, phone: contact.phone, email: contact.email });
    setForm((prev: any) => ({ ...prev, contact: contact.name, phone: contact.phone, email: contact.email }));
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!form) return null;

  const firstContact = contacts.find(c => c.name === form.contact || c.type === "first");
  const jobsiteContacts = contacts.filter(c => c.id !== firstContact?.id);

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded shadow mt-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-6">Customer Details</h1>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Company Info</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><strong>Name:</strong> {form.name}</div>
          <div><strong>Address:</strong> {form.address}</div>
          <div><strong>Phone:</strong> {form.phone}</div>
          <div><strong>Email:</strong> {form.email}</div>
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">First Contact</h2>
        {firstContact ? (
          <div className="flex items-center gap-4 bg-gray-50 rounded p-4 mb-2">
            <div className="flex-1">
              <div><strong>Name:</strong> {firstContact.name}</div>
              <div><strong>Phone:</strong> {firstContact.phone}</div>
              <div><strong>Email:</strong> {firstContact.email}</div>
            </div>
            <button className="text-blue-600 underline" onClick={() => handleEditContact(firstContact)}>Edit</button>
            <button className="text-red-600 underline" onClick={() => handleDeleteContact(firstContact.id)}>Delete</button>
          </div>
        ) : (
          <div className="mb-2 text-gray-500">No first contact set.</div>
        )}
        <button className="bg-[#e40115] text-white px-4 py-2 rounded" onClick={() => { setShowContactModal(true); setEditingContact(null); setNewContact({ name: "", phone: "", email: "", type: "first" }); }}>Add First Contact</button>
        {firstContact && <button className="ml-4 text-sm underline" onClick={() => handleSetFirstContact(firstContact)}>Set as First Contact</button>}
      </div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Jobsite Contacts</h2>
        {jobsiteContacts.length === 0 ? (
          <div className="mb-2 text-gray-500">No jobsite contacts.</div>
        ) : jobsiteContacts.map(contact => (
          <div key={contact.id} className="flex items-center gap-4 bg-gray-50 rounded p-4 mb-2">
            <div className="flex-1">
              <div><strong>Name:</strong> {contact.name}</div>
              <div><strong>Phone:</strong> {contact.phone}</div>
              <div><strong>Email:</strong> {contact.email}</div>
            </div>
            <button className="text-blue-600 underline" onClick={() => handleEditContact(contact)}>Edit</button>
            <button className="text-red-600 underline" onClick={() => handleDeleteContact(contact.id)}>Delete</button>
            <button className="text-sm underline" onClick={() => handleSetFirstContact(contact)}>Set as First Contact</button>
          </div>
        ))}
        <button className="bg-[#e40115] text-white px-4 py-2 rounded" onClick={() => { setShowContactModal(true); setEditingContact(null); setNewContact({ name: "", phone: "", email: "", type: "jobsite" }); }}>Add Jobsite Contact</button>
      </div>
      {/* Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-md relative">
            <h2 className="text-lg font-bold mb-4">{editingContact ? "Edit Contact" : "Add Contact"}</h2>
            <div className="space-y-2">
          <input
            className="w-full border rounded px-3 py-2"
                placeholder="Name"
                value={newContact.name}
                onChange={e => setNewContact({ ...newContact, name: e.target.value })}
            required
          />
          <input
            className="w-full border rounded px-3 py-2"
                placeholder="Phone"
                value={newContact.phone}
                onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                required
              />
          <input
            className="w-full border rounded px-3 py-2"
                placeholder="Email"
                type="email"
                value={newContact.email}
                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
          />
              <select
            className="w-full border rounded px-3 py-2"
                value={newContact.type}
                onChange={e => setNewContact({ ...newContact, type: e.target.value })}
              >
                <option value="first">First Contact</option>
                <option value="jobsite">Jobsite Contact</option>
              </select>
        </div>
            <div className="flex gap-2 mt-4">
          <button
                type="button"
                className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700"
                onClick={handleSaveContact}
          >
                Save
          </button>
          <button
            type="button"
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                onClick={() => { setShowContactModal(false); setEditingContact(null); setNewContact({ name: "", phone: "", email: "", type: "jobsite" }); }}
          >
            Cancel
          </button>
        </div>
          </div>
        </div>
      )}
    </div>
  );
} 