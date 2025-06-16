"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseClient";
import { collection, getDocs, addDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { Select, MenuItem, InputLabel, FormControl, Checkbox, ListItemText, IconButton } from "@mui/material";
import ClearIcon from '@mui/icons-material/Clear';
import Link from "next/link";
import MessagingPanel from "../components/MessagingPanel";

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
  quoteRequestId: string;
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
  const [messages, setMessages] = useState<Message[]>([]);

  // Utility functions defined at the top
  const getLabelName: (id: string) => string = (id) => labels.find((l: any) => l.id === id)?.name || id;
  const getCustomerName: (id: string) => string = (id) => customers.find((c: any) => c.id === id)?.name || id;
  const getLabelByName: (name: string) => any = (name) => labels.find((l: any) => l.name?.toLowerCase() === name);
  
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
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    const fetchData = async () => {
      const [qrSnap, labelSnap, customerSnap] = await Promise.all([
        getDocs(collection(db, "quoteRequests")),
        getDocs(collection(db, "labels")),
        getDocs(collection(db, "customers")),
      ]);
      setQuoteRequests(qrSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLabels(labelSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setCustomers(customerSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedQuoteId) return;

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("quoteRequestId", "==", selectedQuoteId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newMessages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Message[];
      setMessages(newMessages);
    });

    return () => unsubscribe();
  }, [selectedQuoteId]);

  const handleSendMessage = async (text: string) => {
    if (!selectedQuoteId || !user) return;

    try {
      const messagesRef = collection(db, "messages");
      await addDoc(messagesRef, {
        text,
        sender: user.email,
        senderCountry: userProfile?.countries?.[0] || "Unknown",
        quoteRequestId: selectedQuoteId,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message. Please try again.");
    }
  };

  // Filter quoteRequests by user's countries array
  const userCountries = userProfile?.countries || [];
  
  // More lenient filtering - also check if user has superAdmin role or if countries array is empty
  const visibleQuoteRequests = userProfile?.role === "superAdmin" || userCountries.length === 0
    ? quoteRequests // SuperAdmin sees all, or if no countries set, show all
    : quoteRequests.filter(qr => {
        // Check if user countries match creator or involved country
        const creatorMatch = userCountries.some(userCountry => 
          qr.creatorCountry?.toLowerCase().includes(userCountry.toLowerCase()) ||
          userCountry.toLowerCase().includes(qr.creatorCountry?.toLowerCase())
        );
        const involvedMatch = userCountries.some(userCountry => 
          qr.involvedCountry?.toLowerCase().includes(userCountry.toLowerCase()) ||
          userCountry.toLowerCase().includes(qr.involvedCountry?.toLowerCase())
        );
        return creatorMatch || involvedMatch;
      });

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
    } else if ((qr.labels || []).some(id => getLabelName(id)?.toLowerCase?.() === "waiting for answer")) {
      waiting.push(qr);
    } else if ((qr.labels || []).some(id => ["urgent", "problems"].includes(getLabelName(id)?.toLowerCase?.()))) {
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
    const countryMatch = selectedCountry ? (qr.creatorCountry === selectedCountry || qr.involvedCountry === selectedCountry) : true;
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
  const userAccessibleCountries = userProfile?.role === "superAdmin" || userCountries.length === 0
    ? allCountries // SuperAdmin sees all countries in filter
    : allCountries.filter(country => 
        userCountries.some(userCountry => 
          country.toLowerCase().includes(userCountry.toLowerCase()) ||
          userCountry.toLowerCase().includes(country.toLowerCase())
        )
      );
  const maxCountryCount = Math.max(1, ...Object.values(countryCounts));

  // Sort: Urgent at top
  const sortedRequests = [...filteredRequests].sort((a, b) => {
    const aUrgent = urgentLabel && (a.labels || []).includes(urgentLabel.id);
    const bUrgent = urgentLabel && (b.labels || []).includes(urgentLabel.id);
    if (aUrgent && !bUrgent) return -1;
    if (!aUrgent && bUrgent) return 1;
    return 0;
  });

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full flex overflow-hidden">
          {/* Left: Kanban Board */}
          <div className="flex-1 px-4 py-6 flex flex-col min-h-0 overflow-hidden">
            {/* Filters */}
            <div className="flex gap-4 mb-6 flex-shrink-0">
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
            <div className="grid grid-cols-4 gap-4 min-h-0 flex-1 overflow-hidden">
              {/* Urgent & Problems */}
              <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="p-4 bg-red-50 border-b">
                  <h3 className="font-semibold text-red-700">Urgent & Problems ({urgentProblemsKanban.length})</h3>
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
                  {urgentProblemsKanban.map((qr) => (
                    <QuoteRequestCard
                      key={qr.id}
                      qr={qr}
                      customers={customers}
                      labels={labels}
                      onCardClick={() => setSelectedQuoteId(qr.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Waiting for Answer */}
              <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="p-4 bg-yellow-50 border-b">
                  <h3 className="font-semibold text-yellow-700">Waiting ({waitingKanban.length})</h3>
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
                  {waitingKanban.map((qr) => (
                    <QuoteRequestCard
                      key={qr.id}
                      qr={qr}
                      customers={customers}
                      labels={labels}
                      onCardClick={() => setSelectedQuoteId(qr.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Standard */}
              <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="p-4 bg-green-50 border-b">
                  <h3 className="font-semibold text-green-700">Standard ({standardKanban.length})</h3>
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
                  {standardKanban.map((qr) => (
                    <QuoteRequestCard
                      key={qr.id}
                      qr={qr}
                      customers={customers}
                      labels={labels}
                      onCardClick={() => setSelectedQuoteId(qr.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Snoozed */}
              <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                <div className="p-4 bg-gray-50 border-b">
                  <h3 className="font-semibold text-gray-700">Snoozed ({snoozedKanban.length})</h3>
                </div>
                <div className="flex-1 p-4 space-y-4 overflow-y-auto min-h-0">
                  {snoozedKanban.map((qr) => (
                    <QuoteRequestCard
                      key={qr.id}
                      qr={qr}
                      customers={customers}
                      labels={labels}
                      onCardClick={() => setSelectedQuoteId(qr.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Messaging Panel */}
          <div className="w-[400px] border-l bg-white flex flex-col min-h-0 overflow-hidden">
            {selectedQuoteId ? (
              <MessagingPanel
                messages={messages}
                currentUser={user?.email || ""}
                currentCountry={userProfile?.countries?.[0] || ""}
                onSendMessage={handleSendMessage}
                quoteTitle={quoteRequests.find(qr => qr.id === selectedQuoteId)?.title || selectedQuoteId}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a quote request to view messages
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteRequestCard({ qr, customers, labels, onCardClick }: { qr: any, customers: any[], labels: any[], onCardClick: () => void }) {
  const getCustomerName = (id: string) => customers.find((c: any) => c.id === id)?.name || id;
  const getLabelName = (id: string) => labels.find((l: any) => l.id === id)?.name || id;

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
      <div className="text-xs text-gray-500 mb-1">Jobsite: {qr.jobsite?.address || <span className='italic text-gray-300'>No jobsite</span>}</div>
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
    </div>
  );
}