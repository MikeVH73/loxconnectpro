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

function normalizeCountryKey(name: string | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface CreateRecentActivityParams {
  quoteRequestId: string;
  quoteRequestTitle: string;
  sender: string;
  senderCountry: string;
  targetCountry: string;
  content: string;
  activityType: 'message' | 'status_change' | 'property_change';
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
    console.log('Creating notification:', { quoteRequestId, content, notificationType });
    
    const notificationsRef = collection(db as Firestore, 'notifications');
    
    await addDoc(notificationsRef, {
      quoteRequestId,
      quoteRequestTitle,
      sender,
      senderCountry,
      targetCountry,
      targetCountryKey: normalizeCountryKey(targetCountry),
      content,
      notificationType,
      createdAt: serverTimestamp(),
      isRead: false,
    });
    
    console.log('Notification created successfully');

    // Also create a recent activity entry (except for deletion notifications and messages)
    if (notificationType !== 'deletion' && notificationType !== 'message') {
      await createRecentActivity({
        quoteRequestId,
        quoteRequestTitle,
        sender,
        senderCountry,
        targetCountry,
        content,
        activityType: notificationType,
      });
    }
  } catch (error) {
    console.error('Error creating notification:', error);
    // Don't throw the error - we don't want notification failures to break the main flow
  }
}

export async function createRecentActivity({
  quoteRequestId,
  quoteRequestTitle,
  sender,
  senderCountry,
  targetCountry,
  content,
  activityType,
}: CreateRecentActivityParams) {
  if (!db) throw new Error('Firebase not initialized');

  try {
    console.log('Creating recent activity:', { quoteRequestId, content, activityType });
    const recentActivityRef = collection(db as Firestore, 'recentActivity');
    
    await addDoc(recentActivityRef, {
      quoteRequestId,
      quoteRequestTitle,
      sender,
      senderCountry,
      targetCountry,
      content,
      activityType,
      createdAt: serverTimestamp(),
    });
    
    console.log('Recent activity created successfully');
  } catch (error) {
    console.error('Error creating recent activity:', error);
    // Don't throw the error - we don't want recent activity failures to break the main flow
  }
}

export async function markNotificationsAsRead(quoteRequestId: string, targetCountry: string) {
  if (!db) throw new Error('Firebase not initialized');

  try {
    const notificationsRef = collection(db as Firestore, 'notifications');
    const key = (targetCountry || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      notificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountryKey', '==', key),
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
    const key = (targetCountry || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      notificationsRef,
      where('targetCountryKey', '==', key)
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
    const key = (targetCountry || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      notificationsRef,
      where('targetCountryKey', '==', key)
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} dashboard notifications to clear`);
    
    const deletePromises = snapshot.docs.map(doc => {
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
    const key = (targetCountry || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      notificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountryKey', '==', key)
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

export async function clearQuoteRequestRecentActivities(quoteRequestId: string, targetCountry: string) {
  if (!db) throw new Error('Firebase not initialized');
  if (!quoteRequestId) throw new Error('Quote request ID is required');
  if (!targetCountry) throw new Error('Target country is required');

  try {
    console.log('Clearing recent activities for quote request:', quoteRequestId);
    const recentActivityRef = collection(db as Firestore, 'recentActivity');
    const q = query(
      recentActivityRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountry', '==', targetCountry)
    );

    const snapshot = await getDocs(q);
    console.log(`Found ${snapshot.size} quote request recent activities to clear`);
    
    const deletePromises = snapshot.docs.map(doc => {
      console.log('Deleting quote request recent activity:', doc.id);
      return deleteDoc(doc.ref);
    });

    await Promise.all(deletePromises);
    console.log('Successfully cleared quote request recent activities');
  } catch (error) {
    console.error('Error clearing quote request recent activities:', error);
    throw error; // Propagate error to handle it in the UI
  }
} 