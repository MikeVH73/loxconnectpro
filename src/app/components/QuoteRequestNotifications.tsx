"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Firestore, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { clearQuoteRequestRecentActivities } from '../utils/notifications';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

interface Notification {
  id: string;
  quoteRequestId: string;
  quoteRequestTitle: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
  content: string;
  notificationType: 'message' | 'status_change' | 'property_change';
  isRead: boolean;
}

interface RecentActivity {
  id: string;
  quoteRequestId: string;
  quoteRequestTitle: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
  content: string;
  activityType: 'message' | 'status_change' | 'property_change';
}

interface QuoteRequestNotificationsProps {
  quoteRequestId: string;
  userCountry: string;
}

const MAX_ACTIVITIES = 4;

export default function QuoteRequestNotifications({ quoteRequestId, userCountry }: QuoteRequestNotificationsProps) {
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper function to format date
  const formatDate = (date: any) => {
    if (!date) return null;
    try {
      // If it's a Firestore Timestamp
      if (typeof date.toDate === 'function') {
        return dayjs(date.toDate()).fromNow();
      }
      // If it's a Date object or string
      return dayjs(date).fromNow();
    } catch (err) {
      console.error('Error formatting date:', err);
      return null;
    }
  };

  useEffect(() => {
    if (!db || !quoteRequestId || !userCountry) return;

    // Fetch recent activities
    const recentActivityRef = collection(db as Firestore, 'recentActivity');
    const recentActivityQuery = query(
      recentActivityRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountry', '==', userCountry),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeRecentActivities = onSnapshot(recentActivityQuery, (snapshot) => {
      const newRecentActivities = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RecentActivity[];

      // Remove duplicate activities by content and timestamp
      const uniqueActivities = newRecentActivities.reduce((acc, curr) => {
        const key = `${curr.content}-${curr.createdAt?.toDate().getTime()}`;
        if (!acc[key]) {
          acc[key] = curr;
        }
        return acc;
      }, {} as Record<string, RecentActivity>);

      setRecentActivities(Object.values(uniqueActivities));
      setLoading(false);
    }, (error) => {
      console.error('Error fetching recent activities:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeRecentActivities();
    };
  }, [quoteRequestId, userCountry]);

  const handleClearNotifications = async () => {
    try {
      await clearQuoteRequestRecentActivities(quoteRequestId, userCountry);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Sort recent activities for display
  const allActivities = recentActivities
    .sort((a: RecentActivity, b: RecentActivity) => {
      const dateA = a.createdAt?.toDate() || new Date(0);
      const dateB = b.createdAt?.toDate() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, MAX_ACTIVITIES);

  if (loading) {
    return (
      <div className="mt-6 p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
        {recentActivities.length > 0 && (
          <button
            onClick={handleClearNotifications}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            Clear All
          </button>
        )}
      </div>
      <div className="overflow-y-hidden">
        {allActivities.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No recent activity
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {allActivities.map((activity) => (
              <li key={activity.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">
                      <span className={`font-semibold ${
                        activity.activityType === 'message' ? 'text-green-600' :
                        activity.activityType === 'status_change' ? 'text-yellow-600' :
                        activity.activityType === 'deadline_warning' ? 'text-orange-600' :
                        'text-purple-600'
                      }`}>
                        {activity.activityType === 'deadline_warning' ? (
                          <span className="flex items-center gap-1">
                            <span>⚠️</span>
                            <span>{activity.content}</span>
                          </span>
                        ) : (
                          activity.content
                        )}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      From {activity.senderCountry} • {formatDate(activity.createdAt)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
} 