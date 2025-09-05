import { collection, query, where, getDocs, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';
import { db } from '../../firebaseClient';

// Admin SDK imports for server-side usage
import * as admin from 'firebase-admin';

interface DeadlineNotificationParams {
  quoteRequestId: string;
  quoteRequestTitle: string;
  targetCountry: string;
  deadlineType: 'start_date' | 'end_date';
  daysUntilDeadline: number;
  deadlineDate: string; // ISO date string
}

interface NotificationSettings {
  startDateWarningDays: number;
  endDateWarningDays: number;
  enabled: boolean;
}

/**
 * Get Firebase Admin instance for server-side operations
 */
function getAdminDb() {
  try {
    const adminApp = admin.app();
    return admin.firestore(adminApp);
  } catch {
    throw new Error('Firebase Admin not initialized');
  }
}

/**
 * Create a deadline notification for upcoming Quote Request dates
 * Works with both client-side and server-side Firebase
 */
export async function createDeadlineNotification({
  quoteRequestId,
  quoteRequestTitle,
  targetCountry,
  deadlineType,
  daysUntilDeadline,
  deadlineDate
}: DeadlineNotificationParams, useAdmin = false) {
  const firestoreDb = useAdmin ? getAdminDb() : db;
  
  if (!firestoreDb) throw new Error('Firebase not initialized');

  try {
    console.log('Creating deadline notification:', { 
      quoteRequestId, 
      deadlineType, 
      daysUntilDeadline,
      targetCountry 
    });

    const notificationsRef = collection(firestoreDb as Firestore, 'notifications');
    const targetKey = normalizeCountryKey(targetCountry);

    // Create appropriate content based on deadline type
    const content = deadlineType === 'start_date' 
      ? `⚠️ Start date approaching: "${quoteRequestTitle}" starts in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} (${formatDate(deadlineDate)})`
      : `📅 End date approaching: "${quoteRequestTitle}" ends in ${daysUntilDeadline} day${daysUntilDeadline === 1 ? '' : 's'} (${formatDate(deadlineDate)})`;

    const notificationData = {
      quoteRequestId,
      quoteRequestTitle,
      sender: 'System',
      senderCountry: 'System',
      targetCountry,
      targetCountryKey: targetKey,
      content,
      notificationType: 'deadline_warning',
      deadlineType,
      daysUntilDeadline,
      deadlineDate,
      createdAt: useAdmin ? admin.firestore.FieldValue.serverTimestamp() : serverTimestamp(),
      isRead: false,
    };

    await addDoc(notificationsRef, notificationData);

    console.log('Deadline notification created successfully');
  } catch (error) {
    console.error('Error creating deadline notification:', error);
    // Don't throw the error - we don't want notification failures to break the main flow
  }
}

/**
 * Get notification settings for a specific country
 * Works with both client-side and server-side Firebase
 */
export async function getNotificationSettings(country: string, useAdmin = false): Promise<NotificationSettings> {
  const firestoreDb = useAdmin ? getAdminDb() : db;
  
  if (!firestoreDb) throw new Error('Firebase not initialized');

  try {
    const settingsDoc = await getDocs(query(
      collection(firestoreDb as Firestore, 'notificationSettings'),
      where('__name__', '==', country)
    ));

    if (!settingsDoc.empty) {
      const data = settingsDoc.docs[0].data() as NotificationSettings;
      return {
        startDateWarningDays: data.startDateWarningDays || 7,
        endDateWarningDays: data.endDateWarningDays || 3,
        enabled: data.enabled !== undefined ? data.enabled : true
      };
    }

    // Return default settings if none exist
    return {
      startDateWarningDays: 7,
      endDateWarningDays: 3,
      enabled: true
    };
  } catch (error) {
    console.error('Error loading notification settings:', error);
    // Return default settings on error
    return {
      startDateWarningDays: 7,
      endDateWarningDays: 3,
      enabled: true
    };
  }
}

/**
 * Check for Quote Requests with upcoming deadlines and create notifications
 * Works with both client-side and server-side Firebase
 */
export async function checkAndCreateDeadlineNotifications(useAdmin = false) {
  const firestoreDb = useAdmin ? getAdminDb() : db;
  
  if (!firestoreDb) throw new Error('Firebase not initialized');

  try {
    console.log('Checking for upcoming deadlines...');
    
    // Get all Quote Requests
    const quoteRequestsRef = collection(firestoreDb as Firestore, 'quoteRequests');
    const qrSnapshot = await getDocs(quoteRequestsRef);
    
    const today = new Date();
    const notificationsCreated: string[] = [];

    for (const qrDoc of qrSnapshot.docs) {
      const qrData = qrDoc.data();
      const qrId = qrDoc.id;
      
      // Skip if no dates
      if (!qrData.startDate || !qrData.endDate) continue;

      const startDate = qrData.startDate.toDate ? qrData.startDate.toDate() : new Date(qrData.startDate);
      const endDate = qrData.endDate.toDate ? qrData.endDate.toDate() : new Date(qrData.endDate);
      
      // Get notification settings for involved country
      const settings = await getNotificationSettings(qrData.involvedCountry, useAdmin);
      
      if (!settings.enabled) continue;

      // Check start date deadline (for non-Planned QRs)
      if (!qrData.labels?.planned && qrData.status !== 'Won' && qrData.status !== 'Lost' && qrData.status !== 'Cancelled') {
        const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilStart >= 0 && daysUntilStart <= settings.startDateWarningDays) {
          // Check if notification already exists for this deadline
          const existingNotification = await checkExistingDeadlineNotification(
            qrId, 
            qrData.involvedCountry, 
            'start_date', 
            daysUntilStart,
            useAdmin
          );
          
          if (!existingNotification) {
            await createDeadlineNotification({
              quoteRequestId: qrId,
              quoteRequestTitle: qrData.title || 'Untitled Quote Request',
              targetCountry: qrData.involvedCountry,
              deadlineType: 'start_date',
              daysUntilDeadline: daysUntilStart,
              deadlineDate: startDate.toISOString()
            }, useAdmin);
            notificationsCreated.push(`${qrData.title} - Start date warning`);
          }
        }
      }

      // Check end date deadline (for Won QRs)
      if (qrData.status === 'Won') {
        const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysUntilEnd >= 0 && daysUntilEnd <= settings.endDateWarningDays) {
          // Check if notification already exists for this deadline
          const existingNotification = await checkExistingDeadlineNotification(
            qrId, 
            qrData.involvedCountry, 
            'end_date', 
            daysUntilEnd,
            useAdmin
          );
          
          if (!existingNotification) {
            await createDeadlineNotification({
              quoteRequestId: qrId,
              quoteRequestTitle: qrData.title || 'Untitled Quote Request',
              targetCountry: qrData.involvedCountry,
              deadlineType: 'end_date',
              daysUntilDeadline: daysUntilEnd,
              deadlineDate: endDate.toISOString()
            }, useAdmin);
            notificationsCreated.push(`${qrData.title} - End date warning`);
          }
        }
      }
    }

    console.log(`Created ${notificationsCreated.length} deadline notifications:`, notificationsCreated);
    return notificationsCreated;
  } catch (error) {
    console.error('Error checking deadline notifications:', error);
    throw error;
  }
}

/**
 * Check if a deadline notification already exists for a specific QR and deadline type
 */
async function checkExistingDeadlineNotification(
  quoteRequestId: string, 
  targetCountry: string, 
  deadlineType: string, 
  daysUntilDeadline: number,
  useAdmin = false
): Promise<boolean> {
  const firestoreDb = useAdmin ? getAdminDb() : db;
  
  if (!firestoreDb) return false;

  try {
    const notificationsRef = collection(firestoreDb as Firestore, 'notifications');
    const targetKey = normalizeCountryKey(targetCountry);
    
    const existingQuery = query(
      notificationsRef,
      where('quoteRequestId', '==', quoteRequestId),
      where('targetCountryKey', '==', targetKey),
      where('notificationType', '==', 'deadline_warning'),
      where('deadlineType', '==', deadlineType),
      where('daysUntilDeadline', '==', daysUntilDeadline)
    );
    
    const existingSnap = await getDocs(existingQuery);
    return !existingSnap.empty;
  } catch (error) {
    console.error('Error checking existing deadline notification:', error);
    return false;
  }
}

/**
 * Normalize country key for consistent querying
 */
function normalizeCountryKey(name: string | undefined): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Format date for display in notifications
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}
