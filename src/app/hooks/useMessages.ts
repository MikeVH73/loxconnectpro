'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/firebaseClient';

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
  quoteRequestId: string;
}

// Ensure db is available
if (!db) {
  throw new Error('Firestore is not initialized');
}

export function useMessages(quoteRequestId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!quoteRequestId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    const messagesRef = collection(db, "messages");
    const q = query(
      messagesRef,
      where("quoteRequestId", "==", quoteRequestId),
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
        setMessages(newMessages);
        setError(null);
      } catch (err) {
        console.error('Error processing messages:', err);
        setError('Failed to process messages');
      } finally {
        setLoading(false);
      }
    }, (err) => {
      console.error('Error in message listener:', err);
      setError('Failed to load messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [quoteRequestId]);

  const sendMessage = async (text: string, sender: string, senderCountry: string) => {
    if (!quoteRequestId || !sender || !senderCountry) {
      throw new Error('Missing required data for sending message');
    }

    try {
      const messagesRef = collection(db, "messages");
      const newMessage = {
        text: text.trim(),
        quoteRequestId,
        sender,
        senderCountry,
        createdAt: serverTimestamp()
      };

      await addDoc(messagesRef, newMessage);
    } catch (err) {
      console.error('Error sending message:', err);
      throw err;
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage
  };
} 