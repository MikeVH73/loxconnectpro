'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, Timestamp, Firestore, getDoc } from 'firebase/firestore';
import { db } from '@/firebaseClient';
import { createNotification } from '../utils/notifications';

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

// Initialize firestore with retry mechanism
let firestore: Firestore;
const initializeFirestore = async (retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    if (db) {
      firestore = db as Firestore;
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
  }
  return false;
};

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

    let retryCount = 0;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    const setupListener = async () => {
    try {
        // Wait for Firestore initialization
        const isInitialized = await initializeFirestore();
        if (!isInitialized) {
          throw new Error('Failed to initialize Firestore after retries');
        }

      const messagesRef = collection(firestore, "messages");
      const q = query(
        messagesRef,
        where("quoteRequestId", "==", quoteRequestId),
        orderBy("createdAt", "asc")
      );

      const unsubscribe = onSnapshot(
        q, 
        (snapshot) => {
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
              retryCount = 0; // Reset retry count on successful connection
            
            if (newMessages.length > 0) {
              const quoteRef = doc(firestore, "quoteRequests", quoteRequestId);
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
        },
          async (err) => {
          console.error('Error in message listener:', err);
          setError('Failed to load messages');
          setLoading(false);

            // Attempt to reconnect if we haven't exceeded max retries
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Attempting to reconnect (attempt ${retryCount}/${maxRetries})...`);
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              setupListener();
            }
        }
      );

        return () => {
          unsubscribe();
          retryCount = 0; // Reset retry count when cleaning up
        };
    } catch (err) {
      console.error('Error setting up message listener:', err);
      setError('Failed to initialize message listener');
      setLoading(false);

        // Attempt to reconnect if we haven't exceeded max retries
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Attempting to reconnect (attempt ${retryCount}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return setupListener();
        }
      }
    };

    const cleanup = setupListener();
    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
    };
  }, [quoteRequestId]);

  const sendMessage = async (text: string, sender: string, senderCountry: string, targetCountry: string, files: any[] = []) => {
    if (!quoteRequestId || !sender || !senderCountry || !targetCountry) {
      throw new Error('Missing required data for sending message');
    }

    if (!text.trim() && files.length === 0) {
      throw new Error('Message cannot be empty');
    }

    try {
      // Wait for Firestore initialization
      const isInitialized = await initializeFirestore();
      if (!isInitialized) {
        throw new Error('Firestore not initialized when sending message');
      }

      const messagesRef = collection(firestore, "messages");
      const quoteRef = doc(firestore, "quoteRequests", quoteRequestId);
      
      // Get quote request data for the title
      const quoteSnapshot = await getDoc(quoteRef);
      if (!quoteSnapshot.exists()) {
        throw new Error('Quote request not found');
      }
      
      const quoteData = quoteSnapshot.data();

      // Create the message
      const newMessage = {
        text: text.trim(),
        quoteRequestId,
        sender,
        senderCountry,
        createdAt: serverTimestamp(),
        files: files.length > 0 ? files : [],
        readBy: [sender] // Mark as read by sender
      };

      // Add the message
      const messageDoc = await addDoc(messagesRef, newMessage);

      // Update quote request status
      await updateDoc(quoteRef, {
        lastMessageAt: serverTimestamp(),
        hasUnreadMessages: true // Set to true since this is a new message
      });

      // Create notification with proper target country
      try {
        await createNotification({
          notificationType: 'message',
          quoteRequestId,
          quoteRequestTitle: quoteData.title,
          sender,
          senderCountry,
          targetCountry,
          content: `New message: ${text.length > 50 ? `${text.substring(0, 50)}...` : text}${files.length > 0 ? ` (${files.length} file${files.length > 1 ? 's' : ''} attached)` : ''}`
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
        // Don't throw here - we still want the message to be considered sent
      }

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