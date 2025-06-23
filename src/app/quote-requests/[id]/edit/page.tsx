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

// Add Google Maps types
declare global {
  interface Window {
    google: any;
  }
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
  catClass: string;
  description: string;
  quantity: number;
}

interface Note {
  text: string;
  user: string;
  dateTime: string;
}

interface QuoteRequest {
  id: string;
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
  waitingForAnswer?: boolean;
  urgent?: boolean;
  problems?: boolean;
  targetCountry?: string;
}

type StatusType = "In Progress" | "Snoozed" | "Won" | "Lost" | "Cancelled";

if (!db) {
  throw new Error("Firestore is not initialized");
}

const statuses = ["In Progress", "Snoozed", "Won", "Lost", "Cancelled"];
const GEOCODING_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function EditQuoteRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const isReadOnly = false; // Removed read-only restriction as requested
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<QuoteRequest | null>(null);
  const [original, setOriginal] = useState<QuoteRequest | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { customers, loading: customersLoading, error: customersError } = useCustomers();
  const [contacts, setContacts] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
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
            involvedCountry: data.involvedCountry || "",
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
            updatedAt: data.updatedAt,
            waitingForAnswer: data.waitingForAnswer || false,
            urgent: data.urgent || false,
            problems: data.problems || false,
            targetCountry: data.targetCountry || ""
          };
          setForm(formattedData);
          setOriginal(formattedData);
          setAttachments(formattedData.attachments);
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
    const fetchLabels = async () => {
      if (!db) return;
      try {
        const snapshot = await getDocs(collection(db as Firestore, "labels"));
        setLabels(snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        })));
      } catch (err) {
        console.error("Error fetching labels:", err);
      }
    };
    fetchLabels();
  }, []);

  useEffect(() => {
    setIsArchived(form?.status !== "In Progress");
  }, [form?.status]);

  useEffect(() => {
    if (!window.google) {
      // Initialize Google Maps
      const script = document.createElement('script');
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setIsGoogleMapsLoaded(true);
        
        // Initialize Places Autocomplete
        if (addressInputRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
            types: ['address'],
            fields: ['geometry', 'formatted_address']
          });

          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();
              const coordinates = `${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`;
              handleChange("gpsCoordinates", coordinates);
              handleChange("jobsiteAddress", place.formatted_address);
            }
          });
        }
      };
      document.head.appendChild(script);

      return () => {
        document.head.removeChild(script);
      };
    } else {
      setIsGoogleMapsLoaded(true);
    }
  }, []);

  const handleChange = (field: string, value: any) => {
    if (!form) return;
    
    if (field === 'jobsite.coordinates.lat' || field === 'jobsite.coordinates.lng') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) return;
      
      setForm({
        ...form,
        jobsite: {
          ...form.jobsite,
          coordinates: {
            ...form.jobsite.coordinates,
            [field.split('.').pop()!]: numValue
          }
        }
      });
      return;
    }
    
    if (field === 'jobsite.address') {
      setForm({
        ...form,
        jobsite: {
          ...form.jobsite,
          address: value
        }
      });
      return;
    }
    
    setForm({ ...form, [field]: value });
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

  const handleLabelToggle = (id: string) => {
    setForm((prev: any) => ({
      ...prev,
      labels: prev.labels?.includes(id)
        ? prev.labels.filter((l: string) => l !== id)
        : (prev.labels?.length || 0) < 4
        ? [...(prev.labels || []), id]
        : prev.labels,
    }));
  };

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
    if (!address || address.length < 5) {
      setForm(prev => ({
        ...prev,
        jobsite: {
          ...prev.jobsite,
          address,
          coordinates: null
        }
      }));
      setGeocodingError("");
      return;
    }
    
    setIsGeocoding(true);
    setGeocodingError("");
    
    try {
      // Format address to improve geocoding accuracy
      const formattedAddress = address.trim().replace(/\s+/g, ' ');
      
      // First try Places API Autocomplete
      const placesResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(formattedAddress)}&types=address&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      
      const placesData = await placesResponse.json();
      console.log('Places API response:', placesData);
      
      if (placesData.predictions && placesData.predictions.length > 0) {
        // Get place details for the first prediction
        const placeId = placesData.predictions[0].place_id;
        const detailsResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry,formatted_address&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
        );
        
        const detailsData = await detailsResponse.json();
        console.log('Place Details response:', detailsData);
        
        if (detailsData.result?.geometry?.location) {
          const { lat, lng } = detailsData.result.geometry.location;
          setForm(prev => ({
            ...prev,
            jobsite: {
              ...prev.jobsite,
              address: detailsData.result.formatted_address,
              coordinates: { lat, lng }
            }
          }));
          setGeocodingError("");
        }
      }
      // Fallback to Geocoding API
      const geocodingResponse = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(formattedAddress)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      
      const geocodingData = await geocodingResponse.json();
      console.log('Geocoding API response:', geocodingData);
      
      if (geocodingData.status === "OK" && geocodingData.results?.[0]?.geometry?.location) {
        const { lat, lng } = geocodingData.results[0].geometry.location;
        setForm(prev => ({
          ...prev,
          jobsite: {
            ...prev.jobsite,
            address: geocodingData.results[0].formatted_address,
            coordinates: { lat, lng }
          }
        }));
        setGeocodingError("");
      } else {
        setGeocodingError("Could not find coordinates for this address. Please check the address and try again.");
      }
    } catch (error) {
      console.error('Error geocoding address:', error);
      setGeocodingError("An error occurred while getting coordinates. Please try again.");
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
    <>
      <Script
        src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`}
        strategy="beforeInteractive"
      />
      <div className="flex h-full">
        {/* Main content */}
        <div className="flex-1 p-6 overflow-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Form header */}
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Link href="/quote-requests" className="text-gray-400 hover:text-gray-600">
                  Edit Quote Request
                </Link>
                <span className="text-gray-400">/</span>
                {form?.creatorCountry}
                {form?.involvedCountry && (
                  <>
                    <span className="text-gray-400">→</span>
                    {form.involvedCountry}
                  </>
                )}
              </h1>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => router.push("/quote-requests")}
                  className="px-6 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-white bg-red-600 rounded hover:bg-red-700"
                  disabled={saving || isReadOnly}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Form content */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex flex-wrap gap-4 items-center mb-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="waitingForAnswer"
                    checked={form.waitingForAnswer}
                    onChange={(e) => handleChange("waitingForAnswer", e.target.checked)}
                    disabled={isReadOnly}
                    className="h-5 w-5 text-blue-600"
                  />
                  <label htmlFor="waitingForAnswer" className="text-sm text-gray-700">
                    Waiting for Answer
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="urgent"
                    checked={form.urgent}
                    onChange={(e) => handleChange("urgent", e.target.checked)}
                    disabled={isReadOnly}
                    className="h-5 w-5 text-red-600"
                  />
                  <label htmlFor="urgent" className="text-sm text-gray-700">
                    Urgent
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="problems"
                    checked={form.problems}
                    onChange={(e) => handleChange("problems", e.target.checked)}
                    disabled={isReadOnly}
                    className="h-5 w-5 text-yellow-600"
                  />
                  <label htmlFor="problems" className="text-sm text-gray-700">
                    Problems
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_2fr_1fr] gap-8">
                {/* Left Column */}
                <div className="space-y-6">
                  <div>
                    <label className="block mb-1 font-medium">Title</label>
                    <input
                      type="text"
                      value={form.title || ""}
                      onChange={(e) => handleChange("title", e.target.value)}
                      disabled={isReadOnly}
                      className="w-full p-2 border rounded"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Creator Country</label>
                    <input
                      type="text"
                      value={form.creatorCountry || ""}
                      disabled
                      className="w-full p-2 border rounded bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Target Country</label>
                    <CountrySelect
                      value={form.involvedCountry || form.targetCountry || ""}
                      onChange={(value) => {
                        handleChange("involvedCountry", value);
                        handleChange("targetCountry", value);
                      }}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Customer</label>
                    <select
                      value={form.customer || ""}
                      onChange={(e) => handleChange("customer", e.target.value)}
                      disabled={isReadOnly}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Select customer...</option>
                      {customers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Status</label>
                    <select
                      value={form.status || ""}
                      onChange={(e) => handleChange("status", e.target.value)}
                      disabled={isReadOnly}
                      className="w-full p-2 border rounded"
                    >
                      {statuses.map(status => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Labels</label>
                    <div className="flex flex-wrap gap-2">
                      {labels.map(label => (
                        <label
                          key={label.id}
                          className={`px-3 py-1 rounded-full border cursor-pointer select-none ${
                            form.labels?.includes(label.id)
                              ? 'bg-[#e40115] text-white border-[#e40115]'
                              : 'bg-gray-100 text-gray-800 border-gray-300'
                          }`}
                          style={{
                            opacity:
                              form.labels?.length >= 4 && !form.labels?.includes(label.id)
                                ? 0.5
                                : 1,
                          }}
                        >
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={form.labels?.includes(label.id)}
                            onChange={() => handleLabelToggle(label.id)}
                            disabled={
                              isReadOnly ||
                              (!form.labels?.includes(label.id) &&
                                (form.labels?.length || 0) >= 4)
                            }
                          />
                          {label.name}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Middle Column */}
                <div className="space-y-6">
                  <div>
                    <label className="block mb-1 font-medium">Products</label>
                    {form.products?.map((product: any, idx: number) => (
                      <div key={idx} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={product.catClass || ""}
                          onChange={(e) => handleProductChange(idx, "catClass", e.target.value)}
                          placeholder="Cat. Class"
                          className="w-[150px] p-2 border rounded"
                          disabled={isReadOnly}
                        />
                        <input
                          type="text"
                          value={product.description || ""}
                          onChange={(e) => handleProductChange(idx, "description", e.target.value)}
                          placeholder="Description"
                          className="flex-1 p-2 border rounded"
                          disabled={isReadOnly}
                        />
                        <input
                          type="number"
                          value={product.quantity || ""}
                          onChange={(e) => handleProductChange(idx, "quantity", parseInt(e.target.value))}
                          placeholder="Qty"
                          className="w-20 p-2 border rounded"
                          disabled={isReadOnly}
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeProduct(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={addProduct}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        + Add Product
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block mb-1 font-medium">Notes</label>
                    <div className="space-y-2">
                      {form.notes?.map((note: any) => (
                        <div key={note.dateTime} className="text-sm bg-gray-50 p-2 rounded">
                          <div className="text-gray-500">
                            {note.user} on {new Date(note.dateTime).toLocaleString()}
                          </div>
                          <div>{note.text}</div>
                        </div>
                      ))}
                      {!isReadOnly && (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add a note..."
                            className="flex-1 p-2 border rounded"
                          />
                          <button
                            type="button"
                            onClick={addNote}
                            disabled={!newNote.trim()}
                            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
                          >
                            Add
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium">Attachments</label>
                    <FileUpload
                      files={attachments}
                      onFilesChange={files => handleChange('attachments', files)}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block mb-1 font-medium">Start Date</label>
                      <input
                        type="date"
                        value={form.startDate || ''}
                        onChange={(e) => handleChange('startDate', e.target.value)}
                        className="w-full p-2 border rounded"
                        disabled={isReadOnly}
                      />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium">End Date</label>
                      <div>
                        <input
                          type="date"
                          value={form.endDate || ''}
                          onChange={(e) => handleChange('endDate', e.target.value)}
                          className="w-full p-2 border rounded"
                          disabled={isReadOnly || form.customerDecidesEnd}
                        />
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="customerDecidesEnd"
                            checked={form.customerDecidesEnd || false}
                            onChange={(e) => {
                              handleChange('customerDecidesEnd', e.target.checked);
                              if (e.target.checked) {
                                handleChange('endDate', null);
                              }
                            }}
                            disabled={isReadOnly}
                            className="h-4 w-4"
                          />
                          <label htmlFor="customerDecidesEnd" className="text-sm text-gray-600">
                            Customer decides end date
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium">Jobsite Address</label>
                    <input
                      type="text"
                      value={form?.jobsite.address || ''}
                      onChange={(e) => handleChange('jobsite.address', e.target.value)}
                      className="w-full p-2 border rounded"
                      placeholder="Enter full address"
                      ref={addressInputRef}
                    />
                    
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          value={form?.jobsite.coordinates?.lat || ''}
                          onChange={(e) => handleChange('jobsite.coordinates.lat', e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="e.g., 51.9244"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          value={form?.jobsite.coordinates?.lng || ''}
                          onChange={(e) => handleChange('jobsite.coordinates.lng', e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="e.g., 4.4777"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block mb-1 font-medium">Jobsite Contact</label>
                    <select
                      value={form.jobsiteContactId || ""}
                      onChange={(e) => handleChange("jobsiteContactId", e.target.value)}
                      disabled={isReadOnly || !form.customer}
                      className="w-full p-2 border rounded"
                    >
                      <option value="">Select contact...</option>
                      {contacts.map(contact => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} ({contact.phone})
                        </option>
                      ))}
                    </select>
                    {!isReadOnly && form.customer && (
                      <button
                        type="button"
                        onClick={() => setShowNewContact(true)}
                        className="mt-2 text-blue-500 hover:text-blue-700"
                      >
                        + Add New Contact
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Messaging panel */}
        <div className="w-[400px] border-l border-gray-200 bg-white">
          <MessagingPanel
            quoteRequestId={params.id as string}
            messages={messages}
            onSendMessage={handleSendMessage}
            loading={messagesLoading}
            error={messagesError}
          />
        </div>
      </div>
    </>
  );
} 