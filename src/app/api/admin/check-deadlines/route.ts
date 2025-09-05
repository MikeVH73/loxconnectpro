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

// Import the deadline notification functions
import { checkAndCreateDeadlineNotifications } from '../../../utils/deadlineNotifications';

export async function POST(request: NextRequest) {
  try {
    console.log('Running deadline notification check...');
    
    const notificationsCreated = await checkAndCreateDeadlineNotifications(true); // Use Admin SDK
    
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
    
    const notificationsCreated = await checkAndCreateDeadlineNotifications(true); // Use Admin SDK
    
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
