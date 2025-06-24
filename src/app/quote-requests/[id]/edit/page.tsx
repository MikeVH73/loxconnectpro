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
  coordinates: { lat: number; lng: number } | null;
}

interface Product {
  catClass: string;
  description: string;
  quantity: number;
}

interface Note {
  text: string;
  user: string | null;
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
  createdAt: string;
  updatedAt: string;
  waitingForAnswer?: boolean;
  urgent?: boolean;
  problems?: boolean;
  targetCountry?: string;
  createdBy: string;
  updatedBy: string;
  [key: string]: any; // Add index signature for dynamic access
}

type StatusType = "In Progress" | "Snoozed" | "Won" | "Lost" | "Cancelled";

if (!db) {
  throw new Error("Firestore is not initialized");
}

const statuses = ["In Progress", "Snoozed", "Won", "Lost", "Cancelled"];
const GEOCODING_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Custom Link component that handles unsaved changes
const SafeLink = ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => {
  const [hasUnsavedChanges] = useGlobalState();
  const router = useRouter();

  const handleClick = (e: React.MouseEvent) => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
      e.preventDefault();
      return;
    }
    router.push(href);
  };

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
};

// Global state for unsaved changes
let globalHasUnsavedChanges = false;
const useGlobalState = () => {
  const [state, setState] = useState(globalHasUnsavedChanges);
  
  const setGlobalState = (value: boolean) => {
    globalHasUnsavedChanges = value;
    setState(value);
  };
  
  return [state, setGlobalState] as const;
};

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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
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
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Add navigation warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle internal navigation
  const handleNavigation = (path: string) => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmed) return;
    }
    router.push(path);
  };

  // Save changes function
  const saveChanges = async (formData: QuoteRequest | null) => {
    if (!db || isReadOnly || !formData) return;
    
    try {
      setSaving(true);
      setSaveMessage("Saving...");
      
      const docRef = doc(db as Firestore, "quoteRequests", params.id as string);
      await updateDoc(docRef, {
        ...formData,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || ""
      });
      
      setOriginal(formData);
      setHasUnsavedChanges(false);
      setSaveMessage("Changes saved");
      
      // Clear save message after 2 seconds
      setTimeout(() => {
        setSaveMessage("");
      }, 2000);
      
    } catch (err) {
      console.error("Error saving:", err);
      setSaveMessage("Error saving changes");
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setSaveMessage("");
      }, 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (field: 'waitingForAnswer' | 'urgent' | 'problems', value: boolean) => {
    if (!form) return;
    
    setForm((prev: QuoteRequest | null) => {
      if (!prev) return prev;
      const updated = { ...prev };
      updated[field] = value;
      updated.updatedAt = new Date().toISOString();
      
      // Only trigger save if the value actually changed
      if (prev[field] !== value) {
        setHasUnsavedChanges(true);
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save with a longer delay for status changes
        saveTimeoutRef.current = setTimeout(() => {
          saveChanges(updated);
        }, 3000); // Longer delay for status changes
      }
      
      return updated;
    });
  };

  // Modify the handleChange function to include save status
  const handleChange = (field: string, value: any) => {
    if (!form) return;
    
    setForm((prev: QuoteRequest | null) => {
      if (!prev) return prev;
      const updated = { ...prev };
      
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        updated[parent] = {
          ...updated[parent],
          [child]: value
        };
      } else {
        updated[field] = value;
      }
      
      updated.updatedAt = new Date().toISOString();
      
      // Only set unsaved changes if the value actually changed
      if (JSON.stringify(prev[field]) !== JSON.stringify(value)) {
        setHasUnsavedChanges(true);
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(() => {
          saveChanges(updated);
        }, 2000);
      }
      
      return updated;
    });
  };

  const handleProductChange = (idx: number, field: string, value: any) => {
    if (!form) return;
    
    const updatedProducts = [...(form.products || [])];
    const oldProduct = updatedProducts[idx];
    
    // If changing cat-class, store the old value for comparison
    const oldCatClass = field === 'catClass' ? oldProduct.catClass : null;
    
    updatedProducts[idx] = {
      ...updatedProducts[idx],
      [field]: value
    };
    
    const updatedForm: QuoteRequest = {
      ...form,
      products: updatedProducts,
      updatedAt: new Date().toISOString()
    };
    
    // Only show warning if cat-class is being changed significantly
    if (field === 'catClass' && oldCatClass) {
      // Remove any non-alphanumeric characters for comparison
      const cleanOld = oldCatClass.replace(/[^a-zA-Z0-9]/g, '');
      const cleanNew = value.replace(/[^a-zA-Z0-9]/g, '');
      
      // Only show warning if the numbers actually changed
      if (cleanOld !== cleanNew) {
        const confirmed = window.confirm(
          `Are you sure you want to change the Cat-Class from "${oldCatClass}" to "${value}"? This change cannot be undone.`
        );
        if (!confirmed) {
          return; // Don't update if user cancels
        }
      }
    }
    
    setForm((prevForm: QuoteRequest | null) => prevForm ? updatedForm : null);
    setHasUnsavedChanges(true);
    
    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      saveChanges(updatedForm);
    }, 2000);
  };

  // Handle file changes
  const handleFilesChange = async (files: any[]) => {
    setAttachments(files);
    if (!form) return;

    const updatedForm: QuoteRequest = {
      ...form,
      attachments: files,
      updatedAt: new Date().toISOString(),
      updatedBy: user?.email || ""
    };
    
    setForm((prev: QuoteRequest | null) => prev ? updatedForm : null);
    // Immediate save for file changes
    await saveChanges(updatedForm);
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      if (!db) {
        setError("Database not initialized");
        setLoading(false);
        return;
      }

      // Redirect read-only users to the quote requests list
      if (userProfile?.role === "readOnly") {
        router.push("/quote-requests");
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
            createdAt: data.createdAt || "",
            updatedAt: data.updatedAt || "",
            waitingForAnswer: data.waitingForAnswer || false,
            urgent: data.urgent || false,
            problems: data.problems || false,
            targetCountry: data.targetCountry || "",
            createdBy: data.createdBy || "",
            updatedBy: data.updatedBy || ""
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
  }, [params.id, db, userProfile?.role, router]);

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
          const updatedForm = {
            ...form,
            jobsiteContactId: fetchedContacts[0].id,
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || ""
          };
          setForm(updatedForm);
          saveChanges(updatedForm);
        }
      } catch (err) {
        console.error("Error fetching contacts:", err);
      }
    };
    fetchContacts();
  }, [form?.customer, db, form, user?.email]);

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

  const handleAddProduct = () => {
    setForm((prev: QuoteRequest | null) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        products: [...(prev.products || []), { catClass: "", description: "", quantity: 1 }],
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || ""
      };
      
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveChanges(updated);
      }, 2000);
      
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleRemoveProduct = (idx: number) => {
    setForm((prev: QuoteRequest | null) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        products: prev.products.filter((_: any, i: number) => i !== idx),
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || ""
      };
      
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveChanges(updated);
      }, 2000);
      
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleLabelToggle = (id: string) => {
    setForm((prev: QuoteRequest | null) => {
      if (!prev) return prev;
      
      const updatedLabels = prev.labels?.includes(id)
        ? prev.labels.filter((l: string) => l !== id)
        : (prev.labels?.length || 0) < 4
        ? [...(prev.labels || []), id]
        : prev.labels || [];
      
      const updated = {
        ...prev,
        labels: updatedLabels,
        updatedAt: new Date().toISOString()
      };
      
      // Only trigger save if the labels actually changed
      if (JSON.stringify(prev.labels) !== JSON.stringify(updatedLabels)) {
        setHasUnsavedChanges(true);
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(() => {
          saveChanges(updated);
        }, 2000);
      }
      
      return updated;
    });
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
      setForm((prev: QuoteRequest | null) => {
        if (!prev) return prev;
        const updated = {
          ...prev,
          jobsite: {
            ...prev.jobsite,
            address,
            coordinates: null
          },
          updatedAt: new Date().toISOString(),
          updatedBy: user?.email || ""
        };
        
        // Clear existing timeout
        if (saveTimeoutRef.current) {
          clearTimeout(saveTimeoutRef.current);
        }
        
        // Set new timeout for auto-save
        saveTimeoutRef.current = setTimeout(() => {
          saveChanges(updated);
        }, 2000);
        
        return updated;
      });
      setGeocodingError("");
      setHasUnsavedChanges(true);
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
          setForm((prev: QuoteRequest | null) => {
            if (!prev) return prev;
            const updated = {
              ...prev,
              jobsite: {
                ...prev.jobsite,
                address: detailsData.result.formatted_address,
                coordinates: { lat, lng }
              },
              updatedAt: new Date().toISOString(),
              updatedBy: user?.email || ""
            };
            
            // Clear existing timeout
            if (saveTimeoutRef.current) {
              clearTimeout(saveTimeoutRef.current);
            }
            
            // Set new timeout for auto-save
            saveTimeoutRef.current = setTimeout(() => {
              saveChanges(updated);
            }, 2000);
            
            return updated;
          });
          setGeocodingError("");
          setHasUnsavedChanges(true);
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
        setForm((prev: QuoteRequest | null) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            jobsite: {
              ...prev.jobsite,
              address: geocodingData.results[0].formatted_address,
              coordinates: { lat, lng }
            },
            updatedAt: new Date().toISOString(),
            updatedBy: user?.email || ""
          };
          
          // Clear existing timeout
          if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
          }
          
          // Set new timeout for auto-save
          saveTimeoutRef.current = setTimeout(() => {
            saveChanges(updated);
          }, 2000);
          
          return updated;
        });
        setGeocodingError("");
        setHasUnsavedChanges(true);
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
    
    // Block submission for read-only users
    if (userProfile?.role === "readOnly") {
      setError("You don't have permission to edit quote requests");
      return;
    }

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
      
      const updatedForm = {
        ...form,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || ""
      };
      
      await updateDoc(docRef, updatedForm);
      await saveChanges(updatedForm);
      setOriginal(updatedForm);
      setHasUnsavedChanges(false);
      
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
    
    setForm((prev: QuoteRequest | null) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        notes: [
          ...(prev.notes || []),
          {
            text: newNote.trim(),
            user: user.email,
            dateTime: new Date().toISOString()
          }
        ],
        updatedAt: new Date().toISOString(),
        updatedBy: user?.email || ""
      };
      
      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      
      // Set new timeout for auto-save
      saveTimeoutRef.current = setTimeout(() => {
        saveChanges(updated);
      }, 2000);
      
      return updated;
    });
    setNewNote("");
    setHasUnsavedChanges(true);
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
      <div className="min-h-screen bg-gray-50">
        {/* Fixed header */}
        <div className="fixed top-0 left-0 right-0 z-10 bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => handleNavigation("/quote-requests")}
                  className="text-gray-400 hover:text-gray-600"
                >
                  Quote Request
                </button>
                <span className="text-gray-400">/</span>
                {form?.creatorCountry}
                {form?.involvedCountry && (
                  <>
                    <span className="text-gray-400">→</span>
                    {form.involvedCountry}
                  </>
                )}
              </div>
              <div className="flex items-center gap-4">
                {/* Save status message */}
                {saveMessage && (
                  <div className={`text-sm font-medium ${
                    saveMessage === "Saving..." ? "text-blue-600" :
                    saveMessage === "Changes saved" ? "text-green-600" :
                    "text-red-600"
                  }`}>
                    {saveMessage}
                  </div>
                )}
                <button
                  onClick={() => handleNavigation("/quote-requests")}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => form && saveChanges(form)}
                  className="px-4 py-2 text-white bg-red-600 rounded hover:bg-red-700 disabled:opacity-50"
                  disabled={saving || isReadOnly || !hasUnsavedChanges}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content with padding for fixed header */}
        <div className="pt-20">
          <div className="flex h-full">
            <div className="flex-1 p-6 overflow-auto">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Form header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                      <SafeLink href="/quote-requests" className="text-gray-400 hover:text-gray-600">
                        Quote Request
                      </SafeLink>
                      <span className="text-gray-400">/</span>
                      {form?.creatorCountry}
                      {form?.involvedCountry && (
                        <>
                          <span className="text-gray-400">→</span>
                          {form.involvedCountry}
                        </>
                      )}
                    </h1>
                    <SafeLink
                      href={`/quote-requests/${params.id}/edit`}
                      className="px-4 py-2 bg-[#e40115] text-white rounded-md hover:bg-[#c7010e] transition-colors shadow-sm"
                    >
                      Edit Quote Request
                    </SafeLink>
                  </div>
                </div>

                {/* Form content */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
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
                      <div className="mb-6">
                        <label className="block mb-2 font-medium">Products</label>
                        <div className="space-y-2">
                          {form?.products?.map((product, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
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
                                onChange={(e) => handleProductChange(idx, "quantity", parseInt(e.target.value) || 0)}
                                placeholder="Quantity"
                                className="w-24 p-2 border rounded"
                                disabled={isReadOnly}
                              />
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveProduct(idx)}
                                  className="p-2 text-red-600 hover:text-red-800"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={handleAddProduct}
                            className="mt-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
                          >
                            + Add Product
                          </button>
                        )}
                      </div>

                      <div>
                        <label className="block mb-1 font-medium">Notes</label>
                        <div className="space-y-2">
                          {form.notes?.map((note: any, index: number) => (
                            <div key={`note-${index}-${note.dateTime}`} className="text-sm bg-gray-50 p-2 rounded">
                              <div className="text-gray-500">
                                {note.user} on {new Date(note.dateTime).toLocaleString()}
                              </div>
                              {note.text}
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
                          quoteRequestId={params.id as string}
                          files={attachments}
                          onFilesChange={handleFilesChange}
                          currentUser={user?.email || "Unknown"}
                          readOnly={isReadOnly}
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
        </div>
      </div>
    </>
  );
}