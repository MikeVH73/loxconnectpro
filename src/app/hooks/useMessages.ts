'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseClient';

interface Message {
  id: string;
  text: string;
  createdAt: Timestamp;
  sender: string;
  senderCountry: string;
  quoteRequestId: string;
  files?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
}

// Ensure db is available
if (!db) {
  throw new Error('Firestore is not initialized');
}

export function useMessages(quoteRequestId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load and listen to messages
  useEffect(() => {
    if (!quoteRequestId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    try {
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
              createdAt: data.createdAt,
              sender: data.sender || '',
              senderCountry: data.senderCountry || '',
              quoteRequestId: data.quoteRequestId || '',
              files: data.files || []
            } as Message;
          });
          setMessages(newMessages);
          setError(null);
          
          // Mark messages as read when loaded
          if (newMessages.length > 0) {
            const quoteRef = doc(db, "quoteRequests", quoteRequestId);
            updateDoc(quoteRef, {
              hasUnreadMessages: false,
              lastMessageAt: newMessages[newMessages.length - 1].createdAt
            }).catch(err => {
              console.error('Error updating quote request read status:', err);
            });
          }
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
    } catch (err) {
      console.error('Error setting up message listener:', err);
      setError('Failed to initialize message listener');
      setLoading(false);
    }
  }, [quoteRequestId]);

  const sendMessage = async (text: string, sender: string, senderCountry: string, files: any[] = []) => {
    if (!quoteRequestId || !sender || !senderCountry) {
      throw new Error('Missing required data for sending message');
    }

    if (!text.trim() && files.length === 0) {
      throw new Error('Message cannot be empty');
    }

    try {
      const messagesRef = collection(db, "messages");
      const quoteRef = doc(db, "quoteRequests", quoteRequestId);
      
      // Create the message
      const newMessage = {
        text: text.trim(),
        quoteRequestId,
        sender,
        senderCountry,
        createdAt: serverTimestamp(),
        files: files.length > 0 ? files : []
      };

      // Add the message
      const messageDoc = await addDoc(messagesRef, newMessage);

      // Update quote request
      await updateDoc(quoteRef, {
        lastMessageAt: serverTimestamp(),
        hasUnreadMessages: true
      });

      return messageDoc.id;
    } catch (err) {
      console.error('Error sending message:', err);
      throw new Error('Failed to send message. Please try again.');
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage
  };
} 