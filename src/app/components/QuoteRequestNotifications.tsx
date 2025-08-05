"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Firestore, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { clearQuoteRequestNotifications } from '../utils/notifications';
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

interface Modification {
  id: string;
  quoteRequestId: string;
  dateTime: Timestamp;
  user: string;
  changes: Array<{
    field: string;
    from: any;
    to: any;
  }>;
}

interface QuoteRequestNotificationsProps {
  quoteRequestId: string;
  userCountry: string;
}

const MAX_ACTIVITIES = 4;

export default function QuoteRequestNotifications({ quoteRequestId, userCountry }: QuoteRequestNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [modifications, setModifications] = useState<Modification[]>([]);
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

    // Fetch notifications
    const notificationsRef = collection(db as Firestore, 'notifications');
    const notificationsQuery = query(
      notificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountry', '==', userCountry),
      orderBy('createdAt', 'desc')
    );

    // Fetch modifications
    const modificationsRef = collection(db as Firestore, 'modifications');
    const modificationsQuery = query(
      modificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      orderBy('dateTime', 'desc')
    );

    const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      // Remove duplicate notifications by content and timestamp
      const uniqueNotifications = newNotifications.reduce((acc, curr) => {
        const key = `${curr.content}-${curr.createdAt?.toDate().getTime()}`;
        if (!acc[key]) {
          acc[key] = curr;
        }
        return acc;
      }, {} as Record<string, Notification>);

      setNotifications(Object.values(uniqueNotifications));
    }, (error) => {
      console.error('Error fetching notifications:', error);
    });

    const unsubscribeModifications = onSnapshot(modificationsQuery, (snapshot) => {
      const newModifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Modification[];

      setModifications(newModifications);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching modifications:', error);
      setLoading(false);
    });

    return () => {
      unsubscribeNotifications();
      unsubscribeModifications();
    };
  }, [quoteRequestId, userCountry]);

  const handleClearNotifications = async () => {
    try {
      await clearQuoteRequestNotifications(quoteRequestId, userCountry);
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  };

  // Combine notifications and modifications for display
  const allActivities = [
    ...notifications.map(notif => ({
      id: notif.id,
      type: 'notification' as const,
      dateTime: notif.createdAt,
      user: notif.sender,
      content: notif.content,
      notificationType: notif.notificationType,
      senderCountry: notif.senderCountry
    })),
    ...modifications.map(mod => ({
      id: mod.id,
      type: 'modification' as const,
      dateTime: mod.dateTime,
      user: mod.user,
      changes: mod.changes
    }))
  ].sort((a, b) => {
    const dateA = a.dateTime?.toDate() || new Date(0);
    const dateB = b.dateTime?.toDate() || new Date(0);
    return dateB.getTime() - dateA.getTime();
  }).slice(0, MAX_ACTIVITIES);

  // Helper function to format modification changes
  const formatModificationChanges = (changes: any[]) => {
    return changes.map(change => {
      const { field, from, to } = change;
      
      // Format different field types
      if (field === 'products') {
        const fromStr = Array.isArray(from) ? from.map((p: any) => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ') : String(from);
        const toStr = Array.isArray(to) ? to.map((p: any) => `${p.catClass || ''} ${p.description || ''} x${p.quantity || 1}`).join('; ') : String(to);
        return `${field}: ${fromStr} → ${toStr}`;
      } else if (field === 'attachments') {
        const fromCount = Array.isArray(from) ? from.length : 0;
        const toCount = Array.isArray(to) ? to.length : 0;
        return `${field}: ${fromCount} → ${toCount} attachment(s)`;
      } else if (field === 'notes') {
        const fromCount = Array.isArray(from) ? from.length : 0;
        const toCount = Array.isArray(to) ? to.length : 0;
        return `${field}: ${fromCount} → ${toCount} note(s)`;
      } else if (field === 'waitingForAnswer' || field === 'urgent' || field === 'problems' || field === 'planned') {
        const labelNames: Record<string, string> = {
          waitingForAnswer: 'Waiting for Answer',
          urgent: 'Urgent',
          problems: 'Problems',
          planned: 'Planned'
        };
        if (to === true) {
          return `Added ${labelNames[field] || field} label`;
        } else {
          return `Removed ${labelNames[field] || field} label`;
        }
      } else {
        return `${field}: ${String(from || '(none)')} → ${String(to || '(none)')}`;
      }
    }).join(', ');
  };

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
        {notifications.length > 0 && (
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
                      {activity.type === 'notification' ? (
                        <span className={`font-semibold ${
                          activity.notificationType === 'message' ? 'text-green-600' :
                          activity.notificationType === 'status_change' ? 'text-yellow-600' :
                          'text-purple-600'
                        }`}>
                          {activity.content}
                        </span>
                      ) : (
                        <span className="font-semibold text-blue-600">
                          {activity.user} modified the quote request
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {activity.type === 'notification' ? (
                        `From ${(activity as any).senderCountry} • ${formatDate(activity.dateTime)}`
                      ) : (
                        `${formatDate(activity.dateTime)} • ${formatModificationChanges(activity.changes)}`
                      )}
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