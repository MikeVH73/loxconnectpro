"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Firestore } from "firebase/firestore";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

interface Customer {
  id: string;
  name: string;
  address?: string;
  contact?: string;
  phone?: string;
  email?: string;
  countries?: string[];
  customerNumbers?: Record<string, string>;
}

interface Label {
  id: string;
  name: string;
}

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  customerNumber?: string;
  status: string;
  labels: string[];
  products?: any[];
  notes?: any[];
  updatedAt?: any;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
  planned: boolean;
  hasUnreadMessages?: boolean;
  lastMessageAt?: any;
  jobsite?: {
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  jobsiteContact?: {
  name: string;
    phone: string;
  };
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
      const customersArr = custSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Customer));
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
      const labelsArr = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Label));
      setLabels(labelsArr);
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

  // Helper function to get all labels for a quote request
  const getQuoteLabels = (qr: QuoteRequest) => {
    const labelIds = new Set(qr.labels || []);
    const labelNames = Array.from(labelIds).map(getLabelName);

    // Add boolean flags if they're true
    if (qr.waitingForAnswer) labelNames.push('Waiting for Answer');
    if (qr.urgent) labelNames.push('Urgent');
    if (qr.problems) labelNames.push('Problems');
    if (qr.planned) labelNames.push('Planned');

    return labelNames;
  };

  // Helper function to get label style
  const getLabelStyle = (labelName: string) => {
    const lowerName = labelName.toLowerCase();
    switch (lowerName) {
      case 'waiting for answer':
        return 'bg-yellow-100 text-yellow-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      case 'problems':
        return 'bg-orange-100 text-orange-800';
      case 'planned':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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

  // Get the user's business unit for filtering
  const businessUnit = userProfile?.businessUnit || (userProfile?.countries && userProfile.countries[0]) || '';

  // Find special label IDs
  const urgentLabelId = labels.find(l => l.name.toLowerCase() === 'urgent')?.id || '';
  const problemsLabelId = labels.find(l => l.name.toLowerCase() === 'problems')?.id || '';
  const waitingLabelId = labels.find(l => l.name.toLowerCase() === 'waiting for answer')?.id || '';
  const plannedLabelId = labels.find(l => l.name.toLowerCase() === 'planned')?.id || '';
  const snoozeLabelId = labels.find(l => l.name.toLowerCase() === 'snooze')?.id || '';

  // Filter out special labels for regular labels display
  const specialLabelIds = [urgentLabelId, problemsLabelId, waitingLabelId, plannedLabelId, snoozeLabelId].filter(id => id !== '');

  // Helper function to format date
  const formatDate = (date: any) => {
    if (!date) return null;
    try {
      // If it's a Firestore Timestamp
      if (typeof date.toDate === 'function') {
        return dayjs(date.toDate()).fromNow();
      }
      // If it's a Date object or string
      return dayjs(date).fromNow();
    } catch (err) {
      console.error('Error formatting date:', err);
      return null;
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#e40115]">Quote Requests</h1>
        <Link
          href="/quote-requests/new"
          className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          + New Quote Request
        </Link>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="space-y-4">
          {quoteRequests.map((qr) => {
            // Check both boolean flags and label IDs
            const hasUrgentLabel = qr.urgent || (qr.labels || []).includes(urgentLabelId);
            const hasProblemsLabel = qr.problems || (qr.labels || []).includes(problemsLabelId);
            const hasWaitingLabel = qr.waitingForAnswer || (qr.labels || []).includes(waitingLabelId);
            const hasPlannedLabel = qr.planned || (qr.labels || []).includes(plannedLabelId);
            const hasSnoozeLabel = qr.status === "Snoozed" || (qr.labels || []).includes(snoozeLabelId);

            // Update the quote request's flags to match the label state
            const updatedQr = {
              ...qr,
              urgent: hasUrgentLabel,
              problems: hasProblemsLabel,
              waitingForAnswer: hasWaitingLabel,
              labels: [...new Set([
                ...(qr.labels || []),
                ...(hasUrgentLabel && urgentLabelId ? [urgentLabelId] : []),
                ...(hasProblemsLabel && problemsLabelId ? [problemsLabelId] : []),
                ...(hasWaitingLabel && waitingLabelId ? [waitingLabelId] : []),
                ...(hasSnoozeLabel && snoozeLabelId ? [snoozeLabelId] : [])
              ])]
            } as QuoteRequest;

            // Save the updated flags and labels back to Firestore
            if (db) {
              const quoteRef = doc(db as Firestore, 'quoteRequests', qr.id);
              updateDoc(quoteRef, {
                urgent: updatedQr.urgent,
                problems: updatedQr.problems,
                waitingForAnswer: updatedQr.waitingForAnswer,
                labels: updatedQr.labels
              }).catch(err => {
                console.error('[DEBUG] Error updating quote request flags:', err);
              });
            }

            // Filter out special labels for regular labels display
            const regularLabels = (qr.labels || []).filter(labelId => !specialLabelIds.includes(labelId));

            return (
              <div key={qr.id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <Link
                      href={userProfile?.role === 'readOnly' ? `/quote-requests/${qr.id}` : `/quote-requests/${qr.id}/edit`}
                      className="text-lg font-medium text-gray-900 hover:text-[#e40115]"
                    >
                      {qr.title}
                    </Link>
                    <div className="text-sm text-gray-600 mt-1">
                      {qr.creatorCountry} → {qr.involvedCountry}
                    </div>
                  </div>
                  {userProfile?.role === 'admin' || userProfile?.role === 'superAdmin' ? (
                    <button
                      onClick={() => setShowDeleteConfirm(qr.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  ) : null}
                </div>

                {/* Status Indicators and Special Labels */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    qr.status === "In Progress" ? "bg-green-100 text-green-800" :
                    qr.status === "Snoozed" ? "bg-gray-100 text-gray-800" :
                    qr.status === "Won" ? "bg-blue-100 text-blue-800" :
                    qr.status === "Lost" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {qr.status}
                  </span>

                  {hasUrgentLabel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Urgent
                    </span>
                  )}
                  {hasProblemsLabel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                      Problems
                    </span>
                  )}
                  {hasWaitingLabel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Waiting
                    </span>
                  )}
                  {hasPlannedLabel && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Planned
                    </span>
                  )}
                      </div>

                {/* Regular Labels */}
                {regularLabels.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {regularLabels.map((labelId) => (
                      <span
                        key={labelId}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                      >
                        {labels.find(l => l.id === labelId)?.name || labelId}
                      </span>
                    ))}
                          </div>
                        )}

                {/* Last Update */}
                {qr.updatedAt && formatDate(qr.updatedAt) && (
                  <div className="text-xs text-gray-500 mt-2">
                    Last updated: {formatDate(qr.updatedAt)}
                        </div>
                      )}
                    </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Are you sure you want to delete this quote request?
            </h3>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
          </div>
        </div>
      )}

      {deleteSuccess && (
        <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {deleteSuccess}
        </div>
      )}
    </div>
  );
} 