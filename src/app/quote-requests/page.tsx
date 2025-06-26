"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy, deleteDoc, doc, DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
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

interface Label {
  id: string;
  name: string;
}

interface Customer {
  id: string;
  name: string;
}

export default function QuoteRequestsPage() {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<Label[]>([]);
  const [productsMap, setProductsMap] = useState<any>({});
  const [notesMap, setNotesMap] = useState<any>({});
  const { userProfile } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [qrSnap, custSnap] = await Promise.all([
        getDocs(query(collection(db, "quoteRequests"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "customers")),
      ]);
      const customersArr = custSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() }));
      setCustomers(customersArr);
      let allRequests = qrSnap.docs
        .map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as QuoteRequest))
        .filter((qr: QuoteRequest) => qr.status !== "Won" && qr.status !== "Lost" && qr.status !== "Cancelled");
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
    const cust = customers.find((c: Customer) => c.id === id);
    return cust ? cust.name : id;
  };

  const getLabelName = (id: string) => labels.find(l => l.id === id)?.name || id;
  const getProductsSummary = (products: any[]) => products?.map(p => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ');
  const getLastNote = (notes: any[]) => notes?.length ? notes[notes.length - 1].text : '';

  const handleDelete = async (quoteRequestId: string) => {
    try {
      await deleteDoc(doc(db, "quoteRequests", quoteRequestId));
      setQuoteRequests(prev => prev.filter(qr => qr.id !== quoteRequestId));
      setDeleteSuccess("Quote request deleted successfully");
      setShowDeleteConfirm(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setDeleteSuccess("");
      }, 3000);
    } catch (error) {
      console.error("Error deleting quote request:", error);
      setDeleteError("Failed to delete quote request. Please try again.");
      
      // Clear error message after 3 seconds
      setTimeout(() => {
        setDeleteError("");
      }, 3000);
    }
  };

  const canDelete = userProfile?.role === "admin" || userProfile?.role === "superAdmin";

  return (
    <div className="p-8">
      {deleteError && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded-md">
          {deleteError}
        </div>
      )}
      {deleteSuccess && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded-md">
          {deleteSuccess}
        </div>
      )}
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
                      className="flex flex-col gap-2 bg-gray-50 rounded-lg p-4 shadow-sm cursor-pointer hover:bg-gray-100 transition relative"
                    >
                      <div 
                        onClick={() => window.location.href = userProfile?.role === "readOnly" ? `/quote-requests/${qr.id}` : `/quote-requests/${qr.id}/edit`}
                        className="flex-1"
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
                      {canDelete && (
                        <div className="absolute top-2 right-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowDeleteConfirm(qr.id);
                            }}
                            className="text-red-600 hover:text-red-800 p-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          </button>
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Delete Quote Request</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this quote request? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 