"use client";

import { useAuth } from '../AuthProvider';
import MessagingPanel from '../components/MessagingPanel';
import { useMessages } from '../hooks/useMessages';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/firebaseClient';

interface DashboardMessagingProps {
  selectedQuoteId: string | null;
  quoteTitle?: string;
  quoteFiles?: any[];
}

export default function DashboardMessaging({
  selectedQuoteId,
  quoteTitle,
  quoteFiles = []
}: DashboardMessagingProps) {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { messages, loading: messagesLoading, error, sendMessage } = useMessages(selectedQuoteId);

  // Get current user's email and country from auth context
  const currentUser = user?.email || '';
  const currentCountry = userProfile?.businessUnit || '';

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !currentCountry) {
      throw new Error('Cannot send message: User not authenticated');
    }
    await sendMessage(text, currentUser, currentCountry);
  };

  const handleFilesChange = async (files: any[]) => {
    if (!selectedQuoteId) return;
    
    try {
      const docRef = doc(db, 'quoteRequests', selectedQuoteId);
      await updateDoc(docRef, {
        attachments: files,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error updating files:', err);
      throw err;
    }
  };

  if (authLoading || messagesLoading) {
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
      quoteRequestFiles={quoteFiles}
      onFilesChange={handleFilesChange}
    />
  );
} 