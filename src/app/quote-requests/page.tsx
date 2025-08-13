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

interface UserProfile {
  id: string;
  name?: string;
  displayName?: string;
  email: string;
  role: string;
  countries?: string[];
  businessUnit?: string;
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
  assignedUserId?: string;
  assignedUserName?: string;
  startDate?: string;
  endDate?: string;
}

const QuoteRequestsPage = () => {
  const router = useRouter();
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [deletingQuoteRequest, setDeletingQuoteRequest] = useState<string | null>(null);
  const { userProfile, user, loading: authLoading } = useAuth();
  const [showAllCountries, setShowAllCountries] = useState<boolean>(false);
  
  // Filters
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterCreatorCountries, setFilterCreatorCountries] = useState<string[]>([]);
  const [filterInvolvedCountries, setFilterInvolvedCountries] = useState<string[]>([]);
  const [filterStartFrom, setFilterStartFrom] = useState<string>("");
  const [filterStartTo, setFilterStartTo] = useState<string>("");
  const [filterEndFrom, setFilterEndFrom] = useState<string>("");
  const [filterEndTo, setFilterEndTo] = useState<string>("");
  const [filterCustomers, setFilterCustomers] = useState<string[]>([]);
  const [filterHandledBy, setFilterHandledBy] = useState<string[]>([]);
  const [filterProduct, setFilterProduct] = useState<string>("");

  useEffect(() => {
    // Load persisted toggle for superAdmin
    if (typeof window !== 'undefined' && userProfile?.role === 'superAdmin') {
      const saved = localStorage.getItem('superAdminShowAllCountries');
      if (saved != null) setShowAllCountries(saved === 'true');
    }
  }, [userProfile?.role]);

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

        // Fetch all data in parallel
        const [qrSnap, custSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db as Firestore, "quoteRequests"), orderBy("createdAt", "desc"))),
          getDocs(collection(db as Firestore, "customers")),
          getDocs(collection(db as Firestore, "users"))
        ]);

        const customersArr = custSnap.docs.map(doc => ({
        id: doc.id, 
        ...doc.data() 
        })) as Customer[];
      setCustomers(customersArr);

        const usersArr = usersSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as UserProfile[];
        setUsers(usersArr);

        let allRequests = qrSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as QuoteRequest[];

        // Visibility filtering (can be overridden by superAdmin toggle)
        const shouldFilter = userProfile.role !== 'superAdmin' || !showAllCountries;
        if (shouldFilter) {
          const allowed = new Set<string>();
          if (userProfile.businessUnit) allowed.add(userProfile.businessUnit);
          (userProfile.countries || []).forEach(c => allowed.add(c));
          if (allowed.size > 0) {
            allRequests = allRequests.filter(qr => allowed.has(qr.creatorCountry) || allowed.has(qr.involvedCountry));
          }
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

        // Apply search and advanced filters client-side
        const searchLower = search.trim().toLowerCase();
        let filtered = allRequests.filter(qr => {
          // Search across title, customer name, products, assignee, id
          if (searchLower) {
            const customerName = getCustomerName(qr.customer).toLowerCase();
            const assigneeName = qr.assignedUserName?.toLowerCase() || '';
            const productsText = (qr.products || []).map((p: any) => `${p.catClass || ''} ${p.description || ''}`).join(' ').toLowerCase();
            const hay = `${qr.title || ''} ${customerName} ${productsText} ${assigneeName} ${qr.id}`.toLowerCase();
            if (!hay.includes(searchLower)) return false;
          }

          // Labels filter (must include all selected label ids)
          if (filterLabels.length > 0) {
            const hasAll = filterLabels.every(l => (qr.labels || []).includes(l));
            if (!hasAll) return false;
          }

          // Creator country filter
          if (filterCreatorCountries.length > 0 && !filterCreatorCountries.includes(qr.creatorCountry)) return false;

          // Involved country filter
          if (filterInvolvedCountries.length > 0 && !filterInvolvedCountries.includes(qr.involvedCountry)) return false;

          // Start date range filter
          if (filterStartFrom || filterStartTo) {
            const startDate = qr.startDate;
            if (!startDate) {
              // If no startDate and we have date filters, exclude this item
              return false;
            }
            
            try {
              const start = new Date(startDate);
              if (isNaN(start.getTime())) {
                // If startDate is not a valid date, exclude this item
                return false;
              }
              
              if (filterStartFrom && start < new Date(filterStartFrom)) return false;
              if (filterStartTo && start > new Date(filterStartTo)) return false;
            } catch (error) {
              // If there's an error parsing the date, exclude this item
              return false;
            }
          }

          // End date range filter
          if (filterEndFrom || filterEndTo) {
            const endDate = (qr as any).endDate as string | undefined;
            if (!endDate) {
              return false;
            }
            try {
              const end = new Date(endDate);
              if (isNaN(end.getTime())) return false;
              if (filterEndFrom && end < new Date(filterEndFrom)) return false;
              if (filterEndTo && end > new Date(filterEndTo)) return false;
            } catch {
              return false;
            }
          }

          // Customer filter
          if (filterCustomers.length > 0 && !filterCustomers.includes(qr.customer)) return false;

          // Handled by filter
          if (filterHandledBy.length > 0) {
            const assignedUserId = qr.assignedUserId || '';
            if (!filterHandledBy.includes(assignedUserId)) return false;
          }

          // Product filter
          if (filterProduct.trim()) {
            const prodNeedle = filterProduct.trim().toLowerCase();
            const has = (qr.products || []).some((p: any) =>
              `${p.catClass || ''}`.toLowerCase().includes(prodNeedle) ||
              `${p.description || ''}`.toLowerCase().includes(prodNeedle)
            );
            if (!has) return false;
          }

          return true;
        });

        setQuoteRequests(filtered);
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load quote requests");
      } finally {
      setLoading(false);
      }
    };

    fetchData();
  }, [userProfile, db, showAllCountries, search, filterLabels, filterCreatorCountries, filterInvolvedCountries, filterStartFrom, filterStartTo, filterEndFrom, filterEndTo, filterCustomers, filterHandledBy, filterProduct]);

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

  const getUserName = (id: string | undefined): string => {
    if (!id) return 'Unassigned';
    const user = users.find(u => u.id === id);
    return user ? (user.displayName || user.name || user.email) : 'Unknown User';
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

  // Get unique countries for filter dropdowns
  const getUniqueCountries = () => {
    const countries = new Set<string>();
    quoteRequests.forEach(qr => {
      if (qr.creatorCountry) countries.add(qr.creatorCountry);
      if (qr.involvedCountry) countries.add(qr.involvedCountry);
    });
    return Array.from(countries).sort();
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setFilterLabels([]);
    setFilterCreatorCountries([]);
    setFilterInvolvedCountries([]);
    setFilterStartFrom("");
    setFilterStartTo("");
    setFilterEndFrom("");
    setFilterEndTo("");
    setFilterCustomers([]);
    setFilterHandledBy([]);
    setFilterProduct("");
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

  const uniqueCountries = getUniqueCountries();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#e40115]">Quote Requests</h1>
        <div className="flex items-center gap-4">
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
          <button
            className="px-3 py-2 text-sm bg-gray-100 rounded hover:bg-gray-200 transition-colors"
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            {filtersOpen ? 'Hide Filters' : 'Advanced Filters'}
          </button>
        <Link
          href="/quote-requests/new"
          className="bg-[#e40115] text-white px-4 py-2 rounded hover:bg-red-700 transition"
        >
          + New Quote Request
        </Link>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <div className="flex items-stretch gap-3">
          <div className="relative flex-1 min-w-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, customer, product, assignee, ID..."
              className="w-full px-4 py-3 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#e40115] focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
                    </div>
                  </div>
                    <button
            type="button"
            className="px-4 py-2 rounded-lg bg-[#e40115] text-white hover:bg-red-700 whitespace-nowrap"
            onClick={clearAllFilters}
            title="Clear All Filters"
          >
            Clear All Filters
                    </button>
        </div>
                </div>

      {/* Advanced Filters */}
      {filtersOpen && (
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          {/* Row: Labels full width */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <span className="border-l-4 border-[#e40115] pl-2">Labels</span>
            </label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                {labels.map(l => (
                  <label key={l.id} className={`px-3 py-1 text-sm rounded-full cursor-pointer transition-colors ${
                    filterLabels.includes(l.id) 
                      ? 'bg-[#e40115] text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}>
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={filterLabels.includes(l.id)} 
                      onChange={(e) => {
                        setFilterLabels(prev => e.target.checked 
                          ? [...prev, l.id] 
                          : prev.filter(x => x !== l.id)
                        );
                      }} 
                    />
                    {l.name}
                  </label>
                ))}
              </div>
          </div>

          {/* Two columns layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Customer - tall */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="border-l-4 border-[#e40115] pl-2">Customer</span>
                </label>
                <select
                  multiple
                  value={filterCustomers}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilterCustomers(selected);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent h-56"
                >
                  {customers.map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.name}</option>
                  ))}
                </select>
              </div>

              {/* Creator Country */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Creator Country</label>
                <select
                  multiple
                  value={filterCreatorCountries}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilterCreatorCountries(selected);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent"
                  size={6}
                >
                  {uniqueCountries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>

              {/* Involved Country */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Involved Country</label>
                <select
                  multiple
                  value={filterInvolvedCountries}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilterInvolvedCountries(selected);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent"
                  size={6}
                >
                  {uniqueCountries.map(country => (
                    <option key={country} value={country}>{country}</option>
                  ))}
                </select>
              </div>
                      </div>

            {/* Right Column */}
            <div className="space-y-4">
              {/* Handled By - tall */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <span className="border-l-4 border-[#e40115] pl-2">Handled By</span>
                </label>
                <select
                  multiple
                  value={filterHandledBy}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setFilterHandledBy(selected);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent h-56"
                >
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.displayName || user.name || user.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date From</label>
                  <input 
                    type="date" 
                    value={filterStartFrom} 
                    onChange={(e) => setFilterStartFrom(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date To</label>
                  <input 
                    type="date" 
                    value={filterStartTo} 
                    onChange={(e) => setFilterStartTo(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date From</label>
                  <input 
                    type="date" 
                    value={filterEndFrom} 
                    onChange={(e) => setFilterEndFrom(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date To</label>
                  <input 
                    type="date" 
                    value={filterEndTo} 
                    onChange={(e) => setFilterEndTo(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent" 
                  />
                </div>
              </div>

              {/* Products */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Products</label>
                <input
                  type="text"
                  placeholder="Search cat-class or description"
                  value={filterProduct}
                  onChange={(e) => setFilterProduct(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#e40115] focus:border-transparent"
                />
              </div>
            </div>
                          </div>

          {/* Filter Actions */}
          <div className="mt-6 flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              {quoteRequests.length} quote request{quoteRequests.length !== 1 ? 's' : ''} found
                        </div>
            <button 
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors" 
              onClick={clearAllFilters}
            >
              Clear All Filters
            </button>
                    </div>
        </div>
      )}

      {/* Quote Requests List */}
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
          <div className="text-center py-12 text-gray-500">
            <div className="text-lg font-medium mb-2">No quote requests found</div>
            <div className="text-sm">
              {search || filterLabels.length > 0 || filterCreatorCountries.length > 0 || 
               filterInvolvedCountries.length > 0 || filterStartFrom || filterStartTo || 
               filterEndFrom || filterEndTo || filterCustomers.length > 0 || filterHandledBy.length > 0 || filterProduct
                ? "Try adjusting your search or filters"
                : "Create your first quote request to get started"
              }
            </div>
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