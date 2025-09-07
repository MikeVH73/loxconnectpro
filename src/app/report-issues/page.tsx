"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, addDoc, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { ErrorReport } from '../../types';

export default function ReportIssuesPage() {
  const { userProfile, authLoading } = useAuth();
  const [errorReports, setErrorReports] = useState<ErrorReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Bug Report' as const,
    title: '',
    description: '',
    priority: 'Medium' as const,
    screenshot: ''
  });

  // Load error reports
  useEffect(() => {
    if (!userProfile) return;

    const q = query(
      collection(db, 'errorReports'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ErrorReport[];
      
      setErrorReports(reports);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;

    try {
      const newReport: Omit<ErrorReport, 'id'> = {
        userId: userProfile.id,
        userEmail: userProfile.email,
        userCountry: userProfile.businessUnit || userProfile.countries?.[0] || 'Unknown',
        userRole: userProfile.role,
        page: window.location.pathname,
        category: formData.category,
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: 'New',
        screenshot: formData.screenshot,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db, 'errorReports'), newReport);
      
      // Reset form
      setFormData({
        category: 'Bug Report',
        title: '',
        description: '',
        priority: 'Medium',
        screenshot: ''
      });
      setShowForm(false);
      
      alert('Error report submitted successfully!');
    } catch (error) {
      console.error('Error submitting report:', error);
      alert('Failed to submit error report. Please try again.');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'bg-red-100 text-red-800';
      case 'High': return 'bg-orange-100 text-orange-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (authLoading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!userProfile) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-[#e40115] mb-2">Report Issues</h1>
        <p className="text-gray-600">Please log in to report issues.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#e40115] mb-2">Report Issues</h1>
          <p className="text-gray-600">Help us improve LoxConnect PRO by reporting bugs, improvements, or other issues.</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#e40115] text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
        >
          {showForm ? 'Cancel' : 'Report New Issue'}
        </button>
      </div>

      {/* Report Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Submit Error Report</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                  required
                >
                  <option value="Bug Report">Bug Report - Something isn't working right</option>
                  <option value="Improvement">Improvement - Make something better</option>
                  <option value="Design Issue">Design Issue - Looks wrong or confusing</option>
                  <option value="Performance">Performance - App is slow or laggy</option>
                  <option value="Other">Other - Something else</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                  required
                >
                  <option value="Low">Low - Minor issue</option>
                  <option value="Medium">Medium - Moderate issue</option>
                  <option value="High">High - Important issue</option>
                  <option value="Critical">Critical - Blocks work</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                placeholder="Brief description of the issue"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#e40115] h-32"
                placeholder="Detailed description of the issue, steps to reproduce, etc."
                required
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-[#e40115] text-white rounded-lg hover:bg-red-700"
              >
                Submit Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Error Reports List */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Your Error Reports</h2>
          <p className="text-gray-600 text-sm mt-1">Track the status of your submitted reports</p>
        </div>
        
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : errorReports.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No error reports submitted yet.
          </div>
        ) : (
          <div className="divide-y">
            {errorReports.map((report) => (
              <div key={report.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{report.title}</h3>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(report.priority)}`}>
                      {report.priority}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(report.status)}`}>
                      {report.status}
                    </span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-2">
                  <span className="font-medium">Category:</span> {report.category} • 
                  <span className="font-medium ml-2">Page:</span> {report.page} • 
                  <span className="font-medium ml-2">Submitted:</span> {new Date(report.createdAt).toLocaleDateString()}
                </div>
                
                <p className="text-gray-700 mb-3">{report.description}</p>
                
                {report.superAdminResponse && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
                    <h4 className="font-medium text-blue-900 mb-1">Response from SuperAdmin:</h4>
                    <p className="text-blue-800 text-sm">{report.superAdminResponse}</p>
                    {report.resolvedAt && (
                      <p className="text-blue-600 text-xs mt-1">
                        Resolved on {new Date(report.resolvedAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
