"use client";

import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, DocumentData, addDoc, getDoc, doc, Firestore } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { useAuth } from '../AuthProvider';
import MessagingPanel from '../components/MessagingPanel';

interface Message {
  id: string;
  text: string;
  createdAt: Date;
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
    if (!user || !db || !quoteRequestId) {
      setLoading(false);
      return;
    }

    const firestore = db;

    // Fetch quote request details
    const fetchQuoteRequest = async () => {
      try {
        const quoteDoc = await getDoc(doc(firestore, 'quoteRequests', quoteRequestId));
        if (quoteDoc.exists()) {
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
      const q = query(
        collection(firestore, 'messages'),
        where('quoteRequestId', '==', quoteRequestId),
        orderBy('createdAt', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(newMessages);
        setLoading(false);
        setError(null);
        setIndexError(null);
      }, (err) => {
        console.error('Error fetching messages:', err);
        if (err.message.includes('requires an index')) {
          setIndexError(err.message);
        } else {
          setError(err.message);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error('Error setting up messages listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user, quoteRequestId]);

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
              <h3 className="text-sm font-medium text-yellow-800">Setting up message indexing</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>We're creating an index to optimize message loading. This may take a few minutes. Please refresh the page in a moment.</p>
                <p className="mt-2">
                  <a
                    href={indexError.split('create it here: ')[1]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-yellow-800 underline hover:text-yellow-900"
                  >
                    Click here to check index creation status
                  </a>
                </p>
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
        onSendMessage={async (text) => {
          if (!user?.email || !userProfile?.businessUnit || !db) {
            throw new Error('User not authenticated or database not initialized');
          }
          try {
            const messagesRef = collection(db, 'messages');
            await addDoc(messagesRef, {
              text,
              sender: user.email,
              senderCountry: userProfile.businessUnit,
              createdAt: new Date(),
              quoteRequestId,
              participants: [user.uid]
            });
          } catch (err: any) {
            console.error('Error sending message:', err);
            throw new Error('Failed to send message');
          }
        }}
        quoteTitle={quoteRequest ? `${quoteRequest.title} (${quoteRequest.creatorCountry} → ${quoteRequest.targetCountry})` : ''}
        onBack={onClose}
        quoteRequestFiles={quoteRequest?.attachments || []}
      />
    </div>
  );
} 