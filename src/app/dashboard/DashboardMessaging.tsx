"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '../AuthProvider';
import MessagingPanel from '../components/MessagingPanel';

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
}

export default function DashboardMessaging() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !db) {
      setLoading(false);
      return;
    }

    try {
      const q = query(
        collection(db, 'messages'),
        where('participants', 'array-contains', user.uid),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(newMessages);
        setLoading(false);
      }, (err) => {
        console.error('Error fetching messages:', err);
        setError(err.message);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error('Error setting up messages listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4">
        Error loading messages: {error}
      </div>
    );
  }

  return (
    <div className="h-full">
      <MessagingPanel
        messages={messages}
        currentUser={user?.email || ''}
        currentCountry="Global"
        onSendMessage={async (text) => {
          // Implementation of message sending
          console.log('Sending message:', text);
        }}
      />
    </div>
  );
} 