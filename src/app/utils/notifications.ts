import { addDoc, collection, Firestore, serverTimestamp, doc, updateDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebaseClient';

interface CreateNotificationParams {
  quoteRequestId: string;
  quoteRequestTitle: string;
  sender: string;
  senderCountry: string;
  targetCountry: string;
  content: string;
  notificationType: 'message' | 'status_change' | 'property_change' | 'deletion';
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

export async function clearDashboardNotifications(targetCountry: string) {
  if (!db) throw new Error('Firebase not initialized');
  if (!targetCountry) throw new Error('Target country is required');

  try {
    console.log('Clearing dashboard notifications for country:', targetCountry);
    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('targetCountry', '==', targetCountry),
      where('notificationType', 'in', ['status_change', 'property_change', 'message'])
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} dashboard notifications to clear`);
    
    // Only delete notifications that are older than 24 hours or are marked as read
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const deletePromises = snapshot.docs
      .filter(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate();
        return data.isRead || (createdAt && createdAt < twentyFourHoursAgo);
      })
      .map(doc => {
        console.log('Deleting dashboard notification:', doc.id);
        return deleteDoc(doc.ref);
      });

    await Promise.all(deletePromises);
    console.log('Successfully cleared dashboard notifications');
  } catch (error) {
    console.error('Error clearing dashboard notifications:', error);
    throw error; // Propagate error to handle it in the UI
  }
}

export async function clearQuoteRequestNotifications(quoteRequestId: string, targetCountry: string) {
  if (!db) throw new Error('Firebase not initialized');
  if (!quoteRequestId) throw new Error('Quote request ID is required');
  if (!targetCountry) throw new Error('Target country is required');

  try {
    console.log('Clearing notifications for quote request:', quoteRequestId);
    const notificationsRef = collection(db as Firestore, 'notifications');
    const q = query(
      notificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountry', '==', targetCountry)
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} quote request notifications to clear`);
    
    const deletePromises = snapshot.docs.map(doc => {
      console.log('Deleting quote request notification:', doc.id);
      return deleteDoc(doc.ref);
    });

    await Promise.all(deletePromises);
    console.log('Successfully cleared quote request notifications');
  } catch (error) {
    console.error('Error clearing quote request notifications:', error);
    throw error; // Propagate error to handle it in the UI
  }
} 