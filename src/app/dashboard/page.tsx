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
import NewQrsBar from "./NewQrsBar";
import { deleteQuoteRequest } from "../utils/quoteRequestUtils";

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
  assignedUserId?: string;
  assignedUserName?: string;
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingQuoteRequest, setDeletingQuoteRequest] = useState<string | null>(null);
  const { userProfile, user, loading: authLoading, signOutUser } = useAuth();
  const router = useRouter();
  const [showAllCountries, setShowAllCountries] = useState<boolean>(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && userProfile?.role === 'superAdmin') {
      const saved = localStorage.getItem('superAdminShowAllCountries');
      if (saved != null) setShowAllCountries(saved === 'true');
    }
  }, [userProfile?.role]);

  // Helper functions with better error handling
  const getCustomerName = (id: string | undefined) => {
    if (!id) return '';
    if (!customers || customers.length === 0) {
      console.warn('[Dashboard] Customers not loaded yet, showing ID:', id);
      return id; // Show ID as fallback
    }
    const customer = customers.find(c => c.id === id);
    return customer ? customer.name : id;
  };

  const getLabelName = (id: string | undefined) => {
    if (!id) return '';
    if (!labels || labels.length === 0) {
      console.warn('[Dashboard] Labels not loaded yet, showing ID:', id);
      return id; // Show ID as fallback
    }
    const label = labels.find(l => l.id === id);
    return label ? label.name : id;
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

  useEffect(() => {
    const checkAuth = async () => {
      // Wait for authentication to complete
      if (authLoading) {
        return;
      }

      // Don't redirect if we're in the middle of signing out
      if (!user && !authLoading) {
        // Add a small delay to prevent race conditions during sign-out
        setTimeout(() => {
          if (!user) {
            router.push('/login');
          }
        }, 100);
        return;
      }

      if (!userProfile && user) {
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

        // Fetch only active quote requests with proper filtering
        const shouldFilter = userProfile?.role !== 'superAdmin' || !showAllCountries;
        const allowedCountries = new Set<string>();
        if (shouldFilter) {
          if (userProfile?.businessUnit) allowedCountries.add(userProfile.businessUnit);
          (userProfile?.countries || []).forEach(c => allowedCountries.add(c));
        }

        // Build optimized queries based on user permissions
        const qrQueries = [];
        if (shouldFilter && allowedCountries.size > 0) {
          // Create queries for each allowed country (creator and involved)
          for (const country of allowedCountries) {
            qrQueries.push(
              query(collection(db as Firestore, "quoteRequests"), 
                where("creatorCountry", "==", country),
                where("status", "in", ["New", "In Progress", "Snoozed"])
              )
            );
            qrQueries.push(
              query(collection(db as Firestore, "quoteRequests"), 
                where("involvedCountry", "==", country),
                where("status", "in", ["New", "In Progress", "Snoozed"])
              )
            );
          }
        } else {
          // SuperAdmin with showAllCountries - still filter by status
          qrQueries.push(
            query(collection(db as Firestore, "quoteRequests"), 
              where("status", "in", ["New", "In Progress", "Snoozed"])
            )
          );
        }

        // Execute queries in parallel
        const qrSnapshots = await Promise.all(qrQueries.map(q => getDocs(q)));
        
        // Fetch customers (only if needed for display)
        const customerSnap = await getDocs(collection(db as Firestore, "customers"));

        // Process query results and deduplicate
        const seenIds = new Set<string>();
        const combinedQRs: QuoteRequest[] = [];
        
        qrSnapshots.forEach(snapshot => {
          snapshot.docs.forEach(docSnap => {
            const data = docSnap.data();
            if (seenIds.has(docSnap.id)) return; // Skip duplicates
            
            seenIds.add(docSnap.id);
            combinedQRs.push({
              id: docSnap.id,
              ...data,
              labels: data.labels || [],
              urgent: Boolean(data.urgent) || (data.labels || []).includes(urgentLabelId || ''),
              problems: Boolean(data.problems) || (data.labels || []).includes(problemsLabelId || ''),
              waitingForAnswer: Boolean(data.waitingForAnswer) || (data.labels || []).includes(waitingLabelId || ''),
              planned: Boolean(data.planned) || (data.labels || []).includes(plannedLabelId || '')
            } as QuoteRequest);
          });
        });

        // Note: Removed unnecessary Firestore updates on every load
        // These updates should only happen when labels are actually changed by users

        const customersData = customerSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Customer[];

        // combinedQRs already contains only active quotes from the optimized queries
        setQuoteRequests(combinedQRs);
        setCustomers(customersData);
      } catch (err) {
        console.error('[DEBUG] Error fetching data:', err);
        setError('Failed to load dashboard data. Please try refreshing the page.');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [db, userProfile, user, router, authLoading, showAllCountries]);

  // Assign each quote request to only one column based on priority
  const snoozed: QuoteRequest[] = [];
  const waiting: QuoteRequest[] = [];
  const urgentProblems: QuoteRequest[] = [];
  const standard: QuoteRequest[] = [];

  // Stable sort: New items first by createdAt/updatedAt desc; others by updatedAt desc
  const sorted = [...quoteRequests].sort((a, b) => {
    const aNew = a.status === "New" ? 1 : 0;
    const bNew = b.status === "New" ? 1 : 0;
    if (aNew !== bNew) return bNew - aNew; // New first
    const dateA = a.updatedAt?.toDate?.() || (a as any).createdAt?.toDate?.() || new Date(0);
    const dateB = b.updatedAt?.toDate?.() || (b as any).createdAt?.toDate?.() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  });

  sorted.forEach(qr => {
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

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  // Additional check: Don't render cards if essential data isn't loaded
  if (!customers || customers.length === 0 || !labels || labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading customer and label data...</p>
        </div>
      </div>
    );
  }

  if (!authLoading && user === null && !userProfile) {
    return (
      <div className="flex items-center justify-center h-64">
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
      {/* Notifications Bar (leave space for right messaging panel) */}
      <div className="mb-3 bg-white rounded-lg shadow p-4 max-h-32 overflow-y-auto mr-96">
        <DashboardNotifications />
          </div>

      {/* New QRs Bar */}
      <NewQrsBar />

      <div className="flex">
        {/* Kanban Board */}
        <div className="flex-1 pr-96">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-[#e40115]">Dashboard</h1>
            {userProfile?.role === 'superAdmin' && (
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={showAllCountries}
                  onChange={(e) => {
                    setShowAllCountries(e.target.checked);
                    if (typeof window !== 'undefined') {
                      localStorage.setItem('superAdminShowAllCountries', String(e.target.checked));
                    }
                  }}
                />
                Show all countries
              </label>
            )}
          </div>
          
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
                    onDeleteClick={handleDeleteClick}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                    canDelete={canDeleteQuoteRequest(qr)}
                    showDeleteButton={false}
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
                    onDeleteClick={handleDeleteClick}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                    canDelete={canDeleteQuoteRequest(qr)}
                    showDeleteButton={false}
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
                    onDeleteClick={handleDeleteClick}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                    canDelete={canDeleteQuoteRequest(qr)}
                    showDeleteButton={false}
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
                    onDeleteClick={handleDeleteClick}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                    canDelete={canDeleteQuoteRequest(qr)}
                    showDeleteButton={false}
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
        <div className="fixed right-0 top-[53px] w-[384px] bg-white shadow-xl" style={{ height: 'calc(100vh - 53px)' }}>
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
}