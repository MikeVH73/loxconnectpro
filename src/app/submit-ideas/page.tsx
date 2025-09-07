"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { Idea } from '../../types';

export default function SubmitIdeasPage() {
  const { userProfile } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'New Feature' as const,
    title: '',
    description: ''
  });

  // Load ideas
  useEffect(() => {
    if (!db) return;

    const ideasQuery = query(
      collection(db, 'ideas'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ideasQuery, (snapshot) => {
      const ideasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      })) as Idea[];
      setIdeas(ideasData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !db || submitting) return;

    setSubmitting(true);
    try {
      const ideaData = {
        userId: userProfile.id,
        userEmail: userProfile.email,
        userCountry: userProfile.businessUnit || userProfile.countries?.[0] || 'Unknown',
        title: formData.title,
        description: formData.description,
        category: formData.category,
        status: 'Under Review',
        totalPoints: 0,
        voteCount: 0,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'ideas'), ideaData);
      
      setFormData({ category: 'New Feature', title: '', description: '' });
      setShowForm(false);
      alert('Idea submitted successfully!');
    } catch (error) {
      console.error('Error submitting idea:', error);
      alert('Failed to submit idea. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Bug Report': return 'bg-red-100 text-red-800';
      case 'Improvement': return 'bg-blue-100 text-blue-800';
      case 'New Feature': return 'bg-green-100 text-green-800';
      case 'Design Issue': return 'bg-purple-100 text-purple-800';
      case 'Performance': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Under Review': return 'bg-yellow-100 text-yellow-800';
      case 'Planned': return 'bg-blue-100 text-blue-800';
      case 'In Development': return 'bg-purple-100 text-purple-800';
      case 'Implemented': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#e40115] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ideas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Ideas</h1>
          <p className="text-gray-600">Share your ideas to improve LoxConnect PRO</p>
        </div>

        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#e40115] text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Submit New Idea'}
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Submit New Idea</h2>
            <form onSubmit={handleSubmitIdea} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                  required
                >
                  <option value="Bug Report">Bug Report</option>
                  <option value="Improvement">Improvement</option>
                  <option value="New Feature">New Feature</option>
                  <option value="Design Issue">Design Issue</option>
                  <option value="Performance">Performance</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                  placeholder="Brief title for your idea"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115] h-32"
                  placeholder="Describe your idea in detail..."
                  required
                />
              </div>

              <div className="flex space-x-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#e40115] text-white px-6 py-2 rounded-md font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Idea'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-gray-300 text-gray-700 px-6 py-2 rounded-md font-medium hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-6">
          <h2 className="text-2xl font-semibold text-gray-900">All Ideas</h2>
          
          {ideas.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No ideas submitted yet.</p>
              <p className="text-gray-400 mt-2">Be the first to submit an idea!</p>
            </div>
          ) : (
            ideas.map((idea) => (
              <div key={idea.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{idea.title}</h3>
                    <p className="text-gray-600 mb-4">{idea.description}</p>
                  </div>
                  <div className="flex space-x-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(idea.category)}`}>
                      {idea.category}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(idea.status)}`}>
                      {idea.status}
                    </span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>Submitted by: {idea.userEmail}</p>
                  <p>Date: {idea.createdAt instanceof Date ? idea.createdAt.toLocaleDateString() : new Date(idea.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}