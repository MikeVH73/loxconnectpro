"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";

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
  updatedAt?: any;
}

export default function QuoteRequestsPage() {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<any[]>([]);
  const [productsMap, setProductsMap] = useState<any>({});
  const [notesMap, setNotesMap] = useState<any>({});
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [qrSnap, custSnap] = await Promise.all([
        getDocs(query(collection(db, "quoteRequests"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "customers")),
      ]);
      const customersArr = custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCustomers(customersArr);
      let allRequests = qrSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as QuoteRequest))
        .filter(qr => qr.status !== "Won" && qr.status !== "Lost" && qr.status !== "Cancelled");
      // Filter by user's countries array (same logic as dashboard)
      const userCountries = userProfile?.countries || [];
      console.log("[QuoteRequests] User countries:", userCountries);
      console.log("[QuoteRequests] All quote requests:", allRequests.map(qr => ({id: qr.id, creatorCountry: qr.creatorCountry, involvedCountry: qr.involvedCountry})));
      
      // More lenient filtering - also check if user has superAdmin role or if countries array is empty
      if (userProfile?.role !== "superAdmin" && userCountries.length > 0) {
        allRequests = allRequests.filter(qr => {
          // Simple exact match - show if user's country matches either creator or involved country
          return userCountries.includes(qr.creatorCountry) || userCountries.includes(qr.involvedCountry);
        });
      }
      
      console.log("[QuoteRequests] Visible quote requests:", allRequests.length);
      setQuoteRequests(allRequests);
      setLoading(false);
    };
    fetchData();
  }, [userProfile]);

  useEffect(() => {
    const fetchLabels = async () => {
      const snap = await getDocs(collection(db, "labels"));
      setLabels(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchLabels();
  }, []);

  const getCustomerName = (id: string) => {
    const cust = customers.find((c: any) => c.id === id);
    return cust ? cust.name : id;
  };

  const getLabelName = (id: string) => labels.find(l => l.id === id)?.name || id;
  const getProductsSummary = (products: any[]) => products?.map(p => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ');
  const getLastNote = (notes: any[]) => notes?.length ? notes[notes.length - 1].text : '';

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#e40115]">Quote Requests</h1>
        {userProfile?.role !== "readOnly" && (
          <Link
            href="/quote-requests/new"
            className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 transition"
          >
            + New Quote Request
          </Link>
        )}
      </div>
      {loading ? (
        <div>Loading...</div>
      ) : quoteRequests.length === 0 ? (
        <div>No quote requests found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded shadow">
            <tbody>
              {quoteRequests.map(qr => (
                <tr key={qr.id} className="border-t align-top">
                  <td colSpan={6} className="px-4 py-4">
                    <div
                      className="flex flex-col gap-2 bg-gray-50 rounded-lg p-4 shadow-sm cursor-pointer hover:bg-gray-100 transition"
                      onClick={() => window.location.href = userProfile?.role === "readOnly" ? `/quote-requests/${qr.id}` : `/quote-requests/${qr.id}/edit`}
                    >
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
                      <div className="text-sm text-gray-700">Products: {getProductsSummary(qr.products || [])}</div>
                      <div className="text-xs text-gray-500 italic">Last note: {getLastNote(qr.notes || [])}</div>
                      {qr.updatedAt && (
                        <div className="text-xs text-gray-400 mt-1">
                          Latest Update: {
                            typeof qr.updatedAt === 'string'
                              ? qr.updatedAt.slice(0, 10)
                              : (qr.updatedAt?.toDate ? qr.updatedAt.toDate().toISOString().slice(0, 10) : '')
                          }
                        </div>
                      )}
                    </div>
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