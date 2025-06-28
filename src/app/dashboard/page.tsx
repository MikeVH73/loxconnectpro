"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseClient";
import { collection, getDocs, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, limit, doc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { Select, MenuItem, InputLabel, FormControl, Checkbox, ListItemText, IconButton } from "@mui/material";
import ClearIcon from '@mui/icons-material/Clear';
import Link from "next/link";
import DashboardMessaging from "./DashboardMessaging";
import { Firestore } from 'firebase/firestore';
import MessageHistoryIndicator from "../components/MessageHistoryIndicator";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

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
  lastMessageAt: string | null;
  hasUnreadMessages: boolean;
  jobsite: string;
  involvedCountry: string;
  notes: string;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
}

interface QuoteRequestCardProps {
  qr: QuoteRequest;
  customers: Customer[];
  labels: Label[];
  onCardClick: (id: string) => void;
  getCustomerName: (id: string) => string;
  getLabelName: (id: string) => string;
}

interface Notification {
  id: string;
  quoteRequestId: string;
  quoteRequestTitle: string;
  sender: string;
  senderCountry: string;
  content: string;
  notificationType: 'message' | 'status_change' | 'property_change';
  createdAt: Timestamp;
  isRead: boolean;
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
  const [notifications, setNotifications] = useState<Notification[]>([]);

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
  const isWaiting = (qr: any) => !isUrgentOrProblems(qr) && ((qr.labels || []).includes(waitingLabel?.id) || qr.waitingForAnswer);
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
    if (!user || !db || !userProfile?.businessUnit) return;

    try {
      // Listen for new messages
      const messagesRef = collection(db as Firestore, 'messages');
      const messagesQuery = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' && db) {
            const message = change.doc.data();
            const quoteRequestId = message.quoteRequestId;
            
            // Update the quote request's lastMessageAt and set unread flag only if the message is not from current user
            if (quoteRequestId) {
              const quoteRef = doc(db as Firestore, 'quoteRequests', quoteRequestId);
              updateDoc(quoteRef, {
                lastMessageAt: message.createdAt,
                hasUnreadMessages: message.sender !== user.email
              }).catch(console.error);
            }
          }
        });
      });

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up message listener:', err);
    }
  }, [user, db, userProfile]);

  useEffect(() => {
    if (!db || !userProfile?.businessUnit) return;

    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('targetCountry', '==', String(userProfile.businessUnit)),
      where('isRead', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];
      console.log('[DEBUG] userProfile.businessUnit:', userProfile.businessUnit);
      console.log('[DEBUG] Notifications received from Firestore:', newNotifications);
      setNotifications(newNotifications);
    });

    return () => unsubscribe();
  }, [db, userProfile]);

  // Add a function to handle message reading
  const handleQuoteClick = async (id: string) => {
    setSelectedQuoteId(id);
    
    // Mark messages as read when opening the quote
    if (db && user) {
      try {
        const quoteRef = doc(db as Firestore, 'quoteRequests', id);
        await updateDoc(quoteRef, {
          hasUnreadMessages: false
        });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    }
  };

  // Mark notification as read when clicked
  const handleNotificationClick = async (notification: Notification) => {
    if (!db) return;
    
    try {
      const notificationRef = doc(db as Firestore, 'notifications', notification.id);
      await updateDoc(notificationRef, {
        isRead: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

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
    } else if ((qr.labels || []).includes(waitingLabel?.id) || qr.waitingForAnswer) {
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

  // Helper function to sanitize quote request data
  const sanitizeQuoteRequest = (qr: any): QuoteRequest => ({
    id: String(qr.id || ''),
    title: String(qr.title || ''),
    customer: String(qr.customer || ''),
    labels: Array.isArray(qr.labels) ? qr.labels : [],
    creatorCountry: String(qr.creatorCountry || ''),
    targetCountry: String(qr.targetCountry || ''),
    involvedCountry: String(qr.involvedCountry || ''),
    status: String(qr.status || ''),
    lastMessageAt: qr.lastMessageAt || null,
    hasUnreadMessages: Boolean(qr.hasUnreadMessages),
    jobsite: String(qr.jobsite || ''),
    notes: String(qr.notes || ''),
    waitingForAnswer: Boolean(qr.waitingForAnswer),
    urgent: Boolean(qr.urgent),
    problems: Boolean(qr.problems)
  });

  return (
    <div className="flex flex-col lg:flex-row h-screen">
      {/* Main Dashboard Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="p-4 space-y-4">
          {/* Always-visible Notifications Container */}
          <div className="bg-white rounded-lg shadow-md p-4 mb-4 max-h-64 overflow-y-auto border-l-4 border-blue-500 min-h-[80px] flex flex-col justify-center">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM4.19 4.19A2 2 0 014 5v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H6a2 2 0 00-1.81 1.19z"/>
                </svg>
                Recent Activity from Other Countries
              </h2>
              <span className="text-sm text-gray-500">{notifications.length} notification{notifications.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-gray-400 text-center py-4">No notifications yet</div>
              ) : (
                notifications.map((notification) => (
                  <Link 
                    key={notification.id}
                    href={userProfile?.role === 'readOnly' ? `/quote-requests/${notification.quoteRequestId}` : `/quote-requests/${notification.quoteRequestId}/edit`}
                    className={`block p-3 rounded-lg border transition-all duration-200 hover:shadow-md ${
                      !notification.isRead 
                        ? 'bg-blue-50 border-blue-200 hover:bg-blue-100' 
                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-gray-900 truncate">
                            {notification.quoteRequestTitle}
                          </span>
                          {!notification.isRead && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              New
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            notification.notificationType === 'message' 
                              ? 'bg-green-100 text-green-800' 
                              : notification.notificationType === 'status_change'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {notification.notificationType === 'message' && '💬 Message'}
                            {notification.notificationType === 'status_change' && '🔄 Status Change'}
                            {notification.notificationType === 'property_change' && '✏️ Property Update'}
                          </span>
                          <span className="text-sm text-gray-600">
                            from <span className="font-medium text-blue-600">{notification.senderCountry}</span>
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {notification.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                          </svg>
                          <span>{dayjs(notification.createdAt.toDate()).fromNow()}</span>
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"/>
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>

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
                {urgentProblemsKanban.map((qr: any) => (
                <QuoteRequestCard
                  key={qr.id}
                    qr={sanitizeQuoteRequest(qr)}
                  customers={customers}
                  labels={labels}
                    onCardClick={handleQuoteClick}
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
                {waitingKanban.map((qr: any) => (
                <QuoteRequestCard
                  key={qr.id}
                    qr={sanitizeQuoteRequest(qr)}
                  customers={customers}
                  labels={labels}
                    onCardClick={handleQuoteClick}
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
                {standardKanban.map((qr: any) => (
                <QuoteRequestCard
                  key={qr.id}
                    qr={sanitizeQuoteRequest(qr)}
                  customers={customers}
                  labels={labels}
                    onCardClick={handleQuoteClick}
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
                {snoozedKanban.map((qr: any) => (
                <QuoteRequestCard
                  key={qr.id}
                    qr={sanitizeQuoteRequest(qr)}
                  customers={customers}
                  labels={labels}
                    onCardClick={handleQuoteClick}
                  getCustomerName={getCustomerName}
                  getLabelName={getLabelName}
                />
              ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messaging Panel */}
      {selectedQuote?.id && (
        <div className="w-full lg:w-[400px] h-[600px] lg:h-auto bg-white border-l">
          <DashboardMessaging
            quoteRequestId={selectedQuote.id}
            onClose={() => setSelectedQuoteId(null)}
          />
        </div>
      )}
    </div>
  );
}

function QuoteRequestCard({ qr, customers, labels, onCardClick, getCustomerName, getLabelName }: QuoteRequestCardProps) {
  // Get all labels first
  const cardLabels = (qr.labels || []).map(id => ({
    id,
    name: getLabelName(id).toLowerCase(),
    displayName: getLabelName(id)
  })).filter(label => label.displayName !== label.id); // Filter out invalid labels

  // Separate special status labels
  const waitingLabel = cardLabels.find(label => label.name === "waiting for answer");
  const urgentLabel = cardLabels.find(label => label.name === "urgent");
  const problemsLabel = cardLabels.find(label => label.name === "problems");
  const snoozeLabel = cardLabels.find(label => label.name === "snooze");
  
  // Regular labels (excluding status labels)
  const regularLabels = cardLabels.filter(label => 
    !["waiting for answer", "urgent", "problems", "snooze"].includes(label.name)
  );

  // Check if this quote request should show the waiting badge
  const hasUrgentOrProblems = (qr.labels || []).some((id: string) => [urgentLabel?.id, problemsLabel?.id].includes(id));
  const shouldShowWaiting = !hasUrgentOrProblems && ((qr.labels || []).includes(waitingLabel?.id) || qr.waitingForAnswer);

  return (
    <div 
      onClick={() => onCardClick(qr.id)} 
      className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer relative min-h-[280px] flex flex-col border border-gray-100"
    >
      {/* Status Badges - Absolute positioned */}
      <div className="absolute top-0 right-0 mt-2 mr-2 flex items-center gap-2">
        {shouldShowWaiting && (
          <span className="bg-yellow-100 text-yellow-800 px-3 py-1.5 rounded-full text-sm font-medium">
            Waiting ⌛
          </span>
        )}
        {(urgentLabel || qr.urgent) && (
          <span className="bg-red-100 text-red-800 px-3 py-1.5 rounded-full text-sm font-medium">
            Urgent 🔥
          </span>
        )}
        {(problemsLabel || qr.problems) && (
          <span className="bg-orange-100 text-orange-800 px-3 py-1.5 rounded-full text-sm font-medium">
            Issues ⚠️
          </span>
        )}
        {snoozeLabel && (
          <span className="bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full text-sm font-medium">
            Snoozed 💤
          </span>
        )}
      </div>

      {/* Title and Reference */}
      <div className="mb-4">
        <h3 className="font-bold text-lg text-gray-900 pr-24 line-clamp-2">{qr.title}</h3>
        {qr.jobsite && (
          <p className="text-sm text-gray-500 mt-2">Site: {qr.jobsite}</p>
        )}
      </div>

      {/* Customer and Countries */}
      <div className="space-y-3 mb-6">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
          </svg>
          <span className="font-medium text-gray-700">{getCustomerName(qr.customer)}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <div className="flex items-center">
            <span className="text-blue-600 font-medium">{qr.creatorCountry}</span>
            <svg className="w-4 h-4 mx-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/>
            </svg>
            <span className="text-purple-600 font-medium">{qr.involvedCountry}</span>
          </div>
        </div>
      </div>

      {/* Bottom Info Bar */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-50 rounded-b-lg border-t flex justify-between items-center">
        {/* Last message timestamp */}
        <div className="text-sm text-gray-500">
          {qr.lastMessageAt && `Last message: ${dayjs(qr.lastMessageAt).fromNow()}`}
        </div>

        {/* Message indicator */}
        <div>
          <MessageHistoryIndicator 
            quoteRequestId={qr.id}
            creatorCountry={qr.creatorCountry}
            involvedCountry={qr.involvedCountry}
          />
        </div>
      </div>
    </div>
  );
}