"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, addDoc, query, orderBy, onSnapshot, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { Idea } from '../../types';

export default function SubmitIdeasPage() {
  const { userProfile } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [userLikes, setUserLikes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'New Feature' as const,
    title: '',
    description: ''
  });

  // Load ideas - show all for superAdmin, only approved for others
  useEffect(() => {
    if (!db || !userProfile) return;

    // For now, load all ideas and filter client-side to avoid Firebase index issues
    const ideasQuery = query(
      collection(db, 'ideas'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(ideasQuery, (snapshot) => {
      const allIdeas = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      })) as Idea[];
      
      // Filter based on user role
      let filteredIdeas;
      if (userProfile.role === 'superAdmin') {
        // SuperAdmin sees all ideas except archived
        filteredIdeas = allIdeas.filter(idea => idea.status !== 'Archived');
      } else {
        // Regular users only see approved ideas
        filteredIdeas = allIdeas.filter(idea => idea.status === 'Approved');
      }
      
      setIdeas(filteredIdeas);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userProfile]);

  // Load user's likes
  useEffect(() => {
    if (!db || !userProfile) return;

    const likesQuery = query(
      collection(db, 'ideaLikes'),
      where('userId', '==', userProfile.id)
    );

    const unsubscribe = onSnapshot(likesQuery, (snapshot) => {
      const likedIdeas = snapshot.docs.map(doc => doc.data().ideaId);
      setUserLikes(likedIdeas);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleLikeIdea = async (ideaId: string) => {
    if (!db || !userProfile) return;

    const isLiked = userLikes.includes(ideaId);
    
    try {
      if (isLiked) {
        // Unlike: find and delete the like document
        const likesQuery = query(
          collection(db, 'ideaLikes'),
          where('userId', '==', userProfile.id),
          where('ideaId', '==', ideaId)
        );
        const likesSnapshot = await getDocs(likesQuery);
        if (!likesSnapshot.empty) {
          await updateDoc(doc(db, 'ideaLikes', likesSnapshot.docs[0].id), {
            deleted: true,
            deletedAt: new Date()
          });
        }
        
        // Update idea like count
        const idea = ideas.find(i => i.id === ideaId);
        if (idea) {
          await updateDoc(doc(db, 'ideas', ideaId), {
            likeCount: (idea.likeCount || 0) - 1
          });
        }
      } else {
        // Like: create new like document
        await addDoc(collection(db, 'ideaLikes'), {
          userId: userProfile.id,
          ideaId: ideaId,
          createdAt: new Date()
        });
        
        // Update idea like count
        const idea = ideas.find(i => i.id === ideaId);
        if (idea) {
          await updateDoc(doc(db, 'ideas', ideaId), {
            likeCount: (idea.likeCount || 0) + 1
          });
        }
      }
    } catch (error) {
      console.error('Error liking idea:', error);
      alert('Failed to like idea. Please try again.');
    }
  };

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
        status: 'Pending Approval',
        totalPoints: 0,
        voteCount: 0,
        createdAt: new Date()
      };

      await addDoc(collection(db, 'ideas'), ideaData);
      
      setFormData({ category: 'New Feature', title: '', description: '' });
      setShowForm(false);
      alert('Idea submitted successfully! It will be reviewed by a superAdmin before being visible to other users.');
    } catch (error) {
      console.error('Error submitting idea:', error);
      alert('Failed to submit idea. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImplementIdea = async (ideaId: string) => {
    if (!db || !userProfile || userProfile.role !== 'superAdmin') return;
    
    try {
      await updateDoc(doc(db, 'ideas', ideaId), {
        status: 'Being Implemented',
        implementedBy: userProfile.email,
        implementedAt: new Date()
      });
      alert('Idea marked as being implemented!');
    } catch (error) {
      console.error('Error implementing idea:', error);
      alert('Failed to mark idea as being implemented. Please try again.');
    }
  };

  const handleDeleteIdea = async (ideaId: string) => {
    if (!db || !userProfile || userProfile.role !== 'superAdmin') return;
    
    const confirmDelete = confirm('Are you sure you want to delete this idea? It will be archived.');
    if (!confirmDelete) return;
    
    try {
      await updateDoc(doc(db, 'ideas', ideaId), {
        status: 'Archived',
        deletedBy: userProfile.email,
        deletedAt: new Date()
      });
      alert('Idea deleted and archived successfully!');
    } catch (error) {
      console.error('Error deleting idea:', error);
      alert('Failed to delete idea. Please try again.');
    }
  };

  const handleApproveIdea = async (ideaId: string) => {
    if (!db || !userProfile || userProfile.role !== 'superAdmin') return;
    
    try {
      await updateDoc(doc(db, 'ideas', ideaId), {
        status: 'Approved',
        approvedBy: userProfile.email,
        approvedAt: new Date()
      });
      alert('Idea approved successfully!');
    } catch (error) {
      console.error('Error approving idea:', error);
      alert('Failed to approve idea. Please try again.');
    }
  };

  const handleRejectIdea = async (ideaId: string) => {
    if (!db || !userProfile || userProfile.role !== 'superAdmin') return;
    
    const reason = prompt('Please provide a reason for rejection:');
    if (!reason) return;
    
    try {
      await updateDoc(doc(db, 'ideas', ideaId), {
        status: 'Rejected',
        rejectedBy: userProfile.email,
        rejectedAt: new Date(),
        rejectionReason: reason
      });
      alert('Idea rejected successfully!');
    } catch (error) {
      console.error('Error rejecting idea:', error);
      alert('Failed to reject idea. Please try again.');
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
      case 'Pending Approval': return 'bg-yellow-100 text-yellow-800';
      case 'Approved': return 'bg-green-100 text-green-800';
      case 'Rejected': return 'bg-red-100 text-red-800';
      case 'Being Implemented': return 'bg-purple-100 text-purple-800';
      case 'Archived': return 'bg-gray-100 text-gray-800';
      case 'Planned': return 'bg-blue-100 text-blue-800';
      case 'In Development': return 'bg-purple-100 text-purple-800';
      case 'Implemented': return 'bg-green-100 text-green-800';
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
          <p className="text-gray-600">Share your ideas to improve LoxConnect PRO. Ideas are reviewed by superAdmins before being visible to all users.</p>
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
                  {idea.status === 'Approved' && idea.approvedBy && (
                    <p>Approved by: {idea.approvedBy}</p>
                  )}
                  {idea.status === 'Rejected' && idea.rejectedBy && (
                    <div>
                      <p>Rejected by: {idea.rejectedBy}</p>
                      {idea.rejectionReason && (
                        <p className="text-red-600">Reason: {idea.rejectionReason}</p>
                      )}
                    </div>
                  )}
                  {idea.status === 'Being Implemented' && idea.implementedBy && (
                    <p>Being implemented by: {idea.implementedBy}</p>
                  )}
                </div>
                
                {/* Like button for approved ideas */}
                {idea.status === 'Approved' && userProfile && (
                  <div className="mt-3 flex items-center space-x-2">
                    <button
                      onClick={() => handleLikeIdea(idea.id)}
                      disabled={userLikes.includes(idea.id)}
                      className={`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        userLikes.includes(idea.id)
                          ? 'bg-red-100 text-red-600 cursor-not-allowed'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <span>❤️</span>
                      <span>{userLikes.includes(idea.id) ? 'Liked' : 'Like'}</span>
                    </button>
                    <span className="text-sm text-gray-500">
                      {idea.likeCount || 0} likes
                    </span>
                  </div>
                )}
                
                {/* SuperAdmin controls */}
                {userProfile?.role === 'superAdmin' && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {idea.status === 'Pending Approval' && (
                      <>
                        <button
                          onClick={() => handleApproveIdea(idea.id)}
                          className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleRejectIdea(idea.id)}
                          className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {idea.status === 'Approved' && (
                      <button
                        onClick={() => handleImplementIdea(idea.id)}
                        className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700"
                      >
                        Start Implementing
                      </button>
                    )}
                    {idea.status !== 'Archived' && idea.status !== 'Being Implemented' && (
                      <button
                        onClick={() => handleDeleteIdea(idea.id)}
                        className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}