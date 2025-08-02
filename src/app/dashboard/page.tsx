"use client";
import { useEffect, useState } from "react";
import { collection, query, where, getDocs, doc, updateDoc, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import { useRouter } from "next/navigation";
import MessageHistoryIndicator from "../components/MessageHistoryIndicator";
import QuoteRequestCard from "../components/QuoteRequestCard";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import dynamic from 'next/dynamic';
import DashboardNotifications from "../components/DashboardNotifications";

// Dynamically import components with no SSR to prevent hydration issues
const NotificationBadge = dynamic(() => import('../components/NotificationBadge'), {
  ssr: false
});
const DashboardMessaging = dynamic(() => import('./DashboardMessaging'), {
  ssr: false
});

// Initialize dayjs plugins
dayjs.extend(relativeTime);

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

export default function DashboardPage() {
  const [isClient, setIsClient] = useState(false);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [selectedQuoteRequest, setSelectedQuoteRequest] = useState<string | null>(null);
  const { userProfile, user, signOutUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Helper functions
  const getCustomerName = (id: string | undefined) => {
    if (!id) return '';
    const customer = customers.find(c => c.id === id);
    return customer ? customer.name : id;
  };

  const getLabelName = (id: string | undefined) => {
    if (!id) return '';
    const label = labels.find(l => l.id === id);
    return label ? label.name : id;
  };

  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        router.push('/login');
        return;
      }

      if (!userProfile) {
        setError('User profile not found. Please log in again.');
        return;
      }

      if (!db) {
        setError('Database connection failed. Please refresh the page.');
        return;
      }

      try {
        // Check if Firebase is properly initialized
        const testQuery = query(collection(db as Firestore, 'labels'));
        await getDocs(testQuery);
        
        // If we get here, Firebase is working
        fetchDashboardData();
      } catch (err) {
        console.error('Firebase initialization error:', err);
        setError('Failed to connect to the database. Please check your internet connection and refresh the page.');
        setLoading(false);
      }
    };

    const fetchDashboardData = async () => {
      try {
        console.log('[DEBUG] Fetching data for user:', user?.email);

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
        const snoozeLabelId = labelsData.find(l => l.name.toLowerCase() === 'snooze')?.id;
        const plannedLabelId = labelsData.find(l => l.name.toLowerCase() === 'planned')?.id;

        // Fetch quote requests
        const qrRef = collection(db as Firestore, "quoteRequests");
        const [qrSnapCreator, qrSnapInvolved, customerSnap] = await Promise.all([
          getDocs(query(qrRef, where('creatorCountry', '==', userProfile?.businessUnit))),
          getDocs(query(qrRef, where('involvedCountry', '==', userProfile?.businessUnit))),
          getDocs(collection(db as Firestore, "customers")),
        ]);

        const seenIds = new Set<string>();
        const combinedQRs: QuoteRequest[] = [];

        // Process creator quotes
        qrSnapCreator.docs.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            const data = doc.data();
            combinedQRs.push({
              id: doc.id,
              ...data,
              labels: data.labels || [],
              urgent: Boolean(data.urgent) || (data.labels || []).includes(urgentLabelId || ''),
              problems: Boolean(data.problems) || (data.labels || []).includes(problemsLabelId || ''),
              waitingForAnswer: Boolean(data.waitingForAnswer) || (data.labels || []).includes(waitingLabelId || ''),
              planned: Boolean(data.planned) || (data.labels || []).includes(plannedLabelId || '')
            } as QuoteRequest);
            seenIds.add(doc.id);
          }
        });

        // Process involved quotes
        qrSnapInvolved.docs.forEach(doc => {
          if (!seenIds.has(doc.id)) {
            const data = doc.data();
            combinedQRs.push({
              id: doc.id,
              ...data,
              labels: data.labels || [],
              urgent: Boolean(data.urgent) || (data.labels || []).includes(urgentLabelId || ''),
              problems: Boolean(data.problems) || (data.labels || []).includes(problemsLabelId || ''),
              waitingForAnswer: Boolean(data.waitingForAnswer) || (data.labels || []).includes(waitingLabelId || ''),
              planned: Boolean(data.planned) || (data.labels || []).includes(plannedLabelId || '')
            } as QuoteRequest);
            seenIds.add(doc.id);
          }
        });

        // Update Firestore to ensure consistency
        const updatePromises = combinedQRs.map(async qr => {
          const quoteRef = doc(db as Firestore, 'quoteRequests', qr.id);
          const updateData = {
            urgent: qr.urgent,
            problems: qr.problems,
            waitingForAnswer: qr.waitingForAnswer,
            planned: qr.planned,
            labels: qr.labels
          };
          try {
            await updateDoc(quoteRef, updateData);
          } catch (err) {
            console.error('[DEBUG] Error updating quote request:', err);
          }
          return qr;
        });

        await Promise.all(updatePromises);

        const customersData = customerSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Customer[];

        // Filter active quotes
        const activeQuotes = combinedQRs.filter(qr => 
          qr.status === "In Progress" || qr.status === "Snoozed"
        );

        setQuoteRequests(activeQuotes);
        setCustomers(customersData);
      } catch (err) {
        console.error('[DEBUG] Error fetching data:', err);
        setError('Failed to load dashboard data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [db, userProfile, user, router]);

  // Assign each quote request to only one column based on priority
  const snoozed: QuoteRequest[] = [];
  const waiting: QuoteRequest[] = [];
  const urgentProblems: QuoteRequest[] = [];
  const standard: QuoteRequest[] = [];

  quoteRequests.forEach(qr => {
    // Find special label IDs
    const urgentLabelId = labels.find(l => l.name.toLowerCase() === 'urgent')?.id || '';
    const problemsLabelId = labels.find(l => l.name.toLowerCase() === 'problems')?.id || '';
    const waitingLabelId = labels.find(l => l.name.toLowerCase() === 'waiting for answer')?.id || '';
    const snoozeLabelId = labels.find(l => l.name.toLowerCase() === 'snooze')?.id || '';

    // Check both boolean flags and label IDs
    const hasUrgentLabel = qr.urgent || (qr.labels || []).includes(urgentLabelId);
    const hasProblemsLabel = qr.problems || (qr.labels || []).includes(problemsLabelId);
    const hasWaitingLabel = qr.waitingForAnswer || (qr.labels || []).includes(waitingLabelId);
    const hasSnoozeLabel = qr.status === "Snoozed" || (qr.labels || []).includes(snoozeLabelId);

    if (qr.status === "Snoozed" || hasSnoozeLabel) {
      snoozed.push(qr);
    } else if (hasUrgentLabel || hasProblemsLabel) {
      urgentProblems.push(qr);
    } else if (hasWaitingLabel) {
      waiting.push(qr);
    } else {
      standard.push(qr);
    }
  });

  if (!isClient) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Page
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Notifications Bar */}
      <div className="mb-6 bg-white rounded-lg shadow p-4 max-h-32 overflow-y-auto">
        <DashboardNotifications />
      </div>

      <div className="flex">
        {/* Kanban Board */}
        <div className="flex-1 pr-96">
          <h1 className="text-2xl font-bold text-[#e40115] mb-6">Dashboard</h1>
          
          <div className="grid grid-cols-4 gap-6">
            {/* Urgent/Problems Column */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-red-600 mb-4">Urgent/Problems</h2>
              <div className="space-y-4">
                {urgentProblems.map(qr => (
                  <QuoteRequestCard
                    key={qr.id}
                    qr={qr}
                    customers={customers}
                    labels={labels}
                    onCardClick={() => setSelectedQuoteRequest(qr.id)}
                    getCustomerName={getCustomerName}
                    getLabelName={getLabelName}
                  />
                ))}
                {urgentProblems.length === 0 && (
                  <div className="text-gray-500 text-center py-4">No urgent or problem items</div>
                )}
              </div>
            </div>

            {/* Waiting Column */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-yellow-600 mb-4">Waiting for Answer</h2>
              <div className="space-y-4">
                {waiting.map(qr => (
                  <QuoteRequestCard
                    key={qr.id}
                    qr={qr}
                    customers={customers}
                    labels={labels}
                    onCardClick={() => setSelectedQuoteRequest(qr.id)}
                    getCustomerName={getCustomerName}
                    getLabelName={getLabelName}
                  />
                ))}
                {waiting.length === 0 && (
                  <div className="text-gray-500 text-center py-4">No waiting items</div>
                )}
              </div>
            </div>

            {/* Standard Column */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-gray-600 mb-4">Standard</h2>
              <div className="space-y-4">
                {standard.map(qr => (
                  <QuoteRequestCard
                    key={qr.id}
                    qr={qr}
                    customers={customers}
                    labels={labels}
                    onCardClick={() => setSelectedQuoteRequest(qr.id)}
                    getCustomerName={getCustomerName}
                    getLabelName={getLabelName}
                  />
                ))}
                {standard.length === 0 && (
                  <div className="text-gray-500 text-center py-4">No standard items</div>
                )}
              </div>
            </div>

            {/* Snoozed Column */}
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium text-gray-600 mb-4">Snoozed</h2>
              <div className="space-y-4">
                {snoozed.map(qr => (
                  <QuoteRequestCard
                    key={qr.id}
                    qr={qr}
                    customers={customers}
                    labels={labels}
                    onCardClick={() => setSelectedQuoteRequest(qr.id)}
                    getCustomerName={getCustomerName}
                    getLabelName={getLabelName}
                  />
                ))}
                {snoozed.length === 0 && (
                  <div className="text-gray-500 text-center py-4">No snoozed items</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Messaging Panel Space */}
        <div className="fixed right-0 top-[53px] w-96 bg-white shadow-xl" style={{ height: 'calc(100vh - 53px)' }}>
          {selectedQuoteRequest ? (
            <DashboardMessaging
              quoteRequestId={selectedQuoteRequest}
              onClose={() => setSelectedQuoteRequest(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              Please select a quote request to view messages.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}