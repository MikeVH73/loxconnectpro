"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Firestore, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';
import Link from 'next/link';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { clearDashboardNotifications } from '../utils/notifications';
import toast from 'react-hot-toast';

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

export default function NotificationsPage() {
  const { user, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    if (!userProfile?.businessUnit) {
      toast.error('No business unit found');
      return;
    }
    
    try {
      setClearing(true);
      await clearDashboardNotifications(userProfile.businessUnit);
      toast.success('All notifications cleared');
    } catch (error) {
      console.error('Error clearing notifications:', error);
      toast.error('Failed to clear notifications');
    } finally {
      setClearing(false);
    }
  };

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
    if (!user || !db || !userProfile?.businessUnit) return;

    const notificationsRef = collection(db as Firestore, 'notifications');
    const normalized = (userProfile.businessUnit || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      notificationsRef,
      where('targetCountryKey', '==', normalized),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      setNotifications(newNotifications);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, userProfile]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#e40115]"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#e40115]">Notifications</h1>
        {notifications.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearing}
            className={`px-4 py-2 text-sm text-gray-600 hover:text-gray-900 bg-white hover:bg-gray-100 rounded-lg border shadow-sm transition-all ${
              clearing ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {clearing ? (
              <span className="flex items-center">
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-900 mr-2"></span>
                Clearing...
              </span>
            ) : (
              'Clear All'
            )}
          </button>
        )}
      </div>
      
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-gray-500 text-center py-8 bg-white rounded-lg border">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <Link 
              key={notification.id}
              href={userProfile?.role === 'Employee' ? `/quote-requests/${notification.quoteRequestId}` : `/quote-requests/${notification.quoteRequestId}/edit`}
              className={`block p-4 rounded-lg border ${
                notification.isRead ? 'bg-white' : 'bg-blue-50'
              } hover:shadow-md transition-shadow`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">
                    {notification.quoteRequestTitle}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    <span className="font-medium text-blue-600">{notification.senderCountry}</span>
                    {' '}
                    {notification.notificationType === 'message' && 'sent a message: '}
                    {notification.notificationType === 'status_change' && 'updated the status: '}
                    {notification.notificationType === 'property_change' && 'made changes:'}
                    {notification.notificationType !== 'property_change' ? (
                      <span className="italic">{notification.content}</span>
                    ) : (
                      <ul className="list-disc ml-5 mt-1 text-[13px] space-y-1">
                        {String(notification.content)
                          .split(', ')
                          .filter(Boolean)
                          .map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                      </ul>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {notification.createdAt && formatDate(notification.createdAt)}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
} 