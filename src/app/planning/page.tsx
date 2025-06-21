"use client";

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, parseISO, isWithinInterval, isSameMonth, startOfWeek, endOfWeek } from 'date-fns';
import Link from 'next/link';

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

export default function PlanningPage() {
  const { userProfile } = useAuth();
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchQuoteRequests = async () => {
      if (!db || !userProfile?.country) return;

      try {
        const quotesRef = collection(db as Firestore, "quoteRequests");
        const q = query(
          quotesRef,
          where("status", "==", "In Progress"),
          where("creatorCountry", "in", [userProfile.country]),
        );
        
        const snapshot = await getDocs(q);
        let requests = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as QuoteRequest));

        // Also fetch quotes where user's country is the involved country
        const q2 = query(
          quotesRef,
          where("status", "==", "In Progress"),
          where("involvedCountry", "==", userProfile.country)
        );
        
        const snapshot2 = await getDocs(q2);
        requests = [...requests, ...snapshot2.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as QuoteRequest))];

        // Remove duplicates
        requests = requests.filter((request, index, self) =>
          index === self.findIndex((r) => r.id === request.id)
        );

        setQuoteRequests(requests);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching quote requests:", err);
        setError("Failed to fetch quote requests");
        setLoading(false);
      }
    };

    fetchQuoteRequests();
  }, [userProfile?.country]);

  // Get all days for the calendar view (including days from adjacent months)
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  const getQuoteRequestsForDay = (date: Date) => {
    return quoteRequests.filter(request => {
      const startDate = parseISO(request.startDate);
      const endDate = request.endDate ? parseISO(request.endDate) : null;

      if (!endDate) {
        return format(startDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
      }

      return isWithinInterval(date, { start: startDate, end: endDate });
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
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
    </div>
  );
  
  if (error) return (
    <div className="p-4 bg-red-50 text-red-600 rounded-lg">
      {error}
    </div>
  );

  return (
    <div className="p-4 max-w-7xl mx-auto">
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

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="grid grid-cols-7 gap-px bg-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="bg-gray-50 py-2 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
          
          {calendarDays.map((date: Date, index: number) => {
            const dayQuotes = getQuoteRequestsForDay(date);
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
            const isCurrentMonth = isSameMonth(date, currentDate);
            
            return (
              <div
                key={date.toISOString()}
                className={`relative bg-white p-2 min-h-[120px] border-t ${
                  !isCurrentMonth ? 'bg-gray-50' : ''
                } ${isToday ? 'bg-blue-50' : ''}`}
              >
                <div className={`font-medium text-sm mb-1 ${
                  !isCurrentMonth ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  {format(date, 'd')}
                </div>
                <div className="space-y-1">
                  {dayQuotes.map(quote => (
                    <Link
                      key={quote.id}
                      href={`/quote-requests/${quote.id}`}
                      className="block p-1 text-xs bg-blue-100 text-blue-700 rounded truncate hover:bg-blue-200 transition-colors"
                      title={quote.title}
                    >
                      {quote.title}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 