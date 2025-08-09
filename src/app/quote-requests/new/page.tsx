"use client";
import { useState, useEffect } from "react";
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
const statuses: StatusType[] = ["New", "In Progress", "Won", "Lost", "Cancelled"];

const NewQuoteRequestPage = () => {
  const router = useRouter();
  const { userProfile, user } = useAuth();
  const { customers } = useCustomers();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Initialize state
  const [title, setTitle] = useState("");
  const creatorCountry = userProfile?.businessUnit || "";
  const [involvedCountry, setInvolvedCountry] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState<StatusType>("New");
  const [isArchived, setIsArchived] = useState(false);
  const [products, setProducts] = useState<Product[]>([
    { catClass: "", description: "", quantity: 1 },
  ]);
  const [jobsiteAddress, setJobsiteAddress] = useState("");
  const [jobsiteCoords, setJobsiteCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerDecidesEnd, setCustomerDecidesEnd] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [jobsiteContactId, setJobsiteContactId] = useState("");
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [labels, setLabels] = useState<string[]>([]);
  const [selectedLabels, setSelectedLabels] = useState<string[]>([]);
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

  // Handle customer selection
  const handleCustomerChange = async (selectedCustomerId: string) => {
    setCustomerId(selectedCustomerId);
    setJobsiteContactId("");
    setContacts([]);

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

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !db) return;

    // Validate required fields
    const errors = [];
    if (!title) errors.push("Title is required");
    if (!involvedCountry) errors.push("Involved Country is required");
    if (!customerId) errors.push("Customer is required");
    if (!products.length || !products[0].catClass) errors.push("At least one product with Cat. Class is required");
    if (!startDate) errors.push("Start Date is required");
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
        startDate,
        endDate: customerDecidesEnd ? null : endDate,
        customerDecidesEnd,
        jobsiteContactId,
        jobsiteContact: jobsiteContactData,
        labels: selectedLabels,
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
        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusType)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
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
              {customers?.map((customer: Customer) => (
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
            <label className="block text-sm font-medium text-gray-700">
              Start Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={customerDecidesEnd}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
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
              <input value={quickAdd.code} disabled className="w-full border rounded px-3 py-2 bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm mb-1">Description</label>
              <input value={quickAddDesc} onChange={e=>setQuickAddDesc(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>{ setQuickAdd(null); setQuickAddDesc(''); }} className="px-3 py-2 border rounded">Cancel</button>
              <button onClick={async()=>{
                try {
                  const code = normalizeCode(quickAdd.code);
                  if (!code || !quickAddDesc.trim()) return;
                  const { upsertProduct } = await import('../../utils/products');
                  await upsertProduct({ catClass: code, description: quickAddDesc.trim(), active: true });
                  const newProducts = [...products];
                  newProducts[quickAdd.index].catClass = code;
                  newProducts[quickAdd.index].description = quickAddDesc.trim();
                  setProducts(newProducts);
                  setQuickAdd(null);
                  setQuickAddDesc('');
                } catch (e:any) {
                  alert(e?.message || 'Failed to add product');
                }
              }} className="px-3 py-2 bg-[#e40115] text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default dynamic(() => Promise.resolve(NewQuoteRequestPage), { ssr: false });