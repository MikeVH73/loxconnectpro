"use client";
import React, { useState, useEffect, useRef } from "react";
import { collection, getDocs, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseClient";
import { useAuth } from "../AuthProvider";
import DashboardFileSharing from "../components/DashboardFileSharing";
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

interface QuoteRequest {
  id: string;
  title: string;
  creatorCountry: string;
  involvedCountry: string;
  customer: string;
  status: string;
}

interface Message {
  id: string;
  senderCountry: string;
  text: string;
  timestamp: any;
  status?: string;
  file?: {
    id: string;
    name: string;
    url: string;
    type: string;
    size: number;
  };
}

interface FileData {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
  uploadedBy: string;
  uploadedByCountry: string;
}

// GeneralMessage interface removed - no longer needed

// Quote Request List Component
const QuoteRequestList = ({ onSelect, selectedId, quoteRequests, userCountries, customers, unreadCounts, lastMessageTimes }: any) => {
  const getCountryCodes = (creatorCountry: string, involvedCountry: string) => {
    const codeMap: any = {
      'Netherlands': 'NL',
      'Germany': 'DE', 
      'France': 'FR',
      'Switzerland': 'CH',
      'UK': 'GB'
    };
    return {
      creator: codeMap[creatorCountry] || creatorCountry.substring(0, 2).toUpperCase(),
      involved: codeMap[involvedCountry] || involvedCountry.substring(0, 2).toUpperCase()
    };
  };

  const getCountryFlags = (creatorCountry: string, involvedCountry: string) => {
    const flagMap: any = {
      'Netherlands': '🇳🇱',
      'Germany': '🇩🇪', 
      'France': '🇫🇷',
      'Switzerland': '🇨🇭',
      'UK': '🇬🇧'
    };
    return {
      creator: flagMap[creatorCountry] || '🏳️',
      involved: flagMap[involvedCountry] || '🏳️'
    };
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find((c: any) => c.id === customerId);
    return customer?.name || 'Unknown Customer';
  };

  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'No activity';
    
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).fromNow();
    } catch (error) {
      return 'No activity';
    }
  };

  return (
    <div className="w-[420px] border-r h-full overflow-y-auto bg-gray-50">
      <div className="p-5 border-b bg-white shadow-sm">
        <h3 className="font-bold text-gray-900 text-lg">Conversations</h3>
        <p className="text-sm text-gray-500 mt-1">{quoteRequests.length} active chats</p>
      </div>
      
      <div className="p-3 space-y-2">
        {quoteRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-2xl mb-2">💬</div>
            <p className="text-sm">No active conversations</p>
          </div>
        ) : (
          quoteRequests.map((qr: QuoteRequest) => {
            const countryCodes = getCountryCodes(qr.creatorCountry, qr.involvedCountry);
            const countryFlags = getCountryFlags(qr.creatorCountry, qr.involvedCountry);
            const isSelected = selectedId === qr.id;
            
            return (
              <div
                key={qr.id}
                onClick={() => onSelect(qr.id)}
                className={`
                  relative p-4 rounded-lg cursor-pointer transition-all duration-200 
                  border border-transparent hover:border-gray-200 hover:shadow-sm
                  ${isSelected 
                    ? 'bg-blue-50 border-blue-200 shadow-md ring-2 ring-blue-100' 
                    : 'bg-white hover:bg-gray-50'
                  }
                `}
              >
                {/* Header with title and countries */}
                                 <div className="flex items-start justify-between mb-3">
                   <div className="flex-1 min-w-0">
                     <h4 
                       className="font-semibold text-gray-900 text-sm leading-tight mb-1 pr-2"
                       title={qr.title}
                     >
                       {qr.title}
                     </h4>
                     <p className="text-sm font-medium text-gray-700 mb-2">
                       {getCustomerName(qr.customer)}
                     </p>
                     <div className="flex items-center gap-2 text-xs text-gray-600">
                       <span className="flex items-center gap-1">
                         {countryFlags.creator} {countryCodes.creator}
                       </span>
                       <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                       </svg>
                       <span className="flex items-center gap-1">
                         {countryFlags.involved} {countryCodes.involved}
                       </span>
                     </div>
                   </div>
                  
                  {/* Status badge */}
                  <span className={`
                    flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ml-2
                    ${qr.status === 'In Progress' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                      qr.status === 'Snoozed' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                      'bg-gray-100 text-gray-700 border border-gray-200'
                    }
                  `}>
                    {qr.status === 'In Progress' ? '🟢' : qr.status === 'Snoozed' ? '😴' : '⏸️'} {qr.status}
                  </span>
                </div>

                {/* Footer with metadata */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span className="truncate">
                    Last activity: {getRelativeTime(lastMessageTimes[qr.id])}
                  </span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Unread indicator */}
                    {unreadCounts[qr.id] > 0 && (
                      <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[20px] text-center">
                        {unreadCounts[qr.id]}
                      </span>
                    )}
                  </div>
                </div>

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute left-0 top-4 bottom-4 w-1 bg-blue-500 rounded-r"></div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// Chat Window Component  
const ChatWindow = ({ quoteRequestId, userCountries, userProfile, onBack }: any) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QuoteRequest | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  // Determine user's country for sending messages
  const getUserSendingCountry = () => {
    if (!selectedQR || !userCountries.length) return userCountries[0] || "Unknown";
    
    // If user has both countries, prefer the one that matches the QR
    if (userCountries.includes(selectedQR.creatorCountry)) return selectedQR.creatorCountry;
    if (userCountries.includes(selectedQR.involvedCountry)) return selectedQR.involvedCountry;
    
    return userCountries[0]; // fallback
  };

  // Format timestamp to relative time
  const getRelativeTime = (timestamp: any) => {
    if (!timestamp) return 'Sending...';
    
    try {
      const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
      return dayjs(date).fromNow();
    } catch (error) {
      return 'Unknown time';
    }
  };

  // Play notification sound for new messages
  const playNotificationSound = () => {
    try {
      const notificationSound = new Audio("/notify.mp3");
      notificationSound.play().catch(error => {
        console.log("Audio notification blocked by browser:", error);
      });
    } catch (error) {
      console.log("Audio notification not available:", error);
    }
  };

  // Fetch Quote Request details
  useEffect(() => {
    if (!quoteRequestId) {
      setSelectedQR(null);
      return;
    }

    const fetchQR = async () => {
      try {
        const qrSnap = await getDocs(collection(db, "quoteRequests"));
        const qr = qrSnap.docs.find(doc => doc.id === quoteRequestId);
        if (qr) {
          setSelectedQR({ id: qr.id, ...qr.data() } as QuoteRequest);
        }
      } catch (error) {
        console.error("Error fetching quote request:", error);
      }
    };

    fetchQR();
  }, [quoteRequestId]);

  // Listen to messages in real-time
  useEffect(() => {
    if (!quoteRequestId) {
      setMessages([]);
      setLastMessageCount(0);
      return;
    }

    // Reset message count when switching conversations
    setLastMessageCount(0);
    
    const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"), limit(50));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      console.log(`📬 Real-time update: ${messagesList.length} messages loaded for QR ${quoteRequestId}`);
      console.log(`👥 User countries:`, userCountries);
      console.log(`💬 Messages:`, messagesList.map(m => `${m.senderCountry}: ${m.text}`));
      
      // Check for new messages from other countries and play notification
      if (lastMessageCount > 0 && messagesList.length > lastMessageCount) {
        const newMessages = messagesList.slice(lastMessageCount);
        const hasNewMessageFromOthers = newMessages.some(msg => 
          !userCountries.includes(msg.senderCountry)
        );
        
        if (hasNewMessageFromOthers) {
          console.log("🔊 Playing notification sound for new message");
          playNotificationSound();
        }
      }
      
      setMessages(messagesList);
      setLastMessageCount(messagesList.length);
    });

    return () => unsubscribe();
  }, [quoteRequestId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !quoteRequestId || loading) return;

    setLoading(true);
    try {
      const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
      const messageData = {
        senderCountry: getUserSendingCountry(),
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        status: 'delivered' // Add delivery status
      };
      
      console.log(`📨 Sending message from ${messageData.senderCountry}:`, messageData.text);
      console.log(`📍 Firestore path: quoteRequests/${quoteRequestId}/messages`);
      
      await addDoc(messagesRef, messageData);
      setNewMessage("");
      
      console.log("✅ Message sent successfully");
    } catch (error) {
      console.error("❌ Error sending message:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleFileShared = async (fileData: FileData) => {
    if (!quoteRequestId) return;
    
    try {
      const messagesRef = collection(db, "quoteRequests", quoteRequestId, "messages");
      await addDoc(messagesRef, {
        senderCountry: getUserSendingCountry(),
        text: `📎 Shared a file: ${fileData.name}`,
        timestamp: serverTimestamp(),
        status: 'delivered',
        file: {
          id: fileData.id,
          name: fileData.name,
          url: fileData.url,
          type: fileData.type,
          size: fileData.size,
        },
      });
    } catch (error) {
      console.error("Error sharing file:", error);
      alert("Failed to share file. Please try again.");
    }
  };

  const downloadFile = (file: any) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('sheet')) return '📊';
    return '📎';
  };

  const isImageFile = (type: string) => type.startsWith('image/');

  if (!quoteRequestId) {
    return (
      <div className="flex-1 h-full bg-gray-50">
      </div>
    );
  }

  const isArchived = selectedQR && ['Won', 'Lost', 'Cancelled'].includes(selectedQR.status);

  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Chat Header */}
      <div className="p-5 border-b bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              title="Back to conversations"
            >
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-gray-900 text-lg truncate" title={selectedQR?.title}>
                {selectedQR?.title || "Loading..."}
              </h3>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                <span className="flex items-center gap-1">
                  {selectedQR?.creatorCountry}
                </span>
                <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
                <span className="flex items-center gap-1">
                  {selectedQR?.involvedCountry}
                </span>
              </div>
            </div>
          </div>
          {isArchived && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium border border-red-200">
              🔒 Archived
            </span>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => {
          const isMyCountry = userCountries.includes(message.senderCountry);
          return (
            <div
              key={message.id}
              className={`flex ${isMyCountry ? 'justify-end' : 'justify-start'} animate-fade-in`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow-sm transition-all duration-200 hover:shadow-md ${
                  isMyCountry
                    ? 'bg-[#e40115] text-white'
                    : 'bg-gray-200 text-gray-800'
                }`}
              >
                <div className="text-sm">{message.text}</div>
                
                {/* File attachment */}
                {message.file && (
                  <div className={`mt-2 border rounded p-3 ${
                    isMyCountry ? 'border-red-300 bg-red-600' : 'border-gray-300 bg-gray-100'
                  }`}>
                    {isImageFile(message.file.type) ? (
                      <div className="space-y-2">
                        <img 
                          src={message.file.url} 
                          alt={message.file.name}
                          className="max-w-full h-auto rounded cursor-pointer hover:opacity-90"
                          onClick={() => downloadFile(message.file)}
                          style={{ maxHeight: '200px' }}
                        />
                        <div className={`text-xs ${isMyCountry ? 'text-red-100' : 'text-gray-600'}`}>
                          {message.file.name} • {formatFileSize(message.file.size)}
                        </div>
                      </div>
                    ) : (
                      <div 
                        className="flex items-center space-x-3 cursor-pointer hover:opacity-80"
                        onClick={() => downloadFile(message.file)}
                      >
                        <div className="text-2xl">{getFileIcon(message.file.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium truncate ${
                            isMyCountry ? 'text-white' : 'text-gray-900'
                          }`}>
                            {message.file.name}
                          </div>
                          <div className={`text-xs ${
                            isMyCountry ? 'text-red-100' : 'text-gray-500'
                          }`}>
                            {formatFileSize(message.file.size)} • Click to download
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className={`text-xs mt-1 flex items-center justify-between ${isMyCountry ? 'text-red-100' : 'text-gray-500'}`}>
                  <span>
                    {message.senderCountry} • {getRelativeTime(message.timestamp)}
                  </span>
                  {isMyCountry && message.status && (
                    <span className="ml-2">
                      {message.status === 'delivered' ? '✓' : '⏳'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      {!isArchived && (
        <div className="p-4 border-t bg-white">
          <div className="flex gap-3 items-end">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#e40115] focus:border-transparent resize-none transition-all"
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || loading}
              className="px-5 py-3 bg-[#e40115] text-white rounded-2xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Send
                </>
              )}
            </button>
          </div>
          
          {/* File sharing for quote requests */}
          <DashboardFileSharing
            onFileShared={handleFileShared}
            currentUser={userProfile?.name || "User"}
            currentCountry={getUserSendingCountry()}
            disabled={false}
          />
          
          <div className="text-xs text-gray-500 mt-3 flex justify-between items-center">
            <span className="flex items-center gap-1">
              📤 Sending as: <strong>{getUserSendingCountry()}</strong>
            </span>
            <span className="text-right">
              👥 Visible to: {selectedQR?.creatorCountry} & {selectedQR?.involvedCountry}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// General Communication component removed - no longer needed

// Main Component
export default function DashboardMessagingPanel() {
  const [selectedQuoteRequestId, setSelectedQuoteRequestId] = useState<string | null>(null);
  const [quoteRequests, setQuoteRequests] = useState<QuoteRequest[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [lastMessageTimes, setLastMessageTimes] = useState<Record<string, any>>({});
  const [lastReadTimes, setLastReadTimes] = useState<Record<string, any>>({});
  const { userProfile } = useAuth();

  // Fetch Quote Requests and Customers (same filtering as dashboard)
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [qrSnap, custSnap] = await Promise.all([
          getDocs(collection(db, "quoteRequests")),
          getDocs(collection(db, "customers"))
        ]);
        
        const allRequests = qrSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })) as QuoteRequest[];

        const allCustomers = custSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        }));

        // Filter by user's countries and exclude archived
        const userCountries = userProfile?.countries || [];
        const visibleRequests = userCountries.length > 0
          ? allRequests.filter(qr => 
              (userCountries.includes(qr.creatorCountry) || userCountries.includes(qr.involvedCountry)) &&
              !['Won', 'Lost', 'Cancelled'].includes(qr.status)
            )
          : allRequests.filter(qr => !['Won', 'Lost', 'Cancelled'].includes(qr.status));

        setQuoteRequests(visibleRequests);
        setCustomers(allCustomers);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (userProfile) {
      fetchData();
    }
  }, [userProfile]);

  // Track unread messages for all conversations
  useEffect(() => {
    if (!userProfile || quoteRequests.length === 0) return;

    const userCountries = userProfile.countries || [];
    const unsubscribeFunctions: (() => void)[] = [];

    quoteRequests.forEach(qr => {
      const messagesRef = collection(db, "quoteRequests", qr.id, "messages");
      const q = query(messagesRef, orderBy("timestamp", "desc"));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        
        // Get last read time for this conversation
        const lastReadTime = lastReadTimes[qr.id];
        
        // Count unread messages (from other countries AND after last read time)
        const unreadCount = messages.filter(msg => {
          // Must be from other country
          if (userCountries.includes(msg.senderCountry)) return false;
          
          // If no read time recorded, only count recent messages (last 24 hours)
          if (!lastReadTime) {
            const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            return msgDate > oneDayAgo;
          }
          
          // Count messages after last read time
          const msgDate = msg.timestamp?.toDate ? msg.timestamp.toDate() : new Date(msg.timestamp);
          const readDate = lastReadTime?.toDate ? lastReadTime.toDate() : new Date(lastReadTime);
          return msgDate > readDate;
        }).length;
        
        // Get last message timestamp
        const lastMessageTime = messages.length > 0 ? messages[0].timestamp : null;
        
        console.log(`📊 Unread count for QR ${qr.id}:`, {
          totalMessages: messages.length,
          messagesFromOtherCountries: messages.filter(msg => !userCountries.includes(msg.senderCountry)).length,
          unreadCount,
          lastReadTime,
          userCountries
        });
        
        setUnreadCounts(prev => ({
          ...prev,
          [qr.id]: unreadCount
        }));
        
        setLastMessageTimes(prev => ({
          ...prev,
          [qr.id]: lastMessageTime
        }));
      });
      
      unsubscribeFunctions.push(unsubscribe);
    });

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }, [userProfile, quoteRequests]);

  // Reset unread count when opening a conversation
  const handleSelectConversation = (quoteRequestId: string) => {
    setSelectedQuoteRequestId(quoteRequestId);
    
    // Mark conversation as read by storing current timestamp
    const currentTime = new Date();
    setLastReadTimes(prev => ({
      ...prev,
      [quoteRequestId]: currentTime
    }));
    
    setUnreadCounts(prev => ({
      ...prev,
      [quoteRequestId]: 0
    }));
  };

  if (loading) {
    return (
      <div className="flex h-[600px] bg-white rounded shadow border overflow-hidden items-center justify-center">
        <div>Loading messaging...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="mb-3">
        <p className="text-sm text-gray-600">
          Choose a Quote Request from the list to start messaging between countries
        </p>
      </div>
      
      {/* Full Height Messaging */}
      <div className="flex flex-1 bg-white rounded-lg shadow-lg border overflow-hidden">
        <QuoteRequestList
          onSelect={handleSelectConversation}
          selectedId={selectedQuoteRequestId}
          quoteRequests={quoteRequests}
          userCountries={userProfile?.countries || []}
          customers={customers}
          unreadCounts={unreadCounts}
          lastMessageTimes={lastMessageTimes}
        />
        <ChatWindow 
          quoteRequestId={selectedQuoteRequestId} 
          userCountries={userProfile?.countries || []}
          userProfile={userProfile}
          onBack={() => setSelectedQuoteRequestId(null)}
        />
      </div>
    </div>
  );
} 