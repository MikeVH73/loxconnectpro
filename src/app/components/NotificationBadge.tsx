"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, onSnapshot, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';

export default function NotificationBadge() {
  const { userProfile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!db || !userProfile?.businessUnit) return;

    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('targetCountry', '==', userProfile.businessUnit),
      where('isRead', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.docs.length);
    });

    return () => unsubscribe();
  }, [userProfile]);

  if (unreadCount === 0) return null;

  return (
    <div className="absolute top-0 right-0 -mt-1 -mr-1">
      <div className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
        {unreadCount > 99 ? '99+' : unreadCount}
      </div>
    </div>
  );
} 