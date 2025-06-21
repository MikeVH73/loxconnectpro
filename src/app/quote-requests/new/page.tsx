"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, updateDoc, Firestore, DocumentData, CollectionReference } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAuth } from "../../AuthProvider";
import { Fragment } from "react";
import dayjs from "dayjs";
import FileUpload from "../../components/FileUpload";
import FileUploadSimple from "../../components/FileUploadSimple";
import { moveFilesToQuoteRequest } from "../../utils/fileUtils";
import StorageTest from "../../components/StorageTest";
import CountrySelect from "../../components/CountrySelect";
import MessagingPanel from '@/app/components/MessagingPanel';
import { useMessages } from '@/app/hooks/useMessages';
import { debounce } from "lodash";

// Type definitions
interface Jobsite {
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  } | null;
}

interface Product {
  catClass: string;
  description: string;
  quantity: number;
}

interface Note {
  text: string;
  author: string;
  dateTime: string;
}

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
}

interface QuoteRequest {
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  status: string;
  products: Product[];
  jobsite: Jobsite;
  startDate: string;
  endDate: string | null;
  customerDecidesEnd: boolean;
  jobsiteContactId: string;
  jobsiteContact: any;
  labels: string[];
  notes: Note[];
  attachments: any[];
  createdAt: any;
  updatedAt: any;
}

const statuses = ["In Progress", "Won", "Lost", "Cancelled"];

// Add state for archived status
type StatusType = "In Progress" | "Snoozed" | "Won" | "Lost" | "Cancelled";

// Ensure db is initialized
if (!db) {
  throw new Error("Firestore is not initialized");
}

export default function NewQuoteRequestPage() {
  const router = useRouter();
  const { userProfile, user } = useAuth();
  const isMounted = useRef(true);
  const [title, setTitle] = useState("");
  const creatorCountry = userProfile?.country || userProfile?.businessUnit || "";
  const [involvedCountry, setInvolvedCountry] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", address: "", contact: "", phone: "", email: "" });
  const [status, setStatus] = useState<StatusType>("In Progress");
  const [isArchived, setIsArchived] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerDetails, setCustomerDetails] = useState<any>(null);
  const [customerContacts, setCustomerContacts] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState("");
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const googleMapsScriptRef = useRef<HTMLScriptElement | null>(null);
  const geocodingTimeoutRef = useRef<NodeJS.Timeout>();

  // Combine all initialization effects into one
  useEffect(() => {
    const initializeData = async () => {
      if (!db || !isMounted.current) return;

      try {
        // Load all data in parallel
        const [customersSnapshot, labelsSnapshot] = await Promise.all([
          getDocs(collection(db as Firestore, "customers")),
          getDocs(collection(db as Firestore, "labels"))
        ]);

        if (isMounted.current) {
          setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLabels(labelsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
          setLoading(false);
        }
      } catch (err) {
        console.error("Error initializing data:", err);
        if (isMounted.current) {
          setError("Failed to load initial data");
          setLoading(false);
        }
      }
    };

    // Initialize Google Maps
    if (!window.google && !googleMapsScriptRef.current) {
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (isMounted.current) {
          setIsGoogleMapsLoaded(true);
        }
      };
      script.onerror = () => {
        if (isMounted.current) {
          setError("Failed to load Google Maps");
        }
      };
      document.head.appendChild(script);
      googleMapsScriptRef.current = script;
    }

    initializeData();

    // Cleanup function
    return () => {
      isMounted.current = false;
      if (geocodingTimeoutRef.current) {
        clearTimeout(geocodingTimeoutRef.current);
      }
      if (googleMapsScriptRef.current && googleMapsScriptRef.current.parentNode) {
        googleMapsScriptRef.current.parentNode.removeChild(googleMapsScriptRef.current);
      }
    };
  }, []); // Empty dependency array since this should only run once

  // Debug logging for country mismatch
  useEffect(() => {
    if (userProfile && isMounted.current) {
      console.log("[NewQuoteRequest] User Profile Debug:", {
        country: userProfile.country,
        businessUnit: userProfile.businessUnit,
        countries: userProfile.countries,
        role: userProfile.role,
        calculatedCreatorCountry: creatorCountry
      });
    }
  }, [userProfile, creatorCountry]);

  // Fetch contacts when customer changes
  useEffect(() => {
    const fetchContacts = async () => {
      if (!customerId || !db || !isMounted.current) return;

      try {
        const contactsRef = collection(db as Firestore, `customers/${customerId}/contacts`);
        const contactsSnapshot = await getDocs(contactsRef);
        
        if (isMounted.current) {
          setContacts(contactsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
        if (isMounted.current) {
          setError("Failed to fetch contacts");
        }
      }
    };

    fetchContacts();
  }, [customerId]);

  // Geocoding handler with debounce
  const handleAddressChange = useCallback((address: string) => {
    if (!address || !window.google || !isMounted.current) return;

    setIsGeocoding(true);
    setGeocodingError("");

    const geocodeAddress = async () => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        const result = await new Promise((resolve, reject) => {
          geocoder.geocode({ address }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              resolve(results[0]);
            } else {
              reject(new Error("Geocoding failed"));
            }
          });
        });

        if (isMounted.current) {
          const location = (result as any).geometry.location;
          setJobsiteCoords({
            lat: location.lat(),
            lng: location.lng()
          });
          setJobsiteAddress(address);
        }
      } catch (err) {
        console.error("Geocoding error:", err);
        if (isMounted.current) {
          setGeocodingError("Failed to get coordinates for address");
        }
      } finally {
        if (isMounted.current) {
          setIsGeocoding(false);
        }
      }
    };

    // Clear any existing timeout
    if (geocodingTimeoutRef.current) {
      clearTimeout(geocodingTimeoutRef.current);
    }

    // Set new timeout
    geocodingTimeoutRef.current = setTimeout(geocodeAddress, 1000);
  }, [isMounted, setIsGeocoding, setGeocodingError, setJobsiteCoords, setJobsiteAddress]);

  // Add effect to update archived state based on status
  useEffect(() => {
    setIsArchived(status !== "In Progress");
  }, [status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !isMounted.current) return;
    
    if (isMounted.current) {
      setSubmitting(true);
      setError("");
      setSuccess("");
    }

    try {
      // Required field validation
      if (!title || !creatorCountry || !involvedCountry || !customerId || products.length === 0) {
        if (isMounted.current) {
          setError("Please fill in all required fields: Title, Creator Country, Involved Country, Customer, and at least one Product.");
          setSubmitting(false);
        }
        return;
      }

      // Add date validation
      if (!customerDecidesEnd && startDate && endDate && new Date(endDate) < new Date(startDate)) {
        if (isMounted.current) {
          setError("End Date cannot be before Start Date.");
          setSubmitting(false);
        }
        return;
      }

      console.log("[QuoteRequest] Starting Firestore write...");
      
      // Sanitize all fields to avoid undefined
      const sanitize = (value: any) => value === undefined ? null : value;
      const sanitizedProducts = (products || []).map(p => ({
        catClass: sanitize(p.catClass),
        description: sanitize(p.description),
        quantity: sanitize(p.quantity)
      }));
      const sanitizedNotes = (notes || []).map(n => ({ ...n, createdAt: new Date().toISOString() }));
      
      // Ensure jobsite coordinates are properly formatted
      const jobsiteData = {
        address: sanitize(jobsiteAddress),
        coordinates: jobsiteCoords.lat !== null && jobsiteCoords.lng !== null ? {
          lat: jobsiteCoords.lat,
          lng: jobsiteCoords.lng
        } : null
      };
      
      console.log("Saving jobsite data:", jobsiteData);
      
      const quoteData = {
        title: sanitize(title),
        creatorCountry: sanitize(creatorCountry),
        involvedCountry: sanitize(involvedCountry),
        customer: sanitize(customerId),
        status: sanitize(status),
        products: sanitizedProducts,
        jobsite: jobsiteData,
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
      const quoteRequestsCollection = collection(db as Firestore, "quoteRequests");
      const docRef = await addDoc(quoteRequestsCollection, quoteData);

      // Handle file uploads if any
      if (attachments.length > 0) {
        const movedFiles = await moveFilesToQuoteRequest(attachments, docRef.id);
        // Update the quote request with the file references
        await updateDoc(doc(db as Firestore, "quoteRequests", docRef.id), {
          attachments: movedFiles.map(file => ({
            id: file.id,
            name: file.name,
            url: file.url,
            type: file.type,
            size: file.size,
            uploadedAt: file.uploadedAt,
            uploadedBy: file.uploadedBy
          }))
        });
      }

      if (isMounted.current) {
        setSuccess("Quote request created successfully!");
      }
      router.push(`/quote-requests/${docRef.id}`);
    } catch (error) {
      console.error("[QuoteRequest] Error creating quote request:", error);
      if (isMounted.current) {
        setError("Failed to create quote request. Please try again.");
      }
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
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
    if (!db || !newCustomer.name) return;
    try {
      const customersCollection = collection(db as Firestore, "customers");
      const customerRef = await addDoc(customersCollection, {
        ...newCustomer,
        createdAt: serverTimestamp(),
      });
      const newCustomerData = { id: customerRef.id, ...newCustomer };
      setCustomers(prev => [...prev, newCustomerData]);
      setCustomerId(customerRef.id);
      setShowNewCustomer(false);
      setNewCustomer({ name: "", address: "", contact: "", phone: "", email: "" });
    } catch (error) {
      console.error("Error adding customer:", error);
    }
  };

  const handleAddNote = () => {
    const userEmail = user?.email;
    if (!noteText.trim() || !userEmail) return;
    
    setNotes(prev => [
      ...prev,
      {
        text: noteText.trim(),
        author: userEmail,
        dateTime: new Date().toISOString()
      }
    ]);
    setNoteText("");
  };

  const handleRemoveNote = (idx: number) => setNotes(prev => prev.filter((_, i) => i !== idx));

  const handleAddNewContact = async () => {
    if (!db || !customerId || !newContact.name || !newContact.phone) return;
    try {
      const contactsCollection = collection(db as Firestore, "contacts");
      const contactRef = await addDoc(contactsCollection, {
        ...newContact,
        customer: customerId,
        createdAt: serverTimestamp(),
      });
      const newContactData = { id: contactRef.id, ...newContact };
      setContacts(prev => [...prev, newContactData]);
      setJobsiteContactId(contactRef.id);
      setShowNewContact(false);
      setNewContact({ name: "", phone: "" });
    } catch (error) {
      console.error("Error adding contact:", error);
    }
  };

  const handleCustomerClick = async (customerId: string) => {
    if (!db) return;
    try {
      const customerDoc = doc(db as Firestore, "customers", customerId);
      const customerSnap = await getDoc(customerDoc);
      if (customerSnap.exists()) {
        setCustomerDetails(customerSnap.data());
        const contactsCollection = collection(db as Firestore, "contacts");
        const q = query(contactsCollection, where("customer", "==", customerId));
        const contactsSnap = await getDocs(q);
        setCustomerContacts(contactsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setShowCustomerModal(true);
      }
    } catch (error) {
      console.error("Error fetching customer details:", error);
    }
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
                  onClick={() => handleCustomerClick(customerId)}
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
              onChange={e => {
                const address = e.target.value;
                setJobsiteAddress(address);
                handleAddressChange(address);
              }}
            />
            <div className="text-xs text-gray-400">Please enter the full address (street, number, postal code, city, country) in one line, without commas, dashes, or special characters.</div>
            {isGeocoding && <div className="text-sm text-gray-500 mt-1">Getting coordinates...</div>}
            {geocodingError && <div className="text-sm text-red-500 mt-1">{geocodingError}</div>}
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