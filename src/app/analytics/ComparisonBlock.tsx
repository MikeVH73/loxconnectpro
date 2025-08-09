"use client";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title as ChartTitle,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTitle, Tooltip, Legend);
const Bar = dynamic(() => import('react-chartjs-2').then(m => m.Bar), { ssr: false });

type QuoteRequest = {
  id: string;
  creatorCountry: string;
  involvedCountry: string;
  status: string;
  createdAt?: any;
  totalValueEUR?: number;
  customer?: string;
  customerName?: string;
};

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

function yearFromDate(d?: any) {
  const parsed = parseDateValue(d);
  return parsed ? parsed.getUTCFullYear() : new Date().getUTCFullYear();
}

function monthIndexFromQuote(qr: any) {
  const d = parseDateValue(qr.startDate) || parseDateValue(qr.endDate) || parseDateValue(qr.createdAt) || new Date();
  return d.getUTCMonth();
}

export default function ComparisonBlock({
  data,
  yearA,
  yearB,
  filterCreator,
  filterInvolved,
  filterCustomers,
}: {
  data: QuoteRequest[];
  yearA: number;
  yearB: number;
  filterCreator: string[];
  filterInvolved: string[];
  filterCustomers: string[];
}) {
  const applyFilters = (year: number) => {
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
  };

  const computeTotals = (items: QuoteRequest[]) => {
    const agg = { won:0, lost:0, cancelled:0, wonEUR:0, lostEUR:0, cancelledEUR:0 };
    items.forEach(qr => {
      const s = qr.status?.toLowerCase();
      const eur = qr.totalValueEUR || 0;
      if (s==='won') { agg.won++; agg.wonEUR += eur; }
      else if (s==='lost') { agg.lost++; agg.lostEUR += eur; }
      else if (s==='cancelled') { agg.cancelled++; agg.cancelledEUR += eur; }
    });
    return agg;
  };

  const aItems = useMemo(()=>applyFilters(yearA), [data, yearA, filterCreator, filterInvolved, filterCustomers]);
  const bItems = useMemo(()=>applyFilters(yearB), [data, yearB, filterCreator, filterInvolved, filterCustomers]);
  const aTotals = useMemo(()=>computeTotals(aItems), [aItems]);
  const bTotals = useMemo(()=>computeTotals(bItems), [bItems]);

  const monthlyData = (items: QuoteRequest[]) => {
    const won = Array.from({length:12},()=>0);
    const lost = Array.from({length:12},()=>0);
    const cancelled = Array.from({length:12},()=>0);
    items.forEach(qr => {
      const m = monthIndexFromQuote(qr);
      const s = qr.status?.toLowerCase();
      if (s==='won') won[m] += 1; else if (s==='lost') lost[m] += 1; else if (s==='cancelled') cancelled[m] += 1;
    });
    return { won, lost, cancelled };
  };

  const aMonthly = useMemo(()=>monthlyData(aItems), [aItems]);
  const bMonthly = useMemo(()=>monthlyData(bItems), [bItems]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded border">
          <div className="font-medium mb-2">Year {yearA}</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Won</div>
              <div className="text-lg font-semibold">{aTotals.won}</div>
              <div className="text-xs text-gray-500">EUR {Math.round(aTotals.wonEUR).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Lost</div>
              <div className="text-lg font-semibold">{aTotals.lost}</div>
              <div className="text-xs text-gray-500">EUR {Math.round(aTotals.lostEUR).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Cancelled</div>
              <div className="text-lg font-semibold">{aTotals.cancelled}</div>
              <div className="text-xs text-gray-500">EUR {Math.round(aTotals.cancelledEUR).toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-white rounded border">
          <div className="font-medium mb-2">Year {yearB}</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="text-xs text-gray-500">Won</div>
              <div className="text-lg font-semibold">{bTotals.won}</div>
              <div className="text-xs text-gray-500">EUR {Math.round(bTotals.wonEUR).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Lost</div>
              <div className="text-lg font-semibold">{bTotals.lost}</div>
              <div className="text-xs text-gray-500">EUR {Math.round(bTotals.lostEUR).toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Cancelled</div>
              <div className="text-lg font-semibold">{bTotals.cancelled}</div>
              <div className="text-xs text-gray-500">EUR {Math.round(bTotals.cancelledEUR).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white rounded border">
          <div className="text-sm text-gray-700 mb-2">Monthly counts - {yearA}</div>
          <div className="h-64">
            <Bar
              data={{
                labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                datasets: [
                  { label: 'Won', data: aMonthly.won, backgroundColor: 'rgba(34,197,94,0.6)' },
                  { label: 'Lost', data: aMonthly.lost, backgroundColor: 'rgba(239,68,68,0.6)' },
                  { label: 'Cancelled', data: aMonthly.cancelled, backgroundColor: 'rgba(234,179,8,0.6)' },
                ]
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
            />
          </div>
        </div>
        <div className="p-4 bg-white rounded border">
          <div className="text-sm text-gray-700 mb-2">Monthly counts - {yearB}</div>
          <div className="h-64">
            <Bar
              data={{
                labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
                datasets: [
                  { label: 'Won', data: bMonthly.won, backgroundColor: 'rgba(34,197,94,0.6)' },
                  { label: 'Lost', data: bMonthly.lost, backgroundColor: 'rgba(239,68,68,0.6)' },
                  { label: 'Cancelled', data: bMonthly.cancelled, backgroundColor: 'rgba(234,179,8,0.6)' },
                ]
              }}
              options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


