"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, orderBy, deleteDoc, doc, DocumentData, QueryDocumentSnapshot, updateDoc, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import dynamic from 'next/dynamic';

// Initialize dayjs plugins
dayjs.extend(relativeTime);

// Dynamically import LoadingSpinner
const LoadingSpinner = dynamic(() => import('../components/LoadingSpinner'), {
  ssr: false,
  loading: () => <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
});

// ... existing interfaces ...

const QuoteRequestsPage = () => {
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<Label[]>([]);
  const { userProfile } = useAuth();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        console.error("Firestore is not initialized");
        return;
      }

      try {
        const [qrSnap, custSnap] = await Promise.all([
          getDocs(query(collection(db as Firestore, "quoteRequests"), orderBy("createdAt", "desc"))),
          getDocs(collection(db as Firestore, "customers")),
        ]);

        const customersArr = custSnap.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Customer));
        setCustomers(customersArr);

        let allRequests = qrSnap.docs
          .map((doc: QueryDocumentSnapshot<DocumentData>) => ({ id: doc.id, ...doc.data() } as QuoteRequest))
          .filter((qr: QuoteRequest) => qr.status !== "Won" && qr.status !== "Lost" && qr.status !== "Cancelled");

        // Filter by user's business unit
        const userBusinessUnit = userProfile?.businessUnit;
        if (userProfile?.role !== "superAdmin" && userBusinessUnit) {
          allRequests = allRequests.filter(qr => {
            return qr.creatorCountry === userBusinessUnit || qr.involvedCountry === userBusinessUnit;
          });
        }

        setQuoteRequests(allRequests);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userProfile]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
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

      {/* ... rest of the existing JSX ... */}
    </div>
  );
};

// Export with explicit client-side rendering
export default dynamic(() => Promise.resolve(QuoteRequestsPage), {
  ssr: false
});