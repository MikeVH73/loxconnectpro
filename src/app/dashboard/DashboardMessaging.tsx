"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, DocumentData, addDoc, getDoc, doc, Firestore, serverTimestamp, Timestamp, updateDoc } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '../AuthProvider';
import MessagingPanel from '../components/MessagingPanel';

interface Message {
  id: string;
  text: string;
  createdAt: any; // We'll handle the timestamp conversion in the component
  sender: string;
  senderCountry: string;
  quoteRequestId?: string;
}

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  targetCountry: string;
  attachments?: any[];
}

interface DashboardMessagingProps {
  quoteRequestId?: string;
  onClose?: () => void;
}

export default function DashboardMessaging({ quoteRequestId, onClose }: DashboardMessagingProps) {
  const { user, userProfile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [quoteRequest, setQuoteRequest] = useState<QuoteRequest | null>(null);

  useEffect(() => {
    if (!user || !db || !quoteRequestId) return;

    // Mark messages as read whenever the component mounts or quoteRequestId changes
    const markAsRead = async () => {
      try {
        const quoteRef = doc(db, 'quoteRequests', quoteRequestId);
        await updateDoc(quoteRef, {
          hasUnreadMessages: false
        });
      } catch (err) {
        console.error('Error marking messages as read:', err);
      }
    };

    markAsRead();
  }, [user, db, quoteRequestId]);

  useEffect(() => {
    if (!user || !db || !quoteRequestId) {
      setLoading(false);
      return;
    }

    const firestore = db;

    // Fetch quote request details and mark as read
    const fetchQuoteRequest = async () => {
      try {
        const quoteRef = doc(firestore, 'quoteRequests', quoteRequestId);
        const quoteDoc = await getDoc(quoteRef);
        
        if (quoteDoc.exists()) {
          // Mark as read immediately when opening
          await updateDoc(quoteRef, {
            hasUnreadMessages: false
          });
          
          setQuoteRequest({
            id: quoteDoc.id,
            ...quoteDoc.data()
          } as QuoteRequest);
        }
      } catch (err) {
        console.error('Error fetching quote request:', err);
      }
    };

    fetchQuoteRequest();

    try {
      // Set up messages listener
      const messagesRef = collection(firestore, 'messages');
      const q = query(
        messagesRef,
        where('quoteRequestId', '==', quoteRequestId),
        orderBy('createdAt', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        // Convert messages and reverse to show oldest first
        const newMessages = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
          }))
          .reverse() as Message[];

        setMessages(newMessages);
        setLoading(false);
        setError(null);
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
  }, [user, db, quoteRequestId]);

  const handleSendMessage = async (text: string) => {
    if (!user?.email || !userProfile?.businessUnit || !db) {
      throw new Error('User not authenticated or database not initialized');
    }
    try {
      const messagesRef = collection(db, 'messages');
      await addDoc(messagesRef, {
        text,
        sender: user.email,
        senderCountry: userProfile.businessUnit,
        createdAt: serverTimestamp(),
        quoteRequestId,
        participants: [user.uid]
      });
    } catch (err: any) {
      console.error('Error sending message:', err);
      throw new Error('Failed to send message');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (indexError) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">One-time setup needed</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>We need to create a database index to optimize message loading. This only needs to be done once:</p>
                <ol className="mt-2 list-decimal list-inside space-y-1">
                  <li>Click the link below to open Firebase Console</li>
                  <li>Sign in with your Firebase account if needed</li>
                  <li>Click the "Create Index" button</li>
                  <li>Return here and refresh the page</li>
                </ol>
                <a
                  href={indexError}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-block text-yellow-800 underline hover:text-yellow-900"
                >
                  Create Index in Firebase Console →
                </a>
              </div>
            </div>
          </div>
        </div>
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

  if (!quoteRequestId) {
    return (
      <div className="text-gray-500 p-4">
        Please select a quote request to view messages.
      </div>
    );
  }

  return (
    <div className="h-full">
      <MessagingPanel
        messages={messages}
        currentUser={user?.email || ''}
        currentCountry={userProfile?.businessUnit || ''}
        onSendMessage={handleSendMessage}
        quoteTitle={quoteRequest?.title || ''}
        creatorCountry={quoteRequest?.creatorCountry || ''}
        involvedCountry={quoteRequest?.targetCountry || ''}
        onBack={onClose}
        quoteRequestFiles={quoteRequest?.attachments || []}
      />
    </div>
  );
} 