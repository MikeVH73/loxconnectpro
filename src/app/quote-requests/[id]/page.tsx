"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../firebaseClient";
import dayjs from "dayjs";
import FileUpload from "../../components/FileUpload";
import FileUploadSimple from "../../components/FileUploadSimple";
import ArchivedMessaging from "../../components/ArchivedMessaging";
import { useAuth } from "../../AuthProvider";

export default function QuoteRequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { userProfile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const docRef = doc(db, "quoteRequests", params.id as string);
      const snap = await getDoc(docRef);
      let qr: any = null;
      if (snap.exists()) {
        qr = { ...snap.data(), id: snap.id };
        setData(qr);
        setAttachments(qr.attachments || []);
      }
      const custSnap = await getDocs(collection(db, "customers"));
      setCustomers(custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      if (qr?.customer) {
        const q = query(collection(db, "contacts"), where("customer", "==", qr.customer));
        const contactSnap = await getDocs(q);
        setContacts(contactSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }
      setLoading(false);
    };
    fetchData();
  }, [params.id]);

  const getCustomerName = (id: string) => {
    const cust = customers.find((c: any) => c.id === id);
    return cust ? cust.name : id;
  };

  if (loading) return <div className="p-8">Loading...</div>;
  if (!data) return <div className="p-8 text-red-600">Quote Request not found.</div>;

  return (
    <div className="w-full p-8 bg-white mt-8">
      <div className="flex items-center justify-between mb-8 border-b pb-4">
        <div className="flex items-center gap-8">
          <h1 className="text-3xl font-bold text-[#e40115]">Quote Request</h1>
          <div className="flex items-center gap-3 text-xl">
            <span>{data.creatorCountry}</span>
            <span>&rarr;</span>
            <span>{data.involvedCountry || "..."}</span>
          </div>
          {data.status && ['Won', 'Lost', 'Cancelled'].includes(data.status) && (
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium border border-orange-200">
                📁 {data.status}
              </span>
              <span className="text-sm text-gray-600">• Message history preserved</span>
            </div>
          )}
        </div>
        <button
          type="button"
          className="bg-gray-200 text-gray-700 px-8 py-3 rounded text-lg font-semibold hover:bg-gray-300 transition"
          onClick={() => router.push("/quote-requests")}
        >
          Back
        </button>
      </div>
      <form className="grid grid-cols-[2fr_2fr_1.1fr] gap-8 w-full items-start">
        {/* Left column: form fields (read-only) */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div>
            <label className="block mb-1 font-medium">Title</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.title || ""} readOnly />
          </div>
          <div>
            <label className="block mb-1 font-medium">Creator Country</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.creatorCountry || ""} readOnly />
          </div>
          <div>
            <label className="block mb-1 font-medium">Involved Country</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.involvedCountry || ""} readOnly />
          </div>
          <div>
            <label className="block mb-1 font-medium">Customer</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={getCustomerName(data.customer)} readOnly />
          </div>
          <div>
            <label className="block mb-1 font-medium">Status</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.status || ""} readOnly />
          </div>
          <div>
            <label className="block mb-1 font-medium">Jobsite Address</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.jobsite?.address || ""} readOnly />
            <div className="flex gap-4 mt-2">
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Latitude</label>
                <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.jobsite?.lat ?? ""} readOnly />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500">Longitude</label>
                <input className="w-full border rounded px-3 py-2 bg-gray-100" value={data.jobsite?.lng ?? ""} readOnly />
              </div>
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium">Jobsite Contact</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={contacts.find(c => c.id === data.jobsiteContactId)?.name || ""} readOnly />
          </div>
        </div>
        {/* Middle column: products, notes, dates (read-only) */}
        <div className="space-y-6 bg-white p-6 rounded shadow border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-1 font-medium">Start Date</label>
              <input type="date" className="w-full border rounded px-3 py-2 bg-gray-100" value={data.startDate || ""} readOnly />
            </div>
            <div>
              <label className="block mb-1 font-medium">End Date</label>
              <input type="date" className="w-full border rounded px-3 py-2 bg-gray-100" value={data.endDate || ""} readOnly />
            </div>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <input type="checkbox" id="customerDecidesEnd" checked={data.customerDecidesEnd} readOnly />
            <label htmlFor="customerDecidesEnd" className="text-sm">Customer decides end date</label>
          </div>
          <div>
            <label className="block mb-1 font-medium">Products</label>
            <div className="space-y-2">
              {(data.products || []).map((product: any, idx: number) => (
                <div key={idx} className="flex gap-2 items-end">
                  <input className="flex-1 border rounded px-3 py-2 bg-gray-100" value={product.catClass} readOnly />
                  <input className="flex-2 border rounded px-3 py-2 bg-gray-100" value={product.description} readOnly />
                  <input className="w-24 border rounded px-3 py-2 bg-gray-100" value={product.quantity} readOnly />
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block mb-1 font-medium">Notes</label>
            <div className="space-y-2">
              {(data.notes || []).map((note: any, idx: number) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                  <div className="flex-1">
                    <span className="block text-sm text-gray-800">{note.text}</span>
                    <span className="block text-xs text-gray-500">By: {note.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* File upload section */}
          <div className="mt-4">
            <label className="block mb-1 font-medium">Attachments</label>
            <FileUploadSimple
              quoteRequestId={params.id as string}
              files={attachments}
              onFilesChange={setAttachments}
              currentUser={userProfile?.name || "User"}
              readOnly={true} // Read-only for detail view
            />
          </div>
        </div>
        {/* Right column: Archived Message History */}
        <div className="flex flex-col bg-white rounded shadow border min-h-[400px] w-96">
          <div className="p-4 border-b text-xs text-gray-400 bg-gray-50">
            Created: {data.createdAt?.toDate ? dayjs(data.createdAt.toDate()).format('YYYY-MM-DD HH:mm') : ''}<br />
            Last Updated: {data.updatedAt ? dayjs(data.updatedAt).format('YYYY-MM-DD HH:mm') : ''}
          </div>
          <div className="flex-1">
            <ArchivedMessaging
              quoteRequestId={params.id as string}
              userCountries={userProfile?.countries || []}
              quoteRequest={data}
            />
          </div>
        </div>
      </form>
    </div>
  );
} 