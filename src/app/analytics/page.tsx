"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, orderBy, Firestore } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";

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
  const [countryFilter, setCountryFilter] = useState<string>("all");
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

  const years = useMemo(() => {
    const s = new Set<number>();
    data.forEach(qr => s.add(yearFromDate(qr.createdAt)));
    const list = Array.from(s).sort((a,b)=>b-a);
    if (!list.includes(new Date().getFullYear())) list.unshift(new Date().getFullYear());
    return list;
  }, [data]);

  const filtered = useMemo(() => {
    return data.filter(qr => yearFromDate(qr.createdAt) === year)
      .filter(qr => countryFilter==='all' ? true : (qr.creatorCountry===countryFilter || qr.involvedCountry===countryFilter));
  }, [data, year, countryFilter]);

  const totals = useMemo(() => {
    const agg = { won:0, lost:0, cancelled:0, totalWonEUR:0 } as any;
    filtered.forEach(qr => {
      const status = qr.status?.toLowerCase();
      if (status==='won') { agg.won++; agg.totalWonEUR += qr.totalValueEUR || 0; }
      if (status==='lost') agg.lost++;
      if (status==='cancelled') agg.cancelled++;
    });
    return agg;
  }, [filtered]);

  const countries = useMemo(() => {
    const s = new Set<string>();
    data.forEach(qr => { s.add(qr.creatorCountry); s.add(qr.involvedCountry); });
    return ['all', ...Array.from(s).sort()];
  }, [data]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-[#e40115]">Analytics</h1>
        <div className="flex items-center gap-2 text-sm">
          {userProfile?.role==='superAdmin' && (
            <label className="flex items-center gap-1"><input type="checkbox" checked={roleScope==='all'} onChange={(e)=>setRoleScope(e.target.checked?'all':'my')} /> Show all countries</label>
          )}
          <select value={year} onChange={(e)=>setYear(parseInt(e.target.value))} className="border rounded px-2 py-1">
            {years.map(y => (<option key={y} value={y}>{y}</option>))}
          </select>
          <select value={countryFilter} onChange={(e)=>setCountryFilter(e.target.value)} className="border rounded px-2 py-1">
            {countries.map(c => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
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
            </div>
            <div className="p-4 bg-white rounded shadow">
              <div className="text-sm text-gray-500">Cancelled</div>
              <div className="text-2xl font-semibold">{totals.cancelled}</div>
            </div>
          </div>

          <div className="p-4 bg-white rounded shadow">
            <div className="text-sm text-gray-700 mb-2">Notes</div>
            <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
              <li>Analytics are based on EUR totals if available; many existing Quote Requests may not have a total yet. This view updates automatically as values are added.</li>
              <li>Filters: year (default current), optional country scope, optional show-all for superAdmin.</li>
              <li>Next steps: add charts (stacked bars by month, pie charts by status/country) and a map view.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}


