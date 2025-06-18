"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '../AuthProvider';
import MessagingPanel from '../components/MessagingPanel';

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
  quoteRequestId: string;
}

interface DashboardMessagingProps {
  selectedQuoteId: string | null;
  quoteTitle?: string;
}

export default function DashboardMessaging({
  selectedQuoteId,
  quoteTitle
}: DashboardMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { user, userProfile, loading } = useAuth();

  // Get current user's email and country from auth context
  const currentUser = user?.email || '';
  const currentCountry = userProfile?.businessUnit || '';

  useEffect(() => {
    if (loading) {
      console.log('Auth loading, waiting...');
      return;
    }

    if (!user || !userProfile) {
      console.log('No authenticated user or profile');
      setMessages([]);
      return;
    }

    if (!selectedQuoteId) {
      console.log('No quote selected');
      setMessages([]);
      return;
    }

    console.log('Setting up message listener with:', {
      quoteId: selectedQuoteId,
      user: currentUser,
      country: currentCountry
    });

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("quoteRequestId", "==", selectedQuoteId),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        const newMessages = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            sender: data.sender || '',
            senderCountry: data.senderCountry || '',
            quoteRequestId: data.quoteRequestId || ''
          } as Message;
        });
        console.log('Messages updated:', newMessages.length);
        setMessages(newMessages);
        setError(null);
      } catch (err) {
        console.error('Error processing messages:', err);
        setError('Failed to process messages');
      }
    }, (err) => {
      console.error('Error in message listener:', err);
      setError('Failed to load messages');
    });

    return () => {
      console.log('Cleaning up message listener');
      unsubscribe();
    };
  }, [selectedQuoteId, user, userProfile, loading, currentUser, currentCountry]);

  const handleSendMessage = async (text: string) => {
    if (!selectedQuoteId || !currentUser || !currentCountry) {
      const error = 'Cannot send message: Missing required data';
      console.error(error, { selectedQuoteId, currentUser, currentCountry });
      setError(error);
      throw new Error(error);
    }

    try {
      const messagesRef = collection(db, "messages");
      
      const newMessage = {
        text: text.trim(),
        quoteRequestId: selectedQuoteId,
        sender: currentUser,
        senderCountry: currentCountry,
        createdAt: serverTimestamp()
      };

      console.log('Sending message:', newMessage);
      const docRef = await addDoc(messagesRef, newMessage);
      console.log('Message sent successfully:', docRef.id);
      setError(null);
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
      throw err;
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user || !userProfile) {
    return <div>Please log in to access messaging.</div>;
  }

  return (
    <MessagingPanel
      messages={messages}
      currentUser={currentUser}
      currentCountry={currentCountry}
      onSendMessage={handleSendMessage}
      quoteTitle={quoteTitle}
    />
  );
} 