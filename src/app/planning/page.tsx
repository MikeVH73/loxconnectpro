"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Firestore, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';
import Link from 'next/link';
import {
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  parseISO,
  isWithinInterval,
  addWeeks,
  subWeeks,
  isSameDay,
  addDays,
  differenceInDays,
  isAfter,
  isBefore,
  getWeek
} from 'date-fns';
import { enGB } from 'date-fns/locale';

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
  status: string;
  startDate: string;
  endDate: string | null;
  customerDecidesEnd: boolean;
  labels: string[];
  planned: boolean;
  customer: string;
  waitingForAnswer: boolean;
  urgent: boolean;
  problems: boolean;
  hasUnreadMessages?: boolean;
  lastMessageAt?: string | null;
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
  customerNumber?: string;
  customerDecidesEndDate?: boolean;
  latitude?: string;
  longitude?: string;
  updatedAt?: Date;
  updatedBy?: string;
}

interface PositionedQuoteRequest extends QuoteRequest {
  row: number;
}

export default function PlanningPage() {
  const { userProfile } = useAuth();
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Helper functions
  const getCustomerName = (id: string | undefined) => {
    if (!id) return '';
    const customer = customers.find(c => c.id === id);
    return customer ? customer.name : id;
  };

  // Get the current week's days (Monday to Sunday)
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // 1 = Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    const fetchQuoteRequests = async () => {
      if (!db || !userProfile) return;

      try {
        const userCountries = userProfile.countries || [];
        console.log("[Planning] User Profile:", {
          email: userProfile?.email,
          role: userProfile?.role,
          countries: userCountries,
          businessUnit: userProfile?.businessUnit
        });

        if (!userCountries.length) {
          setError("No country assigned to your profile");
          setLoading(false);
          return;
        }

        const labelsSnapshot = await getDocs(collection(db, "labels"));
        const labels = labelsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Label));
        setLabels(labels);
        
        // Fetch customers
        const customersSnapshot = await getDocs(collection(db, "customers"));
        const customers = customersSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Customer));
        setCustomers(customers);
        
        const plannedLabelId = labels.find(label => 
          label.name.toLowerCase() === "planned"
        )?.id;

        const quotesRef = collection(db as Firestore, "quoteRequests");
        
        // Get all quote requests for user's countries
        const creatorQueries = userCountries.map(country => 
          query(quotesRef, where("creatorCountry", "==", country))
        );
        const involvedQueries = userCountries.map(country => 
          query(quotesRef, where("involvedCountry", "==", country))
        );
        
        const allQueries = [...creatorQueries, ...involvedQueries];
        const querySnapshots = await Promise.all(allQueries.map(q => getDocs(q)));

        // Combine and deduplicate results
        const seenIds = new Set<string>();
        let requests: QuoteRequest[] = [];

        querySnapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            const data = doc.data() as QuoteRequest;
            if (!seenIds.has(doc.id)) {
              requests.push({
                ...data,
                id: doc.id,
                // Ensure planned status is set based on both flag and label
                planned: data.planned || (data.labels || []).includes(plannedLabelId || '')
              });
              seenIds.add(doc.id);
            }
          });
        });

        // Update quotes to ensure consistency between flag and label
        const updatePromises = requests.map(async qr => {
          const quoteRef = doc(db as Firestore, "quoteRequests", qr.id);
          const hasPlannedLabel = (qr.labels || []).includes(plannedLabelId || '');
          
          // If either the flag or label indicates planned status, ensure both are set
          if (qr.planned || hasPlannedLabel) {
            const updatedQr = {
              ...qr,
              planned: true,
              labels: [...new Set([
                ...(qr.labels || []),
                ...(plannedLabelId ? [plannedLabelId] : [])
              ])]
            } as QuoteRequest;

            try {
              await updateDoc(quoteRef, {
                planned: true,
                labels: updatedQr.labels
              });
              return updatedQr;
            } catch (err) {
              console.error('Error updating quote request:', err);
              return qr;
            }
          }
          return qr;
        });

        requests = await Promise.all(updatePromises);
        console.log("[Planning] Filtered quote requests:", requests);
        setQuoteRequests(requests);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching quote requests:", err);
        setError("Failed to fetch quote requests");
        setLoading(false);
      }
    };

    fetchQuoteRequests();
  }, [userProfile, db]);

  useEffect(() => {
    const fetchLabels = async () => {
      if (!db) return;
      try {
        const snapshot = await getDocs(collection(db, "labels"));
        setLabels(snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as Label)));
      } catch (err) {
        console.error("Error fetching labels:", err);
      }
    };
    fetchLabels();
  }, []);

  const previousWeek = () => {
    setCurrentDate(prev => subWeeks(prev, 1));
  };

  const nextWeek = () => {
    setCurrentDate(prev => addWeeks(prev, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
    </div>
  );
  
  if (error) return (
    <div className="p-4 bg-red-50 text-red-600 rounded-lg">
      {error}
      {error === "No country assigned to your profile" && (
        <p className="text-sm mt-2">Please contact an administrator to assign you to a country.</p>
      )}
    </div>
  );

  // Get all quotes that appear in this week
  const weekQuotes = quoteRequests.filter(quote => {
    try {
      if (!quote.startDate) return false;
    const startDate = parseISO(quote.startDate);
    const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
    return weekDays.some(day => 
      isWithinInterval(day, { start: startDate, end: endDate })
    );
    } catch (err) {
      console.error('Error parsing dates for quote:', quote.id, err);
      return false;
    }
  });

  // Position quotes to avoid overlaps
  const positionedQuotes: PositionedQuoteRequest[] = [];
  weekQuotes.forEach(quote => {
    try {
      if (!quote.startDate) return;
    const startDate = parseISO(quote.startDate);
    const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
    
    let row = 0;
    while (positionedQuotes.some(pQuote => {
        if (!pQuote.startDate) return false;
      const pStartDate = parseISO(pQuote.startDate);
      const pEndDate = pQuote.endDate ? parseISO(pQuote.endDate) : addDays(pStartDate, 1);
      return pQuote.row === row && (
        isWithinInterval(startDate, { start: pStartDate, end: pEndDate }) ||
        isWithinInterval(endDate, { start: pStartDate, end: pEndDate }) ||
        isWithinInterval(pStartDate, { start: startDate, end: endDate })
      );
    })) {
      row++;
    }
    
    positionedQuotes.push({ ...quote, row });
    } catch (err) {
      console.error('Error positioning quote:', quote.id, err);
    }
  });

  // Get the "Planned" label ID
  const plannedLabelId = labels.find(label => label.name === "Planned")?.id;

  // Calculate height based on number of rows
  const maxRow = Math.max(...positionedQuotes.map(q => q.row), 0);
  const rowHeight = 40; // Increased height for better visibility
  const padding = 16; // Increased padding
  const minHeight = 200; // Increased minimum height
  const calculatedHeight = Math.max(minHeight, (maxRow + 1) * rowHeight + padding * 2);

  const currentWeekNumber = getWeek(currentDate, { weekStartsOn: 1, firstWeekContainsDate: 4 });

  return (
    <div className="flex flex-col h-screen p-6 bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Planning</h1>
        <div className="flex items-center gap-6">
          <button
            onClick={previousWeek}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            ←
          </button>
          <div className="flex flex-col items-center min-w-[200px]">
            <span className="text-lg font-medium text-gray-900">
              Week {currentWeekNumber}
            </span>
            <span className="text-sm text-gray-500">
              {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM yyyy')}
            </span>
          </div>
          <button
            onClick={nextWeek}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            →
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors shadow-sm"
          >
            Today
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-7 border-b">
          {weekDays.map(day => (
            <div 
              key={day.toISOString()} 
              className={`py-4 text-center border-r last:border-r-0 ${
                isSameDay(day, new Date()) ? 'bg-red-50' : ''
              }`}
            >
              <div className="text-sm font-medium text-gray-500 mb-1">
                {format(day, 'EEE', { locale: enGB })}
              </div>
              <div className={`text-2xl font-semibold ${
                isSameDay(day, new Date()) ? 'text-red-600' : 'text-gray-900'
              }`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 relative" style={{ height: calculatedHeight }}>
          {positionedQuotes.map(quote => {
            const startDate = parseISO(quote.startDate);
            const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
            const duration = differenceInDays(endDate, startDate) + 1;
            const startOffset = differenceInDays(startDate, weekStart);
            const width = `${(duration / 7) * 100}%`;
            const left = `${(startOffset / 7) * 100}%`;

            return (
              <Link
                key={quote.id}
                href={`/quote-requests/${quote.id}/edit`}
                className={`absolute p-2 rounded-lg shadow-sm transition-all
                  hover:shadow-md hover:z-10 cursor-pointer
                  ${quote.planned 
                    ? 'bg-red-100 hover:bg-red-200 text-red-900' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                style={{
                  top: `${quote.row * rowHeight + padding}px`,
                  left,
                  width,
                  height: `${rowHeight - 4}px`,
                  display: startOffset >= 7 || startOffset < -7 ? 'none' : 'block'
                }}
              >
                <div className="text-sm font-medium truncate">
                {quote.title}
                </div>
                <div className={`text-xs truncate ${quote.planned ? 'text-red-700' : 'text-gray-600'}`}>
                  {getCustomerName(quote.customer)}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
} 