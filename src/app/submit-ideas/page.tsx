"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, addDoc, query, orderBy, onSnapshot, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';
// Local interface to match our current implementation - Updated for new statuses
interface LocalIdea {
  id: string;
  userId: string;
  userEmail: string;
  userCountry: string;
  userRole: string;
  title: string;
  description: string;
  category: 'Bug Report' | 'Improvement' | 'New Feature' | 'Design Issue' | 'Performance';
  status: 'Pending Approval' | 'Approved' | 'Being Implemented' | 'Rejected' | 'Archived';
  likeCount?: number;
  createdAt: Date;
  updatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  implementedAt?: Date;
  implementedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
  deletedAt?: Date;
  deletedBy?: string;
}

export default function SubmitIdeasPage() {
  const { userProfile } = useAuth();
  const [ideas, setIdeas] = useState<LocalIdea[]>([]);
  const [userLikes, setUserLikes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'New Feature' as const,
    title: '',
    description: ''
  });
  const [rejectionReason, setRejectionReason] = useState('');

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
      })) as LocalIdea[];
      
      // Filter based on user role
      let filteredIdeas;
      if (userProfile.role === 'superAdmin') {
        // SuperAdmin sees all ideas except archived
        filteredIdeas = allIdeas.filter(idea => idea.status !== 'Archived');
      } else {
        // Regular users see approved ideas AND ideas being implemented
        filteredIdeas = allIdeas.filter(idea => 
          idea.status === 'Approved' || idea.status === 'Being Implemented'
        );
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
      
      // Create notification for the idea submitter
      const idea = ideas.find(i => i.id === ideaId);
      if (idea) {
        await addDoc(collection(db, 'notifications'), {
          type: 'idea_rejected',
          title: 'Your idea was rejected',
          message: `Your idea "${idea.title}" was rejected. Reason: ${reason}`,
          userId: idea.userId,
          userEmail: idea.userEmail,
          ideaId: ideaId,
          createdAt: new Date(),
          read: false
        });
      }
      
      alert('Idea rejected successfully! The submitter will be notified.');
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

        {/* Kanban Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column: Ideas */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">💡 Ideas</h2>
            <div className="space-y-4">
              {ideas.filter(idea => idea.status === 'Approved').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No approved ideas yet.</p>
                </div>
              ) : (
                ideas.filter(idea => idea.status === 'Approved').map((idea) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{idea.title}</h3>
                        <p className="text-gray-600 mb-4">{idea.description}</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(idea.category)}`}>
                          {idea.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(idea.status)}`}>
                          {idea.status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Prominent Like Count */}
                    <div className="mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {userProfile && (
                            <button
                              onClick={() => handleLikeIdea(idea.id)}
                              disabled={userLikes.includes(idea.id)}
                              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-lg font-medium transition-colors ${
                                userLikes.includes(idea.id)
                                  ? 'bg-red-100 text-red-600 cursor-not-allowed'
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                            >
                              <span className="text-2xl">❤️</span>
                              <span>{userLikes.includes(idea.id) ? 'Liked' : 'Like'}</span>
                            </button>
                          )}
                          <div className="text-center">
                            <div className="text-3xl font-bold text-red-600">{idea.likeCount || 0}</div>
                            <div className="text-sm text-gray-500">likes</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      <p>Submitted by: {idea.userEmail}</p>
                      <p>Date: {idea.createdAt instanceof Date ? idea.createdAt.toLocaleDateString() : new Date(idea.createdAt).toLocaleDateString()}</p>
                      {idea.approvedBy && (
                        <p>Approved by: {idea.approvedBy}</p>
                      )}
                    </div>
                    
                    {/* SuperAdmin controls */}
                    {userProfile?.role === 'superAdmin' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleImplementIdea(idea.id)}
                          className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-700"
                        >
                          Start Implementing
                        </button>
                        <button
                          onClick={() => handleDeleteIdea(idea.id)}
                          className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Being Implemented */}
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🚀 Being Implemented</h2>
            <div className="space-y-4">
              {ideas.filter(idea => idea.status === 'Being Implemented').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No ideas being implemented yet.</p>
                </div>
              ) : (
                ideas.filter(idea => idea.status === 'Being Implemented').map((idea) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{idea.title}</h3>
                        <p className="text-gray-600 mb-4">{idea.description}</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(idea.category)}`}>
                          {idea.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(idea.status)}`}>
                          {idea.status}
                        </span>
                      </div>
                    </div>
                    
                    {/* Show Like Count (but no like button) */}
                    <div className="mb-4">
                      <div className="flex items-center justify-center">
                        <div className="text-center">
                          <div className="text-3xl font-bold text-red-600">{idea.likeCount || 0}</div>
                          <div className="text-sm text-gray-500">likes received</div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      <p>Submitted by: {idea.userEmail}</p>
                      <p>Date: {idea.createdAt instanceof Date ? idea.createdAt.toLocaleDateString() : new Date(idea.createdAt).toLocaleDateString()}</p>
                      {idea.implementedBy && (
                        <p className="text-purple-600 font-medium">Being implemented by: {idea.implementedBy}</p>
                      )}
                    </div>
                    
                    {/* SuperAdmin controls */}
                    {userProfile?.role === 'superAdmin' && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleDeleteIdea(idea.id)}
                          className="bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700"
                        >
                          Archive
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SuperAdmin Section: Pending Approval */}
        {userProfile?.role === 'superAdmin' && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">⏳ Pending Approval</h2>
            <div className="space-y-4">
              {ideas.filter(idea => idea.status === 'Pending Approval').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No ideas pending approval.</p>
                </div>
              ) : (
                ideas.filter(idea => idea.status === 'Pending Approval').map((idea) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{idea.title}</h3>
                        <p className="text-gray-600 mb-4">{idea.description}</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(idea.category)}`}>
                          {idea.category}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(idea.status)}`}>
                          {idea.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      <p>Submitted by: {idea.userEmail}</p>
                      <p>Date: {idea.createdAt instanceof Date ? idea.createdAt.toLocaleDateString() : new Date(idea.createdAt).toLocaleDateString()}</p>
                    </div>
                    
                    {/* SuperAdmin controls */}
                    <div className="flex flex-wrap gap-2">
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
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}