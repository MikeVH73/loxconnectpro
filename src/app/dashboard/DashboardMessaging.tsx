"use client";

import { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, orderBy } from 'firebase/firestore';
import { db, storage } from '../../firebaseClient';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MessagingPanel from '../components/MessagingPanel';

interface Message {
  id: string;
  text: string;
  createdAt: Date;
  sender: string;
  senderCountry: string;
  attachments?: Array<{
    name: string;
    url: string;
    type: string;
  }>;
}

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
  const [messages, setMessages] = useState<Message[]>([]);

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

  const handleSendMessage = async (text: string, attachments?: File[]) => {
    if (!selectedQuoteId) return;

    try {
      const uploadedAttachments = [];

      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          try {
            console.log('Uploading file:', file.name);
            const storageRef = ref(storage, `messages/${selectedQuoteId}/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            console.log('File uploaded, getting download URL');
            const downloadURL = await getDownloadURL(snapshot.ref);
            console.log('Got download URL:', downloadURL);
            
            uploadedAttachments.push({
              name: file.name,
              url: downloadURL,
              type: file.type
            });
          } catch (error) {
            console.error('Error uploading file:', error);
          }
        }
      }

      const newMessage = {
        text,
        quoteRequestId: selectedQuoteId,
        sender: currentUser,
        senderCountry: currentCountry,
        createdAt: new Date(),
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined
      };

      console.log('Sending message with attachments:', newMessage);
      const docRef = await addDoc(collection(db, "messages"), newMessage);
      setMessages(prev => [...prev, { id: docRef.id, ...newMessage }]);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  if (!selectedQuoteId) {
    return (
      <div className="w-[400px] border-l bg-white flex items-center justify-center h-full text-gray-500">
        Select a quote request to view messages
      </div>
    );
  }

  return (
    <div className="w-[400px] border-l bg-white h-full flex flex-col">
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