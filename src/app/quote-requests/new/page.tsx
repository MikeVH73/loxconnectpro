"use client";
import { useState, useEffect, useRef } from "react";
import DateInput from "../../components/DateInput";
import { useRouter } from "next/navigation";
import { collection, addDoc, serverTimestamp, getDocs, query, where, doc, getDoc, updateDoc, Firestore } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import { useAuth } from "../../AuthProvider";
import dynamic from 'next/dynamic';
import { Fragment } from "react";
import dayjs from "dayjs";

// Dynamically import components with proper loading states
const CountrySelect = dynamic(() => import("../../components/CountrySelect"), {
  ssr: false,
  loading: () => <div className="h-10 bg-gray-100 rounded animate-pulse"></div>
});

const LoadingSpinner = dynamic(() => import("../../components/LoadingSpinner"), {
  ssr: false,
  loading: () => <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
});

const FileUpload = dynamic(() => import("../../components/FileUpload"), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded animate-pulse"></div>
});

// Import utilities
import { moveFilesToQuoteRequest } from "../../utils/fileUtils";
import { useMessages } from '@/app/hooks/useMessages';
import { debounce } from "lodash";
import { useCustomers } from "../../hooks/useCustomers";
// import { useJobsites } from "../../hooks/useJobsites";
import { getProductByCode, normalizeCode } from "../../utils/products";

// Type definitions
interface Jobsite {
  address: string;
  coordinates: { lat: number; lng: number } | null;
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  type: 'first' | 'jobsite';
}

interface Customer {
  id: string;
  name: string;
  customerNumbers?: Record<string, string>;
  contact?: string;
  phone?: string;
  email?: string;
}

type StatusType = "New" | "In Progress" | "Snoozed" | "Won" | "Lost" | "Cancelled";

const NewQuoteRequestPage = () => {
  const router = useRouter();
  const { userProfile, user } = useAuth();
  const { customers } = useCustomers();
  // const { jobsites, loading: jobsitesLoading, createJobsite } = useJobsites(customerId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize state
  const [title, setTitle] = useState("");
  const creatorCountry = userProfile?.businessUnit || "";
  const [involvedCountry, setInvolvedCountry] = useState("");
  const [customerId, setCustomerId] = useState("");
  // Status is always "New" for new quote requests
  const status: StatusType = "New";
  const [isArchived, setIsArchived] = useState(false);
  const [products, setProducts] = useState<Product[]>([
    { catClass: "", description: "", quantity: 1 },
  ]);
  const [jobsiteAddress, setJobsiteAddress] = useState("");
  const [jobsiteCoords, setJobsiteCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedJobsiteId, setSelectedJobsiteId] = useState("");
  const [showJobsiteModal, setShowJobsiteModal] = useState(false);
  const [newJobsite, setNewJobsite] = useState({
    jobsiteName: '',
    address: '',
    latitude: 0,
    longitude: 0,
    contactName: '',
    contactPhone: ''
  });
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerDecidesEnd, setCustomerDecidesEnd] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobsiteContactId, setJobsiteContactId] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [labels, setLabels] = useState<string[]>([]);
  const [urgentFlag, setUrgentFlag] = useState(false);

  // Date sub-fields for better keyboard flow
  const [sd, setSd] = useState("");
  const [sm, setSm] = useState("");
  const [sy, setSy] = useState("");
  const [ed, setEd] = useState("");
  const [em, setEm] = useState("");
  const [ey, setEy] = useState("");
  const smRef = useRef<HTMLInputElement>(null);
  const syRef = useRef<HTMLInputElement>(null);
  const emRef = useRef<HTMLInputElement>(null);
  const eyRef = useRef<HTMLInputElement>(null);

  const pad2 = (v: string) => (v.length === 1 ? `0${v}` : v);
  const toIso = (d: string, m: string, y: string) => (d && m && y && y.length === 4 ? `${y}-${pad2(m)}-${pad2(d)}` : "");
  const [notes, setNotes] = useState<Note[]>([]);
  const [noteText, setNoteText] = useState("");
  const [customerDetails, setCustomerDetails] = useState<Customer | null>(null);
  const [customerContacts, setCustomerContacts] = useState<Contact[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [success, setSuccess] = useState("");
  const [attachments, setAttachments] = useState<FileData[]>([]);
  const [customerNumber, setCustomerNumber] = useState("");
  // Quick Add product modal state
  const [quickAdd, setQuickAdd] = useState<{ index: number; code: string } | null>(null);
  const [quickAddCode, setQuickAddCode] = useState<string>("");
  const [quickAddDesc, setQuickAddDesc] = useState<string>("");

  useEffect(() => {
    // Simple initialization check
    if (!db || !user) {
      setError("Please log in to create a quote request");
      return;
    }
    setLoading(false);
  }, [user]);

  // Update customer number when involved country changes
  useEffect(() => {
    if (customerId && involvedCountry && customerDetails?.customerNumbers) {
      setCustomerNumber(customerDetails.customerNumbers[involvedCountry] || "");
          } else {
      setCustomerNumber("");
    }
  }, [customerId, involvedCountry, customerDetails]);

  // Handle jobsite selection
  const handleJobsiteChange = (jobsiteId: string) => {
    if (jobsiteId === 'new') {
      setShowJobsiteModal(true);
      return;
    }
    
    setSelectedJobsiteId(jobsiteId);
    // const selectedJobsite = jobsites.find(j => j.id === jobsiteId);
    // if (selectedJobsite) {
    //   setJobsiteAddress(selectedJobsite.address);
    //   setJobsiteCoords({
    //     lat: selectedJobsite.latitude,
    //     lng: selectedJobsite.longitude
    //   });
    // }
  };

  // Handle new jobsite creation
  const handleCreateJobsite = async () => {
    // Temporarily disabled
    alert('Jobsite functionality temporarily disabled for debugging');
    setShowJobsiteModal(false);
  };

  // Handle customer selection
  const handleCustomerChange = async (selectedCustomerId: string) => {
    setCustomerId(selectedCustomerId);
    setJobsiteContactId("");
    setContacts([]);
    setSelectedJobsiteId("");
    setJobsiteAddress("");
    setJobsiteCoords(null);

    if (!selectedCustomerId || !db) return;

    try {
      const customerDoc = await getDoc(doc(db as Firestore, "customers", selectedCustomerId));
      if (customerDoc.exists()) {
        const customerData = customerDoc.data() as Customer;
        setCustomerDetails(customerData);
        
        let allContacts: Contact[] = [];
        
        if (customerData.contact && customerData.phone) {
          allContacts.push({
            id: 'main',
            name: customerData.contact,
            phone: customerData.phone,
            email: customerData.email || '',
            type: 'first'
          });
        }
        
        const contactsRef = collection(db as Firestore, `customers/${selectedCustomerId}/contacts`);
        const contactsSnapshot = await getDocs(contactsRef);
        const jobsiteContacts = contactsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          phone: doc.data().phone,
          email: doc.data().email || '',
          type: 'jobsite' as const
        }));
        
        allContacts = [...allContacts, ...jobsiteContacts];
        setContacts(allContacts);
        
        if (jobsiteContacts.length > 0) {
          setJobsiteContactId(jobsiteContacts[0].id);
        } else if (allContacts.length === 1) {
          setJobsiteContactId(allContacts[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching customer details:", err);
      setError("Failed to fetch customer details");
    }
  };

  // Handle new contact creation
  const handleAddNewContact = async () => {
    if (!customerId || !db || !newContact.name || !newContact.phone) {
      setError("Please fill in all required contact fields");
      return;
    }

    try {
      const contactsRef = collection(db as Firestore, `customers/${customerId}/contacts`);
      const contactData = {
        name: newContact.name,
        phone: newContact.phone,
        type: 'jobsite',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(contactsRef, contactData);
      const newContactWithId: Contact = {
        id: docRef.id,
        name: newContact.name,
        phone: newContact.phone,
        type: 'jobsite'
      };
      
      setContacts(prev => [...prev, newContactWithId]);
      setJobsiteContactId(docRef.id);
      setNewContact({ name: "", phone: "" });
      setShowNewContact(false);
    } catch (err) {
      console.error("Error creating new contact:", err);
      setError("Failed to create new contact");
    }
  };

  // Handle file selection
  const handleFileSelect = (newFiles: FileData[]) => {
    setAttachments(prev => [...prev, ...newFiles]);
  };

  // Handle adding notes
  const handleAddNote = () => {
    if (noteText.trim()) {
      const newNote: Note = {
        text: noteText.trim(),
        author: user?.email || "Unknown",
        dateTime: new Date().toISOString()
      };
      setNotes(prev => [...prev, newNote]);
      setNoteText("");
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !db) return;

    // Build ISO dates up front for validation
    const startIso = toIso(sd, sm, sy) || startDate;
    const endIso = customerDecidesEnd ? null : (toIso(ed, em, ey) || endDate || "");

    // Validate required fields
    const errors = [] as string[];
    if (!title) errors.push("Title is required");
    if (!involvedCountry) errors.push("Involved Country is required");
    if (!customerId) errors.push("Customer is required");
    if (!products.length || !products[0].catClass) errors.push("At least one product with Cat. Class is required");
    if (!startIso) errors.push("Start Date is required");
    if (!jobsiteAddress.trim()) errors.push("Jobsite Address is required");
    if (!jobsiteContactId) errors.push("Jobsite Contact is required");

    if (errors.length > 0) {
      setError(errors.join("\n"));
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      // Get the selected contact information
        const selectedContact = contacts.find(c => c.id === jobsiteContactId);
      const jobsiteContactData = selectedContact ? {
            id: selectedContact.id,
            name: selectedContact.name,
            phone: selectedContact.phone,
            email: selectedContact.email || "",
            type: selectedContact.type
      } : null;

      const quoteRequestData = {
        title,
        creatorCountry,
        involvedCountry,
        customer: customerId,
        customerNumber,
        status,
        isArchived,
        products,
        jobsite: {
          address: jobsiteAddress,
          coordinates: jobsiteCoords
        },
        latitude: jobsiteCoords?.lat ?? null,
        longitude: jobsiteCoords?.lng ?? null,
        startDate: startIso,
        endDate: endIso,
        customerDecidesEnd,
        jobsiteContactId,
        jobsiteContact: jobsiteContactData,
        urgent: urgentFlag,
        notes,
        attachments,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user?.email || "",
        lastUpdatedBy: user?.email || ""
      };

      const docRef = await addDoc(collection(db as Firestore, "quoteRequests"), quoteRequestData);
        setSuccess("Quote request created successfully!");
        
        // Show success message and redirect to dashboard instead of edit page
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
    } catch (err) {
      console.error("Error creating quote request:", err);
        setError(err instanceof Error ? err.message : "Failed to create quote request");
    } finally {
        setSubmitting(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => router.push('/quote-requests')}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Return to Quote Requests
        </button>
      </div>
    );
  }

  return (
    <div className="w-full p-8 bg-white mt-8">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Status - Locked to "New" during creation */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <div className="mt-1 p-3 bg-gray-50 border border-gray-300 rounded-md">
            <div className="flex items-center">
              <span className="text-gray-700 font-medium">New</span>
              <span className="ml-2 text-sm text-gray-500">(Status will be "New" until the involved country responds)</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            required
          />
        </div>

        {/* Creator Country */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Creator Country <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={creatorCountry}
            disabled
            className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
          />
        </div>

        {/* Involved Country */}
        <div>
          <CountrySelect
            value={involvedCountry}
            onChange={setInvolvedCountry}
            required
            label="Involved Country"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Customer */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Customer <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 flex gap-2">
            <select
              value={customerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select a customer</option>
              {customers
                ?.filter((c: any) => {
                  // Only show customers created by the current user's country
                  const ownerCountry = (c as any).ownerCountry || '';
                  return ownerCountry === userProfile?.businessUnit;
                })
                .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)))
                .map((customer: Customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Customer Number */}
        {customerId && involvedCountry && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Customer Number for {involvedCountry}
            </label>
            <input
              type="text"
              value={customerNumber}
              readOnly
              className="mt-1 block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm"
            />
          </div>
        )}

        {/* Jobsite Selection - Temporarily Disabled */}
        {/* {customerId && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Jobsite <span className="text-red-500">*</span>
            </label>
            <div className="mt-1">
              <select
                value={selectedJobsiteId}
                onChange={(e) => handleJobsiteChange(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="">Select a jobsite...</option>
                {jobsites.map((jobsite) => (
                  <option key={jobsite.id} value={jobsite.id}>
                    {jobsite.jobsiteName} - {jobsite.address}
                  </option>
                ))}
                <option value="new">+ Add New Jobsite</option>
              </select>
            </div>
          </div>
        )} */}

        {/* Products */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Products <span className="text-red-500">*</span>
          </label>
          {products.map((product, idx) => (
            <div key={idx} className="flex gap-2 mb-2">
              <input
                type="text"
                value={product.catClass}
                onChange={(e) => {
                  const newProducts = [...products];
                  newProducts[idx].catClass = e.target.value;
                  setProducts(newProducts);
                }}
                placeholder="Cat. Class"
                className="block w-1/4 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={async () => {
                  const code = normalizeCode(products[idx].catClass);
                  if (!code) return;
                  const p = await getProductByCode(code);
                  if (p) {
                    const newProducts = [...products];
                    newProducts[idx].catClass = p.catClass;
                    newProducts[idx].description = p.description;
                    setProducts(newProducts);
                  } else {
                    const confirmAdd = confirm('Product not found. Add to catalog?');
                    if (!confirmAdd) return;
                    setQuickAdd({ index: idx, code });
                    setQuickAddCode(code);
                  }
                }}
                className="text-blue-600 underline text-xs self-center"
              >Lookup</button>
              <input
                type="text"
                value={product.description}
                onChange={(e) => {
                  const newProducts = [...products];
                  newProducts[idx].description = e.target.value;
                  setProducts(newProducts);
                }}
                placeholder="Description"
                className="block w-1/2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="number"
                value={product.quantity}
                onChange={(e) => {
                  const newProducts = [...products];
                  newProducts[idx].quantity = parseInt(e.target.value);
                  setProducts(newProducts);
                }}
                placeholder="Qty"
                className="block w-1/6 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  const newProducts = products.filter((_, i) => i !== idx);
                  setProducts(newProducts);
                }}
                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setProducts([...products, { catClass: "", description: "", quantity: 1 }])}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Add Product
          </button>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <DateInput label="Start Date" value={startDate} onChange={(iso)=>{ setStartDate(iso); setSd(iso?iso.slice(8,10):''); setSm(iso?iso.slice(5,7):''); setSy(iso?iso.slice(0,4):''); }} required />
          </div>
          <div>
            <DateInput 
              label="End Date" 
              value={endDate} 
              onChange={setEndDate} 
              disabled={customerDecidesEnd}
              min={startDate || undefined}
            />
            <div className="mt-2">
              <label className="inline-flex items-center">
                <input
                  type="checkbox"
                  checked={customerDecidesEnd}
                  onChange={(e) => setCustomerDecidesEnd(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">Customer decides end date</span>
              </label>
            </div>
          </div>
        </div>

        {/* Urgent toggle */}
        <div className="flex items-center gap-2">
          <input
            id="urgentToggle"
            type="checkbox"
            checked={urgentFlag}
            onChange={(e) => setUrgentFlag(e.target.checked)}
            className="rounded border-gray-300 text-red-600 shadow-sm focus:border-red-500 focus:ring-red-500"
          />
          <label htmlFor="urgentToggle" className="text-sm text-gray-700">Mark as Urgent</label>
        </div>

        {/* Jobsite Address */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Jobsite Address <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={jobsiteAddress}
            onChange={(e) => setJobsiteAddress(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter full address"
            required
          />
          
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Latitude</label>
              <input
                type="number"
                step="any"
                value={jobsiteCoords?.lat || ''}
                onChange={(e) => {
                  const lat = parseFloat(e.target.value);
                  if (!isNaN(lat)) {
                    setJobsiteCoords(prev => ({
                      lat,
                      lng: prev?.lng || 0
                    }));
                  }
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="e.g., 51.9244"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Longitude</label>
              <input
                type="number"
                step="any"
                value={jobsiteCoords?.lng || ''}
                onChange={(e) => {
                  const lng = parseFloat(e.target.value);
                  if (!isNaN(lng)) {
                    setJobsiteCoords(prev => ({
                      lat: prev?.lat || 0,
                      lng
                    }));
                  }
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="e.g., 4.4777"
              />
            </div>
          </div>
        </div>

        {/* Jobsite Contact */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">
            Jobsite Contact <span className="text-red-500">*</span>
          </label>
          <div className="mt-1 space-y-4">
            <select
              value={jobsiteContactId}
              onChange={(e) => setJobsiteContactId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            >
              <option value="">Select a contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.phone}){contact.type === 'first' ? ' (First Contact)' : ''}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowNewContact(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Add New Contact
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes
          </label>
          <div className="space-y-2">
            {/* Existing Notes */}
            {notes.map((note, idx) => (
              <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="text-sm text-gray-600 mb-1">
                  {note.author} - {new Date(note.dateTime).toLocaleString()}
                </div>
                <div className="text-gray-800">{note.text}</div>
              </div>
            ))}
            
            {/* Add New Note */}
            <div className="flex gap-2">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                rows={3}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Add Note
              </button>
            </div>
          </div>
        </div>

        {/* Attachments */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Attachments</label>
          <FileUpload
            quoteRequestId="new"
            files={attachments}
            onFilesChange={handleFileSelect}
            currentUser={user?.email || ""}
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {submitting ? "Creating..." : "Create Quote Request"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
      </form>

      {/* New Contact Modal */}
      {showNewContact && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium mb-4">Add New Contact</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={newContact.name}
                  onChange={(e) => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="text"
                  value={newContact.phone}
                  onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewContact(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewContact}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Quick Add Product Modal */}
      {quickAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded p-4 w-full max-w-md space-y-3">
            <h3 className="text-lg font-semibold">Add product to catalog</h3>
            <div>
              <label className="block text-sm mb-1">Cat-Class</label>
              <input value={quickAddCode || quickAdd.code} onChange={e=>setQuickAddCode(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <input value={quickAddDesc} onChange={e=>setQuickAddDesc(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>{ setQuickAdd(null); setQuickAddDesc(''); }} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={async()=>{
                try {
                  const code = normalizeCode(quickAddCode || quickAdd.code);
                  if (!code || !quickAddDesc.trim()) return;
                  const { upsertProduct } = await import('../../utils/products');
                  await upsertProduct({ catClass: code, description: quickAddDesc.trim(), active: true });
                  const newProducts = [...products];
                  newProducts[quickAdd.index].catClass = code;
                  newProducts[quickAdd.index].description = quickAddDesc.trim();
                  setProducts(newProducts);
                  setQuickAdd(null);
                  setQuickAddDesc('');
                  setQuickAddCode('');
                } catch (e:any) {
                  alert(e?.message || 'Failed to add product');
                }
              }} className="px-3 py-2 bg-[#e40115] text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
      
      {/* New Jobsite Modal - Temporarily Disabled */}
      {/* {showJobsiteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium mb-4">Add New Jobsite</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jobsite Name *
                </label>
                <input
                  type="text"
                  value={newJobsite.jobsiteName}
                  onChange={(e) => setNewJobsite(prev => ({ ...prev, jobsiteName: e.target.value }))}
                  placeholder="e.g., Main Construction Site"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <textarea
                  value={newJobsite.address}
                  onChange={(e) => setNewJobsite(prev => ({ ...prev, address: e.target.value }))}
                  rows={3}
                  placeholder="Full jobsite address"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Latitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newJobsite.latitude}
                    onChange={(e) => setNewJobsite(prev => ({ ...prev, latitude: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.000000"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longitude
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={newJobsite.longitude}
                    onChange={(e) => setNewJobsite(prev => ({ ...prev, longitude: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.000000"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name *
                  </label>
                  <input
                    type="text"
                    value={newJobsite.contactName}
                    onChange={(e) => setNewJobsite(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Contact person name"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Phone *
                  </label>
                  <input
                    type="tel"
                    value={newJobsite.contactPhone}
                    onChange={(e) => setNewJobsite(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="Phone number"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowJobsiteModal(false);
                    setNewJobsite({
                      jobsiteName: '',
                      address: '',
                      latitude: 0,
                      longitude: 0,
                      contactName: '',
                      contactPhone: ''
                    });
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateJobsite}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                >
                  Create Jobsite
                </button>
              </div>
            </div>
          </div>
        </div>
      )} */}
    </div>
  );
};

export default dynamic(() => Promise.resolve(NewQuoteRequestPage), { ssr: false });