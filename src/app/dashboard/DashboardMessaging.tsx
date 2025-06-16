"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import MessagingPanel from '../components/MessagingPanel';

interface DashboardMessagingProps {
  selectedQuoteId: string | null;
  currentUser: string;
  currentCountry: string;
  quoteTitle?: string;
  quoteFiles?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

export default function DashboardMessaging({
  selectedQuoteId,
  currentUser,
  currentCountry,
  quoteTitle,
  quoteFiles = []
}: DashboardMessagingProps) {
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!selectedQuoteId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const messagesRef = collection(db, "messages");
      const q = query(
        messagesRef,
        where("quoteRequestId", "==", selectedQuoteId),
        orderBy("createdAt", "asc")
      );
      const querySnapshot = await getDocs(q);
      const fetchedMessages = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      setMessages(fetchedMessages);
    };

    fetchMessages();
  }, [selectedQuoteId]);

  const handleSendMessage = async (text: string) => {
    if (!selectedQuoteId) return;

    const newMessage = {
      text,
      quoteRequestId: selectedQuoteId,
      sender: currentUser,
      senderCountry: currentCountry,
      createdAt: new Date(),
    };

    const docRef = await addDoc(collection(db, "messages"), newMessage);
    setMessages(prev => [...prev, { id: docRef.id, ...newMessage }]);
  };

  if (!selectedQuoteId) {
    return (
      <div className="w-[400px] border-l bg-white flex items-center justify-center h-full text-gray-500">
        Select a quote request to view messages
      </div>
    );
  }

  return (
    <div className="w-[400px] border-l bg-white flex flex-col min-h-0">
      <MessagingPanel
        messages={messages}
        currentUser={currentUser}
        currentCountry={currentCountry}
        onSendMessage={handleSendMessage}
        quoteTitle={quoteTitle}
        quoteRequestFiles={quoteFiles}
      />
    </div>
  );
} 