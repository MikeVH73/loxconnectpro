"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
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

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  status: string;
  startDate: string;
  endDate: string | null;
  customerDecidesEnd: boolean;
}

interface PositionedQuoteRequest extends QuoteRequest {
  row: number;
}

export default function PlanningPage() {
  const { userProfile } = useAuth();
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        const quotesRef = collection(db as Firestore, "quoteRequests");
        const q = query(
          quotesRef,
          where("status", "==", "In Progress")
        );
        
        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as QuoteRequest));

        requests = requests.filter(qr => 
          userCountries.includes(qr.creatorCountry) || 
          userCountries.includes(qr.involvedCountry)
        );

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
  }, [userProfile]);

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
    const startDate = parseISO(quote.startDate);
    const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
    return weekDays.some(day => 
      isWithinInterval(day, { start: startDate, end: endDate })
    );
  });

  // Position quotes to avoid overlaps
  const positionedQuotes: PositionedQuoteRequest[] = [];
  weekQuotes.forEach(quote => {
    const startDate = parseISO(quote.startDate);
    const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
    
    let row = 0;
    while (positionedQuotes.some(pQuote => {
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
  });

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
          {positionedQuotes.map((quote) => {
            const startDate = parseISO(quote.startDate);
            const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
            
            let startDayIndex = weekDays.findIndex(day => 
              isSameDay(day, startDate) || 
              (isAfter(startDate, day) && isBefore(startDate, addDays(day, 1)))
            );
            if (startDayIndex === -1) startDayIndex = 0;

            const daysInWeek = Math.min(
              7 - startDayIndex,
              differenceInDays(
                isBefore(endDate, addDays(weekDays[6], 1)) ? endDate : addDays(weekDays[6], 1),
                isSameDay(startDate, weekDays[startDayIndex]) ? startDate : weekDays[startDayIndex]
              ) + 1
            );

            return (
              <Link
                key={quote.id}
                href={`/quote-requests/${quote.id}`}
                className={`
                  absolute z-10 px-3 py-2 text-sm rounded-lg
                  bg-red-50 text-red-700 hover:bg-red-100 
                  transition-all duration-200 ease-in-out
                  overflow-hidden text-ellipsis whitespace-nowrap
                  border border-red-200 shadow-sm
                  hover:shadow-md hover:-translate-y-0.5
                `}
                style={{
                  top: `${padding + quote.row * rowHeight}px`,
                  left: `calc(${startDayIndex} * 100% / 7 + 8px)`,
                  width: `calc(${daysInWeek} * 100% / 7 - 16px)`,
                  height: `${rowHeight - 8}px`,
                }}
                title={`${quote.title} (${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')})`}
              >
                {quote.title}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
} 