"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Firestore, Timestamp } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';
import Link from 'next/link';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface Notification {
  id: string;
  type: 'message' | 'change';
  quoteRequestId: string;
  quoteRequestTitle: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
  message?: string;
  changeType?: string;
  changeDetails?: string;
  isRead: boolean;
}

export default function NotificationsPage() {
  const { user, userProfile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !db || !userProfile?.businessUnit) return;

    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('targetCountry', '==', userProfile.businessUnit),
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
      <h1 className="text-2xl font-bold text-[#e40115] mb-6">Notifications</h1>
      
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-gray-500 text-center py-8 bg-white rounded-lg border">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <Link 
              key={notification.id}
              href={`/quote-requests/${notification.quoteRequestId}`}
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
                    {notification.type === 'message' ? (
                      <>
                        <span className="font-medium text-blue-600">{notification.senderCountry}</span>
                        {' sent a message: '}
                        <span className="italic">{notification.message}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-purple-600">{notification.senderCountry}</span>
                        {' made changes: '}
                        <span className="italic">{notification.changeDetails}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm text-gray-500 whitespace-nowrap">
                  {notification.createdAt && dayjs(notification.createdAt.toDate()).fromNow()}
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
} 