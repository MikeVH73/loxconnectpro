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
  addDays
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

  const getQuoteRequestsForDay = (date: Date) => {
    return quoteRequests.filter(request => {
      const startDate = parseISO(request.startDate);
      const endDate = request.endDate ? parseISO(request.endDate) : addDays(startDate, 1); // If no end date, show for one day

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
      {error === "No country assigned to your profile" && (
        <p className="text-sm mt-2">Please contact an administrator to assign you to a country.</p>
      )}
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
                  {dayQuotes.map(quote => {
                    const startDate = parseISO(quote.startDate);
                    const endDate = quote.endDate ? parseISO(quote.endDate) : addDays(startDate, 1);
                    const isStart = format(date, 'yyyy-MM-dd') === format(startDate, 'yyyy-MM-dd');
                    const isEnd = format(date, 'yyyy-MM-dd') === format(endDate, 'yyyy-MM-dd');
                    
                    return (
                      <Link
                        key={quote.id}
                        href={`/quote-requests/${quote.id}`}
                        className={`
                          block p-1 text-xs rounded truncate hover:bg-blue-200 transition-colors
                          ${isStart ? 'rounded-l-md' : ''}
                          ${isEnd ? 'rounded-r-md' : ''}
                          ${isStart && isEnd ? 'bg-blue-100 text-blue-700' : 'bg-blue-50 text-blue-600'}
                        `}
                        title={`${quote.title} (${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d')})`}
                      >
                        {isStart ? quote.title : ''}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
} 