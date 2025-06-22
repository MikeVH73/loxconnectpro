'use client';

import { useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import MessagingPanel from './MessagingPanel';

dayjs.extend(relativeTime);

interface ArchivedMessagingProps {
  quoteRequestId: string;
  userCountries: string[];
  quoteRequest: any;
}

export default function ArchivedMessaging({ quoteRequestId, userCountries, quoteRequest }: ArchivedMessagingProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const messagesRef = collection(db, "messages");
        const q = query(
          messagesRef,
          where("quoteRequestId", "==", quoteRequestId),
          orderBy("createdAt", "asc")
        );
        const snapshot = await getDocs(q);
        const fetchedMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }));
        setMessages(fetchedMessages);
      } catch (error) {
        console.error("Error fetching messages:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [quoteRequestId]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading message history...</p>
        </div>
      </div>
    );
  }

  return (
    <MessagingPanel
      messages={messages}
      currentUser=""
      currentCountry=""
      onSendMessage={async () => {}}
      quoteTitle={quoteRequest?.title}
      creatorCountry={quoteRequest?.creatorCountry}
      involvedCountry={quoteRequest?.involvedCountry}
      quoteRequestFiles={quoteRequest?.attachments || []}
      readOnly={true}
    />
  );
} 