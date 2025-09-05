import { NextRequest, NextResponse } from 'next/server';
import { checkAndCreateDeadlineNotifications } from '../../utils/deadlineNotifications';

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
