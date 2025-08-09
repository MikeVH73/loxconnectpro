"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import dynamic from "next/dynamic";
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
}

const yearFromDate = (d?: any) => {
  try {
    const date = d?.toDate?.() || (typeof d === 'string' ? new Date(d) : d) || new Date();
    return date.getFullYear();
  } catch { return new Date().getFullYear(); }
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
    data.forEach(qr => s.add(yearFromDate(qr.createdAt)));
    const list = Array.from(s).sort((a,b)=>b-a);
    if (!list.includes(new Date().getFullYear())) list.unshift(new Date().getFullYear());
    return list;
  }, [data]);

  const filtered = useMemo(() => {
    const creatorAll = filterCreator.length === 0 || filterCreator.includes('all');
    const involvedAll = filterInvolved.length === 0 || filterInvolved.includes('all');
    const customersAll = filterCustomers.length === 0 || filterCustomers.includes('all');
    return data
      .filter(qr => yearFromDate(qr.createdAt) === year)
      .filter(qr => creatorAll ? true : filterCreator.includes(qr.creatorCountry))
      .filter(qr => involvedAll ? true : filterInvolved.includes(qr.involvedCountry))
      .filter(qr => {
        if (customersAll) return true;
        const id = qr.customer;
        const name = (qr as any).customerName;
        return (id && filterCustomers.includes(id)) || (name && filterCustomers.includes(name));
      });
  }, [data, year, filterCreator, filterInvolved, filterCustomers]);

  const totals = useMemo(() => {
    const agg = { won:0, lost:0, cancelled:0, totalWonEUR:0, totalLostEUR:0, totalCancelledEUR:0 } as any;
    filtered.forEach(qr => {
      const status = qr.status?.toLowerCase();
      if (status==='won') { agg.won++; agg.totalWonEUR += qr.totalValueEUR || 0; }
      if (status==='lost') { agg.lost++; agg.totalLostEUR += qr.totalValueEUR || 0; }
      if (status==='cancelled') { agg.cancelled++; agg.totalCancelledEUR += qr.totalValueEUR || 0; }
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

  // Monthly bar data (counts per month by status)
  const monthly = useMemo(() => {
    const base = () => Array.from({ length: 12 }, () => 0);
    const won = base();
    const lost = base();
    const cancelled = base();
    filtered.forEach(qr => {
      const created = qr.createdAt?.toDate?.() || (typeof qr.createdAt === 'string' ? new Date(qr.createdAt) : qr.createdAt);
      const d = created instanceof Date ? created : new Date();
      const m = d.getMonth();
      const s = qr.status?.toLowerCase();
      if (s === 'won') won[m] += 1;
      else if (s === 'lost') lost[m] += 1;
      else if (s === 'cancelled') cancelled[m] += 1;
    });
    return { won, lost, cancelled };
  }, [filtered]);

  // Pair table: KPIs between creatorCountry and involvedCountry
  type PairKey = string; // `${creator}->${involved}`
  const pairRows = useMemo(() => {
    const map = new Map<PairKey, { creator: string; involved: string; total: number; won: number; lost: number; cancelled: number; wonEUR: number; lostEUR: number; cancelledEUR: number }>();
    filtered.forEach(qr => {
      const key = `${qr.creatorCountry}->${qr.involvedCountry}`;
      if (!map.has(key)) map.set(key, { creator: qr.creatorCountry, involved: qr.involvedCountry, total: 0, won: 0, lost: 0, cancelled: 0, wonEUR: 0, lostEUR: 0, cancelledEUR: 0 });
      const row = map.get(key)!;
      row.total += 1;
      const s = qr.status?.toLowerCase();
      const eur = qr.totalValueEUR || 0;
      if (s==='won') { row.won += 1; row.wonEUR += eur; }
      else if (s==='lost') { row.lost += 1; row.lostEUR += eur; }
      else if (s==='cancelled') { row.cancelled += 1; row.cancelledEUR += eur; }
    });
    return Array.from(map.values()).sort((a,b) => (b.wonEUR - a.wonEUR) || (b.won - a.won));
  }, [filtered]);

  return (
    <div className="p-6">
      <div className="mb-1 text-xs text-gray-500">Hold Ctrl/Cmd to multi-select</div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#e40115]">Analytics</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {userProfile?.role==='superAdmin' && (
            <label className="flex items-center gap-1"><input type="checkbox" checked={roleScope==='all'} onChange={(e)=>setRoleScope(e.target.checked?'all':'my')} /> Show all countries</label>
          )}
          <select value={year} onChange={(e)=>setYear(parseInt(e.target.value))} className="border rounded px-2 py-1">
            {years.map(y => (<option key={y} value={y}>{y}</option>))}
          </select>
          <select multiple size={Math.min(6, creatorCountries.length)} value={filterCreator} onChange={(e)=>handleMultiChange(e, setFilterCreator)} className="border rounded px-2 py-1 min-w-[220px]">
            {creatorCountries.map(c => (<option key={c} value={c}>{c==='all'?'creator: all':c}</option>))}
          </select>
          <select multiple size={Math.min(6, involvedCountries.length)} value={filterInvolved} onChange={(e)=>handleMultiChange(e, setFilterInvolved)} className="border rounded px-2 py-1 min-w-[220px]">
            {involvedCountries.map(c => (<option key={c} value={c}>{c==='all'?'involved: all':c}</option>))}
          </select>
          <div className="flex flex-col gap-1">
            <input value={customerSearch} onChange={(e)=>setCustomerSearch(e.target.value)} placeholder="Search customers" className="border rounded px-2 py-1 min-w-[240px]" />
            <select multiple size={Math.min(6, customerOptions.length)} value={filterCustomers} onChange={(e)=>handleMultiChange(e, setFilterCustomers)} className="border rounded px-2 py-1 min-w-[240px]">
            {customerOptions.map(id => (<option key={id} value={id}>{customerLabel(id)}</option>))}
            </select>
          </div>
          <button
            onClick={()=>{ setFilterCreator([]); setFilterInvolved([]); setFilterCustomers([]); }}
            className="px-3 py-1 border rounded text-gray-700 hover:bg-gray-100"
            title="Clear selected countries"
          >
            Clear
          </button>
        </div>
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
              {years.map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
            <span>Year B:</span>
            <select value={yearB} onChange={(e)=>setYearB(parseInt(e.target.value))} className="border rounded px-2 py-1">
              {years.map(y => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              <div className="text-sm text-gray-700 mb-2">By Month (counts)</div>
              <div className="h-72">
              <Bar
                data={{
                  labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                  datasets: [
                    { label: 'Won', data: monthly.won, backgroundColor: 'rgba(34,197,94,0.6)' },
                    { label: 'Lost', data: monthly.lost, backgroundColor: 'rgba(239,68,68,0.6)' },
                    { label: 'Cancelled', data: monthly.cancelled, backgroundColor: 'rgba(234,179,8,0.6)' },
                  ]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
              </div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">Distribution (counts)</div>
              <div className="h-72">
              <Pie
                data={{
                  labels: ['Won','Lost','Cancelled'],
                  datasets: [{
                    label: 'Count',
                    data: [totals.won, totals.lost, totals.cancelled],
                    backgroundColor: ['rgba(34,197,94,0.6)','rgba(239,68,68,0.6)','rgba(234,179,8,0.6)'],
                    borderColor: ['#16a34a','#dc2626','#ca8a04']
                  }]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
              />
              </div>
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-700 mb-2">Distribution (EUR)</div>
              <div className="h-72">
              <Pie
                data={{
                  labels: ['Won EUR','Lost EUR','Cancelled EUR'],
                  datasets: [{
                    label: 'EUR',
                    data: [totals.totalWonEUR, totals.totalLostEUR, totals.totalCancelledEUR],
                    backgroundColor: ['rgba(34,197,94,0.6)','rgba(239,68,68,0.6)','rgba(234,179,8,0.6)'],
                    borderColor: ['#16a34a','#dc2626','#ca8a04']
                  }]
                }}
                options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } },
                  scales: {}
                }}
              />
              </div>
            </div>
          </div>

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
                    <td className="py-2 pr-4">{Math.round(r.wonEUR).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Math.round(r.lostEUR).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Math.round(r.cancelledEUR).toLocaleString()}</td>
                  </tr>
                ))}
                {pairRows.length===0 && (
                  <tr><td colSpan={9} className="py-3 text-gray-500">No data for selected filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}



