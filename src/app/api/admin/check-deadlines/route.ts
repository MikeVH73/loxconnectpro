export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import * as admin from 'firebase-admin';

// Reuse a singleton Admin app across invocations
let adminApp: admin.app.App | null = null;
function getAdmin() {
  if (!adminApp) {
    try {
      adminApp = admin.app();
    } catch {
      const projectId = process.env.FIREBASE_PROJECT_ID as string;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL as string;
      let privateKey = process.env.FIREBASE_PRIVATE_KEY as string;
      if (!projectId || !clientEmail || !privateKey) {
        throw new Error('Firebase Admin credentials are not set');
      }
      privateKey = privateKey.replace(/\\n/g, '\n');
      adminApp = admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
  }
  return {
    db: admin.firestore(adminApp!),
    auth: admin.auth(adminApp!),
  };
}

interface NotificationSettings {
  startDateWarningDays: number;
  endDateWarningDays: number;
  enabled: boolean;
}

/**
 * Normalize country key for consistent querying
 */
function normalizeCountryKey(name: string | undefined): string {
  if (!name) return 'unknown';
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Format date for display
 */
function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
}

/**
 * Get notification settings for a specific country using Admin SDK
 */
async function getNotificationSettings(db: admin.firestore.Firestore, country: string): Promise<NotificationSettings> {
  try {
    const settingsDoc = await db.collection('notificationSettings').doc(country).get();
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data() as NotificationSettings;
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
 * Check if a deadline notification already exists for a specific QR and deadline type
 */
async function checkExistingDeadlineNotification(
  db: admin.firestore.Firestore,
  quoteRequestId: string, 
  targetCountry: string, 
  deadlineType: string, 
  daysUntilDeadline: number
): Promise<boolean> {
  try {
    const targetKey = normalizeCountryKey(targetCountry);
    
    const existingQuery = db.collection('notifications')
      .where('quoteRequestId', '==', quoteRequestId)
      .where('targetCountryKey', '==', targetKey)
      .where('notificationType', '==', 'deadline_warning')
      .where('deadlineType', '==', deadlineType)
      .where('daysUntilDeadline', '==', daysUntilDeadline);
    
    const existingSnap = await existingQuery.get();
    return !existingSnap.empty;
  } catch (error) {
    console.error('Error checking existing deadline notification:', error);
    return false;
  }
}

/**
 * Create a deadline notification using Admin SDK
 */
async function createDeadlineNotification(
  db: admin.firestore.Firestore,
  quoteRequestId: string,
  quoteRequestTitle: string,
  targetCountry: string,
  deadlineType: 'start_date' | 'end_date',
  daysUntilDeadline: number,
  deadlineDate: string
) {
  try {
    console.log('Creating deadline notification:', { 
      quoteRequestId, 
      deadlineType, 
      daysUntilDeadline,
      targetCountry 
    });

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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isRead: false,
    };

    await db.collection('notifications').add(notificationData);
    console.log('Deadline notification created successfully');
  } catch (error) {
    console.error('Error creating deadline notification:', error);
    // Don't throw the error - we don't want notification failures to break the main flow
  }
}

/**
 * Check for Quote Requests with upcoming deadlines and create notifications using Admin SDK
 */
async function checkAndCreateDeadlineNotifications(): Promise<string[]> {
  const { db } = getAdmin();

  try {
    console.log('Checking for upcoming deadlines...');
    
    // Get all Quote Requests
    const qrSnapshot = await db.collection('quoteRequests').get();
    
    const today = new Date();
    const notificationsCreated: string[] = [];

    for (const qrDoc of qrSnapshot.docs) {
      const qrData = qrDoc.data();
      const qrId = qrDoc.id;
      
      console.log(`[DEBUG] Checking QR: ${qrData.title}`, {
        id: qrId,
        planned: qrData.planned,
        status: qrData.status,
        involvedCountry: qrData.involvedCountry,
        startDate: qrData.startDate,
        endDate: qrData.endDate
      });
      
      // Skip if no dates
      if (!qrData.startDate || !qrData.endDate) {
        console.log(`[DEBUG] Skipping QR ${qrId} - missing dates`);
        continue;
      }

      const startDate = qrData.startDate.toDate ? qrData.startDate.toDate() : new Date(qrData.startDate);
      const endDate = qrData.endDate.toDate ? qrData.endDate.toDate() : new Date(qrData.endDate);
      
      // Get notification settings for involved country
      const settings = await getNotificationSettings(db, qrData.involvedCountry);
      
      if (!settings.enabled) continue;

      // Check start date deadline (for non-Planned QRs)
      if (!qrData.planned && qrData.status !== 'Won' && qrData.status !== 'Lost' && qrData.status !== 'Cancelled') {
        const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`[DEBUG] Start date check for ${qrData.title}:`, {
          startDate: startDate.toISOString(),
          today: today.toISOString(),
          daysUntilStart,
          startDateWarningDays: settings.startDateWarningDays,
          shouldNotify: daysUntilStart >= 0 && daysUntilStart <= settings.startDateWarningDays
        });
        
        if (daysUntilStart >= 0 && daysUntilStart <= settings.startDateWarningDays) {
          // Check if notification already exists for this deadline
          const existingNotification = await checkExistingDeadlineNotification(
            db,
            qrId, 
            qrData.involvedCountry, 
            'start_date', 
            daysUntilStart
          );
          
          if (!existingNotification) {
            await createDeadlineNotification(
              db,
              qrId,
              qrData.title || 'Untitled Quote Request',
              qrData.involvedCountry,
              'start_date',
              daysUntilStart,
              startDate.toISOString()
            );
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
            db,
            qrId, 
            qrData.involvedCountry, 
            'end_date', 
            daysUntilEnd
          );
          
          if (!existingNotification) {
            await createDeadlineNotification(
              db,
              qrId,
              qrData.title || 'Untitled Quote Request',
              qrData.involvedCountry,
              'end_date',
              daysUntilEnd,
              endDate.toISOString()
            );
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

export async function POST(request: NextRequest) {
  try {
    console.log('Running deadline notification check...');
    
    const notificationsCreated = await checkAndCreateDeadlineNotifications();
    
    return NextResponse.json({
      success: true,
      message: `Created ${notificationsCreated.length} deadline notifications`,
      notificationsCreated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in deadline notification API:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('Manual deadline notification check triggered...');
    
    const notificationsCreated = await checkAndCreateDeadlineNotifications();
    
    return NextResponse.json({
      success: true,
      message: `Created ${notificationsCreated.length} deadline notifications`,
      notificationsCreated,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in deadline notification API:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
