"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';
import Link from 'next/link';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parseISO,
  isWithinInterval,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  differenceInDays,
  isSameDay,
  isAfter,
  isBefore
} from 'date-fns';

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

  useEffect(() => {
    const fetchQuoteRequests = async () => {
      if (!db || !userProfile) return;

      try {
        // Get the user's assigned countries
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

        // Fetch all "In Progress" quote requests
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

        // Filter quote requests based on user's countries
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

  // Get all days for the calendar view (including days from adjacent months)
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  // Get quote requests that start in this week
  const getQuoteRequestsStartingInWeek = (weekStart: Date) => {
    const weekEnd = addDays(weekStart, 6);
    return quoteRequests.filter(request => {
      const startDate = parseISO(request.startDate);
      return isWithinInterval(startDate, { start: weekStart, end: weekEnd });
    });
  };

  const previousMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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

  // Group calendar days by weeks
  const weeks: Date[][] = [];
  let currentWeek: Date[] = [];
  calendarDays.forEach((day, index) => {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  });

  return (
    <div className="flex flex-col h-screen p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Planning</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={previousMonth}
            className="px-3 py-1 border rounded-md hover:bg-gray-100 transition-colors"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 border rounded-md hover:bg-gray-100 transition-colors text-sm"
          >
            Today
          </button>
          <span className="text-lg font-medium min-w-[140px] text-center">
            {format(currentDate, 'MMMM yyyy')}
          </span>
          <button
            onClick={nextMonth}
            className="px-3 py-1 border rounded-md hover:bg-gray-100 transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg shadow overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 py-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
        </div>

        <div className="flex-1 divide-y overflow-auto">
          {weeks.map((week, weekIndex) => {
            // Get all quotes that appear in this week
            const weekQuotes = quoteRequests.filter(quote => {
              const startDate = parseISO(quote.startDate);
              const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
              return week.some(day => 
                isWithinInterval(day, { start: startDate, end: endDate })
              );
            });

            // Position quotes to avoid overlaps
            const positionedQuotes: PositionedQuoteRequest[] = [];
            weekQuotes.forEach(quote => {
              const startDate = parseISO(quote.startDate);
              const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
              
              // Find the first available row where this quote doesn't overlap
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

            // Calculate required height based on number of rows
            const maxRow = Math.max(...positionedQuotes.map(q => q.row), 0);
            const rowHeight = 32; // Increased height for each quote bar
            const padding = 12; // Increased padding
            const minHeight = 150; // Increased minimum height
            const calculatedHeight = Math.max(minHeight, (maxRow + 1) * rowHeight + padding * 2);

            return (
              <div key={weekIndex} className="grid grid-cols-7 relative" style={{ minHeight: calculatedHeight }}>
                {/* Render the date numbers */}
                {week.map((date) => {
                  const isToday = isSameDay(date, new Date());
                  const isCurrentMonth = isSameMonth(date, currentDate);
                  
                  return (
                    <div
                      key={date.toISOString()}
                      className={`relative p-3 ${
                        !isCurrentMonth ? 'bg-gray-50' : 'bg-white'
                      } ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`font-medium text-base mb-2 ${
                        !isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
                      }`}>
                        {format(date, 'd')}
                      </div>
                    </div>
                  );
                })}

                {/* Render the quote request bars */}
                {positionedQuotes.map((quote) => {
                  const startDate = parseISO(quote.startDate);
                  const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
                  
                  // Calculate the start position within this week
                  let startDayIndex = week.findIndex(day => 
                    isSameDay(day, startDate) || 
                    (isAfter(startDate, day) && isBefore(startDate, addDays(day, 1)))
                  );
                  if (startDayIndex === -1) startDayIndex = 0;

                  // Calculate how many days the bar should span in this week
                  const daysInWeek = Math.min(
                    7 - startDayIndex,
                    differenceInDays(
                      isBefore(endDate, addDays(week[6], 1)) ? endDate : addDays(week[6], 1),
                      isSameDay(startDate, week[startDayIndex]) ? startDate : week[startDayIndex]
                    ) + 1
                  );

                  return (
                    <Link
                      key={quote.id}
                      href={`/quote-requests/${quote.id}`}
                      className={`
                        absolute z-10 px-2 py-1.5 text-sm rounded-md
                        bg-red-100 text-red-700 hover:bg-red-200 transition-colors
                        overflow-hidden text-ellipsis whitespace-nowrap
                        border border-red-200
                      `}
                      style={{
                        top: `${padding + quote.row * rowHeight}px`,
                        left: `calc(${startDayIndex} * 100% / 7 + 4px)`,
                        width: `calc(${daysInWeek} * 100% / 7 - 8px)`,
                        height: `${rowHeight - 4}px`,
                      }}
                      title={`${quote.title} (${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')})`}
                    >
                      {quote.title}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 