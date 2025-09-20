import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { email, adminPassword } = await req.json();
    
    // Simple admin password check (in production, use proper admin authentication)
    if (adminPassword !== 'LOXCONNECT_EMERGENCY_2024') {
      return NextResponse.json({ error: 'Invalid admin password' }, { status: 401 });
    }
    
    if (!email) {
      return NextResponse.json({ error: 'Missing email' }, { status: 400 });
    }
    
    const auth = getAdminAuth();
    
    // Check if user exists
    try {
      const userRecord = await auth.getUserByEmail(email);
      
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-12);
      
      // Update user with temporary password
      await auth.updateUser(userRecord.uid, { 
        password: tempPassword,
        emailVerified: true // Ensure email is verified
      });
      
      return NextResponse.json({ 
        success: true, 
        tempPassword,
        message: 'Emergency login successful. Use the temporary password to log in.'
      });
      
    } catch (userError: any) {
      if (userError.code === 'auth/user-not-found') {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      throw userError;
    }
    
  } catch (error: any) {
    console.error('Emergency login error:', error);
    return NextResponse.json({ error: error?.message || 'Emergency login failed' }, { status: 500 });
  }
}
