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
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !userProfile) {
        console.error("Firestore or user profile not initialized");
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
            qr.involvedCountry === userProfile.businessUnit) &&
            // Filter out completed requests
            !["Won", "Lost", "Cancelled"].includes(qr.status)
          );
        }

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
  }, [userProfile]);

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

  if (loading) {
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
            getCustomerName={getCustomerName}
            getLabelName={getLabelName}
          />
        ))}
        {quoteRequests.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No quote requests found
                        </div>
                      )}
                    </div>
    </div>
  );
};

export default dynamic(() => Promise.resolve(QuoteRequestsPage), { ssr: false });