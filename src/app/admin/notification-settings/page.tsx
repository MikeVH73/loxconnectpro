"use client";

import { useState, useEffect } from 'react';
import { collection, doc, getDoc, setDoc, Firestore } from 'firebase/firestore';
import { db } from '../../../firebaseClient';
import { useAuth } from '../../AuthProvider';

interface NotificationSettings {
  startDateWarningDays: number;  // Days before start date to warn (for non-Planned QRs)
  endDateWarningDays: number;    // Days before end date to warn (for Won QRs)
  enabled: boolean;              // Whether deadline notifications are enabled
}

const defaultSettings: NotificationSettings = {
  startDateWarningDays: 7,
  endDateWarningDays: 3,
  enabled: true
};

export default function NotificationSettingsPage() {
  const { userProfile } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [testingDeadlines, setTestingDeadlines] = useState(false);
  const [testResults, setTestResults] = useState<string>('');

  // Check if user has permission to manage settings
  const canManageSettings = userProfile?.role === 'admin' || userProfile?.role === 'superAdmin';
  const userCountry = userProfile?.businessUnit || userProfile?.countries?.[0] || 'Unknown';

  useEffect(() => {
    if (!canManageSettings) return;
    
    const loadSettings = async () => {
      try {
        if (!db) throw new Error('Firebase not initialized');
        
        // Load settings for the user's country
        const settingsDoc = await getDoc(doc(db as Firestore, 'notificationSettings', userCountry));
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as NotificationSettings;
          setSettings({
            startDateWarningDays: data.startDateWarningDays || defaultSettings.startDateWarningDays,
            endDateWarningDays: data.endDateWarningDays || defaultSettings.endDateWarningDays,
            enabled: data.enabled !== undefined ? data.enabled : defaultSettings.enabled
          });
        } else {
          // Use default settings if none exist
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.error('Error loading notification settings:', err);
        setError('Failed to load notification settings');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [canManageSettings, userCountry]);

  const handleSave = async () => {
    if (!canManageSettings || !db) return;
    
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Validate settings
      if (settings.startDateWarningDays < 1 || settings.startDateWarningDays > 30) {
        setError('Start date warning must be between 1 and 30 days');
        return;
      }
      
      if (settings.endDateWarningDays < 1 || settings.endDateWarningDays > 30) {
        setError('End date warning must be between 1 and 30 days');
        return;
      }

      // Save settings for the user's country
      await setDoc(doc(db as Firestore, 'notificationSettings', userCountry), {
        ...settings,
        updatedAt: new Date(),
        updatedBy: userProfile?.email || 'Unknown'
      });

      setSuccess('Notification settings saved successfully!');
    } catch (err) {
      console.error('Error saving notification settings:', err);
      setError('Failed to save notification settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestDeadlines = async () => {
    setTestingDeadlines(true);
    setTestResults('');
    setError('');

    try {
      const response = await fetch('/api/admin/check-deadlines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const result = await response.json();

      if (result.success) {
        setTestResults(`✅ Test completed successfully!\n\nCreated ${result.notificationsCreated.length} deadline notifications:\n${result.notificationsCreated.map((n: string) => `• ${n}`).join('\n')}`);
      } else {
        setError(`Test failed: ${result.error}`);
      }
    } catch (err) {
      setError('Failed to test deadline notifications');
    } finally {
      setTestingDeadlines(false);
    }
  };

  if (!canManageSettings) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e40115] mb-4">Notification Settings</h1>
        <p className="text-gray-600">You don't have permission to manage notification settings.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e40115] mb-4">Notification Settings</h1>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#e40115] mb-4">Notification Settings</h1>
      <p className="text-gray-600 mb-6">
        Configure deadline notifications for {userCountry}. These settings determine when users will be notified about upcoming Quote Request deadlines.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded text-sm">
          {success}
        </div>
      )}

      {testResults && (
        <div className="mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded text-sm">
          <pre className="whitespace-pre-wrap text-xs">{testResults}</pre>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Enable/Disable Notifications */}
          <div>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings(prev => ({ ...prev, enabled: e.target.checked }))}
                className="rounded border-gray-300 text-[#e40115] focus:ring-[#e40115]"
              />
              <div>
                <span className="text-sm font-medium text-gray-700">Enable Deadline Notifications</span>
                <p className="text-xs text-gray-500">Turn on/off all deadline notifications for this country</p>
              </div>
            </label>
          </div>

          {/* Start Date Warning */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date Warning (Days Before)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="30"
                value={settings.startDateWarningDays}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  startDateWarningDays: parseInt(e.target.value) || 1 
                }))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                disabled={!settings.enabled}
              />
              <span className="text-sm text-gray-600">
                Warn users when Quote Request start date is approaching (for non-Planned QRs)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Users will be notified when a Quote Request that is not yet "Planned" has a start date within this many days.
            </p>
          </div>

          {/* End Date Warning */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date Warning (Days Before)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="number"
                min="1"
                max="30"
                value={settings.endDateWarningDays}
                onChange={(e) => setSettings(prev => ({ 
                  ...prev, 
                  endDateWarningDays: parseInt(e.target.value) || 1 
                }))}
                className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                disabled={!settings.enabled}
              />
              <span className="text-sm text-gray-600">
                Warn users when Quote Request end date is approaching (for Won QRs)
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Users will be notified when a "Won" Quote Request has an end date within this many days.
            </p>
          </div>
        </div>

        <div className="flex justify-between items-center mt-8">
          <button
            onClick={handleTestDeadlines}
            disabled={testingDeadlines || !settings.enabled}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {testingDeadlines ? 'Testing...' : 'Test Deadline Notifications'}
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-[#e40115] text-white rounded-md hover:bg-[#c40113] focus:outline-none focus:ring-2 focus:ring-[#e40115] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Information Section */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">How Deadline Notifications Work</h3>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>• <strong>Start Date Warnings:</strong> Notify users when Quote Requests that are not yet "Planned" have approaching start dates</li>
          <li>• <strong>End Date Warnings:</strong> Notify users when "Won" Quote Requests have approaching end dates</li>
          <li>• <strong>Country-Specific:</strong> Each country can configure their own notification preferences</li>
          <li>• <strong>Automatic:</strong> Notifications are sent automatically based on Quote Request dates</li>
        </ul>
      </div>
    </div>
  );
}
