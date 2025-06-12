"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAuth } from "../../AuthProvider";
import { Fragment } from "react";
import dayjs from "dayjs";
import FileUpload from "../../components/FileUpload";
import FileUploadSimple from "../../components/FileUploadSimple";
import { moveFilesToQuoteRequest } from "../../utils/fileUtils";
import StorageTest from "../../components/StorageTest";
import CountrySelect from "../../components/CountrySelect";
const statuses = ["In Progress", "Won", "Lost", "Cancelled"];

// Add state for archived status
type StatusType = "In Progress" | "Won" | "Lost" | "Cancelled";

export default function NewQuoteRequestPage() {
  const router = useRouter();
  const { userProfile, user } = useAuth();
  const [title, setTitle] = useState("");
  const creatorCountry = userProfile?.country || userProfile?.businessUnit || "";
  const [involvedCountry, setInvolvedCountry] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", address: "", contact: "", phone: "", email: "" });
  const [status, setStatus] = useState<StatusType>("In Progress");
  const [isArchived, setIsArchived] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [products, setProducts] = useState([
    { catClass: "", description: "", quantity: 1 },
  ]);
  const [jobsiteAddress, setJobsiteAddress] = useState("");
  const [jobsiteCoords, setJobsiteCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerDecidesEnd, setCustomerDecidesEnd] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [jobsiteContactId, setJobsiteContactId] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [labels, setLabels] = useState<any[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
  const [notes, setNotes] = useState<{ text: string; author: string }[]>([]);
  const [noteText, setNoteText] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [customerContacts, setCustomerContacts] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);

  // Debug logging to understand country mismatch
  useEffect(() => {
    if (userProfile) {
      console.log("[NewQuoteRequest] User Profile Debug:", {
        country: userProfile.country,
        businessUnit: userProfile.businessUnit,
        countries: userProfile.countries,
        role: userProfile.role,
        calculatedCreatorCountry: creatorCountry
      });
    }
  }, [userProfile, creatorCountry]);

  // Fetch customers
  useEffect(() => {
    const fetchCustomers = async () => {
      const snapshot = await getDocs(collection(db, "customers"));
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCustomers();
  }, []);

  // Geocode address to coordinates (using OpenStreetMap Nominatim API for demo)
  useEffect(() => {
    const fetchCoords = async () => {
      if (jobsiteAddress.length < 5) {
        setJobsiteCoords({ lat: null, lng: null });
        return;
      }
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(jobsiteAddress)}`
        );
        const data = await res.json();
        if (data && data[0]) {
          setJobsiteCoords({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        } else {
          setJobsiteCoords({ lat: null, lng: null });
        }
      } catch {
        setJobsiteCoords({ lat: null, lng: null });
      }
    };
    fetchCoords();
  }, [jobsiteAddress]);

  // Fetch contacts for the selected customer
  useEffect(() => {
    const fetchContacts = async () => {
      if (!customerId) {
        setContacts([]);
        return;
      }
      const q = query(collection(db, "contacts"), where("customer", "==", customerId));
      const snapshot = await getDocs(q);
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchContacts();
  }, [customerId]);

  // Fetch labels (max 4 selectable)
  useEffect(() => {
    const fetchLabels = async () => {
      const snapshot = await getDocs(collection(db, "labels"));
      setLabels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchLabels();
  }, []);

  // Add this useEffect to clear End Date when customerDecidesEnd is checked
  useEffect(() => {
    if (customerDecidesEnd) {
      setEndDate("");
    }
  }, [customerDecidesEnd]);

  // Add effect to update archived state based on status
  useEffect(() => {
    setIsArchived(status !== "In Progress");
  }, [status]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    
    console.log("[QuoteRequest] Submission started - Firebase config check:", {
      hasApiKey: true, // Firebase config is hardcoded
      hasProjectId: true, // Firebase config is hardcoded
      userAuth: !!user,
      userProfile: userProfile
    });

    // Only allow non-readOnly users
    if (userProfile?.role === "readOnly") {
      setError("You do not have permission to create a Quote Request.");
      setSubmitting(false);
      return;
    }

    // Required field validation
    if (!title || !creatorCountry || !involvedCountry || !customerId || products.length === 0) {
      setError("Please fill in all required fields: Title, Creator Country, Involved Country, Customer, and at least one Product.");
      setSubmitting(false);
      return;
    }

    // Add date validation
    if (!customerDecidesEnd && startDate && endDate && endDate < startDate) {
      setError("End Date cannot be before Start Date.");
      setSubmitting(false);
      return;
    }

    try {
      console.log("[QuoteRequest] Starting Firestore write...");
      
      // Sanitize all fields to avoid undefined
      const sanitize = (value: any) => value === undefined ? null : value;
      const sanitizedProducts = (products || []).map(p => ({
        catClass: sanitize(p.catClass),
        description: sanitize(p.description),
        quantity: sanitize(p.quantity)
      }));
      const sanitizedNotes = (notes || []).map(n => ({ ...n, createdAt: new Date().toISOString() }));
      
      const quoteData = {
        title: sanitize(title),
        creatorCountry: sanitize(creatorCountry),
        involvedCountry: sanitize(involvedCountry),
        customer: sanitize(customerId),
        status: sanitize(status),
        products: sanitizedProducts,
        jobsite: {
          address: sanitize(jobsiteAddress),
          lat: sanitize(jobsiteCoords.lat),
          lng: sanitize(jobsiteCoords.lng),
        },
        startDate: sanitize(startDate),
        endDate: customerDecidesEnd ? null : sanitize(endDate),
        customerDecidesEnd: !!customerDecidesEnd,
        jobsiteContactId: showNewContact ? null : sanitize(jobsiteContactId),
        jobsiteContact: showNewContact ? newContact : null,
        labels: selectedLabels || [],
        notes: sanitizedNotes,
        attachments: [], // Will be updated after moving files
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      console.log("[QuoteRequest] Attempting to write to Firestore:", quoteData);
      
      // First create the quote request
      const docRef = await addDoc(collection(db, "quoteRequests"), quoteData);
      
      console.log("[QuoteRequest] Document created with ID:", docRef.id);
      
      // Save attachments directly (using simple base64 storage for now)
      if (attachments.length > 0) {
        console.log("[QuoteRequest] Updating attachments...");
        await updateDoc(doc(db, "quoteRequests", docRef.id), {
          attachments: attachments
        });
      }
      
      setSuccess("Quote Request created successfully! Redirecting...");
      console.log("[QuoteRequest] Successfully created", docRef.id);
      
      setTimeout(() => {
        router.push(`/quote-requests/${docRef.id}/edit`);
      }, 1200);
      
    } catch (err: any) {
      console.error("[QuoteRequest] Detailed error:", err);
      console.error("[QuoteRequest] Error code:", err.code);
      console.error("[QuoteRequest] Error message:", err.message);
      
      let errorMessage = "Failed to create quote request";
      
      if (err.code === 'permission-denied') {
        errorMessage = "Permission denied. Please check your Firebase security rules.";
      } else if (err.code === 'unauthenticated') {
        errorMessage = "You are not authenticated. Please log in again.";
      } else if (err.code === 'unavailable') {
        errorMessage = "Firebase service is unavailable. Please try again later.";
      } else if (err.code === 'failed-precondition') {
        errorMessage = "Firebase configuration error. Please check environment variables.";
      } else if (err.message) {
        errorMessage = `Error: ${err.message}`;
      }
      
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleProductChange = (idx: number, field: string, value: string | number) => {
    setProducts((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p))
    );
  };

  const addProduct = () => setProducts((prev) => [...prev, { catClass: "", description: "", quantity: 1 }]);

  const removeProduct = (idx: number) => setProducts((prev) => prev.filter((_, i) => i !== idx));

  const handleLabelToggle = (id: string) => {
    setSelectedLabels((prev) =>
      prev.includes(id)
        ? prev.filter((l) => l !== id)
        : prev.length < 4
        ? [...prev, id]
        : prev
    );
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomer.name || !newCustomer.address || !newCustomer.contact || !newCustomer.phone || !newCustomer.email) return;
    const docRef = await addDoc(collection(db, "customers"), newCustomer);
    setCustomers(prev => [...prev, { id: docRef.id, ...newCustomer }]);
    setCustomerId(docRef.id);
    setShowNewCustomer(false);
    setNewCustomer({ name: "", address: "", contact: "", phone: "", email: "" });
  };

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    setNotes(prev => [...prev, { text: noteText, author: user?.email || "Unknown" }]);
    setNoteText("");
  };

  const handleRemoveNote = (idx: number) => setNotes(prev => prev.filter((_, i) => i !== idx));

  const handleAddNewContact = async () => {
    if (!newContact.name || !newContact.phone || !customerId) return;
    const docRef = await addDoc(collection(db, "contacts"), {
      ...newContact,
      customer: customerId,
      createdAt: serverTimestamp(),
    });
    const addedContact = { id: docRef.id, ...newContact, customer: customerId };
    setContacts(prev => [...prev, addedContact]);
    setJobsiteContactId(docRef.id);
    setShowNewContact(false);
    setNewContact({ name: "", phone: "" });
  };

  const handleViewCustomer = async (id: string) => {
    setShowCustomerModal(true);
    // Fetch customer details
    const docRef = doc(db, "customers", id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      setCustomerDetails({ ...snap.data(), id: snap.id });
    } else {
      setCustomerDetails(null);
    }
    // Fetch contacts for this customer
    const q = query(collection(db, "contacts"), where("customer", "==", id));
    const snapshot = await getDocs(q);
    setCustomerContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [
      ...prev,
      {
        text: chatInput,
        sender: user?.email || "Me",
        time: new Date().toISOString(),
      },
    ]);
    setChatInput("");
  };

  return (
    <div className="w-full p-8 bg-white mt-8">
      {/* Header row with labels/urgent */}
      <div className="flex items-center gap-6 mb-6 border-b pb-2 min-h-[56px] flex-wrap md:flex-nowrap">
        <h1 className="text-2xl font-bold text-[#e40115] whitespace-nowrap">New Quote Request</h1>
        <div className="flex items-center gap-2 text-lg font-medium whitespace-nowrap">
          <span>{creatorCountry}</span>
          <span>&rarr;</span>
          <span>{involvedCountry || "..."}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap ml-2">
          {labels.length === 0 ? (
            <span className="text-gray-400">No labels found.</span>
          ) : labels.map(label => (
            <label key={label.id} className={`px-3 py-1 rounded-full border cursor-pointer select-none ${selectedLabels.includes(label.id) ? 'bg-[#e40115] text-white border-[#e40115]' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
              style={{ opacity: selectedLabels.length >= 4 && !selectedLabels.includes(label.id) ? 0.5 : 1 }}
            >
              <input
                type="checkbox"
                className="mr-2"
                checked={selectedLabels.includes(label.id)}
                onChange={() => handleLabelToggle(label.id)}
                disabled={!selectedLabels.includes(label.id) && selectedLabels.length >= 4}
              />
              {label.name || label.id}
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleSubmit}
            className="bg-[#e40115] text-white px-6 py-2 rounded text-base font-semibold hover:bg-red-700 transition whitespace-nowrap"
            disabled={loading || submitting || userProfile?.role === "readOnly"}
          >
            {submitting ? "Saving..." : "Create (save changed) Quote Request"}
          </button>
          <button
            type="button"
            className="bg-gray-200 text-gray-700 px-6 py-2 rounded text-base font-semibold hover:bg-gray-300 transition whitespace-nowrap"
            onClick={() => router.push("/quote-requests")}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-center font-semibold">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-center font-semibold">
          {success}
        </div>
      )}
      {submitting && (
        <div className="mb-4 p-2 text-blue-600 text-center font-medium">Submitting Quote Request...</div>
      )}
      <form onSubmit={handleSubmit} className="grid grid-cols-[2fr_2fr] gap-8 w-full items-start">
        {/* Left column: form fields */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div>
            <label className="block mb-1 font-medium">Status</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={status}
              onChange={e => setStatus(e.target.value as StatusType)}
              disabled={userProfile?.country !== creatorCountry}
            >
              {statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {userProfile?.country !== creatorCountry && (
              <div className="text-xs text-gray-400 mt-1">Only the creator country can change the status.</div>
            )}
          </div>
          <div>
            <label className="block mb-1 font-medium">Title <span className="text-red-500">*</span></label>
            <input
              className="w-full border rounded px-3 py-2"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Creator Country</label>
            <input
              className="w-full border rounded px-3 py-2 bg-gray-100"
              value={creatorCountry}
              disabled
              readOnly
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Involved Country <span className="text-red-500">*</span></label>
            <CountrySelect
              value={involvedCountry}
              onChange={setInvolvedCountry}
              required
              placeholder="Select country"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Customer <span className="text-red-500">*</span></label>
            <div className="flex gap-2 items-end">
              <select
                className="flex-1 border rounded px-3 py-2"
                value={customerId}
                onChange={e => {
                  setCustomerId(e.target.value);
                  setShowNewCustomer(e.target.value === "__new");
                }}
                disabled={showNewCustomer}
                required={!showNewCustomer}
              >
                <option value="">Select customer</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.address})</option>
                ))}
                <option value="__new">+ Add new customer</option>
              </select>
              {customerId && !showNewCustomer && (
                <button
                  type="button"
                  onClick={() => handleViewCustomer(customerId)}
                  className="bg-[#e40115] text-white px-3 py-2 rounded hover:bg-red-700 transition text-sm"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  View details
                </button>
              )}
            </div>
          </div>
          {/* Modal for new customer */}
          {showNewCustomer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white p-6 rounded shadow-lg w-full max-w-md relative">
                <h2 className="text-lg font-bold mb-4">Add New Customer</h2>
                <div className="space-y-2">
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Name"
                    value={newCustomer.name}
                    onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    required
                  />
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Address"
                    value={newCustomer.address}
                    onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                    required
                  />
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Contact"
                    value={newCustomer.contact}
                    onChange={e => setNewCustomer({ ...newCustomer, contact: e.target.value })}
                    required
                  />
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Phone"
                    value={newCustomer.phone}
                    onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                    required
                  />
                  <input
                    className="w-full border rounded px-3 py-2"
                    placeholder="Email"
                    type="email"
                    value={newCustomer.email}
                    onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                    required
                  />
                </div>
                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700"
                    onClick={handleAddNewCustomer}
                    title="Save new customer"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                    onClick={() => {
                      setShowNewCustomer(false);
                      setNewCustomer({ name: "", address: "", contact: "", phone: "", email: "" });
                    }}
                    title="Cancel new customer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          {showCustomerModal && customerDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
              <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl relative">
                <h2 className="text-xl font-bold mb-4">Customer Details</h2>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div><strong>Name:</strong> {customerDetails.name}</div>
                  <div><strong>Address:</strong> {customerDetails.address}</div>
                  <div><strong>Phone:</strong> {customerDetails.phone}</div>
                  <div><strong>Email:</strong> {customerDetails.email}</div>
                </div>
                <h3 className="text-lg font-semibold mb-2">Contacts</h3>
                {customerContacts.length === 0 ? (
                  <div className="mb-2 text-gray-500">No contacts found.</div>
                ) : customerContacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-4 bg-gray-50 rounded p-2 mb-2">
                    <div className="flex-1">
                      <div><strong>Name:</strong> {contact.name}</div>
                      <div><strong>Phone:</strong> {contact.phone}</div>
                      <div><strong>Email:</strong> {contact.email}</div>
                      <div><strong>Type:</strong> {contact.type}</div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="mt-4 bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                  onClick={() => setShowCustomerModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block mb-1 font-medium">Jobsite Address</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={jobsiteAddress}
              onChange={e => setJobsiteAddress(e.target.value)}
            />
            <div className="text-xs text-gray-400">Please enter the full address (street, number, postal code, city, country) in one line, without commas, dashes, or special characters.</div>
            <div className="flex gap-4 mt-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Latitude</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                  value={jobsiteCoords.lat ?? ""}
                  readOnly
                  disabled
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Longitude</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                  value={jobsiteCoords.lng ?? ""}
                  readOnly
                  disabled
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium">Jobsite Contact</label>
            <div className="flex gap-2 items-end">
              <select
                className="flex-1 border rounded px-3 py-2"
                value={jobsiteContactId}
                onChange={e => {
                  setJobsiteContactId(e.target.value);
                  setShowNewContact(e.target.value === "__new");
                }}
                disabled={showNewContact}
                required={!showNewContact}
              >
                <option value="">Select contact</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
                <option value="__new">+ Add new contact</option>
              </select>
            </div>
            {/* Modal for new contact */}
            {showNewContact && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-30">
                <div className="bg-white p-6 rounded shadow-lg w-full max-w-md relative">
                  <h2 className="text-lg font-bold mb-4">Add New Jobsite Contact</h2>
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
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700"
                      onClick={handleAddNewContact}
                      title="Save new contact"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
                      onClick={() => {
                        setShowNewContact(false);
                        setNewContact({ name: "", phone: "" });
                      }}
                      title="Cancel new contact"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Right column: products, notes, dates, messaging */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={startDate || ""}
                onChange={e => setStartDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">End Date{!customerDecidesEnd && <span className="text-red-500">*</span>}</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={endDate || ""}
                onChange={e => setEndDate(e.target.value)}
                required={!customerDecidesEnd}
                disabled={customerDecidesEnd}
              />
            </div>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Tip: Use the arrow keys or click to select year/month/day. Tabbing may not work in all browsers.
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="customerDecidesEnd"
              checked={customerDecidesEnd}
              onChange={e => setCustomerDecidesEnd(e.target.checked)}
            />
            <label htmlFor="customerDecidesEnd" className="text-sm">Customer decides end date</label>
          </div>
          <div>
            <label className="block mb-1 font-medium">Products</label>
            <div className="space-y-2">
              {products.map((product, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="Cat-Class"
                      value={product.catClass}
                      onChange={e => handleProductChange(idx, "catClass", e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex-2">
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="Description"
                      value={product.description}
                      onChange={e => handleProductChange(idx, "description", e.target.value)}
                      required
                    />
                  </div>
                  <div className="w-24">
                    <input
                      type="number"
                      min={1}
                      className="w-full border rounded px-3 py-2"
                      placeholder="Qty"
                      value={product.quantity}
                      onChange={e => handleProductChange(idx, "quantity", Number(e.target.value))}
                      required
                    />
                  </div>
                  <button
                    type="button"
                    className="text-red-600 font-bold px-2"
                    onClick={() => removeProduct(idx)}
                    disabled={products.length === 1}
                    title="Remove product"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="mt-2 px-4 py-1 bg-[#bbbdbe] text-[#e40115] rounded hover:bg-[#cccdce]"
                onClick={addProduct}
              >
                + Add Product
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium">Notes</label>
            <div className="flex gap-2">
              <input
                className="w-full border rounded px-3 py-2"
                placeholder="Add a note..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <button type="button" className="bg-[#e40115] text-white px-4 py-2 rounded" onClick={handleAddNote}>+</button>
            </div>
            <ul className="mt-2 space-y-1">
              {notes.map((note, idx) => (
                <li key={idx} className="flex items-center justify-between text-xs bg-gray-100 rounded px-2 py-1">
                  <span>{note.text} <span className="text-gray-400 italic">({note.author})</span></span>
                  <button type="button" className="text-gray-400 hover:text-[#e40115] ml-2" onClick={() => handleRemoveNote(idx)}>&times;</button>
                </li>
              ))}
            </ul>
          </div>
          {/* File upload section */}
          <div>
            <label className="block mb-1 font-medium">Attachments</label>
            <StorageTest />
            <div className="mt-4">
              <FileUploadSimple
                quoteRequestId="new" // Temporary ID for new quote requests
                files={attachments}
                onFilesChange={setAttachments}
                currentUser={userProfile?.name || "User"}
                readOnly={false}
              />
            </div>
          </div>
          {/* Messaging container below notes, read-only, for archived messages */}
          <div className="w-full bg-white border rounded shadow p-6 flex flex-col min-h-[200px]">
            <h2 className="text-lg font-semibold mb-2">Messaging (Archived)</h2>
            <div className="flex-1 overflow-y-auto mb-2">
              {/* Only show archived messages, if any (for now, empty) */}
              <div className="text-gray-400 text-sm">No archived messages for this request yet.</div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
} 