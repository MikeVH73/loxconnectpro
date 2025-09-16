"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dynamic from "next/dynamic";
import ComparisonBlock from "./ComparisonBlock";
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';

// Register Chart.js components once
ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend, ArcElement);

// Dynamically import charts to avoid SSR issues
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });
const Pie = dynamic(() => import('react-chartjs-2').then(m => m.Pie), { ssr: false });

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  status: string; // New, In Progress, Snoozed, Won, Lost, Cancelled
  createdAt?: any;
  updatedAt?: any;
  totalValueEUR?: number;
  totalValueCurrency?: string;
  customer?: string; // customer id
  customerName?: string;
  startDate?: any;
  endDate?: any;
}

// Robust date parsing for Firestore Timestamp, ISO strings, and "DD-MMM-YYYY"
const parseDateValue = (value: any): Date | null => {
  if (!value) return null;
  try {
    if (typeof value.toDate === 'function') return value.toDate();
  } catch {}
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    let d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    const m = value.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{4})$/);
    if (m) {
      const day = parseInt(m[1], 10);
      const monStr = m[2].toLowerCase();
      const year = parseInt(m[3], 10);
      const monthIndex: Record<string, number> = { jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11 };
      const mi = monthIndex[monStr as keyof typeof monthIndex];
      if (mi !== undefined) {
        d = new Date(Date.UTC(year, mi, day));
        return isNaN(d.getTime()) ? null : d;
      }
    }
  }
  if (value instanceof Date) return value;
  return null;
};

const yearFromDate = (d?: any): number | null => {
  const parsed = parseDateValue(d);
  return parsed ? parsed.getUTCFullYear() : null;
};

const preferYearForQuote = (qr: any): number | null => {
  return yearFromDate(qr.startDate) ?? yearFromDate(qr.endDate) ?? yearFromDate(qr.createdAt);
};

const monthFromQuote = (qr: any): number => {
  const d = parseDateValue(qr.startDate) || parseDateValue(qr.endDate) || parseDateValue(qr.createdAt) || new Date();
  return d.getUTCMonth();
};

export default function AnalyticsPage() {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<QuoteRequest[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [compareEnabled, setCompareEnabled] = useState<boolean>(false);
  const [yearB, setYearB] = useState<number>(new Date().getFullYear() - 1);
  const [filterCreator, setFilterCreator] = useState<string[]>([]);
  const [filterInvolved, setFilterInvolved] = useState<string[]>([]);
  const [filterCustomers, setFilterCustomers] = useState<string[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerSearch, setCustomerSearch] = useState<string>("");
  const [roleScope, setRoleScope] = useState<'my'|'all'>('my');
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!db || !userProfile) return;
      setLoading(true);
      const q = query(collection(db as Firestore, 'quoteRequests'), orderBy('createdAt','desc'));
      const snap = await getDocs(q);
      const arr = snap.docs.map(d => ({ id: d.id, ...d.data() })) as QuoteRequest[];

      // Role visibility: superAdmin can see all; others see creator/involved
      let visible = arr;
      if (userProfile.role !== 'superAdmin' || roleScope === 'my') {
        const allowed = new Set<string>();
        if (userProfile.businessUnit) allowed.add(userProfile.businessUnit);
        (userProfile.countries || []).forEach(c => allowed.add(c));
        visible = visible.filter(qr => allowed.has(qr.creatorCountry) || allowed.has(qr.involvedCountry));
      }

      setData(visible);
      setLoading(false);
    };
    load();
  }, [userProfile, roleScope]);

  // Load customers for filter
  useEffect(() => {
    const loadCustomers = async () => {
      if (!db) return;
      const snap = await getDocs(collection(db as Firestore, 'customers'));
      const list = snap.docs.map(d => ({ id: d.id, name: (d.data() as any).name || 'Unnamed'}));
      list.sort((a,b)=>a.name.localeCompare(b.name));
      setCustomers(list);
    };
    loadCustomers();
  }, []);

  const years = useMemo(() => {
    const s = new Set<number>();
    data.forEach(qr => {
      const y1 = yearFromDate(qr.startDate);
      const y2 = yearFromDate(qr.endDate);
      const y3 = yearFromDate(qr.createdAt);
      if (y1) s.add(y1);
      if (y2) s.add(y2);
      if (!y1 && !y2 && y3) s.add(y3);
    });
    const list = Array.from(s).sort((a,b)=>b-a);
    // Always include current year for convenience
    const current = new Date().getFullYear();
    if (!list.includes(current)) list.unshift(current);
    return list;
  }, [data]);

  // Keep yearB valid if year options change
  useEffect(() => {
    if (years.length === 0) return;
    if (!years.includes(yearB)) {
      setYearB(years[0]);
    }
  }, [years, yearB]);

  const filtered = useMemo(() => {
    const creatorAll = filterCreator.length === 0 || filterCreator.includes('all');
    const involvedAll = filterInvolved.length === 0 || filterInvolved.includes('all');
    const customersAll = filterCustomers.length === 0 || filterCustomers.includes('all');
    const arr = data
      .filter(qr => preferYearForQuote(qr) === year)
      .filter(qr => creatorAll ? true : filterCreator.includes(qr.creatorCountry))
      .filter(qr => involvedAll ? true : filterInvolved.includes(qr.involvedCountry))
      .filter(qr => {
        if (customersAll) return true;
        const id = qr.customer;
        const name = (qr as any).customerName;
        return (id && filterCustomers.includes(id)) || (name && filterCustomers.includes(name));
      });
    return arr;
  }, [data, year, filterCreator, filterInvolved, filterCustomers]);

  const totals = useMemo(() => {
    const agg = {
      won:0, lost:0, cancelled:0, inProgress:0, newCount:0,
      totalWonEUR:0, totalLostEUR:0, totalCancelledEUR:0, totalInProgressEUR:0, totalNewEUR:0
    } as any;
    filtered.forEach(qr => {
      const status = (qr.status || '').toLowerCase();
      const eur = qr.totalValueEUR || 0;
      if (status==='won') { agg.won++; agg.totalWonEUR += eur; }
      else if (status==='lost') { agg.lost++; agg.totalLostEUR += eur; }
      else if (status==='cancelled') { agg.cancelled++; agg.totalCancelledEUR += eur; }
      else if (status==='in progress') { agg.inProgress++; agg.totalInProgressEUR += eur; }
      else if (status==='new') { agg.newCount++; agg.totalNewEUR += eur; }
    });
    return agg;
  }, [filtered]);

  const creatorCountries = useMemo(() => {
    const s = new Set<string>();
    data.forEach(qr => { s.add(qr.creatorCountry); });
    return ['all', ...Array.from(s).sort()];
  }, [data]);
  const involvedCountries = useMemo(() => {
    const s = new Set<string>();
    data.forEach(qr => { s.add(qr.involvedCountry); });
    return ['all', ...Array.from(s).sort()];
  }, [data]);

  const handleMultiChange = (e: React.ChangeEvent<HTMLSelectElement>, setter: (v: string[]) => void) => {
    const selected = Array.from(e.target.selectedOptions).map(o => o.value);
    setter(selected);
  };

  const customerOptions = useMemo(() => {
    const list = customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()));
    return ['all', ...list.map(c => c.id)];
  }, [customers, customerSearch]);
  const customerLabel = (id: string) => id === 'all' ? 'customer: all' : (customers.find(c => c.id === id)?.name || id);

  // Excel export function
  const handleExportToExcel = () => {
    const workbook = XLSX.utils.book_new();
    
    // Helper function to format dates
    const formatDate = (date: any): string => {
      const parsed = parseDateValue(date);
      return parsed ? parsed.toLocaleDateString() : 'Unknown';
    };
    
    // Helper function to get customer name
    const getCustomerName = (qr: QuoteRequest): string => {
      if (qr.customer) {
        const foundCustomer = customers.find(c => c.id === qr.customer);
        if (foundCustomer) return foundCustomer.name;
        return `Unknown Customer (ID: ${qr.customer})`;
      }
      return (qr as any).customerName || 'No Customer Assigned';
    };

    // 1. Summary Sheet
    const summaryData = [
      ['Analytics Export Summary'],
      ['Generated on:', new Date().toLocaleString()],
      ['Year:', year],
      ['Creator Countries:', filterCreator.length === 0 || filterCreator.includes('all') ? 'All' : filterCreator.join(', ')],
      ['Involved Countries:', filterInvolved.length === 0 || filterInvolved.includes('all') ? 'All' : filterInvolved.join(', ')],
      ['Customers:', filterCustomers.length === 0 || filterCustomers.includes('all') ? 'All' : filterCustomers.map(id => customerLabel(id)).join(', ')],
      [''],
      ['KPI Summary'],
      ['Won Count:', totals.won],
      ['Won EUR:', totals.totalWonEUR],
      ['Lost Count:', totals.lost],
      ['Lost EUR:', totals.totalLostEUR],
      ['Cancelled Count:', totals.cancelled],
      ['Cancelled EUR:', totals.totalCancelledEUR],
      ['In Progress Count:', totals.inProgress],
      ['In Progress EUR:', totals.totalInProgressEUR],
      ['New Count:', totals.newCount],
      ['New EUR:', totals.totalNewEUR],
      [''],
      ['Conversion Funnel'],
      ['Total Created:', funnel.created],
      ['Won:', funnel.won],
      ['Conversion Rate:', `${funnel.conversion}%`],
      ['Average Days to Win:', funnel.avgDaysToWin || 'N/A'],
      ['Total Won EUR:', funnel.wonEUR]
    ];
    
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // 2. Quote Requests Detail Sheet
    const quoteRequestsData = [
      ['ID', 'Title', 'Status', 'Creator Country', 'Involved Country', 'Customer', 'Customer Name', 'Start Date', 'End Date', 'Total Value EUR', 'Created Date', 'Updated Date']
    ];
    
    filtered.forEach(qr => {
      quoteRequestsData.push([
        qr.id,
        qr.title || '',
        qr.status || '',
        qr.creatorCountry || '',
        qr.involvedCountry || '',
        qr.customer || '',
        getCustomerName(qr),
        formatDate(qr.startDate),
        formatDate(qr.endDate),
        qr.totalValueEUR || 0,
        formatDate(qr.createdAt),
        formatDate((qr as any).updatedAt)
      ]);
    });
    
    const quoteRequestsSheet = XLSX.utils.aoa_to_sheet(quoteRequestsData);
    XLSX.utils.book_append_sheet(workbook, quoteRequestsSheet, 'Quote Requests');

    // 3. Monthly Data Sheet
    const monthlyData = [
      ['Month', 'Won', 'Lost', 'Cancelled', 'In Progress', 'New']
    ];
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    monthNames.forEach((month, index) => {
      monthlyData.push([
        month,
        monthly.won[index],
        monthly.lost[index],
        monthly.cancelled[index],
        monthly.inProgress[index],
        monthly.newly[index]
      ]);
    });
    
    const monthlySheet = XLSX.utils.aoa_to_sheet(monthlyData);
    XLSX.utils.book_append_sheet(workbook, monthlySheet, 'Monthly Data');

    // 4. Top Customers Sheet
    const customersData = [
      ['Customer Name', 'Won EUR', 'Share %', 'Customer ID']
    ];
    
    topCustomers.rows.forEach(customer => {
      customersData.push([
        customer.name,
        customer.wonEUR,
        customer.share.toFixed(2),
        customer.id
      ]);
    });
    
    const customersSheet = XLSX.utils.aoa_to_sheet(customersData);
    XLSX.utils.book_append_sheet(workbook, customersSheet, 'Top Customers');

    // 5. Country Pairs Sheet
    const pairsData = [
      ['Creator Country', 'Involved Country', 'Total Created', 'Won', 'Lost', 'Cancelled', 'In Progress', 'New', 'Won EUR', 'Lost EUR', 'Cancelled EUR', 'Conversion %']
    ];
    
    pairRows.forEach(pair => {
      const conversion = pair.total > 0 ? Math.round((pair.won / pair.total) * 100) : 0;
      pairsData.push([
        pair.creator,
        pair.involved,
        pair.total,
        pair.won,
        pair.lost,
        pair.cancelled,
        pair.inProgress,
        pair.newly,
        pair.wonEUR,
        pair.lostEUR,
        pair.cancelledEUR,
        conversion
      ]);
    });
    
    const pairsSheet = XLSX.utils.aoa_to_sheet(pairsData);
    XLSX.utils.book_append_sheet(workbook, pairsSheet, 'Country Pairs');

    // 6. Conversion Funnel by Country Pairs Sheet
    const funnelData = [
      ['Country Pair', 'Created', 'Won', 'Lost', 'Cancelled', 'In Progress', 'New', 'Conversion %']
    ];
    
    pairFunnel.forEach(funnel => {
      const conversion = funnel.created > 0 ? Math.round((funnel.won / funnel.created) * 100) : 0;
      funnelData.push([
        funnel.label,
        funnel.created,
        funnel.won,
        funnel.lost,
        funnel.cancelled,
        funnel.inProgress,
        funnel.newly,
        conversion
      ]);
    });
    
    const funnelSheet = XLSX.utils.aoa_to_sheet(funnelData);
    XLSX.utils.book_append_sheet(workbook, funnelSheet, 'Conversion Funnel');

    // Generate filename with current filters
    const creatorFilter = filterCreator.length === 0 || filterCreator.includes('all') ? 'All' : filterCreator.join('-');
    const involvedFilter = filterInvolved.length === 0 || filterInvolved.includes('all') ? 'All' : filterInvolved.join('-');
    const customerFilter = filterCustomers.length === 0 || filterCustomers.includes('all') ? 'All' : 'Filtered';
    const filename = `Analytics_${year}_${creatorFilter}_${involvedFilter}_${customerFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download the file
    XLSX.writeFile(workbook, filename);
  };

  // Monthly bar data (counts per month by status)
  const monthly = useMemo(() => {
    const base = () => Array.from({ length: 12 }, () => 0);
    const won = base();
    const lost = base();
    const cancelled = base();
    const inProgress = base();
    const newly = base();
    filtered.forEach(qr => {
      const m = monthFromQuote(qr);
      const s = (qr.status || '').toLowerCase();
      if (s === 'won') won[m] += 1;
      else if (s === 'lost') lost[m] += 1;
      else if (s === 'cancelled') cancelled[m] += 1;
      else if (s === 'in progress') inProgress[m] += 1;
      else if (s === 'new') newly[m] += 1;
    });
    return { won, lost, cancelled, inProgress, newly };
  }, [filtered]);

  // Pair table: KPIs between creatorCountry and involvedCountry
  type PairKey = string; // `${creator}->${involved}`
  const pairRows = useMemo(() => {
    const map = new Map<PairKey, { creator: string; involved: string; total: number; won: number; lost: number; cancelled: number; inProgress: number; newly: number; wonEUR: number; lostEUR: number; cancelledEUR: number }>();
    filtered.forEach(qr => {
      const key = `${qr.creatorCountry}->${qr.involvedCountry}`;
      if (!map.has(key)) map.set(key, { creator: qr.creatorCountry, involved: qr.involvedCountry, total: 0, won: 0, lost: 0, cancelled: 0, inProgress: 0, newly: 0, wonEUR: 0, lostEUR: 0, cancelledEUR: 0 });
      const row = map.get(key)!;
      row.total += 1; // count all created items for this pair
      const s = (qr.status || '').toLowerCase();
      const eur = qr.totalValueEUR || 0;
      if (s==='won') { row.won += 1; row.wonEUR += eur; }
      else if (s==='lost') { row.lost += 1; row.lostEUR += eur; }
      else if (s==='cancelled') { row.cancelled += 1; row.cancelledEUR += eur; }
      else if (s==='in progress') { row.inProgress += 1; }
      else if (s==='new') { row.newly += 1; }
    });
    return Array.from(map.values()).sort((a,b) => (b.wonEUR - a.wonEUR) || (b.won - a.won));
  }, [filtered]);

  // Helpers for customer-by-year comparison
  const applyFiltersForYear = (targetYear: number) => {
    const creatorAll = filterCreator.length === 0 || filterCreator.includes('all');
    const involvedAll = filterInvolved.length === 0 || filterInvolved.includes('all');
    const customersAll = filterCustomers.length === 0 || filterCustomers.includes('all');
    return data
      .filter(qr => preferYearForQuote(qr) === targetYear)
      .filter(qr => creatorAll ? true : filterCreator.includes(qr.creatorCountry))
      .filter(qr => involvedAll ? true : filterInvolved.includes(qr.involvedCountry))
      .filter(qr => {
        if (customersAll) return true;
        const id = qr.customer;
        const name = (qr as any).customerName;
        return (id && filterCustomers.includes(id)) || (name && filterCustomers.includes(name));
      });
  };

  type CustStat = { id: string; name: string; won: number; lost: number; cancelled: number; wonEUR: number; lostEUR: number; cancelledEUR: number };
  const computeCustomerStats = (items: QuoteRequest[]): Map<string, CustStat> => {
    const map = new Map<string, CustStat>();
    items.forEach(qr => {
      const normalizedName = ((qr as any).customerName || '').trim().toLowerCase().replace(/\s+/g,' ');
      const id = (qr.customer as string) || normalizedName || 'unknown';
      const name = customers.find(c => c.id === qr.customer)?.name || (qr as any).customerName || 'Unknown';
      if (!map.has(id)) map.set(id, { id, name, won:0, lost:0, cancelled:0, wonEUR:0, lostEUR:0, cancelledEUR:0 });
      const stat = map.get(id)!;
      const eur = qr.totalValueEUR || 0;
      const s = qr.status?.toLowerCase();
      if (s==='won') { stat.won++; stat.wonEUR += eur; }
      else if (s==='lost') { stat.lost++; stat.lostEUR += eur; }
      else if (s==='cancelled') { stat.cancelled++; stat.cancelledEUR += eur; }
    });
    return map;
  };

  // Conversion funnel for the selected year and filters
  const funnel = useMemo(() => {
    const created = filtered.length;
    const wonItems = filtered.filter(q => (q.status || '').toLowerCase() === 'won');
    const won = wonItems.length;
    const wonEUR = wonItems.reduce((s,q)=> s + (q.totalValueEUR || 0), 0);
    const inProgress = filtered.filter(q => (q.status || '').toLowerCase() === 'in progress').length;
    const newly = filtered.filter(q => (q.status || '').toLowerCase() === 'new').length;
    // Approximate cycle time: createdAt -> updatedAt for won items (if available)
    const days = wonItems
      .map(q => {
        const c = parseDateValue(q.createdAt)?.getTime();
        const u = parseDateValue((q as any).updatedAt)?.getTime();
        if (!c || !u) return null;
        return Math.max(0, Math.round((u - c) / (1000*60*60*24)));
      })
      .filter((n): n is number => typeof n === 'number');
    const avgDaysToWin = days.length ? Math.round(days.reduce((a,b)=>a+b,0) / days.length) : null;
    return { created, won, wonEUR, inProgress, newly, conversion: created ? Math.round((won/created)*100) : 0, avgDaysToWin };
  }, [filtered]);

  // Top customers by Won EUR (and share % of total Won EUR)
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; wonEUR: number; customerId?: string }>();
    let totalWon = 0;
    filtered.forEach(q => {
      if ((q.status || '').toLowerCase() !== 'won') return;
      const eur = q.totalValueEUR || 0;
      totalWon += eur;
      
      // Improved customer resolution: prioritize customer ID lookup, then fallback to customerName
      let customerId = q.customer as string;
      let customerName = '';
      
      if (customerId) {
        // Try to find customer by ID first
        const foundCustomer = customers.find(c => c.id === customerId);
        if (foundCustomer) {
          customerName = foundCustomer.name;
        } else {
          // Customer ID exists but not found in customers collection - this is the "Unknown" issue
          console.log('[Analytics] Customer ID not found in customers collection:', customerId);
          customerName = 'Unknown Customer (ID: ' + customerId + ')';
        }
      } else {
        // No customer ID, use customerName as both ID and name
        customerName = (q as any).customerName || 'No Customer Assigned';
        customerId = customerName; // Use name as ID for grouping
      }
      
      // Use customerName as the grouping key for consistency
      const groupKey = customerName.toLowerCase().trim();
      const cur = map.get(groupKey) || { name: customerName, wonEUR: 0, customerId };
      cur.wonEUR += eur;
      map.set(groupKey, cur);
    });
    const rows = Array.from(map.entries()).map(([key, v]) => ({ 
      id: v.customerId || key, 
      name: v.name, 
      wonEUR: v.wonEUR, 
      share: totalWon ? (v.wonEUR / totalWon) * 100 : 0 
    }));
    rows.sort((a,b) => b.wonEUR - a.wonEUR);
    return { rows, totalWon };
  }, [filtered, customers]);

  // Get quote requests for selected customer (ONLY Won status for Won EUR analytics)
  const selectedCustomerQRs = useMemo(() => {
    if (!selectedCustomerForDetails) return [];
    
    console.log('[Analytics] Filtering for customer:', selectedCustomerForDetails);
    console.log('[Analytics] Available customers:', customers.map(c => ({ id: c.id, name: c.name })));
    console.log('[Analytics] Filtered QRs:', filtered.map(qr => ({ 
      id: qr.id, 
      customer: qr.customer, 
      customerName: (qr as any).customerName,
      title: qr.title,
      status: qr.status
    })));
    
    const matches = filtered.filter(qr => {
      // Only include Won status QRs for Won EUR analytics
      if ((qr.status || '').toLowerCase() !== 'won') {
        return false;
      }
      
      const customerId = qr.customer as string;
      
      // First try to match by customer ID
      if (customerId) {
        const foundCustomer = customers.find(c => c.id === customerId);
        if (foundCustomer && foundCustomer.name === selectedCustomerForDetails) {
          console.log('[Analytics] Match found by ID:', customerId, '->', foundCustomer.name);
          return true;
        }
      }
      
      // Fallback: try to match by customerName field if it exists
      const customerName = (qr as any).customerName || '';
      if (customerName && customerName.toLowerCase().trim() === selectedCustomerForDetails.toLowerCase().trim()) {
        console.log('[Analytics] Match found by name:', customerName);
        return true;
      }
      
      return false;
    });
    
    console.log('[Analytics] Found Won matches:', matches.length);
    return matches;
  }, [filtered, selectedCustomerForDetails, customers]);

  // Conversion by country pair (creator -> involved)
  const pairFunnel = useMemo(() => {
    const map = new Map<string, { label: string; created: number; won: number; lost: number; cancelled: number; inProgress: number; newly: number }>();
    filtered.forEach(q => {
      const key = `${q.creatorCountry} -> ${q.involvedCountry}`;
      if (!map.has(key)) map.set(key, { label: key, created: 0, won: 0, lost: 0, cancelled: 0, inProgress: 0, newly: 0 });
      const row = map.get(key)!;
      row.created += 1;
      const s = (q.status || '').toLowerCase();
      if (s==='won') row.won += 1;
      else if (s==='lost') row.lost += 1;
      else if (s==='cancelled') row.cancelled += 1;
      else if (s==='in progress') row.inProgress += 1;
      else if (s==='new') row.newly += 1;
    });
    const rows = Array.from(map.values()).sort((a,b)=> (b.won - a.won) || (b.created - a.created)).slice(0, 10);
    return rows;
  }, [filtered]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#e40115] mb-2">Analytics</h1>
      </div>
      {/* Debug counters to validate totals vs dashboard (visible only to superAdmin) */}
      {userProfile?.role==='superAdmin' && (
        <div className="mb-2 text-xs text-gray-500">
          Debug: loaded {data.length} visible QRs; year {year}: {filtered.length} items; creator filter: {filterCreator.join(',')||'all'}; involved filter: {filterInvolved.join(',')||'all'}
        </div>
      )}
      <div className="mb-1 text-xs text-gray-500">Hold Ctrl/Cmd to multi-select</div>
      <div className="flex flex-wrap items-end gap-2 text-sm mb-4">
          {userProfile?.role==='superAdmin' && (
            <label className="flex items-center gap-1"><input type="checkbox" checked={roleScope==='all'} onChange={(e)=>setRoleScope(e.target.checked?'all':'my')} /> Show all countries</label>
          )}
          <select value={year} onChange={(e)=>setYear(parseInt(e.target.value))} className="border rounded px-2 h-8">
            {years.map(y => (<option key={y} value={y}>{y}</option>))}
          </select>
          <select multiple size={6} value={filterCreator} onChange={(e)=>handleMultiChange(e, setFilterCreator)} className="border rounded px-2 min-w-[220px]">
            {creatorCountries.map(c => (<option key={c} value={c}>{c==='all'?'creator: all':c}</option>))}
          </select>
          <select multiple size={6} value={filterInvolved} onChange={(e)=>handleMultiChange(e, setFilterInvolved)} className="border rounded px-2 min-w-[220px]">
            {involvedCountries.map(c => (<option key={c} value={c}>{c==='all'?'involved: all':c}</option>))}
          </select>
          <div className="flex flex-col gap-1">
            <input value={customerSearch} onChange={(e)=>setCustomerSearch(e.target.value)} placeholder="Search customers" className="border rounded px-2 h-8 min-w-[260px]" />
            <select multiple size={6} value={filterCustomers} onChange={(e)=>handleMultiChange(e, setFilterCustomers)} className="border rounded px-2 min-w-[260px]">
            {customerOptions.map(id => (<option key={id} value={id}>{customerLabel(id)}</option>))}
            </select>
          </div>
          <button
            onClick={()=>{ setFilterCreator([]); setFilterInvolved([]); setFilterCustomers([]); setCustomerSearch(""); }}
            className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100"
            title="Clear selected filters"
          >
            Clear
          </button>
          <button
            onClick={handleExportToExcel}
            className="px-4 py-2 bg-[#e40115] text-white rounded hover:bg-red-700 flex items-center gap-2"
            title="Export current analytics data to Excel"
          >
            📊 Export to Excel
          </button>
      </div>

      {/* Compare years */}
      <div className="flex items-center gap-3 mb-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={compareEnabled} onChange={(e)=>setCompareEnabled(e.target.checked)} /> Compare years
        </label>
        {compareEnabled && (
          <div className="flex items-center gap-2">
            <span>Year A:</span>
            <select value={year} onChange={(e)=>setYear(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {years.map(y => (<option key={`A-${y}`} value={y}>{y}</option>))}
            </select>
            <span>Year B:</span>
            <select value={yearB} onChange={(e)=>setYearB(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {years.map(y => (<option key={`B-${y}`} value={y}>{y}</option>))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Won</div>
              <div className="text-2xl font-semibold">{totals.won}</div>
              <div className="text-sm text-gray-500">EUR {totals.totalWonEUR.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Lost</div>
              <div className="text-2xl font-semibold">{totals.lost}</div>
              <div className="text-sm text-gray-500">EUR {totals.totalLostEUR.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Cancelled</div>
              <div className="text-2xl font-semibold">{totals.cancelled}</div>
              <div className="text-sm text-gray-500">EUR {totals.totalCancelledEUR.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">By Month (counts) — {year}</div>
              <div className="h-72">
              <Bar
                data={{
                  labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                  datasets: [
                    { label: 'Won', data: monthly.won, backgroundColor: 'rgba(34,197,94,0.6)' },
                    { label: 'Lost', data: monthly.lost, backgroundColor: 'rgba(0,0,0,0.8)' },
                    { label: 'Cancelled', data: monthly.cancelled, backgroundColor: '#bbbdbe' },
                    { label: 'In Progress', data: monthly.inProgress, backgroundColor: '#E40115' },
                    { label: 'New', data: monthly.newly, backgroundColor: '#E40115' },
                  ]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
              </div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">Distribution (counts) — {year}</div>
              <div className="h-72">
              <Pie
                data={{
                  labels: ['Won','Lost','Cancelled','In Progress','New'],
                  datasets: [{
                    label: 'Count',
                    data: [totals.won, totals.lost, totals.cancelled, totals.inProgress, totals.newCount],
                    backgroundColor: ['rgba(34,197,94,0.6)','rgba(0,0,0,0.8)','#bbbdbe','#E40115','#E40115'],
                    borderColor: ['#16a34a','#000000','#9aa0a6','#E40115','#E40115']
                  }]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
              </div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">Distribution (EUR) — {year}</div>
              <div className="h-72">
              <Pie
                data={{
                  labels: ['Won EUR','Lost EUR','Cancelled EUR','In Progress EUR','New EUR'],
                  datasets: [{
                    label: 'EUR',
                    data: [totals.totalWonEUR, totals.totalLostEUR, totals.totalCancelledEUR, totals.totalInProgressEUR, totals.totalNewEUR],
                    backgroundColor: ['rgba(34,197,94,0.6)','rgba(0,0,0,0.8)','#bbbdbe','#E40115','#E40115'],
                    borderColor: ['#16a34a','#000000','#9aa0a6','#E40115','#E40115']
                  }]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
                  scales: {}
                }}
              />
              </div>
            </div>
          </div>

          {/* Conversion Funnel */}
          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-700 mb-3">Conversion Funnel — {year}</div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
              <div className="bg-gray-50 rounded p-3">
                <div className="text-xs text-gray-500">Created</div>
                <div className="text-xl font-semibold">{funnel.created}</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-xs text-gray-500">In Progress</div>
                <div className="text-xl font-semibold">{funnel.inProgress}</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-xs text-gray-500">New</div>
                <div className="text-xl font-semibold">{funnel.newly}</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-xs text-gray-500">Won</div>
                <div className="text-xl font-semibold">{funnel.won}</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-xs text-gray-500">Conversion</div>
                <div className="text-xl font-semibold">{funnel.conversion}%</div>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <div className="text-xs text-gray-500">Won EUR</div>
                <div className="text-xl font-semibold">EUR {Math.round(funnel.wonEUR).toLocaleString()}</div>
                {funnel.avgDaysToWin !== null && (
                  <div className="text-xs text-gray-500 mt-1">Avg days to win: {funnel.avgDaysToWin}</div>
                )}
              </div>
            </div>
          </div>

          {/* Top Customers by Won EUR */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bar Chart - Top 10 Customers by Won EUR */}
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">Top 10 customers by Won EUR — {year}</div>
              {topCustomers.rows.length === 0 ? (
                <div className="text-gray-500">No won revenue for selected filters</div>
              ) : (
                <div className="space-y-2">
                  {topCustomers.rows.slice(0, 10).map(r => (
                    <div key={r.id} className="cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors" onClick={() => setSelectedCustomerForDetails(r.name)}>
                      <div className="flex justify-between text-sm">
                        <div className="font-medium text-gray-800 truncate pr-2">{r.name}</div>
                        <div className="text-gray-600">EUR {Math.round(r.wonEUR).toLocaleString()} • {r.share.toFixed(1)}%</div>
                      </div>
                      <div className="w-full bg-gray-100 h-2 rounded">
                        <div className="bg-[#E40115] h-2 rounded" style={{ width: `${Math.min(100, r.share)}%` }} />
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-gray-500 mt-2">Total Won EUR: EUR {Math.round(topCustomers.totalWon).toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-1">Click on a customer bar to see their quote requests</div>
                </div>
              )}
            </div>

            {/* Pie Chart - Top 10 Customers by Won QR Count */}
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">Top 10 customers by Won QR count — {year}</div>
              {topCustomers.rows.length === 0 ? (
                <div className="text-gray-500">No won quote requests for selected filters</div>
              ) : (
                <div className="h-72">
                  <Pie
                    data={{
                      labels: topCustomers.rows.slice(0, 10).map(r => r.name),
                      datasets: [{
                        label: 'Won QR Count',
                        data: topCustomers.rows.slice(0, 10).map(r => {
                          // Count actual Won QRs for this customer
                          return filtered.filter(qr => {
                            if ((qr.status || '').toLowerCase() !== 'won') return false;
                            const customerId = qr.customer as string;
                            if (customerId) {
                              const foundCustomer = customers.find(c => c.id === customerId);
                              return foundCustomer && foundCustomer.name === r.name;
                            }
                            const customerName = (qr as any).customerName || '';
                            return customerName.toLowerCase().trim() === r.name.toLowerCase().trim();
                          }).length;
                        }),
                        backgroundColor: [
                          'rgba(228, 1, 21, 0.8)',   // Loxam Red
                          'rgba(187, 189, 190, 0.8)', // Dark Grey
                          'rgba(0, 0, 0, 0.8)',       // Black
                          'rgba(34, 197, 94, 0.6)',   // Green
                          'rgba(59, 130, 246, 0.6)',  // Blue
                          'rgba(168, 85, 247, 0.6)',  // Purple
                          'rgba(245, 158, 11, 0.6)',  // Yellow
                          'rgba(239, 68, 68, 0.6)',   // Red
                          'rgba(16, 185, 129, 0.6)',  // Emerald
                          'rgba(139, 92, 246, 0.6)'   // Violet
                        ],
                        borderColor: [
                          '#E40115', '#bbbdbe', '#000000', '#16a34a', '#3b82f6',
                          '#a855f7', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6'
                        ],
                        borderWidth: 1
                      }]
                    }}
                    options={{ 
                      responsive: true, 
                      maintainAspectRatio: false, 
                      plugins: { 
                        legend: { 
                          position: 'bottom',
                          labels: {
                            usePointStyle: true,
                            padding: 15,
                            font: { size: 10 }
                          }
                        } 
                      } 
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Customer Details Modal */}
          {selectedCustomerForDetails && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-[#e40115]">Won Quote Requests for {selectedCustomerForDetails}</h3>
                  <button
                    onClick={() => setSelectedCustomerForDetails(null)}
                    className="text-gray-500 hover:text-gray-700 text-xl"
                  >
                    ×
                  </button>
                </div>
                
                {selectedCustomerQRs.length === 0 ? (
                  <div className="text-gray-500">No Won quote requests found for this customer with current filters.</div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-gray-600 mb-3">
                      Showing {selectedCustomerQRs.length} Won quote request{selectedCustomerQRs.length !== 1 ? 's' : ''} for {selectedCustomerForDetails}
                    </div>
                    {selectedCustomerQRs.map(qr => (
                      <div key={qr.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-medium text-gray-800">{qr.title}</div>
                          <div className="text-sm text-gray-600">{qr.status}</div>
                        </div>
                        <div className="text-sm text-gray-600 mb-1">
                          {qr.creatorCountry} → {qr.involvedCountry}
                        </div>
                        <div className="text-sm text-gray-600 mb-2">
                          EUR {Math.round(qr.totalValueEUR || 0).toLocaleString()}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-xs text-gray-500">
                            Created: {parseDateValue(qr.createdAt)?.toLocaleDateString() || 'Unknown'}
                          </div>
                          <a 
                            href={`/quote-requests/${qr.id}/edit`}
                            className="text-[#e40115] underline text-sm hover:text-red-700"
                          >
                            View Details
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* By country pair - top 10 */}
          <div className="p-4 bg-white rounded shadow overflow-auto">
            <div className="text-sm text-gray-700 mb-3">Top country pairs by wins — {year}</div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Country Pair</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-4">In Progress</th>
                  <th className="py-2 pr-4">New</th>
                  <th className="py-2 pr-4">Won</th>
                  <th className="py-2 pr-4">Conversion %</th>
                </tr>
              </thead>
              <tbody>
                {pairFunnel.map(r => (
                  <tr key={r.label} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.label}</td>
                    <td className="py-2 pr-4">{r.created}</td>
                    <td className="py-2 pr-4">{r.inProgress}</td>
                    <td className="py-2 pr-4">{r.newly}</td>
                    <td className="py-2 pr-4">{r.won}</td>
                    <td className="py-2 pr-4">{r.created ? Math.round((r.won / r.created)*100) : 0}%</td>
                  </tr>
                ))}
                {pairFunnel.length===0 && (
                  <tr><td colSpan={5} className="py-3 text-gray-500">No data for selected filters</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {compareEnabled && (
            <div className="p-4 bg-white rounded shadow overflow-auto">
              <div className="text-sm text-gray-700 mb-3">Customers comparison (Year {year} vs Year {yearB})</div>
              {(() => {
                const aItems = applyFiltersForYear(year);
                const bItems = applyFiltersForYear(yearB);
                const a = computeCustomerStats(aItems);
                const b = computeCustomerStats(bItems);
                const allKeys = Array.from(new Set<string>([...a.keys(), ...b.keys()]));
                allKeys.sort((k1, k2) => (a.get(k2)?.wonEUR || 0) - (a.get(k1)?.wonEUR || 0));
                return (
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-left border-b">
                        <th className="py-2 pr-4">Customer</th>
                        <th className="py-2 pr-4">{year} Won (EUR)</th>
                        <th className="py-2 pr-4">{year} Lost (EUR)</th>
                        <th className="py-2 pr-4">{year} Cancelled (EUR)</th>
                        <th className="py-2 pr-4">{yearB} Won (EUR)</th>
                        <th className="py-2 pr-4">{yearB} Lost (EUR)</th>
                        <th className="py-2 pr-4">{yearB} Cancelled (EUR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allKeys.map(k => {
                        const sa = a.get(k); const sb = b.get(k);
                        const name = sa?.name || sb?.name || k;
                        const fmt = (n?: number) => Math.round(n || 0).toLocaleString();
                        return (
                          <tr key={k} className="border-b last:border-0">
                            <td className="py-2 pr-4">{name}</td>
                            <td className="py-2 pr-4">{fmt(sa?.wonEUR)}</td>
                            <td className="py-2 pr-4">{fmt(sa?.lostEUR)}</td>
                            <td className="py-2 pr-4">{fmt(sa?.cancelledEUR)}</td>
                            <td className="py-2 pr-4">{fmt(sb?.wonEUR)}</td>
                            <td className="py-2 pr-4">{fmt(sb?.lostEUR)}</td>
                            <td className="py-2 pr-4">{fmt(sb?.cancelledEUR)}</td>
                          </tr>
                        );
                      })}
                      {allKeys.length===0 && (
                        <tr><td colSpan={7} className="py-3 text-gray-500">No matching customers for selected filters</td></tr>
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          )}

          {compareEnabled && (
            <div className="p-4 bg-white rounded shadow">
              <ComparisonBlock
                data={data}
                yearA={year}
                yearB={yearB}
                filterCreator={filterCreator}
                filterInvolved={filterInvolved}
                filterCustomers={filterCustomers}
              />
            </div>
          )}

          <div className="p-4 bg-white rounded shadow overflow-auto">
            <div className="text-sm text-gray-700 mb-3">KPIs between creatorCountry → involvedCountry</div>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Creator</th>
                  <th className="py-2 pr-4">Involved</th>
                  <th className="py-2 pr-4"># Total</th>
                  <th className="py-2 pr-4"># Won</th>
                  <th className="py-2 pr-4"># Lost</th>
                  <th className="py-2 pr-4"># Cancelled</th>
                  <th className="py-2 pr-4"># In Progress</th>
                  <th className="py-2 pr-4"># New</th>
                  <th className="py-2 pr-4">EUR Won</th>
                  <th className="py-2 pr-4">EUR Lost</th>
                  <th className="py-2 pr-4">EUR Cancelled</th>
                </tr>
              </thead>
              <tbody>
                {pairRows.map(r => (
                  <tr key={`${r.creator}->${r.involved}`} className="border-b last:border-0">
                    <td className="py-2 pr-4">{r.creator}</td>
                    <td className="py-2 pr-4">{r.involved}</td>
                    <td className="py-2 pr-4">{r.total}</td>
                    <td className="py-2 pr-4">{r.won}</td>
                    <td className="py-2 pr-4">{r.lost}</td>
                    <td className="py-2 pr-4">{r.cancelled}</td>
                    <td className="py-2 pr-4">{r.inProgress}</td>
                    <td className="py-2 pr-4">{r.newly}</td>
                    <td className="py-2 pr-4">{Math.round(r.wonEUR).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Math.round(r.lostEUR).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Math.round(r.cancelledEUR).toLocaleString()}</td>
                  </tr>
                ))}
                {pairRows.length===0 && (
                  <tr><td colSpan={11} className="py-3 text-gray-500">No data for selected filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



