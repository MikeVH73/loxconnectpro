import React, { useState, useEffect } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';

interface MessageHistoryIndicatorProps {
  quoteRequestId: string;
}

export default function MessageHistoryIndicator({ quoteRequestId }: MessageHistoryIndicatorProps) {
  const [messageCount, setMessageCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMessageCount = async () => {
      try {
        const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
        const q = query(messagesRef);
        const snapshot = await getDocs(q);
        setMessageCount(snapshot.size);
      } catch (error) {
        console.error("Error fetching message count:", error);
        setMessageCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchMessageCount();
  }, [quoteRequestId]);

  if (loading) {
    return <span className="text-xs text-gray-400">📊 ...</span>;
  }

  if (messageCount === 0) {
    return <span className="text-xs text-gray-400">📊 No messages</span>;
  }

  return (
    <span className="text-xs text-blue-600 font-medium">
      💬 {messageCount} message{messageCount !== 1 ? 's' : ''} archived
    </span>
  );
} 