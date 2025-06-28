import { addDoc, collection, Firestore, serverTimestamp, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';

interface CreateNotificationParams {
  quoteRequestId: string;
  quoteRequestTitle: string;
  sender: string;
  senderCountry: string;
  targetCountry: string;
  content: string;
  notificationType: 'message' | 'status_change' | 'property_change';
}

export async function createNotification({
  quoteRequestId,
  quoteRequestTitle,
  sender,
  senderCountry,
  targetCountry,
  content,
  notificationType,
}: CreateNotificationParams) {
  if (!db) throw new Error('Firebase not initialized');

  try {
    const notificationsRef = collection(db as Firestore, 'notifications');
    await addDoc(notificationsRef, {
      quoteRequestId,
      quoteRequestTitle,
      sender,
      senderCountry,
      targetCountry,
      content,
      notificationType,
      createdAt: serverTimestamp(),
      isRead: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw the error - we don't want notification failures to break the main flow
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
    // Don't throw the error - we don't want notification failures to break the main flow
  }
} 