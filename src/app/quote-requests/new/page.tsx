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
import { loadGoogleMaps, geocodeAddress, type Coordinates } from '../../utils/maps';
import { useCustomers } from "../../hooks/useCustomers";

// Type definitions
interface Jobsite {
  address: string;
  coordinates: Coordinates | null;
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

interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  isFirstContact?: boolean;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  contact?: string;
  phone?: string;
  email?: string;
  customerNumbers?: { [country: string]: string };
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
  const { customers, loading: customersLoading, error: customersError } = useCustomers();
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
  const [jobsiteCoords, setJobsiteCoords] = useState<Coordinates | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerDecidesEnd, setCustomerDecidesEnd] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
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
  const [customerNumber, setCustomerNumber] = useState("");

  // Initialize Google Maps
  useEffect(() => {
    const initMaps = async () => {
      if (!window.google) {
        try {
          await loadGoogleMaps();
          if (isMounted.current) {
            setIsGoogleMapsLoaded(true);
            console.log('Google Maps loaded successfully');
          }
        } catch (error) {
          console.error('Error loading Google Maps:', error);
          if (isMounted.current) {
            setError("Failed to load Google Maps");
            setGeocodingError("Failed to load Google Maps API");
          }
        }
      }
    };

    initMaps();

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle address changes and geocoding
  const handleAddressChange = useCallback(async (address: string) => {
    if (!address) {
      setJobsiteCoords(null);
      setGeocodingError("");
      return;
    }

    setIsGeocoding(true);
    setGeocodingError("");

    try {
      const coordinates = await geocodeAddress(address);
      
      if (isMounted.current) {
        console.log('Geocoding result:', { address, ...coordinates });
        setJobsiteCoords(coordinates);
        setJobsiteAddress(address);
        setGeocodingError("");
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      if (isMounted.current) {
        setGeocodingError("Failed to get coordinates. Please check the address and try again.");
        setJobsiteCoords(null);
      }
    } finally {
      if (isMounted.current) {
        setIsGeocoding(false);
      }
    }
  }, [isMounted]);

  // Debounce the address change handler
  const debouncedHandleAddressChange = useCallback(
    debounce((address: string) => handleAddressChange(address), 1000),
    [handleAddressChange]
  );

  // Update jobsite address input
  const handleJobsiteAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const address = e.target.value;
    setJobsiteAddress(address);
    debouncedHandleAddressChange(address);
  };

  // Fetch contacts when customer changes
  useEffect(() => {
    const fetchContacts = async () => {
      if (!customerId || !db || !isMounted.current) return;

      try {
        let fetchedContacts: Contact[] = [];
        
        // First check if there's a contact in the customer document
        const customerDoc = await getDoc(doc(db as Firestore, "customers", customerId));
        if (customerDoc.exists()) {
          const customerData = customerDoc.data();
          if (customerData.contact && customerData.phone) {
            // Add the first contact to the list
            fetchedContacts.push({
              id: 'main',
              name: customerData.contact,
              phone: customerData.phone,
              email: customerData.email || '',
              isFirstContact: true
            });
          }
        }

        // Then fetch contacts from the subcollection
        const contactsRef = collection(db as Firestore, `customers/${customerId}/contacts`);
        const contactsSnapshot = await getDocs(contactsRef);
        const subcollectionContacts = contactsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name,
          phone: doc.data().phone,
          email: doc.data().email,
          isFirstContact: false
        }));
        
        // Combine both sets of contacts
        fetchedContacts = [...fetchedContacts, ...subcollectionContacts];
        
        if (isMounted.current) {
          setContacts(fetchedContacts);
          console.log('Fetched contacts:', fetchedContacts);
          
          // Do not auto-select any contact
          setJobsiteContactId("");
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
        if (isMounted.current) {
          setError("Failed to fetch contacts");
        }
      }
    };

    fetchContacts();
  }, [customerId, db, isMounted]);

  // Handle customer selection
  const handleCustomerChange = useCallback(async (selectedCustomerId: string) => {
    setCustomerId(selectedCustomerId);
    setJobsiteContactId(""); // Reset contact when customer changes
    setContacts([]); // Reset contacts when customer changes

    if (!selectedCustomerId || !db) return;

    try {
      // Fetch customer details
      const customerDoc = await getDoc(doc(db as Firestore, "customers", selectedCustomerId));
      if (customerDoc.exists()) {
        const customerData = customerDoc.data();
        setCustomerDetails(customerData);
        console.log('Fetched customer details:', customerData);
      }
    } catch (err) {
      console.error("Error fetching customer details:", err);
      setError("Failed to fetch customer details");
    }
  }, [db]);

  // Update customer number when involved country or customer changes
  useEffect(() => {
    if (customerId && involvedCountry) {
      const selectedCustomer = customers.find(c => c.id === customerId);
      if (selectedCustomer?.customerNumbers?.[involvedCountry]) {
        setCustomerNumber(selectedCustomer.customerNumbers[involvedCountry]);
      } else {
        setCustomerNumber("");
      }
    } else {
      setCustomerNumber("");
    }
  }, [customerId, involvedCountry, customers]);

  // Form submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !db || !isMounted.current) return;

    setSubmitting(true);
    setError("");

    try {
      // Get the selected contact information
      let jobsiteContactData = null;
      if (jobsiteContactId) {
        const selectedContact = contacts.find(c => c.id === jobsiteContactId);
        if (selectedContact) {
          jobsiteContactData = {
            id: selectedContact.id,
            name: selectedContact.name,
            phone: selectedContact.phone,
            email: selectedContact.email || ""
          };
        }
      }

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

      console.log('Submitting quote request:', quoteRequestData);
      await addDoc(collection(db as Firestore, "quoteRequests"), quoteRequestData);

      if (isMounted.current) {
        setSuccess("Quote request created successfully!");
        router.push("/dashboard"); // Redirect to dashboard instead of individual quote request
      }
    } catch (err) {
      console.error("Error creating quote request:", err);
      if (isMounted.current) {
        setError("Failed to create quote request");
      }
    } finally {
      if (isMounted.current) {
        setSubmitting(false);
      }
    }
  };

  // Add effect to update archived state based on status
  useEffect(() => {
    setIsArchived(status !== "In Progress");
  }, [status]);

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

  const handleAddNewContact = useCallback(async () => {
    if (!customerId || !db || !newContact.name || !newContact.phone) {
      setError("Please fill in all required contact fields");
      return;
    }

    try {
      const contactsRef = collection(db as Firestore, `customers/${customerId}/contacts`);
      const contactData: Omit<Contact, 'id'> = {
        name: newContact.name,
        phone: newContact.phone
      };

      const docRef = await addDoc(contactsRef, {
        ...contactData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // Add the new contact to the contacts list
      const newContactWithId: Contact = {
        id: docRef.id,
        ...contactData
      };
      setContacts(prev => [...prev, newContactWithId]);
      
      // Set the new contact as the jobsite contact
      setJobsiteContactId(docRef.id);

      // Reset form and close modal
      setNewContact({ name: "", phone: "" });
      setShowNewContact(false);
    } catch (err) {
      console.error("Error creating new contact:", err);
      setError("Failed to create new contact");
    }
  }, [customerId, db, newContact.name, newContact.phone]);

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
          <p className="mt-1 text-sm text-gray-500">Only the creator country can change the status.</p>
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
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewCustomer(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              New
            </button>
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
                onChange={(e) => handleProductChange(idx, "catClass", e.target.value)}
                placeholder="Cat. Class"
                className="block w-1/4 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="text"
                value={product.description}
                onChange={(e) => handleProductChange(idx, "description", e.target.value)}
                placeholder="Description"
                className="block w-1/2 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="number"
                value={product.quantity}
                onChange={(e) => handleProductChange(idx, "quantity", parseInt(e.target.value))}
                placeholder="Qty"
                className="block w-1/6 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => removeProduct(idx)}
                className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addProduct}
            className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
          >
            Add Product
          </button>
        </div>

        {/* Jobsite Address */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Jobsite Address</label>
          <input
            type="text"
            value={jobsiteAddress}
            onChange={(e) => setJobsiteAddress(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            placeholder="Enter full address"
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
          <p className="mt-2 text-sm text-gray-500">
            You can find coordinates by right-clicking a location on Google Maps and selecting "What's here?"
          </p>
        </div>

        {/* Jobsite Contact */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700">Jobsite Contact</label>
          <div className="flex items-center gap-2">
            <select
              value={jobsiteContactId}
              onChange={(e) => setJobsiteContactId(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select a contact</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name} ({contact.phone}){contact.isFirstContact ? ' (First Contact)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setShowNewContact(true)}
              className="mt-1 inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              New Contact
            </button>
          </div>
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

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg w-96">
            <h3 className="text-lg font-medium mb-4">Add New Customer</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Customer Name"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                placeholder="Address"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newCustomer.contact}
                onChange={(e) => setNewCustomer({ ...newCustomer, contact: e.target.value })}
                placeholder="Contact Person"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="tel"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Phone"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <input
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="Email"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewCustomer}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Add Customer
              </button>
            </div>
          </div>
        </div>
      )}

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
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewContact}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Add Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 