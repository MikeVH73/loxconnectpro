"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "../../../../firebaseClient";
import { useAuth } from "../../../AuthProvider";
import FileUpload from "../../../components/FileUpload";
import FileUploadSimple from "../../../components/FileUploadSimple";
import ArchivedMessaging from "../../../components/ArchivedMessaging";
import CountrySelect from "../../../components/CountrySelect";
import MessagingPanel from '@/app/components/MessagingPanel';
import { useMessages } from '@/app/hooks/useMessages';
import Link from "next/link";

const statuses = ["In Progress", "Snoozed", "Won", "Lost", "Cancelled"];
const GEOCODING_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function EditQuoteRequestPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const isReadOnly = userProfile?.role === "readOnly";
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [original, setOriginal] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const docRef = doc(db, "quoteRequests", params.id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data: any = { ...snap.data(), id: snap.id };
        // Ensure both involvedCountry and targetCountry are set
        if (data.involvedCountry && !data.targetCountry) {
          data.targetCountry = data.involvedCountry;
        } else if (data.targetCountry && !data.involvedCountry) {
          data.involvedCountry = data.targetCountry;
        }
        setForm(data);
        setOriginal(data);
        setAttachments(data.attachments || []);
      } else {
        setError("Quote Request not found");
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  useEffect(() => {
    const fetchCustomers = async () => {
      const snapshot = await getDocs(collection(db, "customers"));
      setCustomers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCustomers();
  }, []);

  useEffect(() => {
    const fetchContacts = async () => {
      if (!form?.customer) {
        setContacts([]);
        return;
      }
      const q = query(collection(db, "contacts"), where("customer", "==", form.customer));
      const snapshot = await getDocs(q);
      setContacts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchContacts();
  }, [form?.customer]);

  useEffect(() => {
    const fetchLabels = async () => {
      const snapshot = await getDocs(collection(db, "labels"));
      setLabels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchLabels();
  }, []);

  useEffect(() => {
    setIsArchived(form?.status !== "In Progress");
  }, [form?.status]);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
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
    if (!newContact.name || !newContact.phone || !form.customer) return;
    const docRef = await addDoc(collection(db, "contacts"), {
      ...newContact,
      customer: form.customer,
      createdAt: serverTimestamp(),
    });
    const addedContact = { id: docRef.id, ...newContact, customer: form.customer };
    setContacts((prev: any[]) => [...prev, addedContact]);
    setForm((prev: any) => ({ ...prev, jobsiteContactId: docRef.id }));
    setShowNewContact(false);
    setNewContact({ name: "", phone: "" });
  };

  const handleAddressChange = async (address: string) => {
    handleChange("jobsiteAddress", address);
    
    // Clear previous error
    setGeocodingError("");
    
    // Don't geocode if the address is too short
    if (address.length < 5) return;
    
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GEOCODING_API_KEY}`
      );
      const data = await response.json();
      
      if (data.status === "OK" && data.results[0]?.geometry?.location) {
        const { lat, lng } = data.results[0].geometry.location;
        const coordinates = `${lat.toFixed(6)}° N, ${lng.toFixed(6)}° E`;
        handleChange("gpsCoordinates", coordinates);
      }
    } catch (error) {
      console.error("Geocoding error:", error);
      setGeocodingError("Could not get GPS coordinates automatically");
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    // Date validation
    if (!form.customerDecidesEnd && form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("End Date cannot be before Start Date.");
      setSaving(false);
      return;
    }
    try {
      const docRef = doc(db, "quoteRequests", params.id as string);
      // Compare original and form to find changes
      const changes = [];
      const sanitize = (value: any) => value === undefined ? null : value;
      for (const key in form) {
        if (key === "updatedAt" || key === "id") continue;
        if (JSON.stringify(form[key]) !== JSON.stringify(original[key])) {
          changes.push({ field: key, from: sanitize(original[key]), to: sanitize(form[key]) });
        }
      }
      if (changes.length > 0) {
        await addDoc(collection(db, "modifications"), {
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
    <div className="flex h-full">
      {/* Main content with scaling */}
      <div className="flex-1 transform scale-[0.85] origin-top-left min-h-screen">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
                <Link href="/quote-requests" className="text-gray-400 hover:text-gray-600">
                  Edit Quote Request
                </Link>
                <span className="text-gray-400">/</span>
                {form.creatorCountry}
                {form.targetCountry && (
                  <>
                    <span className="text-gray-400">→</span>
                    {form.targetCountry}
                  </>
                )}
              </h1>
            </div>

            <div className="flex flex-wrap gap-4 items-center">
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

            <div className="p-6">
              <div className="grid grid-cols-[1fr_2fr_1fr] gap-6">
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
                </div>

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
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block mb-1 font-medium">Jobsite Address</label>
                    <div className="text-xs text-gray-500 mb-2">
                      Enter a complete address including street, number, city, and country
                    </div>
                    <input
                      type="text"
                      value={form.jobsiteAddress || ""}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      disabled={isReadOnly}
                      className="w-full p-2 border rounded"
                      placeholder="e.g. Schuttevaerweg 19 3044BA Rotterdam, Netherlands"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="block mb-1 font-medium">GPS Coordinates</label>
                    <div className="text-xs text-gray-500 mb-2">
                      {isGeocoding ? (
                        <span className="text-blue-500">Getting coordinates...</span>
                      ) : geocodingError ? (
                        <span className="text-red-500">{geocodingError}</span>
                      ) : (
                        "Coordinates will auto-fill when you enter an address, or you can enter them manually"
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={form.gpsCoordinates || ""}
                        onChange={(e) => handleChange("gpsCoordinates", e.target.value)}
                        disabled={isReadOnly || isGeocoding}
                        className="w-full p-2 border rounded"
                        placeholder="e.g. 51.922925° N, 4.429714° E"
                      />
                      {!isReadOnly && form.gpsCoordinates && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.gpsCoordinates)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                          title="View on Google Maps"
                        >
                          View on Map
                        </a>
                      )}
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
              </div>

              <div>
                <label className="block mb-1 font-medium">Attachments</label>
                <FileUpload
                  files={attachments}
                  onFilesChange={files => handleChange('attachments', files)}
                  disabled={isReadOnly}
                />
              </div>

              {!isReadOnly && (
                <div className="flex gap-4 mt-8">
                  <button
                    type="submit"
                    className="bg-[#e40115] text-white px-8 py-3 rounded text-lg font-semibold hover:bg-red-700 transition"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    className="bg-gray-200 text-gray-700 px-8 py-3 rounded text-lg font-semibold hover:bg-gray-300 transition"
                    onClick={() => router.push("/quote-requests")}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              )}

              {error && <div className="text-red-600 text-sm mt-4">{error}</div>}
            </div>
          </form>
        </div>
      </div>

      {/* Right: Messaging Panel */}
      <div className="w-[400px] border-l bg-white">
        {isArchived ? (
          <ArchivedMessaging 
            quoteRequestId={params.id as string}
            quoteRequest={{
              id: params.id as string,
              title: form.title,
              creatorCountry: form.creatorCountry,
              targetCountry: form.targetCountry,
              status: form.status,
              attachments: form.attachments
            }}
            userCountries={[form.creatorCountry, form.targetCountry].filter(Boolean)}
          />
        ) : (
          <MessagingPanel
            messages={messages}
            currentUser={user?.email || ''}
            currentCountry={userProfile?.businessUnit || ''}
            onSendMessage={handleSendMessage}
            quoteTitle={`${form.title} (${form.creatorCountry} → ${form.targetCountry})`}
            quoteRequestFiles={attachments}
            onFilesChange={files => handleChange('attachments', files)}
            readOnly={isReadOnly}
          />
        )}
      </div>
    </div>
  );
} 