import { addDoc, collection, Firestore, serverTimestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';

interface CreateNotificationParams {
  type: 'message' | 'change';
  quoteRequestId: string;
  quoteRequestTitle: string;
  sender: string;
  senderCountry: string;
  targetCountry: string;
  message?: string;
  changeType?: string;
  changeDetails?: string;
}

export async function createNotification({
  type,
  quoteRequestId,
  quoteRequestTitle,
  sender,
  senderCountry,
  targetCountry,
  message,
  changeType,
  changeDetails,
}: CreateNotificationParams) {
  if (!db) throw new Error('Firebase not initialized');

  try {
    const notificationsRef = collection(db as Firestore, 'notifications');
    await addDoc(notificationsRef, {
      type,
      quoteRequestId,
      quoteRequestTitle,
      sender,
      senderCountry,
      targetCountry,
      message,
      changeType,
      changeDetails,
      createdAt: serverTimestamp(),
      isRead: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

export async function markNotificationsAsRead(quoteRequestId: string, targetCountry: string) {
  if (!db) throw new Error('Firebase not initialized');

  try {
    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountry', '==', targetCountry),
      where('isRead', '==', false)
    );

    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map(doc => 
      updateDoc(doc.ref, { isRead: true })
    );

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
} 