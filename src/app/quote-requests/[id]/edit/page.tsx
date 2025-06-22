"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp, addDoc, Firestore, DocumentData } from "firebase/firestore";
import { db } from "@/firebaseClient";
import { useAuth } from "../../../AuthProvider";
import FileUpload from "../../../components/FileUpload";
import FileUploadSimple from "../../../components/FileUploadSimple";
import ArchivedMessaging from "../../../components/ArchivedMessaging";
import CountrySelect from "../../../components/CountrySelect";
import MessagingPanel from '@/app/components/MessagingPanel';
import { useMessages } from '@/app/hooks/useMessages';
import { useCustomers } from '../../../hooks/useCustomers';
import Link from "next/link";
import { debounce } from "lodash";
import Script from "next/script";
import dayjs from "dayjs";

// Add Google Maps types
declare global {
  interface Window {
    google: any;
  }
}

interface Label {
  id: string;
  name: string;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface Jobsite {
  address: string;
  coordinates: Coordinates | null;
}

interface Product {
  catClass?: string;
  description?: string;
  quantity?: number;
}

interface Note {
  dateTime: string;
  text: string;
  user: string;
}

interface QuoteRequest {
  id: string;
  title?: string;
  creatorCountry?: string;
  involvedCountry?: string;
  customer?: string;
  status?: string;
  products?: Product[];
  jobsite: {
    address: string;
    coordinates: Coordinates | null;
  };
  startDate?: string;
  endDate?: string | null;
  customerDecidesEnd?: boolean;
  jobsiteContactId?: string;
  jobsiteContact?: any;
  labels?: string[];
  notes?: Note[];
  attachments?: any[];
  createdAt?: any;
  updatedAt?: any;
}

type StatusType = "In Progress" | "Snoozed" | "Won" | "Lost" | "Cancelled";

if (!db) {
  throw new Error("Firestore is not initialized");
}

const statuses = ["In Progress", "Snoozed", "Won", "Lost", "Cancelled"];
const GEOCODING_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const LABEL_OPTIONS: Label[] = [
  { id: 'waiting-for-answer', name: 'Waiting for Answer' },
  { id: 'urgent', name: 'Urgent' },
  { id: 'problems', name: 'Problems' },
  { id: 'planned', name: 'Planned' }
];

export default function EditQuoteRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const isReadOnly = userProfile?.role === "readOnly";
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<QuoteRequest | null>(null);
  const [original, setOriginal] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "" });
  const [isArchived, setIsArchived] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const { messages, loading: messagesLoading, error: messagesError, sendMessage } = useMessages(params.id as string);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingError, setGeocodingError] = useState("");
  const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const { customers, loading: customersLoading, error: customersError } = useCustomers();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!db) {
        setError("Database not initialized");
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db as Firestore, "quoteRequests", params.id as string);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          const formattedData: QuoteRequest = {
            id: snap.id,
            title: data.title || "",
            creatorCountry: data.creatorCountry || "",
            involvedCountry: data.involvedCountry || data.targetCountry || "",
            customer: data.customer || "",
            status: data.status || "",
            products: data.products || [],
            jobsite: {
              address: data.jobsite?.address || data.jobsiteAddress || "",
              coordinates: data.jobsite?.coordinates || null
            },
            startDate: data.startDate || "",
            endDate: data.endDate || null,
            customerDecidesEnd: data.customerDecidesEnd || false,
            jobsiteContactId: data.jobsiteContactId || "",
            jobsiteContact: data.jobsiteContact || null,
            labels: data.labels || [],
            notes: data.notes || [],
            attachments: data.attachments || [],
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
          };
          setForm(formattedData);
          setOriginal(formattedData);
          setAttachments(formattedData.attachments || []);
        } else {
          setError("Quote Request not found");
        }
      } catch (err) {
        console.error("Error fetching quote request:", err);
        setError("Failed to load quote request");
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!db || !form?.customer) return;
      try {
        // First try to fetch from the subcollection
        const contactsRef = collection(db as Firestore, `customers/${form.customer}/contacts`);
        const snapshot = await getDocs(contactsRef);
        let fetchedContacts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // If no contacts found in subcollection, check if there's a contact in the customer document
        if (fetchedContacts.length === 0) {
          const customerDoc = await getDoc(doc(db as Firestore, "customers", form.customer));
          if (customerDoc.exists()) {
            const customerData = customerDoc.data();
            if (customerData.contact && customerData.phone) {
              // Create a contact from the customer's contact info
              fetchedContacts = [{
                id: 'main',
                name: customerData.contact,
                phone: customerData.phone,
                email: customerData.email || ''
              }];
            }
          }
        }

        setContacts(fetchedContacts);
        console.log('Fetched contacts:', fetchedContacts);

        // If there's exactly one contact and no contact is selected, auto-select it
        if (fetchedContacts.length === 1 && !form.jobsiteContactId) {
          handleChange('jobsiteContactId', fetchedContacts[0].id);
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
      }
    };
    fetchContacts();
  }, [form?.customer, db]);

  useEffect(() => {
    setIsArchived(form?.status !== "In Progress");
  }, [form?.status]);

  useEffect(() => {
    // Load Google Maps script if not already loaded
    if (!window.google?.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('Google Maps script loaded');
        setIsGoogleMapsLoaded(true);
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps script');
        setGeocodingError('Failed to load Google Maps');
      };
      document.head.appendChild(script);
    } else {
      setIsGoogleMapsLoaded(true);
    }
  }, []);

  // Re-geocode address when Google Maps is loaded
  useEffect(() => {
    if (isGoogleMapsLoaded && form?.jobsite?.address && !form.jobsite.coordinates) {
      handleAddressChange(form.jobsite.address);
    }
  }, [isGoogleMapsLoaded, form?.jobsite?.address]);

  useEffect(() => {
    const fetchLabels = async () => {
      if (!db) return;
      try {
        // First try to fetch from Firestore
        const labelsRef = collection(db as Firestore, "labels");
        const snapshot = await getDocs(labelsRef);
        
        if (!snapshot.empty) {
          const fetchedLabels = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
          }));
          setLabels(fetchedLabels);
        } else {
          // If no labels in Firestore, use default labels
          setLabels(LABEL_OPTIONS);
        }
      } catch (err) {
        console.error("Error fetching labels:", err);
        // Fallback to default labels
        setLabels(LABEL_OPTIONS);
      }
    };

    fetchLabels();
  }, [db]);

  const handleChange = (field: string, value: any) => {
    if (!form) return;
    
    setForm(prev => {
      if (!prev) return prev;
      
      if (field === 'jobsite.address') {
        return {
          ...prev,
          jobsite: {
            ...prev.jobsite,
            address: value || '',
            coordinates: prev.jobsite.coordinates
          }
        } as QuoteRequest;
      }
      
      if (field === 'jobsite.coordinates.lat' || field === 'jobsite.coordinates.lng') {
        const [_, __, coord] = field.split('.');
        return {
          ...prev,
          jobsite: {
            ...prev.jobsite,
            coordinates: {
              ...prev.jobsite.coordinates,
              [coord]: value ? Number(value) : 0
            }
          }
        } as QuoteRequest;
      }
      
      return {
        ...prev,
        [field]: value
      } as QuoteRequest;
    });
  };

  const handleProductChange = (idx: number, field: string, value: string | number) => {
    setForm((prev: any) => ({
      ...prev,
      products: prev.products.map((p: any, i: number) => (i === idx ? { ...p, [field]: value } : p)),
    }));
  };

  const addProduct = () => {
    setForm((prev: any) => ({
      ...prev,
      products: [...(prev.products || []), { catClass: "", description: "", quantity: 1 }],
    }));
  };

  const removeProduct = (idx: number) => {
    setForm((prev: any) => ({
      ...prev,
      products: prev.products.filter((_: any, i: number) => i !== idx),
    }));
  };

  const handleLabelToggle = useCallback((id: string) => {
    if (!form) return;
    
    setForm(prev => {
      if (!prev) return prev;
      
      const currentLabels = prev.labels || [];
      const updatedLabels = currentLabels.includes(id)
        ? currentLabels.filter(l => l !== id)
        : currentLabels.length < 4
        ? [...currentLabels, id]
        : currentLabels;

      return {
        ...prev,
        labels: updatedLabels
      };
    });
  }, [form]);

  const handleAddNewContact = async () => {
    if (!db || !newContact.name || !newContact.phone || !form?.customer) return;
    try {
      const contactsRef = collection(db as Firestore, `customers/${form.customer}/contacts`);
      const docRef = await addDoc(contactsRef, {
        ...newContact,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      const addedContact = { id: docRef.id, ...newContact };
      setContacts(prev => [...prev, addedContact]);
      handleChange('jobsiteContactId', docRef.id);
      setShowNewContact(false);
      setNewContact({ name: "", phone: "" });
    } catch (err) {
      console.error("Error adding new contact:", err);
    }
  };

  const handleAddressChange = async (address: string) => {
    if (!form) return;
    
    setForm(prev => ({
      ...prev!,
      jobsite: {
        ...prev!.jobsite,
        address
      }
    }));

    // Don't geocode if address is empty
    if (!address.trim()) {
      setForm(prev => ({
        ...prev!,
        jobsite: {
          address: '',
          coordinates: null
        }
      }));
      return;
    }

    // Only geocode if Google Maps is loaded
    if (!window.google?.maps?.Geocoder) {
      console.error('Google Maps Geocoder not loaded');
      setGeocodingError('Google Maps not loaded properly');
      return;
    }

    setIsGeocoding(true);
    setGeocodingError('');

    try {
      const geocoder = new window.google.maps.Geocoder();
      const result = await new Promise((resolve, reject) => {
        geocoder.geocode({ address }, (results: any, status: any) => {
          if (status === 'OK' && results?.[0]) {
            resolve(results[0]);
          } else {
            reject(new Error(`Geocoding failed: ${status}`));
          }
        });
      });

      const location = result.geometry.location;
      setForm(prev => ({
        ...prev!,
        jobsite: {
          address,
          coordinates: {
            lat: location.lat(),
            lng: location.lng()
          }
        }
      }));
    } catch (error) {
      console.error('Geocoding error:', error);
      setGeocodingError('Failed to get coordinates for this address');
      // Keep the address but set coordinates to null
      setForm(prev => ({
        ...prev!,
        jobsite: {
          address,
          coordinates: null
        }
      }));
    } finally {
      setIsGeocoding(false);
    }
  };

  // Add a debounced version of handleAddressChange
  const debouncedHandleAddressChange = useCallback(
    debounce((address: string) => handleAddressChange(address), 1000),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !form) {
      setError("Database not initialized or form not loaded");
      return;
    }
    setSaving(true);
    setError("");
    
    if (!form.customerDecidesEnd && form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("End Date cannot be before Start Date.");
      setSaving(false);
      return;
    }
    
    try {
      const docRef = doc(db as Firestore, "quoteRequests", params.id as string);
      // Compare original and form to find changes
      const changes = [];
      const sanitize = (value: any) => value === undefined ? null : value;
      for (const key in form) {
        if (key === "updatedAt" || key === "id") continue;
        if (JSON.stringify(form[key]) !== JSON.stringify(original?.[key])) {
          changes.push({ field: key, from: sanitize(original?.[key]), to: sanitize(form[key]) });
        }
      }
      
      if (changes.length > 0) {
        const modificationsCollection = collection(db as Firestore, "modifications");
        await addDoc(modificationsCollection, {
          quoteRequestId: params.id,
          dateTime: serverTimestamp(),
          user: user?.email || "Unknown",
          changes,
        });
      }
      
      await updateDoc(docRef, {
        ...form,
        updatedAt: new Date().toISOString(),
      });
      
      router.push("/quote-requests");
    } catch (err: any) {
      console.error("Error updating quote request:", err);
      setError(err.message || "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!user?.email || !userProfile?.businessUnit) {
      throw new Error('Cannot send message: User not authenticated');
    }
    await sendMessage(text, user.email, userProfile.businessUnit);
  };

  const addNote = () => {
    if (!newNote.trim() || !user?.email) return;
    
    setForm((prev: any) => ({
      ...prev,
      notes: [
        ...(prev.notes || []),
        {
          text: newNote.trim(),
          user: user.email,
          dateTime: new Date().toISOString()
        }
      ]
    }));
    setNewNote("");
  };

  if (loading || messagesLoading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!form) return null;

   return (
    <div className="w-full p-8 bg-white mt-8">
      <div className="flex items-center justify-between mb-8 border-b pb-4">
        <div className="flex items-center gap-8">
          <h1 className="text-3xl font-bold text-[#e40115]">Quote Request</h1>
          <div className="flex items-center gap-3 text-xl">
            <span>{form.creatorCountry}</span>
            <span>&rarr;</span>
            <span>{form.involvedCountry || "..."}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <Link
            href={`/quote-requests/${params.id}`}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={handleSubmit}
            disabled={saving || isReadOnly}
            className={`px-8 py-3 rounded text-lg font-semibold ${
              saving || isReadOnly
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-[#e40115] hover:bg-red-700'
            } text-white transition-colors`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <form className="grid grid-cols-[2fr_2fr_1.1fr] gap-8 w-full items-start">
        {/* Left column: Main form fields */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div>
            <label className="block mb-1 font-medium">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Creator Country</label>
            <CountrySelect
              value={form.creatorCountry}
              onChange={(value) => handleChange('creatorCountry', value)}
              disabled={isReadOnly}
              className="w-full"
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Target Country</label>
            <CountrySelect
              value={form?.involvedCountry || ""}
              onChange={(value) => handleChange("involvedCountry", value)}
              required
              disabled={isReadOnly}
              label=""
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Customer</label>
            <select
              value={form.customer}
              onChange={(e) => handleChange('customer', e.target.value)}
              disabled={isReadOnly || customersLoading}
              className="w-full px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
            >
              <option value="">Select a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Status</label>
            <select
              value={form.status}
              onChange={(e) => handleChange('status', e.target.value)}
              disabled={isReadOnly}
              className="w-full px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
            >
              <option value="">Select a status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Jobsite Address</label>
            <div className="relative">
              <input
                ref={addressInputRef}
                type="text"
                value={form.jobsite.address}
                onChange={(e) => handleAddressChange(e.target.value)}
                disabled={isReadOnly || isGeocoding}
                className="w-full px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                placeholder="Enter address"
              />
              {isGeocoding && (
                <div className="absolute right-2 top-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-500"></div>
                </div>
              )}
            </div>
            {geocodingError && (
              <p className="mt-1 text-sm text-red-600">{geocodingError}</p>
            )}
          </div>
          <div>
            <label className="block mb-1 font-medium">Labels</label>
            <div className="flex flex-wrap gap-2">
              {labels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => handleLabelToggle(label.id)}
                  disabled={isReadOnly}
                  className={`px-3 py-1 rounded-full text-sm ${
                    form.labels?.includes(label.id)
                      ? 'bg-[#e40115] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } transition-colors disabled:opacity-50`}
                >
                  {label.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Middle column: Dates, Products, Notes */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                disabled={isReadOnly}
                className="w-full px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">End Date</label>
              <input
                type="date"
                value={form.endDate || ''}
                onChange={(e) => handleChange('endDate', e.target.value)}
                disabled={isReadOnly || form.customerDecidesEnd}
                className="w-full px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.customerDecidesEnd}
              onChange={(e) => handleChange('customerDecidesEnd', e.target.checked)}
              disabled={isReadOnly}
              className="rounded text-red-600 focus:ring-red-500"
            />
            <label className="text-sm text-gray-600">Customer decides end date</label>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <label className="block font-medium">Products</label>
              <button
                onClick={addProduct}
                disabled={isReadOnly}
                className="text-sm text-[#e40115] hover:text-red-700 disabled:opacity-50"
              >
                + Add Product
              </button>
            </div>
            <div className="space-y-4">
              {form.products?.map((product, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                  <input
                    type="text"
                    value={product.catClass || ''}
                    onChange={(e) => handleProductChange(idx, 'catClass', e.target.value)}
                    placeholder="Category/Class"
                    disabled={isReadOnly}
                    className="px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                  />
                  <input
                    type="text"
                    value={product.description || ''}
                    onChange={(e) => handleProductChange(idx, 'description', e.target.value)}
                    placeholder="Description"
                    disabled={isReadOnly}
                    className="px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={product.quantity || ''}
                      onChange={(e) => handleProductChange(idx, 'quantity', parseInt(e.target.value))}
                      placeholder="Qty"
                      disabled={isReadOnly}
                      className="w-20 px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                    />
                    <button
                      onClick={() => removeProduct(idx)}
                      disabled={isReadOnly}
                      className="px-2 text-gray-400 hover:text-red-600 disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block mb-4 font-medium">Notes</label>
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  disabled={isReadOnly}
                  className="flex-1 px-3 py-2 border rounded focus:ring-red-500 focus:border-red-500 disabled:bg-gray-100"
                  onKeyPress={(e) => e.key === 'Enter' && addNote()}
                />
                <button
                  onClick={addNote}
                  disabled={isReadOnly || !newNote.trim()}
                  className={`px-4 py-2 rounded ${
                    isReadOnly || !newNote.trim()
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-[#e40115] hover:bg-red-700'
                  } text-white transition-colors`}
                >
                  Add
                </button>
              </div>
              <div className="space-y-2">
                {form.notes?.map((note, idx) => (
                  <div key={idx} className="bg-gray-50 rounded p-3">
                    <p className="text-gray-700">{note.text}</p>
                    <div className="text-xs text-gray-500 mt-1">
                      By {note.user} • {new Date(note.dateTime).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: Messaging and Attachments */}
        <div className="flex flex-col bg-white rounded shadow border">
          <div className="p-4 border-b text-xs text-gray-400 bg-gray-50">
            Created: {form.createdAt?.toDate ? dayjs(form.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : ''}<br />
            Last Updated: {form.updatedAt ? dayjs(form.updatedAt).format('YYYY-MM-DD HH:mm') : ''}
          </div>
          <div className="p-6 border-b">
            <label className="block mb-4 font-medium">Attachments</label>
            <FileUploadSimple
              quoteRequestId={params.id as string}
              files={attachments}
              onFilesChange={setAttachments}
              currentUser={user?.email || ''}
              readOnly={isReadOnly}
            />
            <div className="mt-4 space-y-2">
              {attachments.map((attachment, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#e40115] hover:text-red-700"
                  >
                    {attachment.name}
                  </a>
                  <span className="text-gray-500">({attachment.size} bytes)</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <MessagingPanel
              quoteRequestId={params.id as string}
              messages={messages}
              loading={messagesLoading}
              error={messagesError}
              onSendMessage={handleSendMessage}
              disabled={isReadOnly}
            />
          </div>
        </div>
      </form>
    </div>
  );
}