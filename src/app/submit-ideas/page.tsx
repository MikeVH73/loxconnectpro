"use client";
import { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { collection, addDoc, query, orderBy, onSnapshot, where, doc, updateDoc, getDocs, writeBatch } from 'firebase/firestore';
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
  category: 'Dashboard' | 'Planning' | 'Quote Requests' | 'Archived' | 'Customers' | 'Notifications' | 'Analytics' | 'FAQs';
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
  attachments?: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
    uploadedAt: Date;
    uploadedBy: string;
  }>;
}

export default function SubmitIdeasPage() {
  const { userProfile } = useAuth();
  const [ideas, setIdeas] = useState<LocalIdea[]>([]);
  const [filteredIdeas, setFilteredIdeas] = useState<LocalIdea[]>([]);
  const [userLikes, setUserLikes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: 'Dashboard' as const,
    title: '',
    description: ''
  });
  const [rejectionReason, setRejectionReason] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [userNotifications, setUserNotifications] = useState<any[]>([]);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [dateFilter, setDateFilter] = useState<string>('All');

  // Load ideas - show all for superAdmin, only approved for others
  useEffect(() => {
    if (!db || !userProfile) return;

    // For now, load all ideas and filter client-side to avoid Firebase index issues
    const ideasQuery = query(
      collection(db!, 'ideas'),
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

  // Apply filters whenever ideas or filter states change
  useEffect(() => {
    let filtered = [...ideas];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(idea => 
        idea.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        idea.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        idea.userEmail.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(idea => {
        const mappedCategory = mapLegacyToNewCategory(idea.category, idea.title, idea.description);
        return mappedCategory === categoryFilter;
      });
    }

    // Status filter
    if (statusFilter !== 'All') {
      filtered = filtered.filter(idea => idea.status === statusFilter);
    }

    // Date filter
    if (dateFilter !== 'All') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case 'Today':
          filterDate.setHours(0, 0, 0, 0);
          filtered = filtered.filter(idea => idea.createdAt >= filterDate);
          break;
        case 'This Week':
          filterDate.setDate(now.getDate() - 7);
          filtered = filtered.filter(idea => idea.createdAt >= filterDate);
          break;
        case 'This Month':
          filterDate.setMonth(now.getMonth() - 1);
          filtered = filtered.filter(idea => idea.createdAt >= filterDate);
          break;
        case 'Last 3 Months':
          filterDate.setMonth(now.getMonth() - 3);
          filtered = filtered.filter(idea => idea.createdAt >= filterDate);
          break;
      }
    }

    // Sort by likes within each category (highest likes first)
    filtered = filtered.sort((a, b) => (b.likeCount || 0) - (a.likeCount || 0));

    setFilteredIdeas(filtered);
  }, [ideas, searchTerm, categoryFilter, statusFilter, dateFilter]);

  // Load user's likes
  useEffect(() => {
    if (!db || !userProfile) return;

    const likesQuery = query(
      collection(db!, 'ideaLikes'),
      where('userId', '==', userProfile.id)
    );

    const unsubscribe = onSnapshot(likesQuery, (snapshot) => {
      const likedIdeas = snapshot.docs
        .filter(doc => !doc.data().deleted) // Filter out deleted likes
        .map(doc => doc.data().ideaId);
      setUserLikes(likedIdeas);
    });

    return () => unsubscribe();
  }, [userProfile]);

  // Clean up any existing negative like counts and fix like counts (one-time fix)
  useEffect(() => {
    if (!db || !userProfile || userProfile.role !== 'superAdmin') return;

    const fixLikeSystem = async () => {
      try {
        // Fix negative like counts
        const ideasSnapshot = await getDocs(collection(db!, 'ideas'));
        const batch = writeBatch(db!);
        let hasUpdates = false;

        ideasSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.likeCount < 0) {
            batch.update(doc.ref, { likeCount: 0 });
            hasUpdates = true;
            console.log(`Fixed negative like count for idea: ${doc.id}`);
          }
        });

        // Fix like counts by counting actual like documents
        for (const ideaDoc of ideasSnapshot.docs) {
          const ideaId = ideaDoc.id;
          const ideaData = ideaDoc.data();
          
          // Count actual likes for this idea
          const likesQuery = query(
            collection(db!, 'ideaLikes'),
            where('ideaId', '==', ideaId),
            where('deleted', '!=', true)
          );
          const likesSnapshot = await getDocs(likesQuery);
          const actualLikeCount = likesSnapshot.size;
          
          // Update if count doesn't match
          if (ideaData.likeCount !== actualLikeCount) {
            batch.update(ideaDoc.ref, { likeCount: actualLikeCount });
            hasUpdates = true;
            console.log(`Fixed like count for idea ${ideaId}: ${ideaData.likeCount} → ${actualLikeCount}`);
          }
        }

        if (hasUpdates) {
          await batch.commit();
          console.log('Fixed all like counts');
        }
      } catch (error) {
        console.error('Error fixing like system:', error);
      }
    };

    fixLikeSystem();
  }, [db, userProfile]);

  // Load user's idea notifications
  useEffect(() => {
    if (!db || !userProfile) return;

    const notificationsQuery = query(
      collection(db!, 'notifications'),
      where('userId', '==', userProfile.id),
      where('type', 'in', ['idea_approved', 'idea_rejected', 'idea_implemented']),
      where('read', '==', false),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      }));
      setUserNotifications(notifications);
    });

    return () => unsubscribe();
  }, [userProfile]);

  const handleLikeIdea = async (ideaId: string) => {
    if (!db || !userProfile) return;

    // Check if user has already liked this idea
    const isLiked = userLikes.includes(ideaId);
    
    // If already liked, do nothing (prevent multiple likes)
    if (isLiked) {
      return;
    }
    
    try {
      // Create new like document
      await addDoc(collection(db!, 'ideaLikes'), {
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
        userRole: userProfile.role,
        title: formData.title,
        description: formData.description,
        category: formData.category,
        status: 'Pending Approval',
        likeCount: 0,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db!, 'ideas'), ideaData);
      
      // Create notification for all superAdmins about new idea
      const superAdminsQuery = query(
        collection(db!, 'users'),
        where('role', '==', 'superAdmin')
      );
      const superAdminsSnapshot = await getDocs(superAdminsQuery);
      
      const notificationPromises = superAdminsSnapshot.docs.map(superAdminDoc => 
        addDoc(collection(db!, 'notifications'), {
          type: 'new_idea',
          title: 'New Idea Submitted',
          message: `New idea "${formData.title}" submitted by ${userProfile.email}`,
          userId: superAdminDoc.id,
          userEmail: superAdminDoc.data().email,
          ideaId: docRef.id,
          ideaTitle: formData.title,
          ideaCategory: formData.category,
          createdAt: new Date(),
          read: false
        })
      );
      
      await Promise.all(notificationPromises);
      
      setFormData({ category: 'Dashboard', title: '', description: '' });
      setAttachments([]);
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
      
      // Create notification for the idea submitter
      const idea = ideas.find(i => i.id === ideaId);
      if (idea) {
        await addDoc(collection(db!, 'notifications'), {
          type: 'idea_implemented',
          title: 'Your idea is being implemented!',
          message: `Great news! Your idea "${idea.title}" is now being implemented by our development team.`,
          userId: idea.userId,
          userEmail: idea.userEmail,
          ideaId: ideaId,
          ideaTitle: idea.title,
          implementedBy: userProfile.email,
          createdAt: new Date(),
          read: false
        });
      }
      
      alert('Idea marked as being implemented! The submitter will be notified.');
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
      
      // Create notification for the idea submitter
      const idea = ideas.find(i => i.id === ideaId);
      if (idea) {
        await addDoc(collection(db!, 'notifications'), {
          type: 'idea_approved',
          title: 'Your idea was approved!',
          message: `Your idea "${idea.title}" has been approved and is now visible to all users.`,
          userId: idea.userId,
          userEmail: idea.userEmail,
          ideaId: ideaId,
          ideaTitle: idea.title,
          approvedBy: userProfile.email,
          createdAt: new Date(),
          read: false
        });
      }
      
      alert('Idea approved successfully! The submitter will be notified.');
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
        await addDoc(collection(db!, 'notifications'), {
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const clearNotification = async (notificationId: string) => {
    if (!db || !userProfile) return;
    
    try {
      await updateDoc(doc(db!, 'notifications', notificationId), {
        read: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error clearing notification:', error);
    }
  };

  const clearAllNotifications = async () => {
    if (!db || !userProfile) return;
    
    try {
      const unreadNotifications = userNotifications.filter(n => !n.read);
      const updatePromises = unreadNotifications.map(notification => 
        updateDoc(doc(db!, 'notifications', notification.id), {
          read: true,
          readAt: new Date()
        })
      );
      await Promise.all(updatePromises);
    } catch (error) {
      console.error('Error clearing all notifications:', error);
    }
  };

  // Migration function to update existing ideas with new categories
  const migrateIdeasToNewCategories = async () => {
    if (!db || !userProfile || userProfile.role !== 'superAdmin') return;
    
    try {
      console.log('Starting idea category migration...');
      const ideasSnapshot = await getDocs(collection(db, 'ideas'));
      const batch = writeBatch(db);
      let updateCount = 0;
      
      ideasSnapshot.forEach((doc) => {
        const idea = doc.data();
        const currentCategory = idea.category;
        const newCategory = mapLegacyToNewCategory(currentCategory, idea.title, idea.description);
        
        // Only update if category changed
        if (currentCategory !== newCategory) {
          batch.update(doc.ref, { category: newCategory });
          updateCount++;
          console.log(`Migrating idea "${idea.title}" from "${currentCategory}" to "${newCategory}"`);
        }
      });
      
      if (updateCount > 0) {
        await batch.commit();
        console.log(`Migration completed: ${updateCount} ideas updated`);
        alert(`Migration completed: ${updateCount} ideas updated with new categories`);
      } else {
        console.log('No ideas needed migration');
        alert('All ideas already use the new category system');
      }
    } catch (error) {
      console.error('Migration failed:', error);
      alert('Migration failed. Please try again.');
    }
  };

  const openAttachment = (attachment: any) => {
    window.open(attachment.url, '_blank');
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('text')) return '📃';
    return '📎';
  };

  // Function to map legacy categories to new categories
  const mapLegacyToNewCategory = (legacyCategory: string, title: string, description: string): string => {
    const content = `${title} ${description}`.toLowerCase();
    
    // Map legacy categories to new ones based on content analysis
    switch (legacyCategory) {
      case 'Bug Report':
        // Bug reports about specific features go to that feature's category
        if (content.includes('dashboard') || content.includes('analytics') || content.includes('chart')) return 'Analytics';
        if (content.includes('quote') || content.includes('qr')) return 'Quote Requests';
        if (content.includes('customer')) return 'Customers';
        if (content.includes('notification') || content.includes('message')) return 'Notifications';
        if (content.includes('planning') || content.includes('schedule')) return 'Planning';
        if (content.includes('archive') || content.includes('old')) return 'Archived';
        if (content.includes('faq') || content.includes('help')) return 'FAQs';
        return 'Dashboard'; // Default for general bugs
        
      case 'Improvement':
        // Improvements to specific features
        if (content.includes('dashboard') || content.includes('analytics') || content.includes('chart')) return 'Analytics';
        if (content.includes('quote') || content.includes('qr')) return 'Quote Requests';
        if (content.includes('customer')) return 'Customers';
        if (content.includes('notification') || content.includes('message')) return 'Notifications';
        if (content.includes('planning') || content.includes('schedule')) return 'Planning';
        if (content.includes('archive') || content.includes('old')) return 'Archived';
        if (content.includes('faq') || content.includes('help')) return 'FAQs';
        return 'Dashboard'; // Default for general improvements
        
      case 'New Feature':
        // New features for specific areas
        if (content.includes('dashboard') || content.includes('analytics') || content.includes('chart')) return 'Analytics';
        if (content.includes('quote') || content.includes('qr')) return 'Quote Requests';
        if (content.includes('customer')) return 'Customers';
        if (content.includes('notification') || content.includes('message')) return 'Notifications';
        if (content.includes('planning') || content.includes('schedule')) return 'Planning';
        if (content.includes('archive') || content.includes('old')) return 'Archived';
        if (content.includes('faq') || content.includes('help')) return 'FAQs';
        return 'Dashboard'; // Default for general new features
        
      case 'Design Issue':
        // Design issues can be in any category, analyze content
        if (content.includes('dashboard') || content.includes('analytics') || content.includes('chart')) return 'Analytics';
        if (content.includes('quote') || content.includes('qr')) return 'Quote Requests';
        if (content.includes('customer')) return 'Customers';
        if (content.includes('notification') || content.includes('message')) return 'Notifications';
        if (content.includes('planning') || content.includes('schedule')) return 'Planning';
        if (content.includes('archive') || content.includes('old')) return 'Archived';
        if (content.includes('faq') || content.includes('help')) return 'FAQs';
        return 'Dashboard'; // Default for general design issues
        
      case 'Performance':
        // Performance issues can be in any category, analyze content
        if (content.includes('dashboard') || content.includes('analytics') || content.includes('chart')) return 'Analytics';
        if (content.includes('quote') || content.includes('qr')) return 'Quote Requests';
        if (content.includes('customer')) return 'Customers';
        if (content.includes('notification') || content.includes('message')) return 'Notifications';
        if (content.includes('planning') || content.includes('schedule')) return 'Planning';
        if (content.includes('archive') || content.includes('old')) return 'Archived';
        if (content.includes('faq') || content.includes('help')) return 'FAQs';
        return 'Dashboard'; // Default for general performance issues
        
      default:
        // If it's already a new category, return as-is
        if (['Dashboard', 'Planning', 'Quote Requests', 'Archived', 'Customers', 'Notifications', 'Analytics', 'FAQs'].includes(legacyCategory)) {
          return legacyCategory;
        }
        return 'Dashboard'; // Default fallback
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      // New categories (menu-based)
      case 'Dashboard': return 'bg-blue-100 text-blue-800';
      case 'Planning': return 'bg-purple-100 text-purple-800';
      case 'Quote Requests': return 'bg-green-100 text-green-800';
      case 'Archived': return 'bg-gray-100 text-gray-800';
      case 'Customers': return 'bg-orange-100 text-orange-800';
      case 'Notifications': return 'bg-yellow-100 text-yellow-800';
      case 'Analytics': return 'bg-indigo-100 text-indigo-800';
      case 'FAQs': return 'bg-pink-100 text-pink-800';
      
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
      <div className="w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Submit Ideas</h1>
          <p className="text-gray-600">Share your ideas to improve LoxConnect PRO. Ideas are reviewed by superAdmins before being visible to all users.</p>
        </div>

        {/* Submit Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-[#e40115] text-white px-8 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors text-lg"
          >
            {showForm ? 'Cancel' : 'Submit New Idea'}
          </button>
        </div>
        
        {/* Search and Filter Controls */}
        <div className="mb-6 bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Search & Filter Ideas</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="relative lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <input
                type="text"
                placeholder="Search ideas by title, description, or submitter..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e40115] w-full"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
            
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e40115] w-full"
              >
                <option value="All">All Categories</option>
                <option value="Dashboard">Dashboard</option>
                <option value="Planning">Planning</option>
                <option value="Quote Requests">Quote Requests</option>
                <option value="Archived">Archived</option>
                <option value="Customers">Customers</option>
                <option value="Notifications">Notifications</option>
                <option value="Analytics">Analytics</option>
                <option value="FAQs">FAQs</option>
              </select>
            </div>
            
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e40115] w-full"
              >
                <option value="All">All Status</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Being Implemented">Being Implemented</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            
            {/* Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#e40115] w-full"
              >
                <option value="All">All Time</option>
                <option value="Today">Today</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Last 3 Months">Last 3 Months</option>
              </select>
            </div>
          </div>
          
          {/* Clear Filters */}
          {(searchTerm || categoryFilter !== 'All' || statusFilter !== 'All' || dateFilter !== 'All') && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('All');
                  setStatusFilter('All');
                  setDateFilter('All');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear All Filters
              </button>
            </div>
          )}
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
                  <option value="Dashboard">Dashboard</option>
                  <option value="Planning">Planning</option>
                  <option value="Quote Requests">Quote Requests</option>
                  <option value="Archived">Archived</option>
                  <option value="Customers">Customers</option>
                  <option value="Notifications">Notifications</option>
                  <option value="Analytics">Analytics</option>
                  <option value="FAQs">FAQs</option>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attachments (Optional)
                </label>
                <div className="space-y-3">
                  <input
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#e40115]"
                    accept="image/*,.pdf,.doc,.docx,.txt"
                  />
                  <p className="text-sm text-gray-500">
                    You can attach images, PDFs, or documents to help illustrate your idea. Max 10MB per file.
                  </p>
                  
                  {/* Display selected files */}
                  {attachments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Selected files:</p>
                      {attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded-md">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">{file.name}</span>
                            <span className="text-xs text-gray-500">({formatFileSize(file.size)})</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeAttachment(index)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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

        {/* Results Counter */}
        <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <span className="text-blue-800 font-semibold text-lg">
                Showing {filteredIdeas.length} of {ideas.length} ideas
              </span>
              {(searchTerm || categoryFilter !== 'All' || statusFilter !== 'All' || dateFilter !== 'All') && (
                <span className="text-blue-600 text-sm bg-blue-100 px-3 py-1 rounded-full">
                  Filtered by: {[
                    searchTerm && 'search',
                    categoryFilter !== 'All' && 'category',
                    statusFilter !== 'All' && 'status',
                    dateFilter !== 'All' && 'date'
                  ].filter(Boolean).join(', ')}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-blue-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium">Approved: {filteredIdeas.filter(i => i.status === 'Approved').length}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="font-medium">Being Implemented: {filteredIdeas.filter(i => i.status === 'Being Implemented').length}</span>
              </div>
              {userProfile?.role === 'superAdmin' && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="font-medium">Pending: {filteredIdeas.filter(i => i.status === 'Pending Approval').length}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* User Notifications Section */}
        {userNotifications.length > 0 && (
          <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-green-800">📬 Your Idea Updates</h3>
              <button
                onClick={clearAllNotifications}
                className="text-sm text-green-600 hover:text-green-800 font-medium"
              >
                Clear All
              </button>
            </div>
            <div className="space-y-3">
              {userNotifications.map((notification) => (
                <div key={notification.id} className="bg-white rounded-lg p-4 border-l-4 border-green-500">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{notification.title}</h4>
                      <p className="text-gray-600 text-sm mt-1">{notification.message}</p>
                      <p className="text-gray-500 text-xs mt-2">
                        {notification.createdAt instanceof Date ? notification.createdAt.toLocaleDateString() : new Date(notification.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="ml-4 flex items-center space-x-2">
                      {notification.type === 'idea_approved' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          ✅ Approved
                        </span>
                      )}
                      {notification.type === 'idea_rejected' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          ❌ Rejected
                        </span>
                      )}
                      {notification.type === 'idea_implemented' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          🚀 Implemented
                        </span>
                      )}
                      <button
                        onClick={() => clearNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600 text-sm"
                        title="Clear notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kanban Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-12">
          {/* Left Column: Ideas */}
          <div className="min-h-[600px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">💡 Ideas</h2>
              <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {filteredIdeas.filter(idea => idea.status === 'Approved').length} approved
              </div>
            </div>
            <div className="space-y-4">
              {filteredIdeas.filter(idea => idea.status === 'Approved').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No approved ideas found.</p>
                </div>
              ) : (
                filteredIdeas.filter(idea => idea.status === 'Approved').map((idea, index) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-gray-600">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{idea.title}</h3>
                          <p className="text-gray-600 text-sm leading-relaxed">{idea.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleLikeIdea(idea.id)}
                            disabled={userLikes.includes(idea.id)}
                            className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                              userLikes.includes(idea.id)
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-red-50 hover:bg-red-100 text-red-600'
                            }`}
                          >
                            <span>{userLikes.includes(idea.id) ? '❤️' : '🤍'}</span>
                            <span>{Math.max(0, idea.likeCount || 0)} likes</span>
                          </button>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(mapLegacyToNewCategory(idea.category, idea.title, idea.description))}`}>
                            {mapLegacyToNewCategory(idea.category, idea.title, idea.description)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(idea.status)}`}>
                            {idea.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Attachments Display - Compact */}
                    {idea.attachments && idea.attachments.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {idea.attachments.map((attachment, attachIndex) => (
                            <button
                              key={attachIndex}
                              onClick={() => openAttachment(attachment)}
                              className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 text-xs transition-colors"
                            >
                              <span>{getFileIcon(attachment.type)}</span>
                              <span className="text-gray-700">{attachment.name}</span>
                              <span className="text-gray-500">({formatFileSize(attachment.size)})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex space-x-4">
                        <span>Submitted by: {idea.userEmail}</span>
                        <span>Approved by: {idea.approvedBy || 'N/A'}</span>
                        <span>Date: {new Date(idea.createdAt).toLocaleDateString()}</span>
                      </div>
                      {userProfile?.role === 'superAdmin' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleImplementIdea(idea.id)}
                            className="px-3 py-1 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 transition-colors"
                          >
                            Start Implementing
                          </button>
                          <button
                            onClick={() => handleDeleteIdea(idea.id)}
                            className="px-3 py-1 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Being Implemented */}
          <div className="min-h-[600px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-900">🚀 Being Implemented</h2>
              <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                {filteredIdeas.filter(idea => idea.status === 'Being Implemented').length} in progress
              </div>
            </div>
            <div className="space-y-4">
              {filteredIdeas.filter(idea => idea.status === 'Being Implemented').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No ideas being implemented found.</p>
                </div>
              ) : (
                filteredIdeas.filter(idea => idea.status === 'Being Implemented').map((idea, index) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-4 border-l-4 border-purple-500 hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center space-x-3 flex-1">
                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-gray-900 mb-1">{idea.title}</h3>
                          <p className="text-gray-600 text-sm leading-relaxed">{idea.description}</p>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-2 ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-1 bg-purple-50 text-purple-600 px-3 py-1 rounded-full text-sm font-medium">
                            <span>{Math.max(0, idea.likeCount || 0)} likes received</span>
                          </div>
                        </div>
                        <div className="flex flex-col space-y-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(mapLegacyToNewCategory(idea.category, idea.title, idea.description))}`}>
                            {mapLegacyToNewCategory(idea.category, idea.title, idea.description)}
                          </span>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(idea.status)}`}>
                            {idea.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Attachments Display - Compact */}
                    {idea.attachments && idea.attachments.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {idea.attachments.map((attachment, attachIndex) => (
                            <button
                              key={attachIndex}
                              onClick={() => openAttachment(attachment)}
                              className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 rounded px-2 py-1 text-xs transition-colors"
                            >
                              <span>{getFileIcon(attachment.type)}</span>
                              <span className="text-gray-700">{attachment.name}</span>
                              <span className="text-gray-500">({formatFileSize(attachment.size)})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex space-x-4">
                        <span>Submitted by: {idea.userEmail}</span>
                        <span>Being implemented by: {idea.implementedBy || 'N/A'}</span>
                        <span>Date: {new Date(idea.createdAt).toLocaleDateString()}</span>
                      </div>
                      {userProfile?.role === 'superAdmin' && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleDeleteIdea(idea.id)}
                            className="px-3 py-1 bg-gray-600 text-white rounded text-xs font-medium hover:bg-gray-700 transition-colors"
                          >
                            Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* SuperAdmin Tools */}
        {userProfile?.role === 'superAdmin' && (
          <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-yellow-800 mb-3">🛠️ Admin Tools</h3>
            <div className="flex gap-3">
              <button
                onClick={migrateIdeasToNewCategories}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
              >
                Migrate Ideas to New Categories
              </button>
              <p className="text-sm text-yellow-700 flex items-center">
                This will update all existing ideas to use the new menu-based categories instead of legacy ones.
              </p>
            </div>
          </div>
        )}

        {/* SuperAdmin Section: Pending Approval */}
        {userProfile?.role === 'superAdmin' && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">⏳ Pending Approval</h2>
            <div className="space-y-4">
              {filteredIdeas.filter(idea => idea.status === 'Pending Approval').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No ideas pending approval found.</p>
                </div>
              ) : (
                filteredIdeas.filter(idea => idea.status === 'Pending Approval').map((idea) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{idea.title}</h3>
                        <p className="text-gray-600 mb-4">{idea.description}</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(mapLegacyToNewCategory(idea.category, idea.title, idea.description))}`}>
                          {mapLegacyToNewCategory(idea.category, idea.title, idea.description)}
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

        {/* SuperAdmin Section: Archived Ideas */}
        {userProfile?.role === 'superAdmin' && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-gray-900 mb-6">🗄️ Archived Ideas</h2>
            <div className="space-y-4">
              {ideas.filter(idea => idea.status === 'Archived' || idea.status === 'Rejected').length === 0 ? (
                <div className="text-center py-8 bg-white rounded-lg shadow-md">
                  <p className="text-gray-500">No archived ideas found.</p>
                </div>
              ) : (
                ideas.filter(idea => idea.status === 'Archived' || idea.status === 'Rejected').map((idea) => (
                  <div key={idea.id} className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-500 opacity-75">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">{idea.title}</h3>
                        <p className="text-gray-600 mb-4">{idea.description}</p>
                      </div>
                      <div className="flex flex-col space-y-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCategoryColor(mapLegacyToNewCategory(idea.category, idea.title, idea.description))}`}>
                          {mapLegacyToNewCategory(idea.category, idea.title, idea.description)}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(idea.status)}`}>
                          {idea.status}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-500 mb-4">
                      <p>Submitted by: {idea.userEmail}</p>
                      <p>Date: {idea.createdAt instanceof Date ? idea.createdAt.toLocaleDateString() : new Date(idea.createdAt).toLocaleDateString()}</p>
                      {idea.rejectedBy && (
                        <p className="text-red-600 font-medium">Rejected by: {idea.rejectedBy}</p>
                      )}
                      {idea.deletedBy && (
                        <p className="text-gray-600 font-medium">Archived by: {idea.deletedBy}</p>
                      )}
                      {idea.rejectionReason && (
                        <p className="text-red-600 italic">Reason: {idea.rejectionReason}</p>
                      )}
                    </div>
                    
                    {/* Show like count for archived ideas */}
                    {idea.likeCount && idea.likeCount > 0 && (
                      <div className="mb-4">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600">{Math.max(0, idea.likeCount || 0)}</div>
                          <div className="text-sm text-gray-500">likes received</div>
                        </div>
                      </div>
                    )}
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