"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { signOut } from "firebase/auth";
import { auth } from "../../firebaseClient";
import DashboardMessagingPanel from "./DashboardMessagingPanel";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { Select, MenuItem, InputLabel, FormControl, Checkbox, ListItemText, IconButton } from "@mui/material";
import ClearIcon from '@mui/icons-material/Clear';
import Link from "next/link";

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

  // Move getLabelName to the top so it can be used in all logic below
  const getLabelName = (id: string) => labels.find(l => l.id === id)?.name || id;

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

  // Filter quoteRequests by user's countries array
  const userCountries = userProfile?.countries || [];
  console.log("[Dashboard] User countries:", userCountries);
  console.log("[Dashboard] All quote requests:", quoteRequests.map(qr => ({id: qr.id, creatorCountry: qr.creatorCountry, involvedCountry: qr.involvedCountry})));
  
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
    
  console.log("[Dashboard] Visible quote requests:", visibleQuoteRequests.length);

  const inProgressCount = visibleQuoteRequests.filter(qr => qr.status === "In Progress").length;
  // Special label names
  const specialLabels = ["urgent", "problems", "waiting for answer", "snooze"];
  const getLabelByName = (name: string) => labels.find((l: any) => l.name?.toLowerCase() === name);
  const urgentLabel = getLabelByName("urgent");
  const problemsLabel = getLabelByName("problems");
  const waitingLabel = getLabelByName("waiting for answer");
  const snoozeLabel = getLabelByName("snooze");

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

  // Column filters (now only on active requests)
  const isUrgentOrProblems = (qr: any) => (qr.labels || []).some((id: string) => [urgentLabel?.id, problemsLabel?.id].includes(id));
  const isWaiting = (qr: any) => (qr.labels || []).includes(waitingLabel?.id);
  const isSnoozed = (qr: any) => (qr.status === "Snoozed" || (qr.labels || []).includes(snoozeLabel?.id));
  const isStandard = (qr: any) => !isUrgentOrProblems(qr) && !isWaiting(qr) && !isSnoozed(qr);

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

  const getCustomerName = (id: string) => customers.find((c: any) => c.id === id)?.name || id;

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen flex flex-row bg-gray-50">
      {/* The left sidebar is already handled by the app shell/layout, so no extra sidebar here */}

      {/* Middle: In Progress Quote Requests with Filters */}
      <div className="flex-1 flex flex-col px-8 py-8 overflow-y-auto min-h-screen">
        {/* Dashboard Title */}
        <div className="headline-modern text-[#e40115] mb-8">Dashboard</div>
        {/* Header Cards */}
        <div className="w-full max-w-6xl mx-auto mb-8 flex flex-wrap gap-6">
          {/* In Progress Card */}
          <div className="flex-1 min-w-[220px] card-modern flex flex-col items-center justify-center">
            <div className="text-4xl font-extrabold text-[#e40115]">{inProgressCount}</div>
            <div className="text-base text-gray-600 mt-2">In Progress</div>
          </div>
          {/* Urgent Card */}
          <div className="flex-1 min-w-[220px] card-modern flex flex-col items-center justify-center">
            <div className="text-4xl font-extrabold text-[#e40115]">{urgentProblemsKanban.length}</div>
            <div className="text-base text-gray-600 mt-2">Urgent</div>
          </div>
          {/* Waiting Card */}
          <div className="flex-1 min-w-[220px] card-modern flex flex-col items-center justify-center">
            <div className="text-4xl font-extrabold text-[#e40115]">{waitingKanban.length}</div>
            <div className="text-base text-gray-600 mt-2">Waiting</div>
          </div>
          {/* Country Bar Chart Card */}
          <div className="flex-1 min-w-[220px] card-modern flex flex-col items-center justify-center">
            <div className="w-full flex flex-col items-center">
              <span className="text-base text-gray-600 mb-2">Quote Requests by Country</span>
              <svg
                viewBox={`0 0 ${allCountries.length * 70} 100`}
                width="100%"
                height="100"
                style={{ maxWidth: 340, minWidth: 180 }}
                className="block"
              >
                {allCountries.map((country, i) => {
                  const barHeight = maxCountryCount > 0 ? (countryCounts[country] / maxCountryCount) * 60 : 0;
                  const barWidth = 32;
                  const gap = 38;
                  const x = 20 + i * (barWidth + gap);
                  return (
                    <g key={country}>
                      {/* Value above bar */}
                      <text
                        x={x + barWidth / 2}
                        y={80 - barHeight - 12}
                        textAnchor="middle"
                        fontSize="16"
                        fontWeight="bold"
                        fill="#e40115"
                        style={{ fontFamily: 'inherit' }}
                      >
                        {countryCounts[country]}
                      </text>
                      {/* Bar */}
                      <rect
                        x={x}
                        y={80 - barHeight}
                        width={barWidth}
                        height={barHeight}
                        fill="#e40115"
                        rx={8}
                      />
                      {/* Label below bar */}
                      <text
                        x={x + barWidth / 2}
                        y={95}
                        textAnchor="middle"
                        fontSize="13"
                        fill="#333"
                        style={{ fontFamily: 'inherit' }}
                      >
                        {country}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
        {/* Filters */}
        <div className="filter-bar-modern flex gap-4 items-center">
          {/* Label Filter */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="label-filter-label">Label</InputLabel>
            <Select
              labelId="label-filter-label"
              value={selectedLabel}
              label="Label"
              onChange={e => setSelectedLabel(e.target.value)}
              endAdornment={selectedLabel && (
                <IconButton size="small" onClick={() => setSelectedLabel("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {labels.map(label => (
                <MenuItem key={label.id} value={label.id}>{label.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Customer Filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="customer-filter-label">Customer</InputLabel>
            <Select
              labelId="customer-filter-label"
              value={selectedCustomer}
              label="Customer"
              onChange={e => setSelectedCustomer(e.target.value)}
              endAdornment={selectedCustomer && (
                <IconButton size="small" onClick={() => setSelectedCustomer("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {customers.map(customer => (
                <MenuItem key={customer.id} value={customer.id}>{customer.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Country Filter */}
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="country-filter-label">Country</InputLabel>
            <Select
              labelId="country-filter-label"
              value={selectedCountry}
              label="Country"
              onChange={e => setSelectedCountry(e.target.value)}
              endAdornment={selectedCountry && (
                <IconButton size="small" onClick={() => setSelectedCountry("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {userAccessibleCountries.map(country => (
                <MenuItem key={country} value={country}>{country}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* User Filter */}
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="user-filter-label">User</InputLabel>
            <Select
              labelId="user-filter-label"
              value={selectedUser}
              label="User"
              onChange={e => setSelectedUser(e.target.value)}
              endAdornment={selectedUser && (
                <IconButton size="small" onClick={() => setSelectedUser("")}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              )}
            >
              <MenuItem value=""><em>All</em></MenuItem>
              {quoteRequests.map(qr => (
                <MenuItem key={qr.id} value={qr.user}>{qr.user}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Clear Filters Button */}
      <button
            className="ml-auto px-3 py-1 rounded-full border border-[#e40115] text-[#e40115] text-xs font-semibold bg-white hover:bg-[#e40115] hover:text-white transition focus:outline-none focus:ring-2 focus:ring-[#e40115]"
            onClick={() => {
              setSelectedLabel("");
              setSelectedCustomer("");
              setSelectedCountry("");
              setSelectedUser("");
            }}
            disabled={!selectedLabel && !selectedCustomer && !selectedCountry && !selectedUser}
          >
            Clear Filters
          </button>
        </div>
        {/* In Progress Quote Requests Kanban Board */}
        <div className="flex-1 overflow-y-auto mt-6">
          <div className="grid grid-cols-4 gap-6">
  {/* Urgent / Problems */}
  <div>
    <div className="font-bold text-lg mb-4 text-[#e40115] text-center">Urgent / Problems</div>
    <div className="flex flex-col gap-4">
      {urgentProblemsKanban.length === 0 && <div className="text-gray-400">None</div>}
      {urgentProblemsKanban.map(qr => (
        <QuoteRequestCard key={qr.id} qr={qr} customers={customers} labels={labels} />
      ))}
    </div>
  </div>
  {/* Standard */}
  <div className="border-l border-gray-200 pl-6">
    <div className="font-bold text-lg mb-4 text-[#e40115] text-center">Standard</div>
    <div className="flex flex-col gap-4">
      {standardKanban.length === 0 && <div className="text-gray-400">None</div>}
      {standardKanban.map(qr => (
        <QuoteRequestCard key={qr.id} qr={qr} customers={customers} labels={labels} />
      ))}
    </div>
  </div>
  {/* Waiting for Answer */}
  <div className="border-l border-gray-200 pl-6">
    <div className="font-bold text-lg mb-4 text-[#e40115] text-center">Waiting for Answer</div>
    <div className="flex flex-col gap-4">
      {waitingKanban.length === 0 && <div className="text-gray-400">None</div>}
      {waitingKanban.map(qr => (
        <QuoteRequestCard key={qr.id} qr={qr} customers={customers} labels={labels} />
      ))}
    </div>
  </div>
  {/* Snoozed */}
  <div className="border-l border-gray-200 pl-6">
    <div className="font-bold text-lg mb-4 text-[#e40115] text-center">Snoozed</div>
    <div className="flex flex-col gap-4">
      {snoozedKanban.length === 0 && <div className="text-gray-400">None</div>}
      {snoozedKanban.map(qr => (
        <QuoteRequestCard key={qr.id} qr={qr} customers={customers} labels={labels} />
      ))}
    </div>
  </div>
</div>
        </div>
      </div>

      {/* Right: Messaging Panel */}
      <div className="w-[520px] bg-white border-l flex flex-col min-h-screen px-6 py-8">
        <h1 className="text-2xl font-bold mb-4">Messaging</h1>
        <div className="flex-1 flex flex-col">
        <DashboardMessagingPanel />
        </div>
      </div>
    </div>
  );
}

function QuoteRequestCard({ qr, customers, labels }: { qr: any, customers: any[], labels: any[] }) {
  const getCustomerName = (id: string) => customers.find((c: any) => c.id === id)?.name || id;
  const getLabelName = (id: string) => labels.find((l: any) => l.id === id)?.name || id;

  return (
    <div className="card-modern border-l-8 border-[#e40115] p-4 min-h-[180px] flex flex-col justify-between relative">
      <Link
        href={`/quote-requests/${qr.id}/edit`}
        className="absolute top-3 right-3 text-gray-400 hover:text-[#e40115] focus:outline-none focus:ring-2 focus:ring-[#e40115] rounded-full text-lg"
        title="View details"
        tabIndex={0}
        aria-label="View Quote Request details"
        prefetch={false}
      >
        🔍
      </Link>
      <div className="font-bold text-base flex items-center gap-2">
        {qr.title}
      </div>
      <div className="text-sm text-gray-500 mb-1">{getCustomerName(qr.customer)}</div>
      <div className="text-xs text-gray-500 mb-1">Jobsite: {qr.jobsite?.address || <span className='italic text-gray-300'>No jobsite</span>}</div>
      <div className="text-xs text-gray-400 mb-1">{qr.creatorCountry} → {qr.involvedCountry}</div>
      <div className="flex flex-wrap gap-1 mt-2">
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
              className={`${colorClass} text-xs px-2 py-1 rounded font-light text-white`}
            >
              {getLabelName(id)}
            </span>
          );
        })}
      </div>
      {Array.isArray(qr.notes) && qr.notes.length > 0 && (
        <div className="text-xs text-gray-400 italic mt-2 truncate" title={qr.notes[qr.notes.length-1].text}>
          Last note: {qr.notes[qr.notes.length-1].text}
        </div>
      )}
    </div>
  );
} 
