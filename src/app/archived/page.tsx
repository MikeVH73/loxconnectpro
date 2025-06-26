"use client";
import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import Link from "next/link";
import { Chip } from "@mui/material";
import { useAuth } from "../AuthProvider";
import MessageHistoryIndicator from "../components/MessageHistoryIndicator";

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  status: string;
  labels?: string[];
  products?: any[];
  notes?: any[];
}

export default function ArchivedPage() {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const q = query(collection(db, "quoteRequests"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      let allRequests = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as QuoteRequest))
        .filter(qr => ["Won", "Lost", "Cancelled"].includes(qr.status));
        
      // Apply same country filtering as other pages
      const userCountries = userProfile?.countries || [];
      console.log("[Archived] User countries:", userCountries);
      console.log("[Archived] All archived requests:", allRequests.map(qr => ({id: qr.id, creatorCountry: qr.creatorCountry, involvedCountry: qr.involvedCountry})));
      
      // More lenient filtering - also check if user has superAdmin role or if countries array is empty
      if (userProfile?.role !== "superAdmin" && userCountries.length > 0) {
        allRequests = allRequests.filter(qr => {
          // Simple exact match - show if user's country matches either creator or involved country
          return userCountries.includes(qr.creatorCountry) || userCountries.includes(qr.involvedCountry);
        });
      }
      
      console.log("[Archived] Visible archived requests:", allRequests.length);
      setQuoteRequests(allRequests);
      setLoading(false);
    };
    const fetchLabels = async () => {
      const snap = await getDocs(collection(db, "labels"));
      setLabels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    const fetchCustomers = async () => {
      const snap = await getDocs(collection(db, "customers"));
      setCustomers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
    fetchLabels();
    fetchCustomers();
  }, [userProfile]);

  const getLabelName = (id: string) => labels.find(l => l.id === id)?.name || id;
  const getCustomerName = (id: string) => customers.find(c => c.id === id)?.name || id;
  const getProductsSummary = (products: any[] = []) => products.map(p => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ');
  const getLastNote = (notes: any[] = []) => notes.length ? notes[notes.length - 1].text : '';

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this quote request? This cannot be undone.")) return;
    await deleteDoc(doc(db, "quoteRequests", id));
    setQuoteRequests(qrs => qrs.filter(qr => qr.id !== id));
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">Archived Quote Requests</h1>
      {loading ? (
        <div>Loading...</div>
      ) : quoteRequests.length === 0 ? (
        <div>No archived quote requests found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Creator Country</th>
                <th className="px-4 py-2 text-left">Involved Country</th>
                <th className="px-4 py-2 text-left">Customer</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Edit</th>
              </tr>
            </thead>
            <tbody>
              {quoteRequests.map(qr => (
                <tr key={qr.id} className="border-t align-top">
                  <td colSpan={6} className="px-4 py-4">
                    <Link href={`/quote-requests/${qr.id}/edit`} className="block group">
                      <div className="flex flex-col gap-2 bg-gray-50 rounded-lg p-4 shadow-sm transition ring-0 group-hover:ring-2 group-hover:ring-[#e40115] group-focus:ring-2 group-focus:ring-[#e40115] cursor-pointer relative">
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-lg">{qr.title}</span>
                          <span className="text-sm text-gray-500">{getCustomerName(qr.customer)}</span>
                          <span className="text-sm text-gray-500">{qr.creatorCountry} → {qr.involvedCountry}</span>
                          <span className="text-sm text-gray-500">{qr.status}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(qr.labels || []).map((id: string) => (
                            <span key={id} className="bg-[#e40115] text-white px-2 py-1 rounded-full text-xs">{getLabelName(id)}</span>
                          ))}
                        </div>
                        <div className="text-sm text-gray-700">Products: {getProductsSummary(qr.products)}</div>
                        <div className="text-xs text-gray-500 italic">Last note: {getLastNote(qr.notes)}</div>
                        <div className="text-xs mt-2">
                          <MessageHistoryIndicator 
                            quoteRequestId={qr.id} 
                            creatorCountry={qr.creatorCountry}
                            involvedCountry={qr.involvedCountry}
                          />
                        </div>
                        <div className="mt-2 flex items-center gap-4">
                          <span className="text-[#e40115] underline">Edit</span>
                          {userProfile && ["admin", "superAdmin"].includes(userProfile.role) && (
                            <button
                              type="button"
                              className="text-xs text-white bg-[#e40115] rounded px-3 py-1 ml-2 hover:bg-red-700 transition"
                              onClick={e => {
                                e.preventDefault(); e.stopPropagation(); handleDelete(qr.id);
                              }}
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 