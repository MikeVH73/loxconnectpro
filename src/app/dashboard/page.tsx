"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseClient";
import { collection, getDocs, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { Select, MenuItem, InputLabel, FormControl, Checkbox, ListItemText, IconButton } from "@mui/material";
import ClearIcon from '@mui/icons-material/Clear';
import Link from "next/link";
import DashboardMessaging from "./DashboardMessaging";
import { Firestore } from 'firebase/firestore';

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
  quoteRequestId: string;
}

interface Customer {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
}

interface QuoteRequest {
  id: string;
  title: string;
  customer: string;
  labels: string[];
  creatorCountry: string;
  targetCountry: string;
  status: string;
  lastMessageAt?: string | null;
  hasUnreadMessages?: boolean;
  jobsite?: string;
  involvedCountry?: string;
  notes?: string;
}

interface QuoteRequestCardProps {
  qr: QuoteRequest;
  customers: Customer[];
  labels: Label[];
  onCardClick: () => void;
  getCustomerName: (id: string) => string;
  getLabelName: (id: string) => string;
}

export default function DashboardPage() {
  const { user, loading, userProfile } = useAuth();
  const router = useRouter();
  const [quoteRequests, setQuoteRequests] = useState<any[]>([]);
  const [labels, setLabels] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [isClient, setIsClient] = useState(false);

  // Utility functions defined at the top
  const getLabelName = (id: string): string => labels.find((l: any) => l.id === id)?.name || id;
  const getCustomerName = (id: string): string => customers.find((c) => c.id === id)?.name || id;
  const getLabelByName = (name: string): any => labels.find((l: any) => l.name?.toLowerCase() === name);
  
  // Special label names and labels
  const specialLabels = ["urgent", "problems", "waiting for answer", "snooze"];
  const urgentLabel = getLabelByName("urgent");
  const problemsLabel = getLabelByName("problems");
  const waitingLabel = getLabelByName("waiting for answer");
  const snoozeLabel = getLabelByName("snooze");

  // Column filters
  const isUrgentOrProblems = (qr: any) => (qr.labels || []).some((id: string) => [urgentLabel?.id, problemsLabel?.id].includes(id));
  const isWaiting = (qr: any) => (qr.labels || []).includes(waitingLabel?.id);
  const isSnoozed = (qr: any) => (qr.status === "Snoozed" || (qr.labels || []).includes(snoozeLabel?.id));
  const isStandard = (qr: any) => !isUrgentOrProblems(qr) && !isWaiting(qr) && !isSnoozed(qr);

  useEffect(() => {
    console.log('Auth state:', { user, loading, userProfile });
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, userProfile, router]);

  useEffect(() => {
    const fetchData = async () => {
      if (!db) {
        console.error('Firebase database not initialized');
        return;
      }

      try {
        const [qrSnap, labelSnap, customerSnap] = await Promise.all([
          getDocs(collection(db, "quoteRequests")),
          getDocs(collection(db, "labels")),
          getDocs(collection(db, "customers")),
        ]);
        setQuoteRequests(qrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLabels(labelSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setCustomers(customerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching data:', err);
      }
    };
    fetchData();
  }, [db]);

  useEffect(() => {
    if (!selectedQuoteId) {
      setSelectedQuote(null);
      return;
    }

    const selectedQR = quoteRequests.find(qr => qr.id === selectedQuoteId);
    setSelectedQuote(selectedQR);
  }, [selectedQuoteId, quoteRequests]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    try {
      // Listen for new messages
      const messagesRef = collection(db, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const message = change.doc.data();
            const quoteRequestId = message.quoteRequestId;
            
            // Update the quote request's lastMessageAt
            if (quoteRequestId) {
              const quoteRef = doc(db, 'quoteRequests', quoteRequestId);
              updateDoc(quoteRef, {
                lastMessageAt: message.createdAt,
                hasUnreadMessages: true
              }).catch(console.error);
            }
          }
        });
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up message listener:', err);
    }
  }, [user, db]);

  if (!isClient || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Access Denied</h1>
          <p>Please log in to access the dashboard.</p>
        </div>
      </div>
    );
  }

  // Filter quoteRequests by user's countries array
  const userCountries: string[] = userProfile?.countries || [];
  console.log("[Dashboard] User Profile:", {
    email: userProfile?.email,
    role: userProfile?.role,
    countries: userCountries,
    businessUnit: userProfile?.businessUnit
  });
  
  // Filter quote requests by user's countries, regardless of role
  const visibleQuoteRequests = userCountries.length === 0
    ? quoteRequests // If no countries set, show all
    : quoteRequests.filter(qr => {
        // Debug log each quote request's countries
        const isVisible = userCountries.some((userCountry: string) => 
          userCountry === qr.creatorCountry || userCountry === qr.involvedCountry
        );
        
        console.log("[Dashboard] Quote Request Visibility Check:", {
          id: qr.id,
          title: qr.title,
          creatorCountry: qr.creatorCountry,
          involvedCountry: qr.involvedCountry,
          userCountries,
          isVisible,
          hasNoCountries: userCountries.length === 0
        });

        return isVisible;
      });

  console.log("[Dashboard] Filtered Quote Requests:", visibleQuoteRequests.map(qr => ({
    id: qr.id,
    title: qr.title,
    creatorCountry: qr.creatorCountry,
    involvedCountry: qr.involvedCountry,
    status: qr.status
  })));

  const inProgressCount = visibleQuoteRequests.filter(qr => qr.status === "In Progress").length;

  // Only include active quote requests
  const activeRequests = visibleQuoteRequests.filter(qr => qr.status === "In Progress" || qr.status === "Snoozed");

  // Assign each quote request to only one column based on priority
  const snoozed: any[] = [];
  const waiting: any[] = [];
  const urgentProblems: any[] = [];
  const standard: any[] = [];
  
  activeRequests.forEach(qr => {
    if (qr.status === "Snoozed") {
      snoozed.push(qr);
    } else if ((qr.labels || []).some((id: string) => getLabelName(id)?.toLowerCase?.() === "waiting for answer")) {
      waiting.push(qr);
    } else if ((qr.labels || []).some((id: string) => ["urgent", "problems"].includes(getLabelName(id)?.toLowerCase?.()))) {
      urgentProblems.push(qr);
    } else {
      standard.push(qr);
    }
  });

  // Filtering logic (only on active requests)
  const inProgressRequests = activeRequests.filter(qr => qr.status === "In Progress" || qr.status === "Snoozed");
  const filteredRequests = inProgressRequests.filter(qr => {
    const labelMatch = selectedLabel ? (qr.labels || []).includes(selectedLabel) : true;
    const customerMatch = selectedCustomer ? qr.customer === selectedCustomer : true;
    const countryMatch = selectedCountry 
      ? qr.creatorCountry === selectedCountry || qr.involvedCountry === selectedCountry
      : true;
    const userMatch = selectedUser ? qr.user === selectedUser : true;
    return labelMatch && customerMatch && countryMatch && userMatch;
  });

  // Kanban columns should use filteredRequests, not activeRequests
  const urgentProblemsKanban = filteredRequests.filter(isUrgentOrProblems);
  const waitingKanban = filteredRequests.filter(isWaiting);
  const snoozedKanban = filteredRequests.filter(isSnoozed);
  const standardKanban = filteredRequests.filter(isStandard);

  // Employee labels: any label not in specialLabels
  const getEmployeeLabels = (qr: any) => (qr.labels || []).filter((id: string) => {
    const label = labels.find((l: any) => l.id === id);
    return label && !specialLabels.includes(label.name?.toLowerCase());
  });

  // Bar chart data: count of quote requests per country (all requests, all statuses)
  const countryCounts: Record<string, number> = {};
  visibleQuoteRequests.forEach(qr => {
    if (qr.creatorCountry) countryCounts[qr.creatorCountry] = (countryCounts[qr.creatorCountry] || 0) + 1;
    if (qr.involvedCountry && qr.involvedCountry !== qr.creatorCountry) countryCounts[qr.involvedCountry] = (countryCounts[qr.involvedCountry] || 0) + 1;
  });
  
  // Filter countries to only show user's accessible countries for the dropdown
  const allCountries = Object.keys(countryCounts);
  const userAccessibleCountries = userCountries.length === 0
    ? allCountries // If no countries set, show all countries in filter
    : allCountries.filter(country => userCountries.includes(country));
  const maxCountryCount = Math.max(1, ...Object.values(countryCounts));

  // Sort: Urgent at top
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aUrgent = urgentLabel && (a.labels || []).includes(urgentLabel.id);
    const bUrgent = urgentLabel && (b.labels || []).includes(urgentLabel.id);
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return 0;
  });

  const currentCountry = userProfile?.countries?.[0];
  if (!currentCountry) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-red-600">No country assigned to your profile.</p>
        <p className="text-gray-600 mt-2">Please contact an administrator to assign you to a country.</p>
      </div>
    </div>;
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* Main Dashboard Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <FormControl size="small" className="w-[300px]">
            <InputLabel>Filter by Label</InputLabel>
            <Select
              value={selectedLabel}
              label="Filter by Label"
              onChange={(e) => setSelectedLabel(e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {labels.map((label) => (
                <MenuItem key={label.id} value={label.id}>
                  {label.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" className="w-[300px]">
            <InputLabel>Filter by Customer</InputLabel>
            <Select
              value={selectedCustomer}
              label="Filter by Customer"
              onChange={(e) => setSelectedCustomer(e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {customers.map((customer) => (
                <MenuItem key={customer.id} value={customer.id}>
                  {customer.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" className="w-[300px]">
            <InputLabel>Filter by Country</InputLabel>
            <Select
              value={selectedCountry}
              label="Filter by Country"
              onChange={(e) => setSelectedCountry(e.target.value)}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              {userAccessibleCountries.map((country) => (
                <MenuItem key={country} value={country}>
                  {country}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedLabel || selectedCustomer || selectedCountry || selectedUser ? (
            <IconButton
              onClick={() => {
                setSelectedLabel("");
                setSelectedCustomer("");
                setSelectedCountry("");
                setSelectedUser("");
              }}
              size="small"
            >
              <ClearIcon />
            </IconButton>
          ) : null}
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Urgent & Problems Column */}
          <div className="bg-red-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-4 text-red-700">
              Urgent & Problems ({urgentProblemsKanban.length})
            </h2>
            <div className="space-y-4">
              {urgentProblemsKanban.map((qr) => (
                <QuoteRequestCard
                  key={qr.id}
                  qr={qr}
                  customers={customers}
                  labels={labels}
                  onCardClick={() => setSelectedQuoteId(qr.id)}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                />
              ))}
            </div>
          </div>

          {/* Waiting Column */}
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-4 text-yellow-700">
              Waiting ({waitingKanban.length})
            </h2>
            <div className="space-y-4">
              {waitingKanban.map((qr) => (
                <QuoteRequestCard
                  key={qr.id}
                  qr={qr}
                  customers={customers}
                  labels={labels}
                  onCardClick={() => setSelectedQuoteId(qr.id)}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                />
              ))}
            </div>
          </div>

          {/* Standard Column */}
          <div className="bg-green-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-4 text-green-700">
              Standard ({standardKanban.length})
            </h2>
            <div className="space-y-4">
              {standardKanban.map((qr) => (
                <QuoteRequestCard
                  key={qr.id}
                  qr={qr}
                  customers={customers}
                  labels={labels}
                  onCardClick={() => setSelectedQuoteId(qr.id)}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                />
              ))}
            </div>
          </div>

          {/* Snoozed Column */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">
              Snoozed ({snoozedKanban.length})
            </h2>
            <div className="space-y-4">
              {snoozedKanban.map((qr) => (
                <QuoteRequestCard
                  key={qr.id}
                  qr={qr}
                  customers={customers}
                  labels={labels}
                  onCardClick={() => setSelectedQuoteId(qr.id)}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Messaging Panel */}
      {selectedQuoteId && (
        <div className="w-full lg:w-[400px] h-[600px] lg:h-auto bg-white border-l">
          <DashboardMessaging
            quoteRequestId={selectedQuoteId}
            onClose={() => setSelectedQuoteId(null)}
          />
        </div>
      )}
    </div>
  );
}

function QuoteRequestCard({ qr, customers, labels, onCardClick, getCustomerName, getLabelName }: QuoteRequestCardProps) {
  return (
    <div className="card-modern border-l-4 border-[#e40115] p-3 min-h-[120px] flex flex-col justify-between relative cursor-pointer" onClick={onCardClick}>
      <Link
        href={`/quote-requests/${qr.id}/edit`}
        className="absolute top-2 right-2 text-gray-400 hover:text-[#e40115] focus:outline-none focus:ring-2 focus:ring-[#e40115] rounded-full text-sm"
        title="View details"
        tabIndex={0}
        aria-label="View Quote Request details"
        prefetch={false}
        onClick={e => e.stopPropagation()}
      >
        🔍
      </Link>
      <div className="font-bold text-sm flex items-center gap-2 pr-6">
        {qr.title}
      </div>
      <div className="text-xs text-gray-500 mb-1">{getCustomerName(qr.customer)}</div>
      <div className="text-xs text-gray-400 mb-1">{qr.creatorCountry} → {qr.involvedCountry}</div>
      <div className="flex flex-wrap gap-1 mt-1">
        {(qr.labels || []).map(id => {
          const labelName = getLabelName(id)?.toLowerCase?.();
          let colorClass = "";
          if (labelName === "urgent") colorClass = "bg-orange-500";
          else if (labelName === "problems") colorClass = "bg-[#e40115]";
          else if (labelName === "waiting for answer") colorClass = "bg-blue-600";
          else colorClass = "pill-modern";
          return (
            <span
              key={id}
              className={`${colorClass} text-xs px-1.5 py-0.5 rounded font-light text-white`}
            >
              {getLabelName(id)}
            </span>
          );
        })}
      </div>
      {Array.isArray(qr.notes) && qr.notes.length > 0 && (
        <div className="text-xs text-gray-400 italic mt-1 truncate" title={qr.notes[qr.notes.length-1].text}>
          Last note: {qr.notes[qr.notes.length-1].text}
        </div>
      )}
      {qr.hasUnreadMessages && (
        <div className="absolute top-2 right-8 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
      )}
      {qr.lastMessageAt && (
        <div className="text-xs text-gray-500 mt-1">
          Last message: {new Date(qr.lastMessageAt).toLocaleString()}
        </div>
      )}
    </div>
  );
}