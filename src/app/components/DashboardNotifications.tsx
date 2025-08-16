import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Firestore } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '../AuthProvider';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Notification {
  id: string;
  type: 'message' | 'status_change' | 'property_change';
  quoteRequestId: string;
  quoteRequestTitle: string;
  content: string;
  sender: string;
  senderCountry: string;
  targetCountry: string;
  createdAt: any;
  read: boolean;
}

export default function DashboardNotifications() {
  const { userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!db || !userProfile?.businessUnit) return;

    const notificationsRef = collection(db as Firestore, 'notifications');
    const normalized = (userProfile.businessUnit || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      notificationsRef,
      where('targetCountryKey', '==', normalized),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification)).sort((a, b) => {
        const da = (a.createdAt && typeof (a as any).createdAt.toDate === 'function') ? (a as any).createdAt.toDate().getTime() : 0;
        const db = (b.createdAt && typeof (b as any).createdAt.toDate === 'function') ? (b as any).createdAt.toDate().getTime() : 0;
        return db - da;
      });
      setNotifications(newNotifications);
    });

    return () => unsubscribe();
  }, [userProfile, db]);

  const formatDate = (date: any) => {
    if (!date) return '';
    try {
      if (typeof date.toDate === 'function') {
        return dayjs(date.toDate()).fromNow();
      }
      return dayjs(date).fromNow();
    } catch (err) {
      console.error('Error formatting date:', err);
      return '';
    }
  };

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-green-50 border-green-500';
      case 'status_change':
        return 'bg-yellow-50 border-yellow-500';
      case 'property_change':
        return 'bg-purple-50 border-purple-500';
      default:
        return 'bg-gray-50 border-gray-500';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return '💬';
      case 'status_change':
        return '🔄';
      case 'property_change':
        return '✏️';
      default:
        return '📝';
    }
  };

  return (
    <div className="space-y-2">
      {notifications.length === 0 ? (
        <div className="text-center text-gray-500">
          No new notifications
        </div>
      ) : (
        notifications.map(notification => (
          <div
            key={notification.id}
            className={`flex items-start p-2 rounded ${
              notification.type === 'message' ? 'bg-green-50' :
              notification.type === 'status_change' ? 'bg-yellow-50' :
              'bg-purple-50'
            } hover:bg-opacity-80 transition-colors duration-200`}
          >
            <div className="flex-shrink-0 mr-2">
              <span className="text-lg" role="img" aria-label="notification type">
                {notification.type === 'message' ? '💬' :
                 notification.type === 'status_change' ? '🔄' : '✏️'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between items-start">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {notification.quoteRequestTitle}
                </p>
                <span className="ml-2 text-xs text-gray-500 whitespace-nowrap">
                  {formatDate(notification.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-600 break-words">
                {notification.content}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                From: {notification.senderCountry}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
