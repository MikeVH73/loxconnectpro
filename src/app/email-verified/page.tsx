'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../AuthProvider';
import Link from 'next/link';

export default function EmailVerifiedPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState<'checking' | 'verified' | 'failed'>('checking');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Check verification status after a short delay to allow auth state to update
    const checkVerification = setTimeout(() => {
      if (user?.emailVerified) {
        setVerificationStatus('verified');
        // Start countdown to redirect to dashboard
        const countdownInterval = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(countdownInterval);
              router.push('/dashboard');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setVerificationStatus('failed');
      }
    }, 1000);

    return () => clearTimeout(checkVerification);
  }, [user, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking verification status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
        {verificationStatus === 'checking' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-red-500 mx-auto mb-6"></div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Verifying Email...</h1>
            <p className="text-gray-600">Please wait while we confirm your email verification.</p>
          </>
        )}

        {verificationStatus === 'verified' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Email Verified Successfully!</h1>
            <p className="text-gray-600 mb-6">
              Your email address has been verified. You can now access all features of LoxCall PRO.
            </p>
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Redirecting to dashboard in {countdown} seconds...
              </p>
              <Link 
                href="/dashboard"
                className="inline-block w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Go to Dashboard Now
              </Link>
            </div>
          </>
        )}

        {verificationStatus === 'failed' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-4">Verification Failed</h1>
            <p className="text-gray-600 mb-6">
              We couldn't verify your email address. This might be because:
            </p>
            <ul className="text-sm text-gray-600 text-left mb-6 space-y-2">
              <li>• The verification link has expired</li>
              <li>• The link has already been used</li>
              <li>• There was a temporary issue</li>
            </ul>
            <div className="space-y-3">
              <Link 
                href="/verify"
                className="inline-block w-full bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 transition-colors font-medium"
              >
                Request New Verification Email
              </Link>
              <Link 
                href="/login"
                className="inline-block w-full bg-gray-200 text-gray-800 py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
