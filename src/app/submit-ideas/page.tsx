"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, addDoc, query, orderBy, onSnapshot, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import { db } from '../../firebaseClient';
import { Idea, UserVote, MonthlyPoints } from '../../types';
import { ensureMonthlyPoints } from '../utils/monthlyPoints';

export default function SubmitIdeasPage() {
  const { userProfile } = useAuth();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [userVotes, setUserVotes] = useState<UserVote[]>([]);
  const [monthlyPoints, setMonthlyPoints] = useState<MonthlyPoints | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'New Feature' as const,
    title: '',
    description: ''
  });

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Load ideas and user's voting data
  useEffect(() => {
    if (!userProfile || !db) return;

    // Ensure monthly points are available and listen for changes
    ensureMonthlyPoints(userProfile.id).then(setMonthlyPoints);
    
    // Listen to monthly points changes
    const monthlyPointsQuery = query(
      collection(db!, 'monthlyPoints'),
      where('userId', '==', userProfile.id),
      where('month', '==', currentMonth),
      where('year', '==', currentYear)
    );
    
    const unsubscribeMonthlyPoints = onSnapshot(monthlyPointsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const monthlyPointsData = snapshot.docs[0].data() as MonthlyPoints;
        setMonthlyPoints(monthlyPointsData);
      }
    });

    // Load ideas
    const ideasQuery = query(
      collection(db!, 'ideas'),
      orderBy('totalPoints', 'desc')
    );

    const unsubscribeIdeas = onSnapshot(ideasQuery, (snapshot) => {
      const ideasData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Idea[];
      
      setIdeas(ideasData);
    });

    // Load user's votes for current month
    const votesQuery = query(
      collection(db!, 'userVotes'),
      where('userId', '==', userProfile.id),
      where('month', '==', currentMonth),
      where('year', '==', currentYear)
    );

    const unsubscribeVotes = onSnapshot(votesQuery, (snapshot) => {
      const votesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UserVote[];
      
      setUserVotes(votesData);
    });

    // Load user's monthly points using the utility function
    const loadMonthlyPoints = async () => {
      try {
        const points = await ensureMonthlyPoints(userProfile.id);
        setMonthlyPoints(points);
      } catch (error) {
        console.error('Error loading monthly points:', error);
      }
      setLoading(false);
    };

    loadMonthlyPoints();

    return () => {
      unsubscribeIdeas();
      unsubscribeVotes();
      unsubscribeMonthlyPoints();
    };
  }, [userProfile, currentMonth, currentYear]);

  const handleSubmitIdea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile || !db) return;

    try {
      const newIdea: Omit<Idea, 'id'> = {
        userId: userProfile.id,
        userEmail: userProfile.email,
        userCountry: userProfile.businessUnit || userProfile.countries?.[0] || 'Unknown',
        userRole: userProfile.role,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        status: 'Under Review',
        totalPoints: 0,
        voteCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await addDoc(collection(db!, 'ideas'), newIdea);
      
      // Reset form
      setFormData({
        category: 'New Feature',
        title: '',
        description: ''
      });
      setShowForm(false);
      
      alert('Idea submitted successfully!');
    } catch (error) {
      console.error('Error submitting idea:', error);
      alert('Failed to submit idea. Please try again.');
    }
  };

  const handleVote = async (ideaId: string, points: number) => {
    if (!userProfile || !monthlyPoints || !db) {
      alert('System not ready. Please refresh the page and try again.');
      return;
    }

    // Find existing vote
    const existingVote = userVotes.find(vote => vote.ideaId === ideaId);
    const currentVotePoints = existingVote?.points || 0;
    const pointsDifference = points - currentVotePoints;

    // Simple validation
    if (pointsDifference > monthlyPoints.remainingPoints) {
      alert(`You only have ${monthlyPoints.remainingPoints} points remaining. This vote would require ${pointsDifference} points.`);
      return;
    }

    try {
      // Step 1: Update or create vote
      if (existingVote) {
        await updateDoc(doc(db, 'userVotes', existingVote.id), {
          points: points,
          updatedAt: new Date()
        });
      } else {
        const newVote = {
          userId: userProfile.id,
          ideaId: ideaId,
          points: points,
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          createdAt: new Date()
        };
        await addDoc(collection(db, 'userVotes'), newVote);
      }
      
      // Step 2: Update idea total points
      const idea = ideas.find(i => i.id === ideaId);
      if (idea) {
        const newTotalPoints = idea.totalPoints + pointsDifference;
        const newVoteCount = existingVote ? idea.voteCount : idea.voteCount + 1;
        
        await updateDoc(doc(db, 'ideas', ideaId), {
          totalPoints: newTotalPoints,
          voteCount: newVoteCount,
          updatedAt: new Date()
        });
      }
      
      // Step 3: Update monthly points - SIMPLE APPROACH
      const monthlyPointsRef = doc(db, 'monthlyPoints', monthlyPoints.id);
      const newUsedPoints = monthlyPoints.usedPoints + pointsDifference;
      const newRemainingPoints = 10 - newUsedPoints; // Always 10 total points per month
      
      await updateDoc(monthlyPointsRef, {
        usedPoints: newUsedPoints,
        remainingPoints: newRemainingPoints,
        updatedAt: new Date()
      });
      
      // Show success message
      const action = pointsDifference > 0 ? 'deducted' : 'refunded';
      alert(`Vote successful! ${Math.abs(pointsDifference)} points ${action}.`);
      
    } catch (error: any) {
      console.error('Voting error:', error);
      alert(`Failed to vote: ${error.message}. Please try again.`);
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

  const getUserVoteForIdea = (ideaId: string) => {
    if (!userVotes || !Array.isArray(userVotes)) {
      console.warn('userVotes is not properly initialized:', userVotes);
      return 0;
    }
    
    const vote = userVotes.find(vote => {
      if (!vote || typeof vote.ideaId !== 'string') {
        console.warn('Invalid vote object:', vote);
        return false;
      }
      return vote.ideaId === ideaId;
    });
    
    return vote?.points || 0;
  };

  if (loading) {
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
        <h1 className="text-2xl font-bold text-[#e40115] mb-2">Submit Ideas</h1>
        <p className="text-gray-600">Please log in to submit ideas and vote.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#e40115] mb-2">Submit Ideas</h1>
          <p className="text-gray-600">Share your ideas to improve LoxConnect PRO and vote on others' ideas.</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600 mb-2">
            Points remaining this month: <span className="font-bold text-lg text-[#e40115]">{monthlyPoints?.remainingPoints || 0}</span>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#e40115] text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            {showForm ? 'Cancel' : 'Submit New Idea'}
          </button>
        </div>
      </div>

      {/* Submit Idea Form */}
      {showForm && (
        <div className="bg-white border rounded-lg p-6 mb-8 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Submit New Idea</h2>
          <form onSubmit={handleSubmitIdea} className="space-y-4">
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
                <option value="New Feature">New Feature - Add something new</option>
                <option value="Design Issue">Design Issue - Looks wrong or confusing</option>
                <option value="Performance">Performance - App is slow or laggy</option>
              </select>
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
                placeholder="Brief description of your idea"
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
                placeholder="Detailed description of your idea, how it would work, benefits, etc."
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
                Submit Idea
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ideas List */}
      <div className="bg-white border rounded-lg shadow-sm">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Ideas & Voting</h2>
          <p className="text-gray-600 text-sm mt-1">Vote on ideas using your monthly points. Ideas are ranked by total points received.</p>
        </div>
        
        {loading ? (
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : ideas.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No ideas submitted yet.
          </div>
        ) : (
          <div className="divide-y">
            {ideas.map((idea) => (
              <div key={idea.id} className="p-6 hover:bg-gray-50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-medium text-gray-900">{idea.title}</h3>
                  <div className="flex space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(idea.category)}`}>
                      {idea.category}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(idea.status)}`}>
                      {idea.status}
                    </span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Submitted by:</span> {idea.userEmail} • 
                  <span className="font-medium ml-2">Points:</span> {idea.totalPoints} ⭐ • 
                  <span className="font-medium ml-2">Votes:</span> {idea.voteCount} • 
                  <span className="font-medium ml-2">Date:</span> {idea.createdAt ? new Date(idea.createdAt instanceof Date ? idea.createdAt : (idea.createdAt as any).seconds * 1000).toLocaleDateString() : 'Unknown'}
                </div>
                
                <p className="text-gray-700 mb-4">{idea.description}</p>
                
                {/* Voting Section */}
                {idea.status !== 'Implemented' && idea.status !== 'Rejected' && (
                  <div className="flex items-center space-x-4">
                    <span className="text-sm font-medium text-gray-700">Vote with points:</span>
                    <div className="flex space-x-2">
                      {[1, 2, 3, 4, 5].map(points => {
                        const currentVote = getUserVoteForIdea(idea.id);
                        const pointsDifference = points - currentVote;
                        const canVote = monthlyPoints && pointsDifference <= monthlyPoints.remainingPoints;
                        
                        return (
                          <button
                            key={points}
                            onClick={() => handleVote(idea.id, points)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                              currentVote === points
                                ? 'bg-[#e40115] text-white'
                                : canVote
                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                : 'bg-gray-300 text-gray-500'
                            }`}
                            disabled={!canVote}
                          >
                            {points}
                          </button>
                        );
                      })}
                    </div>
                    <span className="text-xs text-gray-500">
                      Your vote: {getUserVoteForIdea(idea.id)} points
                    </span>
                  </div>
                )}

                {idea.status === 'Rejected' && idea.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-3">
                    <h4 className="font-medium text-red-900 mb-1">Rejection Reason:</h4>
                    <p className="text-red-800 text-sm">{idea.rejectionReason}</p>
                  </div>
                )}

                {idea.status === 'Implemented' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                    <h4 className="font-medium text-green-900 mb-1">✅ Implemented!</h4>
                    <p className="text-green-800 text-sm">
                      This idea has been implemented and is now available in the application.
                    </p>
                    {idea.implementedAt && (
                      <p className="text-green-600 text-xs mt-1">
                        Implemented on {new Date(idea.implementedAt).toLocaleDateString()}
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
