import { addDoc, collection, Firestore, serverTimestamp, doc, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
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

  console.log('[NOTIFICATION CREATION] Attempting to create notification:', {
    quoteRequestId,
    quoteRequestTitle,
    sender,
    senderCountry,
    targetCountry,
    content,
    notificationType
  });

  try {
    const notificationsRef = collection(db as Firestore, 'notifications');
    const docRef = await addDoc(notificationsRef, {
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
    
    console.log('[NOTIFICATION CREATION] Successfully created notification with ID:', docRef.id);
  } catch (error) {
    console.error('[NOTIFICATION CREATION] Error creating notification:', error);
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

export async function clearNotifications(targetCountry: string) {
  if (!db) throw new Error('Firebase not initialized');
  if (!targetCountry) throw new Error('Target country is required');

  try {
    console.log('Clearing notifications for country:', targetCountry);
    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('targetCountry', '==', targetCountry)
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} notifications to clear`);
    
    const deletePromises = snapshot.docs.map(doc => {
      console.log('Deleting notification:', doc.id);
      return deleteDoc(doc.ref);
    });

    await Promise.all(deletePromises);
    console.log('Successfully cleared all notifications');
  } catch (error) {
    console.error('Error clearing notifications:', error);
    throw error; // Propagate error to handle it in the UI
  }
} 