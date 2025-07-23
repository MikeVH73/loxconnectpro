import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, where, orderBy, limit, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { useAuth } from '../AuthProvider';
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

// Initialize dayjs plugins
dayjs.extend(relativeTime);

interface MessageHistoryIndicatorProps {
  quoteRequestId: string;
  creatorCountry: string;
  involvedCountry: string;
}

interface Message {
  id: string;
  text: string;
  senderCountry: string;
  createdAt: Date;
  readBy?: string[];
}

export default function MessageHistoryIndicator({ quoteRequestId, creatorCountry, involvedCountry }: MessageHistoryIndicatorProps) {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [lastMessage, setLastMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    const fetchMessageInfo = async () => {
      if (!db) return;
      
      try {
        // Get unread messages count
        const messagesRef = collection(db as Firestore, 'messages');
        const userCountry = userProfile?.businessUnit;
        
        // Simplified query - only filter by quoteRequestId and order by createdAt
        const q = query(
          messagesRef,
          where('quoteRequestId', '==', quoteRequestId),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        
        const snapshot = await getDocs(q);
        const messages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            senderCountry: data.senderCountry || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            readBy: data.readBy || []
          };
        }) as Message[];

        // Get the most recent message
        if (messages.length > 0) {
          setLastMessage(messages[0]);
        }

        // Count unread messages - filter in memory
        const unreadMessages = messages.filter(msg => 
          msg.senderCountry !== userCountry && 
          (!msg.readBy || !msg.readBy.includes(userProfile?.email || ''))
        );
        setUnreadCount(unreadMessages.length);
      } catch (error) {
        console.error("Error fetching message info:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile?.businessUnit) {
      fetchMessageInfo();
    }
  }, [quoteRequestId, userProfile]);

  if (loading) {
    return <div className="flex items-center space-x-1">
      <div className="w-2 h-2 bg-gray-300 rounded-full animate-pulse"></div>
      <span className="text-xs text-gray-400">Loading...</span>
    </div>;
  }

  if (unreadCount === 0 && !lastMessage) {
    return null;
  }

  const isFromCreator = lastMessage?.senderCountry === creatorCountry;
  const messageText = lastMessage?.text || '';
  const messagePreview = messageText.length > 30 
    ? `${messageText.substring(0, 30)}...`
    : messageText;

  return (
    <div className="flex flex-col">
      {unreadCount > 0 && (
        <div className="flex items-center space-x-2 mb-1">
          <span className="text-xs font-medium text-blue-600">
            {unreadCount} new message{unreadCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {lastMessage && (
        <div className={`text-xs ${isFromCreator ? 'text-green-600' : 'text-purple-600'}`}>
          <span className="font-medium">
            {isFromCreator ? 'Creator' : 'Involved'} country:
          </span>
          <span className="ml-1 text-gray-600">{messagePreview}</span>
          {lastMessage.createdAt && (
            <span className="text-gray-400 ml-1">
              ({dayjs(lastMessage.createdAt).fromNow()})
            </span>
          )}
        </div>
      )}
    </div>
  );
} 