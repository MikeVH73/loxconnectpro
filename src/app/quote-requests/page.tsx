"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, updateDoc, Firestore, where } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import dynamic from 'next/dynamic';
import QuoteRequestCard from "../components/QuoteRequestCard";
import { useRouter } from "next/navigation";
import { deleteQuoteRequest } from "../utils/quoteRequestUtils";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

// Dynamically import LoadingSpinner
const LoadingSpinner = dynamic(() => import('../components/LoadingSpinner'), {
  ssr: false,
  loading: () => <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
});

interface Label {
  id: string;
  name: string;
}

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
  createdAt?: any;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
  planned: boolean;
  hasUnreadMessages?: boolean;
  lastMessageAt?: any;
}

const QuoteRequestsPage = () => {
  const router = useRouter();
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingQuoteRequest, setDeletingQuoteRequest] = useState<string | null>(null);
  const { userProfile, user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        console.error("Firestore not initialized");
        setError("Database connection failed. Please refresh the page.");
        setLoading(false);
        return;
      }

      if (!userProfile) {
        console.log("User profile not yet loaded, waiting...");
        return;
      }

      try {
        // Fetch labels first
        const labelSnap = await getDocs(collection(db as Firestore, "labels"));
        const labelsData = labelSnap.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        })) as Label[];
        setLabels(labelsData);

        // Get special label IDs
        const urgentLabelId = labelsData.find(l => l.name.toLowerCase() === 'urgent')?.id;
        const problemsLabelId = labelsData.find(l => l.name.toLowerCase() === 'problems')?.id;
        const waitingLabelId = labelsData.find(l => l.name.toLowerCase() === 'waiting for answer')?.id;
        const plannedLabelId = labelsData.find(l => l.name.toLowerCase() === 'planned')?.id;

        // Fetch quote requests based on user's business unit
        const qrRef = collection(db as Firestore, "quoteRequests");
        let qrQuery;

        if (userProfile.role === "superAdmin") {
          qrQuery = query(qrRef, orderBy("createdAt", "desc"));
        } else {
          // First get all quote requests
          qrQuery = query(qrRef, orderBy("createdAt", "desc"));
        }

      const [qrSnap, custSnap] = await Promise.all([
          getDocs(qrQuery),
          getDocs(collection(db as Firestore, "customers"))
      ]);

        const customersArr = custSnap.docs.map(doc => ({
        id: doc.id, 
        ...doc.data() 
        })) as Customer[];
      setCustomers(customersArr);

        let allRequests = qrSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QuoteRequest[];

        // Filter by user's business unit if not superAdmin
        if (userProfile.role !== "superAdmin" && userProfile.businessUnit) {
          allRequests = allRequests.filter(qr => 
            // Filter by business unit
            (qr.creatorCountry === userProfile.businessUnit ||
            qr.involvedCountry === userProfile.businessUnit)
          );
        }

        // Filter out completed requests for all users (they should only appear in Archived)
        allRequests = allRequests.filter(qr => 
          !["Won", "Lost", "Cancelled"].includes(qr.status)
        );

        // Update flags based on labels
        allRequests = allRequests.map(qr => ({
          ...qr,
          urgent: qr.urgent || (qr.labels || []).includes(urgentLabelId || ''),
          problems: qr.problems || (qr.labels || []).includes(problemsLabelId || ''),
          waitingForAnswer: qr.waitingForAnswer || (qr.labels || []).includes(waitingLabelId || ''),
          planned: qr.planned || (qr.labels || []).includes(plannedLabelId || '')
        }));

        // Sort by createdAt in descending order
        allRequests.sort((a, b) => {
          const dateA = a.updatedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
          const dateB = b.updatedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        });

        console.log('Fetched quote requests:', allRequests.length);
        console.log('Sample quote request:', allRequests[0]);

        setQuoteRequests(allRequests);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load quote requests");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile, db]);

  const getCustomerName = (id: string | undefined): string => {
    if (!id) return 'Unknown Customer';
    const customer = customers.find(c => c.id === id);
    return customer ? customer.name : id;
  };

  const getLabelName = (id: string | undefined): string => {
    if (!id) return 'Unknown Label';
    const label = labels.find(l => l.id === id);
    return label ? label.name : id;
  };

  const handleCardClick = (id: string) => {
    router.push(`/quote-requests/${id}/edit`);
  };

  // Delete handler functions
  const handleDeleteClick = (quoteRequestId: string) => {
    setShowDeleteConfirm(quoteRequestId);
  };

  const handleConfirmDelete = async () => {
    if (!showDeleteConfirm || !userProfile || !user) return;

    const quoteRequest = quoteRequests.find(qr => qr.id === showDeleteConfirm);
    if (!quoteRequest) return;

    setDeletingQuoteRequest(showDeleteConfirm);

    try {
      const result = await deleteQuoteRequest({
        quoteRequestId: showDeleteConfirm,
        quoteRequestTitle: quoteRequest.title,
        creatorCountry: quoteRequest.creatorCountry,
        involvedCountry: quoteRequest.involvedCountry,
        userEmail: user.email || '',
        userCountry: userProfile.businessUnit || ''
      });

      if (result.success) {
        // Remove the quote request from the local state
        setQuoteRequests(prev => prev.filter(qr => qr.id !== showDeleteConfirm));
        setShowDeleteConfirm(null);
      } else {
        alert(result.error || 'Failed to delete quote request');
      }
    } catch (error) {
      console.error('Error deleting quote request:', error);
      alert('Failed to delete quote request');
    } finally {
      setDeletingQuoteRequest(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  // Check if user can delete a quote request (only creator can delete)
  const canDeleteQuoteRequest = (quoteRequest: QuoteRequest) => {
    return userProfile?.businessUnit === quoteRequest.creatorCountry;
  };

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (!authLoading && user === null && !userProfile) {
     return (
       <div className="flex items-center justify-center min-h-screen">
         <div className="text-center">
           <div className="text-red-500 mb-4">User profile not found. Please log in again.</div>
           <button
             onClick={() => window.location.href = '/login'}
             className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
           >
             Go to Login
           </button>
         </div>
       </div>
     );
   }

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

        <div className="space-y-4">
        {quoteRequests.map((qr) => (
          <QuoteRequestCard
            key={qr.id}
            qr={qr}
            customers={customers}
            labels={labels}
            onCardClick={handleCardClick}
            onDeleteClick={handleDeleteClick}
            getCustomerName={getCustomerName}
            getLabelName={getLabelName}
            canDelete={canDeleteQuoteRequest(qr)}
          />
        ))}
        {quoteRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No quote requests found
                        </div>
                      )}
                    </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold mb-4 text-red-600">Confirm Delete</h3>
            <p className="mb-4">Are you sure you want to delete this quote request? This action cannot be undone.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCancelDelete}
                disabled={deletingQuoteRequest === showDeleteConfirm}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingQuoteRequest === showDeleteConfirm}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {deletingQuoteRequest === showDeleteConfirm ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default dynamic(() => Promise.resolve(QuoteRequestsPage), { ssr: false });