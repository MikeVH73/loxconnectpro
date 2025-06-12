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

const statuses = ["In Progress", "Snoozed", "Won", "Lost", "Cancelled"];

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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const docRef = doc(db, "quoteRequests", params.id as string);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data: any = { ...snap.data(), id: snap.id };
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

  if (loading) return <div className="p-8">Loading...</div>;
  if (error) return <div className="p-8 text-red-600">{error}</div>;
  if (!form) return null;

  return (
    <div className="w-full p-8 bg-white mt-8">
      {/* Header row with labels/urgent */}
      <div className="flex items-center justify-between mb-8 border-b pb-4">
        <div className="flex items-center gap-8">
          <h1 className="text-3xl font-bold text-[#e40115]">Edit Quote Request</h1>
          <div className="flex items-center gap-3 text-xl">
            <span>{form.creatorCountry}</span>
            <span>&rarr;</span>
            <span>{form.involvedCountry || "..."}</span>
          </div>
          <div className="flex items-center gap-4 ml-8">
            {labels.length === 0 ? (
              <span className="text-gray-400">No labels found.</span>
            ) : labels.map(label => (
              <label key={label.id} className={`px-3 py-1 rounded-full border cursor-pointer select-none ${form.labels?.includes(label.id) ? 'bg-[#e40115] text-white border-[#e40115]' : 'bg-gray-100 text-gray-800 border-gray-300'}`}
                style={{ opacity: form.labels?.length >= 4 && !form.labels?.includes(label.id) ? 0.5 : 1 }}
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={form.labels?.includes(label.id)}
                  onChange={() => handleLabelToggle(label.id)}
                  disabled={isReadOnly || (!form.labels?.includes(label.id) && (form.labels?.length || 0) >= 4)}
                />
                {label.name || label.id}
              </label>
            ))}
          </div>
        </div>
        {!isReadOnly && (
        <div className="flex gap-4">
          <button
            type="submit"
            className="bg-[#e40115] text-white px-8 py-3 rounded text-lg font-semibold hover:bg-red-700 transition"
            disabled={saving}
            onClick={handleSubmit}
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
      </div>
      {/* Above the messaging/chat container */}
      {form.createdAt && (
        <div className="text-xs text-gray-500 mb-2 text-right">
          Created: {typeof form.createdAt === 'string' ? form.createdAt.slice(0, 10) : (form.createdAt?.toDate ? form.createdAt.toDate().toLocaleString() : '')}
        </div>
      )}
      {form.updatedAt && (
        <div className="text-xs text-gray-400 mb-2 text-right">
          Last updated: {typeof form.updatedAt === 'string' ? form.updatedAt.slice(0, 10) : (form.updatedAt?.toDate ? form.updatedAt.toDate().toLocaleString() : '')}
        </div>
      )}
      {/* Main grid: 3 columns */}
      <form onSubmit={handleSubmit} className="grid grid-cols-[2fr_2fr_1.1fr] gap-8 w-full items-start">
        {/* Left column: form fields */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div>
            <label className="block mb-1 font-medium">Title</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.title || ""}
              onChange={e => handleChange("title", e.target.value)}
              required
              disabled={isReadOnly}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Creator Country</label>
            <input
              className="w-full border rounded px-3 py-2 bg-gray-100"
              value={form.creatorCountry || ""}
              disabled
              readOnly
            />
          </div>
          <div>
            <CountrySelect
              label="Involved Country"
              value={form.involvedCountry || ""}
              onChange={(value) => handleChange("involvedCountry", value)}
              required
              disabled={isReadOnly}
            />
          </div>
          <div>
            <label className="block mb-1 font-medium">Customer</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.customer || ""}
              onChange={e => handleChange("customer", e.target.value)}
              required
              disabled={isReadOnly}
            >
              <option value="">Select customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.address})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 font-medium">Status</label>
            <select
              className="w-full border rounded px-3 py-2"
              value={form.status || ""}
              onChange={e => handleChange("status", e.target.value)}
              required
              disabled={isReadOnly || (userProfile?.country !== form.creatorCountry && userProfile?.country !== form.involvedCountry)}
            >
              {statuses.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(userProfile?.country !== form.creatorCountry && userProfile?.country !== form.involvedCountry) && (
              <div className="text-xs text-gray-400 mt-1">Only the creator or involved country can change the status.</div>
            )}
          </div>
        </div>
        {/* Middle column: products, notes, dates */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Start Date</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={form.startDate || ""}
                onChange={e => handleChange("startDate", e.target.value)}
                required
                disabled={isReadOnly}
              />
            </div>
            <div>
              <label className="block mb-1 font-medium">End Date</label>
              <input
                type="date"
                className="w-full border rounded px-3 py-2"
                value={form.endDate || ""}
                onChange={e => handleChange("endDate", e.target.value)}
                required={!form.customerDecidesEnd}
                disabled={isReadOnly || form.customerDecidesEnd}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              id="customerDecidesEnd"
              checked={form.customerDecidesEnd || false}
              onChange={e => handleChange("customerDecidesEnd", e.target.checked)}
              disabled={isReadOnly}
            />
            <label htmlFor="customerDecidesEnd" className="text-sm">Customer decides end date</label>
          </div>
          <div>
            <label className="block mb-1 font-medium">Products</label>
            <div className="space-y-2">
              {(form.products || []).map((product: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="Cat-Class"
                      value={product.catClass}
                      onChange={e => handleProductChange(idx, "catClass", e.target.value)}
                      required
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="flex-2">
                    <input
                      className="w-full border rounded px-3 py-2"
                      placeholder="Description"
                      value={product.description}
                      onChange={e => handleProductChange(idx, "description", e.target.value)}
                      required
                      disabled={isReadOnly}
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
                      disabled={isReadOnly}
                    />
                  </div>
                  <button
                    type="button"
                    className="text-red-600 font-bold px-2"
                    onClick={() => removeProduct(idx)}
                    disabled={isReadOnly || (form.products || []).length === 1}
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
                disabled={isReadOnly}
              >
                + Add Product
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium">Notes</label>
            <div className="space-y-2 mb-2">
              {(form.notes || []).length === 0 && <div className="text-xs text-gray-400">No notes yet.</div>}
              {(form.notes || []).map((note: any, idx: number) => (
                <div key={idx} className="bg-gray-50 border rounded p-2 text-xs text-gray-700">
                  <div>{note.text}</div>
                  <div className="text-[10px] text-gray-400 mt-1">By: {note.author} {note.createdAt ? `on ${typeof note.createdAt === 'string' ? note.createdAt.slice(0, 16) : (note.createdAt?.toDate ? note.createdAt.toDate().toLocaleString() : '')}` : ''}</div>
                </div>
              ))}
            </div>
            {!isArchived && !isReadOnly && (
              <div className="flex gap-2 mt-2">
                <input
                  className="flex-1 border rounded px-2 py-1 text-xs"
                  placeholder="Add a note..."
                  value={form.noteText || ''}
                  onChange={e => setForm((prev: any) => ({ ...prev, noteText: e.target.value }))}
                  maxLength={300}
                />
                <button
                  type="button"
                  className="bg-[#e40115] text-white px-3 py-1 rounded text-xs font-semibold hover:bg-red-700 transition"
                  disabled={!form.noteText?.trim()}
                  onClick={async () => {
                    if (!form.noteText?.trim()) return;
                    const newNote = {
                      text: form.noteText,
                      author: user?.email || 'Unknown',
                      createdAt: new Date().toISOString(),
                    };
                    const updatedNotes = [...(form.notes || []), newNote];
                    setForm((prev: any) => ({ ...prev, notes: updatedNotes, noteText: '' }));
                    // Save to Firestore immediately
                    await updateDoc(doc(db, 'quoteRequests', params.id as string), { notes: updatedNotes });
                  }}
                >
                  Add
                </button>
              </div>
            )}
          </div>
          {/* File upload section */}
          <div>
            <label className="block mb-1 font-medium">Attachments</label>
            <FileUploadSimple
              quoteRequestId={params.id as string}
              files={attachments}
              onFilesChange={(files) => {
                setAttachments(files);
                setForm((prev: any) => ({ ...prev, attachments: files }));
              }}
              currentUser={userProfile?.name || "User"}
              readOnly={isReadOnly || isArchived}
            />
          </div>
        </div>
        {/* Right column: jobsite, contact, labels */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div>
            <label className="block mb-1 font-medium">Jobsite Address</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={form.jobsite?.address || ""}
              onChange={e => handleChange("jobsite", { ...form.jobsite, address: e.target.value })}
              placeholder="Enter jobsite address"
              required
              disabled={isReadOnly}
            />
            <div className="flex gap-4 mt-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Latitude</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                  value={form.jobsite?.lat ?? ""}
                  readOnly
                  disabled
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Longitude</label>
                <input
                  className="w-full border rounded px-3 py-2 bg-gray-100"
                  value={form.jobsite?.lng ?? ""}
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
                value={form.jobsiteContactId || ""}
                onChange={e => {
                  handleChange("jobsiteContactId", e.target.value);
                  setShowNewContact(e.target.value === "__new");
                }}
                disabled={isReadOnly || showNewContact}
                required={!showNewContact}
              >
                <option value="">Select contact</option>
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                ))}
                <option value="__new">+ Add new contact</option>
              </select>
              {showNewContact && !isReadOnly && (
                <div className="flex gap-2 flex-1">
                  <input
                    className="border rounded px-3 py-2"
                    placeholder="Name"
                    value={newContact.name}
                    onChange={e => setNewContact({ ...newContact, name: e.target.value })}
                    required
                  />
                  <input
                    className="border rounded px-3 py-2"
                    placeholder="Phone"
                    value={newContact.phone}
                    onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="bg-[#e40115] text-white px-2 rounded hover:bg-red-700"
                    onClick={handleAddNewContact}
                    title="Save new contact"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    className="bg-gray-200 text-gray-700 px-2 rounded hover:bg-gray-300"
                    onClick={() => {
                      setShowNewContact(false);
                      setNewContact({ name: "", phone: "" });
                    }}
                    title="Cancel new contact"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
      {error && <div className="text-red-600 text-sm mt-4">{error}</div>}
      {/* Messaging section */}
      <div className="mt-8 p-6 bg-white rounded shadow">
        <h2 className="text-2xl font-bold mb-4">Messaging</h2>
        {isArchived ? (
          <div className="h-96">
            <ArchivedMessaging
              quoteRequestId={params.id as string}
              userCountries={userProfile?.countries || []}
              quoteRequest={form}
            />
          </div>
        ) : (
          <div className="text-center text-gray-400 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p>Quote request messaging available in Dashboard</p>
            <p className="text-sm">Use Dashboard Messaging for file sharing and communication</p>
            <button
              onClick={() => window.location.href = '/dashboard'}
              className="mt-4 bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 transition"
            >
              Go to Dashboard Messaging
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 